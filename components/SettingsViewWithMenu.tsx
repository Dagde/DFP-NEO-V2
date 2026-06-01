import React, { useEffect, useRef, useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { SettingsView } from './SettingsView';
import { UserListSection } from './UserListSection';
import StaffDatabaseTable from "./StaffDatabaseTable";
import StaffMockDataTable from "./StaffMockDataTable";
import StaffCombinedDataTable from "./StaffCombinedDataTable";
import TraineeDatabaseTable from "./TraineeDatabaseTable";
import TraineeMockDataTable from "./TraineeMockDataTable";
import DataSourcesSettings from "./DataSourcesSettings";
import AuditButton from './AuditButton';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';
import OrganisationSettings from './OrganisationSettings';
import AppearanceSettings from './AppearanceSettings';
import PlatformConfigurationSettings from './PlatformConfigurationSettings';
import { HistoricalDataSeeder } from './HistoricalDataSeeder';
import PeopleProfilePage from './PeopleProfilePage';
import FormationCallsignsSection from './FormationCallsignsSection';
import { Instructor, Trainee, SyllabusItemDetail, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, FormationCallsign, CancellationRecord, CancellationCode } from '../types';
import { logAudit } from '../utils/auditLogger';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import type { TileStatusSettings } from '../utils/tileStatusSettings';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';

interface SettingsViewWithMenuProps {
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    locationAbbreviations?: Record<string, string>;
    onUpdateLocationAbbreviations?: (abbrevs: Record<string, string>) => void;
    serviceDefinitions?: Array<{ longName: string; shortName: string }>;
    onUpdateServiceDefinitions?: (defs: Array<{ longName: string; shortName: string }>) => void;
    units: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
    locationOpAreas?: Record<string, string[]>;
    onUpdateLocationOpAreas?: (areas: Record<string, string[]>) => void;
    instructorsData: Instructor[];
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    onBulkUpdateInstructors: (instructors: Instructor[]) => void;
    onReplaceInstructors: (instructors: Instructor[]) => void;
    onBulkUpdateTrainees: (trainees: Trainee[]) => void;
    onReplaceTrainees: (trainees: Trainee[]) => void;
    onUpdateSyllabus: (syllabus: SyllabusItemDetail[]) => void;
    onShowSuccess: (message: string) => void;
    onNavigateToProfile?: (user: any) => void;
    eventLimits: EventLimits;
    onUpdateEventLimits: (limits: EventLimits) => void;
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    onNavigate: (view: string) => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    sctEvents: string[];
    onUpdateSctEvents: (events: string[]) => void;
    preferredDutyPeriod: number;
    onUpdatePreferredDutyPeriod: (value: number) => void;
    maxCrewDutyPeriod: number;
    onUpdateMaxCrewDutyPeriod: (value: number) => void;
    flightTurnaround: number;
    onUpdateFlightTurnaround: (value: number) => void;
    ftdTurnaround: number;
    onUpdateFtdTurnaround: (value: number) => void;
    cptTurnaround: number;
    onUpdateCptTurnaround: (value: number) => void;
    currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
    maxDispatchPerHour: number;
    onUpdateMaxDispatchPerHour: (value: number) => void;
    tileStatusSettings?: TileStatusSettings;
    onUpdateTileStatusSettings?: (settings: TileStatusSettings) => void;
    timezoneOffset: number;
    onUpdateTimezoneOffset: (offset: number) => void;
    showDepartureDensityOverlay: boolean;
    onUpdateShowDepartureDensityOverlay: (value: boolean) => void;
    formationCallsigns: FormationCallsign[];
    courseColors: { [key: string]: string };
    setCourseColors: (colors: { [key: string]: string }) => void;
    onUpdateFormationCallsigns: (callsigns: FormationCallsign[]) => void;
    onUpdateTraineeLMPs: (lmpMap: Map<string, SyllabusItemDetail[]>) => void;
    cancellationRecords: CancellationRecord[];
    cancellationCodes: CancellationCode[];
    currentAircraftAvailable?: number;
    totalAircraft?: number;
    dayFlyingStart?: string;
    dayFlyingEnd?: string;
    resourceDisplayNames?: ResourceDisplayNames;
    personnelDisplaySettings?: PersonnelDisplaySettings;
    instructorLabel?: string;
    canUsePlatformPermission?: (permissionId: string) => boolean;
    settingsLoaded?: boolean;
    organisationSettings?: {
        staffSharingEnabled: boolean;
        staffSharingUnits: string[];
        activeStaffSharingGroupId?: string;
        staffSharingGroups?: Array<{
            id: string;
            name: string;
            selectedUnits: string[];
            enabled?: boolean;
        }>;
        fleetSharingEnabled: boolean;
        allocationMode: 'combined' | 'fixed';
        selectedUnits: string[];
        desiredAllocations: Record<string, number>;
        remainderUnitIndex: number;
        activeResourceSharingGroupId?: string;
        resourceSharingGroups?: Array<{
            id: string;
            name: string;
            selectedUnits: string[];
            allocationMode: 'combined' | 'fixed';
            desiredAllocations: Record<string, number>;
            remainderUnitIndex: number;
            enabled?: boolean;
        }>;
    };
    onUpdateOrganisationSettings?: (settings: {
        staffSharingEnabled: boolean;
        staffSharingUnits: string[];
        activeStaffSharingGroupId?: string;
        staffSharingGroups?: Array<{
            id: string;
            name: string;
            selectedUnits: string[];
            enabled?: boolean;
        }>;
        fleetSharingEnabled: boolean;
        allocationMode: 'combined' | 'fixed';
        selectedUnits: string[];
        desiredAllocations: Record<string, number>;
        remainderUnitIndex: number;
        activeResourceSharingGroupId?: string;
        resourceSharingGroups?: Array<{
            id: string;
            name: string;
            selectedUnits: string[];
            allocationMode: 'combined' | 'fixed';
            desiredAllocations: Record<string, number>;
            remainderUnitIndex: number;
            enabled?: boolean;
        }>;
    }) => void;
    onDataSourceSettingsChange?: (settings: {
        staff: boolean;
        trainee: boolean;
        staffDb: boolean;
        traineeDb: boolean;
    }) => void;
    onDatabaseDataChanged?: () => void;  // Called when staff/trainee database is modified
    neoBuildCourse?: string;
    onUpdateNeoBuildCourse?: (course: string) => void;
    excludedCourses?: string[];
    onUpdateExcludedCourses?: (courses: string[]) => void;
    }

type SettingsSection =
    | 'scoring-matrix'
    | 'currencies'
    | 'sct-events'
    | 'people-profile'
    | 'event-limits'
    | 'duty-turnaround'
    | 'business-rules'
    | 'permissions'
    | 'data-loaders'
    | 'data-sources'
    | 'user-list'
    | 'staff-database'
    | 'trainee-database'
    | 'staff-mockdata'
    | 'trainee-mockdata'
    | 'staff-combined-data'
    | 'validation'
    | 'historical-data'
    | 'timezone'
    | 'location'
    | 'units'
    | 'organisation'
    | 'platform-configuration'
    | 'appearance'
    | 'emergency';

const platformConfigurationSections = [
    'platform-configuration-health',
    'platform-organisation-locations',
    'platform-units',
    'platform-resource-pools',
    'platform-unit-modules',
    'platform-deployment-readiness',
    'platform-operational-runbook',
    'platform-licensing',
    'platform-permission-profiles',
    'platform-rank-terminology',
    'platform-user-access',
    'platform-scheduling-rule-sets',
] as const;

type PlatformConfigurationMenuSection = typeof platformConfigurationSections[number];
type SettingsMenuSection = SettingsSection | 'locale-settings' | 'scheduling-rules' | PlatformConfigurationMenuSection;

const platformSectionTargets: Record<'platform-configuration' | PlatformConfigurationMenuSection, string> = {
    'platform-configuration': 'platform-configuration-health',
    'platform-configuration-health': 'platform-configuration-health',
    'platform-organisation-locations': 'platform-organisation-locations',
    'platform-units': 'platform-units',
    'platform-resource-pools': 'platform-resource-pools',
    'platform-unit-modules': 'platform-unit-modules',
    'platform-deployment-readiness': 'platform-deployment-readiness',
    'platform-operational-runbook': 'platform-operational-runbook',
    'platform-licensing': 'platform-licensing',
    'platform-permission-profiles': 'platform-permission-profiles',
    'platform-rank-terminology': 'platform-rank-terminology',
    'platform-user-access': 'platform-user-access',
    'platform-scheduling-rule-sets': 'platform-scheduling-rule-sets',
};

const isPlatformConfigurationMenuSection = (section: SettingsMenuSection): section is 'platform-configuration' | PlatformConfigurationMenuSection =>
    Object.prototype.hasOwnProperty.call(platformSectionTargets, section);

const sectionLabels: Record<SettingsMenuSection, string> = {
    'scoring-matrix': 'Scoring Matrix',
    'currencies': 'Currencies',
    'sct-events': 'SCT Events',
    'people-profile': 'NEO Build People Profile',
    'scheduling-rules': 'Scheduling Rules',
    'event-limits': 'Event Limits',
    'duty-turnaround': 'Duty & Turnaround',
    'business-rules': 'Business Rules',
    'permissions': 'Permissions',
    'data-loaders': 'Data Import',
    'data-sources': 'Data Sources',
    'user-list': 'User List',
    'staff-database': 'Staff Database',
    'trainee-database': 'Trainee Database',
    'staff-mockdata': 'Staff MockData',
    'trainee-mockdata': 'Trainee MockData',
    'staff-combined-data': 'Staff Combined Data',
    'validation': 'Cancellation Codes',
    'historical-data': 'Historical Data',
    'locale-settings': 'Locations & Timezones',
    'timezone': 'Timezone',
    'location': 'Location',
    'units': 'Units',
    'organisation': 'Resource Sharing',
    'platform-configuration': 'Platform Configuration',
    'platform-configuration-health': 'Configuration Health',
    'platform-organisation-locations': 'Organisation, Bases & Areas',
    'platform-units': 'Units & Ownership',
    'platform-resource-pools': 'Aircraft & Resource Pools',
    'platform-unit-modules': 'Unit Features & Modules',
    'platform-deployment-readiness': 'Deployment Readiness',
    'platform-operational-runbook': 'Operational Runbook',
    'platform-licensing': 'Licensing & Deployment',
    'platform-permission-profiles': 'Permission Profiles',
    'platform-rank-terminology': 'Rank, Terminology & Labels',
    'platform-user-access': 'User Access Scopes',
    'platform-scheduling-rule-sets': 'Enterprise Rule Sets',
    'appearance': 'App Appearance',
    'emergency': 'Emergency',
};

// All sections in order for the left menu
const allSections: SettingsSection[] = [
    'scoring-matrix',
    'currencies',
    'sct-events',
    'people-profile',
    'event-limits',
    'duty-turnaround',
    'business-rules',
    'permissions',
    'data-loaders',
    'data-sources',
    'user-list',
    'staff-database',
    'trainee-database',
    'staff-mockdata',
    'trainee-mockdata',
    'staff-combined-data',
    'validation',
    'historical-data',
    'timezone',
    'location',
    'units',
    'organisation',
    'platform-configuration',
    'appearance',
    'emergency',
];

type ScoringMatrixTab = 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';

const platformConfigurationIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
    <path d="M4 5h16v4H4zM4 15h16v4H4z"/>
    <path d="M8 9v6M16 9v6M12 3v18"/>
  </svg>
);

