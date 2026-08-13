import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useState, useMemo } from 'react';
import { Course, SyllabusItemDetail, Trainee } from '../types';
import AddCourseFlyout, { NewCourseData } from './AddCourseFlyout';
import EditCourseFlyout from './EditCourseFlyout';
import { showDarkConfirm } from './DarkMessageModal';
import type { OperationalModelCode, PlatformConfig } from '../utils/platformConfigService';

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
    operationalModel?: OperationalModelCode | string;
    syllabusDetails?: SyllabusItemDetail[];
    platformConfig?: PlatformConfig | null;
    serviceDefinitions?: Array<{ longName?: string; shortName?: string }>;
    traineesData?: Trainee[];
}

const getServiceCountLabels = (serviceDefinitions: Array<{ longName?: string; shortName?: string }> = []): [string, string, string] => {
    const labels = serviceDefinitions
        .map(service => String(service.shortName || service.longName || '').trim())
        .filter(Boolean);
    return [
        labels[0] || 'Group 1',
        labels[1] || 'Group 2',
        labels[2] || 'Group 3',
    ];
};

const normaliseCourseScopeToken = (value: unknown): string => String(value || '').trim().toUpperCase();

const splitCourseUnitCodes = (value: unknown): string[] => (
    Array.from(new Set(
        String(value || '')
            .split(/[+,/]/)
            .map(normaliseCourseScopeToken)
            .filter(Boolean)
    ))
);

