# 정리 md 프롬프트 vs HTML 변수 정의 — 분석

**목적:** 경영진 보고서에서 `{{summary}}`, `{{purpose_background}}` 등 7개 변수가 **정리 md를 만드는 프롬프트**에 정의되어 있는지 점검.

---

## 1. 정리 md 생성 쪽 (1단계)

**파일:** `docmaster-web/src/lib/prompts/executiveTeam.ts`  
**프롬프트:** `DEFAULT_PROMPT_EXECUTIVE_EDITABLE` (및 `_EN`)

**필수 출력 항목**은 아래처럼 **자연어 제목 + 설명**만 있다.

| 번호 | 정리 md 프롬프트에 적힌 내용 | 변수명 노출 여부 |
|------|------------------------------|-------------------|
| 1 | Executive Summary (핵심 요약): 불릿으로… | **없음** |
| 2 | 목적/배경: why, 무엇을 목표로… | **없음** |
| 3 | 핵심 변경사항/정책 요약/핵심 요건: … | **없음** |
| 4 | 전체 프로세스 흐름도: … | **없음** |
| 5 | 우선순위 개선 권장사항: … | **없음** |
| 6 | 리스크·검증포인트: … | **없음** |
| 7 | 최종 슬라이드: 결론·승인 요청·다음 액션 | **없음** |

- `summary`, `purpose_background`, `key_changes`, `process_flow`, `recommendations`, `risks`, `action_item` 같은 **변수명(키)은 1단계 프롬프트에 전혀 등장하지 않는다.**
- "이 7개 섹션이 나중에 HTML 변수 {{summary}}, {{purpose_background}} … 와 1:1 대응한다"는 **명시도 없다.**

---

## 2. HTML 쪽 (2단계)

**같은 파일·스타일 가이드:**

- `DEFAULT_HTML_STYLE_GUIDE`: 슬라이드·변수 매핑에서 `{{summary}}`, `{{purpose_background}}`, … 7개 **변수명**과 의미가 정의됨.
- `HTML_FIXED_EXECUTIVE`: "변수 매핑: {{summary}}, {{purpose_background}}, …" 로 **변수 목록**만 나열.
- `SECTION_KEYS`: `['summary', 'purpose_background', 'key_changes', 'process_flow', 'recommendations', 'risks', 'action_item']` — 코드 상의 키 정의.

즉, **변수(키) 정의는 전부 2단계(HTML/스타일 가이드·C방식 추출) 쪽에만 있다.**

---

## 3. 실제 매핑이 어떻게 이루어지는지

### 3.1 default 템플릿 (C방식)

- **진입:** `templateId === 'default'` 일 때 `generateSectionContentFromRefinedMdClient` 호출.
- **동작:** 정리 md 전문을 넣고, **SECTION_CONTENT_SYSTEM_KO/EN** 프롬프트로 "아래 7개 **키**에 대해 [정리된 보고 내용]의 해당 섹션을 HTML 조각으로 채우세요" 요청.
- **SECTION_CONTENT_SYSTEM** 안에는 `summary`, `purpose_background`, … **키 이름**과 각각의 의미(핵심 요약, 목적/배경, …)가 **명시**되어 있음.
- 따라서 **2단계(섹션 추출) 단계**에서만 7개 변수명이 정의되고, 정리 md의 “어느 블록이 summary인지” 등을 LLM이 **의미·순서**로 추론해 JSON으로 채움.

### 3.2 그 외 템플릿 (스타일 가이드 방식)

- **진입:** `templateId !== 'default'` (phase1, wiki, preformat 등)일 때 `generateHtmlFromMarkdownClient`에서 **정리 md 전체** + **[HTML 형식 스타일 가이드]** 를 넘김.
- **스타일 가이드**에는 "1) {{summary}} — 슬라이드 1. 핵심 요약", "2) {{purpose_background}} — 슬라이드 2. 목적/배경", … 처럼 **변수와 의미**가 적혀 있음.
- **정리 md**에는 변수명이 없으므로, LLM이 정리 md의 **섹션 제목·순서·내용**만 보고 “첫 번째 큰 블록 = summary, 두 번째 = purpose_background, …” 식으로 **추론**해서 HTML 변수에 채움.

---

## 4. 정리

| 질문 | 답 |
|------|----|
| `{{summary}}`, `{{purpose_background}}` 등이 **정리 md 만드는 프롬프트**에 정의돼 있나? | **아니오.** 1단계 프롬프트에는 **섹션 제목(자연어)** 만 있고, 변수명·계약은 없음. |
| 변수명은 어디에 정의돼 있나? | **2단계** 쪽에만 있음: HTML 스타일 가이드, HTML_FIXED_EXECUTIVE, SECTION_KEYS, SECTION_CONTENT_SYSTEM( C방식). |
| 그래서 개선 전 구조 맞나? | **맞다.** 1단계와 2단계가 **같은 순서·비슷한 제목**으로 “의미적으로만” 맞춰져 있고, **“이 7개 섹션 = 이 7개 변수”라는 계약이 정리 md 프롬프트에는 없다.** |

**리스크:**  
정리 md에서 LLM이 섹션 **순서를 바꾸거나**, **제목을 다르게** 쓰면(예: "결론 및 다음 액션", "Next steps" 등) 2단계에서 `{{action_item}}` 등과의 매핑이 어긋날 수 있음.  
개선하려면 **정리 md 프롬프트**에 “아래 7개 항목은 이후 HTML 변수 summary, purpose_background, key_changes, process_flow, recommendations, risks, action_item에 각각 대응하므로, **이 순서와 제목을 유지**할 것” 같은 문구를 넣거나, 각 항목 옆에 **(→ {{summary}})** 처럼 변수명을 병기하는 방식을 검토할 수 있음.

---

## 5. "경영진용 — HTML 출력 시 자동 적용 (수정 불가)" 블록 사용 여부

**질문:** UI에 보이는 `HTML_FIXED_EXECUTIVE`(수정 불가 블록)가 실제로 쓰이는가?

**결론:** **경영진 보고서 (기본)** 을 선택했을 때는 **사용되지 않는다.**

| 구간 | templateId | HTML_FIXED_EXECUTIVE 사용? |
|------|------------|----------------------------|
| 1단계 정리 md | (공통) | **아니오.** `getDefaultExecutiveEditable()`만 사용 → 편집 가능부만 전달. |
| 2단계 HTML | **default** | **아니오.** C방식: 섹션 JSON 추출 + 스켈레톤 치환. 이 경로에서는 `htmlFixed`를 참조하지 않고 early return. |
| 2단계 HTML | phase1, wiki, preformat 등 | **예.** `editablePart + htmlFixed + templateContent + ...` 로 시스템 프롬프트 조립 후 LLM 호출. |

따라서 **기본 포맷**으로 경영진 보고서를 만들 때는 1단계·2단계 모두 수정 불가 블록이 **전달되지 않는다.** 수정 불가 블록이 실제로 쓰이는 경우는 **다른 포맷(phase1, wiki, preformat 등)** 을 골랐을 때의 2단계 HTML 생성뿐이다. UI(프롬프트 편집 모달)에서는 "경영진용 — HTML 출력 시 자동 적용"으로 **참고용** 노출만 되고, 기본 선택 시 생성 파이프라인에는 포함되지 않는다.
