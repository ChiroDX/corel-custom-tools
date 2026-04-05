# corel-custom-tools

A unified CorelDraw 2024 plugin workspace combining VBA macros, JS scripts, CorelDraw templates, and an AI integration server.

## Project Structure

```
corel-custom-tools/
├── Makros/                  # CorelDraw macros & VBA project
│   ├── CustomMacroStorage.gms   # Main VBA macro storage (open in CorelDraw)
│   ├── ResponseModal.frm        # VBA UserForm - displays AI/API responses
│   ├── ResponseModal.frx        # UserForm binary resources
│   └── Watermark.js             # JS macro: adds watermark layer to active page
│
├── Templates/               # CorelDraw templates (.cdrt)
│   ├── Icon/
│   ├── Layouts/
│   └── Template/
│
└── ai-server/               # Local AI integration server (Node.js)
    ├── server.js            # Express server wrapping OpenAI API
    ├── package.json
    ├── .env.example         # Copy to .env and add your API key
    └── pnpm-lock.yaml
```

## Getting Started

### VBA Macros (CorelDraw 2024)

1. Open CorelDraw 2024
2. Go to **Tools → Macros → Macro Manager**
3. Load `Makros/CustomMacroStorage.gms`
4. Run macros from the Macro Manager or assign them to keyboard shortcuts

### JavaScript Macros

JS macros like `Watermark.js` can be run via:
- **Tools → Macros → Run Macro** → select the `.js` file

### AI Server (ChatGPT Integration)

The `ai-server/` directory contains a local Express server that connects CorelDraw macros to OpenAI's API.

**Setup:**

```bash
cd ai-server
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

npm install   # or: pnpm install
npm start
```

The server runs on `http://localhost:3000`.

**Available Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/correct-text` | Corrects and formats German menu text using GPT-4o |

**Calling from a VBA Macro (example):**

```vba
Dim http As Object
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "POST", "http://localhost:3000/correct-text", False
http.setRequestHeader "Content-Type", "application/json"
http.Send "{""text"": """ & myText & """}"
Dim result As String
result = http.responseText
```

## Roadmap

- [ ] Add a dockable ChatGPT panel inside CorelDraw (UserForm-based)
- [ ] Extend AI server with more endpoints (layout suggestions, color palette generation)
- [ ] Connect VBA macros to AI server for in-canvas text correction
- [ ] Add more JS macros (batch export, layer utilities)

## Requirements

- CorelDraw 2024
- Node.js 18+ (for the AI server)
- An OpenAI API key (for AI features)
