import type { PlatformConfig } from './platformConfigService';

export type PersonnelSortMode = 'rank-then-name' | 'alphabetical';
export type PersonnelGroup = 'staff' | 'trainee';
export type RankEquivalencyPresetKey = 'AU' | 'US' | 'CUSTOM';

export interface RankEquivalencyCell {
  rank: string;
  abbreviation: string;
}

export interface RankEquivalencyService {
  name: string;
}

export interface RankEquivalencyRow {
  grade: string;
  ranks: RankEquivalencyCell[];
}

export interface RankEquivalencyConfig {
  preset: RankEquivalencyPresetKey;
  services: RankEquivalencyService[];
  rows: RankEquivalencyRow[];
}

export interface PersonnelDisplaySettings {
  sortMode: PersonnelSortMode;
  useSeparateTraineeRankOrder: boolean;
  staffRankOrder: string[];
  traineeRankOrder: string[];
  staffRankEquivalency: RankEquivalencyConfig;
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

export const RANK_EQUIVALENCY_GRADES = [
  'O-10',
  'O-9',
  'O-8',
  'O-7',
  'O-6',
  'O-5',
  'O-4',
  'O-3',
  'O-2',
  'O-1',
  'E-9',
  'E-8',
  'E-7',
  'E-6',
  'E-5',
  'E-4',
  'E-3',
  'E-2',
  'E-1',
];

const makeRankRow = (grade: string, ranks: Array<[string, string]>): RankEquivalencyRow => ({
  grade,
  ranks: [0, 1, 2, 3].map((index) => {
    const [rank, abbreviation] = ranks[index] || ['', ''];
    return { rank, abbreviation };
  }),
});

export const RANK_EQUIVALENCY_PRESETS: Record<RankEquivalencyPresetKey, RankEquivalencyConfig> = {
  AU: {
    preset: 'AU',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['Air Marshal', 'AIRMSHL'], ['Admiral', 'ADM'], ['General', 'GEN'], ['', '']]),
      makeRankRow('O-9', [['Air Vice-Marshal', 'AVM'], ['Vice Admiral', 'VADM'], ['Lieutenant General', 'LTGEN'], ['', '']]),
      makeRankRow('O-8', [['Air Commodore', 'AIRCDRE'], ['Rear Admiral', 'RADM'], ['Major General', 'MAJGEN'], ['', '']]),
      makeRankRow('O-7', [['Group Captain', 'GPCAPT'], ['Commodore', 'CDRE'], ['Brigadier', 'BRIG'], ['', '']]),
      makeRankRow('O-6', [['Wing Commander', 'WGCDR'], ['Captain', 'CAPT'], ['Colonel', 'COL'], ['', '']]),
      makeRankRow('O-5', [['Squadron Leader', 'SQNLDR'], ['Commander', 'CMDR'], ['Lieutenant Colonel', 'LTCOL'], ['', '']]),
      makeRankRow('O-4', [['Flight Lieutenant', 'FLTLT'], ['Lieutenant Commander', 'LCDR'], ['Major', 'MAJ'], ['', '']]),
      makeRankRow('O-3', [['Flying Officer', 'FLGOFF'], ['Lieutenant', 'LEUT'], ['Captain', 'CAPT'], ['', '']]),
      makeRankRow('O-2', [['Pilot Officer', 'PLTOFF'], ['Sub Lieutenant', 'SBLT'], ['Lieutenant', 'LT'], ['', '']]),
      makeRankRow('O-1', [['Officer Cadet', 'OFFCDT'], ['Midshipman', 'MIDN'], ['Officer Cadet', 'OFFCDT'], ['', '']]),
      makeRankRow('E-9', [['Warrant Officer', 'WOFF'], ['Warrant Officer', 'WO'], ['Warrant Officer Class One', 'WO1'], ['', '']]),
      makeRankRow('E-8', [['Flight Sergeant', 'FSGT'], ['Chief Petty Officer', 'CPO'], ['Warrant Officer Class Two', 'WO2'], ['', '']]),
      makeRankRow('E-7', [['Sergeant', 'SGT'], ['Petty Officer', 'PO'], ['Staff Sergeant', 'SSGT'], ['', '']]),
      makeRankRow('E-6', [['Corporal', 'CPL'], ['Leading Seaman', 'LS'], ['Sergeant', 'SGT'], ['', '']]),
      makeRankRow('E-5', [['Leading Aircraftman', 'LAC'], ['Able Seaman', 'AB'], ['Corporal', 'CPL'], ['', '']]),
      makeRankRow('E-4', [['Aircraftman', 'AC'], ['Seaman', 'SMN'], ['Private Proficient', 'PTE(P)'], ['', '']]),
      makeRankRow('E-3', [['Recruit', 'RCT'], ['Recruit', 'RCT'], ['Recruit', 'RCT'], ['', '']]),
      makeRankRow('E-2', [['', ''], ['', ''], ['', ''], ['', '']]),
      makeRankRow('E-1', [['', ''], ['', ''], ['', ''], ['', '']]),
    ],
  },
  US: {
    preset: 'US',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Marine Corps' }, { name: 'Army' }],
    rows: [
      makeRankRow('O-10', [['General of the Air Force', 'GOAF'], ['Admiral of the Navy', 'ADM'], ['General', 'Gen'], ['General', 'Gen']]),
      makeRankRow('O-9', [['General', 'GEN'], ['Fleet Admiral', 'ADM'], ['Lieutenant General', 'LtGen'], ['Lieutenant General', 'LtGen']]),
      makeRankRow('O-8', [['Lieutenant General', 'Lt Gen'], ['Admiral', 'Adm'], ['Major General', 'MajGen'], ['Major General', 'MajGen']]),
      makeRankRow('O-7', [['Major General', 'Maj Gen'], ['Vice Admiral', 'VAdm'], ['Brigadier General', 'BGen'], ['Brigadier General', 'BGen']]),
      makeRankRow('O-6', [['Brigadier General', 'Brig Gen'], ['Rear Admiral Upper Half', 'RAdm(U)'], ['Colonel', 'Col'], ['Colonel', 'Col']]),
      makeRankRow('O-5', [['Colonel', 'Col'], ['Rear Admiral Lower Half', 'RAdm(L)'], ['Lieutenant Colonel', 'LtCol'], ['Lieutenant Colonel', 'LtCol']]),
      makeRankRow('O-4', [['Lieutenant Colonel', 'Lt Col'], ['Captain', 'Capt'], ['Major', 'Maj'], ['Major', 'Maj']]),
      makeRankRow('O-3', [['Major', 'Maj'], ['Commander', 'Cmdr'], ['Captain', 'Capt'], ['Captain', 'Capt']]),
      makeRankRow('O-2', [['Captain', 'Capt'], ['Lieutenant Commander', 'LCDR'], ['First Lieutenant', '1stLt'], ['First Lieutenant', '1stLt']]),
      makeRankRow('O-1', [['First Lieutenant', '1st Lt'], ['Lieutenant', 'LT'], ['Second Lieutenant', '2ndLt'], ['Second Lieutenant', '2ndLt']]),
      makeRankRow('E-9', [['Chief Master Sergeant of the Air Force', 'CMSAF'], ['Master Chief Petty Officer of the Navy', 'MCPON'], ['Sergeant Major of the Marine Corps', 'SMMC'], ['Sergeant Major of the Army', 'SMA']]),
      makeRankRow('E-8', [['Chief Master Sergeant', 'CMSgt'], ['Master Chief Petty Officer', 'MCPO'], ['Sergeant Major', 'SgtMaj'], ['Command Sergeant Major', 'CSM']]),
      makeRankRow('E-7', [['Senior Master Sergeant', 'SMSgt'], ['Senior Chief Petty Officer', 'SCPO'], ['Master Gunnery Sergeant', 'MGySgt'], ['Sergeant Major', 'SgtMaj']]),
      makeRankRow('E-6', [['Master Sergeant', 'MSgt'], ['Chief Petty Officer', 'CPO'], ['First Sergeant', '1stSgt'], ['First Sergeant', '1SG']]),
      makeRankRow('E-5', [['Technical Sergeant', 'TSgt'], ['Petty Officer First Class', 'PO1'], ['Gunnery Sergeant', 'GySgt'], ['Master Sergeant', 'MSG']]),
      makeRankRow('E-4', [['Staff Sergeant', 'SSgt'], ['Petty Officer Second Class', 'PO2'], ['Staff Sergeant', 'SSgt'], ['Sergeant First Class', 'SFC']]),
      makeRankRow('E-3', [['Senior Airman', 'SrA'], ['Petty Officer Third Class', 'PO3'], ['Sergeant', 'Sgt'], ['Staff Sergeant', 'SSG']]),
      makeRankRow('E-2', [['Airman First Class', 'A1C'], ['Seaman', 'SN'], ['Corporal', 'Cpl'], ['Sergeant', 'Sgt']]),
      makeRankRow('E-1', [['Airman', 'Amn'], ['Seaman Apprentice', 'SA'], ['Lance Corporal', 'LCpl'], ['Private First Class', 'PFC']]),
    ],
  },
  CUSTOM: {
    preset: 'CUSTOM',
    services: [{ name: 'Service 1' }, { name: 'Service 2' }, { name: 'Service 3' }, { name: 'Service 4' }],
    rows: RANK_EQUIVALENCY_GRADES.map((grade) => makeRankRow(grade, [])),
  },
};

