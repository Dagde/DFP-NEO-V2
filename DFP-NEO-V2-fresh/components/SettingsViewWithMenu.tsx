import React, { useState } from 'react';
import { SettingsView } from './SettingsView';
import { UserListSection } from './UserListSection';
import StaffDatabaseTable from "./StaffDatabaseTable";
import StaffMockDataTable from "./StaffMockDataTable";
import StaffCombinedDataTable from "./StaffCombinedDataTable";
import TraineeDatabaseTable from "./TraineeDatabaseTable";
import TraineeMockDataTable from "./TraineeMockDataTable";
import DataSourcesSettings from "./DataSourcesSettings";
import AuditButton from './AuditButton';
import { Instructor, Trainee, SyllabusItemDetail, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, FormationCallsign, CancellationRecord, CancellationCode } from '../types';

interface SettingsViewWithMenuProps {
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    units: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
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
}

type SettingsSection =
    | 'scoring-matrix'
    | 'currencies'
    | 'sct-events'
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
    | 'timezone'
    | 'location'
    | 'units';

const sectionLabels: Record<SettingsSection, string> = {
    'scoring-matrix': 'Scoring Matrix',
    'currencies': 'Currencies',
    'sct-events': 'SCT Events',
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
    'timezone': 'Timezone',
    'location': 'Location',
    'units': 'Units',
};

// All sections in order for the left menu
const allSections: SettingsSection[] = [
    'scoring-matrix',
    'currencies',
    'sct-events',
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
    'timezone',
    'location',
    'units',
];

type ScoringMatrixTab = 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';

// ─── Icon definitions for each section ───────────────────────────────────────
const sectionIcons: Record<SettingsSection, React.ReactNode> = {
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
};

// Descriptions for each section
const sectionDescriptions: Record<SettingsSection, string> = {
  'scoring-matrix': 'Configure scoring logic and weighting',
  'currencies': 'Manage qualification expiry dates',
  'sct-events': 'Event scoring rules and triggers',
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
  'timezone': 'Configure timezone settings',
  'location': 'Manage base locations',
  'units': 'Configure unit settings',
};

// Icon accent colours per section
const sectionColors: Record<SettingsSection, string> = {
  'scoring-matrix':    'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400',
  'currencies':        'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  'sct-events':        'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  'event-limits':      'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
  'duty-turnaround':   'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
  'business-rules':    'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  'permissions':       'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  'data-loaders':      'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  'data-sources':      'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
  'user-list':         'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  'staff-database':    'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400',
  'trainee-database':  'from-lime-500/20 to-lime-600/10 border-lime-500/30 text-lime-400',
  'staff-mockdata':    'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-400',
  'trainee-mockdata':  'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30 text-zinc-400',
  'staff-combined-data':'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400',
  'validation':        'from-sky-500/20 to-indigo-600/10 border-sky-400/30 text-sky-300',
  'timezone':          'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  'location':          'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  'units':             'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
};

