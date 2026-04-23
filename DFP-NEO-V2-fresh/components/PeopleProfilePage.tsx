import React, { useState, useMemo } from 'react';
import { Trainee, SyllabusItemDetail } from '../types';

interface PeopleProfilePageProps {
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    locations: string[];
    neoBuildCourse: string;
    onUpdateNeoBuildCourse: (course: string) => void;
    excludedCourses: string[];
    onUpdateExcludedCourses: (courses: string[]) => void;
    onShowSuccess: (msg: string) => void;
    currentUserPermission: string;
    courseColors?: { [key: string]: string };
}

const PeopleProfilePage: React.FC<PeopleProfilePageProps> = ({
    traineesData,
    syllabusDetails,
    locations,
    neoBuildCourse,
    onUpdateNeoBuildCourse,
    excludedCourses,
    onUpdateExcludedCourses,
    onShowSuccess,
    currentUserPermission,
    courseColors = {},
}) => {
    const [pendingCourse, setPendingCourse] = useState<string>(neoBuildCourse);

    // Derive unique Master LMP types from syllabus (BPC+IPC, FIC, etc.)
    const availableLmpTypes = useMemo(() => {
        const lmpTypeSet = new Set<string>();
        syllabusDetails.forEach(item => {
            if (item.lmpType && item.lmpType !== 'Staff CAT') {
                lmpTypeSet.add(item.lmpType);
            }
            if (!item.lmpType && item.type !== 'Academics') {
                lmpTypeSet.add('BPC+IPC');
            }
        });
        const hasFicCourses = syllabusDetails.some(item =>
            item.courses && item.courses.some(c => c.includes('FIC'))
        );
        if (hasFicCourses) {
            lmpTypeSet.add('FIC');
        }
        return Array.from(lmpTypeSet).sort();
    }, [syllabusDetails]);

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
        if (!pendingCourse) return;
        onUpdateNeoBuildCourse(pendingCourse);
        onShowSuccess(`Master LMP basis for Individual LMP generation set to "${pendingCourse}"`);
    };

    const hasChanges = pendingCourse !== neoBuildCourse;

    const handleToggleCourseExclusion = (course: string) => {
        if (isReadOnly) return;
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
            {/* ── Master LMP Section ───────────────────────────────────── */}
            <div className="bg-teal-900/30 border border-teal-600/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-teal-300 mb-1">Master LMP Selection</p>
                <p className="text-xs text-teal-200/80 leading-relaxed">
                    Select which Master LMP will be used by NEO Build to generate Individual LMPs for trainees.
                    This determines which flight and simulator events trainees are assigned.
                </p>
                <p className="text-xs text-amber-300/90 mt-2">
                    <strong>Note:</strong> Only one Master LMP can be selected. This setting is rarely changed.
                </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-white">Master LMP for Individual LMP Generation</h3>
                </div>

                {neoBuildCourse ? (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Currently active:</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-900/50 border border-teal-500/40 text-teal-300 font-semibold text-xs">
                            {neoBuildCourse}
                        </span>
                    </div>
                ) : (
                    <div className="text-sm text-amber-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        No Master LMP selected. NEO Build will use default BPC+IPC LMP.
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Master LMP
                        <span className="ml-1 text-red-400">*</span>
                    </label>
                    <select
                        value={pendingCourse}
                        onChange={e => setPendingCourse(e.target.value)}
                        className="w-full bg-gray-700 border border-teal-600/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                        disabled={isReadOnly}
                    >
                        <option value="">— Select one Master LMP —</option>
                        {availableLmpTypes.map(lmpType => (
                            <option key={lmpType} value={lmpType}>{lmpType}</option>
                        ))}
                    </select>
                    {availableLmpTypes.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No Master LMP options available</p>
                    )}
                </div>

                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-300/80 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>
                            <strong>Only one Master LMP</strong> can be selected at a time.
                            This Master LMP will be used by NEO Build to create Individual LMPs for all trainees.
                        </span>
                    </p>
                </div>

                {!isReadOnly && (
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={!pendingCourse || !hasChanges}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                                pendingCourse && hasChanges
                                    ? 'bg-teal-600 hover:bg-teal-500 text-white cursor-pointer'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Save Master LMP Selection
                        </button>
                        {hasChanges && pendingCourse && (
                            <span className="text-xs text-amber-300">
                                Unsaved — will change to: <strong>{pendingCourse}</strong>
                            </span>
                        )}
                        {!hasChanges && neoBuildCourse && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Saved
                            </span>
                        )}
                    </div>
                )}
                {isReadOnly && (
                    <p className="text-xs text-yellow-400/70">Read-only mode — Super Admin or Admin access required to change this setting.</p>
                )}
            </div>

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
                                        disabled={isReadOnly}
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

                {!isReadOnly && availableCourses.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                        Changes take effect immediately — no Save required.
                    </p>
                )}
            </div>
        </div>
    );
};

export default PeopleProfilePage;