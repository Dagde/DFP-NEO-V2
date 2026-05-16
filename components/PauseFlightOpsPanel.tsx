import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleEvent } from '../types';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../utils/resourceDisplayNames';

// ─── Types ───────────────────────────────────────────────────────────────────

type PauseRule = 'conclude_by_start' | 'no_start_during';
type ActionChoice = 'cancel_only' | 'reprogram';
type EventTypeKey = 'flight' | 'ftd' | 'cpt' | 'ground';
export type PausePhase = 'configure' | 'building' | 'review';

export interface PauseBuildConfig {
    date: string;
    pauseStart: number;
    pauseEnd: number;
    pauseRule: PauseRule;
    affectedTypes: EventTypeKey[];
    completedEventIds: Set<string>;
    flyingStartTime: number;
    flyingEndTime: number;
    ftdStartTime: number;
    ftdEndTime: number;
    existingEvents: ScheduleEvent[];
}

interface PauseFlightOpsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    eventsForDate: ScheduleEvent[];           // Deduplicated display events for impact preview
    flyingStartTime: number;
    flyingEndTime: number;
    ftdStartTime: number;
    ftdEndTime: number;
    onBuildPause: (config: PauseBuildConfig) => Promise<ScheduleEvent[]>;
    onPublish: (stagedEvents: ScheduleEvent[]) => void;
    authUser?: { userId: string; displayName: string } | null;
    // Pause selection mode - communicated upward so App.tsx can style schedule tiles
    onSelectModeChange: (active: boolean) => void;
    completedEventIds: Set<string>;
    onCompletedEventIdsChange: (ids: Set<string>) => void;
    // Called when build completes with staged events (for live schedule preview)
    onStagedEventsReady: (events: ScheduleEvent[] | null) => void;
    // Called to revert the NEO Build schedule back to the original active DFP
    onRevert: () => void;
    phase: PausePhase;
    onPhaseChange: (phase: PausePhase) => void;
    stagedEvents: ScheduleEvent[];
    onStagedEventsChange: (events: ScheduleEvent[]) => void;
    resourceDisplayNames?: ResourceDisplayNames;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const decToHHMM = (dec: number): string => {
    const h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const hhmmToDec = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h + (m || 0) / 60;
};

const isValidHHMM = (s: string) => /^\d{2}:\d{2}$/.test(s);

// ─── Component ───────────────────────────────────────────────────────────────

