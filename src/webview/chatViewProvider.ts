import * as vscode from 'vscode';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'docmasterAi.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'action':
                    {
                        if (data.value === 'selectFile') {
                            vscode.commands.executeCommand('docmasterAi.startParsingFlow');
                        }
                        break;
                    }
            }
        });
    }

    public sendMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DocMaster AI Chat</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { padding: 0; margin: 0; background-color: var(--vscode-sideBar-background); color: var(--vscode-sideBarTitle-foreground); }
        .chat-container { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .messages { flex-grow: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
        .message { padding: 0.75rem 1rem; border-radius: 0.5rem; max-width: 90%; word-break: break-word; }
        .message.bot { background-color: var(--vscode-editor-background); align-self: flex-start; border: 1px solid var(--vscode-widget-border); }
        .message.user { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; }
        .input-area { padding: 1rem; border-top: 1px solid var(--vscode-widget-border); display: flex; flex-direction: column; gap: 0.5rem; }
        .btn { padding: 0.5rem 1rem; border-radius: 0.25rem; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; text-align: center; border: none; font-weight: bold; }
        .btn:hover { background-color: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="message bot">
                안녕하세요! IT 총괄 임원 시각에서 문서를 분석해드리는 DocMaster AI입니다. 아래 버튼을 눌러 분석할 문서를 선택해주세요.
            </div>
        </div>
        <div class="input-area">
            <button class="btn" id="selectFileBtn">문서 선택 및 분석 시작</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const selectFileBtn = document.getElementById('selectFileBtn');

        selectFileBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'action', value: 'selectFile' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'addMessage':
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'message ' + (message.sender === 'user' ? 'user' : 'bot');
                    msgDiv.textContent = message.text;
                    messagesDiv.appendChild(msgDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    break;
                case 'disableBtn':
                    selectFileBtn.disabled = true;
                    selectFileBtn.style.opacity = '0.5';
                    selectFileBtn.textContent = '처리 중...';
                    break;
                case 'enableBtn':
                    selectFileBtn.disabled = false;
                    selectFileBtn.style.opacity = '1';
                    selectFileBtn.textContent = '문서 새로 선택하기';
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
