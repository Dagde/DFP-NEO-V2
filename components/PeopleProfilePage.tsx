import React, { useState, useMemo } from 'react';
import { Trainee } from '../types';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';

interface PeopleProfilePageProps {
    traineesData: Trainee[];
    excludedCourses: string[];
    onUpdateExcludedCourses: (courses: string[]) => void;
    onShowSuccess: (msg: string) => void;
    currentUserPermission: string;
    courseColors?: { [key: string]: string };
}

const PeopleProfilePage: React.FC<PeopleProfilePageProps> = ({
    traineesData,
    excludedCourses,
    onUpdateExcludedCourses,
    onShowSuccess,
    currentUserPermission,
    courseColors = {},
}) => {
    const [isEditUnlocked, setIsEditUnlocked] = useState(false);
    const standardActionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

    // Derive unique active courses from BOTH traineesData AND courseColors
    // This ensures newly created courses (without trainees yet) appear in the exclusion list
    const availableCourses = useMemo(() => {
        const courseSet = new Set<string>();
        // From trainee data
        traineesData.forEach(t => {
            if (t.course && t.course.trim()) {
                courseSet.add(t.course.trim());
            }
        });
        // From registered course colours (includes new courses with no trainees yet)
        Object.keys(courseColors).forEach(c => {
            if (c && c.trim()) courseSet.add(c.trim());
        });
        return Array.from(courseSet).sort();
    }, [traineesData, courseColors]);

    // Count trainees per course
    const courseTraineeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        traineesData.forEach(t => {
            if (t.course) {
                counts[t.course] = (counts[t.course] || 0) + 1;
            }
        });
        return counts;
    }, [traineesData]);

    const isReadOnly = !['Super Admin', 'Admin'].includes(currentUserPermission);

    const handleSave = () => {
        setIsEditUnlocked(false);
    };

    const unlockForEdit = async () => {
        if (isReadOnly) return;
        const password = await showDarkPrompt({
            title: 'Edit NEO Build Course Exclusions',
            message: 'Enter your password to edit NEO Build course exclusions.',
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Unlock',
            cancelText: 'Cancel',
            variant: 'warning',
        });
        if (!password) return;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', 'NEO Build Course Exclusions Locked', 'warning');
                return;
            }
            setIsEditUnlocked(true);
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
        }
    };

    const handleEditSaveClick = () => {
        if (isEditUnlocked) {
            handleSave();
            return;
        }
        void unlockForEdit();
    };

    const handleToggleCourseExclusion = (course: string) => {
        if (isReadOnly || !isEditUnlocked) return;
        const isCurrentlyExcluded = excludedCourses.includes(course);
        const newExcluded = isCurrentlyExcluded
            ? excludedCourses.filter(c => c !== course)
            : [...excludedCourses, course];
        onUpdateExcludedCourses(newExcluded);
        if (!isCurrentlyExcluded) {
            onShowSuccess(`Course "${course}" excluded from NEO Build`);
        } else {
            onShowSuccess(`Course "${course}" re-included in NEO Build`);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            {!isReadOnly && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleEditSaveClick}
                        className={standardActionButtonClass}
                    >
                        {isEditUnlocked ? 'Save' : 'Edit'}
                    </button>
                </div>
            )}

            {/* ── Exclude Courses from NEO Build ───────────────────────── */}
            <div className="bg-orange-900/20 border border-orange-600/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-orange-300 mb-1">Exclude Courses from NEO Build</p>
                <p className="text-xs text-orange-200/80 leading-relaxed">
                    Courses checked below will be excluded from NEO Build scheduling. Use this when a course is in
                    the <strong>Academics phase</strong> or is on a <strong>course pause</strong> — no trainees
                    from excluded courses will be considered when compiling the daily schedule.
                </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <h3 className="text-sm font-semibold text-white">Course Exclusions</h3>
                    {excludedCourses.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-orange-900/60 border border-orange-500/40 text-orange-300 text-xs font-semibold">
                            {excludedCourses.length} excluded
                        </span>
                    )}
                </div>

                {/* Summary banner when courses are excluded */}
                {excludedCourses.length > 0 && (
                    <div className="bg-orange-900/30 border border-orange-500/40 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-orange-200 font-medium mb-1">⚠ NEO Build will skip trainees from:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {excludedCourses.map(c => (
                                <span key={c} className="px-2 py-0.5 rounded-full bg-orange-800/60 border border-orange-500/50 text-orange-200 text-xs font-semibold">
                                    {c}
                                    {courseTraineeCounts[c] ? (
                                        <span className="ml-1 text-orange-400/70">({courseTraineeCounts[c]})</span>
                                    ) : null}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Course list with checkboxes */}
                {availableCourses.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No active courses found in trainee data.</p>
                ) : (
                    <div className="space-y-1.5">
                        <p className="text-xs text-gray-400 mb-2">
                            Check a course to exclude it from NEO Build scheduling:
                        </p>
                        {availableCourses.map(course => {
                            const isExcluded = excludedCourses.includes(course);
                            const count = courseTraineeCounts[course] || 0;
                            return (
                                <label
                                    key={course}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                        isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    } ${
                                        isExcluded
                                            ? 'bg-orange-900/25 border-orange-500/50 hover:bg-orange-900/35'
                                            : 'bg-gray-700/40 border-gray-600/40 hover:bg-gray-700/60'
                                    }`}
                                >
                                        <input
                                        type="checkbox"
                                        checked={isExcluded}
                                        onChange={() => handleToggleCourseExclusion(course)}
                                        disabled={isReadOnly || !isEditUnlocked}
                                        className="w-4 h-4 rounded accent-orange-500 flex-shrink-0"
                                    />
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className={`text-sm font-medium ${isExcluded ? 'text-orange-300' : 'text-gray-200'}`}>
                                            {course}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {count} {count === 1 ? 'trainee' : 'trainees'}
                                        </span>
                                    </div>
                                    {isExcluded && (
                                        <span className="flex-shrink-0 text-xs text-orange-400 font-medium flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                            Excluded
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                )}

                {isReadOnly && (
                    <p className="text-xs text-yellow-400/70">Read-only mode — Super Admin or Admin access required to change exclusions.</p>
                )}

                {!isReadOnly && availableCourses.length > 0 && isEditUnlocked && (
                    <p className="text-xs text-gray-500 mt-1">
                        Changes take effect immediately — no Save required.
                    </p>
                )}
            </div>
        </div>
    );
};

export default PeopleProfilePage;
