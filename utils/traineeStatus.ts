import type { Trainee } from '../types';

export const TRAINEE_SUSPENDED_MARKER = '__DFP_TRAINEE_SUSPENDED__';

export const getVisiblePermissions = (permissions?: string[] | null): string[] =>
  (permissions || []).filter((permission) => permission !== TRAINEE_SUSPENDED_MARKER);

export const isTraineeSuspended = (trainee?: Pick<Trainee, 'permissions'> | null): boolean =>
  Boolean(trainee?.permissions?.includes(TRAINEE_SUSPENDED_MARKER));

export const getTraineeStatusLabel = (trainee?: Pick<Trainee, 'isPaused' | 'permissions'> | null): 'Suspended' | 'Paused' | 'Active' => {
  if (isTraineeSuspended(trainee)) return 'Suspended';
  return trainee?.isPaused ? 'Paused' : 'Active';
};

export const setTraineeSuspendedMarker = (permissions: string[] | undefined, isSuspended: boolean): string[] => {
  const visiblePermissions = getVisiblePermissions(permissions);
  return isSuspended ? [...visiblePermissions, TRAINEE_SUSPENDED_MARKER] : visiblePermissions;
};
