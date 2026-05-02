import { showDarkAlert } from './DarkMessageModal';
import React, { useState, useEffect, useRef } from 'react';
import { AircraftAvailabilitySnapshot, DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { calculateDailyAverageAvailability, formatDate, convertSnapshotsToTimeline } from '../utils/aircraftAvailabilityUtils';
import { logAudit } from '../utils/auditLogger';

interface AircraftAvailabilityOverlayProps {
    currentDate: Date;
    totalAircraft: number;
    plannedAvailability: number;
    dayFlyingStart: string; // HH:mm
    dayFlyingEnd: string; // HH:mm
    gridHeight: number; // Total height of the schedule grid
    rowHeight: number; // Height of each aircraft row
    pixelsPerHour: number; // For time-based positioning
    startHour: number; // Start hour of timeline (usually 0)
    onAvailabilityChange: (record: DailyAvailabilityRecord) => void;
    onUpdatePlannedAvailability?: (count: number) => void; // Syncs with Settings panel
}

const AircraftAvailabilityOverlay: React.FC<AircraftAvailabilityOverlayProps> = ({
    currentDate,
    totalAircraft,
    plannedAvailability,
    dayFlyingStart,
    dayFlyingEnd,
    gridHeight,
    rowHeight,
    pixelsPerHour,
    startHour,
    onAvailabilityChange,
    onUpdatePlannedAvailability
}) => {
    const [currentAvailable, setCurrentAvailable] = useState<number>(plannedAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const overlayRef = useRef<SVGSVGElement>(null);
    // Track last value set by THIS overlay to avoid re-syncing our own updates
    const lastSetByOverlay = useRef<number>(plannedAvailability);
    // Stable ref for onAvailabilityChange to avoid re-render loop
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Helper: make the day-start (0001) timestamp for currentDate
    const makeDayStart = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 1, 0);
        return d;
    };

    // Load snapshots from localStorage on mount / date change ONLY
    useEffect(() => {
        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
        if (stored) {
            const data = JSON.parse(stored);
            const loaded: AircraftAvailabilitySnapshot[] = data.snapshots.map((s: any) => ({
                ...s,
                timestamp: new Date(s.timestamp)
            }));
            setSnapshots(loaded);
            const lastAvailable = loaded[loaded.length - 1]?.available ?? plannedAvailability;
            setCurrentAvailable(lastAvailable);
            lastSetByOverlay.current = lastAvailable;
        } else {
            // Initialize with planned availability at start of day (0001)
            const initialSnapshot: AircraftAvailabilitySnapshot = {
                timestamp: makeDayStart(currentDate),
                available: plannedAvailability,
                total: totalAircraft,
                notes: 'Initial planned availability at start of day'
            };
            setSnapshots([initialSnapshot]);
            setCurrentAvailable(plannedAvailability);
            lastSetByOverlay.current = plannedAvailability;

            logAudit({
                page: "Program Schedule",
                action: "Add",
                description: `Aircraft availability initialized at ${plannedAvailability} (${totalAircraft - plannedAvailability} aircraft unavailable)`,
                changes: `Time: ${new Date().toLocaleTimeString()} | Initial: ${plannedAvailability} | Total: ${totalAircraft} | Type: Initial setup`
            });
        }
    }, [currentDate.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

    // Save and calculate average whenever snapshots change
    useEffect(() => {
        if (snapshots.length > 0) {
            const timeline = convertSnapshotsToTimeline(snapshots);
            const avg = calculateDailyAverageAvailability(
                timeline,
                dayFlyingStart.replace(':', ''),
                dayFlyingEnd.replace(':', '')
            );

            const record: DailyAvailabilityRecord = {
                date: formatDate(currentDate),
                snapshots: snapshots,
                averageAvailability: avg,
                dayFlyingStart,
                dayFlyingEnd
            };

            localStorage.setItem(`aircraft-availability-${record.date}`, JSON.stringify(record));
            onAvailabilityChangeRef.current(record);
        }
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync line position when plannedAvailability changes from OUTSIDE (e.g. Priorities panel)
    // When this happens, update the day-start snapshot (index 0) to the new value so the
    // line always starts at the correct value at 0001 — and add a new snapshot at 0001
    // if the change comes from outside (not from a drag).
    useEffect(() => {
        if (isDraggingRef.current) return;
        if (plannedAvailability === lastSetByOverlay.current) return;

        // External change: update currentAvailable display and update/replace the
        // initial snapshot so the trace starts from the correct value.
        setCurrentAvailable(plannedAvailability);
        lastSetByOverlay.current = plannedAvailability;

        setSnapshots(prev => {
            if (prev.length === 0) {
                return [{
                    timestamp: makeDayStart(currentDate),
                    available: plannedAvailability,
                    total: totalAircraft,
                    notes: `Availability set to ${plannedAvailability} from Build Factors`
                }];
            }
            // Replace or update the very first (day-start) snapshot to new value.
            // All subsequent snapshots (user drags during the day) remain intact.
            const updated = [...prev];
            updated[0] = {
                ...updated[0],
                available: plannedAvailability,
                total: totalAircraft,
                notes: `Availability updated to ${plannedAvailability} from Build Factors`
            };
            return updated;
        });
    }, [plannedAvailability]); // eslint-disable-line react-hooks/exhaustive-deps

    // Calculate Y position for a given aircraft count
    const getYPosition = (aircraftCount: number): number => {
        return aircraftCount * rowHeight;
    };

    // Convert time to X position
    const getXPosition = (time: Date): number => {
        const hours = time.getHours() + time.getMinutes() / 60;
        return (hours - startHour) * pixelsPerHour;
    };

    // Get end of day X position
    const getEndOfDayX = (): number => {
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59);
        return getXPosition(endOfDay);
    };

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [mouseX, setMouseX] = useState(0);
    const isDraggingRef = useRef(false);
    const dragYRef = useRef(0);
    const snapshotsRef = useRef(snapshots);
    const rowHeightRef = useRef(rowHeight);
    const totalAircraftRef = useRef(totalAircraft);
    const plannedAvailabilityRef = useRef(plannedAvailability);
    useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
    useEffect(() => { rowHeightRef.current = rowHeight; }, [rowHeight]);
    useEffect(() => { totalAircraftRef.current = totalAircraft; }, [totalAircraft]);
    useEffect(() => { plannedAvailabilityRef.current = plannedAvailability; }, [plannedAvailability]);

    const handleLineMouseDown = async (e: React.MouseEvent) => {
        const freezeRaw = localStorage.getItem('systemFreezeState');
        if (freezeRaw) {
            const freeze = JSON.parse(freezeRaw);
            if (freeze.isFrozen && !freeze.allowedActions.aircraftAvailability) {
                await showDarkAlert('System is frozen. Aircraft Availability modifications are not permitted.', 'System Frozen', 'error');
                return;
            }
        }
        if (!overlayRef.current) return;
        e.preventDefault();
        const rect = overlayRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        isDraggingRef.current = true;
        dragYRef.current = y;
        setIsDragging(true);
        setDragY(y);
        setMouseX(x);
    };

    const handleDragMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        dragYRef.current = y;
        setDragY(y);
        setMouseX(x);
        const rowsFromTop = y / rowHeightRef.current;
        const clampedCount = Math.max(0, Math.min(totalAircraftRef.current, rowsFromTop));
        setCurrentAvailable(clampedCount);
    };

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        const finalDragY = dragYRef.current;
        const currentRowHeight = rowHeightRef.current;
        const currentTotalAircraft = totalAircraftRef.current;
        const currentSnapshots = snapshotsRef.current;

        const rowsFromTop = finalDragY / currentRowHeight;
        const snappedCount = Math.round(Math.max(0, Math.min(currentTotalAircraft, rowsFromTop)));

        const previousAvailability = currentSnapshots[currentSnapshots.length - 1]?.available ?? plannedAvailabilityRef.current;
        const valueChanged = snappedCount !== previousAvailability;

        // Always update lastSetByOverlay BEFORE any state/prop changes
        lastSetByOverlay.current = snappedCount;
        setCurrentAvailable(snappedCount);

        if (valueChanged) {
            if (onUpdatePlannedAvailability) {
                onUpdatePlannedAvailability(snappedCount);
            }

            logAudit({
                page: "Program Schedule",
                action: "Edit",
                description: `Aircraft availability changed from ${previousAvailability} to ${snappedCount} (${currentTotalAircraft - snappedCount} aircraft unavailable)`,
                changes: `Time: ${new Date().toLocaleTimeString()} | Previous: ${previousAvailability} | New: ${snappedCount} | Total: ${currentTotalAircraft}`
            });

            // Create snapshot at current real-wall-clock time within the selected date
            const now = new Date();
            const snapshotTime = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
                now.getHours(),
                now.getMinutes(),
                now.getSeconds(),
                now.getMilliseconds()
            );

            const newSnapshot: AircraftAvailabilitySnapshot = {
                timestamp: snapshotTime,
                available: snappedCount,
                total: currentTotalAircraft,
                notes: `Availability changed to ${snappedCount}`
            };

            setSnapshots(prev => [...prev, newSnapshot]);
        }
    };

    // Global mouse listeners for drag
    const handleDragMoveRef = useRef(handleDragMove);
    const handleDragEndRef = useRef(handleDragEnd);
    useEffect(() => { handleDragMoveRef.current = handleDragMove; });
    useEffect(() => { handleDragEndRef.current = handleDragEnd; });

    useEffect(() => {
        if (isDragging) {
            const moveHandler = (e: MouseEvent) => handleDragMoveRef.current(e);
            const upHandler = () => handleDragEndRef.current();
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
            return () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
        }
    }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

    // Tick every minute to transition solid→dashed as time passes
    const [, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const displayY = isDragging ? dragY : getYPosition(currentAvailable);
    const endOfDayX = getEndOfDayX();
    const now = new Date();
    const currentTimeX = getXPosition(now);

    /**
     * Render the historical (dashed) trace.
     *
     * Each snapshot[i] represents a new availability value that takes effect at snapshot[i].timestamp.
     * The trace for snapshot[i] is a horizontal dashed line drawn from:
     *   - startX = X position of snapshot[i].timestamp  (where this value begins)
     *   - endX   = X position of snapshot[i+1].timestamp (where the next change happens)
     *              OR currentTimeX for the last past segment
     *
     * A vertical connector is drawn at snapshot[i].timestamp going from the previous value's Y
     * down (or up) to snapshot[i]'s Y — this always moves in the X-forward direction.
     *
     * The first snapshot's horizontal starts at X=0 (start of day display) because that value
     * was set at 0001 and the display starts at startHour (which may be 0 or 8 etc).
     * We draw from pixel 0 of the SVG to represent "from the start of the visible timeline."
     */
    const renderHistoricalLines = () => {
        if (snapshots.length === 0) return null;

        const lines: React.ReactNode[] = [];

        for (let i = 0; i < snapshots.length; i++) {
            const snapshot = snapshots[i];
            const snapshotX = i === 0 ? 0 : getXPosition(snapshot.timestamp);

            // Clamp snapshotX to be non-negative (don't draw left of the visible area)
            const clampedStartX = Math.max(0, snapshotX);

            // End X: next snapshot's start, or currentTime for the last segment
            let endX: number;
            if (i < snapshots.length - 1) {
                endX = Math.max(0, getXPosition(snapshots[i + 1].timestamp));
            } else {
                // Last snapshot: draw up to current time (past portion)
                endX = Math.min(currentTimeX, endOfDayX);
            }

            // Don't draw a zero-width or backwards segment
            if (endX <= clampedStartX) continue;

            const y = getYPosition(snapshot.available);

            // Horizontal dashed segment for this availability value
            lines.push(
                <line
                    key={`history-h-${i}`}
                    x1={clampedStartX}
                    y1={y}
                    x2={endX}
                    y2={y}
                    stroke="rgba(236, 72, 153, 0.4)"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    className="pointer-events-none"
                />
            );

            // Vertical connector: drawn at snapshot[i].timestamp going from prev value → current value
            // Only for i > 0 and only when the value actually changed
            if (i > 0) {
                const prevY = getYPosition(snapshots[i - 1].available);
                if (prevY !== y) {
                    // Draw vertical at this snapshot's X position (not prev — always left→right)
                    const vertX = Math.max(0, getXPosition(snapshot.timestamp));
                    lines.push(
                        <line
                            key={`history-v-${i}`}
                            x1={vertX}
                            y1={prevY}
                            x2={vertX}
                            y2={y}
                            stroke="rgba(236, 72, 153, 0.4)"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                            className="pointer-events-none"
                        />
                    );
                }
            }
        }

        return lines;
    };

    // The last snapshot defines where the solid (future) line begins
    const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const lastChangeX = lastSnapshot ? Math.max(0, getXPosition(lastSnapshot.timestamp)) : 0;

    // Solid future line runs from max(lastChangeX, currentTimeX) to end of day
    // It always goes left→right and never extends into the historical (dashed) region.
    const solidStartX = Math.max(lastChangeX, currentTimeX);
    const showSolidLine = solidStartX < endOfDayX;

    return (
        <>
            <svg
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 5, pointerEvents: 'none' }}
            >
                {/* Historical dashed trace — always left to right */}
                {renderHistoricalLines()}

                {/* Solid line for future availability — draggable */}
                {showSolidLine && (
                    <g>
                        {/* Visual solid line */}
                        <line
                            x1={solidStartX}
                            y1={displayY}
                            x2={endOfDayX}
                            y2={displayY}
                            stroke="rgba(236, 72, 153, 0.8)"
                            strokeWidth="2"
                            className="pointer-events-none"
                        />
                        {/* Invisible wider hit target for dragging */}
                        <line
                            x1={solidStartX}
                            y1={displayY}
                            x2={endOfDayX}
                            y2={displayY}
                            stroke="transparent"
                            strokeWidth="20"
                            style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                            onMouseDown={handleLineMouseDown}
                        />
                    </g>
                )}

                {/* If day is fully in the past, show full dashed line (already handled by renderHistoricalLines) */}
                {/* Nothing extra needed */}
            </svg>
        </>
    );
};

export default AircraftAvailabilityOverlay;