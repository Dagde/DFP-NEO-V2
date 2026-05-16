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
    aircraftLabel?: string;
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
  aircraftTypes: any[];
  resourcePools: PlatformResourcePool[];
  modules: any[];
  unitModules: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
}

export type PlatformPermissionId = string;

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
    .filter((row) => normaliseAccessValue(row.status) !== 'inactive');
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
