export interface PlatformLocation {
  code: string;
  name: string;
  organisationCode?: string;
  timezoneOffset?: number;
  trainingAreas?: string[];
  status?: string;
  settings?: Record<string, any>;
}

export interface PlatformUnit {
  code: string;
  name: string;
  organisationCode?: string;
  locationCode: string;
  unitType?: string;
  status?: string;
  settings?: Record<string, any>;
}

export interface PlatformResourcePool {
  code: string;
  name: string;
  organisationCode?: string;
  locationCode?: string | null;
  unitCode?: string | null;
  aircraftTypeCode?: string | null;
  poolType?: string;
  status?: string;
  settings?: {
    aircraft?: number;
    ftd?: number;
    cpt?: number;
    ground?: number;
    standby?: number;
    applyToV2Runtime?: boolean;
    [key: string]: any;
  };
}

export interface PlatformConfig {
  organisations: any[];
  locations: PlatformLocation[];
  units: PlatformUnit[];
  aircraftTypes: any[];
  resourcePools: PlatformResourcePool[];
  modules: any[];
  unitModules: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
}

export interface PlatformAccessRow {
  id?: string;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  organisationCode?: string | null;
  locationCode?: string | null;
  unitCode?: string | null;
  moduleCode?: string | null;
  role?: string | null;
  accessLevel?: string | null;
  status?: string | null;
  settings?: Record<string, any>;
}

export interface PlatformAccessContext {
  rows: PlatformAccessRow[];
  isConfigured: boolean;
  isPlatformAdmin: boolean;
  accessibleLocations: string[];
}

const emptyPlatformConfig: PlatformConfig = {
  organisations: [],
  locations: [],
  units: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
  userAccess: [],
  platformUsers: [],
  schedulingRuleSets: [],
};

const getApiBase = (): string => {
  const railwayBackend = 'https://dfp-neo-v2-production.up.railway.app';
  const currentOrigin = window.location.origin;
  if (currentOrigin === railwayBackend || currentOrigin.includes('railway.app')) return '/api';
  return `${railwayBackend}/api`;
};

export const loadPlatformConfigFromDB = async (): Promise<PlatformConfig | null> => {
  try {
    const res = await fetch(`${getApiBase()}/platform-config`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.warn('[PlatformConfig] Failed to load:', res.status);
      return null;
    }

    const data = await res.json();
    return { ...emptyPlatformConfig, ...data };
  } catch (error) {
    console.error('[PlatformConfig] Error loading platform configuration:', error);
    return null;
  }
};

export const getLocationCodesForCurrentRuntime = (
  config: PlatformConfig | null,
  supportedCodes: string[] = ['ESL', 'PEA'],
): string[] => {
  const supported = new Set(supportedCodes);
  const configuredCodes = (config?.locations || [])
    .filter((location) => location.status !== 'INACTIVE')
    .map((location) => location.code)
    .filter((code) => supported.has(code));

  return configuredCodes.length > 0 ? configuredCodes : supportedCodes;
};

const normaliseAccessValue = (value: unknown): string => String(value || '').trim().toLowerCase();

