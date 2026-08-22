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
    dutySupervisor?: number;
    towerDutyInstructor?: number;
    applyToV2Runtime?: boolean;
    dfpResourceRowsHistory?: Array<{
      effectiveFrom?: string;
      effectiveTo?: string;
      rows?: Record<string, number>;
    }>;
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
  settings?: Record<string, any>;
}

export interface PlatformPermissionCatalogGroup {
  group: string;
  items: ReadonlyArray<readonly [PlatformPermissionId, string]>;
}

export const PLATFORM_PERMISSION_CATALOG: PlatformPermissionCatalogGroup[] = [
  {
    group: 'DFP Page & Tiles',
    items: [
      ['dfp.view', 'View DFP'],
      ['dfp.tiles.nonAcademic.addRemoveMove', 'Add, remove and move non-academic event tiles'],
      ['dfp.tiles.academic.addRemoveMove', 'Add, remove and move academic event tiles'],
      ['dfp.tiles.nonAcademic.details.edit', 'Edit non-academic event details'],
      ['dfp.tiles.academic.details.edit', 'Edit academic event details'],
      ['dfp.editTiles', 'Legacy: add, edit and delete DFP tiles'],
      ['dfp.rightClickMenu.use', 'Use permitted DFP tile right-click menu items'],
      ['dfp.audit.view', 'Open DFP Audit Log'],
      ['dfp.multiSelect.use', 'Use Multi Select'],
      ['dfp.validation', 'Run validation checks'],
      ['dfp.dispatchRate.view', 'Open Dispatch Rate'],
      ['dfp.pauseFlightOps.use', 'Pause Flight Ops'],
      ['dfp.addGroundTile.use', 'Add Ground Tile'],
      ['dfp.addFlightTile.use', 'Add Flight Tile'],
      ['dfp.neoTile.use', 'Use NEO Tile / Quick Tile'],
      ['dfp.publish', 'Publish DFP'],
      ['dfp.history', 'View historical DFP records'],
    ],
  },
  {
    group: 'Flight Line & Maintenance',
    items: [
      ['dfp.flightLine.view', 'Open Flight Line'],
      ['dfp.flightLine.inventory.edit', 'Edit aircraft inventory'],
      ['dfp.flightLine.availability.edit', 'Edit aircraft availability status'],
      ['dfp.flightLine.availabilityLink.edit', 'Link aircraft availability to flight-line tiles'],
      ['dfp.aircraftNumber.edit', 'Edit aircraft number on flight tiles'],
      ['maintenance.slideout.view', 'View Maintenance slideout'],
      ['maintenance.slideout.edit', 'Edit Maintenance slideout'],
    ],
  },
  {
    group: 'NEO Build',
    items: [
      ['neo.run', 'Run NEO Build'],
      ['neo.programSchedule.view', 'Open NEO Build Program Schedule'],
      ['neo.staffSchedule.view', 'Open NEO Build Staff Schedule'],
      ['neo.traineeSchedule.view', 'Open NEO Build Trainee Schedule'],
      ['neo.publish.view', 'Open NEO Build Publish controls'],
      ['neo.priorities', 'Edit build priorities'],
      ['neo.intelligence', 'View build intelligence'],
      ['neo.intelligence.operational.view', 'View Build Intelligence - Operational'],
      ['neo.intelligence.people.view', 'View Build Intelligence - People'],
      ['neo.intelligence.courseMetrics.view', 'View Build Intelligence - Course Metrics'],
      ['neo.intelligence.buildAnalytics.view', 'View Build Intelligence - Build Analytics'],
      ['neo.intelligence.acHistory.view', 'View Build Intelligence - AC History'],
      ['neo.intelligence.managerialAnalytics.view', 'View Build Intelligence - Managerial Analytics'],
      ['neo.intelligence.bli.view', 'View Build Intelligence - BLI'],
      ['neo.override', 'Override build results'],
    ],
  },
  {
    group: 'Staff Pages',
    items: [
      ['staff.view', 'View staff roster'],
      ['staff.edit', 'Edit staff details'],
      ['staff.profile.view', 'View staff profile'],
      ['staff.profile.edit', 'Edit staff profile'],
      ['staff.profile.unavailable.use', 'Use staff Unavailable button'],
      ['staff.profile.currency.use', 'Use staff Currency button'],
      ['staff.profile.logbook.use', 'Use staff Logbook button'],
      ['staff.profile.sctRequest.use', 'Request staff currency / continuation training'],
      ['staff.profile.trainingReport.use', 'Use staff Training Report button'],
      ['staff.profile.trainingProgress.use', 'Use staff Training Progress button'],
      ['staff.schedule.view', 'View Staff Schedule'],
      ['staff.schedule.edit', 'Edit Staff Schedule DFP tiles'],
      ['staff.currency.view', 'View staff currencies'],
      ['staff.currency.edit', 'Edit staff currencies'],
    ],
  },
  {
    group: 'Trainee Pages',
    items: [
      ['trainee.roster.view', 'View trainee roster'],
      ['trainee.profile.own', 'If trainee, view own profile'],
      ['trainee.profile.others', "View other trainees' profiles"],
      ['trainee.profile.edit', 'Edit trainee profile'],
      ['trainee.profile.unavailable.use', 'Use trainee Unavailable button'],
      ['trainee.profile.currency.use', 'Use trainee Currency button'],
      ['trainee.profile.trainingReport.use', 'Use trainee Training Report button'],
      ['trainee.profile.lmp.use', 'Use View Individual LMP button'],
      ['trainee.profile.review.use', 'Use Trainee Review button'],
      ['trainee.profile.logbook.use', 'Use trainee Logbook button'],
      ['trainee.schedule.view', 'View Trainee Schedule'],
      ['trainee.schedule.edit', 'Edit Trainee Schedule DFP tiles'],
      ['trainee.pt051.own', 'If trainee, view own training reports'],
      ['trainee.pt051.others', "View other trainees' training reports"],
      ['trainee.pt051.edit', 'Edit training reports'],
      ['trainee.lmp.own', 'If trainee, view own Individual LMP'],
      ['trainee.lmp.others', "View other trainees' Individual LMPs"],
      ['trainee.remedial.add', 'Add remedial package'],
    ],
  },
  {
    group: 'LMP, Course Progress & Training Records',
    items: [
      ['lmp.eventDetails.view', 'View LMP / Event Details'],
      ['lmp.eventDetails.edit', 'Edit LMP / Event Details'],
      ['lmp.audit.view', 'Open LMP Audit'],
      ['lmp.manage.use', 'Manage LMPs'],
      ['lmp.event.add', 'Add LMP event'],
      ['lmp.upload.use', 'Upload LMP data'],
      ['courseProgress.view', 'View Course Progress'],
      ['courseProgress.edit', 'Edit Course Progress'],
      ['courseProgress.riskSettings.edit', 'Edit Course Progress risk settings'],
      ['courseProgress.audit.view', 'Open Course Progress Audit'],
      ['trainingRecords.courseManagement.view', 'View Training Records - Course Management'],
      ['trainingRecords.courseManagement.edit', 'Edit Training Records - Course Management'],
      ['trainingRecords.archivedCourses.view', 'View Archived Courses'],
      ['trainingRecords.course.add', 'Add course'],
      ['trainingRecords.audit.view', 'Open Training Records Audit'],
      ['trainingRecords.export.view', 'Open Training Records export'],
    ],
  },
  {
    group: 'Priorities',
    items: [
      ['priorities.flyingWindow.view', 'View Priorities - Flying Window and Capacities'],
      ['priorities.flyingWindow.edit', 'Edit Priorities - Flying Window and Capacities'],
      ['priorities.instructorRules.view', 'View Priorities - Instructor Rules'],
      ['priorities.instructorRules.edit', 'Edit Priorities - Instructor Rules'],
      ['priorities.courseDemand.view', 'View Priorities - Course Demand'],
      ['priorities.courseDemand.edit', 'Edit Priorities - Course Demand'],
      ['priorities.directedTasks.view', 'View Priorities - Directed Tasks'],
      ['priorities.directedTasks.edit', 'Edit Priorities - Directed Tasks'],
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
    group: 'Operational Slideouts & Windows',
    items: [
      ['neoAssist.slideout.view', 'View NEO Assist slideout'],
      ['neoAssist.slideout.edit', 'Edit NEO Assist slideout'],
      ['setupWizard.open', 'Open Initial Setup Wizard'],
      ['dutyPilot.flyout.open', 'Open Duty Pilot flyout'],
      ['myHome.flyout.open', 'Open My Home flyout'],
      ['unitLocationSelector.open', 'Open Unit / Location selection window'],
      ['unitLocationSelector.homeUnitCurrentDateOnly', 'Restrict to home unit / current date only'],
    ],
  },
  {
    group: 'Settings & Administration',
    items: [
      ['settings.view', 'View settings'],
      ['settings.edit', 'Edit settings'],
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
    settings: { profileType: 'role' },
  },
  {
    id: 'instructor',
    name: 'Instructor-Qualified',
    description: 'Instructor-qualified access to DFP, staff roster, trainee profiles, training reports and LMP records.',
    permissions: ['dfp.view', 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others'],
    settings: { profileType: 'role' },
  },
  {
    id: 'flying-supervisor',
    name: 'Flying Supervisor',
    description: 'Supervisor access for daily flying control, validation, publishing and trainee oversight.',
    permissions: ['dfp.view', 'dfp.editTiles', 'dfp.validation', 'dfp.publish', 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others', 'trainee.remedial.add', 'reporting.view'],
    settings: { profileType: 'role' },
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Scheduling and build management access.',
    permissions: ['dfp.view', 'dfp.editTiles', 'dfp.flightLine.view', 'dfp.flightLine.inventory.edit', 'dfp.flightLine.availability.edit', 'dfp.flightLine.availabilityLink.edit', 'dfp.aircraftNumber.edit', 'dfp.validation', 'neo.run', 'neo.programSchedule.view', 'neo.staffSchedule.view', 'neo.traineeSchedule.view', 'neo.publish.view', 'neo.priorities', 'neo.intelligence', 'neo.intelligence.operational.view', 'neo.intelligence.people.view', 'neo.intelligence.courseMetrics.view', 'neo.intelligence.buildAnalytics.view', 'neo.intelligence.acHistory.view', 'neo.intelligence.managerialAnalytics.view', 'neo.intelligence.bli.view', 'neo.override', 'reporting.view'],
    settings: { profileType: 'role' },
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Aircraft inventory, aircraft availability and flight-line tail assignment access without general tile editing.',
    permissions: ['dfp.view', 'dfp.flightLine.view', 'dfp.flightLine.inventory.edit', 'dfp.flightLine.availability.edit', 'dfp.flightLine.availabilityLink.edit', 'dfp.aircraftNumber.edit'],
    settings: { profileType: 'role' },
  },
  {
    id: 'unit-admin',
    name: 'Unit Admin',
    description: 'Administration of users, settings and records within assigned access scopes.',
    permissions: ALL_PLATFORM_PERMISSION_IDS.filter((id) => id !== 'settings.superAdmin'),
    settings: { profileType: 'role' },
  },
  {
    id: 'super-admin',
    name: 'Super Admin',
    description: 'Unrestricted platform administration. Use sparingly.',
    permissions: ALL_PLATFORM_PERMISSION_IDS,
    settings: { profileType: 'role' },
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

export const DEFAULT_MASTER_LMP_CATALOGUE: PlatformMasterLmpCatalogueEntry[] = [];

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
    resourcePools: Array.isArray(raw.resourcePools)
      ? raw.resourcePools.map((pool) => ({
        ...pool,
        settings: {
          ...(pool.settings || {}),
          applyToV2Runtime: true,
        },
      }))
      : [],
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
    location.name,
    location.settings?.iataCode,
    location.settings?.icaoCode,
    location.settings?.legacyCode,
    location.settings?.runtimeCode,
    ...(Array.isArray(location.settings?.aliases) ? location.settings.aliases : []),
  ].map((value) => String(value || '').trim()).filter(Boolean);
  const profileAliases = directAliases.flatMap(getKnownLocationAliases);
  return uniqueValues([...directAliases, ...profileAliases]);
};

const resolveRuntimeLocationCode = (
  config: PlatformConfig | null,
  locationCode: string,
  supportedCodes: string[] = [],
): string => {
  const rawCode = String(locationCode || '').trim();
  if (!rawCode) return '';
  const supported = new Set(supportedCodes.map((code) => normaliseLocationIdentifier(code)));
  const activeLocations = (config?.locations || []).filter((location) => location.status !== 'INACTIVE');
  const matchingLocation = activeLocations.find((location) => (
    getConfiguredLocationAliases(location).some((alias) => normaliseLocationIdentifier(alias) === normaliseLocationIdentifier(rawCode))
  ));
  const aliases = matchingLocation ? getConfiguredLocationAliases(matchingLocation) : getKnownLocationAliases(rawCode);
  const supportedAlias = supported.size > 0
    ? aliases.find((alias) => supported.has(normaliseLocationIdentifier(alias)))
    : '';
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
  supportedCodes: string[] = [],
): string[] => {
  const supported = new Set(supportedCodes.map((code) => normaliseLocationIdentifier(code)));
  const configuredCodes = (config?.locations || [])
    .filter((location) => location.status !== 'INACTIVE')
    .map((location) => {
      const aliases = getConfiguredLocationAliases(location);
      return supported.size > 0
        ? aliases.find((alias) => supported.has(normaliseLocationIdentifier(alias))) || location.code
        : location.code;
    })
    .filter((code) => supported.size === 0 || supported.has(normaliseLocationIdentifier(code)));

  return configuredCodes.length > 0 ? configuredCodes : supportedCodes;
};

const normaliseAccessValue = (value: unknown): string => String(value || '').trim().toLowerCase();
const compactAccessValue = (value: unknown): string => normaliseAccessValue(value).replace(/[^a-z0-9]/g, '');

const accessIdentityVariants = (...values: unknown[]): string[] => uniqueValues(
  values
    .flatMap((value) => {
      const raw = String(value || '').trim();
      if (!raw) return [];
      const variants = [raw];
      const emailLocalPart = raw.includes('@') ? raw.split('@')[0] : '';
      if (emailLocalPart) {
        variants.push(emailLocalPart, emailLocalPart.replace(/[._-]+/g, ' '));
      }
      const commaNameMatch = raw.match(/^([^,]+),\s*(.+)$/);
      if (commaNameMatch) {
        variants.push(`${commaNameMatch[2]} ${commaNameMatch[1]}`);
      }
      const spacedParts = raw.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
      if (spacedParts.length === 2 && !raw.includes(',')) {
        variants.push(`${spacedParts[1]}, ${spacedParts[0]}`);
      }
      return variants;
    })
    .flatMap((variant) => [normaliseAccessValue(variant), compactAccessValue(variant)])
    .filter(Boolean),
);

const platformUserIdentityValues = (user: any): unknown[] => [
  user?.id,
  user?.userId,
  user?.username,
  user?.email,
  user?.displayName,
  user?.name,
  user?.staffRecordId,
  user?.staffName,
  user?.traineeRecordId,
  user?.traineeName,
  user?.traineeFullName,
  user?.personnelId,
  user?.idNumber,
  user?.firstName && user?.lastName ? `${user.lastName}, ${user.firstName}` : '',
  user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
];

const accessRowIdentityValues = (row: PlatformAccessRow): unknown[] => {
  const settings = parseSettingsObject(row.settings);
  return [
    row.userId,
    row.username,
    row.displayName,
    (row as any).userName,
    (row as any).email,
    (row as any).personnelId,
    (row as any).idNumber,
    (row as any).staffId,
    (row as any).staffRecordId,
    (row as any).staffName,
    (row as any).traineeRecordId,
    (row as any).traineeName,
    (row as any).traineeFullName,
    settings.userId,
    settings.username,
    settings.displayName,
    settings.userName,
    settings.name,
    settings.email,
    settings.personnelId,
    settings.idNumber,
    settings.staffId,
    settings.staffRecordId,
    settings.staffName,
    settings.traineeRecordId,
    settings.traineeName,
    settings.traineeFullName,
    settings.linkedPersonId,
    settings.linkedPersonnelId,
    settings.linkedStaffId,
    settings.linkedStaffRecordId,
    settings.linkedTraineeId,
    settings.linkedTraineeRecordId,
  ];
};

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
  const organisationSettings = config?.organisations?.[0]?.settings as any;
  const hasConfiguredAccess = !!organisationSettings
    && Object.prototype.hasOwnProperty.call(organisationSettings, 'masterLmpAccess');
  const configured = hasConfiguredAccess
    ? organisationSettings.masterLmpAccess
    : organisationSettings?.masterLmpAccessRules;
  const source = Array.isArray(configured)
    ? configured
    : [];

  return source
    .map((rule: any, index: number) => ({
      id: String(rule.id || `master-lmp-access-${index + 1}`),
      lmpCode: String(rule.lmpCode || rule.masterLmp || rule.course || '').trim(),
      organisationCode: String(rule.organisationCode || '').trim(),
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
  const hasExplicitCatalogue = Array.isArray(configured);
  const configuredEntries = hasExplicitCatalogue ? configured : [];
  const accessRuleCodes = normaliseMasterLmpAccessRules(config).map((rule) => rule.lmpCode);
  const source = configuredEntries;
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

  if (!hasExplicitCatalogue) {
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
  }

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

export const getPlatformUserIdentityValuesForPerson = (
  config: PlatformConfig | null,
  person: Record<string, any> | null | undefined,
  personType: 'staff' | 'trainee',
): unknown[] => {
  if (!config || !person || !Array.isArray(config.platformUsers)) return [];

  const personVariants = accessIdentityVariants(
    person.id,
    person.userId,
    person.personnelId,
    person.idNumber,
    person.email,
    person.name,
    person.fullName,
  );
  if (personVariants.length === 0) return [];

  const linkedUsers = config.platformUsers.filter((user: any) => {
    const userSettings = parseSettingsObject(user?.settings);
    const linkedRecordValues = personType === 'staff'
      ? [
          user?.staffRecordId,
          userSettings.staffRecordId,
          userSettings.linkedStaffRecordId,
          userSettings.staffId,
          userSettings.linkedStaffId,
        ]
      : [
          user?.traineeRecordId,
          userSettings.traineeRecordId,
          userSettings.linkedTraineeRecordId,
          userSettings.traineeId,
          userSettings.linkedTraineeId,
        ];
    const linkedRecordVariants = accessIdentityVariants(...linkedRecordValues);
    if (linkedRecordVariants.some((identifier) => personVariants.includes(identifier))) return true;

    const userVariants = accessIdentityVariants(
      ...platformUserIdentityValues(user),
      userSettings.personnelId,
      userSettings.idNumber,
      userSettings.email,
      userSettings.displayName,
      personType === 'staff' ? userSettings.staffName : userSettings.traineeName,
      personType === 'trainee' ? userSettings.traineeFullName : '',
    );
    return userVariants.some((identifier) => personVariants.includes(identifier));
  });

  return uniqueValues(linkedUsers.flatMap((user) => platformUserIdentityValues(user)));
};

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
            settings: parseSettingsObject(profile?.settings),
          };
        })
        .filter((profile): profile is PlatformPermissionProfile => Boolean(profile))
    : [];

  return Array.isArray(profileConfig)
    ? normalisedProfiles
    : DEFAULT_PLATFORM_PERMISSION_PROFILES;
};

const uniqueValues = <T,>(values: T[]): T[] => Array.from(new Set(values));

const addImpliedViewPermissions = (permissionIds: PlatformPermissionId[]): PlatformPermissionId[] => {
  const permissions = new Set(
    permissionIds
      .map((permissionId) => String(permissionId || '').trim())
      .filter(Boolean),
  );
  const normalisedPermissions = () => Array.from(permissions).map(normaliseAccessValue);
  const hasPrefix = (prefix: string) => normalisedPermissions().some((permissionId) => permissionId.startsWith(prefix));
  const hasLmpManagementAction = normalisedPermissions().some((permissionId) => (
    permissionId.startsWith('lmp.')
    && permissionId !== 'lmp.eventdetails.view'
  ));

  if (hasPrefix('dfp.')) permissions.add('dfp.view');
  if (hasPrefix('maintenance.')) {
    permissions.add('dfp.view');
    permissions.add('dfp.flightLine.view');
    permissions.add('maintenance.slideout.view');
  }
  if (hasLmpManagementAction) permissions.add('lmp.manage.use');
  if (hasPrefix('courseprogress.')) permissions.add('courseProgress.view');
  if (hasPrefix('trainingrecords.')) permissions.add('trainingRecords.courseManagement.view');
  if (hasPrefix('settings.')) permissions.add('settings.view');

  return Array.from(permissions);
};

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

  const permissions = addImpliedViewPermissions(uniqueValues([...profilePermissions, ...rolePermissions]));
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
  supportedCodes: string[] = [],
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
    accessIdentityVariants(...userIdentifiers),
  );

  const rows = activeRows.filter((row) => {
    const rowVariants = accessIdentityVariants(...accessRowIdentityValues(row));
    const platformUser = (config.platformUsers || []).find((user: any) => (
      accessIdentityVariants(...platformUserIdentityValues(user))
        .some((identifier) => rowVariants.includes(identifier))
    ));
    const rowIdentifiers = accessIdentityVariants(
      ...accessRowIdentityValues(row),
      ...platformUserIdentityValues(platformUser),
    );
    return rowIdentifiers.some((identifier) => identifiers.has(identifier));
  });

  if (rows.length === 0) {
    return {
      rows: [],
      isConfigured: true,
      isPlatformAdmin: false,
      isSuperAdmin: false,
      accessibleLocations: [],
      permissionProfileIds: [],
      permissions: [],
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

export const getAssignedPlatformPermissionProfileLabels = (
  config: PlatformConfig | null,
  userIdentifiers: Array<string | number | null | undefined>,
): string[] => {
  if (!config || !Array.isArray(config.userAccess) || config.userAccess.length === 0) return [];

  const identifiers = new Set(accessIdentityVariants(...userIdentifiers));
  if (identifiers.size === 0) return [];

  const activeRows = (config.userAccess as PlatformAccessRow[])
    .map(normaliseAccessRow)
    .filter((row) => normaliseAccessValue(row.status) !== 'inactive');

  const rows = activeRows.filter((row) => {
    const rowVariants = accessIdentityVariants(...accessRowIdentityValues(row));
    const platformUser = (config.platformUsers || []).find((user: any) => (
      accessIdentityVariants(...platformUserIdentityValues(user))
        .some((identifier) => rowVariants.includes(identifier))
    ));
    const rowIdentifiers = accessIdentityVariants(
      ...accessRowIdentityValues(row),
      ...platformUserIdentityValues(platformUser),
    );
    return rowIdentifiers.some((identifier) => identifiers.has(identifier));
  });

  const profileIds = getExplicitPermissionProfileIds(rows);
  if (profileIds.length === 0) return [];

  const profiles = getPlatformPermissionProfiles(config);
  const profileNameById = new Map(
    profiles.map((profile) => [normaliseAccessValue(profile.id), profile.name || profile.id]),
  );
  return uniqueValues(
    profileIds
      .map((profileId) => profileNameById.get(normaliseAccessValue(profileId)) || profileId)
      .map((label) => String(label || '').trim())
      .filter(Boolean),
  );
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
    if (unitPools.length > 0) return unitPools[0];
  }

  const sharedPools = pools.filter((pool) => String(pool.poolType || '').trim().toLowerCase() === 'shared');
  const locationLevelPools = pools.filter((pool) => !normaliseLocationIdentifier(pool.unitCode));
  return sharedPools[0] || locationLevelPools[0] || pools[0] || null;
};

export const isResourcePoolRuntimeEnabled = (
  pool: PlatformResourcePool | null,
): boolean => !!pool && pool.status !== 'INACTIVE';

const getResourceRowsForDate = (
  settings: Record<string, any>,
  targetDate?: string,
): Record<string, number> | null => {
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
  const history = Array.isArray(settings.dfpResourceRowsHistory) ? settings.dfpResourceRowsHistory : [];
  const matches = history.filter((entry: any) => {
    const from = String(entry?.effectiveFrom || '0000-01-01').slice(0, 10);
    const to = String(entry?.effectiveTo || '9999-12-31').slice(0, 10);
    if (from === '0000-01-01' && to !== '9999-12-31') {
      return targetDate === to && entry?.rows && typeof entry.rows === 'object';
    }
    return targetDate >= from && targetDate <= to && entry?.rows && typeof entry.rows === 'object';
  });
  const entry = matches[matches.length - 1];
  return entry?.rows || null;
};

export const getResourcePoolCount = (
  pool: PlatformResourcePool | null,
  key: 'aircraft' | 'ftd' | 'cpt' | 'ground' | 'standby' | 'dutySupervisor' | 'towerDutyInstructor',
  fallback: number,
  targetDate?: string,
): number => {
  const settings = pool?.settings || {};
  const datedRows = getResourceRowsForDate(settings, targetDate);
  if (datedRows) {
    const historicalValue = Number(datedRows[key]);
    if (Number.isFinite(historicalValue) && historicalValue >= 0) return historicalValue;
  }
  const aliases: Record<typeof key, string[]> = {
    aircraft: ['aircraft', 'airframes'],
    ftd: ['ftd', 'simulator', 'simulators'],
    cpt: ['cpt', 'trainer', 'trainers', 'proceduralTrainer', 'proceduralTrainers'],
    ground: ['ground'],
    standby: ['standby', 'stby'],
    dutySupervisor: ['dutySupervisor', 'dutySup', 'dutySupervisorRow'],
    towerDutyInstructor: ['towerDutyInstructor', 'twrDi', 'twrDiRow'],
  };
  for (const alias of aliases[key]) {
    const value = Number((settings as Record<string, unknown>)[alias]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return fallback;
};
