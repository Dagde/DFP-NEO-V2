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
    dayFlyingEnd: string;   // HH:mm
    gridHeight: number;
    rowHeight: number;
    pixelsPerHour: number;
    startHour: number;
    onAvailabilityChange: (record: DailyAvailabilityRecord) => void;
    onUpdatePlannedAvailability?: (count: number) => void;
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

    // Stable ref for onAvailabilityChange
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Helper: make the day-start (0001) timestamp for a given date
    const makeDayStart = (date: Date): Date => {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 1, 0);
        return d;
    };

    // Sort snapshots by timestamp ascending — guarantees left-to-right rendering
    const sortSnapshots = (snaps: AircraftAvailabilitySnapshot[]): AircraftAvailabilitySnapshot[] =>
        [...snaps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // ── Load snapshots from localStorage on mount / date change ──────────────
    useEffect(() => {
        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                const loaded: AircraftAvailabilitySnapshot[] = sortSnapshots(
                    data.snapshots.map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }))
                );
                setSnapshots(loaded);
                const lastAvailable = loaded[loaded.length - 1]?.available ?? plannedAvailability;
                setCurrentAvailable(lastAvailable);
                lastSetByOverlay.current = lastAvailable;
            } catch {
                // Corrupted data — reinitialise
                initSnapshots();
            }
        } else {
            initSnapshots();
        }
    }, [currentDate.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

    const initSnapshots = () => {
        const initial: AircraftAvailabilitySnapshot = {
            timestamp: makeDayStart(currentDate),
            available: plannedAvailability,
            total: totalAircraft,
            notes: 'Initial planned availability at start of day'
        };
        setSnapshots([initial]);
        setCurrentAvailable(plannedAvailability);
        lastSetByOverlay.current = plannedAvailability;
        logAudit({
            page: "Program Schedule",
            action: "Add",
            description: `Aircraft availability initialized at ${plannedAvailability}`,
            changes: `Initial: ${plannedAvailability} | Total: ${totalAircraft}`
        });
    };

    // ── Save to localStorage + notify parent whenever snapshots change ────────
    useEffect(() => {
        if (snapshots.length === 0) return;
        const timeline = convertSnapshotsToTimeline(snapshots);
        const avg = calculateDailyAverageAvailability(
            timeline,
            dayFlyingStart.replace(':', ''),
            dayFlyingEnd.replace(':', '')
        );
        const record: DailyAvailabilityRecord = {
            date: formatDate(currentDate),
            snapshots,
            averageAvailability: avg,
            dayFlyingStart,
            dayFlyingEnd
        };
        localStorage.setItem(`aircraft-availability-${record.date}`, JSON.stringify(record));
        onAvailabilityChangeRef.current(record);
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Sync from external (Priorities panel) → overlay ──────────────────────
    // When plannedAvailability changes from outside, update the day-start snapshot value
    // so the line starts at the correct count from 0001.
    // We do NOT add a new mid-day snapshot here — the drag does that.
    useEffect(() => {
        if (isDraggingRef.current) return;
        if (plannedAvailability === lastSetByOverlay.current) return;

        lastSetByOverlay.current = plannedAvailability;
        setCurrentAvailable(plannedAvailability);

        setSnapshots(prev => {
            const sorted = sortSnapshots(prev);
            if (sorted.length === 0) {
                return [{
                    timestamp: makeDayStart(currentDate),
                    available: plannedAvailability,
                    total: totalAircraft,
                    notes: `Availability set to ${plannedAvailability} from Build Factors`
                }];
            }
            // Update the first (day-start) snapshot's value.
            // All user drag snapshots (i > 0) remain intact.
            const updated = [...sorted];
            updated[0] = { ...updated[0], available: plannedAvailability, total: totalAircraft };
            return updated;
        });
    }, [plannedAvailability]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Coordinate → pixel helpers ───────────────────────────────────────────
    const getYPosition = (count: number): number => count * rowHeight;

    const getXPosition = (time: Date): number => {
        const t = new Date(time); // ensure it's a real Date object
        const hours = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
        return (hours - startHour) * pixelsPerHour;
    };

    const getEndOfDayX = (): number =>
        getXPosition(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59));

    // ── Drag state ────────────────────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);
    const [dragY, setDragY] = useState(0);
    const isDraggingRef = useRef(false);
    const dragYRef = useRef(0);
    const snapshotsRef = useRef(snapshots);
    const rowHeightRef = useRef(rowHeight);
    const totalAircraftRef = useRef(totalAircraft);
    const plannedAvailabilityRef = useRef(plannedAvailability);
    const currentDateRef = useRef(currentDate);
    useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
    useEffect(() => { rowHeightRef.current = rowHeight; }, [rowHeight]);
    useEffect(() => { totalAircraftRef.current = totalAircraft; }, [totalAircraft]);
    useEffect(() => { plannedAvailabilityRef.current = plannedAvailability; }, [plannedAvailability]);
    useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);

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
        isDraggingRef.current = true;
        dragYRef.current = e.clientY - rect.top;
        setIsDragging(true);
        setDragY(e.clientY - rect.top);
    };

    const handleDragMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        dragYRef.current = y;
        setDragY(y);
        const count = Math.max(0, Math.min(totalAircraftRef.current, y / rowHeightRef.current));
        setCurrentAvailable(count);
    };

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        const snappedCount = Math.round(
            Math.max(0, Math.min(totalAircraftRef.current, dragYRef.current / rowHeightRef.current))
        );
        const currentSnaps = snapshotsRef.current;
        const previousAvailability = currentSnaps.length > 0
            ? currentSnaps[currentSnaps.length - 1].available
            : plannedAvailabilityRef.current;
        const valueChanged = snappedCount !== previousAvailability;

        lastSetByOverlay.current = snappedCount;
        setCurrentAvailable(snappedCount);

        // Always sync to Priorities panel
        if (onUpdatePlannedAvailability) {
            onUpdatePlannedAvailability(snappedCount);
        }

        if (valueChanged) {
            logAudit({
                page: "Program Schedule",
                action: "Edit",
                description: `Aircraft availability changed from ${previousAvailability} to ${snappedCount}`,
                changes: `Previous: ${previousAvailability} | New: ${snappedCount} | Total: ${totalAircraftRef.current}`
            });

            // Create snapshot at real wall-clock time within the displayed date
            const now = new Date();
            const cd = currentDateRef.current;
            const snapshotTime = new Date(
                cd.getFullYear(), cd.getMonth(), cd.getDate(),
                now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()
            );

            const newSnap: AircraftAvailabilitySnapshot = {
                timestamp: snapshotTime,
                available: snappedCount,
                total: totalAircraftRef.current,
                notes: `Availability changed to ${snappedCount}`
            };

            setSnapshots(prev => sortSnapshots([...prev, newSnap]));
        }
    };

    const handleDragMoveRef = useRef(handleDragMove);
    const handleDragEndRef = useRef(handleDragEnd);
    useEffect(() => { handleDragMoveRef.current = handleDragMove; });
    useEffect(() => { handleDragEndRef.current = handleDragEnd; });

    useEffect(() => {
        if (!isDragging) return;
        const move = (e: MouseEvent) => handleDragMoveRef.current(e);
        const up = () => handleDragEndRef.current();
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

    // Tick every minute (solid→dashed transition)
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 60000);
        return () => clearInterval(t);
    }, []);

    // ── Render values ─────────────────────────────────────────────────────────
    const displayY = isDragging ? dragY : getYPosition(currentAvailable);
    const endOfDayX = getEndOfDayX();
    const now = new Date();
    const currentTimeX = getXPosition(now);

    // Use sorted snapshots for rendering — guarantees left-to-right
    const sortedSnaps = sortSnapshots(snapshots);
    const lastSnap = sortedSnaps.length > 0 ? sortedSnaps[sortedSnaps.length - 1] : null;

    /**
     * Historical dashed trace — always left to right.
     *
     * For each snapshot[i]:
     *   • Horizontal dashed line from snapshot[i].X  →  snapshot[i+1].X (or currentTimeX for last)
     *   • Vertical connector at snapshot[i].X from snapshot[i-1].Y → snapshot[i].Y  (i > 0 only)
     *
     * The first snapshot always starts at X=0 (start of visible timeline).
     */
    const renderHistoricalLines = () => {
        if (sortedSnaps.length === 0) return null;
        const lines: React.ReactNode[] = [];

        for (let i = 0; i < sortedSnaps.length; i++) {
            const snap = sortedSnaps[i];
            // Where this availability value begins
            const startX = i === 0 ? 0 : Math.max(0, getXPosition(snap.timestamp));
            // Where it ends (next change, or current time for the last past segment)
            const rawEndX = i < sortedSnaps.length - 1
                ? getXPosition(sortedSnaps[i + 1].timestamp)
                : Math.min(currentTimeX, endOfDayX);
            const endX = Math.max(startX, rawEndX); // never go backwards

            const y = getYPosition(snap.available);

            // Only draw segments that are fully in the past (before current time)
            if (startX >= currentTimeX) continue;
            const clampedEndX = Math.min(endX, currentTimeX);
            if (clampedEndX <= startX) continue;

            // Horizontal segment
            lines.push(
                <line key={`h-${i}`}
                    x1={startX} y1={y} x2={clampedEndX} y2={y}
                    stroke="rgba(236, 72, 153, 0.5)"
                    strokeWidth="2" strokeDasharray="8 4"
                    className="pointer-events-none"
                />
            );

            // Vertical connector at this snapshot's X (the moment the value changed)
            if (i > 0 && sortedSnaps[i - 1].available !== snap.available) {
                const prevY = getYPosition(sortedSnaps[i - 1].available);
                const vertX = Math.max(0, getXPosition(snap.timestamp));
                if (vertX < currentTimeX) {
                    lines.push(
                        <line key={`v-${i}`}
                            x1={vertX} y1={prevY} x2={vertX} y2={y}
                            stroke="rgba(236, 72, 153, 0.5)"
                            strokeWidth="2" strokeDasharray="8 4"
                            className="pointer-events-none"
                        />
                    );
                }
            }
        }
        return lines;
    };

    // Solid line: always runs full width (0 → endOfDayX) at displayY.
    // The dashed history segments are rendered on top, so the solid line is visually
    // only "exposed" in the future (undashed) region.
    // This guarantees the line is always present and draggable on any date.
    const solidStartX = 0;
    const showSolidLine = true;

    return (
        <>
            <svg
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 5, pointerEvents: 'none' }}
            >
                {/* Solid line — full width, always visible, draggable.
                    Rendered FIRST (behind dashed history) so history overlays it. */}
                <g>
                    <line
                        x1={solidStartX} y1={displayY}
                        x2={endOfDayX}   y2={displayY}
                        stroke="rgba(236, 72, 153, 0.85)"
                        strokeWidth="2"
                        className="pointer-events-none"
                    />
                    <line
                        x1={solidStartX} y1={displayY}
                        x2={endOfDayX}   y2={displayY}
                        stroke="transparent" strokeWidth="20"
                        style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                        onMouseDown={handleLineMouseDown}
                    />
                </g>

                {/* Historical dashed trace — rendered ON TOP of solid line */}
                {renderHistoricalLines()}
            </svg>
        </>
    );
};

export default AircraftAvailabilityOverlay;