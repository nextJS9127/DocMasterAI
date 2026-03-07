# 맞춤 질문 플로우 (정리 md 초안 → 질문 → 반영 → 최종)

## 목적
사용자 의도가 반영된 결과물을 만들기 위해, **정리 md 초안**이 만들어진 직후 사용자에게 **초안 기준 구체 질문**을 하고, 선택한 내용을 반영해 **최종 정리 md**를 만든 뒤 HTML을 생성한다.

## 전제
- **대상**: 경영진용(executive) / 실무용(team) 2단계 파이프라인만 해당.  
  (기존 정리 md 재사용 시에는 질문 단계 생략 → HTML만 재생성)
- **질문**: 초안 내용을 기준으로 “어떤 포인트를 강조할지” 등 **구체적인 선택지**만 제공.
- **선택**: 사용자는 **선택지 중 하나만 고름**(텍스트 입력 없음). 건너뛰기 가능.

---

## 플로우 개요

```
[파싱 완료]
     ↓
[보고서 생성 클릭] (경영진/실무, HTML 포맷)
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. 정리 md 초안 생성 (generateRefinedMarkdownClient)         │
│    → refinedMd                                               │
└─────────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 초안 기반 맞춤 질문 생성 (generateCustomizationQuestions) │
│    → questions[] (id, text, options: { id, label })          │
└─────────────────────────────────────────────────────────────┘
     ↓
  questions.length > 0 ?
     ├─ 예 → 로딩 숨김, [맞춤 질문 팝업] 표시
     │         ├─ [건너뛰기] → refinedMd 그대로 4번으로
     │         └─ [반영하여 계속] → answers 수집
     │                   ↓
     │         ┌─────────────────────────────────────────────┐
     │         │ 3. 선택 반영 정리 md (refineMarkdownWithAnswers) │
     │         │    → finalRefinedMd                          │
     │         └─────────────────────────────────────────────┘
     │                   ↓
     └─ 아니오(질문 없음) → refinedMd 그대로 4번으로
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 정리 md → HTML (generateHtmlFromMarkdownClient)           │
│    입력: finalRefinedMd (또는 refinedMd)                      │
│    → reportHtml, reportMarkdown = finalRefinedMd              │
└─────────────────────────────────────────────────────────────┘
     ↓
[보고서 완료]
```

---

## 상태 정리

| 시점 | appStep | loadingContext | customizationDraft |
|------|---------|----------------|--------------------|
| 1단계 진행 중 | generating | { phase: 'generating', fileName } | null |
| 초안 완료, 질문 생성 중 | generating | 동일 (또는 문구만 변경) | null |
| 질문 팝업 표시 | generating | null | { refinedMd, questions, ... } |
| 건너뛰기 후 HTML 생성 중 | generating | { phase: 'generating', fileName } | null |
| 선택 반영 중 | generating | { phase: 'generating', fileName } | null |
| HTML 생성 완료 | parsed | null | null |

---

## 데이터 구조

- **CustomizationQuestion**: `{ id: string, text: string, options: { id: string, label: string }[] }`
- **customizationDraft**:  
  `{ refinedMd, questions, usage1?, templateId, reportType, llmProvider, llmKey, highQuality, apiBaseUrl }`
- **answers**: `Record<questionId, optionId>`

---

## 예외 처리

- 질문 생성 실패 또는 questions 빈 배열 → 초안 그대로 4단계(HTML 생성)로 진행.
- 선택 반영(refine) 실패 → 에러 알림 후 초안(refinedMd)으로 4단계 진행하거나 재시도 유도.
