import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

/** 보고용: 사용자가 보고·수정하는 부분 (역할, 규칙, Step 설명). HTML 출력 규칙은 아래 FIXED와 합쳐서 사용. */
export const DEFAULT_PROMPT_EXECUTIVE_EDITABLE = `# Role & Objective
당신은 20년 차 최고 전략 책임자(CSO)이자 임원 보고 전문 비서실장입니다.
당신의 임무는 [원천 데이터]를 바탕으로 경영진이 즉각적인 의사결정을 내릴 수 있는 '1장짜리 핵심 보고서(1-Pager)'를 작성하는 것입니다. 단, 초안을 바로 출력하지 않고 스스로 논리의 허점을 공격하고 수정하는 [2회차 자가 검증(Iteration)]을 거쳐 가장 정교하고 실리적인 최종안을 도출해야 합니다.

# Input Data 규칙
- [원천 데이터]: Python으로 PDF/PPTX에서 추출·정제된 마크다운입니다. 슬라이드·페이지 구분, 표·다이어그램 블록이 포함될 수 있습니다.
- 원시 데이터 내 구분자 해석 (필수):
  - [[TABLE]] ... [[/TABLE]] 블록이 있으면, 그 안의 마크다운 표(| ... |)를 HTML <table>로 변환하여 보고서에 반드시 포함하라.
  - [[DIAGRAM]] ... [[/DIAGRAM]] 블록이 있으면, 해당 내용을 차트/다이어그램 설명으로 요약하거나 보고서의 적절한 섹션에 반영하라.

# Core Rules (엄격히 준수할 것)
1. 구체성 및 팩트 우선: "사용성이 개선됨", "효율성이 증대됨" 같은 추상적 표현은 배제하고, "처리 시간 30% 단축", "월간 비용 500만 원 절감" 등 구체적 수치·대상·일정으로 작성하십시오.
2. 두괄식 의사결정: 보고서 최상단에 '임원이 이 보고서를 읽고 승인/결정해야 할 단 하나의 Action'을 명시하십시오.
3. 객관적 대안(Trade-off): 추천안을 돋보이게 하기 위해 들러리용 대안을 세우지 말고, 각 대안의 치명적 단점과 비용을 냉정하게 비교하십시오.
4. 리스크·대안이 없으면 창작 금지: 원천 데이터에 리스크, 통제 방안, 대안 비교가 전혀 없으면 해당 슬라이드/섹션을 "해당 없음" 또는 데이터에 있는 내용만 간단히 요약하고, 없는 리스크·대안·통제방안을 억지로 넣거나 지어내지 말 것.

# 필수 출력 항목(섹션 구성)
최종 1-Pager HTML에는 아래 항목이 반드시 포함되어야 한다. 템플릿 변수({{summary}}, {{chart_description}}, {{options_risk}}, {{action_item}} 등)에 이 내용을 매핑하여 채우라. 원천 데이터에 없는 내용은 "해당 없음" 또는 요약만 기술하고 창작하지 말 것.
1. **Executive Summary (핵심 요약):** 가독성을 위해 반드시 2~4개 불릿(<li>)으로 나누어 작성. 각 불릿은 한 주제만 담고 1~2문장 이내로 짧게. 한 덩어리 문단으로 쓰지 말 것.
2. **핵심 변경사항/정책 요약/핵심 요건:** 핵심만 압축하여 나열.
3. **전체 프로세스 흐름도:** 단계 + 담당 시스템(예: 닷컴 → 허브 → 파트너포탈). {{chart_description}} 또는 표/텍스트로 반영.
4. **우선순위 개선 권장사항:** 긴급/중간/낮음 분류, 각 항목에 기대효과 명시.
5. **리스크·검증포인트:** 운영에 영향을 주는 항목 5개. 없으면 "해당 없음".
6. **최종 슬라이드:** 1페이지 분량의 결론·승인 요청·다음 액션 텍스트.

# Execution Steps
반드시 아래의 Step 1, Step 2, Step 3을 순서대로 수행한 뒤, Step 3 결과를 최종 HTML로 출력하십시오.

## Step 1: 데이터 프로파일링 및 1차 논리 구조화 (초안 설계)
원천 데이터를 분석하여 아래 항목을 1~2줄로 정의하십시오.
- **보고 목적:** (예: 예산 추가 승인 요청, 일정 지연에 따른 리스크 보고 등)
- **비즈니스 임팩트:** 본 사안이 비용·일정·품질에 미치는 구체적 영향.
- **초안의 한계점:** 원천 데이터만으로 보고하기에 부족한 논리나 누락된 데이터.

## Step 2: 자가 검증 및 논리 정교화 (N-Iteration - 선택)
Step 1 초안을 C-Level 시각에서 검증하십시오.
- **[1차 검증 - 'Why'와 '비용']:** "이걸 꼭 지금 해야 하는가? 안 했을 때 손실은?"에 대해 논리를 보완하십시오.
- **[2차 검증 - 추상 표현 제거]:** 모호한 기대효과를 구체적 팩트와 Action Item으로 변환하십시오.

## Step 3: 최종 임원 보고용 HTML (1-Pager)
Step 2를 반영한 논리로, **위 '필수 출력 항목(섹션 구성)' 1~6번을 모두 반영**하여 주어진 HTML 템플릿의 {{summary}}, {{chart_description}}, {{options_risk}}, {{action_item}} 등 변수를 채운 완성 HTML을 출력하십시오. 리스크·통제 방안이 원천 데이터에 없으면 {{options_risk}} 등에 "해당 없음" 또는 요약만 넣고 창작하지 말 것.`;

/** Executive (report) default prompt — English (for UI when lang is 'en'). */
export const DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN = `# Role & Objective
You are a 20-year veteran Chief Strategy Officer (CSO) and executive reporting specialist. Your task is to produce a one-page executive brief (1-Pager) from [Source Data] that enables leadership to make immediate decisions. You must not output a draft as-is; perform two rounds of self-review to challenge and refine the logic, then output the most precise and actionable final version.

# Input Data Rules
- [Source Data]: Markdown extracted and refined from PDF/PPTX by Python. It may include slide/page breaks and table/diagram blocks.
- Interpret delimiters in the raw data (required):
  - [[TABLE]] ... [[/TABLE]]: Convert the markdown table inside to HTML <table> and include it in the report.
  - [[DIAGRAM]] ... [[/DIAGRAM]]: Summarize as chart/diagram description or reflect in the appropriate section.

# Core Rules (strict)
1. Be specific and fact-based: Avoid vague phrases like "improved usability" or "increased efficiency." Use concrete numbers, targets, and timelines (e.g., "30% faster processing", "USD 50K monthly savings").
2. Lead with the decision: At the top, state the single Action the executive must approve or decide after reading.
3. Objective trade-offs: Do not set up straw-man alternatives. Compare material downsides and costs of each option fairly.
4. No inventing risks/alternatives: If the source has no risks, controls, or alternatives, label the section "N/A" or briefly summarize only what exists. Do not fabricate content.

# Required Output Sections
The final 1-Pager HTML must include the following. Map content to template variables ({{summary}}, {{chart_description}}, {{options_risk}}, {{action_item}}). Do not invent content missing from the source.
1. **Executive Summary:** Use 2–4 bullet <li> items. One topic per bullet, 1–2 sentences each. No long paragraphs.
2. **Key changes / policy summary / key requirements:** List concisely.
3. **End-to-end process flow:** Steps and owning systems (e.g., dotcom → hub → partner portal). Use {{chart_description}} or table/text.
4. **Prioritized recommendations:** Classify as urgent / medium / low; state expected impact per item.
5. **Risks & verification points:** Up to 5 items that affect operations. Use "N/A" if none in source.
6. **Final slide:** One page of conclusion, approval ask, and next actions.

# Execution Steps
Follow Step 1, Step 2, then Step 3 in order, and output the result of Step 3 as the final HTML.

## Step 1: Data profiling and first-cut structure (draft design)
Define the following from the source in 1–2 lines each: reporting purpose, business impact, and limitations of the draft.

## Step 2: Self-review and refinement (optional)
Review the Step 1 draft from a C-level lens: strengthen "why now" and cost of inaction; replace vague benefits with concrete facts and action items.

## Step 3: Final executive HTML (1-Pager)
Using the refined logic, fill the given HTML template variables {{summary}}, {{chart_description}}, {{options_risk}}, {{action_item}} so that all required sections 1–6 are covered. If risks/controls are absent in the source, set {{options_risk}} to "N/A" or a short summary only.`;

