import { getAppApiBase } from './externalDataControls';
import { DEFAULT_AIRFIELD_SOLAR_PROFILES } from './sunTimes.js';
import { isSetupTestMode, readSetupTestPlatformConfig } from './setupTestMode';

export interface PlatformLocation {
  code: string;
  iataCode?: string | null;
  name: string;
  organisationCode?: string;
  timezoneOffset?: number;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
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
  operationalModel?: OperationalModelCode;
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
    aircraftLabel?: string;
    aircraftNumberUsePrefix?: boolean;
    aircraftNumberPrefixes?: string[];
    aircraftNumberDefaultPrefix?: string;
    aircraftConfigurations?: Array<{ id: string; label?: string; definition?: string; description?: string }>;
    ftd?: number;
    ftdLabel?: string;
    cpt?: number;
    cptLabel?: string;
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
  unitTypes?: string[];
  aircraftTypes: any[];
  resourcePools: PlatformResourcePool[];
  modules: any[];
  unitModules: any[];
  licenses: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
}

export type PlatformPermissionId = string;

export type OperationalModelCode = 'flight_school' | 'air_combat' | 'fixed_crew' | 'pooled_crew';

export const DEFAULT_OPERATIONAL_MODEL: OperationalModelCode = 'flight_school';

export const OPERATIONAL_MODEL_OPTIONS: Array<{ value: OperationalModelCode; label: string }> = [
  { value: 'flight_school', label: 'Flight School Model' },
  { value: 'air_combat', label: 'Air Combat Model' },
  { value: 'fixed_crew', label: 'Fixed Crew Model' },
  { value: 'pooled_crew', label: 'Pooled Crew Model' },
];

const operationalModelLabels = new Map(OPERATIONAL_MODEL_OPTIONS.map((option) => [option.value, option.label]));

export const normaliseOperationalModel = (value: unknown): OperationalModelCode => {
  const token = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (token === 'air_combat' || token === 'fighter' || token === 'fighter_model') return 'air_combat';
  if (token === 'fixed_crew' || token === 'crewed' || token === 'crewed_model') return 'fixed_crew';
  if (token === 'pooled_crew' || token === 'pooledcrew' || token === 'pooled' || token === 'pooled_crew_model') return 'pooled_crew';
  if (token === 'air_mobility' || token === 'airlift' || token === 'mobility') return 'pooled_crew';
  return DEFAULT_OPERATIONAL_MODEL;
};

export const isFixedCrewLikeOperationalModel = (value: unknown): boolean => {
  const model = normaliseOperationalModel(value);
  return model === 'fixed_crew' || model === 'pooled_crew';
};

export const getUnitOperationalModel = (unit?: Partial<PlatformUnit> | null): OperationalModelCode => (
  normaliseOperationalModel(unit?.operationalModel || unit?.settings?.operationalModel)
);

export const getOperationalModelLabel = (value: unknown): string => (
  operationalModelLabels.get(normaliseOperationalModel(value)) || operationalModelLabels.get(DEFAULT_OPERATIONAL_MODEL)!
);

export interface PlatformPermissionProfile {
  id: string;
  name: string;
  description: string;
  permissions: PlatformPermissionId[];
}

export interface PlatformPermissionCatalogGroup {
  group: string;
  items: ReadonlyArray<readonly [PlatformPermissionId, string]>;
}

