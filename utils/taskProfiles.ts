import {
  DEFAULT_OPERATIONAL_MODEL,
  OPERATIONAL_MODEL_OPTIONS,
  normaliseOperationalModel,
  type OperationalModelCode,
  type PlatformConfig,
} from './platformConfigService';

export type TaskProfileConfig = Record<OperationalModelCode, string[]>;
export type TaskProfileAbbreviationConfig = Record<OperationalModelCode, Record<string, string>>;

export const DEFAULT_TASK_PROFILE_CONFIG: TaskProfileConfig = {
  flight_school: [
    'Transit',
    'Ferry',
    'Display',
    'Fly Past',
  ],
  air_combat: [
    'Air Defence Alert',
    'Offensive Counter Air',
    'Defensive Counter Air',
    'Close Air Support',
    'Surface Attack',
    'Maritime Strike',
    'Strategic Strike',
    'Armed Reconnaissance',
    'Combat Air Patrol',
    'Composite Air Operation',
  ],
  fixed_crew: [
    'Maritime Patrol',
    'Airborne Early Warning & Control',
    'Intelligence, Surveillance & Reconnaissance (ISR)',
    'Electronic Surveillance',
    'Anti-Submarine Warfare',
    'Anti-Surface Warfare',
    'Battle Management',
    'Communications Relay',
    'Border Security Patrol',
    'Search and Rescue Coordination',
  ],
  pooled_crew: [
    'Maritime Patrol',
    'Airborne Early Warning & Control',
    'Intelligence, Surveillance & Reconnaissance (ISR)',
    'Electronic Surveillance',
    'Anti-Submarine Warfare',
    'Anti-Surface Warfare',
    'Battle Management',
    'Communications Relay',
    'Border Security Patrol',
    'Search and Rescue Coordination',
  ],
};

export const DEFAULT_TASK_PROFILE_ABBREVIATIONS: TaskProfileAbbreviationConfig = {
  flight_school: {},
  air_combat: {},
  fixed_crew: {},
  pooled_crew: {},
};

