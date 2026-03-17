# 최근 변경 사항 (업데이트 노트)

이 문서는 DocMaster 웹 앱의 최근 동작·설정 변경을 정리합니다. 구현 세부는 각 항목에서 참조하는 doc 번호를 참고하세요.

---

## 1. 맞춤 질문 플로우 개선 (질문 먼저 → 정리 md 1회)

**목적**: 초안 생성에 쓰이던 토큰·시간을 줄이고, 사용자가 질문을 먼저 보고 선택한 뒤 정리 md를 한 번만 생성하도록 변경.

**변경 요약**:
- **이전**: 정리 md 초안 생성 → 초안 기반 맞춤 질문 생성 → (선택 시) 정리 md 수정 → HTML. (정리 md 관련 호출 2회)
- **이후**: 원문만으로 **맞춤 질문 먼저** 생성(빠른 모델) → 팝업 표시 → **반영하여 계속** 시 원문+선택으로 **정리 md 1회** 생성 → HTML. **건너뛰기** 시 원문으로 정리 md 1회 → HTML.

**관련**:
- 프롬프트: `CUSTOMIZATION_QUESTIONS_FROM_RAW_KO/EN`, `REFINED_MD_WITH_CHOICES_SYSTEM_KO/EN` (executiveTeam.ts)
- 클라이언트: `generateCustomizationQuestionsFromRawClient`, `generateRefinedMarkdownWithChoicesClient` (llmClient.ts)
- 플로우 상세: [08-customization-question-flow-ko.md](08-customization-question-flow-ko.md)

---

## 2. 맞춤 질문 프롬프트 보강

- **선택지**: 서술형 한 문장으로 표현 (예: "리스크와 대응 방안을 중심으로 정리한다.")
- **질문 선택**: 날카로운 보고서를 위해 명확화할 질문을 잘 선택하도록 집중, 핵심 방향을 갈라놓는 질문 우선.

---

## 3. 보고서 HTML 형식 기본값 변경

- **이전**: 기본 선택값 `presentation2` (프레젠테이션 슬라이드 스타일).
- **이후**: 기본 선택값 **`phase1` (기획/제안서 스타일)**.

**변경 위치**: ParsedResultPanel(초기 state), App(handleGenerateReport 기본 인자), llmClient(generateReportClient 기본 인자).

---

## 4. HTML 단계(질문·HTML 생성)용 OpenAI 모델

- **이전**: `gpt-4o-mini` (빠른 모델).
- **이후**: **`gpt-4o`** 사용 (품질 우선).  
  Claude·Gemini는 기존대로 Haiku·Flash.

**변경 위치**: `HTML_STEP_FAST_MODEL.openai` (llmClient.ts).

---

## 5. HTML 생성 시 코드블록 추출 보강

