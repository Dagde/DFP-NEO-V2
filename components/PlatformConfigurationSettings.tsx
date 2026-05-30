import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PLATFORM_PERMISSION_PROFILES,
  PLATFORM_PERMISSION_CATALOG,
  type PlatformPermissionProfile,
} from '../utils/platformConfigService';
import {
  formatRankOrderText,
  normalisePersonnelDisplaySettings,
  parseRankOrderText,
  type PersonnelDisplaySettings,
} from '../utils/personnelDisplaySettings';
import {
  TRAINING_REPORT_NAME_MAX_LENGTH,
  normaliseTrainingReportTerminology,
  type TrainingReportTerminology,
} from '../utils/trainingReportTerminology';
import { normaliseAircraftNumberSettings } from '../utils/aircraftNumberFormat';
import { getAppApiBase } from '../utils/externalDataControls';
import { logAudit } from '../utils/auditLogger';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import {
  DEFAULT_INSERT_EVENT_TYPES,
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

type PlatformConfig = {
  organisations: any[];
  locations: any[];
  units: any[];
  aircraftTypes: any[];
  resourcePools: any[];
  modules: any[];
  unitModules: any[];
  licenses: any[];
  userAccess: any[];
  platformUsers: any[];
  schedulingRuleSets: any[];
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

const fieldClass = 'w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none';
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

const createClientRecordId = (prefix: string): string => (
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
);

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
  deploymentIdentifier: 'Use a stable short identifier for this deployment. Recommended format: letters, numbers and dashes, for example DFP-NEO-V2-RAAF-PROD or RAAF-ESL-OFFLINE-01.',
  releaseChannel: 'Select the update stream this system follows. Production is live use; Staging is pre-live testing; Customer Acceptance is formal customer test; Offline Package is an isolated deployment package.',
  supportOwner: 'Record who owns support for this deployment. Examples: Unit Admin Cell, Defence Prime Support Desk, 1FTS Systems Officer, or a named support team.',
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
  notes: 'Add operational notes that help future administrators understand this deployment. Do not record secrets, passwords, licence private keys, database URLs or access tokens.',
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
  return parsed.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
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

const getDefaultConfigurationHealthRemediation = (area: string, title: string): string => {
  const lowerTitle = title.toLowerCase();
  if (area === 'Organisation') {
    return 'Open Organisation and create or reactivate the operating organisation. Example: code RAAF, name RAAF, status ACTIVE.';
  }
  if (area === 'Locations') {
    if (lowerTitle.includes('organisation')) {
      return 'Open Locale Settings or Organisation & Locations, then assign the location to an active organisation or reactivate the referenced organisation.';
    }
    return 'Open Locale Settings or Organisation & Locations, then create or reactivate the location and at least one unit at that location.';
  }
  if (area === 'Units') {
    return 'Open Organisation & Locations and assign the unit to an active location, or reactivate the correct location before saving.';
  }
  if (area === 'Modules') {
    return 'Open the unit/module setup area and enable the required app areas for that unit, or deactivate unused modules if they are not required.';
  }
  if (area === 'Resource Pools') {
    if (lowerTitle.includes('no usable resources')) {
      return 'Open the Resource Pools section, enter non-zero counts for the live resources such as aircraft, simulator, procedural trainer, STBY or Ground, then save.';
    }
    if (lowerTitle.includes('live dfp')) {
      return 'Open Resource Pools and enable Apply to V2 runtime on the pool that should drive the active DFP resource rows.';
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
  return 'Open the matching Platform Configuration section, correct the referenced record, save, and recheck Configuration Health.';
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
  ) => {
    items.push({
      id: `${severity}-${idSuffix}`.replace(/\s+/g, '-').toLowerCase(),
      severity,
      area,
      title,
      detail,
      remediation: severity === 'OK' ? undefined : remediation || getDefaultConfigurationHealthRemediation(area, title),
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

  const activeOrganisationCodes = new Set(activeOrganisations.map((org) => toIdentifier(org.code)));
  const activeLocationCodes = new Set(activeLocations.map((location) => toIdentifier(location.code)));
  const activeUnitCodes = new Set(activeUnits.map((unit) => toIdentifier(unit.code)));
  const activeAircraftTypeCodes = new Set(activeAircraftTypes.map((aircraft) => toIdentifier(aircraft.code)));
  const activeModuleCodes = new Set(activeModules.map((module) => toIdentifier(module.code)));
  const userIds = new Set(config.platformUsers.flatMap((user) => uniqueValues([user.userId, user.username].map(toIdentifier))));
  const profileIds = new Set(permissionProfiles.map((profile) => toIdentifier(profile.id)));

  if (activeOrganisations.length === 0) {
    add('CRITICAL', 'Organisation', 'No active organisation', 'At least one active organisation is required before the platform can be managed as a commercial deployment.', 'organisation-none');
  } else {
    add('OK', 'Organisation', 'Active organisation exists', `${activeOrganisations.length} active organisation${activeOrganisations.length === 1 ? '' : 's'} available for configuration.`, 'organisation-active');
  }

  if (activeLocations.length === 0) {
    add('CRITICAL', 'Locations', 'No active locations', 'The location selector, staff lists and DFP schedule need at least one active location.', 'locations-none');
  } else {
    add('OK', 'Locations', 'Active locations exist', `${activeLocations.length} active location${activeLocations.length === 1 ? '' : 's'} available.`, 'locations-active');
  }

  activeLocations.forEach((location) => {
    const locationCode = toIdentifier(location.code);
    const organisationCode = toIdentifier(location.organisationCode);
    if (organisationCode && !activeOrganisationCodes.has(organisationCode)) {
      add('WARNING', 'Locations', `${locationCode} references inactive organisation`, `${locationCode} points to ${organisationCode}, which is not an active organisation.`, `location-${locationCode}-org`);
    }
    if (!hasUsableSolarLocation(location)) {
      const defaultProfile = getDefaultAirfieldSolarProfile(location.code) || getDefaultAirfieldSolarProfile(location.name);
      add(
        'WARNING',
        'Locations',
        `${locationCode} daylight data incomplete`,
        defaultProfile
          ? 'The app can currently fall back to a built-in Australian base profile, but this location should store its own latitude, longitude and IANA timezone for offline daylight calculations.'
          : 'Offline FL/LL calculation needs latitude, longitude and an IANA timezone for this location.',
        `location-${locationCode}-solar`
      );
    }
    const unitsAtLocation = activeUnits.filter((unit) => toIdentifier(unit.locationCode) === locationCode);
    if (unitsAtLocation.length === 0) {
      add('WARNING', 'Locations', `${locationCode} has no active units`, 'Users may be able to select the location, but unit-aware scheduling and access scoping will be incomplete.', `location-${locationCode}-units`);
    }
  });

  if (activeUnits.length === 0) {
    add('CRITICAL', 'Units', 'No active units', 'At least one active unit is needed for commercial unit-based configuration.', 'units-none');
  }

  activeUnits.forEach((unit) => {
    const unitCode = toIdentifier(unit.code);
    const locationCode = toIdentifier(unit.locationCode);
    if (!locationCode || !activeLocationCodes.has(locationCode)) {
      add('CRITICAL', 'Units', `${unitCode} has invalid location`, `The unit is assigned to "${locationCode || 'blank'}", which is not an active location.`, `unit-${unitCode}-location`);
    }

    const enabledModules = activeModules.filter((module) => {
      const unitModule = config.unitModules.find((item) => toIdentifier(item.unitCode) === unitCode && toIdentifier(item.moduleCode) === toIdentifier(module.code));
      return unitModule?.isEnabled !== false;
    });
    if (enabledModules.length === 0) {
      add('WARNING', 'Modules', `${unitCode} has no enabled modules`, 'The unit exists, but no active app areas are enabled for it.', `unit-${unitCode}-modules`);
    }

    const matchingPools = activeResourcePools.filter((pool) => (
      toIdentifier(pool.unitCode) === unitCode
      || (!toIdentifier(pool.unitCode) && toIdentifier(pool.locationCode) === locationCode)
    ));
    if (matchingPools.length === 0) {
      add('WARNING', 'Resource Pools', `${unitCode} has no active resource pool`, 'DFP resource counts may fall back to legacy defaults until a matching pool is configured.', `unit-${unitCode}-pools`);
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
      add('CRITICAL', 'Resource Pools', `${poolName} has invalid location`, `${poolName} points to ${locationCode}, which is not an active location.`, `pool-${poolName}-location`);
    }
    if (unitCode && !activeUnitCodes.has(unitCode)) {
      add('CRITICAL', 'Resource Pools', `${poolName} has invalid unit`, `${poolName} points to ${unitCode}, which is not an active unit.`, `pool-${poolName}-unit`);
    }
    if (aircraftTypeCode && !activeAircraftTypeCodes.has(aircraftTypeCode)) {
      add('WARNING', 'Resource Pools', `${poolName} has invalid aircraft type`, `${poolName} points to ${aircraftTypeCode}, which is not an active aircraft type.`, `pool-${poolName}-aircraft`);
    }
    if (pool.settings?.applyToV2Runtime === true) {
      const totalResources = ['aircraft', 'ftd', 'cpt', 'standby', 'ground']
        .reduce((sum, key) => sum + toNumber(pool.settings?.[key]), 0);
      if (totalResources <= 0) {
        add('CRITICAL', 'Resource Pools', `${poolName} has no usable resources`, 'This pool is wired into the V2 runtime, but all resource counts are zero or blank.', `pool-${poolName}-empty`);
      }
    }
  });

  const runtimePools = activeResourcePools.filter((pool) => pool.settings?.applyToV2Runtime === true);
  if (runtimePools.length === 0) {
    add('WARNING', 'Resource Pools', 'No pool is wired to the live DFP', 'At least one resource pool should have "Apply to V2 runtime" enabled so the DFP uses platform configuration rather than legacy defaults.', 'runtime-pool-none');
  } else if (!items.some((item) => item.area === 'Resource Pools' && item.severity === 'CRITICAL')) {
    add('OK', 'Resource Pools', 'Runtime resource pools are configured', `${runtimePools.length} active resource pool${runtimePools.length === 1 ? '' : 's'} feed the live DFP runtime.`, 'runtime-pool-active');
  }

  activeUserAccess.forEach((access) => {
    const userId = toIdentifier(access.userId);
    const userLabel = access.displayName || userId || 'Unknown user';
    const locationCode = toIdentifier(access.locationCode);
    const unitCode = toIdentifier(access.unitCode);
    const moduleCode = toIdentifier(access.moduleCode);
    const assignedProfiles = Array.isArray(access.settings?.permissionProfileIds) ? access.settings.permissionProfileIds.map(toIdentifier).filter(Boolean) : [];

    if (!userId || !userIds.has(userId)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid user record`, 'The access scope points to a user that is not present in the platform user list.', `access-${userId || userLabel}-user`);
    }
    if (locationCode && !activeLocationCodes.has(locationCode)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid location scope`, `${locationCode} is not an active location.`, `access-${userId}-${locationCode}`);
    }
    if (unitCode && !activeUnitCodes.has(unitCode)) {
      add('CRITICAL', 'User Access', `${userLabel} has invalid unit scope`, `${unitCode} is not an active unit.`, `access-${userId}-${unitCode}`);
    }
    const unit = unitCode ? config.units.find((item) => toIdentifier(item.code) === unitCode) : null;
    if (unit && locationCode && toIdentifier(unit.locationCode) !== locationCode) {
      add('CRITICAL', 'User Access', `${userLabel} has mismatched scope`, `${unitCode} belongs to ${toIdentifier(unit.locationCode)}, but the access scope is set to ${locationCode}.`, `access-${userId}-${unitCode}-mismatch`);
    }
    if (moduleCode && !activeModuleCodes.has(moduleCode)) {
      add('WARNING', 'User Access', `${userLabel} has inactive feature-area scope`, `${moduleCode} is not an active module. Use "All Enabled Features" unless a deliberate one-area restriction is required.`, `access-${userId}-${moduleCode}`);
    }
    if (assignedProfiles.length === 0) {
      add('WARNING', 'User Access', `${userLabel} has no permission profile`, 'The scope defines where the user can work, but no profile defines what they can do there.', `access-${userId}-profiles-none`);
    }
    assignedProfiles.forEach((profileId) => {
      if (!profileIds.has(profileId)) {
        add('WARNING', 'User Access', `${userLabel} has unknown permission profile`, `${profileId} is assigned but does not exist in Permission Profiles.`, `access-${userId}-profile-${profileId}`);
      }
    });
  });

  const activeUsersWithAccess = uniqueValues(activeUserAccess.map((access) => toIdentifier(access.userId)));
  if (activeUsersWithAccess.length === 0) {
    add('CRITICAL', 'User Access', 'No users have active access', 'No active user access scopes exist. Administrators may be locked out after enforcement is tightened.', 'access-none');
  } else if (!items.some((item) => item.area === 'User Access' && item.severity === 'CRITICAL')) {
    add('OK', 'User Access', 'User scopes are structurally valid', `${activeUsersWithAccess.length} user${activeUsersWithAccess.length === 1 ? '' : 's'} have active access scopes without invalid location or unit references.`, 'access-valid');
  }

  permissionProfiles.forEach((profile) => {
    if (!Array.isArray(profile.permissions) || profile.permissions.length === 0) {
      add('WARNING', 'Permission Profiles', `${profile.name || profile.id} has no permissions`, 'Users assigned this profile will not gain any capability from it.', `profile-${profile.id}-empty`);
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
      add('WARNING', 'Modules', `${moduleCode} is active but unused`, 'The module is active globally but is not enabled for any active unit.', `module-${moduleCode}-unused`);
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activeLicences.length === 0) {
    add('WARNING', 'Licensing', 'No active licence record', 'Commercial installs should have at least one active licence record, even while enforcement remains Monitor Only.', 'licence-none');
  } else {
    activeLicences.forEach((license) => {
      const licenseName = license.licenseName || license.licenseKey || 'Licence';
      const validUntil = parseDateOnly(license.validUntil);
      if (validUntil && validUntil < today) {
        add('CRITICAL', 'Licensing', `${licenseName} is expired`, `Expired on ${formatDateLabel(validUntil)}.`, `licence-${licenseName}-expired`);
      } else if (!validUntil) {
        add('WARNING', 'Licensing', `${licenseName} has no expiry date`, 'This may be acceptable for a perpetual licence, but it should be deliberate and recorded.', `licence-${licenseName}-no-expiry`);
      }
    });
    if (!items.some((item) => item.area === 'Licensing' && item.severity === 'CRITICAL')) {
      add('OK', 'Licensing', 'Active licence record exists', `${activeLicences.length} active licence record${activeLicences.length === 1 ? '' : 's'} found.`, 'licence-active');
    }
  }

  if (readinessPercent < 100) {
    add('WARNING', 'Deployment Readiness', 'Deployment checklist incomplete', `Offline and private-network readiness is ${readinessPercent}% complete.`, 'deployment-readiness');
  } else {
    add('OK', 'Deployment Readiness', 'Deployment checklist complete', 'All deployment readiness checks are recorded.', 'deployment-readiness-ok');
  }

  if (operationalReadinessPercent < 100) {
    add('WARNING', 'Operational Runbook', 'Operational runbook incomplete', `Support, backup, restore, update and evidence readiness is ${operationalReadinessPercent}% complete.`, 'runbook-readiness');
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

interface PlatformConfigurationSettingsProps {
  currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
  onShowSuccess: (message: string) => void;
  scrollTarget?: string;
  sectionOnly?: boolean;
  canUsePlatformPermission?: (permissionId: string) => boolean;
}

const PlatformConfigurationSettings: React.FC<PlatformConfigurationSettingsProps> = ({
  currentUserPermission,
  onShowSuccess,
  scrollTarget,
  sectionOnly = false,
  canUsePlatformPermission,
}) => {
  const [config, setConfig] = useState<PlatformConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [error, setError] = useState('');
  const loadedConfigRef = useRef<PlatformConfig>(emptyConfig);
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_PERMISSION_PROFILES[0].id);
  const [advancedFeatureAreaOpenByScope, setAdvancedFeatureAreaOpenByScope] = useState<Record<string, boolean>>({});
  const [rankTerminologyUnlocked, setRankTerminologyUnlocked] = useState(false);
  const [rankTerminologyDirty, setRankTerminologyDirty] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseRuntimeStatus | null>(null);
  const [licenseImportText, setLicenseImportText] = useState('');
  const [licenseImportMessage, setLicenseImportMessage] = useState('');
  const [licenseImportError, setLicenseImportError] = useState('');
  const [licenseActionLoading, setLicenseActionLoading] = useState(false);
  const [airfieldCatalogue, setAirfieldCatalogue] = useState<AirfieldCatalogueEntry[]>([]);
  const [airfieldCatalogueStatus, setAirfieldCatalogueStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [airfieldCatalogueError, setAirfieldCatalogueError] = useState('');
  const locationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingLocationScrollIdRef = useRef<string | null>(null);

  const canEdit = ['Super Admin', 'Admin'].includes(currentUserPermission);
  const hasRankTerminologyEditPermission = canUsePlatformPermission?.('settings.rankTerminology.edit') ?? canEdit;
  const canUnlockRankTerminology = canEdit && hasRankTerminologyEditPermission;
  const canEditRankTerminology = canUnlockRankTerminology && rankTerminologyUnlocked;

  const unlockRankTerminology = async () => {
    if (!canUnlockRankTerminology) return;
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
    if (!password) return;
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
        return;
      }
      setRankTerminologyUnlocked(true);
      onShowSuccess('Rank, Terminology & Labels editing unlocked.');
    } catch (err: any) {
      setError(err?.message || 'Could not verify password for Rank, Terminology & Labels editing.');
    }
  };

  const lockRankTerminology = async () => {
    if (rankTerminologyDirty) {
      const shouldSave = await showDarkConfirm(
        'You have unsaved Rank, Terminology & Labels changes.\n\nSelect OK to save and apply the changes now. Select Cancel to keep editing without locking.',
        'Unsaved Terminology Changes',
        'warning',
      );
      if (shouldSave) {
        await save();
      }
      return;
    }
    setRankTerminologyUnlocked(false);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [res, licenseRes] = await Promise.all([
          fetch(`${getApiBase()}/platform-config`),
          fetch(`${getApiBase()}/platform-license/status`),
        ]);
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = await res.json();
        const nextLicenseStatus = licenseRes.ok ? await licenseRes.json() : null;
        if (!cancelled) {
          const nextConfig = { ...emptyConfig, ...data };
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

  useEffect(() => {
    if (!scrollTarget || loading) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(scrollTarget);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollTarget, loading]);

  const enabledModuleCount = useMemo(
    () => config.unitModules.filter((item) => item.isEnabled !== false).length,
    [config.unitModules],
  );

  const activeLicenseCount = useMemo(
    () => config.licenses.filter((license) => String(license.status || '').toUpperCase() === 'ACTIVE').length,
    [config.licenses],
  );

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
  const personnelDisplaySettings = normalisePersonnelDisplaySettings(
    primaryOrganisationSettings.personnelDisplaySettings || primaryOrganisationSettings.personnelSettings || null,
  );
  const trainingReportTerminology = normaliseTrainingReportTerminology(
    primaryOrganisationSettings.trainingReportTerminology || null,
  );
  const insertEventTypes = normaliseInsertEventTypes(
    primaryOrganisationSettings.insertEventTypes || null,
  );
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

  const updatePrimaryOrganisationSettings = (
    updater: Record<string, any> | ((settings: Record<string, any>) => Record<string, any>),
  ) => {
    setConfig((prev) => {
      const organisations = prev.organisations.length > 0
        ? [...prev.organisations]
        : [{ code: 'RAAF', name: 'RAAF', status: 'ACTIVE', settings: {} }];
      const activeIndex = organisations.findIndex((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      const orgIndex = activeIndex >= 0 ? activeIndex : 0;
      const currentOrg = organisations[orgIndex] || organisations[0];
      const currentSettings = currentOrg.settings || {};
      const nextSettings = typeof updater === 'function'
        ? updater(currentSettings)
        : { ...currentSettings, ...updater };
      organisations[orgIndex] = { ...currentOrg, settings: nextSettings };
      return { ...prev, organisations };
    });
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

  const updateInsertEventTypes = (nextEventTypes: InsertEventTypeConfig[]) => {
    updatePrimaryOrganisationSettings((settings) => ({
      ...settings,
      insertEventTypes: normaliseInsertEventTypes(nextEventTypes),
    }));
  };

  const updateInsertEventType = (index: number, changes: Partial<InsertEventTypeConfig>) => {
    const next = insertEventTypes.map((eventType, eventTypeIndex) => (
      eventTypeIndex === index ? { ...eventType, ...changes } : eventType
    ));
    updateInsertEventTypes(next);
  };

  const addInsertEventType = () => {
    updateInsertEventTypes([
      ...insertEventTypes,
      {
        ...DEFAULT_INSERT_EVENT_TYPES[0],
        label: `EVT${insertEventTypes.length + 1}`.slice(0, INSERT_EVENT_LABEL_MAX_LENGTH),
      },
    ]);
  };

  const removeInsertEventType = (index: number) => {
    if (insertEventTypes.length <= 1) return;
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
    setConfig((prev) => ({
      ...prev,
      [collection]: prev[collection].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...changes } : item
      )),
    }));
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

  const addUnit = () => {
    const defaultLocation = config.locations[0]?.code || 'ESL';
    setConfig((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          code: `UNIT-${prev.units.length + 1}`,
          name: 'New Unit',
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: defaultLocation,
          unitType: 'Training',
          status: 'ACTIVE',
          settings: {},
        },
      ],
    }));
  };

  const addResourcePool = () => {
    const defaultLocation = config.locations[0]?.code || 'ESL';
    setConfig((prev) => ({
      ...prev,
      resourcePools: [
        ...prev.resourcePools,
        {
          code: `POOL-${prev.resourcePools.length + 1}`,
          name: 'New Resource Pool',
          organisationCode: prev.organisations[0]?.code || 'DEFAULT',
          locationCode: defaultLocation,
          unitCode: '',
          aircraftTypeCode: prev.aircraftTypes[0]?.code || 'PC-21',
          poolType: 'Dedicated',
          status: 'ACTIVE',
          settings: {
            applyToV2Runtime: false,
            aircraftLabel: 'PC-21',
            aircraftNumberUsePrefix: true,
            aircraftNumberPrefixes: ['A54'],
            aircraftNumberDefaultPrefix: 'A54',
            ftdLabel: 'FTD',
            cptLabel: 'CPT',
            aircraft: 24,
            ftd: 5,
            cpt: 4,
            standby: 4,
            ground: 6,
          },
        },
      ],
    }));
  };

  const addLicense = () => {
    setConfig((prev) => {
      const organisationCode = prev.organisations[0]?.code || 'DEFAULT';
      const activeModuleCodes = prev.modules
        .filter((module) => String(module.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
        .map((module) => module.code)
        .filter(Boolean);
      return {
        ...prev,
        licenses: [
          ...prev.licenses,
          {
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
            notes: 'Stage 11 deployment readiness record. Enforcement is monitor-only unless deliberately changed by the platform administrator.',
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
    return Array.isArray(profiles) && profiles.length > 0 ? profiles : DEFAULT_PERMISSION_PROFILES;
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
        : [{ code: 'DEFAULT', name: 'Default Organisation', status: 'ACTIVE', settings: {} }];
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
    () => config.platformUsers
      .map((user) => ({
        id: user.userId || user.username,
        name: displayUserName(user),
        username: user.username || user.userId || '',
        email: user.email || '',
      }))
      .filter((user) => user.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [config.platformUsers],
  );

  const selectedAccessUser = useMemo(
    () => config.platformUsers.find((user) => (user.userId || user.username) === selectedAccessUserId),
    [config.platformUsers, selectedAccessUserId],
  );

  const selectedAccessRows = useMemo(
    () => config.userAccess
      .map((access, index) => ({ access, index }))
      .filter(({ access }) => access.userId === selectedAccessUserId),
    [config.userAccess, selectedAccessUserId],
  );

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
        ...changes,
      },
    });
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

  const save = async () => {
    if (!canEdit) return;
    const solarValidationError = config.locations.map(validateSolarLocation).find(Boolean);
    if (solarValidationError) {
      setError(solarValidationError);
      return;
    }
    setSaving(true);
    setError('');
    let shouldReload = false;
    try {
      const sessionToken = localStorage.getItem('dfp_session_token');
      const res = await fetch(`${getApiBase()}/platform-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Save failed (${res.status})`);
      }
      const previousLocationMap = new Map(
        loadedConfigRef.current.locations.map((location) => [getPlatformLocationAuditKey(location), location])
      );
      const nextLocationMap = new Map(
        config.locations.map((location) => [getPlatformLocationAuditKey(location), location])
      );
      config.locations.forEach((location) => {
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
          changes: `Remaining locations: ${config.locations.map(getPlatformLocationAuditLabel).join(', ') || 'none'}`,
        });
      });
      loadedConfigRef.current = config;
      shouldReload = true;
      setApplyingChanges(true);
      onShowSuccess('Platform configuration saved. Applying changes...');
      try {
        sessionStorage.setItem('dfp_restore_view_after_reload', 'Settings');
        sessionStorage.setItem('dfp_restore_settings_section_after_reload', 'platform-configuration');
      } catch {
        // Non-critical: the configuration still saves if session storage is unavailable.
      }
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform configuration');
    } finally {
      if (!shouldReload) setSaving(false);
    }
  };

  const refreshLicenseStatus = async () => {
    const res = await fetch(`${getApiBase()}/platform-license/status`);
    if (!res.ok) throw new Error(`Licence status failed (${res.status})`);
    const data = await res.json();
    setLicenseStatus(data);
    return data;
  };

  const reloadPlatformConfig = async () => {
    const res = await fetch(`${getApiBase()}/platform-config`);
    if (!res.ok) throw new Error(`Configuration reload failed (${res.status})`);
    const data = await res.json();
    setConfig({ ...emptyConfig, ...data });
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
  const getSectionClass = (sectionId: string) =>
    `${sectionClass}${visibleSectionTarget && visibleSectionTarget !== sectionId ? ' hidden' : ''}`;
  const saveButton = (
    <button
      type="button"
      onClick={save}
      disabled={!canEdit || saving || applyingChanges}
      className="ml-auto rounded border border-gray-500 bg-gray-300 px-5 py-3 text-sm font-bold text-gray-900 shadow hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {applyingChanges ? 'Applying...' : saving ? 'Saving...' : 'Save'}
    </button>
  );

  return (
    <div className="relative space-y-8">
      {applyingChanges && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
          <div className="rounded-xl border border-cyan-400/40 bg-gray-900 px-6 py-5 text-center shadow-2xl">
            <div className="text-lg font-bold text-cyan-100">One moment while we apply your changes</div>
            <p className="mt-2 text-sm text-gray-300">The page will refresh automatically so the updated platform settings are active everywhere.</p>
          </div>
        </div>
      )}
      {sectionOnly ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm leading-relaxed text-gray-300">
              Changes on this settings page are saved into the platform configuration.
            </p>
            {saveButton}
          </div>
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
      ) : (
        <>
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-cyan-100">Platform Configuration</h3>
                <p className="mt-1 text-sm text-cyan-100/70">
                  Commercial operating model. Resource pools can now be wired into V2 runtime by exception, while existing V2 behaviour remains the default.
                </p>
              </div>
              {saveButton}
            </div>
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="Organisations" value={config.organisations.length} />
            <Metric label="Locations" value={config.locations.length} />
            <Metric label="Units" value={config.units.length} />
            <Metric label="Enabled Modules" value={enabledModuleCount} />
            <Metric label="Active Licences" value={activeLicenseCount} />
          </div>
        </>
      )}

      <section id="platform-configuration-health" className={getSectionClass('platform-configuration-health')}>
        <SectionHeader
          title="Configuration Health"
          subtitle="Advisory checks for the commercial platform model. These checks highlight setup gaps without blocking the current app."
          action={(
            <button
              type="button"
              onClick={exportConfigurationHealthReport}
              className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 shadow hover:bg-gray-200"
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
                  This is a management view for administrators. Critical items should be fixed before relying on the platform model; warnings are setup gaps or records that should be reviewed before sale, deployment, or accreditation evidence export.
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platform-organisation-locations" className={getSectionClass('platform-organisation-locations')}>
        <SectionHeader
          title="Organisation & Locations"
          subtitle="The top of the hierarchy: customer, base, timezone, and training areas."
          action={canEdit ? <button type="button" onClick={addLocation} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Location</button> : null}
        />
        <div className="space-y-4 p-4">
          {config.organisations.map((org, index) => (
            <div key={org.id || org.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-3">
              <Field label="Organisation Code" value={org.code} disabled={!canEdit} onChange={(value) => updateRow('organisations', index, { code: value })} />
              <Field label="Organisation Name" value={org.name} disabled={!canEdit} onChange={(value) => updateRow('organisations', index, { name: value })} />
              <SelectField label="Status" value={org.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('organisations', index, { status: value })} />
            </div>
          ))}
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
          {config.locations.map((location, index) => {
            const rowKey = location.id || `platform-location-${index}`;
            const codeSuggestions = getAirfieldCatalogueSuggestionsForQuery(location.code, airfieldCatalogueLookup);
            const iataSuggestions = getAirfieldCatalogueSuggestionsForQuery(location.iataCode, airfieldCatalogueLookup);
            const nameSuggestions = getAirfieldCatalogueSuggestionsForQuery(location.name, airfieldCatalogueLookup);
            return (
              <div
                key={rowKey}
                ref={(node) => { locationRowRefs.current[rowKey] = node; }}
                className="relative grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 pr-11 md:grid-cols-12"
              >
                {canEdit ? (
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
                    disabled={!canEdit}
                    maxLength={4}
                    suggestions={codeSuggestions}
                    onChange={(value) => updateLocationIdentity(index, 'code', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-2">
                  <AirfieldLookupField
                    label="IATA Code"
                    value={location.iataCode || ''}
                    disabled={!canEdit}
                    maxLength={3}
                    suggestions={iataSuggestions}
                    onChange={(value) => updateLocationIdentity(index, 'iataCode', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-5">
                  <AirfieldLookupField
                    label="Location Name"
                    value={location.name}
                    disabled={!canEdit}
                    suggestions={nameSuggestions}
                    onChange={(value) => updateLocationIdentity(index, 'name', value)}
                    onSelect={(entry) => applyKnownAirfieldToLocation(index, entry, location)}
                  />
                </div>
                <div className="md:col-span-1">
                  <NumberField label="UTC Offset" value={location.timezoneOffset ?? 10} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { timezoneOffset: value })} />
                </div>
                <div className="md:col-span-2">
                  <SelectField label="Status" value={location.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('locations', index, { status: value })} />
                </div>
                <div className="md:col-span-2">
                  <OptionalNumberField label="Latitude" value={toNullableNumber(location.latitude)} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { latitude: value })} info="Decimal degrees. South is negative." />
                </div>
                <div className="md:col-span-2">
                  <OptionalNumberField label="Longitude" value={toNullableNumber(location.longitude)} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { longitude: value })} info="Decimal degrees. West is negative." />
                </div>
                <div className="md:col-span-3">
                  <TimeZoneField label="IANA Timezone" value={location.timezone || ''} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { timezone: value })} info="Use an IANA timezone so daylight saving is handled offline, for example Australia/Melbourne." />
                </div>
                <div className="md:col-span-5">
                  <Field label="Training Areas" value={(location.trainingAreas || []).join(', ')} disabled={!canEdit} onChange={(value) => updateRow('locations', index, { trainingAreas: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="platform-units" className={getSectionClass('platform-units')}>
        <SectionHeader
          title="Units"
          subtitle="Unit is the centre of configuration: type, location, enabled modules and future UI behaviour."
          action={canEdit ? <button type="button" onClick={addUnit} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Unit</button> : null}
        />
        <div className="space-y-3 p-4">
          {config.units.map((unit, index) => (
            <div key={unit.id || unit.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-5">
              <Field label="Unit Code" value={unit.code} disabled={!canEdit} onChange={(value) => updateRow('units', index, { code: value })} />
              <Field label="Unit Name" value={unit.name} disabled={!canEdit} onChange={(value) => updateRow('units', index, { name: value })} />
              <SelectField label="Location" value={unit.locationCode || ''} disabled={!canEdit} options={config.locations.map((location) => location.code)} onChange={(value) => updateRow('units', index, { locationCode: value })} />
              <SelectField label="Unit Type" value={unit.unitType || 'Training'} disabled={!canEdit} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'HQ', 'Operational']} onChange={(value) => updateRow('units', index, { unitType: value })} />
              <SelectField label="Status" value={unit.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('units', index, { status: value })} />
            </div>
          ))}
        </div>
      </section>

      <section id="platform-resource-pools" className={getSectionClass('platform-resource-pools')}>
        <SectionHeader title="Aircraft Types & Resource Pools" subtitle="Aircraft type defines capability; resource pools define shared or dedicated aircraft, simulator, procedural trainer and ground resources." action={canEdit ? <button type="button" onClick={addResourcePool} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Pool</button> : null} />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            {config.aircraftTypes.map((aircraft, index) => (
              <div key={aircraft.id || aircraft.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-3">
                <Field label="Code" value={aircraft.code} disabled={!canEdit} onChange={(value) => updateRow('aircraftTypes', index, { code: value })} />
                <Field label="Name" value={aircraft.name} disabled={!canEdit} onChange={(value) => updateRow('aircraftTypes', index, { name: value })} />
                <SelectField label="Category" value={aircraft.category || 'Training'} disabled={!canEdit} options={['Training', 'Fighter', 'Airlift', 'Maritime', 'Rotary', 'Other']} onChange={(value) => updateRow('aircraftTypes', index, { category: value })} />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {config.resourcePools.map((pool, index) => {
              const aircraftNumberSettings = normaliseAircraftNumberSettings(pool.settings || {});
              return (
              <div key={pool.id || pool.code || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-2">
                <Field label="Pool Code" value={pool.code} disabled={!canEdit} onChange={(value) => updateRow('resourcePools', index, { code: value })} />
                <Field label="Pool Name" value={pool.name} disabled={!canEdit} onChange={(value) => updateRow('resourcePools', index, { name: value })} />
                <SelectField label="Location" value={pool.locationCode || ''} disabled={!canEdit} options={['', ...config.locations.map((location) => location.code)]} onChange={(value) => updateRow('resourcePools', index, { locationCode: value || null })} />
                <SelectField label="Owning Unit" value={pool.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('resourcePools', index, { unitCode: value || null })} />
                <SelectField label="Aircraft Type" value={pool.aircraftTypeCode || ''} disabled={!canEdit} options={['', ...config.aircraftTypes.map((aircraft) => aircraft.code)]} onChange={(value) => updateRow('resourcePools', index, { aircraftTypeCode: value || null })} />
                <SelectField label="Pool Type" value={pool.poolType || 'Dedicated'} disabled={!canEdit} options={['Dedicated', 'Shared']} onChange={(value) => updateRow('resourcePools', index, { poolType: value })} />
                <div className="grid gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3 md:col-span-2 md:grid-cols-3">
                  <div className="md:col-span-3 text-xs text-cyan-100/80">
                    Display terminology only. Existing schedule records keep stable internal resource keys.
                  </div>
                  <Field label="Aircraft Display Name" value={pool.settings?.aircraftLabel || 'PC-21'} disabled={!canEdit} onChange={(value) => updateResourcePoolSettings(index, { aircraftLabel: value })} />
                  <Field label="Simulator Display Name" value={pool.settings?.ftdLabel || 'FTD'} disabled={!canEdit} onChange={(value) => updateResourcePoolSettings(index, { ftdLabel: value })} />
                  <Field label="Procedural Trainer Display Name" value={pool.settings?.cptLabel || 'CPT'} disabled={!canEdit} onChange={(value) => updateResourcePoolSettings(index, { cptLabel: value })} />
                </div>
                <div className="grid gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3 md:col-span-2">
                  <div>
                    <div className="text-sm font-bold text-cyan-100">{pool.settings?.aircraftLabel || 'Aircraft'} Number Format</div>
                    <div className="mt-1 text-xs text-cyan-100/75">
                      Controls how post-flight tail numbers are saved to completion records and logbooks.
                    </div>
                  </div>
                  <ToggleField
                    label="Use prefix with aircraft number"
                    checked={aircraftNumberSettings.usePrefix}
                    disabled={!canEdit}
                    onChange={(checked) => updateResourcePoolSettings(index, { aircraftNumberUsePrefix: checked })}
                  />
                  {aircraftNumberSettings.usePrefix && (
                    <div className="space-y-2">
                      <SelectField
                        label="Default Prefix"
                        value={aircraftNumberSettings.defaultPrefix}
                        disabled={!canEdit}
                        options={aircraftNumberSettings.prefixes}
                        onChange={(value) => updateResourcePoolSettings(index, { aircraftNumberDefaultPrefix: value })}
                      />
                      <div className="space-y-2">
                        {aircraftNumberSettings.prefixes.map((prefix, prefixIndex) => (
                          <div key={`${prefix}-${prefixIndex}`} className="flex items-end gap-2">
                            <div className="flex-1">
                              <Field
                                label={`Prefix ${prefixIndex + 1}`}
                                value={prefix}
                                disabled={!canEdit}
                                onChange={(value) => updateAircraftNumberPrefix(index, prefixIndex, value)}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={!canEdit || aircraftNumberSettings.prefixes.length <= 1}
                              onClick={() => removeAircraftNumberPrefix(index, prefixIndex)}
                              className="h-[38px] rounded border border-gray-600 bg-gray-950 px-3 text-xs font-bold text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => addAircraftNumberPrefix(index)}
                        className="w-fit rounded border border-gray-500 bg-gray-300 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add Prefix
                      </button>
                    </div>
                  )}
                </div>
                <ToggleField
                  label="Apply to V2 runtime"
                  checked={pool.settings?.applyToV2Runtime === true}
                  disabled={!canEdit}
                  onChange={(checked) => updateResourcePoolSettings(index, { applyToV2Runtime: checked })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Aircraft Rows" value={pool.settings?.aircraft ?? 24} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { aircraft: value })} />
                  <NumberField label="Simulator Rows" value={pool.settings?.ftd ?? 5} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { ftd: value })} />
                  <NumberField label="Procedural Trainer Rows" value={pool.settings?.cpt ?? 4} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { cpt: value })} />
                  <NumberField label="STBY" value={pool.settings?.standby ?? 4} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { standby: value })} />
                  <NumberField label="Ground" value={pool.settings?.ground ?? 6} disabled={!canEdit || pool.settings?.applyToV2Runtime !== true} onChange={(value) => updateResourcePoolSettings(index, { ground: value })} />
                </div>
              </div>
            )})}
          </div>
        </div>
      </section>

      <section id="platform-unit-modules" className={getSectionClass('platform-unit-modules')}>
        <SectionHeader title="Unit Modules" subtitle="Controls which functional modules each unit can use. This is the future licensing and role-aware UI switchboard." />
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-950 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Unit</th>
                {config.modules.map((module) => <th key={module.code} className="px-3 py-2">{module.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {config.units.map((unit) => (
                <tr key={unit.code} className="border-t border-gray-700">
                  <td className="px-3 py-2 font-semibold text-white">{unit.name}</td>
                  {config.modules.map((module) => {
                    const unitModuleIndex = config.unitModules.findIndex((item) => item.unitCode === unit.code && item.moduleCode === module.code);
                    const unitModule = config.unitModules[unitModuleIndex];
                    return (
                      <td key={module.code} className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={unitModule?.isEnabled !== false}
                          disabled={!canEdit}
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

      <section id="platform-deployment-readiness" className={getSectionClass('platform-deployment-readiness')}>
        <SectionHeader
          title="Deployment Readiness"
          subtitle="Commercial deployment posture for SaaS, defence networks, fully offline installs and hybrid sync. These settings are admin-editable and do not hard-block operations yet."
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

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div>
                <h5 className="text-sm font-bold text-white">Deployment Profile</h5>
                <p className="mt-1 text-xs text-gray-400">
                  Describes how this customer installation is expected to run and how the licence will be checked. Keep enforcement at Monitor Only until the customer acceptance path is proven.
                </p>
              </div>
              <span className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
                Runtime-safe: monitor-first
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <SelectField label="Operating Model" value={deploymentProfile.mode} disabled={!canEdit} options={DEPLOYMENT_MODE_OPTIONS} onChange={(value) => updateDeploymentProfile({ mode: value })} />
              <SelectField label="Licence Validation Method" value={deploymentProfile.validationMethod} disabled={!canEdit} options={LICENSE_VALIDATION_OPTIONS} onChange={(value) => updateDeploymentProfile({ validationMethod: value })} />
              <SelectField label="Licence Enforcement Mode" value={deploymentProfile.enforcementMode} disabled={!canEdit} options={LICENSE_ENFORCEMENT_OPTIONS} onChange={(value) => updateDeploymentProfile({ enforcementMode: value })} />
              <NumberField label="Offline Grace Days" value={Number(deploymentProfile.offlineGraceDays ?? 30)} disabled={!canEdit} onChange={(value) => updateDeploymentProfile({ offlineGraceDays: value })} />
              <NumberField label="Licence Check Interval Hours" value={Number(deploymentProfile.checkIntervalHours ?? 24)} disabled={!canEdit} onChange={(value) => updateDeploymentProfile({ checkIntervalHours: value })} />
              <SelectField label="Authentication Model" value={deploymentProfile.authModel} disabled={!canEdit} options={AUTH_MODEL_OPTIONS} onChange={(value) => updateDeploymentProfile({ authModel: value })} />
              <Field label="Data Residence" value={deploymentProfile.dataResidence || ''} disabled={!canEdit} onChange={(value) => updateDeploymentProfile({ dataResidence: value })} />
              <Field label="Network Posture" value={deploymentProfile.networkPosture || ''} disabled={!canEdit} onChange={(value) => updateDeploymentProfile({ networkPosture: value })} />
              <TextAreaField label="Deployment Notes" value={deploymentProfile.notes || ''} disabled={!canEdit} onChange={(value) => updateDeploymentProfile({ notes: value })} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h5 className="text-sm font-bold text-white">Offline And On-Prem Readiness Checklist</h5>
              <InfoHint text="These checks are deliberately visible to administrators. They make the offline/private-network deployment obligations explicit before this app is sold or installed on a defence network." />
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
                    disabled={!canEdit}
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

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
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
              <Field label="Environment Name" value={operationalRunbook.environmentName || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ environmentName: value })} />
              <Field label="Deployment Identifier" value={operationalRunbook.deploymentIdentifier || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ deploymentIdentifier: value })} />
              <SelectField label="Release Channel" value={operationalRunbook.releaseChannel || 'Production'} disabled={!canEdit} options={RELEASE_CHANNEL_OPTIONS} onChange={(value) => updateOperationalRunbook({ releaseChannel: value })} />
              <Field label="Support Owner" value={operationalRunbook.supportOwner || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ supportOwner: value })} />
              <Field label="Support Contact" value={operationalRunbook.supportContact || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ supportContact: value })} />
              <Field label="Approving Authority" value={operationalRunbook.approvingAuthority || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ approvingAuthority: value })} />
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
              <SelectField label="Backup Frequency" value={operationalRunbook.backupFrequency || 'Daily'} disabled={!canEdit} options={BACKUP_FREQUENCY_OPTIONS} onChange={(value) => updateOperationalRunbook({ backupFrequency: value })} />
              <NumberField label="Backup Retention Days" value={Number(operationalRunbook.backupRetentionDays ?? 30)} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ backupRetentionDays: value })} />
              <Field label="Backup Storage Location" value={operationalRunbook.backupStorageLocation || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ backupStorageLocation: value })} />
              <DateField label="Last Backup Date" value={operationalRunbook.lastBackupDate || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ lastBackupDate: value })} />
              <DateField label="Last Restore Test Date" value={operationalRunbook.lastRestoreTestDate || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ lastRestoreTestDate: value })} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="RTO Hours" value={Number(operationalRunbook.restoreTimeObjectiveHours ?? 24)} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ restoreTimeObjectiveHours: value })} />
                <NumberField label="RPO Hours" value={Number(operationalRunbook.restorePointObjectiveHours ?? 24)} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ restorePointObjectiveHours: value })} />
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
              <Field label="Maintenance Window" value={operationalRunbook.maintenanceWindow || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ maintenanceWindow: value })} />
              <Field label="Update Approval Process" value={operationalRunbook.updateApprovalProcess || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ updateApprovalProcess: value })} />
              <DateField label="Last Update Date" value={operationalRunbook.lastUpdateDate || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ lastUpdateDate: value })} />
              <Field label="Evidence Export Path" value={operationalRunbook.evidenceExportPath || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ evidenceExportPath: value })} />
              <NumberField label="Audit Retention Years" value={Number(operationalRunbook.auditRetentionYears ?? 7)} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ auditRetentionYears: value })} />
              <SelectField label="Accreditation Status" value={operationalRunbook.accreditationStatus || 'Not started'} disabled={!canEdit} options={ACCREDITATION_STATUS_OPTIONS} onChange={(value) => updateOperationalRunbook({ accreditationStatus: value })} />
              <TextAreaField label="Operational Notes" value={operationalRunbook.notes || ''} disabled={!canEdit} onChange={(value) => updateOperationalRunbook({ notes: value })} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h5 className="text-sm font-bold text-white">Operational Checks</h5>
              <InfoHint text="These checks are derived from the runbook fields. They are not enforcement gates yet; they are a simple readiness signal for deployment and customer assurance." />
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
          subtitle="Commercial licensing for online SaaS, private defence networks, hybrid sync and fully offline deployments. Development mode remains non-blocking while signed licence files can be tested end to end."
          action={canEdit ? <button type="button" onClick={addLicense} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Licence</button> : null}
        />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr,1fr]">
              <div>
                <h5 className="text-sm font-bold text-white">Licence Runtime</h5>
                <p className="mt-1 text-xs text-cyan-100/80">
                  {licenseStatus?.message || 'Licence runtime status has not loaded yet.'}
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
                  disabled={!canEdit || licenseActionLoading || !licenseImportText.trim()}
                  className="rounded border border-cyan-500 bg-cyan-500 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
            <textarea
              className={`${fieldClass} min-h-[110px] font-mono text-xs`}
              value={licenseImportText}
              onChange={(event) => {
                setLicenseImportText(event.target.value);
                setLicenseImportMessage('');
                setLicenseImportError('');
              }}
              placeholder='Paste signed licence JSON, for example {"schema":"dfp-neo-license/v1",...}'
              disabled={!canEdit && !licenseImportText}
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
              <div key={license.id || license.licenseKey || index} className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <div className="mb-4 grid gap-3 xl:grid-cols-[1fr,230px,230px,230px]">
                  <div>
                    <h5 className="text-sm font-bold text-white">{license.licenseName || 'Licence'}</h5>
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
                  <Field label="Licence Name" value={license.licenseName || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { licenseName: value })} />
                  <Field label="Licence Key" value={license.licenseKey || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { licenseKey: value })} />
                  <SelectField label="Organisation" value={license.organisationCode || config.organisations[0]?.code || 'DEFAULT'} disabled={!canEdit} options={config.organisations.map((org) => org.code)} onChange={(value) => updateRow('licenses', index, { organisationCode: value })} />
                  <SelectField label="Deployment Model" value={license.deploymentMode || 'Online SaaS'} disabled={!canEdit} options={['Online SaaS', 'Private Defence Network', 'Fully Offline', 'Hybrid Offline Sync']} onChange={(value) => updateRow('licenses', index, { deploymentMode: value })} />
                  <SelectField label="Status" value={license.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'SUSPENDED', 'EXPIRED', 'INACTIVE']} onChange={(value) => updateRow('licenses', index, { status: value })} />
                  <Field label="Offline Fingerprint" value={license.offlineFingerprint || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { offlineFingerprint: value })} />
                  <DateField label="Valid From" value={license.validFrom || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { validFrom: value })} />
                  <DateField label="Valid Until" value={license.validUntil || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { validUntil: value })} />
                  <OptionalNumberField label="Max Users" value={license.maxUsers ?? null} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { maxUsers: value })} />
                  <OptionalNumberField label="Max Units" value={license.maxUnits ?? null} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { maxUnits: value })} />
                  <OptionalNumberField label="Max Aircraft Types" value={license.maxAircraftTypes ?? null} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { maxAircraftTypes: value })} />
                  <TextAreaField label="Notes" value={license.notes || ''} disabled={!canEdit} onChange={(value) => updateRow('licenses', index, { notes: value })} />
                </div>

                <div className="mt-4 rounded border border-cyan-500/25 bg-cyan-500/10 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <h6 className="text-xs font-bold uppercase tracking-wide text-cyan-100">Licence Controls</h6>
                    <InfoHint text="These controls describe how the licence should behave in each deployment model. They are saved now for commercial readiness; live runtime enforcement should remain Monitor Only until a customer acceptance process is complete." />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-4">
                    <SelectField
                      label="Validation Method"
                      value={licenceFeatures.validationMethod || deploymentProfile.validationMethod}
                      disabled={!canEdit}
                      options={LICENSE_VALIDATION_OPTIONS}
                      onChange={(value) => updateLicenseFeatures(index, { validationMethod: value })}
                    />
                    <SelectField
                      label="Enforcement Mode"
                      value={normaliseEnforcementMode(licenceFeatures.enforcementMode || deploymentProfile.enforcementMode)}
                      disabled={!canEdit}
                      options={LICENSE_ENFORCEMENT_OPTIONS}
                      onChange={(value) => updateLicenseFeatures(index, { enforcementMode: value })}
                    />
                    <NumberField
                      label="Offline Grace Days"
                      value={Number(licenceFeatures.offlineGraceDays ?? deploymentProfile.offlineGraceDays ?? 30)}
                      disabled={!canEdit}
                      onChange={(value) => updateLicenseFeatures(index, { offlineGraceDays: value })}
                    />
                    <ToggleField
                      label="Allow offline operation"
                      checked={licenceFeatures.allowOfflineOperation === true}
                      disabled={!canEdit}
                      onChange={(checked) => updateLicenseFeatures(index, { allowOfflineOperation: checked })}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded border border-gray-700 bg-gray-950 p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h6 className="text-xs font-bold uppercase tracking-wide text-gray-300">Licensed Modules</h6>
                    <InfoHint text="This is the commercial entitlement list. In development mode it is visible and testable but does not block access. In production mode, signed licences can be enforced by deployment configuration." />
                    <span className="ml-auto text-xs text-gray-400">{moduleCodes.length} selected</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {config.modules.map((module) => (
                      <label key={module.code} className="flex items-start gap-2 rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-500 accent-cyan-500"
                          checked={moduleCodes.includes(module.code)}
                          disabled={!canEdit}
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
      </section>

      <section id="platform-permission-profiles" className={getSectionClass('platform-permission-profiles')}>
        <SectionHeader
          title="Permission Profiles"
          subtitle="Build reusable role profiles. Profiles define what a user can do; access scopes define where they can do it."
          action={canEdit ? <button type="button" onClick={addPermissionProfile} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Profile</button> : null}
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
                <Field label="Profile Name" value={selectedPermissionProfile.name} disabled={!canEdit} onChange={(value) => updatePermissionProfile(selectedPermissionProfile.id, { name: value })} />
                <Field label="Description" value={selectedPermissionProfile.description} disabled={!canEdit} onChange={(value) => updatePermissionProfile(selectedPermissionProfile.id, { description: value })} />
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
                              disabled={!canEdit}
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

      <section id="platform-rank-terminology" className={getSectionClass('platform-rank-terminology')}>
        <SectionHeader
          title="Rank, Terminology & Labels"
          subtitle="Configure personnel display order, local role terminology and customer-facing report labels without changing internal codes."
          action={canUnlockRankTerminology ? (
            rankTerminologyUnlocked ? (
              <button
                type="button"
                onClick={lockRankTerminology}
                className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200"
              >
                Lock
              </button>
            ) : (
              <button
                type="button"
                onClick={unlockRankTerminology}
                className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200"
              >
                Edit
              </button>
            )
          ) : null}
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
          <div className="grid gap-3 lg:grid-cols-2">
            <SelectField
              label="Personnel Sort Mode"
              value={personnelDisplaySettings.sortMode}
              disabled={!canEditRankTerminology}
              options={['rank-then-name', 'alphabetical']}
              onChange={(value) => updatePersonnelDisplaySettings({ sortMode: value === 'alphabetical' ? 'alphabetical' : 'rank-then-name' })}
              info="Choose rank-then-name to sort by configured rank priority first, then surname and first name. Choose alphabetical to ignore rank and sort only by name."
            />
            <Field
              label="Instructor Display Term"
              value={personnelDisplaySettings.instructorLabel}
              disabled={!canEditRankTerminology}
              onChange={(value) => updatePersonnelDisplaySettings({ instructorLabel: value })}
              info="The local term shown to users for instructional staff. Examples: QFI, Instructor, Flying Instructor, Flight Instructor."
            />
            <Field
              label="Civilian Contractor Group"
              value={personnelDisplaySettings.civilianContractorGroupName}
              disabled={!canEditRankTerminology}
              onChange={(value) => updatePersonnelDisplaySettings({ civilianContractorGroupName: value })}
              info="Group or title family used for civilian and contractor personnel. Examples: Civilian Contractors, Contract Instructors, Industry Partners."
            />
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
          <div className="grid gap-3 lg:grid-cols-2">
            <Field
              label="Training Report Name"
              value={trainingReportTerminology.name}
              disabled={!canEditRankTerminology}
              maxLength={TRAINING_REPORT_NAME_MAX_LENGTH}
              onChange={(value) => updateTrainingReportTerminology({ name: value })}
              info={`The compact organisation-specific report name used in tight spaces such as Performance History type pills. Maximum ${TRAINING_REPORT_NAME_MAX_LENGTH} characters. Default: Report. Examples: PT-051, Report, Grade Form.`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextAreaField
              label="Staff Rank Order"
              value={formatRankOrderText(personnelDisplaySettings.staffRankOrder)}
              disabled={!canEditRankTerminology}
              onChange={(value) => {
                const staffRankOrder = parseRankOrderText(value);
                updatePersonnelDisplaySettings({
                  staffRankOrder,
                  ...(personnelDisplaySettings.useSeparateTraineeRankOrder ? {} : { traineeRankOrder: staffRankOrder }),
                });
              }}
              info="Enter one display level per line, highest priority first. Use = on the same line to give titles equal status. Example: Dr = Mr = Ms = Mrs = Mx = APS = CIV = CONTRACTOR. People with equal status are sorted by surname then first name."
            />
            {personnelDisplaySettings.useSeparateTraineeRankOrder ? (
              <TextAreaField
                label="Trainee Rank Order"
                value={formatRankOrderText(personnelDisplaySettings.traineeRankOrder)}
                disabled={!canEditRankTerminology}
                onChange={(value) => updatePersonnelDisplaySettings({ traineeRankOrder: parseRankOrderText(value) })}
                info="Optional separate ordering for trainee ranks. Enter one display level per line, highest priority first. Use = on the same line to give ranks or titles equal status."
              />
            ) : (
              <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-50/90">
                <div className="font-bold text-cyan-100">Trainees use the staff rank order</div>
                <p className="mt-2 leading-relaxed text-cyan-50/75">
                  Turn on separate trainee rank order if trainees use a different rank structure or if the organisation wants trainees displayed differently from staff.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="platform-user-access" className={getSectionClass('platform-user-access')}>
        <SectionHeader
          title="User Access Context"
          subtitle="Search by user name, assign permission profiles, then define where those profiles apply."
          action={canEdit ? <button type="button" onClick={addUserAccess} className="rounded border border-gray-500 bg-gray-300 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200">Add Scope</button> : null}
        />
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(220px,1fr)_minmax(160px,auto)]">
              <UserSearchSelect
                label="User"
                value={selectedAccessUserId}
                disabled={!canEdit}
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
                  {selectedAccessUser
                    ? `${selectedAccessUser.firstName || ''} ${selectedAccessUser.lastName || ''}`.trim() || selectedAccessUser.username || selectedAccessUser.userId
                    : 'No user selected'}
                </div>
              </div>
              <div>
                <span className={labelClass}>Access Scopes</span>
                <div className="rounded border border-cyan-500/20 bg-gray-950 px-3 py-2 text-sm font-semibold text-cyan-100">
                  {selectedAccessRows.length}
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
                      disabled={!canEdit || selectedAccessRows.length === 0}
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

          {selectedAccessRows.length === 0 && (
            <div className="rounded border border-yellow-600/40 bg-yellow-900/20 px-3 py-3 text-sm text-yellow-100">
              This user has no access scopes. Add a scope before testing this account.
            </div>
          )}

          {selectedAccessRows.map(({ access, index }) => {
            const appliesToAllFeatures = !access.moduleCode;
            const scopeKey = access.id || `${access.userId}-${index}`;
            const showAdvancedFeatureArea = advancedFeatureAreaOpenByScope[scopeKey] === true;
            return (
              <div
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
                  <InfoHint text="This section answers where the selected user's permission profiles apply. Example: Location ESL + Unit 1FTS + all enabled features means the user's selected profiles apply to all 1FTS features at East Sale." />
                  <span className="ml-auto rounded bg-gray-950 px-2 py-1 text-xs font-semibold text-gray-300">
                    {access.locationCode || 'All locations'} / {access.unitCode || 'All units'} / {appliesToAllFeatures ? 'All enabled features' : access.moduleCode}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_0.75fr_0.85fr]">
                  <SelectField label="Organisation" value={access.organisationCode || 'DEFAULT'} disabled={!canEdit} options={config.organisations.map((org) => org.code)} onChange={(value) => updateRow('userAccess', index, { organisationCode: value })} />
                  <SelectField label="Location" value={access.locationCode || ''} disabled={!canEdit} options={['', ...config.locations.map((location) => location.code)]} onChange={(value) => updateRow('userAccess', index, { locationCode: value || null })} emptyLabel="All Locations" />
                  <SelectField label="Unit" value={access.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('userAccess', index, { unitCode: value || null })} emptyLabel="All Units" />
                  <SelectField label="Administration Level" value={access.role || 'Viewer'} disabled={!canEdit} options={['Viewer', 'Scheduler', 'Supervisor', 'Unit Admin', 'Platform Admin', 'Super Admin']} onChange={(value) => updateRow('userAccess', index, { role: value })} />
                  <SelectField label="Access" value={access.accessLevel || 'Read'} disabled={!canEdit} options={['Read', 'Write', 'Admin']} onChange={(value) => updateRow('userAccess', index, { accessLevel: value })} />
                  <SelectField label="Status" value={access.status || 'ACTIVE'} disabled={!canEdit} options={['ACTIVE', 'INACTIVE']} onChange={(value) => updateRow('userAccess', index, { status: value })} />
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
                        disabled={!canEdit}
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
                        <InfoHint text="Use this only when a user should administer one area but not another. Example: ESL + 1FTS + NEO_BUILD lets the user work with NEO Build for 1FTS, but not training records or reporting." />
                      </div>
                      <SelectField label="Feature Area" value={access.moduleCode || ''} disabled={!canEdit || appliesToAllFeatures} options={['', ...config.modules.map((module) => module.code)]} onChange={(value) => updateRow('userAccess', index, { moduleCode: value || null })} emptyLabel="All Enabled Features" />
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
        <SectionHeader title="Scheduling Rule Sets" subtitle="Stage-one records current scheduling assumptions as named, editable rule sets for units and aircraft types." />
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div>
                <h5 className="text-sm font-bold text-cyan-100">Individual LMP Insert Event Types</h5>
                <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
                  Controls the event types available from the Individual LMP Insert Event action. Labels are capped at {INSERT_EVENT_LABEL_MAX_LENGTH} characters because they are used on schedule tiles.
                </p>
              </div>
              {canEdit && (
                <button type="button" onClick={addInsertEventType} className="ml-auto rounded border border-gray-500 bg-gray-300 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-200">
                  Add Event Type
                </button>
              )}
            </div>
            <div className="space-y-3">
              {insertEventTypes.map((eventType, eventTypeIndex) => (
                <div key={`${eventType.label}-${eventTypeIndex}`} className="grid gap-3 rounded border border-gray-700 bg-gray-950 p-3 md:grid-cols-6">
                  <Field
                    label="Label"
                    value={eventType.label}
                    disabled={!canEdit}
                    maxLength={INSERT_EVENT_LABEL_MAX_LENGTH}
                    onChange={(value) => updateInsertEventType(eventTypeIndex, { label: value })}
                  />
                  <SelectField
                    label="Build Type"
                    value={eventType.syllabusType}
                    disabled={!canEdit}
                    options={['Flight', 'FTD', 'Ground School', 'Academics']}
                    onChange={(value) => updateInsertEventType(eventTypeIndex, { syllabusType: value as InsertEventSyllabusType })}
                  />
                  <SelectField
                    label="Day/Night"
                    value={eventType.dayNight}
                    disabled={!canEdit}
                    options={['Day', 'Night', 'Day/Night']}
                    onChange={(value) => updateInsertEventType(eventTypeIndex, { dayNight: value as InsertEventDayNight })}
                  />
                  <NumberField label="Duration" value={eventType.duration} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { duration: value })} />
                  <NumberField label="Flt/Sim Hrs" value={eventType.flightOrSimHours} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { flightOrSimHours: value })} />
                  <NumberField label="Resources" value={eventType.resourceCount} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { resourceCount: Math.max(0, Math.round(value)) })} />
                  <NumberField label="Total Hrs" value={eventType.totalEventHours} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { totalEventHours: value })} />
                  <NumberField label="Pre Time" value={eventType.preFlightTime} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { preFlightTime: value })} />
                  <NumberField label="Post Time" value={eventType.postFlightTime} disabled={!canEdit} onChange={(value) => updateInsertEventType(eventTypeIndex, { postFlightTime: value })} />
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!canEdit || insertEventTypes.length <= 1}
                      onClick={() => removeInsertEventType(eventTypeIndex)}
                      className="h-[38px] rounded border border-gray-600 bg-gray-900 px-3 text-xs font-bold text-red-200 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {config.schedulingRuleSets.map((ruleSet, index) => (
            <div key={ruleSet.id || index} className="grid gap-3 rounded border border-gray-700 bg-gray-900 p-3 md:grid-cols-5">
              <Field label="Name" value={ruleSet.name} disabled={!canEdit} onChange={(value) => updateRow('schedulingRuleSets', index, { name: value })} />
              <SelectField label="Unit" value={ruleSet.unitCode || ''} disabled={!canEdit} options={['', ...config.units.map((unit) => unit.code)]} onChange={(value) => updateRow('schedulingRuleSets', index, { unitCode: value || null })} />
              <SelectField label="Aircraft Type" value={ruleSet.aircraftTypeCode || ''} disabled={!canEdit} options={['', ...config.aircraftTypes.map((aircraft) => aircraft.code)]} onChange={(value) => updateRow('schedulingRuleSets', index, { aircraftTypeCode: value || null })} />
              <SelectField label="Scope" value={ruleSet.scope || 'Unit'} disabled={!canEdit} options={['Organisation', 'Location', 'Unit', 'AircraftType']} onChange={(value) => updateRow('schedulingRuleSets', index, { scope: value })} />
              <SelectField label="Active" value={ruleSet.isActive === false ? 'No' : 'Yes'} disabled={!canEdit} options={['Yes', 'No']} onChange={(value) => updateRow('schedulingRuleSets', index, { isActive: value === 'Yes' })} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
  </div>
);

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

