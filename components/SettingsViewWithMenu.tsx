import React, { useEffect, useRef, useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { SettingsView } from './SettingsView';
import { UserListSection } from './UserListSection';
import StaffDatabaseTable from "./StaffDatabaseTable";
import TraineeDatabaseTable from "./TraineeDatabaseTable";
import AuditButton from './AuditButton';
import OrganisationSettings from './OrganisationSettings';
import AppearanceSettings from './AppearanceSettings';
import PlatformConfigurationSettings from './PlatformConfigurationSettings';
import PeopleProfilePage from './PeopleProfilePage';
import CurrencyBuilderView from './CurrencyBuilderView';
import { Instructor, Trainee, SyllabusItemDetail, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, CurrencyDefinition, FormationCallsign, CancellationRecord, CancellationCode } from '../types';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import type { TileStatusSettings } from '../utils/tileStatusSettings';
import type { FixedCrewTileColourMode } from '../utils/fixedCrewTileColours';
import type { DispatchStaggerSettings } from '../utils/dispatchStagger';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';

interface SettingsViewWithMenuProps {
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    locationAbbreviations?: Record<string, string>;
    onUpdateLocationAbbreviations?: (abbrevs: Record<string, string>) => void;
    serviceDefinitions?: Array<{ longName: string; shortName: string }>;
    onUpdateServiceDefinitions?: (defs: Array<{ longName: string; shortName: string }>) => void;
    units: string[];
    platformUnits?: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
    locationOpAreas?: Record<string, string[]>;
    onUpdateLocationOpAreas?: (areas: Record<string, string[]>) => void;
    instructorsData: Instructor[];
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    onShowSuccess: (message: string) => void;
    onScoringMatrixElementAdded?: (elementName: string) => void;
    onNavigateToProfile?: (user: any) => void;
    eventLimits: EventLimits;
    onUpdateEventLimits: (limits: EventLimits) => void;
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    onNavigate: (view: string) => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    activeCurrencyUnitCode?: string;
    currencyImportUnitOptions?: Array<{
        unitCode: string;
        label: string;
        currencyCount: number;
        recencyCount: number;
        usesFallback?: boolean;
    }>;
    onSaveCurrencies?: (allCurrencies: CurrencyDefinition[]) => void;
    onDeleteCurrency?: (id: string) => void;
    onImportCurrenciesFromUnit?: (unitCode: string) => void;
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    unitCurrencyDefinitions?: Record<string, {
        masterCurrencies: MasterCurrency[];
        currencyRequirements: CurrencyRequirement[];
    }>;
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
    onUpdateFormationCallsigns: (callsigns: FormationCallsign[]) => void;
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
    activeUnitCode?: string;
    activeUnitCodes?: string[];
    activeCompositeUnitCode?: string;
    activeOperationalModel?: string;
    activeUnitHasTrainees?: boolean;
    fixedCrewTileColourMode?: FixedCrewTileColourMode;
    onUpdateFixedCrewTileColourMode?: (mode: FixedCrewTileColourMode) => void;
    dispatchStaggerSettings?: DispatchStaggerSettings;
    onUpdateDispatchStaggerSettings?: (settings: DispatchStaggerSettings) => void;
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
    onDatabaseDataChanged?: () => void;  // Called when staff/trainee database is modified
    neoBuildCourse?: string;
    onUpdateNeoBuildCourse?: (course: string) => void;
    excludedCourses?: string[];
    onUpdateExcludedCourses?: (courses: string[]) => void;
    requestedSettingsSection?: {
        sectionId: string;
        unitCode?: string;
        locationCode?: string;
        resourcePoolCode?: string;
        aircraftTypeCode?: string;
        focusSubsectionId?: string;
    } | null;
    onSettingsSectionRequestHandled?: () => void;
    }

type SettingsSection =
    | 'scoring-matrix'
    | 'training-report-template'
    | 'currencies'
    | 'sct-events'
    | 'people-profile'
    | 'event-limits'
    | 'duty-turnaround'
    | 'business-rules'
    | 'data-loaders'
    | 'user-list'
    | 'staff-database'
    | 'trainee-database'
    | 'validation'
    | 'organisation'
    | 'crew-composition'
    | 'standard-missions'
    | 'currency-profiles'
    | 'appearance'
    | 'emergency';

const platformConfigurationSections = [
    'platform-configuration-health',
    'platform-organisation-locations',
    'platform-units',
    'platform-task-profiles',
    'platform-master-lmp-access',
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
type SettingsMenuSection = SettingsSection | 'scheduling-rules' | PlatformConfigurationMenuSection;

const platformSectionTargets: Record<PlatformConfigurationMenuSection, string> = {
    'platform-configuration-health': 'platform-configuration-health',
    'platform-organisation-locations': 'platform-organisation-locations',
    'platform-units': 'platform-units',
    'platform-task-profiles': 'platform-task-profiles',
    'platform-master-lmp-access': 'platform-master-lmp-access',
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

const isPlatformConfigurationMenuSection = (section: SettingsMenuSection): section is PlatformConfigurationMenuSection =>
    Object.prototype.hasOwnProperty.call(platformSectionTargets, section);

const sectionLabels: Record<SettingsMenuSection, string> = {
    'scoring-matrix': 'Scoring Matrix',
    'training-report-template': 'Training Reports',
    'currencies': 'Currencies',
    'sct-events': 'SCT Events',
    'people-profile': 'NEO Build People Profile',
    'scheduling-rules': 'Scheduling Rules',
    'event-limits': 'Event Limits',
    'duty-turnaround': 'Duty & Turnaround',
    'business-rules': 'Business Rules',
    'data-loaders': 'Import Templates',
    'user-list': 'User List',
    'staff-database': 'Staff Database',
    'trainee-database': 'Trainee Database',
    'validation': 'Cancellation Codes',
    'organisation': 'Resource Sharing',
    'crew-composition': 'Crew Composition',
    'standard-missions': 'Standard Missions',
    'currency-profiles': 'Currency Profiles',
    'platform-configuration-health': 'Configuration Health',
    'platform-organisation-locations': 'Organisation, Bases & Areas',
    'platform-units': 'Units & Ownership',
    'platform-task-profiles': 'Task Profiles',
    'platform-master-lmp-access': 'Master LMP Access',
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
  'training-report-template': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M7 3h7l3 3v15H7z"/>
      <path d="M14 3v4h4"/>
      <path d="M9 11h6M9 15h6M9 19h4"/>
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
  'data-loaders': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
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
  'validation': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <path d="M17 3.13A8 8 0 0112 2 8 8 0 015 6"/>
      <path d="M9 17l3-8 3 8M10.5 14.5h3"/>
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
  'crew-composition': platformConfigurationIcon,
  'standard-missions': platformConfigurationIcon,
  'currency-profiles': platformConfigurationIcon,
  'platform-configuration-health': platformConfigurationIcon,
  'platform-organisation-locations': platformConfigurationIcon,
  'platform-units': platformConfigurationIcon,
  'platform-task-profiles': platformConfigurationIcon,
  'platform-master-lmp-access': platformConfigurationIcon,
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
  'training-report-template': 'Configure report labels, grades and repeat rules',
  'currencies': 'Manage qualification expiry dates',
  'sct-events': 'Event scoring rules and triggers',
  'people-profile': 'Assign NEO Build training basis and exclusions',
  'scheduling-rules': 'Event limits, duty rules, turnarounds and dispatch limits',
  'event-limits': 'Define operational thresholds',
  'duty-turnaround': 'Crew duty limits & rest times',
  'business-rules': 'System logic and automation',
  'data-loaders': 'Download editable import templates',
  'user-list': 'View and manage user accounts',
  'staff-database': 'Staff records and details',
  'trainee-database': 'Trainee records and details',
  'validation': 'Master cancellation code table used by cancellation records and analytics',
  'organisation': 'Fleet sharing and multi-unit configuration',
  'crew-composition': 'Aircraft-specific crew roles and composition profiles',
  'standard-missions': 'Fixed Crew mission profiles for regular unit flights',
  'currency-profiles': 'Currency profile presets for specific currency requests',
  'platform-configuration-health': 'Configuration warnings, risks and remediation guidance',
  'platform-organisation-locations': 'Customer organisation, bases, timezones and training areas',
  'platform-units': 'Unit type, base ownership and operating status',
  'platform-task-profiles': 'Model-specific tasking lists for Directed Events',
  'platform-master-lmp-access': 'Location and unit access to Master LMPs',
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
// ACCESS & SECURITY: user-list (violet)
// DATA MANAGEMENT: data-loaders, staff-database, trainee-database (emerald)
// HISTORICAL & ANALYSIS: validation (rose)
// SYSTEM SETTINGS: organisation and platform configuration (cyan)
const sectionColors: Record<SettingsMenuSection, string> = {
  // SYSTEM CONFIGURATION - sky blue icons
  'scoring-matrix':    'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'training-report-template': 'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'currencies':        'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'sct-events':        'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'people-profile':    'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  // OPERATIONS RULES - amber icons
  'scheduling-rules':  'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'event-limits':      'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'duty-turnaround':   'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'business-rules':    'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  // ACCESS & SECURITY - violet icons
  'user-list':         'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  // DATA MANAGEMENT - emerald icons
  'data-loaders':      'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'staff-database':    'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'trainee-database':  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  // HISTORICAL & ANALYSIS - amber icons
  'validation':        'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  // SYSTEM SETTINGS - cyan icons
  'organisation':      'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'crew-composition':  'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'standard-missions': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'currency-profiles': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-configuration-health': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-organisation-locations': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-units': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-task-profiles': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-master-lmp-access': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
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
        'platform-task-profiles',
        'platform-master-lmp-access',
        'platform-resource-pools',
        'platform-unit-modules',
        'platform-deployment-readiness',
        'platform-licensing',
        'platform-rank-terminology',
        'organisation',
        'appearance',
    ],
  },
  {
    label: 'Crew Composition',
    shortLabel: 'Crew',
    description: 'Aircraft-specific crew roles, standard crew makeup and alternate tasking compositions.',
    accent: 'cyan',
    defaultSection: 'crew-composition',
    sections: [
        'crew-composition',
        'standard-missions',
        'currency-profiles',
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
    sections: ['scoring-matrix', 'training-report-template', 'sct-events', 'currencies'],
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
    description: 'Operational runbook, evidence, cancellation code governance, templates and enduring historical records.',
    accent: 'emerald',
    defaultSection: 'platform-operational-runbook',
    sections: ['platform-operational-runbook', 'validation', 'data-loaders'],
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

const highlightedCrewPageSections: SettingsMenuSection[] = ['crew-composition', 'standard-missions', 'currency-profiles'];
const isHighlightedCrewPageSection = (section: SettingsMenuSection) => highlightedCrewPageSections.includes(section);

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    type ActiveSection = SettingsMenuSection | 'home';
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const normaliseLegacySettingsSection = (section: string) => (
        section === 'platform-configuration' ? 'platform-configuration-health' : section
    );
    const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
        try {
            const restoreSection = sessionStorage.getItem('dfp_restore_settings_section_after_reload');
            if (restoreSection) {
                sessionStorage.removeItem('dfp_restore_settings_section_after_reload');
                const normalisedSection = normaliseLegacySettingsSection(restoreSection);
                if (normalisedSection === 'home' || Object.prototype.hasOwnProperty.call(sectionLabels, normalisedSection)) {
                    return normalisedSection as ActiveSection;
                }
            }
        } catch (e) { /* ignore */ }
        return 'platform-configuration-health';
    });
    const { isFrozen } = useSystemFreeze();
    const [scoringMatrixTab, setScoringMatrixTab] = useState<ScoringMatrixTab>(() => {
        try {
            const restoreTab = sessionStorage.getItem('dfp_restore_scoring_matrix_tab');
            if (restoreTab === 'Airmanship' || restoreTab === 'Preparation' || restoreTab === 'Technique' || restoreTab === 'Elements') {
                sessionStorage.removeItem('dfp_restore_scoring_matrix_tab');
                return restoreTab;
            }
        } catch (e) { /* ignore */ }
        return 'Airmanship';
    });
    const [settingsSearch, setSettingsSearch] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const settingsGroupOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [settingsFocusTarget, setSettingsFocusTarget] = useState<{
        unitCode?: string;
        locationCode?: string;
        resourcePoolCode?: string;
        aircraftTypeCode?: string;
        userId?: string;
        focusSubsectionId?: string;
    } | null>(null);
    const [embeddedCurrencyBuilderOpen, setEmbeddedCurrencyBuilderOpen] = useState(false);

    const changeActiveSection = (section: ActiveSection) => {
        if (section !== 'currencies') {
            setEmbeddedCurrencyBuilderOpen(false);
        }
        setActiveSection(section);
    };

    useEffect(() => {
        const request = props.requestedSettingsSection;
        if (!request?.sectionId) return;
        const requestedSection = normaliseLegacySettingsSection(request.sectionId);
        if (requestedSection === 'home' || Object.prototype.hasOwnProperty.call(sectionLabels, requestedSection)) {
            setSettingsFocusTarget({
                unitCode: request.unitCode,
                locationCode: request.locationCode,
                resourcePoolCode: request.resourcePoolCode,
                aircraftTypeCode: request.aircraftTypeCode,
                focusSubsectionId: request.focusSubsectionId,
            });
            changeActiveSection(requestedSection as ActiveSection);
            props.onSettingsSectionRequestHandled?.();
        }
    }, [props.requestedSettingsSection]);

    useEffect(() => {
        let restoreScrollTop: number | null = null;
        try {
            const restoreValue = sessionStorage.getItem('dfp_restore_settings_scroll_top_after_reload');
            if (restoreValue !== null) {
                sessionStorage.removeItem('dfp_restore_settings_scroll_top_after_reload');
                const parsed = Number(restoreValue);
                if (Number.isFinite(parsed) && parsed >= 0) restoreScrollTop = parsed;
            }
        } catch (e) { /* ignore */ }

        contentScrollRef.current?.scrollTo({ top: restoreScrollTop ?? 0, left: 0, behavior: 'auto' });
    }, [activeSection]);

    useEffect(() => () => {
        if (settingsGroupOpenTimerRef.current) {
            clearTimeout(settingsGroupOpenTimerRef.current);
        }
    }, []);

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
    const isFixedCrewSettingsContext = isFixedCrewLikeOperationalModel(props.activeOperationalModel);
    const isSectionAvailable = (section: SettingsMenuSection) => (
        section !== 'standard-missions' || isFixedCrewSettingsContext
    );
    const visibleSettingGroups = sectionGroups
        .map(group => ({
            ...group,
            visibleSections: group.sections.filter(section => isSectionAvailable(section) && matchesSettingsSearch(section, group.label)),
        }))
        .filter(group => group.visibleSections.length > 0);
    const hasSettingsMatches = visibleSettingGroups.length > 0;
    const getDefaultSectionForGroup = (group: typeof visibleSettingGroups[number]) => {
        if (group.visibleSections.includes(group.defaultSection)) return group.defaultSection;
        return group.visibleSections[0] as SettingsMenuSection;
    };
    const activePlatformTarget =
        activeSection !== 'home' && isPlatformConfigurationMenuSection(activeSection)
            ? platformSectionTargets[activeSection]
            : undefined;
    const isPlatformConfigurationActive = Boolean(activePlatformTarget);
    const isSearchActive = settingsSearch.trim().length > 0;
    const navigateToSettingsSection = (section: string | {
        section: string;
        focusUnitCode?: string;
        focusLocationCode?: string;
        focusResourcePoolCode?: string;
        focusAircraftTypeCode?: string;
        focusUserId?: string;
        focusSubsectionId?: string;
    }) => {
        const target = typeof section === 'string' ? { section } : section;
        const targetSection = normaliseLegacySettingsSection(String(target.section || ''));
        if (!Object.prototype.hasOwnProperty.call(sectionLabels, targetSection)) return;
        setSettingsFocusTarget({
            unitCode: target.focusUnitCode,
            locationCode: target.focusLocationCode,
            resourcePoolCode: target.focusResourcePoolCode,
            aircraftTypeCode: target.focusAircraftTypeCode,
            userId: target.focusUserId,
            focusSubsectionId: target.focusSubsectionId,
        });
        setExpandedGroups({});
        changeActiveSection(targetSection as ActiveSection);
    };
    const openSettingsGroup = (group: typeof visibleSettingGroups[number]) => {
        if (settingsGroupOpenTimerRef.current) {
            clearTimeout(settingsGroupOpenTimerRef.current);
            settingsGroupOpenTimerRef.current = null;
        }
        const groupActive = activeSection !== 'home' && group.sections.includes(activeSection as SettingsMenuSection);
        const isOpen = expandedGroups[group.label] === true;

        if (isOpen) {
            setExpandedGroups(previous => ({ ...previous, [group.label]: false }));
            return;
        }

        const openSelectedGroup = () => {
            setExpandedGroups({ [group.label]: true });
            if (!groupActive) {
                changeActiveSection(getDefaultSectionForGroup(group));
            }
            settingsGroupOpenTimerRef.current = null;
        };
        const anotherGroupOpen = !isSearchActive && visibleSettingGroups.some(candidate => (
            candidate.label !== group.label
            && expandedGroups[candidate.label] === true
        ));

        if (anotherGroupOpen) {
            setExpandedGroups(visibleSettingGroups.reduce<Record<string, boolean>>((next, candidate) => {
                next[candidate.label] = false;
                return next;
            }, {}));
            settingsGroupOpenTimerRef.current = setTimeout(openSelectedGroup, 210);
            return;
        }

        openSelectedGroup();
    };

    return (
        <div data-settings-view="true" className="flex-1 flex overflow-hidden bg-gray-900" onKeyDownCapture={stopEditableKeyPropagation}>
            <aside className="hidden w-[258px] flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950/35 p-4 xl:block">
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
                <nav className="mt-[30px] flex flex-col items-center gap-[1px]">
                    {visibleSettingGroups.map(group => {
                        const groupActive = activeSection !== 'home' && group.sections.includes(activeSection);
                        const showSubmenu = isSearchActive || expandedGroups[group.label] === true;
                        return (
                            <div key={group.label} className="w-[175px]">
                                <button
                                    type="button"
                                    onClick={() => openSettingsGroup(group)}
                                    className={`btn-aluminium-brushed flex h-[45px] w-[175px] items-center gap-2 rounded-md px-3 text-left text-[10px] font-semibold leading-tight !text-black transition-colors ${
                                        groupActive ? 'ring-1 ring-gray-500/60' : ''
                                    }`}
                                    aria-expanded={showSubmenu}
                                    aria-controls={getGroupId(group.label)}
                                >
                                    <span className="min-w-0 flex-1 text-center">
                                        <span className="block whitespace-normal break-words">{group.label}</span>
                                    </span>
                                    <svg
                                        className={`h-3 w-3 flex-shrink-0 transition-transform ${showSubmenu ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <div
                                    id={getGroupId(group.label)}
                                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                                        showSubmenu ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                >
                                    <div className="min-h-0 overflow-hidden">
                                        <div className="space-y-[1px] py-[1px]">
                                            {group.visibleSections.map(section => {
                                                return (
                                                    <button
                                                        key={section}
                                                        onClick={() => changeActiveSection(section)}
                                                        className={`flex min-h-[32px] w-[175px] items-center rounded-md border px-3 text-left text-[10px] font-semibold leading-tight transition-colors ${
                                                            activeSection === section
                                                                ? 'border-gray-500 bg-gray-800 text-gray-100'
                                                                : section === 'emergency'
                                                                    ? 'border-gray-800 bg-gray-950/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                                    : 'border-gray-800 bg-gray-950/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                        }`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate">{sectionLabels[section]}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
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

            <div ref={contentScrollRef} data-settings-content-scroll="true" className="flex-1 overflow-y-auto bg-gray-900">
                <div className="p-4 sm:p-6">

                    {/* ── SETTINGS HOME ───────────────────────────────────── */}
                    {activeSection === 'home' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-gray-700 bg-gray-800/70 shadow-lg overflow-hidden">
                                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                                    <div className="min-w-0">
                                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Settings</h1>
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
                                <div className="border-t border-gray-700 p-4 lg:p-5 xl:hidden">
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
                                onClick={() => changeActiveSection('home')}
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
                                    activeSection="scoring-matrix"
                                    scoringMatrixActiveTab={scoringMatrixTab}
                                    scoringMatrixReadOnly={!['Super Admin', 'Admin'].includes(props.currentUserPermission)}
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'scheduling-rules' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                                <h3 className="text-lg font-bold text-amber-200">Scheduling Rules</h3>
                                <p className="mt-1 text-sm text-amber-100/70">Event limits, duty and turnaround rules, and dispatch constraints in one place.</p>
                            </div>
                            <SettingsView {...props} activeSection="event-limits" />
                            <SettingsView {...props} activeSection="duty-turnaround" />
                            <SettingsView {...props} activeSection="business-rules" />
                            <PlatformConfigurationSettings
                                currentUserPermission={props.currentUserPermission}
                                onShowSuccess={props.onShowSuccess}
                                scrollTarget="platform-scheduling-rule-sets"
                                sectionOnly={true}
                                canUsePlatformPermission={props.canUsePlatformPermission}
                                activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                                onNavigateToSettingsSection={navigateToSettingsSection}
                                activeUnitCodes={props.activeUnitCodes}
                                activeCompositeUnitCode={props.activeCompositeUnitCode}
                                phraseBank={props.phraseBank}
                                masterCurrencies={props.masterCurrencies}
                                currencyRequirements={props.currencyRequirements}
                                syllabusDetails={props.syllabusDetails}
                                unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                            />
                        </div>
                    )}

                    {activeSection === 'training-report-template' && (
                        <PlatformConfigurationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            scrollTarget="platform-training-report-template"
                            sectionOnly={true}
                            canUsePlatformPermission={props.canUsePlatformPermission}
                            activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                            onNavigateToSettingsSection={navigateToSettingsSection}
                            activeUnitCodes={props.activeUnitCodes}
                            activeCompositeUnitCode={props.activeCompositeUnitCode}
                            phraseBank={props.phraseBank}
                            masterCurrencies={props.masterCurrencies}
                            currencyRequirements={props.currencyRequirements}
                            syllabusDetails={props.syllabusDetails}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                        />
                    )}

                    {activeSection === 'crew-composition' && (
                        <PlatformConfigurationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            scrollTarget="platform-crew-composition"
                            sectionOnly={true}
                            canUsePlatformPermission={props.canUsePlatformPermission}
                            activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                            onNavigateToSettingsSection={navigateToSettingsSection}
                            activeUnitCodes={props.activeUnitCodes}
                            activeCompositeUnitCode={props.activeCompositeUnitCode}
                            activeOperationalModel={props.activeOperationalModel}
                            phraseBank={props.phraseBank}
                            masterCurrencies={props.masterCurrencies}
                            currencyRequirements={props.currencyRequirements}
                            syllabusDetails={props.syllabusDetails}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                        />
                    )}

                    {activeSection === 'standard-missions' && (
                        <PlatformConfigurationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            scrollTarget="platform-standard-missions"
                            sectionOnly={true}
                            canUsePlatformPermission={props.canUsePlatformPermission}
                            activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                            onNavigateToSettingsSection={navigateToSettingsSection}
                            activeUnitCodes={props.activeUnitCodes}
                            activeCompositeUnitCode={props.activeCompositeUnitCode}
                            activeOperationalModel={props.activeOperationalModel}
                            phraseBank={props.phraseBank}
                            masterCurrencies={props.masterCurrencies}
                            currencyRequirements={props.currencyRequirements}
                            syllabusDetails={props.syllabusDetails}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                        />
                    )}

                    {activeSection === 'currency-profiles' && (
                        <PlatformConfigurationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            scrollTarget="platform-currency-profiles"
                            sectionOnly={true}
                            canUsePlatformPermission={props.canUsePlatformPermission}
                            activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                            onNavigateToSettingsSection={navigateToSettingsSection}
                            activeUnitCodes={props.activeUnitCodes}
                            activeCompositeUnitCode={props.activeCompositeUnitCode}
                            activeOperationalModel={props.activeOperationalModel}
                            phraseBank={props.phraseBank}
                            masterCurrencies={props.masterCurrencies}
                            currencyRequirements={props.currencyRequirements}
                            syllabusDetails={props.syllabusDetails}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                        />
                    )}

                    {/* All other sections rendered via SettingsView */}
                    {activeSection !== 'scoring-matrix' &&
                     activeSection !== 'scheduling-rules' &&
                     activeSection !== 'training-report-template' &&
                     activeSection !== 'crew-composition' &&
                     activeSection !== 'standard-missions' &&
                     activeSection !== 'currency-profiles' &&
                     activeSection !== 'user-list' &&
                     activeSection !== 'staff-database' &&
                     activeSection !== 'trainee-database' &&
                     activeSection !== 'organisation' &&
                     !isPlatformConfigurationActive &&
                     activeSection !== 'appearance' &&
                     activeSection !== 'people-profile' && (
                        activeSection === 'currencies' && embeddedCurrencyBuilderOpen ? (
                            <div className="h-[calc(100vh-220px)] min-h-[620px] overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
                                <CurrencyBuilderView
                                    onBack={() => setEmbeddedCurrencyBuilderOpen(false)}
                                    masterCurrencies={props.masterCurrencies}
                                    currencyRequirements={props.currencyRequirements}
                                    activeUnitCode={props.activeCurrencyUnitCode || props.activeUnitCode}
                                    importUnitOptions={props.currencyImportUnitOptions || []}
                                    onSave={props.onSaveCurrencies || (() => {})}
                                    onDelete={props.onDeleteCurrency || (() => {})}
                                    onImportFromUnit={props.onImportCurrenciesFromUnit}
                                    aircraftCrewComposition={props.aircraftCrewComposition}
                                    crewPositionTerminology={props.crewPositionTerminology}
                                    operationalModel={props.activeOperationalModel}
                                />
                            </div>
                        ) : (
                            <SettingsView
                                {...props}
                                activeSection={activeSection as SettingsSection}
                                onOpenCurrencyBuilder={() => setEmbeddedCurrencyBuilderOpen(true)}
                            />
                        )
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
                    {activeSection === 'trainee-database' && (
                        <TraineeDatabaseTable 
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onDataChanged={props.onDatabaseDataChanged}
                            onNavigateToProfile={props.onNavigateToProfile}
                        />
                    )}
                    {activeSection === 'organisation' && (
                        <OrganisationSettings
                            units={(props.platformUnits && props.platformUnits.length > 0) ? props.platformUnits : props.units}
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
                            activeUnitCode={props.activeUnitCode}
                                focusUnitCode={settingsFocusTarget?.unitCode}
                                focusLocationCode={settingsFocusTarget?.locationCode}
                                focusResourcePoolCode={settingsFocusTarget?.resourcePoolCode}
                                focusAircraftTypeCode={settingsFocusTarget?.aircraftTypeCode}
                                focusUserId={settingsFocusTarget?.userId}
                                focusSubsectionId={settingsFocusTarget?.focusSubsectionId}
                            onNavigateToSettingsSection={navigateToSettingsSection}
                            activeUnitCodes={props.activeUnitCodes}
                            activeCompositeUnitCode={props.activeCompositeUnitCode}
                            phraseBank={props.phraseBank}
                            masterCurrencies={props.masterCurrencies}
                            currencyRequirements={props.currencyRequirements}
                            syllabusDetails={props.syllabusDetails}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                            formationCallsigns={props.formationCallsigns}
                            onUpdateFormationCallsigns={props.onUpdateFormationCallsigns}
                        />
                    )}
                    {activeSection === 'appearance' && (
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                            <AppearanceSettings
                                activeOperationalModel={props.activeOperationalModel}
                                activeUnitCode={props.activeUnitCode}
                                fixedCrewTileColourMode={props.fixedCrewTileColourMode}
                                onUpdateFixedCrewTileColourMode={props.onUpdateFixedCrewTileColourMode}
                            />
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
                    {/* End section content */}
                    </div>
                    )}

                </div>
            </div>
        </div>
    );
};
