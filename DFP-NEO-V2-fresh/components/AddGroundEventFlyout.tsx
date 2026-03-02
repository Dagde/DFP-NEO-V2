import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SyllabusItemDetail, Trainee } from '../types';
import CourseTraineeSelectionFlyout from './CourseTraineeSelectionFlyout';

interface AddGroundEventFlyoutProps {
  onClose: () => void;
  onSave: (data: any) => void;
  groundSyllabus: SyllabusItemDetail[];
  activeCourses: { [key: string]: string };
  allTraineesByCourse: { [course: string]: Trainee[] };
  instructors: string[];
  traineesData: Trainee[];
}

const AddGroundEventFlyout: React.FC<AddGroundEventFlyoutProps> = ({ 
    onClose, 
    onSave, 
    groundSyllabus, 
    activeCourses, 
    allTraineesByCourse,
    instructors,
    traineesData
}) => {
    const [flightNumber, setFlightNumber] = useState(groundSyllabus[0]?.code || '');
    const [startTime, setStartTime] = useState(8);
    const [duration, setDuration] = useState(groundSyllabus[0]?.duration || 1.0);
    const [notes, setNotes] = useState('');
    const [instructor, setInstructor] = useState('');
    
    const [selectedCourse, setSelectedCourse] = useState(Object.keys(activeCourses)[0] || '');
    const [isEntireCourse, setIsEntireCourse] = useState(false);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [selectedGround, setSelectedGround] = useState('Ground 1');

    const [showTraineeSelector, setShowTraineeSelector] = useState(false);
    const [showCourseConfirm, setShowCourseConfirm] = useState(false);
    
    const traineeSelectorRef = useRef<HTMLDivElement>(null);
    const availableTrainees = useMemo(() => traineesData.filter(t => !t.isPaused).map(t => t.fullName), [traineesData]);

    const isCptEvent = useMemo(() => flightNumber.includes('CPT'), [flightNumber]);
    const [selectedCpt, setSelectedCpt] = useState('CPT 1');

    useEffect(() => {
        const selectedSyllabus = groundSyllabus.find(s => s.code === flightNumber);
        if (selectedSyllabus) {
            setDuration(selectedSyllabus.duration);
        }
    }, [flightNumber, groundSyllabus]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (traineeSelectorRef.current && !traineeSelectorRef.current.contains(event.target as Node)) {
                setShowTraineeSelector(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSave = () => {
        if (!flightNumber || !instructor) {
            alert('Please select an event and an instructor.');
            return;
        }

        let selectionType: 'course' | 'multiple' | 'single' = 'single';
        let attendees: string[] = [];

        if (isEntireCourse) {
            selectionType = 'course';
            attendees = selectedTrainees;
        } else {
            if (selectedTrainees.length > 1) {
                selectionType = 'multiple';
            }
            attendees = selectedTrainees;
        }
        
        if (attendees.length === 0) {
            alert('Please select at least one trainee or an entire course.');
            return;
        }

        const location = isCptEvent ? `${selectedCpt}: ${notes}`.trim() : notes;

        onSave({
            flightNumber,
            startTime,
            duration,
            location, // Using the notes field as location for CPTs
            instructor,
            selectionType,
            course: isEntireCourse ? selectedCourse : undefined,
            attendees,
            resourceId: isCptEvent ? selectedCpt : selectedGround,
        });
    };

    const handleTraineeCheckboxChange = (traineeFullName: string) => {
        setSelectedTrainees(prev => 
            prev.includes(traineeFullName)
                ? prev.filter(t => t !== traineeFullName)
                : [...prev, traineeFullName]
        );
    };

    const handleEntireCourseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsEntireCourse(checked);
        setSelectedTrainees([]);
        if (checked && selectedCourse) {
            setShowCourseConfirm(true);
        }
    };
    
    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const totalHours = h + m / 60;
                const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                options.push({ label, value: totalHours });
            }
        }
        return options;
    }, []);
    
    const durationOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => (i + 1) * 0.25), []);

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-xl border border-gray-700" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <h2 className="text-xl font-bold text-teal-400">Add Ground Event</h2>
                        <button onClick={onClose} className="text-white hover:text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>

                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="ground-event" className="block text-sm font-medium text-gray-400">Event</label>
                                <select id="ground-event" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                    {groundSyllabus.map(s => <option key={s.code} value={s.code}>{s.code} - {s.eventDescription}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="ground-instructor" className="block text-sm font-medium text-gray-400">Instructor</label>
                                <select id="ground-instructor" value={instructor} onChange={e => setInstructor(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                    <option value="" disabled>Select an instructor</option>
                                    {instructors.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        </div>

                        <fieldset className="p-4 border border-gray-600 rounded-lg">
                            <legend className="px-2 text-sm font-semibold text-gray-300">Attendees</legend>
                            <div className="mt-2 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div>
                                        <label htmlFor="ground-course" className="block text-sm font-medium text-gray-400">Course</label>
                                        <select id="ground-course" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                            {Object.keys(activeCourses).map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center space-x-3 pt-6">
                                        <input type="checkbox" id="entire-course" checked={isEntireCourse} onChange={handleEntireCourseChange} className="h-5 w-5 bg-gray-700 rounded accent-sky-500" />
                                        <label htmlFor="entire-course" className="font-semibold text-sky-400">Select Entire Course</label>
                                    </div>
                                </div>
                                {!isEntireCourse && (
                                    <div className="relative" ref={traineeSelectorRef}>
                                        <label className="block text-sm font-medium text-gray-400">Trainees</label>
                                        <button onClick={() => setShowTraineeSelector(!showTraineeSelector)} className="mt-1 w-full text-left bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500">
                                            {selectedTrainees.length > 0 ? `${selectedTrainees.length} selected` : 'Select trainees...'}
                                        </button>
                                        {showTraineeSelector && (
                                            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                <ul className="p-2 space-y-1">
                                                    {availableTrainees.map(t => (
                                                        <li key={t}>
                                                            <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700">
                                                                <input type="checkbox" checked={selectedTrainees.includes(t)} onChange={() => handleTraineeCheckboxChange(t)} className="h-4 w-4 accent-sky-500 bg-gray-600" />
                                                                <span className="text-sm text-gray-300">{t}</span>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </fieldset>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="ground-start" className="block text-sm font-medium text-gray-400">Start Time</label>
                                <select id="ground-start" value={startTime} onChange={e => setStartTime(parseFloat(e.target.value))} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="ground-duration" className="block text-sm font-medium text-gray-400">Duration (hrs)</label>
                                <select id="ground-duration" value={duration} onChange={e => setDuration(parseFloat(e.target.value))} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                    {durationOptions.map(d => <option key={d} value={d}>{d.toFixed(2)}</option>)}
                                </select>
                            </div>
                        </div>

                        {isCptEvent ? (
                            <div>
                                <label htmlFor="cpt-resource" className="block text-sm font-medium text-gray-400">CPT Resource</label>
                                <select 
                                    id="cpt-resource" 
                                    value={selectedCpt} 
                                    onChange={e => setSelectedCpt(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                                >
                                    {Array.from({ length: 4 }, (_, i) => `CPT ${i + 1}`).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="ground-resource" className="block text-sm font-medium text-gray-400">Ground Resource</label>
                                <select
                                    id="ground-resource"
                                    value={selectedGround}
                                    onChange={e => setSelectedGround(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                                >
                                    {Array.from({ length: 6 }, (_, i) => `Ground ${i + 1}`).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label htmlFor="ground-location" className="block text-sm font-medium text-gray-400">{isCptEvent ? 'Notes' : 'Location'}</label>
                            <input 
                                type="text" 
                                id="ground-location" 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm" 
                                placeholder={isCptEvent ? 'Add any relevant notes...' : 'Enter a location...'}
                            />
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                        <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700">Save Event</button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                    </div>
                </div>
            </div>
            {showCourseConfirm && (
                <CourseTraineeSelectionFlyout
                    onClose={() => {
                        setShowCourseConfirm(false);
                        setIsEntireCourse(false); // uncheck the box if they cancel
                    }}
                    onConfirm={(confirmedTrainees) => {
                        setSelectedTrainees(confirmedTrainees);
                        setShowCourseConfirm(false);
                    }}
                    courseNumber={selectedCourse}
                    traineesInCourse={allTraineesByCourse[selectedCourse] || []}
                    traineeStatus={traineesData.reduce((acc, t) => acc.set(t.fullName, { isPaused: t.isPaused }), new Map())}
                />
            )}
        </>
    );
};

export default AddGroundEventFlyout;