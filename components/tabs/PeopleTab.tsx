import React, { useMemo, useState } from 'react';
import { ScheduleEvent, Instructor, Trainee, UnavailabilityPeriod, Score, SyllabusItemDetail } from '../../types';
import InteractiveStatCard, { type InteractiveStatCardPersonDetail } from '../shared/InteractiveStatCard';
import AvailabilityCard from '../shared/AvailabilityCard';
import ListCard from '../shared/ListCard';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../../utils/resourceDisplayNames';
import {
  normaliseAirCombatTrainingAssignments,
  normaliseAirCombatTrainingReports,
  type AirCombatTrainingKind,
} from '../../utils/airCombatTraining';
import {
  getOperationalModelLabel,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
} from '../../utils/platformConfigService';

interface PeopleTabProps {
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  traineesData: Trainee[];
  onNavigateAndSelectPerson: (name: string) => void;
  scores: Map<string, Score[]>;
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  syllabusDetails?: SyllabusItemDetail[];
  courseColors: { [key: string]: string };
  resourceDisplayNames?: ResourceDisplayNames;
  instructorLabel?: string;
  operationalModel?: string;
  operationalContext?: {
    locationCode?: string;
    unitCode?: string;
    unitCodes?: string[];
  };
}

const PeopleTab: React.FC<PeopleTabProps> = ({
  date,
  events,
  instructorsData,
  traineesData,
  onNavigateAndSelectPerson,
  scores,
  traineeLMPs,
  syllabusDetails = [],
  courseColors,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  instructorLabel = 'Instructor',
  operationalModel,
  operationalContext,
}) => {
  // State for availability filtering
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const configuredInstructorLabel = String(instructorLabel || 'Instructor').trim() || 'Instructor';
  const instructorQualifiedLabel = `${configuredInstructorLabel}-qualified`;
  const instructorQualifiedPersonnelLabel = `${instructorQualifiedLabel.toLowerCase()} personnel`;
  const getInstructorIdentityKey = (instructor: Instructor): string => {
    const idNumber = Number(instructor.idNumber);
    if (Number.isFinite(idNumber) && idNumber > 0) return `idNumber:${idNumber}`;
    const dbId = String((instructor as any).id || '').trim();
    if (dbId) return `id:${dbId}`;
    return `name:${String(instructor.name || '').trim().toLowerCase()}`;
  };

  const getEventInstructorIdentityKey = (event: ScheduleEvent, staffByName: Map<string, Instructor>): string | null => {
    const refs = Array.isArray(event.personnelRefs) ? event.personnelRefs : [];
    const instructorRef = refs.find(ref =>
      ref.personType === 'staff' &&
      (ref.role === 'instructor' || ref.role === 'pilot') &&
      (!event.instructor || ref.name === event.instructor)
    ) || refs.find(ref => ref.personType === 'staff' && (ref.role === 'instructor' || ref.role === 'pilot'));
    if (instructorRef?.idNumber) return `idNumber:${instructorRef.idNumber}`;
    if (instructorRef?.id) return `id:${instructorRef.id}`;
    if (event.instructor) {
      const matchedStaff = staffByName.get(event.instructor);
      if (matchedStaff) return getInstructorIdentityKey(matchedStaff);
      return `name:${event.instructor.trim().toLowerCase()}`;
    }
    return null;
  };

  const normaliseBuildEventType = (event: ScheduleEvent): 'flight' | 'ftd' | 'cpt' | 'ground' => {
    if (event.type === 'flight') return 'flight';
    if (event.type === 'ftd') return 'ftd';
    if (event.type === 'cpt') return 'cpt';
    return 'ground';
  };

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
    // Exclude STBY events: STBY events may have instructor='TBA' (no real instructor found)
    // which causes trainees to incorrectly appear in 'Other Instructors' stats
    const flightOrFtdEvents = events.filter(e =>
      (e.type === 'flight' || e.type === 'ftd') &&
      !e.resourceId?.startsWith('STBY') &&
      !e.resourceId?.startsWith('FTD-STBY') &&
      !e.resourceId?.startsWith('BNF-STBY')
    );
    
    const instructorMap = new Map<string, Instructor>(instructorsData.map(i => [i.name, i]));
    const instructorLoadRows = new Map<string, {
      instructor: Instructor | null;
      displayName: string;
      idNumber?: number;
      unit?: string;
      total: number;
      breakdown: Record<'flight' | 'ftd' | 'cpt' | 'ground', string[]>;
    }>();
    const ensureInstructorLoadRow = (key: string, instructor: Instructor | null, fallbackName: string) => {
      if (!instructorLoadRows.has(key)) {
        instructorLoadRows.set(key, {
          instructor,
          displayName: instructor?.name || fallbackName,
          idNumber: instructor?.idNumber,
          unit: instructor?.unit,
          total: 0,
          breakdown: { flight: [], ftd: [], cpt: [], ground: [] },
        });
      }
      const row = instructorLoadRows.get(key)!;
      if (instructor && !row.instructor) {
        row.instructor = instructor;
        row.displayName = instructor.name;
        row.idNumber = instructor.idNumber;
        row.unit = instructor.unit;
      }
      return row;
    };
    events.forEach(event => {
      if (!event.instructor) return;
      const key = getEventInstructorIdentityKey(event, instructorMap);
      if (!key) return;
      const matchedInstructor = Array.from(instructorsData).find(instructor => getInstructorIdentityKey(instructor) === key) || instructorMap.get(event.instructor) || null;
      const row = ensureInstructorLoadRow(key, matchedInstructor, event.instructor);
      row.total += 1;
      const eventType = normaliseBuildEventType(event);
      const eventCode = String(event.flightNumber || '').trim() || String(event.type || '').toUpperCase();
      row.breakdown[eventType].push(eventCode);
    });

    const selectedDateStr = date;
    const unavailableInstructors = new Set<string>();
    instructorsData.forEach(instructor => {
      instructor.unavailability?.forEach(period => {
        if (selectedDateStr >= period.startDate && selectedDateStr < period.endDate) {
          unavailableInstructors.add(getInstructorIdentityKey(instructor));
        }
      });
    });
    const availableInstructors = instructorsData.filter(i => !unavailableInstructors.has(getInstructorIdentityKey(i)));
    const totalAvailableInstructors = availableInstructors.length;

    const formatInstructorLoadDetail = (instructor: Instructor): InteractiveStatCardPersonDetail => {
      const key = getInstructorIdentityKey(instructor);
      const load = instructorLoadRows.get(key) || ensureInstructorLoadRow(key, instructor, instructor.name);
      const buildGroup = (label: string, type: 'flight' | 'ftd' | 'cpt' | 'ground') => ({
        label,
        value: load.breakdown[type].length,
        events: Array.from(new Set(load.breakdown[type])),
      });
      return {
        name: instructor.name,
        detail: [instructor.unit, instructor.idNumber ? `ID ${instructor.idNumber}` : null].filter(Boolean).join(' / '),
        total: load.total,
        breakdown: [
          buildGroup('Flight', 'flight'),
          buildGroup('FTD', 'ftd'),
          buildGroup('CPT', 'cpt'),
          buildGroup('Ground', 'ground'),
        ],
      };
    };
    const sortInstructorLoadDetails = (left: InteractiveStatCardPersonDetail, right: InteractiveStatCardPersonDetail) =>
      String(left.detail || '').localeCompare(String(right.detail || '')) ||
      left.name.localeCompare(right.name);
    const instructorLoadDetailsForCount = (count: number): InteractiveStatCardPersonDetail[] => availableInstructors
      .filter(instructor => (instructorLoadRows.get(getInstructorIdentityKey(instructor))?.total || 0) === count)
      .map(formatInstructorLoadDetail)
      .sort(sortInstructorLoadDetails);

    const instructorsWithFourEventsDetails = instructorLoadDetailsForCount(4);
    const instructorsWithThreeEventsDetails = instructorLoadDetailsForCount(3);
    const instructorsWithTwoEventsDetails = instructorLoadDetailsForCount(2);
    const instructorsWithOneEventDetails = instructorLoadDetailsForCount(1);
    const instructorsWithZeroEventsDetails = instructorLoadDetailsForCount(0);
    const instructorsWithFourEventsList = instructorsWithFourEventsDetails.map(person => person.name);
    const instructorsWithThreeEventsList = instructorsWithThreeEventsDetails.map(person => person.name);
    const instructorsWithTwoEventsList = instructorsWithTwoEventsDetails.map(person => person.name);
    const instructorsWithOneEventList = instructorsWithOneEventDetails.map(person => person.name);
    const instructorsWithZeroEventsList = instructorsWithZeroEventsDetails.map(person => person.name);

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
    const traineesWithPrimary = new Set<string>();
    const traineesWithSecondary = new Set<string>();
    const traineesWithInstructorFromFlight = new Set<string>();
    const traineesWithOtherInstructors = new Set<string>();

    for (const event of flightOrFtdEvents) {
      const traineeName = event.student || event.pilot;
      // Skip events with no trainee name or no assigned instructor (e.g. STBY events)
      if (!traineeName || !event.instructor) continue;

      // Skip if trainee not found in our data (prevents ghost entries)
      const trainee = traineeMap.get(traineeName);
      if (!trainee) continue;

      const instructorName = event.instructor;
      const instructor = instructorMap.get(instructorName);

      const primaryArr = Array.isArray(trainee.primaryInstructor) ? trainee.primaryInstructor : trainee.primaryInstructor ? [trainee.primaryInstructor] : [];
      const secondaryArr = Array.isArray(trainee.secondaryInstructor) ? trainee.secondaryInstructor : trainee.secondaryInstructor ? [trainee.secondaryInstructor] : [];
      if (primaryArr.includes(instructorName)) {
        traineesWithPrimary.add(traineeName);
      } else if (secondaryArr.includes(instructorName)) {
        traineesWithSecondary.add(traineeName);
      } else if (instructor && trainee.flight && instructor.flight === trainee.flight) {
        traineesWithInstructorFromFlight.add(traineeName);
      } else {
        traineesWithOtherInstructors.add(traineeName);
      }
    }

    // A trainee in "Other Instructors" should only appear there if they have NO events
    // with their primary, secondary, or same-flight instructor. If they have at least one
    // preferred pairing for the day, remove them from the "Other" category.
    // Also ensure only trainees with actual events (in traineeEventCounts) are included.
    traineesWithPrimary.forEach(name => traineesWithOtherInstructors.delete(name));
    traineesWithSecondary.forEach(name => traineesWithOtherInstructors.delete(name));
    traineesWithInstructorFromFlight.forEach(name => traineesWithOtherInstructors.delete(name));
    // Remove any trainee from "Other" who has zero total flight/FTD events (edge-case guard)
    traineesWithOtherInstructors.forEach(name => {
      if (!traineeEventCounts.has(name)) traineesWithOtherInstructors.delete(name);
    });
    
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
      instructorsWithFourEventsDetails,
      instructorsWithThreeEventsDetails,
      instructorsWithTwoEventsDetails,
      instructorsWithOneEventDetails,
      instructorsWithZeroEventsDetails,
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
  const sectionShell = 'overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]';
  const sectionHeader = 'border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4';
  const sectionBody = 'p-5';
  const fieldsetShell = 'rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]';
  const legendClass = 'px-2 text-lg font-semibold text-white';
  const inputClass = 'bg-slate-950 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all';
  const activeModel = normaliseOperationalModel(operationalModel);
  const isCrewOperationalModel = activeModel === 'air_combat' || isFixedCrewLikeOperationalModel(activeModel);
  const activeModelLabel = getOperationalModelLabel(activeModel);
  const activeUnitCodes = useMemo(() => {
    const codes = operationalContext?.unitCodes && operationalContext.unitCodes.length > 0
      ? operationalContext.unitCodes
      : String(operationalContext?.unitCode || '').split('+');
    return new Set(codes.map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  }, [operationalContext?.unitCode, operationalContext?.unitCodes]);

  const getEventPeople = (event: ScheduleEvent): string[] => {
    const names = [
      event.instructor,
      event.pilot,
      event.crew,
      event.student,
      ...((event.attendees || []) as string[]),
    ].map(name => String(name || '').trim()).filter(name => name && !/^TBA$/i.test(name));
    return Array.from(new Set(names));
  };

  const getEventStaffIdentityKeys = (event: ScheduleEvent, staffByName: Map<string, Instructor>): Set<string> => {
    const keys = new Set<string>();
    const refs = Array.isArray(event.personnelRefs) ? event.personnelRefs : [];
    refs
      .filter(ref => ref.personType === 'staff')
      .forEach(ref => {
        if (ref.idNumber) keys.add(`idNumber:${ref.idNumber}`);
        else if (ref.id) keys.add(`id:${ref.id}`);
        else if (ref.name) {
          const staff = staffByName.get(ref.name);
          keys.add(staff ? getInstructorIdentityKey(staff) : `name:${ref.name.trim().toLowerCase()}`);
        }
      });
    [event.instructor, event.pilot, event.crew, ...((event.attendees || []) as string[])]
      .map(name => String(name || '').trim())
      .filter(name => name && !/^TBA$/i.test(name))
      .forEach(name => {
        const staff = staffByName.get(name);
        if (staff) keys.add(getInstructorIdentityKey(staff));
      });
    return keys;
  };

  const normaliseEventType = (item?: SyllabusItemDetail | null): 'flight' | 'ftd' | 'cpt' | 'ground' => {
    if (!item) return 'ground';
    if (item.type === 'Flight') return 'flight';
    if (item.type === 'FTD') return String(item.code || '').toUpperCase().includes('CPT') ? 'cpt' : 'ftd';
    if (String(item.code || '').toUpperCase().includes('CPT')) return 'cpt';
    return 'ground';
  };

  const getTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
    (item.courses || []).find(Boolean) || item.code || ''
  );

  const matchesAirCombatAssignment = (
    item: SyllabusItemDetail,
    kind: AirCombatTrainingKind,
    code: string,
    unitCode?: string,
  ): boolean => {
    const itemKind: AirCombatTrainingKind = item.lmpType === 'Staff CAT' ? 'training_package' : 'course';
    if (itemKind !== kind) return false;
    const itemCode = String(getTrainingCodeFromItem(item) || '').trim().toUpperCase();
    const assignmentCode = String(code || '').trim().toUpperCase();
    if (itemCode !== assignmentCode && !String(item.code || '').trim().toUpperCase().startsWith(assignmentCode)) return false;
    const itemUnit = String(item.unit || '').trim().toUpperCase();
    const assignmentUnit = String(unitCode || '').trim().toUpperCase();
    return !assignmentUnit || !itemUnit || itemUnit === assignmentUnit;
  };

  const sortTrainingItems = (items: SyllabusItemDetail[]): SyllabusItemDetail[] => (
    [...items].sort((left, right) =>
      Number((left as any).sortOrder ?? Number.MAX_SAFE_INTEGER) - Number((right as any).sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      String(left.orderKey || '').localeCompare(String(right.orderKey || '')) ||
      String(left.code || '').localeCompare(String(right.code || ''))
    )
  );

  const airCombatPeopleMetrics = useMemo(() => {
    const activeStaff = instructorsData.filter(staff => {
      const staffUnit = String(staff.unit || '').trim().toUpperCase();
      return activeUnitCodes.size === 0 || !staffUnit || activeUnitCodes.has(staffUnit);
    });
    const staffByName = new Map(activeStaff.map(staff => [staff.name, staff]));
    const eventStaff = new Set<string>();
    const staffEventCounts = new Map<string, number>();
    events.forEach(event => {
      getEventStaffIdentityKeys(event, staffByName).forEach(staffKey => {
        eventStaff.add(staffKey);
        staffEventCounts.set(staffKey, (staffEventCounts.get(staffKey) || 0) + 1);
      });
    });
    const unavailableStaffKeys = new Set<string>();
    activeStaff.forEach(staff => {
      const unavailable = (staff.unavailability || []).some(period => date >= period.startDate && date < period.endDate);
      if (unavailable) unavailableStaffKeys.add(getInstructorIdentityKey(staff));
    });
    const availableActiveStaff = activeStaff.filter(staff => !unavailableStaffKeys.has(getInstructorIdentityKey(staff)));
    const staffWithFourEventsList = availableActiveStaff
      .filter(staff => (staffEventCounts.get(getInstructorIdentityKey(staff)) || 0) >= 4)
      .map(staff => staff.name)
      .sort();
    const staffWithThreeEventsList = availableActiveStaff
      .filter(staff => (staffEventCounts.get(getInstructorIdentityKey(staff)) || 0) === 3)
      .map(staff => staff.name)
      .sort();
    const staffWithTwoEventsList = availableActiveStaff
      .filter(staff => (staffEventCounts.get(getInstructorIdentityKey(staff)) || 0) === 2)
      .map(staff => staff.name)
      .sort();
    const staffWithOneEventList = availableActiveStaff
      .filter(staff => (staffEventCounts.get(getInstructorIdentityKey(staff)) || 0) === 1)
      .map(staff => staff.name)
      .sort();
    const staffWithZeroEventsList = availableActiveStaff
      .filter(staff => (staffEventCounts.get(getInstructorIdentityKey(staff)) || 0) === 0)
      .map(staff => staff.name)
      .sort();

    const roleRows = new Map<string, { role: string; total: number; available: number; unavailable: number; scheduled: number; names: string[] }>();
    activeStaff.forEach(staff => {
      const role = String(staff.role || 'Unassigned').trim() || 'Unassigned';
      if (!roleRows.has(role)) roleRows.set(role, { role, total: 0, available: 0, unavailable: 0, scheduled: 0, names: [] });
      const row = roleRows.get(role)!;
      row.total += 1;
      row.names.push(staff.name);
      if (unavailableStaffKeys.has(getInstructorIdentityKey(staff))) row.unavailable += 1;
      else row.available += 1;
      if (eventStaff.has(getInstructorIdentityKey(staff))) row.scheduled += 1;
    });

    const totals = Array.from(roleRows.values()).reduce((acc, row) => ({
      total: acc.total + row.total,
      available: acc.available + row.available,
      unavailable: acc.unavailable + row.unavailable,
      scheduled: acc.scheduled + row.scheduled,
    }), { total: 0, available: 0, unavailable: 0, scheduled: 0 });

    const completedReportCodesByStaffAndKey = new Map<string, Set<string>>();
    const reportDatesByStaffAndKey = new Map<string, string[]>();
    activeStaff.forEach(staff => {
      normaliseAirCombatTrainingReports(staff.preferences).forEach(report => {
        if (report.status && report.status !== 'Complete') return;
        const key = `${staff.name}::${report.trainingKind || ''}::${String(report.trainingCode || '').toUpperCase()}`;
        if (!completedReportCodesByStaffAndKey.has(key)) completedReportCodesByStaffAndKey.set(key, new Set());
        completedReportCodesByStaffAndKey.get(key)!.add(String(report.eventCode || '').toUpperCase());
        if (!reportDatesByStaffAndKey.has(key)) reportDatesByStaffAndKey.set(key, []);
        if (report.date) reportDatesByStaffAndKey.get(key)!.push(report.date);
      });
    });

    const assignmentRows = activeStaff.flatMap(staff => {
      const assignments = normaliseAirCombatTrainingAssignments(staff.preferences);
      return [...assignments.courses, ...assignments.trainingPackages].map(assignment => {
        const assignmentUnit = String(assignment.unitCode || staff.unit || '').trim().toUpperCase();
        if (activeUnitCodes.size > 0 && assignmentUnit && !activeUnitCodes.has(assignmentUnit)) return null;
        const items = sortTrainingItems(syllabusDetails.filter(item => matchesAirCombatAssignment(item, assignment.kind, assignment.code, assignment.unitCode)));
        const reportKey = `${staff.name}::${assignment.kind}::${String(assignment.code || '').toUpperCase()}`;
        const completedCodes = completedReportCodesByStaffAndKey.get(reportKey) || new Set<string>();
        const nextItem = items.find(item => !completedCodes.has(String(item.code || '').toUpperCase())) || null;
        const reportDates = reportDatesByStaffAndKey.get(reportKey) || [];
        const lastDate = reportDates.sort().slice(-1)[0] || '';
        const daysSince = lastDate
          ? Math.max(0, Math.floor((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${lastDate}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)))
          : 999;
        return {
          staff,
          kind: assignment.kind,
          code: assignment.code,
          title: assignment.title || assignment.code,
          nextItem,
          completedCount: completedCodes.size,
          totalEvents: items.length,
          lastDate,
          daysSince,
          reason: lastDate
            ? `${daysSince} days since last completed ${assignment.code} event, ${completedCodes.size}/${items.length} complete.`
            : `No completed ${assignment.code} event recorded, ${completedCodes.size}/${items.length} complete.`,
        };
      }).filter(Boolean);
    }) as Array<{
      staff: Instructor;
      kind: AirCombatTrainingKind;
      code: string;
      title: string;
      nextItem: SyllabusItemDetail | null;
      completedCount: number;
      totalEvents: number;
      lastDate: string;
      daysSince: number;
      reason: string;
    }>;

    const priorityRows = assignmentRows
      .filter(row => row.nextItem)
      .sort((left, right) =>
        right.daysSince - left.daysSince ||
        left.completedCount - right.completedCount ||
        left.staff.name.localeCompare(right.staff.name) ||
        left.code.localeCompare(right.code)
      );
    const courseRows = priorityRows.filter(row => row.kind === 'course');
    const packageRows = priorityRows.filter(row => row.kind === 'training_package');
    const byType = (rows: typeof priorityRows, type: 'flight' | 'ftd' | 'cpt' | 'ground') => rows.filter(row => normaliseEventType(row.nextItem) === type);

    return {
      roleRows: Array.from(roleRows.values()).sort((left, right) => left.role.localeCompare(right.role)),
      totals,
      staffEventBuckets: {
        totalAvailable: availableActiveStaff.length,
        withFourEvents: staffWithFourEventsList.length,
        withThreeEvents: staffWithThreeEventsList.length,
        withTwoEvents: staffWithTwoEventsList.length,
        withOneEvent: staffWithOneEventList.length,
        withZeroEvents: staffWithZeroEventsList.length,
        withFourEventsList: staffWithFourEventsList,
        withThreeEventsList: staffWithThreeEventsList,
        withTwoEventsList: staffWithTwoEventsList,
        withOneEventList: staffWithOneEventList,
        withZeroEventsList: staffWithZeroEventsList,
      },
      unavailableList: activeStaff
        .filter(staff => unavailableStaffKeys.has(getInstructorIdentityKey(staff)))
        .map(staff => ({ name: staff.name, rank: staff.rank, role: staff.role || 'Unassigned' }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      priorityRows,
      courseRows,
      packageRows,
      nextLists: {
        flight: byType(priorityRows, 'flight'),
        ftd: byType(priorityRows, 'ftd'),
        cpt: byType(priorityRows, 'cpt'),
        ground: byType(priorityRows, 'ground'),
      },
    };
  }, [activeUnitCodes, date, events, instructorsData, syllabusDetails]);

  const AirCombatPriorityTable: React.FC<{ title: string; rows: typeof airCombatPeopleMetrics.priorityRows; limit?: number }> = ({ title, rows, limit = 12 }) => (
    <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/45">
      <div className="border-b border-slate-700/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="max-h-96 overflow-auto">
        {rows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Stream</th>
                <th className="px-3 py-2">Next</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row, index) => (
                <tr key={`${row.staff.idNumber}-${row.kind}-${row.code}`} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2">
                    <button className="text-left font-semibold text-cyan-100 hover:text-cyan-300" onClick={() => onNavigateAndSelectPerson(row.staff.name)}>
                      {row.staff.name}
                    </button>
                    <div className="text-xs text-slate-500">{row.staff.role || 'Unassigned'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-slate-100">{row.code}</span>
                    <div className="text-xs text-slate-500">{row.kind === 'course' ? 'Course' : 'Package'}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-emerald-200">{row.nextItem?.code || 'Complete'}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-center text-sm text-slate-400">No active priority items found.</p>
        )}
      </div>
    </div>
  );

  if (isCrewOperationalModel) {
    return (
      <div className="space-y-6">
        <div className={sectionShell}>
          <div className={sectionHeader}>
            <h2 className="text-lg font-semibold text-white">{activeModelLabel} Staff Availability</h2>
          </div>
          <div className={sectionBody}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Total Staff</p>
                <p className="text-2xl font-bold text-white">{airCombatPeopleMetrics.totals.total}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="text-sm text-green-400">Available</p>
                <p className="text-2xl font-bold text-green-400">{airCombatPeopleMetrics.totals.available}</p>
              </div>
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
                <p className="text-sm text-red-400">Unavailable</p>
                <p className="text-2xl font-bold text-red-400">{airCombatPeopleMetrics.totals.unavailable}</p>
              </div>
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-4">
                <p className="text-sm text-cyan-300">Scheduled</p>
                <p className="text-2xl font-bold text-cyan-200">{airCombatPeopleMetrics.totals.scheduled}</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-lg border border-slate-700/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Unavailable</th>
                    <th className="px-4 py-3">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {airCombatPeopleMetrics.roleRows.map(row => (
                    <tr key={row.role} className="border-t border-slate-800">
                      <td className="px-4 py-3 font-semibold text-white">{row.role}</td>
                      <td className="px-4 py-3 text-slate-200">{row.total}</td>
                      <td className="px-4 py-3 text-emerald-300">{row.available}</td>
                      <td className="px-4 py-3 text-rose-300">{row.unavailable}</td>
                      <td className="px-4 py-3 text-cyan-200">{row.scheduled}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-cyan-500/30 bg-cyan-500/10 font-semibold">
                    <td className="px-4 py-3 text-white">Total</td>
                    <td className="px-4 py-3 text-white">{airCombatPeopleMetrics.totals.total}</td>
                    <td className="px-4 py-3 text-emerald-200">{airCombatPeopleMetrics.totals.available}</td>
                    <td className="px-4 py-3 text-rose-200">{airCombatPeopleMetrics.totals.unavailable}</td>
                    <td className="px-4 py-3 text-cyan-100">{airCombatPeopleMetrics.totals.scheduled}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <fieldset className={fieldsetShell}>
          <legend className={legendClass}>Staff</legend>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <InteractiveStatCard title="Staff with 4+ Events" value={airCombatPeopleMetrics.staffEventBuckets.withFourEvents} description={`of ${airCombatPeopleMetrics.staffEventBuckets.totalAvailable} available`} personnelList={airCombatPeopleMetrics.staffEventBuckets.withFourEventsList} onPersonClick={onNavigateAndSelectPerson} />
            <InteractiveStatCard title="Staff with 3 Events" value={airCombatPeopleMetrics.staffEventBuckets.withThreeEvents} description={`of ${airCombatPeopleMetrics.staffEventBuckets.totalAvailable} available`} personnelList={airCombatPeopleMetrics.staffEventBuckets.withThreeEventsList} onPersonClick={onNavigateAndSelectPerson} />
            <InteractiveStatCard title="Staff with 2 Events" value={airCombatPeopleMetrics.staffEventBuckets.withTwoEvents} description={`of ${airCombatPeopleMetrics.staffEventBuckets.totalAvailable} available`} personnelList={airCombatPeopleMetrics.staffEventBuckets.withTwoEventsList} onPersonClick={onNavigateAndSelectPerson} />
            <InteractiveStatCard title="Staff with 1 Event" value={airCombatPeopleMetrics.staffEventBuckets.withOneEvent} description={`of ${airCombatPeopleMetrics.staffEventBuckets.totalAvailable} available`} personnelList={airCombatPeopleMetrics.staffEventBuckets.withOneEventList} onPersonClick={onNavigateAndSelectPerson} />
            <InteractiveStatCard title="Staff with 0 Events" value={airCombatPeopleMetrics.staffEventBuckets.withZeroEvents} description={`of ${airCombatPeopleMetrics.staffEventBuckets.totalAvailable} available`} personnelList={airCombatPeopleMetrics.staffEventBuckets.withZeroEventsList} onPersonClick={onNavigateAndSelectPerson} />
          </div>
        </fieldset>

        <div className={sectionShell}>
          <div className={sectionHeader}>
            <h2 className="text-lg font-semibold text-white">Operational Training Priority Lists</h2>
          </div>
          <div className={`${sectionBody} space-y-4`}>
            <AirCombatPriorityTable title="Composite Course / Package Priority List" rows={airCombatPeopleMetrics.priorityRows} limit={20} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AirCombatPriorityTable title="Courses Priority Table" rows={airCombatPeopleMetrics.courseRows} />
              <AirCombatPriorityTable title="Training Packages Priority Table" rows={airCombatPeopleMetrics.packageRows} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <AirCombatPriorityTable title="Next Flight" rows={airCombatPeopleMetrics.nextLists.flight} limit={8} />
              <AirCombatPriorityTable title={`Next ${resourceDisplayNames.ftd}`} rows={airCombatPeopleMetrics.nextLists.ftd} limit={8} />
              <AirCombatPriorityTable title={`Next ${resourceDisplayNames.cpt}`} rows={airCombatPeopleMetrics.nextLists.cpt} limit={8} />
              <AirCombatPriorityTable title="Next Ground" rows={airCombatPeopleMetrics.nextLists.ground} limit={8} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personnel Unavailable */}
      <div className={sectionShell}>
        <div className={sectionHeader}>
          <h2 className="text-lg font-semibold text-white">Personnel Unavailable</h2>
        </div>
        <div className={sectionBody}>
        {unavailableOnSelectedDate.length > 0 ? (
          <div className="max-h-60 overflow-y-auto pr-2">
            <ul className="space-y-3">
              {unavailableOnSelectedDate.map((item, index) => (
                <li key={index} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-950/45 p-3 text-sm">
                  <div className="flex items-center space-x-3">
                    <span className="w-12 text-right font-mono text-slate-500">{item.rank}</span>
                    <span className="font-semibold text-white">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-amber-300 font-medium">{item.period.reason}</span>
                    <span className="w-32 text-right font-mono text-slate-300">
                      {item.period.allDay ? 'All Day' : `${formatMilitaryTime(item.period.startTime)} - ${formatMilitaryTime(item.period.endTime)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="py-4 text-center text-slate-400">No personnel are recorded as unavailable for this date.</p>
        )}
        </div>
      </div>

      {/* Waiting for Night Flying */}
      <div className={sectionShell}>
        <div className={sectionHeader}>
          <h2 className="text-lg font-semibold text-white">Waiting for Night Flying</h2>
        </div>
        <div className={sectionBody}>
        {traineesWaitingForNightFlying.length > 0 ? (
          <div className="max-h-60 overflow-y-auto pr-2">
            <ul className="space-y-3">
              {traineesWaitingForNightFlying.map(({ trainee, event }, index) => (
                <li key={index} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-950/45 p-3 text-sm">
                  <div className="flex items-center space-x-3">
                    <span className="w-12 text-right font-mono text-slate-500">{trainee.rank}</span>
                    <span className="font-semibold text-white">{trainee.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="font-medium text-slate-300">{trainee.course}</span>
                    <span className="font-mono text-sky-400">{event.code}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="py-4 text-center text-slate-400">No trainees are currently waiting for a night flying event.</p>
        )}
        </div>
      </div>

      {/* Instructor-qualified personnel */}
      <fieldset className={fieldsetShell}>
        <legend className={legendClass}>{instructorQualifiedLabel} Personnel</legend>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <InteractiveStatCard
            title={`${instructorQualifiedLabel} with 4 Events`}
            value={stats.instructorsWithFourEvents}
            description={`of ${stats.totalAvailableInstructors} available`}
            personnelList={stats.instructorsWithFourEventsList}
            personnelDetails={stats.instructorsWithFourEventsDetails}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`${instructorQualifiedLabel} with 3 Events`}
            value={stats.instructorsWithThreeEvents}
            description={`of ${stats.totalAvailableInstructors} available`}
            personnelList={stats.instructorsWithThreeEventsList}
            personnelDetails={stats.instructorsWithThreeEventsDetails}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`${instructorQualifiedLabel} with 2 Events`}
            value={stats.instructorsWithTwoEvents}
            description={`of ${stats.totalAvailableInstructors} available`}
            personnelList={stats.instructorsWithTwoEventsList}
            personnelDetails={stats.instructorsWithTwoEventsDetails}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`${instructorQualifiedLabel} with 1 Event`}
            value={stats.instructorsWithOneEvent}
            description={`of ${stats.totalAvailableInstructors} available`}
            personnelList={stats.instructorsWithOneEventList}
            personnelDetails={stats.instructorsWithOneEventDetails}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`${instructorQualifiedLabel} with 0 Events`}
            value={stats.instructorsWithZeroEvents}
            description={`of ${stats.totalAvailableInstructors} available`}
            personnelList={stats.instructorsWithZeroEventsList}
            personnelDetails={stats.instructorsWithZeroEventsDetails}
            onPersonClick={onNavigateAndSelectPerson}
          />
        </div>
      </fieldset>

      {/* Trainees */}
      <fieldset className={fieldsetShell}>
        <legend className={legendClass}>Trainees</legend>
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
            description={`Paired with primary ${instructorQualifiedPersonnelLabel}`}
            personnelList={stats.traineesWithPrimaryList}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title="Trainees with their Secondary"
            value={stats.traineesWithSecondaryList.length}
            description={`Paired with secondary ${instructorQualifiedPersonnelLabel}`}
            personnelList={stats.traineesWithSecondaryList}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`Trainees with Flight ${instructorQualifiedLabel}`}
            value={stats.traineesWithInstructorFromFlightList.length}
            description={`Paired with ${instructorQualifiedPersonnelLabel} from same flight`}
            personnelList={stats.traineesWithInstructorFromFlightList}
            onPersonClick={onNavigateAndSelectPerson}
          />
          <InteractiveStatCard
            title={`Trainees with Other ${instructorQualifiedLabel}`}
            value={stats.traineesWithOtherInstructorsList.length}
            description={`Paired with other ${instructorQualifiedPersonnelLabel}`}
            personnelList={stats.traineesWithOtherInstructorsList}
            onPersonClick={onNavigateAndSelectPerson}
          />
        </div>
      </fieldset>

      {/* Trainee Availability */}
      <div className={`${sectionShell} mb-6`}>
        <div className={sectionHeader}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h2 className="text-lg font-semibold text-white">Trainee Availability</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search trainees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full sm:w-64 px-3 py-2 pl-10 rounded-md text-sm ${inputClass}`}
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="availability-filter" className="text-sm font-medium text-slate-300 whitespace-nowrap">Course:</label>
              <select 
                id="availability-filter"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className={`px-3 py-2 rounded-md text-sm ${inputClass}`}
              >
                <option value="all">All Courses</option>
                {allCourses.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        </div>
        <div className={sectionBody}>
        
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
          <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-4">
            <p className="text-sm text-slate-400">Total Trainees</p>
            <p className="text-2xl font-bold text-white">{traineesData.length}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-sm text-green-400">Available</p>
            <p className="text-2xl font-bold text-green-400">{filteredAvailableTrainees.length}</p>
            <p className="text-xs text-green-300">
              {traineesData.length > 0 ? Math.round((filteredAvailableTrainees.length / traineesData.length) * 100) : 0}%
            </p>
          </div>
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">Unavailable</p>
            <p className="text-2xl font-bold text-red-400">{filteredUnavailableTrainees.length}</p>
            <p className="text-xs text-red-300">
              {traineesData.length > 0 ? Math.round((filteredUnavailableTrainees.length / traineesData.length) * 100) : 0}%
            </p>
          </div>
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-400">Paused</p>
            <p className="text-2xl font-bold text-yellow-400">{filteredPausedTrainees.length}</p>
            <p className="text-xs text-yellow-300">
              {traineesData.length > 0 ? Math.round((filteredPausedTrainees.length / traineesData.length) * 100) : 0}%
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Next Event Lists */}
      <div className={sectionShell}>
        <div className={sectionHeader}>
          <h2 className="text-lg font-semibold text-white">Next Event Lists</h2>
        </div>
        <div className={sectionBody}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ListCard title="Next Event – Flight" trainees={nextEventLists.flight} />
          <ListCard title={`Next Event – ${resourceDisplayNames.ftd}`} trainees={nextEventLists.ftd} />
          <ListCard title={`Next Event – ${resourceDisplayNames.cpt}`} trainees={nextEventLists.cpt} />
          <ListCard title="Next Event – Ground" trainees={nextEventLists.ground} />
          <ListCard title="Next +1 – Flight" trainees={nextPlusOneLists.flight} />
          <ListCard title={`Next +1 – ${resourceDisplayNames.ftd}`} trainees={nextPlusOneLists.ftd} />
          <ListCard title={`Next +1 – ${resourceDisplayNames.cpt}`} trainees={nextPlusOneLists.cpt} />
          <ListCard title="Next +1 – Ground School" trainees={nextPlusOneLists.ground} />
        </div>
        </div>
      </div>
    </div>
  );
};

export default PeopleTab;
