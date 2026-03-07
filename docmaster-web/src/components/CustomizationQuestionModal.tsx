import { useState } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Language } from '../lib/translations';
import { translations } from '../lib/translations';
import type { CustomizationQuestion } from '../lib/llmClient';

export interface CustomizationQuestionModalProps {
    questions: CustomizationQuestion[];
    lang: Language;
    onSkip: () => void;
    onSubmit: (answers: Record<string, string>) => void;
}

export function CustomizationQuestionModal({
    questions,
    lang,
    onSkip,
    onSubmit,
}: CustomizationQuestionModalProps) {
    const t = translations[lang].customizationModal;
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentPage, setCurrentPage] = useState(0);

    const totalPages = Math.max(1, questions.length);
    const page = Math.min(currentPage, totalPages - 1);
    const q = questions[page];
    const isFirst = page === 0;
    const isLast = page === totalPages - 1;

    const handleOptionChange = (questionId: string, optionId: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    };

    const handleSubmit = () => {
        onSubmit(answers);
    };

    const allAnswered = questions.every((q) => answers[q.id]);

    const goPrev = () => {
        if (!isFirst) setCurrentPage((p) => p - 1);
    };

    const goNext = () => {
        if (!isLast) setCurrentPage((p) => p + 1);
    };

    return (
        <div
            className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            aria-modal="true"
            aria-labelledby="customization-modal-title"
        >
            <div className="mx-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 border-b border-slate-200 px-6 pt-5 pb-4">
                    <div className="flex items-center justify-between">
                        <h2
                            id="customization-modal-title"
                            className="flex items-center gap-2 text-lg font-bold text-slate-800"
                        >
                            <HelpCircle className="h-5 w-5 text-indigo-600" />
                            {t.title}
                        </h2>
                        <button
                            type="button"
                            onClick={onSkip}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label={t.skip}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{t.intro}</p>
                    {totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-1">
                            {questions.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setCurrentPage(i)}
                                    className={`h-2 rounded-full transition-colors ${
                                        i === page ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
                                    }`}
                                    aria-label={i === page ? undefined : `Question ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
                    {q && (
                        <fieldset className="space-y-3">
                            <legend className="text-sm font-semibold text-slate-800">
                                <span className="text-indigo-500 mr-1.5">•</span>
                                {q.text}
                            </legend>
                            <div className="flex flex-wrap gap-2">
                                {q.options.map((opt) => (
                                    <label
                                        key={opt.id}
                                        className={`inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                                            answers[q.id] === opt.id
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name={q.id}
                                            value={opt.id}
                                            checked={answers[q.id] === opt.id}
                                            onChange={() => handleOptionChange(q.id, opt.id)}
                                            className="sr-only"
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}
                </div>
                <div className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        {t.skip}
                    </button>
                    <div className="flex items-center gap-2">
                        {totalPages > 1 && (
                            <button
                                type="button"
                                onClick={goPrev}
                                disabled={isFirst}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                {t.prev}
                            </button>
                        )}
                        {isLast ? (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!allAnswered}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t.submit}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={goNext}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                                {t.next}
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
