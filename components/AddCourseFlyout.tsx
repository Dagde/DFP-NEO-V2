import React, { useState, useMemo } from 'react';
import type { PlatformConfig } from '../utils/platformConfigService';
import { showDarkAlert } from './DarkMessageModal';

export interface NewCourseData {
    number: string;
    color: string;
    startDate: string;
    gradDate: string;
    raafStart: number;
    navyStart: number;
    armyStart: number;
    location: string;
    unit: string;
}

interface AddCourseFlyoutProps {
  onClose: () => void;
  onSave: (data: NewCourseData) => void;
  existingCourses: { [key: string]: string };
  locations: string[];
  units: string[];
  activeLocationCode?: string;
  activeUnitCode?: string;
  platformConfig?: PlatformConfig | null;
  serviceDefinitions?: Array<{ longName?: string; shortName?: string }>;
}

const ALL_COLORS = [
    'bg-sky-400/80',      // Light Blue
    'bg-purple-400/80',   // Purple
    'bg-yellow-400/80',   // Yellow
    'bg-pink-400/80',     // Pink
    'bg-teal-400/80',     // Teal
    'bg-indigo-400/80',   // Indigo
    'bg-cyan-400/80',     // Cyan
    'bg-fuchsia-400/80',  // Fuchsia
    'bg-blue-400/80',     // Blue
];

const Dropdown: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; id: string }> = ({ label, value, onChange, children, id }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-400">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        >
            {children}
        </select>
    </div>
);

const normaliseContextValue = (value: unknown): string => String(value || '').trim().toLowerCase();

const resolveActiveLocationOption = (
    locationOptions: string[],
    activeLocationCode?: string,
    platformConfig?: PlatformConfig | null,
): string => {
    const active = String(activeLocationCode || '').trim();
    if (!active) return locationOptions[0] || '';

    const candidates = new Set<string>([active]);
    const activeKey = normaliseContextValue(active);

    const platformLocation = (platformConfig?.locations || []).find(loc => {
        const values = [loc.code, loc.iataCode, loc.name];
        return values.some(value => normaliseContextValue(value) === activeKey);
    });
    if (platformLocation) {
        [platformLocation.name, platformLocation.code, platformLocation.iataCode].forEach(value => {
            if (value) candidates.add(String(value));
        });
    }

    const candidateKeys = new Set(Array.from(candidates).map(normaliseContextValue));
    return locationOptions.find(option => candidateKeys.has(normaliseContextValue(option))) || active || locationOptions[0] || '';
};

const buildUnitOptions = (unitOptions: string[], activeUnitCode?: string): string[] => {
    const active = String(activeUnitCode || '').trim();
    const deduped = Array.from(new Set(unitOptions.filter(Boolean)));
    if (active && !deduped.some(unit => normaliseContextValue(unit) === normaliseContextValue(active))) {
        return [active, ...deduped];
    }
    return deduped;
};

const resolveActiveUnitOption = (unitOptions: string[], activeUnitCode?: string): string => {
    const active = String(activeUnitCode || '').trim();
    if (!active) return unitOptions[0] || '';
    return unitOptions.find(unit => normaliseContextValue(unit) === normaliseContextValue(active)) || active || unitOptions[0] || '';
};

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

