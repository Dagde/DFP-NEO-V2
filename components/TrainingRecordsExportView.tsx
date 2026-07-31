import React, { useEffect, useState, useMemo } from 'react';
import { Trainee, Instructor, ScheduleEvent, Course, Score, Pt051Assessment, SyllabusItemDetail, PhraseBank } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { getTraineeStatusLabel } from '../utils/traineeStatus';
import {
    DEFAULT_TRAINING_REPORT_TEMPLATE,
    normaliseTrainingReportTemplate,
    type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import { showDarkAlert } from './DarkMessageModal';

interface TrainingRecordsExportViewProps {
    traineesData: Trainee[];
    instructorsData: Instructor[];
    archivedTraineesData: Trainee[];
    archivedInstructorsData: Instructor[];
    events: ScheduleEvent[];
    courses: Course[];
    archivedCourses: { [key: string]: string };
    scores: Map<string, Score[]>;
    publishedSchedules: Record<string, ScheduleEvent[]>;
    syllabusDetails: SyllabusItemDetail[];
    pt051Assessments: Map<string, Pt051Assessment>;
    onSavePT051Assessment: (assessment: Pt051Assessment) => void;
    resourceDisplayNames?: ResourceDisplayNames;
    instructorLabel?: string;
    trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
    phraseBank?: PhraseBank;
    hasTraineesEnabled?: boolean;
}

type RecordType = 'all' | 'trainees' | 'staff' | 'events';
type TimePeriod = 'all-time' | 'single-date' | 'date-range';
type OutputFormat = 'pdf' | 'excel' | 'csv';
type EventType = 'Flight' | 'FTD' | 'CPT' | 'Ground';
type StatusFilter = 'all' | 'dco' | 'dpco' | 'dnco' | 'pass' | 'fail';
type RemedialFilter = 'all' | 'yes' | 'no';
type ExportCommentSectionKey = 'assessor' | 'weather' | 'profile' | 'overall' | 'nest';

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return entities[char] || char;
    });

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normaliseCourseFilterValue = (value?: string): string =>
    String(value || '').trim().toLowerCase();
