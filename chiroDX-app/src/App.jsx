import { useState, useEffect, useCallback, useRef } from 'react';

const SERVER    = 'http://localhost:3000';
const SERVER_WS = 'ws://localhost:3000/corel/events';

// ── API helpers ───────────────────────────────────────────────────
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
  try { await navigator.clipboard.writeText(text); } catch {}
}

// ── Small design-system components ───────────────────────────────

function SectionHeader({ title, count }) {
  return (
    <div style={{
      background: '#37373d', padding: '5px 12px', fontSize: 11,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: '#bbbbbb', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', flexShrink: 0,
    }}>
      <span>{title}</span>
      {count != null && (
        <span style={{
          background: '#007acc', color: '#fff', borderRadius: 10,
          padding: '1px 7px', fontSize: 10, fontWeight: 700,
        }}>{count}</span>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: 1 }}>
      <SectionHeader title={title} count={count} />
      <div style={{ padding: '10px 10px 6px', background: '#1e1e1e' }}>
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, color: '#969696', marginBottom: 4, marginTop: 6 }}>
      {children}
    </div>
  );
}

function Row({ children, gap = 6 }) {
  return (
    <div style={{ display: 'flex', gap, marginBottom: 6, alignItems: 'stretch' }}>
      {children}
    </div>
  );
}

function Btn({ onClick, disabled, children, variant = 'primary', flex = false, title }) {
  const [hover, setHover] = useState(false);
  const themes = {
    primary:   { bg: '#0e639c', hov: '#1177bb', text: '#fff' },
    secondary: { bg: '#313131', hov: '#3e3e3e', text: '#ccc' },
    danger:    { bg: '#6b1c1c', hov: '#7f2020', text: '#f88' },
    success:   { bg: '#1a5c2e', hov: '#1e6e36', text: '#4ec9b0' },
  };
  const t = themes[variant] || themes.primary;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 10px',
        background: disabled ? '#2a2a2a' : (hover ? t.hov : t.bg),
        color: disabled ? '#555' : t.text,
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

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ marginBottom: 4 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} style={{ marginBottom: 6 }} />
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={{ marginBottom: 6 }} />
  );
}

// ── ShapeCard — displays one shape from the CorelDraw selection ───

