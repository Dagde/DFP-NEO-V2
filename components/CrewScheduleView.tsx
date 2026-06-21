import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleEvent, Trainee } from '../types';
import FlightTile from './FlightTile';
import { AircraftNumberSettings } from '../utils/aircraftNumberFormat';

interface CrewScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  onDateSelect?: (date: string) => void;
  events: ScheduleEvent[];
  instructorsData: any[];
  traineesData: Trainee[];
  onSelectEvent: (event: ScheduleEvent) => void;
  zoomLevel: number;
  daylightTimes: { firstLight: string | null; lastLight: string | null };
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  seatConfigs: Map<string, string>;
  conflictingEventIds: Set<string>;
  aircraftNumberSettings?: AircraftNumberSettings;
}

const PIXELS_PER_HOUR = 200;
const ROW_HEIGHT = 34;
const UNIT_HEADER_HEIGHT = 28;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const CREW_COLUMN_WIDTH = 180;
const TIME_HEADER_HEIGHT = 40;

const normaliseUnitCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

const normaliseCrewLabel = (value?: string | null): string => (
  String(value || '')
    .replace(/^CREW\s*/i, '')
    .replace(/\s*\/\s*[A-Z0-9-]+$/i, '')
    .trim()
);

const makeCrewKey = (unit?: string | null, crew?: string | null): string => {
  const unitCode = normaliseUnitCode(unit);
  const crewLabel = normaliseCrewLabel(crew);
  return unitCode && crewLabel ? `${unitCode}::${crewLabel}` : '';
};

const formatCrewDisplay = (crewKey: string): string => {
  const [unitCode, ...crewParts] = crewKey.split('::');
  const crewLabel = crewParts.join('::').trim();
  return unitCode && crewLabel ? `CREW ${crewLabel}/${unitCode}` : crewKey;
};

const getEventCrewKey = (event: ScheduleEvent): string => {
  const fixedCrewGroup = String((event as any).fixedCrewGroup || '').trim();
  if (fixedCrewGroup.includes('::')) {
    const [unitCode, ...crewParts] = fixedCrewGroup.split('::');
    return makeCrewKey(unitCode, crewParts.join('::'));
  }

  const displayCrew = String(event.crew || event.group || event.student || '').trim();
  const displayMatch = displayCrew.match(/CREW\s+(.+?)\s*\/\s*([A-Z0-9-]+)/i);
  if (displayMatch) return makeCrewKey(displayMatch[2], displayMatch[1]);

  return '';
};

const addPerson = (set: Set<string>, value?: string | null) => {
  const person = String(value || '').trim().toLowerCase();
  if (person) set.add(person);
};

const getEventPeople = (event: ScheduleEvent): Set<string> => {
  const people = new Set<string>();
  addPerson(people, event.instructor);
  addPerson(people, event.pilot);
  addPerson(people, event.crew);
  addPerson(people, event.student);
  event.attendees?.forEach(person => addPerson(people, person));
  event.crewSelectionOrder?.forEach(person => addPerson(people, person));
  return people;
};

