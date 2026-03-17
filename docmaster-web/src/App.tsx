import { useState, useEffect } from 'react';
import { Brain, Settings, CheckCircle2, ChevronRight, Lock, Upload, User, Mail, BookOpen, HelpCircle, KeyRound, X, FileCode } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { TemplateAdminModal } from './components/TemplateAdminModal';
import { PromptSetModal } from './components/PromptSetModal';
import { OnboardingManualModal } from './components/OnboardingManualModal';
import { UploadZone } from './components/UploadZone';
import { ReportViewer } from './components/ReportViewer';
import { ParsedResultPanel } from './components/ParsedResultPanel';
import { LoadingPopup } from './components/LoadingPopup';
import { generateReportClient, generateRefinedMarkdownClient, generateHtmlFromMarkdownClient, generateCustomizationQuestionsFromRawClient, generateRefinedMarkdownWithChoicesClient, getReportLoadingMessagesFromRawMd, isLlmRefusalContent, type ReportUsage, type HtmlTemplateId, type ReportType, type CustomizationQuestion } from './lib/llmClient';
import { translations } from './lib/translations';
import type { Language } from './lib/translations';
import { BestPracticeCards, type BestPracticeId } from './components/BestPracticeCards';
import { CustomizationQuestionModal } from './components/CustomizationQuestionModal';
import { MarkdownArtifactViewer } from './components/MarkdownArtifactViewer';

/** 파싱 백엔드 URL. 빌드 시 VITE_API_BASE_URL 있으면 사용, 없으면 Vercel/배포 환경에서는 배포 백엔드 사용 */
const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
    return 'https://doc-master-ai-wsjo.vercel.app';
  }
  return 'http://localhost:8000';
})();