const AddCourseFlyout: React.FC<AddCourseFlyoutProps> = ({
    onClose,
    onSave,
    existingCourses,
    locations = [],
    units = [],
    activeLocationCode = '',
    activeUnitCode = '',
    platformConfig = null,
    serviceDefinitions = [],
}) => {
    const locationOptions = useMemo(() => Array.from(new Set(locations.filter(Boolean))), [locations]);
    const unitOptions = useMemo(() => buildUnitOptions(units, activeUnitCode), [units, activeUnitCode]);
    const defaultLocation = useMemo(
        () => resolveActiveLocationOption(locationOptions, activeLocationCode, platformConfig),
        [locationOptions, activeLocationCode, platformConfig],
    );
    const defaultUnit = useMemo(
        () => resolveActiveUnitOption(unitOptions, activeUnitCode),
        [unitOptions, activeUnitCode],
    );
    const [courseName, setCourseName] = useState('');
    
    const [startDate, setStartDate] = useState('');
    const [gradDate, setGradDate] = useState('');
    const [raafStart, setRaafStart] = useState(0);
    const [navyStart, setNavyStart] = useState(0);
    const [armyStart, setArmyStart] = useState(0);
    const [location, setLocation] = useState(defaultLocation);
    const [unit, setUnit] = useState(defaultUnit);
    const [primaryStudentGroupLabel, secondaryStudentGroupLabel, tertiaryStudentGroupLabel] = useMemo(
        () => getServiceCountLabels(serviceDefinitions),
        [serviceDefinitions],
    );

    const availableColor = useMemo(() => {
        const usedColors = new Set(Object.values(existingCourses));
        return ALL_COLORS.find(c => !usedColors.has(c)) || 'bg-gray-400/80';
    }, [existingCourses]);

    const totalStart = useMemo(() => raafStart + navyStart + armyStart, [raafStart, navyStart, armyStart]);

    const studentNumberOptions = useMemo(() => Array.from({ length: 41 }, (_, i) => i), []);

    const handleSave = async () => {
        const finalCourseName = courseName.trim();
        if (!finalCourseName) {
            await showDarkAlert('Please enter a course name.', 'Add Course', 'warning');
            return;
        }

        if (Object.keys(existingCourses).includes(finalCourseName)) {
            await showDarkAlert(`Course "${finalCourseName}" already exists.`, 'Add Course', 'warning');
            return;
        }

        if (!startDate || !gradDate) {
            await showDarkAlert('Please fill in all required date fields.', 'Add Course', 'warning');
            return;
        }
        if (new Date(gradDate) <= new Date(startDate)) {
            await showDarkAlert('Graduation date must be after the start date.', 'Add Course', 'warning');
            return;
        }
        onSave({
            number: finalCourseName,
            color: availableColor,
            startDate,
            gradDate,
            raafStart,
            navyStart,
            armyStart,
            location: location || defaultLocation,
            unit: unit || defaultUnit,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-sky-400">Add New Course</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label htmlFor="course-name" className="block text-sm font-medium text-gray-400">Course Name</label>
                        <input
                            type="text"
                            id="course-name"
                            value={courseName}
                            onChange={e => setCourseName(e.target.value)}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            placeholder="Enter the course or cohort name"
                            autoFocus
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400">Allocated Colour</label>
                        <div className="mt-1 flex items-center space-x-2 p-2 bg-gray-700/50 rounded-md h-[38px]">
                            <div className={`w-5 h-5 rounded-full ${availableColor}`}></div>
                            <span className="text-white font-mono text-sm">{availableColor}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="start-date" className="block text-sm font-medium text-gray-400">Start Date</label>
                           <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                        </div>
                        <div>
                           <label htmlFor="grad-date" className="block text-sm font-medium text-gray-400">Graduation Date</label>
                           <input type="date" id="grad-date" value={gradDate} onChange={e => setGradDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="course-location" className="block text-sm font-medium text-gray-400">Location <span className="text-red-400">*</span></label>
                            {locationOptions.length > 0 ? (
                                <select
                                    id="course-location"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                >
                                    <option value="">— Select Location —</option>
                                    {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    id="course-location"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    placeholder="Enter location code or name"
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                />
                            )}
                        </div>
                        <div>
                            <label htmlFor="course-unit" className="block text-sm font-medium text-gray-400">Unit <span className="text-red-400">*</span></label>
                            {unitOptions.length > 0 ? (
                                <select
                                    id="course-unit"
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                >
                                    <option value="">— Select Unit —</option>
                                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    id="course-unit"
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                    placeholder="Enter unit code"
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                />
                            )}
                        </div>
                    </div>
                    
                    <fieldset className="p-4 border border-gray-600 rounded-lg">
                        <legend className="px-2 text-sm font-semibold text-gray-300">Initial Student Numbers</legend>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                             <Dropdown label={primaryStudentGroupLabel} id="raaf-start" value={raafStart} onChange={e => setRaafStart(parseInt(e.target.value))}>
                                {studentNumberOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </Dropdown>
                             <Dropdown label={secondaryStudentGroupLabel} id="navy-start" value={navyStart} onChange={e => setNavyStart(parseInt(e.target.value))}>
                                {studentNumberOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </Dropdown>
                             <Dropdown label={tertiaryStudentGroupLabel} id="army-start" value={armyStart} onChange={e => setArmyStart(parseInt(e.target.value))}>
                                {studentNumberOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </Dropdown>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Total</label>
                                <div className="mt-1 p-2 bg-gray-700/50 rounded-md text-white h-[38px] flex items-center justify-center font-semibold">{totalStart}</div>
                            </div>
                        </div>
                    </fieldset>

                    <div>
                        <label className="block text-sm font-medium text-gray-400">Total Remaining on Course</label>
                        <p className="mt-1 p-2 bg-gray-700/50 rounded-md text-white h-[38px] flex items-center font-semibold">{totalStart}</p>
                        <p className="mt-1 text-xs text-gray-500">This will be updated from Trainee profiles once they are assigned to this course.</p>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed">Save Course</button>
                    <button onClick={onClose} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default AddCourseFlyout;
