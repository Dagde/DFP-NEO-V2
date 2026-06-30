import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useEffect, useMemo, useState } from 'react';
import InstructorListView from './InstructorListView';
import InstructorScheduleView from './InstructorScheduleView';
import CrewScheduleView from './CrewScheduleView';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import type { StaffQualificationCatalogue } from '../utils/staffQualifications';

interface StaffViewProps {
  // Props for InstructorListView
  onClose: () => void;
  events: any[];
  traineesData: any[];
  instructorsData: any[];
  archivedInstructorsData: any[];
  scheduleHistoryEvents?: any[];
  insertEventTypes?: any[];
  aircraftConfigurations?: any[];
  onInsertAirCombatTrainingEvent?: (...args: any[]) => Promise<boolean> | boolean;
  onUpdateAirCombatTrainingEvent?: (...args: any[]) => Promise<boolean> | boolean;
  onGenerateAirCombatTrainingReport?: (...args: any[]) => Promise<void> | void;
  onAddTrainingReport?: (...args: any[]) => void;
  school: string;
  personnelData: any[];
  onUpdateInstructor: (data: any) => Promise<void>;
  onNavigateToCurrency: (person: any) => void;
  onBulkUpdateInstructors: (updates: any[]) => void;
  onArchiveInstructor: (id: number) => void;
  onRestoreInstructor: (id: number) => void;
  onRequestSct?: (instructor: any) => void;
  locations?: string[];
  units?: string[];
  selectedPersonForProfile?: any;
  onProfileOpened?: () => void;
  onViewLogbook?: (person: any) => void;
  masterCurrencies?: any[];
  currencyRequirements?: any[];
  profileInitialTab?: 'currency' | null;
  onProfileTabConsumed?: () => void;
  currentUserId?: string;
  currentUserName?: string;
  resourceDisplayNames?: ResourceDisplayNames;
  personnelDisplaySettings?: PersonnelDisplaySettings;
  instructorLabel?: string;
  operationalModel?: string;
  crewPositionTerminology?: CrewPositionTerminology;
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  sharedUnitTabs?: string[];
  activeUnitCode?: string;

  // Props for InstructorScheduleView
  date: string;
  onDateChange: (increment: number) => void;
  eventSegmentsForDate: any[];
  zoomLevel: number;
  daylightTimes: { firstLight: string | null; lastLight: string | null };
  seatConfigs: any[];
  syllabusDetails: any[];
  conflictingEventIds: Set<string>;
  showValidation: boolean;
  unavailabilityConflicts: Map<string, any>;
  onSelectEvent: (event: any, options?: any) => void;
  onUpdateEvent: (updates: any[]) => void;
  onSelectInstructor: (instructor: any) => void;
}

