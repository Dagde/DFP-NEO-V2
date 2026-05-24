import { useSystemFreeze } from "../hooks/useSystemFreeze";
import React, { useState } from 'react';
import CourseRosterView from './CourseRosterView';
import TraineeScheduleView from './TraineeScheduleView';
import type { ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import type { TrainingReportTerminology } from '../utils/trainingReportTerminology';

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
  onAddRemedialPackage: (trainee: any) => void;
  onSelectPt051ForEvent?: (trainee: any, assessment: any) => void;
  locations: string[];
  units: string[];
  selectedPersonForProfile: any;
  selectedProfileInitialTab?: 'unavailable' | 'currency' | 'logbook' | 'hatesheet' | 'lmp' | null;
  onProfileOpened: () => void;
  traineeLMPs: Map<string, any[]>;
  onViewLogbook: (trainee: any) => void;
  onDeleteTrainee: (trainee: any) => void;
  onDeleteRemedialItem?: (trainee: any, item: any) => Promise<boolean> | boolean;
  onGeneratePt051ForItem?: (trainee: any, item: any) => void;
  onOpenInstructorProfile?: (instructorName: string) => void;
  // Course edit callbacks
  onUpdateCourseNumber?: (oldCourseNumber: string, newCourseNumber: string) => void;
  onUpdateCourseUnit?: (courseNumber: string, newUnit: string) => void;
  onBackcourseTrainee?: (trainee: any, newCourse: string) => void;
  masterCurrencies?: any[];
  currencyRequirements?: any[];
  currentUserId?: string;
  currentUserName?: string;
  pt051Assessments?: Map<string, any>;
  pt051PerformanceLoading?: boolean;
  userProfile?: any;
  canViewTraineeProfile?: (trainee: any) => boolean;
  canViewTraineePt051?: (trainee: any) => boolean;
  canEditTraineePt051?: (trainee: any) => boolean;
  canViewTraineeLmp?: (trainee: any) => boolean;
  canAddRemedialPackageForTrainee?: (trainee: any) => boolean;
  onAccessDenied?: (actionLabel: string) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  personnelDisplaySettings?: PersonnelDisplaySettings;
  trainingReportTerminology?: TrainingReportTerminology;

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
  const { isFrozen } = useSystemFreeze();

  // Sort trainees for schedule view
  const sortedTrainees = [...props.traineesData]
    .sort((a, b) => {
      // First sort by course
      if (a.course !== b.course) {
        return a.course.localeCompare(b.course);
      }
      return comparePeopleByConfiguredRank(a, b, props.personnelDisplaySettings, 'trainee');
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
      <div className="flex-1 flex flex-col overflow-y-auto">
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
            onAddRemedialPackage={props.onAddRemedialPackage}
            onSelectPt051ForEvent={props.onSelectPt051ForEvent}
            locations={props.locations}
            units={props.units}
            selectedPersonForProfile={props.selectedPersonForProfile}
            selectedProfileInitialTab={props.selectedProfileInitialTab}
            onProfileOpened={props.onProfileOpened}
            traineeLMPs={props.traineeLMPs}
            onViewLogbook={props.onViewLogbook}
            onDeleteTrainee={props.onDeleteTrainee}
            onDeleteRemedialItem={props.onDeleteRemedialItem}
            onGeneratePt051ForItem={props.onGeneratePt051ForItem}
            onOpenInstructorProfile={props.onOpenInstructorProfile}
            onUpdateCourseNumber={props.onUpdateCourseNumber}
            onUpdateCourseUnit={props.onUpdateCourseUnit}
            onBackcourseTrainee={props.onBackcourseTrainee}
            masterCurrencies={props.masterCurrencies}
            currencyRequirements={props.currencyRequirements}
            currentUserId={props.currentUserId}
            currentUserName={props.currentUserName}
            resourceDisplayNames={props.resourceDisplayNames}
            personnelDisplaySettings={props.personnelDisplaySettings}
            trainingReportTerminology={props.trainingReportTerminology}
            pt051Assessments={props.pt051Assessments}
            pt051PerformanceLoading={props.pt051PerformanceLoading}
            userProfile={props.userProfile}
            canViewTraineeProfile={props.canViewTraineeProfile}
            canViewTraineePt051={props.canViewTraineePt051}
            canEditTraineePt051={props.canEditTraineePt051}
            canViewTraineeLmp={props.canViewTraineeLmp}
            canAddRemedialPackageForTrainee={props.canAddRemedialPackageForTrainee}
            onAccessDenied={props.onAccessDenied}
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
