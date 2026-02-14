import React, { useMemo, useState } from 'react';
import { ScheduleEvent, Instructor, Trainee, UnavailabilityPeriod, Score, SyllabusItemDetail } from '../../types';
import InteractiveStatCard from '../shared/InteractiveStatCard';
import AvailabilityCard from '../shared/AvailabilityCard';
import ListCard from '../shared/ListCard';

interface PeopleTabProps {
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  traineesData: Trainee[];
  onNavigateAndSelectPerson: (name: string) => void;
  scores: Map<string, Score[]>;
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  courseColors: { [key: string]: string };
}

const PeopleTab: React.FC<PeopleTabProps> = ({
  date,
  events,
  instructorsData,
  traineesData,
  onNavigateAndSelectPerson,
  scores,
  traineeLMPs,
  courseColors
}) => {
  // State for availability filtering
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const formatMilitaryTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    return timeString.replace(':', '');
  };

  // Personnel Unavailable calculation
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

  // Trainees waiting for night flying
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

  // Instructor and Trainee statistics
  const stats = useMemo(() => {
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
        traineesWithInstructorFromFlight.add(traineeName);
      } else {
        traineesWithOtherInstructors.add(traineeName);
      }
    }
    
    return {
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
  }, [date, events, instructorsData, traineesData]);

  // Next Event Lists
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
          if (!item.code.includes(' MB')) {
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

  // Trainee Availability
  const allCourses = useMemo(() => {
    const courses = new Set(traineesData.map(trainee => trainee.course).filter(course => course));
    return Array.from(courses).sort();
  }, [traineesData]);

  const { availableTrainees, unavailableTrainees, pausedTrainees } = useMemo(() => {
    const today = date;
    const available: Trainee[] = [];
    const unavailable: Trainee[] = [];
    const paused: Trainee[] = [];

    traineesData.forEach(trainee => {
      if (trainee.isPaused) {
        paused.push(trainee);
        return;
      }

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

  const filteredAvailableTrainees = useMemo(() => filterTrainees(availableTrainees), [availableTrainees, availabilityFilter, searchTerm]);
  const filteredUnavailableTrainees = useMemo(() => filterTrainees(unavailableTrainees), [unavailableTrainees, availabilityFilter, searchTerm]);
  const filteredPausedTrainees = useMemo(() => filterTrainees(pausedTrainees), [pausedTrainees, availabilityFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Personnel Unavailable */}
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

      {/* Waiting for Night Flying */}
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

      {/* Instructors */}
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

      {/* Trainees */}
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

      {/* Trainee Availability */}
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

      {/* Next Event Lists */}
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
  );
};

export default PeopleTab;