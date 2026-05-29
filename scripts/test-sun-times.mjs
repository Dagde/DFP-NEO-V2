import assert from 'node:assert/strict';
import { getSunTimes, timeStringToDecimalHours } from '../utils/sunTimes.js';

const cases = [
  {
    name: 'Melbourne winter',
    date: '2026-06-21',
    latitude: -37.8136,
    longitude: 144.9631,
    timezone: 'Australia/Melbourne',
    firstLightRange: [6.8, 7.3],
    sunriseRange: [7.2, 8.1],
    sunsetRange: [16.7, 17.6],
    lastLightRange: [17.3, 18.0],
    dayLengthRange: [540, 610],
    usableLightRange: [610, 650],
  },
  {
    name: 'Darwin winter',
    date: '2026-06-21',
    latitude: -12.4634,
    longitude: 130.8456,
    timezone: 'Australia/Darwin',
    firstLightRange: [6.4, 7.0],
    sunriseRange: [6.6, 7.4],
    sunsetRange: [18.0, 18.8],
    lastLightRange: [18.5, 19.2],
    dayLengthRange: [670, 710],
    usableLightRange: [710, 750],
  },
  {
    name: 'London summer',
    date: '2026-06-21',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    firstLightRange: [3.5, 4.3],
    sunriseRange: [4.0, 5.1],
    sunsetRange: [20.8, 21.8],
    lastLightRange: [21.7, 22.5],
    dayLengthRange: [990, 1040],
    usableLightRange: [1060, 1120],
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
  const firstLight = timeStringToDecimalHours(result.firstLight);
  const sunrise = timeStringToDecimalHours(result.sunrise);
  const sunset = timeStringToDecimalHours(result.sunset);
  const lastLight = timeStringToDecimalHours(result.lastLight);

  assert.equal(result.hasSunrise, true, `${item.name}: expected sunrise`);
  assert.equal(result.hasSunset, true, `${item.name}: expected sunset`);
  assert.ok(sunrise >= item.sunriseRange[0] && sunrise <= item.sunriseRange[1], `${item.name}: sunrise ${result.sunrise} outside sensible range`);
  assert.ok(sunset >= item.sunsetRange[0] && sunset <= item.sunsetRange[1], `${item.name}: sunset ${result.sunset} outside sensible range`);
  assert.ok(result.dayLengthMinutes >= item.dayLengthRange[0] && result.dayLengthMinutes <= item.dayLengthRange[1], `${item.name}: day length ${result.dayLengthMinutes} outside sensible range`);
  if (item.firstLightRange) {
    assert.equal(result.hasFirstLight, true, `${item.name}: expected first light`);
    assert.equal(result.hasLastLight, true, `${item.name}: expected last light`);
    assert.ok(firstLight >= item.firstLightRange[0] && firstLight <= item.firstLightRange[1], `${item.name}: first light ${result.firstLight} outside sensible range`);
    assert.ok(lastLight >= item.lastLightRange[0] && lastLight <= item.lastLightRange[1], `${item.name}: last light ${result.lastLight} outside sensible range`);
    assert.ok(firstLight < sunrise, `${item.name}: first light should be before sunrise`);
    assert.ok(lastLight > sunset, `${item.name}: last light should be after sunset`);
    assert.ok(result.usableLightMinutes >= item.usableLightRange[0] && result.usableLightMinutes <= item.usableLightRange[1], `${item.name}: usable light ${result.usableLightMinutes} outside sensible range`);
  } else {
    assert.equal(result.twilightPolarState, 'sun_always_up', `${item.name}: expected continuous civil twilight/light`);
    assert.equal(result.usableLightMinutes, 1440, `${item.name}: expected continuous usable light`);
  }
  console.log(`${item.name}: FL ${result.firstLight || 'continuous'} / sunrise ${result.sunrise} / sunset ${result.sunset} / LL ${result.lastLight || 'continuous'}, ${result.dayLengthMinutes} min sun, ${result.usableLightMinutes} min usable`);
}

const polar = getSunTimes('2026-06-21', 78.2232, 15.6267, 'Arctic/Longyearbyen');
assert.equal(polar.hasSunrise, false, 'Polar case should not report sunrise');
assert.equal(polar.hasSunset, false, 'Polar case should not report sunset');
assert.equal(polar.polarState, 'sun_always_up', 'Polar case should report continuous daylight');
console.log(`Polar case: ${polar.polarState}, ${polar.dayLengthMinutes} min`);
