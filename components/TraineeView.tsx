import React, { useState } from 'react';
import CourseRosterView from './CourseRosterView';
import TraineeScheduleView from './TraineeScheduleView';

interface TraineeViewProps {
  // Props for CourseRosterView
  events: any[];
  traineesData: any[];
  courseColors: { [key: string]: string };
  archivedCourses: { [key: string]: string };
  personnelData: any[];
  onNavigateToHateSheet: (trainee: any) => void;
  onRestoreCourse: () => void;
  onUpdateTrainee: (data: any) => void;
  onAddTrainee: (data: any) => void;
  school: string;
  scores: Map<string, any[]>;
  syllabusDetails: any[];
  onNavigateToSyllabus: (item: any) => void;
  onNavigateToCurrency: (person: any) => void;
  onViewIndividualLMP: (trainee: any) => void;
  onAddRemedialPackage: (trainee: any) => void;
  locations: string[];
  units: string[];
  selectedPersonForProfile: any;
  onProfileOpened: () => void;
  traineeLMPs: Map<string, any[]>;
  onViewLogbook: (trainee: any) => void;
  onDeleteTrainee: (trainee: any) => void;
  
  // Props for TraineeScheduleView
  date: string;
  onDateChange: (date: string) => void;
  eventsForStaffTraineeSchedule: any[];
  zoomLevel: number;
  daylightTimes: { firstLight: string; lastLight: string };
  seatConfigs: any[];
  conflictingEventIds: Set<string>;
  showValidation: boolean;
  unavailabilityConflicts: Map<string, any>;
  onSelectEvent: (event: any, options?: any) => void;
  onUpdateEvent: (updates: any[]) => void;
  onSelectTrainee: (trainee: any) => void;
}

const TraineeView: React.FC<TraineeViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule'>('profile');

  // Sort trainees for schedule view
  const sortedTrainees = [...props.traineesData]
    .sort((a, b) => {
      // First sort by course
      if (a.course !== b.course) {
        return a.course.localeCompare(b.course);
      }
      // Then sort alphabetically by name within the same course
      return a.name.localeCompare(b.name);
    })
    .map(t => t.fullName);

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
            Trainee Profile
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
              activeTab === 'schedule'
                ? 'bg-gray-900 text-white border-2 border-b-0 border-gray-500 shadow-lg'
                : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500'
            }`}
          >
            Trainee Schedule
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'profile' && (
          <CourseRosterView
            events={props.events}
            traineesData={props.traineesData}
            courseColors={props.courseColors}
            archivedCourses={props.archivedCourses}
            personnelData={props.personnelData}
            onNavigateToHateSheet={props.onNavigateToHateSheet}
            onRestoreCourse={props.onRestoreCourse}
            onUpdateTrainee={props.onUpdateTrainee}
            onAddTrainee={props.onAddTrainee}
            school={props.school}
            scores={props.scores}
            syllabusDetails={props.syllabusDetails}
            onNavigateToSyllabus={props.onNavigateToSyllabus}
            onNavigateToCurrency={props.onNavigateToCurrency}
            onViewIndividualLMP={props.onViewIndividualLMP}
            onAddRemedialPackage={props.onAddRemedialPackage}
            locations={props.locations}
            units={props.units}
            selectedPersonForProfile={props.selectedPersonForProfile}
            onProfileOpened={props.onProfileOpened}
            traineeLMPs={props.traineeLMPs}
            onViewLogbook={props.onViewLogbook}
            onDeleteTrainee={props.onDeleteTrainee}
          />
        )}
        {activeTab === 'schedule' && (
          <TraineeScheduleView
            date={props.date}
            onDateChange={props.onDateChange}
            events={props.eventsForStaffTraineeSchedule}
            trainees={sortedTrainees}
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
            onSelectTrainee={props.onSelectTrainee}
            courseColors={props.courseColors}
          />
        )}
      </div>
    </div>
  );
};

export default TraineeView;