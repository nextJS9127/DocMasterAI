import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Language } from '../lib/translations';
import { translations } from '../lib/translations';

export type LoadingPhase = 'parsing' | 'generating';

const STATUS_INTERVAL_MS = 3200;
const TIP_INTERVAL_MS = 6000;
const EQUALIZER_BAR_COUNT = 14;
const EQUALIZER_DURATION_S = 1.4;

export interface LoadingPopupProps {
    phase: LoadingPhase;
    fileName?: string;
    lang: Language;
}

export function LoadingPopup({ phase, fileName = '', lang }: LoadingPopupProps) {
    const t = translations[lang];
    const statusMessages =
        phase === 'parsing'
            ? t.loadingPopup.parsingStatus
            : t.loadingPopup.generatingStatus;
    const tips = t.loadingPopup.tips;

    const [statusIndex, setStatusIndex] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const statusTimer = setInterval(() => {
            setStatusIndex((i) => (i + 1) % statusMessages.length);
        }, STATUS_INTERVAL_MS);
        return () => clearInterval(statusTimer);
    }, [statusMessages.length]);

    useEffect(() => {
        const tipTimer = setInterval(() => {
            setTipIndex((i) => (i + 1) % tips.length);
        }, TIP_INTERVAL_MS);
        return () => clearInterval(tipTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tips.length]);

    const statusText = (() => {
        const raw = statusMessages[statusIndex];
        return raw.replace(/\{fileName\}/g, fileName || '');
    })();

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="mx-4 w-full max-w-[22.4rem] rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-200">
                <div className="flex flex-col items-center text-center">
                    {/* 이퀄라이저 바 — 14개 막대가 한 주기(1.4s)에 균등 분포되어 유동적 웨이브 */}
                    <div
                        className="mb-6 flex h-14 w-full items-end justify-between gap-2 px-1"
                        aria-hidden
                    >
                        {Array.from({ length: EQUALIZER_BAR_COUNT }, (_, i) => (
                            <div
                                key={i}
                                className="flex-1 min-w-0 max-w-6 rounded-full bg-indigo-500"
                                style={{
                                    height: 40,
                                    transformOrigin: 'bottom',
                                    animation: `loading-equalizer-bar ${EQUALIZER_DURATION_S}s ease-in-out infinite`,
                                    animationDelay: `${(i / EQUALIZER_BAR_COUNT) * EQUALIZER_DURATION_S}s`,
                                }}
                            />
                        ))}
                    </div>
                    <Loader2
                        className="mb-4 h-10 w-10 animate-spin text-indigo-600"
                        aria-hidden
                    />
                    <p className="text-lg font-semibold text-slate-800 transition-opacity duration-300">
                        {statusText}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        {phase === 'parsing'
                            ? t.loadingPopup.waitParsing
                            : t.loadingPopup.waitGenerating}
                    </p>

                    <div className="mt-8 w-full rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-left">
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                            {t.loadingPopup.tipLabel}
                        </p>
                        <p className="text-sm font-medium text-indigo-800 transition-opacity duration-300">
                            {tips[tipIndex]}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