// Groups for the icon grid
const sectionGroups: { label: string; sections: SettingsSection[] }[] = [
  {
    label: 'SYSTEM CONFIGURATION',
    sections: ['scoring-matrix', 'currencies', 'sct-events'],
  },
  {
    label: 'OPERATIONS RULES',
    sections: ['event-limits', 'duty-turnaround', 'business-rules'],
  },
  {
    label: 'ACCESS & SECURITY',
    sections: ['permissions', 'user-list'],
  },
  {
    label: 'DATA MANAGEMENT',
    sections: ['data-loaders', 'data-sources', 'staff-database', 'trainee-database', 'staff-combined-data', 'staff-mockdata', 'trainee-mockdata'],
  },
  {
    label: 'HISTORICAL & ANALYSIS',
    sections: ['validation'],
  },
  {
    label: 'SYSTEM SETTINGS',
    sections: ['timezone', 'location', 'units'],
  },
];

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    type ActiveSection = SettingsSection | 'home';
    const [activeSection, setActiveSection] = useState<ActiveSection>('home');
    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);
    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<Trainee[]>([]);
    const [scoringMatrixTab, setScoringMatrixTab] = useState<ScoringMatrixTab>('Airmanship');

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

    return (
        <div className="flex-1 flex overflow-hidden bg-gray-900">
            {/* Main Content - full width, no left menu */}
            <div className="flex-1 overflow-y-auto bg-gray-900">
                <div className="p-4 sm:p-6">

                    {/* ── ICON GRID HOME ───────────────────────────────────── */}
                    {activeSection === 'home' && (
                        <div className="space-y-6 sm:space-y-8">
                            {/* Page title */}
                            <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-700/60">
                                <div>
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">Settings</h1>
                                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Configure system rules, data sources and operational parameters</p>
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

                            {/* Section groups */}
                            {sectionGroups.map((group) => (
                                <div key={group.label}>
                                    {/* Group label */}
                                    <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="flex-1 h-px bg-gray-700/60" />
                                        {group.label}
                                        <span className="flex-1 h-px bg-gray-700/60" />
                                    </h2>

                                    {/* Icon cards grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                                        {group.sections.map((section) => {
                                            const colorClasses = sectionColors[section].split(' ');
                                            const gradFrom = colorClasses[0];
                                            const gradTo = colorClasses[1];
                                            const borderC = colorClasses[2];
                                            const textC = colorClasses[3];
                                            return (
                                                <button
                                                    key={section}
                                                    onClick={() => setActiveSection(section)}
                                                    className={`group relative flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 lg:p-5 bg-gradient-to-br ${gradFrom} ${gradTo} border ${borderC} rounded-xl sm:rounded-2xl hover:scale-[1.04] hover:shadow-xl hover:shadow-black/40 active:scale-95 transition-all duration-200 cursor-pointer min-h-[90px] sm:min-h-[110px] lg:min-h-[130px]`}
                                                >
                                                    {/* Icon */}
                                                    <div className={`${textC} w-7 h-7 sm:w-9 sm:h-9 lg:w-11 lg:h-11 flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                                                        {sectionIcons[section]}
                                                    </div>
                                                    {/* Label */}
                                                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-200 text-center leading-tight">
                                                        {sectionLabels[section]}
                                                    </span>
                                                    {/* Description - only on large screens */}
                                                    <span className="hidden xl:block text-[10px] text-gray-500 text-center leading-tight px-1">
                                                        {sectionDescriptions[section]}
                                                    </span>
                                                    {/* Hover arrow */}
                                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <svg className={`w-3 h-3 ${textC}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── SECTION CONTENT ──────────────────────────────────── */}
                    {activeSection !== 'home' && (
                    <div>
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
                            <div className={`w-5 h-5 flex-shrink-0 ${sectionColors[activeSection as SettingsSection]?.split(' ')[3] || 'text-sky-400'}`}>
                                {sectionIcons[activeSection as SettingsSection]}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                {sectionLabels[activeSection as SettingsSection]}
                            </h2>
                            <div className="ml-auto flex items-center gap-[10px]">
                                {!['Super Admin', 'Admin', 'Scheduler'].includes(props.currentUserPermission) && (
                                    <div className="text-sm text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-3 py-2">
                                        <strong>Read-Only Mode</strong>
                                    </div>
                                )}
                                <AuditButton pageName={`Settings - ${sectionLabels[activeSection as SettingsSection]}`} />
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

                    {/* All other sections rendered via SettingsView */}
                    {activeSection !== 'scoring-matrix' &&
                     activeSection !== 'user-list' &&
                     activeSection !== 'staff-database' &&
                     activeSection !== 'staff-mockdata' &&
                     activeSection !== 'staff-combined-data' &&
                     activeSection !== 'trainee-database' &&
                     activeSection !== 'trainee-mockdata' &&
                     activeSection !== 'data-sources' && (
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
                        <StaffDatabaseTable />
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
                        <TraineeDatabaseTable />
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