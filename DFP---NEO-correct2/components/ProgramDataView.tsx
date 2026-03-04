

import React, { useMemo, useState } from 'react';
import { ScheduleEvent, Instructor, Trainee, UnavailabilityPeriod, Score, SyllabusItemDetail } from '../types';


interface ProgramDataViewProps {
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  traineesData: Trainee[];
  activeCourses: string[];
  onNavigateAndSelectPerson: (name: string) => void;
  scores: Map<string, Score[]>;
  syllabusDetails: SyllabusItemDetail[];
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  courseColors: { [key: string]: string };
}

// Helper component for stat cards
const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
  <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col">
    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
    <p className="mt-2 text-4xl font-bold text-white">{value}</p>
    {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
  </div>
);

// Helper component for displaying availability cards
const AvailabilityCard: React.FC<{
  title: string;
  trainees: Trainee[];
  color: string;
  bgColor: string;
  borderColor: string;
  hoverBgColor?: string;
  hoverBorderColor?: string;
  courseColors?: { [key: string]: string };
}> = ({ title, trainees, color, bgColor, borderColor, hoverBgColor = '', hoverBorderColor = '', courseColors = {} }) => {
  return (
    <div className={`${bgColor} ${hoverBgColor} ${borderColor} ${hoverBorderColor} rounded-lg p-4 border transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-semibold ${color} transition-colors`}>{title}</h3>
        <span className={`text-sm font-medium ${color} bg-gray-700/50 px-2 py-1 rounded-full`}>
          {trainees.length}
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {trainees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm italic">No trainees in this category</p>
          </div>
        ) : (
          trainees.map(trainee => (
            <div 
              key={trainee.id} 
              className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md hover:bg-gray-600/60 transition-all duration-200 ease-in-out group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div 
                  className={`w-4 h-4 rounded-full transition-all duration-200 group-hover:scale-125 ${
                    courseColors[trainee.course] 
                      ? `border-2 border-gray-300` 
                      : `${color.replace('text-', 'bg-')}`
                  }`}
                  style={courseColors[trainee.course] ? { backgroundColor: courseColors[trainee.course] } : {}}
                ></div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium group-hover:text-gray-100 transition-colors">
                    {trainee.name}
                  </p>
                  <p className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">
                    {trainee.course} • {trainee.rank}
                  </p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ProgramDataView: React.FC<ProgramDataViewProps> = ({ 
    date, 
    events, 
    instructorsData, 
    traineesData, 
    activeCourses, 
    onNavigateAndSelectPerson,
    scores,
    syllabusDetails,
    traineeLMPs,
    courseColors
}) => {
    // State for availability filtering
    const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const getCourseFromStudent = (studentName: string): string | null => {
        if (!studentName) return null;
        const match = studentName.match(/ – (.*)$/);
        return match ? match[1] : null;
    };

    const formattedDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: '2-digit',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
    }, [date]);

    const unavailableOnSelectedDate = useMemo(() => {
        const selectedDateStr = date;

        const allPersonnel: (Instructor | Trainee)[] = [...instructorsData, ...traineesData];
        const unavailableList: { name: string; rank: string; period: UnavailabilityPeriod }[] = [];

        allPersonnel.forEach(person => {
            person.unavailability?.forEach(period => {
                if (selectedDateStr >= period.startDate && selectedDateStr < period.endDate) {
                    unavailableList.push({
                        name: 'fullName' in person ? person.name : person.name,
                        rank: person.rank,
                        period: period
                    });
                }
            });
        });

        return unavailableList.sort((a, b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown'));
    }, [instructorsData, traineesData, date]);
    
    const formatMilitaryTime = (timeString: string | undefined): string => {
        if (!timeString) return '';
        return timeString.replace(':', '');
    };

  const stats = useMemo(() => {
    const flightTiles = events.filter(e => e.type === 'flight').length;
    const ftdTiles = events.filter(e => e.type === 'ftd').length;
    
    const flightOrFtdEvents = events.filter(e => e.type === 'flight' || e.type === 'ftd');
    
    const instructorEventCounts = new Map<string, number>();
    events.forEach(e => {
        if (e.instructor) {
            instructorEventCounts.set(e.instructor, (instructorEventCounts.get(e.instructor) || 0) + 1);
        }
    });

    const selectedDateStr = date;
    const unavailableInstructors = new Set<string>();
    instructorsData.forEach(instructor => {
        instructor.unavailability?.forEach(period => {
            if (selectedDateStr >= period.startDate && selectedDateStr < period.endDate) {
                unavailableInstructors.add(instructor.name);
            }
        });
    });
    const availableInstructors = instructorsData.filter(i => !unavailableInstructors.has(i.name));
    const totalAvailableInstructors = availableInstructors.length;

    const instructorsWithFourEventsList = availableInstructors.filter(i => (instructorEventCounts.get(i.name) || 0) === 4).map(i => i.name).sort();
    const instructorsWithThreeEventsList = availableInstructors.filter(i => (instructorEventCounts.get(i.name) || 0) === 3).map(i => i.name).sort();
    const instructorsWithTwoEventsList = availableInstructors.filter(i => (instructorEventCounts.get(i.name) || 0) === 2).map(i => i.name).sort();
    const instructorsWithOneEventList = availableInstructors.filter(i => (instructorEventCounts.get(i.name) || 0) === 1).map(i => i.name).sort();
    const instructorsWithZeroEventsList = availableInstructors.filter(i => (instructorEventCounts.get(i.name) || 0) === 0).map(i => i.name).sort();

    const traineeEventCounts = new Map<string, number>();
    flightOrFtdEvents.forEach(e => {
      const traineeName = e.student || e.pilot;
      if (traineeName) {
        traineeEventCounts.set(traineeName, (traineeEventCounts.get(traineeName) || 0) + 1);
      }
    });
    
    const activeTrainees = traineesData.filter(t => !t.isPaused);
    const unavailableTrainees = new Set<string>();
    activeTrainees.forEach(trainee => {
        trainee.unavailability?.forEach(period => {
            if (selectedDateStr >= period.startDate && selectedDateStr < period.endDate) {
                unavailableTrainees.add(trainee.fullName);
            }
        });
    });
    const availableActiveTrainees = activeTrainees.filter(t => !unavailableTrainees.has(t.fullName));
    const totalAvailableTrainees = availableActiveTrainees.length;
    
    const traineesWithZeroEventsList = availableActiveTrainees.filter(t => !traineeEventCounts.has(t.fullName)).map(t => t.fullName).sort();

    const standbyEvents = events.filter(e => e.resourceId.startsWith('STBY')).length;

    const eventsPerCourse = new Map<string, number>();
    const personnelPerCourse = new Map<string, Set<string>>();
    const availableTraineesPerCourse = new Map<string, number>();

    activeCourses.forEach(course => {
        eventsPerCourse.set(course, 0);
        personnelPerCourse.set(course, new Set<string>());
        
        const traineesInCourse = traineesData.filter(t => t.course === course && !t.isPaused);
        let availableCount = 0;
        traineesInCourse.forEach(trainee => {
            const isUnavailable = trainee.unavailability?.some(period => 
                selectedDateStr >= period.startDate && selectedDateStr < period.endDate
            );
            if (!isUnavailable) {
                availableCount++;
            }
        });
        availableTraineesPerCourse.set(course, availableCount);
    });
    
    const getEventPersonnel = (e: ScheduleEvent): string[] => {
        const personnel = new Set<string>();
        if (e.instructor) personnel.add(e.instructor);
        if (e.student) personnel.add(e.student);
        if (e.pilot) personnel.add(e.pilot);
        if (e.attendees) e.attendees.forEach(p => personnel.add(p));
        return Array.from(personnel);
    };

    events.forEach(e => {
        if (e.flightNumber !== 'Ground School') {
            const course = getCourseFromStudent(e.student || e.pilot || '');
            if (course && eventsPerCourse.has(course)) {
                eventsPerCourse.set(course, eventsPerCourse.get(course)! + 1);
                
                const eventPersonnel = getEventPersonnel(e);
                const coursePersonnelSet = personnelPerCourse.get(course)!;
                eventPersonnel.forEach(p => coursePersonnelSet.add(p));
            }
        }
    });

    const personnelPerCourseLists = new Map<string, string[]>();
    personnelPerCourse.forEach((personnelSet, course) => {
        personnelPerCourseLists.set(course, Array.from(personnelSet).sort());
    });

    const traineeMap = new Map<string, Trainee>(traineesData.map(t => [t.fullName, t]));
    const instructorMap = new Map<string, Instructor>(instructorsData.map(i => [i.name, i]));
    const traineesWithPrimary = new Set<string>();
    const traineesWithSecondary = new Set<string>();
    const traineesWithInstructorFromFlight = new Set<string>();
    const traineesWithOtherInstructors = new Set<string>();

    for (const event of flightOrFtdEvents) {
        const traineeName = event.student || event.pilot;
        if (!traineeName || !event.instructor) continue;

        const trainee = traineeMap.get(traineeName);
        if (!trainee) continue;
        
        const instructorName = event.instructor;
        const instructor = instructorMap.get(instructorName);

        if (trainee.primaryInstructor === instructorName) {
            traineesWithPrimary.add(traineeName);
        } else if (trainee.secondaryInstructor === instructorName) {
            traineesWithSecondary.add(traineeName);
        } else if (instructor && trainee.flight && instructor.flight === trainee.flight) {
            // Not primary or secondary, but from same flight
            traineesWithInstructorFromFlight.add(traineeName);
        } else {
            // Not primary, secondary, or from same flight
            traineesWithOtherInstructors.add(traineeName);
        }
    }
    
    return {
      flightTiles,
      ftdTiles,
      combinedTiles: flightTiles + ftdTiles,
      standbyEvents,
      eventsPerCourse,
      personnelPerCourseLists,
      availableTraineesPerCourse,
      instructorsWithFourEvents: instructorsWithFourEventsList.length,
      instructorsWithThreeEvents: instructorsWithThreeEventsList.length,
      instructorsWithTwoEvents: instructorsWithTwoEventsList.length,
      instructorsWithOneEvent: instructorsWithOneEventList.length,
      instructorsWithZeroEvents: instructorsWithZeroEventsList.length,
      traineesWithZeroEvents: traineesWithZeroEventsList.length,
      instructorsWithFourEventsList,
      instructorsWithThreeEventsList,
      instructorsWithTwoEventsList,
      instructorsWithOneEventList,
      instructorsWithZeroEventsList,
      traineesWithZeroEventsList,
      totalAvailableInstructors,
      totalAvailableTrainees,
      traineesWithPrimaryList: Array.from(traineesWithPrimary).sort(),
      traineesWithSecondaryList: Array.from(traineesWithSecondary).sort(),
      traineesWithInstructorFromFlightList: Array.from(traineesWithInstructorFromFlight).sort(),
      traineesWithOtherInstructorsList: Array.from(traineesWithOtherInstructors).sort(),
    };
  }, [date, events, instructorsData, traineesData, activeCourses]);

    const { nextEventLists, nextPlusOneLists } = useMemo(() => {
        const nextEventLists = { flight: [] as Trainee[], ftd: [] as Trainee[], cpt: [] as Trainee[], ground: [] as Trainee[] };
        const nextPlusOneLists = { flight: [] as Trainee[], ftd: [] as Trainee[], cpt: [] as Trainee[], ground: [] as Trainee[] };

        const activeTrainees = traineesData.filter(t => !t.isPaused);
        
        activeTrainees.forEach(trainee => {
            const individualLMP = traineeLMPs.get(trainee.fullName) || [];
            const traineeScores = scores.get(trainee.fullName) || [];
            const completedEventIds = new Set(traineeScores.map(s => s.event));
            
            let nextEvt: SyllabusItemDetail | null = null;
            let plusOneEvt: SyllabusItemDetail | null = null;
            let nextEventIndex = -1;

            // Find Next Event
            for (let i = 0; i < individualLMP.length; i++) {
                const item = individualLMP[i];
                if (completedEventIds.has(item.id) || item.code.includes(' MB')) {
                    continue;
                }
                const prereqsMet = item.prerequisites.every(p => completedEventIds.has(p));
                if (prereqsMet) {
                    nextEvt = item;
                    nextEventIndex = i;
                    break;
                }
            }
            
            // Find Next +1 Event (sequentially)
            if (nextEventIndex !== -1) {
                for (let i = nextEventIndex + 1; i < individualLMP.length; i++) {
                    const item = individualLMP[i];
                    if (!item.code.includes(' MB')) { // Skip non-schedulable events
                        plusOneEvt = item;
                        break;
                    }
                }
            }

            if (nextEvt) {
                if (nextEvt.type === 'Flight') nextEventLists.flight.push(trainee);
                else if (nextEvt.type === 'FTD') nextEventLists.ftd.push(trainee);
                else if (nextEvt.code.includes('CPT')) nextEventLists.cpt.push(trainee);
                else if (nextEvt.type === 'Ground School') {
                    nextEventLists.ground.push(trainee);
                    if (plusOneEvt) {
                        if (plusOneEvt.type === 'Flight') nextPlusOneLists.flight.push(trainee);
                        else if (plusOneEvt.type === 'FTD') nextPlusOneLists.ftd.push(trainee);
                        else if (plusOneEvt.code.includes('CPT')) nextPlusOneLists.cpt.push(trainee);
                        else if (plusOneEvt.type === 'Ground School') nextPlusOneLists.ground.push(trainee);
                    }
                }
            }
        });

        const today = new Date(date + 'T00:00:00Z');
        const daysSince = (dateStr?: string): number => {
            if (!dateStr) return 999;
            const eventDate = new Date(dateStr + 'T00:00:00Z');
            return Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        };
        
        const sortTrainees = (a: Trainee, b: Trainee): number => {
            const daysSinceA = daysSince(a.lastEventDate);
            const daysSinceB = daysSince(b.lastEventDate);
            if (daysSinceA !== daysSinceB) return daysSinceB - daysSinceA;
            const daysSinceFlightA = daysSince(a.lastFlightDate);
            const daysSinceFlightB = daysSince(b.lastFlightDate);
            if (daysSinceFlightA !== daysSinceFlightB) return daysSinceFlightB - daysSinceA;
            return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
        };
        
        Object.values(nextEventLists).forEach(list => list.sort(sortTrainees));
        Object.values(nextPlusOneLists).forEach(list => list.sort(sortTrainees));

        return { nextEventLists, nextPlusOneLists };
    }, [traineesData, traineeLMPs, scores, date]);

    // Get all unique courses for filter dropdown
    const allCourses = useMemo(() => {
        const courses = new Set(traineesData.map(trainee => trainee.course).filter(course => course));
        return Array.from(courses).sort();
    }, [traineesData]);

    // Categorize trainees by availability
    const { availableTrainees, unavailableTrainees, pausedTrainees } = useMemo(() => {
        const today = date; // Use the selected date from props
        const available: Trainee[] = [];
        const unavailable: Trainee[] = [];
        const paused: Trainee[] = [];

        traineesData.forEach(trainee => {
            // Check if trainee is paused
            if (trainee.isPaused) {
                paused.push(trainee);
                return;
            }

            // Check if trainee has unavailability for the selected date
            const hasUnavailability = (trainee.unavailability || []).some(period => 
                today >= period.startDate && today < period.endDate
            );

            if (hasUnavailability) {
                unavailable.push(trainee);
            } else {
                available.push(trainee);
            }
        });

        return {
            availableTrainees: available,
            unavailableTrainees: unavailable,
            pausedTrainees: paused
        };
    }, [traineesData, date]);

    // Filter trainees based on selected course and search term
    const filterTrainees = (trainees: Trainee[]) => {
        return trainees.filter(trainee => {
            const matchesCourse = availabilityFilter === 'all' || trainee.course === availabilityFilter;
            const matchesSearch = searchTerm === '' || 
                trainee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                trainee.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
                trainee.rank.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCourse && matchesSearch;
        });
    };

    const filteredAvailableTrainees = useMemo(() => {
        return filterTrainees(availableTrainees);
    }, [availableTrainees, availabilityFilter, searchTerm]);

    const filteredUnavailableTrainees = useMemo(() => {
        return filterTrainees(unavailableTrainees);
    }, [unavailableTrainees, availabilityFilter, searchTerm]);

    const filteredPausedTrainees = useMemo(() => {
        return filterTrainees(pausedTrainees);
    }, [pausedTrainees, availabilityFilter, searchTerm]);

    const traineesWaitingForNightFlying = useMemo(() => {
        const waitingList: { trainee: Trainee; event: SyllabusItemDetail }[] = [];
        const activeTrainees = traineesData.filter(t => !t.isPaused);

        activeTrainees.forEach(trainee => {
            const individualLMP = traineeLMPs.get(trainee.fullName) || [];
            const traineeScores = scores.get(trainee.fullName) || [];
            const completedEventIds = new Set(traineeScores.map(s => s.event));
            
            for (const item of individualLMP) {
                if (completedEventIds.has(item.id) || item.code.includes(' MB')) continue;
                
                const prereqsMet = item.prerequisites.every(p => completedEventIds.has(p));
                if (prereqsMet) {
                    if (item.code.startsWith('BNF') && item.type === 'Flight') {
                        waitingList.push({ trainee, event: item });
                    }
                    break; 
                }
            }
        });
        return waitingList.sort((a,b) => (a.trainee?.name ?? 'Unknown').localeCompare(b.trainee?.name ?? 'Unknown'));
    }, [traineesData, traineeLMPs, scores]);


  const InteractiveStatCard: React.FC<{ title: string; value: string | number; description?: string; personnelList: string[]; onPersonClick: (name: string) => void; }> = ({ title, value, description, personnelList, onPersonClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    if (personnelList.length === 0 && !description) {
        return <StatCard title={title} value={value} description={description} />;
    }

    return (
        <div 
            className="relative bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
            <p className="mt-2 text-4xl font-bold text-white">{value}</p>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}

            {isHovered && personnelList.length > 0 && (
                <div className="absolute z-10 top-full left-0 mt-2 w-64 bg-gray-900 border border-sky-500 rounded-lg shadow-2xl p-2 max-h-60 overflow-y-auto animate-fade-in">
                   <ul className="space-y-1">
                       {personnelList.map(name => (
                           <li key={name}>
                               <button 
                                   onClick={() => onPersonClick(name)}
                                   className="w-full text-left p-2 rounded text-gray-300 hover:bg-sky-800 hover:text-white transition-colors text-sm"
                               >
                                   {name.split(' – ')[0]}
                               </button>
                           </li>
                       ))}
                   </ul>
                </div>
            )}
        </div>
    );
};

  const ListCard: React.FC<{ title: string; trainees: Trainee[] }> = ({ title, trainees }) => {
    const [filter, setFilter] = useState<string>('Total');
    
    // Get unique courses from trainees
    const courses = useMemo(() => {
      const uniqueCourses = new Set(trainees.map(t => t.course));
      return ['Total', ...Array.from(uniqueCourses).sort()];
    }, [trainees]);
    
    // Filter trainees based on selected course
    const filteredTrainees = useMemo(() => {
      if (filter === 'Total') return trainees;
      return trainees.filter(t => t.course === filter);
    }, [trainees, filter]);
    
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col h-fit">
        <div className="p-3 border-b border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-base font-semibold text-gray-200">{title}</span>
            <span className="text-sm font-mono text-sky-400 bg-gray-700/50 px-2 py-0.5 rounded">
              {filteredTrainees.length}
            </span>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {courses.map(course => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
        </div>
        <ul className="p-3 space-y-2 overflow-y-auto max-h-60">
          {filteredTrainees.length > 0 ? filteredTrainees.map((trainee, index) => (
            <li key={trainee.idNumber} className="flex items-baseline text-sm text-gray-300">
              <span className="font-mono text-gray-500 w-8 text-right mr-2 flex-shrink-0">{index + 1}.</span>
              <span className="font-semibold text-gray-200 truncate">{trainee.name}</span>
            </li>
          )) : <li className="text-sm text-gray-500 italic text-center">None</li>}
        </ul>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <header>
          <h1 className="text-3xl font-bold text-white">Program Data</h1>
          <p className="text-lg text-gray-400">Metrics for DFP on <span className="text-gray-200 font-semibold">{formattedDate}</span></p>
             
        </header>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Personnel Unavailable</h2>
            {unavailableOnSelectedDate.length > 0 ? (
                <div className="max-h-60 overflow-y-auto pr-2">
                    <ul className="space-y-3">
                        {unavailableOnSelectedDate.map((item, index) => (
                            <li key={index} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-md text-sm">
                                <div className="flex items-center space-x-3">
                                    <span className="font-mono text-gray-500 w-12 text-right">{item.rank}</span>
                                    <span className="font-semibold text-white">{item.name}</span>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="text-amber-300 font-medium">{item.period.reason}</span>
                                    <span className="font-mono text-gray-300 w-32 text-right">
                                        {item.period.allDay ? 'All Day' : `${formatMilitaryTime(item.period.startTime)} - ${formatMilitaryTime(item.period.endTime)}`}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-gray-500 text-center py-4">No personnel are recorded as unavailable for this date.</p>
            )}
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Waiting for Night Flying</h2>
            {traineesWaitingForNightFlying.length > 0 ? (
                <div className="max-h-60 overflow-y-auto pr-2">
                    <ul className="space-y-3">
                        {traineesWaitingForNightFlying.map(({ trainee, event }, index) => (
                            <li key={index} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-md text-sm">
                                <div className="flex items-center space-x-3">
                                    <span className="font-mono text-gray-500 w-12 text-right">{trainee.rank}</span>
                                    <span className="font-semibold text-white">{trainee.name}</span>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="text-gray-300 font-medium">{trainee.course}</span>
                                    <span className="font-mono text-sky-400">{event.code}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-gray-500 text-center py-4">No trainees are currently waiting for a night flying event.</p>
            )}
        </div>

          <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Tiles</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="Total Flight Tiles" value={stats.flightTiles} />
                  <StatCard title="Total FTD Tiles" value={stats.ftdTiles} />
                  <StatCard title="Combined Flight/FTD" value={stats.combinedTiles} />
                  <StatCard title="Standby Events" value={stats.standbyEvents} description="Reason not specified." />
              </div>
          </fieldset>

          <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Instructors</legend>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <InteractiveStatCard
                      title="Instructors with 4 Events"
                      value={stats.instructorsWithFourEvents}
                      description={`of ${stats.totalAvailableInstructors} available`}
                      personnelList={stats.instructorsWithFourEventsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Instructors with 3 Events"
                      value={stats.instructorsWithThreeEvents}
                      description={`of ${stats.totalAvailableInstructors} available`}
                      personnelList={stats.instructorsWithThreeEventsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Instructors with 2 Events"
                      value={stats.instructorsWithTwoEvents}
                      description={`of ${stats.totalAvailableInstructors} available`}
                      personnelList={stats.instructorsWithTwoEventsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Instructors with 1 Event"
                      value={stats.instructorsWithOneEvent}
                      description={`of ${stats.totalAvailableInstructors} available`}
                      personnelList={stats.instructorsWithOneEventList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Instructors with 0 Events"
                      value={stats.instructorsWithZeroEvents}
                      description={`of ${stats.totalAvailableInstructors} available`}
                      personnelList={stats.instructorsWithZeroEventsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
              </div>
          </fieldset>

          <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
              <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Trainees</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <InteractiveStatCard
                      title="Trainees with 0 Events"
                      value={stats.traineesWithZeroEvents}
                      description={`of ${stats.totalAvailableTrainees} available (active)`}
                      personnelList={stats.traineesWithZeroEventsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Trainees with their Primary"
                      value={stats.traineesWithPrimaryList.length}
                      description="Paired with Primary Instructor"
                      personnelList={stats.traineesWithPrimaryList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Trainees with their Secondary"
                      value={stats.traineesWithSecondaryList.length}
                      description="Paired with Secondary Instructor"
                      personnelList={stats.traineesWithSecondaryList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Trainees with Instructor from Flight"
                      value={stats.traineesWithInstructorFromFlightList.length}
                      description="Paired with Instructor from same Flight"
                      personnelList={stats.traineesWithInstructorFromFlightList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
                  <InteractiveStatCard
                      title="Trainees with Other Instructors"
                      value={stats.traineesWithOtherInstructorsList.length}
                      description="Paired with other Instructors"
                      personnelList={stats.traineesWithOtherInstructorsList}
                      onPersonClick={onNavigateAndSelectPerson}
                  />
              </div>
          </fieldset>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-sky-400 mb-4">Events per Course (Excl. Ground School)</h2>
          {stats.eventsPerCourse.size > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from(stats.eventsPerCourse.entries()).sort().map(([course, count]) => (
                      <InteractiveStatCard
                          key={course}
                          title={course}
                          value={count}
                          description={`of ${stats.availableTraineesPerCourse.get(course) || 0} available`}
                          personnelList={stats.personnelPerCourseLists.get(course) || []}
                          onPersonClick={onNavigateAndSelectPerson}
                      />
                  ))}
              </div>
          ) : (
              <p className="text-gray-500 text-center py-8">No events found for active courses.</p>
          )}
        </div>

        {/* Trainee Availability Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-4 sm:space-y-0">
            <h2 className="text-xl font-semibold text-sky-400">Trainee Availability</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search trainees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-md text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <label htmlFor="availability-filter" className="text-sm font-medium text-gray-300 whitespace-nowrap">Course:</label>
                <select 
                  id="availability-filter"
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                >
                  <option value="all">All Courses</option>
                  {allCourses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AvailabilityCard 
              title="Available Trainees"
              trainees={filteredAvailableTrainees}
              color="text-green-400"
              bgColor="bg-green-900/20"
              borderColor="border-green-700"
              hoverBgColor="hover:bg-green-900/30"
              hoverBorderColor="hover:border-green-600"
              courseColors={courseColors}
            />
            <AvailabilityCard 
              title="Unavailable Trainees"
              trainees={filteredUnavailableTrainees}
              color="text-red-400"
              bgColor="bg-red-900/20"
              borderColor="border-red-700"
              hoverBgColor="hover:bg-red-900/30"
              hoverBorderColor="hover:border-red-600"
              courseColors={courseColors}
            />
            <AvailabilityCard 
              title="Paused Trainees"
              trainees={filteredPausedTrainees}
              color="text-yellow-400"
              bgColor="bg-yellow-900/20"
              borderColor="border-yellow-700"
              hoverBgColor="hover:bg-yellow-900/30"
              hoverBorderColor="hover:border-yellow-600"
              courseColors={courseColors}
            />
          </div>
          
          {/* Statistics */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400">Total Trainees</p>
              <p className="text-2xl font-bold text-white">{traineesData.length}</p>
            </div>
            <div className="bg-green-700/20 rounded-lg p-4 border border-green-600">
              <p className="text-sm text-green-400">Available</p>
              <p className="text-2xl font-bold text-green-400">{filteredAvailableTrainees.length}</p>
              <p className="text-xs text-green-300">
                {traineesData.length > 0 ? Math.round((filteredAvailableTrainees.length / traineesData.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-red-700/20 rounded-lg p-4 border border-red-600">
              <p className="text-sm text-red-400">Unavailable</p>
              <p className="text-2xl font-bold text-red-400">{filteredUnavailableTrainees.length}</p>
              <p className="text-xs text-red-300">
                {traineesData.length > 0 ? Math.round((filteredUnavailableTrainees.length / traineesData.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-yellow-700/20 rounded-lg p-4 border border-yellow-600">
              <p className="text-sm text-yellow-400">Paused</p>
              <p className="text-2xl font-bold text-yellow-400">{filteredPausedTrainees.length}</p>
              <p className="text-xs text-yellow-300">
                {traineesData.length > 0 ? Math.round((filteredPausedTrainees.length / traineesData.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-sky-400 mb-4">Next Event Lists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ListCard title="Next Event – Flight" trainees={nextEventLists.flight} />
              <ListCard title="Next Event – FTD" trainees={nextEventLists.ftd} />
              <ListCard title="Next Event – CPT" trainees={nextEventLists.cpt} />
              <ListCard title="Next Event – Ground" trainees={nextEventLists.ground} />
              <ListCard title="Next +1 – Flight" trainees={nextPlusOneLists.flight} />
              <ListCard title="Next +1 – FTD" trainees={nextPlusOneLists.ftd} />
              <ListCard title="Next +1 – CPT" trainees={nextPlusOneLists.cpt} />
              <ListCard title="Next +1 – Ground School" trainees={nextPlusOneLists.ground} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramDataView;