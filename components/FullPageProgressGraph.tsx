import React, { useMemo, useState } from 'react';
import { Course, Pt051Assessment, SyllabusItemDetail, Trainee } from '../types';
import { calculateCourseProgressMetric, CourseProgressMetric, CourseRiskThresholds, WeeklyCourseProgress } from '../utils/courseProgressMetrics';

interface FullPageProgressGraphProps {
    courses: Course[];
    allTrainees: Trainee[];
    pt051Assessments: Map<string, Pt051Assessment>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    riskThresholds: CourseRiskThresholds;
    courseColors: { [key: string]: string };
    initialSelectedCourse: string | null;
    onClose: () => void;
}

interface CourseGraphData {
    course: Course;
    startDate: Date;
    endDate: Date;
    totalEvents: number;
    weeklyProgress: WeeklyCourseProgress[];
    metric: CourseProgressMetric;
    color: string;
}

const FullPageProgressGraph: React.FC<FullPageProgressGraphProps> = ({
    courses,
    allTrainees,
    pt051Assessments,
    traineeLMPs,
    riskThresholds,
    courseColors,
    initialSelectedCourse,
    onClose
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string | null>(initialSelectedCourse);

    const courseGraphData = useMemo(() => {
        return courses
            .filter(course => courseColors[course.name])
            .map(course => {
                const metric = calculateCourseProgressMetric(course, allTrainees, traineeLMPs, pt051Assessments, riskThresholds);
                return {
                    course,
                    startDate: new Date(`${course.startDate}T00:00:00`),
                    endDate: new Date(`${course.gradDate}T00:00:00`),
                    totalEvents: metric.totalEvents,
                    weeklyProgress: metric.weeklyProgress,
                    metric,
                    color: courseColors[course.name],
                };
            })
            .filter(data => data.totalEvents > 0 && data.metric.trainees.length > 0);
    }, [courses, allTrainees, traineeLMPs, pt051Assessments, riskThresholds, courseColors]);

    const displayData = selectedCourse
        ? courseGraphData.filter(data => data.course.name === selectedCourse)
        : courseGraphData;

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onClose}
                        className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                    >
                        ← Minimise
                    </button>
                    <h1 className="text-2xl font-bold text-white">Course Progress Graphs</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-gray-300 text-sm font-semibold">Filter:</label>
                    <select
                        value={selectedCourse || ''}
                        onChange={(event) => setSelectedCourse(event.target.value || null)}
                        className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">All Courses</option>
                        {courseGraphData.map(data => (
                            <option key={data.course.name} value={data.course.name}>{data.course.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-8 max-w-7xl mx-auto">
                    {displayData.map(data => <CourseGraph key={data.course.name} data={data} />)}
                </div>
            </div>
        </div>
    );
};

interface CourseGraphProps {
    data: CourseGraphData;
}

const CourseGraph: React.FC<CourseGraphProps> = ({ data }) => {
    const { course, startDate, endDate, totalEvents, weeklyProgress, color, metric } = data;
    const SVG_WIDTH = 800;
    const SVG_HEIGHT = 450;
    const PADDING = { top: 50, right: 50, bottom: 70, left: 70 };
    const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
    const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

    const dateToX = (date: Date) => {
        const totalTime = Math.max(1, endDate.getTime() - startDate.getTime());
        const elapsed = date.getTime() - startDate.getTime();
        const x = PADDING.left + (elapsed / totalTime) * CHART_WIDTH;
        return Math.max(PADDING.left, Math.min(PADDING.left + CHART_WIDTH, x));
    };

    const eventsToY = (count: number) => {
        return PADDING.top + CHART_HEIGHT - (count / totalEvents) * CHART_HEIGHT;
    };

    const buildReferenceLine = (rate: number, color: string, label: string, dash: string) => {
        const courseWeeks = Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const projectedEvents = Math.min(totalEvents, courseWeeks * rate);
        const endLineDate = projectedEvents >= totalEvents
            ? new Date(startDate.getTime() + (totalEvents / rate) * 7 * 24 * 60 * 60 * 1000)
            : endDate;
        return {
            x1: dateToX(startDate),
            y1: eventsToY(0),
            x2: dateToX(endLineDate),
            y2: eventsToY(projectedEvents),
            color,
            label,
            dash,
        };
    };

    const referenceLines = [
        buildReferenceLine(3.5, '#34d399', '3.5/wk', '8 4'),
        buildReferenceLine(4.0, '#fbbf24', '4.0/wk', 'none'),
        buildReferenceLine(4.5, '#f87171', '4.5/wk', '8 4'),
    ];

    const yAxisTicks = Array.from({ length: 9 }, (_, index) => {
        const value = (totalEvents / 8) * index;
        return { value: Math.round(value), y: eventsToY(value) };
    });

    const xAxisTicks = useMemo(() => {
        const ticks = [];
        const current = new Date(startDate);
        current.setDate(1);
        while (current <= endDate) {
            if (current >= startDate) {
                ticks.push({
                    x: dateToX(current),
                    label: current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                });
            }
            current.setMonth(current.getMonth() + 1);
        }
        return ticks;
    }, [startDate, endDate]);

    const averagePath = weeklyProgress
        .map((week, index) => `${index === 0 ? 'M' : 'L'} ${dateToX(week.weekDate)} ${eventsToY(week.average)}`)
        .join(' ');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayX = dateToX(today);

    const isHexColor = (value: string) => value && (value.startsWith('#') || value.startsWith('rgb'));

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4">
            <div className={`mb-4 p-3 rounded-lg ${isHexColor(color) ? '' : color}`} style={isHexColor(color) ? { backgroundColor: color } : {}}>
                <h2 className="text-lg font-bold text-white text-center">{course.name}</h2>
                <div className="flex flex-wrap justify-between gap-3 text-sm text-white/80 mt-2">
                    <span>Start: {startDate.toLocaleDateString('en-GB')}</span>
                    <span>Total PT-051 Events: {totalEvents}</span>
                    <span>Graduation: {endDate.toLocaleDateString('en-GB')}</span>
                    <span className={`px-2 py-0.5 rounded border font-semibold ${metric.riskColorClass}`}>{metric.riskLabel}</span>
                </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-gray-300 mb-2">Course Risk Projection:</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span className="text-sm text-gray-300">Average completed: <span className="font-bold text-blue-300">{metric.averageCompletedEvents.toFixed(1)}</span> events</span>
                    <span className="text-sm text-gray-300">Required pace: <span className="font-bold text-blue-300">{Number.isFinite(metric.requiredPace) ? metric.requiredPace.toFixed(1) : '∞'}</span>/wk</span>
                    <span className="text-sm text-gray-300">School profile: <span className="font-bold text-emerald-300">3.5</span>/wk</span>
                </div>
            </div>

            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-auto">
                <defs>
                    <pattern id={`grid-${course.name}`} width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#374151" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect x={PADDING.left} y={PADDING.top} width={CHART_WIDTH} height={CHART_HEIGHT} fill={`url(#grid-${course.name})`} />

                {yAxisTicks.map(tick => (
                    <g key={`y-${tick.value}`}>
                        <line x1={PADDING.left} x2={PADDING.left + CHART_WIDTH} y1={tick.y} y2={tick.y} stroke="#374151" strokeWidth="0.5" />
                        <text x={PADDING.left - 10} y={tick.y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{tick.value}</text>
                    </g>
                ))}

                {xAxisTicks.map(tick => (
                    <g key={`x-${tick.x}`}>
                        <line x1={tick.x} x2={tick.x} y1={PADDING.top} y2={PADDING.top + CHART_HEIGHT} stroke="#374151" strokeWidth="0.5" />
                        <text x={tick.x} y={PADDING.top + CHART_HEIGHT + 20} textAnchor="middle" fontSize="10" fill="#9ca3af">{tick.label}</text>
                    </g>
                ))}

                <path d={`M ${PADDING.left} ${PADDING.top} V ${PADDING.top + CHART_HEIGHT} H ${PADDING.left + CHART_WIDTH}`} fill="none" stroke="#6b7280" strokeWidth="1" />
                <text x={PADDING.left / 2} y={PADDING.top + CHART_HEIGHT / 2} transform={`rotate(-90 ${PADDING.left / 2} ${PADDING.top + CHART_HEIGHT / 2})`} textAnchor="middle" fontSize="12" fill="#d1d5db" fontWeight="bold">Events Completed</text>
                <text x={PADDING.left + CHART_WIDTH / 2} y={SVG_HEIGHT - 15} textAnchor="middle" fontSize="12" fill="#d1d5db" fontWeight="bold">Date</text>

                {referenceLines.map((line) => (
                    <line key={line.label} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.color} strokeWidth="1.25" strokeDasharray={line.dash} />
                ))}

                {averagePath && <path d={averagePath} fill="none" stroke="#60a5fa" strokeWidth="1.75" />}
                <line x1={todayX} x2={todayX} y1={PADDING.top} y2={PADDING.top + CHART_HEIGHT} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5 5" />

                {weeklyProgress.map((week, index) => {
                    const x = dateToX(week.weekDate);
                    return (
                        <g key={`week-${index}`}>
                            <circle cx={x} cy={eventsToY(week.highest)} r="1.75" fill="#4ade80" stroke="#1f2937" strokeWidth="0.5">
                                <title>{`Week ${index + 1}: Highest - ${week.highest} events (${week.highestTrainee})`}</title>
                            </circle>
                            <circle cx={x} cy={eventsToY(week.lowest)} r="1.75" fill="#f87171" stroke="#1f2937" strokeWidth="0.5">
                                <title>{`Week ${index + 1}: Lowest - ${week.lowest} events (${week.lowestTrainee})`}</title>
                            </circle>
                            <circle cx={x} cy={eventsToY(week.average)} r="1.35" fill="#60a5fa" stroke="#1f2937" strokeWidth="0.5">
                                <title>{`Week ${index + 1}: Average - ${week.average.toFixed(1)} events`}</title>
                            </circle>
                        </g>
                    );
                })}

                <g transform={`translate(${PADDING.left + 15}, ${PADDING.top - 30})`}>
                    <text x="0" y="0" fontSize="10" fill="#d1d5db" fontWeight="bold">Reference:</text>
                    <line x1="70" y1="-3" x2="90" y2="-3" stroke="#34d399" strokeWidth="2" strokeDasharray="8 4" />
                    <text x="95" y="0" fontSize="9" fill="#9ca3af">3.5/wk</text>
                    <line x1="140" y1="-3" x2="160" y2="-3" stroke="#fbbf24" strokeWidth="2" />
                    <text x="165" y="0" fontSize="9" fill="#9ca3af">4.0/wk</text>
                    <line x1="210" y1="-3" x2="230" y2="-3" stroke="#f87171" strokeWidth="2" strokeDasharray="8 4" />
                    <text x="235" y="0" fontSize="9" fill="#9ca3af">4.5/wk</text>
                    <text x="290" y="0" fontSize="10" fill="#d1d5db" fontWeight="bold">Actual:</text>
                    <circle cx="340" cy="-3" r="3" fill="#4ade80" />
                    <text x="346" y="0" fontSize="9" fill="#9ca3af">Highest</text>
                    <circle cx="400" cy="-3" r="3" fill="#f87171" />
                    <text x="406" y="0" fontSize="9" fill="#9ca3af">Lowest</text>
                    <line x1="460" y1="-3" x2="475" y2="-3" stroke="#60a5fa" strokeWidth="2.5" />
                    <text x="480" y="0" fontSize="9" fill="#9ca3af">Average</text>
                </g>
            </svg>
        </div>
    );
};

export default FullPageProgressGraph;
