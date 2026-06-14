import React, { useMemo } from 'react';
import { ScheduleEvent, Trainee, Instructor, SyllabusItemDetail } from '../../types';
import InteractiveStatCard from '../shared/InteractiveStatCard';
import CourseDistributionTable from '../shared/CourseDistributionTable';
import PieChart from '../shared/PieChart';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../../utils/resourceDisplayNames';
import { normaliseAirCombatTrainingAssignments, normaliseAirCombatTrainingReports, type AirCombatTrainingKind } from '../../utils/airCombatTraining';

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
  instructorsData?: Instructor[];
  syllabusDetails?: SyllabusItemDetail[];
  operationalModel?: string;
  operationalContext?: {
    locationCode?: string;
    unitCode?: string;
    unitCodes?: string[];
  };
}

const CourseMetricsTab: React.FC<CourseMetricsTabProps> = ({
  date,
  events,
  traineesData,
  activeCourses,
  onNavigateAndSelectPerson,
  analysis,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  instructorsData = [],
  syllabusDetails = [],
  operationalModel,
  operationalContext,
}) => {
  const isAirCombatModel = String(operationalModel || '').trim().toLowerCase() === 'air_combat';
  const activeUnitCodes = useMemo(() => {
    const codes = operationalContext?.unitCodes && operationalContext.unitCodes.length > 0
      ? operationalContext.unitCodes
      : String(operationalContext?.unitCode || '').split('+');
    return new Set(codes.map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  }, [operationalContext?.unitCode, operationalContext?.unitCodes]);

  const getTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
    (item.courses || []).find(Boolean) || item.code || ''
  );

  const matchesAirCombatAssignment = (
    item: SyllabusItemDetail,
    kind: AirCombatTrainingKind,
    code: string,
    unitCode?: string,
  ): boolean => {
    const itemKind: AirCombatTrainingKind = item.lmpType === 'Staff CAT' ? 'training_package' : 'course';
    if (itemKind !== kind) return false;
    const itemCode = String(getTrainingCodeFromItem(item) || '').trim().toUpperCase();
    const assignmentCode = String(code || '').trim().toUpperCase();
    if (itemCode !== assignmentCode && !String(item.code || '').trim().toUpperCase().startsWith(assignmentCode)) return false;
    const itemUnit = String(item.unit || '').trim().toUpperCase();
    const assignmentUnit = String(unitCode || '').trim().toUpperCase();
    return !assignmentUnit || !itemUnit || itemUnit === assignmentUnit;
  };

  const normaliseAirCombatStreamCode = (value: string): string => {
    const code = String(value || '').trim().toUpperCase();
    if (code.startsWith('AA') || code.startsWith('ATA')) return 'ATA';
    if (code.startsWith('ICO') || code.startsWith('IC')) return 'ICO';
    return code.replace(/\d+$/, '') || code;
  };

  const getAirCombatEventStreamCode = (event: ScheduleEvent): string => {
    const explicit = String((event as any).assignmentCode || event.taskingDisplayLabel || '').trim().toUpperCase();
    if (explicit) return normaliseAirCombatStreamCode(explicit);
    const code = String(event.eventCode || event.flightNumber || '').trim().toUpperCase();
    return normaliseAirCombatStreamCode(code);
  };

  const getEventPeople = (event: ScheduleEvent): string[] => {
    const names = [
      event.instructor,
      event.pilot,
      event.crew,
      event.student,
      ...((event.attendees || []) as string[]),
    ].map(name => String(name || '').trim()).filter(name => name && !/^TBA$/i.test(name));
    return Array.from(new Set(names));
  };

  const airCombatCourseStats = useMemo(() => {
    const streams = new Map<string, {
      key: string;
      kind: AirCombatTrainingKind;
      code: string;
      title: string;
      staff: Set<string>;
      availableStaff: Set<string>;
      eventCount: number;
      eventsByType: { flight: number; ftd: number; cpt: number; ground: number };
      completedReports: number;
      syllabusItems: number;
      personnel: Set<string>;
    }>();
    const ensureStream = (kind: AirCombatTrainingKind, code: string, title?: string) => {
      const key = `${kind}:${String(code || '').trim().toUpperCase()}`;
      if (!streams.has(key)) {
        streams.set(key, {
          key,
          kind,
          code,
          title: title || code,
          staff: new Set(),
          availableStaff: new Set(),
          eventCount: 0,
          eventsByType: { flight: 0, ftd: 0, cpt: 0, ground: 0 },
          completedReports: 0,
          syllabusItems: 0,
          personnel: new Set(),
        });
      }
      return streams.get(key)!;
    };

    instructorsData.forEach(staff => {
      const staffUnit = String(staff.unit || '').trim().toUpperCase();
      if (activeUnitCodes.size > 0 && staffUnit && !activeUnitCodes.has(staffUnit)) return;
      const isAvailable = !(staff.unavailability || []).some(period => date >= period.startDate && date < period.endDate);
      const assignments = normaliseAirCombatTrainingAssignments(staff.preferences);
      [...assignments.courses, ...assignments.trainingPackages].forEach(assignment => {
        const assignmentUnit = String(assignment.unitCode || staffUnit).trim().toUpperCase();
        if (activeUnitCodes.size > 0 && assignmentUnit && !activeUnitCodes.has(assignmentUnit)) return;
        const stream = ensureStream(assignment.kind, assignment.code, assignment.title);
        stream.staff.add(staff.name);
        if (isAvailable) stream.availableStaff.add(staff.name);
      });
      normaliseAirCombatTrainingReports(staff.preferences).forEach(report => {
        if (report.status && report.status !== 'Complete') return;
        if (!report.trainingKind || !report.trainingCode) return;
        const stream = ensureStream(report.trainingKind, report.trainingCode, report.trainingTitle || report.trainingCode);
        stream.completedReports += 1;
      });
    });

    syllabusDetails.forEach(item => {
      streams.forEach(stream => {
        if (matchesAirCombatAssignment(item, stream.kind, stream.code)) stream.syllabusItems += 1;
      });
    });

    events.forEach(event => {
      const eventStreamCode = getAirCombatEventStreamCode(event);
      streams.forEach(stream => {
        if (normaliseAirCombatStreamCode(stream.code) !== eventStreamCode) return;
        stream.eventCount += 1;
        if (event.type === 'flight') stream.eventsByType.flight += 1;
        else if (event.type === 'ftd') stream.eventsByType.ftd += 1;
        else if (event.type === 'cpt') stream.eventsByType.cpt += 1;
        else stream.eventsByType.ground += 1;
        getEventPeople(event).forEach(person => stream.personnel.add(person));
      });
    });

    return Array.from(streams.values()).sort((left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.code.localeCompare(right.code)
    );
  }, [activeUnitCodes, date, events, instructorsData, syllabusDetails]);

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

  if (isAirCombatModel) {
    const totalScheduled = airCombatCourseStats.reduce((sum, stream) => sum + stream.eventCount, 0);
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">Air Combat Course & Package Metrics</h2>
            <p className="mt-1 text-sm text-slate-400">
              Each card is a course or training package assigned to at least one staff member in this unit. The large number is how many events from that stream are on the selected DFP.
            </p>
          </div>
          <div className="p-5">
            {airCombatCourseStats.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {airCombatCourseStats.map(stream => (
                  <InteractiveStatCard
                    key={stream.key}
                    title={`${stream.kind === 'course' ? 'Course' : 'Package'} ${stream.code}`}
                    value={stream.eventCount}
                    description={`${stream.staff.size} assigned staff, ${stream.availableStaff.size} available today, ${stream.syllabusItems} LMP events in stream`}
                    personnelList={Array.from(stream.staff).sort()}
                    onPersonClick={onNavigateAndSelectPerson}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-400">No Air Combat courses or training packages have staff assigned in this unit.</p>
            )}
          </div>
        </div>

        {airCombatCourseStats.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Course And Package Schedule Summary</h2>
              <p className="mt-1 text-sm text-slate-400">
                This table shows what is loaded for the selected Air Combat unit and what was actually scheduled on this DFP.
              </p>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Assigned Staff</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">LMP Events</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">{resourceDisplayNames.aircraft} Flight</th>
                    <th className="px-4 py-3">{resourceDisplayNames.ftd}</th>
                    <th className="px-4 py-3">{resourceDisplayNames.cpt}</th>
                    <th className="px-4 py-3">Ground</th>
                    <th className="px-4 py-3">Completed Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {airCombatCourseStats.map(stream => (
                    <tr key={stream.key} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-slate-300">{stream.kind === 'course' ? 'Course' : 'Package'}</td>
                      <td className="px-4 py-3 font-semibold text-white">{stream.code}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.staff.size}</td>
                      <td className="px-4 py-3 text-emerald-300">{stream.availableStaff.size}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.syllabusItems}</td>
                      <td className="px-4 py-3 font-semibold text-cyan-200">{stream.eventCount}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.eventsByType.flight}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.eventsByType.ftd}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.eventsByType.cpt}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.eventsByType.ground}</td>
                      <td className="px-4 py-3 text-slate-200">{stream.completedReports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {airCombatCourseStats.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Scheduled Events By Stream</h2>
            </div>
            <div className="space-y-3 p-5">
              {airCombatCourseStats.map(stream => {
                const percent = totalScheduled > 0 ? Math.round((stream.eventCount / totalScheduled) * 100) : 0;
                return (
                  <div key={stream.key} className="rounded-lg border border-slate-700 bg-slate-950/45 p-4">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <span className="font-semibold text-white">{stream.kind === 'course' ? 'Course' : 'Package'} {stream.code}</span>
                      <span className="text-sm text-slate-300">{stream.eventCount} scheduled ({percent}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

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
