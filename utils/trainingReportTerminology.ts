import type { PlatformConfig } from './platformConfigService';

export interface TrainingReportTerminology {
  name: string;
}

export interface TrainingReportGradeOption {
  value: number;
  label: string;
  requiresRepeat: boolean;
}

export interface TrainingReportTemplate {
  version: number;
  genericName: string;
  displayName: string;
  modules: {
    overview: {
      title: string;
      fields: {
        event: string;
        training: string;
        type: string;
        timing: string;
        resource: string;
        callsign: string;
        unit: string;
        date: string;
        assessor: string;
      };
    };
    overallAssessment: {
      title: string;
      fields: {
        result: string;
        overallGrade: string;
        overallResult: string;
        groundSchoolAssessment: string;
      };
    };
    comments: {
      title: string;
      fields: {
        assessor: string;
        weather: string;
        profile: string;
        overall: string;
        nest: string;
        notes: string;
      };
    };
    assessmentMatrix: {
      title: string;
    };
  };
  completionResults: Array<{
    code: 'DCO' | 'DPCO' | 'DNCO';
    label: string;
  }>;
  overallResults: {
    passLabel: string;
    failLabel: string;
    doubleRepeatLabel: string;
  };
  grades: {
    scaleMax: number;
    includeDemo: boolean;
    showNumbers: boolean;
    options: TrainingReportGradeOption[];
  };
  repeatRules: {
    gradesRequiringRepeat: number[];
    consecutive: {
      enabled: boolean;
      grades: number[];
      count: number;
    };
    rollingWindow: {
      enabled: boolean;
      grades: number[];
      count: number;
      window: number;
    };
  };
}

export const TRAINING_REPORT_NAME_MAX_LENGTH = 10;
export const TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH = 20;
export const TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH = 40;
export const TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH = 40;

export const DEFAULT_TRAINING_REPORT_TERMINOLOGY: TrainingReportTerminology = {
  name: 'Report',
};

const DEFAULT_GRADE_LABELS: Record<number, string> = {
  0: 'Unsatisfactory',
  1: 'Marginal',
  2: 'Low Satisfactory',
  3: 'Satisfactory',
  4: 'High Satisfactory',
  5: 'Excellent',
};

export const DEFAULT_TRAINING_REPORT_TEMPLATE: TrainingReportTemplate = {
  version: 1,
  genericName: 'Training Report',
  displayName: 'PT-051',
  modules: {
    overview: {
      title: 'Event Details',
      fields: {
        event: 'Event',
        training: 'Training',
        type: 'Type',
        timing: 'Timing',
        resource: 'Resource',
        callsign: 'Callsign',
        unit: 'Unit',
        date: 'Date',
        assessor: 'Report Instructor',
      },
    },
    overallAssessment: {
      title: 'Overall Assessment',
      fields: {
        result: 'Result',
        overallGrade: 'Overall Grade',
        overallResult: 'Overall Result',
        groundSchoolAssessment: 'Ground School Assessment',
      },
    },
    comments: {
      title: 'Comments',
      fields: {
        assessor: 'QFI',
        weather: 'Weather',
        profile: 'Profile',
        overall: 'Overall',
        nest: 'NEST',
        notes: 'Notes',
      },
    },
    assessmentMatrix: {
      title: 'Assessment Matrix',
    },
  },
  completionResults: [
    { code: 'DCO', label: 'DCO' },
    { code: 'DPCO', label: 'DPCO' },
    { code: 'DNCO', label: 'DNCO' },
  ],
  overallResults: {
    passLabel: 'PASS',
    failLabel: 'FAIL',
    doubleRepeatLabel: 'Double Marg',
  },
  grades: {
    scaleMax: 5,
    includeDemo: true,
    showNumbers: true,
    options: [0, 1, 2, 3, 4, 5].map((value) => ({
      value,
      label: DEFAULT_GRADE_LABELS[value],
      requiresRepeat: value === 0,
    })),
  },
  repeatRules: {
    gradesRequiringRepeat: [0],
    consecutive: {
      enabled: true,
      grades: [1],
      count: 2,
    },
    rollingWindow: {
      enabled: false,
      grades: [1],
      count: 2,
      window: 3,
    },
  },
};

