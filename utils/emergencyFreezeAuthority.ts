import {
  normaliseAssignedQualificationIds,
  type StaffQualificationCatalogue,
} from './staffQualifications';

export interface EmergencyFreezeAuthoritySettings {
  activateQualificationIds: string[];
  deactivateQualificationIds: string[];
}

export const DEFAULT_EMERGENCY_FREEZE_AUTHORITY: EmergencyFreezeAuthoritySettings = {
  activateQualificationIds: [],
  deactivateQualificationIds: [],
};

const normaliseStringList = (source: unknown): string[] => {
  if (Array.isArray(source)) {
    return Array.from(new Set(source.map(value => String(value || '').trim()).filter(Boolean)));
  }
  return String(source || '')
    .split(/\r?\n|,|;/)
    .map(value => value.trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
};

export const normaliseEmergencyFreezeAuthoritySettings = (
  source?: Partial<EmergencyFreezeAuthoritySettings> | null,
  catalogue?: StaffQualificationCatalogue,
): EmergencyFreezeAuthoritySettings => {
  const activateQualificationIds = normaliseStringList(source?.activateQualificationIds);
  const deactivateQualificationIds = normaliseStringList(source?.deactivateQualificationIds);
  const sharedQualificationIds = activateQualificationIds.length > 0 ? activateQualificationIds : deactivateQualificationIds;
  if (!catalogue) {
    return {
      activateQualificationIds: sharedQualificationIds,
      deactivateQualificationIds: sharedQualificationIds,
    };
  }
  const normalisedSharedQualificationIds = normaliseAssignedQualificationIds(
    sharedQualificationIds,
    catalogue,
    false,
  );
  return {
    activateQualificationIds: normalisedSharedQualificationIds,
    deactivateQualificationIds: normalisedSharedQualificationIds,
  };
};

export const hasEmergencyFreezeAuthority = ({
  action,
  settings,
  userQualificationIds,
  userPermission,
}: {
  action: 'activate' | 'deactivate';
  settings?: Partial<EmergencyFreezeAuthoritySettings> | null;
  userQualificationIds?: string[];
  userPermission?: string;
}): boolean => {
  const requiredIds = normaliseStringList(settings?.activateQualificationIds);
  const permission = String(userPermission || '').trim();
  const breakGlassPermissions = ['Super Admin', 'Admin'];
  const legacyPermissions = [...breakGlassPermissions, 'Scheduler'];
  if (requiredIds.length === 0) return legacyPermissions.includes(permission);
  if (breakGlassPermissions.includes(permission)) return true;
  const assigned = new Set(normaliseStringList(userQualificationIds));
  return requiredIds.some(id => assigned.has(id));
};