const StaffView: React.FC<StaffViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'crewSchedule'>('profile');
  const normaliseUnitCode = (value?: string | null): string => String(value || '').trim().toUpperCase();
  const sharedUnitTabs = useMemo(() => (
    Array.from(new Set((props.sharedUnitTabs || []).map(normaliseUnitCode).filter(Boolean)))
  ), [props.sharedUnitTabs]);
  const [activeUnitTab, setActiveUnitTab] = useState<string>(() => sharedUnitTabs[0] || normaliseUnitCode(props.activeUnitCode));
  useEffect(() => {
    if (sharedUnitTabs.length === 0) return;
    if (!sharedUnitTabs.includes(activeUnitTab)) {
      setActiveUnitTab(sharedUnitTabs[0]);
    }
  }, [activeUnitTab, sharedUnitTabs]);
  const { isFrozen } = useSystemFreeze();
  console.log(`🏫 [STAFFVIEW RENDER] school=${props.school}, instructorsData.length=${props.instructorsData.length}`);
  const isFixedCrewModel = String(props.operationalModel || '').trim().toLowerCase() === 'fixed_crew';
  const shouldShowUnitTabs = isFixedCrewModel && sharedUnitTabs.length > 1;
  useEffect(() => {
    if (!isFixedCrewModel && activeTab === 'crewSchedule') {
      setActiveTab('schedule');
    }
  }, [activeTab, isFixedCrewModel]);
  const scopedInstructorsData = shouldShowUnitTabs
    ? props.instructorsData.filter(instructor => normaliseUnitCode(instructor.unit) === activeUnitTab)
    : props.instructorsData;
  const scopedArchivedInstructorsData = shouldShowUnitTabs
    ? props.archivedInstructorsData.filter(instructor => normaliseUnitCode(instructor.unit) === activeUnitTab)
    : props.archivedInstructorsData;

  // App already provides the active location/unit scoped staff list.
  const shouldGroupCombinedUnitStaffSchedule = isFixedCrewModel && sharedUnitTabs.length > 1;
  const scheduleInstructorsData = shouldGroupCombinedUnitStaffSchedule
    ? props.instructorsData.filter(instructor => sharedUnitTabs.includes(normaliseUnitCode(instructor.unit)))
    : scopedInstructorsData;
  const locationFilteredInstructorsForSchedule = [...scheduleInstructorsData]
    .sort((a, b) => {
      if (shouldGroupCombinedUnitStaffSchedule) {
        const unitA = normaliseUnitCode(a.unit) || 'ZZZ';
        const unitB = normaliseUnitCode(b.unit) || 'ZZZ';
        if (unitA !== unitB) return unitA.localeCompare(unitB);
        return comparePeopleByConfiguredRank(a, b, props.personnelDisplaySettings, 'staff');
      }

      // First sort by Role - flying staff before SIM IPs
      const roleA = a.role === 'QFI' || a.role === 'Pilot' ? 0 : 1;
      const roleB = b.role === 'QFI' || b.role === 'Pilot' ? 0 : 1;
      if (roleA !== roleB) {
        return roleA - roleB;
      }

      // Then sort by Unit
      if (a.unit !== b.unit) {
        return a.unit.localeCompare(b.unit);
      }

      return comparePeopleByConfiguredRank(a, b, props.personnelDisplaySettings, 'staff');
    });

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Tab Header - More obvious tabs */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 pt-3">
        {shouldShowUnitTabs && (
          <div className="mb-3 flex flex-wrap gap-2">
            {sharedUnitTabs.map(unitCode => (
              <button
                key={unitCode}
                type="button"
                onClick={() => setActiveUnitTab(unitCode)}
                className={`h-8 rounded-md border px-4 text-xs font-semibold transition ${
                  activeUnitTab === unitCode
                    ? 'border-emerald-400/80 bg-emerald-900/50 text-white'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {unitCode}
              </button>
            ))}
          </div>
        )}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
              activeTab === 'profile'
                ? 'bg-gray-900 text-white border-2 border-b-0 border-gray-500 shadow-lg'
                : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500'
            }`}
          >
            Staff Profile
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
              activeTab === 'schedule'
                ? 'bg-gray-900 text-white border-2 border-b-0 border-gray-500 shadow-lg'
                : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500'
            }`}
          >
            Staff Schedule
          </button>
          {isFixedCrewModel && (
            <button
              onClick={() => setActiveTab('crewSchedule')}
              className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
                activeTab === 'crewSchedule'
                  ? 'bg-gray-900 text-white border-2 border-b-0 border-gray-500 shadow-lg'
                  : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500'
              }`}
            >
              Crew Schedule
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'profile' && (
          <InstructorListView
            onClose={props.onClose}
            events={props.events}
            traineesData={props.traineesData}
            instructorsData={scopedInstructorsData}
            archivedInstructorsData={scopedArchivedInstructorsData}
            scheduleHistoryEvents={props.scheduleHistoryEvents}
            syllabusDetails={props.syllabusDetails}
            insertEventTypes={props.insertEventTypes}
            aircraftConfigurations={props.aircraftConfigurations}
            onInsertAirCombatTrainingEvent={props.onInsertAirCombatTrainingEvent}
            onUpdateAirCombatTrainingEvent={props.onUpdateAirCombatTrainingEvent}
            onGenerateAirCombatTrainingReport={props.onGenerateAirCombatTrainingReport}
            onAddTrainingReport={props.onAddTrainingReport}
            school={props.school}
            personnelData={props.personnelData}
            onUpdateInstructor={props.onUpdateInstructor}
            onNavigateToCurrency={props.onNavigateToCurrency}
            onBulkUpdateInstructors={props.onBulkUpdateInstructors}
            onArchiveInstructor={props.onArchiveInstructor}
            onRestoreInstructor={props.onRestoreInstructor}
            onRequestSct={props.onRequestSct}
            locations={props.locations}
            units={props.units}
            selectedPersonForProfile={props.selectedPersonForProfile}
            onProfileOpened={props.onProfileOpened}
            onViewLogbook={props.onViewLogbook}
            masterCurrencies={props.masterCurrencies}
            currencyRequirements={props.currencyRequirements}
            profileInitialTab={props.profileInitialTab}
            onProfileTabConsumed={props.onProfileTabConsumed}
            currentUserId={props.currentUserId}
            currentUserName={props.currentUserName}
            resourceDisplayNames={props.resourceDisplayNames}
            personnelDisplaySettings={props.personnelDisplaySettings}
            instructorLabel={props.instructorLabel}
            operationalModel={props.operationalModel}
            crewPositionTerminology={props.crewPositionTerminology}
            staffQualificationCatalogue={props.staffQualificationCatalogue}
          />
        )}
        {activeTab === 'schedule' && (
          <InstructorScheduleView
            date={props.date}
            onDateChange={props.onDateChange}
            events={props.eventSegmentsForDate}
            instructors={locationFilteredInstructorsForSchedule.map(i => ({ name: i.name, rank: i.rank, unit: i.unit, role: i.role }))}
            instructorsData={locationFilteredInstructorsForSchedule}
            traineesData={props.traineesData}
            onSelectEvent={props.onSelectEvent}
            onUpdateEvent={props.onUpdateEvent}
            zoomLevel={props.zoomLevel}
            daylightTimes={props.daylightTimes}
            personnelData={props.personnelData}
            seatConfigs={props.seatConfigs}
            syllabusDetails={props.syllabusDetails}
            conflictingEventIds={props.conflictingEventIds}
            showValidation={props.showValidation}
            unavailabilityConflicts={props.unavailabilityConflicts}
            onSelectInstructor={props.onSelectInstructor}
            operationalModel={props.operationalModel}
            crewPositionTerminology={props.crewPositionTerminology}
            instructorLabel={props.instructorLabel}
          />
        )}
        {activeTab === 'crewSchedule' && isFixedCrewModel && (
          <CrewScheduleView
            date={props.date}
            onDateChange={props.onDateChange}
            events={props.eventSegmentsForDate}
            instructorsData={props.instructorsData}
            traineesData={props.traineesData}
            onSelectEvent={props.onSelectEvent}
            zoomLevel={props.zoomLevel}
            daylightTimes={props.daylightTimes}
            personnelData={props.personnelData}
            seatConfigs={props.seatConfigs}
            conflictingEventIds={props.conflictingEventIds}
          />
        )}
      </div>
    </div>
  );
};

export default StaffView;
