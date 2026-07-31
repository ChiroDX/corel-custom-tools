/**
 * ChiroDX Shape Exchange Format  v1.1
 * ─────────────────────────────────────
 * Canonical TypeScript spec for the JSON payload that travels between
 * CorelDraw (VBA) ↔ ai-server ↔ Electron app.
 *
 * VBA produces this on "Send Selection".
 * The server stores it and broadcasts it via WebSocket.
 * The Electron app reads it and displays it.
 * After processing, the Electron app writes a modified copy back.
 * VBA reads that copy and applies it to the live document.
 *
 * Implemented by:
 *   Makros/modules/ShapeSerializer.bas    — produces ShapeExchange
 *   Makros/modules/ShapeDeserializer.bas  — consumes ShapeResult
 *   ai-server/routes/corel.js             — the REST + WebSocket surface
 *   ai-server/corel-state.js              — the session store
 *   chiroDX-app/src/App.jsx               — renders SessionDetail
 *
 * The server validates sessionId against /^[A-Za-z0-9_-]{1,64}$/ and caps a
 * push at 500 shapes; anything else is a 400.
 */

// ── Top-level envelope ────────────────────────────────────────────────────────

export interface ShapeExchange {
  /** Unique ID for this send/apply round-trip (VBA generates a timestamp-based ID) */
  sessionId: string;

  /** Human-readable CorelDraw document name */
  documentName: string;

  /** Page number (1-based) the shapes live on */
  pageNumber: number;

  /** ISO timestamp of when VBA serialized this payload */
  sentAt: string;

  /** The selected shapes, in selection order */
  shapes: ShapeData[];
}

// ── Shape ─────────────────────────────────────────────────────────────────────

export type ShapeType = 'TextFrame' | 'ArtisticText' | 'Group' | 'Other';

export interface ShapeData {
  /**
   * Identifier used to re-locate the shape when applying results.
   * VBA sets Shape.Name = "CHIRODX_" + sessionId + "_" + index before sending,
   * then restores the original name after applying.
   */
  shapeId: string;

  /** Original shape name before we tagged it (restored on apply) */
  originalName: string;

  /** 0-based index within the selection */
  index: number;

  shapeType: ShapeType;

  /** Position and size in document units (mm by default) */
  bounds: Bounds;

  /** Which layer the shape lives on */
  layer: string;

  /**
   * Text content broken into paragraphs → character runs.
   * Empty array for non-text shapes (Group, Other).
   */
  paragraphs: ParagraphData[];

  /**
   * Child shapes — only populated when shapeType === 'Group'.
   * Recursive: groups can contain groups.
   */
  children?: ShapeData[];
}

export type BoundsUnit = 'mm' | 'in' | 'px';

export interface Bounds {
  x: number;    // left edge
  y: number;    // bottom edge (CorelDraw uses bottom-left origin)
  w: number;    // width
  h: number;    // height
  unit: BoundsUnit;
}

// ── Paragraph ─────────────────────────────────────────────────────────────────

export type Alignment = 'Left' | 'Center' | 'Right' | 'Justify' | 'None';

export interface ParagraphData {
  alignment: Alignment;

  /** Space before paragraph in points */
  spaceBefore: number;

  /** Space after paragraph in points */
  spaceAfter: number;

  /**
   * Character runs — contiguous sequences of text that share the same formatting.
   * A single paragraph may have many runs (e.g., bold word inside normal text).
   */
  runs: RunData[];
}

// ── Run (character sequence with uniform formatting) ─────────────────────────

export interface RunData {
  text: string;

  /** Font family name, e.g. "Myriad Pro" */
  font: string;

  /** Size in typographic points */
  sizePt: number;

  bold: boolean;
  italic: boolean;
  underline: boolean;

  /**
   * RGB color [0–255, 0–255, 0–255].
   * Always present; derived from the document color regardless of color mode.
   */
  colorRGB: [number, number, number];

  /**
   * CMYK color [0–100, 0–100, 0–100, 0–100].
   * Present when the document is in CMYK mode (typical for print work).
   * Omit for RGB documents.
   */
  colorCMYK?: [number, number, number, number];
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

/**
 * pending    VBA pushed a selection, nothing has come back yet
 * ready      a result has been posted and is waiting for VBA to collect it
 * applied    VBA confirmed it wrote the result into the document
 * cancelled  the user dismissed the session in the panel
 *
 * Sessions expire after 30 minutes and the store keeps at most 200 of them,
 * evicting the oldest — see ai-server/corel-state.js.
 */
export type SessionStatus = 'pending' | 'ready' | 'applied' | 'cancelled';

// ── Result envelope (Electron → server → VBA apply) ──────────────────────────

/**
 * What the Electron app posts to POST /corel/result after processing.
 * Only the fields that changed need to be present; VBA merges them in.
 */
export interface ShapeResult {
  sessionId: string;

  /**
   * Modified shapes. Only shapes that actually changed need to be included.
   * VBA matches by shapeId and skips any shape not present here.
   */
  shapes: ShapeData[];
}

// ── REST responses ────────────────────────────────────────────────────────────

/** Every ai-server endpoint answers with `ok`, and with `error` when it fails. */
export interface ApiError {
  ok: false;
  error: string;
}

/**
 * Session metadata without the shape payload.
 * Returned by GET /corel/selection and GET /corel/sessions.
 */
export interface SessionSummary {
  sessionId: string;
  status: SessionStatus;
  shapeCount: number;
  documentName: string;
  pageNumber: number;
  /** ISO timestamp VBA stamped on the push */
  sentAt: string;
  /** Epoch milliseconds, maintained by the server (not ISO strings) */
  createdAt: number;
  updatedAt: number;
}

/** GET /corel/selection/:sessionId — summary plus the shapes themselves. */
export interface SessionDetail extends SessionSummary {
  payload: ShapeExchange;
}

export type SelectionResponse =
  | { ok: true; session: SessionDetail }
  | ApiError;

export type LatestSelectionResponse =
  | { ok: true; session: SessionSummary | null }
  | ApiError;

/**
 * GET /corel/result/:sessionId — what VBA polls.
 * A missing session answers HTTP 200 with ok:false, because VBA treats any
 * non-200 as "server unreachable" and would abandon the poll loop.
 */
export type ResultPollResponse =
  | { ok: true; status: 'ready'; sessionId: string; shapes: ShapeData[] }
  | { ok: true; status: Exclude<SessionStatus, 'ready'>; shapes: [] }
  | { ok: false; status: ''; error: string };

// ── WebSocket event payloads ──────────────────────────────────────────────────

export type WsEventType =
  | 'selection-changed'   // VBA pushed a new selection
  | 'result-ready'        // Electron app marked result as ready to apply
  | 'result-applied'      // VBA confirmed it applied the result
  | 'session-expired'     // Server cleaned up an old session
  | 'corel-connected'     // sent to each client on connect
  | 'corel-disconnected'; // VBA went offline (inferred from timeout)

/** Quick summary for the status bar — saves fetching the full payload. */
export interface WsSelectionSummary {
  shapeCount: number;
  documentName: string;
  pageNumber: number;
}

/**
 * Discriminated on `event`, so a consumer that narrows on the event name gets
 * exactly the fields that event carries — `sessionId` is not optional on the
 * events that always have one.
 */
export type WsEvent =
  | { event: 'selection-changed'; sessionId: string; summary: WsSelectionSummary }
  | { event: 'result-ready'; sessionId: string }
  | { event: 'result-applied'; sessionId: string }
  | { event: 'session-expired'; sessionId: string }
  | { event: 'corel-connected' }
  | { event: 'corel-disconnected' };
