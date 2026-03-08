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
    showDepartureDensityOverlay: boolean;
    onUpdateShowDepartureDensityOverlay: (value: boolean) => void;
    // Aircraft Availability Panel props
    dayFlyingStart: string;
    dayFlyingEnd: string;
    totalAircraft: number;
    availableAircraftCount: number;
    onUpdateCurrentAvailability?: (count: number) => void;
    currentUserId?: string | number;
}

type SettingsCategory = 'airmanship' | 'preparation' | 'technique' | 'elements';

type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone' | 'user-list' | 'staff-database' | 'trainee-database' | 'staff-mockdata' | 'trainee-mockdata' | 'staff-combined-data' | 'data-sources';

const categoryConfig: Record<SettingsCategory, { label: string; sections: SettingsSection[] }> = {
    airmanship: {
        label: 'Airmanship',
        sections: ['scoring-matrix', 'currencies', 'sct-events', 'event-limits']
    },
    preparation: {
        label: 'Preparation',
        sections: ['data-loaders', 'data-sources', 'user-list', 'staff-database', 'trainee-database', 'staff-mockdata', 'trainee-mockdata', 'staff-combined-data']
    },
    technique: {
        label: 'Technique',
        sections: ['duty-turnaround', 'business-rules', 'permissions']
    },
    elements: {
        label: 'Elements',
        sections: ['validation', 'timezone', 'location', 'units']
    }
};

const sectionLabels: Record<SettingsSection, string> = {
    'validation': 'AC History',
    'scoring-matrix': 'Scoring Matrix',
    'location': 'Location',
    'units': 'Units',
    'duty-turnaround': 'Duty & Turnaround',
    'sct-events': 'SCT Events',
    'currencies': 'Currencies',
    'data-loaders': 'Data Loaders',
    'event-limits': 'Event Limits',
    'permissions': 'Permissions',
    'business-rules': 'Business Rules',
    'timezone': 'Timezone',
    'user-list': 'User List',
    'staff-database': 'Staff Database',
    'trainee-database': 'Trainee Database',
    'staff-mockdata': 'Staff MockData',
    'trainee-mockdata': 'Trainee MockData',
    'staff-combined-data': 'Staff Combined Data',
    'data-sources': 'Data Sources'
};

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('airmanship');
    const [activeSection, setActiveSection] = useState<SettingsSection>('scoring-matrix');
    const [filteredMockdata, setFilteredMockdata] = useState<Instructor[]>([]);
    const [filteredTraineeMockdata, setFilteredTraineeMockdata] = useState<any[]>([]);

    // Initialize filtered mockdata with instructorsData
    React.useEffect(() => {
        setFilteredMockdata(props.instructorsData);
    }, [props.instructorsData]);

    // Initialize filtered trainee mockdata with traineesData
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

    // Get sections for current category
    const getCurrentSections = () => {
        return categoryConfig[activeCategory].sections;
    };

    // Handle category change - reset to first section in that category
    const handleCategoryChange = (category: SettingsCategory) => {
        setActiveCategory(category);
        setActiveSection(categoryConfig[category].sections[0]);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
            {/* Top Tabs */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
                <div className="flex items-center space-x-1">
                    {(Object.keys(categoryConfig) as SettingsCategory[]).map((category) => (
                        <button
                            key={category}
                            onClick={() => handleCategoryChange(category)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-all ${
                                activeCategory === category
                                    ? 'bg-sky-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            {categoryConfig[category].label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Secondary Side Menu - Elements for selected category */}
                <div className="w-[140px] bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
                    <div className="p-3 border-b border-gray-700">
                        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {categoryConfig[activeCategory].label}
                        </h2>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                        {getCurrentSections().map((sectionId) => (
                            <button
                                key={sectionId}
                                onClick={() => setActiveSection(sectionId)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                                    activeSection === sectionId
                                        ? 'bg-sky-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                            >
                                <span className="font-medium">{sectionLabels[sectionId]}</span>
                            </button>
                        ))}
                    </nav>
                    
                    {/* Audit Button at Bottom */}
                    <div className="p-4 border-t border-gray-700">
                        <AuditButton pageName="Settings" />
                    </div>
                </div>

                {/* Main Content - Render original SettingsView with filtered content */}
                <div className="flex-1 overflow-y-auto bg-gray-900">
                    <div className="p-6">
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
                    <SettingsView {...props} hideHeader={true} activeSection={activeSection} />
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
                               {activeSection === 'trainee-database' && (
                                   <TraineeDatabaseTable />
                               )}
                            {activeSection === 'staff-mockdata' && (
                                <StaffMockDataTable 
                                    instructorsData={filteredMockdata}
                                    onDeleteFromMockdata={handleDeleteFromMockdata}
                                />
                            )}
                               {activeSection === 'trainee-mockdata' && (
                                   <TraineeMockDataTable
                                       traineesData={filteredTraineeMockdata}
                                       onDeleteFromMockdata={handleDeleteTraineeFromMockdata}
                                   />
                               )}
                             {activeSection === 'staff-combined-data' && (
                                <StaffCombinedDataTable instructorsData={props.instructorsData} />
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