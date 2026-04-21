import React, { useState, useMemo } from 'react';
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

    // Derive unique Master LMP types from syllabus (BPC+IPC, FIC, etc.)
    // These are the valid options for Individual LMP generation
    const availableLmpTypes = useMemo(() => {
        const lmpTypeSet = new Set<string>();
        syllabusDetails.forEach(item => {
            // Collect all lmpType values from syllabus items
            if (item.lmpType && item.lmpType !== 'Staff CAT') {
                lmpTypeSet.add(item.lmpType);
            }
            // Default BPC+IPC is implied for items without lmpType
            if (!item.lmpType && item.type !== 'Academics') {
                lmpTypeSet.add('BPC+IPC');
            }
        });
        // Also add FIC if courses include FIC
        const hasFicCourses = syllabusDetails.some(item => 
            item.courses && item.courses.some(c => c.includes('FIC'))
        );
        if (hasFicCourses) {
            lmpTypeSet.add('FIC');
        }
        return Array.from(lmpTypeSet).sort();
    }, [syllabusDetails]);

    const isReadOnly = !['Super Admin', 'Admin'].includes(currentUserPermission);

    const handleSave = () => {
        if (!pendingCourse) return;
        onUpdateNeoBuildCourse(pendingCourse);
        onShowSuccess(`Master LMP basis for Individual LMP generation set to "${pendingCourse}"`);
    };

    const hasChanges = pendingCourse !== neoBuildCourse;

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Info banner */}
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

            {/* Current setting */}
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

                {/* Dropdown */}
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

                {/* Only-one-course notice */}
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

                {/* Save button */}
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
        </div>
    );
};

export default PeopleProfilePage;