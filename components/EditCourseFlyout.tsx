import React, { useState, useEffect, useMemo } from 'react';
import { CourseLmpPauseEntry, SyllabusItemDetail, Trainee } from '../types';
import {
    filterMasterLmpCodesForAccess,
    type OperationalModelCode,
    type PlatformConfig,
} from '../utils/platformConfigService';
import { showDarkAlert } from './DarkMessageModal';

const normaliseLmpCode = (value: unknown): string => String(value || '').trim();

const uniqueSortedValues = (values: string[]): string[] => {
    const seen = new Set<string>();
    return values
        .map(normaliseLmpCode)
        .filter((value) => {
            if (!value) return false;
            const key = value.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => a.localeCompare(b));
};

const getCourseLmpPauseKey = (courseName: string, lmpType: string): string => (
    `${String(courseName || '').trim().toUpperCase()}::${String(lmpType || '').trim().toUpperCase()}`
);

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
    operationalModel?: OperationalModelCode | string;
    trainees?: Trainee[];
    courseLmpPauses?: Record<string, CourseLmpPauseEntry>;
    onClose: () => void;
    onSave: (data: {
        startDate: string;
        gradDate: string;
        location: string;
        unit: string;
        lmpType: string;
        academicLmpType: string;
    }) => void;
    onUpdateCourseLmpPause?: (entry: CourseLmpPauseEntry) => void;
}

