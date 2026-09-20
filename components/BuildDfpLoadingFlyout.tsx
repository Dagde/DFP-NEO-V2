import React, { useEffect, useRef, useState } from 'react';

type BuildDfpProgress = {
    message?: string;
    percentage?: number;
    iterations?: number;
    combinations?: number;
    calculations?: number;
    generatedEvents?: number;
    elapsedMs?: number;
    phase?: 'running' | 'complete' | 'error';
};

type BuildDfpLoadingFlyoutProps = {
    progress?: BuildDfpProgress;
};

const formatCount = (value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
    return Math.max(0, Math.round(value)).toLocaleString();
};

const formatElapsed = (elapsedMs?: number) => {
    if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 1000) return null;
    return `${(elapsedMs / 1000).toFixed(1)}s`;
};

const BuildDfpLoadingFlyout: React.FC<BuildDfpLoadingFlyoutProps> = ({ progress }) => {
    const actualPercentage = Math.max(0, Math.min(100, Math.round(progress?.percentage ?? 0)));
    const [visiblePercentage, setVisiblePercentage] = useState(Math.max(1, actualPercentage));
    const startedAtRef = useRef(Date.now());
    const highestActualPercentageRef = useRef(actualPercentage);
    const isComplete = progress?.phase === 'complete' || actualPercentage >= 100;
    const isError = progress?.phase === 'error';

    useEffect(() => {
        highestActualPercentageRef.current = Math.max(highestActualPercentageRef.current, actualPercentage);
        if (isComplete || isError) {
            setVisiblePercentage(actualPercentage);
            return;
        }
        setVisiblePercentage(current => Math.max(current, actualPercentage));
    }, [actualPercentage, isComplete, isError]);

    useEffect(() => {
        if (isComplete || isError) return undefined;
        const timer = window.setInterval(() => {
            const elapsedSeconds = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
            const estimatedPreparationProgress = Math.min(92, 1 + elapsedSeconds * 5.5);
            const target = Math.max(highestActualPercentageRef.current, estimatedPreparationProgress);
            setVisiblePercentage(current => {
                const safeCurrent = Math.max(current, highestActualPercentageRef.current);
                const next = safeCurrent + Math.max(0.35, (target - safeCurrent) * 0.18);
                return Math.min(99, Math.max(safeCurrent, next));
            });
        }, 120);
        return () => window.clearInterval(timer);
    }, [isComplete, isError]);

    const percentage = Math.max(0, Math.min(100, Math.round(visiblePercentage)));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (percentage / 100) * circumference;
    const strokeColor = isError ? '#f87171' : isComplete ? '#34d399' : '#38bdf8';
    const elapsedLabel = formatElapsed(progress?.elapsedMs);

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in">
            <div className="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-sky-500/60 bg-gray-900 shadow-2xl">
                <div className="flex flex-col items-center gap-5 p-8">
                    <div className="relative h-32 w-32">
                        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke="rgba(148, 163, 184, 0.22)"
                                strokeWidth="10"
                            />
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                className="transition-all duration-300 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black tabular-nums text-white">{percentage}</span>
                            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">percent</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-semibold text-white">{isComplete ? 'Build calculations complete' : 'Building DFP...'}</p>
                        <p className="mt-2 text-sm text-gray-300">{progress?.message || 'The algorithm is building an optimal schedule.'}</p>
                        {isComplete && !isError && (
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                                Finalising summary before opening NEO Build
                            </p>
                        )}
                    </div>
                    <div className="grid w-full grid-cols-3 gap-2">
                        <div className="rounded-lg border border-slate-600/70 bg-slate-950/50 px-3 py-2 text-center">
                            <div className="text-lg font-black tabular-nums text-white">{formatCount(progress?.iterations)}</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Iterations</div>
                        </div>
                        <div className="rounded-lg border border-slate-600/70 bg-slate-950/50 px-3 py-2 text-center">
                            <div className="text-lg font-black tabular-nums text-white">{formatCount(progress?.combinations)}</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Combinations</div>
                        </div>
                        <div className="rounded-lg border border-slate-600/70 bg-slate-950/50 px-3 py-2 text-center">
                            <div className="text-lg font-black tabular-nums text-white">{formatCount(progress?.calculations)}</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Calculations</div>
                        </div>
                    </div>
                    {(typeof progress?.generatedEvents === 'number' || elapsedLabel) && (
                        <div className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm">
                            <span className="font-semibold text-slate-300">Generated tiles</span>
                            <span className="font-black tabular-nums text-white">{formatCount(progress?.generatedEvents)}</span>
                            {elapsedLabel && (
                                <>
                                    <span className="mx-2 h-4 w-px bg-slate-700" />
                                    <span className="font-semibold text-slate-300">Elapsed</span>
                                    <span className="font-black tabular-nums text-white">{elapsedLabel}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuildDfpLoadingFlyout;
