import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { loadUserPreferences, saveUserPreference } from '../utils/userPreferencesService';
import { ScheduleEvent, SyllabusItemDetail, Trainee, Instructor, Score } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import {
  DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
  formatAircraftNumber,
  parseAircraftNumber,
  type AircraftNumberSettings,
} from '../utils/aircraftNumberFormat';
import { BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { DEFAULT_AIRCRAFT_CREW_COMPOSITION, normaliseAircraftCrewComposition, type AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewCompositionSettings, CurrencyProfile } from '../utils/crewCompositionProfiles';
import {
  getContinuationEventCurrencyProfiles,
  getContinuationEventNames,
} from '../utils/continuationEvents';
import { isFixedCrewLikeOperationalModel, normaliseOperationalModel } from '../utils/platformConfigService';
import { DEFAULT_SCT_TERMINOLOGY, normaliseSctTerminology, type SctTerminology } from '../utils/sctTerminology';
import {
  getQualificationsForOperationalModel,
  normaliseAssignedQualificationIds,
  normaliseQualificationToken,
  type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
import {
  buildUnitEventCallsign,
  formatUnitCallsignNumber,
  getDefaultUnitCallsign,
  getUnitCallsignEntries,
  type UnitCallsignSettings,
} from '../utils/unitCallsigns';
import {
  appendUnavailableLabel,
  getStaffUnavailabilityStatus,
  summariseCrewUnavailability,
  timeFieldToHours,
  type FixedCrewAvailabilityWindow,
} from '../utils/fixedCrewAvailability';

interface AddFlightTileModalProps {
  onClose: () => void;
  onSave: (events: ScheduleEvent[]) => void;
  initialEvent?: ScheduleEvent | null;
  eventsForDate?: ScheduleEvent[];
  instructors: string[];
  trainees: string[];
  syllabusDetails: SyllabusItemDetail[];
  school: string;
  currentLocationName?: string;
  traineesData: Trainee[];
  instructorsData: Instructor[];
  courseColors: { [key: string]: string };
  date: string;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  scores?: Map<string, Score[]>;
  locationOpAreas?: Record<string, string[]>;
  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];
  userId?: string;
  aircraftNumberSettings?: AircraftNumberSettings;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
  aircraftCrewComposition?: AircraftCrewComposition;
  crewCompositionSettings?: CrewCompositionSettings;
  operationalModel?: string;
  activeUnitCode?: string;
  activeUnitCodes?: string[];
  unitCallsignSettings?: UnitCallsignSettings;
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  personnelDisplaySettings?: PersonnelDisplaySettings;
  personnelData?: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  sctTerminology?: SctTerminology;
  sctEvents?: any[];
  nightContinuationDefaultStartTime?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (time: number): string => {
  const hours = Math.floor(time);
  const minutes = Math.round((time % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDate = (dateStr: string): string => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
};

const formatFixedCrewDisplayGroup = (crew?: string | null): string => {
  const cleaned = String(crew || '').replace(/^CREW\s*/i, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split('::');
  if (parts.length < 2) return `CREW ${cleaned}`;
  const unit = parts[0].trim();
  const crewLabel = parts.slice(1).join('::').trim();
  return unit && crewLabel ? `CREW ${crewLabel}/${unit}` : `CREW ${cleaned}`;
};

type GuideStep = 'startTime' | 'trainee' | 'instructor' | 'event' | 'area' | 'aircraft' | 'done';
type FormationCrewDraft = {
  flightType: 'Dual' | 'Solo';
  picName: string;
  studentName: string;
  callsign: string;
};
type FixedCrewFormationAssignment = {
  crewGroup: string;
  pic: string;
};

// ─── Scale constants for the large interactive tile ─────────────────────────
//
// Strategy: mirror the EXACT layout of FlightTile.tsx (the real schedule tile)
// but scale everything up proportionally.
//
// Real tile: rowHeight ≈ 34px, scaledFontSize = 11px
// Modal tile target: ~3× scale factor
//   Names font:   11px × 3 = 33px  (NAME_FONT)
//   Time font:    11 × 0.75 × 3 = 25px  (TIME_FONT)
//   Right font:   11 × 0.9 × 3 = 30px   ([dur] EVENT)
//   Bottom font:  11 × 0.85 × 3 = 28px  (#aircraft, area, callsign)
//   V padding:    4px × 3 = 12px
//   H padding:    8px × 3 = 24px (10% of tile width ≈ left indent for names)
//   Bottom strip height: 11px × 3 = 33px (bottom-1 of real tile)
//
// The tile height is NOT hardcoded — it's determined by content (flexbox),
// just like the real tile which gets height from rowHeight prop.
// We add enough bottom padding so the bottom-strip doesn't overlap names.
//
const SCALE       = 3.2;
const NAME_FONT   = Math.round(11 * SCALE);   // 35px — both PIC and co-pilot name
const TIME_FONT   = Math.round(11 * 0.75 * SCALE); // 26px — time top-left
const RIGHT_FONT  = Math.round(11 * 0.9 * SCALE);  // 32px — [dur] EVENT top-right
const BOT_FONT    = Math.round(11 * 0.85 * SCALE);  // 30px — bottom strip
const PAD_H       = Math.round(8 * SCALE);    // 26px — left/right padding
const PAD_TOP     = Math.round(4 * SCALE);    // 13px — top padding
const PAD_BOT     = BOT_FONT + Math.round(6 * SCALE); // bottom padding = bottom strip height + gap
const TILE_RADIUS = Math.round(4 * SCALE);    // 13px — border radius

// Inline select / input style — invisible, sits on top of rendered text
const ghostStyle = (
  fontSize: number,
  color: string,
  width: number | string,
  fontWeight: number = 400,
  fontStyle: 'normal' | 'italic' = 'normal',
  mono: boolean = false,
  textAlign: 'left' | 'right' | 'center' = 'left',
): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none' as any,
  WebkitAppearance: 'none' as any,
  MozAppearance: 'none' as any,
  fontFamily: mono
    ? 'ui-monospace, SFMono-Regular, "Courier New", monospace'
    : 'inherit',
  fontWeight,
  fontStyle,
  fontSize,
  color,
  width: typeof width === 'number' ? `${width}px` : width,
  padding: 0,
  margin: 0,
  lineHeight: 1.2,
  textAlign,
});

type StableDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
  isHeader?: boolean;
};

let activeAddFlightDropdownKey: string | null = null;
const addFlightDropdownListeners = new Set<(key: string | null) => void>();

const setActiveAddFlightDropdownKey = (key: string | null) => {
  activeAddFlightDropdownKey = key;
  addFlightDropdownListeners.forEach(listener => listener(key));
};

const isPersonDropdownKey = (key: string | null) => Boolean(
  key && (
    key === 'pic-dropdown-portal'
    || key === 'copilot-dropdown-portal'
    || key.startsWith('formation-pic-dropdown-')
    || key.startsWith('formation-crew-dropdown-')
  )
);

const usePersistentDropdownOpen = (dropdownKey: string) => {
  const [open, setLocalOpen] = useState(() => activeAddFlightDropdownKey === dropdownKey);

  useEffect(() => {
    const listener = (activeKey: string | null) => {
      setLocalOpen(activeKey === dropdownKey);
    };
    addFlightDropdownListeners.add(listener);
    listener(activeAddFlightDropdownKey);
    return () => {
      addFlightDropdownListeners.delete(listener);
    };
  }, [dropdownKey]);

  const setOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const current = activeAddFlightDropdownKey === dropdownKey;
    const nextOpen = typeof next === 'function' ? next(current) : next;
    setActiveAddFlightDropdownKey(nextOpen ? dropdownKey : null);
  }, [dropdownKey]);

  return [open, setOpen] as const;
};

type PersonDropdownMemory = {
  unit: string | null;
  layer2: string | null;
  scroll: {
    units: number;
    layer2: number;
    names: number;
  };
};

const personDropdownColumnState = new Map<string, PersonDropdownMemory>();

const getPersonDropdownMemory = (dropdownKey: string): PersonDropdownMemory => (
  personDropdownColumnState.get(dropdownKey) ?? {
    unit: null,
    layer2: null,
    scroll: { units: 0, layer2: 0, names: 0 },
  }
);

interface StableDropdownProps {
  value: string;
  options: StableDropdownOption[];
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  width?: number;
  maxHeight?: number;
  zIndex?: number;
  align?: 'left' | 'right';
  dropdownKey?: string;
}

