/**
 * ChiroDX  --  CorelDraw Adapter State Store
 * ─────────────────────────────────────────────
 * In-memory store for the active CorelDraw sessions.
 * Shared between the REST routes and the WebSocket broadcaster.
 *
 * Session lifecycle:
 *   PENDING  → shape was pushed by VBA, waiting for Electron to process
 *   READY    → Electron marked result as ready to apply
 *   APPLIED  → VBA confirmed it applied the result
 *   CANCELLED → Electron or VBA cancelled the session
 *
 * Sessions expire after SESSION_TTL_MS of inactivity.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Hard cap on retained sessions. Sessions normally expire on their own, but a
 * macro stuck in a send loop should not be able to grow this Map without bound.
 * When the cap is hit the oldest session is dropped.
 */
const MAX_SESSIONS = 200;

// Map<sessionId, Session>
const sessions = new Map();

// Set of WebSocket clients (ws.WebSocket instances)
const wsClients = new Set();

// ── Session helpers ───────────────────────────────────────────

/**
 * Store or overwrite a pushed selection payload.
 * Called when VBA POSTs to /corel/push.
 */
export function pushSession(payload) {
  const { sessionId } = payload;

  // Evict the oldest entry before growing past the cap (Map preserves
  // insertion order, so the first key is the least recently pushed).
  while (sessions.size >= MAX_SESSIONS && !sessions.has(sessionId)) {
    const oldest = sessions.keys().next().value;
    sessions.delete(oldest);
    clearExpiry(oldest);
  }

  sessions.set(sessionId, {
    sessionId,
    status:    'pending',
    payload,            // the full ShapeExchange object from VBA
    result:    null,    // populated when Electron posts the result
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  scheduleExpiry(sessionId);
  return sessions.get(sessionId);
}

/**
 * Get the most recent session (for the Electron app's "current" view).
 */
export function getLatestSession() {
  if (sessions.size === 0) return null;
  // Return the most recently created session
  let latest = null;
  for (const session of sessions.values()) {
    if (!latest || session.createdAt > latest.createdAt) {
      latest = session;
    }
  }
  return latest;
}

/**
 * Get a specific session by ID.
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) ?? null;
}

/**
 * Store the processed result from the Electron app.
 * Called when Electron POSTs to /corel/result.
 */
export function setResult(sessionId, resultPayload) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.result    = resultPayload;
  session.status    = 'ready';
  session.updatedAt = Date.now();
  return session;
}

/**
 * Mark a session as applied (VBA confirmed).
 */
export function markApplied(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status    = 'applied';
  session.updatedAt = Date.now();
  return session;
}

/**
 * Cancel a session.
 */
export function cancelSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status    = 'cancelled';
  session.updatedAt = Date.now();
  return session;
}

/**
 * Delete a session entirely.
 */
export function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

/**
 * List all active sessions (non-expired, non-applied, non-cancelled).
 */
export function listSessions() {
  return Array.from(sessions.values())
    .filter(s => s.status === 'pending' || s.status === 'ready')
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ── WebSocket broadcast ───────────────────────────────────────

/**
 * Register a new WebSocket client.
 */
export function addWsClient(ws) {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
}

/**
 * Broadcast a WsEvent to all connected Electron clients.
 */
export function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const client of wsClients) {
    try {
      if (client.readyState === 1 /* OPEN */) {
        client.send(msg);
      }
    } catch {
      wsClients.delete(client);
    }
  }
}

/**
 * How many WebSocket clients are currently connected.
 */
export function wsClientCount() {
  return wsClients.size;
}

// ── Expiry ────────────────────────────────────────────────────

const expiryTimers = new Map();

function clearExpiry(sessionId) {
  const timer = expiryTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(sessionId);
  }
}

function scheduleExpiry(sessionId) {
  clearExpiry(sessionId);
  const timer = setTimeout(() => {
    expiryTimers.delete(sessionId);
    if (sessions.delete(sessionId)) {
      broadcast({ event: 'session-expired', sessionId });
      console.log(`[CorelAdapter] Session ${sessionId} expired`);
    }
  }, SESSION_TTL_MS);
  // Don't hold the event loop open purely for a pending expiry.
  timer.unref?.();
  expiryTimers.set(sessionId, timer);
}
