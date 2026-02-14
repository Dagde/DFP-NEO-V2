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

type TabType = 'people' | 'course-metrics' | 'build-analytics';

const BuildIntelligenceView: React.FC<BuildIntelligenceViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('people');

  const formattedDate = useMemo(() => {
    const [year, month, day] = props.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return dateObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: '2-digit',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }, [props.date]);

  const tabs = [
    { id: 'people' as TabType, label: 'People', icon: '👥' },
    { id: 'course-metrics' as TabType, label: 'Course Metrics', icon: '📊' },
    { id: 'build-analytics' as TabType, label: 'Build Analytics', icon: '📈' }
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
                    px-6 py-3 text-sm font-medium rounded-t-lg transition-all duration-200
                    ${activeTab === tab.id
                      ? 'bg-gray-800 text-sky-400 border-t-2 border-x-2 border-sky-400 border-b-0'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildIntelligenceView;