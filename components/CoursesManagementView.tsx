import React, { useState, useMemo } from 'react';
import { Course } from '../types';
import AddCourseFlyout, { NewCourseData } from './AddCourseFlyout';
import { showDarkConfirm } from './DarkMessageModal';

interface CoursesManagementViewProps {
    courses: Course[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    onAddCourse: (data: NewCourseData) => void;
    onDeleteCourse: (courseName: string, archive: boolean) => void;
    onNavigateToCourseRoster: (courseName: string) => void;
    onNavigateToArchivedCourses: () => void;
}

const CoursesManagementView: React.FC<CoursesManagementViewProps> = ({
    courses,
    courseColors,
    archivedCourses,
    onAddCourse,
    onDeleteCourse,
    onNavigateToCourseRoster,
    onNavigateToArchivedCourses
}) => {
    const [showAddCourseFlyout, setShowAddCourseFlyout] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

    // Group courses by type
    const groupedCourses = useMemo(() => {
        const groups: { [key: string]: Course[] } = {
            'ADF': [],
            'FIC': [],
            'WSO': [],
            'IFIC': [],
            'OFI': [],
            'Pilot Conversion': [],
            'Other': []
        };

        courses.forEach(course => {
            if (course.name.startsWith('ADF')) {
                groups['ADF'].push(course);
            } else if (course.name.startsWith('FIC')) {
                groups['FIC'].push(course);
            } else if (course.name.startsWith('WSO')) {
                groups['WSO'].push(course);
            } else if (course.name.startsWith('IFIC')) {
                groups['IFIC'].push(course);
            } else if (course.name.startsWith('OFI')) {
                groups['OFI'].push(course);
            } else if (course.name.toLowerCase().includes('conversion')) {
                groups['Pilot Conversion'].push(course);
            } else {
                groups['Other'].push(course);
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }, [courses]);

    const handleDeleteClick = async (courseName: string) => {
        setCourseToDelete(courseName);
        setShowPinDialog(true);
    };

    const handlePinSubmit = async () => {
        if (pinInput !== '1234') { // Replace with actual PIN validation
            await showDarkConfirm(
                'Invalid PIN',
                'The PIN you entered is incorrect. Please try again.',
                'error'
            );
            setPinInput('');
            return;
        }

        if (!courseToDelete) return;

        const archiveChoice = await showDarkConfirm(
            'Delete Course',
            `Do you want to archive or permanently delete "${courseToDelete}"?\n\nClick "Archive" to archive the course (can be restored later).\nClick "Delete" to permanently delete the course.`,
            'warning',
            'Archive',
            'Delete'
        );

        const shouldArchive = archiveChoice === true;
        onDeleteCourse(courseToDelete, shouldArchive);

        // Reset state
        setShowPinDialog(false);
        setPinInput('');
        setCourseToDelete(null);
    };

    const handleCancelPin = () => {
        setShowPinDialog(false);
        setPinInput('');
        setCourseToDelete(null);
    };

    const CourseCard: React.FC<{ course: Course }> = ({ course }) => {
        const totalStudents = course.raafStart + course.navyStart + course.armyStart;
        
        return (
            <div 
                className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-sky-500 transition-colors cursor-pointer group"
                onClick={() => onNavigateToCourseRoster(course.name)}
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${courseColors[course.name] || 'bg-gray-400/50'}`}></div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-sky-400 transition-colors">
                            {course.name}
                        </h3>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(course.name);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                        title="Delete Course"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                
                <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Start Date:</span>
                        <span>{new Date(course.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Grad Date:</span>
                        <span>{new Date(course.gradDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Total Students:</span>
                        <span className="font-semibold">{totalStudents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">RAAF: {course.raafStart}</span>
                        <span className="text-gray-400">Navy: {course.navyStart}</span>
                        <span className="text-gray-400">Army: {course.armyStart}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 border-b border-gray-700">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Courses Management</h2>
                        <p className="text-sm text-gray-400">Manage active and archived courses</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onNavigateToArchivedCourses}
                            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
                        >
                            Archived Courses
                        </button>
                        <button
                            onClick={() => setShowAddCourseFlyout(true)}
                            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
                        >
                            + Add Course
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {Object.keys(groupedCourses).length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center">
                        <p className="text-gray-400 text-lg mb-4">No courses available</p>
                        <button
                            onClick={() => setShowAddCourseFlyout(true)}
                            className="px-6 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
                        >
                            Add Your First Course
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedCourses).map(([type, coursesInGroup]) => (
                            <div key={type}>
                                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                    <span className="text-sky-400">{type}</span>
                                    <span className="text-sm text-gray-400">({coursesInGroup.length})</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {coursesInGroup.map(course => (
                                        <CourseCard key={course.name} course={course} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Course Flyout */}
            {showAddCourseFlyout && (
                <AddCourseFlyout
                    onClose={() => setShowAddCourseFlyout(false)}
                    onSave={(data) => {
                        onAddCourse(data);
                        setShowAddCourseFlyout(false);
                    }}
                    existingCourses={courseColors}
                />
            )}

            {/* PIN Dialog */}
            {showPinDialog && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                        <h3 className="text-xl font-semibold text-white mb-4">Enter PIN to Delete Course</h3>
                        <p className="text-gray-300 mb-4">
                            You are about to delete <span className="font-semibold text-sky-400">{courseToDelete}</span>
                        </p>
                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handlePinSubmit()}
                            placeholder="Enter PIN"
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancelPin}
                                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePinSubmit}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoursesManagementView;