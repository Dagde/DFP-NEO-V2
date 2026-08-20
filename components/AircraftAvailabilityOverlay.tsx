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
    onUserChange?: (count: number, timestamp: Date) => void;
    // initialAvailability: last-resort fallback when no localStorage AND no DB data
    initialAvailability?: number;
    // apiBase: for DB fetch on first load of a date with no localStorage data
    apiBase?: string;
    locationCode?: string;
    unitCode?: string;
    // Explicitly controls the solid live availability line. Historical dates
    // should render only the dotted trace.
    showLiveAvailabilityLine?: boolean;
    isReadOnly?: boolean;
    linkedAvailabilityCount?: number | null;
    isLinkedAvailability?: boolean;
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
    locationCode,
    unitCode,
    showLiveAvailabilityLine,
    isReadOnly = false,
    linkedAvailabilityCount = null,
    isLinkedAvailability = false,
}) => {
    const [currentAvailable, setCurrentAvailable] = useState<number>(initialAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; available: number; label: string } | null>(null);
    const overlayRef = useRef<SVGSVGElement>(null);
    const effectiveAvailable = isLinkedAvailability && typeof linkedAvailabilityCount === 'number'
        ? Math.max(0, Math.min(totalAircraft, linkedAvailabilityCount))
        : currentAvailable;

    // Stable ref for onAvailabilityChange
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Sort snapshots by timestamp ascending — guarantees left-to-right rendering
    const sortSnapshots = (snaps: AircraftAvailabilitySnapshot[]): AircraftAvailabilitySnapshot[] =>
        [...snaps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Helper: make the day-start (0001) timestamp for a given date
    const makeDayStart = (date: Date): Date =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 1, 0);

    const getLocalDateString = (date: Date): string =>
        `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

    const isSelectedDateToday = (dateKey: string): boolean => dateKey === getLocalDateString(new Date());

    const isStoredSyntheticInitialOnly = (loaded: AircraftAvailabilitySnapshot[]): boolean => (
        loaded.length === 1
        && /initial availability at start of day/i.test(String(loaded[0]?.notes || ''))
    );

    const snapshotsFromDbEvents = (events: any[]): AircraftAvailabilitySnapshot[] => sortSnapshots(
        events
            .map((event: any) => {
                const available = Number(event.availableCount);
                const total = Number(event.totalAircraft ?? event.totalFleet ?? totalAircraft);
                const timestamp = new Date(event.timestamp);
                if (!Number.isFinite(available) || Number.isNaN(timestamp.getTime())) return null;
                return {
                    timestamp,
                    available,
                    total: Number.isFinite(total) ? total : totalAircraft,
                    notes: event.notes || event.changeType || 'Recorded aircraft availability',
                } as AircraftAvailabilitySnapshot;
            })
            .filter(Boolean) as AircraftAvailabilitySnapshot[]
    );

    // ── Load from exact-date DB events / localStorage on mount or date change ─────
    // Historical dotted traces must be fixed records for that date. Past/future dates
    // must never seed from the latest current-day availability.
    // dateString prop is preferred over formatDate(currentDate) to avoid UTC/local timezone issues.
    useEffect(() => {
        let cancelled = false;

        // Use dateString prop if provided (avoids UTC/local timezone mismatch from new Date(dateStr))
        // formatDate uses toISOString() which is UTC-based; if currentDate is UTC midnight it matches
        // the date string, but dateString (the canonical YYYY-MM-DD from App.tsx) is always correct.
        const dateKey = dateString ?? formatDate(currentDate);
        const contextKey = [locationCode || 'default-location', unitCode || 'default-unit', dateKey].join('|');

        const loadStoredSnapshots = (): AircraftAvailabilitySnapshot[] => {
            const stored = localStorage.getItem(`aircraft-availability-${contextKey}`);
            if (!stored) return [];
            try {
                const data = JSON.parse(stored);
                return sortSnapshots(
                    (Array.isArray(data.snapshots) ? data.snapshots : [])
                        .map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }))
                        .filter((s: AircraftAvailabilitySnapshot) => !Number.isNaN(new Date(s.timestamp).getTime()))
                );
            } catch {
                return [];
            }
        };

        const loadAvailabilityForDate = async () => {
            if (apiBase) {
                try {
                    const params = new URLSearchParams();
                    params.set('date', dateKey);
                    if (locationCode) params.set('locationCode', locationCode);
                    if (unitCode) params.set('unitCode', unitCode);
                    const res = await fetch(`${apiBase}/aircraft-availability-events?${params.toString()}`, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        const dbSnapshots = snapshotsFromDbEvents(Array.isArray(data.events) ? data.events : []);
                        if (!cancelled && dbSnapshots.length > 0) {
                            const lastAvailable = dbSnapshots[dbSnapshots.length - 1]?.available ?? initialAvailability;
                            setSnapshots(dbSnapshots);
                            setCurrentAvailable(lastAvailable);
                            return;
                        }
                    }
                } catch {
                    // ignore — use local stored data or today seed
                }
            }

            const storedSnapshots = loadStoredSnapshots();
            if (!cancelled && storedSnapshots.length > 0) {
                if (!isSelectedDateToday(dateKey) && isStoredSyntheticInitialOnly(storedSnapshots)) {
                    setSnapshots([]);
                    return;
                }
                const lastAvailable = storedSnapshots[storedSnapshots.length - 1]?.available ?? initialAvailability;
                setSnapshots(storedSnapshots);
                setCurrentAvailable(lastAvailable);
                return;
            }

            if (!isSelectedDateToday(dateKey)) {
                if (!cancelled) setSnapshots([]);
                return;
            }

            let seed = initialAvailability;
            if (apiBase) {
                try {
                    const params = new URLSearchParams();
                    if (locationCode) params.set('locationCode', locationCode);
                    if (unitCode) params.set('unitCode', unitCode);
                    const query = params.toString();
                    const res = await fetch(`${apiBase}/aircraft-availability-current${query ? `?${query}` : ''}`, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && !data.isDefault && typeof data.availableCount === 'number') seed = data.availableCount;
                    }
                } catch {
                    // ignore — use configured initial availability
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

        loadAvailabilityForDate();
        return () => { cancelled = true; };
    // Use dateString if provided (canonical date, no timezone issues), otherwise use local date fields
    }, [dateString ?? `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`, locationCode, unitCode]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const contextKey = [locationCode || 'default-location', unitCode || 'default-unit', dateKey].join('|');
        const record: DailyAvailabilityRecord = {
            date: dateKey,
            snapshots,
            averageAvailability: avg,
            dayFlyingStart,
            dayFlyingEnd
        };
        localStorage.setItem(`aircraft-availability-${contextKey}`, JSON.stringify(record));
        onAvailabilityChangeRef.current(record);
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate, dateString, locationCode, unitCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Coordinate → pixel helpers ──────────────────────────────────────────────
    const getYPosition = (count: number): number => count * rowHeight;

    const getXPosition = (time: Date): number => {
        const t = new Date(time);
        const hours = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
        return (hours - startHour) * pixelsPerHour;
    };

    const getEndOfDayX = (): number =>
        getXPosition(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59));

    const formatHoverTimeFromX = (x: number): string => {
        const totalMinutes = Math.max(0, Math.round((startHour * 60) + (x / pixelsPerHour) * 60));
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const updateHoverInfo = (event: React.MouseEvent<SVGLineElement>, available: number, label?: string) => {
        if (!overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        setHoverInfo({
            x: Math.max(72, Math.min(rect.width - 72, x)),
            y: Math.max(48, Math.min(gridHeight - 8, getYPosition(available))),
            available,
            label: label || formatHoverTimeFromX(x),
        });
    };

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
    useEffect(() => {
        if (!isLinkedAvailability || typeof linkedAvailabilityCount !== 'number') return;
        setCurrentAvailable(Math.max(0, Math.min(totalAircraft, linkedAvailabilityCount)));
    }, [isLinkedAvailability, linkedAvailabilityCount, totalAircraft]);

    const handleLineMouseDown = async (e: React.MouseEvent) => {
        if (isReadOnly || isLinkedAvailability) return;
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

            setSnapshots(prev => sortSnapshots([...prev, newSnap]));
            // Notify parent of user-driven change (for DB posting) with the exact snapshot time.
            if (onUserChange) onUserChange(snappedCount, snapshotTime);
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
    const displayY = isDragging ? dragY : getYPosition(effectiveAvailable);
    const endOfDayX = getEndOfDayX();
    const now = new Date();
    const currentTimeX = getXPosition(now);

    const sortedSnaps = sortSnapshots(snapshots);

    const renderHistoricalLines = (historyEndX: number) => {
        if (sortedSnaps.length === 0) return null;
        const lines: React.ReactNode[] = [];

        for (let i = 0; i < sortedSnaps.length; i++) {
            const snap = sortedSnaps[i];
            const startX = i === 0 ? 0 : Math.max(0, getXPosition(snap.timestamp));
            const rawEndX = i < sortedSnaps.length - 1
                ? getXPosition(sortedSnaps[i + 1].timestamp)
                : historyEndX;
            const endX = Math.max(startX, rawEndX);

            const y = getYPosition(snap.available);
            if (startX >= historyEndX) continue;
            const clampedEndX = Math.min(endX, historyEndX);
            if (clampedEndX <= startX) continue;

            lines.push(
                <g key={`h-${i}`}>
                    <line
                        x1={startX} y1={y} x2={clampedEndX} y2={y}
                        stroke="rgba(236, 72, 153, 0.5)"
                        strokeWidth="2" strokeDasharray="8 4"
                        className="pointer-events-none"
                    />
                    <line
                        x1={startX} y1={y} x2={clampedEndX} y2={y}
                        stroke="transparent" strokeWidth="16"
                        style={{ pointerEvents: 'auto', cursor: 'default' }}
                        onMouseMove={(event) => updateHoverInfo(event, snap.available)}
                        onMouseEnter={(event) => updateHoverInfo(event, snap.available)}
                        onMouseLeave={() => setHoverInfo(null)}
                    />
                </g>
            );

            if (i > 0 && sortedSnaps[i - 1].available !== snap.available) {
                const prevY = getYPosition(sortedSnaps[i - 1].available);
                const vertX = Math.max(0, getXPosition(snap.timestamp));
                if (vertX < historyEndX) {
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

    // Solid line is the live/current availability marker. It should only appear
    // on the current day; past days are represented by the dotted history trace,
    // and future days should not show an availability line at all.
    // Use dateString prop if provided (canonical YYYY-MM-DD from App.tsx, timezone-correct).
    // Fallback: use local date string comparison to avoid UTC/local timezone mismatch
    // (currentDate may be created from a YYYY-MM-DD string which is parsed as UTC midnight)
    const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = localDateStr(now);
    const selectedDateStr = dateString ?? localDateStr(currentDate);
    const isFutureDate = selectedDateStr > todayStr;
    const isToday = selectedDateStr === todayStr && (showLiveAvailabilityLine ?? true);
    const showSolidLine = isToday;
    const showHistoryTrace = !isFutureDate;
    const solidStartX = Math.min(currentTimeX, endOfDayX - 1);
    const historyEndX = isToday ? Math.min(currentTimeX, endOfDayX) : endOfDayX;

    return (
        <>
            <svg
                ref={overlayRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ zIndex: 5, pointerEvents: 'none' }}
            >
                {showHistoryTrace && renderHistoricalLines(historyEndX)}
                {showSolidLine && <g>
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
                        style={{ pointerEvents: 'auto', cursor: isLinkedAvailability ? 'default' : 'ns-resize' }}
                        onMouseMove={(event) => updateHoverInfo(event, effectiveAvailable)}
                        onMouseEnter={(event) => updateHoverInfo(event, effectiveAvailable)}
                        onMouseLeave={() => setHoverInfo(null)}
                        onMouseDown={handleLineMouseDown}
                    />
                </g>}
                {hoverInfo && (
                    <g className="pointer-events-none">
                        <rect
                            x={hoverInfo.x - 65}
                            y={hoverInfo.y - 52}
                            width="130"
                            height="44"
                            rx="6"
                            fill="#1f2937"
                            stroke="#374151"
                            strokeWidth="1"
                        />
                        <text
                            x={hoverInfo.x}
                            y={hoverInfo.y - 36}
                            textAnchor="middle"
                            fontSize="11"
                            fill="#9ca3af"
                        >
                            {hoverInfo.label}
                        </text>
                        <text
                            x={hoverInfo.x}
                            y={hoverInfo.y - 19}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="bold"
                            fill="#ec4899"
                        >
                            {hoverInfo.available} aircraft
                        </text>
                    </g>
                )}
            </svg>
        </>
    );
};

export default AircraftAvailabilityOverlay;
