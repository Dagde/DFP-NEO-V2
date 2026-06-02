

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest, FlyingWindowExclusionPeriod, FlyingWindowExclusionRestriction } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { InstructorPriorityConfig, InstructorPriorityGroups } from '../App';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { ANY_AIRCRAFT_CONFIG, BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';

interface PrioritiesViewProps {
  school?: 'ESL' | 'PEA';
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
  aircraftConfigCapacities?: Record<string, string>;
  onUpdateAircraftConfigCapacities?: (capacities: Record<string, string>) => void;
  availableFtdCount: number;
  onUpdateFtdCount: (count: number) => void;
  availableCptCount: number;
  onUpdateCptCount: (count: number) => void;
  flyingStartTime: number;
  onUpdateFlyingStartTime: (time: number) => void;
  flyingEndTime: number;
  onUpdateFlyingEndTime: (time: number) => void;
  ftdStartTime: number;
  onUpdateFtdStartTime: (time: number) => void;
  ftdEndTime: number;
  onUpdateFtdEndTime: (time: number) => void;
  allowNightFlying: boolean;
  onUpdateAllowNightFlying: (value: boolean) => void;
  commenceNightFlying: number;
  onUpdateCommenceNightFlying: (time: number) => void;
  ceaseNightFlying: number;
  onUpdateCeaseNightFlying: (time: number) => void;
  flyingWindowExclusions: FlyingWindowExclusionPeriod[];
  onUpdateFlyingWindowExclusions: (periods: FlyingWindowExclusionPeriod[]) => void;
  instructorsData: Instructor[];
  traineesData: Trainee[];
  buildDfpDate: string;
  highestPriorityEvents: ScheduleEvent[];
  activeScheduleEvents?: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onAddPriorityEvents: (events: ScheduleEvent[]) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  onDeletePriorityEvent: (eventId: string) => void;
  instructorPriority: InstructorPriorityConfig;
  onUpdateInstructorPriority: (value: InstructorPriorityConfig) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  onAddSctRequest: (type: 'flight' | 'ftd') => void;
  onRemoveSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onUpdateSctRequest: (id: string, field: keyof SctRequest, value: string, type: 'flight' | 'ftd') => void;
  onSubmitSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onToggleSctInclude: (id: string, type: 'flight' | 'ftd') => void;
  syllabusDetails: SyllabusItemDetail[];
  scores?: Map<string, Score[]>; // Optional because it might not be passed initially but needed for new feature
  traineeLMPs?: Map<string, SyllabusItemDetail[]>; // Optional
  remedialRequests?: RemedialRequest[];
  onToggleRemedialRequest?: (traineeId: number, eventCode: string) => void;
  onUpdateRemedialAircraftConfig?: (traineeId: number, eventCode: string, aircraftConfigId: string) => void;
  currencyNames: string[];
  resourceDisplayNames?: ResourceDisplayNames;
  activeSection?: 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events';
}

const ConfigCapacityInfoHint: React.FC<{ definition: AircraftConfigurationDefinition }> = ({ definition }) => {
  const description = definition.definition?.trim() || 'No definition has been entered for this aircraft configuration.';
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${definition.label} definition`}
      className="group relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-cyan-400/30 bg-slate-950 text-[10px] font-bold italic leading-none text-cyan-100/60 outline-none transition hover:border-cyan-300/70 hover:text-cyan-50 focus-visible:border-cyan-200 focus-visible:text-cyan-50"
    >
      i
      <span className="pointer-events-none absolute left-0 top-5 z-50 hidden w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded border border-cyan-500/30 bg-slate-950 p-3 text-left text-xs font-normal not-italic leading-relaxed text-slate-100 shadow-xl group-hover:block group-focus:block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-cyan-200">{definition.label}</span>
        {description}
      </span>
    </span>
  );
};

const AircraftConfigSelect: React.FC<{
  value?: string;
  definitions: AircraftConfigurationDefinition[];
  disabled?: boolean;
  includeAny?: boolean;
  onChange: (value: string) => void;
}> = ({ value, definitions, disabled = false, includeAny = false, onChange }) => {
  const selectedValue = value || BASE_AIRCRAFT_CONFIG.id;
  const selectedDefinition = definitions.find(definition => definition.id === selectedValue);
  return (
    <select
      value={selectedValue}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      title={selectedValue === ANY_AIRCRAFT_CONFIG ? 'Any aircraft configuration is acceptable.' : selectedDefinition?.definition || BASE_AIRCRAFT_CONFIG.definition}
    >
      {includeAny && (
        <option value={ANY_AIRCRAFT_CONFIG}>ANY</option>
      )}
      {definitions.map(definition => (
        <option key={definition.id} value={definition.id}>
          {definition.label}
        </option>
      ))}
    </select>
  );
};

type TimelineDragTarget =
  | { kind: 'day'; edge: 'start' | 'end' }
  | { kind: 'night'; edge: 'start' | 'end' }
  | { kind: 'exclusion'; id: string; edge: 'start' | 'end' };

type TimelineDragState = TimelineDragTarget & {
  label: string;
  originalTime: number;
  time: number;
  left: number;
};

// FIX: Export component as a named const to fix module import error.
export const PrioritiesView: React.FC<PrioritiesViewProps> = ({ 
  school = 'ESL',
  coursePriorities, 
  onUpdatePriorities, 
  coursePercentages, 
  onUpdatePercentages,
  availableAircraftCount,
  onUpdateAircraftCount,
  aircraftConfigurationDefinitions = [],
  aircraftConfigCapacities = {},
  onUpdateAircraftConfigCapacities = () => {},
  availableFtdCount,
  onUpdateFtdCount,
  availableCptCount,
  onUpdateCptCount,
  flyingStartTime,
  onUpdateFlyingStartTime,
  flyingEndTime,
  onUpdateFlyingEndTime,
  ftdStartTime,
  onUpdateFtdStartTime,
  ftdEndTime,
  onUpdateFtdEndTime,
  allowNightFlying,
  onUpdateAllowNightFlying,
  commenceNightFlying,
  onUpdateCommenceNightFlying,
  ceaseNightFlying,
  onUpdateCeaseNightFlying,
  flyingWindowExclusions = [],
  onUpdateFlyingWindowExclusions,
  instructorsData,
  traineesData,
  buildDfpDate,
  highestPriorityEvents,
  activeScheduleEvents = [],
  onSelectEvent,
  onAddPriorityEvents,
  onUpdatePriorityEvent,
  onDeletePriorityEvent,
  instructorPriority,
  onUpdateInstructorPriority,
  sctFlights,
  sctFtds,
  onAddSctRequest,
  onRemoveSctRequest,
  onUpdateSctRequest,
  onSubmitSctRequest,
  onToggleSctInclude,
  syllabusDetails,
  scores = new Map(),
  traineeLMPs = new Map(),
  remedialRequests = [],
  onToggleRemedialRequest = (_traineeId: number, _eventCode: string) => {},
  onUpdateRemedialAircraftConfig = (_traineeId: number, _eventCode: string, _aircraftConfigId: string) => {},
  currencyNames,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
}) => {
  const aircraftLabel = resourceDisplayNames.aircraft;
  const ftdLabel = resourceDisplayNames.ftd;
  const cptLabel = resourceDisplayNames.cpt;
  const staffRankOrder = ['WGCDR', 'SQNLDR', 'FLTLT', 'FLGOFF', 'PLTOFF', 'Mr'];
  const aircraftConfigOptions = useMemo(() => {
    const definitions = aircraftConfigurationDefinitions.length > 0
      ? aircraftConfigurationDefinitions
      : [BASE_AIRCRAFT_CONFIG];
    return definitions.some(definition => definition.id === BASE_AIRCRAFT_CONFIG.id)
      ? definitions
      : [BASE_AIRCRAFT_CONFIG, ...definitions];
  }, [aircraftConfigurationDefinitions]);

  // State for Course Priorities
  const courseDragItem = useRef<number | null>(null);
  const courseDragOverItem = useRef<number | null>(null);
  const [courseTimestamp, setCourseTimestamp] = useState(new Date().toLocaleString());

  // SCT Request Constants
  const sctEvents = ['SCT GF', 'SCT IF', 'SCT NAV', 'SCT FORM'];
  const instructorNames = useMemo(() => instructorsData.map(i => i.name).sort(), [instructorsData]);
  const [openCurrencyRequestKey, setOpenCurrencyRequestKey] = useState<string | null>(null);


  // State for Build Factors
  const [aircraftTimestamp, setAircraftTimestamp] = useState(new Date().toLocaleString());
  const [flyingWindowTimestamp, setFlyingWindowTimestamp] = useState(new Date().toLocaleString());
  const [dutyPeriodTimestamp, setDutyPeriodTimestamp] = useState(new Date().toLocaleString());
  const [turnaroundTimestamp, setTurnaroundTimestamp] = useState(new Date().toLocaleString());


  useEffect(() => {
    setCourseTimestamp(new Date().toLocaleString());
  }, [coursePriorities, coursePercentages]);

  useEffect(() => {
    setAircraftTimestamp(new Date().toLocaleString());
  }, [availableAircraftCount, aircraftConfigCapacities]);

  const handleAircraftCapacityChange = (value: string) => {
    const nextCount = Math.max(0, parseInt(value, 10) || 0);
    logAudit("Priorities", "Edit", `Updated available ${aircraftLabel} count`, `${availableAircraftCount} → ${nextCount}`);
    onUpdateAircraftCount(nextCount);
  };

  const normaliseCapacityInput = (value: string): string => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    if (!digitsOnly) return '';
    return String(Math.max(0, parseInt(digitsOnly, 10) || 0));
  };

  const handleAircraftConfigCapacityChange = (configId: string, value: string) => {
    const nextValue = normaliseCapacityInput(value);
    const nextCapacities = { ...aircraftConfigCapacities, [configId]: nextValue };
    if (!nextValue) delete nextCapacities[configId];
    logAudit("Priorities", "Edit", `Updated ${configId.replace('-', ' ')} aircraft capacity`, `${aircraftConfigCapacities[configId] || 'blank'} → ${nextValue || 'blank'}`);
    onUpdateAircraftConfigCapacities(nextCapacities);
  };

  const nonCleanConfigCapacityTotal = useMemo(() => (
    aircraftConfigurationDefinitions
      .filter(definition => definition.id !== 'CONFIG-0')
      .reduce((total, definition) => total + (parseInt(aircraftConfigCapacities[definition.id] || '', 10) || 0), 0)
  ), [aircraftConfigCapacities, aircraftConfigurationDefinitions]);

  const hasEnteredConfigCapacity = useMemo(() => (
    aircraftConfigurationDefinitions
      .filter(definition => definition.id !== 'CONFIG-0')
      .some(definition => String(aircraftConfigCapacities[definition.id] || '').trim() !== '')
  ), [aircraftConfigCapacities, aircraftConfigurationDefinitions]);

  const derivedCleanConfigCapacity = Math.max(0, availableAircraftCount - nonCleanConfigCapacityTotal);

  const getAircraftConfigLabel = (configId?: string): string => {
    const normalisedConfigId = configId || BASE_AIRCRAFT_CONFIG.id;
    if (normalisedConfigId === ANY_AIRCRAFT_CONFIG) return 'ANY';
    const definition = aircraftConfigOptions.find(item => item.id === normalisedConfigId);
    return (definition?.label || normalisedConfigId.replace('-', ' ')).toUpperCase();
  };

  const getAircraftConfigSummary = (event: ScheduleEvent): string => {
    if (event.type !== 'flight') return 'N/A';
    const acceptedConfigs = Array.isArray(event.acceptableAircraftConfigs) && event.acceptableAircraftConfigs.length > 0
      ? event.acceptableAircraftConfigs
      : event.aircraftConfigId
        ? [event.aircraftConfigId]
        : [BASE_AIRCRAFT_CONFIG.id];
    if (acceptedConfigs.includes(ANY_AIRCRAFT_CONFIG)) return 'ANY';
    return acceptedConfigs.map(getAircraftConfigLabel).join(', ');
  };

  useEffect(() => {
    setFlyingWindowTimestamp(new Date().toLocaleString());
  }, [flyingStartTime, flyingEndTime, commenceNightFlying, ceaseNightFlying, allowNightFlying, flyingWindowExclusions]);

  

  const totalPercentage = useMemo(() => {
    return Array.from(coursePercentages.values()).reduce((sum: number, p: number) => sum + p, 0);
  }, [coursePercentages]);

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) { // 15 min increments
            const totalHours = h + m / 60;
            const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            options.push({ label, value: totalHours });
        }
    }
    return options;
  }, []);

  const exclusionTimeOptions = useMemo(() => {
    const options = [{ label: '00:01', value: 1 / 60 }, ...timeOptions, { label: '23:59', value: 23 + 59 / 60 }];
    const seen = new Set<string>();
    return options.filter(option => {
      const key = option.value.toFixed(6);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [timeOptions]);

  const [showExclusionPlanner, setShowExclusionPlanner] = useState(false);

  const formatTimeLabel = (decimalHour: number): string => {
    const bounded = Math.max(0, Math.min(23 + 59 / 60, Number(decimalHour) || 0));
    const hours = Math.floor(bounded);
    const minutes = Math.round((bounded - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const timelineStartHour = 6;
  const timelineEndHour = 25;
  const timelineSpanHours = timelineEndHour - timelineStartHour;
  const timelineMinGap = 5 / 60;
  const timelineBoundaryLabelWidthPx = 104;
  const timelineBoundaryLabelGapPx = 5;
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [activeTimelineDrag, setActiveTimelineDrag] = useState<TimelineDragState | null>(null);
  const [timelineChartWidth, setTimelineChartWidth] = useState(0);
  const normalizeTimelineHour = (time: number): number => {
    let value = Number(time) || 0;
    if (value < timelineStartHour) value += 24;
    return Math.max(timelineStartHour, Math.min(timelineEndHour, value));
  };
  const denormalizeTimelineHour = (time: number): number => {
    const bounded = Math.max(timelineStartHour, Math.min(timelineEndHour, time));
    return bounded >= 24 ? Math.min(1, bounded - 24) : Math.min(23 + 45 / 60, bounded);
  };
  const snapTimelineHour = (time: number): number => Math.round(time * 12) / 12;
  const getTimelineLeft = (time: number): number => ((normalizeTimelineHour(time) - timelineStartHour) / timelineSpanHours) * 100;
  const getTimelineWidth = (start: number, end: number): number => {
    const startHour = normalizeTimelineHour(start);
    let endHour = normalizeTimelineHour(end);
    if (endHour <= startHour) endHour = Math.min(timelineEndHour, endHour + 24);
    return Math.max(0.35, ((Math.min(timelineEndHour, endHour) - startHour) / timelineSpanHours) * 100);
  };
  const getTimeFromTimelinePointer = (clientX: number): number => {
    const bounds = timelineRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return timelineStartHour;
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    return denormalizeTimelineHour(snapTimelineHour(timelineStartHour + ratio * timelineSpanHours));
  };
  const formatCompactTimeLabel = (decimalHour: number): string => formatTimeLabel(decimalHour).replace(':', '');
  const formatTimelineTickLabel = (hour: number): string => {
    if (hour === 24) return '0000';
    if (hour === 25) return '0100';
    return `${String(hour).padStart(2, '0')}00`;
  };
  const timelineTicks = [6, 9, 12, 15, 18, 21, 24, 25];
  const dayTimelineShade = 'bg-cyan-400/30 ring-cyan-100/30';
  const nightTimelineShade = 'bg-violet-500/30 ring-violet-100/30';
  const exclusionTimelineShade = 'bg-rose-500/30 ring-rose-200/30';
  const exclusionBoundaryColor = 'bg-rose-100';
  const getTimelinePixelLeft = (time: number): number => (getTimelineLeft(time) / 100) * timelineChartWidth;
  const boundaryLabelsOverlap = (firstTime: number, secondTime: number): boolean => {
    if (timelineChartWidth <= 0) return Math.abs(getTimelineLeft(firstTime) - getTimelineLeft(secondTime)) < 9;
    return Math.abs(getTimelinePixelLeft(firstTime) - getTimelinePixelLeft(secondTime)) < timelineBoundaryLabelWidthPx + timelineBoundaryLabelGapPx;
  };

  const constrainTimelineTime = (target: TimelineDragTarget, nextTime: number): number => {
    const nextHour = normalizeTimelineHour(nextTime);
    const constrain = (min: number, max: number) => denormalizeTimelineHour(Math.max(min, Math.min(max, nextHour)));

    if (target.kind === 'day') {
      const startHour = normalizeTimelineHour(flyingStartTime);
      const endHour = normalizeTimelineHour(flyingEndTime);
      const dayWindowLatestHour = 23.75;
      return target.edge === 'start'
        ? constrain(timelineStartHour, Math.min(endHour, dayWindowLatestHour) - timelineMinGap)
        : constrain(startHour + timelineMinGap, dayWindowLatestHour);
    }

    if (target.kind === 'night') {
      const startHour = normalizeTimelineHour(commenceNightFlying);
      const endHour = normalizeTimelineHour(ceaseNightFlying);
      return target.edge === 'start'
        ? constrain(timelineStartHour, endHour - timelineMinGap)
        : constrain(startHour + timelineMinGap, timelineEndHour);
    }

    const period = flyingWindowExclusions.find(item => item.id === target.id);
    if (!period) return nextTime;
    const startHour = normalizeTimelineHour(period.startTime);
    const endHour = normalizeTimelineHour(period.endTime);
    return target.edge === 'start'
      ? constrain(timelineStartHour, endHour - timelineMinGap)
      : constrain(startHour + timelineMinGap, timelineEndHour);
  };

  const applyTimelineDrag = (target: TimelineDragTarget, nextTime: number) => {
    const constrainedTime = constrainTimelineTime(target, nextTime);
    if (target.kind === 'day') {
      if (target.edge === 'start') onUpdateFlyingStartTime(constrainedTime);
      else onUpdateFlyingEndTime(constrainedTime);
    } else if (target.kind === 'night') {
      if (target.edge === 'start') onUpdateCommenceNightFlying(constrainedTime);
      else onUpdateCeaseNightFlying(constrainedTime);
    } else {
      updateExclusionPeriod(target.id, target.edge === 'start' ? { startTime: constrainedTime } : { endTime: constrainedTime });
    }
    return constrainedTime;
  };

  const startTimelineDrag = (event: React.PointerEvent<HTMLElement>, target: TimelineDragTarget, label: string, time: number) => {
    event.preventDefault();
    event.stopPropagation();
    const constrainedTime = constrainTimelineTime(target, time);
    setActiveTimelineDrag({
      ...target,
      label,
      originalTime: constrainedTime,
      time: constrainedTime,
      left: getTimelineLeft(constrainedTime),
    });
  };

  const addExclusionPeriod = () => {
    const latestExistingEnd = flyingWindowExclusions.length > 0
      ? Math.max(...flyingWindowExclusions.map(period => normalizeTimelineHour(period.endTime)))
      : normalizeTimelineHour(flyingStartTime) - 1;
    const nextStartHour = Math.min(Math.max(latestExistingEnd + 1, timelineStartHour), timelineEndHour - timelineMinGap);
    const nextEndHour = Math.min(nextStartHour + 0.5, timelineEndHour);
    const nextStart = denormalizeTimelineHour(snapTimelineHour(nextStartHour));
    const nextEnd = denormalizeTimelineHour(snapTimelineHour(nextEndHour));
    const nextPeriod: FlyingWindowExclusionPeriod = {
      id: uuidv4(),
      startTime: nextStart,
      endTime: nextEnd,
      restriction: 'both',
    };
    logAudit('Priorities', 'Edit', 'Added flying window exclusion', `${formatTimeLabel(nextStart)}-${formatTimeLabel(nextEnd)} both`);
    onUpdateFlyingWindowExclusions([...flyingWindowExclusions, nextPeriod]);
  };

  const updateExclusionPeriod = (id: string, updates: Partial<FlyingWindowExclusionPeriod>) => {
    const nextPeriods = flyingWindowExclusions.map(period => {
      if (period.id !== id) return period;
      const nextPeriod = { ...period, ...updates };
      const startHour = normalizeTimelineHour(nextPeriod.startTime);
      const endHour = normalizeTimelineHour(nextPeriod.endTime);
      if (endHour - startHour < timelineMinGap) {
        if (updates.startTime !== undefined) nextPeriod.endTime = denormalizeTimelineHour(Math.min(startHour + timelineMinGap, timelineEndHour));
        if (updates.endTime !== undefined) nextPeriod.startTime = denormalizeTimelineHour(Math.max(endHour - timelineMinGap, timelineStartHour));
      }
      return nextPeriod;
    });
    onUpdateFlyingWindowExclusions(nextPeriods);
  };

  const removeExclusionPeriod = (id: string) => {
    const removed = flyingWindowExclusions.find(period => period.id === id);
    if (removed) {
      logAudit('Priorities', 'Edit', 'Removed flying window exclusion', `${formatTimeLabel(removed.startTime)}-${formatTimeLabel(removed.endTime)} ${removed.restriction}`);
    }
    onUpdateFlyingWindowExclusions(flyingWindowExclusions.filter(period => period.id !== id));
  };

  const restrictionLabel = (restriction: FlyingWindowExclusionRestriction): string => {
    if (restriction === 'departures') return 'No departures';
    if (restriction === 'arrivals') return 'No arrivals';
    return 'No departures or arrivals';
  };

  useEffect(() => {
    const timelineElement = timelineRef.current;
    if (!timelineElement) return undefined;

    const updateTimelineWidth = () => {
      setTimelineChartWidth(timelineElement.getBoundingClientRect().width);
    };
    updateTimelineWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateTimelineWidth);
      return () => window.removeEventListener('resize', updateTimelineWidth);
    }

    const observer = new ResizeObserver(updateTimelineWidth);
    observer.observe(timelineElement);
    return () => observer.disconnect();
  }, [showExclusionPlanner]);

  useEffect(() => {
    if (!activeTimelineDrag) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const nextTime = getTimeFromTimelinePointer(event.clientX);
      const appliedTime = applyTimelineDrag(activeTimelineDrag, nextTime);
      setActiveTimelineDrag(previous => previous ? {
        ...previous,
        time: appliedTime,
        left: getTimelineLeft(appliedTime),
      } : previous);
    };

    const handlePointerUp = () => {
      logAudit(
        'Priorities',
        'Edit',
        `Dragged ${activeTimelineDrag.label}`,
        `${formatTimeLabel(activeTimelineDrag.originalTime)} → ${formatTimeLabel(activeTimelineDrag.time)}`,
      );
      setActiveTimelineDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeTimelineDrag]);

  const [traineeCurrencyCourseSelection, setTraineeCurrencyCourseSelection] = useState<Set<string>>(new Set());
  const [traineeCurrencySelection, setTraineeCurrencySelection] = useState<Set<number>>(new Set());
  const [traineeCurrencyIncludeFlights, setTraineeCurrencyIncludeFlights] = useState(true);
  const [traineeCurrencyIncludeSims, setTraineeCurrencyIncludeSims] = useState(true);
  const [traineeCurrencyCrewMode, setTraineeCurrencyCrewMode] = useState<'withInstructor' | 'solo'>('withInstructor');
  const [isTraineeCurrencyBuilderOpen, setIsTraineeCurrencyBuilderOpen] = useState(false);
  const [staffCurrencySelection, setStaffCurrencySelection] = useState<Set<string>>(new Set());
  const [staffCurrencyIncludeFlights, setStaffCurrencyIncludeFlights] = useState(true);
  const [staffCurrencyIncludeSims, setStaffCurrencyIncludeSims] = useState(true);
  const [staffCurrencyCrewMode, setStaffCurrencyCrewMode] = useState<'withOtherPilot' | 'solo'>('withOtherPilot');
  const [isStaffCurrencyBuilderOpen, setIsStaffCurrencyBuilderOpen] = useState(false);
  const [openCurrencyDraftId, setOpenCurrencyDraftId] = useState<string | null>(null);
  const [isCurrencyConfigApplyOpen, setIsCurrencyConfigApplyOpen] = useState(false);
  const [bulkCurrencyAircraftConfigId, setBulkCurrencyAircraftConfigId] = useState(BASE_AIRCRAFT_CONFIG.id);
  const currencyDraftStorageKey = 'neoCurrencyDraftEvents';
  const [currencyDraftEvents, setCurrencyDraftEvents] = useState<Array<{
    id: string;
    audience: 'trainee' | 'staff';
    personId: number;
    personKey: string;
    personName: string;
    course?: string;
    rank?: string;
    eventType: 'flight' | 'ftd';
    crewMode: 'withInstructor' | 'solo' | 'withOtherPilot';
    dueCurrencies: string[];
    selectedCurrencies: string[];
    aircraftConfigId: string;
    selected: boolean;
    pushed: boolean;
  }>>(() => {
    try {
      const stored = localStorage.getItem(currencyDraftStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? parsed.map((draft: any) => ({
            ...draft,
            aircraftConfigId: draft?.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id,
          }))
        : [];
    } catch {
      return [];
    }
  });

  const availableCurrencyCourses = useMemo(() => {
    return Array.from(new Set(traineesData.map(t => t.course).filter(Boolean))).sort();
  }, [traineesData]);

  const activeCurrencyDraftIds = useMemo(() => {
    return new Set(
      activeScheduleEvents
        .filter(event => event.date === buildDfpDate && !!event.currencyDraftId)
        .map(event => event.currencyDraftId as string)
    );
  }, [activeScheduleEvents, buildDfpDate]);

  const isCurrencyDue = (person: { currencyStatus?: any[] }, currencyName: string) => {
    const status = person.currencyStatus?.find(c => c.currencyName === currencyName);
    if (!status) return true;
    if (status.isInactive) return true;
    if (status.isCurrent === false) return true;
    if (status.calculatedExpiry && status.calculatedExpiry <= buildDfpDate) return true;
    return false;
  };

  const getDueCurrencies = (person: { currencyStatus?: any[] }) => {
    return currencyNames.filter(name => isCurrencyDue(person, name));
  };

  const traineeCurrencyRows = useMemo(() => {
    return traineesData
      .filter(t => !t.isPaused && traineeCurrencyCourseSelection.has(t.course))
      .map(trainee => ({ trainee, dueCurrencies: getDueCurrencies(trainee) }))
      .filter(row => row.dueCurrencies.length > 0)
      .sort((a, b) => a.trainee.course.localeCompare(b.trainee.course) || a.trainee.name.localeCompare(b.trainee.name));
  }, [traineesData, traineeCurrencyCourseSelection, currencyNames, buildDfpDate]);

  const staffCurrencyRows = useMemo(() => {
    return instructorsData
      .map(instructor => ({ instructor, personKey: String(instructor.id || instructor.idNumber || instructor.name), dueCurrencies: getDueCurrencies(instructor) }))
      .filter(row => row.dueCurrencies.length > 0)
      .sort((a, b) => {
        const rankDiff = staffRankOrder.indexOf(a.instructor.rank) - staffRankOrder.indexOf(b.instructor.rank);
        return rankDiff !== 0 ? rankDiff : a.instructor.name.localeCompare(b.instructor.name);
      });
  }, [instructorsData, currencyNames, buildDfpDate]);

  useEffect(() => {
    localStorage.setItem(currencyDraftStorageKey, JSON.stringify(currencyDraftEvents));
  }, [currencyDraftEvents]);

  useEffect(() => {
    setTraineeCurrencySelection(prev => {
      const validIds = new Set(traineeCurrencyRows.map(row => row.trainee.idNumber));
      return new Set(Array.from(prev).filter(id => validIds.has(id)));
    });
  }, [traineeCurrencyRows]);

  useEffect(() => {
    setStaffCurrencySelection(prev => {
      if (prev.size > 0) {
        const validIds = new Set(staffCurrencyRows.map(row => row.personKey));
        return new Set(Array.from(prev).filter(id => validIds.has(id)));
      }
      return prev;
    });
  }, [staffCurrencyRows]);

  const toggleSetValue = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const buildCurrencyDraftEvents = (
    audience: 'trainee' | 'staff',
    people: { idNumber: number; personKey: string; name: string; fullName?: string; course?: string; rank?: string; dueCurrencies: string[] }[],
    includeFlights: boolean,
    includeSims: boolean,
    crewMode: 'withInstructor' | 'solo' | 'withOtherPilot'
  ) => {
    const events: typeof currencyDraftEvents = [];
    people.forEach((person, personIndex) => {
      const displayName = person.fullName || person.name;
      const modeList: ('flight' | 'ftd')[] = [
        ...(includeFlights ? ['flight' as const] : []),
        ...(includeSims ? ['ftd' as const] : []),
      ];
      modeList.forEach((type, typeIndex) => {
        events.push({
          id: `currency-draft-${audience}-${type}-${person.idNumber}-${buildDfpDate}-${uuidv4()}`,
          audience,
          personId: person.idNumber,
          personKey: person.personKey,
          personName: displayName,
          course: person.course,
          rank: person.rank,
          eventType: type,
          crewMode,
          dueCurrencies: person.dueCurrencies,
          selectedCurrencies: [],
          aircraftConfigId: BASE_AIRCRAFT_CONFIG.id,
          selected: true,
          pushed: false,
        });
      });
    });
    return events;
  };

  const buildCurrencyPriorityEventsFromDrafts = (drafts: typeof currencyDraftEvents): ScheduleEvent[] => {
    return drafts.map((draft, index) => {
      const isSolo = draft.crewMode === 'solo';
      const startBase = draft.eventType === 'flight' ? flyingStartTime : ftdStartTime;
      const selectedCurrencyText = draft.selectedCurrencies.length > 0 ? draft.selectedCurrencies.join(', ') : '';
      const aircraftConfigId = draft.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id;
      return {
        id: `currency-${draft.audience}-${draft.eventType}-${draft.personId}-${buildDfpDate}-${uuidv4()}`,
        currencyDraftId: draft.id,
        date: buildDfpDate,
        type: draft.eventType,
        instructor: '',
        student: draft.personName,
        pilot: isSolo ? draft.personName : '',
        flightNumber: 'CURR',
        duration: draft.eventType === 'flight' ? 1.2 : 1.5,
        startTime: startBase,
        resourceId: '',
        color: 'bg-amber-500/80',
        flightType: isSolo ? 'Solo' : 'Dual',
        locationType: 'Local',
        origin: school,
        destination: school,
        isTimeFixed: true,
        eventCategory: 'currency',
        currency: selectedCurrencyText || 'Currency',
        priority: 'Medium',
        notes: selectedCurrencyText ? `Currency event required: ${selectedCurrencyText}` : 'Currency event required',
        ...(draft.eventType === 'flight' ? {
          aircraftConfigId,
          acceptableAircraftConfigs: [aircraftConfigId],
        } : {}),
      };
    });
  };

  const addTraineeCurrencyEventsToPriority = () => {
    const selectedPeople = traineeCurrencyRows
      .filter(row => traineeCurrencySelection.has(row.trainee.idNumber))
      .map(row => ({ idNumber: row.trainee.idNumber, personKey: String(row.trainee.idNumber), name: row.trainee.name, fullName: row.trainee.fullName, course: row.trainee.course, dueCurrencies: row.dueCurrencies }));
    const events = buildCurrencyDraftEvents('trainee', selectedPeople, traineeCurrencyIncludeFlights, traineeCurrencyIncludeSims, traineeCurrencyCrewMode);
    if (events.length === 0) return;
    setCurrencyDraftEvents(prev => [...prev, ...events]);
    logAudit('Priorities', 'Build', 'Built trainee currency event review list', `${events.length} Currency event(s) staged`);
  };

  const addStaffCurrencyEventsToPriority = () => {
    const selectedPeople = staffCurrencyRows
      .filter(row => staffCurrencySelection.has(row.personKey))
      .map(row => ({ idNumber: row.instructor.idNumber, personKey: row.personKey, name: row.instructor.name, rank: row.instructor.rank, dueCurrencies: row.dueCurrencies }));
    const events = buildCurrencyDraftEvents('staff', selectedPeople, staffCurrencyIncludeFlights, staffCurrencyIncludeSims, staffCurrencyCrewMode);
    if (events.length === 0) return;
    setCurrencyDraftEvents(prev => [...prev, ...events]);
    logAudit('Priorities', 'Build', 'Built staff currency event review list', `${events.length} Currency event(s) staged`);
  };

  const pushSelectedCurrencyDraftsToPriority = () => {
    const selectedDrafts = currencyDraftEvents.filter(event => event.selected);
    const priorityEvents = buildCurrencyPriorityEventsFromDrafts(selectedDrafts);
    if (priorityEvents.length === 0) return;
    onAddPriorityEvents(priorityEvents);
    const pushedIds = new Set(selectedDrafts.map(event => event.id));
    setCurrencyDraftEvents(prev => prev.map(event =>
      pushedIds.has(event.id) ? { ...event, selected: false, pushed: true } : event
    ));
    setOpenCurrencyDraftId(null);
    logAudit('Priorities', 'Add', 'Added reviewed currency events to Highest Priority queue', `${priorityEvents.length} Currency event(s) added`);
  };

  const currencyAircraftConfigChoices = useMemo(() => ([
    { id: ANY_AIRCRAFT_CONFIG, label: 'ANY', definition: 'Any aircraft configuration is acceptable.' },
    ...aircraftConfigOptions,
  ]), [aircraftConfigOptions]);

  const applyCurrencyAircraftConfigToDrafts = () => {
    const targetConfigId = bulkCurrencyAircraftConfigId || BASE_AIRCRAFT_CONFIG.id;
    let updatedCount = 0;
    setCurrencyDraftEvents(prev => prev.map(event => {
      if (activeCurrencyDraftIds.has(event.id)) return event;
      updatedCount += 1;
      return { ...event, aircraftConfigId: targetConfigId };
    }));
    setIsCurrencyConfigApplyOpen(false);
    const configLabel = currencyAircraftConfigChoices.find(choice => choice.id === targetConfigId)?.label || targetConfigId;
    logAudit('Priorities', 'Edit', 'Applied aircraft CONFIG to consolidated currency events', `${configLabel} applied to ${updatedCount} staged Currency event(s)`);
  };

  const toggleDraftCurrency = (draftId: string, currencyName: string) => {
    setCurrencyDraftEvents(prev => prev.map(event => {
      if (event.id !== draftId) return event;
      const nextCurrencies = toggleSetValue(new Set(event.selectedCurrencies), currencyName);
      return { ...event, selectedCurrencies: Array.from(nextCurrencies) };
    }));
  };

  // --- Course Priority Handlers ---
  const handleCourseDragStart = (index: number) => { courseDragItem.current = index; };
  const handleCourseDragEnter = (index: number) => { courseDragOverItem.current = index; };
  const handleCourseDragEnd = () => {
    if (courseDragItem.current !== null && courseDragOverItem.current !== null) {
      const newPriorities = [...coursePriorities];
      const draggedItemContent = newPriorities.splice(courseDragItem.current, 1)[0];
      newPriorities.splice(courseDragOverItem.current, 0, draggedItemContent);
      onUpdatePriorities(newPriorities);
         
         // Log the change
         logAudit('Priorities', 'Edit', 'Updated course priority order', 
           `Moved ${draggedItemContent} from position ${courseDragItem.current + 1} to position ${courseDragOverItem.current + 1}`);
    }
    courseDragItem.current = null;
    courseDragOverItem.current = null;
  };

  const handlePercentageChange = (courseToChange: string, direction: 'increase' | 'decrease') => {
    const newPercentages = new Map<string, number>(coursePercentages);
    const currentPercent = newPercentages.get(courseToChange) ?? 0;
    const changeAmount = 5;
    
    // Calculate new percentage with 5% minimum enforcement
    let newPercent = direction === 'increase' 
      ? Math.min(100, currentPercent + changeAmount) 
      : Math.max(5, currentPercent - changeAmount); // Enforce 5% minimum
    
    newPercentages.set(courseToChange, newPercent);
       
    // Log the change
    logAudit('Priorities', 'Edit', `Updated course percentage for ${courseToChange}`, `${currentPercent}% → ${newPercent}%`);
    onUpdatePercentages(newPercentages);
  };
  
  const ArrowButton: React.FC<{ direction: 'up' | 'down', onClick: () => void, disabled?: boolean }> = ({ direction, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-0.5 text-gray-400 rounded-sm hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label={direction === 'up' ? 'Increase percentage' : 'Decrease percentage'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        {direction === 'up' ? <path fillRule="evenodd" d="M10 5l-5.5 5.5h11L10 5z" clipRule="evenodd" /> : <path fillRule="evenodd" d="M10 15l5.5-5.5h-11L10 15z" clipRule="evenodd" />}
      </svg>
    </button>
  );
  
  const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const CurrencySelect: React.FC<{ request: SctRequest; type: 'flight' | 'ftd' }> = ({ request, type }) => {
    const dropdownKey = `${type}:${request.id}`;
    const isOpen = openCurrencyRequestKey === dropdownKey;
    const selectedLabel = request.currency || 'Select Currency';

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenCurrencyRequestKey(isOpen ? null : dropdownKey)}
          className="flex w-full items-center justify-between rounded border border-gray-600 bg-gray-700 px-2 py-1 text-left text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <span className="truncate">{selectedLabel}</span>
          <span className="ml-2 text-[10px] text-gray-300">v</span>
        </button>
        {isOpen && (
          <div className="absolute left-0 top-full z-[120] mt-1 max-h-64 w-64 overflow-y-auto rounded border border-sky-500/40 bg-slate-950 shadow-xl">
            <button
              type="button"
              onClick={() => {
                onUpdateSctRequest(request.id, 'currency', '', type);
                setOpenCurrencyRequestKey(null);
              }}
              className="block w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-sky-900/70"
            >
              Select Currency
            </button>
            {currencyNames.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onUpdateSctRequest(request.id, 'currency', name, type);
                  setOpenCurrencyRequestKey(null);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-sky-900/70"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  
  
  const SctRequestTable: React.FC<{ type: 'flight' | 'ftd', requests: SctRequest[] }> = ({ type, requests }) => {
      
    const calculateDaysToExpire = (expireDateStr: string): { days: number; color: string } | null => {
        if (!expireDateStr) return null;
        try {
            const expiry = new Date(expireDateStr + 'T00:00:00Z');
            const build = new Date(buildDfpDate + 'T00:00:00Z');
            if (isNaN(expiry.getTime()) || isNaN(build.getTime())) return null;

            const diffTime = expiry.getTime() - build.getTime();
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let color = 'text-green-400';
            if (days <= 30) color = 'text-red-400';
            else if (days <= 60) color = 'text-amber-400';
            
            return { days, color };
        } catch (e) {
            return null;
        }
    };

    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString + 'T00:00:00Z');
            if (isNaN(date.getTime())) return '-';
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
            const year = String(date.getUTCFullYear()).slice(-2);
            return `${day}${month}${year}`;
        } catch (e) {
            return '-';
        }
    };
    
      return (
      <div>
          <h3 className="text-lg font-semibold text-sky-400 mb-2">{type === 'flight' ? 'Flights' : ftdLabel}</h3>
          <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                      <tr>
                          <th className="py-2 px-2 text-left">Name</th>
                          <th className="py-2 px-2 text-left">Event</th>
                          <th className="py-2 px-2 text-left">Solo/Dual</th>
                          <th className="py-2 px-2 text-left">Currency</th>
                          <th className="py-2 px-2 text-left">Currency Expire</th>
                          <th className="py-2 px-2 text-left">Date Req.</th>
                          <th className="py-2 px-2 text-left">Days to Expire</th>
                          <th className="py-2 px-2 text-left">Priority</th>
                          {type === 'flight' && <th className="py-2 px-2 text-left">Config</th>}
                          <th className="py-2 px-2 text-left">Status</th>
                          <th className="py-2 px-1 text-right"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                      {requests.map(req => {
                          const expiryInfo = calculateDaysToExpire(req.currencyExpire);
                          return (
                          <tr key={req.id}>
                              <td className="py-1 px-2 w-48">
                                  <select value={req.name} onChange={e => onUpdateSctRequest(req.id, 'name', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="">Select Instructor</option>
                                      {instructorNames.map(name => <option key={name} value={name}>{name}</option>)}
                                  </select>
                              </td>
                              <td className="py-1 px-2 w-40">
                                  <select value={req.event} onChange={e => onUpdateSctRequest(req.id, 'event', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      {sctEvents.map(e => <option key={e} value={e}>{e}</option>)}
                                  </select>
                              </td>
                              <td className="py-1 px-2 w-32">
                                  <select value={req.flightType} onChange={e => onUpdateSctRequest(req.id, 'flightType', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="Solo">Solo</option>
                                      <option value="Dual">Dual</option>
                                  </select>
                              </td>
                               <td className="py-1 px-2 w-48">
                                  <CurrencySelect request={req} type={type} />
                              </td>
                               <td className="py-1 px-2 w-40">
                                  <input type="date" value={req.currencyExpire} onChange={e => onUpdateSctRequest(req.id, 'currencyExpire', e.target.value, type)} style={{colorScheme: 'dark'}} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs" />
                              </td>
                              <td className="py-1 px-2 w-24 text-gray-300 font-mono">
                                {formatDate(req.dateRequested)}
                              </td>
                              <td className="py-1 px-2 w-32 text-center">
                                {expiryInfo ? <span className={`font-bold ${expiryInfo.color}`}>{expiryInfo.days}</span> : <span className="text-gray-500">-</span>}
                              </td>
                               <td className="py-1 px-2 w-32">
                                  <select value={req.priority} onChange={e => onUpdateSctRequest(req.id, 'priority', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="High">High</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Low">Low</option>
                                  </select>
                              </td>
                              {type === 'flight' && (
                                  <td className="py-1 px-2 w-48">
                                      <AircraftConfigSelect
                                          value={req.aircraftConfigId}
                                          definitions={aircraftConfigOptions}
                                          onChange={(aircraftConfigId) => onUpdateSctRequest(req.id, 'aircraftConfigId', aircraftConfigId, 'flight')}
                                      />
                                  </td>
                              )}
                              <td className="py-1 px-2 w-24">
                                  {req.submitted ? (
                                      <span className="text-green-400 text-xs font-semibold">Submitted</span>
                                  ) : (
                                      <button 
                                          onClick={() => {
                                              if (req.name && req.event) {
                                                  onSubmitSctRequest(req.id, type);
                                              }
                                          }}
                                          disabled={!req.name || !req.event}
                                          className={`px-2 py-1 text-xs rounded font-semibold ${
                                              req.name && req.event 
                                                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                          }`}
                                      >
                                          Submit
                                      </button>
                                  )}
                              </td>
                              <td className="py-1 px-1 text-right">
                                  <button onClick={() => onRemoveSctRequest(req.id, type)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                              </td>
                          </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
          <button onClick={() => onAddSctRequest(type)} className="mt-2 px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 text-xs font-semibold">+ Add Request</button>
      </div>
  )};

  const isRemedialEvent = (event: ScheduleEvent) => {
      const item = syllabusDetails.find(s => s.code === event.flightNumber);
      return item?.isRemedial || event.flightNumber.includes('REM') || event.flightNumber.endsWith('RF') || event.isRemedial;
  };

  // CRITICAL FIX: Don't filter out force-scheduled remedial events
  // They should appear in Highest Priority Events list just like SCT events
  // Only filter out remedial events that are NOT in the highestPriorityEvents list
  const standardPriorityEvents = highestPriorityEvents;
  
  // Calculate incomplete remedials for display
  const incompleteRemedials = useMemo(() => {
        const list: { trainee: Trainee, item: SyllabusItemDetail }[] = [];
        traineesData.forEach(t => {
            if(t.isPaused) return;
            // Use individual LMP or fallback to master
            const lmp = traineeLMPs.get(t.fullName) || syllabusDetails;
            const tScores = scores.get(t.fullName) || [];
            const completedIds = new Set(tScores.map(s => s.event));

            lmp.forEach(item => {
                // Check if it's a remedial item (flag or naming convention) AND not completed
                if ((item.isRemedial || item.code.includes('REM') || item.code.endsWith('RF')) && !completedIds.has(item.id)) {
                    list.push({ trainee: t, item });
                }
            });
        });
        return list.sort((a, b) => a.trainee.name.localeCompare(b.trainee.name));
    }, [traineesData, traineeLMPs, scores, syllabusDetails]);


  const PriorityEventTable: React.FC<{ events: ScheduleEvent[] }> = ({ events }) => (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-400 uppercase">
                <tr>
                    <th className="py-2 px-2 text-left">Name</th>
                    <th className="py-2 px-2 text-left">Event</th>
                    <th className="py-2 px-2 text-left">Solo/Dual</th>
                    <th className="py-2 px-2 text-left">Currency</th>
                    <th className="py-2 px-2 text-left">Config</th>
                    <th className="py-2 px-2 text-left">Priority</th>
                    <th className="py-2 px-2 text-left">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
                {events.map(event => {
                    const personName = event.instructor || event.pilot || event.student || 'N/A';
                        const isPublishedInActiveSchedule = activeScheduleEvents.some(activeEvent =>
                            activeEvent.id === event.id ||
                            (!!event.currencyDraftId && activeEvent.currencyDraftId === event.currencyDraftId)
                        );
                        const rowText = isPublishedInActiveSchedule ? 'text-green-300' : 'text-gray-300';
                    return (
                    <tr key={event.id} onClick={() => onSelectEvent(event)} className="hover:bg-sky-900/50 transition-colors cursor-pointer">
                        <td className={`py-2 px-2 ${rowText}`}>{personName}</td>
                        <td className={`py-2 px-2 ${rowText} font-semibold`}>{event.flightNumber}</td>
                        <td className={`py-2 px-2 ${rowText}`}>{event.soloOrDual || event.flightType || 'N/A'}</td>
                        <td className={`py-2 px-2 ${rowText}`}>{event.currency || 'N/A'}</td>
                        <td className={`py-2 px-2 ${rowText} font-semibold`}>{getAircraftConfigSummary(event)}</td>
                        <td className={`py-2 px-2 font-semibold ${
                            event.priority === 'Medium'
                                ? 'text-amber-300'
                                : event.priority === 'Low'
                                    ? 'text-green-300'
                                    : 'text-red-300'
                        }`}>{event.priority || 'High'}</td>
                        <td className="py-2 px-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeletePriorityEvent(event.id); }} 
                                className="p-1 text-gray-400 hover:text-red-400"
                                title="Delete event"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </td>
                    </tr>
                    );
                })}
            </tbody>
        </table>
      </div>
  );
  
  const timelineBoundaryMarkers: Array<{
    key: string;
    time: number;
    label: string;
    color: string;
    text: string;
    target: TimelineDragTarget;
  }> = [
    { key: 'day-start', time: flyingStartTime, label: 'Day start', color: 'bg-sky-100', text: 'text-sky-100', target: { kind: 'day', edge: 'start' } },
    { key: 'day-end', time: flyingEndTime, label: 'Day end', color: 'bg-sky-100', text: 'text-sky-100', target: { kind: 'day', edge: 'end' } },
    ...(allowNightFlying ? [
      { key: 'night-start', time: commenceNightFlying, label: 'Night start', color: 'bg-indigo-100', text: 'text-indigo-100', target: { kind: 'night' as const, edge: 'start' as const } },
      { key: 'night-end', time: ceaseNightFlying, label: 'Night end', color: 'bg-indigo-100', text: 'text-indigo-100', target: { kind: 'night' as const, edge: 'end' as const } },
    ] : []),
    ...flyingWindowExclusions.flatMap((period) => ([
      { key: `exclusion-${period.id}-start`, time: period.startTime, label: 'Exclusion start', color: exclusionBoundaryColor, text: 'text-rose-100', target: { kind: 'exclusion' as const, id: period.id, edge: 'start' as const } },
      { key: `exclusion-${period.id}-end`, time: period.endTime, label: 'Exclusion end', color: exclusionBoundaryColor, text: 'text-rose-100', target: { kind: 'exclusion' as const, id: period.id, edge: 'end' as const } },
    ])),
  ];

  const dayEndNightStartOverlap = allowNightFlying && boundaryLabelsOverlap(flyingEndTime, commenceNightFlying);
  const flyingWindowBoundaryLabels: Array<{
    key: string;
    time: number;
    label: string;
    text: string;
    border: string;
    bg: string;
    level: 'top' | 'lower';
  }> = [
    { key: 'day-start-label', time: flyingStartTime, label: 'Day start', text: 'text-sky-100', border: 'border-sky-300/55', bg: 'bg-sky-400/14', level: 'top' },
    { key: 'day-end-label', time: flyingEndTime, label: 'Day end', text: 'text-sky-100', border: 'border-sky-300/55', bg: 'bg-sky-400/14', level: 'top' },
    ...(allowNightFlying ? [
      { key: 'night-start-label', time: commenceNightFlying, label: 'Night start', text: 'text-indigo-100', border: 'border-indigo-300/55', bg: 'bg-indigo-400/15', level: dayEndNightStartOverlap ? 'lower' as const : 'top' as const },
      { key: 'night-end-label', time: ceaseNightFlying, label: 'Night end', text: 'text-indigo-100', border: 'border-indigo-300/55', bg: 'bg-indigo-400/15', level: 'top' as const },
    ] : []),
  ];

     return (
       <>
           <div className="section-course-demand space-y-6">
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Third Input</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Course Demand</h2>
                <p className="mt-1 text-sm text-slate-300">Set the relative course weighting after time windows, resources and people rules are known.</p>
            </div>

            <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg h-fit">
                <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-200">Course Priority</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {school === 'ESL' ? 'East Sale (ESL)' : 'Pearce (PEA)'} &mdash; locality courses only
                        </p>
                    </div>
                    <span className="text-xs text-gray-500">Last updated: {courseTimestamp}</span>
                </div>
                <div className="p-4 border-t border-gray-700">
                    {coursePriorities.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                            <p className="text-sm font-medium">No courses found for {school === 'ESL' ? 'East Sale' : 'Pearce'}</p>
                            <p className="text-xs mt-1">Courses will appear here once trainees are loaded for this locality.</p>
                        </div>
                    ) : (
                        <>
                            <ul className="space-y-2">
                                {coursePriorities.map((course, index) => (
                                    <li
                                        key={course}
                                        draggable
                                        onDragStart={() => handleCourseDragStart(index)}
                                        onDragEnter={() => handleCourseDragEnter(index)}
                                        onDragEnd={handleCourseDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="p-3 bg-slate-950/70 border border-slate-700 rounded-md text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className="font-mono text-gray-500">{index + 1}</span>
                                            <span className="font-semibold">{course}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`font-mono w-12 text-center ${totalPercentage !== 100 && 'text-red-400'}`}>{coursePercentages.get(course) ?? 0}%</span>
                                            <div className="flex flex-col">
                                                <ArrowButton direction="up" onClick={() => handlePercentageChange(course, 'increase')} disabled={(coursePercentages.get(course) ?? 0) >= 100} />
                                                <ArrowButton direction="down" onClick={() => handlePercentageChange(course, 'decrease')} disabled={(coursePercentages.get(course) ?? 0) <= 5} />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className={`mt-3 p-2 rounded text-center text-sm font-semibold ${totalPercentage === 100 ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                Total: {totalPercentage}%
                            </div>
                            <div data-priority-help="true" className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded text-xs text-cyan-300">
                                <p className="font-semibold mb-1">&#x2139;&#xFE0F; Weighted Priority System:</p>
                                <ul className="list-disc list-inside space-y-1 text-cyan-200">
                                    <li>Percentages are auto-normalized to 100%</li>
                                    <li>Minimum percentage per course: 5%</li>
                                    <li>Higher % = more events (biased allocation)</li>
                                    <li>All courses still get events (no starvation)</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>
           </div>

           <div className="section-build-timeline space-y-6">
                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Time Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Flying Windows</h2>
                        <p className="mt-1 text-sm text-slate-300">Set the time boundaries that govern where flight, {ftdLabel} and night events may be placed.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <div className="min-h-[20px]" />
                            <label className="mt-2 block text-sm font-medium text-slate-300">Day Flying Window</label>
                            <div className="mt-2 flex items-center space-x-2">
                                <select value={flyingStartTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying start time", `${flyingStartTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFlyingStartTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <span className="shrink-0 text-slate-400">to</span>
                                <select value={flyingEndTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying end time", `${flyingEndTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFlyingEndTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExclusionPlanner(value => !value)}
                                className="mt-3 w-full rounded-md border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/18"
                            >
                                {showExclusionPlanner ? 'Hide Exclusions' : 'Manage Exclusions'}
                            </button>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <div className="min-h-[20px]" />
                            <label className="mt-2 block text-sm font-medium text-slate-300">{ftdLabel} Operating Window</label>
                            <div className="mt-2 flex items-center space-x-2">
                                <select value={ftdStartTime} onChange={(e) => { logAudit("Priorities", "Edit", `Updated ${ftdLabel} start time`, `${ftdStartTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFtdStartTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <span className="shrink-0 text-slate-400">to</span>
                                <select value={ftdEndTime} onChange={(e) => { logAudit("Priorities", "Edit", `Updated ${ftdLabel} end time`, `${ftdEndTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFtdEndTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <div className="flex min-h-[20px] items-center justify-end">
                                <label className="flex cursor-pointer items-center space-x-2 whitespace-nowrap">
                                    <input type="checkbox" checked={allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated allow night flying", `${allowNightFlying} \u2192 ${e.target.checked}`); onUpdateAllowNightFlying(e.target.checked); }} className="h-4 w-4 shrink-0 rounded bg-slate-800 accent-cyan-500" />
                                    <span className="text-sm font-semibold text-cyan-300">Allow Night Flying</span>
                                </label>
                            </div>
                            <label className="mt-2 block text-sm font-medium text-slate-300">Night Flying Window</label>
                            <div className={`mt-2 transition-opacity duration-150 ${allowNightFlying ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div className="flex items-center space-x-2">
                                    <select value={commenceNightFlying} disabled={!allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated commence night flying time", `${commenceNightFlying} \u2192 ${parseFloat(e.target.value)}`); onUpdateCommenceNightFlying(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500 disabled:cursor-not-allowed">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    <span className="shrink-0 text-slate-400">to</span>
                                    <select value={ceaseNightFlying} disabled={!allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated cease night flying time", `${ceaseNightFlying} \u2192 ${parseFloat(e.target.value)}`); onUpdateCeaseNightFlying(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500 disabled:cursor-not-allowed">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExclusionPlanner(value => !value)}
                                className="mt-3 w-full rounded-md border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/18"
                            >
                                {showExclusionPlanner ? 'Hide Exclusions' : 'Manage Exclusions'}
                            </button>
                        </div>
                    </div>
                    <div className={`overflow-hidden border-t border-slate-800 transition-all duration-300 ${showExclusionPlanner ? 'max-h-[760px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-4 p-4 pt-0">
                            <div className="rounded-lg border border-slate-600 bg-slate-900/90 p-4 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Departure and Arrival Exclusions</h3>
                                        <p className="mt-1 text-xs leading-5 text-slate-300">
                                            Exclusion periods prevent NEO Build from placing flight departures, arrivals, or both inside the selected time range.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addExclusionPeriod}
                                        className="rounded-md border border-cyan-400/70 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-50 hover:border-cyan-200"
                                    >
                                                Add Exclusion Period
                                    </button>
                                </div>

                                <div className="rounded-md border border-slate-600 bg-slate-800 p-4">
                                    <div className="relative mb-2 h-5">
                                        {timelineTicks.map((hour) => (
                                            <span
                                                key={`tick-label-${hour}`}
                                                className={`absolute text-[10px] font-semibold tracking-[0.08em] text-slate-200 ${hour === 25 ? '-translate-x-full' : '-translate-x-1/2'}`}
                                                style={{ left: `${((hour - timelineStartHour) / timelineSpanHours) * 100}%` }}
                                            >
                                                {formatTimelineTickLabel(hour)}
                                            </span>
                                        ))}
                                    </div>
                                    <div ref={timelineRef} className="relative h-24 overflow-visible rounded border border-slate-500 bg-slate-900/90 shadow-inner">
                                        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300/60" />
                                        <div
                                            className={`absolute inset-y-0 rounded-sm ring-1 ring-inset ${dayTimelineShade}`}
                                            style={{ left: `${getTimelineLeft(flyingStartTime)}%`, width: `${getTimelineWidth(flyingStartTime, flyingEndTime)}%` }}
                                            title={`Day flying ${formatTimeLabel(flyingStartTime)}-${formatTimeLabel(flyingEndTime)}`}
                                        />
                                        {allowNightFlying && (
                                            <div
                                                className={`absolute inset-y-0 rounded-sm ring-1 ring-inset ${nightTimelineShade}`}
                                                style={{ left: `${getTimelineLeft(commenceNightFlying)}%`, width: `${getTimelineWidth(commenceNightFlying, ceaseNightFlying)}%` }}
                                                title={`Night flying ${formatTimeLabel(commenceNightFlying)}-${formatTimeLabel(ceaseNightFlying)}`}
                                            />
                                        )}
                                        {flyingWindowExclusions.map((period) => (
                                            <div
                                                key={period.id}
                                                className={`absolute inset-y-0 rounded-sm ring-1 ring-inset ${exclusionTimelineShade}`}
                                                style={{ left: `${getTimelineLeft(period.startTime)}%`, width: `${getTimelineWidth(period.startTime, period.endTime)}%` }}
                                                title={`${restrictionLabel(period.restriction)} ${formatTimeLabel(period.startTime)}-${formatTimeLabel(period.endTime)}`}
                                            />
                                        ))}
                                        {timelineBoundaryMarkers.map((marker) => (
                                            <button
                                                key={marker.key}
                                                type="button"
                                                onPointerDown={(event) => startTimelineDrag(event, marker.target, marker.label, marker.time)}
                                                className="absolute inset-y-0 z-30 flex w-5 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                                                style={{ left: `${getTimelineLeft(marker.time)}%` }}
                                                title={`Drag ${marker.label}: ${formatTimeLabel(marker.time)}`}
                                            >
                                                <span className={`h-full w-[3px] rounded-full ${marker.color} shadow-[0_0_12px_currentColor]`} />
                                            </button>
                                        ))}
                                        {timelineTicks.map((hour) => (
                                            <div
                                                key={`tick-line-${hour}`}
                                                className="absolute inset-y-0 z-10 border-l border-slate-400/50"
                                                style={{ left: `${((hour - timelineStartHour) / timelineSpanHours) * 100}%` }}
                                            />
                                        ))}
                                        {activeTimelineDrag && (
                                            <div
                                                className="pointer-events-none absolute -top-11 z-40 -translate-x-1/2 rounded-md border border-cyan-200/70 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-cyan-50 shadow-xl"
                                                style={{ left: `${activeTimelineDrag.left}%` }}
                                            >
                                                <span className="block text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">{activeTimelineDrag.label}</span>
                                                {formatCompactTimeLabel(activeTimelineDrag.time)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative mt-2 h-14">
                                        {flyingWindowBoundaryLabels.map((marker) => (
                                            <span
                                                key={marker.key}
                                                className={`absolute -translate-x-1/2 whitespace-nowrap rounded border ${marker.border} ${marker.bg} px-1.5 py-1 text-[10px] font-semibold ${marker.text} ${marker.level === 'lower' ? 'top-7' : 'top-0'}`}
                                                style={{ left: `${getTimelineLeft(marker.time)}%` }}
                                            >
                                                {marker.label} {formatCompactTimeLabel(marker.time)}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-300">
                                        <span className="inline-flex items-center gap-1.5"><span className={`h-3.5 w-5 rounded-sm ring-1 ring-inset ${dayTimelineShade}`} /> Day flying period</span>
                                        <span className="inline-flex items-center gap-1.5"><span className={`h-3.5 w-5 rounded-sm ring-1 ring-inset ${nightTimelineShade}`} /> Night flying period</span>
                                        <span className="inline-flex items-center gap-1.5"><span className={`h-3.5 w-5 rounded-sm ring-1 ring-inset ${exclusionTimelineShade}`} /> Exclusion period</span>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {flyingWindowExclusions.length === 0 && (
                                        <div className="rounded-md border border-dashed border-slate-600 bg-slate-950/60 p-4 text-sm text-slate-300">
                                            No departure or arrival exclusions configured.
                                        </div>
                                    )}
                                    {flyingWindowExclusions.map((period, index) => (
                                        <div key={period.id} className="grid grid-cols-1 gap-3 rounded-md border border-slate-700 bg-slate-950/70 p-3 lg:grid-cols-[64px_1fr_1fr_1.3fr_auto] lg:items-end">
                                            <div>
                                                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Period</span>
                                                <span className="mt-2 block rounded border border-slate-700 bg-slate-900 px-2 py-2 text-center text-sm font-bold text-white">{index + 1}</span>
                                            </div>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-slate-400">Start</span>
                                                <select
                                                    value={period.startTime}
                                                    onChange={(event) => updateExclusionPeriod(period.id, { startTime: parseFloat(event.target.value) })}
                                                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-cyan-500"
                                                >
                                                    {exclusionTimeOptions.map(opt => <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-slate-400">End</span>
                                                <select
                                                    value={period.endTime}
                                                    onChange={(event) => updateExclusionPeriod(period.id, { endTime: parseFloat(event.target.value) })}
                                                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-cyan-500"
                                                >
                                                    {exclusionTimeOptions.map(opt => <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-slate-400">Restriction</span>
                                                <select
                                                    value={period.restriction}
                                                    onChange={(event) => updateExclusionPeriod(period.id, { restriction: event.target.value as FlyingWindowExclusionRestriction })}
                                                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-cyan-500"
                                                >
                                                    <option value="departures">No departures</option>
                                                    <option value="arrivals">No arrivals</option>
                                                    <option value="both">No departures or arrivals</option>
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeExclusionPeriod(period.id)}
                                                className="rounded-md border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:border-rose-300 hover:bg-rose-500/10"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Capacity Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Resource Capacity</h2>
                        <p className="mt-1 text-sm text-slate-300">Declare the physical capacity available for this build before weighting the course demand.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="aircraft-count" className="block text-sm font-medium text-slate-300">Total Aircraft Available</label>
                            <input id="aircraft-count" type="number" min={0} value={availableAircraftCount} onChange={(e) => handleAircraftCapacityChange(e.target.value)} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                            {aircraftConfigurationDefinitions.length > 0 && (
                                <div className="mt-4 border-t border-slate-700 pt-3">
                                    <div className="grid grid-cols-1 gap-2">
                                        {aircraftConfigurationDefinitions.map((definition) => {
                                            const isCleanConfig = definition.id === 'CONFIG-0';
                                            const displayValue = isCleanConfig
                                                ? (hasEnteredConfigCapacity ? String(derivedCleanConfigCapacity) : '')
                                                : (aircraftConfigCapacities[definition.id] || '');
                                            return (
                                                <label key={definition.id} className="block">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400" title={definition.definition || definition.label}>
                                                        <span className="truncate">{definition.label}</span>
                                                        <ConfigCapacityInfoHint definition={definition} />
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        inputMode="numeric"
                                                        value={displayValue}
                                                        readOnly={isCleanConfig}
                                                        disabled={isCleanConfig}
                                                        placeholder=""
                                                        onChange={(e) => {
                                                            if (!isCleanConfig) handleAircraftConfigCapacityChange(definition.id, e.target.value);
                                                        }}
                                                        className={`mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-cyan-500 ${isCleanConfig ? 'cursor-not-allowed text-slate-400 opacity-80' : ''}`}
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="ftd-count" className="block text-sm font-medium text-slate-300">{ftdLabel} Available</label>
                            <input id="ftd-count" type="number" value={availableFtdCount} onChange={(e) => { logAudit("Priorities", "Edit", `Updated available ${ftdLabel} count`, `${availableFtdCount} \u2192 ${parseInt(e.target.value)}`); onUpdateFtdCount(parseInt(e.target.value)); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="cpt-count" className="block text-sm font-medium text-slate-300">{cptLabel} Available</label>
                            <input id="cpt-count" type="number" value={availableCptCount} onChange={(e) => { logAudit("Priorities", "Edit", `Updated available ${cptLabel} count`, `${availableCptCount} \u2192 ${parseInt(e.target.value)}`); onUpdateCptCount(parseInt(e.target.value)); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                        </div>
                    </div>
                </div>
           </div>

           <div className="section-people-rules space-y-6">
                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Second Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Instructor Allocation Rules</h2>
                        <p className="mt-1 text-sm text-slate-300">Set whether the build should prefer or require the trainee's assigned instructor chain before using a wider instructor pool for flight and {ftdLabel} events.</p>
                    </div>
                    <div className="p-4 space-y-5">

                        {/* Master switch */}
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <div
                                    onClick={() => {
                                        const next = { ...instructorPriority, enabled: !instructorPriority.enabled };
                                        logAudit("Priorities", "Edit", "Instructor Priority Mode toggled", `${instructorPriority.enabled} → ${next.enabled}`);
                                        onUpdateInstructorPriority(next);
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${instructorPriority.enabled ? 'bg-sky-500' : 'bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${instructorPriority.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                                <span className="font-semibold text-sky-400">Priority Mode</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">
                                When on, flight and {ftdLabel} events follow the instructor groups selected below. Primary Instructor tries to roster the trainee with their primary instructor first; fallback to the secondary instructor or an alternate instructor from the same flight only occurs when those options are also selected.
                            </p>
                        </div>

                        {instructorPriority.enabled && (
                            <div className="space-y-5 pl-2">

                                {/* Hard / Soft toggle */}
                                <div>
                                    <p className="text-sm font-medium text-gray-300 mb-2">Mode</p>
                                    <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1 w-fit">
                                        {(['soft', 'hard'] as const).map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    const next = { ...instructorPriority, mode: m };
                                                    logAudit("Priorities", "Edit", "Instructor Priority mode changed", `${instructorPriority.mode} → ${m}`);
                                                    onUpdateInstructorPriority(next);
                                                }}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                                    instructorPriority.mode === m
                                                        ? m === 'hard' ? 'bg-red-600 text-white shadow' : 'bg-sky-600 text-white shadow'
                                                        : 'text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {m === 'soft' ? 'Soft' : 'Hard'}
                                            </button>
                                        ))}
                                    </div>
                                    {instructorPriority.mode === 'soft' && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-sky-400 font-medium">Soft:</span> The scheduler attempts the selected instructor chain first. If the primary instructor is unavailable, it can fall back to selected secondary or same-flight instructors; if none are available, it may use any otherwise eligible instructor so the event can still be placed.
                                        </p>
                                    )}
                                    {instructorPriority.mode === 'hard' && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-red-400 font-medium">Hard:</span> Flight and {ftdLabel} events are only placed when one of the selected instructor groups is available. If Primary Instructor is selected, the primary instructor must be used unless selected fallback groups are available. If no selected group is free, the event is placed on STBY with no instructor. {cptLabel} and Ground are unaffected.
                                        </p>
                                    )}
                                </div>

                                {/* Soft mode group selection */}
                                {instructorPriority.mode === 'soft' && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-300 mb-2">Preferred Groups
                                            <span className="text-xs text-gray-400 font-normal ml-2">(select one or more)</span>
                                        </p>
                                        <div className="space-y-2">
                                            {([ 
                                                { key: 'primary',    label: 'Primary Instructor',         desc: "Try the trainee's primary instructor first where possible." },
                                                { key: 'secondary',  label: 'Secondary Instructor',       desc: "Allow the trainee's secondary instructor as a fallback when the primary is unavailable." },
                                                { key: 'sameFlight', label: 'Same Flight Instructor',     desc: "Allow another qualified instructor from the trainee's allocated flight as a fallback." },
                                            ] as { key: keyof InstructorPriorityGroups; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                                <label key={key} className="flex items-start space-x-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={instructorPriority.softGroups[key]}
                                                        onChange={(e) => {
                                                            const next: InstructorPriorityConfig = {
                                                                ...instructorPriority,
                                                                softGroups: { ...instructorPriority.softGroups, [key]: e.target.checked }
                                                            };
                                                            logAudit("Priorities", "Edit", `Soft group ${key} changed`, `${instructorPriority.softGroups[key]} → ${e.target.checked}`);
                                                            onUpdateInstructorPriority(next);
                                                        }}
                                                        className="mt-0.5 h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
                                                        <p className="text-xs text-gray-400">{desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hard mode group selection */}
                                {instructorPriority.mode === 'hard' && (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-300 mb-1">Required Groups
                                                <span className="text-xs text-gray-400 font-normal ml-2">(flight/{ftdLabel} will go to STBY if none available)</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mb-2">
                                                Select which instructor groups are authorised for flight and {ftdLabel} placement. With Primary Instructor selected, the build requires the trainee's primary instructor unless you also allow secondary or same-flight fallback. If no selected group is free, the event is placed on STBY with no instructor assigned.
                                            </p>
                                            <div className="space-y-2 bg-gray-750 rounded-lg border border-red-900/40 p-3">
                                                {([
                                                    { key: 'primary',    label: 'Primary Instructor',     desc: "Require the trainee's primary instructor unless an authorised fallback group is also selected and available." },
                                                    { key: 'secondary',  label: 'Secondary Instructor',   desc: "Permit the trainee's secondary instructor as an authorised fallback." },
                                                    { key: 'sameFlight', label: 'Same Flight Instructor', desc: "Permit another qualified instructor from the trainee's allocated flight as an authorised fallback." },
                                                ] as { key: keyof InstructorPriorityGroups; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                                    <label key={key} className="flex items-start space-x-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={instructorPriority.hardGroups[key]}
                                                            onChange={(e) => {
                                                                const next: InstructorPriorityConfig = {
                                                                    ...instructorPriority,
                                                                    hardGroups: { ...instructorPriority.hardGroups, [key]: e.target.checked }
                                                                };
                                                                logAudit("Priorities", "Edit", `Hard group ${key} changed`, `${instructorPriority.hardGroups[key]} → ${e.target.checked}`);
                                                                onUpdateInstructorPriority(next);
                                                            }}
                                                            className="mt-0.5 h-4 w-4 bg-gray-700 rounded accent-red-500"
                                                        />
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
                                                            <p className="text-xs text-gray-400">{desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
                                            <span className="font-semibold">Note:</span> {cptLabel} and Ground school events are not affected by Hard Priority — they will be scheduled with any available instructor as normal.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
                   
        <div className="section-directed-events space-y-6">
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Fourth Input</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Directed Events</h2>
            <p className="mt-1 text-sm text-slate-300">Review hard requests and build exceptions after the normal course weighting is set.</p>
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">SCT Requests</h2>
            <div className="space-y-6">
                <SctRequestTable type="flight" requests={sctFlights} />
                <SctRequestTable type="ftd" requests={sctFtds} />
            </div>
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-sky-400">Trainee Currency Events</h2>
                    <p className="mt-1 text-xs text-slate-400">Open the builder, select courses and trainees, then build a consolidated currency event review list.</p>
                </div>
                <button
                    onClick={() => setIsTraineeCurrencyBuilderOpen(prev => !prev)}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                    {isTraineeCurrencyBuilderOpen ? 'Hide Builder' : 'Build Trainee Currency Events'}
                </button>
            </div>
            {isTraineeCurrencyBuilderOpen && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Courses</p>
                    <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                        {availableCurrencyCourses.map(course => {
                            const courseRows = traineeCurrencyRows.filter(row => row.trainee.course === course);
                            const courseIds = courseRows.map(row => row.trainee.idNumber);
                            const selectedInCourse = courseIds.filter(id => traineeCurrencySelection.has(id)).length;
                            const courseEnabled = traineeCurrencyCourseSelection.has(course);
                            return (
                                <label key={course} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-700 bg-slate-900/80 p-2 text-sm text-slate-200 hover:border-cyan-500/50">
                                    <input
                                        type="checkbox"
                                        checked={courseEnabled}
                                        onChange={() => {
                                            setTraineeCurrencyCourseSelection(prev => {
                                                const next = toggleSetValue(prev, course);
                                                setTraineeCurrencySelection(current => {
                                                    const updated = new Set(current);
                                                    traineesData.filter(t => t.course === course).forEach(t => {
                                                        if (next.has(course)) updated.add(t.idNumber);
                                                        else updated.delete(t.idNumber);
                                                    });
                                                    return updated;
                                                });
                                                return next;
                                            });
                                        }}
                                        className="mt-0.5 h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                    />
                                    <span>
                                        <span className="block font-semibold">{course}</span>
                                        <span className="text-xs text-slate-500">{courseEnabled ? `${selectedInCourse}/${courseIds.length} selected` : 'Not selected'}</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Event Types</p>
                            <label className="mr-4 inline-flex items-center gap-2 text-sm text-slate-300">
                                <input type="checkbox" checked={traineeCurrencyIncludeFlights} onChange={e => setTraineeCurrencyIncludeFlights(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 accent-cyan-500" />
                                Flights
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                                <input type="checkbox" checked={traineeCurrencyIncludeSims} onChange={e => setTraineeCurrencyIncludeSims(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 accent-cyan-500" />
                                {ftdLabel}
                            </label>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Crew Mode</p>
                            <select value={traineeCurrencyCrewMode} onChange={e => setTraineeCurrencyCrewMode(e.target.value as any)} className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white">
                                <option value="withInstructor">Dual</option>
                                <option value="solo">Solo</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950/60 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Trainees</span>
                        <div className="flex flex-wrap justify-end gap-1">
                            <button
                                onClick={() => setTraineeCurrencySelection(prev => new Set([...Array.from(prev), ...traineeCurrencyRows.map(row => row.trainee.idNumber)]))}
                                disabled={traineeCurrencyRows.length === 0}
                                className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                            >
                                Select All
                            </button>
                            <button
                                onClick={() => {
                                    const visibleIds = new Set(traineeCurrencyRows.map(row => row.trainee.idNumber));
                                    setTraineeCurrencySelection(prev => new Set(Array.from(prev).filter(id => !visibleIds.has(id))));
                                }}
                                disabled={traineeCurrencyRows.length === 0}
                                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
                            >
                                Deselect All
                            </button>
                            <button
                                onClick={addTraineeCurrencyEventsToPriority}
                                disabled={traineeCurrencySelection.size === 0 || (!traineeCurrencyIncludeFlights && !traineeCurrencyIncludeSims)}
                                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                            >
                                Add to Consolidated List
                            </button>
                        </div>
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                            <tr>
                                <th className="px-2 py-2 text-center">Add</th>
                                <th className="px-2 py-2 text-left">Course</th>
                                <th className="px-2 py-2 text-left">Trainee</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                            {traineeCurrencyRows.length === 0 && (
                                <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">Select a course to show trainees requiring Currency events.</td></tr>
                            )}
                            {traineeCurrencyRows.map(row => (
                                <tr key={row.trainee.idNumber} className="hover:bg-sky-900/40">
                                    <td className="px-2 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={traineeCurrencySelection.has(row.trainee.idNumber)}
                                            onChange={() => setTraineeCurrencySelection(prev => toggleSetValue(prev, row.trainee.idNumber))}
                                            className="h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-slate-300">{row.trainee.course}</td>
                                    <td className="px-2 py-2 font-semibold text-white">{row.trainee.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>}
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-sky-400">Staff Currency Events</h2>
                    <p className="mt-1 text-xs text-slate-400">Open the builder, select staff, then build a consolidated currency event review list.</p>
                </div>
                <button
                    onClick={() => setIsStaffCurrencyBuilderOpen(prev => !prev)}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                    {isStaffCurrencyBuilderOpen ? 'Hide Builder' : 'Build Staff Currency Events'}
                </button>
            </div>
            {isStaffCurrencyBuilderOpen && <>
            <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                <button
                    onClick={() => setStaffCurrencySelection(new Set(staffCurrencyRows.map(row => row.personKey)))}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                    Select All
                </button>
                <button
                    onClick={() => setStaffCurrencySelection(new Set())}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                    Deselect All
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={staffCurrencyIncludeFlights} onChange={e => setStaffCurrencyIncludeFlights(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 accent-cyan-500" />
                    Flights
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={staffCurrencyIncludeSims} onChange={e => setStaffCurrencyIncludeSims(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 accent-cyan-500" />
                    {ftdLabel}
                </label>
                <label className="text-sm text-slate-300">
                    <span className="mr-2 text-xs uppercase tracking-[0.16em] text-slate-500">Crew Mode</span>
                    <select value={staffCurrencyCrewMode} onChange={e => setStaffCurrencyCrewMode(e.target.value as any)} className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white">
                        <option value="withOtherPilot">With other pilot</option>
                        <option value="solo">Solo</option>
                    </select>
                </label>
                <button
                    onClick={addStaffCurrencyEventsToPriority}
                    disabled={staffCurrencySelection.size === 0 || (!staffCurrencyIncludeFlights && !staffCurrencyIncludeSims)}
                    className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                    Add to Consolidated List
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-2 py-2 text-center">Add</th>
                            <th className="px-2 py-2 text-left">Rank</th>
                            <th className="px-2 py-2 text-left">Staff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                        {staffCurrencyRows.length === 0 && (
                            <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">No staff currently require Currency events.</td></tr>
                        )}
                        {staffCurrencyRows.map(row => (
                            <tr key={row.personKey} className="hover:bg-sky-900/40">
                                <td className="px-2 py-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={staffCurrencySelection.has(row.personKey)}
                                        onChange={() => setStaffCurrencySelection(prev => toggleSetValue(prev, row.personKey))}
                                        className="h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                    />
                                </td>
                                <td className="px-2 py-2 text-slate-300">{row.instructor.rank}</td>
                                <td className="px-2 py-2 font-semibold text-white">{row.instructor.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </>}
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-sky-400">Consolidated Currency Event Build</h2>
                    <p className="mt-1 text-xs text-slate-400">Review built Currency events, optionally tick the currencies being satisfied, then send selected rows to Higher Priority.</p>
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsCurrencyConfigApplyOpen(prev => !prev)}
                            disabled={currencyDraftEvents.length === 0}
                            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                        >
                            Apply CONFIG
                        </button>
                        {isCurrencyConfigApplyOpen && (
                            <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-slate-600 bg-slate-950 p-3 text-left shadow-xl">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">Apply CONFIG to staged Currency events</div>
                                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                                    {currencyAircraftConfigChoices.map(choice => (
                                        <label key={choice.id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-800 bg-slate-900/70 px-2 py-2 text-xs text-slate-200 hover:border-cyan-500/40">
                                            <input
                                                type="checkbox"
                                                checked={bulkCurrencyAircraftConfigId === choice.id}
                                                onChange={() => setBulkCurrencyAircraftConfigId(choice.id)}
                                                className="mt-0.5 h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                            />
                                            <span>
                                                <span className="block font-semibold text-slate-100">{choice.label}</span>
                                                <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{choice.definition || 'No definition has been entered.'}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-3 flex justify-end gap-2 border-t border-slate-800 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCurrencyConfigApplyOpen(false)}
                                        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={applyCurrencyAircraftConfigToDrafts}
                                        className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={pushSelectedCurrencyDraftsToPriority}
                        disabled={currencyDraftEvents.filter(event => event.selected).length === 0}
                        className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                        Push to Higher Priority
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-2 py-2 text-center">Push</th>
                            <th className="px-2 py-2 text-left">Group</th>
                            <th className="px-2 py-2 text-left">Person</th>
                            <th className="px-2 py-2 text-left">Event</th>
                            <th className="px-2 py-2 text-left">Crew</th>
                            <th className="px-2 py-2 text-left">Config</th>
                            <th className="px-2 py-2 text-left">Currencies</th>
                            <th className="px-2 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                        {currencyDraftEvents.length === 0 && (
                            <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">No Currency events built yet. Open a trainee or staff builder above to create the review list.</td></tr>
                        )}
                        {currencyDraftEvents.map(draft => {
                            const isPublishedInActiveSchedule = activeCurrencyDraftIds.has(draft.id);
                            return (
                            <tr key={draft.id} className={`align-top hover:bg-sky-900/40 ${isPublishedInActiveSchedule ? 'text-green-300' : ''}`}>
                                <td className="px-2 py-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={draft.selected}
                                        disabled={isPublishedInActiveSchedule}
                                        onChange={() => setCurrencyDraftEvents(prev => prev.map(event => event.id === draft.id ? { ...event, selected: !event.selected } : event))}
                                        className="h-4 w-4 rounded bg-slate-800 accent-cyan-500 disabled:opacity-40"
                                    />
                                </td>
                                <td className={`px-2 py-2 ${isPublishedInActiveSchedule ? 'text-green-300' : 'text-slate-300'}`}>{draft.audience === 'trainee' ? (draft.course || 'Trainee') : (draft.rank || 'Staff')}</td>
                                <td className={`px-2 py-2 font-semibold ${isPublishedInActiveSchedule ? 'text-green-300' : 'text-white'}`}>{draft.personName}</td>
                                <td className={`px-2 py-2 ${isPublishedInActiveSchedule ? 'text-green-300' : 'text-amber-200'}`}>{draft.eventType === 'flight' ? 'CURR Flight' : `CURR ${ftdLabel}`}</td>
                                <td className={`px-2 py-2 ${isPublishedInActiveSchedule ? 'text-green-300' : 'text-slate-300'}`}>{draft.crewMode === 'solo' ? 'Solo' : draft.audience === 'trainee' ? 'Dual' : 'With other pilot'}</td>
                                <td className="px-2 py-2">
                                    <AircraftConfigSelect
                                        value={draft.aircraftConfigId}
                                        definitions={aircraftConfigOptions}
                                        includeAny
                                        disabled={isPublishedInActiveSchedule || draft.eventType !== 'flight'}
                                        onChange={(aircraftConfigId) => setCurrencyDraftEvents(prev => prev.map(event =>
                                            event.id === draft.id ? { ...event, aircraftConfigId } : event
                                        ))}
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenCurrencyDraftId(prev => prev === draft.id ? null : draft.id)}
                                            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/60"
                                        >
                                            {draft.selectedCurrencies.length > 0 ? `${draft.selectedCurrencies.length} selected` : 'Select currencies'}
                                        </button>
                                        {openCurrencyDraftId === draft.id && (
                                            <div className="absolute z-20 mt-2 max-h-56 w-72 overflow-y-auto rounded-lg border border-slate-600 bg-slate-950 p-3 shadow-xl">
                                                {draft.dueCurrencies.length === 0 ? (
                                                    <p className="text-xs text-slate-500">No due currencies listed.</p>
                                                ) : draft.dueCurrencies.map(currency => (
                                                    <label key={currency} className="mb-2 flex cursor-pointer items-start gap-2 text-xs text-slate-200 last:mb-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={draft.selectedCurrencies.includes(currency)}
                                                            onChange={() => toggleDraftCurrency(draft.id, currency)}
                                                            className="mt-0.5 h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                                        />
                                                        <span>{currency}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-right">
                                    <button
                                        onClick={() => setCurrencyDraftEvents(prev => prev.filter(event => event.id !== draft.id))}
                                        className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Highest Priority Events</h2>
            <PriorityEventTable events={standardPriorityEvents} />
        </div>

        {/* MEDIUM/LOW Priority SCT Events - User can manually include in build */}
        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-2">Optional SCT Events</h2>
            <p className="text-xs text-gray-400 mb-4">MEDIUM and LOW priority SCT events can be manually included in the NEO Build. Check the "Include" box to add to the build.</p>
            {sctFlights.filter(r => r.priority !== 'High').length === 0 && sctFtds.filter(r => r.priority !== 'High').length === 0 && (
              <p className="text-gray-500 text-sm italic">No MEDIUM or LOW priority SCT events. Add SCT requests with MEDIUM or LOW priority in the SCT Requests tab above.</p>
            )}

              {/* SCT Flights - MEDIUM/LOW */}
              {sctFlights.filter(r => r.priority !== 'High').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">SCT Flights</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="py-2 px-2 text-left">Name</th>
                                <th className="py-2 px-2 text-left">Event</th>
                                <th className="py-2 px-2 text-left">Type</th>
                                <th className="py-2 px-2 text-left">Currency</th>
                                <th className="py-2 px-2 text-left">Priority</th>
                                <th className="py-2 px-2 text-left">Config</th>
                                <th className="py-2 px-2 text-center">Include in Build</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {sctFlights.filter(r => r.priority !== 'High').map(req => (
                                <tr key={req.id} className="hover:bg-sky-900/50">
                                    <td className="py-2 px-2 text-gray-300">{req.name}</td>
                                    <td className="py-2 px-2 text-amber-300 font-semibold">{req.event}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.flightType}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.currency || 'N/A'}</td>
                                    <td className={`py-2 px-2 font-semibold ${req.priority === 'Medium' ? 'text-orange-400' : 'text-green-400'}`}>{req.priority}</td>
                                    <td className="py-2 px-2">
                                        <AircraftConfigSelect
                                            value={req.aircraftConfigId}
                                            definitions={aircraftConfigOptions}
                                            onChange={(aircraftConfigId) => onUpdateSctRequest(req.id, 'aircraftConfigId', aircraftConfigId, 'flight')}
                                        />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={req.includeInBuild || false}
                                            onChange={() => onToggleSctInclude(req.id, 'flight')}
                                            className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SCT FTDs - MEDIUM/LOW */}
              {sctFtds.filter(r => r.priority !== 'High').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">SCT {ftdLabel}s</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="py-2 px-2 text-left">Name</th>
                                <th className="py-2 px-2 text-left">Event</th>
                                <th className="py-2 px-2 text-left">Type</th>
                                <th className="py-2 px-2 text-left">Currency</th>
                                <th className="py-2 px-2 text-left">Priority</th>
                                <th className="py-2 px-2 text-left">Config</th>
                                <th className="py-2 px-2 text-center">Include in Build</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {sctFtds.filter(r => r.priority !== 'High').map(req => (
                                <tr key={req.id} className="hover:bg-sky-900/50">
                                    <td className="py-2 px-2 text-gray-300">{req.name}</td>
                                    <td className="py-2 px-2 text-amber-300 font-semibold">{req.event}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.flightType}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.currency || 'N/A'}</td>
                                    <td className={`py-2 px-2 font-semibold ${req.priority === 'Medium' ? 'text-orange-400' : 'text-green-400'}`}>{req.priority}</td>
                                    <td className="py-2 px-2">
                                        <AircraftConfigSelect
                                            value={req.aircraftConfigId}
                                            definitions={aircraftConfigOptions}
                                            disabled
                                            onChange={() => {}}
                                        />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={req.includeInBuild || false}
                                            onChange={() => onToggleSctInclude(req.id, 'ftd')}
                                            className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Remedial Priority Queue</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                      <tr>
                          <th className="py-2 px-2 text-left">Trainee</th>
                          <th className="py-2 px-2 text-left">Course</th>
                          <th className="py-2 px-2 text-left">Event</th>
                          <th className="py-2 px-2 text-left">Staff</th>
                          <th className="py-2 px-2 text-left">Config</th>
                          <th className="py-2 px-2 text-center">Force Schedule</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                     {incompleteRemedials.map(({ trainee, item }) => {
                        const existingRequest = remedialRequests.find(r => r.traineeId === trainee.idNumber && r.eventCode === item.code);
                        const forceSchedule = existingRequest?.forceSchedule || false;
                        // Get allocated staff from the remedial package (resourcesHuman field)
                        const allocatedStaff = item.resourcesHuman && item.resourcesHuman.length > 0 
                            ? item.resourcesHuman[0] 
                            : "Not Assigned";
                        return (
                          <tr key={`${trainee.idNumber}-${item.code}`} className="hover:bg-sky-900/50">
                              <td className="py-2 px-2 font-semibold text-white">{trainee.name}</td>
                              <td className="py-2 px-2 text-gray-300">{trainee.course}</td>
                              <td className="py-2 px-2 text-amber-300 font-mono">{item.code}</td>
                              <td className="py-2 px-2 text-gray-300">
                                  {allocatedStaff}
                              </td>
                              <td className="py-2 px-2">
                                  <AircraftConfigSelect
                                      value={existingRequest?.aircraftConfigId}
                                      definitions={aircraftConfigOptions}
                                      disabled={item.type !== 'Flight'}
                                      onChange={(aircraftConfigId) => onUpdateRemedialAircraftConfig(trainee.idNumber, item.code, aircraftConfigId)}
                                  />
                              </td>
                              <td className="py-2 px-2 text-center">
                                 <input
                                      type="checkbox"
                                      checked={forceSchedule}
                                      onChange={() => onToggleRemedialRequest(trainee.idNumber, item.code)}
                                      className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                  />
                              </td>
                          </tr>
                        );
                     })}
                  </tbody>
              </table>
            </div>
        </div>
        </div>
       </>
  );
};