const InfoHint = ({ text }: { text: string }) => (
  <span
    role="button"
    tabIndex={0}
    aria-label="More information"
    className="group relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-cyan-400/35 bg-gray-950/20 text-cyan-100/60 normal-case outline-none transition-colors hover:border-cyan-300/60 hover:text-cyan-50 focus-visible:border-cyan-200 focus-visible:text-cyan-50"
  >
    <span aria-hidden="true" className="font-serif text-[11px] font-bold italic leading-none normal-case">i</span>
    <span className="pointer-events-none absolute left-0 top-5 z-50 hidden w-96 max-w-[min(24rem,calc(100vw-2rem))] whitespace-pre-line rounded border border-cyan-500/30 bg-gray-950 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-gray-100 shadow-xl group-hover:block group-focus:block">
      {text}
    </span>
  </span>
);

const FieldLabel = ({ label, info }: { label: string; info?: string }) => (
  <span className="mb-1 flex min-h-5 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
    <span>{label}</span>
    {info ? <InfoHint text={info} /> : null}
  </span>
);

const Field = ({ label, value, disabled, onChange, info, maxLength }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string; maxLength?: number }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      value={value || ''}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(event) => onChange(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value)}
    />
    {typeof maxLength === 'number' ? (
      <span className="mt-1 block text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {(value || '').length}/{maxLength}
      </span>
    ) : null}
  </label>
);