export const PLATFORM_PERMISSION_CATALOG: PlatformPermissionCatalogGroup[] = [
  {
    group: 'Daily Flying Program',
    items: [
      ['dfp.view', 'View DFP'],
      ['dfp.editTiles', 'Add, edit and delete tiles'],
      ['dfp.validation', 'Run validation checks'],
      ['dfp.publish', 'Publish DFP'],
      ['dfp.history', 'View historical DFP records'],
    ],
  },
  {
    group: 'NEO Build',
    items: [
      ['neo.run', 'Run NEO Build'],
      ['neo.priorities', 'Edit build priorities'],
      ['neo.intelligence', 'View build intelligence'],
      ['neo.override', 'Override build results'],
    ],
  },
  {
    group: 'Staff',
    items: [
      ['staff.view', 'View staff roster'],
      ['staff.edit', 'Edit staff details'],
      ['staff.currency.view', 'View staff currencies'],
      ['staff.currency.edit', 'Edit staff currencies'],
    ],
  },
  {
    group: 'Trainees',
    items: [
      ['trainee.roster.view', 'View trainee roster'],
      ['trainee.profile.own', 'View own trainee profile'],
      ['trainee.profile.others', 'View other trainee profiles'],
      ['trainee.pt051.own', 'View own PT-051'],
      ['trainee.pt051.others', 'View other trainee PT-051'],
      ['trainee.pt051.edit', 'Edit PT-051'],
      ['trainee.lmp.own', 'View own individual LMP'],
      ['trainee.lmp.others', 'View other trainee individual LMP'],
      ['trainee.remedial.add', 'Add remedial package'],
    ],
  },
  {
    group: 'Reporting',
    items: [
      ['reporting.view', 'View reports and analytics'],
      ['reporting.export', 'Export reports and records'],
    ],
  },
  {
    group: 'Settings & Administration',
    items: [
      ['settings.view', 'View settings'],
      ['settings.schedulingRules.edit', 'Edit scheduling rules'],
      ['settings.userAccess.edit', 'Edit user permissions'],
      ['settings.platform.edit', 'Edit platform configuration'],
      ['settings.rankTerminology.edit', 'Edit rank, terminology and label settings'],
      ['settings.superAdmin', 'Super Admin: unrestricted platform access'],
    ],
  },
];

export const ALL_PLATFORM_PERMISSION_IDS: PlatformPermissionId[] = PLATFORM_PERMISSION_CATALOG
  .flatMap((group) => group.items.map(([id]) => id));

export const DEFAULT_PLATFORM_PERMISSION_PROFILES: PlatformPermissionProfile[] = [
  {
    id: 'trainee',
    name: 'Trainee',
    description: 'Own-profile training access with restricted access to other trainee performance records.',
    permissions: ['dfp.view', 'trainee.roster.view', 'trainee.profile.own', 'trainee.pt051.own', 'trainee.lmp.own'],
  },
  {
    id: 'instructor',
    name: 'Instructor',
    description: 'Instructor access to DFP, staff roster, trainee profiles, PT-051 and LMP records.',
    permissions: ['dfp.view', 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others'],
  },
  {
    id: 'flying-supervisor',
    name: 'Flying Supervisor',
    description: 'Supervisor access for daily flying control, validation, publishing and trainee oversight.',
    permissions: ['dfp.view', 'dfp.editTiles', 'dfp.validation', 'dfp.publish', 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others', 'trainee.remedial.add', 'reporting.view'],
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Scheduling and build management access.',
    permissions: ['dfp.view', 'dfp.editTiles', 'dfp.validation', 'neo.run', 'neo.priorities', 'neo.intelligence', 'neo.override', 'reporting.view'],
  },
  {
    id: 'unit-admin',
    name: 'Unit Admin',
    description: 'Administration of users, settings and records within assigned access scopes.',
    permissions: ALL_PLATFORM_PERMISSION_IDS.filter((id) => id !== 'settings.superAdmin'),
  },
  {
    id: 'super-admin',
    name: 'Super Admin',
    description: 'Unrestricted platform administration. Use sparingly.',
    permissions: ALL_PLATFORM_PERMISSION_IDS,
  },
];

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
  isSuperAdmin: boolean;
  accessibleLocations: string[];
  permissionProfileIds: string[];
  permissions: PlatformPermissionId[];
}

export interface PlatformDataScope {
  organisationCodes: string[];
  locationCode: string;
  unitCodes: string[];
  allUnits: boolean;
}

export type MasterLmpAccessLevel = 'View' | 'Assign' | 'Manage';

export interface PlatformMasterLmpAccessRule {
  id?: string;
  lmpCode: string;
  organisationCode?: string | null;
  locationCode?: string | null;
  unitCode?: string | null;
  aircraftTypeCode?: string | null;
  parentOrganisationCode?: string | null;
  operationalModel?: OperationalModelCode | string | null;
  accessLevel?: MasterLmpAccessLevel | string | null;
  status?: string | null;
}

export interface PlatformMasterLmpCatalogueEntry {
  id?: string;
  code: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
}

export interface MasterLmpAccessContext {
  organisationCode?: string | null;
  locationCode?: string | null;
  unitCode?: string | null;
  unitCodes?: string[];
  aircraftTypeCode?: string | null;
  aircraftTypeCodes?: string[];
  parentOrganisationCode?: string | null;
  operationalModel?: OperationalModelCode | string | null;
}

export const DEFAULT_MASTER_LMP_ACCESS_RULES: PlatformMasterLmpAccessRule[] = [];

export const DEFAULT_MASTER_LMP_CATALOGUE: PlatformMasterLmpCatalogueEntry[] = [
  { id: 'master-lmp-catalogue-bpc-ipc', code: 'BPC+IPC', name: 'BPC+IPC', description: 'Default Flight School basic and instrument progression Master LMP.', status: 'ACTIVE' },
  { id: 'master-lmp-catalogue-fic', code: 'FIC', name: 'FIC', description: 'Default Flight Instructor Course Master LMP.', status: 'ACTIVE' },
  { id: 'master-lmp-catalogue-pc21-ground-school', code: 'PC-21 Ground School', name: 'PC-21 Ground School', description: 'Default Flight School PC-21 ground school Master LMP.', status: 'ACTIVE' },
];

const emptyPlatformConfig: PlatformConfig = {
  organisations: [],
  locations: [],
  units: [],
  unitTypes: [],
  aircraftTypes: [],
  resourcePools: [],
  modules: [],
  unitModules: [],
  licenses: [],
  userAccess: [],
  platformUsers: [],
  schedulingRuleSets: [],
};

export const normalisePlatformConfig = (source?: Partial<PlatformConfig> | null): PlatformConfig => {
  const raw = source && typeof source === 'object' ? source : {};
  return {
    ...emptyPlatformConfig,
    ...raw,
    organisations: Array.isArray(raw.organisations) ? raw.organisations : [],
    locations: Array.isArray(raw.locations) ? raw.locations : [],
    units: Array.isArray(raw.units) ? raw.units : [],
    unitTypes: Array.isArray(raw.unitTypes) ? raw.unitTypes : [],
    aircraftTypes: Array.isArray(raw.aircraftTypes) ? raw.aircraftTypes : [],
    resourcePools: Array.isArray(raw.resourcePools) ? raw.resourcePools : [],
    modules: Array.isArray(raw.modules) ? raw.modules : [],
    unitModules: Array.isArray(raw.unitModules) ? raw.unitModules : [],
    licenses: Array.isArray(raw.licenses) ? raw.licenses : [],
    userAccess: Array.isArray(raw.userAccess) ? raw.userAccess : [],
    platformUsers: Array.isArray(raw.platformUsers) ? raw.platformUsers : [],
    schedulingRuleSets: Array.isArray(raw.schedulingRuleSets) ? raw.schedulingRuleSets : [],
  };
};

const getApiBase = (): string => getAppApiBase();

const normaliseLocationIdentifier = (value: unknown): string => String(value || '').trim().toLowerCase();
const normaliseUnitIdentifier = (value: unknown): string => (
  String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
);

const defaultLocationProfiles = Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES || {});

