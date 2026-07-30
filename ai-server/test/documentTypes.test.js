import test from "node:test";
import assert from "node:assert/strict";

import { DOCUMENT_TYPES, buildCompletenessPrompt } from "../config/documentTypes.js";

test("every document type is well formed", () => {
  const keys = Object.keys(DOCUMENT_TYPES);
  assert.ok(keys.length > 0);

  for (const key of keys) {
    const doc = DOCUMENT_TYPES[key];
    assert.equal(typeof doc.label, "string", `${key}: label`);
    assert.ok(Array.isArray(doc.requiredFields), `${key}: requiredFields`);
    assert.ok(Array.isArray(doc.optionalFields), `${key}: optionalFields`);
    assert.ok(doc.requiredFields.length > 0, `${key}: needs at least one required field`);

    for (const f of doc.requiredFields) {
      assert.equal(typeof f.key, "string", `${key}.${f.key}: key`);
      assert.equal(typeof f.label, "string", `${key}.${f.key}: label`);
      assert.equal(typeof f.hint, "string", `${key}.${f.key}: hint`);
    }
    for (const f of doc.optionalFields) {
      assert.equal(typeof f.key, "string");
      assert.equal(typeof f.label, "string");
    }
  }
});

test("field keys are unique within a document type", () => {
  // Duplicate keys would make the missing/present label lookup ambiguous.
  for (const [key, doc] of Object.entries(DOCUMENT_TYPES)) {
    const all = [...doc.requiredFields, ...doc.optionalFields].map((f) => f.key);
    assert.equal(new Set(all).size, all.length, `${key} has a duplicate field key`);
  }
});

test("document type keys are safe to put in a URL and a dropdown", () => {
  for (const key of Object.keys(DOCUMENT_TYPES)) {
    assert.match(key, /^[A-Za-z][A-Za-z0-9]*$/, `${key} is not a plain identifier`);
  }
});

test("buildCompletenessPrompt names every field of the requested type", () => {
  const prompt = buildCompletenessPrompt("menu");
  for (const f of DOCUMENT_TYPES.menu.requiredFields) {
    assert.ok(prompt.includes(f.key), `prompt is missing required field ${f.key}`);
  }
  for (const f of DOCUMENT_TYPES.menu.optionalFields) {
    assert.ok(prompt.includes(f.key), `prompt is missing optional field ${f.key}`);
  }
  assert.ok(prompt.includes(DOCUMENT_TYPES.menu.label));
  assert.ok(prompt.includes('"missing"'));
  assert.ok(prompt.includes('"present"'));
});

test("buildCompletenessPrompt builds for every declared type", () => {
  for (const key of Object.keys(DOCUMENT_TYPES)) {
    assert.equal(typeof buildCompletenessPrompt(key), "string");
  }
});

test("buildCompletenessPrompt rejects an unknown type", () => {
  assert.throws(() => buildCompletenessPrompt("business_card"), /Unknown documentType/);
  assert.throws(() => buildCompletenessPrompt(undefined), /Unknown documentType/);
});
