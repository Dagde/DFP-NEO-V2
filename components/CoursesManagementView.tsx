import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useState, useMemo } from 'react';
import { Course, SyllabusItemDetail } from '../types';
import AddCourseFlyout, { NewCourseData } from './AddCourseFlyout';
import EditCourseFlyout from './EditCourseFlyout';
import { showDarkConfirm } from './DarkMessageModal';
import type { PlatformConfig } from '../utils/platformConfigService';

interface CoursesManagementViewProps {
    courses: Course[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    onAddCourse: (data: NewCourseData) => void;
    onDeleteCourse: (courseName: string, archive: boolean) => void;
    onNavigateToCourseRoster: (courseName: string) => void;
    onNavigateToArchivedCourses: () => void;
    onUpdateCourseDates: (courseName: string, startDate: string, gradDate: string) => void;
    onUpdateCourse?: (courseName: string, data: { startDate: string; gradDate: string; location: string; unit: string; lmpType: string; academicLmpType: string }) => void;
    locations?: string[];
    units?: string[];
    activeLocationCode?: string;
    activeUnitCode?: string;
    syllabusDetails?: SyllabusItemDetail[];
    platformConfig?: PlatformConfig | null;
}

const CoursesManagementView: React.FC<CoursesManagementViewProps> = ({
    courses,
    courseColors,
    archivedCourses,
    onAddCourse,
    onDeleteCourse,
    onNavigateToCourseRoster,
    onNavigateToArchivedCourses,
    onUpdateCourseDates,
    onUpdateCourse,
    locations = [],
    units = [],
    activeLocationCode = '',
    activeUnitCode = '',
    syllabusDetails = [],
    platformConfig = null,
}) => {
    const [showAddCourseFlyout, setShowAddCourseFlyout] = useState(false);
    const { isFrozen } = useSystemFreeze();
    const [showEditFlyout, setShowEditFlyout] = useState(false);
    const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
    const [pinInput, setPinInput] = useState('');
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [showChoiceDialog, setShowChoiceDialog] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

    // Group courses by type (only active courses, not archived)
    const groupedCourses = useMemo(() => {
        const groups: { [key: string]: Course[] } = {};

        // Filter out archived courses
        const activeCourses = courses.filter(course => courseColors.hasOwnProperty(course.name));

        activeCourses.forEach(course => {
            const groupName = String(course.lmpType || '').trim() || 'Courses';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(course);
        });

        return groups;
    }, [courses, courseColors]);

    const handleDeleteClick = async (courseName: string) => {
        setCourseToDelete(courseName);
        setShowPinDialog(true);
    };

    const handleEditClick = (course: Course) => {
        setCourseToEdit(course);
        setShowEditFlyout(true);
    };

    const handleUpdateCourseDates = (startDate: string, gradDate: string) => {
        if (courseToEdit) {
            onUpdateCourseDates(courseToEdit.name, startDate, gradDate);
        }
    };

    const handleUpdateCourse = (data: { startDate: string; gradDate: string; location: string; unit: string; lmpType: string; academicLmpType: string }) => {
        if (courseToEdit) {
            if (onUpdateCourse) {
                onUpdateCourse(courseToEdit.name, data);
            } else {
                // Fallback: at minimum update dates
                onUpdateCourseDates(courseToEdit.name, data.startDate, data.gradDate);
            }
        }
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

        // PIN is correct — close PIN dialog and show the Archive/Delete choice dialog
        setShowPinDialog(false);
        setPinInput('');
        setShowChoiceDialog(true);
    };

    const handleArchiveCourse = () => {
        if (!courseToDelete) return;
        onDeleteCourse(courseToDelete, true); // archive = true
        setShowChoiceDialog(false);
        setCourseToDelete(null);
    };

    const handleDeleteCoursePermanently = () => {
        if (!courseToDelete) return;
        onDeleteCourse(courseToDelete, false); // archive = false — permanent delete
        setShowChoiceDialog(false);
        setCourseToDelete(null);
    };

    const handleCancelChoice = () => {
        setShowChoiceDialog(false);
        setCourseToDelete(null);
    };

    const handleCancelPin = () => {
        setShowPinDialog(false);
        setPinInput('');
        setCourseToDelete(null);
    };

    const CourseCard: React.FC<{ course: Course }> = ({ course }) => {
        const totalStudents = course.raafStart + course.navyStart + course.armyStart;
        const darkenHexColor = (color: string) => {
            if (!color.startsWith('#') || color.length < 7) return color;
            const strength = 0.62;
            const r = Math.round(parseInt(color.slice(1, 3), 16) * strength);
            const g = Math.round(parseInt(color.slice(3, 5), 16) * strength);
            const b = Math.round(parseInt(color.slice(5, 7), 16) * strength);
            return `rgb(${r}, ${g}, ${b})`;
        };
        const courseColor = courseColors[course.name] || '';
        
        return (
            <div 
                className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-sky-500 transition-colors cursor-pointer group"
                onClick={() => onNavigateToCourseRoster(course.name)}
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div 
                            data-course-color="true"
                            className={`w-4 h-4 rounded ${!courseColor.startsWith('#') ? (courseColor || 'bg-gray-400/50') : ''}`}
                            style={courseColor.startsWith('#') ? { backgroundColor: darkenHexColor(courseColor) } : {}}
                        ></div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-sky-400 transition-colors">
                            {course.name}
                        </h3>
                    </div>
                    <div className="flex gap-[1px]">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(course);
                            }}
                            className="w-[52px] h-[28px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md"
                            title="Edit Course"
                        >
                            Edit
                        </button>
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
                </div>
                
                <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Start Date:</span>
                        <span>{new Date(course.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Grad Date:</span>
                        <span>{new Date(course.gradDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
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
        <div className="flex-1 flex flex-col bg-gray-900 h-full overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 border-b border-gray-700">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Courses Management</h2>
                        <p className="text-sm text-gray-400">Manage active and archived courses</p>
                    </div>
                    <div className="flex gap-[1px]">
                        <button
                            onClick={onNavigateToArchivedCourses}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                        >
                            <span className="text-center leading-tight">Archived<br/>Courses</span>
                        </button>
                        <button
                            onClick={() => setShowAddCourseFlyout(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                        >
                            <span className="text-center leading-tight" style={{color: "#22c55e"}}>+ Add<br/>Course</span>
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
                    locations={locations}
                    units={units}
                    activeLocationCode={activeLocationCode}
                    activeUnitCode={activeUnitCode}
                    platformConfig={platformConfig}
                />
            )}

            {/* Edit Course Flyout */}
            {showEditFlyout && courseToEdit && (
                <EditCourseFlyout
                    courseName={courseToEdit.name}
                    startDate={courseToEdit.startDate}
                    gradDate={courseToEdit.gradDate}
                    location={courseToEdit.location || ''}
                    unit={courseToEdit.unit || ''}
                    lmpType={courseToEdit.lmpType || ''}
                    academicLmpType={(courseToEdit as any).academicLmpType || ''}
                    locations={locations}
                    units={units}
                    syllabusDetails={syllabusDetails}
                    platformConfig={platformConfig}
                    onClose={() => {
                        setShowEditFlyout(false);
                        setCourseToEdit(null);
                    }}
                    onSave={handleUpdateCourse}
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

            {/* Archive / Delete Choice Dialog */}
            {showChoiceDialog && courseToDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-yellow-600/50">
                        <h3 className="text-xl font-semibold text-yellow-400 mb-2">Archive or Delete Course?</h3>
                        <p className="text-gray-300 mb-6">
                            What would you like to do with <span className="font-semibold text-sky-400">{courseToDelete}</span>?
                        </p>
                        <div className="text-sm text-gray-400 mb-6 space-y-2">
                            <p><span className="text-amber-400 font-medium">Archive</span> — hides the course but keeps all data. Can be restored later.</p>
                            <p><span className="text-red-400 font-medium">Delete</span> — permanently removes the course. This cannot be undone.</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancelChoice}
                                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleArchiveCourse}
                                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                            >
                                Archive
                            </button>
                            <button
                                onClick={handleDeleteCoursePermanently}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoursesManagementView;
