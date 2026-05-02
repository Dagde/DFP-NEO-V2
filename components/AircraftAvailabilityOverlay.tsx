import { showDarkAlert } from './DarkMessageModal';
import React, { useState, useEffect, useRef } from 'react';
import { AircraftAvailabilitySnapshot, DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { calculateDailyAverageAvailability, formatDate, convertSnapshotsToTimeline } from '../utils/aircraftAvailabilityUtils';
import { logAudit } from '../utils/auditLogger';

interface AircraftAvailabilityOverlayProps {
    currentDate: Date;
    // dateString: canonical YYYY-MM-DD string for this date (used as localStorage key).
    // If provided, avoids timezone issues from Date conversion. Must match the date shown.
    dateString?: string;
    totalAircraft: number;
    dayFlyingStart: string; // HH:mm
    dayFlyingEnd: string;   // HH:mm
    gridHeight: number;
    rowHeight: number;
    pixelsPerHour: number;
    startHour: number;
    onAvailabilityChange: (record: DailyAvailabilityRecord) => void;
    // onUserChange: called ONLY when user drags the line (for DB posting)
    onUserChange?: (count: number) => void;
    // initialAvailability: last-resort fallback when no localStorage AND no DB data
    initialAvailability?: number;
    // apiBase: for DB fetch on first load of a date with no localStorage data
    apiBase?: string;
}

const AircraftAvailabilityOverlay: React.FC<AircraftAvailabilityOverlayProps> = ({
    currentDate,
    dateString,
    totalAircraft,
    dayFlyingStart,
    dayFlyingEnd,
    gridHeight,
    rowHeight,
    pixelsPerHour,
    startHour,
    onAvailabilityChange,
    onUserChange,
    initialAvailability = 15,
    apiBase,
}) => {
    const [currentAvailable, setCurrentAvailable] = useState<number>(initialAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const overlayRef = useRef<SVGSVGElement>(null);

    // Stable ref for onAvailabilityChange
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Sort snapshots by timestamp ascending — guarantees left-to-right rendering
    const sortSnapshots = (snaps: AircraftAvailabilitySnapshot[]): AircraftAvailabilitySnapshot[] =>
        [...snaps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Helper: make the day-start (0001) timestamp for a given date
    const makeDayStart = (date: Date): Date =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 1, 0);

    // ── Load from localStorage on mount / date change ────────────────────────────
    // If no localStorage data, fetch from DB; if DB also has nothing, use initialAvailability.
    // NOTE: We do NOT gate on isDirty — always load from storage to ensure correct restore.
    // dateString prop is preferred over formatDate(currentDate) to avoid UTC/local timezone issues.
    useEffect(() => {
        let cancelled = false;

        // Use dateString prop if provided (avoids UTC/local timezone mismatch from new Date(dateStr))
        // formatDate uses toISOString() which is UTC-based; if currentDate is UTC midnight it matches
        // the date string, but dateString (the canonical YYYY-MM-DD from App.tsx) is always correct.
        const dateKey = dateString ?? formatDate(currentDate);
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
                    return;
                }
            } catch {
                // Corrupted data — fall through to DB
            }
        }

        // No localStorage — fetch persisted value from DB
        const loadFromDb = async () => {
            let seed = initialAvailability;
            if (apiBase) {
                try {
                    const res = await fetch(`${apiBase}/aircraft-availability-current`, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && !data.isDefault && typeof data.availableCount === 'number') {
                            seed = data.availableCount;
                        }
                    }
                } catch {
                    // ignore — use seed
                }
            }
            if (!cancelled) {
                const initial: AircraftAvailabilitySnapshot = {
                    timestamp: makeDayStart(currentDate),
                    available: seed,
                    total: totalAircraft,
                    notes: 'Initial availability at start of day'
                };
                setSnapshots([initial]);
                setCurrentAvailable(seed);
                logAudit({
                    page: "Program Schedule",
                    action: "Add",
                    description: `Aircraft availability initialized at ${seed}`,
                    changes: `Initial: ${seed} | Total: ${totalAircraft}`
                });
            }
        };

        loadFromDb();
        return () => { cancelled = true; };
    // Use dateString if provided (canonical date, no timezone issues), otherwise use local date fields
    }, [dateString ?? `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Save to localStorage + notify parent whenever snapshots change ────────────
    // Always saves (same as working version) — ensures data is always persisted
    useEffect(() => {
        if (snapshots.length === 0) return;
        const timeline = convertSnapshotsToTimeline(snapshots);
        const avg = calculateDailyAverageAvailability(
            timeline,
            dayFlyingStart.replace(':', ''),
            dayFlyingEnd.replace(':', '')
        );
        // Use dateString prop if provided (avoids UTC/local timezone mismatch)
        const dateKey = dateString ?? formatDate(currentDate);
        const record: DailyAvailabilityRecord = {
            date: dateKey,
            snapshots,
            averageAvailability: avg,
            dayFlyingStart,
            dayFlyingEnd
        };
        localStorage.setItem(`aircraft-availability-${record.date}`, JSON.stringify(record));
        onAvailabilityChangeRef.current(record);
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate, dateString]); // eslint-disable-line react-hooks/exhaustive-deps

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

            // Notify parent of user-driven change (for DB posting)
            if (onUserChange) onUserChange(snappedCount);
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

    // ── Render ──────────────────────────────────────────────────────────────────
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

    // Solid line: starts at current time for today, X=0 for other dates
    // Use dateString prop if provided (canonical YYYY-MM-DD from App.tsx, timezone-correct).
    // Fallback: use local date string comparison to avoid UTC/local timezone mismatch
    // (currentDate may be created from a YYYY-MM-DD string which is parsed as UTC midnight)
    const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = localDateStr(now);
    const isToday = dateString ? (dateString === todayStr) : (localDateStr(currentDate) === todayStr);
    const solidStartX = isToday ? Math.min(currentTimeX, endOfDayX - 1) : 0;

    return (
        <>
            <svg
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 5, pointerEvents: 'none' }}
            >
                {renderHistoricalLines()}
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
            </svg>
        </>
    );
};

export default AircraftAvailabilityOverlay;