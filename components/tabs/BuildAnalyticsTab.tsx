import React, { useMemo } from 'react';
import { ScheduleEvent } from '../../types';
import StatCard from '../shared/StatCard';
import LimitingFactorsSection from '../shared/LimitingFactorsSection';
import TimeDistributionChart from '../shared/TimeDistributionChart';
import InsightsSection from '../shared/InsightsSection';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../../utils/resourceDisplayNames';

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
  resourceDisplayNames?: ResourceDisplayNames;
  instructorLabel?: string;
}

const BuildAnalyticsTab: React.FC<BuildAnalyticsTabProps> = ({
  events,
  analysis,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  instructorLabel = 'Instructor'
}) => {
  const sectionClass = 'rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]';
  const legendClass = 'px-2 text-lg font-semibold text-white';
  const aircraftLabel = resourceDisplayNames.aircraft;
  const ftdLabel = resourceDisplayNames.ftd;
  const aircraftNoun = aircraftLabel.toLowerCase();

  // Format build date to DD-Mmm-YY
  const formattedBuildDate = useMemo(() => {
    if (!analysis?.buildDate) return '';
    const [year, month, day] = analysis.buildDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    }).replace(/ /g, '-'); // Replace spaces with hyphens for DD-Mmm-YY format
  }, [analysis?.buildDate]);

  // Tiles statistics from events
  const tilesStats = useMemo(() => {
    const flightTiles = events.filter(e => e.type === 'flight').length;
    const ftdTiles = events.filter(e => e.type === 'ftd').length;
    const standbyEvents = events.filter(e => e.resourceId?.startsWith('STBY')).length;

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
        <fieldset className={sectionClass}>
          <legend className={legendClass}>Tiles</legend>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Flight Tiles" value={tilesStats.flightTiles} />
            <StatCard title={`Total ${ftdLabel} Tiles`} value={tilesStats.ftdTiles} />
            <StatCard title={`Combined Flight/${ftdLabel}`} value={tilesStats.combinedTiles} />
            <StatCard title="Standby Events" value={tilesStats.standbyEvents} description="Reason not specified." />
          </div>
        </fieldset>

        {/* Empty state for build analysis sections */}
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-12 text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-lg font-bold text-cyan-200">BI</div>
          <h2 className="text-2xl font-semibold text-white mb-2">No Build Analysis Available</h2>
          <p className="text-slate-400 mb-6">
            Build analytics will appear here after you run a DFP build.
          </p>
          <p className="text-sm text-slate-500">
            Click "NEO - Build" in the Priorities page to generate a build and see detailed analytics including:
          </p>
          <ul className="text-sm text-slate-500 mt-4 space-y-1">
            <li>Build Summary (events, {aircraftNoun}, utilization)</li>
            <li>Scheduling Constraints</li>
            <li>Time Distribution Analysis</li>
            <li>Insights & Recommendations</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <fieldset className={sectionClass}>
        <legend className={legendClass}>Tiles</legend>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Flight Tiles" value={tilesStats.flightTiles} />
          <StatCard title={`Total ${ftdLabel} Tiles`} value={tilesStats.ftdTiles} />
          <StatCard title={`Combined Flight/${ftdLabel}`} value={tilesStats.combinedTiles} />
          <StatCard title="Standby Events" value={tilesStats.standbyEvents} description="Reason not specified." />
        </div>
      </fieldset>

      {/* Build Summary */}
      <fieldset className={sectionClass}>
        <legend className={legendClass}>Build Summary</legend>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard title="Build Date" value={formattedBuildDate} />
          <StatCard title="Total Events" value={analysis.totalEvents} />
          <StatCard title={`${aircraftLabel} Available`} value={analysis.availableAircraft} />
          <StatCard
            title={`${aircraftLabel} Utilization`}
            value={`${analysis.resourceUtilization.aircraftUtilization.toFixed(0)}%`}
          />
        </div>
      </fieldset>

      {/* Scheduling Constraints */}
      <LimitingFactorsSection courseAnalysis={analysis.courseAnalysis} resourceDisplayNames={resourceDisplayNames} instructorLabel={instructorLabel} />

      {/* Time Distribution */}
      <TimeDistributionChart timeDistribution={analysis.timeDistribution} />

      {/* Insights & Recommendations */}
      <InsightsSection insights={analysis.insights} />
    </div>
  );
};

export default BuildAnalyticsTab;
