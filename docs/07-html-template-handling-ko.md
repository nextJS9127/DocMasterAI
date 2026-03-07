# HTML 템플릿 처리 방식 정리

설정의 **HTML 템플릿 관리** 화면에서 포맷별로 보이는 내용이 다른 이유와, 실제로 어떻게 처리되는지 정리한 문서입니다.

---

## 1. 두 가지 처리 방식

| 구분 | 어떤 포맷 | 관리 화면에 보이는 것 | 실제 처리 |
|-----|-----------|------------------------|-----------|
| **방식 A** | **경영진 보고서 (기본)** `default` | **완전한 HTML** (`<html>`, `<style>`, `<div class="report-slide">` … + `{{summary}}`, `{{purpose_background}}` 등 변수) | LLM에게 "이 HTML의 **변수만** 정리 md 내용으로 채워 넣어라"고 전달. LLM은 **변수 자리만 채우고** 나머지 HTML 구조·스타일은 **그대로 유지**한 채 완성 HTML을 출력. |
| **방식 B** | **기획/제안서**, **프레젠테이션 슬라이드**, **위키**, **Preformat** `phase1`, `presentation2`, `wiki`, `preformat` | **프롬프트/스타일 가이드 형태**의 텍스트 (문서 구조, 클래스명, 색상, 여백, 레이아웃 규칙 등 **설명문**) | LLM에게 "이 **[HTML 형식 스타일 가이드]**와 **[정리된 보고 내용]**을 보고, 가이드에 맞는 **완성 HTML 문서 전체를 생성**하라"고 전달. LLM은 **가이드를 해석해서 HTML을 처음부터 작성**함. 변수 채우기가 아님. |

---

## 2. 왜 이렇게 나뉘어 있나

- **기본 포맷 (`default`)**  
  - 슬라이드 네비게이션, 슬라이드 구조, Tailwind·인라인 스타일이 **한 번 정해진 HTML**으로 있음.  
  - 이걸 그대로 두고 **변수만** 바꾸면 되므로, "HTML 전체"를 템플릿으로 넘기고 **변수 채우기**만 시킴.  
  - 그래서 관리 화면에는 **HTML 태그가 다 들어 있는 한 덩어리**가 보임.

- **나머지 포맷 (`phase1`, `presentation2`, `wiki`, `preformat`)**  
  - 레이아웃·스타일이 포맷마다 다르고, 고정된 HTML 한 개를 두기보다 **“이렇게 만들어라”는 지침(스타일 가이드)**을 주고, LLM이 그에 맞는 HTML을 **생성**하게 함.  
  - 그래서 관리 화면에는 **프롬프트/가이드 문단**이 보이고, "변수만 채우라"가 아니라 "가이드대로 HTML 전체를 작성하라"로 동작함.

---

## 3. 코드 상에서의 구분

- **템플릿 내용 가져오기**  
  **`prompts/executiveTeam.ts`**에 정의된 `getTemplateForApi(templateId)` (및 `getTemplateContentById`). `llmClient.ts`는 이를 import해 사용·re-export함.
  - `default` → `DEFAULT_TEMPLATE` (전체 HTML 문자열)
  - `phase1` → `PHASE1_STYLE_GUIDE` (스타일 가이드 텍스트)
  - `presentation2` → `PRESENTATION2_STYLE_GUIDE`
  - `wiki` → `WIKI_STYLE_GUIDE`
  - `preformat` → `PREFORMAT_INSTRUCTION` (형식 자동 설계 지시)

- **LLM에게 넘길 때**  
  `generateHtmlFromMarkdownClient()` 안에서:
  - `templateId === 'default'` → 라벨 `[Target HTML Template]`, 지시는 `TEMPLATE_INSTRUCTION_DEFAULT` (변수 채우기 등).
  - 그 외 → 라벨 `[HTML 형식 스타일 가이드]`, 지시는 `TEMPLATE_INSTRUCTION_STYLE_GUIDE` (가이드대로 전체 HTML 출력).

- **설정 화면**  
  `TemplateAdminModal`은 `fetchTemplateFromApi(apiBaseUrl, templateId)`로 **저장된 템플릿**을 불러와 그대로 보여줌.  
  API에 저장된 값이 없으면 위 **`getTemplateForApi()`** 결과(코드에 있는 기본값, `prompts/executiveTeam.ts`에 정의)가 쓰이므로, 기본 포맷은 HTML이, 나머지는 스타일 가이드 텍스트가 보이는 구조입니다.

---

## 4. 요약

- **경영진 보고서 (기본)**  
  → 관리 화면: **HTML 전체**.  
  → 처리: **그 HTML의 변수만 채우기** (변수 채우기 방식).

- **그 외 포맷**  
  → 관리 화면: **스타일 가이드/프롬프트 문장**.  
  → 처리: **가이드를 따라 HTML 전체를 생성** (생성 방식).

같은 “HTML 템플릿 관리” UI이지만, **기본만 “HTML 소스 편집”**, **나머지는 “스타일 가이드(프롬프트) 편집”**으로 쓰인다고 보면 됩니다.
