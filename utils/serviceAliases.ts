const SERVICE_ALIAS_TARGETS: Record<string, string> = {
  RAAF: 'Air Force',
  'ROYAL AUSTRALIAN AIR FORCE': 'Air Force',
  RAN: 'Navy',
  'ROYAL AUSTRALIAN NAVY': 'Navy',
  ARA: 'Army',
  'AUSTRALIAN ARMY': 'Army',
};

const serviceKey = (value?: string | null): string => String(value || '').trim().toUpperCase();

export const getKnownServiceAliasTarget = (value?: string | null): string => (
  SERVICE_ALIAS_TARGETS[serviceKey(value)] || String(value || '').trim()
);

export const resolveConfiguredServiceName = (
  value?: string | null,
  configuredServices: string[] = [],
): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const configured = configuredServices
    .map(service => String(service || '').trim())
    .filter(Boolean);
  const exact = configured.find(service => serviceKey(service) === serviceKey(trimmed));
  if (exact) return exact;

  const aliasTarget = getKnownServiceAliasTarget(trimmed);
  if (aliasTarget !== trimmed) {
    const configuredAliasTarget = configured.find(service => serviceKey(service) === serviceKey(aliasTarget));
    if (configuredAliasTarget) return configuredAliasTarget;
  }

  return trimmed;
};

export const getConfiguredServiceOptionsWithCurrent = (
  configuredServices: string[] = [],
  currentService?: string | null,
): string[] => {
  const options = configuredServices
    .map(service => String(service || '').trim())
    .filter(Boolean);
  const resolvedCurrent = resolveConfiguredServiceName(currentService, options);
  return resolvedCurrent && !options.some(option => serviceKey(option) === serviceKey(resolvedCurrent))
    ? [...options, resolvedCurrent]
    : options;
};

export const servicesMatchConfiguredName = (
  value: string | null | undefined,
  configuredService: string,
  configuredServices: string[] = [],
): boolean => {
  const configured = configuredServices.length > 0 ? configuredServices : [configuredService];
  return serviceKey(resolveConfiguredServiceName(value, configured)) === serviceKey(configuredService);
};