const getKnownLocationProfile = (identifier: unknown): any | null => {
  const token = normaliseLocationIdentifier(identifier);
  if (!token) return null;
  return defaultLocationProfiles.find((profile: any) => (
    [
      profile.code,
      profile.iataCode,
      profile.icao,
      profile.name,
    ].some((value) => normaliseLocationIdentifier(value) === token)
  )) || null;
};

const getKnownLocationAliases = (identifier: unknown): string[] => {
  const profile = getKnownLocationProfile(identifier);
  if (!profile) return [String(identifier || '').trim()].filter(Boolean);
  return uniqueValues([
    profile.icao,
    profile.iataCode,
    profile.code,
  ].map((value) => String(value || '').trim()).filter(Boolean));
};

const getConfiguredLocationAliases = (location: PlatformLocation): string[] => {
  const directAliases = [
    location.code,
    location.iataCode,
    location.settings?.legacyCode,
    location.settings?.runtimeCode,
  ].map((value) => String(value || '').trim()).filter(Boolean);
  const profileAliases = directAliases.flatMap(getKnownLocationAliases);
  return uniqueValues([...directAliases, ...profileAliases]);
};

const resolveRuntimeLocationCode = (
  config: PlatformConfig | null,
  locationCode: string,
  supportedCodes: string[] = ['ESL', 'PEA'],
): string => {
  const rawCode = String(locationCode || '').trim();
  if (!rawCode) return '';
  const supported = new Set(supportedCodes.map((code) => normaliseLocationIdentifier(code)));
  const activeLocations = (config?.locations || []).filter((location) => location.status !== 'INACTIVE');
  const matchingLocation = activeLocations.find((location) => (
    getConfiguredLocationAliases(location).some((alias) => normaliseLocationIdentifier(alias) === normaliseLocationIdentifier(rawCode))
  ));
  const aliases = matchingLocation ? getConfiguredLocationAliases(matchingLocation) : getKnownLocationAliases(rawCode);
  const supportedAlias = aliases.find((alias) => supported.has(normaliseLocationIdentifier(alias)));
  return supportedAlias || rawCode;
};

