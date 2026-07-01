import { showDarkAlert } from './DarkMessageModal';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScheduleEvent, Trainee, Instructor, CurrencyRequirement, MasterCurrency, CurrencyDefinition, PostFlightInputType } from '../types';
import AuditButton from './AuditButton';
import UnsavedChangesWarning from './UnsavedChangesWarning';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';
import { useSystemFreeze } from '../context/SystemFreezeContext';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
    DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
    formatAircraftNumber,
    parseAircraftNumber,
    type AircraftNumberSettings,
} from '../utils/aircraftNumberFormat';
import { normaliseFixedCrewStaffRole } from '../utils/crewPositionTerminology';
import {
    comparePeopleByConfiguredRank,
    type PersonnelDisplaySettings,
} from '../utils/personnelDisplaySettings';

interface PostFlightViewProps {
  event: ScheduleEvent;
  onReturn: () => void;
  onSave: (data: any) => void | boolean | Promise<void | boolean>;
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
  instructorsData: Instructor[];
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  resourceDisplayNames?: ResourceDisplayNames;
  aircraftNumberSettings?: AircraftNumberSettings;
  personnelDisplaySettings?: Partial<PersonnelDisplaySettings> | null;
  getSunTimesForAirfieldDate?: (targetDate: string, airfieldCode?: string | null) => any;
}

const POST_FLIGHT_FORM_STORAGE_PREFIX = 'dfpNeo.postFlightFormSnapshot.';

const getPostFlightFormStorageKey = (eventId?: string) =>
    eventId ? `${POST_FLIGHT_FORM_STORAGE_PREFIX}${eventId}` : '';