const EditCourseFlyout: React.FC<EditCourseFlyoutProps> = ({
    courseName,
    startDate: initialStartDate,
    gradDate: initialGradDate,
    location: initialLocation = '',
    unit: initialUnit = '',
    lmpType: initialLmpType = '',
    academicLmpType: initialAcademicLmpType = '',
    locations = [],
    units = [],
    syllabusDetails = [],
    platformConfig = null,
    operationalModel = 'flight_school',
    trainees = [],
    courseLmpPauses = {},
    onClose,
    onSave,
    onUpdateCourseLmpPause,
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [gradDate, setGradDate] = useState(initialGradDate);
    const [location, setLocation] = useState(initialLocation);
    const [unit, setUnit] = useState(initialUnit);
    const [lmpType, setLmpType] = useState(initialLmpType || '');
    const [academicLmpType, setAcademicLmpType] = useState(initialAcademicLmpType || '');
    const [pauseDraftLmp, setPauseDraftLmp] = useState<string | null>(null);
    const [pauseDraftSelection, setPauseDraftSelection] = useState<Set<string>>(new Set());

    const activeMasterLmpCatalogue = useMemo(() => (
        (platformConfig?.masterLmpCatalogue || [])
            .filter((entry: any) => String(entry?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
    ), [platformConfig]);

    const lmpDescriptionByCode = useMemo(() => (
        activeMasterLmpCatalogue.reduce((map: Record<string, string>, entry: any) => {
            const code = normaliseLmpCode(entry?.code || entry?.name);
            if (!code) return map;
            map[code] = normaliseLmpCode(entry?.description || entry?.name || entry?.code);
            return map;
        }, {})
    ), [activeMasterLmpCatalogue]);

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
            operationalModel,
        }, 'Assign');
        return uniqueSortedValues([academicLmpType, ...allowed]);
    }, [academicLmpType, operationalModel, platformConfig, syllabusDetails, unit]);

    const assignableMasterLmps = useMemo(() => {
        const courseCodes = new Set<string>();
        activeMasterLmpCatalogue.forEach((entry: any) => {
            const code = normaliseLmpCode(entry?.code || entry?.name);
            if (code) courseCodes.add(code);
        });
        syllabusDetails.forEach(s => {
            if (s.type === 'Academics' || s.lmpType === 'Staff CAT') return;
            (s.courses || []).forEach(c => courseCodes.add(c));
        });
        const allowed = filterMasterLmpCodesForAccess(platformConfig, Array.from(courseCodes), {
            unitCode: unit,
            operationalModel,
        }, 'Assign');
        return uniqueSortedValues([lmpType, initialLmpType, ...allowed]);
    }, [activeMasterLmpCatalogue, initialLmpType, lmpType, operationalModel, platformConfig, syllabusDetails, unit]);

    // Sync if props change
    useEffect(() => {
        setStartDate(initialStartDate);
        setGradDate(initialGradDate);
        setLocation(initialLocation || '');
        setUnit(initialUnit || '');
        setLmpType(initialLmpType || '');
        setAcademicLmpType(initialAcademicLmpType || '');
    }, [initialStartDate, initialGradDate, initialLocation, initialUnit, initialLmpType, initialAcademicLmpType]);

    const handleSave = async () => {
        if (!startDate || !gradDate) {
            await showDarkAlert('Please fill in both Start Date and Graduation Date.', 'Edit Course', 'warning');
            return;
        }
        onSave({ startDate, gradDate, location, unit, lmpType, academicLmpType });
        onClose();
    };

    const enrolledLmpOptions = useMemo(() => (
        uniqueSortedValues([lmpType, academicLmpType])
    ), [academicLmpType, lmpType]);

    const sortedCourseMembers = useMemo(() => (
        [...trainees]
            .filter(trainee => String(trainee.course || '').trim().toUpperCase() === String(courseName || '').trim().toUpperCase())
            .sort((a, b) => String(a.fullName || a.name).localeCompare(String(b.fullName || b.name), undefined, { sensitivity: 'base' }))
    ), [courseName, trainees]);

    const openPauseManager = (selectedLmpType: string) => {
        const pauseKey = getCourseLmpPauseKey(courseName, selectedLmpType);
        const existing = courseLmpPauses[pauseKey];
        const defaultNames = existing
            ? existing.traineeNames || []
            : sortedCourseMembers.map(trainee => trainee.fullName || trainee.name).filter(Boolean);
        setPauseDraftLmp(selectedLmpType);
        setPauseDraftSelection(new Set(defaultNames));
    };

    const togglePauseDraftTrainee = (traineeName: string) => {
        setPauseDraftSelection(prev => {
            const next = new Set(prev);
            if (next.has(traineeName)) {
                next.delete(traineeName);
            } else {
                next.add(traineeName);
            }
            return next;
        });
    };

    const confirmPauseDraft = () => {
        if (!pauseDraftLmp || !onUpdateCourseLmpPause) return;
        onUpdateCourseLmpPause({
            courseName,
            lmpType: pauseDraftLmp,
            traineeNames: Array.from(pauseDraftSelection),
            pausedAt: new Date().toISOString(),
        });
        setPauseDraftLmp(null);
        setPauseDraftSelection(new Set());
    };

    const fieldClass = "w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm";
    const labelClass = "block text-sm font-medium text-gray-400 mb-1";

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center overflow-y-auto pt-[92px] pb-8 animate-fade-in"
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

                <div className="p-6 space-y-5 max-h-[calc(100vh-250px)] overflow-y-auto">

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
                                    placeholder="Enter location code or name"
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
                                    placeholder="Enter unit code"
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
                            <option value="">— Select Master LMP —</option>
                            {assignableMasterLmps.map(lmp => (
                                <option key={lmp} value={lmp}>{lmp}</option>
                            ))}
                        </select>
                        {lmpType && lmpDescriptionByCode[lmpType] && (
                            <p className="mt-1 text-xs text-sky-400/70 italic">{lmpDescriptionByCode[lmpType]}</p>
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
                            <p className="mt-1 text-xs text-sky-400/70 italic">Academic lessons from the "{academicLmpType}" LMP will appear in each trainee's Academic LMP tab.</p>
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

                    <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-4">
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Course LMP Pause</h3>
                            <p className="mt-1 text-xs text-gray-400">
                                Pause selected course members for one enrolled LMP without pausing their other LMPs.
                            </p>
                        </div>
                        {enrolledLmpOptions.length === 0 ? (
                            <p className="text-xs text-gray-500">Assign a Course / LMP Type or Academic LMP Type before pausing course members.</p>
                        ) : (
                            <div className="space-y-2">
                                {enrolledLmpOptions.map((option) => {
                                    const pauseKey = getCourseLmpPauseKey(courseName, option);
                                    const pausedCount = courseLmpPauses[pauseKey]?.traineeNames?.length || 0;
                                    return (
                                        <div key={option} className="flex items-center justify-between gap-3 rounded-md border border-gray-700 bg-gray-900/60 p-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{option}</p>
                                                <p className="text-xs text-gray-400">{pausedCount} of {sortedCourseMembers.length} course member{sortedCourseMembers.length === 1 ? '' : 's'} paused</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => openPauseManager(option)}
                                                className="px-3 py-2 text-xs font-semibold rounded-md bg-amber-600 text-black hover:bg-amber-500 transition-colors"
                                            >
                                                Pause
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
            {pauseDraftLmp && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70" onClick={() => setPauseDraftLmp(null)}>
                    <div className="w-full max-w-lg rounded-lg border border-amber-600/60 bg-gray-800 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="border-b border-gray-700 bg-gray-900/80 p-4">
                            <h3 className="text-lg font-bold text-amber-300">Pause Course Members</h3>
                            <p className="mt-1 text-sm text-gray-400">{courseName} — {pauseDraftLmp}</p>
                        </div>
                        <div className="max-h-[52vh] overflow-y-auto p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-wide text-gray-400">{pauseDraftSelection.size} selected</p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPauseDraftSelection(new Set(sortedCourseMembers.map(trainee => trainee.fullName || trainee.name).filter(Boolean)))}
                                        className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
                                    >
                                        Select all
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPauseDraftSelection(new Set())}
                                        className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
                                    >
                                        Deselect all
                                    </button>
                                </div>
                            </div>
                            {sortedCourseMembers.length === 0 ? (
                                <p className="rounded-md border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">No members are currently assigned to this course.</p>
                            ) : (
                                <div className="space-y-2">
                                    {sortedCourseMembers.map((trainee) => {
                                        const traineeName = trainee.fullName || trainee.name;
                                        return (
                                            <label key={`${trainee.idNumber}-${traineeName}`} className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-700 bg-gray-900/60 p-3 hover:border-amber-500/60">
                                                <input
                                                    type="checkbox"
                                                    checked={pauseDraftSelection.has(traineeName)}
                                                    onChange={() => togglePauseDraftTrainee(traineeName)}
                                                    className="h-4 w-4 accent-amber-500"
                                                />
                                                <span className="font-mono text-xs text-gray-500">{trainee.rank}</span>
                                                <span className="text-sm font-medium text-white">{trainee.name || trainee.fullName}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 border-t border-gray-700 bg-gray-800/80 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setPauseDraftLmp(null)}
                                className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmPauseDraft}
                                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500"
                            >
                                Confirm Pause
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditCourseFlyout;