// ─── Icon definitions for each section ───────────────────────────────────────
const sectionIcons: Record<SettingsMenuSection, React.ReactNode> = {
  'scoring-matrix': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  'currencies': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      <path d="M9 14h1.5a1.5 1.5 0 000-3h-1a1.5 1.5 0 000 3H11a1.5 1.5 0 010 3H9"/>
      <path d="M10 17v1m0-8v1"/>
    </svg>
  ),
  'sct-events': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  'people-profile': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
      <path d="M20 15c1.333 1 2 2.333 2 4"/>
    </svg>
  ),
  'scheduling-rules': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M4 7h16M4 12h16M4 17h16"/>
      <path d="M8 5v4M16 10v4M11 15v4"/>
    </svg>
  ),
  'event-limits': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v4M12 16h.01"/>
    </svg>
  ),
  'duty-turnaround': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  'business-rules': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  'permissions': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  'data-loaders': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  'data-sources': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/>
      <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9"/>
      <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4"/>
    </svg>
  ),
  'user-list': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  'staff-database': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
      <path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
      <path d="M6 17v2a2 2 0 002 2h8a2 2 0 002-2v-2"/>
      <line x1="8" y1="12" x2="8" y2="12.01"/>
      <line x1="12" y1="12" x2="12" y2="12.01"/>
    </svg>
  ),
  'trainee-database': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  'staff-mockdata': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M7 8h.01M10 8h4"/>
      <path d="M7 11h.01M10 11h4"/>
    </svg>
  ),
  'trainee-mockdata': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      <line x1="9" y1="7" x2="15" y2="7"/>
      <line x1="9" y1="11" x2="15" y2="11"/>
    </svg>
  ),
  'staff-combined-data': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  'validation': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <path d="M17 3.13A8 8 0 0112 2 8 8 0 015 6"/>
      <path d="M9 17l3-8 3 8M10.5 14.5h3"/>
    </svg>
  ),
  'historical-data': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
      <path d="M3.05 11a9 9 0 011.4-3.7"/>
    </svg>
  ),
  'locale-settings': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M12 2v3M12 15v3"/>
    </svg>
  ),
  'timezone': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  'location': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  'units': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  'organisation': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/>
    </svg>
  ),
  'platform-configuration': platformConfigurationIcon,
  'platform-configuration-health': platformConfigurationIcon,
  'platform-organisation-locations': platformConfigurationIcon,
  'platform-units': platformConfigurationIcon,
  'platform-resource-pools': platformConfigurationIcon,
  'platform-unit-modules': platformConfigurationIcon,
  'platform-deployment-readiness': platformConfigurationIcon,
  'platform-operational-runbook': platformConfigurationIcon,
  'platform-licensing': platformConfigurationIcon,
  'platform-permission-profiles': platformConfigurationIcon,
  'platform-user-access': platformConfigurationIcon,
  'platform-scheduling-rule-sets': platformConfigurationIcon,
  'appearance': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      <path d="M12 8a4 4 0 00-4 4"/>
    </svg>
  ),
  'emergency': (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full bg-gradient-to-b from-red-400 to-red-600 
        border-2 border-red-500 shadow-[0_3px_0_0_rgba(153,27,27,1),0_4px_8px_rgba(0,0,0,0.4)]
        flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white drop-shadow">
          <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
        </svg>
      </div>
    </div>
  ),
};

