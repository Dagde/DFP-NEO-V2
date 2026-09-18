const TAF_CACHE_TTL_MS = 10 * 60 * 1000;
const NOAA_TAF_API_URL = 'https://aviationweather.gov/api/data/taf';
const NOAA_SOURCE_NAME = 'NOAA Aviation Weather Center';
const NOAA_USER_AGENT = process.env.DFP_NEO_WEATHER_USER_AGENT ||
  'DFP-NEO/1.0 TAF weather service (server-side; contact: support@dfp-neo.app)';
const NO_TAF_MESSAGE = 'No current TAF available from the global weather feed.';

const tafCache = new Map();
const inFlightTafRequests = new Map();

export function normaliseWeatherIcao(value) {
  return String(value || '').trim().toUpperCase();
}

export function isValidWeatherIcao(value) {
  return /^[A-Z0-9]{4}$/.test(normaliseWeatherIcao(value));
}

function toIsoTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normaliseForecastPeriods(periods) {
  return Array.isArray(periods)
    ? periods.map(period => ({
      change: period?.fcstChange || null,
      probability: period?.probability ?? null,
      from: toIsoTime(period?.timeFrom),
      to: toIsoTime(period?.timeTo),
      becoming: toIsoTime(period?.timeBec),
      windDirection: period?.wdir ?? null,
      windSpeed: period?.wspd ?? null,
      windGust: period?.wgst ?? null,
      visibility: period?.visib ?? null,
      weather: period?.wxString || null,
      clouds: Array.isArray(period?.clouds) ? period.clouds : [],
      notDecoded: period?.notDecoded || null,
    }))
    : [];
}

function buildNoDataTaf(icao, retrievedAt, options = {}) {
  return {
    icao,
    raw: '',
    issueTime: null,
    validFrom: null,
    validTo: null,
    periods: [],
    source: NOAA_SOURCE_NAME,
    retrievedAt,
    noData: true,
    message: NO_TAF_MESSAGE,
    isCached: options.isCached === true,
    cacheStatus: options.cacheStatus || 'fresh',
    provider: 'NOAA',
  };
}

function normaliseNoaaTafRecord(icao, record, retrievedAt, options = {}) {
  const raw = String(record?.rawTAF || record?.raw_text || record?.raw || '').trim();
  if (!raw) return buildNoDataTaf(icao, retrievedAt, options);
  return {
    icao: String(record?.icaoId || icao).trim().toUpperCase(),
    raw,
    issueTime: toIsoTime(record?.issueTime || record?.bulletinTime),
    validFrom: toIsoTime(record?.validTimeFrom),
    validTo: toIsoTime(record?.validTimeTo),
    periods: normaliseForecastPeriods(record?.fcsts),
    source: NOAA_SOURCE_NAME,
    retrievedAt,
    noData: false,
    message: null,
    isCached: options.isCached === true,
    cacheStatus: options.cacheStatus || 'fresh',
    provider: 'NOAA',
  };
}

function markCached(record, cacheStatus = 'fresh') {
  return {
    ...record,
    isCached: true,
    cacheStatus,
  };
}

function logWeatherDiagnostic(event, details = {}) {
  console.info('[WeatherService]', event, {
    generatedAt: new Date().toISOString(),
    ...details,
  });
}

class NOAAWeatherProvider {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetchImpl = fetchImpl;
    this.name = NOAA_SOURCE_NAME;
  }

  async getTAF(icao) {
    if (typeof this.fetchImpl !== 'function') {
      const error = new Error('Weather provider fetch is unavailable in this runtime.');
      error.status = 503;
      throw error;
    }

    const requestedAt = Date.now();
    const url = `${NOAA_TAF_API_URL}?ids=${encodeURIComponent(icao)}&format=json`;
    let response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': NOAA_USER_AGENT,
        },
      });
    } catch (error) {
      error.status = 0;
      error.durationMs = Date.now() - requestedAt;
      throw error;
    }

    const durationMs = Date.now() - requestedAt;
    if (response.status === 204) {
      logWeatherDiagnostic('NOAA_TAF_RESPONSE', {
        icao,
        status: response.status,
        tafReturned: false,
        issueTime: null,
        durationMs,
      });
      return {
        status: 204,
        taf: buildNoDataTaf(icao, new Date().toISOString()),
        durationMs,
      };
    }

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(`NOAA Aviation Weather Center returned HTTP ${response.status}`);
      error.status = response.status;
      error.durationMs = durationMs;
      error.payload = payload;
      logWeatherDiagnostic('NOAA_TAF_ERROR_RESPONSE', {
        icao,
        status: response.status,
        tafReturned: false,
        durationMs,
      });
      throw error;
    }

    const records = Array.isArray(payload) ? payload : [];
    const record = records.find(item => String(item?.icaoId || '').trim().toUpperCase() === icao) || records[0] || null;
    const taf = record
      ? normaliseNoaaTafRecord(icao, record, new Date().toISOString())
      : buildNoDataTaf(icao, new Date().toISOString());

    logWeatherDiagnostic('NOAA_TAF_RESPONSE', {
      icao,
      status: response.status,
      tafReturned: !taf.noData,
      issueTime: taf.issueTime,
      durationMs,
    });

    return {
      status: response.status,
      taf,
      durationMs,
    };
  }
}

