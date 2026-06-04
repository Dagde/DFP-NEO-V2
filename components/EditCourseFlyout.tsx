import React, { useState, useEffect, useMemo } from 'react';
import { SyllabusItemDetail } from '../types';
import {
    filterMasterLmpCodesForAccess,
    type PlatformConfig,
} from '../utils/platformConfigService';

const COURSE_MASTER_LMPS = [
    'BPC+IPC',
    'PC-21 Ground School',
    'FIC',
    'OFI',
    'WSO',
    'FIC(I)',
    'PLT CONV',
    'QFI CONV',
    'PLT Refresh',
    'Staff CAT',
];

// Academic LMP types — these are 'Academics' type syllabus courses (Ground School phase)
// Academic LMP courses are derived dynamically from syllabusDetails (DB only)

const LMP_DESCRIPTIONS: Record<string, string> = {
    'BPC+IPC': 'Basic Pilot Course & Initial Pilot Course',
    'PC-21 Ground School': 'PC-21 Ground School (academic phase)',
    'FIC': 'Flight Instructor Course (FIC syllabus)',
    'OFI': 'Operational Flying Instructor',
    'WSO': 'Weapons Systems Officer',
    'FIC(I)': 'Flight Instructor Course (International)',
    'PLT CONV': 'Pilot Conversion course',
    'QFI CONV': 'Qualified Flying Instructor Conversion',
    'PLT Refresh': 'Pilot Refresher course',
    'Staff CAT': 'Staff Category (Instructor LMP)',
};

interface EditCourseFlyoutProps {
    courseName: string;
    startDate: string;
    gradDate: string;
    location?: string;
    unit?: string;
    lmpType?: string;
    academicLmpType?: string;
    locations: string[];
    units: string[];
    syllabusDetails?: SyllabusItemDetail[];
    platformConfig?: PlatformConfig | null;
    onClose: () => void;
    onSave: (data: {
        startDate: string;
        gradDate: string;
        location: string;
        unit: string;
        lmpType: string;
        academicLmpType: string;
    }) => void;
}

