# AGENTS.md

## Cursor Cloud specific instructions

### Product overview
DocMaster AI is a document intelligence platform with three main components:
- **docmaster-backend** (Python/FastAPI) — PDF/PPTX parsing API on port 8001
- **docmaster-web** (React/Vite) — Frontend web app on port 5173
- **VS Code Extension** (root `package.json`) — Optional sidebar extension

### Running services

**Backend** (must start from `docmaster-backend/` directory):
```bash
cd docmaster-backend
source venv/bin/activate
uvicorn main:app --reload --port 8001
```
Verify: `curl http://localhost:8001/api/health`

**Frontend** (must start from `docmaster-web/` directory):
```bash
cd docmaster-web
npm run dev
```
Opens on http://localhost:5173.

### Non-obvious caveats
- The frontend needs `VITE_API_BASE_URL=http://localhost:8001` in `docmaster-web/.env` to connect to the local backend. Without it, parse requests may go to the wrong port.
- The backend **must** be started from inside the `docmaster-backend/` directory. Starting from the repo root will load the wrong `main` module and cause 404 on `/api/parse`.
- `python3.12-venv` system package is required to create the Python venv. The update script handles venv creation.
- Some vitest tests in `docmaster-web` require the backend to be running (e.g., the `/parse` integration test). One test (`llmClient.test.ts` — "testcases 기본 프롬프트에 필수 키워드가 포함된다") has a pre-existing assertion failure unrelated to environment setup.

### Lint / Test / Build
- **Frontend lint**: `cd docmaster-web && npm run lint` (pre-existing lint errors exist in the repo)
- **Frontend tests**: `cd docmaster-web && npm run test` (vitest)
- **Frontend build**: `cd docmaster-web && npm run build`
- **Root extension build**: `cd /workspace && npm run compile` (webpack, requires VS Code types)

### LLM API keys
Step 2 (report generation) requires an LLM API key (OpenAI/Claude/Gemini) configured in the browser Settings modal. Step 1 (parsing) works without any API key.
