/**
 * DocMaster LLM 클라이언트.
 *
 * ## 보고서 생성 파이프라인 (2단계)
 * 1. 사용자 파일 업로드 → Python 백엔드 POST /parse → 추출 md
 * 2. (2단계 1차) generateRefinedMarkdownClient: 추출 md + 도메인 프롬프트(경영진/실무/테스트케이스/개발피처) → 정리 md
 * 3. (2단계 2차) generateHtmlFromMarkdownClient: 정리 md + HTML 템플릿(API 또는 로컬 기본값) → 최종 HTML
 *
 * 테스트케이스/개발피처: 템플릿은 GET /api/templates/{testcases|features} 또는 로컬 폴백. API 404/실패 시에도 로컬 기본값으로 진행.
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

import {
    DEFAULT_PROMPT_EXECUTIVE_EDITABLE,
    DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN,
    DEFAULT_PROMPT_TEAM_EDITABLE,
    DEFAULT_PROMPT_TEAM_EDITABLE_EN,
    HTML_FIXED_EXECUTIVE,
    HTML_FIXED_TEAM,
    DEFAULT_PROMPT_EXECUTIVE,
    DEFAULT_PROMPT_TEAM,
    getDefaultExecutiveEditable,
    getDefaultTeamEditable,
    SECTION_KEYS,
    getSectionContentSystemPrompt,
    getDefaultHtmlTemplateSkeleton,
    QUALITY_RUBRIC_AND_NO_LOSS,
    MD_OUTPUT_INSTRUCTION_NORMAL,
    MD_OUTPUT_INSTRUCTION_DRAFT_ONLY,
    TEAM_RICH_AND_UNLIMITED_LENGTH,
    CRITIQUE_PROMPT_KO,
    CRITIQUE_PROMPT_EN,
    REVISE_PROMPT_KO,
    REVISE_PROMPT_EN,
    getTemplateForApi,
    getReportGenerationConfig as getExecutiveReportGenerationConfig,
    TEMPLATE_INSTRUCTION_STYLE_GUIDE,
    HTML_FROM_MD_FULL_COVERAGE,
    getCustomizationQuestionsSystemPrompt,
    getRefineWithAnswersSystemPrompt,
    type PromptLang,
    type HtmlTemplateId,
} from './prompts/executiveTeam';
import { getDefaultFeaturesEditable, MD_ONLY_INSTRUCTION_FEATURES, getReportGenerationConfig as getFeaturesReportGenerationConfig, getFeaturesTemplateContent } from './prompts/features';
import { getDefaultTestcasesEditable, MD_ONLY_INSTRUCTION_TC, getReportGenerationConfig as getTestcasesReportGenerationConfig, getTestcasesTemplateContent } from './prompts/testcases';

export type { PromptLang, HtmlTemplateId };

export {
    DEFAULT_PROMPT_EXECUTIVE_EDITABLE,
    DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN,
    DEFAULT_PROMPT_TEAM_EDITABLE,
    DEFAULT_PROMPT_TEAM_EDITABLE_EN,
    HTML_FIXED_EXECUTIVE,
    HTML_FIXED_TEAM,
    getDefaultExecutiveEditable,
    getDefaultTeamEditable,
    getDefaultFeaturesEditable,
    getDefaultTestcasesEditable,
};
export { DEFAULT_PROMPT_EXECUTIVE, DEFAULT_PROMPT_TEAM };
export { DEFAULT_PROMPT_TESTCASES_EDITABLE, DEFAULT_PROMPT_TESTCASES_EDITABLE_EN } from './prompts/testcases';
export { DEFAULT_PROMPT_FEATURES_EDITABLE, DEFAULT_PROMPT_FEATURES_EDITABLE_EN } from './prompts/features';

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
                max_completion_tokens: 20,
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

/** API에서 HTML 템플릿 조회. 실패 시 기본 ID는 getTemplateForApi, testcases/features는 getXxxTemplateContent() 폴백. */
const BUILTIN_TEMPLATE_IDS: HtmlTemplateId[] = ['default', 'phase1', 'presentation2', 'wiki', 'preformat'];
function parseTemplateResponse(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) return '';
    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed && typeof parsed.content === 'string') return parsed.content;
    } catch {
        /* not JSON, use as-is */
    }
    return trimmed;
}
export async function fetchTemplateFromApi(apiBaseUrl: string, templateId: string): Promise<string> {
    if (templateId === 'pptx') return getTemplateForApi('pptx');
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/templates/${templateId}`;
    try {
        const res = await fetch(url);
        const text = await res.text();
        const content = parseTemplateResponse(text);
        if (res.ok) {
            if (content.length > 0) return content;
            if (templateId === 'testcases') return getTestcasesTemplateContent();
            if (templateId === 'features') return getFeaturesTemplateContent();
            if (BUILTIN_TEMPLATE_IDS.includes(templateId as HtmlTemplateId))
                return getTemplateForApi(templateId as HtmlTemplateId);
        }
        // 404 등 실패 시 기본 ID/TC/FE는 로컬 기본값 사용 (백엔드 미배포·구버전 대응)
        if (templateId === 'testcases') return getTestcasesTemplateContent();
        if (templateId === 'features') return getFeaturesTemplateContent();
        if (BUILTIN_TEMPLATE_IDS.includes(templateId as HtmlTemplateId))
            return getTemplateForApi(templateId as HtmlTemplateId);
    } catch {
        if (templateId === 'testcases') return getTestcasesTemplateContent();
        if (templateId === 'features') return getFeaturesTemplateContent();
        if (BUILTIN_TEMPLATE_IDS.includes(templateId as HtmlTemplateId))
            return getTemplateForApi(templateId as HtmlTemplateId);
    }
    throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
}

/** 어드민: 네트워크 없이 기본 템플릿 내용 즉시 반환 (로딩 대기 없이 에디터에 표시용). */
export function getDefaultTemplateContentForAdmin(templateId: string): string {
    if (templateId === 'pptx') return '';
    if (templateId === 'testcases') return getTestcasesTemplateContent();
    if (templateId === 'features') return getFeaturesTemplateContent();
    if (BUILTIN_TEMPLATE_IDS.includes(templateId as HtmlTemplateId))
        return getTemplateForApi(templateId as HtmlTemplateId);
    return '';
}

/** 어드민: API에 HTML 템플릿 저장 */
export async function saveTemplateToApi(apiBaseUrl: string, templateId: string, content: string): Promise<void> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/templates/${templateId}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || '저장 실패');
    }
}

/** 어드민: API에서 템플릿 삭제 */
export async function deleteTemplateFromApi(apiBaseUrl: string, templateId: string): Promise<void> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/templates/${templateId}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || '삭제 실패');
    }
}

/** 어드민: API에서 편집 가능한 템플릿 목록 조회 */
export async function listTemplatesFromApi(apiBaseUrl: string): Promise<{ id: string; exists: boolean }[]> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/api/templates`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data as { templates?: { id: string; exists: boolean }[] }).templates ?? [];
}

// ─── 2단계 파이프라인: 정리 md 품질 (루브릭 + 최대 3회차) ─────────────────────────────────────

