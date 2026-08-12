

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, InstructorRank, Trainee, Instructor } from '../types';
import AuditButton from './AuditButton';
import FlightTile from './FlightTile';
import PersonnelColumn from './PersonnelColumn';
import { AircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { isContinuationScheduleEvent } from '../utils/continuationEvents';
import { isFixedCrewLikeOperationalModel, normaliseOperationalModel } from '../utils/platformConfigService';
import { type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { scheduleEventIncludesPersonRecord, schedulePersonnelNamesMatch as personnelNamesMatch } from '../utils/scheduleEventPersonnel';

interface NextDayInstructorScheduleViewProps {
  events: ScheduleEvent[];
  instructors: { id?: string; idNumber?: number; name: string; rank: InstructorRank; unit?: string; role?: string }[];
  instructorsData?: Instructor[];
  traineesData: Trainee[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (updates: { eventId: string, newStartTime: number }[]) => void;
  zoomLevel: number;
  daylightTimes: { firstLight: string | null; lastLight: string | null };
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  seatConfigs: Map<string, string>;
  syllabusDetails: SyllabusItemDetail[];
  conflictingEventIds: Set<string>;
  showValidation: boolean;
  onSelectInstructor: (instructorName: string) => void;
  buildDfpDate: string;
  onDateChange: (direction: 'prev' | 'next') => void;
  aircraftNumberSettings?: AircraftNumberSettings;
  operationalModel?: string;
  crewPositionTerminology?: CrewPositionTerminology;
  instructorLabel?: string;
  simIpDisplayLabel?: string;
}

const PIXELS_PER_HOUR = 200;
const ROW_HEIGHT = 32;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const PERSONNEL_COLUMN_WIDTH = 160;
const TIME_HEADER_HEIGHT = 40;
type NextDayInstructorScheduleRow =
  | { type: 'unit'; unit: string; count: number }
  | { type: 'person'; instructor: { id?: string; idNumber?: number; name: string; rank: InstructorRank; unit?: string; role?: string } };

const addPersonnelName = (personnel: Set<string>, value?: string) => {
    const name = String(value || '').trim();
    if (name) personnel.add(name);
};

const getPersonnel = (event: ScheduleEvent): string[] => {
    const personnel = new Set<string>();
    const eventRecord = event as ScheduleEvent & { isTaskingRequest?: boolean; taskingRequestId?: string };
    const isTaskingEvent = eventRecord.isTaskingRequest === true || !!eventRecord.taskingRequestId || String(event.id || '').startsWith('tasking-');
    const isSctEvent = isContinuationScheduleEvent(event);

    if (isTaskingEvent || isSctEvent) {
        addPersonnelName(personnel, event.pilot);
        addPersonnelName(personnel, event.crew);
        addPersonnelName(personnel, event.instructor);
    } else if (event.flightType === 'Solo') {
        addPersonnelName(personnel, event.pilot || event.student || event.instructor);
    } else {
        addPersonnelName(personnel, event.instructor || event.pilot);
        addPersonnelName(personnel, event.crew);
        addPersonnelName(personnel, event.student);
    }

    event.attendees?.forEach(person => addPersonnelName(personnel, person));
    event.crewSelectionOrder?.forEach(person => addPersonnelName(personnel, person));
    return Array.from(personnel);
};

const getValidationEventKey = (event: ScheduleEvent): string =>
    [
        event.id,
        event.date || '',
        event.resourceId || '',
        event.startTime,
        event.duration,
        event.flightNumber || '',
        event.flightType || '',
        event.instructor || '',
        event.student || '',
        event.pilot || '',
        event.crew || ''
    ].join('|');

const NextDayInstructorScheduleView: React.FC<NextDayInstructorScheduleViewProps> = ({ 
    events, 
    instructors, 
    instructorsData = instructors as any,
    onSelectEvent, 
    onUpdateEvent,
    zoomLevel, 
    daylightTimes, 
    personnelData, 
    seatConfigs, 
    syllabusDetails, 
    conflictingEventIds, 
    showValidation,
    onSelectInstructor,
    traineesData,
    buildDfpDate,
    onDateChange,
    aircraftNumberSettings,
    operationalModel,
    crewPositionTerminology,
    instructorLabel = 'Instructor',
    simIpDisplayLabel = 'Contractor Staff',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  const [draggingState, setDraggingState] = useState<{
    mainEventId: string;
    xOffset: number;
    initialPositions: Map<string, { startTime: number, rowIndex: number }>;
  } | null>(null);

  const [realtimeConflict, setRealtimeConflict] = useState<{ conflictingEventId: string; conflictedPersonName: string; } | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const getTodayString = () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };
    setCurrentTime(new Date());
    if (buildDfpDate !== getTodayString()) return undefined;
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, [buildDfpDate]);

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString + 'T00:00:00Z');
      if (isNaN(date.getTime())) return '-';
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
      return `${day} ${month}`;
    } catch (e) {
      return '-';
    }
  };

  const formattedDate = useMemo(() => {
    return formatDate(buildDfpDate);
  }, [buildDfpDate]);

  const renderDiagnostics = useMemo(() => {
    const inputIdCounts = new Map<string, number>();
    events.forEach(event => {
      const id = String(event.id || '');
      if (id) inputIdCounts.set(id, (inputIdCounts.get(id) || 0) + 1);
    });
    const uniqueEvents = events.filter((event, index, source) => source.findIndex(candidate => candidate.id === event.id) === index);
    const tileRows = uniqueEvents.flatMap(event => {
      const personnel = getPersonnel(event);
      return instructors
        .filter(instructor => personnel.some(person => personnelNamesMatch(person, instructor.name)))
        .map(instructor => ({
          tileKey: `${event.id}-${instructor.name}`,
          eventId: event.id,
          instructor: instructor.name,
          unit: instructor.unit || '',
          rowIndex: instructors.findIndex(candidate => candidate.name === instructor.name),
          startTime: event.startTime,
          duration: event.duration,
          resourceId: event.resourceId,
          flightNumber: event.flightNumber,
          pilot: event.pilot || '',
          crew: event.crew || '',
          fixedCrewGroup: event.fixedCrewGroup || '',
          attendees: event.attendees || [],
        }));
    });
    const tileKeyCounts = new Map<string, number>();
    tileRows.forEach(row => tileKeyCounts.set(row.tileKey, (tileKeyCounts.get(row.tileKey) || 0) + 1));
    const duplicatedTileKeys = Array.from(tileKeyCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));
    const duplicateInputEventIds = Array.from(inputIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    return {
      timestamp: new Date().toISOString(),
      view: 'NextDayInstructorSchedule',
      buildDfpDate,
      operationalModel: operationalModel || '',
      eventCount: events.length,
      uniqueEventCount: uniqueEvents.length,
      instructorCount: instructors.length,
      tileCount: tileRows.length,
      duplicateInputEventIds,
      duplicatedTileKeys,
      sampleTiles: tileRows.slice(0, 80),
    };
  }, [buildDfpDate, events, instructors, operationalModel]);

  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('neo_staff_schedule_render_diag') || '[]');
      const next = [...(Array.isArray(existing) ? existing : []), renderDiagnostics].slice(-40);
      localStorage.setItem('neo_staff_schedule_render_diag', JSON.stringify(next));
      (window as any).neoStaffScheduleRenderDiag = next;
    } catch (error) {
      console.warn('[StaffScheduleDiag] Failed to store render diagnostic:', error);
    }
  }, [renderDiagnostics]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      const defaultStartHour = 8;
      const initialScrollLeft = (defaultStartHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
      scrollContainer.scrollLeft = initialScrollLeft;
    }
  }, [zoomLevel]);
  
  const findConflict = useCallback((eventsToCheck: ScheduleEvent[], existingEvents: ScheduleEvent[]): { conflictingEvent: ScheduleEvent, personName: string } | null => {
    for (const eventToCheck of eventsToCheck) {
        const s1 = syllabusDetails.find(d => d.id === eventToCheck.flightNumber);
        if (!s1) continue;

        const e1StartWithPre = eventToCheck.startTime - s1.preFlightTime;
        const e1EndWithPost = eventToCheck.startTime + eventToCheck.duration + s1.postFlightTime;

        for (const existingEvent of existingEvents) {
            if (eventToCheck.id === existingEvent.id) continue;
            const s2 = syllabusDetails.find(d => d.id === existingEvent.flightNumber);
            if (!s2) continue;

            const e2StartWithPre = existingEvent.startTime - s2.preFlightTime;
            const e2EndWithPost = existingEvent.startTime + existingEvent.duration + s2.postFlightTime;
            
            if (e1StartWithPre < e2EndWithPost && e1EndWithPost > e2StartWithPre) {
                const personnelToCheck = getPersonnel(eventToCheck);
                const existingPersonnel = getPersonnel(existingEvent);
                const conflictedPersonName = personnelToCheck.find(person =>
                    existingPersonnel.some(existingPerson => personnelNamesMatch(person, existingPerson))
                );

                if (conflictedPersonName) {
                    return { conflictingEvent: existingEvent, personName: conflictedPersonName };
                }
            }
        }
    }
    return null;
  }, [syllabusDetails]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, event: ScheduleEvent) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    document.body.classList.add('no-select');
    const tileElement = e.currentTarget;
    const rect = tileElement.getBoundingClientRect();
    const initialPositions = new Map<string, { startTime: number, rowIndex: number }>();
    const instructorName = getPersonnel(event)[0] || '';
    const rowIndex = instructors.findIndex(i => i.name === instructorName);
    
    if (rowIndex !== -1) {
        initialPositions.set(event.id, { startTime: event.startTime, rowIndex: rowIndex });
    }

    if (initialPositions.size > 0) {
        setDraggingState({
            mainEventId: event.id,
            xOffset: (e.clientX - rect.left) / zoomLevel,
            initialPositions,
        });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingState || !scheduleGridRef.current) return;
    didDragRef.current = true;
    const gridRect = scheduleGridRef.current.getBoundingClientRect();
    const xInGrid = e.clientX - gridRect.left;
    const newStartTime = (xInGrid / zoomLevel - draggingState.xOffset) / PIXELS_PER_HOUR + START_HOUR;
    const eventData = events.find(ev => ev.id === draggingState.mainEventId);
    if (!eventData) return;

    let clampedStartTime = newStartTime;
    if (clampedStartTime < START_HOUR) clampedStartTime = START_HOUR;
    if ((clampedStartTime + eventData.duration) > END_HOUR) clampedStartTime = END_HOUR - eventData.duration;

    const snappedStartTime = Math.round(clampedStartTime * 12) / 12;

    const proposedEvent = { ...eventData, startTime: snappedStartTime };
    const otherEvents = events.filter(event => event.id !== draggingState.mainEventId);
    const conflict = findConflict([proposedEvent], otherEvents);

    setRealtimeConflict(conflict ? { conflictingEventId: conflict.conflictingEvent.id, conflictedPersonName: conflict.personName } : null);
    
    if (snappedStartTime !== eventData.startTime) {
        onUpdateEvent([{ eventId: draggingState.mainEventId, newStartTime: snappedStartTime }]);
    }
  };

  const handleMouseUp = () => {
    document.body.classList.remove('no-select');
    setDraggingState(null);
    setRealtimeConflict(null);
    setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const showUnitHeadings = isFixedCrewLikeOperationalModel(operationalModel)
    && new Set(instructors.map(instructor => String(instructor.unit || '').trim()).filter(Boolean)).size > 1;
  const scheduleRows = useMemo<NextDayInstructorScheduleRow[]>(() => {
    if (!showUnitHeadings) return instructors.map(instructor => ({ type: 'person', instructor }));
    const unitCounts = instructors.reduce<Record<string, number>>((counts, instructor) => {
      const unit = String(instructor.unit || 'Unassigned').trim() || 'Unassigned';
      counts[unit] = (counts[unit] || 0) + 1;
      return counts;
    }, {});
    const rows: NextDayInstructorScheduleRow[] = [];
    let currentUnit = '';
    instructors.forEach(instructor => {
      const unit = String(instructor.unit || 'Unassigned').trim() || 'Unassigned';
      if (unit !== currentUnit) {
        currentUnit = unit;
        rows.push({ type: 'unit', unit, count: unitCounts[unit] || 0 });
      }
      rows.push({ type: 'person', instructor });
    });
    return rows;
  }, [instructors, showUnitHeadings]);

  const totalRows = scheduleRows.length;
  const timelineWidth = TOTAL_HOURS * PIXELS_PER_HOUR * zoomLevel;
  const containerHeight = totalRows * ROW_HEIGHT;

  const timeStringToHours = useCallback((timeString: string | null): number | null => {
    if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }, []);

  const renderTimeHeaders = () => {
    const markers = [];
    for (let i = START_HOUR; i <= END_HOUR; i++) {
        markers.push(
            <div key={i} className="absolute h-full top-0 text-xs text-gray-500 flex items-center" style={{ left: (i - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
                <span className="-translate-x-1/2">{`${String(i).padStart(2, '0')}:00`}</span>
            </div>
        );
    }
    
    const firstLightHour = timeStringToHours(daylightTimes.firstLight);
    const lastLightHour = timeStringToHours(daylightTimes.lastLight);

    if (firstLightHour !== null) {
        const flLeft = (firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        markers.push(
            <div key="fl-label" className="absolute h-full top-0 text-xs text-white font-bold flex items-center" style={{ left: flLeft }}>
                <span className="-translate-x-1/2">{`FL ${daylightTimes.firstLight}`}</span>
            </div>
        );
    }

    if (lastLightHour !== null) {
        const llLeft = (lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        markers.push(
            <div key="ll-label" className="absolute h-full top-0 text-xs text-white font-bold flex items-center" style={{ left: llLeft }}>
                <span className="-translate-x-1/2">{`LL ${daylightTimes.lastLight}`}</span>
            </div>
        );
    }

    return markers;
  };

  const renderGridLines = () => {
    const lines = [];
    for (let i = START_HOUR; i <= END_HOUR; i++) {
        lines.push(<div key={`v-${i}`} className="absolute h-full top-0 w-px bg-gray-700/50" style={{ left: (i - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }} />);
        if (i < END_HOUR) {
            lines.push(<div key={`v-${i}-30`} className="absolute h-full top-0 w-px bg-gray-700/25" style={{ left: (i - START_HOUR + 0.5) * PIXELS_PER_HOUR * zoomLevel }} />);
        }
    }
    for (let i = 1; i <= totalRows; i++) {
      lines.push(<div key={`h-${i}`} className="absolute left-0 w-full bg-gray-700/25" style={{ top: i * ROW_HEIGHT, height: '1px' }} />);
    }
    return lines;
  };
  
  // Removed grouping logic - reverting to original instructor order

  const renderPrePostBars = () => {
    const bars: React.ReactElement[] = [];
    // Deduplicate events by ID to prevent double-counting in pre/post bar logic
    const seenPrePostIds = new Set<string>();
    const uniqueEventsForBars = events.filter(e => {
      if (seenPrePostIds.has(e.id)) return false;
      seenPrePostIds.add(e.id);
      return true;
    });
  
    scheduleRows.forEach((row, rowIndex) => {
      if (row.type !== 'person') return;
      const { instructor } = row;
      const instructorEvents = uniqueEventsForBars
        .filter(e => e.instructor === instructor.name)
        .sort((a, b) => a.startTime - b.startTime);
  
      for (let i = 0; i < instructorEvents.length; i++) {
        const currentEvent = instructorEvents[i];
        const prevEvent = instructorEvents[i - 1];
        const nextEvent = instructorEvents[i + 1];
  
        const currentSyllabus = syllabusDetails.find(d => d.id === currentEvent.flightNumber);
        if (!currentSyllabus) continue;
        
        // Check if this event has any conflicts involving pre/post/turnaround times
        const hasPreConflict = prevEvent && (() => {
          const prevSyllabus = syllabusDetails.find(d => d.id === prevEvent.flightNumber);
          if (!prevSyllabus) return false;
          const prevPostEnd = prevEvent.startTime + prevEvent.duration + prevSyllabus.postFlightTime;
          const currentPreStart = currentEvent.startTime - currentSyllabus.preFlightTime;
          return prevPostEnd > currentPreStart;
        })();
        
        const hasPostConflict = nextEvent && (() => {
          const nextSyllabus = syllabusDetails.find(d => d.id === nextEvent.flightNumber);
          if (!nextSyllabus) return false;
          const currentPostEnd = currentEvent.startTime + currentEvent.duration + currentSyllabus.postFlightTime;
          const nextPreStart = nextEvent.startTime - nextSyllabus.preFlightTime;
          return currentPostEnd > nextPreStart;
        })();
        
        const isHovered = hoveredEventId === currentEvent.id;
        const hasAnyConflict = hasPreConflict || hasPostConflict;
        
        // Only render bars if: (hovered OR has conflict)
        if (!isHovered && !hasAnyConflict) continue;
        
        const renderBar = (duration: number, startTime: number, isConflicting: boolean, key: string) => {
          const barWidth = duration * PIXELS_PER_HOUR * zoomLevel;
          const barHeight = ROW_HEIGHT * 0.25;
          const barTop = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - barHeight) / 2;
          const barLeft = (startTime - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
  
          const baseClassName = "absolute pointer-events-none z-20 rounded-full border shadow-lg backdrop-blur-sm transition-colors duration-200";
          const className = `${baseClassName} ${isConflicting ? 'bg-red-500/50 border-red-400/30' : 'bg-white/50 border-white/30'}`;
  
          const style: React.CSSProperties = { 
            left: `${barLeft}px`, 
            top: `${barTop}px`, 
            width: `${barWidth}px`, 
            height: `${barHeight}px` 
          };
          
          bars.push(<div key={key} style={style} className={className} />);
        };
        
        // Render pre-flight bar
        if (currentSyllabus.preFlightTime > 0) {
          const preStartTime = currentEvent.startTime - currentSyllabus.preFlightTime;
          renderBar(currentSyllabus.preFlightTime, preStartTime, hasPreConflict || false, `${currentEvent.id}-pre`);
        }
        
        // Render post-flight bar
        if (currentSyllabus.postFlightTime > 0) {
          const postStartTime = currentEvent.startTime + currentEvent.duration;
          renderBar(currentSyllabus.postFlightTime, postStartTime, hasPostConflict || false, `${currentEvent.id}-post`);
        }
      }
    });
  
    return <>{bars}</>;
  };
  
  const renderDaylightLines = () => {
    const firstLightHour = timeStringToHours(daylightTimes.firstLight);
    const lastLightHour = timeStringToHours(daylightTimes.lastLight);
    
    return (
        <>
            {firstLightHour !== null && (
                <div
                    className="absolute top-0 h-full z-[5] pointer-events-none border-l border-dashed border-white/30"
                    style={{ left: `${(firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px` }}
                />
            )}
            {lastLightHour !== null && (
                 <div
                    className="absolute top-0 h-full z-[5] pointer-events-none border-l border-dashed border-white/30"
                    style={{ left: `${(lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px` }}
                />
            )}
        </>
    );
  };
  
  const renderNightShade = () => {
    const firstLightHour = timeStringToHours(daylightTimes.firstLight);
    const lastLightHour = timeStringToHours(daylightTimes.lastLight);
    const shades = [];
    if (firstLightHour !== null && firstLightHour > START_HOUR) {
        const width = (firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        shades.push(
            <div
                key="night-shade-morning"
                className="absolute top-0 left-0 h-full bg-white/5 pointer-events-none z-[1]"
                style={{ width: `${width}px` }}
            />
        );
    }
    if (lastLightHour !== null && lastLightHour < END_HOUR) {
        const left = (lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        const width = (END_HOUR - lastLightHour) * PIXELS_PER_HOUR * zoomLevel;
        shades.push(
            <div
                key="night-shade-evening"
                className="absolute top-0 h-full bg-white/5 pointer-events-none z-[1]"
                style={{ left: `${left}px`, width: `${width}px` }}
            />
        );
    }
    return <>{shades}</>;
  };


  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-gray-900">
      <div 
        style={{
          width: `${PERSONNEL_COLUMN_WIDTH + timelineWidth}px`,
          height: `${TIME_HEADER_HEIGHT + containerHeight}px`,
          display: 'grid',
          gridTemplateColumns: `${PERSONNEL_COLUMN_WIDTH}px 1fr`,
          gridTemplateRows: `${TIME_HEADER_HEIGHT}px 1fr`,
        }}
        onMouseLeave={() => {
            setHoveredRowIndex(null);
            handleMouseUp();
        }}
      >
        <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1 neo-build-header-cell">
            <div className="flex items-center gap-1 h-full">
                <div className="bg-gray-700 rounded-md flex items-center justify-center gap-1 px-1 neo-build-date-indicator" style={{height: "100%"}}>
                    <button 
                        onClick={() => onDateChange('prev')}
                        className="text-gray-400 hover:text-white transition-colors p-0.5"
                        title="Previous day"
                    >
                        ←
                    </button>
                    <span className="text-xs text-gray-300 font-bold tracking-wider whitespace-nowrap">{formattedDate}</span>
                    <button 
                        onClick={() => onDateChange('next')}
                        className="text-gray-400 hover:text-white transition-colors p-0.5"
                        title="Next day"
                    >
                        →
                    </button>
                </div>
                <div className="neo-build-label">NEO Build</div>
            </div>
        </div>
        
        <div className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700">
            <div className="relative" style={{ width: timelineWidth, height: TIME_HEADER_HEIGHT }}>
                {renderTimeHeaders()}
            </div>
        </div>
        
        <div className="sticky left-0 z-30 bg-gray-800 border-r border-gray-700">
          <PersonnelColumn
            personnel={instructors}
            rowHeight={ROW_HEIGHT}
            onRowEnter={setHoveredRowIndex}
            onPersonClick={onSelectInstructor}
            showUnits={showUnitHeadings}
            useUnitColors={true}
            useRoleColors={normaliseOperationalModel(operationalModel) === 'air_combat'}
            crewPositionTerminology={crewPositionTerminology}
            instructorLabel={instructorLabel}
            simIpDisplayLabel={simIpDisplayLabel}
          />
        </div>

        <div
            ref={scheduleGridRef} 
            className="relative"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {renderGridLines()}
            {renderNightShade()}
            {renderDaylightLines()}
            {renderPrePostBars()}
            {(() => {
              // Deduplicate events by ID to prevent stacked tiles causing visual alpha compositing artifacts
              const seenIds = new Set<string>();
              const uniqueEvents = events.filter(e => {
                if (seenIds.has(e.id)) return false;
                seenIds.add(e.id);
                return true;
              });
              return scheduleRows.flatMap((row, rowIndex) => {
              if (row.type === 'unit') {
                return [(
                  <div
                    key={`unit-band-${row.unit}-${rowIndex}`}
                    className="absolute left-0 right-0 z-[2] border-b border-gray-600/60 bg-gray-800/70"
                    style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                  />
                )];
              }
              const { instructor } = row;
              // Render row highlight if this row is hovered
              const rowHighlight = hoveredRowIndex === rowIndex ? (
                <div
                  key={`row-highlight-${rowIndex}`}
                  className="absolute top-0 left-0 right-0 pointer-events-none z-10"
                  style={{
                    height: ROW_HEIGHT,
                    top: rowIndex * ROW_HEIGHT,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                  }}
                />
              ) : null;

              const instructorEvents = uniqueEvents
                .filter(event => scheduleEventIncludesPersonRecord(event, instructor as any, {
                    personType: 'staff',
                    allPeople: instructorsData as any,
                }))
                .sort((a, b) => a.startTime - b.startTime);
              const eventTiles = instructorEvents.map(event => {
                const isDraggedTile = !!(draggingState && draggingState.mainEventId === event.id);
                const isStationaryConflictTile = event.id === realtimeConflict?.conflictingEventId;
                const isConflicting = (showValidation && conflictingEventIds.has(getValidationEventKey(event))) || isStationaryConflictTile || (isDraggedTile && !!realtimeConflict);
                let personToHighlight = null;
                if (realtimeConflict) {
                    const personnelOnThisTile = getPersonnel(event);
                    if ((isDraggedTile || isStationaryConflictTile) && personnelOnThisTile.some(person => personnelNamesMatch(person, realtimeConflict.conflictedPersonName))) {
                        personToHighlight = realtimeConflict.conflictedPersonName;
                    }
                }

                return (
                  <FlightTile
                    key={`${event.id}-${instructor.name}`}
                    event={event}
                    traineesData={traineesData}
                    instructorsData={instructorsData}
                    onSelectEvent={() => { if (!didDragRef.current) onSelectEvent(event); }}
                    onSelectAcademicTile={(tile) => {
                        if (didDragRef.current) return;
                        const syntheticEvent = {
                            ...event,
                            flightNumber: tile.lessonCode,
                            startTime: tile.startTime,
                            duration: tile.duration,
                            notes: tile.label && tile.label !== tile.lessonCode
                                ? tile.label.replace(new RegExp('^' + tile.lessonCode + '[\s:\u2014-]*'), '').trim()
                                : '',
                            _academicTileClick: true,
                        } as any;
                        onSelectEvent(syntheticEvent);
                    }}
                    onMouseDown={(e) => handleMouseDown(e, event)}
                    onMouseEnter={() => setHoveredEventId(event.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                    rowHeight={ROW_HEIGHT}
                    startHour={START_HOUR}
                    row={rowIndex}
                    isDragging={isDraggedTile}
                    isConflicting={isConflicting}
                    isUnavailabilityConflict={false}
                    conflictedPersonnelName={personToHighlight}
                    personnelData={personnelData}
                    seatConfigs={seatConfigs}
                    isDraggable={true}
                    currentTime={currentTime}
                    aircraftNumberSettings={aircraftNumberSettings}
                    disableLayoutTransition
                  />
                );
              });
              
              return [rowHighlight, ...eventTiles];
            })
            })()}
        </div>
      </div>
    </div>
  );
};

export default NextDayInstructorScheduleView;
