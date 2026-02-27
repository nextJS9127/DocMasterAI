import * as vscode from 'vscode';

export async function selectFile(): Promise<vscode.Uri | undefined> {
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select Document',
        filters: {
            'Documents': ['pdf', 'pptx']
        }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
        return fileUri[0];
    }
    return undefined;
}

export async function selectExtractionMode(): Promise<'raw' | 'executive' | undefined> {
    const options = [
        {
            label: '1. Raw Data 추출',
            description: 'Extract structure and text as Markdown',
            value: 'raw' as const
        },
        {
            label: '2. Executive Report 생성',
            description: 'Generate formatted HTML report for executives',
            value: 'executive' as const
        }
    ];

    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select extraction mode'
    });

    return selection?.value;
}
