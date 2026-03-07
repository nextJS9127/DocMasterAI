/**
 * ParsedResultPanel.tsx
 * Step 1(파싱) 완료 후 표시되는 패널 컴포넌트.
 * - 추출 결과 마크다운 미리보기
 * - .md 파일 다운로드 (브라우저 메모리)
 * - 보고서 형식 선택 (보고용 / 실무 공유용)
 * - "보고서 생성" 버튼 (LLM 호출 트리거)
 * - "다른 파일 분석" 리셋 링크
 */

import { useState, useEffect } from 'react';
import { Download, FileText, RefreshCw, ChevronRight, Loader2, FileOutput, FileDown } from 'lucide-react';
import { translations } from '../lib/translations';
import type { Language } from '../lib/translations';
import type { HtmlTemplateId, ReportUsage, ReportType } from '../lib/llmClient';
import {
    listTemplatesFromApi,
    getTemplatesForCategory,
    TEMPLATE_TITLE_STORAGE_KEY,
} from '../lib/llmClient';
import type { BestPracticeId } from './BestPracticeCards';

interface ParsedResultPanelProps {
    parsedMarkdown: string;
    parsedFileName: string;
    parsedFileId: string | null;
    lang: Language;
    bestPracticeId: BestPracticeId;
    apiBaseUrl: string;
    /** 템플릿 관리 모달에서 추가/저장 후 갱신용. 값이 바뀌면 목록 재요청 */
    templateListRefreshTrigger?: number;
    onGenerateReport: (reportType: ReportType, templateId: HtmlTemplateId, highQuality?: boolean) => Promise<void>;
    onReset: () => void;
    /** 경영진용↔실무용 선택 변경 시 호출. 정리 md를 비우고 다음 생성 시 해당 유형으로 다시 만들도록 함 */
    onReportTypeChange?: () => void;
    reportReady?: boolean;
    reportMarkdown?: string | null;
    reportUsage?: ReportUsage | null;
    onViewReport?: () => void;
}

