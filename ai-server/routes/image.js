import { Router } from "express";
import {
  getOpenAIClient,
  chatComplete,
  parseJsonArray,
  describeUpstream,
  ProviderError,
  MODEL_KEYS,
  DEFAULT_MODEL_KEY,
  REQUEST_TIMEOUT_MS,
} from "../config/modelProviders.js";
import { saveTempImage, readImageAsBase64 } from "../utils/tempFiles.js";
import {
  asyncRoute,
  requireObject,
  requireString,
  requireEnum,
  MAX_SHORT_TEXT_LENGTH,
} from "../utils/validate.js";

const router = Router();

/** DALL-E 3 image sizes. */
const VALID_SIZES = ["1024x1024", "1024x1792", "1792x1024"];

/** Image generation is much slower than a chat completion. */
const IMAGE_TIMEOUT_MS = 120_000;

// ════════════════════════════════════════════════════════════
// POST /image/generate
// Body: { prompt: string, size?: "1024x1024"|"1024x1792"|"1792x1024" }
// Returns: { ok, localPath, revisedPrompt }
// ════════════════════════════════════════════════════════════
router.post("/generate", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const prompt = requireString(body.prompt, "prompt", MAX_SHORT_TEXT_LENGTH);
  const size = requireEnum(body.size, "size", VALID_SIZES, "1024x1024");

  const openai = getOpenAIClient();
  let response;
  try {
    response = await openai.images.generate(
      { model: "dall-e-3", prompt, n: 1, size, response_format: "url" },
      { timeout: IMAGE_TIMEOUT_MS }
    );
  } catch (err) {
    throw new ProviderError(describeUpstream("OpenAI", err), err);
  }

  // `data` is optional in the OpenAI v7 types — never index it blindly.
  const image = response?.data?.[0];
  if (!image?.url) {
    throw new ProviderError("OpenAI did not return an image URL.");
  }

  const localPath = await saveTempImage(image.url, "gen");
  res.json({ ok: true, localPath, revisedPrompt: image.revised_prompt ?? "" });
}));

// ════════════════════════════════════════════════════════════
// POST /image/color-palette
// Extract dominant colors from an existing image file on disk.
// Body: { imagePath: string }
// Returns: { ok, colors: [{hex, cmyk: {c,m,y,k}, name}] }
//
// NOTE: imagePath is a local filesystem path. The server is intended to listen
// on localhost only (see server.js) and the path is supplied by the CorelDraw
// macro after exporting the selected bitmap. Reads are restricted to known
// image extensions and a size cap, but this endpoint must not be exposed to an
// untrusted network — it would become an arbitrary-file-read primitive.
// ════════════════════════════════════════════════════════════
router.post("/color-palette", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const imagePath = requireString(body.imagePath, "imagePath", 4096);

  const { base64, mimeType } = await readImageAsBase64(imagePath);

  const openai = getOpenAIClient();
  let response;
  try {
    response = await openai.chat.completions.create(
      {
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
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
  } catch (err) {
    throw new ProviderError(describeUpstream("OpenAI", err), err);
  }

  const colors = parseJsonArray(response.choices?.[0]?.message?.content);
  res.json({ ok: true, colors });
}));

// ════════════════════════════════════════════════════════════
// POST /image/color-palette-generate
// Generate a color palette from a mood/style description.
// Body: { description: string, model?: string }
// Returns: { ok, colors: [{hex, cmyk, name, role}] }
// ════════════════════════════════════════════════════════════
router.post("/color-palette-generate", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const description = requireString(body.description, "description", MAX_SHORT_TEXT_LENGTH);
  const model = requireEnum(body.model, "model", MODEL_KEYS, DEFAULT_MODEL_KEY);

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

  res.json({ ok: true, colors: parseJsonArray(raw) });
}));

export default router;