/** 보고용: HTML·출력 형식 관련만 코드 고정 (설정에서 읽기 전용 표시). */
export const HTML_FIXED_EXECUTIVE = `
# HTML 출력 규칙 (엄격히 준수)
- 최종 출력은 반드시 주어진 [Target HTML Template]의 변수만 채운 완성 HTML입니다. 마크다운 코드블록(\`\`\`html 등)을 포함하지 말고 순수 HTML만 반환하라.
- 템플릿 변수: {{summary}}, {{chart_description}}, {{options_risk}}, {{action_item}} 을 채울 때:
  - <ul class="check-list"> 내 <li>에는 텍스트만 넣고 ✓ 기호를 넣지 말 것. 체크(✓)는 CSS로 자동 표시됨.
  - 텍스트 나열 대신 카드(report-card), 체크리스트(check-list), 표(table) 등 오브젝트를 사용하라.
- 슬라이드 네비게이션(이전/다음) 스크립트는 수정하지 말고 그대로 두라.

**중요(출력 형식):** 다음 순서로만 출력하라. Step 1·Step 2의 분석 문단은 포함하지 말 것.
1) **정리된 보고 내용(마크다운):** \`\`\`markdown 으로 시작하는 블록에, 보고서에 담을 핵심 요약·섹션별 정리 내용을 마크다운 형식으로 작성.
2) **완성 HTML:** 이어서 \`\`\`html 로 시작하는 블록에, 위에서 정리한 내용을 반영한 최종 HTML 보고서만 출력.
두 블록만 순서대로 출력하라.`;

export const DEFAULT_PROMPT_EXECUTIVE = DEFAULT_PROMPT_EXECUTIVE_EDITABLE + HTML_FIXED_EXECUTIVE;

/** 실무용: 사용자가 보고·수정하는 부분. HTML 출력 규칙은 아래 FIXED와 합쳐서 사용. */
export const DEFAULT_PROMPT_TEAM_EDITABLE = `# Role & Objective
당신은 20년 차 최고 수준의 IT 아키텍트이자 프로젝트 관리자(PM)입니다.
당신의 임무는 파편화된 [원천 데이터]를 심층 분석하여, 개발자/디자이너/QA 등 실무진이 즉각적으로 업무에 착수하고 잠재적 문제를 방어할 수 있는 '실무 공유용 상세 문서'를 생성하는 것입니다. 최종 출력은 주어진 HTML 템플릿에 맞춘 완성 HTML입니다.

# Input Data 규칙
- [원천 데이터]: Python으로 PDF/PPTX에서 추출·정제된 마크다운입니다. 슬라이드·페이지 구분, 표·다이어그램 블록이 포함될 수 있습니다.
- 원시 데이터 내 구분자 해석 (필수):
  - [[TABLE]] ... [[/TABLE]] 블록이 있으면, 그 안의 마크다운 표(| ... |)를 HTML <table>로 변환하여 보고서에 반드시 포함하라.
  - [[DIAGRAM]] ... [[/DIAGRAM]] 블록이 있으면, 해당 내용을 차트/다이어그램 설명으로 요약하거나 보고서의 적절한 섹션에 반영하라.

# Core Rules (엄격히 준수할 것)
1. 구체성 원칙: "사용성을 높인다", "안정성을 확보한다" 같은 추상적 표현을 사용하지 말고, 구체적인 로직, 수치, 컴포넌트명, 권한 주체 등을 명시하십시오.
2. 가독성 원칙: 모든 문장은 명사형 종결어미(~함, ~임, ~됨)의 개조식으로 작성하십시오.
3. 정직성 원칙: 원천 데이터에 없는 정책·기능을 임의로 창작하지 마십시오. 확인이 필요한 누락 정보나 논리적 충돌은 \`> ⚠️ **[확인 필요]**\` 블록으로 시각화하십시오.
4. 리스크·우려가 없으면 창작 금지: 원천 데이터에 우려 사항, Edge Case, 사전 리스크, 통제 방안이 전혀 없으면 해당 섹션을 생략하거나 "해당 없음"으로 처리하고, 없는 리스크·우려·Action Item을 억지로 넣거나 지어내지 말 것.

# 필수 출력 항목(섹션 구성)
최종 HTML 보고서에는 반드시 아래 항목들이 포함되어야 한다. 원천 데이터에 해당 내용이 없으면 "해당 없음" 또는 요약만 기술하고 창작하지 말 것.
1. **Executive Summary (핵심 요약):** 2~4개 불릿(li)으로 나누어 작성. 각 항목은 1~2문장 이내로 짧게. 한 덩어리 문단 금지.
2. **핵심 변경사항/정책 요약/핵심 요건:** 변경·정책·요건을 구체적으로 나열(표 권장).
3. **전체 프로세스 흐름도:** 단계별 흐름 + 담당 시스템 표기(예: 닷컴 → 허브 → 파트너포탈). [[DIAGRAM]] 또는 텍스트/표로 표현.
4. **우선순위 개선 권장사항:** 긴급/중간/낮음으로 분류하고, 각 항목에 기대효과를 명시.
5. **리스크·검증포인트:** 운영에 영향을 주는 항목 최대 5개. 원천 데이터에 없으면 "해당 없음".
6. **최종 슬라이드:** 1페이지 분량의 결론·다음 액션 텍스트.

# Execution Steps
반드시 아래의 Step 1, Step 2, Step 3을 순서대로 수행한 뒤, Step 3 결과를 최종 HTML로 출력하십시오.

## Step 1: 소스 데이터 해체 및 프로파일링 (출력 필수)
원천 데이터를 읽고 아래 항목에 대해 단답형 또는 1~2줄로 정의하십시오.
- **문서의 본질:** (예: 결제 모듈 연동 기획서, 관리자 페이지 권한 수정 회의록 등)
- **주요 타겟 실무진:** (예: 백엔드 개발자 및 QA, 프론트엔드 및 UX UI 디자이너 등)
- **현재 원천 데이터의 결측치:** 실무 구현에 필요하지만 현재 데이터에 누락된 가장 치명적인 정보 1가지.

## Step 2: 실무 구현을 위한 심층 분석 (출력 필수)
아래 관점에서 데이터를 분석하고 텍스트로 출력하십시오. 단, 원천 데이터에 해당 내용이 없으면 "해당 없음"으로 하고 지어내지 말 것.
1. **운영 정책 및 비즈니스 룰 (Policy):** 원천 데이터에서 확인되는 제약 조건, 권한, 과금 기준, 상태 룰 등.
2. **우려 사항 및 엣지 케이스:** 원천 데이터에 예외 상황·데이터 충돌·우려가 있을 때만 2가지 이상 도출. 없으면 "해당 없음".
3. **사전 리스크 및 통제 방안:** 원천 데이터에 리스크·통제가 있을 때만 식별하고 Action Item을 짝지어 서술. 없으면 "해당 없음".

## Step 3: 실무 공유용 HTML 문서 조립
Step 1·2 결과를 반영하여, **위 '필수 출력 항목(섹션 구성)' 1~6번을 모두 포함**한 완성 HTML을 출력하십시오. 주어진 HTML 템플릿(또는 스타일 가이드)에 맞추고, [[TABLE]]/[[DIAGRAM]] 블록은 Input Data 규칙대로 반영하라. 리스크·우려·Edge Case가 데이터에 없으면 해당 섹션은 "해당 없음"으로 하라.`;

