import React, { useMemo, useState } from 'react';
import { Course, Trainee, Score, SyllabusItemDetail } from '../types';
import { calculateCourseStatistics } from '../utils/courseStatistics';

interface FullPageProgressGraphProps {
    courses: Course[];
    allTrainees: Trainee[];
    scores: Map<string, Score[]>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    courseColors: { [key: string]: string };
    initialSelectedCourse: string | null;
    onClose: () => void;
}

interface WeeklyProgress {
    weekDate: Date;
    highest: number;
    lowest: number;
    average: number;
    highestTrainee: string;
    lowestTrainee: string;
}

interface CourseGraphData {
    course: Course;
    startDate: Date;
    endDate: Date;
    totalEvents: number;
    weeklyProgress: WeeklyProgress[];
    color: string;
}

const FullPageProgressGraph: React.FC<FullPageProgressGraphProps> = ({
    courses,
    allTrainees,
    scores,
    traineeLMPs,
    courseColors,
    initialSelectedCourse,
    onClose
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string | null>(initialSelectedCourse);

    // Calculate graph data for all courses
    const courseGraphData = useMemo(() => {
        const data: CourseGraphData[] = [];

        for (const course of courses) {
            if (!courseColors[course.name]) continue;

            const courseTrainees = allTrainees.filter(t => t.course === course.name && !t.isPaused);
            if (courseTrainees.length === 0) continue;

            // Get representative LMP to determine total events
            const representativeLMP = traineeLMPs.get(courseTrainees[0]?.fullName) || [];
            const flightAndFtdEvents = representativeLMP.filter(
                item => (item.type === 'Flight' || item.type === 'FTD') && !item.isRemedial
            );
            const totalEvents = flightAndFtdEvents.length;

            if (totalEvents === 0) continue;

            const startDate = new Date(course.startDate + 'T00:00:00Z');
            const endDate = new Date(course.gradDate + 'T00:00:00Z');

            // Find the first date any Flight or FTD event was completed for this course
            let firstEventDate: Date | null = null;
            for (const trainee of courseTrainees) {
                const traineeScores = scores.get(trainee.fullName) || [];
                const traineeLMP = traineeLMPs.get(trainee.fullName) || [];
                
                for (const score of traineeScores) {
                    // Skip non-progress events
                    if (score.event.includes('MB') || score.event.includes('-REM-') || score.event.includes('-RF')) {
                        continue;
                    }
                    
                    const syllabusItem = traineeLMP.find(item => item.id === score.event);
                    if (syllabusItem && (syllabusItem.type === 'Flight' || syllabusItem.type === 'FTD') && !syllabusItem.isRemedial) {
                        const scoreDate = new Date(score.date + 'T00:00:00Z');
                        if (!firstEventDate || scoreDate < firstEventDate) {
                            firstEventDate = scoreDate;
                        }
                    }
                }
            }

            if (!firstEventDate) {
                console.log(`[ProgressGraph] No first event date found for ${course.name}`);
                continue;
            }

            // Calculate weekly progress from first event date to current week
            const weeklyProgress: WeeklyProgress[] = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let currentWeekStart = new Date(firstEventDate);
            currentWeekStart.setHours(0, 0, 0, 0);

            while (currentWeekStart <= today) {
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);

                // Calculate progress for each trainee up to this week
                const traineeProgress: { name: string; count: number }[] = [];

                for (const trainee of courseTrainees) {
                    const traineeScores = scores.get(trainee.fullName) || [];
                    const traineeLMP = traineeLMPs.get(trainee.fullName) || [];
                    
                    let completedCount = 0;
                    for (const score of traineeScores) {
                        const scoreDate = new Date(score.date + 'T00:00:00Z');
                        if (scoreDate <= weekEnd) {
                            // Skip non-progress events
                            if (score.event.includes('MB') || score.event.includes('-REM-') || score.event.includes('-RF')) {
                                continue;
                            }
                            
                            const syllabusItem = traineeLMP.find(item => item.id === score.event);
                            if (syllabusItem && (syllabusItem.type === 'Flight' || syllabusItem.type === 'FTD') && !syllabusItem.isRemedial) {
                                completedCount++;
                            }
                        }
                    }
                    traineeProgress.push({ name: trainee.fullName, count: completedCount });
                }

                if (traineeProgress.length > 0) {
                    traineeProgress.sort((a, b) => b.count - a.count);
                    const highest = traineeProgress[0].count;
                    const lowest = traineeProgress[traineeProgress.length - 1].count;
                    const average = traineeProgress.reduce((sum, t) => sum + t.count, 0) / traineeProgress.length;

                    weeklyProgress.push({
                        weekDate: new Date(currentWeekStart),
                        highest,
                        lowest,
                        average,
                        highestTrainee: traineeProgress[0].name,
                        lowestTrainee: traineeProgress[traineeProgress.length - 1].name
                    });
                }

                currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            }

            console.log(`[ProgressGraph] Course: ${course.name}`);
            console.log(`  - Course Start: ${startDate.toLocaleDateString()}`);
            console.log(`  - Course Grad: ${endDate.toLocaleDateString()}`);
            console.log(`  - Total Events: ${totalEvents}`);
            console.log(`  - First Event Date: ${firstEventDate?.toLocaleDateString()}`);
            console.log(`  - Weekly Progress Points: ${weeklyProgress.length}`);
            if (weeklyProgress.length > 0) {
                console.log(`  - Sample Week 1:`, weeklyProgress[0]);
                console.log(`  - Sample Last Week:`, weeklyProgress[weeklyProgress.length - 1]);
            }

            data.push({
                course,
                startDate,
                endDate,
                totalEvents,
                weeklyProgress,
                color: courseColors[course.name]
            });
        }

        console.log(`[ProgressGraph] Total courses with data: ${data.length}`);
        return data;
    }, [courses, allTrainees, scores, traineeLMPs, courseColors]);

    // Filter to selected course or show all
    const displayData = selectedCourse 
        ? courseGraphData.filter(d => d.course.name === selectedCourse)
        : courseGraphData;

    return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors font-semibold"
                    >
                        ← Minimize
                    </button>
                    <h1 className="text-2xl font-bold text-white">Course Progress Graphs</h1>
                </div>
                
                {/* Course Filter */}
                <div className="flex items-center space-x-2">
                    <label className="text-gray-300 text-sm font-semibold">Filter:</label>
                    <select
                        value={selectedCourse || ''}
                        onChange={(e) => setSelectedCourse(e.target.value || null)}
                        className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">All Courses</option>
                        {courseGraphData.map(data => (
                            <option key={data.course.name} value={data.course.name}>
                                {data.course.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Graphs Container */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-8 max-w-7xl mx-auto">
                    {displayData.map(data => (
                        <CourseGraph 
                            key={data.course.name} 
                            data={data}
                            allTrainees={allTrainees}
                            scores={scores}
                            traineeLMPs={traineeLMPs}
                            courses={courses}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface CourseGraphProps {
    data: CourseGraphData;
    allTrainees: Trainee[];
    scores: Map<string, Score[]>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    courses: Course[];
}

const CourseGraph: React.FC<CourseGraphProps> = ({ data, allTrainees, scores, traineeLMPs, courses }) => {
    const { course, startDate, endDate, totalEvents, weeklyProgress, color } = data;

    // Calculate course statistics for this specific course
    const { frontRunnerStats, backMarkerStats, courseAverageStats } = useMemo(() => {
        const courseTrainees = allTrainees.filter(t => t.course === course.name && !t.isPaused);
        
        if (courseTrainees.length === 0) {
            return {
                frontRunnerStats: { eventsPerWeek: 0 },
                backMarkerStats: { eventsPerWeek: 0 },
                courseAverageStats: { eventsPerWeek: 0 }
            };
        }

        return calculateCourseStatistics(courseTrainees, scores, traineeLMPs, [course]);
    }, [course, allTrainees, scores, traineeLMPs]);

    // SVG dimensions - reduced for better screen fit
    const SVG_WIDTH = 800;  // Reduced from 1000
    const SVG_HEIGHT = 450; // Reduced from 600
    const PADDING = { top: 50, right: 50, bottom: 70, left: 70 }; // Reduced padding
    const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
    const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

    // Coordinate conversion functions
    const dateToX = (date: Date) => {
        const totalTime = endDate.getTime() - startDate.getTime();
        const elapsed = date.getTime() - startDate.getTime();
        const x = PADDING.left + (elapsed / totalTime) * CHART_WIDTH;
        // Clamp to chart bounds
        return Math.max(PADDING.left, Math.min(PADDING.left + CHART_WIDTH, x));
    };

    const eventsToY = (count: number) => {
        return PADDING.top + CHART_HEIGHT - (count / totalEvents) * CHART_HEIGHT;
    };

    // Calculate reference lines (3.5, 4.0, 4.5 events per week) - updated colors
    const referenceLines = useMemo(() => {
        const lines = [];
        const rates = [
            { rate: 3.5, color: '#34d399', label: '3.5/wk', dash: '8 4' },    // Green
            { rate: 4.0, color: '#fbbf24', label: '4.0/wk', dash: 'none' },    // Yellow
            { rate: 4.5, color: '#f87171', label: '4.5/wk', dash: '8 4' }     // Red
        ];

        for (const { rate, color, label, dash } of rates) {
            const weeksNeeded = totalEvents / rate;
            const daysNeeded = weeksNeeded * 7;
            const lineStartDate = new Date(endDate);
            lineStartDate.setDate(lineStartDate.getDate() - Math.floor(daysNeeded));

            lines.push({
                x1: dateToX(lineStartDate),
                y1: eventsToY(0),
                x2: dateToX(endDate),
                y2: eventsToY(totalEvents),
                color,
                label,
                dash
            });
        }

        return lines;
    }, [startDate, endDate, totalEvents]);

    // Y-axis ticks
    const yAxisTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 8; // Reduced from 10
        for (let i = 0; i <= tickCount; i++) {
            const value = (totalEvents / tickCount) * i;
            ticks.push({ value: Math.round(value), y: eventsToY(value) });
        }
        return ticks;
    }, [totalEvents]);

    // X-axis ticks (monthly)
    const xAxisTicks = useMemo(() => {
        const ticks = [];
        const current = new Date(startDate);
        current.setDate(1); // Start of month
        
        while (current <= endDate) {
            if (current >= startDate) {
                ticks.push({
                    date: new Date(current),
                    x: dateToX(current),
                    label: current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                });
            }
            current.setMonth(current.getMonth() + 1);
        }
        
        return ticks;
    }, [startDate, endDate]);

    // Generate path for average line
    const averagePath = useMemo(() => {
        if (weeklyProgress.length === 0) return '';
        
        const points = weeklyProgress.map(wp => ({
            x: dateToX(wp.weekDate),
            y: eventsToY(wp.average)
        }));

        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }, [weeklyProgress]);

    // Extract color for dots
    const dotColor = color.includes('sky') ? '#38bdf8' :
                     color.includes('purple') ? '#c084fc' :
                     color.includes('yellow') ? '#facc15' :
                     color.includes('pink') ? '#f472b6' :
                     color.includes('teal') ? '#2dd4bf' :
                     color.includes('indigo') ? '#818cf8' :
                     color.includes('cyan') ? '#22d3ee' :
                     color.includes('fuchsia') ? '#e879f9' :
                     color.includes('blue') ? '#60a5fa' :
                     color.includes('green') ? '#4ade80' :
                     color.includes('red') ? '#f87171' :
                     color.includes('lime') ? '#a3e635' : '#9ca3af';

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4">
            <div className={`mb-4 p-3 rounded-lg ${color}`}>
                <h2 className="text-lg font-bold text-white text-center">{course.name}</h2>
                <div className="flex justify-between text-sm text-white/80 mt-2">
                    <span>Start: {startDate.toLocaleDateString('en-GB')}</span>
                    <span>Total Events: {totalEvents}</span>
                    <span>Graduation: {endDate.toLocaleDateString('en-GB')}</span>
                </div>
            </div>

            {/* Events Per Week Display for this course */}
            <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-gray-300 mb-2">Events Per Week Required:</div>
                <div className="flex space-x-6">
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-300">Front Runner: <span className="font-bold text-green-400">{frontRunnerStats.eventsPerWeek.toFixed(1)}</span>/wk</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-300">Course Average: <span className="font-bold text-blue-400">{courseAverageStats.eventsPerWeek.toFixed(1)}</span>/wk</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-300">Back Marker: <span className="font-bold text-red-400">{backMarkerStats.eventsPerWeek.toFixed(1)}</span>/wk</span>
                    </div>
                </div>
            </div>

            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-auto">
                {/* Grid and Axes */}
                <defs>
                    <pattern id={`grid-${course.name}`} width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#374151" strokeWidth="0.5"/>
                    </pattern>
                </defs>
                <rect x={PADDING.left} y={PADDING.top} width={CHART_WIDTH} height={CHART_HEIGHT} fill={`url(#grid-${course.name})`} />

                {/* Y-Axis */}
                {yAxisTicks.map(tick => (
                    <g key={`y-${tick.value}`}>
                        <line 
                            x1={PADDING.left} 
                            x2={PADDING.left + CHART_WIDTH} 
                            y1={tick.y} 
                            y2={tick.y} 
                            stroke="#4b5563" 
                            strokeWidth="1" 
                        />
                        <text 
                            x={PADDING.left - 10} 
                            y={tick.y + 4} 
                            textAnchor="end" 
                            fontSize="11" 
                            fill="#9ca3af"
                        >
                            {tick.value}
                        </text>
                    </g>
                ))}

                {/* X-Axis */}
                {xAxisTicks.map(tick => (
                    <g key={`x-${tick.x}`}>
                        <line 
                            x1={tick.x} 
                            x2={tick.x} 
                            y1={PADDING.top} 
                            y2={PADDING.top + CHART_HEIGHT} 
                            stroke="#4b5563" 
                            strokeWidth="1" 
                        />
                        <text 
                            x={tick.x} 
                            y={PADDING.top + CHART_HEIGHT + 20} 
                            textAnchor="middle" 
                            fontSize="10" 
                            fill="#9ca3af"
                        >
                            {tick.label}
                        </text>
                    </g>
                ))}

                {/* Axis borders */}
                <path 
                    d={`M ${PADDING.left} ${PADDING.top} V ${PADDING.top + CHART_HEIGHT} H ${PADDING.left + CHART_WIDTH}`} 
                    fill="none" 
                    stroke="#6b7280" 
                    strokeWidth="2" 
                />

                {/* Axis labels */}
                <text 
                    x={PADDING.left / 2} 
                    y={PADDING.top + CHART_HEIGHT / 2} 
                    transform={`rotate(-90 ${PADDING.left / 2} ${PADDING.top + CHART_HEIGHT / 2})`} 
                    textAnchor="middle" 
                    fontSize="12" 
                    fill="#d1d5db" 
                    fontWeight="bold"
                >
                    Events Completed
                </text>
                <text 
                    x={PADDING.left + CHART_WIDTH / 2} 
                    y={SVG_HEIGHT - 15} 
                    textAnchor="middle" 
                    fontSize="12" 
                    fill="#d1d5db" 
                    fontWeight="bold"
                >
                    Date
                </text>

                {/* Reference lines */}
                {referenceLines.map((line, i) => (
                    <line 
                        key={`ref-${i}`}
                        x1={line.x1} 
                        y1={line.y1} 
                        x2={line.x2} 
                        y2={line.y2} 
                        stroke={line.color} 
                        strokeWidth="2" 
                        strokeDasharray={line.dash}
                    />
                ))}

                {/* Average progress line */}
                {averagePath && (
                    <path 
                        d={averagePath} 
                        fill="none" 
                        stroke="#60a5fa" 
                        strokeWidth="2.5"
                    />
                )}

                {/* Weekly progress dots */}
                {weeklyProgress.length > 0 && weeklyProgress.map((wp, i) => {
                    const x = dateToX(wp.weekDate);
                    const yHigh = eventsToY(wp.highest);
                    const yLow = eventsToY(wp.lowest);
                    const yAvg = eventsToY(wp.average);
                    
                    // Debug log for first and last week
                    if (i === 0 || i === weeklyProgress.length - 1) {
                        console.log(`[Graph] Week ${i + 1}: x=${x}, highest=${wp.highest} (y=${yHigh}), lowest=${wp.lowest} (y=${yLow}), avg=${wp.average.toFixed(1)} (y=${yAvg})`);
                    }
                    
                    return (
                        <g key={`week-${i}`}>
                            {/* Highest trainee dot */}
                            <circle 
                                cx={x} 
                                cy={yHigh} 
                                r="2.5" 
                                fill="#4ade80" 
                                stroke="#1f2937" 
                                strokeWidth="1"
                            >
                                <title>{`Week ${i + 1}: Highest - ${wp.highest} events (${wp.highestTrainee})`}</title>
                            </circle>
                            
                            {/* Lowest trainee dot */}
                            <circle 
                                cx={x} 
                                cy={yLow} 
                                r="2.5" 
                                fill="#f87171" 
                                stroke="#1f2937" 
                                strokeWidth="1"
                            >
                                <title>{`Week ${i + 1}: Lowest - ${wp.lowest} events (${wp.lowestTrainee})`}</title>
                            </circle>

                            {/* Average dot */}
                            <circle 
                                cx={x} 
                                cy={yAvg} 
                                r="2" 
                                fill="#60a5fa" 
                                stroke="#1f2937" 
                                strokeWidth="1"
                            >
                                <title>{`Week ${i + 1}: Average - ${wp.average.toFixed(1)} events`}</title>
                            </circle>
                        </g>
                    );
                })}

                {/* Legend */}
                <g transform={`translate(${PADDING.left + 15}, ${PADDING.top - 30})`}>
                    <text x="0" y="0" fontSize="10" fill="#d1d5db" fontWeight="bold">Reference Lines:</text>
                    
                    <line x1="100" y1="-3" x2="120" y2="-3" stroke="#f87171" strokeWidth="2" strokeDasharray="8 4" />
                    <text x="125" y="0" fontSize="9" fill="#9ca3af">3.5/wk</text>
                    
                    <line x1="170" y1="-3" x2="190" y2="-3" stroke="#fbbf24" strokeWidth="2" />
                    <text x="195" y="0" fontSize="9" fill="#9ca3af">4.0/wk</text>
                    
                    <line x1="240" y1="-3" x2="260" y2="-3" stroke="#4ade80" strokeWidth="2" strokeDasharray="8 4" />
                    <text x="265" y="0" fontSize="9" fill="#9ca3af">4.5/wk</text>

                    <text x="320" y="0" fontSize="10" fill="#d1d5db" fontWeight="bold">Progress:</text>
                    
                    <circle cx="380" cy="-3" r="3" fill="#4ade80" stroke="#1f2937" strokeWidth="1.5" />
                    <text x="385" y="0" fontSize="9" fill="#9ca3af">Highest</text>
                    
                    <circle cx="430" cy="-3" r="3" fill="#f87171" stroke="#1f2937" strokeWidth="1.5" />
                    <text x="435" y="0" fontSize="9" fill="#9ca3af">Lowest</text>
                    
                    <line x1="480" y1="-3" x2="495" y2="-3" stroke="#60a5fa" strokeWidth="2.5" />
                    <text x="500" y="0" fontSize="9" fill="#9ca3af">Average</text>
                </g>
            </svg>
        </div>
    );
};

export default FullPageProgressGraph;