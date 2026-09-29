import React, { useMemo, useState } from 'react';
import { Course, PhraseBank, TrainingReportAssessment, ScheduleEvent, SyllabusItemDetail, Trainee } from '../types';
import {
    DEFAULT_TRAINING_REPORT_TEMPLATE,
    normaliseTrainingReportTemplate,
    type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import { isSyllabusCourseShell } from '../utils/syllabusCourseShell';

interface TrainingCompletionViewProps {
    traineesData: Trainee[];
    archivedTraineesData: Trainee[];
    courses: Course[];
    archivedCourses: { [key: string]: string };
    publishedSchedules: Record<string, ScheduleEvent[]>;
    syllabusDetails: SyllabusItemDetail[];
    pt051Assessments: Map<string, TrainingReportAssessment>;
    onSaveTrainingReportAssessment: (assessment: TrainingReportAssessment) => void;
    trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
    phraseBank?: PhraseBank;
}

type CompletionDateMode = 'single-date' | 'date-range' | 'all-time';

const todayIso = () => new Date().toISOString().split('T')[0];

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
};

const formatTime = (time: number | undefined): string => {
    if (typeof time !== 'number' || Number.isNaN(time)) return '-';
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
};

const getCompletionDateForMode = (
    dateMode: CompletionDateMode,
    singleDate: string,
    startDate: string,
    endDate: string,
): string => {
    if (dateMode === 'single-date' && singleDate) return singleDate;
    if (dateMode === 'date-range') return endDate || startDate || todayIso();
    return todayIso();
};

const getScheduledTypeFromLmpType = (type: SyllabusItemDetail['type']): ScheduleEvent['type'] => {
    if (type === 'Flight') return 'flight';
    if (type === 'FTD') return 'ftd';
    if (type === 'Academics') return 'cpt';
    return 'ground';
};

