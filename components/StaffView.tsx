import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useState } from 'react';
import InstructorListView from './InstructorListView';
import InstructorScheduleView from './InstructorScheduleView';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';

interface StaffViewProps {
  // Props for InstructorListView
  onClose: () => void;
  events: any[];
  traineesData: any[];
  instructorsData: any[];
  archivedInstructorsData: any[];
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

  // Props for InstructorScheduleView
  date: string;
  onDateChange: (date: string) => void;
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
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule'>('profile');
  const { isFrozen } = useSystemFreeze();
  console.log(`🏫 [STAFFVIEW RENDER] school=${props.school}, instructorsData.length=${props.instructorsData.length}`);

  // App already provides the active location/unit scoped staff list.
  const locationFilteredInstructorsForSchedule = props.instructorsData
    .sort((a, b) => {
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
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'profile' && (
          <InstructorListView
            onClose={props.onClose}
            events={props.events}
            traineesData={props.traineesData}
            instructorsData={props.instructorsData}
            archivedInstructorsData={props.archivedInstructorsData}
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
          />
        )}
        {activeTab === 'schedule' && (
          <InstructorScheduleView
            date={props.date}
            onDateChange={props.onDateChange}
            events={props.eventSegmentsForDate}
            instructors={locationFilteredInstructorsForSchedule.map(i => ({ name: i.name, rank: i.rank, unit: i.unit }))}
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
          />
        )}
      </div>
    </div>
  );
};

export default StaffView;
