import React, { useMemo } from 'react';
import { ScheduleEvent, Trainee } from '../../types';
import InteractiveStatCard from '../shared/InteractiveStatCard';
import CourseDistributionTable from '../shared/CourseDistributionTable';
import PieChart from '../shared/PieChart';
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

interface BuildAnalysis {
  buildDate: string;
  totalEvents: number;
  availableAircraft: number;
  courseAnalysis: CourseAnalysis[];
  timeDistribution: any;
  resourceUtilization: any;
  insights: any[];
}

interface CourseMetricsTabProps {
  date: string;
  events: ScheduleEvent[];
  traineesData: Trainee[];
  activeCourses: string[];
  onNavigateAndSelectPerson: (name: string) => void;
  analysis: BuildAnalysis | null;
  resourceDisplayNames?: ResourceDisplayNames;
}

const CourseMetricsTab: React.FC<CourseMetricsTabProps> = ({
  date,
  events,
  traineesData,
  activeCourses,
  onNavigateAndSelectPerson,
  analysis,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES
}) => {
  // Build a lookup map: trainee fullName/name → course
  const traineeCourseLookup = useMemo(() => {
    const map = new Map<string, string>();
    traineesData.forEach(t => {
      if (t.fullName && t.course) map.set(t.fullName, t.course);
      if (t.name && t.course) map.set(t.name, t.course);
    });
    return map;
  }, [traineesData]);

  const getCourseFromStudent = (studentName: string): string | null => {
    if (!studentName) return null;
    // Primary: look up in traineesData by fullName or name
    const fromLookup = traineeCourseLookup.get(studentName);
    if (fromLookup) return fromLookup;
    // Fallback: old "Name – CourseName" format
    const match = studentName.match(/ \u2013 (.*)$/);
    return match ? match[1] : null;
  };

  const getEventPersonnel = (e: ScheduleEvent): string[] => {
    const personnel = new Set<string>();
    if (e.instructor) personnel.add(e.instructor);
    if (e.student) personnel.add(e.student);
    if (e.pilot) personnel.add(e.pilot);
    if (e.attendees) e.attendees.forEach(p => personnel.add(p));
    return Array.from(personnel);
  };

  // Events per Course calculation
  const courseStats = useMemo(() => {
    const selectedDateStr = date;
    const eventsPerCourse = new Map<string, number>();
    const personnelPerCourse = new Map<string, Set<string>>();
    const availableTraineesPerCourse = new Map<string, number>();

    activeCourses.forEach(course => {
      eventsPerCourse.set(course, 0);
      personnelPerCourse.set(course, new Set<string>());
      
      const traineesInCourse = traineesData.filter(t => t.course === course && !t.isPaused);
      let availableCount = 0;
      traineesInCourse.forEach(trainee => {
        const isUnavailable = trainee.unavailability?.some(period => 
          selectedDateStr >= period.startDate && selectedDateStr < period.endDate
        );
        if (!isUnavailable) {
          availableCount++;
        }
      });
      availableTraineesPerCourse.set(course, availableCount);
    });
    
    events.forEach(e => {
      if (e.flightNumber !== 'Ground School') {
        // Try student first, then pilot to find the trainee's course
        const course = getCourseFromStudent(e.student || '') ||
                       getCourseFromStudent(e.pilot || '');
        if (course && eventsPerCourse.has(course)) {
          eventsPerCourse.set(course, eventsPerCourse.get(course)! + 1);
          
          const eventPersonnel = getEventPersonnel(e);
          const coursePersonnelSet = personnelPerCourse.get(course)!;
          eventPersonnel.forEach(p => coursePersonnelSet.add(p));
        }
      }
    });

    const personnelPerCourseLists = new Map<string, string[]>();
    personnelPerCourse.forEach((personnelSet, course) => {
      personnelPerCourseLists.set(course, Array.from(personnelSet).sort());
    });

    return {
      eventsPerCourse,
      personnelPerCourseLists,
      availableTraineesPerCourse
    };
  }, [date, events, traineesData, activeCourses, traineeCourseLookup]);

  return (
    <div className="space-y-6">
      {/* Events per Course */}
      <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
        <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Events per Course (Excl. Ground School)</h2>
        </div>
        <div className="p-5">
          {courseStats.eventsPerCourse.size > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {Array.from(courseStats.eventsPerCourse.entries()).sort().map(([course, count]) => (
                <InteractiveStatCard
                  key={course}
                  title={course}
                  value={count}
                  description={`of ${courseStats.availableTraineesPerCourse.get(course) || 0} available`}
                  personnelList={courseStats.personnelPerCourseLists.get(course) || []}
                  onPersonClick={onNavigateAndSelectPerson}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No events found for active courses.</p>
          )}
        </div>
      </div>

      {/* Course Distribution Analysis - only show if analysis exists */}
      {analysis && analysis.courseAnalysis && (
        <>
          <CourseDistributionTable
            courseAnalysis={analysis.courseAnalysis}
            resourceDisplayNames={resourceDisplayNames}
          />

          {/* Pie Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChart 
              title="Flight Events per Course"
              data={analysis.courseAnalysis.map((course, index) => ({
                label: course.courseName,
                value: course.eventsByType.flight,
                color: `hsl(${(index * 360) / analysis.courseAnalysis.length}, 70%, 60%)`
              }))}
            />
            <PieChart 
              title="Total Events per Course"
              data={analysis.courseAnalysis.map((course, index) => ({
                label: course.courseName,
                value: course.eventCount,
                color: `hsl(${(index * 360) / analysis.courseAnalysis.length}, 70%, 60%)`
              }))}
            />
          </div>
        </>
      )}

      {/* Empty state if no build analysis */}
      {!analysis && (
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-12 text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-lg font-bold text-cyan-200">BI</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Build Analysis Required</h2>
          <p className="text-slate-400 mb-6">
            Course distribution analysis and pie charts will appear here after you run a DFP build.
          </p>
          <p className="text-sm text-slate-500">
            Click "NEO - Build" in the Priorities page to generate a build and see detailed course metrics.
          </p>
        </div>
      )}
    </div>
  );
};

export default CourseMetricsTab;