const normaliseName = (name: string): string => (
    name
        .replace(/\s+[–-]\s+.*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
);

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

const displayPerson = (event: ScheduleEvent): string => {
    const people = [event.student, event.pilot, event.crew]
        .filter(Boolean)
        .map(person => String(person))
        .filter((person, index, list) => list.indexOf(person) === index);
    return people.length > 0 ? people.join(' / ') : '-';
};

const TrainingCompletionView: React.FC<TrainingCompletionViewProps> = ({
    traineesData,
    archivedTraineesData,
    courses,
    archivedCourses,
    publishedSchedules,
    syllabusDetails,
    pt051Assessments,
    onSaveTrainingReportAssessment,
    trainingReportTemplate,
}) => {
    const reportTemplate = useMemo(
        () => normaliseTrainingReportTemplate(trainingReportTemplate),
        [trainingReportTemplate],
    );
    const reportName = reportTemplate.reportName || DEFAULT_TRAINING_REPORT_TEMPLATE.reportName || 'Training Report';

    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [dateMode, setDateMode] = useState<CompletionDateMode>('single-date');
    const [singleDate, setSingleDate] = useState(todayIso());
    const [startDate, setStartDate] = useState(todayIso());
    const [endDate, setEndDate] = useState(todayIso());
    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionMessage, setCompletionMessage] = useState('');

    const allEvents = useMemo(() => Object.values(publishedSchedules).flat(), [publishedSchedules]);
    const allTrainees = useMemo(() => [...traineesData, ...archivedTraineesData], [traineesData, archivedTraineesData]);
    const courseNames = useMemo(() => {
        const activeCourses = courses.map(course => course.name);
        return [...new Set([...activeCourses, ...Object.keys(archivedCourses)])].sort((a, b) => a.localeCompare(b));
    }, [courses, archivedCourses]);

    const filteredCourses = useMemo(() => (
        courseNames.filter(course => course.toLowerCase().includes(courseSearch.toLowerCase()))
    ), [courseNames, courseSearch]);

    const courseTrainees = useMemo(() => (
        allTrainees.filter(trainee => selectedCourses.includes(trainee.course))
    ), [allTrainees, selectedCourses]);

    const selectedTrainingCodes = useMemo(() => {
        const codes = new Set(selectedCourses.map(normaliseCode).filter(Boolean));
        courses
            .filter(course => selectedCourses.includes(course.name))
            .forEach(course => {
                [course.lmpType, course.academicLmpType, course.code].forEach(value => {
                    const code = normaliseCode(value);
                    if (code) codes.add(code);
                });
            });
        courseTrainees.forEach(trainee => {
            [trainee.lmpType, trainee.academicLmpType].forEach(value => {
                const code = normaliseCode(value);
                if (code) codes.add(code);
            });
        });
        return codes;
    }, [courseTrainees, courses, selectedCourses]);

    const completionDate = useMemo(
        () => getCompletionDateForMode(dateMode, singleDate, startDate, endDate),
        [dateMode, endDate, singleDate, startDate],
    );

    const getEventTrainees = (event: ScheduleEvent): Trainee[] => {
        if (event.groupTraineeIds && event.groupTraineeIds.length > 0) {
            return courseTrainees.filter(trainee => event.groupTraineeIds?.includes(trainee.idNumber));
        }

        const eventPeople = [
            event.student,
            event.pilot,
            event.crew,
            ...(event.attendees || []),
        ].filter(Boolean).map(person => normaliseName(String(person)));

        return courseTrainees.filter(trainee => (
            eventPeople.includes(trainee.name) ||
            eventPeople.includes(trainee.fullName)
        ));
    };

    const candidateEvents = useMemo(() => {
        if (selectedCourses.length === 0) return [];

        const lmpEvents = syllabusDetails
            .filter((item: any) => item && item.isActive !== false)
            .filter(item => item.lmpType !== 'Staff CAT')
            .filter(item => !isSyllabusCourseShell(item))
            .filter(item => {
                const itemCode = normaliseCode(item.code);
                const itemTitle = normaliseCode(item.eventDescription || item.module);
                return !selectedTrainingCodes.has(itemCode) && !selectedTrainingCodes.has(itemTitle);
            })
            .filter(item => Array.isArray(item.courses) && item.courses.some(course => selectedTrainingCodes.has(normaliseCode(course))))
            .sort((a, b) => {
                const leftOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
                const rightOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
                return leftOrder - rightOrder
                    || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
                    || String(a.id || '').localeCompare(String(b.id || ''));
            })
            .map((item): ScheduleEvent => {
                const itemCourseCodes = new Set((item.courses || []).map(normaliseCode).filter(Boolean));
                const linkedTraineeIds = courseTrainees
                    .filter(trainee => (
                        itemCourseCodes.has(normaliseCode(trainee.course))
                        || itemCourseCodes.has(normaliseCode(trainee.lmpType))
                        || itemCourseCodes.has(normaliseCode(trainee.academicLmpType))
                    ))
                    .map(trainee => trainee.idNumber);
                return {
                    id: `lmp:${item.id || item.code}`,
                    date: completionDate,
                    type: getScheduledTypeFromLmpType(item.type),
                    groupTraineeIds: linkedTraineeIds,
                    flightNumber: item.code || item.eventDescription || 'LMP Event',
                    duration: Number(item.duration || item.flightOrSimHours || item.totalEventHours || 1),
                    startTime: 0,
                    resourceId: '',
                    color: '#0284c7',
                    flightType: item.sortieType || 'Dual',
                    locationType: 'Local',
                    origin: '',
                    destination: '',
                    notes: item.eventDescription,
                    eventCategory: 'lmp_event',
                };
            })
            .filter(event => getEventTrainees(event).length > 0);

        const seen = new Set<string>();
        return lmpEvents
            .filter(event => {
                const key = `${event.flightNumber}|${event.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [completionDate, courseTrainees, selectedCourses.length, selectedTrainingCodes, syllabusDetails]);

    const selectedEvent = useMemo(() => (
        candidateEvents.find(event => event.id === selectedEventId) || null
    ), [candidateEvents, selectedEventId]);

    const traineesForSelectedEvent = useMemo(() => (
        selectedEvent
            ? getEventTrainees(selectedEvent).sort((a, b) => `${a.course}-${a.name}`.localeCompare(`${b.course}-${b.name}`))
            : []
    ), [courseTrainees, selectedEvent]);

    const resetEventSelection = () => {
        setSelectedEventId('');
        setSelectedTrainees([]);
        setCompletionMessage('');
    };

    const handleCourseChange = (coursesSelected: string[]) => {
        setSelectedCourses(coursesSelected);
        resetEventSelection();
    };

    const handleEventSelect = (eventId: string) => {
        const event = candidateEvents.find(item => item.id === eventId);
        setSelectedEventId(eventId);
        setCompletionMessage('');
        setSelectedTrainees(event ? getEventTrainees(event).map(trainee => trainee.name) : []);
    };

    const processCompletion = async () => {
        if (!selectedEvent) {
            setCompletionMessage('Select the event that is to be marked complete.');
            return;
        }

        if (selectedTrainees.length === 0) {
            setCompletionMessage('Select at least one trainee for this event.');
            return;
        }

        setIsCompleting(true);
        setCompletionMessage('Completing selected training records...');

        try {
            selectedTrainees.forEach(traineeName => {
                const trainee = allTrainees.find(item => item.name === traineeName);
                if (!trainee) return;

                const assessmentId = `${trainee.name}_${selectedEvent.id}_TrainingReport`;
                const existingAssessment = pt051Assessments.get(assessmentId);
                const assessment: TrainingReportAssessment = existingAssessment
                    ? {
                        ...existingAssessment,
                        dcoResult: 'DCO',
                        overallGrade: 'No Grade',
                        overallResult: 'P',
                        isCompleted: true,
                    }
                    : {
                        id: assessmentId,
                        traineeFullName: trainee.name,
                        eventId: selectedEvent.id,
                        flightNumber: selectedEvent.flightNumber,
                        date: selectedEvent.date,
                        instructorName: selectedEvent.instructor || '',
                        overallGrade: 'No Grade',
                        overallResult: 'P',
                        dcoResult: 'DCO',
                        overallComments: '',
                        scores: [],
                        isCompleted: true,
                        groundSchoolAssessment: { isAssessment: false, result: undefined },
                    };

                onSaveTrainingReportAssessment(assessment);
            });

            setCompletionMessage(`Marked ${selectedTrainees.length} trainee${selectedTrainees.length === 1 ? '' : 's'} as DCO for ${selectedEvent.flightNumber}.`);
        } catch (error) {
            console.error('Error during selected event completion:', error);
            setCompletionMessage('The records could not be completed. Please try again.');
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <div className="h-full overflow-auto bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h1 className="text-2xl font-bold text-white mb-2">Complete Training</h1>
                    <p className="text-gray-400">
                        Select the course, choose the exact event, then select the trainees to mark as complete.
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-5">
                        <div>
                            <h2 className="text-lg font-semibold text-white mb-3">Course</h2>
                            <input
                                type="text"
                                value={courseSearch}
                                onChange={(event) => setCourseSearch(event.target.value)}
                                placeholder="Search courses..."
                                className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                            />
                            <select
                                multiple
                                value={selectedCourses}
                                onChange={(event) => {
                                    const options = Array.from(event.target.selectedOptions, option => option.value);
                                    handleCourseChange(options);
                                }}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                size={8}
                            >
                                {filteredCourses.map(courseName => (
                                    <option key={courseName} value={courseName}>
                                        {courseName} {archivedCourses[courseName] ? '(Archived)' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple courses.</p>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-white mb-3">Date</h2>
                            <div className="space-y-3 text-gray-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={dateMode === 'single-date'}
                                        onChange={() => {
                                            setDateMode('single-date');
                                            resetEventSelection();
                                        }}
                                        className="w-4 h-4 text-sky-500"
                                    />
                                    <span>Single date</span>
                                </label>
                                {dateMode === 'single-date' && (
                                    <input
                                        type="date"
                                        value={singleDate}
                                        onChange={(event) => {
                                            setSingleDate(event.target.value);
                                            resetEventSelection();
                                        }}
                                        className="ml-7 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    />
                                )}

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={dateMode === 'date-range'}
                                        onChange={() => {
                                            setDateMode('date-range');
                                            resetEventSelection();
                                        }}
                                        className="w-4 h-4 text-sky-500"
                                    />
                                    <span>Date range</span>
                                </label>
                                {dateMode === 'date-range' && (
                                    <div className="ml-7 space-y-2">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(event) => {
                                                setStartDate(event.target.value);
                                                resetEventSelection();
                                            }}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(event) => {
                                                setEndDate(event.target.value);
                                                resetEventSelection();
                                            }}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        />
                                    </div>
                                )}

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={dateMode === 'all-time'}
                                        onChange={() => {
                                            setDateMode('all-time');
                                            resetEventSelection();
                                        }}
                                        className="w-4 h-4 text-sky-500"
                                    />
                                    <span>All dates</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)] gap-6">
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Select Event</h2>
                                <span className="text-sm text-gray-400">{candidateEvents.length} LMP event{candidateEvents.length === 1 ? '' : 's'}</span>
                            </div>

                            {selectedCourses.length === 0 ? (
                                <p className="text-yellow-300 text-sm">Select a course to show its LMP events.</p>
                            ) : candidateEvents.length === 0 ? (
                                <p className="text-yellow-300 text-sm">No LMP events match the selected course.</p>
                            ) : (
                                <div className="border border-gray-700 rounded bg-gray-900/40 max-h-[520px] overflow-y-auto">
                                    {candidateEvents.map((event, index) => (
                                        <label
                                            key={event.id}
                                            className={`flex items-center gap-3 border-b border-gray-700 px-4 py-3 last:border-b-0 cursor-pointer ${
                                                selectedEventId === event.id ? 'bg-sky-900/45 text-white' : 'text-gray-200 hover:bg-gray-700/45'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                checked={selectedEventId === event.id}
                                                onChange={() => handleEventSelect(event.id)}
                                                className="h-4 w-4 text-sky-500"
                                            />
                                            <span className="w-8 shrink-0 text-xs font-semibold text-gray-500">{index + 1}</span>
                                            <span className="font-semibold">{event.flightNumber || 'LMP Event'}</span>
                                            {event.notes && (
                                                <span className="min-w-0 truncate text-sm text-gray-400">{event.notes}</span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Select Trainees</h2>
                                    <p className="text-sm text-gray-400">Only trainees linked to the selected event are shown.</p>
                                </div>
                                {selectedEvent && traineesForSelectedEvent.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedTrainees(traineesForSelectedEvent.map(trainee => trainee.name))}
                                            className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => setSelectedTrainees([])}
                                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!selectedEvent ? (
                                <p className="text-yellow-300 text-sm">Select an event first.</p>
                            ) : traineesForSelectedEvent.length === 0 ? (
                                <p className="text-yellow-300 text-sm">No trainees from the selected course are linked to this event.</p>
                            ) : (
                                <div className="border border-gray-600 rounded p-2 bg-gray-700/50 max-h-72 overflow-y-auto">
                                    {traineesForSelectedEvent.map(trainee => (
                                        <label key={trainee.name} className="flex items-center gap-3 p-2 hover:bg-gray-600/30 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedTrainees.includes(trainee.name)}
                                                onChange={(event) => {
                                                    if (event.target.checked) {
                                                        setSelectedTrainees([...selectedTrainees, trainee.name]);
                                                    } else {
                                                        setSelectedTrainees(selectedTrainees.filter(name => name !== trainee.name));
                                                    }
                                                }}
                                                className="h-4 w-4 accent-green-500 bg-gray-600 border-gray-500 rounded"
                                            />
                                            <span className="text-sm text-gray-200">
                                                {trainee.rank} {trainee.name} ({trainee.course})
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {selectedEvent && (
                                <div className="mt-5 p-4 rounded border border-gray-700 bg-gray-900/60">
                                    <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-2">Completion Summary</h3>
                                    <p className="text-sm text-gray-200">
                                        {selectedEvent.flightNumber} will be completed on {formatDate(selectedEvent.date)}.
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        This will mark the selected trainee {reportName} record{selectedTrainees.length === 1 ? '' : 's'} as DCO for this event only.
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 flex items-center justify-between gap-4">
                                <p className={`text-sm ${completionMessage.includes('Marked') ? 'text-green-300' : 'text-gray-300'}`}>
                                    {completionMessage}
                                </p>
                                <button
                                    onClick={processCompletion}
                                    disabled={!selectedEvent || selectedTrainees.length === 0 || isCompleting}
                                    className={`px-5 py-3 rounded font-semibold ${
                                        !selectedEvent || selectedTrainees.length === 0 || isCompleting
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                >
                                    {isCompleting ? 'Completing...' : `Complete Selected (${selectedTrainees.length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingCompletionView;
