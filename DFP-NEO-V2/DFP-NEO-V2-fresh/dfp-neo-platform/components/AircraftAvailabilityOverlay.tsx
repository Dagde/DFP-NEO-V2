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
    onAvailabilityChange
}) => {
    const [currentAvailable, setCurrentAvailable] = useState<number>(plannedAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const overlayRef = useRef<SVGSVGElement>(null);

    // Load snapshots from localStorage on mount
    useEffect(() => {
        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
        if (stored) {
            const data = JSON.parse(stored);
            // Sort snapshots by timestamp to ensure correct chronological order
            const sortedSnapshots = data.snapshots
                .map((s: any) => ({
                    ...s,
                    timestamp: new Date(s.timestamp)
                }))
                .sort((a: AircraftAvailabilitySnapshot, b: AircraftAvailabilitySnapshot) => 
                    a.timestamp.getTime() - b.timestamp.getTime()
                );
            setSnapshots(sortedSnapshots);
            setCurrentAvailable(sortedSnapshots[sortedSnapshots.length - 1]?.available || plannedAvailability);
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
    }, [currentDate, plannedAvailability, totalAircraft]);

    // Save and calculate average whenever snapshots change
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
            onAvailabilityChange(record);
        }
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate, onAvailabilityChange]);

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

    // Handle drag start on the solid line
    const handleLineMouseDown = (e: React.MouseEvent) => {
        if (!overlayRef.current) return;
        e.preventDefault();
        const rect = overlayRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        console.log('🖱️ DRAG START:', {
            timestamp: new Date().toISOString(),
            mouseY: y,
            mouseX: x,
            currentAvailable: currentAvailable,
            snapshotsCount: snapshots.length,
            snapshots: snapshots.map(s => ({
                time: s.timestamp.toLocaleTimeString(),
                available: s.available
            }))
        });
        
        setIsDragging(true);
        setDragY(y); // Initialize with current position
        setMouseX(x); // Initialize mouse X position
    };

    // Handle drag move - smooth movement with raw Y position
    const handleDragMove = (e: MouseEvent) => {
        if (!isDragging || !overlayRef.current) return;

        const rect = overlayRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        // Store raw Y position and mouse X for smooth rendering
        setDragY(y);
        setMouseX(x);
        
        // Convert Y position to aircraft count (for tooltip display)
        // Rows BELOW the line = available aircraft
        // Rows ABOVE the line = unavailable aircraft
        const rowsFromTop = y / rowHeight;
        const exactCount = rowsFromTop; // Available = rows from top
        const clampedCount = Math.max(0, Math.min(totalAircraft, exactCount));
        
        console.log('🔄 DRAGGING:', {
            mouseY: y,
            rowsFromTop: rowsFromTop.toFixed(2),
            exactCount: exactCount.toFixed(2),
            clampedCount: clampedCount.toFixed(2),
            currentAvailable: currentAvailable.toFixed(2)
        });
        
        setCurrentAvailable(clampedCount);
    };

    // Handle drag end - snap to nearest whole number based on final drag position
    const handleDragEnd = () => {
        if (isDragging) {
            setIsDragging(false);
            
            // Calculate aircraft count from final drag Y position
            const rowsFromTop = dragY / rowHeight;
            const exactCount = rowsFromTop;
            
            // Snap to nearest whole number
            const snappedCount = Math.round(Math.max(0, Math.min(totalAircraft, exactCount)));
            
            const previousAvailability = snapshots[snapshots.length - 1]?.available || plannedAvailability;
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
            
            setCurrentAvailable(snappedCount);
            
                // Log audit record for availability change
                const changeDescription = `Aircraft availability changed from ${previousAvailability} to ${snappedCount} (${totalAircraft - snappedCount} aircraft unavailable)`;
                const changeDetails = `Time: ${new Date().toLocaleTimeString()} | Previous: ${previousAvailability} | New: ${snappedCount} | Total: ${totalAircraft}`;
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
                    total: totalAircraft,
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
                    // Sort snapshots by timestamp to ensure correct chronological order
                    const sorted = updated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                    console.log('📊 SNAPSHOTS UPDATED:', {
                        count: sorted.length,
                        all: sorted.map(s => ({
                            time: s.timestamp.toLocaleTimeString(),
                            available: s.available
                     }))
                 });
                    return sorted;
                });
            } else {
                console.log('⏭️ NO SNAPSHOT CREATED - Value unchanged');
            }
        }
    };

    // Add global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            return () => {
                window.removeEventListener('mousemove', handleDragMove);
                window.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDragging, currentAvailable, totalAircraft, rowHeight, snapshots]);

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
        
           // Use all snapshots without filtering (already sorted)
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
