import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import {
  DEFAULT_PLATFORM_PERMISSION_PROFILES,
  DEFAULT_OPERATIONAL_MODEL,
  OPERATIONAL_MODEL_OPTIONS,
  PLATFORM_PERMISSION_CATALOG,
  getUnitOperationalModel,
  getLocationResourcePool,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
  normalisePlatformConfig,
  normaliseMasterLmpAccessRules,
  normaliseMasterLmpCatalogue,
  type PlatformMasterLmpAccessRule,
  type PlatformMasterLmpCatalogueEntry,
  type PlatformPermissionProfile,
} from '../utils/platformConfigService';
import {
  formatTaskProfileAbbreviationText,
  formatTaskProfileText,
  normaliseTaskProfileConfig,
  parseTaskProfileAbbreviationText,
  parseTaskProfileText,
} from '../utils/taskProfiles';
import {
  formatRankOrderText,
  getRankOrderFromEquivalency,
  normalisePersonnelDisplaySettings,
  normaliseRankEquivalencyConfig,
  parseRankOrderText,
  RANK_EQUIVALENCY_PRESET_LABELS,
  RANK_EQUIVALENCY_PRESETS,
  type PersonnelDisplaySettings,
  type RankEquivalencyConfig,
  type RankEquivalencyPresetKey,
} from '../utils/personnelDisplaySettings';
import {
  SCT_LONG_LABEL_MAX_LENGTH,
  SCT_SHORT_LABEL_MAX_LENGTH,
  normaliseSctTerminology,
  type SctTerminology,
} from '../utils/sctTerminology';
import {
  TRAINING_REPORT_NAME_MAX_LENGTH,
  TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH,
  TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH,
  TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH,
  normaliseTrainingReportTerminology,
  normaliseTrainingReportTemplate,
  getUnitTrainingReportPhraseBank,
  type TrainingReportTerminology,
  type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import { normaliseAircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { normaliseAircraftConfigurationDefinitions } from '../utils/aircraftConfigurationSettings';
import {
  AIRCRAFT_CREW_RESOURCE_KINDS,
  DEFAULT_AIRCRAFT_CREW_COMPOSITION,
  getAircraftSeatEligibleRoles,
  getAircraftSeatEligibleRolesForResource,
  normaliseAircraftCrewComposition,
  type AircraftCrewComposition,
  type AircraftCrewResourceKind,
} from '../utils/aircraftCrewComposition';
import {
  DEFAULT_CREW_POSITION_TERMINOLOGY,
  getCrewPositionLabelMap,
  getCrewPositionOptions,
  isCrewPositionAvailableForOperationalModel,
  normaliseCrewPositionTerminology,
  type CrewPositionTerminologyEntry,
} from '../utils/crewPositionTerminology';
import {
  createAlternateCrewCompositionCode,
  normaliseCrewCompositionSettings,
  type AlternateCrewCompositionProfile,
  type CurrencyProfile,
} from '../utils/crewCompositionProfiles';
import { downloadOrganisationStructureTemplateFile } from '../utils/organisationStructureTemplate';
import {
  DEFAULT_STAFF_QUALIFICATIONS,
  normaliseStaffQualificationCatalogue,
  normaliseQualificationToken,
  type StaffQualificationDefinition,
} from '../utils/staffQualifications';
import {
  UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS,
  UNIT_CALLSIGN_ALLOCATION_METHODS,
  getDefaultUnitCallsign,
  getUnitCallsignPolicy,
  normaliseUnitCallsignSettings,
  type UnitCallsignEntry,
  type UnitCallsignPolicy,
} from '../utils/unitCallsigns';
import FormationCallsignsSection from './FormationCallsignsSection';
import { getAppApiBase } from '../utils/externalDataControls';
import {
  isSetupTestMode,
  readSetupTestPlatformConfig,
  writeSetupTestPlatformConfig,
} from '../utils/setupTestMode';
import { logAudit } from '../utils/auditLogger';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import type { CurrencyRequirement, FormationCallsign, MasterCurrency, SyllabusItemDetail } from '../types';
import {
  INSERT_EVENT_LABEL_MAX_LENGTH,
  normaliseInsertEventTypes,
  type InsertEventTypeConfig,
  type InsertEventDayNight,
  type InsertEventSyllabusType,
} from '../utils/insertEventTypes';
import {
  DEFAULT_AIRFIELD_SOLAR_PROFILES,
  getDefaultAirfieldSolarProfile,
  isValidLatitude,
  isValidLongitude,
  isValidTimeZone,
} from '../utils/sunTimes.js';
import { showDarkAlert, showDarkConfirm, showDarkPrompt } from './DarkMessageModal';

declare const XLSX: any;

type PlatformConfig = {
  organisations: any[];
  locations: any[];
  units: any[];
  unitTypes?: string[];
  aircraftTypes: any[];
  resourcePools: any[];
  modules: any[];
  unitModules: any[];
  licenses: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
};

type SettingsVisibilityMode = 'all' | 'unit' | 'location' | 'aircraftType' | 'parentOrganisation';
type SettingsVisibilityFilter = Exclude<SettingsVisibilityMode, 'all'>;
const DFP_RESOURCE_ROW_KEYS = ['aircraft', 'ftd', 'cpt', 'standby', 'ground'] as const;
type DfpResourceRowKey = typeof DFP_RESOURCE_ROW_KEYS[number];
type DfpResourceRowsSnapshot = Record<DfpResourceRowKey, number>;

type SettingsVisibilityPolicy = {
  enabled: boolean;
  filters: SettingsVisibilityFilter[];
  mode?: SettingsVisibilityMode;
};

type LicenseRuntimeStatus = {
  hasActiveLicense?: boolean;
  activeLicenseCount?: number;
  runtimeMode?: string;
  developmentBypass?: boolean;
  enforcementMode?: string;
  shouldBlock?: boolean;
  deploymentFingerprint?: string;
  publicKeyConfigured?: boolean;
  verifiedLicenseCount?: number;
  unsignedLicenseCount?: number;
  invalidLicenseCount?: number;
  licensedModuleCodes?: string[];
  licenseSummaries?: any[];
  message?: string;
};

type PermissionProfile = PlatformPermissionProfile;

type AirfieldCatalogueEntry = {
  c?: string;
  i?: string;
  l?: string;
  n: string;
  m?: string;
  y?: string;
  a: number;
  o: number;
  t: string;
};

type AirfieldCatalogueLookup = {
  exact: Map<string, AirfieldCatalogueEntry>;
  searchable: Array<{
    entry: AirfieldCatalogueEntry;
    searchText: string;
    codeText: string;
    nameText: string;
  }>;
};

const PERMISSION_CATALOG = PLATFORM_PERMISSION_CATALOG;
const DEFAULT_PERMISSION_PROFILES = DEFAULT_PLATFORM_PERMISSION_PROFILES;

const emptyConfig: PlatformConfig = {
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

const getApiBase = (): string => getAppApiBase();

const fieldClass = 'w-full min-w-0 rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400';
const sectionClass = 'overflow-hidden rounded-xl border border-sky-500/35 bg-gray-800 shadow-[0_0_0_1px_rgba(125,211,252,0.08),0_18px_45px_rgba(0,0,0,0.28)]';
const sectionHeaderStyle = {
  backgroundColor: 'rgba(30, 64, 89, 0.62)',
  borderColor: 'rgba(125, 211, 252, 0.28)',
};
const sectionAccentStyle = {
  backgroundColor: 'rgba(125, 211, 252, 0.72)',
  boxShadow: '0 0 18px rgba(125, 211, 252, 0.28)',
};
const ACCESS_SCOPE_TONE = {
  border: 'rgba(34, 211, 238, 0.42)',
  fill: 'rgba(8, 145, 178, 0.24)',
  applyBorder: 'rgba(103, 232, 249, 0.62)',
};
const platformLocationRowTone = {
  border: 'rgba(103, 232, 249, 0.72)',
  accent: 'rgba(103, 232, 249, 0.8)',
};

type StandardMissionResourceType = 'Flight' | 'FTD' | 'CPT' | 'Ground';

interface StandardMissionRoleRequirement {
  role: string;
  count: number;
}

interface StandardMissionProfile {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  unitCode: string;
  compositeUnitCode: string;
  compositeProfileId: string;
  aircraftTypeCode: string;
  missionName: string;
  shortTitle: string;
  description: string;
  resourceType: StandardMissionResourceType;
  departureLocationCode: string;
  arrivalLocationCode: string;
  durationMinutes: number;
  preFlightMinutes: number;
  postFlightMinutes: number;
  isFormation: boolean;
  formationAircraft: number;
  config: string;
  crewCompositionMode: 'STANDARD' | 'ALTERNATE' | 'CUSTOM';
  selectedCrewCompositionId: string;
  acceptableCrewCompositionIds: string[];
  roleRequirements: StandardMissionRoleRequirement[];
  defaultCallsignPrefix: string;
}

const STANDARD_MISSION_RESOURCE_TYPES: StandardMissionResourceType[] = ['Flight', 'FTD', 'CPT', 'Ground'];

interface OrganisationStructureLevel {
  id: string;
  name: string;
  options: string[];
  childrenByParent?: Record<string, string[]>;
  parentByChild?: Record<string, string>;
}

interface OrganisationStructureSettings {
  levelCount: number;
  levels: OrganisationStructureLevel[];
  relationshipPaths?: string[][];
}

const DEFAULT_ORGANISATION_STRUCTURE_LEVELS = [
  'Organisation',
  'Headquarters',
  'Command',
  'Numbered Force',
  'Wing',
  'Group',
  'Squadron',
  'Flight',
  'Crew',
];

const normaliseOrganisationParentKey = (value: unknown): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

type OrganisationStructureLevelDraft = {
  name: string;
  options: string[];
  childrenByParent?: Record<string, string[]>;
  parentByChild?: Record<string, string>;
};

const addOrganisationParentRelationship = (
  grouped: Map<number, OrganisationStructureLevelDraft>,
  levelNumber: number,
  levelName: string,
  parent: string,
  child: string,
) => {
  const cleanParent = String(parent || '').trim();
  const cleanChild = String(child || '').trim();
  if (!cleanParent || !cleanChild || levelNumber <= 0) return;
  const current = grouped.get(levelNumber) || { name: levelName, options: [] };
  const childrenByParent = current.childrenByParent || {};
  const parentByChild = current.parentByChild || {};
  const normalisedParent = normaliseOrganisationParentKey(cleanParent);
  const normalisedChild = normaliseOrganisationParentKey(cleanChild);
  childrenByParent[cleanParent] = Array.from(new Set([...(childrenByParent[cleanParent] || []), cleanChild]));
  childrenByParent[normalisedParent] = Array.from(new Set([...(childrenByParent[normalisedParent] || []), cleanChild]));
  parentByChild[cleanChild] = cleanParent;
  parentByChild[normalisedChild] = cleanParent;
  current.childrenByParent = childrenByParent;
  current.parentByChild = parentByChild;
  grouped.set(levelNumber, current);
};

const getOrganisationPathValueForLevel = (path: string[], levelIndex: number): string => {
  const rootedValue = String(path[levelIndex] || '').trim();
  if (rootedValue) return rootedValue;
  return String(path[levelIndex - 1] || '').trim();
};

const normaliseOrganisationStructure = (source: unknown, organisationName = ''): OrganisationStructureSettings => {
  const raw = (source || {}) as any;
  const rawLevels = Array.isArray(raw.levels) ? raw.levels : [];
  const relationshipPaths = Array.isArray(raw.relationshipPaths)
    ? raw.relationshipPaths
        .map((path: unknown) => (
          Array.isArray(path)
            ? path.map((part: unknown) => String(part || '').trim()).filter(Boolean)
            : String(path || '').split('>').map((part) => part.trim()).filter(Boolean)
        ))
        .filter((path: string[]) => path.length > 1)
    : undefined;
  const requestedCount = Number(raw.levelCount);
  const levelCount = Math.max(1, Math.min(12, Number.isFinite(requestedCount) && requestedCount > 0 ? Math.round(requestedCount) : Math.max(rawLevels.length, 4)));
  const organisationLevelName = String(organisationName || '').trim();
  const levels = Array.from({ length: levelCount }, (_, index) => {
    const rawLevel = rawLevels[index] || {};
    const rawLevelName = String(rawLevel.name || rawLevel.label || '');
    const defaultLevelName = DEFAULT_ORGANISATION_STRUCTURE_LEVELS[index] || `Level ${index}`;
    const options = Array.isArray(rawLevel.options)
      ? rawLevel.options
      : String(rawLevel.options || '').split(/\r?\n|;/);
    const childrenByParent = rawLevel.childrenByParent && typeof rawLevel.childrenByParent === 'object'
      ? Object.fromEntries(
          Object.entries(rawLevel.childrenByParent).map(([parent, children]) => [
            String(parent || '').trim(),
            Array.from(new Set((Array.isArray(children) ? children : String(children || '').split(/\r?\n|;/))
              .map((child: unknown) => String(child || '').trim())
              .filter(Boolean))),
          ]).filter(([parent, children]) => parent && (children as string[]).length > 0)
        )
      : undefined;
    const parentByChild = rawLevel.parentByChild && typeof rawLevel.parentByChild === 'object'
      ? Object.fromEntries(
          Object.entries(rawLevel.parentByChild)
            .map(([child, parent]) => [String(child || '').trim(), String(parent || '').trim()])
            .filter(([child, parent]) => child && parent)
        )
      : undefined;
    return {
      id: String(rawLevel.id || `org-level-${index}`),
      name: index === 0 && organisationLevelName && (!rawLevelName.trim() || rawLevelName.trim() === DEFAULT_ORGANISATION_STRUCTURE_LEVELS[0])
        ? organisationLevelName
        : (rawLevelName.trim() ? rawLevelName : defaultLevelName),
      options: Array.from(new Set(options.map((option: unknown) => String(option || '')).filter((option) => option.trim()))),
      ...(childrenByParent && Object.keys(childrenByParent).length > 0 ? { childrenByParent } : {}),
      ...(parentByChild && Object.keys(parentByChild).length > 0 ? { parentByChild } : {}),
    };
  });
  if (relationshipPaths && relationshipPaths.length > 0) {
    const grouped = new Map<number, OrganisationStructureLevelDraft>();
    levels.forEach((level, index) => {
      grouped.set(index, {
        name: level.name,
        options: [...level.options],
        ...(level.childrenByParent ? { childrenByParent: { ...level.childrenByParent } } : {}),
        ...(level.parentByChild ? { parentByChild: { ...level.parentByChild } } : {}),
      });
    });
    relationshipPaths.forEach((path) => {
      path.forEach((child, index) => {
        if (index === 0) return;
        const parent = path[index - 1];
        const levelName = levels[index]?.name || DEFAULT_ORGANISATION_STRUCTURE_LEVELS[index] || `Level ${index}`;
        addOrganisationParentRelationship(grouped, index, levelName, parent, child);
      });
    });
    grouped.forEach((row, index) => {
      levels[index] = {
        ...levels[index],
        ...(row.childrenByParent && Object.keys(row.childrenByParent).length > 0 ? { childrenByParent: row.childrenByParent } : {}),
        ...(row.parentByChild && Object.keys(row.parentByChild).length > 0 ? { parentByChild: row.parentByChild } : {}),
      };
    });
  }
  return {
    levelCount,
    levels,
    ...(relationshipPaths && relationshipPaths.length > 0 ? { relationshipPaths } : {}),
  };
};

const clampWholeNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normaliseStandardMissionProfiles = (source: unknown): StandardMissionProfile[] => {
  const rows = Array.isArray((source as any)?.profiles)
    ? (source as any).profiles
    : Array.isArray(source)
      ? source
      : [];
  return rows.map((row: any, index: number) => {
    const resourceType = STANDARD_MISSION_RESOURCE_TYPES.includes(row?.resourceType)
      ? row.resourceType as StandardMissionResourceType
      : 'Flight';
    const roleRequirements = Array.isArray(row?.roleRequirements)
      ? row.roleRequirements.map((requirement: any) => ({
          role: String(requirement?.role || 'Crew').trim() || 'Crew',
          count: clampWholeNumber(requirement?.count, 1, 1, 24),
        }))
      : [];
    return {
      id: String(row?.id || `standard-mission-${index + 1}`),
      status: String(row?.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      unitCode: String(row?.unitCode || '').trim().toUpperCase(),
      compositeUnitCode: String(row?.compositeUnitCode || '').trim().toUpperCase(),
      compositeProfileId: String(row?.compositeProfileId || '').trim(),
      aircraftTypeCode: String(row?.aircraftTypeCode || row?.aircraftType || '').trim().toUpperCase(),
      missionName: String(row?.missionName || row?.name || `Flight Profile ${index + 1}`),
      shortTitle: String(row?.shortTitle || row?.code || '').slice(0, 8),
      description: String(row?.description || ''),
      resourceType,
      departureLocationCode: String(row?.departureLocationCode || row?.departure || '').trim().toUpperCase(),
      arrivalLocationCode: String(row?.arrivalLocationCode || row?.arrival || '').trim().toUpperCase(),
      durationMinutes: clampWholeNumber(row?.durationMinutes, 240, 1, 1440),
      preFlightMinutes: clampWholeNumber(row?.preFlightMinutes, 90, 0, 1440),
      postFlightMinutes: clampWholeNumber(row?.postFlightMinutes, 60, 0, 1440),
      isFormation: row?.isFormation === true,
      formationAircraft: clampWholeNumber(row?.formationAircraft, 2, 2, 24),
      config: String(row?.config || 'ANY'),
      crewCompositionMode: ['STANDARD', 'ALTERNATE', 'CUSTOM'].includes(String(row?.crewCompositionMode || '').toUpperCase())
        ? String(row.crewCompositionMode).toUpperCase() as 'STANDARD' | 'ALTERNATE' | 'CUSTOM'
        : Array.isArray(row?.acceptableCrewCompositionIds) && String(row.acceptableCrewCompositionIds[0] || '').startsWith('alternate:')
          ? 'ALTERNATE'
          : Array.isArray(row?.acceptableCrewCompositionIds) && row.acceptableCrewCompositionIds.length > 0
            ? 'STANDARD'
            : 'CUSTOM',
      selectedCrewCompositionId: String(row?.selectedCrewCompositionId || (Array.isArray(row?.acceptableCrewCompositionIds) ? row.acceptableCrewCompositionIds[0] : '') || '').trim(),
      acceptableCrewCompositionIds: Array.isArray(row?.acceptableCrewCompositionIds)
        ? row.acceptableCrewCompositionIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
        : [],
      roleRequirements,
      defaultCallsignPrefix: String(row?.defaultCallsignPrefix || ''),
    };
  });
};

const DEPLOYMENT_MODE_OPTIONS = [
  'Online SaaS',
  'Private Defence Network',
  'Fully Offline',
  'Hybrid Offline Sync',
];

const LICENSE_VALIDATION_OPTIONS = [
  'Online licence check',
  'Private network licence server',
  'Offline signed licence file',
  'Hybrid cached licence',
];

const LICENSE_ENFORCEMENT_OPTIONS = [
  'Monitor Only',
  'Warn Only',
  'Block Expired Licence',
];

const AUTH_MODEL_OPTIONS = [
  'Local accounts',
  'Defence SSO',
  'Hybrid local and SSO',
];

const RELEASE_CHANNEL_OPTIONS = [
  'Production',
  'Staging',
  'Customer Acceptance',
  'Offline Package',
];

const BACKUP_FREQUENCY_OPTIONS = [
  'Hourly',
  'Daily',
  'Weekly',
  'Manual',
];

const COMMON_IANA_TIMEZONES = [
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Darwin',
  'Australia/Adelaide',
  'Europe/London',
  'America/Anchorage',
  'UTC',
];

const AIRFIELD_CATALOGUE_FILE = 'airfield-location-catalog.json';
const MAX_AIRFIELD_SUGGESTIONS = 6;
const PLATFORM_CONFIG_UPDATED_EVENT = 'dfp-platform-config-updated';
const SETTINGS_VISIBILITY_FILTERS: Array<{ value: SettingsVisibilityFilter; label: string; description: string }> = [
  {
    value: 'unit',
    label: 'Unit / Combined Unit',
    description: 'Only show scoped records tied to the current unit or combined-unit context.',
  },
  {
    value: 'location',
    label: 'Location',
    description: 'Only show scoped records tied to the current base or location.',
  },
  {
    value: 'aircraftType',
    label: 'Aircraft Type',
    description: 'Only show scoped records tied to the active aircraft type.',
  },
  {
    value: 'parentOrganisation',
    label: 'Parent Organisation',
    description: 'Only show scoped records tied to the organisation level above the current unit.',
  },
];
const DEFAULT_SETTINGS_VISIBILITY_POLICY: SettingsVisibilityPolicy = {
  enabled: false,
  filters: [],
};

const normaliseSettingsVisibilityPolicy = (value?: Partial<SettingsVisibilityPolicy> | null): SettingsVisibilityPolicy => {
  const validFilterValues = new Set(SETTINGS_VISIBILITY_FILTERS.map((option) => option.value));
  const filtersFromArray = Array.isArray(value?.filters)
    ? value!.filters.filter((filter): filter is SettingsVisibilityFilter => validFilterValues.has(filter as SettingsVisibilityFilter))
    : [];
  const legacyMode = value?.mode && validFilterValues.has(value.mode as SettingsVisibilityFilter)
    ? [value.mode as SettingsVisibilityFilter]
    : [];
  const filters = Array.from(new Set(filtersFromArray.length > 0 ? filtersFromArray : legacyMode));
  return {
    enabled: value?.enabled === true,
    filters,
  };
};

const getDefaultHasTraineesForUnit = (_unitCode: unknown): boolean => false;

const normaliseUnitTypes = (values: unknown, units: any[] = []): string[] => {
  const sourceValues = Array.isArray(values) ? values : [];
  const usedValues = Array.isArray(units) ? units.map((unit) => unit?.unitType) : [];
  const seen = new Set<string>();
  return [...sourceValues, ...usedValues]
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const unitTypeListsEqual = (left: string[] = [], right: string[] = []): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const applyDefaultUnitTraineeAvailability = (config: PlatformConfig): PlatformConfig => {
  if (!config || !Array.isArray(config.units)) return config;
  let changed = false;
  const units = config.units.map((unit) => {
    const settings = unit.settings || {};
    if (Object.prototype.hasOwnProperty.call(settings, 'hasTrainees')) return unit;
    changed = true;
    return {
      ...unit,
      settings: {
        ...settings,
        hasTrainees: getDefaultHasTraineesForUnit(unit.code),
      },
    };
  });
  const unitTypes = normaliseUnitTypes(config.unitTypes, units);
  return changed || !unitTypeListsEqual(unitTypes, config.unitTypes || []) ? { ...config, units, unitTypes } : config;
};

const normaliseSettingsPlatformConfig = (source?: Partial<PlatformConfig> | null): PlatformConfig => (
  applyDefaultUnitTraineeAvailability(normalisePlatformConfig(source))
);

const hasActivePlatformRecords = (records: Array<{ status?: string }>): boolean => (
  records.some((record) => String(record?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
);

const getPlatformConfigSaveBlocker = (config: PlatformConfig): string => {
  if (!hasActivePlatformRecords(config.organisations)) return 'Platform configuration save blocked: at least one active organisation is required.';
  if (!hasActivePlatformRecords(config.locations)) return 'Platform configuration save blocked: at least one active location is required.';
  if (!hasActivePlatformRecords(config.units)) return 'Platform configuration save blocked: at least one active unit is required.';
  return '';
};

const notifyPlatformConfigUpdated = (config: PlatformConfig) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLATFORM_CONFIG_UPDATED_EVENT, { detail: { config } }));
};

const notifyPlatformConfigUpdatedSoon = (config: PlatformConfig) => {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => notifyPlatformConfigUpdated(config), 0);
};

const normaliseOrganisationPathKey = (value: unknown): string => (
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const buildOrganisationOptionRenameMaps = (
  previousStructure: OrganisationStructureSettings,
  nextStructure: OrganisationStructureSettings,
): Map<number, Map<string, string>> => {
  const maps = new Map<number, Map<string, string>>();
  const maxLevels = Math.max(previousStructure.levels.length, nextStructure.levels.length);
  for (let levelIndex = 0; levelIndex < maxLevels; levelIndex += 1) {
    const previousOptions = previousStructure.levels[levelIndex]?.options || [];
    const nextOptions = nextStructure.levels[levelIndex]?.options || [];
    const nextOptionKeys = new Set(nextOptions.map(normaliseOrganisationPathKey));
    const levelMap = new Map<string, string>();
    previousOptions.forEach((previousOption, optionIndex) => {
      const nextOption = nextOptions[optionIndex];
      const previousKey = normaliseOrganisationPathKey(previousOption);
      if (!previousKey || !nextOption || normaliseOrganisationPathKey(nextOption) === previousKey || nextOptionKeys.has(previousKey)) return;
      levelMap.set(previousKey, String(nextOption || '').trim());
    });
    if (levelMap.size > 0) maps.set(levelIndex, levelMap);
  }
  return maps;
};

const applyOrganisationRenameMapValue = (value: unknown, renameMap?: Map<string, string>): string => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || !renameMap) return cleanValue;
  return renameMap.get(normaliseOrganisationPathKey(cleanValue)) || cleanValue;
};

const applyOrganisationStructureRenamesToStructure = (
  structure: OrganisationStructureSettings,
  renameMaps: Map<number, Map<string, string>>,
): OrganisationStructureSettings => {
  if (renameMaps.size === 0) return structure;
  const levels = structure.levels.map((level, levelIndex) => {
    const levelMap = renameMaps.get(levelIndex);
    const parentLevelMap = renameMaps.get(levelIndex - 1);
    const childrenByParent = level.childrenByParent
      ? Object.fromEntries(
          Object.entries(level.childrenByParent).map(([parent, children]) => [
            applyOrganisationRenameMapValue(parent, parentLevelMap),
            Array.from(new Set((children || []).map((child) => applyOrganisationRenameMapValue(child, levelMap)).filter(Boolean))),
          ]).filter(([parent, children]) => parent && (children as string[]).length > 0)
        )
      : undefined;
    const parentByChild = level.parentByChild
      ? Object.fromEntries(
          Object.entries(level.parentByChild)
            .map(([child, parent]) => [
              applyOrganisationRenameMapValue(child, levelMap),
              applyOrganisationRenameMapValue(parent, parentLevelMap),
            ])
            .filter(([child, parent]) => child && parent)
        )
      : undefined;
    return {
      ...level,
      ...(childrenByParent && Object.keys(childrenByParent).length > 0 ? { childrenByParent } : {}),
      ...(parentByChild && Object.keys(parentByChild).length > 0 ? { parentByChild } : {}),
    };
  });
  const relationshipPaths = structure.relationshipPaths?.map((path) => (
    path.map((part, levelIndex) => applyOrganisationRenameMapValue(part, renameMaps.get(levelIndex)))
  ));
  return {
    ...structure,
    levels,
    ...(relationshipPaths && relationshipPaths.length > 0 ? { relationshipPaths } : {}),
  };
};

const applyOrganisationStructureRenamesToUnits = (
  config: PlatformConfig,
  previousStructure: OrganisationStructureSettings,
  nextStructure: OrganisationStructureSettings,
): PlatformConfig => {
  const renameMaps = buildOrganisationOptionRenameMaps(previousStructure, nextStructure);
  if (renameMaps.size === 0) return config;
  let changed = false;
  const units = config.units.map((unit) => {
    const sourcePath = Array.isArray(unit?.settings?.parentOrganisationPath)
      ? unit.settings.parentOrganisationPath
      : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '').split('-');
    const cleanPath = sourcePath.map((part: unknown) => String(part || '').trim()).filter(Boolean);
    const nextPath = cleanPath.map((part: string, pathIndex: number) => {
      return applyOrganisationRenameMapValue(part, renameMaps.get(pathIndex + 1));
    });
    if (nextPath.join('\u0001') === cleanPath.join('\u0001')) return unit;
    changed = true;
    return {
      ...unit,
      settings: {
        ...(unit.settings || {}),
        parentOrganisationPath: nextPath,
        parentOrganisation: nextPath.join('-'),
      },
    };
  });
  return changed ? { ...config, units } : config;
};

const createClientRecordId = (prefix: string): string => (
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
);

const normaliseSeparationUnitCode = (value: unknown): string => (
  String(value || '').trim().toUpperCase()
);

const parseCompositeUnitCodes = (value: unknown): string[] => Array.from(new Set(
  String(value || '')
    .split(/[+/,;&|]+/)
    .map(normaliseSeparationUnitCode)
    .filter(Boolean)
));

const getCompositeCoverageCodes = (profile: { unitCode?: string; compositeUnitCode?: string }): string[] => {
  const compositeCodes = parseCompositeUnitCodes(profile.compositeUnitCode);
  if (compositeCodes.length > 1) return compositeCodes;
  const unitCodes = parseCompositeUnitCodes(profile.unitCode);
  return unitCodes.length > 1 ? unitCodes : [];
};

const getCompositeUnitLabel = (profile: { unitCode?: string; compositeUnitCode?: string }, unitCodes: string[]): string => (
  normaliseSeparationUnitCode(profile.compositeUnitCode)
  || (unitCodes.length > 1 ? unitCodes.join('+') : '')
);

const cloneCompositeProfileForUnit = <T extends {
  id: string;
  unitCode?: string;
  compositeUnitCode?: string;
  compositeProfileId?: string;
}>(profile: T, unitCode: string, compositeUnitCode: string, compositeProfileId: string, existingIds: Set<string>): T => {
  const baseId = compositeProfileId || profile.id || createClientRecordId('composite-profile');
  let id = `${baseId}-${unitCode.toLowerCase()}`;
  if (existingIds.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
  existingIds.add(id);
  return {
    ...profile,
    id,
    unitCode,
    compositeUnitCode,
    compositeProfileId: baseId,
  };
};

const ensureCompositeProfileUnitCoverage = <T extends {
  id: string;
  unitCode?: string;
  compositeUnitCode?: string;
  compositeProfileId?: string;
}>(profiles: T[]): T[] => {
  const next = profiles.map((profile) => {
    const memberUnitCodes = getCompositeCoverageCodes(profile);
    if (memberUnitCodes.length <= 1) return profile;
    return {
      ...profile,
      compositeUnitCode: getCompositeUnitLabel(profile, memberUnitCodes),
      compositeProfileId: profile.compositeProfileId || profile.id,
    };
  });
  const existingIds = new Set(next.map((profile) => profile.id));
  const clones: T[] = [];

  next.forEach((profile) => {
    const memberUnitCodes = getCompositeCoverageCodes(profile);
    if (memberUnitCodes.length <= 1) return;
    const compositeUnitCode = getCompositeUnitLabel(profile, memberUnitCodes);
    const compositeProfileId = profile.compositeProfileId || profile.id;
    const group = [...next, ...clones].filter((candidate) => (
      candidate.compositeProfileId === compositeProfileId
      || candidate.id === compositeProfileId
    ));
    memberUnitCodes.forEach((unitCode) => {
      const hasUnitRecord = group.some((candidate) => (
        normaliseSeparationUnitCode(candidate.unitCode) === unitCode
      ));
      if (hasUnitRecord) return;
      clones.push(cloneCompositeProfileForUnit(profile, unitCode, compositeUnitCode, compositeProfileId, existingIds));
    });
  });

  return clones.length > 0 ? [...next, ...clones] : next;
};

const buildSeparationReadyConfig = (source: PlatformConfig): PlatformConfig => {
  const organisations = source.organisations.map((organisation, organisationIndex) => {
    if (organisationIndex !== 0) return organisation;
    const settings = organisation.settings || {};
    const crewCompositionSettings = normaliseCrewCompositionSettings(settings.crewCompositionSettings || null);
    const standardMissionProfiles = normaliseStandardMissionProfiles(settings.standardMissionProfiles || null);
    const nextCrewCompositionSettings = normaliseCrewCompositionSettings({
      alternateCompositions: ensureCompositeProfileUnitCoverage(crewCompositionSettings.alternateCompositions),
      currencyProfiles: ensureCompositeProfileUnitCoverage(crewCompositionSettings.currencyProfiles),
    });
    const nextStandardMissionProfiles = normaliseStandardMissionProfiles({
      profiles: ensureCompositeProfileUnitCoverage(standardMissionProfiles),
    });
    return {
      ...organisation,
      settings: {
        ...settings,
        crewCompositionSettings: nextCrewCompositionSettings,
        standardMissionProfiles: { profiles: nextStandardMissionProfiles },
      },
    };
  });
  return { ...source, organisations };
};

const countMissingCompositeUnitProfileClones = (profiles: Array<{ unitCode?: string; compositeUnitCode?: string; compositeProfileId?: string }>): number => {
  const countedGroups = new Set<string>();
  return profiles.reduce((count, profile, index) => {
    const memberUnitCodes = getCompositeCoverageCodes(profile);
    if (memberUnitCodes.length <= 1) return count;
    const compositeProfileId = profile.compositeProfileId || '';
    const groupKey = compositeProfileId || `${normaliseSeparationUnitCode(profile.compositeUnitCode)}-${index}`;
    if (countedGroups.has(groupKey)) return count;
    countedGroups.add(groupKey);
    const group = profiles.filter((candidate) => (
      compositeProfileId
        ? candidate.compositeProfileId === compositeProfileId
        : normaliseSeparationUnitCode(candidate.compositeUnitCode) === normaliseSeparationUnitCode(profile.compositeUnitCode)
    ));
    const missing = memberUnitCodes.filter((unitCode) => !group.some((candidate) => (
      normaliseSeparationUnitCode(candidate.unitCode) === unitCode
    )));
    return count + missing.length;
  }, 0);
};

const getPendingCompositePlannerStorageKeys = (): string[] => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || '';
      if (key.startsWith('dfp_highest_priority_events_v1:') && /[+]/.test(key)) {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length > 0) keys.push(key);
      }
    }
    return keys;
  } catch {
    return [];
  }
};

const ACCREDITATION_STATUS_OPTIONS = [
  'Not started',
  'In preparation',
  'Submitted',
  'Approved',
  'Renewal due',
];

const DEFAULT_DEPLOYMENT_PROFILE = {
  mode: 'Online SaaS',
  validationMethod: 'Online licence check',
  enforcementMode: 'Monitor Only',
  offlineGraceDays: 30,
  checkIntervalHours: 24,
  authModel: 'Local accounts',
  dataResidence: 'Customer controlled',
  networkPosture: 'Internet connected SaaS',
  notes: '',
};

const DEFAULT_OPERATIONAL_RUNBOOK = {
  environmentName: 'Production',
  deploymentIdentifier: 'DFP-NEO-V2',
  releaseChannel: 'Production',
  supportOwner: '',
  supportContact: '',
  approvingAuthority: '',
  backupFrequency: 'Daily',
  backupRetentionDays: 30,
  backupStorageLocation: '',
  lastBackupDate: '',
  lastRestoreTestDate: '',
  restoreTimeObjectiveHours: 24,
  restorePointObjectiveHours: 24,
  maintenanceWindow: '',
  updateApprovalProcess: '',
  lastUpdateDate: '',
  evidenceExportPath: '',
  auditRetentionYears: 7,
  accreditationStatus: 'Not started',
  notes: '',
};

const OPERATIONAL_RUNBOOK_HELP: Record<string, string> = {
  environmentName: 'Name this installed system so administrators know what environment they are changing. Examples: Production, Training Network, Offline Test Rig. Text only; do not enter passwords, URLs or connection strings.',
  deploymentIdentifier: 'Use a stable short identifier for this deployment. Recommended format: letters, numbers and dashes, for example DFP-NEO-V2-CUSTOMER-PROD or CUSTOMER-OFFLINE-01.',
  releaseChannel: 'Select the update stream this system follows. Production is live use; Staging is pre-live testing; Customer Acceptance is formal customer test; Offline Package is an isolated deployment package.',
  supportOwner: 'Record who owns support for this deployment. Examples: Unit Admin Cell, Customer Support Desk, Systems Officer, or a named support team.',
  supportContact: 'Record how support is contacted. Acceptable formats include an email address, phone number, internal extension, or service desk queue name. Do not enter account passwords or secret tokens.',
  approvingAuthority: 'Record who can approve operational changes or software updates. Examples: Chief Instructor, SQNLDR Operations, System Owner, or Customer Change Board.',
  backupFrequency: 'Select how often the database and critical records are backed up. Choose the closest option to the approved local backup process.',
  backupRetentionDays: 'Enter the number of days backups are kept before disposal. Whole numbers only. Example: 30 means backups are retained for one month.',
  backupStorageLocation: 'Record the approved backup storage location. Correct examples: \\\\backup-server\\dfp-neo\\backups, /srv/dfp-neo/backups, D:\\DFP-NEO\\Backups, or Secure NAS - Aviation Systems Backup Share. Do not enter database URLs, passwords, access keys or tokens.',
  lastBackupDate: 'Date of the most recent successful backup. Use the date picker. Stored format is YYYY-MM-DD, for example 2026-05-14.',
  lastRestoreTestDate: 'Date a backup was last restored and proven to work. Use the date picker. Stored format is YYYY-MM-DD, for example 2026-05-14.',
  restoreTimeObjectiveHours: 'Maximum acceptable time to restore service after a major failure. Enter hours as a whole number. Example: 24 means service should be restored within one day.',
  restorePointObjectiveHours: 'Maximum acceptable amount of data loss after a restore. Enter hours as a whole number. Example: 24 means the restored system should be no more than one day behind.',
  maintenanceWindow: 'Record when planned outage or update work may occur. Examples: Tuesdays 1800-2000 local, after flying complete, or by customer approval only.',
  updateApprovalProcess: 'Describe how software updates are approved before use. Example: test in staging, supervisor review, customer change approval, then production release.',
  lastUpdateDate: 'Date the application or deployment package was last updated. Use the date picker. Stored format is YYYY-MM-DD, for example 2026-05-14.',
  evidenceExportPath: 'Record where exported audit evidence or legal record packs are stored. Correct examples: \\\\records-server\\dfp-neo\\audit-exports, /srv/dfp-neo/audit-exports, D:\\DFP-NEO\\Evidence, or Approved Records Share - DFP Exports. Do not enter passwords or tokens.',
  auditRetentionYears: 'Enter how many years audit logs and legal record evidence must be retained. Whole numbers only. Example: 7.',
  accreditationStatus: 'Select the current security or accreditation state for this deployment. This is an administrator record; it does not grant formal approval by itself.',
  notes: 'Add operational notes that help administrators understand this deployment. Do not record secrets, passwords, licence private keys, database URLs or access tokens.',
};

const OPERATIONAL_RUNBOOK_SECTION_HELP: Record<string, string> = {
  environmentIdentity: [
    `Environment Name: ${OPERATIONAL_RUNBOOK_HELP.environmentName}`,
    `Deployment Identifier: ${OPERATIONAL_RUNBOOK_HELP.deploymentIdentifier}`,
    `Release Channel: ${OPERATIONAL_RUNBOOK_HELP.releaseChannel}`,
    `Support Owner: ${OPERATIONAL_RUNBOOK_HELP.supportOwner}`,
    `Support Contact: ${OPERATIONAL_RUNBOOK_HELP.supportContact}`,
    `Approving Authority: ${OPERATIONAL_RUNBOOK_HELP.approvingAuthority}`,
  ].join('\n\n'),
  backupRestore: [
    `Backup Frequency: ${OPERATIONAL_RUNBOOK_HELP.backupFrequency}`,
    `Backup Retention Days: ${OPERATIONAL_RUNBOOK_HELP.backupRetentionDays}`,
    `Backup Storage Location: ${OPERATIONAL_RUNBOOK_HELP.backupStorageLocation}`,
    `Last Backup Date: ${OPERATIONAL_RUNBOOK_HELP.lastBackupDate}`,
    `Last Restore Test Date: ${OPERATIONAL_RUNBOOK_HELP.lastRestoreTestDate}`,
    `RTO Hours: ${OPERATIONAL_RUNBOOK_HELP.restoreTimeObjectiveHours}`,
    `RPO Hours: ${OPERATIONAL_RUNBOOK_HELP.restorePointObjectiveHours}`,
  ].join('\n\n'),
  updateEvidenceAccreditation: [
    `Maintenance Window: ${OPERATIONAL_RUNBOOK_HELP.maintenanceWindow}`,
    `Update Approval Process: ${OPERATIONAL_RUNBOOK_HELP.updateApprovalProcess}`,
    `Last Update Date: ${OPERATIONAL_RUNBOOK_HELP.lastUpdateDate}`,
    `Evidence Export Path: ${OPERATIONAL_RUNBOOK_HELP.evidenceExportPath}`,
    `Audit Retention Years: ${OPERATIONAL_RUNBOOK_HELP.auditRetentionYears}`,
    `Accreditation Status: ${OPERATIONAL_RUNBOOK_HELP.accreditationStatus}`,
    `Operational Notes: ${OPERATIONAL_RUNBOOK_HELP.notes}`,
  ].join('\n\n'),
};

const DEPLOYMENT_READINESS_ITEMS = [
  { id: 'localWebServer', label: 'Local web server defined', detail: 'Required for private network and fully offline installs.' },
  { id: 'localDatabase', label: 'Local database defined', detail: 'Postgres or approved customer database target is identified.' },
  { id: 'localAuthentication', label: 'Local authentication path defined', detail: 'Users can log in without public internet access.' },
  { id: 'localFileStorage', label: 'Local file storage path defined', detail: 'Attachments, exports and records have a customer-controlled storage path.' },
  { id: 'offlineLicenceFile', label: 'Offline licence file process defined', detail: 'Signed licence issue, import and renewal process is documented.' },
  { id: 'backupRestore', label: 'Backup and restore process defined', detail: 'Rollback and operational data restore are known before deployment.' },
  { id: 'auditExport', label: 'Audit export process defined', detail: 'Audit logs can be exported for legal and assurance review.' },
  { id: 'updateProcess', label: 'Update process defined', detail: 'Patch delivery and customer acceptance process is known.' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normaliseEnforcementMode = (value: any): string => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'monitor' || raw === 'monitor only') return 'Monitor Only';
  if (raw === 'warn' || raw === 'warn only') return 'Warn Only';
  if (raw === 'block' || raw === 'block expired' || raw === 'block expired licence') return 'Block Expired Licence';
  return 'Monitor Only';
};

const parseDateOnly = (value: any): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value).slice(0, 10));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateLabel = (value: any): string => {
  const parsed = parseDateOnly(value);
  if (!parsed) return 'Not set';
  return parsed.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' });
};

const formatCommercialLicenceDisplayName = (license: any): string => {
  const rawName = String(license?.licenseName || license?.licenseKey || '').trim();
  const neutralName = rawName
    .replace(/^RAAF\s+/i, '')
    .replace(/\s+Evaluation Licen[cs]e$/i, ' Initial Licence')
    .trim();
  return neutralName || 'Licence';
};

const getLicenceStatusSummary = (license: any) => {
  const status = String(license.status || 'ACTIVE').toUpperCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validFrom = parseDateOnly(license.validFrom);
  const validUntil = parseDateOnly(license.validUntil);
  const daysRemaining = validUntil ? Math.ceil((validUntil.getTime() - today.getTime()) / MS_PER_DAY) : null;

  if (status !== 'ACTIVE') {
    return {
      label: status || 'INACTIVE',
      detail: 'Licence is not currently active.',
      toneClass: 'border-gray-600 bg-gray-800 text-gray-200',
    };
  }

  if (validFrom && validFrom > today) {
    return {
      label: 'Future',
      detail: `Starts ${formatDateLabel(validFrom)}`,
      toneClass: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
    };
  }

  if (validUntil && validUntil < today) {
    return {
      label: 'Expired',
      detail: `Expired ${formatDateLabel(validUntil)}`,
      toneClass: 'border-red-500/40 bg-red-500/10 text-red-100',
    };
  }

  if (daysRemaining !== null && daysRemaining <= 30) {
    return {
      label: 'Expiring',
      detail: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`,
      toneClass: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-100',
    };
  }

  return {
    label: 'Active',
    detail: validUntil ? `Valid until ${formatDateLabel(validUntil)}` : 'No expiry date set',
    toneClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  };
};

type ConfigurationHealthSeverity = 'OK' | 'WARNING' | 'CRITICAL';

type ConfigurationHealthItem = {
  id: string;
  severity: ConfigurationHealthSeverity;
  area: string;
  title: string;
  detail: string;
  remediation?: string;
  settingsSection?: string;
  settingsSectionLabel?: string;
  focusUnitCode?: string;
  focusLocationCode?: string;
  focusResourcePoolCode?: string;
  focusAircraftTypeCode?: string;
  focusUserId?: string;
  focusSubsectionId?: string;
};

const isActiveRecord = (item: any): boolean => String(item?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';

const toIdentifier = (value: any): string => String(value || '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasUsableSolarLocation = (location: any): boolean => (
  isValidLatitude(location?.latitude)
  && isValidLongitude(location?.longitude)
  && isValidTimeZone(location?.timezone)
);

const validateSolarLocation = (location: any): string | null => {
  const label = location?.code || location?.name || 'Location';
  const hasAnySolarField = location?.latitude !== null && location?.latitude !== undefined && location?.latitude !== ''
    || location?.longitude !== null && location?.longitude !== undefined && location?.longitude !== ''
    || Boolean(String(location?.timezone || '').trim());

  if (!hasAnySolarField) return null;
  if (!isValidLatitude(location?.latitude)) return `${label}: latitude must be between -90 and 90.`;
  if (!isValidLongitude(location?.longitude)) return `${label}: longitude must be between -180 and 180.`;
  if (!isValidTimeZone(location?.timezone)) return `${label}: timezone must be a valid IANA timezone, for example Australia/Melbourne.`;
  return null;
};

const normaliseAirfieldLookupToken = (value: any): string => (
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
);

const getAirfieldCatalogueUrl = (): string => {
  const baseUrl = new URL((import.meta as any)?.env?.BASE_URL || './', window.location.href);
  return new URL(AIRFIELD_CATALOGUE_FILE, baseUrl).toString();
};

const getAirfieldPrimaryCode = (entry: AirfieldCatalogueEntry): string => (
  entry.c || entry.i || entry.l || ''
);

const getAirfieldDisplayCode = (entry: AirfieldCatalogueEntry): string => {
  const codes = [entry.c, entry.i, entry.l].filter(Boolean);
  return codes.length ? codes.join(' / ') : 'No code';
};

const getAirfieldDisplayLabel = (entry: AirfieldCatalogueEntry): string => {
  const city = entry.m && entry.m !== entry.n ? `, ${entry.m}` : '';
  const country = entry.y ? ` (${entry.y})` : '';
  return `${getAirfieldDisplayCode(entry)} - ${entry.n}${city}${country}`;
};

const buildAirfieldCatalogueLookup = (entries: AirfieldCatalogueEntry[]): AirfieldCatalogueLookup => {
  const exact = new Map<string, AirfieldCatalogueEntry>();
  const searchable = entries.map((entry) => {
    const codeText = [entry.c, entry.i, entry.l].filter(Boolean).join(' ');
    const nameText = [entry.n, entry.m, entry.y].filter(Boolean).join(' ');
    const tokens = [entry.c, entry.i, entry.l, entry.n].map(normaliseAirfieldLookupToken).filter(Boolean);
    tokens.forEach((token) => {
      if (!exact.has(token)) exact.set(token, entry);
    });
    return {
      entry,
      searchText: normaliseAirfieldLookupToken(`${codeText} ${nameText}`),
      codeText: normaliseAirfieldLookupToken(codeText),
      nameText: normaliseAirfieldLookupToken(nameText),
    };
  });
  return { exact, searchable };
};

const emptyAirfieldCatalogueLookup: AirfieldCatalogueLookup = {
  exact: new Map(),
  searchable: [],
};

const defaultAirfieldProfiles = Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES || {});

const getDefaultAirfieldProfileForCatalogueEntry = (entry: AirfieldCatalogueEntry): any | null => {
  const entryIcao = normaliseAirfieldLookupToken(entry.c);
  const entryName = normaliseAirfieldLookupToken(entry.n);
  const entryCity = normaliseAirfieldLookupToken(entry.m);
  return defaultAirfieldProfiles.find((profile: any) => {
    const profileIcao = normaliseAirfieldLookupToken(profile.icao);
    const profileName = normaliseAirfieldLookupToken(profile.name);
    const closeLatitude = Math.abs(Number(profile.latitude) - Number(entry.a)) < 0.02;
    const closeLongitude = Math.abs(Number(profile.longitude) - Number(entry.o)) < 0.02;
    return (entryIcao && profileIcao === entryIcao)
      || ((entryName === profileName || entryCity === profileName) && closeLatitude && closeLongitude);
  }) || null;
};

const getAirfieldCatalogueIcaoCode = (entry: AirfieldCatalogueEntry): string => {
  const profile = getDefaultAirfieldProfileForCatalogueEntry(entry);
  return entry.c || profile?.icao || entry.l || '';
};

const getAirfieldCatalogueIataCode = (entry: AirfieldCatalogueEntry): string => {
  const profile = getDefaultAirfieldProfileForCatalogueEntry(entry);
  return entry.i || profile?.iataCode || profile?.code || '';
};

const getAirfieldCatalogueSuggestionsForQuery = (
  value: any,
  lookup: AirfieldCatalogueLookup,
): AirfieldCatalogueEntry[] => {
  const query = normaliseAirfieldLookupToken(value);
  if (query.length < 2 || lookup.searchable.length === 0) return [];

  const scored = lookup.searchable
    .map((item) => {
      let score = 0;
      if (item.codeText === query) score = 100;
      else if (item.nameText === query) score = 95;
      else if (item.codeText.startsWith(query)) score = 85;
      else if (item.nameText.startsWith(query)) score = 75;
      else if (item.searchText.includes(query)) score = 55;
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || getAirfieldPrimaryCode(left.entry).localeCompare(getAirfieldPrimaryCode(right.entry))
      || left.entry.n.localeCompare(right.entry.n)
    ));

  const seen = new Set<string>();
  const suggestions: AirfieldCatalogueEntry[] = [];
  scored.forEach(({ entry }) => {
    const key = `${entry.c}|${entry.i}|${entry.l}|${entry.n}|${entry.a}|${entry.o}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(entry);
  });
  return suggestions.slice(0, MAX_AIRFIELD_SUGGESTIONS);
};

const getCurrentTimezoneOffsetHours = (timezone: string): number | null => {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const localAsUtc = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    );
    return Math.round(((localAsUtc - now.getTime()) / (60 * 60 * 1000)) * 4) / 4;
  } catch {
    return null;
  }
};

const getAirfieldCatalogueLocationChanges = (
  entry: AirfieldCatalogueEntry,
  currentLocation: any,
  fillIdentity = true,
): Record<string, any> => {
  const defaultProfile = getDefaultAirfieldProfileForCatalogueEntry(entry);
  const timezone = defaultProfile?.timezone || entry.t;
  const changes: Record<string, any> = {
    iataCode: getAirfieldCatalogueIataCode(entry),
    latitude: defaultProfile?.latitude ?? entry.a,
    longitude: defaultProfile?.longitude ?? entry.o,
    timezone,
  };
  const currentOffset = getCurrentTimezoneOffsetHours(timezone);
  if (currentOffset !== null) changes.timezoneOffset = currentOffset;
  if (fillIdentity) {
    const icaoCode = getAirfieldCatalogueIcaoCode(entry);
    if (icaoCode) changes.code = icaoCode;
    changes.name = entry.n;
  }
  return changes;
};

const getPlatformLocationAuditKey = (location: any): string => (
  String(location?.id || location?.code || location?.name || '').trim().toLowerCase()
);

const getPlatformLocationAuditLabel = (location: any): string => {
  const code = String(location?.code || '').trim();
  const name = String(location?.name || '').trim();
  if (code && name) return `${code} - ${name}`;
  return code || name || 'Unnamed location';
};

const uniqueValues = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));
const getConfigurationHealthFocusAnchor = (value: any) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');

type ConfigurationHealthSettingsTarget = {
  section: string;
  label: string;
  focusUnitCode?: string;
  focusLocationCode?: string;
  focusResourcePoolCode?: string;
  focusAircraftTypeCode?: string;
  focusUserId?: string;
  focusSubsectionId?: string;
};

const getConfigurationHealthSettingsLink = (area: string, title: string): ConfigurationHealthSettingsTarget | null => {
  const lowerTitle = title.toLowerCase();
  if (area === 'Organisation' || area === 'Locations') {
    return { section: 'platform-organisation-locations', label: 'Organisation, Bases & Areas' };
  }
  if (area === 'Units') {
    return { section: 'platform-units', label: 'Units & Ownership' };
  }
  if (area === 'Modules') {
    return { section: 'platform-unit-modules', label: 'Unit Features & Modules' };
  }
  if (area === 'Resource Pools') {
    return { section: 'platform-resource-pools', label: 'Aircraft & Resource Pools' };
  }
  if (area === 'User Access') {
    return { section: 'platform-user-access', label: 'User Access' };
  }
  if (area === 'Permission Profiles') {
    return { section: 'platform-permission-profiles', label: 'Permission Profiles' };
  }
  if (area === 'Licensing') {
    return { section: 'platform-licensing', label: 'Licensing & Deployment' };
  }
  if (area === 'Deployment Readiness') {
    return { section: 'platform-deployment-readiness', label: 'Deployment Readiness' };
  }
  if (area === 'Operational Runbook') {
    return { section: 'platform-operational-runbook', label: 'Operational Runbook' };
  }
  if (area === 'Unit Separation') {
    if (lowerTitle.includes('resource')) {
      return { section: 'platform-resource-pools', label: 'Aircraft & Resource Pools' };
    }
    if (lowerTitle.includes('profiles')) {
      return { section: 'platform-standard-missions', label: 'Reusable Flight Profiles' };
    }
  }
  return null;
};

const getDefaultConfigurationHealthRemediation = (area: string, title: string): string => {
  const lowerTitle = title.toLowerCase();
  if (area === 'Organisation') {
    return 'Open Organisation and create or reactivate the operating organisation. Example: code ORG, name Operating Organisation, status ACTIVE.';
  }
  if (area === 'Locations') {
    if (lowerTitle.includes('organisation')) {
      return 'Open Locations, then assign the location to an active organisation or reactivate the referenced organisation.';
    }
    return 'Open Locations, then create or reactivate the location and at least one unit at that location.';
  }
  if (area === 'Units') {
    return 'Open Units and assign the unit to an active location, or reactivate the correct location before saving.';
  }
  if (area === 'Modules') {
    return 'Open the unit/module setup area and enable the required app areas for that unit, or deactivate unused modules if they are not required.';
  }
  if (area === 'Resource Pools') {
    if (lowerTitle.includes('no usable resources')) {
      return 'Open the Resource Pools section, enter non-zero counts for the DFP resource rows such as aircraft, simulator, procedural trainer, STBY or Ground, then save.';
    }
    return 'Open Resource Pools and correct the pool location, unit, aircraft type and resource counts so they match active platform records.';
  }
  if (area === 'User Access') {
    if (lowerTitle.includes('no permission profile')) {
      return 'Open User Access Context, search for the user, then tick at least one permission profile such as Instructor, Scheduler or Unit Admin.';
    }
    if (lowerTitle.includes('unknown permission profile')) {
      return 'Open User Access Context and remove the unknown profile, or recreate that profile in Permission Profiles before assigning it.';
    }
    return 'Open User Access Context, search for the user, then correct the active access scope so the user, location, unit and feature area match active records.';
  }
  if (area === 'Permission Profiles') {
    return 'Open Permission Profiles and tick the capabilities this profile should grant, or remove the profile if it is no longer used.';
  }
  if (area === 'Licensing') {
    if (lowerTitle.includes('expired')) {
      return 'Open Licensing, enter a current valid-until date or install a renewed licence file/key, then save.';
    }
    return 'Open Licensing and add, activate or complete the licence record. For a perpetual licence, record that deliberately in the licence notes.';
  }
  if (area === 'Deployment Readiness') {
    return 'Open Deployment Readiness and complete the missing checklist fields, especially local database, authentication, file storage, licence and update process items.';
  }
  if (area === 'Operational Runbook') {
    return 'Open Operational Runbook and complete support, backup, restore, update, audit and accreditation fields using the help icon examples beside each section.';
  }
  return 'Open the matching Settings section, correct the referenced record, save that section, and recheck Configuration Health.';
};

const buildConfigurationHealth = (
  config: PlatformConfig,
  permissionProfiles: PermissionProfile[],
  readinessPercent: number,
  operationalReadinessPercent: number,
): ConfigurationHealthItem[] => {
  const items: ConfigurationHealthItem[] = [];
  const add = (
    severity: ConfigurationHealthSeverity,
    area: string,
    title: string,
    detail: string,
    idSuffix = `${area}-${title}-${items.length}`,
    remediation?: string,
    focusTarget?: Partial<ConfigurationHealthSettingsTarget>,
  ) => {
    const settingsLink = severity === 'OK' ? null : getConfigurationHealthSettingsLink(area, title);
    items.push({
      id: `${severity}-${idSuffix}`.replace(/\s+/g, '-').toLowerCase(),
      severity,
      area,
      title,
      detail,
      remediation: severity === 'OK' ? undefined : remediation || getDefaultConfigurationHealthRemediation(area, title),
      settingsSection: focusTarget?.section || settingsLink?.section,
      settingsSectionLabel: focusTarget?.label || settingsLink?.label,
      focusUnitCode: focusTarget?.focusUnitCode,
      focusLocationCode: focusTarget?.focusLocationCode,
      focusResourcePoolCode: focusTarget?.focusResourcePoolCode,
      focusAircraftTypeCode: focusTarget?.focusAircraftTypeCode,
      focusUserId: focusTarget?.focusUserId,
      focusSubsectionId: focusTarget?.focusSubsectionId,
    });
  };

  const activeOrganisations = config.organisations.filter(isActiveRecord);
  const activeLocations = config.locations.filter(isActiveRecord);
  const activeUnits = config.units.filter(isActiveRecord);
  const activeAircraftTypes = config.aircraftTypes.filter(isActiveRecord);
  const activeModules = config.modules.filter(isActiveRecord);
  const activeResourcePools = config.resourcePools.filter(isActiveRecord);
  const activeLicences = config.licenses.filter(isActiveRecord);
  const activeUserAccess = config.userAccess.filter(isActiveRecord);
  const organisationSettings = config.organisations[0]?.settings || {};
  const crewCompositionSettings = normaliseCrewCompositionSettings(organisationSettings.crewCompositionSettings || null);
  const standardMissionProfiles = normaliseStandardMissionProfiles(organisationSettings.standardMissionProfiles || null);

  const activeOrganisationCodes = new Set(activeOrganisations.map((org) => toIdentifier(org.code)));
  const activeLocationCodes = new Set(activeLocations.map((location) => toIdentifier(location.code)));
  const activeUnitCodes = new Set(activeUnits.map((unit) => toIdentifier(unit.code)));
  const activeAircraftTypeCodes = new Set(activeAircraftTypes.map((aircraft) => toIdentifier(aircraft.code)));
  const activeModuleCodes = new Set(activeModules.map((module) => toIdentifier(module.code)));
  const userIds = new Set(config.platformUsers.flatMap((user) => uniqueValues([user.userId, user.username].map(toIdentifier))));
  const profileIds = new Set(permissionProfiles.map((profile) => toIdentifier(profile.id)));

  if (activeOrganisations.length === 0) {
    add('CRITICAL', 'Organisation', 'No active organisation', 'At least one active organisation is required before the platform can be managed as a commercial deployment.', 'organisation-none', undefined, { focusSubsectionId: 'platform-organisation' });
  } else {
    add('OK', 'Organisation', 'Active organisation exists', `${activeOrganisations.length} active organisation${activeOrganisations.length === 1 ? '' : 's'} available for configuration.`, 'organisation-active');
  }

  if (activeLocations.length === 0) {
    add('CRITICAL', 'Locations', 'No active locations', 'The location selector, staff lists and DFP schedule need at least one active location.', 'locations-none', undefined, { focusSubsectionId: 'platform-locations' });
  } else {
    add('OK', 'Locations', 'Active locations exist', `${activeLocations.length} active location${activeLocations.length === 1 ? '' : 's'} available.`, 'locations-active');
  }

  activeLocations.forEach((location) => {
    const locationCode = toIdentifier(location.code);
    const organisationCode = toIdentifier(location.organisationCode);
    if (organisationCode && !activeOrganisationCodes.has(organisationCode)) {
      add('WARNING', 'Locations', `${locationCode} references inactive organisation`, `${locationCode} points to ${organisationCode}, which is not an active organisation.`, `location-${locationCode}-org`, undefined, { focusLocationCode: locationCode });
    }
    if (!hasUsableSolarLocation(location)) {
      const defaultProfile = getDefaultAirfieldSolarProfile(location.code) || getDefaultAirfieldSolarProfile(location.name);
      add(
        'WARNING',
        'Locations',
        `${locationCode} daylight data incomplete`,
        defaultProfile
          ? 'The app can currently fall back to a system daylight profile for this known location, but the location should store its own latitude, longitude and IANA timezone for offline daylight calculations.'
          : 'Offline FL/LL calculation needs latitude, longitude and an IANA timezone for this location.',
        `location-${locationCode}-solar`,
        undefined,
        { focusLocationCode: locationCode }
      );
    }
    const unitsAtLocation = activeUnits.filter((unit) => toIdentifier(unit.locationCode) === locationCode);
    if (unitsAtLocation.length === 0) {
      add('WARNING', 'Locations', `${locationCode} has no active units`, 'Users may be able to select the location, but unit-aware scheduling and access scoping will be incomplete.', `location-${locationCode}-units`, undefined, { focusLocationCode: locationCode });
    }
  });

  if (activeUnits.length === 0) {
    add('CRITICAL', 'Units', 'No active units', 'At least one active unit is needed for commercial unit-based configuration.', 'units-none', undefined, { focusSubsectionId: 'platform-units' });
  }

  activeUnits.forEach((unit) => {
    const unitCode = toIdentifier(unit.code);
    const locationCode = toIdentifier(unit.locationCode);
    if (!locationCode || !activeLocationCodes.has(locationCode)) {
      add('CRITICAL', 'Units', `${unitCode} has invalid location`, `The unit is assigned to "${locationCode || 'blank'}", which is not an active location.`, `unit-${unitCode}-location`, undefined, { focusUnitCode: unitCode });
    }

    const enabledModules = activeModules.filter((module) => {
      const unitModule = config.unitModules.find((item) => toIdentifier(item.unitCode) === unitCode && toIdentifier(item.moduleCode) === toIdentifier(module.code));
      return unitModule?.isEnabled !== false;
    });
    if (enabledModules.length === 0) {
      add('WARNING', 'Modules', `${unitCode} has no enabled modules`, 'The unit exists, but no active app areas are enabled for it.', `unit-${unitCode}-modules`, undefined, { focusSubsectionId: `platform-unit-modules-${getConfigurationHealthFocusAnchor(unitCode)}` });
    }

    const matchingPools = activeResourcePools.filter((pool) => (
      toIdentifier(pool.unitCode) === unitCode
      || (!toIdentifier(pool.unitCode) && toIdentifier(pool.locationCode) === locationCode)
    ));
    if (matchingPools.length === 0) {
      add('WARNING', 'Resource Pools', `${unitCode} has no active resource pool`, 'DFP resource counts may use fallback row counts until a matching pool is configured.', `unit-${unitCode}-pools`, undefined, { focusSubsectionId: 'platform-resource-pools' });
    }

    const operationalModel = getUnitOperationalModel(unit);
    if (isFixedCrewLikeOperationalModel(operationalModel)) {
      const unitRuntimePools = activeResourcePools.filter((pool) => (
        toIdentifier(pool.unitCode) === unitCode
      ));
      const sharedOrLocationRuntimePools = activeResourcePools.filter((pool) => (
        toIdentifier(pool.locationCode) === locationCode &&
        (!toIdentifier(pool.unitCode) || String(pool.poolType || '').trim().toLowerCase() === 'shared')
      ));
      if (unitRuntimePools.length === 0 && sharedOrLocationRuntimePools.length > 0) {
        add(
          'WARNING',
          'Unit Separation',
          `${unitCode} will use shared resource capacity`,
          `${unitCode} is a Fixed Crew unit without its own DFP resource pool. It can still schedule by falling back to shared or location capacity, but separated-unit builds may not reflect a dedicated unit allocation.`,
          `unit-${unitCode}-separation-resource-pool`,
          'Open Aircraft & Resource Pools and add or enable a unit-specific pool if this unit needs independent aircraft, simulator or trainer capacity after separation.',
          { focusSubsectionId: 'platform-resource-pools' }
        );
      }
    }
  });

  if (activeUnits.length > 0 && !items.some((item) => item.area === 'Units' && item.severity === 'CRITICAL')) {
    add('OK', 'Units', 'Active units are linked to locations', 'No active unit is pointing at a missing or inactive location.', 'units-linked');
  }

  activeResourcePools.forEach((pool) => {
    const poolName = toIdentifier(pool.name) || toIdentifier(pool.code) || 'Resource pool';
    const locationCode = toIdentifier(pool.locationCode);
    const unitCode = toIdentifier(pool.unitCode);
    const aircraftTypeCode = toIdentifier(pool.aircraftTypeCode);

    if (locationCode && !activeLocationCodes.has(locationCode)) {
      add('CRITICAL', 'Resource Pools', `${poolName} has invalid location`, `${poolName} points to ${locationCode}, which is not an active location.`, `pool-${poolName}-location`, undefined, { focusResourcePoolCode: toIdentifier(pool.id) || toIdentifier(pool.code) || poolName });
    }
    if (unitCode && !activeUnitCodes.has(unitCode)) {
      add('CRITICAL', 'Resource Pools', `${poolName} has invalid unit`, `${poolName} points to ${unitCode}, which is not an active unit.`, `pool-${poolName}-unit`, undefined, { focusResourcePoolCode: toIdentifier(pool.id) || toIdentifier(pool.code) || poolName });
    }
    if (aircraftTypeCode && !activeAircraftTypeCodes.has(aircraftTypeCode)) {
      add('WARNING', 'Resource Pools', `${poolName} has invalid aircraft type`, `${poolName} points to ${aircraftTypeCode}, which is not an active aircraft type.`, `pool-${poolName}-aircraft`, undefined, { focusResourcePoolCode: toIdentifier(pool.id) || toIdentifier(pool.code) || poolName });
    }
    const totalResources = ['aircraft', 'ftd', 'cpt', 'standby', 'ground']
      .reduce((sum, key) => sum + toNumber(pool.settings?.[key]), 0);
    if (totalResources <= 0) {
      add('CRITICAL', 'Resource Pools', `${poolName} has no usable resources`, 'This pool controls DFP resource rows, but all resource counts are zero or blank.', `pool-${poolName}-empty`, undefined, { focusResourcePoolCode: toIdentifier(pool.id) || toIdentifier(pool.code) || poolName });
    }
  });

  if (activeResourcePools.length === 0) {
    add('WARNING', 'Resource Pools', 'No active DFP resource pool', 'At least one active resource pool is needed before DFP resource rows can come from platform configuration.', 'runtime-pool-none', undefined, { focusSubsectionId: 'platform-resource-pools' });
  } else if (!items.some((item) => item.area === 'Resource Pools' && item.severity === 'CRITICAL')) {
    add('OK', 'Resource Pools', 'DFP resource rows are configured', `${activeResourcePools.length} active resource pool${activeResourcePools.length === 1 ? '' : 's'} can feed DFP resource rows.`, 'runtime-pool-active');
  }

  const missingAlternateClones = countMissingCompositeUnitProfileClones(crewCompositionSettings.alternateCompositions);
  const missingCurrencyClones = countMissingCompositeUnitProfileClones(crewCompositionSettings.currencyProfiles);
  const missingMissionClones = countMissingCompositeUnitProfileClones(standardMissionProfiles);
  const missingCompositeClones = missingAlternateClones + missingCurrencyClones + missingMissionClones;
  if (missingCompositeClones > 0) {
    add(
      'WARNING',
      'Unit Separation',
      'Combined-unit profiles need per-unit copies',
      `${missingCompositeClones} unit-scoped reusable flight profile, alternate crew or currency record${missingCompositeClones === 1 ? '' : 's'} will be created the next time the affected settings section is saved, so separated units can continue to see them.`,
      'unit-separation-profile-clones',
      'Open Reusable Flight Profiles, press Edit, then Save. If the missing records are alternate crew or continuation/currency records, also open the matching settings section and save it.',
      { section: 'platform-standard-missions', label: 'Reusable Flight Profiles', focusSubsectionId: 'platform-standard-missions' }
    );
  } else {
    add('OK', 'Unit Separation', 'Combined-unit profiles are split-ready', 'Reusable flight profiles, alternate crew profiles and continuation/currency events have per-unit records where needed.', 'unit-separation-profiles-ok');
  }

  const pendingCompositePlannerKeys = getPendingCompositePlannerStorageKeys();
  if (pendingCompositePlannerKeys.length > 0) {
    add(
      'WARNING',
      'Unit Separation',
      'Pending combined Build Planner rows exist',
      `${pendingCompositePlannerKeys.length} combined-unit Highest Priority event list${pendingCompositePlannerKeys.length === 1 ? '' : 's'} still has pending rows. Those rows are stored under the combined unit context and will not automatically appear in separated unit planners.`,
      'unit-separation-pending-priority',
      'Publish, delete, or manually recreate pending combined-unit Highest Priority rows in the intended unit before relying on separated builds.'
    );
  }

  activeUserAccess.forEach((access) => {
    const userId = toIdentifier(access.userId);
    const userLabel = access.displayName || userId || 'Unknown user';
    const locationCode = toIdentifier(access.locationCode);
    const unitCode = toIdentifier(access.unitCode);
    const moduleCode = toIdentifier(access.moduleCode);
    const assignedProfiles = Array.isArray(access.settings?.permissionProfileIds) ? access.settings.permissionProfileIds.map(toIdentifier).filter(Boolean) : [];

    if (!userId || !userIds.has(userId)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid user record`, 'The access scope points to a user that is not present in the platform user list.', `access-${userId || userLabel}-user`, undefined, { focusUserId: userId, focusSubsectionId: 'platform-user-access-records' });
    }
    if (locationCode && !activeLocationCodes.has(locationCode)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid location scope`, `${locationCode} is not an active location.`, `access-${userId}-${locationCode}`, undefined, { focusUserId: userId, focusLocationCode: locationCode, focusSubsectionId: `platform-user-access-location-${getConfigurationHealthFocusAnchor(locationCode)}` });
    }
    if (unitCode && !activeUnitCodes.has(unitCode)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid unit scope`, `${unitCode} is not an active unit.`, `access-${userId}-${unitCode}`, undefined, { focusUserId: userId, focusSubsectionId: 'platform-user-access-records' });
    }
    const unit = unitCode ? config.units.find((item) => toIdentifier(item.code) === unitCode) : null;
    if (unit && locationCode && toIdentifier(unit.locationCode) !== locationCode) {
      add('CRITICAL', 'User Access', `${userLabel} has mismatched scope`, `${unitCode} belongs to ${toIdentifier(unit.locationCode)}, but the access scope is set to ${locationCode}.`, `access-${userId}-${unitCode}-mismatch`, undefined, { focusUserId: userId, focusLocationCode: locationCode, focusSubsectionId: `platform-user-access-location-${getConfigurationHealthFocusAnchor(locationCode)}` });
    }
    if (moduleCode && !activeModuleCodes.has(moduleCode)) {
      add('WARNING', 'User Access', `${userLabel} has inactive feature-area scope`, `${moduleCode} is not an active module. Use "All Enabled Features" unless a deliberate one-area restriction is required.`, `access-${userId}-${moduleCode}`, undefined, { focusUserId: userId, focusSubsectionId: 'platform-user-access-records' });
    }
    if (assignedProfiles.length === 0) {
      add('WARNING', 'User Access', `${userLabel} has no permission profile`, 'The scope defines where the user can work, but no profile defines what they can do there.', `access-${userId}-profiles-none`, undefined, { focusUserId: userId, focusSubsectionId: 'platform-user-access-records' });
    }
    assignedProfiles.forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        add('WARNING', 'User Access', `${userLabel} has unknown permission profile`, `${profileId} is assigned but does not exist in Permission Profiles.`, `access-${userId}-profile-${profileId}`, undefined, { focusUserId: userId, focusSubsectionId: 'platform-user-access-records' });
      }
    });
  });

  const activeUsersWithAccess = uniqueValues(activeUserAccess.map((access) => toIdentifier(access.userId)));
  if (activeUsersWithAccess.length === 0) {
    add('CRITICAL', 'User Access', 'No users have active access', 'No active user access scopes exist. Administrators may be locked out after enforcement is tightened.', 'access-none', undefined, { focusSubsectionId: 'platform-user-access-records' });
  } else if (!items.some((item) => item.area === 'User Access' && item.severity === 'CRITICAL')) {
    add('OK', 'User Access', 'User scopes are structurally valid', `${activeUsersWithAccess.length} user${activeUsersWithAccess.length === 1 ? '' : 's'} have active access scopes without invalid location or unit references.`, 'access-valid');
  }

  permissionProfiles.forEach((profile) => {
    if (!Array.isArray(profile.permissions) || profile.permissions.length === 0) {
      add('WARNING', 'Permission Profiles', `${profile.name || profile.id} has no permissions`, 'Users assigned this profile will not gain any capability from it.', `profile-${profile.id}-empty`, undefined, { focusSubsectionId: 'platform-permission-profiles' });
    }
  });
  if (permissionProfiles.length > 0 && !items.some((item) => item.area === 'Permission Profiles' && item.severity !== 'OK')) {
    add('OK', 'Permission Profiles', 'Permission profiles are populated', `${permissionProfiles.length} reusable permission profile${permissionProfiles.length === 1 ? '' : 's'} are available.`, 'profiles-ok');
  }

  activeModules.forEach((module) => {
    const moduleCode = toIdentifier(module.code);
    const enabledSomewhere = activeUnits.some((unit) => {
      const unitModule = config.unitModules.find((item) => toIdentifier(item.unitCode) === toIdentifier(unit.code) && toIdentifier(item.moduleCode) === moduleCode);
      return unitModule?.isEnabled !== false;
    });
    if (!enabledSomewhere) {
      add('WARNING', 'Modules', `${moduleCode} is active but unused`, 'The module is active globally but is not enabled for any active unit.', `module-${moduleCode}-unused`, undefined, { focusSubsectionId: 'platform-unit-modules' });
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activeLicences.length === 0) {
    add('WARNING', 'Licensing', 'No active licence record', 'Operational deployments should have at least one active licence record.', 'licence-none', undefined, { focusSubsectionId: 'platform-license-records' });
  } else {
    activeLicences.forEach((license) => {
      const licenseName = formatCommercialLicenceDisplayName(license);
      const licenseKey = toIdentifier(license.licenseKey || license.id || licenseName);
      const validUntil = parseDateOnly(license.validUntil);
      if (validUntil && validUntil < today) {
        add('CRITICAL', 'Licensing', `${licenseName} is expired`, `Expired on ${formatDateLabel(validUntil)}.`, `licence-${licenseKey || licenseName}-expired`, undefined, { focusSubsectionId: 'platform-license-records' });
      } else if (!validUntil) {
        add('WARNING', 'Licensing', `${licenseName} has no expiry date`, 'This may be acceptable for a perpetual licence, but it should be deliberate and recorded.', `licence-${licenseKey || licenseName}-no-expiry`, undefined, { focusSubsectionId: 'platform-license-records' });
      }
    });
    if (!items.some((item) => item.area === 'Licensing' && item.severity === 'CRITICAL')) {
      add('OK', 'Licensing', 'Active licence record exists', `${activeLicences.length} active licence record${activeLicences.length === 1 ? '' : 's'} found.`, 'licence-active');
    }
  }

  if (readinessPercent < 100) {
    add('WARNING', 'Deployment Readiness', 'Deployment checklist incomplete', `Offline and private-network readiness is ${readinessPercent}% complete.`, 'deployment-readiness', undefined, { focusSubsectionId: 'platform-deployment-profile' });
  } else {
    add('OK', 'Deployment Readiness', 'Deployment checklist complete', 'All deployment readiness checks are recorded.', 'deployment-readiness-ok');
  }

  if (operationalReadinessPercent < 100) {
    add('WARNING', 'Operational Runbook', 'Operational runbook incomplete', `Support, backup, restore, update and evidence readiness is ${operationalReadinessPercent}% complete.`, 'runbook-readiness', undefined, { focusSubsectionId: 'platform-operational-runbook-identity' });
  } else {
    add('OK', 'Operational Runbook', 'Operational runbook complete', 'Support, backup, restore, update and evidence records are complete.', 'runbook-readiness-ok');
  }

  const severityRank: Record<ConfigurationHealthSeverity, number> = { CRITICAL: 0, WARNING: 1, OK: 2 };
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.area.localeCompare(b.area) || a.title.localeCompare(b.title));
};

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const TRAINING_REPORT_OVERVIEW_FIELD_INFO: Record<string, string> = {
  event: 'The label for the assessed event code or sortie identifier. This is the short reference users recognise on the program, DFP and syllabus, such as AA1, IC02 or a mission code.',
  training: 'The label for the training stream that owns the event. In Flight School this may be a course or LMP; in Air Combat it may be a course, package or assigned training sequence.',
  type: 'The label for the activity classification or event description. It helps the assessor distinguish whether the report is for a flight, simulator, ground event, mission sortie or other model-specific event type.',
  timing: 'The label for the scheduled timing summary. This normally shows the planned start time and duration used to identify the training opportunity being assessed.',
  resource: 'The label for the platform or resource used during the event. This may be an aircraft, simulator, procedural trainer, ground room or another configured resource.',
  callsign: 'The label for the operational callsign recorded against the event. For formation sorties this helps connect the report to the correct formation element.',
  unit: 'The label for the unit context attached to the report. This keeps reports separated correctly across organisations, locations and operational units.',
  date: 'The label for the date the event/report applies to. This date is used for training history, recency and report ordering.',
  assessor: 'The label for the person completing or signing the report. Organisations may call this instructor, assessor, supervisor, check pilot or another local term.',
};

const TRAINING_REPORT_OVERALL_FIELD_INFO: Record<string, string> = {
  result: 'The label for the mission status outcome. If no mission status options are enabled, reports default to Complete. If options are enabled, only those configured options are shown.',
  overallGrade: 'The label for the assessor’s whole-mission grade. This is the single grade used for progression, repeat-rule checks and historical trend analysis.',
  overallResult: 'The label for the final satisfactory/unsatisfactory style outcome. The organisation can rename the visible text while the system keeps the underlying success/unsuccessful function intact.',
  groundSchoolAssessment: 'The label for an optional ground-school assessment result. This is used when an event also records a separate academic or ground assessment percentage.',
};

const TRAINING_REPORT_COMMENT_FIELD_INFO: Record<string, string> = {
  assessor: 'The label for the assessor reference in the narrative area. It can identify who debriefed or authored the report when that needs to appear separately from the report signer.',
  weather: 'The label for environmental or contextual notes. Typical use is weather, range conditions, operational constraints or anything that affected the training event.',
  profile: 'The label for the planned or flown profile narrative. This is where users describe the sequence of activities, sortie flow or training profile being assessed.',
  overall: 'The label for the main assessor narrative. This is the broad training judgement: what happened, why it mattered and what the staff member or trainee should focus on next.',
  nest: 'The label for a short local reference field. It can be kept as NEST, renamed to another local tracking code, or used for a compact administrative reference.',
  notes: 'The label for additional model-specific notes. This supports Air Combat and future models where reports may need tactical, crew, task or package-specific comments.',
};

const humaniseFieldKey = (key: string): string => (
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
);

interface PlatformConfigurationSettingsProps {
  currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
  onShowSuccess: (message: string) => void;
  scrollTarget?: string;
  sectionOnly?: boolean;
  canUsePlatformPermission?: (permissionId: string) => boolean;
  activeUnitCode?: string;
  activeUnitCodes?: string[];
  activeCompositeUnitCode?: string;
  activeOperationalModel?: string;
  focusUnitCode?: string;
  focusLocationCode?: string;
  focusResourcePoolCode?: string;
  focusAircraftTypeCode?: string;
  focusUserId?: string;
  focusSubsectionId?: string;
  onNavigateToSettingsSection?: (target: ConfigurationHealthSettingsTarget) => void;
  phraseBank?: Record<string, any>;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  syllabusDetails?: SyllabusItemDetail[];
  unitCurrencyDefinitions?: Record<string, {
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
  }>;
  formationCallsigns?: FormationCallsign[];
  onUpdateFormationCallsigns?: (callsigns: FormationCallsign[]) => void;
}

const PlatformConfigurationSettings: React.FC<PlatformConfigurationSettingsProps> = ({
  currentUserPermission,
  onShowSuccess,
  scrollTarget,
  sectionOnly = false,
  canUsePlatformPermission,
  activeUnitCode = '',
  activeUnitCodes = [],
  activeCompositeUnitCode = '',
  activeOperationalModel = '',
  focusUnitCode = '',
  focusLocationCode = '',
  focusResourcePoolCode = '',
  focusAircraftTypeCode = '',
  focusUserId = '',
  focusSubsectionId = '',
  onNavigateToSettingsSection,
  phraseBank = {},
  masterCurrencies = [],
  currencyRequirements = [],
  syllabusDetails = [],
  unitCurrencyDefinitions = {},
  formationCallsigns = [],
  onUpdateFormationCallsigns,
}) => {
  const [config, setConfig] = useState<PlatformConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [error, setError] = useState('');
  const loadedConfigRef = useRef<PlatformConfig>(emptyConfig);
  const unitTypeOptions = useMemo(() => normaliseUnitTypes(config.unitTypes, config.units), [config.unitTypes, config.units]);
  const [unitTypesDraft, setUnitTypesDraft] = useState('');
  const [isEditingUnitTypes, setIsEditingUnitTypes] = useState(false);
  const [trainingReportNameDrafts, setTrainingReportNameDrafts] = useState<Partial<Pick<TrainingReportTemplate, 'genericName' | 'displayName'>>>({});
  const [trainingReportTextDrafts, setTrainingReportTextDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEditingUnitTypes) setUnitTypesDraft(unitTypeOptions.join('\n'));
  }, [isEditingUnitTypes, unitTypeOptions]);

  useEffect(() => {
    const handlePlatformConfigUpdated = (event: Event) => {
      const rawConfig = (event as CustomEvent<{ config?: PlatformConfig }>).detail?.config;
      const nextConfig = rawConfig && Array.isArray(rawConfig.units)
        ? applyDefaultUnitTraineeAvailability(rawConfig)
        : rawConfig;
      if (!nextConfig || !Array.isArray(nextConfig.units)) return;
      loadedConfigRef.current = nextConfig;
      setConfig(nextConfig);
    };
    window.addEventListener(PLATFORM_CONFIG_UPDATED_EVENT, handlePlatformConfigUpdated);
    return () => window.removeEventListener(PLATFORM_CONFIG_UPDATED_EVENT, handlePlatformConfigUpdated);
  }, []);
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_PERMISSION_PROFILES[0].id);
  const [advancedFeatureAreaOpenByScope, setAdvancedFeatureAreaOpenByScope] = useState<Record<string, boolean>>({});
  const [rankTerminologyUnlocked, setRankTerminologyUnlocked] = useState(false);
  const [, setRankTerminologyDirty] = useState(false);
  const [trainingReportTemplateUnlocked, setTrainingReportTemplateUnlocked] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseRuntimeStatus | null>(null);
  const [licenseImportText, setLicenseImportText] = useState('');
  const [licenseImportMessage, setLicenseImportMessage] = useState('');
  const [licenseImportError, setLicenseImportError] = useState('');
  const [licenseActionLoading, setLicenseActionLoading] = useState(false);
  const [airfieldCatalogue, setAirfieldCatalogue] = useState<AirfieldCatalogueEntry[]>([]);
  const [airfieldCatalogueStatus, setAirfieldCatalogueStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [airfieldCatalogueError, setAirfieldCatalogueError] = useState('');
  const [organisationStructureUnlocked, setOrganisationStructureUnlocked] = useState(false);
  const [organisationStructureImportError, setOrganisationStructureImportError] = useState('');
  const organisationStructureFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [openParentOrgUnitIndex, setOpenParentOrgUnitIndex] = useState<number | null>(null);
  const [parentOrgMenuPlacement, setParentOrgMenuPlacement] = useState<{ direction: 'down' | 'up'; maxHeight: number }>({ direction: 'down', maxHeight: 340 });
  const [resourcePoolsUnlocked, setResourcePoolsUnlocked] = useState(false);
  const [crewCompositionUnlocked, setCrewCompositionUnlocked] = useState(false);
  const [taskProfilesUnlocked, setTaskProfilesUnlocked] = useState(false);
  const [sectionEditUnlocked, setSectionEditUnlocked] = useState<Record<string, boolean>>({});
  const [expandedMasterLmpAccessScopes, setExpandedMasterLmpAccessScopes] = useState<Set<string>>(new Set());
  const [taskProfileDrafts, setTaskProfileDrafts] = useState<Record<string, string>>({});
  const [taskProfileAbbreviationDrafts, setTaskProfileAbbreviationDrafts] = useState<Record<string, string>>({});
  const [crewCompositionAircraftCode, setCrewCompositionAircraftCode] = useState('');
  const [resourcePoolActiveTab, setResourcePoolActiveTab] = useState<'aircraftTypes' | 'resourcePools'>('aircraftTypes');
  const [newAircraftTypeVisibleIds, setNewAircraftTypeVisibleIds] = useState<Set<string>>(new Set());
  const [showResourcePoolDeletePanel, setShowResourcePoolDeletePanel] = useState(false);
  const [selectedResourcePoolDeleteKey, setSelectedResourcePoolDeleteKey] = useState('');
  const [trainingReportSyncUnitCode, setTrainingReportSyncUnitCode] = useState('');
  const locationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingLocationScrollIdRef = useRef<string | null>(null);
  const unitRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingUnitScrollIdRef = useRef<string | null>(null);
  const resourcePoolRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingResourcePoolScrollIdRef = useRef<string | null>(null);
  const standardCrewCompositionRef = useRef<HTMLDivElement | null>(null);
  const resourcePoolExitPromptOpenRef = useRef(false);
  const resourcePoolEditBaselineRef = useRef<PlatformConfig | null>(null);

  const canEdit = ['Super Admin', 'Admin'].includes(currentUserPermission);
  const hasRankTerminologyEditPermission = canUsePlatformPermission?.('settings.rankTerminology.edit') ?? canEdit;
  const canUnlockRankTerminology = canEdit && hasRankTerminologyEditPermission;
  const canEditRankTerminology = canUnlockRankTerminology && rankTerminologyUnlocked;
  const canEditTrainingReportTemplate = canEdit && trainingReportTemplateUnlocked;
  const canEditResourcePools = canEdit && resourcePoolsUnlocked;
  const canEditCrewComposition = canEdit && crewCompositionUnlocked;
  const canEditTaskProfiles = canEdit && taskProfilesUnlocked;
  const crewCompositionAircraftTypes = config.aircraftTypes.length > 0
    ? config.aircraftTypes
    : [{ code: 'AIRCRAFT', name: 'Aircraft', crewComposition: DEFAULT_AIRCRAFT_CREW_COMPOSITION }];
  const resourcePoolsDirty = useMemo(() => (
    JSON.stringify({
      aircraftTypes: config.aircraftTypes,
      resourcePools: config.resourcePools,
    }) !== JSON.stringify({
      aircraftTypes: loadedConfigRef.current.aircraftTypes,
      resourcePools: loadedConfigRef.current.resourcePools,
    })
  ), [config.aircraftTypes, config.resourcePools]);
  const resourcePoolDeleteOptions = useMemo(() => (
    config.resourcePools.map((pool, index) => {
      const key = String(pool.id || pool.code || `resource-pool-${index}`);
      const name = String(pool.name || '').trim() || 'Unnamed Resource Pool';
      return { key, name };
    })
  ), [config.resourcePools]);
  const selectedResourcePoolDeleteOption = resourcePoolDeleteOptions.find((option) => option.key === selectedResourcePoolDeleteKey);

  const unlockRankTerminology = async () => {
    if (!canUnlockRankTerminology) return false;
    const password = await showDarkPrompt({
      title: 'Edit Rank, Terminology & Labels',
      message: 'Enter your password to edit Rank, Terminology & Labels.',
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return false;
    setError('');
    try {
      const sessionToken = localStorage.getItem('dfp_session_token') || '';
      const verifyResp = await fetch('/api/auth/verify-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const verifyData = await verifyResp.json().catch(() => ({}));
      if (!verifyResp.ok || !verifyData.valid) {
        setError('Rank, Terminology & Labels editing was not unlocked. The password was not accepted.');
        return false;
      }
      setRankTerminologyUnlocked(true);
      onShowSuccess('Rank, Terminology & Labels editing unlocked.');
      return true;
    } catch (err: any) {
      setError(err?.message || 'Could not verify password for Rank, Terminology & Labels editing.');
      return false;
    }
  };

  const saveRankTerminology = async () => {
    const saved = await save(undefined, 'platform-rank-terminology');
    if (saved) setRankTerminologyUnlocked(false);
  };

  const rankTerminologyButtonClass = 'rounded border border-gray-500 bg-gray-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50';
  const rankTerminologySectionActionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';
  const rankTerminologyDangerButtonClass = 'w-full rounded border border-red-500/40 bg-red-500/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-red-100 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40';

  const renderRankTerminologySectionAction = () => {
    if (!canUnlockRankTerminology) return null;
    return rankTerminologyUnlocked ? (
      <button
        type="button"
        onClick={saveRankTerminology}
        disabled={saving}
        className={rankTerminologySectionActionButtonClass}
      >
        Save
      </button>
    ) : (
      <button
        type="button"
        onClick={unlockRankTerminology}
        className={rankTerminologySectionActionButtonClass}
      >
        Edit
      </button>
    );
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (isSetupTestMode()) {
          const nextConfig = normaliseSettingsPlatformConfig(readSetupTestPlatformConfig());
          if (!cancelled) {
            setConfig(nextConfig);
            loadedConfigRef.current = nextConfig;
            const firstUserId = nextConfig.platformUsers[0]?.userId || nextConfig.platformUsers[0]?.username || nextConfig.userAccess[0]?.userId || '';
            setSelectedAccessUserId((current) => current || firstUserId);
          }
          return;
        }
        const [res, licenseRes] = await Promise.all([
          fetch(`${getApiBase()}/platform-config`),
          fetch(`${getApiBase()}/platform-license/status`),
        ]);
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        const nextLicenseStatus = licenseRes.ok ? await licenseRes.json() : null;
        if (!cancelled) {
          const nextConfig = normaliseSettingsPlatformConfig(data);
          setConfig(nextConfig);
          loadedConfigRef.current = nextConfig;
          if (nextLicenseStatus) setLicenseStatus(nextLicenseStatus);
          const firstUserId = nextConfig.platformUsers[0]?.userId || nextConfig.platformUsers[0]?.username || nextConfig.userAccess[0]?.userId || '';
          setSelectedAccessUserId((current) => current || firstUserId);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load platform configuration');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (config.units.length === 0) {
      setSelectedUnitIndex(0);
      setEditingUnitIndex(null);
      return;
    }
    setSelectedUnitIndex((current) => Math.min(Math.max(current, 0), config.units.length - 1));
    setEditingUnitIndex((current) => (
      current === null ? null : Math.min(Math.max(current, 0), config.units.length - 1)
    ));
  }, [config.units.length]);

  useEffect(() => {
    let cancelled = false;
    const loadAirfieldCatalogue = async () => {
      setAirfieldCatalogueStatus('loading');
      setAirfieldCatalogueError('');
      try {
        const res = await fetch(getAirfieldCatalogueUrl(), { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Airfield catalogue load failed (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Airfield catalogue format was not recognised.');
        const entries = data.filter((entry) => (
          entry
          && typeof entry.n === 'string'
          && Number.isFinite(Number(entry.a))
          && Number.isFinite(Number(entry.o))
          && typeof entry.t === 'string'
        )).map((entry) => ({
          ...entry,
          a: Number(entry.a),
          o: Number(entry.o),
        }));
        if (!cancelled) {
          setAirfieldCatalogue(entries);
          setAirfieldCatalogueStatus('loaded');
        }
      } catch (err: any) {
        if (!cancelled) {
          setAirfieldCatalogue([]);
          setAirfieldCatalogueStatus('error');
          setAirfieldCatalogueError(err?.message || 'Airfield catalogue could not be loaded.');
        }
      }
    };

    loadAirfieldCatalogue();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const pendingLocationId = pendingLocationScrollIdRef.current;
    if (!pendingLocationId) return;
    const target = locationRowRefs.current[pendingLocationId];
    if (!target) return;
    pendingLocationScrollIdRef.current = null;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  }, [config.locations.length]);

  const scrollUnitRowIntoView = (unitIndex: number) => {
    const unit = config.units[unitIndex];
    if (!unit) return;
    const rowKey = unit.id || `platform-unit-${unitIndex}`;
    const target = unitRowRefs.current[rowKey];
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  };

  useEffect(() => {
    const pendingUnitId = pendingUnitScrollIdRef.current;
    if (!pendingUnitId) return;
    const target = unitRowRefs.current[pendingUnitId];
    if (!target) return;
    pendingUnitScrollIdRef.current = null;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
  }, [config.units.length]);

  useEffect(() => {
    const cleanFocusUnitCode = String(focusUnitCode || '').trim().toUpperCase();
    if (loading || !cleanFocusUnitCode || scrollTarget !== 'platform-units') return;
    const unitIndex = config.units.findIndex((unit) => String(unit.code || '').trim().toUpperCase() === cleanFocusUnitCode);
    if (unitIndex < 0) return;
    setSelectedUnitIndex(unitIndex);
    setEditingUnitIndex(null);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => scrollUnitRowIntoView(unitIndex), 60);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [config.units, focusUnitCode, loading, scrollTarget]);

  useEffect(() => {
    const cleanLocationCode = String(focusLocationCode || '').trim().toUpperCase();
    if (loading || !cleanLocationCode || scrollTarget !== 'platform-organisation-locations') return;
    const locationIndex = config.locations.findIndex((location) => String(location.code || '').trim().toUpperCase() === cleanLocationCode);
    if (locationIndex < 0) return;
    const location = config.locations[locationIndex];
    const rowKey = location.id || `platform-location-${locationIndex}`;
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        locationRowRefs.current[rowKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [config.locations, focusLocationCode, loading, scrollTarget]);

  useEffect(() => {
    const pendingPoolId = pendingResourcePoolScrollIdRef.current;
    if (!pendingPoolId) return;
    const target = resourcePoolRowRefs.current[pendingPoolId];
    if (!target) return;
    pendingResourcePoolScrollIdRef.current = null;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, [config.resourcePools.length]);

  useEffect(() => {
    const cleanPoolCode = String(focusResourcePoolCode || '').trim().toUpperCase();
    if (loading || !cleanPoolCode || scrollTarget !== 'platform-resource-pools') return;
    const poolIndex = config.resourcePools.findIndex((pool) => (
      [pool.id, pool.code, pool.name]
        .map((value) => String(value || '').trim().toUpperCase())
        .some((value) => value === cleanPoolCode)
    ));
    if (poolIndex < 0) return;
    const pool = config.resourcePools[poolIndex];
    const rowKey = pool.id || `platform-resource-pool-${poolIndex}`;
    setResourcePoolActiveTab('resourcePools');
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        resourcePoolRowRefs.current[rowKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [config.resourcePools, focusResourcePoolCode, loading, scrollTarget, resourcePoolActiveTab]);

  useEffect(() => {
    const cleanAircraftCode = String(focusAircraftTypeCode || '').trim().toUpperCase();
    if (loading || !cleanAircraftCode || !['platform-crew-composition', 'platform-currency-profiles'].includes(String(scrollTarget || ''))) return;
    const matchingAircraft = crewCompositionAircraftTypes.find((aircraft) => (
      String(aircraft.code || '').trim().toUpperCase() === cleanAircraftCode
    ));
    if (!matchingAircraft?.code) return;
    setCrewCompositionAircraftCode(matchingAircraft.code);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        standardCrewCompositionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [crewCompositionAircraftTypes, focusAircraftTypeCode, loading, scrollTarget]);

  useEffect(() => {
    const cleanFocusUserId = String(focusUserId || '').trim();
    if (loading || scrollTarget !== 'platform-user-access' || !cleanFocusUserId) return;
    const matchingUser = config.platformUsers.find((user) => (
      [user.userId, user.username]
        .map((value) => String(value || '').trim())
        .some((value) => value === cleanFocusUserId)
    ));
    setSelectedAccessUserId(matchingUser?.userId || matchingUser?.username || cleanFocusUserId);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById('platform-user-access-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [config.platformUsers, focusUserId, loading, scrollTarget]);

  useEffect(() => {
    const cleanLocationCode = String(focusLocationCode || '').trim().toUpperCase();
    if (loading || scrollTarget !== 'platform-user-access' || !cleanLocationCode) return;
    const matchingAccess = config.userAccess.find((access) => {
      const accessLocationCode = String(access.locationCode || '').trim().toUpperCase();
      const accessUnitCode = String(access.unitCode || '').trim().toUpperCase();
      const accessUnit = accessUnitCode
        ? config.units.find((unit) => String(unit.code || '').trim().toUpperCase() === accessUnitCode)
        : null;
      const unitHomeLocationCode = String(accessUnit?.locationCode || '').trim().toUpperCase();
      return accessLocationCode === cleanLocationCode || unitHomeLocationCode === cleanLocationCode;
    });
    if (matchingAccess?.userId) {
      setSelectedAccessUserId(matchingAccess.userId);
    }
  }, [config.units, config.userAccess, focusLocationCode, loading, scrollTarget]);

  useEffect(() => {
    const cleanSubsectionId = String(focusSubsectionId || '').trim();
    if (loading || !cleanSubsectionId) return;
    if (scrollTarget === 'platform-resource-pools') {
      if (cleanSubsectionId.startsWith('platform-aircraft-type')) {
        setResourcePoolActiveTab('aircraftTypes');
      } else if (cleanSubsectionId.startsWith('platform-resource-pool')) {
        setResourcePoolActiveTab('resourcePools');
      }
    }
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(cleanSubsectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSubsectionId, focusAircraftTypeCode, loading, scrollTarget, selectedAccessUserId]);

  useEffect(() => {
    if (!resourcePoolsUnlocked || !resourcePoolsDirty || saving || applyingChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [applyingChanges, config.aircraftTypes, config.resourcePools, resourcePoolsDirty, resourcePoolsUnlocked, saving]);

  useEffect(() => {
    if (!scrollTarget || loading || sectionOnly) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(scrollTarget);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollTarget, loading, sectionOnly]);

  const airfieldCatalogueLookup = useMemo(
    () => (airfieldCatalogue.length ? buildAirfieldCatalogueLookup(airfieldCatalogue) : emptyAirfieldCatalogueLookup),
    [airfieldCatalogue],
  );

  const activeModules = useMemo(
    () => config.modules.filter((module) => String(module.status || 'ACTIVE').toUpperCase() === 'ACTIVE'),
    [config.modules],
  );

  const primaryOrganisationIndex = useMemo(() => {
    const activeIndex = config.organisations.findIndex((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    return activeIndex >= 0 ? activeIndex : 0;
  }, [config.organisations]);

  const primaryOrganisation = config.organisations[primaryOrganisationIndex] || null;
  const primaryOrganisationSettings = primaryOrganisation?.settings || {};
  const organisationStructure = useMemo(
    () => normaliseOrganisationStructure(primaryOrganisationSettings.organisationStructure || null, primaryOrganisation?.name || ''),
    [primaryOrganisationSettings.organisationStructure, primaryOrganisation?.name],
  );
  const deploymentProfile = {
    ...DEFAULT_DEPLOYMENT_PROFILE,
    ...(primaryOrganisationSettings.deploymentProfile || {}),
    enforcementMode: normaliseEnforcementMode(primaryOrganisationSettings.deploymentProfile?.enforcementMode),
  };
  const deploymentReadiness = primaryOrganisationSettings.deploymentReadiness || {};
  const readinessCompleteCount = DEPLOYMENT_READINESS_ITEMS.filter((item) => deploymentReadiness[item.id] === true).length;
  const readinessPercent = DEPLOYMENT_READINESS_ITEMS.length
    ? Math.round((readinessCompleteCount / DEPLOYMENT_READINESS_ITEMS.length) * 100)
    : 0;
  const operationalRunbook = {
    ...DEFAULT_OPERATIONAL_RUNBOOK,
    ...(primaryOrganisationSettings.operationalRunbook || {}),
  };
  const settingsVisibilityPolicy = normaliseSettingsVisibilityPolicy(
    primaryOrganisationSettings.settingsVisibilityPolicy || null,
  );
  const personnelDisplaySettings = normalisePersonnelDisplaySettings(
    primaryOrganisationSettings.personnelDisplaySettings || primaryOrganisationSettings.personnelSettings || null,
  );
  const staffRankEquivalency = personnelDisplaySettings.staffRankEquivalency;
  const sctTerminology = normaliseSctTerminology(
    primaryOrganisationSettings.sctTerminology || null,
  );
  const continuationCurrencyEventsLabel = `${sctTerminology.shortLabel} / Currency Events`;
  const trainingReportTerminology = normaliseTrainingReportTerminology(
    primaryOrganisationSettings.trainingReportTerminology || null,
  );
  const crewPositionTerminology = normaliseCrewPositionTerminology(
    primaryOrganisationSettings.crewPositionTerminology || null,
  );
  const crewCompositionSettings = normaliseCrewCompositionSettings(
    primaryOrganisationSettings.crewCompositionSettings || null,
  );
  const staffQualificationCatalogue = normaliseStaffQualificationCatalogue(
    primaryOrganisationSettings.staffQualificationCatalogue || null,
  );
  const linkedInstructorQualification = staffQualificationCatalogue.qualifications.find((qualification) => {
    const tokens = [
      qualification.id,
      qualification.code,
      qualification.name,
    ].map(normaliseQualificationToken);
    return String(qualification.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
      && (tokens.includes('qfi') || tokens.includes('instructor'));
  });
  const linkedInstructorQualificationLabel = linkedInstructorQualification
    ? (linkedInstructorQualification.code || linkedInstructorQualification.name)
    : 'No linked instructor qualification configured';
  const linkedInstructorQualificationInputId = linkedInstructorQualification
    ? `qualification-name-${String(linkedInstructorQualification.id || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : '';
  const unitCallsignSettings = normaliseUnitCallsignSettings(
    primaryOrganisationSettings.unitCallsignSettings || null,
  );
  const crewPositionLabelMap = getCrewPositionLabelMap(crewPositionTerminology);
  const defaultCrewPositionIds = new Set(DEFAULT_CREW_POSITION_TERMINOLOGY.positions.map((entry) => entry.id));
  const activeTrainingReportUnitCode = String(activeUnitCode || '').includes('+')
    ? String(activeUnitCode || '').split('+')[0]?.trim()
    : String(activeUnitCode || '').trim();
  const activeTrainingReportUnit = config.units.find((unit) => (
    String(unit.code || '').trim().toUpperCase() === activeTrainingReportUnitCode.toUpperCase()
  )) || config.units.find(isActiveRecord) || config.units[0] || null;
  const activeTrainingReportUnitIndex = activeTrainingReportUnit
    ? config.units.findIndex((unit) => unit === activeTrainingReportUnit)
    : -1;
  const activeTrainingReportUnitLabel = activeTrainingReportUnit
    ? `${activeTrainingReportUnit.code}${activeTrainingReportUnit.name && activeTrainingReportUnit.name !== activeTrainingReportUnit.code ? ` - ${activeTrainingReportUnit.name}` : ''}`
    : 'No unit selected';
  const trainingReportTemplate = normaliseTrainingReportTemplate(
    activeTrainingReportUnit?.settings?.trainingReportTemplate || primaryOrganisationSettings.trainingReportTemplate || null,
    activeTrainingReportUnit?.settings?.trainingReportTerminology || primaryOrganisationSettings.trainingReportTerminology || null,
  );
  const trainingReportPhraseBank = getUnitTrainingReportPhraseBank(
    config as any,
    activeTrainingReportUnit?.code || activeTrainingReportUnitCode,
    phraseBank,
  );
  const trainingReportSyncOptions = config.units
    .filter((unit) => isActiveRecord(unit) && String(unit.code || '').trim() && String(unit.code || '').trim() !== String(activeTrainingReportUnit?.code || '').trim())
    .map((unit) => ({
      code: String(unit.code || '').trim(),
      label: `${unit.code}${unit.name && unit.name !== unit.code ? ` - ${unit.name}` : ''}`,
    }));
  const describeTrainingReportGrades = (grades: number[]): string => {
    if (!Array.isArray(grades) || grades.length === 0) return 'No grades selected';
    return grades
      .map((grade) => {
        const option = trainingReportTemplate.grades.options.find((item) => item.value === grade);
        return option ? `${grade} - ${option.label}` : String(grade);
      })
      .join(', ');
  };
  const consecutiveRepeatGradeSummary = describeTrainingReportGrades(
    trainingReportTemplate.repeatRules.consecutive.grades,
  );
  const rollingWindowRepeatGradeSummary = describeTrainingReportGrades(
    trainingReportTemplate.repeatRules.rollingWindow.grades,
  );
  const insertEventTypes = normaliseInsertEventTypes(
    primaryOrganisationSettings.insertEventTypes || null,
  );
  const taskProfiles = normaliseTaskProfileConfig(
    primaryOrganisationSettings.taskProfiles || null,
  );
  const masterLmpAccessRules = useMemo(
    () => normaliseMasterLmpAccessRules(config as any),
    [config.organisations],
  );
  const masterLmpCatalogue = useMemo(
    () => normaliseMasterLmpCatalogue(config as any),
    [config.organisations],
  );
  const masterLmpSyllabusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    syllabusDetails
      .filter((item) => item && item.isActive !== false)
      .filter((item) => (item.lmpType || 'Master LMP') === 'Master LMP')
      .forEach((item) => {
        const courseCodes = Array.isArray(item.courses) ? item.courses.filter(Boolean) : [];
        courseCodes.forEach((courseCode) => {
          const key = String(courseCode || '').trim().toUpperCase();
          if (!key) return;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
      });
    return counts;
  }, [syllabusDetails]);
  const masterLmpOptions = useMemo(() => (
    Array.from(new Set([
      ...masterLmpCatalogue
        .filter((entry) => String(entry.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
        .map((entry) => entry.code),
      ...masterLmpAccessRules.map((rule) => rule.lmpCode),
    ])).filter(Boolean).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
  ), [masterLmpAccessRules, masterLmpCatalogue]);
  const operationalSignals = [
    {
      label: 'Support owner',
      complete: Boolean(operationalRunbook.supportOwner && operationalRunbook.supportContact),
      detail: 'Named support owner and contact path are recorded.',
    },
    {
      label: 'Backup policy',
      complete: Boolean(operationalRunbook.backupFrequency && Number(operationalRunbook.backupRetentionDays) > 0 && operationalRunbook.backupStorageLocation),
      detail: 'Backup cadence, retention and storage location are recorded.',
    },
    {
      label: 'Restore assurance',
      complete: Boolean(operationalRunbook.lastRestoreTestDate && Number(operationalRunbook.restoreTimeObjectiveHours) > 0 && Number(operationalRunbook.restorePointObjectiveHours) > 0),
      detail: 'Restore test date, RTO and RPO are recorded.',
    },
    {
      label: 'Update process',
      complete: Boolean(operationalRunbook.maintenanceWindow && operationalRunbook.updateApprovalProcess),
      detail: 'Maintenance window and update approval process are recorded.',
    },
    {
      label: 'Evidence retention',
      complete: Boolean(operationalRunbook.evidenceExportPath && Number(operationalRunbook.auditRetentionYears) > 0),
      detail: 'Audit evidence export path and retention period are recorded.',
    },
  ];
  const operationalCompleteCount = operationalSignals.filter((signal) => signal.complete).length;
  const operationalReadinessPercent = operationalSignals.length
    ? Math.round((operationalCompleteCount / operationalSignals.length) * 100)
    : 0;

  const buildConfigWithPrimaryOrganisationSettings = (
    baseConfig: PlatformConfig,
    updater: Record<string, any> | ((settings: Record<string, any>) => Record<string, any>),
  ): PlatformConfig => {
    if (baseConfig.organisations.length === 0) return baseConfig;
    const organisations = [...baseConfig.organisations];
    const activeIndex = organisations.findIndex((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    const orgIndex = activeIndex >= 0 ? activeIndex : 0;
    const currentOrg = organisations[orgIndex] || organisations[0];
    const currentSettings = currentOrg.settings || {};
    const nextSettings = typeof updater === 'function'
      ? updater(currentSettings)
      : { ...currentSettings, ...updater };
    organisations[orgIndex] = { ...currentOrg, settings: nextSettings };
    return { ...baseConfig, organisations };
  };

  const updatePrimaryOrganisationSettings = (
    updater: Record<string, any> | ((settings: Record<string, any>) => Record<string, any>),
  ) => {
    setConfig((prev) => {
      const nextConfig = buildConfigWithPrimaryOrganisationSettings(prev, updater);
      notifyPlatformConfigUpdatedSoon(nextConfig);
      return nextConfig;
    });
  };

  const updateSettingsVisibilityPolicy = (patch: Partial<SettingsVisibilityPolicy>) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      settingsVisibilityPolicy: normaliseSettingsVisibilityPolicy({
        ...settingsVisibilityPolicy,
        ...patch,
      }),
    }));
  };
  const toggleSettingsVisibilityFilter = (filter: SettingsVisibilityFilter, checked: boolean) => {
    const nextFilters = checked
      ? Array.from(new Set([...settingsVisibilityPolicy.filters, filter]))
      : settingsVisibilityPolicy.filters.filter((item) => item !== filter);
    updateSettingsVisibilityPolicy({ filters: nextFilters });
  };

  const updateOrganisationStructure = (nextStructure: OrganisationStructureSettings) => {
    setConfig((prev) => {
      if (prev.organisations.length === 0) return prev;
      const organisations = [...prev.organisations];
      const activeIndex = organisations.findIndex((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      const orgIndex = activeIndex >= 0 ? activeIndex : 0;
      const currentOrg = organisations[orgIndex] || organisations[0];
      const currentSettings = currentOrg.settings || {};
      const previousStructure = normaliseOrganisationStructure(currentSettings.organisationStructure || null, currentOrg.name || '');
      const normalisedNextStructure = normaliseOrganisationStructure(nextStructure, currentOrg.name || primaryOrganisation?.name || '');
      const renamedNextStructure = applyOrganisationStructureRenamesToStructure(
        normalisedNextStructure,
        buildOrganisationOptionRenameMaps(previousStructure, normalisedNextStructure),
      );
      organisations[orgIndex] = {
        ...currentOrg,
        settings: {
          ...currentSettings,
          organisationStructure: renamedNextStructure,
        },
      };
      const nextConfig = applyOrganisationStructureRenamesToUnits(
        { ...prev, organisations },
        previousStructure,
        renamedNextStructure,
      );
      notifyPlatformConfigUpdatedSoon(nextConfig);
      return nextConfig;
    });
  };

  const updateOrganisationStructureLevelCount = (levelCount: number) => {
    const count = Math.max(1, Math.min(12, Math.round(Number(levelCount) || 1)));
    updateOrganisationStructure({
      levelCount: count,
      levels: Array.from({ length: count }, (_, index) => (
        organisationStructure.levels[index] || {
          id: `org-level-${index}`,
          name: index === 0 && primaryOrganisation?.name
            ? primaryOrganisation.name
            : DEFAULT_ORGANISATION_STRUCTURE_LEVELS[index] || `Level ${index}`,
          options: [],
        }
      )),
      relationshipPaths: organisationStructure.relationshipPaths?.filter((path) => path.length <= count),
    });
  };

  const updateOrganisationStructureLevel = (levelIndex: number, changes: Partial<OrganisationStructureLevel>) => {
    updateOrganisationStructure({
      ...organisationStructure,
      relationshipPaths: organisationStructure.relationshipPaths,
      levels: organisationStructure.levels.map((level, index) => (
        index === levelIndex
          ? {
              ...level,
              ...changes,
              options: changes.options ? Array.from(new Set(changes.options.filter((option) => option.trim()))) : level.options,
              childrenByParent: level.childrenByParent,
              parentByChild: level.parentByChild,
            }
          : level
      )),
    });
  };

  const startOrganisationStructureEdit = () => {
    setOrganisationStructureImportError('');
    setOrganisationStructureUnlocked(true);
  };

  const downloadOrganisationStructureTemplate = () => {
    downloadOrganisationStructureTemplateFile();
  };

  const applyImportedOrganisationStructure = (
    grouped: Map<number, OrganisationStructureLevelDraft>,
    relationshipPaths?: string[][],
  ): boolean => {
    if (grouped.size === 0) {
      setOrganisationStructureImportError('No valid organisation structure rows found.');
      return false;
    }
    const levelCount = Math.max(...Array.from(grouped.keys())) + 1;
    updateOrganisationStructure({
      levelCount,
      levels: Array.from({ length: levelCount }, (_, index) => {
        const row = grouped.get(index);
        return {
          id: organisationStructure.levels[index]?.id || `org-level-${index}`,
          name: row?.name || (index === 0 && primaryOrganisation?.name ? primaryOrganisation.name : DEFAULT_ORGANISATION_STRUCTURE_LEVELS[index] || `Level ${index}`),
          options: Array.from(new Set(row?.options || [])),
          ...(row?.childrenByParent ? { childrenByParent: row.childrenByParent } : {}),
          ...(row?.parentByChild ? { parentByChild: row.parentByChild } : {}),
        };
      }),
      ...(relationshipPaths && relationshipPaths.length > 0 ? { relationshipPaths } : {}),
    });
    setOrganisationStructureImportError('');
    setOrganisationStructureUnlocked(true);
    return true;
  };

  const importOrganisationStructureRows = (rows: any[]): boolean => {
    const grouped = new Map<number, OrganisationStructureLevelDraft>();
    const parsedRows = rows.map((row) => ({
      row,
      levelNumber: Math.round(Number(row.Level ?? row.level ?? row['Level Number'] ?? row['level number'])),
    }));
    const usesZeroBasedLevels = parsedRows.some(({ levelNumber }) => levelNumber === 0);
    rows.forEach((row) => {
      const rawLevel = row.Level ?? row.level ?? row['Level Number'] ?? row['level number'];
      const rawLevelNumber = Math.round(Number(rawLevel));
      const levelNumber = usesZeroBasedLevels ? rawLevelNumber : rawLevelNumber - 1;
      if (!Number.isFinite(levelNumber) || levelNumber < 0 || levelNumber > 11) return;
      const levelName = String(row['Level Name'] ?? row.levelName ?? DEFAULT_ORGANISATION_STRUCTURE_LEVELS[levelNumber] ?? `Level ${levelNumber}`).trim();
      const option = String(row.Option ?? row.option ?? row.Value ?? row.value ?? row.Name ?? row.name ?? '').trim();
      const parent = String(row.Parent ?? row.parent ?? row['Parent Organisation'] ?? row.parentOrganisation ?? '').trim();
      const current = grouped.get(levelNumber) || { name: levelName, options: [] };
      current.name = levelName || current.name;
      if (option) current.options.push(option);
      grouped.set(levelNumber, current);
      if (parent && option) {
        addOrganisationParentRelationship(grouped, levelNumber, current.name, parent, option);
      }
    });
    return applyImportedOrganisationStructure(grouped);
  };

  const getOrganisationLevelNamesFromWorkbook = (workbook: any): Map<number, string> => {
    const names = new Map<number, string>();
    workbook.SheetNames.forEach((sheetName: string) => {
      const match = String(sheetName || '').trim().match(/^Level\s*(\d+)$/i);
      if (!match) return;
      const levelNumber = Number(match[1]);
      if (!Number.isFinite(levelNumber) || levelNumber < 0 || levelNumber > 11) return;
      const worksheet = workbook.Sheets[sheetName];
      const title = String(worksheet?.A1?.v || '').trim();
      const titleMatch = title.match(/^Level\s*\d+\s*(?:[-–—:]\s*)?(.+)$/i);
      const levelName = String(titleMatch?.[1] || '').trim();
      if (levelName) names.set(levelNumber, levelName);
    });
    return names;
  };

  const importOrganisationStructureLadderRows = (rows: any[][], levelNames: Map<number, string>): boolean => {
    const headerRowIndex = rows.findIndex((row) => (
      Array.isArray(row) && row.some((cell) => /^Level\s*\d+$/i.test(String(cell || '').trim()))
    ));
    if (headerRowIndex < 0) return false;
    const headerRow = rows[headerRowIndex] || [];
    const levelColumns = headerRow
      .map((cell, columnIndex) => {
        const match = String(cell || '').trim().match(/^Level\s*(\d+)$/i);
        return match ? { columnIndex, levelNumber: Number(match[1]) } : null;
      })
      .filter((entry): entry is { columnIndex: number; levelNumber: number } => (
        !!entry && Number.isFinite(entry.levelNumber) && entry.levelNumber >= 0 && entry.levelNumber <= 11
      ));
    if (levelColumns.length === 0) return false;
    const grouped = new Map<number, OrganisationStructureLevelDraft>();
    const relationshipPaths: string[][] = [];
    const lastValuesByLevel = new Map<number, string>();
    rows.slice(headerRowIndex + 1).forEach((row) => {
      if (!Array.isArray(row)) return;
      const rawValues = levelColumns.map(({ columnIndex }) => String(row[columnIndex] || '').trim());
      const deepestValueIndex = rawValues.reduce((lastIndex, value, index) => (value ? index : lastIndex), -1);
      if (deepestValueIndex < 0) return;
      const filledValues = rawValues.map((value, index) => {
        const levelNumber = levelColumns[index].levelNumber;
        if (value) {
          lastValuesByLevel.set(levelNumber, value);
          return value;
        }
        return index <= deepestValueIndex ? lastValuesByLevel.get(levelNumber) || '' : '';
      });
      const path = filledValues.slice(0, deepestValueIndex + 1);
      if (path.length > 1 && path.every(Boolean)) relationshipPaths.push(path);
      levelColumns.forEach(({ levelNumber }, index) => {
        if (index > deepestValueIndex) return;
        const option = filledValues[index];
        if (!option) return;
        const current = grouped.get(levelNumber) || {
          name: levelNames.get(levelNumber) || DEFAULT_ORGANISATION_STRUCTURE_LEVELS[levelNumber] || `Level ${levelNumber}`,
          options: [],
        };
        current.options.push(option);
        grouped.set(levelNumber, current);
      });
      levelColumns.forEach(({ levelNumber }, index) => {
        if (index === 0 || index > deepestValueIndex) return;
        const child = filledValues[index];
        const parent = filledValues[index - 1];
        if (!parent || !child) return;
        addOrganisationParentRelationship(
          grouped,
          levelNumber,
          levelNames.get(levelNumber) || DEFAULT_ORGANISATION_STRUCTURE_LEVELS[levelNumber] || `Level ${levelNumber}`,
          parent,
          child,
        );
      });
    });
    return applyImportedOrganisationStructure(grouped, relationshipPaths);
  };

  const handleOrganisationStructureFile = async (file?: File | null) => {
    if (!file) return;
    setOrganisationStructureImportError('');
    try {
      if (typeof XLSX === 'undefined') throw new Error('Excel import library is not available.');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const levelNames = getOrganisationLevelNamesFromWorkbook(workbook);
      const ladderSheetName = workbook.SheetNames.find((name: string) => String(name || '').trim().toLowerCase() === 'ladder view');
      if (ladderSheetName) {
        const ladderRows = XLSX.utils.sheet_to_json(workbook.Sheets[ladderSheetName], { header: 1, defval: '' });
        if (importOrganisationStructureLadderRows(ladderRows, levelNames)) return;
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      importOrganisationStructureRows(rows);
    } catch (err: any) {
      setOrganisationStructureImportError(err?.message || 'Could not import organisation structure.');
    } finally {
      if (organisationStructureFileInputRef.current) organisationStructureFileInputRef.current.value = '';
    }
  };

  const saveOrganisationStructure = async () => {
    const saved = await save(undefined, 'platform-organisation', { reloadPage: false, successMessage: 'Organisation structure saved.' });
    if (saved) {
      setOrganisationStructureUnlocked(false);
    }
  };

  const deleteOrganisation = async (organisationIndex: number) => {
    if (!canEdit || !organisationStructureUnlocked) return;
    const organisation = config.organisations[organisationIndex];
    if (!organisation) return;
    const organisationLabel = String(organisation.name || organisation.code || 'this organisation').trim();
    const organisationCode = String(organisation.code || '').trim();

    const confirmed = await showDarkConfirm(
      `Delete "${organisationLabel}" and its organisation structure?\n\nThis permanently removes the organisation record from platform configuration and clears unit, licence and access references to it.`,
      'Delete Organisation?',
      'warning',
    );
    if (!confirmed) return;

    const password = await showDarkPrompt({
      title: 'Confirm Organisation Deletion',
      message: `Enter your password to delete "${organisationLabel}".`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The organisation was not deleted.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The organisation was not deleted.', 'Password Check Failed', 'error');
      return;
    }

    const nextConfig: PlatformConfig = {
      ...config,
      organisations: config.organisations.filter((_, index) => index !== organisationIndex),
      locations: config.locations.map((location) => (
        String(location.organisationCode || '').trim() === organisationCode
          ? { ...location, organisationCode: '' }
          : location
      )),
      units: config.units.map((unit) => {
        const unitOrganisationCode = String(unit.organisationCode || '').trim();
        if (!organisationCode || unitOrganisationCode !== organisationCode) return unit;
        return {
          ...unit,
          organisationCode: '',
          settings: {
            ...(unit.settings || {}),
            parentOrganisation: '',
            parentOrganisationPath: [],
          },
        };
      }),
      resourcePools: config.resourcePools.map((pool) => (
        String(pool.organisationCode || '').trim() === organisationCode
          ? { ...pool, organisationCode: '' }
          : pool
      )),
      schedulingRuleSets: config.schedulingRuleSets.map((ruleSet) => (
        String(ruleSet.organisationCode || '').trim() === organisationCode
          ? { ...ruleSet, organisationCode: '' }
          : ruleSet
      )),
      licenses: config.licenses.map((license) => (
        String(license.organisationCode || '').trim() === organisationCode
          ? { ...license, organisationCode: '' }
          : license
      )),
      userAccess: config.userAccess.map((access) => (
        String(access.organisationCode || '').trim() === organisationCode
          ? { ...access, organisationCode: '' }
          : access
      )),
    };

    const saved = await save(nextConfig, 'platform-organisation', { reloadPage: false, successMessage: `Organisation "${organisationLabel}" deleted.` });
    if (saved) {
      setConfig(nextConfig);
      setOrganisationStructureImportError('');
      setOrganisationStructureUnlocked(false);
    }
  };

  const updateDeploymentProfile = (changes: Record<string, any>) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      deploymentProfile: {
        ...DEFAULT_DEPLOYMENT_PROFILE,
        ...(settings.deploymentProfile || {}),
        ...changes,
      },
    }));
  };

  const updateOperationalRunbook = (changes: Record<string, any>) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      operationalRunbook: {
        ...DEFAULT_OPERATIONAL_RUNBOOK,
        ...(settings.operationalRunbook || {}),
        ...changes,
      },
    }));
  };

  const updatePersonnelDisplaySettings = (changes: Partial<PersonnelDisplaySettings>) => {
    setRankTerminologyDirty(true);
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      personnelDisplaySettings: normalisePersonnelDisplaySettings({
        ...(settings.personnelDisplaySettings || settings.personnelSettings || {}),
        ...changes,
      }),
    }));
  };

  const updateStaffRankEquivalency = (nextEquivalency: RankEquivalencyConfig) => {
    const staffRankEquivalency = normaliseRankEquivalencyConfig(nextEquivalency);
    const staffRankOrder = getRankOrderFromEquivalency({ ...staffRankEquivalency, civilianTitles: personnelDisplaySettings.civilianTitles } as any);
    updatePersonnelDisplaySettings({
      staffRankEquivalency,
      staffRankOrder,
      ...(personnelDisplaySettings.useSeparateTraineeRankOrder ? {} : { traineeRankOrder: staffRankOrder }),
    });
  };

  const updateCivilianTitles = (value: string) => {
    const civilianTitles = value
      .split(/\r?\n/)
      .filter((title) => title.trim());
    const staffRankOrder = getRankOrderFromEquivalency({ ...personnelDisplaySettings.staffRankEquivalency, civilianTitles } as any);
    updatePersonnelDisplaySettings({
      civilianTitles,
      staffRankOrder,
      ...(personnelDisplaySettings.useSeparateTraineeRankOrder ? {} : { traineeRankOrder: staffRankOrder }),
    });
  };

  const applyStaffRankPreset = (preset: RankEquivalencyPresetKey) => {
    const source = preset === 'CUSTOM'
      ? { ...personnelDisplaySettings.staffRankEquivalency, preset: 'CUSTOM' as const }
      : RANK_EQUIVALENCY_PRESETS[preset];
    updateStaffRankEquivalency(normaliseRankEquivalencyConfig(source));
  };

  const updateStaffRankServiceName = (serviceIndex: number, name: string) => {
    const nextEquivalency = normaliseRankEquivalencyConfig(personnelDisplaySettings.staffRankEquivalency);
    nextEquivalency.preset = 'CUSTOM';
    nextEquivalency.services = nextEquivalency.services.map((service, index) => (
      index === serviceIndex ? { ...service, name } : service
    ));
    updateStaffRankEquivalency(nextEquivalency);
  };

  const updateStaffRankCell = (rowIndex: number, serviceIndex: number, field: 'rank' | 'abbreviation', value: string) => {
    const nextEquivalency = normaliseRankEquivalencyConfig(personnelDisplaySettings.staffRankEquivalency);
    nextEquivalency.preset = 'CUSTOM';
    nextEquivalency.rows = nextEquivalency.rows.map((row, index) => {
      if (index !== rowIndex) return row;
      return {
        ...row,
        ranks: row.ranks.map((cell, cellIndex) => (
          cellIndex === serviceIndex ? { ...cell, [field]: value } : cell
        )),
      };
    });
    updateStaffRankEquivalency(nextEquivalency);
  };

  const updateTrainingReportTerminology = (changes: Partial<TrainingReportTerminology>) => {
    setRankTerminologyDirty(true);
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      trainingReportTerminology: normaliseTrainingReportTerminology({
        ...(settings.trainingReportTerminology || {}),
        ...changes,
      }),
    }));
  };

  const updateSctTerminology = (changes: Partial<SctTerminology>) => {
    setRankTerminologyDirty(true);
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      sctTerminology: normaliseSctTerminology({
        ...(settings.sctTerminology || {}),
        ...changes,
      }),
    }));
  };

  const updateCrewPositionTerminology = (
    positions: CrewPositionTerminologyEntry[],
    renamedPosition?: { from: string; to: string },
    deletedDefaultIds = crewPositionTerminology.deletedDefaultIds || [],
  ) => {
    setRankTerminologyDirty(true);
    setConfig((prev) => {
      if (prev.organisations.length === 0) return prev;
      const organisations = [...prev.organisations];
      const activeIndex = organisations.findIndex((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      const orgIndex = activeIndex >= 0 ? activeIndex : 0;
      const currentOrg = organisations[orgIndex] || organisations[0];
      const nextTerminology = normaliseCrewPositionTerminology({ positions, deletedDefaultIds });
      organisations[orgIndex] = {
        ...currentOrg,
        settings: {
          ...(currentOrg.settings || {}),
          crewPositionTerminology: nextTerminology,
        },
      };

      const from = String(renamedPosition?.from || '').trim();
      const to = String(renamedPosition?.to || '').trim();
      const shouldRenameSeats = Boolean(from && to && from.toUpperCase() !== to.toUpperCase());
      return {
        ...prev,
        organisations,
        aircraftTypes: shouldRenameSeats
          ? prev.aircraftTypes.map((aircraft) => {
              const crewComposition = normaliseAircraftCrewComposition(aircraft.crewComposition);
              const seats = crewComposition.seats.map((seat) => ({
                ...seat,
                role: String(seat.role || '').trim().toUpperCase() === from.toUpperCase() ? to : seat.role,
                eligibleRoles: getAircraftSeatEligibleRoles(seat).map((role) => (
                  role.toUpperCase() === from.toUpperCase() ? to : role
                )),
              }));
              return {
                ...aircraft,
                crewComposition: normaliseAircraftCrewComposition({ ...crewComposition, seats }),
              };
            })
          : prev.aircraftTypes,
      };
    });
  };

  const updateCrewPositionEntry = (
    entryId: string,
    changes: Partial<Pick<CrewPositionTerminologyEntry, 'genericName' | 'label' | 'operationalModels'>>,
  ) => {
    const currentEntry = crewPositionTerminology.positions.find((entry) => entry.id === entryId);
    if (!currentEntry) return;
    const nextGenericName = changes.genericName !== undefined
      ? String(changes.genericName)
      : currentEntry.genericName;
    const nextLabel = changes.label !== undefined
      ? String(changes.label)
      : currentEntry.label;
    const nextPositions = crewPositionTerminology.positions.map((entry) => (
      entry.id === entryId
        ? { ...entry, ...changes, genericName: nextGenericName, label: nextLabel }
        : entry
    ));
    updateCrewPositionTerminology(nextPositions, { from: currentEntry.genericName, to: nextGenericName });
  };

  const addCrewPositionEntry = () => {
    const genericName = `Crew Position ${crewPositionTerminology.positions.length + 1}`;
    updateCrewPositionTerminology([
      ...crewPositionTerminology.positions,
      {
        id: createClientRecordId('crew-position'),
        genericName,
        label: genericName,
        operationalModels: OPERATIONAL_MODEL_OPTIONS.map((option) => option.value),
      },
    ]);
  };

  const removeCrewPositionEntry = (entryId: string) => {
    const nextPositions = crewPositionTerminology.positions.filter((entry) => entry.id !== entryId);
    if (nextPositions.length === crewPositionTerminology.positions.length || nextPositions.length === 0) return;
    const nextDeletedDefaultIds = defaultCrewPositionIds.has(entryId)
      ? Array.from(new Set([...(crewPositionTerminology.deletedDefaultIds || []), entryId]))
      : crewPositionTerminology.deletedDefaultIds || [];
    updateCrewPositionTerminology(nextPositions, undefined, nextDeletedDefaultIds);
  };

  const defaultStaffQualificationIds = new Set(DEFAULT_STAFF_QUALIFICATIONS.qualifications.map((entry) => entry.id));

  const updateStaffQualificationCatalogue = (
    qualifications: StaffQualificationDefinition[],
    deletedDefaultIds = staffQualificationCatalogue.deletedDefaultIds || [],
  ) => {
    setRankTerminologyDirty(true);
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      staffQualificationCatalogue: normaliseStaffQualificationCatalogue({ qualifications, deletedDefaultIds }),
    }));
  };

  const focusLinkedInstructorQualification = () => {
    const target = linkedInstructorQualificationInputId
      ? document.getElementById(linkedInstructorQualificationInputId) as HTMLInputElement | null
      : null;
    const fallback = document.getElementById('platform-staff-qualifications');
    const scrollTarget = target || fallback;
    if (!scrollTarget) return;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!target || target.disabled) return;
    window.setTimeout(() => {
      target.focus({ preventScroll: true });
      target.select();
    }, 350);
  };

  const updateStaffQualificationEntry = (
    entryId: string,
    changes: Partial<StaffQualificationDefinition>,
  ) => {
    const nextQualifications = staffQualificationCatalogue.qualifications.map((entry) => (
      entry.id === entryId
        ? { ...entry, ...changes }
        : entry
    ));
    updateStaffQualificationCatalogue(nextQualifications);
  };

  const addStaffQualificationEntry = () => {
    const name = `Qualification ${staffQualificationCatalogue.qualifications.length + 1}`;
    updateStaffQualificationCatalogue([
      ...staffQualificationCatalogue.qualifications,
      {
        id: createClientRecordId('staff-qualification'),
        name,
        code: name,
        operationalModels: OPERATIONAL_MODEL_OPTIONS.map((option) => option.value),
        roleRestrictions: [],
        status: 'ACTIVE',
      },
    ]);
  };

  const removeStaffQualificationEntry = (entryId: string) => {
    const nextQualifications = staffQualificationCatalogue.qualifications.filter((entry) => entry.id !== entryId);
    if (nextQualifications.length === staffQualificationCatalogue.qualifications.length) return;
    const nextDeletedDefaultIds = defaultStaffQualificationIds.has(entryId)
      ? Array.from(new Set([...(staffQualificationCatalogue.deletedDefaultIds || []), entryId]))
      : staffQualificationCatalogue.deletedDefaultIds || [];
    updateStaffQualificationCatalogue(nextQualifications, nextDeletedDefaultIds);
  };

  const updateUnitCallsignSettings = (
    entries: UnitCallsignEntry[],
    policies: UnitCallsignPolicy[] = unitCallsignSettings.policies,
  ) => {
    setRankTerminologyDirty(true);
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      unitCallsignSettings: normaliseUnitCallsignSettings({ entries, policies }),
    }));
  };

  const updateUnitCallsignEntry = (entryId: string, changes: Partial<UnitCallsignEntry>) => {
    updateUnitCallsignSettings(unitCallsignSettings.entries.map((entry) => (
      entry.id === entryId ? { ...entry, ...changes } : entry
    )));
  };

  const addUnitCallsignEntry = () => {
    const defaultUnit = visibleUnitOptions[0] || config.units.find(isActiveRecord)?.code || config.units[0]?.code || '';
    updateUnitCallsignSettings([
      ...unitCallsignSettings.entries,
      {
        id: createClientRecordId('unit-callsign'),
        unitCode: String(defaultUnit || '').trim().toUpperCase(),
        callsign: `Callsign ${unitCallsignSettings.entries.length + 1}`,
        isDefault: !unitCallsignSettings.entries.some(entry => entry.unitCode === String(defaultUnit || '').trim().toUpperCase()),
      },
    ]);
  };

  const removeUnitCallsignEntry = (entryId: string) => {
    updateUnitCallsignSettings(unitCallsignSettings.entries.filter((entry) => entry.id !== entryId));
  };

  const setDefaultUnitCallsignEntry = (entryId: string) => {
    const selected = unitCallsignSettings.entries.find(entry => entry.id === entryId);
    if (!selected) return;
    updateUnitCallsignSettings(unitCallsignSettings.entries.map((entry) => ({
      ...entry,
      isDefault: entry.unitCode === selected.unitCode ? entry.id === entryId : entry.isDefault,
    })));
  };

  const updateUnitCallsignPolicy = (unitCode: string, changes: Partial<UnitCallsignPolicy>) => {
    const nextUnitCode = String(unitCode || '').trim().toUpperCase();
    if (!nextUnitCode) return;
    const currentPolicy = getUnitCallsignPolicy(unitCallsignSettings, nextUnitCode);
    const nextPolicy = { ...currentPolicy, ...changes, unitCode: nextUnitCode };
    updateUnitCallsignSettings(
      unitCallsignSettings.entries,
      [
        ...unitCallsignSettings.policies.filter((policy) => policy.unitCode !== nextUnitCode),
        nextPolicy,
      ],
    );
  };

  const toggleUnitCallsignPermanentRole = (unitCode: string, roleValue: string) => {
    const nextUnitCode = String(unitCode || '').trim().toUpperCase();
    const nextRole = String(roleValue || '').trim().toUpperCase();
    if (!nextUnitCode || !nextRole) return;
    const currentPolicy = getUnitCallsignPolicy(unitCallsignSettings, nextUnitCode);
    const currentRoles = currentPolicy.permanentRoleValues || [];
    const nextRoles = currentRoles.includes(nextRole)
      ? currentRoles.filter((role) => role !== nextRole)
      : Array.from(new Set([...currentRoles, nextRole]));
    updateUnitCallsignPolicy(nextUnitCode, { permanentRoleValues: nextRoles });
  };

  const updateCrewCompositionSettings = (
    alternateCompositions: AlternateCrewCompositionProfile[],
    currencyProfiles: CurrencyProfile[] = crewCompositionSettings.currencyProfiles,
  ) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      crewCompositionSettings: normaliseCrewCompositionSettings({ alternateCompositions, currencyProfiles }),
    }));
  };

  const updateCurrencyProfiles = (currencyProfiles: CurrencyProfile[]) => {
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions, currencyProfiles);
  };

  const addAlternateCrewComposition = (aircraftTypeCode: string) => {
    const aircraftProfiles = getVisibleAlternateCrewCompositions().filter((profile) => (
      String(profile.aircraftTypeCode || '').trim().toUpperCase() === aircraftTypeCode.trim().toUpperCase()
    ));
    const name = `Alternate Crew ${aircraftProfiles.length + 1}`;
    const role = crewPositionTerminology.positions[0]?.genericName || DEFAULT_AIRCRAFT_CREW_COMPOSITION.seats[0]?.role || 'Crew';
    const baseId = createClientRecordId('alternate-crew');
    const targetUnitCodes = getActiveScopedUnitCodes();
    const combinedContext = targetUnitCodes.length > 1;
    const code = createAlternateCrewCompositionCode(aircraftProfiles, name);
    updateCrewCompositionSettings([
      ...crewCompositionSettings.alternateCompositions,
      ...targetUnitCodes.map((unitCode) => ({
        id: combinedContext ? `${baseId}-${unitCode.toLowerCase()}` : baseId,
        code,
        unitCode,
        compositeUnitCode: combinedContext ? activeStandardMissionUnitCode : '',
        compositeProfileId: combinedContext ? baseId : '',
        aircraftTypeCode: aircraftTypeCode.trim().toUpperCase(),
        name,
        description: '',
        operationalModels: ['air_combat', 'fixed_crew', 'pooled_crew'],
        roleRequirements: [{ role, count: 1 }],
        status: 'ACTIVE',
      })),
    ]);
  };

  const updateAlternateCrewComposition = (profileId: string, changes: Partial<AlternateCrewCompositionProfile>) => {
    const targetProfile = crewCompositionSettings.alternateCompositions.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions.map((profile) => (
      profile.id === profileId || (compositeProfileId && profile.compositeProfileId === compositeProfileId)
        ? {
            ...profile,
            ...changes,
            unitCode: profile.unitCode,
            compositeUnitCode: profile.compositeUnitCode,
            compositeProfileId: profile.compositeProfileId,
          }
        : profile
    )));
  };

  const removeAlternateCrewComposition = (profileId: string) => {
    const targetProfile = crewCompositionSettings.alternateCompositions.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions.filter((profile) => (
      profile.id !== profileId && (!compositeProfileId || profile.compositeProfileId !== compositeProfileId)
    )));
  };

  const updateAlternateCrewRole = (
    profileId: string,
    roleIndex: number,
    changes: Partial<{ role: string; count: number }>,
  ) => {
    const targetProfile = crewCompositionSettings.alternateCompositions.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions.map((profile) => {
      if (profile.id !== profileId && (!compositeProfileId || profile.compositeProfileId !== compositeProfileId)) return profile;
      const roleRequirements = profile.roleRequirements.map((requirement, index) => (
        index === roleIndex
          ? {
              ...requirement,
              ...changes,
              role: changes.role !== undefined ? String(changes.role) : requirement.role,
              count: changes.count !== undefined ? Math.max(1, Math.min(24, Math.round(Number(changes.count) || 1))) : requirement.count,
            }
          : requirement
      ));
      return { ...profile, roleRequirements };
    }));
  };

  const getNextAlternateCrewRole = (profile: AlternateCrewCompositionProfile): string | null => {
    const usedRoles = new Set(profile.roleRequirements.map((requirement) => String(requirement.role || '').trim().toUpperCase()));
    const configuredRoles = crewPositionTerminology.positions
      .map((position) => String(position.genericName || '').trim())
      .filter(Boolean);
    const fallbackRoles = DEFAULT_AIRCRAFT_CREW_COMPOSITION.seats
      .map((seat) => String(seat.role || '').trim())
      .filter(Boolean);
    const candidateRoles = Array.from(new Set([...configuredRoles, ...fallbackRoles]));
    return candidateRoles.find((role) => !usedRoles.has(role.toUpperCase())) || null;
  };

  const addAlternateCrewRole = (profileId: string) => {
    const targetProfile = crewCompositionSettings.alternateCompositions.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions.map((profile) => (
      profile.id === profileId || (compositeProfileId && profile.compositeProfileId === compositeProfileId)
        ? (() => {
            const role = getNextAlternateCrewRole(profile);
            return role ? { ...profile, roleRequirements: [...profile.roleRequirements, { role, count: 1 }] } : profile;
          })()
        : profile
    )));
  };

  const removeAlternateCrewRole = (profileId: string, roleIndex: number) => {
    const targetProfile = crewCompositionSettings.alternateCompositions.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCrewCompositionSettings(crewCompositionSettings.alternateCompositions.map((profile) => {
      if ((profile.id !== profileId && (!compositeProfileId || profile.compositeProfileId !== compositeProfileId)) || profile.roleRequirements.length <= 1) return profile;
      return {
        ...profile,
        roleRequirements: profile.roleRequirements.filter((_, index) => index !== roleIndex),
      };
    }));
  };

  const getVisibleCurrencyProfiles = () => uniqueProfilesByCompositeGroup(
    crewCompositionSettings.currencyProfiles.filter((profile) => (
      (!profile.aircraftTypeCode || String(profile.aircraftTypeCode || '').trim().toUpperCase() === activeCrewCompositionAircraftCode)
      && isProfileInActiveUnitContext(profile)
    )),
  );

  const addCurrencyProfile = () => {
    const visibleProfiles = displayCurrencyProfiles;
    const profileIndex = visibleProfiles.length + 1;
    const baseId = createClientRecordId('currency-profile');
    const targetUnitCodes = getActiveScopedUnitCodes();
    const combinedContext = targetUnitCodes.length > 1;
    const createProfileForUnit = (unitCode: string): CurrencyProfile => ({
      id: combinedContext ? `${baseId}-${unitCode.toLowerCase()}` : baseId,
      unitCode,
      compositeUnitCode: combinedContext ? activeStandardMissionUnitCode : '',
      compositeProfileId: combinedContext ? baseId : '',
      aircraftTypeCode: displayCrewCompositionAircraftCode || activeCrewCompositionAircraftCode,
      name: `Profile ${profileIndex}`,
      code: `CURR${profileIndex}`.slice(0, 8).toUpperCase(),
      crew: currencyProfileCrewOptions[0] || `Standard ${activeMissionAircraftTypeCode || displayCrewCompositionAircraftCode || activeCrewCompositionAircraftCode || 'Aircraft'} Crew`,
      config: 'ANY',
      acceptableAircraftConfigs: ['ANY'],
      currency: activeCurrencyDefinitionNames[0] || `Currency ${profileIndex}`,
      dayNight: 'Day',
      flightType: 'Dual',
      aircraftCount: 1,
      status: 'ACTIVE',
    });
    updateCurrencyProfiles([
      ...crewCompositionSettings.currencyProfiles,
      ...targetUnitCodes.map(createProfileForUnit),
    ]);
  };

  const updateCurrencyProfile = (profileId: string, changes: Partial<CurrencyProfile>) => {
    const targetProfile = crewCompositionSettings.currencyProfiles.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCurrencyProfiles(crewCompositionSettings.currencyProfiles.map((profile) => (
      profile.id === profileId || (compositeProfileId && profile.compositeProfileId === compositeProfileId)
        ? {
            ...profile,
            ...changes,
            unitCode: profile.unitCode,
            compositeUnitCode: profile.compositeUnitCode,
            compositeProfileId: profile.compositeProfileId,
          }
        : profile
    )));
  };

  const removeCurrencyProfile = (profileId: string) => {
    const targetProfile = crewCompositionSettings.currencyProfiles.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateCurrencyProfiles(crewCompositionSettings.currencyProfiles.filter((profile) => (
      profile.id !== profileId && (!compositeProfileId || profile.compositeProfileId !== compositeProfileId)
    )));
  };

  const updateTrainingReportTemplate = (
    updater: Partial<TrainingReportTemplate> | ((template: TrainingReportTemplate) => Partial<TrainingReportTemplate> | TrainingReportTemplate),
  ) => {
    if (activeTrainingReportUnitIndex < 0) return;
    setConfig((prev) => {
      const targetUnit = prev.units[activeTrainingReportUnitIndex];
      if (!targetUnit) return prev;
      const orgSettings = prev.organisations[0]?.settings || {};
      const currentTemplate = normaliseTrainingReportTemplate(
        targetUnit.settings?.trainingReportTemplate || orgSettings.trainingReportTemplate || null,
        targetUnit.settings?.trainingReportTerminology || orgSettings.trainingReportTerminology || null,
      );
      const nextPartial = typeof updater === 'function' ? updater(currentTemplate) : updater;
      const nextTemplate = normaliseTrainingReportTemplate({
        ...currentTemplate,
        ...nextPartial,
      });
      return {
        ...prev,
        units: prev.units.map((unit, index) => index === activeTrainingReportUnitIndex
          ? {
              ...unit,
              settings: {
                ...(unit.settings || {}),
                trainingReportTemplate: nextTemplate,
                trainingReportTerminology: normaliseTrainingReportTerminology({ name: nextTemplate.displayName }),
                trainingReportPhraseBank,
              },
            }
          : unit),
      };
    });
  };

  const applyTrainingReportNameDraftsToConfig = (
    sourceConfig: PlatformConfig,
    drafts: Partial<Pick<TrainingReportTemplate, 'genericName' | 'displayName'>>,
  ): PlatformConfig => {
    if (activeTrainingReportUnitIndex < 0) return sourceConfig;
    const nextDrafts: Partial<Pick<TrainingReportTemplate, 'genericName' | 'displayName'>> = {};
    if ('genericName' in drafts) {
      nextDrafts.genericName = String(drafts.genericName ?? '').slice(0, TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH);
    }
    if ('displayName' in drafts) {
      nextDrafts.displayName = String(drafts.displayName ?? '').slice(0, TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH);
    }
    if (!('genericName' in nextDrafts) && !('displayName' in nextDrafts)) return sourceConfig;

    const targetUnit = sourceConfig.units[activeTrainingReportUnitIndex];
    if (!targetUnit) return sourceConfig;
    const orgSettings = sourceConfig.organisations[0]?.settings || {};
    const currentTemplate = normaliseTrainingReportTemplate(
      targetUnit.settings?.trainingReportTemplate || orgSettings.trainingReportTemplate || null,
      targetUnit.settings?.trainingReportTerminology || orgSettings.trainingReportTerminology || null,
    );
    const nextTemplate = normaliseTrainingReportTemplate({
      ...currentTemplate,
      ...nextDrafts,
    });

    return {
      ...sourceConfig,
      units: sourceConfig.units.map((unit, index) => index === activeTrainingReportUnitIndex
        ? {
            ...unit,
            settings: {
              ...(unit.settings || {}),
              trainingReportTemplate: nextTemplate,
              trainingReportTerminology: normaliseTrainingReportTerminology({ name: nextTemplate.displayName }),
              trainingReportPhraseBank,
            },
          }
        : unit),
    };
  };

  const applyTrainingReportTextDraftsToTemplate = (
    sourceTemplate: TrainingReportTemplate,
    drafts: Record<string, string>,
  ): TrainingReportTemplate => {
    let nextTemplate = normaliseTrainingReportTemplate(sourceTemplate);
    Object.entries(drafts).forEach(([draftKey, rawValue]) => {
      const value = String(rawValue ?? '').slice(0, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH);
      const [scope, first, second] = draftKey.split(':');

      if (scope === 'module' && first && second === 'title' && first in nextTemplate.modules) {
        nextTemplate = normaliseTrainingReportTemplate({
          ...nextTemplate,
          modules: {
            ...nextTemplate.modules,
            [first]: {
              ...nextTemplate.modules[first as keyof TrainingReportTemplate['modules']],
              title: value,
            },
          },
        });
        return;
      }

      if (scope === 'field' && first && second && first in nextTemplate.modules) {
        const moduleKey = first as 'overview' | 'overallAssessment' | 'comments';
        if (!('fields' in nextTemplate.modules[moduleKey])) return;
        nextTemplate = normaliseTrainingReportTemplate({
          ...nextTemplate,
          modules: {
            ...nextTemplate.modules,
            [moduleKey]: {
              ...nextTemplate.modules[moduleKey],
              fields: {
                ...nextTemplate.modules[moduleKey].fields,
                [second]: value,
              },
            },
          },
        });
        return;
      }

      if (scope === 'completion' && first) {
        nextTemplate = normaliseTrainingReportTemplate({
          ...nextTemplate,
          completionResults: nextTemplate.completionResults.map((option) => (
            option.code === first ? { ...option, label: value } : option
          )),
        });
        return;
      }

      if (scope === 'overall' && first && first in nextTemplate.overallResults) {
        nextTemplate = normaliseTrainingReportTemplate({
          ...nextTemplate,
          overallResults: {
            ...nextTemplate.overallResults,
            [first]: value,
          },
        });
        return;
      }

      if (scope === 'grade' && first) {
        const gradeValue = Number(first);
        if (!Number.isFinite(gradeValue)) return;
        nextTemplate = normaliseTrainingReportTemplate({
          ...nextTemplate,
          grades: {
            ...nextTemplate.grades,
            options: nextTemplate.grades.options.map((option) => (
              option.value === gradeValue
                ? { ...option, label: value, enabled: value.trim().length > 0 }
                : option
            )),
          },
        });
      }
    });
    return nextTemplate;
  };

  const applyTrainingReportTextDraftsToConfig = (
    sourceConfig: PlatformConfig,
    drafts: Record<string, string>,
  ): PlatformConfig => {
    if (activeTrainingReportUnitIndex < 0 || Object.keys(drafts).length === 0) return sourceConfig;
    const targetUnit = sourceConfig.units[activeTrainingReportUnitIndex];
    if (!targetUnit) return sourceConfig;
    const orgSettings = sourceConfig.organisations[0]?.settings || {};
    const currentTemplate = normaliseTrainingReportTemplate(
      targetUnit.settings?.trainingReportTemplate || orgSettings.trainingReportTemplate || null,
      targetUnit.settings?.trainingReportTerminology || orgSettings.trainingReportTerminology || null,
    );
    const nextTemplate = applyTrainingReportTextDraftsToTemplate(currentTemplate, drafts);

    return {
      ...sourceConfig,
      units: sourceConfig.units.map((unit, index) => index === activeTrainingReportUnitIndex
        ? {
            ...unit,
            settings: {
              ...(unit.settings || {}),
              trainingReportTemplate: nextTemplate,
              trainingReportTerminology: normaliseTrainingReportTerminology({ name: nextTemplate.displayName }),
              trainingReportPhraseBank,
            },
          }
        : unit),
    };
  };

  const updateTrainingReportNameDraft = (
    key: 'genericName' | 'displayName',
    value: string,
    maxLength: number,
  ) => {
    setTrainingReportNameDrafts((previous) => ({
      ...previous,
      [key]: value.slice(0, maxLength),
    }));
  };

  const beginTrainingReportNameDraft = (key: 'genericName' | 'displayName') => {
    setTrainingReportNameDrafts((previous) => ({
      ...previous,
      [key]: previous[key] ?? trainingReportTemplate[key],
    }));
  };

  const commitTrainingReportNameDraft = (key: 'genericName' | 'displayName', finalValue?: string) => {
    if (!(key in trainingReportNameDrafts) && finalValue === undefined) return;
    const valueToCommit = finalValue !== undefined ? finalValue : trainingReportNameDrafts[key] ?? '';
    setConfig((previous) => applyTrainingReportNameDraftsToConfig(previous, { [key]: valueToCommit }));
    setTrainingReportNameDrafts((previous) => {
      if (!(key in previous)) return previous;
      const { [key]: _committedDraft, ...remainingDrafts } = previous;
      return remainingDrafts;
    });
  };

  const beginTrainingReportTextDraft = (draftKey: string, value: string) => {
    setTrainingReportTextDrafts((previous) => ({
      ...previous,
      [draftKey]: previous[draftKey] ?? value,
    }));
  };

  const updateTrainingReportTextDraft = (draftKey: string, value: string, maxLength = TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH) => {
    setTrainingReportTextDrafts((previous) => ({
      ...previous,
      [draftKey]: value.slice(0, maxLength),
    }));
  };

  const commitTrainingReportTextDraft = (draftKey: string, finalValue?: string) => {
    if (!(draftKey in trainingReportTextDrafts) && finalValue === undefined) return;
    const valueToCommit = finalValue !== undefined ? finalValue : trainingReportTextDrafts[draftKey] ?? '';
    setConfig((previous) => applyTrainingReportTextDraftsToConfig(previous, { [draftKey]: valueToCommit }));
    setTrainingReportTextDrafts((previous) => {
      if (!(draftKey in previous)) return previous;
      const { [draftKey]: _committedDraft, ...remainingDrafts } = previous;
      return remainingDrafts;
    });
  };

  const getTrainingReportTextDraftProps = (
    draftKey: string,
    value: string,
    maxLength = TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH,
  ) => ({
    value: trainingReportTextDrafts[draftKey] ?? value,
    onChange: (nextValue: string) => updateTrainingReportTextDraft(draftKey, nextValue, maxLength),
    onFocus: () => beginTrainingReportTextDraft(draftKey, value),
    onBlur: (finalValue?: string) => commitTrainingReportTextDraft(draftKey, finalValue),
  });

  const saveTrainingReportTemplateSettings = async () => {
    const configWithNameDrafts = applyTrainingReportNameDraftsToConfig(config, trainingReportNameDrafts);
    const configToSave = applyTrainingReportTextDraftsToConfig(configWithNameDrafts, trainingReportTextDrafts);
    setConfig(configToSave);
    setTrainingReportNameDrafts({});
    setTrainingReportTextDrafts({});
    const saved = await save(configToSave, 'platform-training-report-template', {
      reloadPage: false,
      successMessage: 'Training Report settings saved.',
    });
    if (saved) {
      setTrainingReportTemplateUnlocked(false);
    }
  };

  const updateTrainingReportModule = (
    moduleKey: keyof TrainingReportTemplate['modules'],
    changes: Record<string, any>,
  ) => {
    updateTrainingReportTemplate((template) => ({
      modules: {
        ...template.modules,
        [moduleKey]: {
          ...template.modules[moduleKey],
          ...changes,
        },
      },
    } as Partial<TrainingReportTemplate>));
  };

  const updateTrainingReportModuleFields = (
    moduleKey: 'overview' | 'overallAssessment' | 'comments',
    fieldKey: string,
    value: string,
  ) => {
    updateTrainingReportTemplate((template) => ({
      modules: {
        ...template.modules,
        [moduleKey]: {
          ...template.modules[moduleKey],
          fields: {
            ...template.modules[moduleKey].fields,
            [fieldKey]: value,
          },
        },
      },
    } as Partial<TrainingReportTemplate>));
  };

  const updateTrainingReportGrade = (gradeValue: number, changes: Partial<{ label: string; requiresRepeat: boolean; enabled: boolean }>) => {
    updateTrainingReportTemplate((template) => {
      const nextOptions = template.grades.options.map((option) => (
        option.value === gradeValue
          ? {
              ...option,
              ...changes,
              ...(Object.prototype.hasOwnProperty.call(changes, 'label')
                ? { enabled: String(changes.label || '').trim().length > 0 }
                : {}),
            }
          : option
      ));
      const gradesRequiringRepeat = nextOptions.filter((option) => option.requiresRepeat).map((option) => option.value);
      return {
        grades: {
          ...template.grades,
          options: nextOptions,
        },
        repeatRules: {
          ...template.repeatRules,
          gradesRequiringRepeat,
        },
      };
    });
  };

  const updateTrainingReportGradeScale = (changes: Partial<{ scaleMin: number; scaleMax: number }>) => {
    updateTrainingReportTemplate((template) => ({
      grades: {
        ...template.grades,
        ...changes,
      },
    }));
  };

  const updateTrainingReportCompletionResult = (code: 'DCO' | 'DPCO' | 'DNCO', changes: Partial<{ label: string; enabled: boolean }>) => {
    updateTrainingReportTemplate((template) => ({
      completionResults: template.completionResults.map((option) => (
        option.code === code ? { ...option, ...changes } : option
      )),
    }));
  };

  const toggleTrainingReportRuleGrade = (
    ruleKey: 'consecutive' | 'rollingWindow',
    gradeValue: number,
    checked: boolean,
  ) => {
    updateTrainingReportTemplate((template) => {
      const current = template.repeatRules[ruleKey].grades || [];
      const nextGrades = checked
        ? Array.from(new Set([...current, gradeValue])).sort((a, b) => a - b)
        : current.filter((value) => value !== gradeValue);
      return {
        repeatRules: {
          ...template.repeatRules,
          [ruleKey]: {
            ...template.repeatRules[ruleKey],
            grades: nextGrades,
          },
        },
      };
    });
  };

  const syncTrainingReportSettingsFromUnit = async () => {
    if (!canEditTrainingReportTemplate || activeTrainingReportUnitIndex < 0 || !trainingReportSyncUnitCode) return;
    const sourceUnit = config.units.find((unit) => (
      String(unit.code || '').trim().toUpperCase() === trainingReportSyncUnitCode.trim().toUpperCase()
    ));
    const targetUnit = config.units[activeTrainingReportUnitIndex];
    if (!sourceUnit || !targetUnit) return;
    const sourceTemplate = normaliseTrainingReportTemplate(
      sourceUnit.settings?.trainingReportTemplate || primaryOrganisationSettings.trainingReportTemplate || null,
      sourceUnit.settings?.trainingReportTerminology || primaryOrganisationSettings.trainingReportTerminology || null,
    );
    const sourceTerminology = normaliseTrainingReportTerminology({
      ...(sourceUnit.settings?.trainingReportTerminology || {}),
      name: sourceTemplate.displayName,
    });
    const sourcePhraseBank = getUnitTrainingReportPhraseBank(config as any, sourceUnit.code, phraseBank);
    const nextConfig = {
      ...config,
      units: config.units.map((unit, index) => index === activeTrainingReportUnitIndex
        ? {
            ...unit,
            settings: {
              ...(unit.settings || {}),
              trainingReportTemplate: sourceTemplate,
              trainingReportTerminology: sourceTerminology,
              trainingReportPhraseBank: sourcePhraseBank,
              trainingReportSyncedFromUnit: sourceUnit.code,
              trainingReportSyncedAt: new Date().toISOString(),
            },
          }
        : unit),
    };
    setConfig(nextConfig);
    logAudit({
      page: 'Settings - Training Reports',
      action: 'Sync',
      description: `Synced Training Report settings into ${targetUnit.code}`,
      changes: `Copied report template and scoring matrix from ${sourceUnit.code} to ${targetUnit.code}`,
    });
    await save(nextConfig, 'training-report-template');
  };

  const renderTrainingReportTemplateAction = () => {
    if (!canEdit) return null;
    return trainingReportTemplateUnlocked ? (
      <button
        type="button"
        disabled={saving || applyingChanges}
        onMouseDown={(event) => event.preventDefault()}
        onClick={saveTrainingReportTemplateSettings}
        className={platformActionButtonClass}
      >
        Save
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setTrainingReportTemplateUnlocked(true)}
        className={platformActionButtonClass}
      >
        Edit
      </button>
    );
  };

  const updateInsertEventTypes = (nextEventTypes: InsertEventTypeConfig[]) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      insertEventTypes: normaliseInsertEventTypes(nextEventTypes),
    }));
  };

  const getTaskProfileUnitDraftKey = (unit: any, unitIndex: number) => String(unit?.code || unit?.id || `unit-${unitIndex}`);

  const startTaskProfilesEdit = () => {
    setTaskProfileDrafts(Object.fromEntries(
      OPERATIONAL_MODEL_OPTIONS.map((option) => [
        option.value,
        formatTaskProfileText(taskProfiles[option.value] || []),
      ]),
    ));
    setTaskProfileAbbreviationDrafts(Object.fromEntries(
      config.units.map((unit, unitIndex) => [
        getTaskProfileUnitDraftKey(unit, unitIndex),
        formatTaskProfileAbbreviationText(unit.settings?.taskProfileAbbreviations || {}),
      ]),
    ));
    setTaskProfilesUnlocked(true);
  };

  const updateMasterLmpAccessRules = (rules: PlatformMasterLmpAccessRule[]) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      masterLmpAccess: rules,
    }));
  };

  const updateMasterLmpCatalogue = (entries: PlatformMasterLmpCatalogueEntry[]) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      masterLmpCatalogue: entries,
    }));
  };

  const updateMasterLmpCatalogueEntry = (index: number, changes: Partial<PlatformMasterLmpCatalogueEntry>) => {
    updateMasterLmpCatalogue(masterLmpCatalogue.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...changes } : entry
    )));
  };

  const addMasterLmpCatalogueEntry = () => {
    const nextNumber = masterLmpCatalogue.length + 1;
    updateMasterLmpCatalogue([
      ...masterLmpCatalogue,
      {
        id: createClientRecordId('master-lmp-catalogue'),
        code: `New Master LMP ${nextNumber}`,
        name: `New Master LMP ${nextNumber}`,
        description: '',
        status: 'ACTIVE',
      },
    ]);
  };

  const deleteMasterLmpCatalogueEntry = async (index: number) => {
    if (!canEdit) return;
    const entry = masterLmpCatalogue[index];
    if (!entry) return;
    const lmpCode = String(entry.code || entry.name || '').trim();
    const lmpLabel = entry.name || entry.code || 'this Master LMP';
    const linkedSyllabusCount = masterLmpSyllabusCounts.get(lmpCode.toUpperCase()) || 0;
    const linkedAccessRules = masterLmpAccessRules.filter((rule) => (
      String(rule.lmpCode || '').trim().toUpperCase() === lmpCode.toUpperCase()
    )).length;
    const password = await showDarkPrompt({
      title: 'Delete Master LMP',
      message: `Enter your password to delete ${lmpLabel}. This removes the catalogue row and ${linkedAccessRules} access rule${linkedAccessRules === 1 ? '' : 's'}. Existing syllabus content is not deleted (${linkedSyllabusCount} event${linkedSyllabusCount === 1 ? '' : 's'} linked).`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The Master LMP was not deleted.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The Master LMP was not deleted.', 'Password Check Failed', 'error');
      return;
    }

    const nextConfig = buildConfigWithPrimaryOrganisationSettings(config, (settings) => ({
      ...settings,
      masterLmpCatalogue: masterLmpCatalogue.filter((_, entryIndex) => entryIndex !== index),
      masterLmpAccess: masterLmpAccessRules.filter((rule) => (
        String(rule.lmpCode || '').trim().toUpperCase() !== lmpCode.toUpperCase()
      )),
    }));
    setConfig(nextConfig);
    notifyPlatformConfigUpdatedSoon(nextConfig);
    await save(nextConfig, 'platform-master-lmp-access', {
      reloadPage: false,
      successMessage: `Deleted Master LMP ${lmpLabel}.`,
    });
  };

  const updateMasterLmpAccessRule = (index: number, changes: Partial<PlatformMasterLmpAccessRule>) => {
    updateMasterLmpAccessRules(masterLmpAccessRules.map((rule, ruleIndex) => (
      ruleIndex === index ? { ...rule, ...changes } : rule
    )));
  };

  const addMasterLmpAccessRule = () => {
    const defaultUnit = activePlatformUnit || config.units.filter(isActiveRecord)[0];
    updateMasterLmpAccessRules([
      ...masterLmpAccessRules,
      {
        id: createClientRecordId('master-lmp-access'),
        lmpCode: masterLmpOptions[0] || '',
        organisationCode: primaryOrganisation?.code || 'DEFAULT',
        locationCode: null,
        unitCode: defaultUnit?.code || '',
        aircraftTypeCode: null,
        parentOrganisationCode: null,
        operationalModel: null,
        accessLevel: 'View',
        status: 'ACTIVE',
      },
    ]);
  };

  const removeMasterLmpAccessRule = (index: number) => {
    updateMasterLmpAccessRules(masterLmpAccessRules.filter((_, ruleIndex) => ruleIndex !== index));
  };

  const getMasterLmpAccessRuleKey = (rule: PlatformMasterLmpAccessRule, index: number) => (
    String(rule.id || `master-lmp-access-${index}`)
  );

  const toggleMasterLmpAccessScope = (rule: PlatformMasterLmpAccessRule, index: number) => {
    const ruleKey = getMasterLmpAccessRuleKey(rule, index);
    setExpandedMasterLmpAccessScopes((current) => {
      const next = new Set(current);
      if (next.has(ruleKey)) {
        next.delete(ruleKey);
      } else {
        next.add(ruleKey);
      }
      return next;
    });
  };

  const updateInsertEventType = (index: number, changes: Partial<InsertEventTypeConfig>) => {
    const next = insertEventTypes.map((eventType, eventTypeIndex) => (
      eventTypeIndex === index ? { ...eventType, ...changes } : eventType
    ));
    updateInsertEventTypes(next);
  };

  const addInsertEventType = () => {
    const sourceEventType = insertEventTypes[insertEventTypes.length - 1] || {
      label: 'EVT',
      syllabusType: 'Flight' as InsertEventSyllabusType,
      dayNight: 'Day' as InsertEventDayNight,
      duration: 1,
      flightOrSimHours: 1,
      totalEventHours: 1,
      preFlightTime: 0,
      postFlightTime: 0,
      resourceCount: 1,
    };
    updateInsertEventTypes([
      ...insertEventTypes,
      {
        ...sourceEventType,
        label: `EVT${insertEventTypes.length + 1}`.slice(0, INSERT_EVENT_LABEL_MAX_LENGTH),
      },
    ]);
  };

  const removeInsertEventType = (index: number) => {
    updateInsertEventTypes(insertEventTypes.filter((_, eventTypeIndex) => eventTypeIndex !== index));
  };

  const toggleDeploymentReadiness = (itemId: string, checked: boolean) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      deploymentReadiness: {
        ...(settings.deploymentReadiness || {}),
        [itemId]: checked,
      },
    }));
  };

  const updateLicenseFeatures = (licenseIndex: number, changes: Record<string, any>) => {
    const currentFeatures = config.licenses[licenseIndex]?.features || {};
    updateRow('licenses', licenseIndex, {
      features: {
        ...currentFeatures,
        ...changes,
      },
    });
  };

  const updateRow = (collection: keyof PlatformConfig, index: number, changes: Record<string, any>) => {
    setConfig((prev) => {
      const nextConfig = {
        ...prev,
        [collection]: prev[collection].map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...changes } : item
        )),
      };
      notifyPlatformConfigUpdatedSoon(nextConfig);
      return nextConfig;
    });
  };

  const updateUnitTypes = (value: string) => {
    setConfig((prev) => {
      const nextConfig = {
        ...prev,
        unitTypes: normaliseUnitTypes(
          value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          prev.units,
        ),
      };
      notifyPlatformConfigUpdatedSoon(nextConfig);
      return nextConfig;
    });
  };

  const commitUnitTypesDraft = () => {
    setIsEditingUnitTypes(false);
    updateUnitTypes(unitTypesDraft);
  };

  const removeUserAccessScope = (index: number) => {
    setConfig((prev) => {
      const nextConfig = {
        ...prev,
        userAccess: prev.userAccess.filter((_, itemIndex) => itemIndex !== index),
      };
      notifyPlatformConfigUpdatedSoon(nextConfig);
      return nextConfig;
    });
  };

  const updateAircraftCrewCount = (aircraftIndex: number, crewCount: number) => {
    const current = normaliseAircraftCrewComposition(config.aircraftTypes[aircraftIndex]?.crewComposition);
    const nextCount = Math.max(1, Math.min(12, Math.round(Number(crewCount) || 1)));
    const next = normaliseAircraftCrewComposition({
      crewCount: nextCount,
      seats: current.seats,
      resourceSeatCounts: {
        flight: Math.min(nextCount, current.resourceSeatCounts?.flight ?? current.crewCount),
        sim: Math.min(nextCount, current.resourceSeatCounts?.sim ?? current.crewCount),
        cpt: Math.min(nextCount, current.resourceSeatCounts?.cpt ?? current.crewCount),
      },
    });
    updateRow('aircraftTypes', aircraftIndex, { crewComposition: next });
  };

  const updateAircraftCrewResourceSeatCount = (aircraftIndex: number, kind: AircraftCrewResourceKind, count: number) => {
    const current = normaliseAircraftCrewComposition(config.aircraftTypes[aircraftIndex]?.crewComposition);
    const nextCount = Math.max(0, Math.min(current.crewCount, Math.round(Number(count) || 0)));
    const nextResourceSeatCounts = {
      flight: current.resourceSeatCounts?.flight ?? current.crewCount,
      sim: current.resourceSeatCounts?.sim ?? current.crewCount,
      cpt: current.resourceSeatCounts?.cpt ?? current.crewCount,
      [kind]: nextCount,
    };
    const seats = current.seats.map((seat, index) => {
      const nextRolesByResource = { ...(seat.eligibleRolesByResource || {}) };
      if (index < nextCount && getAircraftSeatEligibleRolesForResource(seat, kind).length === 0) {
        nextRolesByResource[kind] = getAircraftSeatEligibleRoles(seat);
      }
      if (index >= nextCount) {
        nextRolesByResource[kind] = [];
      }
      return {
        ...seat,
        resourceTypes: { ...(seat.resourceTypes || {}), [kind]: index < nextCount },
        eligibleRolesByResource: nextRolesByResource,
      };
    });
    updateRow('aircraftTypes', aircraftIndex, {
      crewComposition: normaliseAircraftCrewComposition({
        ...current,
        resourceSeatCounts: nextResourceSeatCounts,
        seats,
      }),
    });
  };

  const updateAircraftSeatRole = (aircraftIndex: number, seatIndex: number, role: string) => {
    const current = normaliseAircraftCrewComposition(config.aircraftTypes[aircraftIndex]?.crewComposition);
    const seats = current.seats.map((seat, index) => (
      index === seatIndex
        ? { ...seat, role, eligibleRoles: Array.from(new Set([role, ...getAircraftSeatEligibleRoles(seat)])) }
        : seat
    ));
    updateRow('aircraftTypes', aircraftIndex, {
      crewComposition: normaliseAircraftCrewComposition({ ...current, seats }),
    });
  };

  const updateAircraftSeatResourceEligibleRole = (
    aircraftIndex: number,
    seatIndex: number,
    kind: AircraftCrewResourceKind,
    role: string,
    checked: boolean,
  ) => {
    const current = normaliseAircraftCrewComposition(config.aircraftTypes[aircraftIndex]?.crewComposition);
    const seats = current.seats.map((seat, index) => {
      if (index !== seatIndex) return seat;
      const currentRoles = getAircraftSeatEligibleRolesForResource(seat, kind);
      const nextRoles = checked
        ? Array.from(new Set([...currentRoles, role]))
        : currentRoles.filter((candidate) => candidate.toUpperCase() !== role.toUpperCase());
      const eligibleRoles = getAircraftSeatEligibleRoles(seat);
      const nextBaseRoles = checked && !eligibleRoles.some(candidate => candidate.toUpperCase() === role.toUpperCase())
        ? Array.from(new Set([...eligibleRoles, role]))
        : eligibleRoles;
      const primaryRoleStillEligible = nextBaseRoles.some((candidate) => candidate.toUpperCase() === String(seat.role || '').trim().toUpperCase());
      return {
        ...seat,
        role: primaryRoleStillEligible ? seat.role : nextBaseRoles[0],
        eligibleRoles: nextBaseRoles,
        resourceTypes: { ...(seat.resourceTypes || {}), [kind]: nextRoles.length > 0 },
        eligibleRolesByResource: {
          ...(seat.eligibleRolesByResource || {}),
          [kind]: nextRoles,
        },
      };
    });
    updateRow('aircraftTypes', aircraftIndex, {
      crewComposition: normaliseAircraftCrewComposition({ ...current, seats }),
    });
  };

  const updateAircraftSeatEligibleRole = (aircraftIndex: number, seatIndex: number, role: string, checked: boolean) => {
    const current = normaliseAircraftCrewComposition(config.aircraftTypes[aircraftIndex]?.crewComposition);
    const seats = current.seats.map((seat, index) => {
      if (index !== seatIndex) return seat;
      const currentRoles = getAircraftSeatEligibleRoles(seat);
      const nextRoles = checked
        ? Array.from(new Set([...currentRoles, role]))
        : currentRoles.filter((candidate) => candidate.toUpperCase() !== role.toUpperCase());
      const eligibleRoles = nextRoles.length > 0 ? nextRoles : currentRoles;
      const primaryRoleStillEligible = eligibleRoles.some((candidate) => candidate.toUpperCase() === String(seat.role || '').trim().toUpperCase());
      return {
        ...seat,
        role: primaryRoleStillEligible ? seat.role : eligibleRoles[0],
        eligibleRoles,
      };
    });
    updateRow('aircraftTypes', aircraftIndex, {
      crewComposition: normaliseAircraftCrewComposition({ ...current, seats }),
    });
  };

  const applyKnownAirfieldToLocation = (
    index: number,
    entry: AirfieldCatalogueEntry,
    currentLocation = config.locations[index],
  ) => {
    updateRow('locations', index, getAirfieldCatalogueLocationChanges(entry, currentLocation, true));
  };

  const updateLocationIdentity = (index: number, field: 'code' | 'iataCode' | 'name', value: string) => {
    updateRow('locations', index, { [field]: value });
  };

  const addLocation = () => {
    const newLocationId = createClientRecordId('location');
    pendingLocationScrollIdRef.current = newLocationId;
    setConfig((prev) => {
      const referenceLocation = prev.locations[0] || {};
      return {
        ...prev,
        locations: [
          ...prev.locations,
          {
            id: newLocationId,
            organisationCode: prev.organisations[0]?.code || 'DEFAULT',
            code: '',
            iataCode: '',
            name: '',
            timezoneOffset: referenceLocation.timezoneOffset ?? 10,
            latitude: null,
            longitude: null,
            timezone: '',
            trainingAreas: [],
            status: 'ACTIVE',
            settings: {},
          },
        ],
      };
    });
  };

  const removeLocation = async (index: number) => {
    if (!canEdit) return;
    const location = config.locations[index];
    if (!location) return;
    if (config.locations.length <= 1) {
      await showDarkAlert('At least one location must remain configured.', 'Cannot Remove Location', 'warning');
      return;
    }

    const password = await showDarkPrompt({
      title: 'Remove Location',
      message: `Enter your password to remove ${getPlatformLocationAuditLabel(location)}. Units and resource pools assigned to it will be moved to the first remaining location.`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The location was not removed.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The location was not removed.', 'Password Check Failed', 'error');
      return;
    }

    setConfig((prev) => {
      const removed = prev.locations[index];
      const removedCode = String(removed?.code || '').trim();
      const nextLocations = prev.locations.filter((_, itemIndex) => itemIndex !== index);
      const fallbackCode = String(nextLocations[0]?.code || '').trim();

      return {
        ...prev,
        locations: nextLocations,
        units: prev.units.map((unit) => (
          removedCode && unit.locationCode === removedCode ? { ...unit, locationCode: fallbackCode } : unit
        )),
        resourcePools: prev.resourcePools.map((pool) => (
          removedCode && pool.locationCode === removedCode ? { ...pool, locationCode: fallbackCode || null } : pool
        )),
      };
    });
  };

  const platformActionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

  const rewriteUnitCodesInSettings = (settings: Record<string, any> = {}, oldCode: string, nextCode: string | null): Record<string, any> => {
    const normalise = (value: unknown) => String(value || '').trim();
    const replaceUnitList = (units: unknown): string[] => {
      const values = Array.isArray(units) ? units : [];
      const next = values
        .map((unitCode) => {
          const code = normalise(unitCode);
          if (!code) return '';
          if (code === oldCode) return nextCode || '';
          return code;
        })
        .filter(Boolean);
      return Array.from(new Set(next));
    };
    const rewriteDesiredAllocations = (allocations: Record<string, any> = {}) => {
      if (!oldCode || !Object.prototype.hasOwnProperty.call(allocations, oldCode)) return allocations;
      const nextAllocations = { ...allocations };
      const oldValue = nextAllocations[oldCode];
      delete nextAllocations[oldCode];
      if (nextCode) nextAllocations[nextCode] = oldValue;
      return nextAllocations;
    };
    const rewriteSharingGroups = (groups: unknown) => (
      Array.isArray(groups)
        ? groups.map((group) => ({
            ...group,
            selectedUnits: replaceUnitList(group?.selectedUnits),
            desiredAllocations: rewriteDesiredAllocations(group?.desiredAllocations || {}),
          }))
        : groups
    );

    return {
      ...settings,
      selectedUnits: replaceUnitList(settings.selectedUnits),
      staffSharingUnits: replaceUnitList(settings.staffSharingUnits),
      desiredAllocations: rewriteDesiredAllocations(settings.desiredAllocations || {}),
      resourceSharingGroups: rewriteSharingGroups(settings.resourceSharingGroups),
      staffSharingGroups: rewriteSharingGroups(settings.staffSharingGroups),
      masterLmpAccess: Array.isArray(settings.masterLmpAccess)
        ? settings.masterLmpAccess
            .map((rule: any) => (
              normalise(rule?.unitCode) === oldCode
                ? { ...rule, unitCode: nextCode || '' }
                : rule
            ))
            .filter((rule: any) => nextCode || normalise(rule?.unitCode) !== '')
        : settings.masterLmpAccess,
    };
  };

  const updateUnitCode = (index: number, value: string) => {
    const nextCode = String(value || '').trim();
    setConfig((prev) => {
      const oldCode = String(prev.units[index]?.code || '').trim();
      if (!oldCode || !nextCode || oldCode === nextCode) {
        return {
          ...prev,
          units: prev.units.map((unit, unitIndex) => (
            unitIndex === index ? { ...unit, code: value } : unit
          )),
        };
      }
      return {
        ...prev,
        units: prev.units.map((unit, unitIndex) => (
          unitIndex === index ? { ...unit, code: value } : unit
        )),
        unitModules: prev.unitModules.map((item) => (
          String(item.unitCode || '').trim() === oldCode ? { ...item, unitCode: nextCode } : item
        )),
        resourcePools: prev.resourcePools.map((pool) => (
          String(pool.unitCode || '').trim() === oldCode ? { ...pool, unitCode: nextCode } : pool
        )),
        userAccess: prev.userAccess.map((access) => (
          String(access.unitCode || '').trim() === oldCode ? { ...access, unitCode: nextCode } : access
        )),
        schedulingRuleSets: prev.schedulingRuleSets.map((ruleSet) => (
          String(ruleSet.unitCode || '').trim() === oldCode ? { ...ruleSet, unitCode: nextCode } : ruleSet
        )),
        organisations: prev.organisations.map((organisation) => ({
          ...organisation,
          settings: rewriteUnitCodesInSettings(organisation.settings || {}, oldCode, nextCode),
        })),
      };
    });
  };

  const addUnit = () => {
    if (!canEdit) return;
    const contextUnit = activePlatformUnit || config.units[Math.min(selectedUnitIndex, Math.max(0, config.units.length - 1))] || null;
    const contextUnitSettings = contextUnit?.settings || {};
    const defaultLocation = contextUnit?.locationCode || config.locations[0]?.code || '';
    const newUnitId = createClientRecordId('unit');
    const nextUnitIndex = config.units.length;
    const defaultTrainingReportTemplate = normaliseTrainingReportTemplate(
      config.organisations[0]?.settings?.trainingReportTemplate || null,
      config.organisations[0]?.settings?.trainingReportTerminology || null,
    );
    const defaultTrainingReportPhraseBank = config.organisations[0]?.settings?.trainingReportPhraseBank || phraseBank;
    pendingUnitScrollIdRef.current = newUnitId;
    setSelectedUnitIndex(nextUnitIndex);
    setEditingUnitIndex(nextUnitIndex);
    setConfig((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          id: newUnitId,
          code: `UNIT-${prev.units.length + 1}`,
          name: 'New Unit',
          organisationCode: contextUnit?.organisationCode || prev.organisations[0]?.code || 'DEFAULT',
          locationCode: defaultLocation,
          unitType: contextUnit?.unitType || '',
          status: 'ACTIVE',
          settings: {
            parentOrganisationPath: Array.isArray(contextUnitSettings.parentOrganisationPath) ? contextUnitSettings.parentOrganisationPath : undefined,
            parentOrganisation: contextUnitSettings.parentOrganisation || undefined,
            aircraftTypeCode: contextUnitSettings.aircraftTypeCode || contextUnitSettings.aircraftType || undefined,
            operationalModel: contextUnitSettings.operationalModel || DEFAULT_OPERATIONAL_MODEL,
            hasTrainees: false,
            trainingReportTemplate: defaultTrainingReportTemplate,
            trainingReportTerminology: normaliseTrainingReportTerminology({ name: defaultTrainingReportTemplate.displayName }),
            trainingReportPhraseBank: defaultTrainingReportPhraseBank,
          },
        },
      ],
    }));
  };

  const editSelectedUnit = async () => {
    if (!canEdit) return;
    if (config.units.length === 0) {
      await showDarkAlert('Add a unit before editing unit details.', 'No Unit Selected', 'warning');
      return;
    }
    const unitIndex = Math.min(selectedUnitIndex, config.units.length - 1);
    scrollUnitRowIntoView(unitIndex);
    setEditingUnitIndex(unitIndex);
  };

  const deleteSelectedUnit = async () => {
    if (!canEdit) return;
    if (config.units.length === 0) {
      await showDarkAlert('There are no units to delete.', 'No Unit Selected', 'warning');
      return;
    }
    if (config.units.length <= 1) {
      await showDarkAlert('At least one unit must remain configured.', 'Cannot Delete Unit', 'warning');
      return;
    }

    const unitIndex = Math.min(selectedUnitIndex, config.units.length - 1);
    scrollUnitRowIntoView(unitIndex);
    const unit = config.units[unitIndex];
    const unitCode = String(unit?.code || '').trim();
    const unitLabel = `${unitCode || 'Unnamed Unit'}${unit?.name ? ` - ${unit.name}` : ''}`;
    const password = await showDarkPrompt({
      title: 'Delete Unit',
      message: `Enter your password to delete ${unitLabel}. Unit module assignments will be removed and dependent resource, access and scheduling scopes will be cleared.`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The unit was not deleted.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The unit was not deleted.', 'Password Check Failed', 'error');
      return;
    }

    const removedCode = String(unit?.code || '').trim();
    const nextConfig: PlatformConfig = {
      ...config,
      units: config.units.filter((_, itemIndex) => itemIndex !== unitIndex),
      unitModules: config.unitModules.filter((item) => String(item.unitCode || '').trim() !== removedCode),
      resourcePools: config.resourcePools.map((pool) => (
        removedCode && String(pool.unitCode || '').trim() === removedCode ? { ...pool, unitCode: null } : pool
      )),
      userAccess: config.userAccess.map((access) => (
        removedCode && String(access.unitCode || '').trim() === removedCode ? { ...access, unitCode: null } : access
      )),
      schedulingRuleSets: config.schedulingRuleSets.map((ruleSet) => (
        removedCode && String(ruleSet.unitCode || '').trim() === removedCode ? { ...ruleSet, unitCode: null } : ruleSet
      )),
      organisations: config.organisations.map((organisation) => ({
        ...organisation,
        settings: removedCode
          ? rewriteUnitCodesInSettings(organisation.settings || {}, removedCode, null)
          : organisation.settings,
      })),
    };

    const saved = await save(nextConfig, 'platform-units', { successMessage: `Unit ${unitLabel} deleted.` });
    if (saved) {
      setConfig(nextConfig);
      setSelectedUnitIndex(Math.max(0, unitIndex - 1));
      setEditingUnitIndex(null);
    }
  };

  const addAircraftType = () => {
    setResourcePoolActiveTab('aircraftTypes');
    const id = createClientRecordId('aircraft-type');
    setNewAircraftTypeVisibleIds((current) => new Set([...Array.from(current), id]));
    setConfig((prev) => {
      const existingCodes = new Set(prev.aircraftTypes.map((aircraft: any) => String(aircraft.code || '').trim().toUpperCase()));
      let suffix = prev.aircraftTypes.length + 1;
      let code = `AIRCRAFT-${suffix}`;
      while (existingCodes.has(code.toUpperCase())) {
        suffix += 1;
        code = `AIRCRAFT-${suffix}`;
      }

      return {
        ...prev,
        aircraftTypes: [
          ...prev.aircraftTypes,
          {
            id,
            code,
            name: 'New Aircraft Type',
            category: 'Other',
            defaultTasKtas: null,
            defaultCruiseAltitudeFl: null,
            status: 'ACTIVE',
            crewComposition: DEFAULT_AIRCRAFT_CREW_COMPOSITION,
          },
        ],
      };
    });
  };

  const addResourcePool = () => {
    const selectedUnit = config.units[Math.min(selectedUnitIndex, Math.max(0, config.units.length - 1))];
    const defaultLocation = selectedUnit?.locationCode || config.locations[0]?.code || '';
    const defaultUnitCode = selectedUnit?.code || '';
    const newPoolId = createClientRecordId('pool');
    pendingResourcePoolScrollIdRef.current = newPoolId;
    setResourcePoolActiveTab('resourcePools');
    setConfig((prev) => {
      const selectedUnitRecord = prev.units.find((unit) => (
        String(unit.code || '').trim().toUpperCase() === String(defaultUnitCode || '').trim().toUpperCase()
      )) || selectedUnit;
      const unitAircraftCode = String(
        selectedUnitRecord?.settings?.aircraftTypeCode
        || selectedUnitRecord?.settings?.aircraftType
        || '',
      ).trim().toUpperCase();
      const visibleAircraftCode = String(visibleAircraftTypeOptions.find(Boolean) || '').trim().toUpperCase();
      const defaultAircraftTypeCode = unitAircraftCode
        || visibleAircraftCode
        || String(prev.aircraftTypes[0]?.code || '').trim().toUpperCase();
      const defaultAircraftType = prev.aircraftTypes.find((aircraft) => (
        String(aircraft.code || '').trim().toUpperCase() === defaultAircraftTypeCode
      ));
      const defaultAircraftLabel = String(
        defaultAircraftType?.name
        || defaultAircraftType?.code
        || defaultAircraftTypeCode
        || 'Aircraft',
      ).trim();

      return {
        ...prev,
        resourcePools: [
          ...prev.resourcePools,
          {
            id: newPoolId,
            code: `POOL-${prev.resourcePools.length + 1}`,
            name: 'New Resource Pool',
            organisationCode: prev.organisations[0]?.code || 'DEFAULT',
            locationCode: defaultLocation,
            unitCode: defaultUnitCode,
            aircraftTypeCode: defaultAircraftTypeCode || null,
            poolType: 'Dedicated',
            status: 'ACTIVE',
            settings: {
              applyToV2Runtime: true,
              aircraftLabel: defaultAircraftLabel,
              aircraftNumberUsePrefix: true,
              aircraftNumberPrefixes: [],
              aircraftNumberDefaultPrefix: '',
              aircraftConfigurations: [],
              ftdLabel: 'FTD',
              cptLabel: 'CPT',
              aircraft: 0,
              ftd: 0,
              cpt: 0,
              standby: 0,
              ground: 0,
            },
          },
        ],
      };
    });
  };

  const addLicense = () => {
    setConfig((prev) => {
      const organisationCode = prev.organisations[0]?.code || 'DEFAULT';
      const newLicenseId = createClientRecordId('license');
      const activeModuleCodes = prev.modules
        .filter((module) => String(module.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
        .map((module) => module.code)
        .filter(Boolean);
      return {
        ...prev,
        licenses: [
          ...prev.licenses,
          {
            id: newLicenseId,
            organisationCode,
            licenseKey: `${organisationCode}-LIC-${prev.licenses.length + 1}`,
            licenseName: 'New Licence',
            deploymentMode: 'Online SaaS',
            status: 'ACTIVE',
            validFrom: '',
            validUntil: '',
            maxUsers: null,
            maxUnits: null,
            maxAircraftTypes: null,
            moduleCodes: activeModuleCodes,
            features: {
              enforcementMode: deploymentProfile.enforcementMode,
              validationMethod: deploymentProfile.validationMethod,
              offlineGraceDays: deploymentProfile.offlineGraceDays,
              allowOfflineOperation: deploymentProfile.mode !== 'Online SaaS',
            },
            offlineFingerprint: '',
            notes: 'Deployment readiness record. Licence enforcement should remain in Monitor Only unless deliberately changed by the platform administrator.',
          },
        ],
      };
    });
  };

  const toggleLicenseModule = (licenseIndex: number, moduleCode: string, checked: boolean) => {
    const currentCodes = Array.isArray(config.licenses[licenseIndex]?.moduleCodes)
      ? config.licenses[licenseIndex].moduleCodes
      : [];
    const moduleCodes = checked
      ? Array.from(new Set([...currentCodes, moduleCode]))
      : currentCodes.filter((code: string) => code !== moduleCode);
    updateRow('licenses', licenseIndex, { moduleCodes });
  };

  const permissionProfiles = useMemo<PermissionProfile[]>(() => {
    const profiles = config.organisations[0]?.settings?.permissionProfiles;
    return Array.isArray(profiles) ? profiles : DEFAULT_PERMISSION_PROFILES;
  }, [config.organisations]);

  const configurationHealth = useMemo(
    () => buildConfigurationHealth(config, permissionProfiles, readinessPercent, operationalReadinessPercent),
    [config, permissionProfiles, readinessPercent, operationalReadinessPercent],
  );

  const configurationHealthSummary = useMemo(() => (
    configurationHealth.reduce<Record<ConfigurationHealthSeverity, number>>((summary, item) => ({
      ...summary,
      [item.severity]: summary[item.severity] + 1,
    }), { OK: 0, WARNING: 0, CRITICAL: 0 })
  ), [configurationHealth]);

  const exportConfigurationHealthReport = () => {
    const generatedAt = new Date().toISOString();
    const report = {
      generatedAt,
      summary: configurationHealthSummary,
      inventory: {
        organisations: config.organisations.length,
        activeOrganisations: config.organisations.filter(isActiveRecord).length,
        locations: config.locations.length,
        activeLocations: config.locations.filter(isActiveRecord).length,
        units: config.units.length,
        activeUnits: config.units.filter(isActiveRecord).length,
        resourcePools: config.resourcePools.length,
        activeResourcePools: config.resourcePools.filter(isActiveRecord).length,
        modules: config.modules.length,
        activeModules: config.modules.filter(isActiveRecord).length,
        licences: config.licenses.length,
        activeLicences: config.licenses.filter(isActiveRecord).length,
        platformUsers: config.platformUsers.length,
        activeUserAccessScopes: config.userAccess.filter(isActiveRecord).length,
      },
      readiness: {
        deploymentReadinessPercent: readinessPercent,
        operationalReadinessPercent,
      },
      checks: configurationHealth,
      note: 'Configuration health is advisory and non-secret. This export intentionally excludes database URLs, passwords, tokens and private licence keys.',
    };
    downloadTextFile(
      `dfp-neo-configuration-health-${generatedAt.slice(0, 10)}.json`,
      JSON.stringify(report, null, 2),
      'application/json',
    );
  };

  const updatePermissionProfiles = (profiles: PermissionProfile[]) => {
    setConfig((prev) => {
      const organisations = prev.organisations.length > 0
        ? prev.organisations
        : [{ code: 'DEFAULT', name: 'Organisation', status: 'ACTIVE', settings: {} }];
      return {
        ...prev,
        organisations: organisations.map((org, index) => (
          index === 0
            ? { ...org, settings: { ...(org.settings || {}), permissionProfiles: profiles } }
            : org
        )),
      };
    });
  };

  const updatePermissionProfile = (profileId: string, changes: Partial<PermissionProfile>) => {
    updatePermissionProfiles(permissionProfiles.map((profile) => (
      profile.id === profileId ? { ...profile, ...changes } : profile
    )));
  };

  const selectedPermissionProfile = useMemo(
    () => permissionProfiles.find((profile) => profile.id === selectedProfileId) || permissionProfiles[0],
    [permissionProfiles, selectedProfileId],
  );

  const addPermissionProfile = () => {
    const id = `profile-${Date.now()}`;
    updatePermissionProfiles([
      ...permissionProfiles,
      {
        id,
        name: 'New Permission Profile',
        description: 'Describe what this profile allows.',
        permissions: ['dfp.view'],
      },
    ]);
    setSelectedProfileId(id);
  };

  const displayUserName = (user: any): string => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.displayName || user.username || user.userId || 'Unknown User';
  };

  const userOptions = useMemo(
    () => {
      const platformOptions = config.platformUsers.map((user) => ({
        id: user.userId || user.username,
        name: displayUserName(user),
        username: user.username || user.userId || '',
        email: user.email || '',
      })).filter((user) => user.id);
      const platformUserIds = new Set(platformOptions.flatMap((user) => uniqueValues([user.id, user.username].map(toIdentifier))));
      const orphanOptions = config.userAccess
        .filter((access) => {
          const accessUserId = toIdentifier(access.userId);
          const accessUsername = toIdentifier(access.username);
          return (accessUserId || accessUsername) && !platformUserIds.has(accessUserId) && !platformUserIds.has(accessUsername);
        })
        .map((access) => ({
          id: access.userId || access.username,
          name: `${access.displayName || access.username || access.userId || 'Unknown user'} (missing user record)`,
          username: access.username || access.userId || '',
          email: '',
        }))
        .filter((user, index, rows) => user.id && rows.findIndex((candidate) => candidate.id === user.id) === index);
      return [...platformOptions, ...orphanOptions].sort((a, b) => a.name.localeCompare(b.name));
    },
    [config.platformUsers, config.userAccess],
  );

  const selectedAccessUser = useMemo(
    () => config.platformUsers.find((user) => (user.userId || user.username) === selectedAccessUserId),
    [config.platformUsers, selectedAccessUserId],
  );

  const selectedAccessRows = useMemo(
    () => config.userAccess
      .map((access, index) => ({ access, index }))
      .filter(({ access }) => (
        [access.userId, access.username]
          .map((value) => String(value || '').trim())
          .some((value) => value === selectedAccessUserId)
      )),
    [config.userAccess, selectedAccessUserId],
  );

  const selectedAccessDisplayName = selectedAccessUser
    ? `${selectedAccessUser.firstName || ''} ${selectedAccessUser.lastName || ''}`.trim() || selectedAccessUser.username || selectedAccessUser.userId
    : selectedAccessRows[0]?.access.displayName
      ? `${selectedAccessRows[0].access.displayName} (missing platform user record)`
      : selectedAccessUserId
        ? `${selectedAccessUserId} (missing platform user record)`
        : 'No user selected';

  const selectedUserProfileIds = useMemo(() => {
    const activeRows = selectedAccessRows.filter(({ access }) => String(access.status || '').toUpperCase() !== 'INACTIVE');
    const sourceRows = activeRows.length > 0 ? activeRows : selectedAccessRows;
    const ids = sourceRows.flatMap(({ access }) => (
      Array.isArray(access.settings?.permissionProfileIds) ? access.settings.permissionProfileIds : []
    ));
    return Array.from(new Set(ids));
  }, [selectedAccessRows]);

  const setSelectedUserProfileIds = (profileIds: string[]) => {
    setConfig((prev) => ({
      ...prev,
      userAccess: prev.userAccess.map((access) => (
        access.userId === selectedAccessUserId
          ? { ...access, settings: { ...(access.settings || {}), permissionProfileIds: profileIds } }
          : access
      )),
    }));
  };

  const addUserAccess = () => {
    const defaultUser = selectedAccessUser || config.platformUsers[0];
    const userId = selectedAccessUserId || defaultUser?.userId || defaultUser?.username || '';
    const displayName = defaultUser
      ? `${defaultUser.firstName || ''} ${defaultUser.lastName || ''}`.trim() || defaultUser.username || userId
      : '';

    setConfig((prev) => ({
      ...prev,
      userAccess: [
        ...prev.userAccess,
        {
          userId,
          username: defaultUser?.username || '',
          displayName,
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: prev.locations[0]?.code || '',
          unitCode: '',
          moduleCode: '',
          role: 'Viewer',
          accessLevel: 'Read',
          status: 'ACTIVE',
          settings: { permissionProfileIds: selectedUserProfileIds },
        },
      ],
    }));
    if (userId) setSelectedAccessUserId(userId);
  };

  const updateResourcePoolSettings = (index: number, changes: Record<string, any>) => {
    const currentSettings = config.resourcePools[index]?.settings || {};
    updateRow('resourcePools', index, {
      settings: {
        ...currentSettings,
        applyToV2Runtime: true,
        ...changes,
      },
    });
  };

  const getLocalDateString = (offsetDays = 0): string => {
    const dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + offsetDays);
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getResourcePoolSaveKey = (pool: any, fallbackIndex: number): string => (
    String(pool?.id || pool?.code || `${pool?.locationCode || ''}:${pool?.unitCode || ''}:${pool?.aircraftTypeCode || ''}:${fallbackIndex}`).trim()
  );

  const normaliseDfpResourceRowsSnapshot = (settings: Record<string, any> = {}): DfpResourceRowsSnapshot => ({
    aircraft: Math.max(0, Math.floor(Number(settings.aircraft ?? 24) || 0)),
    ftd: Math.max(0, Math.floor(Number(settings.ftd ?? 5) || 0)),
    cpt: Math.max(0, Math.floor(Number(settings.cpt ?? 4) || 0)),
    standby: Math.max(0, Math.floor(Number(settings.standby ?? 4) || 0)),
    ground: Math.max(0, Math.floor(Number(settings.ground ?? 6) || 0)),
  });

  const sameDfpResourceRows = (left: DfpResourceRowsSnapshot, right: DfpResourceRowsSnapshot): boolean => (
    DFP_RESOURCE_ROW_KEYS.every((key) => left[key] === right[key])
  );

  const getDfpResourceRowsForDate = (pool: any, targetDate: string): DfpResourceRowsSnapshot => {
    const settings = pool?.settings || {};
    const history = Array.isArray(settings.dfpResourceRowsHistory) ? settings.dfpResourceRowsHistory : [];
    const matchingEntry = history.filter((entry: any) => {
      const effectiveFrom = String(entry?.effectiveFrom || '0000-01-01').slice(0, 10);
      const effectiveTo = String(entry?.effectiveTo || '9999-12-31').slice(0, 10);
      if (effectiveFrom === '0000-01-01' && effectiveTo !== '9999-12-31') {
        return targetDate === effectiveTo && entry?.rows && typeof entry.rows === 'object';
      }
      return targetDate >= effectiveFrom && targetDate <= effectiveTo && entry?.rows && typeof entry.rows === 'object';
    }).pop();
    return normaliseDfpResourceRowsSnapshot(matchingEntry?.rows || settings);
  };

  const buildDfpResourceRowsSettings = (
    settings: Record<string, any>,
    rows: DfpResourceRowsSnapshot,
  ): Record<string, any> => DFP_RESOURCE_ROW_KEYS.reduce((nextSettings, key) => ({
    ...nextSettings,
    [key]: rows[key],
  }), { ...settings });

  const normaliseDfpResourceRowsHistory = (settings: Record<string, any> = {}): any[] => (
    Array.isArray(settings.dfpResourceRowsHistory)
      ? settings.dfpResourceRowsHistory
      : []
  );

  const sameDfpResourceRowsHistory = (leftSettings: Record<string, any> = {}, rightSettings: Record<string, any> = {}): boolean => (
    JSON.stringify(normaliseDfpResourceRowsHistory(leftSettings)) === JSON.stringify(normaliseDfpResourceRowsHistory(rightSettings))
  );

  const getEditableDfpResourceRows = (pool: any): DfpResourceRowsSnapshot => (
    getDfpResourceRowsForDate(pool, getLocalDateString(1))
  );

  const clonePlatformConfigForResourceRowBaseline = (sourceConfig: PlatformConfig): PlatformConfig => (
    JSON.parse(JSON.stringify(sourceConfig))
  );

  const enterResourcePoolsEditMode = () => {
    resourcePoolEditBaselineRef.current = clonePlatformConfigForResourceRowBaseline(loadedConfigRef.current);
    setResourcePoolsUnlocked(true);
  };

  const buildResourceRowSavePlan = (
    candidateConfig: PlatformConfig = config,
    baselineConfig: PlatformConfig = resourcePoolEditBaselineRef.current || loadedConfigRef.current,
  ) => {
    const today = getLocalDateString();
    const tomorrow = getLocalDateString(1);
    const previousPoolsByKey = new Map(
      (baselineConfig.resourcePools || []).map((pool: any, index: number) => [getResourcePoolSaveKey(pool, index), pool])
    );
    const nextPoolsByKey = new Map(
      (candidateConfig.resourcePools || []).map((pool: any, index: number) => [getResourcePoolSaveKey(pool, index), pool])
    );
    const changedContexts: Array<{ locationCode: string; unitCode: string }> = [];

    const nextResourcePools = (candidateConfig.resourcePools || []).map((pool: any, index: number) => {
      const key = getResourcePoolSaveKey(pool, index);
      const previousPool = previousPoolsByKey.get(key);
      const previousRows = previousPool
        ? getDfpResourceRowsForDate(previousPool, tomorrow)
        : normaliseDfpResourceRowsSnapshot({});
      const todayRows = previousPool
        ? getDfpResourceRowsForDate(previousPool, today)
        : normaliseDfpResourceRowsSnapshot(pool.settings || {});
      const previousRawRows = previousPool
        ? normaliseDfpResourceRowsSnapshot((previousPool as any).settings || {})
        : normaliseDfpResourceRowsSnapshot({});
      const nextRows = normaliseDfpResourceRowsSnapshot(pool.settings || {});
      const rawRowsChanged = !previousPool || !sameDfpResourceRows(previousRawRows, nextRows);
      const historyChanged = previousPool
        ? !sameDfpResourceRowsHistory((previousPool as any).settings || {}, pool.settings || {})
        : false;
      const rowsChanged = rawRowsChanged || historyChanged;

      if (!rowsChanged) {
        return {
          ...pool,
          settings: {
            ...(pool.settings || {}),
            applyToV2Runtime: true,
          },
        };
      }

      changedContexts.push({
        locationCode: String(pool.locationCode || (previousPool as any)?.locationCode || '').trim(),
        unitCode: String(pool.unitCode || (previousPool as any)?.unitCode || '').trim(),
      });

      const existingHistory = Array.isArray(pool.settings?.dfpResourceRowsHistory)
        ? [...pool.settings.dfpResourceRowsHistory]
        : [];
      const retainedHistory = existingHistory.filter((entry: any) => {
        const effectiveFrom = String(entry?.effectiveFrom || '0000-01-01').slice(0, 10);
        return effectiveFrom < tomorrow;
      });
      const hasTodayHistory = retainedHistory.some((entry: any) => {
        const effectiveFrom = String(entry?.effectiveFrom || '0000-01-01').slice(0, 10);
        const effectiveTo = String(entry?.effectiveTo || '9999-12-31').slice(0, 10);
        return today >= effectiveFrom && today <= effectiveTo;
      });
      const nextHistory = previousPool && !hasTodayHistory
        ? [
          ...retainedHistory,
          {
            effectiveFrom: today,
            effectiveTo: today,
            rows: todayRows,
          },
          {
            effectiveFrom: tomorrow,
            rows: nextRows,
          },
        ]
        : [
          ...retainedHistory,
          {
            effectiveFrom: tomorrow,
            rows: nextRows,
          },
        ];

      return {
        ...pool,
        settings: {
          ...buildDfpResourceRowsSettings(pool.settings || {}, todayRows),
          applyToV2Runtime: true,
          dfpResourceRowsEffectiveFrom: tomorrow,
          dfpResourceRowsHistory: nextHistory,
        },
      };
    });

    (baselineConfig.resourcePools || []).forEach((pool: any, index: number) => {
      const key = getResourcePoolSaveKey(pool, index);
      if (nextPoolsByKey.has(key)) return;
      changedContexts.push({
        locationCode: String(pool.locationCode || '').trim(),
        unitCode: String(pool.unitCode || '').trim(),
      });
    });

    const uniqueContexts = changedContexts.filter((context, index, contexts) => (
      context.locationCode &&
      contexts.findIndex((candidate) => (
        candidate.locationCode.toUpperCase() === context.locationCode.toUpperCase() &&
        candidate.unitCode.toUpperCase() === context.unitCode.toUpperCase()
      )) === index
    ));

    return {
      configToSave: {
        ...candidateConfig,
        resourcePools: nextResourcePools,
      },
      changedContexts: uniqueContexts,
      today,
      tomorrow,
    };
  };

  const pruneFutureSnapshotCache = (startDate: string, locationCode: string, unitCode: string) => {
    try {
      const locationToken = String(locationCode || '').trim().toUpperCase();
      const unitToken = String(unitCode || '').trim().toUpperCase();
      Object.keys(localStorage)
        .filter((key) => key.startsWith('dfp_snapshot_cache_'))
        .forEach((key) => {
          const snapshotKey = key.replace(/^dfp_snapshot_cache_/, '');
          const snapshotDate = snapshotKey.slice(0, 10);
          const upperKey = snapshotKey.toUpperCase();
          if (snapshotDate < startDate) return;
          if (unitToken && upperKey.endsWith(`__${locationToken}__${unitToken}`)) {
            localStorage.removeItem(key);
          } else if (!unitToken && (upperKey.endsWith(`__${locationToken}`) || upperKey.includes(`__${locationToken}__`))) {
            localStorage.removeItem(key);
          }
        });
    } catch {
      // Cache cleanup is best effort. The database deletion is authoritative.
    }
  };

  const deleteFutureSnapshotsForResourceRowChanges = async (
    contexts: Array<{ locationCode: string; unitCode: string }>,
    startDate: string,
  ): Promise<number> => {
    if (contexts.length === 0 || isSetupTestMode()) return 0;
    const sessionToken = localStorage.getItem('dfp_session_token');
    let deletedCount = 0;

    for (const context of contexts) {
      pruneFutureSnapshotCache(startDate, context.locationCode, context.unitCode);
      try {
        const res = await fetch(`${getApiBase()}/daily-snapshot/future`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({
            startDate,
            school: context.locationCode,
            unit: context.unitCode,
          }),
        });
        if (!res.ok) continue;
        const body = await res.json().catch(() => ({}));
        deletedCount += Number(body.deleted || 0) || 0;
      } catch {
        // Do not fail the settings save because a cleanup call failed.
      }
    }

    return deletedCount;
  };

  const updateAircraftNumberPrefix = (poolIndex: number, prefixIndex: number, value: string) => {
    const settings = normaliseAircraftNumberSettings(config.resourcePools[poolIndex]?.settings || {});
    const prefixes = settings.prefixes.map((prefix, index) => (
      index === prefixIndex ? value.toUpperCase().trim() : prefix
    )).filter(Boolean);
    const uniquePrefixes = Array.from(new Set(prefixes));
    updateResourcePoolSettings(poolIndex, {
      aircraftNumberPrefixes: uniquePrefixes,
      aircraftNumberDefaultPrefix: uniquePrefixes.includes(settings.defaultPrefix)
        ? settings.defaultPrefix
        : uniquePrefixes[0] || '',
    });
  };

  const addAircraftNumberPrefix = (poolIndex: number) => {
    const settings = normaliseAircraftNumberSettings(config.resourcePools[poolIndex]?.settings || {});
    const nextPrefix = `PREFIX-${settings.prefixes.length + 1}`;
    updateResourcePoolSettings(poolIndex, {
      aircraftNumberPrefixes: [...settings.prefixes, nextPrefix],
      aircraftNumberDefaultPrefix: settings.defaultPrefix || nextPrefix,
    });
  };

  const removeAircraftNumberPrefix = (poolIndex: number, prefixIndex: number) => {
    const settings = normaliseAircraftNumberSettings(config.resourcePools[poolIndex]?.settings || {});
    const prefixes = settings.prefixes.filter((_, index) => index !== prefixIndex);
    updateResourcePoolSettings(poolIndex, {
      aircraftNumberPrefixes: prefixes,
      aircraftNumberDefaultPrefix: prefixes.includes(settings.defaultPrefix)
        ? settings.defaultPrefix
        : prefixes[0] || '',
    });
  };

  const updateAircraftConfiguration = (poolIndex: number, configIndex: number, definition: string) => {
    const aircraftConfigurations = normaliseAircraftConfigurationDefinitions(config.resourcePools[poolIndex]?.settings?.aircraftConfigurations || []);
    const targetId = aircraftConfigurations[configIndex]?.id;
    if (!targetId || targetId === 'CONFIG-0') return;
    const nextAircraftConfigurations = aircraftConfigurations.map((configDefinition) => (
      configDefinition.id === targetId ? { ...configDefinition, definition } : configDefinition
    ));
    updateResourcePoolSettings(poolIndex, { aircraftConfigurations: nextAircraftConfigurations });
  };

  const addAircraftConfiguration = (poolIndex: number) => {
    const aircraftConfigurations = normaliseAircraftConfigurationDefinitions(config.resourcePools[poolIndex]?.settings?.aircraftConfigurations || []);
    const existingIds = new Set(aircraftConfigurations.map(configDefinition => configDefinition.id));
    let nextNumber = 1;
    while (existingIds.has(`CONFIG-${nextNumber}`)) nextNumber += 1;
    updateResourcePoolSettings(poolIndex, {
      aircraftConfigurations: [
        ...aircraftConfigurations,
        { id: `CONFIG-${nextNumber}`, label: `CONFIG ${nextNumber}`, definition: '' },
      ],
    });
  };

  const removeAircraftConfiguration = (poolIndex: number, configIndex: number) => {
    const aircraftConfigurations = normaliseAircraftConfigurationDefinitions(config.resourcePools[poolIndex]?.settings?.aircraftConfigurations || []);
    const targetId = aircraftConfigurations[configIndex]?.id;
    if (!targetId || targetId === 'CONFIG-0') return;
    const nextAircraftConfigurations = aircraftConfigurations.filter((configDefinition) => configDefinition.id !== targetId);
    updateResourcePoolSettings(poolIndex, { aircraftConfigurations: nextAircraftConfigurations });
  };

  const deleteSelectedResourcePool = async () => {
    if (!canEditResourcePools) return;
    if (!selectedResourcePoolDeleteOption) {
      await showDarkAlert('Select a resource pool to delete.', 'Delete Resource Pool', 'warning');
      return;
    }

    const confirmed = await showDarkConfirm(
      `Delete resource pool "${selectedResourcePoolDeleteOption.name}"?\n\nThis removes it from Aircraft & Resource Pools. Press Save in this section to apply the deletion.`,
      'Delete Resource Pool?',
      'warning',
    );
    if (!confirmed) return;

    const password = await showDarkPrompt({
      title: 'Confirm Resource Pool Deletion',
      message: `Enter your password to delete "${selectedResourcePoolDeleteOption.name}".`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The resource pool was not deleted.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The resource pool was not deleted.', 'Password Check Failed', 'error');
      return;
    }

    setConfig((prev) => ({
      ...prev,
      resourcePools: prev.resourcePools.filter((pool, index) => (
        String(pool.id || pool.code || `resource-pool-${index}`) !== selectedResourcePoolDeleteOption.key
      )),
    }));
    setSelectedResourcePoolDeleteKey('');
    onShowSuccess(`Resource pool "${selectedResourcePoolDeleteOption.name}" removed. Press Save to apply the deletion.`);
  };

  const save = async (
    configOverride?: PlatformConfig,
    restoreSection?: string,
    options?: { reloadPage?: boolean; successMessage?: string; skipResourceRowProtection?: boolean },
  ) => {
    const candidateConfig = configOverride && Array.isArray(configOverride.locations)
      ? configOverride
      : config;
    const rowSavePlan = options?.skipResourceRowProtection
      ? null
      : buildResourceRowSavePlan(candidateConfig);
    const hasRowChanges = (rowSavePlan?.changedContexts.length || 0) > 0;
    const rowSaveTomorrowDisplay = rowSavePlan ? formatDateLabel(rowSavePlan.tomorrow) : '';
    try {
      localStorage.setItem('dfp_resource_rows_last_save_attempt_trace', JSON.stringify({
        savedAt: new Date().toISOString(),
        protectionVersion: 'CCH 3.257',
        restoreSection: restoreSection || null,
        canEdit,
        skippedResourceRowProtection: !!options?.skipResourceRowProtection,
        detectedResourceRowChanges: hasRowChanges,
        today: rowSavePlan?.today || null,
        tomorrow: rowSavePlan?.tomorrow || null,
        changedContexts: rowSavePlan?.changedContexts || [],
        currentPoolRows: (candidateConfig.resourcePools || []).map((pool: any) => ({
          id: pool?.id || null,
          code: pool?.code || null,
          name: pool?.name || null,
          locationCode: pool?.locationCode || null,
          unitCode: pool?.unitCode || null,
          rawRowsInSettings: normaliseDfpResourceRowsSnapshot(pool?.settings || {}),
          historyCount: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory.length : 0,
          history: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory : [],
        })),
        plannedPoolRows: (rowSavePlan?.configToSave.resourcePools || []).map((pool: any) => ({
          id: pool?.id || null,
          code: pool?.code || null,
          name: pool?.name || null,
          locationCode: pool?.locationCode || null,
          unitCode: pool?.unitCode || null,
          rawRowsPlannedForSave: normaliseDfpResourceRowsSnapshot(pool?.settings || {}),
          historyCount: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory.length : 0,
          history: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory : [],
        })),
      }));
    } catch {
      // Diagnostics are helpful but should never block a settings save.
    }
    if (hasRowChanges && rowSavePlan) {
      const confirmed = await showDarkConfirm(
        [
          'DFP Resource Rows have changed.',
          '',
          `The current day is not affected. The new row layout applies from ${rowSaveTomorrowDisplay} forward.`,
          '',
          'Past days keep the resource rows they had on that day.',
          '',
          'Any future built or published schedules for the affected location/unit will be deleted because their row layout may no longer match the new DFP resource rows.',
          '',
          'Continue and save these row changes?',
        ].join('\n'),
        'DFP Resource Rows Changed',
        'warning',
      );
      if (!confirmed) return false;
    }
    const configToSave = buildSeparationReadyConfig(normaliseSettingsPlatformConfig(
      rowSavePlan?.configToSave || candidateConfig
    ));
    if (hasRowChanges && rowSavePlan) {
      try {
        localStorage.setItem('dfp_resource_rows_last_save_trace', JSON.stringify({
          savedAt: new Date().toISOString(),
          protectionVersion: 'CCH 3.257',
          today: rowSavePlan.today,
          tomorrow: rowSavePlan.tomorrow,
          changedContexts: rowSavePlan.changedContexts,
          poolSummaries: (rowSavePlan.configToSave.resourcePools || [])
            .filter((pool: any) => {
              const poolLocation = String(pool?.locationCode || '').trim().toUpperCase();
              const poolUnit = String(pool?.unitCode || '').trim().toUpperCase();
              return rowSavePlan.changedContexts.some(context => (
                String(context.locationCode || '').trim().toUpperCase() === poolLocation &&
                String(context.unitCode || '').trim().toUpperCase() === poolUnit
              ));
            })
            .map((pool: any) => ({
              id: pool?.id || null,
              code: pool?.code || null,
              name: pool?.name || null,
              locationCode: pool?.locationCode || null,
              unitCode: pool?.unitCode || null,
              currentDayRowsKeptInSettings: normaliseDfpResourceRowsSnapshot(pool?.settings || {}),
              historyCount: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory.length : 0,
              history: Array.isArray(pool?.settings?.dfpResourceRowsHistory) ? pool.settings.dfpResourceRowsHistory : [],
            })),
        }));
      } catch {
        // Diagnostics are helpful but should never block a settings save.
      }
    }
    const reloadPage = options?.reloadPage ?? false;
    if (!canEdit) return false;
    const saveBlocker = getPlatformConfigSaveBlocker(configToSave);
    if (saveBlocker) {
      setError(saveBlocker);
      return false;
    }
    const solarValidationError = configToSave.locations.map(validateSolarLocation).find(Boolean);
    if (solarValidationError) {
      setError(solarValidationError);
      return false;
    }
    setSaving(true);
    setError('');
    let shouldReload = false;
    try {
      if (isSetupTestMode()) {
        writeSetupTestPlatformConfig(configToSave);
        loadedConfigRef.current = configToSave;
        setConfig(configToSave);
        onShowSuccess(
          hasRowChanges && rowSavePlan
            ? `DFP resource rows saved. Current day and past days are unchanged. New rows apply from ${rowSaveTomorrowDisplay}.`
            : options?.successMessage || 'Platform configuration saved.'
        );
        return true;
      }
      const sessionToken = localStorage.getItem('dfp_session_token');
      const res = await fetch(`${getApiBase()}/platform-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(configToSave),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Save failed (${res.status})`);
      }
      const previousLocationMap = new Map(
        loadedConfigRef.current.locations.map((location) => [getPlatformLocationAuditKey(location), location])
      );
      const nextLocationMap = new Map(
        configToSave.locations.map((location) => [getPlatformLocationAuditKey(location), location])
      );
      configToSave.locations.forEach((location) => {
        const key = getPlatformLocationAuditKey(location);
        if (!key || previousLocationMap.has(key)) return;
        logAudit({
          page: 'Settings - Platform Locations',
          action: 'Add',
          description: `Added location ${getPlatformLocationAuditLabel(location)}`,
          changes: `IATA: ${location.iataCode || 'blank'}; latitude: ${location.latitude ?? 'blank'}; longitude: ${location.longitude ?? 'blank'}; timezone: ${location.timezone || 'blank'}`,
        });
      });
      loadedConfigRef.current.locations.forEach((location) => {
        const key = getPlatformLocationAuditKey(location);
        if (!key || nextLocationMap.has(key)) return;
        logAudit({
          page: 'Settings - Platform Locations',
          action: 'Delete',
          description: `Removed location ${getPlatformLocationAuditLabel(location)}`,
          changes: `Remaining locations: ${configToSave.locations.map(getPlatformLocationAuditLabel).join(', ') || 'none'}`,
        });
      });
      loadedConfigRef.current = configToSave;
      notifyPlatformConfigUpdated(configToSave);
      if (hasRowChanges && rowSavePlan) {
        const deletedCount = await deleteFutureSnapshotsForResourceRowChanges(rowSavePlan.changedContexts, rowSavePlan.tomorrow);
        window.dispatchEvent(new CustomEvent('dfpFutureSchedulesCleared', {
          detail: {
            startDate: rowSavePlan.tomorrow,
            contexts: rowSavePlan.changedContexts,
          },
        }));
        onShowSuccess(
          `DFP resource rows saved. Current day and past days are unchanged. Future schedules from ${rowSaveTomorrowDisplay} were cleared for affected units${deletedCount ? ` (${deletedCount} snapshot${deletedCount === 1 ? '' : 's'} deleted)` : ''}.`
        );
      }
      if (!reloadPage) {
        await reloadPlatformConfig();
        if (!hasRowChanges) onShowSuccess(options?.successMessage || 'Platform configuration saved.');
        return true;
      }
      shouldReload = true;
      setApplyingChanges(true);
      onShowSuccess('Platform configuration saved. Applying changes...');
      try {
        const settingsScrollContainer = document.querySelector('[data-settings-content-scroll="true"]') as HTMLElement | null;
        const restoreScrollTop = settingsScrollContainer?.scrollTop ?? window.scrollY ?? 0;
        sessionStorage.setItem('dfp_restore_view_after_reload', 'Settings');
        sessionStorage.setItem('dfp_restore_settings_section_after_reload', restoreSection || scrollTarget || 'platform-configuration-health');
        sessionStorage.setItem('dfp_restore_settings_scroll_top_after_reload', String(Math.max(0, Math.round(restoreScrollTop))));
      } catch {
        // Non-critical: the configuration still saves if session storage is unavailable.
      }
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform configuration');
      return false;
    } finally {
      if (!shouldReload) setSaving(false);
    }
  };

  const saveResourcePoolsAndExitEdit = async () => {
    const saved = await save(undefined, 'platform-resource-pools');
    if (saved) {
      setNewAircraftTypeVisibleIds(new Set());
      setResourcePoolsUnlocked(false);
      resourcePoolEditBaselineRef.current = null;
    }
  };

  const saveCrewCompositionAndExitEdit = async () => {
    const saved = await save(undefined, 'platform-crew-composition');
    if (saved) setCrewCompositionUnlocked(false);
  };

  const saveTaskProfilesAndExitEdit = async () => {
    const taskProfilesFromDrafts = OPERATIONAL_MODEL_OPTIONS.reduce((profiles, option) => ({
      ...profiles,
      [option.value]: parseTaskProfileText(taskProfileDrafts[option.value] || ''),
    }), {} as Record<string, string[]>);
    const nextConfigWithProfiles = buildConfigWithPrimaryOrganisationSettings(config, (settings) => ({
      ...settings,
      taskProfiles: taskProfilesFromDrafts,
    }));
    const nextConfig = {
      ...nextConfigWithProfiles,
      units: nextConfigWithProfiles.units.map((unit, unitIndex) => ({
        ...unit,
        settings: {
          ...(unit.settings || {}),
          taskProfileAbbreviations: parseTaskProfileAbbreviationText(
            taskProfileAbbreviationDrafts[getTaskProfileUnitDraftKey(unit, unitIndex)] || '',
          ),
        },
      })),
    };
    const saved = await save(nextConfig, 'platform-task-profiles');
    if (saved) {
      setTaskProfilesUnlocked(false);
      setTaskProfileDrafts({});
      setTaskProfileAbbreviationDrafts({});
    }
  };

  const saveCurrencyProfilesAndExitEdit = async () => {
    const saved = await save(undefined, 'platform-currency-profiles');
    if (saved) setCrewCompositionUnlocked(false);
  };

  const isSectionEditActive = (sectionId: string): boolean => (
    !sectionOnly || sectionEditUnlocked[sectionId] === true
  );
  const canEditSection = (sectionId: string): boolean => canEdit && isSectionEditActive(sectionId);
  const saveSectionAndExitEdit = async (sectionId: string) => {
    const saved = await save(undefined, sectionId);
    if (saved) {
      setSectionEditUnlocked((prev) => ({ ...prev, [sectionId]: false }));
    }
  };
  const renderSectionEditSaveButton = (sectionId: string) => {
    if (!canEdit) return null;
    const isEditing = isSectionEditActive(sectionId);
    return (
      <button
        type="button"
        onClick={() => {
          if (isEditing) {
            void saveSectionAndExitEdit(sectionId);
            return;
          }
          setSectionEditUnlocked((prev) => ({ ...prev, [sectionId]: true }));
        }}
        disabled={isEditing && (saving || applyingChanges)}
        className={platformActionButtonClass}
      >
        {isEditing ? 'Save' : 'Edit'}
      </button>
    );
  };

  const updateStandardMissionProfiles = (profiles: StandardMissionProfile[]) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      standardMissionProfiles: { profiles: normaliseStandardMissionProfiles({ profiles }) },
    }));
  };

  const addStandardMissionProfile = () => {
    const missionIndex = standardMissionProfiles.length + 1;
    const firstRole = crewCompositionRoleOptions[0] || 'Crew';
    const aircraftTypeCode = activeMissionAircraftTypeCode || activeCrewCompositionAircraftCode || String(config.aircraftTypes[0]?.code || 'AIRCRAFT').trim().toUpperCase();
    const crewOptions = getStandardMissionCrewOptions(aircraftTypeCode);
    const selectedCrewCompositionId = crewOptions.find((option) => option.mode === 'STANDARD')?.id || crewOptions[0]?.id || '';
    const baseId = createClientRecordId('standard-mission');
    const targetUnitCodes = getActiveScopedUnitCodes();
    const combinedContext = targetUnitCodes.length > 1;
    const createProfileForUnit = (unitCode: string): StandardMissionProfile => ({
      id: combinedContext ? `${baseId}-${unitCode.toLowerCase()}` : baseId,
      status: 'ACTIVE',
      unitCode,
      compositeUnitCode: combinedContext ? activeStandardMissionUnitCode : '',
      compositeProfileId: combinedContext ? baseId : '',
      aircraftTypeCode,
      missionName: `Flight Profile ${missionIndex}`,
      shortTitle: `TASK${missionIndex}`.slice(0, 8),
      description: '',
      resourceType: 'Flight',
      departureLocationCode: activeHomeLocationCode,
      arrivalLocationCode: activeHomeLocationCode,
      durationMinutes: 240,
      preFlightMinutes: 90,
      postFlightMinutes: 60,
      isFormation: false,
      formationAircraft: 2,
      config: getAircraftConfigOptions(aircraftTypeCode)[0] || 'ANY',
      crewCompositionMode: selectedCrewCompositionId.startsWith('alternate:') ? 'ALTERNATE' : 'STANDARD',
      selectedCrewCompositionId,
      acceptableCrewCompositionIds: selectedCrewCompositionId ? [selectedCrewCompositionId] : [],
      roleRequirements: [{ role: firstRole, count: 1 }],
      defaultCallsignPrefix: defaultMissionCallsign,
    });
    updateStandardMissionProfiles([
      ...standardMissionProfiles,
      ...targetUnitCodes.map(createProfileForUnit),
    ]);
  };

  const updateStandardMissionProfile = (profileId: string, changes: Partial<StandardMissionProfile>) => {
    const targetProfile = standardMissionProfiles.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateStandardMissionProfiles(standardMissionProfiles.map((profile) => (
      profile.id === profileId || (compositeProfileId && profile.compositeProfileId === compositeProfileId)
        ? {
            ...profile,
            ...changes,
            unitCode: profile.unitCode,
            compositeUnitCode: profile.compositeUnitCode,
            compositeProfileId: profile.compositeProfileId,
          }
        : profile
    )));
  };

  const removeStandardMissionProfile = (profileId: string) => {
    const targetProfile = standardMissionProfiles.find((profile) => profile.id === profileId);
    const compositeProfileId = targetProfile?.compositeProfileId || '';
    updateStandardMissionProfiles(standardMissionProfiles.filter((profile) => (
      profile.id !== profileId && (!compositeProfileId || profile.compositeProfileId !== compositeProfileId)
    )));
  };

  const updateStandardMissionCrewSelection = (profile: StandardMissionProfile, optionId: string, selected: boolean) => {
    if (!selected) return;
    updateStandardMissionProfile(profile.id, {
      crewCompositionMode: optionId.startsWith('alternate:') ? 'ALTERNATE' : 'STANDARD',
      selectedCrewCompositionId: optionId,
      acceptableCrewCompositionIds: [optionId],
    });
  };

  const updateStandardMissionCrewMode = (profile: StandardMissionProfile, mode: 'STANDARD' | 'ALTERNATE' | 'CUSTOM') => {
    const aircraftTypeCode = profile.aircraftTypeCode || getUnitAircraftTypeCode(profile.unitCode || activePrimaryUnitCode);
    const crewOptions = getStandardMissionCrewOptions(aircraftTypeCode);
    const selectedCrewCompositionId = mode === 'CUSTOM'
      ? ''
      : crewOptions.find((option) => option.mode === mode)?.id || '';
    updateStandardMissionProfile(profile.id, {
      crewCompositionMode: mode,
      selectedCrewCompositionId,
      acceptableCrewCompositionIds: selectedCrewCompositionId ? [selectedCrewCompositionId] : [],
    });
  };

  const addStandardMissionRoleRequirement = (profile: StandardMissionProfile) => {
    const usedRoles = new Set(profile.roleRequirements.map((requirement) => requirement.role.toUpperCase()));
    const nextRole = crewCompositionRoleOptions.find((role) => !usedRoles.has(role.toUpperCase())) || crewCompositionRoleOptions[0] || 'Crew';
    updateStandardMissionProfile(profile.id, {
      roleRequirements: [...profile.roleRequirements, { role: nextRole, count: 1 }],
    });
  };

  const updateStandardMissionRoleRequirement = (
    profile: StandardMissionProfile,
    roleIndex: number,
    changes: Partial<StandardMissionRoleRequirement>,
  ) => {
    updateStandardMissionProfile(profile.id, {
      roleRequirements: profile.roleRequirements.map((requirement, index) => (
        index === roleIndex
          ? {
              ...requirement,
              ...changes,
              count: changes.count !== undefined ? clampWholeNumber(changes.count, requirement.count, 1, 24) : requirement.count,
            }
          : requirement
      )),
    });
  };

  const removeStandardMissionRoleRequirement = (profile: StandardMissionProfile, roleIndex: number) => {
    updateStandardMissionProfile(profile.id, {
      roleRequirements: profile.roleRequirements.filter((_, index) => index !== roleIndex),
    });
  };

  const exitResourcePoolsEditMode = async () => {
    if (!resourcePoolsDirty) {
      setResourcePoolsUnlocked(false);
      resourcePoolEditBaselineRef.current = null;
      return;
    }
    if (resourcePoolExitPromptOpenRef.current) return;
    resourcePoolExitPromptOpenRef.current = true;
    const shouldSave = await showDarkConfirm(
      'You have unsaved Aircraft & Resource Pools changes.\n\nSelect OK to save and apply the changes now. Select Cancel to continue without saving and exit Aircraft & Resource Pools edit mode.',
      'Unsaved Resource Pool Changes',
      'warning',
    );
    resourcePoolExitPromptOpenRef.current = false;
    if (shouldSave) {
      await saveResourcePoolsAndExitEdit();
      return;
    }
    setConfig(prev => ({
      ...prev,
      aircraftTypes: loadedConfigRef.current.aircraftTypes,
      resourcePools: loadedConfigRef.current.resourcePools,
    }));
    setNewAircraftTypeVisibleIds(new Set());
    setResourcePoolsUnlocked(false);
    resourcePoolEditBaselineRef.current = null;
  };

  useEffect(() => {
    if (!resourcePoolsUnlocked || !resourcePoolsDirty) return;
    const handleOutsideResourcePoolClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('#platform-resource-pools')) return;
      if (target.closest('.fixed.inset-0')) return;
      if (target.closest('button')) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      void exitResourcePoolsEditMode();
    };
    document.addEventListener('click', handleOutsideResourcePoolClick, true);
    return () => document.removeEventListener('click', handleOutsideResourcePoolClick, true);
  }, [config.aircraftTypes, config.resourcePools, resourcePoolsDirty, resourcePoolsUnlocked]);

  const refreshLicenseStatus = async () => {
    const res = await fetch(`${getApiBase()}/platform-license/status`);
    if (!res.ok) throw new Error(`Licence status failed (${res.status})`);
    const data = await res.json();
    setLicenseStatus(data);
    return data;
  };

  const reloadPlatformConfig = async () => {
    if (isSetupTestMode()) {
      const nextConfig = normaliseSettingsPlatformConfig(readSetupTestPlatformConfig());
      setConfig(nextConfig);
      loadedConfigRef.current = nextConfig;
      notifyPlatformConfigUpdated(nextConfig);
      return;
    }
    const res = await fetch(`${getApiBase()}/platform-config`);
    if (!res.ok) throw new Error(`Configuration reload failed (${res.status})`);
    const data = await res.json();
    const nextConfig = normaliseSettingsPlatformConfig(data);
    setConfig(nextConfig);
    loadedConfigRef.current = nextConfig;
    notifyPlatformConfigUpdated(nextConfig);
  };

  const verifySignedLicense = async () => {
    if (!licenseImportText.trim()) {
      setLicenseImportError('Paste a signed licence file before verifying.');
      return;
    }
    setLicenseActionLoading(true);
    setLicenseImportMessage('');
    setLicenseImportError('');
    try {
      const res = await fetch(`${getApiBase()}/platform-license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedLicenseFile: licenseImportText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.detail || body?.error || `Verify failed (${res.status})`);
      setLicenseImportMessage(`Verified: ${body.payload?.license?.licenseName || body.payload?.license?.licenseKey || 'signed licence'} is valid for ${body.deploymentFingerprint}.`);
    } catch (err: any) {
      setLicenseImportError(err?.message || 'Signed licence verification failed.');
    } finally {
      setLicenseActionLoading(false);
    }
  };

  const updateLicenseImportDraft = (value: string) => {
    setLicenseImportText(value);
    setLicenseImportMessage('');
    setLicenseImportError('');
  };

  const importSignedLicense = async () => {
    if (!canEdit) return;
    if (!licenseImportText.trim()) {
      setLicenseImportError('Paste a signed licence file before importing.');
      return;
    }
    setLicenseActionLoading(true);
    setLicenseImportMessage('');
    setLicenseImportError('');
    try {
      const sessionToken = localStorage.getItem('dfp_session_token');
      const res = await fetch(`${getApiBase()}/platform-license/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ signedLicenseFile: licenseImportText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || `Import failed (${res.status})`);
      await Promise.all([reloadPlatformConfig(), refreshLicenseStatus()]);
      setLicenseImportText('');
      setLicenseImportMessage(`Imported signed licence ${body.licenseKey}.`);
      onShowSuccess('Signed licence imported.');
    } catch (err: any) {
      setLicenseImportError(err?.message || 'Signed licence import failed.');
    } finally {
      setLicenseActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-gray-300">
        Loading platform configuration...
      </div>
    );
  }

  const visibleSectionTarget = sectionOnly ? (scrollTarget || 'platform-configuration-health') : null;
  const getSectionClass = (sectionId: string) => {
    const visibleWithLegacyTarget = visibleSectionTarget === 'platform-organisation-locations'
      && (sectionId === 'platform-organisation' || sectionId === 'platform-locations');
    return `${sectionClass}${visibleSectionTarget && visibleSectionTarget !== sectionId && !visibleWithLegacyTarget ? ' hidden' : ''}`;
  };
  const resourceSectionPanelClass = 'rounded-lg border border-gray-700 bg-gray-950/55 p-3';
  const resourceSectionPanelHeaderClass = 'mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2';
  const resourceSectionPanelTitleClass = 'text-xs font-black uppercase tracking-wide text-gray-300';
  const resourceSectionPanelHintClass = 'text-[11px] leading-relaxed text-gray-500';
  const getSettingsFocusAnchor = (value: any) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  const crewCompositionRoleOptions = getCrewPositionOptions(crewPositionTerminology);
  const activeCrewCompositionAircraftIndex = Math.max(
    0,
    crewCompositionAircraftTypes.findIndex((aircraft) => String(aircraft.code || '').trim().toUpperCase() === crewCompositionAircraftCode.trim().toUpperCase()),
  );
  const activeCrewCompositionAircraft = crewCompositionAircraftTypes[activeCrewCompositionAircraftIndex] || crewCompositionAircraftTypes[0];
  const activeCrewCompositionAircraftCode = String(activeCrewCompositionAircraft?.code || '').trim().toUpperCase();
  const activeCrewComposition = normaliseAircraftCrewComposition(activeCrewCompositionAircraft?.crewComposition);
  const activeCrewRoleKeys = new Set(
    activeCrewComposition.seats.flatMap((seat) => getAircraftSeatEligibleRoles(seat)).map((role) => role.toUpperCase()),
  );
  const activeCrewPositionEntries = crewPositionTerminology.positions.filter((entry) => (
    activeCrewRoleKeys.has(entry.genericName.toUpperCase())
  ));
  const visibleCrewPositionEntries = activeCrewPositionEntries.length > 0
    ? activeCrewPositionEntries
    : crewPositionTerminology.positions;
  const normaliseUnitCode = (value: unknown) => String(value || '').trim().toUpperCase();
  const parseUnitContextCodes = (value: unknown): string[] => (
    String(value || '')
      .split(/[+/]/)
      .map(normaliseUnitCode)
      .filter(Boolean)
  );
  const activeContextUnitCodes = (
    Array.isArray(activeUnitCodes) && activeUnitCodes.length > 0
      ? activeUnitCodes.map(normaliseUnitCode).filter(Boolean)
      : [
          ...parseUnitContextCodes(activeCompositeUnitCode),
          ...parseUnitContextCodes(activeUnitCode),
        ]
  ).filter((value, index, values) => values.indexOf(value) === index);
  const getActiveScopedUnitCodes = () => activeContextUnitCodes.length > 0 ? activeContextUnitCodes : [activePrimaryUnitCode].filter(Boolean);
  const activePrimaryUnitCode = activeContextUnitCodes[0] || String(config.units.find(isActiveRecord)?.code || config.units[0]?.code || '').trim().toUpperCase();
  const activeStandardMissionUnitCode = activeContextUnitCodes.length > 1
    ? activeContextUnitCodes.join('+')
    : String(activeCompositeUnitCode || activeUnitCode || activePrimaryUnitCode).trim().toUpperCase() || activePrimaryUnitCode;
  const activeStandardMissionUnitLabel = activeContextUnitCodes.length > 1
    ? activeContextUnitCodes.join('/')
    : activeStandardMissionUnitCode;
  const isProfileInActiveUnitContext = (profile: { unitCode?: string; compositeUnitCode?: string }) => {
    const profileUnitCode = normaliseUnitCode(profile.unitCode);
    const profileCompositeUnitCode = normaliseUnitCode(profile.compositeUnitCode);
    if (activeContextUnitCodes.length > 1) {
      return !profileUnitCode
        || profileCompositeUnitCode === activeStandardMissionUnitCode
        || activeContextUnitCodes.includes(profileUnitCode)
        || profileUnitCode === activeStandardMissionUnitCode;
    }
    return !profileUnitCode || profileUnitCode === activePrimaryUnitCode;
  };
  const uniqueProfilesByCompositeGroup = <T extends { id: string; compositeProfileId?: string }>(profiles: T[]): T[] => {
    const seen = new Set<string>();
    return profiles.filter((profile) => {
      const key = profile.compositeProfileId || profile.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const getVisibleAlternateCrewCompositions = () => uniqueProfilesByCompositeGroup(
    crewCompositionSettings.alternateCompositions.filter((profile) => (
      String(profile.aircraftTypeCode || '').trim().toUpperCase() === activeCrewCompositionAircraftCode
      && isProfileInActiveUnitContext(profile)
    )),
  );
  const activeAircraftAlternateCompositions = getVisibleAlternateCrewCompositions();
  const activeCurrencyProfiles = getVisibleCurrencyProfiles();
  const activePlatformUnit = config.units.find((unit) => String(unit.code || '').trim().toUpperCase() === activePrimaryUnitCode)
    || config.units.find(isActiveRecord)
    || config.units[0]
    || null;
  const getUnitParentOrganisationPath = (unit: any): string[] => (
    Array.isArray(unit?.settings?.parentOrganisationPath)
      ? unit.settings.parentOrganisationPath
      : String(unit?.settings?.parentOrganisationPath || unit?.settings?.parentOrganisation || '')
        .split('-')
    ).map((part: unknown) => String(part || '').trim()).filter(Boolean);
  const getUnitParentOrganisationCode = (unit: any): string => {
    const path = getUnitParentOrganisationPath(unit);
    return String(path[path.length - 1] || '').trim();
  };
  const getUnitAircraftTypeCode = (unitCode: string): string => {
    const normalisedUnitCode = String(unitCode || '').trim().toUpperCase();
    const unit = config.units.find((row) => String(row.code || '').trim().toUpperCase() === normalisedUnitCode) || null;
    const unitSettingAircraft = String(unit?.settings?.aircraftTypeCode || unit?.settings?.aircraftType || '').trim().toUpperCase();
    const unitPoolAircraft = String(getLocationResourcePool(
      config,
      unit?.locationCode || activePlatformUnit?.locationCode || config.locations[0]?.code || '',
      normalisedUnitCode,
    )?.aircraftTypeCode || '').trim().toUpperCase();
    return unitPoolAircraft || unitSettingAircraft || activeCrewCompositionAircraftCode || String(config.aircraftTypes[0]?.code || '').trim().toUpperCase();
  };
  const getUnitOwnedAircraftTypeCode = (unit: any): string => {
    const unitCode = String(unit?.code || '').trim().toUpperCase();
    const unitSettingAircraft = String(unit?.settings?.aircraftTypeCode || unit?.settings?.aircraftType || '').trim().toUpperCase();
    const unitOwnedPoolAircraft = String(config.resourcePools.find((pool) => (
      isActiveRecord(pool)
      && String(pool.unitCode || '').trim().toUpperCase() === unitCode
      && String(pool.aircraftTypeCode || '').trim()
    ))?.aircraftTypeCode || '').trim().toUpperCase();
    return unitSettingAircraft || unitOwnedPoolAircraft;
  };
  const activeHomeLocationCode = String(activePlatformUnit?.locationCode || config.locations[0]?.code || '').trim().toUpperCase();
  const activeMissionAircraftTypeCode = getUnitAircraftTypeCode(activePrimaryUnitCode);
  const trainingReportPreviewAircraftTypeCode = getUnitOwnedAircraftTypeCode(activeTrainingReportUnit) || activeMissionAircraftTypeCode;
  const activeUnitAircraftTypeCodes = Array.from(new Set(
    getActiveScopedUnitCodes()
      .map((unitCode) => getUnitAircraftTypeCode(unitCode))
      .map((aircraftCode) => String(aircraftCode || '').trim().toUpperCase())
      .filter(Boolean),
  ));
  const activeSettingsVisibilityUnitCodes = getActiveScopedUnitCodes();
  const activeSettingsVisibilityLocationCode = String(activePlatformUnit?.locationCode || activeHomeLocationCode || '').trim().toUpperCase();
  const activeSettingsVisibilityAircraftTypes = activeUnitAircraftTypeCodes.length > 0
    ? activeUnitAircraftTypeCodes
    : [activeMissionAircraftTypeCode].filter(Boolean);
  const activeSettingsVisibilityParentOrgCode = getUnitParentOrganisationCode(activePlatformUnit);
  const settingsVisibilityEnabled = settingsVisibilityPolicy.enabled && settingsVisibilityPolicy.filters.length > 0;
  const visibilityUnitSet = new Set(activeSettingsVisibilityUnitCodes.map(normaliseUnitCode).filter(Boolean));
  const visibilityAircraftTypeSet = new Set(activeSettingsVisibilityAircraftTypes.map(normaliseUnitCode).filter(Boolean));
  const visibilityLocationCode = normaliseUnitCode(activeSettingsVisibilityLocationCode);
  const visibilityParentOrganisationCode = normaliseUnitCode(activeSettingsVisibilityParentOrgCode);
  const getVisibilityRecordUnit = (unitCode?: unknown) => {
    const code = normaliseUnitCode(unitCode);
    return code ? config.units.find((unit) => normaliseUnitCode(unit.code) === code) || null : null;
  };
  const getVisibilityRecordContext = (record: {
    unitCode?: unknown;
    locationCode?: unknown;
    aircraftTypeCode?: unknown;
    organisationCode?: unknown;
    parentOrganisationCode?: unknown;
  }) => {
    const recordUnit = getVisibilityRecordUnit(record.unitCode);
    return {
      unitCode: normaliseUnitCode(record.unitCode),
      locationCode: normaliseUnitCode(record.locationCode || recordUnit?.locationCode),
      aircraftTypeCode: normaliseUnitCode(record.aircraftTypeCode || (recordUnit ? getUnitAircraftTypeCode(String(recordUnit.code || '')) : '')),
      organisationCode: normaliseUnitCode(record.organisationCode || recordUnit?.organisationCode),
      parentOrganisationCode: normaliseUnitCode(record.parentOrganisationCode || (recordUnit ? getUnitParentOrganisationCode(recordUnit) : '')),
    };
  };
  const isRecordVisibleForSettingsPolicy = (record: {
    unitCode?: unknown;
    locationCode?: unknown;
    aircraftTypeCode?: unknown;
    organisationCode?: unknown;
    parentOrganisationCode?: unknown;
  }) => {
    if (!settingsVisibilityEnabled) return true;
    const context = getVisibilityRecordContext(record);
    return settingsVisibilityPolicy.filters.every((filter) => {
      if (filter === 'unit') {
        if (!context.unitCode || visibilityUnitSet.size === 0) return true;
        return visibilityUnitSet.has(context.unitCode);
      }
      if (filter === 'location') {
        if (!context.locationCode || !visibilityLocationCode) return true;
        return context.locationCode === visibilityLocationCode;
      }
      if (filter === 'aircraftType') {
        if (!context.aircraftTypeCode || visibilityAircraftTypeSet.size === 0) return true;
        return visibilityAircraftTypeSet.has(context.aircraftTypeCode);
      }
      if (filter === 'parentOrganisation') {
        if (!context.parentOrganisationCode || !visibilityParentOrganisationCode) return true;
        return context.parentOrganisationCode === visibilityParentOrganisationCode;
      }
      return true;
    });
  };
  const visibleLocationRows = config.locations
    .map((location, index) => ({ location, index }))
    .filter(({ location }) => isRecordVisibleForSettingsPolicy({
      locationCode: location.code,
      organisationCode: location.organisationCode,
    }));
  const visibleUnitRows = config.units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit, index }) => {
      if (index === editingUnitIndex) return true;
      return isRecordVisibleForSettingsPolicy({
        unitCode: unit.code,
        locationCode: unit.locationCode,
        aircraftTypeCode: getUnitAircraftTypeCode(String(unit.code || '')),
        organisationCode: unit.organisationCode,
        parentOrganisationCode: getUnitParentOrganisationCode(unit),
      });
    });
  const visibleResourcePoolRows = config.resourcePools
    .map((pool, index) => ({ pool, index }))
    .filter(({ pool }) => isRecordVisibleForSettingsPolicy({
      unitCode: pool.unitCode,
      locationCode: pool.locationCode,
      aircraftTypeCode: pool.aircraftTypeCode,
      organisationCode: pool.organisationCode,
    }))
    .filter(({ pool }) => {
      if (!settingsVisibilityEnabled || !settingsVisibilityPolicy.filters.includes('unit') || visibilityUnitSet.size === 0) {
        return true;
      }
      const poolUnitCode = normaliseUnitCode(pool.unitCode);
      const poolAircraftTypeCode = normaliseUnitCode(pool.aircraftTypeCode);
      return (poolUnitCode && visibilityUnitSet.has(poolUnitCode))
        || (!poolUnitCode && (!poolAircraftTypeCode || visibilityAircraftTypeSet.has(poolAircraftTypeCode)));
    });
  const visibleAircraftTypeCodes = new Set<string>([
    ...(settingsVisibilityPolicy.filters.includes('unit') ? activeUnitAircraftTypeCodes : []),
    ...(!settingsVisibilityPolicy.filters.includes('unit') ? visibleUnitRows.map(({ unit }) => getUnitAircraftTypeCode(String(unit.code || ''))) : []),
    ...(!settingsVisibilityPolicy.filters.includes('unit') ? visibleResourcePoolRows.map(({ pool }) => String(pool.aircraftTypeCode || '').trim().toUpperCase()) : []),
  ].map(normaliseUnitCode).filter(Boolean));
  const visibleAircraftTypeRows = config.aircraftTypes
    .map((aircraft, index) => ({ aircraft, index }))
    .filter(({ aircraft }) => {
      if (newAircraftTypeVisibleIds.has(String(aircraft.id || ''))) return true;
      if (!settingsVisibilityEnabled) return true;
      const aircraftCode = normaliseUnitCode(aircraft.code);
      if (!aircraftCode) return true;
      if (settingsVisibilityPolicy.filters.includes('aircraftType') && visibilityAircraftTypeSet.size > 0) {
        return visibilityAircraftTypeSet.has(aircraftCode);
      }
      if (
        settingsVisibilityPolicy.filters.includes('unit')
        || settingsVisibilityPolicy.filters.includes('location')
        || settingsVisibilityPolicy.filters.includes('parentOrganisation')
      ) {
        return visibleAircraftTypeCodes.size === 0 || visibleAircraftTypeCodes.has(aircraftCode);
      }
      return true;
    });
  const visibleAircraftTypeOptions = visibleAircraftTypeRows.map(({ aircraft }) => aircraft.code).filter(Boolean);
  const getAircraftTypeDisplayLabel = (aircraftTypeCode: unknown): string => {
    const normalisedAircraftCode = normaliseUnitCode(aircraftTypeCode);
    const aircraftType = config.aircraftTypes.find((aircraft) => normaliseUnitCode(aircraft.code) === normalisedAircraftCode);
    return String(aircraftType?.name || aircraftType?.code || normalisedAircraftCode || 'Aircraft').trim();
  };
  const visibleLocationOptions = visibleLocationRows.map(({ location }) => location.code).filter(Boolean);
  const visibleUnitOptions = visibleUnitRows.map(({ unit }) => unit.code).filter(Boolean);
  const visibleOperationalModelValues = new Set(
    visibleUnitRows
      .map(({ unit }) => getUnitOperationalModel(unit))
      .map((model) => String(model || '').trim())
      .filter(Boolean),
  );
  const visibleOperationalModelOptions = settingsVisibilityEnabled && visibleOperationalModelValues.size > 0
    ? OPERATIONAL_MODEL_OPTIONS.filter((option) => visibleOperationalModelValues.has(option.value))
    : OPERATIONAL_MODEL_OPTIONS;
  const callsignAssignableRoleOptions = (() => {
    const visibleModelSet = new Set(visibleOperationalModelOptions.map((option) => option.value));
    const visibleCrewPositions = crewPositionTerminology.positions.filter((entry) => (
      visibleModelSet.size === 0
      || visibleOperationalModelOptions.length === OPERATIONAL_MODEL_OPTIONS.length
      || Array.from(visibleModelSet).some((model) => isCrewPositionAvailableForOperationalModel(entry, model))
    ));
    const roleOptions = [
      { value: 'SIM IP', label: personnelDisplaySettings.simIpDisplayLabel || 'Contractor Staff' },
      ...visibleCrewPositions.map((entry) => ({
        value: entry.genericName,
        label: crewPositionLabelMap[entry.genericName] || entry.label || entry.genericName,
      })),
      { value: 'CATEGORY:A', label: 'Category A' },
      { value: 'CATEGORY:B', label: 'Category B' },
      { value: 'CATEGORY:C', label: 'Category C' },
      { value: 'CATEGORY:D', label: 'Category D' },
      { value: 'CATEGORY:UNCAT', label: 'Uncategorised' },
    ];
    const byValue = new Map<string, { value: string; label: string }>();
    roleOptions.forEach((option) => {
      const value = String(option.value || '').trim();
      const key = value.toUpperCase();
      if (!key || byValue.has(key)) return;
      byValue.set(key, { value, label: option.label || value });
    });
    return Array.from(byValue.values()).sort((left, right) => (
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    ));
  })();
  const visibleCrewCompositionAircraftTypes = settingsVisibilityEnabled
    ? crewCompositionAircraftTypes.filter((aircraft) => {
      const code = normaliseUnitCode(aircraft.code);
      return !code || visibleAircraftTypeRows.some(({ aircraft: visibleAircraft }) => normaliseUnitCode(visibleAircraft.code) === code);
    })
    : crewCompositionAircraftTypes;
  const displayCrewCompositionAircraft = (
    settingsVisibilityEnabled
      ? visibleCrewCompositionAircraftTypes.find((aircraft) => normaliseUnitCode(aircraft.code) === activeCrewCompositionAircraftCode)
        || visibleCrewCompositionAircraftTypes[0]
      : activeCrewCompositionAircraft
  ) || activeCrewCompositionAircraft;
  const displayCrewCompositionAircraftCode = normaliseUnitCode(displayCrewCompositionAircraft?.code);
  const displayCrewCompositionAircraftIndex = Math.max(
    0,
    crewCompositionAircraftTypes.findIndex((aircraft) => normaliseUnitCode(aircraft.code) === displayCrewCompositionAircraftCode),
  );
  const displayCrewComposition = normaliseAircraftCrewComposition(displayCrewCompositionAircraft?.crewComposition);
  const displayAircraftAlternateCompositions = uniqueProfilesByCompositeGroup(
    crewCompositionSettings.alternateCompositions.filter((profile) => (
      normaliseUnitCode(profile.aircraftTypeCode) === displayCrewCompositionAircraftCode
      && isProfileInActiveUnitContext(profile)
    )),
  );
  const displayCurrencyProfiles = uniqueProfilesByCompositeGroup(
    crewCompositionSettings.currencyProfiles.filter((profile) => (
      (!profile.aircraftTypeCode || normaliseUnitCode(profile.aircraftTypeCode) === displayCrewCompositionAircraftCode)
      && isProfileInActiveUnitContext(profile)
    )),
  );
  const displayCrewRoleKeys = new Set(
    displayCrewComposition.seats.flatMap((seat) => getAircraftSeatEligibleRoles(seat)).map((role) => role.toUpperCase()),
  );
  const displayCrewPositionEntries = crewPositionTerminology.positions.filter((entry) => (
    displayCrewRoleKeys.has(entry.genericName.toUpperCase())
  ));
  const visibleDisplayCrewPositionEntries = displayCrewPositionEntries.length > 0
    ? displayCrewPositionEntries
    : crewPositionTerminology.positions;
  const visibleUnitCallsignEntries = unitCallsignSettings.entries.filter((entry) => isRecordVisibleForSettingsPolicy({
    unitCode: entry.unitCode,
  }));
  const visibleUserAccessRows = config.userAccess
    .map((access, index) => ({ access, index }))
    .filter(({ access }) => isRecordVisibleForSettingsPolicy({
      unitCode: access.unitCode,
      locationCode: access.locationCode,
      organisationCode: access.organisationCode,
    }));
  const visibleSelectedAccessRows = visibleUserAccessRows.filter(({ access }) => (
    String(access.userId || '').trim() === selectedAccessUserId
  ));
  const visibleResourcePoolDeleteOptions = visibleResourcePoolRows.map(({ pool, index }) => {
    const key = String(pool.id || pool.code || `resource-pool-${index}`);
    const name = String(pool.name || '').trim() || 'Unnamed Resource Pool';
    return { key, name };
  });
  const activeResourcePoolDeleteOptions = settingsVisibilityEnabled
    ? visibleResourcePoolDeleteOptions
    : resourcePoolDeleteOptions;
  const visibleMasterLmpAccessRuleRows = masterLmpAccessRules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => isRecordVisibleForSettingsPolicy({
      unitCode: rule.unitCode,
      locationCode: rule.locationCode,
      aircraftTypeCode: rule.aircraftTypeCode,
      organisationCode: rule.parentOrganisationCode || rule.organisationCode,
      parentOrganisationCode: rule.parentOrganisationCode,
    }));
  const activeSettingsVisibilityModels = new Set(
    visibleUnitRows
      .map(({ unit }) => getUnitOperationalModel(unit))
      .map((model) => String(model || '').trim())
      .filter(Boolean),
  );
  const isMasterLmpRuleSpecificToActiveContext = (rule: PlatformMasterLmpAccessRule) => {
    const ruleUnitCode = normaliseUnitCode(rule.unitCode);
    const ruleLocationCode = normaliseUnitCode(rule.locationCode);
    const ruleAircraftTypeCode = normaliseUnitCode(rule.aircraftTypeCode);
    const ruleParentOrganisationCode = normaliseUnitCode(rule.parentOrganisationCode);
    const ruleModel = rule.operationalModel ? normaliseOperationalModel(rule.operationalModel) : '';
    return Boolean(
      (ruleUnitCode && visibilityUnitSet.has(ruleUnitCode))
      || (ruleLocationCode && visibilityLocationCode && ruleLocationCode === visibilityLocationCode)
      || (ruleAircraftTypeCode && visibilityAircraftTypeSet.has(ruleAircraftTypeCode))
      || (ruleParentOrganisationCode && visibilityParentOrganisationCode && ruleParentOrganisationCode === visibilityParentOrganisationCode)
      || (ruleModel && activeSettingsVisibilityModels.has(ruleModel)),
    );
  };
  const isMasterLmpCatalogueEntryVisibleForActiveContext = (entry: PlatformMasterLmpCatalogueEntry) => {
    if (!settingsVisibilityEnabled) return true;
    if (String(entry.status || 'ACTIVE').toUpperCase() === 'INACTIVE') return false;
    const entryCode = normaliseUnitCode(entry.code);
    if (!entryCode) return false;
    return masterLmpAccessRules.some((rule) => (
      String(rule.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
      && normaliseUnitCode(rule.lmpCode) === entryCode
      && isMasterLmpRuleSpecificToActiveContext(rule)
    ));
  };
  const visibleMasterLmpCatalogueRows = masterLmpCatalogue
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isMasterLmpCatalogueEntryVisibleForActiveContext(entry));
  const visibleSchedulingRuleSetRows = config.schedulingRuleSets
    .map((ruleSet, index) => ({ ruleSet, index }))
    .filter(({ ruleSet }) => isRecordVisibleForSettingsPolicy({
      unitCode: ruleSet.unitCode,
      locationCode: ruleSet.locationCode,
      aircraftTypeCode: ruleSet.aircraftTypeCode,
      organisationCode: ruleSet.organisationCode,
    }));
  const fixedCrewContext = isFixedCrewLikeOperationalModel(activeOperationalModel || activePlatformUnit?.operationalModel);
  const standardMissionProfiles = normaliseStandardMissionProfiles(primaryOrganisationSettings.standardMissionProfiles || null);
  const standardMissionProfilesForContext = uniqueProfilesByCompositeGroup(
    standardMissionProfiles.filter(isProfileInActiveUnitContext),
  );
  const defaultMissionCallsign = getDefaultUnitCallsign(unitCallsignSettings, activePrimaryUnitCode);
  const trainingReportPreviewCallsign = getDefaultUnitCallsign(
    unitCallsignSettings,
    activeTrainingReportUnit?.code || activeTrainingReportUnitCode,
  ) || 'Callsign';
  const trainingReportPreviewUnitCode = String(activeTrainingReportUnit?.code || activeTrainingReportUnitCode || 'Unit').trim();
  const getStandardMissionCrewOptions = (aircraftTypeCode: string): Array<{ id: string; label: string; mode: 'STANDARD' | 'ALTERNATE' }> => {
    const aircraftCode = String(aircraftTypeCode || activeMissionAircraftTypeCode || activeCrewCompositionAircraftCode || 'AIRCRAFT').trim().toUpperCase();
    const alternateCompositions = uniqueProfilesByCompositeGroup(
      crewCompositionSettings.alternateCompositions.filter((profile) => (
        String(profile.aircraftTypeCode || '').trim().toUpperCase() === aircraftCode
        && isProfileInActiveUnitContext(profile)
      )),
    );
    return [
      { id: `standard:${aircraftCode || 'AIRCRAFT'}`, label: `Standard ${aircraftCode || 'Aircraft'} Crew`, mode: 'STANDARD' },
      ...alternateCompositions.map((profile) => ({
        id: `alternate:${profile.id}`,
        label: profile.name || profile.code,
        mode: 'ALTERNATE' as const,
      })),
    ];
  };
  const getAircraftConfigOptions = (aircraftTypeCode: string): string[] => Array.from(new Set([
    'ANY',
    ...config.resourcePools
      .filter((pool) => !aircraftTypeCode || String(pool.aircraftTypeCode || '').trim().toUpperCase() === String(aircraftTypeCode || '').trim().toUpperCase())
      .flatMap((pool) => Array.isArray(pool.settings?.aircraftConfigurations) ? pool.settings.aircraftConfigurations : [])
      .map((item: any) => String(item.label || item.definition || item.id || '').trim())
      .filter(Boolean),
  ]));
  const currencyProfileCrewOptions = Array.from(new Set([
    ...activeUnitAircraftTypeCodes.map((aircraftCode) => {
      return `Standard ${aircraftCode || 'Aircraft'} Crew`;
    }),
    ...uniqueProfilesByCompositeGroup(
      crewCompositionSettings.alternateCompositions.filter((profile) => (
        isProfileInActiveUnitContext(profile)
        && activeUnitAircraftTypeCodes.includes(String(profile.aircraftTypeCode || '').trim().toUpperCase())
      )),
    ).map((profile) => {
      const aircraftCode = String(profile.aircraftTypeCode || '').trim().toUpperCase();
      const profileName = String(profile.name || profile.code || '').trim();
      return aircraftCode ? `${profileName} - ${aircraftCode}` : profileName;
    }),
  ].map((option) => String(option || '').trim()).filter(Boolean)));
  const activeCurrencyDefinitionNames = Array.from(new Set([
    ...getActiveScopedUnitCodes().flatMap((unitCode) => {
      const definitions = unitCurrencyDefinitions[String(unitCode || '').trim().toUpperCase()];
      return [
        ...(definitions?.masterCurrencies || []),
        ...(definitions?.currencyRequirements || []),
      ].map((currency) => String(currency.name || '').trim()).filter(Boolean);
    }),
    ...masterCurrencies.map((currency) => String(currency.name || '').trim()).filter(Boolean),
    ...currencyRequirements.map((currency) => String(currency.name || '').trim()).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));
  const formatCrewRoleLabel = (role: string) => crewPositionLabelMap[role] || role || 'Crew';
  const getStandardCrewSummary = (composition: AircraftCrewComposition): string[] => (
    composition.seats.map((seat) => formatCrewRoleLabel(seat.role))
  );
  const getAlternateCrewSummary = (profile: AlternateCrewCompositionProfile): string[] => (
    profile.roleRequirements.flatMap((requirement) => (
      Array.from({ length: Math.max(1, Math.round(Number(requirement.count) || 1)) }, () => formatCrewRoleLabel(requirement.role))
    ))
  );
  const organisationParentLevels = organisationStructure.levels
    .slice(1)
    .map((level, index) => ({
      levelIndex: index + 1,
      name: level.name || `Level ${index + 1}`,
      options: level.options.map((option) => String(option || '').trim()).filter(Boolean),
    }))
    .filter((level) => level.options.length > 0);
  const updateUnitParentOrganisationPath = (unitIndex: number, unit: any, levelIndex: number, selectedValue: string) => {
    const currentPath = getUnitParentOrganisationPath(unit);
    const nextPath = currentPath.slice(0, levelIndex);
    if (selectedValue) nextPath[levelIndex] = selectedValue;
    const cleanPath = nextPath.map((part) => String(part || '').trim()).filter(Boolean);
    updateRow('units', unitIndex, {
      settings: {
        ...(unit.settings || {}),
        parentOrganisationPath: cleanPath,
        parentOrganisation: cleanPath.join('-'),
      },
    });
  };
  const clearUnitParentOrganisationPath = (unitIndex: number, unit: any) => {
    updateRow('units', unitIndex, {
      settings: {
        ...(unit.settings || {}),
        parentOrganisationPath: [],
        parentOrganisation: '',
      },
    });
    setOpenParentOrgUnitIndex(null);
    setParentOrgMenuPlacement({ direction: 'down', maxHeight: 340 });
  };
  const getFilteredParentOrganisationOptions = (level: { options: string[]; levelIndex: number }, parentOrganisationPath: string[], parentLevelIndex: number): string[] => {
    if (parentLevelIndex === 0) return level.options;
    const rootedPathMatches = (path: string[]) => parentOrganisationPath
      .slice(0, parentLevelIndex)
      .every((selectedParent, pathIndex) => normaliseOrganisationParentKey(path[pathIndex + 1]) === normaliseOrganisationParentKey(selectedParent));
    const rootlessPathMatches = (path: string[]) => parentOrganisationPath
      .slice(0, parentLevelIndex)
      .every((selectedParent, pathIndex) => normaliseOrganisationParentKey(path[pathIndex]) === normaliseOrganisationParentKey(selectedParent));
    const pathFilteredOptions = (organisationStructure.relationshipPaths || [])
      .filter((path) => path.length > parentLevelIndex && (rootedPathMatches(path) || rootlessPathMatches(path)))
      .map((path) => getOrganisationPathValueForLevel(path, level.levelIndex))
      .filter(Boolean);
    if ((organisationStructure.relationshipPaths || []).length > 0) {
      return Array.from(new Set(pathFilteredOptions));
    }
    const previousParent = parentOrganisationPath[parentLevelIndex - 1] || '';
    const sourceLevel = organisationStructure.levels[level.levelIndex];
    const childMap = sourceLevel?.childrenByParent || {};
    const childMapKeys = Object.keys(childMap);
    if (childMapKeys.length === 0) return level.options;
    const exactChildren = previousParent ? childMap[previousParent] : [];
    if (exactChildren?.length) return exactChildren;
    const normalisedPreviousParent = normaliseOrganisationParentKey(previousParent);
    const matchedKey = childMap[normalisedPreviousParent]?.length
      ? normalisedPreviousParent
      : childMapKeys.find((key) => normaliseOrganisationParentKey(key) === normalisedPreviousParent);
    return matchedKey ? childMap[matchedKey] || [] : [];
  };

  const showSectionOnlyStatusPanel = !canEdit || Boolean(error);
  const handleSettingsKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [data-rank-equivalency-input="true"]')) return;
    stopEditableKeyPropagation(event);
  };

  return (
    <div className="relative space-y-8" onKeyDownCapture={handleSettingsKeyDownCapture}>
      {applyingChanges && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
          <div className="rounded-xl border border-cyan-400/40 bg-gray-900 px-6 py-5 text-center shadow-2xl">
            <div className="text-lg font-bold text-cyan-100">One moment while we apply your changes</div>
            <p className="mt-2 text-sm text-gray-300">The updated platform settings are being applied across the running app.</p>
          </div>
        </div>
      )}
      {sectionOnly && showSectionOnlyStatusPanel ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-3">
          {!canEdit && (
            <div className="mt-3 rounded border border-yellow-600/50 bg-yellow-900/30 px-3 py-2 text-sm text-yellow-100">
              Read-only. Super Admin or Admin permission is required to change platform configuration.
            </div>
          )}
          {error && (
            <div className="mt-3 rounded border border-red-600/50 bg-red-900/30 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>
      ) : !sectionOnly && (!canEdit || Boolean(error)) ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-3">
          {!canEdit && (
            <div className="mt-3 rounded border border-yellow-600/50 bg-yellow-900/30 px-3 py-2 text-sm text-yellow-100">
              Read-only. Super Admin or Admin permission is required to change platform configuration.
            </div>
          )}
          {error && (
            <div className="mt-3 rounded border border-red-600/50 bg-red-900/30 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>
      ) : null}

      <section id="platform-configuration-health" className={getSectionClass('platform-configuration-health')}>
        <SectionHeader
          title="Configuration Health"
          subtitle="Review setup gaps and missing records before operational use, deployment, or accreditation review."
          action={(
            <button
              type="button"
              onClick={exportConfigurationHealthReport}
              className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-[10px] font-bold text-gray-900 shadow hover:bg-gray-200"
            >
              Export Configuration Report
            </button>
          )}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <HealthMetric label="Critical" value={configurationHealthSummary.CRITICAL} severity="CRITICAL" />
            <HealthMetric label="Warnings" value={configurationHealthSummary.WARNING} severity="WARNING" />
            <HealthMetric label="OK" value={configurationHealthSummary.OK} severity="OK" />
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h5 className="text-sm font-bold text-white">Commercial Configuration Assurance</h5>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  This is a management view for administrators. Critical items should be fixed before operational use; warnings are setup gaps or records that should be reviewed before deployment or accreditation evidence export.
                </p>
              </div>
              <span className="ml-auto rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-100">
                Advisory only
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {configurationHealth.map((item) => {
              const tone = getConfigurationHealthTone(item.severity);
              return (
                <div key={item.id} className={`rounded-lg border p-3 ${tone.rowClass}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`rounded border px-2 py-1 text-xs font-bold ${tone.badgeClass}`}>
                      {item.severity === 'OK' ? 'OK' : item.severity === 'WARNING' ? 'Warning' : 'Critical'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.area}</div>
                      <div className="mt-1 text-sm font-bold text-white">{item.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-gray-300">{item.detail}</p>
                      {item.remediation && (
                        <p className="mt-2 rounded border border-gray-600 bg-gray-950/60 px-3 py-2 text-sm leading-relaxed text-gray-200">
                          <span className="font-bold text-cyan-100">Fix: </span>
                          {item.remediation}
                        </p>
                      )}
                      {item.settingsSection && onNavigateToSettingsSection && (
                        <button
                          type="button"
                          onClick={() => onNavigateToSettingsSection({
                            section: item.settingsSection!,
                            label: item.settingsSectionLabel || 'settings page',
                            focusUnitCode: item.focusUnitCode,
                            focusLocationCode: item.focusLocationCode,
                            focusResourcePoolCode: item.focusResourcePoolCode,
                            focusAircraftTypeCode: item.focusAircraftTypeCode,
                            focusUserId: item.focusUserId,
                            focusSubsectionId: item.focusSubsectionId,
                          })}
                          className="mt-2 text-sm font-bold text-cyan-200 underline decoration-cyan-300/60 underline-offset-4 hover:text-cyan-100"
                        >
                          Open {item.settingsSectionLabel || 'settings page'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platform-organisation" className={getSectionClass('platform-organisation')}>
        <SectionHeader
          title="Organisation"
          subtitle="The top-level customer or operating organisation for this deployment."
          action={canEdit ? (
            <div className="flex items-center gap-[1px]">
              <button
                type="button"
                onClick={() => {
                  if (organisationStructureUnlocked) {
                    void saveOrganisationStructure();
                    return;
                  }
                  startOrganisationStructureEdit();
                }}
                disabled={organisationStructureUnlocked && (saving || applyingChanges)}
                className={platformActionButtonClass}
              >
                {organisationStructureUnlocked ? 'Save' : 'Edit'}
              </button>
            </div>
          ) : null}
        />
        <div className="space-y-4 p-4">
          {config.organisations.map((org, index) => ({ org, index })).filter(({ org }) => isActiveRecord(org)).map(({ org, index }) => (
            <div key={org.id || `platform-organisation-${index}`} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <DraftField label="Organisation Code" value={org.code} disabled={!canEdit || !organisationStructureUnlocked} onCommit={(value) => updateRow('organisations', index, { code: value })} />
              <DraftField label="Organisation Name" value={org.name} disabled={!canEdit || !organisationStructureUnlocked} onCommit={(value) => updateRow('organisations', index, { name: value })} />
              <SelectField label="Status" value={org.status || 'ACTIVE'} disabled={!canEdit || !organisationStructureUnlocked} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('organisations', index, { status: value })} />
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => void deleteOrganisation(index)}
                  disabled={!canEdit || !organisationStructureUnlocked || saving || applyingChanges}
                  className={`${platformActionButtonClass} text-red-700`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <div className="overflow-hidden rounded-lg border border-cyan-500/25 bg-gray-950/50">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 bg-cyan-500/10 px-4 py-3">
              <div>
                <h5 className="text-sm font-bold text-white">Organisation Structure</h5>
                <p className="mt-1 text-xs text-gray-400">{organisationStructure.levelCount} levels · {organisationStructure.levels.reduce((sum, level) => sum + level.options.length, 0)} options</p>
              </div>
              <div className="flex flex-wrap items-center gap-[1px]">
                <button
                  type="button"
                  className={platformActionButtonClass}
                  onClick={downloadOrganisationStructureTemplate}
                >
                  <span className="leading-tight">Download<br />Template</span>
                </button>
                <button
                  type="button"
                  className={platformActionButtonClass}
                  disabled={!canEdit || !organisationStructureUnlocked}
                  onClick={() => organisationStructureFileInputRef.current?.click()}
                >
                  <span className="leading-tight">Bulk<br />Import</span>
                </button>
                <input
                  ref={organisationStructureFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => void handleOrganisationStructureFile(event.target.files?.[0])}
                />
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr]">
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                <NumberField
                  label="No. of Levels"
                  value={organisationStructure.levelCount}
                  disabled={!canEdit || !organisationStructureUnlocked}
                  onChange={updateOrganisationStructureLevelCount}
                />
                <div
                  className={`mt-3 rounded border border-dashed px-3 py-5 text-center text-xs transition-colors ${
                    organisationStructureUnlocked
                      ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-100'
                      : 'border-gray-700 bg-gray-950 text-gray-500'
                  }`}
                  onDragOver={(event) => {
                    if (!organisationStructureUnlocked) return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!organisationStructureUnlocked) return;
                    event.preventDefault();
                    void handleOrganisationStructureFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  Drop Excel template here
                </div>
                {organisationStructureImportError ? (
                  <p className="mt-3 rounded border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">{organisationStructureImportError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                {organisationStructure.levels.map((level, levelIndex) => (
                  <div key={level.id || `org-structure-level-${levelIndex}`} className="grid gap-3 rounded-lg border border-gray-700 bg-gray-900 p-3 md:grid-cols-[72px_220px_1fr]">
                    <div className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-center">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100/60">Level</div>
                      <div className="mt-1 text-lg font-black text-white">{levelIndex}</div>
                    </div>
                    <DraftField
                      label="Level Name"
                      value={level.name}
                      disabled={!canEdit || !organisationStructureUnlocked}
                      onCommit={(value) => updateOrganisationStructureLevel(levelIndex, { name: value })}
                    />
                    {organisationStructureUnlocked ? (
                      <DraftTextAreaField
                        label={`Options (${level.options.length})`}
                        value={level.options.join('\n')}
                        disabled={!canEdit}
                        onCommit={(value) => updateOrganisationStructureLevel(levelIndex, { options: value.split(/\r?\n/) })}
                        className="min-w-0"
                        fieldSizingClassName="min-h-[76px]"
                      />
                    ) : (
                      <label className="min-w-0">
                        <FieldLabel label={`Options (${level.options.length})`} />
                        <div className="max-w-full overflow-x-auto rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300">
                          {level.options.length > 0 ? (
                            <div className="flex min-w-max items-center gap-2 pb-1">
                              {level.options.map((option) => (
                                <span key={option} className="max-w-[220px] shrink-0 truncate rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs font-semibold text-gray-200" title={option}>{option}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">No options defined</span>
                          )}
                        </div>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform-locations" className={getSectionClass('platform-locations')}>
        <SectionHeader
          title="Locations"
          subtitle="Bases, airfields, timezone data and local training areas used by units and scheduling."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-locations')}
              <button type="button" onClick={addLocation} disabled={!canEditSection('platform-locations')} className={platformActionButtonClass}>
                <span className="text-[9px] leading-tight">Add<br />Location</span>
              </button>
            </div>
          ) : null}
        />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-100/80">
            Offline airfield catalogue:{' '}
            {airfieldCatalogueStatus === 'loaded'
              ? `${airfieldCatalogue.length.toLocaleString()} local entries available for code or name lookup.`
              : airfieldCatalogueStatus === 'loading'
                ? 'loading local catalogue...'
                : airfieldCatalogueStatus === 'error'
                  ? `local catalogue unavailable (${airfieldCatalogueError}). Manual latitude, longitude and timezone entry still works.`
                  : 'preparing lookup.'}
          </div>
          {visibleLocationRows.map(({ location, index }) => {
            const rowKey = location.id || `platform-location-${index}`;
            return (
              <div
                key={rowKey}
                ref={(node) => { locationRowRefs.current[rowKey] = node; }}
                className="relative grid gap-3 rounded-lg border-2 bg-gray-900/95 p-3 pr-11 md:grid-cols-12"
                style={{
                  borderColor: platformLocationRowTone.border,
                  boxShadow: `inset 4px 0 0 ${platformLocationRowTone.accent}, 0 12px 24px rgba(0,0,0,0.22)`,
                }}
              >
                {canEditSection('platform-locations') ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded border border-gray-600/70 bg-gray-950/60 text-xs font-bold text-gray-400 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-100"
                    onClick={() => removeLocation(index)}
                    aria-label={`Remove ${getPlatformLocationAuditLabel(location)}`}
                    title={`Remove ${getPlatformLocationAuditLabel(location)}`}
                  >
                    X
                  </button>
                ) : null}
                <div className="md:col-span-2">
                  <AirfieldLookupField
                    label="ICAO Code"
                    value={location.code}
                    disabled={!canEditSection('platform-locations')}
                    maxLength={4}
                    getSuggestions={(query) => getAirfieldCatalogueSuggestionsForQuery(query, airfieldCatalogueLookup)}
                    onChange={(value) => updateLocationIdentity(index, 'code', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-2">
                  <AirfieldLookupField
                    label="IATA Code"
                    value={location.iataCode || ''}
                    disabled={!canEditSection('platform-locations')}
                    maxLength={3}
                    getSuggestions={(query) => getAirfieldCatalogueSuggestionsForQuery(query, airfieldCatalogueLookup)}
                    onChange={(value) => updateLocationIdentity(index, 'iataCode', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-4">
                  <AirfieldLookupField
                    label="Location Name"
                    value={location.name}
                    disabled={!canEditSection('platform-locations')}
                    getSuggestions={(query) => getAirfieldCatalogueSuggestionsForQuery(query, airfieldCatalogueLookup)}
                    onChange={(value) => updateLocationIdentity(index, 'name', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-2">
                  <NumberField label="UTC Offset" value={location.timezoneOffset ?? 10} disabled={!canEditSection('platform-locations')} onChange={(value) => updateRow('locations', index, { timezoneOffset: value })} />
                </div>
                <div className="md:col-span-2">
                  <SelectField label="Status" value={location.status || 'ACTIVE'} disabled={!canEditSection('platform-locations')} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('locations', index, { status: value })} />
                </div>
                <div className="md:col-span-2">
                  <OptionalNumberField label="Latitude" value={toNullableNumber(location.latitude)} disabled={!canEditSection('platform-locations')} onChange={(value) => updateRow('locations', index, { latitude: value })} info="Decimal degrees. South is negative." />
                </div>
                <div className="md:col-span-2">
                  <OptionalNumberField label="Longitude" value={toNullableNumber(location.longitude)} disabled={!canEditSection('platform-locations')} onChange={(value) => updateRow('locations', index, { longitude: value })} info="Decimal degrees. West is negative." />
                </div>
                <div className="md:col-span-3">
                  <TimeZoneField label="IANA Timezone" value={location.timezone || ''} disabled={!canEditSection('platform-locations')} onChange={(value) => updateRow('locations', index, { timezone: value })} info="Use an IANA timezone so daylight saving is handled offline, for example Australia/Melbourne." />
                </div>
                <div className="md:col-span-5">
                  <CommaListField
                    label="Training Areas"
                    value={location.trainingAreas || []}
                    disabled={!canEditSection('platform-locations')}
                    onChange={(trainingAreas) => updateRow('locations', index, { trainingAreas })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="platform-units" className={getSectionClass('platform-units')}>
        <SectionHeader
          title="Units"
          subtitle="Manage each unit's operating model, type, home location and enabled modules. Select a unit row first, then press Edit to change it."
          action={canEdit ? (
            <div className="flex items-center gap-[1px]">
              <button
                type="button"
                onClick={() => {
                  if (editingUnitIndex !== null) {
                    void save(undefined, 'platform-units').then((saved) => {
                      if (saved) setEditingUnitIndex(null);
                    });
                    return;
                  }
                  editSelectedUnit();
                }}
                disabled={config.units.length === 0 || (editingUnitIndex !== null && (saving || applyingChanges))}
                className={platformActionButtonClass}
              >
                {editingUnitIndex !== null ? 'Save' : 'Edit'}
              </button>
              <button type="button" onClick={deleteSelectedUnit} disabled={config.units.length === 0} className={platformActionButtonClass}>Delete</button>
              <button type="button" onClick={addUnit} className={platformActionButtonClass}>
                <span className="leading-tight">Add<br />Unit</span>
              </button>
            </div>
          ) : null}
        />
        <div className="p-4">
          <div className="mb-4 rounded-lg border border-cyan-500/25 bg-cyan-950/15 p-3">
            <TextAreaField
              label="Unit Types"
              value={isEditingUnitTypes ? unitTypesDraft : unitTypeOptions.join('\n')}
              disabled={!canEdit}
              onChange={setUnitTypesDraft}
              onFocus={() => {
                setUnitTypesDraft(unitTypeOptions.join('\n'));
                setIsEditingUnitTypes(true);
              }}
              onBlur={commitUnitTypesDraft}
              info="One unit type per line. These options appear in the Unit Type dropdown below and are saved in platform configuration."
              className="block"
              fieldClassName="w-[300px] max-w-full"
              fieldSizingClassName="min-h-[104px]"
            />
          </div>
          <div className="max-w-full overflow-x-auto pb-2">
            <div className="min-w-[1180px] space-y-3">
              {visibleUnitRows.map(({ unit, index }) => {
                const unitSettings = unit.settings || {};
                const isSelectedUnit = selectedUnitIndex === index;
                const isUnitEditing = canEdit && editingUnitIndex === index;
                const rowKey = unit.id || `platform-unit-${index}`;
                const parentOrganisationPath = getUnitParentOrganisationPath(unit);
                const parentOrganisationDisplay = parentOrganisationPath[parentOrganisationPath.length - 1] || '';
                return (
                  <div
                    key={rowKey}
                    ref={(node) => { unitRowRefs.current[rowKey] = node; }}
                    onClick={() => setSelectedUnitIndex(index)}
                    className={`relative grid cursor-pointer grid-cols-[minmax(78px,0.65fr)_minmax(150px,1.2fr)_minmax(138px,1.14fr)_minmax(100px,0.7fr)_minmax(130px,0.95fr)_minmax(105px,0.7fr)_minmax(190px,1.45fr)] gap-3 rounded border-2 p-3 transition-colors ${
                      isSelectedUnit
                        ? 'border-cyan-300 bg-cyan-500/10 shadow-[0_0_0_3px_rgba(34,211,238,0.28),0_0_22px_rgba(34,211,238,0.16)] ring-1 ring-cyan-200/40'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                    }`}
                  >
                <div>
                  <DraftField label="Unit" value={unit.code} disabled={!isUnitEditing} onCommit={(value) => updateUnitCode(index, value)} />
                </div>
                <div>
                  <DraftField label="Unit Name" value={unit.name} disabled={!isUnitEditing} onCommit={(value) => updateRow('units', index, { name: value })} />
                </div>
                <label>
                  <FieldLabel label="Parent Org." info="Select each organisation level in order. The saved path is stored against this unit." />
                  <div className="relative">
                    <button
                      type="button"
                      className={`${fieldClass} flex min-h-[38px] items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={!isUnitEditing || organisationParentLevels.length === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (openParentOrgUnitIndex === index) {
                          setOpenParentOrgUnitIndex(null);
                          setParentOrgMenuPlacement({ direction: 'down', maxHeight: 340 });
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        const viewportMargin = 12;
                        const menuGap = 4;
                        const desiredMenuHeight = 340;
                        const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportMargin - menuGap);
                        const availableAbove = Math.max(0, rect.top - viewportMargin - menuGap);
                        const shouldOpenUp = availableBelow < desiredMenuHeight && availableAbove > availableBelow;
                        const maxHeight = Math.max(160, Math.min(desiredMenuHeight, shouldOpenUp ? availableAbove : availableBelow));
                        setParentOrgMenuPlacement({ direction: shouldOpenUp ? 'up' : 'down', maxHeight });
                        setOpenParentOrgUnitIndex(index);
                      }}
                    >
                      <span
                        className={`min-w-0 truncate ${parentOrganisationDisplay ? 'text-white' : 'text-gray-500'}`}
                        title={parentOrganisationPath.join('-')}
                      >
                        {parentOrganisationDisplay || 'Choose Level 1'}
                      </span>
                      <span className="text-cyan-200">{openParentOrgUnitIndex === index ? '^' : 'v'}</span>
                    </button>
                    {openParentOrgUnitIndex === index && isUnitEditing && organisationParentLevels.length > 0 ? (
                      <div
                        className={`absolute left-0 z-[180] flex items-start overflow-y-auto rounded-lg border border-cyan-400/35 bg-gray-950/95 p-2 shadow-2xl shadow-black/45 ${
                          parentOrgMenuPlacement.direction === 'up' ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
                        }`}
                        style={{
                          maxHeight: parentOrgMenuPlacement.maxHeight,
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {organisationParentLevels
                          .slice(0, Math.min(organisationParentLevels.length, parentOrganisationPath.length + 1))
                          .map((level, parentLevelIndex) => {
                            const selectedValue = parentOrganisationPath[parentLevelIndex] || '';
                            const levelOptions = getFilteredParentOrganisationOptions(level, parentOrganisationPath, parentLevelIndex);
                            return (
                              <div key={`unit-${rowKey}-parent-org-menu-${level.levelIndex}`} className="w-56 border-r border-gray-700/70 last:border-r-0">
                                <div className="border-b border-gray-800 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-cyan-200">
                                  {level.name || `Level ${level.levelIndex}`}
                                </div>
                                <div className="max-h-72 overflow-y-auto py-1">
                                  {levelOptions.map((option) => {
                                    const isSelected = option === selectedValue;
                                    const hasNextLevel = parentLevelIndex < organisationParentLevels.length - 1;
                                    return (
                                      <button
                                        key={`${level.levelIndex}-${option}`}
                                        type="button"
                                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                          isSelected
                                            ? 'bg-cyan-500/20 text-cyan-50'
                                            : 'text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-50'
                                        }`}
                                        onClick={() => {
                                          updateUnitParentOrganisationPath(index, unit, parentLevelIndex, option);
                                          if (!hasNextLevel) {
                                            setOpenParentOrgUnitIndex(null);
                                            setParentOrgMenuPlacement({ direction: 'down', maxHeight: 340 });
                                          }
                                        }}
                                      >
                                        <span className="min-w-0 truncate">{option}</span>
                                        {hasNextLevel ? <span className="text-cyan-200">&gt;</span> : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        {parentOrganisationPath.length > 0 ? (
                          <div className="w-28 px-2 py-1">
                            <button
                              type="button"
                              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-2 text-xs font-bold text-gray-200 hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-100"
                              onClick={() => clearUnitParentOrganisationPath(index, unit)}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </label>
                <div>
                  <SelectField label="Location" value={unit.locationCode || ''} disabled={!isUnitEditing} options={visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code)} onChange={(value) => updateRow('units', index, { locationCode: value })} />
                </div>
                <div>
                  <SelectField label="Unit Type" value={unit.unitType || ''} disabled={!isUnitEditing} options={unitTypeOptions} onChange={(value) => updateRow('units', index, { unitType: value })} />
                </div>
                <label>
                  <FieldLabel
                    label="Trainees"
                    info="Turn off for units that do not use trainee records. Trainee event limits stay saved, but are greyed out for that unit."
                  />
                  <button
                    type="button"
                    aria-pressed={unitSettings.hasTrainees !== false}
                    disabled={!isUnitEditing}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateUnitSettings(unit, { hasTrainees: unitSettings.hasTrainees === false });
                    }}
                    className={`flex h-[38px] w-full items-center justify-between rounded border px-3 text-xs font-black uppercase tracking-wide transition ${
                      unitSettings.hasTrainees !== false
                        ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                        : 'border-gray-700 bg-gray-950 text-gray-400'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span>{unitSettings.hasTrainees !== false ? 'On' : 'Off'}</span>
                    <span className={`relative h-5 w-9 rounded-full border transition ${
                      unitSettings.hasTrainees !== false ? 'border-cyan-300 bg-cyan-400/30' : 'border-gray-600 bg-gray-800'
                    }`}>
                      <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition ${
                        unitSettings.hasTrainees !== false ? 'left-[18px] bg-cyan-100' : 'left-1 bg-gray-500'
                      }`} />
                    </span>
                  </button>
                </label>
                <div>
                  <SelectField
                    label="Model"
                    value={getUnitOperationalModel(unit)}
                    disabled={!isUnitEditing}
                    options={OPERATIONAL_MODEL_OPTIONS.map((option) => option.value)}
                    optionLabels={Object.fromEntries(OPERATIONAL_MODEL_OPTIONS.map((option) => [option.value, option.label]))}
                    onChange={(value) => updateRow('units', index, {
                      settings: {
                        ...unitSettings,
                        operationalModel: value || DEFAULT_OPERATIONAL_MODEL,
                      },
                    })}
                  />
                </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-task-profiles" className={getSectionClass('platform-task-profiles')}>
        <SectionHeader
          title="Task / Mission Profiles"
          subtitle="Model-specific mission or tasking lists used by Directed Events. Users can still type a task manually if the assigned task is not listed."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              <button
                type="button"
                onClick={() => {
                  if (taskProfilesUnlocked) {
                    void saveTaskProfilesAndExitEdit();
                    return;
                  }
                  startTaskProfilesEdit();
                }}
                disabled={taskProfilesUnlocked && (saving || applyingChanges)}
                className={platformActionButtonClass}
              >
                {taskProfilesUnlocked ? 'Save' : 'Edit'}
              </button>
            </div>
          ) : null}
        />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-100/80">
            Set the task names available for each operational model. Unit schedule tile labels are optional and only change the short text shown on schedule tiles.
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleOperationalModelOptions.map((option) => {
              const profiles = taskProfiles[option.value] || [];
              return (
                <div key={option.value} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{option.label}</h4>
                      <p className="mt-1 text-xs text-gray-400">
                        {option.value === 'air_combat'
                          ? 'Use this for Fighter / Strike model task names.'
                          : 'Shown when a unit is assigned this operational model.'}
                      </p>
                    </div>
                    <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                      {profiles.length} tasks
                    </span>
                  </div>
                  <TextAreaField
                    label="Task Names"
                    value={taskProfilesUnlocked ? (taskProfileDrafts[option.value] ?? formatTaskProfileText(profiles)) : formatTaskProfileText(profiles)}
                    disabled={!canEditTaskProfiles}
                    onChange={(value) => setTaskProfileDrafts((drafts) => ({ ...drafts, [option.value]: value }))}
                    info="One task name per line. Single-line comma or semicolon pasted lists are also accepted."
                  />
                </div>
              );
            })}
          </div>
          <div id="platform-task-tile-abbreviations" className="mt-5">
            <h4 className="mb-2 text-sm font-bold text-white">Unit Schedule Tile Labels</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleUnitRows.filter(({ unit }) => isActiveRecord(unit)).map(({ unit }) => {
                const unitIndex = config.units.findIndex((candidate) => candidate === unit);
                const abbreviations = unit.settings?.taskProfileAbbreviations || {};
                const unitDraftKey = getTaskProfileUnitDraftKey(unit, unitIndex);
                return (
                  <div id={`platform-task-tile-abbreviations-${getSettingsFocusAnchor(unit.code)}`} key={unit.code} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-bold text-white">{unit.code} - {unit.name}</h5>
                        <p className="mt-1 text-xs text-gray-400">
                          These abbreviations apply only when this unit is the active DFP context.
                        </p>
                      </div>
                      <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                        {Object.keys(abbreviations).length} abbreviations
                      </span>
                    </div>
                    <TextAreaField
                      label="Schedule Tile Labels"
                      value={taskProfilesUnlocked ? (taskProfileAbbreviationDrafts[unitDraftKey] ?? formatTaskProfileAbbreviationText(abbreviations)) : formatTaskProfileAbbreviationText(abbreviations)}
                      disabled={!canEditTaskProfiles}
                      onChange={(value) => setTaskProfileAbbreviationDrafts((drafts) => ({ ...drafts, [unitDraftKey]: value }))}
                      info="One label per line, for example Close Air Support - CAS. Equals signs are also accepted."
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-master-lmp-access" className={getSectionClass('platform-master-lmp-access')}>
        <SectionHeader
          title="Master LMP Access"
          subtitle="Restrict which locations and units can view, assign or manage each Master LMP. Empty location or unit values apply broadly."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-master-lmp-access')}
              <button type="button" onClick={addMasterLmpCatalogueEntry} disabled={!canEditSection('platform-master-lmp-access')} className={platformActionButtonClass}>Add Master LMP</button>
              <button type="button" onClick={addMasterLmpAccessRule} disabled={!canEditSection('platform-master-lmp-access')} className={platformActionButtonClass}>Add Access</button>
            </div>
          ) : null}
        />
        <div id="platform-master-lmp-access-records" className="space-y-3 p-4">
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-100/80">
            Add Master LMP records to the catalogue first, then create access rules that decide which locations or units can View, Assign, or Manage each Master LMP.
          </div>
          <div id="platform-master-lmp-catalogue" className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">Master LMP Catalogue</h4>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">These are the selectable Master LMP names used by access rules and later LMP assignment workflows.</p>
              </div>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                {visibleMasterLmpCatalogueRows.length}{settingsVisibilityEnabled ? ` of ${masterLmpCatalogue.length}` : ''} records
              </span>
            </div>
            <div className="max-w-full overflow-x-auto pb-2">
              <div className="min-w-[900px] space-y-3">
                {visibleMasterLmpCatalogueRows.length === 0 && (
                  <div className="rounded border border-dashed border-gray-700 bg-gray-950 px-3 py-4 text-sm font-semibold text-gray-300">
                    {masterLmpCatalogue.length === 0 ? 'No Master LMPs configured.' : 'No Master LMPs visible for this unit.'}
                  </div>
                )}
                {visibleMasterLmpCatalogueRows.map(({ entry, index }) => {
                  const linkedSyllabusCount = masterLmpSyllabusCounts.get(String(entry.code || '').trim().toUpperCase()) || 0;
                  return (
                    <div key={entry.id || `master-lmp-catalogue-${index}`} className="grid grid-cols-[minmax(150px,0.75fr)_minmax(180px,1fr)_minmax(220px,1.25fr)_minmax(130px,0.7fr)_120px_42px] gap-3 rounded border border-gray-700 bg-gray-950 p-3">
                      <DraftField
                        label="Code"
                        value={entry.code}
                        disabled={!canEditSection('platform-master-lmp-access')}
                        onCommit={(value) => updateMasterLmpCatalogueEntry(index, { code: value, name: entry.name || value })}
                        info="Stable selectable value used by Master LMP Access and trainee/course assignment."
                      />
                      <DraftField
                        label="Name"
                        value={entry.name || entry.code}
                        disabled={!canEditSection('platform-master-lmp-access')}
                        onCommit={(value) => updateMasterLmpCatalogueEntry(index, { name: value })}
                      />
                      <DraftField
                        label="Description"
                        value={entry.description || ''}
                        disabled={!canEditSection('platform-master-lmp-access')}
                        onCommit={(value) => updateMasterLmpCatalogueEntry(index, { description: value })}
                      />
                      <div>
                        <label className={labelClass}>Syllabus Content</label>
                        <div className="flex min-h-[38px] items-center rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                          {linkedSyllabusCount} event{linkedSyllabusCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <SelectField
                        label="Status"
                        value={entry.status || 'ACTIVE'}
                        disabled={!canEditSection('platform-master-lmp-access')}
                        options={['ACTIVE', 'INACTIVE']}
                        onChange={(value) => updateMasterLmpCatalogueEntry(index, { status: value })}
                      />
                      <div>
                        <div aria-hidden="true" className="h-[18px]" />
                        <button
                          type="button"
                          onClick={() => void deleteMasterLmpCatalogueEntry(index)}
                          disabled={!canEditSection('platform-master-lmp-access')}
                          title={`Delete ${entry.name || entry.code || 'Master LMP'}`}
                          className="flex min-h-[38px] w-full items-center justify-center rounded bg-transparent text-sm font-bold text-red-200 transition hover:bg-red-900/35 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <TrashIcon aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-white">Master LMP Access Rules</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">Access level order is View, Assign, then Manage. Manage allows assignment and editing. These rules are evaluated against the selected unit before LMPs can be assigned to courses or trainees.</p>
            </div>
          {visibleMasterLmpAccessRuleRows.map(({ rule, index }) => {
            const ruleKey = getMasterLmpAccessRuleKey(rule, index);
            const advancedScopeOpen = expandedMasterLmpAccessScopes.has(ruleKey);
            const advancedScopeCount = [
              rule.locationCode,
              rule.aircraftTypeCode,
              rule.operationalModel,
              rule.parentOrganisationCode,
            ].filter((value) => String(value || '').trim()).length;
            return (
              <div key={ruleKey} className="space-y-3 rounded border border-gray-700 bg-gray-900 p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(180px,1.4fr)_minmax(150px,1fr)_120px_120px_auto]">
                  <SelectField
                    label="Master LMP"
                    value={rule.lmpCode || ''}
                    disabled={!canEditSection('platform-master-lmp-access')}
                    options={masterLmpOptions}
                    onChange={(value) => updateMasterLmpAccessRule(index, { lmpCode: value })}
                  />
                  <SelectField
                    label="Unit"
                    value={rule.unitCode || ''}
                    disabled={!canEditSection('platform-master-lmp-access')}
                    options={['', ...(visibleUnitOptions.length > 0 ? visibleUnitOptions : config.units.map((unit) => unit.code))]}
                    emptyLabel="All Units"
                    onChange={(value) => updateMasterLmpAccessRule(index, { unitCode: value || null })}
                  />
                  <SelectField
                    label="Access"
                    value={rule.accessLevel || 'View'}
                    disabled={!canEditSection('platform-master-lmp-access')}
                    options={['View', 'Assign', 'Manage']}
                    onChange={(value) => updateMasterLmpAccessRule(index, { accessLevel: value })}
                  />
                  <SelectField
                    label="Status"
                    value={rule.status || 'ACTIVE'}
                    disabled={!canEditSection('platform-master-lmp-access')}
                    options={['ACTIVE', 'INACTIVE']}
                    onChange={(value) => updateMasterLmpAccessRule(index, { status: value })}
                  />
                  <div className="flex items-end justify-end gap-[1px]">
                    <div>
                      <div aria-hidden="true" className="h-[18px]" />
                      <button
                        type="button"
                        onClick={() => toggleMasterLmpAccessScope(rule, index)}
                        className={platformActionButtonClass}
                      >
                        {advancedScopeOpen ? 'Hide Advanced' : 'Advanced Scope'}
                        {advancedScopeCount > 0 ? ` (${advancedScopeCount})` : ''}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={!canEditSection('platform-master-lmp-access')}
                      onClick={() => removeMasterLmpAccessRule(index)}
                      title={`Delete ${rule.lmpCode || 'Master LMP'} access rule`}
                      aria-label={`Delete ${rule.lmpCode || 'Master LMP'} access rule`}
                      className="flex min-h-[38px] w-[42px] items-center justify-center rounded bg-transparent text-sm font-bold text-red-200 transition hover:bg-red-900/35 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <TrashIcon aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {advancedScopeOpen && (
                  <div className="grid gap-3 rounded border border-cyan-500/20 bg-cyan-500/5 p-3 lg:grid-cols-4">
                    <SelectField
                      label="Location"
                      value={rule.locationCode || ''}
                      disabled={!canEditSection('platform-master-lmp-access')}
                      options={['', ...(visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code))]}
                      emptyLabel="All Locations"
                      onChange={(value) => updateMasterLmpAccessRule(index, { locationCode: value || null })}
                    />
                    <SelectField
                      label="Aircraft Type"
                      value={rule.aircraftTypeCode || ''}
                      disabled={!canEditSection('platform-master-lmp-access')}
                      options={['', ...(visibleAircraftTypeOptions.length > 0 ? visibleAircraftTypeOptions : config.aircraftTypes.map((aircraft) => aircraft.code))]}
                      emptyLabel="Any Type"
                      onChange={(value) => updateMasterLmpAccessRule(index, { aircraftTypeCode: value || null })}
                    />
                    <SelectField
                      label="Model"
                      value={rule.operationalModel || ''}
                      disabled={!canEditSection('platform-master-lmp-access')}
                      options={['', ...OPERATIONAL_MODEL_OPTIONS.map((option) => option.value)]}
                      emptyLabel="Any Model"
                      onChange={(value) => updateMasterLmpAccessRule(index, { operationalModel: value || null })}
                    />
                    <SelectField
                      label="Parent Org"
                      value={rule.parentOrganisationCode || ''}
                      disabled={!canEditSection('platform-master-lmp-access')}
                      options={['', ...config.organisations.map((organisation) => organisation.code).filter(Boolean)]}
                      emptyLabel="Any Org"
                      onChange={(value) => updateMasterLmpAccessRule(index, { parentOrganisationCode: value || null })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </section>

      <section id="platform-standard-missions" className={getSectionClass('platform-standard-missions')}>
        <SectionHeader
          title="Reusable Flight Profiles"
          subtitle="Define reusable flight templates for regular Fixed Crew-style unit flights."
          action={canEdit && fixedCrewContext ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-standard-missions')}
              <button type="button" onClick={addStandardMissionProfile} disabled={!canEditSection('platform-standard-missions')} className={platformActionButtonClass}>Add Profile</button>
            </div>
          ) : null}
        />
        <div className="space-y-4 p-4">
          {!fixedCrewContext ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Reusable Flight Profiles are currently available for Fixed Crew-style models.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3">
                <div className="text-sm font-bold text-cyan-100">Active unit context: {activeStandardMissionUnitLabel || 'No unit selected'}</div>
                <p className="mt-1 text-xs leading-relaxed text-cyan-50/75">
                  New reusable flight profiles default to the unit home location and unit default callsign. Values can be manually edited when scheduled.
                </p>
              </div>
              {standardMissionProfilesForContext.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/60 p-5 text-sm text-gray-400">
                  No reusable flight profiles configured for this Fixed Crew unit.
                </div>
              ) : (
                <div id="platform-standard-mission-records" className="space-y-4">
                  {standardMissionProfilesForContext.map((profile) => {
                    const missionAircraftTypeCode = String(profile.aircraftTypeCode || getUnitAircraftTypeCode(profile.unitCode || activePrimaryUnitCode) || activeMissionAircraftTypeCode || '').trim().toUpperCase();
                    const missionCrewOptions = getStandardMissionCrewOptions(missionAircraftTypeCode);
                    const aircraftConfigOptions = getAircraftConfigOptions(missionAircraftTypeCode);
                    const selectedCrewCompositionId = profile.selectedCrewCompositionId || profile.acceptableCrewCompositionIds[0] || missionCrewOptions[0]?.id || '';
                    const crewMode = profile.crewCompositionMode || (selectedCrewCompositionId.startsWith('alternate:') ? 'ALTERNATE' : selectedCrewCompositionId ? 'STANDARD' : 'CUSTOM');
                    const selectedCrewOption = missionCrewOptions.find((option) => option.id === selectedCrewCompositionId);
                    return (
                    <div id={`platform-standard-mission-${getSettingsFocusAnchor(profile.id || profile.shortTitle || profile.missionName)}`} key={profile.id} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/85 shadow-lg">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 bg-gray-950/70 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded border border-cyan-400/30 bg-cyan-500/15 px-2 py-1 text-xs font-black text-cyan-100">{profile.shortTitle || 'TASK'}</span>
                            <h4 className="text-base font-black text-white">{profile.missionName || 'Unnamed Profile'}</h4>
                            <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{profile.resourceType}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{profile.description || 'No description entered.'}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-[1px]">
                          <SelectField label="Status" value={profile.status} disabled={!canEditSection('platform-standard-missions')} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateStandardMissionProfile(profile.id, { status: value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' })} />
                          <button type="button" onClick={() => removeStandardMissionProfile(profile.id)} disabled={!canEditSection('platform-standard-missions')} className={platformActionButtonClass}>
                            <span className="text-[9px] leading-tight text-red-600">Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <div className={resourceSectionPanelClass}>
                            <div className={resourceSectionPanelHeaderClass}>
                              <div>
                                <div className={resourceSectionPanelTitleClass}>Profile Details</div>
                                <div className={resourceSectionPanelHintClass}>Name, short tile title and notes.</div>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-[1fr_150px]">
                              <DraftField label="Profile Name" value={profile.missionName} disabled={!canEditSection('platform-standard-missions')} onCommit={(value) => updateStandardMissionProfile(profile.id, { missionName: value })} />
                              <DraftField label="Short Title" value={profile.shortTitle} disabled={!canEditSection('platform-standard-missions')} maxLength={8} onCommit={(value) => updateStandardMissionProfile(profile.id, { shortTitle: value.slice(0, 8).toUpperCase() })} />
                            </div>
                            <div className="mt-3">
                              <DraftTextAreaField label="Description" value={profile.description} disabled={!canEditSection('platform-standard-missions')} onCommit={(value) => updateStandardMissionProfile(profile.id, { description: value })} />
                            </div>
                          </div>

                          <div className={resourceSectionPanelClass}>
                            <div className={resourceSectionPanelHeaderClass}>
                              <div>
                                <div className={resourceSectionPanelTitleClass}>Timing & Route</div>
                                <div className={resourceSectionPanelHintClass}>Default route and timing values can be changed when scheduled.</div>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-3 [&>label]:grid [&>label]:grid-rows-[40px_42px] [&>label]:items-start">
                              <Field
                                label="Unit"
                                value={activeStandardMissionUnitLabel}
                                disabled
                                onChange={() => undefined}
                                info="Reusable Flight Profiles are scoped to the current unit context. Change the top-left context selector to work on a different unit or composite unit."
                              />
                              <DraftField label="Aircraft Type" value={missionAircraftTypeCode} disabled={!canEditSection('platform-standard-missions')} onCommit={(value) => updateStandardMissionProfile(profile.id, { aircraftTypeCode: value.toUpperCase(), config: getAircraftConfigOptions(value)[0] || 'ANY', selectedCrewCompositionId: `standard:${value.toUpperCase() || 'AIRCRAFT'}`, acceptableCrewCompositionIds: [`standard:${value.toUpperCase() || 'AIRCRAFT'}`], crewCompositionMode: 'STANDARD' })} info="Defaults from the selected unit's resource pool. Type the aircraft code manually if the unit setup is incomplete." />
                              <SelectField label="Type" value={profile.resourceType} disabled={!canEditSection('platform-standard-missions')} options={STANDARD_MISSION_RESOURCE_TYPES} onChange={(value) => updateStandardMissionProfile(profile.id, { resourceType: value as StandardMissionResourceType })} />
                              <SelectField label="Dep" value={profile.departureLocationCode || activeHomeLocationCode} disabled={!canEditSection('platform-standard-missions')} options={visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code)} onChange={(value) => updateStandardMissionProfile(profile.id, { departureLocationCode: value.toUpperCase() })} />
                              <SelectField label="Arr" value={profile.arrivalLocationCode || activeHomeLocationCode} disabled={!canEditSection('platform-standard-missions')} options={visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code)} onChange={(value) => updateStandardMissionProfile(profile.id, { arrivalLocationCode: value.toUpperCase() })} />
                              <NumberField label="Duration (min)" value={profile.durationMinutes} disabled={!canEditSection('platform-standard-missions')} onChange={(value) => updateStandardMissionProfile(profile.id, { durationMinutes: clampWholeNumber(value, 240, 1, 1440) })} />
                              <NumberField label="Pre-Flight (min)" value={profile.preFlightMinutes} disabled={!canEditSection('platform-standard-missions')} onChange={(value) => updateStandardMissionProfile(profile.id, { preFlightMinutes: clampWholeNumber(value, 90, 0, 1440) })} />
                              <NumberField label="Post-Flight (min)" value={profile.postFlightMinutes} disabled={!canEditSection('platform-standard-missions')} onChange={(value) => updateStandardMissionProfile(profile.id, { postFlightMinutes: clampWholeNumber(value, 60, 0, 1440) })} />
                              <SelectField label="CONFIG" value={profile.config || 'ANY'} disabled={!canEditSection('platform-standard-missions')} options={aircraftConfigOptions} onChange={(value) => updateStandardMissionProfile(profile.id, { config: value || 'ANY' })} />
                            </div>
                            <div className="mt-3 grid items-start gap-3 md:grid-cols-[1fr_160px]">
                              <div>
                                <FieldLabel label="Formation" />
                                <label className={`${fieldClass} flex h-[42px] items-center gap-2`}>
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                                    checked={profile.isFormation}
                                    disabled={!canEditSection('platform-standard-missions')}
                                    onChange={(event) => updateStandardMissionProfile(profile.id, { isFormation: event.target.checked })}
                                  />
                                  <span className="text-sm font-semibold text-gray-200">Formation profile</span>
                                </label>
                              </div>
                              <NumberField label="No. Aircraft" value={profile.formationAircraft} disabled={!canEditSection('platform-standard-missions') || !profile.isFormation} onChange={(value) => updateStandardMissionProfile(profile.id, { formationAircraft: clampWholeNumber(value, 2, 2, 24) })} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className={resourceSectionPanelClass}>
                            <div className={resourceSectionPanelHeaderClass}>
                              <div>
                                <div className={resourceSectionPanelTitleClass}>Crew & Callsign</div>
                                <div className={resourceSectionPanelHintClass}>Select acceptable crew compositions and any explicit role requirements.</div>
                              </div>
                            </div>
                            <DraftField label="Default Callsign Prefix" value={profile.defaultCallsignPrefix || defaultMissionCallsign} disabled={!canEditSection('platform-standard-missions')} onCommit={(value) => updateStandardMissionProfile(profile.id, { defaultCallsignPrefix: value })} info="Defaults from the unit callsign settings. This is the prefix only; sortie number selection comes later when scheduled." />
                            <div className="mt-3 rounded border border-gray-800 bg-gray-950/70 p-3">
                              <div className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-100">Crew Composition</div>
                              <div className="grid gap-2 sm:grid-cols-3">
                                {(['STANDARD', 'ALTERNATE', 'CUSTOM'] as const).map((mode) => {
                                  const selected = crewMode === mode;
                                  const modeLabel = mode === 'STANDARD' ? 'Standard Crew' : mode === 'ALTERNATE' ? 'Alternate Crew' : 'Custom Crew';
                                  const modeHint = mode === 'STANDARD'
                                    ? 'Use the aircraft standard crew.'
                                    : mode === 'ALTERNATE'
                                      ? 'Use one alternate mission crew.'
                                      : 'Use the manual role list below.';
                                  return (
                                    <button
                                      key={`${profile.id}-${mode}`}
                                      type="button"
                                      disabled={!canEditSection('platform-standard-missions')}
                                      onClick={() => updateStandardMissionCrewMode(profile, mode)}
                                      className={`rounded border px-3 py-2 text-left transition-colors ${
                                        selected
                                          ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-50 shadow-[inset_0_3px_0_rgba(34,211,238,0.85)]'
                                          : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                      }`}
                                    >
                                      <span className="block text-xs font-black uppercase tracking-wide">{modeLabel}</span>
                                      <span className="mt-1 block text-[11px] leading-relaxed opacity-75">{modeHint}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {crewMode === 'STANDARD' ? (
                                <div className="mt-3 rounded border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                                  {selectedCrewOption?.label || `Standard ${missionAircraftTypeCode || 'Aircraft'} Crew`}
                                </div>
                              ) : crewMode === 'ALTERNATE' ? (
                                <div className="mt-3">
                                  <SelectField
                                    label="Alternate Crew"
                                    value={selectedCrewCompositionId}
                                    disabled={!canEditSection('platform-standard-missions')}
                                    options={['', ...missionCrewOptions.filter((option) => option.mode === 'ALTERNATE').map((option) => option.id)]}
                                    optionLabels={Object.fromEntries(missionCrewOptions.filter((option) => option.mode === 'ALTERNATE').map((option) => [option.id, option.label]))}
                                    onChange={(value) => updateStandardMissionCrewSelection(profile, value, true)}
                                    emptyLabel="Select alternate crew"
                                  />
                                  {missionCrewOptions.filter((option) => option.mode === 'ALTERNATE').length === 0 ? (
                                    <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                      No alternate crew profiles exist for {missionAircraftTypeCode || 'this aircraft'}.
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="mt-3 rounded border border-orange-400/25 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100">
                                  Custom crew uses the manual required roles below.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={`${resourceSectionPanelClass} ${crewMode === 'CUSTOM' ? '' : 'opacity-65'}`}>
                            <div className={resourceSectionPanelHeaderClass}>
                              <div>
                                <div className={resourceSectionPanelTitleClass}>Required Roles</div>
                                <div className={resourceSectionPanelHintClass}>{crewMode === 'CUSTOM' ? 'Set the crew positions this profile must include when scheduled.' : 'Only used when Custom Crew is selected.'}</div>
                              </div>
                              <button type="button" onClick={() => addStandardMissionRoleRequirement(profile)} disabled={!canEditSection('platform-standard-missions') || crewMode !== 'CUSTOM'} className={platformActionButtonClass}>Add Role</button>
                            </div>
                            <div className="space-y-2">
                              {profile.roleRequirements.length === 0 ? (
                                <div className="rounded border border-dashed border-gray-700 bg-gray-950/70 p-3 text-xs text-gray-400">No manual role requirements configured.</div>
                              ) : profile.roleRequirements.map((requirement, roleIndex) => (
                                <div key={`${profile.id}-role-${roleIndex}`} className="grid gap-2 md:grid-cols-[1fr_110px_auto]">
                                  <SelectField label="Role" value={requirement.role} disabled={!canEditSection('platform-standard-missions') || crewMode !== 'CUSTOM'} options={crewCompositionRoleOptions} optionLabels={crewPositionLabelMap} onChange={(value) => updateStandardMissionRoleRequirement(profile, roleIndex, { role: value })} />
                                  <NumberField label="Number" value={requirement.count} disabled={!canEditSection('platform-standard-missions') || crewMode !== 'CUSTOM'} onChange={(value) => updateStandardMissionRoleRequirement(profile, roleIndex, { count: value })} />
                                  <div className="flex items-end">
                                    <button type="button" onClick={() => removeStandardMissionRoleRequirement(profile, roleIndex)} disabled={!canEditSection('platform-standard-missions') || crewMode !== 'CUSTOM'} className={platformActionButtonClass}>
                                      <span className="text-[9px] leading-tight">Remove</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section id="platform-crew-composition" className={getSectionClass('platform-crew-composition')}>
        <SectionHeader
          title="Crew Composition"
          subtitle="Aircraft-specific role labels, standard crew and alternate mission crew makeups for Air Combat, Fixed Crew and Pooled Crew."
          action={canEdit ? (
            <button
              type="button"
              onClick={() => {
                if (crewCompositionUnlocked) {
                  void saveCrewCompositionAndExitEdit();
                  return;
                }
                setCrewCompositionUnlocked(true);
              }}
              disabled={crewCompositionUnlocked && (saving || applyingChanges)}
              className={platformActionButtonClass}
            >
              {crewCompositionUnlocked ? 'Save' : 'Edit'}
            </button>
          ) : null}
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-700 bg-gray-950 p-2">
            {visibleCrewCompositionAircraftTypes.map((aircraft) => {
              const code = String(aircraft.code || '').trim().toUpperCase();
              const isActive = code === displayCrewCompositionAircraftCode;
              return (
                <button
                  key={`crew-composition-aircraft-tab-${code || aircraft.name}`}
                  type="button"
                  onClick={() => setCrewCompositionAircraftCode(code)}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-black uppercase tracking-wide transition-colors ${
                    isActive
                      ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-50 shadow-[inset_0_3px_0_rgba(34,211,238,0.85)]'
                      : 'border-gray-800 bg-gray-900/70 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <span className="block">{code || 'Aircraft'}</span>
                  <span className="mt-0.5 block max-w-[180px] truncate text-[10px] font-semibold normal-case tracking-normal text-gray-500">{aircraft.name || 'Unnamed aircraft type'}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Aircraft Roles</div>
              <div className="mt-1 text-lg font-black text-cyan-100">{visibleCrewPositionEntries.length}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-gray-500">Roles currently relevant to this aircraft tab.</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Alternate Profiles</div>
              <div className="mt-1 text-lg font-black text-orange-100">{displayAircraftAlternateCompositions.length}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-gray-500">Profiles for {displayCrewCompositionAircraftCode || 'this aircraft'} only.</div>
            </div>
          </div>

          <div className={resourceSectionPanelClass}>
            <div className={resourceSectionPanelHeaderClass}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide text-cyan-100">Crew Position Labels / Roles</h4>
                <p className={resourceSectionPanelHintClass}>These are the crew positions available for {displayCrewCompositionAircraftCode || 'this aircraft'}. Choose which operational models should use each position.</p>
              </div>
              <button type="button" onClick={addCrewPositionEntry} disabled={!canEditCrewComposition} className={platformActionButtonClass}>
                <span className="text-[10px] leading-tight">Add<br />Position</span>
              </button>
            </div>
            <div className="space-y-3">
              {visibleDisplayCrewPositionEntries.map((entry) => {
                const isDefaultEntry = defaultCrewPositionIds.has(entry.id);
                return (
                  <div key={`crew-role-${entry.id}`} className="grid gap-3 rounded border border-gray-700 bg-gray-900/80 p-3 lg:grid-cols-[minmax(182px,1.05fr)_minmax(65px,0.375fr)_minmax(300px,1.65fr)_auto]">
                    <DraftField label="Generic Position" value={entry.genericName} disabled={!canEditCrewComposition || isDefaultEntry} onCommit={(value) => updateCrewPositionEntry(entry.id, { genericName: value })} info={isDefaultEntry ? 'Baseline crew positions stay fixed so aircraft seat links remain reliable.' : 'The position used by aircraft seats and alternate crew profiles.'} />
                    <DraftField label="Label" value={entry.label} disabled={!canEditCrewComposition} onCommit={(value) => updateCrewPositionEntry(entry.id, { label: value })} />
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Applies To</label>
                      <div className="grid gap-1 rounded border border-gray-700 bg-gray-950/70 p-2 sm:grid-cols-2 xl:grid-cols-4">
                        {visibleOperationalModelOptions.map((option) => {
                          const selectedModels = entry.operationalModels?.length ? entry.operationalModels : OPERATIONAL_MODEL_OPTIONS.map((modelOption) => modelOption.value);
                          const isSelected = selectedModels.includes(option.value);
                          return (
                            <label key={option.value} className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] font-semibold ${isSelected ? 'bg-cyan-500/10 text-cyan-100' : 'text-gray-400'}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canEditCrewComposition}
                                onChange={(event) => {
                                  const nextModels = event.target.checked
                                    ? Array.from(new Set([...selectedModels, option.value]))
                                    : selectedModels.filter((model) => model !== option.value);
                                  updateCrewPositionEntry(entry.id, { operationalModels: nextModels.length > 0 ? nextModels : [option.value] });
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-500 accent-cyan-400"
                              />
                              <span>{option.label.replace(' Model', '')}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removeCrewPositionEntry(entry.id)} disabled={!canEditCrewComposition || crewPositionTerminology.positions.length <= 1} className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={standardCrewCompositionRef} className={resourceSectionPanelClass}>
            <div className={resourceSectionPanelHeaderClass}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide text-orange-100">Standard Crew Composition</h4>
                <p className={resourceSectionPanelHintClass}>This standard composition applies to {displayCrewCompositionAircraftCode || 'the selected aircraft type'}.</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white">{displayCrewCompositionAircraftCode || 'AIRCRAFT'}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{displayCrewCompositionAircraft?.category || 'Training'} aircraft</div>
                </div>
                <div className="grid min-w-[360px] gap-2 sm:grid-cols-4">
                  <NumberField label="Total Seats" value={displayCrewComposition.crewCount} disabled={!canEditCrewComposition} onChange={(value) => updateAircraftCrewCount(displayCrewCompositionAircraftIndex, value)} />
                  {AIRCRAFT_CREW_RESOURCE_KINDS.map(({ kind, shortLabel }) => (
                    <NumberField
                      key={`crew-resource-count-${kind}`}
                      label={shortLabel === 'Procedural Trainer' ? 'Proc Trainer' : `${shortLabel} Seats`}
                      value={displayCrewComposition.resourceSeatCounts?.[kind] ?? displayCrewComposition.crewCount}
                      disabled={!canEditCrewComposition}
                      onChange={(value) => updateAircraftCrewResourceSeatCount(displayCrewCompositionAircraftIndex, kind, value)}
                    />
                  ))}
                  <div className="mt-2 h-fit rounded-md border border-orange-300/20 bg-orange-500/10 px-2 py-2">
                    <div className="mb-1 text-[9px] font-black uppercase leading-tight tracking-wide text-orange-100">Crew Summary</div>
                    <ol className="space-y-0.5 text-[11px] font-semibold leading-tight text-orange-50/90">
                      {getStandardCrewSummary(displayCrewComposition).map((roleLabel, index) => (
                        <li key={`standard-crew-summary-${index}`}>{index + 1}. {roleLabel}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {displayCrewComposition.seats.map((seat, seatIndex) => {
                  const eligibleRoles = getAircraftSeatEligibleRoles(seat);
                  const crewPositionOptions = getCrewPositionOptions(crewPositionTerminology, eligibleRoles);
                  const visibleResourceKinds = AIRCRAFT_CREW_RESOURCE_KINDS.filter(({ kind }) => (
                    seatIndex < (displayCrewComposition.resourceSeatCounts?.[kind] ?? displayCrewComposition.crewCount)
                  ));
                  return (
                    <div key={seat.id || `standard-crew-seat-${seatIndex}`} className="rounded-lg border border-gray-800 bg-gray-950/70 p-2">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-orange-100">Seat {seatIndex + 1}</div>
                          <div className="text-[11px] text-gray-500">Role eligibility by resource type.</div>
                        </div>
                        <div className="w-40">
                          <SelectField label="Default" value={seat.role} disabled={!canEditCrewComposition} options={eligibleRoles} optionLabels={crewPositionLabelMap} onChange={(value) => updateAircraftSeatRole(displayCrewCompositionAircraftIndex, seatIndex, value)} />
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-md border border-gray-800">
                        <div
                          className="grid bg-gray-900/80 text-[9px] font-black uppercase tracking-wide text-gray-500"
                          style={{ gridTemplateColumns: `minmax(130px,1fr) repeat(${Math.max(visibleResourceKinds.length, 1)}, minmax(58px,72px))` }}
                        >
                          <div className="px-2 py-1.5">Role</div>
                          {visibleResourceKinds.map(({ kind, shortLabel }) => (
                            <div key={`seat-${seatIndex}-${kind}-header`} className="px-1 py-1.5 text-center">{shortLabel}</div>
                          ))}
                          {visibleResourceKinds.length === 0 && <div className="px-1 py-1.5 text-center">No seats</div>}
                        </div>
                        {crewPositionOptions.map((role) => (
                          <div
                            key={role}
                            className="grid border-t border-gray-800 text-xs font-semibold"
                            style={{ gridTemplateColumns: `minmax(130px,1fr) repeat(${Math.max(visibleResourceKinds.length, 1)}, minmax(58px,72px))` }}
                          >
                            <button
                              type="button"
                              disabled={!canEditCrewComposition || (eligibleRoles.some((candidate) => candidate.toUpperCase() === role.toUpperCase()) && eligibleRoles.length <= 1)}
                              onClick={() => {
                                const checked = eligibleRoles.some((candidate) => candidate.toUpperCase() === role.toUpperCase());
                                updateAircraftSeatEligibleRole(displayCrewCompositionAircraftIndex, seatIndex, role, !checked);
                              }}
                              className={`px-2 py-1.5 text-left ${eligibleRoles.some((candidate) => candidate.toUpperCase() === role.toUpperCase()) ? 'text-orange-100' : 'text-gray-400'} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {crewPositionLabelMap[role] || role}
                            </button>
                            {visibleResourceKinds.map(({ kind }) => {
                              const resourceRoles = getAircraftSeatEligibleRolesForResource(seat, kind);
                              const checked = resourceRoles.some((candidate) => candidate.toUpperCase() === role.toUpperCase());
                              return (
                                <label key={`seat-${seatIndex}-${role}-${kind}`} className={`flex items-center justify-center border-l border-gray-800 px-1 py-1.5 ${checked ? 'bg-orange-500/10' : 'bg-gray-950/40'}`}>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-500 accent-orange-400"
                                    checked={checked}
                                    disabled={!canEditCrewComposition || (checked && resourceRoles.length <= 1)}
                                    onChange={(event) => updateAircraftSeatResourceEligibleRole(displayCrewCompositionAircraftIndex, seatIndex, kind, role, event.target.checked)}
                                  />
                                </label>
                              );
                            })}
                            {visibleResourceKinds.length === 0 && <div className="border-l border-gray-800 px-1 py-1.5 text-center text-gray-600">-</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div id="platform-alternate-crew-composition" className={resourceSectionPanelClass}>
            <div className={resourceSectionPanelHeaderClass}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide text-cyan-100">Alternate Crew Composition</h4>
                <p className={resourceSectionPanelHintClass}>Alternate profiles shown here are only for {displayCrewCompositionAircraftCode || 'the selected aircraft'}.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-[1px]">
                <button type="button" onClick={() => addAlternateCrewComposition(displayCrewCompositionAircraftCode)} disabled={!canEditCrewComposition || !displayCrewCompositionAircraftCode} className={platformActionButtonClass}>
                  <span className="text-[9px] leading-tight">Add Alt<br />Crew</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {displayAircraftAlternateCompositions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-400">No alternate crew compositions configured.</div>
              ) : displayAircraftAlternateCompositions.map((profile) => (
                <div key={profile.id} className="rounded-lg border border-gray-700 bg-gray-900/80 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px]">
                    <div>
                      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr_1.6fr_auto]">
                        <DraftField
                          label="Short Code (3 letters)"
                          value={profile.code}
                          disabled={!canEditCrewComposition}
                          maxLength={3}
                          onCommit={(value) => updateAlternateCrewComposition(profile.id, { code: value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })}
                          info="This is the three-letter code the app can use to recognise this alternate crew. The display name can change, but keep this short code the same once the crew type is being used."
                        />
                        <OffsetField label="Display Name" value={profile.name} disabled={!canEditCrewComposition} onChange={(value) => updateAlternateCrewComposition(profile.id, { name: value })} />
                        <OffsetField label="Description" value={profile.description || ''} disabled={!canEditCrewComposition} onChange={(value) => updateAlternateCrewComposition(profile.id, { description: value })} />
                        <div className="flex items-start pt-[31px]">
                          <button type="button" onClick={() => removeAlternateCrewComposition(profile.id)} disabled={!canEditCrewComposition} className={platformActionButtonClass}>
                            <span className="text-[9px] leading-tight text-red-600">Delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/70 py-3 pl-3 pr-0">
                        <div className="mb-2 grid gap-3 lg:grid-cols-[0.8fr_1.2fr_1.6fr_auto]">
                          <div className="lg:col-span-3">
                            <div className="text-xs font-black uppercase tracking-wide text-gray-300">Role Requirements</div>
                            <div className="text-[11px] text-gray-500">Counts are grouped by generic scheduler role.</div>
                          </div>
                          <div className="flex items-start justify-start">
                            <button type="button" onClick={() => addAlternateCrewRole(profile.id)} disabled={!canEditCrewComposition || !getNextAlternateCrewRole(profile)} className={platformActionButtonClass}>
                              <span className="text-[9px] leading-tight">Add<br />Role</span>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {profile.roleRequirements.map((requirement, roleIndex) => (
                            <div key={`${profile.id}-role-${roleIndex}`} className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr_1.6fr_auto]">
                              <div className="lg:col-span-2">
                                <SelectField label="Role" value={requirement.role} disabled={!canEditCrewComposition} options={crewCompositionRoleOptions} optionLabels={crewPositionLabelMap} onChange={(value) => updateAlternateCrewRole(profile.id, roleIndex, { role: value })} />
                              </div>
                              <NumberField label="Count" value={requirement.count} disabled={!canEditCrewComposition} onChange={(value) => updateAlternateCrewRole(profile.id, roleIndex, { count: value })} />
                              <div className="flex items-end justify-start">
                                <button type="button" onClick={() => removeAlternateCrewRole(profile.id, roleIndex)} disabled={!canEditCrewComposition || profile.roleRequirements.length <= 1} className={platformActionButtonClass}>
                                  <span className="text-[9px] leading-tight">Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="h-fit w-[110px] justify-self-end rounded-md border border-cyan-300/20 bg-cyan-500/10 px-2 py-2">
                      <div className="mb-1 text-[9px] font-black uppercase leading-tight tracking-wide text-cyan-100">Crew Summary</div>
                      <ol className="space-y-0.5 text-[11px] font-semibold leading-tight text-cyan-50/90">
                        {getAlternateCrewSummary(profile).map((roleLabel, index) => (
                          <li key={`${profile.id}-summary-${index}`}>{index + 1}. {roleLabel}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-currency-profiles" className={getSectionClass('platform-currency-profiles')}>
        <SectionHeader
          title={continuationCurrencyEventsLabel}
          subtitle="Continuation and currency event defaults. Event profiles store crew, CONFIG and currency against the selected aircraft."
          action={canEdit ? (
            <button
              type="button"
              onClick={() => {
                if (crewCompositionUnlocked) {
                  void saveCurrencyProfilesAndExitEdit();
                  return;
                }
                setCrewCompositionUnlocked(true);
              }}
              disabled={crewCompositionUnlocked && (saving || applyingChanges)}
              className={platformActionButtonClass}
            >
              {crewCompositionUnlocked ? 'Save' : 'Edit'}
            </button>
          ) : null}
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-700 bg-gray-950 p-2">
            {visibleCrewCompositionAircraftTypes.map((aircraft) => {
              const code = String(aircraft.code || '').trim().toUpperCase();
              const isActive = code === displayCrewCompositionAircraftCode;
              return (
                <button
                  key={`currency-profile-aircraft-tab-${code || aircraft.name}`}
                  type="button"
                  onClick={() => setCrewCompositionAircraftCode(code)}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-black uppercase tracking-wide transition-colors ${
                    isActive
                      ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-50 shadow-[inset_0_3px_0_rgba(34,211,238,0.85)]'
                      : 'border-gray-800 bg-gray-900/70 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <span className="block">{code || 'Aircraft'}</span>
                  <span className="mt-0.5 block max-w-[180px] truncate text-[10px] font-semibold normal-case tracking-normal text-gray-500">{aircraft.name || 'Unnamed aircraft type'}</span>
                </button>
              );
            })}
          </div>

          <div id="platform-currency-profile-records" className={resourceSectionPanelClass}>
            <div className={resourceSectionPanelHeaderClass}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide text-cyan-100">{continuationCurrencyEventsLabel}</h4>
                <p className={resourceSectionPanelHintClass}>Event profiles prefill continuation and currency requests with crew, aircraft CONFIG and currency for {displayCrewCompositionAircraftCode || 'the selected aircraft'}.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-[1px]">
                <button type="button" onClick={addCurrencyProfile} disabled={!canEditCrewComposition || !displayCrewCompositionAircraftCode} className={platformActionButtonClass}>
                  <span className="text-[9px] leading-tight">Add<br />Profile</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {displayCurrencyProfiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-400">No continuation/currency event profiles configured.</div>
              ) : displayCurrencyProfiles.map((profile) => {
                const crewOptions = Array.from(new Set([
                  ...currencyProfileCrewOptions,
                ].map((option) => String(option || '').trim()).filter(Boolean)));
                const profileConfigOptions = getAircraftConfigOptions(profile.aircraftTypeCode || displayCrewCompositionAircraftCode);
                const acceptableConfigs = Array.from(new Set(
                  (Array.isArray(profile.acceptableAircraftConfigs) && profile.acceptableAircraftConfigs.length > 0
                    ? profile.acceptableAircraftConfigs
                    : [profile.config || 'ANY'])
                    .map((configId) => String(configId || '').trim())
                    .filter(Boolean),
                ));
                const configOptions = Array.from(new Set([
                  ...acceptableConfigs,
                  ...profileConfigOptions,
                ].filter(Boolean)));
                const toggleCurrencyProfileConfig = (configId: string) => {
                  const selected = new Set(acceptableConfigs);
                  if (selected.has(configId)) {
                    selected.delete(configId);
                  } else {
                    selected.add(configId);
                  }
                  const nextConfigs = Array.from(selected);
                  const safeConfigs = nextConfigs.length > 0 ? nextConfigs : ['ANY'];
                  updateCurrencyProfile(profile.id, {
                    acceptableAircraftConfigs: safeConfigs,
                    config: safeConfigs[0] || 'ANY',
                  });
                };
                const currencyOptions = activeCurrencyDefinitionNames.includes(profile.currency)
                  ? activeCurrencyDefinitionNames
                  : [profile.currency, ...activeCurrencyDefinitionNames].filter(Boolean);
                return (
                <div key={profile.id} className="grid gap-3 rounded-lg border border-gray-700 bg-gray-900/80 p-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.55fr)_auto]">
                  <OffsetField label="Profile Name" value={profile.name} disabled={!canEditCrewComposition} onChange={(value) => updateCurrencyProfile(profile.id, { name: value })} />
                  <OffsetField
                    label="Code"
                    value={profile.code}
                    disabled={!canEditCrewComposition}
                    maxLength={8}
                    onChange={(value) => updateCurrencyProfile(profile.id, { code: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })}
                  />
                  <div className="[&_select]:mt-[15px]">
                    <SelectField label="Crew" value={profile.crew} disabled={!canEditCrewComposition || crewOptions.length === 0} options={crewOptions} onChange={(value) => updateCurrencyProfile(profile.id, { crew: value })} />
                  </div>
                  <div className="[&_select]:mt-[15px]">
                    <SelectField
                      label="Day/Night"
                      value={profile.dayNight || 'Day'}
                      disabled={!canEditCrewComposition}
                      options={['Day', 'Night', 'Day/Night']}
                      onChange={(value) => updateCurrencyProfile(profile.id, { dayNight: (value || 'Day') as CurrencyProfile['dayNight'] })}
                    />
                  </div>
                  <div className="[&_select]:mt-[15px]">
                    <SelectField
                      label="Dual/Solo"
                      value={profile.flightType || 'Dual'}
                      disabled={!canEditCrewComposition}
                      options={['Dual', 'Solo']}
                      onChange={(value) => updateCurrencyProfile(profile.id, { flightType: (value || 'Dual') as CurrencyProfile['flightType'] })}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">CONFIG</div>
                    <div className="max-h-[78px] overflow-y-auto rounded border border-gray-700 bg-gray-950/60 p-2">
                      {configOptions.map((configId) => (
                        <label key={`${profile.id}-config-${configId}`} className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-gray-200 last:mb-0">
                          <input
                            type="checkbox"
                            checked={acceptableConfigs.includes(configId)}
                            disabled={!canEditCrewComposition}
                            onChange={() => toggleCurrencyProfileConfig(configId)}
                            className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span className="min-w-0 truncate">{configId}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="[&_select]:mt-[15px]">
                    <SelectField
                      label="Currency"
                      value={profile.currency}
                      disabled={!canEditCrewComposition || currencyOptions.length === 0}
                      options={currencyOptions}
                      onChange={(value) => updateCurrencyProfile(profile.id, { currency: value })}
                      emptyLabel={currencyOptions.length === 0 ? 'No unit currencies configured' : undefined}
                    />
                  </div>
                  <OffsetField
                    label="No. of A/C"
                    value={String(Math.max(1, Number(profile.aircraftCount) || 1))}
                    disabled={!canEditCrewComposition}
                    onChange={(value) => updateCurrencyProfile(profile.id, { aircraftCount: Math.max(1, Math.min(24, Math.round(Number(value) || 1))) })}
                  />
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeCurrencyProfile(profile.id)} disabled={!canEditCrewComposition} className={platformActionButtonClass}>
                      <span className="text-[9px] leading-tight text-red-600">Delete</span>
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-resource-pools" className={getSectionClass('platform-resource-pools')}>
        <SectionHeader
          title="Aircraft Types & Resource Pools"
          subtitle={resourcePoolsUnlocked
            ? 'Editing is active. Press Save to apply aircraft type and resource pool changes, then return this section to read-only mode.'
            : 'Aircraft type defines capability; resource pools define shared or dedicated aircraft, simulator, procedural trainer and ground resources. Click Edit before making changes.'}
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {resourcePoolsUnlocked ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResourcePoolDeletePanel((current) => !current);
                      setResourcePoolActiveTab('resourcePools');
                    }}
                    className={platformActionButtonClass}
                    title="Show or hide resource pool deletion controls"
                  >
                    <span className="text-[9px] leading-tight">Delete<br />Pool</span>
                  </button>
                  <button
                    type="button"
                    onClick={addAircraftType}
                    className={platformActionButtonClass}
                    title="Add aircraft type"
                  >
                    <span className="text-[8px] leading-[0.7rem]">Add<br />Aircraft<br />Type</span>
                  </button>
                  <button
                    type="button"
                    onClick={addResourcePool}
                    className={platformActionButtonClass}
                    title="Add resource pool"
                  >
                    <span className="text-[9px] leading-tight">Add<br />Pool</span>
                  </button>
                  <button
                    type="button"
                    onClick={saveResourcePoolsAndExitEdit}
                    disabled={saving || applyingChanges}
                    className={platformActionButtonClass}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={exitResourcePoolsEditMode}
                    disabled={saving || applyingChanges}
                    className={platformActionButtonClass}
                  >
                    Exit
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={enterResourcePoolsEditMode}
                  className={platformActionButtonClass}
                >
                  Edit
                </button>
              )}
            </div>
          ) : null}
        />
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Aircraft Types</div>
              <div className="mt-1 text-lg font-black text-orange-100">{visibleAircraftTypeRows.length}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-gray-500">Capability, category and crew-seat rules.</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Resource Pools</div>
              <div className="mt-1 text-lg font-black text-cyan-100">{config.resourcePools.length}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-gray-500">Dedicated or shared DFP resources.</div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-gray-700 bg-gray-950 p-1 shadow-inner shadow-black/20" role="tablist" aria-label="Aircraft and resource pool sections">
            <button
              type="button"
              role="tab"
              aria-selected={resourcePoolActiveTab === 'aircraftTypes'}
              onClick={() => setResourcePoolActiveTab('aircraftTypes')}
              className={`min-h-[52px] rounded-md border px-3 py-2 text-left transition-colors ${
                resourcePoolActiveTab === 'aircraftTypes'
                  ? 'border-orange-300/60 bg-orange-500/15 text-orange-50 shadow-[inset_0_3px_0_rgba(251,146,60,0.85)]'
                  : 'border-transparent bg-gray-900/70 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide">
                <span>Aircraft Types</span>
                <span className="rounded border border-orange-300/35 bg-orange-500/15 px-2 py-0.5 text-[10px] text-orange-100">{visibleAircraftTypeRows.length}</span>
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed">Capability and crew-seat rules</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={resourcePoolActiveTab === 'resourcePools'}
              onClick={() => setResourcePoolActiveTab('resourcePools')}
              className={`min-h-[52px] rounded-md border px-3 py-2 text-left transition-colors ${
                resourcePoolActiveTab === 'resourcePools'
                  ? 'border-cyan-300/60 bg-cyan-500/15 text-cyan-50 shadow-[inset_0_3px_0_rgba(34,211,238,0.85)]'
                  : 'border-transparent bg-gray-900/70 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide">
                <span>Resource Pools</span>
                <span className="rounded border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">{config.resourcePools.length}</span>
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed">Resources, labels and DFP rows</span>
            </button>
          </div>
          {resourcePoolActiveTab === 'aircraftTypes' ? (
          <div id="platform-aircraft-type-settings" className="space-y-3" role="tabpanel">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wide text-orange-100">Aircraft Types</h4>
              <p className="mt-1 text-xs text-gray-500">Define aircraft capability and normal seat eligibility.</p>
            </div>
            {visibleAircraftTypeRows.map(({ aircraft, index }) => {
              const crewComposition = normaliseAircraftCrewComposition(aircraft.crewComposition);
              const crewPositionOptions = getCrewPositionOptions(
                crewPositionTerminology,
                crewComposition.seats.flatMap((seat) => getAircraftSeatEligibleRoles(seat)),
              );
              return (
                <div key={aircraft.id || `platform-aircraft-type-${index}`} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/65 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-orange-400/35 bg-orange-500/15 px-2 py-1 text-xs font-black text-orange-100">{aircraft.code || 'NEW'}</span>
                        <span className="text-sm font-bold text-white">{aircraft.name || 'Unnamed aircraft type'}</span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{aircraft.category || 'Training'} aircraft</div>
                    </div>
                    <div className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-right">
                      <div className="text-[9px] font-black uppercase tracking-wide text-gray-500">Crew Seats</div>
                      <div className="text-sm font-black text-orange-100">{crewComposition.crewCount}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-3">
                    <div className="grid gap-3 md:grid-cols-[0.7fr_1.25fr_0.9fr_0.8fr_0.8fr]">
                      <DraftField label="Code" value={aircraft.code} disabled={!canEditResourcePools} onCommit={(value) => updateRow('aircraftTypes', index, { code: value })} />
                      <DraftField label="Name" value={aircraft.name} disabled={!canEditResourcePools} onCommit={(value) => updateRow('aircraftTypes', index, { name: value })} />
                      <SelectField label="Category" value={aircraft.category || 'Training'} disabled={!canEditResourcePools} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'Rotary', 'Other']} onChange={(value) => updateRow('aircraftTypes', index, { category: value })} />
                      <TasField
                        label="TAS (KTAS)"
                        value={aircraft.defaultTasKtas ?? null}
                        disabled={!canEditResourcePools}
                        info="Used for route/time planning when a mission or event does not specify a custom speed."
                        onChange={(value) => updateRow('aircraftTypes', index, { defaultTasKtas: value })}
                      />
                      <TasField
                        label="Cruise Alt (FL)"
                        value={aircraft.defaultCruiseAltitudeFl ?? null}
                        disabled={!canEditResourcePools}
                        placeholder="360"
                        info="Enter the flight level number only, for example 360 rather than FL360."
                        onChange={(value) => updateRow('aircraftTypes', index, { defaultCruiseAltitudeFl: value })}
                      />
                    </div>

                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-orange-100">Crew Composition</div>
                          <div className={resourceSectionPanelHintClass}>
                            Set seat count and which configured roles may occupy each seat.
                          </div>
                        </div>
                        <div className="w-32">
                          <NumberField
                            label="Crew Seats"
                            value={crewComposition.crewCount}
                            disabled={!canEditResourcePools}
                            onChange={(value) => updateAircraftCrewCount(index, value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2 lg:grid-cols-2">
                        {crewComposition.seats.map((seat, seatIndex) => {
                          const eligibleRoles = getAircraftSeatEligibleRoles(seat);
                          const selectedLabel = eligibleRoles.map((role) => crewPositionLabelMap[role] || role).join(', ');
                          return (
                            <div key={seat.id || `aircraft-seat-${seatIndex}`} className="rounded-lg border border-gray-800 bg-gray-900/80 p-2">
                              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-black uppercase tracking-wide text-orange-100">Seat {seatIndex + 1}</div>
                                  <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                                    {selectedLabel || 'Select at least one role'}
                                  </div>
                                </div>
                                <div className="w-40">
                                  <SelectField
                                    label="Default"
                                    value={seat.role}
                                    disabled={!canEditResourcePools}
                                    options={eligibleRoles}
                                    optionLabels={crewPositionLabelMap}
                                    onChange={(value) => updateAircraftSeatRole(index, seatIndex, value)}
                                  />
                                </div>
                              </div>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {crewPositionOptions.map((role) => {
                                  const checked = eligibleRoles.some((candidate) => candidate.toUpperCase() === role.toUpperCase());
                                  return (
                                    <label
                                      key={role}
                                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-semibold ${
                                        checked
                                          ? 'border-orange-300/35 bg-orange-500/10 text-orange-100'
                                          : 'border-gray-800 bg-gray-950/70 text-gray-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-500 accent-orange-400"
                                        checked={checked}
                                        disabled={!canEditResourcePools || (checked && eligibleRoles.length <= 1)}
                                        onChange={(event) => updateAircraftSeatEligibleRole(index, seatIndex, role, event.target.checked)}
                                      />
                                      <span>{crewPositionLabelMap[role] || role}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className="space-y-3" role="tabpanel">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wide text-cyan-100">Resource Pools</h4>
              <p className="mt-1 text-xs text-gray-500">Map resources to units, labels, aircraft numbering and DFP resource rows.</p>
            </div>
            {showResourcePoolDeletePanel && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="mb-3">
                  <div className="text-xs font-black uppercase tracking-wide text-red-100">Delete Resource Pool Entered In Error</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-red-100/70">
                    Select by resource pool name only. Deletion requires your password and is applied only when this section is saved.
                  </div>
                </div>
                <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <SelectField
                    label="Resource Pool"
                    value={selectedResourcePoolDeleteKey}
                    disabled={!canEditResourcePools || activeResourcePoolDeleteOptions.length === 0}
                    options={['', ...activeResourcePoolDeleteOptions.map((option) => option.key)]}
                    optionLabels={Object.fromEntries(activeResourcePoolDeleteOptions.map((option) => [option.key, option.name]))}
                    emptyLabel="Select resource pool"
                    onChange={setSelectedResourcePoolDeleteKey}
                  />
                  <button
                    type="button"
                    disabled={!canEditResourcePools || !selectedResourcePoolDeleteKey}
                    onClick={deleteSelectedResourcePool}
                    className="h-[38px] rounded-md border border-red-300/50 bg-red-500/20 px-4 text-sm font-black text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Selected Pool
                  </button>
                </div>
              </div>
            )}
            {visibleResourcePoolRows.map(({ pool, index }) => {
              const editableDfpRows = getEditableDfpResourceRows(pool);
              const aircraftNumberSettings = normaliseAircraftNumberSettings(pool.settings || {});
              const aircraftConfigurations = normaliseAircraftConfigurationDefinitions(pool.settings?.aircraftConfigurations || []);
              return (
                <div
                  key={pool.id || `platform-resource-pool-${index}`}
                  ref={(node) => {
                    const rowKey = pool.id || `platform-resource-pool-${index}`;
                    resourcePoolRowRefs.current[rowKey] = node;
                  }}
                  className="overflow-hidden rounded-lg border-2 bg-gray-900/95"
                  style={{
                    borderColor: platformLocationRowTone.border,
                    boxShadow: `inset 4px 0 0 ${platformLocationRowTone.accent}, 0 12px 24px rgba(0,0,0,0.22)`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/65 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 text-xs font-black text-cyan-100">{pool.code || 'NEW'}</span>
                        <span className="text-sm font-bold text-white">{pool.name || 'Unnamed resource pool'}</span>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                        {pool.poolType || 'Dedicated'} pool {pool.unitCode ? `for ${pool.unitCode}` : ''}
                      </div>
                    </div>
                    <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-right">
                      <div className="text-[9px] font-black uppercase tracking-wide text-gray-500">DFP</div>
                      <div className="text-sm font-black text-emerald-200">Rows</div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-3">
                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className={resourceSectionPanelTitleClass}>Pool Identity</div>
                          <div className={resourceSectionPanelHintClass}>The owning unit, aircraft type and sharing model for this pool.</div>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <DraftField label="Pool Code" value={pool.code} disabled={!canEditResourcePools} onCommit={(value) => updateRow('resourcePools', index, { code: value })} />
                        <DraftField label="Pool Name" value={pool.name} disabled={!canEditResourcePools} onCommit={(value) => updateRow('resourcePools', index, { name: value })} />
                        <SelectField label="Location" value={pool.locationCode || ''} disabled={!canEditResourcePools} options={['', ...(visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code))]} onChange={(value) => updateRow('resourcePools', index, { locationCode: value || null })} />
                        <SelectField label="Owning Unit" value={pool.unitCode || ''} disabled={!canEditResourcePools} options={['', ...(visibleUnitOptions.length > 0 ? visibleUnitOptions : config.units.map((unit) => unit.code))]} onChange={(value) => updateRow('resourcePools', index, { unitCode: value || null })} />
                        <SelectField label="Aircraft Type" value={pool.aircraftTypeCode || ''} disabled={!canEditResourcePools} options={['', ...(visibleAircraftTypeOptions.length > 0 ? visibleAircraftTypeOptions : config.aircraftTypes.map((aircraft) => aircraft.code))]} onChange={(value) => updateRow('resourcePools', index, { aircraftTypeCode: value || null })} />
                        <SelectField label="Pool Type" value={pool.poolType || 'Dedicated'} disabled={!canEditResourcePools} options={['Dedicated', 'Shared']} onChange={(value) => updateRow('resourcePools', index, { poolType: value })} />
                      </div>
                    </div>

                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className={resourceSectionPanelTitleClass}>Display Names</div>
                          <div className={resourceSectionPanelHintClass}>Terminology shown on the DFP. Changing these labels does not alter existing saved records.</div>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <DraftField label="Aircraft" value={pool.settings?.aircraftLabel || getAircraftTypeDisplayLabel(pool.aircraftTypeCode)} disabled={!canEditResourcePools} onCommit={(value) => updateResourcePoolSettings(index, { aircraftLabel: value })} />
                        <DraftField label="Simulator" value={pool.settings?.ftdLabel || 'FTD'} disabled={!canEditResourcePools} onCommit={(value) => updateResourcePoolSettings(index, { ftdLabel: value })} />
                        <DraftField label="Procedural Trainer" value={pool.settings?.cptLabel || 'CPT'} disabled={!canEditResourcePools} onCommit={(value) => updateResourcePoolSettings(index, { cptLabel: value })} />
                      </div>
                    </div>

                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className={resourceSectionPanelTitleClass}>{pool.settings?.aircraftLabel || 'Aircraft'} Numbering</div>
                          <div className={resourceSectionPanelHintClass}>Controls how tail numbers are saved to completion records and logbooks.</div>
                        </div>
                        <ToggleField
                          label="Use prefix"
                          checked={aircraftNumberSettings.usePrefix}
                          disabled={!canEditResourcePools}
                          onChange={(checked) => updateResourcePoolSettings(index, { aircraftNumberUsePrefix: checked })}
                        />
                      </div>
                      {aircraftNumberSettings.usePrefix ? (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                          <SelectField
                            label="Default Prefix"
                            value={aircraftNumberSettings.defaultPrefix}
                            disabled={!canEditResourcePools}
                            options={aircraftNumberSettings.prefixes}
                            onChange={(value) => updateResourcePoolSettings(index, { aircraftNumberDefaultPrefix: value })}
                          />
                          <div className="grid gap-2">
                            {aircraftNumberSettings.prefixes.map((prefix, prefixIndex) => (
                              <div key={`aircraft-number-prefix-${prefixIndex}`} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <DraftField
                                  label={`Prefix ${prefixIndex + 1}`}
                                  value={prefix}
                                  disabled={!canEditResourcePools}
                                  onCommit={(value) => updateAircraftNumberPrefix(index, prefixIndex, value)}
                                />
                                <button
                                  type="button"
                                  disabled={!canEditResourcePools || aircraftNumberSettings.prefixes.length <= 1}
                                  onClick={() => removeAircraftNumberPrefix(index, prefixIndex)}
                                  className="h-[38px] rounded-md border border-gray-600 bg-gray-950 px-3 text-xs font-bold text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              disabled={!canEditResourcePools}
                              onClick={() => addAircraftNumberPrefix(index)}
                              className="w-fit rounded-md border border-gray-500 bg-gray-300 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add Prefix
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-400">
                          Prefixes are off. Aircraft numbers will be entered as plain numbers.
                        </div>
                      )}
                    </div>

                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className={resourceSectionPanelTitleClass}>{pool.settings?.aircraftLabel || 'Aircraft'} Configurations</div>
                          <div className={resourceSectionPanelHintClass}>Aircraft fit states that LMP events may require. Events default to ANY when configuration does not matter.</div>
                        </div>
                        <button
                          type="button"
                          disabled={!canEditResourcePools}
                          onClick={() => addAircraftConfiguration(index)}
                          className="rounded-md border border-gray-500 bg-gray-300 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add Config
                        </button>
                      </div>
                      {aircraftConfigurations.length === 0 ? (
                        <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-400">
                          No configured aircraft states. LMP events will show ANY only.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {aircraftConfigurations.map((aircraftConfig, configIndex) => {
                            const isBaseConfig = aircraftConfig.id === 'CONFIG-0';
                            return (
                              <div key={aircraftConfig.id || configIndex} className="grid items-end gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
                                <div className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-black text-cyan-100">
                                  {aircraftConfig.label}
                                </div>
                                <DraftField
                                  label="Definition"
                                  value={aircraftConfig.definition}
                                  disabled={!canEditResourcePools || isBaseConfig}
                                  onCommit={(value) => updateAircraftConfiguration(index, configIndex, value)}
                                />
                                <button
                                  type="button"
                                  disabled={!canEditResourcePools || isBaseConfig}
                                  onClick={() => removeAircraftConfiguration(index, configIndex)}
                                  className="h-[38px] rounded-md border border-gray-600 bg-gray-950 px-3 text-xs font-bold text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isBaseConfig ? 'Base' : 'Delete'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={resourceSectionPanelClass}>
                      <div className={resourceSectionPanelHeaderClass}>
                        <div>
                          <div className={resourceSectionPanelTitleClass}>DFP Resource Rows</div>
                          <div className={resourceSectionPanelHintClass}>These row counts drive the DFP resource columns. Saved changes apply from tomorrow forward.</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <NumberField label="Aircraft" value={editableDfpRows.aircraft} disabled={!canEditResourcePools} onChange={(value) => updateResourcePoolSettings(index, { aircraft: value })} />
                        <NumberField label="Simulator" value={editableDfpRows.ftd} disabled={!canEditResourcePools} onChange={(value) => updateResourcePoolSettings(index, { ftd: value })} />
                        <NumberField label="Trainer" value={editableDfpRows.cpt} disabled={!canEditResourcePools} onChange={(value) => updateResourcePoolSettings(index, { cpt: value })} />
                        <NumberField label="STBY" value={editableDfpRows.standby} disabled={!canEditResourcePools} onChange={(value) => updateResourcePoolSettings(index, { standby: value })} />
                        <NumberField label="Ground" value={editableDfpRows.ground} disabled={!canEditResourcePools} onChange={(value) => updateResourcePoolSettings(index, { ground: value })} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </section>

      <section id="platform-unit-modules" className={getSectionClass('platform-unit-modules')}>
        <SectionHeader
          title="Unit Modules"
          subtitle="Choose which app modules each unit can use."
          action={renderSectionEditSaveButton('platform-unit-modules')}
        />
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Unit</th>
                {config.modules.map((module) => <th key={module.code} className="px-3 py-2">{module.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleUnitRows.map(({ unit }) => (
                <tr id={`platform-unit-modules-${getSettingsFocusAnchor(unit.code)}`} key={unit.code} className="border-t border-gray-700">
                  <td className="px-3 py-2 font-semibold text-white">{unit.name}</td>
                  {config.modules.map((module) => {
                    const unitModuleIndex = config.unitModules.findIndex((item) => item.unitCode === unit.code && item.moduleCode === module.code);
                    const unitModule = config.unitModules[unitModuleIndex];
                    return (
                      <td key={module.code} className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={unitModule?.isEnabled !== false}
                          disabled={!canEditSection('platform-unit-modules')}
                          onChange={(event) => {
                            if (unitModuleIndex >= 0) {
                              updateRow('unitModules', unitModuleIndex, { isEnabled: event.target.checked });
                              return;
                            }
                            setConfig((prev) => ({
                              ...prev,
                              unitModules: [...prev.unitModules, { unitCode: unit.code, moduleCode: module.code, isEnabled: event.target.checked, settings: {} }],
                            }));
                          }}
                          className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="platform-settings-visibility" className={getSectionClass('platform-settings-visibility')}>
        <SectionHeader
          title="Settings Visibility"
          subtitle="Control which settings records are shown to users. This is visibility only; it does not remove or stop loading settings."
          action={renderSectionEditSaveButton('platform-settings-visibility')}
        />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.75fr)_minmax(360px,1.25fr)]">
              <ToggleField
                label="Limit Settings Display"
                checked={settingsVisibilityPolicy.enabled}
                disabled={!canEditSection('platform-settings-visibility')}
                onChange={(checked) => updateSettingsVisibilityPolicy({
                  enabled: checked,
                  filters: checked && settingsVisibilityPolicy.filters.length === 0 ? ['unit'] : settingsVisibilityPolicy.filters,
                })}
                info="Turn this on when normal users should see only settings records relevant to selected context filters. This does not remove, unload, or block any settings data."
              />
              <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <span>Display Filters</span>
                  <InfoHint text="Select one or more filters. When multiple filters are selected, scoped records must match the selected context combination, such as aircraft type within the current location. Universal settings remain visible." />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {SETTINGS_VISIBILITY_FILTERS.map((option) => {
                    const checked = settingsVisibilityPolicy.filters.includes(option.value);
                    const disabled = !canEditSection('platform-settings-visibility') || !settingsVisibilityPolicy.enabled;
                    return (
                      <label
                        key={option.value}
                        className={`flex min-h-[76px] items-start gap-3 rounded border px-3 py-2 transition ${
                          checked
                            ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-50'
                            : 'border-gray-700 bg-gray-900/70 text-gray-300'
                        } ${disabled ? 'opacity-55' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => toggleSettingsVisibilityFilter(option.value, event.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-gray-400">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded border border-gray-700 bg-gray-950/60 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/80">Current Display Policy</div>
              <p className="mt-1 text-sm leading-relaxed text-gray-200">
                {settingsVisibilityPolicy.enabled
                  ? `Users will see settings for ${
                    settingsVisibilityPolicy.filters.length > 0
                      ? settingsVisibilityPolicy.filters
                        .map((filter) => SETTINGS_VISIBILITY_FILTERS.find((option) => option.value === filter)?.label || filter)
                        .join(' + ')
                      : 'no filters selected'
                  }.`
                  : 'Settings visibility is not limited. Users see the full settings catalogue allowed by their permissions.'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                This only changes what users see on the Settings pages. It does not delete settings, turn settings off, or stop the app from using saved configuration. Settings that apply to the whole organisation will still be shown.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h5 className="text-sm font-bold text-white">Applied Filter Context</h5>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricPill label="Unit Context" value={activeSettingsVisibilityUnitCodes.join(' + ') || activeUnitCode || 'No active unit'} />
              <MetricPill label="Location" value={activeSettingsVisibilityLocationCode || 'No active location'} />
              <MetricPill label="Aircraft Type" value={activeSettingsVisibilityAircraftTypes.join(', ') || 'No aircraft type'} />
              <MetricPill
                label="Parent Organisation"
                value={activeSettingsVisibilityParentOrgCode || 'No parent organisation'}
              />
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <h5 className="text-sm font-bold text-amber-100">What This Filter Can Hide</h5>
            <div className="mt-2 grid gap-2 text-xs leading-relaxed text-amber-50/75 md:grid-cols-2">
              <div className="rounded border border-amber-400/20 bg-gray-950/50 p-3">
                The filter can hide settings that clearly belong to another unit, location, aircraft type, or parent organisation.
              </div>
              <div className="rounded border border-amber-400/20 bg-gray-950/50 p-3">
                Shared organisation-wide settings stay visible because they may affect more than one unit or the wider platform.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform-deployment-readiness" className={getSectionClass('platform-deployment-readiness')}>
        <SectionHeader
          title="Deployment Readiness"
          subtitle="Record readiness for SaaS, defence network, fully offline and hybrid deployments."
          action={renderSectionEditSaveButton('platform-deployment-readiness')}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Deployment Mode</div>
              <div className="mt-2 text-lg font-bold text-white">{deploymentProfile.mode}</div>
            </div>
            <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Licence Validation</div>
              <div className="mt-2 text-lg font-bold text-white">{deploymentProfile.validationMethod}</div>
            </div>
            <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Enforcement</div>
              <div className="mt-2 text-lg font-bold text-white">{deploymentProfile.enforcementMode}</div>
            </div>
            <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Readiness</div>
              <div className="mt-2 text-lg font-bold text-white">{readinessPercent}%</div>
              <div className="mt-2 h-2 rounded-full bg-gray-950">
                <div
                  className="h-2 rounded-full bg-cyan-400"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div id="platform-deployment-profile" className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div>
                <h5 className="text-sm font-bold text-white">Deployment Profile</h5>
                <p className="mt-1 text-xs text-gray-400">
                  Describes how this installation is expected to run and how the licence will be checked.
                </p>
              </div>
              <span className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
                Safe mode: monitor first
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <SelectField label="Operating Model" value={deploymentProfile.mode} disabled={!canEditSection('platform-deployment-readiness')} options={DEPLOYMENT_MODE_OPTIONS} onChange={(value) => updateDeploymentProfile({ mode: value })} />
              <SelectField label="Licence Validation Method" value={deploymentProfile.validationMethod} disabled={!canEditSection('platform-deployment-readiness')} options={LICENSE_VALIDATION_OPTIONS} onChange={(value) => updateDeploymentProfile({ validationMethod: value })} />
              <SelectField label="Licence Enforcement Mode" value={deploymentProfile.enforcementMode} disabled={!canEditSection('platform-deployment-readiness')} options={LICENSE_ENFORCEMENT_OPTIONS} onChange={(value) => updateDeploymentProfile({ enforcementMode: value })} />
              <NumberField label="Offline Grace Days" value={Number(deploymentProfile.offlineGraceDays ?? 30)} disabled={!canEditSection('platform-deployment-readiness')} onChange={(value) => updateDeploymentProfile({ offlineGraceDays: value })} />
              <NumberField label="Licence Check Interval Hours" value={Number(deploymentProfile.checkIntervalHours ?? 24)} disabled={!canEditSection('platform-deployment-readiness')} onChange={(value) => updateDeploymentProfile({ checkIntervalHours: value })} />
              <SelectField label="Authentication Model" value={deploymentProfile.authModel} disabled={!canEditSection('platform-deployment-readiness')} options={AUTH_MODEL_OPTIONS} onChange={(value) => updateDeploymentProfile({ authModel: value })} />
              <DraftField label="Data Residence" value={deploymentProfile.dataResidence || ''} disabled={!canEditSection('platform-deployment-readiness')} onCommit={(value) => updateDeploymentProfile({ dataResidence: value })} />
              <DraftField label="Network Posture" value={deploymentProfile.networkPosture || ''} disabled={!canEditSection('platform-deployment-readiness')} onCommit={(value) => updateDeploymentProfile({ networkPosture: value })} />
              <DraftTextAreaField label="Deployment Notes" value={deploymentProfile.notes || ''} disabled={!canEditSection('platform-deployment-readiness')} onCommit={(value) => updateDeploymentProfile({ notes: value })} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h5 className="text-sm font-bold text-white">Offline And On-Prem Readiness Checklist</h5>
              <InfoHint text="Use these checks to confirm the responsibilities for offline or private-network operation before the system is installed on a defence network." />
              <span className="ml-auto text-xs font-semibold text-gray-400">
                {readinessCompleteCount} of {DEPLOYMENT_READINESS_ITEMS.length} complete
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {DEPLOYMENT_READINESS_ITEMS.map((item) => (
                <label key={item.id} className="flex items-start gap-3 rounded border border-gray-700 bg-gray-950 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                    checked={deploymentReadiness[item.id] === true}
                    disabled={!canEditSection('platform-deployment-readiness')}
                    onChange={(event) => toggleDeploymentReadiness(item.id, event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-bold text-white">{item.label}</span>
                    <span className="mt-1 block text-xs text-gray-400">{item.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-operational-runbook" className={getSectionClass('platform-operational-runbook')}>
        <SectionHeader
          title="Operational Runbook"
          subtitle="Deployment evidence for support, backups, restore testing, updates and accreditation. This gives an on-prem or offline customer a clear administration record without exposing secrets."
          action={renderSectionEditSaveButton('platform-operational-runbook')}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-100/70">Environment</div>
              <div className="mt-2 text-lg font-bold text-white">{operationalRunbook.environmentName || 'Not set'}</div>
              <div className="mt-1 text-xs text-sky-100/70">{operationalRunbook.releaseChannel || 'Release channel not set'}</div>
            </div>
            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-100/70">Support Owner</div>
              <div className="mt-2 text-lg font-bold text-white">{operationalRunbook.supportOwner || 'Not set'}</div>
              <div className="mt-1 truncate text-xs text-sky-100/70">{operationalRunbook.supportContact || 'Support contact not set'}</div>
            </div>
            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-100/70">Last Restore Test</div>
              <div className="mt-2 text-lg font-bold text-white">{formatDateLabel(operationalRunbook.lastRestoreTestDate)}</div>
              <div className="mt-1 text-xs text-sky-100/70">RTO {operationalRunbook.restoreTimeObjectiveHours}h / RPO {operationalRunbook.restorePointObjectiveHours}h</div>
            </div>
            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-100/70">Ops Readiness</div>
              <div className="mt-2 text-lg font-bold text-white">{operationalReadinessPercent}%</div>
              <div className="mt-2 h-2 rounded-full bg-gray-950">
                <div
                  className="h-2 rounded-full bg-sky-400"
                  style={{ width: `${operationalReadinessPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div id="platform-operational-runbook-identity" className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-bold text-white">Environment Identity</h5>
                  <InfoHint text={OPERATIONAL_RUNBOOK_SECTION_HELP.environmentIdentity} />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Identify which deployed environment this is, who owns support, and who approves operational changes.
                </p>
              </div>
              <span className="ml-auto rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-100">
                Non-secret admin record
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <DraftField label="Environment Name" value={operationalRunbook.environmentName || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ environmentName: value })} />
              <DraftField label="Deployment Identifier" value={operationalRunbook.deploymentIdentifier || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ deploymentIdentifier: value })} />
              <SelectField label="Release Channel" value={operationalRunbook.releaseChannel || 'Production'} disabled={!canEditSection('platform-operational-runbook')} options={RELEASE_CHANNEL_OPTIONS} onChange={(value) => updateOperationalRunbook({ releaseChannel: value })} />
              <DraftField label="Support Owner" value={operationalRunbook.supportOwner || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ supportOwner: value })} />
              <DraftField label="Support Contact" value={operationalRunbook.supportContact || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ supportContact: value })} />
              <DraftField label="Approving Authority" value={operationalRunbook.approvingAuthority || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ approvingAuthority: value })} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-bold text-white">Backup And Restore</h5>
                <InfoHint text={OPERATIONAL_RUNBOOK_SECTION_HELP.backupRestore} />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Record where backups live, how long they are retained, and when a restore was last proven.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <SelectField label="Backup Frequency" value={operationalRunbook.backupFrequency || 'Daily'} disabled={!canEditSection('platform-operational-runbook')} options={BACKUP_FREQUENCY_OPTIONS} onChange={(value) => updateOperationalRunbook({ backupFrequency: value })} />
              <NumberField label="Backup Retention Days" value={Number(operationalRunbook.backupRetentionDays ?? 30)} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ backupRetentionDays: value })} />
              <DraftField label="Backup Storage Location" value={operationalRunbook.backupStorageLocation || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ backupStorageLocation: value })} />
              <DateField label="Last Backup Date" value={operationalRunbook.lastBackupDate || ''} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ lastBackupDate: value })} />
              <DateField label="Last Restore Test Date" value={operationalRunbook.lastRestoreTestDate || ''} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ lastRestoreTestDate: value })} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="RTO Hours" value={Number(operationalRunbook.restoreTimeObjectiveHours ?? 24)} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ restoreTimeObjectiveHours: value })} />
                <NumberField label="RPO Hours" value={Number(operationalRunbook.restorePointObjectiveHours ?? 24)} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ restorePointObjectiveHours: value })} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-bold text-white">Update, Evidence And Accreditation</h5>
                <InfoHint text={OPERATIONAL_RUNBOOK_SECTION_HELP.updateEvidenceAccreditation} />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Record when updates may be applied, who approves them, where evidence exports are stored, and the current accreditation posture.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <DraftField label="Maintenance Window" value={operationalRunbook.maintenanceWindow || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ maintenanceWindow: value })} />
              <DraftField label="Update Approval Process" value={operationalRunbook.updateApprovalProcess || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ updateApprovalProcess: value })} />
              <DateField label="Last Update Date" value={operationalRunbook.lastUpdateDate || ''} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ lastUpdateDate: value })} />
              <DraftField label="Evidence Export Path" value={operationalRunbook.evidenceExportPath || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ evidenceExportPath: value })} />
              <NumberField label="Audit Retention Years" value={Number(operationalRunbook.auditRetentionYears ?? 7)} disabled={!canEditSection('platform-operational-runbook')} onChange={(value) => updateOperationalRunbook({ auditRetentionYears: value })} />
              <SelectField label="Accreditation Status" value={operationalRunbook.accreditationStatus || 'Not started'} disabled={!canEditSection('platform-operational-runbook')} options={ACCREDITATION_STATUS_OPTIONS} onChange={(value) => updateOperationalRunbook({ accreditationStatus: value })} />
              <DraftTextAreaField label="Operational Notes" value={operationalRunbook.notes || ''} disabled={!canEditSection('platform-operational-runbook')} onCommit={(value) => updateOperationalRunbook({ notes: value })} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h5 className="text-sm font-bold text-white">Operational Checks</h5>
              <InfoHint text="These checks summarise the runbook fields and show whether key deployment records are complete." />
              <span className="ml-auto text-xs font-semibold text-gray-400">
                {operationalCompleteCount} of {operationalSignals.length} complete
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {operationalSignals.map((signal) => (
                <div key={signal.label} className={`rounded border p-3 ${signal.complete ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-yellow-600/40 bg-yellow-900/20'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${signal.complete ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                    <span className="text-sm font-bold text-white">{signal.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{signal.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
            <h5 className="text-sm font-bold text-white">Non-secret Deployment Manifest</h5>
            <p className="mt-1 text-xs text-sky-100/80">
              Support teams can inspect a safe manifest at <span className="font-mono text-white">/api/platform-deployment/manifest</span>. It reports deployment posture, readiness status, counts and warnings, but no database URLs, tokens or secrets.
            </p>
          </div>
        </div>
      </section>

      <section id="platform-licensing" className={getSectionClass('platform-licensing')}>
        <SectionHeader
          title="Licensing & Deployment"
          subtitle="Manage licence records, deployment limits and signed licence files."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-licensing')}
              <button type="button" onClick={addLicense} disabled={!canEditSection('platform-licensing')} className={platformActionButtonClass}>
                <span className="text-[9px] leading-tight">Add<br />Licence</span>
              </button>
            </div>
          ) : null}
        />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr,1fr]">
              <div>
                <h5 className="text-sm font-bold text-white">Licence Status</h5>
                <p className="mt-1 text-xs text-cyan-100/80">
                  {licenseStatus?.message || 'Licence status has not loaded yet.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <MetricPill label="Mode" value={licenseStatus?.runtimeMode || 'development'} />
                <MetricPill label="Enforcement" value={licenseStatus?.enforcementMode || deploymentProfile.enforcementMode} />
                <MetricPill label="Signed" value={String(licenseStatus?.verifiedLicenseCount ?? 0)} />
                <MetricPill label="Unsigned Dev" value={String(licenseStatus?.unsignedLicenseCount ?? config.licenses.length)} />
              </div>
              <div className="rounded border border-cyan-400/30 bg-gray-950 px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Deployment Fingerprint</div>
                <div className="mt-1 break-all font-mono text-sm font-bold text-white">{licenseStatus?.deploymentFingerprint || 'Not available'}</div>
                <div className="mt-1 text-xs text-cyan-100/70">
                  Public key: {licenseStatus?.publicKeyConfigured ? 'configured' : 'not configured'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-bold text-white">Signed Licence File</h5>
                <p className="mt-1 text-xs text-gray-400">
                  Paste a signed offline licence file here to verify it against this deployment, then import it if valid. Private signing keys are never stored in the app.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={verifySignedLicense}
                  disabled={licenseActionLoading || !licenseImportText.trim()}
                  className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  onClick={importSignedLicense}
                  disabled={!canEditSection('platform-licensing') || licenseActionLoading || !licenseImportText.trim()}
                  className="rounded border border-cyan-500 bg-cyan-500 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
            <textarea
              className={`${fieldClass} min-h-[110px] font-mono text-xs`}
              value={licenseImportText}
              onBeforeInput={(event) => handleEditableTextBeforeInput(event, updateLicenseImportDraft)}
              onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, updateLicenseImportDraft)}
              onKeyDown={stopEditableKeyPropagation}
              onChange={(event) => updateLicenseImportDraft(event.target.value)}
              placeholder='Paste signed licence JSON, for example {"schema":"dfp-neo-license/v1",...}'
              disabled={!canEditSection('platform-licensing') && !licenseImportText}
            />
            {licenseImportMessage && (
              <div className="mt-3 rounded border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-100">{licenseImportMessage}</div>
            )}
            {licenseImportError && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{licenseImportError}</div>
            )}
          </div>

          {config.licenses.length === 0 && (
            <div className="rounded border border-yellow-600/40 bg-yellow-900/20 px-3 py-3 text-sm text-yellow-100">
              No licence records exist yet. Add one before introducing licence enforcement.
            </div>
          )}
          <div id="platform-license-records" className="space-y-4">
          {config.licenses.map((license, index) => {
            const moduleCodes = Array.isArray(license.moduleCodes) ? license.moduleCodes : [];
            const licenceFeatures = license.features || {};
            const licenceStatus = getLicenceStatusSummary(license);
            const signatureStatus = licenseStatus?.licenseSummaries?.find((summary) => (
              summary.id === license.id || summary.licenseKey === license.licenseKey
            ));
            const licensedActiveModuleCount = moduleCodes.filter((code: string) => (
              activeModules.some((module) => module.code === code)
            )).length;
            const offlineMode = ['Fully Offline', 'Hybrid Offline Sync'].includes(license.deploymentMode || '');
            return (
              <div key={license.id || `platform-license-${index}`} className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <div className="mb-4 grid gap-3 xl:grid-cols-[1fr,230px,230px,230px]">
                  <div>
                    <h5 className="text-sm font-bold text-white">{formatCommercialLicenceDisplayName(license)}</h5>
                    <p className="mt-1 text-xs text-gray-400">
                      {license.licenseKey || 'No licence key'} / {license.deploymentMode || 'Deployment model not set'}
                    </p>
                  </div>
                  <div className={`rounded border px-3 py-2 ${licenceStatus.toneClass}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Licence Status</div>
                    <div className="mt-1 text-base font-bold">{licenceStatus.label}</div>
                    <div className="mt-1 text-xs opacity-80">{licenceStatus.detail}</div>
                  </div>
                  <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/70">Module Coverage</div>
                    <div className="mt-1 text-base font-bold">{licensedActiveModuleCount} of {activeModules.length}</div>
                    <div className="mt-1 text-xs text-cyan-100/70">
                      {offlineMode && !license.offlineFingerprint ? 'Offline fingerprint still required' : 'Entitlements recorded'}
                    </div>
                  </div>
                  <div className={`rounded border px-3 py-2 ${
                    signatureStatus?.signatureState === 'VERIFIED'
                      ? 'border-green-500/40 bg-green-500/10 text-green-100'
                      : signatureStatus?.signatureState === 'UNSIGNED_CONFIGURATION'
                        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
                        : 'border-red-500/40 bg-red-500/10 text-red-100'
                  }`}>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Signed File</div>
                    <div className="mt-1 text-base font-bold">{signatureStatus?.signatureState || 'Unknown'}</div>
                    <div className="mt-1 text-xs opacity-80">{signatureStatus?.signatureDetail || 'No licence verification result.'}</div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <DraftField label="Licence Name" value={license.licenseName || ''} disabled={!canEditSection('platform-licensing')} onCommit={(value) => updateRow('licenses', index, { licenseName: value })} />
                  <DraftField label="Licence Key" value={license.licenseKey || ''} disabled={!canEditSection('platform-licensing')} onCommit={(value) => updateRow('licenses', index, { licenseKey: value })} />
                  <SelectField label="Organisation" value={license.organisationCode || config.organisations[0]?.code || 'DEFAULT'} disabled={!canEditSection('platform-licensing')} options={config.organisations.map((org) => org.code)} onChange={(value) => updateRow('licenses', index, { organisationCode: value })} />
                  <SelectField label="Deployment Model" value={license.deploymentMode || 'Online SaaS'} disabled={!canEditSection('platform-licensing')} options={['Online SaaS', 'Private Defence Network', 'Fully Offline', 'Hybrid Offline Sync']} onChange={(value) => updateRow('licenses', index, { deploymentMode: value })} />
                  <SelectField label="Status" value={license.status || 'ACTIVE'} disabled={!canEditSection('platform-licensing')} options={['ACTIVE', 'SUSPENDED', 'EXPIRED', 'INACTIVE']} onChange={(value) => updateRow('licenses', index, { status: value })} />
                  <DraftField label="Offline Fingerprint" value={license.offlineFingerprint || ''} disabled={!canEditSection('platform-licensing')} onCommit={(value) => updateRow('licenses', index, { offlineFingerprint: value })} />
                  <DateField label="Valid From" value={license.validFrom || ''} disabled={!canEditSection('platform-licensing')} onChange={(value) => updateRow('licenses', index, { validFrom: value })} />
                  <DateField label="Valid Until" value={license.validUntil || ''} disabled={!canEditSection('platform-licensing')} onChange={(value) => updateRow('licenses', index, { validUntil: value })} />
                  <OptionalNumberField label="Max Users" value={license.maxUsers ?? null} disabled={!canEditSection('platform-licensing')} onChange={(value) => updateRow('licenses', index, { maxUsers: value })} />
                  <OptionalNumberField label="Max Units" value={license.maxUnits ?? null} disabled={!canEditSection('platform-licensing')} onChange={(value) => updateRow('licenses', index, { maxUnits: value })} />
                  <OptionalNumberField label="Max Aircraft Types" value={license.maxAircraftTypes ?? null} disabled={!canEditSection('platform-licensing')} onChange={(value) => updateRow('licenses', index, { maxAircraftTypes: value })} />
                  <DraftTextAreaField label="Notes" value={license.notes || ''} disabled={!canEditSection('platform-licensing')} onCommit={(value) => updateRow('licenses', index, { notes: value })} />
                </div>

                <div className="mt-4 rounded border border-cyan-500/25 bg-cyan-500/10 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <h6 className="text-xs font-bold uppercase tracking-wide text-cyan-100">Licence Controls</h6>
                    <InfoHint text="These controls describe how the licence should behave for each deployment model. Use Monitor Only when you want to review licence status without blocking users." />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-4">
                    <SelectField
                      label="Validation Method"
                      value={licenceFeatures.validationMethod || deploymentProfile.validationMethod}
                      disabled={!canEditSection('platform-licensing')}
                      options={LICENSE_VALIDATION_OPTIONS}
                      onChange={(value) => updateLicenseFeatures(index, { validationMethod: value })}
                    />
                    <SelectField
                      label="Enforcement Mode"
                      value={normaliseEnforcementMode(licenceFeatures.enforcementMode || deploymentProfile.enforcementMode)}
                      disabled={!canEditSection('platform-licensing')}
                      options={LICENSE_ENFORCEMENT_OPTIONS}
                      onChange={(value) => updateLicenseFeatures(index, { enforcementMode: value })}
                    />
                    <NumberField
                      label="Offline Grace Days"
                      value={Number(licenceFeatures.offlineGraceDays ?? deploymentProfile.offlineGraceDays ?? 30)}
                      disabled={!canEditSection('platform-licensing')}
                      onChange={(value) => updateLicenseFeatures(index, { offlineGraceDays: value })}
                    />
                    <ToggleField
                      label="Allow offline operation"
                      checked={licenceFeatures.allowOfflineOperation === true}
                      disabled={!canEditSection('platform-licensing')}
                      onChange={(checked) => updateLicenseFeatures(index, { allowOfflineOperation: checked })}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded border border-gray-700 bg-gray-950 p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h6 className="text-xs font-bold uppercase tracking-wide text-gray-300">Licensed Modules</h6>
                    <InfoHint text="Select the modules covered by this licence. Signed licences can be enforced when the deployment is configured to do so." />
                    <span className="ml-auto text-xs text-gray-400">{moduleCodes.length} selected</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {config.modules.map((module) => (
                      <label key={module.code} className="flex items-start gap-2 rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                          checked={moduleCodes.includes(module.code)}
                          disabled={!canEditSection('platform-licensing')}
                          onChange={(event) => toggleLicenseModule(index, module.code, event.target.checked)}
                        />
                        <span>
                          <span className="block font-semibold text-white">{module.name}</span>
                          <span className="mt-1 block text-xs text-gray-400">{module.code}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </section>

      <section id="platform-permission-profiles" className={getSectionClass('platform-permission-profiles')}>
        <SectionHeader
          title="Permission Profiles"
          subtitle="Build reusable role profiles. Profiles define what a user can do; access scopes define where they can do it."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-permission-profiles')}
              <button type="button" onClick={addPermissionProfile} disabled={!canEditSection('platform-permission-profiles')} className={platformActionButtonClass}>
                <span className="text-[9px] leading-tight">Add<br />Profile</span>
              </button>
            </div>
          ) : null}
        />
        <div className="grid gap-4 p-4 xl:grid-cols-[340px,1fr]">
          <div className="space-y-2">
            {permissionProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedProfileId(profile.id)}
                className={`w-full rounded border px-4 py-3 text-left ${selectedPermissionProfile?.id === profile.id ? 'border-cyan-400 bg-cyan-500/20' : 'border-gray-700 bg-gray-900 hover:bg-gray-950'}`}
              >
                <div className="text-sm font-bold text-white">{profile.name}</div>
                <div className="mt-1 text-xs text-gray-400">{profile.permissions.length} permissions</div>
              </button>
            ))}
          </div>
          {selectedPermissionProfile && (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <DraftField label="Profile Name" value={selectedPermissionProfile.name} disabled={!canEditSection('platform-permission-profiles')} onCommit={(value) => updatePermissionProfile(selectedPermissionProfile.id, { name: value })} />
                <DraftField label="Description" value={selectedPermissionProfile.description} disabled={!canEditSection('platform-permission-profiles')} onCommit={(value) => updatePermissionProfile(selectedPermissionProfile.id, { description: value })} />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {PERMISSION_CATALOG.map((group) => (
                  <div key={group.group} className="rounded border border-gray-700 bg-gray-950 p-3">
                    <h5 className="text-sm font-bold text-cyan-100">{group.group}</h5>
                    <div className="mt-3 space-y-2">
                      {group.items.map(([permissionId, label]) => {
                        const checked = selectedPermissionProfile.permissions.includes(permissionId);
                        return (
                          <label key={permissionId} className="flex items-start gap-2 text-sm text-gray-200">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                              checked={checked}
                              disabled={!canEditSection('platform-permission-profiles')}
                              onChange={(event) => {
                                const permissions = event.target.checked
                                  ? Array.from(new Set([...selectedPermissionProfile.permissions, permissionId]))
                                  : selectedPermissionProfile.permissions.filter((id) => id !== permissionId);
                                updatePermissionProfile(selectedPermissionProfile.id, { permissions });
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="platform-training-report-template" className={getSectionClass('platform-training-report-template')}>
        <SectionHeader
          title="Training Reports"
          subtitle="Configure the organisation training report name, field labels, grade display and repeat rules. The layout stays consistent across operational models."
          action={renderTrainingReportTemplateAction()}
        />
        <div className="space-y-5 p-4">
          {!canEdit ? (
            <div className="rounded border border-yellow-600/50 bg-yellow-900/30 px-3 py-2 text-sm text-yellow-100">
              Training Report settings are read-only. Super Admin or Admin permission is required to edit the template.
            </div>
          ) : !trainingReportTemplateUnlocked ? (
            <div className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50/80">
              Training Report settings are locked. Press Edit before changing report names, field labels, grade text or repeat rules.
            </div>
          ) : null}
          <div id="platform-unit-training-report-template" className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-sky-100">Unit Training Report Template</h4>
                <p className="mt-1 text-sm text-sky-100/70">
                  These settings rename and configure the active unit report layout. Core dimensions and descriptor phrases come from this unit's Scoring Matrix.
                </p>
              </div>
              {renderTrainingReportTemplateAction()}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-gray-950/50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <FieldLabel
                  label="Active Unit Training Report"
                  info="Training Report settings are saved against this unit. If the unit has no custom settings yet, it uses the organisation template."
                />
                <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-50">
                  {activeTrainingReportUnitLabel}
                </div>
              </div>
              <div className="min-w-[260px] flex-1">
                <FieldLabel
                  label="Sync From Unit"
                  info="Select another unit to copy its Training Report template and Scoring Matrix into the active unit. This does not change the source unit."
                />
                <select
                  className={fieldClass}
                  value={trainingReportSyncUnitCode}
                  disabled={!canEditTrainingReportTemplate || trainingReportSyncOptions.length === 0}
                  onChange={(event) => setTrainingReportSyncUnitCode(event.target.value)}
                >
                  <option value="">Select source unit...</option>
                  {trainingReportSyncOptions.map((unit) => (
                    <option key={unit.code} value={unit.code}>{unit.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!canEditTrainingReportTemplate || !trainingReportSyncUnitCode || saving || applyingChanges}
                onClick={syncTrainingReportSettingsFromUnit}
                className={platformActionButtonClass}
              >
                Sync Settings
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">
              Sync includes the report name, module labels, grade scale, repeat rules and scoring matrix phrase bank.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Field
              label="Generic Form Name"
              value={trainingReportNameDrafts.genericName ?? trainingReportTemplate.genericName}
              disabled={!canEditTrainingReportTemplate}
              maxLength={TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH}
              onChange={(value) => updateTrainingReportNameDraft('genericName', value, TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH)}
              onFocus={() => beginTrainingReportNameDraft('genericName')}
              onBlur={(finalValue?: string) => commitTrainingReportNameDraft('genericName', finalValue)}
              info="Generic form name used across models. Example: Training Report."
            />
            <Field
              label="Organisation Form Name"
              value={trainingReportNameDrafts.displayName ?? trainingReportTemplate.displayName}
              disabled={!canEditTrainingReportTemplate}
              maxLength={TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH}
              onChange={(value) => updateTrainingReportNameDraft('displayName', value, TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH)}
              onFocus={() => beginTrainingReportNameDraft('displayName')}
              onBlur={(finalValue?: string) => commitTrainingReportNameDraft('displayName', finalValue)}
              info="Customer-specific name. Example: Training Report, Grade Form or Assessment."
            />
            <div>
              <FieldLabel
                label="Grade Scale"
                info="Set the lowest and highest numeric grades available on training reports. The numbers still control ordering and repeat rules even when grade numbers are hidden from display."
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  max={Math.max(0, trainingReportTemplate.grades.scaleMax - 1)}
                  step={1}
                  value={trainingReportTemplate.grades.scaleMin}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(event) => updateTrainingReportGradeScale({ scaleMin: Number(event.target.value) })}
                  aria-label="Grade scale low end"
                />
                <input
                  className={fieldClass}
                  type="number"
                  min={trainingReportTemplate.grades.scaleMin + 1}
                  max={10}
                  step={1}
                  value={trainingReportTemplate.grades.scaleMax}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(event) => updateTrainingReportGradeScale({ scaleMax: Number(event.target.value) })}
                  aria-label="Grade scale high end"
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-gray-500">
                <span>Low end</span>
                <span>High end</span>
              </div>
            </div>
            <ToggleField
              label="Include No Grade option"
              checked={trainingReportTemplate.grades.includeDemo}
              disabled={!canEditTrainingReportTemplate}
              onChange={(checked) => updateTrainingReportTemplate((template) => ({
                grades: {
                  ...template.grades,
                  includeDemo: checked,
                },
              }))}
              info="Adds a selectable non-numeric No Grade option alongside the numeric assessment grades."
            />
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-950/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-200">Modules & Field Labels</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Rename only</span>
                {renderTrainingReportTemplateAction()}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded border border-gray-700 bg-gray-900/60 p-3">
                <Field
                  label="Overview Module"
                  {...getTrainingReportTextDraftProps('module:overview:title', trainingReportTemplate.modules.overview.title)}
                  disabled={!canEditTrainingReportTemplate}
                  maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                  info="Renames the module that displays the event identity, date, timing, resource and assessor context."
                />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Object.entries(trainingReportTemplate.modules.overview.fields).map(([key, value]) => (
                    <Field
                      key={key}
                      label={humaniseFieldKey(key)}
                      {...getTrainingReportTextDraftProps(`field:overview:${key}`, value)}
                      disabled={!canEditTrainingReportTemplate}
                      maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                      info={TRAINING_REPORT_OVERVIEW_FIELD_INFO[key] || 'Renames this overview field in the training report.'}
                    />
                  ))}
                </div>
                <TrainingReportModulePreview title={trainingReportTemplate.modules.overview.title}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.event} value="AA1" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.training} value="Air to Air" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.type} value="Flight" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.timing} value="08:00 / 1.2h" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.resource} value={getAircraftTypeDisplayLabel(trainingReportPreviewAircraftTypeCode)} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.callsign} value={trainingReportPreviewCallsign} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.unit} value={trainingReportPreviewUnitCode} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.date} value="07 Jun 26" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overview.fields.assessor} value="SQNLDR Burns" />
                  </div>
                </TrainingReportModulePreview>
              </div>

              <div className="rounded border border-gray-700 bg-gray-900/60 p-3">
                <Field
                  label="Overall Module"
                  {...getTrainingReportTextDraftProps('module:overallAssessment:title', trainingReportTemplate.modules.overallAssessment.title)}
                  disabled={!canEditTrainingReportTemplate}
                  maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                  info="Renames the module that captures completion result, whole-event grade, pass/fail outcome and ground school assessment."
                />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Object.entries(trainingReportTemplate.modules.overallAssessment.fields).map(([key, value]) => (
                    <Field
                      key={key}
                      label={humaniseFieldKey(key)}
                      {...getTrainingReportTextDraftProps(`field:overallAssessment:${key}`, value)}
                      disabled={!canEditTrainingReportTemplate}
                      maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                      info={TRAINING_REPORT_OVERALL_FIELD_INFO[key] || 'Renames this overall assessment field in the training report.'}
                    />
                  ))}
                </div>
                <TrainingReportModulePreview title={trainingReportTemplate.modules.overallAssessment.title}>
                  <div className="grid gap-3 md:grid-cols-4">
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overallAssessment.fields.result} value={trainingReportTemplate.completionResults.filter((option) => option.enabled !== false).map((option) => option.label).join(' / ') || 'Complete'} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overallAssessment.fields.overallGrade} value={trainingReportTemplate.grades.showNumbers ? '7 - Very Good' : 'Very Good'} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overallAssessment.fields.overallResult} value={`${trainingReportTemplate.overallResults.passLabel} / ${trainingReportTemplate.overallResults.failLabel}`} />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.overallAssessment.fields.groundSchoolAssessment} value="Assessment / 85%" />
                  </div>
                </TrainingReportModulePreview>
              </div>

              <div className="rounded border border-gray-700 bg-gray-900/60 p-3">
                <Field
                  label="Comments Module"
                  {...getTrainingReportTextDraftProps('module:comments:title', trainingReportTemplate.modules.comments.title)}
                  disabled={!canEditTrainingReportTemplate}
                  maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                  info="Renames the narrative module used for assessor notes, weather/context, profile notes and the overall narrative."
                />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Object.entries(trainingReportTemplate.modules.comments.fields).map(([key, value]) => (
                    <Field
                      key={key}
                      label={humaniseFieldKey(key)}
                      {...getTrainingReportTextDraftProps(`field:comments:${key}`, value)}
                      disabled={!canEditTrainingReportTemplate}
                      maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                      info={TRAINING_REPORT_COMMENT_FIELD_INFO[key] || 'Renames this narrative field in the training report.'}
                    />
                  ))}
                </div>
                <TrainingReportModulePreview title={trainingReportTemplate.modules.comments.title}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.assessor} value="SQNLDR Burns" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.weather} value="VMC, light turbulence" />
                    <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.nest} value="NEST 2" />
                    <div className="md:col-span-3">
                      <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.profile} value="Profile narrative appears here." />
                    </div>
                    <div className="md:col-span-3">
                      <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.overall} value="Overall assessment narrative appears here." />
                    </div>
                    <div className="md:col-span-3">
                      <TrainingReportPreviewCell label={trainingReportTemplate.modules.comments.fields.notes} value="Model-specific notes appear here." />
                    </div>
                  </div>
                </TrainingReportModulePreview>
              </div>

              <div className="rounded border border-gray-700 bg-gray-900/60 p-3">
                <Field
                  label="Assessment Matrix Module"
                  {...getTrainingReportTextDraftProps('module:assessmentMatrix:title', trainingReportTemplate.modules.assessmentMatrix.title)}
                  disabled={!canEditTrainingReportTemplate}
                  maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                  info="Assessment categories and descriptors remain controlled by the Scoring Matrix."
                />
                <TrainingReportModulePreview title={trainingReportTemplate.modules.assessmentMatrix.title}>
                  <div className="space-y-3">
                    <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Core Dimensions</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {['Airmanship', 'Preparation', 'Technique'].map((dimension) => (
                          <div key={dimension} className="rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-100">
                            {dimension}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs leading-relaxed text-gray-400">
                      Descriptors and phrases are edited in Settings - Training & Standards - Scoring Matrix.
                    </div>
                  </div>
                </TrainingReportModulePreview>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-950/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-200">Results & Grades</h4>
              {renderTrainingReportTemplateAction()}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {trainingReportTemplate.completionResults.map((option) => {
                const optionEnabled = option.enabled !== false;
                return (
                  <div key={option.code} className={`rounded border p-3 transition ${optionEnabled ? 'border-gray-700 bg-gray-900/50' : 'border-gray-800 bg-gray-950/45 opacity-60'}`}>
                    <div className="mb-2 flex justify-end">
                      <label className={canEditTrainingReportTemplate ? 'cursor-pointer' : 'cursor-not-allowed'}>
                        <span className="sr-only">{option.code}</span>
                        <input
                          type="checkbox"
                          checked={optionEnabled}
                          disabled={!canEditTrainingReportTemplate}
                          onChange={(event) => updateTrainingReportCompletionResult(option.code, { enabled: event.target.checked })}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-950 accent-sky-500"
                        />
                      </label>
                    </div>
                    <Field
                      label={{
                        DCO: 'Completed Status Label',
                        DPCO: 'Partially Completed Status Label',
                        DNCO: 'Not Completed Status Label',
                      }[option.code]}
                      {...getTrainingReportTextDraftProps(`completion:${option.code}:label`, optionEnabled ? option.label : '')}
                      disabled={!canEditTrainingReportTemplate || !optionEnabled}
                      maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                      info={{
                        DCO: 'The visible status label for a completed event. The wording can change, while the system keeps the completed-event function intact.',
                        DPCO: 'The visible status label for a partially completed event. Use this when the event occurred but did not fully satisfy the planned requirement.',
                        DNCO: 'The visible status label for an event that was not completed. The wording can change, while the system keeps the not-completed function intact.',
                      }[option.code]}
                    />
                  </div>
                );
              })}
              <Field
                label="Satisfactory Label"
                {...getTrainingReportTextDraftProps('overall:passLabel', trainingReportTemplate.overallResults.passLabel)}
                disabled={!canEditTrainingReportTemplate}
                maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                info="Text displayed when the assessment outcome is satisfactory. Organisations may use wording such as Satisfactory, Competent, Achieved or Pass."
              />
              <Field
                label="Unsatisfactory Label"
                {...getTrainingReportTextDraftProps('overall:failLabel', trainingReportTemplate.overallResults.failLabel)}
                disabled={!canEditTrainingReportTemplate}
                maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                info="Text displayed when the assessment outcome is unsatisfactory. Organisations may use wording such as Unsatisfactory, Not Yet Competent, Not Achieved or Fail."
              />
              <div className="flex flex-col lg:row-span-2">
                <FieldLabel
                  label="Grade Display"
                  info="Choose whether report grade tiles show the numeric grade with its descriptor, or descriptor text only."
                />
                <div className="grid flex-1 grid-cols-1 gap-2 rounded border border-gray-700 bg-gray-900/50 p-2">
                  {[
                    { label: 'Number & Descriptor', showNumbers: true },
                    { label: 'Descriptor Only', showNumbers: false },
                  ].map((option) => (
                    <label
                      key={option.label}
                      className={`flex min-h-[42px] cursor-pointer items-center justify-start gap-2 rounded border px-3 py-2 text-left text-xs font-bold uppercase tracking-wide transition ${
                        trainingReportTemplate.grades.showNumbers === option.showNumbers
                          ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                          : 'border-gray-700 bg-gray-950/70 text-gray-400 hover:border-gray-500'
                      } ${!canEditTrainingReportTemplate ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="training-report-grade-display"
                        checked={trainingReportTemplate.grades.showNumbers === option.showNumbers}
                        disabled={!canEditTrainingReportTemplate}
                        onChange={() => updateTrainingReportTemplate((template) => ({
                          grades: {
                            ...template.grades,
                            showNumbers: option.showNumbers,
                          },
                        }))}
                        className="h-4 w-4 flex-shrink-0 border-gray-500 bg-gray-600 accent-cyan-400"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Field
                label="Repeated Low-performance"
                labelNoWrap
                {...getTrainingReportTextDraftProps('overall:doubleRepeatLabel', trainingReportTemplate.overallResults.doubleRepeatLabel)}
                disabled={!canEditTrainingReportTemplate}
                maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                info="Text shown when a configured repeat rule forces the event into a repeat or fail state."
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-2">
                      <span className="flex items-center gap-1.5">Grade <InfoHint text="The underlying numeric grade used for ordering and repeat-rule logic. The visible number can be hidden from users." /></span>
                    </th>
                    <th className="px-2 py-2">
                      <span className="flex items-center gap-1.5">Display Text <InfoHint text="The word or phrase shown beside, or instead of, the numeric grade." /></span>
                    </th>
                    <th className="px-2 py-2">
                      <span className="flex items-center gap-1.5">Repeat Event <InfoHint text="When selected, this grade means the event must be repeated." /></span>
                    </th>
                    <th className="px-2 py-2">
                      <span className="flex items-center gap-1.5">Use For Two In A Row <InfoHint text={`Select this grade if two consecutive reports with this grade should trigger ${trainingReportTemplate.overallResults.doubleRepeatLabel}. Currently selected grades: ${consecutiveRepeatGradeSummary}.`} /></span>
                    </th>
                    <th className="px-2 py-2">
                      <span className="flex items-center gap-1.5">Use For Two In Three <InfoHint text={`Select this grade if two reports with this grade inside a three-event window should trigger ${trainingReportTemplate.overallResults.doubleRepeatLabel}. Currently selected grades: ${rollingWindowRepeatGradeSummary}.`} /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trainingReportTemplate.grades.options.map((option) => (
                    <tr key={option.value} className="border-t border-gray-800">
                      <td className="px-2 py-2 font-bold text-white">{option.value}</td>
                      <td className="px-2 py-2">
                        <input
                          className={fieldClass}
                          value={trainingReportTextDrafts[`grade:${option.value}:label`] ?? option.label}
                          disabled={!canEditTrainingReportTemplate}
                          maxLength={TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH}
                          onFocus={() => beginTrainingReportTextDraft(`grade:${option.value}:label`, option.label)}
                          onBlur={(event) => commitTrainingReportTextDraft(`grade:${option.value}:label`, event.currentTarget.value)}
                          onBeforeInput={(event) => handleEditableTextBeforeInput(event, (value) => updateTrainingReportTextDraft(`grade:${option.value}:label`, value), TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH)}
                          onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, (value) => updateTrainingReportTextDraft(`grade:${option.value}:label`, value), TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH)}
                          onKeyDown={stopEditableKeyPropagation}
                          onChange={(event) => updateTrainingReportTextDraft(`grade:${option.value}:label`, event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                          checked={option.requiresRepeat}
                          disabled={!canEditTrainingReportTemplate}
                          onChange={(event) => updateTrainingReportGrade(option.value, { requiresRepeat: event.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                          checked={trainingReportTemplate.repeatRules.consecutive.grades.includes(option.value)}
                          disabled={!canEditTrainingReportTemplate}
                          onChange={(event) => toggleTrainingReportRuleGrade('consecutive', option.value, event.target.checked)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
                          checked={trainingReportTemplate.repeatRules.rollingWindow.grades.includes(option.value)}
                          disabled={!canEditTrainingReportTemplate}
                          onChange={(event) => toggleTrainingReportRuleGrade('rollingWindow', option.value, event.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-950/40 p-4">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-200">Consecutive Repeat Rule</h4>
              <div className="mt-3 grid gap-3">
                <ToggleField
                  label="Enable Two In A Row Rule"
                  checked={trainingReportTemplate.repeatRules.consecutive.enabled}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(checked) => updateTrainingReportTemplate((template) => ({
                    repeatRules: {
                      ...template.repeatRules,
                      consecutive: { ...template.repeatRules.consecutive, enabled: checked },
                    },
                  }))}
                  info={`When enabled, ${trainingReportTemplate.repeatRules.consecutive.count} consecutive reports with any selected grade will trigger ${trainingReportTemplate.overallResults.doubleRepeatLabel}. Selected grades: ${consecutiveRepeatGradeSummary}.`}
                />
                <NumberField
                  label="Count"
                  value={trainingReportTemplate.repeatRules.consecutive.count}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(value) => updateTrainingReportTemplate((template) => ({
                    repeatRules: {
                      ...template.repeatRules,
                      consecutive: { ...template.repeatRules.consecutive, count: value },
                    },
                  }))}
                  info={`How many reports in a row must receive one of the selected grades before the repeat rule applies. Selected grades: ${consecutiveRepeatGradeSummary}.`}
                />
                <div className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50/80">
                  Selected grades for this rule: <span className="font-bold text-cyan-50">{consecutiveRepeatGradeSummary}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-950/40 p-4">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-200">Rolling Window Repeat Rule</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ToggleField
                  label="Enable Two In Three Rule"
                  checked={trainingReportTemplate.repeatRules.rollingWindow.enabled}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(checked) => updateTrainingReportTemplate((template) => ({
                    repeatRules: {
                      ...template.repeatRules,
                      rollingWindow: { ...template.repeatRules.rollingWindow, enabled: checked },
                    },
                  }))}
                  info={`When enabled, ${trainingReportTemplate.repeatRules.rollingWindow.count} reports with any selected grade inside the last ${trainingReportTemplate.repeatRules.rollingWindow.window} events will trigger ${trainingReportTemplate.overallResults.doubleRepeatLabel}. Selected grades: ${rollingWindowRepeatGradeSummary}.`}
                />
                <NumberField
                  label="Count"
                  value={trainingReportTemplate.repeatRules.rollingWindow.count}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(value) => updateTrainingReportTemplate((template) => ({
                    repeatRules: {
                      ...template.repeatRules,
                      rollingWindow: { ...template.repeatRules.rollingWindow, count: value },
                    },
                  }))}
                  info={`How many reports inside the rolling window must receive one of the selected grades before the repeat rule applies. Selected grades: ${rollingWindowRepeatGradeSummary}.`}
                />
                <NumberField
                  label="Window"
                  value={trainingReportTemplate.repeatRules.rollingWindow.window}
                  disabled={!canEditTrainingReportTemplate}
                  onChange={(value) => updateTrainingReportTemplate((template) => ({
                    repeatRules: {
                      ...template.repeatRules,
                      rollingWindow: { ...template.repeatRules.rollingWindow, window: value },
                    },
                  }))}
                  info={`How many recent events are checked. Example: with Count 2 and Window 3, two reports with selected grades inside the last three events will trigger ${trainingReportTemplate.overallResults.doubleRepeatLabel}. Selected grades: ${rollingWindowRepeatGradeSummary}.`}
                />
                <div className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50/80 md:col-span-2">
                  Selected grades for this rule: <span className="font-bold text-cyan-50">{rollingWindowRepeatGradeSummary}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform-rank-terminology" className={getSectionClass('platform-rank-terminology')}>
        <SectionHeader
          title="Rank, Terminology & Labels"
          subtitle="Configure personnel display order, local role terminology and customer-facing report labels."
        />
        <div className="space-y-4 p-4">
          {!hasRankTerminologyEditPermission ? (
            <div className="rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-50/80">
              Rank, Terminology & Labels is read-only for your permission profile. Grant “Edit rank and terminology settings” in Permission Profiles before this section can be edited.
            </div>
          ) : !rankTerminologyUnlocked ? (
            <div className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50/80">
              Rank, Terminology & Labels is locked. Press Edit and confirm your password before changing rank order, terminology or labels.
            </div>
          ) : null}
          <div id="platform-personnel-terminology" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-700 bg-gray-950/70 p-4">
            <div>
              <h5 className="text-sm font-bold text-cyan-100">Personnel Terminology</h5>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Configure rank sorting, staff type labels, civilian titles and customer-facing report labels.
              </p>
            </div>
            {renderRankTerminologySectionAction()}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <SelectField
              label="Personnel Sort Mode"
              value={personnelDisplaySettings.sortMode}
              disabled={!canEditRankTerminology}
              options={['rank-then-name', 'alphabetical']}
              onChange={(value) => updatePersonnelDisplaySettings({ sortMode: value === 'alphabetical' ? 'alphabetical' : 'rank-then-name' })}
              info="Choose rank-then-name to sort by configured rank priority first, then surname and first name. Choose alphabetical to ignore rank and sort only by name."
            />
            <div>
              <DraftField
                label="Instructor Display Term"
                value={personnelDisplaySettings.instructorLabel}
                disabled={!canEditRankTerminology}
                onCommit={(value) => updatePersonnelDisplaySettings({ instructorLabel: value })}
                info={`The instructor display term is the duty label users see on schedules, reports and event details. The qualification label is what appears on a person's profile as something they hold. They are linked, but they are not automatically the same because one describes the duty being performed and the other describes the person's qualification. Example: a profile can show Qualification: ${linkedInstructorQualificationLabel}, while a report says ${personnelDisplaySettings.instructorLabel || 'Instructor'}: Brown, Ashley. If your organisation wants both labels to match, also rename the linked qualification in Personnel Qualifications.`}
              />
              <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
                Linked qualification label: <span className="font-semibold text-cyan-50">{linkedInstructorQualificationLabel}</span>. Rename this in{' '}
                <button
                  type="button"
                  onClick={focusLinkedInstructorQualification}
                  className="font-semibold text-cyan-200 underline decoration-cyan-300/50 underline-offset-2 hover:text-cyan-50"
                >
                  Personnel Qualifications
                </button>{' '}
                if it should match the instructor display term.
              </p>
            </div>
            <SelectField
              label="Trainee Rank Source"
              value={personnelDisplaySettings.useSeparateTraineeRankOrder ? 'Use separate trainee rank order' : 'Use staff rank order'}
              options={['Use staff rank order', 'Use separate trainee rank order']}
              disabled={!canEditRankTerminology}
              onChange={(value) => {
                const useSeparateTraineeRankOrder = value === 'Use separate trainee rank order';
                updatePersonnelDisplaySettings({
                  useSeparateTraineeRankOrder,
                  traineeRankOrder: useSeparateTraineeRankOrder ? personnelDisplaySettings.traineeRankOrder : personnelDisplaySettings.staffRankOrder,
                });
              }}
              info="Choose Use staff rank order when staff and trainees share the same rank/title priority. Choose Use separate trainee rank order if trainees need their own ordering."
            />
          </div>
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[220px] flex-1">
                <h5 className="text-sm font-bold text-cyan-100">Contractor Staff</h5>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-cyan-50/75">
                  Use this staff type for contracted or civilian personnel, then choose what event types they may be assigned to.
                </p>
              </div>
              <label className="flex min-w-[220px] items-center justify-between gap-3 rounded border border-cyan-400/20 bg-gray-950/60 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-100">Enabled</span>
                <input
                  type="checkbox"
                  checked={personnelDisplaySettings.simIpDisplayEnabled}
                  disabled={!canEditRankTerminology}
                  onChange={(event) => updatePersonnelDisplaySettings({ simIpDisplayEnabled: event.target.checked })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition ${
                    personnelDisplaySettings.simIpDisplayEnabled
                      ? 'border-cyan-400/60 bg-cyan-500/30'
                      : 'border-gray-600 bg-gray-800'
                  } ${canEditRankTerminology ? '' : 'opacity-50'}`}
                >
                  <span
                    className={`h-3.5 w-3.5 rounded-full bg-gray-100 shadow transition ${
                      personnelDisplaySettings.simIpDisplayEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </label>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.2fr)]">
              <DraftField
                label="Display Name"
                value={personnelDisplaySettings.simIpDisplayLabel}
                disabled={!canEditRankTerminology || !personnelDisplaySettings.simIpDisplayEnabled}
                onCommit={(value) => updatePersonnelDisplaySettings({ simIpDisplayLabel: value })}
                info="The staff type name users see in profiles, staff lists and scheduling views. Examples: Contractor Staff, Contract Instructor, Simulator Instructor."
              />
              <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Can Be Scheduled For
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { key: 'flight' as const, label: 'Flight' },
                  { key: 'ftd' as const, label: 'Simulator' },
                  { key: 'cpt' as const, label: 'Procedural Trainer' },
                  { key: 'ground' as const, label: 'Ground / Academic' },
                ].map((option) => {
                  const checked = personnelDisplaySettings.contractorStaffEventEligibility[option.key];
                  return (
                    <label
                      key={option.key}
                      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs font-semibold ${
                        checked
                          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                          : 'border-gray-700 bg-gray-900/70 text-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEditRankTerminology || !personnelDisplaySettings.simIpDisplayEnabled}
                        onChange={(event) => updatePersonnelDisplaySettings({
                          contractorStaffEventEligibility: {
                            ...personnelDisplaySettings.contractorStaffEventEligibility,
                            [option.key]: event.target.checked,
                          },
                        })}
                        className="h-3.5 w-3.5 rounded border-gray-500 accent-cyan-400"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  NEO Build only assigns Contractor Staff to the selected event types.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <DraftField
              label="Training Report Name"
              value={trainingReportTerminology.name}
              disabled={!canEditRankTerminology}
              maxLength={TRAINING_REPORT_NAME_MAX_LENGTH}
              onCommit={(value) => updateTrainingReportTerminology({ name: value })}
              info={`The compact organisation-specific report name used in tight spaces such as Performance History type pills. Maximum ${TRAINING_REPORT_NAME_MAX_LENGTH} characters. Default: Report. Examples: Report, Grade Form, Assessment.`}
            />
            <DraftField
              label="Continuation Training Short Label"
              value={sctTerminology.shortLabel}
              disabled={!canEditRankTerminology}
              maxLength={SCT_SHORT_LABEL_MAX_LENGTH}
              onCommit={(value) => updateSctTerminology({ shortLabel: value })}
              info="The display label for staff continuation training flights and simulator events. You may rename it to match your organisation's terminology. Changing this label only affects what users see; it does not change the underlying event type or saved event codes."
            />
            <DraftField
              label="Continuation Training Full Name"
              value={sctTerminology.longLabel}
              disabled={!canEditRankTerminology}
              maxLength={SCT_LONG_LABEL_MAX_LENGTH}
              onCommit={(value) => updateSctTerminology({ longLabel: value })}
              info={`The full display label for staff continuation training flights and simulator events. You may rename it to match your organisation's terminology. Changing this label only affects what users see; it does not change the underlying event type or saved event codes. Maximum ${SCT_LONG_LABEL_MAX_LENGTH} characters.`}
            />
          </div>
          <div id="platform-crew-position-labels" className="rounded-lg border border-orange-400/25 bg-orange-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-bold text-orange-100">Crew Position Labels</h5>
                <p className="mt-1 text-xs leading-relaxed text-orange-100/75">
                  Generic positions are the stable aircraft seat roles. Organisation labels are the words this organisation uses for those positions. Operational models control where each role appears in crew requirement dropdowns.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderRankTerminologySectionAction()}
                <button
                  type="button"
                  onClick={addCrewPositionEntry}
                  disabled={!canEditRankTerminology}
                  className={rankTerminologyButtonClass}
                >
                  Add Position
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {crewPositionTerminology.positions.map((entry) => {
                const isDefaultEntry = defaultCrewPositionIds.has(entry.id);
                return (
                  <div key={entry.id} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 lg:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(220px,1.2fr)_auto]">
                    <DraftField
                      label="Generic Position"
                      value={entry.genericName}
                      disabled={!canEditRankTerminology || isDefaultEntry}
                      onCommit={(value) => updateCrewPositionEntry(entry.id, { genericName: value })}
                      info={isDefaultEntry ? 'Baseline generic positions stay fixed so aircraft seat links remain stable.' : 'The generic position saved on aircraft seat configuration.'}
                    />
                    <DraftField
                      label="Organisation Label"
                      value={entry.label}
                      disabled={!canEditRankTerminology}
                      onCommit={(value) => updateCrewPositionEntry(entry.id, { label: value })}
                      info="The label users see when selecting crew positions. Example: Combat Systems Operator can be labelled Weapon System Operator."
                    />
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Operational Models</label>
                      <div className="grid gap-1 rounded border border-gray-700 bg-gray-900/70 p-2 sm:grid-cols-2">
                        {OPERATIONAL_MODEL_OPTIONS.map((option) => {
                          const selectedModels = entry.operationalModels?.length
                            ? entry.operationalModels
                            : OPERATIONAL_MODEL_OPTIONS.map((modelOption) => modelOption.value);
                          const isSelected = selectedModels.includes(option.value);
                          return (
                            <label
                              key={option.value}
                              className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] font-semibold ${
                                isSelected
                                  ? 'bg-cyan-500/10 text-cyan-100'
                                  : 'text-gray-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canEditRankTerminology || (isSelected && selectedModels.length <= 1)}
                                onChange={(event) => {
                                  const nextModels = event.target.checked
                                    ? Array.from(new Set([...selectedModels, option.value]))
                                    : selectedModels.filter((model) => model !== option.value);
                                  updateCrewPositionEntry(entry.id, { operationalModels: nextModels });
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-500 accent-cyan-400"
                              />
                              <span>{option.label.replace(' Model', '')}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeCrewPositionEntry(entry.id)}
                        disabled={!canEditRankTerminology}
                        className={rankTerminologyDangerButtonClass}
                        title="Remove crew position"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div id="platform-staff-qualifications" className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-bold text-emerald-100">Personnel Qualifications</h5>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
                  Define model-specific qualifications such as PIC, Crew Commander, or Operational Captain. Staff and trainee profile qualification options are drawn from this list.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderRankTerminologySectionAction()}
                <button
                  type="button"
                  onClick={addStaffQualificationEntry}
                  disabled={!canEditRankTerminology}
                  className={rankTerminologyButtonClass}
                >
                  Add Qualification
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[...staffQualificationCatalogue.qualifications]
                .sort((left, right) => (left.code || left.name).localeCompare(right.code || right.name, undefined, { sensitivity: 'base' }))
                .map((entry) => (
                <div key={entry.id} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 xl:grid-cols-[minmax(150px,1fr)_minmax(130px,0.8fr)_minmax(180px,1fr)_minmax(220px,1.2fr)_auto]">
                  <DraftField
                    inputId={`qualification-name-${String(entry.id || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                    label="Qualification"
                    value={entry.name}
                    disabled={!canEditRankTerminology}
                    onCommit={(value) => updateStaffQualificationEntry(entry.id, { name: value })}
                    info="The full qualification name shown in personnel profiles."
                  />
                  <DraftField
                    label="Code"
                    value={entry.code}
                    disabled={!canEditRankTerminology}
                    onCommit={(value) => updateStaffQualificationEntry(entry.id, { code: value })}
                    info="Short code accepted by bulk upload. Examples: PIC, Crew Commander."
                  />
                  <DraftField
                    label="Role Restrictions"
                    value={(entry.roleRestrictions || []).join(', ')}
                    disabled={!canEditRankTerminology}
                    onCommit={(value) => updateStaffQualificationEntry(entry.id, {
                      roleRestrictions: value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
                    })}
                    info="Optional comma-separated roles this qualification applies to. Leave blank for all roles."
                  />
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Operational Models</label>
                    <div className="grid gap-1 rounded border border-gray-700 bg-gray-900/70 p-2 sm:grid-cols-2">
                      {OPERATIONAL_MODEL_OPTIONS.map((option) => {
                        const selectedModels = entry.operationalModels?.length
                          ? entry.operationalModels
                          : OPERATIONAL_MODEL_OPTIONS.map((modelOption) => modelOption.value);
                        const isSelected = selectedModels.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] font-semibold ${
                              isSelected
                                ? 'bg-emerald-500/10 text-emerald-100'
                                : 'text-gray-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canEditRankTerminology || (isSelected && selectedModels.length <= 1)}
                              onChange={(event) => {
                                const nextModels = event.target.checked
                                  ? Array.from(new Set([...selectedModels, option.value]))
                                  : selectedModels.filter((model) => model !== option.value);
                                updateStaffQualificationEntry(entry.id, { operationalModels: nextModels });
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-500 accent-emerald-400"
                            />
                            <span>{option.label.replace(' Model', '')}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeStaffQualificationEntry(entry.id)}
                      disabled={!canEditRankTerminology}
                      className={rankTerminologyDangerButtonClass}
                      title="Remove qualification"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div id="platform-unit-callsigns" className="rounded-lg border border-sky-400/25 bg-sky-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-bold text-sky-100">Unit Callsigns</h5>
                <p className="mt-1 text-xs leading-relaxed text-sky-100/75">
                  Define unit callsign bases for manual scheduling. When a PIC has no individual profile callsign, the unit default is offered with a selectable sortie number.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderRankTerminologySectionAction()}
                <button
                  type="button"
                  onClick={addUnitCallsignEntry}
                  disabled={!canEditRankTerminology || config.units.length === 0}
                  className={rankTerminologyButtonClass}
                >
                  Add Callsign
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h6 className="text-xs font-bold uppercase tracking-wide text-cyan-100">Aircraft Callsign Assignment</h6>
                    <p className="mt-1 text-xs leading-relaxed text-cyan-100/70">
                      Choose whether callsigns belong to the staff member, to each flight, or are selected by the scheduler.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleUnitOptions.map((unitCode) => {
                    const policy = getUnitCallsignPolicy(unitCallsignSettings, unitCode);
                    const unit = config.units.find((candidate: any) => String(candidate.code || '').trim().toUpperCase() === unitCode);
                    const label = `${unitCode}${unit?.name && unit.name !== unitCode ? ` - ${unit.name}` : ''}`;
                    const selectedPermanentRoles = policy.permanentRoleValues || [];
                    return (
                      <div key={unitCode} className="rounded border border-cyan-300/15 bg-gray-950/50 p-3">
                        <SelectField
                          label={label}
                          value={policy.allocationMethod}
                          disabled={!canEditRankTerminology}
                          options={UNIT_CALLSIGN_ALLOCATION_METHODS}
                          optionLabels={UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS}
                          onChange={(value) => updateUnitCallsignPolicy(unitCode, { allocationMethod: value as UnitCallsignPolicy['allocationMethod'] })}
                        />
                        {policy.allocationMethod === 'permanent' && (
                          <div className="mt-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-100/80">Roles receiving permanent callsigns</div>
                            <div className="mt-2 grid gap-1.5">
                              {callsignAssignableRoleOptions.map((option) => {
                                const value = option.value.trim().toUpperCase();
                                const isChecked = selectedPermanentRoles.includes(value);
                                return (
                                  <label key={`${unitCode}-${value}`} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs font-semibold ${
                                    isChecked
                                      ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-50'
                                      : 'border-gray-700 bg-gray-950 text-gray-400'
                                  }`}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!canEditRankTerminology}
                                      onChange={() => toggleUnitCallsignPermanentRole(unitCode, option.value)}
                                      className="h-3.5 w-3.5 accent-cyan-400"
                                    />
                                    <span>{option.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="mt-2 text-[11px] leading-snug text-cyan-100/60">
                              Select one or more roles or categories. If none are selected, no individual permanent callsigns are issued.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {visibleUnitOptions.length === 0 && (
                    <div className="rounded border border-gray-700 bg-gray-950 px-3 py-4 text-sm text-gray-400">
                      No active units are available for callsign assignment.
                    </div>
                  )}
                </div>
              </div>
              {visibleUnitCallsignEntries.length === 0 && (
                <div className="rounded border border-gray-700 bg-gray-950 px-3 py-4 text-sm text-gray-400">
                  No unit callsigns configured.
                </div>
              )}
              {[...visibleUnitCallsignEntries]
                .sort((left, right) => (
                  left.unitCode.localeCompare(right.unitCode, undefined, { sensitivity: 'base' })
                  || left.callsign.localeCompare(right.callsign, undefined, { sensitivity: 'base' })
                ))
                .map((entry) => (
                  <div key={entry.id} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 md:grid-cols-[minmax(140px,0.7fr)_minmax(180px,1fr)_auto_auto]">
                    <SelectField
                      label="Unit"
                      value={entry.unitCode}
                      disabled={!canEditRankTerminology}
                      options={visibleUnitOptions}
                      onChange={(value) => updateUnitCallsignEntry(entry.id, { unitCode: value.toUpperCase(), isDefault: false })}
                    />
                    <DraftField
                      label="Callsign"
                      value={entry.callsign}
                      disabled={!canEditRankTerminology}
                      onCommit={(value) => updateUnitCallsignEntry(entry.id, { callsign: value })}
                      info="Callsign base only. The sortie number is selected when creating or editing an event."
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setDefaultUnitCallsignEntry(entry.id)}
                        disabled={!canEditRankTerminology}
                        className={`w-full rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide ${
                          entry.isDefault
                            ? 'border-green-400/50 bg-green-500/20 text-green-100'
                            : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {entry.isDefault ? 'Default' : 'Set Default'}
                      </button>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeUnitCallsignEntry(entry.id)}
                        disabled={!canEditRankTerminology}
                        className={rankTerminologyDangerButtonClass}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {onUpdateFormationCallsigns && (
            <div id="platform-formation-callsigns" className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-4">
              <FormationCallsignsSection
                callsigns={formationCallsigns}
                onUpdateCallsigns={onUpdateFormationCallsigns}
                units={visibleUnitOptions.length > 0 ? visibleUnitOptions : config.units.map((unit: any) => unit.code).filter(Boolean)}
                locations={(visibleLocationRows.length > 0 ? visibleLocationRows.map(({ location }) => location) : config.locations).map((location: any) => location.name || location.code).filter(Boolean)}
                locationOptions={(visibleLocationRows.length > 0 ? visibleLocationRows.map(({ location }) => location) : config.locations)
                  .map((location: any) => ({ name: location.name || location.code || '', code: location.code || '' }))
                  .filter((location: any) => location.name)}
                canEditSettings={canUnlockRankTerminology}
                isSettingsUnlocked={canEditRankTerminology}
                onRequestUnlock={unlockRankTerminology}
                onAuditLog={logAudit}
              />
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-violet-400/25 bg-violet-500/10 p-4">
            <div>
              <h5 className="text-sm font-bold text-violet-100">Rank Order</h5>
              <p className="mt-1 text-xs leading-relaxed text-violet-100/75">
                Maintain staff and trainee rank display priority without returning to the top of the page to unlock or save.
              </p>
            </div>
            {renderRankTerminologySectionAction()}
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h6 className="text-sm font-bold text-violet-100">Staff Rank Equivalency Table</h6>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-violet-100/75">
                    Choose a country preset or Custom, then map equivalent ranks across up to four services. The table sets staff rank display order from O-10 through E-1.
                  </p>
                </div>
                <label className="min-w-[220px] text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Rank Preset
                  <select
                    value={staffRankEquivalency.preset}
                    disabled={!canEditRankTerminology}
                    onChange={(event) => applyStaffRankPreset(event.target.value as RankEquivalencyPresetKey)}
                    className={`mt-1 w-full rounded border px-3 py-2 text-sm font-semibold ${
                      canEditRankTerminology
                        ? 'border-gray-600 bg-gray-950 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {(Object.keys(RANK_EQUIVALENCY_PRESET_LABELS) as RankEquivalencyPresetKey[]).map((preset) => (
                      <option key={preset} value={preset}>
                        {RANK_EQUIVALENCY_PRESET_LABELS[preset]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto rounded border border-gray-700">
                <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
                  <thead className="bg-gray-950 text-gray-300">
                    <tr>
                      <th className="w-[72px] border-b border-r border-gray-700 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Level</th>
                      {staffRankEquivalency.services.map((service, serviceIndex) => (
                        <th key={`service-${serviceIndex}`} className="border-b border-r border-gray-700 px-3 py-2 last:border-r-0">
                          <DraftTextInput
                            value={service.name}
                            disabled={!canEditRankTerminology}
                            onCommit={(value) => updateStaffRankServiceName(serviceIndex, value)}
                            className={`w-full rounded border px-2 py-1 text-xs font-bold ${
                              canEditRankTerminology
                                ? 'border-gray-600 bg-gray-900 text-white'
                                : 'border-gray-700 bg-gray-800 text-gray-400 cursor-not-allowed'
                            }`}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffRankEquivalency.rows.map((row, rowIndex) => (
                      <tr key={row.grade} className={row.grade.startsWith('O-') ? 'bg-gray-900/80' : 'bg-gray-950/80'}>
                        <td className="border-r border-t border-gray-700 px-3 py-2 text-center text-sm font-bold text-gray-200">{row.grade}</td>
                        {row.ranks.map((cell, serviceIndex) => (
                          <td key={`${row.grade}-${serviceIndex}`} className="border-r border-t border-gray-700 p-2 last:border-r-0">
                            <div className="grid gap-1 sm:grid-cols-[1fr_92px]">
                              <DraftTextInput
                                value={cell.rank}
                                disabled={!canEditRankTerminology}
                                placeholder="Rank"
                                onCommit={(value) => updateStaffRankCell(rowIndex, serviceIndex, 'rank', value)}
                                className={`min-w-0 rounded border px-2 py-1 text-xs ${
                                  canEditRankTerminology
                                    ? 'border-gray-600 bg-gray-900 text-white placeholder:text-gray-600'
                                    : 'border-gray-700 bg-gray-800 text-gray-400 cursor-not-allowed'
                                }`}
                              />
                              <DraftTextInput
                                value={cell.abbreviation}
                                disabled={!canEditRankTerminology}
                                placeholder="Abbrev"
                                onCommit={(value) => updateStaffRankCell(rowIndex, serviceIndex, 'abbreviation', value)}
                                className={`min-w-0 rounded border px-2 py-1 text-xs font-semibold ${
                                  canEditRankTerminology
                                    ? 'border-gray-600 bg-gray-900 text-white placeholder:text-gray-600'
                                    : 'border-gray-700 bg-gray-800 text-gray-400 cursor-not-allowed'
                                }`}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Military ranks are listed above by service and level. Civilian and contractor titles are managed separately below.
              </p>
            </div>
            <DraftTextAreaField
              label="Civilian / Contractor Titles"
              value={personnelDisplaySettings.civilianTitles.join('\n')}
              disabled={!canEditRankTerminology}
              onCommit={updateCivilianTitles}
              info="Enter one civilian or contractor title per line. These titles appear after the military rank groups and are treated as equal status for sorting."
              className="block w-[200px] max-w-[200px]"
              fieldClassName="w-[200px] max-w-[200px]"
              fieldSizingClassName="h-[150px]"
            />
            <div className="grid gap-4 lg:grid-cols-2">
            {personnelDisplaySettings.useSeparateTraineeRankOrder ? (
              <div className="space-y-3">
                <label className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm ${
                  canEditRankTerminology
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-50'
                    : 'border-gray-700 bg-gray-900/60 text-gray-400'
                }`}>
                  <span className="font-semibold">Use separate trainee rank order</span>
                  <input
                    type="checkbox"
                    checked={personnelDisplaySettings.useSeparateTraineeRankOrder}
                    disabled={!canEditRankTerminology}
                    onChange={(event) => updatePersonnelDisplaySettings({
                      useSeparateTraineeRankOrder: event.target.checked,
                      traineeRankOrder: event.target.checked ? personnelDisplaySettings.traineeRankOrder : personnelDisplaySettings.staffRankOrder,
                    })}
                    className="h-4 w-4 rounded border-gray-500 accent-cyan-500 disabled:cursor-not-allowed"
                  />
                </label>
                <DraftTextAreaField
                  label="Trainee Rank Order"
                  value={formatRankOrderText(personnelDisplaySettings.traineeRankOrder)}
                  disabled={!canEditRankTerminology}
                  onCommit={(value) => updatePersonnelDisplaySettings({ traineeRankOrder: parseRankOrderText(value) })}
                  info="Optional separate ordering for trainee ranks. Enter one display level per line, highest priority first. Use = on the same line to give ranks or titles equal status."
                />
              </div>
            ) : (
              <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-50/90">
                <label className="flex items-center justify-between gap-3">
                  <span className="font-bold text-cyan-100">Trainees use the staff rank order</span>
                  <input
                    type="checkbox"
                    checked={personnelDisplaySettings.useSeparateTraineeRankOrder}
                    disabled={!canEditRankTerminology}
                    onChange={(event) => updatePersonnelDisplaySettings({
                      useSeparateTraineeRankOrder: event.target.checked,
                      traineeRankOrder: event.target.checked ? personnelDisplaySettings.traineeRankOrder : personnelDisplaySettings.staffRankOrder,
                    })}
                    className="h-4 w-4 rounded border-gray-500 accent-cyan-500 disabled:cursor-not-allowed"
                  />
                </label>
                <p className="mt-2 leading-relaxed text-cyan-50/75">
                  Turn on the switch if trainees use a different rank structure or if the organisation wants trainees displayed differently from staff.
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      </section>

      <section id="platform-user-access" className={getSectionClass('platform-user-access')}>
        <SectionHeader
          title="User Access Context"
          subtitle="Search by user name, assign permission profiles, then define where those profiles apply."
          action={canEdit ? (
            <div className="flex flex-wrap justify-end gap-[1px]">
              {renderSectionEditSaveButton('platform-user-access')}
              <button type="button" onClick={addUserAccess} disabled={!canEditSection('platform-user-access')} className={platformActionButtonClass}>
                <span className="text-[9px] leading-tight">Add<br />Scope</span>
              </button>
            </div>
          ) : null}
        />
        <div id="platform-user-access-records" className="space-y-3 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(220px,1fr)_minmax(160px,auto)]">
              <UserSearchSelect
                label="User"
                value={selectedAccessUserId}
                disabled={!canEditSection('platform-user-access')}
                users={userOptions}
                search={userSearch}
                onSearchChange={setUserSearch}
                onChange={(value) => {
                  setSelectedAccessUserId(value);
                  setUserSearch('');
                }}
              />
              <div>
                <span className={labelClass}>Display Name</span>
                <div className="rounded border border-cyan-500/20 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                  {selectedAccessDisplayName}
                </div>
              </div>
              <div>
                <span className={labelClass}>Access Scopes</span>
                <div className="rounded border border-cyan-500/20 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                  {visibleSelectedAccessRows.length}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-cyan-100/70">
              Profiles define what the user can do. Scope fields define where those profiles apply.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3">
              <h5 className="text-sm font-bold text-white">Assigned Permission Profiles</h5>
              <p className="mt-1 text-xs text-gray-400">Tick each profile this user should receive. The same profiles apply across this user's active access scopes.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionProfiles.map((profile) => {
                const checked = selectedUserProfileIds.includes(profile.id);
                return (
                  <label key={profile.id} className="flex items-start gap-2 rounded border border-gray-700 bg-gray-950 p-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                      checked={checked}
                      disabled={!canEditSection('platform-user-access') || visibleSelectedAccessRows.length === 0}
                      onChange={(event) => {
                        const profileIds = event.target.checked
                          ? Array.from(new Set([...selectedUserProfileIds, profile.id]))
                          : selectedUserProfileIds.filter((id) => id !== profile.id);
                        setSelectedUserProfileIds(profileIds);
                      }}
                    />
                    <span>
                      <span className="block font-semibold text-white">{profile.name}</span>
                      <span className="mt-1 block text-xs text-gray-400">{profile.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {visibleSelectedAccessRows.length === 0 && (
            <div className="rounded border border-yellow-600/40 bg-yellow-900/20 px-3 py-3 text-sm text-yellow-100">
              This user has no access scopes. Add a scope before testing this account.
            </div>
          )}

          {visibleSelectedAccessRows.map(({ access, index }) => {
            const appliesToAllFeatures = !access.moduleCode;
            const scopeKey = access.id || `${access.userId}-${index}`;
            const showAdvancedFeatureArea = advancedFeatureAreaOpenByScope[scopeKey] === true;
            const accessUnit = access.unitCode
              ? config.units.find((unit) => String(unit.code || '').trim().toUpperCase() === String(access.unitCode || '').trim().toUpperCase())
              : null;
            const accessHomeLocationCode = String(access.locationCode || accessUnit?.locationCode || '').trim().toUpperCase();
            return (
              <div
                id={accessHomeLocationCode ? `platform-user-access-location-${getSettingsFocusAnchor(accessHomeLocationCode)}` : undefined}
                key={scopeKey}
                className="rounded border p-3"
                style={{
                  backgroundColor: ACCESS_SCOPE_TONE.fill,
                  borderColor: ACCESS_SCOPE_TONE.border,
                  boxShadow: `0 0 0 1px ${ACCESS_SCOPE_TONE.fill}`,
                }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h5 className="text-sm font-bold text-white">Access Scope</h5>
                  <InfoHint text="This section answers where the selected user's permission profiles apply. Example: a selected location + unit + all enabled features means the user's selected profiles apply to all enabled features for that unit at that location." />
                  <span className="ml-auto rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-gray-300">
                    {access.locationCode || 'All locations'} / {access.unitCode || 'All units'} / {appliesToAllFeatures ? 'All enabled features' : access.moduleCode}
                  </span>
                  {canEditSection('platform-user-access') && (
                    <button
                      type="button"
                      onClick={() => removeUserAccessScope(index)}
                      className="rounded border border-red-700/50 bg-red-950/40 px-2 py-1 text-xs font-bold text-red-200 hover:bg-red-900/60"
                    >
                      Delete Scope
                    </button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_0.75fr_0.85fr]">
                  <SelectField label="Organisation" value={access.organisationCode || 'DEFAULT'} disabled={!canEditSection('platform-user-access')} options={config.organisations.map((org) => org.code)} onChange={(value) => updateRow('userAccess', index, { organisationCode: value })} />
                  <SelectField label="Location" value={access.locationCode || ''} disabled={!canEditSection('platform-user-access')} options={['', ...(visibleLocationOptions.length > 0 ? visibleLocationOptions : config.locations.map((location) => location.code))]} onChange={(value) => updateRow('userAccess', index, { locationCode: value || null })} emptyLabel="All Locations" />
                  <SelectField label="Unit" value={access.unitCode || ''} disabled={!canEditSection('platform-user-access')} options={['', ...(visibleUnitOptions.length > 0 ? visibleUnitOptions : config.units.map((unit) => unit.code))]} onChange={(value) => updateRow('userAccess', index, { unitCode: value || null })} emptyLabel="All Units" />
                  <SelectField label="Administration Level" value={access.role || 'Viewer'} disabled={!canEditSection('platform-user-access')} options={['Viewer', 'Scheduler', 'Supervisor', 'Unit Admin', 'Platform Admin', 'Super Admin']} onChange={(value) => updateRow('userAccess', index, { role: value })} />
                  <SelectField label="Access" value={access.accessLevel || 'Read'} disabled={!canEditSection('platform-user-access')} options={['Read', 'Write', 'Admin']} onChange={(value) => updateRow('userAccess', index, { accessLevel: value })} />
                  <SelectField label="Status" value={access.status || 'ACTIVE'} disabled={!canEditSection('platform-user-access')} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('userAccess', index, { status: value })} />
                </div>

                <div
                  className="mt-3 rounded border p-3"
                  style={{ backgroundColor: ACCESS_SCOPE_TONE.fill, borderColor: ACCESS_SCOPE_TONE.applyBorder }}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex items-start gap-2 text-sm text-cyan-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                        checked={appliesToAllFeatures}
                        disabled={!canEditSection('platform-user-access')}
                        onChange={(event) => updateRow('userAccess', index, { moduleCode: event.target.checked ? null : (config.modules[0]?.code || '') })}
                      />
                      <span>
                        <span className="block font-bold">Apply to all enabled features for this unit</span>
                        <span className="mt-1 block text-xs text-cyan-100/70">
                          Recommended for normal administration. Platform Admin and Super Admin scopes can open all feature areas for this location/unit.
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAdvancedFeatureAreaOpenByScope((prev) => ({
                        ...prev,
                        [scopeKey]: !showAdvancedFeatureArea,
                      }))}
                      className="ml-auto rounded border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-bold text-gray-100 hover:bg-gray-700"
                    >
                      {showAdvancedFeatureArea ? 'Hide Advanced Feature Area' : 'Advanced Feature Area'}
                    </button>
                  </div>

                  {showAdvancedFeatureArea && (
                    <div className="mt-3 rounded border border-gray-700 bg-gray-950 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <h6 className="text-xs font-bold uppercase tracking-wide text-gray-300">Limit This Scope To One Feature Area</h6>
                        <InfoHint text="Use this only when a user should administer one area but not another. Example: location + unit + NEO Build lets the user work with NEO Build for that unit, but not training records or reporting." />
                      </div>
                      <SelectField label="Feature Area" value={access.moduleCode || ''} disabled={!canEditSection('platform-user-access') || appliesToAllFeatures} options={['', ...config.modules.map((module) => module.code)]} onChange={(value) => updateRow('userAccess', index, { moduleCode: value || null })} emptyLabel="All Enabled Features" />
                      <p className="mt-2 text-xs text-gray-400">
                        Leave this as all enabled features unless you deliberately want to restrict this scope to a single app area such as DFP, NEO Build, Training, or Reporting.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="platform-scheduling-rule-sets" className={getSectionClass('platform-scheduling-rule-sets')}>
        <SectionHeader
          title="Scheduling Rule Sets"
          subtitle="Create and manage scheduling rules for specific units, aircraft types, or operating areas."
          action={renderSectionEditSaveButton('platform-scheduling-rule-sets')}
        />
        <div className="space-y-5 p-4">
          <div className="rounded-lg border border-cyan-400/45 bg-cyan-500/10 p-3 shadow-[inset_4px_0_0_rgba(34,211,238,0.45)]">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200/80">Subset of Scheduling Rule Sets</div>
                <h5 className="text-sm font-bold text-cyan-100">Individual LMP Insert Event Types</h5>
                <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
                  Controls the event types available from the Individual LMP Insert Event action. Labels are capped at {INSERT_EVENT_LABEL_MAX_LENGTH} characters because they are used on schedule tiles.
                </p>
              </div>
              {canEdit && (
                <button type="button" onClick={addInsertEventType} disabled={!canEditSection('platform-scheduling-rule-sets')} className="ml-auto rounded border border-gray-500 bg-gray-300 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
                  Add Event Type
                </button>
              )}
            </div>
            <div className="space-y-3">
              {insertEventTypes.map((eventType, eventTypeIndex) => (
                <div key={`${eventType.label}-${eventTypeIndex}`} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 md:grid-cols-6">
                  <DraftField
                    label="Label"
                    value={eventType.label}
                    disabled={!canEditSection('platform-scheduling-rule-sets')}
                    maxLength={INSERT_EVENT_LABEL_MAX_LENGTH}
                    onCommit={(value) => updateInsertEventType(eventTypeIndex, { label: value })}
                  />
                  <SelectField
                    label="Build Type"
                    value={eventType.syllabusType}
                    disabled={!canEditSection('platform-scheduling-rule-sets')}
                    options={['Flight', 'FTD', 'Ground School', 'Academics']}
                    onChange={(value) => updateInsertEventType(eventTypeIndex, { syllabusType: value as InsertEventSyllabusType })}
                  />
                  <SelectField
                    label="Day/Night"
                    value={eventType.dayNight}
                    disabled={!canEditSection('platform-scheduling-rule-sets')}
                    options={['Day', 'Night', 'Day/Night']}
                    onChange={(value) => updateInsertEventType(eventTypeIndex, { dayNight: value as InsertEventDayNight })}
                  />
                  <NumberField label="Duration" value={eventType.duration} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { duration: value })} />
                  <NumberField label="Flt/Sim Hrs" value={eventType.flightOrSimHours} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { flightOrSimHours: value })} />
                  <NumberField label="Resources" value={eventType.resourceCount} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { resourceCount: Math.max(0, Math.round(value)) })} />
                  <NumberField label="Total Hrs" value={eventType.totalEventHours} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { totalEventHours: value })} />
                  <NumberField label="Pre Time" value={eventType.preFlightTime} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { preFlightTime: value })} />
                  <NumberField label="Post Time" value={eventType.postFlightTime} disabled={!canEditSection('platform-scheduling-rule-sets')} onChange={(value) => updateInsertEventType(eventTypeIndex, { postFlightTime: value })} />
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!canEditSection('platform-scheduling-rule-sets')}
                      onClick={() => removeInsertEventType(eventTypeIndex)}
                      className="h-[38px] rounded border border-gray-600 bg-gray-900 px-3 text-xs font-bold text-red-200 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {insertEventTypes.length === 0 && (
                <div className="rounded border border-gray-700 bg-gray-950 p-4 text-sm text-gray-400">
                  No Individual LMP insert event types are configured.
                </div>
              )}
            </div>
          </div>
          <div id="platform-scheduling-rule-records" className="rounded-lg border border-amber-400/30 bg-amber-500/[0.06] p-3 shadow-[inset_4px_0_0_rgba(251,191,36,0.28)]">
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-200/70">Main Rule Set Records</div>
              <h5 className="text-sm font-bold text-white">Scheduling Rule Set Records</h5>
              <p className="mt-1 text-xs leading-relaxed text-amber-50/60">
                Use these records to apply named scheduling rules to selected units, aircraft types or operating scopes.
              </p>
            </div>
            <div className="space-y-3">
              {visibleSchedulingRuleSetRows.map(({ ruleSet, index }) => (
                <div key={ruleSet.id || index} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 md:grid-cols-5">
                  <DraftField label="Name" value={ruleSet.name} disabled={!canEditSection('platform-scheduling-rule-sets')} onCommit={(value) => updateRow('schedulingRuleSets', index, { name: value })} />
                  <SelectField label="Unit" value={ruleSet.unitCode || ''} disabled={!canEditSection('platform-scheduling-rule-sets')} options={['', ...(visibleUnitOptions.length > 0 ? visibleUnitOptions : config.units.map((unit) => unit.code))]} onChange={(value) => updateRow('schedulingRuleSets', index, { unitCode: value || null })} />
                  <SelectField label="Aircraft Type" value={ruleSet.aircraftTypeCode || ''} disabled={!canEditSection('platform-scheduling-rule-sets')} options={['', ...(visibleAircraftTypeOptions.length > 0 ? visibleAircraftTypeOptions : config.aircraftTypes.map((aircraft) => aircraft.code))]} onChange={(value) => updateRow('schedulingRuleSets', index, { aircraftTypeCode: value || null })} />
                  <SelectField label="Scope" value={ruleSet.scope || 'Unit'} disabled={!canEditSection('platform-scheduling-rule-sets')} options={['Organisation', 'Location', 'Unit', 'AircraftType']} onChange={(value) => updateRow('schedulingRuleSets', index, { scope: value })} />
                  <SelectField label="Active" value={ruleSet.isActive === false ? 'No' : 'Yes'} disabled={!canEditSection('platform-scheduling-rule-sets')} options={['Yes', 'No']} onChange={(value) => updateRow('schedulingRuleSets', index, { isActive: value === 'Yes' })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const getConfigurationHealthTone = (severity: ConfigurationHealthSeverity) => {
  if (severity === 'CRITICAL') {
    return {
      badgeClass: 'border-red-500/50 bg-red-500/15 text-red-100',
      rowClass: 'border-red-500/35 bg-red-500/10',
      metricClass: 'border-red-500/40 bg-red-500/10 text-red-100',
    };
  }
  if (severity === 'WARNING') {
    return {
      badgeClass: 'border-yellow-500/50 bg-yellow-500/15 text-yellow-100',
      rowClass: 'border-yellow-500/35 bg-yellow-500/10',
      metricClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100',
    };
  }
  return {
    badgeClass: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100',
    rowClass: 'border-emerald-500/30 bg-emerald-500/10',
    metricClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  };
};

const HealthMetric = ({ label, value, severity }: { label: string; value: number; severity: ConfigurationHealthSeverity }) => {
  const tone = getConfigurationHealthTone(severity);
  return (
    <div className={`rounded-lg border p-4 ${tone.metricClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded border border-cyan-400/25 bg-gray-950 px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100/60">{label}</div>
    <div className="mt-1 truncate text-sm font-bold text-white" title={value}>{value}</div>
  </div>
);

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4"
      style={sectionHeaderStyle}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="h-11 w-1.5 shrink-0 rounded-full"
          style={sectionAccentStyle}
        />
        <div className="min-w-0">
          <h4 className="text-base font-bold text-white">{title}</h4>
          <p className="mt-1 text-sm text-gray-300">{subtitle}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

const InfoHint = ({ text }: { text: string }) => {
  const [position, setPosition] = useState<{ left: number; top: number; placement: 'above' | 'below' } | null>(null);

  const showHint = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(448, window.innerWidth - margin * 2);
    const left = Math.min(
      window.innerWidth - width - margin,
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
    );
    const shouldShowAbove = rect.bottom + 160 > window.innerHeight && rect.top > 160;
    setPosition({
      left,
      top: shouldShowAbove ? rect.top - 8 : rect.bottom + 8,
      placement: shouldShowAbove ? 'above' : 'below',
    });
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="More information"
      onMouseEnter={(event) => showHint(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => showHint(event.currentTarget)}
      onBlur={() => setPosition(null)}
      className="relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-cyan-400/35 bg-gray-950/20 text-cyan-100/60 normal-case outline-none transition-colors hover:border-cyan-300/60 hover:text-cyan-50 focus-visible:border-cyan-200 focus-visible:text-cyan-50"
    >
      <span aria-hidden="true" className="font-serif text-[11px] font-bold italic leading-none normal-case">i</span>
      {position ? (
        <span
          className="pointer-events-none fixed z-[260] whitespace-pre-line rounded border border-cyan-500/30 bg-gray-950 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-gray-100 shadow-xl"
          style={{
            left: `${position.left}px`,
            top: `${position.top}px`,
            transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
            width: 'min(28rem, calc(100vw - 1.5rem))',
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
};

const FieldLabel = ({ label, info, noWrap = false }: { label: string; info?: string; noWrap?: boolean }) => (
  <span className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
    <span className={noWrap ? 'whitespace-nowrap' : undefined}>{label}</span>
    {info ? <InfoHint text={info} /> : null}
  </span>
);

const Field = ({
  inputId,
  label,
  labelNoWrap = false,
  value,
  disabled,
  onChange,
  onFocus,
  onBlur,
  info,
  maxLength,
  commitOnBlur = true,
}: {
  inputId?: string;
  label: string;
  labelNoWrap?: boolean;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: (value: string) => void;
  info?: string;
  maxLength?: number;
  commitOnBlur?: boolean;
}) => {
  const normaliseFieldValue = (nextValue: string) => (typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue);
  const [draftValue, setDraftValue] = useState(() => normaliseFieldValue(value || ''));
  const [isEditing, setIsEditing] = useState(false);
  const displayedValue = isEditing ? draftValue : normaliseFieldValue(value || '');

  useEffect(() => {
    if (!isEditing) setDraftValue(normaliseFieldValue(value || ''));
  }, [isEditing, maxLength, value]);

  const updateDraftValue = (nextValue: string) => {
    const limitedValue = normaliseFieldValue(nextValue);
    setDraftValue(limitedValue);
    if (!commitOnBlur) onChange(limitedValue);
  };

  const commitDraftValue = () => {
    const nextValue = normaliseFieldValue(draftValue);
    setDraftValue(nextValue);
    setIsEditing(false);
    if (commitOnBlur && nextValue !== normaliseFieldValue(value || '')) onChange(nextValue);
    onBlur?.(nextValue);
  };

  return (
    <label>
      <FieldLabel label={label} info={info} noWrap={labelNoWrap} />
      <input
        id={inputId}
        className={fieldClass}
        value={displayedValue}
        disabled={disabled}
        maxLength={maxLength}
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, updateDraftValue, maxLength)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, updateDraftValue, maxLength)}
        onKeyDown={stopEditableKeyPropagation}
        onFocus={() => {
          setIsEditing(true);
          setDraftValue(normaliseFieldValue(value || ''));
          onFocus?.();
        }}
        onBlur={commitDraftValue}
        onChange={(event) => updateDraftValue(event.target.value)}
      />
      {typeof maxLength === 'number' ? (
        <span className="mt-1 block text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {displayedValue.length}/{maxLength}
        </span>
      ) : null}
    </label>
  );
};

const OffsetField = ({ label, value, disabled, onChange, listId, options = [], maxLength }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; listId?: string; options?: string[]; maxLength?: number }) => {
  const [draftValue, setDraftValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraftValue(value || '');
  }, [isEditing, value]);

  const commitDraftValue = () => {
    const nextValue = typeof maxLength === 'number' ? draftValue.slice(0, maxLength) : draftValue;
    setDraftValue(nextValue);
    setIsEditing(false);
    if (nextValue !== (value || '')) onChange(nextValue);
  };

  return (
    <label>
      <FieldLabel label={label} />
      <div className="mt-[15px]">
        <input
          className={fieldClass}
          value={draftValue}
          disabled={disabled}
          list={listId}
          maxLength={maxLength}
          onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraftValue, maxLength)}
          onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraftValue, maxLength)}
          onKeyDown={stopEditableKeyPropagation}
          onFocus={() => setIsEditing(true)}
          onBlur={commitDraftValue}
          onChange={(event) => setDraftValue(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value)}
        />
        {listId && options.length > 0 ? (
          <datalist id={listId}>
            {options.map((option) => <option key={option} value={option} />)}
          </datalist>
        ) : null}
      </div>
    </label>
  );
};

const parseCommaListFieldValue = (value: string): string[] => (
  value.split(',').map((item) => item.trim()).filter(Boolean)
);

const formatCommaListFieldValue = (value: string[]): string => (
  value.map((item) => String(item || '').trim()).filter(Boolean).join(', ')
);

const CommaListField = ({
  label,
  value,
  disabled,
  onChange,
  info,
}: {
  label: string;
  value: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
  info?: string;
}) => {
  const [draftValue, setDraftValue] = useState(() => formatCommaListFieldValue(value || []));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraftValue(formatCommaListFieldValue(value || []));
  }, [isEditing, value]);

  const commitDraftValue = () => {
    const nextValue = parseCommaListFieldValue(draftValue);
    setDraftValue(formatCommaListFieldValue(nextValue));
    onChange(nextValue);
    setIsEditing(false);
  };

  return (
    <label>
      <FieldLabel label={label} info={info} />
      <input
        className={fieldClass}
        value={draftValue}
        disabled={disabled}
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraftValue)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraftValue)}
        onKeyDown={stopEditableKeyPropagation}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={commitDraftValue}
      />
    </label>
  );
};

const AirfieldLookupField = ({
  label,
  value,
  disabled,
  getSuggestions,
  onChange,
  onSelect,
  maxLength,
}: {
  label: string;
  value: string;
  disabled: boolean;
  getSuggestions: (query: string) => AirfieldCatalogueEntry[];
  onChange: (value: string) => void;
  onSelect: (entry: AirfieldCatalogueEntry) => void;
  maxLength?: number;
}) => {
  const [draftValue, setDraftValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const suggestions = getSuggestions(draftValue);
  const showSuggestions = isOpen && !disabled && suggestions.length > 0 && String(draftValue || '').trim().length >= 2;

  useEffect(() => {
    if (!isOpen) setDraftValue(value || '');
  }, [isOpen, value]);

  const commitDraftValue = () => {
    const nextValue = typeof maxLength === 'number' ? draftValue.slice(0, maxLength) : draftValue;
    setDraftValue(nextValue);
    if (nextValue !== (value || '')) onChange(nextValue);
  };

  return (
    <label className="relative block">
      <FieldLabel label={label} />
      <input
        className={fieldClass}
        value={draftValue}
        disabled={disabled}
        autoComplete="off"
        maxLength={maxLength}
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraftValue, maxLength)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraftValue, maxLength)}
        onKeyDown={stopEditableKeyPropagation}
        onChange={(event) => setDraftValue(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          commitDraftValue();
          window.setTimeout(() => setIsOpen(false), 120);
        }}
      />
      {showSuggestions ? (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded border border-cyan-500/30 bg-gray-950 shadow-xl">
          {suggestions.map((entry, entryIndex) => (
            <button
              key={`${entry.c}-${entry.i}-${entry.l}-${entry.n}-${entry.a}-${entry.o}`}
              type="button"
              className={`block w-full border-b border-gray-800 px-3 py-2 text-left text-xs hover:bg-cyan-500/20 ${
                entryIndex === 0 ? 'bg-cyan-500/10 text-cyan-100' : 'text-gray-100'
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(entry);
                setIsOpen(false);
              }}
              title={`${entry.a}, ${entry.o} - ${entry.t}`}
            >
              <span className="block font-bold">{getAirfieldDisplayLabel(entry)}</span>
              <span className="mt-0.5 block text-[11px] text-gray-400">
                {entry.a.toFixed(4)}, {entry.o.toFixed(4)} - {entry.t}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
};

const NumberField = ({ label, value, disabled, onChange, info }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      type="number"
      value={value ?? 0}
      disabled={disabled}
      onKeyDownCapture={stopEditableKeyPropagation}
      onKeyDown={stopEditableKeyPropagation}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);

const formatDateInput = (value: string) => (value ? String(value).slice(0, 10) : '');

const DateField = ({ label, value, disabled, onChange, info }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      type="date"
      value={formatDateInput(value)}
      disabled={disabled}
      onKeyDownCapture={stopEditableKeyPropagation}
      onKeyDown={stopEditableKeyPropagation}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const OptionalNumberField = ({ label, value, disabled, onChange, info, placeholder = 'Unlimited' }: { label: string; value: number | null; disabled: boolean; onChange: (value: number | null) => void; info?: string; placeholder?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      type="number"
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      onKeyDownCapture={stopEditableKeyPropagation}
      onKeyDown={stopEditableKeyPropagation}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  </label>
);

const TasField = ({ label, value, disabled, onChange, info, placeholder = 'KTAS' }: { label: string; value: number | string | null; disabled: boolean; onChange: (value: string | null) => void; info?: string; placeholder?: string }) => {
  const normaliseTasValue = (nextValue: unknown) => String(nextValue ?? '').replace(/[^\d]/g, '').slice(0, 4);
  const [draftValue, setDraftValue] = useState(() => normaliseTasValue(value));
  const [isEditing, setIsEditing] = useState(false);
  const displayedValue = isEditing ? draftValue : normaliseTasValue(value);

  useEffect(() => {
    if (!isEditing) setDraftValue(normaliseTasValue(value));
  }, [isEditing, value]);

  const updateDraftValue = (nextValue: string) => {
    setDraftValue(normaliseTasValue(nextValue));
  };

  const commitDraftValue = () => {
    const nextValue = normaliseTasValue(draftValue);
    const currentValue = normaliseTasValue(value);
    setDraftValue(nextValue);
    setIsEditing(false);
    if (nextValue !== currentValue) onChange(nextValue || null);
  };

  return (
    <label>
      <FieldLabel label={label} info={info} />
      <input
        className={fieldClass}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayedValue}
        disabled={disabled}
        placeholder={placeholder}
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, updateDraftValue, 4)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, updateDraftValue, 4)}
        onKeyDown={stopEditableKeyPropagation}
        onFocus={() => {
          setIsEditing(true);
          setDraftValue(normaliseTasValue(value));
        }}
        onBlur={commitDraftValue}
        onChange={(event) => updateDraftValue(event.target.value)}
      />
    </label>
  );
};

const TextAreaField = ({
  label,
  value,
  disabled,
  onChange,
  onFocus,
  onBlur,
  info,
  className = 'lg:col-span-2',
  fieldClassName = 'w-full',
  fieldSizingClassName = 'min-h-[74px]',
  commitOnBlur = true,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: (value: string) => void;
  info?: string;
  className?: string;
  fieldClassName?: string;
  fieldSizingClassName?: string;
  commitOnBlur?: boolean;
}) => {
  const [draftValue, setDraftValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);
  const displayedValue = isEditing ? draftValue : value || '';

  useEffect(() => {
    if (!isEditing) setDraftValue(value || '');
  }, [isEditing, value]);

  const updateDraftValue = (nextValue: string) => {
    setDraftValue(nextValue);
    if (!commitOnBlur) onChange(nextValue);
  };

  const commitDraftValue = () => {
    setIsEditing(false);
    if (commitOnBlur && draftValue !== (value || '')) onChange(draftValue);
    onBlur?.(draftValue);
  };

  return (
    <label className={className}>
      <FieldLabel label={label} info={info} />
      <textarea
        className={`${fieldClass.replace('w-full', fieldClassName)} ${fieldSizingClassName} resize-y`}
        value={displayedValue}
        disabled={disabled}
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, updateDraftValue)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, updateDraftValue)}
        onKeyDown={stopEditableKeyPropagation}
        onFocus={() => {
          setIsEditing(true);
          setDraftValue(value || '');
          onFocus?.();
        }}
        onBlur={commitDraftValue}
        onChange={(event) => updateDraftValue(event.target.value)}
      />
    </label>
  );
};

const DraftField = ({ inputId, label, labelNoWrap = false, value, disabled, onCommit, info, maxLength }: { inputId?: string; label: string; labelNoWrap?: boolean; value: string; disabled: boolean; onCommit: (value: string) => void; info?: string; maxLength?: number }) => {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value || '');
  }, [focused, value]);

  const commitDraft = () => {
    const nextValue = typeof maxLength === 'number' ? draft.slice(0, maxLength) : draft;
    setFocused(false);
    setDraft(nextValue);
    if (nextValue !== (value || '')) onCommit(nextValue);
  };

  return (
    <Field
      inputId={inputId}
      label={label}
      labelNoWrap={labelNoWrap}
      value={focused ? draft : value}
      disabled={disabled}
      onChange={setDraft}
      onFocus={() => {
        setFocused(true);
        setDraft(value || '');
      }}
      onBlur={commitDraft}
      info={info}
      maxLength={maxLength}
      commitOnBlur={false}
    />
  );
};

const DraftTextAreaField = ({ label, value, disabled, onCommit, info, className = 'lg:col-span-2', fieldClassName = 'w-full', fieldSizingClassName = 'min-h-[74px]' }: { label: string; value: string; disabled: boolean; onCommit: (value: string) => void; info?: string; className?: string; fieldClassName?: string; fieldSizingClassName?: string }) => {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value || '');
  }, [focused, value]);

  const commitDraft = () => {
    setFocused(false);
    if (draft !== (value || '')) onCommit(draft);
  };

  return (
    <TextAreaField
      label={label}
      value={focused ? draft : value}
      disabled={disabled}
      onChange={setDraft}
      onFocus={() => {
        setFocused(true);
        setDraft(value || '');
      }}
      onBlur={commitDraft}
      info={info}
      className={className}
      fieldClassName={fieldClassName}
      fieldSizingClassName={fieldSizingClassName}
      commitOnBlur={false}
    />
  );
};

const DraftTextInput = ({ value, disabled, placeholder, className, onCommit }: { value: string; disabled: boolean; placeholder?: string; className: string; onCommit: (value: string) => void }) => {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value || '');
  }, [focused, value]);

  const commitDraft = () => {
    setFocused(false);
    if (draft !== (value || '')) onCommit(draft);
  };

  return (
    <input
      value={focused ? draft : value}
      disabled={disabled}
      placeholder={placeholder}
      data-rank-equivalency-input="true"
      onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraft)}
      onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraft)}
      onKeyDown={stopEditableKeyPropagation}
      onFocus={() => {
        setFocused(true);
        setDraft(value || '');
      }}
      onBlur={commitDraft}
      onChange={(event) => setDraft(event.target.value)}
      className={className}
    />
  );
};

const ToggleField = ({ label, checked, disabled, onChange, info }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void; info?: string }) => (
  <label className="flex items-center justify-between gap-3 rounded border border-gray-700 bg-gray-950 px-3 py-2">
    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
      <span>{label}</span>
      {info ? <InfoHint text={info} /> : null}
    </span>
    <input
      type="checkbox"
      className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  </label>
);

const SelectField = ({ label, value, disabled, options, onChange, emptyLabel = 'None', info, optionLabels = {} }: { label: string; value: string; disabled: boolean; options: string[]; onChange: (value: string) => void; emptyLabel?: string; info?: string; optionLabels?: Record<string, string> }) => (
  <label className="block min-w-0">
    <FieldLabel label={label} info={info} />
    <div className="max-w-full overflow-x-auto">
      <select
        className={`${fieldClass} block max-w-full whitespace-nowrap`}
        value={value || ''}
        disabled={disabled}
        title={optionLabels[value] || value || emptyLabel}
        onChange={(event) => onChange(event.target.value)}
      >
      {options.map((option) => <option key={option} value={option}>{optionLabels[option] || option || emptyLabel}</option>)}
      </select>
    </div>
  </label>
);

const TrainingReportPreviewCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
    <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-100">{value}</div>
  </div>
);

const TrainingReportModulePreview = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mt-4 overflow-hidden rounded-lg border-2 border-cyan-300 bg-gray-950/80 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_24px_rgba(34,211,238,0.16)]">
    <div className="flex w-full items-center justify-between bg-cyan-500 px-4 py-2">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-950">Preview</div>
        <h5 className="text-sm font-black text-cyan-950">{title}</h5>
      </div>
      <span className="rounded border border-cyan-950/30 bg-cyan-100/80 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-cyan-950">
        Live layout
      </span>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

const TimeZoneField = ({ label, value, disabled, onChange, info }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string }) => {
  const [draftValue, setDraftValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraftValue(value || '');
  }, [isEditing, value]);

  const commitDraftValue = () => {
    setIsEditing(false);
    if (draftValue !== (value || '')) onChange(draftValue);
  };

  return (
    <label>
      <FieldLabel label={label} info={info} />
      <input
        className={fieldClass}
        list="platform-iana-timezones"
        value={draftValue}
        disabled={disabled}
        placeholder="Australia/Melbourne"
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraftValue)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraftValue)}
        onKeyDown={stopEditableKeyPropagation}
        onFocus={() => setIsEditing(true)}
        onBlur={commitDraftValue}
        onChange={(event) => setDraftValue(event.target.value)}
      />
      <datalist id="platform-iana-timezones">
        {COMMON_IANA_TIMEZONES.map((timezone) => <option key={timezone} value={timezone} />)}
      </datalist>
    </label>
  );
};

const UserSearchSelect = ({
  label,
  value,
  disabled,
  users,
  search,
  onSearchChange,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  users: Array<{ id: string; name: string; username: string; email: string }>;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState(search || '');
  const query = draftSearch.trim().toLowerCase();
  const filteredUsers = users
    .filter((user) => {
      if (!query) return true;
      return [user.name, user.username, user.email].some((field) => field.toLowerCase().includes(query));
    })
    .slice(0, 30);

  useEffect(() => {
    if (!isOpen) setDraftSearch(search || '');
  }, [isOpen, search]);

  const updateSearchDraft = (nextSearch: string) => {
    setDraftSearch(nextSearch);
    onSearchChange(nextSearch);
    setIsOpen(true);
  };

  return (
    <label className="relative block">
      <span className={labelClass}>{label}</span>
      <input
        className={fieldClass}
        value={draftSearch}
        disabled={disabled}
        placeholder="Search by name..."
        autoComplete="off"
        onBeforeInput={(event) => handleEditableTextBeforeInput(event, updateSearchDraft)}
        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, updateSearchDraft)}
        onKeyDown={stopEditableKeyPropagation}
        onChange={(event) => updateSearchDraft(event.target.value)}
        onFocus={() => {
          setDraftSearch(search || '');
          setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
      />
      {isOpen && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded border border-cyan-500/30 bg-gray-950 shadow-xl">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-cyan-500/20 ${
                  user.id === value ? 'bg-cyan-500/15 text-cyan-100' : 'text-gray-100'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(user.id);
                  onSearchChange('');
                  setDraftSearch('');
                  setIsOpen(false);
                }}
              >
                <span className="block font-semibold">{user.name}</span>
                {user.username && <span className="block text-xs text-gray-400">{user.username}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-yellow-100">
              No users match that name.
            </div>
          )}
        </div>
      )}
    </label>
  );
};

export default PlatformConfigurationSettings;
