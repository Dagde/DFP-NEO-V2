

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Conflict, Trainee, FlyingWindowExclusionPeriod, FormationCallsign, EventLimits } from '../types';
import FlightTile from './FlightTile';
import AirframeColumn from './AirframeColumn';
import AircraftAvailabilityOverlay from './AircraftAvailabilityOverlay';
import { DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { VisualAdjustGuide } from './VisualAdjustGuide';
import { AircraftNumberSettings, normaliseAircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { DEFAULT_PLATFORM_PERMISSION_PROFILES, getOperationalModelLabel, getUnitOperationalModel, normaliseOperationalModel, OPERATIONAL_MODEL_OPTIONS } from '../utils/platformConfigService';
import { getTaskProfilesForModel } from '../utils/taskProfiles';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { AIRCRAFT_CREW_RESOURCE_KINDS, normaliseAircraftCrewComposition } from '../utils/aircraftCrewComposition';
import { normaliseCrewCompositionSettings } from '../utils/crewCompositionProfiles';
import { getCrewPositionLabelMap, normaliseCrewPositionTerminology } from '../utils/crewPositionTerminology';
import { normalisePersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { normaliseStaffQualificationCatalogue } from '../utils/staffQualifications';
import { normaliseTrainingReportTemplate, normaliseTrainingReportTerminology } from '../utils/trainingReportTerminology';
import { normaliseUnitCallsignSettings } from '../utils/unitCallsigns';
import { getEffectiveDispatchStaggerMinutes, type DispatchStaggerSettings } from '../utils/dispatchStagger';
import { DEFAULT_AIRFIELD_SOLAR_PROFILES } from '../utils/sunTimes';
import {
    isSetupTestMode as isSetupTestBrowserMode,
    readSetupTestPlatformConfig,
    readSetupTestSyllabus,
    writeSetupTestPlatformConfig,
    writeSetupTestSyllabus,
} from '../utils/setupTestMode';
   
declare const XLSX: any;


interface ScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  onDateSelect?: (date: string) => void;
  snapshotDates?: string[];
  events: ScheduleEvent[];
  resources: string[];
  instructors: string[];
  traineesData: Trainee[];
  timezoneOffset?: number;
  airframeCount: number;
  standbyCount: number;
  ftdCount: number;
  cptCount: number;
  onUpdateEvent: (updates: { eventId: string, newStartTime?: number, newResourceId?: string }[]) => void;
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
  onUserAvailabilityChange?: (count: number) => void; // called ONLY when user drags the line
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
  onExternalEventDrop?: (event: ScheduleEvent, placement: { startTime: number; resourceId: string }) => void;
  diagnosticHighlightedEventIds?: Set<string>;
  platformConfig?: any;
  onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
  onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
  isSetupTestMode?: boolean;
  onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
  isNeoAssistPanelOpen?: boolean;
  isFlightLinePanelOpen?: boolean;
  onOrganisationSlideoutOpen?: () => void;
  onToggleFlightLinePanel?: () => void;
  onInitialSetupWizardActiveChange?: (active: boolean) => void;
  formationCallsigns?: FormationCallsign[];
  buildRuleSettings?: {
    maxDispatchPerHour?: number;
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
const RESOURCE_COLUMN_WIDTH = 105; // 95 * 1.1 = 105px (further 10% wider) // 86 * 1.1 = 95px (10% wider) // 108 * 0.80 = 86px (PC-21 column, 20% narrower than header)
const TIME_HEADER_HEIGHT = 40;

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

const getResourceCategory = (res?: string) => {
    if (!res) return 'Other';
    if (res.startsWith('PC-21') || res.startsWith('Deployed')) return 'PC-21';
    if (res.startsWith('STBY')) return 'STBY';
    if (res === 'Duty Sup') return 'Duty Sup';
    if (res === 'TWR DI') return 'TWR DI';
    if (res.startsWith('FTD')) return 'FTD';
    if (res.startsWith('CPT')) return 'CPT';
    if (res.startsWith('Ground')) return 'Ground';
    return 'Other';
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

const ORGANISATION_LABEL_ALIASES: Record<string, string> = {
    'air movements group': 'Air Mobility Group',
};

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
    const levelNames = levels.map((level: any, index: number) => normaliseOrgChartValue(level?.name) || `Level ${index}`);
    const rootLabel = getOrganisationStructureRootLabel(activeOrganisation, levels);
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
        const displayPath = startsAtRoot ? canonicalPath.slice(1) : canonicalPath;
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
            const displayPath = parentPath[0]?.toLowerCase() === rootKey ? parentPath.slice(1) : parentPath;
            addOrganisationChartPath(root, displayPath, levelNames, unitCode);
        });
    if (root.children.length === 0) {
        levels.slice(1).forEach((level: any) => {
            (Array.isArray(level?.options) ? level.options : [])
                .map(normaliseOrgChartValue)
                .filter(Boolean)
                .forEach((option: string) => addOrganisationChartPath(root, [option], levelNames));
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

const organisationSlideoutActiveButtonClass = 'btn-aluminium-brushed inline-flex h-9 w-40 items-center justify-center rounded-md px-3 text-center text-[11px] font-semibold text-[#143142]';
const organisationSlideoutInactiveButtonClass = 'btn-aluminium-brushed inline-flex h-9 w-40 items-center justify-center rounded-md px-3 text-center text-[11px] font-semibold text-[#143142]';
const unitSettingsPanelClass = 'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-[0_18px_44px_rgba(0,0,0,0.22)] backdrop-blur';
const unitSettingsLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400';
const unitSettingsInputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60';
const unitSettingsSelectClass = `${unitSettingsInputClass} cursor-pointer`;
const unitSettingsRowClass = 'grid gap-2 border-t border-white/10 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(150px,0.65fr)_minmax(0,1fr)] md:items-center';
const unitSettingsMutedPillClass = 'rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[11px] font-semibold text-slate-300';
const unitSettingsScrollClass = 'max-w-full overflow-x-auto';
const deploymentModeOptions = ['Online SaaS', 'Private Defence Network', 'Fully Offline', 'Hybrid Offline Sync'];
const licenceValidationOptions = ['Online licence check', 'Private network licence server', 'Offline signed licence file', 'Hybrid cached licence'];
const licenceEnforcementOptions = ['Monitor Only', 'Warn Only', 'Block Expired Licence'];
const authModelOptions = ['Local accounts', 'Defence SSO', 'Hybrid local and SSO'];
const releaseChannelOptions = ['Production', 'Staging', 'Customer Acceptance', 'Offline Package'];
const backupFrequencyOptions = ['Hourly', 'Daily', 'Weekly', 'Manual'];
const accreditationStatusOptions = ['Not started', 'In preparation', 'Submitted', 'Approved', 'Renewal due'];
const initialSetupWizardStorageKey = 'dfp-initial-setup-wizard-step';
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
            ['0', 'RAAF', '', 'Top level organisation'],
            ['1', 'Air Command', 'RAAF', 'Branch or command'],
            ['2', 'Air Mobility Group', 'Air Command', 'Command group'],
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
            ['YAMB', 'Amberley', 'Australia/Brisbane', 'Area A; Area B', 'Home base'],
            ['YMES', 'East Sale', 'Australia/Melbourne', 'Area 1; Area 2', 'Training base'],
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
            ['36SQN', '36SQN', 'YAMB', 'Airlift', 'Pooled Crew Model', 'Air Command / Air Mobility Group / 84WG', 'No', ''],
            ['1FTS', '1FTS', 'YMES', 'Training', 'Flight School Model', 'Air Command / Air Force Training Group / AirA', 'Yes', ''],
        ],
        settingsSection: 'platform-units',
    },
    {
        id: 'resources',
        label: 'Aircraft and resource pools',
        fileName: 'DFP_NEO_Resource_Pools_Template.csv',
        requiredHeaders: ['Pool Name', 'Aircraft Type', 'Unit', 'Location', 'Aircraft', 'Sim', 'Trainer', 'Standby', 'Ground'],
        optionalHeaders: ['Notes'],
        exampleRows: [
            ['Amberley C-17A Resource Pool', 'C-17A', '36SQN', 'YAMB', '4', '0', '0', '1', '0', ''],
        ],
        settingsSection: 'platform-resource-pools',
    },
    {
        id: 'staff',
        label: 'Staff',
        fileName: 'DFP_NEO_Staff_Template.csv',
        requiredHeaders: ['Name', 'Unit', 'Role'],
        optionalHeaders: ['Rank', 'PMKeyS', 'Qualifications', 'Email'],
        exampleRows: [
            ['Smith, Alex', '36SQN', 'Pilot', 'SQNLDR', '1234567', 'PIC; CFI', 'alex.smith@example.com'],
        ],
        settingsSection: 'staff-database',
    },
    {
        id: 'trainees',
        label: 'Trainees',
        fileName: 'DFP_NEO_Trainees_Template.csv',
        requiredHeaders: ['Name', 'Unit'],
        optionalHeaders: ['Rank', 'PMKeyS', 'Course Number', 'Course', 'Start Date', 'Master LMP'],
        exampleRows: [
            ['Jones, Taylor', '1FTS', 'PLTOFF', '7654321', '1', '', '2026-01-15', 'BPC+IPC'],
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
            ['C-17A Conversion', 'C17-001', 'Conversion sortie 1', 'Flight', '90', 'C-17A', 'Pilot 2, Loadmaster 1', '90', '60'],
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
    pmkeys: ['pmkeysid', 'pmkey', 'employeeid', 'serviceid'],
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

const downloadWizardTemplate = (template: InitialSetupWizardTemplate) => {
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
    const headers = (rows[0] || []).map((cell) => String(cell || '').trim()).filter(Boolean);
    const headerKeys = new Set(headers.map(normaliseWizardHeader));
    const missingHeaders = template.requiredHeaders.filter((header) => !wizardHeaderMatchesRequired(headerKeys, header));
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || '').trim()));
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
        `Business rules: ${draft.businessRules || 'Use default'}`,
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

const parseWizardStaffRows = (value: string): Array<{ surname: string; givenNames: string; unit: string; position: string; qualifications: string }> => (
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
            position: parts[2] || '',
            qualifications: parts[3] || '',
        };
    }).filter((row) => row.surname || row.givenNames || row.unit || row.position || row.qualifications)
);

const formatWizardStaffRows = (rows: Array<{ surname?: string; givenNames?: string; unit?: string; position?: string; qualifications?: string }>): string => (
    rows
        .filter((row) => row.surname || row.givenNames || row.unit || row.position || row.qualifications)
        .map((row) => {
            const surname = String(row.surname || '');
            const givenNames = String(row.givenNames || '');
            const name = surname && givenNames ? `${surname}, ${givenNames}` : surname || givenNames;
            return [name, String(row.unit || ''), String(row.position || ''), String(row.qualifications || '')].join('|');
        })
        .join('\n')
);

const parseWizardTraineeRows = (value: string): Array<{ surname: string; givenNames: string; unit: string; rank: string; pmkeys: string; courseNumber: string; course: string; masterLmp: string; startDate: string }> => (
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
            pmkeys: parts[3] || '',
            courseNumber: parts[4] || '',
            course: parts[5] || '',
            masterLmp: parts[6] || '',
            startDate: parts[7] || '',
        };
    }).filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate)
);

