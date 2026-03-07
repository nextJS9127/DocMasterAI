# 기획서 기반 보고서 — 현재 흐름 분석

## 1. 전체 파이프라인 (현재)

경영진/실무 보고서는 **2단계 파이프라인**으로 동작합니다. (pptx 포맷 선택 시에는 1회 호출로 슬라이드 JSON 생성.)

```
[사용자 파일 PDF/PPTX]
        ↓
  Python 백엔드 (docmaster-backend)
  · /parse → pymupdf4llm, pdfplumber, python-pptx
        ↓
  [원시 마크다운] (추출 성공 ✓)
        ↓
  프론트엔드: 보고 유형(경영진/실무) + HTML 형식 선택 후 [보고서 생성] 클릭
        ↓
  ┌─ 1단계: generateRefinedMarkdownClient ─────────────────────────┐
  │  System: (편집 가능 프롬프트) + 품질 루브릭·누락 금지 지시       │
  │  User:   [원시 데이터]                                           │
  │  → 정리된 보고 내용(2차 가공 md) 생성                            │
  └─────────────────────────────────────────────────────────────────┘
        ↓
  ┌─ 2단계: generateHtmlFromMarkdownClient ─────────────────────────┐
  │  System: (편집 가능 프롬프트) + HTML_FIXED_EXECUTIVE/TEAM         │
  │          + 동적 포맷 지시(사용자 추가 변수·섹션 반영 가능)        │
  │  User:   [정리된 보고 내용] + [Target HTML Template] + 변수 지시 │
  │  → 완성 HTML 생성 (선택한 템플릿/스타일 기준)                    │
  └─────────────────────────────────────────────────────────────────┘
        ↓
  반환: { html, markdown(정리 md), usage }
```

**HTML 형식만 바꿀 때 (5번 시나리오)**  
이미 정리 md가 있고, 보고 유형(경영진/실무)이 이전과 **동일**하면 → **1단계 생략**, 기존 정리 md로 **2단계(HTML 생성)만** 재실행. 정리 md는 다시 만들지 않음.

---

## 2. 템플릿 변수 및 슬라이드 (default 포맷)

- **기본 HTML 템플릿**(`DEFAULT_TEMPLATE`)은 **슬라이드형**, **변수** 1:1 매핑.
- 한 화면에 한 주제만 담아 가독성을 유지한다.

| 슬라이드 | 변수 | 필수 항목 |
|----------|------|-----------|
| 1 | `{{summary}}` | Executive Summary (핵심 요약) |
| 2 | `{{purpose_background}}` | 목적/배경 |
| 3 | `{{key_changes}}` | 핵심 변경사항/정책 요약 |
| 4 | `{{process_flow}}` | 전체 프로세스 흐름 |
| 5 | `{{recommendations}}` | 우선순위 개선 권장사항 |
| 6 | `{{risks}}` | 리스크·검증포인트 |
| 7 | `{{action_item}}` | 최종 슬라이드(결론·액션) |

- **동적 포맷**: 사용자가 프롬프트에서 변수·섹션을 추가하면, HTML_FIXED 지시에 따라 동일 스타일을 유지하면서 슬라이드/섹션을 추가해 반영할 수 있음.

---

## 3. 질문에 대한 답변

### Q1. "HTML 형태로 레포트 생성할 때 프롬프트를 LLM 통해서 만들고 있는지?"

**예.**  
- **1단계**: 편집 가능 프롬프트 + 품질 루브릭으로 **정리 md만** LLM이 생성.  
- **2단계**: 편집 가능 프롬프트 + `HTML_FIXED_EXECUTIVE`/`HTML_FIXED_TEAM` + [정리된 보고 내용] + [Target HTML Template]을 주고, LLM이 **완성 HTML만** 생성(사용자 정의 변수·섹션도 반영 가능).

### Q2. "포맷별 템플릿 HTML 소스는 내부에 따로 갖고 있는지?"

**예.** 보고서 **타입(도메인)별**로 **`docmaster-web/src/lib/prompts/`** 아래에 정의되어 있습니다.

| 포맷 ID        | 정의 위치 | 상수/함수 | 내용 |
|----------------|-----------|-----------|------|
| `default`      | `prompts/executiveTeam.ts` | `DEFAULT_HTML_STYLE_GUIDE`, `getDefaultHtmlTemplateSkeleton` | 슬라이드형 HTML 스타일 가이드 및 7변수(`{{summary}}`, `{{purpose_background}}`, `{{key_changes}}`, `{{process_flow}}`, `{{recommendations}}`, `{{risks}}`, `{{action_item}}`) 스켈레톤. |
| `phase1`       | `prompts/executiveTeam.ts` | `PHASE1_STYLE_GUIDE` | 기획/제안서 스타일 **가이드 텍스트**. |
| `presentation2`| `prompts/executiveTeam.ts` | `PRESENTATION2_STYLE_GUIDE` | 프레젠테이션 16:9 슬라이드 스타일 **가이드**. |
| `wiki`         | `prompts/executiveTeam.ts` | `WIKI_STYLE_GUIDE` | 위키 붙여넣기용 **가이드**. |
| `preformat`    | `prompts/executiveTeam.ts` | `PREFORMAT_INSTRUCTION` | "템플릿 자동 설계" 모드 **지시문**. |
| `pptx`         | `prompts/executiveTeam.ts` | (별도 시스템 프롬프트) | 1회 호출로 슬라이드 JSON 생성; 템플릿 문자열은 사용하지 않음. |
| `testcases`    | `prompts/testcases.ts` | `HTML_FIXED_TESTCASES`, `getTestcasesTemplateContent()` | 테스트 케이스 문서용 HTML 구조·스타일. API 없거나 404 시 로컬 기본값 사용. |
| `features`     | `prompts/features.ts` | `HTML_FIXED_FEATURES`, `getFeaturesTemplateContent()` | 개발 피처 문서용 HTML 구조·스타일. API 없거나 404 시 로컬 기본값 사용. |