export function ParsedResultPanel({
    parsedMarkdown,
    parsedFileName,
    parsedFileId: _parsedFileId,
    lang,
    bestPracticeId,
    apiBaseUrl,
    templateListRefreshTrigger = 0,
    onGenerateReport,
    onReset,
    onReportTypeChange,
    reportReady = false,
    reportMarkdown = null,
    reportUsage = null,
    onViewReport,
}: ParsedResultPanelProps) {
    const [reportType, setReportType] = useState<'executive' | 'team'>('executive');
    const [htmlTemplateId, setHtmlTemplateId] = useState<HtmlTemplateId>('presentation2');
    const [featuresTemplateId, setFeaturesTemplateId] = useState<string>('features');
    const [testcasesTemplateId, setTestcasesTemplateId] = useState<string>('testcases');
    const [highQuality, setHighQuality] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [templateList, setTemplateList] = useState<{ id: string; exists: boolean }[]>([]);
    const t = translations[lang];
    const tp = t.parsedPanel;
    const bp = t.bestPractice;
    const ta = t.templateAdmin;

    useEffect(() => {
        if (!apiBaseUrl) return;
        listTemplatesFromApi(apiBaseUrl).then(setTemplateList).catch(() => setTemplateList([]));
    }, [apiBaseUrl, templateListRefreshTrigger]);

    const reportTemplateIds = getTemplatesForCategory(templateList, 'report');
    const devTemplateIds = getTemplatesForCategory(templateList, 'dev');
    const tcTemplateIds = getTemplatesForCategory(templateList, 'testcases');

    useEffect(() => {
        if (reportTemplateIds.length > 0 && !reportTemplateIds.includes(htmlTemplateId)) setHtmlTemplateId(reportTemplateIds[0] as HtmlTemplateId);
    }, [reportTemplateIds.join(','), htmlTemplateId]);
    useEffect(() => {
        if (devTemplateIds.length > 0 && !devTemplateIds.includes(featuresTemplateId)) setFeaturesTemplateId(devTemplateIds[0]);
    }, [devTemplateIds.join(','), featuresTemplateId]);
    useEffect(() => {
        if (tcTemplateIds.length > 0 && !tcTemplateIds.includes(testcasesTemplateId)) setTestcasesTemplateId(tcTemplateIds[0]);
    }, [tcTemplateIds.join(','), testcasesTemplateId]);

    function getTemplateOptionLabel(id: string, category: 'report' | 'dev' | 'testcases'): string {
        const customTitle = typeof localStorage !== 'undefined' ? localStorage.getItem(TEMPLATE_TITLE_STORAGE_KEY + id)?.trim() : null;
        if (customTitle) return customTitle;
        if (category === 'report') {
            const labels: Record<string, string> = { phase1: tp.htmlFormatPhase1, presentation2: tp.htmlFormatPresentation, wiki: tp.htmlFormatWiki, preformat: tp.htmlFormatPreformat, pptx: tp.htmlFormatPptx };
            return labels[id] ?? id;
        }
        if (id === 'features') return ta.templateLabelFeatures as string;
        if (id === 'testcases') return ta.templateLabelTestcases as string;
        return id;
    }

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            if (bestPracticeId === 'features') {
                await onGenerateReport('features', featuresTemplateId as HtmlTemplateId);
            } else if (bestPracticeId === 'testcases') {
                await onGenerateReport('testcases', testcasesTemplateId as HtmlTemplateId);
            } else {
                await onGenerateReport(reportType, htmlTemplateId, highQuality);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // 브라우저 메모리에서 .md 다운로드 (즉시, 서버 불필요)
    const handleDownloadMd = () => {
        const blob = new Blob([parsedMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const baseName = parsedFileName.replace(/\.[^/.]+$/, '');
        a.href = url;
        a.download = `${baseName}_extracted.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadReportMd = () => {
        if (!reportMarkdown) return;
        const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const baseName = parsedFileName.replace(/\.[^/.]+$/, '');
        a.href = url;
        a.download = `${baseName}_report.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 미리보기용 줄임 처리 (최대 80줄)
    const previewLines = parsedMarkdown.split('\n').slice(0, 80).join('\n');
    const isTruncated = parsedMarkdown.split('\n').length > 80;
    const totalLines = parsedMarkdown.split('\n').length;

    return (
        <div className="w-full max-w-3xl space-y-6 animate-fade-in">

            {/* Step 1 완료 배너 */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3">
                    <FileText size={20} className="text-emerald-600 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-800">{tp.stepLabel}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                            {tp.fileLabel}: <span className="font-mono font-semibold">{parsedFileName}</span>
                            <span className="ml-2 text-emerald-500">({totalLines.toLocaleString()}{tp.linesUnit})</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shrink-0 ml-4 shadow-sm"
                >
                    <RefreshCw size={16} />
                    {tp.resetFile}
                </button>
            </div>

            {/* 추출 결과 미리보기 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 flex-wrap gap-2">
                    <span className="text-sm font-semibold text-slate-700">{tp.previewTitle}</span>
                    <div className="flex items-center gap-2">
                        {/* 브라우저 메모리에서 즉시 다운로드 */}
                        <button
                            onClick={handleDownloadMd}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full"
                        >
                            <Download size={13} />
                            {tp.downloadMd}
                        </button>
                    </div>
                </div>
                <pre className="p-5 text-xs text-slate-600 leading-relaxed overflow-y-auto max-h-[12.6rem] font-mono whitespace-pre-wrap break-words">
                    {previewLines}
                    {isTruncated && (
                        <span className="block mt-2 text-slate-400 italic">
                            ... ({totalLines - 80} {tp.moreLinesHint})
                        </span>
                    )}
                </pre>
            </div>

            {/* 만들어진 보고서 보기 (팝업) + 토큰/비용 */}
            {reportReady && onViewReport && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
                        <span className="text-sm font-medium text-emerald-800">{tp.reportCompleteMessage}</span>
                        <span className="text-xs text-emerald-600 font-mono">
                            {reportUsage ? (
                                <>
                                    <span title={tp.usageTotalHint}>
                                        {reportUsage.totalTokens.toLocaleString()} {tp.tokensLabel}
                                        {reportUsage.estimatedCostUsd != null && !Number.isNaN(reportUsage.estimatedCostUsd) && (
                                            <> · $ {reportUsage.estimatedCostUsd < 0.01 ? reportUsage.estimatedCostUsd.toFixed(4) : reportUsage.estimatedCostUsd.toFixed(2)}</>
                                        )}
                                    </span>
                                    <span className="block text-[10px] text-emerald-500/90 mt-0.5">{tp.usageTotalHint}</span>
                                </>
                            ) : (
                                tp.usageLabelNone
                            )}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {reportMarkdown && (
                            <button
                                type="button"
                                onClick={handleDownloadReportMd}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-colors"
                            >
                                <FileDown size={18} />
                                {tp.downloadReportMd}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onViewReport}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
                        >
                            <FileOutput size={18} />
                            {tp.viewReport}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: 보고서/피쳐/테스트케이스 형식 선택 + 생성 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <ChevronRight size={16} className="text-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">{tp.step2Label}</span>
                </div>

                {bestPracticeId === 'report' && (
                    <>
                        {/* HTML 형식 선택 */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-600 mb-2">{tp.htmlFormatLabel}</label>
                            <select
                                value={htmlTemplateId}
                                onChange={(e) => setHtmlTemplateId(e.target.value as HtmlTemplateId)}
                                disabled={isGenerating}
                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
                            >
                                {reportTemplateIds.map((id) => (
                                    <option key={id} value={id}>{getTemplateOptionLabel(id, 'report')}</option>
                                ))}
                            </select>
                        </div>

                        {/* 형식 선택 카드 */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <button
                                onClick={() => {
                                    if (reportType !== 'executive') {
                                        setReportType('executive');
                                        onReportTypeChange?.();
                                    }
                                }}
                                disabled={isGenerating}
                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all text-left ${reportType === 'executive'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📊</span>
                                    <div>
                                        <div>{t.reportTypeExecutive}</div>
                                        <div className="text-xs font-normal mt-0.5 opacity-70">{tp.reportTypeExecutiveSub}</div>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    if (reportType !== 'team') {
                                        setReportType('team');
                                        onReportTypeChange?.();
                                    }
                                }}
                                disabled={isGenerating}
                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all text-left ${reportType === 'team'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📋</span>
                                    <div>
                                        <div>{t.reportTypeTeam}</div>
                                        <div className="text-xs font-normal mt-0.5 opacity-70">{tp.reportTypeTeamSub}</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* 고품질 체크박스 — 기능 유지, 화면상 숨김 */}
                        <label className="hidden flex items-start gap-3 mb-6 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={highQuality}
                                onChange={(e) => setHighQuality(e.target.checked)}
                                disabled={isGenerating}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                            />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">
                                <span className="font-semibold">{tp.highQualityLabel}</span>
                                <span className="block text-xs text-slate-500 mt-0.5">{tp.highQualityHint}</span>
                            </span>
                        </label>
                    </>
                )}

                {(bestPracticeId === 'features' || bestPracticeId === 'testcases') && (
                    <>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-600 mb-2">{tp.htmlFormatLabel}</label>
                            <select
                                value={bestPracticeId === 'features' ? featuresTemplateId : testcasesTemplateId}
                                onChange={(e) => bestPracticeId === 'features' ? setFeaturesTemplateId(e.target.value) : setTestcasesTemplateId(e.target.value)}
                                disabled={isGenerating}
                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
                            >
                                {(bestPracticeId === 'features' ? devTemplateIds : tcTemplateIds).map((id) => (
                                    <option key={id} value={id}>{getTemplateOptionLabel(id, bestPracticeId === 'features' ? 'dev' : 'testcases')}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            {bestPracticeId === 'features' ? bp.featuresHowTo : bp.testcasesHowTo}
                        </p>
                    </>
                )}

                {/* 생성 버튼 */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={17} className="animate-spin" />
                            {tp.generating}
                        </>
                    ) : bestPracticeId === 'features' ? (
                        bp.generateFeatures
                    ) : bestPracticeId === 'testcases' ? (
                        bp.generateTestcases
                    ) : (
                        tp.generateReport
                    )}
                </button>
            </div>
        </div>
    );
}
