import React, { useState } from 'react';
import InstructorListView from './InstructorListView';
import InstructorScheduleView from './InstructorScheduleView';

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
  
  // Props for InstructorScheduleView
  date: string;
  onDateChange: (date: string) => void;
  eventSegmentsForDate: any[];
  zoomLevel: number;
  daylightTimes: { firstLight: string; lastLight: string };
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

  // Define rank order for sorting
  const rankOrder: { [key: string]: number } = {
    'WGCDR': 1,
    'SQNLDR': 2,
    'FLTLT': 3,
    'FLGOFF': 4,
    'PLTOFF': 5
  };

  // Filter and sort instructors by location for Staff Schedule
  const locationFilteredInstructorsForSchedule = props.instructorsData
    .filter(i => {
      if (props.school === 'ESL') {
        // ESL: Only 1FTS and CFS staff
        return i.unit === '1FTS' || i.unit === 'CFS';
      } else {
        // PEA: Only 2FTS staff
        return i.unit === '2FTS';
      }
    })
    .sort((a, b) => {
      // First sort by Role - QFIs before SIM IPs
      const roleA = a.role === 'QFI' ? 0 : 1;
      const roleB = b.role === 'QFI' ? 0 : 1;
      if (roleA !== roleB) {
        return roleA - roleB;
      }
      
      // Then sort by Unit
      if (a.unit !== b.unit) {
        return a.unit.localeCompare(b.unit);
      }
      
      // Then sort by Rank using defined order
      const rankA = rankOrder[a.rank] || 999;
      const rankB = rankOrder[b.rank] || 999;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      // Finally sort alphabetically by surname
      // Extract surname (last word in name)
      const surnameA = a.name.split(' ').pop() || '';
      const surnameB = b.name.split(' ').pop() || '';
      return surnameA.localeCompare(surnameB);
    });

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Tab Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'bg-gray-900 text-white border-b-2 border-sky-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
            }`}
          >
            Staff Profile
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'schedule'
                ? 'bg-gray-900 text-white border-b-2 border-sky-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
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