import { useSystemFreeze } from "../hooks/useSystemFreeze";



import React, { useState, useMemo, useEffect } from 'react';
import { Trainee, ScheduleEvent, Score, SyllabusItemDetail, Instructor, LogbookExperience , MasterCurrency, CurrencyRequirement, Pt051Assessment } from '../types';
import TraineeProfileFlyout from './TraineeProfileFlyout';
import RestoreCourseConfirmation from './RestoreCourseConfirmation';
import FlightInfoFlyout from './FlightInfoFlyout';
import AuditButton from './AuditButton';
import DeleteTraineeConfirmation from './DeleteTraineeConfirmation';
import CourseEditFlyout from './CourseEditFlyout';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';

interface CourseRosterViewProps {
    events: ScheduleEvent[];
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
    onNavigateToHateSheet: (trainee: Trainee) => void;
    onRestoreCourse: (courseNumber: string) => void;
    onUpdateTrainee: (data: Trainee) => void;
    onAddTrainee: (data: Trainee) => void;
    school: 'ESL' | 'PEA';
    scores: Map<string, Score[]>;
    syllabusDetails: SyllabusItemDetail[];
    onNavigateToSyllabus: (syllabusId: string) => void;
    onNavigateToCurrency: (person: Instructor | Trainee) => void;
    onViewIndividualLMP: (trainee: Trainee) => void;
    onAddRemedialPackage: (trainee: Trainee) => void;
    onSelectPt051ForEvent?: (trainee: Trainee, assessment: Pt051Assessment) => void;
    locations: string[];
    units: string[];
    selectedPersonForProfile?: Trainee | null;
    onProfileOpened?: () => void;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    onViewLogbook?: (person: Trainee) => void;
    onDeleteTrainee: (trainee: Trainee) => void;
    onArchiveTrainee?: (trainee: Trainee) => void;
    onOpenInstructorProfile?: (instructorName: string) => void;
    // New callbacks for course editing
    onUpdateCourseNumber?: (oldCourseNumber: string, newCourseNumber: string) => void;
    onUpdateCourseUnit?: (courseNumber: string, newUnit: string) => void;
    onBackcourseTrainee?: (trainee: Trainee, newCourse: string) => void;
    masterCurrencies?: MasterCurrency[];
    currencyRequirements?: CurrencyRequirement[];
    currentUserId?: string;
    currentUserName?: string;
    pt051Assessments?: Map<string, any>;
    userProfile?: any;
    canViewTraineeProfile?: (trainee: Trainee) => boolean;
    canViewTraineePt051?: (trainee: Trainee) => boolean;
    canEditTraineePt051?: (trainee: Trainee) => boolean;
    canViewTraineeLmp?: (trainee: Trainee) => boolean;
    canAddRemedialPackageForTrainee?: (trainee: Trainee) => boolean;
    onAccessDenied?: (actionLabel: string) => void;
    resourceDisplayNames?: ResourceDisplayNames;
    personnelDisplaySettings?: PersonnelDisplaySettings;
}