function ShapeCard({ shape }) {
  const [expanded, setExpanded] = useState(false);

  // Build a text preview from all runs
  const preview = shape.paragraphs
    ?.flatMap(p => p.runs?.map(r => r.text) ?? [])
    .join('') ?? '';

  const truncated = preview.length > 60 ? preview.slice(0, 60) + '…' : preview;

  const typeIcon = shape.shapeType === 'Group' ? '📦'
    : shape.shapeType === 'ArtisticText' ? '✏️'
    : '📝';

  return (
    <div style={{
      background: '#252526', border: '1px solid #3e3e3e', borderRadius: 3,
      marginBottom: 5, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div onClick={() => setExpanded(e => !e)} style={{
        padding: '6px 9px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 7,
      }}>
        <span style={{ fontSize: 13 }}>{typeIcon}</span>
        <span style={{ fontSize: 11.5, color: '#cccccc', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {truncated || <em style={{ color: '#666' }}>(no text)</em>}
        </span>
        <span style={{ fontSize: 10, color: '#666', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded: show paragraph + run detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #3e3e3e', padding: '6px 9px' }}>
          {shape.paragraphs?.map((para, pi) => (
            <div key={pi} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#666' }}>
                ¶ {para.alignment}
              </span>
              {para.runs?.map((run, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'center',
                  marginTop: 2, paddingLeft: 8 }}>
                  {/* Color swatch */}
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: `rgb(${run.colorRGB?.join(',') ?? '204,204,204'})`,
                    border: '1px solid #555',
                  }} />
                  <span style={{ fontSize: 11, color: '#cccccc', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{run.text}"
                  </span>
                  <span style={{ fontSize: 10, color: '#666', flexShrink: 0,
                    whiteSpace: 'nowrap' }}>
                    {run.font} {run.sizePt}pt
                    {run.bold ? ' B' : ''}
                    {run.italic ? ' I' : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
            {shape.shapeType} · {shape.layer} ·
            {shape.bounds ? ` ${Math.round(shape.bounds.w)}×${Math.round(shape.bounds.h)} ${shape.bounds.unit}` : ''}
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
      <div style={{ padding: '12px 10px', color: '#666', fontSize: 12, fontStyle: 'italic' }}>
        Select objects in CorelDraw, then click<br />
        "Send Selection → AI App" in the VBA panel.
      </div>
    );
  }

  return (
    <div>
      {/* Session meta */}
      <div style={{ fontSize: 10, color: '#666', marginBottom: 8, display: 'flex',
        justifyContent: 'space-between' }}>
        <span>{session.documentName || 'Untitled'} · p{session.pageNumber}</span>
        <span style={{
          background: session.status === 'ready' ? '#1a5c2e'
            : session.status === 'applied' ? '#313131' : '#37373d',
          color: session.status === 'ready' ? '#4ec9b0'
            : session.status === 'applied' ? '#666' : '#999',
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
    <div style={{
      background: '#252526', border: '1px solid #3e3e3e',
      borderLeft: `3px solid ${TYPE_COLOR[item.type] || '#555'}`,
      borderRadius: 3, padding: '7px 9px', marginBottom: 5, fontSize: 12,
    }} className="selectable">
      {lines.map((line, i) => (
        <div key={i} style={{ color: i === 0 ? '#cccccc' : '#969696',
          lineHeight: 1.55, wordBreak: 'break-word' }}>
          {line}
        </div>
      ))}
      {(item.fixed || item.canCopy) && (
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          {item.fixed && (
            <button onClick={() => onApply(item)} style={{
              background: '#1a5c2e', color: '#4ec9b0', border: 'none',
              borderRadius: 3, padding: '3px 10px', fontSize: 11.5,
              fontWeight: 600, cursor: 'pointer',
            }}>Apply</button>
          )}
          <button onClick={copy} style={{
            background: '#313131', color: '#ccc', border: 'none',
            borderRadius: 3, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer',
          }}>{copied ? '✓ Copied' : 'Copy'}</button>
          {item.filePath && window.electronAPI && (
            <button onClick={() => window.electronAPI.showItemInFolder(item.filePath)}
              style={{ background: '#313131', color: '#ccc', border: 'none',
                borderRadius: 3, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}>
              Show file
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'menu',          label: 'Menu' },
  { value: 'flyer',         label: 'Flyer' },
  { value: 'brochure',      label: 'Brochure' },
  { value: 'poster',        label: 'Poster' },
  { value: 'business_card', label: 'Business Card' },
  { value: 'invoice',       label: 'Invoice' },
  { value: 'newsletter',    label: 'Newsletter' },
  { value: 'label',         label: 'Product Label' },
  { value: 'banner',        label: 'Banner / Sign' },
  { value: 'other',         label: 'Other' },
];

const LANGUAGES = [
  { value: 'de', label: 'German' }, { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' }, { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' }, { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' }, { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' }, { value: 'tr', label: 'Turkish' },
  { value: 'ar', label: 'Arabic' }, { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
];

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini  (Fast & Cheap)' },
  { value: 'gpt-4o',      label: 'GPT-4o  (Powerful)' },
];

// ── Helpers ───────────────────────────────────────────────────────

/** Extract plain text string from a session's shapes array */
function extractTextFromSession(session) {
  if (!session?.payload?.shapes) return '';
  return session.payload.shapes
    .flatMap(s => s.paragraphs ?? [])
    .flatMap(p => p.runs ?? [])
    .map(r => r.text)
    .join(' ');
}

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
  const [docType,      setDocType]      = useState('menu');
  const [targetLang,   setTargetLang]   = useState('de');
  const [model,        setModel]        = useState('gpt-4o-mini');
  const [headerFont,   setHeaderFont]   = useState('');
  const [imagePrompt,  setImagePrompt]  = useState('');
  const [paletteDesc,  setPaletteDesc]  = useState('');
  const [imagePath,    setImagePath]    = useState('');

  // Results
  const [results,      setResults]      = useState([]);
  const resultsEndRef = useRef(null);
  const wsRef         = useRef(null);

  // ── Server health polling ───────────────────────────────────────
  const checkServer = useCallback(async () => {
    const data = await apiGet('/health');
    setOnline(data?.status === 'ok');
  }, []);

  useEffect(() => {
    checkServer();
    const id = setInterval(checkServer, 5000);
    return () => clearInterval(id);
  }, [checkServer]);

  // ── CorelDraw ping (via COM) ────────────────────────────────────
  const checkCorel = useCallback(async () => {
    if (!window.electronAPI?.corelPing) return;
    const res = await window.electronAPI.corelPing();
    setCorelOnline(res?.ok ?? false);
  }, []);

  useEffect(() => {
    checkCorel();
    const id = setInterval(checkCorel, 10000);
    return () => clearInterval(id);
  }, [checkCorel]);

  // ── WebSocket — live CorelDraw events ──────────────────────────
  useEffect(() => {
    let ws;
    let retryTimer;

    function connect() {
      ws = new WebSocket(SERVER_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('[WS] Connected to ai-server');
      };

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
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Reconnect after 3 seconds
        retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
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
    setResults(prev => [...prev, { id: Math.random(), text, type, ...extra }]);
  }, []);

  const startLoad = (msg) => { setLoading(true); setLoadMsg(msg); setResults([]); };
  const endLoad   = ()    => { setLoading(false); setLoadMsg(''); checkServer(); };

  const requireSession = () => {
    if (!session?.payload?.shapes?.length) {
      setResults([{ id: 1, text: 'Select objects in CorelDraw and click "Send Selection → AI App" first.', type: 'warning' }]);
      return false;
    }
    return true;
  };

  const noServer = () => {
    addResult('Cannot reach the server. It may still be starting up — wait a moment and try again.', 'error');
    endLoad();
  };

  // Get plain text from the current session
  const sessionText = session ? extractTextFromSession(session) : '';

  // ── Tool handlers ────────────────────────────────────────────────

  const doGrammar = async () => {
    if (!requireSession()) return;
    startLoad('Checking grammar…');
    const data = await apiPost('/text/grammar', { text: sessionText, model });
    endLoad();
    if (!data) { noServer(); return; }
    const errors = data.errors || data.issues || [];
    if (errors.length === 0) {
      addResult(data.message || 'No grammar issues found!', 'suggestion');
    } else {
      errors.forEach(e => {
        const hasOrig = e.original && e.suggestion && e.original !== e.suggestion;
        addResult(
          `"${e.original}" → "${e.suggestion}"${e.explanation ? '\n' + e.explanation : ''}`,
          'error',
          hasOrig ? { fixed: e.suggestion, canCopy: true } : { canCopy: true }
        );
      });
    }
  };

  const doPriceFormat = async () => {
    if (!requireSession()) return;
    startLoad('Checking price format…');
    const data = await apiPost('/text/price-format', { text: sessionText, model });
    endLoad();
    if (!data) { noServer(); return; }
    const issues = data.issues || data.errors || [];
    if (issues.length === 0) {
      addResult(data.message || 'Price formatting looks good!', 'suggestion');
    } else {
      issues.forEach(i => {
        addResult(
          `"${i.original}" → "${i.suggestion}"${i.explanation ? '\n' + i.explanation : ''}`,
          'warning', { fixed: i.suggestion, canCopy: true }
        );
      });
    }
  };

  const doCompleteness = async () => {
    if (!requireSession()) return;
    startLoad('Checking completeness…');
    const data = await apiPost('/text/completeness', {
      text: sessionText, documentType: docType, model,
    });
    endLoad();
    if (!data) { noServer(); return; }
    if (data.complete) addResult(data.message || 'Document appears complete!', 'suggestion');
    (data.missingFields || data.missing || []).forEach(f => {
      addResult(`Missing: ${typeof f === 'string' ? f : (f.field || JSON.stringify(f))}`, 'warning');
    });
    (data.suggestions || []).forEach(s => addResult(s, 'info'));
    if (!data.complete && !data.missingFields?.length && !data.missing?.length) {
      addResult(JSON.stringify(data, null, 2), 'info');
    }
  };

  const doTranslate = async () => {
    if (!requireSession()) return;
    startLoad('Translating…');
    const data = await apiPost('/text/translate', {
      text: sessionText, targetLanguage: targetLang, model,
    });
    endLoad();
    if (!data) { noServer(); return; }
    const translated = data.translation || data.translatedText || data.result;
    if (translated) {
      addResult(translated, 'fix', { fixed: translated, canCopy: true });
    } else {
      addResult(JSON.stringify(data), 'info');
    }
  };

  const doGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setResults([{ id: 1, text: 'Enter an image prompt first.', type: 'warning' }]);
      return;
    }
    startLoad('Generating image (this may take ~30 s)…');
    const data = await apiPost('/image/generate', { prompt: imagePrompt }, 90000);
    endLoad();
    if (!data) { noServer(); return; }
    const p = data.imagePath || data.path || data.filePath || data.localPath || data.url;
    if (p) {
      addResult(`Image saved:\n${p}`, 'suggestion', { filePath: p, canCopy: true, fixed: p });
    } else {
      addResult(JSON.stringify(data), 'info');
    }
  };

  const doColorPalette = async () => {
    if (!paletteDesc.trim()) {
      setResults([{ id: 1, text: 'Enter a color palette description first.', type: 'warning' }]);
      return;
    }
    startLoad('Generating color palette…');
    const data = await apiPost('/image/color-palette-generate', {
      description: paletteDesc, model,
    });
    endLoad();
    if (!data) { noServer(); return; }
    const colors = data.colors || data.palette || [];
    if (colors.length > 0) {
      colors.forEach(c => {
        const hex  = typeof c === 'string' ? c : (c.hex || c.color || '#???');
        const name = typeof c === 'object'  ? (c.name || '') : '';
        addResult(`${hex}${name ? '  —  ' + name : ''}`, 'fix', { fixed: hex, canCopy: true });
      });
    } else {
      addResult(JSON.stringify(data), 'info');
    }
  };

  const doExtractColors = async () => {
    if (!imagePath.trim()) {
      setResults([{ id: 1, text: 'Enter the path to an image file first.', type: 'warning' }]);
      return;
    }
    startLoad('Extracting colors from image…');
    const data = await apiPost('/image/color-palette', { imagePath });
    endLoad();
    if (!data) { noServer(); return; }
    const colors = data.colors || data.palette || [];
    if (colors.length > 0) {
      colors.forEach(c => {
        const hex = typeof c === 'string' ? c : (c.hex || JSON.stringify(c));
        addResult(hex, 'fix', { fixed: hex, canCopy: true });
      });
    } else {
      addResult(JSON.stringify(data), 'info');
    }
  };

  const doFontPairing = async () => {
    if (!headerFont.trim()) {
      setResults([{ id: 1, text: 'Enter a header font name first.', type: 'warning' }]);
      return;
    }
    startLoad('Finding font pairings…');
    const data = await apiPost('/text/font-pairing', {
      headerFont, documentType: docType, model,
    });
    endLoad();
    if (!data) { noServer(); return; }
    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) {
      addResult(JSON.stringify(data), 'info');
    } else {
      suggestions.forEach(s => {
        const gf    = s.googleFonts ? '  [Google Fonts]' : '';
        const style = s.style ? ` (${s.style})` : '';
        addResult(
          `${s.font}${style}${gf}${s.reason ? '\n' + s.reason : ''}`,
          'suggestion', { fixed: s.font, canCopy: true }
        );
      });
    }
  };

  // ── Apply result in CorelDraw (via COM) ──────────────────────────
  const handleApplyInCorel = async () => {
    if (!session) return;
    setApplyPending(true);

    // Post the current results as the "result" for this session
    // (in this flow the result IS the original payload — tools just showed suggestions)
    // The user applies fixes manually in CorelDraw.
    // So we just trigger the VBA ApplyResult macro.
    if (window.electronAPI?.corelApply) {
      const res = await window.electronAPI.corelApply();
      if (!res?.ok) {
        addResult(`Could not trigger CorelDraw: ${res?.error ?? 'Unknown error'}.\nMake sure CorelDraw is open and the VBA macros are loaded.`, 'error');
        setApplyPending(false);
      }
      // If ok, the WS event 'result-applied' will clear applyPending
    } else {
      // Fallback: no Electron API (dev browser mode)
      addResult('Apply via COM not available in browser mode. Use the "Apply from AI" button in CorelDraw.', 'info');
      setApplyPending(false);
    }
  };

  // Apply a text fix: copy to clipboard
  const applyFix = async (item) => {
    const text = item.fixed || item.text;
    await writeClipboard(text);
    setResults(prev => prev.map(r =>
      r.id === item.id
        ? { ...r, text: r.text + '\n✓ Copied to clipboard — paste in CorelDraw' }
        : r
    ));
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Status bar ───────────────────────────────────── */}
      <div style={{
        background: '#1a1a1a', padding: '4px 12px', display: 'flex',
        alignItems: 'center', gap: 12, fontSize: 11, color: '#fff',
        flexShrink: 0, borderBottom: '1px solid #333',
      }}>
        {/* Server status */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={checkServer} title="Click to check server" style={{ cursor: 'pointer' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: online ? '#4ec9b0' : '#f44747',
            boxShadow: online ? '0 0 4px #4ec9b0' : '0 0 4px #f44747',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: online ? '#4ec9b0' : '#f44747' }}>
            {loading ? `⏳ ${loadMsg}` : online ? 'Server' : 'Server offline'}
          </span>
        </span>

        {/* CorelDraw status */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={checkCorel} title="Click to check CorelDraw connection" style={{ cursor: 'pointer' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: corelOnline ? '#569cd6' : '#555',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: corelOnline ? '#569cd6' : '#666' }}>
            {corelOnline ? 'CorelDraw' : 'CorelDraw offline'}
          </span>
        </span>

        {/* WS indicator */}
        <span style={{ marginLeft: 'auto', color: wsConnected ? '#666' : '#444', fontSize: 10 }}>
          {wsConnected ? '◉ live' : '○ disconnected'}
        </span>
      </div>

      {/* ── Scrollable content ───────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

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
          <Label>Document type</Label>
          <Select value={docType} onChange={setDocType} options={DOC_TYPES} />
          <Btn onClick={doCompleteness} disabled={loading}>Completeness Check</Btn>
          <Label>Translate to</Label>
          <Select value={targetLang} onChange={setTargetLang} options={LANGUAGES} />
          <Btn onClick={doTranslate} disabled={loading}>Translate Selection</Btn>
        </Section>

        {/* IMAGE & COLOR */}
        <Section title="Image & Color">
          <Label>Image prompt</Label>
          <TextArea value={imagePrompt} onChange={setImagePrompt}
            placeholder="e.g. A professional product photo of fresh bread on a wooden board…"
            rows={2} />
          <Btn onClick={doGenerateImage} disabled={loading}>Generate Image  (DALL-E 3)</Btn>
          <Label>Color palette description</Label>
          <TextInput value={paletteDesc} onChange={setPaletteDesc}
            placeholder="e.g. Warm autumn tones, earthy and rustic" />
          <Btn onClick={doColorPalette} disabled={loading}>Generate Color Palette</Btn>
          <Label>Image file path  (for color extraction)</Label>
          <TextInput value={imagePath} onChange={setImagePath}
            placeholder="C:\path\to\image.jpg" />
          <Btn onClick={doExtractColors} disabled={loading}>Extract Colors from Image</Btn>
        </Section>

        {/* FONT TOOLS */}
        <Section title="Font Tools">
          <Label>Header / display font name</Label>
          <TextInput value={headerFont} onChange={setHeaderFont}
            placeholder="e.g. Playfair Display" />
          <Btn onClick={doFontPairing} disabled={loading}>Find Pairings</Btn>
        </Section>

        {/* SETTINGS */}
        <Section title="Settings">
          <Label>AI Model</Label>
          <Select value={model} onChange={setModel} options={MODELS} />
        </Section>

        {/* RESULTS */}
        {results.length > 0 && (
          <Section title="Results" count={results.length}>
            <div style={{ marginBottom: 6 }}>
              <Btn onClick={() => setResults([])} variant="secondary">Clear Results</Btn>
            </div>
            {results.map(item => (
              <ResultItem key={item.id} item={item} onApply={applyFix} />
            ))}
            <div ref={resultsEndRef} />
          </Section>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