const PauseFlightOpsPanel: React.FC<PauseFlightOpsPanelProps> = ({
    isOpen,
    onClose,
    date,
    eventsForDate,
    flyingStartTime,
    flyingEndTime,
    ftdStartTime,
    ftdEndTime,
    onBuildPause,
    onPublish,
    authUser,
    onSelectModeChange,
    completedEventIds,
    onCompletedEventIdsChange,
    onStagedEventsReady,
    onRevert,
    phase,
    onPhaseChange,
    stagedEvents,
    onStagedEventsChange,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
}) => {
    // ── Config state ──────────────────────────────────────────────────────────
    const [pauseStart, setPauseStart] = useState(decToHHMM(flyingStartTime + 2));
    const [pauseEnd, setPauseEnd] = useState(decToHHMM(flyingStartTime + 3));
    const [pauseRule, setPauseRule] = useState<PauseRule>('no_start_during');
    const [affectedTypes, setAffectedTypes] = useState<Set<EventTypeKey>>(new Set(['flight']));
    const [actionChoice, setActionChoice] = useState<ActionChoice>('reprogram');
    const [isSelectingCompleted, setIsSelectingCompleted] = useState(false);
    const [buildProgress, setBuildProgress] = useState('');

    // ── Derived ───────────────────────────────────────────────────────────────
    const pauseStartDec = useMemo(() => isValidHHMM(pauseStart) ? hhmmToDec(pauseStart) : null, [pauseStart]);
    const pauseEndDec   = useMemo(() => isValidHHMM(pauseEnd)   ? hhmmToDec(pauseEnd)   : null, [pauseEnd]);
    const ftdLabel = resourceDisplayNames.ftd;
    const cptLabel = resourceDisplayNames.cpt;

    const validationError = useMemo(() => {
        if (!pauseStartDec || !pauseEndDec) return 'Enter valid times (HH:MM).';
        if (pauseEndDec <= pauseStartDec) return 'Pause end must be after pause start.';
        if (pauseStartDec < flyingStartTime) return `Start must be ≥ ${decToHHMM(flyingStartTime)}.`;
        if (pauseEndDec > flyingEndTime) return `End must be ≤ ${decToHHMM(flyingEndTime)}.`;
        return null;
    }, [pauseStartDec, pauseEndDec, flyingStartTime, flyingEndTime]);

    const cannotReprogram = useMemo(() => {
        const hasReprogrammable = affectedTypes.has('flight') || affectedTypes.has('ftd');
        if (!hasReprogrammable) return `Reprogram requires Flight or ${ftdLabel} selected.`;
        return null;
    }, [affectedTypes, ftdLabel]);

    const impactedEvents = useMemo(() => {
        if (!pauseStartDec || !pauseEndDec) return [];
        return eventsForDate.filter(e => {
            const typeKey = e.type === 'ground' ? 'ground' : e.type as EventTypeKey;
            if (!affectedTypes.has(typeKey)) return false;
            if (e.isCancelled) return false;
            const end = e.startTime + e.duration;
            if (pauseRule === 'no_start_during') {
                return e.startTime >= pauseStartDec && e.startTime < pauseEndDec;
            } else {
                return e.startTime < pauseEndDec && end > pauseStartDec;
            }
        });
    }, [eventsForDate, affectedTypes, pauseRule, pauseStartDec, pauseEndDec]);

    const impactedByType = useMemo(() => {
        const counts: Record<EventTypeKey, number> = { flight: 0, ftd: 0, cpt: 0, ground: 0 };
        impactedEvents.forEach(e => {
            const k = e.type === 'ground' ? 'ground' : e.type as EventTypeKey;
            if (k in counts) counts[k]++;
        });
        return counts;
    }, [impactedEvents]);

    const reviewCancelledCount = useMemo(() =>
        stagedEvents.filter(e => e.isCancelled && (e as any).cancellationCode === 'OPS_PAUSE').length,
        [stagedEvents]
    );
    const reviewActiveCount = useMemo(() =>
        stagedEvents.filter(e => !e.isCancelled).length,
        [stagedEvents]
    );

    // ── Reset when opened ─────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setPauseStart(decToHHMM(flyingStartTime + 2));
            setPauseEnd(decToHHMM(flyingStartTime + 3));
            setPauseRule('no_start_during');
            setAffectedTypes(new Set(['flight']));
            setActionChoice('reprogram');
            onCompletedEventIdsChange(new Set());
            setIsSelectingCompleted(false);
            onPhaseChange('configure');
            onStagedEventsChange([]);
            onStagedEventsReady(null);
            setBuildProgress('');
        }
    }, [isOpen, flyingStartTime]); // eslint-disable-line

    // Notify parent when select mode changes
    useEffect(() => {
        onSelectModeChange(isSelectingCompleted && phase === 'configure');
    }, [isSelectingCompleted, phase]); // eslint-disable-line

    // ── Helpers ───────────────────────────────────────────────────────────────
    const handleToggleType = (t: EventTypeKey) => {
        setAffectedTypes(prev => {
            const next = new Set(prev);
            if (next.has(t)) { next.delete(t); } else { next.add(t); }
            return next;
        });
    };

    const handleBuild = async () => {
        if (validationError || !pauseStartDec || !pauseEndDec) return;
        onPhaseChange('building');
        setBuildProgress('Cancelling impacted events...');

        try {
            const config: PauseBuildConfig = {
                date,
                pauseStart: pauseStartDec,
                pauseEnd: pauseEndDec,
                pauseRule,
                affectedTypes: [...affectedTypes] as EventTypeKey[],
                completedEventIds,
                flyingStartTime,
                flyingEndTime,
                ftdStartTime,
                ftdEndTime,
                existingEvents: eventsForDate,
            };

            setBuildProgress('Running post-pause NEO Build...');
            const result = await onBuildPause(config);
            onStagedEventsChange(result);
            onStagedEventsReady(result);   // Live preview on schedule
            setBuildProgress('Build complete – review and publish.');
            onPhaseChange('review');
        } catch (err) {
            setBuildProgress('Build failed. Please try again.');
            onPhaseChange('configure');
        }
    };

    const handleCancelOnly = () => {
        if (validationError || !pauseStartDec || !pauseEndDec) return;
        const updated = eventsForDate.map(e => {
            if (impactedEvents.some(ie => ie.id === e.id)) {
                return {
                    ...e,
                    isCancelled: true,
                    cancellationCode: 'OPS_PAUSE' as any,
                    cancelledBy: authUser?.displayName || 'System',
                    cancelledAt: new Date().toISOString(),
                };
            }
            return e;
        });
        onStagedEventsChange(updated);
        onStagedEventsReady(updated);
        onPhaseChange('review');
    };

    const handlePublish = () => {
        onPublish(stagedEvents);
        onClose();
    };

    const handleBackToConfigure = () => {
        onPhaseChange('configure');
        onStagedEventsChange([]);
        onStagedEventsReady(null);
        // Restore the original active DFP on the NEO Build schedule
        onRevert();
    };

    const handleRevertToOriginal = () => {
        // Reset all panel state back to initial configure
        onPhaseChange('configure');
        onStagedEventsChange([]);
        onStagedEventsReady(null);
        onCompletedEventIdsChange(new Set());
        setIsSelectingCompleted(false);
        setBuildProgress('');
        // Restore the original active DFP on the NEO Build schedule
        onRevert();
    };

    if (!isOpen) return null;

    const TYPES: { key: EventTypeKey; label: string }[] = [
        { key: 'flight', label: 'Flight' },
        { key: 'ftd',    label: ftdLabel },
        { key: 'cpt',    label: cptLabel },
        { key: 'ground', label: 'Ground' },
    ];

    const sectionHead = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';
    const inputCls = 'bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm px-2 py-1 w-24 focus:outline-none focus:border-sky-500';
    const btnBase = 'px-3 py-1.5 text-xs font-semibold rounded transition-colors';
    const btnGray = `${btnBase} bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600`;
    const btnActive = `${btnBase} bg-sky-700 text-white border border-sky-500`;
    const buildEnabled = !validationError && actionChoice === 'reprogram' && !cannotReprogram;

    return (
        <div
            className="h-full flex flex-col overflow-hidden flex-shrink-0"
            style={{
                width: 300,
                background: '#161b26',
                borderLeft: '1px solid #2a3344',
            }}
        >
            {/* ── Header ── */}
            <div
                className="px-4 py-3 border-b border-gray-700/60 flex-shrink-0 flex items-center justify-between"
                style={{ background: '#1a2030' }}
            >
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6M9 3h6l1 3H8l1-3zM5 21h14a2 2 0 002-2V8H3v11a2 2 0 002 2z" />
                    </svg>
                    <div>
                        <h2 className="text-xs font-bold tracking-widest text-amber-300 uppercase leading-tight">Pause Flight Ops</h2>
                        <p className="text-[9px] text-gray-400 leading-tight">{date}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-200 transition-colors ml-2 flex-shrink-0"
                    title="Close panel"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* ── Phase banner ── */}
            {phase === 'building' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-sky-900/20 border-b border-sky-700/40 flex-shrink-0">
                    <svg className="w-3.5 h-3.5 animate-spin text-sky-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2a10 10 0 1 0 10 10" />
                    </svg>
                    <span className="text-xs text-sky-300 font-semibold">{buildProgress}</span>
                </div>
            )}
            {phase === 'review' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border-b border-green-700/40 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-300 font-semibold">
                        {actionChoice === 'reprogram'
                            ? `Rebuild complete — review on schedule, then publish.`
                            : `Cancellations staged — review on schedule, then publish.`}
                    </span>
                </div>
            )}
            {isSelectingCompleted && phase === 'configure' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border-b border-green-700/40 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <span className="text-[10px] text-green-300 font-semibold flex-1">Click schedule tiles to mark completed</span>
                    <button onClick={() => setIsSelectingCompleted(false)} className="text-[9px] text-green-300 px-1.5 py-0.5 rounded border border-green-700 hover:bg-green-800 flex-shrink-0">Done</button>
                </div>
            )}

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

                {/* Impact summary chips */}
                {pauseStartDec && pauseEndDec && !validationError && (
                    <div className="flex flex-wrap gap-1.5">
                        <div className="flex items-center gap-1 bg-gray-800/60 rounded px-2 py-1 border border-gray-700">
                            <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px] text-gray-300"><span className="text-white font-semibold">{decToHHMM(pauseStartDec)}–{decToHHMM(pauseEndDec)}</span></span>
                        </div>
                        {TYPES.map(({ key, label }) =>
                            affectedTypes.has(key) ? (
                                <div key={key} className={`flex items-center gap-1 rounded px-2 py-1 border ${impactedByType[key] > 0 ? 'bg-amber-900/20 border-amber-700/50' : 'bg-gray-800/40 border-gray-700'}`}>
                                    <span className="text-[9px] text-gray-400">{label}:</span>
                                    <span className={`text-xs font-bold ${impactedByType[key] > 0 ? 'text-amber-300' : 'text-gray-400'}`}>{impactedByType[key]}</span>
                                </div>
                            ) : null
                        )}
                        {completedEventIds.size > 0 && (
                            <div className="flex items-center gap-1 rounded px-2 py-1 border bg-green-900/20 border-green-700/50">
                                <span className="text-[9px] text-gray-400">Done:</span>
                                <span className="text-xs font-bold text-green-300">{completedEventIds.size}</span>
                            </div>
                        )}
                        {actionChoice === 'reprogram' && pauseEndDec && (
                            <div className="flex items-center gap-1 rounded px-2 py-1 border bg-sky-900/20 border-sky-700/50">
                                <span className="text-[9px] text-gray-400">Rebuild:</span>
                                <span className="text-[10px] text-sky-300 font-semibold">{decToHHMM(pauseEndDec)}–{decToHHMM(flyingEndTime)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Review stats */}
                {phase === 'review' && stagedEvents.length > 0 && (
                    <div className="p-3 rounded border border-green-700/30 bg-green-900/10">
                        <p className="text-[11px] text-green-400 font-semibold">
                            ✓ {stagedEvents.length} events staged
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {reviewActiveCount} active · {reviewCancelledCount} cancelled (OPS PAUSE)
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                            Changes are shown on the schedule. Press Publish to commit.
                        </p>
                    </div>
                )}

                {/* ── Pause Period ── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Pause Period</p>
                        <div className="flex items-center gap-2">
                            <div>
                                <label className="block text-[9px] text-gray-400 mb-0.5">Start</label>
                                <input
                                    type="time"
                                    value={pauseStart}
                                    onChange={e => setPauseStart(e.target.value)}
                                    className={inputCls}
                                    disabled={phase !== 'configure'}
                                />
                            </div>
                            <div className="text-gray-500 mt-3">→</div>
                            <div>
                                <label className="block text-[9px] text-gray-400 mb-0.5">End</label>
                                <input
                                    type="time"
                                    value={pauseEnd}
                                    onChange={e => setPauseEnd(e.target.value)}
                                    className={inputCls}
                                    disabled={phase !== 'configure'}
                                />
                            </div>
                        </div>
                        {validationError && (
                            <p className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                                <span>⚠</span> {validationError}
                            </p>
                        )}
                        <p className="mt-1 text-[9px] text-gray-500">Window: {decToHHMM(flyingStartTime)}–{decToHHMM(flyingEndTime)}</p>
                    </div>
                )}

                {/* ── Affected Types ── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Affected Types</p>
                        <div className="flex flex-wrap gap-1.5">
                            {TYPES.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => phase === 'configure' && handleToggleType(key)}
                                    disabled={phase !== 'configure'}
                                    className={`${btnBase} border text-xs py-1 px-2 ${affectedTypes.has(key) ? 'bg-sky-800/60 border-sky-500 text-sky-200' : 'bg-gray-800 border-gray-600 text-gray-400'} ${phase !== 'configure' ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {affectedTypes.size === 0 && (
                            <p className="mt-1 text-[9px] text-amber-400">Select at least one type.</p>
                        )}
                    </div>
                )}

                {/* ── Pause Rule ── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Pause Rule</p>
                        <div className="space-y-1.5">
                            {([
                                {
                                    key: 'no_start_during' as PauseRule,
                                    title: 'No start during pause',
                                    desc: 'Events whose start falls within the pause window are impacted.'
                                },
                                {
                                    key: 'conclude_by_start' as PauseRule,
                                    title: 'All events conclude by pause start',
                                    desc: 'Any event overlapping pause start is also impacted.'
                                }
                            ] as const).map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => phase === 'configure' && setPauseRule(opt.key)}
                                    disabled={phase !== 'configure'}
                                    className={`w-full text-left p-2.5 rounded border transition-colors ${phase !== 'configure' ? 'opacity-50 cursor-not-allowed ' : ''}${pauseRule === opt.key ? 'bg-sky-900/40 border-sky-500/60 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className={`mt-0.5 w-3 h-3 rounded-full border-2 flex-shrink-0 ${pauseRule === opt.key ? 'border-sky-400 bg-sky-400' : 'border-gray-500'}`} />
                                        <div>
                                            <p className={`text-[10px] font-semibold ${pauseRule === opt.key ? 'text-sky-300' : 'text-gray-300'}`}>{opt.title}</p>
                                            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Completed Events ── */}
                {phase === 'configure' && (
                    <div>
                        <p className={sectionHead}>Completed Events</p>
                        <p className="text-[9px] text-gray-400 mb-2 leading-snug">
                            Mark events already completed — the rebuild will skip those trainees. Click tiles on the NEO Build schedule to toggle.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setIsSelectingCompleted(!isSelectingCompleted)}
                                className={isSelectingCompleted ? btnActive : btnGray}
                            >
                                {isSelectingCompleted ? '✓ Selecting...' : 'Select on Schedule'}
                            </button>
                            {completedEventIds.size > 0 && (
                                <button
                                    onClick={() => onCompletedEventIdsChange(new Set())}
                                    className={btnGray}
                                >
                                    Clear ({completedEventIds.size})
                                </button>
                            )}
                        </div>
                        {completedEventIds.size > 0 && (
                            <p className="mt-1 text-[9px] text-green-400">{completedEventIds.size} event{completedEventIds.size !== 1 ? 's' : ''} marked completed</p>
                        )}
                    </div>
                )}

                {/* ── Action After Pause ── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Action After Pause</p>
                        <div className="space-y-1.5">
                            {([
                                {
                                    key: 'reprogram' as ActionChoice,
                                    title: 'Re-program remainder of day',
                                    desc: 'Cancel impacted events then run NEO Build from pause end.'
                                },
                                {
                                    key: 'cancel_only' as ActionChoice,
                                    title: 'Cancel impacted events only',
                                    desc: 'Cancel impacted events, leave schedule unchanged.'
                                }
                            ] as const).map(opt => {
                                const disabled = (opt.key === 'reprogram' && !!cannotReprogram) || phase !== 'configure';
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => !disabled && setActionChoice(opt.key)}
                                        disabled={disabled}
                                        className={`w-full text-left p-2.5 rounded border transition-colors ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-800/40 border-gray-700' : actionChoice === opt.key ? 'bg-sky-900/40 border-sky-500/60 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className={`mt-0.5 w-3 h-3 rounded-full border-2 flex-shrink-0 ${actionChoice === opt.key && !disabled ? 'border-sky-400 bg-sky-400' : 'border-gray-500'}`} />
                                            <div>
                                                <p className={`text-[10px] font-semibold ${actionChoice === opt.key && !disabled ? 'text-sky-300' : 'text-gray-300'}`}>{opt.title}</p>
                                                <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {cannotReprogram && actionChoice === 'reprogram' && (
                            <p className="mt-1 text-[9px] text-amber-400">{cannotReprogram}</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer Buttons ── */}
            <div className="px-4 py-3 border-t border-gray-700/60 space-y-2 flex-shrink-0" style={{ background: '#1a2030' }}>
                {phase === 'configure' && (
                    <>
                        {actionChoice === 'reprogram' ? (
                            <button
                                onClick={handleBuild}
                                disabled={!buildEnabled}
                                className={`w-full py-2 rounded font-bold text-sm tracking-wide transition-all ${buildEnabled ? 'btn-aluminium-brushed hover:opacity-90' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                style={buildEnabled ? { color: '#fb923c' } : {}}
                            >
                                ⚡ NEO BUILD (Post-Pause)
                            </button>
                        ) : (
                            <button
                                onClick={handleCancelOnly}
                                disabled={!!validationError || affectedTypes.size === 0}
                                className={`w-full py-2 rounded font-bold text-sm tracking-wide transition-all ${!validationError && affectedTypes.size > 0 ? 'bg-amber-700 hover:bg-amber-600 text-white border border-amber-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            >
                                Cancel Impacted Events
                            </button>
                        )}
                    </>
                )}

                {phase === 'building' && (
                    <div className="flex items-center gap-2 text-sky-400 text-xs py-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 2a10 10 0 1 0 10 10" />
                        </svg>
                        {buildProgress}
                    </div>
                )}

                {phase === 'review' && (
                    <>
                        <button
                            onClick={handlePublish}
                            className="w-full py-2 rounded font-bold text-sm tracking-wide bg-green-700 hover:bg-green-600 text-white border border-green-500 transition-all"
                        >
                            ✓ PUBLISH — Commit to Active DFP
                        </button>
                        <button
                            onClick={handleBackToConfigure}
                            className={btnGray + ' w-full'}
                        >
                            ← Back to Configure
                        </button>
                        <button
                            onClick={handleRevertToOriginal}
                            className="w-full py-1.5 rounded text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-900/30 transition-colors border border-rose-800/50 hover:border-rose-600 flex items-center justify-center gap-1.5"
                            title="Discard all changes and restore the original Active DFP schedule"
                        >
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                            Revert to Original Daily Schedule
                        </button>
                    </>
                )}

                {phase === 'configure' && completedEventIds.size > 0 && (
                    <button
                        onClick={handleRevertToOriginal}
                        className="w-full py-1.5 rounded text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-900/30 transition-colors border border-rose-800/50 hover:border-rose-600 flex items-center justify-center gap-1.5"
                        title="Clear all selections and restore the original Active DFP schedule"
                    >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        Revert to Original Daily Schedule
                    </button>
                )}

                <button
                    onClick={onClose}
                    className="w-full py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-600"
                >
                    Close / Cancel
                </button>
            </div>
        </div>
    );
};

export default PauseFlightOpsPanel;
