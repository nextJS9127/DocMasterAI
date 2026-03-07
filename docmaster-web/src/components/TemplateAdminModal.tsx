import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, FileCode, Plus, Trash2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import {
  listTemplatesFromApi,
  fetchTemplateFromApi,
  saveTemplateToApi,
  deleteTemplateFromApi,
  getDefaultTemplateContentForAdmin,
  type HtmlTemplateId,
} from '../lib/llmClient';
import { translations } from '../lib/translations';

const BUILTIN_IDS: string[] = ['default', 'phase1', 'presentation2', 'wiki', 'preformat', 'testcases', 'features'];

const TEMPLATE_LABEL_KEYS: Record<string, keyof typeof translations.ko.templateAdmin> = {
  default: 'templateLabelDefault',
  phase1: 'templateLabelPhase1',
  presentation2: 'templateLabelPresentation2',
  wiki: 'templateLabelWiki',
  preformat: 'templateLabelPreformat',
  testcases: 'templateLabelTestcases',
  features: 'templateLabelFeatures',
};

/** 템플릿 ID → 구분자(보고서/개발/품질) */
const TEMPLATE_CATEGORY_KEYS: Record<string, keyof typeof translations.ko.templateAdmin> = {
  default: 'templateCategoryReport',
  phase1: 'templateCategoryReport',
  presentation2: 'templateCategoryReport',
  wiki: 'templateCategoryReport',
  preformat: 'templateCategoryReport',
  testcases: 'templateCategoryQuality',
  features: 'templateCategoryDev',
};

const TITLE_STORAGE_KEY = 'docmaster_templateTitle_';
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

function getTemplateTitle(
  id: string,
  t: typeof translations.ko.templateAdmin
): string {
  if (typeof localStorage === 'undefined') return t[TEMPLATE_LABEL_KEYS[id] as keyof typeof t] ?? id;
  const custom = localStorage.getItem(TITLE_STORAGE_KEY + id)?.trim();
  if (custom) return custom;
  const key = TEMPLATE_LABEL_KEYS[id];
  return key ? (t[key] as string) : id;
}

/** 템플릿 목록에 표시할 이름: 구분자 · 표시이름 */
function getTemplateDisplayName(
  id: string,
  t: typeof translations.ko.templateAdmin
): string {
  const categoryKey = TEMPLATE_CATEGORY_KEYS[id];
  const category = categoryKey ? (t[categoryKey] as string) : '';
  const title = getTemplateTitle(id, t);
  return category ? `${category} · ${title}` : title;
}

function setTemplateTitle(id: string, title: string): void {
  if (typeof localStorage === 'undefined') return;
  if (title.trim()) localStorage.setItem(TITLE_STORAGE_KEY + id, title.trim());
  else localStorage.removeItem(TITLE_STORAGE_KEY + id);
}

interface TemplateAdminModalProps {
  open: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  lang: import('../lib/translations').Language;
}

