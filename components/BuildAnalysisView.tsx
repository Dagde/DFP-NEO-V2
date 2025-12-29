import React from 'react';

// Import types from App.tsx
interface CourseAnalysis {
    courseName: string;
    targetPercentage: number;
    actualPercentage: number;
    deviation: number;
    eventCount: number;
    possibleEvents: number;
    schedulingEfficiency: number;
    eventsByType: {
        flight: number;
        ftd: number;
        cpt: number;
        ground: number;
    };
    limitingFactors: {
        insufficientInstructors: number;
        noAircraftSlots: number;
        noFtdSlots: number;
        noCptSlots: number;
        traineeLimit: number;
        instructorLimit: number;
        noTimeSlots: number;
    };
    status: 'good' | 'fair' | 'poor';
}

interface TimeDistribution {
    eventsByHour: Map<number, number>;
    clusteringScore: number;
    uniformityScore: number;
}

interface ResourceUtilization {
    aircraftUtilization: number;
    instructorUtilization: number;
    ftdUtilization: number;
    standbyCount: number;
}

interface Insight {
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    recommendation?: string;
}

interface BuildAnalysis {
    buildDate: string;
    totalEvents: number;
    availableAircraft: number;
    courseAnalysis: CourseAnalysis[];
    timeDistribution: TimeDistribution;
    resourceUtilization: ResourceUtilization;
    insights: Insight[];
}

interface BuildAnalysisViewProps {
    buildDate: string;
    analysis: BuildAnalysis | null;
}

