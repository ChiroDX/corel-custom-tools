# corel-custom-tools

AI tooling for CorelDRAW 2024, aimed at print work — menus, flyers, business
cards. Three pieces work together:

- **`Makros/`** — VBA macros that run inside CorelDRAW. They read the current
  selection, send it to the server, and write results back into the document.
- **`ai-server/`** — a local Node.js service. It talks to OpenAI / Anthropic /
  Ollama and brokers a session between CorelDRAW and the panel.
- **`chiroDX-app/`** — an Electron + React panel that floats over CorelDRAW and
  is where the designer actually clicks things.

Everything runs on the designer's own machine. The server binds to `127.0.0.1`
and there is no authentication, so it must not be exposed to a network.

## How a round trip works

```
CorelDRAW (VBA)                ai-server                   Electron panel
──────────────────────────────────────────────────────────────────────────
Send Selection ──POST /corel/push──▶ store session
                                     └─ WS selection-changed ──▶ fetch
                                                                 /corel/selection/:id
                                                                     │
                                                        designer runs a tool
                                                                     │
                                     ◀── POST /corel/result ─────────┘
                     ◀── WS result-ready
Apply from AI ──GET /corel/result/:id──▶ returns modified shapes
apply into document
  ──POST /corel/result/:id/applied──▶  └─ WS result-applied ──▶ panel updates
```

The panel can also press "Apply in CorelDraw" itself: Electron shells out to
`scripts/run-macro.ps1`, which uses the CorelDRAW COM automation interface to
invoke the VBA `ApplyResult` sub. The same mechanism powers the CorelDRAW
status dot, via a no-op `Ping` sub.

Sessions live in memory only — they expire after 30 minutes, and at most 200 are
kept. Nothing is written to disk except generated images, which go to the OS
temp folder as `chiroDX_*` and are swept on server start.

## Repository layout

```
corel-custom-tools/
├── Makros/                        CorelDRAW VBA + JS macros
│   ├── ApiClient.bas              HTTP client, AutoExec, Ping, ShowToolsPanel
│   ├── ToolsPanel.frm             in-CorelDRAW UserForm
│   ├── ResponseModal.frm/.frx     response dialog
│   ├── ChiroDXTools.hta           fallback panel if the Electron app won't run
│   ├── CustomMacroStorage.gms     binary VBA project (not diffable)
│   ├── Watermark.js               standalone JS macro
│   └── modules/
│       ├── ShapeSerializer.bas    selection  → ShapeExchange JSON
│       └── ShapeDeserializer.bas  ShapeResult → back into the document
│
├── ai-server/                     Express 5, ESM, Node >= 20.6
│   ├── server.js                  app wiring, /health, WebSocket, error handler
│   ├── corel-state.js             in-memory session store + WS broadcast
│   ├── routes/{text,image,corel}.js
│   ├── config/{documentTypes,modelProviders}.js
│   ├── utils/{validate,tempFiles}.js
│   └── test/                      node:test suites
│
├── chiroDX-app/                   Electron 43 + React 19 + Vite 8
│   ├── main.js                    main process, IPC guards, spawns ai-server
│   ├── preload.js                 contextBridge surface (the only bridge)
│   ├── corel-bridge.mjs           COM bridge wrapper
│   ├── scripts/run-macro.ps1      GMSManager.RunMacro via COM
│   └── src/                       React panel
│
├── specs/                         TypeScript specs (reference, not compiled)
│   ├── shape-format.ts            the CorelDRAW ↔ server ↔ panel contract
│   └── menu-data-model.ts         menu/allergen/price data model
│
├── Templates/                     CorelDRAW .cdrt templates (binary)
├── setup.bat / uninstall.bat      per-PC install and removal
└── ARCHITECTURE.html / DESIGN.html / FEATURES.html
```

## Setup

### For a designer's PC (the normal path)