const downloadJsonFile = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

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
    operationalModel = 'flight_school',
    syllabusDetails = [],
    platformConfig = null,
    serviceDefinitions = [],
    traineesData = [],
}) => {
    const [showAddCourseFlyout, setShowAddCourseFlyout] = useState(false);
    const { isFrozen } = useSystemFreeze();
    const [showEditFlyout, setShowEditFlyout] = useState(false);
    const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
    const [pinInput, setPinInput] = useState('');
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [showChoiceDialog, setShowChoiceDialog] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
    const [primaryStudentGroupLabel, secondaryStudentGroupLabel, tertiaryStudentGroupLabel] = useMemo(
        () => getServiceCountLabels(serviceDefinitions),
        [serviceDefinitions],
    );

    // Course records stay in one course list; each course's LMP is edited inside the course.
    const groupedCourses = useMemo(() => {
        const groups: { [key: string]: Course[] } = {};

        // Filter out archived courses
        const activeCourses = courses.filter(course => courseColors.hasOwnProperty(course.name));

        activeCourses.forEach(course => {
            const groupName = 'Courses';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(course);
        });

        return groups;
    }, [courses, courseColors]);

    const handleDownloadCourseScopeDiagnostics = () => {
        const activeContextUnits = splitCourseUnitCodes(activeUnitCode);
        const activeContextUnitSet = new Set(activeContextUnits);
        const activeCourseNames = Object.values(groupedCourses).flat().map(course => course.name);
        const visibleCourseSet = new Set(activeCourseNames);
        const traineeCourseSummaries = new Map<string, {
            totalActive: number;
            activeInContext: number;
            activeOutsideContext: number;
            units: Set<string>;
            unitsInContext: Set<string>;
            unitsOutsideContext: Set<string>;
            sampleActiveInContext: Array<{ idNumber?: number; name: string; unit: string; course: string }>;
            sampleActiveOutsideContext: Array<{ idNumber?: number; name: string; unit: string; course: string }>;
        }>();
        traineesData
            .filter((trainee: any) => trainee?.isActive !== false)
            .forEach((trainee: any) => {
                const courseName = String(trainee?.course || '').trim();
                if (!courseName) return;
                const traineeUnit = normaliseCourseScopeToken(trainee?.unit);
                const inContext = activeContextUnitSet.size === 0 || (traineeUnit && activeContextUnitSet.has(traineeUnit));
                const existing = traineeCourseSummaries.get(courseName) || {
                    totalActive: 0,
                    activeInContext: 0,
                    activeOutsideContext: 0,
                    units: new Set<string>(),
                    unitsInContext: new Set<string>(),
                    unitsOutsideContext: new Set<string>(),
                    sampleActiveInContext: [],
                    sampleActiveOutsideContext: [],
                };
                existing.totalActive += 1;
                if (traineeUnit) existing.units.add(traineeUnit);
                const sample = {
                    idNumber: trainee?.idNumber,
                    name: String(trainee?.name || trainee?.fullName || '').trim(),
                    unit: String(trainee?.unit || '').trim(),
                    course: courseName,
                };
                if (inContext) {
                    existing.activeInContext += 1;
                    if (traineeUnit) existing.unitsInContext.add(traineeUnit);
                    if (existing.sampleActiveInContext.length < 5) existing.sampleActiveInContext.push(sample);
                } else {
                    existing.activeOutsideContext += 1;
                    if (traineeUnit) existing.unitsOutsideContext.add(traineeUnit);
                    if (existing.sampleActiveOutsideContext.length < 5) existing.sampleActiveOutsideContext.push(sample);
                }
                traineeCourseSummaries.set(courseName, existing);
            });
        const platformUnits = (platformConfig?.units || []).map((unit: any) => ({
            code: String(unit?.code || '').trim(),
            name: String(unit?.name || '').trim(),
            status: String(unit?.status || 'ACTIVE').trim(),
            locationCode: String(unit?.locationCode || '').trim(),
            operationalModel: String(unit?.operationalModel || unit?.settings?.operationalModel || '').trim(),
        }));
        const courseDiagnostics = courses.map(course => {
            const courseUnits = splitCourseUnitCodes(course.unit);
            const hasCourseColor = Object.prototype.hasOwnProperty.call(courseColors, course.name);
            const unitMatchesActiveContext = courseUnits.length > 0 && activeContextUnitSet.size > 0
                ? courseUnits.some(unit => activeContextUnitSet.has(unit))
                : false;
            const traineeSummary = traineeCourseSummaries.get(course.name) || null;
            const activeTraineesInContext = traineeSummary?.activeInContext || 0;
            const hasValidStartDate = Boolean(course.startDate && !Number.isNaN(new Date(course.startDate).getTime()));
            const hasValidGradDate = Boolean(course.gradDate && !Number.isNaN(new Date(course.gradDate).getTime()));
            return {
                name: course.name,
                code: course.code || '',
                location: course.location || '',
                unit: course.unit || '',
                parsedUnits: courseUnits,
                lmpType: course.lmpType || '',
                academicLmpType: course.academicLmpType || '',
                status: course.status || '',
                hasCourseColor,
                visibleOnCoursesManagement: visibleCourseSet.has(course.name),
                unitMatchesActiveContext,
                expectedVisibleForActiveUnit: hasCourseColor && unitMatchesActiveContext,
                visibilityMismatch: visibleCourseSet.has(course.name) !== (hasCourseColor && unitMatchesActiveContext),
                dateHealth: {
                    startDate: course.startDate || '',
                    gradDate: course.gradDate || '',
                    hasValidStartDate,
                    hasValidGradDate,
                },
                traineeOwnership: traineeSummary ? {
                    totalActive: traineeSummary.totalActive,
                    activeInContext: traineeSummary.activeInContext,
                    activeOutsideContext: traineeSummary.activeOutsideContext,
                    units: Array.from(traineeSummary.units).sort(),
                    unitsInContext: Array.from(traineeSummary.unitsInContext).sort(),
                    unitsOutsideContext: Array.from(traineeSummary.unitsOutsideContext).sort(),
                    sampleActiveInContext: traineeSummary.sampleActiveInContext,
                    sampleActiveOutsideContext: traineeSummary.sampleActiveOutsideContext,
                } : {
                    totalActive: 0,
                    activeInContext: 0,
                    activeOutsideContext: 0,
                    units: [],
                    unitsInContext: [],
                    unitsOutsideContext: [],
                    sampleActiveInContext: [],
                    sampleActiveOutsideContext: [],
                },
                likelyStaleOrMisassigned: visibleCourseSet.has(course.name) && activeTraineesInContext === 0 && (!hasValidStartDate || !hasValidGradDate),
                reasonVisibleNow: visibleCourseSet.has(course.name)
                    ? 'CoursesManagementView received this course and courseColors contains its name.'
                    : 'Not visible in groupedCourses.',
            };
        });
        const payload = {
            diagnostic: 'courses-management-scope',
            version: 'CCH 8.148',
            generatedAt: new Date().toISOString(),
            activeContext: {
                activeLocationCode,
                activeUnitCode,
                parsedActiveUnitCodes: activeContextUnits,
                operationalModel,
                locations,
                units,
            },
            counts: {
                coursesProp: courses.length,
                courseColorKeys: Object.keys(courseColors).length,
                archivedCourseKeys: Object.keys(archivedCourses).length,
                visibleCoursesManagement: activeCourseNames.length,
                visibilityMismatches: courseDiagnostics.filter(course => course.visibilityMismatch).length,
                visibleCoursesWithNoActiveTraineesInContext: courseDiagnostics.filter(course => course.visibleOnCoursesManagement && course.traineeOwnership.activeInContext === 0).length,
                likelyStaleOrMisassigned: courseDiagnostics.filter(course => course.likelyStaleOrMisassigned).length,
            },
            visibleCourseNames: activeCourseNames,
            courseColorKeys: Object.keys(courseColors).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
            platformUnits,
            courses: courseDiagnostics,
        };
        const locationPart = normaliseCourseScopeToken(activeLocationCode) || 'LOCATION';
        const unitPart = (activeContextUnits.join('-') || normaliseCourseScopeToken(activeUnitCode) || 'UNIT').replace(/[^A-Z0-9-]/g, '-');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadJsonFile(`dfp-course-scope-diagnostics_${locationPart}_${unitPart}_${timestamp}.json`, payload);
    };

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
                        <span className="text-gray-400">{primaryStudentGroupLabel}: {course.raafStart}</span>
                        <span className="text-gray-400">{secondaryStudentGroupLabel}: {course.navyStart}</span>
                        <span className="text-gray-400">{tertiaryStudentGroupLabel}: {course.armyStart}</span>
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
                            onClick={handleDownloadCourseScopeDiagnostics}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                        >
                            <span className="text-center leading-tight" style={{color: "#38bdf8"}}>Diag</span>
                        </button>
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
                    serviceDefinitions={serviceDefinitions}
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
                    operationalModel={operationalModel}
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
