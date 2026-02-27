# DocMaster AI — 소스 코드 상세 분석 (한글)

이 문서는 DocMaster AI 프론트엔드·백엔드 소스를 모듈/파일 단위로 분석합니다.

---

## 1. 프론트엔드 진입점 및 상태

### 1.1 `main.tsx` / `App.tsx`

- **main.tsx**: `createRoot`로 `#root`에 `App`을 마운트하고, `index.css`를 불러옵니다.
- **App.tsx**가 전체 2단계 플로우의 상태와 핸들러를 갖습니다.

**상태 변수 요약**

| 상태 | 타입 | 용도 |
|------|------|------|
| `appStep` | `'idle' \| 'parsing' \| 'parsed' \| 'generating'` | 2단계 파이프라인 진행 단계 |
| `parsedMarkdown` | `string \| null` | Step 1 추출 결과 마크다운 |
| `parsedFileName` | `string` | 업로드한 원본 파일명 |
| `reportHtml` | `string \| null` | Step 2에서 LLM이 생성한 HTML |
| `reportMarkdown` | `string \| null` | LLM이 출력한 정리 마크다운 블록 |
| `reportUsage` | `ReportUsage \| null` | 토큰 수·예상 비용 |
| `lang` | `'ko' \| 'en'` | UI 언어 (localStorage `docmaster_lang`과 동기화) |
| `showReportPopup` | `boolean` | 보고서 뷰어 팝업 표시 여부 |

**주요 핸들러**

- **handleFileSelect(file)**: `appStep = 'parsing'` → `POST http://localhost:8001/parse`에 `FormData` 전송 → 성공 시 `parsedMarkdown`, `parsedFileName` 설정, `appStep = 'parsed'`. 실패 시 `appStep = 'idle'`, `alert`로 에러 표시.
- **handleGenerateReport(reportType, templateId)**: `parsedMarkdown`이 없으면 return. `localStorage`에서 `docmaster_llmProvider`, `docmaster_llmKey` 읽어 `generateReportClient` 호출 → `reportHtml`, `reportMarkdown`, `reportUsage` 설정. API 키 미설정·401/403 등은 `alert` 또는 토스트/설정 열기 유도.
- **handleReset**: `appStep = 'idle'`, 파싱·보고서 관련 상태 전부 초기화.

레이아웃: 좌측 사이드바(진행 단계 트리, 핵심 역량, 데이터 처리 안내, 개발자 정보) + 메인 영역(업로드 구역 또는 `ParsedResultPanel`). 상단에 설정·도움말·언어 토글.

---

## 2. `lib/llmClient.ts` — LLM 연동 및 보고서 생성

### 2.1 역할

- 경영진용/실무용 **편집 가능 프롬프트**(한/영)와 **HTML 출력 고정 규칙** 정의.
- 설정에서 선택한 LLM(OpenAI, Claude, Gemini)에 맞춰 API 호출 및 **마크다운·HTML 블록 파싱**.

### 2.2 프롬프트 구성

- **편집 가능 블록**: `DEFAULT_PROMPT_EXECUTIVE_EDITABLE` / `DEFAULT_PROMPT_TEAM_EDITABLE` (한글), `*_EN` (영문). 역할·입력 데이터 규칙·필수 출력 섹션·Execution Steps(Step 1~3) 등.
- **고정 블록**: `HTML_FIXED_EXECUTIVE` / `HTML_FIXED_TEAM`. "순수 HTML만 반환", "```markdown / ```html 두 블록만 순서대로 출력" 등.
- `getDefaultExecutiveEditable(lang)`, `getDefaultTeamEditable(lang)`: UI 언어에 따라 기본 편집 가능 프롬프트 반환. 실제 사용 시에는 `localStorage`에 저장된 값이 있으면 그대로 사용.

### 2.3 템플릿·스타일 가이드

