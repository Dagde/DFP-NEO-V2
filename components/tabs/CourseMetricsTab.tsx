import React, { useMemo } from 'react';
import { ScheduleEvent, Trainee } from '../../types';
import InteractiveStatCard from '../shared/InteractiveStatCard';
import CourseDistributionTable from '../shared/CourseDistributionTable';
import PieChart from '../shared/PieChart';

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
}

const CourseMetricsTab: React.FC<CourseMetricsTabProps> = ({
  date,
  events,
  traineesData,
  activeCourses,
  onNavigateAndSelectPerson,
  analysis
}) => {
  const getCourseFromStudent = (studentName: string): string | null => {
    if (!studentName) return null;
    const match = studentName.match(/ – (.*)$/);
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
        const course = getCourseFromStudent(e.student || e.pilot || '');
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
  }, [date, events, traineesData, activeCourses]);

  return (
    <div className="space-y-6">
      {/* Events per Course */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-sky-400 mb-4">Events per Course (Excl. Ground School)</h2>
        {courseStats.eventsPerCourse.size > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <p className="text-gray-500 text-center py-8">No events found for active courses.</p>
        )}
      </div>

      {/* Course Distribution Analysis - only show if analysis exists */}
      {analysis && analysis.courseAnalysis && (
        <>
          <CourseDistributionTable courseAnalysis={analysis.courseAnalysis} />

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
        <div className="bg-gray-800 rounded-lg shadow-lg p-12 border border-gray-700 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Build Analysis Required</h2>
          <p className="text-gray-400 mb-6">
            Course distribution analysis and pie charts will appear here after you run a DFP build.
          </p>
          <p className="text-sm text-gray-500">
            Click "NEO - Build" in the Priorities page to generate a build and see detailed course metrics.
          </p>
        </div>
      )}
    </div>
  );
};

export default CourseMetricsTab;