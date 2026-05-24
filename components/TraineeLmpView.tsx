import React, { useState, useEffect, useMemo } from 'react';
import { Trainee, SyllabusItemDetail, Score } from '../types';
import AuditButton from './AuditButton';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';

interface TraineeLmpViewProps {
  trainee: Trainee;
  traineeLmp: SyllabusItemDetail[];
  scores: Score[];
  onBack: () => void;
  // Optional: full syllabus + all trainees for Academic LMP tab
  syllabusDetails?: SyllabusItemDetail[];
  allTraineesData?: Trainee[];
  // Optional: open PT-051 for a specific lesson
  onOpenPt051ForLesson?: (trainee: Trainee, lessonCode: string) => void;
  canOpenPt051?: boolean;
  onAccessDenied?: (actionLabel: string) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  onDeleteRemedialItem?: (trainee: Trainee, item: SyllabusItemDetail) => Promise<boolean> | boolean;
  onGeneratePt051ForItem?: (trainee: Trainee, item: SyllabusItemDetail) => void;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

const DetailCard: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-3 rounded-lg ${className}`}>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <p className="mt-1 text-md font-semibold text-white">{value}</p>
    </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <div className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
            {items && items.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            ) : (
                <p className="italic text-gray-500">None</p>
            )}
        </div>
    </div>
);

const getScoreColor = (score: number, type: 'text' | 'bg') => {
    const colors = {
        '2-5': { text: 'text-green-300', bg: 'bg-green-500/20' },
        '1': { text: 'text-amber-300', bg: 'bg-amber-500/20' },
        '0': { text: 'text-red-300', bg: 'bg-red-500/20' },
    };
    const key = score >= 2 ? '2-5' : score === 1 ? '1' : '0';
    return colors[key][type];
};

const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' => {
    if (syllabusItem.type === 'Flight') return 'Flight';
    if (syllabusItem.type === 'FTD') return 'FTD';
    if (syllabusItem.type === 'Ground School') {
        if (syllabusItem.code.includes('CPT')) return 'CPT';
        return 'Ground';
    }
    return 'Flight';
};

const formatDisplayType = (displayType: ReturnType<typeof getDisplayType>, resourceDisplayNames: ResourceDisplayNames) => {
    if (displayType === 'FTD') return resourceDisplayNames.ftd;
    if (displayType === 'CPT') return resourceDisplayNames.cpt;
    return displayType;
};

const REMEDIAL_EVENT_CODE_REGEX = /-(?:REM-[A-Z]+\d+|RFTD\d+|RRF\d+|RT\d+|RF\d+|FTD\d+|F\d+|T\d+)$/i;

const isRemedialLmpItem = (item: SyllabusItemDetail): boolean =>
    item.lmpSource === 'remedial' ||
    item.isRemedial === true ||
    item.module === 'Remedial' ||
    REMEDIAL_EVENT_CODE_REGEX.test(item.id || '') ||
    REMEDIAL_EVENT_CODE_REGEX.test(item.code || '');

const DetailView: React.FC<{
    item: SyllabusItemDetail;
    score: Score | undefined;
    resourceDisplayNames?: ResourceDisplayNames;
    isRemedial?: boolean;
    onDelete?: (item: SyllabusItemDetail) => void;
}> = ({ item, score, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, isRemedial = false, onDelete }) => (
    <div className="space-y-6">
        {isRemedial && (
            <div className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-950/35 px-4 py-3">
                <div>
                    <p className="text-sm font-bold text-red-100">Remedial Package Event</p>
                    <p className="text-xs text-red-200/80">Use this action to remove this event from the trainee's Individual LMP.</p>
                </div>
                <button
                    type="button"
                    disabled={!onDelete}
                    onClick={() => onDelete?.(item)}
                    className={`rounded-md border px-4 py-2 text-sm font-bold ${
                        onDelete
                            ? 'border-red-400/70 bg-red-700 text-white hover:bg-red-600'
                            : 'border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Delete Remedial Event
                </button>
            </div>
        )}
        <div className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-3xl font-bold text-white">{item.code}</h2>
                <p className="text-lg text-gray-400 mt-1">{item.eventDescription}</p>
            </div>
        </div>
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <DetailCard label="Phase" value={item.phase} />
                <DetailCard label="Module" value={item.module} />
                <DetailCard label="Type" value={formatDisplayType(getDisplayType(item), resourceDisplayNames)} />
                <DetailCard label="Day/Night" value={item.dayNight || 'Day'} />
                <DetailCard label="Dual/Solo" value={item.sortieType || 'Dual'} />
                <DetailCard label="Total Event Hours" value={<>{item.totalEventHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
                <DetailCard label="Flight/Sim Hours" value={<>{item.flightOrSimHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
            </div>
        </fieldset>

        {score && (
            <fieldset className="p-4 border border-sky-700 rounded-lg bg-sky-900/10">
                <legend className="px-2 text-sm font-semibold text-sky-300">Trainee's Score</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <DetailCard 
                        label="Overall Score"
                        value={
                            item.type === 'Ground School' ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        -
                                    </div>
                                    <span className="text-green-300">Complete</span>
                                </div>
                            ) : (
                                <span className={`text-xl ${getScoreColor(score.score, 'text')}`}>{score.score}</span>
                            )
                        }
                    />
                     <DetailCard label="Date" value={score.date} />
                     <DetailCard label="Instructor" value={score.instructor} />
                </div>
                 <div className="mt-4">
                     <DetailCard label="Notes" value={<p className="whitespace-pre-wrap">{score.notes}</p>} />
                 </div>
            </fieldset>
        )}
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Prerequisites</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Ground School" items={item.prerequisitesGround} />
                <DetailList title="Sim/Flying" items={item.prerequisitesFlying} />
            </div>
        </fieldset>

        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Event Breakdown</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
            </div>
        </fieldset>

         <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Resources</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Physical Resources" items={item.resourcesPhysical} />
                <DetailList title="Human Resources" items={item.resourcesHuman} />
            </div>
        </fieldset>
    </div>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const MissedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);

// ─── Academic LMP Tab ─────────────────────────────────────────────────────────

interface AcademicLmpTabProps {
    trainee: Trainee;
    scores: Score[];
    syllabusDetails: SyllabusItemDetail[];
    allTraineesData: Trainee[];
    onOpenPt051ForLesson?: (trainee: Trainee, lessonCode: string) => void;
    canOpenPt051?: boolean;
    onAccessDenied?: (actionLabel: string) => void;
}

const AcademicLmpTab: React.FC<AcademicLmpTabProps> = ({
    trainee,
    scores,
    syllabusDetails,
    allTraineesData,
    onOpenPt051ForLesson,
    canOpenPt051 = true,
    onAccessDenied,
}) => {
    const [selectedLesson, setSelectedLesson] = useState<SyllabusItemDetail | null>(null);

    // Build academic syllabus for this trainee
    // Only type === 'Academics' (Ground School = flying phase ground events, not academic lessons)
    // Filtered by trainee.academicLmpType (set per-trainee or inherited from course)
    const academicSyllabus = useMemo(() => {
        const academicLmpType = (trainee as any).academicLmpType;
        if (!academicLmpType) return []; // No academic LMP assigned — show prompt
        return syllabusDetails.filter(s =>
            s.type === 'Academics' &&
            s.courses?.includes(academicLmpType)
        ).sort((a, b) => {
            // Sort by phase then module then code
            if (a.phase !== b.phase) return (a.phase || '').localeCompare(b.phase || '');
            if (a.module !== b.module) return (a.module || '').localeCompare(b.module || '');
            return (a.code || '').localeCompare(b.code || '');
        });
    }, [syllabusDetails, (trainee as any).academicLmpType]);

    // Set of lesson codes this trainee has completed (has a Score record)
    const completedLessonCodes = useMemo(() => {
        const codes = new Set<string>();
        scores.forEach(s => {
            if (s.event) codes.add(s.event.replace('*', ''));
        });
        return codes;
    }, [scores]);

    // Course-mates: all trainees in the same course
    const courseMates = useMemo(() =>
        allTraineesData.filter(t => t.course === trainee.course && t.fullName !== trainee.fullName),
        [allTraineesData, trainee.course, trainee.fullName]
    );

    // Build a set of lesson codes that at least one coursemate has completed
    // (used to identify "missed" lessons — course progressed past this, trainee hasn't)
    // Note: we don't have all-trainees scores here, but we can detect missed via
    // counting how many courseMates would have a score vs trainee
    // For now, we determine "course has done this" by checking if >50% of courseMates have it
    // This is a UI approximation — the real calculation would require all scores.
    // Since we only receive this trainee's scores, "Missed" = lesson appears in academic syllabus
    // AND trainee has no score BUT the lesson is before the trainee's last completed lesson.
    const lastCompletedIndex = useMemo(() => {
        let last = -1;
        academicSyllabus.forEach((item, idx) => {
            if (completedLessonCodes.has(item.code)) last = idx;
        });
        return last;
    }, [academicSyllabus, completedLessonCodes]);

    const individualCount = completedLessonCodes.size;
    const totalCount = academicSyllabus.length;

    // Group by module for display
    const groupedByModule = useMemo(() => {
        const groups: Record<string, SyllabusItemDetail[]> = {};
        academicSyllabus.forEach(item => {
            const key = item.module?.trim() || item.phase?.trim() || 'General';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [academicSyllabus]);

    const handleOpenPt051 = (lesson: SyllabusItemDetail) => {
        if (onOpenPt051ForLesson) {
            onOpenPt051ForLesson(trainee, lesson.code);
        }
    };

    const academicLmpType = (trainee as any).academicLmpType;
    if (!academicLmpType) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-6 max-w-md">
                    <p className="text-amber-300 font-semibold text-lg mb-2">No Academic LMP Assigned</p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        This trainee does not have an Academic LMP assigned.<br/>
                        Go to <span className="text-sky-400 font-medium">Course Roster → Edit Trainee</span> and set the <span className="text-sky-400 font-medium">Academic LMP</span> field,<br/>
                        or set it at the course level via <span className="text-sky-400 font-medium">Training Records → Edit Course</span>.
                    </p>
                </div>
            </div>
        );
    }

    if (academicSyllabus.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-gray-400 text-lg font-medium">No Academic Syllabus Found</p>
                <p className="text-gray-500 text-sm mt-2">
                    No <span className="text-sky-400">Academics</span> type lessons found with course assignment: <span className="text-purple-400">"{academicLmpType}"</span>
                </p>
                <p className="text-gray-600 text-xs mt-2 max-w-md">
                    In the <span className="text-sky-400">Syllabus view</span>, ensure at least one event has type <strong className="text-white">Academics</strong> and has <span className="text-purple-400">"{academicLmpType}"</span> in its <strong className="text-white">Courses</strong> field.
                </p>
                <p className="text-gray-700 text-xs mt-1">
                    Total syllabus items loaded: {syllabusDetails.length} | 
                    Academics type items: {syllabusDetails.filter(s => s.type === 'Academics').length} |
                    Matching course: {syllabusDetails.filter(s => s.type === 'Academics' && s.courses?.includes(academicLmpType)).length}
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-row overflow-hidden">
            {/* Left panel: lesson list grouped by module */}
            <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
                {/* Progress header */}
                <div className="p-3 bg-gray-800/60 border-b border-gray-700 sticky top-0 z-10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Individual Progress</span>
                        <span className="text-sm font-bold text-white">{individualCount}/{totalCount}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${totalCount > 0 ? (individualCount / totalCount) * 100 : 0}%` }}
                        />
                    </div>
                    {lastCompletedIndex > individualCount && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                            <span>⚠</span>
                            <span>Behind — {lastCompletedIndex - individualCount + 1} lesson(s) missed</span>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="px-3 py-2 border-b border-gray-700/50 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="text-green-400">✓</span> Attended</span>
                    <span className="flex items-center gap-1"><span className="text-red-400">✗</span> Missed</span>
                    <span className="flex items-center gap-1"><span className="text-gray-500">○</span> Pending</span>
                </div>

                {/* Lesson groups */}
                {Object.entries(groupedByModule).map(([moduleName, items]) => {
                    const moduleCompleted = items.filter(i => completedLessonCodes.has(i.code)).length;
                    return (
                        <div key={moduleName}>
                            <div className="px-3 py-1.5 bg-gray-800/40 border-b border-gray-700/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider truncate">{moduleName}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{moduleCompleted}/{items.length}</span>
                            </div>
                            <ul className="p-1 space-y-0.5">
                                {items.map((item, idx) => {
                                    const isCompleted = completedLessonCodes.has(item.code);
                                    // "Missed" = not completed but there are completed lessons AFTER this in the syllabus
                                    const lessonIdx = academicSyllabus.findIndex(a => a.code === item.code);
                                    const isMissed = !isCompleted && lessonIdx < lastCompletedIndex;
                                    const isSelected = selectedLesson?.code === item.code;
                                    return (
                                        <li key={item.code}>
                                            <button
                                                onClick={() => setSelectedLesson(item)}
                                                className={`w-full text-left px-2 py-1.5 rounded transition-colors text-xs flex items-center gap-2 ${
                                                    isSelected
                                                        ? 'bg-sky-700 text-white font-semibold'
                                                        : isCompleted
                                                        ? 'text-green-300 hover:bg-gray-700/50'
                                                        : isMissed
                                                        ? 'text-red-300 hover:bg-gray-700/50'
                                                        : 'text-gray-400 hover:bg-gray-700/50'
                                                }`}
                                            >
                                                {isCompleted ? (
                                                    <CheckIcon />
                                                ) : isMissed ? (
                                                    <MissedIcon />
                                                ) : (
                                                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full border border-gray-600" />
                                                    </div>
                                                )}
                                                <span className="font-mono font-bold">{item.code}</span>
                                                <span className="truncate text-gray-400 text-xs">{item.eventDescription}</span>
                                                {isMissed && !isSelected && (
                                                    <span className="ml-auto flex-shrink-0 text-xs bg-red-900/50 text-red-300 px-1 rounded">MISSED</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>

            {/* Right panel: detail view */}
            <div className="w-2/3 overflow-y-auto">
                {selectedLesson ? (
                    <div className="p-6 max-w-3xl mx-auto space-y-4">
                        {/* Lesson header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{selectedLesson.code}</h2>
                                <p className="text-gray-400 mt-0.5">{selectedLesson.eventDescription}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                    <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.module || selectedLesson.phase}</span>
                                    <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.type}</span>
                                    {selectedLesson.duration ? (
                                        <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.duration}h</span>
                                    ) : null}
                                </div>
                            </div>
                            {/* Status badge */}
                            {completedLessonCodes.has(selectedLesson.code) ? (
                                <span className="flex items-center gap-1.5 bg-green-900/40 text-green-300 px-3 py-1.5 rounded-lg text-sm font-semibold border border-green-700/50">
                                    <CheckIcon /> Attended
                                </span>
                            ) : (() => {
                                const lessonIdx = academicSyllabus.findIndex(a => a.code === selectedLesson.code);
                                return lessonIdx < lastCompletedIndex ? (
                                    <span className="flex items-center gap-1.5 bg-red-900/40 text-red-300 px-3 py-1.5 rounded-lg text-sm font-semibold border border-red-700/50">
                                        <MissedIcon /> Missed
                                    </span>
                                ) : (
                                    <span className="bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-600/50">
                                        Not Yet Attended
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Completion record (if attended) */}
                        {(() => {
                            const lessonScore = scores.find(s => s.event === selectedLesson.code || s.event === selectedLesson.code + '*');
                            if (!lessonScore) return null;
                            return (
                                <fieldset className="p-4 border border-green-700/50 rounded-lg bg-green-900/10">
                                    <legend className="px-2 text-sm font-semibold text-green-300">Attendance Record</legend>
                                    <div className="grid grid-cols-3 gap-4 mt-2">
                                        <DetailCard label="Date" value={lessonScore.date} />
                                        <DetailCard label="Instructor" value={lessonScore.instructor || '—'} />
                                        <DetailCard label="Result" value={
                                            <span className="text-green-300 font-bold">DCO ✓</span>
                                        } />
                                    </div>
                                    {lessonScore.notes && (
                                        <div className="mt-3">
                                            <DetailCard label="Notes" value={<p className="whitespace-pre-wrap text-sm">{lessonScore.notes}</p>} />
                                        </div>
                                    )}
                                </fieldset>
                            );
                        })()}

                        {/* Open PT-051 button */}
                        {onOpenPt051ForLesson && (
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        if (!canOpenPt051) {
                                            onAccessDenied?.('PT-051 from Individual LMP');
                                            return;
                                        }
                                        handleOpenPt051(selectedLesson);
                                    }}
                                    disabled={!canOpenPt051}
                                    title={canOpenPt051 ? undefined : 'Your permission profile does not allow opening PT-051 records'}
                                    className={`w-[140px] h-[41px] flex items-center justify-center text-center px-2 py-1 text-[11px] font-semibold rounded-md btn-aluminium-brushed ${!canOpenPt051 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {completedLessonCodes.has(selectedLesson.code) ? 'View / Edit PT-051' : 'Open PT-051'}
                                </button>
                                <span className="text-xs text-gray-500 italic">
                                    {completedLessonCodes.has(selectedLesson.code)
                                        ? 'View or edit the attendance record for this lesson'
                                        : 'Mark this lesson as attended via PT-051'}
                                </span>
                            </div>
                        )}

                        {/* Lesson details */}
                        <fieldset className="p-4 border border-gray-700 rounded-lg">
                            <legend className="px-2 text-sm font-semibold text-gray-300">Lesson Details</legend>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                <DetailCard label="Phase" value={selectedLesson.phase || '—'} />
                                <DetailCard label="Module" value={selectedLesson.module || '—'} />
                                <DetailCard label="Duration" value={
                                    <>{selectedLesson.duration?.toFixed(1) || '—'} <span className="text-sm font-normal">hrs</span></>
                                } />
                            </div>
                        </fieldset>

                        {/* Method of Delivery */}
                        {selectedLesson.methodOfDelivery?.length > 0 && (
                            <fieldset className="p-4 border border-gray-700 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Method of Delivery</legend>
                                <div className="mt-2">
                                    <DetailList title="" items={selectedLesson.methodOfDelivery} />
                                </div>
                            </fieldset>
                        )}

                        {/* Method of Assessment */}
                        {selectedLesson.methodOfAssessment?.length > 0 && (
                            <fieldset className="p-4 border border-gray-700 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Method of Assessment</legend>
                                <div className="mt-2">
                                    <DetailList title="" items={selectedLesson.methodOfAssessment} />
                                </div>
                            </fieldset>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="text-4xl mb-4">📖</div>
                        <p className="text-gray-500 italic">Select a lesson from the list to view its details and attendance record.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TraineeLmpView: React.FC<TraineeLmpViewProps> = ({
    trainee,
    traineeLmp,
    scores,
    onBack,
    syllabusDetails,
    allTraineesData,
    onOpenPt051ForLesson,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    canOpenPt051 = true,
    onAccessDenied,
    onDeleteRemedialItem,
    onGeneratePt051ForItem,
}) => {
    const { isFrozen } = useSystemFreeze();
    const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);
    const [activeTab, setActiveTab] = useState<'neo' | 'academic'>('neo');

    // Always show Academic tab when syllabusDetails prop is provided
    // The tab itself will show a "configure" message if academicLmpType not set
    const hasAcademicSyllabus = !!(syllabusDetails && syllabusDetails.length > 0);

    // ── NEO Build LMP: dual-source completion check ──
    const completedEventIds = useMemo(() => {
        const ids = new Set(scores.map(s => (s.event || '').replace('*', '')));
        traineeLmp.forEach((item: any) => {
            if (item.completedAt) {
                ids.add((item.id || item.code || '').replace('*', ''));
            }
        });
        // BIF FTD dependency rules
        if (ids.has('BIF FTD2') && !ids.has('BIF FTD1')) ids.add('BIF FTD1');
        if (ids.has('BIF1') && !ids.has('BIF FTD3')) ids.add('BIF FTD3');
        return ids;
    }, [scores, traineeLmp]);

    useEffect(() => {
        setSelectedItem(null);
    }, [trainee.fullName]);

    // Tab button style helper
    const tabClass = (tab: 'neo' | 'academic') =>
        `px-4 py-2 text-sm font-semibold rounded-t-md transition-colors ${
            activeTab === tab
                ? 'bg-gray-900 text-sky-400 border-t border-l border-r border-gray-700'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
        }`;

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Individual LMP</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name} - {trainee.course}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        ← Back
                    </button>
                    {activeTab === 'neo' && selectedItem && onGeneratePt051ForItem && (
                        <button
                            onClick={() => onGeneratePt051ForItem(trainee, selectedItem)}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Generate<br />PT-051
                        </button>
                    )}
                    <AuditButton pageName="Individual LMP" />
                </div>
            </div>

            {/* Tab switcher — only show if academic syllabus exists */}
            {hasAcademicSyllabus && (
                <div className="flex-shrink-0 bg-gray-800 px-4 pt-2 flex gap-1 border-b border-gray-700">
                    <button className={tabClass('neo')} onClick={() => setActiveTab('neo')}>
                        NEO Build LMP
                    </button>
                    <button className={tabClass('academic')} onClick={() => setActiveTab('academic')}>
                        Academic LMP
                    </button>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* Transparent freeze overlay */}
                {isFrozen && (
                    <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{ pointerEvents: 'all' }} />
                )}

                {/* ── Academic LMP Tab ── */}
                {activeTab === 'academic' && syllabusDetails && allTraineesData ? (
                    <AcademicLmpTab
                        trainee={trainee}
                        scores={scores}
                        syllabusDetails={syllabusDetails}
                        allTraineesData={allTraineesData}
                        onOpenPt051ForLesson={onOpenPt051ForLesson}
                        canOpenPt051={canOpenPt051}
                        onAccessDenied={onAccessDenied}
                    />
                ) : (
                    /* ── NEO Build LMP Tab (existing) ── */
                    <>
                        {/* Left Column: List */}
                        <div className="w-1/4 border-r border-gray-700 overflow-y-auto">
                            <ul className="p-2 space-y-1">
                                {traineeLmp.map(item => {
                                    const isCompleted = completedEventIds.has(item.code);
                                    return (
                                        <li key={item.code}>
                                            <div className={`group rounded-md transition-colors text-sm flex items-center ${selectedItem?.code === item.code ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300 hover:bg-gray-700/50'}`}>
                                                <button
                                                    onClick={() => setSelectedItem(item)}
                                                    className="min-w-0 flex-1 text-left p-2 flex items-center space-x-2"
                                                >
                                                    {isCompleted ? <CheckIcon /> : <div className="w-4 h-4 flex-shrink-0"></div>}
                                                    <span className="truncate">{item.code}</span>
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {/* Right Column: Detail View */}
                        <div className="w-3/4 overflow-y-auto">
                            <div className="p-6 max-w-5xl mx-auto">
                                {selectedItem ? (
                                    <DetailView
                                        item={selectedItem}
                                        score={scores.find(s => s.event === selectedItem.code)}
                                        resourceDisplayNames={resourceDisplayNames}
                                        isRemedial={isRemedialLmpItem(selectedItem)}
                                        onDelete={isRemedialLmpItem(selectedItem) && onDeleteRemedialItem
                                            ? async (item) => {
                                                const deleted = await onDeleteRemedialItem(trainee, item);
                                                if (deleted) setSelectedItem(null);
                                            }
                                            : undefined
                                        }
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-gray-500 italic">Select an item from the list to view its details.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TraineeLmpView;