- **HtmlTemplateId**: `'default' | 'phase1' | 'presentation2' | 'wiki' | 'preformat'`.
- **getTemplateForApi(templateId)**:
  - `default`: 내장 슬라이드형 HTML 문자열(`DEFAULT_TEMPLATE`).
  - `phase1`: 기획/제안서 스타일 가이드(구조·클래스·색상 요약).
  - `presentation2`: 16:9 슬라이드 스타일 가이드.
  - `wiki`: 위키 붙여넣기용 단순 HTML(style/script/class 금지).
  - `preformat`: 고정 템플릿 없이 LLM이 형식을 설계하라는 지시문.

### 2.4 `generateReportClient(markdownData, selection, apiKey, reportType, templateId)`

1. **selection**으로 `LLM_SELECTION_MAP`에서 `provider`·`modelId` 결정 (예: `openai` → gpt-4o, `claude` → claude-sonnet-4-6).
2. **SYSTEM_PROMPT**: 편집 가능 프롬프트(localStorage 또는 기본값) + 해당 유형의 HTML 고정 블록.
3. **userPrompt**: "[원시 데이터]" + 추출 마크다운 + `DATA_BLOCK_INSTRUCTION`([[TABLE]]/[[DIAGRAM]] 해석) + 템플릿/스타일 가이드 + 템플릿별 지시(`TEMPLATE_INSTRUCTION_DEFAULT` 등).
4. **provider별 호출**:
   - **OpenAI**: `openai.chat.completions.create`, system/user 메시지, reasoning 모델이면 `reasoning_effort: 'high'`.
   - **Claude**: `anthropic.messages.create`, system + user, `max_tokens: 4096`.
   - **Gemini**: `genAI.getGenerativeModel` + `generateContent`, thinking 모델이면 `thinkingConfig`/`thinkingBudget` 지정.
5. **응답 파싱**: `fullBody`에서 ` ```markdown ... ``` ` → `reportMarkdown`, ` ```html ... ``` ` → `htmlBody`. 없으면 `fullBody`가 HTML로 간주.
6. **usage**: 각 provider 응답의 `usage`/`usageMetadata`로 `ReportUsage` 구성, `estimateCostUsd(selection, inputTokens, outputTokens)`로 예상 비용(USD) 계산.

반환: `{ html, markdown?, usage? }`.

---

## 3. 컴포넌트별 상세

### 3.1 `UploadZone.tsx`

- **props**: `onFileSelect`, `disabled`, `isProcessing`, `lang`, `onNoKeyAttempt?`.
- **동작**: 드래그 앤 드롭 또는 클릭으로 파일 선택. `application/pdf` 또는 `.pptx`만 허용; 그 외는 `t.onlyFile` 알림. `disabled`이고 `onNoKeyAttempt`가 있으면 업로드 시도 시 `onNoKeyAttempt()` 호출(API 키 없음 토스트 등). `isProcessing`일 때 로딩 스피너와 "파이썬 서버가 문서를 추출 중입니다..." 표시.
- **파일 입력**: `<input type="file" accept=".pdf,.pptx" hidden>`에 ref 걸고, 영역 클릭 시 `fileInputRef.current?.click()`.

### 3.2 `ParsedResultPanel.tsx`

- **props**: `parsedMarkdown`, `parsedFileName`, `onGenerateReport(reportType, templateId)`, `onReset`, `reportReady`, `reportMarkdown`, `reportUsage`, `onViewReport`, `lang`.
- **내부 상태**: `reportType`('executive'|'team'), `htmlTemplateId`(HtmlTemplateId), `isGenerating`.
- **기능**:
  - **Step 1 완료 배너**: "✅ Step 1 완료 — 문서 추출 결과", 파싱된 파일명.
  - **추출 마크다운 미리보기**: 앞부분만 표시, "줄 더 있음" 시 다운로드 유도.
  - **추출 결과 다운로드**: `handleDownloadMd` — `parsedMarkdown`을 Blob으로 만들어 `{원본파일명}_extracted.md`로 다운로드.
  - **보고서 형식**: 라디오로 경영진용/실무용 선택.
  - **HTML 형식**: select로 default / phase1 / presentation2 / wiki / preformat 선택.
  - **보고서 생성**: 버튼 클릭 시 `onGenerateReport(reportType, htmlTemplateId)` 호출, `isGenerating` 동안 로딩.
  - **보고서 생성 완료 시**: "보고서 생성이 완료되었습니다." + 토큰/비용 + "정리 내용 (.md) 다운로드" + "만들어진 보고서 보기" 버튼. `handleDownloadReportMd`는 `reportMarkdown`을 `{원본파일명}_report.md`로 저장.