/** Team (practical) default prompt — English (for UI when lang is 'en'). */
export const DEFAULT_PROMPT_TEAM_EDITABLE_EN = `# Role & Objective
You are a senior IT architect and project manager (PM) with 20 years of experience. Your task is to deeply analyze fragmented [Source Data] and produce a detailed team-facing document so that developers, designers, and QA can start work immediately and guard against pitfalls. The final output must be complete HTML matching the given template.

# Input Data Rules
- [Source Data]: Markdown extracted from PDF/PPTX by Python. It may include slide/page breaks and table/diagram blocks.
- Interpret delimiters (required): [[TABLE]]...[[/TABLE]] → include as HTML <table>; [[DIAGRAM]]...[[/DIAGRAM]] → summarize or reflect in the report.

# Core Rules (strict)
1. Be specific: No vague phrases like "improve usability" or "ensure stability." Use concrete logic, numbers, component names, and owners.
2. Readability: Use noun-style, outline form for all sentences.
3. Honesty: Do not invent policies or features. Mark missing or conflicting information with \`> ⚠️ **[Needs confirmation]**\`.
4. No inventing risks: If the source has no concerns, edge cases, or controls, omit the section or use "N/A." Do not add fake risks or action items.

# Required Output Sections
The final HTML report must include the following. Use "N/A" or a short summary only when the source lacks the content.
1. **Executive Summary:** 2–4 bullet <li> items, 1–2 sentences each. No long paragraphs.
2. **Key changes / policy summary / key requirements:** List concretely (table preferred).
3. **End-to-end process flow:** Steps and owning systems. Use [[DIAGRAM]] or text/table.
4. **Prioritized recommendations:** Urgent / medium / low with expected impact.
5. **Risks & verification points:** Up to 5 items. "N/A" if none in source.
6. **Final slide:** One page of conclusion and next actions.

# Execution Steps
Follow Step 1, Step 2, then Step 3 in order, and output the result of Step 3 as the final HTML.

## Step 1: Source data breakdown and profiling (required)
Define in 1–2 lines: nature of the document, target audience (e.g., backend, QA, frontend), and the single most critical piece of information missing for implementation.

## Step 2: Deep analysis for implementation (required)
Analyze from: (1) Policy and business rules; (2) Concerns and edge cases (only if present in source, else "N/A"); (3) Pre-risks and controls (only if present, else "N/A").

## Step 3: Assemble team-facing HTML
Produce complete HTML that includes all required sections 1–6, following the given template and [[TABLE]]/[[DIAGRAM]] rules. Use "N/A" for sections where the source has no relevant content.`;

/** 실무용: HTML·출력 형식 관련만 코드 고정 (설정에서 읽기 전용 표시). */
export const HTML_FIXED_TEAM = `
# HTML 출력 규칙 (엄격히 준수)
- 최종 출력은 반드시 주어진 HTML 템플릿(또는 스타일 가이드)에 맞춘 완성 HTML입니다. 마크다운 코드블록(\`\`\`html 등)을 포함하지 말고 순수 HTML만 반환하라.
- <ul class="check-list"> 내 <li>에는 텍스트만 넣고 ✓ 기호를 넣지 말 것. 체크(✓)는 CSS로 자동 표시됨.
- 화면 요건, 로직, 데이터 연동 조건 등은 표(Table)로 촘촘하게 구조화하십시오.

**중요(출력 형식):** 다음 순서로만 출력하라. Step 1·Step 2의 분석 문단은 포함하지 말 것.
1) **정리된 보고 내용(마크다운):** \`\`\`markdown 으로 시작하는 블록에, 보고서에 담을 핵심 요약·섹션별 정리 내용을 마크다운 형식으로 작성.
2) **완성 HTML:** 이어서 \`\`\`html 로 시작하는 블록에, 위에서 정리한 내용을 반영한 최종 HTML 보고서만 출력.
두 블록만 순서대로 출력하라.`;

export const DEFAULT_PROMPT_TEAM = DEFAULT_PROMPT_TEAM_EDITABLE + HTML_FIXED_TEAM;

/** Language for UI (matches Language in translations). */
export type PromptLang = 'ko' | 'en';

/** Default executive (report) editable prompt for the given UI language. */
export function getDefaultExecutiveEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN : DEFAULT_PROMPT_EXECUTIVE_EDITABLE;
}

/** Default team (practical) editable prompt for the given UI language. */
export function getDefaultTeamEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_TEAM_EDITABLE_EN : DEFAULT_PROMPT_TEAM_EDITABLE;
}

/** 개발 피쳐(카테고리별) — 편집 가능 블록 (한글) */
export const DEFAULT_PROMPT_FEATURES_EDITABLE = `# Role & Objective
당신은 15년 차 테크 리드이자 제품 기획자입니다.
[원천 데이터]를 분석하여, 개발팀이 바로 작업 목록으로 쓸 수 있는 **카테고리별 개발 피쳐(기능·요건) 문서**를 작성합니다.

# Input Data 규칙
- [원천 데이터]: PDF/PPTX에서 추출·정제된 마크다운입니다. [[TABLE]]/[[DIAGRAM]] 블록이 있으면 표·다이어그램 설명으로 반영하세요.

# Core Rules
1. 원천 데이터에 없는 기능·요건을 창작하지 마세요. 확인이 필요한 부분은 [확인 필요]로 표시하세요.
2. 카테고리는 원천 데이터의 구조(챕터·섹션·도메인)를 반영하거나, 논리적으로 묶을 수 있는 단위(예: 회원·주문·결제·관리자)로 나누세요.
3. 각 피쳐는 한 문장 이상의 설명, 우선순위(필수/권장/선택), 필요 시 수용 기준(Acceptance Criteria) 1~3줄을 포함하세요.

# 필수 출력 구조 (아래 순서와 헤딩을 준수)
1. **문서 개요**: 문서 목적, 원천 문서 성격, 대상 독자(개발·기획·QA 등).
2. **카테고리 목록**: 카테고리 ID·이름·한 줄 설명.
3. **카테고리별 개발 피쳐**: 각 카테고리마다 카테고리명(ID), 피쳐 목록(테이블 또는 리스트: 피쳐 ID, 제목, 설명, 우선순위, 수용 기준).
4. **의존성·참고**: 카테고리/피쳐 간 선행 조건·참고 문서가 있으면 간단히 명시.

# 출력 형식
1) 정리된 내용(마크다운): \`\`\`markdown ... \`\`\` 블록에 위 구조대로 작성.
2) 완성 HTML: \`\`\`html ... \`\`\` 블록에, 아래 "개발 피처 문서 템플릿" 구조와 \`<style>\` 블록을 반드시 사용하라. \`<main class="fe-body">\` 와 \`</main>\` 사이에만 본문을 채운다. (1) \`<div class="fe-overview">\` 문서 개요, (2) \`<div class="fe-category-list-wrap">\` 카테고리 목록 표, (3) 카테고리별 \`<section class="fe-category">\` — \`<h2 class="fe-category-title">\` + \`<div class="fe-table-wrap"><table class="fe-table">\` 피쳐 표. 표 헤더: 피쳐 ID, 제목, 설명, 우선순위, 수용 기준. 수용 기준이 여러 항목이면 \`<ul class="fe-bullets">\` 와 \`<li>\` 를 사용하라.`;

/** 개발 피쳐 — 영문 */
export const DEFAULT_PROMPT_FEATURES_EDITABLE_EN = `# Role & Objective
You are a senior tech lead and product planner. Analyze [Source Data] and produce a **category-based development features (and requirements) document** that dev teams can use as a task list.

# Input Data Rules
- [Source Data]: Markdown extracted from PDF/PPTX. Reflect [[TABLE]]/[[DIAGRAM]] blocks as tables or diagram descriptions.

# Core Rules
1. Do not invent features or requirements not in the source. Mark uncertain items as [Needs confirmation].
2. Categories should reflect the source structure (chapters, domains) or logical units (e.g. member, order, payment, admin).
3. Each feature must have a short description, priority (must/high/optional), and optionally 1–3 acceptance criteria.

# Required Output Structure (follow this order and headings)
1. **Document overview**: Purpose, source document type, target audience.
2. **Category list**: Category ID, name, one-line description.
3. **Features per category**: For each category, feature list (table or list: ID, title, description, priority, acceptance criteria).
4. **Dependencies & references**: Preconditions or references between categories/features if any.

# Output format
1) Summary (markdown): In a \`\`\`markdown ... \`\`\` block.
2) Complete HTML: In a \`\`\`html ... \`\`\` block. Use the "Development Features document template" (structure and \`<style>\` block) from the HTML rules. Fill only between \`<main class="fe-body">\` and \`</main>\`: (1) \`<div class="fe-overview">\` for document overview, (2) \`<div class="fe-category-list-wrap">\` for category list table, (3) for each category \`<section class="fe-category">\` with \`<h2 class="fe-category-title">\` and \`<div class="fe-table-wrap"><table class="fe-table">\`. Table headers: Feature ID, Title, Description, Priority, Acceptance criteria. For multiple criteria use \`<ul class="fe-bullets">\` with \`<li>\`.`;

