import {
  AirCombatTrainingReport,
  AirCombatTrainingAssignment,
  AirCombatTrainingAssignments,
  Instructor,
  PersonnelPreferences,
  SyllabusItemDetail,
} from '../types';

export type AirCombatTrainingKind = AirCombatTrainingAssignment['kind'];

export interface AirCombatTrainingStreamWeight {
  key: string;
  kind: AirCombatTrainingKind;
  code: string;
  title?: string;
  locationCode?: string;
  unitCode?: string;
  weight: number;
}

export interface AirCombatSchedulingWeights {
  courses: number;
  trainingPackages: number;
  trainingStreams?: AirCombatTrainingStreamWeight[];
}

export const DEFAULT_AIR_COMBAT_SCHEDULING_WEIGHTS: AirCombatSchedulingWeights = {
  courses: 60,
  trainingPackages: 40,
};

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

export const AIR_COMBAT_ICO_PACKAGE_CODE = 'ICO';
export const AIR_COMBAT_ICO_DEFAULT_FLIGHT_OR_SIM_HOURS = 1.2;
export const AIR_COMBAT_ICO_PREFLIGHT_HOURS = 1.5;
export const AIR_COMBAT_ICO_POSTFLIGHT_HOURS = 1.0;

export const getAuthoritativeSyllabusDuration = (item?: Partial<SyllabusItemDetail> | null): number => {
  const flightOrSimHours = Number(item?.flightOrSimHours);
  if (Number.isFinite(flightOrSimHours) && flightOrSimHours > 0) return flightOrSimHours;
  const totalEventHours = Number(item?.totalEventHours);
  if (Number.isFinite(totalEventHours) && totalEventHours > 0) return totalEventHours;
  const duration = Number(item?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

export const isIntegratedCombatOperationsTrainingPackageItem = (item?: Partial<SyllabusItemDetail> | null): boolean => {
  if (!item || item.lmpType !== 'Staff CAT') return false;
  const courses = Array.isArray(item.courses) ? item.courses : [];
  return courses.some(course => normaliseCode(course) === AIR_COMBAT_ICO_PACKAGE_CODE);
};

export const normaliseIntegratedCombatOperationsTiming = <T extends Partial<SyllabusItemDetail>>(item: T): T => {
  if (!isIntegratedCombatOperationsTrainingPackageItem(item)) return item;
  const flightOrSimHours = Number.isFinite(Number(item.flightOrSimHours)) && Number(item.flightOrSimHours) > 0
    ? Number(item.flightOrSimHours)
    : AIR_COMBAT_ICO_DEFAULT_FLIGHT_OR_SIM_HOURS;
  if (
    item.flightOrSimHours === flightOrSimHours &&
    item.duration === flightOrSimHours &&
    item.preFlightTime === AIR_COMBAT_ICO_PREFLIGHT_HOURS &&
    item.postFlightTime === AIR_COMBAT_ICO_POSTFLIGHT_HOURS
  ) {
    return item;
  }
  return {
    ...item,
    flightOrSimHours,
    duration: flightOrSimHours,
    preFlightTime: AIR_COMBAT_ICO_PREFLIGHT_HOURS,
    postFlightTime: AIR_COMBAT_ICO_POSTFLIGHT_HOURS,
  };
};

export const normaliseIntegratedCombatOperationsTimings = <T extends Partial<SyllabusItemDetail>>(items: T[]): T[] => (
  items.map(normaliseIntegratedCombatOperationsTiming)
);

export const normaliseSyllabusRuntimeTiming = <T extends Partial<SyllabusItemDetail>>(item: T): T => {
  const itemWithDuration = {
    ...item,
    duration: getAuthoritativeSyllabusDuration(item),
  };
  return normaliseIntegratedCombatOperationsTiming(itemWithDuration);
};

export const normaliseSyllabusRuntimeTimings = <T extends Partial<SyllabusItemDetail>>(items: T[]): T[] => (
  items.map(normaliseSyllabusRuntimeTiming)
);

export const getAirCombatTrainingKindForLmpType = (lmpType?: string | null): AirCombatTrainingKind => (
  lmpType === 'Staff CAT' ? 'training_package' : 'course'
);

export const getAirCombatTrainingKey = (
  kind: AirCombatTrainingKind,
  code: string,
  locationCode?: string,
  unitCode?: string,
): string => [
  'air_combat',
  normaliseCode(locationCode) || 'GLOBAL',
  normaliseCode(unitCode) || 'GLOBAL',
  kind,
  normaliseCode(code),
].join(':');

export const getAirCombatTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
  (item.courses || []).find(Boolean) || item.code || ''
);

export const getAirCombatTrainingTitleFromItem = (item: SyllabusItemDetail): string => {
  const code = getAirCombatTrainingCodeFromItem(item);
  return item.module && item.module !== code ? item.module : (item.eventDescription || code);
};

export const getAirCombatAssignmentFromItem = (
  item: SyllabusItemDetail,
  locationCode: string,
  unitCode: string,
  assignedBy?: string,
): AirCombatTrainingAssignment => {
  const kind = getAirCombatTrainingKindForLmpType(item.lmpType);
  const code = getAirCombatTrainingCodeFromItem(item);
  const assignmentLocation = normaliseCode(locationCode || item.location);
  const assignmentUnit = normaliseCode(unitCode || item.unit);
  const trainingKey = getAirCombatTrainingKey(kind, code, assignmentLocation, assignmentUnit);
  return {
    assignmentId: trainingKey,
    kind,
    trainingKey,
    lmpType: kind === 'training_package' ? 'Staff CAT' : 'Master LMP',
    code,
    title: getAirCombatTrainingTitleFromItem(item),
    locationCode: assignmentLocation,
    unitCode: assignmentUnit,
    operationalModel: 'air_combat',
    assignedAt: new Date().toISOString(),
    assignedBy,
  };
};

export const normaliseAirCombatTrainingAssignments = (preferences?: PersonnelPreferences | null): AirCombatTrainingAssignments => {
  const raw = preferences?.airCombat?.trainingAssignments || {};
  const normaliseList = (items: any[] | undefined, kind: AirCombatTrainingKind): AirCombatTrainingAssignment[] => (
    Array.isArray(items) ? items : []
  )
    .map((item: any) => {
      const code = String(item.code || '').trim();
      if (!code) return null;
      const locationCode = normaliseCode(item.locationCode);
      const unitCode = normaliseCode(item.unitCode);
      const trainingKey = String(item.trainingKey || getAirCombatTrainingKey(kind, code, locationCode, unitCode));
      return {
        assignmentId: String(item.assignmentId || trainingKey),
        kind,
        trainingKey,
        lmpType: kind === 'training_package' ? 'Staff CAT' : 'Master LMP',
        code,
        title: String(item.title || code),
        locationCode,
        unitCode,
        operationalModel: 'air_combat' as const,
        assignedAt: String(item.assignedAt || ''),
        assignedBy: item.assignedBy ? String(item.assignedBy) : undefined,
      };
    })
    .filter(Boolean) as AirCombatTrainingAssignment[];

  return {
    courses: normaliseList(raw.courses, 'course'),
    trainingPackages: normaliseList(raw.trainingPackages, 'training_package'),
  };
};

export const appendTrainingReportFollowUpDiag = (stage: string, payload: Record<string, any> = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const existing = JSON.parse(window.localStorage.getItem('dfp_training_report_followup_diag') || '[]');
    const next = [
      ...(Array.isArray(existing) ? existing : []),
      {
        ts: new Date().toISOString(),
        stage,
        ...payload,
      },
    ].slice(-250);
    window.localStorage.setItem('dfp_training_report_followup_diag', JSON.stringify(next));
  } catch {
    // Diagnostics must never affect training report behaviour.
  }
};