// Course Distribution Table Component
const CourseDistributionTable: React.FC<{ courseAnalysis: CourseAnalysis[] }> = ({ courseAnalysis }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Course Distribution Analysis</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold">Course</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Target %</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Actual %</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Deviation</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Possible</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Scheduled</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Efficiency</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Flight</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">FTD</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">CPT</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold">Ground</th>
                            <th className="text-center py-3 px-4 text-gray-300 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courseAnalysis.map((course, index) => {
                            const deviationColor = Math.abs(course.deviation) <= 5 ? 'text-green-400' :
                                                  Math.abs(course.deviation) <= 10 ? 'text-amber-400' : 'text-red-400';
                            
                            const efficiencyColor = (course.schedulingEfficiency || 0) >= 80 ? 'text-green-400' :
                                                   (course.schedulingEfficiency || 0) >= 60 ? 'text-amber-400' : 'text-red-400';
                            
                            const statusColor = course.status === 'good' ? 'text-green-400' :
                                              course.status === 'fair' ? 'text-amber-400' : 'text-red-400';
                            
                            const statusIcon = course.status === 'good' ? '✓' :
                                             course.status === 'fair' ? '⚠' : '✗';
                            
                            return (
                                <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                    <td className="py-3 px-4 font-semibold text-white">{course.courseName}</td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.targetPercentage.toFixed(1)}%</td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.actualPercentage.toFixed(1)}%</td>
                                    <td className={`py-3 px-4 text-right font-semibold ${deviationColor}`}>
                                        {course.deviation > 0 ? '+' : ''}{course.deviation.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-4 text-right font-semibold text-white">{course.possibleEvents || 0}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-white">{course.eventCount}</td>
                                    <td className={`py-3 px-4 text-right font-semibold ${efficiencyColor}`}>
                                        {(course.schedulingEfficiency || 0).toFixed(0)}%
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.flight}</td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.ftd}</td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.cpt}</td>
                                    <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.ground}</td>
                                    <td className={`py-3 px-4 text-center font-semibold ${statusColor}`}>
                                        {statusIcon} {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Pie Chart Component
const PieChart: React.FC<{ data: { label: string; value: number; color: string }[]; title: string }> = ({ data, title }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
        return (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-sky-400 mb-4">{title}</h2>
                <p className="text-gray-400 text-center py-8">No data available</p>
            </div>
        );
    }
    
    let currentAngle = -90; // Start from top
    const segments = data.map(item => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;
        const segment = {
            ...item,
            percentage,
            startAngle: currentAngle,
            endAngle: currentAngle + angle
        };
        currentAngle += angle;
        return segment;
    });
    
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">{title}</h2>
            <div className="flex items-center justify-center gap-8">
                {/* Pie Chart SVG */}
                <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                    {segments.map((segment, index) => {
                        const startAngle = (segment.startAngle * Math.PI) / 180;
                        const endAngle = (segment.endAngle * Math.PI) / 180;
                        const x1 = 100 + 90 * Math.cos(startAngle);
                        const y1 = 100 + 90 * Math.sin(startAngle);
                        const x2 = 100 + 90 * Math.cos(endAngle);
                        const y2 = 100 + 90 * Math.sin(endAngle);
                        const largeArc = segment.percentage > 50 ? 1 : 0;
                        
                        return (
                            <g key={index}>
                                <path
                                    d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                    fill={segment.color}
                                    stroke="#1f2937"
                                    strokeWidth="2"
                                    className="hover:opacity-80 transition-opacity"
                                >
                                    <title>{`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}</title>
                                </path>
                            </g>
                        );
                    })}
                </svg>
                
                {/* Legend */}
                <div className="space-y-2">
                    {segments.map((segment, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div 
                                className="w-4 h-4 rounded" 
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-sm text-gray-300">
                                {segment.label}: <span className="font-semibold text-white">{segment.value}</span>
                                <span className="text-gray-500 ml-1">({segment.percentage.toFixed(1)}%)</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Time Distribution Chart Component
const TimeDistributionChart: React.FC<{ timeDistribution: TimeDistribution }> = ({ timeDistribution }) => {
    // Convert eventsByHour to Map if it's not already (handles serialization)
    const eventsByHour = timeDistribution.eventsByHour instanceof Map 
        ? timeDistribution.eventsByHour 
        : new Map(Object.entries(timeDistribution.eventsByHour as any).map(([k, v]) => [parseInt(k), v as number]));
    
    const maxEvents = Math.max(...Array.from(eventsByHour.values()), 0);
    const hours = Array.from({ length: 24 }, (_, i) => i).filter(hour => eventsByHour.get(hour) && eventsByHour.get(hour)! > 0);
    
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Time Distribution</h2>
            <p className="text-gray-400 mb-4">
                Uniformity Score: <span className="text-sky-400 font-semibold">{(timeDistribution.uniformityScore * 100).toFixed(0)}%</span>
            </p>
            <div className="relative h-64 flex items-end justify-start gap-2 px-4">
                {hours.map((hour) => {
                    const count = eventsByHour.get(hour) || 0;
                    const heightPercent = maxEvents > 0 ? (count / maxEvents) * 100 : 0;
                    const heightPx = maxEvents > 0 ? (count / maxEvents) * 240 : 0; // 240px = h-60
                    
                    return (
                        <div key={hour} className="flex flex-col items-center justify-end flex-1 min-w-[40px]">
                            <div 
                                className="w-full bg-sky-500 rounded-t transition-all hover:bg-sky-400 flex items-start justify-center"
                                style={{ height: `${heightPx}px`, minHeight: '30px' }}
                                title={`${hour.toString().padStart(2, '0')}:00 - ${count} events`}
                            >
                                <div className="text-xs text-white font-semibold pt-1">{count}</div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{hour.toString().padStart(2, '0')}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Limiting Factors Section Component
const LimitingFactorsSection: React.FC<{ courseAnalysis: CourseAnalysis[] }> = ({ courseAnalysis }) => {
    // Aggregate limiting factors across all courses
    const totalLimitingFactors = {
        insufficientInstructors: 0,
        noAircraftSlots: 0,
        noFtdSlots: 0,
        noCptSlots: 0,
        traineeLimit: 0,
        instructorLimit: 0,
        noTimeSlots: 0
    };
    
    courseAnalysis.forEach(course => {
        if (course.limitingFactors) {
            Object.keys(totalLimitingFactors).forEach(key => {
                totalLimitingFactors[key as keyof typeof totalLimitingFactors] += 
                    course.limitingFactors[key as keyof typeof course.limitingFactors] || 0;
            });
        }
    });
    
    const hasLimitingFactors = Object.values(totalLimitingFactors).some(v => v > 0);
    
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Scheduling Bottlenecks</h2>
            
            {hasLimitingFactors ? (
                <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                    <h3 className="text-amber-400 font-semibold mb-3 flex items-center">
                        <span className="mr-2">⚠</span> Scheduling Constraints Detected
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {totalLimitingFactors.insufficientInstructors > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">Insufficient Instructors:</strong> {totalLimitingFactors.insufficientInstructors} events could not be scheduled due to lack of available instructors
                            </li>
                        )}
                        {totalLimitingFactors.noAircraftSlots > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">No Aircraft Slots:</strong> {totalLimitingFactors.noAircraftSlots} flight events could not be scheduled due to lack of available aircraft
                            </li>
                        )}
                        {totalLimitingFactors.noFtdSlots > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">No FTD Slots:</strong> {totalLimitingFactors.noFtdSlots} FTD events could not be scheduled due to lack of available simulators
                            </li>
                        )}
                        {totalLimitingFactors.noCptSlots > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">No CPT Slots:</strong> {totalLimitingFactors.noCptSlots} CPT events could not be scheduled due to lack of available simulators
                            </li>
                        )}
                        {totalLimitingFactors.traineeLimit > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">Trainee Daily Limit:</strong> {totalLimitingFactors.traineeLimit} events could not be scheduled because trainees reached their daily event limit
                            </li>
                        )}
                        {totalLimitingFactors.instructorLimit > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">Instructor Daily Limit:</strong> {totalLimitingFactors.instructorLimit} events could not be scheduled because instructors reached their daily event limit
                            </li>
                        )}
                        {totalLimitingFactors.noTimeSlots > 0 && (
                            <li className="text-gray-300">
                                <strong className="text-white">No Suitable Time Slots:</strong> {totalLimitingFactors.noTimeSlots} events could not be scheduled due to turnaround time conflicts or unavailability
                            </li>
                        )}
                    </ul>
                </div>
            ) : (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                    <h3 className="text-green-400 font-semibold mb-2 flex items-center">
                        <span className="mr-2">✓</span> No Scheduling Constraints
                    </h3>
                    <p className="text-gray-300 text-sm">
                        All possible events were successfully scheduled without hitting any resource or personnel limits.
                    </p>
                </div>
            )}
        </div>
    );
};

// Insights Section Component
const InsightsSection: React.FC<{ insights: Insight[] }> = ({ insights }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Insights & Recommendations</h2>
            <div className="space-y-4">
                {insights.map((insight, index) => {
                    const bgColor = insight.type === 'success' ? 'bg-green-900/20 border-green-700' :
                                   insight.type === 'warning' ? 'bg-amber-900/20 border-amber-700' :
                                   insight.type === 'error' ? 'bg-red-900/20 border-red-700' :
                                   'bg-blue-900/20 border-blue-700';
                    
                    const textColor = insight.type === 'success' ? 'text-green-400' :
                                     insight.type === 'warning' ? 'text-amber-400' :
                                     insight.type === 'error' ? 'text-red-400' :
                                     'text-blue-400';
                    
                    const icon = insight.type === 'success' ? '✓' :
                                insight.type === 'warning' ? '⚠' :
                                insight.type === 'error' ? '✗' : 'ℹ';
                    
                    return (
                        <div key={index} className={`border rounded-lg p-4 ${bgColor}`}>
                            <h4 className={`font-semibold mb-2 flex items-center ${textColor}`}>
                                <span className="mr-2">{icon}</span> {insight.message}
                            </h4>
                            {insight.recommendation && (
                                <p className="text-gray-300 text-sm">
                                    <strong>Recommendation:</strong> {insight.recommendation}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Main BuildAnalysisView Component
const BuildAnalysisView: React.FC<BuildAnalysisViewProps> = ({ buildDate, analysis }) => {
    const formattedDate = React.useMemo(() => {
        if (!buildDate) return '';
        const [year, month, day] = buildDate.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: '2-digit',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
    }, [buildDate]);
    
    if (!analysis) {
        return (
            <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
                <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
                    <header>
                        <h1 className="text-3xl font-bold text-white">Build Analysis</h1>
                        <p className="text-lg text-gray-400">Analysis for DFP on <span className="text-gray-200 font-semibold">{formattedDate}</span></p>
                    </header>
                    
                    <div className="bg-gray-800 rounded-lg shadow-lg p-12 border border-gray-700 text-center">
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-2xl font-semibold text-white mb-2">No Build Data Available</h2>
                        <p className="text-gray-400 mb-6">
                            Build analysis will appear here after you run a DFP build.
                        </p>
                        <p className="text-sm text-gray-500">
                            Click "NEO - Build" in the Priorities page to generate a build and see the analysis.
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
                <header>
                    <h1 className="text-3xl font-bold text-white">Build Analysis</h1>
                    <p className="text-lg text-gray-400">Analysis for DFP on <span className="text-gray-200 font-semibold">{formattedDate}</span></p>
                </header>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Build Date</h3>
                        <p className="mt-2 text-2xl font-bold text-white">{analysis.buildDate}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Events</h3>
                        <p className="mt-2 text-2xl font-bold text-white">{analysis.totalEvents}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Aircraft Available</h3>
                        <p className="mt-2 text-2xl font-bold text-white">{analysis.availableAircraft}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Aircraft Utilization</h3>
                        <p className="mt-2 text-2xl font-bold text-white">
                            {analysis.resourceUtilization.aircraftUtilization.toFixed(0)}%
                        </p>
                    </div>
                </div>
                
                {/* Course Distribution Table */}
                <CourseDistributionTable courseAnalysis={analysis.courseAnalysis} />
                
                {/* Limiting Factors */}
                <LimitingFactorsSection courseAnalysis={analysis.courseAnalysis} />
                
                {/* Pie Charts - Flight Events and Total Events per Course */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PieChart 
                        title="Flight Events per Course"
                        data={analysis.courseAnalysis.map((course, index) => ({
                            label: course.courseName,
                            value: course.eventsByType.flight,
                            color: `hsl(${(index * 360) / analysis.courseAnalysis.length}, 70%, 60%)`
                        }))}
                    />
                    <PieChart 
                        title="Total Events per Course"
                        data={analysis.courseAnalysis.map((course, index) => ({
                            label: course.courseName,
                            value: course.eventCount,
                            color: `hsl(${(index * 360) / analysis.courseAnalysis.length}, 70%, 60%)`
                        }))}
                    />
                </div>
                
                {/* Time Distribution Chart */}
                <TimeDistributionChart timeDistribution={analysis.timeDistribution} />
                
                {/* Insights */}
                <InsightsSection insights={analysis.insights} />
            </div>
        </div>
    );
};

export default BuildAnalysisView;