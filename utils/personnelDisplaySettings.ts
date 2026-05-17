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
  'APS = Dr = Mr = Ms = Mrs = Mx = CIV = CONTRACTOR',
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

const splitRankGroup = (rankGroup?: string | null): string[] =>
  String(rankGroup || '')
    .split(/[=|]/)
    .map((rank) => rank.trim())
    .filter(Boolean);

const normaliseRankGroup = (rankGroup: string): string => splitRankGroup(rankGroup).join(' = ');

const uniqueRankList = (value: unknown, fallback: string[]): string[] => {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  const ranks = source
    .map((rank) => String(rank || '').trim())
    .filter(Boolean)
    .filter((rank) => {
      const keys = splitRankGroup(rank).map(rankKey).filter(Boolean);
      const unseenKeys = keys.filter((key) => !seen.has(key));
      unseenKeys.forEach((key) => seen.add(key));
      return unseenKeys.length > 0;
    })
    .map(normaliseRankGroup)
    .filter(Boolean);
  return ranks.length ? ranks : fallback;
};

const CIVILIAN_EQUAL_RANK_KEYS = new Set(['APS', 'DR', 'MR', 'MS', 'MRS', 'MX', 'CIV', 'CONTRACTOR']);

const groupLegacyCivilianRanks = (rankOrder: string[]): string[] => {
  const civilians: string[] = [];
  const otherRanks: string[] = [];
  rankOrder.forEach((entry) => {
    const parts = splitRankGroup(entry);
    const isCivilianOnly = parts.length > 0 && parts.every((part) => CIVILIAN_EQUAL_RANK_KEYS.has(rankKey(part)));
    if (isCivilianOnly) {
      parts.forEach((part) => civilians.push(part));
    } else {
      otherRanks.push(entry);
    }
  });

  if (civilians.length <= 1) return rankOrder;
  return uniqueRankList([...otherRanks, civilians.join(' = ')], DEFAULT_STAFF_RANK_ORDER);
};

export const normalisePersonnelDisplaySettings = (input?: Partial<PersonnelDisplaySettings> | null): PersonnelDisplaySettings => {
  const staffRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.staffRankOrder, DEFAULT_STAFF_RANK_ORDER));
  const traineeRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.traineeRankOrder, staffRankOrder));

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
    .split(/\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      return /[=|]/.test(trimmed) ? [trimmed] : trimmed.split(',');
    })
    .map((rank) => normaliseRankGroup(rank.trim()))
    .filter(Boolean)
    .filter((rank) => {
      const keys = splitRankGroup(rank).map(rankKey).filter(Boolean);
      const unseenKeys = keys.filter((key) => !seen.has(key));
      unseenKeys.forEach((key) => seen.add(key));
      return unseenKeys.length > 0;
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
  const targetKey = rankKey(rank);
  if (!targetKey) return 10000;
  const order = getRankOrderForGroup(settings, group);
  for (let index = 0; index < order.length; index += 1) {
    if (splitRankGroup(order[index]).map(rankKey).includes(targetKey)) return index;
  }
  return 10000;
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
