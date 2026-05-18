
import React, { MouseEvent } from 'react';
import { ScheduleEvent, Trainee, EventSegment } from '../types';
import {
  AircraftNumberSettings,
  DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
  formatAircraftNumber,
} from '../utils/aircraftNumberFormat';

interface FlightTileProps {
  event: ScheduleEvent | EventSegment;
  traineesData: Trainee[];
  onSelectEvent: () => void;
  onSelectAcademicTile?: (tile: { lessonCode: string; label: string; startTime: number; duration: number; color: string; isStandard?: boolean }) => void;
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
  isPauseCompleted?: boolean;
  alertStatus?: 'pending' | 'accepted' | 'rejected' | null;
  aircraftNumberSettings?: AircraftNumberSettings;
}

const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Helper to get local date string from timezone-adjusted currentTime
// IMPORTANT: Use this instead of new Date().toISOString() to ensure consistent timezone handling
const getLocalDateStringFromAdjustedTime = (date: Date): string => {
    // The date parameter is already timezone-adjusted, so use UTC methods to extract local components
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getAuthorizationTextColorClass = (event: ScheduleEvent, currentTime: Date): string => {
    if (event.type !== 'flight') {
        return '';
    }
    
    // Use currentTime (timezone-adjusted) instead of new Date() to match the current time indicator
    const todayStr = getLocalDateStringFromAdjustedTime(currentTime);
    
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

    // Use UTC methods since currentTime is already timezone-adjusted (same as vertical time line)
    const nowInHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60;
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


const FlightTile: React.FC<FlightTileProps> = ({ event, traineesData, onSelectEvent, onSelectAcademicTile, onMouseDown, onMouseEnter, onMouseLeave, pixelsPerHour, rowHeight, startHour, row, isDragging, isConflicting, conflictedPersonnelName, personnelData, seatConfigs, isDraggable = true, currentTime, isUnavailabilityConflict, unavailablePersonnel, isSelected = false, isChanged = false, isPreview = false, isPauseCompleted = false, alertStatus = null, aircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS }) => {
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

  // Helper: check if a color value is a hex/rgb value vs a Tailwind class (defined here for use in style)
  const isHexColorEarly = (color: string) => color && (color.startsWith('#') || color.startsWith('rgb'));

  // Tailwind color palette: name -> shade -> [r, g, b]
  const TAILWIND_COLORS: Record<string, Record<string, [number, number, number]>> = {
    sky:     { '400': [56,189,248],  '500': [14,165,233] },
    purple:  { '400': [192,132,252], '500': [168,85,247] },
    yellow:  { '400': [250,204,21],  '500': [234,179,8] },
    pink:    { '400': [244,114,182], '500': [236,72,153] },
    teal:    { '400': [45,212,191],  '500': [20,184,166] },
    indigo:  { '400': [129,140,248], '500': [99,102,241] },
    cyan:    { '400': [34,211,238],  '500': [6,182,212] },
    blue:    { '400': [96,165,250],  '500': [59,130,246] },
    green:   { '400': [74,222,128],  '500': [34,197,94] },
    orange:  { '400': [251,146,60],  '500': [249,115,22] },
    red:     { '400': [248,113,113], '500': [239,68,68],  '800': [153,27,27],  '900': [127,29,29] },
    gray:    { '400': [156,163,175], '500': [107,114,128],'600': [75,85,99] },
    amber:   { '400': [251,191,36],  '500': [245,158,11], '700': [180,83,9] },
    fuchsia: { '400': [232,121,249], '500': [217,70,239] },
    lime:    { '400': [163,230,53],  '500': [132,204,22] },
    violet:  { '400': [167,139,250], '500': [139,92,246] },
    rose:    { '400': [251,113,133], '500': [244,63,94] },
  };

  const darkenRgbForLightTheme = (rgb: [number, number, number]): [number, number, number] => {
    const strength = 0.62;
    return [
      Math.round(rgb[0] * strength),
      Math.round(rgb[1] * strength),
      Math.round(rgb[2] * strength),
    ];
  };

  // Convert any Tailwind bg class (e.g. 'bg-sky-400/80', 'bg-purple-400/50') to rgba.
  // The dark theme uses muted alpha; light mode needs denser tiles so white schedule text stays readable.
  const tailwindBgToRgba = (cls: string, mode: 'dark' | 'light' = 'dark'): string | null => {
    if (!cls || !cls.startsWith('bg-')) return null;
    const match = cls.match(/^bg-([a-z]+)-(\d+)(?:\/(\d+))?$/);
    if (!match) return null;
    const [, colorName, shade, opacityStr] = match;
    const rgb = TAILWIND_COLORS[colorName]?.[shade];
    if (!rgb) return null;
    const displayRgb = mode === 'light' ? darkenRgbForLightTheme(rgb) : rgb;
    const opacity = opacityStr ? parseInt(opacityStr, 10) : 100;
    let alpha: number;
    if (mode === 'light') {
      if (opacity >= 75) alpha = 0.88;
      else if (opacity >= 45) alpha = 0.78;
      else if (opacity >= 30) alpha = 0.68;
      else alpha = Math.max(0.58, opacity / 100);
    } else if (opacity >= 75) alpha = 0.57;
    else if (opacity >= 45) alpha = 0.42;
    else if (opacity >= 30) alpha = 0.35;
    else alpha = (opacity / 100) * 0.7;
    return `rgba(${displayRgb[0]},${displayRgb[1]},${displayRgb[2]},${alpha})`;
  };

  // Hex to rgba helper
  const hexToRgba = (hex: string, alpha: number, darken = false): string => {
    try {
      const strength = darken ? 0.62 : 1;
      const r = Math.round(parseInt(hex.slice(1,3), 16) * strength);
      const g = Math.round(parseInt(hex.slice(3,5), 16) * strength);
      const b = Math.round(parseInt(hex.slice(5,7), 16) * strength);
      return `rgba(${r},${g},${b},${alpha})`;
    } catch { return hex; }
  };

  // Resolve background color as inline style for all non-special tiles
  const resolvedBgColor: string | null = (() => {
    if (event.type === 'deployment' || event.type === 'unavailability' || isUnavailabilityConflict || isConflicting) return null;
    const c = event.color || '';
    if (isHexColorEarly(c)) return hexToRgba(c, 0.57);
    return tailwindBgToRgba(c);
  })();

  const resolvedLightBgColor: string | null = (() => {
    if (event.type === 'deployment' || event.type === 'unavailability' || isUnavailabilityConflict || isConflicting) return null;
    const c = event.color || '';
    if (isHexColorEarly(c)) return hexToRgba(c, 0.92, true);
    return tailwindBgToRgba(c, 'light');
  })();

  const style: React.CSSProperties = {
    left: `${(effectiveStartTime - startHour) * pixelsPerHour}px`,
    top: `${row * rowHeight}px`,
    width: `${tileWidth}px`,
    height: `${rowHeight - 4}px`, // a little padding
    marginTop: '2px',
    // Apply resolved background color as inline style to override Tailwind CDN rendering
    ...(resolvedBgColor ? { backgroundColor: resolvedBgColor } : {}),
    // Also set as CSS custom property for the !important override in index.html
    ...(resolvedBgColor ? { ['--tile-bg' as any]: resolvedBgColor } : {}),
    ...(resolvedLightBgColor ? { ['--tile-light-bg' as any]: resolvedLightBgColor } : {}),
  };
  
  const getDynamicRingClass = () => {
    if (isConflicting || isUnavailabilityConflict) {
        return 'ring-red-400'; // Highest priority
    }
    
    // Use currentTime (timezone-adjusted) instead of new Date() to match the current time indicator
    const todayStr = getLocalDateStringFromAdjustedTime(currentTime);

    // Only apply auth highlighting for the current date
    if (event.date !== todayStr) {
        return 'ring-transparent';
    }

    // From here, it's today's date.
    const isFullySigned = !!(event.authoSignedBy && event.captainSignedBy);
    if (isFullySigned) {
        return 'ring-green-400';
    }
    
    // Use UTC methods since currentTime is already timezone-adjusted (same as vertical time line)
    const nowInHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60;
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
  const isTwrDiEvent = event.eventCategory === 'twr_di';
  const isStbyEvent = event.resourceId && (event.resourceId.startsWith('STBY') || event.resourceId.startsWith('BNF-STBY'));
  const aircraftNumberDisplay = event.aircraftNumber
    ? formatAircraftNumber(event.aircraftNumber, undefined, aircraftNumberSettings)
    : '';
  
  
  
  const picName = isSctEvent ? event.pilot : (event.flightType === 'Solo' ? event.pilot : event.instructor);
  const studentName = event.flightType === 'Solo' ? '' : (isSctEvent ? event.student : event.student || '');

  // For STBY events, show "TBA" for instructor and ensure trainee name is displayed
  let displayPicNameForRender = picName;
  let displayStudentNameForRender = studentName;

  if (isStbyEvent) {
    // Show actual instructor name if assigned, otherwise "TBA"
    displayPicNameForRender = picName && picName !== '' && picName !== 'TBA' ? picName : 'TBA';
    // Ensure trainee name is displayed from student or pilot field
    displayStudentNameForRender = event.student || event.pilot || studentName || '';
  }

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
      // Use UTC methods since currentTime is already timezone-adjusted (same as vertical time line)
      const nowInHours = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60;
      const eventEndTime = event.startTime + event.duration;
      const isEventFinished = nowInHours >= eventEndTime && event.date === getLocalDateStringFromAdjustedTime(currentTime);

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
        
        // Special case: SCT events with no student/crew are Solo flights (even if flightType is incorrectly set to Dual)
        if (isSctEvent && !event.student && event.pilot) {
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
    const displayPicName = isShortFlight ? abbreviateName(displayPicNameForRender || '') : displayPicNameForRender;
    const displayStudentName = isShortFlight ? abbreviateName(displayStudentNameForRender || '') : displayStudentNameForRender;
    
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

    // ── Academic Day Tile: outer container spanning workStart→workEnd with inset lesson tiles ──
    if ((event as any).isAcademic && (event as any).academicTiles) {
        const acadEvent = event as any;
        const tiles: { lessonCode: string; label: string; startTime: number; duration: number; color: string; isStandard?: boolean }[] = acadEvent.academicTiles || [];
        const dayStart = effectiveStartTime;
        const dayDuration = effectiveDuration;
        const tileFullWidth = dayDuration * pixelsPerHour;

        // Per-module colour lookup — used for both newly created tiles and DB-loaded tiles
        // (DB tiles may have the old single ACADEMIC_TILE_COLOR so we re-derive the colour here)
        const ACAD_LESSON_COLORS: Record<string, string> = {
            'AERODY': '#1e3a6e', 'AERO': '#1e3a6e',
            'ATC': '#4a1d6e',
            'MET': '#0e4d6e', 'METEO': '#0e4d6e', 'WX': '#0e4d6e',
            'NAV': '#0a4a30', 'NAVS': '#0a4a30',
            'PERF': '#0a3d6e',
            'AIR': '#5a2d0c', 'AIRMAN': '#5a2d0c',
            'SYS': '#1f2937', 'ACFT': '#1f2937', 'SYSTEM': '#1f2937',
            'INSTR': '#1a3a6e', 'IFR': '#1a3a6e',
            'HF': '#5b1a8a', 'HUFAC': '#5b1a8a', 'HUMAN': '#5b1a8a',
            'REG': '#374151', 'REGS': '#374151', 'ROA': '#374151',
            'LEAD': '#6b2d00',
            'SURV': '#1a4a1a',
            'COMM': '#1a4a5a',
            'ENG': '#2a1a3e',
            'EW': '#2a3a0a',
            // Standard tiles keep their own colours
            'MORNING_BREAK': '#64748b', 'LUNCH': '#78716c', 'AFTERNOON_BREAK': '#64748b',
            'SELF_STUDY': '#475569', 'SPORT': '#15803d', 'ADMIN': '#7c3aed',
            'FREE_TIME': '#0f766e', 'OTHER': '#b45309',
        };
        const getAcadTileColor = (lessonCode: string, existingColor: string, isStd?: boolean): string => {
            // Standard event tiles always keep their configured colour
            if (isStd) return existingColor;
            const upper = (lessonCode || '').toUpperCase();
            if (ACAD_LESSON_COLORS[upper]) return ACAD_LESSON_COLORS[upper];
            // Prefix match — longest first
            const sorted = Object.keys(ACAD_LESSON_COLORS).sort((a, b) => b.length - a.length);
            for (const prefix of sorted) {
                if (upper.startsWith(prefix)) return ACAD_LESSON_COLORS[prefix];
            }
            return '#1d3461'; // default academic blue
        };

        // Build lesson-only tiles (exclude standard breaks/lunch) for the flyout
        const lessonTiles = tiles.filter(t => !t.isStandard);
        const instructor = (event as any).instructor || '';
        const classroom = (event as any).resourceId || '';

        return (
            <div
                className="academic-outer-tile"
                style={{
                    position: 'relative', width: '100%', height: '100%', overflow: 'visible',
                    background: 'rgba(186,230,253,0.07)',
                    border: '2px solid rgba(147,197,253,0.40)',
                    borderRadius: 5,
                    boxSizing: 'border-box',
                }}
            >
                {/* Inset lesson tiles — lesson code only, no times */}
                <div style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, overflow: 'hidden' }}>
                    {tiles.map((t, i) => {
                        const offsetFromStart = t.startTime - dayStart;
                        const leftPct = (offsetFromStart / dayDuration) * 100;
                        const widthPct = (t.duration / dayDuration) * 100;
                        const bgColor = getAcadTileColor(t.lessonCode, t.color || '#1d4ed8', t.isStandard);
                        return (
                            <div
                                key={i}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectAcademicTile) onSelectAcademicTile(t);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: `calc(${leftPct}% + 1px)`,
                                    width: `calc(${widthPct}% - 2px)`,
                                    backgroundColor: bgColor,
                                    border: '1px solid rgba(255,255,255,0.30)',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 3,
                                    padding: '0 4px',
                                }}
                            >
                                {/* Lesson code only — no times, no instructors */}
                                <span style={{
                                    fontSize: 11, fontWeight: 700, color: '#fff',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    lineHeight: 1.2, textAlign: 'center',
                                }}>
                                    {t.lessonCode}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Hover flyout on the outer academic tile — shows all event details */}
                <div className="academic-outer-flyout" style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(147,197,253,0.6)',
                    borderRadius: 7,
                    padding: '8px 12px',
                    minWidth: 220,
                    maxWidth: 320,
                    pointerEvents: 'none',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    zIndex: 200,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                    whiteSpace: 'nowrap',
                }}>
                    {/* Header */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginBottom: 6, borderBottom: '1px solid rgba(147,197,253,0.3)', paddingBottom: 4 }}>
                        Academic Session
                        {classroom && classroom !== 'Ground 1' && (
                            <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>— {classroom}</span>
                        )}
                    </div>
                    {/* Instructor row */}
                    {instructor && (
                        <div style={{ fontSize: 10, color: '#cbd5e1', marginBottom: 5 }}>
                            <span style={{ color: '#64748b', marginRight: 4 }}>▶</span>
                            <span style={{ color: '#94a3b8', marginRight: 4 }}>Instructor:</span>
                            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{instructor}</span>
                        </div>
                    )}
                    {/* Event rows — lesson tiles only (skip standard breaks) */}
                    {lessonTiles.map((t, i) => {
                        const endTime = t.startTime + t.duration;
                        const durationMins = Math.round(t.duration * 60);
                        const durationStr = durationMins >= 60
                            ? `${Math.floor(durationMins/60)}h${durationMins%60 > 0 ? ` ${durationMins%60}m` : ''}`
                            : `${durationMins}m`;
                        const bgColor = getAcadTileColor(t.lessonCode, t.color || '#1d4ed8', false);
                        // Get description from label if different from code
                        const desc = t.label && t.label !== t.lessonCode
                            ? t.label.replace(new RegExp('^' + t.lessonCode + '[\s:\u2014-]*'), '').trim()
                            : '';
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: bgColor, flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                                        {t.lessonCode}
                                        {desc && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>{desc}</span>}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#64748b' }}>
                                        {formatTime(t.startTime)} – {formatTime(endTime)}
                                        <span style={{ color: '#475569', marginLeft: 6 }}>({durationStr})</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {/* Session total */}
                    <div style={{ borderTop: '1px solid rgba(147,197,253,0.2)', marginTop: 4, paddingTop: 4, fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Session: {formatTime(dayStart)} – {formatTime(dayStart + dayDuration)}</span>
                        <span style={{ color: '#475569' }}>
                            {(() => {
                                const totalMins = Math.round(dayDuration * 60);
                                return totalMins >= 60
                                    ? `${Math.floor(totalMins/60)}h${totalMins%60 > 0 ? ` ${totalMins%60}m` : ''}`
                                    : `${totalMins}m`;
                            })()}
                        </span>
                    </div>
                </div>

                {/* CSS for outer tile hover flyout */}
                <style>{`
                    .academic-outer-tile:hover .academic-outer-flyout { opacity: 1 !important; }
                `}</style>
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
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {isTwrDiEvent ? 'TWR DI' : event.flightNumber}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex justify-between items-center h-full w-full px-2" style={textStyle}>
                <div className="flex-1 overflow-hidden pr-1" style={{ paddingLeft: '10%', minWidth: 0 }}>
                    <div className={picClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{displayPicName?.split(' – ')[0]}{picSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{picSeatConfig}</span>}</div>
                    <div className={studentClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{isTwrDiEvent ? 'TWR DI' : typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{studentSeatConfig}</span>}</> : studentDisplay}</div>
                </div>
                <div className="flex flex-col items-end justify-between h-full pl-1 flex-shrink-0" style={{ minWidth: 'fit-content' }}>
                    <div>
                        <div className="font-mono text-white/80 text-right whitespace-nowrap">
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {isTwrDiEvent ? 'TWR DI' : event.flightNumber}
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
                    <div className={studentClasses.replace('truncate', 'overflow-hidden text-ellipsis whitespace-nowrap')}>{isTwrDiEvent ? 'TWR DI' : typeof studentDisplay === 'string' ? <>{displayStudentName?.split(' – ')[0]}{studentSeatConfig && <span style={{fontWeight: "normal", color: "rgba(255, 255, 255, 0.8)"}}>{studentSeatConfig}</span>}</> : studentDisplay}</div>
                </div>

                <div className="flex flex-col items-end justify-between h-full pl-1 flex-shrink-0" style={{ minWidth: 'fit-content' }}>
                    <div>
                        <div className="font-mono text-white/80 text-right whitespace-nowrap">
                            <span style={{ fontSize: `${scaledFontSize - 2}px` }}>[{(event.duration || 0).toFixed(1)}]</span> {isTwrDiEvent ? 'TWR DI' : event.flightNumber}
                        </div>
                    </div>
                </div>
            </div>

            {aircraftNumberDisplay && (
                <div
                    className="absolute bottom-0.5 left-1 font-mono text-white/80"
                    style={{
                        fontSize: `${scaledFontSize - 2}px`,
                        lineHeight: '1',
                        opacity: 0.8,
                    }}
                >
                    #{aircraftNumberDisplay}
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

  // Use isHexColorEarly (defined above) for hex color detection
  const isHexColor = isHexColorEarly;
  const eventColorIsHex = isHexColorEarly(event.color || '');

  // Handle deployment tile special styling
  // When resolvedBgColor is set as inline style, we don't need the Tailwind bg class
  const backgroundClass = event.type === 'deployment' 
    ? 'bg-gray-600/30 border border-white/60' 
    : event.type === 'unavailability'
    ? 'bg-red-900/80 border border-red-600/60'
    : isUnavailabilityConflict ? 'bg-red-800/90' : isConflicting ? 'bg-red-600/70' : (resolvedBgColor ? '' : event.color);
  
  
  const ringClass = getDynamicRingClass();
  const dutySupBorderClass = isDutySup ? 'border border-black' : '';
  const multiSelectRingClass = isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-900' : '';
  const pauseCompletedRingClass = isPauseCompleted ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900' : '';
  
  const finalClasses = [commonClasses];

  if (isPreview) {
      // For preview tiles, use inline style if available, otherwise fall back to Tailwind class
      finalClasses.push(resolvedBgColor ? '' : event.color);
      finalClasses.push('border-2 border-dashed border-sky-300');
  } else {
      finalClasses.push(backgroundClass);
      finalClasses.push(`ring-[0.92px] ${ringClass}`);
      finalClasses.push(dutySupBorderClass);
      finalClasses.push(multiSelectRingClass);
      if (isPauseCompleted) finalClasses.push(pauseCompletedRingClass);
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
            <div className={`absolute right-0 top-0 bottom-0 w-1.5 z-20 pointer-events-none ${
                alertStatus === 'accepted' ? 'alert-bar-accepted' :
                alertStatus === 'rejected' ? 'alert-bar-rejected' :
                alertStatus === 'pending' ? 'alert-bar-pending' :
                'changed-bar-stripes'
            }`} />
        )}
        {isPauseCompleted && !isPreview && (
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center pointer-events-none z-30">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
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