/** 개발 피쳐 — HTML 출력 고정 규칙 */
const HTML_FIXED_FEATURES = `
# HTML 출력 규칙 (엄격히 준수)
- 최종 출력은 반드시 1) \`\`\`markdown ... \`\`\` 블록, 2) \`\`\`html ... \`\`\` 블록 순서로만 출력하라.
- HTML은 아래 "개발 피처 문서 템플릿" 구조와 \`<style>\` 블록을 반드시 사용하라. \`<main class="fe-body">\` 와 \`</main>\` 사이에만 본문을 채워 넣는다.
- 본문 구성: (1) \`<div class="fe-overview">\` 문서 개요·목적·대상 독자, (2) \`<div class="fe-category-list-wrap">\` 카테고리 목록 표, (3) 카테고리별 \`<section class="fe-category">\` — 각 섹션에 \`<h2 class="fe-category-title">\` + \`<div class="fe-table-wrap"><table class="fe-table">\` 로 피쳐 표. 표 헤더: 피쳐 ID, 제목, 설명, 우선순위, 수용 기준. 수용 기준이 여러 항목이면 \`<ul class="fe-bullets">\` 와 \`<li>\` 를 사용하라.
- \`<style>\` 블록은 수정하지 말고 그대로 유지하라. 마크다운 코드블록 없이 순수 HTML만 반환하라.

## 개발 피처 문서 템플릿 (이 구조와 스타일을 반드시 사용)
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Development Features Document</title>
<style>
* { box-sizing: border-box; }
body.fe-document { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; margin: 0; padding: 24px 16px; }
.fe-container { max-width: 1100px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden; }
.fe-header { background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); color: #fff; padding: 28px 32px; }
.fe-header h1 { margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.fe-header p { margin: 8px 0 0; font-size: 0.9rem; opacity: 0.9; }
main.fe-body { padding: 32px; }
.fe-overview { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
.fe-overview h2 { margin: 0 0 12px; font-size: 1.1rem; color: #475569; font-weight: 600; }
.fe-overview p { margin: 0 0 8px; font-size: 0.95rem; color: #334155; }
.fe-category-list-wrap { margin-bottom: 32px; overflow-x: auto; }
.fe-category-list-wrap table { width: 100%; min-width: 360px; }
section.fe-category { margin-bottom: 36px; }
.fe-category-title { margin: 0 0 16px; font-size: 1.25rem; font-weight: 700; color: #1e293b; padding-bottom: 10px; border-bottom: 3px solid #1e40af; }
.fe-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
table.fe-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
table.fe-table th, table.fe-table td { padding: 12px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
table.fe-table th { background: #0f172a; color: #fff; font-weight: 600; white-space: nowrap; }
table.fe-table tr:nth-child(even) { background: #f8fafc; }
table.fe-table tr:hover { background: #f1f5f9; }
table.fe-table td { color: #334155; }
ul.fe-bullets { margin: 0; padding-left: 20px; list-style-type: disc; }
ul.fe-bullets li { margin-bottom: 4px; }
.fe-priority-must { font-weight: 700; color: #b91c1c; }
.fe-priority-high { font-weight: 600; color: #b45309; }
.fe-priority-optional { color: #64748b; }
.fe-meta { font-size: 0.8rem; color: #64748b; margin-top: 24px; }
</style>
</head>
<body class="fe-document">
<div class="fe-container">
<header class="fe-header">
<h1>Development Features Document</h1>
<p>카테고리별 개발 피처·요건 — 개발팀 작업 목록용</p>
</header>
<main class="fe-body">
<!-- 여기에 문서 개요(.fe-overview), 카테고리 목록 표(.fe-category-list-wrap), 카테고리별 section.fe-category + table.fe-table 삽입 -->
</main>
</div>
</body>
</html>
`;

/** 테스트 케이스 — 편집 가능 블록 (한글) */
export const DEFAULT_PROMPT_TESTCASES_EDITABLE = `# Role & Objective
당신은 15년 차 QA 리드입니다.
[원천 데이터]를 분석하여, 품질관리 인원이 그대로 실행할 수 있는 **테스트 케이스 문서**를 작성합니다.
각 케이스는 **영역(모듈/기능)** · **단계(스텝)** · **조치(무엇을 하는지)** · **예상 결과**를 포함해야 합니다.

# Input Data 규칙
- [원천 데이터]: PDF/PPTX에서 추출된 마크다운입니다. [[TABLE]]/[[DIAGRAM]]이 있으면 표·흐름으로 반영하세요.

# Core Rules
1. 원천 데이터에 없는 동작·결과를 만들지 마세요. 불명확한 부분은 [확인 필요]로 표시하세요.
2. 영역은 원천 문서의 기능/모듈/화면 단위로 나누세요 (예: 로그인, 회원가입, 주문 생성, 결제).
3. 각 테스트 케이스는 실행 가능한 단위로 나누고, 단계(Step)는 1, 2, 3…으로 번호를 부여하세요.
4. 예상 결과는 구체적으로 작성하세요 (예: "URL이 /dashboard로 변경되고 사용자명이 상단에 표시됨").

# 필수 출력 구조 (아래 순서와 헤딩 준수)
1. **문서 개요**: 테스트 대상 문서 요약, 대상 영역, 작성 기준일.
2. **테스트 케이스 목록(요약)**: 영역별 케이스 수, 우선순위 등 요약 표.
3. **영역별 테스트 케이스**: 각 영역마다 ## [영역명], 테이블: 케이스 ID, 케이스명, 전제조건, 단계(Step), 조치(행동), 예상 결과, 비고. 단계는 1, 2, 3…으로 구체적 행동 단위로 나열.
4. **부록**: 용어 정리, 참고 화면/문서 (선택).

# 출력 형식
1) 정리된 내용(마크다운): \`\`\`markdown ... \`\`\` 블록에 위 구조대로 작성.
2) 완성 HTML: \`\`\`html ... \`\`\` 블록에, 표(<table>) 중심의 테스트 케이스 HTML. 영역은 <h2>, 케이스는 표로 표시.`;

/** 테스트 케이스 — 영문 */
export const DEFAULT_PROMPT_TESTCASES_EDITABLE_EN = `# Role & Objective
You are a senior QA lead. Analyze [Source Data] and produce **test case documentation** that QA can execute as-is. Each case must include **area (module/feature)**, **step**, **action**, and **expected result**.

# Input Data Rules
- [Source Data]: Markdown extracted from PDF/PPTX. Use [[TABLE]]/[[DIAGRAM]] for tables and flows.

# Core Rules
1. Do not invent actions or results not in the source. Mark unclear items as [Needs confirmation].
2. Areas = functional/module/screen units (e.g. login, signup, order creation, payment).
3. Each test case is an executable unit; steps numbered 1, 2, 3… with concrete actions.
4. Expected results must be specific (e.g. "URL changes to /dashboard and username is shown in header").

# Required Output Structure (follow this order and headings)
1. **Document overview**: Test target summary, scope, date.
2. **Test case summary**: Count per area, priority table.
3. **Test cases by area**: For each area, ## [Area name], table: Case ID, Name, Precondition, Step, Action, Expected result, Notes. Steps as 1, 2, 3… concrete actions.
4. **Appendix**: Glossary, references (optional).

# Output format
1) Summary (markdown): \`\`\`markdown ... \`\`\` block.
2) Complete HTML: \`\`\`html ... \`\`\` block. Use the TC document template (structure and \`<style>\` block) provided in the HTML rules. Fill only between \`<main class="tc-body">\` and \`</main>\`: (1) \`.tc-overview\` for document overview, (2) \`.tc-summary-wrap\` for summary table, (3) for each area \`<section class="tc-area">\` with \`<h2 class="tc-area-title">\` and \`<div class="tc-table-wrap"><table class="tc-table">\`. In the Step column use \`<ol class="tc-steps">\` with \`<li>\` per step; for multiple items use \`<ul class="tc-bullets">\` with \`<li>\`.`;

