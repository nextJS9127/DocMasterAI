import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `넌 IT 총괄 임원이야. 이 문서를 분석해 핵심 리스크와 액션 아이템을 도출하고 템플릿을 채워라.
주어진 HTML 템플릿 내의 변수(예: {{summary}}, {{chart_description}}, {{action_item}}) 위치에 알맞은 내용만 작성하여, 완성된 HTML 전체를 반환하라.
답변에는 마크다운 코드블럭(\`\`\`html 등)을 포함하지 말고 순수 HTML만 반환하라.`;

export async function generateReport(
    markdownData: string,
    templateHtml: string,
    provider: string,
    apiKey: string
): Promise<string> {
    const userPrompt = `
[Extracted Markdown Data]
${markdownData}

[Target HTML Template]
${templateHtml}
`;

    let htmlBody = '';

    if (provider === 'openai') {
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
        });
        htmlBody = response.choices[0].message.content || '';

    } else if (provider === 'claude') {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
        });
        const contentBlock = response.content[0];
        if (contentBlock.type === 'text') {
            htmlBody = contentBlock.text;
        }

    } else if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
        });
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        htmlBody = response.text();
    } else {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Remove markdown wrapping if the model ignored instruction
    if (htmlBody.startsWith('```html')) {
        htmlBody = htmlBody.replace(/^```html\s*/, '').replace(/\s*```$/, '');
    }

    return htmlBody.trim();
}
