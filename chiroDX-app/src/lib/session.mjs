/**
 * Pure helpers shared by the renderer.
 *
 * Kept free of React and of any browser global so they can be unit-tested with
 * `node --test`. The file is .mjs because chiroDX-app is a CommonJS package
 * (Electron's sandboxed preload has to be CommonJS), and these need to be ESM
 * for both Vite and Node.
 */

/**
 * Flatten a CorelDraw selection payload into one plain-text string.
 *
 * The shape of the payload is `specs/shape-format.ts` → ShapeExchange:
 * session.payload.shapes[].paragraphs[].runs[].text
 *
 * @param {object|null|undefined} session
 * @returns {string} the concatenated run text, space-separated
 */
export function extractTextFromSession(session) {
  const shapes = session?.payload?.shapes;
  if (!Array.isArray(shapes)) return '';
  return shapes
    .flatMap((s) => (Array.isArray(s?.paragraphs) ? s.paragraphs : []))
    .flatMap((p) => (Array.isArray(p?.runs) ? p.runs : []))
    .map((r) => (typeof r?.text === 'string' ? r.text : ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * One-line preview of a single shape, for the collapsed shape card.
 *
 * @param {object|null|undefined} shape
 * @param {number} [maxChars]
 * @returns {string} '' when the shape carries no text
 */
export function shapePreview(shape, maxChars = 60) {
  const text = (Array.isArray(shape?.paragraphs) ? shape.paragraphs : [])
    .flatMap((p) => (Array.isArray(p?.runs) ? p.runs : []))
    .map((r) => (typeof r?.text === 'string' ? r.text : ''))
    .join('');
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/**
 * CSS colour for a run, tolerating a missing or malformed colorRGB triple.
 *
 * @param {unknown} colorRGB expected [r, g, b] with 0–255 components
 * @returns {string} a CSS rgb() string, falling back to the panel's body colour
 */
export function runColor(colorRGB) {
  const ok =
    Array.isArray(colorRGB) &&
    colorRGB.length === 3 &&
    colorRGB.every((n) => Number.isFinite(n) && n >= 0 && n <= 255);
  return ok ? `rgb(${colorRGB.join(',')})` : 'rgb(204,204,204)';
}

/**
 * Turn whatever came back from ai-server into a message worth showing.
 *
 * The server answers errors as `{ ok: false, error }` with a 4xx/5xx status,
 * so a parsed body is not automatically a success.
 *
 * @param {object|null} data parsed response body, or null when the fetch failed
 * @param {string} [fallback]
 * @returns {string|null} an error message, or null when `data` is a success
 */
export function apiErrorMessage(data, fallback = 'The server returned an unexpected response.') {
  if (data === null || data === undefined) {
    return 'Cannot reach the server. It may still be starting up — wait a moment and try again.';
  }
  if (data.ok === false) {
    return typeof data.error === 'string' && data.error ? data.error : fallback;
  }
  return null;
}

/**
 * Human-readable summary line for a completeness check response.
 *
 * @param {{score?: number, missingLabels?: string[], presentLabels?: string[]}} data
 * @returns {string}
 */
export function completenessSummary(data) {
  const score = Number.isFinite(data?.score) ? data.score : 0;
  const present = Array.isArray(data?.presentLabels) ? data.presentLabels.length : 0;
  const missing = Array.isArray(data?.missingLabels) ? data.missingLabels.length : 0;
  return `${score}% complete — ${present} of ${present + missing} required fields found.`;
}
