

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Conflict, Trainee, FlyingWindowExclusionPeriod } from '../types';
import FlightTile from './FlightTile';
import AirframeColumn from './AirframeColumn';
import AircraftAvailabilityOverlay from './AircraftAvailabilityOverlay';
import { DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { VisualAdjustGuide } from './VisualAdjustGuide';
import { AircraftNumberSettings } from '../utils/aircraftNumberFormat';
   

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

const getActiveOrganisation = (platformConfig: any): any => (
    (platformConfig?.organisations || []).find((organisation: any) => (
        String(organisation?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    )) || platformConfig?.organisations?.[0] || null
);

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
    const relationshipPaths = Array.isArray(structure.relationshipPaths) ? structure.relationshipPaths : [];
    relationshipPaths.forEach((rawPath: unknown) => {
        const path = (Array.isArray(rawPath) ? rawPath : String(rawPath || '').split('>'))
            .map(normaliseOrgChartValue)
            .filter(Boolean);
        const displayPath = path[0]?.toLowerCase() === rootKey ? path.slice(1) : path;
        addOrganisationChartPath(root, displayPath, levelNames);
    });
    (platformConfig?.units || [])
        .filter((unit: any) => String(unit?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        .forEach((unit: any) => {
            const unitCode = normaliseOrgChartValue(unit?.code || unit?.name);
            if (!unitCode) return;
            const rawPath = Array.isArray(unit?.settings?.parentOrganisationPath)
                ? unit.settings.parentOrganisationPath
                : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
            const parentPath = rawPath.map(normaliseOrgChartValue).filter(Boolean);
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

const OrganisationChartBranch: React.FC<{ node: OrganisationChartNode; isRoot?: boolean; verticalStartLevel: number }> = ({ node, isRoot = false, verticalStartLevel }) => (
    <li className={node.levelIndex >= 2 ? 'org-chart-compact-node' : undefined}>
        <button
            type="button"
            className={`org-chart-box ${isRoot ? 'org-chart-box-root' : ''} ${node.levelIndex >= 2 ? 'org-chart-box-compact' : ''} ${node.unitCode ? 'org-chart-box-unit' : ''}`}
            data-org-node-id={node.id}
            title={isRoot ? node.label : `${node.levelName}: ${node.label}`}
        >
            {!isRoot && <span className="org-chart-level">{node.levelName}</span>}
            <span className="org-chart-label">{node.label}</span>
        </button>
        {node.children.length > 0 ? (
            <ul className={node.children.every((child) => child.levelIndex >= verticalStartLevel) ? 'org-chart-vertical-level' : undefined}>
                {node.children.map((child) => (
                    <OrganisationChartBranch key={child.id} node={child} verticalStartLevel={verticalStartLevel} />
                ))}
            </ul>
        ) : null}
    </li>
);

const OrganisationSlideoutDiagram: React.FC<{ platformConfig?: any }> = ({ platformConfig }) => {
    const chart = useMemo(() => buildOrganisationChart(platformConfig), [platformConfig]);
    if (!chart) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-400">
                No organisation structure has been configured.
            </div>
        );
    }
    const unitCount = (platformConfig?.units || []).filter((unit: any) => String(unit?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const activeOrganisation = getActiveOrganisation(platformConfig);
    const levels = Array.isArray(activeOrganisation?.settings?.organisationStructure?.levels)
        ? activeOrganisation.settings.organisationStructure.levels
        : [];
    const maxStructureLevel = Math.max(1, levels.length - 1);
    const verticalStartLevel = Math.max(2, maxStructureLevel - 1);
    return (
        <div className="h-full overflow-auto px-5 py-4 text-slate-100">
            <style>{`
                .org-chart { display: inline-flex; min-width: 100%; justify-content: center; padding: 10px 18px 22px; }
                .org-chart ul { position: relative; display: flex; justify-content: center; gap: 18px; padding: 26px 0 0; margin: 0; list-style: none; }
                .org-chart li { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 132px; }
                .org-chart li.org-chart-compact-node { min-width: 66px; }
                .org-chart li::before, .org-chart li::after { content: ''; position: absolute; top: 0; width: calc(50% + 9px); height: 16px; border-top: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart li::before { right: 50%; }
                .org-chart li::after { left: 50%; border-left: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart li:only-child::before, .org-chart li:only-child::after { display: none; }
                .org-chart li:first-child::before, .org-chart li:last-child::after { border-top: 0; }
                .org-chart li:first-child::after { border-top-left-radius: 8px; }
                .org-chart li:last-child::before { border-top-right-radius: 8px; }
                .org-chart ul ul::before { content: ''; position: absolute; top: 0; left: 50%; height: 26px; border-left: 1px solid rgba(103, 232, 249, 0.42); }
                .org-chart > ul > li::before, .org-chart > ul > li::after { display: none; }
                .org-chart > ul { padding-top: 0; }
                .org-chart-box { min-width: 132px; max-width: 168px; min-height: 62px; border: 1px solid rgba(103, 232, 249, 0.46); background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.96)); color: #e5faff; box-shadow: 0 12px 22px rgba(0,0,0,0.26); padding: 9px 10px; text-align: center; transition: border-color 160ms ease, transform 160ms ease, background 160ms ease; }
                .org-chart-box:hover { border-color: rgba(165, 243, 252, 0.9); background: linear-gradient(180deg, rgba(8, 47, 73, 0.98), rgba(8, 13, 28, 0.98)); transform: translateY(-1px); }
                .org-chart-box-root { min-width: 190px; border-color: rgba(34, 211, 238, 0.82); background: linear-gradient(180deg, rgba(14, 116, 144, 0.32), rgba(15, 23, 42, 0.98)); }
                .org-chart-box-compact { min-width: 66px; max-width: 84px; min-height: 54px; padding: 7px 6px; }
                .org-chart-box-unit { border-color: rgba(74, 222, 128, 0.52); }
                .org-chart-level { display: block; margin-bottom: 3px; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(125, 211, 252, 0.78); }
                .org-chart-label { display: block; font-size: 12px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }
                .org-chart-box-compact .org-chart-level { font-size: 7px; letter-spacing: 0.08em; }
                .org-chart-box-compact .org-chart-label { font-size: 10px; line-height: 1.12; }
                .org-chart ul.org-chart-vertical-level { flex-direction: column; align-items: center; gap: 8px; padding-top: 24px; }
                .org-chart ul.org-chart-vertical-level::before { height: 24px; }
                .org-chart ul.org-chart-vertical-level > li { min-width: 66px; }
                .org-chart ul.org-chart-vertical-level > li::before { display: none; }
                .org-chart ul.org-chart-vertical-level > li::after { left: 50%; height: calc(100% + 8px); width: 0; border-top: 0; border-left: 1px solid rgba(103, 232, 249, 0.34); }
                .org-chart ul.org-chart-vertical-level > li:last-child::after { height: 16px; }
            `}</style>
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-cyan-400/20 pb-3">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Organisation Structure</h3>
                    <p className="mt-1 text-xs text-slate-400">{unitCount} configured units mapped from Settings.</p>
                </div>
            </div>
            <div className="rounded border border-cyan-400/20 bg-slate-950/55">
                <div className="org-chart">
                    <ul>
                        <OrganisationChartBranch node={chart} isRoot verticalStartLevel={verticalStartLevel} />
                    </ul>
                </div>
            </div>
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
                        width: 'calc(clamp(360px, 40vw, 680px) + 272px)',
                    }}
                    aria-hidden={!showResourceUnderlayPanel}
                >
                    <aside
                        className={`absolute left-0 top-0 h-full pointer-events-none border-r border-cyan-400/25 bg-slate-950/96 shadow-[18px_0_36px_rgba(0,0,0,0.38)] backdrop-blur transition-transform duration-300 ease-out ${showResourceUnderlayPanel ? 'translate-x-0' : '-translate-x-full'}`}
                        style={{ width: 'calc(clamp(360px, 40vw, 680px) + 200px)' }}
                    >
                        <div className={`h-full overflow-y-auto border-r border-white/5 bg-gradient-to-b from-slate-900/70 to-slate-950/80 ${showResourceUnderlayPanel ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                            <OrganisationSlideoutDiagram platformConfig={platformConfig} />
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
