import { useSystemFreeze } from "../hooks/useSystemFreeze";



import React, { useState, useMemo, useEffect } from 'react';
import { Course, Trainee, ScheduleEvent, Score, SyllabusItemDetail, Instructor, LogbookExperience , MasterCurrency, CurrencyRequirement, Pt051Assessment, PhraseBank } from '../types';
import TraineeProfileFlyout from './TraineeProfileFlyout';
import RestoreCourseConfirmation from './RestoreCourseConfirmation';
import FlightInfoFlyout from './FlightInfoFlyout';
import AuditButton from './AuditButton';
import DeleteTraineeConfirmation from './DeleteTraineeConfirmation';
import CourseEditFlyout from './CourseEditFlyout';
import TraineeBulkUploadFlyout from './TraineeBulkUploadFlyout';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { scheduleEventIncludesPersonRecord } from '../utils/scheduleEventPersonnel';
import type { TrainingReportTemplate, TrainingReportTerminology } from '../utils/trainingReportTerminology';
import type { InsertEventTypeConfig } from '../utils/insertEventTypes';
import type { InsertLmpEventRequest } from './TraineeLmpView';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { OperationalModelCode, PlatformConfig } from '../utils/platformConfigService';
import type { StaffQualificationCatalogue } from '../utils/staffQualifications';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { getTraineeStatusLabel, isTraineeSuspended } from '../utils/traineeStatus';
import { buildCompactPersonNameResolver, getPersonStableKey, samePersonRecord } from '../utils/personIdentity';

interface CourseRosterViewProps {
    events: ScheduleEvent[];
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
    onNavigateToHateSheet: (trainee: Trainee) => void;
    onRestoreCourse: (courseNumber: string) => void;
    onUpdateTrainee: (data: Trainee) => void | Promise<void>;
    onAddTrainee: (data: Trainee) => void | Promise<void>;
    onBulkUpdateTrainees?: (trainees: Trainee[]) => void;
    onReplaceTrainees?: (trainees: Trainee[]) => void;
    onUpdateTraineeLMPs?: (updater: (prevLMPs: Map<string, SyllabusItemDetail[]>) => Map<string, SyllabusItemDetail[]>) => void;
    school: string;
    scores: Map<string, Score[]>;
    syllabusDetails: SyllabusItemDetail[];
    onNavigateToSyllabus: (syllabusId: string) => void;
    onNavigateToCurrency: (person: Instructor | Trainee) => void;
    onAddRemedialPackage: (trainee: Trainee) => void;
    onSelectPt051ForEvent?: (trainee: Trainee, assessment: Pt051Assessment) => void;
    onSavePt051Assessment?: (assessment: Pt051Assessment) => void;
    onDeletePt051Assessment?: (assessmentId: string, eventId: string, traineeFullName: string) => void;
    instructorsData?: Instructor[];
    registerDirtyCheck?: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
    phraseBank?: PhraseBank;
    locations: string[];
    units: string[];
    selectedPersonForProfile?: Trainee | null;
    selectedProfileInitialTab?: 'unavailable' | 'currency' | 'logbook' | 'hatesheet' | 'lmp' | null;
    onProfileOpened?: () => void;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    onViewLogbook?: (person: Trainee) => void;
    onDeleteTrainee: (trainee: Trainee) => void;
    onArchiveTrainee?: (trainee: Trainee) => Promise<void> | void;
    onOpenInstructorProfile?: (instructorName: string) => void;
    // New callbacks for course editing
    onUpdateCourseNumber?: (oldCourseNumber: string, newCourseNumber: string) => void;
    onUpdateCourseUnit?: (courseNumber: string, newUnit: string) => void;
    onUpdateCourseLeadership?: (courseNumber: string, leadership: { courseCommander: string; deputyCourseCommander: string }) => void | Promise<void>;
    courses?: Course[];
    onBackcourseTrainee?: (trainee: Trainee, newCourse: string) => void;
    masterCurrencies?: MasterCurrency[];
    currencyRequirements?: CurrencyRequirement[];
    currentUserId?: string;
    currentUserName?: string;
    currentUserRole?: string;
    pt051Assessments?: Map<string, any>;
    pt051PerformanceLoading?: boolean;
    userProfile?: any;
    canViewTraineeProfile?: (trainee: Trainee) => boolean;
    canViewTraineePt051?: (trainee: Trainee) => boolean;
    canEditTraineePt051?: (trainee: Trainee) => boolean;
    canViewTraineeLmp?: (trainee: Trainee) => boolean;
    canAddRemedialPackageForTrainee?: (trainee: Trainee) => boolean;
    onDeleteRemedialItem?: (trainee: Trainee, item: SyllabusItemDetail) => Promise<boolean> | boolean;
    onGeneratePt051ForItem?: (trainee: Trainee, item: SyllabusItemDetail) => void;
    onInsertCustomLmpEvent?: (trainee: Trainee, request: InsertLmpEventRequest) => Promise<boolean> | boolean;
    onUpdateLmpItem?: (trainee: Trainee, originalItem: SyllabusItemDetail, updatedItem: SyllabusItemDetail) => Promise<boolean> | boolean;
    insertEventTypes?: InsertEventTypeConfig[];
    aircraftConfigurations?: AircraftConfigurationDefinition[];
    aircraftCrewComposition?: AircraftCrewComposition;
    onAccessDenied?: (actionLabel: string) => void;
    resourceDisplayNames?: ResourceDisplayNames;
    personnelDisplaySettings?: PersonnelDisplaySettings;
    trainingReportTerminology?: TrainingReportTerminology;
    trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
    platformConfig?: PlatformConfig | null;
    staffQualificationCatalogue?: StaffQualificationCatalogue;
    operationalModel?: OperationalModelCode | string;
    crewPositionTerminology?: CrewPositionTerminology;
}

