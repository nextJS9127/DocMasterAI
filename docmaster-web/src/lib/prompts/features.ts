/**
 * 개발 피처(카테고리별) — 프롬프트 및 HTML 고정 규칙.
 * 2단계 파이프라인(정리 md → HTML)에서 사용.
 */
import { TEMPLATE_INSTRUCTION_STYLE_GUIDE, type PromptLang } from './executiveTeam';

export type { PromptLang };

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

export const HTML_FIXED_FEATURES = `
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

/** 개발피처 HTML 템플릿 기본값. API에 없으면 이 값을 사용. 템플릿 관리에서 편집·저장 가능. */
export function getFeaturesTemplateContent(): string {
  return HTML_FIXED_FEATURES;
}

export const MD_ONLY_INSTRUCTION_FEATURES = `

# 이 단계의 출력 (필수)
이 단계의 최종 출력은 **정리된 마크다운(개발 피처 목록)만**이다. HTML은 다음 단계에서 별도로 생성된다.
반드시 \`\`\`markdown ... \`\`\` 블록 하나만 출력하라. \`\`\`html\`\`\` 블록은 이 단계에서 출력하지 마라.`;

export function getDefaultFeaturesEditable(lang: PromptLang): string {
  return lang === 'en' ? DEFAULT_PROMPT_FEATURES_EDITABLE_EN : DEFAULT_PROMPT_FEATURES_EDITABLE;
}

/** 개발피처 보고서 1단계: 시스템 프롬프트 + 유저 프롬프트 조합. templateContent는 호출측에서 API 또는 getFeaturesTemplateContent()로 채워 전달. */
export function getReportGenerationConfig(promptLang: PromptLang): {
  SYSTEM_PROMPT: string;
  buildUserPrompt: (markdownData: string, templateContent: string) => string;
} {
  const editable =
    (typeof localStorage !== 'undefined' && localStorage.getItem('docmaster_promptFeaturesEditable')) ||
    getDefaultFeaturesEditable(promptLang);
  const label = '[HTML 형식 스타일 가이드]';
  const templateGuidance = TEMPLATE_INSTRUCTION_STYLE_GUIDE;
  return {
    SYSTEM_PROMPT: editable + HTML_FIXED_FEATURES,
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
