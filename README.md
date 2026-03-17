# DocMaster AI

**Turn PDF and PPTX into executive-ready reports** — local parsing, no document cloud. Use your own LLM (OpenAI, Claude, Gemini) to generate one-pagers and team docs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** [https://doc-master-ai-wsjo.vercel.app/](https://doc-master-ai-wsjo.vercel.app/)  
*(프론트·백엔드 모두 Vercel에 배포하면, 사용자는 Git/로컬 실행 없이 데모만으로 사용 가능.)*

> 💡 **Useful?** Consider giving the repo a **star** so others can find it.

---

## Why DocMaster? (쓸 만한 이유)

DocMaster는 다음 **세 가지**를 지키려고 설계되었습니다.

| # | 핵심 | 설명 |
|---|------|------|
| **1** | **올린 파일에서 정확히 자료 추출** | PDF/PPTX에서 텍스트·표·슬라이드 구조를 추출합니다. 복잡한 표와 차트 영역도 인식해, 이후 단계가 놓치지 않도록 합니다. |
| **2** | **2차 정리 md 생성 (매우 중요)** | 추출된 원본만으로는 부족합니다. LLM으로 **경영진용·실무용 보고서 초안(정리 md)**을 만들고, 품질 루브릭·N회차 옵션으로 알맹이 있는 문서가 나오도록 합니다. |
| **3** | **멋진 HTML 레포트 디자인** | 정리된 내용을 기획/제안서 스타일, 프레젠테이션 스타일, 프리포맷 등 HTML 형식으로 꾸며, 바로 다운로드·공유할 수 있게 합니다. 정리 md에 Mermaid가 있으면 HTML 보고서에서도 다이어그램으로 표시됩니다. |

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
- **HTML 레포트 디자인 (Step 3)** — 정리된 내용을 **기획서 기반 보고서**용 HTML 형식 3종(**기획/제안서 스타일**, **프레젠테이션 스타일**, **프리포맷**)으로 꾸며 즉시 다운로드·활용 가능. **다운로드 파일명**: `{원본 파일명}_기획서` / `_개발Features` / `_품질sanity`.html. 정리 md가 이미 있으면 **HTML 형식만 바꿔** 재생성 시 정리 md는 재사용되고 선택한 형식으로만 HTML이 다시 만들어집니다.
- **템플릿 관리** — 보고서용 HTML 템플릿 목록 조회·편집·저장·삭제 API(`/api/templates`, `/api/templates/:id`). 어드민에서 스타일 가이드 수정 후 저장 가능.
- **선택한 LLM 사용** — OpenAI(GPT-4o; 질문·HTML 단계에서 4o 사용), Anthropic(Claude), Google(Gemini). API 키는 브라우저에만 저장되며, 추출 텍스트만 선택한 제공업체로 전송.
- **한·영 UI** — 한국어/영어 전환, 프롬프트도 선택 언어에 맞춤.

---

## 최근 변경 사항 (Recent updates)

맞춤 질문 플로우 개선, **기획서 기반 보고서 HTML 형식 3종만 유지**(기획/제안서 스타일, 프레젠테이션 스타일, 프리포맷) 및 **PPT 생성 제거**, **정리 md 재사용**(HTML 형식만 변경 시), **Mermaid 다이어그램**(1차 추출·뷰어·HTML 보고서), 정리 md 뷰어(표·뎁스별 블릿)·모델 거절 감지·` ```markdown ` 폴백 등은 **[docs/12-recent-updates-ko.md](docs/12-recent-updates-ko.md)** 에 정리되어 있습니다. 맞춤 질문 플로우는 [docs/08-customization-question-flow-ko.md](docs/08-customization-question-flow-ko.md) 를 참고하세요.

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

### 1) 프론트엔드

- **Root Directory**: `docmaster-web`
- **URL**: 예) https://doc-master-ai-wsjo.vercel.app (또는 본인 도메인)

### 2) 백엔드

1. [Vercel Dashboard](https://vercel.com/new)에서 **같은 GitHub 저장소**를 다시 Import.
2. **Root Directory**를 `docmaster-backend`로 지정.
3. **Framework Preset**: Other (또는 Python)  
   - `docmaster-backend`에는 `vercel.json`과 `api/` 서버리스 진입점이 있어 FastAPI가 서버리스로 배포됩니다. `/api/templates`, `/api/templates/:id`는 `vercel.json` rewrites로 `/api`(index)에 연결됩니다.
4. Deploy 후 나온 **백엔드 URL**을 복사 (예: `https://doc-master-ai-wsjo.vercel.app`가 백엔드 전용이면 그 URL 사용).

### 3) 프론트엔드에서 백엔드 URL 연결

1. **프론트엔드** Vercel 프로젝트 → **Settings** → **Environment Variables**
2. `VITE_API_BASE_URL` = 위에서 복사한 **백엔드 URL** 추가.  
   - 설정하지 않으면 배포 도메인 기준으로 같은 호스트를 사용합니다 (프론트·백을 한 프로젝트로 둔 경우).
3. **Redeploy** 한 번 실행.

이후에는 데모 URL에서 파일 업로드·추출·보고서 생성이 **로컬 실행 없이** 동작합니다.

- **Vercel 제한 사항**  
  - 요청/응답 본문 **약 4.5MB** 제한이 있으며 플랫폼에서 변경할 수 없습니다. 업로드 파일이 크면 413 오류가 나며, 앱에서는 “버셀 환경상 요청 크기가 서버 제한을 초과했습니다” 안내를 표시합니다.  
  - 서버리스 실행 시간 제한(기본 60초 등)이 있으므로, 매우 큰 PDF/PPTX는 타임아웃될 수 있습니다. `docmaster-backend/vercel.json`의 `functions` 등으로 조정 가능합니다.

---

## Project Structure

```
├── docmaster-backend/     # FastAPI: /api/parse, /api/health, /api/templates(목록·조회·저장·삭제)
│   ├── api/               # Vercel 서버리스: health.py, parse.py, index.py, templates/[[...path]].py
│   ├── app/               # PDF/PPTX 추출, 정제 로직
│   ├── data/templates/    # HTML 템플릿 번들 (배포 시 이 경로 사용)
│   └── vercel.json        # rewrites, CORS 헤더
├── docmaster-web/         # React + Vite: 업로드 UI, 프롬프트, 보고서 뷰어, 템플릿 어드민
├── docs/                  # 아키텍처·구현 노트, 사용자 메뉴얼
├── CONTRIBUTING.md        # 기여 가이드
├── LICENSE                # MIT
└── README.md
```

- **Parsing**: 로컬 Python 서버 또는 Vercel 서버리스. 별도 문서 클라우드 키 불필요.
- **Reports**: 브라우저에서 선택한 LLM으로 추출 마크다운과 설정 가능한 프롬프트를 사용해 생성.

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

## Open Source / 소스 오픈

이 프로젝트는 **MIT 라이선스**로 공개되어 있습니다. 자유롭게 사용·수정·재배포하실 수 있습니다.

**가져다 쓰시거나 포크해서 더 좋게 개선하셨다면, 꼭 함께 공유해 주세요.**

- **개선 사항·아이디어**: [Issues](https://github.com/nextJS9127/DocMasterAI/issues) 또는 [Discussions](https://github.com/nextJS9127/DocMasterAI/discussions)
- **코드 반영**: [Pull Request](https://github.com/nextJS9127/DocMasterAI/pulls)

다른 분들도 참고할 수 있도록 공유해 주시면 감사하겠습니다.

---

## Releases

- **첫 릴리스**: GitHub에서 **Releases** → **Create a new release** → Tag `v0.1.0` (또는 `v1.0.0`) 생성 후 릴리스 노트 작성.
- 로컬에서 태그만 만들려면: `git tag v0.1.0 && git push origin v0.1.0`

---

## License

MIT. See [LICENSE](LICENSE).

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**소스를 가져다 쓰시거나 더 좋게 개선하셨다면, 이슈·PR·토론으로 꼭 공유해 주세요.**  
If you find this useful, consider giving the repo a **star**.
