export interface TileStatusSettings {
  flightAuthorisationRequired: boolean;
  authorizationUrgentMinutes: number;
  authorizationWarningMinutes: number;
}

export const DEFAULT_TILE_STATUS_SETTINGS: TileStatusSettings = {
  flightAuthorisationRequired: true,
  authorizationUrgentMinutes: 15,
  authorizationWarningMinutes: 120,
};

export const TILE_STATUS_SETTINGS_STORAGE_KEY = 'dfp_tile_status_settings';

const clampMinutes = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(720, Math.max(0, Math.round(numeric)));
};

export const normaliseTileStatusSettings = (
  settings?: Partial<TileStatusSettings> | null
): TileStatusSettings => {
  const urgent = clampMinutes(
    settings?.authorizationUrgentMinutes,
    DEFAULT_TILE_STATUS_SETTINGS.authorizationUrgentMinutes
  );
  const warning = clampMinutes(
    settings?.authorizationWarningMinutes,
    DEFAULT_TILE_STATUS_SETTINGS.authorizationWarningMinutes
  );

  return {
    flightAuthorisationRequired: settings?.flightAuthorisationRequired !== false,
    authorizationUrgentMinutes: Math.min(urgent, warning),
    authorizationWarningMinutes: Math.max(warning, urgent),
  };
};

export const readTileStatusSettingsFromLocalStorage = (): TileStatusSettings => {
  if (typeof window === 'undefined') return DEFAULT_TILE_STATUS_SETTINGS;

  try {
    const raw = window.localStorage.getItem(TILE_STATUS_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_TILE_STATUS_SETTINGS;
    return normaliseTileStatusSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_TILE_STATUS_SETTINGS;
  }
};

export const writeTileStatusSettingsToLocalStorage = (settings: TileStatusSettings): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      TILE_STATUS_SETTINGS_STORAGE_KEY,
      JSON.stringify(normaliseTileStatusSettings(settings))
    );
  } catch {
    // Local storage is a convenience cache; database settings remain authoritative.
  }
};
