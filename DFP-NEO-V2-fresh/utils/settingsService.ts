/**
 * Settings Service
 * Handles loading and saving all application settings to the database.
 * Settings are persisted org-wide (not per-user) so they survive restarts.
 */

export interface AppSettingsData {
  // Locations & Units
  locations: string[];
  units: string[];
  unitLocations: Record<string, string>;

  // Event Limits
  eventLimits: {
    exec: { maxFlightFtd: number; maxDutySup: number; maxTotal: number };
    instructor: { maxFlightFtd: number; maxDutySup: number; maxTotal: number };
    trainee: { maxFlightFtd: number; maxTotal: number };
    simIp: { maxFtd: number; maxTotal: number };
  };

  // Duty & Turnaround
  preferredDutyPeriod: number;
  maxCrewDutyPeriod: number;
  maxDispatchPerHour: number;
  flightTurnaround: number;
  ftdTurnaround: number;
  cptTurnaround: number;

  // Flying Windows
  flyingStartTime: number;
  flyingEndTime: number;
  ftdStartTime: number;
  ftdEndTime: number;
  allowNightFlying: boolean;
  commenceNightFlying: number;
  ceaseNightFlying: number;

  // Aircraft Counts
  availableAircraftCount: number;
  availableFtdCount: number;
  availableCptCount: number;

  // Timezone & Display
  timezoneOffset: number;
  showDepartureDensityOverlay: boolean;

  // SCT Events
  sctEvents: string[];

  // Formation Callsigns
  formationCallsigns: Array<{
    id: string;
    lead: string;
    wing: string;
    callsign: string;
  }>;

  // Course Colors
  courseColors: Record<string, string>;

  // Phrase Bank
  phraseBank: Record<string, any>;

  // Cancellation Codes
  cancellationCodes: Array<{
    code: string;
    description: string;
    category?: string;
  }>;

  // Currency Requirements
  masterCurrencies: any[];
  currencyRequirements: any[];

  // Syllabus Details
  syllabusDetails: any[];

  // Organisation / Fleet Sharing
  organisationSettings: {
    fleetSharingEnabled: boolean;
    allocationMode: 'combined' | 'fixed';
    selectedUnits: string[];
    desiredAllocations: Record<string, number>;
    remainderUnitIndex: number;
  };

  // Metadata
  savedAt: string;
  version: string;
}

const SETTINGS_VERSION = '1.0';
const ORG_ID = 'default';

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: AppSettingsData | null = null;
let isSaving = false;

/**
 * Get the API base URL depending on environment
 */
const getApiBase = (): string => {
  const railwayBackend = 'https://dfp-neo-v2-production.up.railway.app';
  const currentOrigin = window.location.origin;
  if (currentOrigin === railwayBackend || currentOrigin.includes('railway.app')) {
    return '/api';
  }
  return `${railwayBackend}/api`;
};

/**
 * Load settings from the database
 * Returns null if no settings found (use defaults)
 */
