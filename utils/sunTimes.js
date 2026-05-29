const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const OFFICIAL_SUNRISE_ZENITH = 90.833;
const CIVIL_TWILIGHT_ZENITH = 96;
const MINUTES_PER_DAY = 1440;

export const DEFAULT_AIRFIELD_SOLAR_PROFILES = {
  ESL: { code: 'ESL', name: 'East Sale', latitude: -38.0989, longitude: 147.1494, timezone: 'Australia/Melbourne' },
  PEA: { code: 'PEA', name: 'Pearce', latitude: -31.6678, longitude: 116.015, timezone: 'Australia/Perth' },
  WLM: { code: 'WLM', name: 'Williamtown', latitude: -32.794, longitude: 151.834, timezone: 'Australia/Sydney' },
  AMB: { code: 'AMB', name: 'Amberley', latitude: -27.6406, longitude: 152.712, timezone: 'Australia/Brisbane' },
  TIN: { code: 'TIN', name: 'Tindal', latitude: -14.521, longitude: 132.378, timezone: 'Australia/Darwin' },
  EDI: { code: 'EDI', name: 'Edinburgh', latitude: -34.7025, longitude: 138.6208, timezone: 'Australia/Adelaide' },
};

const DEFAULT_AIRFIELD_LOOKUP = Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES).reduce((acc, profile) => {
  acc[normaliseKey(profile.code)] = profile;
  acc[normaliseKey(profile.name)] = profile;
  return acc;
}, {});

function normaliseKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toRadians(degrees) {
  return degrees * DEG_TO_RAD;
}

function toDegrees(radians) {
  return radians * RAD_TO_DEG;
}

function normaliseDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function normaliseHours(hours) {
  return ((hours % 24) + 24) % 24;
}

function parseDateParts(date) {
  if (date instanceof Date && Number.isFinite(date.getTime())) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid date for solar calculation: ${date}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dayOfYear({ year, month, day }) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

export function isValidLatitude(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= -90 && number <= 90;
}

export function isValidLongitude(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= -180 && number <= 180;
}

export function isValidTimeZone(timezone) {
  const value = String(timezone || '').trim();
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getDefaultAirfieldSolarProfile(identifier) {
  return DEFAULT_AIRFIELD_LOOKUP[normaliseKey(identifier)] || null;
}

export function decimalHoursToTimeString(hours) {
  if (!Number.isFinite(hours)) return null;
  const totalMinutes = Math.round(normaliseHours(hours) * 60) % MINUTES_PER_DAY;
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function timeStringToDecimalHours(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  return normaliseHours(hours + minutes / 60);
}

function formatTimeInZone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === 'hour')?.value || '00';
  const minute = parts.find((part) => part.type === 'minute')?.value || '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function formatDateInZone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function toDateKey({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildUtcDateForLocalSolarDate(dateParts, utcMinutes, timezone) {
  const targetDateKey = toDateKey(dateParts);
  const candidates = [-1, 0, 1].map((dayOffset) => (
    new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + dayOffset, 0, utcMinutes))
  ));

  return candidates.find((candidate) => formatDateInZone(candidate, timezone) === targetDateKey) || candidates[1];
}

function calculateUtcMinutesForSolarEvent(dateParts, latitude, longitude, isSunrise, zenith) {
  const n = dayOfYear(dateParts);
  const longitudeHour = longitude / 15;
  const approximateTime = n + ((isSunrise ? 6 : 18) - longitudeHour) / 24;

  const meanAnomaly = (0.9856 * approximateTime) - 3.289;
  const trueLongitude = normaliseDegrees(
    meanAnomaly
    + (1.916 * Math.sin(toRadians(meanAnomaly)))
    + (0.020 * Math.sin(toRadians(2 * meanAnomaly)))
    + 282.634
  );

  let rightAscension = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude))));
  rightAscension = normaliseDegrees(rightAscension);

  const longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
  const rightAscensionQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = (rightAscension + longitudeQuadrant - rightAscensionQuadrant) / 15;

  const sinDeclination = 0.39782 * Math.sin(toRadians(trueLongitude));
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosLocalHourAngle = (
    Math.cos(toRadians(zenith)) - (sinDeclination * Math.sin(toRadians(latitude)))
  ) / (cosDeclination * Math.cos(toRadians(latitude)));

  if (cosLocalHourAngle > 1) {
    return { utcMinutes: null, polarState: 'sun_always_down' };
  }

  if (cosLocalHourAngle < -1) {
    return { utcMinutes: null, polarState: 'sun_always_up' };
  }

  let localHourAngle = isSunrise
    ? 360 - toDegrees(Math.acos(cosLocalHourAngle))
    : toDegrees(Math.acos(cosLocalHourAngle));
  localHourAngle /= 15;

  const localMeanTime = localHourAngle + rightAscension - (0.06571 * approximateTime) - 6.622;
  const utcHours = normaliseHours(localMeanTime - longitudeHour);
  return {
    utcMinutes: Math.round(utcHours * 60),
    polarState: null,
  };
}

