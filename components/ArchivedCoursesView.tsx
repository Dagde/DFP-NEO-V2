import React, { useMemo, useState } from 'react';
import { Course } from '../types';
import { showDarkConfirm } from './DarkMessageModal';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';

interface ArchivedCoursesViewProps {
    archivedCourses: { [key: string]: string };
    courses: Course[];
    serviceDefinitions?: Array<{ longName?: string; shortName?: string }>;
    onUnarchiveCourse: (courseName: string) => void;
    onDeleteCourse: (courseName: string) => void;
    onNavigateBack: () => void;
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

const darkenHexColor = (color: string) => {
    if (!color.startsWith('#') || color.length < 7) return color;
    const strength = 0.62;
    const r = Math.round(parseInt(color.slice(1, 3), 16) * strength);
    const g = Math.round(parseInt(color.slice(3, 5), 16) * strength);
    const b = Math.round(parseInt(color.slice(5, 7), 16) * strength);
    return `rgb(${r}, ${g}, ${b})`;
};

const formatCourseDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

const ArchivedCoursesView: React.FC<ArchivedCoursesViewProps> = ({
    archivedCourses,
    courses,
    serviceDefinitions = [],
    onUnarchiveCourse,
    onDeleteCourse,
    onNavigateBack
}) => {
    const [coursePendingPermanentDelete, setCoursePendingPermanentDelete] = useState<string | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deletePasswordError, setDeletePasswordError] = useState('');
    const [isVerifyingDeletePassword, setIsVerifyingDeletePassword] = useState(false);
    const archivedCourseNames = useMemo(
        () => Object.keys(archivedCourses).sort((a, b) => a.localeCompare(b)),
        [archivedCourses]
    );
    const [primaryStudentGroupLabel, secondaryStudentGroupLabel, tertiaryStudentGroupLabel] = useMemo(
        () => getServiceCountLabels(serviceDefinitions),
        [serviceDefinitions],
    );
    const courseRecordsByName = useMemo(() => {
        const records = new Map<string, Course>();
        courses.forEach((course) => {
            const name = String(course?.name || '').trim();
            const code = String(course?.code || '').trim();
            if (name) records.set(name, course);
            if (code) records.set(code, course);
        });
        return records;
    }, [courses]);

    const handleUnarchive = async (courseName: string) => {
        const confirmed = await showDarkConfirm(
            'Unarchive Course',
            `Are you sure you want to unarchive "${courseName}"? This will make it active again.`,
            'info',
            'Unarchive',
            'Cancel'
        );

        if (confirmed) {
            onUnarchiveCourse(courseName);
        }
    };

    const handleDelete = (courseName: string) => {
        setCoursePendingPermanentDelete(courseName);
        setDeletePassword('');
        setDeletePasswordError('');
    };

    const handleCancelPassword = () => {
        setCoursePendingPermanentDelete(null);
        setDeletePassword('');
        setDeletePasswordError('');
        setIsVerifyingDeletePassword(false);
    };

    const handleConfirmPermanentDelete = async () => {
        if (!coursePendingPermanentDelete) return;
        if (!deletePassword.trim()) {
            setDeletePasswordError('Enter your current password to continue.');
            return;
        }
        setIsVerifyingDeletePassword(true);
        setDeletePasswordError('');
        try {
            const passwordAccepted = await verifyCurrentUserPassword(deletePassword);
            if (!passwordAccepted) {
                setDeletePasswordError('The password was not accepted. Enter the password for the account you are currently logged in with.');
                return;
            }
            const confirmed = await showDarkConfirm(
                'Final Permanent Delete Warning',
                `Deleting "${coursePendingPermanentDelete}" may be contrary to legal, regulatory, training-records, or audit-retention requirements.\n\nOnly continue if permanent deletion is required, keeping it archived is not sufficient, and this action has been approved.`,
                'warning',
                'Delete Permanently',
                'Cancel'
            );
            if (!confirmed) {
                handleCancelPassword();
                return;
            }
            onDeleteCourse(coursePendingPermanentDelete);
            handleCancelPassword();
        } catch (error) {
            console.error('Archived course delete password verification failed:', error);
            setDeletePasswordError('The app could not verify your password. Check your connection and try again.');
        } finally {
            setIsVerifyingDeletePassword(false);
        }
    };

