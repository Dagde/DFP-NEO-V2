import React, { useMemo, useState } from 'react';
import { Trainee, Score, SyllabusItemDetail, Course } from '../types';
import CourseProgressGraph from './CourseProgressGraph';

interface CourseDataWindowProps {
    course: Course;
    allTrainees: Trainee[];
    scores: Map<string, Score[]>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    onUpdateGradDate: (courseName: string, newGradDate: string) => void;
    onUpdateStartDate: (courseName: string, newStartDate: string) => void;
    onShowFullGraph: () => void;
}

const CourseDataWindow: React.FC<CourseDataWindowProps> = ({
    course,
    allTrainees,
    scores,
    traineeLMPs,
    onUpdateGradDate,
    onUpdateStartDate,
    onShowFullGraph
}) => {
    const { name: courseName, color: courseColor, gradDate, startDate } = course;

    const getCompletedCount = (traineeScores: Score[]) => {
        // Exclude non-progress events like Mass Briefs and remedial packages
        return traineeScores.filter(s => !s.event.includes('MB') && !s.event.includes('-REM-') && !s.event.includes('-RF')).length;
    };

    const courseData = useMemo(() => {
        const courseTrainees = allTrainees.filter(t => t.course === courseName && !t.isPaused);
        
        const representativeLMP = traineeLMPs.get(courseTrainees[0]?.fullName) || [];
        // Standard syllabus events are those that are not Mass Briefs or remedial
        const schedulableSyllabusEvents = representativeLMP.filter(item => !item.id.includes(' MB') && !item.isRemedial);
        const totalSyllabusEvents = schedulableSyllabusEvents.length;

        const traineesWithDetails = courseTrainees.map(trainee => {
            const individualLMP = traineeLMPs.get(trainee.fullName) || [];
            const traineeScores = scores.get(trainee.fullName) || [];
            const completedEventIds = new Set(traineeScores.map(s => s.event));
            let nextEvent: string = 'Finished';

            const completedCount = getCompletedCount(traineeScores);

            if (completedCount < totalSyllabusEvents) {
                nextEvent = 'N/A'; // Default if no next event is found (e.g., prereqs not met)
                for (const item of individualLMP) {
                    if (!completedEventIds.has(item.id) && !item.code.includes(' MB')) {
                        const prereqsMet = item.prerequisites.every(p => completedEventIds.has(p));
                        if (prereqsMet) {
                            nextEvent = item.code;
                            break;
                        }
                    }
                }
            }

            const percentage = totalSyllabusEvents > 0 ? (completedCount / totalSyllabusEvents) * 100 : 0;
            return { trainee, percentage, nextEvent, completedCount };
        }).sort((a, b) => b.completedCount - a.completedCount);

        const progressCounts = traineesWithDetails.map(t => t.completedCount).sort((a, b) => a - b);
        
        // Front Runner
        const frontRunnerCount = progressCounts.length > 0 ? progressCounts[progressCounts.length - 1] : 0;
        const frontRunnerEventIndex = frontRunnerCount - 1;
        let frontRunnerEvent = 'N/A';
        if (frontRunnerCount > 0 && frontRunnerEventIndex < schedulableSyllabusEvents.length) {
            frontRunnerEvent = schedulableSyllabusEvents[frontRunnerEventIndex].code;
        } else if (courseTrainees.length > 0) {
            frontRunnerEvent = 'Not Started';
        }

        // Back Marker
        const backMarkerCount = progressCounts.length > 0 ? progressCounts[0] : 0;
        const backMarkerEventIndex = backMarkerCount - 1;
        let backMarkerEvent = 'N/A';
        if (backMarkerCount > 0 && backMarkerEventIndex < schedulableSyllabusEvents.length) {
            backMarkerEvent = schedulableSyllabusEvents[backMarkerEventIndex].code;
        } else if (courseTrainees.length > 0) {
            backMarkerEvent = 'Not Started';
        }

        // Median
        let medianCountValue = 0;
        if (progressCounts.length > 0) {
            const mid = Math.floor(progressCounts.length / 2);
            medianCountValue = progressCounts.length % 2 !== 0 ? progressCounts[mid] : (progressCounts[mid - 1] + progressCounts[mid]) / 2;
        }
        
        let medianEvent = 'N/A';
        const medianEventIndex = Math.floor(medianCountValue) - 1;

        if (totalSyllabusEvents > 0 && medianEventIndex >= 0 && medianEventIndex < schedulableSyllabusEvents.length) {
            medianEvent = schedulableSyllabusEvents[medianEventIndex].code;
        } else if (medianCountValue < 1 && courseTrainees.length > 0) {
            medianEvent = 'Not Started';
        }
        
        const medianProgressPercentage = totalSyllabusEvents > 0 ? (medianCountValue / totalSyllabusEvents) * 100 : 0;

        // Required Pace
        let requiredPace = 0;
        const eventsRemaining = totalSyllabusEvents - medianCountValue;
        if (eventsRemaining > 0 && gradDate) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const grad = new Date(gradDate);
            const daysRemaining = (grad.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            if (daysRemaining > 0) {
                const weeksRemaining = daysRemaining / 7;
                requiredPace = eventsRemaining / weeksRemaining;
            }
        }

        return {
            trainees: traineesWithDetails.sort((a,b) => b.percentage - a.percentage),
            medianProgressPercentage,
            medianEvent,
            totalSyllabusEvents,
            frontRunnerEvent,
            backMarkerEvent,
            requiredPace,
            medianCountValue,
        };
    }, [courseName, allTrainees, scores, traineeLMPs, gradDate]);

    

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col h-fit">
            <div className={`p-4 border-b border-gray-700 rounded-t-lg ${courseColor}`}>
                 <h2 className="text-lg font-bold text-white text-center mb-2">{courseName}</h2>
                 <div className="flex justify-between items-center text-xs">
                     <div className="flex items-center space-x-1">
                        <label htmlFor={`start-date-${courseName.replace(/\s+/g, '-')}`} className="text-white/80 font-semibold cursor-pointer">Start:</label>
                        <input
                            type="date"
                            id={`start-date-${courseName.replace(/\s+/g, '-')}`}
                            value={startDate}
                            onChange={(e) => onUpdateStartDate(courseName, e.target.value)}
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
                    </div>
                    <div className="text-right flex flex-col justify-center">
                         <p className="text-white/70">Required Pace</p>
                         <p className="font-bold text-lg text-white">{courseData.requiredPace.toFixed(1)}<span className="text-sm font-normal">/wk</span></p>
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
                                className={`${courseColor} h-1.5 rounded-full`}
                                style={{ width: `${percentage}%` }}
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