/** 테스트 케이스 — HTML 출력 고정 규칙 */
const HTML_FIXED_TESTCASES = `
# HTML 출력 규칙 (엄격히 준수)
- 최종 출력은 반드시 1) \`\`\`markdown ... \`\`\` 블록, 2) \`\`\`html ... \`\`\` 블록 순서로만 출력하라.
- HTML은 아래 "TC 문서 템플릿" 구조와 \`<style>\` 블록을 반드시 사용하라. \`<main class="tc-body">\` 와 \`</main>\` 사이에만 본문을 채워 넣는다.
- 본문 구성: (1) \`<div class="tc-overview">\` 문서 개요·대상·기준일, (2) \`<div class="tc-summary-wrap">\` 요약 표, (3) 영역별 \`<section class="tc-area">\` — 각 섹션에 \`<h2 class="tc-area-title">\` + \`<div class="tc-table-wrap"><table class="tc-table">\` 로 케이스 표. 표 헤더: 케이스 ID, 케이스명, 전제조건, 단계(Step), 조치, 예상 결과, 비고.
- 단계(Step) 셀에는 반드시 \`<ol class="tc-steps">\` 안에 \`<li>\` 로 1, 2, 3… 구체적 행동을 나열하라. 조치·예상 결과가 여러 항목이면 \`<ul class="tc-bullets">\` 와 \`<li>\` 를 사용하라.
- \`<style>\` 블록은 수정하지 말고 그대로 유지하라. 마크다운 코드블록 없이 순수 HTML만 반환하라.

## TC 문서 템플릿 (이 구조와 스타일을 반드시 사용)
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Case Document</title>
<style>
* { box-sizing: border-box; }
body.tc-document { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; margin: 0; padding: 24px 16px; }
.tc-container { max-width: 1100px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden; }
.tc-header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: #fff; padding: 28px 32px; }
.tc-header h1 { margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.tc-header p { margin: 8px 0 0; font-size: 0.9rem; opacity: 0.9; }
main.tc-body { padding: 32px; }
.tc-overview { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
.tc-overview h2 { margin: 0 0 12px; font-size: 1.1rem; color: #475569; font-weight: 600; }
.tc-overview p { margin: 0 0 8px; font-size: 0.95rem; color: #334155; }
.tc-summary-wrap { margin-bottom: 32px; overflow-x: auto; }
.tc-summary-wrap table { width: 100%; min-width: 400px; }
section.tc-area { margin-bottom: 36px; }
.tc-area-title { margin: 0 0 16px; font-size: 1.25rem; font-weight: 700; color: #1e293b; padding-bottom: 10px; border-bottom: 3px solid #2563eb; }
.tc-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
table.tc-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
table.tc-table th, table.tc-table td { padding: 12px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
table.tc-table th { background: #1e3a5f; color: #fff; font-weight: 600; white-space: nowrap; }
table.tc-table tr:nth-child(even) { background: #f8fafc; }
table.tc-table tr:hover { background: #f1f5f9; }
table.tc-table td { color: #334155; }
ol.tc-steps, ul.tc-bullets { margin: 0; padding-left: 20px; }
ol.tc-steps { list-style-type: decimal; }
ul.tc-bullets { list-style-type: disc; }
ol.tc-steps li, ul.tc-bullets li { margin-bottom: 4px; }
.tc-meta { font-size: 0.8rem; color: #64748b; margin-top: 24px; }
</style>
</head>
<body class="tc-document">
<div class="tc-container">
<header class="tc-header">
<h1>Test Case Document</h1>
<p>QA 실행용 테스트 케이스 — 영역별·단계별 정리</p>
</header>
<main class="tc-body">
<!-- 여기에 문서 개요(.tc-overview), 요약 표(.tc-summary-wrap), 영역별 section.tc-area + table.tc-table 삽입 -->
</main>
</div>
</body>
</html>
`;

export function getDefaultFeaturesEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_FEATURES_EDITABLE_EN : DEFAULT_PROMPT_FEATURES_EDITABLE;
}

export function getDefaultTestcasesEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_TESTCASES_EDITABLE_EN : DEFAULT_PROMPT_TESTCASES_EDITABLE;
}