export const DEFAULT_RANK_EQUIVALENCY_CONFIG = RANK_EQUIVALENCY_PRESETS.AU;

export const DEFAULT_PERSONNEL_DISPLAY_SETTINGS: PersonnelDisplaySettings = {
  sortMode: 'rank-then-name',
  useSeparateTraineeRankOrder: false,
  staffRankOrder: DEFAULT_STAFF_RANK_ORDER,
  traineeRankOrder: DEFAULT_STAFF_RANK_ORDER,
  staffRankEquivalency: DEFAULT_RANK_EQUIVALENCY_CONFIG,
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

const normaliseRankEquivalencyCell = (cell?: Partial<RankEquivalencyCell> | null): RankEquivalencyCell => ({
  rank: String(cell?.rank || '').trim(),
  abbreviation: String(cell?.abbreviation || '').trim(),
});

export const normaliseRankEquivalencyConfig = (
  input?: Partial<RankEquivalencyConfig> | null,
  fallback: RankEquivalencyConfig = DEFAULT_RANK_EQUIVALENCY_CONFIG,
): RankEquivalencyConfig => {
  const preset = input?.preset === 'US' || input?.preset === 'CUSTOM' || input?.preset === 'AU'
    ? input.preset
    : fallback.preset;
  const fallbackConfig = preset === 'CUSTOM' ? fallback : RANK_EQUIVALENCY_PRESETS[preset];
  const rawServices = Array.isArray(input?.services) ? input!.services : fallbackConfig.services;
  const services = [0, 1, 2, 3].map((index) => ({
    name: String(rawServices[index]?.name || fallbackConfig.services[index]?.name || `Service ${index + 1}`).trim() || `Service ${index + 1}`,
  }));
  const rawRows = Array.isArray(input?.rows) ? input!.rows : fallbackConfig.rows;
  const rows = RANK_EQUIVALENCY_GRADES.map((grade) => {
    const sourceRow = rawRows.find((row) => String(row?.grade || '').trim().toUpperCase() === grade) || fallbackConfig.rows.find((row) => row.grade === grade);
    return {
      grade,
      ranks: [0, 1, 2, 3].map((index) => normaliseRankEquivalencyCell(sourceRow?.ranks?.[index])),
    };
  });
  return { preset, services, rows };
};

export const getRankOrderFromEquivalency = (config?: Partial<RankEquivalencyConfig> | null): string[] => {
  const normalised = normaliseRankEquivalencyConfig(config);
  const rankOrder = normalised.rows
    .map((row) => {
      const values = row.ranks.flatMap((cell) => [cell.abbreviation, cell.rank]);
      return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' = ');
    })
    .filter(Boolean);
  return groupLegacyCivilianRanks(uniqueRankList([...rankOrder, 'APS = Dr = Mr = Ms = Mrs = Mx = CIV = CONTRACTOR'], DEFAULT_STAFF_RANK_ORDER));
};

