# 맞춤 질문 플로우 (원문 → 질문 먼저 → 선택 시 정리 md 1회)

## 목적
사용자 의도가 반영된 결과물을 만들기 위해, **정리 md 초안 없이** 원문만으로 **맞춤 질문을 먼저** 생성하고, 사용자가 선택한 뒤 **선택을 반영한 정리 md를 한 번만** 만든 다음 HTML을 생성한다.  
초안 생성 비용·시간을 줄이고, 질문 단계는 빠른 모델만 사용한다.

## 전제
- **대상**: 경영진용(executive) / 실무용(team) 2단계 파이프라인만 해당.  
  (기존 정리 md 재사용 시에는 질문 단계 생략 → HTML만 재생성)
- **질문**: **원문(추출 md)** 앞부분만 보고 “어떤 포인트를 강조할지” 등 **2~3개 다지선다** 생성. **빠른 모델**(OpenAI 4o, Claude Haiku, Gemini Flash) 사용.
- **선택**: 사용자는 **선택지 중 하나만 고름**(텍스트 입력 없음). 건너뛰기 가능.
- **정리 md**: 질문이 있으면 **제출 시점에만** 원문 + 선택으로 1회 생성. 건너뛰기면 원문만으로 1회 생성.

---

## 플로우 개요

```
[파싱 완료]
     ↓
[보고서 생성 클릭] (경영진/실무, HTML 포맷)
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. 원문 기반 맞춤 질문만 생성 (generateCustomizationQuestionsFromRawClient) │
│    입력: parsedMarkdown (앞 12k자), useFastModel: true       │
│    → questions[] (id, text, options: { id, label })         │
└─────────────────────────────────────────────────────────────┘
     ↓
  questions.length > 0 ?
     ├─ 예 → 로딩 숨김, [맞춤 질문 팝업] 표시 (customizationDraft: rawMarkdown, questions, ...)
     │         ├─ [건너뛰기] → 원문으로 정리 md 1회 생성 (generateRefinedMarkdownClient) → HTML
     │         └─ [반영하여 계속] → answers 수집
     │                   ↓
     │         ┌─────────────────────────────────────────────┐
     │         │ 2. 원문 + 선택으로 정리 md 1회 생성 (generateRefinedMarkdownWithChoicesClient) │
     │         │    → refinedMd                               │
     │         └─────────────────────────────────────────────┘
     │                   ↓
     │         ┌─────────────────────────────────────────────┐
     │         │ 3. 정리 md → HTML (generateHtmlFromMarkdownClient) │
     │         └─────────────────────────────────────────────┘
     └─ 아니오(질문 없음) → 기존처럼 정리 md 생성 → HTML
     ↓
[보고서 완료]
```

---

## 상태·데이터 정리

| 시점 | customizationDraft | 비고 |
|------|--------------------|------|
| 질문 팝업 표시 | { rawMarkdown, questions, usage1?, templateId, reportType, ... } | refinedMd 없음 |
| 건너뛰기 | rawMarkdown으로 generateRefinedMarkdownClient → HTML | 정리 md 1회만 |
| 반영하여 계속 | rawMarkdown + answers로 generateRefinedMarkdownWithChoicesClient → HTML | 정리 md 1회만 |

- **CustomizationQuestion**: `{ id: string, text: string, options: { id: string, label: string }[] }`
- **customizationDraft**:  
  `{ rawMarkdown: string, refinedMd?: string, questions, usage1?, templateId, reportType, llmProvider, llmKey, highQuality, apiBaseUrl }`
- **answers**: `Record<questionId, optionId>`

---

## 프롬프트·함수

- **질문 생성**: `CUSTOMIZATION_QUESTIONS_FROM_RAW_KO/EN` — 원문만 보고 2~3개 다지선다, 선택지는 **서술형 한 문장**, 날카로운 보고서를 위한 명확화 질문 선택.
- **선택 반영 정리 md**: `REFINED_MD_WITH_CHOICES_SYSTEM_KO/EN` — 원문 + [사용자 선택]으로 정리 보고서 마크다운 한 번에 작성.
- **클라이언트**: `generateCustomizationQuestionsFromRawClient`, `generateRefinedMarkdownWithChoicesClient` (llmClient.ts).

---

## 예외 처리

- 질문 생성 실패 또는 questions 빈 배열 → 기존 플로우대로 정리 md 생성 후 HTML 생성.
- 정리 md(건너뛰기/반영) 생성 실패 → 에러 알림 후 재시도 유도.