export const normaliseAirCombatTrainingReports = (preferences?: PersonnelPreferences | null): AirCombatTrainingReport[] => {
  const raw = preferences?.airCombat?.trainingReports;
  if (!Array.isArray(raw)) return [];
  const normalisePositiveNumber = (value: unknown): number | undefined => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
  };
  const normaliseDpcoFollowUp = (value: any): AirCombatTrainingReport['dpcoFollowUp'] => {
    if (!value || typeof value !== 'object') return undefined;
    const action = ['extra-event', 'extra-hours-next-event', 'continue-no-additions'].includes(value.action)
      ? value.action
      : '';
    if (!action) return undefined;
    return {
      action,
      extraEventHours: normalisePositiveNumber(value.extraEventHours),
      extraHours: normalisePositiveNumber(value.extraHours),
    };
  };
  const normaliseDncoFollowUp = (value: any): AirCombatTrainingReport['dncoFollowUp'] => {
    if (!value || typeof value !== 'object') return undefined;
    return {
      requestExtraFlight: value.requestExtraFlight === true,
    };
  };
  const normalisedReports = raw
    .map((report: any) => ({
      id: String(report.id || ''),
      reportName: String(report.reportName || 'Training Report'),
      staffIdNumber: Number(report.staffIdNumber || 0),
      staffName: String(report.staffName || ''),
      locationCode: report.locationCode ? String(report.locationCode) : undefined,
      unitCode: report.unitCode ? String(report.unitCode) : undefined,
      trainingKey: report.trainingKey ? String(report.trainingKey) : undefined,
      trainingKind: report.trainingKind === 'training_package' ? 'training_package' : report.trainingKind === 'course' ? 'course' : undefined,
      trainingCode: report.trainingCode ? String(report.trainingCode) : undefined,
      trainingTitle: report.trainingTitle ? String(report.trainingTitle) : undefined,
      eventId: report.eventId ? String(report.eventId) : undefined,
      eventCode: String(report.eventCode || report.flightNumber || ''),
      eventDescription: report.eventDescription ? String(report.eventDescription) : undefined,
      eventType: report.eventType ? String(report.eventType) : undefined,
      date: String(report.date || ''),
      startTime: Number.isFinite(Number(report.startTime)) ? Number(report.startTime) : undefined,
      duration: Number.isFinite(Number(report.duration)) ? Number(report.duration) : undefined,
      resourceId: report.resourceId ? String(report.resourceId) : undefined,
      callsign: report.callsign ? String(report.callsign) : undefined,
      instructorName: report.instructorName ? String(report.instructorName) : undefined,
      dashboardAssigneeName: report.dashboardAssigneeName ? String(report.dashboardAssigneeName) : undefined,
      overallGrade: report.overallGrade ? String(report.overallGrade) : undefined,
      overallResult: report.overallResult === 'P' || report.overallResult === 'F' ? report.overallResult : '',
      dcoResult: ['DCO', 'DPCO', 'DNCO'].includes(report.dcoResult) ? report.dcoResult : '',
      dpcoFollowUp: normaliseDpcoFollowUp(report.dpcoFollowUp),
      dncoFollowUp: normaliseDncoFollowUp(report.dncoFollowUp),
      passNotesToNextEvent: report.passNotesToNextEvent === true,
      assessedElementScores: Array.isArray(report.assessedElementScores)
        ? report.assessedElementScores
          .map((score: any) => ({
            element: String(score.element || '').trim(),
            grade: score.grade === undefined || score.grade === null ? '' : String(score.grade),
            comment: score.comment ? String(score.comment) : '',
          }))
          .filter((score: any) => score.element)
        : undefined,
      groundSchoolAssessment: report.groundSchoolAssessment
        ? {
          isAssessment: report.groundSchoolAssessment.isAssessment === true,
          result: report.groundSchoolAssessment.result ? String(report.groundSchoolAssessment.result) : '',
        }
        : undefined,
      notes: report.notes ? String(report.notes) : undefined,
      status: report.status === 'Complete' ? 'Complete' : 'Draft',
      dashboardAcknowledgedAt: report.dashboardAcknowledgedAt ? String(report.dashboardAcknowledgedAt) : undefined,
      createdAt: String(report.createdAt || ''),
      createdBy: report.createdBy ? String(report.createdBy) : undefined,
      updatedAt: report.updatedAt ? String(report.updatedAt) : undefined,
      updatedBy: report.updatedBy ? String(report.updatedBy) : undefined,
    }))
    .filter(report => report.id && report.eventCode) as AirCombatTrainingReport[];
  const reportsWithFollowUp = normalisedReports
    .filter(report => report.dpcoFollowUp || report.dncoFollowUp || report.dcoResult === 'DPCO' || report.dcoResult === 'DNCO')
    .map(report => ({
      id: report.id,
      staffName: report.staffName,
      eventCode: report.eventCode,
      dcoResult: report.dcoResult,
      dpcoFollowUp: report.dpcoFollowUp,
      dncoFollowUp: report.dncoFollowUp,
    }))
    .slice(0, 20);
  if (reportsWithFollowUp.length > 0) {
    appendTrainingReportFollowUpDiag('normalise:reports', {
      rawReportCount: raw.length,
      normalisedReportCount: normalisedReports.length,
      reportsWithFollowUp,
    });
  }
  return normalisedReports;
};