export const normalisePersonnelDisplaySettings = (input?: Partial<PersonnelDisplaySettings> | null): PersonnelDisplaySettings => {
  const staffRankEquivalency = normaliseRankEquivalencyConfig(input?.staffRankEquivalency, DEFAULT_RANK_EQUIVALENCY_CONFIG);
  const staffRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.staffRankOrder, getRankOrderFromEquivalency(staffRankEquivalency)));
  const traineeRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.traineeRankOrder, staffRankOrder));

  return {
    sortMode: input?.sortMode === 'alphabetical' ? 'alphabetical' : 'rank-then-name',
    useSeparateTraineeRankOrder: Boolean(input?.useSeparateTraineeRankOrder),
    staffRankOrder,
    traineeRankOrder,
    staffRankEquivalency,
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

export const flattenRankOrder = (rankOrder: string[] = []): string[] => {
  const seen = new Set<string>();
  return rankOrder
    .flatMap((entry) => splitRankGroup(entry))
    .map((rank) => rank.trim())
    .filter(Boolean)
    .filter((rank) => {
      const key = rankKey(rank);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getRankOptionsForGroup = (
  settings?: Partial<PersonnelDisplaySettings>,
  group: PersonnelGroup = 'staff',
): string[] => {
  const configuredRanks = flattenRankOrder(getRankOrderForGroup(settings, group));
  return configuredRanks.length ? configuredRanks : flattenRankOrder(DEFAULT_STAFF_RANK_ORDER);
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