const cleanLabel = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
};

export const normaliseTrainingReportTerminology = (
  input?: Partial<TrainingReportTerminology> | null,
): TrainingReportTerminology => ({
  name: cleanLabel(input?.name, DEFAULT_TRAINING_REPORT_TERMINOLOGY.name, TRAINING_REPORT_NAME_MAX_LENGTH),
});

const cleanNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
};

const cleanBoolean = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const normaliseGradeValues = (values: unknown, scaleMax: number, fallback: number[]): number[] => {
  const source = Array.isArray(values) ? values : fallback;
  const cleaned = source
    .map((value) => cleanNumber(value, -1, 0, scaleMax))
    .filter((value) => value >= 0 && value <= scaleMax);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
};

const normaliseGradeOptions = (
  input: unknown,
  scaleMax: number,
  repeatGrades: number[],
): TrainingReportGradeOption[] => {
  const source = Array.isArray(input) ? input : [];
  return Array.from({ length: scaleMax + 1 }, (_, value) => {
    const existing = source.find((option) => Number(option?.value) === value);
    return {
      value,
      label: cleanLabel(existing?.label, DEFAULT_GRADE_LABELS[value] || `Grade ${value}`, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
      requiresRepeat: cleanBoolean(existing?.requiresRepeat, repeatGrades.includes(value)),
    };
  });
};

const mergeFields = <T extends Record<string, string>>(
  defaults: T,
  input: unknown,
): T => {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.keys(defaults).reduce((next, key) => ({
    ...next,
    [key]: cleanLabel(source[key], defaults[key], TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
  }), {} as T);
};

export const normaliseTrainingReportTemplate = (
  input?: Partial<TrainingReportTemplate> | null,
  legacyTerminology?: Partial<TrainingReportTerminology> | null,
): TrainingReportTemplate => {
  const source = input && typeof input === 'object' ? input as Record<string, any> : {};
  const legacy = normaliseTrainingReportTerminology(legacyTerminology || null);
  const scaleMax = cleanNumber(source.grades?.scaleMax, DEFAULT_TRAINING_REPORT_TEMPLATE.grades.scaleMax, 5, 10);
  const fallbackRepeatGrades = normaliseGradeValues(
    source.repeatRules?.gradesRequiringRepeat,
    scaleMax,
    DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.gradesRequiringRepeat,
  );
  const gradeOptions = normaliseGradeOptions(source.grades?.options, scaleMax, fallbackRepeatGrades);
  const gradesRequiringRepeat = normaliseGradeValues(
    source.repeatRules?.gradesRequiringRepeat,
    scaleMax,
    gradeOptions.filter((option) => option.requiresRepeat).map((option) => option.value),
  );

  return {
    version: 1,
    genericName: cleanLabel(source.genericName, DEFAULT_TRAINING_REPORT_TEMPLATE.genericName, TRAINING_REPORT_GENERIC_NAME_MAX_LENGTH),
    displayName: cleanLabel(source.displayName, legacy.name === DEFAULT_TRAINING_REPORT_TERMINOLOGY.name ? DEFAULT_TRAINING_REPORT_TEMPLATE.displayName : legacy.name, TRAINING_REPORT_DISPLAY_NAME_MAX_LENGTH),
    modules: {
      overview: {
        title: cleanLabel(source.modules?.overview?.title, DEFAULT_TRAINING_REPORT_TEMPLATE.modules.overview.title, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
        fields: mergeFields(DEFAULT_TRAINING_REPORT_TEMPLATE.modules.overview.fields, source.modules?.overview?.fields),
      },
      overallAssessment: {
        title: cleanLabel(source.modules?.overallAssessment?.title, DEFAULT_TRAINING_REPORT_TEMPLATE.modules.overallAssessment.title, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
        fields: mergeFields(DEFAULT_TRAINING_REPORT_TEMPLATE.modules.overallAssessment.fields, source.modules?.overallAssessment?.fields),
      },
      comments: {
        title: cleanLabel(source.modules?.comments?.title, DEFAULT_TRAINING_REPORT_TEMPLATE.modules.comments.title, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
        fields: mergeFields(DEFAULT_TRAINING_REPORT_TEMPLATE.modules.comments.fields, source.modules?.comments?.fields),
      },
      assessmentMatrix: {
        title: cleanLabel(source.modules?.assessmentMatrix?.title, DEFAULT_TRAINING_REPORT_TEMPLATE.modules.assessmentMatrix.title, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
      },
    },
    completionResults: DEFAULT_TRAINING_REPORT_TEMPLATE.completionResults.map((result) => {
      const existing = Array.isArray(source.completionResults)
        ? source.completionResults.find((option: any) => option?.code === result.code)
        : null;
      return {
        code: result.code,
        label: cleanLabel(existing?.label, result.label, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
      };
    }),
    overallResults: {
      passLabel: cleanLabel(source.overallResults?.passLabel, DEFAULT_TRAINING_REPORT_TEMPLATE.overallResults.passLabel, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
      failLabel: cleanLabel(source.overallResults?.failLabel, DEFAULT_TRAINING_REPORT_TEMPLATE.overallResults.failLabel, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
      doubleRepeatLabel: cleanLabel(source.overallResults?.doubleRepeatLabel, DEFAULT_TRAINING_REPORT_TEMPLATE.overallResults.doubleRepeatLabel, TRAINING_REPORT_FIELD_LABEL_MAX_LENGTH),
    },
    grades: {
      scaleMax,
      includeDemo: cleanBoolean(source.grades?.includeDemo, DEFAULT_TRAINING_REPORT_TEMPLATE.grades.includeDemo),
      showNumbers: cleanBoolean(source.grades?.showNumbers, DEFAULT_TRAINING_REPORT_TEMPLATE.grades.showNumbers),
      options: gradeOptions.map((option) => ({
        ...option,
        requiresRepeat: gradesRequiringRepeat.includes(option.value),
      })),
    },
    repeatRules: {
      gradesRequiringRepeat,
      consecutive: {
        enabled: cleanBoolean(source.repeatRules?.consecutive?.enabled, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.consecutive.enabled),
        grades: normaliseGradeValues(source.repeatRules?.consecutive?.grades, scaleMax, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.consecutive.grades),
        count: cleanNumber(source.repeatRules?.consecutive?.count, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.consecutive.count, 2, 5),
      },
      rollingWindow: {
        enabled: cleanBoolean(source.repeatRules?.rollingWindow?.enabled, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.rollingWindow.enabled),
        grades: normaliseGradeValues(source.repeatRules?.rollingWindow?.grades, scaleMax, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.rollingWindow.grades),
        count: cleanNumber(source.repeatRules?.rollingWindow?.count, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.rollingWindow.count, 2, 5),
        window: cleanNumber(source.repeatRules?.rollingWindow?.window, DEFAULT_TRAINING_REPORT_TEMPLATE.repeatRules.rollingWindow.window, 3, 10),
      },
    },
  };
};

export const getTrainingReportTerminology = (config?: PlatformConfig | null): TrainingReportTerminology => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  const settings = activeOrganisation?.settings || {};
  const template = normaliseTrainingReportTemplate(settings.trainingReportTemplate || null, settings.trainingReportTerminology || null);
  return normaliseTrainingReportTerminology({ name: template.displayName });
};

export const getTrainingReportTemplate = (config?: PlatformConfig | null): TrainingReportTemplate => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  const settings = activeOrganisation?.settings || {};
  return normaliseTrainingReportTemplate(settings.trainingReportTemplate || null, settings.trainingReportTerminology || null);
};