export const setAirCombatTrainingAssignment = (
  instructor: Instructor,
  assignment: AirCombatTrainingAssignment,
  assigned: boolean,
): Instructor => {
  const preferences = { ...(instructor.preferences || {}) } as PersonnelPreferences;
  const current = normaliseAirCombatTrainingAssignments(preferences);
  const field = assignment.kind === 'training_package' ? 'trainingPackages' : 'courses';
  const nextList = assigned
    ? [
        ...current[field].filter(item => item.trainingKey !== assignment.trainingKey),
        assignment,
      ]
    : current[field].filter(item => item.trainingKey !== assignment.trainingKey);

  return {
    ...instructor,
    preferences: {
      ...preferences,
      airCombat: {
        ...(preferences.airCombat || {}),
        trainingAssignments: {
          ...current,
          [field]: nextList,
        },
      },
    },
  };
};

export const staffHasAirCombatAssignment = (
  instructor: Instructor,
  assignment: AirCombatTrainingAssignment,
): boolean => {
  const assignments = normaliseAirCombatTrainingAssignments(instructor.preferences);
  const list = assignment.kind === 'training_package' ? assignments.trainingPackages : assignments.courses;
  return list.some(item => item.trainingKey === assignment.trainingKey);
};

export const normaliseAirCombatSchedulingWeights = (value: any): AirCombatSchedulingWeights => {
  const rawStreams = Array.isArray(value?.trainingStreams) ? value.trainingStreams : [];
  const trainingStreams = rawStreams
    .map((stream: any): AirCombatTrainingStreamWeight | null => {
      const kind = stream?.kind === 'training_package' ? 'training_package' : stream?.kind === 'course' ? 'course' : null;
      const code = String(stream?.code || '').trim();
      if (!kind || !code) return null;
      const locationCode = normaliseCode(stream?.locationCode);
      const unitCode = normaliseCode(stream?.unitCode);
      const key = String(stream?.key || getAirCombatTrainingKey(kind, code, locationCode, unitCode));
      const weight = Number(stream?.weight);
      return {
        key,
        kind,
        code,
        title: stream?.title ? String(stream.title) : undefined,
        locationCode,
        unitCode,
        weight: Number.isFinite(weight) && weight > 0 ? weight : 0,
      };
    })
    .filter(Boolean) as AirCombatTrainingStreamWeight[];

  const streamTotal = trainingStreams.reduce((sum, stream) => sum + stream.weight, 0);
  if (trainingStreams.length > 0 && streamTotal > 0) {
    let runningTotal = 0;
    const normalisedStreams = trainingStreams.map((stream, index) => {
      const isLast = index === trainingStreams.length - 1;
      const weight = isLast ? Math.max(0, 100 - runningTotal) : Math.round((stream.weight / streamTotal) * 100);
      runningTotal += weight;
      return { ...stream, weight };
    });
    const courseWeight = normalisedStreams
      .filter(stream => stream.kind === 'course')
      .reduce((sum, stream) => sum + stream.weight, 0);
    return {
      courses: Math.max(0, Math.min(100, courseWeight)),
      trainingPackages: Math.max(0, 100 - Math.max(0, Math.min(100, courseWeight))),
      trainingStreams: normalisedStreams,
    };
  }

  const courses = Number(value?.courses);
  const trainingPackages = Number(value?.trainingPackages);
  if (!Number.isFinite(courses) || !Number.isFinite(trainingPackages) || courses + trainingPackages <= 0) {
    return DEFAULT_AIR_COMBAT_SCHEDULING_WEIGHTS;
  }
  const total = courses + trainingPackages;
  return {
    courses: Math.round((courses / total) * 100),
    trainingPackages: 100 - Math.round((courses / total) * 100),
  };
};