const locationCodesAreEquivalent = (left: string, right: string): boolean => {
  const leftAliases = new Set(getKnownLocationAliases(left).map(normaliseLocationIdentifier));
  return getKnownLocationAliases(right).some((alias) => leftAliases.has(normaliseLocationIdentifier(alias)));
};

export const loadPlatformConfigFromDB = async (): Promise<PlatformConfig | null> => {
  if (isSetupTestMode()) {
    return readSetupTestPlatformConfig() as PlatformConfig;
  }
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
    return normalisePlatformConfig(data);
  } catch (error) {
    console.error('[PlatformConfig] Error loading platform configuration:', error);
    return null;
  }
};

export const getLocationCodesForCurrentRuntime = (
  config: PlatformConfig | null,
  supportedCodes: string[] = ['ESL', 'PEA'],
): string[] => {
  const supported = new Set(supportedCodes.map((code) => normaliseLocationIdentifier(code)));
  const configuredCodes = (config?.locations || [])
    .filter((location) => location.status !== 'INACTIVE')
    .map((location) => {
      const aliases = getConfiguredLocationAliases(location);
      return aliases.find((alias) => supported.has(normaliseLocationIdentifier(alias))) || location.code;
    })
    .filter((code) => supported.has(normaliseLocationIdentifier(code)));

  return configuredCodes.length > 0 ? configuredCodes : supportedCodes;
};

const normaliseAccessValue = (value: unknown): string => String(value || '').trim().toLowerCase();

const normaliseAccessLevel = (value: unknown): MasterLmpAccessLevel => {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'manage' || token === 'admin' || token === 'manage/edit' || token === 'edit') return 'Manage';
  if (token === 'assign' || token === 'write') return 'Assign';
  return 'View';
};

const normaliseOptionalOperationalModel = (value: unknown): string | null => {
  const token = String(value || '').trim();
  const comparison = token.toLowerCase().replace(/[\s-]+/g, '_');
  if (!comparison || comparison === 'any' || comparison === 'any_model' || comparison === 'all' || comparison === 'all_models') {
    return null;
  }
  return token;
};

const masterLmpAccessWeight = (level: MasterLmpAccessLevel): number => (
  level === 'Manage' ? 3 : level === 'Assign' ? 2 : 1
);

export const normaliseMasterLmpAccessRules = (config: PlatformConfig | null): PlatformMasterLmpAccessRule[] => {
  const configured = config?.organisations?.[0]?.settings?.masterLmpAccess;
  const source = Array.isArray(configured)
    ? configured
    : [];

  return source
    .map((rule: any, index: number) => ({
      id: String(rule.id || `master-lmp-access-${index + 1}`),
      lmpCode: String(rule.lmpCode || rule.masterLmp || rule.course || '').trim(),
      organisationCode: rule.organisationCode || 'DEFAULT',
      locationCode: rule.locationCode || null,
      unitCode: rule.unitCode || null,
      aircraftTypeCode: rule.aircraftTypeCode || null,
      parentOrganisationCode: rule.parentOrganisationCode || rule.parentOrgCode || null,
      operationalModel: normaliseOptionalOperationalModel(rule.operationalModel || rule.model),
      accessLevel: normaliseAccessLevel(rule.accessLevel || rule.access),
      status: String(rule.status || 'ACTIVE').toUpperCase(),
    }))
    .filter((rule) => rule.lmpCode);
};

