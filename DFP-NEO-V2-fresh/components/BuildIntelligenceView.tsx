import React, { useState, useMemo } from 'react';
import { ScheduleEvent, Instructor, Trainee, Score, SyllabusItemDetail } from '../types';
import PeopleTab from './tabs/PeopleTab';
import CourseMetricsTab from './tabs/CourseMetricsTab';
import BuildAnalyticsTab from './tabs/BuildAnalyticsTab';

interface CourseAnalysis {
  courseName: string;
  targetPercentage: number;
  actualPercentage: number;
  deviation: number;
  eventCount: number;
  possibleEvents: number;
  schedulingEfficiency: number;
  eventsByType: {
    flight: number;
    ftd: number;
    cpt: number;
    ground: number;
  };
  limitingFactors: {
    insufficientInstructors: number;
    noAircraftSlots: number;
    noFtdSlots: number;
    noCptSlots: number;
    traineeLimit: number;
    instructorLimit: number;
    noTimeSlots: number;
  };
  status: 'good' | 'fair' | 'poor';
}

interface TimeDistribution {
  eventsByHour: Map<number, number>;
  clusteringScore: number;
  uniformityScore: number;
}

interface ResourceUtilization {
  aircraftUtilization: number;
  instructorUtilization: number;
  ftdUtilization: number;
  standbyCount: number;
}

interface Insight {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  recommendation?: string;
}

interface BuildAnalysis {
  buildDate: string;
  totalEvents: number;
  availableAircraft: number;
  courseAnalysis: CourseAnalysis[];
  timeDistribution: TimeDistribution;
  resourceUtilization: ResourceUtilization;
  insights: Insight[];
}

interface BuildIntelligenceViewProps {
  // From Program Data
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  traineesData: Trainee[];
  activeCourses: string[];
  onNavigateAndSelectPerson: (name: string) => void;
  scores: Map<string, Score[]>;
  syllabusDetails: SyllabusItemDetail[];
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  courseColors: { [key: string]: string };
  
  // From Build Analysis
  buildDate: string;
  analysis: BuildAnalysis | null;
}

type TabType = 'people' | 'course-metrics' | 'build-analytics' | 'managerial-analytics';

const BuildIntelligenceView: React.FC<BuildIntelligenceViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('people');

  const formattedDate = useMemo(() => {
    const [year, month, day] = props.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    // Format: DD Mmm YY (e.g., "10 Mar 25")
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    });
  }, [props.date]);

  const tabs = [
    { id: 'people' as TabType, label: 'People' },
    { id: 'course-metrics' as TabType, label: 'Course Metrics' },
    { id: 'build-analytics' as TabType, label: 'Build Analytics' },
    { id: 'managerial-analytics' as TabType, label: 'Managerial Analytics' }
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="p-6 pb-0">
          <h1 className="text-3xl font-bold text-white">Build Intelligence</h1>
          <p className="text-lg text-gray-400">
            Comprehensive analysis for DFP on <span className="text-gray-200 font-semibold">{formattedDate}</span>
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 pt-4">
          <div className="border-b border-gray-700">
            <nav className="flex space-x-1" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-[180px] px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all duration-200
                    ${activeTab === tab.id
                      ? 'bg-gray-900 text-white border-2 border-b-0 border-gray-500 shadow-lg'
                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto w-full">
            {activeTab === 'people' && (
              <PeopleTab
                date={props.date}
                events={props.events}
                instructorsData={props.instructorsData}
                traineesData={props.traineesData}
                onNavigateAndSelectPerson={props.onNavigateAndSelectPerson}
                scores={props.scores}
                traineeLMPs={props.traineeLMPs}
                courseColors={props.courseColors}
              />
            )}

            {activeTab === 'course-metrics' && (
              <CourseMetricsTab
                date={props.date}
                events={props.events}
                traineesData={props.traineesData}
                activeCourses={props.activeCourses}
                onNavigateAndSelectPerson={props.onNavigateAndSelectPerson}
                analysis={props.analysis}
              />
            )}

            {activeTab === 'build-analytics' && (
              <BuildAnalyticsTab
                events={props.events}
                analysis={props.analysis}
              />
            )}

            {activeTab === 'managerial-analytics' && (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400">Managerial Analytics coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildIntelligenceView;