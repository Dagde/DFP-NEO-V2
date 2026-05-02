

import React, { useMemo, useEffect, useState } from 'react';
import { Trainee, Score, SyllabusItemDetail, Course, Pt051Assessment } from '../types';
import AuditButton from './AuditButton';
import CourseDataWindow from './CourseDataWindow';
import FullPageProgressGraph from './FullPageProgressGraph';
import { logAudit } from '../utils/auditLogger';

interface CourseProgressViewProps {
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
    scores: Map<string, Score[]>;
    pt051Assessments: Map<string, Pt051Assessment>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    courses: Course[];
    onUpdateGradDate: (courseName: string, newGradDate: string) => void;
    onUpdateStartDate: (courseName: string, newStartDate: string) => void;
}

const CourseProgressView: React.FC<CourseProgressViewProps> = ({
    traineesData,
    courseColors,
    scores,
    pt051Assessments,
    traineeLMPs,
    courses,
    onUpdateGradDate,
    onUpdateStartDate
}) => {
    const [showFullGraph, setShowFullGraph] = useState(false);
    const [selectedGraphCourse, setSelectedGraphCourse] = useState<string | null>(null);
    const [scoreCourse, setScoreCourse] = useState<string>('');
    const [activeAwardId, setActiveAwardId] = useState('dux');
    const [awards, setAwards] = useState([
        {
            id: 'dux',
            name: 'Dux',
            course: 'all',
            includeAllScoredEvents: true,
            minimumScoredEvents: 1,
            criteria: [
                { id: 'BGF21', event: 'BGF21', weight: 2, enabled: true },
                { id: 'BIF3', event: 'BIF3', weight: 2, enabled: true },
                { id: 'BNAV4', event: 'BNAV4', weight: 2, enabled: true },
            ],
        },
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

    const activeCourseNames = useMemo(() => new Set(activeCourses.map(course => course.name)), [activeCourses]);

    const activeTrainees = useMemo(() => {
        return traineesData
            .filter(trainee => !trainee.isPaused && activeCourseNames.has(trainee.course))
            .sort((a, b) => (a.fullName || a.name).localeCompare(b.fullName || b.name));
    }, [traineesData, activeCourseNames]);

    useEffect(() => {
        if (!scoreCourse && activeCourses[0]) {
            setScoreCourse(activeCourses[0].name);
            return;
        }

        if (scoreCourse && !activeCourses.some(course => course.name === scoreCourse)) {
            setScoreCourse(activeCourses[0]?.name || '');
        }
    }, [activeCourses, scoreCourse]);

    const activeAward = awards.find(award => award.id === activeAwardId) || awards[0];

    useEffect(() => {
        if (!activeAward) return;
        if (activeAward.course !== 'all' && !activeCourses.some(course => course.name === activeAward.course)) {
            setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, course: 'all' } : award));
        }
    }, [activeAward, activeCourses]);

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

    const pt051ScoreRecords = useMemo(() => {
        return Array.from(pt051Assessments.values())
            .filter(assessment => typeof assessment.overallGrade === 'number')
            .map(assessment => ({
                traineeName: assessment.traineeFullName,
                event: assessment.flightNumber,
                score: assessment.overallGrade as number,
                date: assessment.date || '',
            }));
    }, [pt051Assessments]);

    const scoreCourseTrainees = useMemo(() => {
        return activeTrainees.filter(trainee => trainee.course === scoreCourse);
    }, [activeTrainees, scoreCourse]);

    const scoredEvents = useMemo(() => {
        const eventSet = new Set<string>();
        const traineeNames = new Set(scoreCourseTrainees.map(trainee => trainee.fullName || trainee.name));

        pt051ScoreRecords.forEach(record => {
            if (traineeNames.has(record.traineeName)) eventSet.add(record.event);
        });

        return Array.from(eventSet).sort((a, b) => {
            const aOrder = eventOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = eventOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });
    }, [scoreCourseTrainees, pt051ScoreRecords, eventOrder]);

    const getLatestScoreForEvent = (trainee: Trainee, eventCode: string): { score: number; date: string } | undefined => {
        const traineeName = trainee.fullName || trainee.name;
        return pt051ScoreRecords
            .filter(record => record.traineeName === traineeName && record.event === eventCode)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    };

    const awardRankings = useMemo(() => {
        if (!activeAward) return [];

        const selectedTrainees = activeTrainees.filter(trainee => activeAward.course === 'all' || trainee.course === activeAward.course);
        const criteriaWeights = new Map(
            activeAward.criteria
                .filter(criterion => criterion.enabled && criterion.event.trim() && Number.isFinite(criterion.weight) && criterion.weight > 0)
                .map(criterion => [criterion.event.trim().toUpperCase(), criterion.weight])
        );

        return selectedTrainees
            .map(trainee => {
                const traineeName = trainee.fullName || trainee.name;
                const scoredRecords = pt051ScoreRecords.filter(record => record.traineeName === traineeName);
                const includedScores = activeAward.includeAllScoredEvents
                    ? scoredRecords
                    : scoredRecords.filter(record => criteriaWeights.has(record.event.toUpperCase()));

                const totals = includedScores.reduce((acc, record) => {
                    const weight = criteriaWeights.get(record.event.toUpperCase()) ?? 1;
                    return {
                        weightedScore: acc.weightedScore + (record.score * weight),
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
            .filter(row => row.scoredCount >= activeAward.minimumScoredEvents)
            .sort((a, b) => b.rankingScore - a.rankingScore || (a.trainee.fullName || a.trainee.name).localeCompare(b.trainee.fullName || b.trainee.name));
    }, [activeTrainees, activeAward, pt051ScoreRecords]);

    const updateActiveAward = (updates: Partial<typeof awards[number]>) => {
        setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, ...updates } : award));
    };

    const updateAwardCriterion = (id: string, updates: Partial<{ event: string; weight: number; enabled: boolean }>) => {
        setAwards(prev => prev.map(award => {
            if (award.id !== activeAward.id) return award;
            return {
                ...award,
                criteria: award.criteria.map(criterion => criterion.id === id ? { ...criterion, ...updates } : criterion),
            };
        }));
    };

    const addAwardCriterion = () => {
        const id = `criterion-${Date.now()}`;
        setAwards(prev => prev.map(award => award.id === activeAward.id
            ? { ...award, criteria: [...award.criteria, { id, event: '', weight: 2, enabled: true }] }
            : award
        ));
    };

    const removeAwardCriterion = (id: string) => {
        setAwards(prev => prev.map(award => award.id === activeAward.id
            ? { ...award, criteria: award.criteria.filter(criterion => criterion.id !== id) }
            : award
        ));
    };

    const addAward = () => {
        const id = `award-${Date.now()}`;
        setAwards(prev => [...prev, {
            id,
            name: 'New Award',
            course: 'all',
            includeAllScoredEvents: true,
            minimumScoredEvents: 1,
            criteria: [],
        }]);
        setActiveAwardId(id);
    };

    const removeAward = () => {
        if (awards.length <= 1) return;
        const nextAwards = awards.filter(award => award.id !== activeAward.id);
        setAwards(nextAwards);
        setActiveAwardId(nextAwards[0].id);
    };

    const scoreMatrixRows = useMemo(() => {
        return scoreCourseTrainees.map(trainee => ({
            traineeName: trainee.fullName || trainee.name,
            scores: scoredEvents.map(eventCode => getLatestScoreForEvent(trainee, eventCode)?.score ?? ''),
        }));
    }, [scoreCourseTrainees, scoredEvents, pt051ScoreRecords]);

    const escapeCsvValue = (value: string | number): string => {
        const raw = String(value);
        return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const escapeHtmlValue = (value: string | number): string => {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const exportCourseScoresCsv = () => {
        const header = ['Trainee', ...scoredEvents];
        const rows = scoreMatrixRows.map(row => [row.traineeName, ...row.scores]);
        const csv = [header, ...rows]
            .map(row => row.map(escapeCsvValue).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeCourseName = (scoreCourse || 'course').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
        link.href = url;
        link.download = `${safeCourseName}-scores.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const printCourseScores = () => {
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;

        const headerCells = scoredEvents.map(eventCode => `<th>${escapeHtmlValue(eventCode)}</th>`).join('');
        const bodyRows = scoreMatrixRows.map(row => `
            <tr>
                <td class="name">${escapeHtmlValue(row.traineeName)}</td>
                ${row.scores.map(score => `<td>${escapeHtmlValue(score)}</td>`).join('')}
            </tr>
        `).join('');
        const escapedCourseName = escapeHtmlValue(scoreCourse);

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${escapedCourseName} Course Scores</title>
                    <style>
                        body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
                        h1 { font-size: 20px; margin: 0 0 4px; }
                        p { color: #4b5563; margin: 0 0 16px; }
                        table { border-collapse: collapse; width: 100%; font-size: 11px; }
                        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; }
                        th { background: #f3f4f6; font-weight: 700; }
                        td.name, th.name { text-align: left; white-space: nowrap; }
                        @media print { body { margin: 12mm; } }
                    </style>
                </head>
                <body>
                    <h1>${escapedCourseName} Course Scores</h1>
                    <p>PT-051 overall grades</p>
                    <table>
                        <thead><tr><th class="name">Trainee</th>${headerCells}</tr></thead>
                        <tbody>${bodyRows || '<tr><td>No scores available.</td></tr>'}</tbody>
                    </table>
                    <script>
                        window.onload = function () {
                            window.print();
                            window.onafterprint = function () { window.close(); };
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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
                                <p className="text-sm text-gray-400">PT-051 overall grades and editable award ranking criteria for active course trainees.</p>
                            </div>

                            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.55fr)] gap-6">
                                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-700 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">Course Scores</h3>
                                            <p className="text-xs text-gray-400">Only events with saved PT-051 overall grades are shown.</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                                            <label className="text-sm text-gray-300 min-w-60">
                                                Course
                                                <select
                                                    value={scoreCourse}
                                                    onChange={event => setScoreCourse(event.target.value)}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    {activeCourses.map(course => <option key={course.name} value={course.name}>{course.name}</option>)}
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={printCourseScores}
                                                className="px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 rounded-md border border-gray-600/70"
                                            >
                                                Print
                                            </button>
                                            <button
                                                type="button"
                                                onClick={exportCourseScoresCsv}
                                                className="px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 rounded-md border border-gray-600/70"
                                            >
                                                Export CSV
                                            </button>
                                        </div>
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
                                                {scoreCourseTrainees.map(trainee => (
                                                    <tr key={trainee.idNumber || trainee.fullName} className="hover:bg-gray-700/30">
                                                        <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 text-gray-100 min-w-56">
                                                            <div className="font-medium">{trainee.fullName || trainee.name}</div>
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
                                                {scoreCourseTrainees.length === 0 && (
                                                    <tr>
                                                        <td className="px-4 py-8 text-center text-gray-400" colSpan={Math.max(1, scoredEvents.length + 1)}>No active trainees available for this course.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-700">
                                        <h3 className="text-lg font-semibold text-white">Course Rankings</h3>
                                        <p className="text-xs text-gray-400">Create named awards and define how each ranking is calculated.</p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                            <label className="text-sm text-gray-300">
                                                Award
                                                <select
                                                    value={activeAward.id}
                                                    onChange={event => setActiveAwardId(event.target.value)}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    {awards.map(award => <option key={award.id} value={award.id}>{award.name}</option>)}
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={addAward}
                                                className="px-3 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md"
                                            >
                                                Add Award
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="text-sm text-gray-300">
                                                Award Name
                                                <input
                                                    value={activeAward.name}
                                                    onChange={event => updateActiveAward({ name: event.target.value })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                            </label>
                                            <label className="text-sm text-gray-300">
                                                Course
                                                <select
                                                    value={activeAward.course}
                                                    onChange={event => updateActiveAward({ course: event.target.value })}
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
                                                    value={activeAward.minimumScoredEvents}
                                                    onChange={event => updateActiveAward({ minimumScoredEvents: Math.max(1, parseInt(event.target.value, 10) || 1) })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                            </label>
                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={removeAward}
                                                    disabled={awards.length <= 1}
                                                    className="w-full px-3 py-2 text-sm font-semibold text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    Remove Award
                                                </button>
                                            </div>
                                        </div>

                                        <label className="flex items-center gap-2 text-sm text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={activeAward.includeAllScoredEvents}
                                                onChange={event => updateActiveAward({ includeAllScoredEvents: event.target.checked })}
                                                className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                            />
                                            Include all scored events in this award average
                                        </label>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-gray-200">Weighted Events</h4>
                                                <button
                                                    type="button"
                                                    onClick={addAwardCriterion}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md"
                                                >
                                                    Add Event
                                                </button>
                                            </div>
                                            {activeAward.criteria.map(criterion => (
                                                <div key={criterion.id} className="grid grid-cols-[auto_minmax(0,1fr)_88px_auto] gap-2 items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={criterion.enabled}
                                                        onChange={event => updateAwardCriterion(criterion.id, { enabled: event.target.checked })}
                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    <input
                                                        value={criterion.event}
                                                        onChange={event => updateAwardCriterion(criterion.id, { event: event.target.value.toUpperCase() })}
                                                        placeholder="Event"
                                                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0.1}
                                                        step={0.1}
                                                        value={criterion.weight}
                                                        onChange={event => updateAwardCriterion(criterion.id, { weight: parseFloat(event.target.value) || 1 })}
                                                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                        aria-label="Weight"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAwardCriterion(criterion.id)}
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
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Average</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Scores</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {awardRankings.map((row, index) => (
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
                                                    {awardRankings.length === 0 && (
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
