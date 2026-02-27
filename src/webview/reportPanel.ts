import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ReportPanel {
    public static async saveReport(content: string, originalFilePath: string, ext: 'md' | 'html'): Promise<string> {
        let outputDirPath = '';

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            outputDirPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'output');
        } else {
            outputDirPath = path.join(path.dirname(originalFilePath), 'output');
        }

        // Create directory if not exists
        try {
            await fs.mkdir(outputDirPath, { recursive: true });
        } catch (e) {
            console.error('Failed to create output directory', e);
        }

        const originalName = path.basename(originalFilePath, path.extname(originalFilePath));
        const finalPath = path.join(outputDirPath, `${originalName}_report.${ext}`);

        await fs.writeFile(finalPath, content, 'utf8');
        return finalPath;
    }

    public static render(extensionUri: vscode.Uri, content: string, type: 'html' | 'raw') {
        const panel = vscode.window.createWebviewPanel(
            'docMasterReport',
            'DocMaster AI Report',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        if (type === 'html') {
            panel.webview.html = content;
        } else {
            // Render basic markdown in webview for preview
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Markdown Preview</title>
                    <style>
                        body { font-family: monospace; padding: 20px; white-space: pre-wrap; line-height: 1.5; }
                    </style>
                </head>
                <body>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
                </html>
            `;
        }
    }
}
