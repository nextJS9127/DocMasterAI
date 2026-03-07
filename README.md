# DocMaster AI

**Turn PDF and PPTX into executive-ready reports** — local parsing, no document cloud. Use your own LLM (OpenAI, Claude, Gemini) to generate one-pagers and team docs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** [https://doc-master-ai.vercel.app/](https://doc-master-ai.vercel.app/)  
*(프론트·백엔드 모두 Vercel에 배포하면, 사용자는 Git/로컬 실행 없이 데모만으로 사용 가능.)*

> 💡 **Useful?** Consider giving the repo a **star** so others can find it.

---

## Why DocMaster? (쓸 만한 이유)

DocMaster는 다음 **세 가지**를 지키려고 설계되었습니다.

| # | 핵심 | 설명 |
|---|------|------|
| **1** | **올린 파일에서 정확히 자료 추출** | PDF/PPTX에서 텍스트·표·슬라이드 구조를 추출합니다. 복잡한 표와 차트 영역도 인식해, 이후 단계가 놓치지 않도록 합니다. |
| **2** | **2차 정리 md 생성 (매우 중요)** | 추출된 원본만으로는 부족합니다. LLM으로 **경영진용·실무용 보고서 초안(정리 md)**을 만들고, 품질 루브릭·N회차 옵션으로 알맹이 있는 문서가 나오도록 합니다. |
| **3** | **멋진 HTML 레포트 디자인** | 정리된 내용을 여러 HTML 포맷(기본 슬라이드형, 기획서 스타일, 프레젠테이션, 위키 등)으로 꾸며, 바로 다운로드·공유할 수 있게 합니다. |

즉, **추출 → 정리 md → HTML 디자인** 세 단계가 모두 갖춰져 있어야 “쓸 만하다”고 느끼실 수 있도록 만든 서비스입니다.

---

## Screenshots

| Upload & Extract | Report (Executive / Team) |
|------------------|---------------------------|
| *Add a screenshot of the upload/settings screen* | *Add a screenshot of the generated report* |

*(스크린샷이나 GIF를 추가하면 검색·첫인상에 도움이 됩니다. `docs/` 또는 README에 이미지 링크 추가.)*

---

## Features

DocMaster는 **① 정확한 추출 → ② 2차 정리 md(핵심) → ③ HTML 레포트 디자인** 세 단계를 한 흐름으로 제공합니다.

- **정확한 추출 (Step 1)** — PDF/PPTX를 로컬 Python 백엔드에서 처리. 표·슬라이드 구조·텍스트 추출. 서드파티 문서 API 없음.
- **2차 정리 md (Step 2, 핵심)** — 추출 결과를 LLM으로 분석해 경영진용·실무용 보고서 초안(정리 md) 생성. 품질 루브릭·고품질 N회차 옵션 지원.
- **HTML 레포트 디자인 (Step 3)** — 정리된 내용을 여러 템플릿(기본 슬라이드형, 기획서 스타일, 프레젠테이션, 위키, PPTX 등)으로 꾸며 즉시 다운로드·활용 가능.
- **선택한 LLM 사용** — OpenAI(GPT-4o, 5.x), Anthropic(Claude), Google(Gemini). API 키는 브라우저에만 저장되며, 추출 텍스트만 선택한 제공업체로 전송.
- **한·영 UI** — 한국어/영어 전환, 프롬프트도 선택 언어에 맞춤.

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

## Deploy on Vercel (프론트 + 백엔드 모두 Vercel에서 동작)

**같은 저장소로 Vercel 프로젝트를 두 개** 만들어서, 사용자가 Git 클론·로컬 서버 없이 데모 URL만으로 사용할 수 있게 할 수 있습니다.

### 1) 프론트엔드 (이미 연결된 프로젝트)

- **Root Directory**: `docmaster-web`
- **URL**: https://doc-master-ai.vercel.app (또는 본인 도메인)

### 2) 백엔드 (새 Vercel 프로젝트 추가)

1. [Vercel Dashboard](https://vercel.com/new)에서 **같은 GitHub 저장소**를 다시 Import.
2. **Root Directory**를 `docmaster-backend`로 지정.
3. **Framework Preset**: Other (또는 Python)  
   - `docmaster-backend`에는 `pyproject.toml`(진입점 `main:app`)과 `vercel.json`이 있어서 FastAPI가 서버리스로 배포됩니다.
4. Deploy 후 나온 **백엔드 URL**을 복사 (예: `https://docmaster-backend-xxx.vercel.app`).

### 3) 프론트엔드에서 백엔드 URL 연결

1. **프론트엔드** Vercel 프로젝트 → **Settings** → **Environment Variables**
2. `VITE_API_BASE_URL` = 위에서 복사한 **백엔드 URL** (예: `https://docmaster-backend-xxx.vercel.app`) 추가.  
   - Production, Preview, Development 모두 같은 값으로 설정해도 됩니다.
3. **Redeploy** 한 번 실행.

이후에는 https://doc-master-ai.vercel.app 에서 파일 업로드·추출·보고서 생성이 **로컬 실행 없이** 동작합니다.

- **참고**: Vercel 서버리스는 요청당 실행 시간 제한(기본 60초 등)이 있으므로, 매우 큰 PDF/PPTX는 타임아웃될 수 있습니다. 제한은 프로젝트 설정 또는 `docmaster-backend/vercel.json`의 `maxDuration`으로 조정 가능합니다.

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

## Repository setup (GitHub에서 한 번만 설정)

스타·검색 노출을 위해 GitHub 저장소 **About**에서 다음을 설정하는 것을 권장합니다.

| 항목 | 권장 값 |
|------|--------|
| **Description** | `DocMaster AI – PDF/PPTX를 실행 요약·팀 문서로. 로컬 파싱, 자체 LLM 연동` |
| **Topics** | `document-ai`, `pdf`, `pptx`, `llm`, `openai`, `claude`, `gemini`, `react`, `vite`, `fastapi`, `executive-summary` |

저장소 페이지 오른쪽 **About** → 연필 아이콘에서 편집하면 됩니다.  
체크리스트는 [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)를 참고하세요.

---

## Releases

- **첫 릴리스**: GitHub에서 **Releases** → **Create a new release** → Tag `v0.1.0` (또는 `v1.0.0`) 생성 후 릴리스 노트 작성.
- 로컬에서 태그만 만들려면: `git tag v0.1.0 && git push origin v0.1.0`

---

## License

MIT. See [LICENSE](LICENSE).

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. If you find this useful, consider giving the repo a **star**.
