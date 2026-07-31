import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SyllabusItemDetail, Trainee, Score, ScheduleEvent } from '../types';
import CourseTraineeSelectionFlyout from './CourseTraineeSelectionFlyout';
import AcademicsTab, { AcademicSaveData } from './AcademicsTab';
import { isFixedCrewLikeOperationalModel, normaliseOperationalModel } from '../utils/platformConfigService';
import {
  DEFAULT_RESOURCE_DISPLAY_NAMES,
  ResourceDisplayNames,
  formatResourceLabel as formatConfiguredResourceLabel,
} from '../utils/resourceDisplayNames';
import { showDarkAlert } from './DarkMessageModal';

interface AddGroundEventFlyoutProps {
  onClose: () => void;
  onSave: (data: any) => void;
  onSaveAcademic?: (data: AcademicSaveData) => void;
  groundSyllabus: SyllabusItemDetail[];
  activeCourses: { [key: string]: string };
  allTraineesByCourse: { [course: string]: Trainee[] };
  instructors: string[];
  traineesData: Trainee[];
  // Extra props for Academics tab
  syllabusDetails?: SyllabusItemDetail[];
  scores?: Map<string, Score[]>;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  events?: ScheduleEvent[];
  date?: string;
  courseColors?: { [key: string]: string };
  school?: 'ESL' | 'PEA';
  currentLocationName?: string;
  locationAbbreviations?: Record<string, string>; // long name -> short code
  courseAcademicProgress?: Map<string, Set<string>>;
  onUpdateCourseAcademicProgress?: (courseCode: string, lessonCode: string, completed: boolean) => void;
  persistedAcademicLmp?: string;
  onUpdatePersistedAcademicLmp?: (lmp: string) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  operationalModel?: unknown;
  groundResources?: string[];
  cptResources?: string[];
  instructorLabel?: string;
}

type TabKey = 'ground' | 'academics';

