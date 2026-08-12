import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useMemo, useState, useEffect } from 'react';
import { Course, Instructor, Trainee } from '../types';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { formatPersonOptionLabel } from '../utils/personIdentity';

interface CourseEditFlyoutProps {
    courseName: string;
    courseUnit: string;
    trainees: Trainee[];
    availableCourses: string[];
    availableUnits: string[];
    onClose: () => void;
    onUpdateCourseNumber: (oldCourseNumber: string, newCourseNumber: string) => void;
    onUpdateCourseUnit: (courseNumber: string, newUnit: string) => void;
    onUpdateCourseLeadership?: (courseNumber: string, leadership: { courseCommander: string; deputyCourseCommander: string }) => void | Promise<void>;
    onDeleteTrainee: (trainee: Trainee) => void;
    onBackcourseTrainee: (trainee: Trainee, newCourse: string) => void;
    courseColors: { [key: string]: string };
    course?: Course;
    instructorsData?: Instructor[];
    personnelDisplaySettings?: PersonnelDisplaySettings;
}

const CourseEditFlyout: React.FC<CourseEditFlyoutProps> = ({
    courseName,
    courseUnit,
    trainees,
    availableCourses,
    availableUnits,
    onClose,
    onUpdateCourseNumber,
    onUpdateCourseUnit,
    onUpdateCourseLeadership,
    onDeleteTrainee,
    onBackcourseTrainee,
    courseColors,
    course,
    instructorsData = [],
    personnelDisplaySettings
}) => {
    const [newCourseNumber, setNewCourseNumber] = useState(courseName);
    const { isFrozen } = useSystemFreeze();
    const [newUnit, setNewUnit] = useState(courseUnit);
    const [courseCommander, setCourseCommander] = useState(course?.courseCommander || '');
    const [deputyCourseCommander, setDeputyCourseCommander] = useState(course?.deputyCourseCommander || '');

    // Log on mount and when key props change
    useEffect(() => {
    }, [courseName, courseUnit]);

    // Sync props to state when they change (e.g., after a save operation)
    useEffect(() => {
        setNewCourseNumber(courseName);
        setNewUnit(courseUnit);
        setCourseCommander(course?.courseCommander || '');
        setDeputyCourseCommander(course?.deputyCourseCommander || '');
    }, [courseName, courseUnit, course?.courseCommander, course?.deputyCourseCommander]);
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [targetCourse, setTargetCourse] = useState<string>('');
    const [showBackcourseConfirm, setShowBackcourseConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const courseLeadershipEnabled = personnelDisplaySettings?.courseLeadershipEnabled !== false;
    const courseCommanderLabel = personnelDisplaySettings?.courseCommanderLabel?.trim() || 'Cse Commander';
    const deputyCourseCommanderLabel = personnelDisplaySettings?.deputyCourseCommanderLabel?.trim() || 'Deputy Cse Commander';

    const sortedStaff = useMemo(() => {
        return [...instructorsData]
            .filter((staff) => String(staff?.name || '').trim())
            .sort((a, b) => {
                const unitCompare = String(a.unit || '').localeCompare(String(b.unit || ''), undefined, { numeric: true, sensitivity: 'base' });
                if (unitCompare !== 0) return unitCompare;
                return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
            });
    }, [instructorsData, personnelDisplaySettings]);
    const staffByUnit = useMemo(() => {
        const groups = new Map<string, Instructor[]>();
        sortedStaff.forEach((staff) => {
            const unit = String(staff.unit || '').trim() || 'No unit assigned';
            groups.set(unit, [...(groups.get(unit) || []), staff]);
        });
        return Array.from(groups.entries());
    }, [sortedStaff]);

    const leadershipChanged =
        courseCommander !== (course?.courseCommander || '') ||
        deputyCourseCommander !== (course?.deputyCourseCommander || '');

    const updateHasChanges = (nextCourseNumber = newCourseNumber, nextUnit = newUnit, nextCommander = courseCommander, nextDeputy = deputyCourseCommander) => {
        setHasChanges(
            nextCourseNumber !== courseName ||
            nextUnit !== courseUnit ||
            nextCommander !== (course?.courseCommander || '') ||
            nextDeputy !== (course?.deputyCourseCommander || '')
        );
    };

    const handleCourseNumberChange = (value: string) => {
        setNewCourseNumber(value);
        updateHasChanges(value, newUnit, courseCommander, deputyCourseCommander);
    };

    const handleUnitChange = (value: string) => {
        setNewUnit(value);
        updateHasChanges(newCourseNumber, value, courseCommander, deputyCourseCommander);
    };

    const handleCourseCommanderChange = (value: string) => {
        setCourseCommander(value);
        updateHasChanges(newCourseNumber, newUnit, value, deputyCourseCommander);
    };

    const handleDeputyCourseCommanderChange = (value: string) => {
        setDeputyCourseCommander(value);
        updateHasChanges(newCourseNumber, newUnit, courseCommander, value);
    };

    const handleSaveCourseDetails = async () => {
        try {
            if (newCourseNumber !== courseName) {
                await Promise.resolve(onUpdateCourseNumber(courseName, newCourseNumber));
            }
            if (newUnit !== courseUnit) {
                await Promise.resolve(onUpdateCourseUnit(courseName, newUnit));
            }
            if (leadershipChanged && onUpdateCourseLeadership) {
                await onUpdateCourseLeadership(courseName, { courseCommander, deputyCourseCommander });
            }
            setHasChanges(false);
            onClose();
        } catch (error) {
            console.error('[CourseEditFlyout] Failed to save course details:', error);
            setHasChanges(true);
        }
    };

    const handleBackcourseClick = (trainee: Trainee) => {
        setSelectedTrainee(trainee);
        setTargetCourse('');
        setShowBackcourseConfirm(true);
    };

    const handleDeleteClick = (trainee: Trainee) => {
        setSelectedTrainee(trainee);
        setShowDeleteConfirm(true);
    };

    const confirmBackcourse = () => {
        if (selectedTrainee && targetCourse) {
            onBackcourseTrainee(selectedTrainee, targetCourse);
            setShowBackcourseConfirm(false);
            setSelectedTrainee(null);
            setTargetCourse('');
        }
    };

    const confirmDelete = () => {
        if (selectedTrainee) {
            onDeleteTrainee(selectedTrainee);
            setShowDeleteConfirm(false);
            setSelectedTrainee(null);
        }
    };

    const courseColorRaw = courseColors[courseName] || 'bg-gray-500';
    const isHexCourseColor = courseColorRaw.startsWith('#') || courseColorRaw.startsWith('rgb');
    const courseColor = isHexCourseColor ? '' : courseColorRaw;
    const courseColorStyle = isHexCourseColor ? { backgroundColor: courseColorRaw } : {};

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pt-8" onClick={onClose}>
            <div 
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-gray-600"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`${courseColor} px-6 py-4 flex justify-between items-center`} style={courseColorStyle}>
                    <h2 className="text-xl font-bold text-white">Edit Course: {courseName}</h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {/* Course Details Section */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Course Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Course Number</label>
                                <input
                                    type="text"
                                    value={newCourseNumber}
                                    onChange={(e) => handleCourseNumberChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="e.g., CPC-25-01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
                                <select
                                    value={newUnit}
                                    onChange={(e) => handleUnitChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    {availableUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {courseLeadershipEnabled && (
                            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/70 p-4">
                                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-100">Course Leadership</h4>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">{courseCommanderLabel}</label>
                                        <select
                                            value={courseCommander}
                                            onChange={(e) => handleCourseCommanderChange(e.target.value)}
                                            disabled={isFrozen}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                                        >
                                            <option value="">Not assigned</option>
                                            {staffByUnit.map(([unit, staffMembers]) => (
                                                <optgroup key={`${unit}-commander-group`} label={unit}>
                                                    {staffMembers.map((staff) => (
                                                        <option key={`${staff.id || staff.idNumber || staff.name}-commander`} value={staff.name}>
                                                            {formatPersonOptionLabel(staff)}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">{deputyCourseCommanderLabel}</label>
                                        <select
                                            value={deputyCourseCommander}
                                            onChange={(e) => handleDeputyCourseCommanderChange(e.target.value)}
                                            disabled={isFrozen}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                                        >
                                            <option value="">Not assigned</option>
                                            {staffByUnit.map(([unit, staffMembers]) => (
                                                <optgroup key={`${unit}-deputy-group`} label={unit}>
                                                    {staffMembers.map((staff) => (
                                                        <option key={`${staff.id || staff.idNumber || staff.name}-deputy`} value={staff.name}>
                                                            {formatPersonOptionLabel(staff)}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        {hasChanges && (
                            <button
                                onClick={handleSaveCourseDetails}
                                className="mt-4 w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
                            >
                                Save
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <hr className="border-gray-700 mb-6" />

                    {/* Trainee Management Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Trainee Management</h3>
                        
                        {trainees.length === 0 ? (
                            <p className="text-gray-500 italic text-center py-4">No trainees in this course</p>
                        ) : (
                            <div className="space-y-2">
                                {trainees.map(trainee => (
                                    <div 
                                        key={trainee.fullName}
                                        className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-gray-500 text-sm">{trainee.rank}</span>
                                            <span className="text-white">{trainee.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleBackcourseClick(trainee)}
                                                className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-amber-500 leading-tight"
                                                title="Move to different course"
                                            >
                                                Back<br/>Course
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(trainee)}
                                                className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
                                                title="Delete trainee"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-700/50 border-t border-gray-600 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Backcourse Confirmation Modal */}
            {showBackcourseConfirm && selectedTrainee && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60" onClick={() => setShowBackcourseConfirm(false)}>
                    <div 
                        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-amber-600/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-amber-400 mb-4">Backcourse Trainee</h3>
                        <p className="text-gray-300 mb-4">
                            Move <span className="text-white font-medium">{selectedTrainee.name}</span> to a different course:
                        </p>
                        <select
                            value={targetCourse}
                            onChange={(e) => setTargetCourse(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">Select target course...</option>
                            {availableCourses
                                .filter(c => c !== courseName)
                                .map(course => (
                                    <option key={course} value={course}>{course}</option>
                                ))}
                            <option value="__NEW__">+ Create New Course</option>
                        </select>
                        {targetCourse === '__NEW__' && (
                            <input
                                type="text"
                                placeholder="Enter new course number..."
                                onChange={(e) => setTargetCourse(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowBackcourseConfirm(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBackcourse}
                                disabled={!targetCourse || targetCourse === '__NEW__'}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                            >
                                Move Trainee
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedTrainee && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60" onClick={() => setShowDeleteConfirm(false)}>
                    <div 
                        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-red-600/50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-red-400 mb-4">Delete Trainee</h3>
                        <p className="text-gray-300 mb-4">
                            Are you sure you want to delete <span className="text-white font-medium">{selectedTrainee.name}</span>?
                        </p>
                        <p className="text-red-400/80 text-sm mb-4">
                            This action cannot be undone. All training records for this trainee will be permanently removed.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            >
                                Delete Trainee
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseEditFlyout;
