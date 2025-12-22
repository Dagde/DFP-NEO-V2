


import React, { useState, useMemo, useEffect } from 'react';
import { Trainee, ScheduleEvent, Score, SyllabusItemDetail, Instructor, LogbookExperience } from '../types';
import TraineeProfileFlyout from './TraineeProfileFlyout';
import RestoreCourseConfirmation from './RestoreCourseConfirmation';
import FlightInfoFlyout from './FlightInfoFlyout';
import AuditButton from './AuditButton';

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
    locations: string[];
    units: string[];
    selectedPersonForProfile?: Trainee | null;
    onProfileOpened?: () => void;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    onViewLogbook?: (person: Trainee) => void;
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
    locations,
    units,
    selectedPersonForProfile,
    onProfileOpened,
    traineeLMPs,
    onViewLogbook
}) => {
    const [view, setView] = useState<'active' | 'archived'>('active');
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newTraineeTemplate, setNewTraineeTemplate] = useState<Trainee | null>(null);
    const [courseToRestore, setCourseToRestore] = useState<string | null>(null);
    const [hoveredTrainee, setHoveredTrainee] = useState<{ name: string; events: ScheduleEvent[] } | null>(null);
    const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (selectedPersonForProfile) {
            setSelectedTrainee(selectedPersonForProfile);
            setIsCreatingNew(false);
            if (onProfileOpened) {
                onProfileOpened();
            }
        }
    }, [selectedPersonForProfile, onProfileOpened]);

    const groupedTrainees = useMemo(() => {
        console.log('🟢 ========== COURSE ROSTER GROUPING START ==========');
        console.log('🟢 Input traineesData length:', traineesData.length);
        console.log('🟢 Input traineesData sample:', traineesData.slice(0, 5));
        
        const groups: { [course: string]: Trainee[] } = {};

        traineesData.forEach((trainee, index) => {
            console.log(`🟢 Processing trainee ${index}:`, {
                idNumber: trainee.idNumber,
                name: trainee.name,
                fullName: trainee.fullName,
                course: trainee.course,
                isPaused: trainee.isPaused
            });
            
            if (!trainee.course) {
                console.warn('🟢 Trainee missing course:', trainee);
                return; // Skip trainees without course
            }
            
            if (!groups[trainee.course]) {
                groups[trainee.course] = [];
                console.log(`🟢 Created new group for course: ${trainee.course}`);
            }
            groups[trainee.course].push(trainee);
        });

        console.log('🟢 Groups created:', Object.keys(groups));
        console.log('🟢 Group counts:', Object.keys(groups).reduce((acc, course) => {
            acc[course] = groups[course].length;
            return acc;
        }, {}));

        // Sort trainees within each group alphabetically by name
        for (const course in groups) {
            console.log(`🟢 Sorting course ${course} with ${groups[course].length} trainees`);
            groups[course].sort((a, b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown'));
        }

        console.log('🟢 Final grouped trainees:', groups);
        console.log('🟢 ========== COURSE ROSTER GROUPING END ==========');
        return groups;
    }, [traineesData]);

    // This effect ensures that if the underlying trainee data (like pause status or unavailabilities) changes
    // while the profile flyout is open, the flyout will re-render with the latest data.
    useEffect(() => {
        if (selectedTrainee && !isCreatingNew) {
            const updatedTrainee = traineesData.find((t: Trainee) => t.fullName === selectedTrainee.fullName);

            // Update the state only if the data has actually changed to avoid an infinite loop.
            if (updatedTrainee && JSON.stringify(updatedTrainee) !== JSON.stringify(selectedTrainee)) {
                setSelectedTrainee(updatedTrainee);
            }
        }
    }, [traineesData, selectedTrainee, isCreatingNew]);

    const activeCourseNumbers = Object.keys(courseColors).sort((a, b) => a.localeCompare(b));
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
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${view === value ? 'bg-sky-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
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
                         <button
                            onClick={handleAddTraineeClick}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold shadow-md flex items-center"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Trainee
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <ViewToggleButton label="Active Courses" value="active" />
                        <ViewToggleButton label="Archived Courses" value="archived" />
                           <AuditButton pageName="Trainee Roster" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {coursesToDisplay.map(courseName => {
                                const courseTrainees = groupedTrainees[courseName] || [];
                                const color = courseColorMap[courseName] || 'bg-gray-500';

                                return (
                                    <div key={courseName} className="bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden border border-gray-700">
                                        <div className={`px-4 py-2 text-white font-bold text-lg ${color} flex justify-between items-center`}>
                                            <div>
                                                <span>{courseName}</span>
                                                {courseTrainees.length > 0 && <span className="ml-2 text-xs font-normal opacity-80">{courseTrainees[0].unit}</span>}
                                            </div>
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
                                                                    onClick={() => setSelectedTrainee(trainee)}
                                                                    className={`truncate text-left ${nameColorClass} hover:underline focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1`}
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
                    isCreating={isCreatingNew}
                    activeCourses={activeCourseNumbers}
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
        </>
    );
};

export default CourseRosterView;