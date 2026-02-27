# DocMaster AI

**Turn PDF and PPTX into executive-ready reports** — local parsing, no document cloud. Use your own LLM (OpenAI, Claude, Gemini) to generate one-pagers and team docs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** [https://doc-master-ai.vercel.app/](https://doc-master-ai.vercel.app/) *(Frontend only; parsing backend must run locally or be deployed separately.)*

---

## Features

- **Local-first parsing** — PDF/PPTX are processed on your machine (Python backend). No upload to third-party document APIs.
- **Rich extraction** — Tables, slide structure, and text from PDF (pymupdf4llm, pdfplumber) and PPTX (python-pptx). Optional OCR fallback for image-only pages.
- **LLM of your choice** — Connect OpenAI (GPT-4o, GPT-5.x), Anthropic (Claude), or Google (Gemini). API keys stay in your browser; only extracted text is sent to the provider you select.
- **Two report modes** — **Executive** (1-pager, risks & decisions) and **Team** (detailed, actionable). Editable prompts and multiple HTML templates (Tailwind, wiki-style, presentation, etc.).
- **Bilingual UI** — Korean and English. Default prompts follow the selected language.

---

## Quick Start

### 1. Backend (Python)

```bash
cd docmaster-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2. Frontend (Vite + React)

```bash
cd docmaster-web
npm install
npm run dev
```

Open **http://localhost:5173**. In **Settings**, add your LLM API key and choose a model, then upload a PDF or PPTX to extract and generate reports.

---

## Deploy on Vercel (Frontend)

The frontend is connected to Vercel for deployment from this repo.

- **Vercel project ID**: `prj_pZefxlz7A8lYCHbv6xq9FOCZtZ9j`
- **Root Directory**: Set to `docmaster-web` in the Vercel project settings (if the repo root is used, set **Root Directory** to `docmaster-web` so the app builds correctly).
- **Backend**: The Python parsing backend (`docmaster-backend`) does not run on Vercel. Deploy it separately (e.g. Railway, Render, or run locally) and set the frontend’s API base URL to that backend (currently the app calls `http://localhost:8001`; for production you’d point to your deployed backend URL).

---

## Project Structure

```
├── docmaster-backend/     # FastAPI: /parse (PDF/PPTX → Markdown), optional storage
├── docmaster-web/         # React + Vite: upload UI, prompts, report viewer
├── docs/                  # Architecture and implementation notes
├── LICENSE                # MIT
└── README.md
```

- **Parsing**: Local Python server only. No cloud parsing keys required.
- **Reports**: Generated in the browser by calling your chosen LLM with the extracted markdown and configurable prompts.

---

## Tech Stack

| Layer   | Stack |
|--------|--------|
| Backend | FastAPI, pymupdf4llm, pdfplumber, python-pptx |
| Frontend | React 19, Vite 7, Tailwind CSS |
| LLM     | OpenAI, Anthropic, Google Generative AI (browser SDK) |

---

## License

MIT. See [LICENSE](LICENSE).

---

## Contributing

Issues and pull requests are welcome. If you find this useful, consider giving the repo a star.
