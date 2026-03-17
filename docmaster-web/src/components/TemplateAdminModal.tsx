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
  generateTemplateId,
  TEMPLATE_CATEGORY_STORAGE_KEY,
  type TemplateCategory,
} from '../lib/llmClient';
import { translations } from '../lib/translations';

const BUILTIN_IDS: string[] = ['phase1', 'presentation2', 'preformat', 'testcases', 'features'];

const TEMPLATE_LABEL_KEYS: Record<string, keyof typeof translations.ko.templateAdmin> = {
  phase1: 'templateLabelPhase1',
  presentation2: 'templateLabelPresentation2',
  preformat: 'templateLabelPreformat',
  testcases: 'templateLabelTestcases',
  features: 'templateLabelFeatures',
};

/** 템플릿 ID → 구분자(보고서/개발/품질) */
const TEMPLATE_CATEGORY_KEYS: Record<string, keyof typeof translations.ko.templateAdmin> = {
  phase1: 'templateCategoryReport',
  presentation2: 'templateCategoryReport',
  preformat: 'templateCategoryReport',
  testcases: 'templateCategoryQuality',
  features: 'templateCategoryDev',
};

const TITLE_STORAGE_KEY = 'docmaster_templateTitle_';

export type { TemplateCategory };

function getTemplateCategory(id: string): TemplateCategory | '' {
  const key = TEMPLATE_CATEGORY_KEYS[id];
  if (key === 'templateCategoryReport') return 'report';
  if (key === 'templateCategoryDev') return 'dev';
  if (key === 'templateCategoryQuality') return 'testcases';
  if (typeof localStorage === 'undefined') return '';
  const raw = localStorage.getItem(TEMPLATE_CATEGORY_STORAGE_KEY + id);
  return (raw === 'report' || raw === 'dev' || raw === 'testcases') ? raw : '';
}

function setTemplateCategory(id: string, category: TemplateCategory): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TEMPLATE_CATEGORY_STORAGE_KEY + id, category);
}

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
  const cat = getTemplateCategory(id);
  const categoryLabel = cat === 'report' ? (t.templateCategoryReport as string) : cat === 'dev' ? (t.templateCategoryDev as string) : cat === 'testcases' ? (t.templateCategoryQuality as string) : '';
  const title = getTemplateTitle(id, t);
  return categoryLabel ? `${categoryLabel} · ${title}` : title;
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
  /** 템플릿 추가 성공 시 호출 (보고서 화면 콤보 즉시 갱신용) */
  onTemplateAdded?: () => void;
}

