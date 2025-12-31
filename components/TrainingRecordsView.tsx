import React, { useState } from 'react';
import AuditButton from './AuditButton';
import CoursesManagementView from './CoursesManagementView';
import TrainingRecordsExportView from './TrainingRecordsExportView';
import { Course, Trainee, Instructor, ScheduleEvent, Score, SyllabusItemDetail, Pt051Assessment } from '../types';
import { NewCourseData } from './AddCourseFlyout';

interface TrainingRecordsViewProps {
    courses: Course[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    onAddCourse: (data: NewCourseData) => void;
    onDeleteCourse: (courseName: string, archive: boolean) => void;
    onNavigateToCourseRoster: (courseName: string) => void;
    onNavigateToArchivedCourses: () => void;
    traineesData: Trainee[];
    instructorsData: Instructor[];
    archivedTraineesData: Trainee[];
    archivedInstructorsData: Instructor[];
    events: ScheduleEvent[];
    scores: Map<string, Score[]>;
    publishedSchedules: Record<string, ScheduleEvent[]>;
    syllabusDetails: SyllabusItemDetail[];
    pt051Assessments: Map<string, Pt051Assessment>;
    onSavePT051Assessment: (assessment: Pt051Assessment) => void;
}

type TabType = 'courses' | 'export';

const TrainingRecordsView: React.FC<TrainingRecordsViewProps> = ({
    courses,
    courseColors,
    archivedCourses,
    onAddCourse,
    onDeleteCourse,
    onNavigateToCourseRoster,
    onNavigateToArchivedCourses,
    traineesData,
    instructorsData,
    archivedTraineesData,
    archivedInstructorsData,
    events,
    scores,
    publishedSchedules,
    syllabusDetails,
    pt051Assessments,
    onSavePT051Assessment
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('courses');

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 bg-gray-800 p-4 border-b border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Training Records</h1>
                        <p className="text-sm text-gray-400">Manage and view training records</p>
                    </div>
                    <div className="flex justify-end">
                        <AuditButton pageName="Training Records" />
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('courses')}
                        className={`px-4 py-2 rounded-t font-medium transition-colors ${
                            activeTab === 'courses'
                                ? 'bg-gray-900 text-white border-t-2 border-sky-500'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                    >
                        Courses Management
                    </button>
                    <button
                        onClick={() => setActiveTab('export')}
                        className={`px-4 py-2 rounded-t font-medium transition-colors ${
                            activeTab === 'export'
                                ? 'bg-gray-900 text-white border-t-2 border-sky-500'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                    >
                        Export Records
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
                {activeTab === 'courses' && (
                    <CoursesManagementView
                        courses={courses}
                        courseColors={courseColors}
                        archivedCourses={archivedCourses}
                        onAddCourse={onAddCourse}
                        onDeleteCourse={onDeleteCourse}
                        onNavigateToCourseRoster={onNavigateToCourseRoster}
                        onNavigateToArchivedCourses={onNavigateToArchivedCourses}
                    />
                )}
                {activeTab === 'export' && (
                    <TrainingRecordsExportView
                        traineesData={traineesData}
                        instructorsData={instructorsData}
                        archivedTraineesData={archivedTraineesData}
                        archivedInstructorsData={archivedInstructorsData}
                        events={events}
                        courses={courses}
                        archivedCourses={archivedCourses}
                        scores={scores}
                        publishedSchedules={publishedSchedules}
                        syllabusDetails={syllabusDetails}
                        pt051Assessments={pt051Assessments}
                        onSavePT051Assessment={onSavePT051Assessment}
                    />
                )}
            </div>
        </div>
    );
};

export default TrainingRecordsView;