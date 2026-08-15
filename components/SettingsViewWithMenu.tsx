import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { SettingsView } from './SettingsView';
import { UserListSection } from './UserListSection';
import StaffDatabaseTable from "./StaffDatabaseTable";
import TraineeDatabaseTable from "./TraineeDatabaseTable";
import AuditButton from './AuditButton';
import OrganisationSettings from './OrganisationSettings';
import AppearanceSettings from './AppearanceSettings';
import PlatformConfigurationSettings from './PlatformConfigurationSettings';
import EmailActivationSettings from './EmailActivationSettings';
import PeopleProfilePage from './PeopleProfilePage';
import CurrencyBuilderView from './CurrencyBuilderView';
import { Instructor, Trainee, SyllabusItemDetail, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, CurrencyDefinition, FormationCallsign, CancellationRecord, CancellationCode } from '../types';
import {
    handleEditableTextBeforeInput,
    handleEditableTextKeyDownCapture,
    isEditableElement,
    stopEditableKeyPropagation,
} from '../utils/editableKeyEvents';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import type { TileStatusSettings } from '../utils/tileStatusSettings';
import type { FixedCrewTileColourMode } from '../utils/fixedCrewTileColours';
import type { DispatchStaggerSettings } from '../utils/dispatchStagger';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { DEFAULT_SCT_TERMINOLOGY, type SctTerminology } from '../utils/sctTerminology';
import type { EmergencyFreezeAuthoritySettings } from '../utils/emergencyFreezeAuthority';
import type { StaffQualificationDefinition } from '../utils/staffQualifications';
import type { PlatformConfig } from '../utils/platformConfigService';

