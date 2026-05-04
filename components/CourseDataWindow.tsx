import React, { useMemo } from 'react';
import { Trainee, SyllabusItemDetail, Course, Pt051Assessment } from '../types';
import { calculateCourseProgressMetric, CourseRiskThresholds } from '../utils/courseProgressMetrics';

interface CourseDataWindowProps {
    course: Course;
    allTrainees: Trainee[];
    pt051Assessments: Map<string, Pt051Assessment>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    riskThresholds: CourseRiskThresholds;
    onUpdateGradDate: (courseName: string, newGradDate: string) => void;
    onUpdateStartDate: (courseName: string, newStartDate: string) => void;
    onShowFullGraph: () => void;
}

const CourseDataWindow: React.FC<CourseDataWindowProps> = ({
    course,
    allTrainees,
    pt051Assessments,
    traineeLMPs,
    riskThresholds,
    onUpdateGradDate,
    onUpdateStartDate,
    onShowFullGraph
}) => {
    const { name: courseName, color: courseColor, gradDate, startDate } = course;

    // Helper: determine if a color value is a hex/rgb value vs a Tailwind class
    const isHexColor = (color: string) => color.startsWith('#') || color.startsWith('rgb');
    const courseColorClass = isHexColor(courseColor || '') ? '' : (courseColor || '');
    const darkenHexColor = (color: string) => {
        if (!color.startsWith('#') || color.length < 7) return color;
        const strength = 0.62;
        const r = Math.round(parseInt(color.slice(1, 3), 16) * strength);
        const g = Math.round(parseInt(color.slice(3, 5), 16) * strength);
        const b = Math.round(parseInt(color.slice(5, 7), 16) * strength);
        return `rgb(${r}, ${g}, ${b})`;
    };
    const courseColorStyle = isHexColor(courseColor || '') ? { backgroundColor: darkenHexColor(courseColor) } : {};

    const courseData = useMemo(() => {
        return calculateCourseProgressMetric(course, allTrainees, traineeLMPs, pt051Assessments, riskThresholds);
    }, [course, allTrainees, traineeLMPs, pt051Assessments, riskThresholds]);

    

    return (
        <div data-course-progress-card="true" className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col h-fit">
            <div data-course-color="true" className={`p-4 border-b border-gray-700 rounded-t-lg ${courseColorClass}`} style={courseColorStyle}>
                 <h2 className="text-lg font-bold text-white text-center mb-2">{courseName}</h2>
                 <div className="flex justify-between items-center text-xs">
                     <div className="flex items-center space-x-1">
                        <label htmlFor={`start-date-${courseName.replace(/\s+/g, '-')}`} className="text-white/80 font-semibold cursor-pointer">Start:</label>
                        <input
                            type="date"
                            id={`start-date-${courseName.replace(/\s+/g, '-')}`}
                            value={startDate}
                            onChange={(e) => onUpdateStartDate(courseName, e.target.value)}
                            data-course-date-input="true"
                            className="bg-transparent text-white/80 font-semibold border-0 rounded p-1 focus:ring-2 focus:ring-sky-500 focus:outline-none w-28 appearance-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                    <div className="flex items-center space-x-1">
                        <label htmlFor={`grad-date-${courseName.replace(/\s+/g, '-')}`} className="text-white/80 font-semibold cursor-pointer">Grad:</label>
                        <input
                            type="date"
                            id={`grad-date-${courseName.replace(/\s+/g, '-')}`}
                            value={gradDate}
                            onChange={(e) => onUpdateGradDate(courseName, e.target.value)}
                            data-course-date-input="true"
                            className="bg-transparent text-white/80 font-semibold border-0 rounded p-1 focus:ring-2 focus:ring-sky-500 focus:outline-none w-28 appearance-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                 </div>
                <div className="w-full bg-black/30 rounded-full h-2.5 mt-2">
                    <div
                        className="bg-white/80 h-2.5 rounded-full"
                        style={{ width: `${courseData.medianProgressPercentage}%` }}
                    ></div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 text-xs">
                    <div>
                        <p className="text-white/70">Front Runner: <span className="font-semibold text-white/90">{courseData.frontRunnerEvent}</span></p>
                        <p className="text-white">Median Progress: <span className="font-bold text-white">{courseData.medianEvent}</span></p>
                        <p className="text-white/70">Back Marker: <span className="font-semibold text-white/90">{courseData.backMarkerEvent}</span></p>
                        <p className={`inline-flex mt-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${courseData.riskColorClass}`}>{courseData.riskLabel}</p>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                         <p className="text-white/70">Required Pace</p>
                         <p className="font-bold text-lg text-white">{Number.isFinite(courseData.requiredPace) ? courseData.requiredPace.toFixed(1) : '∞'}<span className="text-sm font-normal">/wk</span></p>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                {courseData.trainees.map(({ trainee, percentage, nextEvent }) => (
                    <div key={trainee.idNumber}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-300">{trainee.name}</span>
                            <span className="text-xs font-mono text-sky-300">{nextEvent}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div
                                data-course-color="true"
                                className={`${courseColorClass} h-1.5 rounded-full`}
                                style={{ width: `${percentage}%`, ...(isHexColor(courseColor || '') ? { backgroundColor: darkenHexColor(courseColor) } : {}) }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={onShowFullGraph}
                    className="w-full text-center px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-500 transition-colors text-sm font-semibold"
                >
                    Show Progress Graph
                </button>
            </div>
        </div>
    );
};

export default CourseDataWindow;
