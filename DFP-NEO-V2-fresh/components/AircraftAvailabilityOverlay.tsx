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
    // Stable ref for onAvailabilityChange to avoid re-running snapshots effect on every render
    const onAvailabilityChangeRef = useRef(onAvailabilityChange);
    useEffect(() => { onAvailabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);

    // Load snapshots from localStorage on mount / date change ONLY
    // NOTE: plannedAvailability intentionally excluded from deps to avoid resetting on every slider move
    useEffect(() => {
        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
        if (stored) {
            const data = JSON.parse(stored);
            setSnapshots(data.snapshots.map((s: any) => ({
                ...s,
                timestamp: new Date(s.timestamp)
            })));
            const lastAvailable = data.snapshots[data.snapshots.length - 1]?.available ?? plannedAvailability;
            setCurrentAvailable(lastAvailable);
            console.log('[LAST_SET] SET TO', lastAvailable, '(from localStorage load)');
            lastSetByOverlay.current = lastAvailable;
        } else {
            // Initialize with planned availability at start of day (0001)
            const initialSnapshot: AircraftAvailabilitySnapshot = {
                timestamp: (() => { const dayStart = new Date(currentDate); dayStart.setHours(0, 0, 1, 0); return dayStart; })(),
                available: plannedAvailability,
                total: totalAircraft,
                notes: 'Initial planned availability at start of day'
            };
            setSnapshots([initialSnapshot]);
            setCurrentAvailable(plannedAvailability);
            console.log('[LAST_SET] SET TO', plannedAvailability, '(from initial snapshot)');
            lastSetByOverlay.current = plannedAvailability;
                
                // Log audit record for initial availability setup
                const initialDescription = `Aircraft availability initialized at ${plannedAvailability} (${totalAircraft - plannedAvailability} aircraft unavailable)`;
                const initialDetails = `Time: ${new Date().toLocaleTimeString()} | Initial: ${plannedAvailability} | Total: ${totalAircraft} | Type: Initial setup`;
                logAudit({
                    page: "Program Schedule",
                    action: "Add",
                    description: initialDescription,
                    changes: initialDetails
                });
        }
    }, [currentDate.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps - use string to avoid new Date() reference changes



    // Save and calculate average whenever snapshots change
    // NOTE: onAvailabilityChange intentionally excluded from deps (use ref) to avoid re-render loop
    useEffect(() => {
        if (snapshots.length > 0) {
            // Convert snapshots to timeline format for calculation
            const timeline = convertSnapshotsToTimeline(snapshots);
            
            // Calculate average only using data within flying window
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

    // Calculate Y position for a given aircraft count (snap to lower grid line)
    const getYPosition = (aircraftCount: number): number => {
        // Available aircraft = rows from top
        // So Y position = aircraftCount * rowHeight
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

    // Handle drag start
    const [isDragging, setIsDragging] = useState(false);
    const [dragY, setDragY] = useState(0); // Store raw Y position during drag
    const [mouseX, setMouseX] = useState(0); // Store mouse X position for tooltip
    // Refs to avoid stale closures in event listeners
    const isDraggingRef = useRef(false);
    const dragYRef = useRef(0);
    const snapshotsRef = useRef(snapshots);
    const rowHeightRef = useRef(rowHeight);
    const totalAircraftRef = useRef(totalAircraft);
    useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);
    useEffect(() => { rowHeightRef.current = rowHeight; }, [rowHeight]);
    useEffect(() => { totalAircraftRef.current = totalAircraft; }, [totalAircraft]);
    // Sync line position when plannedAvailability changes from OUTSIDE (e.g. Settings panel slider moved)
    useEffect(() => {
        // Don't sync if we're currently dragging - drag end will handle it
        if (isDraggingRef.current) {
            return;
        }
        if (plannedAvailability !== lastSetByOverlay.current) {
            setCurrentAvailable(plannedAvailability);
        } else {
        }
    }, [plannedAvailability]);


    // Handle drag start on the solid line
    const handleLineMouseDown = (e: React.MouseEvent) => {
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

    // Handle drag move - smooth movement with raw Y position
    const handleDragMove = (e: MouseEvent) => {
        if (!isDragging || !overlayRef.current) return;

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

    // Handle drag end - snap to nearest whole number based on final drag position
    // Uses refs to avoid stale closure issues with event listeners
    const handleDragEnd = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            
            // Use ref values to avoid stale closures
            const finalDragY = dragYRef.current;
            const currentRowHeight = rowHeightRef.current;
            const currentTotalAircraft = totalAircraftRef.current;
            const currentSnapshots = snapshotsRef.current;

            
            // Calculate aircraft count from final drag Y position
            const rowsFromTop = finalDragY / currentRowHeight;
            const exactCount = rowsFromTop;
            
            // Snap to nearest whole number
            const snappedCount = Math.round(Math.max(0, Math.min(currentTotalAircraft, exactCount)));
            
            const previousAvailability = currentSnapshots[currentSnapshots.length - 1]?.available || plannedAvailability;
            const valueChanged = snappedCount !== previousAvailability;
            
            console.log('✅ DRAG END:', {
                timestamp: new Date().toISOString(),
                dragY: dragY.toFixed(2),
                rowsFromTop: rowsFromTop.toFixed(2),
                exactCount: exactCount.toFixed(2),
                snappedCount: snappedCount,
                previousAvailability: previousAvailability,
                valueChanged: valueChanged,
                snapshotsBeforeUpdate: snapshots.length
            });
            
            // ALWAYS update lastSetByOverlay BEFORE any state/prop changes
            // This prevents the plannedAvailability sync useEffect from overwriting our drag result
            console.log('[LAST_SET] SET TO', snappedCount, '(from drag end)');
            lastSetByOverlay.current = snappedCount;
            setCurrentAvailable(snappedCount);

            // Sync with Settings panel slider
            if (valueChanged) {
                if (onUpdatePlannedAvailability) {
                    onUpdatePlannedAvailability(snappedCount);
                } else {
                }
            }
            
                // Log audit record for availability change
                const changeDescription = `Aircraft availability changed from ${previousAvailability} to ${snappedCount} (${currentTotalAircraft - snappedCount} aircraft unavailable)`;
                const changeDetails = `Time: ${new Date().toLocaleTimeString()} | Previous: ${previousAvailability} | New: ${snappedCount} | Total: ${currentTotalAircraft}`;
                logAudit({
                    page: "Program Schedule",
                    action: "Edit",
                    description: changeDescription,
                    changes: changeDetails
                });

            // Create new snapshot if value changed
            if (valueChanged) {
                // Create timestamp using currentDate as base, with current time
                   const now = new Date();
                   
                   // Create snapshot time preserving local timezone
                   const snapshotTime = new Date(
                       currentDate.getFullYear(),
                       currentDate.getMonth(),
                       currentDate.getDate(),
                       now.getHours(),
                       now.getMinutes(),
                       now.getSeconds(),
                       now.getMilliseconds()
                   );
                
                console.log('🕐 TIMESTAMP DEBUG:', {
                    now: now.toISOString(),
                    nowLocal: now.toLocaleString(),
                    currentDate: currentDate.toISOString(),
                    currentDateLocal: currentDate.toLocaleString(),
                    snapshotTime: snapshotTime.toISOString(),
                    snapshotTimeLocal: snapshotTime.toLocaleString(),
                    nowHours: now.getHours(),
                    nowMinutes: now.getMinutes(),
                    snapshotHours: snapshotTime.getHours(),
                    snapshotMinutes: snapshotTime.getMinutes()
                });
                
                const newSnapshot: AircraftAvailabilitySnapshot = {
                    timestamp: snapshotTime,
                    available: snappedCount,
                    total: currentTotalAircraft,
                    notes: `Availability changed to ${snappedCount}`
                };
                
                console.log('📸 CREATING NEW SNAPSHOT:', {
                    newSnapshot: {
                        time: newSnapshot.timestamp.toLocaleTimeString(),
                        available: newSnapshot.available,
                        total: newSnapshot.total
                 },
                    snapshotsAfterUpdate: snapshots.length + 1
                });
                
                setSnapshots(prev => {
                    const updated = [...prev, newSnapshot];
                    console.log('📊 SNAPSHOTS UPDATED:', {
                        count: updated.length,
                        all: updated.map(s => ({
                            time: s.timestamp.toLocaleTimeString(),
                            available: s.available
                     }))
                 });
                    return updated;
                });
            } else {
                console.log('⏭️ NO SNAPSHOT CREATED - Value unchanged');
            }
        }
    };

    // Add global mouse event listeners for dragging
    // Only depends on isDragging - handlers use refs to avoid stale closures
    useEffect(() => {
        if (isDraggingRef.current) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            return () => {
                window.removeEventListener('mousemove', handleDragMove);
                window.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update component every minute to transition solid line to dashed as time passes
    const [, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute

        return () => clearInterval(timer);
    }, []);

    // Use dragY during dragging for smooth movement, otherwise use calculated position
    const displayY = isDragging ? dragY : getYPosition(currentAvailable);
    const currentY = getYPosition(currentAvailable); // Keep for tooltip positioning
    const endOfDayX = getEndOfDayX();

    // Render historical segments - each segment between snapshots
    const renderHistoricalLines = () => {
        if (snapshots.length === 0) {
            console.log('📏 RENDER HISTORICAL LINES: No snapshots');
            return null;
        }
        
        // Get current time to determine which snapshots are historical
        const now = new Date();
        const currentTimeX = getXPosition(now);
        
           // Use all snapshots without filtering
           const filteredSnapshots = snapshots;

           console.log("📏 RENDER HISTORICAL LINES:", {
               originalCount: snapshots.length,
               filteredCount: filteredSnapshots.length,
               isDragging: isDragging,
               currentAvailable: currentAvailable,
               currentTimeX: currentTimeX.toFixed(2)
           });

        
        const lines = [];
        for (let i = 0; i < filteredSnapshots.length; i++) {
            const snapshot = filteredSnapshots[i];
            const snapshotX = getXPosition(snapshot.timestamp);
            
            // Only render this segment if the snapshot is in the past (before current time)
            // Skip the last snapshot if it's at or after current time (it will be rendered separately)
            if (i === filteredSnapshots.length - 1 && snapshotX >= currentTimeX) {
                console.log(`  ⏭️ Skipping Line ${i} (most recent, at/after current time)`);
                continue;
            }
            
            // For the first snapshot, start from the beginning of the day (0 hours)
            const startX = i === 0 ? 0 : snapshotX;
            const endX = i === filteredSnapshots.length - 1 ? currentTimeX : getXPosition(filteredSnapshots[i + 1].timestamp);
            const y = getYPosition(snapshot.available);
            
            // Only log specific lines to reduce spam
               if (i === 0 || i === 5 || i === filteredSnapshots.length - 1) {
                   console.log(`  📍 Line ${i}:`, {
                time: snapshot.timestamp.toLocaleTimeString(),
                available: snapshot.available,
                startX: startX.toFixed(2),
                endX: endX.toFixed(2),
                y: y.toFixed(2),
                       timestampRaw: snapshot.timestamp.toISOString()

               });
               }
            
            // Add horizontal line for this segment
            lines.push(
                <line
                    key={`history-${i}`}
                    x1={startX}
                    y1={y}
                    x2={endX}
                    y2={y}
                    stroke="rgba(236, 72, 153, 0.4)"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    className="pointer-events-none"
                />
            );
            
            // Add vertical connector line if there's a previous snapshot with different availability
            if (i > 0) {
                const prevSnapshot = filteredSnapshots[i - 1];
                const prevY = getYPosition(prevSnapshot.available);
                
                // Only add vertical line if availability changed
                if (prevSnapshot.available !== snapshot.available) {
                    // Draw vertical line at startX (where previous segment ends and new one begins)
                    lines.push(
                        <line
                            key={`vertical-${i}`}
                            x1={startX}
                            y1={prevY}
                            x2={startX}
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

    // Get the last snapshot for the solid line
    const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const lastChangeX = lastSnapshot ? getXPosition(lastSnapshot.timestamp) : 0;
    
    // Get current time position
    const now = new Date();
    const currentTimeX = getXPosition(now);
    
    // Debug timestamp comparison
    if (lastSnapshot) {
        console.log('🕐 TIMESTAMP COMPARISON:', {
            now: now.toISOString(),
            nowLocal: now.toLocaleTimeString(),
            nowHours: now.getHours(),
            nowMinutes: now.getMinutes(),
            lastSnapshotTime: lastSnapshot.timestamp.toISOString(),
            lastSnapshotLocal: lastSnapshot.timestamp.toLocaleTimeString(),
            lastSnapshotHours: lastSnapshot.timestamp.getHours(),
            lastSnapshotMinutes: lastSnapshot.timestamp.getMinutes(),
            currentTimeX: currentTimeX.toFixed(2),
            lastChangeX: lastChangeX.toFixed(2),
            difference: (currentTimeX - lastChangeX).toFixed(2)
        });
    }
    
    // Determine if we need to split the line into history (dashed) and future (solid)
    const needsSplit = lastSnapshot && currentTimeX > lastChangeX && currentTimeX < endOfDayX;
    
    console.log('🎯 SOLID LINE CALCULATION:', {
        hasLastSnapshot: !!lastSnapshot,
        lastSnapshotTime: lastSnapshot?.timestamp.toLocaleTimeString(),
           lastSnapshotTimestamp: lastSnapshot?.timestamp.toISOString(),
        lastSnapshotAvailable: lastSnapshot?.available,
        lastChangeX: lastChangeX.toFixed(2),
        currentTimeX: currentTimeX.toFixed(2),
        endOfDayX: endOfDayX.toFixed(2),
        displayY: displayY.toFixed(2),
        isDragging: isDragging,
        needsSplit: needsSplit,
           currentTime: now.toISOString(),
           currentDate: currentDate.toISOString()
    });

    return (<>
        <svg
            ref={overlayRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ zIndex: 5, pointerEvents: 'none' }}
        >
            {/* Historical dashed lines - one segment for each snapshot period */}
            {renderHistoricalLines()}

               {/* Solid line for current availability - from last change to end of day - DRAGGABLE */}
{lastSnapshot && (
                      <g>
                          {needsSplit ? (
                              <>
                                  {/* Solid line from current time to end of day (future) */}
                                  <line
                                      x1={currentTimeX}
                                      y1={displayY}
                                      x2={endOfDayX}
                                      y2={displayY}
                                      stroke="rgba(236, 72, 153, 0.4)"
                                      strokeWidth="2"
                                      className="pointer-events-none"
                                  />
                                  {/* Invisible wider line for easier clicking/dragging - only on future part */}
                                  <line
                                      x1={currentTimeX}
                                      y1={displayY}
                                      x2={endOfDayX}
                                      y2={displayY}
                                      stroke="transparent"
                                      strokeWidth="20"
                                      style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                                      onMouseDown={handleLineMouseDown}
                                  />
                              </>
) : (
                                <>
                                    {/* If current time is before last change, split into historical and future */}
                                    {currentTimeX < lastChangeX ? (
                                        <>
                                            {/* Dashed line from last change to current time (historical - uses last snapshot Y) */}
                                            <line
                                                x1={lastChangeX}
                                                y1={getYPosition(lastSnapshot.available)}
                                                x2={currentTimeX}
                                                y2={getYPosition(lastSnapshot.available)}
                                                stroke="rgba(236, 72, 153, 0.4)"
                                                strokeWidth="2"
                                                strokeDasharray="8 4"
                                                className="pointer-events-none"
                                            />
                                            {/* Solid line from current time to end of day (future - uses displayY) */}
                                            <line
                                                x1={currentTimeX}
                                                y1={displayY}
                                                x2={endOfDayX}
                                                y2={displayY}
                                                stroke="rgba(236, 72, 153, 0.4)"
                                                strokeWidth="2"
                                                className="pointer-events-none"
                                            />
                                            {/* Invisible wider line for easier clicking/dragging - only on future part */}
                                            <line
                                                x1={currentTimeX}
                                                y1={displayY}
                                                x2={endOfDayX}
                                                y2={displayY}
                                                stroke="transparent"
                                                strokeWidth="20"
                                                style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                                                onMouseDown={handleLineMouseDown}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            {/* If current time is after last change or after end of day, show full line */}
                                            <line
                                                x1={lastChangeX}
                                                y1={displayY}
                                                x2={endOfDayX}
                                                y2={displayY}
                                                stroke="rgba(236, 72, 153, 0.4)"
                                                strokeWidth="2"
                                                strokeDasharray={currentTimeX >= endOfDayX ? "8 4" : undefined}
                                                className="pointer-events-none"
                                            />
                                            {/* Invisible wider line for easier clicking/dragging */}
                                            {currentTimeX < endOfDayX && (
                                                <line
                                                    x1={lastChangeX}
                                                    y1={displayY}
                                                    x2={endOfDayX}
                                                    y2={displayY}
                                                    stroke="transparent"
                                                    strokeWidth="20"
                                                    style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                                                    onMouseDown={handleLineMouseDown}
                                                />
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </g>
                     )}
            </svg>

        </>
    );
};

export default AircraftAvailabilityOverlay;
