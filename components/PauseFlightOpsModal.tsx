import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ScheduleEvent } from '../types';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../utils/resourceDisplayNames';

// ─── Types ───────────────────────────────────────────────────────────────────

type PauseRule = 'conclude_by_start' | 'no_start_during';
type ActionChoice = 'cancel_only' | 'reprogram';
type EventTypeKey = 'flight' | 'ftd' | 'cpt' | 'ground';
type ModalPhase = 'configure' | 'building' | 'review';

interface PauseFlightOpsModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;                              // Active DFP date
    eventsForDate: ScheduleEvent[];            // Live published schedule events
    flyingStartTime: number;                   // e.g. 8.0
    flyingEndTime: number;                     // e.g. 17.0
    ftdStartTime: number;
    ftdEndTime: number;
    onPublish: (updatedEvents: ScheduleEvent[]) => void;
    onBuildPause: (config: PauseBuildConfig) => Promise<ScheduleEvent[]>;
    authUser?: { userId: string; displayName: string } | null;
    resourceDisplayNames?: ResourceDisplayNames;
}

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

const PauseFlightOpsModal: React.FC<PauseFlightOpsModalProps> = ({
    isOpen,
    onClose,
    date,
    eventsForDate,
    flyingStartTime,
    flyingEndTime,
    ftdStartTime,
    ftdEndTime,
    onPublish,
    onBuildPause,
    authUser,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
}) => {
    // ── Config state ─────────────────────────────────────────────────────────
    const [pauseStart, setPauseStart] = useState(decToHHMM(flyingStartTime + 2));
    const [pauseEnd, setPauseEnd] = useState(decToHHMM(flyingStartTime + 3));
    const [pauseRule, setPauseRule] = useState<PauseRule>('no_start_during');
    const [affectedTypes, setAffectedTypes] = useState<Set<EventTypeKey>>(new Set(['flight']));
    const [actionChoice, setActionChoice] = useState<ActionChoice>('reprogram');
    const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
    const [isSelectingCompleted, setIsSelectingCompleted] = useState(false);
    const [phase, setPhase] = useState<ModalPhase>('configure');
    const [stagedEvents, setStagedEvents] = useState<ScheduleEvent[]>([]);
    const [buildProgress, setBuildProgress] = useState('');
    const [buildDone, setBuildDone] = useState(false);
    const ftdLabel = resourceDisplayNames.ftd;
    const cptLabel = resourceDisplayNames.cpt;

    // drag-select state
    const dragStartRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);

    // ── Derived ───────────────────────────────────────────────────────────────
    const pauseStartDec = useMemo(() => isValidHHMM(pauseStart) ? hhmmToDec(pauseStart) : null, [pauseStart]);
    const pauseEndDec   = useMemo(() => isValidHHMM(pauseEnd)   ? hhmmToDec(pauseEnd)   : null, [pauseEnd]);

    const validationError = useMemo(() => {
        if (!pauseStartDec || !pauseEndDec) return 'Enter valid times (HH:MM).';
        if (pauseEndDec <= pauseStartDec) return 'Pause end must be after pause start.';
        if (pauseStartDec < flyingStartTime) return `Pause start must be within program window (${decToHHMM(flyingStartTime)}–${decToHHMM(flyingEndTime)}).`;
        if (pauseEndDec > flyingEndTime) return `Pause end must be within program window (${decToHHMM(flyingStartTime)}–${decToHHMM(flyingEndTime)}).`;
        return null;
    }, [pauseStartDec, pauseEndDec, flyingStartTime, flyingEndTime]);

    const cannotReprogram = useMemo(() => {
        const hasReprogrammable = affectedTypes.has('flight') || affectedTypes.has('ftd');
        if (!hasReprogrammable) return `Reprogram only applies to Flight and/or ${ftdLabel} events. Select at least one to enable this option.`;
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

    const completedInWindow = useMemo(() =>
        [...completedEventIds].filter(id => impactedEvents.some(e => e.id === id)).length,
        [completedEventIds, impactedEvents]
    );

    const postPauseEvents = useMemo(() => {
        if (!pauseEndDec) return [];
        return eventsForDate.filter(e => e.startTime >= pauseEndDec && !e.isCancelled);
    }, [eventsForDate, pauseEndDec]);

    // ── Reset when opened ──────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setPauseStart(decToHHMM(flyingStartTime + 2));
            setPauseEnd(decToHHMM(flyingStartTime + 3));
            setPauseRule('no_start_during');
            setAffectedTypes(new Set(['flight']));
            setActionChoice('reprogram');
            setCompletedEventIds(new Set());
            setIsSelectingCompleted(false);
            setPhase('configure');
            setStagedEvents([]);
            setBuildProgress('');
            setBuildDone(false);
        }
    }, [isOpen, flyingStartTime]);

    // ── Helpers for completed selection ───────────────────────────────────
    const toggleCompleted = useCallback((eventId: string) => {
        setCompletedEventIds(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
            return next;
        });
    }, []);

    const handleTileMouseDown = useCallback((eventId: string) => {
        if (!isSelectingCompleted) return;
        isDraggingRef.current = true;
        dragStartRef.current = eventId;
        toggleCompleted(eventId);
    }, [isSelectingCompleted, toggleCompleted]);

    const handleTileMouseEnter = useCallback((eventId: string) => {
        if (!isSelectingCompleted || !isDraggingRef.current) return;
        setCompletedEventIds(prev => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
    }, [isSelectingCompleted]);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    // ── Actions ───────────────────────────────────────────────────────────
    const handleToggleType = (t: EventTypeKey) => {
        setAffectedTypes(prev => {
            const next = new Set(prev);
            if (next.has(t)) { next.delete(t); } else { next.add(t); }
            return next;
        });
    };

    const handleBuild = async () => {
        if (validationError || !pauseStartDec || !pauseEndDec) return;
        setPhase('building');
        setBuildProgress('Cancelling impacted events...');
        setBuildDone(false);

        try {
            const config: PauseBuildConfig = {
                date,
                pauseStart: pauseStartDec,
                pauseEnd: pauseEndDec,
                pauseRule,
                affectedTypes: [...affectedTypes],
                completedEventIds,
                flyingStartTime,
                flyingEndTime,
                ftdStartTime,
                ftdEndTime,
                existingEvents: eventsForDate,
            };

            setBuildProgress('Running post-pause NEO Build...');
            const result = await onBuildPause(config);
            setStagedEvents(result);
            setBuildProgress('Build complete – review and publish.');
            setBuildDone(true);
            setPhase('review');
        } catch (err) {
            setBuildProgress('Build failed. Please try again.');
            setPhase('configure');
        }
    };

    const handleCancelOnly = () => {
        if (validationError || !pauseStartDec || !pauseEndDec) return;
        const updated = eventsForDate.map(e => {
            if (impactedEvents.some(ie => ie.id === e.id)) {
                return {
                    ...e,
                    isCancelled: true,
                    cancellationCode: 'OPS PAUSE',
                    cancelledBy: authUser?.displayName || 'System',
                    cancelledAt: new Date().toISOString(),
                };
            }
            return e;
        });
        setStagedEvents(updated);
        setPhase('review');
    };

    const handlePublish = () => {
        onPublish(stagedEvents);
        onClose();
    };

    // ── Review panel: derive bands from stagedEvents ───────────────────────
    // These memos are only meaningful during review phase
    const reviewPrePause = useMemo(() => {
        if (phase !== 'review' || !pauseStartDec) return [];
        return stagedEvents.filter(e => (e.startTime + e.duration) <= pauseStartDec);
    }, [phase, stagedEvents, pauseStartDec]);

    const reviewPauseWindow = useMemo(() => {
        if (phase !== 'review' || !pauseStartDec || !pauseEndDec) return [];
        // Events that overlap the pause window (cancelled ones will show as cancelled)
        return stagedEvents.filter(e => {
            const end = e.startTime + e.duration;
            return e.startTime < pauseEndDec && end > pauseStartDec;
        });
    }, [phase, stagedEvents, pauseStartDec, pauseEndDec]);

    const reviewPostPause = useMemo(() => {
        if (phase !== 'review' || !pauseEndDec) return [];
        return stagedEvents.filter(e => e.startTime >= pauseEndDec);
    }, [phase, stagedEvents, pauseEndDec]);

    // Count summary for review
    const reviewCancelledCount = useMemo(() =>
        stagedEvents.filter(e => e.isCancelled && (e as any).cancellationCode === 'OPS_PAUSE').length,
        [stagedEvents]
    );
    const reviewActiveCount = useMemo(() =>
        stagedEvents.filter(e => !e.isCancelled).length,
        [stagedEvents]
    );
    const reviewPostPauseActive = useMemo(() =>
        reviewPostPause.filter(e => !e.isCancelled).length,
        [reviewPostPause]
    );

    // ── Tile visual state ──────────────────────────────────────────────────
    // During configure phase: show impacted/completed state based on live events
    // During review phase: show actual state from stagedEvents
    const getConfigTileState = (e: ScheduleEvent): 'completed' | 'impacted' | 'cancelled' | 'normal' => {
        if (completedEventIds.has(e.id)) return 'completed';
        if (impactedEvents.some(ie => ie.id === e.id)) return 'impacted';
        if (e.isCancelled) return 'cancelled';
        return 'normal';
    };

    const getReviewTileState = (e: ScheduleEvent): 'completed' | 'impacted' | 'cancelled' | 'normal' | 'rebuilt' => {
        if (e.isCancelled) return 'cancelled';
        // Check if this event existed before and is now "rebuilt" (new id or startTime changed)
        const original = eventsForDate.find(orig => orig.id === e.id);
        if (!original) return 'rebuilt'; // new event from build
        return 'normal';
    };

    const getTileStyle = (state: 'completed' | 'impacted' | 'cancelled' | 'normal' | 'rebuilt') => {
        switch (state) {
            case 'completed': return 'ring-2 ring-green-500 bg-green-900/30';
            case 'impacted':  return 'ring-2 ring-amber-400 bg-amber-900/20';
            case 'cancelled': return 'opacity-60 ring-2 ring-red-500';
            case 'rebuilt':   return 'ring-2 ring-sky-400 bg-sky-900/20';
            default:          return '';
        }
    };

    if (!isOpen) return null;

    const TYPES: { key: EventTypeKey; label: string }[] = [
        { key: 'flight', label: 'Flight' },
        { key: 'ftd',    label: ftdLabel },
        { key: 'cpt',    label: cptLabel },
        { key: 'ground', label: 'Ground School' },
    ];

    const sectionHead = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';
    const inputCls = 'bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm px-2 py-1 w-24 focus:outline-none focus:border-sky-500';
    const btnBase = 'px-3 py-1.5 text-xs font-semibold rounded transition-colors';
    const btnGray = `${btnBase} bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600`;
    const btnActive = `${btnBase} bg-sky-700 text-white border border-sky-500`;
    const buildEnabled = !validationError && actionChoice === 'reprogram' && !cannotReprogram;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onMouseUp={handleMouseUp}
        >
            {/* ── Modal shell ── */}
            <div
                className="flex w-[1100px] max-w-[96vw] max-h-[92vh] rounded-lg overflow-hidden shadow-2xl"
                style={{ background: '#161b26', border: '1px solid #2a3344' }}
            >

                {/* ══ LEFT PANEL ══════════════════════════════════════════════════════ */}
                <div className="flex flex-col w-[370px] flex-shrink-0 border-r border-gray-700/60 overflow-y-auto">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-gray-700/60" style={{ background: '#1a2030' }}>
                        <div className="flex items-center gap-2 mb-0.5">
                            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6M9 3h6l1 3H8l1-3zM5 21h14a2 2 0 002-2V8H3v11a2 2 0 002 2z" />
                            </svg>
                            <h2 className="text-sm font-bold tracking-widest text-amber-300 uppercase">Pause Flight Ops</h2>
                        </div>
                        <p className="text-[10px] text-gray-400 ml-7">{date} &bull; Program window: {decToHHMM(flyingStartTime)}–{decToHHMM(flyingEndTime)}</p>
                    </div>

                    <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">

                        {/* ── Pause timing ─────────────────────────────────────────── */}
                        <div>
                            <p className={sectionHead}>Pause Period</p>
                            <div className="flex items-center gap-3">
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                                    <input
                                        type="time"
                                        value={pauseStart}
                                        onChange={e => setPauseStart(e.target.value)}
                                        className={inputCls}
                                        disabled={phase !== 'configure'}
                                    />
                                </div>
                                <div className="text-gray-500 mt-4">→</div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">End</label>
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
                                <p className="mt-1.5 text-[11px] text-red-400 flex items-center gap-1">
                                    <span className="text-red-400">⚠</span> {validationError}
                                </p>
                            )}
                        </div>

                        {/* ── Affected event types ─────────────────────────────────── */}
                        <div>
                            <p className={sectionHead}>Affected Event Types</p>
                            <div className="flex flex-wrap gap-2">
                                {TYPES.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => phase === 'configure' && handleToggleType(key)}
                                        disabled={phase !== 'configure'}
                                        className={`${btnBase} border ${affectedTypes.has(key) ? 'bg-sky-800/60 border-sky-500 text-sky-200' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400'} ${phase !== 'configure' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {affectedTypes.size === 0 && (
                                <p className="mt-1 text-[10px] text-amber-400">Select at least one event type.</p>
                            )}
                        </div>

                        {/* ── Pause rule ───────────────────────────────────────────── */}
                        <div>
                            <p className={sectionHead}>Pause Rule</p>
                            <div className="space-y-2">
                                {([
                                    {
                                        key: 'no_start_during' as PauseRule,
                                        title: 'No start during pause',
                                        desc: 'Only events whose start time falls within the pause window are impacted. Events already airborne before pause start may continue.'
                                    },
                                    {
                                        key: 'conclude_by_start' as PauseRule,
                                        title: 'All events concluded by pause start',
                                        desc: 'Any selected event overlapping pause start is treated as impacted. Events underway at pause start are cancelled.'
                                    }
                                ] as const).map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => phase === 'configure' && setPauseRule(opt.key)}
                                        disabled={phase !== 'configure'}
                                        className={`w-full text-left p-3 rounded border transition-colors ${phase !== 'configure' ? 'opacity-60 cursor-not-allowed ' : ''}${pauseRule === opt.key ? 'bg-sky-900/40 border-sky-500/60 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${pauseRule === opt.key ? 'border-sky-400 bg-sky-400' : 'border-gray-500'}`} />
                                            <div>
                                                <p className={`text-xs font-semibold ${pauseRule === opt.key ? 'text-sky-300' : 'text-gray-300'}`}>{opt.title}</p>
                                                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Completed event selection ─────────────────────────────── */}
                        {phase === 'configure' && (
                            <div>
                                <p className={sectionHead}>Completed Events</p>
                                <p className="text-[10px] text-gray-400 mb-2 leading-snug">Mark events already completed so the rebuild skips them.</p>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setIsSelectingCompleted(!isSelectingCompleted)}
                                        className={`${isSelectingCompleted ? btnActive : btnGray}`}
                                    >
                                        {isSelectingCompleted ? '✓ Selecting...' : 'Select Completed Events'}
                                    </button>
                                    {completedEventIds.size > 0 && (
                                        <button
                                            onClick={() => setCompletedEventIds(new Set())}
                                            className={btnGray}
                                        >
                                            Clear ({completedEventIds.size})
                                        </button>
                                    )}
                                </div>
                                {completedEventIds.size > 0 && (
                                    <p className="mt-1 text-[10px] text-green-400">{completedEventIds.size} event{completedEventIds.size !== 1 ? 's' : ''} marked completed</p>
                                )}
                            </div>
                        )}

                        {/* ── Action after pause ───────────────────────────────────── */}
                        <div>
                            <p className={sectionHead}>Action After Pause</p>
                            <div className="space-y-2">
                                {([
                                    {
                                        key: 'reprogram' as ActionChoice,
                                        title: 'Re-program remainder of day',
                                        desc: 'Cancel impacted events then run a post-pause NEO Build from pause end to end of program window.'
                                    },
                                    {
                                        key: 'cancel_only' as ActionChoice,
                                        title: 'Cancel impacted events only',
                                        desc: 'Cancel all impacted events and leave the remainder of the schedule unchanged.'
                                    }
                                ] as const).map(opt => {
                                    const disabled = (opt.key === 'reprogram' && !!cannotReprogram) || phase !== 'configure';
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => !disabled && setActionChoice(opt.key)}
                                            disabled={disabled}
                                            className={`w-full text-left p-3 rounded border transition-colors ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-800/40 border-gray-700' : actionChoice === opt.key ? 'bg-sky-900/40 border-sky-500/60 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${actionChoice === opt.key && !disabled ? 'border-sky-400 bg-sky-400' : 'border-gray-500'}`} />
                                                <div>
                                                    <p className={`text-xs font-semibold ${actionChoice === opt.key && !disabled ? 'text-sky-300' : 'text-gray-300'}`}>{opt.title}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {cannotReprogram && actionChoice === 'reprogram' && (
                                <p className="mt-1 text-[10px] text-amber-400">{cannotReprogram}</p>
                            )}
                        </div>
                    </div>

                    {/* ── Footer buttons ──────────────────────────────────────── */}
                    <div className="px-5 py-4 border-t border-gray-700/60 space-y-2" style={{ background: '#1a2030' }}>
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

                        {phase === 'review' && (
                            <button
                                onClick={handlePublish}
                                className="w-full py-2 rounded font-bold text-sm tracking-wide bg-green-700 hover:bg-green-600 text-white border border-green-500 transition-all"
                            >
                                ✓ PUBLISH — Commit to Active DFP
                            </button>
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
                            <button
                                onClick={() => { setPhase('configure'); setStagedEvents([]); }}
                                className={btnGray + ' w-full'}
                            >
                                ← Back to Configure
                            </button>
                        )}

                        <button onClick={onClose} className="w-full py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-600">
                            Close / Cancel
                        </button>
                    </div>
                </div>

                {/* ══ RIGHT PANEL ══════════════════════════════════════════════════════ */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {/* ── Completed-select banner ──────────────────────────────── */}
                    {isSelectingCompleted && phase === 'configure' && (
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-green-700/50 bg-green-900/20 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-xs text-green-300 font-semibold">Completed Event Selection Active — Click or drag tiles below to mark completed</span>
                            <button onClick={() => setCompletedEventIds(new Set())} className="ml-auto text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400">Clear All</button>
                            <button onClick={() => setIsSelectingCompleted(false)} className="text-[10px] text-green-300 px-2 py-0.5 rounded border border-green-700 hover:bg-green-800">Done</button>
                        </div>
                    )}

                    {/* ── Review banner ────────────────────────────────────────── */}
                    {phase === 'review' && (
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-green-700/50 bg-green-900/10 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-xs text-green-300 font-semibold">
                                {actionChoice === 'reprogram'
                                    ? `Post-pause rebuild complete — ${reviewCancelledCount} cancelled, ${reviewPostPauseActive} rebuilt post-pause. Review then PUBLISH.`
                                    : `Cancellations staged — ${reviewCancelledCount} cancelled. Review then PUBLISH.`}
                            </span>
                        </div>
                    )}

                    {/* ── Building progress banner ──────────────────────────────── */}
                    {phase === 'building' && (
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-sky-700/50 bg-sky-900/10 flex-shrink-0">
                            <svg className="w-4 h-4 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 2a10 10 0 1 0 10 10" />
                            </svg>
                            <span className="text-xs text-sky-300 font-semibold">{buildProgress}</span>
                        </div>
                    )}

                    {/* ── Impact summary ───────────────────────────────────────── */}
                    <div className="border-b border-gray-700/60 px-5 py-3 flex-shrink-0" style={{ background: '#1c2333' }}>
                        <div className="flex flex-wrap gap-3">
                            {/* Pause window summary */}
                            {pauseStartDec && pauseEndDec && !validationError && (
                                <div className="flex items-center gap-2 bg-gray-800/60 rounded px-3 py-2 border border-gray-700">
                                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs text-gray-300">Pause: <span className="text-white font-semibold">{decToHHMM(pauseStartDec)}–{decToHHMM(pauseEndDec)}</span></span>
                                </div>
                            )}
                            {/* Impacted counts */}
                            {TYPES.map(({ key, label }) => (
                                affectedTypes.has(key) && (
                                    <div key={key} className={`flex items-center gap-1.5 rounded px-3 py-2 border ${impactedByType[key] > 0 ? 'bg-amber-900/20 border-amber-700/50' : 'bg-gray-800/40 border-gray-700'}`}>
                                        <span className="text-[10px] text-gray-400">{label}:</span>
                                        <span className={`text-sm font-bold ${impactedByType[key] > 0 ? 'text-amber-300' : 'text-gray-400'}`}>{impactedByType[key]}</span>
                                        <span className="text-[10px] text-gray-500">impacted</span>
                                    </div>
                                )
                            ))}
                            {/* Completed count */}
                            {completedEventIds.size > 0 && (
                                <div className="flex items-center gap-1.5 rounded px-3 py-2 border bg-green-900/20 border-green-700/50">
                                    <span className="text-[10px] text-gray-400">Completed:</span>
                                    <span className="text-sm font-bold text-green-300">{completedEventIds.size}</span>
                                </div>
                            )}
                            {/* Post-pause rebuild window */}
                            {actionChoice === 'reprogram' && pauseEndDec && !validationError && (
                                <div className="flex items-center gap-1.5 rounded px-3 py-2 border bg-sky-900/20 border-sky-700/50">
                                    <span className="text-[10px] text-gray-400">Rebuild:</span>
                                    <span className="text-xs text-sky-300 font-semibold">{decToHHMM(pauseEndDec)}–{decToHHMM(flyingEndTime)}</span>
                                </div>
                            )}
                            {/* Review stats */}
                            {phase === 'review' && (
                                <>
                                    <div className="flex items-center gap-1.5 rounded px-3 py-2 border bg-red-900/20 border-red-700/50">
                                        <span className="text-[10px] text-gray-400">Cancelled:</span>
                                        <span className="text-sm font-bold text-red-300">{reviewCancelledCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded px-3 py-2 border bg-green-900/20 border-green-700/50">
                                        <span className="text-[10px] text-gray-400">Active:</span>
                                        <span className="text-sm font-bold text-green-300">{reviewActiveCount}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Schedule tile grid ─────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">

                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            {phase === 'configure' ? (
                                <>
                                    {[
                                        { color: 'bg-gray-500', label: 'Normal' },
                                        { color: 'bg-green-700 ring-2 ring-green-500', label: 'Completed (protected)' },
                                        { color: 'bg-amber-900/50 ring-2 ring-amber-400', label: 'Impacted' },
                                        { color: 'bg-red-900/50 ring-2 ring-red-500', label: 'Already Cancelled' },
                                    ].map(({ color, label }) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <div className={`w-3 h-3 rounded-sm ${color}`} />
                                            <span className="text-[10px] text-gray-400">{label}</span>
                                        </div>
                                    ))}
                                </>
                            ) : phase === 'review' ? (
                                <>
                                    {[
                                        { color: 'bg-gray-500', label: 'Unchanged' },
                                        { color: 'bg-sky-900/60 ring-2 ring-sky-400', label: 'Rebuilt (new)' },
                                        { color: 'bg-red-900/50 ring-2 ring-red-500', label: 'Cancelled (OPS PAUSE)' },
                                    ].map(({ color, label }) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <div className={`w-3 h-3 rounded-sm ${color}`} />
                                            <span className="text-[10px] text-gray-400">{label}</span>
                                        </div>
                                    ))}
                                </>
                            ) : null}
                        </div>

                        {/* ──────────────────────────────────────────────────────────
                            CONFIGURE PHASE: show live events in time bands
                            with impacted/completed highlighting
                        ────────────────────────────────────────────────────────── */}
                        {phase === 'configure' && (
                            <div className="space-y-3">
                                {/* Pre-pause band */}
                                {eventsForDate.filter(e => !e.isCancelled && (e.startTime + e.duration) <= (pauseStartDec ?? 99)).length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Pre-Pause</p>
                                        <div className="flex flex-wrap gap-2">
                                            {eventsForDate
                                                .filter(e => !e.isCancelled && (e.startTime + e.duration) <= (pauseStartDec ?? 99))
                                                .map(e => (
                                                    <EventPill
                                                        key={e.id}
                                                        event={e}
                                                        state={getConfigTileState(e)}
                                                        styleClass={getTileStyle(getConfigTileState(e))}
                                                        onMouseDown={handleTileMouseDown}
                                                        onMouseEnter={handleTileMouseEnter}
                                                        isSelectMode={isSelectingCompleted}
                                                    />
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Pause window band */}
                                {pauseStartDec && pauseEndDec && !validationError && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-500">⏸ Pause Window ({decToHHMM(pauseStartDec)}–{decToHHMM(pauseEndDec)})</p>
                                        </div>
                                        <div className="border border-amber-700/30 rounded bg-amber-900/5 p-2 min-h-[40px]">
                                            <div className="flex flex-wrap gap-2">
                                                {eventsForDate.filter(e => {
                                                    const end = e.startTime + e.duration;
                                                    return !e.isCancelled && e.startTime < (pauseEndDec ?? 0) && end > (pauseStartDec ?? 0);
                                                }).length === 0 && (
                                                    <p className="text-[10px] text-gray-600 italic">No events in pause window</p>
                                                )}
                                                {eventsForDate.filter(e => {
                                                    const end = e.startTime + e.duration;
                                                    return !e.isCancelled && e.startTime < (pauseEndDec ?? 0) && end > (pauseStartDec ?? 0);
                                                }).map(e => (
                                                    <EventPill
                                                        key={e.id}
                                                        event={e}
                                                        state={getConfigTileState(e)}
                                                        styleClass={getTileStyle(getConfigTileState(e))}
                                                        onMouseDown={handleTileMouseDown}
                                                        onMouseEnter={handleTileMouseEnter}
                                                        isSelectMode={isSelectingCompleted}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Post-pause band */}
                                {postPauseEvents.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Post-Pause (current)</p>
                                        <div className="flex flex-wrap gap-2">
                                            {postPauseEvents.map(e => (
                                                <EventPill
                                                    key={e.id}
                                                    event={e}
                                                    state={getConfigTileState(e)}
                                                    styleClass={getTileStyle(getConfigTileState(e))}
                                                    onMouseDown={handleTileMouseDown}
                                                    onMouseEnter={handleTileMouseEnter}
                                                    isSelectMode={isSelectingCompleted}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Status messages */}
                                <div className="mt-2 space-y-1.5">
                                    {impactedEvents.length === 0 && !validationError && pauseStartDec && (
                                        <p className="text-[11px] text-gray-500 italic">No events impacted by current pause settings.</p>
                                    )}
                                    {pauseEndDec && flyingEndTime && pauseEndDec >= flyingEndTime && !validationError && (
                                        <p className="text-[11px] text-amber-400 flex items-center gap-1"><span>⚠</span> Pause end equals or exceeds program end — no rebuild window available.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            BUILDING PHASE: placeholder
                        ────────────────────────────────────────────────────────── */}
                        {phase === 'building' && (
                            <div className="flex flex-col items-center justify-center h-48 gap-4">
                                <svg className="w-10 h-10 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M12 2a10 10 0 1 0 10 10" />
                                </svg>
                                <p className="text-sm text-sky-300 font-semibold">{buildProgress}</p>
                                <p className="text-xs text-gray-500">Running NEO Build algorithm post-pause…</p>
                            </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            REVIEW PHASE: show ALL staged events in three bands
                            sourced from stagedEvents (NOT eventsForDate)
                        ────────────────────────────────────────────────────────── */}
                        {phase === 'review' && (
                            <div className="space-y-4">
                                {/* Pre-pause band */}
                                {reviewPrePause.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                                            Pre-Pause ({reviewPrePause.filter(e => !e.isCancelled).length} active)
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {reviewPrePause.map(e => (
                                                <EventPill
                                                    key={e.id}
                                                    event={e}
                                                    state={getReviewTileState(e)}
                                                    styleClass={getTileStyle(getReviewTileState(e))}
                                                    onMouseDown={() => {}}
                                                    onMouseEnter={() => {}}
                                                    isSelectMode={false}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pause window band — shows cancelled events with X overlay */}
                                {pauseStartDec && pauseEndDec && (
                                    <div>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-500 mb-1.5">
                                            ⏸ Pause Window ({decToHHMM(pauseStartDec)}–{decToHHMM(pauseEndDec)})
                                            {reviewPauseWindow.filter(e => e.isCancelled).length > 0 &&
                                                <span className="text-red-400 ml-1">— {reviewPauseWindow.filter(e => e.isCancelled).length} cancelled</span>}
                                        </p>
                                        <div className="border border-amber-700/30 rounded bg-amber-900/5 p-2 min-h-[40px]">
                                            {reviewPauseWindow.length === 0 ? (
                                                <p className="text-[10px] text-gray-600 italic">No events in pause window</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {reviewPauseWindow.map(e => (
                                                        <EventPill
                                                            key={e.id}
                                                            event={e}
                                                            state={getReviewTileState(e)}
                                                            styleClass={getTileStyle(getReviewTileState(e))}
                                                            onMouseDown={() => {}}
                                                            onMouseEnter={() => {}}
                                                            isSelectMode={false}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Post-pause rebuild band */}
                                <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-widest text-sky-400 mb-1.5">
                                        {actionChoice === 'reprogram' ? '⚡ Post-Pause Rebuild' : 'Post-Pause'}
                                        {reviewPostPause.length > 0 &&
                                            <span className="text-gray-400 ml-1 normal-case font-normal">
                                                — {reviewPostPauseActive} active{reviewPostPause.filter(e => !e.isCancelled && !eventsForDate.find(o => o.id === e.id)).length > 0 ? ` (${reviewPostPause.filter(e => !e.isCancelled && !eventsForDate.find(o => o.id === e.id)).length} new)` : ''}
                                            </span>}
                                    </p>
                                    {reviewPostPause.length === 0 ? (
                                        <p className="text-[10px] text-gray-500 italic">No events scheduled after pause end.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {reviewPostPause.map(e => (
                                                <EventPill
                                                    key={e.id}
                                                    event={e}
                                                    state={getReviewTileState(e)}
                                                    styleClass={getTileStyle(getReviewTileState(e))}
                                                    onMouseDown={() => {}}
                                                    onMouseEnter={() => {}}
                                                    isSelectMode={false}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Total summary */}
                                <div className="mt-2 p-3 rounded border border-green-700/30 bg-green-900/10">
                                    <p className="text-[11px] text-green-400 font-semibold">
                                        ✓ Staged: {stagedEvents.length} total events — {reviewActiveCount} active, {reviewCancelledCount} cancelled (OPS PAUSE)
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Press PUBLISH to commit these changes to the Active DFP.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── EventPill sub-component ───────────────────────────────────────────────────

interface EventPillProps {
    event: ScheduleEvent;
    state: 'completed' | 'impacted' | 'cancelled' | 'normal' | 'rebuilt';
    styleClass: string;
    onMouseDown: (id: string) => void;
    onMouseEnter: (id: string) => void;
    isSelectMode: boolean;
}

const EventPill: React.FC<EventPillProps> = ({ event, state, styleClass, onMouseDown, onMouseEnter, isSelectMode }) => {
    const typeColor: Record<string, string> = {
        flight: 'bg-sky-800/80',
        ftd: 'bg-violet-800/80',
        ground: 'bg-teal-800/80',
        cpt: 'bg-indigo-800/80',
        deployment: 'bg-gray-700/80',
    };
    const base = typeColor[event.type] || 'bg-gray-700/80';
    const person = (event as any).student || (event as any).pilot || (event as any).instructor || '';

    return (
        <div
            onMouseDown={e => { e.preventDefault(); onMouseDown(event.id); }}
            onMouseEnter={() => onMouseEnter(event.id)}
            className={`relative rounded px-2 py-1.5 text-[10px] text-white select-none transition-all ${base} ${styleClass} ${isSelectMode ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ minWidth: 80 }}
        >
            {/* Cancelled cross overlay */}
            {state === 'cancelled' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-4/5 h-4/5 text-red-500 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <line x1="4" y1="4" x2="20" y2="20" />
                        <line x1="20" y1="4" x2="4" y2="20" />
                    </svg>
                </div>
            )}
            {/* Completed check */}
            {state === 'completed' && (
                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center pointer-events-none">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
            )}
            {/* Rebuilt indicator */}
            {state === 'rebuilt' && (
                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-sky-500 rounded-full flex items-center justify-center pointer-events-none">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 0l-2-2m2 2l2-2M4 12h4m0 0l-2 2m2-2l-2-2M20 12h-4m0 0l2 2m-2-2l2-2M12 20v-4m0 0l-2 2m2-2l2 2" /></svg>
                </div>
            )}
            <p className="font-semibold leading-tight">{event.flightNumber}</p>
            <p className="text-gray-300 truncate" style={{ maxWidth: 90 }}>{person}</p>
            <p className="text-gray-400">{decToHHMM(event.startTime)}</p>
        </div>
    );
};

export default PauseFlightOpsModal;