export function getSunTimes(date, latitude, longitude, timezone, options = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  const tz = String(timezone || '').trim();
  const sunZenith = Number(options.sunZenith ?? options.zenith ?? OFFICIAL_SUNRISE_ZENITH);
  const twilightZenith = Number(options.twilightZenith ?? CIVIL_TWILIGHT_ZENITH);

  if (!isValidLatitude(lat)) {
    throw new Error(`Invalid latitude for solar calculation: ${latitude}`);
  }
  if (!isValidLongitude(lon)) {
    throw new Error(`Invalid longitude for solar calculation: ${longitude}`);
  }
  if (!isValidTimeZone(tz)) {
    throw new Error(`Invalid IANA timezone for solar calculation: ${timezone}`);
  }

  const dateParts = parseDateParts(date);
  const sunrise = calculateUtcMinutesForSolarEvent(dateParts, lat, lon, true, sunZenith);
  const sunset = calculateUtcMinutesForSolarEvent(dateParts, lat, lon, false, sunZenith);
  const firstLight = calculateUtcMinutesForSolarEvent(dateParts, lat, lon, true, twilightZenith);
  const lastLight = calculateUtcMinutesForSolarEvent(dateParts, lat, lon, false, twilightZenith);
  const polarState = sunrise.polarState || sunset.polarState || null;
  const twilightPolarState = firstLight.polarState || lastLight.polarState || null;

  const result = {
    sunrise: null,
    sunset: null,
    firstLight: null,
    lastLight: null,
    sunriseDecimal: null,
    sunsetDecimal: null,
    firstLightDecimal: null,
    lastLightDecimal: null,
    sunriseUtc: null,
    sunsetUtc: null,
    firstLightUtc: null,
    lastLightUtc: null,
    dayLengthMinutes: polarState === 'sun_always_up' ? MINUTES_PER_DAY : 0,
    usableLightMinutes: twilightPolarState === 'sun_always_up' ? MINUTES_PER_DAY : 0,
    hasSunrise: false,
    hasSunset: false,
    hasFirstLight: false,
    hasLastLight: false,
    polarState,
    twilightPolarState,
    timezone: tz,
  };

  if (!polarState) {
    const sunriseUtc = buildUtcDateForLocalSolarDate(dateParts, sunrise.utcMinutes, tz);
    const sunsetUtc = buildUtcDateForLocalSolarDate(dateParts, sunset.utcMinutes, tz);
    const sunriseLocal = formatTimeInZone(sunriseUtc, tz);
    const sunsetLocal = formatTimeInZone(sunsetUtc, tz);
    let dayLengthMinutes = Math.round((sunsetUtc.getTime() - sunriseUtc.getTime()) / 60000);
    if (dayLengthMinutes < 0) dayLengthMinutes += MINUTES_PER_DAY;

    result.sunrise = sunriseLocal;
    result.sunset = sunsetLocal;
    result.sunriseDecimal = timeStringToDecimalHours(sunriseLocal);
    result.sunsetDecimal = timeStringToDecimalHours(sunsetLocal);
    result.sunriseUtc = sunriseUtc.toISOString();
    result.sunsetUtc = sunsetUtc.toISOString();
    result.dayLengthMinutes = dayLengthMinutes;
    result.hasSunrise = true;
    result.hasSunset = true;
  }

  if (!twilightPolarState) {
    const firstLightUtc = buildUtcDateForLocalSolarDate(dateParts, firstLight.utcMinutes, tz);
    const lastLightUtc = buildUtcDateForLocalSolarDate(dateParts, lastLight.utcMinutes, tz);
    const firstLightLocal = formatTimeInZone(firstLightUtc, tz);
    const lastLightLocal = formatTimeInZone(lastLightUtc, tz);
    let usableLightMinutes = Math.round((lastLightUtc.getTime() - firstLightUtc.getTime()) / 60000);
    if (usableLightMinutes < 0) usableLightMinutes += MINUTES_PER_DAY;

    result.firstLight = firstLightLocal;
    result.lastLight = lastLightLocal;
    result.firstLightDecimal = timeStringToDecimalHours(firstLightLocal);
    result.lastLightDecimal = timeStringToDecimalHours(lastLightLocal);
    result.firstLightUtc = firstLightUtc.toISOString();
    result.lastLightUtc = lastLightUtc.toISOString();
    result.usableLightMinutes = usableLightMinutes;
    result.hasFirstLight = true;
    result.hasLastLight = true;
  }

  return result;
}

export function classifyDayNightBySunTimes(decimalHour, sunTimes) {
  if (!Number.isFinite(decimalHour) || !sunTimes) return null;
  if (sunTimes.twilightPolarState === 'sun_always_up') return 'Day';
  if (sunTimes.twilightPolarState === 'sun_always_down') return 'Night';
  if (sunTimes.polarState === 'sun_always_up') return 'Day';
  if (sunTimes.polarState === 'sun_always_down') return 'Night';
  const dayStart = Number.isFinite(sunTimes.firstLightDecimal) ? sunTimes.firstLightDecimal : sunTimes.sunriseDecimal;
  const dayEnd = Number.isFinite(sunTimes.lastLightDecimal) ? sunTimes.lastLightDecimal : sunTimes.sunsetDecimal;
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) return null;
  return decimalHour >= dayStart && decimalHour < dayEnd ? 'Day' : 'Night';
}