const StableDropdown: React.FC<StableDropdownProps> = ({
  value,
  options,
  onChange,
  children,
  disabled = false,
  width = 220,
  maxHeight = 280,
  zIndex = 10000,
  align = 'left',
  dropdownKey,
}) => {
  const instanceKeyRef = useRef(dropdownKey || `stable-dropdown-${Math.random().toString(36).slice(2)}`);
  const instanceKey = instanceKeyRef.current;
  const [open, setOpen] = usePersistentDropdownOpen(instanceKey);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalId = useMemo(() => `stable-dropdown-${instanceKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`, [instanceKey]);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const right = Math.max(8, window.innerWidth - rect.right);
    setPos(align === 'right'
      ? { top: rect.bottom + 4, right }
      : { top: rect.bottom + 4, left });
  }, [align, width]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const portalEl = document.getElementById(portalId);
      if (portalEl?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [portalId]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  const openDropdown = () => {
    if (disabled) return;
    updatePosition();
    setOpen(o => !o);
  };

  const panel = open && !disabled ? ReactDOM.createPortal(
    <div
      id={portalId}
      onPointerDown={e => e.stopPropagation()}
      onPointerDownCapture={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        right: pos.right,
        width,
        maxHeight,
        overflowY: 'auto',
        zIndex,
        backgroundColor: '#172a42',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        padding: 4,
      }}
    >
      {options.length === 0 ? (
        <div style={{ padding: '9px 10px', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>No options</div>
      ) : options.map((option, optionIndex) => {
        if (option.isHeader) {
          return (
            <div
              key={`header-${option.label}-${optionIndex}`}
              style={{
                padding: '7px 10px 5px',
                color: 'rgba(125,211,252,0.88)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {option.label}
            </div>
          );
        }
        const selected = option.value === value;
        return (
          <button
            key={`${option.value}-${option.label}`}
            type="button"
            disabled={option.disabled}
            onClick={() => {
              if (option.disabled) return;
              onChange(option.value);
              setOpen(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              border: 'none',
              borderRadius: 5,
              background: selected ? 'rgba(34,211,238,0.18)' : 'transparent',
              color: option.disabled ? 'rgba(255,255,255,0.35)' : selected ? '#fff' : 'rgba(255,255,255,0.82)',
              cursor: option.disabled ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              lineHeight: 1.2,
              padding: '8px 10px',
              textAlign: 'left',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!option.disabled && !selected) e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = selected ? 'rgba(34,211,238,0.18)' : 'transparent';
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={triggerRef}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation();
        openDropdown();
      }}
      style={{ display: 'inline-flex', cursor: disabled ? 'default' : 'pointer' }}
    >
      {children}
      {panel}
    </div>
  );
};

interface SelectLikeDropdownProps {
  value: string;
  options: StableDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: number;
  maxHeight?: number;
  accent?: 'sky' | 'emerald';
  dropdownKey?: string;
}

const SelectLikeDropdown: React.FC<SelectLikeDropdownProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select',
  width = 260,
  maxHeight = 300,
  accent = 'sky',
  dropdownKey,
}) => {
  const selected = options.find(option => !option.isHeader && option.value === value);
  const ringColour = accent === 'emerald' ? 'rgba(16,185,129,0.65)' : 'rgba(14,165,233,0.65)';
  return (
    <StableDropdown
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      width={width}
      maxHeight={maxHeight}
      zIndex={12000}
      dropdownKey={dropdownKey}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={e => e.preventDefault()}
        style={{
          width: '100%',
          minHeight: 38,
          borderRadius: 6,
          border: '1px solid rgba(75,85,99,1)',
          backgroundColor: disabled ? 'rgba(55,65,81,0.5)' : 'rgba(55,65,81,1)',
          color: disabled ? 'rgba(255,255,255,0.45)' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          fontSize: 14,
          outline: 'none',
          boxShadow: '0 0 0 0 transparent',
        }}
        onFocus={e => {
          e.currentTarget.style.boxShadow = `0 0 0 2px ${ringColour}`;
        }}
        onBlur={e => {
          e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label || placeholder}
        </span>
        <span style={{ flexShrink: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>▼</span>
      </button>
    </StableDropdown>
  );
};

// ─── Convert Tailwind bg class to rgba matching FlightTile.tsx rendering ────
// Uses the same TAILWIND_COLORS palette and alpha mapping as FlightTile.tsx
// so the Add Flight Tile preview matches the actual schedule tile appearance.
const twClassToRgba = (cls: string): string => {
  const TAILWIND_COLORS: Record<string, Record<string, [number, number, number]>> = {
    sky:     { '400': [56,189,248],   '500': [14,165,233] },
    purple:  { '400': [192,132,252],  '500': [168,85,247] },
    yellow:  { '400': [250,204,21],   '500': [234,179,8] },
    pink:    { '400': [244,114,182],  '500': [236,72,153] },
    teal:    { '400': [45,212,191],   '500': [20,184,166] },
    indigo:  { '400': [129,140,248],  '500': [99,102,241] },
    cyan:    { '400': [34,211,238],   '500': [6,182,212] },
    blue:    { '400': [96,165,250],   '500': [59,130,246] },
    green:   { '400': [74,222,128],   '500': [34,197,94] },
    orange:  { '400': [251,146,60],   '500': [249,115,22] },
    red:     { '400': [248,113,113],  '500': [239,68,68],  '800': [153,27,27], '900': [127,29,29] },
    gray:    { '400': [156,163,175],  '500': [107,114,128],'600': [75,85,99] },
    amber:   { '400': [251,191,36],   '500': [245,158,11], '700': [180,83,9] },
    fuchsia: { '400': [232,121,249],  '500': [217,70,239] },
    lime:    { '400': [163,230,53],   '500': [132,204,22] },
    violet:  { '400': [167,139,250],  '500': [139,92,246] },
    rose:    { '400': [251,113,133],  '500': [244,63,94] },
    emerald: { '400': [52,211,153],   '500': [16,185,129] },
  };
  if (!cls || !cls.startsWith('bg-')) return 'rgba(107,114,128,0.57)'; // gray fallback
  const match = cls.match(/^bg-([a-z]+)-(\d+)(?:\/(\d+))?$/);
  if (!match) return 'rgba(107,114,128,0.57)';
  const [, colorName, shade, opacityStr] = match;
  const rgb = TAILWIND_COLORS[colorName]?.[shade];
  if (!rgb) return 'rgba(107,114,128,0.57)';
  const opacity = opacityStr ? parseInt(opacityStr, 10) : 100;
  let alpha: number;
  if (opacity >= 75) alpha = 0.57;
  else if (opacity >= 45) alpha = 0.42;
  else if (opacity >= 30) alpha = 0.35;
  else alpha = (opacity / 100) * 0.7;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
};
// Keep twClassToHex as an alias for backward-compat
const twClassToHex = twClassToRgba;

// ─── Cascading dropdown for Person selection (3 layers: Unit→Staff/Course→Names) ─
interface PersonDropdownProps {
  value: string;
  displayValue?: string;  // optional display label (e.g. "Davies, Mary (ADF301)") — if omitted, value is shown
  onChange: (name: string, callsigns: string[]) => void;
  allUnits: string[];
  getLayer2: (unit: string) => string[];
  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
  placeholder: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  allowSolo?: boolean;    // shows SOLO as first option
  onSoloSelect?: () => void;
  dropdownZIndex?: number; // z-index for the portal dropdown (default 9000)
  dropdownId?: string;     // unique id for portal element (default 'person-dropdown-portal')
}

const PersonDropdown: React.FC<PersonDropdownProps> = ({
  value, displayValue, onChange, allUnits, getLayer2, getNames,
  placeholder, fontSize, color, bold = false, allowSolo, onSoloSelect,
  dropdownZIndex = 10000,
  dropdownId = 'person-dropdown-portal',
}) => {
  const dropdownKey = dropdownId;
  const [open, setOpen] = usePersistentDropdownOpen(dropdownKey);
  const rememberedColumns = getPersonDropdownMemory(dropdownKey);
  const [selectedUnit, setSelectedUnitState] = useState<string | null>(rememberedColumns?.unit ?? null);
  const [selectedL2, setSelectedL2State] = useState<string | null>(rememberedColumns?.layer2 ?? null);
  const ref = useRef<HTMLDivElement>(null);
  const unitsColumnRef = useRef<HTMLDivElement>(null);
  const layer2ColumnRef = useRef<HTMLDivElement>(null);
  const namesColumnRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const rememberScroll = useCallback((column: keyof PersonDropdownMemory['scroll'], scrollTop: number) => {
    const existing = getPersonDropdownMemory(dropdownKey);
    personDropdownColumnState.set(dropdownKey, {
      ...existing,
      scroll: { ...existing.scroll, [column]: scrollTop },
    });
  }, [dropdownKey]);

  const setSelectedUnit = useCallback((unit: string | null) => {
    if (unit === selectedUnit) return;
    setSelectedUnitState(unit);
    setSelectedL2State(null);
    const existing = getPersonDropdownMemory(dropdownKey);
    personDropdownColumnState.set(dropdownKey, {
      ...existing,
      unit,
      layer2: null,
      scroll: { ...existing.scroll, layer2: 0, names: 0 },
    });
  }, [dropdownKey, selectedUnit]);

  const setSelectedL2 = useCallback((layer2: string | null) => {
    if (layer2 === selectedL2) return;
    setSelectedL2State(layer2);
    const existing = getPersonDropdownMemory(dropdownKey);
    personDropdownColumnState.set(dropdownKey, {
      ...existing,
      unit: selectedUnit,
      layer2,
      scroll: { ...existing.scroll, names: 0 },
    });
  }, [dropdownKey, selectedL2, selectedUnit]);

  const closeDropdown = useCallback((clearColumns = false) => {
    setOpen(false);
    if (clearColumns) {
      setSelectedUnitState(null);
      setSelectedL2State(null);
      personDropdownColumnState.delete(dropdownKey);
    }
  }, [dropdownKey, setOpen]);

  const updateDropdownPosition = useCallback(() => {
    if (!ref.current) {
      closeDropdown();
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.bottom) || (rect.width === 0 && rect.height === 0)) {
      closeDropdown();
      return;
    }
    const DROPDOWN_WIDTH = 520;
    const left = Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8);
    setDropdownPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, [closeDropdown]);

  useEffect(() => () => {
    if (activeAddFlightDropdownKey === dropdownKey) setActiveAddFlightDropdownKey(null);
  }, [dropdownKey]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also check if click was inside the portal dropdown
        const portalEl = document.getElementById(dropdownId);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        closeDropdown();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [closeDropdown, dropdownId]);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    if (selectedUnit && allUnits.includes(selectedUnit)) return;
    const nextUnit = allUnits[0] || null;
    setSelectedUnit(nextUnit);
  }, [allUnits, open, selectedUnit, setSelectedUnit]);

  useLayoutEffect(() => {
    if (!open) return;
    const memory = getPersonDropdownMemory(dropdownKey);
    if (unitsColumnRef.current) unitsColumnRef.current.scrollTop = memory.scroll.units;
    if (layer2ColumnRef.current) layer2ColumnRef.current.scrollTop = memory.scroll.layer2;
    if (namesColumnRef.current) namesColumnRef.current.scrollTop = memory.scroll.names;
  }, [dropdownKey, open, selectedUnit, selectedL2, allUnits]);

  const handleOpen = () => {
    updateDropdownPosition();
    setOpen(o => !o);
  };

  // Portal dropdown rendered at document.body level
  const dropdownPanel = open ? ReactDOM.createPortal(
    <div
      id={dropdownId}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerDownCapture={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: dropdownZIndex,
        display: 'flex',
        width: 520,
        maxHeight: 300,
        backgroundColor: '#1a2f4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      {/* Col 1: Units */}
      <div
        ref={unitsColumnRef}
        onScroll={e => rememberScroll('units', e.currentTarget.scrollTop)}
        style={{ width: 110, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#1a2f4a' }}
      >
        {allowSolo && (
          <div
            onClick={() => { onSoloSelect?.(); closeDropdown(true); }}
            style={{ padding: '9px 12px', color: '#ffd43b', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,212,59,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            SOLO
          </div>
        )}
        {allUnits.map(unit => (
          <div
            key={unit}
            onClick={() => {
              setSelectedUnit(unit);
            }}
            onMouseEnter={() => setSelectedUnit(unit)}
            style={{
              padding: '9px 12px', fontSize: 13, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: selectedUnit === unit ? '#fff' : 'rgba(255,255,255,0.8)',
              backgroundColor: selectedUnit === unit ? 'rgba(255,255,255,0.12)' : 'transparent',
            }}
          >
            {unit}
            <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>
          </div>
        ))}
      </div>

      {/* Col 2: STAFF / Courses */}
      <div
        ref={layer2ColumnRef}
        onScroll={e => rememberScroll('layer2', e.currentTarget.scrollTop)}
        style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#16293f' }}
      >
        {selectedUnit ? (
          getLayer2(selectedUnit).map(opt => (
            <div
              key={opt}
              onClick={() => setSelectedL2(opt)}
              onMouseEnter={() => setSelectedL2(opt)}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: opt === 'STAFF' ? 600 : 400,
                color: selectedL2 === opt ? '#fff' : 'rgba(255,255,255,0.8)',
                backgroundColor: selectedL2 === opt ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {opt}
              <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            Select unit
          </div>
        )}
      </div>

      {/* Col 3: Names */}
      <div
        ref={namesColumnRef}
        onScroll={e => rememberScroll('names', e.currentTarget.scrollTop)}
        style={{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: '#122437' }}
      >
        {selectedUnit && selectedL2 ? (
          getNames(selectedUnit, selectedL2).map(person => (
            <div
            key={person.name}
            onClick={() => {
              onChange(person.name, []);
                closeDropdown(true);
            }}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                color: person.color || '#fff',
                backgroundColor: 'transparent',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {person.label}
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            {selectedUnit ? 'Select category' : 'Select unit'}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleOpen}
        style={{
          fontSize,
          fontWeight: bold ? 700 : 400,
          fontStyle: 'italic',
          color,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 120,
          padding: '2px 4px',
          borderRadius: 3,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {displayValue || value || placeholder}
      </div>
      {dropdownPanel}
    </div>
  );
};

// ─── Event (syllabus) cascading dropdown (2 layers: Course→Events) ─────────
interface EventDropdownProps {
  value: string;
  onChange: (code: string, durationHrs?: number) => void;
  courseOptions: string[];
  getEventsForCourse: (course: string) => SyllabusItemDetail[];
  nextLMPEvent: SyllabusItemDetail | null;
  getCourseDisplayLabel?: (course: string) => string;
  getEventDisplayLabel?: (code: string) => string;
  continuationEventOptions?: string[];
  fontSize: number;
  color: string;
  disabled?: boolean;
}

const EventDropdown: React.FC<EventDropdownProps> = ({
  value, onChange, courseOptions, getEventsForCourse, nextLMPEvent,
  getCourseDisplayLabel = (course) => course,
  getEventDisplayLabel = (code) => code,
  continuationEventOptions = [],
  fontSize, color, disabled,
}) => {
  const dropdownKey = 'add-flight-event-dropdown';
  const [open, setOpen] = usePersistentDropdownOpen(dropdownKey);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const portalId = 'event-dropdown-portal';
  const ref = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const selectCourse = useCallback((course: string | null) => {
    setSelectedCourse(current => current === course ? current : course);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, []);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const portalEl = document.getElementById(portalId);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [portalId]);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    if (selectedCourse && courseOptions.includes(selectedCourse)) return;
    setSelectedCourse(courseOptions[0] || null);
  }, [courseOptions, open, selectedCourse]);

  const handleOpen = () => {
    if (disabled) return;
    updateDropdownPosition();
    setOpen(o => {
      const nextOpen = !o;
      if (nextOpen && !selectedCourse) selectCourse(courseOptions[0] || null);
      return nextOpen;
    });
  };

  const dropdownPanel = open && !disabled ? ReactDOM.createPortal(
    <div
      id={portalId}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onPointerDownCapture={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        right: dropdownPos.right,
        zIndex: 10000,
        display: 'flex',
        width: 400,
        maxHeight: 320,
        backgroundColor: '#1a2f4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      {/* Col 1: Courses */}
      <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 320, backgroundColor: '#1a2f4a' }}>
        {courseOptions.map(course => (
          <div
            key={course}
            onClick={() => selectCourse(course)}
            onMouseEnter={() => selectCourse(course)}
            style={{
              padding: '9px 12px', fontSize: 13, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: selectedCourse === course ? '#fff' : 'rgba(255,255,255,0.8)',
              backgroundColor: selectedCourse === course ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: course === 'SCT' ? 600 : 400,
            }}
          >
            {getCourseDisplayLabel(course)}
            <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>
          </div>
        ))}
      </div>

      {/* Col 2: Events */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, backgroundColor: '#16293f' }}>
        {selectedCourse === 'SCT' ? (
          continuationEventOptions.map(code => (
            <div
              key={code}
              onClick={() => {
                onChange(code);
                setOpen(false);
                setSelectedCourse(null);
              }}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                color: '#fff',
                backgroundColor: 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>{getEventDisplayLabel(code)}</span>
            </div>
          ))
        ) : selectedCourse ? (
          getEventsForCourse(selectedCourse).map(ev => {
            const code = ev.code || ev.id || '';
            const isNext = nextLMPEvent && (nextLMPEvent.code === code || nextLMPEvent.id === code);
            return (
              <div
                key={code}
                onClick={() => {
                  onChange(code, ev.duration || ev.flightOrSimHours || undefined);
                  setOpen(false);
                  setSelectedCourse(null);
                }}
                style={{
                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                  color: isNext ? '#22c55e' : '#fff',
                  backgroundColor: isNext ? 'rgba(34,197,94,0.12)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.12)' : 'transparent')}
                title={ev.eventDescription || code}
              >
                <span>{code}</span>
                {isNext && <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 6 }}>NEXT</span>}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            Select a course
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleOpen}
        style={{
          fontSize,
          fontStyle: 'italic',
          fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
          color,
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          minWidth: 80,
          padding: '2px 4px',
          borderRadius: 3,
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {getEventDisplayLabel(value) || 'EVENT'}
      </div>
      {dropdownPanel}
    </div>
  );
};


// ─── Large Interactive Flight Tile ─────────────────────────────────────────
// Layout mirrors real FlightTile.tsx exactly:
//  - Outer wrapper: position:relative, paddingBottom large enough for bottom strip
//  - Time: absolute top-0 left, tiny monospace (same as real tile)
//  - Body: flex row — left column (PIC + co-pilot stacked) + right column ([dur] EVENT)
//  - Bottom strip: absolute bottom, left (#aircraft) and right (area + callsign)
//  - Height is content-driven (flexbox), never hardcoded
interface TileProps {
  flightType: 'Dual' | 'Solo';
  startTime: number;
  picName: string;
  studentName: string;
  duration: number;
  flightNumber: string;
  area: string;
  aircraftNumber: string;
  aircraftNumberPrefix: string;
  aircraftNumberSettings: AircraftNumberSettings;
  callsign: string;
  color: string;
  // options
  timeOptions: { value: string; label: string }[];
  durationOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  aircraftOptions: { value: string; label: string }[];
  callsignOptions: string[];
  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];
  // cascading dropdown helpers
  allUnits: string[];
  getLayer2: (unit: string) => string[];
  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
  getPicNames?: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
  getDisplayLabel: (name: string) => string;  // returns "Name – Course" for trainees, "Name" for staff
  // event dropdown helpers
  courseOptions: string[];
  getEventsForCourse: (course: string) => SyllabusItemDetail[];
  nextLMPEvent: SyllabusItemDetail | null;
  eventCategory: string;
  getCourseDisplayLabel?: (course: string) => string;
  getEventDisplayLabel?: (code: string) => string;
  // change handlers
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
  onStartTimeChange: (v: number) => void;
  onPicNameChange: (name: string, callsigns: string[]) => void;
  onStudentNameChange: (name: string) => void;
  onDurationChange: (v: number) => void;
  onFlightNumberChange: (code: string, durationHrs?: number) => void;
  onAreaChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
  onAircraftPrefixChange: (v: string) => void;
  onCallsignChange: (v: string) => void;
  // lifted layout state (owned by AddFlightTileModal)
  editMode: boolean;
  layoutSaved: boolean;
  positions: Record<string, { x: number; y: number }>;
  savedPositions: Record<string, { x: number; y: number }>;
  onEnterEditMode: () => void;
  onExitEditMode: (save: boolean) => void;
  onDragPosition: (key: string, pos: { x: number; y: number }) => void;
  activeStep: GuideStep;
}

const FlightTile: React.FC<TileProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings, callsign, color,
  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,
  formationCallsigns,
  allUnits, getLayer2, getNames, getPicNames, getDisplayLabel,
  courseOptions, getEventsForCourse, nextLMPEvent, eventCategory, getCourseDisplayLabel, getEventDisplayLabel, continuationEventOptions = [],
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onAircraftPrefixChange, onCallsignChange,
  editMode, layoutSaved, positions, savedPositions,
  onEnterEditMode, onExitEditMode, onDragPosition,
  activeStep,
}) => {
  // ── Design constants ──────────────────────────────────────────────────
  const TILE_BG    = '#7a6a2a';
  const TILE_BORDER= '#1a2340';
  const WHITE_FULL = 'rgba(255,255,255,0.95)';
  const WHITE_DIM  = 'rgba(255,255,255,0.75)';
  const WHITE_GHOST= 'rgba(255,255,255,0.35)';
  const TILE_H     = 76;
  const monoFamily = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft' | 'callsign';

  // Default positions — used for first render and after Cancel
  const DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 7 },
    picName:   { x: 83, y: 9 },
    coPilot:   { x: 83, y: 36 },
    duration:  { x: 410, y: 1 },
    event:     { x: 486, y: 1 },
    aircraft:  { x: 14, y: 57 },
    area:      { x: 476, y: 58 },
    callsign:  { x: 532, y: 59 },
  };

  const activeElemKey = useMemo<ElemKey | null>(() => {
    if (activeStep === 'startTime') return 'startTime';
    if (activeStep === 'trainee') return 'coPilot';
    if (activeStep === 'instructor') return 'picName';
    if (activeStep === 'event') return 'event';
    if (activeStep === 'area') return 'area';
    if (activeStep === 'aircraft') return 'aircraft';
    return null;
  }, [activeStep]);

  const guideGlowStyle = (elemKey: ElemKey): React.CSSProperties => activeElemKey === elemKey
    ? {
        color: 'rgba(210, 250, 255, 0.98)',
        textShadow: '0 0 6px rgba(34, 211, 238, 0.9), 0 0 16px rgba(34, 211, 238, 0.7)',
        animation: 'addFlightTileGuideGlow 2.4s ease-in-out infinite',
      }
    : {};

  const stripCourseSuffix = (name: string): string =>
    name
      .replace(/\s+[–-]\s+[A-Z]{2,}\d{2,}$/i, '')
      .replace(/\s+\([A-Z]{2,}\d{2,}\)$/i, '');

  // ── State ──────────────────────────────────────────────────────────────
  // Layout state is LIFTED to AddFlightTileModal — received via props:
  //   editMode, layoutSaved, positions, savedPositions
  //   onEnterEditMode, onExitEditMode, onDragPosition

  const tileRef   = useRef<HTMLDivElement>(null);
  const elemRefs  = useRef<Partial<Record<ElemKey, HTMLDivElement | null>>>({});
  const dragging  = useRef<{ key: ElemKey; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  // When entering edit mode, capture the real DOM positions of each element
  const enterEditMode = () => {
    // Capture current DOM positions if no layout saved yet, then delegate to parent
    if (!layoutSaved && tileRef.current) {
      const tileRect = tileRef.current.getBoundingClientRect();
      const measuredPos: Record<string, { x: number; y: number }> = { ...DEFAULT_POSITIONS };
      (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {
        const el = elemRefs.current[key];
        if (el) {
          const r = el.getBoundingClientRect();
          measuredPos[key] = {
            x: Math.round(r.left - tileRect.left),
            y: Math.round(r.top  - tileRect.top),
          };
        }
      });
      // Push measured positions to parent before entering edit mode
      (Object.keys(measuredPos) as ElemKey[]).forEach(k =>
        onDragPosition(k, measuredPos[k])
      );
    }
    onEnterEditMode();
  };

  const exitEditMode = (save: boolean) => {
    onExitEditMode(save);
  };

  // Mouse drag handlers
  const onMouseDown = (key: ElemKey) => (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = {
      key,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: positions[key].x,
      startPosY: positions[key].y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !tileRef.current) return;
      const { key, startMouseX, startMouseY, startPosX, startPosY } = dragging.current;
      const tileRect = tileRef.current.getBoundingClientRect();
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const newX = Math.max(0, Math.min(tileRect.width  - 20, startPosX + dx));
      const newY = Math.max(0, Math.min(TILE_H - 20, startPosY + dy));
      onDragPosition(key, { x: Math.round(newX), y: Math.round(newY) });
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [editMode, positions]);

  // ── Oval wrapper ──────────────────────────────────────────────────────
  const Oval: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
    minW?: number; px?: number; py?: number;
  }> = ({ children, style, minW = 0, px = 10, py = 5 }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 50, padding: `${py}px ${px}px`,
      minWidth: minW, boxSizing: 'border-box', lineHeight: 1, ...style,
    }}>
      {children}
    </div>
  );

  // ── Absolutely-positioned element (used in both edit mode and saved layout) ──
  const AbsElem: React.FC<{
    elemKey: ElemKey;
    children: React.ReactNode;
    draggable?: boolean;
  }> = ({ elemKey, children, draggable: isDraggable = false }) => {
    const pos = (editMode ? positions : savedPositions)[elemKey];
    return (
      <div
        ref={el => { elemRefs.current[elemKey] = el; }}
        onMouseDown={isDraggable ? onMouseDown(elemKey) : undefined}
        style={{
          position: 'absolute',
          left: pos.x,
          top:  pos.y,
          cursor: isDraggable ? 'grab' : 'default',
          zIndex: isDraggable ? 100 : 5,
          outline: isDraggable ? '2px dashed rgba(255,220,60,0.9)' : 'none',
          outlineOffset: isDraggable ? 3 : 0,
          borderRadius: 4,
          padding: isDraggable ? 2 : 0,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          ...guideGlowStyle(elemKey),
        }}
        title={isDraggable ? 'Drag to reposition' : undefined}
      >
        {children}
      </div>
    );
  };

  // ── Flex ref wrapper (used in normal non-saved layout) ────────────────
  const FlexElem: React.FC<{ elemKey: ElemKey; children: React.ReactNode; style?: React.CSSProperties }> = ({ elemKey, children, style }) => (
    <div ref={el => { elemRefs.current[elemKey] = el; }} style={{ display: 'inline-flex', alignItems: 'center', ...guideGlowStyle(elemKey), ...style }}>
      {children}
    </div>
  );

  // ── All element content definitions ──────────────────────────────────
  const startTimeContent = (zOverride?: number) => (
    <StableDropdown
      value={String(startTime)}
      options={timeOptions}
      onChange={v => onStartTimeChange(parseFloat(v))}
      width={150}
      zIndex={zOverride ?? 10000}
      dropdownKey="add-flight-start-time"
    >
      <span style={{ fontFamily: monoFamily, fontSize: 18, fontWeight: 600, color: WHITE_DIM, lineHeight: 1, letterSpacing: 0 }}>
        {formatTime(startTime)}
      </span>
    </StableDropdown>
  );

  const picNameContent = () => (
    <PersonDropdown value={picName} displayValue={stripCourseSuffix(picName)} onChange={onPicNameChange} allUnits={allUnits} getLayer2={getLayer2} getNames={getPicNames || getNames}
      placeholder="Surname, First (N)" fontSize={28} color={picName ? WHITE_FULL : WHITE_GHOST} bold
      dropdownId="pic-dropdown-portal" />
  );

  const coPilotContent = () => {
    if (eventCategory === 'twr_di') {
      return <span style={{ fontSize: 22, color: WHITE_DIM, lineHeight: 1.25 }}>TWR DI</span>;
    }
    return flightType === 'Dual' ? (
      <PersonDropdown value={studentName} displayValue={stripCourseSuffix(studentName)} onChange={(name) => onStudentNameChange(name)} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
        placeholder="Surname, First (N)" fontSize={26} color={studentName ? WHITE_DIM : WHITE_GHOST} allowSolo onSoloSelect={() => onFlightTypeChange('Solo')}
        dropdownId="copilot-dropdown-portal" />
    ) : (
      <span onClick={() => onFlightTypeChange('Dual')}
        style={{ display: 'inline-block', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)', padding: '3px 10px', borderRadius: 4, lineHeight: 1.25, cursor: 'pointer' }}
        title="Click to switch to Dual">SOLO</span>
    );
  };

  const durationContent = (zOverride?: number) => (
    <StableDropdown
      value={String(duration)}
      options={durationOptions}
      onChange={v => onDurationChange(parseFloat(v))}
      width={150}
      zIndex={zOverride ?? 10000}
      dropdownKey="add-flight-duration"
    >
      <span style={{ fontFamily: monoFamily, fontSize: 24, fontWeight: 700, color: WHITE_DIM, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>
    </StableDropdown>
  );

  const eventContent = () => {
    if (eventCategory === 'twr_di') {
      return (
        <div style={{ position: 'relative' }}>
          <span style={{ fontFamily: monoFamily, fontSize: 26, color: WHITE_FULL, lineHeight: 1 }}>TWR DI</span>
        </div>
      );
    }
    return (
      <div style={{ position: 'relative' }}>
        <EventDropdown
          value={flightNumber}
          onChange={onFlightNumberChange}
          courseOptions={courseOptions}
          getEventsForCourse={getEventsForCourse}
          nextLMPEvent={nextLMPEvent}
          getCourseDisplayLabel={getCourseDisplayLabel}
          getEventDisplayLabel={getEventDisplayLabel}
          continuationEventOptions={continuationEventOptions}
          fontSize={26}
          color={flightNumber ? WHITE_FULL : WHITE_GHOST}
        />
      </div>
    );
  };

  const areaContent = (zOverride?: number) => (
    <StableDropdown
      value={area}
      options={areaOptions}
      onChange={onAreaChange}
      width={180}
      zIndex={zOverride ?? 10000}
      dropdownKey="add-flight-area"
    >
      <span style={{ fontSize: 24, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_DIM : 'rgba(255,220,60,0.95)', lineHeight: 1 }}>{area || '-'}</span>
    </StableDropdown>
  );

  const aircraftContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <StableDropdown
        value={aircraftNumber}
        options={aircraftOptions}
        onChange={onAircraftChange}
        width={150}
        zIndex={zOverride ?? 10000}
        dropdownKey="add-flight-aircraft-number"
      >
        <span style={{ fontFamily: monoFamily, fontSize: 22, color: aircraftNumber ? WHITE_DIM : 'rgba(255,255,255,0.35)', lineHeight: 1 }}>
          {aircraftNumber || 'SKIP'}
        </span>
      </StableDropdown>
      {aircraftNumberSettings.usePrefix && (
        <StableDropdown
          value={aircraftNumberPrefix}
          options={aircraftNumberSettings.prefixes.map(prefix => ({ value: prefix, label: prefix }))}
          onChange={onAircraftPrefixChange}
          width={120}
          zIndex={zOverride ?? 10000}
          dropdownKey="add-flight-aircraft-prefix"
        >
          <span style={{ marginLeft: 5, fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1 }}>▼</span>
        </StableDropdown>
      )}
    </div>
  );

  const callsignContent = (zOverride?: number) => (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {/* Editable text input — always visible and typeable */}
      <input
        type="text"
        value={callsign}
        onChange={e => onCallsignChange(e.target.value)}
        placeholder="CALLSGN"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: monoFamily, fontSize: 18, fontStyle: 'normal', lineHeight: 1,
          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
          width: callsignOptions.length > 0 ? 125 : 135, padding: 0, cursor: 'text',
          wordSpacing: /\s+\d{3}$/.test(callsign) ? '-6px' : 0,
        }}
      />
      {/* Dropdown arrow + overlay select — only when options are available */}
      {callsignOptions.length > 0 && (
        <StableDropdown
          value={callsign}
          options={[{ value: '', label: '- select -' }, ...callsignOptions.map(cs => ({ value: cs, label: cs }))]}
          onChange={onCallsignChange}
          width={180}
          zIndex={zOverride ?? 10000}
          dropdownKey="add-flight-callsign"
        >
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', pointerEvents: 'none', lineHeight: 1 }}>▼</span>
        </StableDropdown>
      )}
    </div>
  );

  // ── Normal flex layout (before any save) ─────────────────────────────
  const normalFlexLayout = (
    <>
      <FlexElem elemKey="startTime" style={{ position: 'absolute', top: 4, left: 10, zIndex: 20 }}>
          {startTimeContent()}
      </FlexElem>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', width: '100%', paddingLeft: '10%', paddingRight: 12, boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', paddingRight: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <FlexElem elemKey="picName" style={{ transform: 'translate(5px, 2px)' }}>{picNameContent()}</FlexElem>
          <FlexElem elemKey="coPilot" style={{ transform: 'translate(5px, -2px)' }}>{coPilotContent()}</FlexElem>
        </div>
        <div style={{ flexShrink: 0, minWidth: 'fit-content', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, transform: 'translateY(-7px)' }}>
          <FlexElem elemKey="duration">{durationContent()}</FlexElem>
          <FlexElem elemKey="event">{eventContent()}</FlexElem>
          </div>
        </div>
      </div>
      <FlexElem elemKey="aircraft" style={{ position: 'absolute', bottom: 2, left: 10, zIndex: 20 }}>
        {aircraftContent()}
      </FlexElem>
      <div style={{ position: 'absolute', bottom: 2, right: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 20 }}>
          <FlexElem elemKey="area" style={{ transform: 'translate(-40px, 3px)' }}>{areaContent()}</FlexElem>
          <FlexElem elemKey="callsign" style={{ transform: 'translate(-4px, 4px)' }}>{callsignContent()}</FlexElem>
      </div>
    </>
  );

  // ── Saved layout (absolute, positions from savedPositions) ────────────
  const savedAbsLayout = (
    <>
      <AbsElem elemKey="startTime">{startTimeContent()}</AbsElem>
      <AbsElem elemKey="picName">{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot">{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration">{durationContent()}</AbsElem>
      <AbsElem elemKey="event">{eventContent()}</AbsElem>
      <AbsElem elemKey="area">{areaContent()}</AbsElem>
      <AbsElem elemKey="aircraft">{aircraftContent()}</AbsElem>
      <AbsElem elemKey="callsign">{callsignContent()}</AbsElem>
    </>
  );

  // ── Edit layout (absolute, draggable, positions from positions state) ─
  const editAbsLayout = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 1, pointerEvents: 'none' }} />
      <AbsElem elemKey="startTime" draggable>{startTimeContent(110)}</AbsElem>
      <AbsElem elemKey="picName"   draggable>{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot"   draggable>{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration"  draggable>{durationContent(110)}</AbsElem>
      <AbsElem elemKey="event"     draggable>{eventContent()}</AbsElem>
      <AbsElem elemKey="area"      draggable>{areaContent(110)}</AbsElem>
      <AbsElem elemKey="aircraft"  draggable>{aircraftContent(110)}</AbsElem>
      <AbsElem elemKey="callsign"  draggable>{callsignContent(110)}</AbsElem>
    </>
  );

  const showAbsolute = editMode || layoutSaved;

  return (
    <div style={{ width: '100%' }}>
      {/* EDIT / SAVE / CANCEL buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
        {!editMode ? (
          <button type="button" onClick={enterEditMode}
            style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', letterSpacing: 0.5 }}>
            ✎ EDIT LAYOUT
          </button>
        ) : (
          <>
            <button type="button" onClick={() => exitEditMode(false)}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,100,100,0.5)', background: 'rgba(200,50,50,0.25)', color: 'rgba(255,180,180,0.95)', cursor: 'pointer' }}>
              ✕ CANCEL
            </button>
            <button type="button" onClick={() => exitEditMode(true)}
              style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(60,200,100,0.5)', background: 'rgba(30,150,60,0.35)', color: 'rgba(120,255,160,0.95)', cursor: 'pointer' }}>
              ✔ SAVE LAYOUT
            </button>
          </>
        )}
      </div>

      {/* Tile */}
      <style>{`
        @keyframes addFlightTileGuideGlow {
          0%, 100% {
            text-shadow: 0 0 5px rgba(34, 211, 238, 0.7), 0 0 12px rgba(34, 211, 238, 0.45);
          }
          50% {
            text-shadow: 0 0 9px rgba(34, 211, 238, 1), 0 0 24px rgba(34, 211, 238, 0.9), 0 0 38px rgba(34, 211, 238, 0.55);
          }
        }
      `}</style>
      <div ref={tileRef}
        style={{
          position: 'relative',
          width: '100%',
          height: TILE_H,
          backgroundColor: twClassToHex(color),
          border: editMode ? `3px solid rgba(255,220,60,0.7)` : `3px solid ${TILE_BORDER}`,
          borderRadius: 4,
          boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
          userSelect: 'none',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: showAbsolute ? 'block' : 'flex',
          alignItems: showAbsolute ? undefined : 'stretch',
        }}
      >
        {editMode ? editAbsLayout : layoutSaved ? savedAbsLayout : normalFlexLayout}
      </div>

      {editMode && (
        <p style={{ fontSize: 11, color: 'rgba(255,220,60,0.75)', marginTop: 6, textAlign: 'center', letterSpacing: 0.3 }}>
          Drag any element to reposition it · Click SAVE LAYOUT to lock positions
        </p>
      )}
    </div>
  );
};// ─── Main Modal ───────────────────────────────────────────────────────────────
const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({
  onClose, onSave, initialEvent = null, eventsForDate = [], instructors, trainees, syllabusDetails, school,
  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,
  currentLocationName,
  locationOpAreas = {},
  formationCallsigns = [],
  userId,
  aircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
  aircraftConfigurationDefinitions = [],
  aircraftCrewComposition = DEFAULT_AIRCRAFT_CREW_COMPOSITION,
  crewCompositionSettings,
  operationalModel,
  activeUnitCode = '',
  activeUnitCodes = [],
  unitCallsignSettings,
  staffQualificationCatalogue,
  personnelDisplaySettings,
  personnelData,
  sctTerminology,
  sctEvents = [],
  nightContinuationDefaultStartTime = 18.5,
}) => {
  const resolvedSctTerminology = useMemo(
    () => normaliseSctTerminology(sctTerminology || DEFAULT_SCT_TERMINOLOGY),
    [sctTerminology],
  );
  const sctShortLabel = resolvedSctTerminology.shortLabel;
  const getContinuationDisplayLabel = useCallback((code: string) => {
    const rawCode = String(code || '').trim();
    return rawCode.replace(/\bSCT\b/gi, sctShortLabel);
  }, [sctShortLabel]);
  const isSctFormationCode = useCallback((code?: string | null) => String(code || '').trim().toUpperCase() === 'SCT FORM', []);
  const resolvedAircraftCrewComposition = useMemo(
    () => normaliseAircraftCrewComposition(aircraftCrewComposition),
    [aircraftCrewComposition],
  );
  const isSingleSeatAircraft = resolvedAircraftCrewComposition.crewCount === 1;
  const [eventCategory, setEventCategory] = useState<'lmp_event'|'lmp_currency'|'sct'|'staff_cat'|'twr_di'>('lmp_event');
  const [flightType,    setFlightType]    = useState<'Dual'|'Solo'>(isSingleSeatAircraft ? 'Solo' : 'Dual');
  const [picName,       setPicName]       = useState('');
  const [studentName,   setStudentName]   = useState('');
  const [flightNumber,  setFlightNumber]  = useState('');
  const [startTime,     setStartTime]     = useState(8.0);
  const [duration,      setDuration]      = useState(1.2);
  const [area,          setArea]          = useState('');
  const [aircraftNumber,setAircraftNumber]= useState('001');
  const [aircraftNumberPrefix,setAircraftNumberPrefix]= useState(aircraftNumberSettings.defaultPrefix);
  const [aircraftConfigId, setAircraftConfigId] = useState(BASE_AIRCRAFT_CONFIG.id);
  const [locationType,  setLocationType]  = useState<'Local'|'Land Away'>('Local');
  const [origin,        setOrigin]        = useState(school);
  const [destination,   setDestination]   = useState(school);
  const [formationType, setFormationType] = useState('');
  const [aircraftCount, setAircraftCount] = useState(1);
  const [formationCrew, setFormationCrew] = useState<FormationCrewDraft[]>([]);
  const [callsign,      setCallsign]      = useState('');
  const [callsignOptions, setCallsignOptions] = useState<string[]>([]);
  const [unitCallsignBase, setUnitCallsignBase] = useState('');
  const [unitCallsignNumber, setUnitCallsignNumber] = useState(0);
  const [notes,         setNotes]         = useState('');
  const [fixedCrewEventKey, setFixedCrewEventKey] = useState('');
  const [fixedCrewGroup, setFixedCrewGroup] = useState('');
  const [fixedCrewPic, setFixedCrewPic] = useState('');
  const [fixedCrewFormationAssignments, setFixedCrewFormationAssignments] = useState<FixedCrewFormationAssignment[]>([]);
  const [fixedCrewManifestStatus, setFixedCrewManifestStatus] = useState<ScheduleEvent['fixedCrewManifestStatus']>('pending');
  const [fixedCrewManifestNotes, setFixedCrewManifestNotes] = useState('');
  const [errors,        setErrors]        = useState<string[]>([]);
  const [isDeploy,      setIsDeploy]      = useState(false);
  const [deploymentStartDate,  setDeploymentStartDate]  = useState(date);
  const [deploymentStartTime,  setDeploymentStartTime]  = useState('08:00');
  const [deploymentEndDate,    setDeploymentEndDate]    = useState(date);
  const [deploymentEndTime,    setDeploymentEndTime]    = useState('08:00');
  const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(1);
  const [guidedStep, setGuidedStep] = useState<GuideStep>('startTime');
  const suppressNextCategoryResetRef = useRef(false);
  const aircraftConfigOptions = useMemo(() => {
    const definitions = aircraftConfigurationDefinitions.length > 0
      ? aircraftConfigurationDefinitions
      : [BASE_AIRCRAFT_CONFIG];
    return definitions.some(definition => definition.id === BASE_AIRCRAFT_CONFIG.id)
      ? definitions
      : [BASE_AIRCRAFT_CONFIG, ...definitions];
  }, [aircraftConfigurationDefinitions]);
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);
  const isAirCombatModel = normaliseOperationalModel(operationalModel) === 'air_combat';
  const isEditingExistingEvent = Boolean(initialEvent?.id && initialEvent?.resourceId);
  const existingFormationEvents = useMemo(() => {
    if (!initialEvent?.formationId) return initialEvent ? [initialEvent] : [];
    return eventsForDate
      .filter(candidate => candidate.formationId === initialEvent.formationId)
      .sort((a, b) => Number(a.formationPosition || 0) - Number(b.formationPosition || 0));
  }, [eventsForDate, initialEvent]);
  const normaliseFixedCrewUnitCode = (value?: string | null) => String(value || '').trim().toUpperCase();
  const activeFixedCrewUnitCodes = useMemo(() => {
    const rawUnits = activeUnitCodes.length > 0
      ? activeUnitCodes
      : String(activeUnitCode || '').split('+');
    return Array.from(new Set(
      rawUnits
        .map(unit => normaliseFixedCrewUnitCode(unit))
        .filter(Boolean),
    ));
  }, [activeUnitCode, activeUnitCodes]);
  const activeFixedCrewUnitCodeSet = useMemo(
    () => new Set(activeFixedCrewUnitCodes),
    [activeFixedCrewUnitCodes],
  );
  const parseFixedCrewGroupKey = (value?: string | null) => {
    const raw = String(value || '').trim();
    const [maybeUnit, ...crewParts] = raw.split('::');
    if (crewParts.length > 0) {
      return {
        unit: normaliseFixedCrewUnitCode(maybeUnit),
        crew: crewParts.join('::').replace(/^CREW\s*/i, '').trim().toUpperCase(),
      };
    }
    return {
      unit: '',
      crew: raw.replace(/^CREW\s*/i, '').trim().toUpperCase(),
    };
  };
  const fixedCrewGroupMatches = (candidate: string, value?: string | null) => {
    const candidateKey = parseFixedCrewGroupKey(candidate);
    const valueKey = parseFixedCrewGroupKey(value);
    if (!candidateKey.crew || !valueKey.crew) return false;
    if (candidateKey.crew !== valueKey.crew) return false;
    return !valueKey.unit || candidateKey.unit === valueKey.unit;
  };
  const stripLeadingUnitLabel = (value?: string | null, unit?: string | null) => {
    const text = String(value || '').trim();
    const unitLabel = normaliseFixedCrewUnitCode(unit);
    if (!text || !unitLabel) return text;
    if (!text.toUpperCase().startsWith(unitLabel)) return text;
    const stripped = text.slice(unitLabel.length).replace(/^[\s\-_/]+/, '').trim();
    return stripped || text;
  };
  const fixedCrewStaff = useMemo(() => instructorsData
    .filter(staff => {
      const staffUnit = normaliseFixedCrewUnitCode(staff.unit);
      return activeFixedCrewUnitCodeSet.size === 0 || activeFixedCrewUnitCodeSet.has(staffUnit);
    })
    .filter(staff => !staff.isAdminStaff), [activeFixedCrewUnitCodeSet, instructorsData]);
  const fixedCrewGroups = useMemo(() => Array.from(new Set(fixedCrewStaff
    .map(staff => {
      const crew = String(staff.crew || '').replace(/^CREW\s*/i, '').trim();
      const unit = normaliseFixedCrewUnitCode(staff.unit);
      return crew ? `${unit}::${crew}` : '';
    })
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [fixedCrewStaff]);
  const fixedCrewGroupOptionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    fixedCrewGroups.forEach(groupKey => {
      const parsed = parseFixedCrewGroupKey(groupKey);
      const unit = parsed.unit || 'Unit';
      groups.set(unit, [...(groups.get(unit) || []), groupKey]);
    });
    return Array.from(groups.entries()).map(([unit, options]) => ({ unit, options }));
  }, [fixedCrewGroups]);
  const resolveFixedCrewGroupValue = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return fixedCrewGroups.find(group => group === raw)
      || fixedCrewGroups.find(group => fixedCrewGroupMatches(group, raw))
      || '';
  };
  const fixedCrewRoleGroupLabel = (staff: Instructor) => String(staff.role || staff.category || 'Staff').trim() || 'Staff';
  const isFixedCrewPilotRole = (staff: Instructor) => /\b(PIC|Pilot)\b/i.test(fixedCrewRoleGroupLabel(staff));
  const compareFixedCrewMemberDisplay = (a: Instructor, b: Instructor) => {
    const aPilot = isFixedCrewPilotRole(a);
    const bPilot = isFixedCrewPilotRole(b);
    if (aPilot !== bPilot) return aPilot ? -1 : 1;
    if (!aPilot && !bPilot) {
      const roleCompare = fixedCrewRoleGroupLabel(a).localeCompare(fixedCrewRoleGroupLabel(b), undefined, { numeric: true });
      if (roleCompare !== 0) return roleCompare;
    }
    return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
  };
  const fixedCrewMembers = useMemo(() => {
    const selectedGroup = parseFixedCrewGroupKey(fixedCrewGroup);
    return selectedGroup.crew
      ? fixedCrewStaff
      .filter(staff => {
        const staffGroup = parseFixedCrewGroupKey(`${normaliseFixedCrewUnitCode(staff.unit)}::${staff.crew || ''}`);
        return staffGroup.crew === selectedGroup.crew
          && (!selectedGroup.unit || staffGroup.unit === selectedGroup.unit);
      })
      .sort(compareFixedCrewMemberDisplay)
      : [];
  }, [fixedCrewGroup, fixedCrewStaff, personnelDisplaySettings]);
  const fixedCrewMemberDisplayGroups = useMemo(() => {
    const groups = new Map<string, Instructor[]>();
    fixedCrewMembers.forEach(staff => {
      const label = isFixedCrewPilotRole(staff) ? 'Pilots' : fixedCrewRoleGroupLabel(staff);
      groups.set(label, [...(groups.get(label) || []), staff]);
    });
    return Array.from(groups.entries()).map(([label, members]) => ({ label, members }));
  }, [fixedCrewMembers]);
  const fixedCrewPicQualification = useMemo(() => getQualificationsForOperationalModel(staffQualificationCatalogue, 'fixed_crew')
    .find(qualification => (
      normaliseQualificationToken(qualification.id) === 'pic'
      || normaliseQualificationToken(qualification.code) === 'pic'
      || normaliseQualificationToken(qualification.name) === 'pic'
    )), [staffQualificationCatalogue]);
  const fixedCrewPicCandidates = useMemo(() => fixedCrewPicQualification
    ? fixedCrewMembers.filter(staff => normaliseAssignedQualificationIds(staff.preferences?.qualifications || [], staffQualificationCatalogue, false).includes(fixedCrewPicQualification.id))
    : [], [fixedCrewMembers, fixedCrewPicQualification, staffQualificationCatalogue]);
  const getFixedCrewMembersForGroup = (groupKey?: string | null) => {
    const selectedGroup = parseFixedCrewGroupKey(groupKey);
    return selectedGroup.crew
      ? fixedCrewStaff
        .filter(staff => {
          const staffGroup = parseFixedCrewGroupKey(`${normaliseFixedCrewUnitCode(staff.unit)}::${staff.crew || ''}`);
          return staffGroup.crew === selectedGroup.crew
            && (!selectedGroup.unit || staffGroup.unit === selectedGroup.unit);
        })
        .sort(compareFixedCrewMemberDisplay)
      : [];
  };
  const getFixedCrewPicCandidatesForGroup = (groupKey?: string | null) => fixedCrewPicQualification
    ? getFixedCrewMembersForGroup(groupKey)
      .filter(staff => normaliseAssignedQualificationIds(staff.preferences?.qualifications || [], staffQualificationCatalogue, false).includes(fixedCrewPicQualification.id))
    : [];
  const activeCallsignUnitCodes = useMemo(() => (
    isFixedCrewModel && activeFixedCrewUnitCodes.length > 0
      ? activeFixedCrewUnitCodes
      : [normaliseFixedCrewUnitCode(activeUnitCode)].filter(Boolean)
  ), [activeFixedCrewUnitCodes, activeUnitCode, isFixedCrewModel]);
  const activeFixedCrewCompositeCodes = useMemo(() => new Set([
    String(activeUnitCode || '').trim().toUpperCase(),
    activeFixedCrewUnitCodes.join('+'),
    activeFixedCrewUnitCodes.join('/'),
  ].filter(Boolean)), [activeFixedCrewUnitCodes, activeUnitCode]);
  const fixedCrewCurrencyProfileOptions = useMemo<CurrencyProfile[]>(() => {
    const profiles = getContinuationEventCurrencyProfiles(sctEvents);
    return profiles
      .filter(profile => String(profile.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
      .filter(profile => {
        const unit = normaliseFixedCrewUnitCode(profile.unitCode);
        const composite = normaliseFixedCrewUnitCode(profile.compositeUnitCode);
        if (unit && activeFixedCrewUnitCodeSet.has(unit)) return true;
        if (composite && activeFixedCrewCompositeCodes.has(composite)) return true;
        return !unit && !composite;
      })
      .sort((a, b) => {
        const unitCompare = normaliseFixedCrewUnitCode(a.unitCode || a.compositeUnitCode)
          .localeCompare(normaliseFixedCrewUnitCode(b.unitCode || b.compositeUnitCode), undefined, { numeric: true });
        if (unitCompare !== 0) return unitCompare;
        return String(a.code || a.name || a.currency).localeCompare(String(b.code || b.name || b.currency), undefined, { numeric: true });
      });
  }, [activeFixedCrewCompositeCodes, activeFixedCrewUnitCodeSet, sctEvents]);
  const unitCallsignEntries = useMemo(() => {
    const seen = new Set<string>();
    return activeCallsignUnitCodes.flatMap(unitCode => getUnitCallsignEntries(unitCallsignSettings, unitCode))
      .filter(entry => {
        const key = `${entry.unitCode}::${entry.callsign.toUpperCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [activeCallsignUnitCodes, unitCallsignSettings]);
  const defaultUnitCallsign = useMemo(
    () => {
      for (const unitCode of activeCallsignUnitCodes) {
        const defaultForUnit = getDefaultUnitCallsign(unitCallsignSettings, unitCode);
        if (defaultForUnit) return defaultForUnit;
      }
      return '';
    },
    [activeCallsignUnitCodes, unitCallsignSettings],
  );
  const normalisePersonNameForAddTile = useCallback((value?: string | null): string => (
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(ACM|AIRMSHL|AVM|AIRCDRE|GPCAPT|WGCDR|SQNLDR|FLTLT|FLGOFF|PLTOFF|OFFCDT|WOFF|FSGT|SGT|CPL|LACW?|ACW?|MIDN|CMDR|LCDR|LEUT|SBLT|ASLT|CDRE|CAPT|COL|LTCOL|MAJ|LT|2LT|WO1|WO2|SSGT|PTE|MR|MRS|MS|MISS|DR)\s+/i, '')
      .replace(/\s+[–-]\s+[A-Z]{2,}\d+$/i, '')
      .toLowerCase()
  ), []);
  const resolveAssignedCallsign = useCallback((name?: string | null): string => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return '';
    const cleanKey = normalisePersonNameForAddTile(cleanName);
    const assigned = personnelData?.get(cleanName)
      || Array.from(personnelData?.entries() || []).find(([personName]) => normalisePersonNameForAddTile(personName) === cleanKey)?.[1];
    if (assigned?.callsign) return String(assigned.callsign || '').trim();
    const instructor = instructorsData.find(staff => normalisePersonNameForAddTile(staff.name) === cleanKey);
    if (instructor) return String(instructor.callsign || instructor.preferences?.callsign || instructor.secondaryCallsign || '').trim();
    const trainee = traineesData.find(traineeRecord => (
      normalisePersonNameForAddTile(traineeRecord.fullName || traineeRecord.name) === cleanKey
      || normalisePersonNameForAddTile(traineeRecord.name) === cleanKey
    ));
    const traineeKey = normalisePersonNameForAddTile(trainee?.fullName || trainee?.name || cleanName);
    const traineeAssigned = personnelData?.get(trainee?.fullName || trainee?.name || cleanName)
      || Array.from(personnelData?.entries() || []).find(([personName]) => normalisePersonNameForAddTile(personName) === traineeKey)?.[1];
    return String(trainee?.traineeCallsign || traineeAssigned?.callsign || '').trim();
  }, [instructorsData, normalisePersonNameForAddTile, personnelData, traineesData]);
  const selectedPicHasIndividualCallsign = useMemo(() => Boolean(resolveAssignedCallsign(picName)), [picName, resolveAssignedCallsign]);

  // ── Tile Layout State (lifted here so it survives modal re-renders) ─────────────
  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft' | 'callsign';
  const LAYOUT_ELEM_KEYS: ElemKey[] = ['startTime','picName','coPilot','duration','event','area','aircraft','callsign'];
  const MODAL_DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 7 },
    picName:   { x: 83, y: 9 },
    coPilot:   { x: 83, y: 36 },
    duration:  { x: 410, y: 1 },
    event:     { x: 486, y: 1 },
    aircraft:  { x: 14, y: 57 },
    area:      { x: 476, y: 58 },
    callsign:  { x: 532, y: 59 },
  };
  const LAYOUT_PREF_KEY = 'flightTileLayout_v8';

  // Helper: validate a positions object has all required keys
  const isValidPositions = (posData: any): posData is Record<ElemKey, { x: number; y: number }> => {
    return posData && typeof posData === 'object' &&
      LAYOUT_ELEM_KEYS.every((k: ElemKey) => posData[k] && typeof posData[k].x === 'number');
  };

  // Helper: read from localStorage fallback
  const readLocalLayout = (): Record<ElemKey, { x: number; y: number }> | null => {
    try {
      const raw = localStorage.getItem(LAYOUT_PREF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.positions && isValidPositions(parsed.positions)) return parsed.positions;
      }
    } catch { /* ignore */ }
    return null;
  };

  // Helper: write to localStorage fallback
  const writeLocalLayout = (pos: Record<ElemKey, { x: number; y: number }>) => {
    try { localStorage.setItem(LAYOUT_PREF_KEY, JSON.stringify({ positions: pos })); } catch { /* ignore */ }
  };

  // Initialise from localStorage immediately (synchronous, no flash)
  const _localInit = readLocalLayout();
  const [tileEditMode,      setTileEditMode]      = useState(false);
  const [tileLayoutSaved,   setTileLayoutSaved]   = useState(_localInit !== null);
  const [tilePositions,     setTilePositions]     = useState<Record<ElemKey, { x: number; y: number }>>(_localInit ?? MODAL_DEFAULT_POSITIONS);
  const [tileSavedPositions,setTileSavedPositions]= useState<Record<ElemKey, { x: number; y: number }>>(_localInit ?? MODAL_DEFAULT_POSITIONS);

  // Load from DB when userId is available — DB is authoritative over localStorage
  useEffect(() => {
    if (!userId) {
      console.log('[TileLayout] No userId available — using localStorage only');
      return;
    }
    console.log('[TileLayout] Loading layout from DB for userId:', userId);
    loadUserPreferences(userId).then(prefs => {
      const stored = prefs[LAYOUT_PREF_KEY];
      if (stored && typeof stored === 'object' && 'positions' in stored) {
        const posData = stored.positions as Record<ElemKey, { x: number; y: number }>;
        if (isValidPositions(posData)) {
          console.log('[TileLayout] Restored layout from DB');
          setTilePositions(posData);
          setTileSavedPositions(posData);
          setTileLayoutSaved(true);
          writeLocalLayout(posData); // keep localStorage in sync
        }
      } else {
        console.log('[TileLayout] No layout found in DB');
      }
    }).catch(err => console.warn('[TileLayout] DB load failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Handlers passed down to FlightTile
  const handleEnterEditMode = () => setTileEditMode(true);

  const handleExitEditMode = (save: boolean) => {
    if (save) {
      setTileSavedPositions({ ...tilePositions });
      setTileLayoutSaved(true);
      // Write to localStorage immediately (synchronous — no flash on next open)
      writeLocalLayout(tilePositions);
      // Write to DB (async — authoritative store)
      if (userId) {
        console.log('[TileLayout] Saving layout to DB for userId:', userId);
        saveUserPreference(userId, LAYOUT_PREF_KEY, { positions: tilePositions })
          .then(ok => console.log('[TileLayout] DB save result:', ok))
          .catch(err => console.warn('[TileLayout] DB save failed:', err));
      } else {
        console.warn('[TileLayout] No userId — layout saved to localStorage only');
      }
    } else {
      setTilePositions({ ...tileSavedPositions });
    }
    setTileEditMode(false);
  };

  const handleDragPosition = (key: string, pos: { x: number; y: number }) => {
    setTilePositions(prev => ({ ...prev, [key]: pos }));
  };

  // ── Determine the current location full name from school ──────────────────
  const locationFullName = currentLocationName || school;

  const filteredFormationCallsigns = useMemo(() => {
    return (formationCallsigns || []).filter(fc => fc.location === locationFullName);
  }, [formationCallsigns, locationFullName]);

  const formationTypes = useMemo(() => {
    return filteredFormationCallsigns.map(cs => cs.code);
  }, [filteredFormationCallsigns]);

  // ── Op Areas for this location ────────────────────────────────────────────
  const opAreas = useMemo(() => {
    const areas = locationOpAreas[locationFullName];
    if (areas && areas.length > 0) return areas;
    return [];
  }, [locationOpAreas, locationFullName]);

  // Set default area from opAreas
  useEffect(() => {
    setArea(opAreas[0] || '-');
  }, [opAreas]);

  useEffect(() => {
    setOrigin(school);
    setDestination(school);
  }, [school]);

  useEffect(() => {
    if (!formationType && formationTypes.length > 0) setFormationType(formationTypes[0]);
  }, [formationType, formationTypes]);

  useEffect(() => {
    const additionalCrewCount = isSctFormationCode(flightNumber) ? Math.max(0, aircraftCount - 1) : 0;
    setFormationCrew(prev => Array.from({ length: additionalCrewCount }, (_, index) => (
      {
        ...(prev[index] || { flightType: 'Solo', picName: '', studentName: '', callsign: `${formationType || formationTypes[0] || ''}${index + 2}` }),
        flightType: isSingleSeatAircraft ? 'Solo' : (prev[index]?.flightType || 'Solo'),
        studentName: isSingleSeatAircraft ? '' : (prev[index]?.studentName || ''),
      }
    )));
  }, [aircraftCount, flightNumber, formationType, formationTypes, isSctFormationCode, isSingleSeatAircraft]);

  const areaOptions = useMemo(() => opAreas.map(a => ({ value: a, label: a })), [opAreas]);

  // ── Aircraft options ──────────────────────────────────────────────────────
  const aircraftOptions = useMemo(() =>
    [{ value: '', label: 'Skip aircraft number' }, ...Array.from({ length: 49 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return { value: n, label: n };
    })], []);

  // ── Time options (06:00–23:45, 15-min intervals) ──────────────────────────
  const timeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let h = 6; h <= 23; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = h + m / 60;
        opts.push({ value: String(val), label: formatTime(val) });
      }
    }
    return opts;
  }, []);

  // ── Duration options (0.3–4.0, 0.1 steps) ────────────────────────────────
  const durationOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let d = 0.3; d <= 4.01; d = Math.round((d + 0.1) * 10) / 10) {
      opts.push({ value: String(d), label: d.toFixed(1) });
    }
    return opts;
  }, []);

  const callsignNumberOptions = useMemo(() => Array.from({ length: 101 }, (_, value) => ({
    value,
    label: formatUnitCallsignNumber(value),
  })), []);

  // ── All units ─────────────────────────────────────────────────────────────
  const allUnits = useMemo(() => {
    const s = new Set<string>();
    instructorsData.forEach(i => s.add(i.unit || 'Unassigned'));
    traineesData.forEach(t => s.add(t.unit || 'Unassigned'));
    return Array.from(s).sort();
  }, [instructorsData, traineesData]);

  // ── Layer 2: STAFF or course list for a unit ──────────────────────────────
  const getLayer2 = (unit: string): string[] => {
    const opts: string[] = [];
    if (instructorsData.some(i => (i.unit || 'Unassigned') === unit)) opts.push('STAFF');
    const courses = new Set<string>();
    traineesData.forEach(t => { if ((t.unit || 'Unassigned') === unit && t.course) courses.add(t.course); });
    opts.push(...Array.from(courses).sort());
    return opts;
  };

  // ── Layer 3: Names for unit+selection ────────────────────────────────────
  // Staff and trainees use the configured organisation sort order.
  const getNames = (unit: string, selection: string): { name: string; label: string; color?: string }[] => {
    if (selection === 'STAFF') {
      return instructorsData
        .filter(i => (i.unit || 'Unassigned') === unit)
        .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'))
        .map(i => ({
          name: i.name,
          label: `${i.rank ? i.rank + ' ' : ''}${i.name}`,
          color: '#fff',
        }));
    }
    // Trainee course — sort alphabetically, colour by course
    return traineesData
      .filter(t => (t.unit || 'Unassigned') === unit && t.course === selection)
      .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'trainee'))
      .map(t => {
        // courseColors stores Tailwind class like 'bg-sky-500'; extract a CSS colour hint
        const twClass = courseColors[t.course] || '';
        // Map common Tailwind colours to readable hex for dropdown text
        const colourMap: Record<string, string> = {
          'bg-sky-500': '#38bdf8', 'bg-sky-400': '#38bdf8',
          'bg-violet-500': '#8b5cf6', 'bg-purple-500': '#a855f7',
          'bg-emerald-500': '#10b981', 'bg-green-500': '#22c55e',
          'bg-rose-500': '#f43f5e', 'bg-red-500': '#ef4444',
          'bg-amber-500': '#f59e0b', 'bg-yellow-500': '#eab308',
          'bg-orange-500': '#f97316', 'bg-teal-500': '#14b8a6',
          'bg-cyan-500': '#06b6d4', 'bg-pink-500': '#ec4899',
          'bg-indigo-500': '#6366f1', 'bg-blue-500': '#3b82f6',
          'bg-lime-500': '#84cc16', 'bg-fuchsia-500': '#d946ef',
        };
        const textColor = colourMap[twClass] || '#fff';
        return {
          name: t.fullName || t.name,
          label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}${t.course ? ' (' + t.course + ')' : ''}`,
          color: textColor,
        };
      });
  };

  const shouldRestrictContinuationPicToPilots = isAirCombatModel && eventCategory === 'sct';
  const isPilotStaff = (staff: Instructor): boolean => {
    const role = String(staff.role || '').trim().toLowerCase();
    const category = String((staff as any).category || '').trim().toLowerCase();
    return role === 'pilot' || category === 'pilot';
  };
  const getPicNames = (unit: string, selection: string): { name: string; label: string; color?: string }[] => {
    if (!shouldRestrictContinuationPicToPilots || selection !== 'STAFF') return getNames(unit, selection);
    return instructorsData
      .filter(i => (i.unit || 'Unassigned') === unit)
      .filter(isPilotStaff)
      .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'))
      .map(i => ({
        name: i.name,
        label: `${i.rank ? i.rank + ' ' : ''}${i.name}`,
        color: '#fff',
      }));
  };

  // ── Tile colour from trainee course ──────────────────────────────────────
  // ── Helper: get display label for a person (name + course if trainee) ────────
  const getDisplayLabel = (name: string): string => {
    if (!name) return '';
    const trainee = traineesData.find(t => (t.fullName || t.name) === name);
    if (trainee && trainee.course) return `${name} – ${trainee.course}`;
    return name;
  };

  const tileColor = useMemo(() => {
    // SCT events are always grey
    if (eventCategory === 'sct') return 'bg-gray-500';
    // Staff CAT / TWR DI - no trainee involved, use grey
    if (eventCategory === 'staff_cat' || eventCategory === 'twr_di') return 'bg-gray-500';
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-gray-500';
    const t = traineesData.find(t => (t.fullName || t.name) === name);
    // If the person found is not a trainee (i.e. instructor in solo), use grey
    if (!t) return 'bg-gray-500';
    return (t.course && courseColors[t.course]) || 'bg-gray-500';
  }, [picName, studentName, flightType, traineesData, courseColors, eventCategory]);

  // ── Syllabus by course (for event dropdown) ───────────────────────────────
  const syllabusByCourse = useMemo(() => {
    const grouped = new Map<string, SyllabusItemDetail[]>();
    const flightItems = syllabusDetails.filter(d =>
      d.type === 'Flight' || d.type === 'flight' ||
      (!d.type && !d.id?.includes('FTD') && !d.id?.includes('CPT'))
    );
    flightItems.forEach(item => {
      (item.courses || []).forEach(course => {
        if (!grouped.has(course)) grouped.set(course, []);
        grouped.get(course)!.push(item);
      });
      if (!item.courses || item.courses.length === 0) {
        if (!grouped.has('Other')) grouped.set('Other', []);
        grouped.get('Other')!.push(item);
      }
    });
    // Natural sort within each course
    const natSort = (a: string, b: string) => {
      const parse = (s: string) => { const m = s.match(/^([A-Za-z]*)(\d*)$/); return { l: (m?.[1] || s).toUpperCase(), n: m?.[2] ? parseInt(m[2]) : 0 }; };
      const ap = parse(a), bp = parse(b);
      const lc = ap.l.localeCompare(bp.l);
      return lc !== 0 ? lc : ap.n - bp.n;
    };
    grouped.forEach((items, c) => grouped.set(c, items.sort((a, b) => natSort(a.code || a.id || '', b.code || b.id || ''))));
    return grouped;
  }, [syllabusDetails]);

  const fixedCrewEventOptions = useMemo(() => {
    const isCrewedFixedCrewType = (item: SyllabusItemDetail) => {
      const type = String(item.type || '').trim().toLowerCase();
      return type === 'flight' || type === 'ftd';
    };
    const items = syllabusDetails.filter(item => {
      if (!isCrewedFixedCrewType(item)) return false;
      const isPackage = String(item.lmpType || '').trim().toLowerCase() === 'staff cat';
      if (eventCategory === 'lmp_currency' && !isPackage) return false;
      if (eventCategory !== 'lmp_currency' && isPackage) return false;
      const itemUnit = normaliseFixedCrewUnitCode(item.unit);
      return !itemUnit || activeFixedCrewUnitCodeSet.size === 0 || activeFixedCrewUnitCodeSet.has(itemUnit);
    });
    return items.sort((a, b) => {
      const unitCompare = normaliseFixedCrewUnitCode(a.unit).localeCompare(normaliseFixedCrewUnitCode(b.unit), undefined, { numeric: true });
      if (unitCompare !== 0) return unitCompare;
      const phaseCompare = String(a.phase || '').localeCompare(String(b.phase || ''), undefined, { numeric: true });
      if (phaseCompare !== 0) return phaseCompare;
      return String(a.code || a.id || '').localeCompare(String(b.code || b.id || ''), undefined, { numeric: true });
    });
  }, [activeFixedCrewUnitCodeSet, eventCategory, syllabusDetails]);

  const fixedCrewEventOptionGroups = useMemo(() => {
    const getCoursePackageLabel = (item: SyllabusItemDetail) => {
      const unit = normaliseFixedCrewUnitCode(item.unit);
      const courseLabel = Array.isArray(item.courses) && item.courses.length > 0
        ? item.courses
          .filter(Boolean)
          .map(course => stripLeadingUnitLabel(course, unit))
          .join(', ')
        : '';
      return courseLabel || stripLeadingUnitLabel(item.phase, unit) || item.lmpType || 'Course/Package';
    };
    const groups = new Map<string, SyllabusItemDetail[]>();
    fixedCrewEventOptions.forEach(item => {
      const unitLabel = normaliseFixedCrewUnitCode(item.unit) || (activeFixedCrewUnitCodes.length === 1 ? activeFixedCrewUnitCodes[0] : 'Unit');
      const groupLabel = `${unitLabel} - ${getCoursePackageLabel(item)}`;
      groups.set(groupLabel, [...(groups.get(groupLabel) || []), item]);
    });
    return Array.from(groups.entries()).map(([label, options]) => ({ label, options }));
  }, [activeFixedCrewUnitCodes, fixedCrewEventOptions]);

  const fixedCrewCurrencyProfileGroups = useMemo(() => {
    const groups = new Map<string, CurrencyProfile[]>();
    fixedCrewCurrencyProfileOptions.forEach(profile => {
      const unit = normaliseFixedCrewUnitCode(profile.unitCode || profile.compositeUnitCode)
        || (activeFixedCrewUnitCodes.length === 1 ? activeFixedCrewUnitCodes[0] : 'Unit');
      groups.set(unit, [...(groups.get(unit) || []), profile]);
    });
    return Array.from(groups.entries()).map(([label, options]) => ({ label, options }));
  }, [activeFixedCrewUnitCodes, fixedCrewCurrencyProfileOptions]);

  const getFixedCrewEventOptionKey = (item: SyllabusItemDetail) => (
    `${normaliseFixedCrewUnitCode(item.unit)}::${item.id || ''}::${item.code || ''}`
  );

  const getFixedCrewCurrencyProfileOptionKey = (profile: CurrencyProfile) => (
    [
      'currency',
      normaliseFixedCrewUnitCode(profile.unitCode || profile.compositeUnitCode),
      String(profile.compositeProfileId || '').trim(),
      String(profile.aircraftTypeCode || '').trim().toUpperCase(),
      String(profile.id || '').trim(),
      String(profile.code || '').trim().toUpperCase(),
      String(profile.name || '').trim(),
      String(profile.currency || '').trim(),
    ].join('::')
  );
  const findContinuationCurrencyProfile = (value: string): CurrencyProfile | undefined => {
    const normalisedValue = String(value || '').trim().toUpperCase();
    if (!normalisedValue) return undefined;
    return fixedCrewCurrencyProfileOptions.find(profile => (
      getFixedCrewCurrencyProfileOptionKey(profile) === value
      || String(profile.id || '').trim().toUpperCase() === normalisedValue
      || String(profile.code || '').trim().toUpperCase() === normalisedValue
      || String(profile.name || '').trim().toUpperCase() === normalisedValue
      || String(profile.currency || '').trim().toUpperCase() === normalisedValue
    ));
  };

  const courseOptions = useMemo(() => {
    const courses = Array.from(syllabusByCourse.keys()).sort();
    return getContinuationEventNames(sctEvents).length > 0 ? ['SCT', ...courses.filter(c => c !== 'SCT')] : courses.filter(c => c !== 'SCT');
  }, [sctEvents, syllabusByCourse]);

  const getEventsForCourse = (course: string): SyllabusItemDetail[] =>
    course === 'SCT' ? [] : (syllabusByCourse.get(course) || []);
  const getCourseDisplayLabel = useCallback((course: string) => (
    course === 'SCT' ? sctShortLabel : course
  ), [sctShortLabel]);

  // ── Next LMP event for the selected trainee ───────────────────────────────
  const nextLMPEvent = useMemo(() => {
    if (eventCategory !== 'lmp_event') return null;
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !traineeLMPs) return null;
    const lmp = traineeLMPs.get(name);
    if (!lmp?.length) return null;
    const done = new Set((scores?.get(name) || []).map(s => s.event));
    const isFlight = (item: SyllabusItemDetail) =>
      item.type === 'Flight' || item.type === 'flight' ||
      (!item.type && !item.id?.includes('FTD') && !item.id?.includes('CPT') && !item.id?.includes('GS'));
    for (const item of lmp) {
      if (!isFlight(item) || item.isRemedial) continue;
      if (done.has(item.id) || done.has(item.code)) continue;
      if (item.prerequisites.every(p => done.has(p))) return item;
    }
    return lmp.find(item => isFlight(item) && !done.has(item.id) && !done.has(item.code)) || null;
  }, [picName, studentName, flightType, traineeLMPs, scores, eventCategory]);

  // ── Auto-fill callsign from PIC profile + formation callsigns for same unit ──────────
  // Legacy numeric callsigns no longer infer unit prefixes. Use configured callsign strings instead.
  const buildCallsignFromNumber = (_num: number | undefined | null): string => {
    return '';
  };

  useEffect(() => {
    if (isFixedCrewModel) return;
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }

    // Determine PIC's unit (for filtering formation callsigns)
    let picUnit: string | null = null;

    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      picUnit = inst.unit || null;
      // Build callsign: prefer explicit callsign string, fall back to callsignNumber + school prefix
      const primary   = resolveAssignedCallsign(picName) || inst.callsign || buildCallsignFromNumber((inst as any).callsignNumber) || '';
      const secondary = inst.secondaryCallsign || '';
      const personal  = [primary, secondary].filter(Boolean);
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const unitOptions = selectedPicHasIndividualCallsign ? [] : unitCallsignEntries.map(entry => buildUnitEventCallsign(entry.callsign, unitCallsignNumber));
      const unitDefaultCallsign = buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, unitCallsignNumber);
      const allOpts   = [...new Set([...personal, ...(selectedPicHasIndividualCallsign ? formation : []), ...unitOptions])];
      setCallsignOptions(allOpts);
      setCallsign(primary || unitDefaultCallsign || (allOpts[0] || ''));
      return;
    }

    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      picUnit = (trainee as any).unit || null;
      const cs = resolveAssignedCallsign(picName) || trainee.traineeCallsign || buildCallsignFromNumber((trainee as any).callsignNumber) || '';
      const personal = cs ? [cs] : [];
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const unitOptions = selectedPicHasIndividualCallsign ? [] : unitCallsignEntries.map(entry => buildUnitEventCallsign(entry.callsign, unitCallsignNumber));
      const unitDefaultCallsign = buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, unitCallsignNumber);
      const allOpts   = [...new Set([...personal, ...(selectedPicHasIndividualCallsign ? formation : []), ...unitOptions])];
      setCallsignOptions(allOpts);
      setCallsign(cs || unitDefaultCallsign || (allOpts[0] || ''));
      return;
    }

    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData, formationCallsigns, isFixedCrewModel, defaultUnitCallsign, selectedPicHasIndividualCallsign, unitCallsignBase, unitCallsignEntries, unitCallsignNumber, resolveAssignedCallsign]);

  // ── Auto-set duration from selected LMP event ─────────────────────────────
  // (handled in onFlightNumberChange handler — see handleFlightNumberChange below)

  // ── Reset on category change ──────────────────────────────────────────────
  useEffect(() => {
    if (suppressNextCategoryResetRef.current) {
      suppressNextCategoryResetRef.current = false;
      return;
    }
    setPicName(''); setStudentName(''); setFlightNumber('');
    setStartTime(8.0); setDuration(1.2);
    setArea(opAreas[0] || '-'); setAircraftNumber('001');
    setOrigin(school); setDestination(school);
    setAircraftCount(1); setFormationCrew([]);
    setCallsign(''); setCallsignOptions([]); setNotes('');
    setUnitCallsignBase(defaultUnitCallsign); setUnitCallsignNumber(0);
    setFixedCrewEventKey(''); setFixedCrewGroup(''); setFixedCrewPic(''); setFixedCrewFormationAssignments([]); setFixedCrewManifestStatus('pending'); setFixedCrewManifestNotes('');
    setErrors([]);
    setGuidedStep('startTime');
  }, [eventCategory]);

  useEffect(() => {
    if (!defaultUnitCallsign) return;
    setUnitCallsignBase(current => current || defaultUnitCallsign);
  }, [defaultUnitCallsign]);

  useEffect(() => {
    if (isFixedCrewModel) {
      setFlightType('Dual');
      return;
    }
    if (isSingleSeatAircraft || eventCategory === 'sct' || eventCategory === 'twr_di') setFlightType('Solo');
    else setFlightType('Dual');
  }, [eventCategory, isSingleSeatAircraft, isFixedCrewModel]);

  useEffect(() => {
    if (!isFixedCrewModel) return;
    const extraAircraftCount = Math.max(0, Math.floor(Number(aircraftCount) || 1) - 1);
    setFixedCrewFormationAssignments(prev => {
      if (prev.length === extraAircraftCount) return prev;
      return Array.from({ length: extraAircraftCount }, (_, index) => prev[index] || { crewGroup: '', pic: '' });
    });
  }, [aircraftCount, isFixedCrewModel]);

  useEffect(() => {
    if (!isFixedCrewModel) return;
    setStudentName(fixedCrewGroup ? formatFixedCrewDisplayGroup(fixedCrewGroup) : '');
  }, [fixedCrewGroup, isFixedCrewModel]);

  useEffect(() => {
    if (!isFixedCrewModel) return;
    setPicName(fixedCrewPic);
  }, [fixedCrewPic, isFixedCrewModel]);

  useEffect(() => {
    if (selectedPicHasIndividualCallsign && !isFixedCrewModel) return;
    if (!defaultUnitCallsign) {
      setCallsignOptions([]);
      return;
    }
    const base = unitCallsignBase || defaultUnitCallsign;
    const values = unitCallsignEntries.map(entry => buildUnitEventCallsign(entry.callsign, unitCallsignNumber));
    setCallsignOptions(values);
    setCallsign(buildUnitEventCallsign(base, unitCallsignNumber));
  }, [defaultUnitCallsign, isFixedCrewModel, selectedPicHasIndividualCallsign, unitCallsignBase, unitCallsignEntries, unitCallsignNumber]);

  useEffect(() => {
    if (!isSingleSeatAircraft) return;
    setFlightType('Solo');
    setStudentName('');
    setFormationCrew(prev => prev.map(crewMember => ({ ...crewMember, flightType: 'Solo', studentName: '' })));
  }, [isSingleSeatAircraft]);

  useEffect(() => {
    if (eventCategory === 'lmp_currency') setFlightNumber('CURR');
  }, [eventCategory]);

  useEffect(() => {
    if (isSctFormationCode(flightNumber)) {
      setAircraftCount(prev => Math.max(prev, 2));
      setFlightType('Solo');
    } else if (!isFixedCrewModel) {
      setAircraftCount(1);
      setFormationCrew([]);
    }
  }, [flightNumber, isFixedCrewModel, isSctFormationCode]);

  // ── Set sortie type from LMP item when event chosen ───────────────────────
  useEffect(() => {
    if (isPersonDropdownKey(activeAddFlightDropdownKey)) return;
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(name);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (!isSingleSeatAircraft && item?.sortieType) setFlightType(item.sortieType as 'Dual'|'Solo');
  }, [picName, studentName, flightNumber, traineeLMPs, isSingleSeatAircraft]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resolveLmpDurationForEvent = (code: string, fallback?: number): number | undefined => {
    if (!code) return undefined;

    const selectedName = flightType === 'Solo' ? picName : studentName;
    const matchesCode = (item: SyllabusItemDetail) => item.id === code || item.code === code;
    const selectedLmpItem = selectedName ? traineeLMPs?.get(selectedName)?.find(matchesCode) : undefined;
    const masterSyllabusItem = syllabusDetails.find(matchesCode);
    const durationSource = selectedLmpItem || masterSyllabusItem;

    const resolved = [durationSource?.duration, durationSource?.flightOrSimHours, fallback]
      .map(value => Number(value))
      .find(value => Number.isFinite(value) && value > 0);

    return resolved;
  };

  const handleFlightNumberChange = (code: string, durationHrs?: number) => {
    const selectedProfile = findContinuationCurrencyProfile(code);
    if (selectedProfile && eventCategory !== 'sct') {
      suppressNextCategoryResetRef.current = true;
      setEventCategory('sct');
    }
    const selectedSyllabusItem = syllabusDetails.find(item => item.id === code || item.code === code);
    const isPackageEvent = String(selectedSyllabusItem?.lmpType || '').trim().toLowerCase() === 'staff cat';
    if (!selectedProfile && isPackageEvent && eventCategory !== 'lmp_currency') {
      suppressNextCategoryResetRef.current = true;
      setEventCategory('lmp_currency');
    }
    setFlightNumber(selectedProfile?.code || selectedProfile?.name || code);
    if (selectedProfile) {
      setFlightType(selectedProfile.flightType || 'Dual');
      if (selectedProfile.dayNight === 'Night') {
        setStartTime(nightContinuationDefaultStartTime);
      }
      setAircraftCount(Math.max(1, Math.floor(Number(selectedProfile.aircraftCount) || 1)));
      if (selectedProfile.config && selectedProfile.config !== 'ANY') {
        setAircraftConfigId(selectedProfile.config);
      }
    }
    const lmpDuration = resolveLmpDurationForEvent(code, durationHrs);
    if (lmpDuration) setDuration(lmpDuration);
    setGuidedStep('area');
  };

  const handleFixedCrewEventChange = (eventKey: string) => {
    if (eventCategory === 'sct') {
      const selectedProfile = findContinuationCurrencyProfile(eventKey);
      setFixedCrewEventKey(eventKey);
      setFlightNumber(selectedProfile?.code || selectedProfile?.name || selectedProfile?.currency || '');
      setDuration(2);
      setFlightType(selectedProfile?.flightType || 'Dual');
      if (selectedProfile?.dayNight === 'Night') {
        setStartTime(nightContinuationDefaultStartTime);
      }
      setAircraftCount(Math.max(1, Math.floor(Number(selectedProfile?.aircraftCount) || 1)));
      if (selectedProfile?.config && selectedProfile.config !== 'ANY') {
        setAircraftConfigId(selectedProfile.config);
      }
      setGuidedStep('area');
      return;
    }
    const selectedItem = fixedCrewEventOptions.find(item => getFixedCrewEventOptionKey(item) === eventKey);
    setFixedCrewEventKey(eventKey);
    setFlightNumber(selectedItem?.code || selectedItem?.id || '');
    setAircraftCount(1);
    if (selectedItem) {
      const resolvedDuration = Number(selectedItem.duration || selectedItem.flightOrSimHours);
      if (Number.isFinite(resolvedDuration) && resolvedDuration > 0) setDuration(resolvedDuration);
      if (selectedItem.type === 'FTD' || selectedItem.type === 'ftd') {
        setArea('-');
      } else if (!area || area === '-') {
        setArea(opAreas[0] || '-');
      }
    }
    setGuidedStep('area');
  };

  const handlePicNameChange = (name: string) => {
    setPicName(name);
    setGuidedStep('event');
  };

  const selectedFixedCrewEvent = fixedCrewEventOptions.find(item => getFixedCrewEventOptionKey(item) === fixedCrewEventKey)
    || fixedCrewEventOptions.find(item => (
      item.code === flightNumber || item.id === flightNumber
    ));
  const selectedFixedCrewCurrencyProfile = fixedCrewCurrencyProfileOptions.find(profile => (
    getFixedCrewCurrencyProfileOptionKey(profile) === fixedCrewEventKey
    || profile.code === flightNumber
    || profile.name === flightNumber
    || profile.currency === flightNumber
  ));
  const normaliseAvailabilityOffsetHours = (value?: string | number | null): number => {
    const numeric = timeFieldToHours(value, 0) || 0;
    return numeric > 24 ? numeric / 60 : numeric;
  };
  const fixedCrewAvailabilityWindow = useMemo<FixedCrewAvailabilityWindow>(() => {
    const start = Number(startTime) || 0;
    const durationHours = Math.max(0, Number(duration) || 0);
    const preFlight = normaliseAvailabilityOffsetHours(selectedFixedCrewEvent?.preFlightTime);
    const postFlight = normaliseAvailabilityOffsetHours(selectedFixedCrewEvent?.postFlightTime);
    const resourceKind = String(selectedFixedCrewEvent?.type || eventCategory || '').toLowerCase().includes('ftd')
      || String(selectedFixedCrewEvent?.type || eventCategory || '').toLowerCase().includes('cpt')
      || eventCategory === 'lmp_currency'
        ? 'sim'
        : 'flight';
    return {
      date,
      start: Math.max(0, start - preFlight),
      end: Math.min(24, start + durationHours + postFlight),
      resourceKind,
    };
  }, [date, duration, eventCategory, selectedFixedCrewEvent, startTime]);
  const formatUnavailableStaffLabel = (staff: Instructor, fallback?: string): string => {
    const label = fallback || [staff.rank, staff.name].filter(Boolean).join(' ');
    const status = getStaffUnavailabilityStatus(staff, fixedCrewAvailabilityWindow);
    return appendUnavailableLabel(label, status.reason);
  };
  const formatUnavailableCrewLabel = (crewGroup: string): string => {
    const parsed = parseFixedCrewGroupKey(crewGroup);
    const label = `CREW ${parsed.crew}`;
    return appendUnavailableLabel(label, summariseCrewUnavailability(getFixedCrewMembersForGroup(crewGroup), fixedCrewAvailabilityWindow));
  };
  const selectedFixedCrewUnavailableSummary = useMemo(
    () => summariseCrewUnavailability(fixedCrewMembers, fixedCrewAvailabilityWindow),
    [fixedCrewAvailabilityWindow, fixedCrewMembers],
  );

  useEffect(() => {
    if (!initialEvent || !isFixedCrewModel) return;

    const initialCategory = (initialEvent.eventCategory === 'lmp_currency'
      || initialEvent.eventCategory === 'sct'
      || initialEvent.eventCategory === 'staff_cat'
      || initialEvent.eventCategory === 'twr_di'
      || initialEvent.eventCategory === 'lmp_event')
      ? initialEvent.eventCategory
      : 'lmp_event';

    suppressNextCategoryResetRef.current = initialCategory !== eventCategory;
    setIsDeploy(Boolean(initialEvent.type === 'deployment' || initialEvent.isDeploy));
    setEventCategory(initialCategory as any);
    setFlightNumber(initialEvent.flightNumber || '');
    setStartTime(Number(initialEvent.startTime) || 8);
    setDuration(Number(initialEvent.duration) || (initialCategory === 'sct' ? 2 : 4));
    setArea(initialEvent.area || (opAreas[0] || '-'));
    const parsedAircraftNumber = parseAircraftNumber(initialEvent.aircraftNumber || '001', aircraftNumberSettings);
    setAircraftNumber(parsedAircraftNumber.number || '001');
    setAircraftNumberPrefix(parsedAircraftNumber.prefix || aircraftNumberSettings.defaultPrefix);
    setAircraftConfigId(initialEvent.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id);
    setLocationType(initialEvent.locationType || 'Local');
    setOrigin(initialEvent.origin || school);
    setDestination(initialEvent.destination || school);
    setAircraftCount(Math.max(1, Math.floor(Number(initialEvent.aircraftCount || initialEvent.formationSize) || 1)));
    setCallsign(initialEvent.callsign || '');
    setNotes(initialEvent.notes || '');
    setFixedCrewGroup(resolveFixedCrewGroupValue(initialEvent.fixedCrewGroup || initialEvent.crew || initialEvent.crewGroup || initialEvent.studentName || ''));
    setFixedCrewPic(initialEvent.fixedCrewPic || initialEvent.pilot || initialEvent.instructor || '');
    setFixedCrewManifestStatus(initialEvent.fixedCrewManifestStatus || 'pending');
    setFixedCrewManifestNotes(initialEvent.fixedCrewManifestNotes || '');
    setDeploymentStartDate(initialEvent.deploymentStartDate || initialEvent.date || date);
    setDeploymentStartTime(initialEvent.deploymentStartTime || formatTime(Number(initialEvent.startTime) || 8));
    setDeploymentEndDate(initialEvent.deploymentEndDate || initialEvent.date || date);
    setDeploymentEndTime(initialEvent.deploymentEndTime || formatTime((Number(initialEvent.startTime) || 8) + (Number(initialEvent.duration) || 1)));
    setDeploymentAircraftCount(Math.max(1, Math.floor(Number(initialEvent.deploymentAircraftCount) || 1)));

    if (initialEvent.eventCategory === 'sct') {
      const profile = fixedCrewCurrencyProfileOptions.find(candidate => (
        candidate.code === initialEvent.flightNumber
        || candidate.code === initialEvent.eventCode
        || candidate.name === initialEvent.flightNumber
        || candidate.currency === initialEvent.currency
      ));
      setFixedCrewEventKey(profile ? getFixedCrewCurrencyProfileOptionKey(profile) : '');
    } else {
      const item = syllabusDetails.find(candidate => (
        candidate.code === initialEvent.flightNumber
        || candidate.id === initialEvent.flightNumber
        || candidate.code === initialEvent.eventCode
        || candidate.id === initialEvent.eventCode
      ));
      setFixedCrewEventKey(item ? getFixedCrewEventOptionKey(item) : '');
    }

    const formationSiblings = existingFormationEvents
      .filter(candidate => candidate.id !== initialEvent.id)
      .map(candidate => ({
        crewGroup: candidate.fixedCrewGroup || '',
        pic: candidate.fixedCrewPic || candidate.pilot || candidate.instructor || '',
      }));
    setFixedCrewFormationAssignments(formationSiblings);
  // Initial edit hydration should run once per selected event; changing dropdown data should not reset user edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEvent?.id, isFixedCrewModel]);

  useEffect(() => {
    if (!initialEvent || !isFixedCrewModel || fixedCrewGroup || fixedCrewGroups.length === 0) return;
    const resolvedGroup = resolveFixedCrewGroupValue(initialEvent.fixedCrewGroup || initialEvent.crew || initialEvent.crewGroup || initialEvent.studentName || '');
    if (resolvedGroup) setFixedCrewGroup(resolvedGroup);
  // Runs only to hydrate a blank crew field after async crew options arrive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedCrewGroups.length, fixedCrewGroup, initialEvent?.id, isFixedCrewModel]);

  const updateFormationCrew = (index: number, updates: Partial<FormationCrewDraft>) => {
    setFormationCrew(prev => prev.map((crewMember, crewIndex) => (
      crewIndex === index ? { ...crewMember, ...updates } : crewMember
    )));
  };

  const updateFixedCrewFormationAssignment = (index: number, updates: Partial<FixedCrewFormationAssignment>) => {
    setFixedCrewFormationAssignments(prev => prev.map((assignment, assignmentIndex) => (
      assignmentIndex === index ? { ...assignment, ...updates } : assignment
    )));
  };

  const handleSave = () => {
    const errs: string[] = [];
    if (isDeploy) {
      if (!deploymentStartDate || !deploymentStartTime || !deploymentEndDate || !deploymentEndTime)
        errs.push('Deployment start/end date and time are required.');
    } else if (isFixedCrewModel) {
      if (!flightNumber) errs.push(`${fixedCrewEventFieldLabel} is required.`);
      if (!fixedCrewGroup) errs.push('Crew is required.');
      if (!fixedCrewPic) errs.push('PIC is required.');
      if (Math.max(1, Math.floor(Number(aircraftCount) || 1)) > 1) {
        fixedCrewFormationAssignments.forEach((assignment, index) => {
          if (!assignment.crewGroup) errs.push(`Aircraft ${index + 2} crew is required.`);
          if (!assignment.pic) errs.push(`Aircraft ${index + 2} PIC is required.`);
        });
      }
      if (locationType === 'Land Away' && (!origin || !destination)) errs.push('Origin and destination are required for land away flights.');
      if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    } else {
      if (!flightNumber && eventCategory !== 'twr_di') errs.push('Syllabus event is required.');
      if (flightType === 'Dual' && !picName) errs.push('Instructor / PIC is required for Dual flights.');
      if (flightType === 'Dual' && !studentName) errs.push('Co-Pilot / Student is required for Dual flights.');
      if (flightType === 'Solo' && !picName) errs.push('Pilot is required for Solo flights.');
      if (locationType === 'Land Away' && (!origin || !destination)) errs.push('Origin and destination are required for land away flights.');
      if (isSctFormationCode(flightNumber)) {
        formationCrew.forEach((crewMember, index) => {
          if (!crewMember.picName) errs.push(`Aircraft ${index + 2} pilot is required.`);
          if (crewMember.flightType === 'Dual' && !crewMember.studentName) errs.push(`Aircraft ${index + 2} crew is required.`);
        });
      }
      if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    }
    if (errs.length > 0) { setErrors(errs); return; }

    const eventsToSave: ScheduleEvent[] = [];

    if (!isDeploy) {
      if (isFixedCrewModel) {
        const eventType = eventCategory === 'sct'
          ? 'flight'
          : String(selectedFixedCrewEvent?.type || '').trim().toLowerCase() === 'ftd'
            ? 'ftd'
            : 'flight';
        const selectedCurrencyConfig = selectedFixedCrewCurrencyProfile?.config && selectedFixedCrewCurrencyProfile.config !== 'ANY'
          ? selectedFixedCrewCurrencyProfile.config
          : aircraftConfigId;
        const selectedCurrencyAcceptableConfigs = Array.isArray(selectedFixedCrewCurrencyProfile?.acceptableAircraftConfigs) && selectedFixedCrewCurrencyProfile.acceptableAircraftConfigs.length > 0
          ? selectedFixedCrewCurrencyProfile.acceptableAircraftConfigs
          : [selectedCurrencyConfig];
        const savedAircraftCount = Math.max(1, Math.floor(Number(aircraftCount) || 1));
        const formationId = savedAircraftCount > 1 ? `fixed-crew-formation-${uuidv4()}` : undefined;
        Array.from({ length: savedAircraftCount }, (_, index) => index).forEach((index) => {
          const assignment = index === 0
            ? { crewGroup: fixedCrewGroup, pic: fixedCrewPic }
            : fixedCrewFormationAssignments[index - 1] || { crewGroup: fixedCrewGroup, pic: fixedCrewPic };
          const assignedCrewGroup = assignment.crewGroup || fixedCrewGroup;
          const assignedPic = assignment.pic || fixedCrewPic;
          const assignedCrewMembers = getFixedCrewMembersForGroup(assignedCrewGroup);
          const savedCallsign = eventCategory === 'sct'
            ? resolveAssignedCallsign(assignedPic) || callsign
            : callsign;
          eventsToSave.push({
          id: isEditingExistingEvent && existingFormationEvents[index]?.id ? existingFormationEvents[index].id : uuidv4(),
          date,
          type: eventType,
          eventCategory,
          flightType: selectedFixedCrewCurrencyProfile?.flightType || 'Dual',
          flightNumber,
          instructor: assignedPic,
          student: '',
          pilot: assignedPic,
          crew: formatFixedCrewDisplayGroup(assignedCrewGroup),
          startTime,
          duration,
          area: eventType === 'flight' ? area : '-',
          aircraftNumber: eventType === 'flight' ? formatAircraftNumber(aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings) : undefined,
          aircraftConfigId: eventType === 'flight' ? selectedCurrencyConfig : undefined,
          acceptableAircraftConfigs: eventType === 'flight' ? selectedCurrencyAcceptableConfigs : undefined,
          callsign: savedCallsign,
          locationType,
          color: 'bg-emerald-500',
          resourceId: isEditingExistingEvent && existingFormationEvents[index]?.resourceId ? (existingFormationEvents[index].resourceId || '') : '',
          notes: [
            notes,
            selectedFixedCrewCurrencyProfile?.currency ? `Currency: ${selectedFixedCrewCurrencyProfile.currency}` : '',
            savedAircraftCount > 1 ? `Aircraft requested: ${savedAircraftCount}` : '',
          ].filter(Boolean).join('\n'),
          currency: selectedFixedCrewCurrencyProfile?.currency || undefined,
          eventCode: selectedFixedCrewCurrencyProfile?.code || selectedFixedCrewEvent?.code || undefined,
          dayNight: selectedFixedCrewCurrencyProfile?.dayNight,
          group: formatFixedCrewDisplayGroup(assignedCrewGroup),
          groupTraineeIds: [],
          attendees: assignedCrewMembers.map(staff => staff.name),
          origin: locationType === 'Local' ? school : origin,
          destination: locationType === 'Local' ? school : destination,
          fixedCrewGroup: assignedCrewGroup,
          fixedCrewPic: assignedPic,
          fixedCrewManifestStatus,
          fixedCrewManifestNotes,
          aircraftCount: savedAircraftCount,
          formationId: isEditingExistingEvent && index === 0 && savedAircraftCount === 1 ? initialEvent!.formationId : formationId,
          formationPosition: savedAircraftCount > 1 ? index + 1 : undefined,
          formationSize: savedAircraftCount > 1 ? savedAircraftCount : undefined,
          taskingAircraftIndex: savedAircraftCount > 1 ? index + 1 : undefined,
          taskingAircraftCount: savedAircraftCount > 1 ? savedAircraftCount : undefined,
          } as any);
        });
        onSave(eventsToSave);
        onClose();
        return;
      }

      const isFormation = isSctFormationCode(flightNumber);
      const selectedContinuationProfile = eventCategory === 'sct' ? findContinuationCurrencyProfile(flightNumber) : undefined;
      const selectedContinuationAcceptableConfigs = Array.isArray(selectedContinuationProfile?.acceptableAircraftConfigs) && selectedContinuationProfile.acceptableAircraftConfigs.length > 0
        ? selectedContinuationProfile.acceptableAircraftConfigs
        : [selectedContinuationProfile?.config || aircraftConfigId];
      const crewDrafts: FormationCrewDraft[] = isFormation
        ? [
            { flightType, picName, studentName, callsign: formationType ? `${formationType}1` : callsign },
            ...formationCrew.map((crewMember, index) => ({
              ...crewMember,
              callsign: crewMember.callsign || (formationType ? `${formationType}${index + 2}` : ''),
            })),
          ]
        : [{ flightType, picName, studentName, callsign }];

      crewDrafts.forEach((crewMember, index) => {
        const savedFlightType = isFormation ? crewMember.flightType : flightType;
        const savedCallsign = isFormation
          ? (formationType ? `${formationType}${index + 1}` : crewMember.callsign)
          : eventCategory === 'sct'
            ? resolveAssignedCallsign(crewMember.picName) || crewMember.callsign
            : crewMember.callsign;
        eventsToSave.push({
          id: uuidv4(),
          date,
          type: 'flight',
          eventCategory,
          flightType: savedFlightType,
          flightNumber: eventCategory === 'twr_di' ? 'TWR DI' : flightNumber,
          instructor: isFormation ? '' : (savedFlightType === 'Dual' ? crewMember.picName : ''),
          student: savedFlightType === 'Dual' ? crewMember.studentName : '',
          pilot: crewMember.picName,
          startTime,
          duration,
          area,
          aircraftNumber: formatAircraftNumber(aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings),
          aircraftConfigId: selectedContinuationProfile?.config && selectedContinuationProfile.config !== 'ANY' ? selectedContinuationProfile.config : aircraftConfigId,
          acceptableAircraftConfigs: selectedContinuationAcceptableConfigs,
          callsign: savedCallsign,
          locationType,
          color: tileColor,
          resourceId: '',
          notes,
          group: '',
          groupTraineeIds: [],
          attendees: [],
          origin: locationType === 'Local' ? school : origin,
          destination: locationType === 'Local' ? school : destination,
          formationType: isFormation ? formationType : undefined,
          formationPosition: isFormation ? index + 1 : undefined,
          formationId: undefined,
          dayNight: selectedContinuationProfile?.dayNight,
          currency: selectedContinuationProfile?.currency,
          eventCode: selectedContinuationProfile?.code,
        } as any);
      });
    } else {
      // Deployment tiles
      const parseHrs = (t: string) => { const [h,m] = t.split(':').map(Number); return h + m/60; };
      const dStart = parseHrs(deploymentStartTime);
      const dEnd   = parseHrs(deploymentEndTime);
      const dayDiff = Math.floor((new Date(deploymentEndDate).getTime() - new Date(deploymentStartDate).getTime()) / 86400000);
      const deployDur = Math.max(1, dayDiff * 24 + (dEnd - dStart));
      for (let i = 0; i < deploymentAircraftCount; i++) {
        eventsToSave.push({
          id: `deployment-${uuidv4()}-${i}`,
          date,
          type: 'deployment',
          startTime: dStart,
          duration: deployDur,
          resourceId: '',
          color: 'bg-gray-600/30',
          flightNumber: 'DEPLOYMENT',
          flightType: 'Dual',
          locationType: 'Land Away',
          origin: 'DEPLOY', destination: 'DEPLOY',
          instructor: '', student: '', pilot: '',
          isDeploy: true,
          deploymentStartDate, deploymentStartTime,
          deploymentEndDate, deploymentEndTime,
          deploymentAircraftCount,
        } as any);
      }
    }

    onSave(eventsToSave);
    onClose();
  };

  const categoryLabels: Record<string, string> = isFixedCrewModel
    ? {
      lmp_event: 'Course Event',
      lmp_currency: 'Packages Event',
      sct: 'Currency Event',
    }
    : {
      lmp_event: 'LMP Event', lmp_currency: 'LMP Currency',
      sct: sctShortLabel, staff_cat: 'Staff CAT', twr_di: 'TWR DI',
    };

  const fixedCrewEventFieldLabel = eventCategory === 'lmp_currency'
    ? 'Packages Event'
    : eventCategory === 'sct'
      ? 'Currency Event'
      : 'Course Event';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.70)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 24,
        paddingBottom: 24,
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 720,
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: '#111827',
          borderRadius: 12,
          border: '1px solid #374151',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — always visible at top, never clipped */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #374151',
          flexShrink: 0,
          backgroundColor: '#1f2937',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>Add Flight Tile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5" style={{ overflowY: 'auto', flex: 1 }}>

          {/* Event Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <button
                  key={key} type="button"
                  onClick={() => {
                    setIsDeploy(false);
                    setEventCategory(key as any);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    !isDeploy && eventCategory === key
                      ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsDeploy(true);
                  setLocationType('Land Away');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isDeploy
                    ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Deployment
              </button>
            </div>
          </div>

          {isFixedCrewModel && !isDeploy && (
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/20 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-emerald-100">Fixed Crew Scheduled Tile</h3>
                  <p className="text-xs text-emerald-200/75">Select a {fixedCrewEventFieldLabel.toLowerCase()}, crew group, and PIC for this scheduled event.</p>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-300/80">Manual creation</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{fixedCrewEventFieldLabel}</label>
                  <SelectLikeDropdown
                    value={fixedCrewEventKey}
                    onChange={handleFixedCrewEventChange}
                    accent="emerald"
                    width={420}
                    placeholder={`Select ${fixedCrewEventFieldLabel}`}
                    dropdownKey="add-flight-fixed-event"
                    options={[
                      { value: '', label: `Select ${fixedCrewEventFieldLabel}` },
                      ...(eventCategory === 'sct'
                        ? fixedCrewCurrencyProfileGroups.length === 0
                          ? [{ value: '__none', label: 'No currency events for selected unit', disabled: true }]
                          : fixedCrewCurrencyProfileGroups.flatMap(group => [
                              { value: `__header-${group.label}`, label: group.label, isHeader: true, disabled: true },
                              ...group.options.map(profile => {
                                const unit = normaliseFixedCrewUnitCode(profile.unitCode || profile.compositeUnitCode);
                                const code = stripLeadingUnitLabel(profile.code || profile.name || profile.currency, unit);
                                const name = stripLeadingUnitLabel(profile.name, unit);
                                const currency = stripLeadingUnitLabel(profile.currency, unit);
                                const label = Array.from(new Set([code, name, currency].filter(Boolean))).join(' - ');
                                return { value: getFixedCrewCurrencyProfileOptionKey(profile), label };
                              }),
                            ])
                        : fixedCrewEventOptionGroups.length === 0
                          ? [{ value: '__none', label: `No ${fixedCrewEventFieldLabel.toLowerCase()}s for selected unit`, disabled: true }]
                          : fixedCrewEventOptionGroups.flatMap(group => [
                              { value: `__header-${group.label}`, label: group.label, isHeader: true, disabled: true },
                              ...group.options.map(item => {
                                const unit = normaliseFixedCrewUnitCode(item.unit);
                                const code = stripLeadingUnitLabel(item.code || item.id || '', unit);
                                const description = stripLeadingUnitLabel((item as any).title || item.eventDescription || (item as any).description, unit);
                                const label = [code, description].filter(Boolean).join(' - ');
                                return { value: getFixedCrewEventOptionKey(item), label };
                              }),
                            ])),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Crew</label>
                  <SelectLikeDropdown
                    value={fixedCrewGroup}
                    onChange={value => {
                      setFixedCrewGroup(value);
                      setFixedCrewPic('');
                    }}
                    accent="emerald"
                    width={320}
                    placeholder="Select crew"
                    dropdownKey="add-flight-fixed-crew"
                    options={[
                      { value: '', label: 'Select crew' },
                      ...fixedCrewGroupOptionGroups.flatMap(group => [
                        { value: `__header-${group.unit}`, label: group.unit, isHeader: true, disabled: true },
                        ...group.options.map(crewGroup => ({ value: crewGroup, label: formatUnavailableCrewLabel(crewGroup) })),
                      ]),
                    ]}
                  />
                  {selectedFixedCrewUnavailableSummary && (
                    <div className="mt-1 rounded border border-red-500/30 bg-red-950/25 px-2 py-1 text-[11px] font-semibold text-red-200">
                      {selectedFixedCrewUnavailableSummary}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">PIC</label>
                  <SelectLikeDropdown
                    value={fixedCrewPic}
                    onChange={setFixedCrewPic}
                    disabled={!fixedCrewGroup || fixedCrewPicCandidates.length === 0}
                    accent="emerald"
                    width={320}
                    placeholder={fixedCrewGroup ? 'Select PIC' : 'Select crew first'}
                    dropdownKey="add-flight-fixed-pic"
                    options={[
                      { value: '', label: fixedCrewGroup ? 'Select PIC' : 'Select crew first' },
                      ...fixedCrewPicCandidates.map(staff => ({ value: staff.name, label: formatUnavailableStaffLabel(staff) })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">No. of A/C</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={Math.max(1, Number(aircraftCount) || 1)}
                    onChange={e => setAircraftCount(Math.max(1, Math.min(24, Math.floor(Number(e.target.value) || 1))))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Manifest Status</label>
                  <SelectLikeDropdown
                    value={fixedCrewManifestStatus || 'pending'}
                    onChange={value => setFixedCrewManifestStatus(value as ScheduleEvent['fixedCrewManifestStatus'])}
                    accent="emerald"
                    width={220}
                    dropdownKey="add-flight-fixed-manifest"
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'complete', label: 'Complete' },
                      { value: 'partial', label: 'Partial' },
                      { value: 'swapped', label: 'Swapped' },
                      { value: 'invalid', label: 'Invalid' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Callsign</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                    <SelectLikeDropdown
                      value={unitCallsignBase}
                      onChange={value => {
                        setUnitCallsignBase(value);
                        setCallsign(buildUnitEventCallsign(value, unitCallsignNumber));
                      }}
                      disabled={unitCallsignEntries.length === 0}
                      accent="emerald"
                      width={260}
                      placeholder={unitCallsignEntries.length === 0 ? 'No unit callsigns' : 'Select callsign'}
                      dropdownKey="add-flight-fixed-callsign-base"
                      options={unitCallsignEntries.length === 0
                        ? [{ value: '', label: 'No unit callsigns', disabled: true }]
                        : unitCallsignEntries.map(entry => ({
                            value: entry.callsign,
                            label: `${activeCallsignUnitCodes.length > 1 ? `${entry.unitCode} - ` : ''}${entry.callsign}${entry.isDefault ? ' (default)' : ''}`,
                          }))}
                    />
                    <SelectLikeDropdown
                      value={String(unitCallsignNumber)}
                      onChange={value => {
                        const nextNumber = parseInt(value, 10) || 0;
                        setUnitCallsignNumber(nextNumber);
                        setCallsign(buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, nextNumber));
                      }}
                      disabled={unitCallsignEntries.length === 0}
                      accent="emerald"
                      width={96}
                      dropdownKey="add-flight-fixed-callsign-number"
                      options={callsignNumberOptions.map(option => ({ value: String(option.value), label: option.label }))}
                    />
                  </div>
                  {selectedPicHasIndividualCallsign && (
                    <div className="mt-1 text-[11px] text-gray-500">PIC profile callsign is available; select a unit callsign if this tile needs one.</div>
                  )}
                </div>
              </div>
              {Math.max(1, Number(aircraftCount) || 1) > 1 && (
                <div className="rounded-lg border border-emerald-500/25 bg-slate-950/35 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Formation Crew</div>
                    <div className="text-[11px] text-slate-400">Aircraft 1 uses the primary Crew and PIC above.</div>
                  </div>
                  <div className="space-y-3">
                    {fixedCrewFormationAssignments.map((assignment, index) => {
                      const picCandidates = getFixedCrewPicCandidatesForGroup(assignment.crewGroup);
                      return (
                        <div key={`fixed-crew-formation-${index}`} className="grid gap-3 rounded-md border border-slate-700 bg-slate-900/70 p-3 md:grid-cols-[5.75rem_minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="flex items-center text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                            A/C {index + 2}
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Crew</label>
                            <SelectLikeDropdown
                              value={assignment.crewGroup}
                              onChange={value => updateFixedCrewFormationAssignment(index, { crewGroup: value, pic: '' })}
                              accent="emerald"
                              width={320}
                              placeholder="Select crew"
                              dropdownKey={`add-flight-fixed-formation-crew-${index}`}
                              options={[
                                { value: '', label: 'Select crew' },
                                ...fixedCrewGroupOptionGroups.flatMap(group => [
                                  { value: `__header-${group.unit}`, label: group.unit, isHeader: true, disabled: true },
                                  ...group.options.map(crewGroup => ({ value: crewGroup, label: formatUnavailableCrewLabel(crewGroup) })),
                                ]),
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">PIC</label>
                            <SelectLikeDropdown
                              value={assignment.pic}
                              onChange={value => updateFixedCrewFormationAssignment(index, { pic: value })}
                              disabled={!assignment.crewGroup || picCandidates.length === 0}
                              accent="emerald"
                              width={320}
                              placeholder={assignment.crewGroup ? 'Select PIC' : 'Select crew first'}
                              dropdownKey={`add-flight-fixed-formation-pic-${index}`}
                              options={[
                                { value: '', label: assignment.crewGroup ? 'Select PIC' : 'Select crew first' },
                                ...picCandidates.map(staff => ({ value: staff.name, label: formatUnavailableStaffLabel(staff) })),
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                  <SelectLikeDropdown
                    value={locationType}
                    onChange={value => setLocationType(value as 'Local'|'Land Away')}
                    accent="emerald"
                    width={220}
                    dropdownKey="add-flight-fixed-location"
                    options={[
                      { value: 'Local', label: 'Local' },
                      { value: 'Land Away', label: 'Land Away' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                  <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-gray-300 text-sm font-mono">
                    {formatDate(date)}
                  </div>
                </div>
              </div>
              {locationType === 'Land Away' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Origin</label>
                    <input
                      type="text"
                      value={origin}
                      onChange={e => setOrigin(e.target.value.toUpperCase())}
                      maxLength={4}
                      placeholder="Origin"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Destination</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={e => setDestination(e.target.value.toUpperCase())}
                      maxLength={4}
                      placeholder="Destination"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-gray-700 bg-gray-900/45 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Crew Members</div>
                  {fixedCrewMembers.length > 0 ? (
                    <div className="space-y-3">
                      {fixedCrewMemberDisplayGroups.map(group => (
                        <div key={group.label} className="space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300/80">{group.label}</div>
                          {group.members.map(staff => (
                            <div key={staff.id || staff.name} className="flex items-center justify-between gap-2 rounded bg-gray-800/70 px-2 py-1.5 text-sm">
                              <span className="min-w-0 truncate text-gray-100">{[staff.rank, staff.name].filter(Boolean).join(' ')}</span>
                              <span className="flex-shrink-0 text-xs font-semibold text-emerald-300">{staff.role || 'Staff'}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-500">Select a crew to preview its members.</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Swap / Manifest Notes</label>
                  <textarea
                    value={fixedCrewManifestNotes}
                    onChange={e => setFixedCrewManifestNotes(e.target.value)}
                    rows={5}
                    placeholder="Optional swap reason or manifest notes..."
                    className="w-full h-full min-h-[132px] bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Interactive flight tile input for Flight School / Air Combat. Fixed Crew uses the structured controls above. */}
          {!isDeploy && !isFixedCrewModel && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Flight Tile</label>
              <div style={{ padding: '0 2px' }}>
                <FlightTile
                  flightType={flightType}
                  startTime={startTime}
                  picName={picName}
                  studentName={studentName}
                  duration={duration}
                  flightNumber={flightNumber}
                  area={area}
                  aircraftNumber={aircraftNumber}
                  aircraftNumberPrefix={aircraftNumberPrefix}
                  aircraftNumberSettings={aircraftNumberSettings}
                  callsign={callsign}
                  color={tileColor}
                  timeOptions={timeOptions}
                  durationOptions={durationOptions}
                  areaOptions={areaOptions}
                  aircraftOptions={aircraftOptions}
                  callsignOptions={callsignOptions}
                  formationCallsigns={formationCallsigns}
                  editMode={tileEditMode}
                  layoutSaved={tileLayoutSaved}
                  positions={tilePositions}
                  savedPositions={tileSavedPositions}
                  activeStep={guidedStep}
                  onEnterEditMode={handleEnterEditMode}
                  onExitEditMode={handleExitEditMode}
                  onDragPosition={handleDragPosition}
                  allUnits={allUnits}
                  getLayer2={getLayer2}
                  getNames={getNames}
                  getPicNames={getPicNames}
                  getDisplayLabel={getDisplayLabel}
                  courseOptions={courseOptions}
                  getEventsForCourse={getEventsForCourse}
                  nextLMPEvent={nextLMPEvent}
                  eventCategory={eventCategory}
                  getCourseDisplayLabel={getCourseDisplayLabel}
                  getEventDisplayLabel={getContinuationDisplayLabel}
                  continuationEventOptions={getContinuationEventNames(sctEvents)}
                  onFlightTypeChange={setFlightType}
                  onStartTimeChange={(value) => {
                    setStartTime(value);
                    setGuidedStep('trainee');
                  }}
                  onPicNameChange={handlePicNameChange}
                  onStudentNameChange={(name) => {
                    setStudentName(name);
                    setGuidedStep('instructor');
                  }}
                  onDurationChange={setDuration}
                  onFlightNumberChange={handleFlightNumberChange}
                  onAreaChange={(value) => {
                    setArea(value);
                    setGuidedStep('aircraft');
                  }}
                  onAircraftChange={(value) => {
                    setAircraftNumber(value);
                    setGuidedStep('done');
                  }}
                  onAircraftPrefixChange={setAircraftNumberPrefix}
                  onCallsignChange={setCallsign}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {`Click any field on the tile to edit. Names open a cascading dropdown. Duration & Event are in the top-right.${isSingleSeatAircraft ? ' This aircraft type is configured as single-seat, so new flights are Solo.' : ' Click SOLO badge to switch to Dual.'}`}
              </p>
            </div>
          )}

          {/* Deployment fields */}
          <div className="border-t border-gray-700 pt-4">
            {isDeploy && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4 border border-gray-600">
                <h4 className="text-sm font-semibold text-white mb-3">Deployment Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input type="date" value={deploymentStartDate} onChange={e => setDeploymentStartDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time (24hr)</label>
                    <input type="time" value={deploymentStartTime} onChange={e => setDeploymentStartTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input type="date" value={deploymentEndDate} onChange={e => setDeploymentEndDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Time (24hr)</label>
                    <input type="time" value={deploymentEndTime} onChange={e => setDeploymentEndTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Aircraft Count</label>
                    <input type="number" min="1" max="10" value={deploymentAircraftCount}
                      onChange={e => setDeploymentAircraftCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Flight type toggle + Location + Date + Notes — hidden when deploying */}
            {!isDeploy && !isFixedCrewModel && (
              <>
                {!isFixedCrewModel && <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Flight Type</label>
                    {isSingleSeatAircraft ? (
                      <div className="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
                        Solo - single-seat aircraft
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFlightType('Dual')}
                          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${flightType === 'Dual' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          Dual
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlightType('Solo')}
                          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${flightType === 'Solo' ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          Solo
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">CONFIG</label>
                    <SelectLikeDropdown
                      value={aircraftConfigId}
                      onChange={setAircraftConfigId}
                      width={260}
                      dropdownKey="add-flight-config"
                      options={aircraftConfigOptions.map(definition => ({ value: definition.id, label: definition.label }))}
                    />
                  </div>
                </div>}
                {!isFixedCrewModel && !selectedPicHasIndividualCallsign && unitCallsignEntries.length > 0 && (
                  <div className="mb-4 rounded-lg border border-sky-500/25 bg-sky-950/20 p-3">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Unit Callsign</label>
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                      <SelectLikeDropdown
                        value={unitCallsignBase}
                        onChange={value => {
                          setUnitCallsignBase(value);
                          setCallsign(buildUnitEventCallsign(value, unitCallsignNumber));
                        }}
                        width={260}
                        dropdownKey="add-flight-unit-callsign-base"
                        options={unitCallsignEntries.map(entry => ({
                          value: entry.callsign,
                          label: `${entry.callsign}${entry.isDefault ? ' (default)' : ''}`,
                        }))}
                      />
                      <SelectLikeDropdown
                        value={String(unitCallsignNumber)}
                        onChange={value => {
                          const nextNumber = parseInt(value, 10) || 0;
                          setUnitCallsignNumber(nextNumber);
                          setCallsign(buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, nextNumber));
                        }}
                        width={96}
                        dropdownKey="add-flight-unit-callsign-number"
                        options={callsignNumberOptions.map(option => ({ value: String(option.value), label: option.label }))}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                    <SelectLikeDropdown
                      value={locationType}
                      onChange={value => setLocationType(value as 'Local'|'Land Away')}
                      width={220}
                      dropdownKey="add-flight-location"
                      options={[
                        { value: 'Local', label: 'Local' },
                        { value: 'Land Away', label: 'Land Away' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                    <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-gray-300 text-sm font-mono">
                      {formatDate(date)}
                    </div>
                  </div>
                </div>
                {locationType === 'Land Away' && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Origin</label>
                      <input
                        type="text"
                        value={origin}
                        onChange={e => setOrigin(e.target.value.toUpperCase())}
                        maxLength={4}
                        placeholder="Origin"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Destination</label>
                      <input
                        type="text"
                        value={destination}
                        onChange={e => setDestination(e.target.value.toUpperCase())}
                        maxLength={4}
                        placeholder="Destination"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                      />
                    </div>
                  </div>
                )}
                {isSctFormationCode(flightNumber) && (
                  <div className="mt-4 rounded-lg border border-gray-600 bg-gray-800/70 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Formation Callsign</label>
                        <SelectLikeDropdown
                          value={formationType}
                          onChange={setFormationType}
                          width={280}
                          placeholder="Select callsign"
                          dropdownKey="add-flight-formation-callsign"
                          options={filteredFormationCallsigns.length > 0
                            ? filteredFormationCallsigns.map(cs => ({ value: cs.code, label: `${cs.name} (${cs.code})` }))
                            : [{ value: '', label: 'No formation callsigns configured', disabled: true }]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Aircraft Count</label>
                        <SelectLikeDropdown
                          value={String(aircraftCount)}
                          onChange={value => setAircraftCount(parseInt(value, 10))}
                          width={140}
                          dropdownKey="add-flight-formation-aircraft-count"
                          options={Array.from({ length: 7 }, (_, i) => i + 2).map(count => ({ value: String(count), label: String(count) }))}
                        />
                      </div>
                    </div>
                    {formationCrew.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {formationCrew.map((crewMember, index) => (
                          <div key={index} className={`grid gap-3 items-end rounded-md bg-gray-900/45 border border-gray-700 px-3 py-3 ${isSingleSeatAircraft ? 'grid-cols-[90px_1fr]' : 'grid-cols-[90px_1fr_1fr]'}`}>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Aircraft</label>
                              <div className="bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm font-mono text-center">
                                {formationType}{index + 2}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pilot</label>
                              <div className="bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-white text-sm">
                                <PersonDropdown
                                  value={crewMember.picName}
                                  displayValue={crewMember.picName}
                                  onChange={(name) => updateFormationCrew(index, { picName: name })}
                                  allUnits={allUnits}
                                  getLayer2={getLayer2}
                                  getNames={getPicNames}
                                  placeholder="Select pilot"
                                  fontSize={14}
                                  color={crewMember.picName ? '#fff' : 'rgba(255,255,255,0.45)'}
                                  bold
                                  dropdownId={`formation-pic-dropdown-${index}`}
                                />
                              </div>
                            </div>
                            {!isSingleSeatAircraft && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Crew</label>
                                <div className="bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-white text-sm">
                                  {crewMember.flightType === 'Dual' ? (
                                    <PersonDropdown
                                      value={crewMember.studentName}
                                      displayValue={crewMember.studentName}
                                      onChange={(name) => updateFormationCrew(index, { studentName: name })}
                                      allUnits={allUnits}
                                      getLayer2={getLayer2}
                                      getNames={getNames}
                                      placeholder="Select crew"
                                      fontSize={14}
                                      color={crewMember.studentName ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)'}
                                      allowSolo
                                      onSoloSelect={() => updateFormationCrew(index, { flightType: 'Solo', studentName: '' })}
                                      dropdownId={`formation-crew-dropdown-${index}`}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => updateFormationCrew(index, { flightType: 'Dual' })}
                                      className="w-full text-left text-sm font-semibold text-amber-300"
                                    >
                                      SOLO
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              {errors.map((e, i) => <p key={i} className="text-red-300 text-sm">• {e}</p>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-[1px] px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-[90px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="w-[90px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
          >
            Add to Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFlightTileModal;
