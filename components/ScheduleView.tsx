

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Conflict, Trainee, Instructor, FlyingWindowExclusionPeriod, FormationCallsign, EventLimits, type PhraseBank } from '../types';
import FlightTile from './FlightTile';
import AirframeColumn from './AirframeColumn';
import AircraftAvailabilityOverlay from './AircraftAvailabilityOverlay';
import { ScoringMatrixInline } from './SettingsView';
import PlatformConfigurationSettings from './PlatformConfigurationSettings';
import { DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { VisualAdjustGuide } from './VisualAdjustGuide';
import { AircraftNumberSettings, normaliseAircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { getOperationalModelLabel, getPlatformPermissionProfiles, getUnitOperationalModel, normaliseMasterLmpAccessRules, normaliseOperationalModel, OPERATIONAL_MODEL_OPTIONS } from '../utils/platformConfigService';
import { getTaskProfileAbbreviationsForUnit, getTaskProfilesForModel } from '../utils/taskProfiles';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { AIRCRAFT_CREW_RESOURCE_KINDS, normaliseAircraftCrewComposition } from '../utils/aircraftCrewComposition';
import { normaliseCrewCompositionSettings } from '../utils/crewCompositionProfiles';
import { getCrewPositionLabelMap, getCrewPositionOptions, normaliseCrewPositionTerminology } from '../utils/crewPositionTerminology';
import {
    getRankOrderFromEquivalency,
    normalisePersonnelDisplaySettings,
    RANK_EQUIVALENCY_PRESET_LABELS,
    RANK_EQUIVALENCY_PRESETS,
    type PersonnelDisplaySettings,
    type RankEquivalencyPresetKey,
} from '../utils/personnelDisplaySettings';
import { formatPersonDisplayName } from '../utils/personIdentity';
import {
    getInstructorQualificationDefinitions,
    normaliseStaffQualificationCatalogue,
    qualificationMatches,
} from '../utils/staffQualifications';
import { normaliseTrainingReportTemplate, normaliseTrainingReportTerminology } from '../utils/trainingReportTerminology';
import { getSctTerminology } from '../utils/sctTerminology';
import {
    UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS,
    getUnitCallsignPolicy,
    normaliseUnitCallsignSettings,
} from '../utils/unitCallsigns';
import { getResourceCategory as getConfiguredResourceCategory } from '../utils/resourceDisplayNames';
import { getEffectiveDispatchStaggerMinutes, type DispatchStaggerSettings } from '../utils/dispatchStagger';
import { DEFAULT_DISPATCH_RATE_WINDOW_MINUTES, normaliseDispatchRateWindowMinutes } from '../utils/dispatchRate';
import { endDfpDragDiagnostic, recordDfpDragFlushDiagnostic, recordDfpDragMoveDiagnostic, startDfpDragDiagnostic } from '../utils/dfpDragDiagnostics';
import { appendDfpMoveChangeTrace, isWatchingDfpMoveChangeEvent, summariseDfpMoveEvent, watchDfpMoveChangeEvents } from '../utils/dfpMoveChangeTrace';
import { getAdaptiveContextMenuPosition } from '../utils/contextMenuPosition';
import { DEFAULT_AIRFIELD_SOLAR_PROFILES } from '../utils/sunTimes';
import { downloadOrganisationStructureTemplateFile } from '../utils/organisationStructureTemplate';
import {
    isSetupTestMode as isSetupTestBrowserMode,
    readSetupTestPlatformConfig,
    readSetupTestSyllabus,
    writeSetupTestPlatformConfig,
    writeSetupTestSyllabus,
} from '../utils/setupTestMode';
   
declare const XLSX: any;

type AppUserPermission = 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';

interface ScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  onDateSelect?: (date: string) => void;
  snapshotDates?: string[];
  events: ScheduleEvent[];
  resources: string[];
  instructors: string[];
  traineesData: Trainee[];
  instructorsData?: Instructor[];
  timezoneOffset?: number;
  airframeCount: number;
  standbyCount: number;
  ftdCount: number;
  cptCount: number;
  onUpdateEvent: (updates: { eventId: string, newStartTime?: number, newResourceId?: string, newAircraftNumber?: string }[]) => void;
  onSelectEvent: (event: ScheduleEvent) => void;
  onReorderResources: (resources: string[]) => void;
  zoomLevel: number;
  showValidation: boolean;
  showPrePost: boolean;
  syllabusDetails: SyllabusItemDetail[];
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  seatConfigs: Map<string, string>;
  daylightTimes: { firstLight: string | null; lastLight: string | null };
  personnelConflicts: Conflict[];
  personnelConflictIds: Set<string>;
  unavailabilityConflicts: Map<string, string[]>;
  onCptConflict: (conflict: Conflict) => void;
  isMultiSelectMode: boolean;
  selectedEventIds: Set<string>;
  setSelectedEventIds: (ids: Set<string>) => void;
  baselineEvents?: ScheduleEvent[];
  isOracleMode: boolean;
  isNeoBuild?: boolean;
  oraclePreviewEvent: ScheduleEvent | null;
  isVisualAdjustMode?: boolean;
  visualAdjustEvent?: ScheduleEvent | null;
  onVisualAdjustTimeChange?: (startTime: number, endTime: number) => void;
  onOracleMouseDown: (startTime: number, resourceId: string) => void;
  onOracleMouseMove: (startTime: number, resourceId: string) => void;
  onOracleMouseUp: () => void;
  detectConflictsForEvent?: (event: ScheduleEvent, allEvents: ScheduleEvent[]) => { 
      hasConflict: boolean; 
      conflictingEventId: string | null; 
      conflictType: 'turnaround' | 'resource' | 'personnel' | null; 
      conflictedPersonnel: string | null 
  };
  showDepartureDensityOverlay: boolean;
  dispatchRateWindowMinutes?: number;
  showAircraftAvailability?: boolean;
  // NOTE: plannedAvailability and onUpdatePlannedAvailability removed.
  // The overlay is now independent from Build Factors.
  initialAvailability?: number; // seed value for new dates with no saved data
  apiBase?: string;             // passed to overlay for DB-backed persistence
  locationCode?: string;
  unitCode?: string;
  dayFlyingStart?: string;
  dayFlyingEnd?: string;
  onAvailabilityChange?: (record: any) => void;
  onUserAvailabilityChange?: (count: number, timestamp: Date) => void; // called ONLY when user drags the line
  isVisualAdjustMode?: boolean;
  visualAdjustEvent?: ScheduleEvent | null;
  onVisualAdjustTimeChange?: (startTime: number, endTime: number) => void;
  // Pause Flight Ops selection mode
  isPauseSelectMode?: boolean;
  pauseCompletedEventIds?: Set<string>;
  onPauseToggleCompleted?: (eventId: string) => void;
  // Alert status per event id
  alertsData?: Record<string, { responses?: Record<string, { status: string }> }>;
  formatResourceLabel?: (resourceId: string) => string;
  aircraftConfigLabelsByResource?: Record<string, string>;
  aircraftNumberSettings?: AircraftNumberSettings;
  flyingWindowExclusions?: FlyingWindowExclusionPeriod[];
  isReadOnly?: boolean;
  onOpenCurrentDfp?: () => void;
  onExternalEventDrop?: (event: ScheduleEvent, placement: { startTime: number; resourceId: string }) => void;
  diagnosticHighlightedEventIds?: Set<string>;
  platformConfig?: any;
  organisationSettings?: any;
  onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
  onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
  currentUserPermission?: AppUserPermission;
  canUsePlatformPermission?: (permissionId: string) => boolean;
  personnelDisplaySettings?: Partial<PersonnelDisplaySettings> | null;
  isSetupTestMode?: boolean;
  onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
  isNeoAssistPanelOpen?: boolean;
  isFlightLinePanelOpen?: boolean;
  onOrganisationSlideoutOpen?: () => void;
  onToggleFlightLinePanel?: () => void;
  canEditFlightLineInventory?: boolean;
  canEditFlightLineAvailability?: boolean;
  canEditFlightLineAvailabilityLink?: boolean;
  canEditTileAircraftNumber?: boolean;
  onLinkedAvailabilityChange?: (count: number) => void;
  onInitialSetupWizardActiveChange?: (active: boolean) => void;
  formationCallsigns?: FormationCallsign[];
  buildRuleSettings?: {
    maxDispatchPerHour?: number;
    dispatchRateWindowMinutes?: number;
    dispatchStaggerSettings?: DispatchStaggerSettings;
    preferredDutyPeriod?: number;
    maxCrewDutyPeriod?: number;
    flightTurnaround?: number;
    ftdTurnaround?: number;
    cptTurnaround?: number;
    eventLimits?: EventLimits;
  };
}

const PIXELS_PER_HOUR = 200;
const ROW_HEIGHT = 32;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const AIRFRAME_COLUMN_WIDTH = 108; // Header cell width (date selector)
const RESOURCE_COLUMN_WIDTH = 105; // Resource row header width.
const TIME_HEADER_HEIGHT = 40;
const DEFAULT_FLIGHT_LINE_UNAVAILABLE_REASONS = [
    'Maintenance',
    'Unserviceable',
    'Scheduled servicing',
    'Awaiting parts',
    'Fuel unavailable',
    'Configuration change',
];

const normaliseFlightLineUnavailableReasons = (value: unknown): string[] => {
    const rawValues = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/\r?\n|,/);
    const reasons = Array.from(new Set(rawValues
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)));
    return reasons.length > 0 ? reasons : DEFAULT_FLIGHT_LINE_UNAVAILABLE_REASONS;
};

const makeFlightLineMaintenanceTimestamp = (date: string): Date => {
    const now = new Date();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
    if (!match) return now;
    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
    );
};

const formatFlightLineMaintenanceWindowTime = (value?: string): string | null => {
    const match = /^(\d{1,2}):?(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    return `${match[1].padStart(2, '0')}${match[2]}`;
};

const isOverlapping = (f1: ScheduleEvent, f2: ScheduleEvent): boolean => {
    if (!f1 || !f2 || f1.duration <= 0 || f2.duration <= 0) return false;
    const f1_end = f1.startTime + f1.duration;
    const f2_end = f2.startTime + f2.duration;
    return f1.startTime < f2_end && f1_end > f2.startTime;
};

const getPersonnel = (event: ScheduleEvent): string[] => {
    const personnel = [];
    if (event.flightType === 'Solo') {
        if (event.pilot) personnel.push(event.pilot);
    } else {
        if (event.instructor) personnel.push(event.instructor);
        if (event.student) personnel.push(event.student);
    }
    if (event.attendees) personnel.push(...event.attendees);
    return personnel;
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

const checkIsChanged = (event: ScheduleEvent, baselineEvents: ScheduleEvent[] | undefined): boolean => {
    if (!baselineEvents) return false;
    const baseline = baselineEvents.find(b => b.id === event.id);
    if (!baseline) return true; // New event
    
    // Time comparison with epsilon for float precision
    const epsilon = 0.001;
    if (Math.abs(event.startTime - baseline.startTime) > epsilon) return true;
    if (Math.abs(event.duration - baseline.duration) > epsilon) return true;

    return (
        event.resourceId !== baseline.resourceId ||
        event.instructor !== baseline.instructor ||
        event.student !== baseline.student ||
        event.pilot !== baseline.pilot ||
        (event.area || '') !== (baseline.area || '')
    );
};

const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normaliseUnitTypeOptions = (platformConfig?: any): string[] => {
    const seen = new Set<string>();
    const sourceValues = Array.isArray(platformConfig?.unitTypes) ? platformConfig.unitTypes : [];
    const usedValues = Array.isArray(platformConfig?.units) ? platformConfig.units.map((unit: any) => unit?.unitType) : [];
    return [...sourceValues, ...usedValues]
        .map((value) => String(value || '').trim())
        .filter((value) => {
            if (!value) return false;
            const key = value.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const getResourceCategory = (res?: string) => {
    return getConfiguredResourceCategory(res);
};

const formatSnapshotDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
    }).replace(/ /g, '-');
};

type OrganisationChartNode = {
    id: string;
    label: string;
    levelName: string;
    levelIndex: number;
    unitCode?: string;
    children: OrganisationChartNode[];
};

const normaliseOrgChartValue = (value: unknown): string =>
    String(value || '').trim().replace(/\s+/g, ' ');

const normaliseOrgChartKey = (value: unknown): string =>
    normaliseOrgChartValue(value).toLowerCase();

const ORGANISATION_LABEL_ALIASES: Record<string, string> = {};

const getActiveOrganisation = (platformConfig: any): any => (
    (platformConfig?.organisations || []).find((organisation: any) => (
        String(organisation?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    )) || platformConfig?.organisations?.[0] || null
);

const getOrganisationStructureRootLabel = (activeOrganisation: any, levels: any[]): string => {
    const levelZeroOptions = Array.isArray(levels[0]?.options) ? levels[0].options : [];
    return normaliseOrgChartValue(levelZeroOptions[0])
        || normaliseOrgChartValue(activeOrganisation?.name || activeOrganisation?.code)
        || normaliseOrgChartValue(levels[0]?.name)
        || 'Organisation';
};

const getOrganisationRepairMaps = (platformConfig: any, levels: any[]): Map<number, Map<string, string>> => {
    const repairMaps = new Map<number, Map<string, string>>();
    const activeOrganisation = getActiveOrganisation(platformConfig);
    const structure = activeOrganisation?.settings?.organisationStructure || {};
    const rootLabel = getOrganisationStructureRootLabel(activeOrganisation, levels);
    const structuralReferencesByLevel = new Map<number, Set<string>>();
    const unitReferencesByLevel = new Map<number, Set<string>>();
    const addReference = (target: Map<number, Set<string>>, levelIndex: number, value: unknown) => {
        const key = normaliseOrgChartKey(value);
        if (!key) return;
        const current = target.get(levelIndex) || new Set<string>();
        current.add(key);
        target.set(levelIndex, current);
    };
    const relationshipPaths = Array.isArray(structure.relationshipPaths) ? structure.relationshipPaths : [];
    relationshipPaths.forEach((rawPath: unknown) => {
        const path = (Array.isArray(rawPath) ? rawPath : String(rawPath || '').split('>'))
            .map(normaliseOrgChartValue)
            .filter(Boolean);
        const startsAtRoot = normaliseOrgChartKey(path[0]) === normaliseOrgChartKey(rootLabel);
        path.forEach((part, pathIndex) => addReference(structuralReferencesByLevel, startsAtRoot ? pathIndex : pathIndex + 1, part));
    });
    (platformConfig?.units || []).forEach((unit: any) => {
        const rawPath = Array.isArray(unit?.settings?.parentOrganisationPath)
            ? unit.settings.parentOrganisationPath
            : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
        const path = rawPath.map(normaliseOrgChartValue).filter(Boolean);
        const startsAtRoot = normaliseOrgChartKey(path[0]) === normaliseOrgChartKey(rootLabel);
        path.forEach((part: unknown, pathIndex: number) => addReference(unitReferencesByLevel, startsAtRoot ? pathIndex : pathIndex + 1, part));
    });
    levels.forEach((level, levelIndex) => {
        const options = (Array.isArray(level?.options) ? level.options : []).map(normaliseOrgChartValue).filter(Boolean);
        if (options.length === 0) return;
        const optionKeys = new Set(options.map(normaliseOrgChartKey));
        const structuralReferences = structuralReferencesByLevel.get(levelIndex) || new Set<string>();
        const referenced = structuralReferences.size > 0
            ? structuralReferences
            : unitReferencesByLevel.get(levelIndex) || new Set<string>();
        const staleReferences = Array.from(referenced).filter((key) => key && !optionKeys.has(key));
        const unusedOptions = options.filter((option) => !referenced.has(normaliseOrgChartKey(option)));
        if (staleReferences.length === 1 && unusedOptions.length === 1) {
            repairMaps.set(levelIndex, new Map([[staleReferences[0], unusedOptions[0]]]));
        }
    });
    return repairMaps;
};

const getCanonicalOrganisationLabel = (
    levels: any[],
    repairMaps: Map<number, Map<string, string>>,
    levelIndex: number,
    value: unknown,
): string => {
    const label = normaliseOrgChartValue(value);
    if (!label) return '';
    const options = (Array.isArray(levels[levelIndex]?.options) ? levels[levelIndex].options : [])
        .map(normaliseOrgChartValue)
        .filter(Boolean);
    const alias = ORGANISATION_LABEL_ALIASES[normaliseOrgChartKey(label)];
    if (alias) {
        const aliasOption = options.find((option) => normaliseOrgChartKey(option) === normaliseOrgChartKey(alias));
        if (aliasOption) return aliasOption;
    }
    const exactOption = options.find((option) => normaliseOrgChartKey(option) === normaliseOrgChartKey(label));
    if (exactOption) return exactOption;
    return repairMaps.get(levelIndex)?.get(normaliseOrgChartKey(label)) || label;
};

const getSafeOrganisationLevelNames = (levels: any[], rootLabel: string): string[] => {
    const rootKey = normaliseOrgChartKey(rootLabel);
    return (Array.isArray(levels) ? levels : []).map((level: any, index: number) => {
        const rawName = normaliseOrgChartValue(level?.name);
        const optionKeys = new Set((Array.isArray(level?.options) ? level.options : []).map(normaliseOrgChartKey).filter(Boolean));
        if (index > 0 && (!rawName || normaliseOrgChartKey(rawName) === rootKey || optionKeys.has(normaliseOrgChartKey(rawName)))) {
            return `Level ${index + 1}`;
        }
        return rawName || `Level ${index}`;
    });
};

const cleanOrganisationChartDisplayPath = (path: string[], rootLabel: string): string[] => {
    const rootKey = normaliseOrgChartKey(rootLabel);
    const seenKeys = new Set<string>([rootKey]);
    const cleanPath: string[] = [];
    path.forEach((part) => {
        const cleanPart = normaliseOrgChartValue(part);
        const key = normaliseOrgChartKey(cleanPart);
        if (!cleanPart || !key || seenKeys.has(key)) return;
        cleanPath.push(cleanPart);
        seenKeys.add(key);
    });
    return cleanPath;
};

const addOrganisationChartPath = (
    root: OrganisationChartNode,
    path: string[],
    levelNames: string[],
    unitCode?: string,
) => {
    let cursor = root;
    path.forEach((rawPart, pathIndex) => {
        const label = normaliseOrgChartValue(rawPart);
        if (!label) return;
        const levelIndex = pathIndex + 1;
        const key = label.toLowerCase();
        let child = cursor.children.find((node) => node.label.toLowerCase() === key && node.levelIndex === levelIndex);
        if (!child) {
            child = {
                id: `${cursor.id}-${levelIndex}-${key.replace(/[^a-z0-9]+/g, '-') || 'node'}`,
                label,
                levelName: levelNames[levelIndex] || `Level ${levelIndex}`,
                levelIndex,
                children: [],
            };
            cursor.children.push(child);
        }
        cursor = child;
    });
    if (unitCode) {
        const label = normaliseOrgChartValue(unitCode);
        if (!label) return;
        const key = label.toLowerCase();
        if (!cursor.children.some((node) => node.unitCode?.toLowerCase() === key || node.label.toLowerCase() === key)) {
            cursor.children.push({
                id: `${cursor.id}-unit-${key.replace(/[^a-z0-9]+/g, '-') || 'unit'}`,
                label,
                levelName: 'Unit',
                levelIndex: cursor.levelIndex + 1,
                unitCode: label,
                children: [],
            });
        }
    }
};

const buildOrganisationChart = (platformConfig: any): OrganisationChartNode | null => {
    const activeOrganisation = getActiveOrganisation(platformConfig);
    if (!activeOrganisation) return null;
    const structure = activeOrganisation?.settings?.organisationStructure || {};
    const levels = Array.isArray(structure.levels) ? structure.levels : [];
    const rootLabel = getOrganisationStructureRootLabel(activeOrganisation, levels);
    const levelNames = getSafeOrganisationLevelNames(levels, rootLabel);
    const root: OrganisationChartNode = {
        id: 'org-root',
        label: rootLabel,
        levelName: levelNames[0] || 'Level 0',
        levelIndex: 0,
        children: [],
    };
    const rootKey = root.label.toLowerCase();
    const repairMaps = getOrganisationRepairMaps(platformConfig, levels);
    const relationshipPaths = Array.isArray(structure.relationshipPaths) ? structure.relationshipPaths : [];
    relationshipPaths.forEach((rawPath: unknown) => {
        const path = (Array.isArray(rawPath) ? rawPath : String(rawPath || '').split('>'))
            .map(normaliseOrgChartValue)
            .filter(Boolean);
        const startsAtRoot = path[0]?.toLowerCase() === rootKey;
        const canonicalPath = path.map((part, pathIndex) => (
            getCanonicalOrganisationLabel(levels, repairMaps, startsAtRoot ? pathIndex : pathIndex + 1, part)
        ));
        const displayPath = cleanOrganisationChartDisplayPath(startsAtRoot ? canonicalPath.slice(1) : canonicalPath, rootLabel);
        addOrganisationChartPath(root, displayPath, levelNames);
    });
    const activeOrganisationCode = normaliseOrgChartValue(activeOrganisation.code).toLowerCase();
    (platformConfig?.units || [])
        .filter((unit: any) => (
            String(unit?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
            && (!activeOrganisationCode || normaliseOrgChartValue(unit?.organisationCode).toLowerCase() === activeOrganisationCode)
        ))
        .forEach((unit: any) => {
            const unitCode = normaliseOrgChartValue(unit?.code || unit?.name);
            if (!unitCode) return;
            const rawPath = Array.isArray(unit?.settings?.parentOrganisationPath)
                ? unit.settings.parentOrganisationPath
                : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
            const path = rawPath.map(normaliseOrgChartValue).filter(Boolean);
            const startsAtRoot = normaliseOrgChartKey(path[0]) === rootKey;
            const parentPath = path
                .map((part: unknown, pathIndex: number) => getCanonicalOrganisationLabel(levels, repairMaps, startsAtRoot ? pathIndex : pathIndex + 1, part))
                .filter(Boolean);
            const displayPath = cleanOrganisationChartDisplayPath(parentPath[0]?.toLowerCase() === rootKey ? parentPath.slice(1) : parentPath, rootLabel);
            if (displayPath.length === 0) return;
            addOrganisationChartPath(root, displayPath, levelNames, unitCode);
        });
    if (root.children.length === 0) {
        levels.slice(1).forEach((level: any) => {
            (Array.isArray(level?.options) ? level.options : [])
                .map(normaliseOrgChartValue)
                .filter(Boolean)
                .forEach((option: string) => addOrganisationChartPath(root, cleanOrganisationChartDisplayPath([option], rootLabel), levelNames));
        });
    }
    const sortNodes = (node: OrganisationChartNode) => {
        node.children.sort((a, b) => {
            if (a.levelIndex !== b.levelIndex) return a.levelIndex - b.levelIndex;
            if (a.unitCode && !b.unitCode) return 1;
            if (!a.unitCode && b.unitCode) return -1;
            return a.label.localeCompare(b.label);
        });
        node.children.forEach(sortNodes);
    };
    sortNodes(root);
    return root;
};

const findOrganisationChartPath = (node: OrganisationChartNode, nodeId: string, path: OrganisationChartNode[] = []): OrganisationChartNode[] | null => {
    const nextPath = [...path, node];
    if (node.id === nodeId) return nextPath;
    for (const child of node.children) {
        const childPath = findOrganisationChartPath(child, nodeId, nextPath);
        if (childPath) return childPath;
    }
    return null;
};

const getOrganisationChartBoxWidth = (node: OrganisationChartNode, isRoot = false): number => {
    if (isRoot) return 190;
    if (node.levelIndex === 2) return 84;
    if (node.levelIndex >= 3) return 66;
    return 132;
};

const estimateOrganisationChartBoxHeight = (node: OrganisationChartNode, isRoot = false): number => {
    const width = getOrganisationChartBoxWidth(node, isRoot);
    const compact = node.levelIndex >= 2 && !isRoot;
    const labelFontSize = compact ? 10 : 12;
    const labelLineHeight = compact ? 11.2 : 14.4;
    const levelLineHeight = compact ? 9 : 11;
    const horizontalPadding = compact ? 12 : 20;
    const verticalPadding = compact ? 14 : 18;
    const averageCharacterWidth = labelFontSize * 0.58;
    const usableWidth = Math.max(24, width - horizontalPadding);
    const charactersPerLine = Math.max(4, Math.floor(usableWidth / averageCharacterWidth));
    const words = normaliseOrgChartValue(node.label).split(/\s+/).filter(Boolean);
    let lineCount = 1;
    let lineLength = 0;
    words.forEach((word) => {
        const wordLength = Math.max(1, word.length);
        if (wordLength > charactersPerLine) {
            if (lineLength > 0) lineCount += 1;
            lineCount += Math.ceil(wordLength / charactersPerLine) - 1;
            lineLength = wordLength % charactersPerLine;
            return;
        }
        const nextLength = lineLength ? lineLength + 1 + wordLength : wordLength;
        if (nextLength > charactersPerLine) {
            lineCount += 1;
            lineLength = wordLength;
        } else {
            lineLength = nextLength;
        }
    });
    const levelHeight = isRoot ? 0 : levelLineHeight + 3;
    const minimumHeight = isRoot ? 62 : compact ? 54 : 62;
    return Math.max(minimumHeight, Math.ceil(verticalPadding + levelHeight + (lineCount * labelLineHeight)));
};

const getOrganisationChartLevelHeights = (root: OrganisationChartNode): Map<number, number> => {
    const heights = new Map<number, number>();
    const visit = (node: OrganisationChartNode, isRoot = false) => {
        const height = estimateOrganisationChartBoxHeight(node, isRoot);
        heights.set(node.levelIndex, Math.max(heights.get(node.levelIndex) || 0, height));
        node.children.forEach((child) => visit(child, false));
    };
    visit(root, true);
    return heights;
};

const getVisibleOrganisationChartChildren = (
    node: OrganisationChartNode,
    focusedPath: OrganisationChartNode[] | null,
    selectedPathIds: Set<string>,
): OrganisationChartNode[] => (
    node.children.filter((child) => {
        if (!focusedPath || node.levelIndex < 3) return child.levelIndex <= 3;
        return selectedPathIds.has(node.id);
    })
);

const getOrganisationChartVisibleMetrics = (
    root: OrganisationChartNode,
    levelHeights: Map<number, number>,
    focusedPath: OrganisationChartNode[] | null,
    selectedPathIds: Set<string>,
) => {
    const levelWidths = new Map<number, number>();
    const levelCounts = new Map<number, number>();
    let maxLevel = 0;
    const visit = (node: OrganisationChartNode, isRoot = false) => {
        const width = getOrganisationChartBoxWidth(node, isRoot);
        const level = node.levelIndex;
        maxLevel = Math.max(maxLevel, level);
        levelWidths.set(level, (levelWidths.get(level) || 0) + width);
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        getVisibleOrganisationChartChildren(node, focusedPath, selectedPathIds)
            .forEach((child) => visit(child, false));
    };
    visit(root, true);
    let width = 0;
    levelWidths.forEach((rowWidth, level) => {
        const count = levelCounts.get(level) || 1;
        width = Math.max(width, rowWidth + Math.max(0, count - 1) * 20 + 72);
    });
    let height = 32;
    for (let level = 0; level <= maxLevel; level += 1) {
        height += levelHeights.get(level) || 54;
        if (level < maxLevel) height += level >= 3 ? 76 : 42;
    }
    return {
        width: Math.max(560, Math.ceil(width)),
        height: Math.max(320, Math.ceil(height + 36)),
    };
};

const OrganisationChartBranch: React.FC<{
    node: OrganisationChartNode;
    isRoot?: boolean;
    levelHeights: Map<number, number>;
    selectedNodeId: string | null;
    selectedPathIds: Set<string>;
    focusedPath: OrganisationChartNode[] | null;
    onSelectNode: (node: OrganisationChartNode) => void;
}> = ({ node, isRoot = false, levelHeights, selectedNodeId, selectedPathIds, focusedPath, onSelectNode }) => (
    <li className={`${node.levelIndex >= 2 ? 'org-chart-compact-node ' : ''}org-chart-node-level-${node.levelIndex}`}>
        <button
            type="button"
            className={`org-chart-box org-chart-box-level-${node.levelIndex} ${isRoot ? 'org-chart-box-root' : ''} ${node.levelIndex >= 2 ? 'org-chart-box-compact' : ''} ${node.unitCode ? 'org-chart-box-unit' : ''} ${selectedPathIds.has(node.id) ? 'org-chart-box-active-chain' : ''} ${selectedNodeId === node.id ? 'org-chart-box-selected' : ''}`}
            style={{ height: `${levelHeights.get(node.levelIndex) || estimateOrganisationChartBoxHeight(node, isRoot)}px` }}
            data-org-node-id={node.id}
            title={isRoot ? node.label : `${node.levelName}: ${node.label}`}
            onClick={() => onSelectNode(node)}
        >
            {!isRoot && <span className="org-chart-level">{node.levelName}</span>}
            <span className="org-chart-label">{node.label}</span>
        </button>
        {(() => {
            const visibleChildren = getVisibleOrganisationChartChildren(node, focusedPath, selectedPathIds);
            if (visibleChildren.length === 0) return null;
            const useDrilldownRow = Boolean(focusedPath && selectedPathIds.has(node.id) && node.levelIndex >= 3);
            return (
                <ul className={useDrilldownRow ? 'org-chart-drilldown-row' : undefined}>
                    {visibleChildren.map((child) => (
                        <OrganisationChartBranch
                            key={child.id}
                            node={child}
                            levelHeights={levelHeights}
                            selectedNodeId={selectedNodeId}
                            selectedPathIds={selectedPathIds}
                            focusedPath={focusedPath}
                            onSelectNode={onSelectNode}
                        />
                    ))}
                </ul>
            );
        })()}
    </li>
);

const EmptyOrganisationChartSet = new Set<string>();

type OrganisationSlideoutView = 'structure' | 'unitSettings' | 'setupWizard';
type InitialSetupWizardMode = 'detect' | 'active';

type InitialSetupWizardTemplate = {
    id: string;
    label: string;
    fileName: string;
    requiredHeaders: string[];
    optionalHeaders?: string[];
    exampleRows: string[][];
    settingsSection: string;
    focusSubsectionId?: string;
};

type InitialSetupWizardUploadResult = {
    status: 'idle' | 'valid' | 'error';
    fileName?: string;
    rowCount?: number;
    message: string;
    issues?: string[];
    headers?: string[];
    dataRows?: string[][];
};

type InitialSetupWizardCheck = {
    id: string;
    label: string;
    mandatory: boolean;
    complete: boolean;
    summary: string;
    settingsSection: string;
    focusSubsectionId?: string;
};

type InitialSetupWizardCategory = 'mandatory' | 'highly-desirable' | 'optional' | 'follow-on' | 'review';

type InitialSetupWizardStep = {
    id: string;
    title: string;
    label: string;
    body: string;
    checkIds: string[];
    category: InitialSetupWizardCategory;
    optional?: boolean;
};

const organisationSlideoutActiveButtonClass = 'btn-aluminium-brushed inline-flex h-9 w-40 items-center justify-center rounded-md px-3 text-center text-[11px] font-semibold text-[#143142]';
const organisationSlideoutInactiveButtonClass = 'btn-aluminium-brushed inline-flex h-9 w-40 items-center justify-center rounded-md px-3 text-center text-[11px] font-semibold text-[#143142]';
const unitSettingsPanelClass = 'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-[0_18px_44px_rgba(0,0,0,0.22)] backdrop-blur';
const unitSettingsLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400';
const unitSettingsInputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60';
const unitSettingsSelectClass = `${unitSettingsInputClass} cursor-pointer`;
const unitSettingsRowClass = 'grid gap-2 border-t border-white/10 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(150px,0.65fr)_minmax(0,1fr)] md:items-center';
const unitSettingsMutedPillClass = 'rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[11px] font-semibold text-slate-300';
const unitSettingsScrollClass = 'max-w-full overflow-x-auto';
const deploymentModeOptions = ['Online SaaS', 'Private Network', 'Fully Offline', 'Hybrid Offline Sync'];
const licenceValidationOptions = ['Online licence check', 'Private network licence server', 'Offline signed licence file', 'Hybrid cached licence'];
const licenceEnforcementOptions = ['Monitor Only', 'Warn Only', 'Block Expired Licence'];
const authModelOptions = ['Local accounts', 'Organisation SSO', 'Hybrid local and organisation SSO'];
const releaseChannelOptions = ['Production', 'Staging', 'Customer Acceptance', 'Offline Package'];
const backupFrequencyOptions = ['Hourly', 'Daily', 'Weekly', 'Manual'];
const accreditationStatusOptions = ['Not started', 'In preparation', 'Submitted', 'Approved', 'Renewal due'];
const initialSetupWizardStorageKey = 'dfp-initial-setup-wizard-step';
const initialSetupWizardOrganisationDraftStorageKey = 'dfp-initial-setup-wizard-organisation-draft';
const initialSetupWizardCompletedStepsStorageKey = 'dfp-initial-setup-wizard-completed-steps';
const MAX_INITIAL_SETUP_ORGANISATION_LEVELS = 12;
const createWizardRecordId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createSetupTestRecordId = (prefix: string, key = ''): string => {
    const cleanPrefix = String(prefix || 'record').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'record';
    const cleanKey = String(key || cleanPrefix).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || cleanPrefix;
    return `setup-test-${cleanPrefix}-${cleanKey}`;
};

const initialSetupTemplates: InitialSetupWizardTemplate[] = [
    {
        id: 'organisation',
        label: 'Organisation structure',
        fileName: 'DFP_NEO_Organisation_Structure_Template.csv',
        requiredHeaders: ['Level', 'Name'],
        optionalHeaders: ['Parent', 'Notes'],
        exampleRows: [
            ['0', 'Organisation', '', 'Top level organisation'],
            ['1', 'Organisation Level 1', 'Organisation', 'Branch, command, region, division, or equivalent'],
            ['2', 'Organisation Level 2', 'Organisation Level 1', 'Operating group, department, wing, team, or equivalent'],
        ],
        settingsSection: 'platform-organisation-locations',
        focusSubsectionId: 'platform-organisation-structure',
    },
    {
        id: 'locations',
        label: 'Locations and bases',
        fileName: 'DFP_NEO_Locations_Template.csv',
        requiredHeaders: ['Code', 'Name', 'Timezone'],
        optionalHeaders: ['Training Areas', 'Notes'],
        exampleRows: [
            ['LOC-01', 'Location Name', 'UTC', 'Area 1; Area 2', 'Operating location'],
            ['LOC-02', 'Second Location Name', 'UTC', 'Area 3; Area 4', 'Additional operating location'],
        ],
        settingsSection: 'platform-organisation-locations',
        focusSubsectionId: 'platform-locations',
    },
    {
        id: 'units',
        label: 'Units and ownership',
        fileName: 'DFP_NEO_Units_Template.csv',
        requiredHeaders: ['Unit Code', 'Unit Name', 'Location', 'Unit Type', 'Operating Model'],
        optionalHeaders: ['Parent Organisation', 'Trainees', 'Notes'],
        exampleRows: [
            ['UNIT-01', 'Unit Name', 'LOC-01', 'Operational', 'Pooled Crew Model', 'Organisation / Organisation Level 1 / Organisation Level 2', 'No', ''],
            ['UNIT-02', 'Training Unit Name', 'LOC-01', 'Training', 'Flight School Model', 'Organisation / Organisation Level 1 / Organisation Level 2', 'Yes', ''],
        ],
        settingsSection: 'platform-units',
    },
    {
        id: 'resources',
        label: 'DFP resource rows',
        fileName: 'DFP_NEO_Resource_Pools_Template.csv',
        requiredHeaders: ['Pool Name', 'Aircraft Type', 'Unit', 'Location', 'Aircraft', 'Sim', 'Trainer', 'Standby', 'Ground'],
        optionalHeaders: ['Notes'],
        exampleRows: [
            ['DFP Resource Rows', 'Aircraft Type', 'UNIT-01', 'LOC-01', '4', '0', '0', '1', '0', ''],
        ],
        settingsSection: 'platform-dfp-resource-rows',
    },
    {
        id: 'staff',
        label: 'Staff',
        fileName: 'DFP_NEO_Staff_Template.csv',
        requiredHeaders: ['Name', 'Unit', 'Role'],
        optionalHeaders: ['Rank', 'Personnel ID', 'Qualifications', 'Email'],
        exampleRows: [
            ['Surname, First', 'UNIT-01', 'Role', 'Rank', '4000001', 'Qualification 1; Qualification 2', 'person@example.com'],
        ],
        settingsSection: 'staff-database',
    },
    {
        id: 'trainees',
        label: 'Trainees',
        fileName: 'DFP_NEO_Trainees_Template.csv',
        requiredHeaders: ['Name', 'Unit'],
        optionalHeaders: ['Rank', 'Personnel ID', 'Course Number', 'Course', 'Start Date', 'Master LMP'],
        exampleRows: [
            ['Surname, First', 'UNIT-02', 'Rank', '4000002', '1', 'Course Name', '2026-01-15', 'Master LMP Name'],
        ],
        settingsSection: 'trainee-database',
    },
    {
        id: 'courses',
        label: 'Courses and LMP events',
        fileName: 'DFP_NEO_Courses_Template.csv',
        requiredHeaders: ['Master LMP', 'Event Code', 'Event Title', 'Type', 'Duration Minutes'],
        optionalHeaders: ['Aircraft Type', 'Crew Required', 'Pre Flight Minutes', 'Post Flight Minutes'],
        exampleRows: [
            ['Master LMP Name', 'EVENT-001', 'Training event', 'Flight', '90', 'Aircraft Type', 'Crew Role 1, Crew Role 2', '90', '60'],
        ],
        settingsSection: 'platform-master-lmp-access',
    },
    {
        id: 'scoring',
        label: 'Scoring matrix',
        fileName: 'DFP_NEO_Scoring_Matrix_Template.csv',
        requiredHeaders: ['Dimension'],
        optionalHeaders: ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Pass Standard', 'Fail Standard', 'Notes'],
        exampleRows: [
            ['Preparation', 'Not safe', 'Needs major help', 'Needs help', 'Meets standard', 'Above standard', 'Excellent', 'Prepared, safe and able to continue training.', 'Unsafe or not prepared for the event.', ''],
            ['Airmanship', 'Unsafe', 'Weak judgement', 'Developing', 'Meets standard', 'Strong', 'Excellent', 'Maintains safe judgement and prioritises appropriately.', 'Poor judgement or unsafe prioritisation.', ''],
        ],
        settingsSection: 'platform-training-report-template',
        focusSubsectionId: 'platform-unit-training-report-template',
    },
];

const getWizardTemplateHeaders = (template: InitialSetupWizardTemplate): string[] => [
    ...template.requiredHeaders,
    ...(template.optionalHeaders || []),
];

const normaliseWizardHeader = (value: unknown): string => (
    String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
);

const wizardRequiredHeaderAliases: Record<string, string[]> = {
    name: ['fullname', 'nameandsurname', 'namesurnamefirstname', 'namesurnamefirstnames', 'surnamefirstname', 'surnamefirstnames', 'surname', 'lastname', 'familyname', 'givennames', 'givenname', 'firstname', 'forename'],
    role: ['position', 'crewrole', 'primaryrole'],
    qualifications: ['qualification', 'qualificationsandroles', 'qualificationsroles', 'quals', 'roles'],
    personnelId: ['personnelid', 'personid', 'staffid', 'employeeid', 'serviceid', 'employeenumber', 'personnelnumber'],
    code: ['icao', 'locationcode', 'basecode'],
    aircrafttype: ['aircraft', 'resource'],
    course: ['courseallocation', 'allocatedcourse', 'courseassigned', 'trainingcourse'],
    coursenumber: ['courseno', 'coursenum', 'courseid', 'coursecode'],
    masterlmp: ['masterlmpname', 'lmp', 'lmpname'],
    eventcode: ['code', 'eventid', 'eventnumber'],
    eventtitle: ['eventdescription', 'description', 'eventname', 'title'],
    durationminutes: ['duration', 'durationmins', 'durationmin', 'totaldurationminutes', 'totaldurationmins'],
    startdate: ['start', 'coursestart', 'startdt'],
};

const wizardHeaderMatchesRequired = (headerKeys: Set<string>, requiredHeader: string): boolean => {
    const requiredKey = normaliseWizardHeader(requiredHeader);
    const acceptedKeys = [requiredKey, ...(wizardRequiredHeaderAliases[requiredKey] || [])];
    return acceptedKeys.some((key) => headerKeys.has(key));
};

const getWizardCellByHeader = (headers: string[], row: string[], headerName: string): string => {
    const requiredKey = normaliseWizardHeader(headerName);
    const acceptedKeys = [requiredKey, ...(wizardRequiredHeaderAliases[requiredKey] || [])];
    const index = headers.findIndex((header) => acceptedKeys.includes(normaliseWizardHeader(header)));
    return index >= 0 ? String(row[index] || '').trim() : '';
};

const getWizardCellByAnyHeader = (headers: string[], row: string[], headerNames: string[]): string => {
    for (const headerName of headerNames) {
        const value = getWizardCellByHeader(headers, row, headerName);
        if (value) return value;
    }
    return '';
};

const getWizardSourceRowObject = (headers: string[], row: string[]): Record<string, string> => (
    headers.reduce((source, header, index) => {
        const cleanHeader = String(header || '').trim();
        if (!cleanHeader) return source;
        return {
            ...source,
            [cleanHeader]: String(row[index] || '').trim(),
        };
    }, {} as Record<string, string>)
);

const findWizardTemplateHeaderRowIndex = (rows: string[][], template: InitialSetupWizardTemplate): number => {
    const exactIndex = rows.findIndex((row) => {
        const headerKeys = new Set(row.map(normaliseWizardHeader).filter(Boolean));
        return template.requiredHeaders.every((header) => wizardHeaderMatchesRequired(headerKeys, header));
    });
    return exactIndex >= 0 ? exactIndex : 0;
};

const downloadWizardTemplate = (template: InitialSetupWizardTemplate) => {
    if (template.id === 'organisation') {
        downloadOrganisationStructureTemplateFile(template.fileName);
        return;
    }
    const rows = [
        getWizardTemplateHeaders(template),
        ...template.exampleRows,
    ];
    if (typeof XLSX !== 'undefined') {
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, template.label.slice(0, 28));
        XLSX.writeFile(workbook, template.fileName.replace(/\.csv$/i, '.xlsx'));
        return;
    }
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const parseWizardCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"' && quoted && next === '"') {
            cell += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === ',' && !quoted) {
            row.push(cell.trim());
            cell = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') index += 1;
            row.push(cell.trim());
            if (row.some((value) => value)) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    row.push(cell.trim());
    if (row.some((value) => value)) rows.push(row);
    return rows;
};

const readWizardTemplateRows = async (file: File): Promise<string[][]> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls'].includes(extension || '')) {
        if (typeof XLSX === 'undefined') throw new Error('Excel support is not available in this browser session.');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) return [];
        return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' });
    }
    const text = await file.text();
    return parseWizardCsvRows(text);
};

const validateWizardTemplateFile = async (
    template: InitialSetupWizardTemplate,
    file: File,
): Promise<InitialSetupWizardUploadResult> => {
    const rows = await readWizardTemplateRows(file);
    const headerRowIndex = findWizardTemplateHeaderRowIndex(rows, template);
    const headers = (rows[headerRowIndex] || []).map((cell) => String(cell || '').trim()).filter(Boolean);
    const headerKeys = new Set(headers.map(normaliseWizardHeader));
    const missingHeaders = template.requiredHeaders.filter((header) => !wizardHeaderMatchesRequired(headerKeys, header));
    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell || '').trim()));
    const issues: string[] = [];
    if (headers.length === 0) issues.push('The first row needs column headers.');
    if (missingHeaders.length > 0) issues.push(`Missing required column${missingHeaders.length === 1 ? '' : 's'}: ${missingHeaders.join(', ')}.`);
    if (dataRows.length === 0) issues.push('No setup rows were found below the headers.');
    if (issues.length > 0) {
        return {
            status: 'error',
            fileName: file.name,
            rowCount: dataRows.length,
            message: `I checked ${file.name}, but it is not ready to import yet.`,
            issues: [
                ...issues,
                `Example: the ${template.label} template should include ${template.requiredHeaders.join(', ')}.`,
            ],
        };
    }
    return {
        status: 'valid',
        fileName: file.name,
        rowCount: dataRows.length,
        message: `${file.name} looks ready. ${dataRows.length} row${dataRows.length === 1 ? '' : 's'} passed the basic format check.`,
        headers,
        dataRows,
    };
};

const normaliseUnitSettingsIdentifier = (value: unknown): string => String(value || '').trim().toUpperCase();

const getOffsetHoursForTimezone = (timeZone: unknown, at: Date = new Date()): number | null => {
    const cleanTimeZone = String(timeZone || '').trim();
    if (!cleanTimeZone) return null;
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: cleanTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(at);
        const values = new Map(parts.map((part) => [part.type, part.value]));
        const year = Number(values.get('year'));
        const month = Number(values.get('month'));
        const day = Number(values.get('day'));
        const hour = Number(values.get('hour'));
        const minute = Number(values.get('minute'));
        const second = Number(values.get('second'));
        if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) return null;

        const timezoneAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
        const actualUtc = Date.UTC(
            at.getUTCFullYear(),
            at.getUTCMonth(),
            at.getUTCDate(),
            at.getUTCHours(),
            at.getUTCMinutes(),
            at.getUTCSeconds(),
        );
        return Math.round((timezoneAsUtc - actualUtc) / 60000) / 60;
    } catch {
        return null;
    }
};

const getSystemUtcOffsetHours = (): number => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    return Math.round((offsetMinutes / 60) * 2) / 2;
};

const locationMatchesKey = (location: any, key: string): boolean => {
    if (!key) return false;
    return [
        location?.code,
        location?.iataCode,
        location?.icao,
        location?.icaoCode,
        location?.settings?.iataCode,
        location?.settings?.icaoCode,
        location?.settings?.legacyCode,
        ...(Array.isArray(location?.aliases) ? location.aliases : []),
        ...(Array.isArray(location?.settings?.aliases) ? location.settings.aliases : []),
    ].some((value) => normaliseUnitSettingsIdentifier(value) === key);
};

const makeWizardResourcePoolCode = (locationCode: unknown, unitCode: unknown, aircraftCode: unknown): string => {
    const parts = [locationCode, unitCode, aircraftCode]
        .map((part) => normaliseUnitSettingsIdentifier(part).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, ''))
        .filter(Boolean);
    return [...parts, 'ROWS'].join('-') || '';
};

const getOrganisationMasterLmpAccessRules = (settings: any): any[] => (
    normaliseMasterLmpAccessRules({ organisations: [{ settings: settings || {} }] } as any)
);

const formatPlainList = (items: string[], fallback = 'Not set'): string => {
    const cleanItems = items.map((item) => String(item || '').trim()).filter(Boolean);
    return cleanItems.length > 0 ? cleanItems.join(' / ') : fallback;
};

const formatRoleRequirementsText = (requirements: any[] = []): string => (
    requirements.map((requirement) => `${requirement.role || 'Crew'} = ${requirement.count ?? 1}`).join('\n')
);

const parseRoleRequirementsText = (value: string): any[] => (
    String(value || '')
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [rolePart, countPart] = line.includes('=') ? line.split('=') : line.split(':');
            const role = String(rolePart || '').trim() || 'Crew';
            const count = Math.max(1, Math.round(Number(String(countPart || '1').trim()) || 1));
            return { role, count };
        })
);

const updateWizardRoleRequirementText = (value: string, index: number, field: 'role' | 'count', nextValue: string): string => {
    const rows = parseRoleRequirementsText(value);
    while (rows.length <= index) rows.push({ role: 'Crew', count: 1 });
    rows[index] = {
        ...rows[index],
        [field]: field === 'count' ? Math.max(1, Math.round(Number(nextValue) || 1)) : nextValue,
    };
    return formatRoleRequirementsText(rows);
};

const removeWizardRoleRequirementText = (value: string, index: number): string => (
    formatRoleRequirementsText(parseRoleRequirementsText(value).filter((_, rowIndex) => rowIndex !== index))
);

const parseWizardCrewLabelRows = (value: string): Array<{ term: string; label: string }> => (
    String(value || '').split(/\n/).map((line) => {
        const [termPart, labelPart] = line.includes('=') ? line.split('=') : line.split(':');
        const term = String(termPart || '').replace(/\s$/, '');
        return {
            term,
            label: String(labelPart || term).replace(/^\s/, ''),
        };
    }).filter((row) => row.term || row.label)
);

const formatWizardCrewLabelRows = (rows: Array<{ term?: string; label?: string }>): string => (
    rows
        .filter((row) => row.term || row.label)
        .map((row) => `${String(row.term || '')}=${String(row.label || '')}`)
        .join('\n')
);

const formatWizardBuildRulesDraft = (draft: {
    businessRules: string;
    maxCrewDutyHours: string;
    preferredDutyHours: string;
    aircraftTurnaroundMinutes: string;
    simTurnaroundMinutes: string;
    trainerTurnaroundMinutes: string;
    maxDispatchPerHour: string;
    maxEventsPerDay: string;
    maxFlightsPerDay: string;
    minGapBetweenEventsMinutes: string;
}) => (
    [
        `Business rules: ${draft.businessRules || 'Use configured rule set'}`,
        `Maximum crew duty: ${draft.maxCrewDutyHours || '12'} hours`,
        `Preferred duty period: ${draft.preferredDutyHours || '10'} hours`,
        `Aircraft turnaround: ${draft.aircraftTurnaroundMinutes || '60'} minutes`,
        `Simulator turnaround: ${draft.simTurnaroundMinutes || '30'} minutes`,
        `Trainer turnaround: ${draft.trainerTurnaroundMinutes || '30'} minutes`,
        `Maximum dispatch per hour: ${draft.maxDispatchPerHour || '2'}`,
        `Maximum events per day: ${draft.maxEventsPerDay || 'Not set'}`,
        `Maximum flights per day: ${draft.maxFlightsPerDay || 'Not set'}`,
        `Minimum gap between events: ${draft.minGapBetweenEventsMinutes || '0'} minutes`,
    ].join('\n')
);

const parseWizardStaffRows = (value: string): Array<{ surname: string; givenNames: string; unit: string; position: string; personnelId: string; qualifications: string }> => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split('|').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        const namePart = parts[0] || '';
        const [surnamePart, givenPart] = namePart.includes(',')
            ? namePart.split(',').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')))
            : ['', namePart];
        const hasPersonnelIdColumn = parts.length >= 5;
        return {
            surname: surnamePart || '',
            givenNames: givenPart || '',
            unit: parts[1] || '',
            position: parts[2] || '',
            personnelId: hasPersonnelIdColumn ? parts[3] || '' : '',
            qualifications: hasPersonnelIdColumn ? parts[4] || '' : parts[3] || '',
        };
    }).filter((row) => row.surname || row.givenNames || row.unit || row.position || row.personnelId || row.qualifications)
);

const formatWizardStaffRows = (rows: Array<{ surname?: string; givenNames?: string; unit?: string; position?: string; personnelId?: string; qualifications?: string }>): string => (
    rows
        .filter((row) => row.surname || row.givenNames || row.unit || row.position || row.personnelId || row.qualifications)
        .map((row) => {
            const surname = String(row.surname || '');
            const givenNames = String(row.givenNames || '');
            const name = surname && givenNames ? `${surname}, ${givenNames}` : surname || givenNames;
            return [name, String(row.unit || ''), String(row.position || ''), String(row.personnelId || ''), String(row.qualifications || '')].join('|');
        })
        .join('\n')
);

const parseWizardTraineeRows = (value: string): Array<{ surname: string; givenNames: string; unit: string; rank: string; personnelId: string; courseNumber: string; course: string; masterLmp: string; startDate: string }> => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split('|').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        const namePart = parts[0] || '';
        const [surnamePart, givenPart] = namePart.includes(',')
            ? namePart.split(',').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')))
            : ['', namePart];
        return {
            surname: surnamePart || '',
            givenNames: givenPart || '',
            unit: parts[1] || '',
            rank: parts[2] || '',
            personnelId: parts[3] || '',
            courseNumber: parts[4] || '',
            course: parts[5] || '',
            masterLmp: parts[6] || '',
            startDate: parts[7] || '',
        };
    }).filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate)
);

const formatWizardTraineeRows = (rows: Array<{ surname?: string; givenNames?: string; unit?: string; rank?: string; personnelId?: string; courseNumber?: string; course?: string; masterLmp?: string; startDate?: string }>): string => (
    rows
        .filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate)
        .map((row) => {
            const surname = String(row.surname || '');
            const givenNames = String(row.givenNames || '');
            const name = surname && givenNames ? `${surname}, ${givenNames}` : surname || givenNames;
            return [
                name,
                String(row.unit || ''),
                String(row.rank || ''),
                String(row.personnelId || ''),
                String(row.courseNumber || ''),
                String(row.course || ''),
                String(row.masterLmp || ''),
                String(row.startDate || ''),
            ].join('|');
        })
        .join('\n')
);

const parseWizardPipeRows = <T extends Record<string, string>>(value: string, keys: Array<keyof T>): T[] => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split('|').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        return keys.reduce((row, key, index) => ({
            ...row,
            [key]: parts[index] || '',
        }), {} as T);
    }).filter((row) => Object.values(row).some((entry) => String(entry || '').trim()))
);

const formatWizardPipeRows = <T extends Record<string, string>>(rows: T[], keys: Array<keyof T>): string => (
    rows
        .filter((row) => keys.some((key) => String(row[key] || '').trim()))
        .map((row) => keys.map((key) => String(row[key] || '')).join('|'))
        .join('\n')
);

const parseWizardEditablePipeRows = <T extends Record<string, string>>(value: string, keys: Array<keyof T>): T[] => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split('|').map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        return keys.reduce((row, key, index) => {
            row[key] = (parts[index] || '') as T[keyof T];
            return row;
        }, {} as T);
    }).filter((row) => Object.values(row).some((entry) => String(entry || '').trim()))
);

const formatWizardEditablePipeRows = <T extends Record<string, string>>(rows: T[], keys: Array<keyof T>): string => (
    rows
        .filter((row) => keys.some((key) => String(row[key] || '').trim()))
        .map((row) => keys.map((key) => String(row[key] || '')).join('|'))
        .join('\n')
);

const parseWizardTrainingReportRows = (value: string) => parseWizardPipeRows<{
    genericName: string;
    organisationName: string;
    gradeMin: string;
    gradeMax: string;
    showNumbers: string;
    noGradeOption: string;
    passLabel: string;
    failLabel: string;
}>(value, ['genericName', 'organisationName', 'gradeMin', 'gradeMax', 'showNumbers', 'noGradeOption', 'passLabel', 'failLabel']);

const formatWizardTrainingReportRows = (rows: ReturnType<typeof parseWizardTrainingReportRows>) => (
    formatWizardPipeRows(rows, ['genericName', 'organisationName', 'gradeMin', 'gradeMax', 'showNumbers', 'noGradeOption', 'passLabel', 'failLabel'])
);

const parseWizardRankRows = (value: string) => parseWizardPipeRows<{ order: string; ranks: string; notes: string }>(value, ['order', 'ranks', 'notes']);
const formatWizardRankRows = (rows: ReturnType<typeof parseWizardRankRows>) => formatWizardPipeRows(rows, ['order', 'ranks', 'notes']);

const parseWizardCrewRoleRows = (value: string) => parseWizardPipeRows<{ role: string; label: string; models: string }>(value, ['role', 'label', 'models']);
const formatWizardCrewRoleRows = (rows: ReturnType<typeof parseWizardCrewRoleRows>) => formatWizardPipeRows(rows, ['role', 'label', 'models']);

const parseWizardSharingRows = (value: string) => parseWizardPipeRows<{ type: string; enabled: string; units: string; consequence: string; name: string; allocationMode: string }>(value, ['type', 'enabled', 'units', 'consequence', 'name', 'allocationMode']);
const formatWizardSharingRows = (rows: ReturnType<typeof parseWizardSharingRows>) => formatWizardPipeRows(rows, ['type', 'enabled', 'units', 'consequence', 'name', 'allocationMode']);

const parseWizardCurrencyRows = (value: string) => parseWizardPipeRows<{ name: string; code: string; crew: string; config: string; currency: string; aircraftCount: string }>(value, ['name', 'code', 'crew', 'config', 'currency', 'aircraftCount']);
const formatWizardCurrencyRows = (rows: ReturnType<typeof parseWizardCurrencyRows>) => formatWizardPipeRows(rows, ['name', 'code', 'crew', 'config', 'currency', 'aircraftCount']);

const parseWizardScoringRows = (value: string) => parseWizardPipeRows<{ dimension: string; passStandard: string; failStandard: string; grade0: string; grade1: string; grade2: string; grade3: string; grade4: string; grade5: string }>(value, ['dimension', 'passStandard', 'failStandard', 'grade0', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5']);
const formatWizardScoringRows = (rows: ReturnType<typeof parseWizardScoringRows>) => formatWizardPipeRows(rows, ['dimension', 'passStandard', 'failStandard', 'grade0', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5']);
const defaultWizardScoringDraft = 'Preparation | Prepared, safe and ready to train. | Not prepared or unsafe to continue. | Unsafe | Major help required | Help required | Meets standard | Above standard | Excellent\nAirmanship | Makes safe decisions and prioritises correctly. | Poor judgement or unsafe prioritisation. | Unsafe | Weak | Developing | Meets standard | Strong | Excellent';
const isScoringPhraseBank = (value: unknown): value is PhraseBank => (
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).some((dimension) => (
        Boolean(dimension)
        && typeof dimension === 'object'
        && !Array.isArray(dimension)
        && Object.values(dimension as Record<string, unknown>).some(Array.isArray)
    ))
);
const wizardScoringRowsToPhraseBank = (value: string): PhraseBank => {
    const rows = parseWizardScoringRows(value || defaultWizardScoringDraft);
    return rows.reduce((bank, row) => ({
        ...bank,
        [row.dimension || 'Assessment']: {
            0: [row.grade0 || row.failStandard].filter(Boolean),
            1: [row.grade1].filter(Boolean),
            2: [row.grade2].filter(Boolean),
            3: [row.grade3 || row.passStandard].filter(Boolean),
            4: [row.grade4].filter(Boolean),
            5: [row.grade5].filter(Boolean),
        },
    }), {} as PhraseBank);
};
const wizardPhraseBankToScoringDraft = (phraseBank: PhraseBank): string => {
    const rows = Object.entries(phraseBank || {})
        .filter(([dimension, phrases]) => (
            !dimension.startsWith('__')
            && Boolean(phrases)
            && typeof phrases === 'object'
            && !Array.isArray(phrases)
            && Object.values(phrases as Record<string, unknown>).some(Array.isArray)
        ))
        .map(([dimension, phrases]) => {
            const gradePhrases = phrases as Record<number, string[]>;
            return {
                dimension,
                passStandard: gradePhrases[3]?.[0] || '',
                failStandard: gradePhrases[0]?.[0] || '',
                grade0: gradePhrases[0]?.[0] || '',
                grade1: gradePhrases[1]?.[0] || '',
                grade2: gradePhrases[2]?.[0] || '',
                grade3: gradePhrases[3]?.[0] || '',
                grade4: gradePhrases[4]?.[0] || '',
                grade5: gradePhrases[5]?.[0] || '',
            };
        });
    return formatWizardScoringRows(rows.length > 0 ? rows : parseWizardScoringRows(defaultWizardScoringDraft));
};

const parseWizardStandardCurrencyEventRows = (value: string) => parseWizardEditablePipeRows<{ name: string; shortTitle: string; resourceType: string; duration: string; preFlight: string; postFlight: string; crew: string; currency: string; config: string; aircraftCount: string }>(value, ['name', 'shortTitle', 'resourceType', 'duration', 'preFlight', 'postFlight', 'crew', 'currency', 'config', 'aircraftCount']);
const formatWizardStandardCurrencyEventRows = (rows: ReturnType<typeof parseWizardStandardCurrencyEventRows>) => formatWizardEditablePipeRows(rows, ['name', 'shortTitle', 'resourceType', 'duration', 'preFlight', 'postFlight', 'crew', 'currency', 'config', 'aircraftCount']);

const getWizardOperationalModelLabel = (value: unknown): string => (
    OPERATIONAL_MODEL_OPTIONS.find((option) => option.value === normaliseOperationalModel(value))?.label || getOperationalModelLabel(value)
);

const parseWizardLineItems = (value: string): string[] => (
    String(value || '')
        .split(/\n/)
        .map((item) => item.trim())
        .filter(Boolean)
);

const parseWizardLocationRows = (value: string): Array<{ icao: string; iata: string; name: string }> => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split(/[|,]/).map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        return {
            icao: String(parts[0] || '').trim().toUpperCase(),
            iata: String(parts[1] || '').trim().toUpperCase(),
            name: parts[2] || parts[0] || '',
        };
    }).filter((row) => row.icao || row.iata || row.name)
);

const formatWizardLocationRows = (rows: Array<{ icao?: string; iata?: string; name?: string }>): string => (
    rows
        .filter((row) => row.icao || row.iata || row.name)
        .map((row) => [String(row.icao || '').trim().toUpperCase(), String(row.iata || '').trim().toUpperCase(), String(row.name || '')].join('|'))
        .join('\n')
);

const normaliseWizardLocationProfile = (location: any) => ({
    icao: String(location?.icao || location?.code || '').trim().toUpperCase(),
    iata: String(location?.iataCode || location?.settings?.iataCode || location?.iata || '').trim().toUpperCase(),
    name: String(location?.name || location?.label || location?.code || '').trim(),
    timezone: String(location?.timezone || 'UTC').trim(),
});

const parseWizardUnitRows = (value: string): Array<{ code: string; name: string }> => (
    String(value || '').split(/\n/).map((line) => {
        const parts = line.split(/[|,]/).map((part, index) => (index === 0 ? part : part.replace(/^\s/, '')));
        return {
            code: String(parts[0] || '').trim().toUpperCase(),
            name: parts[1] || parts[0] || '',
        };
    }).filter((row) => row.code || row.name)
);

const parseWizardParentRows = (value: string): Array<{ child: string; parent: string }> => (
    parseWizardLineItems(value).map((line) => {
        const separator = line.includes('=') ? '=' : line.includes('|') ? '|' : '>';
        const [childPart, parentPart] = line.split(separator).map((part) => part.trim());
        return { child: childPart || '', parent: parentPart || '' };
    }).filter((row) => row.child && row.parent)
);

const buildWizardParentMaps = (rows: Array<{ child: string; parent: string }>) => {
    const childrenByParent: Record<string, string[]> = {};
    const parentByChild: Record<string, string> = {};
    rows.forEach((row) => {
        const parent = row.parent.trim();
        const child = row.child.trim();
        if (!parent || !child) return;
        childrenByParent[parent] = Array.from(new Set([...(childrenByParent[parent] || []), child]));
        parentByChild[child] = parent;
    });
    return { childrenByParent, parentByChild };
};

const buildWizardParentRowsForChildren = (
    children: string[],
    parentMappings: string,
    parentOptions: string[],
): Array<{ child: string; parent: string }> => {
    const existingParentByChild = new Map(
        parseWizardParentRows(parentMappings).map((row) => [normaliseUnitSettingsIdentifier(row.child), row.parent]),
    );
    const defaultParent = parentOptions.find((parent) => String(parent || '').trim()) || '';
    return children
        .map((child) => {
            const cleanChild = String(child || '').trim();
            const parent = existingParentByChild.get(normaliseUnitSettingsIdentifier(cleanChild)) || defaultParent;
            return { child: cleanChild, parent: String(parent || '').trim() };
        })
        .filter((row) => row.child && row.parent);
};

const updateWizardParentMapping = (
    parentMappings: string,
    child: string,
    parent: string,
): string => {
    const cleanChild = String(child || '').trim();
    const cleanParent = String(parent || '').trim();
    if (!cleanChild) return parentMappings;
    const rows = parseWizardParentRows(parentMappings);
    const nextRows = rows.filter((row) => normaliseUnitSettingsIdentifier(row.child) !== normaliseUnitSettingsIdentifier(cleanChild));
    if (cleanParent) nextRows.push({ child: cleanChild, parent: cleanParent });
    return nextRows.map((row) => `${row.child} = ${row.parent}`).join('\n');
};

const buildWizardRelationshipPaths = (
    rootLabel: string,
    level1Rows: Array<{ child: string; parent: string }>,
    level2Rows: Array<{ child: string; parent: string }>,
    level3Rows: Array<{ child: string; parent: string }>,
): string[][] => {
    const root = String(rootLabel || '').trim() || 'Organisation';
    const parentByLevel1 = new Map(level1Rows.map((row) => [normaliseUnitSettingsIdentifier(row.child), row.parent || root]));
    const parentByLevel2 = new Map(level2Rows.map((row) => [normaliseUnitSettingsIdentifier(row.child), row.parent]));
    const parentByLevel3 = new Map(level3Rows.map((row) => [normaliseUnitSettingsIdentifier(row.child), row.parent]));
    const pathFor = (child: string, level: 1 | 2 | 3): string[] => {
        const cleanChild = String(child || '').trim();
        if (!cleanChild) return [];
        if (level === 1) {
            const parent = parentByLevel1.get(normaliseUnitSettingsIdentifier(cleanChild)) || root;
            return [parent || root, cleanChild].filter(Boolean);
        }
        if (level === 2) {
            const parent = parentByLevel2.get(normaliseUnitSettingsIdentifier(cleanChild)) || '';
            const grandParent = parent ? parentByLevel1.get(normaliseUnitSettingsIdentifier(parent)) || root : root;
            return [grandParent || root, parent, cleanChild].filter(Boolean);
        }
        const parent = parentByLevel3.get(normaliseUnitSettingsIdentifier(cleanChild)) || '';
        const grandParent = parent ? parentByLevel2.get(normaliseUnitSettingsIdentifier(parent)) || '' : '';
        const greatGrandParent = grandParent ? parentByLevel1.get(normaliseUnitSettingsIdentifier(grandParent)) || root : root;
        return [greatGrandParent || root, grandParent, parent, cleanChild].filter(Boolean);
    };
    return [
        ...level1Rows.map((row) => pathFor(row.child, 1)),
        ...level2Rows.map((row) => pathFor(row.child, 2)),
        ...level3Rows.map((row) => pathFor(row.child, 3)),
    ].filter((path) => path.length > 1);
};

const buildWizardRelationshipPathsFromLevelRows = (
    rootLabel: string,
    parentRowsByLevel: Array<Array<{ child: string; parent: string }>>,
): string[][] => {
    const root = String(rootLabel || '').trim() || 'Organisation';
    const parentByLevel = new Map<number, Map<string, string>>();
    parentRowsByLevel.forEach((rows, levelIndex) => {
        if (levelIndex === 0) return;
        parentByLevel.set(levelIndex, new Map(rows.map((row) => [
            normaliseUnitSettingsIdentifier(row.child),
            String(row.parent || '').trim(),
        ])));
    });
    const pathFor = (child: string, levelIndex: number): string[] => {
        const cleanChild = String(child || '').trim();
        if (!cleanChild) return [];
        if (levelIndex <= 0) return [cleanChild];
        const parent = parentByLevel.get(levelIndex)?.get(normaliseUnitSettingsIdentifier(cleanChild)) || '';
        const parentPath = parent ? pathFor(parent, levelIndex - 1) : [root];
        return [...parentPath, cleanChild].filter(Boolean);
    };
    return parentRowsByLevel
        .flatMap((rows, levelIndex) => (levelIndex === 0 ? [] : rows.map((row) => pathFor(row.child, levelIndex))))
        .filter((path) => path.length > 1);
};

const getUnitParentOrganisationPath = (unit: any): string[] => {
    const rawPath = Array.isArray(unit?.settings?.parentOrganisationPath)
        ? unit.settings.parentOrganisationPath
        : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
    return rawPath.map((item: unknown) => String(item || '').trim()).filter(Boolean);
};

const getResolvedUnitParentOrganisationPath = (platformConfig: any, unit: any): string[] => {
    const path = getUnitParentOrganisationPath(unit);
    const activeOrganisation = getActiveOrganisation(platformConfig);
    const levels = Array.isArray(activeOrganisation?.settings?.organisationStructure?.levels)
        ? activeOrganisation.settings.organisationStructure.levels
        : [];
    const repairMaps = getOrganisationRepairMaps(platformConfig, levels);
    return path
        .map((part, pathIndex) => getCanonicalOrganisationLabel(levels, repairMaps, pathIndex + 1, part))
        .filter(Boolean);
};

const getRelevantResourcePoolsForUnit = (platformConfig: any, unit: any): any[] => {
    const unitCode = normaliseUnitSettingsIdentifier(unit?.code);
    const locationCode = normaliseUnitSettingsIdentifier(unit?.locationCode);
    return (platformConfig?.resourcePools || []).filter((pool: any) => {
        if (String(pool?.status || 'ACTIVE').toUpperCase() === 'INACTIVE') return false;
        const poolUnitCode = normaliseUnitSettingsIdentifier(pool?.unitCode);
        const poolLocationCode = normaliseUnitSettingsIdentifier(pool?.locationCode);
        return poolUnitCode === unitCode || (!poolUnitCode && poolLocationCode && poolLocationCode === locationCode);
    });
};

const insertUnitSettingsTextAtCursor = (
    field: HTMLInputElement | HTMLTextAreaElement,
    text: string,
    onChange: (value: string) => void,
): boolean => {
    if (field.disabled || field.readOnly) return false;
    const currentValue = field.value || '';
    const selectionStart = field.selectionStart ?? currentValue.length;
    const selectionEnd = field.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${text}${currentValue.slice(selectionEnd)}`;
    const nextCursor = Math.min(selectionStart + text.length, nextValue.length);
    if (nextValue === currentValue && selectionStart === selectionEnd) return false;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
        field.setSelectionRange(nextCursor, nextCursor);
    });
    return true;
};

const handleUnitSettingsTextKeyDownCapture = (
    event: React.KeyboardEvent<HTMLInputElement>,
    onChange: (value: string) => void,
) => {
    if ((event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        insertUnitSettingsTextAtCursor(event.currentTarget, ' ', onChange);
        return;
    }
    stopEditableKeyPropagation(event);
};

const handleUnitSettingsTextBeforeInput = (
    event: React.FormEvent<HTMLInputElement>,
    onChange: (value: string) => void,
) => {
    const inputEvent = event.nativeEvent as InputEvent;
    if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    insertUnitSettingsTextAtCursor(event.currentTarget, ' ', onChange);
};

const UnitSettingsField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled = false }) => {
    const [draft, setDraft] = useState(value || '');
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setDraft(value || '');
    }, [focused, value]);

    const commitDraft = () => {
        setFocused(false);
        if (draft !== (value || '')) onChange(draft);
    };

    if (disabled) {
        return <UnitSettingsReadRow label={label} value={value || 'Not set'} muted={!value} />;
    }

    return (
        <label className={unitSettingsRowClass}>
            <span className={unitSettingsLabelClass}>{label}</span>
            <input
                className={unitSettingsInputClass}
                value={focused ? draft : value || ''}
                disabled={disabled}
                onBeforeInput={(event) => handleUnitSettingsTextBeforeInput(event, setDraft)}
                onKeyDownCapture={(event) => handleUnitSettingsTextKeyDownCapture(event, setDraft)}
                onKeyDown={stopEditableKeyPropagation}
                onFocus={() => {
                    setFocused(true);
                    setDraft(value || '');
                }}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
            />
        </label>
    );
};

const UnitSettingsSelect: React.FC<{
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    optionLabels?: Record<string, string>;
    disabled?: boolean;
}> = ({ label, value, options, onChange, optionLabels = {}, disabled = false }) => (
    disabled ? (
        <UnitSettingsReadRow label={label} value={optionLabels[value] || value || 'Not set'} muted={!value} />
    ) : <label className={`${unitSettingsRowClass} min-w-0`}>
        <span className={unitSettingsLabelClass}>{label}</span>
        <select
            className={unitSettingsSelectClass}
            value={value || ''}
            disabled={disabled}
            title={optionLabels[value] || value}
            onChange={(event) => onChange(event.target.value)}
        >
            {options.map((option) => (
                <option key={option || 'blank'} value={option}>{optionLabels[option] || option || 'Not set'}</option>
            ))}
        </select>
    </label>
);

const UnitSettingsNumberField: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled = false }) => (
    disabled ? (
        <UnitSettingsReadRow label={label} value={Number.isFinite(Number(value)) ? String(value) : '0'} />
    ) : <label className={unitSettingsRowClass}>
        <span className={unitSettingsLabelClass}>{label}</span>
        <input
            type="number"
            min={0}
            className={unitSettingsInputClass}
            value={Number.isFinite(Number(value)) ? value : 0}
            disabled={disabled}
            onKeyDownCapture={stopEditableKeyPropagation}
            onKeyDown={stopEditableKeyPropagation}
            onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) || 0)))}
        />
    </label>
);

const UnitSettingsGroup: React.FC<{ title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, description, children, action }) => (
    <section className={unitSettingsPanelClass}>
        <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 pr-2">
                <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
                {description ? <p className="mt-1 max-w-lg text-xs leading-5 text-slate-400">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="border-t border-white/10">
            {children}
        </div>
    </section>
);

const UnitSettingsReadRow: React.FC<{ label: string; value?: React.ReactNode; muted?: boolean }> = ({ label, value, muted = false }) => (
    <div className={unitSettingsRowClass}>
        <span className={unitSettingsLabelClass}>{label}</span>
        <div className={`text-xs font-semibold leading-5 ${muted ? 'text-slate-400' : 'text-slate-100'}`}>{value || 'Not set'}</div>
    </div>
);

const UnitSettingsTextAreaRow: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}> = ({ label, value, onChange, disabled = false, placeholder = '' }) => {
    const [draft, setDraft] = useState(value || '');
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setDraft(value || '');
    }, [focused, value]);

    const commitDraft = () => {
        setFocused(false);
        if (draft !== (value || '')) onChange(draft);
    };

    if (disabled) {
        return <UnitSettingsReadRow label={label} value={<span className="whitespace-pre-wrap">{value || 'Not set'}</span>} muted={!value} />;
    }

    return (
        <label className={`${unitSettingsRowClass} md:items-start`}>
            <span className={`${unitSettingsLabelClass} md:pt-2`}>{label}</span>
            <textarea
                className={`${unitSettingsInputClass} min-h-[118px] resize-y leading-5`}
                value={focused ? draft : value || ''}
                placeholder={placeholder}
                disabled={disabled}
                onBeforeInput={(event) => {
                    const inputEvent = event.nativeEvent as InputEvent;
                    if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    insertUnitSettingsTextAtCursor(event.currentTarget, ' ', setDraft);
                }}
                onKeyDownCapture={(event) => {
                    if ((event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar') && !event.metaKey && !event.ctrlKey && !event.altKey) {
                        event.preventDefault();
                        event.stopPropagation();
                        insertUnitSettingsTextAtCursor(event.currentTarget, ' ', setDraft);
                        return;
                    }
                    stopEditableKeyPropagation(event);
                }}
                onKeyDown={stopEditableKeyPropagation}
                onFocus={() => {
                    setFocused(true);
                    setDraft(value || '');
                }}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
            />
        </label>
    );
};

const OrganisationMyUnitSettings: React.FC<{
    platformConfig?: any;
    unitCode?: string;
    formationCallsigns?: FormationCallsign[];
    buildRuleSettings?: ScheduleViewProps['buildRuleSettings'];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
}> = ({ platformConfig, unitCode, formationCallsigns = [], buildRuleSettings, onUpdatePlatformConfig, onNavigateToSettingsSection }) => {
    const [activeCategory, setActiveCategory] = useState('identity');
    const unitTypeOptions = useMemo(() => normaliseUnitTypeOptions(platformConfig), [platformConfig]);
    const configuredContinuationShortLabel = useMemo(
        () => getSctTerminology(platformConfig, unitCode).shortLabel || 'ContT',
        [platformConfig, unitCode],
    );
    const configuredContinuationCurrencyEventsLabel = `${configuredContinuationShortLabel} / Currency Events`;
    const activeUnitCode = normaliseUnitSettingsIdentifier(unitCode);
    const activeUnitCodes = Array.from(new Set(
        activeUnitCode
            .split('+')
            .map((code) => normaliseUnitSettingsIdentifier(code))
            .filter(Boolean)
    ));
    const units = platformConfig?.units || [];
    const exactUnit = units.find((candidate: any) => normaliseUnitSettingsIdentifier(candidate?.code) === activeUnitCode);
    const activeMemberUnits = exactUnit
        ? [exactUnit]
        : units.filter((candidate: any) => activeUnitCodes.includes(normaliseUnitSettingsIdentifier(candidate?.code)));
    const isCombinedUnitContext = !exactUnit && activeUnitCodes.length > 1 && activeMemberUnits.length > 0;
    const unit = exactUnit
        || activeMemberUnits[0]
        || (!activeUnitCode ? units.find((candidate: any) => String(candidate?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE') : null)
        || (!activeUnitCode ? units[0] : null);
    const contextUnits = activeMemberUnits.length > 0 ? activeMemberUnits : (unit ? [unit] : []);
    const contextUnitCodes = Array.from(new Set(contextUnits.map((item: any) => normaliseUnitSettingsIdentifier(item?.code)).filter(Boolean)));
    const contextUnitCodeSet = new Set(contextUnitCodes);
    const contextMatchesUnit = (value: unknown): boolean => {
        const cleanValue = normaliseUnitSettingsIdentifier(value);
        if (!cleanValue) return false;
        return contextUnitCodeSet.has(cleanValue) || cleanValue === activeUnitCode;
    };
    const contextDisplayCode = isCombinedUnitContext ? activeUnitCode : normaliseUnitSettingsIdentifier(unit?.code);
    const contextDisplayName = isCombinedUnitContext
        ? contextUnits.map((item: any) => item.name || item.code).filter(Boolean).join(' + ')
        : unit?.name || unit?.code || activeUnitCode;
    const contextLocationCodes = Array.from(new Set(contextUnits.map((item: any) => normaliseUnitSettingsIdentifier(item?.locationCode)).filter(Boolean)));
    const contextLocationDisplay = contextLocationCodes.length > 1 ? contextLocationCodes.join(' + ') : contextLocationCodes[0] || unit?.locationCode || '';
    const unitIndex = unit ? units.findIndex((candidate: any) => candidate === unit) : -1;
    const canEdit = false;
    const unitHasTrainees = contextUnits.length > 0
        ? contextUnits.some((contextUnit: any) => contextUnit?.settings?.hasTrainees !== false)
        : unit?.settings?.hasTrainees !== false;
    const locations = platformConfig?.locations || [];
    const modules = platformConfig?.modules || [];
    const resourcePools = Array.from(new Map(
        contextUnits
            .flatMap((contextUnit: any) => getRelevantResourcePoolsForUnit(platformConfig, contextUnit))
            .map((pool: any) => [String(pool?.id || pool?.code || pool?.name || `${pool?.unitCode}-${pool?.aircraftTypeCode}`), pool])
    ).values());
    const primaryResourcePool = resourcePools[0] || null;
    const primaryResourcePoolFocusKey = primaryResourcePool
        ? String(primaryResourcePool.id || primaryResourcePool.code || primaryResourcePool.name || '').trim()
        : '';
    const unitModules = platformConfig?.unitModules || [];
    const schedulingRuleSets = (platformConfig?.schedulingRuleSets || []).filter((ruleSet: any) => (
        String(ruleSet?.isActive ?? true) !== 'false'
        && (!ruleSet?.unitCode || contextMatchesUnit(ruleSet.unitCode))
    ));
    const location = locations.find((candidate: any) => normaliseUnitSettingsIdentifier(candidate?.code) === normaliseUnitSettingsIdentifier(unit?.locationCode));
    const parentPath = isCombinedUnitContext
        ? Array.from(new Set(contextUnits.flatMap((contextUnit: any) => getResolvedUnitParentOrganisationPath(platformConfig, contextUnit)))).filter(Boolean)
        : getResolvedUnitParentOrganisationPath(platformConfig, unit);
    const contextOperationalModels = Array.from(new Set(contextUnits.map((contextUnit: any) => getUnitOperationalModel(contextUnit)).filter(Boolean)));
    const operationalModel = getUnitOperationalModel(unit);
    const operationalModelDisplay = isCombinedUnitContext && contextOperationalModels.length > 1
        ? contextOperationalModels.map((model) => getOperationalModelLabel(model)).join(' + ')
        : getOperationalModelLabel(operationalModel);
    const modelOptionLabels = Object.fromEntries(OPERATIONAL_MODEL_OPTIONS.map((option) => [option.value, option.label]));
    const taskAbbreviations = unit?.settings?.taskProfileAbbreviations || {};
    const validTaskAbbreviations = getTaskProfileAbbreviationsForUnit(platformConfig, unit?.code);
    const taskProfilesForUnit = getTaskProfilesForModel(platformConfig, operationalModel);
    const taskTileLabelProfiles = Array.from(new Set([
        ...taskProfilesForUnit,
        ...Object.keys(validTaskAbbreviations || {}),
    ].map((profile) => String(profile || '').trim()).filter(Boolean)));
    const activeOrganisation = getActiveOrganisation(platformConfig);
    const organisationSettings = activeOrganisation?.settings || {};
    const resourceSharingGroups = Array.isArray(organisationSettings.resourceSharingGroups) && organisationSettings.resourceSharingGroups.length > 0
        ? organisationSettings.resourceSharingGroups
        : (Array.isArray(organisationSettings.selectedUnits) && organisationSettings.selectedUnits.length > 0
            ? [{ id: 'legacy-resource-sharing', name: `${organisationSettings.selectedUnits.join('+')} Shared Resources`, selectedUnits: organisationSettings.selectedUnits, allocationMode: organisationSettings.allocationMode }]
            : []);
    const staffSharingGroups = Array.isArray(organisationSettings.staffSharingGroups) && organisationSettings.staffSharingGroups.length > 0
        ? organisationSettings.staffSharingGroups
        : (Array.isArray(organisationSettings.staffSharingUnits) && organisationSettings.staffSharingUnits.length > 0
            ? [{ id: 'legacy-staff-sharing', name: `${organisationSettings.staffSharingUnits.join('+')} Staff Sharing`, selectedUnits: organisationSettings.staffSharingUnits }]
            : []);
    const resourceSharingForUnit = organisationSettings.fleetSharingEnabled
        ? resourceSharingGroups.filter((group: any) => (
            group?.enabled !== false
            && (group?.selectedUnits || []).map(normaliseUnitSettingsIdentifier).some((code: string) => contextUnitCodeSet.has(code))
        ))
        : [];
    const staffSharingForUnit = organisationSettings.staffSharingEnabled
        ? staffSharingGroups.filter((group: any) => (group?.selectedUnits || []).map(normaliseUnitSettingsIdentifier).some((code: string) => contextUnitCodeSet.has(code)))
        : [];
    const deploymentProfile = organisationSettings.deploymentProfile || {};
    const operationalRunbook = organisationSettings.operationalRunbook || {};
    const crewPositionTerminology = normaliseCrewPositionTerminology(organisationSettings.crewPositionTerminology || null);
    const crewPositionLabelMap = getCrewPositionLabelMap(crewPositionTerminology);
    const crewCompositionSettings = normaliseCrewCompositionSettings(organisationSettings.crewCompositionSettings || null);
    const personnelDisplaySettings = normalisePersonnelDisplaySettings(organisationSettings.personnelDisplaySettings || organisationSettings.personnelSettings || null);
    const permissionProfiles = getPlatformPermissionProfiles(platformConfig || null);
    const permissionProfileNameMap = Object.fromEntries(permissionProfiles.map((profile: any) => [String(profile.id || '').trim(), profile.name || profile.id]));
    const platformUsers = platformConfig?.platformUsers || [];
    const staffQualificationCatalogue = normaliseStaffQualificationCatalogue(organisationSettings.staffQualificationCatalogue || null);
    const unitCallsignSettings = normaliseUnitCallsignSettings(organisationSettings.unitCallsignSettings || null);
    const trainingReportTerminology = normaliseTrainingReportTerminology(unit?.settings?.trainingReportTerminology || organisationSettings.trainingReportTerminology || null);
    const trainingReportTemplate = normaliseTrainingReportTemplate(unit?.settings?.trainingReportTemplate || organisationSettings.trainingReportTemplate || null);
    const aircraftTypeCodes = Array.from(new Set(resourcePools.map((pool: any) => String(pool.aircraftTypeCode || '').trim().toUpperCase()).filter(Boolean)));
    const aircraftTypesForUnit = (platformConfig?.aircraftTypes || []).filter((aircraft: any) => (
        aircraftTypeCodes.includes(String(aircraft.code || '').trim().toUpperCase())
    ));
    const primaryAircraftTypeCode = aircraftTypesForUnit[0]?.code || aircraftTypeCodes[0] || '';
    const alternateCrewProfiles = crewCompositionSettings.alternateCompositions.filter((profile) => (
        String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && (!profile.unitCode || contextMatchesUnit(profile.unitCode))
        && (!profile.aircraftTypeCode || aircraftTypeCodes.length === 0 || aircraftTypeCodes.includes(profile.aircraftTypeCode))
        && profile.operationalModels.includes(operationalModel)
    ));
    const currencyProfiles = crewCompositionSettings.currencyProfiles.filter((profile) => (
        String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && (!profile.unitCode || contextMatchesUnit(profile.unitCode))
        && (!profile.aircraftTypeCode || aircraftTypeCodes.length === 0 || aircraftTypeCodes.includes(profile.aircraftTypeCode))
    ));
    const standardMissionProfiles = (
        Array.isArray(organisationSettings.standardMissionProfiles?.profiles)
            ? organisationSettings.standardMissionProfiles.profiles
            : Array.isArray(organisationSettings.standardMissionProfiles)
                ? organisationSettings.standardMissionProfiles
                : []
    ).filter((profile: any) => (
        String(profile?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && (!profile?.unitCode || contextMatchesUnit(profile.unitCode))
    ));
    const masterLmpAccessRules = getOrganisationMasterLmpAccessRules(organisationSettings);
    const masterLmpAccessForUnit = masterLmpAccessRules.filter((rule: any) => (
        !rule?.unitCode || contextMatchesUnit(rule.unitCode)
    ));
    const unitHomeLocationCode = normaliseUnitSettingsIdentifier(unit?.locationCode);
    const userAccessForUnit = (platformConfig?.userAccess || []).filter((access: any) => {
        const accessUnitCode = normaliseUnitSettingsIdentifier(access?.unitCode);
        const accessLocationCode = normaliseUnitSettingsIdentifier(access?.locationCode);
        if (accessUnitCode) return contextUnitCodeSet.has(accessUnitCode);
        return !accessLocationCode || contextLocationCodes.includes(accessLocationCode) || accessLocationCode === unitHomeLocationCode;
    });
    const getAccessUserLabel = (access: any) => {
        const userId = String(access?.userId || '').trim();
        const user = platformUsers.find((candidate: any) => (
            [candidate?.userId, candidate?.username, candidate?.id]
                .map((value) => String(value || '').trim())
                .includes(userId)
        ));
        const fullName = formatPersonDisplayName({
            firstName: user?.firstName,
            lastName: user?.lastName,
            displayName: user?.displayName,
            username: user?.username,
            userId,
        });
        return access?.displayName || access?.userName || fullName || user?.username || userId || 'Unknown user';
    };
    const getAccessProfileLabels = (access: any) => {
        const profileIds = Array.from(new Set([
            ...(Array.isArray(access?.settings?.permissionProfileIds) ? access.settings.permissionProfileIds : []),
            ...(Array.isArray(access?.profileIds) ? access.profileIds : []),
            access?.profileId,
        ].map((value) => String(value || '').trim()).filter(Boolean)));
        return profileIds.map((profileId) => permissionProfileNameMap[profileId] || profileId);
    };
    const formatAccessScopeSummary = (access: any) => {
        const base = access?.locationCode || (access?.unitCode ? unit?.locationCode : '') || 'All bases';
        const unitScope = access?.unitCode || 'All units';
        const moduleScope = access?.moduleCode || 'All enabled features';
        const role = access?.role || 'Role not set';
        const accessLevel = access?.accessLevel || 'Access not set';
        const status = access?.status || 'ACTIVE';
        return `${base} / ${unitScope} / ${moduleScope} / ${role} / ${accessLevel} / ${status}`;
    };
    const userAccessScopeCards = Object.values(userAccessForUnit.reduce((groups: Record<string, any>, access: any) => {
        const profiles = getAccessProfileLabels(access);
        const summary = formatAccessScopeSummary(access);
        const key = [
            getAccessUserLabel(access),
            summary,
            profiles.join('|') || 'No permission profile assigned',
        ].join('::');
        if (!groups[key]) {
            groups[key] = {
                access,
                userLabel: getAccessUserLabel(access),
                summary,
                profiles,
                count: 0,
            };
        }
        groups[key].count += 1;
        return groups;
    }, {}));
    const activeLicences = (platformConfig?.licenses || []).filter((license: any) => (
        String(license?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    ));
    const unitCallsignEntries = unitCallsignSettings.entries.filter((entry) => (
        contextMatchesUnit(entry.unitCode)
    ));
    const unitFormationCallsigns = formationCallsigns.filter((callsign) => (
        contextMatchesUnit(callsign.unit)
    ));
    const buildRules = buildRuleSettings || {};
    const eventLimits = buildRules.eventLimits;
    const formatHours = (value: unknown) => `${Number.isFinite(Number(value)) ? Number(value) : 0} hrs`;
    const formatMinutes = (value: unknown) => `${Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0} min`;
    const flightStaggerMinutes = getEffectiveDispatchStaggerMinutes(buildRules.dispatchStaggerSettings, 'flight');
    const simStaggerMinutes = getEffectiveDispatchStaggerMinutes(buildRules.dispatchStaggerSettings, 'ftd');
    const modelCrewPositions = crewPositionTerminology.positions.filter((position) => (
        !position.operationalModels?.length || position.operationalModels.includes(operationalModel)
    ));
    const modelQualifications = staffQualificationCatalogue.qualifications.filter((qualification) => (
        String(qualification.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && qualification.operationalModels.includes(operationalModel)
    ));
    const categories = [
        { id: 'identity', label: 'Unit', count: 6 },
        { id: 'resources', label: 'Resources', count: resourcePools.length + resourceSharingForUnit.length + staffSharingForUnit.length },
        { id: 'crew', label: 'Crew', count: aircraftTypesForUnit.length + alternateCrewProfiles.length },
        { id: 'training', label: 'Training', count: standardMissionProfiles.length + currencyProfiles.length + 2 },
        { id: 'labels', label: 'Labels', count: modelCrewPositions.length + unitCallsignEntries.length + unitFormationCallsigns.length },
        { id: 'access', label: 'Access', count: userAccessForUnit.length },
    ];
    const settingsAnchorSuffix = (value: any) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
    const unitFocusAnchor = settingsAnchorSuffix(contextDisplayCode || unit?.code);
    const settingsLink = (
        sectionId: string,
        label = 'Open Settings',
        focus: { unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string } = {},
    ) => (
        <button
            type="button"
            onClick={() => onNavigateToSettingsSection?.({ sectionId, ...focus })}
            className="shrink-0 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-400/20"
        >
            {label}
        </button>
    );

    const updateUnit = (patch: Record<string, any>) => {
        if (!canEdit) return;
        onUpdatePlatformConfig?.((current) => ({
            ...current,
            units: (current?.units || []).map((candidate: any, index: number) => (
                index === unitIndex ? { ...candidate, ...patch } : candidate
            )),
        }));
    };
    const updateUnitSettings = (patch: Record<string, any>) => {
        updateUnit({
            settings: {
                ...(unit?.settings || {}),
                ...patch,
            },
        });
    };
    const updateTaskTileLabel = (profile: string, label: string) => {
        const nextAbbreviations = { ...(taskAbbreviations || {}) };
        const cleanLabel = String(label || '').trim();
        if (cleanLabel) {
            nextAbbreviations[profile] = label;
        } else {
            delete nextAbbreviations[profile];
        }
        updateUnitSettings({ taskProfileAbbreviations: nextAbbreviations });
    };
    const updateOrganisationSettings = (patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig || !activeOrganisation) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            organisations: (current?.organisations || []).map((organisation: any) => (
                organisation === activeOrganisation || String(organisation?.id || organisation?.code || '') === String(activeOrganisation?.id || activeOrganisation?.code || '')
                    ? {
                        ...organisation,
                        settings: {
                            ...(organisation.settings || {}),
                            ...patch,
                        },
                    }
                : organisation
            )),
        }));
    };
    const updateDeploymentProfile = (patch: Record<string, any>) => {
        updateOrganisationSettings({
            deploymentProfile: {
                ...deploymentProfile,
                ...patch,
            },
        });
    };
    const updateOperationalRunbook = (patch: Record<string, any>) => {
        updateOrganisationSettings({
            operationalRunbook: {
                ...operationalRunbook,
                ...patch,
            },
        });
    };
    const updatePersonnelDisplaySettings = (patch: Record<string, any>) => {
        updateOrganisationSettings({
            personnelDisplaySettings: {
                ...personnelDisplaySettings,
                ...patch,
            },
        });
    };
    const updateUnitTrainingReportTemplate = (patch: Record<string, any>) => {
        updateUnitSettings({
            trainingReportTemplate: {
                ...trainingReportTemplate,
                ...patch,
            },
        });
    };
    const updateLocation = (targetLocation: any, patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig || !targetLocation) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            locations: (current?.locations || []).map((candidate: any) => (
                candidate === targetLocation || String(candidate?.id || candidate?.code || '') === String(targetLocation?.id || targetLocation?.code || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        }));
    };
    const updateCrewCompositionSettings = (patch: Record<string, any>) => {
        updateOrganisationSettings({
            crewCompositionSettings: {
                ...crewCompositionSettings,
                ...patch,
            },
        });
    };
    const updateAlternateCrewProfile = (profile: any, patch: Record<string, any>) => {
        updateCrewCompositionSettings({
            alternateCompositions: crewCompositionSettings.alternateCompositions.map((candidate) => (
                candidate.id === profile.id ? { ...candidate, ...patch } : candidate
            )),
        });
    };
    const updateCurrencyProfile = (profile: any, patch: Record<string, any>) => {
        updateCrewCompositionSettings({
            currencyProfiles: crewCompositionSettings.currencyProfiles.map((candidate) => (
                candidate.id === profile.id ? { ...candidate, ...patch } : candidate
            )),
        });
    };
    const updateStandardMissionProfile = (profile: any, patch: Record<string, any>) => {
        const source = Array.isArray(organisationSettings.standardMissionProfiles?.profiles)
            ? organisationSettings.standardMissionProfiles.profiles
            : Array.isArray(organisationSettings.standardMissionProfiles)
                ? organisationSettings.standardMissionProfiles
                : [];
        const nextProfiles = source.map((candidate: any) => (
            candidate === profile || String(candidate?.id || candidate?.code || candidate?.missionName || '') === String(profile?.id || profile?.code || profile?.missionName || '')
                ? { ...candidate, ...patch }
                : candidate
        ));
        updateOrganisationSettings({
            standardMissionProfiles: Array.isArray(organisationSettings.standardMissionProfiles?.profiles)
                ? { ...organisationSettings.standardMissionProfiles, profiles: nextProfiles }
                : nextProfiles,
        });
    };
    const updateCrewPositionEntry = (entry: any, patch: Record<string, any>) => {
        updateOrganisationSettings({
            crewPositionTerminology: {
                ...crewPositionTerminology,
                positions: crewPositionTerminology.positions.map((candidate) => (
                    candidate.id === entry.id ? { ...candidate, ...patch } : candidate
                )),
            },
        });
    };
    const updateQualificationEntry = (qualification: any, patch: Record<string, any>) => {
        updateOrganisationSettings({
            staffQualificationCatalogue: {
                ...staffQualificationCatalogue,
                qualifications: staffQualificationCatalogue.qualifications.map((candidate) => (
                    candidate.id === qualification.id ? { ...candidate, ...patch } : candidate
                )),
            },
        });
    };
    const updateUnitCallsignEntry = (entry: any, patch: Record<string, any>) => {
        updateOrganisationSettings({
            unitCallsignSettings: {
                ...unitCallsignSettings,
                entries: unitCallsignSettings.entries.map((candidate) => (
                    candidate.id === entry.id ? { ...candidate, ...patch } : candidate
                )),
            },
        });
    };
    const updateMasterLmpAccessRule = (rule: any, patch: Record<string, any>) => {
        updateOrganisationSettings({
            masterLmpAccess: masterLmpAccessRules.map((candidate: any) => (
                candidate === rule || String(candidate?.id || candidate?.masterLmpId || candidate?.masterLmpName || '') === String(rule?.id || rule?.masterLmpId || rule?.masterLmpName || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        });
    };
    const updateUserAccessScope = (access: any, patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            userAccess: (current?.userAccess || []).map((candidate: any) => (
                candidate === access || String(candidate?.id || candidate?.userId || candidate?.userName || '') === String(access?.id || access?.userId || access?.userName || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        }));
    };
    const updateLicenseRecord = (license: any, patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            licenses: (current?.licenses || []).map((candidate: any) => (
                candidate === license || String(candidate?.id || candidate?.licenseKey || candidate?.licenseName || '') === String(license?.id || license?.licenseKey || license?.licenseName || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        }));
    };
    const updateUnitModule = (moduleCode: string, isEnabled: boolean) => {
        if (!onUpdatePlatformConfig || !unit?.code) return;
        const cleanModuleCode = String(moduleCode || '').trim();
        const cleanUnitCode = String(unit.code || '').trim();
        onUpdatePlatformConfig((current) => {
            const existingIndex = (current?.unitModules || []).findIndex((item: any) => (
                normaliseUnitSettingsIdentifier(item?.unitCode) === normaliseUnitSettingsIdentifier(cleanUnitCode)
                && normaliseUnitSettingsIdentifier(item?.moduleCode) === normaliseUnitSettingsIdentifier(cleanModuleCode)
            ));
            if (existingIndex >= 0) {
                return {
                    ...current,
                    unitModules: current.unitModules.map((item: any, index: number) => (
                        index === existingIndex ? { ...item, isEnabled } : item
                    )),
                };
            }
            return {
                ...current,
                unitModules: [
                    ...(current?.unitModules || []),
                    { unitCode: cleanUnitCode, moduleCode: cleanModuleCode, isEnabled, settings: {} },
                ],
            };
        });
    };

    if (!unit) {
        return (
            <div className="rounded border border-cyan-400/15 bg-slate-950/60 p-5 text-sm text-slate-300">
                No active unit is available for this user context.
            </div>
        );
    }

    const renderCategory = () => {
        if (activeCategory === 'resources') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup
                        title="DFP Resource Rows"
                        description="DFP Resource Rows assigned to this unit or its home location. Edit them from the DFP Resource Rows page so row changes use the correct effective date."
                        action={<div className="flex flex-wrap justify-end gap-2"><span className={unitSettingsMutedPillClass}>{resourcePools.length} record{resourcePools.length === 1 ? '' : 's'}</span>{settingsLink('platform-dfp-resource-rows', 'Open DFP Resource Rows', { resourcePoolCode: primaryResourcePoolFocusKey })}</div>}
                    >
                        {resourcePools.length > 0 ? resourcePools.map((pool: any) => {
                            return (
                                <div key={pool.id || pool.code} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsReadRow label="Pool name" value={pool.name || pool.code || 'Not named'} muted={!pool.name && !pool.code} />
                                    <UnitSettingsReadRow label="Aircraft type" value={pool.aircraftTypeCode || 'Not linked'} muted={!pool.aircraftTypeCode} />
                                    <UnitSettingsReadRow label="Pool type" value={pool.poolType || 'Dedicated'} />
                                    <UnitSettingsReadRow label="Location" value={pool.locationCode || unit.locationCode || 'Not set'} muted={!pool.locationCode && !unit.locationCode} />
                                    <div className="border-t border-white/10 bg-slate-950/25 p-3 text-xs font-semibold leading-relaxed text-slate-300">
                                        DFP row changes are managed from the DFP Resource Rows page. Saved row changes apply from tomorrow forward, leave today and previous days unchanged, and clear future built schedules that rely on the old rows.
                                    </div>
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="DFP Resource Rows" value="No DFP Resource Rows are assigned to this unit or location." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Aircraft Numbering & Configurations" description="Aircraft type and numbering rules inherited from this unit's DFP Resource Rows." action={settingsLink('platform-aircraft-setup', 'Open Aircraft Setup', { focusSubsectionId: 'platform-aircraft-type-settings' })}>
                        {aircraftTypesForUnit.length > 0 ? aircraftTypesForUnit.map((aircraft: any) => {
                            const composition = normaliseAircraftCrewComposition(aircraft.crewComposition);
                            const configurations = Array.isArray(aircraft.settings?.aircraftConfigurations) ? aircraft.settings.aircraftConfigurations : [];
                            return (
                                <div key={aircraft.code} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsReadRow label="Aircraft code" value={aircraft.code || 'Not set'} muted={!aircraft.code} />
                                    <UnitSettingsReadRow label="Aircraft name" value={aircraft.name || aircraft.code || 'Not set'} muted={!aircraft.name && !aircraft.code} />
                                    <UnitSettingsReadRow label="Standard crew seats" value={composition.crewCount} />
                                    <UnitSettingsReadRow label="Configurations" value={configurations.length ? configurations.map((item: any) => item.label || item.name || item.id).join(', ') : 'Default / ANY'} />
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="Aircraft" value="No aircraft types are linked to this unit yet." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Resource Sharing" description="Whether this unit shares aircraft or DFP resource rows with another unit." action={settingsLink('organisation', 'Open Organisation')}>
                        {resourceSharingForUnit.length > 0 ? resourceSharingForUnit.map((group: any, index: number) => (
                            <div key={group.id || `${group.name}-${index}`} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Arrangement" value={group.name || 'Unnamed resource sharing arrangement'} onChange={() => {}} disabled />
                                <UnitSettingsField label="Units" value={(group.selectedUnits || []).join(', ')} onChange={() => {}} disabled />
                                <UnitSettingsField label="Allocation" value={group.allocationMode || organisationSettings.allocationMode || 'Combined pool'} onChange={() => {}} disabled />
                            </div>
                        )) : <UnitSettingsReadRow label="Resource sharing" value={organisationSettings.fleetSharingEnabled ? 'No resource sharing arrangement includes this unit.' : 'Resource sharing is not enabled for this unit.'} muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Staff Sharing" description="Whether this unit may use staff from another unit for scheduling and build eligibility." action={settingsLink('organisation', 'Open Organisation')}>
                        {staffSharingForUnit.length > 0 ? staffSharingForUnit.map((group: any, index: number) => (
                            <div key={group.id || `${group.name}-${index}`} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Arrangement" value={group.name || 'Unnamed staff sharing arrangement'} onChange={() => {}} disabled />
                                <UnitSettingsField label="Units" value={(group.selectedUnits || []).join(', ')} onChange={() => {}} disabled />
                            </div>
                        )) : <UnitSettingsReadRow label="Staff sharing" value={organisationSettings.staffSharingEnabled ? 'No staff sharing arrangement includes this unit.' : 'Staff sharing is not enabled for this unit.'} muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Build Rules" description="Current build rule values for this unit." action={<div className="flex flex-nowrap justify-end gap-2">{settingsLink('business-rules', 'Build Rules')}{settingsLink('duty-turnaround', 'Duty & Turnaround')}{settingsLink('event-limits', 'Daily Event Limits')}</div>}>
                        <UnitSettingsReadRow label="Max dispatch per hour" value={buildRules.maxDispatchPerHour ?? 8} />
                        <UnitSettingsReadRow label="Flight dispatch stagger" value={formatMinutes(flightStaggerMinutes)} />
                        <UnitSettingsReadRow label="Sim dispatch stagger" value={formatMinutes(simStaggerMinutes)} />
                        <UnitSettingsReadRow label="Preferred duty period" value={formatHours(buildRules.preferredDutyPeriod ?? 8)} />
                        <UnitSettingsReadRow label="Max crew duty period" value={formatHours(buildRules.maxCrewDutyPeriod ?? 10)} />
                        <UnitSettingsReadRow label="Flight turnaround" value={formatHours(buildRules.flightTurnaround ?? 1.2)} />
                        <UnitSettingsReadRow label="Sim turnaround" value={formatHours(buildRules.ftdTurnaround ?? 0.5)} />
                        <UnitSettingsReadRow label="CPT turnaround" value={formatHours(buildRules.cptTurnaround ?? 0.5)} />
                        <UnitSettingsReadRow label="Staff max flights" value={eventLimits?.instructor?.maxFlights ?? 1} />
                        <UnitSettingsReadRow label="Staff max sim" value={eventLimits?.instructor?.maxSimulators ?? 2} />
                        <UnitSettingsReadRow label="Staff max total" value={eventLimits?.instructor?.maxTotal ?? 3} />
                        {unitHasTrainees ? (
                            <>
                                <UnitSettingsReadRow label="Trainee max flight/sim" value={eventLimits?.trainee?.maxFlightFtd ?? 1} />
                                <UnitSettingsReadRow label="Trainee max total" value={eventLimits?.trainee?.maxTotal ?? 2} />
                            </>
                        ) : null}
                    </UnitSettingsGroup>
                </div>
            );
        }

        if (activeCategory === 'crew') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup title="Standard Crew Composition" description="Minimum seats and role eligibility by aircraft and resource type." action={settingsLink('crew-composition', 'Open Crew Composition', { aircraftTypeCode: primaryAircraftTypeCode })}>
                        {aircraftTypesForUnit.length > 0 ? aircraftTypesForUnit.map((aircraft: any) => {
                            const composition = normaliseAircraftCrewComposition(aircraft.crewComposition);
                            return (
                                <div key={aircraft.code || aircraft.name} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsReadRow label={`${aircraft.code || 'Aircraft'} standard seats`} value={composition.crewCount} />
                                    {AIRCRAFT_CREW_RESOURCE_KINDS.map(({ kind, label }) => (
                                        <UnitSettingsReadRow
                                            key={`${aircraft.code}-${kind}`}
                                            label={label}
                                            value={composition.resourceSeatCounts?.[kind] ?? 0}
                                        />
                                    ))}
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="Crew" value="No aircraft crew composition is linked to this unit yet." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Alternate Crew Setups" description="Alternate crew setups available to this unit and operational model." action={<div className="flex items-center gap-2"><span className={unitSettingsMutedPillClass}>{alternateCrewProfiles.length} setup{alternateCrewProfiles.length === 1 ? '' : 's'}</span>{settingsLink('crew-composition', 'Open Alternate Crew', { aircraftTypeCode: primaryAircraftTypeCode, focusSubsectionId: 'platform-alternate-crew-composition' })}</div>}>
                        {alternateCrewProfiles.length > 0 ? alternateCrewProfiles.map((profile) => (
                            <div key={profile.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Setup code" value={profile.code || ''} onChange={(value) => updateAlternateCrewProfile(profile, { code: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Setup name" value={profile.name || ''} onChange={(value) => updateAlternateCrewProfile(profile, { name: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Aircraft type" value={profile.aircraftTypeCode || ''} onChange={(value) => updateAlternateCrewProfile(profile, { aircraftTypeCode: value })} disabled={!canEdit} />
                                <UnitSettingsTextAreaRow label="Role requirements" value={formatRoleRequirementsText(profile.roleRequirements)} onChange={(value) => updateAlternateCrewProfile(profile, { roleRequirements: parseRoleRequirementsText(value) })} disabled={!canEdit} placeholder="Pilot = 2" />
                            </div>
                        )) : <UnitSettingsReadRow label="Alternate crews" value="No alternate crew setups match this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Crew Labels & Qualifications" description="The local words users see for crew roles, plus model-specific qualifications such as PIC." action={settingsLink('platform-rank-terminology', 'Open Qualifications', { focusSubsectionId: 'platform-staff-qualifications' })}>
                        {modelCrewPositions.length > 0 ? (
                            <div className="mx-4 mt-4 overflow-hidden rounded-md border border-cyan-200/20 bg-slate-950/20 first:mt-0">
                                <div className="border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-cyan-100/70">Crew position labels</div>
                                {modelCrewPositions.map((entry) => (
                                    <UnitSettingsField key={entry.id} label={entry.genericName} value={entry.label || ''} onChange={(value) => updateCrewPositionEntry(entry, { label: value })} disabled={!canEdit} />
                                ))}
                            </div>
                        ) : null}
                        {modelQualifications.length > 0 ? (
                            <div className="mx-4 mb-4 mt-4 overflow-hidden rounded-md border border-cyan-200/20 bg-slate-950/20 first:mt-0">
                                <div className="border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-cyan-100/70">Qualifications</div>
                                <div className="grid gap-2 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 md:grid-cols-[minmax(0,1fr)_minmax(120px,0.4fr)]">
                                    <span>Qualification</span>
                                    <span>Code</span>
                                </div>
                                {modelQualifications.map((entry) => (
                                    <div key={entry.id} className="grid gap-2 border-t border-white/10 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(120px,0.4fr)] md:items-center">
                                        <div className="text-xs font-semibold leading-5 text-slate-100">{entry.name || entry.code || 'Not set'}</div>
                                        <div className="text-xs font-semibold leading-5 text-slate-100">{entry.code || 'Not set'}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {modelCrewPositions.length === 0 && modelQualifications.length === 0 ? <UnitSettingsReadRow label="Crew labels" value="No crew labels or qualifications for this model." muted /> : null}
                    </UnitSettingsGroup>
                </div>
            );
        }

        if (activeCategory === 'training') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup title="Schedule Tile Labels" description="Short labels for directed task schedule tiles on this unit's schedule." action={<div className="flex items-center gap-2"><span className={unitSettingsMutedPillClass}>{Object.keys(taskAbbreviations || {}).length} configured</span>{settingsLink('platform-task-profiles', 'Open Directed Task Lists', { focusSubsectionId: `platform-task-tile-abbreviations-${unitFocusAnchor}` })}</div>}>
                        <div className="border-t border-white/10 px-4 py-3">
                            <p className="text-sm leading-6 text-slate-300">
                                Use this when a full task name is too long for the DFP tile. It only changes the short label shown on the schedule tile; it does not change the task, training requirement, or event data.
                            </p>
                            <p className="mt-2 text-xs leading-5 text-cyan-100/75">
                                Example: if the task is a configured directed task and the tile label is TSK, the schedule tile can show Task - TSK.
                            </p>
                        </div>
                        {taskTileLabelProfiles.length > 0 ? (
                            <div className="mx-4 mb-4 overflow-hidden rounded-md border border-cyan-200/20 bg-slate-950/20">
                                <div className="grid gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)]">
                                    <span>Directed task</span>
                                    <span>Tile label</span>
                                </div>
                                {taskTileLabelProfiles.map((profile) => (
                                    <div key={profile} className="grid gap-2 border-t border-white/10 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)] md:items-center">
                                        <div className="min-w-0 text-sm font-semibold text-slate-100">{profile}</div>
                                        <div className={`text-xs font-semibold leading-5 ${taskAbbreviations[profile] ? 'text-slate-100' : 'text-slate-500'}`}>{taskAbbreviations[profile] || 'Uses full directed task name'}</div>
                                    </div>
                                ))}
                            </div>
                        ) : <UnitSettingsReadRow label="Directed task tile labels" value="No directed task names are configured for this operating model." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Directed Task Setups" description="Full reusable directed tasks with aircraft, crew, timing and callsign settings for this unit." action={settingsLink('standard-missions', 'Open Directed Task Setups', { focusSubsectionId: 'platform-standard-mission-records' })}>
                        {standardMissionProfiles.length > 0 ? standardMissionProfiles.map((profile: any) => (
                            <div key={profile.id || profile.missionName} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Short title" value={profile.shortTitle || profile.code || ''} onChange={(value) => updateStandardMissionProfile(profile, { shortTitle: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Directed Task Setup Name" value={profile.missionName || ''} onChange={(value) => updateStandardMissionProfile(profile, { missionName: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Aircraft type" value={profile.aircraftTypeCode || ''} onChange={(value) => updateStandardMissionProfile(profile, { aircraftTypeCode: value })} disabled={!canEdit} />
                                <UnitSettingsNumberField label="Duration minutes" value={Number(profile.durationMinutes ?? 0)} onChange={(value) => updateStandardMissionProfile(profile, { durationMinutes: value })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Directed Task Setups" value="No full directed task setups are configured for this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title={configuredContinuationCurrencyEventsLabel} description="Request and build event settings are configured under Training & Standards." action={settingsLink('sct-events', `Open ${configuredContinuationCurrencyEventsLabel}`)}>
                        <UnitSettingsReadRow label="Source" value="Training & Standards" />
                        <UnitSettingsReadRow label="Events" value={`${configuredContinuationShortLabel} and currency event rows are edited in one place.`} />
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Training Reports Builder" description="Unit report naming, pass/fail wording, grading and module labels." action={settingsLink('training-report-template', 'Open Training Reports', { unitCode: unit.code, focusSubsectionId: 'platform-unit-training-report-template' })}>
                        <UnitSettingsField label="Report short name" value={trainingReportTerminology.name} onChange={(value) => updateUnitSettings({ trainingReportTerminology: { name: value.slice(0, 10) } })} disabled={!canEdit} />
                        <UnitSettingsField label="Display name" value={trainingReportTemplate.displayName} onChange={(value) => updateUnitTrainingReportTemplate({ displayName: value.slice(0, 20) })} disabled={!canEdit} />
                        <UnitSettingsNumberField label="Grade minimum" value={Number(trainingReportTemplate.grades.scaleMin ?? 0)} onChange={(value) => updateUnitTrainingReportTemplate({ grades: { ...trainingReportTemplate.grades, scaleMin: value } })} disabled={!canEdit} />
                        <UnitSettingsNumberField label="Grade maximum" value={Number(trainingReportTemplate.grades.scaleMax ?? 5)} onChange={(value) => updateUnitTrainingReportTemplate({ grades: { ...trainingReportTemplate.grades, scaleMax: value } })} disabled={!canEdit} />
                        <UnitSettingsField label="Satisfactory label" value={trainingReportTemplate.overallResults.passLabel || ''} onChange={(value) => updateUnitTrainingReportTemplate({ overallResults: { ...trainingReportTemplate.overallResults, passLabel: value } })} disabled={!canEdit} />
                        <UnitSettingsField label="Unsatisfactory label" value={trainingReportTemplate.overallResults.failLabel || ''} onChange={(value) => updateUnitTrainingReportTemplate({ overallResults: { ...trainingReportTemplate.overallResults, failLabel: value } })} disabled={!canEdit} />
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Scoring Matrix for Training Reports" description="Assessment element scoring standards used by training reports." action={settingsLink('scoring-matrix', 'Open Scoring Matrix')}>
                        <UnitSettingsReadRow label="Scope" value="Organisation scoring standards used by applicable training reports." />
                        <UnitSettingsReadRow label="Unit" value={unit.code || 'Current unit'} />
                    </UnitSettingsGroup>
                </div>
            );
        }

        if (activeCategory === 'labels') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup title="Personnel Terminology" description="How people, ranks and instructors are named for this organisation." action={settingsLink('platform-rank-terminology', 'Open Terminology', { focusSubsectionId: 'platform-personnel-terminology' })}>
                        <UnitSettingsSelect label="Personnel sort" value={personnelDisplaySettings.sortMode || 'rank-then-name'} options={['rank-then-name', 'alphabetical']} optionLabels={{ 'rank-then-name': 'Rank then name', alphabetical: 'Alphabetical' }} onChange={(value) => updatePersonnelDisplaySettings({ sortMode: value })} disabled={!canEdit} />
                        <UnitSettingsField label="Instructor display term" value={personnelDisplaySettings.instructorLabel || ''} onChange={(value) => updatePersonnelDisplaySettings({ instructorLabel: value })} disabled={!canEdit} />
                        <UnitSettingsReadRow label="Civilian titles" value={(personnelDisplaySettings.civilianTitles || []).join(', ') || 'Mr, Ms, Dr'} />
                        <UnitSettingsSelect label="Trainee ranks" value={personnelDisplaySettings.useSeparateTraineeRankOrder ? 'separate' : 'staff'} options={['staff', 'separate']} optionLabels={{ staff: 'Uses staff rank order', separate: 'Separate trainee rank order' }} onChange={(value) => updatePersonnelDisplaySettings({ useSeparateTraineeRankOrder: value === 'separate' })} disabled={!canEdit} />
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Crew Position Labels" description="Generic scheduler roles mapped to customer-facing words." action={settingsLink('platform-rank-terminology', 'Open Crew Labels', { focusSubsectionId: 'platform-crew-position-labels' })}>
                        {crewPositionTerminology.positions.map((entry) => (
                            <div key={entry.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Generic role" value={entry.genericName || ''} onChange={(value) => updateCrewPositionEntry(entry, { genericName: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Display label" value={entry.label || ''} onChange={(value) => updateCrewPositionEntry(entry, { label: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Models" value={(entry.operationalModels || []).join(', ')} onChange={(value) => updateCrewPositionEntry(entry, { operationalModels: value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={!canEdit} />
                            </div>
                        ))}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Unit Callsigns" description="Callsign bases offered when creating or editing unit events." action={settingsLink('platform-rank-terminology', 'Open Unit Callsigns', { focusSubsectionId: 'platform-unit-callsigns' })}>
                        <UnitSettingsReadRow
                            label="Assignment"
                            value={UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS[getUnitCallsignPolicy(unitCallsignSettings, unit?.code).allocationMethod]}
                        />
                        {unitCallsignEntries.length > 0 ? unitCallsignEntries.map((entry) => (
                            <div key={entry.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Callsign" value={entry.callsign || ''} onChange={(value) => updateUnitCallsignEntry(entry, { callsign: value })} disabled={!canEdit} />
                                <UnitSettingsSelect label="Default" value={entry.isDefault ? 'yes' : 'no'} options={['yes', 'no']} optionLabels={{ yes: 'Default callsign', no: 'Available callsign' }} onChange={(value) => updateUnitCallsignEntry(entry, { isDefault: value === 'yes' })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Callsigns" value="No callsigns configured for this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Formation Callsigns" description="Formation callsigns filtered for the current unit." action={settingsLink('platform-rank-terminology', 'Open Formation Callsigns', { focusSubsectionId: 'platform-formation-callsigns' })}>
                        {unitFormationCallsigns.length > 0 ? unitFormationCallsigns.map((callsign) => (
                            <div key={`${callsign.unit}-${callsign.code}-${callsign.locationCode}`} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Name" value={callsign.name || ''} onChange={() => {}} disabled />
                                <UnitSettingsField label="Code" value={callsign.code || ''} onChange={() => {}} disabled />
                                <UnitSettingsField label="Location" value={callsign.locationCode || callsign.location || ''} onChange={() => {}} disabled />
                            </div>
                        )) : <UnitSettingsReadRow label="Formation callsigns" value="No formation callsigns are configured for this unit." muted />}
                    </UnitSettingsGroup>
                </div>
            );
        }

        if (activeCategory === 'access') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup title="Enabled Tools" description="Feature/module switches for this unit." action={settingsLink('platform-unit-modules', 'Open Unit Features', { focusSubsectionId: `platform-unit-modules-${unitFocusAnchor}` })}>
                        {modules.length > 0 ? modules.map((module: any) => {
                            const unitModule = unitModules.find((item: any) => (
                                normaliseUnitSettingsIdentifier(item?.unitCode) === normaliseUnitSettingsIdentifier(unit.code)
                                && normaliseUnitSettingsIdentifier(item?.moduleCode) === normaliseUnitSettingsIdentifier(module.code)
                            ));
                            const checked = unitModule?.isEnabled !== false;
                            return (
                                <label key={module.code} className={unitSettingsRowClass}>
                                    <span className={unitSettingsLabelClass}>{module.name || module.code}</span>
                                    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-100">
                                        {checked ? 'Enabled' : 'Disabled'}
                                        <input type="checkbox" className="h-4 w-4 accent-cyan-400" checked={checked} disabled onChange={(event) => updateUnitModule(module.code, event.target.checked)} />
                                    </span>
                                </label>
                            );
                        }) : <UnitSettingsReadRow label="Modules" value="No modules have been configured yet." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Master LMP Access" description="Which Master LMP records this unit can see or manage." action={settingsLink('platform-master-lmp-access', 'Open Master LMP Access', { focusSubsectionId: 'platform-master-lmp-access-records' })}>
                        {masterLmpAccessForUnit.length > 0 ? masterLmpAccessForUnit.map((rule: any, index: number) => (
                            <div key={rule.id || index} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Master LMP" value={rule.lmpCode || rule.masterLmpName || rule.masterLmpId || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { lmpCode: value })} disabled={!canEdit} />
                                <UnitSettingsSelect label="Access level" value={rule.accessLevel || 'View'} options={['View', 'Assign', 'Manage']} onChange={(value) => updateMasterLmpAccessRule(rule, { accessLevel: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Location" value={rule.locationCode || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { locationCode: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Unit" value={rule.unitCode || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { unitCode: value })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Access rules" value="No unit-specific Master LMP restrictions. Organisation settings apply." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Manage User Permissions" description="Users or profiles with access that includes this unit." action={settingsLink('platform-user-access', 'Open User Access', { locationCode: unit.locationCode, focusSubsectionId: unit.locationCode ? `platform-user-access-location-${settingsAnchorSuffix(unit.locationCode)}` : 'platform-user-access-records' })}>
                        {userAccessScopeCards.length > 0 ? (
                            <div className="space-y-3 border-t border-white/10 p-4">
                                {userAccessScopeCards.map((card: any, index: number) => (
                                    <div key={`${card.userLabel}-${card.summary}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-50">{card.userLabel}</div>
                                                <div className="mt-1 text-xs font-semibold leading-5 text-cyan-100">{card.summary}</div>
                                            </div>
                                            {card.count > 1 ? <span className={unitSettingsMutedPillClass}>{card.count} matching records</span> : null}
                                        </div>
                                        <div className="mt-3 grid gap-2 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                                            <span className={unitSettingsLabelClass}>Permission profiles</span>
                                            <div className={`text-xs font-semibold leading-5 ${card.profiles.length > 0 ? 'text-slate-100' : 'text-slate-400'}`}>
                                                {card.profiles.length > 0 ? card.profiles.join(', ') : 'No permission profile assigned'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <UnitSettingsReadRow label="Users" value="No access scopes currently include this unit." muted />}
                    </UnitSettingsGroup>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <UnitSettingsGroup title="Unit Identity" description="The core settings that decide where this unit lives and which operational model it uses." action={settingsLink('platform-units', 'Open Units', { unitCode: unit.code })}>
                    <UnitSettingsField label="Unit code" value={contextDisplayCode || unit.code || ''} onChange={() => {}} disabled />
                    <UnitSettingsField label="Unit name" value={contextDisplayName || unit.name || ''} onChange={(value) => updateUnit({ name: value })} disabled={!canEdit} />
                    {isCombinedUnitContext ? (
                        <UnitSettingsReadRow label="Member units" value={contextUnits.map((contextUnit: any) => `${contextUnit.code}${contextUnit.name && contextUnit.name !== contextUnit.code ? ` - ${contextUnit.name}` : ''}`).join('\n')} />
                    ) : null}
                    <UnitSettingsSelect label="Location" value={contextLocationDisplay || unit.locationCode || ''} options={locations.map((item: any) => item.code)} onChange={(value) => updateUnit({ locationCode: value })} disabled={!canEdit} />
                    <UnitSettingsSelect label="Unit type" value={isCombinedUnitContext ? 'Combined unit context' : unit.unitType || ''} options={unitTypeOptions} onChange={(value) => updateUnit({ unitType: value })} disabled={!canEdit} />
                    <UnitSettingsField label="Trainees" value={unitHasTrainees ? 'On' : 'Off'} onChange={() => {}} disabled />
                    <UnitSettingsSelect label="Operating model" value={isCombinedUnitContext ? operationalModelDisplay : operationalModel} options={OPERATIONAL_MODEL_OPTIONS.map((option) => option.value)} optionLabels={modelOptionLabels} onChange={(value) => updateUnitSettings({ operationalModel: value })} disabled={!canEdit} />
                </UnitSettingsGroup>
                <UnitSettingsGroup title="Organisation & Location" description="Where this unit sits in the configured organisation." action={<div className="flex flex-wrap justify-end gap-2">{settingsLink('platform-units', 'Unit ownership', { unitCode: unit.code })}{settingsLink('platform-organisation-locations', 'Locations', { locationCode: unit.locationCode })}</div>}>
                    <UnitSettingsField label="Parent organisation" value={formatPlainList(parentPath, '')} onChange={(value) => updateUnitSettings({ parentOrganisationPath: value.split('/').map((part) => part.trim()).filter(Boolean), parentOrganisation: value.split('/').map((part) => part.trim()).filter(Boolean).join('-') })} disabled={!canEdit} />
                    <UnitSettingsField label="Home location name" value={location ? `${location.name || location.code}` : unit.locationCode || ''} onChange={(value) => updateLocation(location, { name: value })} disabled={!canEdit || !location} />
                    <UnitSettingsField label="Timezone" value={location?.timezone || ''} onChange={(value) => updateLocation(location, { timezone: value })} disabled={!canEdit || !location} />
                    <UnitSettingsField label="Training areas" value={Array.isArray(location?.trainingAreas) ? location.trainingAreas.join(', ') : ''} onChange={(value) => updateLocation(location, { trainingAreas: value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={!canEdit || !location} />
                    <UnitSettingsSelect label="Scheduling model" value={operationalModel} options={OPERATIONAL_MODEL_OPTIONS.map((option) => option.value)} optionLabels={modelOptionLabels} onChange={(value) => updateUnitSettings({ operationalModel: value })} disabled={!canEdit} />
                </UnitSettingsGroup>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.24)] backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">My Unit Settings</p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-normal text-white">{contextDisplayName || unit.name || unit.code}</h3>
                        <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                            A simplified read-only view of the Settings records for this {isCombinedUnitContext ? 'combined unit context' : 'unit'}. Use the Open buttons to edit the authoritative setting in Settings.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className={unitSettingsMutedPillClass}>{contextDisplayCode || unit.code}</span>
                        <span className={unitSettingsMutedPillClass}>{operationalModelDisplay}</span>
                        <span className={unitSettingsMutedPillClass}>{contextLocationDisplay || 'No location'}</span>
                    </div>
                </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)]">
                <nav className="h-fit rounded-2xl border border-white/10 bg-white/[0.045] p-2 backdrop-blur">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => setActiveCategory(category.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                                activeCategory === category.id
                                    ? 'bg-white/15 text-white shadow-inner'
                                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                            }`}
                        >
                            <span>{category.label}</span>
                            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">{category.count}</span>
                        </button>
                    ))}
                </nav>
                <div>{renderCategory()}</div>
            </div>
        </div>
    );
};

const InitialSetupWizard: React.FC<{
    platformConfig?: any;
    organisationSettings?: any;
    unitCode?: string;
    locationCode?: string;
    formationCallsigns?: FormationCallsign[];
    buildRuleSettings?: ScheduleViewProps['buildRuleSettings'];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
    currentUserPermission?: AppUserPermission;
    canUsePlatformPermission?: (permissionId: string) => boolean;
    isSetupTestMode?: boolean;
    onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
}> = ({ platformConfig, organisationSettings, unitCode, locationCode, formationCallsigns = [], buildRuleSettings, onUpdatePlatformConfig, onNavigateToSettingsSection, currentUserPermission = 'Staff', canUsePlatformPermission, isSetupTestMode = false, onSaveSetupTestPersonnel }) => {
    const [mode, setMode] = useState<InitialSetupWizardMode>('detect');
    const unitTypeOptions = useMemo(() => normaliseUnitTypeOptions(platformConfig), [platformConfig]);
    const configuredContinuationShortLabel = useMemo(
        () => getSctTerminology(platformConfig, unitCode).shortLabel || 'ContT',
        [platformConfig, unitCode],
    );
    const configuredContinuationCurrencyEventsLabel = `${configuredContinuationShortLabel} / Currency Events`;
    const [wizardStep, setWizardStep] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(window.localStorage.getItem(initialSetupWizardStorageKey));
        return Number.isFinite(stored) ? Math.max(0, stored) : 0;
    });
    const [completedWizardStepIds, setCompletedWizardStepIds] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const parsed = JSON.parse(window.localStorage.getItem(initialSetupWizardCompletedStepsStorageKey) || '[]');
            return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item || '')).filter(Boolean) : []);
        } catch {
            return new Set();
        }
    });
    const [wizardPageMenuOpen, setWizardPageMenuOpen] = useState(false);
    const wizardCurrentStepMenuItemRef = useRef<HTMLButtonElement | null>(null);
    const [uploadResults, setUploadResults] = useState<Record<string, InitialSetupWizardUploadResult>>({});
    const [importConfirmations, setImportConfirmations] = useState<Record<string, string>>({});
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState('');
    const [uploadedStaffProfileRows, setUploadedStaffProfileRows] = useState<any[]>([]);
    const [uploadedTraineeProfileRows, setUploadedTraineeProfileRows] = useState<any[]>([]);
    const [uploadedCourseLmpItems, setUploadedCourseLmpItems] = useState<SyllabusItemDetail[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const lastSetupTestPersonnelSnapshotRef = useRef('');
    const wizardShellRef = useRef<HTMLDivElement | null>(null);
    const wizardSettingsEmbedRef = useRef<HTMLDivElement | null>(null);
    const wizardDiagnosticStorageKeys = [
        'dfp_setup_wizard_import_diag',
        'dfp_setup_test_lmp_diag',
        'dfp_setup_wizard_org_diag',
    ];
    const safeSetWizardLocalStorage = (key: string, value: string) => {
        if (typeof window === 'undefined') return false;
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (error: any) {
            const isQuotaError = /quota/i.test(String(error?.name || error?.message || ''));
            if (!isQuotaError) {
                return false;
            }
            wizardDiagnosticStorageKeys.forEach((diagKey) => {
                try { window.localStorage.removeItem(diagKey); } catch { /* ignore quota cleanup failure */ }
            });
            try {
                window.localStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                return false;
            }
        }
    };
    const compactWizardDiagDetails = (details: Record<string, any> = {}) => {
        const compactValue = (value: any, depth = 0): any => {
            if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
            if (Array.isArray(value)) {
                return {
                    count: value.length,
                    sample: value.slice(0, 5).map((item) => compactValue(item, depth + 1)),
                };
            }
            if (typeof value === 'object') {
                const entries = Object.entries(value);
                if (depth >= 2) {
                    return {
                        keys: entries.map(([key]) => key).slice(0, 20),
                        keyCount: entries.length,
                    };
                }
                return entries.slice(0, 20).reduce((next, [key, item]) => ({
                    ...next,
                    [key]: compactValue(item, depth + 1),
                }), {});
            }
            return String(value);
        };
        return compactValue(details);
    };
    const pushWizardImportDiag = (stage: string, details: Record<string, any> = {}) => {
        if (!isSetupTestMode || typeof window === 'undefined') return;
        const entry = {
            ts: new Date().toISOString(),
            stage,
            unitCode,
            details: compactWizardDiagDetails(details),
        };
        try {
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_wizard_import_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-30);
            safeSetWizardLocalStorage('dfp_setup_wizard_import_diag', JSON.stringify(next));
            (window as any).neoSetupWizardImportDiag = next;
        } catch (error) {
        }
    };
    const pushWizardLmpDiag = (stage: string, details: Record<string, any> = {}) => {
        if (!isSetupTestMode || typeof window === 'undefined') return;
        const setupTestKeys = Object.keys(window.localStorage || {})
            .filter((key) => key.includes('setup_test') || key.includes('neo_lmp_details'))
            .sort();
        const entry = {
            ts: new Date().toISOString(),
            stage,
            activeUnitCode: unitCode,
            activeLocationCode: locationCode,
            trainingDraft: {
                lmpCode: trainingDraft?.lmpCode,
                lmpName: trainingDraft?.lmpName,
                accessLocationCode: trainingDraft?.accessLocationCode,
                accessUnitCode: trainingDraft?.accessUnitCode,
                accessLevel: trainingDraft?.accessLevel,
            },
            unitDraft: {
                code: unitDraft?.code,
                locationCode: unitDraft?.locationCode,
                operationalModel: unitDraft?.operationalModel,
            },
            locationDraft: {
                code: locationDraft?.code,
                iataCode: locationDraft?.iataCode,
                name: locationDraft?.name,
            },
            stagedCourseLmpItems: uploadedCourseLmpItems.length,
            setupTestKeys,
            details: compactWizardDiagDetails(details),
        };
        try {
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_test_lmp_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-50);
            safeSetWizardLocalStorage('dfp_setup_test_lmp_diag', JSON.stringify(next));
            (window as any).neoSetupTestLmpDiag = next;
        } catch (error) {
        }
    };
    const pushWizardOrgDiag = (stage: string, details: Record<string, any> = {}) => {
        if (typeof window === 'undefined') return;
        const entry = {
            ts: new Date().toISOString(),
            stage,
            activeUnitCode: unitCode,
            activeLocationCode: locationCode,
            isSetupTestMode,
            details: compactWizardDiagDetails(details),
        };
        try {
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_wizard_org_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-50);
            safeSetWizardLocalStorage('dfp_setup_wizard_org_diag', JSON.stringify(next));
            (window as any).neoSetupWizardOrgDiag = next;
        } catch (error) {
        }
    };

    useEffect(() => {
        pushWizardLmpDiag('wizard:staged-items-state', {
            stagedCount: uploadedCourseLmpItems.length,
            stagedCodes: uploadedCourseLmpItems.slice(0, 20).map((item) => ({
                id: item.id,
                code: item.code,
                title: item.eventDescription,
                courses: item.courses,
                unit: item.unit,
                location: item.location,
                sortOrder: item.sortOrder,
            })),
        });
    }, [uploadedCourseLmpItems]);

    const baseActiveOrganisation = getActiveOrganisation(platformConfig);
    const activeOrganisation = baseActiveOrganisation
        ? {
            ...baseActiveOrganisation,
            settings: {
                ...(baseActiveOrganisation.settings || {}),
                ...(organisationSettings || {}),
            },
        }
        : baseActiveOrganisation;
    const currentWizardUnitCode = normaliseUnitSettingsIdentifier(unitCode);
    const currentWizardUnitCodes = Array.from(new Set(
        currentWizardUnitCode
            .split('+')
            .map((code) => normaliseUnitSettingsIdentifier(code))
            .filter(Boolean)
    ));
    const configuredWizardUnits = platformConfig?.units || [];
    const exactCurrentUnit = configuredWizardUnits.find((unit: any) => (
        normaliseUnitSettingsIdentifier(unit?.code) === currentWizardUnitCode
    ));
    const firstCurrentMemberUnit = !exactCurrentUnit && currentWizardUnitCodes.length > 0
        ? configuredWizardUnits.find((unit: any) => currentWizardUnitCodes.includes(normaliseUnitSettingsIdentifier(unit?.code)))
        : null;
    const currentUnit = exactCurrentUnit
        || firstCurrentMemberUnit
        || (!currentWizardUnitCode ? configuredWizardUnits[0] : null);
    const activeWizardLocationCode = String(locationCode || currentUnit?.locationCode || '').trim().toUpperCase();
    const currentUnitLocationKey = normaliseUnitSettingsIdentifier(currentUnit?.locationCode || activeWizardLocationCode);
    const currentLocation = (platformConfig?.locations || []).find((location: any) => (
        [
            location?.code,
            location?.iataCode,
            location?.icao,
            location?.icaoCode,
            location?.settings?.iataCode,
            location?.settings?.icaoCode,
            location?.settings?.legacyCode,
            ...(Array.isArray(location?.aliases) ? location.aliases : []),
            ...(Array.isArray(location?.settings?.aliases) ? location.settings.aliases : []),
        ].some((value) => normaliseUnitSettingsIdentifier(value) === currentUnitLocationKey)
    )) || (platformConfig?.locations || [])[0];
    const organisationStructureLevels = Array.isArray(activeOrganisation?.settings?.organisationStructure?.levels)
        ? activeOrganisation.settings.organisationStructure.levels
        : [];
    const activeLocations = (platformConfig?.locations || []).filter((location: any) => (
        String(location?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    ));
    const configuredWizardLocationProfiles = Array.from(new Map([
        ...activeLocations.map(normaliseWizardLocationProfile),
    ].filter((profile) => profile.icao || profile.iata || profile.name).map((profile) => [
        normaliseUnitSettingsIdentifier(profile.icao || profile.iata || profile.name),
        profile,
    ])).values());
    const fallbackWizardLocationProfiles = Array.from(new Map([
        ...Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES || {}).map(normaliseWizardLocationProfile),
    ].filter((profile) => profile.icao || profile.iata || profile.name).map((profile) => [
        normaliseUnitSettingsIdentifier(profile.icao || profile.iata || profile.name),
        profile,
    ])).values());
    const wizardLocationLookupProfiles = [...configuredWizardLocationProfiles, ...fallbackWizardLocationProfiles];
    const wizardLocationIcaoOptions = configuredWizardLocationProfiles.map((profile) => profile.icao).filter(Boolean);
    const wizardLocationIataOptions = configuredWizardLocationProfiles.map((profile) => profile.iata).filter(Boolean);
    const wizardLocationNameOptions = configuredWizardLocationProfiles.map((profile) => profile.name).filter(Boolean);
    const findWizardLocationProfile = (value: string) => {
        const key = normaliseUnitSettingsIdentifier(value);
        return wizardLocationLookupProfiles.find((profile) => (
            normaliseUnitSettingsIdentifier(profile.icao) === key
            || normaliseUnitSettingsIdentifier(profile.iata) === key
            || normaliseUnitSettingsIdentifier(profile.name) === key
        ));
    };
    const activeWizardLocationProfile = findWizardLocationProfile(activeWizardLocationCode);
    const activeWizardLocationRow = {
        icao: activeWizardLocationProfile?.icao || activeWizardLocationCode || '',
        iata: activeWizardLocationProfile?.iata || '',
        name: activeWizardLocationProfile?.name || activeWizardLocationCode || '',
    };
    const activeUnits = (platformConfig?.units || []).filter((unit: any) => (
        String(unit?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    ));
    const activeAircraftTypes = (platformConfig?.aircraftTypes || []).filter((aircraft: any) => (
        String(aircraft?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    ));
    const activeResourcePools = (platformConfig?.resourcePools || []).filter((pool: any) => (
        String(pool?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    ));
    const activeUserAccess = (platformConfig?.userAccess || []).filter((access: any) => (
        String(access?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    ));
    const activeMasterLmpCatalogue = Array.isArray(activeOrganisation?.settings?.masterLmpCatalogue)
        ? activeOrganisation.settings.masterLmpCatalogue.filter((item: any) => String(item?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        : [];
    const activeMasterLmpAccess = getOrganisationMasterLmpAccessRules(activeOrganisation?.settings)
        .filter((item: any) => String(item?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');
    const crewCompositionSettings = normaliseCrewCompositionSettings(activeOrganisation?.settings?.crewCompositionSettings || null);
    const getAircraftStandardSeats = (aircraft: any) => {
        const crewComposition = aircraft?.crewComposition && typeof aircraft.crewComposition === 'object'
            ? aircraft.crewComposition
            : null;
        return Array.isArray(crewComposition?.standardSeats) ? crewComposition.standardSeats : [];
    };
    const standardCrewConfigured = activeAircraftTypes.some((aircraft: any) => {
        const standardSeats = getAircraftStandardSeats(aircraft);
        return Array.isArray(standardSeats) && standardSeats.length > 0;
    }) || crewCompositionSettings.alternateCompositions.length > 0;
    const orgStructureConfigured = organisationStructureLevels.length > 0 && organisationStructureLevels.some((level: any) => (
        String(level?.name || '').trim() && Array.isArray(level?.options) && level.options.length > 0
    ));
    const primaryResourcePool = activeResourcePools.find((pool: any) => (
        normaliseUnitSettingsIdentifier(pool?.unitCode) === normaliseUnitSettingsIdentifier(currentUnit?.code)
    )) || activeResourcePools.find((pool: any) => (
        !normaliseUnitSettingsIdentifier(pool?.unitCode)
        && normaliseUnitSettingsIdentifier(pool?.locationCode) === normaliseUnitSettingsIdentifier(currentLocation?.code)
    )) || null;
    const primaryAircraftType = activeAircraftTypes.find((aircraft: any) => (
        primaryResourcePool?.aircraftTypeCode
        && normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(primaryResourcePool.aircraftTypeCode)
    )) || activeAircraftTypes[0] || null;
    const primaryUserAccess = activeUserAccess.find((access: any) => (
        normaliseUnitSettingsIdentifier(access?.unitCode || access?.unit) === normaliseUnitSettingsIdentifier(currentUnit?.code)
        || normaliseUnitSettingsIdentifier(access?.locationCode || access?.location) === normaliseUnitSettingsIdentifier(currentLocation?.code)
    )) || activeUserAccess[0] || null;
    const primaryMasterLmp = activeMasterLmpCatalogue[0] || null;
    const primaryMasterLmpRule = activeMasterLmpAccess.find((rule: any) => (
        normaliseUnitSettingsIdentifier(rule?.unitCode || rule?.unit) === normaliseUnitSettingsIdentifier(currentUnit?.code)
    )) || activeMasterLmpAccess[0] || null;
    const currentPersonnelDisplaySettings = normalisePersonnelDisplaySettings(
        activeOrganisation?.settings?.personnelDisplaySettings
        || activeOrganisation?.settings?.personnelSettings
        || null,
    );
    const currentWizardCrewPositionTerminology = normaliseCrewPositionTerminology(activeOrganisation?.settings?.crewPositionTerminology || null);
    const levelDraftSource = (levelIndex: number) => organisationStructureLevels.find((level: any) => Number(level?.levelIndex ?? level?.level ?? levelIndex) === levelIndex) || organisationStructureLevels[levelIndex] || {};
    const parentLinesForLevel = (levelIndex: number, fallback = '') => {
        const level = levelDraftSource(levelIndex) || {};
        const parentByChild = level?.parentByChild && typeof level.parentByChild === 'object' ? level.parentByChild : {};
        const directLines: string[] = [];
        const seenChildren = new Set<string>();
        Object.entries(parentByChild).forEach(([child, parent]) => {
            const cleanChild = String(child || '').trim();
            const cleanParent = String(parent || '').trim();
            const childKey = normaliseUnitSettingsIdentifier(cleanChild);
            if (!cleanChild || !cleanParent || seenChildren.has(childKey)) return;
            directLines.push(`${cleanChild} = ${cleanParent}`);
            seenChildren.add(childKey);
        });
        if (directLines.length > 0) return directLines.join('\n');
        const relationshipPaths = Array.isArray(activeOrganisation?.settings?.organisationStructure?.relationshipPaths)
            ? activeOrganisation.settings.organisationStructure.relationshipPaths
            : [];
        const pathLines: string[] = [];
        const seenPathChildren = new Set<string>();
        relationshipPaths.forEach((rawPath: any) => {
            const path = Array.isArray(rawPath) ? rawPath.map((part) => String(part || '').trim()).filter(Boolean) : [];
            const child = path[levelIndex];
            const parent = path[levelIndex - 1];
            const childKey = normaliseUnitSettingsIdentifier(child);
            if (!child || !parent || seenPathChildren.has(childKey)) return;
            pathLines.push(`${child} = ${parent}`);
            seenPathChildren.add(childKey);
        });
        return pathLines.length > 0 ? pathLines.join('\n') : fallback;
    };
    const toLines = (items: any[]) => (Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean).join('\n') : '');
    const fromLines = (value: string) => String(value || '').split(/\n/).map((item) => item.trim()).filter(Boolean);
    const normaliseOrganisationLevelCount = (value: unknown, fallback = 3) => (
        Math.max(3, Math.min(MAX_INITIAL_SETUP_ORGANISATION_LEVELS, Math.round(Number(value) || fallback)))
    );
    const getOrganisationLevelCountBeforeUnits = (levels: any[], fallback = 3) => {
        const deepestLevel = (Array.isArray(levels) ? levels : [])
            .map((level: any, index: number) => ({
                index,
                levelIndex: Number(level?.levelIndex ?? level?.level ?? index),
                name: String(level?.name || '').trim(),
            }))
            .filter((level) => level.levelIndex > 0 && level.name.toLowerCase() !== 'unit')
            .reduce((maxLevel, level) => Math.max(maxLevel, Number.isFinite(level.levelIndex) ? level.levelIndex : level.index), 0);
        return normaliseOrganisationLevelCount(deepestLevel || fallback, fallback);
    };
    const normaliseOrganisationDraftLevel = (level: any, levelIndex: number) => ({
        levelIndex,
        name: String(level?.name || '').trim().toLowerCase() === 'unit' ? `Level ${levelIndex}` : String(level?.name || `Level ${levelIndex}`),
        options: String(level?.name || '').trim().toLowerCase() === 'unit'
            ? []
            : Array.isArray(level?.options)
                ? level.options.map((item: any) => String(item || '').trim()).filter(Boolean)
                : fromLines(level?.options || ''),
        parents: String(level?.name || '').trim().toLowerCase() === 'unit' ? '' : String(level?.parents || ''),
    });
    const getOrganisationDraftLevel = (draft: any, levelIndex: number) => {
        if (levelIndex === 0) return {
            levelIndex,
            name: draft?.level0Name || draft?.name || draft?.code || 'Organisation',
            options: fromLines(draft?.level0Options || draft?.name || draft?.code),
            parents: '',
        };
        if (levelIndex === 1) return { levelIndex, name: draft?.level1Name || 'Level 1', options: fromLines(draft?.level1Options), parents: draft?.level1Parents || '' };
        if (levelIndex === 2) return { levelIndex, name: draft?.level2Name || 'Level 2', options: fromLines(draft?.level2Options), parents: draft?.level2Parents || '' };
        if (levelIndex === 3) return { levelIndex, name: draft?.level3Name || 'Level 3', options: fromLines(draft?.level3Options), parents: draft?.level3Parents || '' };
        const extra = Array.isArray(draft?.additionalLevels) ? draft.additionalLevels[levelIndex - 4] : null;
        return normaliseOrganisationDraftLevel(extra, levelIndex);
    };
    const getOrganisationDraftLevels = (draft: any) => {
        const savedOrganisationLevelCount = getOrganisationLevelCountBeforeUnits(organisationStructureLevels, 3) + 1;
        const configuredCount = Math.min(
            MAX_INITIAL_SETUP_ORGANISATION_LEVELS + 1,
            Math.max(
                normaliseOrganisationLevelCount(draft?.organisationLevelCount, 3) + 1,
                Array.isArray(draft?.additionalLevels) ? draft.additionalLevels.length + 4 : 4,
                savedOrganisationLevelCount,
            ),
        );
        return Array.from({ length: configuredCount }, (_, levelIndex) => getOrganisationDraftLevel(draft, levelIndex));
    };
    const cleanOrganisationDraftLevels = (levels: any[], rootFallback: string) => {
        const rootLabel = String(levels?.[0]?.options?.[0] || rootFallback || 'Organisation').trim() || 'Organisation';
        const seenAncestorKeys = new Set([normaliseUnitSettingsIdentifier(rootLabel)]);
        return (Array.isArray(levels) ? levels : []).map((level, levelIndex) => {
            if (levelIndex === 0) {
                return {
                    ...level,
                    name: String(level?.name || rootLabel || 'Organisation'),
                    options: [rootLabel].filter(Boolean),
                };
            }
            const cleanOptions: string[] = [];
            const seenLevelKeys = new Set<string>();
            (Array.isArray(level?.options) ? level.options : []).forEach((option: any) => {
                const cleanOption = String(option || '').trim();
                const optionKey = normaliseUnitSettingsIdentifier(cleanOption);
                if (!cleanOption || !optionKey || seenLevelKeys.has(optionKey) || seenAncestorKeys.has(optionKey)) return;
                cleanOptions.push(cleanOption);
                seenLevelKeys.add(optionKey);
            });
            cleanOptions.forEach((option) => seenAncestorKeys.add(normaliseUnitSettingsIdentifier(option)));
            const rawName = String(level?.name || '').trim();
            const nameKey = normaliseUnitSettingsIdentifier(rawName);
            const cleanName = !rawName
                || nameKey === normaliseUnitSettingsIdentifier(rootLabel)
                || cleanOptions.some((option) => normaliseUnitSettingsIdentifier(option) === nameKey)
                ? `Level ${levelIndex + 1}`
                : rawName;
            return {
                ...level,
                name: cleanName,
                options: cleanOptions,
                parents: String(level?.parents || ''),
            };
        }).filter((level, index) => index === 0 || (Array.isArray(level.options) && level.options.length > 0));
    };
    const parseNumberDraft = (value: string, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const readStoredOrganisationDraft = () => {
        if (typeof window === 'undefined') return null;
        try {
            const parsed = JSON.parse(window.localStorage.getItem(initialSetupWizardOrganisationDraftStorageKey) || 'null');
            pushWizardOrgDiag('stored-draft:read', {
                found: Boolean(parsed && typeof parsed === 'object'),
                draft: parsed,
            });
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            pushWizardOrgDiag('stored-draft:read-error', {
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    };
    const storedOrganisationDraft = useMemo(() => readStoredOrganisationDraft(), []);
    const shouldUseStoredOrganisationDraft = Boolean(storedOrganisationDraft) && !orgStructureConfigured;
    const organisationDraftDirtyRef = useRef(shouldUseStoredOrganisationDraft);
    const buildHydratedOrganisationDraft = () => ({
        code: String(activeOrganisation?.code || 'ORG'),
        name: String(activeOrganisation?.name || activeOrganisation?.code || 'Organisation'),
        organisationLevelCount: getOrganisationLevelCountBeforeUnits(organisationStructureLevels, 3),
        level0Name: String(levelDraftSource(0)?.name || activeOrganisation?.name || 'Organisation'),
        level0Options: toLines(levelDraftSource(0)?.options || [activeOrganisation?.name || activeOrganisation?.code || 'Organisation']),
        level1Name: String(levelDraftSource(1)?.name || 'Organisation Level 1'),
        level1Options: toLines(levelDraftSource(1)?.options || []),
        level1Parents: parentLinesForLevel(1, ''),
        level2Name: String(levelDraftSource(2)?.name || 'Organisation Level 2'),
        level2Options: toLines(levelDraftSource(2)?.options || []),
        level2Parents: parentLinesForLevel(2, ''),
        level3Name: String(levelDraftSource(3)?.name || 'Organisation Level 3'),
        level3Options: toLines(levelDraftSource(3)?.options || []),
        level3Parents: parentLinesForLevel(3, ''),
        additionalLevels: Array.from({ length: Math.max(0, getOrganisationLevelCountBeforeUnits(organisationStructureLevels, 3) - 3) }, (_, offset) => {
            const levelIndex = offset + 4;
            const source = levelDraftSource(levelIndex) || {};
            return {
                name: String(source?.name || `Level ${levelIndex}`),
                options: toLines(source?.options || []),
                parents: parentLinesForLevel(levelIndex, ''),
            };
        }),
    });
    const [organisationDraft, setOrganisationDraft] = useState(() => (
        shouldUseStoredOrganisationDraft ? storedOrganisationDraft : buildHydratedOrganisationDraft()
    ));
    useEffect(() => {
        if (!storedOrganisationDraft || shouldUseStoredOrganisationDraft) return;
        if (typeof window !== 'undefined') window.localStorage.removeItem(initialSetupWizardOrganisationDraftStorageKey);
        pushWizardOrgDiag('stored-draft:ignored-synced-settings-present', {
            storedDraft: summariseOrganisationDraft(storedOrganisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
        });
    }, []);
    const persistOrganisationDraft = (draft: typeof organisationDraft) => {
        if (typeof window === 'undefined') return;
        safeSetWizardLocalStorage(initialSetupWizardOrganisationDraftStorageKey, JSON.stringify(draft));
        pushWizardOrgDiag('stored-draft:write', { draft: summariseOrganisationDraft(draft) });
    };
    const updateOrganisationDraft = (updater: any, stage = 'field-edit') => {
        organisationDraftDirtyRef.current = true;
        setOrganisationDraft((current: typeof organisationDraft) => {
            const next = typeof updater === 'function' ? updater(current) : updater;
            persistOrganisationDraft(next);
            pushWizardOrgDiag(`draft:${stage}`, {
                before: summariseOrganisationDraft(current),
                after: summariseOrganisationDraft(next),
            });
            return next;
        });
    };
    const summariseOrganisationDraft = (draft: any) => ({
        code: draft?.code,
        name: draft?.name,
        level0Name: draft?.level0Name,
        level0Options: draft?.level0Options,
        level1Name: draft?.level1Name,
        level1Options: draft?.level1Options,
        level1Parents: draft?.level1Parents,
        level2Name: draft?.level2Name,
        level2Options: draft?.level2Options,
        level2Parents: draft?.level2Parents,
        level3Name: draft?.level3Name,
        level3Options: draft?.level3Options,
        level3Parents: draft?.level3Parents,
        organisationLevelCount: draft?.organisationLevelCount,
        additionalLevels: Array.isArray(draft?.additionalLevels) ? draft.additionalLevels : [],
    });
    const summariseActiveOrganisation = () => ({
        id: activeOrganisation?.id,
        code: activeOrganisation?.code,
        name: activeOrganisation?.name,
        levelCount: organisationStructureLevels.length,
        levels: organisationStructureLevels.map((level: any) => ({
            name: level?.name,
            optionCount: Array.isArray(level?.options) ? level.options.length : 0,
            optionsSample: Array.isArray(level?.options) ? level.options.slice(0, 8) : [],
        })),
        relationshipPathCount: Array.isArray(activeOrganisation?.settings?.organisationStructure?.relationshipPaths)
            ? activeOrganisation.settings.organisationStructure.relationshipPaths.length
            : 0,
    });
    const [locationDraft, setLocationDraft] = useState({
        code: String(currentLocation?.code || activeWizardLocationCode || currentUnit?.locationCode || 'LOC1'),
        iataCode: String(currentLocation?.iataCode || currentLocation?.settings?.iataCode || 'LOC'),
        name: String(currentLocation?.name || 'Home Location'),
        timezone: String(currentLocation?.timezone || 'UTC'),
        trainingAreas: Array.isArray(currentLocation?.trainingAreas) ? currentLocation.trainingAreas.join(', ') : '',
    });
    const locationDraftDirtyRef = useRef(false);
    const [unitsTodayDraft, setUnitsTodayDraft] = useState('');
    const [unitParentDraft, setUnitParentDraft] = useState('');
    const [locationsTodayDraft, setLocationsTodayDraft] = useState(() => (
        activeLocations.length > 0
            ? activeLocations.map((location: any) => `${location.code || ''} | ${location.iataCode || location.settings?.iataCode || ''} | ${location.name || location.code || ''}`).join('\n')
            : formatWizardLocationRows([activeWizardLocationRow]) || 'LOC1 | LOC | Home Location'
    ));
    const [locationDraftRowCount, setLocationDraftRowCount] = useState(() => Math.max(1, parseWizardLocationRows(
        activeLocations.length > 0
            ? activeLocations.map((location: any) => `${location.code || ''} | ${location.iataCode || location.settings?.iataCode || ''} | ${location.name || location.code || ''}`).join('\n')
            : formatWizardLocationRows([activeWizardLocationRow]) || 'LOC1 | LOC | Home Location',
    ).length));
    const [unitDraft, setUnitDraft] = useState({
        code: String(currentUnit?.code || unitCode || 'UNIT-01'),
        name: String(currentUnit?.name || currentUnit?.code || unitCode || 'Unit'),
        locationCode: String(currentUnit?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
        unitType: String(currentUnit?.unitType || ''),
        operationalModel: String(getUnitOperationalModel(currentUnit || {}) || 'pooled-crew'),
        hasTrainees: currentUnit?.settings?.hasTrainees !== false,
    });
    const unitDraftDirtyRef = useRef(false);
    const [resourceDraft, setResourceDraft] = useState({
        aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || ''),
        aircraftName: String(primaryAircraftType?.name || primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || ''),
        poolName: String(primaryResourcePool?.name || ''),
        poolUnitCode: String(primaryResourcePool?.unitCode || currentUnit?.code || ''),
        poolLocationCode: String(primaryResourcePool?.locationCode || currentUnit?.locationCode || currentLocation?.code || ''),
        aircraft: String(primaryResourcePool?.settings?.aircraft ?? primaryResourcePool?.aircraft ?? ''),
        sim: String(primaryResourcePool?.settings?.ftd ?? primaryResourcePool?.settings?.sim ?? primaryResourcePool?.ftd ?? primaryResourcePool?.sim ?? ''),
        trainer: String(primaryResourcePool?.settings?.cpt ?? primaryResourcePool?.settings?.trainer ?? primaryResourcePool?.cpt ?? primaryResourcePool?.trainer ?? ''),
        standby: String(primaryResourcePool?.settings?.standby ?? primaryResourcePool?.standby ?? ''),
        ground: String(primaryResourcePool?.settings?.ground ?? primaryResourcePool?.ground ?? ''),
    });
    const [crewDraft, setCrewDraft] = useState({
        aircraftCode: String(primaryAircraftType?.code || resourceDraft.aircraftCode || ''),
        standardSeats: formatRoleRequirementsText(getAircraftStandardSeats(primaryAircraftType)),
    });
    const resourceDraftDirtyRef = useRef(false);
    const crewDraftDirtyRef = useRef(false);
    const [accessDraft, setAccessDraft] = useState({
        userName: String(primaryUserAccess?.userName || primaryUserAccess?.user || 'New user'),
        locationCode: String(primaryUserAccess?.locationCode || primaryUserAccess?.location || currentLocation?.code || ''),
        unitCode: String(primaryUserAccess?.unitCode || primaryUserAccess?.unit || currentUnit?.code || ''),
        moduleCode: String(primaryUserAccess?.moduleCode || primaryUserAccess?.module || 'DFP'),
        accessLevel: String(primaryUserAccess?.accessLevel || primaryUserAccess?.access || 'View'),
    });
    const accessDraftDirtyRef = useRef(false);
    const [trainingDraft, setTrainingDraft] = useState({
        lmpCode: String(primaryMasterLmp?.code || 'New Master LMP'),
        lmpName: String(primaryMasterLmp?.name || primaryMasterLmp?.code || 'New Master LMP'),
        description: String(primaryMasterLmp?.description || ''),
        status: String(primaryMasterLmp?.status || 'ACTIVE'),
        accessLocationCode: String(primaryMasterLmpRule?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
        accessUnitCode: String(primaryMasterLmpRule?.unitCode || currentUnit?.code || ''),
        accessModel: String(primaryMasterLmpRule?.operationalModel || primaryMasterLmpRule?.model || 'Any Model'),
        accessLevel: String(primaryMasterLmpRule?.access || primaryMasterLmpRule?.accessLevel || 'View'),
    });
    const trainingDraftDirtyRef = useRef(false);
    const [crewLabelsDraft, setCrewLabelsDraft] = useState('Pilot = Pilot\nLoadmaster = Loadmaster');
    const [alternateCrewDraft, setAlternateCrewDraft] = useState('Reduced crew = Pilot 1, Loadmaster 1');
    const [buildRulesDraft, setBuildRulesDraft] = useState({
        businessRules: 'Use configured rule set',
        maxCrewDutyHours: '12',
        preferredDutyHours: '10',
        aircraftTurnaroundMinutes: '60',
        simTurnaroundMinutes: '30',
        trainerTurnaroundMinutes: '30',
        maxDispatchPerHour: '2',
        maxEventsPerDay: '',
        maxFlightsPerDay: '',
        minGapBetweenEventsMinutes: '0',
    });
    const buildRulesDraftDirtyRef = useRef(false);
    const updateBuildRulesDraft = (updater: typeof buildRulesDraft | ((current: typeof buildRulesDraft) => typeof buildRulesDraft)) => {
        buildRulesDraftDirtyRef.current = true;
        setBuildRulesDraft((current) => (
            typeof updater === 'function'
                ? (updater as (current: typeof buildRulesDraft) => typeof buildRulesDraft)(current)
                : updater
        ));
    };
    const buildRulesDraftText = formatWizardBuildRulesDraft(buildRulesDraft);
    const [staffDraft, setStaffDraft] = useState('Surname, First | UNIT-01 | Pilot | Qualification');
    const [traineeCourseOptionsDraft, setTraineeCourseOptionsDraft] = useState('Course 1');
    const [traineeCourseInputRows, setTraineeCourseInputRows] = useState<string[]>(() => ['Course 1']);
    const [traineeDraft, setTraineeDraft] = useState('');
    const [traineeAllocationCommitted, setTraineeAllocationCommitted] = useState(false);
    const [showMoreTraineesPrompt, setShowMoreTraineesPrompt] = useState(false);
    const defaultWizardUnitModulesDraft = 'DFP | On\nNEO Build | On\nProgram Schedule | On\nTraining Records | On';
    const makeWizardModuleCode = (moduleName: string, index = 0) => (
        (String(moduleName || '').trim() || `Module ${index + 1}`)
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
    );
    const buildHydratedUnitModulesDraft = () => {
        const savedDraft = String(
            activeOrganisation?.settings?.initialSetupWizardDraft?.unitModules
            || activeOrganisation?.settings?.initialSetupWizardDrafts?.unitModulesDraft
            || activeOrganisation?.settings?.initialSetupWizardDrafts?.unitModules
            || '',
        ).trim();
        if (savedDraft) return savedDraft;
        const moduleNames = Array.from(new Set([
            ...((platformConfig?.modules || []).map((module: any) => String(module?.name || module?.code || '').trim())),
            'DFP',
            'NEO Build',
            'Program Schedule',
            'Training Records',
            'Build Intelligence',
        ].filter(Boolean)));
        const targetUnitCode = normaliseUnitSettingsIdentifier(currentUnit?.code || unitCode || '');
        const rows = moduleNames.map((moduleName, index) => {
            const moduleCode = makeWizardModuleCode(moduleName, index);
            const savedModule = (platformConfig?.unitModules || []).find((item: any) => (
                targetUnitCode
                && normaliseUnitSettingsIdentifier(item?.unitCode) === targetUnitCode
                && normaliseUnitSettingsIdentifier(item?.moduleCode) === normaliseUnitSettingsIdentifier(moduleCode)
            ));
            return `${moduleName} | ${savedModule?.isEnabled === false ? 'Off' : 'On'}`;
        });
        return rows.length > 0 ? rows.join('\n') : defaultWizardUnitModulesDraft;
    };
    const [trainingRecordsDraft, setTrainingRecordsDraft] = useState('Training Report | Assessment Form | 0 | 5 | Yes | No | Satisfactory | Unsatisfactory');
    const [unitModulesDraft, setUnitModulesDraft] = useState(() => buildHydratedUnitModulesDraft());
    const unitModulesDraftDirtyRef = useRef(false);
    const [rankLabelsDraft, setRankLabelsDraft] = useState('1 | Senior Rank 1 | Highest rank shown first\n2 | Senior Rank 2 | Next senior rank\n3 | Team Lead Rank | Operational supervisor level\n4 | Line Rank | Standard operational rank');
    const [rankSettingsDraft, setRankSettingsDraft] = useState(() => ({
        preset: currentPersonnelDisplaySettings.staffRankEquivalency?.preset || 'AU',
        sortMode: currentPersonnelDisplaySettings.sortMode || 'rank-then-name',
        traineeRanks: 'staff',
        instructorLabel: currentPersonnelDisplaySettings.instructorLabel || 'Instructor',
    }));
    const rankSettingsDraftDirtyRef = useRef(false);
    const [crewRolesDraft, setCrewRolesDraft] = useState(() => formatWizardCrewRoleRows(
        currentWizardCrewPositionTerminology.positions.map((position) => ({
            role: position.genericName,
            label: position.label || position.genericName,
            models: (position.operationalModels || []).join(', '),
        }))
    ));
    const crewRolesDraftDirtyRef = useRef(false);
    const updateCrewRolesDraft = (updater: string | ((current: string) => string)) => {
        crewRolesDraftDirtyRef.current = true;
        setCrewRolesDraft((current) => typeof updater === 'function' ? updater(current) : updater);
    };
    const wizardCrewPositionTerminology = normaliseCrewPositionTerminology({
        positions: parseWizardCrewRoleRows(crewRolesDraft).map((row, index) => ({
            id: row.role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `crew-role-${index + 1}`,
            genericName: row.role || row.label || `Crew Role ${index + 1}`,
            label: row.label || row.role || `Crew Role ${index + 1}`,
            operationalModels: row.models.split(',').map((model) => model.trim()).filter(Boolean).map((model) => normaliseOperationalModel(model)),
        })),
        deletedDefaultIds: currentWizardCrewPositionTerminology.deletedDefaultIds,
    });
    const getWizardCrewRoleOptions = (value: string) => {
        const existingRoles = parseRoleRequirementsText(value).map((row) => String(row.role || '').trim()).filter(Boolean);
        return getCrewPositionOptions(wizardCrewPositionTerminology, existingRoles, unitDraft.operationalModel);
    };
    const [resourceSharingDraft, setResourceSharingDraft] = useState('Resource sharing | Off |  | Unit keeps its own aircraft and DFP resource row capacity.\nStaff sharing | Off |  | Unit only schedules its own staff unless changed later.');
    const [currencyDraft, setCurrencyDraft] = useState('PIC Currency | PIC | Standard crew | ANY | PIC Currency | 1\nInstrument Currency | INST | Standard crew | ANY | Instrument Currency | 1');
    const currencyDraftDirtyRef = useRef(false);
    const updateCurrencyDraft = (updater: string | ((current: string) => string)) => {
        currencyDraftDirtyRef.current = true;
        setCurrencyDraft((current) => (
            typeof updater === 'function'
                ? (updater as (current: string) => string)(current)
                : updater
        ));
    };
    const [scoringDraft, setScoringDraft] = useState(defaultWizardScoringDraft);
    const [wizardScoringPhraseBank, setWizardScoringPhraseBank] = useState<PhraseBank>(() => wizardScoringRowsToPhraseBank(defaultWizardScoringDraft));
    const [wizardScoringTab, setWizardScoringTab] = useState<'Airmanship' | 'Preparation' | 'Technique' | 'Elements'>('Airmanship');
    const [staffCurrencyEventsDraft, setStaffCurrencyEventsDraft] = useState('Annual Instrument Check | INST | Flight | 90 | 90 | 60 | Standard crew | Instrument Currency | ANY | 1');

    const formatWizardOrganisationPath = (path: string[]) => path.map((item) => String(item || '').trim()).filter(Boolean).join(' / ');
    const formatWizardImmediateParentLabel = (path: string[]) => {
        const cleanPath = path.map((item) => String(item || '').trim()).filter(Boolean);
        return cleanPath[cleanPath.length - 1] || 'Parent';
    };
    const parseWizardOrganisationPath = (value: string) => String(value || '').split('/').map((item) => item.trim()).filter(Boolean);
    const getWizardOrganisationRelationshipPathsForDraft = (draft: typeof organisationDraft) => {
        const levels = cleanOrganisationDraftLevels(
            getOrganisationDraftLevels(draft).map((level) => ({ ...level, options: Array.isArray(level?.options) ? level.options : [] })),
            draft.name || draft.code || 'Organisation',
        );
        const rootLabel = levels[0]?.options?.[0] || draft.name || draft.code || 'Organisation';
        const parentRowsByLevel = levels.map((level, levelIndex) => (
            levelIndex === 0
                ? []
                : buildWizardParentRowsForChildren(level.options, level.parents, levels[levelIndex - 1]?.options || [])
        ));
        return buildWizardRelationshipPathsFromLevelRows(rootLabel, parentRowsByLevel);
    };
    const getWizardOrganisationRelationshipPaths = () => getWizardOrganisationRelationshipPathsForDraft(organisationDraft);
    const getWizardUnitParentPathOptionsForDraft = (draft: typeof organisationDraft) => {
        const levels = getOrganisationDraftLevels(draft);
        const rootLabel = levels[0]?.options?.[0] || draft.name || draft.code || 'Organisation';
        const relationshipPaths = getWizardOrganisationRelationshipPathsForDraft(draft);
        const candidatePaths = relationshipPaths.length > 0 ? relationshipPaths : [[rootLabel]];
        const deepestLength = Math.max(...candidatePaths.map((path) => path.length));
        return candidatePaths
            .filter((path) => path.length === deepestLength)
            .map((path) => path.filter(Boolean));
    };
    const getWizardUnitParentPathOptions = () => getWizardUnitParentPathOptionsForDraft(organisationDraft);
    const getWizardUnitParentPathMap = () => new Map(
        parseWizardParentRows(unitParentDraft).map((row) => [
            normaliseUnitSettingsIdentifier(row.child),
            parseWizardOrganisationPath(row.parent),
        ]),
    );
    const updateWizardUnitParentPath = (unitCodeValue: string, parentPathValue: string) => {
        const cleanUnitCode = String(unitCodeValue || '').trim().toUpperCase();
        if (!cleanUnitCode) return;
        const rows = parseWizardParentRows(unitParentDraft)
            .filter((row) => normaliseUnitSettingsIdentifier(row.child) !== normaliseUnitSettingsIdentifier(cleanUnitCode));
        const cleanParentPath = formatWizardOrganisationPath(parseWizardOrganisationPath(parentPathValue));
        if (cleanParentPath) rows.push({ child: cleanUnitCode, parent: cleanParentPath });
        setUnitParentDraft(rows.map((row) => `${row.child} = ${row.parent}`).join('\n'));
    };
    const getHydratedOrganisationUnitLevel = () => {
        const levels = Array.isArray(activeOrganisation?.settings?.organisationStructure?.levels)
            ? activeOrganisation.settings.organisationStructure.levels
            : [];
        const selectedLevel = levels.find((level: any) => String(level?.name || '').trim().toLowerCase() === 'unit')
            || levels.find((level: any) => Number(level?.levelIndex ?? level?.level) === 4)
            || levels
                .map((level: any, index: number) => ({ level, index }))
                .filter(({ level, index }: any) => index > 3 && Array.isArray(level?.options) && level.options.length > 0)
                .sort((a: any, b: any) => a.index - b.index)[0]?.level
            || null;
        pushWizardOrgDiag('hydrate:unit-level-selection', {
            levelCount: levels.length,
            levels: levels.map((level: any, index: number) => ({
                index,
                name: level?.name,
                levelIndex: level?.levelIndex,
                level: level?.level,
                optionCount: Array.isArray(level?.options) ? level.options.length : 0,
                optionsSample: Array.isArray(level?.options) ? level.options.slice(0, 12) : [],
                parentByChildKeys: level?.parentByChild && typeof level.parentByChild === 'object' ? Object.keys(level.parentByChild).slice(0, 12) : [],
            })),
            selectedLevel: selectedLevel ? {
                name: selectedLevel?.name,
                levelIndex: selectedLevel?.levelIndex,
                level: selectedLevel?.level,
                optionCount: Array.isArray(selectedLevel?.options) ? selectedLevel.options.length : 0,
                options: Array.isArray(selectedLevel?.options) ? selectedLevel.options : [],
                parentByChild: selectedLevel?.parentByChild,
            } : null,
        });
        return selectedLevel;
    };
    const getSavedInitialSetupWizardDrafts = () => {
        const legacyDraft = activeOrganisation?.settings?.initialSetupWizardDraft;
        const drafts = activeOrganisation?.settings?.initialSetupWizardDrafts;
        return {
            ...(legacyDraft && typeof legacyDraft === 'object' ? legacyDraft : {}),
            ...(drafts && typeof drafts === 'object' ? drafts : {}),
        };
    };
    const buildHydratedUnitsTodayDraft = () => {
        const savedWizardUnits = String(getSavedInitialSetupWizardDrafts()?.unitsTodayDraft || '').trim();
        if (savedWizardUnits) {
            pushWizardOrgDiag('hydrate:units-source-saved-wizard-draft', {
                savedWizardUnits,
                parsedUnits: parseWizardUnitRows(savedWizardUnits),
            });
            return savedWizardUnits;
        }
        const unitLevel = getHydratedOrganisationUnitLevel();
        const savedUnitCodes = Array.isArray(unitLevel?.options)
            ? unitLevel.options.map((code: any) => String(code || '').trim()).filter(Boolean)
            : [];
        const relationshipPaths = Array.isArray(activeOrganisation?.settings?.organisationStructure?.relationshipPaths)
            ? activeOrganisation.settings.organisationStructure.relationshipPaths
            : [];
        const parentOptions = getWizardUnitParentPathOptionsForDraft(buildHydratedOrganisationDraft());
        const validParentValues = new Set(parentOptions.map(formatWizardOrganisationPath));
        const activeUnitByCode = new Map(activeUnits.map((unit: any) => [normaliseUnitSettingsIdentifier(unit?.code), unit]));
        const relationshipUnitCodes = relationshipPaths
            .map((rawPath: any) => Array.isArray(rawPath) ? rawPath.map((part) => String(part || '').trim()).filter(Boolean) : [])
            .filter((path) => path.length > 1 && validParentValues.has(formatWizardOrganisationPath(path.slice(0, -1))))
            .map((path) => path[path.length - 1])
            .filter(Boolean);
        const unitRecordCodes = activeUnits
            .filter((unit: any) => {
                const parentPath = Array.isArray(unit?.settings?.parentOrganisationPath)
                    ? unit.settings.parentOrganisationPath.map((part: any) => String(part || '').trim()).filter(Boolean)
                    : [];
                return parentPath.length > 0 && validParentValues.has(formatWizardOrganisationPath(parentPath));
            })
            .map((unit: any) => String(unit?.code || '').trim())
            .filter(Boolean);
        const sourceUnitCodes = savedUnitCodes.length > 0
            ? savedUnitCodes
            : relationshipUnitCodes.length > 0
                ? Array.from(new Set(relationshipUnitCodes))
                : Array.from(new Set(unitRecordCodes));
        pushWizardOrgDiag('hydrate:units-source-decision', {
            savedWizardUnitsPresent: Boolean(savedWizardUnits),
            selectedUnitLevelName: unitLevel?.name,
            selectedUnitLevelIndex: unitLevel?.levelIndex ?? unitLevel?.level,
            savedUnitCodes,
            parentOptions: parentOptions.map(formatWizardOrganisationPath),
            relationshipPathCount: relationshipPaths.length,
            relationshipPathsSample: relationshipPaths.slice(0, 24),
            relationshipUnitCodes,
            unitRecordCodes,
            activeUnitCodes: activeUnits.map((unit: any) => unit?.code),
            source: savedUnitCodes.length > 0 ? 'unit-level-options' : relationshipUnitCodes.length > 0 ? 'relationship-path-leaves' : unitRecordCodes.length > 0 ? 'unit-record-parent-paths' : 'empty',
            sourceUnitCodes,
        });
        if (sourceUnitCodes.length > 0) {
            return sourceUnitCodes.map((code: string) => {
                const unit = activeUnitByCode.get(normaliseUnitSettingsIdentifier(code));
                const name = String(unit?.name || '').trim();
                return `${code}${name && name !== code ? ` | ${name}` : ''}`;
            }).join('\n');
        }
        return '';
    };
    const buildHydratedLocationsTodayDraft = () => (
        String(getSavedInitialSetupWizardDrafts()?.locationsTodayDraft || '').trim()
            ? String(getSavedInitialSetupWizardDrafts()?.locationsTodayDraft || '').trim()
            : activeLocations.length > 0
            ? activeLocations.map((location: any) => `${location.code || ''} | ${location.iataCode || location.settings?.iataCode || ''} | ${location.name || location.code || ''}`).join('\n')
            : formatWizardLocationRows([activeWizardLocationRow]) || 'LOC1 | LOC | Home Location'
    );
    const getSavedWizardString = (...keys: string[]) => {
        const drafts = getSavedInitialSetupWizardDrafts();
        for (const key of keys) {
            const value = String(drafts?.[key] || '').trim();
            if (value) return value;
        }
        return '';
    };
    const parseHydratedBuildRulesDraft = (value: string) => {
        const readRule = (label: string, fallback: string) => {
            const match = String(value || '').match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'));
            return match ? match[1].replace(/\s*(hours|minutes)$/i, '').trim() : fallback;
        };
        return {
            businessRules: readRule('Business rules', 'Use configured rule set'),
            maxCrewDutyHours: readRule('Maximum crew duty', '12'),
            preferredDutyHours: readRule('Preferred duty period', '10'),
            aircraftTurnaroundMinutes: readRule('Aircraft turnaround', '60'),
            simTurnaroundMinutes: readRule('Simulator turnaround', '30'),
            trainerTurnaroundMinutes: readRule('Trainer turnaround', '30'),
            maxDispatchPerHour: readRule('Maximum dispatch per hour', '2'),
            maxEventsPerDay: readRule('Maximum events per day', '').replace(/^Not set$/i, ''),
            maxFlightsPerDay: readRule('Maximum flights per day', '').replace(/^Not set$/i, ''),
            minGapBetweenEventsMinutes: readRule('Minimum gap between events', '0'),
        };
    };
    const readPlainWizardObject = (value: any): Record<string, any> => (
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    );
    const pickFirstConfiguredWizardValue = (values: any[], fallback = '', treatZeroAsBlank = false) => {
        for (const value of values) {
            if (value === null || value === undefined) continue;
            const text = String(value).trim();
            if (!text) continue;
            if (/^not set$/i.test(text)) continue;
            if (treatZeroAsBlank && Number(text) === 0) continue;
            return text;
        }
        return fallback;
    };
    const getTargetWizardUnitCode = () => String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
    const getTargetWizardAircraftCode = () => String(resourceDraft.aircraftCode || primaryAircraftType?.code || crewDraft.aircraftCode || '').trim().toUpperCase();
    const findWizardAlternateCrewProfile = (settingsSource: any = activeOrganisation?.settings) => {
        const targetUnitKey = normaliseUnitSettingsIdentifier(getTargetWizardUnitCode());
        const targetAircraftKey = normaliseUnitSettingsIdentifier(getTargetWizardAircraftCode());
        const targetModel = normaliseOperationalModel(unitDraft.operationalModel || getUnitOperationalModel(currentUnit || {}));
        return normaliseCrewCompositionSettings(settingsSource?.crewCompositionSettings || null).alternateCompositions.find((profile) => {
            const profileUnitKey = normaliseUnitSettingsIdentifier(profile.unitCode || '');
            const profileAircraftKey = normaliseUnitSettingsIdentifier(profile.aircraftTypeCode || '');
            const unitMatches = !targetUnitKey || !profileUnitKey || profileUnitKey === targetUnitKey;
            const aircraftMatches = !targetAircraftKey || !profileAircraftKey || profileAircraftKey === targetAircraftKey;
            const modelMatches = !profile.operationalModels?.length || profile.operationalModels.includes(targetModel);
            return unitMatches
                && aircraftMatches
                && modelMatches
                && String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';
        }) || null;
    };
    const buildHydratedCrewDraft = () => {
        const targetAircraftKey = normaliseUnitSettingsIdentifier(getTargetWizardAircraftCode());
        const aircraftType = activeAircraftTypes.find((aircraft: any) => (
            targetAircraftKey
            && normaliseUnitSettingsIdentifier(aircraft?.code) === targetAircraftKey
        )) || primaryAircraftType || null;
        return {
            aircraftCode: String(aircraftType?.code || getTargetWizardAircraftCode() || resourceDraft.aircraftCode || ''),
            standardSeats: formatRoleRequirementsText(getAircraftStandardSeats(aircraftType)),
        };
    };
    const buildHydratedAlternateCrewDraft = () => {
        const profile = findWizardAlternateCrewProfile();
        if (profile?.roleRequirements?.length) return formatRoleRequirementsText(profile.roleRequirements);
        return getSavedWizardString('alternateCrews', 'alternateCrewDraft');
    };
    const buildHydratedBuildRulesDraft = () => {
        const targetUnitKey = normaliseUnitSettingsIdentifier(unitDraft.code || currentUnit?.code || unitCode);
        const ruleSets = Array.isArray(platformConfig?.schedulingRuleSets) ? platformConfig.schedulingRuleSets : [];
        const ruleSet = ruleSets.find((item: any) => (
            targetUnitKey
            && normaliseUnitSettingsIdentifier(item?.unitCode) === targetUnitKey
            && String(item?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
            && item?.isActive !== false
        ));
        if (!ruleSet) {
            const savedBuildRules = getSavedWizardString('buildRules', 'buildRulesDraft');
            return savedBuildRules ? parseHydratedBuildRulesDraft(savedBuildRules) : null;
        }
        const rules = readPlainWizardObject(ruleSet.rules);
        const eventLimits = readPlainWizardObject(rules.eventLimits || ruleSet.eventLimits);
        const wizardEventLimits = readPlainWizardObject(rules.wizardEventLimits || ruleSet.wizardEventLimits);
        const dailyEventLimits = readPlainWizardObject(rules.dailyEventLimits || ruleSet.dailyEventLimits);
        return {
            businessRules: String(ruleSet.businessRules || 'Use configured rule set'),
            maxCrewDutyHours: String(ruleSet.maxCrewDutyHours ?? '12'),
            preferredDutyHours: String(ruleSet.preferredDutyHours ?? '10'),
            aircraftTurnaroundMinutes: String(ruleSet.aircraftTurnaroundMinutes ?? '60'),
            simTurnaroundMinutes: String(ruleSet.simTurnaroundMinutes ?? '30'),
            trainerTurnaroundMinutes: String(ruleSet.trainerTurnaroundMinutes ?? '30'),
            maxDispatchPerHour: String(ruleSet.maxDispatchPerHour ?? '2'),
            maxEventsPerDay: pickFirstConfiguredWizardValue([
                ruleSet.maxEventsPerDay,
                rules.maxEventsPerDay,
                eventLimits.maxEventsPerDay,
                wizardEventLimits.maxEventsPerDay,
                dailyEventLimits.maxEventsPerDay,
            ], '', true),
            maxFlightsPerDay: pickFirstConfiguredWizardValue([
                ruleSet.maxFlightsPerDay,
                rules.maxFlightsPerDay,
                eventLimits.maxFlightsPerDay,
                wizardEventLimits.maxFlightsPerDay,
                dailyEventLimits.maxFlightsPerDay,
            ], '', true),
            minGapBetweenEventsMinutes: pickFirstConfiguredWizardValue([
                ruleSet.minGapBetweenEventsMinutes,
                rules.minGapBetweenEventsMinutes,
                eventLimits.minGapBetweenEventsMinutes,
                wizardEventLimits.minGapBetweenEventsMinutes,
                dailyEventLimits.minGapBetweenEventsMinutes,
            ], '0', true),
        };
    };
    const buildHydratedRankLabelsDraft = () => {
        const rankOrder = normalisePersonnelDisplaySettings(activeOrganisation?.settings?.personnelDisplaySettings || activeOrganisation?.settings?.personnelSettings || null).staffRankOrder || [];
        return rankOrder.length > 0
            ? rankOrder.map((rank: string, index: number) => `${index + 1} | ${rank} |`).join('\n')
            : getSavedWizardString('ranksAndLabels', 'rankLabelsDraft');
    };
    const buildHydratedRankSettingsDraft = () => {
        const hasLiveRankSettings = Boolean(activeOrganisation?.settings?.personnelDisplaySettings || activeOrganisation?.settings?.personnelSettings);
        const savedDraft = hasLiveRankSettings ? null : (
            getSavedInitialSetupWizardDrafts()?.rankSettingsDraft
            || getSavedInitialSetupWizardDrafts()?.rankSettings
        );
        if (savedDraft && typeof savedDraft === 'object') {
            return {
                preset: (savedDraft.preset && RANK_EQUIVALENCY_PRESETS[savedDraft.preset as RankEquivalencyPresetKey])
                    ? savedDraft.preset as RankEquivalencyPresetKey
                    : currentPersonnelDisplaySettings.staffRankEquivalency?.preset || 'AU',
                sortMode: savedDraft.sortMode === 'alphabetical' ? 'alphabetical' : 'rank-then-name',
                traineeRanks: 'staff',
                instructorLabel: String(savedDraft.instructorLabel || currentPersonnelDisplaySettings.instructorLabel || 'Instructor'),
            };
        }
        return {
            preset: currentPersonnelDisplaySettings.staffRankEquivalency?.preset || 'AU',
            sortMode: currentPersonnelDisplaySettings.sortMode || 'rank-then-name',
            traineeRanks: 'staff',
            instructorLabel: currentPersonnelDisplaySettings.instructorLabel || 'Instructor',
        };
    };
    const readSharingGroupUnits = (group: any): string[] => {
        const unitSources = [
            group?.selectedUnits,
            group?.selectedUnitCodes,
            group?.unitCodes,
            group?.units,
            group?.memberUnits,
            group?.participatingUnits,
        ];
        const source = unitSources.find((candidate) => Array.isArray(candidate)) || [];
        return Array.from(new Set(source
            .map((item: any) => (
                typeof item === 'string'
                    ? item
                    : item?.unitCode || item?.code || item?.name || ''
            ))
            .map((item: any) => String(item || '').trim().toUpperCase())
            .filter(Boolean)));
    };
    const isSharingGroupEnabled = (group: any): boolean => (
        group?.enabled === true
        || group?.isEnabled === true
        || (
            group?.enabled !== false
            && group?.isEnabled !== false
            && readSharingGroupUnits(group).length > 1
        )
    );
    const buildHydratedResourceSharingDraft = () => {
        const settings = activeOrganisation?.settings || {};
        const resourceGroups = Array.isArray(settings.resourceSharingGroups) ? settings.resourceSharingGroups : [];
        const staffGroups = Array.isArray(settings.staffSharingGroups) ? settings.staffSharingGroups : [];
        const legacyResourceUnits = Array.isArray(settings.selectedUnits) ? settings.selectedUnits : [];
        const legacyStaffUnits = Array.isArray(settings.staffSharingUnits) ? settings.staffSharingUnits : [];
        const resourceSharingOn = settings.fleetSharingEnabled === true
            || resourceGroups.some(isSharingGroupEnabled)
            || legacyResourceUnits.length > 1;
        const staffSharingOn = settings.staffSharingEnabled === true;
        const hasLiveSharingSettings = resourceSharingOn
            || staffSharingOn
            || resourceGroups.length > 0
            || staffGroups.length > 0
            || legacyResourceUnits.length > 0
            || legacyStaffUnits.length > 0;
        if (!hasLiveSharingSettings) return getSavedWizardString('resourceSharing', 'resourceSharingDraft');
        const resourceRows = resourceGroups.length > 0
            ? resourceGroups.map((group: any, index: number) => {
                const groupUnits = readSharingGroupUnits(group);
                const groupEnabled = group?.enabled === false ? false : resourceSharingOn;
                return {
                    type: 'Resource sharing',
                    enabled: groupEnabled ? 'On' : 'Off',
                    units: groupUnits.join(', '),
                    consequence: groupEnabled
                        ? 'Unit can use shared aircraft and DFP resource rows from the listed units.'
                        : 'Unit keeps its own aircraft and DFP resource row capacity.',
                    name: group?.name || `Resource sharing arrangement ${index + 1}`,
                    allocationMode: group?.allocationMode || settings.allocationMode || 'combined',
                };
            })
            : [{
                type: 'Resource sharing',
                enabled: resourceSharingOn ? 'On' : 'Off',
                units: legacyResourceUnits.map((item: any) => String(item || '').trim().toUpperCase()).filter(Boolean).join(', '),
                consequence: resourceSharingOn
                    ? 'Unit can use shared aircraft and DFP resource rows from the listed units.'
                    : 'Unit keeps its own aircraft and DFP resource row capacity.',
                name: settings.activeResourceSharingGroupId || 'Resource sharing arrangement',
                allocationMode: settings.allocationMode || 'combined',
            }];
        const staffRows = staffSharingOn && staffGroups.length > 0
            ? staffGroups.map((group: any, index: number) => ({
                type: 'Staff sharing',
                enabled: group?.enabled === false ? 'Off' : 'On',
                units: readSharingGroupUnits(group).join(', '),
                consequence: group?.enabled === false
                    ? 'Unit only schedules its own staff unless changed later.'
                    : 'Unit can schedule staff from the listed units.',
                name: group?.name || `Staff sharing arrangement ${index + 1}`,
                allocationMode: '',
            }))
            : [{
                type: 'Staff sharing',
                enabled: 'Off',
                units: '',
                consequence: 'Unit only schedules its own staff unless changed later.',
                name: staffGroups[0]?.name || 'Staff sharing arrangement',
                allocationMode: '',
            }];
        const rows = [...resourceRows, ...staffRows];
        return rows.length > 0 ? formatWizardSharingRows(rows) : '';
    };
    const buildHydratedCurrencyDraft = () => {
        const targetUnitKey = normaliseUnitSettingsIdentifier(unitDraft.code || currentUnit?.code || unitCode);
        const targetAircraftKey = normaliseUnitSettingsIdentifier(resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code || '');
        const currencyProfiles = Array.isArray(crewCompositionSettings.currencyProfiles) ? crewCompositionSettings.currencyProfiles : [];
        const matchingProfiles = currencyProfiles.filter((profile: any) => {
            const profileUnitKey = normaliseUnitSettingsIdentifier(profile?.unitCode || profile?.unit || '');
            const profileAircraftKey = normaliseUnitSettingsIdentifier(profile?.aircraftTypeCode || profile?.aircraftCode || profile?.aircraft || '');
            const unitMatches = !targetUnitKey || !profileUnitKey || profileUnitKey === targetUnitKey;
            const aircraftMatches = !targetAircraftKey || !profileAircraftKey || profileAircraftKey === targetAircraftKey;
            return unitMatches
                && aircraftMatches
                && String(profile?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
                && profile?.isActive !== false;
        });
        return matchingProfiles.length > 0
            ? formatWizardCurrencyRows(matchingProfiles.map((profile: any) => ({
                name: String(profile.name || profile.currency || profile.code || ''),
                code: String(profile.code || profile.name || ''),
                crew: String(profile.crew || 'Standard crew'),
                config: String(profile.config || 'ANY'),
                currency: String(profile.currency || profile.name || ''),
                aircraftCount: String(profile.aircraftCount ?? 1),
            })))
            : getSavedWizardString('currencies', 'currencyDraft');
    };
    const buildHydratedTrainingRecordsDraft = () => {
        const template = currentUnit?.settings?.trainingReportTemplate;
        if (!template) return getSavedWizardString('trainingRecords', 'trainingRecordsDraft');
        return formatWizardTrainingReportRows([{
            genericName: 'Training Report',
            organisationName: String(template.displayName || 'Assessment Form'),
            gradeMin: String(template.grades?.scaleMin ?? 0),
            gradeMax: String(template.grades?.scaleMax ?? 5),
            showNumbers: template.grades?.showNumbers === false ? 'No' : 'Yes',
            noGradeOption: template.grades?.includeNoGrade === true ? 'Yes' : 'No',
            passLabel: String(template.overallResults?.passLabel || 'Satisfactory'),
            failLabel: String(template.overallResults?.failLabel || 'Unsatisfactory'),
        }]);
    };
    const buildHydratedStaffCurrencyEventsDraft = () => {
        const profiles = Array.isArray(activeOrganisation?.settings?.standardMissionProfiles?.profiles)
            ? activeOrganisation.settings.standardMissionProfiles.profiles
            : Array.isArray(activeOrganisation?.settings?.standardMissionProfiles)
                ? activeOrganisation.settings.standardMissionProfiles
                : [];
        return profiles.length > 0
            ? formatWizardStandardCurrencyEventRows(profiles.map((profile: any) => ({
                name: String(profile.name || profile.shortTitle || ''),
                shortTitle: String(profile.shortTitle || profile.name || ''),
                resourceType: String(profile.resourceType || 'Flight'),
                duration: String(profile.duration ?? 90),
                preFlight: String(profile.preFlight ?? 90),
                postFlight: String(profile.postFlight ?? 60),
                crew: String(profile.crew || 'Standard crew'),
                currency: String(profile.currency || ''),
                config: String(profile.config || 'ANY'),
                aircraftCount: String(profile.aircraftCount ?? 1),
            })))
            : getSavedWizardString('staffCurrencyEvents', 'staffCurrencyEventsDraft');
    };
    const buildHydratedScoringPhraseBankDraft = () => {
        const unitPhraseBank = currentUnit?.settings?.trainingReportPhraseBank;
        if (isScoringPhraseBank(unitPhraseBank)) return unitPhraseBank;
        const organisationPhraseBank = activeOrganisation?.settings?.trainingReportPhraseBank;
        if (isScoringPhraseBank(organisationPhraseBank)) return organisationPhraseBank;
        const savedDraft = getSavedWizardString('scoringMatrix', 'scoringDraft');
        return wizardScoringRowsToPhraseBank(savedDraft || defaultWizardScoringDraft);
    };
    const hydrateSupplementaryWizardDrafts = () => {
        const savedTraineeCourses = getSavedWizardString('traineeCourses', 'traineeCourseOptionsDraft');
        const savedTrainees = getSavedWizardString('trainees', 'traineeDraft');
        const savedStaff = getSavedWizardString('staff', 'staffDraft');
        const nextCrewLabels = getSavedWizardString('crewLabels', 'crewLabelsDraft');
        const nextAlternateCrews = buildHydratedAlternateCrewDraft();
        const nextBuildRules = buildHydratedBuildRulesDraft();
        const nextTrainingRecords = buildHydratedTrainingRecordsDraft();
        const nextRanksAndLabels = buildHydratedRankLabelsDraft();
        const nextRankSettings = buildHydratedRankSettingsDraft();
        const nextResourceSharing = buildHydratedResourceSharingDraft();
        const nextCurrencies = buildHydratedCurrencyDraft();
        const nextScoringPhraseBank = buildHydratedScoringPhraseBankDraft();
        const nextStaffCurrencyEvents = buildHydratedStaffCurrencyEventsDraft();
        if (nextCrewLabels) setCrewLabelsDraft(nextCrewLabels);
        if (nextAlternateCrews && !crewDraftDirtyRef.current) setAlternateCrewDraft(nextAlternateCrews);
        if (nextBuildRules && !buildRulesDraftDirtyRef.current) setBuildRulesDraft(nextBuildRules);
        if (savedStaff) setStaffDraft(savedStaff);
        if (savedTraineeCourses) {
            setTraineeCourseOptionsDraft(savedTraineeCourses);
            setTraineeCourseInputRows(parseWizardLineItems(savedTraineeCourses).length > 0 ? parseWizardLineItems(savedTraineeCourses) : ['Course 1']);
        }
        if (savedTrainees) setTraineeDraft(savedTrainees);
        if (nextTrainingRecords) setTrainingRecordsDraft(nextTrainingRecords);
        if (nextRanksAndLabels) setRankLabelsDraft(nextRanksAndLabels);
        setRankSettingsDraft(nextRankSettings);
        if (nextResourceSharing) setResourceSharingDraft(nextResourceSharing);
        if (nextCurrencies && !currencyDraftDirtyRef.current) setCurrencyDraft(nextCurrencies);
        setWizardScoringPhraseBank(nextScoringPhraseBank);
        setScoringDraft(wizardPhraseBankToScoringDraft(nextScoringPhraseBank));
        if (nextStaffCurrencyEvents) setStaffCurrencyEventsDraft(nextStaffCurrencyEvents);
    };
    const buildHydratedUnitParentDraft = (unitsDraftValue: string, draft: typeof organisationDraft) => {
        const savedWizardUnitParents = String(getSavedInitialSetupWizardDrafts()?.unitParentDraft || '').trim();
        if (savedWizardUnitParents) {
            pushWizardOrgDiag('hydrate:unit-parents-source-saved-wizard-draft', {
                savedWizardUnitParents,
                parsedParents: parseWizardParentRows(savedWizardUnitParents),
            });
            return savedWizardUnitParents;
        }
        const unitRows = parseWizardUnitRows(unitsDraftValue).filter((row) => row.code);
        const parentOptions = getWizardUnitParentPathOptionsForDraft(draft);
        if (unitRows.length === 0 || parentOptions.length === 0) {
            pushWizardOrgDiag('hydrate:unit-parents-empty-input', {
                unitsDraftValue,
                unitRows,
                parentOptions: parentOptions.map(formatWizardOrganisationPath),
            });
            return '';
        }
        const relationshipPaths = Array.isArray(activeOrganisation?.settings?.organisationStructure?.relationshipPaths)
            ? activeOrganisation.settings.organisationStructure.relationshipPaths
            : [];
        const unitLevel = getHydratedOrganisationUnitLevel();
        const unitParentByChild = unitLevel?.parentByChild && typeof unitLevel.parentByChild === 'object' ? unitLevel.parentByChild : {};
        const savedParentByUnit = new Map<string, string[]>();
        Object.entries(unitParentByChild).forEach(([unitCode, parent]) => {
            const unitKey = normaliseUnitSettingsIdentifier(unitCode);
            const parentLabel = String(parent || '').trim();
            if (!unitKey || !parentLabel || savedParentByUnit.has(unitKey)) return;
            const matchingParentPath = parentOptions.find((path) => (
                normaliseUnitSettingsIdentifier(path[path.length - 1]) === normaliseUnitSettingsIdentifier(parentLabel)
            ));
            if (matchingParentPath) savedParentByUnit.set(unitKey, matchingParentPath);
        });
        relationshipPaths.forEach((rawPath: any) => {
            const path = Array.isArray(rawPath) ? rawPath.map((part) => String(part || '').trim()).filter(Boolean) : [];
            const unitCode = path[path.length - 1];
            const unitKey = normaliseUnitSettingsIdentifier(unitCode);
            if (path.length > 1 && unitKey && !savedParentByUnit.has(unitKey)) {
                savedParentByUnit.set(unitKey, path.slice(0, -1));
            }
        });
        activeUnits.forEach((unit: any) => {
            const cleanCode = normaliseUnitSettingsIdentifier(unit?.code);
            const parentPath = Array.isArray(unit?.settings?.parentOrganisationPath)
                ? unit.settings.parentOrganisationPath.map((part: any) => String(part || '').trim()).filter(Boolean)
                : [];
            if (cleanCode && parentPath.length > 0 && !savedParentByUnit.has(cleanCode)) savedParentByUnit.set(cleanCode, parentPath);
        });
        const validParentValues = new Set(parentOptions.map(formatWizardOrganisationPath));
        const fallbackValue = formatWizardOrganisationPath(parentOptions[0]);
        const parentRows = unitRows.map((row) => {
            const savedParentValue = formatWizardOrganisationPath(savedParentByUnit.get(normaliseUnitSettingsIdentifier(row.code)) || []);
            const parentValue = savedParentValue && validParentValues.has(savedParentValue) ? savedParentValue : fallbackValue;
            return `${row.code} = ${parentValue}`;
        });
        pushWizardOrgDiag('hydrate:unit-parents-source-decision', {
            unitsDraftValue,
            unitRows,
            parentOptions: parentOptions.map(formatWizardOrganisationPath),
            unitLevelName: unitLevel?.name,
            unitParentByChild,
            relationshipPathsSample: relationshipPaths.slice(0, 24),
            savedParentByUnit: Array.from(savedParentByUnit.entries()),
            fallbackValue,
            parentRows,
        });
        return parentRows.join('\n');
    };
    const hydrateWizardDraftsFromSettings = (stage = 'manual') => {
        const hydratedOrganisation = buildHydratedOrganisationDraft();
        const hydratedUnits = buildHydratedUnitsTodayDraft();
        const hydratedUnitParents = buildHydratedUnitParentDraft(hydratedUnits, hydratedOrganisation);
        const hydratedLocations = buildHydratedLocationsTodayDraft();
        const hydratedCrew = buildHydratedCrewDraft();
        organisationDraftDirtyRef.current = false;
        locationDraftDirtyRef.current = false;
        unitDraftDirtyRef.current = false;
        resourceDraftDirtyRef.current = false;
        crewDraftDirtyRef.current = false;
        accessDraftDirtyRef.current = false;
        trainingDraftDirtyRef.current = false;
        rankSettingsDraftDirtyRef.current = false;
        unitModulesDraftDirtyRef.current = false;
        if (typeof window !== 'undefined') window.localStorage.removeItem(initialSetupWizardOrganisationDraftStorageKey);
        pushWizardOrgDiag(`hydrate:${stage}-from-synced-settings`, {
            activeOrganisation: summariseActiveOrganisation(),
            hydratedOrganisation: summariseOrganisationDraft(hydratedOrganisation),
            unitsToday: hydratedUnits,
            unitParents: hydratedUnitParents,
            locationsToday: hydratedLocations,
        });
        setOrganisationDraft(hydratedOrganisation);
        setUnitsTodayDraft(hydratedUnits);
        setUnitParentDraft(hydratedUnitParents);
        setLocationsTodayDraft(hydratedLocations);
        setUnitModulesDraft(buildHydratedUnitModulesDraft());
        setCrewDraft(hydratedCrew);
        hydrateSupplementaryWizardDrafts();
    };

    useEffect(() => {
        if (organisationDraftDirtyRef.current) {
            pushWizardOrgDiag('hydrate:skipped-dirty-draft', {
                activeOrganisation: summariseActiveOrganisation(),
                draft: summariseOrganisationDraft(organisationDraft),
            });
            return;
        }
        hydrateWizardDraftsFromSettings('active-organisation');
    }, [activeOrganisation?.code, activeOrganisation?.name, JSON.stringify(organisationStructureLevels)]);

    useEffect(() => {
        if (unitModulesDraftDirtyRef.current) return;
        setUnitModulesDraft(buildHydratedUnitModulesDraft());
    }, [
        activeOrganisation?.settings?.initialSetupWizardDraft?.unitModules,
        activeOrganisation?.settings?.initialSetupWizardDrafts?.unitModulesDraft,
        activeOrganisation?.settings?.initialSetupWizardDrafts?.unitModules,
        currentUnit?.code,
        unitCode,
        JSON.stringify(platformConfig?.modules || []),
        JSON.stringify(platformConfig?.unitModules || []),
    ]);

    useEffect(() => {
        const unitRows = parseWizardUnitRows(unitsTodayDraft).filter((row) => row.code);
        const parentOptions = getWizardUnitParentPathOptions();
        if (unitRows.length === 0 || parentOptions.length === 0) return;
        const existingByUnit = getWizardUnitParentPathMap();
        const validParentValues = new Set(parentOptions.map(formatWizardOrganisationPath));
        const rows = unitRows.map((row) => {
            const existingValue = formatWizardOrganisationPath(existingByUnit.get(normaliseUnitSettingsIdentifier(row.code)) || []);
            const parentValue = existingValue && validParentValues.has(existingValue)
                ? existingValue
                : formatWizardOrganisationPath(parentOptions[0]);
            return `${row.code} = ${parentValue}`;
        });
        const nextDraft = rows.join('\n');
        if (nextDraft !== unitParentDraft) setUnitParentDraft(nextDraft);
    }, [
        unitsTodayDraft,
        organisationDraft.level0Options,
        organisationDraft.level1Options,
        organisationDraft.level1Parents,
        organisationDraft.level2Options,
        organisationDraft.level2Parents,
        organisationDraft.level3Options,
        organisationDraft.level3Parents,
        organisationDraft.organisationLevelCount,
        JSON.stringify(organisationDraft.additionalLevels || []),
        unitParentDraft,
    ]);

    useEffect(() => {
        if (locationDraftDirtyRef.current) return;
        setLocationDraft({
            code: String(currentLocation?.code || activeWizardLocationCode || currentUnit?.locationCode || 'LOC1'),
            iataCode: String(currentLocation?.iataCode || currentLocation?.settings?.iataCode || 'LOC'),
            name: String(currentLocation?.name || 'Home Location'),
            timezone: String(currentLocation?.timezone || 'UTC'),
            trainingAreas: Array.isArray(currentLocation?.trainingAreas) ? currentLocation.trainingAreas.join(', ') : '',
        });
    }, [activeWizardLocationCode, currentLocation?.code, currentLocation?.name, currentLocation?.timezone, JSON.stringify(currentLocation?.trainingAreas || [])]);

    useEffect(() => {
        const firstLocation = parseWizardLocationRows(locationsTodayDraft)[0];
        setLocationDraftRowCount((count) => Math.max(count, parseWizardLocationRows(locationsTodayDraft).length, 1));
        if (!firstLocation) return;
        if (locationDraftDirtyRef.current) return;
        const matchedProfile = findWizardLocationProfile(firstLocation.icao || firstLocation.iata || firstLocation.name);
        setLocationDraft((draft) => ({
            ...draft,
            code: firstLocation.icao || matchedProfile?.icao || draft.code,
            iataCode: firstLocation.iata || matchedProfile?.iata || draft.iataCode,
            name: firstLocation.name || matchedProfile?.name || draft.name,
            timezone: matchedProfile?.timezone || draft.timezone,
        }));
    }, [locationsTodayDraft]);

    useEffect(() => {
        if (unitDraftDirtyRef.current) return;
        setUnitDraft({
            code: String(currentUnit?.code || unitCode || 'UNIT-01'),
            name: String(currentUnit?.name || currentUnit?.code || unitCode || 'Unit'),
            locationCode: String(currentUnit?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
            unitType: String(currentUnit?.unitType || ''),
            operationalModel: String(getUnitOperationalModel(currentUnit || {}) || 'pooled-crew'),
            hasTrainees: currentUnit?.settings?.hasTrainees !== false,
        });
    }, [activeWizardLocationCode, currentUnit?.code, currentUnit?.name, currentUnit?.locationCode, currentUnit?.unitType, currentUnit?.settings?.operationalModel, currentUnit?.settings?.hasTrainees, unitCode, currentLocation?.code, unitTypeOptions]);

    useEffect(() => {
        locationDraftDirtyRef.current = false;
        unitDraftDirtyRef.current = false;
        resourceDraftDirtyRef.current = false;
        crewDraftDirtyRef.current = false;
        accessDraftDirtyRef.current = false;
        trainingDraftDirtyRef.current = false;
        unitModulesDraftDirtyRef.current = false;
        crewRolesDraftDirtyRef.current = false;
        buildRulesDraftDirtyRef.current = false;
        currencyDraftDirtyRef.current = false;
    }, [currentUnit?.code, unitCode]);

    useEffect(() => {
        if (resourceDraftDirtyRef.current) return;
        setResourceDraft((draft) => ({
            ...draft,
            poolUnitCode: unitDraft.code || draft.poolUnitCode,
            poolLocationCode: unitDraft.locationCode || draft.poolLocationCode,
        }));
    }, [unitDraft.code, unitDraft.locationCode]);

    useEffect(() => {
        if (resourceDraftDirtyRef.current || crewDraftDirtyRef.current) return;
        setResourceDraft({
            aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || ''),
            aircraftName: String(primaryAircraftType?.name || primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || ''),
            poolName: String(primaryResourcePool?.name || ''),
            poolUnitCode: String(primaryResourcePool?.unitCode || currentUnit?.code || ''),
            poolLocationCode: String(primaryResourcePool?.locationCode || currentUnit?.locationCode || currentLocation?.code || ''),
            aircraft: String(primaryResourcePool?.settings?.aircraft ?? primaryResourcePool?.aircraft ?? ''),
            sim: String(primaryResourcePool?.settings?.ftd ?? primaryResourcePool?.settings?.sim ?? primaryResourcePool?.ftd ?? primaryResourcePool?.sim ?? ''),
            trainer: String(primaryResourcePool?.settings?.cpt ?? primaryResourcePool?.settings?.trainer ?? primaryResourcePool?.cpt ?? primaryResourcePool?.trainer ?? ''),
            standby: String(primaryResourcePool?.settings?.standby ?? primaryResourcePool?.standby ?? ''),
            ground: String(primaryResourcePool?.settings?.ground ?? primaryResourcePool?.ground ?? ''),
        });
        setCrewDraft({
            aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || ''),
            standardSeats: formatRoleRequirementsText(getAircraftStandardSeats(primaryAircraftType)),
        });
    }, [primaryAircraftType?.code, primaryAircraftType?.name, JSON.stringify(primaryAircraftType?.crewComposition || {}), primaryResourcePool?.name, primaryResourcePool?.unitCode, primaryResourcePool?.locationCode, primaryResourcePool?.aircraftTypeCode, JSON.stringify(primaryResourcePool?.settings || {}), currentUnit?.code, currentUnit?.locationCode, currentLocation?.code, currentLocation?.name]);

    useEffect(() => {
        setCrewDraft((draft) => ({
            ...draft,
            aircraftCode: resourceDraft.aircraftCode || draft.aircraftCode,
        }));
    }, [resourceDraft.aircraftCode]);

    useEffect(() => {
        if (accessDraftDirtyRef.current) return;
        setAccessDraft({
            userName: String(primaryUserAccess?.userName || primaryUserAccess?.user || 'New user'),
            locationCode: String(primaryUserAccess?.locationCode || primaryUserAccess?.location || currentLocation?.code || ''),
            unitCode: String(primaryUserAccess?.unitCode || primaryUserAccess?.unit || currentUnit?.code || ''),
            moduleCode: String(primaryUserAccess?.moduleCode || primaryUserAccess?.module || 'DFP'),
            accessLevel: String(primaryUserAccess?.accessLevel || primaryUserAccess?.access || 'View'),
        });
    }, [primaryUserAccess?.userName, primaryUserAccess?.user, primaryUserAccess?.locationCode, primaryUserAccess?.unitCode, primaryUserAccess?.moduleCode, primaryUserAccess?.accessLevel, primaryUserAccess?.access, currentLocation?.code, currentUnit?.code]);

    useEffect(() => {
        if (trainingDraftDirtyRef.current) return;
        setTrainingDraft({
            lmpCode: String(primaryMasterLmp?.code || 'New Master LMP'),
            lmpName: String(primaryMasterLmp?.name || primaryMasterLmp?.code || 'New Master LMP'),
            description: String(primaryMasterLmp?.description || ''),
            status: String(primaryMasterLmp?.status || 'ACTIVE'),
            accessLocationCode: String(primaryMasterLmpRule?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
            accessUnitCode: String(primaryMasterLmpRule?.unitCode || currentUnit?.code || ''),
            accessModel: String(primaryMasterLmpRule?.operationalModel || primaryMasterLmpRule?.model || 'Any Model'),
            accessLevel: String(primaryMasterLmpRule?.access || primaryMasterLmpRule?.accessLevel || 'View'),
        });
    }, [activeWizardLocationCode, primaryMasterLmp?.code, primaryMasterLmp?.name, primaryMasterLmp?.description, primaryMasterLmp?.status, primaryMasterLmpRule?.locationCode, primaryMasterLmpRule?.unitCode, primaryMasterLmpRule?.operationalModel, primaryMasterLmpRule?.model, primaryMasterLmpRule?.access, primaryMasterLmpRule?.accessLevel, currentLocation?.code, currentUnit?.code]);

    useEffect(() => {
        if (crewRolesDraftDirtyRef.current) return;
        setCrewRolesDraft(formatWizardCrewRoleRows(
            currentWizardCrewPositionTerminology.positions.map((position) => ({
                role: position.genericName,
                label: position.label || position.genericName,
                models: (position.operationalModels || []).join(', '),
            }))
        ));
    }, [JSON.stringify(activeOrganisation?.settings?.crewPositionTerminology || {})]);

    const saveWizardConfig = (message: string, updater: (baseConfig: any) => any) => {
        if (!onUpdatePlatformConfig) {
            setSaveMessage('This screen is not connected to the platform configuration in this session.');
            return;
        }
        onUpdatePlatformConfig((current) => updater(current || platformConfig || {}));
        setSaveMessage(message);
    };

    const updatePrimaryOrganisationWithSettings = (baseConfig: any, settingsUpdater: (settings: any, organisation: any) => any) => {
        const organisations = Array.isArray(baseConfig.organisations) ? baseConfig.organisations : [];
        const fallbackOrganisation = {
            id: createWizardRecordId('organisation'),
            code: organisationDraft.code || 'ORG',
            name: organisationDraft.name || organisationDraft.code || 'Organisation',
            status: 'ACTIVE',
            settings: {},
        };
        const targetKey = String(activeOrganisation?.id || activeOrganisation?.code || organisations[0]?.id || organisations[0]?.code || '').trim();
        const nextOrganisations = organisations.length > 0
            ? organisations.map((organisation: any, index: number) => {
                const isTarget = targetKey
                    ? String(organisation?.id || organisation?.code || '').trim() === targetKey
                    : index === 0;
                if (!isTarget) return organisation;
                return {
                    ...organisation,
                    code: organisationDraft.code || organisation.code,
                    name: organisationDraft.name || organisation.name,
                    status: organisation.status || 'ACTIVE',
                    settings: settingsUpdater(organisation.settings || {}, organisation),
                };
            })
            : [{
                ...fallbackOrganisation,
                settings: settingsUpdater({}, fallbackOrganisation),
            }];
        return {
            ...baseConfig,
            organisations: nextOrganisations,
        };
    };

    const isOrganisationWizardStep = (stepId?: string) => (
        String(stepId || '') === 'org-name'
        || String(stepId || '') === 'units-today'
        || /^org-level\d+$/.test(String(stepId || ''))
    );
    const saveOrganisationDraft = (options: { preserveWizardDraft?: boolean; message?: string } = {}) => {
        const organisationLevels = cleanOrganisationDraftLevels(
            getOrganisationDraftLevels(organisationDraft).map((level) => ({ ...level, options: Array.isArray(level?.options) ? level.options : [] })),
            organisationDraft.name || organisationDraft.code || 'Organisation',
        );
        const rootLabel = organisationLevels[0]?.options?.[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const parentRowsByLevel = organisationLevels.map((level, levelIndex) => (
            levelIndex === 0
                ? []
                : buildWizardParentRowsForChildren(level.options, level.parents, organisationLevels[levelIndex - 1]?.options || [])
        ));
        const organisationRelationshipPaths = buildWizardRelationshipPathsFromLevelRows(rootLabel, parentRowsByLevel);
        const unitRows = parseWizardUnitRows(unitsTodayDraft).filter((row) => row.code);
        const unitParentPathMap = getWizardUnitParentPathMap();
        const unitParentOptions = getWizardUnitParentPathOptions();
        const validUnitParentValues = new Set(unitParentOptions.map(formatWizardOrganisationPath));
        const fallbackUnitParentPath = (unitParentOptions[0] || organisationRelationshipPaths[0] || [rootLabel]).filter(Boolean);
        const getCleanUnitParentPath = (code: string) => {
            const configuredPath = unitParentPathMap.get(normaliseUnitSettingsIdentifier(code)) || [];
            return validUnitParentValues.has(formatWizardOrganisationPath(configuredPath)) ? configuredPath : fallbackUnitParentPath;
        };
        const unitCodes = unitRows.map((row) => row.code).filter(Boolean);
        const unitParentByChild = unitCodes.reduce((map, code) => {
            const parentPath = getCleanUnitParentPath(code);
            return {
                ...map,
                [code]: parentPath[parentPath.length - 1] || rootLabel,
            };
        }, {} as Record<string, string>);
        const unitChildrenByParent = unitCodes.reduce((map, code) => {
            const parent = unitParentByChild[code] || rootLabel;
            return {
                ...map,
                [parent]: Array.from(new Set([...(map[parent] || []), code])),
            };
        }, {} as Record<string, string[]>);
        const parentMapsByLevel = [
            ...parentRowsByLevel.map((rows) => buildWizardParentMaps(rows)),
            {
                childrenByParent: unitChildrenByParent,
                parentByChild: unitParentByChild,
            },
        ];
        const relationshipPaths = [
            ...organisationRelationshipPaths,
            ...unitCodes.map((code) => [
                ...getCleanUnitParentPath(code),
                code,
            ]),
        ];
        const levelDrafts = [
            ...organisationLevels.map((level) => ({ name: level.name, options: level.options })),
            { name: 'Unit', options: unitCodes },
        ];
        pushWizardOrgDiag('save-organisation:before', {
            draft: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
            relationshipPaths,
            levels: levelDrafts,
            preserveWizardDraft: Boolean(options.preserveWizardDraft),
        });
        if (!options.preserveWizardDraft) {
            organisationDraftDirtyRef.current = false;
            if (typeof window !== 'undefined') window.localStorage.removeItem(initialSetupWizardOrganisationDraftStorageKey);
        }
        saveWizardConfig(options.message || 'Organisation details saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            initialSetupWizardDrafts: {
                ...(settings.initialSetupWizardDrafts || {}),
                organisationDraft,
                unitsTodayDraft,
                unitParentDraft,
                locationsTodayDraft,
                updatedAt: new Date().toISOString(),
            },
            organisationStructure: {
                ...(settings.organisationStructure || {}),
                levelCount: levelDrafts.length,
                levels: levelDrafts.map((draft, levelIndex) => ({
                    ...(levelDraftSource(levelIndex) || {}),
                    levelIndex,
                    name: draft.name,
                    options: draft.options,
                    childrenByParent: parentMapsByLevel[levelIndex]?.childrenByParent || {},
                    parentByChild: parentMapsByLevel[levelIndex]?.parentByChild || {},
                })).filter((level) => String(level.name || '').trim() || (Array.isArray(level.options) && level.options.length > 0)),
                relationshipPaths,
            },
        })));
    };

    const saveLocationDraft = () => {
        const cleanCode = String(locationDraft.code || '').trim().toUpperCase();
        if (!cleanCode) {
            setSaveMessage('Enter a location code before saving.');
            return;
        }
        saveWizardConfig('Location saved into Settings.', (baseConfig) => {
            const locations = Array.isArray(baseConfig.locations) ? baseConfig.locations : [];
            const nextLocation = {
                id: currentLocation?.id || createWizardRecordId('location'),
                code: cleanCode,
                iataCode: String(locationDraft.iataCode || '').trim().toUpperCase(),
                name: locationDraft.name || cleanCode,
                timezone: locationDraft.timezone || 'UTC',
                trainingAreas: locationDraft.trainingAreas.split(',').map((item) => item.trim()).filter(Boolean),
                status: 'ACTIVE',
                settings: {
                    ...(currentLocation?.settings || {}),
                    iataCode: String(locationDraft.iataCode || '').trim().toUpperCase(),
                },
            };
            const exists = locations.some((location: any) => normaliseUnitSettingsIdentifier(location?.code) === normaliseUnitSettingsIdentifier(cleanCode));
            return {
                ...baseConfig,
                locations: exists
                    ? locations.map((location: any) => normaliseUnitSettingsIdentifier(location?.code) === normaliseUnitSettingsIdentifier(cleanCode) ? { ...location, ...nextLocation } : location)
                    : [...locations, nextLocation],
            };
        });
    };

    const saveUnitDraft = () => {
        const cleanCode = String(unitDraft.code || '').trim().toUpperCase();
        if (!cleanCode) {
            setSaveMessage('Enter a unit code before saving.');
            return;
        }
        saveWizardConfig('Unit saved into Settings.', (baseConfig) => {
            const units = Array.isArray(baseConfig.units) ? baseConfig.units : [];
            const nextUnit = {
                id: currentUnit?.id || createWizardRecordId('unit'),
                code: cleanCode,
                name: unitDraft.name || cleanCode,
                locationCode: unitDraft.locationCode,
                unitType: unitDraft.unitType || '',
                status: 'ACTIVE',
                settings: {
                    ...(currentUnit?.settings || {}),
                    operationalModel: unitDraft.operationalModel,
                    hasTrainees: unitDraft.hasTrainees,
                },
            };
            const exists = units.some((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(cleanCode));
            return {
                ...baseConfig,
                units: exists
                    ? units.map((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(cleanCode) ? { ...unit, ...nextUnit, settings: { ...(unit.settings || {}), ...nextUnit.settings } } : unit)
                    : [...units, nextUnit],
            };
        });
    };

    const saveWizardLocationRowsDraft = (message = 'Location list synced into Settings.') => {
        const locationRows = parseWizardLocationRows(locationsTodayDraft);
        if (locationRows.length === 0) {
            setSaveMessage('Add at least one locality before continuing.');
            return;
        }
        saveWizardConfig(message, (baseConfig) => {
            const locations = Array.isArray(baseConfig.locations) ? baseConfig.locations : [];
            const nextLocations = [...locations];
            locationRows.forEach((row) => {
                const code = String(row.icao || row.iata || '').trim().toUpperCase();
                if (!code) return;
                const existingIndex = nextLocations.findIndex((location: any) => normaliseUnitSettingsIdentifier(location?.code) === normaliseUnitSettingsIdentifier(code));
                const existingLocation = existingIndex >= 0 ? nextLocations[existingIndex] : null;
                const nextLocation = {
                    ...(existingLocation || { id: createWizardRecordId('location') }),
                    code,
                    iataCode: String(row.iata || existingLocation?.iataCode || existingLocation?.settings?.iataCode || '').trim().toUpperCase(),
                    name: row.name || existingLocation?.name || code,
                    timezone: existingLocation?.timezone || 'UTC',
                    status: existingLocation?.status || 'ACTIVE',
                    settings: {
                        ...(existingLocation?.settings || {}),
                        iataCode: String(row.iata || existingLocation?.iataCode || existingLocation?.settings?.iataCode || '').trim().toUpperCase(),
                    },
                };
                if (existingIndex >= 0) nextLocations[existingIndex] = nextLocation;
                else nextLocations.push(nextLocation);
            });
            return {
                ...baseConfig,
                locations: nextLocations,
            };
        });
    };

    const saveWizardUnitRowsDraft = (message = 'Unit list synced into Settings.') => {
        const unitRows = parseWizardUnitRows(unitsTodayDraft);
        if (unitRows.length === 0) {
            setSaveMessage('Add at least one unit before continuing.');
            return;
        }
        const defaultLocationCode = parseWizardLocationRows(locationsTodayDraft)[0]?.icao || locationDraft.code;
        saveWizardConfig(message, (baseConfig) => {
            const units = Array.isArray(baseConfig.units) ? baseConfig.units : [];
            const nextUnits = [...units];
            unitRows.forEach((row) => {
                const code = String(row.code || '').trim().toUpperCase();
                if (!code) return;
                const existingIndex = nextUnits.findIndex((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(code));
                const existingUnit = existingIndex >= 0 ? nextUnits[existingIndex] : null;
                const nextUnit = {
                    ...(existingUnit || { id: createWizardRecordId('unit') }),
                    code,
                    name: row.name || existingUnit?.name || code,
                    locationCode: existingUnit?.locationCode || defaultLocationCode || unitDraft.locationCode,
                    unitType: existingUnit?.unitType || unitDraft.unitType,
                    status: existingUnit?.status || 'ACTIVE',
                    settings: {
                        ...(existingUnit?.settings || {}),
                        operationalModel: existingUnit?.settings?.operationalModel || unitDraft.operationalModel,
                        hasTrainees: existingUnit?.settings?.hasTrainees ?? unitDraft.hasTrainees,
                    },
                };
                if (existingIndex >= 0) nextUnits[existingIndex] = nextUnit;
                else nextUnits.push(nextUnit);
            });
            return {
                ...baseConfig,
                units: nextUnits,
            };
        });
    };

    const saveResourceDraft = () => {
        const aircraftCode = String(resourceDraft.aircraftCode || '').trim().toUpperCase();
        if (!aircraftCode) {
            setSaveMessage('Enter an aircraft type code before saving.');
            return;
        }
        const poolName = String(resourceDraft.poolName || '').trim();
        if (!poolName) {
            setSaveMessage('Enter a DFP Resource Rows name before saving.');
            return;
        }
        const effectivePoolUnitCode = String(unitDraft.code || resourceDraft.poolUnitCode || currentUnit?.code || '').trim().toUpperCase();
        const effectivePoolLocationCode = String(unitDraft.locationCode || resourceDraft.poolLocationCode || activeWizardLocationCode || currentLocation?.code || '').trim().toUpperCase();
        saveWizardConfig('Aircraft type and DFP resource rows saved into Settings.', (baseConfig) => {
            const aircraftTypes = Array.isArray(baseConfig.aircraftTypes) ? baseConfig.aircraftTypes : [];
            const resourcePools = Array.isArray(baseConfig.resourcePools) ? baseConfig.resourcePools : [];
            const aircraftExists = aircraftTypes.some((aircraft: any) => normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode));
            const targetUnitCode = normaliseUnitSettingsIdentifier(effectivePoolUnitCode);
            const existingUnitPool = resourcePools.find((pool: any) => (
                String(pool?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
                && targetUnitCode
                && normaliseUnitSettingsIdentifier(pool?.unitCode) === targetUnitCode
            ));
            const targetPool = existingUnitPool || primaryResourcePool || null;
            const poolKey = targetPool?.id || targetPool?.code || '';
            const generatedPoolCode = makeWizardResourcePoolCode(effectivePoolLocationCode, effectivePoolUnitCode, aircraftCode);
            const nextPool = {
                id: targetPool?.id || createWizardRecordId('pool'),
                code: targetPool?.code || generatedPoolCode,
                name: poolName,
                organisationCode: activeOrganisation?.code || organisationDraft.code || 'DEFAULT',
                locationCode: effectivePoolLocationCode,
                unitCode: effectivePoolUnitCode,
                aircraftTypeCode: aircraftCode,
                poolType: targetPool?.poolType || 'Dedicated',
                status: 'ACTIVE',
                settings: {
                    ...(targetPool?.settings || {}),
                    aircraft: parseNumberDraft(resourceDraft.aircraft),
                    ftd: parseNumberDraft(resourceDraft.sim),
                    cpt: parseNumberDraft(resourceDraft.trainer),
                    standby: parseNumberDraft(resourceDraft.standby),
                    ground: parseNumberDraft(resourceDraft.ground),
                },
            };
            const poolExists = resourcePools.some((pool: any) => (
                (poolKey && String(pool?.id || pool?.code || '') === String(poolKey))
                || (targetUnitCode && normaliseUnitSettingsIdentifier(pool?.unitCode) === targetUnitCode && String(pool?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
                || String(pool?.name || '').trim().toUpperCase() === String(nextPool.name || '').trim().toUpperCase()
            ));
            return {
                ...baseConfig,
                aircraftTypes: aircraftExists
                    ? aircraftTypes.map((aircraft: any) => normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode) ? { ...aircraft, name: resourceDraft.aircraftName || aircraftCode, status: aircraft.status || 'ACTIVE' } : aircraft)
                    : [...aircraftTypes, { id: createWizardRecordId('aircraft-type'), code: aircraftCode, name: resourceDraft.aircraftName || aircraftCode, category: 'Other', status: 'ACTIVE', crewComposition: normaliseAircraftCrewComposition(null) }],
                resourcePools: poolExists
                    ? resourcePools.map((pool: any) => (
                        (poolKey && String(pool?.id || pool?.code || '') === String(poolKey))
                        || (targetUnitCode && normaliseUnitSettingsIdentifier(pool?.unitCode) === targetUnitCode && String(pool?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
                        || String(pool?.name || '').trim().toUpperCase() === String(nextPool.name || '').trim().toUpperCase()
                            ? { ...pool, ...nextPool, settings: { ...(pool.settings || {}), ...nextPool.settings } }
                            : pool
                    ))
                    : [...resourcePools, nextPool],
            };
        });
    };

    const saveCrewDraftValues = (
        aircraftCodeValue: string,
        standardSeatsText: string,
        alternateCrewText: string,
        message = 'Crew composition saved into Settings.',
    ) => {
        const aircraftCode = String(aircraftCodeValue || '').trim().toUpperCase();
        if (!aircraftCode) {
            setSaveMessage('Choose an aircraft type before saving crew composition.');
            return;
        }
        saveWizardConfig(message, (baseConfig) => {
            const aircraftTypes = Array.isArray(baseConfig.aircraftTypes) ? baseConfig.aircraftTypes : [];
            const existingAircraft = aircraftTypes.find((aircraft: any) => normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode));
            const standardSeats = parseRoleRequirementsText(standardSeatsText);
            const nextAircraft = {
                ...(existingAircraft || {
                    id: createWizardRecordId('aircraft-type'),
                    code: aircraftCode,
                    name: resourceDraft.aircraftName || aircraftCode,
                    category: 'Other',
                    status: 'ACTIVE',
                }),
                crewComposition: {
                    ...normaliseAircraftCrewComposition(existingAircraft?.crewComposition || null),
                    standardSeats,
                },
            };
            const nextConfig = {
                ...baseConfig,
                aircraftTypes: existingAircraft
                    ? aircraftTypes.map((aircraft: any) => normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode) ? nextAircraft : aircraft)
                    : [...aircraftTypes, nextAircraft],
            };
            const targetUnitCode = getTargetWizardUnitCode();
            const targetModel = normaliseOperationalModel(unitDraft.operationalModel || getUnitOperationalModel(currentUnit || {}));
            const alternateRoleRequirements = parseRoleRequirementsText(alternateCrewText);
            return updatePrimaryOrganisationWithSettings(nextConfig, (settings) => {
                const compositionSettings = normaliseCrewCompositionSettings(settings.crewCompositionSettings || null);
                const existingProfile = findWizardAlternateCrewProfile(settings);
                const nextAlternateProfile = {
                    ...(existingProfile || {
                        id: createWizardRecordId('alternate-crew'),
                        code: 'ALT',
                        name: 'Other approved crew composition',
                        description: '',
                    }),
                    unitCode: targetUnitCode,
                    aircraftTypeCode: aircraftCode,
                    operationalModels: Array.from(new Set([
                        ...((existingProfile?.operationalModels || []).length > 0 ? existingProfile.operationalModels : [targetModel]),
                        targetModel,
                    ])),
                    roleRequirements: alternateRoleRequirements,
                    status: 'ACTIVE',
                };
                const alternateCompositions = existingProfile
                    ? compositionSettings.alternateCompositions.map((profile) => profile.id === existingProfile.id ? nextAlternateProfile : profile)
                    : [...compositionSettings.alternateCompositions, nextAlternateProfile];
                return {
                    ...settings,
                    crewCompositionSettings: normaliseCrewCompositionSettings({
                        ...compositionSettings,
                        alternateCompositions,
                    }),
                    initialSetupWizardDraft: {
                        ...(settings.initialSetupWizardDraft || {}),
                        alternateCrews: alternateCrewText,
                        updatedAt: new Date().toISOString(),
                    },
                    initialSetupWizardDrafts: {
                        ...(settings.initialSetupWizardDrafts || {}),
                        alternateCrewDraft: alternateCrewText,
                        updatedAt: new Date().toISOString(),
                    },
                };
            });
        });
    };
    const saveCrewDraft = () => {
        saveCrewDraftValues(crewDraft.aircraftCode, crewDraft.standardSeats, alternateCrewDraft);
    };

    const saveAccessDraft = () => {
        saveWizardConfig('User access scope saved into Settings.', (baseConfig) => {
            const userAccess = Array.isArray(baseConfig.userAccess) ? baseConfig.userAccess : [];
            const targetKey = primaryUserAccess?.id || primaryUserAccess?.userId || primaryUserAccess?.userName || '';
            const nextAccess = {
                id: primaryUserAccess?.id || createWizardRecordId('user-access'),
                userName: accessDraft.userName,
                locationCode: accessDraft.locationCode,
                unitCode: accessDraft.unitCode,
                moduleCode: accessDraft.moduleCode,
                accessLevel: accessDraft.accessLevel,
                status: 'ACTIVE',
            };
            const exists = userAccess.some((access: any) => targetKey && String(access?.id || access?.userId || access?.userName || '') === String(targetKey));
            return {
                ...baseConfig,
                userAccess: exists
                    ? userAccess.map((access: any) => targetKey && String(access?.id || access?.userId || access?.userName || '') === String(targetKey) ? { ...access, ...nextAccess } : access)
                    : [...userAccess, nextAccess],
            };
        });
    };

    const buildRankSettingsToSave = (settingsSource: any = activeOrganisation?.settings) => {
        const existing = normalisePersonnelDisplaySettings(
            settingsSource?.personnelDisplaySettings
            || settingsSource?.personnelSettings
            || null,
        );
        const preset = RANK_EQUIVALENCY_PRESETS[rankSettingsDraft.preset as RankEquivalencyPresetKey]
            ? rankSettingsDraft.preset as RankEquivalencyPresetKey
            : existing.staffRankEquivalency?.preset || 'AU';
        const selectedEquivalency = preset === 'CUSTOM'
            ? existing.staffRankEquivalency
            : RANK_EQUIVALENCY_PRESETS[preset] || RANK_EQUIVALENCY_PRESETS.AU;
        const staffRankOrder = getRankOrderFromEquivalency({
            ...selectedEquivalency,
            civilianTitles: existing.civilianTitles,
        } as any);
        return {
            ...existing,
            sortMode: rankSettingsDraft.sortMode === 'alphabetical' ? 'alphabetical' : 'rank-then-name',
            useSeparateTraineeRankOrder: false,
            instructorLabel: String(rankSettingsDraft.instructorLabel || existing.instructorLabel || 'Instructor').trim() || 'Instructor',
            staffRankEquivalency: selectedEquivalency,
            staffRankOrder,
            traineeRankOrder: staffRankOrder,
        };
    };

    const saveRankSettingsDraft = () => {
        saveWizardConfig('Rank display settings saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            personnelDisplaySettings: buildRankSettingsToSave(settings),
            initialSetupWizardDraft: {
                ...(settings.initialSetupWizardDraft || {}),
                ranksAndLabels: rankLabelsDraft,
                rankSettings: rankSettingsDraft,
                updatedAt: new Date().toISOString(),
            },
            initialSetupWizardDrafts: {
                ...(settings.initialSetupWizardDrafts || {}),
                rankLabelsDraft,
                rankSettingsDraft,
                updatedAt: new Date().toISOString(),
            },
        })));
    };

    const saveCrewRolesDraft = () => {
        const rows = parseWizardCrewRoleRows(crewRolesDraft);
        const validRows = rows.filter((row) => String(row.role || '').trim());
        if (validRows.length === 0) {
            setSaveMessage('Add at least one crew role before continuing.');
            return;
        }
        saveWizardConfig('Crew roles saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const existingTerminology = normaliseCrewPositionTerminology(settings.crewPositionTerminology || null);
            const nextPositions = validRows.map((row, index) => {
                const cleanRole = String(row.role || '').trim();
                const existing = existingTerminology.positions.find((position) => (
                    normaliseUnitSettingsIdentifier(position.genericName) === normaliseUnitSettingsIdentifier(cleanRole)
                ));
                const modelTokens = String(row.models || '')
                    .split(',')
                    .map((model) => model.trim())
                    .filter(Boolean)
                    .map((model) => normaliseOperationalModel(model));
                return {
                    id: existing?.id || createWizardRecordId('crew-role'),
                    genericName: cleanRole,
                    label: String(row.label || cleanRole).trim() || cleanRole,
                    operationalModels: modelTokens.length > 0 ? modelTokens : OPERATIONAL_MODEL_OPTIONS.map((option) => option.value),
                };
            });
            return {
                ...settings,
                crewPositionTerminology: normaliseCrewPositionTerminology({
                    positions: nextPositions,
                    deletedDefaultIds: existingTerminology.deletedDefaultIds,
                }),
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    crewRoles: crewRolesDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    crewRolesDraft,
                    updatedAt: new Date().toISOString(),
                },
            };
        }));
    };

    const saveResourceSharingDraft = () => {
        const sharingRows = parseWizardSharingRows(resourceSharingDraft);
        const staffSharingRows = sharingRows.filter((row) => row.type.toLowerCase().includes('staff'));
        const resourceSharingRows = sharingRows.filter((row, index) => (
            row.type.toLowerCase().includes('resource')
            || (!row.type.toLowerCase().includes('staff') && index === 0)
        ));
        const splitUnits = (value: string) => Array.from(new Set(String(value || '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)));
        const rowIsEnabled = (value: string) => /^on$/i.test(String(value || '').trim());
        saveWizardConfig('Resource and staff sharing saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const existingResourceGroups = Array.isArray(settings.resourceSharingGroups) ? settings.resourceSharingGroups : [];
            const existingStaffGroups = Array.isArray(settings.staffSharingGroups) ? settings.staffSharingGroups : [];
            const nextResourceGroups = resourceSharingRows.map((row, index) => {
                const selectedUnits = splitUnits(row.units);
                const existing = existingResourceGroups[index] || existingResourceGroups.find((group: any) => (
                    selectedUnits.length > 0
                    && Array.isArray(group?.selectedUnits)
                    && group.selectedUnits.map(normaliseUnitSettingsIdentifier).join('|') === selectedUnits.map(normaliseUnitSettingsIdentifier).join('|')
                ));
                return {
                    ...(existing || { id: createWizardRecordId('resource-sharing') }),
                    name: row.name || existing?.name || (selectedUnits.length > 1 ? selectedUnits.join('+') : 'Resource sharing'),
                    selectedUnits,
                    allocationMode: row.allocationMode || existing?.allocationMode || settings.allocationMode || 'combined',
                    desiredAllocations: existing?.desiredAllocations || settings.desiredAllocations || {},
                    remainderUnitIndex: typeof existing?.remainderUnitIndex === 'number'
                        ? existing.remainderUnitIndex
                        : (typeof settings.remainderUnitIndex === 'number' ? settings.remainderUnitIndex : -1),
                    enabled: rowIsEnabled(row.enabled),
                    status: 'ACTIVE',
                };
            });
            const nextStaffGroups = staffSharingRows.map((row, index) => {
                const selectedUnits = splitUnits(row.units);
                const existing = existingStaffGroups[index] || existingStaffGroups.find((group: any) => (
                    selectedUnits.length > 0
                    && Array.isArray(group?.selectedUnits)
                    && group.selectedUnits.map(normaliseUnitSettingsIdentifier).join('|') === selectedUnits.map(normaliseUnitSettingsIdentifier).join('|')
                ));
                return {
                    ...(existing || { id: createWizardRecordId('staff-sharing') }),
                    name: row.name || existing?.name || (selectedUnits.length > 1 ? `${selectedUnits.join('+')} Staff Sharing` : 'Staff sharing'),
                    selectedUnits: rowIsEnabled(row.enabled) ? selectedUnits : [],
                    enabled: rowIsEnabled(row.enabled),
                    status: 'ACTIVE',
                };
            });
            const selectedResourceUnits = Array.from(new Set(nextResourceGroups
                .filter((group: any) => group.enabled !== false)
                .flatMap((group: any) => readSharingGroupUnits(group))));
            const selectedStaffUnits = Array.from(new Set(nextStaffGroups
                .filter((group: any) => group.enabled !== false)
                .flatMap((group: any) => readSharingGroupUnits(group))));
            return {
                ...settings,
                fleetSharingEnabled: nextResourceGroups.some((group: any) => group.enabled !== false && readSharingGroupUnits(group).length > 1),
                selectedUnits: selectedResourceUnits,
                allocationMode: nextResourceGroups[0]?.allocationMode || settings.allocationMode || 'combined',
                desiredAllocations: nextResourceGroups[0]?.desiredAllocations || settings.desiredAllocations || {},
                remainderUnitIndex: typeof nextResourceGroups[0]?.remainderUnitIndex === 'number'
                    ? nextResourceGroups[0].remainderUnitIndex
                    : (typeof settings.remainderUnitIndex === 'number' ? settings.remainderUnitIndex : -1),
                resourceSharingGroups: nextResourceGroups,
                staffSharingEnabled: nextStaffGroups.some((group: any) => group.enabled === true && readSharingGroupUnits(group).length > 1),
                staffSharingUnits: nextStaffGroups.some((group: any) => group.enabled === true) ? selectedStaffUnits : [],
                staffSharingGroups: nextStaffGroups,
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    resourceSharing: resourceSharingDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    resourceSharingDraft,
                    updatedAt: new Date().toISOString(),
                },
            };
        }));
    };

    const saveBuildRulesDraft = () => {
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        saveWizardConfig('Build rules saved into Settings.', (baseConfig) => {
            const ruleSets = Array.isArray(baseConfig.schedulingRuleSets) ? baseConfig.schedulingRuleSets : [];
            const existingIndex = ruleSets.findIndex((ruleSet: any) => (
                targetUnitCode
                && normaliseUnitSettingsIdentifier(ruleSet?.unitCode) === normaliseUnitSettingsIdentifier(targetUnitCode)
                && String(ruleSet?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
                && ruleSet?.isActive !== false
            ));
            const existingRule = existingIndex >= 0 ? ruleSets[existingIndex] : null;
            const maxEventsPerDay = parseNumberDraft(buildRulesDraft.maxEventsPerDay, 0);
            const maxFlightsPerDay = parseNumberDraft(buildRulesDraft.maxFlightsPerDay, 0);
            const minGapBetweenEventsMinutes = parseNumberDraft(buildRulesDraft.minGapBetweenEventsMinutes, 0);
            const existingRules = readPlainWizardObject(existingRule?.rules);
            const eventLimits = {
                ...readPlainWizardObject(existingRule?.eventLimits),
                ...readPlainWizardObject(existingRules.eventLimits),
                maxEventsPerDay,
                maxFlightsPerDay,
                minGapBetweenEventsMinutes,
            };
            const nextRule = {
                ...(existingRule || { id: createWizardRecordId('scheduling-rule-set') }),
                name: existingRule?.name || `${targetUnitCode || 'Unit'} build rules`,
                unitCode: targetUnitCode,
                businessRules: buildRulesDraft.businessRules,
                maxCrewDutyHours: parseNumberDraft(buildRulesDraft.maxCrewDutyHours, 12),
                preferredDutyHours: parseNumberDraft(buildRulesDraft.preferredDutyHours, 10),
                aircraftTurnaroundMinutes: parseNumberDraft(buildRulesDraft.aircraftTurnaroundMinutes, 60),
                simTurnaroundMinutes: parseNumberDraft(buildRulesDraft.simTurnaroundMinutes, 30),
                trainerTurnaroundMinutes: parseNumberDraft(buildRulesDraft.trainerTurnaroundMinutes, 30),
                maxDispatchPerHour: parseNumberDraft(buildRulesDraft.maxDispatchPerHour, 2),
                maxEventsPerDay,
                maxFlightsPerDay,
                minGapBetweenEventsMinutes,
                eventLimits,
                rules: {
                    ...existingRules,
                    maxEventsPerDay,
                    maxFlightsPerDay,
                    minGapBetweenEventsMinutes,
                    eventLimits,
                    wizardEventLimits: {
                        ...readPlainWizardObject(existingRules.wizardEventLimits),
                        maxEventsPerDay,
                        maxFlightsPerDay,
                        minGapBetweenEventsMinutes,
                    },
                    dailyEventLimits: {
                        ...readPlainWizardObject(existingRules.dailyEventLimits),
                        maxEventsPerDay,
                        maxFlightsPerDay,
                        minGapBetweenEventsMinutes,
                    },
                },
                status: 'ACTIVE',
            };
            const nextRuleSets = existingIndex >= 0
                ? ruleSets.map((ruleSet: any, index: number) => index === existingIndex ? nextRule : ruleSet)
                : [...ruleSets, nextRule];
            return updatePrimaryOrganisationWithSettings({
                ...baseConfig,
                schedulingRuleSets: nextRuleSets,
            }, (settings) => ({
                ...settings,
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    buildRules: buildRulesDraftText,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    buildRulesDraft: buildRulesDraftText,
                    updatedAt: new Date().toISOString(),
                },
            }));
        });
    };

    const saveTrainingRecordsDraft = () => {
        const row = parseWizardTrainingReportRows(trainingRecordsDraft)[0];
        if (!row) {
            setSaveMessage('Add the training report details before continuing.');
            return;
        }
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        const nextTemplate = {
            displayName: row.organisationName || row.genericName || 'Training Report',
            grades: {
                scaleMin: Number(row.gradeMin) || 0,
                scaleMax: Number(row.gradeMax) || 5,
                showNumbers: String(row.showNumbers || '').toLowerCase() !== 'no',
                includeNoGrade: String(row.noGradeOption || '').toLowerCase() === 'yes',
            },
            overallResults: {
                passLabel: row.passLabel || 'Satisfactory',
                failLabel: row.failLabel || 'Unsatisfactory',
            },
        };
        saveWizardConfig('Training report settings saved into Settings.', (baseConfig) => {
            const units = Array.isArray(baseConfig.units) ? baseConfig.units : [];
            const nextUnits = units.map((unit: any) => (
                normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(targetUnitCode)
                    ? { ...unit, settings: { ...(unit.settings || {}), trainingReportTemplate: nextTemplate } }
                    : unit
            ));
            return updatePrimaryOrganisationWithSettings({
                ...baseConfig,
                units: nextUnits,
            }, (settings) => ({
                ...settings,
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    trainingRecords: trainingRecordsDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    trainingRecordsDraft,
                    updatedAt: new Date().toISOString(),
                },
            }));
        });
    };

    const saveCurrencyProfilesDraft = () => {
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        const targetAircraftTypeCode = String(resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code || '').trim().toUpperCase();
        const targetUnitKey = normaliseUnitSettingsIdentifier(targetUnitCode);
        const targetAircraftKey = normaliseUnitSettingsIdentifier(targetAircraftTypeCode);
        const currencyProfiles = parseWizardCurrencyRows(currencyDraft).map((row, index) => ({
            id: createWizardRecordId('currency-profile'),
            unitCode: targetUnitCode,
            aircraftTypeCode: targetAircraftTypeCode,
            name: row.name || row.currency || row.code || `Currency ${index + 1}`,
            code: (row.code || row.name || `CUR${index + 1}`).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || `CUR${index + 1}`,
            crew: row.crew || 'Standard crew',
            config: row.config || 'ANY',
            currency: row.currency || row.name || `Currency ${index + 1}`,
            aircraftCount: Math.max(1, Math.round(Number(row.aircraftCount) || 1)),
            status: 'ACTIVE',
        })).filter((profile) => profile.name || profile.code);
        saveWizardConfig('Currency profiles saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const existingProfiles = Array.isArray(settings.crewCompositionSettings?.currencyProfiles)
                ? settings.crewCompositionSettings.currencyProfiles
                : [];
            const shouldReplaceProfile = (profile: any) => {
                const profileUnitKey = normaliseUnitSettingsIdentifier(profile?.unitCode || profile?.unit || '');
                const profileAircraftKey = normaliseUnitSettingsIdentifier(profile?.aircraftTypeCode || profile?.aircraftCode || profile?.aircraft || '');
                const unitMatches = targetUnitKey ? (!profileUnitKey || profileUnitKey === targetUnitKey) : !profileUnitKey;
                const aircraftMatches = targetAircraftKey ? (!profileAircraftKey || profileAircraftKey === targetAircraftKey) : !profileAircraftKey;
                return unitMatches && aircraftMatches;
            };
            return {
                ...settings,
                crewCompositionSettings: normaliseCrewCompositionSettings({
                    ...(settings.crewCompositionSettings || {}),
                    currencyProfiles: [
                        ...existingProfiles.filter((profile: any) => !shouldReplaceProfile(profile)),
                        ...currencyProfiles,
                    ],
                }),
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    currencies: currencyDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    currencyDraft,
                    updatedAt: new Date().toISOString(),
                },
            };
        }));
    };

    const saveScoringMatrixDraft = () => {
        const trainingReportPhraseBank = wizardScoringPhraseBank;
        const nextScoringDraft = wizardPhraseBankToScoringDraft(trainingReportPhraseBank);
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        saveWizardConfig('Scoring matrix saved into Settings.', (baseConfig) => {
            const units = Array.isArray(baseConfig.units) ? baseConfig.units : [];
            const nextUnits = units.map((unit: any) => (
                normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(targetUnitCode)
                    ? { ...unit, settings: { ...(unit.settings || {}), trainingReportPhraseBank } }
                    : unit
            ));
            return updatePrimaryOrganisationWithSettings({
                ...baseConfig,
                units: nextUnits,
            }, (settings) => ({
                ...settings,
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    scoringMatrix: nextScoringDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    scoringDraft: nextScoringDraft,
                    updatedAt: new Date().toISOString(),
                },
            }));
        });
        setScoringDraft(nextScoringDraft);
    };

    const saveStaffCurrencyEventsDraft = () => {
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        const aircraftTypeCode = String(resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code || '').trim().toUpperCase();
        const standardMissionProfiles = parseWizardStandardCurrencyEventRows(staffCurrencyEventsDraft).map((row, index) => ({
            id: createWizardRecordId('standard-mission'),
            unitCode: targetUnitCode,
            name: row.name || row.shortTitle || `Standard event ${index + 1}`,
            shortTitle: row.shortTitle || row.name || `EVT${index + 1}`,
            resourceType: row.resourceType || 'Flight',
            aircraftTypeCode,
            duration: Math.max(0, Number(row.duration) || 0),
            preFlight: Math.max(0, Number(row.preFlight) || 0),
            postFlight: Math.max(0, Number(row.postFlight) || 0),
            crew: row.crew || 'Standard crew',
            currency: row.currency || '',
            config: row.config || 'ANY',
            aircraftCount: Math.max(1, Math.round(Number(row.aircraftCount) || 1)),
            status: 'ACTIVE',
        })).filter((profile) => profile.name || profile.shortTitle);
        saveWizardConfig('Staff currency event presets saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            standardMissionProfiles: { profiles: standardMissionProfiles },
            initialSetupWizardDraft: {
                ...(settings.initialSetupWizardDraft || {}),
                staffCurrencyEvents: staffCurrencyEventsDraft,
                updatedAt: new Date().toISOString(),
            },
            initialSetupWizardDrafts: {
                ...(settings.initialSetupWizardDrafts || {}),
                staffCurrencyEventsDraft,
                updatedAt: new Date().toISOString(),
            },
        })));
    };

    const saveTrainingDraft = () => {
        const lmpCode = String(trainingDraft.lmpCode || '').trim();
        if (!lmpCode) {
            setSaveMessage('Enter a Master LMP code before saving.');
            return;
        }
        saveWizardConfig('Master LMP and access rule saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const catalogue = Array.isArray(settings.masterLmpCatalogue) ? settings.masterLmpCatalogue : [];
            const accessRules = getOrganisationMasterLmpAccessRules(settings);
            const catalogueExists = catalogue.some((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(lmpCode));
            const ruleKey = primaryMasterLmpRule?.id || '';
            const nextCatalogueEntry = {
                id: primaryMasterLmp?.id || createWizardRecordId('master-lmp-catalogue'),
                code: lmpCode,
                name: trainingDraft.lmpName || lmpCode,
                description: trainingDraft.description,
                status: trainingDraft.status || 'ACTIVE',
            };
            const nextRule = {
                id: primaryMasterLmpRule?.id || createWizardRecordId('master-lmp-access'),
                lmpCode,
                locationCode: trainingDraft.accessLocationCode,
                unitCode: trainingDraft.accessUnitCode,
                operationalModel: trainingDraft.accessModel === 'Any Model' ? null : trainingDraft.accessModel,
                accessLevel: trainingDraft.accessLevel,
                status: 'ACTIVE',
            };
            return {
                ...settings,
                masterLmpCatalogue: catalogueExists
                    ? catalogue.map((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(lmpCode) ? { ...item, ...nextCatalogueEntry } : item)
                    : [...catalogue, nextCatalogueEntry],
                masterLmpAccess: ruleKey
                    ? accessRules.map((rule: any) => String(rule?.id || '') === String(ruleKey) ? { ...rule, ...nextRule } : rule)
                    : [...accessRules, nextRule],
            };
        }));
    };

    const saveWizardSupplementaryDrafts = (message = 'This step has been synced into Settings.') => {
        const scoringDraftToSave = wizardPhraseBankToScoringDraft(wizardScoringPhraseBank);
        saveWizardConfig(message, (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            initialSetupWizardDraft: {
                ...(settings.initialSetupWizardDraft || {}),
                unitsToday: parseWizardUnitRows(unitsTodayDraft),
                locationsToday: parseWizardLocationRows(locationsTodayDraft),
                unitParents: unitParentDraft,
                crewLabels: crewLabelsDraft,
                alternateCrews: alternateCrewDraft,
                buildRules: buildRulesDraftText,
                trainingRecords: trainingRecordsDraft,
                unitModules: unitModulesDraft,
                ranksAndLabels: rankLabelsDraft,
                rankSettings: rankSettingsDraft,
                crewRoles: crewRolesDraft,
                resourceSharing: resourceSharingDraft,
                currencies: currencyDraft,
                scoringMatrix: scoringDraftToSave,
                staffCurrencyEvents: staffCurrencyEventsDraft,
                updatedAt: new Date().toISOString(),
            },
            initialSetupWizardDrafts: {
                ...(settings.initialSetupWizardDrafts || {}),
                organisationDraft,
                unitsTodayDraft,
                locationsTodayDraft,
                unitParentDraft,
                crewLabelsDraft: crewLabelsDraft,
                alternateCrewDraft: alternateCrewDraft,
                buildRulesDraft: buildRulesDraftText,
                staffDraft,
                traineeCourses: traineeCourseOptionsDraft,
                traineeCourseOptionsDraft,
                traineeDraft,
                trainingRecordsDraft,
                unitModulesDraft,
                rankLabelsDraft,
                rankSettingsDraft,
                crewRolesDraft,
                resourceSharingDraft,
                currencyDraft,
                scoringDraft: scoringDraftToSave,
                staffCurrencyEventsDraft,
                updatedAt: new Date().toISOString(),
            },
        })));
    };

    const parseWizardUnitModuleDraftRows = () => {
        const rows = parseWizardPipeRows<{ module: string; enabled: string }>(unitModulesDraft, ['module', 'enabled']);
        return rows
            .map((row, index) => {
                const name = String(row.module || '').trim();
                const code = makeWizardModuleCode(name, index);
                if (!name || !code) return null;
                return {
                    name,
                    code,
                    isEnabled: !/^(off|no|disabled|false)$/i.test(String(row.enabled || 'On').trim()),
                };
            })
            .filter(Boolean) as Array<{ name: string; code: string; isEnabled: boolean }>;
    };

    const saveUnitModulesDraft = () => {
        const moduleRows = parseWizardUnitModuleDraftRows();
        if (moduleRows.length === 0) {
            setSaveMessage('Choose at least one app area before continuing.');
            return;
        }
        const targetUnitCode = String(unitDraft.code || currentUnit?.code || unitCode || '').trim().toUpperCase();
        if (!targetUnitCode) {
            setSaveMessage('Set up the unit before choosing app areas.');
            return;
        }
        saveWizardConfig('Unit app areas saved into Settings.', (baseConfig) => {
            const modules = Array.isArray(baseConfig.modules) ? baseConfig.modules : [];
            const nextModules = [...modules];
            moduleRows.forEach((row) => {
                const existingIndex = nextModules.findIndex((module: any) => (
                    normaliseUnitSettingsIdentifier(module?.code) === normaliseUnitSettingsIdentifier(row.code)
                    || normaliseUnitSettingsIdentifier(module?.name) === normaliseUnitSettingsIdentifier(row.name)
                ));
                const nextModule = {
                    ...(existingIndex >= 0 ? nextModules[existingIndex] : { id: createWizardRecordId('module') }),
                    code: row.code,
                    name: row.name,
                    status: 'ACTIVE',
                };
                if (existingIndex >= 0) nextModules[existingIndex] = nextModule;
                else nextModules.push(nextModule);
            });

            const unitModules = Array.isArray(baseConfig.unitModules) ? baseConfig.unitModules : [];
            const nextUnitModules = [...unitModules];
            moduleRows.forEach((row) => {
                const existingIndex = nextUnitModules.findIndex((item: any) => (
                    normaliseUnitSettingsIdentifier(item?.unitCode) === normaliseUnitSettingsIdentifier(targetUnitCode)
                    && normaliseUnitSettingsIdentifier(item?.moduleCode) === normaliseUnitSettingsIdentifier(row.code)
                ));
                const nextUnitModule = {
                    ...(existingIndex >= 0 ? nextUnitModules[existingIndex] : { id: createWizardRecordId('unit-module'), settings: {} }),
                    unitCode: targetUnitCode,
                    moduleCode: row.code,
                    isEnabled: row.isEnabled,
                    status: 'ACTIVE',
                };
                if (existingIndex >= 0) nextUnitModules[existingIndex] = nextUnitModule;
                else nextUnitModules.push(nextUnitModule);
            });

            return updatePrimaryOrganisationWithSettings({
                ...baseConfig,
                modules: nextModules,
                unitModules: nextUnitModules,
            }, (settings) => ({
                ...settings,
                initialSetupWizardDraft: {
                    ...(settings.initialSetupWizardDraft || {}),
                    unitModules: unitModulesDraft,
                    updatedAt: new Date().toISOString(),
                },
                initialSetupWizardDrafts: {
                    ...(settings.initialSetupWizardDrafts || {}),
                    unitModulesDraft,
                    unitModules: unitModulesDraft,
                    updatedAt: new Date().toISOString(),
                },
            }));
        });
    };

    const hasResourceRowCapacity = activeResourcePools.some((pool: any) => {
        const settings = pool?.settings || {};
        return [
            settings.aircraft ?? pool?.aircraft,
            settings.ftd ?? settings.sim ?? pool?.ftd ?? pool?.sim,
            settings.cpt ?? settings.trainer ?? pool?.cpt ?? pool?.trainer,
            settings.standby ?? pool?.standby,
            settings.ground ?? pool?.ground,
        ].some((value) => parseNumberDraft(String(value ?? ''), 0) > 0);
    });

    const checks: InitialSetupWizardCheck[] = [
        {
            id: 'organisation',
            label: 'Organisation',
            mandatory: true,
            complete: Boolean(activeOrganisation?.code && activeOrganisation?.name && orgStructureConfigured),
            summary: orgStructureConfigured ? `${organisationStructureLevels.length} organisation levels configured` : 'Organisation name and structure are needed.',
            settingsSection: 'platform-organisation-locations',
            focusSubsectionId: 'platform-organisation-structure',
        },
        {
            id: 'locations',
            label: 'Locations',
            mandatory: true,
            complete: activeLocations.length > 0,
            summary: activeLocations.length > 0 ? `${activeLocations.length} locations configured` : 'At least one base or airfield is needed.',
            settingsSection: 'platform-organisation-locations',
            focusSubsectionId: 'platform-locations',
        },
        {
            id: 'units',
            label: 'Units',
            mandatory: true,
            complete: activeUnits.length > 0 && activeUnits.every((unit: any) => unit.locationCode && getUnitOperationalModel(unit)),
            summary: activeUnits.length > 0 ? `${activeUnits.length} units configured` : 'At least one unit is needed.',
            settingsSection: 'platform-units',
        },
        {
            id: 'resources',
            label: 'Aircraft setup and DFP resource rows',
            mandatory: true,
            complete: activeAircraftTypes.length > 0 && activeResourcePools.length > 0 && hasResourceRowCapacity,
            summary: hasResourceRowCapacity ? `${activeResourcePools.length} DFP Resource Rows record${activeResourcePools.length === 1 ? '' : 's'} with usable capacity configured` : 'Aircraft types and at least one usable DFP resource row are needed before NEO can build.',
            settingsSection: activeAircraftTypes.length > 0 ? 'platform-dfp-resource-rows' : 'platform-aircraft-setup',
        },
        {
            id: 'crew',
            label: 'Crew composition',
            mandatory: true,
            complete: standardCrewConfigured,
            summary: standardCrewConfigured ? 'Crew requirements are configured.' : 'Minimum crew rules are needed for scheduling.',
            settingsSection: 'crew-composition',
        },
        {
            id: 'training',
            label: 'Courses and Master LMPs',
            mandatory: true,
            complete: activeMasterLmpCatalogue.length > 0 && activeMasterLmpAccess.length > 0,
            summary: activeMasterLmpCatalogue.length > 0 ? `${activeMasterLmpCatalogue.length} Master LMP records configured` : 'Training streams are needed for NEO build and records.',
            settingsSection: 'platform-master-lmp-access',
        },
        {
            id: 'access',
            label: 'People and access',
            mandatory: true,
            complete: activeUserAccess.length > 0,
            summary: activeUserAccess.length > 0 ? `${activeUserAccess.length} access scopes configured` : 'User access scopes are needed for secure operation.',
            settingsSection: 'platform-user-access',
        },
        {
            id: 'rules',
            label: 'Build rules',
            mandatory: false,
            complete: true,
            summary: 'Configured build rules can be refined later.',
            settingsSection: 'business-rules',
        },
    ];
    const mandatoryChecks = checks.filter((check) => check.mandatory);
    const completedMandatory = mandatoryChecks.filter((check) => check.complete).length;
    const completedChecks = checks.filter((check) => check.complete).length;
    const isPartiallyConfigured = completedMandatory > 1 && completedMandatory < mandatoryChecks.length;
    const allMandatoryComplete = completedMandatory === mandatoryChecks.length;
    const selectedOrganisationLevelCount = normaliseOrganisationLevelCount(organisationDraft.organisationLevelCount, 3);
    const additionalOrganisationLevelSteps: InitialSetupWizardStep[] = Array.from({ length: Math.max(0, selectedOrganisationLevelCount - 3) }, (_, index) => {
        const levelIndex = index + 4;
        return {
            id: `org-level${levelIndex}`,
            title: `Build the level below ${getOrganisationDraftLevel(organisationDraft, levelIndex - 1).name || `Level ${levelIndex - 1}`}`,
            label: `Level ${levelIndex}`,
            body: 'Add this organisation layer and choose the immediate parent for each item. This keeps the organisation tree clear.',
            checkIds: ['organisation'],
            category: 'mandatory',
        };
    });

    const steps: InitialSetupWizardStep[] = [
        {
            id: 'analysis',
            title: 'Let us check what is already set up',
            label: 'Check',
            body: 'I will quickly read the current Settings data first, then guide you through the setup one question at a time.',
            checkIds: checks.map((check) => check.id),
            category: 'review',
        },
        {
            id: 'org-name',
            title: 'What is the name of your organisation?',
            label: 'Org name',
            body: 'Start with the organisation that owns or operates DFP NEO. This becomes the top of the structure.',
            checkIds: ['organisation'],
            category: 'mandatory',
        },
        {
            id: 'org-level1',
            title: 'Build the next level down',
            label: 'Level 1',
            body: `Thanks. ${organisationDraft.name || organisationDraft.code || 'Your organisation'} is the top of the tree. Now add the first layer below it.`,
            checkIds: ['organisation'],
            category: 'mandatory',
        },
        {
            id: 'org-level2',
            title: `Build the level below ${organisationDraft.level1Name || 'Level 1'}`,
            label: 'Level 2',
            body: 'Tell the wizard what sits below the level above. This might be a command, group, wing, region, or directorate.',
            checkIds: ['organisation'],
            category: 'mandatory',
        },
        {
            id: 'org-level3',
            title: `Build the level below ${organisationDraft.level2Name || 'Level 2'}`,
            label: 'Level 3',
            body: 'This is usually the level closest to the units that will use the app.',
            checkIds: ['organisation'],
            category: 'mandatory',
        },
        ...additionalOrganisationLevelSteps,
        {
            id: 'locations-today',
            title: 'Which localities do you want to set up?',
            label: 'Locations',
            body: 'Add the bases, airfields, or operating locations this unit may use.',
            checkIds: ['locations'],
            category: 'mandatory',
        },
        {
            id: 'location-details',
            title: 'Add details for the first locality',
            label: 'Location details',
            body: 'Confirm the local details used for time, display, first light and last light shading, and training areas.',
            checkIds: ['locations'],
            category: 'highly-desirable',
        },
        {
            id: 'units-today',
            title: 'Which units do you want to set up today?',
            label: 'Units',
            body: 'List the units you want this wizard to prepare. You can add more units later in Settings.',
            checkIds: ['units'],
            category: 'mandatory',
        },
        {
            id: 'unit-model',
            title: 'Set up the first unit',
            label: 'Unit setup',
            body: 'Set the unit identity, home location, unit type, and operating model. The operating model controls which scheduling logic applies.',
            checkIds: ['units'],
            category: 'mandatory',
        },
        {
            id: 'unit-modules',
            title: 'Choose the app areas this unit will use',
            label: 'Modules',
            body: 'Switch on the main app areas this unit needs. You can adjust this later in Settings.',
            checkIds: ['access'],
            category: 'mandatory',
        },
        {
            id: 'ranks-labels',
            title: 'Set ranks and display labels',
            label: 'Ranks and labels',
            body: 'Choose the rank table and name display rules this unit should use. The detailed rank table can still be edited later in Settings.',
            checkIds: ['access'],
            category: 'highly-desirable',
        },
        {
            id: 'crew-roles',
            title: 'Set the crew roles this unit uses',
            label: 'Crew roles',
            body: 'Choose the crew role names available when this unit builds crew rules and flight events.',
            checkIds: ['crew'],
            category: 'highly-desirable',
        },
        {
            id: 'resource-aircraft',
            title: `What aircraft or main resource does ${unitDraft.code || 'this unit'} use?`,
            label: 'Aircraft',
            body: 'Tell DFP NEO what aircraft or main scheduling resource the unit uses.',
            checkIds: ['resources'],
            category: 'mandatory',
        },
        {
            id: 'resource-counts',
            title: `What can ${unitDraft.code || 'this unit'} schedule?`,
            label: 'Counts',
            body: 'Enter the numbers NEO can use for aircraft, simulators, trainers, standby lines and ground rows.',
            checkIds: ['resources'],
            category: 'mandatory',
        },
        {
            id: 'aircraft-configs',
            title: 'Set aircraft CONFIG options',
            label: 'Aircraft CONFIG',
            body: 'Set the aircraft CONFIG names and setup values this unit uses when planning aircraft. This is the same aircraft setup used in Settings.',
            checkIds: ['resources'],
            category: 'highly-desirable',
        },
        {
            id: 'crew',
            title: 'Set the crew rules',
            label: 'Crew',
            body: 'Set the normal crew pattern and any alternate crew patterns for this aircraft or resource.',
            checkIds: ['crew'],
            category: 'highly-desirable',
        },
        {
            id: 'callsigns',
            title: 'Set terminology and callsign rules',
            label: 'Terminology/callsigns',
            body: 'Set the terminology, callsign prefixes, and formation callsigns this unit uses when creating or scheduling events.',
            checkIds: ['crew'],
            category: 'highly-desirable',
        },
        {
            id: 'build-rules',
            title: 'Set the build rules and limits',
            label: 'Build rules',
            body: 'Set the simple limits NEO should respect when it builds the schedule.',
            checkIds: ['rules'],
            category: 'highly-desirable',
        },
        {
            id: 'advanced-scheduling-rules',
            title: 'Check advanced scheduling rules',
            label: 'Advanced rules',
            body: 'Check the detailed event timings and scheduling rule sets used when DFP NEO places events.',
            checkIds: ['rules'],
            category: 'highly-desirable',
        },
        {
            id: 'resource-sharing',
            title: 'Set resource and staff sharing',
            label: 'Sharing',
            body: 'Tell DFP NEO whether this unit can share aircraft, resources, or staff with another unit.',
            checkIds: ['resources'],
            category: 'highly-desirable',
        },
        {
            id: 'currencies',
            title: 'Set the currencies this unit uses',
            label: 'Currencies',
            body: 'Add the currency and recency definitions the unit needs for planning and checks.',
            checkIds: ['training'],
            category: 'highly-desirable',
        },
        {
            id: 'training-records',
            title: 'Set training report names and grading labels',
            label: 'Training reports',
            body: 'Set the report name and grading words users will see when recording training evidence.',
            checkIds: ['training'],
            category: 'highly-desirable',
        },
        {
            id: 'staff-currency-events',
            title: `Set ${configuredContinuationShortLabel} and currency event presets`,
            label: `${configuredContinuationShortLabel}/currency events`,
            body: 'Create common reusable event presets now, or refine them later if the unit is not ready.',
            checkIds: ['training'],
            category: 'highly-desirable',
        },
        {
            id: 'scoring',
            title: 'Set up the scoring matrix',
            label: 'Scoring',
            body: 'Set the plain-English grading standards used in training reports. You can also upload the scoring template.',
            checkIds: ['training'],
            category: 'highly-desirable',
        },
        {
            id: 'access',
            title: 'Manage user permissions',
            label: 'User permissions',
            body: 'Manage who can use this unit and what each person can do.',
            checkIds: ['access', 'training'],
            category: 'highly-desirable',
        },
        {
            id: 'deployment-readiness',
            title: 'Set deployment readiness',
            label: 'Deployment',
            body: 'Record how this installation is licensed, connected, and prepared for operational use.',
            checkIds: ['access'],
            category: 'highly-desirable',
        },
        {
            id: 'operational-runbook',
            title: 'Record support and recovery details',
            label: 'Support',
            body: 'Record who supports the system, how backups are managed, and what recovery targets apply.',
            checkIds: ['access'],
            category: 'highly-desirable',
        },
        {
            id: 'licensing',
            title: 'Record licence details',
            label: 'Licensing',
            body: 'Record licence details and feature limits if this deployment needs licence tracking.',
            checkIds: ['access'],
            category: 'optional',
            optional: true,
        },
        {
            id: 'staff',
            title: 'Add staff for this unit',
            label: 'Staff',
            body: 'Optional final step: add staff now, or leave this until the unit setup is complete.',
            checkIds: ['access'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'trainees',
            title: 'Does this unit have trainees?',
            label: 'Trainees',
            body: 'Optional final step: switch trainees on only if you want to start trainee setup now.',
            checkIds: ['access'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'trainee-courses',
            title: 'Create trainee courses',
            label: 'Courses',
            body: 'Optional final step: create the course names or course numbers trainees can be allocated to.',
            checkIds: ['access'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'trainee-upload',
            title: 'Upload or add trainees',
            label: 'Upload trainees',
            body: 'Optional final step: upload trainees or add them manually.',
            checkIds: ['access'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'trainee-allocation',
            title: 'Allocate trainees to courses',
            label: 'Allocate trainees',
            body: 'Optional final step: place each trainee into the right course, then commit them to Trainee Profiles.',
            checkIds: ['access'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'master-lmp',
            title: 'Choose or build the LMPs this unit will use',
            label: 'LMP',
            body: 'Optional final step: choose an existing LMP or start building the training event list.',
            checkIds: ['training'],
            category: 'follow-on',
            optional: true,
        },
        {
            id: 'review',
            title: 'Review the setup',
            label: 'Review',
            body: allMandatoryComplete
                ? 'The mandatory setup areas look ready.'
                : 'Some mandatory setup areas still need attention. Step through the questions again or continue refining values here.',
            checkIds: checks.map((check) => check.id),
            category: 'review',
        },
    ];
    const currentStep = Math.min(wizardStep, steps.length - 1);
    const visibleStep = steps[currentStep];
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const resetScroll = () => {
            const outerScrollElement = wizardShellRef.current?.closest('.organisation-slideout-scroll-stable') as HTMLElement | null;
            if (outerScrollElement) outerScrollElement.scrollTop = 0;
            if (wizardSettingsEmbedRef.current) wizardSettingsEmbedRef.current.scrollTop = 0;
        };
        const animationFrameId = window.requestAnimationFrame(() => {
            resetScroll();
            window.setTimeout(resetScroll, 0);
        });
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [currentStep, visibleStep.id]);
    useEffect(() => {
        if (!wizardPageMenuOpen) return;
        const animationFrameId = window.requestAnimationFrame(() => {
            wizardCurrentStepMenuItemRef.current?.scrollIntoView({
                block: 'center',
                inline: 'nearest',
            });
        });
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [currentStep, wizardPageMenuOpen]);
    const templateIdsByStep: Record<string, string[]> = {
        'org-name': ['organisation'],
        'units-today': ['units'],
        'locations-today': ['locations'],
        'staff': ['staff'],
        'trainee-upload': unitDraft.hasTrainees ? ['trainees'] : [],
        'master-lmp': ['courses'],
        'scoring': ['scoring'],
    };
    const visibleStepTemplateIds = templateIdsByStep[visibleStep.id] || [];
    const visibleTemplates = initialSetupTemplates.filter((template) => (
        visibleStepTemplateIds.includes(template.id)
    ));
    const wizardCategoryTextClass: Record<InitialSetupWizardCategory, string> = {
        mandatory: 'text-red-600',
        'highly-desirable': 'text-blue-600',
        optional: 'text-emerald-700',
        'follow-on': 'text-emerald-700',
        review: 'text-orange-600',
    };
    const cleanWizardValue = (value: unknown) => String(value ?? '').trim();
    const normaliseWizardValue = (value: unknown) => normaliseUnitSettingsIdentifier(cleanWizardValue(value));
    const hasMeaningfulWizardText = (value: unknown, defaults: unknown[] = []) => {
        const cleanValue = cleanWizardValue(value);
        if (!cleanValue) return false;
        const valueKey = normaliseWizardValue(cleanValue);
        if (!valueKey) return false;
        return !defaults.some((item) => normaliseWizardValue(item) === valueKey);
    };
    const hasMeaningfulWizardLine = (value: string, defaults: unknown[] = []) => (
        parseWizardLineItems(value).some((item) => hasMeaningfulWizardText(item, defaults))
    );
    const hasPositiveWizardNumber = (value: unknown) => parseNumberDraft(String(value ?? ''), 0) > 0;
    const hasChangedWizardObject = (value: Record<string, string>, defaults: Record<string, string>) => (
        Object.keys(defaults).some((key) => normaliseWizardValue(value[key]) !== normaliseWizardValue(defaults[key]))
    );
    const hasMeaningfulOrganisationLevel = (levelIndex: number) => {
        const level = getOrganisationDraftLevel(organisationDraft, levelIndex);
        const defaultName = levelIndex === 0 ? 'Organisation' : `Level ${levelIndex}`;
        return (
            hasMeaningfulWizardText(level.name, [defaultName, `Organisation Level ${levelIndex}`])
            && Array.isArray(level.options)
            && level.options.some((option: string) => hasMeaningfulWizardText(option, ['Organisation', defaultName, level.name]))
        );
    };
    const getWizardActiveUnitCodes = () => Array.from(new Set([
        ...(String(unitCode || '').split('+').map((item) => item.trim()).filter(Boolean)),
        unitDraft.code,
    ].map((item) => String(item || '').trim()).filter(Boolean)));
    const getWizardSourceResourcePool = () => {
        const targetUnitCode = normaliseWizardValue(unitDraft.code || currentUnit?.code || unitCode);
        const targetAircraftCode = normaliseWizardValue(resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code);
        return activeResourcePools.find((pool: any) => (
            (!targetUnitCode || normaliseWizardValue(pool?.unitCode) === targetUnitCode)
            && (!targetAircraftCode || normaliseWizardValue(pool?.aircraftTypeCode) === targetAircraftCode)
        )) || activeResourcePools.find((pool: any) => (
            targetUnitCode && normaliseWizardValue(pool?.unitCode) === targetUnitCode
        )) || primaryResourcePool || activeResourcePools[0] || null;
    };
    const getWizardSourceAircraftType = () => {
        const targetAircraftCode = normaliseWizardValue(resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code);
        return activeAircraftTypes.find((aircraft: any) => normaliseWizardValue(aircraft?.code) === targetAircraftCode) || primaryAircraftType || activeAircraftTypes[0] || null;
    };
    const getWizardAircraftConfigDefinitions = () => {
        const aircraft = getWizardSourceAircraftType();
        const pool = getWizardSourceResourcePool();
        const aircraftConfigs = aircraft?.settings?.aircraftConfigurations || aircraft?.aircraftConfigurations || aircraft?.configurations;
        const poolConfigs = pool?.settings?.aircraftConfigurations || pool?.aircraftConfigurations || pool?.configurations;
        const configs = Array.isArray(aircraftConfigs) && aircraftConfigs.length > 0 ? aircraftConfigs : poolConfigs;
        return Array.isArray(configs) ? configs : [];
    };
    const hasMeaningfulAircraftConfigDefinitions = () => getWizardAircraftConfigDefinitions().some((config: any) => (
        hasMeaningfulWizardText(config?.label || config?.name || config?.code || config?.definition, ['CONFIG 0', 'CONFIG0', 'Config 0'])
        || hasPositiveWizardNumber(config?.capacity ?? config?.count ?? config?.aircraftCount)
    ));
    const hasMeaningfulUnitCallsignSettings = () => {
        const settings = normaliseUnitCallsignSettings(activeOrganisation?.settings?.unitCallsignSettings || null);
        const activeUnitCodesSet = new Set(getWizardActiveUnitCodes().map(normaliseWizardValue).filter(Boolean));
        return settings.entries.some((entry: any) => {
            const entryUnit = normaliseWizardValue(entry?.unitCode || entry?.unit || entry?.code);
            return (!activeUnitCodesSet.size || !entryUnit || activeUnitCodesSet.has(entryUnit))
                && hasMeaningfulWizardText(entry?.prefix || entry?.callsignPrefix || entry?.callsign || entry?.label);
        });
    };
    const hasMeaningfulFormationCallsigns = () => (formationCallsigns || []).some((callsign: any) => (
        hasMeaningfulWizardText(callsign?.prefix || callsign?.callsign || callsign?.name || callsign?.label)
    ));
    const hasMeaningfulCallsignSettings = () => hasMeaningfulUnitCallsignSettings() || hasMeaningfulFormationCallsigns();
    const hasMeaningfulSchedulingRuleSettings = () => {
        const targetUnitCode = normaliseWizardValue(unitDraft.code || currentUnit?.code || unitCode);
        const ruleSets = Array.isArray(platformConfig?.schedulingRuleSets) ? platformConfig.schedulingRuleSets : [];
        return (
            hasPositiveWizardNumber(buildRuleSettings?.maxDispatchPerHour)
            || hasPositiveWizardNumber(buildRuleSettings?.dispatchRateWindowMinutes)
            || ruleSets.some((ruleSet: any) => (
                String(ruleSet?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
                && ruleSet?.isActive !== false
                && (!targetUnitCode || !ruleSet?.unitCode || normaliseWizardValue(ruleSet.unitCode) === targetUnitCode)
                && hasMeaningfulWizardText(ruleSet?.name, ['Use configured rule set'])
            ))
        );
    };
    const hasMeaningfulDeploymentProfile = () => {
        const profile = activeOrganisation?.settings?.deploymentProfile
            || activeOrganisation?.settings?.deploymentProfileSettings
            || platformConfig?.deploymentProfile
            || {};
        return [
            profile.dataResidence,
            profile.networkPosture,
            profile.notes,
        ].some((value) => hasMeaningfulWizardText(value))
            || hasMeaningfulWizardText(profile.mode, ['Online SaaS'])
            || hasMeaningfulWizardText(profile.authModel, ['Password'])
            || hasMeaningfulWizardText(profile.validationMethod, ['Manual'])
            || hasMeaningfulWizardText(profile.enforcementMode, ['Monitor Only'])
            || (Number.isFinite(Number(profile.offlineGraceDays)) && Number(profile.offlineGraceDays) !== 30)
            || (Number.isFinite(Number(profile.checkIntervalHours)) && Number(profile.checkIntervalHours) !== 24);
    };
    const hasMeaningfulOperationalRunbook = () => {
        const runbook = activeOrganisation?.settings?.operationalRunbook
            || activeOrganisation?.settings?.operationalRunbookSettings
            || platformConfig?.operationalRunbook
            || {};
        return [
            'environmentName',
            'deploymentIdentifier',
            'supportOwner',
            'supportContact',
            'approvingAuthority',
            'backupStorageLocation',
            'lastBackupDate',
            'lastRestoreTestDate',
            'maintenanceWindow',
            'updateApprovalProcess',
            'lastUpdateDate',
            'evidenceExportPath',
            'accreditationStatus',
            'notes',
        ].some((key) => hasMeaningfulWizardText(runbook[key], ['Production', 'Not started']))
            || (Number.isFinite(Number(runbook.backupRetentionDays)) && Number(runbook.backupRetentionDays) !== 30)
            || (Number.isFinite(Number(runbook.restoreTimeObjectiveHours)) && Number(runbook.restoreTimeObjectiveHours) !== 24)
            || (Number.isFinite(Number(runbook.restorePointObjectiveHours)) && Number(runbook.restorePointObjectiveHours) !== 24)
            || (Number.isFinite(Number(runbook.auditRetentionYears)) && Number(runbook.auditRetentionYears) !== 7);
    };
    const hasMeaningfulLicenceSettings = () => (
        (Array.isArray(platformConfig?.licenses) ? platformConfig.licenses : []).some((license: any) => (
            String(license?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
            && (
                hasMeaningfulWizardText(license.licenseName)
                || hasMeaningfulWizardText(license.licenseKey)
                || hasMeaningfulWizardText(license.validUntil)
                || hasMeaningfulWizardText(license.offlineFingerprint)
            )
        ))
    );
    const hasMeaningfulWizardStepData = (step: InitialSetupWizardStep) => {
        switch (step.id) {
            case 'analysis':
                return checks.some((check) => check.complete);
            case 'org-name':
                return (
                    hasMeaningfulWizardText(organisationDraft.name, ['Organisation'])
                    && hasMeaningfulWizardText(organisationDraft.code, ['ORG', 'Organisation'])
                );
            case 'org-level1':
                return hasMeaningfulOrganisationLevel(1);
            case 'org-level2':
                return hasMeaningfulOrganisationLevel(2);
            case 'org-level3':
                return hasMeaningfulOrganisationLevel(3);
            case 'locations-today': {
                const rows = parseWizardLocationRows(locationsTodayDraft);
                return rows.some((row) => (
                    hasMeaningfulWizardText(row.icao || row.iata, ['LOC1', 'LOC'])
                    && hasMeaningfulWizardText(row.name || row.icao || row.iata, ['Home Location', 'Location'])
                ));
            }
            case 'location-code':
                return hasMeaningfulWizardText(locationDraft.code, ['LOC1', 'LOC']);
            case 'location-details':
                return (
                    hasMeaningfulWizardText(locationDraft.code, ['LOC1', 'LOC'])
                    && hasMeaningfulWizardText(locationDraft.iataCode, ['LOC'])
                    && hasMeaningfulWizardText(locationDraft.name, ['Home Location', 'Location'])
                    && hasMeaningfulWizardText(locationDraft.timezone, ['UTC'])
                    && hasMeaningfulWizardLine(locationDraft.trainingAreas, ['Area A', 'Area B'])
                );
            case 'units-today': {
                const rows = parseWizardUnitRows(unitsTodayDraft);
                return rows.some((row) => (
                    hasMeaningfulWizardText(row.code, ['UNIT', 'UNIT-01'])
                    && hasMeaningfulWizardText(row.name || row.code, ['Unit', 'Unit Name', 'Training Unit Name'])
                ));
            }
            case 'unit-code':
                return (
                    hasMeaningfulWizardText(unitDraft.code, ['UNIT', 'UNIT-01'])
                    && hasMeaningfulWizardText(unitDraft.name, ['Unit'])
                );
            case 'unit-model':
                return (
                    hasMeaningfulWizardText(unitDraft.code, ['UNIT', 'UNIT-01'])
                    && hasMeaningfulWizardText(unitDraft.name, ['Unit'])
                    && hasMeaningfulWizardText(unitDraft.locationCode, ['LOC1', 'LOC'])
                    && hasMeaningfulWizardText(unitDraft.unitType, ['Not set'])
                    && hasMeaningfulWizardText(unitDraft.operationalModel, ['pooled-crew'])
                );
            case 'unit-modules': {
                const rows = parseWizardPipeRows<{ module: string; enabled: string }>(unitModulesDraft, ['module', 'enabled']);
                return rows.some((row) => (
                    hasMeaningfulWizardText(row.module)
                    && /^(on|yes|enabled|true)$/i.test(String(row.enabled || 'On').trim())
                ));
            }
            case 'ranks-labels':
                return (
                    hasMeaningfulWizardText(rankSettingsDraft.preset, ['CUSTOM'])
                    || hasMeaningfulWizardText(rankSettingsDraft.sortMode)
                    || hasMeaningfulWizardText(rankSettingsDraft.traineeRanks)
                    || hasMeaningfulWizardText(rankSettingsDraft.instructorLabel, ['Instructor'])
                );
            case 'crew-roles':
                return parseWizardCrewRoleRows(crewRolesDraft).some((row) => (
                    hasMeaningfulWizardText(row.role, ['Crew Role'])
                    && hasMeaningfulWizardText(row.label, ['Crew Role'])
                ));
            case 'resource-aircraft':
                return (
                    hasMeaningfulWizardText(resourceDraft.aircraftCode, ['Aircraft', 'Aircraft Type', 'Enter Aircraft Code'])
                    && hasMeaningfulWizardText(resourceDraft.aircraftName, ['Aircraft', 'Resource', 'Enter Aircraft Or Resource Type'])
                    && hasMeaningfulWizardText(resourceDraft.poolName, ['DFP Resource Rows'])
                );
            case 'resource-counts':
                return [
                    resourceDraft.aircraft,
                    resourceDraft.sim,
                    resourceDraft.trainer,
                    resourceDraft.standby,
                    resourceDraft.ground,
                ].every(hasPositiveWizardNumber);
            case 'aircraft-configs':
                return hasMeaningfulAircraftConfigDefinitions();
            case 'crew':
                return parseRoleRequirementsText(crewDraft.standardSeats).some((row) => (
                    hasMeaningfulWizardText(row.role, ['Crew'])
                    && Number(row.count || 0) > 0
                ));
            case 'callsigns':
                return hasMeaningfulCallsignSettings();
            case 'build-rules':
                return hasChangedWizardObject(buildRulesDraft, {
                    businessRules: 'Use configured rule set',
                    maxCrewDutyHours: '12',
                    preferredDutyHours: '10',
                    aircraftTurnaroundMinutes: '60',
                    simTurnaroundMinutes: '30',
                    trainerTurnaroundMinutes: '30',
                    maxDispatchPerHour: '2',
                    maxEventsPerDay: '',
                    maxFlightsPerDay: '',
                    minGapBetweenEventsMinutes: '0',
                });
            case 'advanced-scheduling-rules':
                return hasMeaningfulSchedulingRuleSettings();
            case 'resource-sharing':
                return parseWizardSharingRows(resourceSharingDraft).some((row) => (
                    /^on$/i.test(row.enabled)
                    && hasMeaningfulWizardText(row.units)
                ));
            case 'currencies':
                return parseWizardCurrencyRows(currencyDraft).some((row) => (
                    hasMeaningfulWizardText(row.name, ['PIC Currency', 'Instrument Currency'])
                    && hasMeaningfulWizardText(row.code, ['PIC', 'INST'])
                    && hasMeaningfulWizardText(row.currency, ['PIC Currency', 'Instrument Currency'])
                    && hasPositiveWizardNumber(row.aircraftCount)
                ));
            case 'training-records':
                return parseWizardTrainingReportRows(trainingRecordsDraft).some((row) => {
                    const lowestGrade = Number(row.gradeMin);
                    const highestGrade = Number(row.gradeMax);
                    return (
                        hasMeaningfulWizardText(row.genericName)
                        && hasMeaningfulWizardText(row.organisationName)
                        && Number.isFinite(lowestGrade)
                        && Number.isFinite(highestGrade)
                        && highestGrade > lowestGrade
                        && hasMeaningfulWizardText(row.showNumbers)
                        && hasMeaningfulWizardText(row.noGradeOption)
                        && hasMeaningfulWizardText(row.passLabel)
                        && hasMeaningfulWizardText(row.failLabel)
                    );
                });
            case 'staff-currency-events':
                return parseWizardStandardCurrencyEventRows(staffCurrencyEventsDraft).some((row) => (
                    hasMeaningfulWizardText(row.name, ['Annual Instrument Check'])
                    && hasMeaningfulWizardText(row.shortTitle, ['INST'])
                    && hasPositiveWizardNumber(row.duration)
                    && hasPositiveWizardNumber(row.aircraftCount)
                ));
            case 'scoring':
                return Object.entries(wizardScoringPhraseBank || {}).some(([dimension, phrases]) => (
                    hasMeaningfulWizardText(dimension, ['Preparation', 'Airmanship'])
                    && Boolean(phrases)
                    && typeof phrases === 'object'
                    && !Array.isArray(phrases)
                    && Object.values(phrases as Record<string, unknown>).some((gradePhrases) => (
                        Array.isArray(gradePhrases)
                        && gradePhrases.some((phrase) => hasMeaningfulWizardText(phrase))
                    ))
                ));
            case 'access':
                return activeUserAccess.some((access: any) => (
                    hasMeaningfulWizardText(access?.userName || access?.userId)
                    && (
                        hasMeaningfulWizardText(access?.accessLevel)
                        || hasMeaningfulWizardText(access?.role)
                        || (Array.isArray(access?.profileIds) && access.profileIds.length > 0)
                    )
                ));
            case 'deployment-readiness':
                return hasMeaningfulDeploymentProfile();
            case 'operational-runbook':
                return hasMeaningfulOperationalRunbook();
            case 'licensing':
                return hasMeaningfulLicenceSettings();
            case 'staff':
                return parseWizardStaffRows(staffDraft).some((row) => (
                    hasMeaningfulWizardText(row.surname, ['Surname'])
                    && hasMeaningfulWizardText(row.givenNames, ['First'])
                    && hasMeaningfulWizardText(row.unit, ['UNIT', 'UNIT-01'])
                    && hasMeaningfulWizardText(row.position, ['Pilot'])
                ));
            case 'trainees':
                return unitDraft.hasTrainees === true;
            case 'trainee-courses':
                return hasMeaningfulWizardLine(traineeCourseOptionsDraft, ['Course 1']);
            case 'trainee-upload':
            case 'trainee-allocation':
                return parseWizardTraineeRows(traineeDraft).some((row) => (
                    hasMeaningfulWizardText(row.surname, ['Surname'])
                    && hasMeaningfulWizardText(row.givenNames, ['First'])
                    && hasMeaningfulWizardText(row.course || row.courseNumber, ['Course 1'])
                ));
            case 'master-lmp':
                return (
                    hasMeaningfulWizardText(trainingDraft.lmpCode, ['New Master LMP', 'Master LMP'])
                    && hasMeaningfulWizardText(trainingDraft.lmpName, ['New Master LMP', 'Training Programme'])
                );
            case 'review':
                return allMandatoryComplete;
            default:
                if (/^org-level\d+$/.test(step.id)) {
                    return hasMeaningfulOrganisationLevel(Number(step.id.replace('org-level', '')));
                }
                return false;
        }
    };
    const isWizardStepComplete = (step: InitialSetupWizardStep) => {
        return hasMeaningfulWizardStepData(step);
    };
    const wizardStepTextClass = (step: InitialSetupWizardStep) => (
        isWizardStepComplete(step) ? 'text-slate-950' : wizardCategoryTextClass[step.category]
    );
    const wizardStepMenuItemClass = (step: InitialSetupWizardStep, index: number) => [
        'grid w-full grid-cols-[14px_24px_minmax(0,1fr)] items-start gap-1.5 px-3 py-2 text-left text-xs font-semibold leading-4 transition hover:bg-orange-50',
        wizardStepTextClass(step),
        index === currentStep ? 'bg-slate-100' : 'bg-white',
    ].join(' ');
    const markWizardStepComplete = (stepId: string) => {
        setCompletedWizardStepIds((current) => {
            const next = new Set(current);
            next.add(stepId);
            if (typeof window !== 'undefined') {
                safeSetWizardLocalStorage(initialSetupWizardCompletedStepsStorageKey, JSON.stringify(Array.from(next)));
            }
            return next;
        });
    };
    const clearWizardStepCompletions = () => {
        setCompletedWizardStepIds(new Set());
        if (typeof window !== 'undefined') window.localStorage.removeItem(initialSetupWizardCompletedStepsStorageKey);
    };
    const syncWizardStepToSettings = (stepId: string) => {
        if (isSetupTestMode) {
            saveSetupTestWizardDrafts(false);
            return;
        }
        if (stepId === 'units-today') {
            saveOrganisationDraft({
                preserveWizardDraft: true,
                message: 'Organisation draft synced into Settings.',
            });
            saveWizardUnitRowsDraft('Unit list synced into Settings.');
            return;
        }
        if (isOrganisationWizardStep(stepId)) {
            saveOrganisationDraft({
                preserveWizardDraft: true,
                message: 'Organisation draft synced into Settings.',
            });
            return;
        }
        if (stepId === 'locations-today') {
            saveWizardLocationRowsDraft();
            return;
        }
        if (stepId === 'location-details') {
            saveLocationDraft();
            return;
        }
        if (stepId === 'unit-model') {
            saveUnitDraft();
            saveWizardSupplementaryDrafts('Unit setup synced into Settings.');
            return;
        }
        if (stepId === 'unit-modules') {
            saveUnitDraft();
            saveUnitModulesDraft();
            return;
        }
        if (stepId === 'ranks-labels') {
            saveRankSettingsDraft();
            return;
        }
        if (stepId === 'crew-roles') {
            saveCrewRolesDraft();
            return;
        }
        if (stepId === 'resource-sharing') {
            saveResourceSharingDraft();
            return;
        }
        if (stepId === 'resource-aircraft' || stepId === 'resource-counts') {
            saveResourceDraft();
            return;
        }
        if (stepId === 'crew') {
            saveCrewDraft();
            return;
        }
        if (stepId === 'master-lmp') {
            saveTrainingDraft();
            return;
        }
        if (stepId === 'access') {
            setSaveMessage('User permissions are managed directly in Settings.');
            return;
        }
        if ([
            'aircraft-configs',
            'callsigns',
            'advanced-scheduling-rules',
            'deployment-readiness',
            'operational-runbook',
            'licensing',
        ].includes(stepId)) {
            setSaveMessage('This step uses the same Settings records directly. Use Edit and Save in this section after making changes.');
            return;
        }
        if (stepId === 'build-rules') {
            saveBuildRulesDraft();
            return;
        }
        if (stepId === 'training-records') {
            saveTrainingRecordsDraft();
            return;
        }
        if (stepId === 'currencies') {
            saveCurrencyProfilesDraft();
            return;
        }
        if (stepId === 'scoring') {
            saveScoringMatrixDraft();
            return;
        }
        if (stepId === 'staff-currency-events') {
            saveStaffCurrencyEventsDraft();
            return;
        }
        if (stepId !== 'analysis' && stepId !== 'review') {
            saveWizardSupplementaryDrafts();
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        safeSetWizardLocalStorage(initialSetupWizardStorageKey, String(currentStep));
        pushWizardOrgDiag('wizard:step-rendered', {
            step: visibleStep?.id,
            currentStep,
            draft: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
            dirty: organisationDraftDirtyRef.current,
            storedDraft: readStoredOrganisationDraft(),
        });
    }, [currentStep]);

    useEffect(() => {
        setWizardStep((step) => Math.min(step, steps.length - 1));
    }, [steps.length]);

    useEffect(() => {
        if (mode === 'detect' && !isPartiallyConfigured) {
            setMode('active');
        }
    }, [isPartiallyConfigured, mode]);

    const selectTemplateFile = (templateId: string) => {
        setPendingTemplateId(templateId);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fileInputRef.current?.click();
    };

    const handleTemplateFile = async (templateId: string, file?: File | null) => {
        if (!file) return;
        const template = initialSetupTemplates.find((item) => item.id === templateId);
        if (!template) return;
        setImportConfirmations((current) => {
            const next = { ...current };
            delete next[templateId];
            return next;
        });
        setUploadResults((current) => ({
            ...current,
            [templateId]: { status: 'idle', fileName: file.name, message: `Checking ${file.name}...` },
        }));
        try {
            const result = await validateWizardTemplateFile(template, file);
            setUploadResults((current) => ({ ...current, [templateId]: result }));
            pushWizardImportDiag('template:validated', {
                templateId,
                fileName: file.name,
                status: result.status,
                headers: result.headers || [],
                dataRows: result.dataRows?.length || 0,
                issues: result.issues || [],
            });
            if (template.id === 'courses') {
                pushWizardLmpDiag('upload:validated', {
                    templateId,
                    fileName: file.name,
                    status: result.status,
                    headers: result.headers || [],
                    dataRows: result.dataRows?.length || 0,
                    issues: result.issues || [],
                    sampleRows: (result.dataRows || []).slice(0, 5),
                });
            }
            if (result.status === 'valid' && ['staff', 'trainees', 'courses', 'scoring'].includes(template.id)) {
                importWizardTemplateRows(template, result);
            }
        } catch (error: any) {
            pushWizardImportDiag('template:error', {
                templateId,
                fileName: file.name,
                message: error?.message || 'Unknown upload error',
            });
            if (template.id === 'courses') {
                pushWizardLmpDiag('upload:error', {
                    templateId,
                    fileName: file.name,
                    message: error?.message || 'Unknown upload error',
                });
            }
            setUploadResults((current) => ({
                ...current,
                [templateId]: {
                    status: 'error',
                    fileName: file.name,
                    message: `I could not read ${file.name}.`,
                    issues: [error?.message || 'Try saving the file as CSV or XLSX and upload it again.'],
                },
            }));
        }
    };

    const parseWizardTemplateList = (value: string): string[] => String(value || '')
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);

    const parseWizardTemplateNumber = (value: string, fallback = 0): number => {
        const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const normaliseWizardTemplateEventType = (value: string): SyllabusItemDetail['type'] => {
        const clean = String(value || '').trim().toLowerCase();
        if (clean.includes('ftd') || clean.includes('sim')) return 'FTD';
        if (clean.includes('academic')) return 'Academics';
        if (clean.includes('ground')) return 'Ground School';
        return 'Flight';
    };

    const buildWizardCourseUploadItems = (result: InitialSetupWizardUploadResult): SyllabusItemDetail[] => {
        const headers = result.headers || [];
        const defaultMasterLmp = String(trainingDraft.lmpCode || trainingDraft.lmpName || '').trim();
        return (result.dataRows || []).map((row, index) => {
            const code = getWizardCellByHeader(headers, row, 'Event Code');
            const title = getWizardCellByHeader(headers, row, 'Event Title') || code;
            const masterLmp = getWizardCellByHeader(headers, row, 'Master LMP') || defaultMasterLmp || 'Master LMP';
            const courses = parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Courses', 'Course', 'Package']))
                .filter(Boolean);
            const itemCourses = courses.length > 0 ? courses : [masterLmp];
            const eventType = normaliseWizardTemplateEventType(getWizardCellByHeader(headers, row, 'Type'));
            const durationValue = getWizardCellByHeader(headers, row, 'Duration Minutes');
            const duration = parseWizardTemplateNumber(durationValue, 0);
            return {
                id: `setup-lmp-${normaliseUnitSettingsIdentifier(masterLmp).replace(/[^A-Z0-9]+/g, '-')}-${normaliseUnitSettingsIdentifier(code).replace(/[^A-Z0-9]+/g, '-')}-${index + 1}`,
                code,
                phase: getWizardCellByHeader(headers, row, 'Phase') || masterLmp,
                module: getWizardCellByHeader(headers, row, 'Module') || masterLmp,
                dayNight: (getWizardCellByAnyHeader(headers, row, ['Day Night', 'Day/Night']) || 'Day') as SyllabusItemDetail['dayNight'],
                eventDescription: title,
                prerequisites: parseWizardTemplateList(getWizardCellByHeader(headers, row, 'Prerequisites')),
                prerequisitesGround: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Prerequisites Ground', 'Ground Prerequisites'])),
                prerequisitesFlying: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Prerequisites Flying', 'Flying Prerequisites'])),
                eventDetailsCommon: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Event Details Common', 'Common Details'])),
                eventDetailsSortie: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Event Details Sortie', 'Sortie Details', 'Event Title'])),
                totalEventHours: parseWizardTemplateNumber(getWizardCellByAnyHeader(headers, row, ['Total Event Hours', 'Total Hours']), duration),
                flightOrSimHours: parseWizardTemplateNumber(getWizardCellByAnyHeader(headers, row, ['Flight Or Sim Hours', 'Flight/Sim Hours', 'Flight Sim Hours']), eventType === 'Flight' || eventType === 'FTD' ? duration : 0),
                duration,
                preFlightTime: parseWizardTemplateNumber(getWizardCellByAnyHeader(headers, row, ['Pre Flight Time', 'Pre Flight Minutes']), 0),
                postFlightTime: parseWizardTemplateNumber(getWizardCellByAnyHeader(headers, row, ['Post Flight Time', 'Post Flight Minutes']), 0),
                type: eventType,
                sortieType: (getWizardCellByAnyHeader(headers, row, ['Sortie Type', 'Dual/Solo']) || undefined) as SyllabusItemDetail['sortieType'],
                twrDiReqd: (getWizardCellByAnyHeader(headers, row, ['Twr Di Reqd', 'TWR DI Required']) || 'NO') as SyllabusItemDetail['twrDiReqd'],
                cctOnly: (getWizardCellByAnyHeader(headers, row, ['Cct Only', 'CCT Only']) || 'NO') as SyllabusItemDetail['cctOnly'],
                methodOfDelivery: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Method Of Delivery', 'Delivery Method'])),
                methodOfAssessment: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Method Of Assessment', 'Assessment Method'])),
                resourcesPhysical: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Resources Physical', 'Aircraft Type', 'Resource'])),
                resourcesHuman: parseWizardTemplateList(getWizardCellByAnyHeader(headers, row, ['Resources Human', 'Crew Required'])),
                location: getWizardCellByHeader(headers, row, 'Location') || locationDraft.code || unitDraft.locationCode || '',
                unit: getWizardCellByHeader(headers, row, 'Unit') || unitDraft.code || '',
                courses: itemCourses,
                lmpType: (getWizardCellByAnyHeader(headers, row, ['Lmp Type', 'LMP Type']) || 'Master LMP') as SyllabusItemDetail['lmpType'],
                sortOrder: index + 1,
                notes: getWizardCellByHeader(headers, row, 'Notes'),
            };
        }).filter((item) => item.code && item.eventDescription);
    };

    const importWizardTemplateRows = (template: InitialSetupWizardTemplate, result?: InitialSetupWizardUploadResult) => {
        if (!result || result.status !== 'valid' || !result.headers || !result.dataRows) return;
        if (template.id === 'staff') {
            const importedRows = result.dataRows.map((row) => {
                const headers = result.headers || [];
                const sourceTemplateData = getWizardSourceRowObject(headers, row);
                const nameValue = getWizardCellByHeader(headers, row, 'Name');
                const surnameValue = getWizardCellByAnyHeader(headers, row, ['Surname', 'Last Name', 'Family Name']);
                const givenValue = getWizardCellByAnyHeader(headers, row, ['Given Names', 'Given Name', 'First Name', 'Forename']);
                const [surnamePart, givenPart] = nameValue.includes(',')
                    ? nameValue.split(',').map((part) => part.trim())
                    : ['', nameValue.trim()];
                return {
                    sourceTemplateData,
                    surname: surnameValue || surnamePart || '',
                    givenNames: givenValue || givenPart || '',
                    unit: (getWizardCellByHeader(headers, row, 'Unit') || unitDraft.code || '').toUpperCase(),
                    position: getWizardCellByHeader(headers, row, 'Role'),
                    qualifications: getWizardCellByHeader(headers, row, 'Qualifications'),
                    rank: getWizardCellByHeader(headers, row, 'Rank'),
                    personnelId: getWizardCellByAnyHeader(headers, row, ['Personnel ID', 'Employee ID', 'Service ID']),
                    email: getWizardCellByHeader(headers, row, 'Email'),
                    phoneNumber: getWizardCellByAnyHeader(headers, row, ['Phone', 'Phone Number', 'Mobile', 'Mobile Number']),
                    location: getWizardCellByAnyHeader(headers, row, ['Location', 'Base', 'Home Location', 'Airfield']),
                    category: getWizardCellByHeader(headers, row, 'Category'),
                    callsign: getWizardCellByHeader(headers, row, 'Callsign'),
                    secondaryCallsign: getWizardCellByAnyHeader(headers, row, ['Secondary Callsign', 'Alt Callsign']),
                    callsignNumber: getWizardCellByAnyHeader(headers, row, ['Callsign Number', 'Callsign No', 'Callsign No.']),
                    crew: getWizardCellByHeader(headers, row, 'Crew'),
                    flight: getWizardCellByHeader(headers, row, 'Flight'),
                    seatConfig: getWizardCellByAnyHeader(headers, row, ['Seat Config', 'Seat Configuration', 'Config']),
                    isAdminStaff: /^(yes|true|y|1)$/i.test(getWizardCellByAnyHeader(headers, row, ['Admin Staff', 'Administration Staff'])),
                };
            }).filter((row) => row.surname || row.givenNames || row.unit || row.position || row.personnelId || row.qualifications);
            const nextStaffDraft = formatWizardStaffRows(importedRows);
            setStaffDraft(nextStaffDraft);
            setUploadedStaffProfileRows(importedRows);
            pushWizardImportDiag('staff:imported-to-draft', {
                importedRows: importedRows.length,
                sample: importedRows.slice(0, 8),
                draftLength: nextStaffDraft.length,
            });
            if (isSetupTestMode) {
                saveSetupTestWizardDrafts(false, { staffDraft: nextStaffDraft, staffRows: importedRows });
            }
            const message = isSetupTestMode
                ? `Committed ${importedRows.length} uploaded staff profile${importedRows.length === 1 ? '' : 's'} to Staff Profiles in this setup.`
                : `Imported ${importedRows.length} staff row${importedRows.length === 1 ? '' : 's'} into the wizard staff list.`;
            setImportConfirmations((current) => ({ ...current, [template.id]: message }));
            setSaveMessage(message);
            return;
        }
        if (template.id === 'trainees') {
            const importedRows = result.dataRows.map((row) => {
                const headers = result.headers || [];
                const sourceTemplateData = getWizardSourceRowObject(headers, row);
                const nameValue = getWizardCellByHeader(headers, row, 'Name');
                const surnameValue = getWizardCellByAnyHeader(headers, row, ['Surname', 'Last Name', 'Family Name']);
                const givenValue = getWizardCellByAnyHeader(headers, row, ['Given Names', 'Given Name', 'First Name', 'Forename']);
                const [surnamePart, givenPart] = nameValue.includes(',')
                    ? nameValue.split(',').map((part) => part.trim())
                    : ['', nameValue.trim()];
                return {
                    sourceTemplateData,
                    surname: surnameValue || surnamePart || '',
                    givenNames: givenValue || givenPart || '',
                    unit: (getWizardCellByHeader(headers, row, 'Unit') || unitDraft.code || '').toUpperCase(),
                    rank: getWizardCellByHeader(headers, row, 'Rank'),
                    personnelId: getWizardCellByAnyHeader(headers, row, ['Personnel ID', 'Employee ID', 'Service ID']),
                    courseNumber: getWizardCellByHeader(headers, row, 'Course Number'),
                    course: getWizardCellByHeader(headers, row, 'Course'),
                    masterLmp: getWizardCellByHeader(headers, row, 'Master LMP'),
                    startDate: getWizardCellByHeader(headers, row, 'Start Date'),
                    email: getWizardCellByHeader(headers, row, 'Email'),
                    phoneNumber: getWizardCellByAnyHeader(headers, row, ['Phone', 'Phone Number', 'Mobile', 'Mobile Number']),
                    location: getWizardCellByAnyHeader(headers, row, ['Location', 'Base', 'Home Location', 'Airfield']),
                    category: getWizardCellByHeader(headers, row, 'Category'),
                    callsign: getWizardCellByHeader(headers, row, 'Callsign'),
                    seatConfig: getWizardCellByAnyHeader(headers, row, ['Seat Config', 'Seat Configuration', 'Config']),
                };
            }).filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.masterLmp || row.startDate);
            const baseRows = traineeAllocationCommitted
                ? (uploadedTraineeProfileRows.length > 0 ? uploadedTraineeProfileRows : parseWizardTraineeRows(traineeDraft))
                : [];
            const nextImportedRows = [...baseRows, ...importedRows];
            const nextTraineeDraft = formatWizardTraineeRows(nextImportedRows);
            setTraineeDraft(nextTraineeDraft);
            setUploadedTraineeProfileRows(nextImportedRows);
            const importedCourseOptions = Array.from(new Set(nextImportedRows
                .flatMap((row) => [row.course, row.courseNumber])
                .map((value) => String(value || '').trim())
                .filter(Boolean)));
            if (importedCourseOptions.length > 0) {
                setTraineeCourseOptionsDraft((current) => {
                    const merged = Array.from(new Set([
                        ...parseWizardLineItems(current),
                        ...importedCourseOptions,
                    ].map((item) => String(item || '').trim()).filter(Boolean)));
                    return merged.join('\n');
                });
            }
            setTraineeAllocationCommitted(false);
            setShowMoreTraineesPrompt(false);
            setUnitDraft((draft) => ({ ...draft, hasTrainees: true }));
            const message = `Loaded ${importedRows.length} trainee row${importedRows.length === 1 ? '' : 's'} for course allocation. Select a course for every trainee, then commit them to Trainee Profiles.`;
            setImportConfirmations((current) => ({ ...current, [template.id]: message }));
            setSaveMessage(message);
            return;
        }
        if (template.id === 'courses') {
            const importedItems = buildWizardCourseUploadItems(result);
            pushWizardLmpDiag('upload:parsed-items', {
                headers: result.headers,
                inputRows: result.dataRows.length,
                parsedItems: importedItems.length,
                parsedSample: importedItems.slice(0, 12).map((item) => ({
                    id: item.id,
                    code: item.code,
                    title: item.eventDescription,
                    courses: item.courses,
                    type: item.type,
                    duration: item.duration,
                    unit: item.unit,
                    location: item.location,
                    sortOrder: item.sortOrder,
                })),
                firstRawRows: result.dataRows.slice(0, 5),
            });
            if (importedItems.length === 0) {
                const message = 'The LMP file passed the column check, but I could not find any rows with both an event code and an event title/description.';
                setImportConfirmations((current) => ({ ...current, [template.id]: message }));
                setSaveMessage(message);
                pushWizardImportDiag('courses:no-importable-events', {
                    headers: result.headers,
                    dataRows: result.dataRows.length,
                    sampleRows: result.dataRows.slice(0, 5),
                });
                pushWizardLmpDiag('upload:no-importable-events', {
                    message,
                    headers: result.headers,
                    sampleRows: result.dataRows.slice(0, 5),
                });
                return;
            }
            const uploadedMasterLmp = importedItems[0]?.courses?.[0] || trainingDraft.lmpCode || trainingDraft.lmpName || 'Master LMP';
            const cleanLmpCode = String(trainingDraft.lmpCode || uploadedMasterLmp).trim();
            const cleanLmpName = String(trainingDraft.lmpName || uploadedMasterLmp || cleanLmpCode).trim();
            const scopedItems = importedItems.map((item) => ({
                ...item,
                courses: [cleanLmpCode],
            }));
            setTrainingDraft((draft) => ({
                ...draft,
                lmpCode: cleanLmpCode,
                lmpName: cleanLmpName,
            }));
            setUploadedCourseLmpItems(scopedItems);
            pushWizardImportDiag('courses:loaded-for-commit', {
                importedItems: scopedItems.length,
                lmpCode: cleanLmpCode,
                sample: scopedItems.slice(0, 8).map((item) => ({ code: item.code, title: item.eventDescription, type: item.type, courses: item.courses })),
            });
            pushWizardLmpDiag('upload:staged-for-commit', {
                importedItems: scopedItems.length,
                cleanLmpCode,
                cleanLmpName,
                stagedSample: scopedItems.slice(0, 12).map((item) => ({
                    id: item.id,
                    code: item.code,
                    title: item.eventDescription,
                    courses: item.courses,
                    type: item.type,
                    duration: item.duration,
                    unit: item.unit,
                    location: item.location,
                    sortOrder: item.sortOrder,
                })),
            });
            const message = `Loaded ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} for ${cleanLmpCode}. Click “Commit uploaded LMP events” to add them to this setup.`;
            setImportConfirmations((current) => ({ ...current, [template.id]: message }));
            setSaveMessage(message);
            return;
        }
        if (template.id === 'scoring') {
            const importedRows = result.dataRows.map((row) => ({
                dimension: getWizardCellByHeader(result.headers || [], row, 'Dimension'),
                passStandard: getWizardCellByHeader(result.headers || [], row, 'Pass Standard'),
                failStandard: getWizardCellByHeader(result.headers || [], row, 'Fail Standard'),
                grade0: getWizardCellByHeader(result.headers || [], row, 'Grade 0'),
                grade1: getWizardCellByHeader(result.headers || [], row, 'Grade 1'),
                grade2: getWizardCellByHeader(result.headers || [], row, 'Grade 2'),
                grade3: getWizardCellByHeader(result.headers || [], row, 'Grade 3'),
                grade4: getWizardCellByHeader(result.headers || [], row, 'Grade 4'),
                grade5: getWizardCellByHeader(result.headers || [], row, 'Grade 5'),
            })).filter((row) => row.dimension || row.passStandard || row.failStandard);
            const importedDraft = formatWizardScoringRows(importedRows);
            setScoringDraft(importedDraft);
            setWizardScoringPhraseBank(wizardScoringRowsToPhraseBank(importedDraft));
            const message = `Imported ${importedRows.length} scoring matrix row${importedRows.length === 1 ? '' : 's'} into the wizard. Click Next to sync it into Settings.`;
            setImportConfirmations((current) => ({ ...current, [template.id]: message }));
            setSaveMessage(message);
            return;
        }
        setSaveMessage(`${template.label} passed validation. Import for this template step has not been added yet.`);
    };

    const resetWizard = () => {
        pushWizardOrgDiag('wizard:reset', {
            draftBeforeReset: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
        });
        organisationDraftDirtyRef.current = false;
        locationDraftDirtyRef.current = false;
        unitDraftDirtyRef.current = false;
        resourceDraftDirtyRef.current = false;
        crewDraftDirtyRef.current = false;
        accessDraftDirtyRef.current = false;
        trainingDraftDirtyRef.current = false;
        if (typeof window !== 'undefined') window.localStorage.removeItem(initialSetupWizardOrganisationDraftStorageKey);
        hydrateWizardDraftsFromSettings('start-again');
        setWizardStep(0);
        setMode('active');
        setUploadResults({});
        safeSetWizardLocalStorage(initialSetupWizardStorageKey, '0');
        clearWizardStepCompletions();
    };

    const resumeWizard = () => {
        hydrateWizardDraftsFromSettings('resume');
        setMode('active');
        setWizardStep((step) => Math.min(Math.max(0, step), steps.length - 1));
    };

    const wizardChoiceClass = 'rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900';
    const wizardSmallButtonClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900';
    const wizardPrimaryButtonClass = 'rounded-md bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600';
    const wizardInputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200';
    const wizardLabelClass = 'text-[10px] font-black uppercase tracking-[0.14em] text-slate-500';
    const updateLocationDraft = (updater: React.SetStateAction<typeof locationDraft>) => {
        locationDraftDirtyRef.current = true;
        setLocationDraft(updater);
    };
    const updateUnitDraft = (updater: React.SetStateAction<typeof unitDraft>) => {
        unitDraftDirtyRef.current = true;
        setUnitDraft(updater);
    };
    const updateResourceDraft = (updater: React.SetStateAction<typeof resourceDraft>) => {
        resourceDraftDirtyRef.current = true;
        setResourceDraft(updater);
    };
    const updateCrewDraft = (updater: React.SetStateAction<typeof crewDraft>) => {
        crewDraftDirtyRef.current = true;
        setCrewDraft(updater);
    };
    const updateAccessDraft = (updater: React.SetStateAction<typeof accessDraft>) => {
        accessDraftDirtyRef.current = true;
        setAccessDraft(updater);
    };
    const updateTrainingDraft = (updater: React.SetStateAction<typeof trainingDraft>) => {
        trainingDraftDirtyRef.current = true;
        setTrainingDraft(updater);
    };
    const updateUnitModulesDraft = (value: string) => {
        unitModulesDraftDirtyRef.current = true;
        setUnitModulesDraft(value);
    };
    const updateRankSettingsDraft = (updater: React.SetStateAction<typeof rankSettingsDraft>) => {
        rankSettingsDraftDirtyRef.current = true;
        setRankSettingsDraft(updater);
    };
    const wizardField = (
        label: string,
        value: string,
        onChange: (value: string) => void,
        options?: string[],
        placeholder?: string,
    ) => (
        <label className="block">
            <span className={wizardLabelClass}>{label}</span>
            {options ? (
                <select
                    className={`${wizardInputClass} mt-1`}
                    value={value}
                    onKeyDownCapture={stopEditableKeyPropagation}
                    onKeyDown={stopEditableKeyPropagation}
                    onChange={(event) => onChange(event.target.value)}
                >
                    {Array.from(new Set([value, ...options].filter(Boolean))).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
            ) : (
                <input
                    className={`${wizardInputClass} mt-1`}
                    value={value}
                    placeholder={placeholder}
                    onKeyDown={stopEditableKeyPropagation}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </label>
    );
    const wizardDataListField = (
        label: string,
        value: string,
        onChange: (value: string) => void,
        options: string[],
        placeholder?: string,
        listKey?: string,
    ) => {
        const listId = `wizard-${(listKey || label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return (
            <label className="block">
                <span className={wizardLabelClass}>{label}</span>
                <input
                    className={`${wizardInputClass} mt-1`}
                    value={value}
                    list={listId}
                    placeholder={placeholder}
                    onKeyDown={stopEditableKeyPropagation}
                    onChange={(event) => onChange(event.target.value)}
                />
                <datalist id={listId}>
                    {Array.from(new Set(options.filter(Boolean))).map((option) => <option key={option} value={option} />)}
                </datalist>
            </label>
        );
    };
    const updateWizardLocationRow = (rowIndex: number, field: 'icao' | 'iata' | 'name', value: string) => {
        const rows = parseWizardLocationRows(locationsTodayDraft);
        const nextRows = rows.length > 0 ? [...rows] : [{ icao: '', iata: '', name: '' }];
        while (nextRows.length <= rowIndex) nextRows.push({ icao: '', iata: '', name: '' });
        const formattedValue = field === 'name' ? value : value.toUpperCase();
        const matchedProfile = findWizardLocationProfile(formattedValue);
        nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            [field]: formattedValue,
            ...(matchedProfile ? {
                icao: matchedProfile.icao || nextRows[rowIndex].icao,
                iata: matchedProfile.iata || nextRows[rowIndex].iata,
                name: matchedProfile.name || nextRows[rowIndex].name,
            } : {}),
        };
        setLocationsTodayDraft(formatWizardLocationRows(nextRows));
    };
    const renderCrewCompositionEditor = (
        title: string,
        value: string,
        onChange: (value: string) => void,
        addLabel = 'Add crew role',
    ) => {
        const rows = parseRoleRequirementsText(value);
        const editableRows = rows.length > 0 ? rows : [{ role: 'Pilot', count: 1 }];
        return (
            <div className="rounded-lg border border-slate-300 bg-white p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={wizardLabelClass}>{title}</span>
                    <button type="button" className={wizardSmallButtonClass} onClick={() => onChange(formatRoleRequirementsText([...editableRows, { role: 'Crew', count: 1 }]))}>
                        {addLabel}
                    </button>
                </div>
                <div className="space-y-2">
                    {editableRows.map((row, index) => (
                        <div key={`${title}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_100px_74px] md:items-end">
                            {wizardField('Crew role', row.role || '', (nextValue) => onChange(updateWizardRoleRequirementText(value, index, 'role', nextValue)), getWizardCrewRoleOptions(value), 'Pilot')}
                            {wizardField('How many', String(row.count ?? 1), (nextValue) => onChange(updateWizardRoleRequirementText(value, index, 'count', nextValue)), undefined, '1')}
                            <button type="button" className={wizardSmallButtonClass} onClick={() => onChange(removeWizardRoleRequirementText(value, index))}>
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    const renderCrewLabelsEditor = () => {
        const rows = parseWizardCrewLabelRows(crewLabelsDraft);
        const editableRows = rows.length > 0 ? rows : [{ term: 'Pilot', label: 'Pilot' }];
        return (
            <div className="rounded-lg border border-slate-300 bg-white p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={wizardLabelClass}>Words shown to users</span>
                    <button type="button" className={wizardSmallButtonClass} onClick={() => setCrewLabelsDraft(formatWizardCrewLabelRows([...editableRows, { term: 'Crew', label: 'Crew' }]))}>
                        Add label
                    </button>
                </div>
                <div className="space-y-2">
                    {editableRows.map((row, index) => (
                        <div key={`crew-label-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_74px] md:items-end">
                            {wizardField('DFP NEO role', row.term || '', (nextValue) => {
                                const nextRows = [...editableRows];
                                nextRows[index] = { ...nextRows[index], term: nextValue };
                                setCrewLabelsDraft(formatWizardCrewLabelRows(nextRows));
                            }, undefined, 'PIC')}
                            {wizardField('Label users see', row.label || '', (nextValue) => {
                                const nextRows = [...editableRows];
                                nextRows[index] = { ...nextRows[index], label: nextValue };
                                setCrewLabelsDraft(formatWizardCrewLabelRows(nextRows));
                            }, undefined, 'Aircraft Captain')}
                            <button type="button" className={wizardSmallButtonClass} onClick={() => setCrewLabelsDraft(formatWizardCrewLabelRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    const renderCrewRolesEditor = () => {
        const rows = parseWizardCrewRoleRows(crewRolesDraft);
        const editableRows = rows.length > 0
            ? rows
            : [
                { role: 'Pilot', label: 'Pilot', models: OPERATIONAL_MODEL_OPTIONS.map((option) => option.value).join(', ') },
                { role: 'Trainee', label: 'Trainee', models: OPERATIONAL_MODEL_OPTIONS.map((option) => option.value).join(', ') },
            ];
        const updateRow = (index: number, field: 'role' | 'label' | 'models', value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            updateCrewRolesDraft(formatWizardCrewRoleRows(nextRows));
        };
        const toggleModel = (index: number, model: string, enabled: boolean) => {
            const selectedModels = editableRows[index].models
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            const nextModels = enabled
                ? Array.from(new Set([...selectedModels, model]))
                : selectedModels.filter((item) => item !== model);
            updateRow(index, 'models', (nextModels.length > 0 ? nextModels : [model]).join(', '));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold leading-5 text-blue-950">
                    These are the approved crew role names that users can choose later. Add only roles that should appear in crew rules, event setup, and crew selection.
                </div>
                {editableRows.map((row, index) => {
                    const selectedModels = row.models.split(',').map((item) => item.trim()).filter(Boolean);
                    return (
                        <div key={`crew-role-draft-${index}`} className="rounded-lg border border-slate-300 bg-white p-3">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(280px,1.1fr)_74px] lg:items-end">
                                {wizardField('Crew role name', row.role || '', (value) => updateRow(index, 'role', value), undefined, 'Pilot')}
                                {wizardField('Label users see', row.label || row.role || '', (value) => updateRow(index, 'label', value), undefined, row.role || 'Pilot')}
                                <div>
                                    <span className={wizardLabelClass}>Use in models</span>
                                    <div className="mt-1 grid gap-1 rounded-lg border border-slate-300 bg-slate-50 p-2 sm:grid-cols-2">
                                        {OPERATIONAL_MODEL_OPTIONS.map((option) => {
                                            const checked = selectedModels.length === 0 || selectedModels.includes(option.value);
                                            return (
                                                <label key={`${row.role}-${option.value}`} className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        className="h-3.5 w-3.5 rounded border-slate-400 accent-cyan-500"
                                                        checked={checked}
                                                        onChange={(event) => toggleModel(index, option.value, event.target.checked)}
                                                    />
                                                    <span>{option.label.replace(' Model', '')}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button type="button" className={wizardSmallButtonClass} onClick={() => updateCrewRolesDraft(formatWizardCrewRoleRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })}
                <button type="button" className={wizardSmallButtonClass} onClick={() => updateCrewRolesDraft(formatWizardCrewRoleRows([...editableRows, { role: '', label: '', models: OPERATIONAL_MODEL_OPTIONS.map((option) => option.value).join(', ') }]))}>
                    Add crew role
                </button>
            </div>
        );
    };
    const renderStaffEditor = () => {
        const rows = parseWizardStaffRows(staffDraft);
        const editableRows = rows.length > 0 ? rows : [{ surname: '', givenNames: '', unit: unitDraft.code || '', position: '', personnelId: '', qualifications: '' }];
        const updateStaffRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setStaffDraft(formatWizardStaffRows(nextRows));
            setUploadedStaffProfileRows((current) => {
                if (!current[index]) return current;
                const next = [...current];
                next[index] = { ...next[index], [field]: field === 'unit' ? value.toUpperCase() : value };
                return next;
            });
        };
        const unitOptions = Array.from(new Set([
            unitDraft.code,
            ...parseWizardUnitRows(unitsTodayDraft).map((unit) => unit.code),
            ...activeUnits.map((unit: any) => String(unit.code || '')),
        ].filter(Boolean)));
        return (
            <div className="space-y-3">
                {editableRows.map((row, index) => (
                    <div key={`staff-row-${index}`} className="rounded-lg border border-slate-300 bg-white p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className={wizardLabelClass}>Staff member {index + 1}</span>
                            <button type="button" className={wizardSmallButtonClass} onClick={() => {
                                setStaffDraft(formatWizardStaffRows(editableRows.filter((_, rowIndex) => rowIndex !== index)));
                                setUploadedStaffProfileRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                            }}>
                                Delete
                            </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                            {wizardField('Surname', row.surname || '', (value) => updateStaffRow(index, 'surname', value), undefined, 'Surname')}
                            {wizardField('Given names', row.givenNames || '', (value) => updateStaffRow(index, 'givenNames', value), undefined, 'First')}
                            {wizardDataListField('Unit', row.unit || '', (value) => updateStaffRow(index, 'unit', value.toUpperCase()), unitOptions, unitDraft.code || 'UNIT-01', `staff-unit-${index}`)}
                            {wizardField('Position', row.position || '', (value) => updateStaffRow(index, 'position', value), undefined, 'Pilot')}
                            {wizardField('Personnel ID', row.personnelId || '', (value) => updateStaffRow(index, 'personnelId', value), undefined, '4000001')}
                            {wizardField('Qualifications', row.qualifications || '', (value) => updateStaffRow(index, 'qualifications', value), undefined, 'Qualification')}
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    className={wizardSmallButtonClass}
                    onClick={() => {
                        setStaffDraft(formatWizardStaffRows([...editableRows, { surname: '', givenNames: '', unit: unitDraft.code || '', position: '', personnelId: '', qualifications: '' }]));
                        setUploadedStaffProfileRows((current) => current.length > 0 ? [...current, { unit: unitDraft.code || '' }] : current);
                    }}
                >
                    Add staff member
                </button>
            </div>
        );
    };
    const renderTraineeEditor = (mode: 'courses' | 'details' | 'allocation' = 'details') => {
        const rows = parseWizardTraineeRows(traineeDraft);
        const editableRows = rows.length > 0 ? rows : [{ surname: '', givenNames: '', unit: unitDraft.code || '', rank: '', personnelId: '', courseNumber: '', course: '', masterLmp: '', startDate: '' }];
        const updateTraineeRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setTraineeDraft(formatWizardTraineeRows(nextRows));
            setTraineeAllocationCommitted(false);
            setShowMoreTraineesPrompt(false);
            setUploadedTraineeProfileRows((current) => {
                if (!current[index]) return current;
                const next = [...current];
                next[index] = { ...next[index], [field]: field === 'unit' ? value.toUpperCase() : value };
                return next;
            });
        };
        const unitOptions = Array.from(new Set([
            unitDraft.code,
            ...parseWizardUnitRows(unitsTodayDraft).map((unit) => unit.code),
            ...activeUnits.map((unit: any) => String(unit.code || '')),
        ].filter(Boolean)));
        const traineeCourseRows = traineeCourseInputRows.length > 0 ? traineeCourseInputRows : [''];
        const courseOptions = Array.from(new Set(traineeCourseRows.map((item) => String(item || '').trim()).filter(Boolean)));
        const persistCourseRows = (rows: string[]) => {
            setTraineeCourseInputRows(rows.length > 0 ? rows : ['']);
            setTraineeCourseOptionsDraft(rows.map((course) => String(course || '').trim()).filter(Boolean).join('\n'));
        };
        const updateCourseOption = (index: number, value: string) => {
            const nextCourses = [...traineeCourseRows];
            nextCourses[index] = value;
            persistCourseRows(nextCourses);
            setTraineeAllocationCommitted(false);
            setShowMoreTraineesPrompt(false);
        };
        const removeCourseOption = (index: number) => {
            const removedCourse = traineeCourseRows[index];
            const nextCourses = traineeCourseRows.filter((_, rowIndex) => rowIndex !== index);
            persistCourseRows(nextCourses);
            setTraineeAllocationCommitted(false);
            setShowMoreTraineesPrompt(false);
            if (removedCourse) {
                const nextRows = editableRows.map((row) => row.course === removedCourse ? { ...row, course: '' } : row);
                setTraineeDraft(formatWizardTraineeRows(nextRows));
                setUploadedTraineeProfileRows((current) => current.map((row) => row.course === removedCourse ? { ...row, course: '' } : row));
            }
        };
        const assignAllToCourse = (course: string) => {
            const nextRows = editableRows.map((row) => ({ ...row, course }));
            setTraineeDraft(formatWizardTraineeRows(nextRows));
            setTraineeAllocationCommitted(false);
            setShowMoreTraineesPrompt(false);
            setUploadedTraineeProfileRows((current) => (
                current.length > 0 ? current.map((row) => ({ ...row, course })) : current
            ));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    {mode === 'courses'
                        ? 'Create the course numbers or names first. These become the only choices available when trainees are allocated after upload.'
                        : mode === 'details'
                            ? 'Upload the trainee template or add trainees manually here. Course allocation happens on the next step.'
                            : 'Allocate every trainee to one of the active courses. DFP-NEO will not commit trainees to Trainee Profiles until every trainee has a course selected.'}
                </div>
                {mode === 'courses' ? (
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className={wizardLabelClass}>Active courses for this unit</span>
                            <span className="text-xs font-semibold text-slate-500">{courseOptions.length} course{courseOptions.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="space-y-2">
                            {(traineeCourseRows.length > 0 ? traineeCourseRows : ['']).map((course, index) => (
                                <div key={`trainee-course-option-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                    {wizardField(`Course ${index + 1}`, course, (value) => updateCourseOption(index, value), undefined, index === 0 ? 'Course 1' : 'Course 2')}
                                    <button
                                        type="button"
                                        className={wizardSmallButtonClass}
                                        onClick={() => removeCourseOption(index)}
                                        disabled={traineeCourseRows.length <= 1}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={`${wizardSmallButtonClass} mt-3`}
                            onClick={() => {
                                persistCourseRows([...traineeCourseRows, '']);
                                setTraineeAllocationCommitted(false);
                                setShowMoreTraineesPrompt(false);
                            }}
                        >
                            Add course
                        </button>
                        <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">
                            Add one course per data window. Only these courses will appear in the trainee allocation step.
                        </p>
                    </div>
                ) : null}
                {mode === 'allocation' && courseOptions.length > 0 ? (
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className={wizardLabelClass}>Select all trainees</span>
                            <span className="text-xs font-semibold text-slate-500">{courseOptions.length} course option{courseOptions.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {courseOptions.map((course) => (
                                <button
                                    key={`assign-all-${course}`}
                                    type="button"
                                    className={wizardSmallButtonClass}
                                    onClick={() => assignAllToCourse(course)}
                                >
                                    All to {course}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : mode === 'allocation' ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                        Add at least one active course before committing trainees.
                    </div>
                ) : null}
                {mode === 'allocation' && editableRows.some((row) => !String(row.course || '').trim()) ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                        Some trainees still need a course allocation.
                    </div>
                ) : null}
                {mode === 'allocation' ? <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
                    <table className="min-w-[760px] w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                            <tr>
                                <th className="px-3 py-2">Trainee</th>
                                <th className="px-3 py-2">Unit</th>
                                <th className="px-3 py-2">Rank</th>
                                <th className="px-3 py-2">Course allocation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editableRows.map((row, index) => (
                                <tr key={`trainee-allocation-${index}`} className="border-t border-slate-200">
                                    <td className="px-3 py-2 font-semibold text-slate-900">{[row.surname, row.givenNames].filter(Boolean).join(', ') || `Trainee ${index + 1}`}</td>
                                    <td className="px-3 py-2 text-slate-700">{row.unit || unitDraft.code || 'Not set'}</td>
                                    <td className="px-3 py-2 text-slate-700">{row.rank || 'Not set'}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-2">
                                            {courseOptions.map((course) => (
                                                <label key={`trainee-course-radio-${index}-${course}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                                    <input
                                                        type="radio"
                                                        name={`trainee-course-${index}`}
                                                        checked={row.course === course}
                                                        onChange={() => updateTraineeRow(index, 'course', course)}
                                                    />
                                                    {course}
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div> : null}
                {mode === 'details' ? editableRows.map((row, index) => (
                    <div key={`trainee-row-${index}`} className="rounded-lg border border-slate-300 bg-white p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className={wizardLabelClass}>Trainee {index + 1}</span>
                            <button type="button" className={wizardSmallButtonClass} onClick={() => {
                                setTraineeDraft(formatWizardTraineeRows(editableRows.filter((_, rowIndex) => rowIndex !== index)));
                                setTraineeAllocationCommitted(false);
                                setShowMoreTraineesPrompt(false);
                                setUploadedTraineeProfileRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                            }}>
                                Delete
                            </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {wizardField('Surname', row.surname || '', (value) => updateTraineeRow(index, 'surname', value), undefined, 'Surname')}
                            {wizardField('Given names', row.givenNames || '', (value) => updateTraineeRow(index, 'givenNames', value), undefined, 'First')}
                            {wizardDataListField('Unit', row.unit || '', (value) => updateTraineeRow(index, 'unit', value.toUpperCase()), unitOptions, unitDraft.code || 'UNIT-01', `trainee-unit-${index}`)}
                            {wizardField('Rank', row.rank || '', (value) => updateTraineeRow(index, 'rank', value), undefined, 'Rank')}
                            {wizardField('Personnel ID', row.personnelId || '', (value) => updateTraineeRow(index, 'personnelId', value), undefined, '4000002')}
                            {wizardField('Course number', row.courseNumber || '', (value) => updateTraineeRow(index, 'courseNumber', value), undefined, '1')}
                            {wizardDataListField('Master LMP', row.masterLmp || '', (value) => updateTraineeRow(index, 'masterLmp', value), courseOptions, trainingDraft.lmpCode || 'Master LMP', `trainee-master-lmp-${index}`)}
                            {wizardField('Start date', row.startDate || '', (value) => updateTraineeRow(index, 'startDate', value), undefined, '2026-01-15')}
                        </div>
                    </div>
                )) : null}
                {mode === 'details' ? <button
                    type="button"
                    className={wizardSmallButtonClass}
                    onClick={() => {
                        setTraineeDraft(formatWizardTraineeRows([...editableRows, { surname: '', givenNames: '', unit: unitDraft.code || '', rank: '', personnelId: '', courseNumber: '', course: '', masterLmp: '', startDate: '' }]));
                        setTraineeAllocationCommitted(false);
                        setShowMoreTraineesPrompt(false);
                        setUploadedTraineeProfileRows((current) => current.length > 0 ? [...current, { unit: unitDraft.code || '' }] : current);
                    }}
                >
                    Add trainee
                </button> : null}
            </div>
        );
    };
    const renderTrainingRecordsEditor = () => {
        const rows = parseWizardTrainingReportRows(trainingRecordsDraft);
        const row = rows[0] || { genericName: 'Training Report', organisationName: 'Assessment Form', gradeMin: '0', gradeMax: '5', showNumbers: 'Yes', noGradeOption: 'No', passLabel: 'Satisfactory', failLabel: 'Unsatisfactory' };
        const updateRow = (field: keyof typeof row, value: string) => {
            setTrainingRecordsDraft(formatWizardTrainingReportRows([{ ...row, [field]: value }]));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    This mirrors the Training Reports settings in plain English. It names the report, sets the grade range, and decides what users see when they complete an assessment.
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Generic form name', row.genericName, (value) => updateRow('genericName', value), undefined, 'Training Report')}
                    {wizardField('Organisation form name', row.organisationName, (value) => updateRow('organisationName', value), undefined, 'Assessment Form')}
                    {wizardField('Lowest grade', row.gradeMin, (value) => updateRow('gradeMin', value), undefined, '0')}
                    {wizardField('Highest grade', row.gradeMax, (value) => updateRow('gradeMax', value), undefined, '5')}
                    {wizardField('Show grade numbers', row.showNumbers, (value) => updateRow('showNumbers', value), ['Yes', 'No'])}
                    {wizardField('Include No Grade option', row.noGradeOption, (value) => updateRow('noGradeOption', value), ['No', 'Yes'])}
                    {wizardField('Satisfactory label', row.passLabel, (value) => updateRow('passLabel', value), undefined, 'Satisfactory')}
                    {wizardField('Unsatisfactory label', row.failLabel, (value) => updateRow('failLabel', value), undefined, 'Unsatisfactory')}
                </div>
            </div>
        );
    };
    const renderUnitModulesEditor = () => {
        const configuredRows = parseWizardPipeRows<{ module: string; enabled: string }>(unitModulesDraft, ['module', 'enabled']);
        const moduleNames = Array.from(new Set([
            ...((platformConfig?.modules || []).map((module: any) => String(module?.name || module?.code || '').trim())),
            'DFP',
            'NEO Build',
            'Program Schedule',
            'Training Records',
            'Build Intelligence',
        ].filter(Boolean)));
        const rows = moduleNames.map((module) => {
            const existing = configuredRows.find((row) => normaliseUnitSettingsIdentifier(row.module) === normaliseUnitSettingsIdentifier(module));
            return { module, enabled: existing?.enabled || 'On' };
        });
        const updateModuleRow = (module: string, enabled: string) => {
            const nextRows = rows.map((row) => normaliseUnitSettingsIdentifier(row.module) === normaliseUnitSettingsIdentifier(module) ? { ...row, enabled } : row);
            updateUnitModulesDraft(formatWizardPipeRows(nextRows, ['module', 'enabled']));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    Modules are the app areas this unit can see. Turning a module off hides that capability for the unit and can also support future licensing controls.
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    {rows.map((row) => (
                        <button
                            key={row.module}
                            type="button"
                            className={`rounded-lg border px-3 py-3 text-left text-sm font-bold transition ${row.enabled === 'On' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-500'}`}
                            onClick={() => updateModuleRow(row.module, row.enabled === 'On' ? 'Off' : 'On')}
                        >
                            <span className="block">{row.module}</span>
                            <span className="mt-1 block text-[11px] font-semibold">{row.enabled === 'On' ? 'Enabled for this unit' : 'Hidden for this unit'}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };
    const renderRankLabelsEditor = () => {
        const presetOptions = Object.keys(RANK_EQUIVALENCY_PRESET_LABELS) as RankEquivalencyPresetKey[];
        const selectedPresetKey = RANK_EQUIVALENCY_PRESETS[rankSettingsDraft.preset as RankEquivalencyPresetKey]
            ? rankSettingsDraft.preset as RankEquivalencyPresetKey
            : 'AU';
        const selectedPreset = selectedPresetKey === 'CUSTOM'
            ? currentPersonnelDisplaySettings.staffRankEquivalency
            : RANK_EQUIVALENCY_PRESETS[selectedPresetKey];
        const serviceNames = selectedPreset?.services
            ?.map((service: any) => String(service?.name || '').trim())
            .filter(Boolean)
            .join(', ');
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    DFP NEO already has a detailed rank table in Settings. Use this step to choose the rank preset and how names are sorted. If you need a custom rank table, edit it in Settings first.
                </div>
                <div className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 md:grid-cols-2">
                    {wizardField(
                        'Rank preset',
                        RANK_EQUIVALENCY_PRESET_LABELS[selectedPresetKey] || 'Australia',
                        (value) => {
                            const nextPreset = presetOptions.find((key) => RANK_EQUIVALENCY_PRESET_LABELS[key] === value) || 'AU';
                            updateRankSettingsDraft((current) => ({ ...current, preset: nextPreset }));
                        },
                        presetOptions.map((key) => RANK_EQUIVALENCY_PRESET_LABELS[key]),
                    )}
                    {wizardField(
                        'Sort people in lists',
                        rankSettingsDraft.sortMode === 'alphabetical' ? 'Alphabetical' : 'Rank then name',
                        (value) => updateRankSettingsDraft((current) => ({
                            ...current,
                            sortMode: value === 'Alphabetical' ? 'alphabetical' : 'rank-then-name',
                        })),
                        ['Rank then name', 'Alphabetical'],
                    )}
                    {wizardField(
                        'Instructor display term',
                        rankSettingsDraft.instructorLabel || 'Instructor',
                        (value) => updateRankSettingsDraft((current) => ({ ...current, instructorLabel: value })),
                        undefined,
                        'Instructor',
                    )}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
                        <span className={wizardLabelClass}>Trainee ranks</span>
                        <span className="mt-1 block text-sm font-bold text-slate-900">Use staff rank order</span>
                        <span className="mt-1 block">Trainees are sorted using the same rank table as staff in this wizard.</span>
                    </div>
                </div>
                {selectedPresetKey === 'CUSTOM' ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold leading-5 text-orange-900">
                        <span>Custom rank tables are edited in Settings, not in the setup wizard.</span>
                        <button
                            type="button"
                            className="shrink-0 rounded-md border border-orange-300 bg-white px-3 py-1.5 text-[11px] font-bold text-orange-900 shadow-sm transition hover:border-orange-500 hover:bg-orange-100"
                            onClick={() => onNavigateToSettingsSection?.({
                                sectionId: 'platform-rank-terminology',
                                focusSubsectionId: 'platform-staff-rank-equivalency',
                            })}
                        >
                            Open Rank Settings
                        </button>
                    </div>
                ) : null}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
                    Selected rank table: {RANK_EQUIVALENCY_PRESET_LABELS[selectedPresetKey] || 'Australia'}{serviceNames ? ` (${serviceNames})` : ''}. The full rank equivalency table remains in Settings under Resources & Configuration, Rank, Terminology & Labels.
                </div>
            </div>
        );
    };
    const renderSharingEditor = () => {
        const rows = parseWizardSharingRows(resourceSharingDraft);
        const editableRows = rows.length > 0 ? rows : [
            { type: 'Resource sharing', enabled: 'Off', units: '', consequence: 'Unit keeps its own aircraft and DFP resource row capacity.', name: 'Resource sharing arrangement', allocationMode: 'combined' },
            { type: 'Staff sharing', enabled: 'Off', units: '', consequence: 'Unit only schedules its own staff unless changed later.', name: 'Staff sharing arrangement', allocationMode: '' },
        ];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setResourceSharingDraft(formatWizardSharingRows(nextRows));
        };
        const updateRowValues = (index: number, values: Partial<typeof editableRows[number]>) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], ...values };
            setResourceSharingDraft(formatWizardSharingRows(nextRows));
        };
        const unitOptions = Array.from(new Set([
            ...currentWizardUnitCodes,
            ...parseWizardUnitRows(unitsTodayDraft).map((unit) => unit.code),
            ...(Array.isArray(platformConfig?.units) ? platformConfig.units.map((unit: any) => unit?.code) : []),
        ].map((code) => normaliseUnitSettingsIdentifier(code)).filter(Boolean))).sort();
        const toggleRowUnit = (index: number, unit: string) => {
            const selectedUnits = editableRows[index].units
                .split(',')
                .map((item) => normaliseUnitSettingsIdentifier(item))
                .filter(Boolean);
            const unitCode = normaliseUnitSettingsIdentifier(unit);
            const nextUnits = selectedUnits.includes(unitCode)
                ? selectedUnits.filter((item) => item !== unitCode)
                : [...selectedUnits, unitCode];
            updateRow(index, 'units', nextUnits.join(', '));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    Resource sharing lets this unit use another unit's aircraft, simulators, trainers or ground lines. Staff sharing lets this unit schedule people from another unit. Only units already configured in DFP NEO can be selected for sharing. Turning either on can increase scheduling flexibility, but it also means conflicts and availability must be managed across units.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`sharing-row-${index}`} className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
                        <div className="grid min-w-0 gap-2 md:grid-cols-[160px_1fr_110px]">
                            {wizardField('Sharing type', row.type || '', (value) => updateRow(index, 'type', value), ['Resource sharing', 'Staff sharing'])}
                            {wizardField('Arrangement name', row.name || '', (value) => updateRow(index, 'name', value), undefined, row.type?.toLowerCase().includes('staff') ? 'Staff sharing arrangement' : '1FTS+CFS')}
                            {wizardField('Enabled', row.enabled || 'Off', (value) => {
                                const isTurningOff = /^off$/i.test(value);
                                updateRowValues(index, {
                                    enabled: value,
                                    units: isTurningOff ? '' : row.units,
                                    consequence: isTurningOff
                                        ? (row.type?.toLowerCase().includes('staff')
                                        ? 'Unit only schedules its own staff unless changed later.'
                                        : 'Unit keeps its own aircraft and DFP resource row capacity.')
                                        : row.consequence,
                                });
                            }, ['Off', 'On'])}
                        </div>
                        <div>
                            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Shared with units</div>
                            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {unitOptions.map((unit) => {
                                    const selected = row.units
                                        .split(',')
                                        .map((item) => normaliseUnitSettingsIdentifier(item))
                                        .filter(Boolean)
                                        .includes(unit);
                                    return (
                                        <button
                                            key={`${index}-${unit}`}
                                            type="button"
                                            onClick={() => toggleRowUnit(index, unit)}
                                            className={`rounded-lg border-2 px-3 py-2 text-center text-sm font-bold transition ${
                                                selected
                                                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            {unit}
                                        </button>
                                    );
                                })}
                            </div>
                            {unitOptions.length === 0 && (
                                <p className="text-xs font-semibold text-amber-700">No configured units are available to select.</p>
                            )}
                        </div>
                        {row.type?.toLowerCase().includes('resource') && (
                            <div className="grid min-w-0 gap-2 md:grid-cols-[220px_1fr]">
                                {wizardField('Allocation mode', row.allocationMode || 'combined', (value) => updateRow(index, 'allocationMode', value), ['combined', 'fixed'])}
                                {wizardField('Consequence / plain English note', row.consequence || '', (value) => updateRow(index, 'consequence', value), undefined, 'Unit can use shared aircraft and DFP resource rows from the listed units.')}
                            </div>
                        )}
                        {!row.type?.toLowerCase().includes('resource') && (
                            <div>
                                {wizardField('Consequence / plain English note', row.consequence || '', (value) => updateRow(index, 'consequence', value), undefined, 'Unit can schedule staff from the listed units.')}
                            </div>
                        )}
                        <div className="text-[11px] font-semibold text-slate-500">
                            {row.type?.toLowerCase().includes('staff')
                                ? 'Matches Settings > Resources & Configuration > Resource Sharing > Staff Sharing.'
                                : 'Matches Settings > Resources & Configuration > Resource Sharing > Aircraft & Resource Sharing.'}
                        </div>
                    </div>
                ))}
            </div>
        );
    };
    const renderCurrencyEditor = () => {
        const rows = parseWizardCurrencyRows(currencyDraft);
        const editableRows = rows.length > 0 ? rows : [{ name: '', code: '', crew: '', config: 'ANY', currency: '', aircraftCount: '1' }];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            updateCurrencyDraft(formatWizardCurrencyRows(nextRows));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    A {configuredContinuationCurrencyEventsLabel} record is a reusable request preset. It fills in the crew, aircraft configuration, currency type and aircraft count when someone requests that event.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`currency-row-${index}`} className="grid min-w-0 gap-2 rounded-lg border border-slate-300 bg-white p-3 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
                        {wizardField('Event name', row.name || '', (value) => updateRow(index, 'name', value), undefined, 'PIC Currency')}
                        {wizardField('Code', row.code || '', (value) => updateRow(index, 'code', value.toUpperCase()), undefined, 'PIC')}
                        {wizardField('Crew', row.crew || '', (value) => updateRow(index, 'crew', value), undefined, 'Standard crew')}
                        {wizardField('CONFIG', row.config || 'ANY', (value) => updateRow(index, 'config', value), undefined, 'ANY')}
                        {wizardField('Currency', row.currency || '', (value) => updateRow(index, 'currency', value), undefined, 'PIC Currency')}
                        {wizardField('No. aircraft', row.aircraftCount || '1', (value) => updateRow(index, 'aircraftCount', value), undefined, '1')}
                        <button type="button" className={wizardSmallButtonClass} onClick={() => updateCurrencyDraft(formatWizardCurrencyRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                            Delete
                        </button>
                    </div>
                ))}
                <button type="button" className={wizardSmallButtonClass} onClick={() => updateCurrencyDraft(formatWizardCurrencyRows([...editableRows, { name: '', code: '', crew: '', config: 'ANY', currency: '', aircraftCount: '1' }]))}>
                    Add currency
                </button>
            </div>
        );
    };
    const renderScoringEditor = () => {
        const updateScoringPhraseBank = (nextPhraseBank: PhraseBank) => {
            setWizardScoringPhraseBank(nextPhraseBank);
            setScoringDraft(wizardPhraseBankToScoringDraft(nextPhraseBank));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    This uses the same scoring matrix editor as Settings. Edit the grade phrases for Airmanship, Preparation, Technique, or add and group extra flight elements.
                </div>
                <div className="flex flex-wrap gap-2">
                    {[
                        ['Airmanship', 'Airmanship'],
                        ['Preparation', 'Preparation'],
                        ['Technique', 'Technique'],
                        ['Elements', 'Elements'],
                    ].map(([tabId, tabLabel]) => (
                        <button
                            key={`wizard-scoring-tab-${tabId}`}
                            type="button"
                            className={`rounded-md border px-3 py-2 text-xs font-bold ${wizardScoringTab === tabId ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'}`}
                            onClick={() => setWizardScoringTab(tabId as 'Airmanship' | 'Preparation' | 'Technique' | 'Elements')}
                        >
                            {tabLabel}
                        </button>
                    ))}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
                    <ScoringMatrixInline
                        activeTab={wizardScoringTab}
                        phraseBank={wizardScoringPhraseBank}
                        onUpdatePhraseBank={updateScoringPhraseBank}
                        theme="wizard"
                    />
                </div>
            </div>
        );
    };
    const renderStandardCurrencyEventsEditor = () => {
        const rows = parseWizardStandardCurrencyEventRows(staffCurrencyEventsDraft);
        const editableRows = rows.length > 0 ? rows : [{ name: '', shortTitle: '', resourceType: 'Flight', duration: '90', preFlight: '90', postFlight: '60', crew: 'Standard crew', currency: '', config: 'ANY', aircraftCount: '1' }];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setStaffCurrencyEventsDraft(formatWizardStandardCurrencyEventRows(nextRows));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    Continuation and currency events are reusable records for this unit. They pre-fill duration, resource type, crew, currency and aircraft configuration for recurring staff checks.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`standard-currency-event-${index}`} className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
                        <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
                            {wizardField('Event name', row.name || '', (value) => updateRow(index, 'name', value), undefined, 'Annual Instrument Check')}
                            {wizardField('Short title', row.shortTitle || '', (value) => updateRow(index, 'shortTitle', value.toUpperCase()), undefined, 'INST')}
                            {wizardField('Resource type', row.resourceType || 'Flight', (value) => updateRow(index, 'resourceType', value), ['Flight', 'FTD', 'CPT', 'Ground'])}
                            {wizardField('Duration', row.duration || '90', (value) => updateRow(index, 'duration', value), undefined, '90')}
                            {wizardField('Pre-flight', row.preFlight || '90', (value) => updateRow(index, 'preFlight', value), undefined, '90')}
                            {wizardField('Post-flight', row.postFlight || '60', (value) => updateRow(index, 'postFlight', value), undefined, '60')}
                        </div>
                        <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
                            {wizardField('Crew', row.crew || 'Standard crew', (value) => updateRow(index, 'crew', value), undefined, 'Standard crew')}
                            {wizardField('Currency', row.currency || '', (value) => updateRow(index, 'currency', value), undefined, 'Instrument Currency')}
                            {wizardField('CONFIG', row.config || 'ANY', (value) => updateRow(index, 'config', value), undefined, 'ANY')}
                            {wizardField('No. aircraft', row.aircraftCount || '1', (value) => updateRow(index, 'aircraftCount', value), undefined, '1')}
                            <button type="button" className={wizardSmallButtonClass} onClick={() => setStaffCurrencyEventsDraft(formatWizardStandardCurrencyEventRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                <button type="button" className={wizardSmallButtonClass} onClick={() => setStaffCurrencyEventsDraft(formatWizardStandardCurrencyEventRows([...editableRows, { name: '', shortTitle: '', resourceType: 'Flight', duration: '90', preFlight: '90', postFlight: '60', crew: 'Standard crew', currency: '', config: 'ANY', aircraftCount: '1' }]))}>
                    Add standard currency event
                </button>
            </div>
        );
    };
    const wizardTextArea = (label: string, value: string, onChange: (value: string) => void, placeholder?: string, autoFocus = false) => (
        <label className="block">
            <span className={wizardLabelClass}>{label}</span>
            <textarea
                className={`${wizardInputClass} mt-1 min-h-[68px] resize-y`}
                value={value}
                placeholder={placeholder}
                autoFocus={autoFocus}
                onKeyDown={stopEditableKeyPropagation}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
    const goToNextWizardStep = () => {
        pushWizardOrgDiag('wizard:next-clicked', {
            fromStep: visibleStep.id,
            currentStep,
            draft: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
        });
        if (visibleStep.id === 'trainee-courses' && unitDraft.hasTrainees) {
            const courseCount = parseWizardLineItems(traineeCourseOptionsDraft).length;
            if (courseCount === 0) {
                setSaveMessage('Add at least one trainee course before continuing.');
                return;
            }
        }
        if (visibleStep.id === 'trainee-allocation' && unitDraft.hasTrainees) {
            const traineeRows = parseWizardTraineeRows(traineeDraft);
            const validCourses = new Set(parseWizardLineItems(traineeCourseOptionsDraft).map((course) => course.toUpperCase()));
            const hasTraineesToCommit = traineeRows.some((row) => row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate);
            const missingCourseCount = traineeRows.filter((row) => (
                row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate
            )).filter((row) => {
                const course = String(row.course || '').trim();
                return !course || !validCourses.has(course.toUpperCase());
            }).length;
            if (hasTraineesToCommit && missingCourseCount > 0) {
                setSaveMessage(`Select one of the active courses for every trainee before continuing. ${missingCourseCount} trainee${missingCourseCount === 1 ? '' : 's'} still need a valid course.`);
                return;
            }
            if (hasTraineesToCommit && !traineeAllocationCommitted) {
                setSaveMessage('Commit the allocated trainees to Trainee Profiles before continuing.');
                return;
            }
        }
        if (visibleStep.id === 'resource-counts') {
            const draftResourceCounts = [
                resourceDraft.aircraft,
                resourceDraft.sim,
                resourceDraft.trainer,
                resourceDraft.standby,
                resourceDraft.ground,
            ].map((value) => parseNumberDraft(value, 0));
            if (!draftResourceCounts.some((value) => value > 0)) {
                setSaveMessage('Enter at least one aircraft, simulator, trainer, standby or ground row before continuing.');
                return;
            }
        }
        pushWizardOrgDiag('wizard:next-sync-current-step', {
            fromStep: visibleStep.id,
            draft: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
        });
        const stepIdToSync = visibleStep.id;
        const syncStep = () => syncWizardStepToSettings(stepIdToSync);
        markWizardStepComplete(stepIdToSync);
        setWizardPageMenuOpen(false);
        setWizardStep(Math.min(steps.length - 1, currentStep + 1));
        if (typeof window !== 'undefined') window.requestAnimationFrame(() => window.setTimeout(syncStep, 0));
        else syncStep();
    };
    const goToWizardStep = (nextStep: number) => {
        const boundedStep = Math.min(steps.length - 1, Math.max(0, nextStep));
        pushWizardOrgDiag('wizard:jump-clicked', {
            fromStep: visibleStep.id,
            toStep: steps[boundedStep]?.id,
            currentStep,
            draft: summariseOrganisationDraft(organisationDraft),
            activeOrganisation: summariseActiveOrganisation(),
        });
        setWizardPageMenuOpen(false);
        setWizardStep(boundedStep);
    };
    const renderWizardPlatformSettingsEmbed = (
        scrollTarget: string,
        _focusSubsectionId = '',
        successMessage = 'Settings saved into Settings.',
        extraProps: Record<string, unknown> = {},
    ) => {
        const activeUnitCodesForSettings = getWizardActiveUnitCodes();
        return (
            <div key={`wizard-settings-${visibleStep.id}-${scrollTarget}`} ref={wizardSettingsEmbedRef} className="wizard-settings-embed wizard-settings-embed--scroll-stable rounded-lg border border-slate-200 bg-white">
                <PlatformConfigurationSettings
                    currentUserPermission={currentUserPermission}
                    onShowSuccess={(message) => setSaveMessage(message || successMessage)}
                    scrollTarget={scrollTarget}
                    sectionOnly
                    canUsePlatformPermission={canUsePlatformPermission}
                    activeUnitCode={unitCode || unitDraft.code || ''}
                    activeUnitCodes={activeUnitCodesForSettings}
                    activeCompositeUnitCode={unitCode || ''}
                    activeOperationalModel={unitDraft.operationalModel}
                    focusUnitCode={unitDraft.code || unitCode || ''}
                    focusLocationCode={locationDraft.code || locationCode || ''}
                    focusSubsectionId=""
                    onNavigateToSettingsSection={onNavigateToSettingsSection}
                    {...extraProps}
                />
            </div>
        );
    };
    const promptShell = (question: React.ReactNode, answer: React.ReactNode, actionLabel = 'Next', saveAction?: () => void) => (
        <div
            ref={wizardShellRef}
            key={visibleStep.id}
            className="max-w-full overflow-visible rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900 shadow-sm"
            onKeyDownCapture={stopEditableKeyPropagation}
            onKeyDown={stopEditableKeyPropagation}
        >
            <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${wizardStepTextClass(visibleStep)}`}>
                            Step {currentStep + 1} of {steps.length}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                            <span className="text-red-600">Mandatory</span>
                            <span className="text-blue-600">Highly desirable</span>
                            <span className="text-emerald-700">Optional</span>
                            <span className="text-slate-950">Complete</span>
                        </div>
                    </div>
                    <h4 className="mt-1 text-lg font-bold leading-tight text-slate-950">{visibleStep.title}</h4>
                    <div className="mt-2 text-sm leading-5 text-slate-700">{question}</div>
                </div>
                <div
                    className="relative block w-full shrink-0 lg:w-[240px]"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setWizardPageMenuOpen(false);
                        }
                    }}
                >
                    <span className={wizardLabelClass}>Go to wizard page</span>
                    <button
                        type="button"
                        className={`${wizardInputClass} mt-1 flex items-center justify-between gap-2 bg-white text-left text-slate-950`}
                        onClick={() => setWizardPageMenuOpen((open) => !open)}
                        onKeyDown={stopEditableKeyPropagation}
                        aria-expanded={wizardPageMenuOpen}
                        aria-haspopup="listbox"
                    >
                        <span className="min-w-0 truncate">{currentStep + 1}. {visibleStep.title}</span>
                        <span className="shrink-0 text-slate-400">v</span>
                    </button>
                    {wizardPageMenuOpen ? (
                        <div
                            className="absolute right-0 z-50 mt-1 max-h-[440px] w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 shadow-xl"
                            role="listbox"
                        >
                            {steps.map((step, index) => (
                                <button
                                    key={`wizard-page-${step.id}`}
                                    type="button"
                                    ref={index === currentStep ? wizardCurrentStepMenuItemRef : undefined}
                                    className={wizardStepMenuItemClass(step, index)}
                                    onClick={() => goToWizardStep(index)}
                                    role="option"
                                    aria-selected={index === currentStep}
                                >
                                    <span className="text-center">{isWizardStepComplete(step) ? '✓' : ''}</span>
                                    <span className="text-right">{index + 1}.</span>
                                    <span className="min-w-0 flex-1">{step.title}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
            <div
                className="max-w-full overflow-visible rounded-xl border border-slate-300 bg-white/80 p-3 shadow-sm"
                onKeyDownCapture={stopEditableKeyPropagation}
                onKeyDown={stopEditableKeyPropagation}
            >
                {answer}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className={wizardSmallButtonClass} onClick={() => setWizardStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                    Back
                </button>
                {saveAction ? (
                    <button type="button" className={wizardPrimaryButtonClass} onClick={saveAction}>
                        {actionLabel}
                    </button>
                ) : (
                    <button type="button" className={wizardPrimaryButtonClass} onClick={goToNextWizardStep}>
                        Next
                    </button>
                )}
            </div>
        </div>
    );
    const organisationPreviewLevels = getOrganisationDraftLevels(organisationDraft)
        .map((level) => ({ ...level, options: Array.isArray(level?.options) ? level.options : [] }));
    const cleanOrganisationPreviewLevels = cleanOrganisationDraftLevels(
        organisationPreviewLevels,
        organisationDraft.name || organisationDraft.code || 'Organisation',
    );
    const organisationRootLabel = cleanOrganisationPreviewLevels[0]?.options?.[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
    const getParentOptionsForOrganisationLevel = (levelIndex: number) => (
        levelIndex <= 1
            ? [organisationRootLabel].filter(Boolean)
            : (Array.isArray(cleanOrganisationPreviewLevels[levelIndex - 1]?.options) ? cleanOrganisationPreviewLevels[levelIndex - 1].options : [])
    );
    const level1ParentOptions = getParentOptionsForOrganisationLevel(1);
    const level2ParentOptions = getParentOptionsForOrganisationLevel(2);
    const level3ParentOptions = getParentOptionsForOrganisationLevel(3);
    const organisationPreviewParentRows = cleanOrganisationPreviewLevels.map((level, levelIndex) => (
        levelIndex === 0
            ? []
            : buildWizardParentRowsForChildren(level.options, level.parents, getParentOptionsForOrganisationLevel(levelIndex))
    ));
    const organisationPreviewLinks = buildWizardRelationshipPathsFromLevelRows(organisationRootLabel, organisationPreviewParentRows);
    const renderOrganisationPreview = () => (
        <div className="mt-4 rounded-xl border border-slate-300 bg-slate-950 p-4 text-white shadow-inner">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Organisation tree preview</p>
                <p className="text-[10px] font-semibold text-slate-400">This builds live as you type.</p>
            </div>
            <div className="space-y-4 overflow-x-auto pb-1">
                {cleanOrganisationPreviewLevels.map((level, levelIndex) => {
                    const options = level.options.length > 0
                        ? level.options
                        : levelIndex === 0
                            ? [organisationDraft.name || organisationDraft.code || 'Organisation']
                            : [];
                    if (options.length === 0) return null;
                    return (
                        <div key={`wizard-org-preview-${levelIndex}`} className="relative">
                            {levelIndex > 0 && <div className="mx-auto mb-2 h-4 w-px bg-cyan-300/40" />}
                            <div className="flex min-w-max justify-center gap-2">
                                {options.slice(0, 10).map((option) => (
                                    <div
                                        key={`${levelIndex}-${option}`}
                                        className={`flex min-h-[46px] w-[116px] flex-col items-center justify-center rounded border border-cyan-300/45 bg-slate-900 px-2 py-2 text-center shadow-[0_10px_18px_rgba(0,0,0,0.26)] ${levelIndex === 0 ? 'bg-cyan-950/80' : ''}`}
                                    >
                                        <span className="text-[7px] font-black uppercase tracking-[0.14em] text-cyan-200/80">{level.name}</span>
                                        <span className="mt-1 break-words text-[10px] font-black leading-tight text-white">{option}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {organisationPreviewLinks.length > 0 ? (
                <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-950/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Parent links</p>
                    <div className="mt-2 space-y-2">
                        {organisationPreviewLinks.slice(0, 12).map((path, index) => (
                            <div key={`${path.join('-')}-${index}`} className="flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-bold text-slate-100">
                                {path.map((part, pathIndex) => (
                                    <React.Fragment key={`${part}-${pathIndex}`}>
                                        {pathIndex > 0 && <span className="text-cyan-200/70">&gt;</span>}
                                        <span className="rounded border border-white/10 bg-white/10 px-2 py-1">{part}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-950/20 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
                    Add parent links so DFP-NEO knows which organisation owns each child.
                </p>
            )}
        </div>
    );
    const organisationLevelAnswer = (
        levelNumber: number,
        levelName: string,
        levelOptions: string,
        parentMappings: string,
        onNameChange: (value: string) => void,
        onOptionsChange: (value: string) => void,
        onParentMappingsChange: (value: string) => void,
        placeholder: string,
        parentOptions: string[],
    ) => {
        const enteredLevelNumber = levelNumber + 1;
        return (
        <div className="max-w-full overflow-hidden">
            <div className="grid min-w-0 gap-3">
                <div className="min-w-0 md:w-1/2">
                    {wizardTextArea(`Level ${enteredLevelNumber} names`, levelOptions, onOptionsChange, placeholder, true)}
                </div>
                <div>
                    <div>
                        <span className={wizardLabelClass}>Parents for this level</span>
                        <div className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white">
                            {fromLines(levelOptions).length > 0 && parentOptions.length > 0 ? (
                                <div className="divide-y divide-slate-200">
                                    {fromLines(levelOptions).map((child) => {
                                        const currentParent = buildWizardParentRowsForChildren([child], parentMappings, parentOptions)[0]?.parent || '';
                                        return (
                                            <div key={`${levelNumber}-${child}`} className="grid min-w-0 gap-2 px-3 py-2 md:grid-cols-[minmax(110px,170px)_minmax(0,1fr)] md:items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Child</p>
                                                    <p className="mt-1 text-sm font-bold text-slate-950">{child}</p>
                                                </div>
                                                <label className="block min-w-0 md:w-1/2">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Parent</span>
                                                    <select
                                                        className={`${wizardInputClass} mt-1`}
                                                        value={currentParent}
                                                        onChange={(event) => onParentMappingsChange(updateWizardParentMapping(parentMappings, child, event.target.value))}
                                                    >
                                                        {parentOptions.map((parent) => <option key={`${child}-${parent}`} value={parent}>{parent}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                                    Add names for this level and the level above it first, then choose each parent here.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">
                Add one organisation name per line. The parent selector tells DFP-NEO where each one sits, so the organisation diagram can build the correct tree.
            </p>
            {renderOrganisationPreview()}
        </div>
        );
    };
    const updateAdditionalOrganisationLevel = (levelIndex: number, changes: Record<string, string>) => {
        updateOrganisationDraft((draft: typeof organisationDraft) => {
            const additionalLevels = Array.isArray(draft.additionalLevels) ? [...draft.additionalLevels] : [];
            const extraIndex = levelIndex - 4;
            const existingLevel = additionalLevels[extraIndex] || {};
            const cleanExistingLevel = String(existingLevel?.name || '').trim().toLowerCase() === 'unit'
                ? { name: `Level ${levelIndex}`, options: '', parents: '' }
                : existingLevel;
            additionalLevels[extraIndex] = {
                ...(cleanExistingLevel || { name: `Level ${levelIndex}`, options: '', parents: '' }),
                ...changes,
            };
            return { ...draft, additionalLevels };
        }, `field-edit:level${levelIndex}`);
    };
    const updateOrganisationLevelCount = (value: string) => {
        const levelCount = normaliseOrganisationLevelCount(value, normaliseOrganisationLevelCount(organisationDraft.organisationLevelCount, 3));
        updateOrganisationDraft((draft: typeof organisationDraft) => {
            const existingAdditionalLevels = Array.isArray(draft.additionalLevels) ? draft.additionalLevels : [];
            const additionalCount = Math.max(0, levelCount - 3);
            const additionalLevels = Array.from({ length: additionalCount }, (_, index) => {
                const existingLevel = existingAdditionalLevels[index] || {};
                const isUnitLevel = String(existingLevel?.name || '').trim().toLowerCase() === 'unit';
                return {
                    ...(isUnitLevel ? {} : existingLevel),
                    name: isUnitLevel ? `Level ${index + 4}` : String(existingLevel?.name || `Level ${index + 4}`),
                    options: isUnitLevel
                        ? ''
                        : Array.isArray(existingLevel?.options)
                            ? existingLevel.options.join('\n')
                            : String(existingLevel?.options || ''),
                    parents: isUnitLevel ? '' : String(existingLevel?.parents || ''),
                };
            });
            return {
                ...draft,
                organisationLevelCount: levelCount,
                additionalLevels,
            };
        }, 'field-edit:organisation-level-count');
    };
    const buildSetupTestOrganisationStructure = (unitRows: ReturnType<typeof parseWizardUnitRows>) => {
        const organisationLevels = cleanOrganisationDraftLevels(
            getOrganisationDraftLevels(organisationDraft).map((level) => ({ ...level, options: Array.isArray(level?.options) ? level.options : [] })),
            organisationDraft.name || organisationDraft.code || 'Organisation',
        )
            .filter((level, index) => (
                index === 0
                || String(level.name || '').trim().toLowerCase() !== 'unit'
            ))
            .filter((level, index) => index === 0 || level.options.length > 0);
        const rootLabel = organisationLevels[0]?.options?.[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const parentRowsByLevel = organisationLevels.map((level, levelIndex) => (
            levelIndex === 0
                ? []
                : buildWizardParentRowsForChildren(level.options, level.parents, organisationLevels[levelIndex - 1]?.options || [])
        ));
        const relationshipPaths = buildWizardRelationshipPathsFromLevelRows(rootLabel, parentRowsByLevel);
        const unitParentOptions = getWizardUnitParentPathOptions();
        const fallbackUnitParentPath = (unitParentOptions[0] || relationshipPaths[0] || [rootLabel]).filter(Boolean);
        const unitParentPathByCode = getWizardUnitParentPathMap();
        const validUnitParentValues = new Set(unitParentOptions.map(formatWizardOrganisationPath));
        const unitCodes = unitRows.map((row) => row.code).filter(Boolean);
        const unitParentPaths = unitCodes.reduce((map, code) => {
            const configuredPath = unitParentPathByCode.get(normaliseUnitSettingsIdentifier(code));
            const parentPath = configuredPath && validUnitParentValues.has(formatWizardOrganisationPath(configuredPath))
                ? configuredPath
                : fallbackUnitParentPath;
            return {
                ...map,
                [normaliseUnitSettingsIdentifier(code)]: parentPath,
            };
        }, {} as Record<string, string[]>);
        const unitRelationshipPaths = unitCodes.map((code) => [
            ...(unitParentPaths[normaliseUnitSettingsIdentifier(code)] || fallbackUnitParentPath),
            code,
        ]);
        const unitChildrenByParent = unitCodes.reduce((map, code) => {
            const parentPath = unitParentPaths[normaliseUnitSettingsIdentifier(code)] || fallbackUnitParentPath;
            const parent = parentPath[parentPath.length - 1] || rootLabel;
            return {
                ...map,
                [parent]: Array.from(new Set([...(map[parent] || []), code])),
            };
        }, {} as Record<string, string[]>);
        const unitParentByChild = unitCodes.reduce((map, code) => {
            const parentPath = unitParentPaths[normaliseUnitSettingsIdentifier(code)] || fallbackUnitParentPath;
            return {
                ...map,
                [code]: parentPath[parentPath.length - 1] || rootLabel,
            };
        }, {} as Record<string, string>);
        const levels = [
            ...organisationLevels.map((level, levelIndex) => ({
                ...(levelDraftSource(levelIndex) || {}),
                levelIndex,
                name: level.name,
                options: levelIndex === 0 ? [rootLabel] : level.options,
                ...buildWizardParentMaps(parentRowsByLevel[levelIndex] || []),
            })),
            {
                levelIndex: organisationLevels.length,
                name: 'Unit',
                options: unitCodes,
                childrenByParent: unitChildrenByParent,
                parentByChild: unitParentByChild,
            },
        ].filter((level) => String(level.name || '').trim() || (Array.isArray(level.options) && level.options.length > 0));
        return {
            structure: {
                levels,
                relationshipPaths: [...relationshipPaths, ...unitRelationshipPaths],
            },
            unitParentPaths,
            fallbackUnitParentPath,
        };
    };

    const buildSetupTestPersonnel = (
        unitRows: ReturnType<typeof parseWizardUnitRows>,
        overrides: { staffDraft?: string; traineeDraft?: string; unitDraft?: typeof unitDraft; staffRows?: any[]; traineeRows?: any[] } = {},
    ) => {
        const effectiveStaffDraft = overrides.staffDraft ?? staffDraft;
        const effectiveTraineeDraft = overrides.traineeDraft ?? traineeDraft;
        const effectiveUnitDraft = overrides.unitDraft ?? unitDraft;
        const effectiveStaffRows = Array.isArray(overrides.staffRows) && overrides.staffRows.length > 0
            ? overrides.staffRows
            : uploadedStaffProfileRows.length > 0
                ? uploadedStaffProfileRows
                : parseWizardStaffRows(effectiveStaffDraft);
        const effectiveTraineeRows = Array.isArray(overrides.traineeRows) && overrides.traineeRows.length > 0
            ? overrides.traineeRows
            : uploadedTraineeProfileRows.length > 0
                ? uploadedTraineeProfileRows
                : parseWizardTraineeRows(effectiveTraineeDraft);
        const firstUnitCode = unitRows[0]?.code || effectiveUnitDraft.code || unitCode || '';
        const firstLocationCode = parseWizardLocationRows(locationsTodayDraft)[0]?.icao || locationDraft.code || '';
        const instructorQualificationDefinitions = getInstructorQualificationDefinitions(staffQualificationCatalogue);
        const qualificationsToFlags = (qualifications: string) => {
            const tokens = qualifications
                .split(/[,\s/]+/)
                .map((token) => token.trim().toUpperCase())
                .filter(Boolean);
            const hasLinkedInstructorQualification = tokens.some(token => (
                instructorQualificationDefinitions.some(qualification => qualificationMatches(token, qualification))
            ));
            return {
                isQFI: hasLinkedInstructorQualification || tokens.includes('QFI') || tokens.includes('CFI') || tokens.includes('OFI'),
                isOFI: tokens.includes('OFI'),
                isCFI: tokens.includes('CFI'),
                isIRE: tokens.includes('IRE'),
                isFlyingSupervisor: tokens.includes('FS') || tokens.includes('FLYINGSUPERVISOR') || qualifications.toLowerCase().includes('flying supervisor'),
            };
        };
        const instructors = effectiveStaffRows.map((row, index) => {
            const fullName = [row.surname, row.givenNames].filter(Boolean).join(', ') || row.givenNames || row.surname || `Staff ${index + 1}`;
            const flags = qualificationsToFlags(row.qualifications);
            return {
                id: `setup-staff-${index + 1}`,
                idNumber: Number(row.personnelId) || 0,
                name: fullName,
                rank: row.rank || 'Rank',
                role: row.position || 'Instructor',
                category: row.category || 'B',
                callsign: row.callsign || '',
                secondaryCallsign: row.secondaryCallsign || '',
                callsignNumber: Number(row.callsignNumber) || index + 1,
                isTestingOfficer: false,
                seatConfig: row.seatConfig || 'ANY',
                isExecutive: false,
                isCommandingOfficer: false,
                isContractor: false,
                isAdminStaff: row.isAdminStaff === true,
                unavailability: [],
                unit: String(row.unit || firstUnitCode).trim().toUpperCase(),
                location: row.location || firstLocationCode,
                email: row.email || '',
                phoneNumber: row.phoneNumber || '',
                crew: row.crew || '',
                flight: row.flight || '',
                qualifications: row.qualifications,
                sourceTemplateData: row.sourceTemplateData || undefined,
                _dataSource: 'setup-test',
                ...flags,
            };
        });
        const traineesEnabled = effectiveUnitDraft.hasTrainees || effectiveTraineeRows.length > 0;
        const trainees = traineesEnabled
            ? effectiveTraineeRows.map((row, index) => {
                const fullName = [row.surname, row.givenNames].filter(Boolean).join(', ') || row.givenNames || row.surname || `Trainee ${index + 1}`;
                return {
                    idNumber: Number(row.personnelId) || 0,
                    fullName,
                    name: fullName,
                    rank: row.rank || 'Rank',
                    course: row.course || row.courseNumber || '',
                    courseNumber: row.courseNumber || '',
                    lmpType: row.masterLmp || trainingDraft.lmpCode || trainingDraft.lmpName || '',
                    seatConfig: row.seatConfig || 'ANY',
                    category: row.category || '',
                    callsign: row.callsign || '',
                    isPaused: false,
                    unit: String(row.unit || firstUnitCode).trim().toUpperCase(),
                    location: row.location || firstLocationCode,
                    email: row.email || '',
                    phoneNumber: row.phoneNumber || '',
                    unavailability: [],
                    startDate: row.startDate || '',
                    sourceTemplateData: row.sourceTemplateData || undefined,
                    _dataSource: 'setup-test',
                };
            })
            : [];
        return { instructors, trainees };
    };

    const saveSetupTestWizardDrafts = (
        markComplete = true,
        overrides: { staffDraft?: string; traineeDraft?: string; unitDraft?: typeof unitDraft; staffRows?: any[]; traineeRows?: any[] } = {},
    ) => {
        if (!onUpdatePlatformConfig) {
            setSaveMessage('This setup test screen is not connected to the platform configuration in this session.');
            return;
        }
        const rawLocationRows = parseWizardLocationRows(locationsTodayDraft);
        const singleLocationDraftDoesNotMatchContext = rawLocationRows.length === 1
            && activeLocations.length === 0
            && activeWizardLocationCode
            && ![
                rawLocationRows[0]?.icao,
                rawLocationRows[0]?.iata,
                rawLocationRows[0]?.name,
            ].some((value) => normaliseUnitSettingsIdentifier(value) === normaliseUnitSettingsIdentifier(activeWizardLocationCode));
        const locationRows = singleLocationDraftDoesNotMatchContext ? [activeWizardLocationRow] : rawLocationRows;
        const unitRows = parseWizardUnitRows(unitsTodayDraft);
        const effectiveUnitDraft = overrides.unitDraft ?? unitDraft;
        const cleanLocations = (locationRows.length > 0 ? locationRows : [{
            icao: locationDraft.code,
            iata: locationDraft.iataCode,
            name: locationDraft.name,
        }]).filter((row) => row.icao || row.iata || row.name);
        const cleanUnits = (unitRows.length > 0 ? unitRows : [{
            code: effectiveUnitDraft.code || unitCode || 'UNIT',
            name: effectiveUnitDraft.name || effectiveUnitDraft.code || unitCode || 'Unit',
        }]).filter((row) => row.code || row.name);
        const { structure, unitParentPaths, fallbackUnitParentPath } = buildSetupTestOrganisationStructure(cleanUnits);
        pushWizardOrgDiag('setup-sync:prepared-structure', {
            markComplete,
            cleanUnits,
            draft: summariseOrganisationDraft(organisationDraft),
            structureLevels: structure.levels.map((level: any) => ({
                levelIndex: level.levelIndex,
                name: level.name,
                options: level.options,
                parentByChild: level.parentByChild,
            })),
            relationshipPaths: structure.relationshipPaths,
            activeOrganisation: summariseActiveOrganisation(),
        });
        const primaryLocationCode = cleanLocations[0]?.icao || locationDraft.code || '';
        const primaryAircraftCode = String(resourceDraft.aircraftCode || crewDraft.aircraftCode || '').trim().toUpperCase();
        const primaryAircraftName = String(resourceDraft.aircraftName || '').trim();
        const primaryResourcePoolName = String(resourceDraft.poolName || '').trim();
        const hasDeliberateAircraftSetup = Boolean(primaryAircraftCode);
        const hasDeliberateResourceSetup = Boolean(primaryAircraftCode && primaryResourcePoolName);
        const primaryResourceLocationCode = String(effectiveUnitDraft.locationCode || resourceDraft.poolLocationCode || primaryLocationCode || '').trim().toUpperCase();
        const primaryResourceUnitCode = String(effectiveUnitDraft.code || resourceDraft.poolUnitCode || cleanUnits[0]?.code || '').trim().toUpperCase();
        const crewSeats = parseRoleRequirementsText(crewDraft.standardSeats);
        const alternateCrewRequirements = parseRoleRequirementsText(alternateCrewDraft);
        const alternateCrewRows = alternateCrewRequirements.length > 0 ? [{
            id: createSetupTestRecordId('alternate-crew', primaryAircraftCode || 'other-approved-crew'),
            code: 'ALT',
            unitCode: cleanUnits[0]?.code || '',
            aircraftTypeCode: primaryAircraftCode,
            name: 'Other approved crew composition',
            description: '',
            operationalModels: ['air_combat', 'fixed_crew', 'pooled_crew'],
            roleRequirements: alternateCrewRequirements,
            status: 'ACTIVE',
        }] : [];
        const currencyProfiles = parseWizardCurrencyRows(currencyDraft).map((row, index) => ({
            id: createSetupTestRecordId('currency-profile', row.code || row.name || index + 1),
            unitCode: cleanUnits[0]?.code || '',
            aircraftTypeCode: primaryAircraftCode,
            name: row.name || `Currency ${index + 1}`,
            code: (row.code || row.name || `CUR${index + 1}`).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || `CUR${index + 1}`,
            crew: row.crew || 'Standard crew',
            config: row.config || 'ANY',
            currency: row.currency || row.name || `Currency ${index + 1}`,
            aircraftCount: Math.max(1, Math.round(Number(row.aircraftCount) || 1)),
            status: 'ACTIVE',
        }));
        const standardMissionProfiles = parseWizardStandardCurrencyEventRows(staffCurrencyEventsDraft).map((row, index) => ({
            id: createSetupTestRecordId('standard-mission', row.shortTitle || row.name || index + 1),
            unitCode: cleanUnits[0]?.code || '',
            name: row.name || `Standard event ${index + 1}`,
            shortTitle: row.shortTitle || row.name || `EVT${index + 1}`,
            resourceType: row.resourceType || 'Flight',
            duration: Math.max(0, Number(row.duration) || 0),
            preFlight: Math.max(0, Number(row.preFlight) || 0),
            postFlight: Math.max(0, Number(row.postFlight) || 0),
            crew: row.crew || 'Standard crew',
            currency: row.currency || '',
            config: row.config || 'ANY',
            aircraftCount: Math.max(1, Math.round(Number(row.aircraftCount) || 1)),
            status: 'ACTIVE',
        }));
        const sharingRows = parseWizardSharingRows(resourceSharingDraft);
        const resourceSharingRows = sharingRows.filter((row) => row.type.toLowerCase().includes('resource'));
        const staffSharingRows = sharingRows.filter((row) => row.type.toLowerCase().includes('staff'));
        const trainingReportRow = parseWizardTrainingReportRows(trainingRecordsDraft)[0];
        const trainingReportPhraseBank = wizardScoringPhraseBank;
        const scoringDraftToSave = wizardPhraseBankToScoringDraft(trainingReportPhraseBank);
        const setupPersonnel = buildSetupTestPersonnel(cleanUnits, overrides);

        onUpdatePlatformConfig((baseConfig: any) => {
            const existingAircraftTypes = Array.isArray(baseConfig?.aircraftTypes) ? baseConfig.aircraftTypes : [];
            const existingResourcePools = Array.isArray(baseConfig?.resourcePools) ? baseConfig.resourcePools : [];
            const existingOrganisation = Array.isArray(baseConfig?.organisations) ? baseConfig.organisations[0] : null;
            const existingOrganisationSettings = existingOrganisation?.settings || {};
            pushWizardOrgDiag('setup-sync:updater-entered', {
                baseOrganisation: {
                    id: existingOrganisation?.id,
                    code: existingOrganisation?.code,
                    name: existingOrganisation?.name,
                    levelNames: Array.isArray(existingOrganisationSettings?.organisationStructure?.levels)
                        ? existingOrganisationSettings.organisationStructure.levels.map((level: any) => level?.name)
                        : [],
                },
                draft: summariseOrganisationDraft(organisationDraft),
            });
            const setupMaxEventsPerDay = parseNumberDraft(buildRulesDraft.maxEventsPerDay, 0);
            const setupMaxFlightsPerDay = parseNumberDraft(buildRulesDraft.maxFlightsPerDay, 0);
            const setupMinGapBetweenEventsMinutes = parseNumberDraft(buildRulesDraft.minGapBetweenEventsMinutes, 0);
            const setupEventLimits = {
                maxEventsPerDay: setupMaxEventsPerDay,
                maxFlightsPerDay: setupMaxFlightsPerDay,
                minGapBetweenEventsMinutes: setupMinGapBetweenEventsMinutes,
            };
            const existingMasterLmpCatalogue = Array.isArray(existingOrganisationSettings.masterLmpCatalogue)
                ? existingOrganisationSettings.masterLmpCatalogue
                : [];
            const existingMasterLmpAccess = getOrganisationMasterLmpAccessRules(existingOrganisationSettings);
            const draftLmpCode = String(trainingDraft.lmpCode || '').trim();
            const shouldSyncDraftMasterLmp = Boolean(draftLmpCode && !/^new master lmp$/i.test(draftLmpCode));
            const draftMasterLmpCatalogueEntry = shouldSyncDraftMasterLmp ? {
                id: createSetupTestRecordId('master-lmp-catalogue', trainingDraft.lmpCode || trainingDraft.lmpName || 'master-lmp'),
                code: trainingDraft.lmpCode,
                name: trainingDraft.lmpName || trainingDraft.lmpCode,
                description: trainingDraft.description,
                status: trainingDraft.status || 'ACTIVE',
            } : null;
            const draftMasterLmpAccessRule = shouldSyncDraftMasterLmp ? {
                id: createSetupTestRecordId('master-lmp-access', `${trainingDraft.lmpCode || 'lmp'}-${trainingDraft.accessUnitCode || cleanUnits[0]?.code || 'unit'}`),
                lmpCode: trainingDraft.lmpCode,
                locationCode: trainingDraft.accessLocationCode || primaryLocationCode,
                unitCode: trainingDraft.accessUnitCode || cleanUnits[0]?.code || '',
                operationalModel: trainingDraft.accessModel === 'Any Model' ? null : trainingDraft.accessModel,
                accessLevel: trainingDraft.accessLevel || 'Manage',
                status: 'ACTIVE',
            } : null;
            const mergeByNormalisedCode = (rows: any[], nextRow: any | null, codeKey: string) => {
                if (!nextRow) return rows;
                const nextKey = normaliseUnitSettingsIdentifier(nextRow?.[codeKey]);
                if (!nextKey) return rows;
                const exists = rows.some((row: any) => normaliseUnitSettingsIdentifier(row?.[codeKey]) === nextKey);
                return exists
                    ? rows.map((row: any) => normaliseUnitSettingsIdentifier(row?.[codeKey]) === nextKey ? { ...row, ...nextRow } : row)
                    : [...rows, nextRow];
            };
            const nextLocations = cleanLocations.map((row, index) => {
                const profile = findWizardLocationProfile(row.icao || row.iata || row.name);
                return {
                    id: createSetupTestRecordId('location', row.icao || row.iata || row.name || index + 1),
                    code: row.icao || row.iata || `LOC${index + 1}`,
                    iataCode: row.iata || profile?.iata || '',
                    name: row.name || profile?.name || row.icao || row.iata || `Location ${index + 1}`,
                    timezone: profile?.timezone || locationDraft.timezone || 'UTC',
                    trainingAreas: locationDraft.trainingAreas.split(',').map((item) => item.trim()).filter(Boolean),
                    status: 'ACTIVE',
                    settings: { iataCode: row.iata || profile?.iata || '' },
                };
            });
            const nextUnits = cleanUnits.map((row, index) => ({
                id: createSetupTestRecordId('unit', row.code || row.name || index + 1),
                code: row.code || `UNIT${index + 1}`,
                name: row.name || row.code || `Unit ${index + 1}`,
                locationCode: index === 0 ? (effectiveUnitDraft.locationCode || primaryLocationCode) : primaryLocationCode,
                unitType: index === 0 ? effectiveUnitDraft.unitType || '' : '',
                status: 'ACTIVE',
                settings: {
                    operationalModel: effectiveUnitDraft.operationalModel,
                    hasTrainees: index === 0 ? effectiveUnitDraft.hasTrainees : false,
                    parentOrganisationPath: unitParentPaths[normaliseUnitSettingsIdentifier(row.code)] || fallbackUnitParentPath,
                    trainingReportTemplate: trainingReportRow ? {
                        displayName: trainingReportRow.organisationName || trainingReportRow.genericName || 'Training Report',
                        grades: {
                            scaleMin: Number(trainingReportRow.gradeMin) || 0,
                            scaleMax: Number(trainingReportRow.gradeMax) || 5,
                            showNumbers: String(trainingReportRow.showNumbers || '').toLowerCase() !== 'no',
                        },
                        overallResults: {
                            passLabel: trainingReportRow.passLabel || 'Satisfactory',
                            failLabel: trainingReportRow.failLabel || 'Unsatisfactory',
                        },
                    } : undefined,
                    trainingReportPhraseBank,
                },
            }));
            const modules = parseWizardLineItems(unitModulesDraft).map((line, index) => {
                const [namePart] = line.split('|').map((part) => part.trim());
                const code = (namePart || `Module ${index + 1}`).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                return { id: createSetupTestRecordId('module', code || index + 1), code, name: namePart || code, status: 'ACTIVE' };
            });
            const unitModules = cleanUnits.flatMap((unit) => parseWizardLineItems(unitModulesDraft).map((line, index) => {
                const [namePart, enabledPart] = line.split('|').map((part) => part.trim());
                const moduleCode = (namePart || `Module ${index + 1}`).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                return {
                    id: createSetupTestRecordId('unit-module', `${unit.code}-${moduleCode || index + 1}`),
                    unitCode: unit.code,
                    moduleCode,
                    isEnabled: !/^off$/i.test(enabledPart || ''),
                    status: 'ACTIVE',
                };
            }));
            const organisation = {
                id: createSetupTestRecordId('organisation', organisationDraft.code || organisationDraft.name || 'organisation'),
                code: organisationDraft.code || organisationDraft.name || 'ORG',
                name: organisationDraft.name || organisationDraft.code || 'Organisation',
                status: 'ACTIVE',
                settings: {
                    ...existingOrganisationSettings,
                    organisationStructure: structure,
                    masterLmpCatalogue: mergeByNormalisedCode(existingMasterLmpCatalogue, draftMasterLmpCatalogueEntry, 'code'),
                    masterLmpAccess: mergeByNormalisedCode(existingMasterLmpAccess, draftMasterLmpAccessRule, 'lmpCode'),
                    crewCompositionSettings: normaliseCrewCompositionSettings({
                        alternateCompositions: alternateCrewRows,
                        currencyProfiles,
                    }),
                    crewPositionTerminology: wizardCrewPositionTerminology,
                    standardMissionProfiles: { profiles: standardMissionProfiles },
                    personnelDisplaySettings: buildRankSettingsToSave(existingOrganisationSettings),
                    fleetSharingEnabled: resourceSharingRows.some((row) => /^on$/i.test(row.enabled)),
                    resourceSharingGroups: resourceSharingRows.map((row, index) => ({
                        id: createSetupTestRecordId('resource-sharing', row.units || index + 1),
                        name: row.name || `Resource sharing ${index + 1}`,
                        selectedUnits: row.units.split(',').map((item) => item.trim()).filter(Boolean),
                        allocationMode: row.allocationMode || 'combined',
                        status: 'ACTIVE',
                        enabled: /^on$/i.test(row.enabled),
                    })),
                    staffSharingEnabled: staffSharingRows.some((row) => /^on$/i.test(row.enabled) && row.units.split(',').map((item) => item.trim()).filter(Boolean).length > 1),
                    staffSharingGroups: staffSharingRows.map((row, index) => ({
                        id: createSetupTestRecordId('staff-sharing', row.units || index + 1),
                        name: row.name || `Staff sharing ${index + 1}`,
                        selectedUnits: /^on$/i.test(row.enabled) ? row.units.split(',').map((item) => item.trim()).filter(Boolean) : [],
                        status: 'ACTIVE',
                        enabled: /^on$/i.test(row.enabled),
                    })),
                    initialSetupWizardDraft: {
                        organisation: organisationDraft,
                        unitsToday: cleanUnits,
                        locationsToday: cleanLocations,
                        unitParents: unitParentDraft,
                        crewLabels: crewLabelsDraft,
                        alternateCrews: alternateCrewDraft,
                        buildRules: buildRulesDraftText,
                        staff: overrides.staffDraft ?? staffDraft,
                        traineesEnabled: (overrides.unitDraft ?? unitDraft).hasTrainees,
                        traineeCourses: traineeCourseOptionsDraft,
                        trainees: overrides.traineeDraft ?? traineeDraft,
                        trainingRecords: trainingRecordsDraft,
                        unitModules: unitModulesDraft,
                        ranksAndLabels: rankLabelsDraft,
                        rankSettings: rankSettingsDraft,
                        crewRoles: crewRolesDraft,
                        resourceSharing: resourceSharingDraft,
                        currencies: currencyDraft,
                        scoringMatrix: scoringDraftToSave,
                        staffCurrencyEvents: staffCurrencyEventsDraft,
                    },
                },
            };
            pushWizardOrgDiag('setup-sync:writing-organisation', {
                organisation: {
                    id: organisation.id,
                    code: organisation.code,
                    name: organisation.name,
                    levelNames: organisation.settings.organisationStructure?.levels?.map((level: any) => level?.name),
                    levelOptions: organisation.settings.organisationStructure?.levels?.map((level: any) => level?.options),
                    relationshipPaths: organisation.settings.organisationStructure?.relationshipPaths,
                    storedDraft: organisation.settings.initialSetupWizardDraft?.organisation,
                },
            });
            return {
                organisations: [organisation],
                locations: nextLocations,
                units: nextUnits,
                aircraftTypes: hasDeliberateAircraftSetup ? [{
                    id: createSetupTestRecordId('aircraft-type', primaryAircraftCode),
                    code: primaryAircraftCode,
                    name: primaryAircraftName || primaryAircraftCode,
                    category: 'Other',
                    status: 'ACTIVE',
                    crewComposition: {
                        ...normaliseAircraftCrewComposition(null),
                        standardSeats: crewSeats,
                    },
                }] : existingAircraftTypes,
                resourcePools: hasDeliberateResourceSetup ? [{
                    id: createSetupTestRecordId('resource-pool', `${primaryAircraftCode}-${primaryResourceLocationCode}-${primaryResourceUnitCode}`),
                    code: makeWizardResourcePoolCode(primaryResourceLocationCode, primaryResourceUnitCode, primaryAircraftCode),
                    name: primaryResourcePoolName,
                    organisationCode: organisation.code,
                    locationCode: primaryResourceLocationCode,
                    unitCode: primaryResourceUnitCode,
                    aircraftTypeCode: primaryAircraftCode,
                    poolType: 'Dedicated',
                    status: 'ACTIVE',
                    settings: {
                        aircraft: parseNumberDraft(resourceDraft.aircraft),
                        ftd: parseNumberDraft(resourceDraft.sim),
                        cpt: parseNumberDraft(resourceDraft.trainer),
                        standby: parseNumberDraft(resourceDraft.standby),
                        ground: parseNumberDraft(resourceDraft.ground),
                    },
                }] : existingResourcePools,
                modules,
                unitModules,
                licenses: [],
                userAccess: [{
                    id: createSetupTestRecordId('user-access', `${accessDraft.userName || 'setup-admin'}-${accessDraft.unitCode || cleanUnits[0]?.code || 'unit'}`),
                    userName: accessDraft.userName || 'Setup Admin',
                    locationCode: accessDraft.locationCode || primaryLocationCode,
                    unitCode: accessDraft.unitCode || cleanUnits[0]?.code || '',
                    moduleCode: accessDraft.moduleCode || 'DFP',
                    accessLevel: accessDraft.accessLevel || 'Manage',
                    status: 'ACTIVE',
                }],
                platformUsers: [{
                    id: createSetupTestRecordId('platform-user', accessDraft.userName || 'setup-admin'),
                    name: accessDraft.userName || 'Setup Admin',
                    username: 'setup-admin',
                    status: 'ACTIVE',
                }],
                schedulingRuleSets: [{
                    id: createSetupTestRecordId('scheduling-rule-set', cleanUnits[0]?.code || 'unit'),
                    name: `${cleanUnits[0]?.code || 'Unit'} build rules`,
                    unitCode: cleanUnits[0]?.code || '',
                    businessRules: buildRulesDraft.businessRules,
                    maxCrewDutyHours: parseNumberDraft(buildRulesDraft.maxCrewDutyHours, 12),
                    preferredDutyHours: parseNumberDraft(buildRulesDraft.preferredDutyHours, 10),
                    aircraftTurnaroundMinutes: parseNumberDraft(buildRulesDraft.aircraftTurnaroundMinutes, 60),
                    simTurnaroundMinutes: parseNumberDraft(buildRulesDraft.simTurnaroundMinutes, 30),
                    trainerTurnaroundMinutes: parseNumberDraft(buildRulesDraft.trainerTurnaroundMinutes, 30),
                    maxDispatchPerHour: parseNumberDraft(buildRulesDraft.maxDispatchPerHour, 2),
                    maxEventsPerDay: setupMaxEventsPerDay,
                    maxFlightsPerDay: setupMaxFlightsPerDay,
                    minGapBetweenEventsMinutes: setupMinGapBetweenEventsMinutes,
                    eventLimits: setupEventLimits,
                    rules: {
                        maxEventsPerDay: setupMaxEventsPerDay,
                        maxFlightsPerDay: setupMaxFlightsPerDay,
                        minGapBetweenEventsMinutes: setupMinGapBetweenEventsMinutes,
                        eventLimits: setupEventLimits,
                        wizardEventLimits: setupEventLimits,
                        dailyEventLimits: setupEventLimits,
                    },
                    status: 'ACTIVE',
                }],
            };
        });
        const shouldHandoffPersonnel = Array.isArray(overrides.staffRows) || Array.isArray(overrides.traineeRows);
        const setupPersonnelSnapshot = JSON.stringify(setupPersonnel);
        if (shouldHandoffPersonnel && setupPersonnelSnapshot !== lastSetupTestPersonnelSnapshotRef.current) {
            lastSetupTestPersonnelSnapshotRef.current = setupPersonnelSnapshot;
            pushWizardImportDiag('personnel:handoff-to-app', {
                markComplete,
                handoffReason: Array.isArray(overrides.staffRows) ? 'staff-rows-override' : 'trainee-rows-override',
                instructors: setupPersonnel.instructors.length,
                trainees: setupPersonnel.trainees.length,
                instructorSample: setupPersonnel.instructors.slice(0, 8).map((person: any) => ({
                    name: person.name,
                    unit: person.unit,
                    location: person.location,
                    role: person.role,
                    source: person._dataSource,
                })),
                traineeSample: setupPersonnel.trainees.slice(0, 8).map((person: any) => ({
                    name: person.name || person.fullName,
                    unit: person.unit,
                    location: person.location,
                    course: person.course,
                    source: person._dataSource,
                })),
            });
            onSaveSetupTestPersonnel?.(setupPersonnel);
        }
        if (markComplete && typeof window !== 'undefined') {
            safeSetWizardLocalStorage(initialSetupWizardStorageKey, String(steps.length - 1));
        }
        setSaveMessage(markComplete
            ? 'Setup saved in this setup workspace.'
            : 'This step has been synced into Settings for this setup workspace.'
        );
    };

    const saveAllWizardDrafts = () => {
        if (isSetupTestMode) {
            saveSetupTestWizardDrafts();
            return;
        }
        saveOrganisationDraft();
        const locationRows = parseWizardLocationRows(locationsTodayDraft);
        const unitRows = parseWizardUnitRows(unitsTodayDraft);
        if (onUpdatePlatformConfig && (locationRows.length > 0 || unitRows.length > 0)) {
            onUpdatePlatformConfig((current) => {
                const baseConfig = current || platformConfig || {};
                const existingLocations = Array.isArray(baseConfig.locations) ? baseConfig.locations : [];
                const existingUnits = Array.isArray(baseConfig.units) ? baseConfig.units : [];
                const nextLocations = [...existingLocations];
                locationRows.forEach((row) => {
                    const code = row.icao || row.iata;
                    if (!code) return;
                    const existingIndex = nextLocations.findIndex((location: any) => normaliseUnitSettingsIdentifier(location?.code) === normaliseUnitSettingsIdentifier(code));
                    const nextLocation = {
                        ...(existingIndex >= 0 ? nextLocations[existingIndex] : { id: createWizardRecordId('location') }),
                        code,
                        iataCode: row.iata,
                        name: row.name || code,
                        timezone: existingIndex >= 0 ? nextLocations[existingIndex].timezone || 'UTC' : 'UTC',
                        status: 'ACTIVE',
                        settings: {
                            ...(existingIndex >= 0 ? nextLocations[existingIndex].settings || {} : {}),
                            iataCode: row.iata,
                        },
                    };
                    if (existingIndex >= 0) nextLocations[existingIndex] = nextLocation;
                    else nextLocations.push(nextLocation);
                });
                const defaultLocationCode = locationRows[0]?.icao || locationDraft.code;
                const nextUnits = [...existingUnits];
                unitRows.forEach((row) => {
                    const code = row.code;
                    if (!code) return;
                    const existingIndex = nextUnits.findIndex((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(code));
                    const nextUnit = {
                        ...(existingIndex >= 0 ? nextUnits[existingIndex] : { id: createWizardRecordId('unit') }),
                        code,
                        name: row.name || code,
                        locationCode: existingIndex >= 0 ? nextUnits[existingIndex].locationCode || defaultLocationCode : defaultLocationCode,
                        unitType: existingIndex >= 0 ? nextUnits[existingIndex].unitType || unitDraft.unitType : unitDraft.unitType,
                        status: 'ACTIVE',
                        settings: {
                            ...(existingIndex >= 0 ? nextUnits[existingIndex].settings || {} : {}),
                            operationalModel: existingIndex >= 0 ? nextUnits[existingIndex].settings?.operationalModel || unitDraft.operationalModel : unitDraft.operationalModel,
                            hasTrainees: existingIndex >= 0 ? nextUnits[existingIndex].settings?.hasTrainees ?? unitDraft.hasTrainees : unitDraft.hasTrainees,
                        },
                    };
                    if (existingIndex >= 0) nextUnits[existingIndex] = nextUnit;
                    else nextUnits.push(nextUnit);
                });
                return {
                    ...baseConfig,
                    locations: nextLocations,
                    units: nextUnits,
                };
            });
        }
        saveLocationDraft();
        saveUnitDraft();
        saveResourceDraft();
        saveCrewDraft();
        saveRankSettingsDraft();
        saveTrainingDraft();
        saveBuildRulesDraft();
        saveCurrencyProfilesDraft();
        saveWizardConfig('Setup saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            personnelDisplaySettings: buildRankSettingsToSave(settings),
            initialSetupWizardDraft: {
                unitsToday: parseWizardUnitRows(unitsTodayDraft),
                locationsToday: parseWizardLocationRows(locationsTodayDraft),
                unitParents: unitParentDraft,
                crewLabels: crewLabelsDraft,
                alternateCrews: alternateCrewDraft,
                buildRules: buildRulesDraftText,
                staff: staffDraft,
                traineesEnabled: unitDraft.hasTrainees,
                traineeCourses: traineeCourseOptionsDraft,
                trainees: traineeDraft,
                trainingRecords: trainingRecordsDraft,
                unitModules: unitModulesDraft,
                ranksAndLabels: rankLabelsDraft,
                rankSettings: rankSettingsDraft,
                resourceSharing: resourceSharingDraft,
                currencies: currencyDraft,
                scoringMatrix: wizardPhraseBankToScoringDraft(wizardScoringPhraseBank),
                staffCurrencyEvents: staffCurrencyEventsDraft,
            },
        })));
        setCompletedWizardStepIds(new Set(steps.map((step) => step.id)));
        if (typeof window !== 'undefined') {
            safeSetWizardLocalStorage(initialSetupWizardCompletedStepsStorageKey, JSON.stringify(steps.map((step) => step.id)));
        }
        setSaveMessage('Setup saved into Settings.');
    };
    const commitWizardStaffProfiles = () => {
        const staffRows = uploadedStaffProfileRows.length > 0 ? uploadedStaffProfileRows : undefined;
        const staffCount = (staffRows || parseWizardStaffRows(staffDraft)).filter((row) => (
            row.surname || row.givenNames || row.unit || row.position || row.personnelId || row.qualifications
        )).length;
        saveSetupTestWizardDrafts(false, { staffDraft, staffRows });
        const message = `Committed ${staffCount} staff profile${staffCount === 1 ? '' : 's'} to Staff Profiles in this setup.`;
        setImportConfirmations((current) => ({ ...current, staff: message }));
        setSaveMessage(message);
    };
    const commitWizardTraineeProfiles = () => {
        const traineeRows = uploadedTraineeProfileRows.length > 0 ? uploadedTraineeProfileRows : undefined;
        const rowsToCommit = traineeRows || parseWizardTraineeRows(traineeDraft);
        const validCourses = new Set(parseWizardLineItems(traineeCourseOptionsDraft).map((course) => course.toUpperCase()));
        const missingCourseCount = rowsToCommit.filter((row) => (
            row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate
        )).filter((row) => {
            const course = String(row.course || '').trim();
            return !course || !validCourses.has(course.toUpperCase());
        }).length;
        if (missingCourseCount > 0) {
            const message = `Select one of the active courses for every trainee before committing. ${missingCourseCount} trainee${missingCourseCount === 1 ? '' : 's'} still need a valid course.`;
            setImportConfirmations((current) => ({ ...current, trainees: message }));
            setSaveMessage(message);
            return;
        }
        const traineeCount = rowsToCommit.filter((row) => (
            row.surname || row.givenNames || row.unit || row.rank || row.personnelId || row.courseNumber || row.course || row.masterLmp || row.startDate
        )).length;
        const nextUnitDraft = { ...unitDraft, hasTrainees: true };
        setUnitDraft(nextUnitDraft);
        saveSetupTestWizardDrafts(false, { traineeDraft, traineeRows, unitDraft: nextUnitDraft });
        const message = `Committed ${traineeCount} trainee profile${traineeCount === 1 ? '' : 's'} to the trainee list in this setup.`;
        setImportConfirmations((current) => ({ ...current, trainees: message }));
        setTraineeAllocationCommitted(true);
        setShowMoreTraineesPrompt(true);
        setSaveMessage(message);
    };
    const commitWizardCourseLmpEvents = () => {
        const uploadResult = uploadResults.courses;
        const fallbackItemsFromValidatedUpload = uploadedCourseLmpItems.length === 0 && uploadResult?.status === 'valid'
            ? buildWizardCourseUploadItems(uploadResult)
            : [];
        const itemsForCommit = uploadedCourseLmpItems.length > 0 ? uploadedCourseLmpItems : fallbackItemsFromValidatedUpload;
        pushWizardLmpDiag('commit:clicked', {
            stagedCount: uploadedCourseLmpItems.length,
            fallbackParsedCount: fallbackItemsFromValidatedUpload.length,
            effectiveCommitCount: itemsForCommit.length,
            uploadResultStatus: uploadResult?.status,
            uploadResultRows: uploadResult?.dataRows?.length || 0,
            uploadResultHeaders: uploadResult?.headers || [],
            uploadResultIssues: uploadResult?.issues || [],
            uploadResultSampleRows: (uploadResult?.dataRows || []).slice(0, 5),
            stagedSample: uploadedCourseLmpItems.slice(0, 12).map((item) => ({
                id: item.id,
                code: item.code,
                title: item.eventDescription,
                courses: item.courses,
                unit: item.unit,
                location: item.location,
            })),
            fallbackSample: fallbackItemsFromValidatedUpload.slice(0, 12).map((item) => ({
                id: item.id,
                code: item.code,
                title: item.eventDescription,
                courses: item.courses,
                unit: item.unit,
                location: item.location,
            })),
        });
        if (itemsForCommit.length === 0) {
            if (uploadResult?.status === 'valid') {
                importWizardTemplateRows(initialSetupTemplates.find((template) => template.id === 'courses')!, uploadResult);
                setSaveMessage('The uploaded LMP was valid, but no importable event rows were available to commit. Review the parsed LMP rows before trying again.');
                pushWizardLmpDiag('commit:blocked-valid-upload-no-items', {
                    reason: 'Validated upload existed, but neither React-staged items nor synchronous fallback parsing produced commit rows.',
                    uploadHeaders: uploadResult.headers || [],
                    uploadRows: uploadResult.dataRows?.length || 0,
                    sampleRows: (uploadResult.dataRows || []).slice(0, 8),
                });
            } else {
                setSaveMessage('Upload and validate a Courses and LMP events template before committing it.');
                pushWizardLmpDiag('commit:blocked-no-valid-upload', {
                    uploadResultStatus: uploadResult?.status || 'missing',
                    uploadResultIssues: uploadResult?.issues || [],
                });
            }
            return;
        }
        if (uploadedCourseLmpItems.length === 0 && fallbackItemsFromValidatedUpload.length > 0) {
            setUploadedCourseLmpItems(fallbackItemsFromValidatedUpload);
            pushWizardLmpDiag('commit:using-synchronous-upload-fallback', {
                reason: 'React staged state was empty at commit click, so commit is using rows parsed directly from the validated upload result.',
                fallbackItems: fallbackItemsFromValidatedUpload.length,
                fallbackSample: fallbackItemsFromValidatedUpload.slice(0, 12).map((item) => ({
                    id: item.id,
                    code: item.code,
                    title: item.eventDescription,
                    courses: item.courses,
                    unit: item.unit,
                    location: item.location,
                })),
            });
        }
        const cleanLmpCode = String(trainingDraft.lmpCode || itemsForCommit[0]?.courses?.[0] || trainingDraft.lmpName || 'Master LMP').trim();
        const cleanLmpName = String(trainingDraft.lmpName || cleanLmpCode).trim();
        const cleanAccessUnitCode = String(trainingDraft.accessUnitCode || unitDraft.code || '').trim().toUpperCase();
        const cleanUnitHomeLocationCode = String(unitDraft.locationCode || '').trim().toUpperCase();
        const cleanTrainingAccessLocationCode = String(trainingDraft.accessLocationCode || '').trim().toUpperCase();
        const cleanLocationDraftCode = String(locationDraft.code || '').trim().toUpperCase();
        const cleanAccessLocationCode = cleanAccessUnitCode && cleanAccessUnitCode === String(unitDraft.code || '').trim().toUpperCase() && cleanUnitHomeLocationCode
            ? cleanUnitHomeLocationCode
            : cleanTrainingAccessLocationCode || cleanUnitHomeLocationCode || cleanLocationDraftCode;
        pushWizardLmpDiag('commit:resolved-scope', {
            cleanLmpCode,
            cleanLmpName,
            cleanAccessUnitCode,
            cleanUnitHomeLocationCode,
            cleanTrainingAccessLocationCode,
            cleanLocationDraftCode,
            cleanAccessLocationCode,
            activeWizardLocationCode,
            activeWizardLocationRow,
            unitCodeProp: unitCode,
            locationCodeProp: locationCode,
            itemsForCommit: itemsForCommit.length,
        });
        const scopedItems = itemsForCommit.map((item, index) => ({
            ...item,
            id: item.id || `setup-lmp-${normaliseUnitSettingsIdentifier(cleanLmpCode).replace(/[^A-Z0-9]+/g, '-')}-${normaliseUnitSettingsIdentifier(item.code).replace(/[^A-Z0-9]+/g, '-')}-${index + 1}`,
            courses: [cleanLmpCode],
            module: item.module || cleanLmpName || cleanLmpCode,
            phase: item.phase || cleanLmpName || cleanLmpCode,
            location: cleanAccessLocationCode || item.location || '',
            unit: cleanAccessUnitCode || unitDraft.code || item.unit || '',
            lmpType: item.lmpType || 'Master LMP',
            sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
        }));
        pushWizardLmpDiag('commit:prepared-items', {
            cleanLmpCode,
            cleanLmpName,
            scopedItems: scopedItems.length,
            uniqueUnits: Array.from(new Set(scopedItems.map((item) => String(item.unit || '').trim()).filter(Boolean))),
            uniqueLocations: Array.from(new Set(scopedItems.map((item) => String(item.location || '').trim()).filter(Boolean))),
            uniqueCourses: Array.from(new Set(scopedItems.flatMap((item) => item.courses || []).map((course) => String(course || '').trim()).filter(Boolean))),
            scopedSample: scopedItems.slice(0, 20).map((item) => ({
                id: item.id,
                code: item.code,
                title: item.eventDescription,
                courses: item.courses,
                type: item.type,
                unit: item.unit,
                location: item.location,
                sortOrder: item.sortOrder,
            })),
        });
        saveWizardConfig(`Committed ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} to this setup.`, (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const catalogue = Array.isArray(settings.masterLmpCatalogue) ? settings.masterLmpCatalogue : [];
            const accessRules = getOrganisationMasterLmpAccessRules(settings);
            const catalogueExists = catalogue.some((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(cleanLmpCode));
            const accessUnitCode = cleanAccessUnitCode || unitDraft.code;
            const accessExists = accessRules.some((rule: any) => (
                normaliseUnitSettingsIdentifier(rule?.lmpCode) === normaliseUnitSettingsIdentifier(cleanLmpCode)
                && normaliseUnitSettingsIdentifier(rule?.unitCode) === normaliseUnitSettingsIdentifier(accessUnitCode)
            ));
            const nextCatalogueEntry = {
                id: primaryMasterLmp?.id || createWizardRecordId('master-lmp-catalogue'),
                code: cleanLmpCode,
                name: cleanLmpName || cleanLmpCode,
                description: trainingDraft.description,
                status: trainingDraft.status || 'ACTIVE',
            };
            const nextAccessRule = {
                id: primaryMasterLmpRule?.id || createWizardRecordId('master-lmp-access'),
                lmpCode: cleanLmpCode,
                locationCode: cleanAccessLocationCode,
                unitCode: accessUnitCode,
                operationalModel: trainingDraft.accessModel === 'Any Model' ? null : (trainingDraft.accessModel || null),
                accessLevel: trainingDraft.accessLevel || 'Manage',
                status: 'ACTIVE',
            };
            pushWizardLmpDiag('commit:platform-config-updater', {
                cleanLmpCode,
                catalogueBefore: catalogue.map((item: any) => ({ code: item?.code, name: item?.name, status: item?.status })),
                accessBefore: accessRules.map((rule: any) => ({ lmpCode: rule?.lmpCode, locationCode: rule?.locationCode, unitCode: rule?.unitCode, access: rule?.access, status: rule?.status })),
                catalogueExists,
                accessExists,
                nextCatalogueEntry,
                nextAccessRule,
            });
            return {
                ...settings,
                masterLmpCatalogue: catalogueExists
                    ? catalogue.map((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(cleanLmpCode) ? { ...item, ...nextCatalogueEntry } : item)
                    : [...catalogue, nextCatalogueEntry],
                masterLmpAccess: accessExists
                    ? accessRules.map((rule: any) => (
                        normaliseUnitSettingsIdentifier(rule?.lmpCode) === normaliseUnitSettingsIdentifier(cleanLmpCode)
                        && normaliseUnitSettingsIdentifier(rule?.unitCode) === normaliseUnitSettingsIdentifier(accessUnitCode)
                            ? { ...rule, ...nextAccessRule }
                            : rule
                    ))
                    : [...accessRules, nextAccessRule],
            };
        }));
        if (isSetupTestMode || isSetupTestBrowserMode()) {
            const currentSetupConfig = readSetupTestPlatformConfig();
            const beforeOrganisation = Array.isArray(currentSetupConfig.organisations) ? currentSetupConfig.organisations[0] : null;
            pushWizardLmpDiag('commit:before-write-setup-platform-config', {
                organisations: Array.isArray(currentSetupConfig.organisations) ? currentSetupConfig.organisations.length : 0,
                locations: Array.isArray(currentSetupConfig.locations) ? currentSetupConfig.locations.map((location: any) => ({
                    code: location?.code,
                    iataCode: location?.iataCode,
                    name: location?.name,
                })) : [],
                units: Array.isArray(currentSetupConfig.units) ? currentSetupConfig.units.map((unit: any) => ({
                    code: unit?.code,
                    locationCode: unit?.locationCode,
                    operationalModel: unit?.operationalModel || unit?.settings?.operationalModel,
                    hasTrainees: unit?.settings?.hasTrainees,
                })) : [],
                catalogue: (beforeOrganisation?.settings?.masterLmpCatalogue || []).map((item: any) => ({ code: item?.code, name: item?.name, status: item?.status })),
                accessRules: getOrganisationMasterLmpAccessRules(beforeOrganisation?.settings).map((rule: any) => ({
                    lmpCode: rule?.lmpCode,
                    locationCode: rule?.locationCode,
                    unitCode: rule?.unitCode,
                    accessLevel: rule?.accessLevel,
                    access: rule?.access,
                    status: rule?.status,
                })),
            });
            const nextSetupConfig = updatePrimaryOrganisationWithSettings(currentSetupConfig, (settings) => {
                const catalogue = Array.isArray(settings.masterLmpCatalogue) ? settings.masterLmpCatalogue : [];
                const accessRules = getOrganisationMasterLmpAccessRules(settings);
                const catalogueExists = catalogue.some((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(cleanLmpCode));
                const accessUnitCode = cleanAccessUnitCode || unitDraft.code;
                const accessLocationCode = cleanAccessLocationCode;
                const accessExists = accessRules.some((rule: any) => (
                    normaliseUnitSettingsIdentifier(rule?.lmpCode) === normaliseUnitSettingsIdentifier(cleanLmpCode)
                    && normaliseUnitSettingsIdentifier(rule?.unitCode) === normaliseUnitSettingsIdentifier(accessUnitCode)
                ));
                const nextCatalogueEntry = {
                    id: primaryMasterLmp?.id || createWizardRecordId('master-lmp-catalogue'),
                    code: cleanLmpCode,
                    name: cleanLmpName || cleanLmpCode,
                    description: trainingDraft.description,
                    status: trainingDraft.status || 'ACTIVE',
                };
                const nextAccessRule = {
                    id: primaryMasterLmpRule?.id || createWizardRecordId('master-lmp-access'),
                    lmpCode: cleanLmpCode,
                    locationCode: accessLocationCode,
                    unitCode: accessUnitCode,
                    operationalModel: trainingDraft.accessModel === 'Any Model' ? null : (trainingDraft.accessModel || null),
                    accessLevel: trainingDraft.accessLevel || 'Manage',
                    status: 'ACTIVE',
                };
                return {
                    ...settings,
                    masterLmpCatalogue: catalogueExists
                        ? catalogue.map((item: any) => normaliseUnitSettingsIdentifier(item?.code) === normaliseUnitSettingsIdentifier(cleanLmpCode) ? { ...item, ...nextCatalogueEntry } : item)
                        : [...catalogue, nextCatalogueEntry],
                    masterLmpAccess: accessExists
                        ? accessRules.map((rule: any) => (
                            normaliseUnitSettingsIdentifier(rule?.lmpCode) === normaliseUnitSettingsIdentifier(cleanLmpCode)
                            && normaliseUnitSettingsIdentifier(rule?.unitCode) === normaliseUnitSettingsIdentifier(accessUnitCode)
                                ? { ...rule, ...nextAccessRule }
                                : rule
                        ))
                        : [...accessRules, nextAccessRule],
                };
            });
            writeSetupTestPlatformConfig(nextSetupConfig);
            const readBackConfig = readSetupTestPlatformConfig();
            const readBackOrganisation = Array.isArray(readBackConfig.organisations) ? readBackConfig.organisations[0] : null;
            const readBackNormalisedCatalogue = (readBackOrganisation?.settings?.masterLmpCatalogue || []).map((item: any) => ({
                id: item?.id,
                code: item?.code,
                codeKey: normaliseUnitSettingsIdentifier(item?.code),
                name: item?.name,
                status: item?.status,
            }));
            const readBackNormalisedAccess = (readBackOrganisation?.settings?.masterLmpAccess || []).map((rule: any) => ({
                id: rule?.id,
                lmpCode: rule?.lmpCode,
                lmpKey: normaliseUnitSettingsIdentifier(rule?.lmpCode),
                locationCode: rule?.locationCode,
                locationKey: normaliseUnitSettingsIdentifier(rule?.locationCode),
                unitCode: rule?.unitCode,
                unitKey: normaliseUnitSettingsIdentifier(rule?.unitCode),
                operationalModel: rule?.operationalModel,
                model: rule?.model,
                accessLevel: rule?.accessLevel,
                access: rule?.access,
                status: rule?.status,
            }));
            pushWizardLmpDiag('commit:after-write-setup-platform-config', {
                cleanLmpCode,
                activeUnitCode: unitDraft.code,
                activeLocationCode: locationDraft.code,
                organisations: Array.isArray(readBackConfig.organisations) ? readBackConfig.organisations.length : 0,
                units: Array.isArray(readBackConfig.units) ? readBackConfig.units.map((unit: any) => ({
                    code: unit?.code,
                    locationCode: unit?.locationCode,
                    operationalModel: unit?.operationalModel || unit?.settings?.operationalModel,
                })) : [],
                rawCatalogue: readBackNormalisedCatalogue,
                rawAccessRules: readBackNormalisedAccess,
                matchingCatalogue: readBackNormalisedCatalogue.filter((item: any) => item.codeKey === normaliseUnitSettingsIdentifier(cleanLmpCode)),
                matchingAccessRules: readBackNormalisedAccess.filter((rule: any) => rule.lmpKey === normaliseUnitSettingsIdentifier(cleanLmpCode)),
            });
            const existingItems = readSetupTestSyllabus();
            const nextById = new Map(existingItems.map((item: any) => [String(item?.id || item?.code || ''), item]));
            scopedItems.forEach((item) => nextById.set(String(item.id || item.code), item));
            const nextItems = Array.from(nextById.values());
            const matchingExisting = existingItems.filter((item: any) => (item?.courses || []).includes(cleanLmpCode));
            pushWizardLmpDiag('commit:before-write-setup-syllabus', {
                existingItems: existingItems.length,
                matchingExistingItems: matchingExisting.length,
                existingSample: existingItems.slice(0, 20).map((item: any) => ({ id: item?.id, code: item?.code, courses: item?.courses, unit: item?.unit, location: item?.location })),
                writingItems: nextItems.length,
                writingMatchingItems: nextItems.filter((item: any) => (item?.courses || []).includes(cleanLmpCode)).length,
                writingSample: nextItems.slice(0, 20).map((item: any) => ({ id: item?.id, code: item?.code, courses: item?.courses, unit: item?.unit, location: item?.location })),
                writingMatchingSample: nextItems.filter((item: any) => (item?.courses || []).includes(cleanLmpCode)).slice(0, 20).map((item: any) => ({
                    id: item?.id,
                    code: item?.code,
                    courses: item?.courses,
                    unit: item?.unit,
                    location: item?.location,
                    lmpType: item?.lmpType,
                    isActive: item?.isActive,
                })),
            });
            writeSetupTestSyllabus(nextItems);
            const readBackItems = readSetupTestSyllabus();
            try {
                window.localStorage.setItem('neo_lmp_details_active_tab', 'master');
                window.localStorage.setItem('neo_lmp_details_selected_package', cleanLmpCode);
            } catch {
                // Local selection persistence is helpful only; the commit itself has already succeeded.
            }
            pushWizardImportDiag('courses:committed-to-setup-syllabus', {
                importedItems: scopedItems.length,
                lmpCode: cleanLmpCode,
                totalSetupSyllabusItems: nextItems.length,
                sample: scopedItems.slice(0, 8).map((item) => ({ code: item.code, title: item.eventDescription, type: item.type, courses: item.courses })),
            });
            pushWizardLmpDiag('commit:after-write-setup-syllabus', {
                importedItems: scopedItems.length,
                lmpCode: cleanLmpCode,
                totalSetupSyllabusItems: nextItems.length,
                readBackItems: readBackItems.length,
                readBackMatchingItems: readBackItems.filter((item: any) => (item?.courses || []).includes(cleanLmpCode)).length,
                readBackMatchingByNormalisedCourse: readBackItems.filter((item: any) => (item?.courses || []).some((course: any) => normaliseUnitSettingsIdentifier(course) === normaliseUnitSettingsIdentifier(cleanLmpCode))).length,
                readBackUniqueCourses: Array.from(new Set(readBackItems.flatMap((item: any) => item?.courses || []).map((course: any) => String(course || '').trim()).filter(Boolean))),
                readBackUniqueUnits: Array.from(new Set(readBackItems.map((item: any) => String(item?.unit || '').trim()).filter(Boolean))),
                readBackUniqueLocations: Array.from(new Set(readBackItems.map((item: any) => String(item?.location || '').trim()).filter(Boolean))),
                selectedPackageStorage: (() => {
                    try { return window.localStorage.getItem('neo_lmp_details_selected_package'); } catch { return null; }
                })(),
                readBackSample: readBackItems.slice(0, 20).map((item: any) => ({ id: item?.id, code: item?.code, courses: item?.courses, unit: item?.unit, location: item?.location })),
                readBackMatchingSample: readBackItems.filter((item: any) => (item?.courses || []).includes(cleanLmpCode)).slice(0, 20).map((item: any) => ({
                    id: item?.id,
                    code: item?.code,
                    title: item?.eventDescription,
                    courses: item?.courses,
                    unit: item?.unit,
                    location: item?.location,
                    lmpType: item?.lmpType,
                    isActive: item?.isActive,
                })),
            });
        }
        const message = `Committed ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} for ${cleanLmpCode} to this setup.`;
        setImportConfirmations((current) => ({ ...current, courses: message }));
        setSaveMessage(message);
    };
    const renderWizardDataEntry = () => {
        if (visibleStep.id === 'analysis') {
            return promptShell(
                <p>I found <strong>{completedMandatory} of {mandatoryChecks.length}</strong> mandatory setup areas ready. We will now walk through the setup in plain English, one decision at a time.</p>,
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className={wizardLabelClass}>Mandatory setup</p>
                        <p className="mt-1 text-2xl font-black text-slate-950">{completedMandatory}/{mandatoryChecks.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className={wizardLabelClass}>Overall setup</p>
                        <p className="mt-1 text-2xl font-black text-slate-950">{completedChecks}/{checks.length}</p>
                    </div>
                </div>,
            );
        }
        if (visibleStep.id === 'org-name') {
            return promptShell(
                <p>First we are going to set up your organisation. What is the name of your organisation?</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Organisation name', organisationDraft.name, (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({
                        ...draft,
                        name: value,
                        code: draft.code || value,
                        level0Name: value || draft.level0Name,
                        level0Options: value || draft.level0Options,
                    }), 'field-edit:organisation-name'), undefined, 'Organisation')}
                    {wizardField('Short code', organisationDraft.code, (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, code: value }), 'field-edit:organisation-code'), undefined, 'ORG')}
                    {wizardField(
                        'Organisation levels before units',
                        String(normaliseOrganisationLevelCount(organisationDraft.organisationLevelCount, 3)),
                        updateOrganisationLevelCount,
                        Array.from({ length: MAX_INITIAL_SETUP_ORGANISATION_LEVELS - 2 }, (_, index) => String(index + 3)),
                    )}
                    <div className="md:col-span-2">{renderOrganisationPreview()}</div>
                </div>,
            );
        }
        if (visibleStep.id === 'org-level1') {
            return promptShell(
                <p><strong>{organisationDraft.name || organisationDraft.code || 'Your organisation'}</strong> is the top of the tree. The next layer is usually the broadest grouping below it, such as a headquarters, command, service branch, region, or division.</p>,
                organisationLevelAnswer(
                    1,
                    organisationDraft.level1Name,
                    organisationDraft.level1Options,
                    organisationDraft.level1Parents,
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level1Name: value }), 'field-edit:level1-name'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level1Options: value }), 'field-edit:level1-options'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level1Parents: value }), 'field-edit:level1-parents'),
                    'Organisation Level 1',
                    level1ParentOptions,
                ),
            );
        }
        if (visibleStep.id === 'org-level2') {
            return promptShell(
                <p>This layer sits underneath <strong>{organisationDraft.level1Name || 'Level 1'}</strong>. Use it for the organisations that own or manage several lower groups, departments, teams, or regions.</p>,
                organisationLevelAnswer(
                    2,
                    organisationDraft.level2Name,
                    organisationDraft.level2Options,
                    organisationDraft.level2Parents,
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level2Name: value }), 'field-edit:level2-name'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level2Options: value }), 'field-edit:level2-options'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level2Parents: value }), 'field-edit:level2-parents'),
                    'Organisation Level 2\nOrganisation Level 2B',
                    level2ParentOptions,
                ),
            );
        }
        if (visibleStep.id === 'org-level3') {
            return promptShell(
                <p>This layer is usually closest to the units using the app. It might be wings, groups, squadrons, departments, or any other owner level your organisation uses.</p>,
                organisationLevelAnswer(
                    3,
                    organisationDraft.level3Name,
                    organisationDraft.level3Options,
                    organisationDraft.level3Parents,
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level3Name: value }), 'field-edit:level3-name'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level3Options: value }), 'field-edit:level3-options'),
                    (value) => updateOrganisationDraft((draft: typeof organisationDraft) => ({ ...draft, level3Parents: value }), 'field-edit:level3-parents'),
                    'Organisation Level 3\nOrganisation Level 3B',
                    level3ParentOptions,
                ),
            );
        }
        const additionalOrganisationLevelMatch = /^org-level(\d+)$/.exec(visibleStep.id);
        const additionalOrganisationLevelIndex = additionalOrganisationLevelMatch ? Number(additionalOrganisationLevelMatch[1]) : 0;
        if (additionalOrganisationLevelIndex >= 4 && additionalOrganisationLevelIndex <= MAX_INITIAL_SETUP_ORGANISATION_LEVELS) {
            const level = getOrganisationDraftLevel(organisationDraft, additionalOrganisationLevelIndex);
            const parentLevel = getOrganisationDraftLevel(organisationDraft, additionalOrganisationLevelIndex - 1);
            const levelOptions = Array.isArray(level?.options) ? level.options : [];
            return promptShell(
                <p>This layer sits under <strong>{parentLevel.name || `Level ${additionalOrganisationLevelIndex - 1}`}</strong>. Add the items for this level and choose each immediate parent.</p>,
                organisationLevelAnswer(
                    additionalOrganisationLevelIndex,
                    level.name,
                    levelOptions.join('\n'),
                    level.parents,
                    (value) => updateAdditionalOrganisationLevel(additionalOrganisationLevelIndex, { name: value }),
                    (value) => updateAdditionalOrganisationLevel(additionalOrganisationLevelIndex, { options: value }),
                    (value) => updateAdditionalOrganisationLevel(additionalOrganisationLevelIndex, { parents: value }),
                    `${level.name || `Level ${additionalOrganisationLevelIndex}`} item`,
                    getParentOptionsForOrganisationLevel(additionalOrganisationLevelIndex),
                ),
            );
        }
        if (visibleStep.id === 'units-today') {
            const unitRows = parseWizardUnitRows(unitsTodayDraft);
            const unitParentOptions = getWizardUnitParentPathOptions();
            const unitParentMap = getWizardUnitParentPathMap();
            return promptShell(
                <p>List each unit you want to configure in this setup run. Use one line per unit. Format: <strong>Unit code | Unit name</strong>.</p>,
                <div>
                    {wizardTextArea('Units to set up today', unitsTodayDraft, setUnitsTodayDraft, 'UNIT-01 | Unit Name\nUNIT-02 | Training Unit Name', true)}
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className={wizardLabelClass}>Parent organisation for each unit</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            Choose the immediate parent each unit sits under in the organisation tree.
                        </p>
                        {unitRows.length > 0 && unitParentOptions.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {unitRows.map((row) => {
                                    const currentParentPath = unitParentMap.get(normaliseUnitSettingsIdentifier(row.code)) || unitParentOptions[0];
                                    const currentParentValue = formatWizardOrganisationPath(currentParentPath);
                                    return (
                                        <div key={`unit-parent-${row.code}`} className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-center">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{row.code}</p>
                                                <p className="text-xs text-slate-500">{row.name || row.code}</p>
                                            </div>
                                            <label className="block">
                                                <span className={wizardLabelClass}>Parent</span>
                                                <select
                                                    className={`${wizardInputClass} mt-1`}
                                                    value={currentParentValue}
                                                    onChange={(event) => updateWizardUnitParentPath(row.code, event.target.value)}
                                                >
                                                    {unitParentOptions.map((path) => {
                                                        const value = formatWizardOrganisationPath(path);
                                                        return <option key={`${row.code}-${value}`} value={value}>{formatWizardImmediateParentLabel(path)}</option>;
                                                    })}
                                                </select>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                                Add the organisation levels above first, then return here to choose each unit's parent.
                            </p>
                        )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">
                        The wizard will use the first unit for the detailed setup questions, then apply the same structure to every other unit you listed.
                    </p>
                </div>,
            );
        }
        if (visibleStep.id === 'locations-today') {
            const locationRows = parseWizardLocationRows(locationsTodayDraft);
            const editableLocationRows = Array.from({ length: Math.max(locationDraftRowCount, locationRows.length, 1) }, (_, index) => (
                locationRows[index] || { icao: '', iata: '', name: '' }
            ));
            return promptShell(
                <p>Add every locality, base, airfield, or operating location you want available. Use ICAO where known, IATA where available, and the plain English location name.</p>,
                <div>
                    <div className="space-y-3">
                        {editableLocationRows.map((row, rowIndex) => (
                            <div key={`wizard-location-row-${rowIndex}`} className="grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-3">
                                {wizardDataListField('ICAO code', row.icao, (value) => updateWizardLocationRow(rowIndex, 'icao', value), wizardLocationIcaoOptions, 'ICAO code', `icao-${rowIndex}`)}
                                {wizardDataListField('IATA code', row.iata, (value) => updateWizardLocationRow(rowIndex, 'iata', value), wizardLocationIataOptions, 'IATA code', `iata-${rowIndex}`)}
                                {wizardDataListField('Location name', row.name, (value) => updateWizardLocationRow(rowIndex, 'name', value), wizardLocationNameOptions, 'Location name', `location-name-${rowIndex}`)}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`${wizardSmallButtonClass} mt-3`}
                        onClick={() => setLocationDraftRowCount((count) => count + 1)}
                    >
                        Add another locality
                    </button>
                    <p className="mt-3 text-xs leading-5 text-slate-600">
                        ICAO is the four-letter aviation code. IATA is the shorter location code. Start typing a configured code or location name to see matching suggestions.
                    </p>
                </div>,
            );
        }
        if (visibleStep.id === 'location-code') {
            return promptShell(
                <p>Next we will set up the first base or operating location. What is the location code?</p>,
                wizardField('Location code', locationDraft.code, (value) => updateLocationDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, 'LOC1'),
            );
        }
        if (visibleStep.id === 'location-details') {
            return promptShell(
                <p>Confirm the details for the first locality. You will use the same pattern for every locality listed earlier.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardDataListField('ICAO code', locationDraft.code, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        updateLocationDraft((draft) => ({ ...draft, code: value.toUpperCase(), iataCode: matchedProfile?.iata || draft.iataCode, name: matchedProfile?.name || draft.name, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationIcaoOptions, 'ICAO code')}
                    {wizardDataListField('IATA code', locationDraft.iataCode, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        updateLocationDraft((draft) => ({ ...draft, iataCode: value.toUpperCase(), code: matchedProfile?.icao || draft.code, name: matchedProfile?.name || draft.name, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationIataOptions, 'IATA code')}
                    {wizardDataListField('Location name', locationDraft.name, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        updateLocationDraft((draft) => ({ ...draft, name: value, code: matchedProfile?.icao || draft.code, iataCode: matchedProfile?.iata || draft.iataCode, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationNameOptions, 'Location name')}
                    {wizardField('Timezone', locationDraft.timezone, (value) => updateLocationDraft((draft) => ({ ...draft, timezone: value })), undefined, 'UTC')}
                    {wizardField('Training areas', locationDraft.trainingAreas, (value) => updateLocationDraft((draft) => ({ ...draft, trainingAreas: value })), undefined, 'Area A, Area B')}
                </div>,
            );
        }
        if (visibleStep.id === 'unit-code') {
            return promptShell(
                <p>Now we will set up the first unit using the app. What is the unit code and name?</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Unit code', unitDraft.code, (value) => updateUnitDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, 'UNIT-01')}
                    {wizardField('Unit name', unitDraft.name, (value) => updateUnitDraft((draft) => ({ ...draft, name: value })), undefined, 'Unit')}
                </div>,
            );
        }
        if (visibleStep.id === 'unit-model') {
            return promptShell(
                <p>Set the identity and operating model for the first unit. The operating model is important because it controls which scheduler logic applies.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Unit code', unitDraft.code, (value) => updateUnitDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, 'UNIT-01')}
                    {wizardField('Unit name', unitDraft.name, (value) => updateUnitDraft((draft) => ({ ...draft, name: value })), undefined, 'Unit')}
                    {wizardDataListField('Home location', unitDraft.locationCode, (value) => updateUnitDraft((draft) => ({ ...draft, locationCode: value.toUpperCase() })), wizardLocationIcaoOptions, 'LOC1')}
                    {wizardField('Unit type', unitDraft.unitType, (value) => updateUnitDraft((draft) => ({ ...draft, unitType: value })), unitTypeOptions)}
                    {wizardField(
                        'Operational model',
                        getWizardOperationalModelLabel(unitDraft.operationalModel),
                        (label) => {
                            const selected = OPERATIONAL_MODEL_OPTIONS.find((option) => option.label === label);
                            updateUnitDraft((draft) => ({ ...draft, operationalModel: selected?.value || draft.operationalModel }));
                        },
                        OPERATIONAL_MODEL_OPTIONS.map((option) => option.label)
                    )}
                    <label className="block">
                        <span className={wizardLabelClass}>Does this unit use trainees?</span>
                        <button
                            type="button"
                            className={`${wizardInputClass} mt-1 text-left ${unitDraft.hasTrainees ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}
                            onClick={() => updateUnitDraft((draft) => ({ ...draft, hasTrainees: !draft.hasTrainees }))}
                        >
                            {unitDraft.hasTrainees ? 'Yes, trainees on' : 'No, trainees off'}
                        </button>
                    </label>
                </div>,
            );
        }
        if (visibleStep.id === 'resource-aircraft') {
            return promptShell(
                <p>What aircraft type or primary resource should <strong>{unitDraft.code || 'this unit'}</strong> use?</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Aircraft type code', resourceDraft.aircraftCode, (value) => updateResourceDraft((draft) => ({ ...draft, aircraftCode: value.toUpperCase(), aircraftName: draft.aircraftName || value })), undefined, 'Enter aircraft code')}
                    {wizardField('Aircraft type name', resourceDraft.aircraftName, (value) => updateResourceDraft((draft) => ({ ...draft, aircraftName: value })), undefined, 'Enter aircraft or resource type')}
                    {wizardField('DFP Resource Rows name', resourceDraft.poolName, (value) => updateResourceDraft((draft) => ({ ...draft, poolName: value })), undefined, 'DFP Resource Rows')}
                </div>,
            );
        }
        if (visibleStep.id === 'resource-counts') {
            return promptShell(
                <p>Enter how many rows this unit can use on the schedule. These numbers tell NEO what it can place on the flying program.</p>,
                <div className="grid gap-3 md:grid-cols-5">
                    {wizardField('Aircraft', resourceDraft.aircraft, (value) => updateResourceDraft((draft) => ({ ...draft, aircraft: value })))}
                    {wizardField('Sim', resourceDraft.sim, (value) => updateResourceDraft((draft) => ({ ...draft, sim: value })))}
                    {wizardField('Trainer', resourceDraft.trainer, (value) => updateResourceDraft((draft) => ({ ...draft, trainer: value })))}
                    {wizardField('Standby Lines', resourceDraft.standby, (value) => updateResourceDraft((draft) => ({ ...draft, standby: value })))}
                    {wizardField('Ground Lines', resourceDraft.ground, (value) => updateResourceDraft((draft) => ({ ...draft, ground: value })))}
                </div>,
            );
        }
        if (visibleStep.id === 'aircraft-configs') {
            return promptShell(
                <p>Set the aircraft CONFIG records this unit uses. This is the same Aircraft Setup section used in Settings, so changes made here update Settings directly.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-aircraft-setup',
                    'platform-aircraft-type-settings',
                    'Aircraft CONFIG settings saved into Settings.',
                    { focusAircraftTypeCode: resourceDraft.aircraftCode || crewDraft.aircraftCode || primaryAircraftType?.code || '' },
                ),
            );
        }
        if (visibleStep.id === 'crew') {
            return promptShell(
                <p>Tell NEO what normal crew looks like. This prevents the scheduler from creating unrealistic solo or under-crewed events.</p>,
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        {wizardDataListField('Aircraft / resource', crewDraft.aircraftCode || resourceDraft.aircraftCode, (value) => {
                            const nextAircraftCode = value.toUpperCase();
                            updateCrewDraft((draft) => ({ ...draft, aircraftCode: nextAircraftCode }));
                            saveCrewDraftValues(nextAircraftCode, crewDraft.standardSeats, alternateCrewDraft, 'Crew aircraft synced into Settings.');
                        }, Array.from(new Set([resourceDraft.aircraftCode, ...activeAircraftTypes.map((aircraft: any) => aircraft.code)].filter(Boolean))), resourceDraft.aircraftCode || 'Enter aircraft code')}
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                        {renderCrewCompositionEditor('Normal crew required', crewDraft.standardSeats, (value) => {
                            updateCrewDraft((draft) => ({ ...draft, standardSeats: value }));
                            saveCrewDraftValues(crewDraft.aircraftCode || resourceDraft.aircraftCode, value, alternateCrewDraft, 'Normal crew synced into Settings.');
                        })}
                        {renderCrewCompositionEditor('Other approved crew composition', alternateCrewDraft, (value) => {
                            crewDraftDirtyRef.current = true;
                            setAlternateCrewDraft(value);
                            saveCrewDraftValues(crewDraft.aircraftCode || resourceDraft.aircraftCode, crewDraft.standardSeats, value, 'Alternate crew synced into Settings.');
                        }, 'Add crew role')}
                    </div>
                </div>,
            );
        }
        if (visibleStep.id === 'callsigns') {
            return promptShell(
                <p>Set the terminology and callsign rules this unit uses. These are the same Settings records, so changes made here update Settings directly.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-rank-terminology',
                    'platform-unit-callsigns',
                    'Callsign settings saved into Settings.',
                    { formationCallsigns },
                ),
            );
        }
        if (visibleStep.id === 'build-rules') {
            return promptShell(
                <p>Set the main limits NEO must follow when it builds this unit schedule. If you are unsure, leave the current values and refine them later in Settings.</p>,
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Business rules</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {wizardField('Rule set', buildRulesDraft.businessRules, (value) => updateBuildRulesDraft((draft) => ({ ...draft, businessRules: value })), undefined, 'Use configured rule set')}
                            {wizardField('Max dispatch per hour', buildRulesDraft.maxDispatchPerHour, (value) => updateBuildRulesDraft((draft) => ({ ...draft, maxDispatchPerHour: value })), undefined, '2')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Duty limits</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {wizardField('Maximum crew duty hours', buildRulesDraft.maxCrewDutyHours, (value) => updateBuildRulesDraft((draft) => ({ ...draft, maxCrewDutyHours: value })), undefined, '12')}
                            {wizardField('Preferred duty period hours', buildRulesDraft.preferredDutyHours, (value) => updateBuildRulesDraft((draft) => ({ ...draft, preferredDutyHours: value })), undefined, '10')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Turnaround times</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3 md:items-end">
                            {wizardField('Aircraft turnaround minutes', buildRulesDraft.aircraftTurnaroundMinutes, (value) => updateBuildRulesDraft((draft) => ({ ...draft, aircraftTurnaroundMinutes: value })), undefined, '60')}
                            {wizardField('Simulator turnaround minutes', buildRulesDraft.simTurnaroundMinutes, (value) => updateBuildRulesDraft((draft) => ({ ...draft, simTurnaroundMinutes: value })), undefined, '30')}
                            {wizardField('Trainer turnaround minutes', buildRulesDraft.trainerTurnaroundMinutes, (value) => updateBuildRulesDraft((draft) => ({ ...draft, trainerTurnaroundMinutes: value })), undefined, '30')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Event limits</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            {wizardField('Maximum events per day', buildRulesDraft.maxEventsPerDay, (value) => {
                                updateBuildRulesDraft((draft) => ({ ...draft, maxEventsPerDay: value }));
                            }, undefined, 'Optional')}
                            {wizardField('Maximum flights per day', buildRulesDraft.maxFlightsPerDay, (value) => {
                                updateBuildRulesDraft((draft) => ({ ...draft, maxFlightsPerDay: value }));
                            }, undefined, 'Optional')}
                            {wizardField('Min Gap between events minutes', buildRulesDraft.minGapBetweenEventsMinutes, (value) => {
                                updateBuildRulesDraft((draft) => ({ ...draft, minGapBetweenEventsMinutes: value }));
                            }, undefined, '0')}
                        </div>
                    </div>
                </div>,
            );
        }
        if (visibleStep.id === 'advanced-scheduling-rules') {
            return promptShell(
                <p>Check the detailed timing rules and scheduling rule sets. These are the same records used by Settings when NEO places events.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-scheduling-rule-sets',
                    'platform-scheduling-rule-records',
                    'Scheduling rules saved into Settings.',
                ),
            );
        }
        if (visibleStep.id === 'staff') {
            return promptShell(
                <p>Add the staff this unit needs for scheduling, permissions, and records. Put each person into their own row, then commit the list to Staff Profiles.</p>,
                <div>
                    {renderStaffEditor()}
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold leading-5 text-emerald-900">
                            This writes the staff shown above into Staff Profiles for this setup.
                        </p>
                        <button
                            type="button"
                            className={`${wizardPrimaryButtonClass} mt-3`}
                            onClick={commitWizardStaffProfiles}
                        >
                            Commit to Staff Profiles
                        </button>
                    </div>
                </div>,
            );
        }
        if (visibleStep.id === 'trainees') {
            return promptShell(
                <p>{unitDraft.hasTrainees ? 'This unit is marked as having trainees. The next three steps will create courses, upload trainees, then allocate each trainee to a course.' : 'This unit is marked as not having trainees. You can leave the trainee setup steps blank and continue.'}</p>,
                <div>
                    <button
                        type="button"
                        className={`${wizardInputClass} mb-3 text-left ${unitDraft.hasTrainees ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}
                        onClick={() => updateUnitDraft((draft) => ({ ...draft, hasTrainees: !draft.hasTrainees }))}
                    >
                        {unitDraft.hasTrainees ? 'Trainees on' : 'Trainees off'}
                    </button>
                </div>,
            );
        }
        if (visibleStep.id === 'trainee-courses') {
            return promptShell(
                <p>{unitDraft.hasTrainees ? 'Add the course numbers or course names that this unit will use for trainees. These are the choices used in the allocation step.' : 'Trainees are switched off for this unit, so course setup is optional.'}</p>,
                unitDraft.hasTrainees ? renderTraineeEditor('courses') : <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Trainees are off for this unit.</div>,
            );
        }
        if (visibleStep.id === 'trainee-upload') {
            return promptShell(
                <p>{unitDraft.hasTrainees ? 'Upload the trainee template or add trainees manually. Do not allocate courses here; that is the next step.' : 'Trainees are switched off for this unit, so upload is optional.'}</p>,
                unitDraft.hasTrainees ? renderTraineeEditor('details') : <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Trainees are off for this unit.</div>,
            );
        }
        if (visibleStep.id === 'trainee-allocation') {
            return promptShell(
                <p>{unitDraft.hasTrainees ? 'Allocate each trainee to one course. Every trainee must have a course selected before committing to Trainee Profiles.' : 'Trainees are switched off for this unit, so there is nothing to allocate.'}</p>,
                <div>
                    {unitDraft.hasTrainees ? (
                        <>
                            {renderTraineeEditor('allocation')}
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-xs font-semibold leading-5 text-emerald-900">
                                    This writes the trainees shown above into the trainee list for this setup.
                                </p>
                                <button
                                    type="button"
                                    className={`${wizardPrimaryButtonClass} mt-3`}
                                    onClick={commitWizardTraineeProfiles}
                                >
                                    Commit to Trainee Profiles
                                </button>
                            </div>
                            {showMoreTraineesPrompt ? (
                                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                    <p className="text-xs font-semibold leading-5 text-blue-900">
                                        Do you have more trainees to upload for this unit?
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className={wizardSmallButtonClass}
                                            onClick={() => {
                                                setShowMoreTraineesPrompt(false);
                                                setImportConfirmations((current) => {
                                                    const next = { ...current };
                                                    delete next.trainees;
                                                    return next;
                                                });
                                                setSaveMessage('Upload the next trainee file, then allocate the new trainees before committing again.');
                                            }}
                                        >
                                            Upload more trainees
                                        </button>
                                        <button
                                            type="button"
                                            className={wizardPrimaryButtonClass}
                                            onClick={goToNextWizardStep}
                                        >
                                            Continue to next step
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Trainees are off for this unit.</div>}
                </div>,
            );
        }
        if (visibleStep.id === 'master-lmp') {
            return promptShell(
                <p>Choose an existing LMP if it exists, or enter the first LMP to build. This does not change the scheduler logic; it only defines the training stream the unit can use.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardDataListField('Master LMP code', trainingDraft.lmpCode, (value) => updateTrainingDraft((draft) => ({ ...draft, lmpCode: value, lmpName: draft.lmpName || value })), activeMasterLmpCatalogue.map((lmp: any) => String(lmp.code || lmp.name || '')).filter(Boolean), 'Master LMP', 'master-lmp-code')}
                    {wizardField('Master LMP name', trainingDraft.lmpName, (value) => updateTrainingDraft((draft) => ({ ...draft, lmpName: value })), undefined, 'Training Programme')}
                    {wizardTextArea('Description', trainingDraft.description, (value) => updateTrainingDraft((draft) => ({ ...draft, description: value })), 'Initial programme or qualification stream')}
                </div>,
            );
        }
        if (visibleStep.id === 'training-records') {
            return promptShell(
                <p>Set the training report names and grading labels for this unit. These choices control what the report is called and how pass/fail grading appears to users.</p>,
                renderTrainingRecordsEditor(),
            );
        }
        if (visibleStep.id === 'unit-modules') {
            return promptShell(
                <p>Choose which app modules this unit should see. Leave a module on if the unit needs that workflow; turn it off if the unit should not use it yet.</p>,
                renderUnitModulesEditor(),
            );
        }
        if (visibleStep.id === 'ranks-labels') {
            return promptShell(
                <p>Choose how DFP NEO should read the rank table when it sorts people. The full rank table is already managed in Settings, so this step only confirms the preset and display behaviour for this setup.</p>,
                renderRankLabelsEditor(),
            );
        }
        if (visibleStep.id === 'crew-roles') {
            return promptShell(
                <p>Set the approved crew role names this unit can use. These names become the dropdown choices when you define normal and alternate crew composition.</p>,
                renderCrewRolesEditor(),
            );
        }
        if (visibleStep.id === 'resource-sharing') {
            return promptShell(
                <p>Decide whether this unit can borrow resources or staff from other units, and make the consequence clear before setup is saved.</p>,
                renderSharingEditor(),
            );
        }
        if (visibleStep.id === 'currencies') {
            return promptShell(
                <p>Create the {configuredContinuationCurrencyEventsLabel} records this unit will use. The full event setup can still be refined after setup, but these records give the unit useful request and build settings immediately.</p>,
                renderCurrencyEditor(),
            );
        }
        if (visibleStep.id === 'access') {
            return promptShell(
                <p>Manage the users who can access this unit. This is the same permission manager used in Settings, so changes made here update Settings directly.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-user-access',
                    'platform-user-access-records',
                    'User permissions saved into Settings.',
                ),
            );
        }
        if (visibleStep.id === 'deployment-readiness') {
            return promptShell(
                <p>Record the deployment settings administrators need before the system is used operationally. This is the same deployment readiness section used in Settings.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-deployment-readiness',
                    'platform-deployment-profile',
                    'Deployment readiness saved into Settings.',
                ),
            );
        }
        if (visibleStep.id === 'operational-runbook') {
            return promptShell(
                <p>Record the support, backup and recovery details administrators need for operational handover. This is the same support and recovery section used in Settings.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-operational-runbook',
                    'platform-operational-runbook-identity',
                    'Support and recovery details saved into Settings.',
                ),
            );
        }
        if (visibleStep.id === 'licensing') {
            return promptShell(
                <p>Record licence details and limits if this deployment is using licence tracking. This is the same licence section used in Settings.</p>,
                renderWizardPlatformSettingsEmbed(
                    'platform-licensing',
                    'platform-license-records',
                    'Licence details saved into Settings.',
                ),
            );
        }
        if (visibleStep.id === 'scoring') {
            return promptShell(
                <p>Set up the wording instructors will use when grading training report assessment areas. You can enter it here or upload the scoring matrix template below.</p>,
                renderScoringEditor(),
            );
        }
        if (visibleStep.id === 'staff-currency-events') {
            return promptShell(
                <p>Set up common {configuredContinuationShortLabel} and currency event settings for this unit. These become reusable starting points for staff checks and currency events.</p>,
                renderStandardCurrencyEventsEditor(),
            );
        }
        return promptShell(
            <p>
                Each step is saved into Settings when you click <strong>Next</strong>. Use this page to check the setup. If something is wrong, go back to that step and change it. No extra save is required on this review page.
            </p>,
            <div className="grid gap-2 text-sm">
                {[
                    {
                        label: 'Organisation name',
                        value: organisationDraft.name || organisationDraft.code || 'Not set',
                        help: `This is the organisation the ${unitDraft.code || 'unit'} belongs to.`,
                    },
                    {
                        label: 'Organisation levels',
                        value: `${fromLines(organisationDraft.level1Options).length} names at Level 1; ${fromLines(organisationDraft.level2Options).length} names at Level 2; ${fromLines(organisationDraft.level3Options).length} names at Level 3. ${organisationPreviewLinks.length} reporting links set.`,
                        help: 'Check that the organisation tree matches how your real organisation is arranged.',
                    },
                    {
                        label: 'Operating location',
                        value: `${locationDraft.name || 'Not named'}${locationDraft.code ? ` (${locationDraft.code})` : ''}`,
                        help: 'This is the main airfield or base used by this unit.',
                    },
                    {
                        label: 'Locations to create',
                        value: parseWizardLocationRows(locationsTodayDraft).map((location) => `${location.name || 'Unnamed location'} (${location.icao || 'no ICAO'}${location.iata ? `, ${location.iata}` : ''})`).join('\n') || 'Not set',
                        help: 'These are the bases or airfields available to the organisation.',
                    },
                    {
                        label: 'Units to create',
                        value: parseWizardUnitRows(unitsTodayDraft).map((unit) => `${unit.name || unit.code || 'Unnamed unit'}${unit.code ? ` (${unit.code})` : ''}`).join('\n') || 'Not set',
                        help: 'These are the squadrons, schools, departments or other units being added now.',
                    },
                    {
                        label: 'This unit',
                        value: `${unitDraft.name || unitDraft.code || 'Not set'} uses the ${getWizardOperationalModelLabel(unitDraft.operationalModel)}.`,
                        help: 'Check this is the unit you are configuring and that the operating model is correct.',
                    },
                    {
                        label: 'Aircraft and rows',
                        value: `${resourceDraft.aircraftCode || 'No aircraft type set'}: ${resourceDraft.aircraft || '0'} aircraft rows, ${resourceDraft.sim || '0'} simulator rows, ${resourceDraft.trainer || '0'} trainer rows, ${resourceDraft.standby || '0'} standby rows, ${resourceDraft.ground || '0'} ground rows.`,
                        help: 'These numbers control what rows appear on the DFP schedule for this unit.',
                    },
                    {
                        label: 'Aircraft CONFIG',
                        value: (() => {
                            const configs = getWizardAircraftConfigDefinitions();
                            return configs.length > 0
                                ? configs.map((config: any) => `${config.code || config.name || 'CONFIG'}${config.label || config.name ? ` - ${config.label || config.name}` : ''}`).join('\n')
                                : 'Not set';
                        })(),
                        help: 'These are the aircraft configuration options users can choose when planning or building events.',
                    },
                    {
                        label: 'Crew roles',
                        value: parseWizardCrewRoleRows(crewRolesDraft).map((row) => `${row.label || row.role || 'Crew role'}${row.models ? ` - used by ${row.models}` : ''}`).join('\n') || 'Not set',
                        help: 'These are the crew position names users can choose from when setting crew rules.',
                    },
                    {
                        label: 'Normal crew',
                        value: parseRoleRequirementsText(crewDraft.standardSeats).map((row) => `${row.count} x ${row.role}`).join('\n') || 'Not set',
                        help: 'This tells NEO what a normal crew looks like for the aircraft or resource.',
                    },
                    {
                        label: 'Callsign rules',
                        value: hasMeaningfulCallsignSettings()
                            ? `${hasMeaningfulUnitCallsignSettings() ? 'Unit callsign prefixes set.' : 'Unit callsign prefixes not set.'} ${hasMeaningfulFormationCallsigns() ? 'Formation callsigns set.' : 'Formation callsigns not set.'}`.trim()
                            : 'Not set',
                        help: 'These rules help DFP NEO suggest callsigns instead of making users type them from scratch.',
                    },
                    {
                        label: 'Scheduling limits',
                        value: buildRulesDraftText || 'Not set',
                        help: 'These limits help prevent the build from placing too much flying, too close together, or beyond duty limits.',
                    },
                    {
                        label: 'Advanced scheduling rules',
                        value: hasMeaningfulSchedulingRuleSettings() ? 'Detailed timing or rule-set records are configured.' : 'Not set',
                        help: 'These records control default event timings and detailed scheduling behaviour.',
                    },
                    {
                        label: 'Resource and staff sharing',
                        value: parseWizardSharingRows(resourceSharingDraft).map((row) => {
                            const sharingName = row.type || 'Sharing';
                            const state = /^on$/i.test(row.enabled) ? 'On' : 'Off';
                            const sharedWith = row.units ? ` Shared with: ${row.units}.` : '';
                            return `${sharingName}: ${state}.${sharedWith} ${row.consequence || ''}`.trim();
                        }).join('\n') || 'Not set',
                        help: 'This shows whether the unit can share aircraft, resource rows or staff with other units.',
                    },
                    {
                        label: 'App areas',
                        value: parseWizardUnitModuleDraftRows().map((row) => `${row.module || 'App area'}: ${/^on$/i.test(row.enabled) ? 'On' : 'Off'}`).join('\n') || 'Not set',
                        help: 'These choices decide which major parts of DFP NEO this unit can use.',
                    },
                    {
                        label: 'Rank display',
                        value: `Rank preset: ${RANK_EQUIVALENCY_PRESET_LABELS[rankSettingsDraft.preset as RankEquivalencyPresetKey] || 'Australia'}. Lists sort by ${rankSettingsDraft.sortMode === 'alphabetical' ? 'name only' : 'rank, then name'}. Trainees use the staff rank order.`,
                        help: 'This controls how names are ordered in staff, trainee and crew selection lists.',
                    },
                    {
                        label: 'Training report names',
                        value: (() => {
                            const row = parseWizardTrainingReportRows(trainingRecordsDraft)[0];
                            if (!row) return 'Not set';
                            return `${row.organisationFormName || row.genericFormName || 'Training report'} uses grades ${row.lowestGrade || '0'} to ${row.highestGrade || '5'}. Satisfactory is shown as "${row.satisfactoryLabel || 'PASS'}" and unsatisfactory is shown as "${row.unsatisfactoryLabel || 'FAIL'}".`;
                        })(),
                        help: 'These names and grading labels are what users see when completing training reports.',
                    },
                    {
                        label: 'Scoring wording',
                        value: (() => {
                            const rows = parseWizardScoringRows(scoringDraft);
                            return rows.length > 0
                                ? `${rows.length} assessment area${rows.length === 1 ? '' : 's'} set: ${rows.map((row) => row.dimension).filter(Boolean).join(', ') || 'names not set'}.`
                                : 'Not set';
                        })(),
                        help: 'These are the phrases instructors use to describe performance at each grade level.',
                    },
                    {
                        label: 'Currencies and checks',
                        value: parseWizardCurrencyRows(currencyDraft).map((row) => `${row.name || row.code || 'Currency'}${row.code ? ` (${row.code})` : ''}${row.currency ? ` tracks ${row.currency}` : ''}.`).join('\n') || 'Not set',
                        help: 'These are the currency or qualification records the unit will track.',
                    },
                    {
                        label: 'Staff currency presets',
                        value: parseWizardStandardCurrencyEventRows(staffCurrencyEventsDraft).map((row) => `${row.name || row.shortTitle || 'Staff currency event'}${row.resourceType ? ` - ${row.resourceType}` : ''}${row.duration ? `, ${row.duration} minutes` : ''}.`).join('\n') || 'Not set',
                        help: 'These are reusable starting points for common staff currency events.',
                    },
                    {
                        label: 'User permissions',
                        value: activeUserAccess.length > 0 ? `${activeUserAccess.length} active user access record${activeUserAccess.length === 1 ? '' : 's'} set.` : 'Not set',
                        help: 'This controls who can open this unit and what they are allowed to do.',
                    },
                    {
                        label: 'Deployment readiness',
                        value: hasMeaningfulDeploymentProfile() ? 'Deployment readiness details are set.' : 'Not set',
                        help: 'These records describe how this installation is licensed, connected and prepared for operational use.',
                    },
                    {
                        label: 'Support and recovery',
                        value: hasMeaningfulOperationalRunbook() ? 'Support and recovery details are set.' : 'Not set',
                        help: 'These records identify support contacts, backup settings and recovery targets.',
                    },
                    {
                        label: 'Licensing',
                        value: hasMeaningfulLicenceSettings() ? 'Licence records are set.' : 'Not set',
                        help: 'These records are used when the deployment needs licence tracking.',
                    },
                    {
                        label: 'Staff list',
                        value: (() => {
                            const rows = parseWizardStaffRows(staffDraft).filter((row) => row.surname || row.givenNames);
                            return rows.length > 0
                                ? `${rows.length} staff member${rows.length === 1 ? '' : 's'} ready to add: ${rows.slice(0, 5).map((row) => `${row.givenNames} ${row.surname}`.trim()).join(', ')}${rows.length > 5 ? ', and others' : ''}.`
                                : 'Not set';
                        })(),
                        help: 'These staff records can be added now or after the wizard is finished.',
                    },
                    {
                        label: 'Trainee list',
                        value: unitDraft.hasTrainees ? (() => {
                            const rows = parseWizardTraineeRows(traineeDraft).filter((row) => row.surname || row.givenNames);
                            return rows.length > 0
                                ? `${rows.length} trainee${rows.length === 1 ? '' : 's'} ready to add: ${rows.slice(0, 5).map((row) => `${row.givenNames} ${row.surname}`.trim()).join(', ')}${rows.length > 5 ? ', and others' : ''}.`
                                : 'Not set';
                        })() : 'Trainees are switched off for this unit.',
                        help: 'These trainee records can be added now or after the wizard is finished.',
                    },
                    {
                        label: 'Training event list',
                        value: `${trainingDraft.lmpName || trainingDraft.lmpCode || 'Not set'}${trainingDraft.lmpCode ? ` (${trainingDraft.lmpCode})` : ''}`,
                        help: 'This is the training event list the unit will use for syllabus or LMP events.',
                    },
                ].map(({ label, value, help }) => (
                    <div key={label} className="grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 md:grid-cols-[170px_minmax(0,1fr)]">
                        <span className="font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
                        <span className="min-w-0">
                            <span className="block whitespace-pre-line font-bold text-slate-900">{value}</span>
                            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{help}</span>
                        </span>
                    </div>
                ))}
            </div>,
            'Finish review',
            () => setSaveMessage('Setup review complete. Each step has already been saved into Settings.'),
        );
    };

    if (mode === 'detect' && isPartiallyConfigured) {
        return (
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-slate-900 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Initial Setup Wizard</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">DFP-NEO is partly configured</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    I found {completedMandatory} of {mandatoryChecks.length} mandatory setup areas already complete. You can continue from your last wizard page, or start the guide again from the beginning. Each step syncs into Settings when you click Next.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" className={wizardChoiceClass} onClick={resumeWizard}>
                        <span className="block text-base font-bold">Continue setup</span>
                        <span className="mt-1 block text-xs font-medium text-slate-600">Resume from the last wizard page.</span>
                    </button>
                    <button type="button" className={wizardChoiceClass} onClick={resetWizard}>
                        <span className="block text-base font-bold">Start again</span>
                        <span className="mt-1 block text-xs font-medium text-slate-600">Restart the guide from step one.</span>
                    </button>
                </div>
            </div>
        );
    }

    const renderTemplatePanel = (className = 'h-fit') => (
        <aside className={`${className} min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-900 shadow-sm`}>
            <h4 className="text-sm font-black text-slate-950">Templates and uploads</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">
                This step can use a template. Download it, fill it in, then upload it here. I will check the format and explain anything that needs fixing in plain English.
            </p>
            <div className="mt-4 space-y-3">
                {visibleTemplates.map((template) => {
                    const result = uploadResults[template.id];
                    const importConfirmation = importConfirmations[template.id];
                    const isValid = result?.status === 'valid';
                    const isError = result?.status === 'error';
                    return (
                        <div
                            key={template.id}
                            className={`rounded-lg border bg-white p-3 shadow-sm ${
                                isValid ? 'border-emerald-300' : isError ? 'border-red-300' : 'border-slate-300'
                            }`}
                            onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'copy';
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                void handleTemplateFile(template.id, event.dataTransfer.files?.[0]);
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold text-slate-950">{template.label}</p>
                                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                        Required: {template.requiredHeaders.join(', ')}
                                    </p>
                                </div>
                                <button type="button" className={wizardSmallButtonClass} onClick={() => downloadWizardTemplate(template)}>
                                    Download
                                </button>
                            </div>
                            <button
                                type="button"
                                className="mt-3 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
                                onClick={() => selectTemplateFile(template.id)}
                            >
                                Drop file here or click to upload
                            </button>
                            {result ? (
                                <div className={`mt-3 rounded-md px-3 py-2 text-xs leading-5 ${
                                    isValid ? 'bg-emerald-50 text-emerald-800' : isError ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    <p className="font-bold">{result.message}</p>
                                    {result.issues?.length ? (
                                        <ul className="mt-1 list-disc space-y-1 pl-4">
                                            {result.issues.map((issue) => <li key={issue}>{issue}</li>)}
                                        </ul>
                                    ) : null}
                                    {isValid ? (
                                        <>
                                            <button
                                                type="button"
                                                className={`${wizardPrimaryButtonClass} mt-3`}
                                                onClick={() => template.id === 'courses'
                                                    ? commitWizardCourseLmpEvents()
                                                    : importWizardTemplateRows(template, result)
                                                }
                                            >
                                                {importConfirmation
                                                    ? template.id === 'staff'
                                                        ? 'Commit uploaded staff again'
                                                        : template.id === 'trainees'
                                                            ? 'Load another trainee file'
                                                            : template.id === 'courses'
                                                                ? 'Commit uploaded LMP events'
                                                                : 'Import again'
                                                    : template.id === 'staff'
                                                        ? 'Commit uploaded staff to Staff Profiles'
                                                        : template.id === 'trainees'
                                                            ? 'Load trainees for allocation'
                                                            : template.id === 'courses'
                                                                ? 'Commit uploaded LMP events'
                                                                : `Import into ${template.id === 'scoring' ? 'scoring matrix' : 'wizard'}`
                                                }
                                            </button>
                                            {importConfirmation ? (
                                                <div className="mt-3 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-bold leading-5 text-emerald-800">
                                                    {importConfirmation}
                                                </div>
                                            ) : null}
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
    const placeTemplatesBelow = visibleStep.id === 'staff' || visibleStep.id === 'trainee-upload' || visibleStep.id === 'master-lmp' || visibleStep.id === 'scoring';

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (pendingTemplateId) void handleTemplateFile(pendingTemplateId, file);
                }}
            />
            <div className={`grid max-w-full min-w-0 gap-3 overflow-hidden ${visibleTemplates.length > 0 && !placeTemplatesBelow ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
                <div className="min-w-0 space-y-3">
                    {renderWizardDataEntry()}
                    {visibleTemplates.length > 0 && placeTemplatesBelow ? renderTemplatePanel('') : null}
                    {saveMessage ? (
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
                            {saveMessage}
                        </div>
                    ) : null}
                </div>

                {visibleTemplates.length > 0 && !placeTemplatesBelow ? renderTemplatePanel() : null}
            </div>

        </div>
    );
};

const OrganisationSlideoutDiagram: React.FC<{
    platformConfig?: any;
    organisationSettings?: any;
    unitCode?: string;
    locationCode?: string;
    formationCallsigns?: FormationCallsign[];
    buildRuleSettings?: ScheduleViewProps['buildRuleSettings'];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
    currentUserPermission?: AppUserPermission;
    canUsePlatformPermission?: (permissionId: string) => boolean;
    isSetupTestMode?: boolean;
    onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
    isOpen?: boolean;
    onInitialSetupWizardActiveChange?: (active: boolean) => void;
}> = ({ platformConfig, organisationSettings, unitCode, locationCode, formationCallsigns = [], buildRuleSettings, onUpdatePlatformConfig, onNavigateToSettingsSection, currentUserPermission = 'Staff', canUsePlatformPermission, isSetupTestMode = false, onSaveSetupTestPersonnel, isOpen = false, onInitialSetupWizardActiveChange }) => {
    const chart = useMemo(() => buildOrganisationChart(platformConfig), [platformConfig]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<OrganisationSlideoutView>('structure');
    useEffect(() => {
        onInitialSetupWizardActiveChange?.(Boolean(isOpen && activeView === 'setupWizard'));
        return () => onInitialSetupWizardActiveChange?.(false);
    }, [activeView, isOpen, onInitialSetupWizardActiveChange]);
    useEffect(() => {
        if (selectedNodeId && chart && !findOrganisationChartPath(chart, selectedNodeId)) {
            setSelectedNodeId(null);
        }
    }, [chart, selectedNodeId]);
    const selectedPath = useMemo(() => {
        if (!chart || !selectedNodeId) return null;
        return findOrganisationChartPath(chart, selectedNodeId);
    }, [chart, selectedNodeId]);
    const selectedPathIds = useMemo(() => selectedPath ? new Set(selectedPath.map((node) => node.id)) : EmptyOrganisationChartSet, [selectedPath]);
    const selectedNode = selectedPath?.[selectedPath.length - 1] || null;
    const focusedPath = selectedNode && selectedNode.levelIndex >= 3 ? selectedPath : null;
    const handleSelectNode = useCallback((node: OrganisationChartNode) => {
        setSelectedNodeId((current) => current === node.id ? null : node.id);
    }, []);
    const unitCount = (platformConfig?.units || []).filter((unit: any) => String(unit?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const levelHeights = chart ? getOrganisationChartLevelHeights(chart) : new Map<number, number>();
    const chartMetrics = chart ? getOrganisationChartVisibleMetrics(chart, levelHeights, focusedPath, selectedPathIds) : { width: 560, height: 320 };
    return (
        <div className={`organisation-slideout-scroll-stable h-full overflow-y-auto px-5 py-4 text-slate-100 ${activeView === 'structure' ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
            <style>{`
                /* Keep connector rules aligned with docs/organisation-chart-rendering.md. */
                .org-chart { display: inline-flex; min-width: 100%; justify-content: center; padding: 10px 18px 22px; }
                .org-chart ul { position: relative; display: flex; justify-content: center; gap: 20px; padding: 42px 0 0; margin: 0; list-style: none; }
                .org-chart li { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 132px; isolation: isolate; }
                .org-chart li.org-chart-compact-node { min-width: 66px; }
                .org-chart li::before, .org-chart li::after { content: ''; position: absolute; top: -18px; z-index: 0; width: calc(50% + 10px); height: 18px; border-top: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart li::before { right: 50%; }
                .org-chart li::after { left: 50%; }
                .org-chart li:only-child::before, .org-chart li:only-child::after { display: none; }
                .org-chart li:first-child::before, .org-chart li:last-child::after { border-top: 0; }
                .org-chart li:first-child::after { border-top-left-radius: 0; }
                .org-chart li:last-child::before { border-top-right-radius: 0; }
                .org-chart ul ul::before { content: ''; position: absolute; top: 0; left: 50%; z-index: 0; height: 24px; border-left: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart > ul > li::before, .org-chart > ul > li::after { display: none; }
                .org-chart > ul { padding-top: 0; }
                .org-chart-box { position: relative; z-index: 2; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; min-width: 132px; max-width: 168px; min-height: 62px; border: 1px solid rgba(103, 232, 249, 0.46); background: linear-gradient(180deg, rgb(15, 23, 42), rgb(2, 6, 23)); color: #e5faff; box-shadow: 0 12px 22px rgba(0,0,0,0.26); padding: 9px 10px; text-align: center; transition: border-color 160ms ease, transform 160ms ease, background 160ms ease; }
                .org-chart ul ul > li > .org-chart-box::before { content: ''; position: absolute; top: -18px; left: 50%; z-index: -1; height: 18px; width: 0; border-left: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart > ul > li > .org-chart-box::before { display: none; }
                .org-chart-box:hover { border-color: rgba(165, 243, 252, 0.9); background: linear-gradient(180deg, rgb(8, 47, 73), rgb(8, 13, 28)); transform: translateY(-1px); }
                .org-chart-box-active-chain { border-color: rgba(74, 222, 128, 0.95); box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.42), 0 12px 22px rgba(0,0,0,0.26); }
                .org-chart-box-selected { background: linear-gradient(180deg, rgb(20, 83, 45), rgb(6, 78, 59)); }
                .org-chart-box-root { min-width: 190px; border-color: rgba(34, 211, 238, 0.82); background: linear-gradient(180deg, rgb(15, 82, 105), rgb(15, 23, 42)); }
                .org-chart-box-compact { min-width: 66px; max-width: 84px; min-height: 54px; padding: 7px 6px; }
                .org-chart-node-level-2 { min-width: 84px; }
                .org-chart-box-level-2 { width: 84px; min-width: 84px; max-width: 84px; height: 74px; min-height: 74px; }
                .org-chart-node-level-3 { min-width: 66px; }
                .org-chart-box-level-3 { width: 66px; min-width: 66px; max-width: 66px; height: 54px; min-height: 54px; }
                .org-chart-node-level-4 { min-width: 66px; }
                .org-chart-box-level-4 { width: 66px; min-width: 66px; max-width: 66px; height: 54px; min-height: 54px; }
                .org-chart-box-unit { border-color: rgba(74, 222, 128, 0.52); }
                .org-chart-level { display: block; margin-bottom: 3px; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(125, 211, 252, 0.78); }
                .org-chart-label { display: block; font-size: 12px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }
                .org-chart-box-compact .org-chart-level { font-size: 7px; letter-spacing: 0.08em; }
                .org-chart-box-compact .org-chart-label { font-size: 10px; line-height: 1.12; }
                .org-chart ul.org-chart-drilldown-row { position: absolute; top: calc(100% + 34px); left: 50%; z-index: 4; transform: translateX(-50%); padding-top: 0; gap: 14px; }
                .org-chart ul.org-chart-drilldown-row::before { top: -34px; height: 17px; display: block; }
                .org-chart ul.org-chart-drilldown-row > li::before, .org-chart ul.org-chart-drilldown-row > li::after { top: -17px; height: 17px; width: calc(50% + 7px); }
                .org-chart ul.org-chart-drilldown-row > li > .org-chart-box::before { top: -17px; height: 17px; }
                .org-chart ul.org-chart-vertical-level { flex-direction: column; align-items: center; gap: 8px; padding-top: 34px; }
                .org-chart ul.org-chart-vertical-level::before { height: 20px; }
                .org-chart ul.org-chart-vertical-level > li { min-width: 66px; }
                .org-chart ul.org-chart-vertical-level > li::before, .org-chart ul.org-chart-vertical-level > li::after { display: none; }
                .org-chart ul.org-chart-vertical-level > li > .org-chart-box::before { display: none; }
                .org-chart ul.org-chart-vertical-level > li:first-child > .org-chart-box::before { display: block; top: -14px; height: 14px; border-left-color: rgba(103, 232, 249, 0.34); }
                .org-chart ul.org-chart-vertical-level > li:not(:last-child) > .org-chart-box::after { content: ''; position: absolute; top: 100%; left: 50%; z-index: -1; height: 8px; width: 0; border-left: 1px solid rgba(103, 232, 249, 0.34); }
            `}</style>
            <div className="mb-4 border-b border-cyan-400/20 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={activeView === 'structure' ? organisationSlideoutActiveButtonClass : organisationSlideoutInactiveButtonClass}
                        onClick={() => setActiveView('structure')}
                    >
                        Organisation Structure
                    </button>
                    <button
                        type="button"
                        className={activeView === 'unitSettings' ? organisationSlideoutActiveButtonClass : organisationSlideoutInactiveButtonClass}
                        onClick={() => setActiveView('unitSettings')}
                    >
                        My Unit Settings
                    </button>
                    <button
                        type="button"
                        className={activeView === 'setupWizard' ? organisationSlideoutActiveButtonClass : organisationSlideoutInactiveButtonClass}
                        onClick={() => setActiveView('setupWizard')}
                    >
                        Initial Setup Wizard
                    </button>
                </div>
                <div>
                    <p className="mt-1 text-xs text-slate-400">{unitCount} configured units mapped from Settings.</p>
                </div>
            </div>
            {activeView === 'structure' ? (
                chart ? (
                    <div
                        className="inline-block rounded border border-cyan-400/20 bg-slate-950/55"
                        style={{
                            minWidth: '100%',
                            width: `max(100%, ${chartMetrics.width}px)`,
                            minHeight: chartMetrics.height,
                        }}
                    >
                        <div className="org-chart">
                            <ul>
                                <OrganisationChartBranch
                                    node={chart}
                                    isRoot
                                    levelHeights={levelHeights}
                                    selectedNodeId={selectedNodeId}
                                    selectedPathIds={selectedPathIds}
                                    focusedPath={focusedPath}
                                    onSelectNode={handleSelectNode}
                                />
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded border border-cyan-400/20 bg-slate-950/55 p-6 text-center text-xs text-slate-400">
                        No organisation structure has been configured.
                    </div>
                )
            ) : activeView === 'unitSettings' ? (
                <OrganisationMyUnitSettings
                    platformConfig={platformConfig}
                    unitCode={unitCode}
                    formationCallsigns={formationCallsigns}
                    buildRuleSettings={buildRuleSettings}
                    onUpdatePlatformConfig={onUpdatePlatformConfig}
                    onNavigateToSettingsSection={onNavigateToSettingsSection}
                />
            ) : (
                <div className="max-w-full overflow-x-hidden">
                    <InitialSetupWizard
                        platformConfig={platformConfig}
                        organisationSettings={organisationSettings}
                        unitCode={unitCode}
                        locationCode={locationCode}
                        formationCallsigns={formationCallsigns}
                        buildRuleSettings={buildRuleSettings}
                        onUpdatePlatformConfig={onUpdatePlatformConfig}
                        onNavigateToSettingsSection={onNavigateToSettingsSection}
                        currentUserPermission={currentUserPermission}
                        canUsePlatformPermission={canUsePlatformPermission}
                        isSetupTestMode={isSetupTestMode}
                        onSaveSetupTestPersonnel={onSaveSetupTestPersonnel}
                    />
                </div>
            )}
        </div>
    );
};

const ScheduleView: React.FC<ScheduleViewProps> = ({
    date, onDateChange, onDateSelect, snapshotDates = [], events, resources, instructors, traineesData, instructorsData = [], airframeCount, standbyCount, ftdCount, cptCount,
    onUpdateEvent, onSelectEvent, onReorderResources, zoomLevel, showValidation, showPrePost, syllabusDetails,
    personnelData, seatConfigs, daylightTimes, personnelConflicts, personnelConflictIds, unavailabilityConflicts,
    onCptConflict, isMultiSelectMode, selectedEventIds, setSelectedEventIds, baselineEvents,
    isVisualAdjustMode = false, visualAdjustEvent = null, onVisualAdjustTimeChange,
    isOracleMode,
    isNeoBuild = false, oraclePreviewEvent, onOracleMouseDown, onOracleMouseMove, onOracleMouseUp,
    detectConflictsForEvent, showDepartureDensityOverlay, dispatchRateWindowMinutes = DEFAULT_DISPATCH_RATE_WINDOW_MINUTES,
    showAircraftAvailability, initialAvailability, apiBase, locationCode, unitCode, dayFlyingStart, dayFlyingEnd, onAvailabilityChange, onUserAvailabilityChange,
    isPauseSelectMode = false, pauseCompletedEventIds, onPauseToggleCompleted,
    alertsData,
    formatResourceLabel,
    aircraftConfigLabelsByResource,
    aircraftNumberSettings,
    flyingWindowExclusions = [],
    isReadOnly = false,
    onOpenCurrentDfp,
    onExternalEventDrop,
    diagnosticHighlightedEventIds = new Set<string>(),
    platformConfig,
    organisationSettings,
    onUpdatePlatformConfig,
    onNavigateToSettingsSection,
    currentUserPermission = 'Staff',
    canUsePlatformPermission,
    personnelDisplaySettings: personnelDisplaySettingsInput,
    isSetupTestMode = false,
    onSaveSetupTestPersonnel,
    isNeoAssistPanelOpen = false,
    isFlightLinePanelOpen = false,
    onOrganisationSlideoutOpen,
    onToggleFlightLinePanel,
    canEditFlightLineInventory = true,
    canEditFlightLineAvailability = true,
    canEditFlightLineAvailabilityLink = false,
    canEditTileAircraftNumber = true,
    onLinkedAvailabilityChange,
    onInitialSetupWizardActiveChange,
    formationCallsigns = [],
    buildRuleSettings,
    timezoneOffset = 10 // Default to UTC+10 (AEST); location UTC offset overrides this when configured.
}) => {
    const schedulePersonnelDisplaySettings = useMemo(
        () => normalisePersonnelDisplaySettings(personnelDisplaySettingsInput || null),
        [personnelDisplaySettingsInput]
    );
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showResourceUnderlayPanel, setShowResourceUnderlayPanel] = useState(false);
    const [flightLineDraggedAircraftNumber, setFlightLineDraggedAircraftNumber] = useState<string | null>(null);
    const [flightLineLocalUnavailableNumbers, setFlightLineLocalUnavailableNumbers] = useState<string[] | null>(null);
    const [flightLineAircraftAssignments, setFlightLineAircraftAssignments] = useState<Record<string, string>>({});
    const [flightLineAircraftAssignmentsHydratedKey, setFlightLineAircraftAssignmentsHydratedKey] = useState('');
    const [flightLineScheduleDropPreview, setFlightLineScheduleDropPreview] = useState<{ aircraftNumber: string; eventId: string } | null>(null);
    const [isFlightLineAvailableDropActive, setIsFlightLineAvailableDropActive] = useState(false);
    const [isFlightLineUnavailableDropActive, setIsFlightLineUnavailableDropActive] = useState(false);
    const [flightLineAircraftContextMenu, setFlightLineAircraftContextMenu] = useState<{
        aircraftNumber: string;
        tailNumber: string;
        isUnavailable: boolean;
        x: number;
        y: number;
    } | null>(null);
    const flightLineAircraftContextMenuRef = useRef<HTMLDivElement>(null);
    const [flightLineAircraftContextMenuSize, setFlightLineAircraftContextMenuSize] = useState({ width: 278, height: 198 });
    useEffect(() => {
        if (isNeoAssistPanelOpen) setShowResourceUnderlayPanel(false);
    }, [isNeoAssistPanelOpen]);
    const [resourceSlideoutFrame, setResourceSlideoutFrame] = useState<{ left: number; top: number; height: number; width: number; bottom: number } | null>(null);
    const scheduleGridRef = useRef<HTMLDivElement>(null);
    const effectiveTimezoneOffset = useMemo(() => {
        const units = Array.isArray(platformConfig?.units) ? platformConfig.units : [];
        const locations = Array.isArray(platformConfig?.locations) ? platformConfig.locations : [];
        const cleanUnitCode = normaliseUnitSettingsIdentifier(unitCode);
        const activeUnit = units.find((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === cleanUnitCode);
        const locationKey = normaliseUnitSettingsIdentifier(locationCode || activeUnit?.locationCode);
        const activeLocation = locations.find((location: any) => locationMatchesKey(location, locationKey));
        const useSystemOffset = Boolean(activeLocation?.useSystemTimezoneOffset ?? activeLocation?.settings?.useSystemTimezoneOffset);
        if (useSystemOffset) return getSystemUtcOffsetHours();

        const configuredOffset = Number(activeLocation?.timezoneOffset ?? activeLocation?.settings?.timezoneOffset);
        if (Number.isFinite(configuredOffset)) return configuredOffset;

        const locationTimezone = activeLocation?.timezone || activeLocation?.settings?.timezone;
        const resolvedOffset = getOffsetHoursForTimezone(locationTimezone);
        if (resolvedOffset !== null) return resolvedOffset;

        const fallbackOffset = Number(timezoneOffset);
        return Number.isFinite(fallbackOffset) ? fallbackOffset : 10;
    }, [locationCode, platformConfig, timezoneOffset, unitCode]);
    const flightLinePoolContext = useMemo(() => {
        const cleanUnitCode = normaliseUnitSettingsIdentifier(unitCode);
        const units = Array.isArray(platformConfig?.units) ? platformConfig.units : [];
        const activeUnit = units.find((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === cleanUnitCode);
        const unitForPool = activeUnit || { code: unitCode, locationCode };
        const pools = getRelevantResourcePoolsForUnit(platformConfig, unitForPool);
        const pool = pools[0] || null;
        const poolIndex = Array.isArray(platformConfig?.resourcePools) && pool
            ? platformConfig.resourcePools.findIndex((candidate: any) => candidate === pool || String(candidate?.id || candidate?.code || '') === String(pool?.id || pool?.code || ''))
            : -1;
        const settings = pool?.settings || {};
        const rawAircraftCount = Number(airframeCount ?? settings.aircraft ?? 5);
        const aircraftCount = Number.isFinite(rawAircraftCount) ? Math.max(0, Math.floor(rawAircraftCount)) : 5;
        const numberSettings = normaliseAircraftNumberSettings(settings);
        const prefix = numberSettings.usePrefix ? String(numberSettings.defaultPrefix || numberSettings.prefixes[0] || '').trim() : '';
        const configuredNumbers = Array.isArray(settings.aircraftInventoryNumbers)
            ? settings.aircraftInventoryNumbers.map((value: any) => String(value ?? '').trim())
            : [];
        const numbers = Array.from({ length: aircraftCount }, (_, index) => (
            configuredNumbers[index] || String(index + 1).padStart(3, '0')
        ));
        const sortedAircraftNumbers = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        const numberSet = new Set(numbers);
        const unavailableNumbers = sortedAircraftNumbers(Array.from(new Set((Array.isArray(settings.flightLineUnavailableAircraftNumbers)
            ? settings.flightLineUnavailableAircraftNumbers.map((value: any) => String(value ?? '').trim())
            : []).filter((value: string) => value && numberSet.has(value)))));
        const rawReasonMap = settings.flightLineUnavailableAircraftReasons && typeof settings.flightLineUnavailableAircraftReasons === 'object'
            ? settings.flightLineUnavailableAircraftReasons
            : {};
        const unavailableReasons = Object.fromEntries(Object.entries(rawReasonMap)
            .map(([number, reason]) => [String(number || '').trim(), String(reason || '').trim()])
            .filter(([number, reason]) => number && reason && numberSet.has(number))) as Record<string, string>;
        const unavailableNumberSet = new Set(unavailableNumbers);
        const availableNumbers = numbers.filter((number) => !unavailableNumberSet.has(number));
        return {
            poolIndex,
            aircraftCount,
            prefix,
            numbers,
            availableNumbers,
            unavailableNumbers,
            unavailableReasons,
            unavailableReasonOptions: normaliseFlightLineUnavailableReasons(settings.flightLineUnavailableReasonOptions),
            linkAircraftAvailability: settings.flightLineLinkAircraftAvailability === true,
        };
    }, [airframeCount, locationCode, platformConfig, unitCode]);
    const sortFlightLineAircraftNumbers = useCallback((values: string[]) => (
        [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    ), []);
    const flightLineBaseUnavailableNumbers = flightLineLocalUnavailableNumbers || flightLinePoolContext.unavailableNumbers;
    const flightLineEffectiveUnavailableNumbers = useMemo(() => {
        const validNumbers = new Set(flightLinePoolContext.numbers);
        return sortFlightLineAircraftNumbers(Array.from(new Set(flightLineBaseUnavailableNumbers)).filter((number) => validNumbers.has(number)));
    }, [flightLineBaseUnavailableNumbers, flightLinePoolContext.numbers, sortFlightLineAircraftNumbers]);
    const flightLineEffectiveUnavailableSet = useMemo(
        () => new Set(flightLineEffectiveUnavailableNumbers),
        [flightLineEffectiveUnavailableNumbers],
    );
    const flightLineLinkedAvailabilityCount = Math.max(
        0,
        flightLinePoolContext.numbers.length - flightLineEffectiveUnavailableNumbers.length,
    );
    const flightLineAvailabilityCheckOk = flightLineLinkedAvailabilityCount === flightLinePoolContext.availableNumbers.length;
    useEffect(() => {
        if (!flightLinePoolContext.linkAircraftAvailability) return;
        onLinkedAvailabilityChange?.(flightLineLinkedAvailabilityCount);
    }, [flightLineLinkedAvailabilityCount, flightLinePoolContext.linkAircraftAvailability, onLinkedAvailabilityChange]);
    const setFlightLineLinkAircraftAvailability = useCallback((linked: boolean) => {
        if (!canEditFlightLineAvailabilityLink || isReadOnly) return;
        if (!onUpdatePlatformConfig || flightLinePoolContext.poolIndex < 0) return;
        onUpdatePlatformConfig((current: any) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((pool: any, poolIndex: number) => {
                if (poolIndex !== flightLinePoolContext.poolIndex) return pool;
                const settings = pool?.settings || {};
                return {
                    ...pool,
                    settings: {
                        ...settings,
                        flightLineLinkAircraftAvailability: linked,
                    },
                };
            }),
        }));
        if (linked) onLinkedAvailabilityChange?.(flightLineLinkedAvailabilityCount);
    }, [canEditFlightLineAvailabilityLink, flightLineLinkedAvailabilityCount, flightLinePoolContext.poolIndex, isReadOnly, onLinkedAvailabilityChange, onUpdatePlatformConfig]);
    const getFlightLineUnavailableReason = useCallback((aircraftNumber: string): string => {
        const savedReason = flightLinePoolContext.unavailableReasons[aircraftNumber];
        return String(savedReason || '').trim();
    }, [flightLinePoolContext.unavailableReasons]);
    const postFlightLineMaintenanceEvent = useCallback((payload: {
        action: 'unavailable' | 'serviceable' | 'reason_update';
        aircraftNumber: string;
        reason?: string;
        nextUnavailableNumbers: string[];
    }) => {
        if (!apiBase || !date) return;
        const aircraftNumber = String(payload.aircraftNumber || '').trim();
        if (!aircraftNumber) return;
        const totalAircraftCount = flightLinePoolContext.numbers.length || airframeCount;
        if (!totalAircraftCount) return;
        const unavailableNumbers = sortFlightLineAircraftNumbers(payload.nextUnavailableNumbers);
        const availableCount = Math.max(0, totalAircraftCount - unavailableNumbers.length);
        const timestamp = makeFlightLineMaintenanceTimestamp(date);
        const reason = String(payload.reason || '').trim();
        const tailNumber = [flightLinePoolContext.prefix, aircraftNumber].filter(Boolean).join(' ');
        const notes = JSON.stringify({
            source: 'flight_line_maintenance',
            action: payload.action,
            aircraftNumber,
            tailNumber,
            reason: reason || null,
            locationCode,
            unitCode,
            unavailableNumbers,
            availableCount,
            totalAircraft: totalAircraftCount,
        });
        fetch(`${apiBase}/aircraft-availability-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                timestamp: timestamp.toISOString(),
                date,
                availableCount,
                totalAircraft: totalAircraftCount,
                changeType: payload.action === 'serviceable' ? 'maintenance_serviceable' : payload.action === 'reason_update' ? 'maintenance_reason_update' : 'maintenance_unavailable',
                recordedBy: null,
                locationCode,
                unitCode,
                notes,
                flyingWindowStart: formatFlightLineMaintenanceWindowTime(dayFlyingStart),
                flyingWindowEnd: formatFlightLineMaintenanceWindowTime(dayFlyingEnd),
            }),
        }).catch((error) => {
            console.warn('[Flight Line] Failed to record maintenance unserviceability event:', error);
        });
    }, [airframeCount, apiBase, date, dayFlyingEnd, dayFlyingStart, flightLinePoolContext.numbers.length, flightLinePoolContext.prefix, locationCode, sortFlightLineAircraftNumbers, unitCode]);
    const flightLineAircraftAssignmentStorageKey = useMemo(
        () => `dfp-flight-line-aircraft-event-assignments:${date}:${locationCode}:${unitCode}`,
        [date, locationCode, unitCode],
    );
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(flightLineAircraftAssignmentStorageKey);
            setFlightLineAircraftAssignments(stored ? JSON.parse(stored) : {});
        } catch (error) {
            setFlightLineAircraftAssignments({});
        }
        setFlightLineAircraftAssignmentsHydratedKey(flightLineAircraftAssignmentStorageKey);
    }, [flightLineAircraftAssignmentStorageKey]);
    useEffect(() => {
        if (flightLineAircraftAssignmentsHydratedKey !== flightLineAircraftAssignmentStorageKey) return;
        try {
            window.localStorage.setItem(flightLineAircraftAssignmentStorageKey, JSON.stringify(flightLineAircraftAssignments));
        } catch (error) {
            // Local persistence is best-effort only.
        }
    }, [flightLineAircraftAssignmentStorageKey, flightLineAircraftAssignments, flightLineAircraftAssignmentsHydratedKey]);
    const flightLineEffectiveAircraftAssignments = useMemo(() => {
        const next: Record<string, string> = {};
        events.forEach((event) => {
            const aircraftNumber = String(event.aircraftNumber || '').trim();
            if (event.type === 'flight' && aircraftNumber && flightLinePoolContext.numbers.includes(aircraftNumber)) {
                next[event.id] = aircraftNumber;
            }
        });
        const validEventIds = new Set(events.filter((event) => event.type === 'flight').map((event) => event.id));
        Object.entries(flightLineAircraftAssignments).forEach(([eventId, aircraftNumber]) => {
            if (validEventIds.has(eventId) && flightLinePoolContext.numbers.includes(aircraftNumber)) {
                next[eventId] = aircraftNumber;
            }
        });
        return next;
    }, [events, flightLineAircraftAssignments, flightLinePoolContext.numbers]);
    const flightLineAssignedEventIdsByAircraft = useMemo(() => {
        const next: Record<string, string[]> = {};
        Object.entries(flightLineEffectiveAircraftAssignments).forEach(([eventId, aircraftNumber]) => {
            if (!next[aircraftNumber]) next[aircraftNumber] = [];
            next[aircraftNumber].push(eventId);
        });
        return next;
    }, [flightLineEffectiveAircraftAssignments]);
    const getFlightLineAssignedEventIdsForAircraft = useCallback((aircraftNumber: string, sourceEventId?: string) => {
        const assignedEventIds = flightLineAssignedEventIdsByAircraft[aircraftNumber] || [];
        return sourceEventId ? assignedEventIds.filter((eventId) => eventId === sourceEventId) : assignedEventIds;
    }, [flightLineAssignedEventIdsByAircraft]);
    const clearFlightLineAssignmentState = useCallback((eventIds: string[]) => {
        if (eventIds.length === 0) return;
        const eventIdSet = new Set(eventIds);
        setFlightLineAircraftAssignments((current) => {
            const next = { ...current };
            eventIdSet.forEach((eventId) => delete next[eventId]);
            return next;
        });
    }, []);
    const setFlightLineAssignmentState = useCallback((eventId: string, aircraftNumber: string, sourceEventId?: string) => {
        setFlightLineAircraftAssignments((current) => {
            const next = { ...current };
            if (sourceEventId && sourceEventId !== eventId) delete next[sourceEventId];
            next[eventId] = aircraftNumber;
            return next;
        });
    }, []);
    const getFlightLineDragSourceEventId = useCallback((event: React.DragEvent) => (
        event.dataTransfer.getData('application/flight-line-aircraft-event') || ''
    ), []);
    const flightLineStoredUnavailableKey = flightLinePoolContext.unavailableNumbers.join('|');
    const flightLineConfiguredNumbersKey = flightLinePoolContext.numbers.join('|');
    useEffect(() => {
        if (!flightLineLocalUnavailableNumbers) return;
        const localKey = flightLineLocalUnavailableNumbers.join('|');
        if (localKey === flightLineStoredUnavailableKey) {
            setFlightLineLocalUnavailableNumbers(null);
        } else {
            const configuredNumbers = new Set(flightLinePoolContext.numbers);
            const validLocalNumbers = flightLineLocalUnavailableNumbers.filter((number) => configuredNumbers.has(number));
            if (validLocalNumbers.length !== flightLineLocalUnavailableNumbers.length) {
                setFlightLineLocalUnavailableNumbers(sortFlightLineAircraftNumbers(validLocalNumbers));
            }
        }
    }, [flightLineConfiguredNumbersKey, flightLineLocalUnavailableNumbers, flightLineStoredUnavailableKey, flightLinePoolContext.numbers, sortFlightLineAircraftNumbers]);
    const updateFlightLineAircraftNumber = useCallback((aircraftIndex: number, value: string) => {
        if (!canEditFlightLineInventory || isReadOnly) return;
        if (!onUpdatePlatformConfig || flightLinePoolContext.poolIndex < 0) return;
        onUpdatePlatformConfig((current: any) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((pool: any, poolIndex: number) => {
                if (poolIndex !== flightLinePoolContext.poolIndex) return pool;
                const settings = pool?.settings || {};
                const rawCount = Number(flightLinePoolContext.aircraftCount ?? settings.aircraft ?? 5);
                const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 5;
                const existingNumbers = Array.isArray(settings.aircraftInventoryNumbers)
                    ? settings.aircraftInventoryNumbers.map((entry: any) => String(entry ?? '').trim())
                    : Array.from({ length: count }, (_, index) => String(index + 1).padStart(3, '0'));
                const nextNumbers = Array.from({ length: count }, (_, index) => existingNumbers[index] || String(index + 1).padStart(3, '0'));
                nextNumbers[aircraftIndex] = value.trim();
                return {
                    ...pool,
                    settings: {
                        ...settings,
                        aircraftInventoryNumbers: nextNumbers,
                    },
                };
            }),
        }));
    }, [canEditFlightLineInventory, flightLinePoolContext.aircraftCount, flightLinePoolContext.poolIndex, isReadOnly, onUpdatePlatformConfig]);
    const clearFlightLineDragState = useCallback(() => {
        setFlightLineDraggedAircraftNumber(null);
        setFlightLineScheduleDropPreview(null);
        setIsFlightLineAvailableDropActive(false);
        setIsFlightLineUnavailableDropActive(false);
    }, []);
    const saveFlightLineUnavailableAircraftNumbers = useCallback((nextUnavailableNumbers: string[], reasonUpdates: Record<string, string | null> = {}) => {
        if (!canEditFlightLineAvailability || isReadOnly) return;
        const validNumbers = new Set(flightLinePoolContext.numbers);
        const cleanNumbers = sortFlightLineAircraftNumbers(Array.from(new Set(nextUnavailableNumbers.map((number) => String(number ?? '').trim()).filter((number) => number && validNumbers.has(number)))));
        const unavailableSet = new Set(cleanNumbers);
        setFlightLineLocalUnavailableNumbers(cleanNumbers);
        if (!onUpdatePlatformConfig || flightLinePoolContext.poolIndex < 0) return;
        onUpdatePlatformConfig((current: any) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((pool: any, poolIndex: number) => {
                if (poolIndex !== flightLinePoolContext.poolIndex) return pool;
                const settings = pool?.settings || {};
                const nextReasons = Object.fromEntries(Object.entries({
                    ...(settings.flightLineUnavailableAircraftReasons || {}),
                    ...reasonUpdates,
                })
                    .map(([number, reason]) => [String(number || '').trim(), reason === null ? '' : String(reason || '').trim()])
                    .filter(([number, reason]) => number && reason && unavailableSet.has(number))) as Record<string, string>;
                return {
                    ...pool,
                    settings: {
                        ...settings,
                        flightLineUnavailableAircraftNumbers: cleanNumbers,
                        flightLineUnavailableAircraftReasons: nextReasons,
                    },
                };
            }),
        }));
    }, [canEditFlightLineAvailability, flightLinePoolContext.numbers, flightLinePoolContext.poolIndex, isReadOnly, onUpdatePlatformConfig, sortFlightLineAircraftNumbers]);
    const moveFlightLineAircraftToUnavailable = useCallback((aircraftNumber: string, reason?: string) => {
        if (!canEditFlightLineAvailability || isReadOnly) {
            clearFlightLineDragState();
            return;
        }
        const cleanNumber = aircraftNumber.trim();
        const assignedEventIds = getFlightLineAssignedEventIdsForAircraft(cleanNumber);
        if (assignedEventIds.length > 0) {
            onUpdateEvent(assignedEventIds.map((eventId) => ({ eventId, newAircraftNumber: '' })));
        }
        clearFlightLineAssignmentState(assignedEventIds);
        clearFlightLineDragState();
        if (!cleanNumber || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        const cleanReason = String(reason ?? getFlightLineUnavailableReason(cleanNumber)).trim();
        const wasAlreadyUnavailable = flightLineEffectiveUnavailableNumbers.includes(cleanNumber);
        const nextUnavailableNumbers = sortFlightLineAircraftNumbers([...flightLineEffectiveUnavailableNumbers, cleanNumber]);
        saveFlightLineUnavailableAircraftNumbers(nextUnavailableNumbers, cleanReason ? { [cleanNumber]: cleanReason } : {});
        postFlightLineMaintenanceEvent({
            action: wasAlreadyUnavailable ? 'reason_update' : 'unavailable',
            aircraftNumber: cleanNumber,
            reason: cleanReason,
            nextUnavailableNumbers,
        });
    }, [canEditFlightLineAvailability, clearFlightLineAssignmentState, clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, getFlightLineAssignedEventIdsForAircraft, getFlightLineUnavailableReason, isReadOnly, onUpdateEvent, postFlightLineMaintenanceEvent, saveFlightLineUnavailableAircraftNumbers, sortFlightLineAircraftNumbers]);
    const moveFlightLineAircraftToAvailable = useCallback((aircraftNumber: string, sourceEventId = '') => {
        if (!canEditFlightLineAvailability || isReadOnly) {
            clearFlightLineDragState();
            return;
        }
        const cleanNumber = aircraftNumber.trim();
        const assignedEventIds = getFlightLineAssignedEventIdsForAircraft(cleanNumber, sourceEventId || undefined);
        if (assignedEventIds.length > 0) {
            onUpdateEvent(assignedEventIds.map((eventId) => ({ eventId, newAircraftNumber: '' })));
        }
        clearFlightLineAssignmentState(assignedEventIds);
        clearFlightLineDragState();
        if (!cleanNumber || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        const wasUnavailable = flightLineEffectiveUnavailableNumbers.includes(cleanNumber);
        const serviceableReason = getFlightLineUnavailableReason(cleanNumber);
        const nextUnavailableNumbers = flightLineEffectiveUnavailableNumbers.filter((number) => number !== cleanNumber);
        saveFlightLineUnavailableAircraftNumbers(nextUnavailableNumbers, { [cleanNumber]: null });
        if (wasUnavailable) {
            postFlightLineMaintenanceEvent({
                action: 'serviceable',
                aircraftNumber: cleanNumber,
                reason: serviceableReason,
                nextUnavailableNumbers,
            });
        }
    }, [canEditFlightLineAvailability, clearFlightLineAssignmentState, clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, getFlightLineAssignedEventIdsForAircraft, getFlightLineUnavailableReason, isReadOnly, onUpdateEvent, postFlightLineMaintenanceEvent, saveFlightLineUnavailableAircraftNumbers]);
    const openFlightLineAircraftContextMenu = useCallback((
        event: React.MouseEvent,
        aircraftNumber: string,
        tailNumber: string,
        isUnavailable: boolean
    ) => {
        event.preventDefault();
        event.stopPropagation();
        if (!canEditFlightLineAvailability || isReadOnly) return;
        setFlightLineAircraftContextMenu({
            aircraftNumber,
            tailNumber,
            isUnavailable,
            x: event.clientX,
            y: event.clientY,
        });
    }, [canEditFlightLineAvailability, isReadOnly]);
    const closeFlightLineAircraftContextMenu = useCallback(() => {
        setFlightLineAircraftContextMenu(null);
    }, []);
    useEffect(() => {
        if (!flightLineAircraftContextMenu) return;
        const measureMenu = () => {
            const rect = flightLineAircraftContextMenuRef.current?.getBoundingClientRect();
            if (!rect) return;
            setFlightLineAircraftContextMenuSize({
                width: Math.ceil(rect.width),
                height: Math.ceil(rect.height),
            });
        };
        measureMenu();
        window.requestAnimationFrame(measureMenu);
    }, [flightLineAircraftContextMenu]);
    const setFlightLineAircraftUnavailableReason = useCallback((aircraftNumber: string, reason: string) => {
        const cleanNumber = String(aircraftNumber || '').trim();
        const cleanReason = String(reason || '').trim();
        if (!cleanNumber) return;
        if (!cleanReason) {
            saveFlightLineUnavailableAircraftNumbers(flightLineEffectiveUnavailableNumbers, { [cleanNumber]: null });
            postFlightLineMaintenanceEvent({
                action: 'reason_update',
                aircraftNumber: cleanNumber,
                reason: '',
                nextUnavailableNumbers: flightLineEffectiveUnavailableNumbers,
            });
            return;
        }
        moveFlightLineAircraftToUnavailable(cleanNumber, cleanReason);
    }, [flightLineEffectiveUnavailableNumbers, moveFlightLineAircraftToUnavailable, postFlightLineMaintenanceEvent, saveFlightLineUnavailableAircraftNumbers]);
    useEffect(() => {
        if (!flightLineAircraftContextMenu) return;
        const handlePointerDown = () => closeFlightLineAircraftContextMenu();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeFlightLineAircraftContextMenu();
        };
        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeFlightLineAircraftContextMenu, flightLineAircraftContextMenu]);
    const assignFlightLineAircraftToEvent = useCallback((aircraftNumber: string, eventId: string, sourceEventId = '') => {
        if (!canEditTileAircraftNumber || isReadOnly) {
            clearFlightLineDragState();
            return;
        }
        const cleanNumber = aircraftNumber.trim();
        if (!cleanNumber || !eventId || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        if (flightLineEffectiveUnavailableNumbers.includes(cleanNumber) && !canEditFlightLineAvailability) {
            clearFlightLineDragState();
            return;
        }
        const eventUpdates: { eventId: string; newAircraftNumber: string }[] = [];
        if (sourceEventId && sourceEventId !== eventId) {
            eventUpdates.push({ eventId: sourceEventId, newAircraftNumber: '' });
        }
        eventUpdates.push({ eventId, newAircraftNumber: cleanNumber });
        onUpdateEvent(eventUpdates);
        setFlightLineAssignmentState(eventId, cleanNumber, sourceEventId);
        saveFlightLineUnavailableAircraftNumbers(flightLineEffectiveUnavailableNumbers.filter((number) => number !== cleanNumber));
        clearFlightLineDragState();
    }, [canEditFlightLineAvailability, canEditTileAircraftNumber, clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, isReadOnly, onUpdateEvent, saveFlightLineUnavailableAircraftNumbers, setFlightLineAssignmentState]);
    const flightLineAircraftConflictEventIds = useMemo(() => {
        const conflictEventIds = new Set<string>();
        const eventsByAircraft = new Map<string, ScheduleEvent[]>();
        events.forEach((event) => {
            if (event.type !== 'flight') return;
            const aircraftNumber = flightLineEffectiveAircraftAssignments[event.id] || String(event.aircraftNumber || '').trim();
            if (!aircraftNumber || !flightLinePoolContext.numbers.includes(aircraftNumber)) return;
            const aircraftEvents = eventsByAircraft.get(aircraftNumber) || [];
            aircraftEvents.push(event);
            eventsByAircraft.set(aircraftNumber, aircraftEvents);
        });
        const flightTurnaroundHours = Math.max(0, Number(buildRuleSettings?.flightTurnaround ?? 1.2) || 0);
        eventsByAircraft.forEach((aircraftEvents) => {
            const sortedEvents = [...aircraftEvents].sort((a, b) => a.startTime - b.startTime);
            for (let index = 0; index < sortedEvents.length; index += 1) {
                const current = sortedEvents[index];
                const currentProtectedEnd = current.startTime + current.duration + flightTurnaroundHours;
                for (let nextIndex = index + 1; nextIndex < sortedEvents.length; nextIndex += 1) {
                    const next = sortedEvents[nextIndex];
                    if (next.startTime >= currentProtectedEnd - 0.001) break;
                    conflictEventIds.add(current.id);
                    conflictEventIds.add(next.id);
                }
            }
        });
        return conflictEventIds;
    }, [buildRuleSettings?.flightTurnaround, events, flightLineEffectiveAircraftAssignments, flightLinePoolContext.numbers]);
    const flightLineAircraftMarkerEntries = useMemo(() => {
        const eventById = new Map(events.map((event) => [event.id, event]));
        const entries = Object.entries(flightLineEffectiveAircraftAssignments)
            .map(([eventId, aircraftNumber]) => ({
                aircraftNumber,
                eventId,
                event: eventById.get(eventId),
                hasAircraftConflict: flightLineAircraftConflictEventIds.has(eventId),
            }))
            .filter((entry): entry is { aircraftNumber: string; eventId: string; event: ScheduleEvent; hasAircraftConflict: boolean } => !!entry.event);
        if (flightLineScheduleDropPreview) {
            const previewEvent = eventById.get(flightLineScheduleDropPreview.eventId);
            if (previewEvent) {
                return [
                    ...entries.filter((entry) => entry.eventId !== flightLineScheduleDropPreview.eventId),
                    {
                        aircraftNumber: flightLineScheduleDropPreview.aircraftNumber,
                        eventId: flightLineScheduleDropPreview.eventId,
                        event: previewEvent,
                        hasAircraftConflict: flightLineAircraftConflictEventIds.has(flightLineScheduleDropPreview.eventId),
                        isPreview: true,
                    },
                ];
            }
        }
        return entries;
    }, [events, flightLineAircraftConflictEventIds, flightLineEffectiveAircraftAssignments, flightLineScheduleDropPreview]);
    const flightLinePanelHeight = useMemo(() => {
        const panelWidth = resourceSlideoutFrame?.width || 0;
        const reservedWidth = 200 + 200 + 40 + 32;
        const tileAreaWidth = Math.max(50, panelWidth - reservedWidth);
        const tileColumns = Math.max(1, Math.floor(tileAreaWidth / 58));
        const unavailableColumns = 3;
        const tileRows = Math.max(
            1,
            Math.ceil((flightLinePoolContext.numbers.length || 1) / tileColumns),
            Math.ceil((flightLineEffectiveUnavailableNumbers.length || 1) / unavailableColumns),
        );
        return Math.max(200, 68 + (tileRows * 40) + ((tileRows - 1) * 8));
    }, [flightLineEffectiveUnavailableNumbers.length, flightLinePoolContext.numbers.length, resourceSlideoutFrame?.width]);
    // Initialize with timezone-adjusted time
    const [currentTime, setCurrentTime] = useState(() => {
        const now = new Date();
        const offsetMs = effectiveTimezoneOffset * 60 * 60 * 1000;
        return new Date(now.getTime() + offsetMs);
    });
    const isInitialLoad = useRef(true);
    const prevZoomLevelRef = useRef(zoomLevel);

    // Update current time when timezone offset changes. The schedule surface is large,
    // so avoid second-by-second repaints when the marker only needs minute-scale accuracy.
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            // Apply timezone offset
            const offsetMs = effectiveTimezoneOffset * 60 * 60 * 1000;
            const adjustedTime = new Date(now.getTime() + offsetMs);
            setCurrentTime(adjustedTime);
        };

        // Update immediately
        updateTime();
        
        const interval = setInterval(updateTime, 30000);
        
        return () => clearInterval(interval);
    }, [effectiveTimezoneOffset]);
    
    const updateResourceSlideoutFrame = useCallback(() => {
        const surface = scrollContainerRef.current;
        const resourceColumn = surface?.querySelector('[data-schedule-resource-column="true"]') as HTMLElement | null;
        if (!surface || !resourceColumn) return;
        const surfaceRect = surface.getBoundingClientRect();
        const resourceRect = resourceColumn.getBoundingClientRect();
        setResourceSlideoutFrame({
            left: Math.round(resourceRect.right),
            top: Math.round(surfaceRect.top),
            height: Math.round(surfaceRect.height),
            width: Math.max(0, Math.round(surfaceRect.right - resourceRect.right)),
            bottom: Math.max(0, Math.round(window.innerHeight - surfaceRect.bottom)),
        });
    }, []);

    useEffect(() => {
        updateResourceSlideoutFrame();
        const surface = scrollContainerRef.current;
        window.addEventListener('resize', updateResourceSlideoutFrame);
        surface?.addEventListener('scroll', updateResourceSlideoutFrame, { passive: true });
        return () => {
            window.removeEventListener('resize', updateResourceSlideoutFrame);
            surface?.removeEventListener('scroll', updateResourceSlideoutFrame);
        };
    }, [date, resources.length, updateResourceSlideoutFrame, zoomLevel]);
    

    const [draggingState, setDraggingState] = useState<{
        mainEventId: string;
        xOffset: number;
        yOffset: number;
        initialPositions: Map<string, { startTime: number, rowIndex: number }>;
        originalResourceIds: Map<string, string>;
    } | null>(null);

    const [realtimeConflict, setRealtimeConflict] = useState<{ conflictingEventId: string; conflictedPersonName: string; } | null>(null);
    const [realtimeResourceConflictId, setRealtimeResourceConflictId] = useState<string | null>(null);
    const [draggedCptConflict, setDraggedCptConflict] = useState<Conflict | null>(null);
    const didDragRef = useRef(false);
    const dragFrameRef = useRef<number | null>(null);
    const lastDragUpdateSignatureRef = useRef('');
    const dragDiagnosticSessionRef = useRef<string | null>(null);
    const lastDragCommitUpdatesRef = useRef<{ eventId: string, newStartTime: number, newResourceId: string }[] | null>(null);
    const pendingDragUpdateRef = useRef<{
        updates: { eventId: string, newStartTime: number, newResourceId: string }[];
        realtimeConflict: { conflictingEventId: string; conflictedPersonName: string; } | null;
        resourceConflictId: string | null;
        cptConflict: Conflict | null;
        queuedAtMs: number;
        signature: string;
    } | null>(null);

    const getDragTileElements = useCallback((eventId: string): HTMLElement[] => {
        if (typeof document === 'undefined') return [];
        const escapedId = eventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return Array.from(document.querySelectorAll<HTMLElement>(`[data-dfp-event-id="${escapedId}"]`));
    }, []);

    const clearDragVisualStyles = useCallback(() => {
        if (!draggingState) return;
        draggingState.initialPositions.forEach((_initialPosition, eventId) => {
            getDragTileElements(eventId).forEach(element => {
                element.style.transform = '';
                element.style.transition = '';
                element.style.willChange = '';
            });
        });
    }, [draggingState, getDragTileElements]);

    const applyDragVisualUpdates = useCallback((updates: { eventId: string, newStartTime: number, newResourceId: string }[]) => {
        if (!draggingState) return;
        updates.forEach(update => {
            const initialPosition = draggingState.initialPositions.get(update.eventId);
            if (!initialPosition) return;
            const newRowIndex = resources.indexOf(update.newResourceId);
            if (newRowIndex < 0) return;
            const deltaX = (update.newStartTime - initialPosition.startTime) * PIXELS_PER_HOUR * zoomLevel;
            const deltaY = (newRowIndex - initialPosition.rowIndex) * ROW_HEIGHT;
            getDragTileElements(update.eventId).forEach(element => {
                element.style.transition = 'none';
                element.style.willChange = 'transform';
                element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            });
        });
    }, [draggingState, getDragTileElements, resources, zoomLevel]);

    const applyFinalDragVisualPositions = useCallback((updates: { eventId: string, newStartTime: number, newResourceId: string }[]) => {
        updates.forEach(update => {
            const newRowIndex = resources.indexOf(update.newResourceId);
            if (newRowIndex < 0) return;
            getDragTileElements(update.eventId).forEach(element => {
                element.style.transition = 'none';
                element.style.willChange = '';
                element.style.transform = '';
                element.style.left = `${(update.newStartTime - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px`;
                element.style.top = `${newRowIndex * ROW_HEIGHT}px`;
            });
        });
    }, [getDragTileElements, resources, zoomLevel]);

    const flushPendingDragUpdate = useCallback((commitToSchedule = false) => {
        if (dragFrameRef.current !== null) {
            window.cancelAnimationFrame(dragFrameRef.current);
            dragFrameRef.current = null;
        }
        const pending = pendingDragUpdateRef.current;
        if (!pending) {
            if (commitToSchedule && lastDragCommitUpdatesRef.current) {
                applyFinalDragVisualPositions(lastDragCommitUpdatesRef.current);
                recordDfpDragFlushDiagnostic(dragDiagnosticSessionRef.current, {
                    queuedAtMs: performance.now(),
                    updateCount: lastDragCommitUpdatesRef.current.length,
                    signature: lastDragUpdateSignatureRef.current,
                });
                appendDfpMoveChangeTrace('drag:commit-last-update', {
                    date,
                    updates: lastDragCommitUpdatesRef.current,
                });
                onUpdateEvent(lastDragCommitUpdatesRef.current);
                lastDragCommitUpdatesRef.current = null;
            }
            return;
        }
        pendingDragUpdateRef.current = null;
        lastDragCommitUpdatesRef.current = pending.updates;
        if (commitToSchedule) {
            applyFinalDragVisualPositions(pending.updates);
            setRealtimeConflict(pending.realtimeConflict);
            setRealtimeResourceConflictId(pending.resourceConflictId);
            setDraggedCptConflict(pending.cptConflict);
            recordDfpDragFlushDiagnostic(dragDiagnosticSessionRef.current, {
                queuedAtMs: pending.queuedAtMs,
                updateCount: pending.updates.length,
                signature: pending.signature,
            });
            appendDfpMoveChangeTrace('drag:commit-to-schedule', {
                date,
                updates: pending.updates,
                realtimeConflict: pending.realtimeConflict,
                resourceConflictId: pending.resourceConflictId,
                cptConflict: pending.cptConflict ? {
                    conflictingEvent: summariseDfpMoveEvent(pending.cptConflict.conflictingEvent),
                    newEvent: summariseDfpMoveEvent(pending.cptConflict.newEvent),
                } : null,
            });
            onUpdateEvent(pending.updates);
            lastDragCommitUpdatesRef.current = null;
        } else {
            applyDragVisualUpdates(pending.updates);
        }
    }, [applyDragVisualUpdates, applyFinalDragVisualPositions, onUpdateEvent]);

    useEffect(() => {
        return () => {
            if (dragFrameRef.current !== null) {
                window.cancelAnimationFrame(dragFrameRef.current);
            }
        };
    }, []);

    // Multi-select State
    const selectionStartPoint = useRef<{ x: number, y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    
    // Validate mode overlay state
    const [validateOverlayTime, setValidateOverlayTime] = useState<number | null>(null);

    useEffect(() => {
        // Global drag handlers
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (draggingState) {
                handleMouseMove(e as any);
            }
        };
        
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (draggingState) {
                flushPendingDragUpdate(true);
                document.body.classList.remove('no-select');
                setDraggingState(null);
                setRealtimeConflict(null);
                setRealtimeResourceConflictId(null);
                setDraggedCptConflict(null);
                window.requestAnimationFrame(clearDragVisualStyles);
                lastDragUpdateSignatureRef.current = '';
                lastDragCommitUpdatesRef.current = null;
                endDfpDragDiagnostic(dragDiagnosticSessionRef.current);
                dragDiagnosticSessionRef.current = null;
            }
        };
        
        // Add global listeners
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        
        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [draggingState, flushPendingDragUpdate]);

    const getExternalDropPlacement = (event: React.DragEvent<HTMLDivElement>) => {
        if (!scheduleGridRef.current) return null;
        const gridRect = scheduleGridRef.current.getBoundingClientRect();
        const relativeX = event.clientX - gridRect.left;
        const relativeY = event.clientY - gridRect.top;
        const rawStartTime = START_HOUR + (relativeX / (PIXELS_PER_HOUR * zoomLevel));
        const startTime = Math.max(START_HOUR, Math.min(END_HOUR, Math.round(rawStartTime * 12) / 12));
        const rowIndex = Math.max(0, Math.min(resources.length - 1, Math.floor(relativeY / ROW_HEIGHT)));
        const resourceId = resources[rowIndex];
        if (!resourceId) return null;
        return { startTime, resourceId };
    };

    const getNearestFlightLineEventForDrop = (event: React.DragEvent<HTMLDivElement>): ScheduleEvent | null => {
        if (!scheduleGridRef.current) return null;
        const gridRect = scheduleGridRef.current.getBoundingClientRect();
        const relativeX = event.clientX - gridRect.left;
        const relativeY = event.clientY - gridRect.top;
        const pointerTime = START_HOUR + (relativeX / (PIXELS_PER_HOUR * zoomLevel));
        const rowIndex = Math.max(0, Math.min(resources.length - 1, Math.floor(relativeY / ROW_HEIGHT)));
        const resourceId = resources[rowIndex];
        if (!resourceId) return null;
        const rowFlightEvents = events
            .filter((candidate) => candidate.resourceId === resourceId && candidate.type === 'flight' && candidate.startTime <= pointerTime)
            .sort((a, b) => Math.abs((a.startTime + a.duration) - pointerTime) - Math.abs((b.startTime + b.duration) - pointerTime));
        return rowFlightEvents[0] || null;
    };

    const handleExternalDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        const dragTypes = Array.from(event.dataTransfer.types);
        if (dragTypes.includes('application/flight-line-aircraft')) {
            if (!canEditTileAircraftNumber) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const aircraftNumber = event.dataTransfer.getData('application/flight-line-aircraft') || flightLineDraggedAircraftNumber || '';
            const nearestEvent = getNearestFlightLineEventForDrop(event);
            setFlightLineScheduleDropPreview(aircraftNumber && nearestEvent ? { aircraftNumber, eventId: nearestEvent.id } : null);
            setIsFlightLineAvailableDropActive(false);
            setIsFlightLineUnavailableDropActive(false);
            return;
        }
        if (!onExternalEventDrop) return;
        if (!dragTypes.includes('application/neo-assist-event')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleExternalDrop = (event: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        const aircraftNumber = event.dataTransfer.getData('application/flight-line-aircraft') || flightLineDraggedAircraftNumber || '';
        if (aircraftNumber) {
            const nearestEvent = getNearestFlightLineEventForDrop(event);
            const sourceEventId = getFlightLineDragSourceEventId(event);
            event.preventDefault();
            if (nearestEvent) {
                assignFlightLineAircraftToEvent(aircraftNumber, nearestEvent.id, sourceEventId);
            } else {
                clearFlightLineDragState();
            }
            return;
        }
        if (!onExternalEventDrop) return;
        const raw = event.dataTransfer.getData('application/neo-assist-event');
        if (!raw) return;
        const placement = getExternalDropPlacement(event);
        if (!placement) return;
        event.preventDefault();
        try {
            onExternalEventDrop(JSON.parse(raw) as ScheduleEvent, placement);
        } catch (error) {
            console.warn('[NEO Assist] Failed to drop assist tile:', error);
        }
    };

    const formattedDisplayDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC'
        });
    }, [date]);

    const showLiveAvailabilityLine = useMemo(() => {
        // currentTime is already adjusted to the selected app timezone; use UTC
        // getters to extract the intended app-local day from that adjusted value.
        const appTodayStr = `${currentTime.getUTCFullYear()}-${String(currentTime.getUTCMonth() + 1).padStart(2, '0')}-${String(currentTime.getUTCDate()).padStart(2, '0')}`;

        return date === appTodayStr;
    }, [date, currentTime]);

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
            // Skip STBY and deployment events
            if (eventToCheck.resourceId?.startsWith('STBY') || eventToCheck.type === 'deployment') continue;

            const s1 = syllabusDetails.find(d => d.id === eventToCheck.flightNumber);
            // Use syllabus pre/post times if available, otherwise treat as flight event (Duty Sup, TWR DI etc.)
            const e1StartWithPre = eventToCheck.startTime - (s1?.preFlightTime || 0);
            const e1EndWithPost = eventToCheck.startTime + eventToCheck.duration + (s1?.postFlightTime || 0);

            for (const existingEvent of existingEvents) {
                // Skip STBY and deployment events
                if (existingEvent.resourceId?.startsWith('STBY') || existingEvent.type === 'deployment') continue;

                const s2 = syllabusDetails.find(d => d.id === existingEvent.flightNumber);
                // Use syllabus pre/post times if available, otherwise use raw start/end
                const e2StartWithPre = existingEvent.startTime - (s2?.preFlightTime || 0);
                const e2EndWithPost = existingEvent.startTime + existingEvent.duration + (s2?.postFlightTime || 0);
                
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

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>, event?: ScheduleEvent) => {
        if (e.button !== 0) return;
        if (isReadOnly && event) {
            didDragRef.current = false;
            return;
        }
        didDragRef.current = false;
        document.body.classList.add('no-select');

        if (isOracleMode && !event) {
            if (!scheduleGridRef.current) return;
            const gridRect = scheduleGridRef.current.getBoundingClientRect();
            const xInGrid = e.clientX - gridRect.left;
            
            const startTime = xInGrid / (PIXELS_PER_HOUR * zoomLevel) + START_HOUR;
            const yInGrid = e.clientY - gridRect.top;
            const row = Math.floor(yInGrid / ROW_HEIGHT);
            const resourceId = resources[row] || resources[0];
            
            onOracleMouseDown(startTime, resourceId);
            return;
        }

        if (event) {
            // Tile Drag Start
            const tileElement = e.currentTarget;
            const rect = tileElement.getBoundingClientRect();
            const initialPositions = new Map<string, { startTime: number, rowIndex: number }>();
            const originalResourceIds = new Map<string, string>();

            const processedDragEventIds = new Set<string>();
            const processEvent = (ev: ScheduleEvent) => {
                if (processedDragEventIds.has(ev.id)) return;
                processedDragEventIds.add(ev.id);
                const rowIndex = resources.indexOf(ev.resourceId);
                if (rowIndex !== -1) {
                    initialPositions.set(ev.id, { startTime: ev.startTime, rowIndex });
                    originalResourceIds.set(ev.id, ev.resourceId);
                }
            };
            const processEventWithFormation = (ev: ScheduleEvent) => {
                const formationId = String(ev.formationId || '').trim();
                if (!formationId) {
                    processEvent(ev);
                    return;
                }
                events
                    .filter(candidate => candidate.formationId === formationId)
                    .forEach(processEvent);
            };

            if (isMultiSelectMode && selectedEventIds.has(event.id)) {
                selectedEventIds.forEach(id => {
                    const ev = events.find(e => e.id === id);
                    if (ev) processEventWithFormation(ev);
                });
            } else {
                processEventWithFormation(event);
            }

            if (initialPositions.size > 0) {
                lastDragUpdateSignatureRef.current = '';
                lastDragCommitUpdatesRef.current = null;
                pendingDragUpdateRef.current = null;
                dragDiagnosticSessionRef.current = startDfpDragDiagnostic({
                    board: 'DFP',
                    eventId: event.id,
                    eventType: event.type,
                    flightNumber: event.flightNumber,
                    resourceId: event.resourceId,
                    draggedTileCount: initialPositions.size,
                    eventCount: events.length,
                    resourceCount: resources.length,
                    zoomLevel,
                });
                watchDfpMoveChangeEvents(Array.from(initialPositions.keys()));
                appendDfpMoveChangeTrace('drag:start', {
                    date,
                    event: summariseDfpMoveEvent(event),
                    draggedEventIds: Array.from(initialPositions.keys()),
                    initialPositions: Array.from(initialPositions.entries()).map(([eventId, position]) => ({
                        eventId,
                        startTime: position.startTime,
                        resourceId: originalResourceIds.get(eventId) || null,
                        rowIndex: position.rowIndex,
                    })),
                    eventCount: events.length,
                    baselineEvent: summariseDfpMoveEvent(baselineEvents?.find((baseline) => baseline.id === event.id)),
                });
                setDraggingState({
                    mainEventId: event.id,
                    xOffset: (e.clientX - rect.left) / zoomLevel,
                    yOffset: e.clientY - rect.top,
                    initialPositions,
                    originalResourceIds,
                });
            }
        } else {
            // Grid Selection Start (Marquee)
            if (!isMultiSelectMode) return;
            if (!scheduleGridRef.current) return;
            
            const gridRect = scheduleGridRef.current.getBoundingClientRect();
            const x = e.clientX - gridRect.left;
            const y = e.clientY - gridRect.top;
            
            selectionStartPoint.current = { x, y };
            setSelectionRect({ x, y, width: 0, height: 0 });
        }
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        const moveStartedAt = performance.now();
        if (!scheduleGridRef.current) {
            return;
        }
        didDragRef.current = true;
        const geometryStartedAt = performance.now();
        const gridRect = scheduleGridRef.current.getBoundingClientRect();
        const xInGrid = e.clientX - gridRect.left;
        const yInGrid = e.clientY - gridRect.top;
        const geometryMs = performance.now() - geometryStartedAt;
        
        // Update validate overlay position when dispatch rate mode is ON
        if (showDepartureDensityOverlay) {
            const mouseTimeInHours = (xInGrid / (PIXELS_PER_HOUR * zoomLevel)) + START_HOUR;
            setValidateOverlayTime(mouseTimeInHours);
        }

        if (isOracleMode && oraclePreviewEvent) {
            const startTime = xInGrid / (PIXELS_PER_HOUR * zoomLevel) + START_HOUR;
            const resourceId = resources[Math.floor(yInGrid / ROW_HEIGHT)] || resources[0];
            onOracleMouseMove(startTime, resourceId);
        } else {
            if (selectionStartPoint.current) {
                const currentX = e.clientX - gridRect.left;
                const currentY = e.clientY - gridRect.top;
                
                const x = Math.min(selectionStartPoint.current.x, currentX);
                const y = Math.min(selectionStartPoint.current.y, currentY);
                const width = Math.abs(currentX - selectionStartPoint.current.x);
                const height = Math.abs(currentY - selectionStartPoint.current.y);
                
                setSelectionRect({ x, y, width, height });
                
                const rectLeft = x;
                const rectRight = x + width;
                const rectTop = y;
                const rectBottom = y + height;

                const newSelectedIds = new Set<string>();
                events.forEach(ev => {
                    const rowIndex = resources.indexOf(ev.resourceId);
                    if (rowIndex === -1) return;
                    
                    const tileTop = rowIndex * ROW_HEIGHT;
                    const tileBottom = tileTop + ROW_HEIGHT;
                    const tileLeft = (ev.startTime - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
                    const tileRight = tileLeft + (ev.duration * PIXELS_PER_HOUR * zoomLevel);

                    if (rectLeft < tileRight && rectRight > tileLeft && rectTop < tileBottom && rectBottom > tileTop) {
                        newSelectedIds.add(ev.id);
                    }
                });
                setSelectedEventIds(newSelectedIds);
                return;
            }

            if (!draggingState) {
                    return;
                }

            const mainEventInitialPos = draggingState.initialPositions.get(draggingState.mainEventId);
            if (!mainEventInitialPos) return;

            const timeShift = ((xInGrid / zoomLevel) - draggingState.xOffset) / PIXELS_PER_HOUR - mainEventInitialPos.startTime;
            const rowShift = Math.floor((yInGrid - draggingState.yOffset + ROW_HEIGHT / 2) / ROW_HEIGHT) - mainEventInitialPos.rowIndex;

            const updates: { eventId: string, newStartTime: number, newResourceId: string }[] = [];
            const tempEvents = [...events];
            let resourceConflictId: string | null = null;
            let tempCptConflict: Conflict | null = null;
            let tempRealtimeConflict: { conflictingEventId: string; conflictedPersonName: string; } | null = null;
            const buildUpdatesStartedAt = performance.now();

            for (const [id, initialPos] of draggingState.initialPositions.entries()) {
                const eventData = events.find(ev => ev.id === id);
                if (!eventData) continue;

                let newStartTime = initialPos.startTime + timeShift;
                let newRowIndex = initialPos.rowIndex + rowShift;

                if (newRowIndex < 0) newRowIndex = 0;
                if (newRowIndex >= resources.length) newRowIndex = resources.length - 1;
                if (newStartTime < START_HOUR) newStartTime = START_HOUR;
                if ((newStartTime + eventData.duration) > END_HOUR) newStartTime = END_HOUR - eventData.duration;

                const snappedStartTime = Math.round(newStartTime * 12) / 12;
                const newResourceId = resources[newRowIndex];

                updates.push({ eventId: id, newStartTime: snappedStartTime, newResourceId });

                const tempEventIndex = tempEvents.findIndex(e => e.id === id);
                if (tempEventIndex !== -1) {
                    tempEvents[tempEventIndex] = { ...tempEvents[tempEventIndex], startTime: snappedStartTime, resourceId: newResourceId };
                }

                const conflictingEvent = events.find(ev => 
                    ev.id !== id && 
                    !draggingState.initialPositions.has(ev.id) &&
                    ev.resourceId === newResourceId &&
                    isOverlapping({ ...eventData, startTime: snappedStartTime, resourceId: newResourceId } as ScheduleEvent, ev)
                );

                if (conflictingEvent) {
                    resourceConflictId = conflictingEvent.id;
                }
            }
            const buildUpdatesMs = performance.now() - buildUpdatesStartedAt;
            
            const conflictStartedAt = performance.now();
            const mainUpdate = updates.find(u => u.eventId === draggingState.mainEventId);
            if (mainUpdate) {
                const mainEvent = tempEvents.find(e => e.id === draggingState.mainEventId)!;
                const otherEvents = tempEvents.filter(e => !draggingState.initialPositions.has(e.id));
                
                // Use new conflict detection if available, otherwise fall back to old method
                let conflictResult = null;
                if (detectConflictsForEvent) {
                    conflictResult = detectConflictsForEvent(mainEvent, otherEvents);
                    if (conflictResult.hasConflict) {
                        tempRealtimeConflict = {
                            conflictingEventId: conflictResult.conflictingEventId!, 
                            conflictedPersonName: conflictResult.conflictedPersonnel || '' 
                        };
                        if (mainEvent.flightNumber.includes('CPT') && conflictResult.conflictType === 'personnel') {
                            const conflictingEvent = otherEvents.find(e => e.id === conflictResult.conflictingEventId);
                            if (conflictingEvent) {
                                tempCptConflict = {
                                    conflictingEvent: conflictingEvent,
                                    newEvent: mainEvent,
                                    conflictedPerson: 'trainee',
                                };
                            }
                        }
                    }
                } else {
                    // Fallback to old method
                    const conflict = findConflict([mainEvent], otherEvents);
                    
                    if (conflict) {
                        tempRealtimeConflict = {
                            conflictingEventId: conflict.conflictingEvent.id, 
                            conflictedPersonName: conflict.personName 
                        };
                        if (mainEvent.flightNumber.includes('CPT')) {
                            tempCptConflict = {
                                conflictingEvent: conflict.conflictingEvent,
                                newEvent: mainEvent,
                                conflictedPerson: 'trainee',
                                personName: conflict.personName
                            } as Conflict;
                        }
                    }
                }
            }
            const conflictMs = performance.now() - conflictStartedAt;

            const updateSignature = updates
                .map(update => `${update.eventId}:${update.newStartTime}:${update.newResourceId}`)
                .join('|');
            if (updateSignature === lastDragUpdateSignatureRef.current) {
                recordDfpDragMoveDiagnostic(dragDiagnosticSessionRef.current, {
                    xInGrid,
                    yInGrid,
                    updateCount: updates.length,
                    duplicateSkipped: true,
                    totalMoveMs: performance.now() - moveStartedAt,
                    geometryMs,
                    buildUpdatesMs,
                    conflictMs,
                    signature: updateSignature,
                });
                return;
            }
            lastDragUpdateSignatureRef.current = updateSignature;
            pendingDragUpdateRef.current = {
                updates,
                realtimeConflict: tempRealtimeConflict,
                resourceConflictId,
                cptConflict: tempCptConflict,
                queuedAtMs: performance.now(),
                signature: updateSignature,
            };
            recordDfpDragMoveDiagnostic(dragDiagnosticSessionRef.current, {
                xInGrid,
                yInGrid,
                updateCount: updates.length,
                duplicateSkipped: false,
                totalMoveMs: performance.now() - moveStartedAt,
                geometryMs,
                buildUpdatesMs,
                conflictMs,
                signature: updateSignature,
            });
            const watchedUpdates = updates.filter(update => isWatchingDfpMoveChangeEvent(update.eventId));
            if (watchedUpdates.length > 0) {
                appendDfpMoveChangeTrace('drag:move-preview', {
                    date,
                    updates: watchedUpdates,
                });
            }
            if (dragFrameRef.current === null) {
                dragFrameRef.current = window.requestAnimationFrame(() => {
                    dragFrameRef.current = null;
                    flushPendingDragUpdate(false);
                });
            }
        }
    };

    const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        if (draggingState) {
            flushPendingDragUpdate(true);
            window.requestAnimationFrame(clearDragVisualStyles);
            return; // Don't clear drag state if we're in a drag operation
        }
        document.body.classList.remove('no-select');
        
        if (isOracleMode) {
            onOracleMouseUp();
        }

        if (draggedCptConflict) {
            onCptConflict(draggedCptConflict);
        }
        setDraggingState(null);
        setRealtimeConflict(null);
        setRealtimeResourceConflictId(null);
        setDraggedCptConflict(null);
        window.requestAnimationFrame(clearDragVisualStyles);
        lastDragCommitUpdatesRef.current = null;
        endDfpDragDiagnostic(dragDiagnosticSessionRef.current);
        dragDiagnosticSessionRef.current = null;
        
        // Clear validate overlay when mouse leaves
        setValidateOverlayTime(null);

        // Finalize marquee selection
        if (selectionStartPoint.current && isMultiSelectMode) {
            selectionStartPoint.current = null;
            setSelectionRect(null);

            if (!didDragRef.current && !e.shiftKey) {
                const target = e.target as HTMLElement;
                if (!target.closest('[data-is-flight-tile="true"]')) {
                    setSelectedEventIds(new Set());
                }
            }
        }
        
        setTimeout(() => { didDragRef.current = false; }, 0);
    };

    const timeStringToHours = useCallback((timeString: string | null): number | null => {
        if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours + minutes / 60;
    }, []);

    const renderTimeHeaders = () => {
        const markers = [];
        for (let i = START_HOUR; i <= END_HOUR; i++) {
            markers.push(
                <div key={i} data-schedule-time-label="true" className="absolute h-full top-0 text-xs text-gray-500 flex items-center" style={{ left: (i - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
                    <span className="-translate-x-1/2">{`${String(i).padStart(2, '0')}:00`}</span>
                </div>
            );
        }
        
        const firstLightHour = timeStringToHours(daylightTimes.firstLight);
        const lastLightHour = timeStringToHours(daylightTimes.lastLight);

        if (firstLightHour !== null) {
            const flLeft = (firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
            markers.push(
                <div key="fl-label" data-schedule-daylight-label="true" className="absolute h-full top-0 text-xs text-white font-bold flex items-center" style={{ left: flLeft }}>
                    <span className="-translate-x-1/2">{`FL ${daylightTimes.firstLight}`}</span>
                </div>
            );
        }

        if (lastLightHour !== null) {
            const llLeft = (lastLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
            markers.push(
                <div key="ll-label" data-schedule-daylight-label="true" className="absolute h-full top-0 text-xs text-white font-bold flex items-center" style={{ left: llLeft }}>
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
                <div key={`v-${i}`} data-schedule-hour-line="true" className="absolute h-full top-0" style={{ left: (i - START_HOUR) * PIXELS_PER_HOUR * zoomLevel }}>
                    <div className="w-px h-full bg-gray-700/50"></div>
                </div>
            );
            if (i < END_HOUR) {
                lines.push(
                    <div key={`v-${i}-30`} data-schedule-half-hour-line="true" className="absolute h-full top-0" style={{ left: (i - START_HOUR + 0.5) * PIXELS_PER_HOUR * zoomLevel }}>
                        <div className="w-px h-full bg-gray-700/25"></div>
                    </div>
                );
            }
        }
        for (let i = 1; i <= resources.length; i++) {
            lines.push(
                <div key={`h-${i}`} data-schedule-row-line="true" className="absolute left-0 w-full bg-gray-700/25" style={{ top: i * ROW_HEIGHT, height: '1px' }}></div>
            );
        }
        return lines;
    };

    const renderCategorySeparators = () => {
        const lines = [];
        let prevCategory = getResourceCategory(resources[0]);
        for (let i = 1; i < resources.length; i++) {
            const category = getResourceCategory(resources[i]);
            if (category !== prevCategory) {
                lines.push(
                    <div 
                        key={`sep-${i}`} 
                        data-schedule-separator="true"
                        className="absolute left-0 w-full border-t-2 border-gray-500 z-10" 
                        style={{ top: i * ROW_HEIGHT }} 
                    />
                );
                prevCategory = category;
            }
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
                        data-schedule-daylight-line="true"
                        style={{ left: `${(firstLightHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px` }}
                    />
                )}
                {lastLightHour !== null && (
                     <div
                        className="absolute top-0 h-full z-[5] pointer-events-none border-l border-dashed border-white/30"
                        data-schedule-daylight-line="true"
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
                    data-schedule-night-shade="true"
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
                    data-schedule-night-shade="true"
                    className="absolute top-0 h-full bg-white/5 pointer-events-none z-[1]"
                    style={{ left: `${left}px`, width: `${width}px` }}
                />
            );
        }
        return <>{shades}</>;
    };

    const renderExclusionPeriods = () => {
        const gridHeight = resources.length * ROW_HEIGHT;
        const segments = flyingWindowExclusions.flatMap((period) => {
            const rawStart = Number(period.startTime);
            const rawEnd = Number(period.endTime);
            if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || rawStart === rawEnd) return [];

            const periodSegments = rawEnd > rawStart
                ? [{ start: rawStart, end: rawEnd }]
                : [
                    { start: rawStart, end: END_HOUR },
                    { start: START_HOUR, end: rawEnd },
                ];

            return periodSegments
                .map(segment => ({
                    id: period.id,
                    restriction: period.restriction,
                    start: Math.max(START_HOUR, segment.start),
                    end: Math.min(END_HOUR, segment.end),
                }))
                .filter(segment => segment.end > segment.start);
        });

        return (
            <>
                {segments.map((segment, index) => {
                    const left = (segment.start - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
                    const width = (segment.end - segment.start) * PIXELS_PER_HOUR * zoomLevel;
                    const title = `Exclusion period ${segment.start.toFixed(2)}-${segment.end.toFixed(2)} (${segment.restriction})`;
                    return (
                        <div
                            key={`exclusion-fill-${segment.id}-${index}`}
                            data-schedule-exclusion-fill="true"
                            className="absolute top-0 pointer-events-none z-[2] bg-red-500/5"
                            style={{ left: `${left}px`, width: `${width}px`, height: `${gridHeight}px` }}
                            title={title}
                        />
                    );
                })}
                {segments.map((segment, index) => {
                    const left = (segment.start - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
                    const right = (segment.end - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
                    return (
                        <React.Fragment key={`exclusion-lines-${segment.id}-${index}`}>
                            <div
                                data-schedule-exclusion-start-line="true"
                                className="absolute top-0 pointer-events-none z-[6] w-px bg-red-400/20"
                                style={{ left: `${left}px`, height: `${gridHeight}px` }}
                            />
                            <div
                                data-schedule-exclusion-end-line="true"
                                className="absolute top-0 pointer-events-none z-[6] w-px bg-red-400/35"
                                style={{ left: `${right}px`, height: `${gridHeight}px` }}
                            />
                        </React.Fragment>
                    );
                })}
            </>
        );
    };

    const renderCurrentTimeIndicator = () => {
        // Create timezone-adjusted date string for comparison
        // Since currentTime is already timezone-adjusted, we need to get the date from it
        const getLocalDateStringFromAdjustedTime = (date: Date): string => {
            // The date parameter is already timezone-adjusted, so just extract UTC components
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        // Use the timezone-adjusted currentTime to get today's string
        const todayStr = getLocalDateStringFromAdjustedTime(currentTime);
        
        if (date !== todayStr) return null;
        
        const now = currentTime;
        // Use UTC methods since currentTime is already timezone-adjusted
        const currentHour = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        if (currentHour < START_HOUR || currentHour > END_HOUR) return null;
        
        const leftPosition = (currentHour - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        
        return (
            <div 
                data-schedule-current-time="true"
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

    // Render validate mode overlay (also used for dispatch rate display)
    const renderValidateOverlay = () => {
        
        // Overlay should show only when dispatch rate mode is active (independent of validation mode)
        if (validateOverlayTime === null || !showDepartureDensityOverlay) return null;
        
        const windowMinutes = normaliseDispatchRateWindowMinutes(dispatchRateWindowMinutes);
        const halfWindowHours = windowMinutes / 120;
        const windowStart = validateOverlayTime - halfWindowHours;
        const windowEnd = validateOverlayTime + halfWindowHours;
        
        // Count flights starting in this window (exclude STBY/BNF-STBY lines)
        const flightCount = events.filter(event => {
            // Only count flight events (not FTD, CPT, Ground, Duty Sup, etc.)
            if (event.type !== 'flight') return false;
            // Exclude cancelled/STBY line events
            if (event.resourceId?.startsWith('STBY') || event.resourceId?.startsWith('BNF-STBY')) return false;
            if (event.isCancelled) return false;
            // Check if start time falls within the window
            return event.startTime >= windowStart && event.startTime < windowEnd;
        }).length;
        
        // Calculate pixel positions
        const leftX = (windowStart - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        const rightX = (windowEnd - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
        const width = rightX - leftX;
        
        return (
            <>
                {/* Translucent overlay area */}
                <div
                    className="absolute top-0 h-full bg-white/10 pointer-events-none z-[25]"
                    style={{
                        left: `${leftX}px`,
                        width: `${width}px`
                    }}
                />
                
                {/* Left vertical line */}
                <div
                    className="absolute top-0 h-full w-0.5 bg-white/40 pointer-events-none z-[26]"
                    style={{ left: `${leftX}px` }}
                />
                
                {/* Right vertical line */}
                <div
                    className="absolute top-0 h-full w-0.5 bg-white/40 pointer-events-none z-[26]"
                    style={{ left: `${rightX}px` }}
                />
                
                {/* Floating label at top */}
                <div
                    className="absolute top-2 bg-gray-800/95 border border-white/30 rounded px-3 py-1.5 shadow-lg pointer-events-none z-[27]"
                    style={{
                        left: `${leftX + width / 2}px`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="text-white text-xs font-semibold whitespace-nowrap">
                        Flights starting in {windowMinutes} min: <span className="text-sky-400">{flightCount}</span>
                    </div>
                </div>
            </>
        );
    };

    const renderFlightLineAircraftMarkers = () => (
        <>
            {flightLineAircraftMarkerEntries.map(({ aircraftNumber, event, hasAircraftConflict, isPreview }: any) => {
                const rowIndex = resources.indexOf(event.resourceId);
                if (rowIndex < 0) return null;
                const markerWidth = 22;
                const markerLeft = ((event.startTime + event.duration - START_HOUR) * PIXELS_PER_HOUR * zoomLevel);
                const markerTop = rowIndex * ROW_HEIGHT + 2;
                const markerHeight = ROW_HEIGHT - 4;
                const markerColourClass = hasAircraftConflict ? 'bg-red-600' : 'bg-[#4f5357]';
                const markerTextClass = hasAircraftConflict ? 'text-red-100' : 'text-slate-300';
                return (
                    <div
                        key={`flight-line-aircraft-marker-${aircraftNumber}-${event.id}`}
                        data-dfp-context-kind="aircraft"
                        data-dfp-aircraft-number={aircraftNumber}
                        data-dfp-event-id={event.id}
                        data-dfp-event-label={event.flightNumber || event.eventCode || event.id}
                        data-dfp-resource-id={event.resourceId}
                        draggable={canEditTileAircraftNumber && !isReadOnly}
                        onDragStart={(dragEvent) => {
                            if (!canEditTileAircraftNumber || isReadOnly) {
                                dragEvent.preventDefault();
                                return;
                            }
                            setFlightLineDraggedAircraftNumber(aircraftNumber);
                            dragEvent.dataTransfer.effectAllowed = 'move';
                            dragEvent.dataTransfer.setData('application/flight-line-aircraft', aircraftNumber);
                            dragEvent.dataTransfer.setData('application/flight-line-aircraft-event', event.id);
                            dragEvent.dataTransfer.setData('text/plain', aircraftNumber);
                        }}
                        onDragEnd={clearFlightLineDragState}
                        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                        className={`absolute transition-all duration-300 ease-out ${canEditTileAircraftNumber && !isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} ${isPreview ? 'opacity-70' : 'opacity-100'}`}
                        style={{
                            left: `${markerLeft}px`,
                            top: `${markerTop}px`,
                            width: `${markerWidth}px`,
                            height: `${markerHeight}px`,
                            zIndex: 48,
                        }}
                        title={hasAircraftConflict ? `Aircraft ${aircraftNumber} conflict` : `Aircraft ${aircraftNumber}`}
                    >
                        <div className={`absolute right-0 top-0 bottom-0 w-[11px] rounded-r-md ${markerColourClass} shadow-[0_8px_18px_rgba(0,0,0,0.28)]`} />
                        <div className={`absolute left-0 top-0 h-[2.5px] w-[14px] ${markerColourClass}`} />
                        <div className={`absolute left-0 bottom-0 h-[2.5px] w-[14px] ${markerColourClass}`} />
                        <div className="absolute right-0 top-0 bottom-0 flex w-[11px] items-center justify-center">
                            <span className={`block rotate-90 font-mono text-[8px] font-black leading-none ${markerTextClass}`}>{aircraftNumber}</span>
                        </div>
                    </div>
                );
            })}
        </>
    );

    // Render loop for events
    const renderEvents = () => {
        return resources.flatMap((resource, rowIndex) => {
            const resourceEvents = events
                .filter(e => e.resourceId === resource)
                .sort((a, b) => {
                    if (a.type === 'deployment' && b.type !== 'deployment') return -1;
                    if (a.type !== 'deployment' && b.type === 'deployment') return 1;
                    return a.startTime - b.startTime;
                });
            return resourceEvents.map(event => {
                const isDraggedTile = !!(draggingState && draggingState.initialPositions.has(event.id));
                const isStationaryConflictTile = event.id === realtimeConflict?.conflictingEventId || event.id === realtimeResourceConflictId;
                const isConflicting = 
                    (showValidation && personnelConflictIds.has(getValidationEventKey(event))) || 
                    flightLineAircraftConflictEventIds.has(event.id) ||
                    isStationaryConflictTile ||
                    (isDraggedTile && !!(realtimeConflict || realtimeResourceConflictId));
                
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

                const isSelected = selectedEventIds.has(event.id);
                const isChanged = checkIsChanged(event, baselineEvents);
                // Stay highlighted as long as event is in pauseCompletedEventIds (not just during selection mode)
                const isPauseCompleted = !!(pauseCompletedEventIds?.size && pauseCompletedEventIds.has(event.id));

                // Determine alert status for this event's change bar
                const alertEntry = alertsData?.[event.id];
                let alertStatus: 'pending' | 'accepted' | 'rejected' | null = null;
                if (alertEntry && alertEntry.responses) {
                    const statuses = Object.values(alertEntry.responses).map((r: any) => r.status);
                    if (statuses.length > 0) {
                        if (statuses.every(s => s === 'accepted')) alertStatus = 'accepted';
                        else if (statuses.some(s => s === 'rejected')) alertStatus = 'rejected';
                        else alertStatus = 'pending';
                    }
                }
                if (isWatchingDfpMoveChangeEvent(event.id)) {
                    appendDfpMoveChangeTrace('render:tile-change-state', {
                        date,
                        event: summariseDfpMoveEvent(event),
                        baselineEvent: summariseDfpMoveEvent(baselineEvents?.find((baseline) => baseline.id === event.id)),
                        isChanged,
                        alertStatus,
                        isDraggedTile,
                        isSelected,
                    });
                }

                return (
                    <FlightTile
                        key={event.id}
                        event={event}
                        traineesData={traineesData}
                        instructorsData={instructorsData}
                        onSelectEvent={() => { 
                               if (!didDragRef.current) {
                                   if (isPauseSelectMode && onPauseToggleCompleted) {
                                       // Pause selection mode - toggle completed status
                                       onPauseToggleCompleted(event.id);
                                   } else if (isMultiSelectMode) {
                                       // Toggle selection in multi-select mode
                                       const newSelectedIds = new Set(selectedEventIds);
                                       if (newSelectedIds.has(event.id)) {
                                           newSelectedIds.delete(event.id);
                                       } else {
                                           newSelectedIds.add(event.id);
                                       }
                                       setSelectedEventIds(newSelectedIds);
                                   } else {
                                       // Normal behavior - open modal
                                       onSelectEvent(event);
                                   }
                               }
                           }}
                        onSelectAcademicTile={(tile) => {
                            if (didDragRef.current || isPauseSelectMode || isMultiSelectMode) return;
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
                        onMouseEnter={() => {}}
                        onMouseLeave={() => {}}
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
                        isDraggable={!isPauseSelectMode && !isReadOnly}
                        currentTime={currentTime}
                        isSelected={isSelected}
                        isChanged={isChanged}
                        isPauseCompleted={isPauseCompleted}
                        isDiagnosticHighlighted={diagnosticHighlightedEventIds.has(event.id)}
                        alertStatus={alertStatus}
                        aircraftNumberSettings={aircraftNumberSettings}
                        disableLayoutTransition={isDraggedTile}
                        instructorLabel={schedulePersonnelDisplaySettings.instructorLabel || 'Instructor'}
                    />
                );
            });
        });
    };

    return (
        <div ref={scrollContainerRef} data-schedule-surface="true" className="flex-1 overflow-auto relative bg-gray-900 select-none" style={isPauseSelectMode ? { cursor: 'crosshair' } : undefined}>
            {resourceSlideoutFrame && (
                <div
                    className="fixed z-[35] pointer-events-none overflow-hidden"
                    style={{
                        left: `${resourceSlideoutFrame.left}px`,
                        top: `${resourceSlideoutFrame.top}px`,
                        height: `${resourceSlideoutFrame.height}px`,
                        width: 'min(calc(clamp(360px, 40vw, 680px) + 472px), calc(100vw - 348px))',
                    }}
                    aria-hidden={!showResourceUnderlayPanel}
                >
                    <aside
                        className={`absolute left-0 top-0 h-full pointer-events-none border-r border-cyan-400/25 bg-slate-950 shadow-[18px_0_36px_rgba(0,0,0,0.38)] transition-transform duration-300 ease-out ${showResourceUnderlayPanel ? '' : '-translate-x-full'}`}
                        style={{ width: 'min(calc(clamp(360px, 40vw, 680px) + 400px), calc(100vw - 420px))' }}
                    >
                        <div className={`h-full overflow-hidden border-r border-white/5 bg-slate-950 ${showResourceUnderlayPanel ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                            <OrganisationSlideoutDiagram platformConfig={platformConfig} organisationSettings={organisationSettings} unitCode={unitCode} locationCode={locationCode} formationCallsigns={formationCallsigns} buildRuleSettings={buildRuleSettings} onUpdatePlatformConfig={onUpdatePlatformConfig} onNavigateToSettingsSection={onNavigateToSettingsSection} currentUserPermission={currentUserPermission} canUsePlatformPermission={canUsePlatformPermission} isSetupTestMode={isSetupTestMode} onSaveSetupTestPersonnel={onSaveSetupTestPersonnel} isOpen={showResourceUnderlayPanel} onInitialSetupWizardActiveChange={onInitialSetupWizardActiveChange} />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowResourceUnderlayPanel((value) => {
                                const nextValue = !value;
                                if (nextValue) onOrganisationSlideoutOpen?.();
                                return nextValue;
                            })}
                            aria-label={showResourceUnderlayPanel ? 'Close resource slideout' : 'Open resource slideout'}
                            className="pointer-events-auto absolute right-[-56px] top-1/2 z-[1] flex h-7 w-[96px] -translate-y-1/2 rotate-90 items-center justify-between rounded-t-md border border-b-0 border-slate-500/60 bg-slate-950/92 px-2.5 text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-cyan-300/70 hover:text-cyan-100"
                        >
                            <span
                                className="h-4 w-7 opacity-80"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.7px)',
                                    backgroundSize: '8px 8px',
                                }}
                            />
                            <span className="text-sm font-semibold leading-none">{showResourceUnderlayPanel ? 'v' : '^'}</span>
                            <span
                                className="h-4 w-7 opacity-80"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.7px)',
                                    backgroundSize: '8px 8px',
                                }}
                            />
                        </button>
                    </aside>
                </div>
            )}
            {resourceSlideoutFrame && (
                <div
                    className="fixed z-[36] pointer-events-none"
                    style={{
                        left: `${resourceSlideoutFrame.left}px`,
                        bottom: `${resourceSlideoutFrame.bottom}px`,
                        width: `${resourceSlideoutFrame.width}px`,
                        height: `${flightLinePanelHeight + 28}px`,
                    }}
                    aria-hidden={!isFlightLinePanelOpen}
                >
                    <aside
                        className="absolute bottom-0 left-0 w-full pointer-events-auto border-t border-cyan-400/25 bg-slate-950/96 shadow-[0_-18px_36px_rgba(0,0,0,0.38)] backdrop-blur transition-transform duration-300 ease-out"
                        style={{
                            height: `${flightLinePanelHeight}px`,
                            transform: isFlightLinePanelOpen ? 'translateY(0)' : `translateY(${flightLinePanelHeight}px)`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onToggleFlightLinePanel}
                            aria-label={isFlightLinePanelOpen ? 'Close flight line panel' : 'Open flight line panel'}
                            className="absolute left-1/2 top-[-28px] z-[1] flex h-7 w-[96px] -translate-x-1/2 items-center justify-between rounded-t-md border border-b-0 border-slate-500/60 bg-slate-950/92 px-2.5 text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-cyan-300/70 hover:text-cyan-100"
                        >
                            <span
                                className="h-4 w-7 opacity-80"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.7px)',
                                    backgroundSize: '8px 8px',
                                }}
                            />
                            <span className="text-sm font-semibold leading-none">{isFlightLinePanelOpen ? 'v' : '^'}</span>
                            <span
                                className="h-4 w-7 opacity-80"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.7px)',
                                    backgroundSize: '8px 8px',
                                }}
                            />
                        </button>
                        <div className="h-full overflow-hidden border-t border-white/5 bg-gradient-to-r from-slate-900/85 via-slate-950/95 to-slate-900/85 px-5 py-4">
                            <div className="flex h-full min-w-0 items-stretch gap-4">
                                <div className="flex w-[200px] max-w-[200px] shrink-0 flex-col border-r border-slate-700/70 pr-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Aircraft Inventory</p>
                                        <span className="rounded border border-slate-600/70 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">{flightLinePoolContext.aircraftCount}</span>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-slate-100">{locationCode} - {unitCode}</p>
                                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                                            {flightLinePoolContext.numbers.length > 0 ? flightLinePoolContext.numbers.map((number, index) => (
                                                <label key={`flight-line-aircraft-inventory-${index}`} className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{flightLinePoolContext.prefix || 'No.'}</span>
                                                    <input
                                                        type="text"
                                                        value={number}
                                                        onChange={(event) => updateFlightLineAircraftNumber(index, event.target.value)}
                                                        disabled={!canEditFlightLineInventory || isReadOnly}
                                                        className={`h-7 min-w-0 rounded border px-2 text-xs font-bold outline-none transition focus:border-cyan-300 ${canEditFlightLineInventory && !isReadOnly ? 'border-slate-600/80 bg-slate-950/80 text-slate-100' : 'cursor-not-allowed border-slate-700/70 bg-slate-900/70 text-slate-500'}`}
                                                        title={canEditFlightLineInventory && !isReadOnly ? 'Edit aircraft inventory number' : 'Aircraft inventory edit permission required'}
                                                    />
                                                </label>
                                            )) : (
                                                <div className="rounded border border-slate-700/80 bg-slate-950/60 px-2 py-2 text-[10px] font-semibold text-slate-500">No aircraft rows configured.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex min-w-0 flex-1 items-stretch">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Aircraft Tiles</p>
                                            <div className="flex flex-wrap items-center justify-end gap-2 text-[10px]">
                                                <span
                                                    className={`rounded border px-1.5 py-0.5 font-bold ${
                                                        flightLineAvailabilityCheckOk
                                                            ? 'border-slate-700/80 text-slate-500'
                                                            : 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                                                    }`}
                                                    title="Inventory minus unavailable should equal the visible aircraft tiles and linked availability count."
                                                >
                                                    {flightLineLinkedAvailabilityCount} available
                                                </span>
                                                <label
                                                    className={`flex items-center gap-1.5 rounded border px-2 py-1 ${
                                                        canEditFlightLineAvailabilityLink && !isReadOnly
                                                            ? 'cursor-pointer border-slate-700/80 bg-slate-950/45 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-100'
                                                            : 'cursor-not-allowed border-slate-800 bg-slate-950/30 text-slate-600'
                                                    }`}
                                                    title={canEditFlightLineAvailabilityLink && !isReadOnly
                                                        ? 'When linked, the solid aircraft availability line follows aircraft tiles minus unavailable aircraft.'
                                                        : 'Permission required to change linked aircraft availability'}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={flightLinePoolContext.linkAircraftAvailability}
                                                        disabled={!canEditFlightLineAvailabilityLink || isReadOnly}
                                                        onChange={(event) => setFlightLineLinkAircraftAvailability(event.target.checked)}
                                                        className="h-3 w-3 accent-cyan-400"
                                                    />
                                                    <span className="font-semibold">Link Aircraft Availability</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div
                                            className={`mt-3 flex min-h-[88px] flex-wrap gap-2 rounded-md border px-2 py-2 pb-1 transition-all duration-300 ease-out ${isFlightLineAvailableDropActive ? 'border-cyan-300/70 bg-cyan-500/10' : 'border-transparent bg-transparent'}`}
                                            onDragOver={(event) => {
                                                if (!canEditFlightLineAvailability || isReadOnly) return;
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                                setIsFlightLineAvailableDropActive(true);
                                            }}
                                            onDragLeave={(event) => {
                                                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                                    setIsFlightLineAvailableDropActive(false);
                                                }
                                            }}
                                            onDrop={(event) => {
                                                if (!canEditFlightLineAvailability || isReadOnly) return;
                                                event.preventDefault();
                                                const aircraftNumber = event.dataTransfer.getData('text/plain') || flightLineDraggedAircraftNumber || '';
                                                const sourceEventId = getFlightLineDragSourceEventId(event);
                                                moveFlightLineAircraftToAvailable(aircraftNumber, sourceEventId);
                                            }}
                                        >
                                            {flightLinePoolContext.numbers.map((number) => {
                                                const tailNumber = [flightLinePoolContext.prefix, number].filter(Boolean).join(' ');
                                                const isDragging = flightLineDraggedAircraftNumber === number;
                                                const isUnavailable = flightLineEffectiveUnavailableSet.has(number);
                                                return (
                                                    <div
                                                        key={`flight-line-aircraft-slot-${number}`}
                                                        className="relative h-[40px] w-[50px] shrink-0"
                                                        title={tailNumber}
                                                    >
                                                        <div
                                                            className="absolute inset-0 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-500/45 bg-[#4f5357]/25 px-1 text-center font-black text-slate-300/70 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] transition-all duration-300 ease-out"
                                                            data-dfp-context-kind="aircraft-slot"
                                                            data-dfp-aircraft-number={number}
                                                            data-dfp-resource-label={tailNumber}
                                                            title={`${tailNumber} slot`}
                                                        >
                                                            {flightLinePoolContext.prefix ? (
                                                                <span className="mb-0.5 max-w-full truncate text-[9px] font-black uppercase leading-none tracking-normal text-slate-300/55">{flightLinePoolContext.prefix}</span>
                                                            ) : null}
                                                            <span className="max-w-full truncate text-[12px] font-black leading-none text-slate-200/70">{number}</span>
                                                        </div>
                                                        {!isUnavailable ? (
                                                            <div
                                                                data-dfp-context-kind="aircraft"
                                                                data-dfp-aircraft-number={number}
                                                                data-dfp-resource-label={tailNumber}
                                                                draggable={canEditTileAircraftNumber || canEditFlightLineAvailability}
                                                                onDragStart={(event) => {
                                                                    if (!canEditTileAircraftNumber && !canEditFlightLineAvailability) {
                                                                        event.preventDefault();
                                                                        return;
                                                                    }
                                                                    setFlightLineDraggedAircraftNumber(number);
                                                                    event.dataTransfer.effectAllowed = 'move';
                                                                    event.dataTransfer.setData('application/flight-line-aircraft', number);
                                                                    event.dataTransfer.setData('text/plain', number);
                                                                }}
                                                                onDragEnd={clearFlightLineDragState}
                                                                onContextMenu={(event) => openFlightLineAircraftContextMenu(event, number, tailNumber, false)}
                                                                className={`absolute inset-0 flex flex-col items-center justify-center rounded-md border px-1 text-center font-black text-slate-50 transition-all duration-300 ease-out ${(canEditTileAircraftNumber || canEditFlightLineAvailability) ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'} ${isDragging ? 'border-dashed border-cyan-200/70 bg-[#4f5357]/35 opacity-60 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]' : 'border-slate-500/45 bg-[#4f5357] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.28)]'}`}
                                                                title={tailNumber}
                                                            >
                                                                {flightLinePoolContext.prefix ? (
                                                                    <span className="mb-0.5 max-w-full truncate text-[9px] font-black uppercase leading-none tracking-normal text-slate-200/85">{flightLinePoolContext.prefix}</span>
                                                                ) : null}
                                                                <span className="max-w-full truncate text-[12px] font-black leading-none text-white">{number}</span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="flex w-[200px] max-w-[200px] shrink-0 flex-col border-l border-slate-700/70 pl-4"
                                    onDragOver={(event) => {
                                        if (!canEditFlightLineAvailability || isReadOnly) return;
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = 'move';
                                        setIsFlightLineUnavailableDropActive(true);
                                    }}
                                    onDragLeave={(event) => {
                                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                            setIsFlightLineUnavailableDropActive(false);
                                        }
                                    }}
                                    onDrop={(event) => {
                                        if (!canEditFlightLineAvailability || isReadOnly) return;
                                        event.preventDefault();
                                        const aircraftNumber = event.dataTransfer.getData('text/plain') || flightLineDraggedAircraftNumber || '';
                                        moveFlightLineAircraftToUnavailable(aircraftNumber);
                                    }}
                                >
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Unavailable</p>
                                    <div className={`mt-3 min-h-[88px] rounded-md border px-2 py-2 transition-all duration-300 ease-out ${isFlightLineUnavailableDropActive ? 'border-cyan-300/70 bg-cyan-500/10' : 'border-slate-700/80 bg-slate-950/55'}`}>
                                        {flightLineEffectiveUnavailableNumbers.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {flightLineEffectiveUnavailableNumbers.map((number) => {
                                                    const tailNumber = [flightLinePoolContext.prefix, number].filter(Boolean).join(' ');
                                                    const unavailableReason = getFlightLineUnavailableReason(number);
                                                    return (
                                                        <div
                                                            key={`flight-line-unavailable-aircraft-tile-${number}`}
                                                            data-dfp-context-kind="aircraft"
                                                            data-dfp-aircraft-number={number}
                                                            data-dfp-resource-label={tailNumber}
                                                            draggable={canEditFlightLineAvailability}
                                                            onDragStart={(event) => {
                                                                if (!canEditFlightLineAvailability || isReadOnly) {
                                                                    event.preventDefault();
                                                                    return;
                                                                }
                                                                setFlightLineDraggedAircraftNumber(number);
                                                                event.dataTransfer.effectAllowed = 'move';
                                                                event.dataTransfer.setData('application/flight-line-aircraft', number);
                                                                event.dataTransfer.setData('text/plain', number);
                                                            }}
                                                            onDragEnd={clearFlightLineDragState}
                                                            onContextMenu={(event) => openFlightLineAircraftContextMenu(event, number, tailNumber, true)}
                                                            className={`flex h-[40px] w-[50px] flex-col items-center justify-center rounded-md border px-1 text-center font-black text-slate-50 transition-all duration-300 ease-out ${canEditFlightLineAvailability && !isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'} ${flightLineDraggedAircraftNumber === number ? 'border-dashed border-red-300/80 bg-[#4f5357]/35 opacity-60 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.35)]' : 'border-red-500/80 bg-[#4f5357] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.28)]'}`}
                                                            title={unavailableReason ? `${tailNumber} unavailable: ${unavailableReason}` : `${tailNumber} unavailable: reason not allocated`}
                                                        >
                                                            {flightLinePoolContext.prefix ? (
                                                                <span className="mb-0.5 max-w-full truncate text-[9px] font-black uppercase leading-none tracking-normal text-slate-200/85">{flightLinePoolContext.prefix}</span>
                                                            ) : null}
                                                            <span className="max-w-full truncate text-[12px] font-black leading-none text-white">{number}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="px-1 py-1 text-[10px] font-semibold leading-4 text-slate-500">
                                                Drag aircraft here.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
            {flightLineAircraftContextMenu ? (() => {
                const menuWidth = flightLineAircraftContextMenuSize.width || 278;
                const menuHeight = flightLineAircraftContextMenuSize.height || (flightLineAircraftContextMenu.isUnavailable ? 214 : 146);
                const viewportLeft = resourceSlideoutFrame?.left ?? 0;
                const viewportTop = resourceSlideoutFrame?.top ?? 0;
                const viewportWidth = resourceSlideoutFrame?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
                const viewportHeight = resourceSlideoutFrame?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 768);
                const menuPosition = getAdaptiveContextMenuPosition({
                    clickX: flightLineAircraftContextMenu.x,
                    clickY: flightLineAircraftContextMenu.y,
                    menuWidth,
                    menuHeight,
                    viewportLeft,
                    viewportTop,
                    viewportWidth,
                    viewportHeight,
                    margin: 12,
                    anchorGap: 8,
                });
                return (
                    <div
                        ref={flightLineAircraftContextMenuRef}
                        className="fixed z-[1200] w-[278px] overflow-visible rounded-md border border-slate-600/80 bg-slate-950 shadow-2xl shadow-black/50"
                        style={{ left: menuPosition.left, top: menuPosition.top, transformOrigin: menuPosition.placement.replace('-', ' ') }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onContextMenu={(event) => event.preventDefault()}
                    >
                        <div className="border-b border-slate-700/80 px-3 py-2">
                            <div className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Aircraft</div>
                            <div className="truncate text-sm font-black text-white">{flightLineAircraftContextMenu.tailNumber}</div>
                        </div>
                        <div className="space-y-3 px-3 py-3">
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Status</span>
                                <select
                                    className={`w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-xs font-black outline-none focus:border-cyan-400 ${
                                        flightLineAircraftContextMenu.isUnavailable ? 'text-rose-300' : 'text-emerald-300'
                                    }`}
                                    value={flightLineAircraftContextMenu.isUnavailable ? 'unavailable' : 'serviceable'}
                                    onChange={(event) => {
                                        if (event.target.value === 'unavailable') {
                                            moveFlightLineAircraftToUnavailable(flightLineAircraftContextMenu.aircraftNumber);
                                        } else {
                                            moveFlightLineAircraftToAvailable(flightLineAircraftContextMenu.aircraftNumber);
                                        }
                                        closeFlightLineAircraftContextMenu();
                                    }}
                                    onKeyDown={stopEditableKeyPropagation}
                                >
                                    <option className="text-emerald-700" value="serviceable">Aircraft Serviceable</option>
                                    <option className="text-rose-700" value="unavailable">Unavailable</option>
                                </select>
                            </label>
                            {flightLineAircraftContextMenu.isUnavailable ? (
                                <label className="block">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Reason</span>
                                    <select
                                        className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400"
                                        value={getFlightLineUnavailableReason(flightLineAircraftContextMenu.aircraftNumber)}
                                        onChange={(event) => {
                                            setFlightLineAircraftUnavailableReason(flightLineAircraftContextMenu.aircraftNumber, event.target.value);
                                            closeFlightLineAircraftContextMenu();
                                        }}
                                        onKeyDown={stopEditableKeyPropagation}
                                    >
                                        <option value="">Reason not allocated</option>
                                        {flightLinePoolContext.unavailableReasonOptions.map((reason) => (
                                            <option key={`flight-line-unavailable-reason-${reason}`} value={reason}>{reason}</option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                        </div>
                    </div>
                );
            })() : null}
            <div 
                style={{
                    width: `${AIRFRAME_COLUMN_WIDTH + (TOTAL_HOURS * PIXELS_PER_HOUR * zoomLevel)}px`,
                    height: `${TIME_HEADER_HEIGHT + (resources.length * ROW_HEIGHT)}px`,
                    display: 'grid',
                    gridTemplateColumns: `${AIRFRAME_COLUMN_WIDTH}px 1fr`,
                    gridTemplateRows: `${TIME_HEADER_HEIGHT}px 1fr`,
                }}
            >
                {/* Date Control (Top Left) */}
                <div data-schedule-corner="true" className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1 neo-build-header-cell">
                    <div className="flex items-center gap-1 h-full">
                        <div
                            data-schedule-date-selector="true"
                            className={`relative bg-gray-700 rounded-md flex items-center justify-center px-3 gap-2 cursor-pointer ${isNeoBuild ? 'neo-build-date-indicator' : ''}`}
                            style={{height: "100%", width: "100%"}}
                            onClick={() => setShowDatePicker(prev => !prev)}
                            title="Open date picker"
                        >
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDateChange(-1);
                                }}
                                data-schedule-date-arrow="true"
                                className="p-0.5"
                            >
                                ←
                            </button>
                            <span data-schedule-date-text="true" className="text-xs font-bold tracking-wider whitespace-nowrap">{formattedDisplayDate}</span>
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDateChange(1);
                                }}
                                data-schedule-date-arrow="true"
                                className="p-0.5"
                            >
                                →
                            </button>
                            {showDatePicker && (
                                <div
                                    className="absolute top-full left-0 mt-2 w-64 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-2xl"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                                        Select DFP Date
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(event) => {
                                            const selectedDate = event.target.value;
                                            if (!selectedDate) return;
                                            if (onDateSelect) {
                                                onDateSelect(selectedDate);
                                            } else {
                                                const current = new Date(`${date}T00:00:00Z`).getTime();
                                                const selected = new Date(`${selectedDate}T00:00:00Z`).getTime();
                                                const diff = Math.round((selected - current) / 86400000);
                                                if (diff !== 0) onDateChange(diff);
                                            }
                                            setShowDatePicker(false);
                                        }}
                                        className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                    {snapshotDates.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                                Saved Records
                                            </p>
                                            <div className="max-h-36 overflow-y-auto space-y-1">
                                                {snapshotDates.slice(0, 60).map(snapshotDate => (
                                                    <button
                                                        key={snapshotDate}
                                                        type="button"
                                                        onClick={() => {
                                                            if (onDateSelect) {
                                                                onDateSelect(snapshotDate);
                                                            }
                                                            setShowDatePicker(false);
                                                        }}
                                                        className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                                                            snapshotDate === date
                                                                ? 'bg-sky-600 text-white'
                                                                : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        {formatSnapshotDate(snapshotDate)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {isNeoBuild && (
                            <div className="neo-build-label">NEO Build</div>
                        )}
                    </div>
                </div>

                {/* Time Header (Top Row) */}
                <div data-schedule-time-header="true" className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700 relative">
                    {isReadOnly && (
                        <div className="absolute left-2 top-1 z-30 flex items-center gap-2 rounded border border-amber-400/30 bg-gray-900/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200 shadow">
                            <span>Read-only archive</span>
                            {onOpenCurrentDfp && (
                                <button
                                    type="button"
                                    onClick={onOpenCurrentDfp}
                                    className="normal-case tracking-normal text-sky-300/80 underline-offset-2 hover:text-sky-200 hover:underline"
                                >
                                    Open current DFP
                                </button>
                            )}
                        </div>
                    )}
                    {renderTimeHeaders()}
                </div>

                {/* Resource Column (Left Col) */}
                <div data-schedule-resource-column="true" className="sticky left-0 z-[70] bg-gray-800 border-r border-gray-700" style={{width: `${RESOURCE_COLUMN_WIDTH}px`, overflow: "hidden"}}>
                    <AirframeColumn
                        resources={resources}
                        onReorder={onReorderResources}
                        rowHeight={ROW_HEIGHT}
                        airframeCount={airframeCount}
                        standbyCount={standbyCount}
                        ftdCount={ftdCount}
                        cptCount={cptCount}
                        events={events}
                        formatResourceLabel={formatResourceLabel}
                        aircraftConfigLabelsByResource={aircraftConfigLabelsByResource}
                    />
                </div>

                {/* Main Grid */}
                <div 
                    ref={scheduleGridRef}
                    data-schedule-grid="true"
                    data-schedule-start-hour={START_HOUR}
                    data-schedule-pixels-per-hour={PIXELS_PER_HOUR * zoomLevel}
                    className="relative bg-gray-900"
                    onMouseDown={(e) => handleMouseDown(e)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDragOver={handleExternalDragOver}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setFlightLineScheduleDropPreview(null);
                        }
                    }}
                    onDrop={handleExternalDrop}
                >
                    {renderGridLines()}
                    {renderNightShade()}
                    {renderExclusionPeriods()}
                    {renderDaylightLines()}
                    {renderCategorySeparators()}
                    {renderCurrentTimeIndicator()}
                    {renderValidateOverlay()}
                    
                    {/* Aircraft Availability Overlay — independent from Build Factors */}
                    {showAircraftAvailability && dayFlyingStart && dayFlyingEnd && onAvailabilityChange && date && (
                        <AircraftAvailabilityOverlay
                            currentDate={new Date(date)}
                            dateString={date}
                            totalAircraft={airframeCount}
                            initialAvailability={initialAvailability ?? 15}
                            apiBase={apiBase}
                            locationCode={locationCode}
                            unitCode={unitCode}
                            dayFlyingStart={dayFlyingStart}
                            dayFlyingEnd={dayFlyingEnd}
                            gridHeight={resources.length * ROW_HEIGHT}
                            rowHeight={ROW_HEIGHT}
                            pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                            startHour={START_HOUR}
                            onAvailabilityChange={onAvailabilityChange}
                            onUserChange={isReadOnly ? undefined : onUserAvailabilityChange}
                            showLiveAvailabilityLine={showLiveAvailabilityLine}
                            isReadOnly={isReadOnly}
                            linkedAvailabilityCount={flightLinePoolContext.linkAircraftAvailability ? flightLineLinkedAvailabilityCount : null}
                            isLinkedAvailability={flightLinePoolContext.linkAircraftAvailability}
                        />
                    )}
                    
                    {renderEvents()}
                    {renderFlightLineAircraftMarkers()}
                    
                    {/* Visual Adjust Guide */}
                    {isVisualAdjustMode && visualAdjustEvent && onVisualAdjustTimeChange && (
                        <VisualAdjustGuide
                            event={visualAdjustEvent}
                            onTimeChange={onVisualAdjustTimeChange}
                            scheduleStartHour={START_HOUR}
                            scheduleEndHour={END_HOUR}
                            pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                        />
                    )}
                    
                    {isOracleMode && oraclePreviewEvent && (
                        <>
                            <FlightTile
                                isPreview
                                event={oraclePreviewEvent}
                                onSelectEvent={() => {}}
                                onMouseDown={() => {}}
                                onMouseEnter={() => {}}
                                onMouseLeave={() => {}}
                                pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                                rowHeight={ROW_HEIGHT}
                                startHour={START_HOUR}
                                row={resources.indexOf(oraclePreviewEvent.resourceId)}
                                isDragging={false}
                                traineesData={traineesData}
                                instructorsData={instructorsData}
                                personnelData={personnelData}
                                seatConfigs={new Map()}
                                currentTime={currentTime}
                                aircraftNumberSettings={aircraftNumberSettings}
                                instructorLabel={schedulePersonnelDisplaySettings.instructorLabel || 'Instructor'}
                            />
                            <div
                                className="absolute top-1/2 -translate-y-1/2 h-1 bg-sky-300/40 pointer-events-none z-50"
                                style={{
                                    left: `${(oraclePreviewEvent.startTime - (oraclePreviewEvent.preStart || 1.0) - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px`,
                                    width: `${(oraclePreviewEvent.preStart || 1.0) * PIXELS_PER_HOUR * zoomLevel}px`,
                                    top: `${(resources.indexOf(oraclePreviewEvent.resourceId) * ROW_HEIGHT) + (ROW_HEIGHT/2)}px`
                                }}
                            />
                             <div
                                className="absolute top-1/2 -translate-y-1/2 h-1 bg-sky-300/40 pointer-events-none z-50"
                                style={{
                                    left: `${(oraclePreviewEvent.startTime + oraclePreviewEvent.duration - START_HOUR) * PIXELS_PER_HOUR * zoomLevel}px`,
                                    width: `${(oraclePreviewEvent.postEnd || 0.5) * PIXELS_PER_HOUR * zoomLevel}px`,
                                    top: `${(resources.indexOf(oraclePreviewEvent.resourceId) * ROW_HEIGHT) + (ROW_HEIGHT/2)}px`
                                }}
                            />
                        </>
                    )}

                    {/* Selection Rect */}
                    {selectionRect && (
                        <div
                            className="absolute bg-sky-500/20 border border-sky-400 z-50 pointer-events-none"
                            style={{
                                left: selectionRect.x,
                                top: selectionRect.y,
                                width: selectionRect.width,
                                height: selectionRect.height,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduleView;
