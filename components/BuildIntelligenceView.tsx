import React, { useEffect, useState, useMemo } from 'react';
import { ScheduleEvent, Instructor, Trainee, Score, SyllabusItemDetail, CancellationRecord } from '../types';
import PeopleTab from './tabs/PeopleTab';
import CourseMetricsTab from './tabs/CourseMetricsTab';
import BuildAnalyticsTab from './tabs/BuildAnalyticsTab';
import TrainingIntelligenceTab from './tabs/TrainingIntelligenceTab';
import AirCombatTrainingAnalyticsTab from './tabs/AirCombatTrainingAnalyticsTab';
import BliTab from './tabs/BliTab';
import AirCombatIntelligenceTab from './tabs/AirCombatIntelligenceTab';
import ACHistoryIntelligencePanel from './ACHistoryIntelligencePanel';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
  getOperationalModelLabel,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
} from '../utils/platformConfigService';

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
  currentUserRole: string;
  currentUserId?: string;
  cancellationRecords: CancellationRecord[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  timezoneOffset?: number;
  dayFlyingStart?: string;
  dayFlyingEnd?: string;
  resourceDisplayNames?: ResourceDisplayNames;
  operationalModel?: string;
  operationalContext?: {
    locationCode?: string;
    unitCode?: string;
    unitName?: string;
    unitCodes?: string[];
    isSharedFleetContext?: boolean;
  };
  
  // From Build Analysis
  buildDate: string;
  analysis: BuildAnalysis | null;
}

type TabType = 'air-combat' | 'people' | 'course-metrics' | 'build-analytics' | 'ac-history' | 'managerial-analytics' | 'bli';

const BuildIntelligenceView: React.FC<BuildIntelligenceViewProps> = (props) => {
  const activeModel = normaliseOperationalModel(props.operationalModel);
  const isAirCombatModel = activeModel === 'air_combat';
  const isCrewOperationalModel = isAirCombatModel || isFixedCrewLikeOperationalModel(activeModel);
  const activeModelLabel = getOperationalModelLabel(activeModel);
  const [activeTab, setActiveTab] = useState<TabType>(isCrewOperationalModel ? 'air-combat' : 'people');
  const resourceDisplayNames = props.resourceDisplayNames || DEFAULT_RESOURCE_DISPLAY_NAMES;

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

  useEffect(() => {
    if (!isCrewOperationalModel && activeTab === 'air-combat') setActiveTab('people');
  }, [activeTab, isCrewOperationalModel]);

  const tabs = [
    ...(isCrewOperationalModel ? [{ id: 'air-combat' as TabType, label: 'Operational' }] : []),
    { id: 'people' as TabType, label: 'People' },
    { id: 'course-metrics' as TabType, label: 'Course Metrics' },
    { id: 'build-analytics' as TabType, label: 'Build Analytics' },
    { id: 'ac-history' as TabType, label: 'AC History' },
    { id: 'managerial-analytics' as TabType, label: 'Managerial Analytics' },
    { id: 'bli' as TabType, label: 'BLI' }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#111827] text-slate-100">
      <div className="flex h-full flex-col">
        {/* Header */}
        <header className="border-b border-slate-700/60 bg-[#111827] px-6 py-5">
          <div className="mx-auto max-w-7xl rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <div className="mb-2 flex items-center gap-3">
              <span className="h-10 w-1 rounded-full bg-cyan-300" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">NEO Build</p>
                <h1 className="text-3xl font-bold text-white">Build Intelligence</h1>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              {activeModelLabel} analysis for DFP on <span className="font-semibold text-white">{formattedDate}</span>
            </p>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 pt-5">
          <div className="mx-auto max-w-7xl rounded-lg border border-cyan-500/25 bg-slate-900/80 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
            <nav className="flex flex-wrap gap-2" aria-label="Build intelligence tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    min-w-[170px] rounded-md border px-4 py-2.5 text-sm font-semibold transition-all duration-200
                    ${activeTab === tab.id
                      ? 'border-cyan-400/70 bg-cyan-500/15 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                      : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-500/45 hover:bg-cyan-500/10 hover:text-white'
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
          <div className="mx-auto w-full max-w-7xl">
            {activeTab === 'people' && (
              <PeopleTab
                date={props.date}
                events={props.events}
                instructorsData={props.instructorsData}
                traineesData={props.traineesData}
                onNavigateAndSelectPerson={props.onNavigateAndSelectPerson}
                scores={props.scores}
                traineeLMPs={props.traineeLMPs}
                syllabusDetails={props.syllabusDetails}
                courseColors={props.courseColors}
                resourceDisplayNames={resourceDisplayNames}
                operationalModel={props.operationalModel}
                operationalContext={props.operationalContext}
              />
            )}

            {activeTab === 'air-combat' && (
              <AirCombatIntelligenceTab
                date={props.date}
                events={props.events}
                instructorsData={props.instructorsData}
                currentAircraftAvailable={props.currentAircraftAvailable}
                totalAircraft={props.totalAircraft}
                resourceDisplayNames={resourceDisplayNames}
                operationalContext={props.operationalContext}
                operationalModel={props.operationalModel}
              />
            )}

            {activeTab === 'course-metrics' && (
              <CourseMetricsTab
                date={props.date}
                events={props.events}
                traineesData={props.traineesData}
                activeCourses={props.activeCourses}
                courseColors={props.courseColors}
                onNavigateAndSelectPerson={props.onNavigateAndSelectPerson}
                analysis={props.analysis}
                resourceDisplayNames={resourceDisplayNames}
                instructorsData={props.instructorsData}
                syllabusDetails={props.syllabusDetails}
                operationalModel={props.operationalModel}
                operationalContext={props.operationalContext}
              />
            )}

            {activeTab === 'build-analytics' && (
              <BuildAnalyticsTab
                events={props.events}
                analysis={props.analysis}
                resourceDisplayNames={resourceDisplayNames}
              />
            )}

            {activeTab === 'ac-history' && (
              <ACHistoryIntelligencePanel
                cancellationRecords={props.cancellationRecords}
                currentUserId={props.currentUserId}
                currentAircraftAvailable={props.currentAircraftAvailable}
                totalAircraft={props.totalAircraft}
                currentUserRole={props.currentUserRole}
                timezoneOffset={props.timezoneOffset}
                dayFlyingStart={props.dayFlyingStart}
                dayFlyingEnd={props.dayFlyingEnd}
                resourceDisplayNames={resourceDisplayNames}
              />
            )}

            {activeTab === 'managerial-analytics' && (
              isAirCombatModel ? (
                <AirCombatTrainingAnalyticsTab
                  instructorsData={props.instructorsData}
                  syllabusDetails={props.syllabusDetails}
                  operationalContext={props.operationalContext}
                />
              ) : (
                <TrainingIntelligenceTab />
              )
            )}

            {activeTab === 'bli' && (
              <BliTab
                date={props.date}
                events={props.events}
                instructorsData={props.instructorsData}
                currentAircraftAvailable={props.currentAircraftAvailable}
                totalAircraft={props.totalAircraft}
                operationalContext={props.operationalContext}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildIntelligenceView;