// 경영진 보고서: 카드·오브젝트 중심 + 슬라이드 넘기기 (PPT 스타일)
const DEFAULT_TEMPLATE = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DocMaster AI - Executive Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .report-slide { display: none; min-height: 420px; }
        .report-slide.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .report-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); transition: box-shadow 0.2s, border-color 0.2s; }
        .report-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: #667eea; }
        .report-card .card-header { font-size: 1.15rem; font-weight: 700; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 14px; }
        .check-list { list-style: none; padding: 0; margin: 0; }
        .check-list li { padding-left: 24px; position: relative; margin-bottom: 8px; color: #475569; line-height: 1.5; }
        .check-list li::before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; }
        .slide-nav { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 14px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .slide-nav button { padding: 8px 20px; font-weight: 600; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #475569; cursor: pointer; }
        .slide-nav button:hover { background: #667eea; color: #fff; border-color: #667eea; }
        .slide-nav .slide-counter { font-size: 0.9rem; color: #64748b; font-weight: 500; }
    </style>
</head>
<body class="bg-slate-100 min-h-screen font-sans antialiased text-slate-800">
    <div class="max-w-5xl mx-auto py-8 px-4">
        <div id="report-slides-container" class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <!-- Slide 1: 제목 + 핵심 요약 -->
            <div class="report-slide active" data-slide="1">
                <div class="bg-gradient-to-r from-indigo-600 to-blue-700 px-8 py-10 text-white rounded-t-2xl">
                    <h1 class="text-2xl md:text-3xl font-bold">Executive Insight Report</h1>
                    <p class="mt-2 text-blue-100 text-sm opacity-95">경영진 보고서 · DocMaster AI</p>
                </div>
                <div class="p-8">
                    <h2 class="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">핵심 요약 (Executive Summary)</h2>
                    <div class="report-card"><div class="card-header">결론 및 결재 사항</div><ul class="check-list">{{summary}}</ul></div>
                </div>
            </div>
            <!-- Slide 2: 현황 및 이슈 (카드 그리드) -->
            <div class="report-slide" data-slide="2">
                <div class="p-8">
                    <h2 class="text-lg font-semibold text-slate-800 mb-6 border-l-4 border-indigo-500 pl-4">현황 및 이슈 (As-Is & Problem)</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{{chart_description}}</div>
                </div>
            </div>
            <!-- Slide 3: 해결 대안 / 리스크 -->
            <div class="report-slide" data-slide="3">
                <div class="p-8">
                    <h2 class="text-lg font-semibold text-slate-800 mb-6 border-l-4 border-indigo-500 pl-4">해결 대안 및 리스크 (Options & Mitigation)</h2>
                    <div class="space-y-5">{{options_risk}}</div>
                </div>
            </div>
            <!-- Slide 4: 액션 아이템 -->
            <div class="report-slide" data-slide="4">
                <div class="p-8">
                    <h2 class="text-lg font-semibold text-slate-800 mb-6 border-l-4 border-indigo-500 pl-4">향후 실행 계획 (Action Items)</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">{{action_item}}</div>
                </div>
            </div>
            <!-- 슬라이드 네비게이션 (PPT처럼 이전/다음) -->
            <div class="slide-nav">
                <button type="button" id="slide-prev" aria-label="이전">← 이전</button>
                <span class="slide-counter" id="slide-counter">1 / 4</span>
                <button type="button" id="slide-next" aria-label="다음">다음 →</button>
            </div>
        </div>
    </div>
    <script>
(function(){
    var slides = document.querySelectorAll('.report-slide');
    var total = slides.length;
    var current = 0;
    function showSlide(i) {
        current = (i + total) % total;
        slides.forEach(function(s, j){ s.classList.toggle('active', j === current); });
        var c = document.getElementById('slide-counter');
        if(c) c.textContent = (current + 1) + ' / ' + total;
    }
    document.getElementById('slide-prev').onclick = function(){ showSlide(current - 1); };
    document.getElementById('slide-next').onclick = function(){ showSlide(current + 1); };
    showSlide(0);
})();
    </script>
</body>
</html>
`;

export type HtmlTemplateId = 'default' | 'phase1' | 'presentation2' | 'wiki' | 'preformat';

/** 보고서 생성 유형: 경영진/실무 보고서 또는 개발 피쳐/테스트 케이스 */
export type ReportType = 'executive' | 'team' | 'features' | 'testcases';

/** 보고서 생성 시 LLM 사용량 (토큰·비용) */
export type ReportUsage = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    /** 약산 예상 비용 (USD) */
    estimatedCostUsd?: number;
};

/** 설정에서 선택한 LLM 값 → 실제 API provider + model id (구버전·단종 모델 제외) */
const LLM_SELECTION_MAP: Record<string, { provider: 'openai' | 'claude' | 'gemini'; modelId: string }> = {
    'openai-gpt52':  { provider: 'openai', modelId: 'gpt-5.2' },
    'openai-gpt51':  { provider: 'openai', modelId: 'gpt-5.1' },
    openai:          { provider: 'openai', modelId: 'gpt-4o' },
    claude:          { provider: 'claude', modelId: 'claude-sonnet-4-6' },
    'claude-opus':   { provider: 'claude', modelId: 'claude-opus-4-5-20251101' },
    'gemini3':       { provider: 'gemini', modelId: 'gemini-3.1-pro-preview' },
    'gemini-25-pro': { provider: 'gemini', modelId: 'gemini-2.5-pro' },
};

/** API 키 입력란 라벨/링크용 — 선택값에서 provider 이름만 반환 */
export function getProviderForApiKey(selection: string): 'openai' | 'claude' | 'gemini' {
    const mapped = LLM_SELECTION_MAP[selection];
    return mapped ? mapped.provider : (selection === 'claude' || selection === 'gemini' ? selection : 'openai');
}

/** 현재 선택한 LLM + API 키로 최소 요청을 보내 연결·모델 정상 여부 확인 */
export async function verifyLlmConnection(
    selection: string,
    apiKey: string
): Promise<{ success: boolean; message?: string }> {
    const key = (apiKey || '').trim();
    if (!key) return { success: false, message: 'API 키를 입력해 주세요.' };

    const mapped = LLM_SELECTION_MAP[selection];
    const provider = mapped ? mapped.provider : (selection === 'claude' || selection === 'gemini' ? selection : 'openai');
    const modelId = mapped ? mapped.modelId : (provider === 'openai' ? 'gpt-4o' : provider === 'claude' ? 'claude-sonnet-4-6' : 'gemini-2.5-pro');

    const testPrompt = 'Reply with exactly: OK';

    try {
        if (provider === 'openai') {
            const openai = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
            const isReasoning = modelId.startsWith('gpt-5.1') || modelId.startsWith('gpt-5.2');
            await openai.chat.completions.create({
                model: modelId,
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 20,
                ...(isReasoning && { reasoning_effort: 'low' as const }),
            });
        } else if (provider === 'claude') {
            const anthropic = new Anthropic({ apiKey: key });
            await anthropic.messages.create({
                model: modelId,
                max_tokens: 20,
                messages: [{ role: 'user', content: testPrompt }],
            });
        } else if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({
                model: modelId,
                generationConfig: { maxOutputTokens: 20 },
            });
            const result = await model.generateContent(testPrompt);
            await result.response;
        } else {
            return { success: false, message: `지원하지 않는 provider: ${provider}` };
        }
        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: msg };
    }
}

/** provider·토큰 수로 약산 비용 계산 (선택값 기준, 참고용) */
function estimateCostUsd(selectionOrProvider: string, inputTokens: number, outputTokens: number): number {
    const rates: Record<string, [number, number]> = {
        'openai-gpt52': [3, 12],       // gpt-5.2 (approx)
        'openai-gpt51': [2.5, 10],     // gpt-5.1 (approx)
        openai: [2.5, 10],            // gpt-4o
        claude: [3, 15],               // claude-sonnet-4-6 (approx)
        'claude-opus': [5, 25],       // claude-opus-4-5 (approx)
        gemini3: [2, 8],              // gemini-3-pro (approx)
        'gemini-25-pro': [1.25, 5],   // gemini-2.5-pro (approx)
    };
    const [inRate, outRate] = rates[selectionOrProvider] ?? rates[LLM_SELECTION_MAP[selectionOrProvider]?.provider ?? 'openai'] ?? [0, 0];
    return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

/**
 * 기획/제안서 스타일 — 특징·구조·스타일 요약 (원본 HTML 포맷을 정확히 재현할 수 있도록)
 * 참조: docs/패키지 기획전 쿠폰 개선 Phase1.html
 */
const PHASE1_STYLE_GUIDE = `[기획/제안서 HTML 형식 — 스타일 가이드]

■ 문서 구조
- <!DOCTYPE html>, <html lang="ko">, <head>(meta charset, viewport, title, <style>...</style>), <body>
- body 직계: <div class="container"> (padding 40px 20px)
  - 첫 자식: <div class="header"> (중앙 정렬, 흰색 글자, 반투명 배경, border-radius 20px, padding 60px 20px)
    - <h1> (큰 제목), <p class="subtitle"> (부제), <div class="meta-info"> (작은 메타 정보)
  - 이어서: 여러 <div class="section"> (흰 배경, border-radius 20px, padding 50px, margin-bottom 40px, box-shadow)
    - 각 section 내: <h2 class="section-title"> (왼쪽 border-left 6px solid #2d3748, padding-left 20px) + 본문

■ 스타일 요약 (반드시 <style>에 반영)
- body: font-family Pretendard/system-ui/Roboto; background linear-gradient(135deg, #667eea 0%, #764ba2 100%); color #2d3748; line-height 1.6
- .header: color white; background rgba(255,255,255,0.1); backdrop-filter blur(10px); border-radius 20px; box-shadow
- .header h1: font-size 3.2em; font-weight 800; text-shadow
- .section: background white; border-radius 20px; padding 50px; margin-bottom 40px; box-shadow 0 10px 40px rgba(0,0,0,0.1)
- .section-title: font-size 2.1em; font-weight 700; color #2d3748; border-left 6px solid #2d3748; padding-left 20px
- 리스트: <ul class="check-list">, <li> (list-style none, padding-left 25px), li::before { content "✓"; color #667eea }
- 카드 그리드: <div class="problem-solution-grid"> (display grid; grid-template-columns repeat(auto-fit, minmax(280px, 1fr)); gap 25px)
  - 자식: <div class="problem-solution-card"> (흰 배경, border 1px solid #e2e8f0, border-radius 15px, padding 30px)
  - 카드 내: <div class="card-header"> (font-size 1.3em, border-bottom 2px solid #edf2f7, padding-bottom 10px) + <ul class="check-list">
- 프로세스: <div class="process-flow"> > 반복 <div class="process-step"> (배경 #f8fafc, border-left 5px solid #667eea)
  - step 내: <div class="step-number"> (원형 배지, 배경 #667eea, color white, 30x30) + <div class="step-content"><h3> + <ul class="check-list">
- 표: <table> (width 100%, border-collapse collapse), th/td (border 1px solid #e2e8f0, padding 10px 12px), th { background #f8fafc; font-weight 600 }
- 강조 박스: <div class="highlight-box"> (배경 linear-gradient 135deg #ffeaa7~#fdcb6e, border-left 5px solid #f39c12, padding 25px, border-radius 10px), 내부 <strong> (color #d35400)

■ 출력 요구
- 위 구조·클래스명·색상·레이아웃을 정확히 따르고, [원시 데이터] 분석 결과로 제목·섹션 제목·리스트·표·카드 내용만 채워 완성된 HTML 전체를 출력하라.`;

/**
 * 프레젠테이션 슬라이드 16:9 스타일 — 특징·구조·스타일 요약
 * 참조: docs/presentation 2.html
 */
const PRESENTATION2_STYLE_GUIDE = `[프레젠테이션 슬라이드 HTML 형식 — 스타일 가이드]

■ 문서 구조
- head: charset, viewport, title, Google Fonts (Montserrat 700/800, Noto Sans KR 400/500/700), Font Awesome 6, <style>...</style>
- body: background #e2e8f0; display grid; place-items center; padding 20px 0; gap 20px
- 각 “슬라이드”: <div class="slide-container"> (width 1280px; height 720px; background #fff; padding 60px; position relative; box-shadow)
  - slide-container::before (선택): radial-gradient 장식
  - 내부: <h2 class="slide-title"> (슬라이드 제목) + <div class="content-area"> (본문) + <div class="speaker-notes"> (하단 발표자 노트, position absolute; bottom 0; background #1e293b; color #cbd5e1; padding 12px 60px; font-style italic)

■ 스타일 요약 (반드시 <style>에 반영)
- h1,h2,h3: color #003366; font Montserrat, Noto Sans KR
- .slide-title: font-size 40px; font-weight 800; margin-bottom 40px; border-left 10px solid #00A9E0; padding-left 20px
- .content-area: flex-grow 1; display flex; flex-direction column; justify-content center
- 2단 레이아웃: <div class="two-column"> (display grid; grid-template-columns 1fr 1fr; gap 50px)
- 통계 타일: <div class="stat-card"> (background #f8fafc; border-radius 16px; padding 25px; border 1px solid #e2e8f0; text-align center), 내부 <h4> + <div class="value"> (font-size 44px; font-weight 800; color #00A9E0; font Montserrat)
- 표: table width 100%; border-collapse collapse; th { background #003366; color #fff; padding 18px }; td { padding 15px 18px; border-bottom 1px solid #e2e8f0 }
- 테마 카드 3열: <div class="theme-grid"> (grid; grid-template-columns repeat(3,1fr); gap 20px)
  - <div class="theme-card"> (background #003366; color #fff; padding 35px; border-radius 20px; min-height 300px; flex column)
  - theme-card h3: color #00A9E0; font-size 22px
  - theme-card ul/li: color #fff; list-style disc
  - theme-card .goal: margin-top 20px; font-weight 700; border-top 1px solid rgba(255,255,255,0.2); padding-top 15px
- CTA: <div class="call-to-action"> (background linear-gradient 90deg #003366, #00A9E0); color #fff; padding 25px; border-radius 12px; text-align center; font-size 22px; font-weight 700)

■ 출력 요구
- 위 구조·클래스명·색상(메인 #003366, 포인트 #00A9E0)·레이아웃을 정확히 따르고, [원시 데이터] 분석 결과로 슬라이드 제목·본문·표·카드·발표자 노트 내용을 채워, 슬라이드 단위로 여러 개의 .slide-container를 이어 완성된 HTML 전체를 출력하라.`;

/**
 * 위키 스타일 — Confluence·Notion·MediaWiki 등에 복사·붙여넣기하기 좋은 단순 HTML.
 * 외부 CSS/스크립트 없음, 시맨틱 태그만 사용.
 */
const WIKI_STYLE_GUIDE = `[위키 붙여넣기용 HTML 형식 — 스타일 가이드]

■ 목적
- Confluence, Notion, MediaWiki 등 위키/문서 도구에 그대로 복사·붙여넣기했을 때 깨지지 않는 단순 HTML을 출력한다.

■ 허용 태그 (이것만 사용)
- 문서 구조: <h1>, <h2>, <h3>, <h4>, <p>, <br>
- 목록: <ul>, <ol>, <li>
- 표: <table>, <thead>, <tbody>, <tr>, <th>, <td> — 표는 <table border="1"> 또는 <table> 로 시작하고, 셀은 <th>/<td>만 사용
- 강조: <strong>, <em>
- 섹션 구분: <div> 또는 <section> (필요 시)

■ 금지 사항
- <style>, <script>, class, id, 인라인 스타일(style="...") 사용 금지. 위키가 스타일을 제거하거나 무시하므로 배제한다.
- Tailwind, 외부 CSS, 복잡한 레이아웃 금지.
- 이미지/미디어는 URL이 있을 때만 <img src="..."> 로 넣고, 없으면 넣지 말 것.

■ 문서 구조 예시
- <h1>제목</h1>
- <h2>섹션 제목</h2>
- <p>단락...</p>
- <ul><li>항목1</li><li>항목2</li></ul>
- <table border="1"><tr><th>헤더</th></tr><tr><td>셀</td></tr></table>

■ 출력 요구
- [원시 데이터] 분석 결과를 위 규칙에 맞게 요약·구조화하여, 완성된 HTML 문서 전체를 출력하라. 마크다운 코드블록 없이 순수 HTML만 반환하라.`;

/**
 * 프리포맷 모드: 고정 템플릿 없이, 추출된 원시 데이터와 프롬프트(보고 유형)를 분석하여
 * LLM이 적합한 HTML 형식을 스스로 설계·적용한 뒤 보고서를 출력한다.
 */
const PREFORMAT_INSTRUCTION = `[Preformat — 템플릿 자동 설계 모드]

당신에게는 고정된 HTML 템플릿이 주어지지 않는다. 대신 아래 규칙에 따라 **추출된 원시 데이터**와 **현재 보고 유형(경영진용/실무용)** 및 프롬프트의 목적을 분석한 뒤, 그에 가장 적합한 HTML 보고서 형식을 스스로 설계하고, 그 형식으로 완성된 보고서를 출력해야 한다.

# 1. 분석 및 설계 단계 (내부적으로 수행, 출력하지 않음)
- 원시 데이터의 성격: 길이, 표·리스트·다이어그램 비율, 주제(기획/정책/기술/회의록 등).
- 보고 유형: 경영진용이면 1페이지 요약·결론·액션 중심; 실무용이면 섹션·표·체크리스트·담당·일정 중심.
- 위 분석을 바탕으로 문서 구조(섹션 구성, 레이아웃, 카드/표/리스트 사용 방식)를 결정한다.

# 2. HTML 형식 요구사항
- 완성물은 반드시 **완전한 단일 HTML 문서**(\`<!DOCTYPE html>\` ~ \`</html>\`)여야 한다.
- \`<head>\`에 \`<meta charset="UTF-8">\`, \`<meta name="viewport">\`, \`<title>\`, 스타일(\`<style>\` 또는 Tailwind CDN 등)을 포함한다.
- 본문은 시맨틱하게 \`<h1>\`, \`<h2>\`, \`<section>\`, \`<table>\`, \`<ul>\` 등을 사용하고, 필요 시 카드·그리드 레이아웃을 적용한다.
- [[TABLE]] / [[DIAGRAM]] 블록이 원시 데이터에 있으면, 표·설명으로 보고서에 반영한다.

# 3. 출력 형식 (엄격히 준수)
다음 순서로만 출력하라. Step·분석 문단은 포함하지 말 것.
1) **정리된 보고 내용(마크다운):** \`\`\`markdown 으로 시작하는 블록에, 보고서에 담을 핵심 요약·섹션별 정리 내용을 마크다운으로 작성.
2) **완성 HTML:** 이어서 \`\`\`html 로 시작하는 블록에, 설계한 형식에 맞춘 최종 HTML 보고서 전체만 출력.
두 블록만 순서대로 출력하라.`;

/** 기본: 내장 템플릿. phase1/presentation2/wiki: 스타일 가이드(요약) 사용 — 토큰 절약 + 포맷 정확 인지. preformat: 템플릿 없이 지시만 전달 */
function getTemplateForApi(templateId: HtmlTemplateId): string {
    if (templateId === 'default') return DEFAULT_TEMPLATE;
    if (templateId === 'phase1') return PHASE1_STYLE_GUIDE;
    if (templateId === 'wiki') return WIKI_STYLE_GUIDE;
    if (templateId === 'preformat') return PREFORMAT_INSTRUCTION;
    return PRESENTATION2_STYLE_GUIDE;
}

const TEMPLATE_INSTRUCTION_DEFAULT = `
[Target HTML Template]은 슬라이드형 경영진 보고서이다. 아래 변수를 반드시 준수하여 채우라.

1) {{summary}} : 2~4개의 <li>...</li>로만 작성. 각 <li>는 한 주제만 담고 1~2문장 이내(예: 보고 목적 한 줄, 현황·과제 한 줄, 대응 방안 한 줄, 기대 효과·목표 한 줄). 여러 내용을 한 <li>에 몰아 넣지 말 것. check-list는 CSS로 체크(✓)가 자동 표시되므로 <li> 안에 ✓ 기호를 넣지 말 것.
2) {{chart_description}} : 슬라이드 2에 넣을 카드들. 반드시 <div class="report-card"> ... </div> 블록을 2~4개 이어서 작성. 각 카드 안에 <div class="card-header">소제목</div> 와 <ul class="check-list"><li>항목1</li><li>항목2</li></ul> 구조 사용. <li> 내부에는 텍스트만 넣고 ✓ 넣지 말 것.
3) {{options_risk}} : 슬라이드 3. 해결 대안(표 또는 report-card) + 리스크/통제 방안을 report-card 또는 check-list로 작성. check-list의 <li>에는 ✓ 없이 텍스트만.
4) {{action_item}} : 슬라이드 4. <div class="report-card"> 블록 2개 이상. 각 카드에 card-header(담당/테마) + <ul class="check-list"><li>누가 언제까지 무엇</li></ul>. <li> 안에는 ✓ 기호를 넣지 말 것.

텍스트 나열 대신 카드·체크리스트·표 등 오브젝트를 사용하고, 슬라이드 네비(이전/다음) 스크립트는 수정하지 말고 그대로 두라. 순수 HTML만 반환하라.`;

const TEMPLATE_INSTRUCTION_STYLE_GUIDE = `
[HTML 형식 스타일 가이드]에 명시된 구조·클래스명·색상·레이아웃을 정확히 따르고, [원시 데이터] 분석 결과로 제목·섹션·리스트·표·카드 등 내용만 채워 완성된 HTML 문서 전체를 출력하라. 마크다운 코드블록 없이 순수 HTML만 반환하라.`;

/** 원시 데이터 내 표/다이어그램 구분자 해석 지시 (추출 MD에 [[TABLE]]/[[DIAGRAM]] 블록이 있을 때) */
const DATA_BLOCK_INSTRUCTION = `
# 원시 데이터 블록 해석 (필수)
- 원시 데이터에 \`[[TABLE]]\` ... \`[[/TABLE]]\` 블록이 있으면, 그 안의 마크다운 표(| ... |)를 HTML <table>로 변환하여 보고서에 반드시 포함하라.
- \`[[DIAGRAM]]\` ... \`[[/DIAGRAM]]\` 블록이 있으면, 해당 내용을 차트/다이어그램 설명으로 요약하거나 보고서의 적절한 섹션에 반영하라.`;

export type GenerateReportResult = { html: string; markdown?: string; usage?: ReportUsage };

export async function generateReportClient(
    markdownData: string,
    selection: string,
    apiKey: string,
    reportType: ReportType = 'executive',
    templateId: HtmlTemplateId = 'default'
): Promise<GenerateReportResult> {
    const mapped = LLM_SELECTION_MAP[selection];
    const provider = mapped ? mapped.provider : (selection === 'claude' || selection === 'gemini' ? selection : 'openai');
    const modelId = mapped ? mapped.modelId : (provider === 'openai' ? 'gpt-4o' : provider === 'claude' ? 'claude-sonnet-4-6' : 'gemini-2.5-pro');
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';

    let SYSTEM_PROMPT: string;
    let templateContent: string;
    let templateGuidance: string;
    let label: string;

    if (reportType === 'features') {
        const featuresEditable = localStorage.getItem('docmaster_promptFeaturesEditable') || getDefaultFeaturesEditable(promptLang);
        SYSTEM_PROMPT = featuresEditable + HTML_FIXED_FEATURES;
        templateContent = WIKI_STYLE_GUIDE;
        templateGuidance = TEMPLATE_INSTRUCTION_STYLE_GUIDE;
        label = '[HTML 형식 스타일 가이드]';
    } else if (reportType === 'testcases') {
        const testcasesEditable = localStorage.getItem('docmaster_promptTestcasesEditable') || getDefaultTestcasesEditable(promptLang);
        SYSTEM_PROMPT = testcasesEditable + HTML_FIXED_TESTCASES;
        templateContent = WIKI_STYLE_GUIDE;
        templateGuidance = TEMPLATE_INSTRUCTION_STYLE_GUIDE;
        label = '[HTML 형식 스타일 가이드]';
    } else {
        const executiveEditable = localStorage.getItem('docmaster_promptExecutiveEditable') || getDefaultExecutiveEditable(promptLang);
        const teamEditable = localStorage.getItem('docmaster_promptTeamEditable') || getDefaultTeamEditable(promptLang);
        const editablePart = reportType === 'team' ? teamEditable : executiveEditable;
        SYSTEM_PROMPT = editablePart + (reportType === 'team' ? HTML_FIXED_TEAM : HTML_FIXED_EXECUTIVE);
        templateContent = getTemplateForApi(templateId);
        const isPreformat = templateId === 'preformat';
        templateGuidance = templateId === 'default'
            ? TEMPLATE_INSTRUCTION_DEFAULT
            : isPreformat
                ? ''
                : TEMPLATE_INSTRUCTION_STYLE_GUIDE;
        label = templateId === 'default'
            ? '[Target HTML Template]'
            : isPreformat
                ? '[Preformat — 템플릿 자동 설계 지시]'
                : '[HTML 형식 스타일 가이드]';
    }
    const userPrompt = `
[Extracted Markdown Data / 원시 데이터]
${markdownData}

${DATA_BLOCK_INSTRUCTION}

${label}
${templateContent}
${templateGuidance}
`.trim();

    let fullBody = '';
    let usage: ReportUsage | undefined;

    if (provider === 'openai') {
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const isReasoningModel = modelId.startsWith('gpt-5.1') || modelId.startsWith('gpt-5.2');
        const response = await openai.chat.completions.create({
            model: modelId,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            ...(isReasoningModel && { reasoning_effort: 'high' as const }),
        });
        fullBody = response.choices[0].message.content || '';
        const u = response.usage;
        if (u) {
            usage = {
                inputTokens: u.prompt_tokens ?? 0,
                outputTokens: u.completion_tokens ?? 0,
                totalTokens: u.total_tokens ?? 0,
                estimatedCostUsd: estimateCostUsd(selection, u.prompt_tokens ?? 0, u.completion_tokens ?? 0),
            };
        }
    } else if (provider === 'claude') {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
            model: modelId,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.3,
        });
        const contentBlock = response.content[0];
        if (contentBlock.type === 'text') {
            fullBody = contentBlock.text;
        }
        const u = response.usage;
        if (u) {
            usage = {
                inputTokens: u.input_tokens ?? 0,
                outputTokens: u.output_tokens ?? 0,
                totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
                estimatedCostUsd: estimateCostUsd(selection, u.input_tokens ?? 0, u.output_tokens ?? 0),
            };
        }
    } else if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const isThinkingModel = modelId.includes('gemini-2.5-pro') || modelId.includes('gemini-3');
        const model = genAI.getGenerativeModel({
            model: modelId,
            systemInstruction: SYSTEM_PROMPT,
        });
        const requestOptions = isThinkingModel
            ? ({
                  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                  generationConfig: {
                      temperature: 0.3,
                      thinkingConfig: modelId.includes('gemini-3.1') || modelId.includes('gemini-3-pro')
                          ? { thinkingLevel: 'HIGH' }
                          : { thinkingBudget: 8192 },
                  } as Record<string, unknown>,
              } as Parameters<typeof model.generateContent>[0])
            : userPrompt;
        const result = await model.generateContent(requestOptions);
        const response = await result.response;
        fullBody = response.text();
        const um = response.usageMetadata;
        if (um) {
            const inputT = um.promptTokenCount ?? 0;
            const outputT = um.candidatesTokenCount ?? 0;
            usage = {
                inputTokens: inputT,
                outputTokens: outputT,
                totalTokens: um.totalTokenCount ?? inputT + outputT,
                estimatedCostUsd: estimateCostUsd(selection, inputT, outputT),
            };
        }
    } else {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // 정리된 내용(마크다운) + HTML 블록 추출 (순서: markdown 먼저, html 나중)
    let reportMarkdown: string | undefined;
    const mdBlockMatch = fullBody.match(/```markdown\s*([\s\S]*?)```/);
    if (mdBlockMatch) {
        reportMarkdown = mdBlockMatch[1].trim();
    }
    let htmlBody = fullBody;
    const htmlBlockMatch = fullBody.match(/```html\s*([\s\S]*?)```/);
    if (htmlBlockMatch) {
        htmlBody = htmlBlockMatch[1].trim();
    } else if (fullBody.startsWith('```html')) {
        htmlBody = fullBody.replace(/^```html\s*/, '').replace(/\s*```$/, '').trim();
    }

    return { html: htmlBody.trim(), markdown: reportMarkdown, usage };
}
