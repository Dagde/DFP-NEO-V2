import React, { useState, useMemo, useEffect } from 'react';
import { Trainee, SyllabusItemDetail } from '../types';

interface PeopleProfilePageProps {
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    locations: string[];
    neoBuildCourse: string;
    onUpdateNeoBuildCourse: (course: string) => void;
    onShowSuccess: (msg: string) => void;
    currentUserPermission: string;
}

const PeopleProfilePage: React.FC<PeopleProfilePageProps> = ({
    traineesData,
    syllabusDetails,
    locations,
    neoBuildCourse,
    onUpdateNeoBuildCourse,
    onShowSuccess,
    currentUserPermission,
}) => {
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [pendingCourse, setPendingCourse] = useState<string>(neoBuildCourse);

    // Sync pendingCourse when neoBuildCourse changes externally
    useEffect(() => {
        setPendingCourse(neoBuildCourse);
    }, [neoBuildCourse]);

    // Derive unique courses from traineesData, filtered by selected location
    const availableCourses = useMemo(() => {
        let trainees = traineesData;
        if (selectedLocation) {
            trainees = trainees.filter(t => {
                if (t.location) return t.location === selectedLocation;
                // Fallback: derive from unit (1FTS/CFS = East Sale, 2FTS = Pearce)
                if (t.unit) {
                    if (t.unit.startsWith('2FTS')) return selectedLocation === 'Pearce';
                    if (t.unit.startsWith('1FTS') || t.unit.startsWith('CFS')) return selectedLocation === 'East Sale';
                }
                return true; // include if location unknown
            });
        }
        const courseSet = new Set<string>();
        trainees.forEach(t => { if (t.course) courseSet.add(t.course); });
        return Array.from(courseSet).sort();
    }, [traineesData, selectedLocation]);

    const isReadOnly = !['Super Admin', 'Admin'].includes(currentUserPermission);

    const handleSave = () => {
        if (!pendingCourse) return;
        onUpdateNeoBuildCourse(pendingCourse);
        onShowSuccess(`NEO Build basis course set to "${pendingCourse}"`);
    };

    const hasChanges = pendingCourse !== neoBuildCourse;

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Info banner */}
            <div className="bg-sky-900/30 border border-sky-600/40 rounded-xl p-4 flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-sky-300 mb-1">NEO Build — Basis Course</p>
                    <p className="text-xs text-sky-200/80 leading-relaxed">
                        The NEO Build algorithm constructs a Daily Flying Programme based on the Individual LMP of each trainee in the selected course.
                        Only <strong>one course</strong> can be designated as the basis course at any time.
                        Once saved, only the events from that course's LMP will appear in each trainee's Individual LMP.
                    </p>
                    <p className="text-xs text-amber-300/90 mt-2 leading-relaxed">
                        <strong>Note:</strong> PC-21 Ground School (PGS) events are academic LMP events and are
                        <em> not</em> included in Individual LMPs. Only BPC+IPC (Basic Pilot Course + Initial Pilot Course)
                        flight and sim events are tracked per trainee.
                    </p>
                </div>
            </div>

            {/* Current setting */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-white">NEO Build Basis Course Selection</h3>
                </div>

                {neoBuildCourse ? (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Currently active:</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-900/50 border border-sky-500/40 text-sky-300 font-semibold text-xs">
                            {neoBuildCourse}
                        </span>
                    </div>
                ) : (
                    <div className="text-sm text-amber-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        No basis course selected. NEO Build will use all active courses.
                    </div>
                )}

                {/* Location filter */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            Filter by Location
                            <span className="ml-1 text-gray-600 font-normal">(optional)</span>
                        </label>
                        <select
                            value={selectedLocation}
                            onChange={e => {
                                setSelectedLocation(e.target.value);
                                setPendingCourse(''); // reset selection when location changes
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                            disabled={isReadOnly}
                        >
                            <option value="">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            NEO Build Basis Course
                            <span className="ml-1 text-red-400">*</span>
                        </label>
                        <select
                            value={pendingCourse}
                            onChange={e => setPendingCourse(e.target.value)}
                            className="w-full bg-gray-700 border border-sky-600/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                            disabled={isReadOnly}
                        >
                            <option value="">— Select one course —</option>
                            {availableCourses.map(course => (
                                <option key={course} value={course}>{course}</option>
                            ))}
                        </select>
                        {availableCourses.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {selectedLocation ? `No courses found at ${selectedLocation}` : 'No courses available'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Only-one-course notice */}
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-300/80 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>
                            <strong>Only one course</strong> can be selected as the NEO Build basis at a time.
                            Selecting a new course will replace the previous selection.
                            The selected course determines which trainees and events are included in the NEO Build algorithm.
                        </span>
                    </p>
                </div>

                {/* Save button */}
                {!isReadOnly && (
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={!pendingCourse || !hasChanges}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                                pendingCourse && hasChanges
                                    ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Save NEO Build Course
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

            {/* Explanation of how this affects Individual LMP */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    How This Affects the Individual LMP
                </h3>
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                    <p>
                        The <strong className="text-gray-200">Individual LMP</strong> tracks each trainee's progress through their flight training syllabus.
                        It is built from the <strong className="text-gray-200">BPC+IPC Master LMP</strong> — the standard course covering Basic Pilot Course
                        and Initial Pilot Course flight and simulator events.
                    </p>
                    <p>
                        <strong className="text-gray-200">PC-21 Ground School (PGS)</strong> events are academic/theory lessons that belong to the
                        Ground School LMP and are tracked separately via the Ground Event schedule —
                        they are <strong className="text-teal-300">not</strong> included in the Individual LMP.
                    </p>
                    <p>
                        Selecting a course here ensures the NEO Build algorithm only schedules events
                        for trainees in that specific course, using their Individual LMP completion status
                        to determine which events come next.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PeopleProfilePage;