/** 정리 md 생성 시 출력 토큰 상한 (긴 원천 반영 시 긴 출력 필요) */
const REFINED_MD_MAX_TOKENS = 16384;

/** C방식: default HTML 생성 시 섹션별 내용만 추출 — 출력 짧게 해서 속도 개선 */
const HTML_SECTION_CONTENT_MAX_TOKENS = 4096;

export type GenerateReportResult = {
        html: string;
        markdown?: string;
        usage?: ReportUsage;
        slides?: Array<{
            slideType?: string;
            title: string;
            bullets?: string[];
            tagline?: string;
            label?: string;
            headline?: string;
            subHook?: string;
            kicker?: string;
            bottomInfo?: string;
            cards?: Array<{ title: string; items: string[] }>;
            metrics?: Array<{ value: string; label: string }>;
            gridTitles?: [string, string, string, string];
            gridBodies?: [string[], string[], string[], string[]];
        }>;
    };

/** OpenAI 모델 중 temperature를 기본값(1)만 지원하는 경우: 0.3 전달 시 400 발생 → 생략 (실제 사용: gpt-5.1, gpt-5.2) */
function isOpenAITemperatureFixedModel(modelId: string): boolean {
    return modelId.startsWith('gpt-5.1') || modelId.startsWith('gpt-5.2');
}

/** OpenAI message.content: 문자열이면 그대로, 배열이면 text/output_text/refusal 등 파트에서 텍스트 이어붙여 반환. reasoning 모델의 output 등 추가 필드 지원 */
function openaiContentToText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (!part || typeof part !== 'object') return '';
                const p = part as Record<string, unknown>;
                // 실제 출력 우선 (reasoning 모델은 type별로 나뉠 수 있음)
                if (typeof p.text === 'string') return p.text;
                if (typeof p.output === 'string') return p.output;
                if (typeof p.refusal === 'string') return p.refusal;
                if (typeof p.output_text === 'string') return p.output_text;
                if (typeof p.input_text === 'string') return p.input_text;
                for (const key of ['content', 'message']) {
                    if (typeof p[key] === 'string') return p[key] as string;
                }
                return '';
            })
            .join('');
    }
    return '';
}

/** 객체를 재귀 탐색해 긴 문자열(본문으로 보이는 것)을 하나 찾아 반환. API 응답 구조가 바뀌었을 때 폴백용 */
function extractLongTextFromObject(obj: unknown, minLength = 200): string {
    if (typeof obj === 'string') return obj.length >= minLength ? obj : '';
    if (obj == null || typeof obj !== 'object') return '';
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const s = extractLongTextFromObject(item, minLength);
            if (s.length >= minLength) return s;
        }
        return '';
    }
    const record = obj as Record<string, unknown>;
    for (const key of ['text', 'content', 'output_text', 'input_text', 'message', 'output']) {
        const v = record[key];
        if (typeof v === 'string' && v.length >= minLength) return v;
    }
    for (const v of Object.values(record)) {
        const s = extractLongTextFromObject(v, minLength);
        if (s.length >= minLength) return s;
    }
    return '';
}

