import React from 'react';
import { Score } from '../types';

interface ScoreHistoryChartProps {
    scores: Score[];
}

const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({ scores }) => {
    if (scores.length < 2) {
        return (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 text-center text-gray-400">
                <h2 className="text-xl font-bold text-white mb-2">Score History</h2>
                <p>Not enough data to display a chart. At least two scores are required.</p>
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 2) return '#4ade80'; // green-400
        if (score === 1) return '#facc15'; // yellow-400
        return '#f87171'; // red-400
    };

    const SVG_WIDTH = 800;
    const SVG_HEIGHT = 190;
    const PADDING = { top: 40, right: 40, bottom: 60, left: 60 };
    const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
    const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

    const maxScore = 5;

    const points = scores.map((score, i) => {
        const x = PADDING.left + (i / (scores.length - 1)) * CHART_WIDTH;
        const y = PADDING.top + CHART_HEIGHT - (score.score / maxScore) * CHART_HEIGHT;
        return { x, y, score: score.score, event: score.event };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Score History</h2>
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-auto" aria-labelledby="chart-title">
                <title id="chart-title">A line chart showing trainee scores over time.</title>
                {/* Y-Axis Grid Lines and Labels */}
                {Array.from({ length: maxScore + 1 }).map((_, i) => {
                    const y = PADDING.top + CHART_HEIGHT - (i / maxScore) * CHART_HEIGHT;
                    return (
                        <g key={`y-grid-${i}`} className="text-gray-300">
                            <line
                                x1={PADDING.left}
                                y1={y}
                                x2={PADDING.left + CHART_WIDTH}
                                y2={y}
                                stroke="currentColor"
                                strokeOpacity="0.2"
                                strokeDasharray="4"
                            />
                            <text
                                x={PADDING.left - 15}
                                y={y + 5}
                                textAnchor="end"
                                fill="currentColor"
                                fontSize="14"
                            >
                                {i}
                            </text>
                        </g>
                    );
                })}
                <text x={PADDING.left - 45} y={PADDING.top + CHART_HEIGHT / 2} transform={`rotate(-90, ${PADDING.left - 45}, ${PADDING.top + CHART_HEIGHT / 2})`} textAnchor="middle" fill="currentColor" fontSize="14" className="text-gray-400">Score</text>


                {/* X-Axis Labels */}
                {points.map((point, i) => (
                    <text
                        key={`x-label-${i}`}
                        x={point.x}
                        y={SVG_HEIGHT - PADDING.bottom + 25}
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize="12"
                        className="text-gray-300"
                    >
                        {point.event}
                    </text>
                ))}
                <text x={PADDING.left + CHART_WIDTH / 2} y={SVG_HEIGHT - 10} textAnchor="middle" fill="currentColor" fontSize="14" className="text-gray-400">Event</text>

                {/* Line */}
                <polyline
                    fill="none"
                    stroke="#38bdf8" // sky-400
                    strokeWidth="3"
                    points={polylinePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Points */}
                {points.map((point, i) => (
                    <circle
                        key={`point-${i}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill={getScoreColor(point.score)}
                        stroke="#1f2937" // gray-800
                        strokeWidth="2"
                    >
                      <title>{`Event: ${point.event}, Score: ${point.score}`}</title>
                    </circle>
                ))}
            </svg>
        </div>
    );
};

export default ScoreHistoryChart;