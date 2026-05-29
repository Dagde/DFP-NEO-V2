import assert from 'node:assert/strict';
import { getSunTimes, timeStringToDecimalHours } from '../utils/sunTimes.js';

const cases = [
  {
    name: 'Melbourne winter',
    date: '2026-06-21',
    latitude: -37.8136,
    longitude: 144.9631,
    timezone: 'Australia/Melbourne',
    sunriseRange: [7.2, 8.1],
    sunsetRange: [16.7, 17.6],
    dayLengthRange: [540, 610],
  },
  {
    name: 'Darwin winter',
    date: '2026-06-21',
    latitude: -12.4634,
    longitude: 130.8456,
    timezone: 'Australia/Darwin',
    sunriseRange: [6.6, 7.4],
    sunsetRange: [18.0, 18.8],
    dayLengthRange: [670, 710],
  },
  {
    name: 'London summer',
    date: '2026-06-21',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    sunriseRange: [4.0, 5.1],
    sunsetRange: [20.8, 21.8],
    dayLengthRange: [990, 1040],
  },
  {
    name: 'Anchorage summer',
    date: '2026-06-21',
    latitude: 61.2181,
    longitude: -149.9003,
    timezone: 'America/Anchorage',
    sunriseRange: [3.7, 5.0],
    sunsetRange: [23.0, 24.0],
    dayLengthRange: [1120, 1185],
  },
];

for (const item of cases) {
  const result = getSunTimes(item.date, item.latitude, item.longitude, item.timezone);
  const sunrise = timeStringToDecimalHours(result.sunrise);
  const sunset = timeStringToDecimalHours(result.sunset);

  assert.equal(result.hasSunrise, true, `${item.name}: expected sunrise`);
  assert.equal(result.hasSunset, true, `${item.name}: expected sunset`);
  assert.ok(sunrise >= item.sunriseRange[0] && sunrise <= item.sunriseRange[1], `${item.name}: sunrise ${result.sunrise} outside sensible range`);
  assert.ok(sunset >= item.sunsetRange[0] && sunset <= item.sunsetRange[1], `${item.name}: sunset ${result.sunset} outside sensible range`);
  assert.ok(result.dayLengthMinutes >= item.dayLengthRange[0] && result.dayLengthMinutes <= item.dayLengthRange[1], `${item.name}: day length ${result.dayLengthMinutes} outside sensible range`);
  console.log(`${item.name}: ${result.sunrise}-${result.sunset}, ${result.dayLengthMinutes} min`);
}

const polar = getSunTimes('2026-06-21', 78.2232, 15.6267, 'Arctic/Longyearbyen');
assert.equal(polar.hasSunrise, false, 'Polar case should not report sunrise');
assert.equal(polar.hasSunset, false, 'Polar case should not report sunset');
assert.equal(polar.polarState, 'sun_always_up', 'Polar case should report continuous daylight');
console.log(`Polar case: ${polar.polarState}, ${polar.dayLengthMinutes} min`);
