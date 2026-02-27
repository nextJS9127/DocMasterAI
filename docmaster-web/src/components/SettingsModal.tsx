import { useState, useEffect } from 'react';
import { Key, ShieldCheck, ExternalLink, Info } from 'lucide-react';
import { translations } from '../lib/translations';
import {
  DEFAULT_PROMPT_EXECUTIVE_EDITABLE,
  DEFAULT_PROMPT_TEAM_EDITABLE,
  DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN,
  DEFAULT_PROMPT_TEAM_EDITABLE_EN,
  getDefaultExecutiveEditable,
  getDefaultTeamEditable,
  HTML_FIXED_EXECUTIVE,
  HTML_FIXED_TEAM,
  getProviderForApiKey,
} from '../lib/llmClient';
import type { Language } from '../lib/translations';

interface SettingsModalProps {
  onClose: () => void;
  onSave: () => void;
  lang: Language;
}

type SettingsTab = 'api' | 'executive' | 'team';

function getStored(key: string, fallback: string): string {
  return typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || fallback) : fallback;
}

export function SettingsModal({ onClose, onSave, lang }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const VALID_LLM_SELECTIONS = ['openai-gpt52', 'openai-gpt51', 'openai', 'claude', 'claude-opus', 'gemini3', 'gemini-25-pro'] as const;
  const [llmProvider, setLlmProvider] = useState(() => {
    const v = getStored('docmaster_llmProvider', 'openai');
    return VALID_LLM_SELECTIONS.includes(v as (typeof VALID_LLM_SELECTIONS)[number]) ? v : 'openai';
  });
  const [llmKey, setLlmKey] = useState(() => getStored('docmaster_llmKey', ''));
  const [promptExecutiveEditable, setPromptExecutiveEditable] = useState(() =>
    getStored('docmaster_promptExecutiveEditable', getDefaultExecutiveEditable(lang))
  );
  const [promptTeamEditable, setPromptTeamEditable] = useState(() =>
    getStored('docmaster_promptTeamEditable', getDefaultTeamEditable(lang))
  );

  const t = translations[lang].settings;

  // 언어 전환 시, 현재 표시 중인 내용이 "다른 언어의 기본값"이면 선택한 언어의 기본 프롬프트로 갱신
  useEffect(() => {
    const otherLang: Language = lang === 'en' ? 'ko' : 'en';
    const defaultOtherExec = otherLang === 'en' ? DEFAULT_PROMPT_EXECUTIVE_EDITABLE_EN : DEFAULT_PROMPT_EXECUTIVE_EDITABLE;
    const defaultOtherTeam = otherLang === 'en' ? DEFAULT_PROMPT_TEAM_EDITABLE_EN : DEFAULT_PROMPT_TEAM_EDITABLE;
    if (promptExecutiveEditable === defaultOtherExec) setPromptExecutiveEditable(getDefaultExecutiveEditable(lang));
    if (promptTeamEditable === defaultOtherTeam) setPromptTeamEditable(getDefaultTeamEditable(lang));
  }, [lang]);

  const handleSave = () => {
    localStorage.setItem('docmaster_llmProvider', llmProvider);
    localStorage.setItem('docmaster_llmKey', llmKey.trim());
    localStorage.setItem('docmaster_promptExecutiveEditable', promptExecutiveEditable);
    localStorage.setItem('docmaster_promptTeamEditable', promptTeamEditable);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Key size={20} className="text-blue-600" />
            {t.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80">
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`flex-1 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === 'api' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.tabApiKey}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('executive')}
            className={`flex-1 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === 'executive' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.tabExecutive}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-3 py-3 text-sm font-semibold transition-colors ${activeTab === 'team' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.tabTeam}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex gap-3 text-sm text-blue-800">
                <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p>{t.securityNotice}</p>
                  <p className="text-blue-700">{t.securityNoticeOriginal}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">{t.llmLabel}</label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="openai-gpt52">OpenAI (GPT-5.2, Thinking)</option>
                  <option value="openai-gpt51">OpenAI (GPT-5.1, Thinking)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="claude">Anthropic (Claude 4.6 Sonnet)</option>
                  <option value="claude-opus">Anthropic (Claude 4.5 Opus)</option>
                  <option value="gemini3">Google (Gemini 3 Pro, Thinking)</option>
                  <option value="gemini-25-pro">Google (Gemini 2.5 Pro, Thinking)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="block text-sm font-semibold text-slate-700">{getProviderForApiKey(llmProvider).toUpperCase()} {t.llmApiKeyLabel}</label>
                  <a href={getProviderForApiKey(llmProvider) === 'openai' ? "https://platform.openai.com/api-keys" : getProviderForApiKey(llmProvider) === 'claude' ? "https://console.anthropic.com/settings/keys" : "https://aistudio.google.com/app/apikey"}
                    target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                    {t.getApiKey} <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Info size={14} /> {t.llmDesc}
                </p>
                <input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder={`sk-...`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'executive' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {t.promptEditableNotice}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setPromptExecutiveEditable(getDefaultExecutiveEditable(lang))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {t.resetPrompts}
                </button>
              </div>
              <label className="block text-sm font-semibold text-slate-700">{t.promptExecutiveLabel}</label>
              <textarea
                value={promptExecutiveEditable}
                onChange={(e) => setPromptExecutiveEditable(e.target.value)}
                rows={14}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs leading-relaxed min-h-[280px] resize-y"
              />
              <p className="text-xs text-slate-500 mt-1">{t.promptHtmlFixedLabelExecutive}</p>
              <pre className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-36 overflow-y-auto whitespace-pre-wrap">
                {HTML_FIXED_EXECUTIVE.trim()}
              </pre>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {t.promptEditableNotice}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setPromptTeamEditable(getDefaultTeamEditable(lang))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {t.resetPrompts}
                </button>
              </div>
              <label className="block text-sm font-semibold text-slate-700">{t.promptTeamLabel}</label>
              <textarea
                value={promptTeamEditable}
                onChange={(e) => setPromptTeamEditable(e.target.value)}
                rows={14}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs leading-relaxed min-h-[280px] resize-y"
              />
              <p className="text-xs text-slate-500 mt-1">{t.promptHtmlFixedLabelTeam}</p>
              <pre className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-md p-3 overflow-x-auto max-h-36 overflow-y-auto whitespace-pre-wrap">
                {HTML_FIXED_TEAM.trim()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!llmKey}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