const AirfieldLookupField = ({
  label,
  value,
  disabled,
  suggestions,
  onChange,
  onSelect,
  maxLength,
}: {
  label: string;
  value: string;
  disabled: boolean;
  suggestions: AirfieldCatalogueEntry[];
  onChange: (value: string) => void;
  onSelect: (entry: AirfieldCatalogueEntry) => void;
  maxLength?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const showSuggestions = isOpen && !disabled && suggestions.length > 0 && String(value || '').trim().length >= 2;

  return (
    <label className="relative block">
      <FieldLabel label={label} />
      <input
        className={fieldClass}
        value={value || ''}
        disabled={disabled}
        autoComplete="off"
        maxLength={maxLength}
        onChange={(event) => {
          onChange(typeof maxLength === 'number' ? event.target.value.slice(0, maxLength) : event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
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
    <input className={fieldClass} type="number" value={value ?? 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const formatDateInput = (value: string) => (value ? String(value).slice(0, 10) : '');

const DateField = ({ label, value, disabled, onChange, info }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input className={fieldClass} type="date" value={formatDateInput(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const OptionalNumberField = ({ label, value, disabled, onChange, info }: { label: string; value: number | null; disabled: boolean; onChange: (value: number | null) => void; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      type="number"
      value={value ?? ''}
      disabled={disabled}
      placeholder="Unlimited"
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  </label>
);

const TextAreaField = ({ label, value, disabled, onChange, info }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string }) => (
  <label className="lg:col-span-2">
    <FieldLabel label={label} info={info} />
    <textarea className={`${fieldClass} min-h-[74px] resize-y`} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const ToggleField = ({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 rounded border border-gray-700 bg-gray-950 px-3 py-2">
    <span className="text-sm font-semibold text-gray-200">{label}</span>
    <input
      type="checkbox"
      className="h-5 w-5 rounded border-gray-500 accent-cyan-500"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  </label>
);

const SelectField = ({ label, value, disabled, options, onChange, emptyLabel = 'None', info }: { label: string; value: string; disabled: boolean; options: string[]; onChange: (value: string) => void; emptyLabel?: string; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <select className={fieldClass} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option || emptyLabel}</option>)}
    </select>
  </label>
);

const TimeZoneField = ({ label, value, disabled, onChange, info }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; info?: string }) => (
  <label>
    <FieldLabel label={label} info={info} />
    <input
      className={fieldClass}
      list="platform-iana-timezones"
      value={value || ''}
      disabled={disabled}
      placeholder="Australia/Melbourne"
      onChange={(event) => onChange(event.target.value)}
    />
    <datalist id="platform-iana-timezones">
      {COMMON_IANA_TIMEZONES.map((timezone) => <option key={timezone} value={timezone} />)}
    </datalist>
  </label>
);

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
  const query = search.trim().toLowerCase();
  const filteredUsers = users
    .filter((user) => {
      if (!query) return true;
      return [user.name, user.username, user.email].some((field) => field.toLowerCase().includes(query));
    })
    .slice(0, 30);

  return (
    <label className="relative block">
      <span className={labelClass}>{label}</span>
      <input
        className={fieldClass}
        value={search}
        disabled={disabled}
        placeholder="Search by name..."
        autoComplete="off"
        onChange={(event) => {
          onSearchChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
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
