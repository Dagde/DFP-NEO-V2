import type { SyllabusItemDetail } from '../types';
import type { AircraftCrewComposition } from './aircraftCrewComposition';
import { getCrewRequirementCount } from './crewRequirements';
import { isFixedCrewLikeOperationalModel } from './platformConfigService';
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

export interface FixedCrewManifestReadiness {
  status: FixedCrewManifestStatus;
  isFixedCrewModel: boolean;
  isCrewedEvent: boolean;
  picRequired: boolean;
  picQualificationConfigured: boolean;
  requiredCrewCount: number;
}

const FIXED_CREW_MANIFEST_NOTE_REGEX = /^\[Fixed Crew Manifest:\s*([A-Za-z0-9+/=]+)\]$/i;

export const stripFixedCrewManifestNote = (notes: unknown): string => (
  String(notes || '')
    .split(/\r?\n/)
    .filter(line => !FIXED_CREW_MANIFEST_NOTE_REGEX.test(line.trim()))
    .join('\n')
    .trim()
);

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
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(options.operationalModel);
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
      return 'Requirements ready';
  }
};
