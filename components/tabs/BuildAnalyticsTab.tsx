import React, { useMemo } from 'react';
import { ScheduleEvent } from '../../types';
import StatCard from '../shared/StatCard';
import LimitingFactorsSection from '../shared/LimitingFactorsSection';
import TimeDistributionChart from '../shared/TimeDistributionChart';
import InsightsSection from '../shared/InsightsSection';

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

interface BuildAnalyticsTabProps {
  events: ScheduleEvent[];
  analysis: BuildAnalysis | null;
}

const BuildAnalyticsTab: React.FC<BuildAnalyticsTabProps> = ({ events, analysis }) => {
  // Tiles statistics from events
  const tilesStats = useMemo(() => {
    const flightTiles = events.filter(e => e.type === 'flight').length;
    const ftdTiles = events.filter(e => e.type === 'ftd').length;
    const standbyEvents = events.filter(e => e.resourceId.startsWith('STBY')).length;

    return {
      flightTiles,
      ftdTiles,
      combinedTiles: flightTiles + ftdTiles,
      standbyEvents
    };
  }, [events]);

  if (!analysis) {
    return (
      <div className="space-y-6">
        {/* Tiles - always available from events */}
        <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
          <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Tiles</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Flight Tiles" value={tilesStats.flightTiles} />
            <StatCard title="Total FTD Tiles" value={tilesStats.ftdTiles} />
            <StatCard title="Combined Flight/FTD" value={tilesStats.combinedTiles} />
            <StatCard title="Standby Events" value={tilesStats.standbyEvents} description="Reason not specified." />
          </div>
        </fieldset>

        {/* Empty state for build analysis sections */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-12 border border-gray-700 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-semibold text-white mb-2">No Build Analysis Available</h2>
          <p className="text-gray-400 mb-6">
            Build analytics will appear here after you run a DFP build.
          </p>
          <p className="text-sm text-gray-500">
            Click "NEO - Build" in the Priorities page to generate a build and see detailed analytics including:
          </p>
          <ul className="text-sm text-gray-500 mt-4 space-y-1">
            <li>• Build Summary (events, aircraft, utilization)</li>
            <li>• Scheduling Bottlenecks</li>
            <li>• Time Distribution Analysis</li>
            <li>• Insights & Recommendations</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Tiles</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Flight Tiles" value={tilesStats.flightTiles} />
          <StatCard title="Total FTD Tiles" value={tilesStats.ftdTiles} />
          <StatCard title="Combined Flight/FTD" value={tilesStats.combinedTiles} />
          <StatCard title="Standby Events" value={tilesStats.standbyEvents} description="Reason not specified." />
        </div>
      </fieldset>

      {/* Build Summary */}
      <fieldset className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <legend className="px-2 text-xl font-semibold text-sky-400 mb-4">Build Summary</legend>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Build Date" value={analysis.buildDate} />
          <StatCard title="Total Events" value={analysis.totalEvents} />
          <StatCard title="Aircraft Available" value={analysis.availableAircraft} />
          <StatCard 
            title="Aircraft Utilization" 
            value={`${analysis.resourceUtilization.aircraftUtilization.toFixed(0)}%`} 
          />
        </div>
      </fieldset>

      {/* Scheduling Bottlenecks */}
      <LimitingFactorsSection courseAnalysis={analysis.courseAnalysis} />

      {/* Time Distribution */}
      <TimeDistributionChart timeDistribution={analysis.timeDistribution} />

      {/* Insights & Recommendations */}
      <InsightsSection insights={analysis.insights} />
    </div>
  );
};

export default BuildAnalyticsTab;