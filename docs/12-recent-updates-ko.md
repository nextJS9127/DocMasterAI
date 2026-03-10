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

## 문서 참조

| 문서 | 설명 |
|------|------|
| [08-customization-question-flow-ko.md](08-customization-question-flow-ko.md) | 맞춤 질문 플로우 (원문 → 질문 먼저 → 정리 md 1회) |
| [10-report-generation-latency-ko.md](10-report-generation-latency-ko.md) | 보고서 생성 지연·빠른 모델 등 |
