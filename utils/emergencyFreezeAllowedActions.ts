import type { AllowedActions } from '../context/SystemFreezeContext';

export const DEFAULT_EMERGENCY_FREEZE_ALLOWED_ACTIONS: AllowedActions = {
  postFlightTimes: false,
  pt051Entries: false,
  flightAuthorisation: false,
  aircraftAvailability: false,
};

export const normaliseEmergencyFreezeAllowedActions = (
  value?: Partial<AllowedActions> | null,
): AllowedActions => ({
  postFlightTimes: value?.postFlightTimes === true,
  pt051Entries: value?.pt051Entries === true,
  flightAuthorisation: value?.flightAuthorisation === true,
  aircraftAvailability: value?.aircraftAvailability === true,
});