const EditCourseFlyout: React.FC<EditCourseFlyoutProps> = ({
    courseName,
    startDate: initialStartDate,
    gradDate: initialGradDate,
    location: initialLocation = '',
    unit: initialUnit = '',
    lmpType: initialLmpType = 'BPC+IPC',
    academicLmpType: initialAcademicLmpType = '',
    locations = [],
    units = [],
    syllabusDetails = [],
    platformConfig = null,
    onClose,
    onSave,
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [gradDate, setGradDate] = useState(initialGradDate);
    const [location, setLocation] = useState(initialLocation);
    const [unit, setUnit] = useState(initialUnit);
    const [lmpType, setLmpType] = useState(initialLmpType || 'BPC+IPC');
    const [academicLmpType, setAcademicLmpType] = useState(initialAcademicLmpType || '');

    // Dynamic Academic LMP courses: extract unique course codes from Academics-type syllabus items (DB only)
    const academicLmpCourses = useMemo(() => {
        const courseCodes = new Set<string>();
        syllabusDetails.forEach(s => {
            if (s.type === 'Academics' && s.courses) {
                s.courses.forEach(c => courseCodes.add(c));
            }
        });
        const allowed = filterMasterLmpCodesForAccess(platformConfig, Array.from(courseCodes), {
            unitCode: unit,
            operationalModel: 'flight_school',
        }, 'Assign');
        return allowed.sort();
    }, [platformConfig, syllabusDetails, unit]);

    const assignableMasterLmps = useMemo(() => {
        const courseCodes = new Set<string>(COURSE_MASTER_LMPS.filter(lmp => lmp !== 'Staff CAT'));
        syllabusDetails.forEach(s => {
            if (s.type === 'Academics' || s.lmpType === 'Staff CAT') return;
            (s.courses || []).forEach(c => courseCodes.add(c));
        });
        const allowed = filterMasterLmpCodesForAccess(platformConfig, Array.from(courseCodes), {
            unitCode: unit,
            operationalModel: 'flight_school',
        }, 'Assign');
        return allowed.sort();
    }, [platformConfig, syllabusDetails, unit]);

    // Sync if props change
    useEffect(() => {
        setStartDate(initialStartDate);
        setGradDate(initialGradDate);
        setLocation(initialLocation || '');
        setUnit(initialUnit || '');
        setLmpType(initialLmpType || 'BPC+IPC');
        setAcademicLmpType(initialAcademicLmpType || '');
    }, [initialStartDate, initialGradDate, initialLocation, initialUnit, initialLmpType, initialAcademicLmpType]);

    const handleSave = () => {
        if (!startDate || !gradDate) {
            alert('Please fill in both Start Date and Graduation Date.');
            return;
        }
        onSave({ startDate, gradDate, location, unit, lmpType, academicLmpType });
        onClose();
    };

    const fieldClass = "w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm";
    const labelClass = "block text-sm font-medium text-gray-400 mb-1";

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-sky-400">Edit Course</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Modify course details, dates, and LMP type</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                    {/* Course Name (read-only) */}
                    <div>
                        <label className={labelClass}>Course</label>
                        <div className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-md text-white font-semibold text-sm tracking-wide">
                            {courseName}
                        </div>
                    </div>

                    {/* Location + Unit */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-location" className={labelClass}>
                                Location
                            </label>
                            {locations.length > 0 ? (
                                <select
                                    id="edit-location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className={fieldClass}
                                >
                                    <option value="">— Select Location —</option>
                                    {locations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    id="edit-location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g., East Sale"
                                    className={fieldClass}
                                />
                            )}
                        </div>
                        <div>
                            <label htmlFor="edit-unit" className={labelClass}>
                                Unit
                            </label>
                            {units.length > 0 ? (
                                <select
                                    id="edit-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className={fieldClass}
                                >
                                    <option value="">— Select Unit —</option>
                                    {units.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    id="edit-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="e.g., 1FTS"
                                    className={fieldClass}
                                />
                            )}
                        </div>
                    </div>

                    {/* LMP Type */}
                    <div>
                        <label htmlFor="edit-lmp-type" className={labelClass}>
                            Course / LMP Type
                            <span className="ml-1 text-xs text-gray-500 font-normal">— determines which syllabus events populate each trainee's Individual LMP</span>
                        </label>
                        <select
                            id="edit-lmp-type"
                            value={lmpType}
                            onChange={(e) => setLmpType(e.target.value)}
                            className={fieldClass}
                        >
                            {assignableMasterLmps.map(lmp => (
                                <option key={lmp} value={lmp}>{lmp}</option>
                            ))}
                        </select>
                        {lmpType && LMP_DESCRIPTIONS[lmpType] && (
                            <p className="mt-1 text-xs text-sky-400/70 italic">{LMP_DESCRIPTIONS[lmpType]}</p>
                        )}
                    </div>

                    {/* Academic LMP Type */}
                    <div>
                        <label htmlFor="edit-academic-lmp-type" className={labelClass}>
                            Academic LMP Type
                            <span className="ml-1 text-xs text-gray-500 font-normal">— determines which <strong>Academics</strong> lessons appear in the Academic LMP tab</span>
                        </label>
                        <select
                            id="edit-academic-lmp-type"
                            value={academicLmpType}
                            onChange={(e) => setAcademicLmpType(e.target.value)}
                            className={fieldClass}
                        >
                            <option value="">— None (Academic LMP tab hidden) —</option>
                            {academicLmpCourses.map(lmp => (
                                <option key={lmp} value={lmp}>{lmp}</option>
                            ))}
                        </select>
                        {academicLmpType && (
                            <p className="mt-1 text-xs text-sky-400/70 italic">Academic lessons from the "{academicLmpType}" course in the Syllabus will appear in each trainee's Academic LMP tab.</p>
                        )}
                    </div>

                    {/* Start Date + Grad Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-start-date" className={labelClass}>
                                Start Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                id="edit-start-date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className={fieldClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-grad-date" className={labelClass}>
                                Graduation Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                id="edit-grad-date"
                                value={gradDate}
                                onChange={(e) => setGradDate(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className={fieldClass}
                            />
                        </div>
                    </div>

                    {/* Info note */}
                    <div className="p-3 bg-sky-900/20 border border-sky-700/30 rounded-md">
                        <p className="text-xs text-sky-300/80 leading-relaxed">
                            <span className="font-semibold text-sky-300">Note:</span> Changing the LMP Type will update the syllabus events available for all trainees in this course. Location and Unit are used for filtering trainees in schedule views.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditCourseFlyout;
