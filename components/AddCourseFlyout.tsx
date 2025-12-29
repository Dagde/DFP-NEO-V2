import React, { useState, useMemo, useEffect } from 'react';

export interface NewCourseData {
    number: string; // This is now the full course name, e.g., "CSE 290" or "FIC 210"
    color: string;
    startDate: string;
    gradDate: string;
    raafStart: number;
    navyStart: number;
    armyStart: number;
}

interface AddCourseFlyoutProps {
  onClose: () => void;
  onSave: (data: NewCourseData) => void;
  existingCourses: { [key: string]: string };
}

const ALL_COLORS = [
    'bg-sky-400/50',      // Light Blue
    'bg-purple-400/50',   // Purple
    'bg-yellow-400/50',   // Yellow
    'bg-pink-400/50',     // Pink
    'bg-teal-400/50',     // Teal
    'bg-indigo-400/50',   // Indigo
    'bg-cyan-400/50',     // Cyan
    'bg-fuchsia-400/50',  // Fuchsia
    'bg-blue-400/50',     // Blue
];

const courseTypes = ['CSE', 'FIC', 'WSO', 'IFIC', 'OFI', 'Pilot Conversion'];

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

const AddCourseFlyout: React.FC<AddCourseFlyoutProps> = ({ onClose, onSave, existingCourses }) => {
    const [courseType, setCourseType] = useState('CSE');
    const [cseCourseNumber, setCseCourseNumber] = useState('');
    const [manualCourseNumber, setManualCourseNumber] = useState('');
    
    const [startDate, setStartDate] = useState('');
    const [gradDate, setGradDate] = useState('');
    const [raafStart, setRaafStart] = useState(0);
    const [navyStart, setNavyStart] = useState(0);
    const [armyStart, setArmyStart] = useState(0);

    const availableColor = useMemo(() => {
        const usedColors = new Set(Object.values(existingCourses));
        return ALL_COLORS.find(c => !usedColors.has(c)) || 'bg-gray-400/50';
    }, [existingCourses]);

    const totalStart = useMemo(() => raafStart + navyStart + armyStart, [raafStart, navyStart, armyStart]);

    const cseCourseNumberOptions = useMemo(() => {
        const options = [];
        const existingCseNumbers = Object.keys(existingCourses)
            .filter(name => name.startsWith('CSE '))
            .map(name => name.replace('CSE ', ''));
            
        for (let i = 290; i <= 500; i++) {
            if (!existingCseNumbers.includes(String(i))) {
                options.push(i);
            }
        }
        return options;
    }, [existingCourses]);

    const studentNumberOptions = useMemo(() => Array.from({ length: 41 }, (_, i) => i), []);
    
    useEffect(() => {
        if (courseType === 'CSE' && cseCourseNumberOptions.length > 0) {
            setCseCourseNumber(String(cseCourseNumberOptions[0]));
        } else {
            setCseCourseNumber('');
        }
    }, [courseType, cseCourseNumberOptions]);

    const handleSave = () => {
        let finalCourseName: string;

        if (courseType === 'CSE') {
            if (!cseCourseNumber) {
                alert('Please select a CSE course number.');
                return;
            }
            finalCourseName = `CSE ${cseCourseNumber}`;
        } else {
            const trimmedManualNumber = manualCourseNumber.trim();
            if (!trimmedManualNumber) {
                alert('Please enter a course number.');
                return;
            }
            finalCourseName = `${courseType} ${trimmedManualNumber}`;
        }

        if (Object.keys(existingCourses).includes(finalCourseName)) {
            alert(`Course "${finalCourseName}" already exists.`);
            return;
        }

        if (!startDate || !gradDate) {
            alert('Please fill in all required date fields.');
            return;
        }
        if (new Date(gradDate) <= new Date(startDate)) {
            alert('Graduation date must be after the start date.');
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
                    <div className="grid grid-cols-2 gap-4">
                        <Dropdown label="Course Type" id="course-type" value={courseType} onChange={e => setCourseType(e.target.value)}>
                           {courseTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </Dropdown>

                        {courseType === 'CSE' ? (
                             <Dropdown label="Course Number" id="course-number" value={cseCourseNumber} onChange={e => setCseCourseNumber(e.target.value)}>
                                {cseCourseNumberOptions.length > 0 ? (
                                    cseCourseNumberOptions.map(n => <option key={n} value={n}>{n}</option>)
                                ) : (
                                    <option disabled>No courses available</option>
                                )}
                            </Dropdown>
                        ) : (
                            <div>
                                <label htmlFor="manual-course-number" className="block text-sm font-medium text-gray-400">Course Number</label>
                                <input 
                                    type="text" 
                                    id="manual-course-number" 
                                    value={manualCourseNumber} 
                                    onChange={e => setManualCourseNumber(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                    placeholder="e.g., 210"
                                />
                            </div>
                        )}
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
                    
                    <fieldset className="p-4 border border-gray-600 rounded-lg">
                        <legend className="px-2 text-sm font-semibold text-gray-300">Initial Student Numbers</legend>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                             <Dropdown label="RAAF" id="raaf-start" value={raafStart} onChange={e => setRaafStart(parseInt(e.target.value))}>
                                {studentNumberOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </Dropdown>
                             <Dropdown label="Navy" id="navy-start" value={navyStart} onChange={e => setNavyStart(parseInt(e.target.value))}>
                                {studentNumberOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </Dropdown>
                             <Dropdown label="Army" id="army-start" value={armyStart} onChange={e => setArmyStart(parseInt(e.target.value))}>
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