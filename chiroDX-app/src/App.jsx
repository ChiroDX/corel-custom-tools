import { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  extractTextFromSession,
  shapePreview,
  runColor,
  apiErrorMessage,
  completenessSummary,
} from './lib/session.mjs';

const SERVER    = 'http://localhost:3000';
const SERVER_WS = 'ws://localhost:3000/corel/events';

// ── API helpers ───────────────────────────────────────────────────
// Both helpers return the parsed body for any HTTP status (the server answers
// errors as JSON `{ ok: false, error }`) and null only when the request itself
// failed — a timeout, or the server not being up yet. Callers tell the two
// apart with apiErrorMessage().

async function apiGet(endpoint) {
  try {
    const res = await fetch(`${SERVER}${endpoint}`, { signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch { return null; }
}

async function apiPost(endpoint, data, timeoutMs = 60000) {
  try {
    const res = await fetch(`${SERVER}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await res.json();
  } catch { return null; }
}

// ── Clipboard helpers ─────────────────────────────────────────────
async function writeClipboard(text) {
  if (window.electronAPI) return window.electronAPI.writeClipboard(text);
  try { await navigator.clipboard.writeText(text); } catch { /* browser dev mode */ }
}

// ── Small design-system components ───────────────────────────────

function SectionHeader({ title, count, id }) {
  return (
    <h2 id={id} style={{
      background: '#37373d', padding: '5px 12px', fontSize: 11,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: '#d0d0d0', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', flexShrink: 0, margin: 0,
    }}>
      <span>{title}</span>
      {count != null && (
        <span style={{
          background: '#0e639c', color: '#fff', borderRadius: 10,
          padding: '1px 7px', fontSize: 10, fontWeight: 700,
        }}>
          {count}
          <span className="visually-hidden"> items</span>
        </span>
      )}
    </h2>
  );
}

function Section({ title, count, children }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} style={{ marginBottom: 1 }}>
      <SectionHeader id={headingId} title={title} count={count} />
      <div style={{ padding: '10px 10px 6px', background: '#1e1e1e' }}>
        {children}
      </div>
    </section>
  );
}

function Btn({ onClick, disabled, children, variant = 'primary', flex = false, title }) {
  const [hover, setHover] = useState(false);
  const themes = {
    primary:   { bg: '#0e639c', hov: '#1177bb', text: '#fff' },
    secondary: { bg: '#313131', hov: '#3e3e3e', text: '#e0e0e0' },
    danger:    { bg: '#6b1c1c', hov: '#7f2020', text: '#ffb3b3' },
    success:   { bg: '#1a5c2e', hov: '#1e6e36', text: '#8fe3cd' },
  };
  const t = themes[variant] || themes.primary;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 10px',
        background: disabled ? '#2a2a2a' : (hover ? t.hov : t.bg),
        color: disabled ? '#8a8a8a' : t.text,
        border: 'none', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12.5, fontWeight: 500,
        width: flex ? undefined : '100%',
        flex: flex ? 1 : undefined,
        textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', marginBottom: 4, transition: 'background 0.1s',
      }}>
      {children}
    </button>
  );
}

/**
 * A labelled form control. `render` receives the id that ties the <label> to
 * the field, so every input in the panel has a programmatic name.
 */
function Field({ label, hint, render }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div style={{ marginBottom: 8 }}>
      <label htmlFor={id} style={{
        display: 'block', fontSize: 11, color: '#b0b0b0',
        marginBottom: 4, marginTop: 6,
      }}>
        {label}
      </label>
      {render(id, hint ? hintId : undefined)}
      {hint && (
        <div id={hintId} style={{ fontSize: 10, color: '#8f8f8f', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Select({ id, describedBy, value, onChange, options }) {
  return (
    <select id={id} aria-describedby={describedBy} value={value}
      onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextArea({ id, describedBy, value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea id={id} aria-describedby={describedBy} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} />
  );
}

function TextInput({ id, describedBy, value, onChange, placeholder }) {
  return (
    <input id={id} aria-describedby={describedBy} type="text" value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  );
}

// ── ShapeCard — displays one shape from the CorelDraw selection ───

function ShapeCard({ shape }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const preview = shapePreview(shape);

  const typeIcon = shape.shapeType === 'Group' ? '📦'
    : shape.shapeType === 'ArtisticText' ? '✏️'
    : '📝';

  return (
    <div style={{
      background: '#252526', border: '1px solid #3e3e3e', borderRadius: 3,
      marginBottom: 5, overflow: 'hidden',
    }}>
      {/* Header row — a real button so it is reachable by keyboard */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        style={{
          padding: '6px 9px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 7, width: '100%', background: 'transparent',
          border: 'none', textAlign: 'left', color: 'inherit',
        }}>
        <span style={{ fontSize: 13 }} aria-hidden="true">{typeIcon}</span>
        <span style={{ fontSize: 11.5, color: '#d4d4d4', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview || <em style={{ color: '#8f8f8f' }}>(no text)</em>}
        </span>
        <span style={{ fontSize: 10, color: '#8f8f8f', flexShrink: 0 }} aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded: show paragraph + run detail */}
      {expanded && (
        <div id={detailsId} style={{ borderTop: '1px solid #3e3e3e', padding: '6px 9px' }}>
          {shape.paragraphs?.map((para, pi) => (
            <div key={pi} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#8f8f8f' }}>
                ¶ {para.alignment}
              </span>
              {para.runs?.map((run, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'center',
                  marginTop: 2, paddingLeft: 8 }}>
                  {/* Colour swatch — decorative, the value is in the text beside it */}
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: runColor(run.colorRGB),
                    border: '1px solid #555',
                  }} aria-hidden="true" />
                  <span style={{ fontSize: 11, color: '#d4d4d4', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    &quot;{run.text}&quot;
                  </span>
                  <span style={{ fontSize: 10, color: '#8f8f8f', flexShrink: 0,
                    whiteSpace: 'nowrap' }}>
                    {run.font} {run.sizePt}pt
                    {run.bold ? ' B' : ''}
                    {run.italic ? ' I' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#8f8f8f', marginTop: 4 }}>
            {shape.shapeType} · {shape.layer}
            {shape.bounds ? ` · ${Math.round(shape.bounds.w)}×${Math.round(shape.bounds.h)} ${shape.bounds.unit}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SelectionPanel — live view of CorelDraw selection ────────────

function SelectionPanel({ session, onApplyInCorel, applyPending }) {
  if (!session) {
    return (
      <p style={{ padding: '12px 10px', color: '#9a9a9a', fontSize: 12, fontStyle: 'italic' }}>
        Select objects in CorelDraw, then click
        &quot;Send Selection → AI App&quot; in the VBA panel.
      </p>
    );
  }

  return (
    <div>
      {/* Session meta */}
      <div style={{ fontSize: 10, color: '#9a9a9a', marginBottom: 8, display: 'flex',
        justifyContent: 'space-between' }}>
        <span>{session.documentName || 'Untitled'} · page {session.pageNumber}</span>
        <span style={{
          background: session.status === 'ready' ? '#1a5c2e'
            : session.status === 'applied' ? '#313131' : '#37373d',
          color: session.status === 'ready' ? '#8fe3cd'
            : session.status === 'applied' ? '#a0a0a0' : '#c0c0c0',
          borderRadius: 3, padding: '1px 6px', fontSize: 10,
        }}>{session.status}</span>
      </div>

      {/* Shape cards */}
      {session.payload?.shapes?.map((shape, i) => (
        <ShapeCard key={shape.shapeId || i} shape={shape} />
      ))}

      {/* Apply button */}
      {session.status !== 'applied' && (
        <Btn
          onClick={onApplyInCorel}
          disabled={applyPending}
          variant="success"
        >
          {applyPending ? '⏳ Applying…' : '✓  Apply in CorelDraw'}
        </Btn>
      )}
    </div>
  );
}

// ── Result item ───────────────────────────────────────────────────
const TYPE_COLOR = {
  error:      '#f44747',
  warning:    '#ce9178',
  suggestion: '#4ec9b0',
  info:       '#569cd6',
  fix:        '#b5cea8',
};

function ResultItem({ item, onApply }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await writeClipboard(item.fixed || item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const lines = item.text.split('\n');
  return (
    <li style={{
      background: '#252526', border: '1px solid #3e3e3e',
      borderLeft: `3px solid ${TYPE_COLOR[item.type] || '#777'}`,
      borderRadius: 3, padding: '7px 9px', marginBottom: 5, fontSize: 12,
      listStyle: 'none',
    }} className="selectable">
      <span className="visually-hidden">{item.type}: </span>
      {lines.map((line, i) => (
        <div key={i} style={{ color: i === 0 ? '#d4d4d4' : '#b0b0b0',
          lineHeight: 1.55, wordBreak: 'break-word' }}>
          {line}
        </div>
      ))}
      {(item.fixed || item.canCopy) && (
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          {item.fixed && (
            <button type="button" onClick={() => onApply(item)} style={{
              background: '#1a5c2e', color: '#8fe3cd', border: 'none',
              borderRadius: 3, padding: '3px 10px', fontSize: 11.5,
              fontWeight: 600, cursor: 'pointer',
            }}>Apply</button>
          )}
          <button type="button" onClick={copy} style={{
            background: '#313131', color: '#e0e0e0', border: 'none',
            borderRadius: 3, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer',
          }}>{copied ? '✓ Copied' : 'Copy'}</button>
          {item.filePath && window.electronAPI && (
            <button type="button"
              onClick={() => window.electronAPI.showItemInFolder(item.filePath)}
              style={{ background: '#313131', color: '#e0e0e0', border: 'none',
                borderRadius: 3, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}>
              Show file
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ── Constants ─────────────────────────────────────────────────────

/**
 * Fallback document types, used only until GET /text/document-types answers.
 * The keys must match ai-server/config/documentTypes.js — the server rejects
 * anything else with a 400.
 */
const FALLBACK_DOC_TYPES = [
  { value: 'menu',         label: 'Menu / Speisekarte' },
  { value: 'businessCard', label: 'Business Card / Visitenkarte' },
  { value: 'flyer',        label: 'Flyer / Prospekt' },
  { value: 'poster',       label: 'Poster / Plakat' },
  { value: 'invoice',      label: 'Invoice / Rechnung' },
];

/** Must match LANGUAGE_NAMES in ai-server/routes/text.js. */
const LANGUAGES = [
  { value: 'de', label: 'German' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'vi', label: 'Vietnamese' },
];

/** Must match MODEL_OPTIONS in ai-server/config/modelProviders.js. */
const MODELS = [
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini (Fast & Cheap)' },
  { value: 'gpt-4o',       label: 'GPT-4o (Best Quality)' },
  { value: 'claude-haiku', label: 'Claude Haiku (Fast)' },
  { value: 'ollama',       label: 'Local / Ollama (Private)' },
];

/** DALL-E 3 image sizes accepted by POST /image/generate. */
const IMAGE_SIZES = [
  { value: '1024x1024', label: 'Square  1024 × 1024' },
  { value: '1024x1792', label: 'Portrait  1024 × 1792' },
  { value: '1792x1024', label: 'Landscape  1792 × 1024' },
];

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  // Server / CorelDraw status
  const [online,        setOnline]        = useState(false);
  const [corelOnline,   setCorelOnline]   = useState(false);
  const [wsConnected,   setWsConnected]   = useState(false);

  // Current CorelDraw session (live from WebSocket)
  const [session,       setSession]       = useState(null);
  const [applyPending,  setApplyPending]  = useState(false);

  // Tool state
  const [loading,      setLoading]      = useState(false);
  const [loadMsg,      setLoadMsg]      = useState('');
  const [docTypes,     setDocTypes]     = useState(FALLBACK_DOC_TYPES);
  const [docType,      setDocType]      = useState('menu');
  const [targetLang,   setTargetLang]   = useState('de');
  const [model,        setModel]        = useState('gpt-4o-mini');
  const [headerFont,   setHeaderFont]   = useState('');
  const [imagePrompt,  setImagePrompt]  = useState('');
  const [imageSize,    setImageSize]    = useState('1024x1024');
  const [paletteDesc,  setPaletteDesc]  = useState('');
  const [imagePath,    setImagePath]    = useState('');

  // Results
  const [results,      setResults]      = useState([]);
  const resultsEndRef = useRef(null);
  const nextResultId  = useRef(1);

  // ── Server health polling ───────────────────────────────────────
  const checkServer = useCallback(async () => {
    const data = await apiGet('/health');
    setOnline(data?.status === 'ok');
  }, []);

  // Self-scheduling rather than setInterval: a slow or hanging /health request
  // must not let a queue of overlapping polls build up.
  useEffect(() => {
    let cancelled = false;
    let timer;
    const poll = async () => {
      await checkServer();
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [checkServer]);

  // ── Document types come from the server ─────────────────────────
  // Hard-coding them here is how the dropdown silently drifted out of sync
  // with ai-server/config/documentTypes.js and started producing 400s.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      const data = await apiGet('/text/document-types');
      if (cancelled || !data?.ok || !Array.isArray(data.documentTypes)) return;
      const types = data.documentTypes.map(t => ({ value: t.key, label: t.label }));
      if (types.length === 0) return;
      setDocTypes(types);
      setDocType(prev => (types.some(t => t.value === prev) ? prev : types[0].value));
    })();
    return () => { cancelled = true; };
  }, [online]);

  // ── CorelDraw ping (via COM) ────────────────────────────────────
  const checkCorel = useCallback(async () => {
    if (!window.electronAPI?.corelPing) return;
    const res = await window.electronAPI.corelPing();
    setCorelOnline(res?.ok ?? false);
  }, []);

  // Same shape as the health poll: each COM ping spawns a PowerShell process,
  // so they must never overlap.
  useEffect(() => {
    let cancelled = false;
    let timer;
    const poll = async () => {
      await checkCorel();
      if (!cancelled) timer = setTimeout(poll, 10000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [checkCorel]);

  // ── WebSocket — live CorelDraw events ──────────────────────────
  useEffect(() => {
    let ws;
    let retryTimer;
    let closed = false;

    function connect() {
      ws = new WebSocket(SERVER_WS);

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = async (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.event === 'selection-changed') {
            // Fetch the full session payload
            const data = await apiGet(`/corel/selection/${event.sessionId}`);
            if (data?.ok && data.session) {
              setSession(data.session);
            }
          }

          if (event.event === 'result-applied') {
            setSession(prev => prev ? { ...prev, status: 'applied' } : prev);
            setApplyPending(false);
          }

          if (event.event === 'session-expired') {
            setSession(prev =>
              prev?.sessionId === event.sessionId ? null : prev
            );
          }
        } catch { /* a malformed frame is not worth surfacing */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  // Scroll to new results
  useEffect(() => {
    if (results.length > 0) {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results.length]);

  // ── Helpers ─────────────────────────────────────────────────────
  const addResult = useCallback((text, type = 'info', extra = {}) => {
    setResults(prev => [...prev, { id: nextResultId.current++, text, type, ...extra }]);
  }, []);

  const showOnly = useCallback((text, type) => {
    setResults([{ id: nextResultId.current++, text, type }]);
  }, []);

  const startLoad = (msg) => { setLoading(true); setLoadMsg(msg); setResults([]); };
  const endLoad   = ()    => { setLoading(false); setLoadMsg(''); checkServer(); };

  const requireSession = () => {
    if (!session?.payload?.shapes?.length) {
      showOnly('Select objects in CorelDraw and click "Send Selection → AI App" first.', 'warning');
      return false;
    }
    return true;
  };

  const requireField = (value, message) => {
    if (value.trim()) return true;
    showOnly(message, 'warning');
    return false;
  };

  /** Returns true when the response is usable; otherwise shows the reason. */
  const handled = (data) => {
    const error = apiErrorMessage(data);
    if (error) { addResult(error, 'error'); return false; }
    return true;
  };

  // Get plain text from the current session
  const sessionText = extractTextFromSession(session);

  // ── Tool handlers ────────────────────────────────────────────────

  const doGrammar = async () => {
    if (!requireSession()) return;
    startLoad('Checking grammar…');
    const data = await apiPost('/text/grammar', { text: sessionText, model });
    endLoad();
    if (!handled(data)) return;
    const issues = data.issues ?? [];
    if (issues.length === 0) {
      addResult('No grammar issues found.', 'suggestion');
      return;
    }
    issues.forEach(e => {
      const changed = e.original && e.suggestion && e.original !== e.suggestion;
      addResult(
        `"${e.original}" → "${e.suggestion}"${e.explanation ? '\n' + e.explanation : ''}`,
        'error',
        changed ? { fixed: e.suggestion, canCopy: true } : { canCopy: true }
      );
    });
  };

  const doPriceFormat = async () => {
    if (!requireSession()) return;
    startLoad('Checking price format…');
    const data = await apiPost('/text/price-format', { text: sessionText, model });
    endLoad();
    if (!handled(data)) return;
    const issues = data.issues ?? [];
    if (issues.length === 0) {
      addResult('Price formatting looks consistent.', 'suggestion');
      return;
    }
    issues.forEach(i => {
      addResult(
        `"${i.original}" → "${i.suggestion}"${i.explanation ? '\n' + i.explanation : ''}`,
        'warning', { fixed: i.suggestion, canCopy: true }
      );
    });
  };

  const doCompleteness = async () => {
    if (!requireSession()) return;
    startLoad('Checking completeness…');
    const data = await apiPost('/text/completeness', {
      text: sessionText, documentType: docType, model,
    });
    endLoad();
    if (!handled(data)) return;

    const missing = data.missingLabels ?? data.missing ?? [];
    addResult(completenessSummary(data), missing.length === 0 ? 'suggestion' : 'info');
    missing.forEach(f => addResult(`Missing: ${f}`, 'warning'));
    (data.optional_missing ?? []).forEach(f => addResult(`Optional, not found: ${f}`, 'info'));
    (data.notes ?? []).forEach(n => addResult(n, 'info'));
  };

  const doTranslate = async () => {
    if (!requireSession()) return;
    startLoad('Translating…');
    const data = await apiPost('/text/translate', {
      text: sessionText, targetLanguage: targetLang, model,
    });
    endLoad();
    if (!handled(data)) return;
    const translated = data.translatedText;
    if (translated) {
      addResult(translated, 'fix', { fixed: translated, canCopy: true });
    } else {
      addResult('The model returned an empty translation.', 'warning');
    }
  };

  const doGenerateImage = async () => {
    if (!requireField(imagePrompt, 'Enter an image prompt first.')) return;
    startLoad('Generating image (this may take ~30 s)…');
    const data = await apiPost('/image/generate', { prompt: imagePrompt, size: imageSize }, 130000);
    endLoad();
    if (!handled(data)) return;
    if (data.localPath) {
      addResult(`Image saved:\n${data.localPath}`, 'suggestion',
        { filePath: data.localPath, canCopy: true, fixed: data.localPath });
      if (data.revisedPrompt) addResult(`DALL-E rewrote the prompt as:\n${data.revisedPrompt}`, 'info');
    } else {
      addResult('The server did not return an image path.', 'warning');
    }
  };

  const doColorPalette = async () => {
    if (!requireField(paletteDesc, 'Enter a colour palette description first.')) return;
    startLoad('Generating colour palette…');
    const data = await apiPost('/image/color-palette-generate', {
      description: paletteDesc, model,
    });
    endLoad();
    if (!handled(data)) return;
    showColors(data.colors ?? []);
  };

  const doExtractColors = async () => {
    if (!requireField(imagePath, 'Enter the path to an image file first.')) return;
    startLoad('Extracting colours from image…');
    const data = await apiPost('/image/color-palette', { imagePath });
    endLoad();
    if (!handled(data)) return;
    showColors(data.colors ?? []);
  };

  /** Render a palette response — both colour endpoints share this shape. */
  const showColors = (colors) => {
    if (colors.length === 0) {
      addResult('No colours were returned.', 'warning');
      return;
    }
    colors.forEach(c => {
      const hex = typeof c === 'string' ? c : (c.hex ?? '');
      if (!hex) return;
      const name = typeof c === 'object' && c.name ? `  —  ${c.name}` : '';
      const role = typeof c === 'object' && c.role ? `  (${c.role})` : '';
      const cmyk = typeof c === 'object' && c.cmyk
        ? `\nCMYK ${c.cmyk.c}/${c.cmyk.m}/${c.cmyk.y}/${c.cmyk.k}`
        : '';
      addResult(`${hex}${name}${role}${cmyk}`, 'fix', { fixed: hex, canCopy: true });
    });
  };

  const doFontPairing = async () => {
    if (!requireField(headerFont, 'Enter a header font name first.')) return;
    startLoad('Finding font pairings…');
    const data = await apiPost('/text/font-pairing', {
      headerFont, documentType: docType, model,
    });
    endLoad();
    if (!handled(data)) return;
    const suggestions = data.suggestions ?? [];
    if (suggestions.length === 0) {
      addResult('No pairings were returned.', 'warning');
      return;
    }
    suggestions.forEach(s => {
      const gf    = s.googleFonts ? '  [Google Fonts]' : '';
      const style = s.style ? ` (${s.style})` : '';
      addResult(
        `${s.font}${style}${gf}${s.reason ? '\n' + s.reason : ''}`,
        'suggestion', { fixed: s.font, canCopy: true }
      );
    });
  };

  // ── Apply result in CorelDraw (via COM) ──────────────────────────
  const handleApplyInCorel = async () => {
    if (!session) return;
    setApplyPending(true);

    // The tools above only ever show suggestions, so "apply" means: trigger the
    // VBA ApplyResult macro and let CorelDraw pull the session's result.
    if (window.electronAPI?.corelApply) {
      const res = await window.electronAPI.corelApply();
      if (!res?.ok) {
        addResult(`Could not trigger CorelDraw: ${res?.error ?? 'Unknown error'}.\nMake sure CorelDraw is open and the VBA macros are loaded.`, 'error');
        setApplyPending(false);
      }
      // On success the WS 'result-applied' event clears applyPending.
    } else {
      addResult('Apply via COM is not available in browser mode. Use the "Apply from AI" button in CorelDraw.', 'info');
      setApplyPending(false);
    }
  };

  // Apply a text fix: copy to clipboard
  const applyFix = async (item) => {
    await writeClipboard(item.fixed || item.text);
    setResults(prev => prev.map(r =>
      r.id === item.id
        ? { ...r, text: r.text + '\n✓ Copied to clipboard — paste in CorelDraw' }
        : r
    ));
  };

  // ── Render ───────────────────────────────────────────────────────
  const statusText = loading
    ? loadMsg
    : online ? 'Server online' : 'Server offline';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Status bar ───────────────────────────────────── */}
      <header style={{
        background: '#1a1a1a', padding: '4px 8px', display: 'flex',
        alignItems: 'center', gap: 8, fontSize: 11, color: '#fff',
        flexShrink: 0, borderBottom: '1px solid #333',
      }}>
        {/* Server status */}
        <button type="button" onClick={checkServer}
          title="Check the AI server now"
          className="status-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: online ? '#4ec9b0' : '#f44747',
            boxShadow: online ? '0 0 4px #4ec9b0' : '0 0 4px #f44747',
            display: 'inline-block', flexShrink: 0,
          }} aria-hidden="true" />
          <span style={{ color: online ? '#4ec9b0' : '#f88' }}>
            {loading ? `⏳ ${loadMsg}` : online ? 'Server' : 'Server offline'}
          </span>
        </button>

        {/* CorelDraw status */}
        <button type="button" onClick={checkCorel}
          title="Check the CorelDraw connection now"
          className="status-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: corelOnline ? '#569cd6' : '#777',
            display: 'inline-block', flexShrink: 0,
          }} aria-hidden="true" />
          <span style={{ color: corelOnline ? '#569cd6' : '#a0a0a0' }}>
            {corelOnline ? 'CorelDraw' : 'CorelDraw offline'}
          </span>
        </button>

        {/* WS indicator.
            #777 on the #1a1a1a header is only 3.9:1 — below AA for text — so the
            disconnected state uses the same muted grey as the rest of the panel. */}
        <span style={{ marginLeft: 'auto', color: wsConnected ? '#a0a0a0' : '#9a9a9a', fontSize: 10 }}>
          <span aria-hidden="true">{wsConnected ? '◉ live' : '○ disconnected'}</span>
          <span className="visually-hidden">
            {wsConnected ? 'Live updates connected' : 'Live updates disconnected'}
          </span>
        </span>

        {/* One polite announcement channel for status changes */}
        <span role="status" aria-live="polite" className="visually-hidden">
          {statusText}
        </span>
      </header>

      {/* ── Scrollable content ───────────────────────────── */}
      {/* aria-busy tells assistive tech the tools are mid-request; the buttons
          are already disabled, but that alone reads as "unavailable". */}
      <main aria-busy={loading} style={{ flex: 1, overflowY: 'auto' }}>

        {/* SELECTION — live from CorelDraw */}
        <Section title="Selection" count={session?.payload?.shapes?.length ?? null}>
          <SelectionPanel
            session={session}
            onApplyInCorel={handleApplyInCorel}
            applyPending={applyPending}
          />
        </Section>

        {/* TEXT TOOLS */}
        <Section title="Text Tools">
          <Btn onClick={doGrammar}     disabled={loading}>Grammar Check</Btn>
          <Btn onClick={doPriceFormat} disabled={loading}>Price Format Check</Btn>
          <Field
            label="Document type"
            hint="Also used by the font pairing tool."
            render={(id, describedBy) => (
              <Select id={id} describedBy={describedBy} value={docType}
                onChange={setDocType} options={docTypes} />
            )}
          />
          <Btn onClick={doCompleteness} disabled={loading}>Completeness Check</Btn>
          <Field
            label="Translate to"
            render={(id) => (
              <Select id={id} value={targetLang} onChange={setTargetLang} options={LANGUAGES} />
            )}
          />
          <Btn onClick={doTranslate} disabled={loading}>Translate Selection</Btn>
        </Section>

        {/* IMAGE & COLOUR */}
        <Section title="Image &amp; Colour">
          <Field
            label="Image prompt"
            render={(id) => (
              <TextArea id={id} value={imagePrompt} onChange={setImagePrompt}
                placeholder="e.g. A professional product photo of fresh bread on a wooden board…"
                rows={2} />
            )}
          />
          <Field
            label="Image size"
            render={(id) => (
              <Select id={id} value={imageSize} onChange={setImageSize} options={IMAGE_SIZES} />
            )}
          />
          <Btn onClick={doGenerateImage} disabled={loading}>Generate Image  (DALL-E 3)</Btn>
          <Field
            label="Colour palette description"
            render={(id) => (
              <TextInput id={id} value={paletteDesc} onChange={setPaletteDesc}
                placeholder="e.g. Warm autumn tones, earthy and rustic" />
            )}
          />
          <Btn onClick={doColorPalette} disabled={loading}>Generate Colour Palette</Btn>
          <Field
            label="Image file path"
            hint="PNG, JPG, WEBP or GIF, up to 25 MB."
            render={(id, describedBy) => (
              <TextInput id={id} describedBy={describedBy} value={imagePath}
                onChange={setImagePath} placeholder="C:\path\to\image.jpg" />
            )}
          />
          <Btn onClick={doExtractColors} disabled={loading}>Extract Colours from Image</Btn>
        </Section>

        {/* FONT TOOLS */}
        <Section title="Font Tools">
          <Field
            label="Header / display font name"
            render={(id) => (
              <TextInput id={id} value={headerFont} onChange={setHeaderFont}
                placeholder="e.g. Playfair Display" />
            )}
          />
          <Btn onClick={doFontPairing} disabled={loading}>Find Pairings</Btn>
        </Section>

        {/* SETTINGS */}
        <Section title="Settings">
          <Field
            label="AI model"
            hint="Claude and Ollama need their keys or daemon configured in ai-server/.env."
            render={(id, describedBy) => (
              <Select id={id} describedBy={describedBy} value={model}
                onChange={setModel} options={MODELS} />
            )}
          />
        </Section>

        {/* RESULTS */}
        {results.length > 0 && (
          <Section title="Results" count={results.length}>
            <div style={{ marginBottom: 6 }}>
              <Btn onClick={() => setResults([])} variant="secondary">Clear Results</Btn>
            </div>
            <ul aria-live="polite" style={{ margin: 0, padding: 0 }}>
              {results.map(item => (
                <ResultItem key={item.id} item={item} onApply={applyFix} />
              ))}
            </ul>
            <div ref={resultsEndRef} />
          </Section>
        )}

        <div style={{ height: 16 }} />
      </main>
    </div>
  );
}
