import { Router } from "express";
import { chatComplete, cleanJsonResponse } from "../config/modelProviders.js";
import { DOCUMENT_TYPES, buildCompletenessPrompt } from "../config/documentTypes.js";

const router = Router();

// ── Shared helper ────────────────────────────────────────────
function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// POST /text/grammar
// Body: { text: string, model?: string }
// Returns: { ok, count, issues: [{id, original, suggestion, explanation, type}] }
// ════════════════════════════════════════════════════════════
router.post("/grammar", async (req, res, next) => {
  try {
    const { text, model = "gpt-4o-mini" } = req.body;
    if (!text?.trim())
      return res.status(400).json({ ok: false, error: "text is required" });

    const system = `You are a professional proofreader for printed design documents (menus, flyers, business cards) in German and other European languages.

Check for: spelling errors, grammar mistakes, punctuation issues, and obvious formatting problems (e.g. double spaces, wrong quotation marks).

Return ONLY a JSON array. Each item must have:
{ "id": <number>, "original": "<exact wrong text>", "suggestion": "<corrected text>", "explanation": "<brief reason in English>", "type": "spelling|grammar|punctuation|formatting" }

If there are no issues, return an empty array: []
Return ONLY valid JSON — no markdown, no extra text.`;

    const raw = await chatComplete(
      [{ role: "system", content: system }, { role: "user", content: text }],
      model
    );

    const issues = safeParseArray(raw);
    res.json({ ok: true, count: issues.length, issues });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /text/completeness
// Body: { text: string, documentType: string, model?: string }
// Returns: { ok, documentType, score, missing, missingLabels, present, presentLabels, optional_missing, notes }
// ════════════════════════════════════════════════════════════
router.post("/completeness", async (req, res, next) => {
  try {
    const { text, documentType = "menu", model = "gpt-4o-mini" } = req.body;
    if (!text?.trim())
      return res.status(400).json({ ok: false, error: "text is required" });
    if (!DOCUMENT_TYPES[documentType])
      return res.status(400).json({
        ok: false,
        error: `Unknown documentType. Valid values: ${Object.keys(DOCUMENT_TYPES).join(", ")}`,
      });

    const system = buildCompletenessPrompt(documentType);
    const raw = await chatComplete(
      [{ role: "system", content: system }, { role: "user", content: text }],
      model
    );

    let result = { missing: [], present: [], optional_missing: [], notes: [] };
    try {
      result = { ...result, ...JSON.parse(cleanJsonResponse(raw)) };
    } catch {
      result.notes = ["Could not parse AI response — please try again."];
    }

    // Resolve field keys → human-readable labels
    const doc = DOCUMENT_TYPES[documentType];
    const allFields = [...doc.requiredFields, ...doc.optionalFields];
    const label = (key) => allFields.find((f) => f.key === key)?.label ?? key;

    res.json({
      ok: true,
      documentType,
      score: doc.requiredFields.length > 0
        ? Math.round((result.present.length / doc.requiredFields.length) * 100)
        : 100,
      missing: result.missing,
      missingLabels: result.missing.map(label),
      present: result.present,
      presentLabels: result.present.map(label),
      optional_missing: result.optional_missing ?? [],
      notes: result.notes ?? [],
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /text/translate
// Body: { text: string, targetLanguage: string, model?: string }
// Returns: { ok, translatedText, targetLanguage }
// ════════════════════════════════════════════════════════════
router.post("/translate", async (req, res, next) => {
  try {
    const { text, targetLanguage = "en", model = "gpt-4o-mini" } = req.body;
    if (!text?.trim())
      return res.status(400).json({ ok: false, error: "text is required" });

    const LANG_NAMES = {
      de: "German", en: "English", fr: "French", vi: "Vietnamese",
      tr: "Turkish", ar: "Arabic", zh: "Chinese (Simplified)",
      es: "Spanish", it: "Italian", pl: "Polish", nl: "Dutch",
    };
    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;

    const system = `You are a professional translator specialising in restaurant menus, flyers, and business documents.
Translate the text to ${langName}.
Preserve the original structure: line breaks, numbering, and indentation.
Keep dish names natural for the target culture. Do not add explanations.
Return ONLY the translated text — nothing else.`;

    const translatedText = await chatComplete(
      [{ role: "system", content: system }, { role: "user", content: text }],
      model
    );

    res.json({ ok: true, translatedText, targetLanguage });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /text/price-format
// Body: { text: string, model?: string }
// Returns: { ok, count, issues: [{original, suggestion, explanation}] }
// ════════════════════════════════════════════════════════════
router.post("/price-format", async (req, res, next) => {
  try {
    const { text, model = "gpt-4o-mini" } = req.body;
    if (!text?.trim())
      return res.status(400).json({ ok: false, error: "text is required" });

    const system = `You are checking a printed menu or price list for price formatting inconsistencies.

Check for:
- Mixed decimal separators ("." vs "," — German standard is comma)
- Inconsistent currency symbol placement or spacing (e.g. "9,50€" vs "9.50 €" vs "€ 9,50")
- Missing prices where one is expected
- Inconsistent number of decimal places (e.g. "9,5" vs "9,50")

Return ONLY a JSON array of issues:
[{ "original": "<found text>", "suggestion": "<corrected format>", "explanation": "<what is wrong>" }]

If everything looks consistent, return: []
Return ONLY valid JSON — no markdown, no extra text.`;

    const raw = await chatComplete(
      [{ role: "system", content: system }, { role: "user", content: text }],
      model
    );

    const issues = safeParseArray(raw);
    res.json({ ok: true, count: issues.length, issues });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════
// POST /text/font-pairing
// Body: { headerFont: string, documentType?: string, model?: string }
// Returns: { ok, headerFont, suggestions: [{font, reason, googleFonts, style}] }
// ════════════════════════════════════════════════════════════
router.post("/font-pairing", async (req, res, next) => {
  try {
    const { headerFont, documentType = "menu", model = "gpt-4o-mini" } = req.body;
    if (!headerFont?.trim())
      return res.status(400).json({ ok: false, error: "headerFont is required" });

    const system = `You are a typography expert for printed design (menus, flyers, business cards).

Given a headline/display font and document type, suggest exactly 3 body text fonts that pair well.
Consider readability at small sizes and the mood of the document type.

Return ONLY a JSON array with exactly 3 items:
[{ "font": "Font Name", "reason": "one sentence why it pairs well", "googleFonts": true/false, "style": "serif|sans-serif|slab-serif|monospace" }]

Return ONLY valid JSON — no markdown, no extra text.`;

    const raw = await chatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: `Header font: ${headerFont}\nDocument type: ${documentType}` },
      ],
      model
    );

    const suggestions = safeParseArray(raw);
    res.json({ ok: true, headerFont, suggestions });
  } catch (err) {
    next(err);
  }
});

export default router;
