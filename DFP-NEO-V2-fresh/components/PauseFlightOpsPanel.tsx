import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleEvent } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────────

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
    // Called in real-time as pause start/end inputs change — drives live overlay on NEO Build schedule
    onOverlayTimesChange?: (start: number | null, end: number | null) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

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

/** Generate 5-minute interval times across a range, returning HH:MM strings */
const generate5MinOptions = (startDec: number, endDec: number): string[] => {
    const options: string[] = [];
    const startMinutes = Math.ceil(startDec * 60 / 5) * 5;
    const endMinutes = Math.floor(endDec * 60 / 5) * 5;
    for (let m = startMinutes; m <= endMinutes; m += 5) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        options.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return options;
};

// ─── Component ───────────────────────────────────────────────────────────────────

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
    onOverlayTimesChange,
}) => {
    // ── Config state ────────────────────────────────────────────────────────────
    const [pauseStart, setPauseStart] = useState(decToHHMM(flyingStartTime + 2));
    const [pauseEnd, setPauseEnd] = useState(decToHHMM(flyingStartTime + 3));
    const [pauseRule, setPauseRule] = useState<PauseRule>('no_start_during');
    const [affectedTypes, setAffectedTypes] = useState<Set<EventTypeKey>>(new Set(['flight']));
    const [actionChoice, setActionChoice] = useState<ActionChoice>('reprogram');
    const [isSelectingCompleted, setIsSelectingCompleted] = useState(false);
    const [buildProgress, setBuildProgress] = useState('');

    // ── Derived ──────────────────────────────────────────────────────────────────
    const pauseStartDec = useMemo(() => isValidHHMM(pauseStart) ? hhmmToDec(pauseStart) : null, [pauseStart]);
    const pauseEndDec   = useMemo(() => isValidHHMM(pauseEnd)   ? hhmmToDec(pauseEnd)   : null, [pauseEnd]);

    // Generate dropdown options for start/end
    const startOptions = useMemo(() => generate5MinOptions(flyingStartTime, flyingEndTime - (5 / 60)), [flyingStartTime, flyingEndTime]);
    const endOptions   = useMemo(() => generate5MinOptions(flyingStartTime + (5 / 60), flyingEndTime), [flyingStartTime, flyingEndTime]);

    // Notify parent of live overlay times whenever pause start/end inputs change.
    useEffect(() => {
        if (onOverlayTimesChange) {
            onOverlayTimesChange(pauseStartDec, pauseEndDec);
        }
    }, [pauseStartDec, pauseEndDec]); // eslint-disable-line react-hooks/exhaustive-deps

    const validationError = useMemo(() => {
        if (!pauseStartDec || !pauseEndDec) return 'Enter valid times (HH:MM).';
        if (pauseEndDec <= pauseStartDec) return 'Pause end must be after pause start.';
        if (pauseStartDec < flyingStartTime) return `Start must be >= ${decToHHMM(flyingStartTime)}.`;
        if (pauseEndDec > flyingEndTime) return `End must be <= ${decToHHMM(flyingEndTime)}.`;
        return null;
    }, [pauseStartDec, pauseEndDec, flyingStartTime, flyingEndTime]);

    const cannotReprogram = useMemo(() => {
        const hasReprogrammable = affectedTypes.has('flight') || affectedTypes.has('ftd');
        if (!hasReprogrammable) return 'Reprogram requires Flight or FTD selected.';
        return null;
    }, [affectedTypes]);

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

    // ── Reset when opened ────────────────────────────────────────────────────────
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

    // ── Action handlers ──────────────────────────────────────────────────────────
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
            onStagedEventsReady(result);
            setBuildProgress('Build complete - review and publish.');
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
        onRevert();
    };

    const handleRevertToOriginal = () => {
        onPhaseChange('configure');
        onStagedEventsChange([]);
        onStagedEventsReady(null);
        onCompletedEventIdsChange(new Set());
        setIsSelectingCompleted(false);
        setBuildProgress('');
        onRevert();
    };

    if (!isOpen) return null;

    const TYPES: { key: EventTypeKey; label: string }[] = [
        { key: 'flight', label: 'Flight' },
        { key: 'ftd',    label: 'FTD' },
        { key: 'cpt',    label: 'CPT' },
        { key: 'ground', label: 'Ground' },
    ];

    const sectionHead = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';
    const btnBase = 'px-3 py-1.5 text-xs font-semibold rounded transition-colors';
    const btnGray = `${btnBase} bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600`;
    const btnActive = `${btnBase} bg-sky-700 text-white border border-sky-500`;
    const buildEnabled = !validationError && actionChoice === 'reprogram' && !cannotReprogram;
    const totalImpacted = impactedEvents.length;

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

            {/* ── Phase banners ── */}
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
                            ? 'Rebuild complete - review on schedule, then publish.'
                            : 'Cancellations staged - review on schedule, then publish.'}
                    </span>
                </div>
            )}
            {isSelectingCompleted && phase === 'configure' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border-b border-green-700/40 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <span className="text-[10px] text-green-300 font-semibold flex-1">Click or drag schedule tiles to mark completed</span>
                    <button onClick={() => setIsSelectingCompleted(false)} className="text-[9px] text-green-300 px-1.5 py-0.5 rounded border border-green-700 hover:bg-green-800 flex-shrink-0">Done</button>
                </div>
            )}

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

                {/* ────────────────────────────────────── */}
                {/* 1 – PAUSE PERIOD                      */}
                {/* ────────────────────────────────────── */}
                <div>
                    <p className={sectionHead}>Pause Period</p>

                    {/* Start & End — side by side */}
                    <div className="flex gap-2 mb-2">
                        {/* Start */}
                        <div className="flex-1">
                            <label className="block text-[9px] text-gray-400 mb-1">Start</label>
                            <input
                                list="pause-start-options"
                                type="text"
                                value={pauseStart}
                                onChange={e => setPauseStart(e.target.value)}
                                placeholder="HH:MM"
                                maxLength={5}
                                className="w-full bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm px-2 py-1.5 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                disabled={phase !== 'configure'}
                            />
                            <datalist id="pause-start-options">
                                {startOptions.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>

                        {/* End */}
                        <div className="flex-1">
                            <label className="block text-[9px] text-gray-400 mb-1">End</label>
                            <input
                                list="pause-end-options"
                                type="text"
                                value={pauseEnd}
                                onChange={e => setPauseEnd(e.target.value)}
                                placeholder="HH:MM"
                                maxLength={5}
                                className="w-full bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm px-2 py-1.5 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                disabled={phase !== 'configure'}
                            />
                            <datalist id="pause-end-options">
                                {endOptions.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                    </div>

                    {validationError && (
                        <p className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                            <span>&#9888;</span> {validationError}
                        </p>
                    )}
                    <p className="mt-0.5 text-[9px] text-gray-500">
                        Flying window: {decToHHMM(flyingStartTime)} - {decToHHMM(flyingEndTime)}
                    </p>
                </div>

                {/* ────────────────────────────────────── */}
                {/* 2 – AFFECTED TYPE                     */}
                {/* ────────────────────────────────────── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Affected Type</p>
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

                {/* ────────────────────────────────────── */}
                {/* 3 – COMPLETED EVENTS                  */}
                {/* ────────────────────────────────────── */}
                {phase === 'configure' && (
                    <div>
                        <p className={sectionHead}>Completed Events</p>
                        <p className="text-[9px] text-gray-400 mb-2 leading-snug">
                            Mark events already completed - the rebuild will skip those events
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setIsSelectingCompleted(!isSelectingCompleted)}
                                className={isSelectingCompleted ? btnActive : btnGray}
                            >
                                {isSelectingCompleted ? 'Complete' : 'Select on Schedule'}
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
                            <p className="mt-1 text-[9px] text-green-400">
                                {completedEventIds.size} event{completedEventIds.size !== 1 ? 's' : ''} marked completed
                            </p>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────────── */}
                {/* 4 – PAUSE RULE                        */}
                {/* ────────────────────────────────────── */}
                {phase !== 'review' && (
                    <div>
                        <p className={sectionHead}>Pause Rule</p>
                        <div className="space-y-1.5">
                            {([
                                {
                                    key: 'no_start_during' as PauseRule,
                                    title: 'No start during pause',
                                },
                                {
                                    key: 'conclude_by_start' as PauseRule,
                                    title: 'All events conclude by pause start',
                                },
                            ] as const).map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => phase === 'configure' && setPauseRule(opt.key)}
                                    disabled={phase !== 'configure'}
                                    className={`w-full text-left p-2.5 rounded border transition-colors ${phase !== 'configure' ? 'opacity-50 cursor-not-allowed ' : ''}${pauseRule === opt.key ? 'bg-sky-900/40 border-sky-500/60 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${pauseRule === opt.key ? 'border-sky-400 bg-sky-400' : 'border-gray-500'}`} />
                                        <p className={`text-[10px] font-semibold ${pauseRule === opt.key ? 'text-sky-300' : 'text-gray-300'}`}>
                                            {opt.title}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────── */}
                {/* 5+6 – NEO BUILD + REVERT BUTTONS      */}
                {/* ────────────────────────────────────── */}
                {phase === 'configure' && (
                    <>
                        {/* Action choice toggle */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 flex-shrink-0">Action:</span>
                            <button
                                onClick={() => setActionChoice('reprogram')}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${actionChoice === 'reprogram' ? 'bg-sky-900/40 border-sky-500/60 text-sky-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                            >
                                Re-program
                            </button>
                            <button
                                onClick={() => setActionChoice('cancel_only')}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${actionChoice === 'cancel_only' ? 'bg-sky-900/40 border-sky-500/60 text-sky-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                            >
                                Cancel Only
                            </button>
                        </div>

                        {/* Main action buttons row */}
                        <div className="flex items-center gap-3">
                            {/* NEO Build — styled like Right Menu NEO Build button */}
                            {actionChoice === 'reprogram' && (
                                <button
                                    onClick={buildEnabled ? handleBuild : undefined}
                                    disabled={!buildEnabled}
                                    className={`w-[75px] h-[55px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all ${!buildEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    style={buildEnabled ? { color: '#fb923c' } : { color: '#9a6030' }}
                                    title={buildEnabled ? 'Run NEO Build for Ops Pause' : (validationError || cannotReprogram || '')}
                                >
                                    <span className="text-center leading-tight">NEO Build<br />(Ops Pause)</span>
                                </button>
                            )}

                            {/* Cancel Events Only — shown when cancel_only is selected */}
                            {actionChoice === 'cancel_only' && (
                                <button
                                    onClick={handleCancelOnly}
                                    disabled={!!validationError || affectedTypes.size === 0}
                                    className={`w-[75px] h-[55px] flex items-center justify-center text-[11px] font-semibold rounded-md transition-all border ${!validationError && affectedTypes.size > 0 ? 'bg-amber-700 hover:bg-amber-600 text-white border-amber-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'}`}
                                >
                                    <span className="text-center leading-tight">Cancel<br />Events Only</span>
                                </button>
                            )}

                            {/* Cancel – Revert — styled like DFP button in left menu, black text */}
                            <button
                                onClick={handleRevertToOriginal}
                                className="w-[75px] h-[55px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                style={{ color: '#000000' }}
                                title="Cancel all changes and revert to the original Active DFP schedule"
                            >
                                <span className="text-center leading-tight">Cancel -<br />Revert</span>
                            </button>
                        </div>

                        {cannotReprogram && actionChoice === 'reprogram' && (
                            <p className="text-[9px] text-amber-400">{cannotReprogram}</p>
                        )}
                    </>
                )}

                {/* Building spinner */}
                {phase === 'building' && (
                    <div className="flex items-center gap-2 text-sky-400 text-xs py-2">
                        <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 2a10 10 0 1 0 10 10" />
                        </svg>
                        {buildProgress}
                    </div>
                )}

                {/* Review phase actions */}
                {phase === 'review' && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* PUBLISH - same size/theme as right menu Publish button, green text */}
                        <button
                            onClick={handlePublish}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                            style={{ color: '#22c55e' }}
                            title="Publish changes to Active DFP"
                        >
                            <span className="text-center leading-tight">Publish</span>
                        </button>
                        {/* Back to Configure - same size/theme, black text */}
                        <button
                            onClick={handleBackToConfigure}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                            style={{ color: '#000000' }}
                            title="Return to configure phase"
                        >
                            <span className="text-center leading-tight">Back</span>
                        </button>
                        {/* Revert - same size/theme, black text */}
                        <button
                            onClick={handleRevertToOriginal}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                            style={{ color: '#000000' }}
                            title="Discard all changes and restore the original Active DFP schedule"
                        >
                            <span className="text-center leading-tight">Revert to<br />Original</span>
                        </button>
                    </div>
                )}

                {/* ────────────────────────────────────── */}
                {/* 7 – SUMMARY                          */}
                {/* ────────────────────────────────────── */}
                <div>
                    <p className={sectionHead}>Summary</p>
                    <div className="rounded border border-gray-700/60 bg-gray-800/30 divide-y divide-gray-700/40">

                        {/* Pause window */}
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Pause window</span>
                            <span className="text-[10px] text-gray-200 font-semibold">
                                {pauseStartDec && pauseEndDec && !validationError
                                    ? `${decToHHMM(pauseStartDec)} - ${decToHHMM(pauseEndDec)}`
                                    : '-'}
                            </span>
                        </div>

                        {/* Cancelled / Impacted */}
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">
                                {phase === 'review' ? 'Cancelled (OPS PAUSE)' : 'Impacted events'}
                            </span>
                            <span className={`text-[10px] font-bold ${phase === 'review' || totalImpacted > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                                {phase === 'review' ? reviewCancelledCount : totalImpacted}
                            </span>
                        </div>

                        {/* Completed */}
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Completed (skip)</span>
                            <span className={`text-[10px] font-bold ${completedEventIds.size > 0 ? 'text-green-300' : 'text-gray-500'}`}>
                                {completedEventIds.size}
                            </span>
                        </div>

                        {/* Rebuild window */}
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Rebuild window</span>
                            <span className="text-[10px] text-sky-300 font-semibold">
                                {pauseEndDec && !validationError
                                    ? `${decToHHMM(pauseEndDec)} - ${decToHHMM(flyingEndTime)}`
                                    : '-'}
                            </span>
                        </div>

                        {/* Staged events (review only) */}
                        {phase === 'review' && stagedEvents.length > 0 && (
                            <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-[9px] text-gray-400 uppercase tracking-wide">Staged events</span>
                                <span className="text-[10px] text-green-300 font-bold">{stagedEvents.length}</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ── Footer: Close button ── */}
            <div className="px-4 py-3 border-t border-gray-700/60 flex-shrink-0" style={{ background: '#1a2030' }}>
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