export const getPlatformAccessContext = (
  config: PlatformConfig | null,
  userIdentifiers: Array<string | null | undefined>,
  supportedCodes: string[] = ['ESL', 'PEA'],
): PlatformAccessContext => {
  const activeRows = ((config?.userAccess || []) as PlatformAccessRow[])
    .filter((row) => row.status !== 'INACTIVE');
  const configuredLocations = getLocationCodesForCurrentRuntime(config, supportedCodes);

  if (!config || activeRows.length === 0) {
    return {
      rows: [],
      isConfigured: false,
      isPlatformAdmin: true,
      accessibleLocations: configuredLocations,
    };
  }

  const identifiers = new Set(
    userIdentifiers
      .map(normaliseAccessValue)
      .filter(Boolean),
  );

  const rows = activeRows.filter((row) => {
    const rowIdentifiers = [
      row.userId,
      row.username,
      row.displayName,
    ].map(normaliseAccessValue).filter(Boolean);
    return rowIdentifiers.some((identifier) => identifiers.has(identifier));
  });

  if (rows.length === 0) {
    return {
      rows: [],
      isConfigured: false,
      isPlatformAdmin: true,
      accessibleLocations: configuredLocations,
    };
  }

  const isPlatformAdmin = rows.some((row) => (
    normaliseAccessValue(row.role) === 'platform admin'
  ));

  const rowLocations = rows
    .map((row) => row.locationCode || '')
    .filter(Boolean);
  const accessibleLocations = rowLocations.length === 0
    ? configuredLocations
    : configuredLocations.filter((code) => rowLocations.includes(code));

  return {
    rows,
    isConfigured: true,
    isPlatformAdmin,
    accessibleLocations: accessibleLocations.length > 0 ? accessibleLocations : configuredLocations,
  };
};

export const hasPlatformModuleAccess = (
  accessContext: PlatformAccessContext,
  locationCode: string,
  moduleCode: string,
): boolean => {
  if (!accessContext.isConfigured) return true;
  const targetModule = normaliseAccessValue(moduleCode);
  const targetLocation = normaliseAccessValue(locationCode);
  return accessContext.rows.some((row) => {
    const rowLocation = normaliseAccessValue(row.locationCode);
    const rowModule = normaliseAccessValue(row.moduleCode);
    const rowAccess = normaliseAccessValue(row.accessLevel);
    const hasLocationAccess = !rowLocation || rowLocation === targetLocation;
    const hasModuleAccess = !rowModule || rowModule === targetModule;
    const isEnabled = rowAccess !== 'none' && row.status !== 'INACTIVE';
    return hasLocationAccess && hasModuleAccess && isEnabled;
  });
};

export const getPlatformModuleForView = (view: string): string | null => {
  const viewToModule: Record<string, string> = {
    'Program Schedule': 'DFP',
    'InstructorSchedule': 'DFP',
    'TraineeSchedule': 'DFP',
    'SupervisorDashboard': 'DFP',
    'PostFlight': 'DFP',
    'Staff': 'TRAINING',
    'Instructors': 'TRAINING',
    'Trainee': 'TRAINING',
    'Trainees': 'TRAINING',
    'CourseRoster': 'TRAINING',
    'Syllabus': 'TRAINING',
    'CourseProgress': 'TRAINING',
    'TrainingRecords': 'TRAINING',
    'TraineeLMP': 'TRAINING',
    'PT051': 'TRAINING',
    'Currency': 'TRAINING',
    'CurrencyBuilder': 'TRAINING',
    'NextDayBuild': 'NEO_BUILD',
    'Priorities': 'NEO_BUILD',
    'ProgramData': 'NEO_BUILD',
    'BuildAnalysis': 'NEO_BUILD',
    'NextDayInstructorSchedule': 'NEO_BUILD',
    'NextDayTraineeSchedule': 'NEO_BUILD',
    'BuildIntelligence': 'NEO_BUILD',
    'Settings': 'DFP',
  };
  return viewToModule[view] || null;
};

export const getLocationResourcePool = (
  config: PlatformConfig | null,
  locationCode: string,
): PlatformResourcePool | null => {
  const pools = (config?.resourcePools || []).filter((pool) => (
    pool.status !== 'INACTIVE' &&
    pool.locationCode === locationCode &&
    pool.poolType === 'Shared'
  ));

  return pools[0] || null;
};

export const isResourcePoolRuntimeEnabled = (
  pool: PlatformResourcePool | null,
): boolean => pool?.settings?.applyToV2Runtime === true;

export const getResourcePoolCount = (
  pool: PlatformResourcePool | null,
  key: 'aircraft' | 'ftd' | 'cpt' | 'ground' | 'standby',
  fallback: number,
): number => {
  if (!isResourcePoolRuntimeEnabled(pool)) return fallback;
  const value = Number(pool?.settings?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};
