import React from 'react';
import AuditButton from './AuditButton';
import CoursesManagementView from './CoursesManagementView';
import { Course } from '../types';
import { NewCourseData } from './AddCourseFlyout';

interface TrainingRecordsViewProps {
    courses: Course[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    onAddCourse: (data: NewCourseData) => void;
    onDeleteCourse: (courseName: string, archive: boolean) => void;
    onNavigateToCourseRoster: (courseName: string) => void;
    onNavigateToArchivedCourses: () => void;
}

const TrainingRecordsView: React.FC<TrainingRecordsViewProps> = ({
    courses,
    courseColors,
    archivedCourses,
    onAddCourse,
    onDeleteCourse,
    onNavigateToCourseRoster,
    onNavigateToArchivedCourses
}) => {
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-3xl font-bold text-white">Training Records</h1>
                    <p className="text-sm text-gray-400">Manage and view training records</p>
                </div>
                <div className="flex justify-end mt-2">
                    <AuditButton pageName="Training Records" />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <CoursesManagementView
                    courses={courses}
                    courseColors={courseColors}
                    archivedCourses={archivedCourses}
                    onAddCourse={onAddCourse}
                    onDeleteCourse={onDeleteCourse}
                    onNavigateToCourseRoster={onNavigateToCourseRoster}
                    onNavigateToArchivedCourses={onNavigateToArchivedCourses}
                />
            </div>
        </div>
    );
};

export default TrainingRecordsView;