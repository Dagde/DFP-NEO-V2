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

type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone' | 'user-list' | 'staff-database' | 'trainee-database' | 'staff-mockdata' | 'trainee-mockdata' | 'staff-combined-data' | 'data-sources';

export const SettingsViewWithMenu: React.FC<SettingsViewWithMenuProps> = (props) => {
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

    const menuItems = [
        { id: 'validation' as const, label: 'AC History' },
        { id: 'timezone' as const, label: 'Timezone' },
        { id: 'scoring-matrix' as const, label: 'Scoring Matrix' },
        { id: 'location' as const, label: 'Location' },
        { id: 'units' as const, label: 'Units' },
        { id: 'duty-turnaround' as const, label: 'Duty & Turnaround' },
        { id: 'sct-events' as const, label: 'SCT Events' },
        { id: 'currencies' as const, label: 'Currencies' },
        { id: 'business-rules' as const, label: 'Business Rules' },
        { id: 'data-loaders' as const, label: 'Data Loaders' },
        { id: 'event-limits' as const, label: 'Event Limits' },
        { id: 'permissions' as const, label: 'Permissions' },
        { id: 'user-list' as const, label: 'User List' },
        { id: 'staff-database' as const, label: 'Staff Database' },
        { id: 'trainee-database' as const, label: 'Trainee Database' },
        { id: 'staff-mockdata' as const, label: 'Staff MockData' },
        { id: 'trainee-mockdata' as const, label: 'Trainee MockData' },
        { id: 'data-sources' as const, label: 'Data Sources' },
        { id: 'staff-combined-data' as const, label: 'Staff Combined Data' },
    ];

    return (
        <div className="flex-1 flex overflow-hidden bg-gray-900">
            {/* Side Menu */}
            <div className="w-[140px] bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
                <div className="p-3 border-b border-gray-700">
                    <h1 className="text-lg font-bold text-white">Settings</h1>
                </div>
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                                activeSection === item.id
                                    ? 'bg-sky-600 text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            <span className="font-medium">{item.label}</span>
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
                            {activeSection === 'validation' && 'AC History'}
                            {activeSection === 'timezone' && 'Timezone Settings'}
                            {activeSection === 'scoring-matrix' && 'Scoring Matrix'}
                            {activeSection === 'location' && 'Location'}
                            {activeSection === 'units' && 'Units'}
                            {activeSection === 'duty-turnaround' && 'Duty & Turnaround'}
                            {activeSection === 'sct-events' && 'SCT Events'}
                            {activeSection === 'currencies' && 'Currencies'}
                            {activeSection === 'business-rules' && 'Business Rules'}
                            {activeSection === 'data-loaders' && 'Data Loaders'}
                            {activeSection === 'event-limits' && 'Event Limits'}
                            {activeSection === 'permissions' && 'Permissions Manager'}
                               {activeSection === 'user-list' && 'User List'}
                                  {activeSection === 'staff-database' && 'Staff Database'}
                                  {activeSection === 'trainee-database' && 'Trainee Database'}
                                  {activeSection === 'staff-mockdata' && 'Staff MockData'}
                                  {activeSection === 'trainee-mockdata' && 'Trainee MockData'}
                                  {activeSection === 'staff-combined-data' && 'Staff Combined Data'}
                                     {activeSection === 'data-sources' && 'Data Sources'}
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