

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Trainee } from '../types';
import AuditButton from './AuditButton';
import FlightTile from './FlightTile';
import TraineeColumn from './TraineeColumn';

interface TraineeScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  events: ScheduleEvent[];
  trainees: string[];
  traineesData: Trainee[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (updates: { eventId: string, newStartTime: number }[]) => void;
  zoomLevel: number;
  daylightTimes: { firstLight: string | null; lastLight: string | null };
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
  seatConfigs: Map<string, string>;
  syllabusDetails: SyllabusItemDetail[];
  conflictingEventIds: Set<string>;
  showValidation: boolean;
  unavailabilityConflicts: Map<string, string[]>;
  onSelectTrainee: (traineeFullName: string) => void;
  courseColors: { [key: string]: string };
}

const PIXELS_PER_HOUR = 200;
const ROW_HEIGHT = 32;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const PERSONNEL_COLUMN_WIDTH = 160;
const TIME_HEADER_HEIGHT = 40;

// --- Utility functions ---
const getPersonnel = (event: ScheduleEvent): string[] => {
    const personnel = [];
    if (event.flightType === 'Solo') {
        if (event.pilot) personnel.push(event.pilot);
    } else {
        if (event.instructor) personnel.push(event.instructor);
        if (event.student) personnel.push(event.student);
    }
    return personnel;
};

// Create unavailability events for rendering
const createUnavailabilityEvents = (date: string, personnelData: Trainee[]): ScheduleEvent[] => {
    const unavailabilityEvents: ScheduleEvent[] = [];
    
    personnelData.forEach(person => {
        const unavailabilityPeriods = person.unavailability || [];
        
        unavailabilityPeriods.forEach((period: any) => {
            // Check if the unavailability period includes the current date
            const currentDate = new Date(date + 'T00:00:00Z');
            const startDate = new Date(period.startDate + 'T00:00:00Z');
            const endDate = new Date(period.endDate + 'T00:00:00Z');
            
            // For all-day events, the end date is the first day they return, so adjust it
            const effectiveEndDate = new Date(endDate);
            if (period.allDay) {
                effectiveEndDate.setDate(effectiveEndDate.getDate() - 1);
            }
            
            if (currentDate >= startDate && currentDate <= effectiveEndDate) {
                // Calculate start and end times for today
                let startTime = period.allDay ? 0.0167 : parseFloat(period.startTime) / 100; // Convert HHMM to decimal hours (0001 = 0.0167)
                let endTime = period.allDay ? 23.983 : parseFloat(period.endTime) / 100; // Convert HHMM to decimal hours (2359 = 23.983)
                
                // If it's not all-day and it's the start date, use the start time to end of day (or 2359 if single day)
                // If it's not all-day and it's the end date, use start of day (0001) to end time
                // If it's in between, it's all day
                if (!period.allDay) {
                    if (currentDate.getTime() === startDate.getTime() && currentDate.getTime() === effectiveEndDate.getTime()) {
                        // Single day unavailability - use start and end times
                        startTime = period.startTime ? parseFloat(period.startTime) / 100 : 0.0167;
                        endTime = period.endTime ? parseFloat(period.endTime) / 100 : 23.983;
                    } else if (currentDate.getTime() === startDate.getTime() && period.startTime) {
                        // Start day of multi-day - use start time to end of day
                        startTime = parseFloat(period.startTime) / 100;
                        endTime = 23.983; // 2359
                    } else if (currentDate.getTime() === effectiveEndDate.getTime() && period.endTime) {
                        // End day of multi-day - use start of day to end time
                        startTime = 0.0167; // 0001
                        endTime = parseFloat(period.endTime) / 100;
                    } else if (currentDate > startDate && currentDate < effectiveEndDate) {
                        // Middle day of multi-day unavailability
                        startTime = 0.0167; // 0001
                        endTime = 23.983;   // 2359
                    }
                }
                
                const duration = endTime - startTime;
                
                const unavailabilityEvent: ScheduleEvent = {
                    id: `unavailability-${person.fullName}-${period.id}`,
                    date: date,
                    startTime: startTime,
                    duration: duration,
                    type: 'unavailability',
                    student: person.fullName,
                    pilot: person.fullName,
                    flightNumber: 'UNAVAIL',
                    resourceName: person.fullName,
                    resourceId: `TRAINEE-${person.fullName}`,
                    eventType: 'UNAVAILABILITY',
                    allDay: period.allDay,
                    reason: period.reason,
                    notes: period.notes
                };
                
                unavailabilityEvents.push(unavailabilityEvent);
            }
        });
    });
    
    return unavailabilityEvents;
};

