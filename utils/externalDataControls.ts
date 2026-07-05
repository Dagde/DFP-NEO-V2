import { isSetupTestMode } from './setupTestMode';

export interface ExternalDataControls {
  externalDataEnabled: boolean;
  weatherDataEnabled: boolean;
  flightTrackingEnabled: boolean;
  productionApiFallbackEnabled: boolean;
  externalMediaEnabled: boolean;
}

export const EXTERNAL_DATA_CONTROLS_STORAGE_KEY = 'neo_external_data_controls';
export const EXTERNAL_DATA_CONTROLS_EVENT = 'neo-external-data-controls-changed';
export const PRODUCTION_API_ORIGIN = 'https://dfp-neo-v2-production.up.railway.app';

export const DEFAULT_EXTERNAL_DATA_CONTROLS: ExternalDataControls = {
  externalDataEnabled: true,
  weatherDataEnabled: true,
  flightTrackingEnabled: true,
  productionApiFallbackEnabled: true,
  externalMediaEnabled: true,
};

const safeWindow = (): Window | null => (typeof window === 'undefined' ? null : window);

export const normalizeExternalDataControls = (value: Partial<ExternalDataControls> | null | undefined): ExternalDataControls => ({
  externalDataEnabled: value?.externalDataEnabled !== false,
  weatherDataEnabled: value?.weatherDataEnabled !== false,
  flightTrackingEnabled: value?.flightTrackingEnabled !== false,
  productionApiFallbackEnabled: value?.productionApiFallbackEnabled !== false,
  externalMediaEnabled: value?.externalMediaEnabled !== false,
});

export const readExternalDataControls = (): ExternalDataControls => {
  const win = safeWindow();
  if (!win) return DEFAULT_EXTERNAL_DATA_CONTROLS;
  try {
    const stored = win.localStorage.getItem(EXTERNAL_DATA_CONTROLS_STORAGE_KEY);
    if (!stored) return DEFAULT_EXTERNAL_DATA_CONTROLS;
    return normalizeExternalDataControls(JSON.parse(stored));
  } catch {
    return DEFAULT_EXTERNAL_DATA_CONTROLS;
  }
};

export const writeExternalDataControls = (settings: ExternalDataControls): void => {
  const win = safeWindow();
  if (!win) return;
  const normalized = normalizeExternalDataControls(settings);
  win.localStorage.setItem(EXTERNAL_DATA_CONTROLS_STORAGE_KEY, JSON.stringify(normalized));
  win.dispatchEvent(new CustomEvent(EXTERNAL_DATA_CONTROLS_EVENT, { detail: normalized }));
};

export const isExternalDataAllowed = (key?: keyof Omit<ExternalDataControls, 'externalDataEnabled'>): boolean => {
  const settings = readExternalDataControls();
  if (!settings.externalDataEnabled) return false;
  return key ? settings[key] !== false : true;
};

export const getAppApiBase = (): string => {
  const win = safeWindow();
  if (!win) return '/api';
  if (isSetupTestMode()) return '/api';
  const currentOrigin = win.location.origin;
  if (currentOrigin === PRODUCTION_API_ORIGIN || currentOrigin.includes('railway.app')) return '/api';
  return isExternalDataAllowed('productionApiFallbackEnabled') ? `${PRODUCTION_API_ORIGIN}/api` : '/api';
};
