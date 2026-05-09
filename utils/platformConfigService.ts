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
  schedulingRuleSets: any[];
}

const emptyPlatformConfig: PlatformConfig = {
  organisations: [],
  locations: [],
  units: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
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
