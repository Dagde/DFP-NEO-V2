

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest, FlyingWindowExclusionPeriod, FlyingWindowExclusionRestriction, CrewRequirement, StandardMissionProfile, type FormationCallsign } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';
import AuditButton from './AuditButton';
import CrewRequirementEditor, { type CrewRequirementPreset } from './CrewRequirementEditor';
import { logAudit } from '../utils/auditLogger';
import { InstructorPriorityConfig, InstructorPriorityGroups } from '../App';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { ANY_AIRCRAFT_CONFIG, BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import {
  getAirCombatTrainingKey,
  normaliseAirCombatTrainingAssignments,
  normaliseAirCombatSchedulingWeights,
  type AirCombatTrainingStreamWeight,
  type AirCombatSchedulingWeights,
} from '../utils/airCombatTraining';
import {
  getFixedCrewTrainingCodeFromItem,
  getFixedCrewTrainingKey,
  getFixedCrewTrainingKindForLmpType,
  getFixedCrewTrainingTitleFromItem,
  normaliseFixedCrewTrainingPriorities,
  type FixedCrewTrainingStreamPriority,
} from '../utils/fixedCrewTraining';
import { isSyllabusCourseShell } from '../utils/syllabusCourseShell';
import { getAircraftSeatEligibleRoles, type AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import { crewPositionValuesMatch, getCrewPositionDisplayLabel, type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { formatCrewRequirementSummary, normaliseCrewRequirement } from '../utils/crewRequirements';
import {
  normaliseCrewCompositionSettings,
  type CrewCompositionSettings,
  type CurrencyProfile,
} from '../utils/crewCompositionProfiles';
import { getContinuationEventCurrencyProfiles } from '../utils/continuationEvents';
import {
  buildUnitEventCallsign,
  formatUnitCallsignNumber,
  getDefaultUnitCallsign,
  getUnitCallsignEntries,
  type UnitCallsignEntry,
  type UnitCallsignSettings,
} from '../utils/unitCallsigns';
import {
  getQualificationsForOperationalModel,
  normaliseAssignedQualificationIds,
  normaliseQualificationToken,
  normaliseStaffQualificationCatalogue,
  type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
import {
  appendUnavailableLabel,
  getStaffUnavailabilityStatus,
  summariseCrewUnavailability,
  timeFieldToHours,
  type FixedCrewAvailabilityWindow,
} from '../utils/fixedCrewAvailability';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';
import { showDarkAlert, showDarkConfirm } from './DarkMessageModal';

type FixedCrewTrainingStreamDisplay = FixedCrewTrainingStreamPriority & { eventCount?: number };
type PriorityAllocationModel = 'flight_school' | 'air_combat' | 'fixed_crew';
type PriorityAllocationKind = 'course' | 'training_package';
type PriorityAllocationItem = {
  key: string;
  kind: PriorityAllocationKind;
  code: string;
  title?: string;
  locationCode?: string;
  unitCode?: string;
  eventCount?: number;
  weight: number;
  enabled: boolean;
};
const FIXED_CREW_PRIORITY_STEP = 5;
const FIXED_CREW_PRIORITY_TOTAL_STEPS = 100 / FIXED_CREW_PRIORITY_STEP;
const FIXED_CREW_PRIORITY_MIN_PERCENT = 0;
const FIXED_CREW_PRIORITY_COLOURS = [
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#f59e0b',
  '#f472b6',
  '#60a5fa',
  '#fb7185',
  '#c084fc',
  '#2dd4bf',
  '#facc15',
];

const snapFixedCrewPriorityWeight = (value: number): number => (
  Math.max(0, Math.min(100, Math.round((Number(value) || 0) / FIXED_CREW_PRIORITY_STEP) * FIXED_CREW_PRIORITY_STEP))
);

const normalisePriorityAllocationItemsToStep = <T extends { weight: number; enabled?: boolean }>(
  items: T[],
): T[] => {
  const enabled = items.filter(item => item.enabled !== false);
  if (enabled.length === 0) return items.map(item => ({ ...item, weight: 0 }));
  const enabledTotal = enabled.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (enabledTotal <= 0) {
    const baseSteps = Math.floor(FIXED_CREW_PRIORITY_TOTAL_STEPS / enabled.length);
    let extraSteps = FIXED_CREW_PRIORITY_TOTAL_STEPS - (baseSteps * enabled.length);
    return items.map(item => {
      if (item.enabled === false) return { ...item, weight: 0 };
      const steps = baseSteps + (extraSteps > 0 ? 1 : 0);
      if (extraSteps > 0) extraSteps -= 1;
      return { ...item, weight: steps * FIXED_CREW_PRIORITY_STEP };
    });
  }

  const targets = enabled.map((item, index) => {
    const exactSteps = (Math.max(0, Number(item.weight) || 0) / enabledTotal) * FIXED_CREW_PRIORITY_TOTAL_STEPS;
    return { item, index, exactSteps, steps: Math.max(0, Math.round(exactSteps)) };
  });
  let stepDelta = FIXED_CREW_PRIORITY_TOTAL_STEPS - targets.reduce((sum, target) => sum + target.steps, 0);
  while (stepDelta !== 0) {
    const candidates = stepDelta > 0
      ? targets.slice().sort((left, right) => (right.exactSteps - right.steps) - (left.exactSteps - left.steps) || left.index - right.index)
      : targets.filter(target => target.steps > 0).sort((left, right) => (left.exactSteps - left.steps) - (right.exactSteps - right.steps) || left.index - right.index);
    const target = candidates[0];
    if (!target) break;
    target.steps += stepDelta > 0 ? 1 : -1;
    stepDelta += stepDelta > 0 ? -1 : 1;
  }
  const stepsByItem = new Map(targets.map(target => [target.item, target.steps]));
  return items.map(item => ({
    ...item,
    weight: item.enabled === false ? 0 : (stepsByItem.get(item) || 0) * FIXED_CREW_PRIORITY_STEP,
  }));
};

const snapFixedCrewTrainingPriorityWeightsToStep = (
  streams?: Partial<FixedCrewTrainingStreamPriority>[] | null,
): FixedCrewTrainingStreamPriority[] => normaliseFixedCrewTrainingPriorities(streams).map(stream => ({
  ...stream,
  weight: stream.enabled ? snapFixedCrewPriorityWeight(stream.weight) : 0,
}));

const normaliseFixedCrewTrainingPriorityWeightsToStep = (
  streams?: Partial<FixedCrewTrainingStreamPriority>[] | null,
): FixedCrewTrainingStreamPriority[] => {
  const normalised = normaliseFixedCrewTrainingPriorities(streams);
  const enabled = normalised.filter(stream => stream.enabled);
  if (enabled.length === 0) {
    return normalised.map(stream => ({ ...stream, weight: 0 }));
  }

  const enabledTotal = enabled.reduce((sum, stream) => sum + Math.max(0, Number(stream.weight) || 0), 0);
  if (enabledTotal <= 0) {
    let remainingSteps = FIXED_CREW_PRIORITY_TOTAL_STEPS;
    const baseSteps = Math.floor(FIXED_CREW_PRIORITY_TOTAL_STEPS / enabled.length);
    const extraSteps = FIXED_CREW_PRIORITY_TOTAL_STEPS - (baseSteps * enabled.length);
    let enabledIndex = 0;
    return normalised.map(stream => {
      if (!stream.enabled) return { ...stream, weight: 0 };
      const assignedSteps = baseSteps + (enabledIndex < extraSteps ? 1 : 0);
      enabledIndex += 1;
      remainingSteps -= assignedSteps;
      return { ...stream, weight: Math.max(0, assignedSteps + (enabledIndex === enabled.length ? remainingSteps : 0)) * FIXED_CREW_PRIORITY_STEP };
    });
  }

  const enabledTargets = enabled.map((stream, index) => {
    const exactSteps = (Math.max(0, Number(stream.weight) || 0) / enabledTotal) * FIXED_CREW_PRIORITY_TOTAL_STEPS;
    return {
      key: stream.key,
      index,
      exactSteps,
      steps: Math.max(0, Math.round(exactSteps)),
    };
  });
  let stepDelta = FIXED_CREW_PRIORITY_TOTAL_STEPS - enabledTargets.reduce((sum, target) => sum + target.steps, 0);
  while (stepDelta !== 0) {
    const candidates = stepDelta > 0
      ? enabledTargets
          .slice()
          .sort((left, right) => (right.exactSteps - right.steps) - (left.exactSteps - left.steps) || left.index - right.index)
      : enabledTargets
          .filter(target => target.steps > 0)
          .sort((left, right) => (left.exactSteps - left.steps) - (right.exactSteps - right.steps) || left.index - right.index);
    const target = candidates[0];
    if (!target) break;
    target.steps += stepDelta > 0 ? 1 : -1;
    stepDelta += stepDelta > 0 ? -1 : 1;
  }
  const stepsByKey = new Map(enabledTargets.map(target => [target.key, target.steps]));
  return normalised.map(stream => ({
    ...stream,
    weight: stream.enabled ? (stepsByKey.get(stream.key) || 0) * FIXED_CREW_PRIORITY_STEP : 0,
  }));
};

interface PrioritiesViewProps {
  school?: string;
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
  maxAircraftCount?: number;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
  aircraftConfigCapacities?: Record<string, string>;
  onUpdateAircraftConfigCapacities?: (capacities: Record<string, string>) => void;
  availableFtdCount: number;
  onUpdateFtdCount: (count: number) => void;
  maxFtdCount?: number;
  availableCptCount: number;
  onUpdateCptCount: (count: number) => void;
  maxCptCount?: number;
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
  scheduledBuildEvents?: ScheduleEvent[];
  publishedScheduleEvents?: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onAddPriorityEvents: (events: ScheduleEvent[]) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  onDeletePriorityEvent: (eventId: string) => void;
  instructorPriority: InstructorPriorityConfig;
  onUpdateInstructorPriority: (value: InstructorPriorityConfig) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  sctEvents?: any[];
  onAddSctRequest: (type: 'flight' | 'ftd') => void;
  onRemoveSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onUpdateSctRequest: (id: string, field: keyof SctRequest, value: string, type: 'flight' | 'ftd') => void;
  onPatchSctRequest: (id: string, updates: Partial<SctRequest>, type: 'flight' | 'ftd') => void;
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
  taskProfiles?: string[];
  taskProfileAbbreviations?: Record<string, string>;
  operationalModel?: string;
  operationalModelLabel?: string;
  activeUnitCode?: string;
  activeUnitCodes?: string[];
  airCombatSchedulingWeights?: AirCombatSchedulingWeights;
  onUpdateAirCombatSchedulingWeights?: (weights: AirCombatSchedulingWeights) => void;
  fixedCrewTrainingPriorities?: FixedCrewTrainingStreamPriority[];
  onUpdateFixedCrewTrainingPriorities?: (priorities: FixedCrewTrainingStreamPriority[]) => void;
  isSingleSeatAircraft?: boolean;
  aircraftCrewComposition?: AircraftCrewComposition;
  aircraftTypeCode?: string | null;
  crewPositionTerminology?: CrewPositionTerminology;
  crewCompositionSettings?: CrewCompositionSettings;
  standardMissionCrewOptions?: string[];
  standardMissionProfiles?: StandardMissionProfile[];
  onSaveStandardMissionProfile?: (profileId: string, changes: Partial<StandardMissionProfile>) => void;
  unitCallsignSettings?: UnitCallsignSettings;
  formationCallsigns?: FormationCallsign[];
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  instructorLabel?: string;
  continuationShortLabel?: string;
  activeSection?: 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events';
  onNavigateToSettingsSection?: (request: {
    sectionId: string;
    unitCode?: string;
    locationCode?: string;
    resourcePoolCode?: string;
    aircraftTypeCode?: string;
    focusSubsectionId?: string;
  }) => void;
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

const TASKING_REQUEST_STORAGE_KEY = 'neoTaskingRequests';
const TASKING_REQUESTS_UPDATED_EVENT = 'neoTaskingRequestsUpdated';
const FIXED_CREW_DEFAULT_TASKING_DURATION_HOURS = 4;
const FIXED_CREW_DEFAULT_CURRENCY_DURATION_HOURS = 2;

const normaliseTaskingUnitCode = (value?: string | null): string => (
  String(value || '').trim().toUpperCase()
);

const splitTaskingCompositeUnitCode = (value?: string | null): string[] => (
  normaliseTaskingUnitCode(value)
    .split(/[+/]/)
    .map(code => code.trim())
    .filter(Boolean)
);

type TaskingResourceKind = 'Flight' | 'FTD' | 'CPT' | 'Ground';

const normaliseTaskingResourceKind = (value?: string | null): TaskingResourceKind => {
  const normalised = String(value || '').trim().toLowerCase();
  if (normalised === 'ftd' || normalised === 'sim' || normalised === 'simulator') return 'FTD';
  if (normalised === 'cpt' || normalised === 'procedural' || normalised === 'procedural trainer') return 'CPT';
  if (normalised === 'ground' || normalised === 'ground school') return 'Ground';
  return 'Flight';
};

const getTaskingResourceKindLabel = (kind?: string | null): string => {
  const normalised = normaliseTaskingResourceKind(kind);
  if (normalised === 'FTD') return 'Simulator';
  if (normalised === 'CPT') return 'Procedural Trainer';
  return normalised;
};

const getTaskingScheduleEventType = (kind?: string | null): ScheduleEvent['type'] => {
  const normalised = normaliseTaskingResourceKind(kind);
  if (normalised === 'FTD') return 'ftd';
  if (normalised === 'CPT') return 'cpt';
  if (normalised === 'Ground') return 'ground';
  return 'flight';
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

interface TaskingRequest {
  id: string;
  unitCode?: string;
  unitCodes?: string[];
  tasking: string;
  date: string;
  takeoff: number;
  duration: number;
  resourceType?: TaskingResourceKind;
  flightType: 'Solo' | 'Dual';
  depPoint: string;
  arrivalPoint: string;
  aircraftCount: number;
  isFormation?: boolean;
  aircraftConfigId: string;
  crewRequirement?: CrewRequirement;
  callsignBase?: string;
  callsignNumber?: number;
  callsign?: string;
  schedulerPriority?: 'High' | 'Medium' | 'Low';
  pushToNeoBuild?: boolean;
  isMandatory: boolean;
  saved: boolean;
  submitted: boolean;
  ignored?: boolean;
}

type TaskingSchedulerPriority = NonNullable<TaskingRequest['schedulerPriority']>;

type FixedCrewFormationAssignment = NonNullable<SctRequest['formationCrew']>[number];

type TimeOption = {
  label: string;
  value: number;
};

type TaskingAirfieldCatalogueEntry = {
  c?: string;
  i?: string;
  l?: string;
  n: string;
  m?: string;
  y?: string;
  a: number;
  o: number;
  t: string;
};

type TaskingAirfieldSearchItem = {
  entry: TaskingAirfieldCatalogueEntry;
  codeTokens: string[];
  icaoText: string;
  iataText: string;
  localText: string;
};

type TaskingAirfieldLookup = {
  searchable: TaskingAirfieldSearchItem[];
};

const TASKING_AIRFIELD_CATALOGUE_FILE = 'airfield-location-catalog.json';
const TASKING_AIRFIELD_MIN_SUGGESTIONS = 3;
const TASKING_AIRFIELD_SUGGESTION_LIMIT = 8;

const emptyTaskingAirfieldLookup: TaskingAirfieldLookup = {
  searchable: [],
};

const normaliseTaskingAirfieldToken = (value: any): string => (
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
);

const getTaskingAirfieldCatalogueUrl = (): string => {
  const baseUrl = new URL((import.meta as any)?.env?.BASE_URL || './', window.location.href);
  return new URL(TASKING_AIRFIELD_CATALOGUE_FILE, baseUrl).toString();
};

const getTaskingAirfieldPrimaryCode = (entry: TaskingAirfieldCatalogueEntry): string => (
  entry.c || entry.i || entry.l || ''
);

const getTaskingAirfieldCodeLabel = (entry: TaskingAirfieldCatalogueEntry): string => {
  const codes = [entry.c, entry.i].filter(Boolean);
  return codes.length ? codes.join(' / ') : getTaskingAirfieldPrimaryCode(entry);
};

const buildTaskingAirfieldLookup = (entries: TaskingAirfieldCatalogueEntry[]): TaskingAirfieldLookup => ({
  searchable: entries.map((entry) => {
    const icaoText = normaliseTaskingAirfieldToken(entry.c);
    const iataText = normaliseTaskingAirfieldToken(entry.i);
    const localText = normaliseTaskingAirfieldToken(entry.l);
    const codeTokens = [icaoText, iataText, localText].filter(Boolean);
    return {
      entry,
      codeTokens,
      icaoText,
      iataText,
      localText,
    };
  }),
});

const scoreTaskingAirfieldSuggestion = (
  item: TaskingAirfieldSearchItem,
  query: string,
): number => {
  if (item.icaoText === query) return 120;
  if (item.iataText === query) return 115;
  if (item.localText === query) return 105;
  if (item.icaoText.startsWith(query)) return 95;
  if (item.iataText.startsWith(query)) return 90;
  if (item.localText.startsWith(query)) return 80;
  if (item.codeTokens.some((token) => token.includes(query))) return 65;
  return 0;
};

const getTaskingAirfieldSuggestions = (
  value: any,
  lookup: TaskingAirfieldLookup,
): TaskingAirfieldCatalogueEntry[] => {
  const query = normaliseTaskingAirfieldToken(value);
  if (query.length < 2 || lookup.searchable.length === 0) return [];
  const broadQuery = query.length > 2 ? query.slice(0, 2) : query;

  const seen = new Set<string>();
  const suggestions: TaskingAirfieldCatalogueEntry[] = [];

  const addMatches = (matchQuery: string, scoreOffset = 0) => {
    lookup.searchable
      .map((item) => ({ ...item, baseScore: scoreTaskingAirfieldSuggestion(item, matchQuery) }))
      .filter((item) => item.baseScore > 0)
      .map((item) => ({ ...item, score: item.baseScore + scoreOffset }))
      .sort((left, right) => (
        right.score - left.score
        || getTaskingAirfieldPrimaryCode(left.entry).localeCompare(getTaskingAirfieldPrimaryCode(right.entry))
        || left.entry.n.localeCompare(right.entry.n)
      ))
      .forEach(({ entry }) => {
        const key = `${entry.c}|${entry.i}|${entry.l}|${entry.n}|${entry.a}|${entry.o}`;
        if (seen.has(key) || suggestions.length >= TASKING_AIRFIELD_SUGGESTION_LIMIT) return;
        seen.add(key);
        suggestions.push(entry);
      });
  };

  addMatches(query, 100);
  if (suggestions.length < TASKING_AIRFIELD_MIN_SUGGESTIONS && broadQuery !== query) {
    addMatches(broadQuery);
  }
  return suggestions.slice(0, TASKING_AIRFIELD_SUGGESTION_LIMIT);
};

const TaskingAirfieldCodeInput: React.FC<{
  value: string;
  suggestions: TaskingAirfieldCatalogueEntry[];
  onChange: (value: string) => void;
}> = ({ value, suggestions, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const showSuggestions = isOpen && suggestions.length > 0 && normaliseTaskingAirfieldToken(value).length >= 2;

  const selectSuggestion = (entry: TaskingAirfieldCatalogueEntry) => {
    const code = getTaskingAirfieldPrimaryCode(entry);
    if (code) onChange(code);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        autoComplete="off"
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onChange={event => {
          onChange(event.target.value.toUpperCase());
          setIsOpen(true);
        }}
        className="h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-sm font-semibold text-white focus:ring-sky-500"
      />
      {showSuggestions && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-[156px] overflow-y-auto rounded-md border border-cyan-500/40 bg-slate-950 shadow-xl shadow-black/40">
          {suggestions.map((entry) => (
            <button
              key={`${entry.c}|${entry.i}|${entry.l}|${entry.n}|${entry.a}|${entry.o}`}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(entry);
              }}
              className="block w-full border-b border-slate-800 px-2 py-1.5 text-left last:border-b-0 hover:bg-cyan-500/15 focus:bg-cyan-500/15 focus:outline-none"
            >
              <span className="block text-xs font-bold text-cyan-100">{getTaskingAirfieldCodeLabel(entry)}</span>
              <span className="block whitespace-normal break-words text-[10px] leading-tight text-slate-300">
                {entry.n}{entry.m && entry.m !== entry.n ? `, ${entry.m}` : ''}{entry.y ? ` (${entry.y})` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const normaliseTaskProfileSearchText = (value: any): string => (
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
);

const getTaskProfileSuggestions = (value: string, taskProfiles: string[]): string[] => {
  const query = normaliseTaskProfileSearchText(value);
  const profiles = taskProfiles.filter((profile) => String(profile || '').trim());
  const exactSeen = new Set<string>();
  const uniqueProfiles = profiles.filter((profile) => {
    const key = profile.trim().toLowerCase();
    if (exactSeen.has(key)) return false;
    exactSeen.add(key);
    return true;
  });
  if (!query) return uniqueProfiles.slice(0, 12);
  return uniqueProfiles
    .map((profile) => {
      const token = normaliseTaskProfileSearchText(profile);
      let score = 0;
      if (token === query) score = 100;
      else if (token.startsWith(query)) score = 85;
      else if (token.includes(query)) score = 60;
      return { profile, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.profile.localeCompare(right.profile))
    .slice(0, 12)
    .map((item) => item.profile);
};

const TaskingProfileInput: React.FC<{
  value: string;
  taskProfiles: string[];
  operationalModelLabel: string;
  onOpenDirectedTaskLists?: () => void;
  onChange: (value: string) => void;
}> = ({ value, taskProfiles, operationalModelLabel, onOpenDirectedTaskLists, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const suggestions = getTaskProfileSuggestions(value, taskProfiles);
  const configuredProfileCount = taskProfiles.filter((profile) => String(profile || '').trim()).length;
  const showSuggestions = isOpen;
  const settingsPathText = 'Settings → Organisation & Operations → Directed Task Lists';
  const settingsLinkClass = 'inline-flex rounded border border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0.5 font-semibold text-slate-300 underline decoration-cyan-500/25 underline-offset-2 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/60';
  const settingsPathLink = onOpenDirectedTaskLists ? (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        onOpenDirectedTaskLists();
      }}
      className={settingsLinkClass}
    >
      {settingsPathText}
    </button>
  ) : (
    <span>{settingsPathText}</span>
  );

  const selectProfile = (profile: string) => {
    onChange(profile);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div>
        <input
          type="text"
          value={value}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          placeholder="Directed task"
          className="h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-sm font-semibold text-white focus:ring-sky-500"
        />
        <div className="mt-1 text-[10px] leading-snug text-slate-400">
          Saved directed task names are managed here: {settingsPathLink}.
        </div>
      </div>
      {showSuggestions && (
        <div className="absolute left-0 top-full z-[80] mt-1 max-h-64 w-[280px] overflow-y-auto rounded-md border border-cyan-500/40 bg-slate-950 shadow-xl shadow-black/40">
          {suggestions.length > 0 ? (
            suggestions.map((profile) => (
              <button
                key={profile}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectProfile(profile);
                }}
                className="block w-full border-b border-slate-800 px-2 py-1.5 text-left last:border-b-0 hover:bg-cyan-500/15 focus:bg-cyan-500/15 focus:outline-none"
              >
                <span className="block text-xs font-bold text-cyan-100">{profile}</span>
                <span className="block whitespace-normal break-words text-[10px] leading-tight text-slate-300">
                  {operationalModelLabel} directed task
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-left">
              <span className="block text-xs font-bold text-cyan-100">
                {configuredProfileCount > 0 ? 'No matching directed task' : 'No directed task names configured'}
              </span>
              <span className="block whitespace-normal break-words text-[10px] leading-tight text-slate-300">
                {configuredProfileCount > 0
                  ? <>Keep typing to enter this task manually, or open {settingsPathLink} to add it to the saved list.</>
                  : <>{operationalModelLabel} has no saved directed task names yet. Open {settingsPathLink} to add saved names, or type this one manually.</>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface TaskingRequestTableProps {
  taskingRequests: TaskingRequest[];
  timeOptions: TimeOption[];
  aircraftConfigOptions: AircraftConfigurationDefinition[];
  airfieldLookup: TaskingAirfieldLookup;
  taskProfiles: string[];
  operationalModel: string;
  operationalModelLabel: string;
  isSingleSeatAircraft: boolean;
  aircraftCrewComposition?: AircraftCrewComposition;
  crewRequirementPresets?: CrewRequirementPreset[];
  crewPositionTerminology?: CrewPositionTerminology;
  unitCallsignEntries: UnitCallsignEntry[];
  formationCallsignEntries: UnitCallsignEntry[];
  callsignNumberOptions: Array<{ value: number; label: string }>;
  onUpdateTaskingRequest: (id: string, updates: Partial<TaskingRequest>) => void;
  onRemoveTaskingRequest: (id: string) => void;
  onSetTaskingSchedulerPriority: (id: string, priority: TaskingSchedulerPriority) => void;
  onNavigateToSettingsSection?: (request: {
    sectionId: string;
    unitCode?: string;
    locationCode?: string;
    resourcePoolCode?: string;
    aircraftTypeCode?: string;
    focusSubsectionId?: string;
  }) => void;
}

const taskingPanelClass = 'flex min-h-[8rem] min-w-0 flex-col justify-between rounded-lg border border-slate-700/80 bg-slate-950/55 p-3 shadow-inner shadow-black/20';
const taskingPanelLabelClass = 'text-[10px] font-black uppercase tracking-[0.18em] text-slate-500';
const taskingPanelHintClass = 'mt-2 min-h-[2rem] text-[11px] leading-snug text-slate-500';
const taskingControlClass = 'h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-sm font-semibold text-white focus:ring-sky-500';
const taskingSummaryHeaderClass = 'grid min-w-[1193px] grid-cols-[111px_90px_86px_76px_88px_95px_112px_74px_85px_90px_86px_90px_66px_60px] gap-0 bg-slate-900 px-0 text-[12px] font-black uppercase tracking-[0.12em] text-slate-400';
const taskingSummaryRowClass = 'grid min-w-[1193px] grid-cols-[111px_90px_86px_76px_88px_95px_112px_74px_85px_90px_86px_90px_66px_60px] gap-0 text-[12px]';
const taskingSummaryCellClass = 'border border-slate-700/70 px-2 py-2';
const taskingSummaryHeaderCellClass = `${taskingSummaryCellClass} text-center`;
const buildPriorityTableShellClass = 'overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/45';
const buildPriorityTableHeaderClass = 'grid gap-0 bg-slate-900 px-0 text-[12px] font-black uppercase tracking-[0.12em] text-slate-400';
const buildPriorityTableRowClass = 'grid gap-0 text-[12px]';
const buildPriorityTableCellClass = 'border border-slate-700/70 px-2 py-2';
const buildPriorityTableHeaderCellClass = `${buildPriorityTableCellClass} text-center`;
const formatTaskingSummaryDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Any';
  const parsedDate = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return 'Any';
  const day = String(parsedDate.getUTCDate()).padStart(2, '0');
  const month = parsedDate.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = String(parsedDate.getUTCFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
};

const TaskingFieldPanel: React.FC<{
  label: string;
  hint?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}> = ({ label, hint, className = '', contentClassName = '', children }) => (
  <div className={`${taskingPanelClass} ${className}`}>
    <div>
      <div className={taskingPanelLabelClass}>{label}</div>
      <div className={`mt-3 ${contentClassName}`}>{children}</div>
    </div>
    {hint ? <div className={taskingPanelHintClass}>{hint}</div> : <div className={taskingPanelHintClass} aria-hidden="true">&nbsp;</div>}
  </div>
);

const TaskingRequestTable: React.FC<TaskingRequestTableProps> = ({
  taskingRequests,
  timeOptions,
  aircraftConfigOptions,
  airfieldLookup,
  taskProfiles,
  operationalModel,
  operationalModelLabel,
  isSingleSeatAircraft,
  aircraftCrewComposition,
  crewRequirementPresets,
  crewPositionTerminology,
  unitCallsignEntries,
  formationCallsignEntries,
  callsignNumberOptions,
  onUpdateTaskingRequest,
  onRemoveTaskingRequest,
  onSetTaskingSchedulerPriority,
  onNavigateToSettingsSection,
}) => {
  const [expandedTaskingIds, setExpandedTaskingIds] = useState<Set<string>>(new Set());
  const directedTaskSettingsFocusId = `platform-directed-task-list-${operationalModel || 'flight_school'}`;
  const openDirectedTaskSettings = () => {
    onNavigateToSettingsSection?.({
      sectionId: 'platform-task-profiles',
      focusSubsectionId: directedTaskSettingsFocusId,
    });
  };
  const renderDirectedTaskSettingsLink = () => (
    <button
      type="button"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openDirectedTaskSettings();
      }}
      className="font-semibold text-slate-300 underline decoration-cyan-500/35 underline-offset-2 transition hover:text-cyan-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
    >
      Settings → Organisation & Operations → Directed Task Lists
    </button>
  );
  const toggleTaskingExpanded = (id: string) => {
    setExpandedTaskingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const confirmRemoveTaskingRequest = async (request: TaskingRequest) => {
    const label = request.tasking.trim() || 'this directed task';
    const confirmed = await showDarkConfirm(`Delete ${label} from Directed Tasks? This cannot be undone.`, 'Delete Directed Task', 'warning');
    if (!confirmed) return;
    onRemoveTaskingRequest(request.id);
  };
  const canScheduleTaskingRequest = (request: TaskingRequest) => (
    Boolean(request.tasking.trim() && request.date && request.depPoint.trim() && request.arrivalPoint.trim())
  );
  const setAllTaskingSchedule = (scheduled: boolean) => {
    taskingRequests.forEach(request => {
      if (scheduled) {
        if (!canScheduleTaskingRequest(request)) return;
        const schedulerPriority = request.schedulerPriority || (request.isMandatory !== false ? 'High' : 'Medium');
        onSetTaskingSchedulerPriority(request.id, schedulerPriority);
        return;
      }
      onUpdateTaskingRequest(request.id, { saved: true, submitted: false, ignored: true });
    });
  };

  return (
  <div className="space-y-3 pb-24">
    {taskingRequests.length === 0 && (
      <div className="rounded-lg border border-slate-700 bg-slate-950/45 px-4 py-5 text-sm italic text-gray-500">
        No directed task requests configured.
      </div>
    )}
    {taskingRequests.length > 0 && (
      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/45">
        <div className="min-w-[1193px] space-y-3">
          <div className={taskingSummaryHeaderClass}>
            <span className={`${taskingSummaryHeaderCellClass} flex flex-col items-center justify-center gap-2`}>
              <span>Schedule</span>
              <span className="inline-flex overflow-hidden rounded-md border border-slate-600 bg-slate-950 text-[10px] font-black normal-case tracking-normal">
                <button type="button" onClick={() => setAllTaskingSchedule(true)} className="px-1.5 py-0.5 text-cyan-100 hover:bg-cyan-500/15">All</button>
                <button type="button" onClick={() => setAllTaskingSchedule(false)} className="border-l border-slate-600 px-1.5 py-0.5 text-slate-200 hover:bg-slate-700/60">None</button>
              </span>
            </span>
            <span className={taskingSummaryHeaderCellClass}>Type</span>
            <span className={taskingSummaryHeaderCellClass}>Kind</span>
            <span className={taskingSummaryHeaderCellClass}>Solo/Dual</span>
            <span className={taskingSummaryHeaderCellClass}>Date</span>
            <span className={taskingSummaryHeaderCellClass}>Event</span>
            <span className={taskingSummaryHeaderCellClass}>Route</span>
            <span className={taskingSummaryHeaderCellClass}>Time</span>
            <span className={taskingSummaryHeaderCellClass}>Aircraft</span>
            <span className={taskingSummaryHeaderCellClass}>CONFIG</span>
            <span className={taskingSummaryHeaderCellClass}>Priority</span>
            <span className={taskingSummaryHeaderCellClass}>Status</span>
            <span className={taskingSummaryHeaderCellClass}>Edit</span>
            <span className={taskingSummaryHeaderCellClass} aria-label="Delete"></span>
          </div>
    {taskingRequests.map(request => {
      const canSubmit = canScheduleTaskingRequest(request);
      const depPointSuggestions = getTaskingAirfieldSuggestions(request.depPoint, airfieldLookup);
      const arrivalPointSuggestions = getTaskingAirfieldSuggestions(request.arrivalPoint, airfieldLookup);
      const selectedConfig = aircraftConfigOptions.find(definition => definition.id === request.aircraftConfigId);
      const callsignEntriesForRequest = request.isFormation === true && formationCallsignEntries.length > 0
        ? formationCallsignEntries
        : unitCallsignEntries;
      const showCallsignUnitLabels = new Set(callsignEntriesForRequest.map(entry => entry.unitCode)).size > 1;
      const schedulerPriority = request.schedulerPriority || (request.isMandatory !== false ? 'High' : 'Medium');
      const resourceKind = normaliseTaskingResourceKind(request.resourceType);
      const resourceKindLabel = getTaskingResourceKindLabel(resourceKind);
      const isExpanded = expandedTaskingIds.has(request.id);
      const taskingHeaderTitle = request.tasking.trim() || 'New directed task request';
      const taskingHeaderDate = request.date || '';
      const taskingHeaderTime = timeOptions.find(opt => opt.value === request.takeoff)?.label || '';
      const taskingStatus = request.ignored ? 'Ignored' : request.submitted ? 'Scheduled' : request.saved ? 'Saved' : 'Draft';
      const directedTaskHint = taskProfiles.some(profile => String(profile || '').trim())
        ? <>Names come from {renderDirectedTaskSettingsLink()}; you can also type a task.</>
        : <>Add names in {renderDirectedTaskSettingsLink()}, or type a task.</>;
      return (
        <div key={request.id} className="overflow-hidden rounded-xl border border-cyan-500/25 bg-slate-900/45 shadow-lg shadow-black/10">
          <div className="bg-cyan-950/80 transition hover:bg-cyan-900/80">
            <div className={taskingSummaryRowClass}>
              <div className={`${taskingSummaryCellClass} flex items-center justify-center`}>
                <div className="inline-flex items-center justify-center gap-1 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[12px] font-semibold text-slate-100">
                  <label className={`inline-flex items-center gap-1 text-[12px] leading-none ${canSubmit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="radio"
                      name={`build-task-schedule-${request.id}`}
                      checked={request.submitted && !request.ignored}
                      disabled={!canSubmit}
                      onChange={() => onSetTaskingSchedulerPriority(request.id, schedulerPriority)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    Y
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] leading-none">
                    <input
                      type="radio"
                      name={`build-task-schedule-${request.id}`}
                      checked={request.ignored || !request.submitted}
                      onChange={() => onUpdateTaskingRequest(request.id, { saved: true, submitted: false, ignored: true })}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    N
                  </label>
                </div>
              </div>
              <div className={`${taskingSummaryCellClass} font-semibold text-cyan-100`}>Directed Task</div>
              <div className={`${taskingSummaryCellClass} truncate text-slate-100`} title={resourceKindLabel}>{resourceKindLabel}</div>
              <div className={`${taskingSummaryCellClass} text-slate-100`}>{request.flightType}</div>
              <div className={`${taskingSummaryCellClass} font-mono text-slate-100`}>{formatTaskingSummaryDate(taskingHeaderDate || undefined)}</div>
              <div className={`${taskingSummaryCellClass} truncate font-semibold text-slate-100`} title={taskingHeaderTitle}>{taskingHeaderTitle}</div>
              <div className={`${taskingSummaryCellClass} truncate text-slate-100`} title={`${request.depPoint}-${request.arrivalPoint}`}>{request.depPoint || '-'}-{request.arrivalPoint || '-'}</div>
              <div className={`${taskingSummaryCellClass} font-mono text-slate-100`}>{taskingHeaderTime.replace(':', '') || '-'}</div>
              <div className={`${taskingSummaryCellClass} font-mono text-slate-100`}>{request.aircraftCount || 1}</div>
              <div className={`${taskingSummaryCellClass} truncate text-slate-100`} title={selectedConfig?.label || request.aircraftConfigId}>{selectedConfig?.label || request.aircraftConfigId || '-'}</div>
              <div className={`${taskingSummaryCellClass} font-semibold ${schedulerPriority === 'High' ? 'text-red-300' : schedulerPriority === 'Medium' ? 'text-amber-300' : 'text-green-300'}`}>{schedulerPriority}</div>
              <div className={`${taskingSummaryCellClass} text-slate-100`}>{taskingStatus}</div>
              <div className={`${taskingSummaryCellClass} flex items-center justify-center px-1`}>
                <button
                  type="button"
                  onClick={() => toggleTaskingExpanded(request.id)}
                  className="w-[48px] rounded border border-cyan-400/50 px-2 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/10"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className={`${taskingSummaryCellClass} flex items-center justify-center px-1`}>
                <button
                  type="button"
                  aria-label="Delete directed task"
                  title="Delete directed task"
                  onClick={(event) => {
                    event.stopPropagation();
                    void confirmRemoveTaskingRequest(request);
                  }}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center transition-opacity hover:opacity-75 focus:outline-none focus:ring-1 focus:ring-red-500/60"
                >
                  <TrashIcon aria-hidden="true" className="h-4 w-4" style={{ color: '#dc2626', stroke: '#dc2626' }} />
                </button>
              </div>
            </div>
          </div>

          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(13rem,1.5fr)_minmax(8rem,0.78fr)_minmax(10rem,1fr)_minmax(6.5rem,0.62fr)_minmax(6.5rem,0.62fr)]">
            <TaskingFieldPanel label="Directed Task" hint={directedTaskHint}>
              <TaskingProfileInput
                value={request.tasking}
                taskProfiles={taskProfiles}
                operationalModelLabel={operationalModelLabel}
                onOpenDirectedTaskLists={openDirectedTaskSettings}
                onChange={(tasking) => onUpdateTaskingRequest(request.id, { tasking, submitted: false, saved: false })}
              />
            </TaskingFieldPanel>
            <TaskingFieldPanel label="Kind" hint={resourceKindLabel}>
              <select
                value={resourceKind}
                onChange={event => onUpdateTaskingRequest(request.id, { resourceType: normaliseTaskingResourceKind(event.target.value), submitted: false, saved: false })}
                className={taskingControlClass}
              >
                <option value="Flight">Flight</option>
                <option value="FTD">Simulator</option>
                <option value="CPT">Procedural Trainer</option>
                <option value="Ground">Ground</option>
              </select>
            </TaskingFieldPanel>
            <TaskingFieldPanel label="Date" hint={request.date || 'Required'}>
              <input
                type="date"
                value={request.date}
                onChange={event => onUpdateTaskingRequest(request.id, { date: event.target.value, submitted: false, saved: false })}
                style={{ colorScheme: 'dark' }}
                className={taskingControlClass}
              />
            </TaskingFieldPanel>
            <TaskingFieldPanel label="Takeoff" hint={timeOptions.find(opt => opt.value === request.takeoff)?.label || 'Time'}>
              <select
                value={request.takeoff}
                onChange={event => onUpdateTaskingRequest(request.id, { takeoff: parseFloat(event.target.value), submitted: false, saved: false })}
                className={taskingControlClass}
              >
                {timeOptions.map(opt => <option key={`tasking-takeoff-${opt.value}`} value={opt.value}>{opt.label}</option>)}
              </select>
            </TaskingFieldPanel>
            <TaskingFieldPanel label="Duration" hint={`${request.duration || 0} hr`}>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={request.duration}
                onChange={event => onUpdateTaskingRequest(request.id, { duration: Math.max(0.1, parseFloat(event.target.value) || 0.1), submitted: false, saved: false })}
                className={taskingControlClass}
              />
            </TaskingFieldPanel>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1.25fr)_minmax(0,0.46fr)_minmax(0,0.62fr)_minmax(0,0.74fr)]">
            <TaskingFieldPanel label="Route" hint={`${request.depPoint || 'Departure'} -> ${request.arrivalPoint || 'Arrival'}`}>
              <div className="grid gap-1.5 [&_input]:h-7 [&_input]:px-2 [&_input]:text-[11px]">
                <div className="min-w-0">
                  <div className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">Dep</div>
                  <TaskingAirfieldCodeInput
                    value={request.depPoint}
                    suggestions={depPointSuggestions}
                    onChange={(depPoint) => onUpdateTaskingRequest(request.id, { depPoint, submitted: false, saved: false })}
                  />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">Arr</div>
                  <TaskingAirfieldCodeInput
                    value={request.arrivalPoint}
                    suggestions={arrivalPointSuggestions}
                    onChange={(arrivalPoint) => onUpdateTaskingRequest(request.id, { arrivalPoint, submitted: false, saved: false })}
                  />
                </div>
              </div>
            </TaskingFieldPanel>
            <TaskingFieldPanel label="Callsign" hint={request.callsign || 'Unit callsign'}>
              {callsignEntriesForRequest.length > 0 ? (
                <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-2">
                  <select
                    value={request.callsignBase || callsignEntriesForRequest[0]?.callsign || ''}
                    onChange={(event) => {
                      const callsignBase = event.target.value;
                      const callsignNumber = Number.isFinite(Number(request.callsignNumber)) ? Number(request.callsignNumber) : 0;
                      onUpdateTaskingRequest(request.id, {
                        callsignBase,
                        callsignNumber,
                        callsign: buildUnitEventCallsign(callsignBase, callsignNumber),
                        submitted: false,
                        saved: false,
                      });
                    }}
                    className={taskingControlClass}
                  >
                    {callsignEntriesForRequest.map(entry => (
                      <option key={entry.id} value={entry.callsign}>{showCallsignUnitLabels ? `${entry.callsign} (${entry.unitCode})` : entry.callsign}</option>
                    ))}
                  </select>
                  <select
                    value={Number.isFinite(Number(request.callsignNumber)) ? Number(request.callsignNumber) : 0}
                    onChange={(event) => {
                      const callsignNumber = Number(event.target.value);
                      const callsignBase = request.callsignBase || callsignEntriesForRequest[0]?.callsign || '';
                      onUpdateTaskingRequest(request.id, {
                        callsignBase,
                        callsignNumber,
                        callsign: buildUnitEventCallsign(callsignBase, callsignNumber),
                        submitted: false,
                        saved: false,
                      });
                    }}
                    className={taskingControlClass}
                  >
                    {callsignNumberOptions.map(option => (
                      <option key={`tasking-callsign-number-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100">
                  Configure unit callsigns in Settings.
                </div>
              )}
            </TaskingFieldPanel>
            <TaskingFieldPanel
              label="Aircraft"
              hint={request.isFormation && request.aircraftCount > 1 ? `${request.aircraftCount} aircraft formation` : `${request.aircraftCount || 1} required`}
              className="[&>div:first-child]:flex [&>div:first-child]:flex-1 [&>div:first-child]:flex-col"
              contentClassName="flex flex-1 items-center"
            >
              <input
                type="number"
                min={1}
                value={request.aircraftCount}
                onChange={event => {
                  const aircraftCount = Math.max(1, parseInt(event.target.value, 10) || 1);
                  onUpdateTaskingRequest(request.id, {
                    aircraftCount,
                    isFormation: aircraftCount > 1 ? request.isFormation : false,
                    submitted: false,
                    saved: false,
                  });
                }}
                className={taskingControlClass}
              />
            </TaskingFieldPanel>
            <TaskingFieldPanel
              label="Formation"
              hint={request.isFormation && request.aircraftCount > 1 ? 'One priority row' : 'Separate aircraft rows'}
              className="[&>div:first-child]:flex [&>div:first-child]:flex-1 [&>div:first-child]:flex-col"
              contentClassName="flex flex-1 items-center"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={request.isFormation === true}
                onClick={() => {
                  const checked = request.isFormation !== true;
                  const nextCallsignBase = checked && formationCallsignEntries.length > 0
                    ? formationCallsignEntries[0].callsign
                    : request.callsignBase;
                  onUpdateTaskingRequest(request.id, {
                    isFormation: checked,
                    aircraftCount: checked ? Math.max(2, Math.floor(Number(request.aircraftCount) || 1)) : request.aircraftCount,
                    callsignBase: nextCallsignBase,
                    callsign: nextCallsignBase ? buildUnitEventCallsign(nextCallsignBase, request.callsignNumber || 0) : request.callsign,
                    submitted: false,
                    saved: false,
                  });
                }}
                className={`flex h-10 w-full items-center justify-center rounded-md border px-3 text-sm font-black transition ${
                  request.isFormation === true
                    ? 'border-cyan-300 bg-cyan-500/25 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]'
                    : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-cyan-400/60'
                }`}
              >
                {request.isFormation === true ? 'ON' : 'OFF'}
              </button>
            </TaskingFieldPanel>
            <TaskingFieldPanel
              label="Config"
              hint={selectedConfig?.definition || selectedConfig?.label || 'Aircraft fit'}
              className="[&>div:first-child]:flex [&>div:first-child]:flex-1 [&>div:first-child]:flex-col"
              contentClassName="flex flex-1 items-center"
            >
              <div className="[&_select]:h-10 [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border-slate-600 [&_select]:bg-slate-800 [&_select]:text-sm [&_select]:font-semibold">
                <AircraftConfigSelect
                  value={request.aircraftConfigId}
                  definitions={aircraftConfigOptions}
                  onChange={(aircraftConfigId) => onUpdateTaskingRequest(request.id, { aircraftConfigId, submitted: false, saved: false })}
                />
              </div>
            </TaskingFieldPanel>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="min-w-0 h-full [&>div]:h-full [&>div]:min-h-[8rem]">
              <CrewRequirementEditor
                value={request.crewRequirement}
                aircraftCrewComposition={aircraftCrewComposition}
                crewRequirementPresets={crewRequirementPresets}
                crewPositionTerminology={crewPositionTerminology}
                operationalModel={operationalModel}
                compact
                onChange={(crewRequirement) => onUpdateTaskingRequest(request.id, { crewRequirement, submitted: false, saved: false })}
              />
            </div>
            <TaskingFieldPanel
              label="Actions"
              hint={request.submitted && !request.ignored ? `${schedulerPriority} scheduler priority` : 'Select scheduler priority'}
            >
              <div className="grid gap-2">
                {(['High', 'Medium', 'Low'] as const).map(priority => {
                  const selected = schedulerPriority === priority && request.submitted && !request.ignored;
                  return (
                    <button
                      key={`${request.id}-${priority}`}
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => onSetTaskingSchedulerPriority(request.id, priority)}
                      className={`h-8 rounded-md border px-2 text-xs font-bold transition ${
                        selected
                          ? priority === 'High'
                            ? 'border-red-300/70 bg-red-500/25 text-red-100'
                            : priority === 'Medium'
                              ? 'border-amber-300/70 bg-amber-500/25 text-amber-100'
                              : 'border-green-300/70 bg-green-500/25 text-green-100'
                          : canSubmit
                            ? 'border-slate-600 bg-slate-800 text-slate-200 hover:border-cyan-300/70 hover:bg-cyan-500/10'
                            : 'cursor-not-allowed border-slate-700 bg-slate-800/60 text-slate-500'
                      }`}
                    >
                      {priority}
                    </button>
                  );
                })}
                <button
                  onClick={() => onRemoveTaskingRequest(request.id)}
                  aria-label="Delete directed task"
                  title="Delete directed task"
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 text-xs font-semibold text-red-200 hover:border-red-400/60 hover:bg-red-500/20"
                >
                  <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </TaskingFieldPanel>
          </div>
              </div>
            </div>
          </div>
        </div>
      );
    })}
        </div>
      </div>
    )}
  </div>
  );
};

// FIX: Export component as a named const to fix module import error.
export const PrioritiesView: React.FC<PrioritiesViewProps> = ({ 
  school = '',
  coursePriorities, 
  onUpdatePriorities, 
  coursePercentages, 
  onUpdatePercentages,
  availableAircraftCount,
  onUpdateAircraftCount,
  maxAircraftCount,
  aircraftConfigurationDefinitions = [],
  aircraftConfigCapacities = {},
  onUpdateAircraftConfigCapacities = () => {},
  availableFtdCount,
  onUpdateFtdCount,
  maxFtdCount,
  availableCptCount,
  onUpdateCptCount,
  maxCptCount,
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
  scheduledBuildEvents = [],
  publishedScheduleEvents,
  onSelectEvent,
  onAddPriorityEvents,
  onUpdatePriorityEvent,
  onDeletePriorityEvent,
  instructorPriority,
  onUpdateInstructorPriority,
  sctFlights,
  sctFtds,
  sctEvents: continuationEvents = [],
  onAddSctRequest,
  onRemoveSctRequest,
  onUpdateSctRequest,
  onPatchSctRequest,
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
  taskProfiles = [],
  taskProfileAbbreviations = {},
  operationalModel = 'flight_school',
  operationalModelLabel = 'Flight School Model',
  activeUnitCode,
  activeUnitCodes = [],
  airCombatSchedulingWeights,
  onUpdateAirCombatSchedulingWeights,
  fixedCrewTrainingPriorities = [],
  onUpdateFixedCrewTrainingPriorities,
  isSingleSeatAircraft = false,
  aircraftCrewComposition,
  aircraftTypeCode,
  crewPositionTerminology,
  crewCompositionSettings,
  standardMissionCrewOptions = [],
  standardMissionProfiles = [],
  onSaveStandardMissionProfile,
  unitCallsignSettings,
  formationCallsigns = [],
  staffQualificationCatalogue,
  instructorLabel = 'Instructor',
  continuationShortLabel = 'ContT',
  onNavigateToSettingsSection,
}) => {
  const aircraftLabel = resourceDisplayNames.aircraft;
  const ftdLabel = resourceDisplayNames.ftd;
  const cptLabel = resourceDisplayNames.cpt;
  const continuationCurrencyRequestsLabel = `${continuationShortLabel} / Currency Requests`;
  const aircraftCapacityMax = Math.max(0, Math.floor(Number(maxAircraftCount ?? availableAircraftCount) || 0));
  const ftdCapacityMax = Math.max(0, Math.floor(Number(maxFtdCount ?? availableFtdCount) || 0));
  const cptCapacityMax = Math.max(0, Math.floor(Number(maxCptCount ?? availableCptCount) || 0));
  const locationDisplayName = String(school || '').trim() || 'Selected location';
  const normalisedStaffQualificationCatalogue = useMemo(
    () => normaliseStaffQualificationCatalogue(staffQualificationCatalogue || null),
    [staffQualificationCatalogue],
  );
  const fixedCrewPicQualification = useMemo(() => getQualificationsForOperationalModel(normalisedStaffQualificationCatalogue, 'fixed_crew')
    .find(qualification => (
      normaliseQualificationToken(qualification.id) === 'pic'
      || normaliseQualificationToken(qualification.code) === 'pic'
      || normaliseQualificationToken(qualification.name) === 'pic'
    )), [normalisedStaffQualificationCatalogue]);
  const aircraftConfigOptions = useMemo(() => {
    const definitions = aircraftConfigurationDefinitions.length > 0
      ? aircraftConfigurationDefinitions
      : [BASE_AIRCRAFT_CONFIG];
    return definitions.some(definition => definition.id === BASE_AIRCRAFT_CONFIG.id)
      ? definitions
      : [BASE_AIRCRAFT_CONFIG, ...definitions];
  }, [aircraftConfigurationDefinitions]);

  const [courseTimestamp, setCourseTimestamp] = useState(new Date().toLocaleString());

  const instructorNames = useMemo(() => instructorsData.map(i => i.name).sort(), [instructorsData]);


  // State for Build Factors
  const [aircraftTimestamp, setAircraftTimestamp] = useState(new Date().toLocaleString());
  const [flyingWindowTimestamp, setFlyingWindowTimestamp] = useState(new Date().toLocaleString());
  const [dutyPeriodTimestamp, setDutyPeriodTimestamp] = useState(new Date().toLocaleString());
  const [turnaroundTimestamp, setTurnaroundTimestamp] = useState(new Date().toLocaleString());
  const isAirCombatModel = String(operationalModel || '').trim().toLowerCase() === 'air_combat';
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);
  const defaultTaskingDuration = isFixedCrewModel ? FIXED_CREW_DEFAULT_TASKING_DURATION_HOURS : 1;
  const defaultCurrencyDuration = isFixedCrewModel ? FIXED_CREW_DEFAULT_CURRENCY_DURATION_HOURS : 1.2;
  const [openStandardMissionIds, setOpenStandardMissionIds] = useState<Set<string>>(new Set());
  const [editingStandardMissionId, setEditingStandardMissionId] = useState<string | null>(null);
  const [pendingStandardMissionSaveId, setPendingStandardMissionSaveId] = useState<string | null>(null);
  const [standardMissionDrafts, setStandardMissionDrafts] = useState<Record<string, Partial<StandardMissionProfile>>>({});
  const [temporaryStandardMissionOverrides, setTemporaryStandardMissionOverrides] = useState<Record<string, Partial<StandardMissionProfile>>>({});
  const [editingSctRequestIds, setEditingSctRequestIds] = useState<Set<string>>(new Set());
  const [editingPriorityEventId, setEditingPriorityEventId] = useState<string | null>(null);
  const [priorityPushDrafts, setPriorityPushDrafts] = useState<Record<string, boolean>>({});
  const priorityAllocationModel: PriorityAllocationModel = isAirCombatModel ? 'air_combat' : isFixedCrewModel ? 'fixed_crew' : 'flight_school';
  const normalisedAirCombatWeights = useMemo(
    () => normaliseAirCombatSchedulingWeights(airCombatSchedulingWeights),
    [airCombatSchedulingWeights],
  );
  const activeUnitCodeSet = useMemo(() => {
    const codes = activeUnitCodes.length > 0 ? activeUnitCodes : String(activeUnitCode || '').split('+');
    return new Set(codes.map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  }, [activeUnitCode, activeUnitCodes]);
  const activeTaskingUnitCodes = useMemo(() => (
    Array.from(activeUnitCodeSet)
  ), [activeUnitCodeSet]);
  const activeTaskingUnitCode = activeTaskingUnitCodes.join('+') || normaliseTaskingUnitCode(activeUnitCode);
  const getTaskingRequestScopeCodes = (request: Partial<TaskingRequest> | any): string[] => {
    const explicitCodes = Array.isArray(request?.unitCodes)
      ? request.unitCodes.map(normaliseTaskingUnitCode).filter(Boolean)
      : [];
    const unitCode = normaliseTaskingUnitCode(request?.unitCode);
    if (unitCode) explicitCodes.push(...splitTaskingCompositeUnitCode(unitCode));
    const uniqueCodes = Array.from(new Set(explicitCodes.filter(Boolean)));
    return uniqueCodes.length > 0 ? uniqueCodes : activeTaskingUnitCodes;
  };
  const taskingRequestMatchesActiveScope = (request: Partial<TaskingRequest> | any): boolean => {
    const scopeCodes = getTaskingRequestScopeCodes(request);
    if (activeTaskingUnitCodes.length === 0) return true;
    return scopeCodes.some(code => activeTaskingUnitCodes.includes(code));
  };
  const crewRequirementPresets = useMemo<CrewRequirementPreset[]>(() => {
    const settings = normaliseCrewCompositionSettings(crewCompositionSettings || null);
    const contextCodes = Array.from(activeUnitCodeSet);
    const activeAircraftTypeCode = String(aircraftTypeCode || '').trim().toUpperCase();
    const activeGroupLabels = contextCodes.length > 0
      ? contextCodes
      : [normaliseTaskingUnitCode(activeUnitCode) || normaliseTaskingUnitCode(school) || 'Unit'];
    const compositeCodes = new Set<string>([
      normaliseTaskingUnitCode(activeUnitCode),
      contextCodes.join('+'),
      contextCodes.join('/'),
    ].filter(Boolean));
    const appliesToActiveContext = (unitCode?: string, compositeUnitCode?: string): boolean => {
      const profileUnitCode = normaliseTaskingUnitCode(unitCode);
      if (profileUnitCode && contextCodes.length > 0) return contextCodes.includes(profileUnitCode);
      const profileCompositeCode = normaliseTaskingUnitCode(compositeUnitCode);
      if (!profileCompositeCode) return !profileUnitCode;
      if (compositeCodes.has(profileCompositeCode)) return true;
      const profileCompositeParts = splitTaskingCompositeUnitCode(profileCompositeCode);
      return profileCompositeParts.length > 0 && profileCompositeParts.every(code => contextCodes.includes(code));
    };
    const profileModel = String(operationalModel || '').trim().toLowerCase();
    const applicableAlternateProfiles = settings.alternateCompositions
      .filter(profile => profile.status !== 'INACTIVE')
      .filter(profile => !profile.aircraftTypeCode || !activeAircraftTypeCode || profile.aircraftTypeCode === activeAircraftTypeCode)
      .filter(profile => !profile.operationalModels.length || profile.operationalModels.includes(profileModel as any))
      .filter(profile => appliesToActiveContext(profile.unitCode, profile.compositeUnitCode));
    const labelCounts = applicableAlternateProfiles.reduce((counts, profile) => {
      const label = `${profile.code} - ${profile.name}`;
      counts.set(label, (counts.get(label) || 0) + 1);
      return counts;
    }, new Map<string, number>());
    const alternatePresets = applicableAlternateProfiles
      .map((profile): CrewRequirementPreset => ({
        id: `alternate:${profile.id}`,
        label: (() => {
          const baseLabel = `${profile.code} - ${profile.name}`;
          if ((labelCounts.get(baseLabel) || 0) <= 1) return baseLabel;
          const sourceUnit = normaliseTaskingUnitCode(profile.unitCode) || normaliseTaskingUnitCode(profile.compositeUnitCode);
          return sourceUnit ? `${baseLabel} - ${sourceUnit}` : baseLabel;
        })(),
        description: profile.description,
        kind: 'alternate',
        groupLabel: normaliseTaskingUnitCode(profile.unitCode)
          || normaliseTaskingUnitCode(profile.compositeUnitCode)
          || activeGroupLabels[0]
          || 'Unit',
        roles: profile.roleRequirements.map(role => ({
          role: role.role,
          count: role.count,
          eligibleRoles: [role.role],
        })),
      }));

    const standardPresets = activeAircraftTypeCode
      ? activeGroupLabels.map((unitCode, index): CrewRequirementPreset => ({
        id: index === 0 ? 'standard-aircraft-crew' : `standard-aircraft-crew:${unitCode}`,
        label: `Standard ${activeAircraftTypeCode} Crew`,
        description: formatCrewRequirementSummary(null, aircraftCrewComposition, crewPositionTerminology),
        kind: 'standard',
        groupLabel: unitCode,
      }))
      : [];

    return [
      ...standardPresets,
      ...alternatePresets,
    ];
  }, [activeUnitCode, activeUnitCodeSet, aircraftCrewComposition, aircraftTypeCode, crewCompositionSettings, crewPositionTerminology, operationalModel, school]);

  useEffect(() => {
    setTemporaryStandardMissionOverrides({});
    setPendingStandardMissionSaveId(null);
  }, [buildDfpDate]);

  const displayedStandardMissionProfiles = useMemo(() => (
    standardMissionProfiles
      .filter(profile => String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
      .map(profile => ({ ...profile, ...(temporaryStandardMissionOverrides[profile.id] || {}) }))
      .sort((left, right) => (
        String(left.unitCode || '').localeCompare(String(right.unitCode || ''))
        || String(left.aircraftTypeCode || '').localeCompare(String(right.aircraftTypeCode || ''))
        || String(left.missionName || '').localeCompare(String(right.missionName || ''))
      ))
  ), [standardMissionProfiles, temporaryStandardMissionOverrides]);

  useEffect(() => {
    const validIds = new Set(standardMissionProfiles.map(profile => profile.id));
    setOpenStandardMissionIds(prev => new Set(Array.from(prev).filter(id => validIds.has(id))));
    setStandardMissionDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => validIds.has(id))));
    setTemporaryStandardMissionOverrides(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => validIds.has(id))));
    setEditingStandardMissionId(prev => (prev && validIds.has(prev) ? prev : null));
    setPendingStandardMissionSaveId(prev => (prev && validIds.has(prev) ? prev : null));
  }, [standardMissionProfiles]);

  const formatMissionMinutes = (minutes?: number): string => {
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  };

  const getStandardMissionDraftValue = <K extends keyof StandardMissionProfile>(
    profile: StandardMissionProfile,
    field: K,
  ): StandardMissionProfile[K] => (
    standardMissionDrafts[profile.id]?.[field] ?? profile[field]
  ) as StandardMissionProfile[K];

  const updateStandardMissionDraft = (profileId: string, changes: Partial<StandardMissionProfile>) => {
    setStandardMissionDrafts(prev => ({
      ...prev,
      [profileId]: {
        ...(prev[profileId] || {}),
        ...changes,
      },
    }));
    setPendingStandardMissionSaveId(null);
  };

  const beginStandardMissionEdit = (profile: StandardMissionProfile) => {
    setOpenStandardMissionIds(prev => new Set(prev).add(profile.id));
    setEditingStandardMissionId(profile.id);
    setPendingStandardMissionSaveId(null);
    setStandardMissionDrafts(prev => ({
      ...prev,
      [profile.id]: { ...(temporaryStandardMissionOverrides[profile.id] || {}) },
    }));
  };

  const cancelStandardMissionEdit = (profileId: string) => {
    setEditingStandardMissionId(null);
    setPendingStandardMissionSaveId(null);
    setStandardMissionDrafts(prev => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
  };

  const commitStandardMissionDraft = (profile: StandardMissionProfile, permanent: boolean) => {
    const changes = standardMissionDrafts[profile.id] || {};
    if (permanent) {
      onSaveStandardMissionProfile?.(profile.id, changes);
      setTemporaryStandardMissionOverrides(prev => {
        const next = { ...prev };
        delete next[profile.id];
        return next;
      });
    } else {
      setTemporaryStandardMissionOverrides(prev => ({
        ...prev,
        [profile.id]: {
          ...(prev[profile.id] || {}),
          ...changes,
        },
      }));
    }
    cancelStandardMissionEdit(profile.id);
  };

  const toggleStandardMissionOpen = (profileId: string) => {
    setOpenStandardMissionIds(prev => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };
  const getStandardMissionCrewRequirement = (profile: StandardMissionProfile): CrewRequirement => {
    const mode = String(getStandardMissionDraftValue(profile, 'crewCompositionMode') || 'STANDARD').toUpperCase();
    const rawRoleRequirements = getStandardMissionDraftValue(profile, 'roleRequirements') as StandardMissionProfile['roleRequirements'];
    const roleRequirements = Array.isArray(rawRoleRequirements)
      ? rawRoleRequirements
      : [];
    return mode === 'CUSTOM'
      ? {
          mode: 'custom',
          roles: roleRequirements.map(requirement => ({
            role: requirement.role,
            count: requirement.count,
            eligibleRoles: [requirement.role],
          })),
        }
      : { mode: 'aircraft_default' };
  };
  const activeCallsignUnitCodes = useMemo(() => {
    const contextCodes = Array.from(activeUnitCodeSet);
    if (contextCodes.length > 0) return contextCodes;
    return String(activeUnitCode || school || '')
      .split('+')
      .map(code => String(code || '').trim().toUpperCase())
      .filter(Boolean);
  }, [activeUnitCode, activeUnitCodeSet, school]);
  const unitCallsignEntries = useMemo(() => {
    const seen = new Set<string>();
    return activeCallsignUnitCodes
      .flatMap(unitCode => getUnitCallsignEntries(unitCallsignSettings, unitCode))
      .filter(entry => {
        const key = `${entry.unitCode}::${entry.callsign.toUpperCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [activeCallsignUnitCodes, unitCallsignSettings]);
  const formationCallsignEntries = useMemo<UnitCallsignEntry[]>(() => {
    const activeUnits = new Set(activeCallsignUnitCodes);
    const normalise = (value: unknown) => String(value || '').trim().toUpperCase();
    const activeLocation = normalise(school);
    const activeLocationTokens = new Set([
      activeLocation,
      activeLocation.replace(/^Y(?=[A-Z0-9]{3}$)/, ''),
      activeLocation.length === 3 ? `Y${activeLocation}` : '',
    ].filter(Boolean));
    const seen = new Set<string>();
    return formationCallsigns
      .map((callsign, index): UnitCallsignEntry | null => {
        const unitCode = normalise(callsign.unit);
        const code = normalise(callsign.code || callsign.name);
        if (!code) return null;
        if (unitCode && activeUnits.size > 0 && !activeUnits.has(unitCode)) return null;
        const locationTokens = [callsign.location, callsign.locationCode].map(normalise).filter(Boolean);
        if (locationTokens.length > 0 && !locationTokens.some(token => activeLocationTokens.has(token))) return null;
        const key = `${unitCode || activeTaskingUnitCode}::${code}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: `formation-callsign-${unitCode || 'unit'}-${code}-${index}`,
          unitCode: unitCode || activeTaskingUnitCode,
          callsign: code,
        };
      })
      .filter(Boolean) as UnitCallsignEntry[];
  }, [activeCallsignUnitCodes, activeTaskingUnitCode, formationCallsigns, school]);
  const defaultUnitCallsign = useMemo(
    () => activeCallsignUnitCodes
      .map(unitCode => getDefaultUnitCallsign(unitCallsignSettings, unitCode))
      .find(Boolean) || '',
    [activeCallsignUnitCodes, unitCallsignSettings],
  );
  const callsignNumberOptions = useMemo(
    () => Array.from({ length: 101 }, (_, value) => ({ value, label: formatUnitCallsignNumber(value) })),
    [],
  );
  const unitCallsignEntriesByUnit = useMemo(() => unitCallsignEntries.reduce((groups, entry) => {
    const groupLabel = String(entry.unitCode || 'Unit').trim() || 'Unit';
    groups.set(groupLabel, [...(groups.get(groupLabel) || []), entry]);
    return groups;
  }, new Map<string, UnitCallsignEntry[]>()), [unitCallsignEntries]);
  const currencyProfilesForContext = useMemo<CurrencyProfile[]>(() => {
    const profiles = getContinuationEventCurrencyProfiles(continuationEvents);
    const contextCodes = Array.from(activeUnitCodeSet);
    const activeAircraftTypeCode = String(aircraftTypeCode || '').trim().toUpperCase();
    const activeCompositeCodes = new Set([
      normaliseTaskingUnitCode(activeUnitCode),
      contextCodes.join('+'),
      contextCodes.join('/'),
    ].filter(Boolean));
    const appliesToContext = (profile: CurrencyProfile): boolean => {
      const profileAircraftCode = String(profile.aircraftTypeCode || '').trim().toUpperCase();
      if (profileAircraftCode && activeAircraftTypeCode && profileAircraftCode !== activeAircraftTypeCode) return false;
      const profileUnitCode = normaliseTaskingUnitCode(profile.unitCode);
      if (profileUnitCode && contextCodes.length > 0) return contextCodes.includes(profileUnitCode);
      const profileCompositeCode = normaliseTaskingUnitCode(profile.compositeUnitCode);
      if (!profileCompositeCode) return !profileUnitCode;
      if (activeCompositeCodes.has(profileCompositeCode)) return true;
      const profileCompositeParts = splitTaskingCompositeUnitCode(profileCompositeCode);
      return profileCompositeParts.length > 0 && profileCompositeParts.every(code => contextCodes.includes(code));
    };
    const seen = new Set<string>();
    return profiles
      .filter(profile => profile.status !== 'INACTIVE')
      .filter(appliesToContext)
      .filter(profile => {
        const key = profile.compositeProfileId || profile.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [activeUnitCode, activeUnitCodeSet, aircraftTypeCode, continuationEvents]);
  const sctEvents = useMemo(() => {
    const profileNames = currencyProfilesForContext.map(profile => String(profile.name || profile.currency || '').trim()).filter(Boolean);
    return Array.from(new Set(profileNames));
  }, [currencyProfilesForContext]);
  const currencyProfileNameLabels = useMemo(() => {
    const counts = currencyProfilesForContext.reduce((map, profile) => {
      const name = String(profile.name || profile.currency || '').trim();
      if (!name) return map;
      map.set(name, (map.get(name) || 0) + 1);
      return map;
    }, new Map<string, number>());
    return Object.fromEntries(currencyProfilesForContext.map((profile) => {
      const name = String(profile.name || profile.currency || '').trim();
      const currency = String(profile.currency || '').trim();
      return [name, counts.get(name)! > 1 && currency ? `${name} - ${currency}` : name];
    }).filter(([name]) => Boolean(name)));
  }, [currencyProfilesForContext]);
  const fixedCrewCurrencyCrewOptions = useMemo(() => Array.from(new Set([
    ...currencyProfilesForContext.map(profile => String(profile.crew || '').trim()).filter(Boolean),
    ...standardMissionCrewOptions.map(option => String(option || '').trim()).filter(Boolean),
  ])), [currencyProfilesForContext, standardMissionCrewOptions]);
  const fixedCrewRequestCrewGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      unitCode: string;
      crewValue: string;
      label: string;
      members: Instructor[];
    }>();
    const formatCrewLabel = (crewValue: string, unitCode: string): string => {
      const crewCore = String(crewValue || '').replace(/^CREW\s*/i, '').trim().toUpperCase();
      const crewLabel = crewCore ? `CREW ${crewCore}` : String(crewValue || '').trim().toUpperCase();
      return unitCode ? `${crewLabel}/${unitCode}` : crewLabel;
    };

    instructorsData.forEach(staff => {
      const crewValue = String(staff.crew || '').trim();
      if (!crewValue) return;
      const unitCode = normaliseTaskingUnitCode(staff.unit || activeUnitCode || school);
      if (activeUnitCodeSet.size > 0 && unitCode && !activeUnitCodeSet.has(unitCode)) return;
      const crewCore = crewValue.replace(/^CREW\s*/i, '').trim().toUpperCase();
      if (!crewCore) return;
      const key = `${unitCode || 'UNIT'}::${crewCore}`;
      const existing = groups.get(key);
      if (existing) {
        existing.members.push(staff);
        return;
      }
      groups.set(key, {
        key,
        unitCode,
        crewValue: crewCore,
        label: formatCrewLabel(crewCore, unitCode),
        members: [staff],
      });
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        members: group.members.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      }))
      .sort((a, b) => a.unitCode.localeCompare(b.unitCode, undefined, { sensitivity: 'base' })
        || a.crewValue.localeCompare(b.crewValue, undefined, { numeric: true, sensitivity: 'base' }));
  }, [activeUnitCode, activeUnitCodeSet, instructorsData, school]);
  const fixedCrewRequestCrewGroupsByUnit = useMemo(() => fixedCrewRequestCrewGroups.reduce((map, group) => {
    const unitKey = group.unitCode || 'Unit';
    if (!map.has(unitKey)) map.set(unitKey, []);
    map.get(unitKey)!.push(group);
    return map;
  }, new Map<string, typeof fixedCrewRequestCrewGroups>()), [fixedCrewRequestCrewGroups]);
  const staffHasPicQualification = (staff?: Instructor | null): boolean => {
    if (!staff || !fixedCrewPicQualification) return false;
    return normaliseAssignedQualificationIds(staff.preferences?.qualifications || [], normalisedStaffQualificationCatalogue, false)
      .includes(fixedCrewPicQualification.id);
  };
  const allPicQualifiedStaff = useMemo(() => instructorsData
    .filter(staff => staffHasPicQualification(staff))
    .filter(staff => {
      const unitCode = normaliseTaskingUnitCode(staff.unit || activeUnitCode || school);
      return activeUnitCodeSet.size === 0 || !unitCode || activeUnitCodeSet.has(unitCode);
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [
      activeUnitCode,
      activeUnitCodeSet,
      fixedCrewPicQualification,
      instructorsData,
      normalisedStaffQualificationCatalogue,
      school,
    ]);
  const getStaffCurrencyPicOptions = (staff: Instructor): Instructor[] => {
    if (staffHasPicQualification(staff)) return [staff];
    const crewValue = String(staff.crew || '').replace(/^CREW\s*/i, '').trim().toUpperCase();
    const staffUnitCode = normaliseTaskingUnitCode(staff.unit || activeUnitCode || school);
    if (!crewValue || staff.isAdminStaff || staff.isDeputyFlightCommander) return allPicQualifiedStaff;
    const crewGroup = fixedCrewRequestCrewGroups.find(group => (
      group.crewValue === crewValue &&
      (!staffUnitCode || group.unitCode === staffUnitCode)
    ));
    const crewPicCandidates = (crewGroup?.members || []).filter(candidate => staffHasPicQualification(candidate));
    return crewPicCandidates.length > 0 ? crewPicCandidates : allPicQualifiedStaff;
  };
  const getDefaultStaffCurrencyPicName = (staff: Instructor): string => {
    const options = getStaffCurrencyPicOptions(staff);
    if (staffHasPicQualification(staff)) return staff.name;
    return options.length === 1 ? options[0].name : '';
  };
  const getStaffCurrencyFixedCrewGroup = (staff: Instructor) => {
    const crewValue = String(staff.crew || '').replace(/^CREW\s*/i, '').trim().toUpperCase();
    const staffUnitCode = normaliseTaskingUnitCode(staff.unit || activeUnitCode || school);
    if (!crewValue) return undefined;
    return fixedCrewRequestCrewGroups.find(group => (
      group.crewValue === crewValue &&
      (!staffUnitCode || group.unitCode === staffUnitCode)
    ));
  };
  const getCurrencyProfileConfigId = (profile: CurrencyProfile): string | null => {
    const profileConfig = String(profile.config || '').trim();
    if (!profileConfig || profileConfig.toUpperCase() === 'ANY') return null;
    const configMatch = aircraftConfigOptions.find(definition => (
      definition.id === profileConfig || definition.label === profileConfig || definition.definition === profileConfig
    ));
    return configMatch?.id || null;
  };
  const airCombatTrainingStreams = useMemo(() => {
    if (!isAirCombatModel) return [];
    const streams = new Map<string, AirCombatTrainingStreamWeight>();
    instructorsData.forEach(staff => {
      const assignments = normaliseAirCombatTrainingAssignments(staff.preferences);
      ([...assignments.courses, ...assignments.trainingPackages]).forEach(assignment => {
        const assignmentUnit = String(assignment.unitCode || staff.unit || '').trim().toUpperCase();
        if (activeUnitCodeSet.size > 0 && assignmentUnit && !activeUnitCodeSet.has(assignmentUnit)) return;
        const key = assignment.trainingKey || getAirCombatTrainingKey(
          assignment.kind,
          assignment.code,
          assignment.locationCode || school,
          assignment.unitCode || assignmentUnit,
        );
        if (!streams.has(key)) {
          streams.set(key, {
            key,
            kind: assignment.kind,
            code: assignment.code,
            title: assignment.title,
            locationCode: assignment.locationCode || school,
            unitCode: assignment.unitCode || assignmentUnit,
            weight: 0,
          });
        }
      });
    });
    const savedWeights = new Map((normalisedAirCombatWeights.trainingStreams || []).map(stream => [stream.key, stream.weight]));
    const list = Array.from(streams.values()).sort((left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.code.localeCompare(right.code) ||
      String(left.title || '').localeCompare(String(right.title || ''))
    );
    if (list.length === 0) return list;
    const missingDefault = Math.max(1, Math.floor(100 / list.length));
    const weighted = list.map(stream => ({
      ...stream,
      weight: savedWeights.get(stream.key) ?? missingDefault,
    }));
    return normaliseAirCombatSchedulingWeights({ trainingStreams: weighted }).trainingStreams || weighted;
  }, [activeUnitCodeSet, instructorsData, isAirCombatModel, normalisedAirCombatWeights.trainingStreams, school]);
  const fixedCrewStreamRowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const fixedCrewPreviousRowTops = useRef<Map<string, number>>(new Map());
  const fixedCrewSuppressNextTableAnimation = useRef(true);
  const fixedCrewSliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [fixedCrewPriorityDraftStreams, setFixedCrewPriorityDraftStreams] = useState<FixedCrewTrainingStreamDisplay[]>([]);
  const [airCombatPriorityDraftStreams, setAirCombatPriorityDraftStreams] = useState<PriorityAllocationItem[]>([]);
  const [flightSchoolPriorityDraftStreams, setFlightSchoolPriorityDraftStreams] = useState<PriorityAllocationItem[]>([]);
  const fixedCrewTrainingStreams = useMemo(() => {
    if (!isFixedCrewModel) return [];
    const savedStreams = normaliseFixedCrewTrainingPriorityWeightsToStep(fixedCrewTrainingPriorities);
    const saved = new Map(savedStreams.map(stream => [stream.key, stream]));
    const savedOrder = new Map(savedStreams.map((stream, index) => [stream.key, index]));
    const grouped = new Map<string, FixedCrewTrainingStreamPriority & { eventCount: number }>();
    syllabusDetails
      .filter(item => item.isActive !== false)
      .filter(item => !isSyllabusCourseShell(item))
      .forEach(item => {
        const itemUnit = String((item as any).unit || '').trim().toUpperCase();
        if (activeUnitCodeSet.size > 0 && itemUnit && !activeUnitCodeSet.has(itemUnit)) return;
        if (activeUnitCodeSet.size > 0 && !itemUnit) return;
        const kind = getFixedCrewTrainingKindForLmpType(item.lmpType);
        const code = getFixedCrewTrainingCodeFromItem(item);
        if (!code) return;
        const key = getFixedCrewTrainingKey(kind, code, item.location || school, itemUnit || activeUnitCode || school);
        const existing = grouped.get(key);
        if (existing) {
          existing.eventCount += 1;
          return;
        }
        const savedStream = saved.get(key);
        grouped.set(key, {
          key,
          kind,
          code,
          title: getFixedCrewTrainingTitleFromItem(item),
          locationCode: String(item.location || school || '').trim().toUpperCase(),
          unitCode: itemUnit || String(activeUnitCode || '').trim().toUpperCase(),
          weight: savedStream?.weight ?? 10,
          enabled: savedStream?.enabled ?? true,
          eventCount: 1,
        });
      });
    return normaliseFixedCrewTrainingPriorityWeightsToStep(Array.from(grouped.values())).sort((left, right) => {
      if (right.enabled !== left.enabled) return Number(right.enabled) - Number(left.enabled);
      const leftSavedOrder = savedOrder.get(left.key);
      const rightSavedOrder = savedOrder.get(right.key);
      if (leftSavedOrder !== undefined && rightSavedOrder !== undefined) return leftSavedOrder - rightSavedOrder;
      if (leftSavedOrder !== undefined) return -1;
      if (rightSavedOrder !== undefined) return 1;
      return (
        right.weight - left.weight ||
        left.kind.localeCompare(right.kind) ||
        left.code.localeCompare(right.code, undefined, { numeric: true })
      );
    });
  }, [activeUnitCode, activeUnitCodeSet, fixedCrewTrainingPriorities, isFixedCrewModel, school, syllabusDetails]);
  const flightSchoolPriorityStreams = useMemo<PriorityAllocationItem[]>(() => (
    normalisePriorityAllocationItemsToStep(coursePriorities.map(course => ({
      key: course,
      kind: 'course' as const,
      code: course,
      title: course,
      weight: coursePercentages.get(course) ?? 0,
      enabled: true,
    })))
  ), [coursePercentages, coursePriorities]);
  const airCombatPriorityStreams = useMemo<PriorityAllocationItem[]>(() => (
    normalisePriorityAllocationItemsToStep(airCombatTrainingStreams.map(stream => ({
      key: stream.key,
      kind: stream.kind,
      code: stream.code,
      title: stream.title,
      locationCode: stream.locationCode,
      unitCode: stream.unitCode,
      weight: stream.weight,
      enabled: true,
    })))
  ), [airCombatTrainingStreams]);
  const displayedFixedCrewTrainingStreams = fixedCrewPriorityDraftStreams.length > 0
    ? fixedCrewPriorityDraftStreams
    : fixedCrewTrainingStreams;
  const displayedPriorityAllocationStreams = priorityAllocationModel === 'air_combat'
    ? (airCombatPriorityDraftStreams.length > 0 ? airCombatPriorityDraftStreams : airCombatPriorityStreams)
    : priorityAllocationModel === 'fixed_crew'
      ? displayedFixedCrewTrainingStreams.map(stream => ({
          key: stream.key,
          kind: stream.kind,
          code: stream.code,
          title: stream.title,
          locationCode: stream.locationCode,
          unitCode: stream.unitCode,
          eventCount: stream.eventCount,
          weight: stream.weight,
          enabled: stream.enabled,
        }))
      : (flightSchoolPriorityDraftStreams.length > 0 ? flightSchoolPriorityDraftStreams : flightSchoolPriorityStreams);
  const fixedCrewColourByKey = useMemo(() => {
    const colours = new Map<string, string>();
    displayedPriorityAllocationStreams.forEach((stream, index) => {
      colours.set(stream.key, FIXED_CREW_PRIORITY_COLOURS[index % FIXED_CREW_PRIORITY_COLOURS.length]);
    });
    return colours;
  }, [displayedPriorityAllocationStreams]);
  const activeFixedCrewPriorityStreams = displayedPriorityAllocationStreams.filter(stream => stream.enabled);
  const sortedFixedCrewPriorityTableStreams = displayedPriorityAllocationStreams
    .slice()
    .sort((left, right) => {
      if (right.enabled !== left.enabled) return Number(right.enabled) - Number(left.enabled);
      if (right.weight !== left.weight) return right.weight - left.weight;
      return String(left.title || left.code).localeCompare(String(right.title || right.code));
    });
  const fixedCrewPriorityBoundaries = activeFixedCrewPriorityStreams.reduce<number[]>((boundaries, stream, index) => {
    const previous = boundaries[index - 1] || 0;
    boundaries.push(previous + stream.weight);
    return boundaries;
  }, []);
  const fixedCrewPriorityTableSignature = sortedFixedCrewPriorityTableStreams
    .map(stream => `${stream.key}:${stream.enabled ? 1 : 0}:${stream.weight}`)
    .join('|');

  useLayoutEffect(() => {
    if (!isFixedCrewModel) return;
    const nextTops = new Map<string, number>();
    const shouldSuppressAnimation = fixedCrewSuppressNextTableAnimation.current;
    fixedCrewStreamRowRefs.current.forEach((node, key) => {
      const top = node.getBoundingClientRect().top;
      const previousTop = fixedCrewPreviousRowTops.current.get(key);
      if (!shouldSuppressAnimation && previousTop !== undefined) {
        const delta = previousTop - top;
        if (Math.abs(delta) > 1) {
          node.getAnimations().forEach(animation => {
            animation.onfinish = null;
            animation.oncancel = null;
            animation.cancel();
          });
          node.style.position = 'relative';
          node.style.zIndex = '1';
          node.style.willChange = 'transform';
          const animation = node.animate(
            [
              { transform: `translateY(${delta}px)` },
              { transform: 'translateY(0)' },
            ],
            { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
          );
          const clearAnimationStyles = () => {
            node.style.position = '';
            node.style.zIndex = '';
            node.style.willChange = '';
          };
          animation.onfinish = clearAnimationStyles;
          animation.oncancel = clearAnimationStyles;
        }
      }
      nextTops.set(key, top);
    });
    fixedCrewPreviousRowTops.current = nextTops;
    fixedCrewSuppressNextTableAnimation.current = false;
  }, [fixedCrewPriorityTableSignature, isFixedCrewModel]);

  useEffect(() => {
    if (!isFixedCrewModel || fixedCrewTrainingStreams.length === 0) return;
    const savedKeys = new Set(normaliseFixedCrewTrainingPriorities(fixedCrewTrainingPriorities).map(stream => stream.key));
    const missingStreams = fixedCrewTrainingStreams
      .filter(stream => !savedKeys.has(stream.key))
      .map(({ eventCount: _eventCount, ...stream }) => stream);
    if (missingStreams.length === 0) return;
    onUpdateFixedCrewTrainingPriorities?.(
      normaliseFixedCrewTrainingPriorityWeightsToStep([
        ...fixedCrewTrainingPriorities,
        ...missingStreams,
      ]),
    );
  }, [fixedCrewTrainingPriorities.length, fixedCrewTrainingStreams, isFixedCrewModel, onUpdateFixedCrewTrainingPriorities]);
  const fixedCrewEnabledStreamCount = displayedPriorityAllocationStreams.filter(stream => stream.enabled).length;
  const fixedCrewEnabledStreamTotal = displayedPriorityAllocationStreams
    .filter(stream => stream.enabled)
    .reduce((sum, stream) => sum + stream.weight, 0);
  useEffect(() => {
    setCourseTimestamp(new Date().toLocaleString());
  }, [coursePriorities, coursePercentages]);

  useEffect(() => {
    setFlightSchoolPriorityDraftStreams([]);
  }, [coursePriorities, coursePercentages]);

  useEffect(() => {
    setAircraftTimestamp(new Date().toLocaleString());
  }, [availableAircraftCount, aircraftConfigCapacities]);

  useEffect(() => {
    if (availableAircraftCount > aircraftCapacityMax) onUpdateAircraftCount(aircraftCapacityMax);
  }, [aircraftCapacityMax, availableAircraftCount, onUpdateAircraftCount]);

  useEffect(() => {
    if (availableFtdCount > ftdCapacityMax) onUpdateFtdCount(ftdCapacityMax);
  }, [availableFtdCount, ftdCapacityMax, onUpdateFtdCount]);

  useEffect(() => {
    if (availableCptCount > cptCapacityMax) onUpdateCptCount(cptCapacityMax);
  }, [availableCptCount, cptCapacityMax, onUpdateCptCount]);

  const handleAircraftCapacityChange = (value: string) => {
    const nextCount = Math.min(aircraftCapacityMax, Math.max(0, parseInt(value, 10) || 0));
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
    const normalisedValue = normaliseCapacityInput(value);
    const otherNonCleanTotal = aircraftConfigurationDefinitions
      .filter(definition => definition.id !== 'CONFIG-0' && definition.id !== configId)
      .reduce((total, definition) => total + (parseInt(aircraftConfigCapacities[definition.id] || '', 10) || 0), 0);
    const maxForConfig = Math.max(0, Math.min(availableAircraftCount, aircraftCapacityMax) - otherNonCleanTotal);
    const nextValue = normalisedValue ? String(Math.min(maxForConfig, parseInt(normalisedValue, 10) || 0)) : '';
    const nextCapacities = { ...aircraftConfigCapacities, [configId]: nextValue };
    if (!nextValue) delete nextCapacities[configId];
    logAudit("Priorities", "Edit", `Updated ${configId.replace('-', ' ')} aircraft capacity`, `${aircraftConfigCapacities[configId] || 'blank'} → ${nextValue || 'blank'}`);
    onUpdateAircraftConfigCapacities(nextCapacities);
  };

  const updateAirCombatStreamWeights = (nextStreams: AirCombatTrainingStreamWeight[], auditLabel: string) => {
    const nextWeights = normaliseAirCombatSchedulingWeights({ trainingStreams: nextStreams });
    logAudit(
      'Priorities',
      'Edit',
      'Updated Air Combat course/package priority weights',
      auditLabel,
    );
    onUpdateAirCombatSchedulingWeights?.(nextWeights);
  };

  const prepareFixedCrewPriorityStreams = (
    streams: FixedCrewTrainingStreamPriority[],
  ): FixedCrewTrainingStreamPriority[] => snapFixedCrewTrainingPriorityWeightsToStep(streams);

  const persistFixedCrewPriorityStreams = (streams: FixedCrewTrainingStreamPriority[]) => {
    const prepared = prepareFixedCrewPriorityStreams(streams);
    const enabledTotal = prepared.filter(stream => stream.enabled).reduce((sum, stream) => sum + stream.weight, 0);
    if (enabledTotal !== 100) return;
    const streamOrder = new Map(prepared.map((stream, index) => [stream.key, index]));
    const nextStreams = prepared
      .slice()
      .sort((left, right) => {
        if (right.enabled !== left.enabled) return Number(right.enabled) - Number(left.enabled);
        if (right.weight !== left.weight) return right.weight - left.weight;
        return (streamOrder.get(left.key) ?? 0) - (streamOrder.get(right.key) ?? 0);
      });
    logAudit('Priorities', 'Edit', 'Updated Fixed Crew course/package priorities', `${nextStreams.length} streams`);
    onUpdateFixedCrewTrainingPriorities?.(nextStreams);
  };

  const persistPriorityAllocationStreams = (items: PriorityAllocationItem[]) => {
    const prepared = normalisePriorityAllocationItemsToStep(items);
    const enabledTotal = prepared.filter(item => item.enabled).reduce((sum, item) => sum + item.weight, 0);
    if (enabledTotal !== 100) return;
    const order = new Map(prepared.map((item, index) => [item.key, index]));
    const sorted = prepared
      .slice()
      .sort((left, right) => {
        if (right.enabled !== left.enabled) return Number(right.enabled) - Number(left.enabled);
        if (right.weight !== left.weight) return right.weight - left.weight;
        return (order.get(left.key) ?? 0) - (order.get(right.key) ?? 0);
      });

    if (priorityAllocationModel === 'flight_school') {
      const nextPercentages = new Map<string, number>();
      coursePriorities.forEach(course => {
        const stream = prepared.find(item => item.code === course);
        nextPercentages.set(course, stream?.enabled ? stream.weight : 0);
      });
      onUpdatePercentages(nextPercentages);
      logAudit('Priorities', 'Edit', `Updated ${operationalModelLabel.replace(/\s+Model$/i, '')} course priorities`, `${sorted.length} courses`);
      return;
    }

    if (priorityAllocationModel === 'air_combat') {
      const trainingStreams: AirCombatTrainingStreamWeight[] = sorted.map(item => ({
        key: item.key,
        kind: item.kind,
        code: item.code,
        title: item.title,
        locationCode: item.locationCode,
        unitCode: item.unitCode,
        weight: item.enabled ? item.weight : 0,
      }));
      updateAirCombatStreamWeights(trainingStreams, `${trainingStreams.length} streams`);
      return;
    }

    const fixedCrewStreams: FixedCrewTrainingStreamPriority[] = sorted.map(item => ({
      key: item.key,
      kind: item.kind,
      code: item.code,
      title: item.title,
      locationCode: item.locationCode,
      unitCode: item.unitCode,
      weight: item.enabled ? item.weight : 0,
      enabled: item.enabled,
    }));
    persistFixedCrewPriorityStreams(fixedCrewStreams);
  };

  const updatePriorityAllocationStreams = (items: PriorityAllocationItem[]) => {
    if (priorityAllocationModel === 'fixed_crew' && fixedCrewPriorityDraftStreams.length === 0) {
      fixedCrewSuppressNextTableAnimation.current = true;
    }
    const prepared = normalisePriorityAllocationItemsToStep(items);
    if (priorityAllocationModel === 'air_combat') {
      setAirCombatPriorityDraftStreams(prepared);
    } else if (priorityAllocationModel === 'fixed_crew') {
      const eventCounts = new Map(displayedFixedCrewTrainingStreams.map(stream => [stream.key, stream.eventCount]));
      setFixedCrewPriorityDraftStreams(
        prepared.map(item => ({
          ...item,
          eventCount: eventCounts.get(item.key) ?? fixedCrewTrainingStreams.find(stream => stream.key === item.key)?.eventCount,
        })),
      );
    } else {
      setFlightSchoolPriorityDraftStreams(prepared);
    }
    persistPriorityAllocationStreams(prepared);
  };

  const equalisePriorityAllocationStreams = (
    streams: PriorityAllocationItem[],
  ): PriorityAllocationItem[] => normalisePriorityAllocationItemsToStep(
    streams.map(stream => ({ ...stream, weight: stream.enabled ? 1 : 0 })),
  );

  const updateFixedCrewPriorityBoundary = (boundaryIndex: number, nextBoundaryPercent: number) => {
    const activeStreams = activeFixedCrewPriorityStreams;
    if (boundaryIndex < 0 || boundaryIndex >= activeStreams.length - 1) return;
    const leftStream = activeStreams[boundaryIndex];
    const rightStream = activeStreams[boundaryIndex + 1];
    const previousBoundary = boundaryIndex === 0 ? 0 : fixedCrewPriorityBoundaries[boundaryIndex - 1];
    const followingBoundary = fixedCrewPriorityBoundaries[boundaryIndex + 1] ?? 100;
    const boundedBoundary = Math.max(
      previousBoundary + FIXED_CREW_PRIORITY_MIN_PERCENT,
      Math.min(followingBoundary - FIXED_CREW_PRIORITY_MIN_PERCENT, snapFixedCrewPriorityWeight(nextBoundaryPercent)),
    );
    const leftWeight = boundedBoundary - previousBoundary;
    const rightWeight = followingBoundary - boundedBoundary;
    const nextStreams = displayedPriorityAllocationStreams.map(stream => {
      if (stream.key === leftStream.key) return { ...stream, weight: leftWeight };
      if (stream.key === rightStream.key) return { ...stream, weight: rightWeight };
      return stream;
    });
    updatePriorityAllocationStreams(nextStreams);
  };

  const handleFixedCrewPriorityHandlePointerDown = (
    boundaryIndex: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!fixedCrewSliderTrackRef.current) return;
    event.preventDefault();
    const track = fixedCrewSliderTrackRef.current;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const updateFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const rawPercent = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
      updateFixedCrewPriorityBoundary(boundaryIndex, rawPercent);
    };

    updateFromClientX(event.clientX);
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateFromClientX(moveEvent.clientX);
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleFixedCrewStreamToggle = (streamKey: string) => {
    const current = displayedPriorityAllocationStreams.map(stream => ({ ...stream }));
    const target = current.find(stream => stream.key === streamKey);
    if (target?.enabled && current.filter(stream => stream.enabled).length <= 1) return;
    const next = current.map(stream => stream.key === streamKey ? {
      ...stream,
      enabled: !stream.enabled,
      weight: 0,
    } : stream);
    updatePriorityAllocationStreams(equalisePriorityAllocationStreams(next));
  };

  const handleEqualiseFixedCrewStreams = () => {
    const current = displayedPriorityAllocationStreams.map(stream => ({ ...stream }));
    if (current.length === 0) return;
    updatePriorityAllocationStreams(equalisePriorityAllocationStreams(current.map(stream => ({ ...stream, enabled: true }))));
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

  

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 5) {
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

  const [showExclusionPlanner, setShowExclusionPlanner] = useState(() => {
    try {
      const shouldOpen = localStorage.getItem('neo_open_departure_arrival_exclusions') === '1';
      if (shouldOpen) localStorage.removeItem('neo_open_departure_arrival_exclusions');
      return shouldOpen;
    } catch {
      return false;
    }
  });

  const formatTimeLabel = (decimalHour: number): string => {
    const bounded = Math.max(0, Math.min(23 + 59 / 60, Number(decimalHour) || 0));
    const hours = Math.floor(bounded);
    const minutes = Math.round((bounded - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formatPriorityDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Any';
    try {
      const parsedDate = new Date(`${dateString}T00:00:00Z`);
      if (Number.isNaN(parsedDate.getTime())) return 'Any';
      const day = String(parsedDate.getUTCDate()).padStart(2, '0');
      const month = parsedDate.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
      const year = String(parsedDate.getUTCFullYear()).slice(-2);
      return `${day} ${month} ${year}`;
    } catch {
      return 'Any';
    }
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
  const [staffCurrencyPicSelections, setStaffCurrencyPicSelections] = useState<Record<string, string>>({});
  const [staffCurrencyIncludeFlights, setStaffCurrencyIncludeFlights] = useState(true);
  const [staffCurrencyIncludeSims, setStaffCurrencyIncludeSims] = useState(false);
  const [staffCurrencyCrewMode, setStaffCurrencyCrewMode] = useState<'withOtherPilot' | 'solo'>('withOtherPilot');
  const [staffCurrencyRoleFilter, setStaffCurrencyRoleFilter] = useState('Pilot');
  const [isStaffCurrencyBuilderOpen, setIsStaffCurrencyBuilderOpen] = useState(false);
  const [openCurrencyDraftId, setOpenCurrencyDraftId] = useState<string | null>(null);
  const [isCurrencyConfigApplyOpen, setIsCurrencyConfigApplyOpen] = useState(false);
  const [bulkCurrencyAircraftConfigId, setBulkCurrencyAircraftConfigId] = useState(BASE_AIRCRAFT_CONFIG.id);
  const legacyCurrencyDraftStorageKey = 'neoCurrencyDraftEvents';
  const currencyDraftStorageKey = 'neoCurrencyDraftEvents.v2';
  const [taskingAirfieldCatalogue, setTaskingAirfieldCatalogue] = useState<TaskingAirfieldCatalogueEntry[]>([]);
  const normaliseTaskingRequest = (request: any): TaskingRequest => {
    const scopeCodes = getTaskingRequestScopeCodes(request);
    return ({
      id: request.id || uuidv4(),
      unitCode: normaliseTaskingUnitCode(request.unitCode) || scopeCodes.join('+') || activeTaskingUnitCode,
      unitCodes: scopeCodes,
      tasking: request.tasking || '',
      date: request.date || buildDfpDate,
      takeoff: Number.isFinite(Number(request.takeoff)) ? Number(request.takeoff) : flyingStartTime,
      duration: Number.isFinite(Number(request.duration)) && Number(request.duration) > 0 ? Number(request.duration) : defaultTaskingDuration,
      resourceType: normaliseTaskingResourceKind(request.resourceType || request.type),
      flightType: request.flightType === 'Solo' ? 'Solo' : 'Dual',
      depPoint: request.depPoint || school,
      arrivalPoint: request.arrivalPoint || school,
      aircraftCount: Math.max(1, parseInt(String(request.aircraftCount || '1'), 10) || 1),
      isFormation: request.isFormation === true,
      aircraftConfigId: request.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id,
      crewRequirement: request.crewRequirement || { mode: 'aircraft_default' },
      callsignBase: request.callsignBase || defaultUnitCallsign || '',
      callsignNumber: Number.isFinite(Number(request.callsignNumber)) ? Math.max(0, Math.min(100, Math.floor(Number(request.callsignNumber)))) : 0,
      callsign: request.callsign || (request.callsignBase || defaultUnitCallsign ? buildUnitEventCallsign(request.callsignBase || defaultUnitCallsign, request.callsignNumber || 0) : ''),
      schedulerPriority: request.schedulerPriority === 'Medium' || request.schedulerPriority === 'Low'
        ? request.schedulerPriority
        : request.isMandatory === false
          ? 'Medium'
          : 'High',
      isMandatory: request.isMandatory !== false,
      saved: Boolean(request.saved || request.submitted),
      submitted: Boolean(request.submitted),
      ignored: Boolean(request.ignored),
    });
  };
  const getTaskingRequestSemanticKey = (request: TaskingRequest): string => {
    const aircraftIndex = 1;
    return [
      normaliseTaskingUnitCode(request.unitCode) || getTaskingRequestScopeCodes(request).join('+') || activeTaskingUnitCode,
      String(request.date || '').trim(),
      String(request.tasking || '').trim().toUpperCase().replace(/\s+/g, ' '),
      Number.isFinite(Number(request.takeoff)) ? Number(request.takeoff).toFixed(3) : '',
      Number.isFinite(Number(request.duration)) ? Number(request.duration).toFixed(3) : '',
      normaliseTaskingResourceKind(request.resourceType),
      Math.max(1, Math.floor(Number(request.aircraftCount) || 1)),
      aircraftIndex,
      request.isFormation === true ? 'FORMATION' : 'STANDARD',
      String(request.depPoint || '').trim().toUpperCase(),
      String(request.arrivalPoint || '').trim().toUpperCase(),
      String(request.aircraftConfigId || '').trim().toUpperCase(),
      String(request.schedulerPriority || (request.isMandatory !== false ? 'High' : 'Medium')).trim().toUpperCase(),
    ].join(':');
  };
  const dedupeTaskingRequests = (requests: TaskingRequest[]): TaskingRequest[] => {
    const byKey = new Map<string, TaskingRequest>();
    requests.forEach(request => {
      byKey.set(getTaskingRequestSemanticKey(request), request);
    });
    return Array.from(byKey.values());
  };
  const loadStoredTaskingRequests = (): TaskingRequest[] => {
    try {
      const stored = localStorage.getItem(TASKING_REQUEST_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? dedupeTaskingRequests(parsed.map(normaliseTaskingRequest)) : [];
    } catch {
      return [];
    }
  };
  const [taskingRequests, setTaskingRequests] = useState<TaskingRequest[]>(() => {
    return loadStoredTaskingRequests();
  });
  const visibleTaskingRequests = useMemo(
    () => taskingRequests.filter(taskingRequestMatchesActiveScope),
    [taskingRequests, activeTaskingUnitCodes.join('|')]
  );
  const [currencyDraftEvents, setCurrencyDraftEvents] = useState<Array<{
    id: string;
    audience: 'trainee' | 'staff';
    personId: number;
    personKey: string;
    personName: string;
    course?: string;
    rank?: string;
    eventType: 'flight' | 'ftd';
    currencyProfileName: string;
    currencyProfileCode: string;
    crewMode: 'withInstructor' | 'solo' | 'withOtherPilot';
    dueCurrencies: string[];
    selectedCurrencies: string[];
    aircraftConfigId: string;
    aircraftCount: number;
    crewRequirement?: CrewRequirement;
    picName?: string;
    fixedCrewGroupKey?: string;
    fixedCrewDisplayLabel?: string;
    formationCrew?: FixedCrewFormationAssignment[];
    selected: boolean;
    pushed: boolean;
  }>>(() => {
    try {
      localStorage.removeItem(legacyCurrencyDraftStorageKey);
      const stored = localStorage.getItem(currencyDraftStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? parsed.map((draft: any) => ({
            ...draft,
            aircraftConfigId: draft?.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id,
            currencyProfileName: String(draft?.currencyProfileName || draft?.eventName || '').trim(),
            currencyProfileCode: String(draft?.currencyProfileCode || draft?.eventCode || '').trim().toUpperCase().slice(0, 8),
            aircraftCount: Math.max(1, Math.floor(Number(draft?.aircraftCount) || 1)),
            crewRequirement: draft?.crewRequirement || { mode: 'aircraft_default' },
            picName: String(draft?.picName || '').trim(),
            fixedCrewGroupKey: String(draft?.fixedCrewGroupKey || '').trim(),
            fixedCrewDisplayLabel: String(draft?.fixedCrewDisplayLabel || '').trim(),
            formationCrew: Array.isArray(draft?.formationCrew)
              ? draft.formationCrew.map((assignment: any) => ({
                  crewGroup: String(assignment?.crewGroup || '').trim(),
                  crewGroupKey: String(assignment?.crewGroupKey || '').trim(),
                  crewUnitCode: String(assignment?.crewUnitCode || '').trim(),
                  crewDisplayLabel: String(assignment?.crewDisplayLabel || '').trim(),
                  crewIndividual: String(assignment?.crewIndividual || '').trim(),
                }))
              : [],
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

  useEffect(() => {
    if (activeCurrencyDraftIds.size === 0) return;
    setCurrencyDraftEvents(prev => {
      const next = prev.filter(draft => !activeCurrencyDraftIds.has(draft.id));
      return next.length === prev.length ? prev : next;
    });
  }, [activeCurrencyDraftIds]);

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

  const staffCurrencyRoleOptions = useMemo(() => {
    const seen = new Set<string>();
    const roles = (aircraftCrewComposition?.seats || [])
      .flatMap(seat => getAircraftSeatEligibleRoles(seat))
      .map(role => String(role || '').trim())
      .filter(Boolean)
      .filter(role => {
        const key = role.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return roles.length > 0 ? roles : ['Pilot'];
  }, [aircraftCrewComposition]);

  const selectedStaffCurrencyRole = staffCurrencyRoleOptions.find(role => (
    crewPositionValuesMatch(role, staffCurrencyRoleFilter, crewPositionTerminology)
  )) || staffCurrencyRoleOptions[0] || 'Pilot';

  const getStaffCurrencyRoleLabel = (role: string): string => (
    getCrewPositionDisplayLabel(role, crewPositionTerminology, role)
  );

  const staffCurrencyRows = useMemo(() => {
    return instructorsData
      .map(instructor => ({ instructor, personKey: String(instructor.id || instructor.idNumber || instructor.name), dueCurrencies: getDueCurrencies(instructor) }))
      .filter(row => row.dueCurrencies.length > 0)
      .filter(row => crewPositionValuesMatch(selectedStaffCurrencyRole, row.instructor.role, crewPositionTerminology))
      .sort((a, b) => {
        const rankDiff = String(a.instructor.rank || '').localeCompare(String(b.instructor.rank || ''), undefined, { sensitivity: 'base' });
        return rankDiff !== 0 ? rankDiff : a.instructor.name.localeCompare(b.instructor.name);
      });
  }, [instructorsData, currencyNames, buildDfpDate, selectedStaffCurrencyRole, crewPositionTerminology]);

  useEffect(() => {
    localStorage.setItem(currencyDraftStorageKey, JSON.stringify(currencyDraftEvents));
  }, [currencyDraftEvents]);

  useEffect(() => {
    const dedupedTaskingRequests = dedupeTaskingRequests(taskingRequests);
    if (dedupedTaskingRequests.length !== taskingRequests.length) {
      setTaskingRequests(dedupedTaskingRequests);
      return;
    }
    localStorage.setItem(TASKING_REQUEST_STORAGE_KEY, JSON.stringify(taskingRequests));
    window.dispatchEvent(new CustomEvent(TASKING_REQUESTS_UPDATED_EVENT));
  }, [taskingRequests]);

  useEffect(() => {
    const syncTaskingRequests = () => {
      const storedRequests = loadStoredTaskingRequests();
      setTaskingRequests(prev => (
        JSON.stringify(prev) === JSON.stringify(storedRequests) ? prev : storedRequests
      ));
    };
    window.addEventListener(TASKING_REQUESTS_UPDATED_EVENT, syncTaskingRequests);
    window.addEventListener('storage', syncTaskingRequests);
    return () => {
      window.removeEventListener(TASKING_REQUESTS_UPDATED_EVENT, syncTaskingRequests);
      window.removeEventListener('storage', syncTaskingRequests);
    };
  }, [buildDfpDate, flyingStartTime, school]);

  useEffect(() => {
    let cancelled = false;
    const loadTaskingAirfieldCatalogue = async () => {
      try {
        const res = await fetch(getTaskingAirfieldCatalogueUrl(), { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Airfield catalogue load failed (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const entries = data.filter((entry) => (
          entry
          && typeof entry.n === 'string'
          && Number.isFinite(Number(entry.a))
          && Number.isFinite(Number(entry.o))
          && typeof entry.t === 'string'
        )).map((entry) => ({
          ...entry,
          a: Number(entry.a),
          o: Number(entry.o),
        }));
        if (!cancelled) setTaskingAirfieldCatalogue(entries);
      } catch {
        if (!cancelled) setTaskingAirfieldCatalogue([]);
      }
    };

    loadTaskingAirfieldCatalogue();
    return () => { cancelled = true; };
  }, []);

  const taskingAirfieldLookup = useMemo(
    () => (taskingAirfieldCatalogue.length ? buildTaskingAirfieldLookup(taskingAirfieldCatalogue) : emptyTaskingAirfieldLookup),
    [taskingAirfieldCatalogue],
  );

  const addTaskingRequest = () => {
    const nextRequest: TaskingRequest = {
      id: uuidv4(),
      unitCode: activeTaskingUnitCode,
      unitCodes: activeTaskingUnitCodes,
      tasking: '',
      date: buildDfpDate,
      takeoff: flyingStartTime,
      duration: defaultTaskingDuration,
      resourceType: 'Flight',
      flightType: isSingleSeatAircraft ? 'Solo' : 'Dual',
      depPoint: school,
      arrivalPoint: school,
      aircraftCount: 1,
      isFormation: false,
      aircraftConfigId: BASE_AIRCRAFT_CONFIG.id,
      crewRequirement: isSingleSeatAircraft
        ? { mode: 'custom', roles: [{ role: 'Pilot', count: 1 }] }
        : { mode: 'aircraft_default' },
      callsignBase: defaultUnitCallsign,
      callsignNumber: 0,
      callsign: defaultUnitCallsign ? buildUnitEventCallsign(defaultUnitCallsign, 0) : '',
      schedulerPriority: 'High',
      isMandatory: true,
      saved: false,
      submitted: false,
      ignored: false,
    };
    setTaskingRequests(prev => [...prev, nextRequest]);
    logAudit('Priorities', 'Add', 'Added directed-task request row', `Directed-task request ${nextRequest.id}`);
  };

  const isTaskingPriorityEventForRequest = (event: ScheduleEvent, requestId: string) => (
    event.taskingRequestId === requestId || String(event.id || '').startsWith(`tasking-${requestId}-`)
  );

  const taskingPriorityEventMatchesActiveScope = (event: ScheduleEvent): boolean => {
    const eventCodes = getTaskingRequestScopeCodes({
      unitCode: event.taskingUnitCode || event.unitCode || event.fixedCrewUnitCode || event.fixedCrewUnit || event.unit,
      unitCodes: event.taskingUnitCodes,
    });
    if (activeTaskingUnitCodes.length === 0) return true;
    return eventCodes.some(code => activeTaskingUnitCodes.includes(code));
  };

  const removeTaskingPriorityEvents = (requestId: string) => {
    highestPriorityEvents
      .filter(event => isTaskingPriorityEventForRequest(event, requestId))
      .filter(taskingPriorityEventMatchesActiveScope)
      .forEach(event => onDeletePriorityEvent(event.id));
  };

  const isTaskingRequestInHighestPriority = (requestId: string) => (
    highestPriorityEvents.some(event => isTaskingPriorityEventForRequest(event, requestId) && taskingPriorityEventMatchesActiveScope(event))
  );

  useEffect(() => {
    const submittedTaskingRequestIds = new Set(
      visibleTaskingRequests
        .filter(request => request.submitted)
        .map(request => request.id)
    );

    highestPriorityEvents
      .filter(event => (
        (event.isTaskingRequest || event.taskingRequestId || String(event.id || '').startsWith('tasking-')) &&
        taskingPriorityEventMatchesActiveScope(event) &&
        (!event.taskingRequestId || !submittedTaskingRequestIds.has(event.taskingRequestId))
      ))
      .forEach(event => onDeletePriorityEvent(event.id));
  }, [highestPriorityEvents, visibleTaskingRequests, onDeletePriorityEvent, activeTaskingUnitCodes.join('|')]);

  useEffect(() => {
    setTaskingRequests(prev => prev.map(request => (
      taskingRequestMatchesActiveScope(request) && request.submitted && !isTaskingRequestInHighestPriority(request.id)
        ? { ...request, submitted: false, ignored: true }
        : request
    )));
  }, [highestPriorityEvents, activeTaskingUnitCodes.join('|')]);

  const updateTaskingRequest = (id: string, updates: Partial<TaskingRequest>) => {
    const currentRequest = taskingRequests.find(request => request.id === id);
    const isSubmittedEdit = Boolean(
      currentRequest?.submitted &&
      updates.submitted === false &&
      updates.saved === false &&
      updates.ignored !== true
    );
    if (updates.submitted === false && !isSubmittedEdit) {
      removeTaskingPriorityEvents(id);
    }
    const appliedUpdates = isSubmittedEdit
      ? {
          ...updates,
          saved: true,
          submitted: true,
          ignored: false,
        }
      : updates;
    const nextUpdates = isSingleSeatAircraft
      ? {
          ...appliedUpdates,
          flightType: 'Solo' as const,
          crewRequirement: appliedUpdates.crewRequirement || { mode: 'custom' as const, roles: [{ role: 'Pilot', count: 1 }] },
        }
      : appliedUpdates;
    setTaskingRequests(prev => prev.map(request => (
      request.id === id
        ? {
            ...request,
            ...nextUpdates,
            saved: nextUpdates.saved ?? request.saved,
            submitted: nextUpdates.submitted ?? request.submitted,
            ignored: nextUpdates.ignored ?? request.ignored,
          }
        : request
    )));
    if (isSubmittedEdit && currentRequest) {
      const nextRequest: TaskingRequest = {
        ...currentRequest,
        ...nextUpdates,
        saved: nextUpdates.saved ?? currentRequest.saved,
        submitted: nextUpdates.submitted ?? currentRequest.submitted,
        ignored: nextUpdates.ignored ?? currentRequest.ignored,
      };
      onAddPriorityEvents(buildTaskingPriorityEvents(nextRequest));
    }
  };

  const buildTaskingPriorityEvents = (request: TaskingRequest): ScheduleEvent[] => {
    const tasking = request.tasking.trim();
    const abbreviation = Object.entries(taskProfileAbbreviations || {}).find(([profile]) => (
      profile.trim().toLowerCase() === tasking.toLowerCase()
    ))?.[1]?.trim();
    const taskingDisplayLabel = abbreviation || tasking || 'Directed Task';
    const depPoint = request.depPoint.trim().toUpperCase();
    const arrivalPoint = request.arrivalPoint.trim().toUpperCase();
    const aircraftCount = Math.max(1, Math.floor(Number(request.aircraftCount) || 1));
    const isFormation = request.isFormation === true && aircraftCount > 1;
    const formationId = isFormation ? `tasking-formation-${request.id}` : undefined;
    const aircraftConfigId = request.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id;
    const callsignBase = request.callsignBase || defaultUnitCallsign;
    const callsignNumber = Number.isFinite(Number(request.callsignNumber)) ? Number(request.callsignNumber) : 0;
    const eventCallsign = request.callsign || (callsignBase ? buildUnitEventCallsign(callsignBase, callsignNumber) : '');
    const startTime = Number.isFinite(Number(request.takeoff)) ? Number(request.takeoff) : flyingStartTime;
    const eventType = getTaskingScheduleEventType(request.resourceType);
    const flightType = isSingleSeatAircraft || request.flightType === 'Solo' ? 'Solo' : 'Dual';
    const schedulerPriority: TaskingSchedulerPriority = request.schedulerPriority || (request.isMandatory !== false ? 'High' : 'Medium');
    const notes = [
      `Directed task request: ${tasking || 'Directed Task'}`,
      `Date: ${request.date || 'Any build date'}`,
      `Takeoff: ${formatTimeLabel(startTime)}`,
      `Duration: ${request.duration.toFixed(1)}`,
      `Kind: ${getTaskingResourceKindLabel(request.resourceType)}`,
      `Scheduler priority: ${schedulerPriority}`,
      `Dep Point: ${depPoint}`,
      `Arrival Point: ${arrivalPoint}`,
      `Aircraft requested: ${aircraftCount}`,
      isFormation ? 'Formation: Yes' : 'Formation: No',
      `Crew required: ${formatCrewRequirementSummary(request.crewRequirement, aircraftCrewComposition, crewPositionTerminology)}`,
    ].join('\n');

    const priorityRowCount = isFormation ? 1 : aircraftCount;
    return Array.from({ length: priorityRowCount }, (_, index): ScheduleEvent => {
      const aircraftIndex = index + 1;
      return {
        id: isFormation ? `tasking-${request.id}-formation` : `tasking-${request.id}-${aircraftIndex}`,
        date: request.date || '',
        type: eventType,
        instructor: '',
        student: '',
        pilot: '',
        group: isFormation ? `${aircraftCount} Aircraft Formation` : aircraftCount > 1 ? `Aircraft ${aircraftIndex} of ${aircraftCount}` : 'Directed Task',
        flightNumber: taskingDisplayLabel,
        callsign: eventCallsign,
        duration: Math.max(0.1, Number(request.duration) || 0.1),
        startTime,
        resourceId: '',
        color: 'bg-cyan-500/80',
        flightType,
        soloOrDual: flightType,
        locationType: depPoint !== arrivalPoint ? 'Land Away' : 'Local',
        origin: depPoint,
        destination: arrivalPoint,
        isTimeFixed: true,
        isTaskingRequest: true,
        isMandatoryTasking: schedulerPriority === 'High',
        taskingName: tasking,
        taskingDisplayLabel,
        taskingRequestId: request.id,
        taskingUnitCode: request.unitCode || activeTaskingUnitCode,
        taskingUnitCodes: request.unitCodes || activeTaskingUnitCodes,
        unit: request.unitCode || activeTaskingUnitCode,
        unitCode: request.unitCode || activeTaskingUnitCode,
        fixedCrewUnit: request.unitCode || activeTaskingUnitCode,
        fixedCrewUnitCode: request.unitCode || activeTaskingUnitCode,
        taskingAircraftIndex: isFormation ? 1 : aircraftIndex,
        taskingAircraftCount: aircraftCount,
        isFormation,
        formationId,
        formationType: isFormation ? 'Directed Task Formation' : undefined,
        formationPosition: undefined,
        formationSize: isFormation ? aircraftCount : undefined,
        dateCreated: new Date().toISOString(),
        notes,
        priority: schedulerPriority,
        aircraftConfigId,
        acceptableAircraftConfigs: [aircraftConfigId],
        crewRequirement: request.crewRequirement || { mode: 'aircraft_default' },
        pushToNeoBuild: request.pushToNeoBuild !== false,
      };
    });
  };

  const taskingPriorityEventNeedsSync = (expected: ScheduleEvent, actual?: ScheduleEvent): boolean => (
    !actual ||
    actual.date !== expected.date ||
    actual.flightNumber !== expected.flightNumber ||
    actual.taskingName !== expected.taskingName ||
    actual.taskingDisplayLabel !== expected.taskingDisplayLabel ||
    actual.startTime !== expected.startTime ||
    actual.duration !== expected.duration ||
    actual.type !== expected.type ||
    actual.priority !== expected.priority ||
    actual.isMandatoryTasking !== expected.isMandatoryTasking ||
    actual.origin !== expected.origin ||
    actual.destination !== expected.destination ||
    actual.callsign !== expected.callsign ||
    actual.aircraftConfigId !== expected.aircraftConfigId ||
    actual.taskingAircraftCount !== expected.taskingAircraftCount ||
    actual.isFormation !== expected.isFormation ||
    actual.formationId !== expected.formationId ||
    actual.formationPosition !== expected.formationPosition ||
    actual.formationSize !== expected.formationSize ||
    actual.pushToNeoBuild !== expected.pushToNeoBuild ||
    JSON.stringify(actual.crewRequirement || null) !== JSON.stringify(expected.crewRequirement || null)
  );

  useEffect(() => {
    visibleTaskingRequests
      .filter(request => request.submitted && !request.ignored)
      .forEach(request => {
        const expectedEvents = buildTaskingPriorityEvents(request);
        const actualEvents = highestPriorityEvents.filter(event => isTaskingPriorityEventForRequest(event, request.id));
        const needsSync = expectedEvents.length !== actualEvents.length || expectedEvents.some(expected => {
          const expectedIndex = expected.taskingAircraftIndex || 1;
          const actual = actualEvents.find(event => (event.taskingAircraftIndex || 1) === expectedIndex);
          return taskingPriorityEventNeedsSync(expected, actual);
        });
        if (needsSync) {
          onAddPriorityEvents(expectedEvents);
        }
      });
  }, [visibleTaskingRequests, highestPriorityEvents, activeTaskingUnitCodes.join('|')]);

  const setTaskingSchedulerPriority = (id: string, schedulerPriority: TaskingSchedulerPriority) => {
    const request = taskingRequests.find(item => item.id === id);
    if (!request) return;
    const nextRequest: TaskingRequest = {
      ...request,
      schedulerPriority,
      isMandatory: schedulerPriority === 'High',
      saved: true,
      submitted: true,
      ignored: false,
    };
    removeTaskingPriorityEvents(id);
    const priorityEvents = buildTaskingPriorityEvents(nextRequest);
    onAddPriorityEvents(priorityEvents);
    setTaskingRequests(prev => prev.map(item => item.id === id ? nextRequest : item));
    logAudit('Priorities', 'Edit', 'Set directed-task request scheduler priority', `${request.tasking || 'Untitled directed-task request'}: ${schedulerPriority}`);
  };

  const removeTaskingRequest = (id: string) => {
    const removed = taskingRequests.find(request => request.id === id);
    removeTaskingPriorityEvents(id);
    setTaskingRequests(prev => prev.filter(request => request.id !== id));
    logAudit('Priorities', 'Delete', 'Removed directed-task request', removed?.tasking || id);
  };

  const saveTaskingRequest = (id: string) => {
    const request = taskingRequests.find(item => item.id === id);
    if (!request) return;
    updateTaskingRequest(id, { saved: true, submitted: false, ignored: false });
    logAudit('Priorities', 'Save', 'Saved directed-task request', `${request.tasking || 'Untitled directed-task request'} on ${request.date || 'any build date'}`);
  };

  const submitTaskingRequest = async (id: string) => {
    const request = taskingRequests.find(item => item.id === id);
    if (!request) return;
    const priorityEvents = buildTaskingPriorityEvents(request);
    onAddPriorityEvents(priorityEvents);
    updateTaskingRequest(id, { saved: true, submitted: true, ignored: false });
    logAudit('Priorities', 'Submit', 'Submitted directed-task request', `${request.tasking || 'Untitled directed-task request'} on ${request.date || 'any build date'} (${priorityEvents.length} priority event${priorityEvents.length === 1 ? '' : 's'})`);
  };

  const ignoreTaskingRequest = (id: string) => {
    const request = taskingRequests.find(item => item.id === id);
    if (!request) return;
    removeTaskingPriorityEvents(id);
    updateTaskingRequest(id, { saved: true, submitted: false, ignored: true });
    logAudit('Priorities', 'Ignore', 'Ignored directed-task request', `${request.tasking || 'Untitled directed-task request'} on ${request.date || 'any build date'}`);
  };

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
    setStaffCurrencyPicSelections(prev => {
      const validIds = new Set(staffCurrencyRows.map(row => row.personKey));
      const next = Object.fromEntries(Object.entries(prev).filter(([personKey]) => validIds.has(personKey)));
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [staffCurrencyRows]);

  useEffect(() => {
    setStaffCurrencyPicSelections(prev => {
      let changed = false;
      const next = { ...prev };
      staffCurrencyRows.forEach(row => {
        if (!staffCurrencySelection.has(row.personKey)) return;
        if (next[row.personKey]) return;
        const defaultPic = getDefaultStaffCurrencyPicName(row.instructor);
        if (!defaultPic) return;
        next[row.personKey] = defaultPic;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [staffCurrencyRows, staffCurrencySelection, fixedCrewPicQualification, normalisedStaffQualificationCatalogue]);

  const toggleSetValue = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const applyCurrencyProfileToDraftEvent = (draftId: string, profileName: string) => {
    const profile = currencyProfilesForContext.find(candidate => (
      String(candidate.name || candidate.currency || '').trim() === profileName
      || String(candidate.currency || '').trim() === profileName
    ));
    setCurrencyDraftEvents(prev => prev.map(event => {
      if (event.id !== draftId) return event;
      if (!profile) return { ...event, currencyProfileName: profileName };
      const configId = getCurrencyProfileConfigId(profile);
      return {
        ...event,
        currencyProfileName: String(profile.name || profile.currency || '').trim(),
        currencyProfileCode: String(profile.code || '').trim().toUpperCase().slice(0, 8),
        selectedCurrencies: profile.currency ? [profile.currency] : event.selectedCurrencies,
        aircraftConfigId: configId || event.aircraftConfigId,
        aircraftCount: Math.max(1, Number(profile.aircraftCount) || 1),
      };
    }));
  };

  const buildCurrencyDraftEvents = (
    audience: 'trainee' | 'staff',
    people: { idNumber: number; personKey: string; name: string; fullName?: string; course?: string; rank?: string; dueCurrencies: string[]; picName?: string; fixedCrewGroupKey?: string; fixedCrewDisplayLabel?: string }[],
    includeFlights: boolean,
    includeSims: boolean,
    crewMode: 'withInstructor' | 'solo' | 'withOtherPilot'
  ) => {
    const events: typeof currencyDraftEvents = [];
    const defaultProfile = currencyProfilesForContext[0] || null;
    const defaultProfileName = defaultProfile ? String(defaultProfile.name || defaultProfile.currency || '').trim() : '';
    const defaultProfileCode = defaultProfile ? String(defaultProfile.code || '').trim().toUpperCase().slice(0, 8) : '';
    const defaultProfileConfigId = defaultProfile ? getCurrencyProfileConfigId(defaultProfile) : null;
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
          currencyProfileName: defaultProfileName,
          currencyProfileCode: defaultProfileCode,
          crewMode,
          dueCurrencies: person.dueCurrencies,
          selectedCurrencies: defaultProfile?.currency ? [defaultProfile.currency] : [],
          aircraftConfigId: defaultProfileConfigId || BASE_AIRCRAFT_CONFIG.id,
          aircraftCount: Math.max(1, Number(defaultProfile?.aircraftCount) || 1),
          crewRequirement: { mode: 'aircraft_default' },
          picName: person.picName || '',
          fixedCrewGroupKey: person.fixedCrewGroupKey || '',
          fixedCrewDisplayLabel: person.fixedCrewDisplayLabel || '',
          formationCrew: [],
          selected: true,
          pushed: false,
        });
      });
    });
    return events;
  };

  const buildCurrencyPriorityEventsFromDrafts = (drafts: typeof currencyDraftEvents): ScheduleEvent[] => {
    return drafts.flatMap((draft, index) => {
      const isSolo = draft.crewMode === 'solo';
      const picName = String(draft.picName || '').trim();
      const startBase = draft.eventType === 'flight' ? flyingStartTime : ftdStartTime;
      const selectedCurrencyText = draft.selectedCurrencies.length > 0 ? draft.selectedCurrencies.join(', ') : '';
      const aircraftConfigId = draft.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id;
      const eventCode = String(draft.currencyProfileCode || '').trim().toUpperCase().slice(0, 8) || 'CURR';
      const aircraftCount = Math.max(1, Math.floor(Number(draft.aircraftCount) || 1));
      const formationId = aircraftCount > 1 ? `currency-formation-${draft.id}-${uuidv4()}` : undefined;
      return Array.from({ length: aircraftCount }, (_, aircraftIndex) => {
        const formationAssignment = aircraftIndex === 0 ? null : draft.formationCrew?.[aircraftIndex - 1];
        const assignedPic = String(formationAssignment?.crewIndividual || picName || '').trim();
        const assignedCrew = String(formationAssignment?.crewDisplayLabel || formationAssignment?.crewGroupKey || draft.fixedCrewDisplayLabel || draft.fixedCrewGroupKey || '').trim();
        return {
          id: `currency-${draft.audience}-${draft.eventType}-${draft.personId}-${aircraftIndex + 1}-${buildDfpDate}-${uuidv4()}`,
          currencyDraftId: draft.id,
          date: buildDfpDate,
          type: draft.eventType,
          instructor: '',
          student: draft.personName,
          pilot: assignedPic || (isSolo ? draft.personName : ''),
          fixedCrewPic: assignedPic || undefined,
          fixedCrewGroup: assignedCrew || undefined,
          flightNumber: eventCode,
          duration: isFixedCrewModel ? defaultCurrencyDuration : draft.eventType === 'flight' ? 1.2 : 1.5,
          startTime: startBase,
          resourceId: '',
          color: 'bg-amber-500/80',
          flightType: isSolo ? 'Solo' : 'Dual',
          locationType: 'Local',
          origin: school,
          destination: school,
          isTimeFixed: false,
          eventCategory: 'currency',
          currency: selectedCurrencyText || 'Currency',
          currencyAudience: draft.audience,
          priority: 'Medium',
          notes: [
            selectedCurrencyText ? `Currency event required: ${selectedCurrencyText}` : 'Currency event required',
            aircraftCount > 1 ? `Aircraft requested: ${aircraftCount}` : '',
          ].filter(Boolean).join('\n'),
          crewRequirement: draft.crewRequirement || { mode: 'aircraft_default' },
          aircraftCount,
          formationId,
          formationPosition: aircraftCount > 1 ? aircraftIndex + 1 : undefined,
          formationSize: aircraftCount > 1 ? aircraftCount : undefined,
          taskingAircraftIndex: aircraftCount > 1 ? aircraftIndex + 1 : undefined,
          taskingAircraftCount: aircraftCount > 1 ? aircraftCount : undefined,
          ...(draft.eventType === 'flight' ? {
            aircraftConfigId,
            acceptableAircraftConfigs: [aircraftConfigId],
          } : {}),
        } as ScheduleEvent;
      });
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
    const selectedRows = staffCurrencyRows.filter(row => staffCurrencySelection.has(row.personKey));
    const missingPicRows = selectedRows.filter(row => !(staffCurrencyPicSelections[row.personKey] || getDefaultStaffCurrencyPicName(row.instructor)));
    if (missingPicRows.length > 0) {
      void showDarkAlert(`Select a PIC for ${missingPicRows.map(row => row.instructor.name).join(', ')} before adding to the consolidated list.`, 'PIC Required', 'warning');
      return;
    }
    const selectedPeople = selectedRows
      .map(row => {
        const fixedCrewGroup = getStaffCurrencyFixedCrewGroup(row.instructor);
        const selectedPic = staffCurrencyPicSelections[row.personKey] || getDefaultStaffCurrencyPicName(row.instructor);
        return {
          idNumber: row.instructor.idNumber,
          personKey: row.personKey,
          name: row.instructor.name,
          rank: row.instructor.rank,
          dueCurrencies: row.dueCurrencies,
          picName: selectedPic,
          fixedCrewGroupKey: fixedCrewGroup?.key || '',
          fixedCrewDisplayLabel: fixedCrewGroup?.label || '',
        };
      });
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

  const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const renderSctRequestTable = (type: 'flight' | 'ftd', requests: SctRequest[]) => {
      
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

    const crewRequirementFromPreset = (preset: CrewRequirementPreset): CrewRequirement => (
      preset.kind === 'standard'
        ? { mode: 'aircraft_default' }
        : { mode: 'custom', roles: preset.roles || [] }
    );
    const crewRequirementPresetIdFor = (requirement?: CrewRequirement): string => {
      const normalised = normaliseCrewRequirement(requirement);
      if (normalised.mode === 'aircraft_default') {
        return crewRequirementPresets.find(preset => preset.kind === 'standard')?.id || 'standard-aircraft-crew';
      }
      const signature = getCrewRequirementSignature(requirement);
      return crewRequirementPresets.find(preset => (
        preset.kind === 'alternate'
        && getCrewRequirementSignature({ mode: 'custom', roles: preset.roles || [] }) === signature
      ))?.id || '';
    };
    const crewRequirementPresetsByUnit = crewRequirementPresets.reduce((groups, preset) => {
      const groupLabel = String(preset.groupLabel || 'Unit').trim() || 'Unit';
      groups.set(groupLabel, [...(groups.get(groupLabel) || []), preset]);
      return groups;
    }, new Map<string, CrewRequirementPreset[]>());
    const getRequestAvailabilityWindow = (request: SctRequest): FixedCrewAvailabilityWindow => {
      const start = timeFieldToHours(request.requestedTime, type === 'ftd' ? ftdStartTime : flyingStartTime) || 0;
      return {
        date: request.dateRequested || buildDfpDate,
        start: Math.max(0, start),
        end: Math.min(24, start + defaultCurrencyDuration),
        resourceKind: type === 'flight' ? 'flight' : 'sim',
      };
    };
    const formatRequestCrewOptionLabel = (group: { label: string; members: Instructor[] }, window: FixedCrewAvailabilityWindow): string => (
      appendUnavailableLabel(group.label, summariseCrewUnavailability(group.members, window))
    );
    const formatRequestPicOptionLabel = (member: Instructor, window: FixedCrewAvailabilityWindow): string => (
      appendUnavailableLabel(member.name, getStaffUnavailabilityStatus(member, window).reason)
    );
    const applyCurrencyProfile = (request: SctRequest, eventValue: string) => {
      const requestId = request.id;
      const profile = currencyProfilesForContext.find(candidate => (
        String(candidate.name || candidate.currency || '').trim() === eventValue
        || String(candidate.currency || '').trim() === eventValue
      ));
      const profileAcceptableConfigs = Array.isArray(profile?.acceptableAircraftConfigs) && profile.acceptableAircraftConfigs.length > 0
        ? profile.acceptableAircraftConfigs
        : profile?.config
          ? [profile.config]
          : [];
      const selectedDayNight = profile?.dayNight || (/\bnight\b/i.test(eventValue) ? 'Night' : undefined);
      const requestedTimeUpdates = selectedDayNight === 'Night' && (!request.requestedTime || request.requestedTime === '15:00')
        ? { requestedTime: formatTime(commenceNightFlying) }
        : {};
      if (!profile) {
        if (Object.keys(requestedTimeUpdates).length > 0) {
          onPatchSctRequest(requestId, { event: eventValue, dayNight: selectedDayNight, ...requestedTimeUpdates }, type);
        } else {
          onUpdateSctRequest(requestId, 'event', eventValue, type);
        }
        return;
      }
      const configId = getCurrencyProfileConfigId(profile);
      onPatchSctRequest(requestId, {
        event: String(profile.name || profile.currency || '').trim(),
        eventCode: String(profile.code || '').trim().toUpperCase().slice(0, 8),
        currency: profile.currency,
        dayNight: selectedDayNight || 'Day',
        flightType: profile.flightType || request.flightType || 'Dual',
        aircraftCount: Math.max(1, Math.floor(Number(profile.aircraftCount) || 1)),
        formationCrew: [],
        ...requestedTimeUpdates,
        ...(configId ? { aircraftConfigId: configId } : {}),
        ...(profileAcceptableConfigs.length > 0 ? { acceptableAircraftConfigs: profileAcceptableConfigs } : {}),
        ...(isFixedCrewModel && profile.crew ? { crewMember: profile.crew } : {}),
      }, type);
    };
    const isFlightSchoolCurrencyRequestTable = priorityAllocationModel === 'flight_school';
    const sctTableMinWidthClass = isFlightSchoolCurrencyRequestTable ? 'min-w-[1196px]' : 'min-w-[1298px]';
    const sctTableHeaderColumnsClass = isFlightSchoolCurrencyRequestTable
      ? 'grid-cols-[136px_190px_94px_150px_82px_113px_113px_96px_96px_66px_60px]'
      : 'grid-cols-[136px_190px_94px_140px_150px_74px_105px_105px_90px_88px_66px_60px]';
    const sctTableBodyColumnsClass = isFlightSchoolCurrencyRequestTable
      ? 'grid-cols-[136px_190px_94px_150px_82px_113px_113px_96px_96px_66px_60px]'
      : 'grid-cols-[136px_190px_94px_140px_150px_74px_105px_105px_90px_88px_66px_60px]';
    const sctRequestKindLabel = type === 'ftd' ? 'Simulator' : 'Flight';
    const getSctEditKey = (request: SctRequest) => `${type}:${request.id}`;
    const toggleSctRequestEditing = (request: SctRequest) => {
      const key = getSctEditKey(request);
      setEditingSctRequestIds(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    };
    const unstageSpecificCurrencyRequest = (request: SctRequest) => {
      const requestDraftId = `specific-currency-${type}-${request.id}`;
      setCurrencyDraftEvents(prev => prev.filter(event => event.id !== requestDraftId));
      highestPriorityEvents
        .filter(event => event.sctRequestId === request.id || event.currencyDraftId === requestDraftId)
        .forEach(event => onDeletePriorityEvent(event.id));
      onPatchSctRequest(request.id, { submitted: false, includeInBuild: false, pushToNeoBuild: false }, type);
    };
    const canSubmitSpecificCurrencyRequest = (request: SctRequest): boolean => {
      const aircraftCount = Math.max(1, Math.floor(Number(request.aircraftCount) || 1));
      const formationAssignments = Array.from({ length: Math.max(0, aircraftCount - 1) }, (_, index) => request.formationCrew?.[index] || {});
      const isFlightSchoolCurrencyRequest = priorityAllocationModel === 'flight_school';
      const hasFlightSchoolSecondPilotOrSolo = !isFlightSchoolCurrencyRequest || Boolean(String(request.crewMember || '').trim());
      const formationAssignmentsComplete = !isFixedCrewModel || aircraftCount <= 1 || formationAssignments.every(assignment => (
        (assignment.crewGroupKey || assignment.crewDisplayLabel) && assignment.crewIndividual
      ));
      return Boolean(request.event && (isFixedCrewModel ? (request.crewGroupKey || request.crewDisplayLabel) : request.name) && hasFlightSchoolSecondPilotOrSolo && formationAssignmentsComplete);
    };
    const scheduleSpecificCurrencyRequest = (request: SctRequest) => {
      if (!canSubmitSpecificCurrencyRequest(request)) return;
      const selectedCrewGroup = fixedCrewRequestCrewGroups.find(group => (
        group.key === request.crewGroupKey
        || (group.crewValue === String(request.crewGroup || '').replace(/^CREW\s*/i, '').trim().toUpperCase()
          && group.unitCode === String(request.crewUnitCode || '').trim().toUpperCase())
      ));
      const aircraftCount = Math.max(1, Math.floor(Number(request.aircraftCount) || 1));
      const formationAssignments = Array.from({ length: Math.max(0, aircraftCount - 1) }, (_, index) => request.formationCrew?.[index] || {});
      const isFlightSchoolCurrencyRequest = priorityAllocationModel === 'flight_school';
      const flightSchoolSecondPilot = String(request.crewMember || '').trim();
      const profile = currencyProfilesForContext.find(candidate => (
        String(candidate.name || candidate.currency || '').trim() === String(request.event || '').trim()
        || String(candidate.currency || '').trim() === String(request.event || '').trim()
      ));
      const profileCode = String(request.eventCode || profile?.code || '').trim().toUpperCase().slice(0, 8);
      const requestDraftId = `specific-currency-${type}-${request.id}`;
      const displayName = isFixedCrewModel
        ? (request.crewIndividual || selectedCrewGroup?.label || request.crewDisplayLabel || request.crewGroup || 'Fixed Crew')
        : (request.name || 'Currency request');
      const flightSchoolIsSolo = isFlightSchoolCurrencyRequest && flightSchoolSecondPilot === 'Solo';
      const draftEvent = {
        id: requestDraftId,
        audience: 'staff' as const,
        personId: 0,
        personKey: request.id,
        personName: displayName,
        eventType: type,
        currencyProfileName: String(request.event || '').trim(),
        currencyProfileCode: profileCode,
        crewMode: flightSchoolIsSolo || request.flightType === 'Solo' ? 'solo' as const : 'withOtherPilot' as const,
        dueCurrencies: request.currency ? [request.currency] : currencyNames,
        selectedCurrencies: request.currency ? [request.currency] : [],
        aircraftConfigId: request.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id,
        aircraftCount,
        crewRequirement: request.crewRequirement || { mode: 'aircraft_default' as const },
        picName: isFixedCrewModel
          ? (request.crewIndividual || '')
          : flightSchoolIsSolo
            ? ''
            : flightSchoolSecondPilot,
        fixedCrewGroupKey: request.crewGroupKey || selectedCrewGroup?.key || '',
        fixedCrewDisplayLabel: selectedCrewGroup?.label || request.crewDisplayLabel || '',
        formationCrew: formationAssignments.map(assignment => ({
          crewGroup: assignment.crewGroup || '',
          crewGroupKey: assignment.crewGroupKey || '',
          crewUnitCode: assignment.crewUnitCode || '',
          crewDisplayLabel: assignment.crewDisplayLabel || '',
          crewIndividual: assignment.crewIndividual || '',
        })),
        selected: true,
        pushed: false,
      };
      if (isFixedCrewModel) {
        highestPriorityEvents
          .filter(event => event.currencyDraftId === requestDraftId)
          .forEach(event => onDeletePriorityEvent(event.id));
        const priorityEvents = buildCurrencyPriorityEventsFromDrafts([draftEvent])
          .map(event => ({
            ...event,
            priority: request.priority || event.priority,
          }));
        onAddPriorityEvents(priorityEvents);
        onSubmitSctRequest(request.id, type);
        logAudit('Priorities', 'Submit', 'Submitted specific currency request to Highest Priority', `${displayName} ${request.event || 'Currency'} (${priorityEvents.length} event${priorityEvents.length === 1 ? '' : 's'})`);
        return;
      }
      setCurrencyDraftEvents(prev => {
        if (prev.some(event => event.id === requestDraftId)) return prev;
        return [...prev, draftEvent];
      });
      onSubmitSctRequest(request.id, type);
    };
    const setAllSctRequestSchedule = (scheduled: boolean) => {
      requests.forEach(request => {
        if (scheduled) {
          scheduleSpecificCurrencyRequest(request);
          return;
        }
        unstageSpecificCurrencyRequest(request);
      });
    };
    
      return (
      <div className={buildPriorityTableShellClass}>
          <div className={`${sctTableMinWidthClass} space-y-3`}>
              <div className={`${buildPriorityTableHeaderClass} ${sctTableHeaderColumnsClass}`}>
                  <span className={`${buildPriorityTableHeaderCellClass} flex flex-col items-center justify-center gap-2`}>
                      <span>Schedule</span>
                      <span className="inline-flex overflow-hidden rounded-md border border-slate-600 bg-slate-950 text-[10px] font-black normal-case tracking-normal">
                          <button type="button" onClick={() => setAllSctRequestSchedule(true)} className="px-1.5 py-0.5 text-cyan-100 hover:bg-cyan-500/15">All</button>
                          <button type="button" onClick={() => setAllSctRequestSchedule(false)} className="border-l border-slate-600 px-1.5 py-0.5 text-slate-200 hover:bg-slate-700/60">None</button>
                      </span>
                  </span>
                  <span className={buildPriorityTableHeaderCellClass}>Crew</span>
                  <span className={buildPriorityTableHeaderCellClass}>Kind</span>
                  <span className={buildPriorityTableHeaderCellClass}>Event</span>
                  {!isFlightSchoolCurrencyRequestTable && <span className={buildPriorityTableHeaderCellClass}>Crew Composition</span>}
                  <span className={buildPriorityTableHeaderCellClass}>Aircraft</span>
                  <span className={buildPriorityTableHeaderCellClass}>Currency Expire</span>
                  <span className={buildPriorityTableHeaderCellClass}>Date Requested</span>
                  <span className={buildPriorityTableHeaderCellClass}>Days</span>
                  <span className={buildPriorityTableHeaderCellClass}>Priority</span>
                  <span className={buildPriorityTableHeaderCellClass}>Edit</span>
                  <span className={buildPriorityTableHeaderCellClass} aria-label="Delete"></span>
              </div>
              {requests.map(req => {
                  const expiryInfo = calculateDaysToExpire(req.currencyExpire);
                  const tileLabelClass = 'mb-1 hidden text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500';
                  const tileBaseClass = `${buildPriorityTableCellClass} flex h-full min-h-[52px] w-full min-w-0 flex-col justify-center bg-cyan-950/80 text-left text-[12px]`;
                  const controlClass = 'w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-[12px] text-white focus:ring-sky-500';
                  const selectedCrewGroup = fixedCrewRequestCrewGroups.find(group => (
                    group.key === req.crewGroupKey
                    || (group.crewValue === String(req.crewGroup || '').replace(/^CREW\s*/i, '').trim().toUpperCase()
                      && group.unitCode === String(req.crewUnitCode || '').trim().toUpperCase())
                  ));
                  const selectedCrewPicCandidates = (selectedCrewGroup?.members || []).filter(member => staffHasPicQualification(member));
                  const selectedCrewPicNames = new Set(selectedCrewPicCandidates.map(member => member.name));
                  const requestAvailabilityWindow = getRequestAvailabilityWindow(req);
                  const selectedCrewUnavailableSummary = selectedCrewGroup
                    ? summariseCrewUnavailability(selectedCrewGroup.members, requestAvailabilityWindow)
                    : '';
                  const otherPicCandidates = selectedCrewGroup
                    ? allPicQualifiedStaff
                        .filter(staff => !selectedCrewPicNames.has(staff.name))
                        .filter(staff => {
                          const staffUnitCode = normaliseTaskingUnitCode(staff.unit || activeUnitCode || school);
                          return !selectedCrewGroup.unitCode || staffUnitCode === selectedCrewGroup.unitCode;
                        })
                        .filter(staff => !String(staff.crew || '').trim())
                    : [];
                  const aircraftCount = Math.max(1, Math.floor(Number(req.aircraftCount) || 1));
                  const formationAssignments = Array.from({ length: Math.max(0, aircraftCount - 1) }, (_, index) => req.formationCrew?.[index] || {});
                  const isFlightSchoolCurrencyRequest = priorityAllocationModel === 'flight_school';
                  const flightSchoolSecondPilot = String(req.crewMember || '').trim();
                  const updateFormationAssignment = (index: number, updates: Partial<FixedCrewFormationAssignment>) => {
                    const nextAssignments = formationAssignments.map((assignment, assignmentIndex) => (
                      assignmentIndex === index ? { ...assignment, ...updates } : assignment
                    ));
                    onPatchSctRequest(req.id, { formationCrew: nextAssignments }, type);
                  };
                  const canSubmitRequest = canSubmitSpecificCurrencyRequest(req);
                  const isEditingRequest = editingSctRequestIds.has(getSctEditKey(req));
                  const stageSpecificCurrencyRequest = () => scheduleSpecificCurrencyRequest(req);
                  const crewDisplay = isFixedCrewModel
                    ? (selectedCrewGroup?.label || req.crewDisplayLabel || req.crewGroup || 'TBA')
                    : (req.name || 'TBA');
                  const picDisplay = isFixedCrewModel
                    ? (req.crewIndividual || 'TBA')
                    : isFlightSchoolCurrencyRequest
                      ? (flightSchoolSecondPilot || 'TBA')
                      : 'N/A';
                  const crewTopDisplay = isFixedCrewModel ? picDisplay : crewDisplay;
                  const crewSecondDisplay = isFixedCrewModel
                    ? crewDisplay
                    : isFlightSchoolCurrencyRequest
                      ? (flightSchoolSecondPilot === 'Solo' || req.flightType === 'Solo' ? 'Solo' : flightSchoolSecondPilot || 'TBA')
                      : 'N/A';
                  const eventDisplay = String(req.event || req.currency || 'Select profile').trim();
                  return (
                      <div key={req.id} className="overflow-visible rounded-xl border border-cyan-500/25 bg-slate-900/45 shadow-lg shadow-black/10">
                              <div className={`grid auto-rows-fr ${sctTableBodyColumnsClass} items-stretch gap-0`}>
                                  <div className={`${buildPriorityTableCellClass} flex items-center justify-center bg-cyan-950/80`}>
                                      <div className="inline-flex items-center justify-center gap-1 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[12px] font-semibold text-slate-100">
                                          <label className={`inline-flex items-center gap-1 text-[12px] leading-none ${canSubmitRequest ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                              <input
                                                  type="radio"
                                                  name={`sct-schedule-${type}-${req.id}`}
                                                  checked={req.submitted === true}
                                                  disabled={!canSubmitRequest}
                                                  onChange={stageSpecificCurrencyRequest}
                                                  className="h-4 w-4 accent-cyan-400"
                                              />
                                              Y
                                          </label>
                                          <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] leading-none">
                                              <input
                                                  type="radio"
                                                  name={`sct-schedule-${type}-${req.id}`}
                                                  checked={req.submitted !== true}
                                                  onChange={() => unstageSpecificCurrencyRequest(req)}
                                                  className="h-4 w-4 accent-cyan-400"
                                              />
                                              N
                                          </label>
                                      </div>
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Crew</div>
                                      {!isEditingRequest ? (
                                        <div className="min-w-0 space-y-0.5 leading-snug">
                                          <div className="truncate font-semibold text-cyan-100" title={crewTopDisplay}>{crewTopDisplay}</div>
                                          <div className="truncate text-slate-100" title={crewSecondDisplay}>{crewSecondDisplay}</div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {isFixedCrewModel ? (
                                            <>
                                              <div className={aircraftCount > 1 ? 'grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2' : ''}>
                                                {aircraftCount > 1 && <div className="text-center text-[10px] font-bold text-sky-300">1</div>}
                                                <select
                                                    value={req.crewIndividual || ''}
                                                    onChange={e => {
                                                        onPatchSctRequest(req.id, {
                                                            crewIndividual: e.target.value,
                                                            name: e.target.value,
                                                        }, type);
                                                    }}
                                                    disabled={!selectedCrewGroup}
                                                    className={controlClass}
                                                >
                                                    <option value="">{selectedCrewGroup ? 'Select PIC' : 'Select crew first'}</option>
                                                    {selectedCrewPicCandidates.length > 0 && (
                                                        <optgroup label={selectedCrewGroup?.label || 'Selected Crew'}>
                                                            {selectedCrewPicCandidates.map(member => (
                                                                <option key={member.id || member.idNumber || member.name} value={member.name}>{formatRequestPicOptionLabel(member, requestAvailabilityWindow)}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {otherPicCandidates.length > 0 && (
                                                        <optgroup label="OTHER">
                                                            {otherPicCandidates.map(member => (
                                                                <option key={member.id || member.idNumber || member.name} value={member.name}>{formatRequestPicOptionLabel(member, requestAvailabilityWindow)}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                              </div>
                                              <div className={aircraftCount > 1 ? 'grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2' : ''}>
                                                {aircraftCount > 1 && <div className="text-center text-[10px] font-bold text-sky-300">1</div>}
                                                <select
                                                    value={selectedCrewGroup?.key || ''}
                                                    onChange={e => {
                                                        const group = fixedCrewRequestCrewGroups.find(candidate => candidate.key === e.target.value);
                                                        const picCandidates = (group?.members || []).filter(member => staffHasPicQualification(member));
                                                        const defaultPic = picCandidates.length === 1 ? picCandidates[0].name : '';
                                                        onPatchSctRequest(req.id, {
                                                            crewGroupKey: group?.key || '',
                                                            crewGroup: group?.crewValue || '',
                                                            crewUnitCode: group?.unitCode || '',
                                                            crewDisplayLabel: group?.label || '',
                                                            crewIndividual: defaultPic,
                                                            name: defaultPic,
                                                        }, type);
                                                    }}
                                                    className={controlClass}
                                                >
                                                    <option value="">Select crew</option>
                                                    {Array.from(fixedCrewRequestCrewGroupsByUnit.entries()).map(([unitCode, groups]) => (
                                                        <optgroup key={unitCode} label={unitCode}>
                                                            {groups.map(group => (
                                                                <option key={group.key} value={group.key}>{formatRequestCrewOptionLabel(group, requestAvailabilityWindow)}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                {selectedCrewUnavailableSummary && (
                                                  <div className="rounded border border-red-500/30 bg-red-950/25 px-2 py-1 text-[10px] font-semibold leading-snug text-red-200">
                                                    {selectedCrewUnavailableSummary}
                                                  </div>
                                                )}
                                              </div>
                                              {aircraftCount > 1 && formationAssignments.map((assignment, assignmentIndex) => {
                                                const assignmentCrewGroup = fixedCrewRequestCrewGroups.find(group => (
                                                  group.key === assignment.crewGroupKey
                                                  || (group.crewValue === String(assignment.crewGroup || '').replace(/^CREW\s*/i, '').trim().toUpperCase()
                                                    && group.unitCode === String(assignment.crewUnitCode || '').trim().toUpperCase())
                                                ));
                                                const assignmentPicCandidates = (assignmentCrewGroup?.members || []).filter(member => staffHasPicQualification(member));
                                                return (
                                                  <div key={`${req.id}-formation-crew-combined-${assignmentIndex}`} className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
                                                    <div className="pt-1 text-center text-[10px] font-bold text-sky-300">{assignmentIndex + 2}</div>
                                                    <div className="space-y-2">
                                                      <select
                                                        value={assignment.crewIndividual || ''}
                                                        onChange={e => updateFormationAssignment(assignmentIndex, { crewIndividual: e.target.value })}
                                                        disabled={!assignmentCrewGroup}
                                                        className={controlClass}
                                                      >
                                                        <option value="">{assignmentCrewGroup ? 'Select PIC' : 'Select crew first'}</option>
                                                        {assignmentPicCandidates.map(member => (
                                                          <option key={member.id || member.idNumber || member.name} value={member.name}>{formatRequestPicOptionLabel(member, requestAvailabilityWindow)}</option>
                                                        ))}
                                                      </select>
                                                      <select
                                                        value={assignmentCrewGroup?.key || ''}
                                                        onChange={e => {
                                                          const group = fixedCrewRequestCrewGroups.find(candidate => candidate.key === e.target.value);
                                                          const picCandidates = (group?.members || []).filter(member => staffHasPicQualification(member));
                                                          const defaultPic = picCandidates.length === 1 ? picCandidates[0].name : '';
                                                          updateFormationAssignment(assignmentIndex, {
                                                            crewGroupKey: group?.key || '',
                                                            crewGroup: group?.crewValue || '',
                                                            crewUnitCode: group?.unitCode || '',
                                                            crewDisplayLabel: group?.label || '',
                                                            crewIndividual: defaultPic,
                                                          });
                                                        }}
                                                        className={controlClass}
                                                      >
                                                        <option value="">Select crew</option>
                                                        {Array.from(fixedCrewRequestCrewGroupsByUnit.entries()).map(([unitCode, groups]) => (
                                                          <optgroup key={unitCode} label={unitCode}>
                                                            {groups.map(group => (
                                                              <option key={group.key} value={group.key}>{formatRequestCrewOptionLabel(group, requestAvailabilityWindow)}</option>
                                                            ))}
                                                          </optgroup>
                                                        ))}
                                                      </select>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </>
                                          ) : (
                                            <>
                                              <select
                                                  value={req.name}
                                                  onChange={e => {
                                                      const nextName = e.target.value;
                                                      onPatchSctRequest(req.id, {
                                                          name: nextName,
                                                          ...(req.crewMember === nextName ? { crewMember: '', flightType: 'Dual' as const } : {}),
                                                      }, type);
                                                  }}
                                                  className={controlClass}
                                              >
                                                  <option value="">{isFlightSchoolCurrencyRequest ? 'Select PIC' : `Select ${instructorLabel.toLowerCase()}`}</option>
                                                  {instructorNames.map(name => <option key={name} value={name}>{name}</option>)}
                                              </select>
                                              {isFlightSchoolCurrencyRequest ? (
                                                <select
                                                    value={flightSchoolSecondPilot}
                                                    onChange={e => {
                                                        const nextSecondPilot = e.target.value;
                                                        onPatchSctRequest(req.id, {
                                                            crewMember: nextSecondPilot,
                                                            flightType: nextSecondPilot === 'Solo' ? 'Solo' : 'Dual',
                                                        }, type);
                                                    }}
                                                    className={controlClass}
                                                >
                                                    <option value="">Select second pilot / Solo</option>
                                                    <option value="Solo">Solo</option>
                                                    {instructorNames
                                                        .filter(name => name !== req.name)
                                                        .map(name => <option key={name} value={name}>{name}</option>)}
                                                </select>
                                              ) : (
                                                <div className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-500">N/A</div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Kind</div>
                                      <div className="truncate font-semibold text-slate-100" title={sctRequestKindLabel}>{sctRequestKindLabel}</div>
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Event</div>
                                      {!isEditingRequest ? (
                                        <div className="truncate font-semibold text-slate-100" title={eventDisplay}>{eventDisplay}</div>
                                      ) : <select value={req.event} onChange={e => applyCurrencyProfile(req, e.target.value)} className={controlClass}>
                                          <option value="">Select profile</option>
                                          {sctEvents.map(e => <option key={e} value={e}>{currencyProfileNameLabels[e] || e}</option>)}
                                      </select>}
                                  </div>
                                  {!isFlightSchoolCurrencyRequest && (
                                      <div className={tileBaseClass}>
                                          <div className={tileLabelClass}>Crew Composition</div>
                                          {!isEditingRequest ? (
                                            <div className="truncate text-slate-100" title={crewRequirementPresetIdFor(req.crewRequirement) || 'A/C default'}>{crewRequirementPresetIdFor(req.crewRequirement) || 'A/C default'}</div>
                                          ) : <select
                                              value={crewRequirementPresetIdFor(req.crewRequirement)}
                                              onChange={e => {
                                                  const preset = crewRequirementPresets.find(candidate => candidate.id === e.target.value);
                                                  if (!preset) return;
                                                  onPatchSctRequest(req.id, { crewRequirement: crewRequirementFromPreset(preset) }, type);
                                              }}
                                              className={controlClass}
                                          >
                                              <option value="">Select composition</option>
                                              {Array.from(crewRequirementPresetsByUnit.entries()).map(([unitCode, presets]) => (
                                                  <optgroup key={unitCode} label={unitCode}>
                                                      {presets.map(preset => (
                                                          <option key={preset.id} value={preset.id}>{preset.label}</option>
                                                      ))}
                                                  </optgroup>
                                              ))}
                                          </select>}
                                      </div>
                                  )}
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>No. of A/C</div>
                                      {!isEditingRequest ? (
                                        <div className="font-mono text-slate-100">{aircraftCount}</div>
                                      ) : <input
                                          type="number"
                                          min="1"
                                          max="24"
                                          value={Math.max(1, Number(req.aircraftCount) || 1)}
                                          onChange={e => onPatchSctRequest(req.id, { aircraftCount: Math.max(1, Math.min(24, Math.floor(Number(e.target.value) || 1))) }, type)}
                                          className={controlClass}
                                      />}
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Currency Expire</div>
                                      {!isEditingRequest ? (
                                        <div className="font-mono text-slate-100">{formatPriorityDate(req.currencyExpire) || '-'}</div>
                                      ) : <input type="date" value={req.currencyExpire} onChange={e => onUpdateSctRequest(req.id, 'currencyExpire', e.target.value, type)} style={{colorScheme: 'dark'}} className={controlClass} />}
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Date Requested</div>
                                      {!isEditingRequest ? (
                                        <div className="font-mono text-slate-100">{formatPriorityDate(req.dateRequested) || '-'}</div>
                                      ) : <input type="date" value={req.dateRequested} onChange={e => onUpdateSctRequest(req.id, 'dateRequested', e.target.value, type)} style={{colorScheme: 'dark'}} className={controlClass} />}
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Days to Expire</div>
                                      <div className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-[12px]">
                                          {expiryInfo ? <span className={`font-bold ${expiryInfo.color}`}>{expiryInfo.days}</span> : <span className="text-gray-500">-</span>}
                                      </div>
                                  </div>
                                  <div className={tileBaseClass}>
                                      <div className={tileLabelClass}>Priority</div>
                                      {!isEditingRequest ? (
                                        <div className={`font-semibold ${req.priority === 'High' ? 'text-red-300' : req.priority === 'Medium' ? 'text-amber-300' : 'text-green-300'}`}>{req.priority || 'High'}</div>
                                      ) : <select value={req.priority} onChange={e => onUpdateSctRequest(req.id, 'priority', e.target.value, type)} className={controlClass}>
                                          <option value="High">High</option>
                                          <option value="Medium">Medium</option>
                                          <option value="Low">Low</option>
                                      </select>}
                                  </div>
                                  <div className={`${buildPriorityTableCellClass} flex items-center justify-center bg-cyan-950/80 px-1`}>
                                      <button
                                          type="button"
                                          onClick={() => toggleSctRequestEditing(req)}
                                          className="w-[48px] rounded border border-cyan-400/50 px-2 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/10"
                                      >
                                          {isEditingRequest ? 'Done' : 'Edit'}
                                      </button>
                                  </div>
                                  <div className={`${buildPriorityTableCellClass} flex items-center justify-center bg-cyan-950/80 px-1`}>
                                      <button
                                          type="button"
                                          onClick={() => onRemoveSctRequest(req.id, type)}
                                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center transition-opacity hover:opacity-75 focus:outline-none focus:ring-1 focus:ring-red-500/60"
                                          aria-label="Delete crew currency request"
                                          title="Delete crew currency request"
                                      >
                                          <TrashIcon aria-hidden="true" className="h-4 w-4" style={{ color: '#dc2626', stroke: '#dc2626' }} />
                                      </button>
                                  </div>
                              </div>
                      </div>
                  );
              })}
          </div>
      </div>
  )};

  const isRemedialEvent = (event: ScheduleEvent) => {
      const item = syllabusDetails.find(s => s.code === event.flightNumber);
      return item?.isRemedial || event.flightNumber.includes('REM') || event.flightNumber.endsWith('RF') || event.isRemedial;
  };

  const priorityEventMatchesBuildDate = (event: ScheduleEvent): boolean => {
      const eventDate = String(event.date || '').trim();
      return !eventDate || eventDate === buildDfpDate;
  };
  const isDirectedTaskPriorityEvent = (event: ScheduleEvent): boolean => (
      event.isTaskingRequest === true ||
      !!event.taskingRequestId ||
      String(event.id || '').startsWith('tasking-')
  );
  const matchesPriorityEventIdentity = (source: ScheduleEvent, candidate: ScheduleEvent): boolean => (
      candidate.id === source.id ||
      (!!source.currencyDraftId && candidate.currencyDraftId === source.currencyDraftId) ||
      (!!source.taskingRequestId && candidate.taskingRequestId === source.taskingRequestId) ||
      (!!source.sctRequestId && candidate.sctRequestId === source.sctRequestId)
  );
  const isPriorityEventPublished = (event: ScheduleEvent): boolean => (
      (publishedScheduleEvents || activeScheduleEvents).some(activeEvent => matchesPriorityEventIdentity(event, activeEvent))
  );
  const isPriorityEventScheduled = (event: ScheduleEvent): boolean => (
      (scheduledBuildEvents || []).some(activeEvent => matchesPriorityEventIdentity(event, activeEvent))
  );
  const getTodayDateString = (): string => {
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60000;
      return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
  };
  useEffect(() => {
      const today = getTodayDateString();
      highestPriorityEvents
          .filter(isPriorityEventPublished)
          .forEach(event => onDeletePriorityEvent(event.id));
      highestPriorityEvents
          .filter(event => !isPriorityEventPublished(event))
          .filter(event => !isDirectedTaskPriorityEvent(event))
          .filter(event => {
              const eventDate = String(event.date || '').trim();
              return /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
                  && eventDate < buildDfpDate
                  && eventDate >= today
          })
          .forEach(event => onUpdatePriorityEvent(event.id, { date: buildDfpDate }));
  }, [activeScheduleEvents, buildDfpDate, highestPriorityEvents, onDeletePriorityEvent, onUpdatePriorityEvent]);
  const isGeneratedTaskingFormationMember = (event: ScheduleEvent): boolean => (
      !!event.taskingRequestId &&
      Number(event.formationSize || 0) > 1 &&
      Number(event.formationPosition || 0) > 0 &&
      String(event.id || '').startsWith('tasking-')
  );
  const buildPriorityEventFromSctRequest = (request: SctRequest, requestType: 'flight' | 'ftd'): ScheduleEvent => {
    const requestedTime = request.requestedTime || formatTimeLabel(requestType === 'ftd' ? ftdStartTime : flyingStartTime);
    const primaryName = String(request.name || request.crewIndividual || request.crewDisplayLabel || '').trim();
    const secondaryCrew = String(request.crewMember || request.crewDisplayLabel || '').trim();
    const eventCode = String(request.event || request.currency || 'Currency').trim();
    const flightType = request.flightType === 'Dual' ? 'Dual' : 'Solo';
    return {
      id: `sct-source-${requestType}-${request.id}`,
      sctRequestId: request.id,
      sctRequestType: requestType,
      date: request.dateRequested || buildDfpDate,
      type: requestType,
      instructor: primaryName,
      pilot: primaryName,
      student: '',
      crew: flightType === 'Dual' ? secondaryCrew : '',
      flightNumber: eventCode,
      duration: defaultCurrencyDuration,
      startTime: Number(timeFieldToHours(requestedTime, requestType === 'ftd' ? ftdStartTime : flyingStartTime)) || 0,
      resourceId: '',
      color: 'bg-amber-500/80',
      flightType,
      soloOrDual: flightType,
      locationType: 'Local',
      origin: school,
      destination: school,
      eventCategory: 'currency',
      currency: eventCode,
      currencyAudience: 'staff',
      priority: request.priority || 'High',
      notes: request.notes || '',
      aircraftConfigId: request.aircraftConfigId,
      aircraftCount: Math.max(1, Math.min(24, Math.floor(Number(request.aircraftCount) || 1))),
      isTimeFixed: false,
      isMandatoryTasking: request.priority === 'High',
      pushToNeoBuild: request.pushToNeoBuild !== false,
      requestedByName: String((request as any).requestedByName || (request as any).createdByName || request.name || primaryName || 'Requester').trim(),
      isSctSourceOnly: true,
      ...(requestType === 'flight' && request.aircraftConfigId ? { acceptableAircraftConfigs: [request.aircraftConfigId] } : {}),
    } as ScheduleEvent;
  };
  const displayPriorityEvents = useMemo(() => {
    const baseEvents = highestPriorityEvents.filter(event => !isGeneratedTaskingFormationMember(event));
    const queuedSctRequestIds = new Set(baseEvents.map(event => String(event.sctRequestId || '').trim()).filter(Boolean));
    const queuedEventIds = new Set(baseEvents.map(event => String(event.id || '').trim()).filter(Boolean));
    const sourceCurrencyEvents = [
      ...sctFlights.map(request => ({ request, type: 'flight' as const })),
      ...sctFtds.map(request => ({ request, type: 'ftd' as const })),
    ]
      .filter(({ request }) => String(request.id || '').trim())
      .filter(({ request }) => String(request.event || request.currency || request.name || request.crewIndividual || request.crewDisplayLabel || '').trim())
      .filter(({ request, type }) => {
        const requestId = String(request.id || '').trim();
        if (queuedSctRequestIds.has(requestId)) return false;
        if (queuedEventIds.has(`sct-${type}-${requestId}`) || queuedEventIds.has(`neo-assist-currency-${requestId}`)) return false;
        return true;
      })
      .map(({ request, type }) => buildPriorityEventFromSctRequest(request, type));
    return [...baseEvents, ...sourceCurrencyEvents];
  }, [buildDfpDate, defaultCurrencyDuration, flyingStartTime, ftdStartTime, highestPriorityEvents, school, sctFlights, sctFtds]);
  const standardPriorityEvents = displayPriorityEvents;
  const stalePriorityEvents = displayPriorityEvents.filter(event => !priorityEventMatchesBuildDate(event));
  
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
  const showOptionalCurrencyEventsSection = false;
  const showRemedialPriorityQueue = false;

  const getCrewRequirementSignature = (requirement?: CrewRequirement | null): string => (
    (normaliseCrewRequirement(requirement).roles || [])
      .map((role) => [
        String(role.role || '').trim().toUpperCase(),
        Math.max(0, Math.min(20, Math.round(Number(role.count) || 0))),
        (Array.isArray(role.eligibleRoles) ? role.eligibleRoles : [])
          .map(value => String(value || '').trim().toUpperCase())
          .filter(Boolean)
          .sort()
          .join('|'),
      ].join(':'))
      .sort()
      .join(';')
  );

  const getPriorityEventCrewRequirementName = (event: ScheduleEvent): string => {
    if (!event.crewRequirement) return 'N/A';
    const normalised = normaliseCrewRequirement(event.crewRequirement);
    if (normalised.mode === 'aircraft_default') {
      return crewRequirementPresets.find(preset => preset.kind === 'standard')?.label || 'Standard Crew';
    }
    const eventSignature = getCrewRequirementSignature(event.crewRequirement);
    const matchingPreset = crewRequirementPresets.find(preset => (
      preset.kind === 'alternate' &&
      getCrewRequirementSignature({ mode: 'custom', roles: preset.roles || [] }) === eventSignature
    ));
    return matchingPreset?.label || formatCrewRequirementSummary(event.crewRequirement, aircraftCrewComposition, crewPositionTerminology);
  };

  const getPriorityEventPicName = (event: ScheduleEvent): string => (
    String(event.fixedCrewPic || event.pilot || event.instructor || '').trim() || 'TBA'
  );

  const getPriorityEventLabel = (event: ScheduleEvent): string => {
    if (event.isTaskingRequest) {
      const taskingName = String(event.taskingName || '').trim();
      const abbreviation = Object.entries(taskProfileAbbreviations || {}).find(([profile]) => (
        profile.trim().toLowerCase() === taskingName.toLowerCase()
      ))?.[1]?.trim();
      if (abbreviation) return abbreviation;
      const displayLabel = String(taskingName || event.taskingDisplayLabel || event.flightNumber || 'Directed Task').trim();
      return displayLabel.replace(/^(Task|Mission|Directed Task)\s*-\s*/i, '') || 'Directed Task';
    }
    return String(event.flightNumber || event.eventCode || 'N/A').trim() || 'N/A';
  };

  const getPriorityEventGroup = (event: ScheduleEvent): 'tasking' | 'currency' | 'trainee-currency' | 'special' | 'remedial' => {
    if (isRemedialEvent(event) || event.isRemedialForceSchedule) return 'remedial';
    if ((event as any).standardMissionProfileId || event.eventCategory === 'special') return 'special';
    if (event.isTaskingRequest || event.taskingRequestId) return 'tasking';
    if (event.currencyAudience === 'trainee') return 'trainee-currency';
    return 'currency';
  };

  const priorityEventGroupStyles: Record<'tasking' | 'currency' | 'trainee-currency' | 'special' | 'remedial', string> = {
    tasking: 'bg-cyan-900 text-cyan-50',
    currency: 'bg-indigo-900 text-indigo-50',
    'trainee-currency': 'bg-violet-900 text-violet-50',
    special: 'bg-fuchsia-900 text-fuchsia-50',
    remedial: 'bg-amber-900 text-amber-50',
  };

  const renderStandardMissionTile = (
    label: string,
    value: React.ReactNode,
    className = '',
  ) => (
    <div className={`min-h-[104px] rounded-lg border border-slate-700 bg-slate-950/80 p-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-3 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );

  const renderStandardMissionInput = (
    value: string,
    onChange: (value: string) => void,
    placeholder = '',
  ) => (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={event => event.stopPropagation()}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
    />
  );

  const renderStandardMissionNumberInput = (
    value: number,
    onChange: (value: number) => void,
    min = 0,
  ) => (
    <input
      type="number"
      min={min}
      value={Number.isFinite(value) ? value : min}
      onChange={(event) => onChange(Math.max(min, Math.floor(Number(event.target.value) || min)))}
      onKeyDown={event => event.stopPropagation()}
      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
    />
  );

  const renderSavedSpecialEvents = () => {
    if (displayedStandardMissionProfiles.length === 0) {
      return (
        <div className="mt-4 rounded-lg border border-slate-700 px-3 py-6 text-center text-sm text-slate-500">
          No full directed task setups for this unit context.
        </div>
      );
    }

    return (
      <div className={`${buildPriorityTableShellClass} mt-4`}>
        <div className="min-w-[1152px] space-y-3">
          <div className={`${buildPriorityTableHeaderClass} grid-cols-[56px_190px_84px_96px_136px_94px_92px_116px_150px_84px]`}>
            <span className={buildPriorityTableHeaderCellClass}></span>
            <span className={buildPriorityTableHeaderCellClass}>Event</span>
            <span className={buildPriorityTableHeaderCellClass}>Unit</span>
            <span className={buildPriorityTableHeaderCellClass}>Type</span>
            <span className={buildPriorityTableHeaderCellClass}>Route</span>
            <span className={buildPriorityTableHeaderCellClass}>Duration</span>
            <span className={buildPriorityTableHeaderCellClass}>Aircraft</span>
            <span className={buildPriorityTableHeaderCellClass}>CONFIG</span>
            <span className={buildPriorityTableHeaderCellClass}>Callsign</span>
            <span className={buildPriorityTableHeaderCellClass}>Edit</span>
          </div>
        {displayedStandardMissionProfiles.map((profile) => {
          const isOpen = openStandardMissionIds.has(profile.id);
          const isEditing = editingStandardMissionId === profile.id;
          const unitLabel = profile.unitCode || profile.compositeUnitCode || activeUnitCode || 'Unit';
          const missionName = String(getStandardMissionDraftValue(profile, 'missionName') || '').trim();
          const shortTitle = String(getStandardMissionDraftValue(profile, 'shortTitle') || '').trim();
          const resourceType = getStandardMissionDraftValue(profile, 'resourceType');
          const departureLocationCode = String(getStandardMissionDraftValue(profile, 'departureLocationCode') || '').trim().toUpperCase();
          const arrivalLocationCode = String(getStandardMissionDraftValue(profile, 'arrivalLocationCode') || '').trim().toUpperCase();
          const durationMinutes = Number(getStandardMissionDraftValue(profile, 'durationMinutes')) || 0;
          const config = String(getStandardMissionDraftValue(profile, 'config') || 'ANY').trim() || 'ANY';
          const formationAircraft = Number(getStandardMissionDraftValue(profile, 'formationAircraft')) || 1;
          const crewMode = String(getStandardMissionDraftValue(profile, 'crewCompositionMode') || 'STANDARD');
          const callsignPrefix = String(getStandardMissionDraftValue(profile, 'defaultCallsignPrefix') || '').trim();
          const routeDepSuggestions = getTaskingAirfieldSuggestions(departureLocationCode, taskingAirfieldLookup);
          const routeArrSuggestions = getTaskingAirfieldSuggestions(arrivalLocationCode, taskingAirfieldLookup);
          const alternateCrewPresetsByUnit = crewRequirementPresets
            .filter(preset => preset.kind === 'alternate')
            .reduce((groups, preset) => {
              const groupLabel = String(preset.groupLabel || 'Unit').trim() || 'Unit';
              groups.set(groupLabel, [...(groups.get(groupLabel) || []), preset]);
              return groups;
            }, new Map<string, CrewRequirementPreset[]>());
          const selectedCrewCompositionId = String(getStandardMissionDraftValue(profile, 'selectedCrewCompositionId') || '').trim();
          const selectedAlternatePresetId = crewRequirementPresets.find(preset => (
            preset.kind === 'alternate'
            && (preset.id === selectedCrewCompositionId || preset.id.replace(/^alternate:/, '') === selectedCrewCompositionId)
          ))?.id || '';

          return (
            <div key={profile.id} className="overflow-hidden rounded-xl border border-cyan-500/25 bg-slate-900/45 shadow-lg shadow-black/10">
              <div className={`${buildPriorityTableRowClass} grid-cols-[56px_190px_84px_96px_136px_94px_92px_116px_150px_84px] bg-cyan-950/80 transition hover:bg-cyan-900/80`}>
                <div className={`${buildPriorityTableCellClass} flex items-center justify-center`}>
                <button
                  type="button"
                  onClick={() => toggleStandardMissionOpen(profile.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-500/10 text-xs font-bold text-cyan-200"
                  aria-expanded={isOpen}
                >
                  {isOpen ? 'v' : '>'}
                </button>
                </div>
                <div className={`${buildPriorityTableCellClass} truncate font-semibold text-cyan-100`} title={missionName || 'Unnamed Directed Task Setup'}>{missionName || 'Unnamed Directed Task Setup'}</div>
                <div className={`${buildPriorityTableCellClass} font-semibold uppercase tracking-[0.08em] text-cyan-200/80`}>{unitLabel}</div>
                <div className={`${buildPriorityTableCellClass} text-slate-100`}>{resourceType}</div>
                <div className={`${buildPriorityTableCellClass} truncate text-slate-100`} title={`${departureLocationCode || '-'}-${arrivalLocationCode || '-'}`}>{departureLocationCode || '-'}-{arrivalLocationCode || '-'}</div>
                <div className={`${buildPriorityTableCellClass} font-mono text-slate-100`}>{formatMissionMinutes(durationMinutes)}</div>
                <div className={`${buildPriorityTableCellClass} font-mono text-slate-100`}>{formationAircraft}</div>
                <div className={`${buildPriorityTableCellClass} truncate text-slate-100`} title={config}>{config}</div>
                <div className={`${buildPriorityTableCellClass} truncate text-slate-100`} title={callsignPrefix || 'No callsign prefix'}>{callsignPrefix || '-'}</div>
                <div className={`${buildPriorityTableCellClass} flex items-center justify-center gap-2 px-1`}>
                  {temporaryStandardMissionOverrides[profile.id] && (
                    <span className="rounded border border-amber-300/40 bg-amber-400/10 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-200">
                      Today only
                    </span>
                  )}
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPendingStandardMissionSaveId(profile.id)}
                        className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelStandardMissionEdit(profile.id)}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginStandardMissionEdit(profile)}
                      className="w-[48px] rounded border border-cyan-400/50 px-2 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/10"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-800 px-4 pb-4 pt-3">
                  {pendingStandardMissionSaveId === profile.id && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/35 bg-amber-400/10 p-3">
                      <p className="text-sm font-semibold text-amber-100">Save these directed-task setup changes permanently, or today only?</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => commitStandardMissionDraft(profile, true)}
                          className="rounded-md border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
                        >
                          Permanent
                        </button>
                        <button
                          type="button"
                          onClick={() => commitStandardMissionDraft(profile, false)}
                          className="rounded-md border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
                        >
                          Today Only
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {renderStandardMissionTile('Directed Task Setup', isEditing ? (
                      <div className="space-y-2">
                        {renderStandardMissionInput(missionName, value => updateStandardMissionDraft(profile.id, { missionName: value }), 'Directed Task Setup Name')}
                        {renderStandardMissionInput(shortTitle, value => updateStandardMissionDraft(profile.id, { shortTitle: value.slice(0, 8) }), 'Short title')}
                      </div>
                    ) : (
                      <div>
                        <span className="block">{missionName || 'Unnamed Directed Task Setup'}</span>
                        <span className="mt-1 block text-xs text-cyan-200/70">{shortTitle || 'No short title'}</span>
                      </div>
                    ))}
                    {renderStandardMissionTile('Unit / Aircraft', (
                      <div>
                        <span className="block">{unitLabel}</span>
                        <span className="mt-1 block text-xs text-slate-400">{profile.aircraftTypeCode || aircraftTypeCode || 'No aircraft type configured'}</span>
                      </div>
                    ))}
                    {renderStandardMissionTile('Type / CONFIG', isEditing ? (
                      <div className="space-y-2">
                        <select
                          value={resourceType}
                          onChange={event => updateStandardMissionDraft(profile.id, { resourceType: event.target.value as StandardMissionProfile['resourceType'] })}
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
                        >
                          {['Flight', 'FTD', 'CPT', 'Ground'].map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <div className="[&_select]:w-full [&_select]:rounded-md [&_select]:border-slate-700 [&_select]:bg-slate-950 [&_select]:px-2 [&_select]:py-2 [&_select]:text-sm [&_select]:font-semibold [&_select]:text-slate-100">
                          <AircraftConfigSelect
                            value={aircraftConfigOptions.some(definition => definition.id === config) ? config : BASE_AIRCRAFT_CONFIG.id}
                            definitions={aircraftConfigOptions}
                            onChange={value => updateStandardMissionDraft(profile.id, { config: value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="block">{resourceType}</span>
                        <span className="mt-1 block text-xs text-slate-400">{config}</span>
                      </div>
                    ))}
                    {renderStandardMissionTile('Route', isEditing ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="[&_input]:h-9 [&_input]:rounded-md [&_input]:border-slate-700 [&_input]:bg-slate-950 [&_input]:text-sm">
                          <TaskingAirfieldCodeInput
                            value={departureLocationCode}
                            suggestions={routeDepSuggestions}
                            onChange={value => updateStandardMissionDraft(profile.id, { departureLocationCode: value.toUpperCase() })}
                          />
                        </div>
                        <div className="[&_input]:h-9 [&_input]:rounded-md [&_input]:border-slate-700 [&_input]:bg-slate-950 [&_input]:text-sm">
                          <TaskingAirfieldCodeInput
                            value={arrivalLocationCode}
                            suggestions={routeArrSuggestions}
                            onChange={value => updateStandardMissionDraft(profile.id, { arrivalLocationCode: value.toUpperCase() })}
                          />
                        </div>
                      </div>
                    ) : `${departureLocationCode || '-'} -> ${arrivalLocationCode || '-'}`)}
                    {renderStandardMissionTile('Duration', isEditing ? (
                      renderStandardMissionNumberInput(durationMinutes, value => updateStandardMissionDraft(profile.id, { durationMinutes: value }))
                    ) : formatMissionMinutes(durationMinutes))}
                    {renderStandardMissionTile('Crew Composition', isEditing ? (
                      <div className="space-y-2">
                        <select
                          value={crewMode}
                          onChange={event => updateStandardMissionDraft(profile.id, {
                            crewCompositionMode: event.target.value as StandardMissionProfile['crewCompositionMode'],
                            ...(event.target.value === 'STANDARD' ? { selectedCrewCompositionId: '', roleRequirements: [] } : {}),
                          })}
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
                        >
                          <option value="STANDARD">Standard Crew</option>
                          <option value="ALTERNATE">Alternate Crew</option>
                          <option value="CUSTOM">Custom Crew</option>
                        </select>
                        {crewMode === 'ALTERNATE' && (
                          <select
                            value={selectedAlternatePresetId}
                            onChange={event => {
                              const preset = crewRequirementPresets.find(candidate => candidate.id === event.target.value);
                              updateStandardMissionDraft(profile.id, {
                                selectedCrewCompositionId: preset?.id.replace(/^alternate:/, '') || '',
                                roleRequirements: preset?.roles?.map(role => ({
                                  role: role.role,
                                  count: role.count,
                                })) || [],
                              });
                            }}
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
                          >
                            <option value="">Select alternate crew</option>
                            {Array.from(alternateCrewPresetsByUnit.entries()).map(([unitCode, presets]) => (
                              <optgroup key={unitCode} label={unitCode}>
                                {presets.map(preset => (
                                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}
                        {crewMode === 'CUSTOM' && (
                          <div className="[&>div]:border-slate-700 [&>div]:bg-slate-950/70">
                            <CrewRequirementEditor
                              value={getStandardMissionCrewRequirement(profile)}
                              aircraftCrewComposition={aircraftCrewComposition}
                              crewRequirementPresets={crewRequirementPresets}
                              crewPositionTerminology={crewPositionTerminology}
                              operationalModel={operationalModel}
                              compact
                              onChange={(crewRequirement) => updateStandardMissionDraft(profile.id, {
                                crewCompositionMode: 'CUSTOM',
                                roleRequirements: (crewRequirement.roles || []).map(role => ({
                                  role: role.role,
                                  count: role.count,
                                })),
                              })}
                            />
                          </div>
                        )}
                      </div>
                    ) : crewMode.replace('_', ' '))}
                    {renderStandardMissionTile('No. of Aircraft', isEditing ? (
                      renderStandardMissionNumberInput(formationAircraft, value => updateStandardMissionDraft(profile.id, {
                        formationAircraft: value,
                        isFormation: value > 1,
                      }), 1)
                    ) : `${formationAircraft} ${formationAircraft === 1 ? 'aircraft' : 'aircraft'}`)}
                    {renderStandardMissionTile('Callsign / Notes', isEditing ? (
                      <div className="space-y-2">
                        <select
                          value={callsignPrefix}
                          onChange={event => updateStandardMissionDraft(profile.id, { defaultCallsignPrefix: event.target.value })}
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400"
                        >
                          <option value="">Select callsign</option>
                          {Array.from(unitCallsignEntriesByUnit.entries()).map(([unitCode, entries]) => (
                            <optgroup key={unitCode} label={unitCode}>
                              {entries.map(entry => (
                                <option key={entry.id} value={entry.callsign}>{entry.callsign}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <textarea
                          value={String(getStandardMissionDraftValue(profile, 'description') || '')}
                          onBeforeInput={event => handleEditableTextBeforeInput(event, value => updateStandardMissionDraft(profile.id, { description: value }))}
                          onKeyDownCapture={event => handleEditableTextKeyDownCapture(event, value => updateStandardMissionDraft(profile.id, { description: value }))}
                          onKeyDown={stopEditableKeyPropagation}
                          onChange={event => updateStandardMissionDraft(profile.id, { description: event.target.value })}
                          className="h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400"
                          placeholder="Description"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="block">{callsignPrefix || 'No callsign prefix'}</span>
                        <span className="mt-1 line-clamp-2 block text-xs text-slate-400">{profile.description || 'No description'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    );
  };

  const PriorityEventTable: React.FC<{ events: ScheduleEvent[] }> = ({ events }) => {
    type PriorityGroupKey = 'tasking' | 'currency' | 'special' | 'trainee-currency' | 'remedial';
    const groups: Array<{ key: PriorityGroupKey; label: string; events: ScheduleEvent[] }> = [
      { key: 'tasking', label: 'Directed Tasks', events: events.filter(event => getPriorityEventGroup(event) === 'tasking') },
      { key: 'currency', label: 'Staff Currency Events', events: events.filter(event => getPriorityEventGroup(event) === 'currency') },
      { key: 'special', label: 'Saved Special Events', events: events.filter(event => getPriorityEventGroup(event) === 'special') },
      { key: 'trainee-currency', label: 'Trainee Currency Events', events: events.filter(event => getPriorityEventGroup(event) === 'trainee-currency') },
      { key: 'remedial', label: 'Remedial', events: events.filter(event => getPriorityEventGroup(event) === 'remedial') },
    ];
    const visibleEvents = groups.flatMap(group => group.events);
    const getSctRequestType = (event: ScheduleEvent): 'flight' | 'ftd' => (
      String(event.sctRequestType || event.type || '').toLowerCase() === 'ftd' ? 'ftd' : 'flight'
    );
    const getAircraftCount = (event: ScheduleEvent): number => Math.max(1, Math.min(24, Math.floor(Number(event.aircraftCount ?? (event as any).formationSize ?? event.taskingAircraftCount ?? 1) || 1)));
    const getCrewDisplay = (event: ScheduleEvent): { primary: string; secondary: string } => {
      const primary = getPriorityEventPicName(event);
      const secondary = String(event.crew || event.student || '').trim();
      if ((event.flightType || event.soloOrDual) === 'Dual' && secondary) return { primary, secondary };
      return { primary: primary || 'TBA', secondary: '' };
    };
    const getRequestedBy = (event: ScheduleEvent): string => {
      const raw = (event as any).requestedByName || (event as any).requestedBy || (event as any).createdByName || (event as any).requesterName || '';
      if (String(raw || '').trim()) return String(raw).trim();
      if (event.sctRequestId || event.currencyDraftId || event.currency) return getPriorityEventPicName(event) || 'Requester';
      return 'Operations';
    };
    const getStatus = (event: ScheduleEvent): { label: string; className: string } => {
      if (event.pushToNeoBuild === false) return { label: 'Not pushed', className: 'border-slate-500/40 bg-slate-700/40 text-slate-200' };
      if (isPriorityEventScheduled(event)) return { label: 'Scheduled', className: 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100' };
      if (!priorityEventMatchesBuildDate(event)) return { label: 'Other date', className: 'border-amber-300/40 bg-amber-500/15 text-amber-100' };
      return { label: 'Ready', className: 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100' };
    };
    const updateEvent = (event: ScheduleEvent, updates: Partial<ScheduleEvent>) => {
      onUpdatePriorityEvent(event.id, updates);
      if (event.taskingRequestId) {
        setTaskingRequests(prev => prev.map(request => request.id === event.taskingRequestId ? {
          ...request,
          ...(updates.date !== undefined ? { date: String(updates.date || '') } : {}),
          ...(updates.startTime !== undefined ? { takeoff: Number(updates.startTime) || 0 } : {}),
          ...(updates.duration !== undefined ? { duration: Number(updates.duration) || defaultTaskingDuration } : {}),
          ...(updates.flightNumber !== undefined ? { tasking: String(updates.flightNumber || '') } : {}),
          ...(updates.aircraftCount !== undefined ? { aircraftCount: getAircraftCount({ ...event, ...updates }) } : {}),
          ...(updates.priority !== undefined ? { schedulerPriority: updates.priority, isMandatory: updates.priority === 'High' } : {}),
          ...(updates.pushToNeoBuild !== undefined ? { pushToNeoBuild: updates.pushToNeoBuild } : {}),
          saved: true,
          submitted: true,
          ignored: false,
        } : request));
      }
      if (event.sctRequestId) {
        const sctUpdates: Partial<SctRequest> = {};
        if (updates.date !== undefined) sctUpdates.dateRequested = String(updates.date || '');
        if (updates.startTime !== undefined) sctUpdates.requestedTime = formatTimeLabel(Number(updates.startTime) || 0);
        if (updates.flightNumber !== undefined) sctUpdates.event = String(updates.flightNumber || '');
        if (updates.priority !== undefined) sctUpdates.priority = updates.priority;
        if (updates.aircraftCount !== undefined) sctUpdates.aircraftCount = getAircraftCount({ ...event, ...updates });
        if (updates.pushToNeoBuild !== undefined) {
          sctUpdates.pushToNeoBuild = updates.pushToNeoBuild;
          sctUpdates.includeInBuild = updates.pushToNeoBuild;
        }
        if (Object.keys(sctUpdates).length > 0) onPatchSctRequest(event.sctRequestId, sctUpdates, getSctRequestType(event));
      }
    };
    const setPush = (event: ScheduleEvent, pushToNeoBuild: boolean) => {
      setPriorityPushDrafts(prev => ({ ...prev, [event.id]: pushToNeoBuild }));
      updateEvent(event, { pushToNeoBuild });
    };
    const isPushEnabled = (event: ScheduleEvent): boolean => (
      event.id in priorityPushDrafts ? priorityPushDrafts[event.id] : event.pushToNeoBuild !== false
    );
    const setAllPush = (pushToNeoBuild: boolean) => visibleEvents.forEach(event => setPush(event, pushToNeoBuild));
    const deletePriorityEvent = (event: ScheduleEvent) => {
      if (event.taskingRequestId) {
        removeTaskingRequest(event.taskingRequestId);
        return;
      }
      if (event.sctRequestId) {
        onPatchSctRequest(event.sctRequestId, { submitted: false, includeInBuild: false, pushToNeoBuild: false }, getSctRequestType(event));
      }
      onDeletePriorityEvent(event.id);
    };

    const renderEmptyGroupRow = (group: typeof groups[number]) => (
      <tr key={`${group.key}-empty`} className="bg-slate-900/55">
        <td className={`border border-slate-700/80 px-2 py-3 text-center align-middle text-sm font-black ${priorityEventGroupStyles[group.key]}`}>
          {group.label}
        </td>
        <td colSpan={11} className="border border-slate-700/80 px-2 py-3 text-slate-600">&nbsp;</td>
      </tr>
    );

    const renderEventRow = (event: ScheduleEvent, group: typeof groups[number], index: number) => {
      const isEditing = editingPriorityEventId === event.id;
      const isScheduledInBuild = isPriorityEventScheduled(event);
      const matchesBuildDate = priorityEventMatchesBuildDate(event);
      const rowText = isScheduledInBuild ? 'text-emerald-200' : matchesBuildDate ? 'text-slate-100' : 'text-slate-400';
      const rowClass = isScheduledInBuild
        ? 'bg-emerald-950/60 transition-colors odd:bg-emerald-900/35 hover:bg-emerald-900/55'
        : matchesBuildDate
          ? 'bg-slate-900/70 transition-colors odd:bg-slate-800/80 hover:bg-cyan-950/50'
          : 'bg-slate-950/65 transition-colors odd:bg-slate-900/65 hover:bg-slate-800/70';
      const eventLabel = getPriorityEventLabel(event);
      const crew = getCrewDisplay(event);
      const status = getStatus(event);
      const flightType = event.flightType === 'Dual' || event.soloOrDual === 'Dual' ? 'Dual' : event.flightType === 'Solo' || event.soloOrDual === 'Solo' ? 'Solo' : '-';
      const pushEnabled = isPushEnabled(event);
      const priorityTextClass = event.priority === 'Medium' ? 'text-amber-300' : event.priority === 'Low' ? 'text-green-300' : 'text-red-300';
      return (
        <tr key={event.id} onClick={() => !isEditing && onSelectEvent(event)} className={`${rowClass} ${isEditing ? 'ring-1 ring-inset ring-emerald-300/70' : 'cursor-pointer'}`}>
          {index === 0 && (
            <td rowSpan={group.events.length} className={`border border-slate-700/80 px-2 py-3 text-center align-middle text-sm font-black ${priorityEventGroupStyles[group.key]}`}>
              {group.label}
            </td>
          )}
          <td className={`border border-slate-700/80 px-2 py-2 font-mono ${rowText}`}>{events.indexOf(event) + 1}</td>
          <td className={`border border-slate-700/80 px-2 py-2 ${rowText}`}>{flightType}</td>
          <td className={`border border-slate-700/80 px-2 py-2 font-mono font-black ${rowText}`} title={matchesBuildDate ? formatPriorityDate(event.date) : `${formatPriorityDate(event.date)} - not scheduled for this build date`}>
            {isEditing ? (
              <input type="date" value={event.date || buildDfpDate} onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { date: e.target.value })} style={{ colorScheme: 'dark' }} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100" />
            ) : (
              <>
                <span className="block truncate">{formatPriorityDate(event.date)}</span>
                {!matchesBuildDate && <span className="block truncate text-[9px] font-black uppercase tracking-[0.12em] text-amber-300/80">Not this build</span>}
              </>
            )}
          </td>
          <td className={`truncate border border-slate-700/80 px-2 py-2 font-black ${rowText}`} title={eventLabel}>
            {isEditing ? (
              <input value={eventLabel} onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { flightNumber: e.target.value, taskingName: e.target.value, taskingDisplayLabel: e.target.value, currency: group.key.includes('currency') ? e.target.value : event.currency })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100" />
            ) : eventLabel}
          </td>
          <td className={`border border-slate-700/80 px-2 py-2 ${rowText}`} title={`${crew.primary}${crew.secondary ? `, ${crew.secondary}` : ''}`}>
            {isEditing ? (
              <div className="space-y-1">
                <input value={crew.primary === 'TBA' ? '' : crew.primary} placeholder="PIC or crew" onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { pilot: e.target.value, fixedCrewPic: e.target.value })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100" />
                {(event.flightType === 'Dual' || event.soloOrDual === 'Dual') && (
                  <input value={crew.secondary} placeholder="Second crew" onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { crew: e.target.value, student: e.target.value })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100" />
                )}
              </div>
            ) : (
              <>
                <span className="block truncate">{crew.primary}</span>
                {crew.secondary && <span className="block truncate text-[10px] text-slate-400">{crew.secondary}</span>}
              </>
            )}
          </td>
          <td className={`truncate border border-slate-700/80 px-2 py-2 ${rowText}`} title={getRequestedBy(event)}>{getRequestedBy(event)}</td>
          <td className={`border border-slate-700/80 px-2 py-2 font-mono ${rowText}`}>
            {isEditing ? (
              <select value={event.startTime || 0} onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { startTime: Number(e.target.value) })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100">
                {timeOptions.map(option => <option key={`hpe-time-${event.id}-${option.label}`} value={option.value}>{option.label.replace(':', '')}</option>)}
              </select>
            ) : formatCompactTimeLabel(event.startTime || 0)}
          </td>
          <td className={`border border-slate-700/80 px-2 py-2 font-mono ${rowText}`}>
            {isEditing ? (
              <input type="number" min={1} max={24} value={getAircraftCount(event)} onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { aircraftCount: getAircraftCount({ ...event, aircraftCount: e.target.value as any }) })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100" />
            ) : getAircraftCount(event)}
          </td>
          <td className={`border border-slate-700/80 px-2 py-2 font-black ${priorityTextClass}`}>
            {isEditing ? (
              <select value={event.priority || 'High'} onClick={e => e.stopPropagation()} onChange={e => updateEvent(event, { priority: e.target.value as 'High' | 'Medium' | 'Low', isMandatoryTasking: e.target.value === 'High' })} className="h-7 w-full rounded border border-slate-600 bg-slate-950 px-1 text-[11px] text-slate-100">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            ) : event.priority || 'High'}
          </td>
          <td className="border border-slate-700/80 px-2 py-2">
            <span className={`inline-flex rounded border px-1.5 py-1 text-[10px] font-black ${status.className}`}>{status.label}</span>
          </td>
          <td className="border border-slate-700/80 px-1.5 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPriorityEventId(current => current === event.id ? null : event.id); }} className="rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-100 hover:bg-cyan-500/20">
                {isEditing ? 'Done' : 'Edit'}
              </button>
              <button type="button" aria-label="Delete priority event" title="Delete priority event" onClick={(e) => { e.stopPropagation(); deletePriorityEvent(event); }} className="inline-flex h-7 w-6 items-center justify-center text-red-300 transition-colors hover:text-red-100">
                <TrashIcon aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </td>
          <td className="border border-slate-700/80 px-1 py-1.5 text-center">
            <div className="inline-flex items-center justify-center gap-1 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[10px] font-bold text-slate-100">
              <label className="inline-flex cursor-pointer items-center gap-0.5">
                <input type="radio" name={`hpe-push-${event.id}`} checked={pushEnabled} onClick={e => e.stopPropagation()} onChange={() => setPush(event, true)} className="h-3 w-3 accent-cyan-400" />
                Y
              </label>
              <label className="inline-flex cursor-pointer items-center gap-0.5">
                <input type="radio" name={`hpe-push-${event.id}`} checked={!pushEnabled} onClick={e => e.stopPropagation()} onChange={() => setPush(event, false)} className="h-3 w-3 accent-cyan-400" />
                N
              </label>
            </div>
          </td>
        </tr>
      );
    };

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-600/70 bg-slate-950/55 shadow-inner shadow-black/20">
        <table className="w-full min-w-[1280px] table-fixed border-collapse text-[11px] leading-tight">
            <colgroup>
                <col className="w-[118px]" />
                <col className="w-[48px]" />
                <col className="w-[70px]" />
                <col className="w-[106px]" />
                <col className="w-[120px]" />
                <col className="w-[170px]" />
                <col className="w-[126px]" />
                <col className="w-[72px]" />
                <col className="w-[68px]" />
                <col className="w-[88px]" />
                <col className="w-[86px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
            </colgroup>
            <thead className="bg-slate-800/95 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                <tr>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Type</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Order</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Solo/Dual</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Date</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Event</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Person/Crew</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Requested By</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Time</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Aircraft</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Priority</th>
                    <th className="border border-slate-700/90 px-2 py-2 text-left">Status</th>
                    <th className="border border-slate-700/90 px-1 py-2 text-center">Edit</th>
                    <th className="border border-slate-700/90 px-1 py-1 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>Push</span>
                        <span className="inline-flex overflow-hidden rounded border border-slate-600 bg-slate-950 text-[9px] font-bold normal-case tracking-normal">
                          <button type="button" onClick={() => setAllPush(true)} className="px-1.5 py-0.5 text-cyan-100 hover:bg-cyan-500/15">All</button>
                          <button type="button" onClick={() => setAllPush(false)} className="border-l border-slate-600 px-1.5 py-0.5 text-slate-200 hover:bg-slate-700/60">None</button>
                        </span>
                      </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                {groups.flatMap(group => (
                  group.events.length > 0
                    ? group.events.map((event, index) => renderEventRow(event, group, index))
                    : [renderEmptyGroupRow(group)]
                ))}
            </tbody>
        </table>
      </div>
    );
  };
  
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
            <div className="course-demand-intro-card rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Third Input</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Course Demand</h2>
                <p className="mt-1 text-sm text-slate-300">Set the relative course weighting after time windows, resources and people rules are known.</p>
            </div>

            <div className="course-priority-card rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg h-fit">
                <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-200">Course Priority</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {locationDisplayName} &mdash; locality courses only
                        </p>
                    </div>
                    <span className="text-xs text-gray-500">Last updated: {courseTimestamp}</span>
                </div>
                <div className="p-4 border-t border-gray-700">
                    {(
                        <div className="fixed-crew-course-package-priority-card mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-emerald-100">
                                        {priorityAllocationModel === 'air_combat'
                                            ? 'Air Combat Course & Package Priority'
                                            : priorityAllocationModel === 'fixed_crew'
                                                ? 'Fixed Crew Course & Package Priority'
                                                : `${operationalModelLabel.replace(/\s+Model$/i, '')} Course Priority`}
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
                                        {priorityAllocationModel === 'air_combat'
                                            ? "Set how remaining Air Combat capacity is shared across this unit's assigned courses and packages after directed task and currency requests are attempted."
                                            : priorityAllocationModel === 'fixed_crew'
                                                ? 'Select which Fixed Crew courses and packages NEO Build may schedule, then weight the order when several streams compete for the same day.'
                                                : `Set how ${operationalModelLabel.replace(/\s+Model$/i, '')} training capacity is shared across active courses for this locality.`}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded border px-2 py-1 text-xs font-semibold ${
                                        fixedCrewEnabledStreamTotal === 100
                                            ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-100'
                                            : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                                    }`}>
                                        Enabled total {fixedCrewEnabledStreamTotal}%
                                    </span>
                                    {fixedCrewEnabledStreamTotal !== 100 && (
                                        <span className="rounded border border-amber-400/30 bg-slate-950/70 px-2 py-1 text-xs font-semibold text-amber-100">
                                            {fixedCrewEnabledStreamTotal < 100 ? `${100 - fixedCrewEnabledStreamTotal}% unassigned` : `${fixedCrewEnabledStreamTotal - 100}% over`}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleEqualiseFixedCrewStreams}
                                        disabled={displayedPriorityAllocationStreams.length < 2}
                                        className="rounded border border-emerald-400/30 bg-slate-950/70 px-2 py-1 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/70 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Reset Evenly
                                    </button>
                                </div>
                            </div>
                            {displayedPriorityAllocationStreams.length === 0 ? (
                                <div className="rounded border border-slate-700/70 bg-slate-950/60 p-3 text-sm text-slate-300">
                                    {priorityAllocationModel === 'air_combat'
                                        ? `No Air Combat course or training package assignments were found for ${activeUnitCode || school}. Assign staff to unit courses/packages and they will appear here.`
                                        : priorityAllocationModel === 'fixed_crew'
                                            ? `No Fixed Crew course or training package events were found for ${activeUnitCode || school}. Add visible Master LMP courses or Training Packages for this unit and they will appear here.`
                                            : `No courses found for ${locationDisplayName}. Courses will appear here once trainees are loaded for this locality.`}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
                                        <div className="relative px-2 pb-14 pt-10">
                                            <div
                                                ref={fixedCrewSliderTrackRef}
                                                className="relative h-5 cursor-ew-resize overflow-visible rounded-full border border-slate-600 bg-slate-900 shadow-inner"
                                            >
                                                <span className="absolute -top-8 left-0 -translate-x-1/2 font-mono text-[11px] font-bold text-slate-400">0%</span>
                                                <span className="absolute -top-8 left-full -translate-x-1/2 font-mono text-[11px] font-bold text-slate-400">100%</span>
                                                {activeFixedCrewPriorityStreams.map((stream, index) => {
                                                    const start = index === 0 ? 0 : fixedCrewPriorityBoundaries[index - 1];
                                                    const width = stream.weight;
                                                    const colour = fixedCrewColourByKey.get(stream.key) || FIXED_CREW_PRIORITY_COLOURS[index % FIXED_CREW_PRIORITY_COLOURS.length];
                                                    return (
                                                        <div
                                                            key={stream.key}
                                                            className="absolute top-0 h-full first:rounded-l-full last:rounded-r-full"
                                                            style={{
                                                                left: `${start}%`,
                                                                width: `${width}%`,
                                                                background: colour,
                                                            }}
                                                        >
                                                            <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 text-center">
                                                                <p className="font-mono text-xs font-bold text-emerald-100">{stream.weight}%</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {fixedCrewPriorityBoundaries.slice(0, -1).map((boundary, index) => (
                                                    <button
                                                        key={`${activeFixedCrewPriorityStreams[index]?.key || index}-handle`}
                                                        type="button"
                                                        aria-label={`Move priority boundary at ${boundary}%`}
                                                        onPointerDown={(event) => handleFixedCrewPriorityHandlePointerDown(index, event)}
                                                        className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white shadow-lg ring-2 ring-cyan-300/70 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-70"
                                                        style={{ left: `${boundary}%` }}
                                                    >
                                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-bold text-cyan-100">{boundary}%</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-visible rounded-lg border border-slate-700/80 bg-slate-950/60">
                                        <div className="rounded-t-lg border-b border-slate-700/70 bg-slate-950/80 px-3 py-2">
                                            <div className="grid grid-cols-[46px_1fr_92px_92px] gap-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                                <span>Rank</span>
                                            <span>{priorityAllocationModel === 'flight_school' ? 'Course' : 'Course / Package'}</span>
                                                <span className="text-right">Priority</span>
                                                <span className="text-right">Status</span>
                                            </div>
                                        </div>
                                        <ul>
                                            {sortedFixedCrewPriorityTableStreams.map((stream: FixedCrewTrainingStreamDisplay, index) => {
                                                const colour = fixedCrewColourByKey.get(stream.key) || FIXED_CREW_PRIORITY_COLOURS[index % FIXED_CREW_PRIORITY_COLOURS.length];
                                                return (
                                                    <li
                                                        key={stream.key}
                                                        ref={(node) => {
                                                            if (node) fixedCrewStreamRowRefs.current.set(stream.key, node);
                                                            else fixedCrewStreamRowRefs.current.delete(stream.key);
                                                        }}
                                                        className={`grid grid-cols-[46px_1fr_92px_92px] items-center gap-3 border-b border-slate-800/80 bg-slate-950/60 px-3 py-3 shadow-sm last:border-b-0 ${
                                                            stream.enabled ? 'text-slate-100' : 'text-slate-500 opacity-75'
                                                        }`}
                                                    >
                                                        <span className="font-mono text-sm text-slate-500">{stream.enabled ? index + 1 : '-'}</span>
                                                        <div className="min-w-0">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
                                                                <p className="truncate text-sm font-semibold">{stream.title || stream.code}</p>
                                                                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                                    stream.kind === 'course'
                                                                        ? 'border border-sky-400/30 bg-sky-500/10 text-sky-100'
                                                                        : 'border border-violet-400/30 bg-violet-500/10 text-violet-100'
                                                                }`}>
                                                                    {stream.kind === 'course' ? 'Course' : 'Package'}
                                                                </span>
                                                            </div>
                                                            <p className="truncate text-xs text-slate-500">{stream.code}{stream.unitCode ? ` • ${stream.unitCode}` : ''} • {stream.eventCount || 0} event{stream.eventCount === 1 ? '' : 's'}</p>
                                                        </div>
                                                        <span className="text-right font-mono text-lg font-bold text-emerald-200">{stream.enabled ? `${stream.weight}%` : '0%'}</span>
                                                        <div className="flex justify-end">
                                                            {priorityAllocationModel === 'fixed_crew' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleFixedCrewStreamToggle(stream.key)}
                                                                    className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                                                        stream.enabled
                                                                            ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                                                                            : 'border border-slate-600 bg-slate-900 text-slate-400'
                                                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                                                >
                                                                    {stream.enabled ? 'Enabled' : 'Off'}
                                                                </button>
                                                            ) : (
                                                                <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <div className="flex justify-end rounded-b-lg border-t border-slate-700/70 bg-slate-950/80 px-3 py-2">
                                            <span className="rounded border border-emerald-500/30 bg-emerald-950/50 px-2 py-1 text-xs font-bold text-emerald-100">Total: 100%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
           </div>

           <div className="section-build-timeline space-y-6">
                <div className="flying-windows-card rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
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

                <div className="resource-capacity-card rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Capacity Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Resource Capacity</h2>
                        <p className="mt-1 text-sm text-slate-300">Declare the physical capacity available for this build before weighting the course demand.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="aircraft-count" className="block text-sm font-medium text-slate-300">Total Aircraft Available</label>
                            <input id="aircraft-count" type="number" min={0} max={aircraftCapacityMax} value={availableAircraftCount} onChange={(e) => handleAircraftCapacityChange(e.target.value)} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                            <p className="mt-1 text-[11px] text-slate-500">Configured maximum: {aircraftCapacityMax}</p>
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
                                                        max={Math.max(0, Math.min(availableAircraftCount, aircraftCapacityMax))}
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
                            <input id="ftd-count" type="number" min={0} max={ftdCapacityMax} value={availableFtdCount} onChange={(e) => { const nextCount = Math.min(ftdCapacityMax, Math.max(0, parseInt(e.target.value, 10) || 0)); logAudit("Priorities", "Edit", `Updated available ${ftdLabel} count`, `${availableFtdCount} \u2192 ${nextCount}`); onUpdateFtdCount(nextCount); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                            <p className="mt-1 text-[11px] text-slate-500">Configured maximum: {ftdCapacityMax}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="cpt-count" className="block text-sm font-medium text-slate-300">{cptLabel} Available</label>
                            <input id="cpt-count" type="number" min={0} max={cptCapacityMax} value={availableCptCount} onChange={(e) => { const nextCount = Math.min(cptCapacityMax, Math.max(0, parseInt(e.target.value, 10) || 0)); logAudit("Priorities", "Edit", `Updated available ${cptLabel} count`, `${availableCptCount} \u2192 ${nextCount}`); onUpdateCptCount(nextCount); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                            <p className="mt-1 text-[11px] text-slate-500">Configured maximum: {cptCapacityMax}</p>
                        </div>
                    </div>
                </div>
           </div>

           {!isFixedCrewModel && (
           <div className="section-people-rules space-y-6">
                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Second Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">{instructorLabel} Allocation Rules</h2>
                        <p className="mt-1 text-sm text-slate-300">Set whether the build should prefer or require the trainee's assigned {instructorLabel.toLowerCase()} chain before using a wider {instructorLabel.toLowerCase()} pool for flight and {ftdLabel} events.</p>
                    </div>
                    <div className="p-4 space-y-5">

                        {/* Master switch */}
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <div
                                    onClick={() => {
                                        const next = { ...instructorPriority, enabled: !instructorPriority.enabled };
                                        logAudit("Priorities", "Edit", `${instructorLabel} Priority Mode toggled`, `${instructorPriority.enabled} → ${next.enabled}`);
                                        onUpdateInstructorPriority(next);
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${instructorPriority.enabled ? 'bg-sky-500' : 'bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${instructorPriority.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                                <span className="font-semibold text-sky-400">Priority Mode</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">
                                When on, flight and {ftdLabel} events follow the {instructorLabel.toLowerCase()} groups selected below. Primary {instructorLabel} tries to roster the trainee with their primary {instructorLabel.toLowerCase()} first; fallback to the secondary {instructorLabel.toLowerCase()} or an alternate {instructorLabel.toLowerCase()} from the same flight only occurs when those options are also selected.
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
                                                    logAudit("Priorities", "Edit", `${instructorLabel} Priority mode changed`, `${instructorPriority.mode} → ${m}`);
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
                                            <span className="text-sky-400 font-medium">Soft:</span> The scheduler attempts the selected {instructorLabel.toLowerCase()} chain first. If the primary {instructorLabel.toLowerCase()} is unavailable, it can fall back to selected secondary or same-flight {instructorLabel.toLowerCase()} options; if none are available, it may use any otherwise eligible {instructorLabel.toLowerCase()} so the event can still be placed.
                                        </p>
                                    )}
                                    {instructorPriority.mode === 'hard' && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-red-400 font-medium">Hard:</span> Flight and {ftdLabel} events are only placed when one of the selected {instructorLabel.toLowerCase()} groups is available. If Primary {instructorLabel} is selected, the primary {instructorLabel.toLowerCase()} must be used unless selected fallback groups are available. If no selected group is free, the event is placed on STBY with no {instructorLabel.toLowerCase()}. {cptLabel} and Ground are unaffected.
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
                                                { key: 'primary',    label: `Primary ${instructorLabel}`,         desc: `Try the trainee's primary ${instructorLabel.toLowerCase()} first where possible.` },
                                                { key: 'secondary',  label: `Secondary ${instructorLabel}`,       desc: `Allow the trainee's secondary ${instructorLabel.toLowerCase()} as a fallback when the primary is unavailable.` },
                                                { key: 'sameFlight', label: `Same Flight ${instructorLabel}`,     desc: `Allow another qualified ${instructorLabel.toLowerCase()} from the trainee's allocated flight as a fallback.` },
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
                                                Select which {instructorLabel.toLowerCase()} groups are authorised for flight and {ftdLabel} placement. With Primary {instructorLabel} selected, the build requires the trainee's primary {instructorLabel.toLowerCase()} unless you also allow secondary or same-flight fallback. If no selected group is free, the event is placed on STBY with no {instructorLabel.toLowerCase()} assigned.
                                            </p>
                                            <div className="space-y-2 bg-gray-750 rounded-lg border border-red-900/40 p-3">
                                                {([
                                                    { key: 'primary',    label: `Primary ${instructorLabel}`,     desc: `Require the trainee's primary ${instructorLabel.toLowerCase()} unless an authorised fallback group is also selected and available.` },
                                                    { key: 'secondary',  label: `Secondary ${instructorLabel}`,   desc: `Permit the trainee's secondary ${instructorLabel.toLowerCase()} as an authorised fallback.` },
                                                    { key: 'sameFlight', label: `Same Flight ${instructorLabel}`, desc: `Permit another qualified ${instructorLabel.toLowerCase()} from the trainee's allocated flight as an authorised fallback.` },
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
           )}
                   
        <div className="section-directed-events space-y-6">
        <div className="directed-events-intro-card rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Fourth Input</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Directed Tasks</h2>
            <p className="mt-1 text-sm text-slate-300">Review hard requests and build exceptions after the normal course weighting is set.</p>
        </div>

        <div className="tasking-events-card rounded-lg border border-cyan-400/55 bg-slate-900 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-sky-400">Directed Tasks</h2>
              <button onClick={addTaskingRequest} className="btn-aluminium-brushed flex h-[41px] w-[56px] items-center justify-center rounded-md px-1 py-1 text-center text-[10px] font-semibold leading-tight">
                <span>+ Add<br />Request</span>
              </button>
            </div>
            <TaskingRequestTable
              taskingRequests={visibleTaskingRequests}
              timeOptions={timeOptions}
              aircraftConfigOptions={aircraftConfigOptions}
              airfieldLookup={taskingAirfieldLookup}
              taskProfiles={taskProfiles}
              operationalModel={operationalModel}
              operationalModelLabel={operationalModelLabel}
              isSingleSeatAircraft={isSingleSeatAircraft}
              aircraftCrewComposition={aircraftCrewComposition}
              crewRequirementPresets={crewRequirementPresets}
              crewPositionTerminology={crewPositionTerminology}
              unitCallsignEntries={unitCallsignEntries}
              formationCallsignEntries={formationCallsignEntries}
              callsignNumberOptions={callsignNumberOptions}
              onUpdateTaskingRequest={updateTaskingRequest}
              onRemoveTaskingRequest={removeTaskingRequest}
              onSetTaskingSchedulerPriority={setTaskingSchedulerPriority}
              onNavigateToSettingsSection={onNavigateToSettingsSection}
            />
        </div>

        <div className="specific-currency-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-sky-400">{continuationCurrencyRequestsLabel}</h2>
              <button onClick={() => onAddSctRequest('flight')} className="btn-aluminium-brushed flex h-[41px] w-[56px] items-center justify-center rounded-md px-1 py-1 text-center text-[10px] font-semibold leading-tight">
                <span>+ Add<br />Request</span>
              </button>
            </div>
            <div className="space-y-6">
                {sctFlights.length === 0 && sctFtds.length === 0 ? (
                  <p className="text-sm text-slate-500">No requests added.</p>
                ) : (
                  <>
                    {sctFlights.length > 0 && renderSctRequestTable('flight', sctFlights)}
                    {sctFtds.length > 0 && renderSctRequestTable('ftd', sctFtds)}
                  </>
                )}
            </div>
        </div>

        <div className="saved-special-events-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-sky-400">Saved Special Events</h2>
              <button
                type="button"
                onClick={() => onNavigateToSettingsSection?.({
                  sectionId: 'standard-missions',
                  focusSubsectionId: 'platform-standard-missions',
                })}
                className="btn-aluminium-brushed flex h-[41px] w-[68px] items-center justify-center rounded-md px-1 py-1 text-center text-[10px] font-semibold leading-tight"
              >
                <span>Add &amp;<br />Delete</span>
              </button>
            </div>
            {renderSavedSpecialEvents()}
        </div>

        {!isFixedCrewModel && <div className="trainee-currency-events-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
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
        </div>}

        {!isFixedCrewModel && (
        <div className="bulk-currency-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-sky-400">Bulk Currency Builder</h2>
                    <p className="mt-1 text-xs text-slate-400">Open the builder, select staff, then build a consolidated currency event review list.</p>
                </div>
                <button
                    onClick={() => setIsStaffCurrencyBuilderOpen(prev => !prev)}
                    className="btn-aluminium-brushed flex h-[41px] w-[56px] items-center justify-center rounded-md px-1 py-1 text-center text-[9px] font-semibold leading-[0.95]"
                >
                    {isStaffCurrencyBuilderOpen ? <span>Hide<br />Bulk<br />Builder</span> : <span>Build<br />Bulk<br />Currency</span>}
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
                    <span className="mr-2 text-xs uppercase tracking-[0.16em] text-slate-500">Role Filter</span>
                    <select value={selectedStaffCurrencyRole} onChange={e => setStaffCurrencyRoleFilter(e.target.value)} className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white">
                        {staffCurrencyRoleOptions.map(role => (
                            <option key={`staff-currency-role-${role}`} value={role}>{getStaffCurrencyRoleLabel(role)}</option>
                        ))}
                    </select>
                </label>
                <button
                    onClick={addStaffCurrencyEventsToPriority}
                    disabled={staffCurrencySelection.size === 0 || (!staffCurrencyIncludeFlights && !staffCurrencyIncludeSims)}
                    className="btn-aluminium-brushed flex h-[41px] w-[56px] items-center justify-center rounded-md px-1 py-1 text-center text-[10px] font-semibold leading-[0.9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <span>Add to<br />Consol<br />List</span>
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-2 py-2 text-center">Add</th>
                            <th className="px-2 py-2 text-left">Rank</th>
                            <th className="px-2 py-2 text-left">Role</th>
                            <th className="px-2 py-2 text-left">Staff</th>
                            <th className="px-2 py-2 text-left">PIC</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                        {staffCurrencyRows.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No {getStaffCurrencyRoleLabel(selectedStaffCurrencyRole)} staff currently require Currency events.</td></tr>
                        )}
                        {staffCurrencyRows.map(row => {
                            const picOptions = getStaffCurrencyPicOptions(row.instructor);
                            const isSelected = staffCurrencySelection.has(row.personKey);
                            const isSelfPic = staffHasPicQualification(row.instructor);
                            const selectedPic = staffCurrencyPicSelections[row.personKey] || getDefaultStaffCurrencyPicName(row.instructor);
                            return (
                            <tr key={row.personKey} className="hover:bg-sky-900/40">
                                <td className="px-2 py-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => setStaffCurrencySelection(prev => toggleSetValue(prev, row.personKey))}
                                        className="h-4 w-4 rounded bg-slate-800 accent-cyan-500"
                                    />
                                </td>
                                <td className="px-2 py-2 text-slate-300">{row.instructor.rank}</td>
                                <td className="px-2 py-2 text-slate-300">{getStaffCurrencyRoleLabel(row.instructor.role || selectedStaffCurrencyRole)}</td>
                                <td className="px-2 py-2 font-semibold text-white">{row.instructor.name}</td>
                                <td className="px-2 py-2">
                                    {isSelfPic ? (
                                        <div className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-green-300">
                                            {row.instructor.name}
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedPic}
                                            disabled={!isSelected}
                                            onChange={event => setStaffCurrencyPicSelections(prev => ({
                                                ...prev,
                                                [row.personKey]: event.target.value,
                                            }))}
                                            className="w-full min-w-[12rem] rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">{picOptions.length > 0 ? 'Select PIC' : 'No PIC available'}</option>
                                            {picOptions.map(candidate => (
                                                <option key={candidate.id || candidate.idNumber || candidate.name} value={candidate.name}>
                                                    {candidate.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </td>
                            </tr>
                        );
                        })}
                    </tbody>
                </table>
            </div>
            </>}
        </div>
        )}

        {!isFixedCrewModel && (
        <div className="consolidated-currency-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
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
            <div className={currencyDraftEvents.length === 0 ? 'space-y-3' : buildPriorityTableShellClass}>
                {currencyDraftEvents.length === 0 && (
                    <div className="rounded-lg border border-slate-700 px-3 py-6 text-center text-sm text-slate-500">
                        No Currency events built yet. Open a trainee or staff builder above to create the review list.
                    </div>
                )}
                {currencyDraftEvents.length > 0 && (
                    <div className="min-w-[1152px] space-y-3">
                        <div className={`${buildPriorityTableHeaderClass} grid-cols-[70px_190px_170px_160px_130px_360px_72px]`}>
                            <span className={buildPriorityTableHeaderCellClass}>Push</span>
                            <span className={buildPriorityTableHeaderCellClass}>Person</span>
                            <span className={buildPriorityTableHeaderCellClass}>Event</span>
                            <span className={buildPriorityTableHeaderCellClass}>Currencies</span>
                            <span className={buildPriorityTableHeaderCellClass}>CONFIG</span>
                            <span className={buildPriorityTableHeaderCellClass}>Crew</span>
                            <span className={buildPriorityTableHeaderCellClass}></span>
                        </div>
                    </div>
                )}
                {currencyDraftEvents.map(draft => {
                    const isPublishedInActiveSchedule = activeCurrencyDraftIds.has(draft.id);
                    const isCurrencyMenuOpen = openCurrencyDraftId === draft.id;
                    const tileBaseClass = `${buildPriorityTableCellClass} flex min-h-[58px] w-full min-w-0 flex-col justify-center text-left shadow-sm ${isPublishedInActiveSchedule ? 'bg-green-950/20' : 'bg-cyan-950/80'}`;
                    const tileLabelClass = "mb-2 hidden text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500";
                    return (
                        <div
                            key={draft.id}
                            className={`min-w-[1152px] overflow-visible rounded-xl border border-cyan-500/25 bg-slate-900/45 shadow-lg shadow-black/10 transition-[padding-bottom] duration-200 ${isCurrencyMenuOpen ? 'pb-64' : ''} ${isPublishedInActiveSchedule ? 'text-green-300' : ''}`}
                        >
                            <div className={`${buildPriorityTableRowClass} grid-cols-[70px_190px_170px_160px_130px_360px_72px]`}>
                                <div className={`${buildPriorityTableCellClass} flex items-center justify-center bg-cyan-950/80`}>
                                    <input
                                        type="checkbox"
                                        checked={draft.selected}
                                        disabled={isPublishedInActiveSchedule}
                                        onChange={() => setCurrencyDraftEvents(prev => prev.map(event => event.id === draft.id ? { ...event, selected: !event.selected } : event))}
                                        className="h-4 w-4 rounded bg-slate-800 accent-cyan-500 disabled:opacity-40"
                                        aria-label="Select currency event for Higher Priority"
                                    />
                                </div>
                                <div className={`${tileBaseClass} flex flex-col`}>
                                    <div className={tileLabelClass}>Person</div>
                                    <div className={`min-w-0 truncate text-[12px] font-semibold leading-snug ${isPublishedInActiveSchedule ? 'text-green-300' : 'text-white'}`} title={draft.personName}>
                                        {draft.personName}
                                    </div>
                                </div>
                                <div className={`${tileBaseClass} flex flex-col`}>
                                    <div className={tileLabelClass}>Event</div>
                                    <select
                                        value={draft.currencyProfileName}
                                        disabled={isPublishedInActiveSchedule}
                                        onChange={(event) => applyCurrencyProfileToDraftEvent(draft.id, event.target.value)}
                                        className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <option value="">{draft.eventType === 'flight' ? 'CURR Flight' : `CURR ${ftdLabel}`}</option>
                                        {sctEvents.map(name => (
                                            <option key={`${draft.id}-${name}`} value={name}>{currencyProfileNameLabels[name] || name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={`${tileBaseClass} flex flex-col`}>
                                    <div className={tileLabelClass}>Currencies</div>
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenCurrencyDraftId(prev => prev === draft.id ? null : draft.id)}
                                            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-cyan-500/60"
                                        >
                                            {draft.selectedCurrencies.length > 0 ? `${draft.selectedCurrencies.length} selected` : 'Select'}
                                        </button>
                                        {isCurrencyMenuOpen && (
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
                                </div>
                                <div className={`${tileBaseClass} flex flex-col`}>
                                    <div className={tileLabelClass}>CONFIG</div>
                                    <AircraftConfigSelect
                                        value={draft.aircraftConfigId}
                                        definitions={aircraftConfigOptions}
                                        includeAny
                                        disabled={isPublishedInActiveSchedule || draft.eventType !== 'flight'}
                                        onChange={(aircraftConfigId) => setCurrencyDraftEvents(prev => prev.map(event =>
                                            event.id === draft.id ? { ...event, aircraftConfigId } : event
                                        ))}
                                    />
                                </div>
                                <div className={`${tileBaseClass} overflow-hidden`}>
                                    <CrewRequirementEditor
                                        value={draft.crewRequirement}
                                        aircraftCrewComposition={aircraftCrewComposition}
                                        crewPositionTerminology={crewPositionTerminology}
                                        operationalModel={operationalModel}
                                        compact
                                        showSummary={false}
                                        showAircraftDefaultSummary={false}
                                        headerClassName="text-center"
                                        aircraftDefaultOptionLabel="A/C default"
                                        onChange={(crewRequirement) => setCurrencyDraftEvents(prev => prev.map(event =>
                                            event.id === draft.id ? { ...event, crewRequirement } : event
                                        ))}
                                    />
                                </div>
                                <div className={`${buildPriorityTableCellClass} flex min-h-[58px] items-center justify-center bg-cyan-950/80`}>
                                    <button
                                        type="button"
                                        onClick={() => setCurrencyDraftEvents(prev => prev.filter(event => event.id !== draft.id))}
                                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center transition-opacity hover:opacity-75 focus:outline-none focus:ring-1 focus:ring-red-500/60"
                                        aria-label="Remove currency event"
                                    >
                                        <TrashIcon className="h-4 w-4" style={{ color: '#dc2626', stroke: '#dc2626' }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        )}

        <div className="highest-priority-events-card rounded-lg border border-emerald-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(52,211,153,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-sky-400">Highest Priority Events</h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Build date {formatPriorityDate(buildDfpDate)}
                    </p>
                </div>
                {stalePriorityEvents.length > 0 && (
                    <div className="rounded border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-right text-[11px] font-semibold text-amber-100">
                        {stalePriorityEvents.length} saved row{stalePriorityEvents.length === 1 ? '' : 's'} shown but only scheduled when the build date matches.
                    </div>
                )}
            </div>
            <PriorityEventTable events={standardPriorityEvents} />
        </div>

        {/* MEDIUM/LOW Priority Currency Events - hidden from the fixed crew planner for now; code retained for future reactivation. */}
        {showOptionalCurrencyEventsSection && (
        <div className="optional-currency-card rounded-lg border border-fuchsia-400/60 bg-slate-900 shadow-[0_0_0_1px_rgba(232,121,249,0.14),0_18px_36px_rgba(0,0,0,0.22)] p-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-2">Optional Currency Events</h2>
            <p className="text-xs text-gray-400 mb-4">MEDIUM and LOW priority currency events can be manually included in the NEO Build. Check the "Include" box to add to the build.</p>
            {sctFlights.filter(r => r.priority !== 'High').length === 0 && sctFtds.filter(r => r.priority !== 'High').length === 0 && (
              <p className="text-gray-500 text-sm italic">No MEDIUM or LOW priority currency events. Add {continuationShortLabel} or currency requests with MEDIUM or LOW priority in the {continuationCurrencyRequestsLabel} section above.</p>
            )}

              {/* Currency Flights - MEDIUM/LOW */}
              {sctFlights.filter(r => r.priority !== 'High').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">Currency Flights</h3>
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

              {/* Currency FTDs - MEDIUM/LOW */}
              {sctFtds.filter(r => r.priority !== 'High').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">Currency {ftdLabel}s</h3>
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
        )}

        {showRemedialPriorityQueue && (
        <div className="remedial-priority-card rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
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
        )}
        </div>
       </>
  );
};