export function TemplateAdminModal({ open, onClose, apiBaseUrl, lang, onTemplateAdded }: TemplateAdminModalProps) {
  const t = translations[lang].templateAdmin;
  const [list, setList] = useState<{ id: string; exists: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string>('presentation2');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [titleEdit, setTitleEdit] = useState<string>('');
  const [categoryEdit, setCategoryEdit] = useState<TemplateCategory>('report');
  const [content, setContent] = useState<string>('');
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addCategory, setAddCategory] = useState<TemplateCategory>('report');
  const [addError, setAddError] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const loadList = useCallback(async () => {
    if (!apiBaseUrl) return;
    try {
      const items = await listTemplatesFromApi(apiBaseUrl);
      const apiMap = new Map((items || []).map((x) => [x.id, x.exists]));
      const builtin = BUILTIN_IDS.map((id) => ({ id, exists: apiMap.get(id) ?? false }));
      const customIds = (items || []).filter((x) => !BUILTIN_IDS.includes(x.id)).map((x) => ({ id: x.id, exists: x.exists }));
      setList([...builtin, ...customIds]);
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
      const cat = getTemplateCategory(id);
      setCategoryEdit(cat || 'report');
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
      if (BUILTIN_IDS.includes(selectedId)) {
        /* built-in: category is fixed */
      } else {
        setTemplateCategory(selectedId, categoryEdit);
      }
      setSaveStatus('done');
      await loadList();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.saveFail);
      setSaveStatus('error');
    }
  };

  const handleResetDefault = () => {
    if (!selectedId) return;
    const defaultContent = getDefaultTemplateContentForAdmin(selectedId);
    setContent(defaultContent);
  };

  const handleTitleBlur = () => {
    setTemplateTitle(selectedId, titleEdit);
  };

  const handleAdd = async () => {
    const id = generateTemplateId(addCategory);
    setAddError(null);
    try {
      await saveTemplateToApi(apiBaseUrl, id, `<!-- ${id} -->\n`);
      setTemplateCategory(id, addCategory);
      if (addTitle.trim()) setTemplateTitle(id, addTitle.trim());
      await loadList();
      setSelectedId(id);
      setShowAddForm(false);
      setAddTitle('');
      setAddCategory('report');
      onTemplateAdded?.();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t.addFail);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !window.confirm(t.confirmDelete.replace('{name}', getTemplateTitle(selectedId, t)))) return;
    try {
      await deleteTemplateFromApi(apiBaseUrl, selectedId);
      const nextList = await listTemplatesFromApi(apiBaseUrl).catch(() => []);
      const next = nextList.find((x) => x.id !== selectedId);
      setSelectedId(next ? next.id : nextList[0]?.id ?? 'presentation2');
      setList(nextList.length ? nextList : BUILTIN_IDS.map((id) => ({ id, exists: false })));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.deleteFail);
    }
  };

  const displayList = list.length ? list : BUILTIN_IDS.map((id) => ({ id, exists: false }));
  const filteredByCategory =
    categoryFilter === 'all'
      ? displayList
      : displayList.filter((item) => getTemplateCategory(item.id) === categoryFilter);

  const isBuiltin = selectedId && BUILTIN_IDS.includes(selectedId);
  const isCustom = selectedId && !BUILTIN_IDS.includes(selectedId);

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
            <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-white/50">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2 py-1 text-xs font-medium rounded ${categoryFilter === 'all' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.filterAll}
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('report')}
                className={`px-2 py-1 text-xs font-medium rounded ${categoryFilter === 'report' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.templateCategoryReport}
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('dev')}
                className={`px-2 py-1 text-xs font-medium rounded ${categoryFilter === 'dev' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.templateCategoryDev}
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('testcases')}
                className={`px-2 py-1 text-xs font-medium rounded ${categoryFilter === 'testcases' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.templateCategoryQuality}
              </button>
            </div>
            <ul className="p-2 overflow-y-auto flex-1">
              {filteredByCategory.map((item) => (
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
                ))}
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
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.addCategoryLabel}</label>
                    <select
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value as TemplateCategory)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
                    >
                      <option value="report">{t.templateCategoryReport}</option>
                      <option value="dev">{t.templateCategoryDev}</option>
                      <option value="testcases">{t.templateCategoryQuality}</option>
                    </select>
                  </div>
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
                      onClick={() => { setShowAddForm(false); setAddError(null); setAddTitle(''); setAddCategory('report'); }}
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
              <div className="px-4 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-white">
                <span className="text-xs text-slate-500">{t.displayNameLabel}</span>
                <input
                  type="text"
                  value={titleEdit}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="flex-1 min-w-[120px] px-2 py-1.5 text-sm border border-slate-300 rounded"
                  placeholder={t.displayNamePlaceholder}
                />
                {isCustom && (
                  <>
                    <span className="text-xs text-slate-500">{t.addCategoryLabel}</span>
                    <select
                      value={categoryEdit}
                      onChange={(e) => setCategoryEdit(e.target.value as TemplateCategory)}
                      className="px-2 py-1.5 text-sm border border-slate-300 rounded"
                    >
                      <option value="report">{t.templateCategoryReport}</option>
                      <option value="dev">{t.templateCategoryDev}</option>
                      <option value="testcases">{t.templateCategoryQuality}</option>
                    </select>
                  </>
                )}
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
                {t.styleGuideDesc}
              </p>
              <div className="flex items-center gap-3">
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
                {saveStatus === 'done' && (
                  <span className="text-sm text-green-600">{t.saved}</span>
                )}
                {isBuiltin && (
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    {t.resetToDefault}
                  </button>
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
