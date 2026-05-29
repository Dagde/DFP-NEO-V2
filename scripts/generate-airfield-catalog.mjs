import { mkdir, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../public/airfield-location-catalog.json');

const fetchText = (url, redirects = 0) => new Promise((resolve, reject) => {
  const request = https.get(url, (response) => {
    const status = response.statusCode || 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location && redirects < 5) {
      response.resume();
      fetchText(new URL(location, url).toString(), redirects + 1).then(resolve, reject);
      return;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      reject(new Error(`Download failed (${status}) for ${url}`));
      return;
    }

    response.setEncoding('utf8');
    let body = '';
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve(body));
  });

  request.on('error', reject);
  request.setTimeout(30000, () => {
    request.destroy(new Error(`Download timed out for ${url}`));
  });
});

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  return rows;
};

const clean = (value) => String(value || '').trim();
const cleanCode = (value) => clean(value).toUpperCase();
const cleanName = (value) => clean(value).replace(/\s+/g, ' ');
const roundCoordinate = (value) => Math.round(value * 1000000) / 1000000;

const isValidTimezone = (value) => {
  const timezone = clean(value);
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const csv = await fetchText(SOURCE_URL);
  const rows = parseCsv(csv);
  const headers = rows[0] || [];
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const get = (row, key) => row[headerIndex.get(key)] ?? '';
  const seen = new Set();
  const entries = [];

  for (const row of rows.slice(1)) {
    const latitude = Number(get(row, 'lat'));
    const longitude = Number(get(row, 'lon'));
    const timezone = clean(get(row, 'tz'));
    const name = cleanName(get(row, 'name'));

    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !isValidTimezone(timezone)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;

    const entry = {
      c: cleanCode(get(row, 'icao')),
      i: cleanCode(get(row, 'iata')),
      l: cleanCode(get(row, 'lid')),
      n: name,
      m: cleanName(get(row, 'city')),
      y: cleanCode(get(row, 'country')),
      a: roundCoordinate(latitude),
      o: roundCoordinate(longitude),
      t: timezone,
    };

    const key = [
      entry.c,
      entry.i,
      entry.l,
      entry.n.toLowerCase(),
      entry.a,
      entry.o,
      entry.t,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  entries.sort((left, right) => (
    left.y.localeCompare(right.y)
    || left.n.localeCompare(right.n)
    || left.c.localeCompare(right.c)
    || left.i.localeCompare(right.i)
  ));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(entries)}\n`, 'utf8');
  console.log(`Wrote ${entries.length.toLocaleString()} airfield entries to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