const getLocalDateStringFromAdjustedTime = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CrewScheduleView: React.FC<CrewScheduleViewProps> = ({
  date,
  onDateChange,
  onDateSelect,
  events,
  instructorsData,
  traineesData,
  onSelectEvent,
  zoomLevel,
  daylightTimes,
  personnelData,
  seatConfigs,
  conflictingEventIds,
  aircraftNumberSettings,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevZoomLevelRef = useRef(zoomLevel);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    const timezoneOffset = parseFloat(localStorage.getItem('timezoneOffset') || '0');
    return new Date(Date.now() + timezoneOffset * 60 * 60 * 1000);
  });

  useEffect(() => {
    const timerId = setInterval(() => {
      const timezoneOffset = parseFloat(localStorage.getItem('timezoneOffset') || '0');
      setCurrentTime(new Date(Date.now() + timezoneOffset * 60 * 60 * 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  const crewsByUnit = useMemo(() => {
    const unitMap = new Map<string, Map<string, { key: string; label: string; unit: string; members: string[] }>>();
    instructorsData.forEach(staff => {
      const key = makeCrewKey(staff.unit, staff.crew);
      if (!key) return;
      const unit = normaliseUnitCode(staff.unit);
      const unitCrews = unitMap.get(unit) || new Map<string, { key: string; label: string; unit: string; members: string[] }>();
      const crew = unitCrews.get(key) || { key, label: formatCrewDisplay(key), unit, members: [] };
      if (staff.name && !crew.members.includes(staff.name)) crew.members.push(staff.name);
      unitCrews.set(key, crew);
      unitMap.set(unit, unitCrews);
    });

    return Array.from(unitMap.entries())
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([unit, crewMap]) => ({
        unit,
        crews: Array.from(crewMap.values()).sort((left, right) =>
          left.label.localeCompare(right.label, undefined, { numeric: true })
        ),
      }));
  }, [instructorsData]);

  const rowLayouts = useMemo(() => {
    let top = 0;
    return crewsByUnit.flatMap(group => {
      const header = { type: 'header' as const, unit: group.unit, top, height: UNIT_HEADER_HEIGHT };
      top += UNIT_HEADER_HEIGHT;
      const rows = group.crews.map(crew => {
        const row = { type: 'crew' as const, ...crew, top, height: ROW_HEIGHT };
        top += ROW_HEIGHT;
        return row;
      });
      return [header, ...rows];
    });
  }, [crewsByUnit]);

  const crewRows = rowLayouts.filter(row => row.type === 'crew');
  const crewRowsByKey = new Map(crewRows.map(row => [row.key, row]));
  const crewMembersByKey = useMemo(() => new Map(crewRows.map(row => [
    row.key,
    new Set(row.members.map(member => member.trim().toLowerCase()).filter(Boolean)),
  ])), [crewRows]);

  const getCrewKeyForEvent = (event: ScheduleEvent): string => {
    const explicitCrewKey = getEventCrewKey(event);
    if (explicitCrewKey && crewRowsByKey.has(explicitCrewKey)) return explicitCrewKey;

    const eventPeople = getEventPeople(event);
    for (const [crewKey, members] of crewMembersByKey.entries()) {
      for (const member of members) {
        if (eventPeople.has(member)) return crewKey;
      }
    }
    return explicitCrewKey;
  };

  const timelineWidth = TOTAL_HOURS * PIXELS_PER_HOUR * zoomLevel;
  const containerHeight = rowLayouts.reduce((sum, row) => sum + row.height, 0);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    if (isInitialLoad.current) {
      scrollContainer.scrollLeft = 8 * PIXELS_PER_HOUR * zoomLevel;
      isInitialLoad.current = false;
    } else if (prevZoomLevelRef.current !== zoomLevel) {
      const { scrollLeft, clientWidth } = scrollContainer;
      const timeAtCenter = (scrollLeft + clientWidth / 2) / (PIXELS_PER_HOUR * prevZoomLevelRef.current);
      scrollContainer.scrollLeft = timeAtCenter * PIXELS_PER_HOUR * zoomLevel - clientWidth / 2;
    }
    prevZoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const formattedDisplayDate = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }, [date]);

  const timeStringToHours = (timeString: string | null): number | null => {
    if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  };

  const renderTimeHeaders = () => {
    const markers = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
      markers.push(
        <div key={hour} className="absolute top-0 flex h-full items-center text-xs text-gray-500" style={{ left: (hour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
          <span className="-translate-x-1/2">{`${String(hour).padStart(2, '0')}:00`}</span>
        </div>
      );
    }
    const firstLightHour = timeStringToHours(daylightTimes.firstLight);
    const lastLightHour = timeStringToHours(daylightTimes.lastLight);
    if (firstLightHour !== null) {
      markers.push(
        <div key="fl" className="absolute top-0 flex h-full items-center text-xs font-bold text-white" style={{ left: (firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
          <span className="-translate-x-1/2">{`FL ${daylightTimes.firstLight}`}</span>
        </div>
      );
    }
    if (lastLightHour !== null) {
      markers.push(
        <div key="ll" className="absolute top-0 flex h-full items-center text-xs font-bold text-white" style={{ left: (lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
          <span className="-translate-x-1/2">{`LL ${daylightTimes.lastLight}`}</span>
        </div>
      );
    }
    return markers;
  };

  const renderGridLines = () => {
    const lines = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
      lines.push(<div key={`v-${hour}`} className="absolute top-0 h-full w-px bg-gray-700/50" style={{ left: (hour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }} />);
      if (hour < END_HOUR) {
        lines.push(<div key={`v-${hour}-30`} className="absolute top-0 h-full w-px bg-gray-700/25" style={{ left: (hour - START_HOUR + 0.5) * PIXELS_PER_HOUR * zoomLevel }} />);
      }
    }
    rowLayouts.forEach(row => {
      lines.push(<div key={`h-${row.type}-${row.top}`} className="absolute left-0 w-full bg-gray-700/25" style={{ top: row.top + row.height, height: 1 }} />);
      if (row.type === 'header') {
        lines.push(<div key={`header-bg-${row.unit}`} className="absolute left-0 w-full bg-cyan-950/25" style={{ top: row.top, height: row.height }} />);
      }
    });
    return lines;
  };

  const renderDaylightLines = () => {
    const firstLightHour = timeStringToHours(daylightTimes.firstLight);
    const lastLightHour = timeStringToHours(daylightTimes.lastLight);
    return (
      <>
        {firstLightHour !== null && <div className="absolute top-0 z-[5] h-full border-l border-dashed border-white/30" style={{ left: (firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }} />}
        {lastLightHour !== null && <div className="absolute top-0 z-[5] h-full border-l border-dashed border-white/30" style={{ left: (lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }} />}
      </>
    );
  };

  const renderCurrentTimeIndicator = () => {
    const todayStr = getLocalDateStringFromAdjustedTime(currentTime);
    if (date !== todayStr) return null;
    const currentHour = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60 + currentTime.getUTCSeconds() / 3600;
    if (currentHour < START_HOUR || currentHour > END_HOUR) return null;
    const left = (currentHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
    return (
      <div className="pointer-events-none absolute top-0 z-30 h-full" style={{ left }}>
        <div className="h-full w-0.5 animate-pulse bg-white" />
      </div>
    );
  };

  const scheduledCrewEvents = events
    .map(event => ({ event, crewKey: getCrewKeyForEvent(event) }))
    .filter(item => item.crewKey && crewRowsByKey.has(item.crewKey));

  return (
    <div ref={scrollContainerRef} className="relative flex-1 overflow-auto bg-gray-900">
      <div
        style={{
          width: `${CREW_COLUMN_WIDTH + timelineWidth}px`,
          height: `${TIME_HEADER_HEIGHT + Math.max(containerHeight, ROW_HEIGHT)}px`,
          display: 'grid',
          gridTemplateColumns: `${CREW_COLUMN_WIDTH}px 1fr`,
          gridTemplateRows: `${TIME_HEADER_HEIGHT}px 1fr`,
        }}
      >
        <div className="sticky left-0 top-0 z-40 border-b border-r border-gray-700 bg-gray-800 p-1">
          <div className="relative flex h-full items-center justify-center rounded-md bg-gray-700 px-2">
            <button onClick={() => onDateChange(-1)} className="rounded-full p-1 text-white hover:bg-gray-600" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={() => setShowCalendarDropdown(value => !value)} className="min-w-0 flex-1 truncate rounded px-1 text-center text-sm font-semibold text-white hover:bg-gray-600" type="button">
              {formattedDisplayDate}
            </button>
            <button onClick={() => onDateChange(1)} className="rounded-full p-1 text-white hover:bg-gray-600" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
            {showCalendarDropdown && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-xl">
                <div className="mb-2 text-xs font-semibold text-gray-400">Select Date</div>
                <input
                  type="date"
                  defaultValue={date}
                  className="mb-2 w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs text-white"
                  onChange={event => {
                    if (!event.target.value) return;
                    if (onDateSelect) onDateSelect(event.target.value);
                    else {
                      const diff = Math.round((new Date(`${event.target.value}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000);
                      if (diff !== 0) onDateChange(diff);
                    }
                    setShowCalendarDropdown(false);
                  }}
                />
                <button onClick={() => setShowCalendarDropdown(false)} className="w-full text-center text-xs text-gray-400 hover:text-white" type="button">Close</button>
              </div>
            )}
          </div>
        </div>

        <div className="sticky top-0 z-20 border-b border-gray-700 bg-gray-800">
          <div className="relative" style={{ width: timelineWidth, height: TIME_HEADER_HEIGHT }}>
            {renderTimeHeaders()}
          </div>
        </div>

        <div className="sticky left-0 z-30 border-r border-gray-700 bg-gray-800">
          <div className="relative" style={{ height: containerHeight }}>
            {rowLayouts.map(row => (
              row.type === 'header' ? (
                <div key={`label-${row.unit}`} className="absolute left-0 flex w-full items-center border-b border-cyan-400/20 bg-cyan-950/40 px-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200" style={{ top: row.top, height: row.height }}>
                  {row.unit}
                </div>
              ) : (
                <div key={`label-${row.key}`} className="absolute left-0 flex w-full items-center border-b border-gray-700/60 px-3" style={{ top: row.top, height: row.height }}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{row.label}</div>
                    <div className="truncate text-[10px] uppercase tracking-[0.14em] text-gray-500">{row.members.length} crew</div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="relative" style={{ height: containerHeight }}>
          {renderGridLines()}
          {renderDaylightLines()}
          {renderCurrentTimeIndicator()}
          {crewsByUnit.length === 0 && (
            <div className="absolute left-4 top-4 rounded-md border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-300">
              No fixed crew groups found for this unit context.
            </div>
          )}
          {scheduledCrewEvents.map(({ event, crewKey }) => {
            const row = crewRowsByKey.get(crewKey);
            if (!row) return null;
            return (
              <FlightTile
                key={`${event.id}-${crewKey}`}
                event={event}
                traineesData={traineesData}
                onSelectEvent={() => onSelectEvent(event)}
                onMouseDown={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                rowHeight={ROW_HEIGHT}
                startHour={START_HOUR}
                row={0}
                isDragging={false}
                isConflicting={conflictingEventIds.has(event.id)}
                personnelData={personnelData}
                seatConfigs={seatConfigs}
                isDraggable={false}
                currentTime={currentTime}
                aircraftNumberSettings={aircraftNumberSettings}
              />
            );
          }).map((tile, index) => {
            if (!tile) return null;
            const item = scheduledCrewEvents[index];
            const row = crewRowsByKey.get(item.crewKey);
            if (!row) return null;
            return React.cloneElement(tile, { row: row.top / ROW_HEIGHT } as any);
          })}
        </div>
      </div>
    </div>
  );
};

export default CrewScheduleView;
