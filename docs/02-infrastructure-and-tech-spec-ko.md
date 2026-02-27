# DocMaster AI — 인프라 및 기술 스펙 (한글)

## 1. 기술 스택 개요

| 구분 | 기술 |
|------|------|
| **프론트엔드** | React 19, TypeScript, Vite 7 |
| **스타일** | Tailwind CSS 4 |
| **백엔드** | Python 3, FastAPI, Uvicorn |
| **문서 파싱** | pymupdf4llm, pdfplumber (PDF), python-pptx (PPTX) |
| **LLM 연동** | OpenAI, Anthropic, Google Generative AI (브라우저에서 직접 호출) |

---

## 2. 프론트엔드 (docmaster-web)

### 2.1 사용 라이브러리 및 용도

| 패키지 | 용도 |
|--------|------|
| **react** / **react-dom** | UI 컴포넌트 및 렌더링 |
| **react-router-dom** | 라우팅(필요 시 확장용) |
| **lucide-react** | 아이콘 (Settings, Upload, CheckCircle2, FileDown 등) |
| **openai** | OpenAI API 클라이언트 (보고서 생성) |
| **@anthropic-ai/sdk** | Anthropic Claude API 클라이언트 |
| **@google/generative-ai** | Google Gemini API 클라이언트 |
| **axios** | HTTP 클라이언트 (설정·헬스 체크 등) |
| **clsx** / **tailwind-merge** | 조건부 클래스명 결합 (스타일 유틸) |

### 2.2 개발/빌드 도구

| 패키지 | 용도 |
|--------|------|
| **vite** | 번들러 및 개발 서버 |
| **@vitejs/plugin-react** | React Fast Refresh |
| **@tailwindcss/vite** / **tailwindcss** | Tailwind CSS 4 통합 |
| **typescript** | 타입 체크 및 빌드 |
| **eslint** / **typescript-eslint** | 린트 및 코드 품질 |
| **vite-plugin-javascript-obfuscator** / **javascript-obfuscator** | 프로덕션 빌드 시 JS 난독화 (선택) |

---

## 3. 백엔드 (docmaster-backend)

### 3.1 사용 라이브러리 및 용도

| 패키지 | 용도 |
|--------|------|
| **fastapi** | REST API 프레임워크, `/parse`, `/health` 등 |
| **uvicorn[standard]** | ASGI 서버 (실행: `uvicorn main:app --reload --port 8001`) |
| **python-multipart** | `UploadFile` 등 멀티파트 폼 처리 |
| **pymupdf4llm** | PDF → LLM/RAG용 마크다운 변환 (본문 텍스트) |
| **pdfplumber** | PDF 내 표(테이블) 추출 → 마크다운 테이블 |
| **python-pptx** | PPTX 슬라이드 텍스트·표·차트·SmartArt 추출 |

### 3.2 선택 의존성 (OCR)

- **pytesseract**, **Pillow**: PDF 페이지 텍스트가 비었을 때 OCR 폴백. 기본 `requirements.txt`에는 포함되지 않으며, 필요 시 주석 해제 후 설치합니다.

---

## 4. 소스 폴더 구조

### 4.1 저장소 루트

```
PlugIn/
├── docmaster-web/          # 프론트엔드 (React + Vite)
├── docmaster-backend/       # 백엔드 (FastAPI)
├── docs/                    # 문서 (기획, 인프라, 소스 분석)
├── README.md
├── LICENSE
└── package.json             # 루트(워크스페이스) 패키지
```

### 4.2 docmaster-web (프론트엔드)

```
docmaster-web/
├── public/
│   ├── favicon.svg
│   └── templates/           # HTML 템플릿 (phase1.html, presentation2.html 등)
├── src/
│   ├── App.tsx              # 루트 컴포넌트, 2단계 플로우 상태·핸들러
│   ├── main.tsx
│   ├── index.css             # 전역 스타일·Tailwind 진입점
│   ├── components/
│   │   ├── UploadZone.tsx         # 파일 업로드 영역
│   │   ├── ParsedResultPanel.tsx  # Step 1 완료 후 패널 (미리보기, Step 2, 보고서 생성)
│   │   ├── ReportViewer.tsx       # 생성된 HTML 보고서 뷰어(팝업/전체화면)
│   │   ├── SettingsModal.tsx      # 설정 모달 (API 키, LLM 선택, 프롬프트 탭)
│   │   └── OnboardingManualModal.tsx  # 도움말/온보딩 모달
│   └── lib/
│       ├── translations.ts  # 한/영 UI 문자열
│       └── llmClient.ts      # LLM 연동, 프롬프트, 템플릿, generateReportClient
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 4.3 docmaster-backend (백엔드)

```
docmaster-backend/
├── app/
│   ├── pdf_utils.py         # PDF → 마크다운 (pymupdf4llm + pdfplumber, OCR 폴백)
│   ├── pptx_utils.py        # PPTX → 마크다운 (슬라이드·표·차트·SmartArt)
│   ├── md_refine.py         # 추출 마크다운 1차 정제 (슬라이드 잔재, 푸터, 구분선 등)
│   ├── normalizer.py        # 금액·날짜 정규화
│   └── extract_constants.py # [[TABLE]]/[[DIAGRAM]] 구분자 상수 및 wrap 함수
├── main.py                  # FastAPI 앱, /health, /parse, CORS
├── requirements.txt
└── outputs/                 # (선택) 저장 모드일 때 추출 결과 .md 파일 (기본은 미사용)
```

---

## 5. 주요 엔드포인트 및 설정

### 5.1 백엔드 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/parse` | PDF/PPTX 업로드 → 마크다운 추출 (파일 즉시 삭제, 결과만 응답) |
| GET | `/result/{file_id}` | (레거시) 저장된 결과 텍스트 반환 |
| GET | `/result/{file_id}/download` | (레거시) 저장된 .md 다운로드 |
| GET | `/results` | (레거시) 저장된 결과 목록 |

실제 서비스 플로우에서는 `/parse`만 사용하며, 추출 결과는 응답 본문으로만 받습니다.

### 5.2 환경 변수 (백엔드)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REFINE_MD` | `true` | 추출 마크다운 1차 정제 적용 여부 |
| `NORMALIZE_MD` | `true` | 금액·날짜 정규화 적용 여부 |

### 5.3 프론트엔드 설정

- **API 키·LLM 선택·프롬프트**: `localStorage` 키 `docmaster_llmKey`, `docmaster_llmProvider`, `docmaster_promptExecutiveEditable`, `docmaster_promptTeamEditable` 등.
- **언어**: `docmaster_lang` (`ko` | `en`).
- **백엔드 주소**: `http://localhost:8001` (코드 내 하드코딩, 필요 시 환경 변수로 분리 가능).

---

## 6. 실행 방법 요약

### 백엔드

```bash
cd docmaster-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 프론트엔드

```bash
cd docmaster-web
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후, 설정에서 API 키 입력 → 파일 업로드 → 보고서 생성 순으로 사용합니다.