    const ArchivedCourseCard: React.FC<{ courseName: string; color: string }> = ({ courseName, color }) => {
        const course = courseRecordsByName.get(courseName);
        const displayCourse: Course = course || {
            name: courseName,
            color,
            startDate: '',
            gradDate: '',
            raafStart: 0,
            navyStart: 0,
            armyStart: 0,
            status: 'ARCHIVED',
        };
        const courseColor = displayCourse.color || color || '';
        const primaryCount = displayCourse.raafStart ?? 0;
        const secondaryCount = displayCourse.navyStart ?? 0;
        const tertiaryCount = displayCourse.armyStart ?? 0;
        const totalStudents = primaryCount + secondaryCount + tertiaryCount;

        return (
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div
                            data-course-color="true"
                            className={`w-4 h-4 rounded ${(courseColor || '').startsWith('#') ? '' : (courseColor || 'bg-gray-400/50')}`}
                            style={(courseColor || '').startsWith('#') ? { backgroundColor: darkenHexColor(courseColor) } : {}}
                        ></div>
                        <h3 className="text-lg font-semibold text-gray-300">
                            {displayCourse.name}
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleUnarchive(courseName)}
                            className="text-sky-400 hover:text-sky-300 transition-colors p-1"
                            title="Unarchive Course"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleDelete(courseName)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Delete Permanently"
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
                        <span>{formatCourseDate(displayCourse.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Grad Date:</span>
                        <span>{formatCourseDate(displayCourse.gradDate)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Total Students:</span>
                        <span className="font-semibold">{totalStudents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">{primaryStudentGroupLabel}: {primaryCount}</span>
                        <span className="text-gray-400">{secondaryStudentGroupLabel}: {secondaryCount}</span>
                        <span className="text-gray-400">{tertiaryStudentGroupLabel}: {tertiaryCount}</span>
                    </div>
                    <div className="pt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-300">
                            Archived
                        </span>
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
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onNavigateBack}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Archived Courses</h2>
                            <p className="text-sm text-gray-400">Manage archived courses</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400">
                        {Object.keys(archivedCourses).length} archived course{Object.keys(archivedCourses).length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {Object.keys(archivedCourses).length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-gray-400 text-lg mb-4">No archived courses</p>
                        <button
                            onClick={onNavigateBack}
                            className="px-6 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
                        >
                            Back to Courses Management
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {archivedCourseNames.map(courseName => (
                            <ArchivedCourseCard
                                key={courseName}
                                courseName={courseName}
                                color={archivedCourses[courseName]}
                            />
                        ))}
                    </div>
                )}
            </div>
            {coursePendingPermanentDelete && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <form
                        className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-red-600/60"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!isVerifyingDeletePassword) void handleConfirmPermanentDelete();
                        }}
                    >
                        <h3 className="text-xl font-semibold text-red-300 mb-4">Confirm Permanent Delete</h3>
                        <p className="text-gray-300 mb-4">
                            Enter your current password to continue. A final permanent-delete warning will appear before <span className="font-semibold text-sky-400">{coursePendingPermanentDelete}</span> is removed.
                        </p>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(event) => {
                                setDeletePassword(event.target.value);
                                if (deletePasswordError) setDeletePasswordError('');
                            }}
                            placeholder="Current password"
                            className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 ${deletePasswordError ? 'border-red-500' : 'border-gray-600'}`}
                            autoFocus
                        />
                        {deletePasswordError && (
                            <p className="mt-2 mb-4 text-sm text-red-300">{deletePasswordError}</p>
                        )}
                        <div className={`${deletePasswordError ? '' : 'mt-5'} flex flex-wrap gap-3 justify-end`}>
                            <button
                                type="button"
                                onClick={handleCancelPassword}
                                className="min-w-[88px] px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                                disabled={isVerifyingDeletePassword}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="min-w-[136px] px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                disabled={isVerifyingDeletePassword}
                            >
                                {isVerifyingDeletePassword ? 'Checking...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ArchivedCoursesView;