// [UPDATED] 2단계 파이프라인 상태 타입
type AppStep = 'idle' | 'parsing' | 'parsed' | 'generating';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplateAdminOpen, setIsTemplateAdminOpen] = useState(false);
  const [templateListRefreshTrigger, setTemplateListRefreshTrigger] = useState(0);
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
  /** 2차 가공 md가 어떤 보고 유형(executive/team)으로 생성되었는지. 같은 유형이면 HTML 포맷만 바꿀 때 md 재생성 생략 */
  const [reportTypeForMarkdown, setReportTypeForMarkdown] = useState<ReportType | null>(null);
  const [reportUsage, setReportUsage] = useState<ReportUsage | null>(null);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [showMarkdownArtifactViewer, setShowMarkdownArtifactViewer] = useState(false);
  const [showKeyRequiredToast, setShowKeyRequiredToast] = useState(false);
  /** 로딩 팝업: parsing | generating 시 표시. generating 시 subPhase·liveMessages로 "살아있는" 메시지 지원(실험) */
  const [loadingContext, setLoadingContext] = useState<{
    phase: 'parsing' | 'generating';
    fileName: string;
    subPhase?: 'refining' | 'writing';
    liveMessages?: string[];
    pageProgress?: { current: number; total: number };
  } | null>(null);

  /** 맞춤 질문 팝업: 질문 먼저(원문 기반) 후 선택 시 정리 md 1회 생성. rawMarkdown 필수, refinedMd는 건너뛰기/반영 시점에만 생성 */
  const [customizationDraft, setCustomizationDraft] = useState<{
    rawMarkdown: string;
    refinedMd?: string;
    questions: CustomizationQuestion[];
    usage1?: ReportUsage;
    templateId: HtmlTemplateId;
    reportType: 'executive' | 'team';
    llmProvider: string;
    llmKey: string;
    highQuality: boolean;
    apiBaseUrl: string;
  } | null>(null);

  const [selectedBestPractice, setSelectedBestPractice] = useState<BestPracticeId>(() => {
    try {
      const s = localStorage.getItem('docmaster_bestPractice') as BestPracticeId | null;
      return s === 'features' || s === 'testcases' ? s : 'report';
    } catch {
      return 'report';
    }
  });

  const [promptSetOutcomeId, setPromptSetOutcomeId] = useState<BestPracticeId | null>(null);

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

  const handleBestPracticeSelect = (id: BestPracticeId) => {
    setSelectedBestPractice(id);
    try {
      localStorage.setItem('docmaster_bestPractice', id);
    } catch {}
  };

  const t = translations[lang];

  // ─── Step 1: 파일 업로드 → Python 파싱만 수행 ──────────────────────────────
  const handleFileSelect = async (file: File) => {
    setAppStep('parsing');
    setLoadingContext({ phase: 'parsing', fileName: file.name });
    const parseUrl = `${API_BASE_URL}/api/parse`;
    try {
      console.log('파싱 요청:', parseUrl);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(parseUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) throw new Error(t.errors.payloadTooLarge413);
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail || `파싱 서버 오류 (${response.status}). 요청 URL: ${parseUrl}`;
        throw new Error(detail);
      }

      const data = await response.json();
      const markdownData: string = data.markdown;
      const fileId: string | null = data.file_id ?? null; // [NEW] 서버 저장 ID

      // [UPDATED] 파싱 결과 저장 → Step 2로 전환
      setParsedMarkdown(markdownData);
      setParsedFileName(file.name);
      setParsedFileId(fileId); // [NEW]
      setAppStep('parsed');
      setLoadingContext(null);
    } catch (error: unknown) {
      console.error('파싱 오류:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`${t.errors.extractionFailed}:\n${message}`);
      setAppStep('idle');
      setLoadingContext(null);
    }
  };

  // ─── Step 2: parsedMarkdown + reportType + templateId → LLM 보고서 생성 ────────────────
  const handleGenerateReport = async (
    reportType: ReportType,
    templateId: HtmlTemplateId = 'phase1',
    highQuality = false
  ) => {
    if (!parsedMarkdown) return;

    const llmProvider = localStorage.getItem('docmaster_llmProvider') || 'openai-gpt51';
    const llmKey = localStorage.getItem('docmaster_llmKey')?.trim();

    if (!llmKey) {
      alert(t.errors.apiKeyRequired);
      return;
    }

    setAppStep('generating');
    const useTwoPhase = reportType === 'executive' || reportType === 'team' || reportType === 'testcases' || reportType === 'features';
    // 같은 보고서 계열(기획서/개발피처/테스트케이스) + 이미 정리 md 있음 → 정리 md 재생성 없이 선택한 HTML 형식(templateId)으로만 HTML 생성
    const hasValidRefinedMd = reportMarkdown != null && reportMarkdown.trim().length > 0;
    const reuseRefinedMd = useTwoPhase && hasValidRefinedMd && reportTypeForMarkdown === reportType;

    if (useTwoPhase && reuseRefinedMd) {
      setLoadingContext({ phase: 'generating', fileName: parsedFileName || '', subPhase: 'writing', liveMessages: t.loadingPopup.writingPhaseMessages });
    } else if (useTwoPhase) {
      setLoadingContext({ phase: 'generating', fileName: parsedFileName || '', subPhase: 'refining' });
      Promise.race([
        getReportLoadingMessagesFromRawMd(parsedMarkdown, llmProvider, llmKey),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ])
        .then((msgs) => {
          setLoadingContext((prev) =>
            prev && prev.phase === 'generating' ? { ...prev, liveMessages: msgs.length > 0 ? msgs : undefined } : prev
          );
        })
        .catch(() => {});
    } else {
      setLoadingContext({ phase: 'generating', fileName: parsedFileName || '' });
    }

    console.log('[DocMaster] 보고서 생성 시작', { reportType, templateId, highQuality, useTwoPhase, reuseRefinedMd, hasValidRefinedMd: !!hasValidRefinedMd, reportTypeForMarkdown });
    try {
      // 기획서 기반 보고서(경영진/실무) + pptx 아님 → 2단계 파이프라인 (정리 md → HTML)
      if (useTwoPhase) {
        // 5번: 이미 2차 가공 md가 있고, 같은 보고 유형이면 → HTML 포맷만 다시 생성(정리 md 재생성 안 함)
        let refinedMd: string;
        let usage1: ReportUsage | undefined;

        if (reuseRefinedMd) {
          const htmlOnlyTemplateId: HtmlTemplateId =
            reportType === 'testcases' ? 'testcases' : reportType === 'features' ? 'features' : templateId;
          console.log('[DocMaster] 2단계: 기존 정리 md 사용, HTML만 재생성', { templateId, htmlOnlyTemplateId });
          refinedMd = reportMarkdown!.trim();
        } else {
          const isExecutiveOrTeam = reportType === 'executive' || reportType === 'team';
          // 경영진/실무: 원문으로 맞춤 질문만 먼저 생성(빠른 모델). 질문이 있으면 팝업만 띄우고 정리 md는 나중에(제출/건너뛰기 시) 1회만 생성
          if (isExecutiveOrTeam) {
            const { questions, usage: qUsage } = await generateCustomizationQuestionsFromRawClient(
              parsedMarkdown,
              reportType,
              llmProvider,
              llmKey
            );
            if (questions.length > 0) {
              setCustomizationDraft({
                rawMarkdown: parsedMarkdown,
                questions,
                usage1: qUsage,
                templateId,
                reportType,
                llmProvider,
                llmKey,
                highQuality,
                apiBaseUrl: API_BASE_URL,
              });
              setLoadingContext(null);
              console.log('[DocMaster] 맞춤 질문 팝업 표시 (원문 기반)', { questionCount: questions.length });
              return;
            }
          }

          console.log('[DocMaster] 2단계: 정리 md 생성 중...', { reportType, highQuality });
          const result = await generateRefinedMarkdownClient(
            parsedMarkdown,
            llmProvider,
            llmKey,
            reportType,
            highQuality,
            (current, total) => {
              setLoadingContext((prev) =>
                prev ? { ...prev, pageProgress: { current, total } } : null
              );
            }
          );
          if (!result.markdown?.trim()) {
            console.error('정리 md 생성 실패: 결과가 비어 있음', {
              reportType,
              markdownLength: result.markdown?.length ?? 0,
              usage: result.usage,
            });
            throw new Error(t.errors.refinedContentFailed);
          }
          if (isLlmRefusalContent(result.markdown)) {
            throw new Error(t.errors.modelRefusedRequest);
          }
          refinedMd = result.markdown;
          usage1 = result.usage;
          setReportMarkdown(refinedMd);
          setReportTypeForMarkdown(reportType);

          // 정리 md 완료 → "이제 보고서 작성" 단계 메시지로 전환
          setLoadingContext((prev) =>
            prev ? { ...prev, subPhase: 'writing', liveMessages: t.loadingPopup.writingPhaseMessages } : null
          );

          // 맞춤 질문은 이미 원문 기준으로 먼저 시도했고, 질문 없으면 여기까지 옴. 추가 질문 생성 없이 바로 HTML로 진행
        }

        console.log('[DocMaster] 2단계: 정리 md 완료, HTML 생성 중...', { templateId: reportType === 'testcases' ? 'testcases' : reportType === 'features' ? 'features' : templateId, reportType });
        const htmlTemplateId: HtmlTemplateId =
          reportType === 'testcases' ? 'testcases' : reportType === 'features' ? 'features' : templateId;
        try {
          const { html, usage: usage2 } = await generateHtmlFromMarkdownClient(
            refinedMd,
            llmProvider,
            llmKey,
            htmlTemplateId,
            reportType,
            API_BASE_URL,
            highQuality
          );
          if (!html?.trim()) {
            throw new Error('HTML 생성 결과가 비어 있습니다.');
          }
          if (isLlmRefusalContent(html)) {
            throw new Error(t.errors.modelRefusedRequest);
          }
          setReportHtml(html);
          // 정리 md(usage1) + HTML(usage2) 모두 합산하여 총 토큰·비용 표시 (모델별 단가로 각각 계산 후 합산)
          const combinedUsage: ReportUsage | undefined =
            usage1 !== undefined && usage2 !== undefined
              ? {
                  inputTokens: usage1.inputTokens + usage2.inputTokens,
                  outputTokens: usage1.outputTokens + usage2.outputTokens,
                  totalTokens: usage1.totalTokens + usage2.totalTokens,
                  estimatedCostUsd: (usage1.estimatedCostUsd ?? 0) + (usage2.estimatedCostUsd ?? 0),
                }
              : usage2 !== undefined
                ? usage2
                : usage1;
          if (usage1 !== undefined && usage2 === undefined) {
            console.warn('[DocMaster] 2단계: HTML 생성 단계에서 usage가 반환되지 않음. 정리 md 비용만 표시됩니다.', { usage1 });
          }
          if (import.meta.env?.DEV && combinedUsage) {
            console.log('[DocMaster] 2단계 사용량 합산 (정리 md + HTML)', {
              usage1: usage1 ? { inputTokens: usage1.inputTokens, outputTokens: usage1.outputTokens, estimatedCostUsd: usage1.estimatedCostUsd } : null,
              usage2: usage2 ? { inputTokens: usage2.inputTokens, outputTokens: usage2.outputTokens, estimatedCostUsd: usage2.estimatedCostUsd } : null,
              combined: combinedUsage,
            });
          }
          setReportUsage(combinedUsage ?? null);
          setAppStep('parsed');
          setLoadingContext(null);
          console.log('[DocMaster] 보고서 생성 완료 (2단계)');
          return;
        } catch (htmlError) {
          // HTML 생성 실패 시에도 정리 md는 이미 설정되어 있음 → 사용자에게 정리 md라도 보이도록 함
          console.error('[DocMaster] 2단계 HTML 생성 오류', htmlError);
          setReportHtml(null);
          setReportUsage(usage1 ?? null);
          setAppStep('parsed');
          setLoadingContext(null);
          const isRefusal = htmlError instanceof Error && htmlError.message === t.errors.modelRefusedRequest;
          alert(isRefusal ? `${t.errors.modelRefusedRequest}\n\n${t.parsedPanel.htmlFailedRefinedMdAvailable}` : t.parsedPanel.htmlFailedRefinedMdAvailable);
          return;
        }
      }

      console.log('[DocMaster] 1단계(통합) 리포트 생성 중...', { reportType, templateId });
      console.log('[DocMaster] generateReportClient 호출 직전', { parsedMarkdownLength: parsedMarkdown?.length ?? 0 });
      const { html, markdown, usage } = await generateReportClient(
        parsedMarkdown,
        llmProvider,
        llmKey,
        reportType,
        templateId,
        API_BASE_URL
      );
      console.log('[DocMaster] 1단계 반환값', {
        reportType,
        htmlLength: html?.length ?? 0,
        markdownLength: markdown?.length ?? 0,
      });
      const isTcOrFeatures = reportType === 'testcases' || reportType === 'features';
      const isRefusal = isLlmRefusalContent(html ?? '');
      const htmlToSet = isRefusal || (isTcOrFeatures && (!html || html.length === 0))
        ? t.parsedPanel.emptyReportHtml
        : html;
      if (isRefusal) {
        alert(t.errors.modelRefusedRequest);
      }
      const mdToSet = (markdown != null && markdown.length > 0)
        ? markdown
        : isTcOrFeatures
          ? t.parsedPanel.emptyReportMd
          : null;
      console.log('[DocMaster] 1단계 상태 설정', {
        isTcOrFeatures,
        htmlToSetLength: htmlToSet?.length ?? 0,
        mdToSetLength: mdToSet?.length ?? 0,
        willOpenPopup: isTcOrFeatures,
      });
      setReportHtml(htmlToSet);
      setReportMarkdown(mdToSet);
      setReportUsage(usage ?? null);
      setAppStep('parsed');
      setLoadingContext(null);
      console.log('[DocMaster] 보고서 생성 완료 (1단계)');
      if (isTcOrFeatures) {
        setShowReportPopup(true);
      }
    } catch (error: unknown) {
      console.error('[DocMaster] 보고서 생성 오류:', error);
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

      const is503OrOverload =
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('try again later');

      if (isKeyOrAuthError) {
        alert(
          `${t.reportError.keyMismatchTitle}\n\n${t.reportError.keyMismatchMessage}`
        );
      } else if (isContextLength) {
        alert(t.errors.contextTooLong);
      } else if (is429OrQuota) {
        alert(t.errors.rateLimit429);
      } else if (is503OrOverload) {
        alert(t.errors.overloaded503);
      } else {
        alert(`${t.errors.reportGenerateFailed}:\n${error instanceof Error ? error.message : String(error)}`);
      }
      setAppStep('parsed'); // 오류 시 parsed 상태로 복원 (재시도 가능)
      setLoadingContext(null);
    }
  };

  /** 맞춤 질문 팝업: 건너뛰기 → 원문으로 정리 md 1회 생성 후 HTML 생성 */
  const handleCustomizationSkip = () => {
    const d = customizationDraft;
    if (!d) return;
    setCustomizationDraft(null);
    setLoadingContext({ phase: 'generating', fileName: parsedFileName || '', subPhase: 'writing', liveMessages: t.loadingPopup.writingPhaseMessages });
    (async () => {
      try {
        const { markdown: refinedMd, usage: usage1 } = await generateRefinedMarkdownClient(
          d.rawMarkdown,
          d.llmProvider,
          d.llmKey,
          d.reportType,
          d.highQuality
        );
        if (!refinedMd?.trim()) {
          throw new Error(t.errors.refinedContentFailed);
        }
        if (isLlmRefusalContent(refinedMd)) {
          throw new Error(t.errors.modelRefusedRequest);
        }
        setReportMarkdown(refinedMd);
        setReportTypeForMarkdown(d.reportType);
        const { html, usage: usage2 } = await generateHtmlFromMarkdownClient(
          refinedMd,
          d.llmProvider,
          d.llmKey,
          d.templateId,
          d.reportType,
          d.apiBaseUrl,
          d.highQuality
        );
        if (isLlmRefusalContent(html ?? '')) {
          throw new Error(t.errors.modelRefusedRequest);
        }
        setReportHtml(html);
        setReportUsage(
          usage1 && usage2
            ? {
                inputTokens: usage1.inputTokens + usage2.inputTokens,
                outputTokens: usage1.outputTokens + usage2.outputTokens,
                totalTokens: usage1.totalTokens + usage2.totalTokens,
                estimatedCostUsd: (usage1.estimatedCostUsd ?? 0) + (usage2.estimatedCostUsd ?? 0),
              }
            : usage2 ?? usage1 ?? d.usage1 ?? null
        );
        setAppStep('parsed');
        console.log('[DocMaster] 보고서 생성 완료 (맞춤 질문 건너뛰기)');
      } catch (err) {
        console.error('[DocMaster] 맞춤 건너뛰기 후 HTML 생성 오류', err);
        alert(t.parsedPanel.generating + '\n' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoadingContext(null);
      }
    })();
  };

  /** 맞춤 질문 팝업: 반영하여 계속 → 원문+선택으로 정리 md 1회 생성 후 HTML 생성 */
  const handleCustomizationSubmit = (answers: Record<string, string>) => {
    const d = customizationDraft;
    if (!d) return;
    setCustomizationDraft(null);
    setLoadingContext({ phase: 'generating', fileName: parsedFileName || '', subPhase: 'writing', liveMessages: t.loadingPopup.writingPhaseMessages });
    (async () => {
      try {
        const { markdown: finalMd, usage: uRefine } = await generateRefinedMarkdownWithChoicesClient(
          d.rawMarkdown,
          answers,
          d.questions,
          d.reportType,
          d.llmProvider,
          d.llmKey,
          d.highQuality
        );
        const mdToUse = (finalMd != null && finalMd.trim().length > 0) ? finalMd : '';
        if (!mdToUse) {
          throw new Error(t.errors.refinedContentFailed);
        }
        if (isLlmRefusalContent(mdToUse)) {
          throw new Error(t.errors.modelRefusedRequest);
        }
        setReportMarkdown(mdToUse);
        setReportTypeForMarkdown(d.reportType);
        const usage1 = uRefine ?? d.usage1;
        const { html, usage: usage2 } = await generateHtmlFromMarkdownClient(
          mdToUse,
          d.llmProvider,
          d.llmKey,
          d.templateId,
          d.reportType,
          d.apiBaseUrl,
          d.highQuality
        );
        if (isLlmRefusalContent(html ?? '')) {
          throw new Error(t.errors.modelRefusedRequest);
        }
        setReportHtml(html);
        setReportUsage(
          usage1 && usage2
            ? {
                inputTokens: usage1.inputTokens + usage2.inputTokens,
                outputTokens: usage1.outputTokens + usage2.outputTokens,
                totalTokens: usage1.totalTokens + usage2.totalTokens,
                estimatedCostUsd: (usage1.estimatedCostUsd ?? 0) + (usage2.estimatedCostUsd ?? 0),
              }
            : usage2 ?? usage1 ?? null
        );
        setAppStep('parsed');
        console.log('[DocMaster] 보고서 생성 완료 (맞춤 선택 반영)');
      } catch (err) {
        console.error('[DocMaster] 맞춤 반영 후 HTML 생성 오류', err);
        alert(t.parsedPanel.generating + '\n' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoadingContext(null);
      }
    })();
  };

  // ─── Step 리셋: 새 파일 분석 ──────────────────────────────────────────────
  const handleReset = () => {
    setParsedMarkdown(null);
    setParsedFileName('');
    setParsedFileId(null);
    setReportHtml(null);
    setReportMarkdown(null);
    setReportTypeForMarkdown(null);
    setReportUsage(null);
    setShowReportPopup(false);
    setCustomizationDraft(null);
    setAppStep('idle');
  };

  /** 경영진용↔실무용 선택 변경 시 정리 md·보고서 무효화 → 다음 보고서 생성 시 해당 유형으로 다시 생성 */
  const handleReportTypeChange = () => {
    setReportHtml(null);
    setReportMarkdown(null);
    setReportTypeForMarkdown(null);
    setReportUsage(null);
    setShowReportPopup(false);
    setCustomizationDraft(null);
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
          <p className="text-sm font-medium text-slate-700 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.sidebar.developerPortfolioConfirm)) {
                  window.location.href = 'https://rift-server.vercel.app/';
                }
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              {t.sidebar.developerName}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => window.open(lang === 'ko' ? '/user-manual/user-manual.html' : '/user-manual/user-manual-en.html', '_blank', 'noopener,noreferrer,width=960,height=800')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              {t.sidebar.serviceDescriptionLink}
            </button>
          </p>
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
                {t.parsedPanel.newFile}
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
              {hasKeys ? t.keyConfigLabel : t.configureApi}
            </button>
            <button
              onClick={() => setIsTemplateAdminOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <FileCode size={16} className="text-slate-500" />
              {t.templateManageLabel}
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
                    <div className="px-6 py-4 md:py-6 text-center flex flex-col items-center">
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

                <BestPracticeCards
                  selectedId={selectedBestPractice}
                  onSelect={handleBestPracticeSelect}
                  onOpenPromptEditor={setPromptSetOutcomeId}
                  lang={lang}
                />

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
              <>
                <ParsedResultPanel
                  parsedMarkdown={parsedMarkdown}
                  parsedFileName={parsedFileName}
                  parsedFileId={parsedFileId}
                  lang={lang}
                  bestPracticeId={selectedBestPractice}
                  apiBaseUrl={API_BASE_URL}
                  templateListRefreshTrigger={templateListRefreshTrigger}
                  onGenerateReport={handleGenerateReport}
                  onReset={handleReset}
                  onReportTypeChange={handleReportTypeChange}
                  reportReady={!!reportHtml || !!reportMarkdown}
                  reportMarkdown={reportMarkdown}
                  reportUsage={reportUsage}
                  onViewReport={() => {
                    if (reportHtml) setShowReportPopup(true);
                    else if (reportMarkdown) alert(t.parsedPanel.htmlFailedRefinedMdAvailable);
                  }}
                  onViewReportMd={() => setShowMarkdownArtifactViewer(true)}
                />
                {/* 1단계 추출 결과를 기준으로 생성할 문서 타입 선택 — Step2 영역 아래 */}
                <div className="mt-10">
                  <BestPracticeCards
                    selectedId={selectedBestPractice}
                    onSelect={handleBestPracticeSelect}
                    onOpenPromptEditor={setPromptSetOutcomeId}
                    lang={lang}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* 로딩 팝업 — 자료 추출 / 보고서 생성 중 순환 메시지 + 이용 팁 */}
      {loadingContext && (
        <LoadingPopup
          phase={loadingContext.phase}
          fileName={loadingContext.fileName}
          subPhase={loadingContext.subPhase}
          liveMessages={loadingContext.liveMessages}
          pageProgress={loadingContext.pageProgress}
          lang={lang}
        />
      )}

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

      {/* Template Admin Modal (HTML 템플릿 편집) */}
      <TemplateAdminModal
        open={isTemplateAdminOpen}
        onClose={() => {
          setIsTemplateAdminOpen(false);
          setTemplateListRefreshTrigger((t) => t + 1);
        }}
        onTemplateAdded={() => setTemplateListRefreshTrigger((t) => t + 1)}
        apiBaseUrl={API_BASE_URL}
        lang={lang}
      />

      {/* 맞춤 질문 모달: 정리 md 초안 후 강조·구체화 선택 */}
      {customizationDraft && (
        <CustomizationQuestionModal
          questions={customizationDraft.questions}
          lang={lang}
          onSkip={handleCustomizationSkip}
          onSubmit={handleCustomizationSubmit}
        />
      )}

      {/* Prompt Set Modal (산출물별 프롬프트 편집) */}
      {promptSetOutcomeId !== null && (
        <PromptSetModal
          outcomeId={promptSetOutcomeId}
          lang={lang}
          onClose={() => setPromptSetOutcomeId(null)}
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

      {/* 정리 md 아티팩트 뷰어 (팝업: 마크다운 + Mermaid 시각화) */}
      {showMarkdownArtifactViewer && reportMarkdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMarkdownArtifactViewer(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-5xl w-[95vw] max-h-[88vh] bg-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{t.parsedPanel.viewReportMd}</h2>
              <button
                type="button"
                onClick={() => setShowMarkdownArtifactViewer(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label={t.viewer.close}
              >
                <X size={24} />
              </button>
            </header>
            <div className="flex-1 overflow-auto p-6 min-h-0">
              <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                <MarkdownArtifactViewer markdown={reportMarkdown} />
              </div>
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
          fileName={parsedFileName || undefined}
          reportType={reportTypeForMarkdown}
        />
      )}
    </div>
  );
}

export default App;