/** 단일 LLM 호출 (시스템 + 유저) → fullBody + usage. highQuality 시 OpenAI=reasoning_effort high, Gemini=thinking 강화, Claude=동일 */
async function callLlm(
    systemPrompt: string,
    userPrompt: string,
    selection: string,
    apiKey: string,
    maxTokens = 4096,
    highQuality = false
): Promise<{ fullBody: string; usage?: ReportUsage }> {
    const mapped = LLM_SELECTION_MAP[selection];
    const provider = mapped ? mapped.provider : (selection === 'claude' || selection === 'gemini' ? selection : 'openai');
    const modelId = mapped ? mapped.modelId : (provider === 'openai' ? 'gpt-4o' : provider === 'claude' ? 'claude-sonnet-4-6' : 'gemini-2.5-pro');
    let fullBody = '';
    let usage: ReportUsage | undefined;
    let didRetry = false;

    const startMs = Date.now();
    const systemChars = typeof systemPrompt === 'string' ? systemPrompt.length : 0;
    const userChars = typeof userPrompt === 'string' ? userPrompt.length : 0;
    const inputChars = systemChars + userChars;
    console.log('[DocMaster] LLM 요청 시작', { provider, modelId, highQuality, inputChars, systemChars, userChars });
    if (provider === 'openai') {
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const isReasoningModel = modelId.startsWith('gpt-5.1') || modelId.startsWith('gpt-5.2');
        const reasoningEffort = isReasoningModel ? (highQuality ? ('high' as const) : ('none' as const)) : undefined;
        let response = await openai.chat.completions.create({
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: maxTokens,
            ...(isOpenAITemperatureFixedModel(modelId) ? {} : { temperature: 0.3 }),
            ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
        });
        fullBody = openaiContentToText(response.choices[0].message?.content ?? '');
        const bodyLen: number = typeof fullBody === 'string' ? fullBody.length : 0;
        if (bodyLen === 0 && response.choices?.[0]?.message) {
            const msg = response.choices[0].message as unknown as Record<string, unknown>;
            const msgKeys = Object.keys(msg);
            const hasRefusal = typeof msg.refusal === 'string' && (msg.refusal as string).trim().length > 0;
            if (isReasoningModel) {
                console.warn('[callLlm] gpt-5.1/5.2 reasoning 응답 본문 비어 있음 — 폴백: reasoning_effort none 재시도', { modelId, messageKeys: msgKeys, hasRefusal, inputChars });
                if (hasRefusal) {
                    fullBody = (msg.refusal as string).trim();
                } else {
                    didRetry = true;
                    response = await openai.chat.completions.create({
                        model: modelId,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        max_completion_tokens: maxTokens,
                        ...(isOpenAITemperatureFixedModel(modelId) ? {} : { temperature: 0.3 }),
                        reasoning_effort: 'none' as const,
                    });
                    fullBody = openaiContentToText(response.choices[0].message?.content ?? '');
                }
            } else {
                didRetry = true;
                console.warn('[callLlm] OpenAI 응답 본문 비어 있음 — 1회 재시도', { modelId, messageKeys: msgKeys, inputChars });
                response = await openai.chat.completions.create({
                    model: modelId,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_completion_tokens: maxTokens,
                    ...(isOpenAITemperatureFixedModel(modelId) ? {} : { temperature: 0.3 }),
                });
                fullBody = openaiContentToText(response.choices[0].message?.content ?? '');
            }
        } else if (bodyLen === 0) {
            didRetry = true;
            console.warn('[callLlm] OpenAI 응답 본문 비어 있음 — 1회 재시도', { modelId, inputChars });
            response = await openai.chat.completions.create({
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_completion_tokens: maxTokens,
                ...(isOpenAITemperatureFixedModel(modelId) ? {} : { temperature: 0.3 }),
                ...(isReasoningModel && { reasoning_effort: 'none' as const }),
            });
            fullBody = openaiContentToText(response.choices[0].message?.content ?? '');
        }
        const rawContent = response.choices[0].message?.content;
        const finalBodyLen: number = typeof fullBody === 'string' ? fullBody.length : 0;
        if (rawContent !== undefined && typeof rawContent !== 'string') {
            const partCount = Array.isArray(rawContent) ? (rawContent as unknown[]).length : 0;
            console.log('[callLlm] OpenAI content가 배열로 옴 → 텍스트 추출', {
                partCount,
                fullBodyLength: finalBodyLen,
            });
        }
        if (finalBodyLen === 0) {
            const msg = response.choices?.[0]?.message;
            const msgRecord = msg as unknown as Record<string, unknown> | undefined;
            const rawPreview = msgRecord ? JSON.stringify(msgRecord).slice(0, 500) : 'no message';
            console.warn('[callLlm] OpenAI 응답 본문이 비어 있음 (재시도 후에도)', {
                modelId,
                rawMessagePreview: rawPreview,
            });
        }
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
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.3,
        });
        const contentBlock = response.content[0];
        if (contentBlock?.type === 'text') fullBody = contentBlock.text;
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
            systemInstruction: systemPrompt,
        });
        const requestOptions = isThinkingModel
            ? ({
                  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                  generationConfig: {
                      temperature: 0.3,
                      maxOutputTokens: maxTokens,
                      thinkingConfig: modelId.includes('gemini-3.1') || modelId.includes('gemini-3-pro')
                          ? { thinkingLevel: highQuality ? 'HIGH' : 'MEDIUM' }
                          : { thinkingBudget: highQuality ? 16384 : 8192 },
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
    const outLen = typeof fullBody === 'string' ? fullBody.length : 0;
    const elapsedMs = Date.now() - startMs;
    console.log('[DocMaster] LLM 응답 완료', {
        provider,
        modelId,
        bodyLength: outLen,
        elapsedMs,
        didRetry,
        ...(didRetry && { note: '재시도로 동일 입력 2회 전송 → 실제 입력 토큰은 약 2배 소비' }),
        ...(usage && {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            estimatedCostUsd: usage.estimatedCostUsd,
        }),
    });
    return { fullBody, usage };
}

/** 정리 md가 HTML 템플릿 변수 목록({{summary}} 등)만 있는지 여부. 이런 블록은 최종 정리 md가 아니므로 제외한다. */
function isOnlyVariablePlaceholders(md: string): boolean {
    const trimmed = (md || '').trim();
    if (trimmed.length < 50) return false;
    const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const variablePattern = /^\{\{[a-z_]+\}\}$/i;
    const mostlyVariables = lines.filter((l) => variablePattern.test(l)).length;
    return lines.length <= 10 && mostlyVariables >= 6;
}

function parseLastMarkdownBlock(fullBody: string): string | undefined {
    const body = typeof fullBody === 'string' ? fullBody : '';
    // ```markdown / ```md 블록을 모두 수집 (동일 응답에 둘 다 있을 수 있으므로 한 regex로 통합)
    const blocks = body.match(/```(?:markdown|md)\s*[\s\S]*?```/gi);
    if (!blocks?.length) return undefined;
    const extracted: string[] = [];
    for (const block of blocks) {
        const m = block.match(/```(?:markdown|md)\s*([\s\S]*?)```/i);
        const raw = m ? m[1].trim() : '';
        if (raw && !isOnlyVariablePlaceholders(raw)) extracted.push(stripPromptStepHeadersFromMd(raw));
    }
    if (extracted.length === 0) {
        const last = blocks[blocks.length - 1];
        const m = last.match(/```(?:markdown|md)\s*([\s\S]*?)```/i);
        const raw = m ? m[1].trim() : undefined;
        return raw ? stripPromptStepHeadersFromMd(raw) : undefined;
    }
    return extracted.reduce((a, b) => (a.length >= b.length ? a : b));
}

/** 정리 md에 잘못 포함된 프롬프트 실행 단계 제목(Step 1/2/3 등) 한 줄 제거 */
function stripPromptStepHeadersFromMd(md: string): string {
    return md
        .split('\n')
        .filter((line) => {
            const t = line.trim();
            if (!t) return true;
            if (/^#+\s*Step\s*[123]\s*[:：]/.test(t)) return false;
            if (/^#+\s*Step\s*[123]\s*[-:]/.test(t)) return false;
            if (/실무 공유용 HTML 문서 조립|최종 임원 보고용 HTML|Assemble team-facing HTML|Final executive HTML/.test(t) && /^#+\s*/.test(t)) return false;
            return true;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** 2단계 1차: 원시 md → 정리된 경영진/실무/테스트케이스/개발피처용 md. 테스트케이스·개발피처는 1회 호출만. */
export async function generateRefinedMarkdownClient(
    rawMarkdown: string,
    selection: string,
    apiKey: string,
    reportType: 'executive' | 'team' | 'testcases' | 'features',
    highQuality: boolean
): Promise<{ markdown: string; usage?: ReportUsage }> {
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';
    const lineCount = rawMarkdown.split('\n').length;
    const lengthHint =
        lineCount >= 500
            ? promptLang === 'en'
                ? `[Source data: ~${lineCount} lines. Produce a proportionally rich refined report; do not output only a short summary.]\n\n`
                : `[원천 데이터: 약 ${lineCount}줄. 이 분량에 맞게 정리된 보고서는 섹션·항목을 풍부하게 작성할 것. 몇 줄 요약으로 끝내지 말 것.]\n\n`
            : '';

    // 테스트케이스·개발피처: 2단계 1차 = 정리 md만 생성 (1회 호출, 고품질 N회차 없음)
    if (reportType === 'testcases' || reportType === 'features') {
        const storageKey =
            reportType === 'testcases' ? 'docmaster_promptTestcasesEditable' : 'docmaster_promptFeaturesEditable';
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
        const defaultEditable =
            reportType === 'testcases' ? getDefaultTestcasesEditable(promptLang) : getDefaultFeaturesEditable(promptLang);
        const editable = (stored != null && stored.trim() !== '') ? stored : defaultEditable;
        const usedStored = (stored != null && stored.trim() !== '');
        if (import.meta.env.DEV) {
            console.log('[DocMaster] 정리 md 프롬프트 출처 (테스트케이스/개발피처)', {
                reportType,
                source: usedStored ? 'localStorage' : 'default',
                storedLength: stored?.length ?? 0,
                editableLength: editable.length,
                editablePreview: editable.slice(0, 280).replace(/\n/g, ' '),
            });
        }
        const mdOnlyInstruction = reportType === 'testcases' ? MD_ONLY_INSTRUCTION_TC : MD_ONLY_INSTRUCTION_FEATURES;
        const systemPrompt = editable + mdOnlyInstruction;
        const userPrompt = `${lengthHint}[원천 데이터 / Source Data]\n\n${rawMarkdown}`;
        console.log('[DocMaster] 정리 md 1회 호출 (테스트케이스/개발피처)', { reportType, inputChars: rawMarkdown.length, inputLines: lineCount });
        const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, REFINED_MD_MAX_TOKENS, false);
        const rawBody = typeof fullBody === 'string' ? fullBody : '';
        let outMd: string | undefined = parseLastMarkdownBlock(rawBody) || stripPromptStepHeadersFromMd(rawBody.trim());
        if (outMd && isOnlyVariablePlaceholders(outMd)) outMd = undefined;
        const rawTrimmed = rawBody.trim();
        if (!outMd?.trim() && rawTrimmed.length > 200) outMd = stripPromptStepHeadersFromMd(rawTrimmed);
        console.log('[generateRefinedMarkdownClient] 테스트케이스/개발피처', { reportType, fullBodyLength: rawBody.length, outMdLength: outMd?.length ?? 0 });
        return { markdown: outMd ?? '', usage };
    }

    const executiveEditable = localStorage.getItem('docmaster_promptExecutiveEditable') || getDefaultExecutiveEditable(promptLang);
    const teamEditable = localStorage.getItem('docmaster_promptTeamEditable') || getDefaultTeamEditable(promptLang);
    const editablePart = reportType === 'team' ? teamEditable : executiveEditable;
    const systemBase = editablePart + QUALITY_RUBRIC_AND_NO_LOSS + (reportType === 'team' ? TEAM_RICH_AND_UNLIMITED_LENGTH : '');
    let totalUsage: ReportUsage | undefined;

    if (highQuality) {
        // 1차: 초안 md만 (긴 출력 허용)
        const systemDraft = systemBase + MD_OUTPUT_INSTRUCTION_DRAFT_ONLY;
        const userDraft = `${lengthHint}[원천 데이터 / Source Data]\n\n${rawMarkdown}`;
        const { fullBody: draftBody, usage: u1 } = await callLlm(systemDraft, userDraft, selection, apiKey, REFINED_MD_MAX_TOKENS, true);
        if (u1) totalUsage = u1;
        let draftMd = parseLastMarkdownBlock(draftBody) || stripPromptStepHeadersFromMd(draftBody.trim());
        if (draftMd && isOnlyVariablePlaceholders(draftMd)) draftMd = stripPromptStepHeadersFromMd(draftBody.trim()).length > 200 ? stripPromptStepHeadersFromMd(draftBody.trim()) : '';

        // 2차: 검토만
        const critiquePrompt = promptLang === 'en' ? CRITIQUE_PROMPT_EN : CRITIQUE_PROMPT_KO;
        const userCritique = `[원천 데이터]\n${rawMarkdown}\n\n[초안 보고서]\n${draftMd}`;
        const { fullBody: critiqueBody, usage: u2 } = await callLlm(critiquePrompt, userCritique, selection, apiKey, 2048, true);
        if (u2) {
            totalUsage = totalUsage
                ? {
                    inputTokens: totalUsage.inputTokens + u2.inputTokens,
                    outputTokens: totalUsage.outputTokens + u2.outputTokens,
                    totalTokens: totalUsage.totalTokens + u2.totalTokens,
                    estimatedCostUsd: (totalUsage.estimatedCostUsd ?? 0) + (u2.estimatedCostUsd ?? 0),
                }
                : u2;
        }

        // 3차: 검토 반영 최종 md
        const revisePrompt = promptLang === 'en' ? REVISE_PROMPT_EN : REVISE_PROMPT_KO;
        const userRevise = `[원천 데이터]\n${rawMarkdown}\n\n[초안 보고서]\n${draftMd}\n\n[검토 결과]\n${critiqueBody.trim()}`;
        const { fullBody: finalBody, usage: u3 } = await callLlm(revisePrompt, userRevise, selection, apiKey, REFINED_MD_MAX_TOKENS, true);
        let finalMd = parseLastMarkdownBlock(finalBody) || stripPromptStepHeadersFromMd(finalBody.trim());
        if (finalMd && isOnlyVariablePlaceholders(finalMd)) finalMd = '';
        const outMd = finalMd || draftMd;
        if (u3) {
            totalUsage = totalUsage
                ? {
                    inputTokens: totalUsage.inputTokens + u3.inputTokens,
                    outputTokens: totalUsage.outputTokens + u3.outputTokens,
                    totalTokens: totalUsage.totalTokens + u3.totalTokens,
                    estimatedCostUsd: (totalUsage.estimatedCostUsd ?? 0) + (u3.estimatedCostUsd ?? 0),
                }
                : u3;
        }
        console.log('[generateRefinedMarkdownClient] 고품질 모드', {
            draftBodyLength: draftBody?.length ?? 0,
            finalBodyLength: finalBody?.length ?? 0,
            draftMdLength: draftMd?.length ?? 0,
            finalMdLength: finalMd?.length ?? 0,
            used: finalMd ? 'finalMd' : 'draftMd',
            isEmpty: !outMd?.trim(),
        });
        if (!outMd?.trim()) {
            console.warn('[generateRefinedMarkdownClient] 고품질 경로 정리 md 비어 있음 — 1차 응답 미리보기(300자)', typeof draftBody === 'string' ? draftBody.slice(0, 300).replace(/\n/g, ' ') : '(없음)');
        }
        return { markdown: outMd, usage: totalUsage };
    }

    // 일반: 1회 호출 내 초안 → 자가검토 → 최종 (긴 출력 허용)
    const systemNormal = systemBase + MD_OUTPUT_INSTRUCTION_NORMAL;
    const userNormal = `${lengthHint}[원천 데이터 / Source Data]\n\n${rawMarkdown}`;
    console.log('[DocMaster] 정리 md 1회 호출 (일반 모드)', { reportType, inputChars: rawMarkdown.length, inputLines: lineCount, highQuality: false });
    const { fullBody, usage } = await callLlm(systemNormal, userNormal, selection, apiKey, REFINED_MD_MAX_TOKENS, highQuality);
    let lastMd = parseLastMarkdownBlock(fullBody);
    if (lastMd && isOnlyVariablePlaceholders(lastMd)) lastMd = undefined;
    const fallbackMd = stripPromptStepHeadersFromMd(fullBody.trim());
    // API가 블록 없이 본문만 보내는 경우: 전체 본문을 마지막 fallback으로 사용
    const rawBodyTrimmed = typeof fullBody === 'string' ? fullBody.trim() : '';
    let outMd = lastMd || fallbackMd || (rawBodyTrimmed.length > 200 ? rawBodyTrimmed : '');
    if (outMd && isOnlyVariablePlaceholders(outMd)) outMd = fallbackMd && !isOnlyVariablePlaceholders(fallbackMd) ? fallbackMd : (rawBodyTrimmed.length > 200 ? rawBodyTrimmed : '');
    if (outMd && isOnlyVariablePlaceholders(outMd)) outMd = '';
    console.log('[generateRefinedMarkdownClient] 일반 모드', {
        reportType,
        fullBodyLength: fullBody?.length ?? 0,
        lastMdLength: lastMd?.length ?? 0,
        fallbackMdLength: fallbackMd?.length ?? 0,
        used: lastMd ? 'lastMd' : fallbackMd ? 'fallbackMd' : (rawBodyTrimmed.length > 200 ? 'rawBody' : 'none'),
        isEmpty: !outMd?.trim(),
    });
    if (!outMd?.trim()) {
        const preview = typeof fullBody === 'string' && fullBody.length > 0 ? fullBody.slice(0, 500).replace(/\n/g, ' ') : '(없음)';
        console.warn('[generateRefinedMarkdownClient] 정리 md 추출 실패', { reportType, fullBodyLength: fullBody?.length ?? 0, apiResponsePreview: preview });
    }
    return { markdown: outMd, usage };
}

/** 맞춤 질문: 초안 기반 사용자 선택용 타입 */
export type CustomizationQuestionOption = { id: string; label: string };
export type CustomizationQuestion = {
    id: string;
    text: string;
    options: CustomizationQuestionOption[];
};

/** 정리 md 초안을 바탕으로 맞춤 질문(선택지) 생성. 실패 시 빈 배열 반환. */
export async function generateCustomizationQuestionsFromDraftClient(
    refinedMd: string,
    _reportType: 'executive' | 'team',
    selection: string,
    apiKey: string
): Promise<{ questions: CustomizationQuestion[]; usage?: ReportUsage }> {
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';
    const systemPrompt = getCustomizationQuestionsSystemPrompt(promptLang);
    const userPrompt = promptLang === 'en'
        ? `[Refined report draft]\n\n${refinedMd.slice(0, 12000)}`
        : `[정리된 보고서 초안]\n\n${refinedMd.slice(0, 12000)}`;
    try {
        const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, 1024, false);
        const jsonMatch = fullBody.match(/\{[\s\S]*\}/);
        const raw = jsonMatch ? jsonMatch[0] : fullBody.trim();
        const parsed = JSON.parse(raw) as { questions?: CustomizationQuestion[] };
        const list = Array.isArray(parsed.questions) ? parsed.questions : [];
        const valid = list.filter(
            (q): q is CustomizationQuestion =>
                typeof q?.id === 'string' && typeof q?.text === 'string' && Array.isArray(q?.options) &&
                q.options.every((o) => typeof o?.id === 'string' && typeof o?.label === 'string')
        );
        return { questions: valid.slice(0, 3), usage };
    } catch (e) {
        console.warn('[generateCustomizationQuestionsFromDraftClient] 파싱 실패', e);
        return { questions: [], usage: undefined };
    }
}

/** 사용자 선택을 반영해 정리 md 수정. */
export async function refineMarkdownWithAnswersClient(
    refinedMd: string,
    answers: Record<string, string>,
    _reportType: 'executive' | 'team',
    questionList: CustomizationQuestion[],
    selection: string,
    apiKey: string
): Promise<{ markdown: string; usage?: ReportUsage }> {
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';
    const systemPrompt = getRefineWithAnswersSystemPrompt(promptLang);
    const choicesText = questionList
        .map((q) => {
            const optId = answers[q.id];
            const opt = q.options.find((o) => o.id === optId);
            return opt ? `- ${q.text} → ${opt.label}` : null;
        })
        .filter(Boolean)
        .join('\n');
    const userPrompt = promptLang === 'en'
        ? `[User choices]\n${choicesText}\n\n[Refined report draft]\n\n${refinedMd}`
        : `[사용자 선택]\n${choicesText}\n\n[정리된 보고서 초안]\n\n${refinedMd}`;
    const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, REFINED_MD_MAX_TOKENS, false);
    const outMd = parseLastMarkdownBlock(fullBody) || stripPromptStepHeadersFromMd(fullBody.trim());
    return { markdown: outMd?.trim() || refinedMd, usage };
}

/** C방식: 정리 md에서 섹션별 HTML 조각만 JSON으로 추출 (default 템플릿용, 출력 짧아서 빠름) */
export async function generateSectionContentFromRefinedMdClient(
    refinedMarkdown: string,
    selection: string,
    apiKey: string,
    reportType: 'executive' | 'team'
): Promise<{ sections: Record<string, string>; usage?: ReportUsage }> {
    void reportType; /* reserved for future per-type prompt */
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';
    const systemPrompt = getSectionContentSystemPrompt(promptLang);
    const userPrompt = promptLang === 'en'
        ? `[Refined report content]\n\n${refinedMarkdown.slice(0, 10000)}`
        : `[정리된 보고 내용]\n\n${refinedMarkdown.slice(0, 10000)}`;
    try {
        const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, HTML_SECTION_CONTENT_MAX_TOKENS, false);
        const jsonMatch = fullBody.match(/\{[\s\S]*\}/);
        const raw = jsonMatch ? jsonMatch[0] : fullBody.trim();
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const sections: Record<string, string> = {};
        for (const key of SECTION_KEYS) {
            const v = parsed[key];
            sections[key] = typeof v === 'string' ? v.trim() : '';
        }
        return { sections, usage };
    } catch (e) {
        console.warn('[generateSectionContentFromRefinedMdClient] 파싱 실패', e);
        return { sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, ''])), usage: undefined };
    }
}

/** 2단계 2차: 정리된 md → HTML (스타일 가이드/템플릿에 맞춰 생성). 테스트케이스·개발피처는 정리 md → HTML만 출력. */
export async function generateHtmlFromMarkdownClient(
    refinedMarkdown: string,
    selection: string,
    apiKey: string,
    templateId: HtmlTemplateId,
    reportType: 'executive' | 'team' | 'testcases' | 'features',
    apiBaseUrl?: string,
    highQuality = false
): Promise<{ html: string; usage?: ReportUsage }> {
    if (templateId === 'pptx') {
        throw new Error('generateHtmlFromMarkdownClient does not support pptx. Use generateReportClient for pptx.');
    }
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';

    // 테스트케이스·개발피처: [정리된 보고 내용] → HTML 블록 하나만 출력. 템플릿은 API 또는 로컬 기본값.
    if (reportType === 'testcases' || reportType === 'features') {
        const templateIdTcFe: 'testcases' | 'features' =
          templateId === 'testcases' || templateId === 'features' ? templateId : reportType === 'testcases' ? 'testcases' : 'features';
        let htmlFixed: string;
        try {
            htmlFixed = apiBaseUrl
                ? await fetchTemplateFromApi(apiBaseUrl, templateIdTcFe)
                : (reportType === 'testcases' ? getTestcasesTemplateContent() : getFeaturesTemplateContent());
        } catch (e) {
            if (import.meta.env?.DEV) console.warn('[DocMaster] 템플릿 로드 실패, 로컬 기본값 사용', { templateIdTcFe, error: e });
            htmlFixed = reportType === 'testcases' ? getTestcasesTemplateContent() : getFeaturesTemplateContent();
        }
        if (!htmlFixed?.trim()) {
            htmlFixed = reportType === 'testcases' ? getTestcasesTemplateContent() : getFeaturesTemplateContent();
        }
        const sourceOfTruthInstruction = promptLang === 'en'
            ? `

# Refined content vs template (required)
- **The [Refined report content] is the source of truth for table/section structure.** Use the template only for **styles, layout, and class names.**
- **Table headers, column count, order, and row data** must match the [Refined report content] exactly. If the template differs, **follow the refined content.**
- Do not reduce columns or rename headers. If the refined content has N columns, the HTML table must have N <th> and N <td> per row.`
            : `

# 정리 md vs 템플릿 (필수)
- **표·섹션 구조의 기준은 [정리된 보고 내용]이다.** 템플릿에 있는 표/섹션은 **스타일·레이아웃·클래스명**만 참고한다.
- 실제 **표 헤더명·컬럼 개수·순서·행 데이터**는 [정리된 보고 내용]에 나온 표와 **동일하게** HTML에 반영할 것. 템플릿 예시와 정리 md가 다르면 **정리 md를 우선**한다.
- 컬럼을 줄이거나 이름을 바꾸지 말 것. 정리 md에 N개 컬럼이 있으면 HTML 표에도 <th> N개, <td> N개로 맞출 것.`;
        const tableColumnInstruction =
            reportType === 'testcases'
                ? (promptLang === 'en'
                    ? `

# Table columns (test cases)
Reflect the **table headers, column count, and order** from [Refined report content] exactly in the HTML <table>. Do not reduce to 7 columns or rename. If the user defined more columns (e.g. Id, 1–5 depth, Title, Precondition, Test Step Actions, Expected Results, Assignee, Result-PC/MO Web/AOS/iOS, Execution Type, Comment), include all <th> and <td> to match the refined content.`
                    : `

# 표 컬럼 (테스트 케이스)
[정리된 보고 내용]에 나온 **표의 헤더·컬럼 개수·순서를 그대로** HTML <table>에 반영하라. 컬럼을 7개로 줄이거나 이름을 바꾸지 말 것. 사용자가 더 많은 컬럼(예: Id, 1~5 depth, Title, Precondition, Test Step Actions, Expected Results, Assignee, Result-PC/MO Web/AOS/iOS, Execution Type, Comment 등)을 정의했으면 [정리된 보고 내용]의 표 구조에 맞춰 <th>·<td>를 모두 포함하라.`)
                : reportType === 'features'
                  ? (promptLang === 'en'
                      ? `

# Tables & categories (dev features)
Reflect the **category list and feature table headers, column count, and order** from [Refined report content] exactly in the HTML. Use the template only for styles (.fe-table etc.); <th> and <td> count and names must match the refined content.`
                      : `

# 표·카테고리 (개발 피처)
[정리된 보고 내용]에 나온 **카테고리 목록·피쳐 표의 헤더·컬럼 개수·순서**를 그대로 HTML에 반영하라. 템플릿의 표 예시는 스타일(.fe-table 등)만 참고하고, 실제 <th>·<td>의 개수와 헤더명은 정리 md와 동일하게 둔다.`)
                  : '';
        const htmlOnlySuffix = promptLang === 'en'
            ? `

# Step 2 only (required)
[Refined report content] is provided below. In this step output **only one \`\`\`html ... \`\`\` block** that follows the document template and style rules above. Do not output a \`\`\`markdown\`\`\` block.${sourceOfTruthInstruction}${tableColumnInstruction}`
            : `

# 2단계 전용 (필수)
[정리된 보고 내용]이 아래에 제공된다. 이 단계에서는 위 문서 템플릿과 스타일 규칙에 맞춰 **\`\`\`html ... \`\`\` 블록 하나만** 출력하라. \`\`\`markdown\`\`\` 블록은 출력하지 마라.${sourceOfTruthInstruction}${tableColumnInstruction}`;
        const systemPrompt = htmlFixed + htmlOnlySuffix;
        const userPrompt = `[정리된 보고 내용]\n\n${refinedMarkdown}`;
        const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, REFINED_MD_MAX_TOKENS, false);
        const htmlMatch = fullBody.match(/```html\s*([\s\S]*?)```/i);
        const html = htmlMatch ? htmlMatch[1].trim() : (fullBody.startsWith('```html') ? fullBody.replace(/^```html\s*/i, '').replace(/\s*```$/, '').trim() : fullBody.trim());
        return { html, usage };
    }

    // C방식: default 템플릿 + 경영진/실무 → 섹션별 내용만 LLM 추출 후 고정 스켈레톤에 주입 (빠름)
    if (templateId === 'default' && (reportType === 'executive' || reportType === 'team')) {
        const { sections, usage } = await generateSectionContentFromRefinedMdClient(refinedMarkdown, selection, apiKey, reportType);
        let html = getDefaultHtmlTemplateSkeleton(reportType);
        for (const key of SECTION_KEYS) {
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), sections[key] || '<p class="text-slate-500">—</p>');
        }
        return { html, usage };
    }

    const executiveEditable = localStorage.getItem('docmaster_promptExecutiveEditable') || getDefaultExecutiveEditable(promptLang);
    const teamEditable = localStorage.getItem('docmaster_promptTeamEditable') || getDefaultTeamEditable(promptLang);
    const editablePart = reportType === 'team' ? teamEditable : executiveEditable;

    const templateContent = apiBaseUrl ? await fetchTemplateFromApi(apiBaseUrl, templateId) : getTemplateForApi(templateId);
    const label = '[HTML 형식 스타일 가이드]';
    const templateGuidance = templateId === 'preformat' ? '' : TEMPLATE_INSTRUCTION_STYLE_GUIDE;

    const htmlFixed = reportType === 'team' ? HTML_FIXED_TEAM : HTML_FIXED_EXECUTIVE;
    const dynamicInstruction = `
위에서 사용자가 정의한 필수 출력 항목·변수 매핑을 기준으로 한다. [정리된 보고 내용]에 그 항목들이 모두 포함되어 있으면, 주어진 [HTML 형식 스타일 가이드]에 맞춰 완성 HTML을 출력하라.
사용자가 프롬프트에서 추가한 변수·섹션이 기본 템플릿에 없으면, 동일한 스타일(report-slide, report-card, check-list 등)과 슬라이드 네비게이션 구조를 유지하면서 슬라이드 또는 섹션을 추가하여 반영하라. 정리된 내용을 누락 없이 HTML에 담을 것.
**정리된 내용이 기본 슬라이드에 다 담기 어렵거나 분량이 많으면:** 추가 슬라이드를 동일한 report-slide 구조로 넣어 모든 내용을 담을 것. 내용을 잘라 내지 말 것.`;
    const systemPrompt = `${editablePart}\n\n${htmlFixed}\n\n${HTML_FROM_MD_FULL_COVERAGE}\n\n${dynamicInstruction}\n\n아래 [정리된 보고 내용]을 위 규칙과 사용자 정의 항목에 맞춰 **모든 항목이 빠짐없이** 반영된 완성 HTML로 출력하라. 마크다운 코드블록 없이 \`\`\`html ... \`\`\` 블록 하나만 출력하라.`;
    const fullCoverageReminder = '\n\n**중요:** 위 [정리된 보고 내용]에 있는 모든 섹션·항목을 누락 없이 HTML에 반영할 것. 일부만 발췌하지 말 것.';
    const userPrompt = `[정리된 보고 내용]\n${refinedMarkdown}\n\n${label}\n${templateContent}\n\n${templateGuidance}${fullCoverageReminder}`.trim();

    const { fullBody, usage } = await callLlm(systemPrompt, userPrompt, selection, apiKey, REFINED_MD_MAX_TOKENS, highQuality);
    const htmlMatch = fullBody.match(/```html\s*([\s\S]*?)```/);
    const html = htmlMatch ? htmlMatch[1].trim() : (fullBody.startsWith('```html') ? fullBody.replace(/^```html\s*/, '').replace(/\s*```$/, '').trim() : fullBody.trim());
    return { html, usage };
}