const generateNewTraineeTemplate = (): Trainee => ({
    idNumber: Math.floor(Math.random() * (9999999 - 1000000 + 1)) + 1000000,
    fullName: '', // Will be constructed on save
    name: '',
    rank: 'PLTOFF',
    course: '',
    seatConfig: 'Normal',
    isPaused: false,
    unit: '1FTS',
    service: 'RAAF',
    unavailability: [],
    permissions: ['Trainee'],
    traineeCallsign: '',
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
    school,
    scores,
    syllabusDetails,
    onNavigateToSyllabus,
    onNavigateToCurrency,
    onViewIndividualLMP,
    onAddRemedialPackage,
    onSelectPt051ForEvent,
    locations,
    units,
    selectedPersonForProfile,
    onProfileOpened,
    traineeLMPs,
    onViewLogbook,
    onDeleteTrainee,
    onArchiveTrainee,
    onOpenInstructorProfile,
    onUpdateCourseNumber,
    onUpdateCourseUnit,
    onBackcourseTrainee,
    masterCurrencies = [],
    currencyRequirements = [],
    currentUserId,
    currentUserName,
    pt051Assessments,
    userProfile,
    canViewTraineeProfile = () => true,
    canViewTraineePt051 = () => true,
    canEditTraineePt051 = () => true,
    canViewTraineeLmp = () => true,
    canAddRemedialPackageForTrainee = () => true,
    onAccessDenied,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    personnelDisplaySettings,
}) => {
    const { isFrozen } = useSystemFreeze();
    const [view, setView] = useState<'active' | 'archived'>('active');
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newTraineeTemplate, setNewTraineeTemplate] = useState<Trainee | null>(null);
    const [courseToRestore, setCourseToRestore] = useState<string | null>(null);
    const [hoveredTrainee, setHoveredTrainee] = useState<{ name: string; events: ScheduleEvent[] } | null>(null);
    const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);

    // Delete Trainee state
    const [selectedCourseForDeletion, setSelectedCourseForDeletion] = useState<string>('');
    const [selectedTraineeForDeletion, setSelectedTraineeForDeletion] = useState<Trainee | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    // Course Edit state
    const [courseToEdit, setCourseToEdit] = useState<string | null>(null);

    useEffect(() => {
        if (selectedPersonForProfile) {
            if (!canViewTraineeProfile(selectedPersonForProfile)) {
                onAccessDenied?.('trainee profile');
                onProfileOpened?.();
                return;
            }
            setSelectedTrainee(selectedPersonForProfile);
            setIsCreatingNew(false);
            onProfileOpened?.();
        }
    }, [selectedPersonForProfile, onProfileOpened, canViewTraineeProfile, onAccessDenied]);

    const groupedTrainees = useMemo(() => {
        const groups: { [course: string]: Trainee[] } = {};

        traineesData.forEach(trainee => {
            if (!groups[trainee.course]) {
                groups[trainee.course] = [];
            }
            groups[trainee.course].push(trainee);
        });

        for (const course in groups) {
            groups[course].sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'trainee'));
        }

        return groups;
    }, [traineesData, personnelDisplaySettings]);

    // This effect ensures that if the underlying trainee data (like pause status or unavailabilities) changes
    // while the profile flyout is open, the flyout will re-render with the latest data.
    useEffect(() => {
        if (selectedTrainee && !isCreatingNew) {
            const updatedTrainee = traineesData.find((t: Trainee) => (t as any).id
                ? (t as any).id === (selectedTrainee as any).id
                : t.fullName === selectedTrainee.fullName);

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
                    console.log('[CourseRosterView] Syncing selectedTrainee from updated traineesData - unavailChanged:', unavailChanged);
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

    // Filter courses by locality - only show courses that have trainees in traineesData
    // (which is already filtered by school/location). This prevents courses from other
    // localities (e.g., ADF304/ADF305 for PEA) from appearing when viewing ESL.
    const activeCourseNumbers = [...new Set(traineesData.map(t => t.course).filter(c => c && courseColors[c]))]
        .sort((a, b) => a.localeCompare(b));
    const archivedCourseNumbers = Object.keys(archivedCourses).sort((a, b) => a.localeCompare(b));

    const coursesToDisplay = view === 'active' ? activeCourseNumbers : archivedCourseNumbers;
    const courseColorMap = view === 'active' ? courseColors : archivedCourses;

    const handleConfirmRestore = (courseNumber: string) => {
        onRestoreCourse(courseNumber);
        setCourseToRestore(null);
    };

    const handleAddTraineeClick = () => {
        setNewTraineeTemplate(generateNewTraineeTemplate());
        setIsCreatingNew(true);
        setSelectedTrainee(null);
    };

    const handleDeleteTrainee = (trainee: Trainee) => {
        onDeleteTrainee(trainee);
        setShowDeleteConfirmation(false);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, traineeFullName: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const traineeEvents = events.filter(event =>
            event.student === traineeFullName ||
            (event.flightType === 'Solo' && event.pilot === traineeFullName)
        );
        setHoveredTrainee({ name: traineeFullName.split(' – ')[0], events: traineeEvents });
        setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
    };

    const handleMouseLeave = () => {
        setHoveredTrainee(null);
        setFlyoutPosition(null);
    };

    const getTraineeNameColorClass = (trainee: Trainee): string => {
        // RULE 1: RED for Paused/NTSC (highest priority - overrides all others)
        if (trainee.isPaused) {
            return 'text-red-400 hover:text-red-300';
        }

        // RULE 2: AMBER for recent non-remedial poor performance
        const traineeScores = scores.get(trainee.fullName) || [];

        // Get all non-remedial Flight/FTD scores sorted by date (most recent first)
        const nonRemedialFlightFtdScores = traineeScores
            .filter(score => {
                const syllabusItem = syllabusDetails.find(item => item.id === score.event);
                // Include only Flight or FTD events that are NOT remedial
                return syllabusItem &&
                       (syllabusItem.type === 'Flight' || syllabusItem.type === 'FTD') &&
                       !syllabusItem.isRemedial;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (nonRemedialFlightFtdScores.length > 0) {
            const lastNonRemedialScore = nonRemedialFlightFtdScores[0];

            // Check if last non-remedial Flight/FTD was a fail (score = 0)
            if (lastNonRemedialScore.score === 0) {
                return 'text-amber-400 hover:text-amber-300';
            }

            // Check if last TWO non-remedial Flight/FTD events both have score of 1
            if (nonRemedialFlightFtdScores.length >= 2) {
                const secondLastNonRemedialScore = nonRemedialFlightFtdScores[1];

                // If both last two non-remedial Flight/FTD events have score = 1, mark as AMBER
                if (lastNonRemedialScore.score === 1 && secondLastNonRemedialScore.score === 1) {
                    return 'text-amber-400 hover:text-amber-300';
                }
            }
        }

        // RULE 3: GREEN for everyone else (default)
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
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
                        >
                            Delete Trainee
                        </button>
                        <div className="w-[5px]"></div>
                        <AuditButton pageName="Trainee Roster" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 pb-16 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
                                const activeCount = courseTrainees.filter(t => !t.isPaused).length;
                                const pausedCount = courseTrainees.filter(t => t.isPaused).length;

                                const isHexColor = (c: string) => c && (c.startsWith('#') || c.startsWith('rgb'));
                                return (
                                    <div key={courseName} className="bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden border border-gray-700">
                                        <div
                                            data-course-color="true"
                                            className={`px-4 py-2 text-white font-bold text-lg ${isHexColor(color) ? '' : color} flex justify-between items-center`}
                                            style={isHexColor(color) ? { backgroundColor: darkenHexColor(color) } : {}}
                                        >
                                            <div>
                                                <span>{courseName}</span>
                                                {courseTrainees.length > 0 && <span className="ml-2 text-xs font-normal opacity-80">{courseTrainees[0].unit}</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
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
                                            {activeCount} active{pausedCount > 0 && `, ${pausedCount} paused`}
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3">
                                            {courseTrainees.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {courseTrainees.map(trainee => {
                                                        const nameColorClass = getTraineeNameColorClass(trainee);

                                                        return (
                                                            <li
                                                                key={trainee.fullName}
                                                                className="flex items-center text-sm"
                                                                onMouseEnter={(e) => handleMouseEnter(e, trainee.fullName)}
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
                                                                    title={canViewTraineeProfile(trainee) ? undefined : 'Your permission profile does not allow this trainee profile'}
                                                                    className={`truncate text-left ${nameColorClass} hover:underline focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 ${!canViewTraineeProfile(trainee) ? 'opacity-50 cursor-not-allowed hover:no-underline' : ''}`}
                                                                >
                                                                    {trainee.name}
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
                    onClose={() => setShowDeleteConfirmation(false)}
                    onConfirm={handleDeleteTrainee}
                    onArchive={onArchiveTrainee}
                    traineesData={traineesData}
                    courseColors={courseColors}
                />
            )}
            {(selectedTrainee || isCreatingNew) && (
                <TraineeProfileFlyout
                    trainee={isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!}
                    onClose={() => {
                        setSelectedTrainee(null);
                        setIsCreatingNew(false);
                        setNewTraineeTemplate(null);
                    }}
                    onUpdateTrainee={isCreatingNew ? onAddTrainee : onUpdateTrainee}
                    events={events}
                    school={school}
                    onNavigateToHateSheet={onNavigateToHateSheet}
                    onViewIndividualLMP={onViewIndividualLMP}
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
                    resourceDisplayNames={resourceDisplayNames}
                    pt051Assessments={pt051Assessments}
                    traineeLMPs={traineeLMPs}
                    userProfile={userProfile}
                    canViewPt051={canViewTraineePt051(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canEditPt051={canEditTraineePt051(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canViewIndividualLmp={canViewTraineeLmp(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    canAddRemedialPackage={canAddRemedialPackageForTrainee(isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!)}
                    onSelectPt051ForEvent={(assessment) => onSelectPt051ForEvent?.(
                        isCreatingNew && newTraineeTemplate ? newTraineeTemplate : selectedTrainee!,
                        assessment
                    )}
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
                />
            )}
        </>
    );
};

export default CourseRosterView;