// Descriptions for each section
const sectionDescriptions: Record<SettingsMenuSection, string> = {
  'scoring-matrix': 'Configure scoring logic and weighting',
  'currencies': 'Manage qualification expiry dates',
  'sct-events': 'Event scoring rules and triggers',
  'people-profile': 'Assign NEO Build training basis and exclusions',
  'scheduling-rules': 'Event limits, duty rules, turnarounds and dispatch limits',
  'event-limits': 'Define operational thresholds',
  'duty-turnaround': 'Crew duty limits & rest times',
  'business-rules': 'System logic and automation',
  'permissions': 'Manage system access and roles',
  'data-loaders': 'Import operational data files',
  'data-sources': 'Connect external datasets',
  'user-list': 'View and manage user accounts',
  'staff-database': 'Staff records and details',
  'trainee-database': 'Trainee records and details',
  'staff-mockdata': 'Staff test data view',
  'trainee-mockdata': 'Trainee test data view',
  'staff-combined-data': 'Combined staff data overview',
  'validation': 'Master cancellation code table used by cancellation records and analytics',
  'historical-data': 'Seed & refresh historical training records',
  'locale-settings': 'Manage bases, unit assignment, timezones and training areas',
  'timezone': 'Configure timezone settings',
  'location': 'Manage base locations',
  'units': 'Configure unit settings',
  'organisation': 'Fleet sharing and multi-unit configuration',
  'platform-configuration': 'Commercial hierarchy, modules, resource pools and rule sets',
  'platform-configuration-health': 'Configuration warnings, risks and remediation guidance',
  'platform-organisation-locations': 'Customer organisation, bases, timezones and training areas',
  'platform-units': 'Unit type, base ownership and operating status',
  'platform-resource-pools': 'Aircraft types, shared pools and resource counts',
  'platform-unit-modules': 'Enable features and modules for each unit',
  'platform-deployment-readiness': 'SaaS, on-premise, offline and hybrid deployment posture',
  'platform-operational-runbook': 'Support, backup, restore, update and accreditation records',
  'platform-licensing': 'Licence model, entitlements and validation posture',
  'platform-permission-profiles': 'Reusable permission profiles for user roles',
  'platform-rank-terminology': 'Rank ordering and local instructor terminology',
  'platform-user-access': 'Control where each user can work',
  'platform-scheduling-rule-sets': 'Commercial scheduling rule set records',
  'appearance': 'Choose dark or light display theme',
  'emergency': 'System freeze and emergency controls',
};

// Icon accent colours per section - grouped by category for consistent icon colours
// SYSTEM CONFIGURATION: scoring-matrix, currencies, sct-events (sky blue)
// OPERATIONS RULES: event-limits, duty-turnaround, business-rules (amber)
// ACCESS & SECURITY: permissions, user-list (violet)
// DATA MANAGEMENT: data-loaders, data-sources, staff-database, trainee-database, staff-combined-data, staff-mockdata, trainee-mockdata (emerald)
// HISTORICAL & ANALYSIS: validation (rose)
// SYSTEM SETTINGS: timezone, location, units, organisation (cyan)
const sectionColors: Record<SettingsMenuSection, string> = {
  // SYSTEM CONFIGURATION - sky blue icons
  'scoring-matrix':    'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'currencies':        'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'sct-events':        'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'people-profile':    'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  // OPERATIONS RULES - amber icons
  'scheduling-rules':  'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'event-limits':      'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'duty-turnaround':   'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'business-rules':    'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  // ACCESS & SECURITY - violet icons
  'permissions':       'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  'user-list':         'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  // DATA MANAGEMENT - emerald icons
  'data-loaders':      'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'data-sources':      'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'staff-database':    'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'trainee-database':  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'staff-mockdata':    'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'trainee-mockdata':  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'staff-combined-data':'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  // HISTORICAL & ANALYSIS - amber icons
  'validation':        'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'historical-data':   'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  // SYSTEM SETTINGS - cyan icons
  'locale-settings':   'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'timezone':          'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'location':          'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'units':             'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'organisation':      'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-configuration': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-configuration-health': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-organisation-locations': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-units': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-resource-pools': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-unit-modules': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-deployment-readiness': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-operational-runbook': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-licensing': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-permission-profiles': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-rank-terminology': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-user-access': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-scheduling-rule-sets': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'appearance':        'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  // EMERGENCY - red icons
  'emergency':         'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
};

// Groups for the settings home screen. These group by user intent, not implementation detail.
const sectionGroups: {
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  defaultSection: SettingsMenuSection;
  sections: SettingsMenuSection[];
}[] = [
  {
    label: 'Platform & Deployment',
    shortLabel: 'Platform',
    description: 'Customer, bases, units, aircraft pools, enabled features, licensing and deployment posture.',
    accent: 'cyan',
    defaultSection: 'platform-configuration-health',
    sections: [
        'platform-configuration-health',
        'platform-organisation-locations',
        'platform-units',
        'platform-resource-pools',
        'platform-unit-modules',
        'platform-deployment-readiness',
        'platform-licensing',
        'platform-rank-terminology',
        'organisation',
        'locale-settings',
        'appearance',
    ],
  },
  {
    label: 'People & Permissions',
    shortLabel: 'People',
    description: 'User accounts, permission profiles, access scopes, staff records and trainee records.',
    accent: 'violet',
    defaultSection: 'platform-user-access',
    sections: [
        'platform-user-access',
        'platform-permission-profiles',
        'user-list',
        'staff-database',
        'trainee-database',
        'people-profile',
    ],
  },
  {
    label: 'Training & Standards',
    shortLabel: 'Training',
    description: 'Scoring rules, currencies and SCT event standards used across the training system.',
    accent: 'sky',
    defaultSection: 'scoring-matrix',
    sections: ['scoring-matrix', 'sct-events', 'currencies'],
  },
  {
    label: 'DFP Build Rules',
    shortLabel: 'Rules',
    description: 'Persistent scheduling policy, duty limits, turnarounds and enterprise rule sets. Daily build factors stay in NEO Build > Priorities.',
    accent: 'amber',
    defaultSection: 'scheduling-rules',
    sections: ['scheduling-rules'],
  },
  {
    label: 'Records & Data',
    shortLabel: 'Data',
    description: 'Operational runbook, evidence, cancellation code governance, imports and enduring historical records.',
    accent: 'emerald',
    defaultSection: 'platform-operational-runbook',
    sections: ['platform-operational-runbook', 'validation', 'data-sources', 'data-loaders', 'historical-data'],
  },
  {
    label: 'Emergency',
    shortLabel: 'Emergency',
    description: 'System freeze and emergency controls.',
    accent: 'red',
    defaultSection: 'emergency',
    sections: ['emergency'],
  },
];

const timezoneOptions = [
    { value: -12, label: 'UTC-12:00' },
    { value: -11, label: 'UTC-11:00' },
    { value: -10, label: 'UTC-10:00 (Hawaii)' },
    { value: -9, label: 'UTC-09:00 (Alaska)' },
    { value: -8, label: 'UTC-08:00 (Pacific)' },
    { value: -7, label: 'UTC-07:00 (Mountain)' },
    { value: -6, label: 'UTC-06:00 (Central)' },
    { value: -5, label: 'UTC-05:00 (Eastern)' },
    { value: -4, label: 'UTC-04:00' },
    { value: -3, label: 'UTC-03:00' },
    { value: -2, label: 'UTC-02:00' },
    { value: -1, label: 'UTC-01:00' },
    { value: 0, label: 'UTC+00:00 (GMT/UTC)' },
    { value: 1, label: 'UTC+01:00 (CET)' },
    { value: 2, label: 'UTC+02:00' },
    { value: 3, label: 'UTC+03:00' },
    { value: 4, label: 'UTC+04:00' },
    { value: 5, label: 'UTC+05:00' },
    { value: 5.5, label: 'UTC+05:30 (India)' },
    { value: 6, label: 'UTC+06:00' },
    { value: 7, label: 'UTC+07:00' },
    { value: 8, label: 'UTC+08:00 (Singapore/Perth)' },
    { value: 9, label: 'UTC+09:00 (Japan/Korea)' },
    { value: 9.5, label: 'UTC+09:30 (Adelaide)' },
    { value: 10, label: 'UTC+10:00 (AEST Sydney/Brisbane)' },
    { value: 10.5, label: 'UTC+10:30' },
    { value: 11, label: 'UTC+11:00 (AEDT Sydney)' },
    { value: 12, label: 'UTC+12:00 (New Zealand)' },
    { value: 13, label: 'UTC+13:00 (NZDT)' },
];

const formatTimezoneLabel = (offset: number) => {
    return timezoneOptions.find(option => option.value === offset)?.label || `UTC${offset >= 0 ? '+' : ''}${offset}:00`;
};

