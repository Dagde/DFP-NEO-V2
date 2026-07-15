import type { PlatformConfig } from './platformConfigService';

export type PersonnelSortMode = 'rank-then-name' | 'alphabetical';
export type PersonnelGroup = 'staff' | 'trainee';
export type RankEquivalencyPresetKey = 'AU' | 'US' | 'UK' | 'FR' | 'CH' | 'ES' | 'SA' | 'AE' | 'CUSTOM';

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

export interface RankOptionGroup {
  label: string;
  options: string[];
}

export interface PersonnelDisplaySettings {
  sortMode: PersonnelSortMode;
  useSeparateTraineeRankOrder: boolean;
  staffRankOrder: string[];
  traineeRankOrder: string[];
  staffRankEquivalency: RankEquivalencyConfig;
  civilianTitles: string[];
  civilianContractorGroupName: string;
  instructorLabel: string;
  simIpDisplayEnabled: boolean;
  simIpDisplayLabel: string;
  contractorStaffEventEligibility: {
    flight: boolean;
    ftd: boolean;
    cpt: boolean;
    ground: boolean;
  };
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

export const DEFAULT_CIVILIAN_TITLES = ['APS', 'Dr', 'Mr', 'Ms', 'Mrs', 'Mx', 'CIV', 'CONTRACTOR'];

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

export const RANK_EQUIVALENCY_PRESET_LABELS: Record<RankEquivalencyPresetKey, string> = {
  AU: 'Australia',
  US: 'United States',
  UK: 'United Kingdom',
  FR: 'France',
  CH: 'Switzerland',
  ES: 'Spain',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  CUSTOM: 'Custom',
};

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
      makeRankRow('O-10', [['Air Chief Marshal', 'ACM'], ['Admiral', 'ADML'], ['General', 'GEN'], ['', '']]),
      makeRankRow('O-9', [['Air Marshal', 'AIRMSHL'], ['Vice Admiral', 'VADM'], ['Lieutenant General', 'LTGEN'], ['', '']]),
      makeRankRow('O-8', [['Air Vice-Marshal', 'AVM'], ['Rear Admiral', 'RADM'], ['Major General', 'MAJGEN'], ['', '']]),
      makeRankRow('O-7', [['Air Commodore', 'AIRCDRE'], ['Commodore', 'CDRE'], ['Brigadier', 'BRIG'], ['', '']]),
      makeRankRow('O-6', [['Group Captain', 'GPCAPT'], ['Captain', 'CAPT'], ['Colonel', 'COL'], ['', '']]),
      makeRankRow('O-5', [['Wing Commander', 'WGCDR'], ['Commander', 'CMDR'], ['Lieutenant Colonel', 'LTCOL'], ['', '']]),
      makeRankRow('O-4', [['Squadron Leader', 'SQNLDR'], ['Lieutenant Commander', 'LCDR'], ['Major', 'MAJ'], ['', '']]),
      makeRankRow('O-3', [['Flight Lieutenant', 'FLTLT'], ['Lieutenant', 'LEUT'], ['Captain', 'CAPT'], ['', '']]),
      makeRankRow('O-2', [['Flying Officer', 'FLGOFF'], ['Sub Lieutenant', 'SBLT'], ['Lieutenant', 'LT'], ['', '']]),
      makeRankRow('O-1', [['Pilot Officer', 'PLTOFF'], ['Acting Sub Lieutenant', 'ASLT'], ['Second Lieutenant', '2LT'], ['', '']]),
      makeRankRow('E-9', [['Warrant Officer', 'WOFF'], ['Warrant Officer', 'WO'], ['Warrant Officer Class One', 'WO1'], ['', '']]),
      makeRankRow('E-8', [['Flight Sergeant', 'FSGT'], ['Chief Petty Officer', 'CPO'], ['Warrant Officer Class Two', 'WO2'], ['', '']]),
      makeRankRow('E-7', [['Sergeant', 'SGT'], ['Petty Officer', 'PO'], ['Staff Sergeant', 'SSGT'], ['', '']]),
      makeRankRow('E-6', [['Sergeant', 'SGT'], ['Petty Officer', 'PO'], ['Sergeant', 'SGT'], ['', '']]),
      makeRankRow('E-5', [['Corporal', 'CPL'], ['Leading Seaman', 'LS'], ['Corporal', 'CPL'], ['', '']]),
      makeRankRow('E-4', [['Leading Aircraftman', 'LAC'], ['Able Seaman', 'AB'], ['Lance Corporal', 'LCPL'], ['', '']]),
      makeRankRow('E-3', [['Leading Aircraftman', 'LAC'], ['Able Seaman', 'AB'], ['Private Proficient', 'PTE(P)'], ['', '']]),
      makeRankRow('E-2', [['Aircraftman', 'AC'], ['Seaman', 'SMN'], ['Private', 'PTE'], ['', '']]),
      makeRankRow('E-1', [['Aircraftman Recruit', 'AC(R)'], ['Recruit', 'REC'], ['Recruit', 'REC'], ['', '']]),
    ],
  },
  US: {
    preset: 'US',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General', 'Gen'], ['Admiral', 'ADM'], ['General', 'GEN'], ['General', 'Gen']]),
      makeRankRow('O-9', [['Lieutenant General', 'Lt Gen'], ['Vice Admiral', 'VADM'], ['Lieutenant General', 'LTG'], ['Lieutenant General', 'LtGen']]),
      makeRankRow('O-8', [['Major General', 'Maj Gen'], ['Rear Admiral', 'RADM'], ['Major General', 'MG'], ['Major General', 'MajGen']]),
      makeRankRow('O-7', [['Brigadier General', 'Brig Gen'], ['Rear Admiral Lower Half', 'RDML'], ['Brigadier General', 'BG'], ['Brigadier General', 'BGen']]),
      makeRankRow('O-6', [['Colonel', 'Col'], ['Captain', 'CAPT'], ['Colonel', 'COL'], ['Colonel', 'Col']]),
      makeRankRow('O-5', [['Lieutenant Colonel', 'Lt Col'], ['Commander', 'CDR'], ['Lieutenant Colonel', 'LTC'], ['Lieutenant Colonel', 'LtCol']]),
      makeRankRow('O-4', [['Major', 'Maj'], ['Lieutenant Commander', 'LCDR'], ['Major', 'MAJ'], ['Major', 'Maj']]),
      makeRankRow('O-3', [['Captain', 'Capt'], ['Lieutenant', 'LT'], ['Captain', 'CPT'], ['Captain', 'Capt']]),
      makeRankRow('O-2', [['First Lieutenant', '1st Lt'], ['Lieutenant Junior Grade', 'LTJG'], ['First Lieutenant', '1LT'], ['First Lieutenant', '1stLt']]),
      makeRankRow('O-1', [['Second Lieutenant', '2d Lt'], ['Ensign', 'ENS'], ['Second Lieutenant', '2LT'], ['Second Lieutenant', '2ndLt']]),
      makeRankRow('E-9', [['Chief Master Sergeant', 'CMSgt'], ['Master Chief Petty Officer', 'MCPO'], ['Sergeant Major', 'SGM'], ['Sergeant Major', 'SgtMaj']]),
      makeRankRow('E-8', [['Senior Master Sergeant', 'SMSgt'], ['Senior Chief Petty Officer', 'SCPO'], ['Master Sergeant', 'MSG'], ['Master Sergeant', 'MSgt']]),
      makeRankRow('E-7', [['Master Sergeant', 'MSgt'], ['Chief Petty Officer', 'CPO'], ['Sergeant First Class', 'SFC'], ['Gunnery Sergeant', 'GySgt']]),
      makeRankRow('E-6', [['Technical Sergeant', 'TSgt'], ['Petty Officer First Class', 'PO1'], ['Staff Sergeant', 'SSG'], ['Staff Sergeant', 'SSgt']]),
      makeRankRow('E-5', [['Staff Sergeant', 'SSgt'], ['Petty Officer Second Class', 'PO2'], ['Sergeant', 'SGT'], ['Sergeant', 'Sgt']]),
      makeRankRow('E-4', [['Senior Airman', 'SrA'], ['Petty Officer Third Class', 'PO3'], ['Corporal', 'CPL'], ['Corporal', 'Cpl']]),
      makeRankRow('E-3', [['Airman First Class', 'A1C'], ['Seaman', 'SN'], ['Private First Class', 'PFC'], ['Lance Corporal', 'LCpl']]),
      makeRankRow('E-2', [['Airman', 'Amn'], ['Seaman Apprentice', 'SA'], ['Private Second Class', 'PV2'], ['Private First Class', 'PFC']]),
      makeRankRow('E-1', [['Airman Basic', 'AB'], ['Seaman Recruit', 'SR'], ['Private', 'PVT'], ['Private', 'Pvt']]),
    ],
  },
  UK: {
    preset: 'UK',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['Marshal of the Royal Air Force', 'MRAF'], ['Admiral of the Fleet', 'AF'], ['Field Marshal', 'FM'], ['General', 'Gen']]),
      makeRankRow('O-9', [['Air Chief Marshal', 'ACM'], ['Admiral', 'Adm'], ['General', 'Gen'], ['Lieutenant General', 'Lt Gen']]),
      makeRankRow('O-8', [['Air Marshal', 'AM'], ['Vice Admiral', 'VAdm'], ['Lieutenant General', 'Lt Gen'], ['Major General', 'Maj Gen']]),
      makeRankRow('O-7', [['Air Vice-Marshal', 'AVM'], ['Rear Admiral', 'RAdm'], ['Major General', 'Maj Gen'], ['Brigadier', 'Brig']]),
      makeRankRow('O-6', [['Air Commodore', 'Air Cdre'], ['Commodore', 'Cdre'], ['Brigadier', 'Brig'], ['Colonel', 'Col']]),
      makeRankRow('O-5', [['Group Captain', 'Gp Capt'], ['Captain', 'Capt'], ['Colonel', 'Col'], ['Lieutenant Colonel', 'Lt Col']]),
      makeRankRow('O-4', [['Wing Commander', 'Wg Cdr'], ['Commander', 'Cdr'], ['Lieutenant Colonel', 'Lt Col'], ['Major', 'Maj']]),
      makeRankRow('O-3', [['Squadron Leader', 'Sqn Ldr'], ['Lieutenant Commander', 'Lt Cdr'], ['Major', 'Maj'], ['Captain', 'Capt']]),
      makeRankRow('O-2', [['Flight Lieutenant', 'Flt Lt'], ['Lieutenant', 'Lt'], ['Captain', 'Capt'], ['Lieutenant', 'Lt']]),
      makeRankRow('O-1', [['Flying Officer', 'Fg Off'], ['Sub Lieutenant', 'SLt'], ['Lieutenant', 'Lt'], ['Second Lieutenant', '2Lt']]),
      makeRankRow('E-9', [['Warrant Officer', 'WO'], ['Warrant Officer Class One', 'WO1'], ['Warrant Officer Class One', 'WO1'], ['Warrant Officer Class One', 'WO1']]),
      makeRankRow('E-8', [['Flight Sergeant', 'FS'], ['Warrant Officer Class Two', 'WO2'], ['Warrant Officer Class Two', 'WO2'], ['Warrant Officer Class Two', 'WO2']]),
      makeRankRow('E-7', [['Chief Technician', 'Chf Tech'], ['Chief Petty Officer', 'CPO'], ['Staff Sergeant', 'SSgt'], ['Colour Sergeant', 'CSgt']]),
      makeRankRow('E-6', [['Sergeant', 'Sgt'], ['Petty Officer', 'PO'], ['Sergeant', 'Sgt'], ['Sergeant', 'Sgt']]),
      makeRankRow('E-5', [['Corporal', 'Cpl'], ['Leading Hand', 'LH'], ['Corporal', 'Cpl'], ['Corporal', 'Cpl']]),
      makeRankRow('E-4', [['Corporal', 'Cpl'], ['Able Seaman', 'AB'], ['Lance Corporal', 'LCpl'], ['Lance Corporal', 'LCpl']]),
      makeRankRow('E-3', [['Senior Aircraftman Technician', 'SAC(T)'], ['Able Seaman', 'AB'], ['Private', 'Pte'], ['Marine', 'Mne']]),
      makeRankRow('E-2', [['Senior Aircraftman', 'SAC'], ['Able Seaman', 'AB'], ['Private', 'Pte'], ['Marine', 'Mne']]),
      makeRankRow('E-1', [['Aircraftman', 'AC'], ['Able Seaman', 'AB'], ['Private', 'Pte'], ['Marine', 'Mne']]),
    ],
  },
  FR: {
    preset: 'FR',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General d armee aerienne', 'GAA'], ['Amiral', 'AM'], ['General d armee', 'GA'], ['', '']]),
      makeRankRow('O-9', [['General de corps aerien', 'GCA'], ['Vice-amiral d escadre', 'VAE'], ['General de corps d armee', 'GCA'], ['', '']]),
      makeRankRow('O-8', [['General de division aerienne', 'GDA'], ['Vice-amiral', 'VA'], ['General de division', 'GDI'], ['', '']]),
      makeRankRow('O-7', [['General de brigade aerienne', 'GBA'], ['Contre-amiral', 'CA'], ['General de brigade', 'GBR'], ['', '']]),
      makeRankRow('O-6', [['Colonel', 'COL'], ['Capitaine de vaisseau', 'CV'], ['Colonel', 'COL'], ['', '']]),
      makeRankRow('O-5', [['Lieutenant-colonel', 'LCL'], ['Capitaine de fregate', 'CF'], ['Lieutenant-colonel', 'LCL'], ['', '']]),
      makeRankRow('O-4', [['Commandant', 'CDT'], ['Capitaine de corvette', 'CC'], ['Chef de bataillon', 'CBA'], ['', '']]),
      makeRankRow('O-3', [['Capitaine', 'CNE'], ['Lieutenant de vaisseau', 'LV'], ['Capitaine', 'CNE'], ['', '']]),
      makeRankRow('O-2', [['Lieutenant', 'LTN'], ['Enseigne de vaisseau de 1re classe', 'EV1'], ['Lieutenant', 'LTN'], ['', '']]),
      makeRankRow('O-1', [['Sous-lieutenant', 'SLT'], ['Enseigne de vaisseau de 2e classe', 'EV2'], ['Sous-lieutenant', 'SLT'], ['', '']]),
      makeRankRow('E-9', [['Major', 'MAJ'], ['Major', 'MAJ'], ['Major', 'MAJ'], ['', '']]),
      makeRankRow('E-8', [['Adjudant-chef', 'ADC'], ['Premier maitre', 'PM'], ['Adjudant-chef', 'ADC'], ['', '']]),
      makeRankRow('E-7', [['Adjudant', 'ADJ'], ['Maitre principal', 'MP'], ['Adjudant', 'ADJ'], ['', '']]),
      makeRankRow('E-6', [['Sergent-chef', 'SGT-C'], ['Second maitre', 'SM'], ['Marechal des logis-chef', 'SCH'], ['', '']]),
      makeRankRow('E-5', [['Sergent', 'SGT'], ['Quartier-maitre de 1re classe', 'QM1'], ['Sergent', 'SGT'], ['', '']]),
      makeRankRow('E-4', [['Caporal-chef', 'CCH'], ['Quartier-maitre de 2e classe', 'QM2'], ['Caporal-chef', 'CCH'], ['', '']]),
      makeRankRow('E-3', [['Caporal', 'CAL'], ['Matelot', 'MT'], ['Caporal', 'CPL'], ['', '']]),
      makeRankRow('E-2', [['Aviateur de 1re classe', 'AV1'], ['Matelot', 'MOT'], ['Soldat de 1re classe', '1CL'], ['', '']]),
      makeRankRow('E-1', [['Aviateur de 2e classe', 'AV2'], ['Matelot', 'MOT'], ['Soldat de 2e classe', '2CL'], ['', '']]),
    ],
  },
  CH: {
    preset: 'CH',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General', 'Gen'], ['', ''], ['General', 'Gen'], ['', '']]),
      makeRankRow('O-9', [['Corps Commander', 'Korpskdt'], ['', ''], ['Corps Commander', 'Korpskdt'], ['', '']]),
      makeRankRow('O-8', [['Division Commander', 'Div'], ['', ''], ['Division Commander', 'Div'], ['', '']]),
      makeRankRow('O-7', [['Brigadier', 'Brig'], ['', ''], ['Brigadier', 'Brig'], ['', '']]),
      makeRankRow('O-6', [['Colonel', 'Oberst'], ['', ''], ['Colonel', 'Oberst'], ['', '']]),
      makeRankRow('O-5', [['Lieutenant Colonel', 'Oberstlt'], ['', ''], ['Lieutenant Colonel', 'Oberstlt'], ['', '']]),
      makeRankRow('O-4', [['Major', 'Maj'], ['', ''], ['Major', 'Maj'], ['', '']]),
      makeRankRow('O-3', [['Captain', 'Hptm'], ['', ''], ['Captain', 'Hptm'], ['', '']]),
      makeRankRow('O-2', [['First Lieutenant', 'Oblt'], ['', ''], ['First Lieutenant', 'Oblt'], ['', '']]),
      makeRankRow('O-1', [['Lieutenant', 'Lt'], ['', ''], ['Lieutenant', 'Lt'], ['', '']]),
      makeRankRow('E-9', [['Chief Warrant Officer', 'Chefadj'], ['', ''], ['Chief Warrant Officer', 'Chefadj'], ['', '']]),
      makeRankRow('E-8', [['Master Warrant Officer', 'Hptadj'], ['', ''], ['Master Warrant Officer', 'Hptadj'], ['', '']]),
      makeRankRow('E-7', [['Staff Warrant Officer', 'Stabsadj'], ['', ''], ['Staff Warrant Officer', 'Stabsadj'], ['', '']]),
      makeRankRow('E-6', [['Warrant Officer', 'Adj Uof'], ['', ''], ['Warrant Officer', 'Adj Uof'], ['', '']]),
      makeRankRow('E-5', [['Chief Sergeant Major', 'Hptfw'], ['', ''], ['Chief Sergeant Major', 'Hptfw'], ['', '']]),
      makeRankRow('E-4', [['Quartermaster Sergeant', 'Four'], ['', ''], ['Quartermaster Sergeant', 'Four'], ['', '']]),
      makeRankRow('E-3', [['Sergeant', 'Wm'], ['', ''], ['Sergeant', 'Wm'], ['', '']]),
      makeRankRow('E-2', [['Lance Corporal', 'Obgfr'], ['', ''], ['Lance Corporal', 'Obgfr'], ['', '']]),
      makeRankRow('E-1', [['Soldier', 'Sdt'], ['', ''], ['Soldier', 'Sdt'], ['', '']]),
    ],
  },
  ES: {
    preset: 'ES',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General del Aire', 'GDA'], ['Almirante general', 'AJ'], ['General de Ejercito', 'GE'], ['General del Aire', 'GDA']]),
      makeRankRow('O-9', [['Teniente general', 'TGA'], ['Almirante general', 'AG'], ['Teniente general', 'TGE'], ['Teniente general', 'TGA']]),
      makeRankRow('O-8', [['General de division', 'GDA'], ['Vicealmirante', 'VALM'], ['General de division', 'GDI'], ['General de division', 'GDI']]),
      makeRankRow('O-7', [['General de brigada', 'GBA'], ['Contralmirante', 'CALM'], ['General de brigada', 'GBR'], ['General de brigada', 'GBR']]),
      makeRankRow('O-6', [['Coronel', 'COL'], ['Capitan de navio', 'CN'], ['Coronel', 'COL'], ['Coronel', 'COL']]),
      makeRankRow('O-5', [['Teniente coronel', 'TCO'], ['Capitan de fragata', 'CF'], ['Teniente coronel', 'TCO'], ['Teniente coronel', 'TCO']]),
      makeRankRow('O-4', [['Comandante', 'CTE'], ['Capitan de corbeta', 'CC'], ['Comandante', 'CTE'], ['Comandante', 'CTE']]),
      makeRankRow('O-3', [['Capitan', 'CAP'], ['Teniente de navio', 'TN'], ['Capitan', 'CAP'], ['Capitan', 'CAP']]),
      makeRankRow('O-2', [['Teniente', 'TTE'], ['Alferez de navio', 'AN'], ['Teniente', 'TTE'], ['Teniente', 'TTE']]),
      makeRankRow('O-1', [['Alferez', 'ALF'], ['Alferez de fragata', 'AF'], ['Alferez', 'ALF'], ['Alferez', 'ALF']]),
      makeRankRow('E-9', [['Subteniente mayor', 'STMY'], ['Suboficial mayor', 'SBMY'], ['Subteniente mayor', 'STMY'], ['Subteniente mayor', 'STMY']]),
      makeRankRow('E-8', [['Subteniente brigada', 'SBG'], ['Subteniente brigada', 'SBG'], ['Subteniente brigada', 'SBG'], ['Subteniente brigada', 'SBG']]),
      makeRankRow('E-7', [['Brigada', 'BG'], ['Brigada', 'BG'], ['Brigada', 'BG'], ['Brigada', 'BG']]),
      makeRankRow('E-6', [['Sargento primero', 'SG1'], ['Sargento primero', 'SG1'], ['Sargento primero', 'SG1'], ['Sargento primero', 'SG1']]),
      makeRankRow('E-5', [['Sargento', 'SGT'], ['Sargento', 'SGT'], ['Sargento', 'SGT'], ['Sargento', 'SGT']]),
      makeRankRow('E-4', [['Cabo primero', 'CB1'], ['Cabo primero', 'CB1'], ['Cabo primero', 'CB1'], ['Cabo primero', 'CB1']]),
      makeRankRow('E-3', [['Cabo', 'CBO'], ['Cabo', 'CBO'], ['Cabo', 'CBO'], ['Cabo', 'CBO']]),
      makeRankRow('E-2', [['Soldado de aviacion', 'SDA'], ['Marinero', 'MRO'], ['Soldado', 'SLD'], ['Soldado', 'SLD']]),
      makeRankRow('E-1', [['Alumno', 'ALU'], ['Marinero', 'MR'], ['Soldado', 'SLD'], ['Soldado', 'SLD']]),
    ],
  },
  SA: {
    preset: 'SA',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General', 'GEN'], ['Admiral', 'ADM'], ['General', 'GEN'], ['General', 'GEN']]),
      makeRankRow('O-9', [['Lieutenant General', 'LTGEN'], ['Vice Admiral', 'VADM'], ['Lieutenant General', 'LTGEN'], ['Lieutenant General', 'LTGEN']]),
      makeRankRow('O-8', [['Major General', 'MAJGEN'], ['Rear Admiral', 'RADM'], ['Major General', 'MAJGEN'], ['Major General', 'MAJGEN']]),
      makeRankRow('O-7', [['Brigadier General', 'BRIG'], ['Commodore', 'CDRE'], ['Brigadier General', 'BRIG'], ['Brigadier General', 'BRIG']]),
      makeRankRow('O-6', [['Colonel', 'COL'], ['Captain', 'CAPT'], ['Colonel', 'COL'], ['Colonel', 'COL']]),
      makeRankRow('O-5', [['Lieutenant Colonel', 'LTCOL'], ['Commander', 'CDR'], ['Lieutenant Colonel', 'LTCOL'], ['Lieutenant Colonel', 'LTCOL']]),
      makeRankRow('O-4', [['Major', 'MAJ'], ['Lieutenant Commander', 'LCDR'], ['Major', 'MAJ'], ['Major', 'MAJ']]),
      makeRankRow('O-3', [['Captain', 'CAPT'], ['Lieutenant', 'LT'], ['Captain', 'CAPT'], ['Captain', 'CAPT']]),
      makeRankRow('O-2', [['First Lieutenant', '1LT'], ['Sub Lieutenant', 'SLT'], ['First Lieutenant', '1LT'], ['First Lieutenant', '1LT']]),
      makeRankRow('O-1', [['Second Lieutenant', '2LT'], ['Ensign', 'ENS'], ['Second Lieutenant', '2LT'], ['Second Lieutenant', '2LT']]),
      makeRankRow('E-9', [['Chief Warrant Officer', 'CWO'], ['Chief Petty Officer', 'CPO'], ['Chief Warrant Officer', 'CWO'], ['Chief Warrant Officer', 'CWO']]),
      makeRankRow('E-8', [['Warrant Officer', 'WO'], ['Petty Officer First Class', 'PO1'], ['Warrant Officer', 'WO'], ['Warrant Officer', 'WO']]),
      makeRankRow('E-7', [['Master Sergeant', 'MSGT'], ['Petty Officer Second Class', 'PO2'], ['Master Sergeant', 'MSGT'], ['Master Sergeant', 'MSGT']]),
      makeRankRow('E-6', [['Sergeant First Class', 'SGT1'], ['Petty Officer Third Class', 'PO3'], ['Sergeant First Class', 'SGT1'], ['Sergeant First Class', 'SGT1']]),
      makeRankRow('E-5', [['Sergeant', 'SGT'], ['Leading Seaman', 'LS'], ['Sergeant', 'SGT'], ['Sergeant', 'SGT']]),
      makeRankRow('E-4', [['Corporal', 'CPL'], ['Able Seaman', 'AB'], ['Corporal', 'CPL'], ['Corporal', 'CPL']]),
      makeRankRow('E-3', [['Lance Corporal', 'LCPL'], ['Seaman', 'SN'], ['Lance Corporal', 'LCPL'], ['Lance Corporal', 'LCPL']]),
      makeRankRow('E-2', [['Private First Class', 'PFC'], ['Seaman Apprentice', 'SA'], ['Private First Class', 'PFC'], ['Private First Class', 'PFC']]),
      makeRankRow('E-1', [['Private', 'PVT'], ['Seaman Recruit', 'SR'], ['Private', 'PVT'], ['Private', 'PVT']]),
    ],
  },
  AE: {
    preset: 'AE',
    services: [{ name: 'Air Force' }, { name: 'Navy' }, { name: 'Army' }, { name: 'Marines' }],
    rows: [
      makeRankRow('O-10', [['General', 'GEN'], ['Admiral', 'ADM'], ['General', 'GEN'], ['', '']]),
      makeRankRow('O-9', [['Lieutenant General', 'LTGEN'], ['Vice Admiral', 'VADM'], ['Lieutenant General', 'LTGEN'], ['', '']]),
      makeRankRow('O-8', [['Major General', 'MAJGEN'], ['Rear Admiral', 'RADM'], ['Major General', 'MAJGEN'], ['', '']]),
      makeRankRow('O-7', [['Brigadier General', 'BRIG'], ['Commodore', 'CDRE'], ['Brigadier General', 'BRIG'], ['', '']]),
      makeRankRow('O-6', [['Colonel', 'COL'], ['Captain', 'CAPT'], ['Colonel', 'COL'], ['', '']]),
      makeRankRow('O-5', [['Lieutenant Colonel', 'LTCOL'], ['Commander', 'CDR'], ['Lieutenant Colonel', 'LTCOL'], ['', '']]),
      makeRankRow('O-4', [['Major', 'MAJ'], ['Lieutenant Commander', 'LCDR'], ['Major', 'MAJ'], ['', '']]),
      makeRankRow('O-3', [['Captain', 'CAPT'], ['Lieutenant', 'LT'], ['Captain', 'CAPT'], ['', '']]),
      makeRankRow('O-2', [['First Lieutenant', '1LT'], ['Sub Lieutenant', 'SLT'], ['First Lieutenant', '1LT'], ['', '']]),
      makeRankRow('O-1', [['Second Lieutenant', '2LT'], ['Ensign', 'ENS'], ['Second Lieutenant', '2LT'], ['', '']]),
      makeRankRow('E-9', [['Chief Warrant Officer', 'CWO'], ['Chief Petty Officer', 'CPO'], ['Chief Warrant Officer', 'CWO'], ['', '']]),
      makeRankRow('E-8', [['Warrant Officer', 'WO'], ['Petty Officer First Class', 'PO1'], ['Warrant Officer', 'WO'], ['', '']]),
      makeRankRow('E-7', [['Master Sergeant', 'MSGT'], ['Petty Officer Second Class', 'PO2'], ['Master Sergeant', 'MSGT'], ['', '']]),
      makeRankRow('E-6', [['Sergeant First Class', 'SGT1'], ['Petty Officer Third Class', 'PO3'], ['Sergeant First Class', 'SGT1'], ['', '']]),
      makeRankRow('E-5', [['Sergeant', 'SGT'], ['Leading Seaman', 'LS'], ['Sergeant', 'SGT'], ['', '']]),
      makeRankRow('E-4', [['Corporal', 'CPL'], ['Able Seaman', 'AB'], ['Corporal', 'CPL'], ['', '']]),
      makeRankRow('E-3', [['Lance Corporal', 'LCPL'], ['Seaman', 'SN'], ['Lance Corporal', 'LCPL'], ['', '']]),
      makeRankRow('E-2', [['Private First Class', 'PFC'], ['Seaman Apprentice', 'SA'], ['Private First Class', 'PFC'], ['', '']]),
      makeRankRow('E-1', [['Private', 'PVT'], ['Seaman Recruit', 'SR'], ['Private', 'PVT'], ['', '']]),
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
  civilianTitles: DEFAULT_CIVILIAN_TITLES,
  civilianContractorGroupName: 'Civilian Contractors',
  instructorLabel: 'QFI',
  simIpDisplayEnabled: true,
  simIpDisplayLabel: 'Contractor Staff',
  contractorStaffEventEligibility: {
    flight: false,
    ftd: true,
    cpt: false,
    ground: false,
  },
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

const normaliseCivilianTitles = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : DEFAULT_CIVILIAN_TITLES;
  const seen = new Set<string>();
  const titles = source
    .flatMap((entry) => String(entry || '').split(/[=|]/))
    .filter((entry) => String(entry || '').trim())
    .filter((entry) => {
      const key = rankKey(entry);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return titles.length ? titles : DEFAULT_CIVILIAN_TITLES;
};

const CIVILIAN_EQUAL_RANK_KEYS = new Set(DEFAULT_CIVILIAN_TITLES.map(rankKey));

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
  rank: String(cell?.rank || ''),
  abbreviation: String(cell?.abbreviation || ''),
});

export const normaliseRankEquivalencyConfig = (
  input?: Partial<RankEquivalencyConfig> | null,
  fallback: RankEquivalencyConfig = DEFAULT_RANK_EQUIVALENCY_CONFIG,
): RankEquivalencyConfig => {
  const preset = input?.preset && input.preset in RANK_EQUIVALENCY_PRESETS
    ? input.preset
    : fallback.preset;
  const fallbackConfig = preset === 'CUSTOM' ? fallback : RANK_EQUIVALENCY_PRESETS[preset];
  const rawServices = Array.isArray(input?.services) ? input!.services : fallbackConfig.services;
  const services = [0, 1, 2, 3].map((index) => ({
    name: rawServices[index]?.name !== undefined && rawServices[index]?.name !== null
      ? String(rawServices[index]?.name)
      : String(fallbackConfig.services[index]?.name || `Service ${index + 1}`),
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
  const civilianTitles = normaliseCivilianTitles((config as any)?.civilianTitles);
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
  const civilianGroup = civilianTitles.join(' = ');
  return groupLegacyCivilianRanks(uniqueRankList([...rankOrder, civilianGroup], DEFAULT_STAFF_RANK_ORDER));
};

export const normalisePersonnelDisplaySettings = (input?: Partial<PersonnelDisplaySettings> | null): PersonnelDisplaySettings => {
  const staffRankEquivalency = normaliseRankEquivalencyConfig(input?.staffRankEquivalency, DEFAULT_RANK_EQUIVALENCY_CONFIG);
  const civilianTitles = normaliseCivilianTitles(input?.civilianTitles || (input as any)?.civilianRankTitles);
  const staffRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.staffRankOrder, getRankOrderFromEquivalency({ ...staffRankEquivalency, civilianTitles } as any)));
  const traineeRankOrder = groupLegacyCivilianRanks(uniqueRankList(input?.traineeRankOrder, staffRankOrder));
  const simIpDisplayLabel = String(input?.simIpDisplayLabel || '').trim() || DEFAULT_PERSONNEL_DISPLAY_SETTINGS.simIpDisplayLabel;
  const contractorStaffEventEligibility = {
    ...DEFAULT_PERSONNEL_DISPLAY_SETTINGS.contractorStaffEventEligibility,
    ...(input?.contractorStaffEventEligibility || {}),
  };

  return {
    sortMode: input?.sortMode === 'alphabetical' ? 'alphabetical' : 'rank-then-name',
    useSeparateTraineeRankOrder: Boolean(input?.useSeparateTraineeRankOrder),
    staffRankOrder,
    traineeRankOrder,
    staffRankEquivalency,
    civilianTitles,
    civilianContractorGroupName: String(input?.civilianContractorGroupName || '').trim() || DEFAULT_PERSONNEL_DISPLAY_SETTINGS.civilianContractorGroupName,
    instructorLabel: String(input?.instructorLabel || '').trim() || DEFAULT_PERSONNEL_DISPLAY_SETTINGS.instructorLabel,
    simIpDisplayEnabled: input?.simIpDisplayEnabled !== false,
    simIpDisplayLabel,
    contractorStaffEventEligibility: {
      flight: Boolean(contractorStaffEventEligibility.flight),
      ftd: Boolean(contractorStaffEventEligibility.ftd),
      cpt: Boolean(contractorStaffEventEligibility.cpt),
      ground: Boolean(contractorStaffEventEligibility.ground),
    },
  };
};

export const getSimIpDisplayLabel = (settings?: Partial<PersonnelDisplaySettings> | null): string => {
  const normalised = normalisePersonnelDisplaySettings(settings);
  return normalised.simIpDisplayLabel;
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

export const getRankOptionGroupsForGroup = (
  settings?: Partial<PersonnelDisplaySettings>,
  group: PersonnelGroup = 'staff',
): RankOptionGroup[] => {
  const safe = normalisePersonnelDisplaySettings(settings);
  if (group === 'trainee' && safe.useSeparateTraineeRankOrder) {
    const traineeOptions = getRankOptionsForGroup(safe, 'trainee');
    return traineeOptions.length ? [{ label: 'Trainee ranks', options: traineeOptions }] : [];
  }

  const seen = new Set<string>();
  const groups = safe.staffRankEquivalency.services
    .map((service, serviceIndex) => {
      const options = safe.staffRankEquivalency.rows
        .map((row) => String(row.ranks[serviceIndex]?.abbreviation || '').trim())
        .filter(Boolean)
        .filter((option) => {
          const key = rankKey(option);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return {
        label: String(service.name || `Service ${serviceIndex + 1}`).trim() || `Service ${serviceIndex + 1}`,
        options,
      };
    })
    .filter((rankGroup) => rankGroup.options.length > 0);

  const civilianOptions = safe.civilianTitles
    .map((title) => String(title || '').trim())
    .filter(Boolean)
    .filter((title) => {
      const key = rankKey(title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (civilianOptions.length) groups.push({ label: 'Civilian titles', options: civilianOptions });

  return groups.length ? groups : [{ label: 'Ranks', options: getRankOptionsForGroup(safe, group) }];
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