- **getTemplateForApi(templateId)** / **getTemplateContentById(id)**는 `prompts/executiveTeam.ts`에 있으며, `llmClient.ts`는 이를 import해 사용·re-export합니다.

---

## 4. 의도 vs 현재 동작

- **의도**
  - 추출된 내용을 **경영진용/실무용 md로 2차 가공**하는 것이 핵심.
  - **HTML은 “잘 만들어진 내용”을 이쁘게 보여주는 용도.**

- **현재 동작**
  - **2단계 파이프라인** 구현됨: 1단계에서 정리 md 생성 → 2단계에서 그 md를 입력으로 HTML 생성.
  - 사용자가 **HTML 형식만** 바꿔서 다시 [보고서 생성]하면, **정리 md는 재생성하지 않고** 기존 정리 md 기준으로 선택한 HTML 포맷만 다시 만듦.
  - 2단계에서 **편집 가능 프롬프트**도 함께 전달하므로, 사용자가 추가한 변수·섹션이 있으면 동일 스타일로 슬라이드/섹션을 확장해 반영할 수 있음.

---

## 5. 다음 단계 제안

- **당장**: 위 2단계 파이프라인·7변수·동적 포맷·“HTML만 재생성” 동작이 코드와 문서에 반영된 상태로 유지.
- **고도화**: 기본 템플릿 외 포맷(phase1, presentation2 등)에서도 7섹션/동적 확장 규칙을 스타일 가이드 문구에 맞춰 정리하면 일관성 유지에 유리함.

이 문서는 `docs/05-report-flow-analysis-ko.md` 로 두고, 구현 변경 시 이 흐름을 기준으로 수정하면 됩니다.

---

## 6. 프로세스 검증: 업로드 → 추출 md → 정리 md → HTML

**고정된 3단계:**

1. **사용자 파일 업로드**  
   프론트엔드가 `POST ${apiBaseUrl}/api/parse`로 PDF/PPTX 전송 → Python 백엔드가 pymupdf4llm / pdfplumber / python-pptx로 **추출 md** 생성 후 응답으로 반환. (원본 파일은 추출 후 삭제.)

2. **LLM으로 2차 정리 md 생성**  
   `generateRefinedMarkdownClient(추출 md, reportType, ...)`  
   - **경영진/실무**: 편집 가능 프롬프트 + 품질 루브릭 → 정리 md (고품질 시 N회차 검토).  
   - **테스트케이스/개발피처**: `prompts/testcases` 또는 `prompts/features`의 편집 가능 프롬프트 + “이 단계는 정리 md만 출력” 지시 → 정리 md 1회 호출.  
   이 단계에서는 **HTML 템플릿을 사용하지 않음**.

3. **HTML 템플릿을 입혀 보고서 생성**  
   `generateHtmlFromMarkdownClient(정리 md, templateId, reportType, apiBaseUrl?, ...)`  
   - **경영진/실무**: `apiBaseUrl`이 있으면 `GET /api/templates/{templateId}`로 템플릿 조회, 없으면 `getTemplateForApi(templateId)` 사용.  
   - **테스트케이스/개발피처**: `apiBaseUrl`이 있으면 `GET /api/templates/testcases` 또는 `GET /api/templates/features` 호출. **404 또는 네트워크 실패 시** `fetchTemplateFromApi` 내부에서 `getTestcasesTemplateContent()` / `getFeaturesTemplateContent()` 로컬 기본값으로 폴백. 추가로 `generateHtmlFromMarkdownClient`·`generateReportClient`에서 템플릿 로드에 try/catch를 두어 예외 시에도 로컬 기본 템플릿으로 진행.

**HTML 불러와서 생성하는 부분:**  
2단계 2차에서 시스템 프롬프트 = (템플릿 전체 또는 규칙 + 템플릿 본문) + “정리 md를 이 구조에 맞춰 HTML로 출력” 지시, 유저 프롬프트 = `[정리된 보고 내용]` + 정리 md. LLM이 이 입력으로 `\`\`\`html ... \`\`\`` 블록만 출력하면 파싱해 최종 HTML로 사용.  
템플릿 분리 후에도 **API 실패·404 시 로컬 기본 템플릿으로 동일 플로우가 유지**되도록 되어 있음.
