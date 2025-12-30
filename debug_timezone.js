// Debug timezone calculation
const now = new Date();
console.log('Current UTC time:', now.toISOString());
console.log('Current local time:', now.toString());

const timezoneOffset = 11; // UTC+11
const offsetMs = timezoneOffset * 60 * 60 * 1000;
const adjustedTime = new Date(now.getTime() + offsetMs);

console.log('Timezone offset:', timezoneOffset);
console.log('Offset milliseconds:', offsetMs);
console.log('Adjusted time:', adjustedTime.toISOString());
console.log('Adjusted UTC hours:', adjustedTime.getUTCHours());
console.log('Adjusted UTC date:', adjustedTime.getUTCDate());

// Test date string creation
const year = adjustedTime.getUTCFullYear();
const month = String(adjustedTime.getUTCMonth() + 1).padStart(2, '0');
const day = String(adjustedTime.getUTCDate()).padStart(2, '0');
const dateString = `${year}-${month}-${day}`;
console.log('Date string:', dateString);