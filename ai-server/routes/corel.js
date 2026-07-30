/**
 * ChiroDX  --  CorelDraw Adapter Routes  v1.0
 * ─────────────────────────────────────────────
 * REST endpoints for the VBA ↔ Electron adapter.
 *
 * VBA (CorelDraw) calls:
 *   POST /corel/push                  — send selection payload
 *   GET  /corel/result/:sessionId     — poll for result
 *   POST /corel/result/:sessionId/applied — confirm apply
 *
 * Electron app calls:
 *   GET  /corel/selection             — get latest selection
 *   GET  /corel/selection/:sessionId  — get specific session
 *   GET  /corel/sessions              — list active sessions
 *   POST /corel/result                — post processed result
 *   POST /corel/session/:sessionId/cancel — cancel session
 *
 * WebSocket at /corel/events is set up in server.js (needs the http.Server).
 */

import { Router } from 'express';
import {
  pushSession,
  getSession,
  getLatestSession,
  setResult,
  markApplied,
  cancelSession,
  listSessions,
  broadcast,
} from '../corel-state.js';

const router = Router();

// ── VBA → Server ─────────────────────────────────────────────

/**
 * POST /corel/push
 * VBA sends the serialized selection here.
 * Body: ShapeExchange JSON (see specs/shape-format.ts)
 */
router.post('/push', (req, res) => {
  const payload = req.body;

  if (!payload?.sessionId) {
    return res.status(400).json({ ok: false, error: 'Missing sessionId in payload' });
  }

  const session = pushSession(payload);

  // Broadcast to all connected Electron clients
  broadcast({
    event:     'selection-changed',
    sessionId: session.sessionId,
    summary: {
      shapeCount:   payload.shapes?.length ?? 0,
      documentName: payload.documentName ?? '',
      pageNumber:   payload.pageNumber ?? 1,
    },
  });

  console.log(`[CorelAdapter] Push session=${payload.sessionId} shapes=${payload.shapes?.length ?? 0}`);

  res.json({ ok: true, sessionId: session.sessionId });
});

/**
 * GET /corel/result/:sessionId
 * VBA polls this to check whether Electron has posted a result.
 * Returns the full result payload when status === 'ready'.
 */
router.get('/result/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    return res.json({ ok: false, status: '', error: 'Session not found or expired' });
  }

  if (session.status !== 'ready') {
    // Tell VBA the status so it can show the right message
    return res.json({ ok: true, status: session.status, shapes: [] });
  }

  res.json({
    ok:        true,
    status:    'ready',
    sessionId: session.sessionId,
    shapes:    session.result?.shapes ?? [],
  });
});

/**
 * POST /corel/result/:sessionId/applied
 * VBA calls this after successfully applying the result.
 */
router.post('/result/:sessionId/applied', (req, res) => {
  const session = markApplied(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: 'Session not found' });
  }

  broadcast({ event: 'result-applied', sessionId: session.sessionId });
  console.log(`[CorelAdapter] Applied session=${session.sessionId}`);

  res.json({ ok: true });
});

// ── Electron → Server ─────────────────────────────────────────

/**
 * GET /corel/selection
 * Electron app gets the most recent selection.
 */
router.get('/selection', (req, res) => {
  const session = getLatestSession();

  if (!session) {
    return res.json({ ok: true, session: null });
  }

  res.json({
    ok:      true,
    session: sessionSummary(session),
  });
});

/**
 * GET /corel/selection/:sessionId
 * Electron app gets a specific session with full payload.
 */
router.get('/selection/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: 'Session not found or expired' });
  }

  res.json({
    ok:      true,
    session: {
      ...sessionSummary(session),
      payload: session.payload,
    },
  });
});

/**
 * GET /corel/sessions
 * Electron app lists all pending/ready sessions.
 */
router.get('/sessions', (req, res) => {
  res.json({
    ok:       true,
    sessions: listSessions().map(sessionSummary),
  });
});

/**
 * POST /corel/result
 * Electron app posts the processed result.
 * Body: { sessionId, shapes: ShapeData[] }
 * (Only shapes that changed need to be included)
 */
router.post('/result', (req, res) => {
  const { sessionId, shapes } = req.body;

  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: 'Session not found or expired' });
  }

  setResult(sessionId, { sessionId, shapes: shapes ?? [] });

  broadcast({ event: 'result-ready', sessionId });
  console.log(`[CorelAdapter] Result ready session=${sessionId} shapes=${shapes?.length ?? 0}`);

  res.json({ ok: true, sessionId });
});

/**
 * POST /corel/session/:sessionId/cancel
 * Electron app cancels a session (user dismissed it).
 */
router.post('/session/:sessionId/cancel', (req, res) => {
  const session = cancelSession(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: 'Session not found' });
  }

  broadcast({ event: 'session-expired', sessionId: session.sessionId });
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────

function sessionSummary(session) {
  return {
    sessionId:    session.sessionId,
    status:       session.status,
    shapeCount:   session.payload?.shapes?.length ?? 0,
    documentName: session.payload?.documentName ?? '',
    pageNumber:   session.payload?.pageNumber ?? 1,
    sentAt:       session.payload?.sentAt ?? '',
    createdAt:    session.createdAt,
    updatedAt:    session.updatedAt,
  };
}

export default router;
