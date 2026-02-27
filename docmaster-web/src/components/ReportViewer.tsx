import { useMemo } from 'react';
import { Download, LayoutPanelLeft, X } from 'lucide-react';
import { translations } from '../lib/translations';
import type { Language } from '../lib/translations';

/** check-list는 CSS ::before로 ✓가 붙으므로, <li> 안에 LLM이 넣은 선두 ✓ 제거 (중복 방지) */
function stripDuplicateCheckmarks(html: string): string {
  return html.replace(/<li>\s*(?:✓\s*)+/gi, '<li>');
}

interface ReportViewerProps {
  htmlContent: string;
  onClose: () => void;
  lang: Language;
  /** popup: 모달 팝업, fullscreen: 전체 화면 (기본) */
  variant?: 'popup' | 'fullscreen';
}

export function ReportViewer({ htmlContent, onClose, lang, variant = 'fullscreen' }: ReportViewerProps) {
  const t = translations[lang].viewer;
  const processedHtml = useMemo(() => stripDuplicateCheckmarks(htmlContent), [htmlContent]);

  const handleDownload = () => {
    const blob = new Blob([processedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DocMaster_Report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isPopup = variant === 'popup';

  const content = (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <LayoutPanelLeft className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
            {t.dashboard}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <Download size={16} />
            {t.download}
          </button>
          {isPopup ? (
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={t.close}
              aria-label={t.close}
            >
              <X size={20} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {t.analyzeNew}
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-hidden p-6 min-h-0">
        <div className="w-full h-full max-w-7xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
          <iframe
            srcDoc={processedHtml}
            title="Generated Report"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </>
  );

  if (isPopup) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-7xl h-[90vh] bg-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-100 flex flex-col">
      {content}
    </div>
  );
}
