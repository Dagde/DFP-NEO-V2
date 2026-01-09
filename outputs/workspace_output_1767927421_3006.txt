

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
        // Then sort by gradDate
        return courses
            .filter(course => courseColors[course.name])
            .sort((a, b) => new Date(a.gradDate).getTime() - new Date(b.gradDate).getTime());
    }, [courses, courseColors]);

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
                    </div>
                </div>
            )}
        </>
    );
};

export default CourseProgressView;