interface SettingsViewWithMenuProps {
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    locationAbbreviations?: Record<string, string>;
    onUpdateLocationAbbreviations?: (abbrevs: Record<string, string>) => void;
    serviceDefinitions?: Array<{ longName: string; shortName: string }>;
    onUpdateServiceDefinitions?: (defs: Array<{ longName: string; shortName: string }>) => void;
    units: string[];
    platformUnits?: string[];
    platformUnitContexts?: Array<{
        unitCode: string;
        locationCode?: string | null;
        aircraftTypeCode?: string | null;
        parentOrganisationCode?: string | null;
        operationalModel?: string | null;
    }>;
    platformConfig?: PlatformConfig | null;
    settingsVisibilityPolicy?: {
        enabled?: boolean;
        filters?: Array<'unit' | 'location' | 'aircraftType' | 'parentOrganisation'>;
    } | null;
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
    aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
    crewPositionTerminology?: CrewPositionTerminology;
    unitCurrencyDefinitions?: Record<string, {
        masterCurrencies: MasterCurrency[];
        currencyRequirements: CurrencyRequirement[];
    }>;
    sctEvents: any[];
    onUpdateSctEvents: (events: any[]) => void;
    sctTerminology?: SctTerminology;
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
    trainingReportDisplayName?: string;
    emergencyFreezeAuthority?: EmergencyFreezeAuthoritySettings;
    onUpdateEmergencyFreezeAuthority?: (settings: EmergencyFreezeAuthoritySettings) => void;
    qualificationOptions?: StaffQualificationDefinition[];
    currentUserQualificationIds?: string[];
    instructorLabel?: string;
    canUsePlatformPermission?: (permissionId: string) => boolean;
    activeUnitCode?: string;
    activeUnitCodes?: string[];
    activeCompositeUnitCode?: string;
    activeAircraftTypeCode?: string | null;
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
    | 'trainee-reallocation'
    | 'validation'
    | 'organisation'
    | 'crew-composition'
    | 'standard-missions'
    | 'currency-profiles'
    | 'appearance'
    | 'email-activation'
    | 'emergency';

const platformConfigurationSections = [
    'platform-configuration-health',
    'platform-organisation-locations',
    'platform-units',
    'platform-task-profiles',
    'platform-master-lmp-access',
    'platform-aircraft-setup',
    'platform-dfp-resource-rows',
    'platform-unit-modules',
    'platform-settings-visibility',
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
type ActiveSection = SettingsMenuSection | 'home';

const platformSectionTargets: Record<PlatformConfigurationMenuSection, string> = {
    'platform-configuration-health': 'platform-configuration-health',
    'platform-organisation-locations': 'platform-organisation-locations',
    'platform-units': 'platform-units',
    'platform-task-profiles': 'platform-task-profiles',
    'platform-master-lmp-access': 'platform-master-lmp-access',
    'platform-aircraft-setup': 'platform-aircraft-setup',
    'platform-dfp-resource-rows': 'platform-dfp-resource-rows',
    'platform-unit-modules': 'platform-unit-modules',
    'platform-settings-visibility': 'platform-settings-visibility',
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
    'currencies': 'Currency Requirements',
    'sct-events': 'ContT / Currency Events',
    'people-profile': 'NEO Build Course Exclusions',
    'scheduling-rules': 'Scheduling Rules',
    'event-limits': 'Daily Event Limits',
    'duty-turnaround': 'Duty & Turnaround',
    'business-rules': 'Business Rules',
    'data-loaders': 'Template Downloads',
    'user-list': 'User List',
    'staff-database': 'Staff Database',
    'trainee-database': 'Trainee Database',
    'trainee-reallocation': 'Trainee Reallocation',
    'validation': 'Cancellation Codes',
    'organisation': 'Resource Sharing',
    'crew-composition': 'Crew Composition',
    'standard-missions': 'Directed Task Setups',
    'currency-profiles': 'ContT / Currency Events',
    'platform-configuration-health': 'Configuration Health',
    'platform-organisation-locations': 'Organisation, Bases & Areas',
    'platform-units': 'Units & Ownership',
    'platform-task-profiles': 'Directed Task Lists',
    'platform-master-lmp-access': 'Master LMP Access',
    'platform-aircraft-setup': 'Aircraft Setup',
    'platform-dfp-resource-rows': 'DFP Resource Rows',
    'platform-unit-modules': 'Unit Features & Modules',
    'platform-settings-visibility': 'Settings Visibility',
    'platform-deployment-readiness': 'Deployment Readiness',
    'platform-operational-runbook': 'Operational Runbook',
    'platform-licensing': 'Licensing & Deployment',
    'platform-permission-profiles': 'Permission Profiles',
    'platform-rank-terminology': 'Rank, Terminology & Labels',
    'platform-user-access': 'User Access Scopes',
    'platform-scheduling-rule-sets': 'Scheduling Rule Sets',
    'appearance': 'App Appearance',
    'email-activation': 'Email & Account Activation',
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
  'trainee-reallocation': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M16 3h5v5"/>
      <path d="M21 3l-7 7"/>
      <path d="M8 21H3v-5"/>
      <path d="M3 21l7-7"/>
      <circle cx="7" cy="7" r="3"/>
      <circle cx="17" cy="17" r="3"/>
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
  'email-activation': platformConfigurationIcon,
  'platform-configuration-health': platformConfigurationIcon,
  'platform-organisation-locations': platformConfigurationIcon,
  'platform-units': platformConfigurationIcon,
  'platform-task-profiles': platformConfigurationIcon,
  'platform-master-lmp-access': platformConfigurationIcon,
  'platform-aircraft-setup': platformConfigurationIcon,
  'platform-dfp-resource-rows': platformConfigurationIcon,
  'platform-unit-modules': platformConfigurationIcon,
  'platform-settings-visibility': platformConfigurationIcon,
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
  'scoring-matrix': 'Configure report elements, grades and performance text',
  'training-report-template': 'Configure report labels, grades and repeat rules',
  'currencies': 'Manage currency expiry requirements',
  'sct-events': 'Configure ContT and currency event settings',
  'people-profile': 'Select courses that NEO Build should leave out of schedule generation',
  'scheduling-rules': 'Event limits, duty rules, turnarounds and dispatch limits',
  'event-limits': 'Set daily event limits and duty supervisor session limits',
  'duty-turnaround': 'Crew duty limits & rest times',
  'business-rules': 'Dispatch rate, stagger and flight tile warning rules',
  'data-loaders': 'Download blank upload templates',
  'user-list': 'View and manage user accounts',
  'staff-database': 'Staff records and details',
  'trainee-database': 'Trainee records and details',
  'trainee-reallocation': 'Preview trainee instructor allocation across configured units',
  'validation': 'Master cancellation code table used by cancellation records and analytics',
  'organisation': 'Fleet sharing and multi-unit configuration',
  'crew-composition': 'Aircraft-specific crew roles, crew seats and alternate crew setups',
  'standard-missions': 'Full reusable directed tasks with aircraft, crew, timing and callsign settings',
  'currency-profiles': 'Configure ContT and currency event settings',
  'platform-configuration-health': 'Configuration warnings, risks and remediation guidance',
  'platform-organisation-locations': 'Customer organisation, bases, timezones and training areas',
  'platform-units': 'Unit type, base ownership and operating status',
  'platform-task-profiles': 'Short directed task names by operational model',
  'platform-master-lmp-access': 'Location and unit access to Master LMPs',
  'platform-aircraft-setup': 'Aircraft capability, cruise planning and crew seats',
  'platform-dfp-resource-rows': 'DFP row counts, ownership, labels and numbering',
  'platform-unit-modules': 'Enable features and modules for each unit',
  'platform-settings-visibility': 'Control which settings records are visible using unit, location, aircraft type and organisation filters',
  'platform-deployment-readiness': 'SaaS, on-premise, offline and hybrid readiness checks',
  'platform-operational-runbook': 'Support, backup, restore, update and accreditation records',
  'platform-licensing': 'Licence model, entitlements and validation status',
  'platform-permission-profiles': 'Reusable permission profiles for user roles',
  'platform-rank-terminology': 'Rank ordering and local instructor terminology',
  'platform-user-access': 'Control where each user can work',
  'platform-scheduling-rule-sets': 'Scheduling rules for selected units, aircraft and operating areas',
  'appearance': 'Choose dark or light display theme',
  'email-activation': 'Customer SMTP and activation email delivery settings',
  'emergency': 'System freeze and emergency controls',
};

const sectionSearchKeywords: Partial<Record<SettingsMenuSection, string[]>> = {
  'scoring-matrix': [
    'score', 'scoring', 'matrix', 'grades', 'grade', 'elements', 'airmanship', 'preparation', 'technique',
    'assessment', 'standards', 'rubric', 'performance text', 'overall assessment', 'pass fail', 'satisfactory',
  ],
  'training-report-template': [
    'training report', 'reports', 'trg rep', 'pt051', 'pt-051', 'assessment report', 'mission status',
    'results', 'grades', 'completion results', 'phrase bank', 'organisation form name', 'generic form name',
    'instructor', 'overall assessment', 'delete report', 'add training report', 'staff profile',
  ],
  'currencies': [
    'currency', 'currencies', 'recency', 'expiry', 'expiration', 'currency requirements', 'logic tree',
    'primitive', 'composite', 'post flight currency', 'post flight recency', 'checklist', 'qualification',
  ],
  'sct-events': [
    'contt', 'continuation', 'continuation training', 'currency events', 'sct', 'ctt', 'event profiles',
    'currency ride', 'recency event', 'training event', 'continuation currency',
  ],
  'currency-profiles': [
    'contt', 'continuation', 'continuation training', 'currency events', 'sct', 'ctt', 'event profiles',
    'currency ride', 'recency event', 'training event', 'continuation currency',
  ],
  'people-profile': [
    'course exclusions', 'excluded courses', 'neo build exclusions', 'leave out', 'exclude course',
    'course filter', 'do not schedule', 'build exclude',
  ],
  'scheduling-rules': [
    'schedule rules', 'scheduling', 'neo build rules', 'build rules', 'limits', 'turnaround', 'dispatch',
    'stagger', 'duty', 'rest', 'business rules', 'aircraft turnaround', 'pre flight', 'post flight',
  ],
  'event-limits': [
    'daily limits', 'event limits', 'max events', 'maximum events', 'student limits', 'instructor limits',
    'duty supervisor sessions', 'sessions per day', 'daily event limits',
  ],
  'duty-turnaround': [
    'duty', 'turnaround', 'rest', 'crew duty', 'max crew duty', 'preferred duty', 'flight turnaround',
    'ftd turnaround', 'cpt turnaround', 'pre flight', 'post flight', 'booking window',
  ],
  'business-rules': [
    'business rules', 'dispatch', 'dispatch rate', 'dispatch stagger', 'stagger', 'hourly event rate',
    'warning colours', 'tile warnings', 'authorisation warning', 'departure density',
  ],
  'data-loaders': [
    'template', 'templates', 'download', 'upload', 'bulk upload', 'csv', 'spreadsheet', 'blank template',
    'staff template', 'trainee template', 'data import',
  ],
  'user-list': [
    'users', 'user list', 'accounts', 'login', 'password', 'change password', 'sign in', 'access',
    'roles', 'staff account', 'trainee account', 'active access',
  ],
  'staff-database': [
    'staff', 'staff database', 'instructors', 'qfi', 'ofi', 'cfi', 'archive staff', 'restore staff',
    'qualifications', 'rank', 'service number', 'id number', 'staff records',
  ],
  'trainee-database': [
    'trainee', 'trainees', 'student', 'students', 'trainee database', 'archive trainee', 'restore trainee',
    'course', 'lmp', 'primary instructor', 'secondary instructor', 'trainee records',
  ],
  'trainee-reallocation': [
    'reallocate', 'reallocation', 'allocate trainee', 'instructor allocation', 'primary instructor',
    'secondary instructor', 'preview allocation', 'course supervisor',
  ],
  'validation': [
    'cancellation', 'cancellation codes', 'cancel codes', 'dnco', 'dpco', 'dco', 'cancelled',
    'validation', 'analytics cancellation', 'active code', 'inactive code',
  ],
  'organisation': [
    'resource sharing', 'fleet sharing', 'staff sharing', 'multi unit', 'combined unit', 'allocation',
    'organisation settings', 'shared pool', 'combined pool', 'fixed allocation',
  ],
  'crew-composition': [
    'crew composition', 'crew', 'crew seats', 'seat roles', 'pilot', 'wso', 'loadmaster', 'mpro',
    'awo', 'aro', 'ewo', 'trainee', 'alternate crew', 'crew groups', 'fixed crew',
  ],
  'standard-missions': [
    'directed task', 'directed task setup', 'mission', 'standard mission', 'task setup', 'duration',
    'callsign', 'formation', 'role requirements', 'mission profiles',
  ],
  'platform-configuration-health': [
    'configuration health', 'health', 'warnings', 'advisories', 'critical', 'assurance', 'setup gaps',
    'commercial configuration', 'save blocker', 'remediation', 'audit',
  ],
  'platform-organisation-locations': [
    'organisation', 'organization', 'parent organisation', 'bases', 'areas', 'locations', 'airfields',
    'icao', 'iata', 'timezone', 'utc', 'latitude', 'longitude', 'training areas', 'base', 'airfield',
  ],
  'platform-units': [
    'units', 'ownership', 'unit ownership', 'aircraft operated', 'operational model', 'flight school',
    'air combat', 'fixed crew', 'pooled crew', 'unit type', 'home base', 'location ownership',
  ],
  'platform-task-profiles': [
    'directed task list', 'task lists', 'task abbreviations', 'task names', 'model task',
    'operational model tasks', 'directed tasks',
  ],
  'platform-master-lmp-access': [
    'master lmp', 'lmp access', 'master lmp access', 'syllabus access', 'course access',
    'assign lmp', 'view lmp', 'manage lmp',
  ],
  'platform-aircraft-setup': [
    'aircraft setup', 'aircraft type', 'aircraft code', 'aircraft name', 'category', 'cruise speed',
    'cruise level', 'altitude', 'crew seats', 'role eligibility', 'aircraft configurations',
    'configuration', 'delete aircraft', 'add aircraft', 'pc-21', 'c-17', 'p-8',
  ],
  'platform-dfp-resource-rows': [
    'dfp resource rows', 'resource rows', 'row sets', 'dfp rows', 'aircraft rows', 'row count',
    'simulator rows', 'ftd', 'cpt', 'trainer', 'standby', 'ground', 'prefix', 'numbering',
    'display labels', 'resource row labels', 'duty sup', 'duty supervisor', 'twr di',
    'tower duty instructor', 'resource ownership', 'aircraft availability rows',
  ],
  'platform-unit-modules': [
    'unit features', 'modules', 'feature modules', 'enable module', 'disable module',
    'unit capability', 'features',
  ],
  'platform-settings-visibility': [
    'settings visibility', 'visibility', 'filters', 'unit filter', 'location filter',
    'aircraft type filter', 'organisation filter', 'record visibility',
  ],
  'platform-deployment-readiness': [
    'deployment readiness', 'readiness', 'saas', 'on prem', 'on-prem', 'offline', 'hybrid',
    'secure operation', 'diagnostics', 'accreditation', 'deployment checks',
  ],
  'platform-operational-runbook': [
    'operational runbook', 'runbook', 'support', 'backup', 'restore', 'updates', 'evidence',
    'incident', 'maintenance', 'operations record',
  ],
  'platform-licensing': [
    'licensing', 'licence', 'license', 'deployment', 'entitlements', 'signed licence',
    'validation status', 'subscription', 'activation',
  ],
  'email-activation': [
    'email', 'mail', 'smtp', 'activation email', 'account activation', 'login activation',
    'temporary password', 'two part password', 'from address', 'no reply', 'mail server',
    'customer smtp', 'test email', 'activation expiry',
  ],
  'platform-permission-profiles': [
    'permission profiles', 'permissions', 'permission', 'roles', 'access role', 'admin rights',
    'scheduler rights', 'viewer', 'profile',
  ],
  'platform-rank-terminology': [
    'rank', 'terminology', 'labels', 'instructor label', 'trainee label', 'staff sort',
    'rank order', 'service ranks', 'people labels',
  ],
  'platform-user-access': [
    'user access', 'access scopes', 'scope', 'location access', 'unit access', 'module access',
    'active access', 'login access', 'user permissions',
  ],
  'platform-scheduling-rule-sets': [
    'scheduling rule sets', 'rule sets', 'scheduler rules', 'aircraft rules', 'unit rules',
    'operating areas', 'course priority', 'package priority', 'build rules',
  ],
  'appearance': [
    'appearance', 'theme', 'dark', 'light', 'display', 'colour', 'color', 'fixed crew tile colour',
    'tile colour', 'visual style',
  ],
  'emergency': [
    'emergency', 'freeze', 'system freeze', 'pause', 'lock', 'unlock', 'authority',
    'emergency freeze', 'qualification authority',
  ],
};

const SEARCH_VALUE_KEY_HINTS = [
  'code', 'name', 'label', 'title', 'description', 'category', 'type', 'model', 'status', 'role',
  'unit', 'location', 'organisation', 'organization', 'aircraft', 'resource', 'pool', 'prefix',
  'callsign', 'course', 'lmp', 'mission', 'task', 'currency', 'qualification', 'rank', 'service',
  'username', 'email', 'id', 'iata', 'icao', 'timezone', 'area', 'module', 'permission', 'profile',
  'licence', 'license', 'deployment', 'result', 'grade', 'cancellation', 'reason', 'configuration',
  'definition',
];

const isSearchableDataKey = (key: string): boolean => {
  const normalisedKey = key.toLowerCase();
  return SEARCH_VALUE_KEY_HINTS.some(hint => normalisedKey.includes(hint));
};

const addSearchDataValue = (terms: Set<string>, value: unknown) => {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) terms.add(text);
  }
};

