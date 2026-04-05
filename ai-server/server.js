import express from "express";
import cors from "cors";
import { config } from "dotenv";
import textRoutes from "./routes/text.js";
import imageRoutes from "./routes/image.js";
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
    version: "2.0.0",
    name: "ChiroDX AI Server",
    models: ["gpt-4o", "gpt-4o-mini", "claude-haiku", "ollama"],
    endpoints: [
      "POST /text/grammar",
      "POST /text/completeness",
      "POST /text/translate",
      "POST /text/price-format",
      "POST /text/font-pairing",
      "POST /image/generate",
      "POST /image/color-palette",
      "POST /image/color-palette-generate",
    ],
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use("/text", textRoutes);
app.use("/image", imageRoutes);

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nChiroDX AI Server v2.0 running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health\n`);
  cleanupOldTempFiles(); // clean up leftover images on start
});
