import type { PlatformConfig } from './platformConfigService';

export type PersonnelSortMode = 'rank-then-name' | 'alphabetical';
export type PersonnelGroup = 'staff' | 'trainee';

export interface PersonnelDisplaySettings {
  sortMode: PersonnelSortMode;
  useSeparateTraineeRankOrder: boolean;
  staffRankOrder: string[];
  traineeRankOrder: string[];
  civilianContractorGroupName: string;
  instructorLabel: string;
}

export const DEFAULT_STAFF_RANK_ORDER = [
  'AIRMSHL',
  'AVM',
  'AIRCDRE',
  'GPCAPT',
  'WGCDR',
  'SQNLDR',
  'FLTLT',
  'FLGOFF',
  'PLTOFF',
  'WOFF',
  'FSGT',
  'SGT',
  'CPL',
  'LAC',
  'AC',
  'APS',
  'Dr',
  'Mr',
  'Ms',
  'Mrs',
  'Mx',
  'CIV',
  'CONTRACTOR',
];

export const DEFAULT_PERSONNEL_DISPLAY_SETTINGS: PersonnelDisplaySettings = {
  sortMode: 'rank-then-name',
  useSeparateTraineeRankOrder: false,
  staffRankOrder: DEFAULT_STAFF_RANK_ORDER,
  traineeRankOrder: DEFAULT_STAFF_RANK_ORDER,
  civilianContractorGroupName: 'Civilian Contractors',
  instructorLabel: 'QFI',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const rankKey = (rank?: string | null) => String(rank || '').trim().toUpperCase();

const uniqueRankList = (value: unknown, fallback: string[]): string[] => {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  const ranks = source
    .map((rank) => String(rank || '').trim())
    .filter(Boolean)
    .filter((rank) => {
      const key = rankKey(rank);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return ranks.length ? ranks : fallback;
};

export const normalisePersonnelDisplaySettings = (input?: Partial<PersonnelDisplaySettings> | null): PersonnelDisplaySettings => {
  const staffRankOrder = uniqueRankList(input?.staffRankOrder, DEFAULT_STAFF_RANK_ORDER);
  const traineeRankOrder = uniqueRankList(input?.traineeRankOrder, staffRankOrder);

  return {
    sortMode: input?.sortMode === 'alphabetical' ? 'alphabetical' : 'rank-then-name',
    useSeparateTraineeRankOrder: Boolean(input?.useSeparateTraineeRankOrder),
    staffRankOrder,
    traineeRankOrder,
    civilianContractorGroupName: String(input?.civilianContractorGroupName || '').trim() || DEFAULT_PERSONNEL_DISPLAY_SETTINGS.civilianContractorGroupName,
    instructorLabel: String(input?.instructorLabel || '').trim() || DEFAULT_PERSONNEL_DISPLAY_SETTINGS.instructorLabel,
  };
};

export const getPersonnelDisplaySettings = (config?: PlatformConfig | null): PersonnelDisplaySettings => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  const settings = activeOrganisation?.settings || {};
  return normalisePersonnelDisplaySettings(settings.personnelDisplaySettings || settings.personnelSettings || null);
};

export const getInstructorTerminology = (config?: PlatformConfig | null): string =>
  getPersonnelDisplaySettings(config).instructorLabel;

export const parseRankOrderText = (value: string): string[] => {
  const seen = new Set<string>();
  return String(value || '')
    .split(/[\n,]/)
    .map((rank) => rank.trim())
    .filter(Boolean)
    .filter((rank) => {
      const key = rankKey(rank);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const formatRankOrderText = (rankOrder: string[] = []): string => rankOrder.join('\n');

export const splitPersonName = (
  personOrName?: { name?: string; fullName?: string; firstName?: string; surname?: string; lastName?: string } | string | null,
) => {
  const raw = typeof personOrName === 'string'
    ? personOrName
    : (personOrName?.name || personOrName?.fullName || `${personOrName?.firstName || ''} ${personOrName?.surname || personOrName?.lastName || ''}`).trim();
  const full = String(raw || '').trim();
  if (!full) return { full: '', surname: '', given: '' };

  if (full.includes(',')) {
    const [surname, ...rest] = full.split(',');
    return { full, surname: surname.trim(), given: rest.join(',').trim() };
  }

  const parts = full.split(/\s+/);
  return {
    full,
    surname: parts.length > 1 ? parts[parts.length - 1] : full,
    given: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
  };
};

export const getRankOrderForGroup = (
  settings?: Partial<PersonnelDisplaySettings>,
  group: PersonnelGroup = 'staff',
): string[] => {
  const safe = normalisePersonnelDisplaySettings(settings);
  return group === 'trainee' && safe.useSeparateTraineeRankOrder ? safe.traineeRankOrder : safe.staffRankOrder;
};

export const getRankSortIndex = (
  rank?: string | null,
  settings?: Partial<PersonnelDisplaySettings>,
  group: PersonnelGroup = 'staff',
): number => {
  const order = getRankOrderForGroup(settings, group).map(rankKey);
  const index = order.indexOf(rankKey(rank));
  return index >= 0 ? index : 10000;
};

export const comparePeopleByConfiguredRank = <
  T extends { rank?: string | null; name?: string; fullName?: string; firstName?: string; surname?: string; lastName?: string },
>(
  a: T,
  b: T,
  settings?: Partial<PersonnelDisplaySettings>,
  group: PersonnelGroup = 'staff',
): number => {
  const safe = normalisePersonnelDisplaySettings(settings);
  const aName = splitPersonName(a);
  const bName = splitPersonName(b);

  if (safe.sortMode === 'rank-then-name') {
    const aRank = getRankSortIndex(a.rank, safe, group);
    const bRank = getRankSortIndex(b.rank, safe, group);
    if (aRank !== bRank) return aRank - bRank;

    if (aRank >= 10000 || bRank >= 10000) {
      const rankCompare = collator.compare(String(a.rank || ''), String(b.rank || ''));
      if (rankCompare) return rankCompare;
    }
  }

  return collator.compare(aName.surname, bName.surname)
    || collator.compare(aName.given, bName.given)
    || collator.compare(aName.full, bName.full);
};