export async function generateReportClient(
    markdownData: string,
    selection: string,
    apiKey: string,
    reportType: ReportType = 'executive',
    templateId: HtmlTemplateId = 'default',
    apiBaseUrl?: string
): Promise<GenerateReportResult> {
    const mapped = LLM_SELECTION_MAP[selection];
    const provider = mapped ? mapped.provider : (selection === 'claude' || selection === 'gemini' ? selection : 'openai');
    const modelId = mapped ? mapped.modelId : (provider === 'openai' ? 'gpt-4o' : provider === 'claude' ? 'claude-sonnet-4-6' : 'gemini-2.5-pro');
    const promptLang: PromptLang = localStorage.getItem('docmaster_lang') === 'en' ? 'en' : 'ko';

    let SYSTEM_PROMPT: string;
    let userPrompt: string;

    if (reportType === 'features') {
        const config = getFeaturesReportGenerationConfig(promptLang);
        SYSTEM_PROMPT = config.SYSTEM_PROMPT;
        let templateContent: string;
        try {
            templateContent = apiBaseUrl ? await fetchTemplateFromApi(apiBaseUrl, 'features') : getFeaturesTemplateContent();
        } catch (e) {
            if (import.meta.env?.DEV) console.warn('[DocMaster] features 템플릿 로드 실패, 로컬 기본값 사용', e);
            templateContent = getFeaturesTemplateContent();
        }
        userPrompt = config.buildUserPrompt(markdownData, templateContent);
    } else if (reportType === 'testcases') {
        const config = getTestcasesReportGenerationConfig(promptLang);
        SYSTEM_PROMPT = config.SYSTEM_PROMPT;
        let templateContent: string;
        try {
            templateContent = apiBaseUrl ? await fetchTemplateFromApi(apiBaseUrl, 'testcases') : getTestcasesTemplateContent();
        } catch (e) {
            if (import.meta.env?.DEV) console.warn('[DocMaster] testcases 템플릿 로드 실패, 로컬 기본값 사용', e);
            templateContent = getTestcasesTemplateContent();
        }
        userPrompt = config.buildUserPrompt(markdownData, templateContent);
    } else {
        const executiveEditable = localStorage.getItem('docmaster_promptExecutiveEditable') || getDefaultExecutiveEditable(promptLang);
        const teamEditable = localStorage.getItem('docmaster_promptTeamEditable') || getDefaultTeamEditable(promptLang);
        const config = getExecutiveReportGenerationConfig(reportType, templateId, promptLang, executiveEditable, teamEditable);
        SYSTEM_PROMPT = config.SYSTEM_PROMPT;
        const templateContent = apiBaseUrl ? await fetchTemplateFromApi(apiBaseUrl, templateId) : getTemplateForApi(templateId);
        userPrompt = config.buildUserPrompt(markdownData, templateContent);
    }

    console.log('[DocMaster] generateReportClient 진입', {
        reportType,
        templateId,
        provider,
        modelId,
        markdownDataLength: markdownData?.length ?? 0,
        systemPromptLength: SYSTEM_PROMPT?.length ?? 0,
        userPromptLength: userPrompt?.length ?? 0,
    });

    let fullBody = '';
    let usage: ReportUsage | undefined;

    if (provider === 'openai') {
        console.log('[DocMaster] generateReportClient OpenAI 호출 직전');
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const isReasoningModel = modelId.startsWith('gpt-5.1') || modelId.startsWith('gpt-5.2');
        const maxCompletionTokens = (reportType === 'testcases' || reportType === 'features') ? 8192 : 4096;
        const response = await openai.chat.completions.create({
            model: modelId,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: maxCompletionTokens,
            ...(isOpenAITemperatureFixedModel(modelId) ? {} : { temperature: 0.3 }),
            ...(isReasoningModel && { reasoning_effort: 'none' as const }),
        });
        fullBody = openaiContentToText(response.choices[0].message?.content ?? '');
        const finishReason = response.choices?.[0]?.finish_reason;
        if ((fullBody?.length ?? 0) === 0) {
            const msg = response.choices?.[0]?.message;
            let fallback = msg ? extractLongTextFromObject(msg, 100) : '';
            if (fallback.length === 0) {
                fallback = extractLongTextFromObject(response, 100);
            }
            if (fallback.length > 0) {
                fullBody = fallback;
                console.warn('[DocMaster] OpenAI 본문이 비어 있어 message/response에서 텍스트 추출로 복구', { recoveredLength: fallback.length });
            } else if (finishReason === 'length') {
                console.warn('[DocMaster] OpenAI 응답이 length로 잘렸는데 본문이 비어 있음 — message 구조 확인', {
                    contentType: typeof response.choices?.[0]?.message?.content,
                    isArray: Array.isArray(response.choices?.[0]?.message?.content),
                    contentPreview: JSON.stringify(response.choices?.[0]?.message?.content)?.slice(0, 500),
                });
            }
        }
        console.log('[DocMaster] generateReportClient OpenAI 응답', {
            fullBodyLength: fullBody?.length ?? 0,
            choicesLength: response.choices?.length ?? 0,
            firstChoiceFinishReason: finishReason,
            maxCompletionTokens,
            preview: typeof fullBody === 'string' ? fullBody.slice(0, 150).replace(/\n/g, ' ') : '(없음)',
        });
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
        console.log('[DocMaster] generateReportClient Claude 호출 직전');
        const anthropic = new Anthropic({ apiKey });
        const maxTokens = (reportType === 'testcases' || reportType === 'features') ? 8192 : 4096;
        const response = await anthropic.messages.create({
            model: modelId,
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.3,
        });
        for (const block of response.content) {
            if (block.type === 'text') {
                fullBody += block.text;
            }
        }
        console.log('[DocMaster] generateReportClient Claude 응답', {
            fullBodyLength: fullBody?.length ?? 0,
            contentBlocksCount: response.content?.length ?? 0,
            stopReason: response.stop_reason,
            preview: typeof fullBody === 'string' ? fullBody.slice(0, 150).replace(/\n/g, ' ') : '(없음)',
        });
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
        console.log('[DocMaster] generateReportClient Gemini 응답', {
            fullBodyLength: fullBody?.length ?? 0,
            preview: typeof fullBody === 'string' ? fullBody.slice(0, 150).replace(/\n/g, ' ') : '(없음)',
        });
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

    console.log('[DocMaster] generateReportClient API 응답 수신', {
        reportType,
        fullBodyLength: fullBody?.length ?? 0,
        fullBodyPreview: typeof fullBody === 'string' ? fullBody.slice(0, 200).replace(/\n/g, ' ') : '(없음)',
    });

    const isPptx = templateId === 'pptx';
    if (isPptx) {
        type SlideInput = {
            slideType?: string;
            title?: string;
            bullets?: string[];
            tagline?: string;
            label?: string;
            headline?: string;
            subHook?: string;
            kicker?: string;
            bottomInfo?: string;
            cards?: Array<{ title?: string; items?: string[] }>;
            metrics?: Array<{ value?: string; label?: string }>;
            gridTitles?: string[];
            gridBodies?: string[][];
        };
        let slides: GenerateReportResult['slides'] = [];
        const jsonMatch = fullBody.match(/```(?:json)?\s*([\s\S]*?)```/);
        const raw = jsonMatch ? jsonMatch[1].trim() : fullBody.trim();
        try {
            const parsed = JSON.parse(raw) as { slides?: SlideInput[] };
            if (Array.isArray(parsed.slides)) {
                slides = parsed.slides.map((s) => {
                    const title = typeof s.title === 'string' ? s.title : 'Slide';
                    const bullets = Array.isArray(s.bullets) ? s.bullets.map((b) => String(b)) : [];
                    const out: NonNullable<GenerateReportResult['slides']>[number] = {
                        slideType: typeof s.slideType === 'string' ? s.slideType : undefined,
                        title,
                        bullets: bullets.length ? bullets : undefined,
                    };
                    if (typeof s.tagline === 'string') out.tagline = s.tagline;
                    if (typeof s.label === 'string') out.label = s.label;
                    if (typeof s.headline === 'string') out.headline = s.headline;
                    if (typeof s.subHook === 'string') out.subHook = s.subHook;
                    if (typeof s.kicker === 'string') out.kicker = s.kicker;
                    if (typeof s.bottomInfo === 'string') out.bottomInfo = s.bottomInfo;
                    if (Array.isArray(s.cards) && s.cards.length > 0) {
                        out.cards = s.cards.map((c) => ({
                            title: typeof c.title === 'string' ? c.title : '',
                            items: Array.isArray(c.items) ? c.items.map((i) => String(i)) : [],
                        }));
                    }
                    if (Array.isArray(s.metrics) && s.metrics.length > 0) {
                        out.metrics = s.metrics.map((m) => ({
                            value: typeof m.value === 'string' ? m.value : String(m.value ?? ''),
                            label: typeof m.label === 'string' ? m.label : '',
                        }));
                    }
                    if (Array.isArray(s.gridTitles) && s.gridTitles.length >= 4) {
                        out.gridTitles = [s.gridTitles[0], s.gridTitles[1], s.gridTitles[2], s.gridTitles[3]];
                    }
                    if (Array.isArray(s.gridBodies) && s.gridBodies.length >= 4) {
                        out.gridBodies = [
                            (s.gridBodies[0] ?? []).map(String),
                            (s.gridBodies[1] ?? []).map(String),
                            (s.gridBodies[2] ?? []).map(String),
                            (s.gridBodies[3] ?? []).map(String),
                        ];
                    }
                    return out;
                });
            }
        } catch {
            /* ignore parse error */
        }
        return { html: '', slides: slides.length ? slides : undefined, usage };
    }

    // 정리된 내용(마크다운) + HTML 블록 추출 (순서: markdown 먼저, html 나중)
    let reportMarkdown: string | undefined;
    const mdBlockMatch = fullBody.match(/```markdown\s*([\s\S]*?)```/);
    if (mdBlockMatch) {
        reportMarkdown = mdBlockMatch[1].trim();
    }
    let htmlBody = fullBody;
    const htmlBlockMatch = fullBody.match(/```html\s*([\s\S]*?)```/i);
    if (htmlBlockMatch) {
        htmlBody = htmlBlockMatch[1].trim();
    } else if (/^```html/i.test(fullBody.trim())) {
        htmlBody = fullBody.trim().replace(/^```html\s*/i, '').replace(/\s*```$/, '').trim();
    }

    console.log('[DocMaster] generateReportClient 파싱 결과', {
        reportType,
        hasMdBlock: !!mdBlockMatch,
        mdLength: reportMarkdown?.length ?? 0,
        hasHtmlBlock: !!htmlBlockMatch,
        htmlBodyLength: htmlBody?.length ?? 0,
    });

    // testcases/features: HTML 블록이 없거나 비어 있으면 본문으로 뷰어용 HTML 래핑
    const needFallback =
        (reportType === 'testcases' || reportType === 'features') &&
        fullBody.trim().length > 0 &&
        (!htmlBlockMatch || htmlBody.trim().length === 0);
    if (needFallback) {
        console.log('[DocMaster] generateReportClient 폴백 적용 (HTML 블록 없음/비어있음)', { reportType });
        if (import.meta.env.DEV) {
            console.log('[DocMaster] HTML 블록 없음/비어있음 — 마크다운/텍스트를 뷰어용 HTML로 래핑', { reportType, hasMarkdownBlock: !!reportMarkdown, bodyLength: fullBody.length });
        }
        const rawContent = (reportMarkdown ?? fullBody.trim()).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        htmlBody = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Report</title><style>body{font-family:'Pretendard',sans-serif;max-width:900px;margin:24px auto;padding:0 16px;line-height:1.6;color:#1e293b;} pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;}</style></head><body><pre>${rawContent}</pre></body></html>`;
    }

    if (import.meta.env.DEV && (reportType === 'testcases' || reportType === 'features')) {
        console.log('[DocMaster] 테스트케이스/기능 보고서 반환', { reportType, fullBodyLength: fullBody.length, htmlLength: htmlBody.trim().length, usedFallback: needFallback });
    }

    let finalHtml = htmlBody.trim();
    // testcases/features에서 최종 html이 비어 있으면 뷰어에 안내 메시지라도 표시 (버튼이 보이도록)
    if ((reportType === 'testcases' || reportType === 'features') && finalHtml.length === 0) {
        finalHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/><title>Report</title><style>body{font-family:'Pretendard',sans-serif;max-width:600px;margin:48px auto;padding:24px;text-align:center;color:#64748b;} p{margin:12px 0;}</style></head><body><p>생성된 내용이 없습니다.</p><p>모델 응답이 비어 있거나 형식이 맞지 않을 수 있습니다. 프롬프트를 확인하거나 다시 시도해 보세요.</p></body></html>`;
    }

    // testcases/features: ```markdown 블록이 없어도 응답 본문이 있으면 정리 md로 사용 → "정리 내용 (.md) 다운로드"에 쓸 수 있게
    let finalMarkdown: string | undefined =
        reportMarkdown != null && reportMarkdown.length > 0
            ? reportMarkdown
            : (reportType === 'testcases' || reportType === 'features') && fullBody.trim().length > 0
              ? fullBody.trim()
              : reportMarkdown;

    // testcases/features: 응답이 비어 있으면 정리 md용 안내 문구라도 반환 (다운로드 버튼 노출 + 원인 안내)
    const EMPTY_MD_PLACEHOLDER = `# 정리 내용이 생성되지 않았습니다

모델 응답이 비어 있거나, 네트워크/API 오류로 내용을 받지 못했을 수 있습니다.

확인할 것:
- 설정에서 선택한 LLM과 API 키가 맞는지
- 테스트 케이스/개발 피쳐 프롬프트가 올바른지
- 문서를 다시 업로드한 뒤 [생성]을 다시 시도해 보세요.
`;
    if ((reportType === 'testcases' || reportType === 'features') && (finalMarkdown == null || finalMarkdown.trim().length === 0)) {
        finalMarkdown = EMPTY_MD_PLACEHOLDER;
    }

    console.log('[DocMaster] generateReportClient 반환 직전', {
        reportType,
        finalHtmlLength: finalHtml?.length ?? 0,
        finalMarkdownLength: finalMarkdown?.length ?? 0,
    });

    return { html: finalHtml, markdown: finalMarkdown, usage };
}
