import * as vscode from 'vscode';
import { selectFile, selectExtractionMode } from './utils/uiConfig';
import { parseDocument } from './api/llamaParse';
import { generateReport } from './api/llmClient';
import { TemplateManager } from './utils/templateManager';
import { ReportPanel } from './webview/reportPanel';
import { ChatViewProvider } from './webview/chatViewProvider';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "docmaster-ai" is now active!');

    // Register Chat View Provider
    const provider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
    );

    let disposable = vscode.commands.registerCommand('docmasterAi.startParsingFlow', async () => {
        try {
            provider.sendMessageToWebview({ type: 'disableBtn' });
            // 1. Check API Keys and Provider
            const config = vscode.workspace.getConfiguration('docmaster');
            const llamaKey = config.get<string>('LlamaParseApiKey');
            const llmProvider = config.get<string>('LLMProvider') || 'openai';
            const llmKey = config.get<string>('LLMApiKey') || '';
            const outputFormat = config.get<string>('OutputFormat') || 'html';

            if (!llamaKey || !llmKey) {
                const action = await vscode.window.showErrorMessage(
                    `DocMaster AI requires LlamaCloud API Key and an API Key for your selected LLM provider (${llmProvider}).`,
                    'Open Settings'
                );
                if (action === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'docmaster');
                }
                return;
            }

            // 2. Select File
            const fileUri = await selectFile();
            if (!fileUri) {
                provider.sendMessageToWebview({ type: 'enableBtn' });
                return; // User cancelled
            }

            // 3. Select Mode
            const mode = await selectExtractionMode();
            if (!mode) {
                provider.sendMessageToWebview({ type: 'enableBtn' });
                return; // User cancelled
            }

            // 4. Parse Document
            const parsingMsg = `문서 파싱 중... (${path.basename(fileUri.fsPath)})`;
            vscode.window.showInformationMessage(parsingMsg);
            provider.sendMessageToWebview({ type: 'addMessage', sender: 'bot', text: parsingMsg });
            const markdownData = await parseDocument(fileUri.fsPath, llamaKey);

            if (mode === 'raw') {
                // If raw mode, just show/save the markdown
                const reportPath = await ReportPanel.saveReport(markdownData, fileUri.fsPath, 'md');
                ReportPanel.render(context.extensionUri, markdownData, 'raw');
                vscode.window.showInformationMessage(`Raw data saved to: ${reportPath}`);
                return;
            }

            // 5. Executive Report Mode
            const generatingMsg = 'AI 리포트 생성 중... 잠시만 기다려주세요.';
            vscode.window.showInformationMessage(generatingMsg);
            provider.sendMessageToWebview({ type: 'addMessage', sender: 'bot', text: generatingMsg });

            if (outputFormat === 'md') {
                const finalReportMd = await generateReport(markdownData, "Generate plain markdown output.", llmProvider, llmKey);
                const reportPath = await ReportPanel.saveReport(finalReportMd, fileUri.fsPath, 'md');
                ReportPanel.render(context.extensionUri, finalReportMd, 'raw');
                vscode.window.showInformationMessage(`Executive markdown report generated and saved at: ${reportPath}`);
                return;
            }

            const templateManager = new TemplateManager();
            const templateHtml = await templateManager.getTemplate();

            const finalReportHtml = await generateReport(markdownData, templateHtml, llmProvider, llmKey);

            // 6. Save Output and Render
            const reportPath = await ReportPanel.saveReport(finalReportHtml, fileUri.fsPath, 'html');
            ReportPanel.render(context.extensionUri, finalReportHtml, 'html');

            vscode.window.showInformationMessage(`Executive report generated and saved at: ${reportPath}`);
            provider.sendMessageToWebview({ type: 'addMessage', sender: 'bot', text: '작업이 완료되었습니다! 리포트 창을 확인해주세요.' });
            provider.sendMessageToWebview({ type: 'enableBtn' });

        } catch (error: any) {
            vscode.window.showErrorMessage(`DocMaster AI Error: ${error.message}`);
            provider.sendMessageToWebview({ type: 'addMessage', sender: 'bot', text: `오류가 발생했습니다: ${error.message}` });
            provider.sendMessageToWebview({ type: 'enableBtn' });
            console.error(error);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
