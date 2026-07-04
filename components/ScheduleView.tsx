

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Conflict, Trainee, FlyingWindowExclusionPeriod, FormationCallsign } from '../types';
import FlightTile from './FlightTile';
import AirframeColumn from './AirframeColumn';
import AircraftAvailabilityOverlay from './AircraftAvailabilityOverlay';
import { DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { VisualAdjustGuide } from './VisualAdjustGuide';
import { AircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { DEFAULT_PLATFORM_PERMISSION_PROFILES, getOperationalModelLabel, getUnitOperationalModel, OPERATIONAL_MODEL_OPTIONS } from '../utils/platformConfigService';
import { getTaskProfilesForModel } from '../utils/taskProfiles';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { AIRCRAFT_CREW_RESOURCE_KINDS, normaliseAircraftCrewComposition } from '../utils/aircraftCrewComposition';
import { normaliseCrewCompositionSettings } from '../utils/crewCompositionProfiles';
import { getCrewPositionLabelMap, normaliseCrewPositionTerminology } from '../utils/crewPositionTerminology';
import { normalisePersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { normaliseStaffQualificationCatalogue } from '../utils/staffQualifications';
import { normaliseTrainingReportTemplate, normaliseTrainingReportTerminology } from '../utils/trainingReportTerminology';
import { normaliseUnitCallsignSettings } from '../utils/unitCallsigns';
   

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
  formationCallsigns?: FormationCallsign[];
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

const getResourceCategory = (res: string) => {
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

const getOrganisationRepairMaps = (platformConfig: any, levels: any[]): Map<number, Map<string, string>> => {
    const repairMaps = new Map<number, Map<string, string>>();
    const activeOrganisation = getActiveOrganisation(platformConfig);
    const structure = activeOrganisation?.settings?.organisationStructure || {};
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
        const startsAtRoot = normaliseOrgChartKey(path[0]) === normaliseOrgChartKey(levels[0]?.name || activeOrganisation?.name || activeOrganisation?.code);
        path.forEach((part, pathIndex) => addReference(structuralReferencesByLevel, startsAtRoot ? pathIndex : pathIndex + 1, part));
    });
    (platformConfig?.units || []).forEach((unit: any) => {
        const rawPath = Array.isArray(unit?.settings?.parentOrganisationPath)
            ? unit.settings.parentOrganisationPath
            : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
        rawPath.forEach((part: unknown, pathIndex: number) => addReference(unitReferencesByLevel, pathIndex + 1, part));
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
    const rootLabel = normaliseOrgChartValue(levels[0]?.name) || normaliseOrgChartValue(activeOrganisation.name || activeOrganisation.code) || 'Organisation';
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
            const parentPath = rawPath
                .map((part: unknown, pathIndex: number) => getCanonicalOrganisationLabel(levels, repairMaps, pathIndex + 1, part))
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
            <div>
                <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
                {description ? <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p> : null}
            </div>
            {action}
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
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
}> = ({ platformConfig, unitCode, formationCallsigns = [], onUpdatePlatformConfig, onNavigateToSettingsSection }) => {
    const [activeCategory, setActiveCategory] = useState('identity');
    const activeUnitCode = normaliseUnitSettingsIdentifier(unitCode);
    const units = platformConfig?.units || [];
    const unit = units.find((candidate: any) => normaliseUnitSettingsIdentifier(candidate?.code) === activeUnitCode)
        || units.find((candidate: any) => String(candidate?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        || units[0];
    const unitIndex = unit ? units.findIndex((candidate: any) => candidate === unit) : -1;
    const canEdit = false;
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
    const modelCrewPositions = crewPositionTerminology.positions.filter((position) => (
        !position.operationalModels?.length || position.operationalModels.includes(operationalModel)
    ));
    const modelQualifications = staffQualificationCatalogue.qualifications.filter((qualification) => (
        String(qualification.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
        && qualification.operationalModels.includes(operationalModel)
    ));
    const categories = [
        { id: 'identity', label: 'Unit', count: 5 },
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
                    <UnitSettingsGroup title="Build Rules" description="Business logic, duty and turnaround rules, and event limit settings used by the build." action={<div className="flex flex-wrap justify-end gap-2">{settingsLink('business-rules', 'Business Rules')}{settingsLink('duty-turnaround', 'Duty & Turnaround')}{settingsLink('event-limits', 'Event Limits')}</div>}>
                        <UnitSettingsReadRow label="Business Rules" value="System logic and automation settings that affect how the DFP and NEO Build behave." />
                        <UnitSettingsReadRow label="Duty & Turnaround" value="Crew duty limits, rest periods, turnarounds and related timing limits." />
                        <UnitSettingsReadRow label="Event Limits" value="Operational thresholds and limits for how events may be built and displayed." />
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

const OrganisationSlideoutDiagram: React.FC<{
    platformConfig?: any;
    unitCode?: string;
    formationCallsigns?: FormationCallsign[];
    onUpdatePlatformConfig?: (updater: (current: any) => any) => void;
    onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
}> = ({ platformConfig, unitCode, formationCallsigns = [], onUpdatePlatformConfig, onNavigateToSettingsSection }) => {
    const chart = useMemo(() => buildOrganisationChart(platformConfig), [platformConfig]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<OrganisationSlideoutView>('structure');
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
                    onUpdatePlatformConfig={onUpdatePlatformConfig}
                    onNavigateToSettingsSection={onNavigateToSettingsSection}
                />
            ) : (
                <div className="rounded border border-cyan-400/15 bg-slate-950/60 p-5">
                    <p className="text-sm font-bold text-slate-100">Initial Setup Wizard</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                        This area is reserved for a guided setup flow for new units. The current unit settings remain available from My Unit Settings.
                    </p>
                </div>
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
    formationCallsigns = [],
    timezoneOffset = 11 // Default to UTC+11
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showResourceUnderlayPanel, setShowResourceUnderlayPanel] = useState(false);
    const [resourceSlideoutFrame, setResourceSlideoutFrame] = useState<{ left: number; top: number; height: number } | null>(null);
    const scheduleGridRef = useRef<HTMLDivElement>(null);
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

    const handleExternalDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (!onExternalEventDrop || isReadOnly) return;
        if (!Array.from(event.dataTransfer.types).includes('application/neo-assist-event')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleExternalDrop = (event: React.DragEvent<HTMLDivElement>) => {
        if (!onExternalEventDrop || isReadOnly) return;
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
                            <OrganisationSlideoutDiagram platformConfig={platformConfig} unitCode={unitCode} formationCallsigns={formationCallsigns} onUpdatePlatformConfig={onUpdatePlatformConfig} onNavigateToSettingsSection={onNavigateToSettingsSection} />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowResourceUnderlayPanel(value => !value)}
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
