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

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('scoring-matrix');
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
            {/* Left Menu - all sections */}
            <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
                <nav className="flex-1 overflow-y-auto py-2">
                    {allSections.map((section) => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`w-full text-left px-4 py-2 text-sm transition-all ${
                                activeSection === section
                                    ? 'bg-sky-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            {sectionLabels[section]}
                        </button>
                    ))}
                </nav>

                {/* Audit Button at Bottom */}
                <div className="p-2 border-t border-gray-700">
                    <AuditButton pageName="Settings" />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-gray-900">
                <div className="p-6">
                    {/* Section Header */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white mb-3">
                            {sectionLabels[activeSection]}
                        </h2>
                        {!['Super Admin', 'Admin', 'Scheduler'].includes(props.currentUserPermission) && (
                            <div className="text-sm text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-3 py-2 inline-block">
                                <strong>Read-Only Mode</strong>
                            </div>
                        )}
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
                                {/* Right side: read-only badge + audit button */}
                                <div className="flex items-center space-x-3">
                                    {!['Super Admin', 'Admin'].includes(props.currentUserPermission) && (
                                        <span className="text-xs text-yellow-200 bg-yellow-900/30 border border-yellow-600/50 rounded px-2 py-1">
                                            <strong>Read-Only</strong>
                                        </span>
                                    )}
                                    <AuditButton pageName="Settings - Scoring Matrix" />
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
                        <SettingsView {...props} hideHeader={true} activeSection={activeSection} />
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
                </div>
            </div>
        </div>
    );
};