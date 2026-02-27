import { BookOpen, ListOrdered, AlertTriangle, Lightbulb } from 'lucide-react';
import { translations } from '../lib/translations';
import type { Language } from '../lib/translations';

interface OnboardingManualModalProps {
  onClose: () => void;
  lang: Language;
}

export function OnboardingManualModal({ onClose, lang }: OnboardingManualModalProps) {
  const t = translations[lang].onboarding;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={22} className="text-indigo-600" />
            {t.title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label={t.close}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 이용 방법 */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-600 mb-3">
              <ListOrdered size={16} />
              {t.usageTitle}
            </h4>
            <ol className="space-y-3">
              {[t.usageStep1, t.usageStep2, t.usageStep3, t.usageStep4].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="pt-0.5">
                    <span className="text-sm text-slate-600 leading-relaxed">{step}</span>
                    {i === 1 && (
                      <p className="mt-1.5 text-xs text-slate-500 italic">{t.usageStep2Notice}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 주의 사항 */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3">
              <AlertTriangle size={16} />
              {t.cautionsTitle}
            </h4>
            <ul className="space-y-2">
              {[t.caution1, t.caution2, t.caution3, t.caution4, t.caution5].map((text, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600 leading-relaxed">
                  <span className="text-amber-500 mt-1.5">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 활용 가이드 */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-600 mb-3">
              <Lightbulb size={16} />
              {t.guideTitle}
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{t.guideIntro}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-2">{t.guideMdTip}</p>
            <ul className="space-y-2 pl-1">
              {[t.guideItem1, t.guideItem2, t.guideItem3].map((text, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600 leading-relaxed">
                  <span className="text-emerald-500 font-medium shrink-0">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