- **다른 파일 분석**: `onReset()` 호출.

### 3.3 `ReportViewer.tsx`

- **props**: `htmlContent`, `onClose`, `lang`, `variant?` ('popup' | 'fullscreen').
- **stripDuplicateCheckmarks(html)**: `<li>` 안 선두의 `✓` 제거 (check-list는 CSS ::before로 체크 표시하므로 중복 방지).
- **렌더링**: 헤더(제목, HTML 다운로드 버튼, 닫기/새 문서 분석) + `<iframe srcDoc={processedHtml} sandbox="allow-scripts allow-same-origin" />`. `variant === 'popup'`이면 모달 레이어로 감싸고 배경 클릭 시 `onClose`.

### 3.4 `SettingsModal.tsx`

- **props**: `onClose`, `onSave`, `lang`.
- **탭**: API 키 / 경영진용 / 실무용. API 키 탭에서 LLM 선택(openai-gpt52, openai-gpt51, openai, claude, claude-opus, gemini3, gemini-25-pro), API 키 입력란(비밀번호 타입). 경영진/실무 탭에서 편집 가능 프롬프트 textarea + "기본값으로 초기화" + 고정 HTML 규칙 읽기 전용 표시.
- **저장**: `handleSave`에서 `docmaster_llmProvider`, `docmaster_llmKey`, `docmaster_promptExecutiveEditable`, `docmaster_promptTeamEditable`를 localStorage에 저장 후 `onSave()`.
- **언어 전환**: `lang`이 바뀌었을 때, 현재 편집 중인 프롬프트가 "다른 언어 기본값"과 같으면 선택한 언어의 기본 프롬프트로 덮어씁니다.

### 3.5 `OnboardingManualModal.tsx`

- **props**: `onClose`, `lang`.
- **내용**: 이용 방법(usageStep1~4), 주의 사항(caution1~5), 활용 가이드(guideTitle, guideMdTip, guideItem1~3) 등 `translations[lang].onboarding` 문자열로 표시. 도움말/온보딩 메뉴얼용 모달.

---

## 4. 번역 및 라우팅

### 4.1 `lib/translations.ts`

- **Language**: `'ko' | 'en'`.
- **translations**: `ko` / `en` 키 아래에 workspace, docAnalysis, config, upload, settings, parsedPanel, reportError, sidebar, onboarding 등 네임스페이스별 문자열 객체. UI 전반에서 `t = translations[lang]` 후 `t.parsedPanel.stepLabel` 등으로 접근.

### 4.2 라우팅

- 현재는 단일 페이지. `react-router-dom`은 설치되어 있으나 라우트 정의는 없을 수 있음. 모든 화면 전환은 `appStep`과 조건부 렌더링으로 처리.

---

## 5. 백엔드 상세

### 5.1 `main.py` — FastAPI 앱

