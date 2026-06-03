import {
  DEFAULT_OPERATIONAL_MODEL,
  OPERATIONAL_MODEL_OPTIONS,
  normaliseOperationalModel,
  type OperationalModelCode,
  type PlatformConfig,
} from './platformConfigService';

export type TaskProfileConfig = Record<OperationalModelCode, string[]>;

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
  air_mobility: [
    'Tactical Airlift',
    'Strategic Airlift',
    'Personnel Transport',
    'Cargo Resupply',
    'Airborne Delivery',
    'Aeromedical Evacuation',
    'Air-to-Air Refuelling',
    'Humanitarian Assistance',
    'Disaster Relief',
    'VIP Transport',
  ],
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

export const parseTaskProfileText = (text: string): string[] => {
  const sourceText = String(text || '');
  const separator = sourceText.includes('\n') ? /\r?\n/ : /[,;]+/;
  return uniqueProfiles(sourceText.split(separator));
};

export const formatTaskProfileText = (profiles: string[]): string => (
  uniqueProfiles(profiles).join('\n')
);

export const normaliseTaskProfileConfig = (value: unknown): TaskProfileConfig => {
  const source = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return OPERATIONAL_MODEL_OPTIONS.reduce((config, option) => {
    const aliases = [
      option.value,
      option.label,
      option.label.replace(/\s+Model$/i, ''),
    ];
    const raw = aliases.map((alias) => source[alias]).find((candidate) => candidate !== undefined);
    const profiles = raw === undefined
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
  }, { ...DEFAULT_TASK_PROFILE_CONFIG });
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
