

import React, { useState, useRef, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Conflict, Trainee } from '../types';
import FlightTile from './FlightTile';
import AirframeColumn from './AirframeColumn';
import AircraftAvailabilityOverlay from './AircraftAvailabilityOverlay';
import { DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { VisualAdjustGuide } from './VisualAdjustGuide';
   

interface ScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
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
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
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
  plannedAvailability?: number;
  dayFlyingStart?: string;
  dayFlyingEnd?: string;
  onAvailabilityChange?: (record: any) => void;
  isVisualAdjustMode?: boolean;
  visualAdjustEvent?: ScheduleEvent | null;
  onVisualAdjustTimeChange?: (startTime: number, endTime: number) => void;
}

const PIXELS_PER_HOUR = 200;
const ROW_HEIGHT = 32;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const AIRFRAME_COLUMN_WIDTH = 144;
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

const ScheduleView: React.FC<ScheduleViewProps> = ({
    date, onDateChange, events, resources, instructors, traineesData, airframeCount, standbyCount, ftdCount, cptCount,
    onUpdateEvent, onSelectEvent, onReorderResources, zoomLevel, showValidation, showPrePost, syllabusDetails,
    personnelData, seatConfigs, daylightTimes, personnelConflicts, personnelConflictIds, unavailabilityConflicts,
    onCptConflict, isMultiSelectMode, selectedEventIds, setSelectedEventIds, baselineEvents,
    isVisualAdjustMode = false, visualAdjustEvent = null, onVisualAdjustTimeChange,
    isOracleMode, oraclePreviewEvent, onOracleMouseDown, onOracleMouseMove, onOracleMouseUp,
    detectConflictsForEvent, showDepartureDensityOverlay,
    showAircraftAvailability, plannedAvailability, dayFlyingStart, dayFlyingEnd, onAvailabilityChange,
    timezoneOffset = 11 // Default to UTC+11
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scheduleGridRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
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
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
        
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

    const formattedDisplayDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC'
        });
    }, [date]);

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

            const e1StartWithPre = eventToCheck.startTime - (s1.preFlightTime || 0);
            const e1EndWithPost = eventToCheck.startTime + eventToCheck.duration + (s1.postFlightTime || 0);

            for (const existingEvent of existingEvents) {
                const s2 = syllabusDetails.find(d => d.id === existingEvent.flightNumber);
                if (!s2) continue;

                const e2StartWithPre = existingEvent.startTime - (s2.preFlightTime || 0);
                const e2EndWithPost = existingEvent.startTime + existingEvent.duration + (s2.postFlightTime || 0);
                
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

            const processEvent = (ev: ScheduleEvent) => {
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

            if (isMultiSelectMode && selectedEventIds.has(event.id)) {
                selectedEventIds.forEach(id => {
                    const ev = events.find(e => e.id === id);
                    if (ev) processEvent(ev);
                });
            } else {
                processEvent(event);
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
        
        // Update validate overlay position when validate mode is ON
        if (showValidation) {
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
        for (let i = 1; i <= resources.length; i++) {
            lines.push(
                <div key={`h-${i}`} className="absolute left-0 w-full bg-gray-700/25" style={{ top: i * ROW_HEIGHT, height: '1px' }}></div>
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

    // Render validate mode overlay
    const renderValidateOverlay = () => {
        // Debug logging to check state values
        console.log('Overlay state check:', { 
            showValidation, 
            validateOverlayTime, 
            showDepartureDensityOverlay 
        });
        
        if (!showValidation || validateOverlayTime === null || !showDepartureDensityOverlay) return null;
        
        // Calculate 1-hour window (30 minutes before and after mouse time)
        const windowStart = validateOverlayTime - 0.5;
        const windowEnd = validateOverlayTime + 0.5;
        
        // Count flights starting in this window
        const flightCount = events.filter(event => {
            // Only count flight events (not FTD, CPT, Ground, Duty Sup, etc.)
            if (event.type !== 'flight') return false;
            
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
            const resourceEvents = events.filter(e => e.resourceId === resource);
            return resourceEvents.map(event => {
                const isDraggedTile = !!(draggingState && draggingState.initialPositions.has(event.id));
                const isStationaryConflictTile = event.id === realtimeConflict?.conflictingEventId || event.id === realtimeResourceConflictId;
                const isConflicting = 
                    (showValidation && personnelConflictIds.has(event.id)) || 
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

                return (
                    <FlightTile
                        key={event.id}
                        event={event}
                        traineesData={traineesData}
                        onSelectEvent={() => { 
                               if (!didDragRef.current) {
                                   if (isMultiSelectMode) {
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
                        isDraggable={true}
                        currentTime={currentTime}
                        isSelected={isSelected}
                        isChanged={isChanged}
                    />
                );
            });
        });
    };

    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-gray-900 select-none">
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
                <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">
                    <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2">
                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            &lt;
                        </button>
                        <span className="flex-grow min-w-0 text-center font-semibold text-white cursor-default truncate text-xs">{formattedDisplayDate}</span>
                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            &gt;
                        </button>
                    </div>
                </div>

                {/* Time Header (Top Row) */}
                <div className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700 relative">
                    {renderTimeHeaders()}
                </div>

                {/* Resource Column (Left Col) */}
                <div className="sticky left-0 z-30 bg-gray-800 border-r border-gray-700">
                    <AirframeColumn
                        resources={resources}
                        onReorder={onReorderResources}
                        rowHeight={ROW_HEIGHT}
                        airframeCount={airframeCount}
                        standbyCount={standbyCount}
                        ftdCount={ftdCount}
                        cptCount={cptCount}
                        events={events}
                    />
                </div>

                {/* Main Grid */}
                <div 
                    ref={scheduleGridRef}
                    className="relative bg-gray-900"
                    onMouseDown={(e) => handleMouseDown(e)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {renderGridLines()}
                    {renderNightShade()}
                    {renderDaylightLines()}
                    {renderCategorySeparators()}
                    {renderCurrentTimeIndicator()}
                    {renderValidateOverlay()}
                    
                    {/* Aircraft Availability Overlay */}
                    {showAircraftAvailability && plannedAvailability !== undefined && dayFlyingStart && dayFlyingEnd && onAvailabilityChange && (
                        <AircraftAvailabilityOverlay
                            currentDate={new Date(date)}
                            totalAircraft={airframeCount}
                            plannedAvailability={plannedAvailability}
                            dayFlyingStart={dayFlyingStart}
                            dayFlyingEnd={dayFlyingEnd}
                            gridHeight={resources.length * ROW_HEIGHT}
                            rowHeight={ROW_HEIGHT}
                            pixelsPerHour={PIXELS_PER_HOUR * zoomLevel}
                            startHour={START_HOUR}
                            onAvailabilityChange={onAvailabilityChange}
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
                                currentTime={new Date()}
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