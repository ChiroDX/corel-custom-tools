/**
 * ChiroDX Shape Exchange Format  v1.0
 * ─────────────────────────────────────
 * Canonical TypeScript spec for the JSON payload that travels between
 * CorelDraw (VBA) ↔ ai-server ↔ Electron app.
 *
 * VBA produces this on "Send Selection".
 * The server stores it and broadcasts it via WebSocket.
 * The Electron app reads it and displays it.
 * After processing, the Electron app writes a modified copy back.
 * VBA reads that copy and applies it to the live document.
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

export interface Bounds {
  x: number;    // left edge
  y: number;    // bottom edge (CorelDraw uses bottom-left origin)
  w: number;    // width
  h: number;    // height
  unit: 'mm' | 'in' | 'px';
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

// ── Result envelope (server → VBA apply) ─────────────────────────────────────

/**
 * What the Electron app / server posts to /corel/result after processing.
 * Only the fields that changed need to be present; VBA merges them in.
 */
export interface ShapeResult {
  sessionId: string;

  /** Status set by the Electron app once the user is satisfied */
  status: 'pending' | 'ready' | 'applied' | 'cancelled';

  /**
   * Modified shapes. Only shapes that actually changed need to be included.
   * VBA matches by shapeId and skips any shape not present here.
   */
  shapes: ShapeData[];
}

// ── WebSocket event payloads ──────────────────────────────────────────────────

export type WsEventType =
  | 'selection-changed'   // VBA pushed a new selection
  | 'result-ready'        // Electron app marked result as ready to apply
  | 'result-applied'      // VBA confirmed it applied the result
  | 'session-expired'     // Server cleaned up an old session
  | 'corel-connected'     // VBA came online
  | 'corel-disconnected'; // VBA went offline (inferred from timeout)

export interface WsEvent {
  event: WsEventType;
  sessionId?: string;
  /** Quick summary for the Electron status bar — no need to fetch full payload */
  summary?: {
    shapeCount: number;
    documentName: string;
    pageNumber: number;
  };
}
