import React, { useMemo } from 'react';
import { ScheduleEvent, Trainee, Instructor, SyllabusItemDetail } from '../../types';
import InteractiveStatCard from '../shared/InteractiveStatCard';
import CourseDistributionTable from '../shared/CourseDistributionTable';
import PieChart from '../shared/PieChart';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../../utils/resourceDisplayNames';
import { normaliseAirCombatTrainingAssignments, normaliseAirCombatTrainingReports, type AirCombatTrainingKind } from '../../utils/airCombatTraining';
import { resolveCourseLegendColor } from '../../utils/tileColorResolver';
import {
  getOperationalModelLabel,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
} from '../../utils/platformConfigService';

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
  courseColors?: { [key: string]: string };
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
  courseColors = {},
  onNavigateAndSelectPerson,
  analysis,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  instructorsData = [],
  syllabusDetails = [],
  operationalModel,
  operationalContext,
}) => {
  const activeModel = normaliseOperationalModel(operationalModel);
  const isCrewOperationalModel = activeModel === 'air_combat' || isFixedCrewLikeOperationalModel(activeModel);
  const activeModelLabel = getOperationalModelLabel(activeModel);
  const percentLabel = (numerator: number, denominator: number): string => {
    if (denominator <= 0) return 'N/A';
    return `${Math.round((numerator / denominator) * 100)}%`;
  };
  const activeUnitCodes = useMemo(() => {
    const codes = operationalContext?.unitCodes && operationalContext.unitCodes.length > 0
      ? operationalContext.unitCodes
      : String(operationalContext?.unitCode || '').split('+');
    return new Set(codes.map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  }, [operationalContext?.unitCode, operationalContext?.unitCodes]);
  const activeLocationCode = String(operationalContext?.locationCode || '').trim().toUpperCase();

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

  const itemMatchesOperationalContext = (item: SyllabusItemDetail): boolean => {
    const itemUnit = String(item.unit || '').trim().toUpperCase();
    const itemLocation = String(item.location || '').trim().toUpperCase();
    const unitMatches = activeUnitCodes.size === 0 || !itemUnit || activeUnitCodes.has(itemUnit);
    const locationMatches = !activeLocationCode || !itemLocation || itemLocation === activeLocationCode;
    return unitMatches && locationMatches;
  };

  const getStreamTitleFromItem = (item: SyllabusItemDetail, code: string): string => (
    item.module && item.module !== code
      ? item.module
      : item.phase && item.phase !== code
        ? item.phase
        : item.eventDescription || code
  );

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

  const isStandbyEvent = (event: ScheduleEvent): boolean => {
    const resourceId = String(event.resourceId || '').trim().toUpperCase();
    return resourceId.startsWith('STBY') || resourceId.startsWith('FTD-STBY') || resourceId.startsWith('BNF-STBY');
  };

  const airCombatCourseStats = useMemo(() => {
    const streams = new Map<string, {
      key: string;
      kind: AirCombatTrainingKind;
      code: string;
      title: string;
      unitCode: string;
      locationCode: string;
      staff: Set<string>;
      availableStaff: Set<string>;
      eventCount: number;
      eventsByType: { flight: number; ftd: number; cpt: number; ground: number };
      completedReports: number;
      syllabusItems: number;
      syllabusItemKeys: Set<string>;
      personnel: Set<string>;
    }>();
    const ensureStream = (kind: AirCombatTrainingKind, code: string, title?: string, unitCode?: string, locationCode?: string) => {
      const normalisedCode = String(code || '').trim().toUpperCase();
      const normalisedUnit = String(unitCode || '').trim().toUpperCase();
      const normalisedLocation = String(locationCode || '').trim().toUpperCase();
      const key = `${kind}:${normalisedLocation || 'GLOBAL'}:${normalisedUnit || 'GLOBAL'}:${normalisedCode}`;
      if (!streams.has(key)) {
        streams.set(key, {
          key,
          kind,
          code,
          title: title || code,
          unitCode: normalisedUnit,
          locationCode: normalisedLocation,
          staff: new Set(),
          availableStaff: new Set(),
          eventCount: 0,
          eventsByType: { flight: 0, ftd: 0, cpt: 0, ground: 0 },
          completedReports: 0,
          syllabusItems: 0,
          syllabusItemKeys: new Set(),
          personnel: new Set(),
        });
      }
      return streams.get(key)!;
    };

    const addSyllabusItemToStream = (stream: ReturnType<typeof ensureStream>, item: SyllabusItemDetail) => {
      const itemKey = String(item.id || item.code || `${stream.key}:${stream.syllabusItems}`).trim();
      if (!itemKey || stream.syllabusItemKeys.has(itemKey)) return;
      stream.syllabusItemKeys.add(itemKey);
      stream.syllabusItems += 1;
    };

    syllabusDetails
      .filter(item => item.isActive !== false)
      .filter(item => item.lmpType === 'Staff CAT' || item.lmpType === 'Master LMP' || !item.lmpType)
      .filter(itemMatchesOperationalContext)
      .forEach(item => {
        const kind = item.lmpType === 'Staff CAT' ? 'training_package' : 'course';
        const code = String(getTrainingCodeFromItem(item) || '').trim();
        if (!code) return;
        const itemUnit = String(item.unit || '').trim().toUpperCase();
        const itemLocation = String(item.location || '').trim().toUpperCase();
        const stream = ensureStream(kind, code, getStreamTitleFromItem(item, code), itemUnit, itemLocation);
        addSyllabusItemToStream(stream, item);
      });

    instructorsData.forEach(staff => {
      const staffUnit = String(staff.unit || '').trim().toUpperCase();
      if (activeUnitCodes.size > 0 && staffUnit && !activeUnitCodes.has(staffUnit)) return;
      const isAvailable = !(staff.unavailability || []).some(period => date >= period.startDate && date < period.endDate);
      const assignments = normaliseAirCombatTrainingAssignments(staff.preferences);
      [...assignments.courses, ...assignments.trainingPackages].forEach(assignment => {
        const assignmentUnit = String(assignment.unitCode || staffUnit).trim().toUpperCase();
        if (activeUnitCodes.size > 0 && assignmentUnit && !activeUnitCodes.has(assignmentUnit)) return;
        const assignmentLocation = String(assignment.locationCode || activeLocationCode).trim().toUpperCase();
        const stream = ensureStream(assignment.kind, assignment.code, assignment.title, assignmentUnit, assignmentLocation);
        stream.staff.add(staff.name);
        if (isAvailable) stream.availableStaff.add(staff.name);
      });
      normaliseAirCombatTrainingReports(staff.preferences).forEach(report => {
        if (report.status && report.status !== 'Complete') return;
        if (!report.trainingKind || !report.trainingCode) return;
        const stream = ensureStream(report.trainingKind, report.trainingCode, report.trainingTitle || report.trainingCode, report.unitCode, report.locationCode);
        stream.completedReports += 1;
      });
    });

    syllabusDetails.filter(item => item.isActive !== false).filter(itemMatchesOperationalContext).forEach(item => {
      streams.forEach(stream => {
        if (stream.unitCode && String(item.unit || '').trim().toUpperCase() && String(item.unit || '').trim().toUpperCase() !== stream.unitCode) return;
        if (matchesAirCombatAssignment(item, stream.kind, stream.code)) addSyllabusItemToStream(stream, item);
      });
    });

    events.filter(event => !isStandbyEvent(event)).forEach(event => {
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

    return Array.from(streams.values()).map(stream => ({
      ...stream,
      syllabusItems: Math.max(stream.syllabusItems, 0),
    })).sort((left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.unitCode.localeCompare(right.unitCode) ||
      left.code.localeCompare(right.code)
    );
  }, [activeLocationCode, activeUnitCodes, date, events, instructorsData, syllabusDetails]);

  const stripCourseSuffix = (value: string): string => {
    const text = String(value || '').trim();
    const match = text.match(/^(.*?)\s+[–-]\s+([A-Z0-9][A-Z0-9 +/]*?)$/);
    return match ? match[1].trim() : text;
  };

  const fallbackChartColor = (index: number, total: number): string => (
    `hsl(${(index * 360) / Math.max(total, 1)}, 70%, 60%)`
  );

  const resolveCourseChartColor = (courseName: string, index: number, total: number): string => {
    return resolveCourseLegendColor(courseColors[courseName]) || fallbackChartColor(index, total);
  };

  // Build a lookup map: trainee fullName/name → course
  const traineeCourseLookup = useMemo(() => {
    const map = new Map<string, string>();
    traineesData.forEach(t => {
      if (t.fullName && t.course) {
        map.set(t.fullName, t.course);
        map.set(stripCourseSuffix(t.fullName), t.course);
      }
      if (t.name && t.course) {
        map.set(t.name, t.course);
        map.set(stripCourseSuffix(t.name), t.course);
      }
    });
    return map;
  }, [traineesData]);

  const getCourseFromStudent = (studentName: string): string | null => {
    if (!studentName) return null;
    // Primary: look up in traineesData by fullName or name
    const fromLookup = traineeCourseLookup.get(studentName);
    if (fromLookup) return fromLookup;
    const normalisedName = stripCourseSuffix(studentName);
    const fromNormalisedLookup = traineeCourseLookup.get(normalisedName);
    if (fromNormalisedLookup) return fromNormalisedLookup;
    // Fallback: old "Name – CourseName" format
    const match = studentName.match(/\s+[–-]\s+(.*)$/);
    return match ? match[1] : null;
  };

  const getEventPersonnel = (e: ScheduleEvent): string[] => {
    const personnel = new Set<string>();
    const addPerson = (name?: string) => {
      const normalised = stripCourseSuffix(String(name || ''));
      if (normalised && !/^TBA$/i.test(normalised)) personnel.add(normalised);
    };
    addPerson(e.instructor);
    addPerson(e.student);
    addPerson(e.pilot);
    if (e.attendees) e.attendees.forEach(addPerson);
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
    
    events.filter(event => !isStandbyEvent(event)).forEach(e => {
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

  if (isCrewOperationalModel) {
    const totalScheduled = airCombatCourseStats.reduce((sum, stream) => sum + stream.eventCount, 0);
    const totalAssignedStaffSlots = airCombatCourseStats.reduce((sum, stream) => sum + stream.staff.size, 0);
    const totalAvailableStaffSlots = airCombatCourseStats.reduce((sum, stream) => sum + stream.availableStaff.size, 0);
    const scheduledStreams = airCombatCourseStats.filter(stream => stream.eventCount > 0).length;
    const unavailableStreams = airCombatCourseStats.filter(stream => stream.staff.size > 0 && stream.availableStaff.size === 0).length;
    const uncoveredStreams = airCombatCourseStats.filter(stream => stream.availableStaff.size > 0 && stream.eventCount === 0).length;
    const assessmentRecords = airCombatCourseStats.reduce((sum, stream) => sum + stream.completedReports, 0);
    const streamHealth = (stream: typeof airCombatCourseStats[number]): { label: string; className: string; detail: string } => {
      if (stream.staff.size === 0) {
        return { label: 'Not loaded', className: 'text-slate-300', detail: 'No assigned staff' };
      }
      if (stream.availableStaff.size === 0) {
        return { label: 'Unavailable', className: 'text-red-300', detail: 'Assigned staff unavailable today' };
      }
      if (stream.eventCount === 0) {
        return { label: 'Unscheduled', className: 'text-amber-300', detail: 'Available staff but no DFP event' };
      }
      if (stream.personnel.size === 0) {
        return { label: 'No crew named', className: 'text-amber-300', detail: 'Event exists without named staff' };
      }
      return { label: 'Active', className: 'text-emerald-300', detail: 'Assigned and represented on DFP' };
    };

    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{activeModelLabel} Course & Package Metrics</h2>
            <p className="mt-1 text-sm text-slate-400">
              Course and package signals are scoped to staff assignments for this unit or combined-unit context, then compared against the selected DFP to show coverage, schedule representation, modality mix and assessment evidence.
            </p>
          </div>
          <div className="p-5">
            {airCombatCourseStats.length > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assigned streams</div>
                    <div className="mt-2 text-2xl font-bold text-white">{airCombatCourseStats.length}</div>
                    <div className="mt-1 text-xs text-slate-400">Courses and packages loaded</div>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Staff availability</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-200">{percentLabel(totalAvailableStaffSlots, totalAssignedStaffSlots)}</div>
                    <div className="mt-1 text-xs text-slate-400">{totalAvailableStaffSlots} of {totalAssignedStaffSlots} assigned slots available</div>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scheduled coverage</div>
                    <div className="mt-2 text-2xl font-bold text-cyan-200">{percentLabel(scheduledStreams, airCombatCourseStats.length)}</div>
                    <div className="mt-1 text-xs text-slate-400">{scheduledStreams} streams represented on DFP</div>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Coverage risk</div>
                    <div className="mt-2 text-2xl font-bold text-amber-200">{unavailableStreams + uncoveredStreams}</div>
                    <div className="mt-1 text-xs text-slate-400">{unavailableStreams} unavailable, {uncoveredStreams} unscheduled</div>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assessment evidence</div>
                    <div className="mt-2 text-2xl font-bold text-violet-200">{assessmentRecords}</div>
                    <div className="mt-1 text-xs text-slate-400">Completed training reports found</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {airCombatCourseStats.map(stream => {
                    const health = streamHealth(stream);
                    const scheduledAvailable = Array.from(stream.personnel).filter(person => stream.availableStaff.has(person)).length;
                    return (
                      <InteractiveStatCard
                        key={stream.key}
                        title={`${stream.kind === 'course' ? 'Course' : 'Package'} ${stream.code}`}
                        value={stream.eventCount}
                        description={`${health.label}: ${stream.availableStaff.size}/${stream.staff.size} available, ${scheduledAvailable} available staff scheduled, ${stream.eventsByType.flight} flight, ${stream.eventsByType.ftd + stream.eventsByType.cpt} sim/CPT`}
                        personnelList={Array.from(stream.staff).sort()}
                        onPersonClick={onNavigateAndSelectPerson}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-slate-400">No courses, packages or operational training streams have staff assigned in this unit.</p>
            )}
          </div>
        </div>

        {airCombatCourseStats.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Course And Package Schedule Summary</h2>
              <p className="mt-1 text-sm text-slate-400">
                This table shows what is loaded for the selected unit context and what was actually scheduled on this DFP.
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
                    <th className="px-4 py-3">Avail %</th>
                    <th className="px-4 py-3">Scheduled People</th>
                    <th className="px-4 py-3">LMP Events</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">{resourceDisplayNames.aircraft} Flight</th>
                    <th className="px-4 py-3">Sim / CPT</th>
                    <th className="px-4 py-3">Ground</th>
                    <th className="px-4 py-3">Assessments</th>
                    <th className="px-4 py-3">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {airCombatCourseStats.map(stream => {
                    const health = streamHealth(stream);
                    const scheduledPeople = stream.personnel.size;
                    return (
                      <tr key={stream.key} className="border-t border-slate-800">
                        <td className="px-4 py-3 text-slate-300">{stream.kind === 'course' ? 'Course' : 'Package'}</td>
                        <td className="px-4 py-3 font-semibold text-white">{stream.code}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.staff.size}</td>
                        <td className="px-4 py-3 text-emerald-300">{stream.availableStaff.size}</td>
                        <td className="px-4 py-3 text-slate-200">{percentLabel(stream.availableStaff.size, stream.staff.size)}</td>
                        <td className="px-4 py-3 text-slate-200">{scheduledPeople}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.syllabusItems}</td>
                        <td className="px-4 py-3 font-semibold text-cyan-200">{stream.eventCount}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.eventsByType.flight}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.eventsByType.ftd + stream.eventsByType.cpt}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.eventsByType.ground}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.completedReports}</td>
                        <td className={`px-4 py-3 font-semibold ${health.className}`} title={health.detail}>{health.label}</td>
                      </tr>
                    );
                  })}
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
                color: resolveCourseChartColor(course.courseName, index, analysis.courseAnalysis.length)
              }))}
            />
            <PieChart 
              title="Total Events per Course"
              data={analysis.courseAnalysis.map((course, index) => ({
                label: course.courseName,
                value: course.eventCount,
                color: resolveCourseChartColor(course.courseName, index, analysis.courseAnalysis.length)
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
