import { Router } from "express";
import { getOpenAIClient, chatComplete, cleanJsonResponse } from "../config/modelProviders.js";
import { saveTempImage } from "../utils/tempFiles.js";
import fs from "fs";

const router = Router();

// ════════════════════════════════════════════════════════════
// POST /image/generate
// Body: { prompt: string, size?: "1024x1024"|"1024x1792"|"1792x1024" }
// Returns: { ok, localPath, revisedPrompt }
// ════════════════════════════════════════════════════════════
router.post("/generate", async (req, res, next) => {
  try {
    const { prompt, size = "1024x1024" } = req.body;
    if (!prompt?.trim())
      return res.status(400).json({ ok: false, error: "prompt is required" });

    const VALID_SIZES = ["1024x1024", "1024x1792", "1792x1024"];
    const imageSize = VALID_SIZES.includes(size) ? size : "1024x1024";

    const openai = getOpenAIClient();
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: imageSize,
      response_format: "url",
    });

    const { url, revised_prompt: revisedPrompt } = response.data[0];
    const localPath = await saveTempImage(url, "gen");

    res.json({ ok: true, localPath, revisedPrompt });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /image/color-palette
// Extract dominant colors from an existing image file on disk.
// Body: { imagePath: string }
// Returns: { ok, colors: [{hex, cmyk: {c,m,y,k}, name}] }
// ════════════════════════════════════════════════════════════
router.post("/color-palette", async (req, res, next) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath)
      return res.status(400).json({ ok: false, error: "imagePath is required" });
    if (!fs.existsSync(imagePath))
      return res.status(400).json({ ok: false, error: `File not found: ${imagePath}` });

    const ext = imagePath.split(".").pop().toLowerCase();
    const mimeType =
      ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : "image/png";

    const base64 = fs.readFileSync(imagePath).toString("base64");

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            {
              type: "text",
              text: `Extract the 5 most dominant and visually important colors from this image.
For each color return: hex code, CMYK values (0–100 scale for print), and a short descriptive name.
Return ONLY a JSON array — no markdown, no extra text:
[{ "hex": "#RRGGBB", "cmyk": { "c": 0, "m": 0, "y": 0, "k": 0 }, "name": "color name" }]`,
            },
          ],
        },
      ],
      max_tokens: 600,
    });

    let colors = [];
    try {
      colors = JSON.parse(cleanJsonResponse(response.choices[0].message.content));
      if (!Array.isArray(colors)) colors = [];
    } catch { colors = []; }

    res.json({ ok: true, colors });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /image/color-palette-generate
// Generate a color palette from a mood/style description.
// Body: { description: string, model?: string }
// Returns: { ok, colors: [{hex, cmyk, name, role}] }
// ════════════════════════════════════════════════════════════
router.post("/color-palette-generate", async (req, res, next) => {
  try {
    const { description, model = "gpt-4o-mini" } = req.body;
    if (!description?.trim())
      return res.status(400).json({ ok: false, error: "description is required" });

    const system = `You are a professional colour consultant for printed design materials (menus, flyers, business cards).

Given a mood or style description, generate a harmonious 5-colour palette for print.
Include: 1 primary, 1 secondary, 1 accent, 1 neutral, 1 background colour.
CMYK values must be accurate for CMYK print (0–100 scale).

Return ONLY a JSON array — no markdown, no extra text:
[{ "hex": "#RRGGBB", "cmyk": { "c": 0, "m": 0, "y": 0, "k": 0 }, "name": "colour name", "role": "primary|secondary|accent|neutral|background" }]`;

    const raw = await chatComplete(
      [{ role: "system", content: system }, { role: "user", content: description }],
      model
    );

    let colors = [];
    try {
      colors = JSON.parse(cleanJsonResponse(raw));
      if (!Array.isArray(colors)) colors = [];
    } catch { colors = []; }

    res.json({ ok: true, colors });
  } catch (err) {
    next(err);
  }
});

export default router;
