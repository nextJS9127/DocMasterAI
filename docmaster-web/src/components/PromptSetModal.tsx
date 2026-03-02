/**
 * 산출물별 프롬프트 편집 팝업.
 * - report: 경영진용 / 실무용 2탭
 * - features / testcases: 단일 프롬프트 편집
 */
import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { translations } from '../lib/translations';
import {
  getDefaultExecutiveEditable,
  getDefaultTeamEditable,
  getDefaultFeaturesEditable,
  getDefaultTestcasesEditable,
  DEFAULT_PROMPT_EXECUTIVE_EDITABLE,
  DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN,
  DEFAULT_PROMPT_TEAM_EDITABLE,
  DEFAULT_PROMPT_TEAM_EDITABLE_EN,
  HTML_FIXED_EXECUTIVE,
  HTML_FIXED_TEAM,
} from '../lib/llmClient';
import type { Language } from '../lib/translations';
import type { BestPracticeId } from './BestPracticeCards';

const STORAGE_KEYS = {
  executive: 'docmaster_promptExecutiveEditable',
  team: 'docmaster_promptTeamEditable',
  features: 'docmaster_promptFeaturesEditable',
  testcases: 'docmaster_promptTestcasesEditable',
} as const;

function getStored(key: string, fallback: string): string {
  return typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || fallback) : fallback;
}

interface PromptSetModalProps {
  outcomeId: BestPracticeId;
  lang: Language;
  onClose: () => void;
}

type ReportTab = 'executive' | 'team';

export function PromptSetModal({ outcomeId, lang, onClose }: PromptSetModalProps) {
  const t = translations[lang].settings;
  const bp = translations[lang].bestPractice;
  const promptLang = lang === 'en' ? 'en' : 'ko';

  const [reportTab, setReportTab] = useState<ReportTab>('executive');
  const [promptExecutive, setPromptExecutive] = useState(() =>
    getStored(STORAGE_KEYS.executive, getDefaultExecutiveEditable(promptLang))
  );
  const [promptTeam, setPromptTeam] = useState(() =>
    getStored(STORAGE_KEYS.team, getDefaultTeamEditable(promptLang))
  );
  const [promptFeatures, setPromptFeatures] = useState(() =>
    getStored(STORAGE_KEYS.features, getDefaultFeaturesEditable(promptLang))
  );
  const [promptTestcases, setPromptTestcases] = useState(() =>
    getStored(STORAGE_KEYS.testcases, getDefaultTestcasesEditable(promptLang))
  );

  useEffect(() => {
    const otherLang: Language = lang === 'en' ? 'ko' : 'en';
    const defaultOtherExec = otherLang === 'en' ? DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN : DEFAULT_PROMPT_EXECUTIVE_EDITABLE;
    const defaultOtherTeam = otherLang === 'en' ? DEFAULT_PROMPT_TEAM_EDITABLE_EN : DEFAULT_PROMPT_TEAM_EDITABLE;
    if (promptExecutive === defaultOtherExec) setPromptExecutive(getDefaultExecutiveEditable(promptLang));
    if (promptTeam === defaultOtherTeam) setPromptTeam(getDefaultTeamEditable(promptLang));
  }, [lang]);

  const handleSave = () => {
    if (outcomeId === 'report') {
      localStorage.setItem(STORAGE_KEYS.executive, promptExecutive);
      localStorage.setItem(STORAGE_KEYS.team, promptTeam);
    } else if (outcomeId === 'features') {
      localStorage.setItem(STORAGE_KEYS.features, promptFeatures);
    } else {
      localStorage.setItem(STORAGE_KEYS.testcases, promptTestcases);
    }
    onClose();
  };

  const title =
    outcomeId === 'report'
      ? bp.reportTitle
      : outcomeId === 'features'
        ? bp.featuresTitle
        : bp.testcasesTitle;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[55] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            {title} — {t.promptManagementTitle}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            ✕
          </button>
        </div>

        {outcomeId === 'report' && (
          <>
            <div className="flex border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setReportTab('executive')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold transition-colors ${reportTab === 'executive' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.tabExecutive}
              </button>
              <button
                type="button"
                onClick={() => setReportTab('team')}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold transition-colors ${reportTab === 'team' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.tabTeam}
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {reportTab === 'executive' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">{t.promptEditableNotice}</p>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setPromptExecutive(getDefaultExecutiveEditable(promptLang))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {t.resetPrompts}
                    </button>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">{t.promptExecutiveLabel}</label>
                  <textarea
                    value={promptExecutive}
                    onChange={(e) => setPromptExecutive(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed min-h-[240px] resize-y"
                  />
                  <p className="text-xs text-slate-500 mt-1">{t.promptHtmlFixedLabelExecutive}</p>
                  <pre className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {HTML_FIXED_EXECUTIVE.trim()}
                  </pre>
                </div>
              )}
              {reportTab === 'team' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">{t.promptEditableNotice}</p>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setPromptTeam(getDefaultTeamEditable(promptLang))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {t.resetPrompts}
                    </button>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">{t.promptTeamLabel}</label>
                  <textarea
                    value={promptTeam}
                    onChange={(e) => setPromptTeam(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed min-h-[240px] resize-y"
                  />
                  <p className="text-xs text-slate-500 mt-1">{t.promptHtmlFixedLabelTeam}</p>
                  <pre className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {HTML_FIXED_TEAM.trim()}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {outcomeId === 'features' && (
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">{t.promptEditableNotice}</p>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setPromptFeatures(getDefaultFeaturesEditable(promptLang))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                {t.resetPrompts}
              </button>
            </div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{t.promptFeaturesLabel}</label>
            <textarea
              value={promptFeatures}
              onChange={(e) => setPromptFeatures(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed min-h-[280px] resize-y"
            />
          </div>
        )}

        {outcomeId === 'testcases' && (
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">{t.promptEditableNotice}</p>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setPromptTestcases(getDefaultTestcasesEditable(promptLang))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                {t.resetPrompts}
              </button>
            </div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{t.promptTestcasesLabel}</label>
            <textarea
              value={promptTestcases}
              onChange={(e) => setPromptTestcases(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed min-h-[280px] resize-y"
            />
          </div>
        )}

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md transition-colors">
            {t.cancel}
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors">
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