export const loadSettingsFromDB = async (): Promise<AppSettingsData | null> => {
  try {
    const apiBase = getApiBase();
    const url = `${apiBase}/settings?orgId=${ORG_ID}`;
    console.log('[Settings] 🔍 Loading settings from DB — URL:', url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('[Settings] 📥 GET /api/settings response status:', res.status);

    if (!res.ok) {
      console.warn('[Settings] ❌ Failed to load settings from DB:', res.status);
      return null;
    }

    const json = await res.json();
    console.log('[Settings] 📦 Raw JSON from DB:', JSON.stringify(json).substring(0, 500));

    if (!json.settings) {
      console.log('[Settings] ⚠️ No settings found in DB (json.settings is null/undefined), using defaults');
      return null;
    }

    console.log('[Settings] ✅ Loaded settings from DB — version:', json.settings.version, '| organisationSettings:', JSON.stringify(json.settings.organisationSettings));
    return json.settings as AppSettingsData;
  } catch (error) {
    console.error('[Settings] 💥 Error loading settings from DB:', error);
    return null;
  }
};

/**
 * Save settings to the database immediately
 */
const saveSettingsNow = async (settings: AppSettingsData, userId?: string): Promise<boolean> => {
  if (isSaving) {
    console.log('[Settings] ⏳ Already saving — queuing this save');
    pendingSettings = settings;
    return false;
  }

  isSaving = true;
  try {
    const apiBase = getApiBase();
    const url = `${apiBase}/settings`;
    const payload = {
      orgId: ORG_ID,
      settings: {
        ...settings,
        savedAt: new Date().toISOString(),
        version: SETTINGS_VERSION,
      },
      updatedBy: userId || null,
    };

    console.log('[Settings] 📤 POST /api/settings — URL:', url);
    console.log('[Settings] 📤 Saving organisationSettings:', JSON.stringify(payload.settings.organisationSettings));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[Settings] 📥 POST /api/settings response status:', res.status);

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch {}
      console.error('[Settings] ❌ Failed to save settings:', res.status, errBody);
      // Try to parse error details
      try {
        const errJson = JSON.parse(errBody);
        console.error('[Settings] ❌ Server error details:', errJson.details || errJson.error);
      } catch {}
      return false;
    }

    const result = await res.json();
    console.log('[Settings] ✅ Settings saved to DB — response:', JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('[Settings] 💥 Error saving settings:', error);
    return false;
  } finally {
    isSaving = false;
    // If there was a pending save, execute it now
    if (pendingSettings) {
      const pending = pendingSettings;
      pendingSettings = null;
      saveSettingsNow(pending, userId);
    }
  }
};

/**
 * Save settings to the database with debouncing (300ms)
 * Multiple rapid changes will be batched into a single save
 */
export const saveSettingsToDB = (settings: AppSettingsData, userId?: string): void => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(() => {
    saveSettingsNow(settings, userId);
    saveDebounceTimer = null;
  }, 300);
};

/**
 * Save settings immediately without debouncing
 * Use for critical saves (e.g., when user navigates away)
 */
export const saveSettingsImmediately = async (settings: AppSettingsData, userId?: string): Promise<boolean> => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  return await saveSettingsNow(settings, userId);
};

/**
 * Build the settings object from current app state
 */
export const buildSettingsSnapshot = (state: Partial<AppSettingsData>): AppSettingsData => {
  return {
    locations: state.locations || [],
    units: state.units || [],
    unitLocations: state.unitLocations || {},
    eventLimits: state.eventLimits || {
      exec: { maxFlightFtd: 1, maxDutySup: 2, maxTotal: 2 },
      instructor: { maxFlightFtd: 2, maxDutySup: 31, maxTotal: 3 },
      trainee: { maxFlightFtd: 1, maxTotal: 2 },
      simIp: { maxFtd: 2, maxTotal: 2 },
    },
    preferredDutyPeriod: state.preferredDutyPeriod ?? 8,
    maxCrewDutyPeriod: state.maxCrewDutyPeriod ?? 10,
    maxDispatchPerHour: state.maxDispatchPerHour ?? 8,
    flightTurnaround: state.flightTurnaround ?? 1.2,
    ftdTurnaround: state.ftdTurnaround ?? 0.5,
    cptTurnaround: state.cptTurnaround ?? 0.5,
    flyingStartTime: state.flyingStartTime ?? 8.0,
    flyingEndTime: state.flyingEndTime ?? 17.0,
    ftdStartTime: state.ftdStartTime ?? 8.0,
    ftdEndTime: state.ftdEndTime ?? 17.0,
    allowNightFlying: state.allowNightFlying ?? true,
    commenceNightFlying: state.commenceNightFlying ?? 18.5,
    ceaseNightFlying: state.ceaseNightFlying ?? 23.5,
    availableAircraftCount: state.availableAircraftCount ?? 15,
    availableFtdCount: state.availableFtdCount ?? 5,
    availableCptCount: state.availableCptCount ?? 4,
    timezoneOffset: state.timezoneOffset ?? 0,
    showDepartureDensityOverlay: state.showDepartureDensityOverlay ?? false,
    sctEvents: state.sctEvents || [],
    formationCallsigns: state.formationCallsigns || [],
    courseColors: state.courseColors || {},
    phraseBank: state.phraseBank || {},
    cancellationCodes: state.cancellationCodes || [],
    masterCurrencies: state.masterCurrencies || [],
    currencyRequirements: state.currencyRequirements || [],
    syllabusDetails: state.syllabusDetails || [],
    organisationSettings: state.organisationSettings || {
      fleetSharingEnabled: false,
      allocationMode: 'combined',
      selectedUnits: [],
      desiredAllocations: {},
      remainderUnitIndex: -1,
    },
    savedAt: new Date().toISOString(),
    version: SETTINGS_VERSION,
  };
};