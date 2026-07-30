import test from "node:test";
import assert from "node:assert/strict";

import {
  ValidationError,
  requireString,
  requireEnum,
  optionalString,
  requireObject,
  asyncRoute,
  MAX_TEXT_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
} from "../utils/validate.js";

test("requireString trims and returns a valid value", () => {
  assert.equal(requireString("  hello  ", "text"), "hello");
});

test("requireString rejects non-strings and blank strings", () => {
  for (const bad of [undefined, null, 42, {}, [], true, "", "   "]) {
    assert.throws(() => requireString(bad, "text"), ValidationError);
  }
});

test("requireString enforces the length cap", () => {
  const long = "x".repeat(MAX_TEXT_LENGTH + 1);
  assert.throws(() => requireString(long, "text"), /text is too long/);
  assert.equal(requireString("x".repeat(MAX_TEXT_LENGTH), "text").length, MAX_TEXT_LENGTH);
});

test("requireString honours a custom max length", () => {
  assert.throws(() => requireString("abcd", "font", 3), /max 3 characters/);
});

test("ValidationError carries a 400 status", () => {
  const err = new ValidationError("nope");
  assert.equal(err.status, 400);
  assert.equal(err.name, "ValidationError");
  assert.ok(err instanceof Error);
});

test("requireEnum accepts allowed values and falls back when absent", () => {
  const allowed = ["menu", "flyer"];
  assert.equal(requireEnum("flyer", "documentType", allowed, "menu"), "flyer");
  assert.equal(requireEnum(undefined, "documentType", allowed, "menu"), "menu");
  assert.equal(requireEnum(null, "documentType", allowed, "menu"), "menu");
  assert.equal(requireEnum("", "documentType", allowed, "menu"), "menu");
});

test("requireEnum rejects an unknown value even when a fallback exists", () => {
  // This is the behaviour that surfaced the App.jsx dropdown drift: a key the
  // server does not know must be a 400, not a silent fallback.
  assert.throws(
    () => requireEnum("business_card", "documentType", ["menu", "businessCard"], "menu"),
    /Invalid documentType/
  );
});

test("requireEnum without a fallback requires the field", () => {
  assert.throws(() => requireEnum(undefined, "model", ["a"]), /model is required/);
});

test("optionalString returns the fallback when absent and validates otherwise", () => {
  assert.equal(optionalString(undefined, "size"), "");
  assert.equal(optionalString(null, "size", "1024"), "1024");
  assert.equal(optionalString("", "size", "1024"), "1024");
  assert.equal(optionalString("  x  ", "size"), "x");
  assert.throws(
    () => optionalString("y".repeat(MAX_SHORT_TEXT_LENGTH + 1), "size"),
    ValidationError
  );
});

test("requireObject accepts plain objects only", () => {
  assert.deepEqual(requireObject({ a: 1 }), { a: 1 });
  for (const bad of [null, [], "str", 7]) {
    assert.throws(() => requireObject(bad), ValidationError);
  }
});

test("asyncRoute forwards a rejection to next()", async () => {
  const boom = new Error("boom");
  let forwarded = null;
  const handler = asyncRoute(async () => { throw boom; });
  await handler({}, {}, (err) => { forwarded = err; });
  assert.equal(forwarded, boom);
});

test("asyncRoute forwards a synchronous throw to next()", async () => {
  const boom = new ValidationError("bad body");
  let forwarded = null;
  const handler = asyncRoute(() => { throw boom; });
  await handler({}, {}, (err) => { forwarded = err; });
  assert.equal(forwarded, boom);
});

test("asyncRoute leaves next() alone on success", async () => {
  let called = false;
  const handler = asyncRoute(async () => "ok");
  await handler({}, {}, () => { called = true; });
  assert.equal(called, false);
});
