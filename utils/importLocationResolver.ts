import type { PlatformLocation } from './platformConfigService';

export interface AirfieldCatalogueEntry {
  c?: string;
  i?: string;
  l?: string;
  n?: string;
  m?: string;
  y?: string;
}

let airfieldCatalogueCache: AirfieldCatalogueEntry[] | null = null;

export const normaliseImportLocationToken = (value: unknown): string => (
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]/g, '')
);

const removeCommonAirfieldWords = (value: unknown): string => (
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\b(RAAF|BASE|AIR|FORCE|AIRFORCE|AIRFIELD|AIRPORT|AERODROME|INTERNATIONAL|REGIONAL)\b/g, ' ')
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]/g, '')
);

const getLocationTokens = (location: any): string[] => {
  const values = [
    location?.code,
    location?.iataCode,
    location?.iata,
    location?.icao,
    location?.icaoCode,
    location?.name,
    location?.settings?.legacyCode,
    location?.settings?.runtimeCode,
    location?.settings?.iataCode,
    location?.settings?.icaoCode,
    ...(Array.isArray(location?.aliases) ? location.aliases : []),
    ...(Array.isArray(location?.settings?.aliases) ? location.settings.aliases : []),
  ];
  const tokens = values.flatMap(value => [
    normaliseImportLocationToken(value),
    removeCommonAirfieldWords(value),
  ]).filter(Boolean);
  return Array.from(new Set(tokens));
};

const getCatalogueTokens = (entry: AirfieldCatalogueEntry): string[] => {
  const values = [entry.c, entry.i, entry.l, entry.n, entry.m];
  const tokens = values.flatMap(value => [
    normaliseImportLocationToken(value),
    removeCommonAirfieldWords(value),
  ]).filter(Boolean);
  return Array.from(new Set(tokens));
};

const describeCatalogueEntry = (entry: AirfieldCatalogueEntry): string => {
  const code = String(entry.c || '').trim();
  const iata = String(entry.i || '').trim();
  const name = String(entry.n || entry.m || '').trim();
  return [code, iata ? `/${iata}` : '', name ? ` ${name}` : ''].join('').trim() || 'airfield catalogue entry';
};

export const loadImportAirfieldCatalogue = async (): Promise<AirfieldCatalogueEntry[]> => {
  if (airfieldCatalogueCache) return airfieldCatalogueCache;
  try {
    const baseUrl = new URL((import.meta as any)?.env?.BASE_URL || './', window.location.href);
    const response = await fetch(new URL('airfield-location-catalog.json', baseUrl).toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    airfieldCatalogueCache = Array.isArray(payload) ? payload : [];
  } catch (error) {
    airfieldCatalogueCache = [];
  }
  return airfieldCatalogueCache;
};

export const resolveImportedLocationCode = (
  rawLocation: unknown,
  configuredLocations: PlatformLocation[] | any[] = [],
  airfieldCatalogue: AirfieldCatalogueEntry[] = [],
): string => {
  const rawText = String(rawLocation || '').trim();
  const token = normaliseImportLocationToken(rawText);
  const looseToken = removeCommonAirfieldWords(rawText);
  if (!token && !looseToken) return '';

  const activeConfiguredLocations = configuredLocations
    .filter((location: any) => String(location?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');

  const findConfiguredMatch = (tokens: string[]): any | null => {
    const tokenSet = new Set(tokens.filter(Boolean));
    if (tokenSet.size === 0) return null;
    return activeConfiguredLocations.find((location: any) => (
      getLocationTokens(location).some(candidate => tokenSet.has(candidate))
    )) || null;
  };

  const directConfiguredMatch = findConfiguredMatch([token, looseToken]);
  if (directConfiguredMatch) {
    return String(directConfiguredMatch.code || directConfiguredMatch.icaoCode || directConfiguredMatch.icao || rawText).trim().toUpperCase();
  }

  const catalogueMatches = airfieldCatalogue.filter(entry => (
    getCatalogueTokens(entry).some(candidate => candidate === token || candidate === looseToken)
  ));
  const catalogueMatch = catalogueMatches[0];
  if (!catalogueMatch) {
    throw new Error(`Location "${rawText}" is not configured in Settings and was not recognised in the offline airfield catalogue.`);
  }

  const configuredCatalogueMatch = findConfiguredMatch(getCatalogueTokens(catalogueMatch));
  if (configuredCatalogueMatch) {
    return String(configuredCatalogueMatch.code || configuredCatalogueMatch.icaoCode || configuredCatalogueMatch.icao || rawText).trim().toUpperCase();
  }

  throw new Error(`Location "${rawText}" was recognised as ${describeCatalogueEntry(catalogueMatch)}, but that airfield is not configured in Settings > Organisation, Bases & Areas.`);
};