const generateNewTraineeTemplate = (defaults: Partial<Pick<Trainee, 'course' | 'unit' | 'location' | 'service'>> = {}): Trainee => ({
    idNumber: 0,
    fullName: '', // Will be constructed on save
    name: '',
    rank: '',
    role: 'Trainee',
    course: defaults.course || '',
    seatConfig: 'Normal',
    isPaused: false,
    unit: defaults.unit || '',
    service: defaults.service || '',
    unavailability: [],
    permissions: ['Trainee'],
    preferences: { qualifications: [] },
    traineeCallsign: '',
    location: defaults.location || '',
    secondaryCallsign: '',
    crew: 'N/A',
    priorExperience: {
        day: { p1: 0, p2: 0, dual: 0 },
        night: { p1: 0, p2: 0, dual: 0 },
        total: 0,
        captain: 0,
        instructor: 0,
        instrument: { sim: 0, actual: 0 },
        simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
    }
});

const UNALLOCATED_TRAINEE_COURSE = 'Unallocated';

const CourseRosterView: React.FC<CourseRosterViewProps> = ({
    events,
    traineesData,
    courseColors,
    archivedCourses,
    personnelData,
    onNavigateToHateSheet,
    onRestoreCourse,
    onUpdateTrainee,
    onAddTrainee,
    onBulkUpdateTrainees,
    onReplaceTrainees,
    onUpdateTraineeLMPs,
    school,
    scores,
    syllabusDetails,
    onNavigateToSyllabus,
    onNavigateToCurrency,
    onAddRemedialPackage,
    onSelectPt051ForEvent,
    onSavePt051Assessment,
    onDeletePt051Assessment,
    instructorsData = [],
    registerDirtyCheck,
    phraseBank,
    locations,
    units,
    selectedPersonForProfile,
    selectedProfileInitialTab = null,
    onProfileOpened,
    traineeLMPs,
    onViewLogbook,
    onDeleteTrainee,
    onArchiveTrainee,
    onOpenInstructorProfile,
    onUpdateCourseNumber,
    onUpdateCourseUnit,
    onUpdateCourseLeadership,
    courses = [],
    onBackcourseTrainee,
    masterCurrencies = [],
    currencyRequirements = [],
    currentUserId,
    currentUserName,
    currentUserRole,
    pt051Assessments,
    pt051PerformanceLoading = false,
    userProfile,
    canViewTraineeProfile = () => true,
    canViewTraineePt051 = () => true,
    canEditTraineePt051 = () => true,
    canViewTraineeLmp = () => true,
    canAddRemedialPackageForTrainee = () => true,
    onDeleteRemedialItem,
    onGeneratePt051ForItem,
    onInsertCustomLmpEvent,
    onUpdateLmpItem,
    insertEventTypes,
    aircraftConfigurations = [],
    aircraftCrewComposition,
    onAccessDenied,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    personnelDisplaySettings,
    trainingReportTerminology,
    trainingReportTemplate,
    platformConfig = null,
    staffQualificationCatalogue,
    operationalModel = 'flight_school',
    crewPositionTerminology,
}) => {
    const { isFrozen } = useSystemFreeze();
    const [view, setView] = useState<'active' | 'archived'>('active');
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [profileInitialTab, setProfileInitialTab] = useState<'unavailable' | 'currency' | 'logbook' | 'hatesheet' | 'lmp' | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newTraineeTemplate, setNewTraineeTemplate] = useState<Trainee | null>(null);
    const [courseToRestore, setCourseToRestore] = useState<string | null>(null);
    const [hoveredTrainee, setHoveredTrainee] = useState<{ name: string; events: ScheduleEvent[] } | null>(null);
    const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);

    // Delete Trainee state
    const [selectedTraineeForDeletion, setSelectedTraineeForDeletion] = useState<Trainee | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const normalisedCurrentUserRole = String(currentUserRole || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const canManageTraineeRemoval = normalisedCurrentUserRole === 'ADMIN' || normalisedCurrentUserRole === 'SUPER_ADMIN';

    // Course Edit state
    const [courseToEdit, setCourseToEdit] = useState<string | null>(null);
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    useEffect(() => {
        if (selectedPersonForProfile) {
            if (!canViewTraineeProfile(selectedPersonForProfile)) {
                onAccessDenied?.('trainee profile');
                onProfileOpened?.();
                return;
            }
            setProfileInitialTab(selectedProfileInitialTab);
            setSelectedTrainee(selectedPersonForProfile);
            setIsCreatingNew(false);
            onProfileOpened?.();
        }
    }, [selectedPersonForProfile, selectedProfileInitialTab, onProfileOpened, canViewTraineeProfile, onAccessDenied]);

    const groupedTrainees = useMemo(() => {
        const groups: { [course: string]: Trainee[] } = {};

        traineesData.forEach(trainee => {
            const courseKey = String(trainee.course || '').trim() || UNALLOCATED_TRAINEE_COURSE;
            if (!groups[courseKey]) {
                groups[courseKey] = [];
            }
            groups[courseKey].push(trainee);
        });

        for (const course in groups) {
            groups[course].sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'trainee'));
        }

        return groups;
    }, [traineesData, personnelDisplaySettings]);
    const traineeNameResolver = useMemo(() => buildCompactPersonNameResolver(traineesData as any), [traineesData]);

    // This effect ensures that if the underlying trainee data (like pause status or unavailabilities) changes
    // while the profile flyout is open, the flyout will re-render with the latest data.
    useEffect(() => {
        if (selectedTrainee && !isCreatingNew) {
            const updatedTrainee = traineesData.find((t: Trainee) => samePersonRecord(t as any, selectedTrainee as any));

            if (updatedTrainee) {
                // Compare unavailability content specifically to detect iOS-submitted changes
                const prevUnavailHash = JSON.stringify((selectedTrainee.unavailability || []).map((u: any) => u.id).sort());
                const newUnavailHash  = JSON.stringify((updatedTrainee.unavailability  || []).map((u: any) => u.id).sort());
                const unavailChanged = prevUnavailHash !== newUnavailHash;

                // Also check other key fields
                const otherChanged = updatedTrainee.fullName !== selectedTrainee.fullName ||
                    updatedTrainee.isPaused !== selectedTrainee.isPaused ||
                    updatedTrainee.course !== selectedTrainee.course;

                if (unavailChanged || otherChanged) {
                    // Preserve any locally-edited currencyStatus so a background traineesData refresh
                    // doesn't overwrite currency saves that haven't propagated back to the master array yet.
                    setSelectedTrainee({
                        ...updatedTrainee,
                        currencyStatus: selectedTrainee.currencyStatus ?? updatedTrainee.currencyStatus,
                    });
                }
            }
        }
    }, [traineesData, isCreatingNew]);

    // Show every active course represented by the scoped trainee data, even when the
    // course colour has not been created yet. Blank course allocations remain visible
    // as "Unallocated" so setup wizard imports cannot appear to vanish.
    const activeCourseNumbers = Object.keys(groupedTrainees)
        .sort((a, b) => {
            if (a === UNALLOCATED_TRAINEE_COURSE) return 1;
            if (b === UNALLOCATED_TRAINEE_COURSE) return -1;
            return a.localeCompare(b);
        });
    const archivedCourseNumbers = Object.keys(archivedCourses).sort((a, b) => a.localeCompare(b));

    const coursesToDisplay = view === 'active' ? activeCourseNumbers : archivedCourseNumbers;
    const courseColorMap = view === 'active' ? courseColors : archivedCourses;
    const courseRecordsByName = useMemo(() => {
        const records = new Map<string, Course>();
        courses.forEach((course) => {
            const name = String(course?.name || '').trim();
            if (name) records.set(name, course);
        });
        return records;
    }, [courses]);
    const courseLeadershipEnabled = personnelDisplaySettings?.courseLeadershipEnabled !== false;
    const courseCommanderLabel = personnelDisplaySettings?.courseCommanderLabel?.trim() || 'Cse Commander';
    const deputyCourseCommanderLabel = personnelDisplaySettings?.deputyCourseCommanderLabel?.trim() || 'Deputy Cse Commander';

    const handleConfirmRestore = (courseNumber: string) => {
        onRestoreCourse(courseNumber);
        setCourseToRestore(null);
    };

    const handleAddTraineeClick = () => {
        setNewTraineeTemplate(generateNewTraineeTemplate({
            course: activeCourseNumbers[0] || '',
            unit: units[0] || '',
            location: locations[0] || '',
        }));
        setIsCreatingNew(true);
        setSelectedTrainee(null);
    };

    const handleDeleteTrainee = (trainee: Trainee) => {
        onDeleteTrainee(trainee);
        setShowDeleteConfirmation(false);
        setSelectedTraineeForDeletion(null);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, trainee: Trainee) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const traineeEvents = events.filter(event => scheduleEventIncludesPersonRecord(event, trainee as any, {
            personType: 'trainee',
            allPeople: traineesData as any,
        }));
        setHoveredTrainee({ name: trainee.fullName.split(' – ')[0], events: traineeEvents });
        setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
    };

    const handleMouseLeave = () => {
        setHoveredTrainee(null);
        setFlyoutPosition(null);
    };

    const findSyllabusItemForEventKey = (eventKey: unknown): SyllabusItemDetail | undefined => {
        const normalisedEventKey = String(eventKey || '').trim().toUpperCase();
        if (!normalisedEventKey) return undefined;
        return syllabusDetails.find(item => (
            String(item.id || '').trim().toUpperCase() === normalisedEventKey ||
            String(item.code || '').trim().toUpperCase() === normalisedEventKey
        ));
    };

    const isNormalTrainingFlightOrSim = (eventKey: unknown): boolean => {
        const syllabusItem = findSyllabusItemForEventKey(eventKey);
        return Boolean(
            syllabusItem &&
            (syllabusItem.type === 'Flight' || syllabusItem.type === 'FTD') &&
            !syllabusItem.isRemedial
        );
    };

    const getNumericOverallGrade = (grade: unknown): number | null => {
        if (typeof grade === 'number' && Number.isFinite(grade)) return grade;
        const parsed = Number(String(grade || '').trim());
        return Number.isFinite(parsed) ? parsed : null;
    };

    const getLatestTrainingReportStatus = (trainee: Trainee): { status: 'failed' | 'marginal' | null; hasReports: boolean } => {
        const reports = Array.from(pt051Assessments?.values() || [])
            .filter((assessment: any) => (
                assessment &&
                assessment.isCompleted !== false &&
                (
                    assessment.traineeFullName === trainee.fullName ||
                    assessment.traineeFullName === trainee.name
                )
            ))
            .sort((a: any, b: any) => {
                const dateA = new Date(`${a.date || ''}T00:00:00`).getTime() || 0;
                const dateB = new Date(`${b.date || ''}T00:00:00`).getTime() || 0;
                if (dateA !== dateB) return dateB - dateA;
                return Number(b.startTime || 0) - Number(a.startTime || 0);
            });

        const latestReport = reports[0];
        if (!latestReport) return { status: null, hasReports: false };
        if (latestReport.overallResult === 'F') return { status: 'failed', hasReports: true };
        const overallGrade = getNumericOverallGrade(latestReport.overallGrade);
        if (overallGrade === 0) return { status: 'failed', hasReports: true };
        if (overallGrade === 1) return { status: 'marginal', hasReports: true };
        return { status: null, hasReports: true };
    };

    const getTraineeNameColorClass = (trainee: Trainee): string => {
        // RULE 1: RED + border for suspended trainees.
        if (isTraineeSuspended(trainee)) {
            return 'text-red-400 hover:text-red-300';
        }

        // RULE 2: RED for a failed report, AMBER for a marginal report
        const latestTrainingReportStatus = getLatestTrainingReportStatus(trainee);
        if (latestTrainingReportStatus.status === 'failed') {
            return 'text-red-400 hover:text-red-300';
        }
        if (latestTrainingReportStatus.status === 'marginal') {
            return 'text-amber-400 hover:text-amber-300';
        }
        if (latestTrainingReportStatus.hasReports) {
            return 'text-green-400 hover:text-green-300';
        }

        // RULE 3: Paused trainees are unavailable, not failed.
        if (trainee.isPaused) {
            return 'text-gray-300 hover:text-gray-200';
        }

        // RULE 4: Fall back to legacy score records only when no completed report is available.
        const traineeScores = scores.get(trainee.fullName) || [];

        // Get all non-remedial Flight/FTD scores sorted by date (most recent first)
        const nonRemedialFlightFtdScores = traineeScores
            .filter(score => {
                return isNormalTrainingFlightOrSim(score.event);
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (nonRemedialFlightFtdScores.length > 0) {
            const lastNonRemedialScore = nonRemedialFlightFtdScores[0];

            if (lastNonRemedialScore.score === 0) {
                return 'text-red-400 hover:text-red-300';
            }

            if (lastNonRemedialScore.score === 1) {
                return 'text-amber-400 hover:text-amber-300';
            }
        }

        // RULE 5: GREEN for everyone else (default)
        return 'text-green-400 hover:text-green-300';
    };

    const ViewToggleButton: React.FC<{ label: string; value: 'active' | 'archived' }> = ({ label, value }) => (
        <button
            onClick={() => setView(value)}
            className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${view === value ? 'active' : ''}`}
        >
            {label}
        </button>
    );

    const individualLmpForSelected = selectedTrainee ? traineeLMPs.get(selectedTrainee.fullName) : undefined;

    return (
        <>
            <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-2xl font-bold text-white">Trainee Roster</h1>
                    </div>
                    <div className="flex items-center gap-[1px]">
                        <ViewToggleButton label="Active Courses" value="active" />
                        <button
                            onClick={handleAddTraineeClick}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                        >
                            Add Trainee
                        </button>
                        <button
                            onClick={() => setShowBulkUpload(true)}
                            disabled={!onBulkUpdateTrainees || !onReplaceTrainees}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Upload
                        </button>
                        <div className="w-[5px]"></div>
                        <AuditButton pageName="Trainee Roster" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 pb-16 max-w-[1430px] mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(267px,267px))] gap-6">
                            {coursesToDisplay.map(courseName => {
                                const courseTrainees = groupedTrainees[courseName] || [];
                                const color = courseColorMap[courseName] || 'bg-gray-500';
                                const darkenHexColor = (c: string) => {
                                    if (!c.startsWith('#') || c.length < 7) return c;
                                    const strength = 0.62;
                                    const r = Math.round(parseInt(c.slice(1, 3), 16) * strength);
                                    const g = Math.round(parseInt(c.slice(3, 5), 16) * strength);
                                    const b = Math.round(parseInt(c.slice(5, 7), 16) * strength);
                                    return `rgb(${r}, ${g}, ${b})`;
                                };

                                // Calculate active and paused counts
                                const activeCount = courseTrainees.filter(t => !t.isPaused && !isTraineeSuspended(t)).length;
                                const suspendedCount = courseTrainees.filter(t => isTraineeSuspended(t)).length;
                                const pausedCount = courseTrainees.filter(t => t.isPaused && !isTraineeSuspended(t)).length;

                                const isHexColor = (c: string) => c && (c.startsWith('#') || c.startsWith('rgb'));
                                const courseRecord = courseRecordsByName.get(courseName);
                                return (
                                    <div key={courseName} className="bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden border border-gray-700">
                                        <div
                                            data-course-color="true"
                                            className={`relative px-4 py-2 pr-12 text-white font-bold text-lg ${isHexColor(color) ? '' : color}`}
                                            style={isHexColor(color) ? { backgroundColor: darkenHexColor(color) } : {}}
                                        >
                                            <div>
                                                <div>
                                                    <span>{courseName}</span>
                                                    {courseTrainees.length > 0 && <span className="ml-2 text-xs font-normal opacity-80">{courseTrainees[0].unit}</span>}
                                                </div>
                                                {courseLeadershipEnabled && (
                                                    <div className="mt-1 space-y-1 text-[11px] font-normal leading-tight text-white/85">
                                                        <div>
                                                            <div className="uppercase tracking-wide text-white/60">{courseCommanderLabel}</div>
                                                            <div>{courseRecord?.courseCommander || 'Not assigned'}</div>
                                                        </div>
                                                        <div>
                                                            <div className="uppercase tracking-wide text-white/60">{deputyCourseCommanderLabel}</div>
                                                            <div>{courseRecord?.deputyCourseCommander || 'Not assigned'}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute right-2 top-2 flex items-center gap-1">
                                                {view === 'active' && (
                                                    <button
                                                        onClick={() => !isFrozen && setCourseToEdit(courseName)} disabled={isFrozen}
                                                        className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors group"
                                                        aria-label={`Edit course ${courseName}`}
                                                        title="Edit course"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {view === 'archived' && (
                                                    <button
                                                        onClick={() => setCourseToRestore(courseName)}
                                                        className="p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
                                                        aria-label={`Restore course ${courseName}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-4 py-1 text-right text-xs text-white opacity-70">
                                            {activeCount} active{pausedCount > 0 && `, ${pausedCount} paused`}{suspendedCount > 0 && `, ${suspendedCount} suspended`}
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3">
                                            {courseTrainees.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {courseTrainees.map(trainee => {
                                                        const nameColorClass = getTraineeNameColorClass(trainee);
                                                        const isSuspended = isTraineeSuspended(trainee);
                                                        const statusLabel = getTraineeStatusLabel(trainee);

                                                        return (
                                                            <li
                                                                key={getPersonStableKey(trainee as any, 'trainee')}
                                                                className={`flex items-center text-sm ${isSuspended ? 'rounded border border-red-500/80 bg-red-950/20 px-1 py-0.5' : ''}`}
                                                                onMouseEnter={(e) => handleMouseEnter(e, trainee)}
                                                                onMouseLeave={handleMouseLeave}
                                                            >
                                                                <span className="font-mono text-gray-500 w-16 flex-shrink-0">{trainee.rank}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!canViewTraineeProfile(trainee)) {
                                                                            onAccessDenied?.('trainee profile');
                                                                            return;
                                                                        }
                                                                        setSelectedTrainee(trainee);
                                                                    }}
                                                                    disabled={!canViewTraineeProfile(trainee)}
                                                                    title={canViewTraineeProfile(trainee) ? statusLabel : 'Your permission profile does not allow this trainee profile'}
                                                                    className={`truncate text-left ${nameColorClass} hover:underline focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 ${!canViewTraineeProfile(trainee) ? 'opacity-50 cursor-not-allowed hover:no-underline' : ''}`}
                                                                >
                                                                    {traineeNameResolver.formatList(trainee as any)}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            ) : (
                                                <p className="text-gray-500 text-sm italic text-center py-4">No trainees assigned.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {courseToRestore && (
                <RestoreCourseConfirmation
                    courseNumber={courseToRestore}
                    onConfirm={handleConfirmRestore}
                    onClose={() => setCourseToRestore(null)}
                />
            )}
            {showDeleteConfirmation && (
                <DeleteTraineeConfirmation
                    isOpen={showDeleteConfirmation}
                    onClose={() => {
                        setShowDeleteConfirmation(false);
                        setSelectedTraineeForDeletion(null);
                    }}
                    onConfirm={handleDeleteTrainee}
                    onArchive={onArchiveTrainee}
                    canManageTraineeRemoval={canManageTraineeRemoval}
                    initialTrainee={selectedTraineeForDeletion}
                    traineesData={traineesData}
                    courseColors={courseColors}
                />
            )}
            {(selectedTrainee || isCreatingNew) && (
                <TraineeProfileFlyout
                    trainee={isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!}
                    traineesData={traineesData}
                    onClose={() => {
                        setSelectedTrainee(null);
                        setProfileInitialTab(null);
                        setIsCreatingNew(false);
                        setNewTraineeTemplate(null);
                    }}
                    onUpdateTrainee={isCreatingNew ? onAddTrainee : onUpdateTrainee}
                    onRequestDeleteTrainee={(trainee) => {
                        setSelectedTraineeForDeletion(trainee);
                        setShowDeleteConfirmation(true);
                        setSelectedTrainee(null);
                        setProfileInitialTab(null);
                    }}
                    canManageTraineeRemoval={canManageTraineeRemoval}
                    events={events}
                    school={school}
                    onNavigateToHateSheet={onNavigateToHateSheet}
                    onAddRemedialPackage={onAddRemedialPackage}
                    personnelData={personnelData}
                    courseColors={courseColors}
                    scores={scores}
                    syllabusDetails={syllabusDetails}
                    onNavigateToSyllabus={onNavigateToSyllabus}
                    onNavigateToCurrency={onNavigateToCurrency}
                    locations={locations}
                    units={units}
                    individualLmp={individualLmpForSelected || []}
                    onViewLogbook={onViewLogbook}
                    onOpenInstructorProfile={onOpenInstructorProfile}
                    isCreating={isCreatingNew}
                    activeCourses={activeCourseNumbers}
                    masterCurrencies={masterCurrencies}
                    currencyRequirements={currencyRequirements}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    currentUserRole={currentUserRole}
                    resourceDisplayNames={resourceDisplayNames}
                    personnelDisplaySettings={personnelDisplaySettings}
                    trainingReportTerminology={trainingReportTerminology}
                    platformConfig={platformConfig}
                    staffQualificationCatalogue={staffQualificationCatalogue}
                    operationalModel={operationalModel}
                    crewPositionTerminology={crewPositionTerminology}
                    pt051Assessments={pt051Assessments}
                    pt051PerformanceLoading={pt051PerformanceLoading}
                    traineeLMPs={traineeLMPs}
                    userProfile={userProfile}
                    initialActiveTab={profileInitialTab}
                    canViewPt051={canViewTraineePt051(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canEditPt051={canEditTraineePt051(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canViewIndividualLmp={canViewTraineeLmp(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canAddRemedialPackage={canAddRemedialPackageForTrainee(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    onDeleteRemedialItem={onDeleteRemedialItem}
                    onGeneratePt051ForItem={onGeneratePt051ForItem}
                    onInsertCustomLmpEvent={onInsertCustomLmpEvent}
                    onUpdateLmpItem={onUpdateLmpItem}
                    insertEventTypes={insertEventTypes}
                    aircraftConfigurations={aircraftConfigurations}
                    aircraftCrewComposition={aircraftCrewComposition}
                    onSelectPt051ForEvent={(assessment) => onSelectPt051ForEvent?.(
                        isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!,
                        assessment
                    )}
                    onSavePt051Assessment={onSavePt051Assessment}
                    onDeletePt051Assessment={onDeletePt051Assessment}
                    instructorsData={instructorsData}
                    registerDirtyCheck={registerDirtyCheck}
                    phraseBank={phraseBank}
                    trainingReportTemplate={trainingReportTemplate}
                    onAccessDenied={onAccessDenied}
                />
            )}
            {hoveredTrainee && flyoutPosition && (
                <FlightInfoFlyout
                    events={hoveredTrainee.events}
                    position={flyoutPosition}
                    personName={hoveredTrainee.name}
                    personType="Trainee"
                />
            )}
            {courseToEdit && (
	                <CourseEditFlyout
	                    courseName={courseToEdit}
	                    course={courseRecordsByName.get(courseToEdit)}
	                    courseUnit={groupedTrainees[courseToEdit]?.[0]?.unit || ''}
                    trainees={groupedTrainees[courseToEdit] || []}
                    availableCourses={activeCourseNumbers}
                    availableUnits={units}
                    onClose={() => setCourseToEdit(null)}
                    onUpdateCourseNumber={(oldCourse, newCourse) => {
                        if (onUpdateCourseNumber) {
                            onUpdateCourseNumber(oldCourse, newCourse);
                        }
                        setCourseToEdit(null);
                    }}
	                    onUpdateCourseUnit={(courseNumber, newUnit) => {
	                        if (onUpdateCourseUnit) {
	                            onUpdateCourseUnit(courseNumber, newUnit);
	                        }
	                        setCourseToEdit(null);
	                    }}
		                    onUpdateCourseLeadership={async (courseNumber, leadership) => {
		                        await onUpdateCourseLeadership?.(courseNumber, leadership);
		                        setCourseToEdit(null);
		                    }}
	                    onDeleteTrainee={(trainee) => {
                        onDeleteTrainee(trainee);
                    }}
                    onBackcourseTrainee={(trainee, newCourse) => {
                        if (onBackcourseTrainee) {
                            onBackcourseTrainee(trainee, newCourse);
                        }
                        setCourseToEdit(null);
	                    }}
	                    courseColors={courseColors}
	                    instructorsData={instructorsData}
	                    personnelDisplaySettings={personnelDisplaySettings}
	                />
            )}
            {showBulkUpload && onBulkUpdateTrainees && onReplaceTrainees && (
                <TraineeBulkUploadFlyout
                    onClose={() => setShowBulkUpload(false)}
                    traineesData={traineesData}
                    syllabusDetails={syllabusDetails}
                    courseColors={courseColors}
                    courses={courses}
                    allowedCourses={activeCourseNumbers}
                    onBulkUpdateTrainees={onBulkUpdateTrainees}
                    onReplaceTrainees={onReplaceTrainees}
                    onUpdateTraineeLMPs={onUpdateTraineeLMPs}
                    currentUserRole={currentUserRole}
                />
            )}
        </>
    );
};

export default CourseRosterView;
