import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { config } from "dotenv";
import textRoutes from "./routes/text.js";
import imageRoutes from "./routes/image.js";
import corelRoutes from "./routes/corel.js";
import { addWsClient, wsClientCount } from "./corel-state.js";
import { cleanupOldTempFiles } from "./utils/tempFiles.js";
import { ValidationError } from "./utils/validate.js";

config({ quiet: true });

export const SERVER_VERSION = "3.1.0";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/**
 * Bind to loopback by default. Several endpoints intentionally touch the local
 * filesystem (image colour extraction) and there is no authentication, so the
 * server must not be reachable from the network unless an operator opts in by
 * setting HOST explicitly.
 */
const HOST = process.env.HOST || "127.0.0.1";

// Same-origin is not a thing for the CorelDraw macro (it posts from a COM
// host), so CORS stays open — but the listener above keeps it local-only.
app.use(cors());
app.use(express.json({ limit: "10mb" })); // larger limit for base64 image payloads

// ── Health check ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: SERVER_VERSION,
    name: "ChiroDX AI Server",
    models: ["gpt-4o", "gpt-4o-mini", "claude-haiku", "ollama"],
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    corelAdapter: {
      wsClients: wsClientCount(),
    },
    endpoints: [
      "GET  /text/document-types",
      "POST /text/grammar",
      "POST /text/completeness",
      "POST /text/translate",
      "POST /text/price-format",
      "POST /text/font-pairing",
      "POST /image/generate",
      "POST /image/color-palette",
      "POST /image/color-palette-generate",
      "POST /corel/push",
      "GET  /corel/selection",
      "GET  /corel/selection/:sessionId",
      "GET  /corel/sessions",
      "POST /corel/result",
      "GET  /corel/result/:sessionId",
      "POST /corel/result/:sessionId/applied",
      "POST /corel/session/:sessionId/cancel",
      "WS   /corel/events",
    ],
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use("/text", textRoutes);
app.use("/image", imageRoutes);
app.use("/corel", corelRoutes);

// ── Unknown route → JSON 404 (never Express's HTML default) ──
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Unknown endpoint: ${req.method} ${req.path}` });
});

// ── Global error handler ────────────────────────────────────
// Clients see a short, actionable message. The full error (which may contain
// request bodies, file paths, or provider internals) only ever goes to the
// server console.
app.use((err, req, res, _next) => {
  const status =
    err instanceof ValidationError ? 400 :
    typeof err.status === "number" && err.status >= 400 && err.status <= 599 ? err.status :
    err.type === "entity.too.large" ? 413 :
    err.type === "entity.parse.failed" ? 400 :
    500;

  // A 4xx is the caller's problem and not worth a stack trace.
  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.path}`, err);
  } else {
    console.warn(`[Rejected] ${req.method} ${req.path} -> ${status}: ${err.message}`);
  }

  const message =
    err.publicMessage ??
    (status === 413 ? "Request payload is too large." :
     status === 400 ? err.message :
     status < 500 ? err.message :
     "Internal server error. Check the ChiroDX server console for details.");

  if (res.headersSent) return;
  res.status(status).json({ ok: false, error: message });
});

// ── HTTP server (needed to attach WebSocket) ─────────────────
const httpServer = createServer(app);

// ── WebSocket server ─────────────────────────────────────────
// Electron app connects here to receive live events from CorelDraw.
// Path: ws://localhost:3000/corel/events
const wss = new WebSocketServer({ server: httpServer, path: "/corel/events" });

wss.on("connection", (ws) => {
  addWsClient(ws);
  console.log(`[WS] Electron client connected (total: ${wsClientCount()})`);

  // Send current connection status immediately on connect
  ws.send(JSON.stringify({ event: "corel-connected" }));

  ws.on("close", () => {
    console.log(`[WS] Electron client disconnected (total: ${wsClientCount()})`);
  });

  ws.on("error", (err) => {
    console.error("[WS] Client error:", err.message);
  });
});

// ── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, HOST, () => {
  console.log(`\nChiroDX AI Server v${SERVER_VERSION} running on http://${HOST}:${PORT}`);
  console.log(`Health check:   http://${HOST}:${PORT}/health`);
  console.log(`CorelDraw WS:   ws://${HOST}:${PORT}/corel/events\n`);
  cleanupOldTempFiles(); // clean up leftover images on start
});

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n[Fatal] Port ${PORT} is already in use — the ChiroDX server is probably already running.\n`
    );
  } else {
    console.error("\n[Fatal] Could not start the server:", err.message, "\n");
  }
  process.exit(1);
});

// ── Graceful shutdown ────────────────────────────────────────
// The Electron app kills this process on quit; close sockets first so a
// restart does not hit EADDRINUSE.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n[Shutdown] ${signal} received, closing server...`);
    for (const client of wss.clients) client.terminate();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
