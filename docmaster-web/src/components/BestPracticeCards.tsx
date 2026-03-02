/**
 * BestPracticeCards.tsx
 * 메인 화면 하단 베스트 프랙티스 3종 카드.
 * 선택 시 해당 시나리오의 기본 프롬프트가 반영되며, Step 2에서 자동 적용됨.
 */

import { FileText, ListTree, ClipboardCheck, Pencil } from 'lucide-react';
import { translations } from '../lib/translations';
import type { Language } from '../lib/translations';

export type BestPracticeId = 'report' | 'features' | 'testcases';

const BEST_PRACTICES: Array<{
  id: BestPracticeId;
  thumb: string;
  icon: typeof FileText;
}> = [
  { id: 'report', thumb: '/best-practice-report.svg', icon: FileText },
  { id: 'features', thumb: '/best-practice-features.svg', icon: ListTree },
  { id: 'testcases', thumb: '/best-practice-testcases.svg', icon: ClipboardCheck },
];

interface BestPracticeCardsProps {
  selectedId: BestPracticeId;
  onSelect: (id: BestPracticeId) => void;
  onOpenPromptEditor: (id: BestPracticeId) => void;
  lang: Language;
}

export function BestPracticeCards({ selectedId, onSelect, onOpenPromptEditor, lang }: BestPracticeCardsProps) {
  const t = translations[lang].bestPractice;

  const titles: Record<BestPracticeId, string> = {
    report: t.reportTitle,
    features: t.featuresTitle,
    testcases: t.testcasesTitle,
  };
  const descs: Record<BestPracticeId, string> = {
    report: t.reportDesc,
    features: t.featuresDesc,
    testcases: t.testcasesDesc,
  };
  const howTos: Record<BestPracticeId, string> = {
    report: t.reportHowTo,
    features: t.featuresHowTo,
    testcases: t.testcasesHowTo,
  };

  return (
    <div className="mt-10 animate-fade-in">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4 text-center">
        {t.sectionTitle}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {BEST_PRACTICES.map(({ id, thumb, icon: Icon }) => {
          const isSelected = selectedId === id;
          return (
            <div
              key={id}
              className={`text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="w-full text-left"
              >
                <div className="aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={thumb}
                    alt=""
                    className="w-full h-full object-cover"
                    width={320}
                    height={180}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      size={18}
                      className={isSelected ? 'text-indigo-600' : 'text-slate-500'}
                    />
                    <span
                      className={`font-bold text-sm ${
                        isSelected ? 'text-indigo-700' : 'text-slate-800'
                      }`}
                    >
                      {titles[id]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2 line-clamp-2">{descs[id]}</p>
                  <p className="text-xs text-slate-500 italic line-clamp-2">{howTos[id]}</p>
                </div>
              </button>
              <div className="px-4 pb-4 pt-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPromptEditor(id);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Pencil size={14} className="shrink-0" />
                  {t.editPrompt}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