class WeatherService {
  constructor(providers) {
    this.providers = providers;
  }

  async getTAF(icaoValue) {
    const icao = normaliseWeatherIcao(icaoValue);
    if (!isValidWeatherIcao(icao)) {
      const error = new Error('Invalid ICAO code');
      error.status = 400;
      throw error;
    }

    const now = Date.now();
    const cached = tafCache.get(icao);
    if (cached && cached.expiresAt > now) {
      logWeatherDiagnostic('TAF_CACHE_HIT', {
        icao,
        cacheHit: true,
        tafReturned: !cached.taf.noData,
        issueTime: cached.taf.issueTime,
        cacheExpiresAt: new Date(cached.expiresAt).toISOString(),
      });
      return markCached(cached.taf, 'fresh');
    }

    if (inFlightTafRequests.has(icao)) {
      logWeatherDiagnostic('TAF_REQUEST_DEDUPED', { icao });
      return inFlightTafRequests.get(icao);
    }

    const requestPromise = this.fetchAndCacheTAF(icao, cached);
    inFlightTafRequests.set(icao, requestPromise);
    try {
      return await requestPromise;
    } finally {
      inFlightTafRequests.delete(icao);
    }
  }

  async fetchAndCacheTAF(icao, cached) {
    logWeatherDiagnostic('TAF_CACHE_MISS', {
      icao,
      cacheHit: false,
      hasPreviousCachedTaf: Boolean(cached?.taf && !cached.taf.noData),
    });

    for (const provider of this.providers) {
      try {
        const result = await provider.getTAF(icao);
        const taf = {
          ...result.taf,
          isCached: false,
          cacheStatus: 'fresh',
        };
        tafCache.set(icao, {
          taf,
          expiresAt: Date.now() + TAF_CACHE_TTL_MS,
          lastSuccessAt: taf.noData ? cached?.lastSuccessAt || null : taf.retrievedAt,
        });
        logWeatherDiagnostic('TAF_CACHE_STORE', {
          icao,
          provider: provider.name,
          status: result.status,
          tafReturned: !taf.noData,
          issueTime: taf.issueTime,
          requestDurationMs: result.durationMs,
        });
        return taf;
      } catch (error) {
        const status = Number(error?.status || 0);
        logWeatherDiagnostic('TAF_PROVIDER_ERROR', {
          icao,
          provider: provider.name,
          status: status || 'network',
          requestDurationMs: error?.durationMs ?? null,
          fallbackToCachedData: Boolean(cached?.taf && !cached.taf.noData),
          error: error?.message || 'Unknown weather provider error',
        });

        if (status === 400 || status === 403) {
          const providerError = new Error(status === 400 ? 'Invalid weather provider request' : 'Weather provider request blocked');
          providerError.status = status;
          throw providerError;
        }

        if (cached?.taf && !cached.taf.noData) {
          return markCached(cached.taf, 'stale');
        }
      }
    }

    if (cached?.taf) {
      return markCached(cached.taf, cached.taf.noData ? 'stale-no-data' : 'stale');
    }

    return buildNoDataTaf(icao, new Date().toISOString(), { isCached: false });
  }
}

export const weatherService = new WeatherService([
  new NOAAWeatherProvider(),
]);

export const __weatherServiceInternals = {
  TAF_CACHE_TTL_MS,
  NO_TAF_MESSAGE,
  tafCache,
  inFlightTafRequests,
  NOAAWeatherProvider,
  WeatherService,
};
