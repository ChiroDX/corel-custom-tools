/**
 * Request-validation helpers.
 *
 * Every route validates its input through these so that a malformed request
 * always produces a predictable `400 { ok: false, error }` instead of throwing
 * deep inside a provider SDK (which would surface as an opaque 500).
 */

/** Thrown by the helpers below; turned into a 400 by the error handler. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

/** Longest text we will forward to a model. Keeps prompts (and bills) bounded. */
export const MAX_TEXT_LENGTH = 100_000;

/** Longest free-form parameter (font name, palette description, image prompt). */
export const MAX_SHORT_TEXT_LENGTH = 2_000;

/**
 * Require a non-empty string field.
 * @param {unknown} value    raw value from the request body
 * @param {string}  field    field name, used in the error message
 * @param {number}  maxLength
 * @returns {string} the trimmed value
 */
export function requireString(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required and must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${field} is too long (max ${maxLength} characters)`);
  }
  return value.trim();
}

/**
 * Require a value from a fixed set.
 * @param {unknown}  value
 * @param {string}   field
 * @param {string[]} allowed
 * @param {string}   [fallback] returned when the value is absent
 */
export function requireEnum(value, field, allowed, fallback) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`${field} is required (one of: ${allowed.join(", ")})`);
  }
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ValidationError(`Invalid ${field}. Valid values: ${allowed.join(", ")}`);
  }
  return value;
}

/**
 * Optional short string — returns the fallback when absent.
 */
export function optionalString(value, field, fallback = "", maxLength = MAX_SHORT_TEXT_LENGTH) {
  if (value === undefined || value === null || value === "") return fallback;
  return requireString(value, field, maxLength);
}

/** Require the request body to be a plain JSON object. */
export function requireObject(value, field = "request body") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be a JSON object`);
  }
  return value;
}

/**
 * Wrap an async Express handler so rejected promises reach the error handler.
 * Express 5 forwards rejections automatically, but being explicit keeps the
 * behaviour obvious at each call site.
 */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
