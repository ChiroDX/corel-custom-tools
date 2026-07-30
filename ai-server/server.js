import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "dotenv";
import textRoutes from "./routes/text.js";
import imageRoutes from "./routes/image.js";
import corelRoutes from "./routes/corel.js";
import { addWsClient, wsClientCount } from "./corel-state.js";
import { cleanupOldTempFiles } from "./utils/tempFiles.js";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" })); // larger limit for base64 image payloads

// ── Health check ────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "3.0.0",
    name: "ChiroDX AI Server",
    models: ["gpt-4o", "gpt-4o-mini", "claude-haiku", "ollama"],
    corelAdapter: {
      wsClients: wsClientCount(),
    },
    endpoints: [
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

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

// ── HTTP server (needed to attach WebSocket) ─────────────────
const httpServer = createServer(app);

// ── WebSocket server ─────────────────────────────────────────
// Electron app connects here to receive live events from CorelDraw.
// Path: ws://localhost:3000/corel/events
const wss = new WebSocketServer({ server: httpServer, path: "/corel/events" });

wss.on("connection", (ws, req) => {
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
httpServer.listen(PORT, () => {
  console.log(`\nChiroDX AI Server v3.0 running on http://localhost:${PORT}`);
  console.log(`Health check:   http://localhost:${PORT}/health`);
  console.log(`CorelDraw WS:   ws://localhost:${PORT}/corel/events\n`);
  cleanupOldTempFiles(); // clean up leftover images on start
});