export const normaliseMasterLmpCatalogue = (config: PlatformConfig | null): PlatformMasterLmpCatalogueEntry[] => {
  const configured = config?.organisations?.[0]?.settings?.masterLmpCatalogue;
  const configuredEntries = Array.isArray(configured) ? configured : [];
  const accessRuleCodes = normaliseMasterLmpAccessRules(config).map((rule) => rule.lmpCode);
  const source = configuredEntries.length > 0 ? configuredEntries : DEFAULT_MASTER_LMP_CATALOGUE;
  const entriesByCode = new Map<string, PlatformMasterLmpCatalogueEntry>();

  source.forEach((entry: any, index: number) => {
    // These fields are bound directly to editable Settings inputs. Keep the live text
    // exactly as typed so a trailing space can be entered; trim only the comparison key.
    const rawCode = String(entry?.code || entry?.lmpCode || entry?.name || '');
    const codeForKey = rawCode.trim();
    if (!codeForKey) return;
    const key = normaliseAccessValue(codeForKey);
    if (entriesByCode.has(key)) return;
    entriesByCode.set(key, {
      id: String(entry?.id || `master-lmp-catalogue-${index + 1}`),
      code: rawCode,
      name: entry?.name !== undefined ? String(entry.name) : codeForKey,
      description: String(entry?.description || ''),
      status: String(entry?.status || 'ACTIVE').toUpperCase(),
    });
  });

  accessRuleCodes.forEach((code) => {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return;
    const key = normaliseAccessValue(cleanCode);
    if (entriesByCode.has(key)) return;
    entriesByCode.set(key, {
      id: `master-lmp-catalogue-${cleanCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      code: cleanCode,
      name: cleanCode,
      description: '',
      status: 'ACTIVE',
    });
  });

  return Array.from(entriesByCode.values());
};

export const getMasterLmpAccessLevel = (
  config: PlatformConfig | null,
  lmpCode: string,
  context: MasterLmpAccessContext = {},
): MasterLmpAccessLevel | null => {
  if (!config) return 'Manage';
  const targetLmp = normaliseAccessValue(lmpCode);
  const targetOrganisation = normaliseAccessValue(context.organisationCode || 'DEFAULT');
  const targetLocation = normaliseAccessValue(context.locationCode);
  const targetParentOrganisation = normaliseAccessValue(context.parentOrganisationCode);
  const targetAircraftTypes = [
    ...(Array.isArray(context.aircraftTypeCodes) ? context.aircraftTypeCodes : []),
    context.aircraftTypeCode,
  ]
    .map(normaliseAccessValue)
    .filter(Boolean);
  const targetAircraftTypeSet = new Set(targetAircraftTypes);
  const targetUnits = [
    ...(Array.isArray(context.unitCodes) ? context.unitCodes : []),
    context.unitCode,
  ]
    .flatMap((unit) => String(unit || '').split('+'))
    .map(normaliseAccessValue)
    .filter(Boolean);
  const targetUnitSet = new Set(targetUnits);
  const targetModel = normaliseOperationalModel(context.operationalModel);

  const activeRulesForLmp = normaliseMasterLmpAccessRules(config)
    .filter((rule) => String(rule.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
    .filter((rule) => normaliseAccessValue(rule.lmpCode) === targetLmp);

  const matchingLevels = activeRulesForLmp
    .filter((rule) => !rule.organisationCode || normaliseAccessValue(rule.organisationCode) === targetOrganisation)
    .filter((rule) => !rule.locationCode || !targetLocation || normaliseAccessValue(rule.locationCode) === targetLocation)
    .filter((rule) => !rule.unitCode || targetUnitSet.size === 0 || targetUnitSet.has(normaliseAccessValue(rule.unitCode)))
    .filter((rule) => !rule.aircraftTypeCode || targetAircraftTypeSet.size === 0 || targetAircraftTypeSet.has(normaliseAccessValue(rule.aircraftTypeCode)))
    .filter((rule) => !rule.parentOrganisationCode || !targetParentOrganisation || normaliseAccessValue(rule.parentOrganisationCode) === targetParentOrganisation)
    .filter((rule) => !rule.operationalModel || normaliseOperationalModel(rule.operationalModel) === targetModel)
    .map((rule) => normaliseAccessLevel(rule.accessLevel));

  if (matchingLevels.length === 0) return null;
  return matchingLevels.sort((a, b) => masterLmpAccessWeight(b) - masterLmpAccessWeight(a))[0];
};

export const hasMasterLmpAccess = (
  config: PlatformConfig | null,
  lmpCode: string,
  context: MasterLmpAccessContext,
  requiredAccess: MasterLmpAccessLevel = 'View',
): boolean => {
  const level = getMasterLmpAccessLevel(config, lmpCode, context);
  return Boolean(level && masterLmpAccessWeight(level) >= masterLmpAccessWeight(requiredAccess));
};

export const filterMasterLmpCodesForAccess = (
  config: PlatformConfig | null,
  lmpCodes: string[],
  context: MasterLmpAccessContext,
  requiredAccess: MasterLmpAccessLevel = 'View',
): string[] => (
  lmpCodes.filter((lmpCode) => hasMasterLmpAccess(config, lmpCode, context, requiredAccess))
);

const parseSettingsObject = (settings: unknown): Record<string, any> => {
  if (!settings) return {};
  if (typeof settings === 'object' && !Array.isArray(settings)) return settings as Record<string, any>;
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const normaliseAccessRow = (row: PlatformAccessRow): PlatformAccessRow => ({
  ...row,
  settings: parseSettingsObject(row.settings),
});

export const getPlatformPermissionProfiles = (
  config: PlatformConfig | null,
): PlatformPermissionProfile[] => {
  const profileConfig = parseSettingsObject(config?.organisations?.[0]?.settings)?.permissionProfiles;
  const normalisedProfiles = Array.isArray(profileConfig)
    ? profileConfig
        .map((profile): PlatformPermissionProfile | null => {
          const id = String(profile?.id || '').trim();
          if (!id) return null;
          const permissions = Array.isArray(profile?.permissions)
            ? uniqueValues(profile.permissions.map((permission: unknown) => String(permission || '').trim()).filter(Boolean))
            : [];
          return {
            id,
            name: String(profile?.name || id).trim(),
            description: String(profile?.description || '').trim(),
            permissions,
          };
        })
        .filter((profile): profile is PlatformPermissionProfile => Boolean(profile))
    : [];

  return normalisedProfiles.length > 0
    ? normalisedProfiles
    : DEFAULT_PLATFORM_PERMISSION_PROFILES;
};

const uniqueValues = <T,>(values: T[]): T[] => Array.from(new Set(values));

const getExplicitPermissionProfileIds = (rows: PlatformAccessRow[]): string[] => uniqueValues(
  rows.flatMap((row) => (
    Array.isArray(parseSettingsObject(row.settings).permissionProfileIds)
      ? parseSettingsObject(row.settings).permissionProfileIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : []
  )),
);

const legacyRoleToProfileId = (role: unknown): string | null => {
  const normalisedRole = normaliseAccessValue(role);
  if (!normalisedRole) return null;
  if (normalisedRole.includes('super admin')) return 'super-admin';
  if (normalisedRole.includes('flying supervisor') || normalisedRole.includes('course supervisor')) return 'flying-supervisor';
  if (normalisedRole.includes('scheduler')) return 'scheduler';
  if (normalisedRole.includes('instructor')) return 'instructor';
  if (normalisedRole.includes('trainee')) return 'trainee';
  return null;
};

const getRoleFallbackProfileIds = (rows: PlatformAccessRow[]): string[] => uniqueValues(
  rows
    .map((row) => legacyRoleToProfileId(row.role))
    .filter((id): id is string => Boolean(id)),
);

const resolvePermissionsForRows = (
  config: PlatformConfig | null,
  rows: PlatformAccessRow[],
): { profileIds: string[]; permissions: PlatformPermissionId[]; isSuperAdmin: boolean; isPlatformAdmin: boolean } => {
  const explicitProfileIds = getExplicitPermissionProfileIds(rows);
  const profileIds = explicitProfileIds.length > 0
    ? explicitProfileIds
    : getRoleFallbackProfileIds(rows);
  const profiles = getPlatformPermissionProfiles(config);
  const profileIdSet = new Set(profileIds.map(normaliseAccessValue));
  const profilePermissions = profiles
    .filter((profile) => profileIdSet.has(normaliseAccessValue(profile.id)))
    .flatMap((profile) => profile.permissions.map((permission) => String(permission || '').trim()).filter(Boolean));

  const rolePermissions = rows.flatMap((row) => {
    const role = normaliseAccessValue(row.role);
    if (role.includes('super admin')) return ALL_PLATFORM_PERMISSION_IDS;
    if (role.includes('platform admin') || role.includes('unit admin')) {
      return ALL_PLATFORM_PERMISSION_IDS.filter((permissionId) => permissionId !== 'settings.superAdmin');
    }
    return [];
  });

  const permissions = uniqueValues([...profilePermissions, ...rolePermissions]);
  const isSuperAdmin = permissions.includes('settings.superAdmin') || rows.some((row) => normaliseAccessValue(row.role).includes('super admin'));
  const isPlatformAdmin = isSuperAdmin || rows.some((row) => {
    const role = normaliseAccessValue(row.role);
    return role.includes('platform admin') || role.includes('unit admin');
  }) || permissions.some((permission) => permission.startsWith('settings.'));

  return {
    profileIds,
    permissions,
    isSuperAdmin,
    isPlatformAdmin,
  };
};

export const getPlatformAccessContext = (
  config: PlatformConfig | null,
  userIdentifiers: Array<string | null | undefined>,
  supportedCodes: string[] = ['ESL', 'PEA'],
): PlatformAccessContext => {
  const activeRows = ((config?.userAccess || []) as PlatformAccessRow[])
    .map(normaliseAccessRow)
    .filter((row) => normaliseAccessValue(row.status) !== 'inactive')
    .map((row) => ({
      ...row,
      locationCode: row.locationCode
        ? resolveRuntimeLocationCode(config, row.locationCode, supportedCodes)
        : row.locationCode,
    }));
  const configuredLocations = getLocationCodesForCurrentRuntime(config, supportedCodes);

  if (!config || activeRows.length === 0) {
    return {
      rows: [],
      isConfigured: false,
      isPlatformAdmin: true,
      isSuperAdmin: true,
      accessibleLocations: configuredLocations,
      permissionProfileIds: DEFAULT_PLATFORM_PERMISSION_PROFILES.map((profile) => profile.id),
      permissions: ALL_PLATFORM_PERMISSION_IDS,
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
      isSuperAdmin: true,
      accessibleLocations: configuredLocations,
      permissionProfileIds: DEFAULT_PLATFORM_PERMISSION_PROFILES.map((profile) => profile.id),
      permissions: ALL_PLATFORM_PERMISSION_IDS,
    };
  }

  const permissionContext = resolvePermissionsForRows(config, rows);

  const rowLocations = rows
    .map((row) => row.locationCode || '')
    .filter(Boolean);
  const rowLocationSet = new Set(rowLocations.map(normaliseAccessValue));
  const accessibleLocations = rowLocations.length === 0
    ? configuredLocations
    : configuredLocations.filter((code) => rowLocationSet.has(normaliseAccessValue(code)));

  return {
    rows,
    isConfigured: true,
    isPlatformAdmin: permissionContext.isPlatformAdmin,
    isSuperAdmin: permissionContext.isSuperAdmin,
    accessibleLocations,
    permissionProfileIds: permissionContext.profileIds,
    permissions: permissionContext.permissions,
  };
};

export const hasPlatformPermission = (
  accessContext: PlatformAccessContext,
  permissionId: PlatformPermissionId,
): boolean => {
  if (!accessContext.isConfigured) return true;
  if (accessContext.isSuperAdmin) return true;
  const targetPermission = normaliseAccessValue(permissionId);
  return accessContext.permissions.some((permission) => normaliseAccessValue(permission) === targetPermission)
    || accessContext.permissions.some((permission) => normaliseAccessValue(permission) === normaliseAccessValue('settings.superAdmin'));
};

export const hasAnyPlatformPermission = (
  accessContext: PlatformAccessContext,
  permissionIds: PlatformPermissionId[],
): boolean => {
  if (!accessContext.isConfigured) return true;
  return permissionIds.some((permissionId) => hasPlatformPermission(accessContext, permissionId));
};

const MODULE_PERMISSION_PREFIXES: Record<string, string[]> = {
  dfp: ['dfp.'],
  neo_build: ['neo.'],
  training: ['staff.', 'trainee.'],
  reporting: ['reporting.'],
  settings: ['settings.'],
};

const hasPermissionForModule = (
  accessContext: PlatformAccessContext,
  moduleCode: string,
): boolean => {
  if (!accessContext.isConfigured) return true;
  if (accessContext.isSuperAdmin) return true;
  const prefixes = MODULE_PERMISSION_PREFIXES[normaliseAccessValue(moduleCode)] || [];
  if (prefixes.length === 0) return true;
  return accessContext.permissions.some((permissionId) => (
    prefixes.some((prefix) => normaliseAccessValue(permissionId).startsWith(prefix))
  ));
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
    const rowRole = normaliseAccessValue(row.role);
    const hasLocationAccess = !rowLocation || rowLocation === targetLocation;
    const hasModuleAccess = !rowModule || rowModule === targetModule;
    const isEnabled = rowAccess !== 'none' && normaliseAccessValue(row.status) !== 'inactive';
    const isAdminScope = ['platform admin', 'super admin'].includes(rowRole);
    return hasLocationAccess && isEnabled && (isAdminScope || hasModuleAccess) && hasPermissionForModule(accessContext, targetModule);
  });
};

export const getPlatformDataScopeForLocation = (
  accessContext: PlatformAccessContext,
  locationCode: string,
): PlatformDataScope => {
  const targetLocation = String(locationCode || '').trim();
  const activeRows = (accessContext.rows || [])
    .map(normaliseAccessRow)
    .filter((row) => normaliseAccessValue(row.status) !== 'inactive');

  const matchingRows = activeRows.filter((row) => {
    const rowLocation = String(row.locationCode || '').trim();
    return !rowLocation || normaliseAccessValue(rowLocation) === normaliseAccessValue(targetLocation);
  });

  const relevantRows = matchingRows.length > 0 ? matchingRows : activeRows;
  const unitCodes = uniqueValues(
    relevantRows
      .map((row) => String(row.unitCode || '').trim())
      .filter(Boolean),
  );
  const hasAllUnitScope = relevantRows.length === 0
    || relevantRows.some((row) => !String(row.unitCode || '').trim());

  return {
    organisationCodes: uniqueValues(
      relevantRows
        .map((row) => String(row.organisationCode || '').trim())
        .filter(Boolean),
    ),
    locationCode: targetLocation,
    unitCodes: hasAllUnitScope ? [] : unitCodes,
    allUnits: hasAllUnitScope,
  };
};

export const buildPlatformDataScopeQuery = (scope: PlatformDataScope): string => {
  const params = new URLSearchParams();
  if (scope.locationCode) params.set('location', scope.locationCode);
  if (scope.organisationCodes.length === 1) params.set('organisation', scope.organisationCodes[0]);
  if (!scope.allUnits && scope.unitCodes.length > 0) params.set('units', scope.unitCodes.join(','));
  return params.toString();
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
  unitCode?: string | null,
): PlatformResourcePool | null => {
  const matchingLocation = (config?.locations || []).find((location) => (
    getConfiguredLocationAliases(location).some((alias) => locationCodesAreEquivalent(alias, locationCode))
  ));
  const locationAliases = new Set(
    (matchingLocation ? getConfiguredLocationAliases(matchingLocation) : getKnownLocationAliases(locationCode))
      .map(normaliseLocationIdentifier),
  );
  const pools = (config?.resourcePools || []).filter((pool) => (
    pool.status !== 'INACTIVE' &&
    locationAliases.has(normaliseLocationIdentifier(pool.locationCode))
  ));

  const targetUnit = normaliseUnitIdentifier(unitCode);
  if (targetUnit) {
    const unitPools = pools.filter((pool) => normaliseUnitIdentifier(pool.unitCode) === targetUnit);
    const runtimeUnitPool = unitPools.find(isResourcePoolRuntimeEnabled);
    if (runtimeUnitPool) return runtimeUnitPool;
    if (unitPools.length > 0) return unitPools[0];
  }

  const sharedPools = pools.filter((pool) => String(pool.poolType || '').trim().toLowerCase() === 'shared');
  const runtimeSharedPool = sharedPools.find(isResourcePoolRuntimeEnabled);
  if (runtimeSharedPool) return runtimeSharedPool;

  const locationLevelPools = pools.filter((pool) => !normaliseLocationIdentifier(pool.unitCode));
  const runtimeLocationLevelPool = locationLevelPools.find(isResourcePoolRuntimeEnabled);
  if (runtimeLocationLevelPool) return runtimeLocationLevelPool;

  const runtimeLocationPool = pools.find(isResourcePoolRuntimeEnabled);
  return runtimeLocationPool || sharedPools[0] || locationLevelPools[0] || pools[0] || null;
};

export const isResourcePoolRuntimeEnabled = (
  pool: PlatformResourcePool | null,
): boolean => pool?.settings?.applyToV2Runtime === true;

export const getResourcePoolCount = (
  pool: PlatformResourcePool | null,
  key: 'aircraft' | 'ftd' | 'cpt' | 'ground' | 'standby',
  fallback: number,
): number => {
  const settings = pool?.settings || {};
  const aliases: Record<typeof key, string[]> = {
    aircraft: ['aircraft', 'airframes'],
    ftd: ['ftd', 'simulator', 'simulators'],
    cpt: ['cpt', 'trainer', 'trainers', 'proceduralTrainer', 'proceduralTrainers'],
    ground: ['ground'],
    standby: ['standby', 'stby'],
  };
  for (const alias of aliases[key]) {
    const value = Number((settings as Record<string, unknown>)[alias]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return fallback;
};
