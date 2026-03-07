import { useState } from 'react';
import { Key, ShieldCheck, ExternalLink, Info, Wifi } from 'lucide-react';
import { translations } from '../lib/translations';
import { getProviderForApiKey, verifyLlmConnection } from '../lib/llmClient';
import type { Language } from '../lib/translations';

interface SettingsModalProps {
  onClose: () => void;
  onSave: () => void;
  lang: Language;
}

function getStored(key: string, fallback: string): string {
  return typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || fallback) : fallback;
}

export function SettingsModal({ onClose, onSave, lang }: SettingsModalProps) {
  const VALID_LLM_SELECTIONS = ['openai-gpt52', 'openai-gpt51', 'claude', 'claude-opus', 'gemini3', 'gemini-25-pro'] as const;
  const [llmProvider, setLlmProvider] = useState(() => {
    const v = getStored('docmaster_llmProvider', 'openai-gpt51');
    return VALID_LLM_SELECTIONS.includes(v as (typeof VALID_LLM_SELECTIONS)[number]) ? v : 'openai-gpt51';
  });
  const [llmKey, setLlmKey] = useState(() => getStored('docmaster_llmKey', ''));

  const [verifyStatus, setVerifyStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  const t = translations[lang].settings;

  const handleTestConnection = async () => {
    setVerifyStatus({ status: 'loading' });
    const result = await verifyLlmConnection(llmProvider, llmKey.trim());
    setVerifyStatus(result.success ? { status: 'success' } : { status: 'error', message: result.message });
  };

  const handleSave = () => {
    localStorage.setItem('docmaster_llmProvider', llmProvider);
    localStorage.setItem('docmaster_llmKey', llmKey.trim());
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

        {/* Content — API 키만 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
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
                  onChange={(e) => {
                    setLlmProvider(e.target.value);
                    setVerifyStatus({ status: 'idle' });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="openai-gpt52">OpenAI (GPT-5.2, Thinking)</option>
                  <option value="openai-gpt51">OpenAI (GPT-5.1, Thinking)</option>
                  <option value="claude">Anthropic (Claude 4.6 Sonnet)</option>
                  <option value="claude-opus">Anthropic (Claude 4.5 Opus)</option>
                  <option value="gemini3">Google (Gemini 3.1 Pro, Thinking)</option>
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
                  onChange={(e) => {
                    setLlmKey(e.target.value);
                    setVerifyStatus({ status: 'idle' });
                  }}
                  placeholder={`sk-...`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!llmKey.trim() || verifyStatus.status === 'loading'}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Wifi size={16} />
                  {verifyStatus.status === 'loading' ? t.checking : t.testConnection}
                </button>
                {verifyStatus.status === 'success' && (
                  <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                    ✓ {t.testConnectionSuccess}
                  </p>
                )}
                {verifyStatus.status === 'error' && (
                  <p className="text-sm text-red-600 font-medium">
                    {t.testConnectionError}: {verifyStatus.message}
                  </p>
                )}
              </div>
            </div>
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
