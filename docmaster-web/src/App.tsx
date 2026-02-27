import { useState, useEffect } from 'react';
import { Brain, Settings, CheckCircle2, ChevronRight, Lock, Upload, User, Mail, BookOpen, HelpCircle, KeyRound, X } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingManualModal } from './components/OnboardingManualModal';
import { UploadZone } from './components/UploadZone';
import { ReportViewer } from './components/ReportViewer';
import { ParsedResultPanel } from './components/ParsedResultPanel';
import { generateReportClient, type ReportUsage, type HtmlTemplateId } from './lib/llmClient';
import { translations } from './lib/translations';
import type { Language } from './lib/translations';

/** 파싱 백엔드 URL. 빌드 시 VITE_API_BASE_URL 있으면 사용, 없으면 Vercel 도메인일 때 배포 백엔드 사용 */
const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location?.hostname || '')) {
    return 'https://doc-master-ai-wsjo.vercel.app';
  }
  return 'http://localhost:8001';
})();

// [UPDATED] 2단계 파이프라인 상태 타입
type AppStep = 'idle' | 'parsing' | 'parsed' | 'generating';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [lang, setLang] = useState<Language>('ko');

  // [UPDATED] 2단계 파이프라인 상태
  const [appStep, setAppStep] = useState<AppStep>('idle');
  const [parsedMarkdown, setParsedMarkdown] = useState<string | null>(null);
  const [parsedFileName, setParsedFileName] = useState<string>('');
  const [parsedFileId, setParsedFileId] = useState<string | null>(null); // [NEW] 서버 저장 file_id
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportUsage, setReportUsage] = useState<ReportUsage | null>(null);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [showKeyRequiredToast, setShowKeyRequiredToast] = useState(false);

  useEffect(() => {
    const llmKey = localStorage.getItem('docmaster_llmKey');
    setHasKeys(!!llmKey);
    const savedLang = localStorage.getItem('docmaster_lang') as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  const handleLanguageToggle = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('docmaster_lang', newLang);
  };

  const t = translations[lang];

  // ─── Step 1: 파일 업로드 → Python 파싱만 수행 ──────────────────────────────
  const handleFileSelect = async (file: File) => {
    setAppStep('parsing');
    try {
      console.log('Python 로컬 서버로 파싱 요청 중...');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `파싱 서버 오류. 백엔드(${API_BASE_URL})가 실행 중인지 확인하세요.`
        );
      }

      const data = await response.json();
      const markdownData: string = data.markdown;
      const fileId: string | null = data.file_id ?? null; // [NEW] 서버 저장 ID

      // [UPDATED] 파싱 결과 저장 → Step 2로 전환
      setParsedMarkdown(markdownData);
      setParsedFileName(file.name);
      setParsedFileId(fileId); // [NEW]
      setAppStep('parsed');
    } catch (error: unknown) {
      console.error('파싱 오류:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`문서 추출 중 오류가 발생했습니다:\n${message}`);
      setAppStep('idle');
    }
  };

  // ─── Step 2: parsedMarkdown + reportType + templateId → LLM 보고서 생성 ────────────────
  const handleGenerateReport = async (
    reportType: 'executive' | 'team',
    templateId: HtmlTemplateId = 'default'
  ) => {
    if (!parsedMarkdown) return;

    const llmProvider = localStorage.getItem('docmaster_llmProvider') || 'openai';
    const llmKey = localStorage.getItem('docmaster_llmKey')?.trim();

    if (!llmKey) {
      alert('LLM API Key가 설정되지 않았습니다. 우측 상단 [설정]에서 입력해주세요.');
      return;
    }

    setAppStep('generating');
    try {
      console.log('LLM으로 리포트 생성 중...', { reportType, templateId });
      const { html, markdown, usage } = await generateReportClient(
        parsedMarkdown,
        llmProvider,
        llmKey,
        reportType,
        templateId
      );
      setReportHtml(html);
      setReportMarkdown(markdown ?? null);
      setReportUsage(usage ?? null);
    } catch (error: unknown) {
      console.error('보고서 생성 오류:', error);
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      // 인증/키 불일치: 선택한 LLM과 다른 제공업체 키를 넣은 경우
      const isKeyOrAuthError =
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('invalid api key') ||
        msg.includes('incorrect api key') ||
        msg.includes('invalid_key') ||
        msg.includes('authentication') ||
        msg.includes('api_key') ||
        msg.includes('api key') ||
        msg.includes('invalid key') ||
        msg.includes('authentication error') ||
        msg.includes('permission denied') ||
        msg.includes('api key not valid') ||
        msg.includes('provide a valid api key');

      // 429 등 한도 관련: 인풋(컨텍스트) 길이 vs 실제 사용량/요청 빈도 구분
      const isContextLength =
        msg.includes('context length') ||
        msg.includes('maximum context') ||
        msg.includes('too many tokens') ||
        msg.includes('input too long') ||
        msg.includes('token limit') ||
        msg.includes('max_tokens') ||
        msg.includes('maximum_tokens');
      const is429OrQuota =
        msg.includes('429') ||
        msg.includes('resource exhausted') ||
        msg.includes('quota') ||
        msg.includes('rate limit');

      if (isKeyOrAuthError) {
        alert(
          `${t.reportError.keyMismatchTitle}\n\n${t.reportError.keyMismatchMessage}`
        );
      } else if (isContextLength) {
        alert(
          '추출된 문서가 너무 깁니다 (컨텍스트 길이 초과).\n\n' +
            '• 더 짧은 문서로 시도하거나, PDF/PPT 페이지 수를 줄여 보세요.\n' +
            '• 또는 설정에서 다른 LLM을 선택해 보세요.'
        );
      } else if (is429OrQuota) {
        alert(
          'API 한도에 도달했습니다 (429).\n\n' +
            '• 요청 빈도/사용량 한도: 잠시 후 다시 시도하거나 다른 LLM을 선택해 보세요.\n' +
            '• 인풋이 너무 길 때도 429가 날 수 있으니, 문서가 매우 길면 짧게 나눠 보세요.'
        );
      } else {
        alert(`보고서 생성 중 오류가 발생했습니다:\n${error instanceof Error ? error.message : String(error)}`);
      }
      setAppStep('parsed'); // 오류 시 parsed 상태로 복원 (재시도 가능)
    }
  };

  // ─── Step 리셋: 새 파일 분석 ──────────────────────────────────────────────
  const handleReset = () => {
    setParsedMarkdown(null);
    setParsedFileName('');
    setParsedFileId(null);
    setReportHtml(null);
    setReportMarkdown(null);
    setReportUsage(null);
    setShowReportPopup(false);
    setAppStep('idle');
  };

  const isProcessing = appStep === 'parsing';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">

      {/* Left Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 hidden lg:flex flex-col justify-between shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Brain size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              DocMaster <span className="text-indigo-600">AI</span>
            </h1>
          </div>

          {/* 2단계 파이프라인 진행 상태 표시 */}
          <div className="mb-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t.sidebar.progressTitle}</h3>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 text-sm ${appStep !== 'idle' && appStep !== 'parsing' ? 'text-emerald-600 font-semibold' : appStep === 'parsing' ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${appStep !== 'idle' && appStep !== 'parsing' ? 'bg-emerald-100 border-emerald-400 text-emerald-600' : appStep === 'parsing' ? 'bg-indigo-100 border-indigo-400 text-indigo-600 animate-pulse' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                  {appStep !== 'idle' && appStep !== 'parsing' ? '✓' : '1'}
                </div>
                <span>{t.sidebar.progressStep1}</span>
              </div>
              <div className="ml-3.5 w-px h-4 bg-slate-200" />
              <div className={`flex items-center gap-3 text-sm ${appStep === 'generating' || reportHtml ? 'text-emerald-600 font-semibold' : appStep === 'parsed' ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${appStep === 'generating' || reportHtml ? 'bg-emerald-100 border-emerald-400 text-emerald-600' : appStep === 'parsed' ? 'bg-indigo-100 border-indigo-400 text-indigo-600' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                  {reportHtml ? '✓' : '2'}
                </div>
                <span>{t.sidebar.progressStep2}</span>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t.sidebar.capabilities}</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 leading-relaxed">{t.sidebar.cap1}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 leading-relaxed">{t.sidebar.cap2}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 leading-relaxed">{t.sidebar.cap3}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 온보딩 메뉴얼 */}
        <div className="px-6 pb-2">
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="w-full p-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/80 hover:border-indigo-200 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors">
              <BookOpen size={20} />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800 block">{t.onboarding.menuLabel}</span>
              <span className="text-xs text-slate-500">{t.onboarding.menuSubtitle}</span>
            </div>
          </button>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 text-slate-500 mb-4">
            <Lock size={16} className="text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wider">{t.sidebar.security}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{t.sidebar.securityDesc}</p>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2 text-slate-500 mb-3">
            <User size={14} className="text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wider">{t.sidebar.developerTitle}</span>
          </div>
          <p className="text-sm font-medium text-slate-700">{t.sidebar.developerName}</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Mail size={12} className="text-slate-400 shrink-0" />
            <span>{t.sidebar.developerContact}:</span>
            <a href={`mailto:${t.sidebar.developerEmail}`} className="text-indigo-600 hover:text-indigo-800 truncate">
              {t.sidebar.developerEmail}
            </a>
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-screen overflow-y-auto">

        {/* Top Header */}
        <header className="px-8 py-6 w-full flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-slate-50/80 border-b border-slate-200/50">
          <div className="lg:hidden flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Brain size={20} />
            </div>
            <h1 className="font-bold text-lg text-slate-900">DocMaster AI</h1>
          </div>
          <div className="hidden lg:block">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>{t.workspace}</span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="text-indigo-600">{t.docAnalysis}</span>
              {parsedFileName && (
                <>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span className="text-slate-700 font-mono truncate max-w-48">{parsedFileName}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200">
              <button
                onClick={() => handleLanguageToggle('ko')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${lang === 'ko' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                KR
              </button>
              <button
                onClick={() => handleLanguageToggle('en')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${lang === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                EN
              </button>
            </div>

            {/* 파싱 완료 시 새 파일 분석 버튼 추가 */}
            {appStep === 'parsed' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all"
              >
                <Upload size={14} />
                새 파일
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all"
              title={t.onboarding.headerHelp}
            >
              <HelpCircle size={16} className="text-slate-500" />
              <span className="hidden sm:inline">{t.onboarding.headerHelp}</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`group flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 shadow-sm border ${hasKeys ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow' : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200'}`}
            >
              <Settings size={16} className={`transition-transform duration-500 ${!hasKeys && 'animate-spin-slow'}`} />
              {hasKeys ? t.config : t.configureApi}
            </button>
          </div>
        </header>

        {/* Workspace Canvas */}
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="w-full max-w-3xl">

            {/* ── Step 1: idle / parsing ── */}
            {(appStep === 'idle' || appStep === 'parsing') && (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                    {t.title}
                  </h2>
                  <p className="text-lg text-slate-500 max-w-xl mx-auto">
                    {t.subtitleLine1}
                    <br />
                    {t.subtitleLine2}
                  </p>
                  <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
                    {t.uploadNoServerStorage}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(true)}
                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 transition-colors"
                  >
                    {t.onboarding.idleHint}
                  </button>
                </div>

                {/* Upload 박스 */}
                <div className="bg-white p-2 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100 transform transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-colors duration-300 group">
                    <div className="px-6 py-12 md:py-20 text-center flex flex-col items-center">
                      <UploadZone
                        onFileSelect={handleFileSelect}
                        disabled={!hasKeys}
                        isProcessing={isProcessing}
                        lang={lang}
                        onNoKeyAttempt={() => setShowKeyRequiredToast(true)}
                      />
                    </div>
                  </div>
                </div>

                {!hasKeys && (
                  <div className="mt-8 text-center animate-fade-in">
                    <p className="text-sm font-medium text-amber-600 bg-amber-50 inline-block px-4 py-2 rounded-full ring-1 ring-amber-200/50">
                      {t.placeholder}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Step 2: parsed / generating ── */}
            {(appStep === 'parsed' || appStep === 'generating' || reportHtml) && parsedMarkdown && (
              <ParsedResultPanel
                parsedMarkdown={parsedMarkdown}
                parsedFileName={parsedFileName}
                parsedFileId={parsedFileId}
                lang={lang}
                onGenerateReport={handleGenerateReport}
                onReset={handleReset}
                reportReady={!!reportHtml}
                reportMarkdown={reportMarkdown}
                reportUsage={reportUsage}
                onViewReport={() => setShowReportPopup(true)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSave={() => {
            setHasKeys(true);
            setIsSettingsOpen(false);
          }}
          lang={lang}
        />
      )}

      {/* Onboarding Manual Modal */}
      {isOnboardingOpen && (
        <OnboardingManualModal onClose={() => setIsOnboardingOpen(false)} lang={lang} />
      )}

      {/* Key required toast — 키 미등록 시 업로드 시도 시 */}
      {showKeyRequiredToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-fade-in flex items-stretch max-w-md w-[calc(100%-2rem)] shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden border border-amber-200/80 bg-white">
          <div className="flex items-center justify-center w-12 shrink-0 bg-amber-500/10 text-amber-600">
            <KeyRound size={24} />
          </div>
          <div className="flex-1 py-4 px-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-800">{t.upload.keyRequiredToastTitle}</h4>
              <button
                type="button"
                onClick={() => setShowKeyRequiredToast(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{t.upload.keyRequiredToastMessage}</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowKeyRequiredToast(false);
                  setIsSettingsOpen(true);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {t.upload.openSettings}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowKeyRequiredToast(false);
                  setIsOnboardingOpen(true);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                {t.upload.showHelp}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Viewer Popup (팝업 모달) */}
      {showReportPopup && reportHtml && (
        <ReportViewer
          htmlContent={reportHtml}
          onClose={() => setShowReportPopup(false)}
          lang={lang}
          variant="popup"
        />
      )}
    </div>
  );
}

export default App;