const AddGroundEventFlyout: React.FC<AddGroundEventFlyoutProps> = ({
    onClose,
    onSave,
    onSaveAcademic,
    groundSyllabus,
    activeCourses,
    allTraineesByCourse,
    instructors,
    traineesData,
    syllabusDetails,
    scores,
    traineeLMPs,
    events,
    date,
    courseColors,
    school,
    currentLocationName,
    locationAbbreviations,
    courseAcademicProgress,
    onUpdateCourseAcademicProgress,
    persistedAcademicLmp,
    onUpdatePersistedAcademicLmp,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    operationalModel,
    groundResources = [],
    cptResources = [],
    instructorLabel = 'Instructor',
}) => {
    const [activeTab, setActiveTab] = useState<TabKey>('ground');
    const crewLabel = useMemo(() => {
        const model = normaliseOperationalModel(operationalModel);
        return model === 'air_combat' || isFixedCrewLikeOperationalModel(model) ? 'Crew' : 'Trainees';
    }, [operationalModel]);

    // ── Ground Event state ──
    const [flightNumber, setFlightNumber] = useState(groundSyllabus[0]?.code || '');
    const [startTime, setStartTime] = useState(8);
    const [duration, setDuration] = useState(groundSyllabus[0]?.duration || 1.0);
    const [notes, setNotes] = useState('');
    const [instructor, setInstructor] = useState('');

    const [selectedCourse, setSelectedCourse] = useState(Object.keys(activeCourses)[0] || '');
    const [isEntireCourse, setIsEntireCourse] = useState(false);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const groundResourceOptions = useMemo(() => (
        groundResources.length > 0 ? groundResources : Array.from({ length: 6 }, (_, i) => `Ground ${i + 1}`)
    ), [groundResources]);
    const cptResourceOptions = useMemo(() => (
        cptResources.length > 0 ? cptResources : Array.from({ length: 4 }, (_, i) => `CPT ${i + 1}`)
    ), [cptResources]);
    const [selectedGround, setSelectedGround] = useState(groundResourceOptions[0] || 'Ground 1');

    const [showTraineeSelector, setShowTraineeSelector] = useState(false);
    const [showCourseConfirm, setShowCourseConfirm] = useState(false);

    const traineeSelectorRef = useRef<HTMLDivElement>(null);
    const availableTrainees = useMemo(() => traineesData.filter(t => !t.isPaused).map(t => t.fullName), [traineesData]);
    const activeCourseNames = useMemo(() => Object.keys(activeCourses), [activeCourses]);

    const isCptEvent = useMemo(() => flightNumber.includes('CPT'), [flightNumber]);
    const [selectedCpt, setSelectedCpt] = useState(cptResourceOptions[0] || 'CPT 1');
    const cptLabel = resourceDisplayNames.cpt;

    useEffect(() => {
        const selectedSyllabus = groundSyllabus.find(s => s.code === flightNumber);
        if (selectedSyllabus) setDuration(selectedSyllabus.duration);
    }, [flightNumber, groundSyllabus]);

    useEffect(() => {
        if (activeCourseNames.length === 0) {
            if (selectedCourse) setSelectedCourse('');
            return;
        }
        if (!activeCourseNames.includes(selectedCourse)) {
            setSelectedCourse(activeCourseNames[0]);
        }
    }, [activeCourseNames, selectedCourse]);

    useEffect(() => {
        if (groundResourceOptions.length > 0 && !groundResourceOptions.includes(selectedGround)) {
            setSelectedGround(groundResourceOptions[0]);
        }
    }, [groundResourceOptions, selectedGround]);

    useEffect(() => {
        if (cptResourceOptions.length > 0 && !cptResourceOptions.includes(selectedCpt)) {
            setSelectedCpt(cptResourceOptions[0]);
        }
    }, [cptResourceOptions, selectedCpt]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (traineeSelectorRef.current && !traineeSelectorRef.current.contains(event.target as Node)) {
                setShowTraineeSelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveGround = async () => {
        if (!flightNumber || !instructor) {
            await showDarkAlert('Please select an event and an instructor.', 'Add Ground Event', 'warning');
            return;
        }
        let selectionType: 'course' | 'multiple' | 'single' = 'single';
        let attendees: string[] = [];
        if (isEntireCourse) {
            selectionType = 'course';
            attendees = selectedTrainees;
        } else {
            if (selectedTrainees.length > 1) selectionType = 'multiple';
            attendees = selectedTrainees;
        }
        if (attendees.length === 0) {
            await showDarkAlert('Please select at least one trainee or an entire course.', 'Add Ground Event', 'warning');
            return;
        }
        const location = isCptEvent ? `${selectedCpt}: ${notes}`.trim() : notes;
        onSave({
            flightNumber,
            startTime,
            duration,
            location,
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
        if (checked && selectedCourse) setShowCourseConfirm(true);
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

    // ── Tab styles ──
    // Tab style matching TraineeView tabs — rounded-top pill tabs
    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '8px 20px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        borderRadius: '8px 8px 0 0',
        border: '2px solid',
        borderBottomWidth: active ? 0 : '2px',
        borderColor: active ? '#6b7280' : '#4b5563',
        backgroundColor: active ? '#111827' : '#374151',
        color: active ? '#ffffff' : '#d1d5db',
        transition: 'all 0.2s',
        boxShadow: active ? '0 -2px 8px rgba(0,0,0,0.3)' : 'none',
        marginBottom: active ? '-1px' : 0,
        position: 'relative' as const,
        zIndex: active ? 1 : 0,
    });

    return (
        <>
            <div
                style={{
                    position: 'fixed', inset: 0, top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.70)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 24,
                    paddingBottom: 24,
                    overflowY: 'auto',
                }}
                onClick={onClose}
            >
                <div
                    style={{
                        width: activeTab === 'academics' ? '95vw' : '90vw',
                        maxWidth: activeTab === 'academics' ? 1100 : 720,
                        maxHeight: 'calc(100vh - 48px)',
                        backgroundColor: '#111827',
                        borderRadius: 12,
                        border: '1px solid #374151',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header — two rows: title/close on top, tabs below */}
                    <div style={{ flexShrink: 0, backgroundColor: '#1f2937' }}>
                        {/* Row 1: Title + Close */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 24px 12px',
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                                Add Ground Event
                            </h2>
                            <button
                                onClick={onClose}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                            >
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {/* Row 2: Tabs */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 6,
                            padding: '0 24px',
                            borderBottom: '1px solid #374151',
                        }}>
                            <button style={tabStyle(activeTab === 'ground')} onClick={() => setActiveTab('ground')}>
                                Ground Event
                            </button>
                            <button style={tabStyle(activeTab === 'academics')} onClick={() => setActiveTab('academics')}>
                                Academics
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

                        {/* ── Ground Event Tab ── */}
                        {activeTab === 'ground' && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="ground-event" className="block text-sm font-medium text-gray-400">Event</label>
                                        <select id="ground-event" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                            {groundSyllabus.map(s => <option key={s.code} value={s.code}>{s.code} - {s.eventDescription}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="ground-instructor" className="block text-sm font-medium text-gray-400">{instructorLabel}</label>
                                        <select id="ground-instructor" value={instructor} onChange={e => setInstructor(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                            <option value="" disabled>{`Select ${instructorLabel.toLowerCase()}`}</option>
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
                                                    {activeCourseNames.length === 0 && <option value="">No courses available</option>}
                                                    {activeCourseNames.map(name => <option key={name} value={name}>{name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center space-x-3 pt-6">
                                                <input type="checkbox" id="entire-course" checked={isEntireCourse} onChange={handleEntireCourseChange} className="h-5 w-5 bg-gray-700 rounded accent-sky-500" />
                                                <label htmlFor="entire-course" className="font-semibold text-sky-400">Select Entire Course</label>
                                            </div>
                                        </div>
                                        {!isEntireCourse && (
                                            <div className="relative" ref={traineeSelectorRef}>
                                                <label className="block text-sm font-medium text-gray-400">{crewLabel}</label>
                                                <button onClick={() => setShowTraineeSelector(!showTraineeSelector)} className="mt-1 w-full text-left bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500">
                                                    {selectedTrainees.length > 0 ? `${selectedTrainees.length} selected` : `Select ${crewLabel.toLowerCase()}...`}
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
                                        <label htmlFor="cpt-resource" className="block text-sm font-medium text-gray-400">{cptLabel} Resource</label>
                                        <select id="cpt-resource" value={selectedCpt} onChange={e => setSelectedCpt(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                            {cptResourceOptions.map(c => (
                                                <option key={c} value={c}>{formatConfiguredResourceLabel(c, resourceDisplayNames)}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="ground-resource" className="block text-sm font-medium text-gray-400">Ground Resource</label>
                                        <select id="ground-resource" value={selectedGround} onChange={e => setSelectedGround(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">
                                            {groundResourceOptions.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="ground-location" className="block text-sm font-medium text-gray-400">{isCptEvent ? 'Notes' : 'Location'}</label>
                                    <input type="text" id="ground-location" value={notes} onChange={e => setNotes(e.target.value)}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                                        placeholder={isCptEvent ? 'Add any relevant notes...' : 'Enter a location...'} />
                                </div>

                                {/* Ground Event Footer */}
                                <div className="flex justify-end gap-[1px] pt-2">
                                    <button onClick={onClose} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed">
                                        Cancel
                                    </button>
                                    <button onClick={handleSaveGround} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-black">
                                        <span>Save<br/>Event</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Academics Tab ── */}
                        {activeTab === 'academics' && (
                            <AcademicsTab
                                syllabusDetails={syllabusDetails || groundSyllabus}
                                allTraineesByCourse={allTraineesByCourse}
                                traineesData={traineesData}
                                scores={scores || new Map()}
                                traineeLMPs={traineeLMPs || new Map()}
                                events={events || []}
                                date={date || new Date().toISOString().split('T')[0]}
                                courseColors={courseColors || activeCourses}
                                school={school || 'ESL'}
                                locationAbbreviations={locationAbbreviations}
                                defaultLocality={currentLocationName || ''}
                                courseAcademicProgress={courseAcademicProgress}
                                onUpdateCourseAcademicProgress={onUpdateCourseAcademicProgress}
                                persistedAcademicLmp={persistedAcademicLmp}
                                onUpdatePersistedAcademicLmp={onUpdatePersistedAcademicLmp}
                                instructors={instructors}
                                onSave={(data) => {
                                    if (onSaveAcademic) {
                                        onSaveAcademic(data);
                                    } else {
                                        onSave(data);
                                    }
                                }}
                                onClose={onClose}
                            />
                        )}
                    </div>
                </div>
            </div>

            {showCourseConfirm && (
                <CourseTraineeSelectionFlyout
                    onClose={() => { setShowCourseConfirm(false); setIsEntireCourse(false); }}
                    onConfirm={(confirmedTrainees) => { setSelectedTrainees(confirmedTrainees); setShowCourseConfirm(false); }}
                    courseNumber={selectedCourse}
                    traineesInCourse={allTraineesByCourse[selectedCourse] || []}
                    traineeStatus={traineesData.reduce((acc, t) => acc.set(t.fullName, { isPaused: t.isPaused }), new Map())}
                />
            )}
        </>
    );
};

export default AddGroundEventFlyout;