// FIX: Changed to a named export to resolve module resolution errors.
export const PostFlightView: React.FC<PostFlightViewProps> = ({ event, onReturn, onSave, school, traineesData, instructorsData, masterCurrencies = [], currencyRequirements = [], resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, aircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS, personnelDisplaySettings, getSunTimesForAirfieldDate }) => {
    const { freezeState, checkAndWarn } = useSystemFreeze();
    // Find trainee or pilot for header
    const person = useMemo(() => {
        const personName = event.student || event.pilot;
        return traineesData.find(t => t.fullName === personName);
    }, [event, traineesData]);

    // --- POST-FLIGHT CURRENCY STATE ---
    // All currencies flagged showInPostFlight=true, sorted: composites first, then primitives
    const postFlightCurrencies = useMemo<CurrencyDefinition[]>(() => {
        const composites = masterCurrencies.filter(c => c.showInPostFlight);
        const primitives = currencyRequirements.filter(c => c.showInPostFlight);
        return [...composites, ...primitives];
    }, [masterCurrencies, currencyRequirements]);

    const postFlightRecencyItems = useMemo<CurrencyDefinition[]>(() => {
        const primitives = currencyRequirements.filter(c => c.showInPostFlightRecency);
        const composites = masterCurrencies.filter(c => c.showInPostFlightRecency);
        return [...primitives, ...composites].sort((a, b) => a.name.localeCompare(b.name));
    }, [currencyRequirements, masterCurrencies]);

    // Map: currencyId → value (string for date/count, 'true'/'false' for checkbox)
    const [currencyValues, setCurrencyValues] = useState<Record<string, string>>({});

    const handleCurrencyChange = (id: string, value: string) => {
        setCurrencyValues(prev => ({ ...prev, [id]: value }));
    };

    const getEffectiveInputTypes = (c: CurrencyDefinition): PostFlightInputType[] => {
        if (c.postFlightInputTypes && c.postFlightInputTypes.length > 0) return c.postFlightInputTypes;
        if (c.type === 'composite') return ['checkbox'];
        return (c as CurrencyRequirement).expiryRule === 'ROLLING_WINDOW' ? ['count'] : ['date'];
    };

    // State
    const [result, setResult] = useState<'DCO' | 'DPCO' | 'DNCO' | ''>('');
    const [aircraftNumber, setAircraftNumber] = useState('001');
    const [aircraftNumberPrefix, setAircraftNumberPrefix] = useState(aircraftNumberSettings.defaultPrefix);
    const [from, setFrom] = useState<string>(school);
    const [to, setTo] = useState<string>(school);

    useEffect(() => {
        if (!aircraftNumberSettings.prefixes.includes(aircraftNumberPrefix)) {
            setAircraftNumberPrefix(aircraftNumberSettings.defaultPrefix);
        }
    }, [aircraftNumberPrefix, aircraftNumberSettings]);

    // Flight Mode State
    const [isFlightLog, setIsFlightLog] = useState(event.type === 'flight');
    const [isFtdLog, setIsFtdLog] = useState(event.type === 'ftd');
    const [isSolo, setIsSolo] = useState(event.flightType === 'Solo');
    const [isDual, setIsDual] = useState(event.flightType === 'Dual');

    const [takeoffTime, setTakeoffTime] = useState('');
    const [landTime, setLandTime] = useState('');

    // New state for Durations & Approaches
    const [duty, setDuty] = useState(`${event.origin || school}-${event.destination || school} : ${event.flightNumber}`);
    const [captainTime, setCaptainTime] = useState('');
    const [instructorTime, setInstructorTime] = useState('');
    const [nightTime, setNightTime] = useState('');
    const [ifActualTime, setIfActualTime] = useState('');
    const [ifSimTime, setIfSimTime] = useState('');
    const [ineffectiveTime, setIneffectiveTime] = useState('');
    const [ilsChecked, setIlsChecked] = useState(false);
    const [ilsCount, setIlsCount] = useState(0);
    const [rnpChecked, setRnpChecked] = useState(false);
    const [rnpCount, setRnpCount] = useState(0);
    const [tacanChecked, setTacanChecked] = useState(false);
    const [tacanCount, setTacanCount] = useState(0);
    const [vorChecked, setVorChecked] = useState(false);
    const [vorCount, setVorCount] = useState(0);
    const [approachAssignments, setApproachAssignments] = useState<Record<'ils' | 'rnp' | 'tacan' | 'vor', string>>({
        ils: '',
        rnp: '',
        tacan: '',
        vor: '',
    });

    // Dirty check and save status
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const initialFormState = useRef<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Saved');
    const isFirstRender = useRef(true);

    const getFormattedName = (name: string | undefined) => {
        if (!name) return '';
        const cleanName = name.split(' – ')[0];

        const instructor = instructorsData.find(i => i.name === cleanName);
        if (instructor) {
            return `${instructor.rank} ${cleanName.split(',')[0]}`;
        }

        const trainee = traineesData.find(t => t.name === cleanName || t.fullName === name);
        if (trainee) {
            return `${trainee.rank} ${cleanName.split(',')[0]}`;
        }

        return cleanName.split(',')[0];
    };
    const formatLogbookPersonName = (name?: string | null): string => {
        const cleanName = String(name || '').split(' – ')[0].trim();
        if (!cleanName) return '';
        const commaParts = cleanName.split(',').map(part => part.trim()).filter(Boolean);
        if (commaParts.length >= 2) return `${commaParts[0]}, ${commaParts.slice(1).join(' ')}`;
        const spaceParts = cleanName.split(/\s+/).filter(Boolean);
        if (spaceParts.length >= 2) {
            const surname = spaceParts[spaceParts.length - 1];
            const firstNames = spaceParts.slice(0, -1).join(' ');
            return `${surname}, ${firstNames}`;
        }
        return cleanName;
    };
    const normalisePostFlightName = (value?: string | null): string => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const getFixedCrewGroupDetails = (value?: string | null, fallbackUnit?: string | null): { crew: string; unit: string } => {
        const raw = String(value || '').trim().toUpperCase();
        const fallback = String(fallbackUnit || '').trim().toUpperCase();
        if (!raw) return { crew: '', unit: fallback };
        const parts = raw.split('::').map(part => part.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return { unit: parts[0], crew: parts.slice(1).join('::').replace(/^CREW\s*/i, '').trim() };
        }
        const slashParts = raw.replace(/^CREW\s*/i, '').split('/').map(part => part.trim()).filter(Boolean);
        if (slashParts.length >= 2) {
            return { crew: slashParts[0], unit: slashParts[1] };
        }
        return { crew: slashParts[0] || parts[0]?.replace(/^CREW\s*/i, '').trim() || '', unit: fallback };
    };
    const isPilotStaff = (staff?: Instructor | null): boolean => {
        const role = String(staff?.role || '').trim().toLowerCase();
        return role === 'pilot' || role.includes('pilot');
    };
    const getFixedCrewPreviewRole = (staff?: Instructor | null): string => (
        normaliseFixedCrewStaffRole(staff?.role, staff?.unit).trim() || 'Crew'
    );
    const fixedCrewRoster = useMemo(() => {
        const roster = new Map<string, Instructor>();
        const addByName = (name?: string | null) => {
            const normalised = normalisePostFlightName(name);
            if (!normalised || normalised === 'tba') return;
            const staff = instructorsData.find(person => normalisePostFlightName(person.name) === normalised);
            if (staff) roster.set(normalisePostFlightName(staff.name), staff);
        };
        addByName(event.fixedCrewPic || event.pilot || event.instructor);
        (Array.isArray(event.crewSelectionOrder) ? event.crewSelectionOrder : []).forEach(addByName);
        (Array.isArray(event.attendees) ? event.attendees : []).forEach(addByName);
        String(event.crew || '')
            .split(/[,;/]/)
            .map(name => name.trim())
            .filter(Boolean)
            .forEach(addByName);

        const crewDetails = getFixedCrewGroupDetails(event.fixedCrewGroup || event.group || event.crew, (event as any).fixedCrewUnit || (event as any).unit);
        if (crewDetails.crew) {
            instructorsData
                .filter(staff => (
                    String(staff.crew || '').trim().toUpperCase() === crewDetails.crew
                    && (!crewDetails.unit || String(staff.unit || '').trim().toUpperCase() === crewDetails.unit)
                ))
                .forEach(staff => roster.set(normalisePostFlightName(staff.name), staff));
        }
        return Array.from(roster.values());
    }, [event, instructorsData]);
    const fixedCrewPicName = normalisePostFlightName(event.fixedCrewPic || event.pilot || event.instructor);
    const fixedCrewCoPilotNames = fixedCrewRoster
        .filter(staff => normalisePostFlightName(staff.name) !== fixedCrewPicName && isPilotStaff(staff))
        .map(staff => staff.name);
    const isFixedCrewLogbookPreview = fixedCrewRoster.length > 0 && (event.fixedCrewGroup || event.fixedCrewPic || event.crewSelectionOrder?.length);
    const fixedCrewLogbookPreviewRoster = useMemo(() => (
        fixedCrewRoster.slice().sort((a, b) => {
            const aIsPic = normalisePostFlightName(a.name) === fixedCrewPicName;
            const bIsPic = normalisePostFlightName(b.name) === fixedCrewPicName;
            if (aIsPic !== bIsPic) return aIsPic ? -1 : 1;

            const aIsPilot = isPilotStaff(a);
            const bIsPilot = isPilotStaff(b);
            if (aIsPilot !== bIsPilot) return aIsPilot ? -1 : 1;

            if (!aIsPilot && !bIsPilot) {
                const roleCompare = getFixedCrewPreviewRole(a).localeCompare(getFixedCrewPreviewRole(b));
                if (roleCompare) return roleCompare;
            }

            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings || undefined, 'staff');
        })
    ), [fixedCrewPicName, fixedCrewRoster, personnelDisplaySettings]);
    const pilotLogbookOptions = useMemo(() => {
        const options: Array<{ key: string; label: string }> = [];
        const addPilotOption = (name?: string | null) => {
            const cleanName = String(name || '').split(' – ')[0].trim();
            const key = normalisePostFlightName(cleanName);
            if (!key || key === 'tba' || options.some(option => option.key === key)) return;
            options.push({ key, label: formatLogbookPersonName(cleanName) });
        };
        if (isFixedCrewLogbookPreview) {
            fixedCrewLogbookPreviewRoster
                .filter(staff => isPilotStaff(staff))
                .forEach(staff => addPilotOption(staff.name));
        } else {
            addPilotOption(event.instructor || event.pilot);
            if (!isSolo) addPilotOption(event.student);
        }
        return options;
    }, [event.instructor, event.pilot, event.student, fixedCrewLogbookPreviewRoster, isFixedCrewLogbookPreview, isSolo]);
    const defaultApproachPilotKey = pilotLogbookOptions[0]?.key || '';
    const getApproachAssignedPilotKey = (kind: 'ils' | 'rnp' | 'tacan' | 'vor') => approachAssignments[kind] || defaultApproachPilotKey;
    const isApproachAssignedToPilot = (kind: 'ils' | 'rnp' | 'tacan' | 'vor', pilotKey?: string) => {
        const key = normalisePostFlightName(pilotKey);
        return Boolean(key && getApproachAssignedPilotKey(kind) === key);
    };

     // Derived Total Time
    const parsePostFlightTimeToHours = (tStr: string): number | null => {
        const clean = String(tStr || '').trim().replace(':', '');
        if (!/^\d{4}$/.test(clean)) return null;
        const h = parseInt(clean.substring(0, 2), 10);
        const m = parseInt(clean.substring(2, 4), 10);
        if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h >= 24 || m < 0 || m >= 60) return null;
        return h + (m / 60);
    };

    const totalTime = useMemo(() => {
        const parseTime = (tStr: string) => {
             const clean = tStr.replace(':', '');
             if (clean.length < 4) return null;
             const h = parseInt(clean.substring(0, 2), 10);
             const m = parseInt(clean.substring(2, 4), 10);
             if (isNaN(h) || isNaN(m)) return null;
             return h * 60 + m;
        };

        const startMins = parseTime(takeoffTime);
        const endMins = parseTime(landTime);

        if (startMins === null || endMins === null) {
            return '0.0';
        }

        let durationMinutes = endMins - startMins;

        if (durationMinutes < 0) {
            durationMinutes += 24 * 60; // Add a day if landing is on the next day
        }

        const durationHours = durationMinutes / 60;

        return durationHours.toFixed(1);
    }, [takeoffTime, landTime]);

    const calculatedDayNightSplit = useMemo(() => {
        if (!isFlightLog || typeof getSunTimesForAirfieldDate !== 'function') return null;
        const total = parseFloat(totalTime) || 0;
        if (total <= 0) return null;
        const startParsed = parsePostFlightTimeToHours(takeoffTime);
        const endParsed = parsePostFlightTimeToHours(landTime);
        if (startParsed === null || endParsed === null) return null;
        let start = startParsed;
        let end = endParsed;
        if (end <= start) end += 24;

        const sunTimes = getSunTimesForAirfieldDate(event.date, from || event.origin || school);
        const firstLight = Number(sunTimes?.firstLightDecimal);
        const lastLight = Number(sunTimes?.lastLightDecimal);
        if (!Number.isFinite(firstLight) || !Number.isFinite(lastLight)) return null;

        const dayWindows = [
            { start: firstLight, end: lastLight },
            { start: firstLight + 24, end: lastLight + 24 },
        ];
        const dayHours = dayWindows.reduce((sum, window) => {
            const overlapStart = Math.max(start, window.start);
            const overlapEnd = Math.min(end, window.end);
            return sum + Math.max(0, overlapEnd - overlapStart);
        }, 0);
        const day = Math.min(total, Math.max(0, dayHours));
        const night = Math.max(0, total - day);
        return {
            day: Number(day.toFixed(1)),
            night: Number(night.toFixed(1)),
        };
    }, [event.date, event.origin, from, getSunTimesForAirfieldDate, isFlightLog, landTime, school, takeoffTime, totalTime]);

    const effectiveNightTime = calculatedDayNightSplit ? calculatedDayNightSplit.night.toFixed(1) : nightTime;

    useEffect(() => {
        // Prefill times
        const takeoff = event.startTime;
        const takeoffH = String(Math.floor(takeoff)).padStart(2, '0');
        const takeoffM = String(Math.round((takeoff % 1) * 60)).padStart(2, '0');
        const initialTakeoff = `${takeoffH}:${takeoffM}`;
        setTakeoffTime(initialTakeoff);

        const land = event.landTime || event.startTime + event.duration;
        const landH = String(Math.floor(land)).padStart(2, '0');
        const landM = String(Math.round((land % 1) * 60)).padStart(2, '0');
        const initialLand = `${landH}:${landM}`;
        setLandTime(initialLand);

        // Store the initial state once on mount
        if (!initialFormState.current) {
            initialFormState.current = {
                result: '',
                aircraftNumber: '001',
                aircraftNumberPrefix: aircraftNumberSettings.defaultPrefix,
                from: school,
                to: school,
                isFlightLog: event.type === 'flight',
                isFtdLog: event.type === 'ftd',
                isSolo: event.flightType === 'Solo',
                isDual: event.flightType === 'Dual',
                duty: `${event.origin || school}-${event.destination || school} : ${event.flightNumber}`,
                takeoffTime: initialTakeoff,
                landTime: initialLand,
                captainTime: '',
                instructorTime: '',
                nightTime: '',
                ifActualTime: '',
                ifSimTime: '',
                ineffectiveTime: '',
                ilsChecked: false,
                ilsCount: 0,
                rnpChecked: false,
                rnpCount: 0,
                tacanChecked: false,
                tacanCount: 0,
                vorChecked: false,
                vorCount: 0,
                approachAssignments: { ils: '', rnp: '', tacan: '', vor: '' },
                currencyValues: {},
            };
        }
    }, [event, school]);

    useEffect(() => {
        const storageKey = getPostFlightFormStorageKey(event?.id);
        if (!storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            applySavedFormState(JSON.parse(raw), 'local storage');
        } catch (err) {
            console.warn('[PostFlight] Could not restore saved form snapshot:', err);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id]);

    // ── Load previously saved FlightLogEntry on mount ────────────────────────
    // Fetch any existing saved data for this event from the DB and pre-populate
    // all form fields so reopening the form shows the last-saved values.
    const fetchedFlightLogEventId = useRef<string | null>(null);
    useEffect(() => {
        if (!event?.id || fetchedFlightLogEventId.current === event.id) return;
        fetchedFlightLogEventId.current = event.id;

        fetch(`/api/flight-log?scheduleEventId=${encodeURIComponent(event.id)}`, {
            credentials: 'include',
        })
            .then(r => r.ok ? r.json() : null)
            .then((json: any) => {
                if (!json || !json.entries || json.entries.length === 0) return;

                // Pick the trainee row first, fall back to instructor row
                const traineeRow = json.entries.find((e: any) => e.personRole === 'trainee');
                const instrRow   = json.entries.find((e: any) => e.personRole === 'instructor');
                const row = traineeRow || instrRow;
                if (!row) return;

                console.log('[PostFlight] Restoring saved data from FlightLogEntry:', row);

                const captSnap = traineeRow?.captainLogSnapshot || instrRow?.captainLogSnapshot;
                const crewSnap = traineeRow?.crewLogSnapshot    || instrRow?.crewLogSnapshot;
                applySavedFormState({
                    aircraftNumber: row.aircraftNumber,
                    from: row.fromIcao,
                    to: row.toIcao,
                    duty: row.duty,
                    isSolo: row.isSolo,
                    isDual: row.isDual,
                    isFlightLog: row.isFlightLog,
                    isFtdLog: row.isFtdLog,
                    takeoffTime: row.takeoffTime,
                    landTime: row.landTime,
                    captainTime: traineeRow?.captainTime ?? instrRow?.captainTime,
                    instructorTime: instrRow?.instructorTime ?? traineeRow?.instructorTime,
                    nightTime: row.nightTime,
                    ifActualTime: row.ifActualTime,
                    ifSimTime: row.ifSimTime,
                    ineffectiveTime: row.ineffectiveTime,
                    approaches: {
                        ils: row.ilsCount || 0,
                        rnp: row.rnpCount || 0,
                        tacan: row.tacanCount || 0,
                        vor: row.vorCount || 0,
                    },
                    captainLog: captSnap,
                    crewLog: crewSnap,
                }, 'FlightLogEntry');
            })
            .catch(err => console.warn('[PostFlight] Could not load saved FlightLogEntry:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id, aircraftNumberSettings]);

    // Also load the DCO result from EventCompletion on mount
    useEffect(() => {
        if (!event?.id) return;
        fetch(`/api/event-completions?scheduleEventId=${encodeURIComponent(event.id)}`, {
            credentials: 'include',
        })
            .then(r => r.ok ? r.json() : null)
            .then((json: any) => {
                if (!json) return;
                // API may return { completions }, { completion }, an array, or a single object.
                const record = Array.isArray(json)
                    ? json[0]
                    : Array.isArray(json.completions)
                        ? json.completions[0]
                        : (json.completion || json);
                if (!record) return;
                if (record.dcoResult && ['DCO', 'DPCO', 'DNCO'].includes(record.dcoResult)) {
                    setResult(record.dcoResult as 'DCO' | 'DPCO' | 'DNCO');
                    initialFormState.current = {
                        ...(initialFormState.current || {}),
                        result: record.dcoResult,
                    };
                    setIsDirty(false);
                    console.log('[PostFlight] Restored DCO result:', record.dcoResult);
                }
            })
            .catch(err => console.warn('[PostFlight] Could not load EventCompletion:', err));
    }, [event?.id]);

    // Auto-populate Instructor and Captain times based on Dual status
    // Only auto-populate if the fields are currently empty (don't overwrite restored values)
    useEffect(() => {
        if (isDual && !captainTime && !instructorTime) {
            setInstructorTime(totalTime);
            setCaptainTime(totalTime);
        }
    }, [isDual, totalTime]);

    // --- LOGBOOK OVERRIDE STATE ---
    // Each key corresponds to a logbook field. These are auto-populated from
    // getLogbookData() but the user can manually override any field.
    const [captLogOverride, setCaptLogOverride] = useState<Record<string, string>>({});
    const [crewLogOverride, setCrewLogOverride] = useState<Record<string, string>>({});

    // Track which fields the user has manually touched (so auto-fill doesn't stomp them)
    const [captLogTouched, setCaptLogTouched] = useState<Set<string>>(new Set());
    const [crewLogTouched, setCrewLogTouched] = useState<Set<string>>(new Set());

    function applySavedFormState(saved: any, source: string) {
        if (!saved || typeof saved !== 'object') return;

        if (saved.result != null && ['DCO', 'DPCO', 'DNCO', ''].includes(saved.result)) {
            setResult(saved.result || '');
        }
        if (saved.aircraftNumber) {
            const parsedAircraftNumber = parseAircraftNumber(saved.aircraftNumber, aircraftNumberSettings);
            setAircraftNumber(parsedAircraftNumber.number || '001');
            setAircraftNumberPrefix(parsedAircraftNumber.prefix || aircraftNumberSettings.defaultPrefix);
        }
        if (saved.from) setFrom(saved.from);
        if (saved.to) setTo(saved.to);
        if (saved.isFlightLog != null) setIsFlightLog(!!saved.isFlightLog);
        if (saved.isFtdLog != null) setIsFtdLog(!!saved.isFtdLog);
        if (saved.isSolo != null) setIsSolo(!!saved.isSolo);
        if (saved.isDual != null) setIsDual(!!saved.isDual);
        if (saved.duty) setDuty(saved.duty);
        if (saved.takeoffTime) setTakeoffTime(saved.takeoffTime);
        if (saved.landTime) setLandTime(saved.landTime);
        if (saved.captainTime != null) setCaptainTime(String(saved.captainTime));
        if (saved.instructorTime != null) setInstructorTime(String(saved.instructorTime));
        if (saved.nightTime != null) setNightTime(String(saved.nightTime));
        if (saved.ifActualTime != null) setIfActualTime(String(saved.ifActualTime));
        if (saved.ifSimTime != null) setIfSimTime(String(saved.ifSimTime));
        if (saved.ineffectiveTime != null) setIneffectiveTime(String(saved.ineffectiveTime));

        const approaches = saved.approaches || {};
        const restoreApproach = (
            value: unknown,
            setChecked: React.Dispatch<React.SetStateAction<boolean>>,
            setCount: React.Dispatch<React.SetStateAction<number>>,
        ) => {
            const count = Number(value || 0);
            setChecked(count > 0);
            setCount(Number.isFinite(count) ? count : 0);
        };
        restoreApproach(approaches.ils, setIlsChecked, setIlsCount);
        restoreApproach(approaches.rnp, setRnpChecked, setRnpCount);
        restoreApproach(approaches.tacan, setTacanChecked, setTacanCount);
        restoreApproach(approaches.vor, setVorChecked, setVorCount);
        if (saved.approachAssignments && typeof saved.approachAssignments === 'object') {
            setApproachAssignments({
                ils: normalisePostFlightName(saved.approachAssignments.ils),
                rnp: normalisePostFlightName(saved.approachAssignments.rnp),
                tacan: normalisePostFlightName(saved.approachAssignments.tacan),
                vor: normalisePostFlightName(saved.approachAssignments.vor),
            });
        }

        if (saved.currencyUpdates && typeof saved.currencyUpdates === 'object') {
            setCurrencyValues(saved.currencyUpdates);
        } else if (saved.currencyValues && typeof saved.currencyValues === 'object') {
            setCurrencyValues(saved.currencyValues);
        }

        if (saved.captainLog && typeof saved.captainLog === 'object') setCaptLogOverride(saved.captainLog);
        if (saved.crewLog && typeof saved.crewLog === 'object') setCrewLogOverride(saved.crewLog);

        initialFormState.current = {
            result: saved.result != null ? saved.result || '' : result,
            aircraftNumber: saved.aircraftNumber
                ? parseAircraftNumber(saved.aircraftNumber, aircraftNumberSettings).number || '001'
                : aircraftNumber,
            aircraftNumberPrefix: saved.aircraftNumber
                ? parseAircraftNumber(saved.aircraftNumber, aircraftNumberSettings).prefix || aircraftNumberSettings.defaultPrefix
                : aircraftNumberPrefix,
            from: saved.from || from,
            to: saved.to || to,
            isFlightLog: saved.isFlightLog ?? isFlightLog,
            isFtdLog: saved.isFtdLog ?? isFtdLog,
            isSolo: saved.isSolo ?? isSolo,
            isDual: saved.isDual ?? isDual,
            duty: saved.duty || duty,
            takeoffTime: saved.takeoffTime || takeoffTime,
            landTime: saved.landTime || landTime,
            captainTime: saved.captainTime != null ? String(saved.captainTime) : captainTime,
            instructorTime: saved.instructorTime != null ? String(saved.instructorTime) : instructorTime,
            nightTime: saved.nightTime != null ? String(saved.nightTime) : nightTime,
            ifActualTime: saved.ifActualTime != null ? String(saved.ifActualTime) : ifActualTime,
            ifSimTime: saved.ifSimTime != null ? String(saved.ifSimTime) : ifSimTime,
            ineffectiveTime: saved.ineffectiveTime != null ? String(saved.ineffectiveTime) : ineffectiveTime,
            ilsChecked: Number(approaches.ils || 0) > 0,
            ilsCount: Number(approaches.ils || 0),
            rnpChecked: Number(approaches.rnp || 0) > 0,
            rnpCount: Number(approaches.rnp || 0),
            tacanChecked: Number(approaches.tacan || 0) > 0,
            tacanCount: Number(approaches.tacan || 0),
            vorChecked: Number(approaches.vor || 0) > 0,
            vorCount: Number(approaches.vor || 0),
            approachAssignments: saved.approachAssignments || approachAssignments,
            currencyValues: saved.currencyUpdates || saved.currencyValues || currencyValues,
        };
        setIsDirty(false);
        setSaveStatus('Saved');
        console.log(`[PostFlight] Restored saved form snapshot from ${source}:`, saved);
    }

    const handleCaptLogChange = (key: string, value: string) => {
        setCaptLogTouched(prev => new Set(prev).add(key));
        setCaptLogOverride(prev => ({ ...prev, [key]: value }));
    };
    const handleCrewLogChange = (key: string, value: string) => {
        setCrewLogTouched(prev => new Set(prev).add(key));
        setCrewLogOverride(prev => ({ ...prev, [key]: value }));
    };

    // Auto-sync TIMES fields → logbook override state (only untouched fields)
    useEffect(() => {
        const capt = getLogbookData('Captain', event.instructor || event.pilot);
        setCaptLogOverride(prev => {
            const next = { ...prev };
            (Object.keys(capt) as string[]).forEach(k => {
                if (!captLogTouched.has(k)) next[k] = String((capt as any)[k] ?? '');
            });
            return next;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalTime, effectiveNightTime, ifActualTime, ifSimTime, captainTime, instructorTime,
        isFlightLog, isFtdLog, isSolo, isDual,
        ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount,
        aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings, duty, approachAssignments]);

    useEffect(() => {
        const crew = getLogbookData('Crew', event.student);
        setCrewLogOverride(prev => {
            const next = { ...prev };
            (Object.keys(crew) as string[]).forEach(k => {
                if (!crewLogTouched.has(k)) next[k] = String((crew as any)[k] ?? '');
            });
            return next;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalTime, effectiveNightTime, ifActualTime, ifSimTime, captainTime, instructorTime,
        isFlightLog, isFtdLog, isSolo, isDual,
        ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount,
        aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings, duty, approachAssignments]);

    // --- LOGBOOK CALCULATION LOGIC ---
    const getLogbookData = (role: 'Captain' | 'Crew' | 'P2' | 'FixedCrewCrew' = 'Crew', pilotKey?: string) => {
        const total = parseFloat(totalTime) || 0;
        const ifActual = parseFloat(ifActualTime) || 0;
        const ifSim = parseFloat(ifSimTime) || 0;

        const assignedRnp = rnpChecked && isApproachAssignedToPilot('rnp', pilotKey) ? rnpCount : 0;
        const assignedTacan = tacanChecked && isApproachAssignedToPilot('tacan', pilotKey) ? tacanCount : 0;
        const assignedVor = vorChecked && isApproachAssignedToPilot('vor', pilotKey) ? vorCount : 0;
        const assignedIls = ilsChecked && isApproachAssignedToPilot('ils', pilotKey) ? ilsCount : 0;
        const app2D = assignedRnp + assignedTacan + assignedVor;
        const app3D = assignedIls;

        // Time variables
        let dayP1 = 0;
        let dayP2 = 0;
        let dayDual = 0;
        let nightP1 = 0;
        let nightP2 = 0;
        let nightDual = 0;

        let simP1 = 0;
        let simDual = 0;
        let simTotal = 0;

        let logCaptTime = '';
        let logInstTime = '';
        const isPilotLogbookRole = role === 'Captain' || role === 'P2' || role === 'Crew';

        // Variable for the main "TOTAL" column (Flight Time)
        let flightTotal = 0;

        if (isFlightLog) {
            if (role === 'Crew' && isSolo) {
                // If it's a Solo flight, the "Crew" row should be empty (no time credited)
                flightTotal = 0;
            } else {
                flightTotal = total;
                const night = parseFloat(effectiveNightTime) || 0;
                const day = Math.max(0, total - night);

                if (role === 'Captain') {
                    // Captain logs P1 in both Solo (Pilot) and Dual (Instructor) scenarios for flights
                    dayP1 = day;
                    nightP1 = night;
                    logCaptTime = captainTime || (isDual ? totalTime : '');
                    if (isDual) {
                        logInstTime = instructorTime || totalTime;
                    }
                } else if (role === 'P2') {
                    dayP2 = day;
                    nightP2 = night;
                } else if (role === 'Crew') {
                    // Crew (Student) logs Dual in Dual scenarios
                    if (isDual) {
                        dayDual = day;
                        nightDual = night;
                    }
                }
            }
        } else if (isFtdLog) {
            if (role === 'Crew' && isSolo) {
                 simTotal = 0;
            } else {
                simTotal = total;
                if (role === 'Captain') {
                    // Instructor: Gets Total in Instructor Box and Simulator Total
                    logInstTime = totalTime;
                } else if (role === 'Crew') {
                    // Student: Gets Simulator Dual and Total
                    simDual = total;
                }
            }
        }

        // Parsing Date
        const dateObj = new Date(event.date);
        const yearStr = dateObj.getFullYear().toString();
        const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

        // Personnel Names
        const captainName = isFixedCrewLogbookPreview
            ? formatLogbookPersonName(event.fixedCrewPic || event.pilot || event.instructor)
            : formatLogbookPersonName(event.instructor || event.pilot);
        const crewName = isFixedCrewLogbookPreview
            ? fixedCrewCoPilotNames.map(formatLogbookPersonName).join(', ')
            : event.student?.split(' – ')[0]?.split(',')[0] || (isSolo ? 'Solo' : '');

        return {
            year: yearStr,
            date: dateStr,
            type: isFtdLog ? resourceDisplayNames.ftd : resourceDisplayNames.aircraft,
            tail: isFtdLog ? `FTD-${aircraftNumber}` : formatAircraftNumber(aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings),
            captain: captainName,
            crew: crewName,
            duty: duty,
            dayP1: dayP1 > 0 ? dayP1.toFixed(1) : '',
            dayP2: dayP2 > 0 ? dayP2.toFixed(1) : '',
            dayDual: dayDual > 0 ? dayDual.toFixed(1) : '',
            nightP1: nightP1 > 0 ? nightP1.toFixed(1) : '',
            nightP2: nightP2 > 0 ? nightP2.toFixed(1) : '',
            nightDual: nightDual > 0 ? nightDual.toFixed(1) : '',
            total: flightTotal > 0 ? flightTotal.toFixed(1) : '',
            captTime: logCaptTime,
            instTime: logInstTime,
            simActual: isPilotLogbookRole && ifActual > 0 ? ifActual.toFixed(1) : '',
            simIf: isPilotLogbookRole && ifSim > 0 ? ifSim.toFixed(1) : '',
            app2D: isPilotLogbookRole && app2D > 0 ? app2D : '',
            app3D: isPilotLogbookRole && app3D > 0 ? app3D : '',
            simP1: simP1 > 0 ? simP1.toFixed(1) : '',
            simP2: '',
            simDual: simDual > 0 ? simDual.toFixed(1) : '',
            simTotal: simTotal > 0 ? simTotal.toFixed(1) : '',
        };
    };
    const fixedCrewPreviewRows = isFixedCrewLogbookPreview
        ? fixedCrewLogbookPreviewRoster.map(staff => {
            const isPic = normalisePostFlightName(staff.name) === fixedCrewPicName;
            const isP2 = !isPic && isPilotStaff(staff);
            return {
                title: formatLogbookPersonName(staff.name),
                data: getLogbookData(isPic ? 'Captain' : isP2 ? 'P2' : 'FixedCrewCrew', staff.name),
            };
        })
        : [];


    // Determine if any data has changed
    useEffect(() => {
        if (!initialFormState.current) return;

        const currentState = {
            result, aircraftNumber, aircraftNumberPrefix, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount: ilsChecked ? ilsCount : 0, rnpChecked, rnpCount: rnpChecked ? rnpCount : 0, tacanChecked, tacanCount: tacanChecked ? tacanCount : 0, vorChecked, vorCount: vorChecked ? vorCount : 0, approachAssignments, currencyValues,
        };
        const initialStateForCompare = {
            ...initialFormState.current,
            ilsCount: initialFormState.current.ilsChecked ? initialFormState.current.ilsCount : 0,
            rnpCount: initialFormState.current.rnpChecked ? initialFormState.current.rnpCount : 0,
            tacanCount: initialFormState.current.tacanChecked ? initialFormState.current.tacanCount : 0,
            vorCount: initialFormState.current.vorChecked ? initialFormState.current.vorCount : 0,
        };

        if (JSON.stringify(currentState) !== JSON.stringify(initialStateForCompare)) {
            setIsDirty(true);
            setSaveStatus('Saving...');
        }
    }, [result, aircraftNumber, aircraftNumberPrefix, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount, approachAssignments, currencyValues]);

    const aircraftNumberOptions = useMemo(() => Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0')), []);

    // Debounced field change handler for result
    const handleResultChange = (newResult: 'DCO' | 'DPCO' | 'DNCO' | '') => {
        const oldResult = result;
        setResult(newResult);
        if (oldResult && newResult && oldResult !== newResult) {
            debouncedAuditLog(
                `postflight-${event.id}-result`,
                'Edit',
                `Updated post-flight result for ${event.flightNumber}`,
                `Result: ${oldResult} → ${newResult}`,
                'Post-Flight'
            );
        }
    };

    const handleSave = async (isAutoSave = false) => {
        // System freeze check - read directly from localStorage to avoid stale closure
        const _freezeRaw = localStorage.getItem('systemFreezeState');
        if (_freezeRaw) {
            const _freeze = JSON.parse(_freezeRaw);
            if (_freeze.isFrozen && !_freeze.allowedActions?.postFlightTimes) {
                await showDarkAlert('System is currently frozen. Post Flight Times entries are not permitted during a system freeze.', 'System Frozen', 'error');
                return;
            }
        }
        const saveData = {
            result,
            aircraftNumber: formatAircraftNumber(aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings),
            from,
            to,
            isFlightLog,
            isFtdLog,
            isSolo,
            isDual,
            duty,
            takeoffTime,
            landTime,
            totalTime,
            captainTime,
            instructorTime,
            nightTime: effectiveNightTime,
            ifActualTime,
            ifSimTime,
            ineffectiveTime,
            approaches: {
                ils: ilsChecked ? ilsCount : 0,
                rnp: rnpChecked ? rnpCount : 0,
                tacan: tacanChecked ? tacanCount : 0,
                vor: vorChecked ? vorCount : 0,
            },
            approachAssignments: {
                ils: getApproachAssignedPilotKey('ils'),
                rnp: getApproachAssignedPilotKey('rnp'),
                tacan: getApproachAssignedPilotKey('tacan'),
                vor: getApproachAssignedPilotKey('vor'),
            },
            // Currency updates from post-flight panel
            currencyUpdates: Object.keys(currencyValues).length > 0 ? currencyValues : undefined,
            // Logbook cell overrides (auto-filled from TIMES but user can override)
            captainLog: captLogOverride,
            crewLog: crewLogOverride,
        };

        // Flush any pending debounced logs before saving
        if (!isAutoSave) {
            flushPendingAudits();

            // Log the save action
            const changes: string[] = [];
            changes.push(`Result: ${result}`);
            if (takeoffTime) changes.push(`Takeoff: ${takeoffTime}`);
            if (landTime) changes.push(`Land: ${landTime}`);
            if (totalTime) changes.push(`Total Time: ${totalTime}`);

            logAudit({
                action: 'Edit',
                description: `Saved post-flight data for ${event.flightNumber}`,
                changes: changes.join(', '),
                page: 'Post-Flight'
            });
        }

        // 1. Notify parent (updates app state)
        // Only notify parent if NOT auto-saving, because parent closes the view.
        if (!isAutoSave) {
            try {
                const saveResult = await onSave(saveData);
                if (saveResult === false) return;
            } catch (error) {
                console.error('[PostFlight] Save failed:', error);
                await showDarkAlert(`Post-flight data could not be saved.\n\n${error instanceof Error ? error.message : String(error)}`, 'Post Flight Save Failed', 'error');
                return;
            }
        }

        try {
            const storageKey = getPostFlightFormStorageKey(event.id);
            if (storageKey) {
                localStorage.setItem(storageKey, JSON.stringify({
                    ...saveData,
                    savedAt: new Date().toISOString(),
                }));
            }
        } catch (snapshotErr) {
            console.warn('[PostFlight] Could not save form snapshot:', snapshotErr);
        }

        // 2. Persist to Data Storage (Auto-Save to File)
        // Determine the "User File" location.
        // Priority: Student (for dual/solo trainee events), then Instructor.
        let targetFolderId = 'trainee_logbook';
        let userName = event.student;

        if (!userName || userName === 'Multiple') {
             if (event.pilot) {
                 userName = event.pilot; // Solo trainee or pilot
             } else if (event.instructor) {
                 userName = event.instructor; // Instructor only event
                 targetFolderId = 'staff_logbook';
             }
        }

        if (userName) {
            const cleanName = userName.split(' – ')[0].replace(/,\s/g, '_');
            // Deterministic filename to overwrite the same entry during edits
            const fileName = `Entry_${event.date}_${event.flightNumber.replace(/\s/g, '')}_${cleanName}.json`;

            try {
                const fileContent = JSON.stringify(saveData, null, 2);
                const file = new File([fileContent], fileName, { type: "application/json" });
                await addFile(file, targetFolderId, fileName);
            } catch (error) {
                console.error("Failed to auto-save post-flight data to file:", error);
            }
        }

        if (!isAutoSave) {
            setIsDirty(false);
            setSaveStatus('Saved');
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (isDirty) {
            const timer = setTimeout(() => {
                handleSave(true);
                setSaveStatus('Saved');
                setIsDirty(false); // Reset dirty after auto-save
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isDirty, result, aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount, currencyValues]);

    const handleAttemptReturn = () => {
        if (isDirty) {
            setShowUnsavedWarning(true);
        } else {
            onReturn();
        }
    };

    const handleManualSave = () => {
        handleSave(false);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 4) val = val.substring(0, 4);

        if (val.length > 2) {
            val = val.slice(0, 2) + ':' + val.slice(2);
        }
        setter(val);
    };

    const handleFlightLogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setIsFlightLog(true);
            setIsFtdLog(false);
        }
    };

    const handleFtdLogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setIsFtdLog(true);
            setIsFlightLog(false);
        }
    };

    const handleSoloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsSolo(checked);
        setIsDual(!checked);
    };

    const handleDualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsDual(checked);
        setIsSolo(!checked);
    };

    const ResultRadio: React.FC<{ value: string }> = ({ value }) => (
        <label className="flex items-center space-x-2 cursor-pointer">
            <input
                type="radio"
                name="result"
                value={value}
                checked={result === value}
                onChange={(e) => handleResultChange(e.target.value as any)}
                className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
            />
            <span className="text-white">{value}</span>
        </label>
    );

    const ApproachInput: React.FC<{
        kind: 'ils' | 'rnp' | 'tacan' | 'vor',
        label: string,
        isChecked: boolean,
        setIsChecked: (val: boolean) => void,
        count: number,
        setCount: (val: number) => void
    }> = ({ kind, label, isChecked, setIsChecked, count, setCount }) => (
        <div className="flex-shrink-0 flex items-end space-x-2 rounded-md border border-gray-700/70 bg-gray-900/20 px-2 py-1">
            <label className="flex items-center space-x-1 cursor-pointer h-[38px]">
                <span className="text-sm font-medium text-gray-400 w-12 text-right">{label}</span>
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => {
                        const checked = e.target.checked;
                        setIsChecked(checked);
                        if (checked && count === 0) {
                            setCount(1);
                        }
                    }}
                    className="h-4 w-4 accent-sky-500 bg-gray-600 rounded border-gray-500"
                />
            </label>
            <div className="flex flex-col items-center">
                <label className="text-xs font-medium text-gray-400 mb-1">Number</label>
                <div className="relative w-10 h-[38px]">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={count === 0 ? '' : count}
                        onChange={e => setCount(parseInt(e.target.value, 10) || 0)}
                        disabled={!isChecked}
                        className="block w-10 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 pl-1 pr-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                    />
                    <div className="absolute right-0.5 top-0.5 bottom-0.5 flex flex-col justify-center gap-px">
                        <button
                            type="button"
                            onClick={() => {
                                setIsChecked(true);
                                setCount(Math.max(1, count + 1));
                            }}
                            className="h-[16px] w-3 rounded-sm bg-gray-600/80 text-[8px] leading-none text-gray-100 hover:bg-gray-500"
                            aria-label={`Increase ${label} approaches`}
                        >
                            ▲
                        </button>
                        <button
                            type="button"
                            disabled={!isChecked || count <= 0}
                            onClick={() => {
                                const next = Math.max(0, count - 1);
                                setCount(next);
                                if (next === 0) setIsChecked(false);
                            }}
                            className="h-[16px] w-3 rounded-sm bg-gray-600/80 text-[8px] leading-none text-gray-100 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600"
                            aria-label={`Decrease ${label} approaches`}
                        >
                            ▼
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex w-[92px] flex-col gap-0.5 pb-1">
                {pilotLogbookOptions.map(option => (
                    <label key={`${kind}-${option.key}`} className="flex items-center gap-1 text-[9px] leading-tight text-gray-300">
                        <input
                            type="radio"
                            name={`approach-${kind}-pilot`}
                            checked={getApproachAssignedPilotKey(kind) === option.key}
                            onChange={() => setApproachAssignments(prev => ({ ...prev, [kind]: option.key }))}
                            className="h-2.5 w-2.5 accent-sky-500"
                        />
                        <span className="max-w-[76px] truncate">{option.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    // Reusable Cell for Logbook Row
    const LogbookCell: React.FC<{ label?: string, subLabel?: string, value: string, width: string, bgColor?: string, borderColor?: string, customTextClass?: string }> = ({ label, subLabel, value, width, bgColor = "bg-gray-800", borderColor = "border-gray-600", customTextClass = "text-xs" }) => (
        <div className={`flex flex-col items-center justify-end ${width} flex-shrink-0 border-r ${borderColor} last:border-r-0`}>
             {(label || subLabel) && (
                 <div className="w-full text-center border-b border-gray-700 bg-gray-900/30 py-0.5">
                    {label && <div className="text-[9px] font-bold text-gray-400 uppercase leading-tight">{label}</div>}
                    {subLabel && <div className="text-[8px] text-gray-500 leading-tight">{subLabel}</div>}
                 </div>
             )}
            <div className={`w-full ${bgColor} text-white ${customTextClass} font-mono py-1.5 text-center truncate px-0.5 h-7`}>
                {value}
            </div>
        </div>
    );

    // Editable version — shows an input that auto-fills from TIMES but allows manual override
    const EditableLogbookCell: React.FC<{
        label?: string; subLabel?: string; fieldKey: string;
        overrides: Record<string, string>; onChange: (key: string, val: string) => void;
        width: string; bgColor?: string; borderColor?: string; readOnly?: boolean;
    }> = ({ label, subLabel, fieldKey, overrides, onChange, width, bgColor = "bg-gray-800", borderColor = "border-gray-600", readOnly = false }) => {
        const value = overrides[fieldKey] ?? '';
        return (
            <div className={`flex flex-col items-center justify-end ${width} flex-shrink-0 border-r ${borderColor} last:border-r-0`}>
                {(label || subLabel) && (
                    <div className="w-full text-center border-b border-gray-700 bg-gray-900/30 py-0.5">
                        {label    && <div className="text-[9px] font-bold text-gray-400 uppercase leading-tight">{label}</div>}
                        {subLabel && <div className="text-[8px] text-gray-500 leading-tight">{subLabel}</div>}
                    </div>
                )}
                {readOnly ? (
                    <div className={`w-full ${bgColor} text-white text-xs font-mono py-1.5 text-center truncate px-0.5 h-7`}>
                        {value}
                    </div>
                ) : (
                    <input
                        type="text"
                        value={value}
                        onChange={e => onChange(fieldKey, e.target.value)}
                        className={`w-full ${bgColor} text-white text-xs font-mono py-0 text-center h-7 border-0 outline-none focus:ring-1 focus:ring-sky-500/60 rounded-none px-0.5`}
                        placeholder="—"
                    />
                )}
            </div>
        );
    };

    // Editable Logbook Strip — uses override state so user can manually change any cell
    const EditableLogbookStrip: React.FC<{
        title: string;
        overrides: Record<string, string>;
        onChange: (key: string, val: string) => void;
    }> = ({ title, overrides, onChange }) => (
        <div className="mt-2">
            <h4 className="text-sm font-bold text-sky-400 mb-1 ml-1">{title}</h4>
            <div className="overflow-x-auto">
                <div className="flex flex-nowrap bg-gray-900 border border-gray-600 rounded-md min-w-max">
                    {/* Identity — read-only (derived from event) */}
                    <EditableLogbookCell label="Year"    fieldKey="year"    overrides={overrides} onChange={onChange} width="w-10" readOnly />
                    <EditableLogbookCell label="Date"    fieldKey="date"    overrides={overrides} onChange={onChange} width="w-14" readOnly />
                    <EditableLogbookCell label="Type"    fieldKey="type"    overrides={overrides} onChange={onChange} width="w-12" readOnly />
                    <EditableLogbookCell label="Tail" subLabel="(Mark)" fieldKey="tail" overrides={overrides} onChange={onChange} width="w-16" readOnly />
                    <EditableLogbookCell label="Captain" fieldKey="captain" overrides={overrides} onChange={onChange} width="w-24" readOnly />
                    <EditableLogbookCell label="Co-Pilot /" subLabel="Crew" fieldKey="crew" overrides={overrides} onChange={onChange} width="w-24" readOnly />
                    <EditableLogbookCell label="Duty"    fieldKey="duty"    overrides={overrides} onChange={onChange} width="w-24" />

                    {/* Day Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Day Flying</div>
                        <div className="flex">
                            <EditableLogbookCell subLabel="P1"   fieldKey="dayP1"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                            <EditableLogbookCell subLabel="P2"   fieldKey="dayP2"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                            <EditableLogbookCell subLabel="Dual" fieldKey="dayDual" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Night Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Night Flying</div>
                        <div className="flex">
                            <EditableLogbookCell subLabel="P1"   fieldKey="nightP1"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                            <EditableLogbookCell subLabel="P2"   fieldKey="nightP2"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                            <EditableLogbookCell subLabel="Dual" fieldKey="nightDual" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Totals */}
                    <EditableLogbookCell label="TOTAL"      fieldKey="total"    overrides={overrides} onChange={onChange} width="w-12" bgColor="bg-gray-700/50" />
                    <EditableLogbookCell label="Captain"    fieldKey="captTime" overrides={overrides} onChange={onChange} width="w-12" />
                    <EditableLogbookCell label="Instructor" fieldKey="instTime" overrides={overrides} onChange={onChange} width="w-12" />

                    {/* Instrument */}
                    <EditableLogbookCell label="Sim"    fieldKey="simIf"     overrides={overrides} onChange={onChange} width="w-10" />
                    <EditableLogbookCell label="Actual" fieldKey="simActual" overrides={overrides} onChange={onChange} width="w-10" />
                    <EditableLogbookCell label="2D App" fieldKey="app2D"     overrides={overrides} onChange={onChange} width="w-10" />
                    <EditableLogbookCell label="3D App" fieldKey="app3D"     overrides={overrides} onChange={onChange} width="w-10" />

                    {/* Simulator */}
                    <div className="flex flex-col">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">{resourceDisplayNames.ftd}</div>
                        <div className="flex">
                            <EditableLogbookCell subLabel="P1"    fieldKey="simP1"    overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <EditableLogbookCell subLabel="P2"    fieldKey="simP2"    overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <EditableLogbookCell subLabel="Dual"  fieldKey="simDual"  overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <EditableLogbookCell subLabel="TOTAL" fieldKey="simTotal" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Reusable Logbook Strip Component (read-only — kept for reference)
    const LogbookStrip: React.FC<{ title: string, data: any }> = ({ title, data }) => (
        <div className="mt-2">
            <h4 className="text-sm font-bold text-sky-400 mb-1 ml-1">{title}</h4>
            <div className="overflow-x-auto">
                <div className="flex flex-nowrap bg-gray-900 border border-gray-600 rounded-md min-w-max">
                    {/* Identity */}
                    <LogbookCell label="Year" value={data.year} width="w-10" />
                    <LogbookCell label="Date" value={data.date} width="w-14" />
                    <LogbookCell label="Type" value={data.type} width="w-12" />
                    <LogbookCell label="Tail" subLabel="(Mark)" value={data.tail} width="w-16" />
                    <LogbookCell label="Captain" value={data.captain} width="w-[121px]" />
                    <LogbookCell label="Co-Pilot /" subLabel="Crew" value={data.crew} width="w-[121px]" />
                    <LogbookCell label="Duty" value={data.duty} width="w-[121px]" customTextClass="text-[8px]" />

                    {/* Day Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Day Flying</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.dayP1} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="P2" value={data.dayP2} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="Dual" value={data.dayDual} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Night Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Night Flying</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.nightP1} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="P2" value={data.nightP2} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="Dual" value={data.nightDual} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Totals */}
                    <LogbookCell label="TOTAL" value={data.total} width="w-12" bgColor="bg-gray-700/50" />
                    <LogbookCell label="Captain" value={data.captTime} width="w-12" />
                    <LogbookCell label="Instructor" value={data.instTime} width="w-12" />

                    {/* Instrument */}
                    <LogbookCell label="Sim" value={data.simIf ?? ''} width="w-10" />
                    <LogbookCell label="Actual" value={data.simActual} width="w-10" />
                    <LogbookCell label="2D App" value={String(data.app2D)} width="w-10" />
                    <LogbookCell label="3D App" value={String(data.app3D)} width="w-10" />

                    {/* Simulator */}
                    <div className="flex flex-col">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">{resourceDisplayNames.ftd}</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.simP1} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="P2" value={data.simP2} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="Dual" value={data.simDual} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="TOTAL" value={data.simTotal} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Data-only row for the merged logbook table (no column headers — shared header row above)
    const EditableLogbookRow: React.FC<{
        title: string;
        overrides: Record<string, string>;
        onChange: (key: string, val: string) => void;
    }> = ({ title, overrides, onChange }) => (
        <div className="flex flex-nowrap min-w-max border-t border-gray-700">
            {/* Row label */}
            <div className="flex w-[100px] flex-shrink-0 items-center justify-center border-r border-gray-600 bg-gray-800/60 px-1">
                <span className="text-[8px] font-bold text-sky-400 text-center leading-tight truncate w-full text-center">{title}</span>
            </div>
            {/* Identity */}
            <EditableLogbookCell fieldKey="year"    overrides={overrides} onChange={onChange} width="w-10" readOnly />
            <EditableLogbookCell fieldKey="date"    overrides={overrides} onChange={onChange} width="w-14" readOnly />
            <EditableLogbookCell fieldKey="type"    overrides={overrides} onChange={onChange} width="w-12" readOnly />
            <EditableLogbookCell fieldKey="tail"    overrides={overrides} onChange={onChange} width="w-16" readOnly />
            <EditableLogbookCell fieldKey="captain" overrides={overrides} onChange={onChange} width="w-[121px]" readOnly />
            <EditableLogbookCell fieldKey="crew"    overrides={overrides} onChange={onChange} width="w-[121px]" readOnly />
            <EditableLogbookCell fieldKey="duty"    overrides={overrides} onChange={onChange} width="w-[121px]" />
            {/* Day Flying */}
            <div className="flex flex-col border-r border-gray-600">
                <div className="flex">
                    <EditableLogbookCell fieldKey="dayP1"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                    <EditableLogbookCell fieldKey="dayP2"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                    <EditableLogbookCell fieldKey="dayDual" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" />
                </div>
            </div>
            {/* Night Flying */}
            <div className="flex flex-col border-r border-gray-600">
                <div className="flex">
                    <EditableLogbookCell fieldKey="nightP1"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                    <EditableLogbookCell fieldKey="nightP2"   overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" />
                    <EditableLogbookCell fieldKey="nightDual" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" />
                </div>
            </div>
            {/* Totals */}
            <EditableLogbookCell fieldKey="total"    overrides={overrides} onChange={onChange} width="w-12" bgColor="bg-gray-700/50" />
            <EditableLogbookCell fieldKey="captTime" overrides={overrides} onChange={onChange} width="w-12" />
            <EditableLogbookCell fieldKey="instTime" overrides={overrides} onChange={onChange} width="w-12" />
            {/* Instrument */}
            <EditableLogbookCell fieldKey="simIf"     overrides={overrides} onChange={onChange} width="w-10" />
            <EditableLogbookCell fieldKey="simActual" overrides={overrides} onChange={onChange} width="w-10" />
            <EditableLogbookCell fieldKey="app2D"     overrides={overrides} onChange={onChange} width="w-10" />
            <EditableLogbookCell fieldKey="app3D"     overrides={overrides} onChange={onChange} width="w-10" />
            {/* Simulator */}
            <div className="flex flex-col">
                <div className="flex">
                    <EditableLogbookCell fieldKey="simP1"    overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                    <EditableLogbookCell fieldKey="simP2"    overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                    <EditableLogbookCell fieldKey="simDual"  overrides={overrides} onChange={onChange} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                    <EditableLogbookCell fieldKey="simTotal" overrides={overrides} onChange={onChange} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col bg-gray-900 h-full">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div className="flex items-center gap-4 w-1/3">
                    <span className="font-bold text-white text-lg">{event.flightNumber}</span>
                    <div className="flex items-center px-3 py-1 rounded-full bg-gray-900/50 border border-gray-700">
                        <div className={`w-2 h-2 rounded-full mr-2 ${saveStatus === 'Saved' ? 'bg-green-500' : saveStatus === 'Saving...' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-gray-300 font-mono uppercase">{saveStatus === 'Saved' ? 'Saved' : saveStatus}</span>
                    </div>
                </div>
                <h2 className="text-xl font-bold text-sky-400 text-center w-1/3">POST FLIGHT TIMES</h2>
                <span className="font-mono text-gray-300 text-lg w-1/3 text-right">{event.date}</span>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto min-h-0 relative">
              {freezeState.isFrozen && !freezeState.allowedActions.postFlightTimes && (
                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
              )}
              <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
                {/* Top Section */}
                <div className="flex items-start gap-6">
                    {/* Result (Left) — subtle blue hue outline */}
                    <div className="flex-shrink-0 bg-gray-700/50 p-4 rounded-lg border border-sky-500/40 ring-1 ring-sky-500/20 self-stretch flex flex-col justify-center">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Result</label>
                        <div className="flex flex-col space-y-3">
                            <ResultRadio value="DCO" />
                            <ResultRadio value="DPCO" />
                            <ResultRadio value="DNCO" />
                        </div>
                    </div>

                    {/* Currency Updates Panel (Right of Result) */}
                    {postFlightCurrencies.length > 0 && (() => {
                        const flightDate = event.date ?? new Date().toISOString().slice(0, 10);
                        const rows: { c: CurrencyDefinition; inputType: PostFlightInputType; fieldKey: string }[] = [];
                        postFlightCurrencies.forEach(c => {
                            const inputTypes = getEffectiveInputTypes(c);
                            inputTypes.forEach(inputType => {
                                const fieldKey = inputTypes.length > 1 ? `${c.id}__${inputType}` : c.id;
                                rows.push({ c, inputType, fieldKey });
                            });
                        });
                        const CURRENCY_COLUMNS = 3;
                        const rowsPerColumn = Math.max(1, Math.ceil(rows.length / CURRENCY_COLUMNS));
                        return (
                            <div className="flex-1 min-h-[9.5rem] bg-gray-700/50 px-3 py-3 rounded border border-gray-600/50 min-w-0 self-stretch flex flex-col">
                                <p className="text-sm font-medium text-sky-400 mb-3 leading-none">Currencies</p>
                                <div
                                    className="grid gap-x-4 gap-y-2"
                                    style={{
                                        gridTemplateRows: `repeat(${rowsPerColumn}, auto)`,
                                        gridTemplateColumns: `repeat(${CURRENCY_COLUMNS}, minmax(0, 1fr))`,
                                        gridAutoFlow: 'column',
                                    }}
                                >
                                    {rows.map(({ c, inputType, fieldKey }) => {
                                        const val = currencyValues[fieldKey] ?? '';
                                        if (inputType === 'checkbox') {
                                            const isChecked = val !== '' && val !== 'false';
                                            return (
                                                <label key={fieldKey} className="flex items-center gap-1.5 cursor-pointer min-w-0 h-[22px]">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={e => handleCurrencyChange(fieldKey, e.target.checked ? flightDate : '')}
                                                        className="h-3.5 w-3.5 flex-shrink-0 rounded accent-sky-500 cursor-pointer"
                                                        title={isChecked ? `Recorded: ${val}` : 'Flight date recorded on tick'}
                                                    />
                                                    <span className="text-sm text-white leading-none truncate" title={c.name}>{c.name}</span>
                                                </label>
                                            );
                                        }
                                        if (inputType === 'date') {
                                            return (
                                                <label key={fieldKey} className="flex items-center gap-1.5 min-w-0 h-[22px]">
                                                    <span className="text-sm text-white leading-none truncate flex-1 min-w-0" title={c.name}>{c.name}</span>
                                                    <input
                                                        type="date"
                                                        value={val}
                                                        onChange={e => handleCurrencyChange(fieldKey, e.target.value)}
                                                        className="w-[112px] flex-shrink-0 bg-gray-700 border border-gray-600 rounded h-[22px] py-0 px-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                                        style={{ colorScheme: 'dark' }}
                                                        title="Date last completed"
                                                    />
                                                </label>
                                            );
                                        }
                                        if (inputType === 'count') {
                                            return (
                                                <label key={fieldKey} className="flex items-center gap-1.5 min-w-0 h-[22px]">
                                                    <span className="text-sm text-white leading-none truncate flex-1 min-w-0" title={c.name}>{c.name}</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={val}
                                                        onChange={e => handleCurrencyChange(fieldKey, e.target.value)}
                                                        placeholder="0"
                                                        className="w-10 flex-shrink-0 bg-gray-700 border border-gray-600 rounded h-[22px] py-0 px-1 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                                        title="Count completed today"
                                                    />
                                                </label>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {postFlightRecencyItems.length > 0 && (
                        <div className="flex-[0_0_24rem] max-w-[26rem] min-h-[9.5rem] bg-gray-700/50 px-3 py-3 rounded border border-emerald-600/40 self-stretch flex flex-col">
                            <p className="text-sm font-medium text-emerald-300 mb-3 leading-none">Recency</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {postFlightRecencyItems.map(item => {
                                    const flightDate = event.date ?? new Date().toISOString().slice(0, 10);
                                    const isChecked = !!currencyValues[item.id];
                                    return (
                                        <label
                                            key={item.id}
                                            className={`flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded border px-2 text-xs font-semibold cursor-pointer transition-colors ${
                                                isChecked
                                                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-50'
                                                    : 'border-gray-600 bg-gray-800/70 text-gray-200 hover:border-emerald-400/60'
                                            }`}
                                            title={item.name}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={e => handleCurrencyChange(item.id, e.target.checked ? flightDate : '')}
                                                className="h-3.5 w-3.5 flex-shrink-0 rounded accent-emerald-500 cursor-pointer"
                                            />
                                            <span className="truncate">{item.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main "Times" Window */}
                <fieldset className="p-4 border border-gray-600 rounded-lg">
                    <legend className="px-2 text-lg font-semibold text-gray-300">Times</legend>

                    {/* Row 1: Flight, FTD, Date, AC, Number, Duty, Captain, Crew */}
                    <div className="mt-2 flex items-end space-x-4">

                        {/* Flight Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">Flight</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isFlightLog}
                                    onChange={handleFlightLogChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {/* Simulator Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">{resourceDisplayNames.ftd}</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isFtdLog}
                                    onChange={handleFtdLogChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {!isFixedCrewLogbookPreview && (
                            <>
                                {/* Solo Checkbox */}
                                <div className="flex-shrink-0 flex flex-col items-center">
                                    <label className="block text-sm font-medium text-gray-400">Solo</label>
                                    <div className="mt-1 h-[38px] flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={isSolo}
                                            onChange={handleSoloChange}
                                            className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                        />
                                    </div>
                                </div>

                                {/* Dual Checkbox */}
                                <div className="flex-shrink-0 flex flex-col items-center">
                                    <label className="block text-sm font-medium text-gray-400">Dual</label>
                                    <div className="mt-1 h-[38px] flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={isDual}
                                            onChange={handleDualChange}
                                            className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Date */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Date</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center">{event.date}</div>
                        </div>
                        {/* Aircraft */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Aircraft</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center">{resourceDisplayNames.aircraft}</div>
                        </div>
                         {/* Number */}
                        <div className="flex-shrink-0" style={{width: 'calc(6.75rem + 10px)'}}>
                            <label className="block text-sm font-medium text-gray-400">Number</label>
                            <div className="flex items-center space-x-1 mt-1">
                                {aircraftNumberSettings.usePrefix && (
                                    <select
                                        value={aircraftNumberPrefix}
                                        onChange={e => setAircraftNumberPrefix(e.target.value)}
                                        className="block w-20 bg-gray-700 border border-gray-600 rounded-l-md h-[38px] py-2 px-2 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                                    >
                                        {aircraftNumberSettings.prefixes.map(prefix => <option key={prefix} value={prefix}>{prefix}</option>)}
                                    </select>
                                )}
                                <input
                                    type="text"
                                    value={aircraftNumber}
                                    onChange={e => setAircraftNumber(e.target.value.toUpperCase())}
                                    list="aircraft-number-options"
                                    className={`block w-full bg-gray-700 border border-gray-600 ${aircraftNumberSettings.usePrefix ? 'rounded-r-md' : 'rounded-md'} h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center`}
                                />
                                <datalist id="aircraft-number-options">
                                    {aircraftNumberOptions.map(num => <option key={num} value={num} />)}
                                </datalist>
                            </div>
                        </div>

                        {/* Duty (New) */}
                        <div className="flex-shrink-0" style={{width: '12rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Duty</label>
                            <input
                                type="text"
                                value={duty}
                                onChange={e => setDuty(e.target.value)}
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white text-xs focus:outline-none focus:ring-sky-500"
                            />
                        </div>

                        {/* Captain/Instructor */}
                        <div className="flex-shrink-0" style={{width: '12rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Captain/Instructor</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">{(event.instructor || event.pilot)?.split(' – ')[0]}</div>
                        </div>
                        {/* Crew */}
                        <div className="flex-shrink-0" style={{width: '12rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Crew/Trainee</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">
                                {isSolo ? 'Solo' : event.student?.split(' – ')[0]}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Route, Takeoff, Land, Total, Night, IF Actual, IF Sim, Ineffective */}
                    <div className="mt-4 flex items-end space-x-4 overflow-x-auto pb-2">
                        {/* Route */}
                         <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400 text-center">Route</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input type="text" value={from} onChange={e => setFrom(e.target.value.toUpperCase())} maxLength={3} placeholder="From" className="w-16 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-2 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                                <input type="text" value={to} onChange={e => setTo(e.target.value.toUpperCase())} maxLength={3} placeholder="To" className="w-16 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                            </div>
                         </div>
                        {/* Takeoff Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Takeoff</label>
                            <input
                                type="text"
                                value={takeoffTime}
                                onChange={e => handleTimeChange(e, setTakeoffTime)}
                                placeholder="HH:MM"
                                className="mt-1 block w-24 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Land Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Land</label>
                            <input
                                type="text"
                                value={landTime}
                                onChange={e => handleTimeChange(e, setLandTime)}
                                placeholder="HH:MM"
                                className="mt-1 block w-24 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Total Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Total</label>
                            <div className="mt-1 p-2 bg-gray-900/50 border border-gray-500 rounded-md text-white h-[38px] flex items-center justify-center font-mono w-20">{totalTime}</div>
                        </div>
                         {/* Captain Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Captain</label>
                            <input
                                type="text"
                                value={captainTime}
                                onChange={e => setCaptainTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                         {/* Instructor Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Instructor</label>
                            <input
                                type="text"
                                value={instructorTime}
                                onChange={e => setInstructorTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                         {/* Night Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Night</label>
                            <input
                                type="text"
                                value={effectiveNightTime}
                                onChange={e => setNightTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* IF Actual Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">IF Actual</label>
                            <input
                                type="text"
                                value={ifActualTime}
                                onChange={e => setIfActualTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* IF Sim Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">IF Sim</label>
                            <input
                                type="text"
                                value={ifSimTime}
                                onChange={e => setIfSimTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Ineffective Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Ineffective</label>
                            <input
                                type="text"
                                value={ineffectiveTime}
                                onChange={e => setIneffectiveTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>

                    </div>
                    {/* Row 3: Approach counts and pilot assignment */}
                    <div className="mt-2 flex items-end gap-2 overflow-x-auto pb-1">
                        <ApproachInput kind="ils" label="ILS/GLS" isChecked={ilsChecked} setIsChecked={setIlsChecked} count={ilsCount} setCount={setIlsCount} />
                        <ApproachInput kind="tacan" label="TACAN" isChecked={tacanChecked} setIsChecked={setTacanChecked} count={tacanCount} setCount={setTacanCount} />
                        <ApproachInput kind="rnp" label="RNP" isChecked={rnpChecked} setIsChecked={setRnpChecked} count={rnpCount} setCount={setRnpCount} />
                        <ApproachInput kind="vor" label="VOR/DME" isChecked={vorChecked} setIsChecked={setVorChecked} count={vorCount} setCount={setVorCount} />
                    </div>
                </fieldset>

                {/* Logbook — single table, one shared header, one row per person */}
                <div className="mt-2">
                    <div className="overflow-x-auto">
                        <div className="flex flex-col bg-gray-900 border border-gray-600 rounded-md min-w-max">
                            {/* Shared header row */}
                            <div className="flex flex-nowrap min-w-max">
                                <div className="w-[100px] flex-shrink-0 border-r border-gray-600 bg-gray-900/30" />
                                <EditableLogbookCell label="Year"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10"  readOnly />
                                <EditableLogbookCell label="Date"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-14"  readOnly />
                                <EditableLogbookCell label="Type"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-12"  readOnly />
                                <EditableLogbookCell label="Tail" subLabel="(Mark)" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-16" readOnly />
                                <EditableLogbookCell label="Captain"  fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-[121px]"  readOnly />
                                <EditableLogbookCell label="Co-Pilot /" subLabel="Crew" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-[121px]" readOnly />
                                <EditableLogbookCell label="Duty"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-[121px]"  readOnly />
                                <div className="flex flex-col border-r border-gray-600">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Day Flying</div>
                                    <div className="flex">
                                        <EditableLogbookCell subLabel="P1"   fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" readOnly />
                                        <EditableLogbookCell subLabel="P2"   fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" readOnly />
                                        <EditableLogbookCell subLabel="Dual" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-transparent" readOnly />
                                    </div>
                                </div>
                                <div className="flex flex-col border-r border-gray-600">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Night Flying</div>
                                    <div className="flex">
                                        <EditableLogbookCell subLabel="P1"   fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" readOnly />
                                        <EditableLogbookCell subLabel="P2"   fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" readOnly />
                                        <EditableLogbookCell subLabel="Dual" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-transparent" readOnly />
                                    </div>
                                </div>
                                <EditableLogbookCell label="TOTAL"      fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-12" bgColor="bg-gray-700/50" readOnly />
                                <EditableLogbookCell label="Captain"    fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-12" readOnly />
                                <EditableLogbookCell label="Instructor" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-12" readOnly />
                                <EditableLogbookCell label="Sim"        fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" readOnly />
                                <EditableLogbookCell label="Actual"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" readOnly />
                                <EditableLogbookCell label="2D App"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" readOnly />
                                <EditableLogbookCell label="3D App"     fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" readOnly />
                                <div className="flex flex-col">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">{resourceDisplayNames.ftd}</div>
                                    <div className="flex">
                                        <EditableLogbookCell subLabel="P1"    fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" readOnly />
                                        <EditableLogbookCell subLabel="P2"    fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" readOnly />
                                        <EditableLogbookCell subLabel="Dual"  fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" readOnly />
                                        <EditableLogbookCell subLabel="TOTAL" fieldKey="__hdr__" overrides={{}} onChange={() => {}} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" readOnly />
                                    </div>
                                </div>
                            </div>
                            {/* Data rows — one per person */}
                            {isFixedCrewLogbookPreview ? (
                                fixedCrewPreviewRows.map(row => (
                                    <EditableLogbookRow
                                        key={row.title}
                                        title={row.title}
                                        overrides={row.data}
                                        onChange={() => {}}
                                    />
                                ))
                            ) : (
                                <>
                                    <EditableLogbookRow
                                        title={formatLogbookPersonName(event.instructor || event.pilot)}
                                        overrides={captLogOverride}
                                        onChange={handleCaptLogChange}
                                    />
                                    {!isSolo && (
                                        <EditableLogbookRow
                                            title={formatLogbookPersonName(event.student)}
                                            overrides={crewLogOverride}
                                            onChange={handleCrewLogChange}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end">
                <div className="flex" style={{ gap: '2px' }}>
                    <button
                        onClick={handleManualSave}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed"
                        style={{ borderRadius: '6px' }}
                    >Save</button>
                    <button
                        onClick={handleAttemptReturn}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed"
                        style={{ borderRadius: '6px' }}
                    >Back</button>
                    <AuditButton
                        pageName="Post-Flight"
                        style={{ borderRadius: '6px' }}
                    />
                </div>
            </div>
            {showUnsavedWarning && (
                <UnsavedChangesWarning
                    onSaveAndExit={() => { setShowUnsavedWarning(false); handleManualSave(); onReturn(); }}
                    onExitWithoutSaving={() => { setShowUnsavedWarning(false); onReturn(); }}
                    onCancel={() => setShowUnsavedWarning(false)}
                />
            )}
        </div>
    );
};
