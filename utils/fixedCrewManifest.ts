import type { SyllabusItemDetail } from '../types';
import type { AircraftCrewComposition } from './aircraftCrewComposition';
import { getCrewRequirementCount } from './crewRequirements';
import { normaliseOperationalModel } from './platformConfigService';
import {
  getQualificationsForOperationalModel,
  normaliseQualificationToken,
  type StaffQualificationCatalogue,
} from './staffQualifications';

export type FixedCrewManifestStatus =
  | 'not_fixed_crew'
  | 'not_required'
  | 'missing_pic_qualification'
  | 'missing_crew_requirement'
  | 'pending_assignment';

export type FixedCrewManifestPlanStatus =
  | 'pending'
  | 'complete'
  | 'partial'
  | 'swapped'
  | 'invalid';

export interface FixedCrewManifestPlan {
  crewGroup?: string;
  picStaffName?: string;
  picQualification?: string;
  status?: FixedCrewManifestPlanStatus;
  swapNotes?: string;
}

export interface FixedCrewManifestReadiness {
  status: FixedCrewManifestStatus;
  isFixedCrewModel: boolean;
  isCrewedEvent: boolean;
  picRequired: boolean;
  picQualificationConfigured: boolean;
  requiredCrewCount: number;
}

const FIXED_CREW_MANIFEST_NOTE_REGEX = /^\[Fixed Crew Manifest:\s*([A-Za-z0-9+/=]+)\]$/i;

const encodeManifestPlan = (plan: FixedCrewManifestPlan): string => {
  const payload = JSON.stringify(plan);
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(payload)));
  if (typeof Buffer !== 'undefined') return Buffer.from(payload, 'utf8').toString('base64');
  return '';
};

const decodeManifestPlan = (value: string): FixedCrewManifestPlan => {
  try {
    const payload = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(value)))
      : Buffer.from(value, 'base64').toString('utf8');
    const parsed = JSON.parse(payload);
    return {
      crewGroup: String(parsed?.crewGroup || '').trim() || undefined,
      picStaffName: String(parsed?.picStaffName || '').trim() || undefined,
      picQualification: String(parsed?.picQualification || '').trim() || undefined,
      status: normaliseFixedCrewManifestPlanStatus(parsed?.status),
      swapNotes: typeof parsed?.swapNotes === 'string' ? parsed.swapNotes : undefined,
    };
  } catch (_error) {
    return {};
  }
};

export const normaliseFixedCrewManifestPlanStatus = (value: unknown): FixedCrewManifestPlanStatus => {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'complete') return 'complete';
  if (token === 'partial') return 'partial';
  if (token === 'swapped') return 'swapped';
  if (token === 'invalid') return 'invalid';
  return 'pending';
};

export const getFixedCrewManifestPlan = (
  item?: Pick<SyllabusItemDetail, 'notes'> | null,
): FixedCrewManifestPlan => {
  const manifestLine = String(item?.notes || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => FIXED_CREW_MANIFEST_NOTE_REGEX.test(line));
  const match = manifestLine?.match(FIXED_CREW_MANIFEST_NOTE_REGEX);
  return match?.[1] ? decodeManifestPlan(match[1]) : {};
};

export const stripFixedCrewManifestNote = (notes: unknown): string => (
  String(notes || '')
    .split(/\r?\n/)
    .filter(line => !FIXED_CREW_MANIFEST_NOTE_REGEX.test(line.trim()))
    .join('\n')
    .trim()
);

export const withFixedCrewManifestPlan = (
  item: SyllabusItemDetail,
  plan: FixedCrewManifestPlan,
): SyllabusItemDetail => {
  const cleanPlan: FixedCrewManifestPlan = {
    crewGroup: String(plan.crewGroup || '').trim() || undefined,
    picStaffName: String(plan.picStaffName || '').trim() || undefined,
    picQualification: String(plan.picQualification || '').trim() || undefined,
    status: normaliseFixedCrewManifestPlanStatus(plan.status),
    swapNotes: typeof plan.swapNotes === 'string' ? plan.swapNotes : undefined,
  };
  const visibleNotes = stripFixedCrewManifestNote(item.notes);
  const hasManifestData = Boolean(
    cleanPlan.crewGroup
    || cleanPlan.picStaffName
    || cleanPlan.picQualification
    || String(cleanPlan.swapNotes || '').trim()
    || cleanPlan.status !== 'pending'
  );
  const manifestLine = hasManifestData ? `[Fixed Crew Manifest: ${encodeManifestPlan(cleanPlan)}]` : '';
  const notes = [visibleNotes, manifestLine].filter(Boolean).join('\n').trim();
  return { ...item, notes: notes || undefined };
};

export const isFixedCrewFlightOrSimEvent = (item?: Pick<SyllabusItemDetail, 'type'> | null): boolean => (
  item?.type === 'Flight' || item?.type === 'FTD'
);

export const hasFixedCrewPicQualification = (
  catalogue?: StaffQualificationCatalogue,
): boolean => (
  getQualificationsForOperationalModel(catalogue, 'fixed_crew')
    .some((qualification) => (
      normaliseQualificationToken(qualification.id) === 'pic'
      || normaliseQualificationToken(qualification.code) === 'pic'
      || normaliseQualificationToken(qualification.name) === 'pic'
    ))
);

export const getFixedCrewManifestReadiness = (
  item: SyllabusItemDetail,
  options: {
    operationalModel?: unknown;
    aircraftCrewComposition?: AircraftCrewComposition | null;
    staffQualificationCatalogue?: StaffQualificationCatalogue;
  } = {},
): FixedCrewManifestReadiness => {
  const isFixedCrewModel = normaliseOperationalModel(options.operationalModel) === 'fixed_crew';
  const isCrewedEvent = isFixedCrewFlightOrSimEvent(item);
  const picRequired = isFixedCrewModel && isCrewedEvent;
  const picQualificationConfigured = hasFixedCrewPicQualification(options.staffQualificationCatalogue);
  const requiredCrewCount = getCrewRequirementCount(item.crewRequirement, options.aircraftCrewComposition);

  let status: FixedCrewManifestStatus = 'pending_assignment';
  if (!isFixedCrewModel) {
    status = 'not_fixed_crew';
  } else if (!isCrewedEvent) {
    status = 'not_required';
  } else if (!picQualificationConfigured) {
    status = 'missing_pic_qualification';
  } else if (requiredCrewCount <= 0) {
    status = 'missing_crew_requirement';
  }

  return {
    status,
    isFixedCrewModel,
    isCrewedEvent,
    picRequired,
    picQualificationConfigured,
    requiredCrewCount,
  };
};

export const formatFixedCrewManifestStatus = (status: FixedCrewManifestStatus): string => {
  switch (status) {
    case 'missing_pic_qualification':
      return 'PIC qualification missing';
    case 'missing_crew_requirement':
      return 'Crew requirement missing';
    case 'not_required':
      return 'Not required';
    case 'not_fixed_crew':
      return 'Not Fixed Crew';
    case 'pending_assignment':
    default:
      return 'Pending crew assignment';
  }
};

export const formatFixedCrewManifestPlanStatus = (status?: FixedCrewManifestPlanStatus): string => {
  switch (normaliseFixedCrewManifestPlanStatus(status)) {
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'swapped':
      return 'Swapped';
    case 'invalid':
      return 'Invalid';
    case 'pending':
    default:
      return 'Pending';
  }
};
