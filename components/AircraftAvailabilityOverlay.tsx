import { showDarkAlert } from './DarkMessageModal';
import React, { useState, useEffect, useRef } from 'react';
import { AircraftAvailabilitySnapshot, DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { calculateDailyAverageAvailability, formatDate, convertSnapshotsToTimeline } from '../utils/aircraftAvailabilityUtils';
import { logAudit } from '../utils/auditLogger';

interface AircraftAvailabilityOverlayProps {
    currentDate: Date;
    totalAircraft: number;
    dayFlyingStart: string; // HH:mm
    dayFlyingEnd: string;   // HH:mm
    gridHeight: number;
    rowHeight: number;
    pixelsPerHour: number;
    startHour: number;
    onAvailabilityChange: (record: DailyAvailabilityRecord) => void;
    // initialAvailability: ONLY used as last-resort fallback when no localStorage AND no DB data exists
    initialAvailability?: number;
    // apiBase: passed from App.tsx so we can fetch persisted value from DB on first load
    apiBase?: string;
}

const AircraftAvailabilityOverlay: React.FC<AircraftAvailabilityOverlayProps> = ({
    currentDate,
    totalAircraft,
    dayFlyingStart,
    dayFlyingEnd,
    gridHeight,
    rowHeight,
    pixelsPerHour,
    startHour,
    onAvailabilityChange,
    initialAvailability = 15,
    apiBase,
}) => {
    // isInitialized: true once we've loaded from localStorage or DB
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentAvailable, setCurrentAvailable] = useState<number>(initialAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const overlayRef = useRef<SVGSVGElement>(null);
    // Track whether the current snapshots came from a user drag (should save) or from init (should not overwrite)
    const isDirtyRef = useRef(false);

    // Stable ref for onAvailabilityChange
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Helper: make the day-start (0001) timestamp for a given date
    const makeDayStart = (date: Date): Date => {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 1, 0);
    };

    // Sort snapshots by timestamp ascending — guarantees left-to-right rendering
    const sortSnapshots = (snaps: AircraftAvailabilitySnapshot[]): AircraftAvailabilitySnapshot[] =>
        [...snaps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // ── Load from localStorage first, then DB, then fallback to initialAvailability ──
    useEffect(() => {
        let cancelled = false;
        isDirtyRef.current = false;
        setIsInitialized(false);

        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);

        if (stored) {
            try {
                const data = JSON.parse(stored);
                const loaded: AircraftAvailabilitySnapshot[] = sortSnapshots(
                    data.snapshots.map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }))
                );
                if (!cancelled && loaded.length > 0) {
                    const lastAvailable = loaded[loaded.length - 1]?.available ?? initialAvailability;
                    setSnapshots(loaded);
                    setCurrentAvailable(lastAvailable);
                    setIsInitialized(true);
                    return;
                }
            } catch {
                // Corrupted data — fall through to DB fetch
            }
        }

        // No localStorage data — try DB for persisted value
        const loadFromDb = async () => {
            let persistedCount = initialAvailability;
            if (apiBase) {
                try {
                    const res = await fetch(`${apiBase}/aircraft-availability-current`, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && !data.isDefault && data.availableCount !== undefined) {
                            persistedCount = data.availableCount;
                        }
                    }
                } catch {
                    // DB fetch failed — use initialAvailability fallback
                }
            }

            if (!cancelled) {
                const initial: AircraftAvailabilitySnapshot = {
                    timestamp: makeDayStart(currentDate),
                    available: persistedCount,
                    total: totalAircraft,
                    notes: 'Initial availability at start of day'
                };
                setSnapshots([initial]);
                setCurrentAvailable(persistedCount);
                setIsInitialized(true);
                logAudit({
                    page: "Program Schedule",
                    action: "Add",
                    description: `Aircraft availability initialized at ${persistedCount}`,
                    changes: `Initial: ${persistedCount} | Total: ${totalAircraft}`
                });
            }
        };

        loadFromDb();
        return () => { cancelled = true; };
    }, [currentDate.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Save to localStorage + notify parent ONLY when user drags (isDirty) ────
    useEffect(() => {
        if (!isInitialized || snapshots.length === 0 || !isDirtyRef.current) return;

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
    }, [snapshots]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Coordinate → pixel helpers ──────────────────────────────────────────────
    const getYPosition = (count: number): number => count * rowHeight;

    const getXPosition = (time: Date): number => {
        const t = new Date(time);
        const hours = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
        return (hours - startHour) * pixelsPerHour;
    };

    const getEndOfDayX = (): number =>
        getXPosition(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59));

    // ── Drag state ──────────────────────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);
    const [dragY, setDragY] = useState(0);
    const isDraggingRef = useRef(false);
    const dragYRef = useRef(0);
    const snapshotsRef = useRef(snapshots);
    const rowHeightRef = useRef(rowHeight);
    const totalAircraftRef = useRef(totalAircraft);
    const initialAvailabilityRef = useRef(initialAvailability);
    const currentDateRef = useRef(currentDate);
    useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
    useEffect(() => { rowHeightRef.current = rowHeight; }, [rowHeight]);
    useEffect(() => { totalAircraftRef.current = totalAircraft; }, [totalAircraft]);
    useEffect(() => { initialAvailabilityRef.current = initialAvailability; }, [initialAvailability]);
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
            : initialAvailabilityRef.current;
        const valueChanged = snappedCount !== previousAvailability;

        setCurrentAvailable(snappedCount);

        if (valueChanged) {
            logAudit({
                page: "Program Schedule",
                action: "Edit",
                description: `Aircraft availability changed from ${previousAvailability} to ${snappedCount}`,
                changes: `Previous: ${previousAvailability} | New: ${snappedCount} | Total: ${totalAircraftRef.current}`
            });

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

            // Mark dirty so the save effect fires
            isDirtyRef.current = true;
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

    // ── Render values ────────────────────────────────────────────────────────────
    const displayY = isDragging ? dragY : getYPosition(currentAvailable);
    const endOfDayX = getEndOfDayX();
    const now = new Date();
    const currentTimeX = getXPosition(now);

    const sortedSnaps = sortSnapshots(snapshots);

    const renderHistoricalLines = () => {
        if (sortedSnaps.length === 0) return null;
        const lines: React.ReactNode[] = [];

        for (let i = 0; i < sortedSnaps.length; i++) {
            const snap = sortedSnaps[i];
            const startX = i === 0 ? 0 : Math.max(0, getXPosition(snap.timestamp));
            const rawEndX = i < sortedSnaps.length - 1
                ? getXPosition(sortedSnaps[i + 1].timestamp)
                : Math.min(currentTimeX, endOfDayX);
            const endX = Math.max(startX, rawEndX);

            const y = getYPosition(snap.available);

            if (startX >= currentTimeX) continue;
            const clampedEndX = Math.min(endX, currentTimeX);
            if (clampedEndX <= startX) continue;

            lines.push(
                <line key={`h-${i}`}
                    x1={startX} y1={y} x2={clampedEndX} y2={y}
                    stroke="rgba(236, 72, 153, 0.5)"
                    strokeWidth="2" strokeDasharray="8 4"
                    className="pointer-events-none"
                />
            );

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

    const isToday = currentDate.toDateString() === now.toDateString();
    const solidStartX = isToday ? Math.min(currentTimeX, endOfDayX - 1) : 0;
    const showSolidLine = true;

    return (
        <>
            <svg
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 5, pointerEvents: 'none' }}
            >
                {renderHistoricalLines()}

                {showSolidLine && (
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
                )}
            </svg>
        </>
    );
};

export default AircraftAvailabilityOverlay;