const TraineeScheduleView: React.FC<TraineeScheduleViewProps> = ({ date, onDateChange, events, trainees, onSelectEvent, onUpdateEvent, zoomLevel, daylightTimes, personnelData, seatConfigs, syllabusDetails, conflictingEventIds, showValidation, unavailabilityConflicts, onSelectTrainee, traineesData, courseColors }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [draggingState, setDraggingState] = useState<{
    mainEventId: string;
    xOffset: number;
    initialPositions: Map<string, { startTime: number, rowIndex: number }>;
  } | null>(null);

  const [realtimeConflict, setRealtimeConflict] = useState<{ conflictingEventId: string; conflictedPersonName: string; } | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevZoomLevelRef = useRef(zoomLevel);
  const didDragRef = useRef(false);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formattedDisplayDate = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC'
    });
  }, [date]);

  // Combine regular events with unavailability events
  const eventsWithUnavailability = useMemo(() => {
    const unavailabilityEvents = createUnavailabilityEvents(date, traineesData);
    return [...events, ...unavailabilityEvents];
  }, [date, events, traineesData]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (isInitialLoad.current) {
      const defaultStartHour = 8;
      const initialScrollLeft = (defaultStartHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
      scrollContainer.scrollLeft = initialScrollLeft;
      isInitialLoad.current = false;
    } else {
        const prevZoom = prevZoomLevelRef.current;
        if (prevZoom === zoomLevel) return;

        const { scrollLeft, clientWidth } = scrollContainer;
        const timeAtCenterInHoursFromStart = (scrollLeft + clientWidth / 2) / (PIXELS_PER_HOUR * prevZoom);
        const newScrollLeft = (timeAtCenterInHoursFromStart * PIXELS_PER_HOUR * zoomLevel) - (clientWidth / 2);
        scrollContainer.scrollLeft = newScrollLeft;
    }
    
    prevZoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const findConflict = useCallback((eventsToCheck: ScheduleEvent[], existingEvents: ScheduleEvent[]): { conflictingEvent: ScheduleEvent, personName: string } | null => {
    for (const eventToCheck of eventsToCheck) {
        const s1 = syllabusDetails.find(d => d.id === eventToCheck.flightNumber);
        if (!s1) continue;

        const e1StartWithPre = eventToCheck.startTime - s1.preFlightTime;
        const e1EndWithPost = eventToCheck.startTime + eventToCheck.duration + s1.postFlightTime;

        for (const existingEvent of existingEvents) {
            const s2 = syllabusDetails.find(d => d.id === existingEvent.flightNumber);
            if (!s2) continue;

            const e2StartWithPre = existingEvent.startTime - s2.preFlightTime;
            const e2EndWithPost = existingEvent.startTime + existingEvent.duration + s2.postFlightTime;
            
            if (e1StartWithPre < e2EndWithPost && e1EndWithPost > e2StartWithPre) {
                const personnelToCheck = getPersonnel(eventToCheck);
                const existingPersonnel = getPersonnel(existingEvent);
                
                const conflictedPersonName = personnelToCheck.find(p => existingPersonnel.includes(p));

                if (conflictedPersonName) {
                    return {
                        conflictingEvent: existingEvent,
                        personName: conflictedPersonName
                    };
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
    const traineeName = event.student || event.pilot || '';
    const rowIndex = trainees.findIndex(t => t === traineeName);
    
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

      const eventData = eventsWithUnavailability.find(ev => ev.id === draggingState.mainEventId);
      if (!eventData) return;

      let clampedStartTime = newStartTime;
      if (clampedStartTime < START_HOUR) clampedStartTime = START_HOUR;
      if ((clampedStartTime + eventData.duration) > END_HOUR) clampedStartTime = END_HOUR - eventData.duration;

      const snappedStartTime = Math.round(clampedStartTime * 12) / 12;

      const proposedEvent = { ...eventData, startTime: snappedStartTime };
      const otherEvents = eventsWithUnavailability.filter(event => event.id !== draggingState.mainEventId);
      const conflict = findConflict([proposedEvent], otherEvents);

      setRealtimeConflict(conflict ? { 
          conflictingEventId: conflict.conflictingEvent.id, 
          conflictedPersonName: conflict.personName 
      } : null);
      
      const hasChanged = snappedStartTime !== eventData.startTime;
      if (hasChanged) {
          onUpdateEvent([{
              eventId: draggingState.mainEventId,
              newStartTime: snappedStartTime,
          }]);
      }
  };

  const handleMouseUp = () => {
      document.body.classList.remove('no-select');
      setDraggingState(null);
      setRealtimeConflict(null);
      setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const totalRows = trainees.length;
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
        lines.push(
            <div key={`v-${i}`} className="absolute h-full top-0" style={{ left: (i - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
                <div className="w-px h-full bg-gray-700/50"></div>
            </div>
        );
        if (i < END_HOUR) {
            lines.push(
                <div key={`v-${i}-30`} className="absolute h-full top-0" style={{ left: (i - START_HOUR + 0.5) * PIXELS_PER_HOUR * zoomLevel }}>
                    <div className="w-px h-full bg-gray-700/25"></div>
                </div>
            );
        }
    }
    for (let i = 1; i <= totalRows; i++) {
      lines.push(
        <div key={`h-${i}`} className="absolute left-0 w-full bg-gray-700/25" style={{ top: i * ROW_HEIGHT, height: '1px' }}></div>
      );
    }
    return lines;
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
  
  const renderCurrentTimeIndicator = () => {
    // Get timezone offset from localStorage
    const timezoneOffset = parseFloat(localStorage.getItem('timezoneOffset') || '0');
    const offsetMs = timezoneOffset * 60 * 60 * 1000;
    const adjustedDate = new Date(Date.now() + offsetMs);
    const todayStr = `${adjustedDate.getUTCFullYear()}-${String(adjustedDate.getUTCMonth() + 1).padStart(2, '0')}-${String(adjustedDate.getUTCDate()).padStart(2, '0')}`;
    if (date !== todayStr) {
        return null;
    }
    const now = currentTime;
    const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    if (currentHour < START_HOUR || currentHour > END_HOUR) return null;
    const leftPosition = (currentHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
    return (
        <div 
            className="absolute top-0 h-full z-[30] pointer-events-none"
            style={{ left: `${leftPosition}px` }}
        >
            <div className="w-0.5 h-full bg-white animate-pulse"></div>
            <div 
                className="absolute -top-2.5 -translate-x-1/2 w-0 h-0"
                style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '7px solid white',
                }}
            />
        </div>
    );
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
      >
        <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">
            <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2">
                <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <span className="flex-grow min-w-0 text-center font-semibold text-white cursor-default truncate">{formattedDisplayDate}</span>
                <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
        
        <div className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700">
            <div className="relative" style={{ width: timelineWidth, height: TIME_HEADER_HEIGHT }}>
                {renderTimeHeaders()}
            </div>
        </div>
        
        <div className="sticky left-0 z-30 bg-gray-800 border-r border-gray-700">
          <TraineeColumn trainees={trainees} rowHeight={ROW_HEIGHT} onTraineeClick={onSelectTrainee} courseColors={courseColors} onRowEnter={setHoveredRowIndex} onRowLeave={() => setHoveredRowIndex(null)} />
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
            {renderCurrentTimeIndicator()}
            {trainees.flatMap((trainee, rowIndex) => {
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

              // Render pre/post bars for this trainee's row first
              const barsForThisRow: React.ReactElement[] = [];
              
              if (showValidation) {
                const traineeEventsForBars = events
                  .filter(e => e.student === trainee || (e.flightType === 'Solo' && e.pilot === trainee))
                  .sort((a, b) => a.startTime - b.startTime);
                
                for (let i = 0; i < traineeEventsForBars.length; i++) {
                  const currentEvent = traineeEventsForBars[i];
                  const prevEvent = traineeEventsForBars[i - 1];
                  const nextEvent = traineeEventsForBars[i + 1];
                  
                  const currentSyllabus = syllabusDetails.find(d => d.id === currentEvent.flightNumber);
                  if (!currentSyllabus) continue;
                  
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
                    
                    barsForThisRow.push(<div key={key} style={style} className={className} />);
                  };
                  
                  if (currentSyllabus.preFlightTime > 0) {
                    const preStartTime = currentEvent.startTime - currentSyllabus.preFlightTime;
                    renderBar(currentSyllabus.preFlightTime, preStartTime, hasPreConflict || false, `${currentEvent.id}-pre-${rowIndex}`);
                  }
                  
                  if (currentSyllabus.postFlightTime > 0) {
                    const postStartTime = currentEvent.startTime + currentEvent.duration;
                    renderBar(currentSyllabus.postFlightTime, postStartTime, hasPostConflict || false, `${currentEvent.id}-post-${rowIndex}`);
                  }
                }
              }
              
              const traineeEvents = eventsWithUnavailability.filter(event => 
                event.student === trainee || 
                (event.flightType === 'Solo' && event.pilot === trainee)
              ).sort((a, b) => a.startTime - b.startTime);
              
              const eventTiles = traineeEvents.map(event => {
                const isDraggedTile = !!(draggingState && draggingState.mainEventId === event.id);
                const isStationaryConflictTile = event.id === realtimeConflict?.conflictingEventId;
                const isConflicting =
                  (showValidation && conflictingEventIds.has(event.id)) ||
                  isStationaryConflictTile ||
                  (isDraggedTile && !!realtimeConflict);
                
                const unavailabilityConflictData = unavailabilityConflicts.get(event.id);
                const isUnavailability = !!unavailabilityConflictData;
                const unavailablePeople = unavailabilityConflictData || [];
                
                let personToHighlight = null;
                if (realtimeConflict) {
                    const personnelOnThisTile = getPersonnel(event);
                    if ((isDraggedTile || isStationaryConflictTile) && personnelOnThisTile.includes(realtimeConflict.conflictedPersonName)) {
                        personToHighlight = realtimeConflict.conflictedPersonName;
                    }
                }
                
                return (
                  <FlightTile
                    key={`${event.id}-${trainee}`}
                    event={event}
                    traineesData={traineesData}
                    onSelectEvent={() => { if (!didDragRef.current) onSelectEvent(event); }}
                    onMouseDown={(e) => handleMouseDown(e, event)}
                    onMouseEnter={() => setHoveredEventId(event.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                    rowHeight={ROW_HEIGHT}
                    startHour={START_HOUR}
                    row={rowIndex}
                    isDragging={isDraggedTile}
                    isConflicting={isConflicting}
                    isUnavailabilityConflict={isUnavailability}
                    unavailablePersonnel={unavailablePeople}
                    conflictedPersonnelName={personToHighlight}
                    personnelData={personnelData}
                    seatConfigs={seatConfigs}
                    isDraggable={true}
                    currentTime={currentTime}
                  />
                );
              });
              
              return [rowHighlight, ...barsForThisRow, ...eventTiles];
            })}
        </div>
      </div>
    </div>
  );
};

export default TraineeScheduleView;