- **CORS**: `localhost:5173`~`5176` 허용 (Vite 개발 서버).
- **GET /health**: 서버 상태, `outputs_dir` 경로 반환.
- **POST /parse**: `UploadFile` 수신 → 확장자 `.pdf`/`.pptx` 검사 → 임시 파일로 저장 후 `pdf_to_markdown` 또는 `pptx_to_markdown` 호출. 옵션으로 `refine_extracted_markdown`, `apply_normalizations` 적용. **finally**에서 임시 파일 `os.unlink`. 응답: `{ markdown, filename, file_type, meta }`. (추출 결과는 서버에 저장하지 않음.)
- **GET /result/{file_id}`, **GET /result/{file_id}/download**, **GET /results**: 과거 저장 모드용 레거시. 현재 기본 플로우에서는 미사용.

### 5.2 `app/pdf_utils.py`

- **pymupdf4llm.to_markdown(pdf_path, page_chunks=True)**: 페이지 단위 마크다운 리스트 반환.
- **extract_tables_from_pdf(pdf_path)**: pdfplumber로 페이지별 표 추출 → 마크다운 테이블 문자열 리스트.
- **pdf_to_markdown**: 각 페이지에 대해 본문 텍스트 추출, 비어 있으면 `_ocr_page_fallback`(pytesseract+PIL, 선택) 호출. 해당 페이지에 표가 있으면 `extract_constants.wrap_table`로 `[[TABLE]]...[[/TABLE]]` 감싸서 병합. `out_meta`에 `page_count`, `ocr_pages` 기록.

### 5.3 `app/pptx_utils.py`

- **_flatten_shapes(shapes)**: 그룹 도형 재귀 평탄화.
- **_collect_from_shapes(shapes, title_holder)**: 평탄화 후 top/left 정렬해 순회. 표 → `wrap_table`로 마크다운 테이블을 `[[TABLE]]` 감싸기. 차트 → `wrap_diagram`(캡션). SmartArt 등 GraphicFrame → `wrap_diagram("SmartArt/다이어그램")`. 텍스트는 플레이스홀더 제목이면 title_holder에 넣고, 나머지는 들여쓰기 불릿으로 추가.
- **pptx_to_markdown(pptx_path, out_meta)**: 슬라이드별로 위 수집 결과를 "## 🖼 Slide N" 또는 "## 제목" 형태로 이어서 반환. `out_meta['slide_count']` 설정.

### 5.4 `app/md_refine.py`

- **refine_extracted_markdown(raw_md)**: 순서대로 적용 — 슬라이드 헤더 정규화, 빈 불릿 제거, 연속 `---` 축소, 반복 푸터(3회 이상 등장 줄) 블록 끝에서 제거, 버전만 나열된 블록 축약, 연속 빈 줄 2개로 제한. `[[TABLE]]`/`[[DIAGRAM]]` 블록은 건드리지 않음.

### 5.5 `app/normalizer.py`

- **apply_normalizations(text, normalize_amount, normalize_date)**: 금액 패턴(숫자+원/KRW/₩) → "숫자 KRW" 형태, 날짜 패턴 → ISO YYYY-MM-DD. `[[TABLE]]`/`[[DIAGRAM]]` 내부는 변경하지 않고 보수적으로만 치환.

### 5.6 `app/extract_constants.py`

- **BLOCK_TABLE_START/END**, **BLOCK_DIAGRAM_START/END**: `[[TABLE]]`/`[[/TABLE]]`, `[[DIAGRAM]]`/`[[/DIAGRAM]]`.
- **wrap_table(md_table_content)**, **wrap_diagram(description_or_caption)**: 주어진 문자열을 해당 구분자로 감싼 문자열 반환. PDF/PPTX 추출 시 표·다이어그램을 LLM이 구분해 HTML로 반영할 수 있도록 함.

---

## 6. 데이터 흐름 요약

1. **설정**: 사용자가 설정 모달에서 API 키·LLM·프롬프트 저장 → localStorage.
2. **Step 1**: 파일 선택 → `POST /parse` → 백엔드가 추출 후 파일 삭제, 마크다운만 응답 → `parsedMarkdown` 등 설정.
3. **Step 2**: 보고서 형식·HTML 템플릿 선택 → [보고서 생성] → `generateReportClient`가 localStorage에서 프롬프트·키 읽어 LLM 호출 → 응답에서 markdown/html 블록 파싱 → `reportHtml`, `reportMarkdown`, `reportUsage` 설정.
4. **결과 활용**: "만들어진 보고서 보기" → ReportViewer에 `reportHtml` 표시; "정리 내용 (.md) 다운로드" → `reportMarkdown`을 파일로 저장.

이 흐름에서 원본 파일은 백엔드에서만 일시 존재 후 삭제되며, 클라이언트와 LLM에는 추출된 마크다운만 전달됩니다.
