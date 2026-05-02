

import React, { useMemo, useEffect, useState } from 'react';
import { Trainee, Score, SyllabusItemDetail, Course } from '../types';
import AuditButton from './AuditButton';
import CourseDataWindow from './CourseDataWindow';
import FullPageProgressGraph from './FullPageProgressGraph';
import { logAudit } from '../utils/auditLogger';

interface CourseProgressViewProps {
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
    scores: Map<string, Score[]>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    courses: Course[];
    onUpdateGradDate: (courseName: string, newGradDate: string) => void;
    onUpdateStartDate: (courseName: string, newStartDate: string) => void;
}

const CourseProgressView: React.FC<CourseProgressViewProps> = ({
    traineesData,
    courseColors,
    scores,
    traineeLMPs,
    courses,
    onUpdateGradDate,
    onUpdateStartDate
}) => {
    const [showFullGraph, setShowFullGraph] = useState(false);
    const [selectedGraphCourse, setSelectedGraphCourse] = useState<string | null>(null);
    const [rankingCourse, setRankingCourse] = useState<string>('all');
    const [includeAllScoredEvents, setIncludeAllScoredEvents] = useState(true);
    const [minimumScoredEvents, setMinimumScoredEvents] = useState(1);
    const [duxCriteria, setDuxCriteria] = useState([
        { id: 'BGF21', event: 'BGF21', weight: 2, enabled: true },
        { id: 'BIF3', event: 'BIF3', weight: 2, enabled: true },
        { id: 'BNAV4', event: 'BNAV4', weight: 2, enabled: true },
    ]);
    
    // Log view on component mount
    useEffect(() => {
        logAudit({
            action: 'View',
            description: 'Viewed Course Progress page',
            changes: `Viewing ${courses.filter(c => courseColors[c.name]).length} active courses`,
            page: 'Course Progress'
        });
    }, []);

    const activeCourses = useMemo(() => {
        // Filter the full courses list to only include active ones (present in courseColors)
        // Sort alphabetically by course name
        return courses
            .filter(course => courseColors[course.name])
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [courses, courseColors]);

    useEffect(() => {
        if (rankingCourse === 'all') return;
        if (!activeCourses.some(course => course.name === rankingCourse)) {
            setRankingCourse('all');
        }
    }, [activeCourses, rankingCourse]);

    const activeCourseNames = useMemo(() => new Set(activeCourses.map(course => course.name)), [activeCourses]);

    const activeTrainees = useMemo(() => {
        return traineesData
            .filter(trainee => !trainee.isPaused && activeCourseNames.has(trainee.course))
            .sort((a, b) => (a.fullName || a.name).localeCompare(b.fullName || b.name));
    }, [traineesData, activeCourseNames]);

    const eventOrder = useMemo(() => {
        const order = new Map<string, number>();
        let index = 0;
        traineeLMPs.forEach(lmp => {
            lmp.forEach(item => {
                if (!order.has(item.id)) order.set(item.id, index++);
                if (!order.has(item.code)) order.set(item.code, index++);
            });
        });
        return order;
    }, [traineeLMPs]);

    const scoredEvents = useMemo(() => {
        const eventSet = new Set<string>();
        activeTrainees.forEach(trainee => {
            const traineeScores = scores.get(trainee.fullName) || scores.get(trainee.name) || [];
            traineeScores.forEach(score => {
                if (typeof score.score === 'number') eventSet.add(score.event);
            });
        });

        return Array.from(eventSet).sort((a, b) => {
            const aOrder = eventOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = eventOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });
    }, [activeTrainees, scores, eventOrder]);

    const getLatestScoreForEvent = (trainee: Trainee, eventCode: string): Score | undefined => {
        const traineeScores = scores.get(trainee.fullName) || scores.get(trainee.name) || [];
        return traineeScores
            .filter(score => score.event === eventCode && typeof score.score === 'number')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    };

    const duxRankings = useMemo(() => {
        const selectedTrainees = activeTrainees.filter(trainee => rankingCourse === 'all' || trainee.course === rankingCourse);
        const criteriaWeights = new Map(
            duxCriteria
                .filter(criterion => criterion.enabled && criterion.event.trim() && Number.isFinite(criterion.weight) && criterion.weight > 0)
                .map(criterion => [criterion.event.trim().toUpperCase(), criterion.weight])
        );

        return selectedTrainees
            .map(trainee => {
                const traineeScores = scores.get(trainee.fullName) || scores.get(trainee.name) || [];
                const scoredRecords = traineeScores.filter(score => typeof score.score === 'number');
                const includedScores = includeAllScoredEvents
                    ? scoredRecords
                    : scoredRecords.filter(score => criteriaWeights.has(score.event.toUpperCase()));

                const totals = includedScores.reduce((acc, score) => {
                    const weight = criteriaWeights.get(score.event.toUpperCase()) ?? 1;
                    return {
                        weightedScore: acc.weightedScore + (score.score * weight),
                        weight: acc.weight + weight,
                        weightedEvents: acc.weightedEvents + (weight !== 1 ? 1 : 0),
                    };
                }, { weightedScore: 0, weight: 0, weightedEvents: 0 });

                return {
                    trainee,
                    scoredCount: includedScores.length,
                    weightedEvents: totals.weightedEvents,
                    rankingScore: totals.weight > 0 ? totals.weightedScore / totals.weight : 0,
                };
            })
            .filter(row => row.scoredCount >= minimumScoredEvents)
            .sort((a, b) => b.rankingScore - a.rankingScore || (a.trainee.fullName || a.trainee.name).localeCompare(b.trainee.fullName || b.trainee.name));
    }, [activeTrainees, rankingCourse, duxCriteria, scores, includeAllScoredEvents, minimumScoredEvents]);

    const updateDuxCriterion = (id: string, updates: Partial<{ event: string; weight: number; enabled: boolean }>) => {
        setDuxCriteria(prev => prev.map(criterion => criterion.id === id ? { ...criterion, ...updates } : criterion));
    };

    const addDuxCriterion = () => {
        const id = `criterion-${Date.now()}`;
        setDuxCriteria(prev => [...prev, { id, event: '', weight: 2, enabled: true }]);
    };

    const removeDuxCriterion = (id: string) => {
        setDuxCriteria(prev => prev.filter(criterion => criterion.id !== id));
    };

    return (
        <>
            {showFullGraph ? (
                <FullPageProgressGraph
                    courses={activeCourses}
                    allTrainees={traineesData}
                    scores={scores}
                    traineeLMPs={traineeLMPs}
                    courseColors={courseColors}
                    initialSelectedCourse={selectedGraphCourse}
                    onClose={() => {
                        setShowFullGraph(false);
                        setSelectedGraphCourse(null);
                    }}
                />
            ) : (
                <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
                    <div className="p-6 space-y-6 max-w-full mx-auto w-full">
                        <header>
                            <h1 className="text-3xl font-bold text-white">Course Progress</h1>
                            <p className="text-lg text-gray-400">High-level overview of trainee progression through the syllabus.</p>
                            <div className="flex justify-end mt-2"><AuditButton pageName="Course Progress" /></div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                            {activeCourses.map(course => (
                                <CourseDataWindow
                                    key={course.name}
                                    course={course}
                                    allTrainees={traineesData}
                                    scores={scores}
                                    traineeLMPs={traineeLMPs}
                                    onUpdateGradDate={onUpdateGradDate}
                                    onUpdateStartDate={onUpdateStartDate}
                                    onShowFullGraph={() => {
                                        setSelectedGraphCourse(course.name);
                                        setShowFullGraph(true);
                                    }}
                                />
                            ))}
                        </div>

                        <section className="space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Course Scores & Rankings</h2>
                                <p className="text-sm text-gray-400">Score summary and editable award ranking criteria for active course trainees.</p>
                            </div>

                            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.55fr)] gap-6">
                                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-700">
                                        <h3 className="text-lg font-semibold text-white">Course Scores</h3>
                                        <p className="text-xs text-gray-400">Only events with recorded scores are shown.</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-900/80">
                                                <tr>
                                                    <th className="sticky left-0 z-10 bg-gray-900/95 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-300 min-w-56">Trainee</th>
                                                    {scoredEvents.map(eventCode => (
                                                        <th key={eventCode} className="px-3 py-3 text-center text-xs font-semibold uppercase text-gray-300 min-w-24 whitespace-nowrap">{eventCode}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700">
                                                {activeTrainees.map(trainee => (
                                                    <tr key={trainee.idNumber || trainee.fullName} className="hover:bg-gray-700/30">
                                                        <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 text-gray-100 min-w-56">
                                                            <div className="font-medium">{trainee.fullName || trainee.name}</div>
                                                            <div className="text-xs text-gray-500">{trainee.course}</div>
                                                        </td>
                                                        {scoredEvents.map(eventCode => {
                                                            const score = getLatestScoreForEvent(trainee, eventCode);
                                                            return (
                                                                <td key={`${trainee.idNumber}-${eventCode}`} className="px-3 py-3 text-center font-mono text-gray-200">
                                                                    {score ? score.score : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {activeTrainees.length === 0 && (
                                                    <tr>
                                                        <td className="px-4 py-8 text-center text-gray-400" colSpan={Math.max(1, scoredEvents.length + 1)}>No active trainees available.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-700">
                                        <h3 className="text-lg font-semibold text-white">Course Rankings</h3>
                                        <p className="text-xs text-gray-400">Dux ranking uses editable weighted average criteria.</p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="text-sm text-gray-300">
                                                Course
                                                <select
                                                    value={rankingCourse}
                                                    onChange={event => setRankingCourse(event.target.value)}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="all">All active courses</option>
                                                    {activeCourses.map(course => <option key={course.name} value={course.name}>{course.name}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-sm text-gray-300">
                                                Minimum scored events
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={minimumScoredEvents}
                                                    onChange={event => setMinimumScoredEvents(Math.max(1, parseInt(event.target.value, 10) || 1))}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                            </label>
                                        </div>

                                        <label className="flex items-center gap-2 text-sm text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={includeAllScoredEvents}
                                                onChange={event => setIncludeAllScoredEvents(event.target.checked)}
                                                className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                            />
                                            Include all scored events in Dux average
                                        </label>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-gray-200">Weighted Events</h4>
                                                <button
                                                    type="button"
                                                    onClick={addDuxCriterion}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md"
                                                >
                                                    Add Event
                                                </button>
                                            </div>
                                            {duxCriteria.map(criterion => (
                                                <div key={criterion.id} className="grid grid-cols-[auto_minmax(0,1fr)_88px_auto] gap-2 items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={criterion.enabled}
                                                        onChange={event => updateDuxCriterion(criterion.id, { enabled: event.target.checked })}
                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    <input
                                                        value={criterion.event}
                                                        onChange={event => updateDuxCriterion(criterion.id, { event: event.target.value.toUpperCase() })}
                                                        placeholder="Event"
                                                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0.1}
                                                        step={0.1}
                                                        value={criterion.weight}
                                                        onChange={event => updateDuxCriterion(criterion.id, { weight: parseFloat(event.target.value) || 1 })}
                                                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                        aria-label="Weight"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDuxCriterion(criterion.id)}
                                                        className="px-2 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="overflow-x-auto border border-gray-700 rounded-md">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-900/80">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-300">Rank</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-300">Trainee</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Dux Avg</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Scores</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {duxRankings.map((row, index) => (
                                                        <tr key={row.trainee.idNumber || row.trainee.fullName} className="hover:bg-gray-700/30">
                                                            <td className="px-3 py-2 text-gray-300">{index + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium text-white">{row.trainee.fullName || row.trainee.name}</div>
                                                                <div className="text-xs text-gray-500">{row.trainee.course}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-sky-300">{row.rankingScore.toFixed(2)}</td>
                                                            <td className="px-3 py-2 text-right text-gray-300">{row.scoredCount}</td>
                                                        </tr>
                                                    ))}
                                                    {duxRankings.length === 0 && (
                                                        <tr>
                                                            <td className="px-3 py-6 text-center text-gray-400" colSpan={4}>No ranking data available for the selected criteria.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </>
    );
};

export default CourseProgressView;