- **문제**: 모델이 ` ```HTML `(대문자)로 출력하면 추출 실패 가능.
- **조치**: 경영진/실무 경로에서 ` ```html ... ``` ` 매칭을 **대소문자 무시**(`/i`)로 변경. fallback에서도 ` ```html ` / ` ``` ` 제거 시 대소문자 무시.

**변경 위치**: `generateHtmlFromMarkdownClient` 내 정규식 및 fallback (llmClient.ts).

---

## 6. 생성된 HTML 보고서 다운로드 파일명 규칙

- **규칙**: 첨부한 **원본 파일명(확장자 제외)** + **유형 접미사** + `.html`.
- **접미사**:
  - 경영진/실무 → **`_기획서`**
  - 개발 피처 → **`_개발Features`**
  - 테스트 케이스(품질·sanity) → **`_품질sanity`**

**예**: `제안서_초안.pdf` → `제안서_초안_기획서.html`, `요구사항.docx` → `요구사항_개발Features.html`.

**변경 위치**: ReportViewer(`fileName`, `reportType` props → `downloadFileName`), App(ReportViewer에 `parsedFileName`, `reportTypeForMarkdown` 전달).

---

## 7. 기획서 기반 보고서 HTML 형식 정리 및 PPT 생성 제거

- **HTML 형식**: 기획서 기반 보고서에서 선택 가능한 형식을 **3종만** 유지합니다.
  - **기획/제안서 스타일** (phase1)
  - **프레젠테이션 스타일** (presentation2) — 명칭 변경: 기존 "프레젠테이션 슬라이드 (16:9)" → "프레젠테이션 스타일"
  - **프리포맷** (preformat)
- **제거**: 위키 스타일(wiki), PPTX(슬라이드) 옵션 및 **PPT 파일로 다운로드하는 기능** 전체 제거.
- **변경 위치**: `BUILTIN_REPORT_TEMPLATE_IDS`(llmClient), ParsedResultPanel HTML 형식 셀렉트, TemplateAdminModal, 백엔드 `ALLOWED_TEMPLATE_IDS`.

---

## 8. 정리 md 재사용(HTML 형식만 변경 시)

- **동작**: 같은 보고서 계열(경영진/실무/개발 피처/테스트 케이스)에서 **이미 정리 md가 생성된 상태**에서 HTML 형식만 바꿔 [보고서 생성]을 누르면, 정리 md는 **다시 만들지 않고** 선택한 HTML 형식으로만 HTML을 재생성합니다.
- **조건**: `reportMarkdown`이 있고 `reportTypeForMarkdown`이 현재 선택한 보고 유형과 같을 때 재사용. 경영진↔실무 전환 시에는 정리 md가 초기화되므로 다음 생성 시 처음부터 생성됩니다.
- **변경 위치**: App.tsx `reuseRefinedMd`, `hasValidRefinedMd`, 2단계 파이프라인 분기.

---

## 9. Mermaid 다이어그램 (1차 추출·뷰어)

- **1차 추출(Python)**: 표·차트·SmartArt가 있으면 **Mermaid 문법**으로 flowchart 등을 생성해 **`[[MERMAID]] ... [[/MERMAID]]`** 블록으로 감싸 출력합니다. 정리 md 생성 시 LLM이 해당 블록을 유지·보완하도록 프롬프트에 반영됩니다.
- **정리 md 뷰어**: `[[MERMAID]]` 블록을 ` ```mermaid ` 로 변환해 렌더링. 노드 라벨 내 `=`, `(`, `)` 등은 Mermaid 파서 오류 방지를 위해 HTML 엔티티로 이스케이프합니다.
- **HTML 보고서 뷰어**: 보고서 HTML에 `language-mermaid` 코드 블록이 있으면 Mermaid 스크립트를 주입해 **다이어그램으로 시각화**합니다. 다운로드한 HTML 파일을 브라우저에서 열어도 동일하게 렌더됩니다.
- **관련**: extract_constants.py `wrap_mermaid`, pptx_utils/pdf_utils에서 표·다이어그램 → Mermaid 생성, MarkdownArtifactViewer, ReportViewer.

---

## 10. 정리 md 뷰어 개선 (표·목록·거절 처리)

- **표 렌더링**: `remark-gfm` 적용으로 마크다운 표(`| ... |`)가 **테이블**로 파싱·표시됩니다. thead/tbody/tr/th/td 스타일 적용.
- **목록 뎁스**: 1단계 ●(disc), 2단계 ○(circle), 3단계 ■(square)로 블릿을 구분해 상·하위 구분이 명확해지도록 했습니다.
- **모델 거절 감지**: LLM이 "I'm sorry, but I can't assist..." 등으로 요청을 거절한 응답을 그대로 보고서로 넣지 않도록 `isLlmRefusalContent()`로 감지합니다. 거절 시 빈 보고서 대신 **에러 메시지**와(2단계에서는) 정리 md 다운로드 안내를 표시합니다.
- **```markdown 폴백**: 2단계 HTML 생성 시 모델이 ` ```html ` 대신 ` ```markdown ` 블록만 반환해도 **marked**로 HTML 변환 후 보고서에 표시되도록 폴백을 추가했습니다.

---

## 문서 참조

| 문서 | 설명 |
|------|------|
| [08-customization-question-flow-ko.md](08-customization-question-flow-ko.md) | 맞춤 질문 플로우 (원문 → 질문 먼저 → 정리 md 1회) |
| [10-report-generation-latency-ko.md](10-report-generation-latency-ko.md) | 보고서 생성 지연·빠른 모델 등 |
