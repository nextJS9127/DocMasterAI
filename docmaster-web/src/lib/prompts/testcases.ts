/**
 * 테스트 케이스 — 프롬프트 및 HTML 고정 규칙.
 * 2단계 파이프라인(정리 md → HTML)에서 사용. 표 헤더·컬럼은 편집 가능 프롬프트 또는 정리 md 기준.
 */
import { TEMPLATE_INSTRUCTION_STYLE_GUIDE, type PromptLang } from './executiveTeam';

export type { PromptLang };

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
5. **조합 도출**: 조건 분기, 플랫폼, 예외 케이스를 고려하여 TC 항목을 생성합니다. 

# 필수 출력 구조 (아래 순서와 헤딩 준수)
1. **문서 개요**: 테스트 대상 문서 요약, 대상 영역, 작성 기준일.
2. **테스트 케이스 목록(요약)**: 영역별 케이스 수, 우선순위 등 요약 표.
3. **영역별 테스트 케이스**: 각 영역마다 ## [영역명], 테이블: 케이스 ID, 케이스명, 전제조건, 단계(Step), 조치(행동), 예상 결과, 비고. 단계는 1, 2, 3…으로 구체적 행동 단위로 나열.
4. **부록**: 용어 정리, 참고 화면/문서 (선택).

# 출력 형식
1) 정리된 내용(마크다운): \`\`\`markdown ... \`\`\` 블록에 위 구조대로 작성.
2) 완성 HTML: \`\`\`html ... \`\`\` 블록에, 표(<table>) 중심의 테스트 케이스 HTML. 영역은 <h2>, 케이스는 표로 표시.`;

export const DEFAULT_PROMPT_TESTCASES_EDITABLE_EN = `# Role & Objective
You are a senior QA lead. Analyze [Source Data] and produce **test case documentation** that QA can execute as-is. Each case must include **area (module/feature)**, **step**, **action**, and **expected result**.

# Input Data Rules
- [Source Data]: Markdown extracted from PDF/PPTX. Use [[TABLE]]/[[DIAGRAM]] for tables and flows.

# Core Rules
1. Do not invent actions or results not in the source. Mark unclear items as [Needs confirmation].
2. Areas = functional/module/screen units (e.g. login, signup, order creation, payment).
3. Each test case is an executable unit; steps numbered 1, 2, 3… with concrete actions.
4. Expected results must be specific (e.g. "URL changes to /dashboard and username is shown in header").
5. **Derive combinations**: Consider condition branches, platform, and exception cases when generating TC items.

# Required Output Structure (follow this order and headings)
1. **Document overview**: Test target summary, scope, date.
2. **Test case summary**: Count per area, priority table.
3. **Test cases by area**: For each area, ## [Area name], table: Case ID, Name, Precondition, Step, Action, Expected result, Notes. Steps as 1, 2, 3… concrete actions.
4. **Appendix**: Glossary, references (optional).

# Output format
1) Summary (markdown): \`\`\`markdown ... \`\`\` block.
2) Complete HTML: \`\`\`html ... \`\`\` block. Use the TC document template (structure and \`<style>\` block) provided in the HTML rules. Fill only between \`<main class="tc-body">\` and \`</main>\`: (1) \`.tc-overview\` for document overview, (2) \`.tc-summary-wrap\` for summary table, (3) for each area \`<section class="tc-area">\` with \`<h2 class="tc-area-title">\` and \`<div class="tc-table-wrap"><table class="tc-table">\`. In the Step column use \`<ol class="tc-steps">\` with \`<li>\` per step; for multiple items use \`<ul class="tc-bullets">\` with \`<li>\`.`;

export const HTML_FIXED_TESTCASES = `
# HTML 출력 규칙 (엄격히 준수)
- 최종 출력은 반드시 1) \`\`\`markdown ... \`\`\` 블록, 2) \`\`\`html ... \`\`\` 블록 순서로만 출력하라.
- HTML은 아래 "TC 문서 템플릿" 구조와 \`<style>\` 블록을 반드시 사용하라. \`<main class="tc-body">\` 와 \`</main>\` 사이에만 본문을 채워 넣는다.
- **표 헤더·컬럼**: 위 [편집 가능한 프롬프트]에서 정의한 컬럼 구조를 **그대로** 따른다. 사용자가 Id, 1~5 depth, Title, Precondition, Test Step Actions, Expected Results, Assignee, Result-PC/MO Web/AOS/iOS, Execution Type, Comment 등 더 많은 컬럼을 정의했으면 **모두 그대로** 반영한다. 7개로 줄이거나 고정하지 말 것.
- 본문 구성: (1) \`<div class="tc-overview">\` 문서 개요·대상·기준일, (2) \`<div class="tc-summary-wrap">\` 요약 표, (3) 영역별 \`<section class="tc-area">\` — 각 섹션에 \`<h2 class="tc-area-title">\` + \`<div class="tc-table-wrap"><table class="tc-table">\` 로 케이스 표. 표의 \`<th>\`·\`<td>\` 컬럼 수와 헤더명은 편집 가능 프롬프트의 정의와 동일하게 둔다.
- 단계/조치/예상 결과 등 목록형 셀에는 \`<ol class="tc-steps">\` 또는 \`<ul class="tc-bullets">\` 와 \`<li>\` 를 사용하라.
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

/** 테스트케이스 HTML 템플릿 기본값. API에 없으면 이 값을 사용. 템플릿 관리에서 편집·저장 가능. */
export function getTestcasesTemplateContent(): string {
  return HTML_FIXED_TESTCASES;
}

export const MD_ONLY_INSTRUCTION_TC = `

# 이 단계의 출력 (필수)
이 단계의 최종 출력은 **정리된 마크다운만**이다. HTML은 다음 단계에서 별도로 생성된다.
반드시 \`\`\`markdown ... \`\`\` 블록 하나만 출력하라. \`\`\`html\`\`\` 블록은 이 단계에서 출력하지 마라.`;

export function getDefaultTestcasesEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_TESTCASES_EDITABLE_EN : DEFAULT_PROMPT_TESTCASES_EDITABLE;
}

/** 테스트케이스 보고서 1단계: 시스템 프롬프트 + 유저 프롬프트 조합. templateContent는 호출측에서 API 또는 getTestcasesTemplateContent()로 채워 전달. */
export function getReportGenerationConfig(promptLang: PromptLang): {
  SYSTEM_PROMPT: string;
  buildUserPrompt: (markdownData: string, templateContent: string) => string;
} {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('docmaster_promptTestcasesEditable') : null;
  const testcasesEditable = (stored != null && stored.trim() !== '') ? stored : getDefaultTestcasesEditable(promptLang);
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.log('[DocMaster] 테스트 케이스 프롬프트:', (stored != null && stored.trim() !== '') ? '등록된 프롬프트 사용' : '기본 프롬프트 사용', (stored != null && stored.trim() !== '') ? `(앞 100자: ${testcasesEditable.slice(0, 100)}…)` : '');
  }
  const label = '[HTML 형식 스타일 가이드]';
  const templateGuidance = TEMPLATE_INSTRUCTION_STYLE_GUIDE;
  return {
    SYSTEM_PROMPT: testcasesEditable + HTML_FIXED_TESTCASES,
    buildUserPrompt(markdownData: string, templateContent: string) {
      return `
[Extracted Markdown Data / 원시 데이터]
${markdownData}

${label}
${templateContent}
${templateGuidance}
`.trim();
    },
  };
}