const LocaleSettingsSection: React.FC<{
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    locationAbbreviations?: Record<string, string>;
    onUpdateLocationAbbreviations?: (abbrevs: Record<string, string>) => void;
    serviceDefinitions?: Array<{ longName: string; shortName: string }>;
    onUpdateServiceDefinitions?: (defs: Array<{ longName: string; shortName: string }>) => void;
    units: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
    locationOpAreas?: Record<string, string[]>;
    onUpdateLocationOpAreas?: (areas: Record<string, string[]>) => void;
    timezoneOffset: number;
    onUpdateTimezoneOffset: (offset: number) => void;
    formationCallsigns: FormationCallsign[];
    onUpdateFormationCallsigns: (callsigns: FormationCallsign[]) => void;
    currentUserPermission: SettingsViewWithMenuProps['currentUserPermission'];
    onShowSuccess: (message: string) => void;
}> = ({
    locations,
    onUpdateLocations,
    locationAbbreviations = {},
    onUpdateLocationAbbreviations,
    serviceDefinitions = [
        { longName: 'Air Force', shortName: 'RAAF' },
        { longName: 'Navy', shortName: 'RAN' },
        { longName: 'Army', shortName: 'ARA' },
    ],
    onUpdateServiceDefinitions,
    units,
    onUpdateUnits,
    unitLocations,
    onUpdateUnitLocations,
    locationOpAreas = {},
    onUpdateLocationOpAreas,
    timezoneOffset,
    onUpdateTimezoneOffset,
    formationCallsigns,
    onUpdateFormationCallsigns,
    currentUserPermission,
    onShowSuccess,
}) => {
    const canEditSettings = ['Super Admin', 'Admin', 'Scheduler'].includes(currentUserPermission);
    const [isEditing, setIsEditing] = useState(false);
    const [tempLocations, setTempLocations] = useState<string[]>(locations);
    const [tempLocationAbbreviations, setTempLocationAbbreviations] = useState<Record<string, string>>(locationAbbreviations);
    const [tempUnits, setTempUnits] = useState<string[]>(units);
    const [tempUnitLocations, setTempUnitLocations] = useState<Record<string, string>>(unitLocations);
    const [tempOpAreas, setTempOpAreas] = useState<Record<string, string[]>>(locationOpAreas);
    const [tempTimezoneOffset, setTempTimezoneOffset] = useState(timezoneOffset);
    const [tempServiceDefinitions, setTempServiceDefinitions] = useState(serviceDefinitions);
    const [newLocation, setNewLocation] = useState('');
    const [newUnitByLocation, setNewUnitByLocation] = useState<Record<string, string>>({});
    const [newAreaByLocation, setNewAreaByLocation] = useState<Record<string, string>>({});
    const [newServiceLong, setNewServiceLong] = useState('');
    const [newServiceShort, setNewServiceShort] = useState('');

    React.useEffect(() => {
        if (!isEditing) {
            setTempLocations(locations);
            setTempLocationAbbreviations(locationAbbreviations);
            setTempUnits(units);
            setTempUnitLocations(unitLocations);
            setTempOpAreas(locationOpAreas);
            setTempTimezoneOffset(timezoneOffset);
            setTempServiceDefinitions(serviceDefinitions);
        }
    }, [isEditing, locations, locationAbbreviations, units, unitLocations, locationOpAreas, timezoneOffset, serviceDefinitions]);

    const resetDrafts = () => {
        setTempLocations(locations);
        setTempLocationAbbreviations(locationAbbreviations);
        setTempUnits(units);
        setTempUnitLocations(unitLocations);
        setTempOpAreas(locationOpAreas);
        setTempTimezoneOffset(timezoneOffset);
        setTempServiceDefinitions(serviceDefinitions);
        setNewLocation('');
        setNewUnitByLocation({});
        setNewAreaByLocation({});
        setNewServiceLong('');
        setNewServiceShort('');
    };

    const startEdit = () => {
        resetDrafts();
        setIsEditing(true);
    };

    const cancelEdit = () => {
        resetDrafts();
        setIsEditing(false);
    };

    const addLocation = () => {
        const name = newLocation.trim();
        if (!name || tempLocations.includes(name)) return;
        setTempLocations([...tempLocations, name]);
        setTempLocationAbbreviations(prev => ({ ...prev, [name]: '' }));
        setTempOpAreas(prev => ({ ...prev, [name]: [] }));
        setNewLocation('');
    };

    const removeLocation = async (location: string) => {
        if (tempLocations.length <= 1) {
            await showDarkAlert('At least one location must remain configured.', 'Cannot Remove Location', 'warning');
            return;
        }

        const password = await showDarkPrompt({
            title: 'Remove Location',
            message: `Enter your password to remove ${location}. Assigned units will be moved to the first remaining location when you save.`,
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

        const nextLocations = tempLocations.filter(loc => loc !== location);
        const fallbackLocation = nextLocations[0] || '';
        setTempLocations(nextLocations);
        setTempLocationAbbreviations(prev => {
            const next = { ...prev };
            delete next[location];
            return next;
        });
        setTempOpAreas(prev => {
            const next = { ...prev };
            delete next[location];
            return next;
        });
        setTempUnitLocations(prev => Object.fromEntries(
            Object.entries(prev).map(([unit, assignedLocation]) => [unit, assignedLocation === location ? fallbackLocation : assignedLocation])
        ));
    };

    const renameLocation = (oldLocation: string, newName: string) => {
        setTempLocations(prev => prev.map(loc => loc === oldLocation ? newName : loc));
        setTempLocationAbbreviations(prev => {
            const next = { ...prev, [newName]: prev[oldLocation] || '' };
            if (newName !== oldLocation) delete next[oldLocation];
            return next;
        });
        setTempOpAreas(prev => {
            const next = { ...prev, [newName]: prev[oldLocation] || [] };
            if (newName !== oldLocation) delete next[oldLocation];
            return next;
        });
        setTempUnitLocations(prev => Object.fromEntries(
            Object.entries(prev).map(([unit, assignedLocation]) => [unit, assignedLocation === oldLocation ? newName : assignedLocation])
        ));
    };

    const addUnitToLocation = (location: string) => {
        const unitName = (newUnitByLocation[location] || '').trim();
        if (!unitName || tempUnits.includes(unitName)) return;
        setTempUnits([...tempUnits, unitName]);
        setTempUnitLocations(prev => ({ ...prev, [unitName]: location }));
        setNewUnitByLocation(prev => ({ ...prev, [location]: '' }));
    };

    const removeUnit = (unit: string) => {
        setTempUnits(prev => prev.filter(item => item !== unit));
        setTempUnitLocations(prev => {
            const next = { ...prev };
            delete next[unit];
            return next;
        });
    };

    const addAreaToLocation = (location: string) => {
        const area = (newAreaByLocation[location] || '').trim().toUpperCase();
        if (!area) return;
        const existing = tempOpAreas[location] || [];
        if (existing.includes(area)) return;
        setTempOpAreas(prev => ({ ...prev, [location]: [...existing, area].sort() }));
        setNewAreaByLocation(prev => ({ ...prev, [location]: '' }));
    };

    const removeArea = (location: string, area: string) => {
        setTempOpAreas(prev => ({
            ...prev,
            [location]: (prev[location] || []).filter(item => item !== area),
        }));
    };

    const addService = () => {
        const longName = newServiceLong.trim();
        const shortName = newServiceShort.trim().toUpperCase();
        if (!longName || !shortName || tempServiceDefinitions.some(service => service.shortName === shortName)) return;
        setTempServiceDefinitions([...tempServiceDefinitions, { longName, shortName }]);
        setNewServiceLong('');
        setNewServiceShort('');
    };

    const removeService = (shortName: string) => {
        setTempServiceDefinitions(prev => prev.filter(service => service.shortName !== shortName));
    };

    const saveLocaleSettings = () => {
        const previousLocations = Array.from(new Set(locations.map(location => location.trim()).filter(Boolean)));
        const cleanLocations = tempLocations.map(location => location.trim()).filter(Boolean);
        const uniqueLocations = Array.from(new Set(cleanLocations));
        const fallbackLocation = uniqueLocations[0] || '';
        const cleanAbbreviations = Object.fromEntries(
            uniqueLocations.map(location => [location, (tempLocationAbbreviations[location] || '').trim().toUpperCase()])
        );
        const cleanUnits = Array.from(new Set(tempUnits.map(unit => unit.trim()).filter(Boolean)));
        const cleanUnitLocations = Object.fromEntries(
            cleanUnits.map(unit => [unit, uniqueLocations.includes(tempUnitLocations[unit]) ? tempUnitLocations[unit] : fallbackLocation])
        );
        const cleanOpAreas = Object.fromEntries(
            uniqueLocations.map(location => [location, Array.from(new Set((tempOpAreas[location] || []).map(area => area.trim().toUpperCase()).filter(Boolean))).sort()])
        );

        onUpdateLocations(uniqueLocations);
        if (onUpdateLocationAbbreviations) onUpdateLocationAbbreviations(cleanAbbreviations);
        onUpdateTimezoneOffset(tempTimezoneOffset);
        onUpdateUnits(cleanUnits);
        onUpdateUnitLocations(cleanUnitLocations);
        if (onUpdateLocationOpAreas) onUpdateLocationOpAreas(cleanOpAreas);
        if (onUpdateServiceDefinitions) onUpdateServiceDefinitions(tempServiceDefinitions);
        setIsEditing(false);
        onShowSuccess('Locale settings updated');
        logAudit({
            page: 'Settings - Locale Settings',
            action: 'Edit',
            description: 'Updated location-led locale settings',
            changes: `${uniqueLocations.length} locations, ${cleanUnits.length} units, timezone ${formatTimezoneLabel(tempTimezoneOffset)}`,
        });
        uniqueLocations
            .filter(location => !previousLocations.includes(location))
            .forEach(location => logAudit({
                page: 'Settings - Locale Settings',
                action: 'Add',
                description: `Added location ${location}`,
                changes: `Location: ${location}; code: ${cleanAbbreviations[location] || 'none'}; timezone: ${formatTimezoneLabel(tempTimezoneOffset)}`,
            }));
        previousLocations
            .filter(location => !uniqueLocations.includes(location))
            .forEach(location => logAudit({
                page: 'Settings - Locale Settings',
                action: 'Delete',
                description: `Removed location ${location}`,
                changes: `Remaining locations: ${uniqueLocations.join(', ') || 'none'}`,
            }));
    };

    const displayedLocations = isEditing ? tempLocations : locations;
    const displayedUnits = isEditing ? tempUnits : units;
    const displayedUnitLocations = isEditing ? tempUnitLocations : unitLocations;
    const displayedOpAreas = isEditing ? tempOpAreas : locationOpAreas;
    const displayedAbbreviations = isEditing ? tempLocationAbbreviations : locationAbbreviations;
    const displayedTimezone = isEditing ? tempTimezoneOffset : timezoneOffset;
    const displayedServices = isEditing ? tempServiceDefinitions : serviceDefinitions;

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                <div className="flex flex-wrap items-start gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-cyan-200">Locale Settings</h3>
                        <p className="mt-1 text-sm text-cyan-100/70">Locations are the parent record. Each location carries its timezone, assigned units, and training areas.</p>
                    </div>
                    <div className="ml-auto flex gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={saveLocaleSettings} className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">Save</button>
                                <button onClick={cancelEdit} className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600">Cancel</button>
                            </>
                        ) : (
                            <button
                                onClick={startEdit}
                                disabled={!canEditSettings}
                                className={`rounded-md px-3 py-2 text-sm font-semibold ${canEditSettings ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {isEditing && (
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">Add Location</label>
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={newLocation}
                            onChange={event => setNewLocation(event.target.value)}
                            placeholder="New location name"
                            className="min-w-64 flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                        />
                        <button onClick={addLocation} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Add Location</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                {displayedLocations.map(location => {
                    const assignedUnits = displayedUnits.filter(unit => displayedUnitLocations[unit] === location);
                    const trainingAreas = displayedOpAreas[location] || [];
                    return (
                        <section key={location} className="rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                            <div className="border-b border-gray-700 bg-gray-900/45 px-4 py-3">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem]">
                                                <input
                                                    value={location}
                                                    onChange={event => renameLocation(location, event.target.value)}
                                                    className="rounded-md border border-gray-600 bg-gray-950 px-3 py-2 text-lg font-bold text-white focus:border-sky-500 focus:outline-none"
                                                />
                                                <input
                                                    value={tempLocationAbbreviations[location] || ''}
                                                    onChange={event => setTempLocationAbbreviations(prev => ({ ...prev, [location]: event.target.value.toUpperCase() }))}
                                                    maxLength={5}
                                                    placeholder="Code"
                                                    className="rounded-md border border-gray-600 bg-gray-950 px-3 py-2 text-center font-mono text-sm font-bold uppercase text-yellow-300 focus:border-sky-500 focus:outline-none"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="truncate text-xl font-bold text-white">{location}</h4>
                                                {displayedAbbreviations[location] && (
                                                    <p className="mt-1 font-mono text-xs font-bold uppercase tracking-widest text-yellow-300">{displayedAbbreviations[location]}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <button onClick={() => removeLocation(location)} className="rounded-md border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">Remove Location</button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 p-4">
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">Assigned Timezone</label>
                                    {isEditing ? (
                                        <select
                                            value={displayedTimezone}
                                            onChange={event => setTempTimezoneOffset(parseFloat(event.target.value))}
                                            className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                                        >
                                            {timezoneOptions.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="rounded-md bg-gray-900/70 px-3 py-2 text-sm font-semibold text-gray-200">{formatTimezoneLabel(displayedTimezone)}</div>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">Assigned Units</label>
                                        <span className="text-xs text-gray-600">{assignedUnits.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {assignedUnits.length === 0 && <p className="rounded-md border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-500">No units assigned.</p>}
                                        {assignedUnits.map(unit => (
                                            <div key={unit} className="flex items-center gap-2 rounded-md bg-gray-900/70 px-3 py-2">
                                                <span className="flex-1 text-sm font-semibold text-gray-200">{unit}</span>
                                                {isEditing && (
                                                    <>
                                                        <select
                                                            value={tempUnitLocations[unit] || location}
                                                            onChange={event => setTempUnitLocations(prev => ({ ...prev, [unit]: event.target.value }))}
                                                            className="rounded-md border border-gray-600 bg-gray-950 px-2 py-1 text-xs text-white"
                                                        >
                                                            {tempLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                                        </select>
                                                        <button onClick={() => removeUnit(unit)} className="text-xs font-semibold text-red-300 hover:text-red-200">Remove</button>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {isEditing && (
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                value={newUnitByLocation[location] || ''}
                                                onChange={event => setNewUnitByLocation(prev => ({ ...prev, [location]: event.target.value }))}
                                                placeholder="New unit for this location"
                                                className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                                            />
                                            <button onClick={() => addUnitToLocation(location)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Add</button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">Assigned Training Areas</label>
                                        <span className="text-xs text-gray-600">{trainingAreas.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {trainingAreas.length === 0 && <p className="rounded-md border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-500">No training areas assigned.</p>}
                                        {trainingAreas.map(area => (
                                            <span key={area} className="inline-flex items-center gap-2 rounded-md bg-gray-900/70 px-3 py-1.5 text-sm font-semibold text-gray-200">
                                                {area}
                                                {isEditing && <button onClick={() => removeArea(location, area)} className="text-gray-500 hover:text-red-300">x</button>}
                                            </span>
                                        ))}
                                    </div>
                                    {isEditing && (
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                value={newAreaByLocation[location] || ''}
                                                onChange={event => setNewAreaByLocation(prev => ({ ...prev, [location]: event.target.value.toUpperCase() }))}
                                                placeholder="New training area"
                                                className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm uppercase text-white focus:border-sky-500 focus:outline-none"
                                            />
                                            <button onClick={() => addAreaToLocation(location)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Add</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>

            <section className="rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                <div className="border-b border-gray-700 bg-gray-900/45 px-4 py-3">
                    <h4 className="text-lg font-bold text-white">Service Branches</h4>
                    <p className="mt-1 text-sm text-gray-500">Recognised service names and short codes used when filtering personnel.</p>
                </div>
                <div className="space-y-2 p-4">
                    {displayedServices.map(service => (
                        <div key={service.shortName} className="flex items-center gap-3 rounded-md bg-gray-900/70 px-3 py-2">
                            <span className="w-16 rounded bg-gray-700 px-2 py-1 text-center font-mono text-xs font-bold text-yellow-300">{service.shortName}</span>
                            <span className="flex-1 text-sm text-gray-200">{service.longName}</span>
                            {isEditing && <button onClick={() => removeService(service.shortName)} className="text-xs font-semibold text-red-300 hover:text-red-200">Remove</button>}
                        </div>
                    ))}
                    {isEditing && (
                        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-[8rem_1fr_auto]">
                            <input
                                value={newServiceShort}
                                onChange={event => setNewServiceShort(event.target.value.toUpperCase())}
                                maxLength={6}
                                placeholder="Code"
                                className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm uppercase text-yellow-300 focus:border-sky-500 focus:outline-none"
                            />
                            <input
                                value={newServiceLong}
                                onChange={event => setNewServiceLong(event.target.value)}
                                placeholder="Service name"
                                className="rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                            />
                            <button onClick={addService} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Add</button>
                        </div>
                    )}
                </div>
            </section>

            <FormationCallsignsSection
                callsigns={formationCallsigns}
                onUpdateCallsigns={onUpdateFormationCallsigns}
                units={units}
                locations={locations}
                canEditSettings={canEditSettings}
                onAuditLog={logAudit}
            />
        </div>
    );
};

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    type ActiveSection = SettingsMenuSection | 'home';
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
        try {
            const restoreSection = sessionStorage.getItem('dfp_restore_settings_section_after_reload');
            if (restoreSection) {
                sessionStorage.removeItem('dfp_restore_settings_section_after_reload');
                if (restoreSection === 'home' || Object.prototype.hasOwnProperty.call(sectionLabels, restoreSection)) {
                    return restoreSection as ActiveSection;
                }
            }
        } catch (e) { /* ignore */ }
        return 'home';
    });
    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);
    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<Trainee[]>([]);
    const { isFrozen } = useSystemFreeze();
    const [scoringMatrixTab, setScoringMatrixTab] = useState<ScoringMatrixTab>('Airmanship');
    const [settingsSearch, setSettingsSearch] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [activeSection]);

    // Initialize filtered mockdata with instructorsData
    React.useEffect(() => {
        setFilteredMockdata(props.instructorsData);
    }, [props.instructorsData]);

    // Initialize filtered trainee mockdata
    React.useEffect(() => {
        setFilteredTraineeMockdata(props.traineesData);
    }, [props.traineesData]);

    const handleDeleteFromMockdata = (idNumber: number) => {
        setFilteredMockdata(prev => prev.filter(instructor => instructor.idNumber !== idNumber));
        props.onShowSuccess(`Staff member removed from mockdata display`);
    };

    const handleDeleteTraineeFromMockdata = (idNumber: number) => {
        setFilteredTraineeMockdata(prev => prev.filter(trainee => trainee.idNumber !== idNumber));
        props.onShowSuccess(`Trainee removed from mockdata display`);
    };

    const matchesSettingsSearch = (section: SettingsMenuSection, groupLabel: string) => {
        const query = settingsSearch.trim().toLowerCase();
        if (!query) return true;
        return [
            groupLabel,
            sectionLabels[section],
            sectionDescriptions[section],
        ].some(value => value.toLowerCase().includes(query));
    };

    const getAccentClasses = (accent: string) => {
        const classes: Record<string, { rail: string; badge: string; text: string; border: string; shadow: string }> = {
            cyan: { rail: 'bg-cyan-400', badge: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-300', border: 'border-cyan-500/30', shadow: 'hover:shadow-cyan-950/30' },
            violet: { rail: 'bg-violet-400', badge: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-300', border: 'border-violet-500/30', shadow: 'hover:shadow-violet-950/30' },
            sky: { rail: 'bg-sky-400', badge: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-300', border: 'border-sky-500/30', shadow: 'hover:shadow-sky-950/30' },
            amber: { rail: 'bg-amber-400', badge: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-300', border: 'border-amber-500/30', shadow: 'hover:shadow-amber-950/30' },
            emerald: { rail: 'bg-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', border: 'border-emerald-500/30', shadow: 'hover:shadow-emerald-950/30' },
            red: { rail: 'bg-red-400', badge: 'bg-red-500/10 border-red-500/30', text: 'text-red-300', border: 'border-red-500/30', shadow: 'hover:shadow-red-950/30' },
        };
        return classes[accent] || classes.sky;
    };

    const getSectionAccent = (section: SettingsMenuSection, fallback: string) => {
        if (section === 'emergency') return getAccentClasses('red');
        return getAccentClasses(fallback);
    };

    const getGroupId = (label: string) => `settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const visibleSettingGroups = sectionGroups
        .map(group => ({
            ...group,
            visibleSections: group.sections.filter(section => matchesSettingsSearch(section, group.label)),
        }))
        .filter(group => group.visibleSections.length > 0);
    const hasSettingsMatches = visibleSettingGroups.length > 0;
    const getDefaultSectionForGroup = (group: typeof visibleSettingGroups[number]) => {
        if (group.visibleSections.includes(group.defaultSection)) return group.defaultSection;
        return group.visibleSections[0] as SettingsMenuSection;
    };
    const activeGroup =
        activeSection === 'home'
            ? null
            : sectionGroups.find(group => group.sections.includes(activeSection as SettingsMenuSection)) || null;
    const activeGroupAccent = activeGroup ? getAccentClasses(activeGroup.accent) : null;
    const activeGroupSections = activeGroup?.sections || [];
    const activePlatformTarget =
        activeSection !== 'home' && isPlatformConfigurationMenuSection(activeSection)
            ? platformSectionTargets[activeSection]
            : undefined;
    const isPlatformConfigurationActive = Boolean(activePlatformTarget);
    const isSearchActive = settingsSearch.trim().length > 0;
    const openSettingsGroup = (group: typeof visibleSettingGroups[number]) => {
        const groupActive = activeSection !== 'home' && group.sections.includes(activeSection as SettingsMenuSection);
        const isOpen = expandedGroups[group.label] ?? groupActive;

        if (isOpen) {
            setExpandedGroups(previous => ({ ...previous, [group.label]: false }));
            return;
        }

        setExpandedGroups({ [group.label]: true });
        if (!groupActive) {
            setActiveSection(getDefaultSectionForGroup(group));
        }
    };

    return (
        <div data-settings-view="true" className="flex-1 flex overflow-hidden bg-gray-900">
            <aside className="hidden w-72 flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950/35 p-4 xl:block">
                <button
                    onClick={() => {
                        setActiveSection('home');
                        setExpandedGroups({});
                    }}
                    className={`mb-4 w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        activeSection === 'home'
                            ? 'border-sky-500/50 bg-sky-500/10 text-white'
                            : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                    }`}
                >
                    <span className="block text-sm font-bold">Settings Home</span>
                    <span className="mt-1 block text-xs text-gray-500">All configuration areas</span>
                </button>
                <div className="mb-4">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Find Setting</label>
                    <input
                        type="search"
                        value={settingsSearch}
                        onChange={(event) => setSettingsSearch(event.target.value)}
                        placeholder="Search settings..."
                        className="w-full rounded-md border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                <nav className="space-y-2">
                    {visibleSettingGroups.map(group => {
                        const accent = getAccentClasses(group.accent);
                        const groupActive = activeSection !== 'home' && group.sections.includes(activeSection);
                        const showSubmenu = isSearchActive || (expandedGroups[group.label] ?? groupActive);
                        return (
                            <div key={group.label} className={`rounded-lg border ${groupActive ? accent.border : 'border-gray-800'} ${groupActive ? 'bg-gray-900/70' : 'bg-gray-900/45'} p-2`}>
                                <button
                                    type="button"
                                    onClick={() => openSettingsGroup(group)}
                                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                                        groupActive
                                            ? `${accent.badge} ${accent.text}`
                                            : group.label === 'Emergency'
                                                ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200'
                                                : 'text-gray-200 hover:bg-gray-800'
                                    }`}
                                    aria-expanded={showSubmenu}
                                    aria-controls={getGroupId(group.label)}
                                >
                                    <span className={`h-2.5 w-2.5 rounded-full ${accent.rail}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-bold">{group.label}</span>
                                        <span className="mt-0.5 block truncate text-[11px] font-normal text-gray-500">{group.shortLabel}</span>
                                    </span>
                                    <span className="text-xs text-gray-600">{group.visibleSections.length}</span>
                                    <svg
                                        className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${showSubmenu ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                {showSubmenu && (
                                <div id={getGroupId(group.label)} className="ml-5 mt-1 space-y-0.5 border-l border-gray-800 pl-3 pt-1">
                                    {group.visibleSections.map(section => {
                                        const sectionAccent = getSectionAccent(section, group.accent);
                                        return (
                                            <button
                                                key={section}
                                                onClick={() => setActiveSection(section)}
                                                className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                                                    activeSection === section
                                                        ? `${sectionAccent.badge} ${sectionAccent.text}`
                                                        : section === 'emergency'
                                                            ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200'
                                                            : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200'
                                                }`}
                                            >
                                                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${sectionAccent.rail}`} />
                                                <span className="min-w-0">
                                                    <span className="block truncate">{sectionLabels[section]}</span>
                                                    {activeSection === section && (
                                                        <span className="mt-0.5 block whitespace-normal text-[11px] font-normal leading-snug text-gray-500">
                                                            {sectionDescriptions[section]}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
                {!hasSettingsMatches && (
                    <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-sm text-gray-400">
                        <p className="font-semibold text-gray-300">No matching settings.</p>
                        <button
                            onClick={() => setSettingsSearch('')}
                            className="mt-3 rounded-md bg-gray-700 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-600"
                        >
                            Clear Search
                        </button>
                    </div>
                )}
            </aside>

            <div ref={contentScrollRef} className="flex-1 overflow-y-auto bg-gray-900">
                <div className="p-4 sm:p-6">

                    {/* ── ICON GRID HOME ───────────────────────────────────── */}
                    {activeSection === 'home' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-gray-700 bg-gray-800/70 shadow-lg overflow-hidden">
                                <div className="flex flex-wrap items-center gap-4 border-b border-gray-700 px-5 py-4">
                                    <div className="min-w-0">
                                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Settings</h1>
                                        <p className="text-sm text-gray-400 mt-0.5">Use the chapters on the left, or the cards below, to jump directly to the setting you need.</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-[10px]">
                                        {!['Super Admin', 'Admin', 'Scheduler'].includes(props.currentUserPermission) && (
                                            <span className="text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-600/40 rounded px-2 py-1 whitespace-nowrap">
                                                Read-Only Mode
                                            </span>
                                        )}
                                        <AuditButton pageName="Settings" />
                                    </div>
                                </div>
                                <div className="p-4 lg:p-5">
                                    <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900/45 p-4 xl:hidden">
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Find Setting</label>
                                        <input
                                            type="search"
                                            value={settingsSearch}
                                            onChange={(event) => setSettingsSearch(event.target.value)}
                                            placeholder="Search settings..."
                                            className="w-full rounded-md border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                                        {visibleSettingGroups.map((group) => {
                                            const accent = getAccentClasses(group.accent);
                                            return (
                                                <section
                                                    id={getGroupId(group.label)}
                                                    key={group.label}
                                                    className={`rounded-lg border ${accent.border} bg-gray-900/45 shadow-md overflow-hidden`}
                                                >
                                                    <div className="border-b border-gray-700/80 bg-gray-800/65 px-4 py-3">
                                                        <div className="flex items-start gap-3">
                                                            <span className={`mt-1 h-9 w-1.5 rounded-full ${accent.rail}`} />
                                                            <div className="min-w-0">
                                                                <h2 className="text-lg font-bold text-white">{group.label}</h2>
                                                                <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{group.description}</p>
                                                            </div>
                                                            <span className={`ml-auto rounded border px-2 py-1 text-[11px] font-semibold ${accent.badge} ${accent.text}`}>
                                                                {group.shortLabel}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                                                        {group.visibleSections.map(section => {
                                                            const sectionAccent = getSectionAccent(section, group.accent);
                                                            return (
                                                                <button
                                                                    key={section}
                                                                    onClick={() => setActiveSection(section)}
                                                                    className={`flex min-h-[76px] w-full items-start gap-3 rounded-md border border-gray-800 bg-gray-950/35 px-3 py-3 text-left transition-colors ${
                                                                        section === 'emergency' ? 'hover:border-red-500/40 hover:bg-red-500/10' : 'hover:border-gray-700 hover:bg-gray-800/70'
                                                                    }`}
                                                                >
                                                                    <span className={`mt-1 h-2 w-2 rounded-full ${sectionAccent.rail}`} />
                                                                    <span className="min-w-0">
                                                                        <span className={`block text-sm font-semibold ${section === 'emergency' ? 'text-red-300' : 'text-gray-100'}`}>{sectionLabels[section]}</span>
                                                                        <span className="mt-0.5 block text-xs leading-snug text-gray-500">{sectionDescriptions[section]}</span>
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                </section>
                                            );
                                        })}
                                    </div>
                                    {!hasSettingsMatches && (
                                        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-8 text-center">
                                            <p className="font-semibold text-gray-300">No settings match that search.</p>
                                            <button
                                                onClick={() => setSettingsSearch('')}
                                                className="mt-3 rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SECTION CONTENT ──────────────────────────────────── */}
                    {activeSection !== 'home' && (
                    <div className="relative">
                        {/* Transparent freeze overlay — covers all section content except Emergency */}
                        {isFrozen && activeSection !== 'emergency' && (
                            <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                        )}
                        {/* Section Header with back button */}
                        <div className="mb-6 flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => setActiveSection('home')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Settings Home
                            </button>
                            <div className={`w-5 h-5 flex-shrink-0 ${sectionColors[activeSection as SettingsMenuSection]?.split(' ')[3] || 'text-sky-400'}`}>
                                {sectionIcons[activeSection as SettingsMenuSection]}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                {sectionLabels[activeSection as SettingsMenuSection]}
                            </h2>
                            <div className="ml-auto flex items-center gap-[10px]">
                                {!['Super Admin', 'Admin', 'Scheduler'].includes(props.currentUserPermission) && (
                                    <div className="text-sm text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-3 py-2">
                                        <strong>Read-Only Mode</strong>
                                    </div>
                                )}
                                <AuditButton pageName={`Settings - ${sectionLabels[activeSection as SettingsMenuSection]}`} />
                            </div>
                        </div>

                        {activeGroup && activeGroupSections.length > 1 && activeGroupAccent && (
                            <div className={`mb-5 rounded-lg border ${activeGroupAccent.border} bg-gray-900/55 p-3`}>
                                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span className={`h-2 w-2 rounded-full ${activeGroupAccent.rail}`} />
                                    {activeGroup.label}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {activeGroupSections.map(section => {
                                        const isActive = activeSection === section;
                                        const sectionAccent = getSectionAccent(section, activeGroup.accent);
                                        return (
                                            <button
                                                key={section}
                                                type="button"
                                                onClick={() => setActiveSection(section)}
                                                className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                                                    isActive
                                                        ? `${sectionAccent.badge} ${sectionAccent.text}`
                                                        : 'border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:bg-gray-800/70 hover:text-gray-200'
                                                }`}
                                            >
                                                {sectionLabels[section]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    {/* Scoring Matrix - with internal Airmanship/Preparation/Technique/Elements tabs */}
                    {activeSection === 'scoring-matrix' && (
                        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                            {/* Scoring Matrix header row: tabs + audit button */}
                            <div className="border-b border-gray-700 flex items-center justify-between pr-3">
                                {/* Internal tabs */}
                                <div className="flex">
                                    {(['Airmanship', 'Preparation', 'Technique', 'Elements'] as ScoringMatrixTab[]).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setScoringMatrixTab(tab)}
                                            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
                                                scoringMatrixTab === tab
                                                    ? 'text-sky-400 border-sky-400'
                                                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-500'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                {/* Right side: read-only badge */}
                                <div className="flex items-center space-x-3">
                                    {!['Super Admin', 'Admin'].includes(props.currentUserPermission) && (
                                        <span className="text-xs text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-2 py-1">
                                            <strong>Read-Only</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Scoring Matrix content - pass the active tab and read-only flag to SettingsView */}
                            <div className="p-4">
                                <SettingsView
                                    {...props}
                                    hideHeader={true}
                                    activeSection="scoring-matrix"
                                    scoringMatrixActiveTab={scoringMatrixTab}
                                    scoringMatrixReadOnly={!['Super Admin', 'Admin'].includes(props.currentUserPermission)}
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'locale-settings' && (
                        <LocaleSettingsSection
                            locations={props.locations}
                            onUpdateLocations={props.onUpdateLocations}
                            locationAbbreviations={props.locationAbbreviations}
                            onUpdateLocationAbbreviations={props.onUpdateLocationAbbreviations}
                            serviceDefinitions={props.serviceDefinitions}
                            onUpdateServiceDefinitions={props.onUpdateServiceDefinitions}
                            units={props.units}
                            onUpdateUnits={props.onUpdateUnits}
                            unitLocations={props.unitLocations}
                            onUpdateUnitLocations={props.onUpdateUnitLocations}
                            locationOpAreas={props.locationOpAreas}
                            onUpdateLocationOpAreas={props.onUpdateLocationOpAreas}
                            timezoneOffset={props.timezoneOffset}
                            onUpdateTimezoneOffset={props.onUpdateTimezoneOffset}
                            formationCallsigns={props.formationCallsigns}
                            onUpdateFormationCallsigns={props.onUpdateFormationCallsigns}
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                        />
                    )}

                    {activeSection === 'scheduling-rules' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                                <h3 className="text-lg font-bold text-amber-200">Scheduling Rules</h3>
                                <p className="mt-1 text-sm text-amber-100/70">Event limits, duty and turnaround rules, and dispatch constraints in one place.</p>
                            </div>
                            <SettingsView {...props} hideHeader={true} activeSection="event-limits" />
                            <SettingsView {...props} hideHeader={true} activeSection="duty-turnaround" />
                            <SettingsView {...props} hideHeader={true} activeSection="business-rules" />
                            <PlatformConfigurationSettings
                                currentUserPermission={props.currentUserPermission}
                                onShowSuccess={props.onShowSuccess}
                                scrollTarget="platform-scheduling-rule-sets"
                                sectionOnly={true}
                                canUsePlatformPermission={props.canUsePlatformPermission}
                            />
                        </div>
                    )}

                    {/* All other sections rendered via SettingsView */}
                    {activeSection !== 'scoring-matrix' &&
                     activeSection !== 'locale-settings' &&
                     activeSection !== 'scheduling-rules' &&
                     activeSection !== 'user-list' &&
                     activeSection !== 'staff-database' &&
                     activeSection !== 'staff-mockdata' &&
                     activeSection !== 'staff-combined-data' &&
                     activeSection !== 'trainee-database' &&
                     activeSection !== 'trainee-mockdata' &&
                     activeSection !== 'data-sources' &&
                     activeSection !== 'organisation' &&
                     !isPlatformConfigurationActive &&
                     activeSection !== 'appearance' &&
                     activeSection !== 'people-profile' && (
                        <SettingsView {...props} hideHeader={true} activeSection={activeSection as SettingsSection} />
                    )}

                    {/* Sections rendered directly (not via SettingsView) */}
                    {activeSection === 'user-list' && (
                        <UserListSection
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onNavigateToProfile={props.onNavigateToProfile}
                        />
                    )}
                    {activeSection === 'staff-database' && (
                        <StaffDatabaseTable 
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onDataChanged={props.onDatabaseDataChanged}
                            onNavigateToProfile={props.onNavigateToProfile}
                        />
                    )}
                    {activeSection === 'staff-mockdata' && (
                        <StaffMockDataTable
                            instructorsData={filteredMockdata}
                            onDeleteFromMockdata={handleDeleteFromMockdata}
                        />
                    )}
                    {activeSection === 'staff-combined-data' && (
                        <StaffCombinedDataTable
                            instructorsData={props.instructorsData}
                            instructorLabel={props.instructorLabel}
                            personnelDisplaySettings={props.personnelDisplaySettings}
                        />
                    )}
                    {activeSection === 'trainee-database' && (
                        <TraineeDatabaseTable 
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onDataChanged={props.onDatabaseDataChanged}
                            onNavigateToProfile={props.onNavigateToProfile}
                        />
                    )}
                    {activeSection === 'trainee-mockdata' && (
                        <TraineeMockDataTable
                            traineesData={filteredTraineeMockdata}
                            onDeleteFromMockdata={handleDeleteTraineeFromMockdata}
                        />
                    )}
                    {activeSection === 'data-sources' && (
                        <DataSourcesSettings
                            onShowSuccess={props.onShowSuccess}
                            onSettingsChanged={(newSettings) => {
                                if (props.onDataSourceSettingsChange) {
                                    props.onDataSourceSettingsChange(newSettings);
                                }
                            }}
                        />
                    )}
                    {activeSection === 'organisation' && (
                        <OrganisationSettings
                            units={props.units}
                            currentAircraftAvailable={props.currentAircraftAvailable}
                            totalAircraft={props.totalAircraft}
                            savedSettings={props.organisationSettings}
                            onSettingsChange={props.onUpdateOrganisationSettings}
                            settingsLoaded={props.settingsLoaded}
                        />
                    )}
                    {isPlatformConfigurationActive && (
                        <PlatformConfigurationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            scrollTarget={activePlatformTarget}
                            sectionOnly={true}
                            canUsePlatformPermission={props.canUsePlatformPermission}
                        />
                    )}
                    {activeSection === 'appearance' && (
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                            <AppearanceSettings />
                        </div>
                    )}
                    {activeSection === 'people-profile' && (
                        <PeopleProfilePage
                            traineesData={props.traineesData}
                            syllabusDetails={props.syllabusDetails}
                            locations={props.locations}
                            neoBuildCourse={props.neoBuildCourse || ''}
                            onUpdateNeoBuildCourse={props.onUpdateNeoBuildCourse || (() => {})}
                            excludedCourses={props.excludedCourses || []}
                            onUpdateExcludedCourses={props.onUpdateExcludedCourses || (() => {})}
                            onShowSuccess={props.onShowSuccess}
                            currentUserPermission={props.currentUserPermission}
                            courseColors={props.courseColors}
                        />
                    )}
                    {activeSection === 'historical-data' && (
                        <HistoricalDataSeeder
                            onClose={() => setActiveSection('home')}
                            onDataSeeded={() => { /* page will reload */ }}
                        />
                    )}
                    {/* End section content */}
                    </div>
                    )}

                </div>
            </div>
        </div>
    );
};
