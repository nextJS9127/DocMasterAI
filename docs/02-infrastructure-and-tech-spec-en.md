# DocMaster AI — Infrastructure and Tech Spec (English)

## 1. Technology Stack Overview

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Styling** | Tailwind CSS 4 |
| **Backend** | Python 3, FastAPI, Uvicorn |
| **Document parsing** | pymupdf4llm, pdfplumber (PDF), python-pptx (PPTX) |
| **LLM integration** | OpenAI, Anthropic, Google Generative AI (direct calls from browser) |

---

## 2. Frontend (docmaster-web)

### 2.1 Libraries and Purpose

| Package | Purpose |
|---------|---------|
| **react** / **react-dom** | UI components and rendering |
| **react-router-dom** | Routing (for future extension) |
| **lucide-react** | Icons (Settings, Upload, CheckCircle2, FileDown, etc.) |
| **openai** | OpenAI API client (report generation) |
| **@anthropic-ai/sdk** | Anthropic Claude API client |
| **@google/generative-ai** | Google Gemini API client |
| **axios** | HTTP client (settings, health check, etc.) |
| **clsx** / **tailwind-merge** | Conditional class name merging (styling utilities) |

### 2.2 Dev/Build Tools

| Package | Purpose |
|---------|---------|
| **vite** | Bundler and dev server |
| **@vitejs/plugin-react** | React Fast Refresh |
| **@tailwindcss/vite** / **tailwindcss** | Tailwind CSS 4 integration |
| **typescript** | Type checking and build |
| **eslint** / **typescript-eslint** | Linting and code quality |
| **vite-plugin-javascript-obfuscator** / **javascript-obfuscator** | Optional JS obfuscation for production build |

---

## 3. Backend (docmaster-backend)

### 3.1 Libraries and Purpose

| Package | Purpose |
|---------|---------|
| **fastapi** | REST API framework; `/parse`, `/health`, etc. |
| **uvicorn[standard]** | ASGI server (run: `uvicorn main:app --reload --port 8001`) |
| **python-multipart** | Multipart form handling (e.g. `UploadFile`) |
| **pymupdf4llm** | PDF → Markdown for LLM/RAG (body text) |
| **pdfplumber** | PDF table extraction → Markdown tables |
| **python-pptx** | PPTX slide text, tables, charts, SmartArt extraction |

### 3.2 Optional Dependencies (OCR)

- **pytesseract**, **Pillow**: OCR fallback when a PDF page has no text. Not in default `requirements.txt`; uncomment and install if needed.

---

## 4. Source Folder Structure

### 4.1 Repository Root

```
PlugIn/
├── docmaster-web/          # Frontend (React + Vite)
├── docmaster-backend/     # Backend (FastAPI)
├── docs/                   # Documentation (concept, infra, source analysis)
├── README.md
├── LICENSE
└── package.json            # Root/workspace package
```

### 4.2 docmaster-web (Frontend)

```
docmaster-web/
├── public/
│   ├── favicon.svg
│   └── templates/          # HTML templates (phase1.html, presentation2.html, etc.)
├── src/
│   ├── App.tsx             # Root component; 2-step flow state and handlers
│   ├── main.tsx
│   ├── index.css            # Global styles and Tailwind entry
│   ├── components/
│   │   ├── UploadZone.tsx          # File upload area
│   │   ├── ParsedResultPanel.tsx   # Panel after Step 1 (preview, Step 2, generate report)
│   │   ├── ReportViewer.tsx        # Generated HTML report viewer (popup/fullscreen)
│   │   ├── SettingsModal.tsx      # Settings modal (API key, LLM, prompt tabs)
│   │   └── OnboardingManualModal.tsx  # Help/onboarding modal
│   └── lib/
│       ├── translations.ts  # KO/EN UI strings
│       └── llmClient.ts      # LLM integration, prompts, templates, generateReportClient
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 4.3 docmaster-backend (Backend)

```
docmaster-backend/
├── app/
│   ├── pdf_utils.py        # PDF → Markdown (pymupdf4llm + pdfplumber, OCR fallback)
│   ├── pptx_utils.py       # PPTX → Markdown (slides, tables, charts, SmartArt)
│   ├── md_refine.py        # Extracted Markdown refinement (slide artifacts, footers, hr)
│   ├── normalizer.py       # Amount and date normalization
│   └── extract_constants.py # [[TABLE]]/[[DIAGRAM]] delimiters and wrap helpers
├── main.py                 # FastAPI app, /health, /parse, CORS
├── requirements.txt
└── outputs/                # (Optional) Extracted .md when save mode is used (default: not used)
```

---

## 5. Main Endpoints and Configuration

### 5.1 Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| POST | `/parse` | Upload PDF/PPTX → return extracted Markdown (file deleted immediately; result only in response) |
| GET | `/result/{file_id}` | (Legacy) Return stored result text |
| GET | `/result/{file_id}/download` | (Legacy) Download stored .md |
| GET | `/results` | (Legacy) List stored results |

In the current service flow, only `/parse` is used; extraction result is received only in the response body.

### 5.2 Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REFINE_MD` | `true` | Whether to apply extracted Markdown refinement |
| `NORMALIZE_MD` | `true` | Whether to apply amount/date normalization |

### 5.3 Frontend Configuration

- **API key, LLM choice, prompts**: `localStorage` keys such as `docmaster_llmKey`, `docmaster_llmProvider`, `docmaster_promptExecutiveEditable`, `docmaster_promptTeamEditable`.
- **Language**: `docmaster_lang` (`ko` | `en`).
- **Backend URL**: `http://localhost:8001` (hardcoded; can be moved to env if needed).

---

## 6. How to Run

### Backend

```bash
cd docmaster-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Frontend

```bash
cd docmaster-web
npm install
npm run dev
```

Open `http://localhost:5173`, enter API key in Settings → upload file → generate report.
