import React, { useState } from 'react';
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
import OrganisationSettings from './OrganisationSettings';
import AppearanceSettings from './AppearanceSettings';
import { HistoricalDataSeeder } from './HistoricalDataSeeder';
import PeopleProfilePage from './PeopleProfilePage';
import { Instructor, Trainee, SyllabusItemDetail, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, FormationCallsign, CancellationRecord, CancellationCode } from '../types';

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
    settingsLoaded?: boolean;
    organisationSettings?: {
        staffSharingEnabled: boolean;
        staffSharingUnits: string[];
        fleetSharingEnabled: boolean;
        allocationMode: 'combined' | 'fixed';
        selectedUnits: string[];
        desiredAllocations: Record<string, number>;
        remainderUnitIndex: number;
    };
    onUpdateOrganisationSettings?: (settings: {
        staffSharingEnabled: boolean;
        staffSharingUnits: string[];
        fleetSharingEnabled: boolean;
        allocationMode: 'combined' | 'fixed';
        selectedUnits: string[];
        desiredAllocations: Record<string, number>;
        remainderUnitIndex: number;
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
    | 'appearance'
    | 'emergency';

type SettingsMenuSection = SettingsSection | 'locale-settings' | 'scheduling-rules';

const sectionLabels: Record<SettingsMenuSection, string> = {
    'scoring-matrix': 'Scoring Matrix',
    'currencies': 'Currencies',
    'sct-events': 'SCT Events',
    'people-profile': 'People Profile',
    'scheduling-rules': 'Scheduling Rules',
    'event-limits': 'Event Limits',
    'duty-turnaround': 'Duty & Turnaround',
    'business-rules': 'Business Rules',
    'permissions': 'Permissions',
    'data-loaders': 'Data Loaders',
    'data-sources': 'Data Sources',
    'user-list': 'User List',
    'staff-database': 'Staff Database',
    'trainee-database': 'Trainee Database',
    'staff-mockdata': 'Staff MockData',
    'trainee-mockdata': 'Trainee MockData',
    'staff-combined-data': 'Staff Combined Data',
    'validation': 'AC History',
    'historical-data': 'Historical Data',
    'locale-settings': 'Locale Settings',
    'timezone': 'Timezone',
    'location': 'Location',
    'units': 'Units',
    'organisation': 'Organisation',
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
    'appearance',
    'emergency',
];

type ScoringMatrixTab = 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';

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
  'people-profile': 'Set NEO Build basis course',
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
  'validation': 'Aircraft availability history',
  'historical-data': 'Seed & refresh historical training records',
  'locale-settings': 'Locations, timezone and unit assignment',
  'timezone': 'Configure timezone settings',
  'location': 'Manage base locations',
  'units': 'Configure unit settings',
  'organisation': 'Fleet sharing and multi-unit configuration',
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
  sections: SettingsMenuSection[];
}[] = [
  {
    label: 'System Setup',
    shortLabel: 'Setup',
    description: 'Organisation structure, locations, units, timezone, display preferences and emergency control.',
    accent: 'cyan',
    sections: ['organisation', 'locale-settings', 'appearance', 'emergency'],
  },
  {
    label: 'People & Access',
    shortLabel: 'People',
    description: 'Users, permissions, staff and trainee records, and NEO Build profile settings.',
    accent: 'violet',
    sections: ['user-list', 'permissions', 'staff-database', 'trainee-database', 'people-profile'],
  },
  {
    label: 'Training Standards',
    shortLabel: 'Training',
    description: 'Scoring rules, currencies and SCT event standards used across the training system.',
    accent: 'sky',
    sections: ['scoring-matrix', 'currencies', 'sct-events'],
  },
  {
    label: 'Operations & DFP Rules',
    shortLabel: 'Ops',
    description: 'Operational thresholds, duty limits, turnaround timing, build logic and aircraft availability history.',
    accent: 'amber',
    sections: ['scheduling-rules', 'validation'],
  },
  {
    label: 'Data & Records',
    shortLabel: 'Data',
    description: 'Data sources, imports and enduring historical records.',
    accent: 'emerald',
    sections: ['data-sources', 'data-loaders', 'historical-data'],
  },
];

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    type ActiveSection = SettingsMenuSection | 'home';
    const [activeSection, setActiveSection] = useState<ActiveSection>('home');
    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);
    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<Trainee[]>([]);
    const { isFrozen } = useSystemFreeze();
    const [scoringMatrixTab, setScoringMatrixTab] = useState<ScoringMatrixTab>('Airmanship');
    const [settingsSearch, setSettingsSearch] = useState('');

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

    return (
        <div className="flex-1 flex overflow-hidden bg-gray-900">
            <aside className="hidden w-72 flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950/35 p-4 xl:block">
                <button
                    onClick={() => setActiveSection('home')}
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
                <nav className="space-y-4">
                    {visibleSettingGroups.map(group => {
                        const accent = getAccentClasses(group.accent);
                        const groupSections = group.visibleSections;
                        const groupActive = groupSections.includes(activeSection as SettingsSection);
                        return (
                            <div key={group.label} className={`rounded-lg border ${groupActive ? accent.border : 'border-gray-800'} bg-gray-900/45 p-2`}>
                                <a
                                    href={`#${getGroupId(group.label)}`}
                                    onClick={() => activeSection !== 'home' && setActiveSection('home')}
                                    className="mb-1 flex items-center gap-3 rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-gray-800"
                                >
                                    <span className={`h-2.5 w-2.5 rounded-full ${accent.rail}`} />
                                    <span className="font-bold">{group.label}</span>
                                    <span className="ml-auto text-xs text-gray-600">{group.sections.length}</span>
                                </a>
                                <div className="space-y-0.5">
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
                                                {section === 'emergency' && <span className={`h-2 w-2 rounded-full ${sectionAccent.rail}`} />}
                                                <span>{sectionLabels[section]}</span>
                                            </button>
                                        );
                                    })}
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

            <div className="flex-1 overflow-y-auto bg-gray-900">
                <div className="p-4 sm:p-6">

                    {/* ── ICON GRID HOME ───────────────────────────────────── */}
                    {activeSection === 'home' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-gray-700 bg-gray-800/70 shadow-lg overflow-hidden">
                                <div className="flex flex-wrap items-center gap-4 border-b border-gray-700 px-5 py-4">
                                    <div className="min-w-0">
                                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Settings</h1>
                                        <p className="text-sm text-gray-400 mt-0.5">Configure the operating model through five practical administration areas.</p>
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

                                                    <div className="divide-y divide-gray-800">
                                                        {group.visibleSections.map(section => {
                                                            const sectionAccent = getSectionAccent(section, group.accent);
                                                            return (
                                                                <button
                                                                    key={section}
                                                                    onClick={() => setActiveSection(section)}
                                                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                                                                        section === 'emergency' ? 'hover:bg-red-500/10' : 'hover:bg-gray-800/70'
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
                                Back
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
                                    hideHeader={true}
                                    activeSection="scoring-matrix"
                                    scoringMatrixActiveTab={scoringMatrixTab}
                                    scoringMatrixReadOnly={!['Super Admin', 'Admin'].includes(props.currentUserPermission)}
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'locale-settings' && (
                        <div className="space-y-5">
                            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                                <h3 className="text-lg font-bold text-cyan-200">Locale Settings</h3>
                                <p className="mt-1 text-sm text-cyan-100/70">Configure location first, then timezone, then unit assignments.</p>
                            </div>
                            <SettingsView {...props} hideHeader={true} activeSection="location" />
                            <SettingsView {...props} hideHeader={true} activeSection="timezone" />
                            <SettingsView {...props} hideHeader={true} activeSection="units" />
                        </div>
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
                        <StaffCombinedDataTable instructorsData={props.instructorsData} />
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
                            savedSettings={props.organisationSettings}
                            onSettingsChange={props.onUpdateOrganisationSettings}
                            settingsLoaded={props.settingsLoaded}
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
