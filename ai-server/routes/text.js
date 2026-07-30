import { Router } from "express";
import {
  chatComplete,
  cleanJsonResponse,
  parseJsonArray,
  MODEL_KEYS,
  DEFAULT_MODEL_KEY,
} from "../config/modelProviders.js";
import { DOCUMENT_TYPES, buildCompletenessPrompt } from "../config/documentTypes.js";
import {
  asyncRoute,
  requireObject,
  requireString,
  requireEnum,
  MAX_SHORT_TEXT_LENGTH,
} from "../utils/validate.js";

const router = Router();

const DOCUMENT_TYPE_KEYS = Object.keys(DOCUMENT_TYPES);

const LANGUAGE_NAMES = {
  de: "German", en: "English", fr: "French", vi: "Vietnamese",
  tr: "Turkish", ar: "Arabic", zh: "Chinese (Simplified)",
  es: "Spanish", it: "Italian", pl: "Polish", nl: "Dutch",
};

/** Model key shared by every route in this file. */
function readModel(body) {
  return requireEnum(body.model, "model", MODEL_KEYS, DEFAULT_MODEL_KEY);
}

// ════════════════════════════════════════════════════════════
// GET /text/document-types
// Lets the UI build its dropdown from the server's real list instead of
// hard-coding keys that may drift out of sync.
// Returns: { ok, documentTypes: [{ key, label }] }
// ════════════════════════════════════════════════════════════
router.get("/document-types", (req, res) => {
  res.json({
    ok: true,
    documentTypes: DOCUMENT_TYPE_KEYS.map((key) => ({
      key,
      label: DOCUMENT_TYPES[key].label,
    })),
  });
});

// ════════════════════════════════════════════════════════════
// POST /text/grammar
// Body: { text: string, model?: string }
// Returns: { ok, count, issues: [{id, original, suggestion, explanation, type}] }
// ════════════════════════════════════════════════════════════
router.post("/grammar", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const text = requireString(body.text, "text");
  const model = readModel(body);

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

  const issues = parseJsonArray(raw);
  res.json({ ok: true, count: issues.length, issues });
}));

// ════════════════════════════════════════════════════════════
// POST /text/completeness
// Body: { text: string, documentType: string, model?: string }
// Returns: { ok, documentType, score, missing, missingLabels, present,
//            presentLabels, optional_missing, notes }
// ════════════════════════════════════════════════════════════
router.post("/completeness", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const text = requireString(body.text, "text");
  const documentType = requireEnum(body.documentType, "documentType", DOCUMENT_TYPE_KEYS, "menu");
  const model = readModel(body);

  const system = buildCompletenessPrompt(documentType);
  const raw = await chatComplete(
    [{ role: "system", content: system }, { role: "user", content: text }],
    model
  );

  let result = { missing: [], present: [], optional_missing: [], notes: [] };
  try {
    const parsed = JSON.parse(cleanJsonResponse(raw));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      result = { ...result, ...parsed };
    }
  } catch {
    result.notes = ["Could not parse the AI response — please try again."];
  }

  // The model occasionally returns a scalar where an array is expected.
  const asArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const missing = asArray(result.missing);
  const present = asArray(result.present);

  // Resolve field keys → human-readable labels
  const doc = DOCUMENT_TYPES[documentType];
  const allFields = [...doc.requiredFields, ...doc.optionalFields];
  const label = (key) => allFields.find((f) => f.key === key)?.label ?? key;

  res.json({
    ok: true,
    documentType,
    score: doc.requiredFields.length > 0
      ? Math.round((present.length / doc.requiredFields.length) * 100)
      : 100,
    missing,
    missingLabels: missing.map(label),
    present,
    presentLabels: present.map(label),
    optional_missing: asArray(result.optional_missing),
    notes: asArray(result.notes),
  });
}));

// ════════════════════════════════════════════════════════════
// POST /text/translate
// Body: { text: string, targetLanguage: string, model?: string }
// Returns: { ok, translatedText, targetLanguage }
// ════════════════════════════════════════════════════════════
router.post("/translate", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const text = requireString(body.text, "text");
  const targetLanguage = requireEnum(
    body.targetLanguage,
    "targetLanguage",
    Object.keys(LANGUAGE_NAMES),
    "en"
  );
  const model = readModel(body);

  const system = `You are a professional translator specialising in restaurant menus, flyers, and business documents.
Translate the text to ${LANGUAGE_NAMES[targetLanguage]}.
Preserve the original structure: line breaks, numbering, and indentation.
Keep dish names natural for the target culture. Do not add explanations.
Return ONLY the translated text — nothing else.`;

  const translatedText = await chatComplete(
    [{ role: "system", content: system }, { role: "user", content: text }],
    model
  );

  res.json({ ok: true, translatedText, targetLanguage });
}));

// ════════════════════════════════════════════════════════════
// POST /text/price-format
// Body: { text: string, model?: string }
// Returns: { ok, count, issues: [{original, suggestion, explanation}] }
// ════════════════════════════════════════════════════════════
router.post("/price-format", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const text = requireString(body.text, "text");
  const model = readModel(body);

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

  const issues = parseJsonArray(raw);
  res.json({ ok: true, count: issues.length, issues });
}));

// ════════════════════════════════════════════════════════════
// POST /text/font-pairing
// Body: { headerFont: string, documentType?: string, model?: string }
// Returns: { ok, headerFont, suggestions: [{font, reason, googleFonts, style}] }
// ════════════════════════════════════════════════════════════
router.post("/font-pairing", asyncRoute(async (req, res) => {
  const body = requireObject(req.body);
  const headerFont = requireString(body.headerFont, "headerFont", MAX_SHORT_TEXT_LENGTH);
  const documentType = requireEnum(body.documentType, "documentType", DOCUMENT_TYPE_KEYS, "menu");
  const model = readModel(body);

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

  const suggestions = parseJsonArray(raw);
  res.json({ ok: true, headerFont, suggestions });
}));

export default router;