export function TemplateAdminModal({ open, onClose, apiBaseUrl, lang }: TemplateAdminModalProps) {
  const t = translations[lang].templateAdmin;
  const [list, setList] = useState<{ id: string; exists: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string>('default');
  const [titleEdit, setTitleEdit] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addId, setAddId] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const loadList = useCallback(async () => {
    if (!apiBaseUrl) return;
    try {
      const items = await listTemplatesFromApi(apiBaseUrl);
      const apiMap = new Map((items || []).map((x) => [x.id, x.exists]));
      setList(BUILTIN_IDS.map((id) => ({ id, exists: apiMap.get(id) ?? false })));
    } catch {
      setList(BUILTIN_IDS.map((id) => ({ id, exists: false })));
    }
  }, [apiBaseUrl]);

  const loadContent = useCallback(
    async (id: string) => {
      if (!apiBaseUrl || !id) return;
      setLoadStatus('loading');
      setSaveError(null);
      setTitleEdit(getTemplateTitle(id, t));
      const defaultContent = getDefaultTemplateContentForAdmin(id);
      setContent(defaultContent);
      setLoadStatus('done');
      try {
        const text = await fetchTemplateFromApi(apiBaseUrl, id);
        if (selectedIdRef.current !== id) return;
        setContent(text);
      } catch {
        if (selectedIdRef.current !== id) return;
        setContent(defaultContent);
      }
    },
    [apiBaseUrl, t]
  );

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (open && selectedId) loadContent(selectedId);
  }, [open, selectedId, loadContent]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await saveTemplateToApi(apiBaseUrl, selectedId, content);
      setTemplateTitle(selectedId, titleEdit);
      setSaveStatus('done');
      await loadList();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.saveFail);
      setSaveStatus('error');
    }
  };

  const handleTitleBlur = () => {
    setTemplateTitle(selectedId, titleEdit);
  };

  const handleAdd = async () => {
    const id = addId.trim();
    if (!SAFE_ID_REGEX.test(id)) {
      setAddError(t.idInvalid);
      return;
    }
    if (list.some((t) => t.id === id)) {
      setAddError(t.idExists);
      return;
    }
    setAddError(null);
    try {
      await saveTemplateToApi(apiBaseUrl, id, `<!-- ${id} -->\n`);
      if (addTitle.trim()) setTemplateTitle(id, addTitle.trim());
      await loadList();
      setSelectedId(id);
      setShowAddForm(false);
      setAddId('');
      setAddTitle('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t.addFail);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !window.confirm(t.confirmDelete.replace('{name}', getTemplateTitle(selectedId, t)))) return;
    try {
      await deleteTemplateFromApi(apiBaseUrl, selectedId);
      const nextList = await listTemplatesFromApi(apiBaseUrl).catch(() => []);
      const next = nextList.find((t) => t.id !== selectedId);
      setSelectedId(next ? next.id : nextList[0]?.id ?? 'default');
      setList(nextList.length ? nextList : BUILTIN_IDS.map((id) => ({ id, exists: id === 'default' })));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.deleteFail);
    }
  };

  const selectedExists = list.find((t) => t.id === selectedId)?.exists ?? false;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileCode size={22} className="text-indigo-600" />
            {t.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            aria-label={t.closeAria}
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
            <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-200">
              {t.selectTemplate}
            </p>
            <ul className="p-2 overflow-y-auto flex-1">
              {(list.length ? list : BUILTIN_IDS.map((id) => ({ id, exists: false }))).map(
                (item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedId === item.id
                          ? 'bg-indigo-100 text-indigo-800 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {getTemplateDisplayName(item.id, t)}
                      {item.exists && (
                        <span className="ml-1 text-xs text-slate-400">{t.savedBadge}</span>
                      )}
                    </button>
                  </li>
                )
              )}
            </ul>
            <div className="p-2 border-t border-slate-200">
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={16} />
                  {t.addTemplate}
                </button>
              ) : (
                <div className="space-y-2 p-2 bg-white rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={addId}
                    onChange={(e) => setAddId(e.target.value)}
                    placeholder={t.addIdPlaceholder}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder={t.addTitlePlaceholder}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                  />
                  {addError && <p className="text-xs text-red-600">{addError}</p>}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                    >
                      {t.add}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setAddError(null); setAddId(''); setAddTitle(''); }}
                      className="py-1.5 px-2 text-xs font-medium text-slate-600 rounded hover:bg-slate-100"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedId && (
              <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2 bg-white">
                <span className="text-xs text-slate-500">{t.displayNameLabel}</span>
                <input
                  type="text"
                  value={titleEdit}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded"
                  placeholder={t.displayNamePlaceholder}
                />
              </div>
            )}
            {loadStatus === 'loading' && (
              <div className="p-4 text-slate-500 text-sm">{t.loading}</div>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CodeMirror
                value={content}
                height="calc(92vh - 280px)"
                extensions={[html()]}
                onChange={(v) => setContent(v)}
                className="flex-1 text-sm border-0 rounded-none"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50 flex-wrap gap-2">
              <p className="text-xs text-slate-500 max-w-xl">
                {selectedId === 'default'
                  ? t.defaultFormatDesc
                  : t.styleGuideDesc}
              </p>
              <div className="flex items-center gap-3">
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
                {saveStatus === 'done' && (
                  <span className="text-sm text-green-600">{t.saved}</span>
                )}
                {selectedExists && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} />
                    {t.delete}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Save size={16} />
                  {saveStatus === 'saving' ? t.saving : t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
