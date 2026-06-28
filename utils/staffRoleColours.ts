import { findCrewPositionEntry, getCrewPositionDisplayLabel, type CrewPositionTerminology } from './crewPositionTerminology';

const ROLE_TEXT_COLOURS = [
  'text-sky-300',
  'text-emerald-300',
  'text-amber-300',
  'text-violet-300',
  'text-rose-300',
  'text-cyan-300',
  'text-lime-300',
  'text-orange-300',
  'text-fuchsia-300',
  'text-teal-300',
];

const STABLE_ROLE_COLOUR_OVERRIDES: Record<string, string> = {
  pilot: 'text-sky-300',
  'combat systems operator': 'text-emerald-300',
  wso: 'text-emerald-300',
  loadmaster: 'text-amber-300',
  'airborne mission commander': 'text-violet-300',
  'flight engineer': 'text-rose-300',
  mpro: 'text-amber-300',
  ewo: 'text-stone-300',
  awo: 'text-violet-300',
  aea: 'text-cyan-300',
  crew: 'text-cyan-300',
  trainee: 'text-lime-300',
};

const normaliseRoleKey = (value?: string): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const getStaffRoleDisplay = (
  role: string | undefined,
  terminology?: CrewPositionTerminology,
  instructorLabel = 'QFI',
): { key: string; label: string; textClassName: string } => {
  const entry = findCrewPositionEntry(role, terminology);
  const rawRole = String(role || '').trim();
  const label = getCrewPositionDisplayLabel(role, terminology, 'Unassigned');
  const stableKey = normaliseRoleKey(entry?.genericName || rawRole || 'unassigned');

  if (stableKey === 'qfi' || stableKey === 'instructor') {
    return {
      key: 'instructor',
      label: instructorLabel,
      textClassName: 'text-blue-200',
    };
  }

  const override = STABLE_ROLE_COLOUR_OVERRIDES[stableKey] || STABLE_ROLE_COLOUR_OVERRIDES[normaliseRoleKey(label)];
  if (override) {
    return { key: stableKey, label, textClassName: override };
  }

  let hash = 0;
  for (let index = 0; index < stableKey.length; index += 1) {
    hash = (hash * 31 + stableKey.charCodeAt(index)) >>> 0;
  }

  return {
    key: stableKey,
    label,
    textClassName: ROLE_TEXT_COLOURS[hash % ROLE_TEXT_COLOURS.length],
  };
};
