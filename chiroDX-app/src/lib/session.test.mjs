import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractTextFromSession,
  shapePreview,
  runColor,
  apiErrorMessage,
  completenessSummary,
} from './session.mjs';

/** Minimal ShapeExchange session, as VBA would send it. */
function makeSession(shapes) {
  return {
    sessionId: 's1',
    status: 'pending',
    payload: { sessionId: 's1', documentName: 'Menu.cdr', pageNumber: 1, shapes },
  };
}

test('extractTextFromSession joins every run across shapes and paragraphs', () => {
  const session = makeSession([
    { paragraphs: [{ runs: [{ text: 'Tages' }, { text: 'karte' }] }] },
    { paragraphs: [{ runs: [{ text: 'Suppe' }] }, { runs: [{ text: '4,50 €' }] }] },
  ]);
  assert.equal(extractTextFromSession(session), 'Tages karte Suppe 4,50 €');
});

test('extractTextFromSession tolerates missing and malformed levels', () => {
  assert.equal(extractTextFromSession(null), '');
  assert.equal(extractTextFromSession(undefined), '');
  assert.equal(extractTextFromSession({}), '');
  assert.equal(extractTextFromSession({ payload: {} }), '');
  assert.equal(extractTextFromSession({ payload: { shapes: 'nope' } }), '');
  assert.equal(extractTextFromSession(makeSession([{}, { paragraphs: null }])), '');
  assert.equal(
    extractTextFromSession(makeSession([{ paragraphs: [{ runs: [{}, { text: 'ok' }] }] }])),
    'ok'
  );
});

test('shapePreview concatenates runs without a separator and truncates', () => {
  const shape = { paragraphs: [{ runs: [{ text: 'Gemischter ' }, { text: 'Salat' }] }] };
  assert.equal(shapePreview(shape), 'Gemischter Salat');
  assert.equal(shapePreview(shape, 10), 'Gemischter…');
  assert.equal(shapePreview({ shapeType: 'Group' }), '');
  assert.equal(shapePreview(null), '');
});

test('shapePreview does not truncate text exactly at the limit', () => {
  const shape = { paragraphs: [{ runs: [{ text: 'abcde' }] }] };
  assert.equal(shapePreview(shape, 5), 'abcde');
});

test('runColor accepts a valid triple and rejects anything else', () => {
  assert.equal(runColor([255, 0, 128]), 'rgb(255,0,128)');
  assert.equal(runColor([0, 0, 0]), 'rgb(0,0,0)');
  assert.equal(runColor(undefined), 'rgb(204,204,204)');
  assert.equal(runColor([1, 2]), 'rgb(204,204,204)');
  assert.equal(runColor([1, 2, 3, 4]), 'rgb(204,204,204)');
  assert.equal(runColor([300, 0, 0]), 'rgb(204,204,204)');
  assert.equal(runColor(['a', 'b', 'c']), 'rgb(204,204,204)');
});

test('apiErrorMessage distinguishes an unreachable server from a rejected request', () => {
  assert.match(apiErrorMessage(null), /Cannot reach the server/);
  assert.equal(
    apiErrorMessage({ ok: false, error: 'text is required and must be a non-empty string' }),
    'text is required and must be a non-empty string'
  );
  assert.equal(apiErrorMessage({ ok: false }), 'The server returned an unexpected response.');
  assert.equal(apiErrorMessage({ ok: true, issues: [] }), null);
});

test('completenessSummary reports the score and the field counts', () => {
  assert.equal(
    completenessSummary({ score: 67, presentLabels: ['a', 'b'], missingLabels: ['c'] }),
    '67% complete — 2 of 3 required fields found.'
  );
  assert.equal(completenessSummary({}), '0% complete — 0 of 0 required fields found.');
});