Install [Node.js](https://nodejs.org) (20.6 or newer), then double-click
**`setup.bat`**. It installs dependencies, registers a Task Scheduler job that
starts the server hidden on login, copies the fallback HTA panel, and starts the
server immediately. No admin rights required.

Then, once per PC, import the VBA modules in CorelDRAW: `Alt+F11` → right-click
the project → **Import File** → import `ApiClient.bas`,
`modules/ShapeSerializer.bas` and `modules/ShapeDeserializer.bas`. All three are
needed — `SendSelection` uses the serializer and `ApplyResult` uses the
deserializer.

Add your API key: copy `ai-server/.env.example` to `ai-server/.env` and fill in
`OPENAI_API_KEY`. `.env` is gitignored and must stay that way.

`uninstall.bat` reverses the scheduled task and config.

### For development

```bash
cd ai-server
npm ci
npm run lint
npm test
npm start          # http://127.0.0.1:3000

cd ../chiroDX-app
npm ci
npm run lint
npm test
npm run build      # Vite production build
npm run dev        # Vite dev server + Electron, hot reload
npm run dist       # electron-builder NSIS installer (Windows)
```

Both packages standardise on **npm**; `pnpm-lock.yaml` and `yarn.lock` are
gitignored so a second lockfile cannot drift in.

## Server API

`GET /health` reports the version, which providers have keys configured, the
connected WebSocket client count, and the full endpoint list.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET  | `/health` | liveness + capability report |
| GET  | `/text/document-types` | document types and their required fields |
| POST | `/text/grammar` | grammar and spelling issues |
| POST | `/text/completeness` | required fields present for a document type |
| POST | `/text/translate` | translate to a target language |
| POST | `/text/price-format` | flag inconsistent price formatting |
| POST | `/text/font-pairing` | body fonts that pair with a header font |
| POST | `/image/generate` | DALL-E 3 image, saved to a temp path |
| POST | `/image/color-palette` | extract a palette from an image file |
| POST | `/image/color-palette-generate` | palette from a text description |
| POST | `/corel/push` | VBA pushes the serialized selection |
| GET  | `/corel/selection` | latest session summary |
| GET  | `/corel/selection/:sessionId` | one session with its full payload |
| GET  | `/corel/sessions` | list active sessions |
| POST | `/corel/result` | panel posts the processed result |
| GET  | `/corel/result/:sessionId` | VBA polls for a ready result |
| POST | `/corel/result/:sessionId/applied` | VBA confirms it applied |
| POST | `/corel/session/:sessionId/cancel` | dismiss a session |
| WS   | `/corel/events` | live session events |

Every response carries `ok`; failures add `error` with a message safe to show a
designer. Provider internals and stack traces stay on the server console.

The exact request and response shapes are in
[`specs/shape-format.ts`](specs/shape-format.ts).

## Models

One setting in the panel picks the model for all text tools:

| Key | Provider | Notes |
|-----|----------|-------|
| `gpt-4o-mini` | OpenAI | default — fast and cheap |
| `gpt-4o` | OpenAI | best quality |
| `claude-haiku` | Anthropic | resolves to the current `claude-haiku-4-5` |
| `ollama` | local | needs Ollama running; nothing leaves the machine |

Image generation always uses DALL-E 3 regardless of the setting. Every upstream
call is bounded at 60 s and retries twice on 429/5xx.

## Security notes

- The server listens on `127.0.0.1` unless `HOST` is set explicitly. Several
  endpoints read local files, and there is no auth.
- The Electron window runs with `contextIsolation: true`, `nodeIntegration:
  false` and `sandbox: true`. `preload.js` exposes a fixed set of named IPC
  wrappers via `contextBridge` — the renderer cannot pick a channel.
- Every IPC argument is validated in the main process: clipboard writes are
  length-capped, `shell.openExternal` accepts `http:`/`https:` only, and
  "reveal in Explorer" is restricted to `chiroDX_*` files inside the OS temp
  folder. Macro and GMS project names must match a strict identifier pattern.
- Window navigation and `window.open` are both denied; the renderer ships a CSP.
- API keys live only in `ai-server/.env`, which is gitignored and excluded from
  the packaged build.

## Requirements

- CorelDRAW 2024 (Windows)
- Node.js 20.6+
- An OpenAI API key; optionally an Anthropic key, or Ollama for local models