const uniqueProfiles = (profiles: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  profiles.forEach((profile) => {
    const value = String(profile || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
};

const getTaskProfileSettingAliases = (option: { value: OperationalModelCode; label: string }): string[] => {
  const aliases = [
    option.value,
    option.label,
    option.label.replace(/\s+Model$/i, ''),
  ];
  if (option.value === 'pooled_crew') {
    aliases.push('air_mobility', 'Air Mobility Model', 'Air Mobility');
  }
  return aliases;
};

export const parseTaskProfileText = (text: string): string[] => {
  const sourceText = String(text || '');
  const separator = sourceText.includes('\n') ? /\r?\n/ : /[,;]+/;
  return uniqueProfiles(sourceText.split(separator));
};

export const formatTaskProfileText = (profiles: string[]): string => (
  uniqueProfiles(profiles).join('\n')
);

export const parseTaskProfileAbbreviationText = (text: string): Record<string, string> => {
  const abbreviations: Record<string, string> = {};
  String(text || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const separator = trimmed.includes('=') ? '=' : '-';
    const separatorIndex = trimmed.indexOf(separator);
    if (separatorIndex < 0) {
      abbreviations[trimmed] = '';
      return;
    }
    const profile = trimmed.slice(0, separatorIndex).trim();
    const abbreviation = trimmed.slice(separatorIndex + 1).trim();
    if (!profile) return;
    abbreviations[profile] = abbreviation;
  });
  return abbreviations;
};

export const formatTaskProfileAbbreviationText = (abbreviations: Record<string, string>): string => (
  Object.entries(abbreviations || {})
    .filter(([profile]) => String(profile || '').trim())
    .map(([profile, abbreviation]) => {
      const cleanProfile = String(profile || '').trim();
      const cleanAbbreviation = String(abbreviation || '').trim();
      return cleanAbbreviation ? `${cleanProfile} - ${cleanAbbreviation}` : cleanProfile;
    })
    .join('\n')
);

export const normaliseTaskProfileConfig = (value: unknown): TaskProfileConfig => {
  const hasSavedConfig = !!value && typeof value === 'object' && !Array.isArray(value);
  const source = hasSavedConfig ? value as Record<string, unknown> : {};
  return OPERATIONAL_MODEL_OPTIONS.reduce((config, option) => {
    const aliases = getTaskProfileSettingAliases(option);
    const raw = aliases.map((alias) => source[alias]).find((candidate) => candidate !== undefined);
    const profiles = raw === undefined && !hasSavedConfig
      ? DEFAULT_TASK_PROFILE_CONFIG[option.value]
      : Array.isArray(raw)
        ? uniqueProfiles(raw)
        : typeof raw === 'string'
          ? parseTaskProfileText(raw)
          : [];
    return {
      ...config,
      [option.value]: profiles,
    };
  }, hasSavedConfig ? {} as TaskProfileConfig : { ...DEFAULT_TASK_PROFILE_CONFIG });
};

export const normaliseTaskProfileAbbreviationConfig = (value: unknown): TaskProfileAbbreviationConfig => {
  const hasSavedConfig = !!value && typeof value === 'object' && !Array.isArray(value);
  const source = hasSavedConfig ? value as Record<string, unknown> : {};
  return OPERATIONAL_MODEL_OPTIONS.reduce((config, option) => {
    const aliases = getTaskProfileSettingAliases(option);
    const raw = aliases.map((alias) => source[alias]).find((candidate) => candidate !== undefined);
    const abbreviations = raw === undefined && !hasSavedConfig
      ? DEFAULT_TASK_PROFILE_ABBREVIATIONS[option.value]
      : typeof raw === 'string'
        ? parseTaskProfileAbbreviationText(raw)
        : raw && typeof raw === 'object'
          ? Object.entries(raw as Record<string, unknown>).reduce((items, [profile, abbreviation]) => {
              const cleanProfile = String(profile || '').trim();
              const cleanAbbreviation = String(abbreviation || '').trim();
              return cleanProfile && cleanAbbreviation ? { ...items, [cleanProfile]: cleanAbbreviation } : items;
            }, {} as Record<string, string>)
          : {};
    return {
      ...config,
      [option.value]: abbreviations,
    };
  }, hasSavedConfig ? {} as TaskProfileAbbreviationConfig : { ...DEFAULT_TASK_PROFILE_ABBREVIATIONS });
};

export const getTaskProfilesForModel = (
  config: PlatformConfig | null | undefined,
  model: unknown = DEFAULT_OPERATIONAL_MODEL,
): string[] => {
  const activeModel = normaliseOperationalModel(model);
  const organisations = config?.organisations || [];
  const primaryOrganisation = organisations.find((organisation: any) => String(organisation.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
    || organisations[0];
  const taskProfiles = normaliseTaskProfileConfig(primaryOrganisation?.settings?.taskProfiles || null);
  return taskProfiles[activeModel] || [];
};

export const getTaskProfileAbbreviationsForModel = (
  config: PlatformConfig | null | undefined,
  model: unknown = DEFAULT_OPERATIONAL_MODEL,
): Record<string, string> => {
  const activeModel = normaliseOperationalModel(model);
  const organisations = config?.organisations || [];
  const primaryOrganisation = organisations.find((organisation: any) => String(organisation.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
    || organisations[0];
  const abbreviations = normaliseTaskProfileAbbreviationConfig(primaryOrganisation?.settings?.taskProfileAbbreviations || null);
  return abbreviations[activeModel] || {};
};

export const getTaskProfileAbbreviationsForUnit = (
  config: PlatformConfig | null | undefined,
  unitCode: unknown,
): Record<string, string> => {
  const cleanUnitCode = String(unitCode || '').trim().toUpperCase();
  if (!cleanUnitCode || cleanUnitCode.includes('+')) return {};
  const unit = (config?.units || []).find((candidate: any) => (
    String(candidate.code || '').trim().toUpperCase() === cleanUnitCode
  ));
  const raw = unit?.settings?.taskProfileAbbreviations;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.entries(raw as Record<string, unknown>).reduce((items, [profile, abbreviation]) => {
    const cleanProfile = String(profile || '').trim();
    const cleanAbbreviation = String(abbreviation || '').trim();
    return cleanProfile && cleanAbbreviation ? { ...items, [cleanProfile]: cleanAbbreviation } : items;
  }, {} as Record<string, string>);
};
