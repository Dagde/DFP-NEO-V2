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
    traineeLMPs?: Map<string, SyllabusItemDetail[]>;
    onSaveTrainingReportAssessment: (assessment: TrainingReportAssessment) => void | Promise<void>;
    onPersistTrainingReportAssessment?: (assessment: TrainingReportAssessment) => Promise<unknown>;
    onUpdateLmpItem?: (
        trainee: Trainee,
        originalItem: SyllabusItemDetail,
        updatedItem: SyllabusItemDetail,
        options?: { suppressSuccessMessage?: boolean; sourceLmp?: SyllabusItemDetail[] }
    ) => boolean | Promise<boolean>;
    onLoadTraineeLmp?: (trainee: Trainee) => Promise<SyllabusItemDetail[] | null>;
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

const getTraineeSelectionKey = (trainee: Trainee): string => (
    String((trainee as any).id || trainee.idNumber || trainee.fullName || trainee.name || '').trim()
);

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return 'Unknown error';
    }
};

const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = 30000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

const buildBulkCompletionEventId = (trainee: Trainee, item: SyllabusItemDetail, fallbackEventId: string): string => {
    const traineeKey = getTraineeSelectionKey(trainee)
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const eventKey = String(item.masterEventId || item.id || item.code || fallbackEventId || 'event')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `bulk-training-${eventKey}-${traineeKey}`;
};

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
    traineeLMPs,
    onSaveTrainingReportAssessment,
    onPersistTrainingReportAssessment,
    onUpdateLmpItem,
    onLoadTraineeLmp,
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
    const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionMessage, setCompletionMessage] = useState('');
    const [completionDialogMessage, setCompletionDialogMessage] = useState('');

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

    const getTraineeLmpForTrainee = (trainee: Trainee, sourceLmp?: SyllabusItemDetail[] | null): SyllabusItemDetail[] => {
        if (Array.isArray(sourceLmp)) return sourceLmp;

        const exactLmp = traineeLMPs?.get(trainee.fullName);
        if (exactLmp) return exactLmp;

        const traineeNames = [trainee.fullName, trainee.name]
            .map(name => normaliseName(String(name || '')).toUpperCase())
            .filter(Boolean);
        if (traineeNames.length === 0 || !traineeLMPs) return [];

        const fuzzyEntry = Array.from(traineeLMPs.entries()).find(([lmpName]) => (
            traineeNames.includes(normaliseName(lmpName).toUpperCase())
        ));
        return fuzzyEntry?.[1] || [];
    };

    const findMasterLmpItemForEvent = (event: ScheduleEvent): SyllabusItemDetail | null => {
        const eventRef = normaliseCode((event as any).lmpItemId || event.id);
        const eventCode = normaliseCode((event as any).lmpItemCode || event.flightNumber);
        const eventTitle = normaliseCode(event.notes || event.flightNumber);
        return syllabusDetails.find(item => {
            if (!item || isSyllabusCourseShell(item)) return false;
            const itemRefs = [
                item.id,
                item.code,
                item.masterEventId,
                item.eventDescription,
            ].map(normaliseCode).filter(Boolean);
            return itemRefs.includes(eventRef) || itemRefs.includes(eventCode) || itemRefs.includes(eventTitle);
        }) || null;
    };

    const findTraineeLmpItemForEvent = (trainee: Trainee, event: ScheduleEvent, sourceLmp?: SyllabusItemDetail[] | null): { item: SyllabusItemDetail | null; source: 'individual' | 'master-fallback' | 'none'; traineeLmpLength: number } => {
        const traineeLmp = getTraineeLmpForTrainee(trainee, sourceLmp);
        const masterItem = findMasterLmpItemForEvent(event);
        if (traineeLmp.length === 0) {
            return { item: masterItem, source: masterItem ? 'master-fallback' : 'none', traineeLmpLength: 0 };
        }

        const eventRef = normaliseCode((event as any).lmpItemId || event.id);
        const eventCode = normaliseCode((event as any).lmpItemCode || event.flightNumber);
        const eventTitle = normaliseCode(event.notes || event.flightNumber);

        const individualItem = traineeLmp.find(item => {
            if (!item || isSyllabusCourseShell(item)) return false;
            const itemRefs = [
                item.id,
                item.code,
                item.masterEventId,
                item.eventDescription,
            ].map(normaliseCode).filter(Boolean);
            return itemRefs.includes(eventRef) || itemRefs.includes(eventCode) || itemRefs.includes(eventTitle);
        }) || null;

        if (individualItem) return { item: individualItem, source: 'individual', traineeLmpLength: traineeLmp.length };
        return { item: masterItem, source: masterItem ? 'master-fallback' : 'none', traineeLmpLength: traineeLmp.length };
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
                const eventId = item.id || item.code || item.eventDescription || `lmp-${item.sortOrder || 'event'}`;
                const itemCourseCodes = new Set((item.courses || []).map(normaliseCode).filter(Boolean));
                const linkedTraineeIds = courseTrainees
                    .filter(trainee => (
                        itemCourseCodes.has(normaliseCode(trainee.course))
                        || itemCourseCodes.has(normaliseCode(trainee.lmpType))
                        || itemCourseCodes.has(normaliseCode(trainee.academicLmpType))
                    ))
                    .map(trainee => trainee.idNumber);
                return {
                    id: eventId,
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
                    lmpItemId: eventId,
                    lmpItemCode: item.code || item.eventDescription || '',
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

    const selectedEvents = useMemo(() => (
        candidateEvents.filter(event => selectedEventIds.includes(event.id))
    ), [candidateEvents, selectedEventIds]);

    const traineesForSelectedEvents = useMemo(() => {
        if (selectedEvents.length === 0) return [];
        const traineesByName = new Map<string, Trainee>();
        selectedEvents.forEach(event => {
            getEventTrainees(event).forEach(trainee => {
                traineesByName.set(getTraineeSelectionKey(trainee), trainee);
            });
        });
        return Array.from(traineesByName.values()).sort((a, b) => `${a.course}-${a.name}`.localeCompare(`${b.course}-${b.name}`));
    }, [courseTrainees, selectedEvents]);

    const resetEventSelection = () => {
        setSelectedEventIds([]);
        setSelectedTrainees([]);
        setCompletionMessage('');
        setCompletionDialogMessage('');
    };

    const handleCourseChange = (coursesSelected: string[]) => {
        setSelectedCourses(coursesSelected);
        resetEventSelection();
    };

    const handleEventToggle = (eventId: string) => {
        const nextEventIds = selectedEventIds.includes(eventId)
            ? selectedEventIds.filter(id => id !== eventId)
            : [...selectedEventIds, eventId];
        const nextEvents = candidateEvents.filter(item => nextEventIds.includes(item.id));
        const traineeKeys = new Set<string>();
        nextEvents.forEach(event => {
            getEventTrainees(event).forEach(trainee => traineeKeys.add(getTraineeSelectionKey(trainee)));
        });
        setSelectedEventIds(nextEventIds);
        setCompletionMessage('');
        setSelectedTrainees(Array.from(traineeKeys));
    };

    const persistScoreCompletion = async (trainee: Trainee, item: SyllabusItemDetail, event: ScheduleEvent, completedAt: string) => {
        const eventCode = item.code || event.flightNumber || item.id || '';
        if (!eventCode) throw new Error('Missing LMP event code for score completion');
        const response = await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                traineeId: (trainee as any).id,
                traineeFullName: trainee.fullName,
                event: eventCode,
                score: 5,
                date: completedAt.slice(0, 10),
                instructor: event.instructor || '',
                notes: `Completed via Training Records bulk completion on ${formatDate(completedAt.slice(0, 10))}.`,
                details: {
                    source: 'training-records-bulk-completion',
                    lmpItemId: item.id || null,
                    masterEventId: item.masterEventId || null,
                    eventDescription: item.eventDescription || null,
                    selectedEventId: event.id,
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Score completion save failed (${response.status})`);
        }
    };

    const processCompletion = async () => {
        if (selectedEvents.length === 0) {
            setCompletionMessage('Select at least one event to mark complete.');
            return;
        }

        if (selectedTrainees.length === 0) {
            setCompletionMessage('Select at least one trainee for the selected events.');
            return;
        }

        setIsCompleting(true);
        setCompletionMessage('Completing selected training records...');
        setCompletionDialogMessage('');

        const completedAt = new Date(`${completionDate || todayIso()}T00:00:00`).toISOString();
        const completed: string[] = [];
        const failed: Array<{
            trainee: string;
            event: string;
            stage: string;
            reason: string;
        }> = [];
        const traceRows: Array<Record<string, unknown>> = [];
        const workItems = selectedEvents.flatMap(selectedEvent => {
            const eligibleTraineeKeys = new Set(getEventTrainees(selectedEvent).map(getTraineeSelectionKey));
            return selectedTrainees
                .filter(traineeKey => eligibleTraineeKeys.has(traineeKey))
                .map(traineeKey => ({ selectedEvent, traineeKey }));
        });
        let processed = 0;

        try {
            for (const { selectedEvent, traineeKey } of workItems) {
                const trainee = allTrainees.find(item => getTraineeSelectionKey(item) === traineeKey);
                const traceBase = {
                    traineeKey,
                    traineeName: trainee?.name || traineeKey,
                    traineeFullName: trainee?.fullName || traineeKey,
                    course: trainee?.course || null,
                    eventId: selectedEvent.id,
                    eventCode: selectedEvent.flightNumber,
                    eventDate: selectedEvent.date,
                };

                try {
                    if (!trainee) {
                        throw new Error('Selected trainee was not found in the active or archived trainee list.');
                    }

                    const freshIndividualLmp = onLoadTraineeLmp
                        ? await withTimeout(
                            onLoadTraineeLmp(trainee),
                            `${trainee.name} Individual LMP reload`,
                        )
                        : null;
                    const lmpMatch = findTraineeLmpItemForEvent(trainee, selectedEvent, freshIndividualLmp);
                    const lmpItem = lmpMatch.item;
                    if (!lmpItem || lmpMatch.source !== 'individual') {
                        throw new Error('Matching Individual LMP event was not found for this trainee. The record was not completed to avoid damaging the Individual LMP.');
                    }
                    if (lmpMatch.traineeLmpLength < 2) {
                        throw new Error(`Individual LMP reload returned only ${lmpMatch.traineeLmpLength} event${lmpMatch.traineeLmpLength === 1 ? '' : 's'}. The record was not completed to avoid overwriting the full Individual LMP.`);
                    }

                    const lmpEventCode = lmpItem.code || selectedEvent.flightNumber || lmpItem.id || '';
                    const assessmentEventId = buildBulkCompletionEventId(trainee, lmpItem, selectedEvent.id);

                    traceRows.push({
                        ...traceBase,
                        stage: 'score:save:start',
                        lmpItemId: lmpItem.id,
                        lmpEventCode,
                        lmpMatchSource: lmpMatch.source,
                        traineeLmpLength: lmpMatch.traineeLmpLength,
                    });
                    await withTimeout(
                        persistScoreCompletion(trainee, lmpItem, selectedEvent, completedAt),
                        `${trainee.name} / ${selectedEvent.flightNumber} score save`,
                    );

                    const assessmentId = `pt051-${assessmentEventId}-${trainee.fullName}`;
                    const existingAssessment = pt051Assessments.get(assessmentId)
                        || Array.from(pt051Assessments.values()).find(assessment => (
                            assessment.traineeFullName === trainee.fullName
                            && (
                                assessment.eventId === assessmentEventId
                                || normaliseCode(assessment.flightNumber) === normaliseCode(lmpEventCode)
                            )
                        ));
                    const assessment: TrainingReportAssessment = existingAssessment
                        ? {
                            ...existingAssessment,
                            id: assessmentId,
                            eventId: assessmentEventId,
                            flightNumber: lmpEventCode,
                            date: selectedEvent.date,
                            dcoResult: 'DCO',
                            overallGrade: 'No Grade',
                            overallResult: 'P',
                            isCompleted: true,
                        }
                        : {
                            id: assessmentId,
                            traineeFullName: trainee.fullName,
                            eventId: assessmentEventId,
                            flightNumber: lmpEventCode,
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

                    traceRows.push({ ...traceBase, stage: 'report:local-save:start', lmpItemId: lmpItem.id, lmpEventCode, assessmentEventId, lmpMatchSource: lmpMatch.source });
                    await withTimeout(
                        Promise.resolve(onSaveTrainingReportAssessment(assessment)),
                        `${trainee.name} / ${selectedEvent.flightNumber} local report save`,
                    );
                    if (onPersistTrainingReportAssessment) {
                        traceRows.push({ ...traceBase, stage: 'report:persist:start', lmpItemId: lmpItem.id, lmpEventCode, assessmentEventId, lmpMatchSource: lmpMatch.source });
                        await withTimeout(
                            onPersistTrainingReportAssessment({
                                ...assessment,
                                traineeFullName: trainee.fullName,
                            } as TrainingReportAssessment),
                            `${trainee.name} / ${selectedEvent.flightNumber} report persistence`,
                        );
                    }

                    if (lmpMatch.source === 'individual' && onUpdateLmpItem) {
                        const completedItem: SyllabusItemDetail = {
                            ...lmpItem,
                            completedAt,
                            isComplete: true,
                            completed: true,
                        } as SyllabusItemDetail & { isComplete?: boolean; completed?: boolean };
                        traceRows.push({ ...traceBase, stage: 'lmp:update:start', lmpItemId: lmpItem.id, lmpEventCode, assessmentEventId });
                        const updated = await withTimeout(
                            Promise.resolve(onUpdateLmpItem(trainee, lmpItem, completedItem, { suppressSuccessMessage: true, sourceLmp: freshIndividualLmp || undefined })),
                            `${trainee.name} / ${selectedEvent.flightNumber} Individual LMP update`,
                        );
                        if (updated === false) {
                            throw new Error('Individual LMP event could not be marked complete.');
                        }
                    }

                    completed.push(`${trainee.name} / ${selectedEvent.flightNumber}`);
                    traceRows.push({ ...traceBase, stage: 'complete', lmpItemId: lmpItem.id, lmpEventCode, assessmentEventId, lmpMatchSource: lmpMatch.source });
                } catch (error) {
                    const reason = getErrorMessage(error);
                    console.error('Error during selected event completion item:', { ...traceBase, reason, error });
                    failed.push({
                        trainee: trainee?.name || traineeKey,
                        event: selectedEvent.flightNumber,
                        stage: String(traceRows[traceRows.length - 1]?.stage || 'prepare'),
                        reason,
                    });
                    traceRows.push({ ...traceBase, stage: 'failed', reason });
                } finally {
                    processed += 1;
                    setCompletionMessage(`Completing selected training records... ${processed} of ${workItems.length} processed.`);
                }
            }
        } catch (error) {
            failed.push({
                trainee: 'Bulk completion',
                event: 'Selected events',
                stage: 'fatal',
                reason: getErrorMessage(error),
            });
            traceRows.push({ stage: 'fatal', reason: getErrorMessage(error) });
        } finally {
            setIsCompleting(false);
        }

        if (workItems.length === 0) {
            failed.push({
                trainee: 'Selected trainees',
                event: 'Selected events',
                stage: 'prepare',
                reason: 'No selected trainees were eligible for the selected events.',
            });
            traceRows.push({ stage: 'failed', reason: 'No selected trainees were eligible for the selected events.' });
        }

        const trace = {
            generatedAt: new Date().toISOString(),
            completionDate,
            selectedCourses,
            selectedEventIds,
            selectedTraineeCount: selectedTrainees.length,
            completedCount: completed.length,
            failedCount: failed.length,
            completed,
            failed,
            traceRows,
        };
        if (failed.length > 0) {
            const firstFailure = failed[0];
            setCompletionMessage(`Completed ${completed.length} trainee-event record${completed.length === 1 ? '' : 's'}. ${failed.length} failed. First failure: ${firstFailure.trainee} / ${firstFailure.event}: ${firstFailure.reason}`);
        } else {
            const successMessage = `Completed ${completed.length} trainee-event record${completed.length === 1 ? '' : 's'} across ${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}.`;
            setCompletionMessage(successMessage);
            setCompletionDialogMessage(successMessage);
        }

        if (failed.length > 0) {
            console.warn('[Training Completion] Some records failed', trace);
        }

        try {
            window.localStorage.setItem('dfp-training-completion-last-trace', JSON.stringify(trace));
        } catch (error) {
            console.warn('[Training Completion] Could not save completion trace to localStorage:', error);
        }
    };

    return (
        <div className="h-full overflow-auto bg-gray-900 p-6">
            {completionDialogMessage && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-4">
                    <div className="w-full max-w-lg rounded-lg border border-green-500 bg-gray-800 shadow-2xl">
                        <div className="border-b border-green-500/40 px-6 py-4">
                            <h2 className="text-xl font-bold text-green-300">Training Records Updated</h2>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-gray-100">{completionDialogMessage}</p>
                            <p className="mt-2 text-sm text-gray-400">
                                The selected Individual LMP events and training report records have finished updating.
                            </p>
                        </div>
                        <div className="flex justify-end border-t border-gray-700 px-6 py-4">
                            <button
                                onClick={() => setCompletionDialogMessage('')}
                                className="rounded bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                                                selectedEventIds.includes(event.id) ? 'bg-sky-900/45 text-white' : 'text-gray-200 hover:bg-gray-700/45'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedEventIds.includes(event.id)}
                                                onChange={() => handleEventToggle(event.id)}
                                                className="h-4 w-4 accent-sky-500 bg-gray-700 border-gray-500 rounded"
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
                                    <p className="text-sm text-gray-400">Only trainees linked to the selected event set are shown.</p>
                                </div>
                                {selectedEvents.length > 0 && traineesForSelectedEvents.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedTrainees(traineesForSelectedEvents.map(getTraineeSelectionKey))}
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

                            {selectedEvents.length === 0 ? (
                                <p className="text-yellow-300 text-sm">Select at least one event first.</p>
                            ) : traineesForSelectedEvents.length === 0 ? (
                                <p className="text-yellow-300 text-sm">No trainees from the selected course are linked to these events.</p>
                            ) : (
                                <div className="border border-gray-600 rounded p-2 bg-gray-700/50 max-h-72 overflow-y-auto">
                                    {traineesForSelectedEvents.map(trainee => (
                                        <label key={getTraineeSelectionKey(trainee)} className="flex items-center gap-3 p-2 hover:bg-gray-600/30 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedTrainees.includes(getTraineeSelectionKey(trainee))}
                                                onChange={(event) => {
                                                    const traineeKey = getTraineeSelectionKey(trainee);
                                                    if (event.target.checked) {
                                                        setSelectedTrainees([...selectedTrainees, traineeKey]);
                                                    } else {
                                                        setSelectedTrainees(selectedTrainees.filter(key => key !== traineeKey));
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

                            {selectedEvents.length > 0 && (
                                <div className="mt-5 p-4 rounded border border-gray-700 bg-gray-900/60">
                                    <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-2">Completion Summary</h3>
                                    <p className="text-sm text-gray-200">
                                        {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'} will be completed on {formatDate(completionDate)}.
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        This will mark each selected trainee Individual LMP event complete and add DCO {reportName} records for the selected event set.
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-2">
                                    <p className={`text-sm ${completionMessage.includes('failed') ? 'text-yellow-300' : completionMessage.includes('Completed') ? 'text-green-300' : 'text-gray-300'}`}>
                                        {completionMessage}
                                    </p>
                                </div>
                                <button
                                    onClick={processCompletion}
                                    disabled={selectedEvents.length === 0 || selectedTrainees.length === 0 || isCompleting}
                                    className={`px-5 py-3 rounded font-semibold shrink-0 ${
                                        selectedEvents.length === 0 || selectedTrainees.length === 0 || isCompleting
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
