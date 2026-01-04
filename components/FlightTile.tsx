
import React, { MouseEvent } from 'react';
import { ScheduleEvent, Trainee, EventSegment } from '../types';

interface FlightTileProps {
  event: ScheduleEvent | EventSegment;
  traineesData: Trainee[];
  onSelectEvent: () => void;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  pixelsPerHour: number;
  rowHeight: number;
  startHour: number;
  row: number;
  isDragging: boolean;
  isConflicting?: boolean;
  conflictedPersonnelName?: string | null;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
  seatConfigs: Map<string, string>;
  isDraggable?: boolean;
  currentTime: Date;
  isUnavailabilityConflict?: boolean;
  unavailablePersonnel?: string[];
  isSelected?: boolean;
  isChanged?: boolean;
  isPreview?: boolean;
}

const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getAuthorizationTextColorClass = (event: ScheduleEvent, currentTime: Date): string => {
    if (event.type !== 'flight') {
        return '';
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Only apply highlighting for the current date
    if (event.date !== todayStr) {
        return ''; // No auth-related text color for past/future dates
    }
    
    // From here, it's today's date.
    const isFullySigned = !!(event.authoSignedBy && event.captainSignedBy);
    const isAuthoSigned = !!(event.authoSignedBy || event.isVerbalAuth);
    const isUnsigned = !isAuthoSigned && !event.captainSignedBy;

    if (isFullySigned) {
        return 'text-green-400';
    }

    const nowInHours = currentTime.getHours() + currentTime.getMinutes() / 60;
    const endTime = event.startTime + event.duration;
    if (nowInHours >= endTime) {
        return ''; // Default text color for lapsed events on today's schedule
    }

    if (isAuthoSigned && !event.captainSignedBy) {
        return 'text-sky-400';
    }

    if (isUnsigned) {
        const timeUntilStart = event.startTime - nowInHours;
        
        if (timeUntilStart <= 0.25) {
            return 'text-red-500';
        }

        if (timeUntilStart <= 2) {
            return 'text-amber-400';
        }
    }

    return '';
};


const FlightTile: React.FC<FlightTileProps> = ({ event, traineesData, onSelectEvent, onMouseDown, onMouseEnter, onMouseLeave, pixelsPerHour, rowHeight, startHour, row, isDragging, isConflicting, conflictedPersonnelName, personnelData, seatConfigs, isDraggable = true, currentTime, isUnavailabilityConflict, unavailablePersonnel, isSelected = false, isChanged = false, isPreview = false }) => {
  // ERROR TRACKING: Log props to identify missing seatConfigs

  // Removed unit color logic - colors are now handled in PersonnelColumn only
  
  try {
    // Test access to seatConfigs to trigger the error
    const testAccess = seatConfigs;
  } catch (error) {
  }
  // Determine if this is a segment and use effective start/duration
  const segment = event as EventSegment;
  const effectiveStartTime = segment.segmentStartTime !== undefined ? segment.segmentStartTime : event.startTime;
  const effectiveDuration = segment.segmentDuration !== undefined ? segment.segmentDuration : event.duration;
  
  const tileWidth = (effectiveDuration || 0) * pixelsPerHour;
  const isDutySup = event.resourceId === 'Duty Sup';
  
  // Check if tile is too small for content (threshold e.g. 60px ~ 18 mins)
  const isSmallTile = tileWidth < 60;
  
  // Determine flyout direction based on segment type
  // 'start' segment means it starts today and ends tomorrow (renders at right edge) -> flyout left
  // 'end' segment means it started yesterday and ends today (renders at left edge) -> flyout right
  // Default to right for normal small tiles unless they are near the right edge (heuristic)
  const isEndSegment = segment.segmentType === 'start'; 
  const flyoutToLeft = isEndSegment || (effectiveStartTime + effectiveDuration > 22); // Logic: if it ends late in the day, flyout left

  const style: React.CSSProperties = {
    left: `${(effectiveStartTime - startHour) * pixelsPerHour}px`,
    top: `${row * rowHeight}px`,
    width: `${tileWidth}px`,
    height: `${rowHeight - 4}px`, // a little padding
    marginTop: '2px',
  };
  
  const getDynamicRingClass = () => {
    if (isConflicting || isUnavailabilityConflict) {
        return 'ring-red-400'; // Highest priority
    }
    
    const todayStr = new Date().toISOString().split('T')[0];

    // Only apply auth highlighting for the current date
    if (event.date !== todayStr) {
        return 'ring-transparent';
    }

    // From here, it's today's date.
    const isFullySigned = !!(event.authoSignedBy && event.captainSignedBy);
    if (isFullySigned) {
        return 'ring-green-400';
    }
    
    const nowInHours = currentTime.getHours() + currentTime.getMinutes() / 60;
    const endTime = event.startTime + event.duration;

    // Lapsed status for today - no border required on main schedule
    if (nowInHours >= endTime) {
        return 'ring-transparent';
    }
    
    const isAuthoSigned = !!(event.authoSignedBy || event.isVerbalAuth);
    // Awaiting PIC - no border required on main schedule
    if (isAuthoSigned) {
        return 'ring-transparent';
    }

    // Time-based warnings for upcoming unsigned events
    const timeUntilStart = event.startTime - nowInHours;
    if (timeUntilStart <= 0.25) {
        return 'ring-red-500'; // Needs auth urgently
    }
    if (timeUntilStart <= 2) {
        return 'ring-amber-400'; // Needs auth soon
    }

    return 'ring-transparent'; // Default for unsigned flights > 2hrs away on the current day
  };

  // Smarter font scaling based on duration (200px per hour)
  const minFontSize = 7;
  const maxFontSize = 13;
  const baseFontSize = 11; // Start with a good readable size
  
  // Calculate content-aware font size based on duration thresholds
  let scaledFontSize = baseFontSize;
  
  // Duration-based thresholds (200px per hour)
  const maxNoScaleThreshold = 239; // <1.2 hours = <240px start scaling down
  const moderateScaleThreshold = 220; // 1.1 hours = 220px (font: 10)
  const smallScaleThreshold = 160;    // 0.8 hours = 160px (font: 9)
  const minScaleThreshold = 120;       // 0.6 hours = 120px (font: 7)
  
  if (tileWidth < minScaleThreshold) {
    // Very small tiles (< 0.6 hours) - minimum font size
    scaledFontSize = minFontSize;
  } else if (tileWidth < smallScaleThreshold) {
    // Small tiles (0.6-0.8 hours) - moderate scaling
    scaledFontSize = 9;
  } else if (tileWidth < moderateScaleThreshold) {
    // Medium tiles (0.9-1.1 hours) - slight reduction
    scaledFontSize = 10;
  } else if (tileWidth < maxNoScaleThreshold) {
    // Just under 1.2 hours (1.1-1.19 hours) - slight reduction
    scaledFontSize = 10;
  }
  // else: use baseFontSize (11) for tiles >= 1.2 hours (240px+)
  
  // Ensure within bounds
  scaledFontSize = Math.max(minFontSize, Math.min(maxFontSize, scaledFontSize));

  // For SCT events, pilot field contains PIC, student field contains crew (for Dual)
  const isSctEvent = event.eventCategory === 'sct';
  
  
  
  const picName = isSctEvent ? event.pilot : (event.flightType === 'Solo' ? event.pilot : event.instructor);
  const studentName = event.flightType === 'Solo' ? '' : (isSctEvent ? event.student : event.student || '');
  
  let picClasses = `font-semibold truncate`;
  let studentClasses = `truncate`;

  if (isPreview) {
      if (picName?.includes('✓')) {
          picClasses = 'font-bold truncate text-green-400';
      } else if (picName?.includes('✕')) {
          picClasses = 'font-bold truncate text-red-500';
      }

      if (studentName?.includes('✓')) {
          studentClasses = 'font-bold truncate text-green-400';
      } else if (studentName?.includes('✕')) {
          studentClasses = 'font-bold truncate text-red-500';
      }
  } else {
      const textColorClass = getAuthorizationTextColorClass(event, currentTime);
      const picHasUnavailability = unavailablePersonnel && unavailablePersonnel.includes(picName || '');
      const studentHasUnavailability = unavailablePersonnel && unavailablePersonnel.includes(studentName || '');
      
      // Check for event finish to stop highlighting unavailability on past events
      const nowInHours = currentTime.getHours() + currentTime.getMinutes() / 60;
      const eventEndTime = event.startTime + event.duration;
      const isEventFinished = nowInHours >= eventEndTime && event.date === new Date().toISOString().split('T')[0];

      if ((conflictedPersonnelName === picName) || (picHasUnavailability && !isEventFinished)) {
          picClasses = 'font-bold truncate text-red-500';
      } else if (textColorClass) {
          picClasses += ` ${textColorClass}`;
      }

      if ((conflictedPersonnelName === studentName) || (studentHasUnavailability && !isEventFinished)) {
          studentClasses = 'font-bold truncate text-red-500';
      } else if (textColorClass) {
          studentClasses += ' text-white/80';
      } else {
          studentClasses += ' text-white/80';
      }
  }
  
  const getStudentDisplay = () => {
      if (isPreview) {
          return studentName;
      }

        

        // Check for SOLO flights - applies to ALL event types
        if (event.flightType === 'Solo') {
            return (
                <span className="bg-yellow-500/20 text-yellow-100 px-1.5 py-0.5 rounded-sm font-bold" style={{fontSize: isSmallTile ? '10px' : `${scaledFontSize * 0.85}px`}}>
                    SOLO
                </span>
            );
        }

      // For SCT Dual events, show crew name from student field
      if (isSctEvent && event.flightType === 'Dual' && event.student) {
          return event.student.split(' – ')[0];
      }

        // FALLBACK: Detect SOLO flights by checking if pilot and student are the same person
        // This handles cases where flightType is not set correctly in the database
        if (event.pilot && event.student && event.pilot === event.student) {
            return (
                <span className="bg-yellow-500/20 text-yellow-100 px-1.5 py-0.5 rounded-sm font-bold" style={{fontSize: isSmallTile ? '10px' : `${scaledFontSize * 0.85}px`}}>
                    SOLO
                </span>
            );
        }
      if ((event.groupTraineeIds && event.groupTraineeIds.length > 1) || 
          (event.attendees && event.attendees.length > 1) || 
          event.student === 'Multiple') {
          return 'Group';
      }
      
      if (event.student && event.student !== 'Multiple') {
          return event.student.split(' – ')[0];
      }

      if (event.attendees && event.attendees.length === 1) {
          return event.attendees[0].split(' – ')[0];
      }
      
      if (event.groupTraineeIds && event.groupTraineeIds.length === 1) {
          const trainee = traineesData.find(t => t.idNumber === event.groupTraineeIds![0]);
          return trainee ? trainee.name.split(',')[0] : 'Group';
      }
      
      return '';
  };
  const studentDisplay = getStudentDisplay();

    // Helper function to get seat config abbreviation
    const getSeatConfigAbbr = (personName: string | undefined): string => {
        if (!personName) return "";
        const seatConfig = seatConfigs.get(personName);
        if (!seatConfig) return "";
        
        switch (seatConfig) {
            case "Normal": return " (N)";
            case "FWD/SHORT": return " (F/S)";
            case "FWD/LONG": return " (F/L)";
            case "REAR/SHORT": return " (R/S)";
            default: return "";
        }
    };

    // Get seat config abbreviations for pilot and student
    const picSeatConfig = getSeatConfigAbbr(picName);
    const studentSeatConfig = getSeatConfigAbbr(typeof studentDisplay === "string" ? studentDisplay : "");

  const storedCallsign = event.callsign || '';
  
  const callsignInfo = picName ? personnelData.get(picName) : undefined;
  const pilotCallsign = callsignInfo && callsignInfo.callsignNumber > 0
      ? `${callsignInfo.callsignPrefix} ${String(callsignInfo.callsignNumber).padStart(3, '0')}`
      : '';
  
  // For solo flights, use trainee callsign instead of instructor callsign
     const isSoloFlight = event.flightType === 'Solo';
     let callsign = storedCallsign || pilotCallsign;
     
     if (isSoloFlight && event.pilot) {
         const trainee = traineesData.find(t => t.fullName === event.pilot);
         if (trainee?.traineeCallsign) {
             callsign = trainee.traineeCallsign;
         }
     }

  const renderContent = () => {
    if (isSmallTile) return null; // Don't render internal text if tile is small

    const textStyle: React.CSSProperties = {
      fontSize: `${scaledFontSize}px`,
      lineHeight: '1.3',
    };

    // Smart name truncation for flights <= 1.1 hour
    const isShortFlight = effectiveDuration <= 1.1;
    
    const abbreviateName = (fullName: string) => {
      if (!fullName) return fullName;
      const parts = fullName.split(', ');
      if (parts.length !== 2) return fullName;
      
      const surname = parts[0];
      const firstName = parts[1];
      const firstInitial = firstName.charAt(0);
      
      return `${surname}, ${firstInitial}`;
    };

    // Apply name abbreviation for short flights
    const displayPicName = isShortFlight ? abbreviateName(picName || '') : picName;
    const displayStudentName = isShortFlight ? abbreviateName(studentName || '') : studentName;
    
    const isGroundEventFromName = event.flightNumber.includes('CPT') || event.flightNumber.includes('MB') || event.flightNumber.includes('TUT') || event.flightNumber.includes('QUIZ');
    
    if (event.type === 'deployment') {
        // Render deployment tile with subtle styling
        return (
            <div className="flex justify-center items-center h-full w-full px-2" style={textStyle}>
                <div className="overflow-hidden text-center">
                    <div className="text-white/80 font-medium text-sm">
                        DEPLOYMENT
                    </div>
                    <div className="font-mono text-white/60 truncate">
                        deployed
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                        {event.deploymentStartTime?.replace(/:/g, '')} - {event.deploymentEndTime?.replace(/:/g, '')}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'unavailability') {
        // Render unavailability tile
        return (
            <div className="flex justify-center items-center h-full w-full px-2" style={textStyle}>
                <div className="overflow-hidden text-center">
                    <div className="text-red-300 font-medium text-sm">
                        UNAVAILABLE
                    </div>
                    <div className="font-mono text-red-400 truncate">
                        {(event.reason || 'Other').toUpperCase()}
                    </div>
                    {event.notes && (
                        <div className="text-xs text-red-500 mt-1 truncate">
                            {event.notes}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (event.type === 'ftd' || event.type === 'ground' || isGroundEventFromName) {
        
        if (isDutySup) {
             return (
                <div className="flex justify-center items-center h-full w-full px-2" style={textStyle}>
                    <div className="overflow-hidden text-center">
                        <div className={picClasses}>{picName?.split(' – ')[0]}{picSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{picSeatConfig}</span>}</div>
                        <div className="font-mono text-white/80 truncate">
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {event.flightNumber}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex justify-between items-center h-full w-full px-2" style={textStyle}>
                <div className="flex-1 overflow-hidden pr-1" style={{ paddingLeft: '10%', minWidth: 0 }}>
                    <div className={picClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{displayPicName?.split(' – ')[0]}{picSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{picSeatConfig}</span>}</div>
                    <div className={studentClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{studentSeatConfig}</span>}</> : studentDisplay}</div>
                </div>
                <div className="flex flex-col items-end justify-between h-full pl-1 flex-shrink-0" style={{ minWidth: 'fit-content' }}>
                    <div>
                        <div className="font-mono text-white/80 text-right whitespace-nowrap">
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {event.flightNumber}
                        </div>
                    </div>
                    <div/> 
                </div>
            </div>
        );
    }
    
    return (
        <>
            <div className="flex items-center justify-between h-full w-full px-2" style={textStyle}>
                <div className="flex-1 overflow-hidden pr-1" style={{ paddingLeft: '10%', minWidth: 0 }}>
                    <div className={picClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{displayPicName?.split(' – ')[0]}{picSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{picSeatConfig}</span>}</div>
                    <div className={studentClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{studentSeatConfig}</span>}</> : studentDisplay}</div>
                </div>

                <div className="flex flex-col items-end justify-between h-full pl-1 flex-shrink-0" style={{ minWidth: 'fit-content' }}>
                    <div>
                        <div className="font-mono text-white/80 text-right whitespace-nowrap">
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {event.flightNumber}
                        </div>
                    </div>
                </div>
            </div>

            {event.aircraftNumber && (
                <div
                    className="absolute bottom-0.5 left-1 font-mono text-white/80"
                    style={{
                        fontSize: `${scaledFontSize - 2}px`,
                        lineHeight: '1',
                        opacity: 0.8,
                    }}
                >
                    #{event.aircraftNumber}
                </div>
            )}
            <div className="absolute bottom-0.5 right-3 flex items-center gap-1">
                {event.area && (
                    <div
                        className={`font-sans font-light ${['A','B','C','D','E','F','G','H'].includes(event.area) ? 'text-white' : 'text-yellow-300'}`}
                        style={{
                            fontSize: `${scaledFontSize}px`,
                            lineHeight: '1',
                            opacity: 0.7,
                        }}
                    >
                        {event.area}
                    </div>
                )}
                {callsign && (
                    <div
                        className="font-mono text-white/80"
                        style={{
                            fontSize: `${scaledFontSize - 2}px`,
                            lineHeight: '1',
                            opacity: 0.8,
                        }}
                    >
                        {callsign}
                    </div>
                )}
            </div>
        </>
    );
  };

  const shadowClass = isDragging ? 'shadow-xl' : 'shadow-md';
  const commonClasses = `absolute rounded-sm ${isDraggable ? 'cursor-grab' : 'cursor-pointer'} transition-all duration-200 ${isDragging ? 'opacity-80 z-50' : 'z-10'} ${shadowClass}`;
  
  // Check if this is a STBY event
  const isStbyEvent = event.resourceId && (event.resourceId.startsWith('STBY') || event.resourceId.startsWith('BNF-STBY'));
  
  // Handle deployment tile special styling
  const backgroundClass = event.type === 'deployment' 
    ? 'bg-gray-600/30 border border-white/60' 
    : event.type === 'unavailability'
    ? 'bg-red-900/80 border border-red-600/60'
    : isUnavailabilityConflict ? 'bg-red-800/90' : isConflicting ? 'bg-red-600/70' : event.color;
  const ringClass = getDynamicRingClass();
  const dutySupBorderClass = isDutySup ? 'border border-black' : '';
  const multiSelectRingClass = isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-900' : '';
  
  const finalClasses = [commonClasses];

  if (isPreview) {
      finalClasses.push(event.color); // The color is set in App.tsx for oracle preview
      finalClasses.push('border-2 border-dashed border-sky-300');
  } else {
      finalClasses.push(backgroundClass);
      finalClasses.push(`ring-[0.92px] ${ringClass}`);
      finalClasses.push(dutySupBorderClass);
      finalClasses.push(multiSelectRingClass);
  }
  // Ensure we don't clip the flyout which sits outside
  // We can't use overflow-hidden on the tile itself if we want the flyout to potentially pop out,
  // but usually we want to clip inner content.
  // Strategy: Render flyout as a sibling or use absolute positioning that isn't clipped.
  // Actually, standard `absolute` children are clipped if parent has `overflow: hidden`.
  // If we remove `overflow-hidden`, we must ensure inner content doesn't spill.
  // For safety, we will NOT use `overflow-hidden` on the main tile div if it's small, to allow the flyout to be visible if we nest it.
  // Better approach: Since we control inner content rendering, we can just omit overflow-hidden.
  if (!isSmallTile) {
      finalClasses.push('overflow-hidden');
  }

  // Flyout content
  const renderFlyout = () => {
      if (!isSmallTile) return null;
      
      const flyoutStyle: React.CSSProperties = {
          position: 'absolute',
          top: 0,
          [flyoutToLeft ? 'right' : 'left']: '100%',
          marginLeft: flyoutToLeft ? 0 : '4px',
          marginRight: flyoutToLeft ? '4px' : 0,
          whiteSpace: 'nowrap',
          zIndex: 60,
      };

      return (
          <div style={flyoutStyle} className="flex items-center">
                {/* Connector Line/Arrow could go here */}
               <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 shadow-lg flex items-center space-x-3 text-xs">
                    <div>
                        <div className={`font-bold ${picClasses.replace('truncate', '')}`}>{picName?.split(' – ')[0]}{picSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{picSeatConfig}</span>}</div>
                        <div className={studentClasses.replace('truncate', '')}>{typeof studentDisplay === 'string' ? <>{studentDisplay}{studentSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{studentSeatConfig}</span>}</> : studentDisplay}</div>
                    </div>
                    <div className="h-6 w-px bg-gray-600"></div>
                    <div>
                        <div className="font-mono font-semibold text-sky-400">{event.flightNumber}</div>
                        <div className="font-mono text-gray-400">{formatTime(effectiveStartTime)}</div>
                    </div>
                    {callsign && <div className="font-mono text-gray-500 text-[10px]">{callsign}</div>}
               </div>
          </div>
      );
  }

  return (
    <div
      data-is-flight-tile="true"
      style={style}
      className={finalClasses.join(' ')}
      onClick={onSelectEvent}
      onMouseDown={(e) => {
          e.stopPropagation(); // Prevent grid's handleMouseDown from being called
          onMouseDown(e);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      
    >
        {isChanged && !isPreview && (
            <div className="absolute right-0 top-0 bottom-0 w-1.5 changed-bar-stripes z-20 pointer-events-none" />
        )}
        {isStbyEvent && !isPreview && (
            <div 
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(209, 213, 219, 0.4) 0px, rgba(209, 213, 219, 0.4) 3px, transparent 3px, transparent 8px)',
                }}
            />
        )}
        {(event as any).isCancelled && !isPreview && (
            <svg 
                className="absolute inset-0 pointer-events-none z-20"
                style={{ width: '100%', height: '100%' }}
            >
                <line 
                    x1="0" 
                    y1="0" 
                    x2="100%" 
                    y2="100%" 
                    stroke="rgb(239, 68, 68)" 
                    strokeWidth="2"
                />
                <line 
                    x1="100%" 
                    y1="0" 
                    x2="0" 
                    y2="100%" 
                    stroke="rgb(239, 68, 68)" 
                    strokeWidth="2"
                />
            </svg>
        )}
        <div className="relative w-full h-full text-white">
            {isDutySup ? (
                <>
                    <div 
                        className="absolute top-1 left-1 font-mono text-white/60 pointer-events-none"
                        style={{ fontSize: `${scaledFontSize * 0.825}px` }}
                    >
                        {formatTime(effectiveStartTime)}
                    </div>
                    <div 
                        className="absolute top-1 right-1 font-mono text-white/60 pointer-events-none"
                        style={{ fontSize: `${scaledFontSize * 0.825}px` }}
                    >
                        {formatTime(effectiveStartTime + effectiveDuration)}
                    </div>
                </>
            ) : (
                !isSmallTile && (
                    <div 
                        className="absolute -top-px left-1 font-mono text-white/60 pointer-events-none"
                        style={{ fontSize: `${scaledFontSize * 0.75}px` }}
                    >
                        {formatTime(effectiveStartTime)}
                    </div>
                )
            )}
            {renderContent()}
            {renderFlyout()}
        </div>
    </div>
  );
};

export default FlightTile;
