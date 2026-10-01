import type { Instructor } from '../types';
import {
  getPersonAssignedQualificationIds,
  type StaffQualificationCatalogue,
} from './staffQualifications';

const STORAGE_KEY = 'dfp_staff_profile_trace';
const MAX_ENTRIES = 300;

type StaffProfileTraceEntry = {
  timestamp: string;
  stage: string;
  data: unknown;
};

const hasWindow = (): boolean => typeof window !== 'undefined';

const safeClone = (value: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
};

export const readStaffProfileTrace = (): StaffProfileTraceEntry[] => {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendStaffProfileTrace = (stage: string, data: unknown): void => {
  if (!hasWindow()) return;
  const nextEntry: StaffProfileTraceEntry = {
    timestamp: new Date().toISOString(),
    stage,
    data: safeClone(data),
  };
  try {
    const entries = [...readStaffProfileTrace(), nextEntry].slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Tracing must never interrupt normal staff profile work.
  }
};

export const clearStaffProfileTrace = (): void => {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

const traceSlug = (value: string): string =>
  String(value || 'staff-profile')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'staff-profile';

export const downloadStaffProfileTrace = (label = 'staff-profile'): void => {
  if (!hasWindow()) return;
  const payload = {
    generatedAt: new Date().toISOString(),
    href: window.location.href,
    userAgent: window.navigator.userAgent,
    entries: readStaffProfileTrace(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `staff-profile-trace-${traceSlug(label)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const summariseStaffProfileForTrace = (
  instructor: Partial<Instructor> | null | undefined,
  staffQualificationCatalogue?: StaffQualificationCatalogue,
): Record<string, unknown> | null => {
  if (!instructor) return null;
  const anyInstructor = instructor as any;
  const assignedQualificationIds = getPersonAssignedQualificationIds(
    instructor as Instructor,
    staffQualificationCatalogue,
    false,
  );
  return {
    dbId: String(anyInstructor.id || '').trim() || null,
    idNumber: instructor.idNumber ?? null,
    name: instructor.name || '',
    rank: instructor.rank || '',
    role: instructor.role || '',
    unit: instructor.unit || '',
    location: instructor.location || '',
    flight: instructor.flight || '',
    isActive: anyInstructor.isActive !== false,
    isAdminStaff: instructor.isAdminStaff === true,
    isContractor: instructor.isContractor === true,
    isOFI: instructor.isOFI === true,
    isQFI: instructor.isQFI === true,
    preferencesQualifications: Array.isArray(instructor.preferences?.qualifications)
      ? instructor.preferences?.qualifications
      : [],
    topLevelQualifications: Array.isArray(anyInstructor.qualifications)
      ? anyInstructor.qualifications
      : [],
    assignedQualificationIds,
  };
};