const ALL_COURSES_FILTER_VALUE = '__all_courses__';
const normalisePersonFilterValue = (value?: string): string =>
    String(value || '')
        .replace(/\s+[–-]\s+.+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
const eventPersonMatchesSelection = (eventName: string | undefined, selectedName: string): boolean => {
    const normalisedEventName = normalisePersonFilterValue(eventName);
    const normalisedSelectedName = normalisePersonFilterValue(selectedName);
    return Boolean(normalisedEventName && normalisedSelectedName && normalisedEventName === normalisedSelectedName);
};
const getEventPersonName = (event: ScheduleEvent): string =>
    event.student || event.pilot || '';

const normaliseEventNumber = (value?: string): string =>
    String(value || '').replace(/\s+/g, '').toLowerCase();

const findSyllabusDetailByEventNumber = (
    syllabusDetails: SyllabusItemDetail[],
    eventNumber?: string,
): SyllabusItemDetail | undefined => {
    const eventNum = String(eventNumber || '').trim();
    if (!eventNum) return undefined;
    const compactEventNum = normaliseEventNumber(eventNum);
    return syllabusDetails.find(detail => {
        const id = String(detail.id || '').trim();
        const code = String(detail.code || '').trim();
        return id.toLowerCase() === eventNum.toLowerCase()
            || code.toLowerCase() === eventNum.toLowerCase()
            || normaliseEventNumber(id) === compactEventNum
            || normaliseEventNumber(code) === compactEventNum;
    });
};

const normaliseExportEventType = (
    event: Partial<ScheduleEvent>,
    syllabusDetail?: SyllabusItemDetail,
): EventType | '' => {
    const syllabusType = String(syllabusDetail?.type || '').trim().toLowerCase();
    const scheduleType = String(event.type || '').trim().toLowerCase();
    const eventCode = String(event.flightNumber || '').trim().toUpperCase();
    const resource = String(event.resourceId || '').trim().toLowerCase();
    const sourceType = syllabusType || scheduleType;

    if (sourceType.includes('ground') || sourceType.includes('academic')) return 'Ground';
    if (sourceType.includes('ftd') || sourceType.includes('sim')) return 'FTD';
    if (sourceType.includes('cpt')) return 'CPT';
    if (sourceType.includes('flight')) return 'Flight';
    if (resource.startsWith('ftd') || resource.startsWith('sim')) return 'FTD';
    if (resource.startsWith('cpt')) return 'CPT';
    if (/\b(MB|TUT|QUIZ|GS)\d*/.test(eventCode)) return 'Ground';
    if (/\bCPT\d*/.test(eventCode)) return 'CPT';
    if (/\bFTD\d*/.test(eventCode)) return 'FTD';
    return '';
};

const DEFAULT_EXPORT_ASSESSMENT_STRUCTURE = [
    { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
    { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
    { category: 'Takeoff', elements: ['Stationary'] },
    { category: 'Departure', elements: ['Visual'] },
    { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
    { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
    { category: 'Recovery', elements: ['Visual - Initial & Pitch'] },
    { category: 'Landing', elements: ['Landing', 'Crosswind'] },
    { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] },
];
const DEFAULT_EXPORT_ASSESSED_ELEMENTS = ['Airmanship', 'Preparation', 'Technique'];
const SCORING_MATRIX_ELEMENT_GROUPS_KEY = '__scoringMatrixElementGroups';

const getDefaultAssessmentCategory = (element: string): string => (
    DEFAULT_EXPORT_ASSESSMENT_STRUCTURE.find(category => (
        category.elements.some(candidate => candidate.toLowerCase() === element.toLowerCase())
    ))?.category || 'Additional Elements'
);

const buildExportAssessmentStructure = (elements?: string[], phraseBank?: PhraseBank) => {
    const seen = new Set<string>();
    const hasConfiguredElements = Array.isArray(elements);
    const selectedElements = (hasConfiguredElements ? elements : DEFAULT_EXPORT_ASSESSED_ELEMENTS)
        .map(element => String(element || '').trim())
        .filter(Boolean)
        .filter(element => {
            const key = element.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    const categories = DEFAULT_EXPORT_ASSESSMENT_STRUCTURE.map(category => category.category);
    const configuredGroups = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_GROUPS_KEY] || {};
    const grouped = new Map<string, string[]>();

    selectedElements.forEach(element => {
        const configuredGroup = String(configuredGroups[element] || '').trim();
        const category = configuredGroup || getDefaultAssessmentCategory(element);
        if (!categories.includes(category)) categories.push(category);
        grouped.set(category, [...(grouped.get(category) || []), element]);
    });

    const structure = categories
        .map(category => ({ category, elements: grouped.get(category) || [] }))
        .filter(category => category.elements.length > 0);

    return structure.length > 0
        ? structure
        : (hasConfiguredElements ? [] : [{ category: 'Core Dimensions', elements: DEFAULT_EXPORT_ASSESSED_ELEMENTS }]);
};

interface ExportTemplate {
    name: string;
    recordType: RecordType;
    timePeriod: TimePeriod;
    singleDate: string;
    startDate: string;
    endDate: string;
    outputFormat: OutputFormat;
    selectedTrainees: string[];
    selectedStaff: string[];
    useSpecificTraineeFilter?: boolean;
    useSpecificStaffFilter?: boolean;
    selectedCourses: string[];
    selectedEventTypes: EventType[];
    statusFilter: StatusFilter;
    remedialFilter: RemedialFilter;
}

const TrainingRecordsExportView: React.FC<TrainingRecordsExportViewProps> = ({
    traineesData,
    instructorsData,
    archivedTraineesData,
    archivedInstructorsData,
    events,
    courses,
    archivedCourses,
    scores,
    publishedSchedules,
    syllabusDetails,
    pt051Assessments,
    onSavePT051Assessment,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    instructorLabel = 'Instructor',
    trainingReportTemplate = null,
    phraseBank,
    hasTraineesEnabled = true
}) => {
    const activeTrainingReportTemplate = useMemo(
        () => normaliseTrainingReportTemplate(trainingReportTemplate || DEFAULT_TRAINING_REPORT_TEMPLATE),
        [trainingReportTemplate],
    );
    const exportReportName = activeTrainingReportTemplate.displayName || activeTrainingReportTemplate.genericName || 'Training Report';
    const exportAssessmentTitle = `${exportReportName} Training Assessment`;
    const exportAssessorLabel = activeTrainingReportTemplate.modules.comments.fields.assessor || instructorLabel || 'Instructor';
    const exportCommentFieldLabels = activeTrainingReportTemplate.modules.comments.fields;
    const exportOverallFieldLabels = activeTrainingReportTemplate.modules.overallAssessment.fields;
    const exportCompletionResultLabels = activeTrainingReportTemplate.completionResults.reduce<Record<string, string>>((acc, result) => {
        if (result.enabled !== false) acc[result.code] = result.label || result.code;
        return acc;
    }, {});
    const statusCompletionOptions = activeTrainingReportTemplate.completionResults
        .filter(result => result.enabled !== false)
        .map(result => ({
            value: result.code.toLowerCase() as StatusFilter,
            label: result.label || result.code,
        }));
    const activeStatusCompletionOptions = statusCompletionOptions.length > 0
        ? statusCompletionOptions
        : [{ value: 'dco' as StatusFilter, label: 'Complete' }];
    const exportCompletedStatusLabel = exportCompletionResultLabels.DCO || 'Complete';

    // Core export settings
    const [recordType, setRecordType] = useState<RecordType>('all');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('all-time');
    const [singleDate, setSingleDate] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');

    // Optional filters
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [useSpecificTraineeFilter, setUseSpecificTraineeFilter] = useState(false);
    const [useSpecificStaffFilter, setUseSpecificStaffFilter] = useState(false);
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [selectedEventTypes, setSelectedEventTypes] = useState<EventType[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [remedialFilter, setRemedialFilter] = useState<RemedialFilter>('all');
    
    // Search filters
    const [courseSearch, setCourseSearch] = useState('');
    const [traineeSearch, setTraineeSearch] = useState('');
    const [staffSearch, setStaffSearch] = useState('');

    // Template management
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [showExportSuccess, setShowExportSuccess] = useState(false);
    const [showExportError, setShowExportError] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatus, setExportStatus] = useState('');
    const [savedTemplates, setSavedTemplates] = useState<ExportTemplate[]>([]);
    
    // Mass completion state
    const [showMassComplete, setShowMassComplete] = useState(false);
    const [selectedForCompletion, setSelectedForCompletion] = useState<string[]>([]);
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionProgress, setCompletionProgress] = useState(0);
    const [completionStatus, setCompletionStatus] = useState('');
    const canExportTraineeRecords = hasTraineesEnabled;

    useEffect(() => {
        if (!canExportTraineeRecords && recordType === 'trainees') {
            setRecordType('all');
        }
    }, [canExportTraineeRecords, recordType]);

    const getEventTypeLabel = (type: EventType): string => {
        if (type === 'FTD') return resourceDisplayNames.ftd;
        if (type === 'CPT') return resourceDisplayNames.cpt;
        return type;
    };

    // Format date as dd MMM yy
    const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        const date = isoMatch
            ? new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
            : new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
        const year = String(date.getUTCFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    };

    // Get all events from published schedules
    const allEvents = useMemo(() => {
        const events = Object.values(publishedSchedules).flat();
        console.log('📊 Export View - All events from published schedules:', events.length);
        console.log('📊 Export View - Published schedule dates:', Object.keys(publishedSchedules));
        return events;
    }, [publishedSchedules]);

    const allReportEvents = useMemo(() => {
        const seen = new Set<string>();
        return Array.from(pt051Assessments.values())
            .filter(assessment => assessment && assessment.traineeFullName && assessment.flightNumber && assessment.date)
            .map((assessment): ScheduleEvent => {
                const matchingScheduleEvent = allEvents.find(event => (
                    (event.id && event.id === assessment.eventId) ||
                    (
                        event.flightNumber === assessment.flightNumber &&
                        event.date === assessment.date &&
                        eventPersonMatchesSelection(getEventPersonName(event), assessment.traineeFullName)
                    )
                ));
                const matchingSyllabusDetail = findSyllabusDetailByEventNumber(syllabusDetails, assessment.flightNumber);
                const inferredEventType = normaliseExportEventType(
                    matchingScheduleEvent || { flightNumber: assessment.flightNumber },
                    matchingSyllabusDetail,
                );
                return {
                    ...(matchingScheduleEvent || {}),
                    id: assessment.eventId || assessment.id,
                    date: assessment.date,
                    type: matchingScheduleEvent?.type || inferredEventType || matchingSyllabusDetail?.type || '',
                    instructor: assessment.instructorName || matchingScheduleEvent?.instructor || '',
                    student: assessment.traineeFullName,
                    pilot: matchingScheduleEvent?.pilot || assessment.traineeFullName,
                    flightNumber: assessment.flightNumber,
                    duration: assessment.duration ?? matchingScheduleEvent?.duration ?? 0,
                    startTime: assessment.startTime ?? matchingScheduleEvent?.startTime ?? 0,
                    resourceId: matchingScheduleEvent?.resourceId || '',
                    color: matchingScheduleEvent?.color || '#0ea5e9',
                    flightType: matchingScheduleEvent?.flightType || 'Dual',
                    locationType: matchingScheduleEvent?.locationType || 'Local',
                    origin: matchingScheduleEvent?.origin || '',
                    destination: matchingScheduleEvent?.destination || '',
                } as ScheduleEvent;
            })
            .filter(event => {
                const key = `${event.id}|||${event.date}|||${event.flightNumber}|||${normalisePersonFilterValue(getEventPersonName(event))}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => (
                String(a.date || '').localeCompare(String(b.date || '')) ||
                Number(a.startTime || 0) - Number(b.startTime || 0) ||
                String(getEventPersonName(a)).localeCompare(String(getEventPersonName(b))) ||
                String(a.flightNumber || '').localeCompare(String(b.flightNumber || ''))
            ));
    }, [allEvents, pt051Assessments, syllabusDetails]);

    const exportSourceEvents = allReportEvents.length > 0 ? allReportEvents : allEvents;
    
    // Combine active and archived data
    const allTrainees = useMemo(() => {
        const combined = [...traineesData, ...archivedTraineesData];
        console.log('📊 Export View - All trainees:', combined.length);
        console.log('📊 Export View - ADF303 trainees:', combined.filter(t => t.course === 'ADF303').length);
        return combined;
    }, [traineesData, archivedTraineesData]);
    const allInstructors = useMemo(() => [...instructorsData, ...archivedInstructorsData], [instructorsData, archivedInstructorsData]);
    const allCourseNames = useMemo(() => {
        const activeCourses = courses.map(c => c.name);
        const archivedCourseNames = Object.keys(archivedCourses);
        return [...new Set([...activeCourses, ...archivedCourseNames])];
    }, [courses, archivedCourses]);

    const findSyllabusDetailForEventNumber = (eventNumber?: string): SyllabusItemDetail | undefined =>
        findSyllabusDetailByEventNumber(syllabusDetails, eventNumber);

    const pt051AssessmentList = useMemo(() => Array.from(pt051Assessments.values()), [pt051Assessments]);

    const findAssessmentForEvent = (event: ScheduleEvent): Pt051Assessment | undefined => {
        const eventPerson = getEventPersonName(event);
        return pt051AssessmentList.find(assessment => (
            (Boolean(event.id) && assessment.eventId === event.id) ||
            (
                assessment.flightNumber === event.flightNumber &&
                assessment.date === event.date &&
                eventPersonMatchesSelection(eventPerson, assessment.traineeFullName)
            )
        ));
    };

    const findScoreForEvent = (event: ScheduleEvent): any => {
        const eventPerson = getEventPersonName(event);
        if (!eventPerson) return undefined;
        let traineeScores = scores.get(eventPerson);
        if (!traineeScores) {
            for (const [scorePerson, scoreRows] of scores.entries()) {
                if (eventPersonMatchesSelection(scorePerson, eventPerson)) {
                    traineeScores = scoreRows;
                    break;
                }
            }
        }
        return traineeScores?.find((score: any) => (
            (score.syllabusId || score.event) === event.flightNumber &&
            score.date === event.date
        ));
    };

    const getTrainingReportExportValues = (event: ScheduleEvent) => {
        const assessment = findAssessmentForEvent(event);
        const eventScore = findScoreForEvent(event);
        const legacyOutcomeCode = String(eventScore?.outcome || '').trim().toUpperCase();
        const completionCode = String(
            assessment?.dcoResult ||
            eventScore?.dcoResult ||
            (exportCompletionResultLabels[legacyOutcomeCode] ? legacyOutcomeCode : '')
        ).trim().toUpperCase();
        const missionStatus = completionCode
            ? (exportCompletionResultLabels[completionCode] || completionCode)
            : 'N/A';
        const assessmentGrade = assessment?.overallGrade;
        const overallGrade = assessmentGrade !== null && assessmentGrade !== undefined && String(assessmentGrade).trim()
            ? String(assessmentGrade)
            : (eventScore?.outcome || 'Not Assessed');
        const comments = assessment?.overallComments || assessment?.trainingReportNotes || eventScore?.comments || '';

        return {
            missionStatus,
            overallGrade,
            comments,
        };
    };

    const getEventStatusBucket = (event: ScheduleEvent): StatusFilter | '' => {
        const assessment = findAssessmentForEvent(event);
        const eventScore = findScoreForEvent(event);
        const completionResult = String(assessment?.dcoResult || eventScore?.dcoResult || eventScore?.outcome || '').trim().toUpperCase();
        const overallResult = String(assessment?.overallResult || eventScore?.overallResult || eventScore?.outcome || '').trim().toUpperCase();

        if (completionResult === 'DCO') return 'dco';
        if (completionResult === 'DPCO') return 'dpco';
        if (completionResult === 'DNCO') return 'dnco';
        if (overallResult === 'P' || overallResult === 'PASS') return 'pass';
        if (overallResult === 'F' || overallResult === 'FAIL') return 'fail';
        return '';
    };

    const isExportEventRemedial = (event: ScheduleEvent): boolean => {
        const syllabusDetail = findSyllabusDetailForEventNumber(event.flightNumber);
        const eventCode = String(event.flightNumber || '').toUpperCase();
        return Boolean(
            event.isRemedial ||
            syllabusDetail?.isRemedial ||
            eventCode.includes('-REM-') ||
            eventCode.endsWith('-RF') ||
            eventCode.endsWith(' RF')
        );
    };
    
    // Filtered lists for dropdowns
    const filteredCourses = useMemo(() => {
        return allCourseNames.filter(name => 
            name.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [allCourseNames, courseSearch]);
    
    const filteredTrainees = useMemo(() => {
        const selectedCourseSet = new Set(selectedCourses.map(normaliseCourseFilterValue));
        return allTrainees.filter(t => {
            const matchesCourse = selectedCourses.length === 0 || selectedCourseSet.has(normaliseCourseFilterValue(t.course));
            const matchesSearch = `${t.rank} ${t.name} ${t.course}`.toLowerCase().includes(traineeSearch.toLowerCase());
            return matchesCourse && matchesSearch;
        });
    }, [allTrainees, traineeSearch, selectedCourses]);

    useEffect(() => {
        if (selectedCourses.length === 0) return;
        const selectedCourseSet = new Set(selectedCourses.map(normaliseCourseFilterValue));
        const allowedTraineeNames = new Set(
            allTrainees
                .filter(t => selectedCourseSet.has(normaliseCourseFilterValue(t.course)))
                .map(t => t.name),
        );
        setSelectedTrainees(previous => previous.filter(name => allowedTraineeNames.has(name)));
    }, [allTrainees, selectedCourses]);
    
    const filteredStaff = useMemo(() => {
        return allInstructors.filter(i => 
            `${i.rank} ${i.name}`.toLowerCase().includes(staffSearch.toLowerCase())
        );
    }, [allInstructors, staffSearch]);

    // Filter events based on current settings
    const filteredEvents = useMemo(() => {
        let filtered = [...exportSourceEvents];
        console.log('🔍 FILTER DEBUG - Starting with events:', filtered.length);
        console.log('🔍 FILTER DEBUG - timePeriod:', timePeriod);
        console.log('🔍 FILTER DEBUG - singleDate:', singleDate);
        console.log('🔍 FILTER DEBUG - startDate:', startDate);
        console.log('🔍 FILTER DEBUG - endDate:', endDate);

        // Time period filter
        if (timePeriod === 'single-date' && singleDate) {
            filtered = filtered.filter(e => e.date === singleDate);
            console.log('🔍 FILTER DEBUG - After single-date filter:', filtered.length);
        } else if (timePeriod === 'date-range' && startDate && endDate) {
            filtered = filtered.filter(e => e.date >= startDate && e.date <= endDate);
            console.log('🔍 FILTER DEBUG - After date-range filter:', filtered.length);
        }

        // Event type filter
        if (selectedEventTypes.length > 0) {
            console.log('🔍 FILTER DEBUG - selectedEventTypes:', selectedEventTypes);
            console.log('🔍 FILTER DEBUG - Sample event types from data (first 5):', filtered.slice(0, 5).map(e => e.type));
            console.log('🔍 FILTER DEBUG - Unique event types in data:', [...new Set(filtered.map(e => e.type))]);
            
            const selectedTypeSet = new Set(selectedEventTypes);
            filtered = filtered.filter(e => {
                const syllabusDetail = findSyllabusDetailForEventNumber(e.flightNumber);
                const exportType = normaliseExportEventType(e, syllabusDetail);
                return Boolean(exportType && selectedTypeSet.has(exportType));
            });
            
            console.log('🔍 FILTER DEBUG - After event type filter:', filtered.length);
        }

        // Status filter - based on saved training report outcomes
        console.log('🔍 FILTER DEBUG - statusFilter:', statusFilter);
        console.log('🔍 FILTER DEBUG - Before status filter:', filtered.length);
        if (statusFilter !== 'all') {
            filtered = filtered.filter(e => getEventStatusBucket(e) === statusFilter);
        }
        console.log('🔍 FILTER DEBUG - After all status filters:', filtered.length);

        // Remedial filter
        console.log('🔍 FILTER DEBUG - remedialFilter:', remedialFilter);
        if (remedialFilter === 'yes') {
            filtered = filtered.filter(e => isExportEventRemedial(e));
            console.log('🔍 FILTER DEBUG - After remedial=yes filter:', filtered.length);
        } else if (remedialFilter === 'no') {
            filtered = filtered.filter(e => !isExportEventRemedial(e));
            console.log('🔍 FILTER DEBUG - After remedial=no filter:', filtered.length);
        }

        // People filter - FIXED: Handle course suffix in event names
        if (useSpecificTraineeFilter && selectedTrainees.length > 0) {
            console.log('📊 Trainee filter - Selected trainees:', selectedTrainees);
            console.log('📊 Trainee filter - Events before filter:', filtered.length);
            
            filtered = filtered.filter(e => {
                const studentName = getEventPersonName(e);
                if (!studentName) return false;
                
                const matches = selectedTrainees.some(selectedTrainee => eventPersonMatchesSelection(studentName, selectedTrainee));
                
                return matches;
            });
            
            console.log('📊 Trainee filter - Events after filter:', filtered.length);
        }
        if (useSpecificStaffFilter && selectedStaff.length > 0) {
            filtered = filtered.filter(e => 
                e.instructor && selectedStaff.some(selectedInstructor => eventPersonMatchesSelection(e.instructor, selectedInstructor))
            );
        }

        // Course filter - FIXED: Handle course suffix in event names
        if (selectedCourses.length > 0) {
            const selectedCourseSet = new Set(selectedCourses.map(normaliseCourseFilterValue));
            const courseTrainees = allTrainees.filter(t => selectedCourseSet.has(normaliseCourseFilterValue(t.course)));
            const traineeNames = courseTrainees.map(t => t.name);
            console.log('📊 Course filter - Selected courses:', selectedCourses);
            console.log('📊 Course filter - Trainees in selected courses:', courseTrainees.length);
            console.log('📊 Course filter - Trainee names (first 5):', traineeNames.slice(0, 5));
            console.log('📊 Course filter - Events before filter:', filtered.length);
            console.log('📊 Course filter - Sample event student names (first 5):', filtered.slice(0, 5).map(e => e.student || e.pilot));
            
            // Match trainee names with or without course suffix (e.g., "Edwards, Charlotte" or "Edwards, Charlotte – ADF301")
            filtered = filtered.filter(e => {
                const studentName = getEventPersonName(e);
                if (!studentName) return false;
                
                // Check if the student name (with or without course suffix) matches any trainee
                const matches = traineeNames.some(traineeName => {
                    // Check exact match
                    if (studentName === traineeName) return true;
                    // Check if student name starts with trainee name followed by course suffix
                    if (studentName.startsWith(traineeName + ' –') || studentName.startsWith(traineeName + ' -')) return true;
                    return false;
                });
                
                if (!matches) {
                    console.log('📊 No match for student:', studentName);
                }
                
                return matches;
            });
            console.log('📊 Course filter - Events after filter:', filtered.length);
        }

        return filtered;
    }, [exportSourceEvents, timePeriod, singleDate, startDate, endDate, selectedEventTypes,
        statusFilter, remedialFilter, selectedTrainees, selectedStaff, useSpecificTraineeFilter, useSpecificStaffFilter, selectedCourses, allTrainees, scores, syllabusDetails, pt051AssessmentList]);

    // Get trainees scheduled for selected courses and date range (for mass completion)
    const getScheduledTraineesForCompletion = useMemo(() => {
        if (selectedCourses.length === 0) return [];
        
        const courseTrainees = allTrainees.filter(t => selectedCourses.includes(t.course));
        
        // Filter events by selected courses and date range
        let eventsInDateRange = allEvents;
        if (timePeriod === 'single-date' && singleDate) {
            eventsInDateRange = eventsInDateRange.filter(e => e.date === singleDate);
        } else if (timePeriod === 'date-range' && startDate && endDate) {
            eventsInDateRange = eventsInDateRange.filter(e => e.date >= startDate && e.date <= endDate);
        }
        
        // Get events for selected courses
        const courseEvents = eventsInDateRange.filter(e => 
            selectedCourses.some(course => {
                const studentName = e.student || e.pilot;
                if (!studentName) return false;
                const trainee = courseTrainees.find(t => 
                    studentName === t.name || 
                    studentName.startsWith(t.name + ' –') || 
                    studentName.startsWith(t.name + ' -')
                );
                return trainee;
            })
        );
        
        // Get unique trainee names from these events
        const scheduledTraineeNames = [...new Set(
            courseEvents.map(e => {
                const studentName = e.student || e.pilot;
                if (!studentName) return null;
                
                // Extract just the name part (remove course suffix)
                const trainee = courseTrainees.find(t => 
                    studentName === t.name || 
                    studentName.startsWith(t.name + ' –') || 
                    studentName.startsWith(t.name + ' -')
                );
                return trainee?.name;
            }).filter(Boolean)
        )] as string[];
        
        return scheduledTraineeNames;
    }, [allEvents, selectedCourses, timePeriod, singleDate, startDate, endDate, allTrainees]);

    // Calculate filtered data based on record type
    const filteredData = useMemo(() => {
        console.log('📊 filteredData calculation - recordType:', recordType);
        console.log('📊 filteredData calculation - filteredEvents:', filteredEvents.length);
        console.log('📊 filteredData calculation - allTrainees:', allTrainees.length);
        console.log('📊 filteredData calculation - allInstructors:', allInstructors.length);
        const selectedCourseSet = new Set(selectedCourses.map(normaliseCourseFilterValue));
        const exportTrainees = selectedCourses.length > 0
            ? allTrainees.filter(t => selectedCourseSet.has(normaliseCourseFilterValue(t.course)))
            : allTrainees;
        const personFilteredTrainees = useSpecificTraineeFilter && selectedTrainees.length > 0
            ? exportTrainees.filter(trainee => selectedTrainees.some(selectedTrainee => eventPersonMatchesSelection(trainee.name, selectedTrainee)))
            : exportTrainees;
        const exportStaff = useSpecificStaffFilter && selectedStaff.length > 0
            ? allInstructors.filter(instructor => selectedStaff.includes(instructor.name))
            : allInstructors;
        
        // For "events only", return only events with no people records
        if (recordType === 'events') {
            return { events: filteredEvents, trainees: [], staff: [] };
        }

        // For trainee/staff/all records, include ALL people (not just those with events)
        // This matches user expectation: "Trainee records" = all trainees, not just those with events
        
        if (recordType === 'trainees' && canExportTraineeRecords) {
            console.log('📊 Returning filtered trainees:', personFilteredTrainees.length);
            return { events: filteredEvents, trainees: personFilteredTrainees, staff: [] };
        } else if (recordType === 'staff') {
            console.log('📊 Returning filtered staff:', exportStaff.length);
            return { events: filteredEvents, trainees: [], staff: exportStaff };
        } else {
            // recordType === 'all'
            console.log('📊 Returning all permitted people and events');
            return {
                events: filteredEvents,
                trainees: canExportTraineeRecords ? personFilteredTrainees : [],
                staff: selectedCourses.length > 0 && !(useSpecificStaffFilter && selectedStaff.length > 0) ? [] : exportStaff,
            };
        }
    }, [recordType, filteredEvents, allTrainees, allInstructors, canExportTraineeRecords, selectedCourses, selectedTrainees, selectedStaff, useSpecificTraineeFilter, useSpecificStaffFilter]);

    // Calculate record count
    const recordCount = useMemo(() => {
        let count = 0;
        if ((recordType === 'all' || recordType === 'trainees') && canExportTraineeRecords) count += filteredData.trainees.length;
        if (recordType === 'all' || recordType === 'staff') count += filteredData.staff.length;
        if (recordType === 'all' || recordType === 'events') count += filteredData.events.length;
        return count;
    }, [recordType, filteredData, canExportTraineeRecords]);

    // Estimate file size (rough approximation)
    const estimatedSize = useMemo(() => {
        const bytesPerRecord = outputFormat === 'pdf' ? 5000 : outputFormat === 'excel' ? 2000 : 500;
        const totalBytes = recordCount * bytesPerRecord;
        if (totalBytes < 1024) return `${totalBytes} B`;
        if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
        return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }, [recordCount, outputFormat]);

    // Check if export is large
    const isLargeExport = recordCount > 1000;

    // Get time period description
    const getTimePeriodDescription = () => {
        if (timePeriod === 'all-time') return 'All time';
        if (timePeriod === 'single-date' && singleDate) return formatDate(singleDate);
        if (timePeriod === 'date-range' && startDate && endDate) {
            return `${formatDate(startDate)} to ${formatDate(endDate)}`;
        }
        return 'Not specified';
    };

    // Get record type description
    const getRecordTypeDescription = () => {
        if (recordType === 'all') return canExportTraineeRecords ? 'All records (Trainees, Staff, Events)' : 'All records (Staff, Events)';
        if (recordType === 'trainees') return 'Trainee records';
        if (recordType === 'staff') return 'Staff records';
        return 'Event records';
    };

    // Handle export
    const handleExport = async () => {
        console.log('🚀 Starting export...', {
            recordType,
            timePeriod,
            outputFormat,
            recordCount,
            data: filteredData
        });
        
        // Generate filename
        const timestamp = new Date().toISOString().split('T')[0];
        const fileExtension = outputFormat === 'excel' ? 'xlsx' : outputFormat;
        const filename = `training_records_${timestamp}.${fileExtension}`;
        
        try {
            console.log('📄 Export format:', outputFormat);
            
            // Show progress indicator
            setIsExporting(true);
            setExportProgress(0);
            setExportStatus('Preparing export...');
            
            if (outputFormat === 'csv') {
                console.log('📊 Exporting CSV...');
                console.log('📊 Record count:', recordCount);
                setExportStatus('Generating CSV file...');
                exportToCSV(filename);
                console.log('✅ CSV export completed');
            } else if (outputFormat === 'excel') {
                console.log('📊 Exporting Excel...');
                console.log('📊 Record count:', recordCount);
                setExportStatus('Generating Excel file...');
                exportToExcel(filename);
                console.log('✅ Excel export completed');
            } else if (outputFormat === 'pdf') {
                console.log('📄 Exporting PDF...');
                console.log('📄 Record count:', recordCount);
                console.log('📄 Events to export:', filteredData.events.length);
                setExportStatus(`Generating PDF (${filteredData.events.length} records)...`);
                await exportToPDF(filename);
                console.log('✅ PDF export completed');
            }
            
            // Hide progress and show success message
            setIsExporting(false);
            console.log('✅ Showing success message');
            setShowExportSuccess(true);
            setTimeout(() => setShowExportSuccess(false), 5000);
        } catch (error) {
            console.error('❌ Export error:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            setIsExporting(false);
            setShowExportError(true);
            setTimeout(() => setShowExportError(false), 5000);
        }
    };
    
    const exportToCSV = (filename: string) => {
        let csvContent = '';
        
        // Add Events
        if (recordType === 'all' || recordType === 'events') {
            csvContent += 'EVENTS\n';
            csvContent += 'Date,Type,Instructor,Student,Flight Number,Duration,Start Time,Resource\n';
            filteredData.events.forEach(e => {
                csvContent += `${e.date},${e.type},${e.instructor || ''},${e.student || e.pilot || ''},${e.flightNumber || ''},${e.duration || ''},${e.startTime || ''},${e.resourceId || ''}\n`;
            });
            csvContent += '\n';
        }
        
        // Add Trainees
        if ((recordType === 'all' || recordType === 'trainees') && canExportTraineeRecords) {
            csvContent += 'TRAINEES\n';
            csvContent += 'Name,Rank,Course,Service,Unit,Flight\n';
            filteredData.trainees.forEach(t => {
                csvContent += `${t.name},${t.rank},${t.course},${t.service},${t.unit},${t.flight}\n`;
            });
            csvContent += '\n';
        }
        
        // Add Staff
        if (recordType === 'all' || recordType === 'staff') {
            csvContent += 'STAFF\n';
            csvContent += 'Name,Rank,Role,Category,Service\n';
            filteredData.staff.forEach(s => {
                csvContent += `${s.name},${s.rank},${s.role},${s.category || ''},${s.service}\n`;
            });
        }
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };
    
    const exportToExcel = (filename: string) => {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Add Events sheet
        if (recordType === 'all' || recordType === 'events') {
            const eventsData = filteredData.events.map(e => ({
                'Date': e.date || '',
                'Type': e.type || '',
                'Instructor': e.instructor || '',
                'Student': e.student || e.pilot || '',
                'Flight Number': e.flightNumber || '',
                'Duration (hrs)': e.duration || 0,
                'Start Time': e.startTime || '',
                'Resource': e.resourceId || ''
            }));
            
            const wsEvents = XLSX.utils.json_to_sheet(eventsData);
            XLSX.utils.book_append_sheet(wb, wsEvents, 'Events');
        }
        
        // Add Trainees sheet
        if ((recordType === 'all' || recordType === 'trainees') && canExportTraineeRecords) {
            const traineesData = filteredData.trainees.map(t => ({
                'Name': t.name || '',
                'Rank': t.rank || '',
                'Course': t.course || '',
                'Service': t.service || '',
                'Unit': t.unit || '',
                'Flight': t.flight || '',
                'Status': getTraineeStatusLabel(t)
            }));
            
            const wsTrainees = XLSX.utils.json_to_sheet(traineesData);
            XLSX.utils.book_append_sheet(wb, wsTrainees, 'Trainees');
        }
        
        // Add Staff sheet
        if (recordType === 'all' || recordType === 'staff') {
            const staffData = filteredData.staff.map(s => ({
                'Name': s.name || '',
                'Rank': s.rank || '',
                'Role': s.role || '',
                'Category': s.category || '',
                'Service': s.service || '',
                'Status': s.isPaused ? 'Archived' : 'Active'
            }));
            
            const wsStaff = XLSX.utils.json_to_sheet(staffData);
            XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff');
        }
        
        // Write and download file
        XLSX.writeFile(wb, filename);
    };
    
    const exportToPDF = async (filename: string) => {
        console.log('📄 exportToPDF called with filename:', filename);
        
        // Generate configured training report forms for each event
        const eventsToExport = filteredData.events;
        console.log('📄 Events to export:', eventsToExport.length);
        
        if (eventsToExport.length === 0) {
            console.log('❌ No events to export');
            throw new Error('No events to export');
        }
        
        console.log('📄 Creating PDF document...');
        const pdf = new jsPDF('p', 'mm', 'a4');
        let isFirstPage = true;
        
        try {
            console.log('📄 Starting to process events...');
            for (let i = 0; i < eventsToExport.length; i++) {
                const event = eventsToExport[i];
                const progress = Math.round(((i + 1) / eventsToExport.length) * 100);
                setExportProgress(progress);
                setExportStatus(`Processing record ${i + 1} of ${eventsToExport.length}...`);
                
                console.log(`📄 Processing event ${i + 1}/${eventsToExport.length}:`, event.flightNumber);
                
                if (!isFirstPage) {
                    pdf.addPage();
                }
                
                // Render the training report form using native PDF text
                renderPT051ToPDF(pdf, event);
                
                console.log(`✅ ${exportReportName} added to PDF`);
                isFirstPage = false;
            }
            
            // Download the PDF
            setExportStatus('Finalizing PDF...');
            console.log('📄 Saving PDF:', filename);
            pdf.save(filename);
            console.log('✅ PDF saved successfully!');
            
        } catch (error) {
            console.error('❌ Error during PDF generation:', error);
            throw error;
        }
    };
    
    // Helper function to parse saved report comments into configured sections.
    const parseComments = (raw: string | undefined) => {
        const defaults: Record<ExportCommentSectionKey, string> = {
            assessor: '',
            weather: '',
            profile: '',
            overall: '',
            nest: '',
        };
        if (!raw) return defaults;

        const makeLabels = (...labels: Array<string | undefined>) => {
            const seen = new Set<string>();
            return labels
                .map(label => String(label || '').trim())
                .filter(Boolean)
                .filter(label => {
                    const key = label.toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
        };

        const sectionConfigs: Array<{ key: ExportCommentSectionKey; labels: string[] }> = [
            {
                key: 'assessor',
                labels: makeLabels(
                    exportCommentFieldLabels.assessor,
                    exportAssessorLabel,
                    instructorLabel,
                    'QFI',
                    'Instructor',
                    'Report Instructor',
                    'Assessor',
                ),
            },
            { key: 'weather', labels: makeLabels(exportCommentFieldLabels.weather, 'Weather') },
            { key: 'profile', labels: makeLabels(exportCommentFieldLabels.profile, 'Profile') },
            { key: 'overall', labels: makeLabels(exportCommentFieldLabels.overall, 'Overall') },
            { key: 'nest', labels: makeLabels(exportCommentFieldLabels.nest, 'NEST') },
        ];

        const labelToKey = new Map<string, ExportCommentSectionKey>();
        sectionConfigs.forEach(section => {
            section.labels.forEach(label => labelToKey.set(label.toLowerCase(), section.key));
        });

        const allLabels = sectionConfigs.flatMap(section => section.labels);
        if (allLabels.length === 0) return { ...defaults, overall: raw.trim() };

        const markerRegex = new RegExp(`(^|\\n)\\s*(${allLabels.map(escapeRegExp).join('|')})\\s*:`, 'gi');
        const markers: Array<{ key: ExportCommentSectionKey; start: number; contentStart: number }> = [];
        let match: RegExpExecArray | null;

        while ((match = markerRegex.exec(raw)) !== null) {
            const label = String(match[2] || '').toLowerCase();
            const key = labelToKey.get(label);
            if (!key) continue;
            markers.push({
                key,
                start: match.index,
                contentStart: match.index + match[0].length,
            });
        }

        if (markers.length === 0) return { ...defaults, overall: raw.trim() };

        return markers.reduce((result, marker, index) => {
            const nextMarker = markers[index + 1];
            const content = raw
                .slice(marker.contentStart, nextMarker ? nextMarker.start : raw.length)
                .trim();
            return {
                ...result,
                [marker.key]: content,
            };
        }, { ...defaults });
    };
    
    const renderPT051ToPDF = (pdf: jsPDF, event: ScheduleEvent) => {
        const trainee = allTrainees.find(t => t.fullName === event.student || t.fullName === event.pilot);
        const instructor = allInstructors.find(i => i.name === event.instructor);
        
        // Format date as dd Mmm YY (e.g., "31 Dec 25")
        const formatDate = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const year = date.getFullYear().toString().slice(-2);
            return `${day} ${month} ${year}`;
        };
        
        const reportExportValues = getTrainingReportExportValues(event);
        const { missionStatus, overallGrade, comments } = reportExportValues;
        
        // Parse comments into sections
        const commentSections = parseComments(comments);
        
        let y = 15;
        const margin = 15;
        const pageWidth = 210;
        const contentWidth = pageWidth - (2 * margin);
        
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(exportAssessmentTitle, pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 8;
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        const col1X = margin;
        const col2X = pageWidth / 2 + 5;
        const assessorValueOffset = Math.min(45, Math.max(20, exportAssessorLabel.length * 2.1));
        const drawLabelValue = (
            label: string,
            value: string,
            x: number,
            valueX: number,
            rowY: number,
            maxWidth: number,
        ): number => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${label}:`, x, rowY);
            pdf.setFont('helvetica', 'normal');
            const lines = pdf.splitTextToSize(value || 'N/A', maxWidth);
            pdf.text(lines, valueX, rowY);
            return Math.max(6, lines.length * 4 + 2);
        };
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Trainee:', col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${trainee?.rank || ''} ${trainee?.name || event.student || event.pilot || 'N/A'}`, col1X + 20, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Course:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(trainee?.course || 'N/A', col2X + 20, y);
        y += 5;
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportAssessorLabel}:`, col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${instructor?.rank || ''} ${instructor?.name || event.instructor || 'N/A'}`, col1X + assessorValueOffset, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Date:', col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(formatDate(event.date), col2X + 20, y);
        y += 5;
        
        const syllabusDetail = findSyllabusDetailForEventNumber(event.flightNumber);
        const assessmentStructure = buildExportAssessmentStructure(syllabusDetail?.assessedElements, phraseBank);
        const flightDesc = syllabusDetail?.eventDescription || syllabusDetail?.title || syllabusDetail?.description || '';

        const eventNumberRowHeight = Math.max(
            drawLabelValue('Event Number', event.flightNumber || 'N/A', col1X, col1X + 34, y, 55),
            drawLabelValue('Duration', event.duration ? `${event.duration.toFixed(1)} hrs` : 'N/A', col2X, col2X + 26, y, 45),
        );
        y += eventNumberRowHeight;
        pdf.setFontSize(8);
        y += drawLabelValue('Event Description', flightDesc || 'N/A', col1X, col1X + 34, y, contentWidth - 36);
        pdf.setFontSize(9);
        y += 8;
        
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y - 4, contentWidth, 10, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, y - 4, contentWidth, 10, 'S');
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportOverallFieldLabels.overallGrade || 'Overall Grade'}:`, col1X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(overallGrade, col1X + 30, y);
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportOverallFieldLabels.result || 'Mission Status'}:`, col2X, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(missionStatus, col2X + 34, y);
        y += 12;
        
        // Add configured comment boxes with compact layout
        pdf.setFontSize(8);
        const boxHeight = 12;
        const boxY = y;
        
        // Weather and Profile on same row
        const weatherProfileWidth = contentWidth * 0.4;
        
        // Weather box (left)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, boxY, weatherProfileWidth - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, boxY, weatherProfileWidth - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${exportCommentFieldLabels.weather || 'Weather'}:`, margin + 2, boxY + 4);
        pdf.setFont('helvetica', 'normal');
        const weatherText = pdf.splitTextToSize(commentSections.weather || 'N/A', weatherProfileWidth - 6);
        pdf.text(weatherText, margin + 2, boxY + 8);
        
        // Profile box (middle)
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin + weatherProfileWidth, boxY, weatherProfileWidth - 2, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin + weatherProfileWidth, boxY, weatherProfileWidth - 2, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportCommentFieldLabels.profile || 'Profile'}:`, margin + weatherProfileWidth + 2, boxY + 4);
        pdf.setFont('helvetica', 'normal');
        const profileText = pdf.splitTextToSize(commentSections.profile || 'N/A', weatherProfileWidth - 6);
        pdf.text(profileText, margin + weatherProfileWidth + 2, boxY + 8);
        
        // Configured right-hand comment box
        const nestWidth = contentWidth * 0.2;
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin + weatherProfileWidth * 2, boxY, nestWidth, boxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin + weatherProfileWidth * 2, boxY, nestWidth, boxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportCommentFieldLabels.nest || 'NEST'}:`, margin + weatherProfileWidth * 2 + 2, boxY + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.text(commentSections.nest || 'N/A', margin + weatherProfileWidth * 2 + 2, boxY + 8);
        
        y += boxHeight + 4;
        
        // Overall comment box (full width)
        const overallBoxHeight = 16;
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y, contentWidth, overallBoxHeight, 'F');
        pdf.setDrawColor(0);
        pdf.rect(margin, y, contentWidth, overallBoxHeight, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${exportCommentFieldLabels.overall || 'Overall'}:`, margin + 2, y + 4);
        pdf.setFont('helvetica', 'normal');
        const overallText = pdf.splitTextToSize(commentSections.overall || 'N/A', contentWidth - 4);
        pdf.text(overallText, margin + 2, y + 8);
        
        y += overallBoxHeight + 4;
        
        pdf.setFillColor(31, 41, 55);
        pdf.rect(margin, y - 4, contentWidth, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('Category / Element', margin + 2, y);
        pdf.text('Grade', margin + 80, y);
        pdf.text('Comments', margin + 100, y);
        y += 5;
        
        pdf.setTextColor(0, 0, 0);
        
        // Grade color mapping (matching Performance History page)
        const gradeColors: {[key: string]: [number, number, number]} = {
            '0': [220, 38, 38],   // Red
            '1': [234, 88, 12],   // Orange-red
            '2': [245, 158, 11],  // Orange
            '3': [234, 179, 8],   // Yellow
            '4': [132, 204, 22],  // Light green
            '5': [34, 197, 94]    // Green
        };
        
        pdf.setFontSize(7);
        assessmentStructure.forEach(cat => {
            pdf.setFillColor(229, 231, 235);
            pdf.rect(margin, y - 3, contentWidth, 5, 'F');
            pdf.setDrawColor(156, 163, 175);
            pdf.rect(margin, y - 3, contentWidth, 5, 'S');
            pdf.setFont('helvetica', 'bold');
            pdf.text(cat.category, margin + 2, y);
            y += 5;
            
            pdf.setFont('helvetica', 'normal');
            cat.elements.forEach(elem => {
                // Draw element row border
                pdf.setDrawColor(209, 213, 219);
                pdf.rect(margin, y - 3, contentWidth, 5, 'S');
                
                // Element name
                pdf.text('  ' + elem, margin + 2, y);
                
                // Grade cell with color background
                const grade = '3'; // Placeholder grade used only for the export preview row.
                const gradeColor = gradeColors[grade] || [243, 244, 246];
                
                // Draw colored grade cell
                pdf.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
                pdf.rect(margin + 78, y - 3, 15, 5, 'F');
                pdf.setDrawColor(209, 213, 219);
                pdf.rect(margin + 78, y - 3, 15, 5, 'S');
                
                // Draw grade text
                pdf.setTextColor(255, 255, 255); // White text on colored background
                pdf.text(grade, margin + 84, y);
                pdf.setTextColor(0, 0, 0); // Reset to black
                
                // Comments
                pdf.text('-', margin + 102, y);
                y += 5;
            });
        });
        
        };
    
    const renderPT051ForEvent = (event: ScheduleEvent): string => {
        const trainee = allTrainees.find(t => t.fullName === event.student || t.fullName === event.pilot);
        const instructor = allInstructors.find(i => i.name === event.instructor);
        
        const { missionStatus, overallGrade, comments } = getTrainingReportExportValues(event);
        const syllabusDetail = findSyllabusDetailForEventNumber(event.flightNumber);
        const assessmentStructure = buildExportAssessmentStructure(syllabusDetail?.assessedElements, phraseBank);
        
        const gradeColors: {[key: string]: string} = {
            '0': '#dc2626', '1': '#ea580c', '2': '#f59e0b', 
            '3': '#eab308', '4': '#84cc16', '5': '#22c55e'
        };
        
        return `
            <div style="font-family: Arial, sans-serif; padding: 10px; background: white; color: black; font-size: 9px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid black; padding-bottom: 5px;">
                    <h1 style="margin: 0; font-size: 16px; font-weight: bold;">${escapeHtml(exportAssessmentTitle)}</h1>
                </div>
                
                <!-- Info Grid - Compact 2-column layout -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; border: 1px solid black; padding: 6px; background: #f9fafb;">
                    <div><strong>Trainee:</strong> ${trainee?.rank || ''} ${trainee?.name || event.student || event.pilot || 'N/A'}</div>
                    <div><strong>Course:</strong> ${trainee?.course || 'N/A'}</div>
                    <div><strong>${escapeHtml(exportAssessorLabel)}:</strong> ${instructor?.rank || ''} ${instructor?.name || event.instructor || 'N/A'}</div>
                    <div><strong>Date:</strong> ${formatDate(event.date) || 'N/A'}</div>
                    <div><strong>Flight:</strong> ${event.flightNumber || 'N/A'}</div>
                    <div><strong>Duration:</strong> ${event.duration ? event.duration.toFixed(1) + ' hrs' : 'N/A'}</div>
                </div>
                
                <!-- Overall Assessment -->
                <div style="border: 1px solid black; padding: 6px; margin-bottom: 8px; background: #f3f4f6;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div><strong>${escapeHtml(exportOverallFieldLabels.overallGrade || 'Overall Grade')}:</strong> ${escapeHtml(overallGrade)}</div>
                        <div><strong>${escapeHtml(exportOverallFieldLabels.result || 'Mission Status')}:</strong> ${escapeHtml(missionStatus)}</div>
                    </div>
                </div>
                
                <!-- Assessment Grid - Compact layout -->
                <div style="border: 1px solid black; margin-bottom: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 8px;">
                        <thead>
                            <tr style="background: #1f2937; color: white;">
                                <th style="border: 1px solid #374151; padding: 4px; text-align: left; width: 30%;">Category / Element</th>
                                <th style="border: 1px solid #374151; padding: 4px; text-align: center; width: 10%;">Grade</th>
                                <th style="border: 1px solid #374151; padding: 4px; text-align: left;">Comments</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assessmentStructure.map(cat => `
                                <tr style="background: #e5e7eb;">
                                    <td colspan="3" style="border: 1px solid #9ca3af; padding: 3px; font-weight: bold;">${cat.category}</td>
                                </tr>
                                ${cat.elements.map(elem => `
                                    <tr>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; padding-left: 12px;">${elem}</td>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; text-align: center; background: ${gradeColors['3'] || '#f3f4f6'};">3</td>
                                        <td style="border: 1px solid #d1d5db; padding: 3px; font-size: 7px;">-</td>
                                    </tr>
                                `).join('')}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <!-- Comments Section - Compact -->
                <div style="border: 1px solid black; padding: 6px;">
                    <div style="margin-bottom: 4px;"><strong>${escapeHtml(exportAssessorLabel)} Comments:</strong></div>
                    <div style="border: 1px solid #d1d5db; padding: 4px; min-height: 30px; background: #f9fafb; font-size: 8px;">
                        ${escapeHtml(comments || 'No comments provided')}
                    </div>
                </div>
            </div>
        `;
    };
    
    

    // Handle save template
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            await showDarkAlert('Please enter a template name.', 'Save Export Template', 'warning');
            return;
        }

        const template: ExportTemplate = {
            name: templateName,
            recordType,
            timePeriod,
            singleDate,
            startDate,
            endDate,
            outputFormat,
            selectedTrainees,
            selectedStaff,
            useSpecificTraineeFilter,
            useSpecificStaffFilter,
            selectedCourses,
            selectedEventTypes,
            statusFilter,
            remedialFilter
        };

        setSavedTemplates([...savedTemplates, template]);
        setTemplateName('');
        await showDarkAlert(`Template "${template.name}" saved successfully.`, 'Export Template Saved', 'success');
    };

    // Handle load template
    const handleLoadTemplate = (template: ExportTemplate) => {
        setRecordType(template.recordType);
        setTimePeriod(template.timePeriod);
        setSingleDate(template.singleDate);
        setStartDate(template.startDate);
        setEndDate(template.endDate);
        setOutputFormat(template.outputFormat);
        setSelectedTrainees(template.selectedTrainees);
        setSelectedStaff(template.selectedStaff);
        setUseSpecificTraineeFilter(Boolean(template.useSpecificTraineeFilter));
        setUseSpecificStaffFilter(Boolean(template.useSpecificStaffFilter));
        setSelectedCourses(template.selectedCourses);
        setSelectedEventTypes(template.selectedEventTypes);
        setStatusFilter(template.statusFilter);
        setRemedialFilter(template.remedialFilter);
        setShowTemplates(false);
    };

    // Handle mass completion
    const handleMassComplete = () => {
        const scheduledTrainees = getScheduledTraineesForCompletion;
        setSelectedForCompletion(scheduledTrainees);
        setShowMassComplete(true);
    };

    // Process mass completion
    const processMassCompletion = async () => {
        if (selectedForCompletion.length === 0) {
            await showDarkAlert('Please select at least one trainee for completion.', 'Mass Completion', 'warning');
            return;
        }

        setIsCompleting(true);
        setCompletionProgress(0);
        setCompletionStatus('Processing trainees...');

        try {
            const currentDate = new Date().toISOString().split('T')[0];
            let completedCount = 0;

            for (let i = 0; i < selectedForCompletion.length; i++) {
                const traineeName = selectedForCompletion[i];
                const trainee = allTrainees.find(t => t.name === traineeName);
                
                if (!trainee) continue;

                // Find events for this trainee in the selected courses and date range
                let eventsInDateRange = allEvents;
                if (timePeriod === 'single-date' && singleDate) {
                    eventsInDateRange = eventsInDateRange.filter(e => e.date === singleDate);
                } else if (timePeriod === 'date-range' && startDate && endDate) {
                    eventsInDateRange = eventsInDateRange.filter(e => e.date >= startDate && e.date <= endDate);
                }

                const traineeEvents = eventsInDateRange.filter(e => {
                    const studentName = e.student || e.pilot;
                    if (!studentName) return false;
                    return studentName === traineeName || 
                           studentName.startsWith(traineeName + ' –') || 
                           studentName.startsWith(traineeName + ' -');
                });

                // Create or update the saved training report assessment for each event.
                for (const event of traineeEvents) {
                    const assessmentId = `${trainee.name}_${event.id}_PT051`;
                    let assessment = pt051Assessments.get(assessmentId);

                    if (!assessment) {
                        // Create new assessment
                        assessment = {
                            id: assessmentId,
                            traineeFullName: trainee.name,
                            eventId: event.id,
                            flightNumber: event.flightNumber,
                            date: event.date,
                            instructorName: event.instructor || '',
                            overallGrade: 'No Grade' as any,
                            overallResult: 'P',
                            dcoResult: 'DCO',
                            overallComments: '',
                            scores: [],
                            isCompleted: true,
                            groundSchoolAssessment: { isAssessment: false, result: undefined }
                        };
                    } else {
                        // Update existing assessment
                        assessment = {
                            ...assessment,
                            dcoResult: 'DCO',
                            overallGrade: 'No Grade' as any,
                            overallResult: 'P',
                            isCompleted: true
                        };
                    }

                    onSavePT051Assessment(assessment);
                }

                completedCount++;
                setCompletionProgress(Math.round((i + 1) / selectedForCompletion.length * 100));
                setCompletionStatus(`Completed ${completedCount} of ${selectedForCompletion.length} trainees...`);
            }

            setCompletionStatus(`Successfully completed ${completedCount} trainees!`);
            setTimeout(() => {
                setShowMassComplete(false);
                setSelectedForCompletion([]);
            }, 2000);

        } catch (error) {
            console.error('Error during mass completion:', error);
            setCompletionStatus('Error occurred during completion. Please try again.');
        } finally {
            setIsCompleting(false);
        }
    };

    return (
        <div className="h-full overflow-auto bg-gray-900 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h1 className="text-2xl font-bold text-white mb-2">Export Training Records</h1>
                    <p className="text-gray-400">
                        Export {exportReportName} training records for printing or official record keeping.
                        Select your options below and preview before exporting.
                    </p>
                </div>

                {/* Question 1: What records? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What records do you want to export?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'all'}
                                onChange={() => setRecordType('all')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">
                                {canExportTraineeRecords ? 'All records (Trainees, Staff, and Events)' : 'All records (Staff and Events)'}
                            </span>
                        </label>
                        {canExportTraineeRecords && (
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={recordType === 'trainees'}
                                    onChange={() => setRecordType('trainees')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Trainee records only</span>
                            </label>
                        )}
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'staff'}
                                onChange={() => setRecordType('staff')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Staff records only</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'events'}
                                onChange={() => setRecordType('events')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Event records only</span>
                        </label>
                    </div>
                </div>

                {/* Question 2: Time period? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">For what period?</h2>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={timePeriod === 'all-time'}
                                onChange={() => setTimePeriod('all-time')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">All time</span>
                        </label>
                        
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'single-date'}
                                    onChange={() => setTimePeriod('single-date')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Single date</span>
                            </label>
                            {timePeriod === 'single-date' && (
                                <input
                                    type="date"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                    className="ml-7 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                />
                            )}
                        </div>

                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'date-range'}
                                    onChange={() => setTimePeriod('date-range')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Date range</span>
                            </label>
                            {timePeriod === 'date-range' && (
                                <div className="ml-7 flex items-center space-x-3">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="Start date"
                                    />
                                    <span className="text-gray-400">to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="End date"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Question 3: Output format */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What format?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'pdf'}
                                onChange={() => setOutputFormat('pdf')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">PDF (recommended for printing and filing)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'excel'}
                                onChange={() => setOutputFormat('excel')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Excel (for further analysis)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'csv'}
                                onChange={() => setOutputFormat('csv')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">CSV (for data import)</span>
                        </label>
                    </div>
                </div>

                {/* Optional filters */}
                <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full p-6 flex items-center justify-between text-left"
                    >
                        <h2 className="text-lg font-semibold text-white">
                            Do you want to narrow it down? <span className="text-gray-500 text-sm font-normal">(optional)</span>
                        </h2>
                        <span className="text-gray-400">{showFilters ? '▼' : '▶'}</span>
                    </button>
                    
                    {showFilters && (
                        <div className="px-6 pb-6 space-y-6 border-t border-gray-700 pt-6">
                            {/* Event types */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Event Types</h3>
                                <div className="space-y-3">
                                    {/* All checkbox */}
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedEventTypes.length === 4}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedEventTypes(['Flight', 'FTD', 'CPT', 'Ground']);
                                                } else {
                                                    setSelectedEventTypes([]);
                                                }
                                            }}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200 font-medium">All</span>
                                    </label>
                                    
                                    {/* Individual event type checkboxes */}
                                    <div className="grid grid-cols-2 gap-3 pl-6">
                                        {(['Flight', 'FTD', 'CPT', 'Ground'] as EventType[]).map(type => (
                                            <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEventTypes.includes(type)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedEventTypes([...selectedEventTypes, type]);
                                                        } else {
                                                            setSelectedEventTypes(selectedEventTypes.filter(t => t !== type));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-sky-500"
                                                />
                                                <span className="text-gray-200">{getEventTypeLabel(type)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Status ({exportReportName} Outcome)</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'all'}
                                            onChange={() => setStatusFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    {activeStatusCompletionOptions.map(option => (
                                        <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={statusFilter === option.value}
                                                onChange={() => setStatusFilter(option.value)}
                                                className="w-4 h-4 text-sky-500"
                                            />
                                            <span className="text-gray-200">{option.label}</span>
                                        </label>
                                    ))}
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'pass'}
                                            onChange={() => setStatusFilter('pass')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">{activeTrainingReportTemplate.overallResults.passLabel || 'Satisfactory'}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'fail'}
                                            onChange={() => setStatusFilter('fail')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">{activeTrainingReportTemplate.overallResults.failLabel || 'Unsatisfactory'}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Remedial */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Remedial</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'all'}
                                            onChange={() => setRemedialFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'yes'}
                                            onChange={() => setRemedialFilter('yes')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Remedial only</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'no'}
                                            onChange={() => setRemedialFilter('no')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Non-remedial only</span>
                                    </label>
                                </div>
                            </div>

                            {/* Courses */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Courses (Active & Archived)</h3>
                                <input
                                    type="text"
                                    placeholder="Search courses..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                    className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                />
                                <select
                                    multiple
                                    value={selectedCourses.length > 0 ? selectedCourses : [ALL_COURSES_FILTER_VALUE]}
                                    onChange={(e) => {
                                        const options = Array.from(e.target.selectedOptions, option => option.value);
                                        if (options.includes(ALL_COURSES_FILTER_VALUE)) {
                                            setSelectedCourses([]);
                                            return;
                                        }
                                        setSelectedCourses(options);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    size={5}
                                >
                                    {(!courseSearch.trim() || 'all courses'.includes(courseSearch.trim().toLowerCase())) && (
                                        <option value={ALL_COURSES_FILTER_VALUE}>All courses</option>
                                    )}
                                    {filteredCourses.map(courseName => (
                                        <option key={courseName} value={courseName}>
                                            {courseName} {archivedCourses[courseName] ? '(Archived)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>

                            {/* Specific trainees */}
                            {canExportTraineeRecords && (recordType === 'all' || recordType === 'trainees') && (
                                <div>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-medium text-gray-300">Specific Trainees (Active & Archived)</h3>
                                        <label className="flex items-center gap-2 text-xs font-medium text-gray-200">
                                            <input
                                                type="checkbox"
                                                checked={useSpecificTraineeFilter}
                                                onChange={(event) => setUseSpecificTraineeFilter(event.target.checked)}
                                                className="h-4 w-4 text-sky-500"
                                            />
                                            Only selected trainee records
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search trainees..."
                                        value={traineeSearch}
                                        onChange={(e) => setTraineeSearch(e.target.value)}
                                        className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                    />
                                    <select
                                        multiple
                                        value={selectedTrainees}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedTrainees(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {filteredTrainees.map(trainee => (
                                            <option key={trainee.name} value={trainee.name}>
                                                {trainee.rank} {trainee.name} ({trainee.course}) {trainee.isPaused ? `(${getTraineeStatusLabel(trainee)})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}

                            {/* Specific staff */}
                            {(recordType === 'all' || recordType === 'staff') && (
                                <div>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-medium text-gray-300">Specific Staff (Active & Archived)</h3>
                                        <label className="flex items-center gap-2 text-xs font-medium text-gray-200">
                                            <input
                                                type="checkbox"
                                                checked={useSpecificStaffFilter}
                                                onChange={(event) => setUseSpecificStaffFilter(event.target.checked)}
                                                className="h-4 w-4 text-sky-500"
                                            />
                                            Only selected staff records
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={staffSearch}
                                        onChange={(e) => setStaffSearch(e.target.value)}
                                        className="w-full px-3 py-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                    />
                                    <select
                                        multiple
                                        value={selectedStaff}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedStaff(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {filteredStaff.map(instructor => (
                                            <option key={instructor.name} value={instructor.name}>
                                                {instructor.rank} {instructor.name} {instructor.isPaused ? '(Archived)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Export Summary */}
                <div className="bg-sky-900/30 rounded-lg p-6 border border-sky-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Export Summary</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-400">Record Type:</span>
                            <p className="text-white font-medium">{getRecordTypeDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Time Period:</span>
                            <p className="text-white font-medium">{getTimePeriodDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Output Format:</span>
                            <p className="text-white font-medium">{outputFormat.toUpperCase()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Estimated Size:</span>
                            <p className="text-white font-medium">{estimatedSize}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-sky-700">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-white">Total Records:</span>
                            <span className="text-2xl font-bold text-sky-400">{recordCount}</span>
                        </div>
                        {isLargeExport && (
                            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                                <p className="text-yellow-200 text-sm">
                                    ⚠️ Large export ({recordCount} records). This may take a few moments to generate.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Table */}
                {recordCount > 0 && (
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Preview (first 5 records)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Event</th>
                                        <th className="px-4 py-2">Trainee</th>
                                        <th className="px-4 py-2">Instructor</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.events.slice(0, 5).map((event, idx) => (
                                        <tr key={idx} className="border-b border-gray-700">
                                            <td className="px-4 py-2 text-gray-300">{formatDate(event.date)}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.type}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.flightNumber}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.student || event.pilot || '-'}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.instructor || '-'}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    event.isCancelled ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
                                                }`}>
                                                    {event.isCancelled ? 'Cancelled' : 'Completed'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredData.events.length > 5 && (
                                <p className="text-gray-500 text-sm mt-2">
                                    ... and {filteredData.events.length - 5} more records
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleExport}
                                disabled={recordCount === 0}
                                className={`px-6 py-3 rounded font-semibold ${
                                    recordCount === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                                }`}
                            >
                                Export {outputFormat.toUpperCase()}
                            </button>
                            {selectedCourses.length > 0 && (
                                <button
                                    onClick={handleMassComplete}
                                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
                                >
                                    Mark as Complete
                                </button>
                            )}
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
                            >
                                Templates
                            </button>
                        </div>
                        {recordCount === 0 && (
                            <p className="text-yellow-400 text-sm">
                                No records match your criteria. Please adjust your filters.
                            </p>
                        )}
                    </div>

                    {/* Template Management */}
                    {showTemplates && (
                        <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-2">Save Current Settings as Template</h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="Template name"
                                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    />
                                    <button
                                        onClick={handleSaveTemplate}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {savedTemplates.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Saved Templates</h3>
                                    <div className="space-y-2">
                                        {savedTemplates.map((template, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                                                <span className="text-white">{template.name}</span>
                                                <button
                                                    onClick={() => handleLoadTemplate(template)}
                                                    className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm"
                                                >
                                                    Load
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Export Progress Indicator */}
            {isExporting && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
                    <div className="bg-gray-800 border-2 border-sky-500 rounded-lg shadow-2xl p-8 min-w-[500px]">
                        <div className="text-center mb-6">
                            <h3 className="text-sky-400 font-bold text-xl mb-2">Exporting Records...</h3>
                            <p className="text-gray-300 text-base">{exportStatus}</p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div 
                                    className="bg-sky-500 h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-white"
                                    style={{ width: `${exportProgress}%` }}
                                >
                                    {exportProgress > 10 && `${exportProgress}%`}
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-center text-gray-400 text-sm">
                            Please wait... This may take a few moments.
                        </div>
                    </div>
                </div>
            )}
            
            {/* Export Success Message */}
            {showExportSuccess && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 border-2 border-green-500 rounded-lg shadow-2xl p-6 min-w-[400px]">
                    <div className="flex items-start gap-4">
                        <div className="text-green-400 text-3xl">✓</div>
                        <div className="flex-1">
                            <h3 className="text-green-400 font-bold text-lg mb-2">Export Successful!</h3>
                            <p className="text-gray-200 text-base mb-2">
                                Your file has been downloaded successfully.
                            </p>
                            <div className="bg-gray-700/50 rounded p-3 text-sm">
                                <div className="text-gray-300">
                                    <strong>Format:</strong> {outputFormat.toUpperCase()}
                                </div>
                                <div className="text-gray-300">
                                    <strong>Records:</strong> {recordCount}
                                </div>
                                <div className="text-gray-300">
                                    <strong>File:</strong> training_records_{new Date().toISOString().split('T')[0]}.{outputFormat}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Export Error Message */}
            {showExportError && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 border-2 border-red-500 rounded-lg shadow-2xl p-6 min-w-[400px]">
                    <div className="flex items-start gap-4">
                        <div className="text-red-400 text-3xl">✗</div>
                        <div className="flex-1">
                            <h3 className="text-red-400 font-bold text-lg mb-2">Export Failed</h3>
                            <p className="text-gray-200 text-base mb-2">
                                There was an error exporting your data.
                            </p>
                            <p className="text-gray-300 text-sm">
                                Please check the browser console for details and try again.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Mass Completion Modal */}
            {showMassComplete && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
                    <div className="bg-gray-800 border-2 border-green-500 rounded-lg shadow-2xl p-8 min-w-[600px] max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-green-400 font-bold text-xl">Mark Trainees as Complete</h3>
                            <button 
                                onClick={() => setShowMassComplete(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        
                        {isCompleting ? (
                            <div className="text-center">
                                <div className="mb-4">
                                    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                        <div 
                                            className="bg-green-500 h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-white"
                                            style={{ width: `${completionProgress}%` }}
                                        >
                                            {completionProgress > 10 && `${completionProgress}%`}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-gray-300 text-base">{completionStatus}</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-300 mb-4">
                                    Select trainees to mark as {exportCompletedStatusLabel.toLowerCase()}. This will update their {exportReportName} assessments with {exportCompletedStatusLabel}.
                                </p>
                                
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-300">
                                            Trainees for Completion ({selectedForCompletion.length} selected)
                                        </label>
                                        <div className="space-x-2">
                                            <button
                                                onClick={() => setSelectedForCompletion(getScheduledTraineesForCompletion)}
                                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => setSelectedForCompletion([])}
                                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-700/50">
                                        {getScheduledTraineesForCompletion.map(traineeName => {
                                            const trainee = allTrainees.find(t => t.name === traineeName);
                                            return (
                                                <label key={traineeName} className="flex items-center space-x-2 p-2 hover:bg-gray-600/30 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedForCompletion.includes(traineeName)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedForCompletion([...selectedForCompletion, traineeName]);
                                                            } else {
                                                                setSelectedForCompletion(selectedForCompletion.filter(name => name !== traineeName));
                                                            }
                                                        }}
                                                        className="h-4 w-4 accent-green-500 bg-gray-600 border-gray-500 rounded"
                                                    />
                                                    <span className="text-sm text-gray-200">
                                                        {trainee?.rank} {traineeName} ({trainee?.course})
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-end space-x-3">
                                    <button
                                        onClick={() => setShowMassComplete(false)}
                                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={processMassCompletion}
                                        disabled={selectedForCompletion.length === 0}
                                        className={`px-4 py-2 rounded font-semibold ${
                                            selectedForCompletion.length === 0
                                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                    >
                                        Complete Selected ({selectedForCompletion.length})
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingRecordsExportView;