const collectSearchDataTerms = (value: unknown, maxDepth = 3): string[] => {
  const terms = new Set<string>();
  const visit = (current: unknown, depth: number, parentKey = '') => {
    if (current === null || current === undefined || depth > maxDepth) return;
    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
      if (!parentKey || isSearchableDataKey(parentKey)) addSearchDataValue(terms, current);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(item => visit(item, depth + 1, parentKey));
      return;
    }
    if (typeof current === 'object') {
      Object.entries(current as Record<string, unknown>).forEach(([key, nestedValue]) => {
        if (isSearchableDataKey(key)) {
          addSearchDataValue(terms, nestedValue);
        }
        if (nestedValue && typeof nestedValue === 'object') {
          visit(nestedValue, depth + 1, key);
        } else if (isSearchableDataKey(key)) {
          addSearchDataValue(terms, nestedValue);
        }
      });
    }
  };

  visit(value, 0);
  return Array.from(terms);
};

const collectSelectedSearchDataTerms = (...values: unknown[]): string[] => (
  Array.from(new Set(values.flatMap(value => collectSearchDataTerms(value))))
);

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
  'trainee-reallocation': 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
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
  'platform-aircraft-setup': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-dfp-resource-rows': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-unit-modules': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-settings-visibility': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-deployment-readiness': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-operational-runbook': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-licensing': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-permission-profiles': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-rank-terminology': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-user-access': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'platform-scheduling-rule-sets': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'appearance':        'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  'email-activation':  'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
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
    description: 'Customer, bases, units, aircraft pools, enabled features, licensing and deployment readiness.',
    accent: 'cyan',
    defaultSection: 'platform-configuration-health',
    sections: [
        'platform-configuration-health',
        'platform-organisation-locations',
        'platform-units',
        'platform-task-profiles',
        'standard-missions',
        'platform-master-lmp-access',
        'platform-aircraft-setup',
        'platform-dfp-resource-rows',
        'platform-unit-modules',
        'platform-settings-visibility',
        'platform-deployment-readiness',
        'email-activation',
        'platform-licensing',
        'platform-rank-terminology',
        'organisation',
        'appearance',
    ],
  },
  {
    label: 'Crew Composition',
    shortLabel: 'Crew',
    description: 'Aircraft-specific crew roles, standard crew makeup and alternate crew setups.',
    accent: 'cyan',
    defaultSection: 'crew-composition',
    sections: [
        'crew-composition',
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
        'trainee-reallocation',
    ],
  },
  {
    label: 'Training & Standards',
    shortLabel: 'Training',
    description: 'Scoring rules, currency requirements and continuation training event standards used across the training system.',
    accent: 'sky',
    defaultSection: 'scoring-matrix',
    sections: ['scoring-matrix', 'training-report-template', 'sct-events', 'currencies'],
  },
  {
    label: 'DFP Build Rules',
    shortLabel: 'Rules',
    description: 'Event limits, duty rules, turnarounds, course exclusions and scheduling rule sets. Daily build factors stay in NEO Build > Priorities.',
    accent: 'amber',
    defaultSection: 'scheduling-rules',
    sections: ['scheduling-rules', 'people-profile'],
  },
  {
    label: 'Records & Data',
    shortLabel: 'Data',
    description: 'Support records, cancellation codes, blank templates and saved operational evidence.',
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

const highlightedCrewPageSections: SettingsMenuSection[] = ['crew-composition', 'standard-missions'];
const isHighlightedCrewPageSection = (section: SettingsMenuSection) => highlightedCrewPageSections.includes(section);

type VisibleSettingGroup = typeof sectionGroups[number] & { visibleSections: SettingsMenuSection[] };

interface SettingsNavigationSidebarProps {
    activeSection: ActiveSection;
    settingsSearch: string;
    setSettingsSearch: React.Dispatch<React.SetStateAction<string>>;
    visibleSettingGroups: VisibleSettingGroup[];
    isSearchActive: boolean;
    hasSettingsMatches: boolean;
    onSelectSection: (section: SettingsMenuSection, groupLabel?: string) => void;
    onOpenDefaultSection: (section: ActiveSection) => void;
    getSearchContextSnippet: (section: SettingsMenuSection, groupLabel: string) => { before: string; match: string; after: string } | null;
    getSectionLabel: (section: SettingsMenuSection) => string;
}

const getSettingsGroupId = (label: string) => `settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const getDefaultSectionForVisibleGroup = (group: VisibleSettingGroup): SettingsMenuSection => {
    if (group.visibleSections.includes(group.defaultSection)) return group.defaultSection;
    return group.visibleSections[0] as SettingsMenuSection;
};

const SettingsNavigationSidebar: React.FC<SettingsNavigationSidebarProps> = React.memo(({
    activeSection,
    settingsSearch,
    setSettingsSearch,
    visibleSettingGroups,
    isSearchActive,
    hasSettingsMatches,
    onSelectSection,
    onOpenDefaultSection,
    getSearchContextSnippet,
    getSectionLabel,
}) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const openSettingsGroup = (group: VisibleSettingGroup) => {
        const groupActive = activeSection !== 'home' && group.sections.includes(activeSection as SettingsMenuSection);
        const isOpen = expandedGroups[group.label] === true;

        if (isOpen) {
            setExpandedGroups(previous => ({ ...previous, [group.label]: false }));
            return;
        }

        setExpandedGroups({ [group.label]: true });
        if (!groupActive) {
            const defaultSection = getDefaultSectionForVisibleGroup(group);
            onOpenDefaultSection(defaultSection);
        }
    };

    return (
        <aside className="hidden w-[258px] flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950/35 p-4 xl:block">
            <div className="mb-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Find Setting</label>
                <input
                    type="search"
                    value={settingsSearch}
                    onChange={(event) => setSettingsSearch(event.target.value)}
                    onBeforeInput={(event) => handleEditableTextBeforeInput(event, setSettingsSearch)}
                    onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setSettingsSearch)}
                    onKeyDown={stopEditableKeyPropagation}
                    placeholder="Search settings..."
                    className="w-full rounded-md border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
            </div>
            <nav className="mt-[30px] flex flex-col items-center gap-[1px]">
                {visibleSettingGroups.map(group => {
                    const groupActive = activeSection !== 'home' && group.sections.includes(activeSection as SettingsMenuSection);
                    const showSubmenu = isSearchActive || expandedGroups[group.label] === true;
                    const submenuMaxHeight = Math.min(860, Math.max(42, group.visibleSections.length * 39 + 8));
                    return (
                        <div key={group.label} className="w-[175px]">
                            <button
                                type="button"
                                onClick={() => openSettingsGroup(group)}
                                data-ui-lag-role="settings-group"
                                data-settings-group={group.label}
                                className={`btn-aluminium-brushed flex h-[45px] w-[175px] items-center gap-2 rounded-md px-3 text-left text-[10px] font-semibold leading-tight !text-black transition-colors ${
                                    groupActive ? 'ring-1 ring-gray-500/60' : ''
                                }`}
                                aria-expanded={showSubmenu}
                                aria-controls={getSettingsGroupId(group.label)}
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
                                id={getSettingsGroupId(group.label)}
                                className="overflow-hidden will-change-[max-height,opacity,transform]"
                                style={{
                                    maxHeight: showSubmenu ? `${submenuMaxHeight}px` : '0px',
                                    opacity: showSubmenu ? 1 : 0,
                                    transform: showSubmenu ? 'translateY(0)' : 'translateY(-4px)',
                                    transition: 'max-height 240ms ease, opacity 180ms ease, transform 180ms ease',
                                }}
                            >
                                <div className="space-y-[1px] py-[1px]">
                                    {group.visibleSections.map(section => {
                                        const sectionActive = activeSection === section;
                                        const contextSnippet = isSearchActive ? getSearchContextSnippet(section, group.label) : null;
                                        return (
                                            <button
                                                type="button"
                                                key={section}
                                                onClick={() => onSelectSection(section, group.label)}
                                                data-ui-lag-role="settings-section"
                                                data-settings-group={group.label}
                                                data-settings-section={section}
                                                className={`flex min-h-[36px] w-[175px] items-center gap-1 rounded-md border px-3 py-1.5 text-left text-[10px] font-semibold leading-tight transition-colors ${
                                                    sectionActive
                                                        ? 'border-transparent bg-transparent text-sky-300'
                                                        : section === 'emergency'
                                                            ? 'border-gray-800 bg-gray-950/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                            : 'border-gray-800 bg-gray-950/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                }`}
                                            >
                                                {sectionActive ? (
                                                    <span className="h-0 w-0 flex-shrink-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-sky-300" aria-hidden="true" />
                                                ) : null}
                                                <span className="min-w-0">
                                                    <span className="block truncate">{getSectionLabel(section)}</span>
                                                    {contextSnippet && (
                                                        <span className="mt-0.5 block truncate text-[9px] font-medium normal-case leading-tight text-cyan-300/80">
                                                            <span>{contextSnippet.before}</span>
                                                            <span className="font-bold text-cyan-200">{contextSnippet.match.toUpperCase()}</span>
                                                            <span>{contextSnippet.after}</span>
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
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
    );
});

SettingsNavigationSidebar.displayName = 'SettingsNavigationSidebar';

const TraineeReallocationSection: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<any>(null);

    const loadPreview = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/trainee-reallocation/preview', { credentials: 'include' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Preview failed with HTTP ${response.status}`);
            }
            setPreview(data);
        } catch (err) {
            setPreview(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const allocations = Array.isArray(preview?.allocations) ? preview.allocations : [];
    const unitCounts = allocations.reduce((acc: Record<string, number>, allocation: any) => {
        const unit = String(allocation?.unit || 'Unassigned').trim() || 'Unassigned';
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white">Trainee Reallocation</h2>
                    <p className="mt-1 text-sm text-gray-400">Preview primary and secondary instructor allocation from configured trainee and staff records.</p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadPreview()}
                    disabled={loading}
                    className="rounded-md border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30 disabled:cursor-wait disabled:opacity-60"
                >
                    {loading ? 'Loading...' : 'Preview'}
                </button>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
                    {error}
                </div>
            )}

            {preview?.summary && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Trainees</div>
                        <div className="mt-2 text-2xl font-bold text-white">{preview.summary.total ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">With Primary</div>
                        <div className="mt-2 text-2xl font-bold text-white">{preview.summary.primary?.with1 ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">With Two Secondary</div>
                        <div className="mt-2 text-2xl font-bold text-white">{preview.summary.secondary?.with2 ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">Without Primary</div>
                        <div className="mt-2 text-2xl font-bold text-white">{preview.summary.primary?.with0 ?? 0}</div>
                    </div>
                </div>
            )}

            {allocations.length > 0 && (
                <div className="rounded-lg border border-gray-700 bg-gray-800">
                    <div className="border-b border-gray-700 px-4 py-3">
                        <h3 className="text-sm font-semibold text-white">Units Included</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-3 lg:grid-cols-4">
                        {Object.entries(unitCounts).map(([unit, count]) => (
                            <div key={unit} className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
                                <div className="text-sm font-semibold text-gray-100">{unit}</div>
                                <div className="text-xs text-gray-400">{count} trainee{count === 1 ? '' : 's'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const normaliseLegacySettingsSection = (section: string) => {
        if (section === 'platform-configuration') return 'platform-configuration-health';
        if (section === 'platform-standard-missions') return 'standard-missions';
        if (section === 'platform-resource-pools') return 'platform-dfp-resource-rows';
        return section;
    };
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
    const [settingsFocusTarget, setSettingsFocusTarget] = useState<{
        unitCode?: string;
        locationCode?: string;
        resourcePoolCode?: string;
        aircraftTypeCode?: string;
        userId?: string;
        focusSubsectionId?: string;
    } | null>(null);
    const [settingsSearchFocus, setSettingsSearchFocus] = useState<{
        section: SettingsMenuSection;
        token: string;
        requestId: number;
    } | null>(null);
    const [embeddedCurrencyBuilderOpen, setEmbeddedCurrencyBuilderOpen] = useState(false);
    const sctTerminology = props.sctTerminology || DEFAULT_SCT_TERMINOLOGY;
    const continuationCurrencyLabel = `${String(sctTerminology.shortLabel || DEFAULT_SCT_TERMINOLOGY.shortLabel || 'ContT').trim() || 'ContT'} / Currency Events`;
    const isContinuationCurrencySection = (section: SettingsMenuSection): boolean =>
        section === 'sct-events' || section === 'currency-profiles';
    const getSectionLabel = (section: SettingsMenuSection): string => (
        isContinuationCurrencySection(section)
            ? continuationCurrencyLabel
            : sectionLabels[section]
    );
    const getSectionDescription = (section: SettingsMenuSection): string => (
        isContinuationCurrencySection(section)
            ? `Configure ${continuationCurrencyLabel} settings`
            : sectionDescriptions[section]
    );

    const changeActiveSection = (section: ActiveSection) => {
        if (section !== 'currencies') {
            setEmbeddedCurrencyBuilderOpen(false);
        }
        setActiveSection(section);
    };

    const selectSettingsSectionFromMenu = (section: SettingsMenuSection, groupLabel?: string) => {
        const contextSnippet = groupLabel && settingsSearch.trim()
            ? getSearchContextSnippet(section, groupLabel)
            : null;
        const fallbackToken = getSearchQueryTokens()
            .filter(token => token.length >= 2)
            .sort((a, b) => b.length - a.length)[0] || '';

        if (contextSnippet?.match || fallbackToken) {
            setSettingsSearchFocus({
                section,
                token: contextSnippet?.match || fallbackToken,
                requestId: Date.now(),
            });
        }
        changeActiveSection(section);
        if (settingsSearch.trim()) setSettingsSearch('');
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

    const settingsDataSearchTermsBySection = useMemo<Partial<Record<SettingsMenuSection, string[]>>>(() => {
        const platformConfig = props.platformConfig || null;
        const platformOrganisations = platformConfig?.organisations || [];
        const platformLocations = platformConfig?.locations || [];
        const platformUnits = platformConfig?.units || [];
        const platformAircraftTypes = platformConfig?.aircraftTypes || [];
        const platformResourcePools = platformConfig?.resourcePools || [];
        const organisationSettings = platformOrganisations.map((organisation: any) => organisation?.settings || {});

        const peopleTerms = collectSelectedSearchDataTerms(props.instructorsData, props.traineesData);
        const unitContextTerms = collectSelectedSearchDataTerms(
            props.units,
            props.platformUnits,
            props.platformUnitContexts,
            props.unitLocations,
            props.activeUnitCode,
            props.activeUnitCodes,
            props.activeCompositeUnitCode,
            props.activeAircraftTypeCode,
            props.activeOperationalModel,
        );
        const locationTerms = collectSelectedSearchDataTerms(
            props.locations,
            props.locationAbbreviations,
            props.locationOpAreas,
            platformOrganisations,
            platformLocations,
        );
        const aircraftTerms = collectSelectedSearchDataTerms(
            platformAircraftTypes,
            props.aircraftCrewComposition,
            props.aircraftConfigurationDefinitions,
            props.crewPositionTerminology,
            props.activeAircraftTypeCode,
        );
        const resourceRowTerms = collectSelectedSearchDataTerms(
            platformResourcePools,
            props.resourceDisplayNames,
            props.activeAircraftTypeCode,
            props.activeUnitCode,
            props.activeUnitCodes,
            props.activeCompositeUnitCode,
        );
        const currencyTerms = collectSelectedSearchDataTerms(
            props.masterCurrencies,
            props.currencyRequirements,
            props.unitCurrencyDefinitions,
            props.currencyImportUnitOptions,
            props.activeCurrencyUnitCode,
        );
        const trainingReportTerms = collectSelectedSearchDataTerms(
            props.phraseBank,
            props.trainingReportDisplayName,
            organisationSettings.map((settings: any) => settings.trainingReports),
            organisationSettings.map((settings: any) => settings.trainingReportTemplate),
            props.syllabusDetails,
        );
        const cancellationTerms = collectSelectedSearchDataTerms(props.cancellationCodes, props.cancellationRecords);
        const continuationTerms = collectSelectedSearchDataTerms(props.sctEvents, props.sctTerminology);
        const taskTerms = collectSelectedSearchDataTerms(
            props.formationCallsigns,
            organisationSettings.map((settings: any) => settings.taskProfiles),
            organisationSettings.map((settings: any) => settings.taskProfileAbbreviations),
        );
        const permissionTerms = collectSelectedSearchDataTerms(
            platformConfig?.userAccess,
            platformConfig?.platformUsers,
            organisationSettings.map((settings: any) => settings.permissionProfiles),
        );
        const moduleTerms = collectSelectedSearchDataTerms(platformConfig?.modules, platformConfig?.unitModules);
        const licensingTerms = collectSelectedSearchDataTerms(platformConfig?.licenses);
        const schedulingRuleSetTerms = collectSelectedSearchDataTerms(platformConfig?.schedulingRuleSets);
        const rankTerminologyTerms = collectSelectedSearchDataTerms(
            props.serviceDefinitions,
            props.personnelDisplaySettings,
            props.instructorLabel,
            props.qualificationOptions,
            props.instructorsData.map((person: any) => ({ rank: person?.rank, service: person?.service, unit: person?.unit })),
            props.traineesData.map((person: any) => ({ rank: person?.rank, course: person?.course, unit: person?.unit })),
        );

        return {
            'platform-configuration-health': collectSelectedSearchDataTerms(
                locationTerms,
                unitContextTerms,
                aircraftTerms,
                resourceRowTerms,
                permissionTerms,
                licensingTerms,
            ),
            'platform-organisation-locations': locationTerms,
            'platform-units': collectSelectedSearchDataTerms(unitContextTerms, platformUnits, platformOrganisations),
            'platform-task-profiles': taskTerms,
            'standard-missions': taskTerms,
            'platform-master-lmp-access': collectSelectedSearchDataTerms(props.syllabusDetails, organisationSettings.map((settings: any) => settings.masterLmpCatalogue)),
            'platform-aircraft-setup': aircraftTerms,
            'platform-dfp-resource-rows': resourceRowTerms,
            'platform-unit-modules': collectSelectedSearchDataTerms(moduleTerms, unitContextTerms),
            'platform-settings-visibility': collectSelectedSearchDataTerms(props.settingsVisibilityPolicy, unitContextTerms, locationTerms, aircraftTerms),
            'platform-deployment-readiness': collectSelectedSearchDataTerms(licensingTerms, platformOrganisations, platformLocations, platformUnits),
            'platform-operational-runbook': collectSelectedSearchDataTerms(organisationSettings.map((settings: any) => settings.operationalRunbook), licensingTerms),
            'platform-licensing': licensingTerms,
            'platform-permission-profiles': permissionTerms,
            'platform-rank-terminology': rankTerminologyTerms,
            'platform-user-access': collectSelectedSearchDataTerms(permissionTerms, peopleTerms, unitContextTerms),
            'platform-scheduling-rule-sets': collectSelectedSearchDataTerms(schedulingRuleSetTerms, unitContextTerms, aircraftTerms, locationTerms),
            'email-activation': collectSelectedSearchDataTerms('smtp', 'email', 'activation', 'login', 'mail server'),
            'scoring-matrix': collectSelectedSearchDataTerms(props.syllabusDetails, props.phraseBank),
            'training-report-template': trainingReportTerms,
            'currencies': currencyTerms,
            'sct-events': collectSelectedSearchDataTerms(continuationTerms, currencyTerms),
            'currency-profiles': collectSelectedSearchDataTerms(continuationTerms, currencyTerms),
            'people-profile': collectSelectedSearchDataTerms(props.excludedCourses, props.courseColors, unitContextTerms),
            'scheduling-rules': collectSelectedSearchDataTerms(props.eventLimits, props.dispatchStaggerSettings, schedulingRuleSetTerms, unitContextTerms),
            'event-limits': collectSelectedSearchDataTerms(props.eventLimits, unitContextTerms),
            'duty-turnaround': collectSelectedSearchDataTerms(
                props.preferredDutyPeriod,
                props.maxCrewDutyPeriod,
                props.flightTurnaround,
                props.ftdTurnaround,
                props.cptTurnaround,
                props.dayFlyingStart,
                props.dayFlyingEnd,
            ),
            'business-rules': collectSelectedSearchDataTerms(props.dispatchStaggerSettings, props.tileStatusSettings, props.maxDispatchPerHour, props.showDepartureDensityOverlay),
            'user-list': collectSelectedSearchDataTerms(peopleTerms, permissionTerms),
            'staff-database': collectSelectedSearchDataTerms(props.instructorsData, rankTerminologyTerms),
            'trainee-database': collectSelectedSearchDataTerms(props.traineesData, props.courseColors),
            'trainee-reallocation': collectSelectedSearchDataTerms(props.traineesData, props.instructorsData, unitContextTerms),
            'validation': cancellationTerms,
            'organisation': collectSelectedSearchDataTerms(props.organisationSettings, unitContextTerms, resourceRowTerms),
            'crew-composition': collectSelectedSearchDataTerms(aircraftTerms, props.aircraftCrewComposition, props.crewPositionTerminology),
            'appearance': collectSelectedSearchDataTerms(props.fixedCrewTileColourMode, props.activeOperationalModel),
            'emergency': collectSelectedSearchDataTerms(props.emergencyFreezeAuthority, props.qualificationOptions, props.currentUserQualificationIds),
        };
    }, [
        props.platformConfig,
        props.instructorsData,
        props.traineesData,
        props.units,
        props.platformUnits,
        props.platformUnitContexts,
        props.unitLocations,
        props.activeUnitCode,
        props.activeUnitCodes,
        props.activeCompositeUnitCode,
        props.activeAircraftTypeCode,
        props.activeOperationalModel,
        props.locations,
        props.locationAbbreviations,
        props.locationOpAreas,
        props.aircraftCrewComposition,
        props.aircraftConfigurationDefinitions,
        props.crewPositionTerminology,
        props.resourceDisplayNames,
        props.masterCurrencies,
        props.currencyRequirements,
        props.unitCurrencyDefinitions,
        props.currencyImportUnitOptions,
        props.activeCurrencyUnitCode,
        props.phraseBank,
        props.trainingReportDisplayName,
        props.syllabusDetails,
        props.cancellationCodes,
        props.cancellationRecords,
        props.sctEvents,
        props.sctTerminology,
        props.formationCallsigns,
        props.serviceDefinitions,
        props.personnelDisplaySettings,
        props.instructorLabel,
        props.qualificationOptions,
        props.settingsVisibilityPolicy,
        props.excludedCourses,
        props.courseColors,
        props.eventLimits,
        props.dispatchStaggerSettings,
        props.tileStatusSettings,
        props.maxDispatchPerHour,
        props.showDepartureDensityOverlay,
        props.preferredDutyPeriod,
        props.maxCrewDutyPeriod,
        props.flightTurnaround,
        props.ftdTurnaround,
        props.cptTurnaround,
        props.dayFlyingStart,
        props.dayFlyingEnd,
        props.organisationSettings,
        props.fixedCrewTileColourMode,
        props.emergencyFreezeAuthority,
        props.currentUserQualificationIds,
    ]);

    const normaliseSearchText = (value: string): string => (
        value
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );

    const getSearchQueryTokens = (): string[] => (
        normaliseSearchText(settingsSearch).split(' ').filter(Boolean)
    );

    const searchTokensMatchText = (tokens: string[], text: string): boolean => (
        tokens.length > 0 && tokens.every(token => text.includes(token))
    );

    const getSettingsSearchParts = (section: SettingsMenuSection, groupLabel: string): string[] => [
        groupLabel,
        getSectionLabel(section),
        getSectionDescription(section),
        sectionLabels[section],
        sectionDescriptions[section],
        section,
        ...(sectionSearchKeywords[section] || []),
        ...(settingsDataSearchTermsBySection[section] || []),
    ].map(value => String(value || '').trim()).filter(Boolean);

    const getSettingsSearchText = (section: SettingsMenuSection, groupLabel: string): string => normaliseSearchText(
        getSettingsSearchParts(section, groupLabel).join(' ')
    );

    const getSearchContextSnippet = (section: SettingsMenuSection, groupLabel: string): {
        before: string;
        match: string;
        after: string;
    } | null => {
        const queryTokens = getSearchQueryTokens();
        if (queryTokens.length === 0) return null;
        const usefulTokens = queryTokens
            .filter(token => token.length >= 2)
            .sort((a, b) => b.length - a.length);

        for (const token of usefulTokens) {
            for (const part of getSettingsSearchParts(section, groupLabel)) {
                const lowerPart = part.toLowerCase();
                const matchIndex = lowerPart.indexOf(token);
                if (matchIndex === -1) continue;

                const wordStartCandidate = part.slice(0, matchIndex).search(/\S+\s*$/);
                const wordStart = wordStartCandidate >= 0 ? wordStartCandidate : matchIndex;
                const wordTailMatch = part.slice(matchIndex + token.length).match(/^\S*/);
                const wordEnd = matchIndex + token.length + (wordTailMatch?.[0]?.length || 0);
                const previousWordMatch = part.slice(0, wordStart).match(/\S+\s*$/);
                const contextStart = previousWordMatch ? previousWordMatch.index : wordStart;
                const nextWordMatch = part.slice(wordEnd).match(/^\s+\S+/);
                const contextEnd = nextWordMatch ? wordEnd + nextWordMatch[0].length : wordEnd;

                return {
                    before: part.slice(contextStart, matchIndex),
                    match: part.slice(matchIndex, matchIndex + token.length),
                    after: part.slice(matchIndex + token.length, contextEnd),
                };
            }
        }

        return null;
    };

    const matchesSettingsSearch = (section: SettingsMenuSection, groupLabel: string) => {
        const queryTokens = getSearchQueryTokens();
        if (queryTokens.length === 0) return true;
        const searchText = getSettingsSearchText(section, groupLabel);
        return searchTokensMatchText(queryTokens, searchText);
    };

    const applyTemporarySearchHighlight = (element: HTMLElement, token: string): boolean => {
        const cleanToken = String(token || '').trim();
        if (!cleanToken) return false;

        const inputElement = element.matches('input, textarea, select')
            ? element
            : element.querySelector('input, textarea, select');

        if (inputElement instanceof HTMLElement) {
            const previousOutline = inputElement.style.outline;
            const previousBoxShadow = inputElement.style.boxShadow;
            const previousTransition = inputElement.style.transition;
            inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inputElement.style.transition = 'outline-color 160ms ease, box-shadow 160ms ease';
            inputElement.style.outline = '2px solid rgba(250, 204, 21, 0.95)';
            inputElement.style.boxShadow = '0 0 0 4px rgba(250, 204, 21, 0.22)';
            window.setTimeout(() => {
                inputElement.style.outline = previousOutline;
                inputElement.style.boxShadow = previousBoxShadow;
                inputElement.style.transition = previousTransition;
            }, 2200);
            return true;
        }

        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('script, style, textarea, select, input, mark')) return NodeFilter.FILTER_REJECT;
                if (!node.textContent?.toLowerCase().includes(cleanToken.toLowerCase())) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode as Text);
        }

        const targetNode = textNodes[0];
        const targetText = targetNode?.textContent || '';
        const matchIndex = targetText.toLowerCase().indexOf(cleanToken.toLowerCase());
        if (!targetNode || matchIndex < 0) return false;

        const range = document.createRange();
        range.setStart(targetNode, matchIndex);
        range.setEnd(targetNode, matchIndex + cleanToken.length);
        const marker = document.createElement('mark');
        marker.style.background = 'rgba(250, 204, 21, 0.92)';
        marker.style.color = '#111827';
        marker.style.borderRadius = '3px';
        marker.style.padding = '0 2px';
        marker.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.24)';
        marker.style.transition = 'background-color 240ms ease, box-shadow 240ms ease';
        range.surroundContents(marker);
        marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            marker.style.background = 'transparent';
            marker.style.boxShadow = 'none';
            window.setTimeout(() => {
                marker.replaceWith(document.createTextNode(marker.textContent || ''));
                element.normalize();
            }, 320);
        }, 2200);
        return true;
    };

    const focusSearchMatchOnRenderedPage = (token: string): boolean => {
        const container = contentScrollRef.current;
        const cleanToken = String(token || '').trim().toLowerCase();
        if (!container || cleanToken.length < 2) return false;

        const skipSelector = 'script, style, [aria-hidden="true"]';
        const candidates = Array.from(container.querySelectorAll<HTMLElement>('input, textarea, select, button, label, h1, h2, h3, h4, p, span, td, th, li, div'))
            .filter((element) => {
                if (element.closest(skipSelector)) return false;
                const fieldValue = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
                    ? String(element.value || '')
                    : '';
                const text = `${element.textContent || ''} ${fieldValue}`.toLowerCase();
                return text.includes(cleanToken);
            })
            .sort((a, b) => {
                const aText = `${a.textContent || ''} ${a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement ? a.value || '' : ''}`;
                const bText = `${b.textContent || ''} ${b instanceof HTMLInputElement || b instanceof HTMLTextAreaElement || b instanceof HTMLSelectElement ? b.value || '' : ''}`;
                return aText.length - bText.length;
            });
        const target = candidates[0];

        return target ? applyTemporarySearchHighlight(target, token) : false;
    };

    useEffect(() => {
        if (!settingsSearchFocus || settingsSearchFocus.section !== activeSection) return;
        let cancelled = false;
        let attempts = 0;
        const tryFocus = () => {
            if (cancelled) return;
            attempts += 1;
            if (focusSearchMatchOnRenderedPage(settingsSearchFocus.token) || attempts >= 12) {
                return;
            }
            window.setTimeout(tryFocus, 180);
        };
        window.setTimeout(tryFocus, 120);
        return () => {
            cancelled = true;
        };
    }, [activeSection, settingsSearchFocus]);

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

    const visibleSettingGroups = sectionGroups
        .map(group => ({
            ...group,
            visibleSections: group.sections.filter(section => matchesSettingsSearch(section, group.label)),
        }))
        .filter(group => group.visibleSections.length > 0);
    const hasSettingsMatches = visibleSettingGroups.length > 0;
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
        changeActiveSection(targetSection as ActiveSection);
    };

    const handleSettingsShellKeyDownCapture = (event: React.KeyboardEvent<HTMLElement>) => {
        if (isEditableElement(event.target)) return;
        stopEditableKeyPropagation(event);
    };

    return (
        <div data-settings-view="true" className="flex-1 flex overflow-hidden bg-gray-900" onKeyDownCapture={handleSettingsShellKeyDownCapture}>
            <SettingsNavigationSidebar
                activeSection={activeSection}
                settingsSearch={settingsSearch}
                setSettingsSearch={setSettingsSearch}
                visibleSettingGroups={visibleSettingGroups}
                isSearchActive={isSearchActive}
                hasSettingsMatches={hasSettingsMatches}
                onSelectSection={selectSettingsSectionFromMenu}
                onOpenDefaultSection={changeActiveSection}
                getSearchContextSnippet={getSearchContextSnippet}
                getSectionLabel={getSectionLabel}
            />

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
                                            onBeforeInput={(event) => handleEditableTextBeforeInput(event, setSettingsSearch)}
                                            onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setSettingsSearch)}
                                            onKeyDown={stopEditableKeyPropagation}
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
                                {getSectionLabel(activeSection as SettingsMenuSection)}
                            </h2>
                            <div className="ml-auto flex items-center gap-[10px]">
                                {!['Super Admin', 'Admin', 'Scheduler'].includes(props.currentUserPermission) && (
                                    <div className="text-sm text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-3 py-2">
                                        <strong>Read-Only Mode</strong>
                                    </div>
                                )}
                                <AuditButton pageName={`Settings - ${getSectionLabel(activeSection as SettingsMenuSection)}`} />
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
                                instructorsData={props.instructorsData}
                                traineesData={props.traineesData}
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
                            instructorsData={props.instructorsData}
                            traineesData={props.traineesData}
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
                            instructorsData={props.instructorsData}
                            traineesData={props.traineesData}
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
                            instructorsData={props.instructorsData}
                            traineesData={props.traineesData}
                            unitCurrencyDefinitions={props.unitCurrencyDefinitions}
                        />
                    )}

                    {activeSection === 'currency-profiles' && (
                        <SettingsView
                            {...props}
                            activeSection="sct-events"
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
                     activeSection !== 'trainee-reallocation' &&
                     activeSection !== 'organisation' &&
                     !isPlatformConfigurationActive &&
                     activeSection !== 'appearance' &&
                     activeSection !== 'email-activation' &&
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
                            instructorsData={props.instructorsData}
                            traineesData={props.traineesData}
                        />
                    )}
                    {activeSection === 'staff-database' && (
                        <StaffDatabaseTable 
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onDataChanged={props.onDatabaseDataChanged}
                            onNavigateToProfile={props.onNavigateToProfile}
                            activeUnitCodes={props.activeUnitCodes && props.activeUnitCodes.length > 0 ? props.activeUnitCodes : (props.activeUnitCode ? [props.activeUnitCode] : [])}
                        />
                    )}
                    {activeSection === 'trainee-database' && (
                        <TraineeDatabaseTable 
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                            onDataChanged={props.onDatabaseDataChanged}
                            onNavigateToProfile={props.onNavigateToProfile}
                            activeUnitCodes={props.activeUnitCodes && props.activeUnitCodes.length > 0 ? props.activeUnitCodes : (props.activeUnitCode ? [props.activeUnitCode] : [])}
                        />
                    )}
                    {activeSection === 'trainee-reallocation' && (
                        <TraineeReallocationSection />
                    )}
                    {activeSection === 'organisation' && (
                        <OrganisationSettings
                            units={(props.platformUnits && props.platformUnits.length > 0) ? props.platformUnits : props.units}
                            activeUnitCode={props.activeUnitCode}
                            activeUnitCodes={props.activeUnitCodes}
                            unitContexts={props.platformUnitContexts}
                            settingsVisibilityPolicy={props.settingsVisibilityPolicy}
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
                            instructorsData={props.instructorsData}
                            traineesData={props.traineesData}
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
                    {activeSection === 'email-activation' && (
                        <EmailActivationSettings
                            currentUserPermission={props.currentUserPermission}
                            onShowSuccess={props.onShowSuccess}
                        />
                    )}
                    {activeSection === 'people-profile' && (
                        <PeopleProfilePage
                            traineesData={props.traineesData}
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