const formatWizardTraineeRows = (rows: Array<{ surname?: string; givenNames?: string; unit?: string; rank?: string; pmkeys?: string; courseNumber?: string; course?: string; masterLmp?: string; startDate?: string }>): string => (
    rows
        .filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate)
        .map((row) => {
            const surname = String(row.surname || '');
            const givenNames = String(row.givenNames || '');
            const name = surname && givenNames ? `${surname}, ${givenNames}` : surname || givenNames;
            return [
                name,
                String(row.unit || ''),
                String(row.rank || ''),
                String(row.pmkeys || ''),
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
    demoGrade: string;
    passLabel: string;
    failLabel: string;
}>(value, ['genericName', 'organisationName', 'gradeMin', 'gradeMax', 'showNumbers', 'demoGrade', 'passLabel', 'failLabel']);

const formatWizardTrainingReportRows = (rows: ReturnType<typeof parseWizardTrainingReportRows>) => (
    formatWizardPipeRows(rows, ['genericName', 'organisationName', 'gradeMin', 'gradeMax', 'showNumbers', 'demoGrade', 'passLabel', 'failLabel'])
);

const parseWizardRankRows = (value: string) => parseWizardPipeRows<{ order: string; ranks: string; notes: string }>(value, ['order', 'ranks', 'notes']);
const formatWizardRankRows = (rows: ReturnType<typeof parseWizardRankRows>) => formatWizardPipeRows(rows, ['order', 'ranks', 'notes']);

const parseWizardSharingRows = (value: string) => parseWizardPipeRows<{ type: string; enabled: string; units: string; consequence: string }>(value, ['type', 'enabled', 'units', 'consequence']);
const formatWizardSharingRows = (rows: ReturnType<typeof parseWizardSharingRows>) => formatWizardPipeRows(rows, ['type', 'enabled', 'units', 'consequence']);

const parseWizardCurrencyRows = (value: string) => parseWizardPipeRows<{ name: string; code: string; crew: string; config: string; currency: string; aircraftCount: string }>(value, ['name', 'code', 'crew', 'config', 'currency', 'aircraftCount']);
const formatWizardCurrencyRows = (rows: ReturnType<typeof parseWizardCurrencyRows>) => formatWizardPipeRows(rows, ['name', 'code', 'crew', 'config', 'currency', 'aircraftCount']);

const parseWizardScoringRows = (value: string) => parseWizardPipeRows<{ dimension: string; passStandard: string; failStandard: string; grade0: string; grade1: string; grade2: string; grade3: string; grade4: string; grade5: string }>(value, ['dimension', 'passStandard', 'failStandard', 'grade0', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5']);
const formatWizardScoringRows = (rows: ReturnType<typeof parseWizardScoringRows>) => formatWizardPipeRows(rows, ['dimension', 'passStandard', 'failStandard', 'grade0', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5']);

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
    timezone: String(location?.timezone || 'Australia/Brisbane').trim(),
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

const UnitSettingsField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled = false }) => (
    disabled ? (
        <UnitSettingsReadRow label={label} value={value || 'Not set'} muted={!value} />
    ) : <label className={unitSettingsRowClass}>
        <span className={unitSettingsLabelClass}>{label}</span>
        <input
            className={unitSettingsInputClass}
            value={value || ''}
            disabled={disabled}
            onKeyDownCapture={stopEditableKeyPropagation}
            onKeyDown={stopEditableKeyPropagation}
            onChange={(event) => onChange(event.target.value)}
        />
    </label>
);

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

const UnitSettingsResourceNumberField: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled = false }) => (
    disabled ? (
        <div className="flex aspect-square min-w-[74px] flex-col items-center justify-center rounded-md border border-white/10 bg-slate-950/45 px-2 text-center">
            <span className="block max-w-full truncate text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</span>
            <span className="mt-2 block text-center text-lg font-semibold leading-none text-slate-100">{Number.isFinite(Number(value)) ? value : 0}</span>
        </div>
    ) : <label className="flex aspect-square min-w-[74px] flex-col items-center justify-center rounded-md border border-white/10 bg-slate-950/45 px-2 text-center">
        <span className="block max-w-full truncate text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</span>
        <input
            type="number"
            min={0}
            className="mt-2 h-8 w-full rounded-lg border border-white/10 bg-slate-950/80 px-1 text-center text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
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
}> = ({ label, value, onChange, disabled = false, placeholder = '' }) => (
    disabled ? (
        <UnitSettingsReadRow label={label} value={<span className="whitespace-pre-wrap">{value || 'Not set'}</span>} muted={!value} />
    ) : <label className={`${unitSettingsRowClass} md:items-start`}>
        <span className={`${unitSettingsLabelClass} md:pt-2`}>{label}</span>
        <textarea
            className={`${unitSettingsInputClass} min-h-[118px] resize-y leading-5`}
            value={value || ''}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDownCapture={stopEditableKeyPropagation}
            onKeyDown={stopEditableKeyPropagation}
            onChange={(event) => onChange(event.target.value)}
        />
    </label>
);

const OrganisationMyUnitSettings: React.FC<{
    platformConfig?: any;
    unitCode?: string;
    formationCallsigns?: FormationCallsign[];
    buildRuleSettings?: ScheduleViewProps['buildRuleSettings'];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
}> = ({ platformConfig, unitCode, formationCallsigns = [], buildRuleSettings, onUpdatePlatformConfig, onNavigateToSettingsSection }) => {
    const [activeCategory, setActiveCategory] = useState('identity');
    const activeUnitCode = normaliseUnitSettingsIdentifier(unitCode);
    const units = platformConfig?.units || [];
    const unit = units.find((candidate: any) => normaliseUnitSettingsIdentifier(candidate?.code) === activeUnitCode)
        || units.find((candidate: any) => String(candidate?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        || units[0];
    const unitIndex = unit ? units.findIndex((candidate: any) => candidate === unit) : -1;
    const canEdit = false;
    const unitHasTrainees = unit?.settings?.hasTrainees !== false;
    const locations = platformConfig?.locations || [];
    const modules = platformConfig?.modules || [];
    const resourcePools = unit ? getRelevantResourcePoolsForUnit(platformConfig, unit) : [];
    const primaryResourcePool = resourcePools[0] || null;
    const primaryResourcePoolFocusKey = primaryResourcePool
        ? String(primaryResourcePool.id || primaryResourcePool.code || primaryResourcePool.name || '').trim()
        : '';
    const unitModules = platformConfig?.unitModules || [];
    const schedulingRuleSets = (platformConfig?.schedulingRuleSets || []).filter((ruleSet: any) => (
        String(ruleSet?.isActive ?? true) !== 'false'
        && (!ruleSet?.unitCode || normaliseUnitSettingsIdentifier(ruleSet.unitCode) === normaliseUnitSettingsIdentifier(unit?.code))
    ));
    const location = locations.find((candidate: any) => normaliseUnitSettingsIdentifier(candidate?.code) === normaliseUnitSettingsIdentifier(unit?.locationCode));
    const parentPath = getResolvedUnitParentOrganisationPath(platformConfig, unit);
    const operationalModel = getUnitOperationalModel(unit);
    const modelOptionLabels = Object.fromEntries(OPERATIONAL_MODEL_OPTIONS.map((option) => [option.value, option.label]));
    const taskAbbreviations = unit?.settings?.taskProfileAbbreviations || {};
    const taskProfilesForUnit = getTaskProfilesForModel(platformConfig, operationalModel);
    const taskTileLabelProfiles = Array.from(new Set([
        ...taskProfilesForUnit,
        ...Object.keys(taskAbbreviations || {}),
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
        ? resourceSharingGroups.filter((group: any) => (group?.selectedUnits || []).map(normaliseUnitSettingsIdentifier).includes(normaliseUnitSettingsIdentifier(unit?.code)))
        : [];
    const staffSharingForUnit = organisationSettings.staffSharingEnabled
        ? staffSharingGroups.filter((group: any) => (group?.selectedUnits || []).map(normaliseUnitSettingsIdentifier).includes(normaliseUnitSettingsIdentifier(unit?.code)))
        : [];
    const deploymentProfile = organisationSettings.deploymentProfile || {};
    const operationalRunbook = organisationSettings.operationalRunbook || {};
    const crewPositionTerminology = normaliseCrewPositionTerminology(organisationSettings.crewPositionTerminology || null);
    const crewPositionLabelMap = getCrewPositionLabelMap(crewPositionTerminology);
    const crewCompositionSettings = normaliseCrewCompositionSettings(organisationSettings.crewCompositionSettings || null);
    const personnelDisplaySettings = normalisePersonnelDisplaySettings(organisationSettings.personnelDisplaySettings || organisationSettings.personnelSettings || null);
    const permissionProfiles = Array.isArray(organisationSettings.permissionProfiles) && organisationSettings.permissionProfiles.length > 0
        ? organisationSettings.permissionProfiles
        : DEFAULT_PLATFORM_PERMISSION_PROFILES;
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
        && (!profile.unitCode || normaliseUnitSettingsIdentifier(profile.unitCode) === normaliseUnitSettingsIdentifier(unit?.code))
        && (!profile.aircraftTypeCode || aircraftTypeCodes.length === 0 || aircraftTypeCodes.includes(profile.aircraftTypeCode))
        && profile.operationalModels.includes(operationalModel)
    ));
    const currencyProfiles = crewCompositionSettings.currencyProfiles.filter((profile) => (
        String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && (!profile.unitCode || normaliseUnitSettingsIdentifier(profile.unitCode) === normaliseUnitSettingsIdentifier(unit?.code))
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
        && (!profile?.unitCode || normaliseUnitSettingsIdentifier(profile.unitCode) === normaliseUnitSettingsIdentifier(unit?.code))
    ));
    const masterLmpAccessRules = Array.isArray(organisationSettings.masterLmpAccess) ? organisationSettings.masterLmpAccess : [];
    const masterLmpAccessForUnit = masterLmpAccessRules.filter((rule: any) => (
        !rule?.unitCode || normaliseUnitSettingsIdentifier(rule.unitCode) === normaliseUnitSettingsIdentifier(unit?.code)
    ));
    const unitHomeLocationCode = normaliseUnitSettingsIdentifier(unit?.locationCode);
    const userAccessForUnit = (platformConfig?.userAccess || []).filter((access: any) => {
        const accessUnitCode = normaliseUnitSettingsIdentifier(access?.unitCode);
        const accessLocationCode = normaliseUnitSettingsIdentifier(access?.locationCode);
        if (accessUnitCode) return accessUnitCode === normaliseUnitSettingsIdentifier(unit?.code);
        return !accessLocationCode || accessLocationCode === unitHomeLocationCode;
    });
    const getAccessUserLabel = (access: any) => {
        const userId = String(access?.userId || '').trim();
        const user = platformUsers.find((candidate: any) => (
            [candidate?.userId, candidate?.username, candidate?.id]
                .map((value) => String(value || '').trim())
                .includes(userId)
        ));
        const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
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
        normaliseUnitSettingsIdentifier(entry.unitCode) === normaliseUnitSettingsIdentifier(unit?.code)
    ));
    const unitFormationCallsigns = formationCallsigns.filter((callsign) => (
        normaliseUnitSettingsIdentifier(callsign.unit) === normaliseUnitSettingsIdentifier(unit?.code)
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
    const unitFocusAnchor = settingsAnchorSuffix(unit?.code);
    const settingsLink = (
        sectionId: string,
        label = 'Take me there',
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
    const updateResourcePool = (pool: any, patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((candidate: any) => (
                candidate === pool || String(candidate?.id || candidate?.code || '') === String(pool?.id || pool?.code || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        }));
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
    const updateResourcePoolSettings = (pool: any, patch: Record<string, number>) => {
        if (!onUpdatePlatformConfig) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((candidate: any) => (
                candidate === pool || String(candidate?.id || candidate?.code || '') === String(pool?.id || pool?.code || '')
                    ? {
                        ...candidate,
                        settings: {
                            ...(candidate.settings || {}),
                            ...patch,
                        },
                    }
                    : candidate
            )),
        }));
    };
    const updateAircraftType = (aircraft: any, patch: Record<string, any>) => {
        if (!onUpdatePlatformConfig) return;
        onUpdatePlatformConfig((current) => ({
            ...current,
            aircraftTypes: (current?.aircraftTypes || []).map((candidate: any) => (
                candidate === aircraft || String(candidate?.id || candidate?.code || '') === String(aircraft?.id || aircraft?.code || '')
                    ? { ...candidate, ...patch }
                    : candidate
            )),
        }));
    };
    const updateAircraftCrewComposition = (aircraft: any, patch: Record<string, any>) => {
        const composition = normaliseAircraftCrewComposition(aircraft.crewComposition);
        updateAircraftType(aircraft, {
            crewComposition: {
                ...composition,
                ...patch,
            },
        });
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
                        title="Aircraft & Resource Pools"
                        description="Live counts for pools assigned to this unit or its home location."
                        action={<div className="flex flex-wrap justify-end gap-2"><span className={unitSettingsMutedPillClass}>{resourcePools.length} pools</span>{settingsLink('platform-resource-pools', 'Take me there', { resourcePoolCode: primaryResourcePoolFocusKey })}</div>}
                    >
                        {resourcePools.length > 0 ? resourcePools.map((pool: any) => {
                            const settings = pool.settings || {};
                            return (
                                <div key={pool.id || pool.code} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsField label="Pool name" value={pool.name || pool.code || ''} onChange={(value) => updateResourcePool(pool, { name: value })} disabled={!canEdit} />
                                    <UnitSettingsField label="Aircraft type" value={pool.aircraftTypeCode || ''} onChange={(value) => updateResourcePool(pool, { aircraftTypeCode: value })} disabled={!canEdit} />
                                    <UnitSettingsSelect label="Pool type" value={pool.poolType || 'Dedicated'} options={['Dedicated', 'Shared', 'Combined']} onChange={(value) => updateResourcePool(pool, { poolType: value })} disabled={!canEdit} />
                                    <UnitSettingsSelect label="Location" value={pool.locationCode || unit.locationCode || ''} options={locations.map((item: any) => item.code)} onChange={(value) => updateResourcePool(pool, { locationCode: value })} disabled={!canEdit} />
                                    <div className={`${unitSettingsScrollClass} border-t border-white/10 bg-slate-950/25`}>
                                        <div className="min-w-[390px]">
                                            <div className="grid grid-cols-5 gap-2 p-2">
                                                <UnitSettingsResourceNumberField label="Aircraft" value={settings.aircraft ?? 0} onChange={(value) => updateResourcePoolSettings(pool, { aircraft: value })} disabled={!canEdit} />
                                                <UnitSettingsResourceNumberField label="Sim" value={settings.ftd ?? 0} onChange={(value) => updateResourcePoolSettings(pool, { ftd: value })} disabled={!canEdit} />
                                                <UnitSettingsResourceNumberField label="Trainer" value={settings.cpt ?? 0} onChange={(value) => updateResourcePoolSettings(pool, { cpt: value })} disabled={!canEdit} />
                                                <UnitSettingsResourceNumberField label="Standby" value={settings.standby ?? 0} onChange={(value) => updateResourcePoolSettings(pool, { standby: value })} disabled={!canEdit} />
                                                <UnitSettingsResourceNumberField label="Ground" value={settings.ground ?? 0} onChange={(value) => updateResourcePoolSettings(pool, { ground: value })} disabled={!canEdit} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="Pools" value="No resource pools are assigned to this unit or location." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Aircraft Numbering & Configurations" description="Aircraft type and numbering rules inherited from this unit's resource pools." action={settingsLink('platform-resource-pools', 'Take me there', { focusSubsectionId: 'platform-aircraft-type-settings' })}>
                        {aircraftTypesForUnit.length > 0 ? aircraftTypesForUnit.map((aircraft: any) => {
                            const composition = normaliseAircraftCrewComposition(aircraft.crewComposition);
                            const configurations = Array.isArray(aircraft.settings?.aircraftConfigurations) ? aircraft.settings.aircraftConfigurations : [];
                            return (
                                <div key={aircraft.code} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsField label="Aircraft code" value={aircraft.code || ''} onChange={(value) => updateAircraftType(aircraft, { code: value })} disabled={!canEdit} />
                                    <UnitSettingsField label="Aircraft name" value={aircraft.name || aircraft.code || ''} onChange={(value) => updateAircraftType(aircraft, { name: value })} disabled={!canEdit} />
                                    <UnitSettingsNumberField label="Standard crew seats" value={composition.crewCount} onChange={(value) => updateAircraftCrewComposition(aircraft, { crewCount: value })} disabled={!canEdit} />
                                    <UnitSettingsField label="Configurations" value={configurations.length ? configurations.map((item: any) => item.label || item.name || item.id).join(', ') : 'Default / ANY'} onChange={(value) => updateAircraftType(aircraft, { settings: { ...(aircraft.settings || {}), aircraftConfigurations: value.split(',').map((label) => label.trim()).filter(Boolean).map((label) => ({ id: label, label })) } })} disabled={!canEdit} />
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="Aircraft" value="No aircraft types are linked to this unit yet." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Resource Sharing" description="Whether this unit shares aircraft or resource pools with another unit." action={settingsLink('organisation', 'Take me there')}>
                        {resourceSharingForUnit.length > 0 ? resourceSharingForUnit.map((group: any, index: number) => (
                            <div key={group.id || `${group.name}-${index}`} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Arrangement" value={group.name || 'Unnamed resource sharing arrangement'} onChange={() => {}} disabled />
                                <UnitSettingsField label="Units" value={(group.selectedUnits || []).join(', ')} onChange={() => {}} disabled />
                                <UnitSettingsField label="Allocation" value={group.allocationMode || organisationSettings.allocationMode || 'Combined pool'} onChange={() => {}} disabled />
                            </div>
                        )) : <UnitSettingsReadRow label="Resource sharing" value={organisationSettings.fleetSharingEnabled ? 'No resource sharing arrangement includes this unit.' : 'Resource sharing is not enabled for this unit.'} muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Staff Sharing" description="Whether this unit may use staff from another unit for scheduling and build eligibility." action={settingsLink('organisation', 'Take me there')}>
                        {staffSharingForUnit.length > 0 ? staffSharingForUnit.map((group: any, index: number) => (
                            <div key={group.id || `${group.name}-${index}`} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Arrangement" value={group.name || 'Unnamed staff sharing arrangement'} onChange={() => {}} disabled />
                                <UnitSettingsField label="Units" value={(group.selectedUnits || []).join(', ')} onChange={() => {}} disabled />
                            </div>
                        )) : <UnitSettingsReadRow label="Staff sharing" value={organisationSettings.staffSharingEnabled ? 'No staff sharing arrangement includes this unit.' : 'Staff sharing is not enabled for this unit.'} muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Build Rules" description="Current build rule values for this unit." action={<div className="flex flex-nowrap justify-end gap-2">{settingsLink('business-rules', 'Build Rules')}{settingsLink('duty-turnaround', 'Duty & Turnaround')}{settingsLink('event-limits', 'Event Limits')}</div>}>
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
                    <UnitSettingsGroup title="Standard Crew Composition" description="Minimum seats and role eligibility by aircraft and resource type." action={settingsLink('crew-composition', 'Take me there', { aircraftTypeCode: primaryAircraftTypeCode })}>
                        {aircraftTypesForUnit.length > 0 ? aircraftTypesForUnit.map((aircraft: any) => {
                            const composition = normaliseAircraftCrewComposition(aircraft.crewComposition);
                            return (
                                <div key={aircraft.code || aircraft.name} className="border-t border-white/10 first:border-t-0">
                                    <UnitSettingsNumberField label={`${aircraft.code || 'Aircraft'} standard seats`} value={composition.crewCount} onChange={(value) => updateAircraftCrewComposition(aircraft, { crewCount: value })} disabled={!canEdit} />
                                    {AIRCRAFT_CREW_RESOURCE_KINDS.map(({ kind, label }) => (
                                        <UnitSettingsNumberField
                                            key={`${aircraft.code}-${kind}`}
                                            label={label}
                                            value={composition.resourceSeatCounts?.[kind] ?? 0}
                                            onChange={(value) => updateAircraftCrewComposition(aircraft, { resourceSeatCounts: { ...(composition.resourceSeatCounts || {}), [kind]: value } })}
                                            disabled={!canEdit}
                                        />
                                    ))}
                                </div>
                            );
                        }) : <UnitSettingsReadRow label="Crew" value="No aircraft crew composition is linked to this unit yet." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Alternate Crew Profiles" description="Alternate tasking crews available to this unit and operational model." action={<div className="flex items-center gap-2"><span className={unitSettingsMutedPillClass}>{alternateCrewProfiles.length} profiles</span>{settingsLink('crew-composition', 'Take me there', { aircraftTypeCode: primaryAircraftTypeCode, focusSubsectionId: 'platform-alternate-crew-composition' })}</div>}>
                        {alternateCrewProfiles.length > 0 ? alternateCrewProfiles.map((profile) => (
                            <div key={profile.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Profile code" value={profile.code || ''} onChange={(value) => updateAlternateCrewProfile(profile, { code: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Profile name" value={profile.name || ''} onChange={(value) => updateAlternateCrewProfile(profile, { name: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Aircraft type" value={profile.aircraftTypeCode || ''} onChange={(value) => updateAlternateCrewProfile(profile, { aircraftTypeCode: value })} disabled={!canEdit} />
                                <UnitSettingsTextAreaRow label="Role requirements" value={formatRoleRequirementsText(profile.roleRequirements)} onChange={(value) => updateAlternateCrewProfile(profile, { roleRequirements: parseRoleRequirementsText(value) })} disabled={!canEdit} placeholder="Pilot = 2" />
                            </div>
                        )) : <UnitSettingsReadRow label="Alternate crews" value="No alternate crew profiles match this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Crew Labels & Qualifications" description="The local words users see for crew roles, plus model-specific qualifications such as PIC." action={settingsLink('platform-rank-terminology', 'Take me there', { focusSubsectionId: 'platform-staff-qualifications' })}>
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
                    <UnitSettingsGroup title="Task Tile Labels" description="Short display names for task tiles on this unit's schedule." action={<div className="flex items-center gap-2"><span className={unitSettingsMutedPillClass}>{Object.keys(taskAbbreviations || {}).length} configured</span>{settingsLink('platform-task-profiles', 'Take me there', { focusSubsectionId: `platform-task-tile-abbreviations-${unitFocusAnchor}` })}</div>}>
                        <div className="border-t border-white/10 px-4 py-3">
                            <p className="text-sm leading-6 text-slate-300">
                                Use this when a full task profile name is too long for the DFP tile. It only changes the short label shown on the schedule tile; it does not change the task profile, training requirement, or event data.
                            </p>
                            <p className="mt-2 text-xs leading-5 text-cyan-100/75">
                                Example: if the task profile is Close Air Support and the tile label is CAS, the schedule tile can show Task - CAS.
                            </p>
                        </div>
                        {taskTileLabelProfiles.length > 0 ? (
                            <div className="mx-4 mb-4 overflow-hidden rounded-md border border-cyan-200/20 bg-slate-950/20">
                                <div className="grid gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)]">
                                    <span>Task profile</span>
                                    <span>Tile label</span>
                                </div>
                                {taskTileLabelProfiles.map((profile) => (
                                    <div key={profile} className="grid gap-2 border-t border-white/10 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.35fr)] md:items-center">
                                        <div className="min-w-0 text-sm font-semibold text-slate-100">{profile}</div>
                                        <div className={`text-xs font-semibold leading-5 ${taskAbbreviations[profile] ? 'text-slate-100' : 'text-slate-500'}`}>{taskAbbreviations[profile] || 'Uses default tile label'}</div>
                                    </div>
                                ))}
                            </div>
                        ) : <UnitSettingsReadRow label="Task tile labels" value="No task profiles are configured for this operating model." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Standard Missions" description="Regular unit mission profiles scoped to this unit." action={settingsLink('standard-missions', 'Take me there', { focusSubsectionId: 'platform-standard-mission-records' })}>
                        {standardMissionProfiles.length > 0 ? standardMissionProfiles.map((profile: any) => (
                            <div key={profile.id || profile.missionName} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Short title" value={profile.shortTitle || profile.code || ''} onChange={(value) => updateStandardMissionProfile(profile, { shortTitle: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Mission name" value={profile.missionName || ''} onChange={(value) => updateStandardMissionProfile(profile, { missionName: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Aircraft type" value={profile.aircraftTypeCode || ''} onChange={(value) => updateStandardMissionProfile(profile, { aircraftTypeCode: value })} disabled={!canEdit} />
                                <UnitSettingsNumberField label="Duration minutes" value={Number(profile.durationMinutes ?? 0)} onChange={(value) => updateStandardMissionProfile(profile, { durationMinutes: value })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Missions" value="No standard missions are configured for this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Currency Builder" description="Preset crew, aircraft configuration and currency selections for requests." action={settingsLink('currency-profiles', 'Take me there', { aircraftTypeCode: primaryAircraftTypeCode, focusSubsectionId: 'platform-currency-profile-records' })}>
                        {currencyProfiles.length > 0 ? currencyProfiles.map((profile) => (
                            <div key={profile.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Profile code" value={profile.code || ''} onChange={(value) => updateCurrencyProfile(profile, { code: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Profile name" value={profile.name || ''} onChange={(value) => updateCurrencyProfile(profile, { name: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Currency" value={profile.currency || ''} onChange={(value) => updateCurrencyProfile(profile, { currency: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Crew" value={profile.crew || ''} onChange={(value) => updateCurrencyProfile(profile, { crew: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Config" value={profile.config || 'ANY'} onChange={(value) => updateCurrencyProfile(profile, { config: value })} disabled={!canEdit} />
                                <UnitSettingsNumberField label="Aircraft count" value={Number(profile.aircraftCount ?? 0)} onChange={(value) => updateCurrencyProfile(profile, { aircraftCount: value })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Currency builder" value="No currency profiles match this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Training Reports Builder" description="Unit report naming, pass/fail wording, grading and module labels." action={settingsLink('training-report-template', 'Take me there', { unitCode: unit.code, focusSubsectionId: 'platform-unit-training-report-template' })}>
                        <UnitSettingsField label="Report short name" value={trainingReportTerminology.name} onChange={(value) => updateUnitSettings({ trainingReportTerminology: { name: value.slice(0, 10) } })} disabled={!canEdit} />
                        <UnitSettingsField label="Display name" value={trainingReportTemplate.displayName} onChange={(value) => updateUnitTrainingReportTemplate({ displayName: value.slice(0, 20) })} disabled={!canEdit} />
                        <UnitSettingsNumberField label="Grade minimum" value={Number(trainingReportTemplate.grades.scaleMin ?? 0)} onChange={(value) => updateUnitTrainingReportTemplate({ grades: { ...trainingReportTemplate.grades, scaleMin: value } })} disabled={!canEdit} />
                        <UnitSettingsNumberField label="Grade maximum" value={Number(trainingReportTemplate.grades.scaleMax ?? 5)} onChange={(value) => updateUnitTrainingReportTemplate({ grades: { ...trainingReportTemplate.grades, scaleMax: value } })} disabled={!canEdit} />
                        <UnitSettingsField label="Pass label" value={trainingReportTemplate.overallResults.passLabel || ''} onChange={(value) => updateUnitTrainingReportTemplate({ overallResults: { ...trainingReportTemplate.overallResults, passLabel: value } })} disabled={!canEdit} />
                        <UnitSettingsField label="Fail label" value={trainingReportTemplate.overallResults.failLabel || ''} onChange={(value) => updateUnitTrainingReportTemplate({ overallResults: { ...trainingReportTemplate.overallResults, failLabel: value } })} disabled={!canEdit} />
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Scoring Matrix for Training Reports" description="Assessment element scoring standards used by training reports." action={settingsLink('scoring-matrix', 'Take me there')}>
                        <UnitSettingsReadRow label="Scope" value="Organisation scoring standards used by applicable training reports." />
                        <UnitSettingsReadRow label="Unit" value={unit.code || 'Current unit'} />
                    </UnitSettingsGroup>
                </div>
            );
        }

        if (activeCategory === 'labels') {
            return (
                <div className="space-y-4">
                    <UnitSettingsGroup title="Personnel Terminology" description="How people, ranks and instructors are named for this organisation." action={settingsLink('platform-rank-terminology', 'Take me there', { focusSubsectionId: 'platform-personnel-terminology' })}>
                        <UnitSettingsSelect label="Personnel sort" value={personnelDisplaySettings.sortMode || 'rank-then-name'} options={['rank-then-name', 'alphabetical']} optionLabels={{ 'rank-then-name': 'Rank then name', alphabetical: 'Alphabetical' }} onChange={(value) => updatePersonnelDisplaySettings({ sortMode: value })} disabled={!canEdit} />
                        <UnitSettingsField label="Instructor term" value={personnelDisplaySettings.instructorLabel || ''} onChange={(value) => updatePersonnelDisplaySettings({ instructorLabel: value })} disabled={!canEdit} />
                        <UnitSettingsField label="Civilian group" value={personnelDisplaySettings.civilianContractorGroupName || ''} onChange={(value) => updatePersonnelDisplaySettings({ civilianContractorGroupName: value })} disabled={!canEdit} />
                        <UnitSettingsSelect label="Trainee ranks" value={personnelDisplaySettings.useSeparateTraineeRankOrder ? 'separate' : 'staff'} options={['staff', 'separate']} optionLabels={{ staff: 'Uses staff rank order', separate: 'Separate trainee rank order' }} onChange={(value) => updatePersonnelDisplaySettings({ useSeparateTraineeRankOrder: value === 'separate' })} disabled={!canEdit} />
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Crew Position Labels" description="Generic scheduler roles mapped to customer-facing words." action={settingsLink('platform-rank-terminology', 'Take me there', { focusSubsectionId: 'platform-crew-position-labels' })}>
                        {crewPositionTerminology.positions.map((entry) => (
                            <div key={entry.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Generic role" value={entry.genericName || ''} onChange={(value) => updateCrewPositionEntry(entry, { genericName: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Display label" value={entry.label || ''} onChange={(value) => updateCrewPositionEntry(entry, { label: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Models" value={(entry.operationalModels || []).join(', ')} onChange={(value) => updateCrewPositionEntry(entry, { operationalModels: value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={!canEdit} />
                            </div>
                        ))}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Unit Callsigns" description="Callsign bases offered when creating or editing unit events." action={settingsLink('platform-rank-terminology', 'Take me there', { focusSubsectionId: 'platform-unit-callsigns' })}>
                        {unitCallsignEntries.length > 0 ? unitCallsignEntries.map((entry) => (
                            <div key={entry.id} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Callsign" value={entry.callsign || ''} onChange={(value) => updateUnitCallsignEntry(entry, { callsign: value })} disabled={!canEdit} />
                                <UnitSettingsSelect label="Default" value={entry.isDefault ? 'yes' : 'no'} options={['yes', 'no']} optionLabels={{ yes: 'Default callsign', no: 'Available callsign' }} onChange={(value) => updateUnitCallsignEntry(entry, { isDefault: value === 'yes' })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Callsigns" value="No callsigns configured for this unit." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="Formation Callsigns" description="Formation callsigns filtered for the current unit." action={settingsLink('location', 'Take me there')}>
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
                    <UnitSettingsGroup title="Enabled Tools" description="Feature/module switches for this unit." action={settingsLink('platform-unit-modules', 'Take me there', { focusSubsectionId: `platform-unit-modules-${unitFocusAnchor}` })}>
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
                    <UnitSettingsGroup title="Master LMP Access" description="Which Master LMP records this unit can see or manage." action={settingsLink('platform-master-lmp-access', 'Take me there', { focusSubsectionId: 'platform-master-lmp-access-records' })}>
                        {masterLmpAccessForUnit.length > 0 ? masterLmpAccessForUnit.map((rule: any, index: number) => (
                            <div key={rule.id || index} className="border-t border-white/10 first:border-t-0">
                                <UnitSettingsField label="Master LMP" value={rule.lmpCode || rule.masterLmpName || rule.masterLmpId || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { lmpCode: value })} disabled={!canEdit} />
                                <UnitSettingsSelect label="Access level" value={rule.accessLevel || 'View'} options={['View', 'Assign', 'Manage']} onChange={(value) => updateMasterLmpAccessRule(rule, { accessLevel: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Location" value={rule.locationCode || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { locationCode: value })} disabled={!canEdit} />
                                <UnitSettingsField label="Unit" value={rule.unitCode || ''} onChange={(value) => updateMasterLmpAccessRule(rule, { unitCode: value })} disabled={!canEdit} />
                            </div>
                        )) : <UnitSettingsReadRow label="Access rules" value="No unit-specific Master LMP restrictions. Organisation defaults apply." muted />}
                    </UnitSettingsGroup>
                    <UnitSettingsGroup title="User Access Scopes" description="Users or profiles with access that includes this unit." action={settingsLink('platform-user-access', 'Take me there', { locationCode: unit.locationCode, focusSubsectionId: unit.locationCode ? `platform-user-access-location-${settingsAnchorSuffix(unit.locationCode)}` : 'platform-user-access-records' })}>
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
                <UnitSettingsGroup title="Unit Identity" description="The core settings that decide where this unit lives and which operational model it uses." action={settingsLink('platform-units', 'Take me there', { unitCode: unit.code })}>
                    <UnitSettingsField label="Unit code" value={unit.code || ''} onChange={() => {}} disabled />
                    <UnitSettingsField label="Unit name" value={unit.name || ''} onChange={(value) => updateUnit({ name: value })} disabled={!canEdit} />
                    <UnitSettingsSelect label="Location" value={unit.locationCode || ''} options={locations.map((item: any) => item.code)} onChange={(value) => updateUnit({ locationCode: value })} disabled={!canEdit} />
                    <UnitSettingsSelect label="Unit type" value={unit.unitType || 'Training'} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'HQ', 'Operational']} onChange={(value) => updateUnit({ unitType: value })} disabled={!canEdit} />
                    <UnitSettingsField label="Trainees" value={unitHasTrainees ? 'On' : 'Off'} onChange={() => {}} disabled />
                    <UnitSettingsSelect label="Operating model" value={operationalModel} options={OPERATIONAL_MODEL_OPTIONS.map((option) => option.value)} optionLabels={modelOptionLabels} onChange={(value) => updateUnitSettings({ operationalModel: value })} disabled={!canEdit} />
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
                        <h3 className="mt-1 text-2xl font-semibold tracking-normal text-white">{unit.name || unit.code}</h3>
                        <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                            A simplified read-only view of the Settings records for this unit. Use Take me there to edit the authoritative setting in Settings.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className={unitSettingsMutedPillClass}>{unit.code}</span>
                        <span className={unitSettingsMutedPillClass}>{getOperationalModelLabel(operationalModel)}</span>
                        <span className={unitSettingsMutedPillClass}>{unit.locationCode || 'No location'}</span>
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
    unitCode?: string;
    locationCode?: string;
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
    isSetupTestMode?: boolean;
    onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
}> = ({ platformConfig, unitCode, locationCode, onUpdatePlatformConfig, isSetupTestMode = false, onSaveSetupTestPersonnel }) => {
    const [mode, setMode] = useState<InitialSetupWizardMode>('detect');
    const [wizardStep, setWizardStep] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(window.localStorage.getItem(initialSetupWizardStorageKey));
        return Number.isFinite(stored) ? Math.max(0, stored) : 0;
    });
    const [uploadResults, setUploadResults] = useState<Record<string, InitialSetupWizardUploadResult>>({});
    const [importConfirmations, setImportConfirmations] = useState<Record<string, string>>({});
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState('');
    const [uploadedStaffProfileRows, setUploadedStaffProfileRows] = useState<any[]>([]);
    const [uploadedTraineeProfileRows, setUploadedTraineeProfileRows] = useState<any[]>([]);
    const [uploadedCourseLmpItems, setUploadedCourseLmpItems] = useState<SyllabusItemDetail[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const lastSetupTestPersonnelSnapshotRef = useRef('');
    const pushWizardImportDiag = (stage: string, details: Record<string, any> = {}) => {
        if (!isSetupTestMode || typeof window === 'undefined') return;
        const entry = {
            ts: new Date().toISOString(),
            stage,
            unitCode,
            details,
        };
        try {
            console.log(`[SETUP-WIZARD-IMPORT] ${stage}`, entry);
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_wizard_import_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-80);
            window.localStorage.setItem('dfp_setup_wizard_import_diag', JSON.stringify(next));
            (window as any).neoSetupWizardImportDiag = next;
        } catch (error) {
            console.log(`[SETUP-WIZARD-IMPORT] ${stage}`, entry, error);
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
            details,
        };
        try {
            console.log(`[SETUP-TEST-LMP] ${stage}`, entry);
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_test_lmp_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-500);
            window.localStorage.setItem('dfp_setup_test_lmp_diag', JSON.stringify(next));
            (window as any).neoSetupTestLmpDiag = next;
        } catch (error) {
            console.log(`[SETUP-TEST-LMP] ${stage}`, entry, error);
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

    const activeOrganisation = (platformConfig?.organisations || []).find((organisation: any) => (
        String(organisation?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    )) || platformConfig?.organisations?.[0];
    const currentUnit = (platformConfig?.units || []).find((unit: any) => (
        normaliseUnitSettingsIdentifier(unit?.code) === normaliseUnitSettingsIdentifier(unitCode)
    )) || (platformConfig?.units || [])[0];
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
    const wizardLocationProfiles = Array.from(new Map([
        ...Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES || {}).map(normaliseWizardLocationProfile),
        ...activeLocations.map(normaliseWizardLocationProfile),
    ].filter((profile) => profile.icao || profile.iata || profile.name).map((profile) => [
        normaliseUnitSettingsIdentifier(profile.icao || profile.iata || profile.name),
        profile,
    ])).values());
    const wizardLocationIcaoOptions = wizardLocationProfiles.map((profile) => profile.icao).filter(Boolean);
    const wizardLocationIataOptions = wizardLocationProfiles.map((profile) => profile.iata).filter(Boolean);
    const wizardLocationNameOptions = wizardLocationProfiles.map((profile) => profile.name).filter(Boolean);
    const findWizardLocationProfile = (value: string) => {
        const key = normaliseUnitSettingsIdentifier(value);
        return wizardLocationProfiles.find((profile) => (
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
    const activeMasterLmpAccess = Array.isArray(activeOrganisation?.settings?.masterLmpAccess)
        ? activeOrganisation.settings.masterLmpAccess.filter((item: any) => String(item?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        : [];
    const crewCompositionSettings = normaliseCrewCompositionSettings(activeOrganisation?.settings?.crewCompositionSettings || null);
    const standardCrewConfigured = activeAircraftTypes.some((aircraft: any) => {
        const standardSeats = normaliseAircraftCrewComposition(aircraft?.crewComposition || null)?.standardSeats;
        return Array.isArray(standardSeats) && standardSeats.length > 0;
    }) || crewCompositionSettings.alternateCompositions.length > 0;
    const orgStructureConfigured = organisationStructureLevels.length > 0 && organisationStructureLevels.some((level: any) => (
        String(level?.name || '').trim() && Array.isArray(level?.options) && level.options.length > 0
    ));
    const primaryAircraftType = activeAircraftTypes[0] || null;
    const primaryResourcePool = activeResourcePools.find((pool: any) => (
        normaliseUnitSettingsIdentifier(pool?.unitCode) === normaliseUnitSettingsIdentifier(currentUnit?.code)
    )) || activeResourcePools[0] || null;
    const primaryUserAccess = activeUserAccess.find((access: any) => (
        normaliseUnitSettingsIdentifier(access?.unitCode || access?.unit) === normaliseUnitSettingsIdentifier(currentUnit?.code)
        || normaliseUnitSettingsIdentifier(access?.locationCode || access?.location) === normaliseUnitSettingsIdentifier(currentLocation?.code)
    )) || activeUserAccess[0] || null;
    const primaryMasterLmp = activeMasterLmpCatalogue[0] || null;
    const primaryMasterLmpRule = activeMasterLmpAccess.find((rule: any) => (
        normaliseUnitSettingsIdentifier(rule?.unitCode || rule?.unit) === normaliseUnitSettingsIdentifier(currentUnit?.code)
    )) || activeMasterLmpAccess[0] || null;
    const levelDraftSource = (levelIndex: number) => organisationStructureLevels.find((level: any) => Number(level?.levelIndex ?? level?.level ?? levelIndex) === levelIndex) || organisationStructureLevels[levelIndex] || {};
    const parentLinesForLevel = (levelIndex: 1 | 2 | 3, fallback = '') => {
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
    const parseNumberDraft = (value: string, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const [organisationDraft, setOrganisationDraft] = useState({
        code: String(activeOrganisation?.code || 'RAAF'),
        name: String(activeOrganisation?.name || activeOrganisation?.code || 'RAAF'),
        level0Name: String(levelDraftSource(0)?.name || activeOrganisation?.name || 'Organisation'),
        level0Options: toLines(levelDraftSource(0)?.options || [activeOrganisation?.name || activeOrganisation?.code || 'RAAF']),
        level1Name: String(levelDraftSource(1)?.name || 'Branch / HQ'),
        level1Options: toLines(levelDraftSource(1)?.options || []),
        level1Parents: parentLinesForLevel(1, `Air Command = ${activeOrganisation?.name || activeOrganisation?.code || 'RAAF'}`),
        level2Name: String(levelDraftSource(2)?.name || 'Command'),
        level2Options: toLines(levelDraftSource(2)?.options || []),
        level2Parents: parentLinesForLevel(2, 'Air Combat Group = Air Command\nAir Mobility Group = Air Command'),
        level3Name: String(levelDraftSource(3)?.name || 'Wing / Group'),
        level3Options: toLines(levelDraftSource(3)?.options || []),
        level3Parents: parentLinesForLevel(3, '78WG = Air Combat Group\n84WG = Air Mobility Group'),
    });
    const [locationDraft, setLocationDraft] = useState({
        code: String(currentLocation?.code || activeWizardLocationCode || currentUnit?.locationCode || 'YAMB'),
        iataCode: String(currentLocation?.iataCode || currentLocation?.settings?.iataCode || 'AMB'),
        name: String(currentLocation?.name || 'Amberley'),
        timezone: String(currentLocation?.timezone || 'Australia/Brisbane'),
        trainingAreas: Array.isArray(currentLocation?.trainingAreas) ? currentLocation.trainingAreas.join(', ') : '',
    });
    const [unitsTodayDraft, setUnitsTodayDraft] = useState(() => (
        activeUnits.length > 0
            ? activeUnits.map((unit: any) => `${unit.code}${unit.name && unit.name !== unit.code ? ` | ${unit.name}` : ''}`).join('\n')
            : '36SQN | 36SQN'
    ));
    const [unitParentDraft, setUnitParentDraft] = useState('');
    const [locationsTodayDraft, setLocationsTodayDraft] = useState(() => (
        activeLocations.length > 0
            ? activeLocations.map((location: any) => `${location.code || ''} | ${location.iataCode || location.settings?.iataCode || ''} | ${location.name || location.code || ''}`).join('\n')
            : formatWizardLocationRows([activeWizardLocationRow]) || 'YAMB | AMB | Amberley'
    ));
    const [locationDraftRowCount, setLocationDraftRowCount] = useState(() => Math.max(1, parseWizardLocationRows(
        activeLocations.length > 0
            ? activeLocations.map((location: any) => `${location.code || ''} | ${location.iataCode || location.settings?.iataCode || ''} | ${location.name || location.code || ''}`).join('\n')
            : formatWizardLocationRows([activeWizardLocationRow]) || 'YAMB | AMB | Amberley',
    ).length));
    const [unitDraft, setUnitDraft] = useState({
        code: String(currentUnit?.code || unitCode || '36SQN'),
        name: String(currentUnit?.name || currentUnit?.code || unitCode || '36SQN'),
        locationCode: String(currentUnit?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
        unitType: String(currentUnit?.unitType || 'Operational'),
        operationalModel: String(getUnitOperationalModel(currentUnit || {}) || 'pooled-crew'),
        hasTrainees: currentUnit?.settings?.hasTrainees !== false,
    });
    const [resourceDraft, setResourceDraft] = useState({
        aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || 'C-17A'),
        aircraftName: String(primaryAircraftType?.name || primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || 'C-17A'),
        poolName: String(primaryResourcePool?.name || `${currentLocation?.name || currentLocation?.code || 'Home'} ${primaryAircraftType?.code || 'Aircraft'} Resource Pool`),
        poolUnitCode: String(primaryResourcePool?.unitCode || currentUnit?.code || ''),
        poolLocationCode: String(primaryResourcePool?.locationCode || currentUnit?.locationCode || currentLocation?.code || ''),
        aircraft: String(primaryResourcePool?.settings?.aircraft ?? primaryResourcePool?.aircraft ?? ''),
        sim: String(primaryResourcePool?.settings?.ftd ?? primaryResourcePool?.settings?.sim ?? primaryResourcePool?.ftd ?? primaryResourcePool?.sim ?? ''),
        trainer: String(primaryResourcePool?.settings?.cpt ?? primaryResourcePool?.settings?.trainer ?? primaryResourcePool?.cpt ?? primaryResourcePool?.trainer ?? ''),
        standby: String(primaryResourcePool?.settings?.standby ?? primaryResourcePool?.standby ?? ''),
        ground: String(primaryResourcePool?.settings?.ground ?? primaryResourcePool?.ground ?? ''),
    });
    const [crewDraft, setCrewDraft] = useState({
        aircraftCode: String(primaryAircraftType?.code || resourceDraft.aircraftCode || 'C-17A'),
        standardSeats: formatRoleRequirementsText(normaliseAircraftCrewComposition(primaryAircraftType?.crewComposition || null).standardSeats || []),
    });
    const [accessDraft, setAccessDraft] = useState({
        userName: String(primaryUserAccess?.userName || primaryUserAccess?.user || 'New user'),
        locationCode: String(primaryUserAccess?.locationCode || primaryUserAccess?.location || currentLocation?.code || ''),
        unitCode: String(primaryUserAccess?.unitCode || primaryUserAccess?.unit || currentUnit?.code || ''),
        moduleCode: String(primaryUserAccess?.moduleCode || primaryUserAccess?.module || 'DFP'),
        accessLevel: String(primaryUserAccess?.accessLevel || primaryUserAccess?.access || 'View'),
    });
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
    const [crewLabelsDraft, setCrewLabelsDraft] = useState('Pilot = Pilot\nLoadmaster = Loadmaster');
    const [alternateCrewDraft, setAlternateCrewDraft] = useState('Reduced crew = Pilot 1, Loadmaster 1');
    const [buildRulesDraft, setBuildRulesDraft] = useState({
        businessRules: 'Use default',
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
    const buildRulesDraftText = formatWizardBuildRulesDraft(buildRulesDraft);
    const [staffDraft, setStaffDraft] = useState('Burns, Alexander | 36SQN | Pilot | PIC');
    const [traineeCourseOptionsDraft, setTraineeCourseOptionsDraft] = useState('Course 1');
    const [traineeCourseInputRows, setTraineeCourseInputRows] = useState<string[]>(() => ['Course 1']);
    const [traineeDraft, setTraineeDraft] = useState('');
    const [traineeAllocationCommitted, setTraineeAllocationCommitted] = useState(false);
    const [showMoreTraineesPrompt, setShowMoreTraineesPrompt] = useState(false);
    const [trainingRecordsDraft, setTrainingRecordsDraft] = useState('Training Report | PT-051 | 0 | 5 | Yes | No | PASS | FAIL');
    const [unitModulesDraft, setUnitModulesDraft] = useState('DFP | On\nNEO Build | On\nProgram Schedule | On\nTraining Records | On');
    const [rankLabelsDraft, setRankLabelsDraft] = useState('1 | AIRCDRE = BRIG = CDRE | Same seniority across services\n2 | GPCAPT = COL = CAPT | Same seniority across services\n3 | WGCDR = LTCOL = CMDR | Same seniority across services\n4 | SQNLDR = MAJ = LCDR | Same seniority across services');
    const [resourceSharingDraft, setResourceSharingDraft] = useState('Resource sharing | Off |  | Unit keeps its own aircraft and resource pool capacity.\nStaff sharing | Off |  | Unit only schedules its own staff unless changed later.');
    const [currencyDraft, setCurrencyDraft] = useState('PIC Currency | PIC | Standard crew | ANY | PIC Currency | 1\nInstrument Currency | INST | Standard crew | ANY | Instrument Currency | 1');
    const [scoringDraft, setScoringDraft] = useState('Preparation | Prepared, safe and ready to train. | Not prepared or unsafe to continue. | Unsafe | Major help required | Help required | Meets standard | Above standard | Excellent\nAirmanship | Makes safe decisions and prioritises correctly. | Poor judgement or unsafe prioritisation. | Unsafe | Weak | Developing | Meets standard | Strong | Excellent');
    const [staffCurrencyEventsDraft, setStaffCurrencyEventsDraft] = useState('Annual Instrument Check | INST | Flight | 90 | 90 | 60 | Standard crew | Instrument Currency | ANY | 1');

    const formatWizardOrganisationPath = (path: string[]) => path.map((item) => String(item || '').trim()).filter(Boolean).join(' / ');
    const parseWizardOrganisationPath = (value: string) => String(value || '').split('/').map((item) => item.trim()).filter(Boolean);
    const getWizardOrganisationRelationshipPaths = () => {
        const rootLabel = fromLines(organisationDraft.level0Options)[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const level1Options = fromLines(organisationDraft.level1Options);
        const level2Options = fromLines(organisationDraft.level2Options);
        const level3Options = fromLines(organisationDraft.level3Options);
        const level1Rows = buildWizardParentRowsForChildren(level1Options, organisationDraft.level1Parents, [rootLabel]);
        const level2Rows = buildWizardParentRowsForChildren(level2Options, organisationDraft.level2Parents, level1Options);
        const level3Rows = buildWizardParentRowsForChildren(level3Options, organisationDraft.level3Parents, level2Options);
        return buildWizardRelationshipPaths(rootLabel, level1Rows, level2Rows, level3Rows);
    };
    const getWizardUnitParentPathOptions = () => {
        const rootLabel = fromLines(organisationDraft.level0Options)[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const relationshipPaths = getWizardOrganisationRelationshipPaths();
        const candidatePaths = relationshipPaths.length > 0 ? relationshipPaths : [[rootLabel]];
        const deepestLength = Math.max(...candidatePaths.map((path) => path.length));
        return candidatePaths
            .filter((path) => path.length === deepestLength)
            .map((path) => path.filter(Boolean));
    };
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

    useEffect(() => {
        setOrganisationDraft({
            code: String(activeOrganisation?.code || 'RAAF'),
            name: String(activeOrganisation?.name || activeOrganisation?.code || 'RAAF'),
            level0Name: String(levelDraftSource(0)?.name || activeOrganisation?.name || 'Organisation'),
            level0Options: toLines(levelDraftSource(0)?.options || [activeOrganisation?.name || activeOrganisation?.code || 'RAAF']),
            level1Name: String(levelDraftSource(1)?.name || 'Branch / HQ'),
            level1Options: toLines(levelDraftSource(1)?.options || []),
            level1Parents: parentLinesForLevel(1, `Air Command = ${activeOrganisation?.name || activeOrganisation?.code || 'RAAF'}`),
            level2Name: String(levelDraftSource(2)?.name || 'Command'),
            level2Options: toLines(levelDraftSource(2)?.options || []),
            level2Parents: parentLinesForLevel(2, 'Air Combat Group = Air Command\nAir Mobility Group = Air Command'),
            level3Name: String(levelDraftSource(3)?.name || 'Wing / Group'),
            level3Options: toLines(levelDraftSource(3)?.options || []),
            level3Parents: parentLinesForLevel(3, '78WG = Air Combat Group\n84WG = Air Mobility Group'),
        });
    }, [activeOrganisation?.code, activeOrganisation?.name, JSON.stringify(organisationStructureLevels)]);

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
        unitParentDraft,
    ]);

    useEffect(() => {
        setLocationDraft({
            code: String(currentLocation?.code || activeWizardLocationCode || currentUnit?.locationCode || 'YAMB'),
            iataCode: String(currentLocation?.iataCode || currentLocation?.settings?.iataCode || 'AMB'),
            name: String(currentLocation?.name || 'Amberley'),
            timezone: String(currentLocation?.timezone || 'Australia/Brisbane'),
            trainingAreas: Array.isArray(currentLocation?.trainingAreas) ? currentLocation.trainingAreas.join(', ') : '',
        });
    }, [activeWizardLocationCode, currentLocation?.code, currentLocation?.name, currentLocation?.timezone, JSON.stringify(currentLocation?.trainingAreas || [])]);

    useEffect(() => {
        const firstLocation = parseWizardLocationRows(locationsTodayDraft)[0];
        setLocationDraftRowCount((count) => Math.max(count, parseWizardLocationRows(locationsTodayDraft).length, 1));
        if (!firstLocation) return;
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
        setUnitDraft({
            code: String(currentUnit?.code || unitCode || '36SQN'),
            name: String(currentUnit?.name || currentUnit?.code || unitCode || '36SQN'),
            locationCode: String(currentUnit?.locationCode || activeWizardLocationCode || currentLocation?.code || ''),
            unitType: String(currentUnit?.unitType || 'Operational'),
            operationalModel: String(getUnitOperationalModel(currentUnit || {}) || 'pooled-crew'),
            hasTrainees: currentUnit?.settings?.hasTrainees !== false,
        });
    }, [activeWizardLocationCode, currentUnit?.code, currentUnit?.name, currentUnit?.locationCode, currentUnit?.unitType, currentUnit?.settings?.operationalModel, currentUnit?.settings?.hasTrainees, unitCode, currentLocation?.code]);

    useEffect(() => {
        setResourceDraft({
            aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || 'C-17A'),
            aircraftName: String(primaryAircraftType?.name || primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || 'C-17A'),
            poolName: String(primaryResourcePool?.name || `${currentLocation?.name || currentLocation?.code || 'Home'} ${primaryAircraftType?.code || 'Aircraft'} Resource Pool`),
            poolUnitCode: String(primaryResourcePool?.unitCode || currentUnit?.code || ''),
            poolLocationCode: String(primaryResourcePool?.locationCode || currentUnit?.locationCode || currentLocation?.code || ''),
            aircraft: String(primaryResourcePool?.settings?.aircraft ?? primaryResourcePool?.aircraft ?? ''),
            sim: String(primaryResourcePool?.settings?.ftd ?? primaryResourcePool?.settings?.sim ?? primaryResourcePool?.ftd ?? primaryResourcePool?.sim ?? ''),
            trainer: String(primaryResourcePool?.settings?.cpt ?? primaryResourcePool?.settings?.trainer ?? primaryResourcePool?.cpt ?? primaryResourcePool?.trainer ?? ''),
            standby: String(primaryResourcePool?.settings?.standby ?? primaryResourcePool?.standby ?? ''),
            ground: String(primaryResourcePool?.settings?.ground ?? primaryResourcePool?.ground ?? ''),
        });
        setCrewDraft({
            aircraftCode: String(primaryAircraftType?.code || primaryResourcePool?.aircraftTypeCode || 'C-17A'),
            standardSeats: formatRoleRequirementsText(normaliseAircraftCrewComposition(primaryAircraftType?.crewComposition || null).standardSeats || []),
        });
    }, [primaryAircraftType?.code, primaryAircraftType?.name, JSON.stringify(primaryAircraftType?.crewComposition || {}), primaryResourcePool?.name, primaryResourcePool?.unitCode, primaryResourcePool?.locationCode, primaryResourcePool?.aircraftTypeCode, JSON.stringify(primaryResourcePool?.settings || {}), currentUnit?.code, currentUnit?.locationCode, currentLocation?.code, currentLocation?.name]);

    useEffect(() => {
        setCrewDraft((draft) => ({
            ...draft,
            aircraftCode: resourceDraft.aircraftCode || draft.aircraftCode,
        }));
    }, [resourceDraft.aircraftCode]);

    useEffect(() => {
        setAccessDraft({
            userName: String(primaryUserAccess?.userName || primaryUserAccess?.user || 'New user'),
            locationCode: String(primaryUserAccess?.locationCode || primaryUserAccess?.location || currentLocation?.code || ''),
            unitCode: String(primaryUserAccess?.unitCode || primaryUserAccess?.unit || currentUnit?.code || ''),
            moduleCode: String(primaryUserAccess?.moduleCode || primaryUserAccess?.module || 'DFP'),
            accessLevel: String(primaryUserAccess?.accessLevel || primaryUserAccess?.access || 'View'),
        });
    }, [primaryUserAccess?.userName, primaryUserAccess?.user, primaryUserAccess?.locationCode, primaryUserAccess?.unitCode, primaryUserAccess?.moduleCode, primaryUserAccess?.accessLevel, primaryUserAccess?.access, currentLocation?.code, currentUnit?.code]);

    useEffect(() => {
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
            code: organisationDraft.code || 'RAAF',
            name: organisationDraft.name || organisationDraft.code || 'RAAF',
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

    const saveOrganisationDraft = () => {
        const rootLabel = fromLines(organisationDraft.level0Options)[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const level1ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level1Options), organisationDraft.level1Parents, [rootLabel]);
        const level2ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level2Options), organisationDraft.level2Parents, fromLines(organisationDraft.level1Options));
        const level3ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level3Options), organisationDraft.level3Parents, fromLines(organisationDraft.level2Options));
        const parentMapsByLevel = [
            buildWizardParentMaps([]),
            buildWizardParentMaps(level1ParentRows),
            buildWizardParentMaps(level2ParentRows),
            buildWizardParentMaps(level3ParentRows),
        ];
        const relationshipPaths = buildWizardRelationshipPaths(rootLabel, level1ParentRows, level2ParentRows, level3ParentRows);
        const levelDrafts = [
            { name: organisationDraft.level0Name, options: fromLines(organisationDraft.level0Options) },
            { name: organisationDraft.level1Name, options: fromLines(organisationDraft.level1Options) },
            { name: organisationDraft.level2Name, options: fromLines(organisationDraft.level2Options) },
            { name: organisationDraft.level3Name, options: fromLines(organisationDraft.level3Options) },
        ];
        saveWizardConfig('Organisation details saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
            organisationStructure: {
                ...(settings.organisationStructure || {}),
                levels: levelDrafts.map((draft, levelIndex) => ({
                    ...(levelDraftSource(levelIndex) || {}),
                    levelIndex,
                    name: draft.name,
                    options: draft.options,
                    childrenByParent: parentMapsByLevel[levelIndex]?.childrenByParent || {},
                    parentByChild: parentMapsByLevel[levelIndex]?.parentByChild || {},
                })).filter((level) => String(level.name || '').trim() || level.options.length > 0),
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
                timezone: locationDraft.timezone || 'Australia/Brisbane',
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
                unitType: unitDraft.unitType || 'Operational',
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

    const saveResourceDraft = () => {
        const aircraftCode = String(resourceDraft.aircraftCode || '').trim().toUpperCase();
        if (!aircraftCode) {
            setSaveMessage('Enter an aircraft type code before saving.');
            return;
        }
        saveWizardConfig('Aircraft type and resource pool saved into Settings.', (baseConfig) => {
            const aircraftTypes = Array.isArray(baseConfig.aircraftTypes) ? baseConfig.aircraftTypes : [];
            const resourcePools = Array.isArray(baseConfig.resourcePools) ? baseConfig.resourcePools : [];
            const aircraftExists = aircraftTypes.some((aircraft: any) => normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode));
            const poolKey = primaryResourcePool?.id || primaryResourcePool?.code || '';
            const nextPool = {
                id: primaryResourcePool?.id || createWizardRecordId('pool'),
                code: primaryResourcePool?.code || `POOL-${resourcePools.length + 1}`,
                name: resourceDraft.poolName || `${aircraftCode} Resource Pool`,
                organisationCode: activeOrganisation?.code || organisationDraft.code || 'DEFAULT',
                locationCode: resourceDraft.poolLocationCode,
                unitCode: resourceDraft.poolUnitCode,
                aircraftTypeCode: aircraftCode,
                poolType: primaryResourcePool?.poolType || 'Dedicated',
                status: 'ACTIVE',
                settings: {
                    ...(primaryResourcePool?.settings || {}),
                    aircraft: parseNumberDraft(resourceDraft.aircraft),
                    ftd: parseNumberDraft(resourceDraft.sim),
                    cpt: parseNumberDraft(resourceDraft.trainer),
                    standby: parseNumberDraft(resourceDraft.standby),
                    ground: parseNumberDraft(resourceDraft.ground),
                },
            };
            const poolExists = resourcePools.some((pool: any) => (
                (poolKey && String(pool?.id || pool?.code || '') === String(poolKey))
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
                        || String(pool?.name || '').trim().toUpperCase() === String(nextPool.name || '').trim().toUpperCase()
                            ? { ...pool, ...nextPool, settings: { ...(pool.settings || {}), ...nextPool.settings } }
                            : pool
                    ))
                    : [...resourcePools, nextPool],
            };
        });
    };

    const saveCrewDraft = () => {
        const aircraftCode = String(crewDraft.aircraftCode || '').trim().toUpperCase();
        if (!aircraftCode) {
            setSaveMessage('Choose an aircraft type before saving crew composition.');
            return;
        }
        saveWizardConfig('Crew composition saved into Settings.', (baseConfig) => ({
            ...baseConfig,
            aircraftTypes: (baseConfig.aircraftTypes || []).map((aircraft: any) => (
                normaliseUnitSettingsIdentifier(aircraft?.code) === normaliseUnitSettingsIdentifier(aircraftCode)
                    ? {
                        ...aircraft,
                        crewComposition: {
                            ...normaliseAircraftCrewComposition(aircraft.crewComposition || null),
                            standardSeats: parseRoleRequirementsText(crewDraft.standardSeats),
                        },
                    }
                    : aircraft
            )),
        }));
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

    const saveTrainingDraft = () => {
        const lmpCode = String(trainingDraft.lmpCode || '').trim();
        if (!lmpCode) {
            setSaveMessage('Enter a Master LMP code before saving.');
            return;
        }
        saveWizardConfig('Master LMP and access rule saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const catalogue = Array.isArray(settings.masterLmpCatalogue) ? settings.masterLmpCatalogue : [];
            const accessRules = Array.isArray(settings.masterLmpAccess) ? settings.masterLmpAccess : [];
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
            label: 'Aircraft and resource pools',
            mandatory: true,
            complete: activeAircraftTypes.length > 0 && activeResourcePools.length > 0,
            summary: activeResourcePools.length > 0 ? `${activeResourcePools.length} resource pools configured` : 'Aircraft types and pools are needed before NEO can build.',
            settingsSection: 'platform-resource-pools',
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
            summary: 'Default build rules can be used now and refined later.',
            settingsSection: 'business-rules',
        },
    ];
    const mandatoryChecks = checks.filter((check) => check.mandatory);
    const completedMandatory = mandatoryChecks.filter((check) => check.complete).length;
    const completedChecks = checks.filter((check) => check.complete).length;
    const isPartiallyConfigured = completedMandatory > 1 && completedMandatory < mandatoryChecks.length;
    const allMandatoryComplete = completedMandatory === mandatoryChecks.length;

    const steps = [
        {
            id: 'analysis',
            title: 'Let us check what is already set up',
            label: 'Check',
            body: 'I will quickly read the current Settings data first, then guide you through the setup one question at a time.',
            checkIds: checks.map((check) => check.id),
        },
        {
            id: 'org-name',
            title: 'What is the name of your organisation?',
            label: 'Org name',
            body: 'This becomes Level 0, the top of the organisation structure.',
            checkIds: ['organisation'],
        },
        {
            id: 'org-level1',
            title: 'Build the next level down',
            label: 'Level 1',
            body: `Thanks. ${organisationDraft.name || organisationDraft.code || 'Your organisation'} will be Level 0. Now add the first layer below it.`,
            checkIds: ['organisation'],
        },
        {
            id: 'org-level2',
            title: `Build the level below ${organisationDraft.level1Name || 'Level 1'}`,
            label: 'Level 2',
            body: 'For example, this might be Command, Group, Wing, Region, or Directorate.',
            checkIds: ['organisation'],
        },
        {
            id: 'org-level3',
            title: `Build the level below ${organisationDraft.level2Name || 'Level 2'}`,
            label: 'Level 3',
            body: 'This is normally the level units are attached to or owned by.',
            checkIds: ['organisation'],
        },
        {
            id: 'units-today',
            title: 'Which units do you want to set up today?',
            label: 'Units',
            body: 'List the units you want this wizard to prepare. You can add more units later in Settings.',
            checkIds: ['units'],
        },
        {
            id: 'locations-today',
            title: 'Which localities do you want to set up?',
            label: 'Locations',
            body: 'A locality is a base, airfield, or operating location. Add the ICAO and IATA codes where known.',
            checkIds: ['locations'],
        },
        {
            id: 'location-details',
            title: 'Add details for the first locality',
            label: 'Location details',
            body: 'Confirm the first locality details. Repeat this pattern for each locality listed above.',
            checkIds: ['locations'],
        },
        {
            id: 'unit-model',
            title: 'Set up the first unit',
            label: 'Unit setup',
            body: 'We will repeat this setup pattern for each unit you listed. Start with the first/current unit.',
            checkIds: ['units'],
        },
        {
            id: 'resource-aircraft',
            title: `What aircraft or main resource does ${unitDraft.code || 'this unit'} use?`,
            label: 'Aircraft',
            body: 'This creates or updates the aircraft type and the resource pool name.',
            checkIds: ['resources'],
        },
        {
            id: 'resource-counts',
            title: `What can ${unitDraft.code || 'this unit'} schedule?`,
            label: 'Counts',
            body: 'Enter the numbers NEO can use for aircraft, simulators, trainers, standby and ground rows. Saving this step writes the resource pool into Settings.',
            checkIds: ['resources'],
        },
        {
            id: 'crew',
            title: 'Set the crew rules',
            label: 'Crew',
            body: 'Set the standard crew, labels, and any alternate crew patterns for this unit and aircraft.',
            checkIds: ['crew'],
        },
        {
            id: 'build-rules',
            title: 'Set the build rules and limits',
            label: 'Build rules',
            body: 'These are the rules NEO uses when it builds a schedule: business rules, duty limits, turnaround times, and event limits.',
            checkIds: ['rules'],
        },
        {
            id: 'staff',
            title: 'Add staff for this unit',
            label: 'Staff',
            body: 'Add the people NEO can schedule or use for permissions. You can upload a staff template on this step.',
            checkIds: ['access'],
        },
        {
            id: 'trainees',
            title: 'Does this unit have trainees?',
            label: 'Trainees',
            body: 'If this unit has trainees, switch trainees on. The next steps will create courses, upload trainees, then allocate them.',
            checkIds: ['access'],
        },
        {
            id: 'trainee-courses',
            title: 'Create trainee courses',
            label: 'Courses',
            body: 'Create the course numbers or course names trainees can be allocated to. These choices will be used after the trainee upload.',
            checkIds: ['access'],
        },
        {
            id: 'trainee-upload',
            title: 'Upload or add trainees',
            label: 'Upload trainees',
            body: 'Upload the trainee template or add trainees manually. Course allocation happens on the next step.',
            checkIds: ['access'],
        },
        {
            id: 'trainee-allocation',
            title: 'Allocate trainees to courses',
            label: 'Allocate trainees',
            body: 'Select which course each trainee belongs to, then commit the trainees to Trainee Profiles.',
            checkIds: ['access'],
        },
        {
            id: 'master-lmp',
            title: 'Choose or build the LMPs this unit will use',
            label: 'LMP',
            body: 'Choose an existing Master LMP or define a new one. Events can be uploaded from the courses template on this step.',
            checkIds: ['training'],
        },
        {
            id: 'training-records',
            title: 'Set up training records',
            label: 'Records',
            body: 'Choose the training record defaults for this unit. Detailed report design can still be refined later.',
            checkIds: ['training'],
        },
        {
            id: 'unit-modules',
            title: 'Choose unit modules',
            label: 'Modules',
            body: 'Choose which app modules this unit should use.',
            checkIds: ['access'],
        },
        {
            id: 'ranks-labels',
            title: 'Choose ranks and labels',
            label: 'Ranks',
            body: 'Use an existing rank and label set if one fits, or write the changes needed for this unit.',
            checkIds: ['access'],
        },
        {
            id: 'resource-sharing',
            title: 'Set resource and staff sharing',
            label: 'Sharing',
            body: 'Decide whether this unit shares aircraft, crew, staff, or other resources with another unit.',
            checkIds: ['resources'],
        },
        {
            id: 'currencies',
            title: 'Set the currencies this unit uses',
            label: 'Currencies',
            body: 'Enter only the currencies now. The full Currency Builder can be opened after setup for detailed rules.',
            checkIds: ['training'],
        },
        {
            id: 'access',
            title: 'Who should have access first?',
            label: 'Access',
            body: 'Create the first access scope so the selected user can work with the location, unit and Master LMP.',
            checkIds: ['access', 'training'],
        },
        {
            id: 'scoring',
            title: 'Set up the scoring matrix',
            label: 'Scoring',
            body: 'You can set this up now or mark it for later. This controls training report scoring.',
            checkIds: ['training'],
        },
        {
            id: 'staff-currency-events',
            title: 'Set standard staff currency events',
            label: 'Staff events',
            body: 'Add common staff currency events now, or leave them for later if the unit is not ready.',
            checkIds: ['training'],
        },
        {
            id: 'review',
            title: 'Review the setup',
            label: 'Review',
            body: allMandatoryComplete
                ? 'The mandatory setup areas look ready.'
                : 'Some mandatory setup areas still need attention. Step through the questions again or continue refining values here.',
            checkIds: checks.map((check) => check.id),
        },
    ];
    const currentStep = Math.min(wizardStep, steps.length - 1);
    const visibleStep = steps[currentStep];
    const templateIdsByStep: Record<string, string[]> = {
        'org-level1': ['organisation'],
        'org-level2': ['organisation'],
        'org-level3': ['organisation'],
        'units-today': ['units'],
        'locations-today': ['locations'],
        'staff': ['staff'],
        'trainee-upload': unitDraft.hasTrainees ? ['trainees'] : [],
        'master-lmp': ['courses'],
        'scoring': ['scoring'],
    };
    const visibleTemplates = initialSetupTemplates.filter((template) => (
        (templateIdsByStep[visibleStep.id] || []).includes(template.id)
    ));

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(initialSetupWizardStorageKey, String(currentStep));
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
                    pmkeys: getWizardCellByHeader(headers, row, 'PMKeyS'),
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
            }).filter((row) => row.surname || row.givenNames || row.unit || row.position || row.qualifications);
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
                ? `Committed ${importedRows.length} uploaded staff profile${importedRows.length === 1 ? '' : 's'} to Staff Profiles in this local test app.`
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
                    pmkeys: getWizardCellByHeader(headers, row, 'PMKeyS'),
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
            }).filter((row) => row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.masterLmp || row.startDate);
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
            const message = `Loaded ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} for ${cleanLmpCode}. Click “Commit uploaded LMP events” to add them to the local test app.`;
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
            setScoringDraft(formatWizardScoringRows(importedRows));
            const message = `Imported ${importedRows.length} scoring matrix row${importedRows.length === 1 ? '' : 's'} into the wizard. Click Next to sync it into the local test app.`;
            setImportConfirmations((current) => ({ ...current, [template.id]: message }));
            setSaveMessage(message);
            return;
        }
        setSaveMessage(`${template.label} passed validation. Import for this template step has not been added yet.`);
    };

    const resetWizard = () => {
        setWizardStep(0);
        setMode('active');
        setUploadResults({});
        if (typeof window !== 'undefined') window.localStorage.setItem(initialSetupWizardStorageKey, '0');
    };

    const resumeWizard = () => {
        setMode('active');
        setWizardStep((step) => Math.min(Math.max(0, step), steps.length - 1));
    };

    const wizardChoiceClass = 'rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900';
    const wizardSmallButtonClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900';
    const wizardPrimaryButtonClass = 'rounded-md bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600';
    const wizardInputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200';
    const wizardLabelClass = 'text-[10px] font-black uppercase tracking-[0.14em] text-slate-500';
    const insertWizardTextAtCursor = (
        field: HTMLInputElement | HTMLTextAreaElement,
        text: string,
        onChange: (value: string) => void,
    ): boolean => {
        if (field.disabled || field.readOnly) return false;
        const currentValue = field.value || '';
        const selectionStart = field.selectionStart ?? currentValue.length;
        const selectionEnd = field.selectionEnd ?? selectionStart;
        const nextValue = `${currentValue.slice(0, selectionStart)}${text}${currentValue.slice(selectionEnd)}`;
        const nextCursor = selectionStart + text.length;
        onChange(nextValue);
        window.requestAnimationFrame(() => {
            field.setSelectionRange(nextCursor, nextCursor);
        });
        return true;
    };
    const insertWizardSpaceAtCursor = (
        event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        onChange: (value: string) => void,
    ): boolean => {
        if (event.key !== ' ' && event.code !== 'Space' && event.key !== 'Spacebar') return false;
        if (event.metaKey || event.ctrlKey || event.altKey) return false;
        event.preventDefault();
        event.stopPropagation();
        return insertWizardTextAtCursor(event.currentTarget, ' ', onChange);
    };
    const handleWizardTextKeyDownCapture = (
        event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        onChange: (value: string) => void,
    ) => {
        if (insertWizardSpaceAtCursor(event, onChange)) return;
    };
    const handleWizardBeforeInput = (
        event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        onChange: (value: string) => void,
    ) => {
        const inputEvent = event.nativeEvent as InputEvent;
        if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        insertWizardTextAtCursor(event.currentTarget, ' ', onChange);
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
                    onBeforeInput={(event) => handleWizardBeforeInput(event, onChange)}
                    onKeyDownCapture={(event) => handleWizardTextKeyDownCapture(event, onChange)}
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
                    onBeforeInput={(event) => handleWizardBeforeInput(event, onChange)}
                    onKeyDownCapture={(event) => handleWizardTextKeyDownCapture(event, onChange)}
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
        addLabel = 'Add position',
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
                            {wizardField('Position', row.role || '', (nextValue) => onChange(updateWizardRoleRequirementText(value, index, 'role', nextValue)), undefined, 'Pilot')}
                            {wizardField('Number', String(row.count ?? 1), (nextValue) => onChange(updateWizardRoleRequirementText(value, index, 'count', nextValue)), undefined, '1')}
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
                    <span className={wizardLabelClass}>Crew labels</span>
                    <button type="button" className={wizardSmallButtonClass} onClick={() => setCrewLabelsDraft(formatWizardCrewLabelRows([...editableRows, { term: 'Crew', label: 'Crew' }]))}>
                        Add label
                    </button>
                </div>
                <div className="space-y-2">
                    {editableRows.map((row, index) => (
                        <div key={`crew-label-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_74px] md:items-end">
                            {wizardField('System term', row.term || '', (nextValue) => {
                                const nextRows = [...editableRows];
                                nextRows[index] = { ...nextRows[index], term: nextValue };
                                setCrewLabelsDraft(formatWizardCrewLabelRows(nextRows));
                            }, undefined, 'PIC')}
                            {wizardField('Display label', row.label || '', (nextValue) => {
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
    const renderStaffEditor = () => {
        const rows = parseWizardStaffRows(staffDraft);
        const editableRows = rows.length > 0 ? rows : [{ surname: '', givenNames: '', unit: unitDraft.code || '', position: '', qualifications: '' }];
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
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            {wizardField('Surname', row.surname || '', (value) => updateStaffRow(index, 'surname', value), undefined, 'Burns')}
                            {wizardField('Given names', row.givenNames || '', (value) => updateStaffRow(index, 'givenNames', value), undefined, 'Alexander')}
                            {wizardDataListField('Unit', row.unit || '', (value) => updateStaffRow(index, 'unit', value.toUpperCase()), unitOptions, unitDraft.code || '36SQN', `staff-unit-${index}`)}
                            {wizardField('Position', row.position || '', (value) => updateStaffRow(index, 'position', value), undefined, 'Pilot')}
                            {wizardField('Qualifications', row.qualifications || '', (value) => updateStaffRow(index, 'qualifications', value), undefined, 'PIC')}
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    className={wizardSmallButtonClass}
                    onClick={() => {
                        setStaffDraft(formatWizardStaffRows([...editableRows, { surname: '', givenNames: '', unit: unitDraft.code || '', position: '', qualifications: '' }]));
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
        const editableRows = rows.length > 0 ? rows : [{ surname: '', givenNames: '', unit: unitDraft.code || '', rank: '', pmkeys: '', courseNumber: '', course: '', masterLmp: '', startDate: '' }];
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
                                    {wizardField(`Course ${index + 1}`, course, (value) => updateCourseOption(index, value), undefined, index === 0 ? 'ADF301' : 'ADF302')}
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
                            {wizardField('Surname', row.surname || '', (value) => updateTraineeRow(index, 'surname', value), undefined, 'Jones')}
                            {wizardField('Given names', row.givenNames || '', (value) => updateTraineeRow(index, 'givenNames', value), undefined, 'Taylor')}
                            {wizardDataListField('Unit', row.unit || '', (value) => updateTraineeRow(index, 'unit', value.toUpperCase()), unitOptions, unitDraft.code || '36SQN', `trainee-unit-${index}`)}
                            {wizardField('Rank', row.rank || '', (value) => updateTraineeRow(index, 'rank', value), undefined, 'PLTOFF')}
                            {wizardField('PMKeyS', row.pmkeys || '', (value) => updateTraineeRow(index, 'pmkeys', value), undefined, '7654321')}
                            {wizardField('Course number', row.courseNumber || '', (value) => updateTraineeRow(index, 'courseNumber', value), undefined, '1')}
                            {wizardDataListField('Master LMP', row.masterLmp || '', (value) => updateTraineeRow(index, 'masterLmp', value), courseOptions, trainingDraft.lmpCode || 'BPC+IPC', `trainee-master-lmp-${index}`)}
                            {wizardField('Start date', row.startDate || '', (value) => updateTraineeRow(index, 'startDate', value), undefined, '2026-01-15')}
                        </div>
                    </div>
                )) : null}
                {mode === 'details' ? <button
                    type="button"
                    className={wizardSmallButtonClass}
                    onClick={() => {
                        setTraineeDraft(formatWizardTraineeRows([...editableRows, { surname: '', givenNames: '', unit: unitDraft.code || '', rank: '', pmkeys: '', courseNumber: '', course: '', masterLmp: '', startDate: '' }]));
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
        const row = rows[0] || { genericName: 'Training Report', organisationName: 'PT-051', gradeMin: '0', gradeMax: '5', showNumbers: 'Yes', demoGrade: 'No', passLabel: 'PASS', failLabel: 'FAIL' };
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
                    {wizardField('Organisation form name', row.organisationName, (value) => updateRow('organisationName', value), undefined, 'PT-051')}
                    {wizardField('Lowest grade', row.gradeMin, (value) => updateRow('gradeMin', value), undefined, '0')}
                    {wizardField('Highest grade', row.gradeMax, (value) => updateRow('gradeMax', value), undefined, '5')}
                    {wizardField('Show grade numbers', row.showNumbers, (value) => updateRow('showNumbers', value), ['Yes', 'No'])}
                    {wizardField('Include DEMO grade', row.demoGrade, (value) => updateRow('demoGrade', value), ['No', 'Yes'])}
                    {wizardField('Pass label', row.passLabel, (value) => updateRow('passLabel', value), undefined, 'PASS')}
                    {wizardField('Fail label', row.failLabel, (value) => updateRow('failLabel', value), undefined, 'FAIL')}
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
            setUnitModulesDraft(formatWizardPipeRows(nextRows, ['module', 'enabled']));
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
        const rows = parseWizardRankRows(rankLabelsDraft);
        const editableRows = rows.length > 0 ? rows : [{ order: '1', ranks: '', notes: '' }];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setRankLabelsDraft(formatWizardRankRows(nextRows));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    Rank order controls how people are sorted in lists. Put the most senior rank at order 1. If more than one service or arm of the military will use this unit, include equivalent ranks on the same line, for example GPCAPT = COL = CAPT.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`rank-row-${index}`} className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 md:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_82px] md:items-end">
                        {wizardField('Order', row.order || String(index + 1), (value) => updateRow(index, 'order', value), undefined, String(index + 1))}
                        {wizardField('Ranks at this level', row.ranks || '', (value) => updateRow(index, 'ranks', value), undefined, 'SQNLDR = MAJ = LCDR')}
                        {wizardField('Notes', row.notes || '', (value) => updateRow(index, 'notes', value), undefined, 'Same seniority across services')}
                        <button type="button" className={wizardSmallButtonClass} onClick={() => setRankLabelsDraft(formatWizardRankRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                            Delete
                        </button>
                    </div>
                ))}
                <button type="button" className={wizardSmallButtonClass} onClick={() => setRankLabelsDraft(formatWizardRankRows([...editableRows, { order: String(editableRows.length + 1), ranks: '', notes: '' }]))}>
                    Add rank level
                </button>
            </div>
        );
    };
    const renderSharingEditor = () => {
        const rows = parseWizardSharingRows(resourceSharingDraft);
        const editableRows = rows.length > 0 ? rows : [
            { type: 'Resource sharing', enabled: 'Off', units: '', consequence: 'Unit keeps its own aircraft and resource pool capacity.' },
            { type: 'Staff sharing', enabled: 'Off', units: '', consequence: 'Unit only schedules its own staff unless changed later.' },
        ];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setResourceSharingDraft(formatWizardSharingRows(nextRows));
        };
        const unitOptions = parseWizardUnitRows(unitsTodayDraft).map((unit) => unit.code);
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    Resource sharing lets this unit use another unit's aircraft, simulators, trainers or ground lines. Staff sharing lets this unit schedule people from another unit. Turning either on can increase scheduling flexibility, but it also means conflicts and availability must be managed across units.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`sharing-row-${index}`} className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 md:grid-cols-[170px_120px_minmax(0,1fr)]">
                        {wizardField('Sharing type', row.type || '', (value) => updateRow(index, 'type', value), ['Resource sharing', 'Staff sharing'])}
                        {wizardField('Enabled', row.enabled || 'Off', (value) => updateRow(index, 'enabled', value), ['Off', 'On'])}
                        {wizardDataListField('Shared with units', row.units || '', (value) => updateRow(index, 'units', value.toUpperCase()), unitOptions, '6SQN, 35SQN', `sharing-units-${index}`)}
                        <div className="md:col-span-3">
                            {wizardField('Consequence / plain English note', row.consequence || '', (value) => updateRow(index, 'consequence', value), undefined, 'Unit can borrow aircraft capacity from listed units.')}
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
            setCurrencyDraft(formatWizardCurrencyRows(nextRows));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    A currency profile is a reusable request preset. It fills in the crew, aircraft configuration, currency type and aircraft count when someone requests a currency event.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`currency-row-${index}`} className="grid gap-3 rounded-lg border border-slate-300 bg-white p-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_110px_minmax(0,1fr)_90px_82px] xl:items-end">
                        {wizardField('Profile name', row.name || '', (value) => updateRow(index, 'name', value), undefined, 'PIC Currency')}
                        {wizardField('Code', row.code || '', (value) => updateRow(index, 'code', value.toUpperCase()), undefined, 'PIC')}
                        {wizardField('Crew', row.crew || '', (value) => updateRow(index, 'crew', value), undefined, 'Standard crew')}
                        {wizardField('CONFIG', row.config || 'ANY', (value) => updateRow(index, 'config', value), undefined, 'ANY')}
                        {wizardField('Currency', row.currency || '', (value) => updateRow(index, 'currency', value), undefined, 'PIC Currency')}
                        {wizardField('No. aircraft', row.aircraftCount || '1', (value) => updateRow(index, 'aircraftCount', value), undefined, '1')}
                        <button type="button" className={wizardSmallButtonClass} onClick={() => setCurrencyDraft(formatWizardCurrencyRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                            Delete
                        </button>
                    </div>
                ))}
                <button type="button" className={wizardSmallButtonClass} onClick={() => setCurrencyDraft(formatWizardCurrencyRows([...editableRows, { name: '', code: '', crew: '', config: 'ANY', currency: '', aircraftCount: '1' }]))}>
                    Add currency
                </button>
            </div>
        );
    };
    const renderScoringEditor = () => {
        const rows = parseWizardScoringRows(scoringDraft);
        const editableRows = rows.length > 0 ? rows : [{ dimension: '', passStandard: '', failStandard: '', grade0: '', grade1: '', grade2: '', grade3: '', grade4: '', grade5: '' }];
        const updateRow = (index: number, field: keyof typeof editableRows[number], value: string) => {
            const nextRows = [...editableRows];
            nextRows[index] = { ...nextRows[index], [field]: value };
            setScoringDraft(formatWizardScoringRows(nextRows));
        };
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900">
                    The scoring matrix defines what each training report grade means. In practice, instructors use these words to explain why a trainee passed, failed, or needs more training.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`scoring-row-${index}`} className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_82px] md:items-end">
                            {wizardField('Assessment area', row.dimension || '', (value) => updateRow(index, 'dimension', value), undefined, 'Preparation')}
                            {wizardField('Pass standard', row.passStandard || '', (value) => updateRow(index, 'passStandard', value), undefined, 'Prepared, safe and ready.')}
                            {wizardField('Fail standard', row.failStandard || '', (value) => updateRow(index, 'failStandard', value), undefined, 'Unsafe or not prepared.')}
                            <button type="button" className={wizardSmallButtonClass} onClick={() => setScoringDraft(formatWizardScoringRows(editableRows.filter((_, rowIndex) => rowIndex !== index)))}>
                                Delete
                            </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                            {(['grade0', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5'] as const).map((field, gradeIndex) => (
                                wizardField(`Grade ${gradeIndex}`, row[field] || '', (value) => updateRow(index, field, value), undefined, gradeIndex === 0 ? 'Unsafe' : gradeIndex < 3 ? 'Needs help' : 'Meets standard')
                            ))}
                        </div>
                    </div>
                ))}
                <button type="button" className={wizardSmallButtonClass} onClick={() => setScoringDraft(formatWizardScoringRows([...editableRows, { dimension: '', passStandard: '', failStandard: '', grade0: '', grade1: '', grade2: '', grade3: '', grade4: '', grade5: '' }]))}>
                    Add assessment area
                </button>
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
                    Standard staff currency events are reusable event templates. They save time later by pre-filling duration, resource type, crew, currency and aircraft configuration for common staff currency checks.
                </div>
                {editableRows.map((row, index) => (
                    <div key={`standard-currency-event-${index}`} className="space-y-3 rounded-lg border border-slate-300 bg-white p-3">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_120px_140px_90px_90px_90px] xl:items-end">
                            {wizardField('Event name', row.name || '', (value) => updateRow(index, 'name', value), undefined, 'Annual Instrument Check')}
                            {wizardField('Short title', row.shortTitle || '', (value) => updateRow(index, 'shortTitle', value.toUpperCase()), undefined, 'INST')}
                            {wizardField('Resource type', row.resourceType || 'Flight', (value) => updateRow(index, 'resourceType', value), ['Flight', 'FTD', 'CPT', 'Ground'])}
                            {wizardField('Duration', row.duration || '90', (value) => updateRow(index, 'duration', value), undefined, '90')}
                            {wizardField('Pre-flight', row.preFlight || '90', (value) => updateRow(index, 'preFlight', value), undefined, '90')}
                            {wizardField('Post-flight', row.postFlight || '60', (value) => updateRow(index, 'postFlight', value), undefined, '60')}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_90px_82px] xl:items-end">
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
                className={`${wizardInputClass} mt-1 min-h-[84px] resize-y`}
                value={value}
                placeholder={placeholder}
                autoFocus={autoFocus}
                onBeforeInput={(event) => handleWizardBeforeInput(event, onChange)}
                onKeyDownCapture={(event) => handleWizardTextKeyDownCapture(event, onChange)}
                onKeyDown={stopEditableKeyPropagation}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
    const goToNextWizardStep = () => {
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
            const hasTraineesToCommit = traineeRows.some((row) => row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate);
            const missingCourseCount = traineeRows.filter((row) => (
                row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate
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
        if (isSetupTestMode) {
            saveSetupTestWizardDrafts(false);
        }
        setWizardStep(Math.min(steps.length - 1, currentStep + 1));
    };
    const goToWizardStep = (nextStep: number) => {
        const boundedStep = Math.min(steps.length - 1, Math.max(0, nextStep));
        if (isSetupTestMode) {
            saveSetupTestWizardDrafts(false);
        }
        setWizardStep(boundedStep);
    };
    const promptShell = (question: React.ReactNode, answer: React.ReactNode, actionLabel = 'Next', saveAction?: () => void) => (
        <div
            key={visibleStep.id}
            className="animate-[neoWizardIn_220ms_ease-out] rounded-xl border border-slate-300 bg-slate-50 p-5 text-slate-900 shadow-sm"
            onKeyDownCapture={stopEditableKeyPropagation}
            onKeyDown={stopEditableKeyPropagation}
        >
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Step {currentStep + 1} of {steps.length}</p>
                    <h4 className="mt-1 text-xl font-bold text-slate-950">{visibleStep.title}</h4>
                    <div className="mt-3 text-sm leading-6 text-slate-700">{question}</div>
                </div>
                <label className="block w-full lg:w-[320px]">
                    <span className={wizardLabelClass}>Go to wizard page</span>
                    <select
                        className={`${wizardInputClass} mt-1 bg-white text-slate-950`}
                        value={currentStep}
                        onChange={(event) => goToWizardStep(Number(event.target.value))}
                        onKeyDown={stopEditableKeyPropagation}
                    >
                        {steps.map((step, index) => (
                            <option key={`wizard-page-${step.id}`} value={index}>
                                {index + 1}. {step.title}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div
                className="rounded-xl border border-slate-300 bg-white/80 p-4 shadow-sm"
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
    const organisationPreviewLevels = [
        { name: organisationDraft.level0Name || 'Organisation', options: fromLines(organisationDraft.level0Options || organisationDraft.name || organisationDraft.code) },
        { name: organisationDraft.level1Name || 'Level 1', options: fromLines(organisationDraft.level1Options) },
        { name: organisationDraft.level2Name || 'Level 2', options: fromLines(organisationDraft.level2Options) },
        { name: organisationDraft.level3Name || 'Level 3', options: fromLines(organisationDraft.level3Options) },
    ].filter((level, index) => index === 0 || level.options.length > 0 || String(level.name || '').trim());
    const organisationRootLabel = fromLines(organisationDraft.level0Options)[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
    const level1ParentOptions = [organisationRootLabel].filter(Boolean);
    const level2ParentOptions = fromLines(organisationDraft.level1Options);
    const level3ParentOptions = fromLines(organisationDraft.level2Options);
    const level1ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level1Options), organisationDraft.level1Parents, level1ParentOptions);
    const level2ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level2Options), organisationDraft.level2Parents, level2ParentOptions);
    const level3ParentRows = buildWizardParentRowsForChildren(fromLines(organisationDraft.level3Options), organisationDraft.level3Parents, level3ParentOptions);
    const organisationPreviewLinks = [
        ...buildWizardRelationshipPaths(
            organisationRootLabel,
            level1ParentRows,
            level2ParentRows,
            level3ParentRows,
        ),
    ];
    const renderOrganisationPreview = () => (
        <div className="mt-4 rounded-xl border border-slate-300 bg-slate-950 p-4 text-white shadow-inner">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Organisation tree preview</p>
                <p className="text-[10px] font-semibold text-slate-400">This builds live as you type.</p>
            </div>
            <div className="space-y-4 overflow-x-auto pb-1">
                {organisationPreviewLevels.map((level, levelIndex) => {
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
        levelNumber: 1 | 2 | 3,
        levelName: string,
        levelOptions: string,
        parentMappings: string,
        onNameChange: (value: string) => void,
        onOptionsChange: (value: string) => void,
        onParentMappingsChange: (value: string) => void,
        placeholder: string,
        parentOptions: string[],
    ) => (
        <div>
            <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                {wizardField(`Level ${levelNumber} type`, levelName, onNameChange, undefined, levelNumber === 1 ? 'Branch / HQ' : levelNumber === 2 ? 'Command' : 'Numbered Air Force')}
                {wizardTextArea(`${levelName || `Level ${levelNumber}`} names`, levelOptions, onOptionsChange, placeholder, true)}
                <div className="md:col-span-2">
                    <div>
                        <span className={wizardLabelClass}>Parents for this level</span>
                        <div className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white">
                            {fromLines(levelOptions).length > 0 && parentOptions.length > 0 ? (
                                <div className="divide-y divide-slate-200">
                                    {fromLines(levelOptions).map((child) => {
                                        const currentParent = buildWizardParentRowsForChildren([child], parentMappings, parentOptions)[0]?.parent || '';
                                        return (
                                            <div key={`${levelNumber}-${child}`} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(130px,220px)_minmax(180px,340px)] md:items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Child</p>
                                                    <p className="mt-1 text-sm font-bold text-slate-950">{child}</p>
                                                </div>
                                                <label className="block">
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
                The names box lists the organisations on this level. The parent selector tells DFP-NEO where each one sits, so the organisation diagram can build the correct tree.
            </p>
            {renderOrganisationPreview()}
        </div>
    );
    const buildSetupTestOrganisationStructure = (unitRows: ReturnType<typeof parseWizardUnitRows>) => {
        const rootLabel = fromLines(organisationDraft.level0Options)[0] || organisationDraft.name || organisationDraft.code || 'Organisation';
        const level1Options = fromLines(organisationDraft.level1Options);
        const level2Options = fromLines(organisationDraft.level2Options);
        const level3Options = fromLines(organisationDraft.level3Options);
        const level1Rows = buildWizardParentRowsForChildren(level1Options, organisationDraft.level1Parents, [rootLabel]);
        const level2Rows = buildWizardParentRowsForChildren(level2Options, organisationDraft.level2Parents, level1Options);
        const level3Rows = buildWizardParentRowsForChildren(level3Options, organisationDraft.level3Parents, level2Options);
        const relationshipPaths = buildWizardRelationshipPaths(rootLabel, level1Rows, level2Rows, level3Rows);
        const unitParentOptions = getWizardUnitParentPathOptions();
        const fallbackUnitParentPath = (unitParentOptions[0] || relationshipPaths[0] || [rootLabel]).filter(Boolean);
        const unitParentPathByCode = getWizardUnitParentPathMap();
        const unitCodes = unitRows.map((row) => row.code).filter(Boolean);
        const unitParentPaths = unitCodes.reduce((map, code) => {
            const configuredPath = unitParentPathByCode.get(normaliseUnitSettingsIdentifier(code));
            const parentPath = configuredPath && configuredPath.length > 0 ? configuredPath : fallbackUnitParentPath;
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
            {
                ...(levelDraftSource(0) || {}),
                levelIndex: 0,
                name: organisationDraft.level0Name,
                options: [rootLabel],
                childrenByParent: {},
                parentByChild: {},
            },
            {
                ...(levelDraftSource(1) || {}),
                levelIndex: 1,
                name: organisationDraft.level1Name,
                options: level1Options,
                ...buildWizardParentMaps(level1Rows),
            },
            {
                ...(levelDraftSource(2) || {}),
                levelIndex: 2,
                name: organisationDraft.level2Name,
                options: level2Options,
                ...buildWizardParentMaps(level2Rows),
            },
            {
                ...(levelDraftSource(3) || {}),
                levelIndex: 3,
                name: organisationDraft.level3Name,
                options: level3Options,
                ...buildWizardParentMaps(level3Rows),
            },
            {
                levelIndex: 4,
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
        const qualificationsToFlags = (qualifications: string) => {
            const tokens = qualifications
                .split(/[,\s/]+/)
                .map((token) => token.trim().toUpperCase())
                .filter(Boolean);
            return {
                isQFI: tokens.includes('QFI') || tokens.includes('CFI') || tokens.includes('OFI'),
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
                idNumber: Number(row.pmkeys) || 900000 + index + 1,
                name: fullName,
                rank: row.rank || 'SQNLDR',
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
                    idNumber: Number(row.pmkeys) || 800000 + index + 1,
                    fullName,
                    name: fullName,
                    rank: row.rank || 'PLTOFF',
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
        const locationRowsAreOldDefault = rawLocationRows.length === 1
            && normaliseUnitSettingsIdentifier(rawLocationRows[0]?.icao) === 'YAMB'
            && activeWizardLocationCode
            && normaliseUnitSettingsIdentifier(activeWizardLocationCode) !== 'YAMB'
            && activeLocations.length === 0;
        const locationRows = locationRowsAreOldDefault ? [activeWizardLocationRow] : rawLocationRows;
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
        const primaryLocationCode = cleanLocations[0]?.icao || locationDraft.code || '';
        const primaryAircraftCode = String(resourceDraft.aircraftCode || crewDraft.aircraftCode || 'Aircraft').trim().toUpperCase();
        const crewSeats = parseRoleRequirementsText(crewDraft.standardSeats);
        const alternateCrewRows = parseWizardLineItems(alternateCrewDraft).map((line, index) => {
            const [namePart, requirementsPart] = line.split('=').map((part) => part.trim());
            return {
                id: createSetupTestRecordId('alternate-crew', namePart || index + 1),
                code: `ALT${index + 1}`,
                unitCode: cleanUnits[0]?.code || '',
                aircraftTypeCode: primaryAircraftCode,
                name: namePart || `Alternate crew ${index + 1}`,
                description: '',
                operationalModels: ['air_combat', 'fixed_crew', 'pooled_crew'],
                roleRequirements: parseRoleRequirementsText(requirementsPart || ''),
                status: 'ACTIVE',
            };
        });
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
        const rankOrder = parseWizardRankRows(rankLabelsDraft)
            .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999))
            .map((row) => row.ranks)
            .filter(Boolean);
        const sharingRows = parseWizardSharingRows(resourceSharingDraft);
        const resourceSharingRows = sharingRows.filter((row) => row.type.toLowerCase().includes('resource'));
        const staffSharingRows = sharingRows.filter((row) => row.type.toLowerCase().includes('staff'));
        const trainingReportRow = parseWizardTrainingReportRows(trainingRecordsDraft)[0];
        const scoringRows = parseWizardScoringRows(scoringDraft);
        const trainingReportPhraseBank = scoringRows.reduce((bank, row) => ({
            ...bank,
            [row.dimension || 'Assessment']: {
                0: [row.grade0 || row.failStandard].filter(Boolean),
                1: [row.grade1].filter(Boolean),
                2: [row.grade2].filter(Boolean),
                3: [row.grade3 || row.passStandard].filter(Boolean),
                4: [row.grade4].filter(Boolean),
                5: [row.grade5].filter(Boolean),
            },
        }), {} as Record<string, any>);
        const setupPersonnel = buildSetupTestPersonnel(cleanUnits, overrides);

        onUpdatePlatformConfig((baseConfig: any) => {
            const existingOrganisation = Array.isArray(baseConfig?.organisations) ? baseConfig.organisations[0] : null;
            const existingOrganisationSettings = existingOrganisation?.settings || {};
            const existingMasterLmpCatalogue = Array.isArray(existingOrganisationSettings.masterLmpCatalogue)
                ? existingOrganisationSettings.masterLmpCatalogue
                : [];
            const existingMasterLmpAccess = Array.isArray(existingOrganisationSettings.masterLmpAccess)
                ? existingOrganisationSettings.masterLmpAccess
                : [];
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
                    timezone: profile?.timezone || locationDraft.timezone || 'Australia/Brisbane',
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
                unitType: index === 0 ? effectiveUnitDraft.unitType || 'Operational' : 'Operational',
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
                            passLabel: trainingReportRow.passLabel || 'PASS',
                            failLabel: trainingReportRow.failLabel || 'FAIL',
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
                    standardMissionProfiles: { profiles: standardMissionProfiles },
                    personnelDisplaySettings: {
                        staffRankOrder: rankOrder,
                        traineeRankOrder: rankOrder,
                        useSeparateTraineeRankOrder: false,
                    },
                    fleetSharingEnabled: resourceSharingRows.some((row) => /^on$/i.test(row.enabled)),
                    resourceSharingGroups: resourceSharingRows.map((row, index) => ({
                        id: createSetupTestRecordId('resource-sharing', row.units || index + 1),
                        name: row.type || `Resource sharing ${index + 1}`,
                        selectedUnits: row.units.split(',').map((item) => item.trim()).filter(Boolean),
                        status: 'ACTIVE',
                    })),
                    staffSharingEnabled: staffSharingRows.some((row) => /^on$/i.test(row.enabled)),
                    staffSharingGroups: staffSharingRows.map((row, index) => ({
                        id: createSetupTestRecordId('staff-sharing', row.units || index + 1),
                        name: row.type || `Staff sharing ${index + 1}`,
                        selectedUnits: row.units.split(',').map((item) => item.trim()).filter(Boolean),
                        status: 'ACTIVE',
                    })),
                    initialSetupWizardDraft: {
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
                        resourceSharing: resourceSharingDraft,
                        currencies: currencyDraft,
                        scoringMatrix: scoringDraft,
                        staffCurrencyEvents: staffCurrencyEventsDraft,
                    },
                },
            };
            return {
                organisations: [organisation],
                locations: nextLocations,
                units: nextUnits,
                aircraftTypes: [{
                    id: createSetupTestRecordId('aircraft-type', primaryAircraftCode),
                    code: primaryAircraftCode,
                    name: resourceDraft.aircraftName || primaryAircraftCode,
                    category: 'Other',
                    status: 'ACTIVE',
                    crewComposition: {
                        ...normaliseAircraftCrewComposition(null),
                        standardSeats: crewSeats,
                    },
                }],
                resourcePools: [{
                    id: createSetupTestRecordId('resource-pool', `${primaryAircraftCode}-${resourceDraft.poolLocationCode || primaryLocationCode}-${resourceDraft.poolUnitCode || cleanUnits[0]?.code || ''}`),
                    code: 'RESOURCE-POOL-1',
                    name: resourceDraft.poolName || `${primaryAircraftCode} Resource Pool`,
                    organisationCode: organisation.code,
                    locationCode: resourceDraft.poolLocationCode || primaryLocationCode,
                    unitCode: resourceDraft.poolUnitCode || cleanUnits[0]?.code || '',
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
                }],
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
                    maxEventsPerDay: parseNumberDraft(buildRulesDraft.maxEventsPerDay, 0),
                    maxFlightsPerDay: parseNumberDraft(buildRulesDraft.maxFlightsPerDay, 0),
                    minGapBetweenEventsMinutes: parseNumberDraft(buildRulesDraft.minGapBetweenEventsMinutes, 0),
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
            window.localStorage.setItem(initialSetupWizardStorageKey, String(steps.length - 1));
        }
        setSaveMessage(markComplete
            ? 'Setup saved into this local test app only. The real DFP-NEO app and database were not touched.'
            : 'This step has been synced into the local test Settings. The real DFP-NEO app and database were not touched.'
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
                        timezone: existingIndex >= 0 ? nextLocations[existingIndex].timezone || 'Australia/Brisbane' : 'Australia/Brisbane',
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
        saveTrainingDraft();
        saveAccessDraft();
        saveWizardConfig('Setup saved into Settings.', (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => ({
            ...settings,
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
                resourceSharing: resourceSharingDraft,
                currencies: currencyDraft,
                scoringMatrix: scoringDraft,
                staffCurrencyEvents: staffCurrencyEventsDraft,
            },
        })));
        setSaveMessage('Setup saved into Settings.');
    };
    const commitWizardStaffProfiles = () => {
        const staffRows = uploadedStaffProfileRows.length > 0 ? uploadedStaffProfileRows : undefined;
        const staffCount = (staffRows || parseWizardStaffRows(staffDraft)).filter((row) => (
            row.surname || row.givenNames || row.unit || row.position || row.qualifications
        )).length;
        saveSetupTestWizardDrafts(false, { staffDraft, staffRows });
        const message = `Committed ${staffCount} staff profile${staffCount === 1 ? '' : 's'} to Staff Profiles in this local test app.`;
        setImportConfirmations((current) => ({ ...current, staff: message }));
        setSaveMessage(message);
    };
    const commitWizardTraineeProfiles = () => {
        const traineeRows = uploadedTraineeProfileRows.length > 0 ? uploadedTraineeProfileRows : undefined;
        const rowsToCommit = traineeRows || parseWizardTraineeRows(traineeDraft);
        const validCourses = new Set(parseWizardLineItems(traineeCourseOptionsDraft).map((course) => course.toUpperCase()));
        const missingCourseCount = rowsToCommit.filter((row) => (
            row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate
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
            row.surname || row.givenNames || row.unit || row.rank || row.pmkeys || row.courseNumber || row.course || row.masterLmp || row.startDate
        )).length;
        const nextUnitDraft = { ...unitDraft, hasTrainees: true };
        setUnitDraft(nextUnitDraft);
        saveSetupTestWizardDrafts(false, { traineeDraft, traineeRows, unitDraft: nextUnitDraft });
        const message = `Committed ${traineeCount} trainee profile${traineeCount === 1 ? '' : 's'} to the trainee list in this local test app.`;
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
                setSaveMessage('The uploaded LMP was valid, but no importable event rows were available to commit. Check the LMP diagnostics for parsed row details.');
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
        saveWizardConfig(`Committed ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} to this local test app.`, (baseConfig) => updatePrimaryOrganisationWithSettings(baseConfig, (settings) => {
            const catalogue = Array.isArray(settings.masterLmpCatalogue) ? settings.masterLmpCatalogue : [];
            const accessRules = Array.isArray(settings.masterLmpAccess) ? settings.masterLmpAccess : [];
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
                accessRules: (beforeOrganisation?.settings?.masterLmpAccess || []).map((rule: any) => ({
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
                const accessRules = Array.isArray(settings.masterLmpAccess) ? settings.masterLmpAccess : [];
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
        const message = `Committed ${scopedItems.length} LMP event${scopedItems.length === 1 ? '' : 's'} for ${cleanLmpCode} to this local test app.`;
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
                    {wizardField('Organisation name', organisationDraft.name, (value) => setOrganisationDraft((draft) => ({
                        ...draft,
                        name: value,
                        code: draft.code || value,
                        level0Name: value || draft.level0Name,
                        level0Options: value || draft.level0Options,
                    })), undefined, 'RAAF')}
                    {wizardField('Short code', organisationDraft.code, (value) => setOrganisationDraft((draft) => ({ ...draft, code: value })), undefined, 'RAAF')}
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
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level1Name: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level1Options: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level1Parents: value })),
                    'Air Command',
                    level1ParentOptions,
                ),
            );
        }
        if (visibleStep.id === 'org-level2') {
            return promptShell(
                <p>This layer sits underneath <strong>{organisationDraft.level1Name || 'Level 1'}</strong>. Use it for the organisations that own or manage several lower groups. Example: Air Combat Group, Air Mobility Group, Training Group.</p>,
                organisationLevelAnswer(
                    2,
                    organisationDraft.level2Name,
                    organisationDraft.level2Options,
                    organisationDraft.level2Parents,
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level2Name: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level2Options: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level2Parents: value })),
                    'Air Combat Group\nAir Mobility Group',
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
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level3Name: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level3Options: value })),
                    (value) => setOrganisationDraft((draft) => ({ ...draft, level3Parents: value })),
                    '78WG\n81WG\n82WG\n84WG',
                    level3ParentOptions,
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
                    {wizardTextArea('Units to set up today', unitsTodayDraft, setUnitsTodayDraft, '36SQN | 36SQN\n12SQN | 12SQN', true)}
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className={wizardLabelClass}>Parent organisation for each unit</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            Choose where each unit sits in the organisation tree. For example, 36SQN might sit under RAAF / Air Command / Air Mobility Group / 84WG.
                        </p>
                        {unitRows.length > 0 && unitParentOptions.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {unitRows.map((row) => {
                                    const currentParentPath = unitParentMap.get(normaliseUnitSettingsIdentifier(row.code)) || unitParentOptions[0];
                                    const currentParentValue = formatWizardOrganisationPath(currentParentPath);
                                    return (
                                        <div key={`unit-parent-${row.code}`} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
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
                                                        return <option key={`${row.code}-${value}`} value={value}>{value}</option>;
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
                        The wizard will use the first unit as the detailed example, then the same setup questions apply to every other unit you listed.
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
                            <div key={`wizard-location-row-${rowIndex}`} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(120px,0.4fr)_minmax(100px,0.35fr)_minmax(180px,1fr)]">
                                {wizardDataListField('ICAO code', row.icao, (value) => updateWizardLocationRow(rowIndex, 'icao', value), wizardLocationIcaoOptions, 'YMES', `icao-${rowIndex}`)}
                                {wizardDataListField('IATA code', row.iata, (value) => updateWizardLocationRow(rowIndex, 'iata', value), wizardLocationIataOptions, 'ESL', `iata-${rowIndex}`)}
                                {wizardDataListField('Location name', row.name, (value) => updateWizardLocationRow(rowIndex, 'name', value), wizardLocationNameOptions, 'East Sale', `location-name-${rowIndex}`)}
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
                        ICAO is the four-letter aviation code, for example YMES. IATA is the shorter three-letter code, for example ESL. Start typing a known code or location name to see matching suggestions.
                    </p>
                </div>,
            );
        }
        if (visibleStep.id === 'location-code') {
            return promptShell(
                <p>Next we will set up the first base or operating location. What is the location code?</p>,
                wizardField('Location code', locationDraft.code, (value) => setLocationDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, 'YAMB'),
            );
        }
        if (visibleStep.id === 'location-details') {
            return promptShell(
                <p>Confirm the details for the first locality. You will use the same pattern for every locality listed earlier.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardDataListField('ICAO code', locationDraft.code, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        setLocationDraft((draft) => ({ ...draft, code: value.toUpperCase(), iataCode: matchedProfile?.iata || draft.iataCode, name: matchedProfile?.name || draft.name, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationIcaoOptions, 'YMES')}
                    {wizardDataListField('IATA code', locationDraft.iataCode, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        setLocationDraft((draft) => ({ ...draft, iataCode: value.toUpperCase(), code: matchedProfile?.icao || draft.code, name: matchedProfile?.name || draft.name, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationIataOptions, 'ESL')}
                    {wizardDataListField('Location name', locationDraft.name, (value) => {
                        const matchedProfile = findWizardLocationProfile(value);
                        setLocationDraft((draft) => ({ ...draft, name: value, code: matchedProfile?.icao || draft.code, iataCode: matchedProfile?.iata || draft.iataCode, timezone: matchedProfile?.timezone || draft.timezone }));
                    }, wizardLocationNameOptions, 'Amberley')}
                    {wizardField('Timezone', locationDraft.timezone, (value) => setLocationDraft((draft) => ({ ...draft, timezone: value })), undefined, 'Australia/Brisbane')}
                    {wizardField('Training areas', locationDraft.trainingAreas, (value) => setLocationDraft((draft) => ({ ...draft, trainingAreas: value })), undefined, 'Area A, Area B')}
                </div>,
            );
        }
        if (visibleStep.id === 'unit-code') {
            return promptShell(
                <p>Now we will set up the first unit using the app. What is the unit code and name?</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Unit code', unitDraft.code, (value) => setUnitDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, '36SQN')}
                    {wizardField('Unit name', unitDraft.name, (value) => setUnitDraft((draft) => ({ ...draft, name: value })), undefined, '36SQN')}
                </div>,
            );
        }
        if (visibleStep.id === 'unit-model') {
            return promptShell(
                <p>Set the identity and operating model for the first unit. The operating model is important because it controls which scheduler logic applies.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('Unit code', unitDraft.code, (value) => setUnitDraft((draft) => ({ ...draft, code: value.toUpperCase() })), undefined, '36SQN')}
                    {wizardField('Unit name', unitDraft.name, (value) => setUnitDraft((draft) => ({ ...draft, name: value })), undefined, '36SQN')}
                    {wizardDataListField('Home location', unitDraft.locationCode, (value) => setUnitDraft((draft) => ({ ...draft, locationCode: value.toUpperCase() })), wizardLocationIcaoOptions, 'YAMB')}
                    {wizardField('Unit type', unitDraft.unitType, (value) => setUnitDraft((draft) => ({ ...draft, unitType: value })), ['Training', 'Fighter', 'Airlift', 'Maritime', 'HQ', 'Operational'])}
                    {wizardField(
                        'Operational model',
                        getWizardOperationalModelLabel(unitDraft.operationalModel),
                        (label) => {
                            const selected = OPERATIONAL_MODEL_OPTIONS.find((option) => option.label === label);
                            setUnitDraft((draft) => ({ ...draft, operationalModel: selected?.value || draft.operationalModel }));
                        },
                        OPERATIONAL_MODEL_OPTIONS.map((option) => option.label)
                    )}
                    <label className="block">
                        <span className={wizardLabelClass}>Does this unit use trainees?</span>
                        <button
                            type="button"
                            className={`${wizardInputClass} mt-1 text-left ${unitDraft.hasTrainees ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}
                            onClick={() => setUnitDraft((draft) => ({ ...draft, hasTrainees: !draft.hasTrainees }))}
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
                    {wizardField('Aircraft type code', resourceDraft.aircraftCode, (value) => setResourceDraft((draft) => ({ ...draft, aircraftCode: value.toUpperCase(), aircraftName: draft.aircraftName || value })), undefined, 'C-17A')}
                    {wizardField('Aircraft type name', resourceDraft.aircraftName, (value) => setResourceDraft((draft) => ({ ...draft, aircraftName: value })), undefined, 'C-17A')}
                    {wizardField('Resource pool name', resourceDraft.poolName, (value) => setResourceDraft((draft) => ({ ...draft, poolName: value })), undefined, 'Amberley C-17A Resource Pool')}
                </div>,
            );
        }
        if (visibleStep.id === 'resource-counts') {
            return promptShell(
                <p>Enter how many rows this unit can use on the schedule. These numbers tell NEO what it can place on the flying program.</p>,
                <div className="grid gap-3 md:grid-cols-5">
                    {wizardField('Aircraft', resourceDraft.aircraft, (value) => setResourceDraft((draft) => ({ ...draft, aircraft: value })))}
                    {wizardField('Sim', resourceDraft.sim, (value) => setResourceDraft((draft) => ({ ...draft, sim: value })))}
                    {wizardField('Trainer', resourceDraft.trainer, (value) => setResourceDraft((draft) => ({ ...draft, trainer: value })))}
                    {wizardField('Standby Lines', resourceDraft.standby, (value) => setResourceDraft((draft) => ({ ...draft, standby: value })))}
                    {wizardField('Ground Lines', resourceDraft.ground, (value) => setResourceDraft((draft) => ({ ...draft, ground: value })))}
                </div>,
            );
        }
        if (visibleStep.id === 'crew') {
            return promptShell(
                <p>Tell NEO what normal crew looks like. This prevents the scheduler from creating unrealistic solo or under-crewed events.</p>,
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        {wizardDataListField('Aircraft type', crewDraft.aircraftCode || resourceDraft.aircraftCode, (value) => setCrewDraft((draft) => ({ ...draft, aircraftCode: value.toUpperCase() })), Array.from(new Set([resourceDraft.aircraftCode, ...activeAircraftTypes.map((aircraft: any) => aircraft.code)].filter(Boolean))), resourceDraft.aircraftCode || 'C-17A')}
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                        {renderCrewCompositionEditor('Standard crew composition', crewDraft.standardSeats, (value) => setCrewDraft((draft) => ({ ...draft, standardSeats: value })))}
                        {renderCrewCompositionEditor('Alternate crew composition', alternateCrewDraft, setAlternateCrewDraft, 'Add alternate position')}
                    </div>
                    {renderCrewLabelsEditor()}
                </div>,
            );
        }
        if (visibleStep.id === 'build-rules') {
            return promptShell(
                <p>Set the main limits NEO must follow when it builds this unit schedule. If you are unsure, leave the default values and refine them later in Settings.</p>,
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Business rules</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {wizardField('Rule set', buildRulesDraft.businessRules, (value) => setBuildRulesDraft((draft) => ({ ...draft, businessRules: value })), undefined, 'Use default')}
                            {wizardField('Max dispatch per hour', buildRulesDraft.maxDispatchPerHour, (value) => setBuildRulesDraft((draft) => ({ ...draft, maxDispatchPerHour: value })), undefined, '2')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Duty limits</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {wizardField('Maximum crew duty hours', buildRulesDraft.maxCrewDutyHours, (value) => setBuildRulesDraft((draft) => ({ ...draft, maxCrewDutyHours: value })), undefined, '12')}
                            {wizardField('Preferred duty period hours', buildRulesDraft.preferredDutyHours, (value) => setBuildRulesDraft((draft) => ({ ...draft, preferredDutyHours: value })), undefined, '10')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Turnaround times</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3 md:items-end">
                            {wizardField('Aircraft turnaround minutes', buildRulesDraft.aircraftTurnaroundMinutes, (value) => setBuildRulesDraft((draft) => ({ ...draft, aircraftTurnaroundMinutes: value })), undefined, '60')}
                            {wizardField('Simulator turnaround minutes', buildRulesDraft.simTurnaroundMinutes, (value) => setBuildRulesDraft((draft) => ({ ...draft, simTurnaroundMinutes: value })), undefined, '30')}
                            {wizardField('Trainer turnaround minutes', buildRulesDraft.trainerTurnaroundMinutes, (value) => setBuildRulesDraft((draft) => ({ ...draft, trainerTurnaroundMinutes: value })), undefined, '30')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                        <p className={wizardLabelClass}>Event limits</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            {wizardField('Maximum events per day', buildRulesDraft.maxEventsPerDay, (value) => setBuildRulesDraft((draft) => ({ ...draft, maxEventsPerDay: value })), undefined, 'Optional')}
                            {wizardField('Maximum flights per day', buildRulesDraft.maxFlightsPerDay, (value) => setBuildRulesDraft((draft) => ({ ...draft, maxFlightsPerDay: value })), undefined, 'Optional')}
                            {wizardField('Min Gap between events minutes', buildRulesDraft.minGapBetweenEventsMinutes, (value) => setBuildRulesDraft((draft) => ({ ...draft, minGapBetweenEventsMinutes: value })), undefined, '0')}
                        </div>
                    </div>
                </div>,
            );
        }
        if (visibleStep.id === 'staff') {
            return promptShell(
                <p>Add the staff this unit needs for scheduling, permissions, and records. Put each person into their own row, then commit the list to Staff Profiles.</p>,
                <div>
                    {renderStaffEditor()}
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold leading-5 text-emerald-900">
                            This writes the staff shown above into the local test app Staff Profiles. It does not touch the real DFP-NEO database.
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
                        onClick={() => setUnitDraft((draft) => ({ ...draft, hasTrainees: !draft.hasTrainees }))}
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
                                    This writes the trainees shown above into the local test app trainee list. It does not touch the real DFP-NEO database.
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
                    {wizardDataListField('Master LMP code', trainingDraft.lmpCode, (value) => setTrainingDraft((draft) => ({ ...draft, lmpCode: value, lmpName: draft.lmpName || value })), activeMasterLmpCatalogue.map((lmp: any) => String(lmp.code || lmp.name || '')).filter(Boolean), 'C-17A Conversion', 'master-lmp-code')}
                    {wizardField('Master LMP name', trainingDraft.lmpName, (value) => setTrainingDraft((draft) => ({ ...draft, lmpName: value })), undefined, 'C-17A Conversion')}
                    {wizardTextArea('Description', trainingDraft.description, (value) => setTrainingDraft((draft) => ({ ...draft, description: value })), 'Initial conversion training stream')}
                </div>,
            );
        }
        if (visibleStep.id === 'training-records') {
            return promptShell(
                <p>Set the training report defaults for this unit. These choices control what the report is called and how pass/fail grading appears to users.</p>,
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
                <p>Set the display order for ranks and equivalent titles. This matters anywhere DFP-NEO sorts people by rank.</p>,
                renderRankLabelsEditor(),
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
                <p>Create the currency profiles this unit will use. The full Currency Builder can still be refined after setup, but these profiles give the unit useful defaults immediately.</p>,
                renderCurrencyEditor(),
            );
        }
        if (visibleStep.id === 'access') {
            return promptShell(
                <p>Access scopes decide who can view, assign, or manage a Master LMP for a location and unit. Practically: if a user has no access scope here, they should not be offered this LMP for this unit.</p>,
                <div className="grid gap-3 md:grid-cols-2">
                    {wizardField('User', accessDraft.userName, (value) => setAccessDraft((draft) => ({ ...draft, userName: value })), undefined, 'Alexander Burns')}
                    {wizardField('Location', accessDraft.locationCode, (value) => setAccessDraft((draft) => ({ ...draft, locationCode: value })), activeLocations.map((location: any) => location.code))}
                    {wizardField('Unit', accessDraft.unitCode, (value) => setAccessDraft((draft) => ({ ...draft, unitCode: value })), activeUnits.map((unit: any) => unit.code))}
                    {wizardField('Module', accessDraft.moduleCode, (value) => setAccessDraft((draft) => ({ ...draft, moduleCode: value })), ['DFP', 'NEO Build', 'Training Records', 'Build Intelligence'])}
                    {wizardField('Access level', trainingDraft.accessLevel, (value) => setTrainingDraft((draft) => ({ ...draft, accessLevel: value })), ['View', 'Assign', 'Manage'])}
                </div>,
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
                <p>Set up common staff currency event templates for this unit. These become reusable starting points for standard staff checks and currency events.</p>,
                renderStandardCurrencyEventsEditor(),
            );
        }
        return promptShell(
            <p>
                {isSetupTestMode
                    ? <>In this local test app, each step has already synced into Settings as you clicked Next. Press <strong>Save setup</strong> to mark the wizard complete.</>
                    : <>Review the setup below. Nothing from this wizard is written to Settings until you press <strong>Save setup</strong>.</>
                }
            </p>,
            <div className="grid gap-2 text-sm">
                {[
                    ['Organisation', `${organisationDraft.name || organisationDraft.code || 'Not set'} (${organisationDraft.code || 'no code'})`],
                    ['Structure', `${fromLines(organisationDraft.level1Options).length} ${organisationDraft.level1Name || 'Level 1'}, ${fromLines(organisationDraft.level2Options).length} ${organisationDraft.level2Name || 'Level 2'}, ${fromLines(organisationDraft.level3Options).length} ${organisationDraft.level3Name || 'Level 3'} / ${organisationPreviewLinks.length} parent links`],
                    ['Location', `${locationDraft.code || 'Not set'} - ${locationDraft.name || 'not named'}`],
                    ['Units today', parseWizardUnitRows(unitsTodayDraft).map((unit) => `${unit.code} ${unit.name}`).join('\n') || 'Not set'],
                    ['Locations today', parseWizardLocationRows(locationsTodayDraft).map((location) => `${location.icao} / ${location.iata || '-'} / ${location.name}`).join('\n') || 'Not set'],
                    ['Unit', `${unitDraft.code || 'Not set'} - ${getWizardOperationalModelLabel(unitDraft.operationalModel)}`],
                    ['Resources', `${resourceDraft.aircraftCode || 'Not set'} / Aircraft ${resourceDraft.aircraft || '0'} / Sim ${resourceDraft.sim || '0'} / Trainer ${resourceDraft.trainer || '0'} / Standby ${resourceDraft.standby || '0'} / Ground ${resourceDraft.ground || '0'}`],
                    ['Crew', crewDraft.standardSeats || 'Not set'],
                    ['Build rules', buildRulesDraftText || 'Not set'],
                    ['Staff', staffDraft || 'Not set'],
                    ['Trainees', unitDraft.hasTrainees ? traineeDraft || 'Not set' : 'Trainees off'],
                    ['Master LMP', `${trainingDraft.lmpCode || 'Not set'} - ${trainingDraft.lmpName || 'not named'}`],
                    ['Modules', unitModulesDraft || 'Not set'],
                    ['Ranks and labels', rankLabelsDraft || 'Not set'],
                    ['Sharing', resourceSharingDraft || 'Not set'],
                    ['Currencies', currencyDraft || 'Not set'],
                    ['Access', `${accessDraft.userName || 'Not set'} / ${accessDraft.locationCode || 'no location'} / ${accessDraft.unitCode || 'no unit'} / ${trainingDraft.accessLevel || 'View'}`],
                    ['Scoring', scoringDraft || 'Not set'],
                    ['Staff currency events', staffCurrencyEventsDraft || 'Not set'],
                ].map(([label, value]) => (
                    <div key={label} className="grid gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 md:grid-cols-[150px_minmax(0,1fr)]">
                        <span className="font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
                        <span className="whitespace-pre-line font-bold text-slate-900">{value}</span>
                    </div>
                ))}
            </div>,
            'Save setup',
            saveAllWizardDrafts,
        );
    };

    if (mode === 'detect' && isPartiallyConfigured) {
        return (
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-slate-900 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Initial Setup Wizard</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">DFP-NEO is partly configured</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                    I found {completedMandatory} of {mandatoryChecks.length} mandatory setup areas already complete. You can continue from your last wizard page, or start the guide again from the beginning. {isSetupTestMode ? 'Each step syncs into the local test Settings when you click Next.' : 'Settings are not updated until the final Save setup step.'}
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
        <aside className={`${className} rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900 shadow-sm`}>
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
            <div className={`grid gap-4 ${visibleTemplates.length > 0 && !placeTemplatesBelow ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
                <div className="space-y-3">
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
    unitCode?: string;
    locationCode?: string;
    formationCallsigns?: FormationCallsign[];
    buildRuleSettings?: ScheduleViewProps['buildRuleSettings'];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
    isSetupTestMode?: boolean;
    onSaveSetupTestPersonnel?: (payload: { instructors: any[]; trainees: any[] }) => void;
    isOpen?: boolean;
    onInitialSetupWizardActiveChange?: (active: boolean) => void;
}> = ({ platformConfig, unitCode, locationCode, formationCallsigns = [], buildRuleSettings, onUpdatePlatformConfig, onNavigateToSettingsSection, isSetupTestMode = false, onSaveSetupTestPersonnel, isOpen = false, onInitialSetupWizardActiveChange }) => {
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
        <div className="h-full overflow-auto px-5 py-4 text-slate-100">
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
                <InitialSetupWizard
                    platformConfig={platformConfig}
                    unitCode={unitCode}
                    locationCode={locationCode}
                    onUpdatePlatformConfig={onUpdatePlatformConfig}
                    onNavigateToSettingsSection={onNavigateToSettingsSection}
                    isSetupTestMode={isSetupTestMode}
                    onSaveSetupTestPersonnel={onSaveSetupTestPersonnel}
                />
            )}
        </div>
    );
};

const ScheduleView: React.FC<ScheduleViewProps> = ({
    date, onDateChange, onDateSelect, snapshotDates = [], events, resources, instructors, traineesData, airframeCount, standbyCount, ftdCount, cptCount,
    onUpdateEvent, onSelectEvent, onReorderResources, zoomLevel, showValidation, showPrePost, syllabusDetails,
    personnelData, seatConfigs, daylightTimes, personnelConflicts, personnelConflictIds, unavailabilityConflicts,
    onCptConflict, isMultiSelectMode, selectedEventIds, setSelectedEventIds, baselineEvents,
    isVisualAdjustMode = false, visualAdjustEvent = null, onVisualAdjustTimeChange,
    isOracleMode,
    isNeoBuild = false, oraclePreviewEvent, onOracleMouseDown, onOracleMouseMove, onOracleMouseUp,
    detectConflictsForEvent, showDepartureDensityOverlay,
    showAircraftAvailability, initialAvailability, apiBase, locationCode, unitCode, dayFlyingStart, dayFlyingEnd, onAvailabilityChange, onUserAvailabilityChange,
    isPauseSelectMode = false, pauseCompletedEventIds, onPauseToggleCompleted,
    alertsData,
    formatResourceLabel,
    aircraftConfigLabelsByResource,
    aircraftNumberSettings,
    flyingWindowExclusions = [],
    isReadOnly = false,
    onExternalEventDrop,
    diagnosticHighlightedEventIds = new Set<string>(),
    platformConfig,
    onUpdatePlatformConfig,
    onNavigateToSettingsSection,
    isSetupTestMode = false,
    onSaveSetupTestPersonnel,
    isNeoAssistPanelOpen = false,
    isFlightLinePanelOpen = false,
    onOrganisationSlideoutOpen,
    onToggleFlightLinePanel,
    onInitialSetupWizardActiveChange,
    formationCallsigns = [],
    buildRuleSettings,
    timezoneOffset = 11 // Default to UTC+11
}) => {
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
    useEffect(() => {
        if (isNeoAssistPanelOpen) setShowResourceUnderlayPanel(false);
    }, [isNeoAssistPanelOpen]);
    const [resourceSlideoutFrame, setResourceSlideoutFrame] = useState<{ left: number; top: number; height: number; width: number; bottom: number } | null>(null);
    const scheduleGridRef = useRef<HTMLDivElement>(null);
    const flightLinePoolContext = useMemo(() => {
        const cleanUnitCode = normaliseUnitSettingsIdentifier(unitCode);
        const units = Array.isArray(platformConfig?.units) ? platformConfig.units : [];
        const activeUnit = units.find((unit: any) => normaliseUnitSettingsIdentifier(unit?.code) === cleanUnitCode);
        const unitForPool = activeUnit || { code: unitCode, locationCode };
        const pools = getRelevantResourcePoolsForUnit(platformConfig, unitForPool);
        const pool = pools.find((candidate: any) => candidate?.settings?.applyToV2Runtime === true) || pools[0] || null;
        const poolIndex = Array.isArray(platformConfig?.resourcePools) && pool
            ? platformConfig.resourcePools.findIndex((candidate: any) => candidate === pool || String(candidate?.id || candidate?.code || '') === String(pool?.id || pool?.code || ''))
            : -1;
        const settings = pool?.settings || {};
        const rawAircraftCount = Number(settings.aircraft ?? airframeCount ?? 5);
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
        const unavailableNumberSet = new Set(unavailableNumbers);
        const availableNumbers = numbers.filter((number) => !unavailableNumberSet.has(number));
        return {
            poolIndex,
            aircraftCount,
            prefix,
            numbers,
            availableNumbers,
            unavailableNumbers,
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
    const flightLineAircraftAssignmentStorageKey = useMemo(
        () => `dfp-flight-line-aircraft-assignments:${date}:${locationCode}:${unitCode}`,
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
    const flightLineAssignedAircraftSet = useMemo(
        () => new Set(Object.keys(flightLineAircraftAssignments)),
        [flightLineAircraftAssignments],
    );
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
        if (!onUpdatePlatformConfig || flightLinePoolContext.poolIndex < 0) return;
        onUpdatePlatformConfig((current: any) => ({
            ...current,
            resourcePools: (current?.resourcePools || []).map((pool: any, poolIndex: number) => {
                if (poolIndex !== flightLinePoolContext.poolIndex) return pool;
                const settings = pool?.settings || {};
                const rawCount = Number(settings.aircraft ?? flightLinePoolContext.aircraftCount ?? 5);
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
    }, [flightLinePoolContext.aircraftCount, flightLinePoolContext.poolIndex, onUpdatePlatformConfig]);
    const clearFlightLineDragState = useCallback(() => {
        setFlightLineDraggedAircraftNumber(null);
        setFlightLineScheduleDropPreview(null);
        setIsFlightLineAvailableDropActive(false);
        setIsFlightLineUnavailableDropActive(false);
    }, []);
    const saveFlightLineUnavailableAircraftNumbers = useCallback((nextUnavailableNumbers: string[]) => {
        const validNumbers = new Set(flightLinePoolContext.numbers);
        const cleanNumbers = sortFlightLineAircraftNumbers(Array.from(new Set(nextUnavailableNumbers.map((number) => String(number ?? '').trim()).filter((number) => number && validNumbers.has(number)))));
        setFlightLineLocalUnavailableNumbers(cleanNumbers);
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
                        flightLineUnavailableAircraftNumbers: cleanNumbers,
                    },
                };
            }),
        }));
    }, [flightLinePoolContext.numbers, flightLinePoolContext.poolIndex, onUpdatePlatformConfig, sortFlightLineAircraftNumbers]);
    const moveFlightLineAircraftToUnavailable = useCallback((aircraftNumber: string) => {
        const cleanNumber = aircraftNumber.trim();
        setFlightLineAircraftAssignments((current) => {
            const next = { ...current };
            delete next[cleanNumber];
            return next;
        });
        clearFlightLineDragState();
        if (!cleanNumber || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        saveFlightLineUnavailableAircraftNumbers([...flightLineEffectiveUnavailableNumbers, cleanNumber]);
    }, [clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, saveFlightLineUnavailableAircraftNumbers]);
    const moveFlightLineAircraftToAvailable = useCallback((aircraftNumber: string) => {
        const cleanNumber = aircraftNumber.trim();
        setFlightLineAircraftAssignments((current) => {
            const next = { ...current };
            delete next[cleanNumber];
            return next;
        });
        clearFlightLineDragState();
        if (!cleanNumber || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        saveFlightLineUnavailableAircraftNumbers(flightLineEffectiveUnavailableNumbers.filter((number) => number !== cleanNumber));
    }, [clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, saveFlightLineUnavailableAircraftNumbers]);
    const assignFlightLineAircraftToEvent = useCallback((aircraftNumber: string, eventId: string) => {
        const cleanNumber = aircraftNumber.trim();
        if (!cleanNumber || !eventId || !flightLinePoolContext.numbers.includes(cleanNumber)) return;
        setFlightLineAircraftAssignments((current) => {
            const next: Record<string, string> = {};
            Object.entries(current).forEach(([number, assignedEventId]) => {
                if (number !== cleanNumber && assignedEventId !== eventId) {
                    next[number] = assignedEventId;
                }
            });
            next[cleanNumber] = eventId;
            return next;
        });
        saveFlightLineUnavailableAircraftNumbers(flightLineEffectiveUnavailableNumbers.filter((number) => number !== cleanNumber));
        clearFlightLineDragState();
    }, [clearFlightLineDragState, flightLineEffectiveUnavailableNumbers, flightLinePoolContext.numbers, saveFlightLineUnavailableAircraftNumbers]);
    const flightLineAircraftMarkerEntries = useMemo(() => {
        const eventById = new Map(events.map((event) => [event.id, event]));
        const entries = Object.entries(flightLineAircraftAssignments)
            .map(([aircraftNumber, eventId]) => ({ aircraftNumber, eventId, event: eventById.get(eventId) }))
            .filter((entry): entry is { aircraftNumber: string; eventId: string; event: ScheduleEvent } => !!entry.event);
        if (flightLineScheduleDropPreview) {
            const previewEvent = eventById.get(flightLineScheduleDropPreview.eventId);
            if (previewEvent) {
                return [
                    ...entries.filter((entry) => entry.aircraftNumber !== flightLineScheduleDropPreview.aircraftNumber && entry.eventId !== flightLineScheduleDropPreview.eventId),
                    { aircraftNumber: flightLineScheduleDropPreview.aircraftNumber, eventId: flightLineScheduleDropPreview.eventId, event: previewEvent, isPreview: true },
                ];
            }
        }
        return entries;
    }, [events, flightLineAircraftAssignments, flightLineScheduleDropPreview]);
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
        const offsetMs = timezoneOffset * 60 * 60 * 1000;
        return new Date(now.getTime() + offsetMs);
    });
    const isInitialLoad = useRef(true);
    const prevZoomLevelRef = useRef(zoomLevel);

    // Update current time when timezone offset changes
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            // Apply timezone offset
            const offsetMs = timezoneOffset * 60 * 60 * 1000;
            const adjustedTime = new Date(now.getTime() + offsetMs);
            setCurrentTime(adjustedTime);
        };

        // Update immediately
        updateTime();
        
        // Update every second
        const interval = setInterval(updateTime, 1000);
        
        return () => clearInterval(interval);
    }, [timezoneOffset]);
    
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

    // Multi-select State
    const selectionStartPoint = useRef<{ x: number, y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    
    // Validate mode overlay state
    const [validateOverlayTime, setValidateOverlayTime] = useState<number | null>(null);

    useEffect(() => {
        const timerId = setInterval(() => {
            const now = new Date();
            const offsetMs = timezoneOffset * 60 * 60 * 1000;
            const adjustedTime = new Date(now.getTime() + offsetMs);
            setCurrentTime(adjustedTime);
        }, 1000);
        
        // Global drag handlers
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (draggingState) {
                console.log('Global mouse move - drag state active');
                handleMouseMove(e as any);
            }
        };
        
        const handleGlobalMouseUp = (e: MouseEvent) => {
            console.log('Global mouse up called, draggingState exists:', !!draggingState);
            if (draggingState) {
                console.log('Global mouse up - ending drag');
                // Call the original handleMouseUp logic
                document.body.classList.remove('no-select');
                setDraggingState(null);
                setRealtimeConflict(null);
                setRealtimeResourceConflictId(null);
                setDraggedCptConflict(null);
            }
        };
        
        // Add global listeners
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        
        return () => {
            clearInterval(timerId);
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [draggingState]);

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
            .filter((candidate) => candidate.resourceId === resourceId && candidate.type === 'flight')
            .sort((a, b) => Math.abs(a.startTime - pointerTime) - Math.abs(b.startTime - pointerTime));
        return rowFlightEvents[0] || null;
    };

    const handleExternalDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        const dragTypes = Array.from(event.dataTransfer.types);
        if (dragTypes.includes('application/flight-line-aircraft')) {
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
            event.preventDefault();
            if (nearestEvent) {
                assignFlightLineAircraftToEvent(aircraftNumber, nearestEvent.id);
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
        const browserToday = new Date();
        const browserTodayStr = `${browserToday.getFullYear()}-${String(browserToday.getMonth() + 1).padStart(2, '0')}-${String(browserToday.getDate()).padStart(2, '0')}`;

        // currentTime is already adjusted to the selected app timezone; use UTC
        // getters to extract the intended app-local day from that adjusted value.
        const appTodayStr = `${currentTime.getUTCFullYear()}-${String(currentTime.getUTCMonth() + 1).padStart(2, '0')}-${String(currentTime.getUTCDate()).padStart(2, '0')}`;

        return date === browserTodayStr && date === appTodayStr;
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
        console.log('handleMouseDown called, event:', event?.id, 'isMultiSelectMode:', isMultiSelectMode);
        console.log('Event target:', e.target);
        console.log('Current target:', e.currentTarget);
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
                console.log('🐍 Processing event for drag:', ev.id, 'resourceId:', ev.resourceId);
                console.log('🐍 Available resources:', resources);
                const rowIndex = resources.indexOf(ev.resourceId);
                console.log('🐍 Found row index:', rowIndex);
                if (rowIndex !== -1) {
                    initialPositions.set(ev.id, { startTime: ev.startTime, rowIndex });
                    originalResourceIds.set(ev.id, ev.resourceId);
                    console.log('🐍 Event added to initialPositions');
                } else {
                    console.log('🐍 Event NOT added - resourceId not found in resources');
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
                   console.log('Setting dragging state with', initialPositions.size, 'events for event:', event.id);                   console.log('initialPositions:', initialPositions);
                setDraggingState({
                    mainEventId: event.id,
                    xOffset: (e.clientX - rect.left) / zoomLevel,
                    yOffset: e.clientY - rect.top,
                    initialPositions,
                    originalResourceIds,
                });
                   console.log('setDraggingState called with:', draggingState);
            } else {
                console.log('No initial positions - drag state not set');
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
        console.log('handleMouseMove called, draggingState exists:', !!draggingState);
        if (!scheduleGridRef.current) {
            console.log('Early return: no scheduleGridRef');
            return;
        }
        didDragRef.current = true;
        const gridRect = scheduleGridRef.current.getBoundingClientRect();
        const xInGrid = e.clientX - gridRect.left;
        const yInGrid = e.clientY - gridRect.top;
        
        // Update validate overlay position when hourly event rate mode is ON
        if (showDepartureDensityOverlay) {
            const mouseTimeInHours = (xInGrid / (PIXELS_PER_HOUR * zoomLevel)) + START_HOUR;
            setValidateOverlayTime(mouseTimeInHours);
        }

        if (isOracleMode && oraclePreviewEvent) {
            console.log('Early return: Oracle mode with preview event');
            const startTime = xInGrid / (PIXELS_PER_HOUR * zoomLevel) + START_HOUR;
            const resourceId = resources[Math.floor(yInGrid / ROW_HEIGHT)] || resources[0];
            onOracleMouseMove(startTime, resourceId);
        } else {
            if (selectionStartPoint.current) {
                console.log('Early return: selectionStartPoint active (marquee selection)');
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
                    console.log('Early return: no draggingState');
                    return;
                }

            const mainEventInitialPos = draggingState.initialPositions.get(draggingState.mainEventId);
            if (!mainEventInitialPos) return;

            const timeShift = ((xInGrid / zoomLevel) - draggingState.xOffset) / PIXELS_PER_HOUR - mainEventInitialPos.startTime;
            const rowShift = Math.floor((yInGrid - draggingState.yOffset + ROW_HEIGHT / 2) / ROW_HEIGHT) - mainEventInitialPos.rowIndex;
            console.log('Drag calculation - timeShift:', timeShift, 'rowShift:', rowShift, 'xInGrid:', xInGrid, 'yInGrid:', yInGrid);

            const updates: { eventId: string, newStartTime: number, newResourceId: string }[] = [];
            const tempEvents = [...events];
            let resourceConflictId: string | null = null;
            let tempCptConflict: Conflict | null = null;

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
            
            const mainUpdate = updates.find(u => u.eventId === draggingState.mainEventId);
            if (mainUpdate) {
                const mainEvent = tempEvents.find(e => e.id === draggingState.mainEventId)!;
                const otherEvents = tempEvents.filter(e => !draggingState.initialPositions.has(e.id));
                
                // Use new conflict detection if available, otherwise fall back to old method
                let conflictResult = null;
                if (detectConflictsForEvent) {
                    conflictResult = detectConflictsForEvent(mainEvent, otherEvents);
                    console.log('🔍 Drag conflict check:', {
                        eventId: mainEvent.id,
                        hasConflict: conflictResult.hasConflict,
                        conflictType: conflictResult.conflictType
                    });
                    if (conflictResult.hasConflict) {
                        setRealtimeConflict({ 
                            conflictingEventId: conflictResult.conflictingEventId!, 
                            conflictedPersonName: conflictResult.conflictedPersonnel || '' 
                        });
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
                    } else {
                        setRealtimeConflict(null);
                    }
                } else {
                    // Fallback to old method
                    const conflict = findConflict([mainEvent], otherEvents);
                    
                    if (conflict) {
                        setRealtimeConflict({ 
                            conflictingEventId: conflict.conflictingEvent.id, 
                            conflictedPersonName: conflict.personName 
                        });
                        if (mainEvent.flightNumber.includes('CPT')) {
                            tempCptConflict = {
                                conflictingEvent: conflict.conflictingEvent,
                                newEvent: mainEvent,
                                conflictedPerson: 'trainee',
                                personName: conflict.personName
                            } as Conflict;
                        }
                    } else {
                        setRealtimeConflict(null);
                    }
                }
            }
            
            setRealtimeResourceConflictId(resourceConflictId);
            setDraggedCptConflict(tempCptConflict);

            console.log('🐍 DRAG COMPLETE - Calling onUpdateEvent with', updates.length, 'updates:');
               console.log('🐍 Updates:', updates);
                onUpdateEvent(updates);
        }
    };

    const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        console.log('Local handleMouseUp called - ignoring when dragState exists:', !!draggingState);
        if (draggingState) {
            console.log('Ignoring local mouse up - global handler will manage');
            return; // Don't clear drag state if we're in a drag operation
        }
        document.body.classList.remove('no-select');
        
        if (isOracleMode) {
            onOracleMouseUp();
        }

        if (draggedCptConflict) {
            onCptConflict(draggedCptConflict);
        }
        console.log('Clearing drag state in local handleMouseUp');
        setDraggingState(null);
        setRealtimeConflict(null);
        setRealtimeResourceConflictId(null);
        setDraggedCptConflict(null);
        
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

    // Render validate mode overlay (also used for hourly event rate display)
    const renderValidateOverlay = () => {
        
        // Overlay should show only when hourly event rate mode is active (independent of validation mode)
        if (validateOverlayTime === null || !showDepartureDensityOverlay) return null;
        
        // Calculate 1-hour window (30 minutes before and after mouse time)
        const windowStart = validateOverlayTime - 0.5;
        const windowEnd = validateOverlayTime + 0.5;
        
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
                        Flights starting in this hour: <span className="text-sky-400">{flightCount}</span>
                    </div>
                </div>
            </>
        );
    };

    const renderFlightLineAircraftMarkers = () => (
        <>
            {flightLineAircraftMarkerEntries.map(({ aircraftNumber, event, isPreview }: any) => {
                const rowIndex = resources.indexOf(event.resourceId);
                if (rowIndex < 0) return null;
                const markerLeft = (event.startTime - START_HOUR) * PIXELS_PER_HOUR * zoomLevel;
                const markerTop = rowIndex * ROW_HEIGHT + 2;
                const markerHeight = ROW_HEIGHT - 4;
                return (
                    <div
                        key={`flight-line-aircraft-marker-${aircraftNumber}-${event.id}`}
                        draggable
                        onDragStart={(dragEvent) => {
                            setFlightLineDraggedAircraftNumber(aircraftNumber);
                            dragEvent.dataTransfer.effectAllowed = 'move';
                            dragEvent.dataTransfer.setData('application/flight-line-aircraft', aircraftNumber);
                            dragEvent.dataTransfer.setData('text/plain', aircraftNumber);
                        }}
                        onDragEnd={clearFlightLineDragState}
                        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                        className={`absolute cursor-grab transition-all duration-300 ease-out active:cursor-grabbing ${isPreview ? 'opacity-70' : 'opacity-100'}`}
                        style={{
                            left: `${markerLeft}px`,
                            top: `${markerTop}px`,
                            width: '38px',
                            height: `${markerHeight}px`,
                            zIndex: 48,
                        }}
                        title={`Aircraft ${aircraftNumber}`}
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-[18px] rounded-l-md bg-[#4f5357] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.28)]" />
                        <div className="absolute left-[14px] top-0 h-[5px] w-[24px] bg-[#4f5357]" />
                        <div className="absolute left-[14px] bottom-0 h-[5px] w-[24px] bg-[#4f5357]" />
                        <div className="absolute left-0 top-0 bottom-0 flex w-[18px] items-center justify-center">
                            <span className="block rotate-90 font-mono text-[12px] font-black leading-none text-white">{aircraftNumber}</span>
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
                const shouldShowChangeBarsForDate = date === getLocalDateString();
                const isChanged = shouldShowChangeBarsForDate && checkIsChanged(event, baselineEvents);
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

                return (
                    <FlightTile
                        key={event.id}
                        event={event}
                        traineesData={traineesData}
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
                        className={`absolute left-0 top-0 h-full pointer-events-none border-r border-cyan-400/25 bg-slate-950/96 shadow-[18px_0_36px_rgba(0,0,0,0.38)] backdrop-blur transition-transform duration-300 ease-out ${showResourceUnderlayPanel ? 'translate-x-0' : '-translate-x-full'}`}
                        style={{ width: 'min(calc(clamp(360px, 40vw, 680px) + 400px), calc(100vw - 420px))' }}
                    >
                        <div className={`h-full overflow-auto border-r border-white/5 bg-gradient-to-b from-slate-900/70 to-slate-950/80 ${showResourceUnderlayPanel ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                            <OrganisationSlideoutDiagram platformConfig={platformConfig} unitCode={unitCode} locationCode={locationCode} formationCallsigns={formationCallsigns} buildRuleSettings={buildRuleSettings} onUpdatePlatformConfig={onUpdatePlatformConfig} onNavigateToSettingsSection={onNavigateToSettingsSection} isSetupTestMode={isSetupTestMode} onSaveSetupTestPersonnel={onSaveSetupTestPersonnel} isOpen={showResourceUnderlayPanel} onInitialSetupWizardActiveChange={onInitialSetupWizardActiveChange} />
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
                                                        className="h-7 min-w-0 rounded border border-slate-600/80 bg-slate-950/80 px-2 text-xs font-bold text-slate-100 outline-none transition focus:border-cyan-300"
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Aircraft Tiles</p>
                                        <div
                                            className={`mt-3 flex min-h-[88px] flex-wrap gap-2 rounded-md border px-2 py-2 pb-1 transition-all duration-300 ease-out ${isFlightLineAvailableDropActive ? 'border-cyan-300/70 bg-cyan-500/10' : 'border-transparent bg-transparent'}`}
                                            onDragOver={(event) => {
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
                                                event.preventDefault();
                                                const aircraftNumber = event.dataTransfer.getData('text/plain') || flightLineDraggedAircraftNumber || '';
                                                moveFlightLineAircraftToAvailable(aircraftNumber);
                                            }}
                                        >
                                            {flightLinePoolContext.numbers.map((number) => {
                                                const tailNumber = [flightLinePoolContext.prefix, number].filter(Boolean).join(' ');
                                                const isDragging = flightLineDraggedAircraftNumber === number;
                                                const isUnavailable = flightLineEffectiveUnavailableSet.has(number);
                                                const isAssigned = flightLineAssignedAircraftSet.has(number);
                                                return (
                                                    <div
                                                        key={`flight-line-aircraft-slot-${number}`}
                                                        className="relative h-[40px] w-[50px] shrink-0"
                                                        title={tailNumber}
                                                    >
                                                        <div
                                                            className="absolute inset-0 flex flex-col items-center justify-center rounded-md border border-dashed border-slate-500/45 bg-[#4f5357]/25 px-1 text-center font-black text-slate-300/70 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] transition-all duration-300 ease-out"
                                                            title={`${tailNumber} slot`}
                                                        >
                                                            {flightLinePoolContext.prefix ? (
                                                                <span className="mb-0.5 max-w-full truncate text-[9px] font-black uppercase leading-none tracking-normal text-slate-300/55">{flightLinePoolContext.prefix}</span>
                                                            ) : null}
                                                            <span className="max-w-full truncate text-[12px] font-black leading-none text-slate-200/70">{number}</span>
                                                        </div>
                                                        {!isUnavailable && !isAssigned ? (
                                                            <div
                                                                draggable
                                                                onDragStart={(event) => {
                                                                    setFlightLineDraggedAircraftNumber(number);
                                                                    event.dataTransfer.effectAllowed = 'move';
                                                                    event.dataTransfer.setData('application/flight-line-aircraft', number);
                                                                    event.dataTransfer.setData('text/plain', number);
                                                                }}
                                                                onDragEnd={clearFlightLineDragState}
                                                                className={`absolute inset-0 flex cursor-grab flex-col items-center justify-center rounded-md border px-1 text-center font-black text-slate-50 transition-all duration-300 ease-out active:cursor-grabbing ${isDragging ? 'border-dashed border-cyan-200/70 bg-[#4f5357]/35 opacity-60 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]' : 'border-slate-500/45 bg-[#4f5357] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.28)]'}`}
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
                                                    return (
                                                        <div
                                                            key={`flight-line-unavailable-aircraft-tile-${number}`}
                                                            draggable
                                                            onDragStart={(event) => {
                                                                setFlightLineDraggedAircraftNumber(number);
                                                                event.dataTransfer.effectAllowed = 'move';
                                                                event.dataTransfer.setData('application/flight-line-aircraft', number);
                                                                event.dataTransfer.setData('text/plain', number);
                                                            }}
                                                            onDragEnd={clearFlightLineDragState}
                                                            className={`flex h-[40px] w-[50px] cursor-grab flex-col items-center justify-center rounded-md border px-1 text-center font-black text-slate-50 transition-all duration-300 ease-out active:cursor-grabbing ${flightLineDraggedAircraftNumber === number ? 'border-dashed border-cyan-200/70 bg-[#4f5357]/35 opacity-60 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]' : 'border-slate-500/45 bg-[#4f5357] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.28)]'}`}
                                                            title={tailNumber}
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
                                                {snapshotDates.slice(0, 12).map(snapshotDate => (
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
                                personnelData={personnelData}
                                seatConfigs={new Map()}
                                currentTime={currentTime}
                                aircraftNumberSettings={aircraftNumberSettings}
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
