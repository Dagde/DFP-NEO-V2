import React, { useMemo } from 'react';

interface TraineePoint {
    name: string;
    eventsCompleted: number;
}

interface CourseProgressGraphProps {
    startDate: string;
    gradDate: string;
    totalEvents: number;
    traineePoints: TraineePoint[];
    courseColor: string;
}

const CourseProgressGraph: React.FC<CourseProgressGraphProps> = ({ startDate, gradDate, totalEvents, traineePoints, courseColor }) => {
    
    // SVG dimensions and padding
    const SVG_WIDTH = 500;
    const SVG_HEIGHT = 300;
    const PADDING = { top: 20, right: 20, bottom: 50, left: 50 };
    const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
    const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

    const { dateToX, eventsToY, todayX, isValid } = useMemo(() => {
        const start = new Date(startDate + 'T00:00:00Z').getTime();
        const grad = new Date(gradDate + 'T00:00:00Z').getTime();
        const today = new Date().setUTCHours(0, 0, 0, 0);

        if (isNaN(start) || isNaN(grad) || grad <= start || totalEvents <= 0) {
            return { dateToX: null, eventsToY: null, todayX: null, isValid: false };
        }

        const totalTime = grad - start;

        const dateToX = (date: Date) => {
            const time = date.getTime();
            const x = PADDING.left + ((time - start) / totalTime) * CHART_WIDTH;
            // Clamp the x value within the chart bounds
            return Math.max(PADDING.left, Math.min(PADDING.left + CHART_WIDTH, x));
        };

        const eventsToY = (count: number) => {
            return PADDING.top + CHART_HEIGHT - (count / totalEvents) * CHART_HEIGHT;
        };

        const todayX = PADDING.left + ((today - start) / totalTime) * CHART_WIDTH;
        
        return { dateToX, eventsToY, todayX: Math.max(PADDING.left, Math.min(PADDING.left + CHART_WIDTH, todayX)), isValid: true };
    }, [startDate, gradDate, totalEvents, CHART_WIDTH, CHART_HEIGHT, PADDING]);

    const paceLines = useMemo(() => {
        if (!isValid || !dateToX || !eventsToY) return [];

        const grad = new Date(gradDate + 'T00:00:00Z');

        const paces = [
            { rate: 3, color: '#f87171', strokeDasharray: '4 4' }, // Red-400
            { rate: 3.5, color: '#e5e7eb', strokeDasharray: 'none' }, // Gray-200
            { rate: 4, color: '#4ade80', strokeDasharray: '4 4' } // Green-400
        ];

        return paces.map(pace => {
            const weeksNeeded = totalEvents / pace.rate;
            const daysNeeded = weeksNeeded * 7;
            
            const lineStartDate = new Date(grad.getTime());
            // Use UTC methods to avoid timezone issues
            lineStartDate.setUTCDate(lineStartDate.getUTCDate() - Math.floor(daysNeeded));

            return {
                x1: dateToX(lineStartDate),
                y1: eventsToY(0),
                x2: dateToX(grad),
                y2: eventsToY(totalEvents),
                color: pace.color,
                strokeDasharray: pace.strokeDasharray
            };
        });
    }, [isValid, dateToX, eventsToY, gradDate, totalEvents]);
    
    if (!isValid) {
        return (
            <div className="h-[300px] flex items-center justify-center bg-gray-700/30 rounded-lg">
                <p className="text-gray-400 text-sm text-center p-4">Not enough data to display graph. Check course start/end dates and ensure the syllabus has events.</p>
            </div>
        );
    }
    
    const yAxisTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const value = (totalEvents / tickCount) * i;
            ticks.push({ value: Math.round(value), y: eventsToY!(value) });
        }
        return ticks;
    }, [totalEvents, eventsToY]);

    const xAxisTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 4;
        const start = new Date(startDate + 'T00:00:00Z');
        const grad = new Date(gradDate + 'T00:00:00Z');
        const totalTime = grad.getTime() - start.getTime();

        for (let i = 0; i <= tickCount; i++) {
            const tickDate = new Date(start.getTime() + (totalTime / tickCount) * i);
            ticks.push({
                value: tickDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
                x: dateToX!(tickDate)
            });
        }
        return ticks;
    }, [startDate, gradDate, dateToX]);

    const pointColorClass = courseColor.replace('bg-', '').replace('-400/50', '-400').replace('/50', '');
    const traineeColor = {
        'sky': '#38bdf8', 'purple': '#c084fc', 'yellow': '#facc15',
        'pink': '#f472b6', 'teal': '#2dd4bf', 'indigo': '#818cf8',
        'cyan': '#22d3ee', 'fuchsia': '#e879f9', 'blue': '#60a5fa',
        'green': '#4ade80', 'red': '#f87171', 'lime': '#a3e635',
    }[pointColorClass] || '#9ca3af';

    return (
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-auto" aria-labelledby="chart-title">
            <title id="chart-title">Chart showing trainee progress against target pace.</title>
            
            {/* Y-Axis and Grid Lines */}
            {yAxisTicks.map(tick => (
                <g key={`y-tick-${tick.value}`} className="text-gray-500">
                    <line x1={PADDING.left} x2={PADDING.left + CHART_WIDTH} y1={tick.y} y2={tick.y} stroke="currentColor" strokeWidth="0.5" />
                    <text x={PADDING.left - 8} y={tick.y + 4} textAnchor="end" fontSize="10" fill="currentColor">{tick.value}</text>
                </g>
            ))}

            {/* X-Axis and Grid Lines */}
            {xAxisTicks.map(tick => (
                <g key={`x-tick-${tick.x}`} className="text-gray-500">
                    <line x1={tick.x} x2={tick.x} y1={PADDING.top} y2={PADDING.top + CHART_HEIGHT} stroke="currentColor" strokeWidth="0.5" />
                    <text x={tick.x} y={PADDING.top + CHART_HEIGHT + 20} textAnchor="middle" fontSize="10" fill="currentColor">{tick.value}</text>
                </g>
            ))}

            {/* Axes */}
            <path d={`M ${PADDING.left} ${PADDING.top} V ${PADDING.top + CHART_HEIGHT} H ${PADDING.left + CHART_WIDTH}`} fill="none" stroke="#6b7280" strokeWidth="1" />
            <text x={15} y={PADDING.top + CHART_HEIGHT / 2} transform={`rotate(-90 15,${PADDING.top + CHART_HEIGHT / 2})`} textAnchor="middle" fontSize="11" fill="#9ca3af">Events Completed</text>
            <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 10} textAnchor="middle" fontSize="11" fill="#9ca3af">Date</text>

            {/* Pace Lines */}
            {paceLines.map((line, index) => (
                <line key={`pace-${index}`} {...line} stroke={line.color} strokeWidth="2" />
            ))}

            {/* Today Line */}
            {todayX && <line x1={todayX} x2={todayX} y1={PADDING.top} y2={PADDING.top + CHART_HEIGHT} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 5" />}
            
            {/* Trainee Points */}
            <g>
                {traineePoints.map(point => (
                    <circle key={point.name} cx={todayX} cy={eventsToY!(point.eventsCompleted)} r="5" fill={traineeColor} stroke="#1f2937" strokeWidth="2">
                        <title>{`${point.name}: ${point.eventsCompleted} events`}</title>
                    </circle>
                ))}
            </g>
            
            {/* Legend */}
            <g transform={`translate(${PADDING.left}, ${SVG_HEIGHT - 12})`}>
                <circle cx="0" cy="0" r="3" fill="#f87171" />
                <text x="8" y="4" fontSize="10" fill="#9ca3af">3/wk</text>
                <circle cx="50" cy="0" r="3" fill="#e5e7eb" />
                <text x="58" y="4" fontSize="10" fill="#9ca3af">3.5/wk</text>
                <circle cx="115" cy="0" r="3" fill="#4ade80" />
                <text x="123" y="4" fontSize="10" fill="#9ca3af">4/wk</text>
                <line x1="165" x2="175" y1="0" y2="0" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                <text x="180" y="4" fontSize="10" fill="#9ca3af">Today</text>
            </g>
        </svg>
    );
};

export default CourseProgressGraph;