import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const skipDb = args.has('--skip-db');

const publicOutputPath = path.join(repoRoot, 'public', 'neo-guide', 'db-vocabulary.json');
const platformOutputPath = path.join(repoRoot, 'dfp-neo-platform', 'public', 'flight-school-app', 'neo-guide', 'db-vocabulary.json');
const localOutputPath = path.join(repoRoot, 'data', 'neo-guide', 'db-vocabulary.local.json');

const MAX_RECORDS_PER_MODEL = 2500;
const MAX_TERMS = 6000;
const MAX_TERM_LENGTH = 80;

const SAFE_MODEL_FIELDS = {
  Aircraft: ['aircraftNumber', 'type', 'status', 'configuration'],
  CancellationHistory: ['eventType', 'cancellationCode', 'reason'],
  Course: ['name', 'code', 'location', 'unit', 'lmpType', 'academicLmpType', 'status'],
  CourseAcademicProgress: ['courseCode', 'lessonCode'],
  CourseSettings: ['selectedAcademicLmp', 'excludedCourses'],
  EventCompletion: ['eventCode', 'eventType', 'dcoResult', 'overallResult', 'aircraftNumber', 'source'],
  FlightLogEntry: ['eventCode', 'eventType', 'aircraftNumber', 'fromIcao', 'toIcao', 'duty'],
  IndividualLMP: ['lmpType', 'events', 'completedEventIds'],
  Personnel: ['rank', 'role', 'qualifications', 'category', 'flight', 'location', 'permissions', 'seatConfig', 'service', 'unit'],
  ScheduleEventArchive: ['eventType', 'eventCode', 'resourceId', 'eventData'],
  SctRequest: ['requestType', 'event', 'eventCode', 'flightType', 'currency', 'priority', 'dayNight', 'crewGroup', 'crewGroupKey', 'crewUnitCode', 'crewDisplayLabel', 'aircraftConfigId', 'callsignBase'],
  Trainee: ['rank', 'role', 'service', 'course', 'lmpType', 'academicLmpType', 'seatConfig', 'unit', 'flight', 'location', 'permissions'],
  CommercialOrganisation: ['code', 'name', 'status', 'settings'],
  CommercialLocation: ['organisationCode', 'code', 'iataCode', 'name', 'trainingAreas', 'status', 'settings'],
  CommercialUnit: ['organisationCode', 'locationCode', 'code', 'name', 'unitType', 'status', 'settings'],
  CommercialAircraftType: ['code', 'name', 'category', 'status', 'settings'],
  CommercialResourcePool: ['organisationCode', 'locationCode', 'unitCode', 'aircraftTypeCode', 'code', 'name', 'poolType', 'status', 'settings'],
  CommercialModule: ['code', 'name', 'description', 'status'],
  CommercialUnitModule: ['unitCode', 'moduleCode', 'isEnabled', 'settings'],
  CommercialSchedulingRuleSet: ['organisationCode', 'unitCode', 'aircraftTypeCode', 'name', 'scope', 'rules', 'isActive'],
  AppSettings: ['orgId', 'data'],
  UserSettings: ['settings'],
};

const FIELD_DENY = /(password|token|secret|session|email|phone|mobile|address|ipaddress|useragent|username|userid|userdbid|firstname|lastname|fullname|displayname|personname|traineefullname|instructorname|name$|callsignnumber|idnumber|notes?|comment|photo|hash|fingerprint|licensekey|activation)/i;
const SAFE_NAME_FIELD = /^(name)$/i;
const SAFE_NAME_MODELS = new Set([
  'Course',
  'CommercialOrganisation',
  'CommercialLocation',
  'CommercialUnit',
  'CommercialAircraftType',
  'CommercialResourcePool',
  'CommercialModule',
  'CommercialSchedulingRuleSet',
]);
const JSON_KEY_ALLOW = /(course|unit|location|organisation|organization|icao|iata|lmp|event|lesson|syllabus|package|aircraft|simulator|resource|pool|service|rank|role|permission|qualification|currency|category|status|reason|code|type|label|flight|rule|priority|availability|unavailability|turnaround|dispatch|authorisation|authorization|warning|group|module|crew|seat|configuration|config)/i;
const JSON_KEY_DENY = /(password|token|secret|session|email|phone|mobile|address|ip|useragent|username|userid|firstname|lastname|fullname|displayname|personname|traineefullname|instructorname|name$|notes?|comment|photo|hash|fingerprint|license|activation|by$|created|updated|saved|recorded|published|changed|cancelled)/i;
const VALUE_DENY = /(@|https?:\/\/|bearer\s+|-----BEGIN|^\+?\d[\d\s\-()]{6,}$)/i;
const HUMAN_NAME_LIKE = /^[A-Z][a-z]+,\s*[A-Z][a-z]+(?:\s*-\s*\d+)?$|^[A-Z][a-z]+\s+[A-Z][a-z]+$/;

const normalise = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const lowerFirst = (value) => value ? value.charAt(0).toLowerCase() + value.slice(1) : value;

function loadLocalEnv() {
  ['.env.local', '.env'].forEach((fileName) => {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return;
      const [, key, rawValue] = match;
      if (process.env[key] != null) return;
      const value = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
      process.env[key] = value;
    });
  });
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createEmptyVocabulary(message = '') {
  return {
    schemaVersion: 'neo-guide-db-vocabulary.v1',
    generatedAt: new Date().toISOString(),
    source: {
      type: 'customer-database-safe-vocabulary',
      databaseConnected: false,
      message,
      modelsScanned: 0,
      recordsScanned: 0,
      fieldsScanned: 0,
    },
    privacy: {
      mode: 'allowlisted-operational-terms-only',
      excludes: [
        'passwords',
        'tokens',
        'secrets',
        'session identifiers',
        'emails',
        'phone numbers',
        'personal names',
        'free-text notes',
        'usernames',
        'raw schedule payloads',
      ],
    },
    terminologyIndex: [],
  };
}

function isSafeField(modelName, fieldName) {
  if (!SAFE_MODEL_FIELDS[modelName]?.includes(fieldName)) return false;
  if (SAFE_NAME_FIELD.test(fieldName)) return SAFE_NAME_MODELS.has(modelName);
  return !FIELD_DENY.test(fieldName);
}

function isSafeJsonKey(keyPath) {
  const key = String(keyPath || '');
  if (!JSON_KEY_ALLOW.test(key)) return false;
  if (JSON_KEY_DENY.test(key)) return false;
  return true;
}

function isSafeTerm(value) {
  const term = String(value ?? '').trim();
  if (term.length < 2 || term.length > MAX_TERM_LENGTH) return false;
  if (VALUE_DENY.test(term)) return false;
  if (HUMAN_NAME_LIKE.test(term)) return false;
  if (/^[a-f0-9]{16,}$/i.test(term)) return false;
  if (/^\d+$/.test(term)) return false;
  if (/^[{}\[\]]/.test(term)) return false;
  return true;
}

function addTerm(terms, term, source) {
  if (!isSafeTerm(term)) return;
  const cleaned = String(term).trim().replace(/\s+/g, ' ');
  const key = normalise(cleaned);
  if (!key) return;
  const entry = terms.get(key) || { term: cleaned, normalised: key, sources: new Set(), count: 0 };
  entry.count += 1;
  entry.sources.add(source);
  terms.set(key, entry);
}

function collectJsonTerms(terms, value, source, keyPath = '', depth = 0) {
  if (depth > 6 || value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (isSafeJsonKey(keyPath)) addTerm(terms, String(value), `${source}.${keyPath}`);
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 600).forEach((item, index) => collectJsonTerms(terms, item, source, keyPath, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, nextValue]) => {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      if (typeof nextValue === 'string' || typeof nextValue === 'number' || typeof nextValue === 'boolean') {
        if (isSafeJsonKey(nextPath)) addTerm(terms, String(nextValue), `${source}.${nextPath}`);
        return;
      }
      if (isSafeJsonKey(nextPath) || depth < 2) collectJsonTerms(terms, nextValue, source, nextPath, depth + 1);
    });
  }
}

async function collectDatabaseVocabulary() {
  if (skipDb) return createEmptyVocabulary('Database scan skipped by --skip-db.');
  loadLocalEnv();
  if (!process.env.DATABASE_URL) {
    return createEmptyVocabulary('DATABASE_URL is not configured; database vocabulary was not scanned.');
  }

  const prisma = new PrismaClient();
  const terms = new Map();
  const availableModels = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
  let modelsScanned = 0;
  let recordsScanned = 0;
  let fieldsScanned = 0;
  const errors = [];

  try {
    for (const [modelName, wantedFields] of Object.entries(SAFE_MODEL_FIELDS)) {
      const model = availableModels.get(modelName);
      const delegate = prisma[lowerFirst(modelName)];
      if (!model || !delegate?.findMany) continue;
      const fields = wantedFields.filter((fieldName) => model.fields.some((field) => field.name === fieldName) && isSafeField(modelName, fieldName));
      if (!fields.length) continue;
      const select = Object.fromEntries(fields.map((fieldName) => [fieldName, true]));
      try {
        const rows = await delegate.findMany({ select, take: MAX_RECORDS_PER_MODEL });
        modelsScanned += 1;
        recordsScanned += rows.length;
        fieldsScanned += fields.length;
        rows.forEach((row) => {
          fields.forEach((fieldName) => {
            const value = row[fieldName];
            const source = `db:${modelName}.${fieldName}`;
            if (value == null) return;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              addTerm(terms, String(value), source);
              return;
            }
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') addTerm(terms, String(item), source);
                else collectJsonTerms(terms, item, source, fieldName);
              });
              return;
            }
            collectJsonTerms(terms, value, source, fieldName);
          });
        });
      } catch (error) {
        errors.push(`${modelName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const terminologyIndex = Array.from(terms.values())
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, MAX_TERMS)
    .map((entry) => ({
      term: entry.term,
      normalised: entry.normalised,
      aliases: [],
      sources: Array.from(entry.sources).sort().slice(0, 12),
      count: entry.count,
    }));

  return {
    schemaVersion: 'neo-guide-db-vocabulary.v1',
    generatedAt: new Date().toISOString(),
    source: {
      type: 'customer-database-safe-vocabulary',
      databaseConnected: true,
      modelsScanned,
      recordsScanned,
      fieldsScanned,
      errors,
    },
    privacy: {
      mode: 'allowlisted-operational-terms-only',
      excludes: [
        'passwords',
        'tokens',
        'secrets',
        'session identifiers',
        'emails',
        'phone numbers',
        'personal names',
        'free-text notes',
        'usernames',
        'raw schedule payloads',
      ],
    },
    terminologyIndex,
  };
}

const vocabulary = await collectDatabaseVocabulary();
const output = JSON.stringify(vocabulary, null, 2);

[publicOutputPath, platformOutputPath, localOutputPath].forEach((filePath) => {
  ensureParent(filePath);
  fs.writeFileSync(filePath, output);
});

console.log(`# NEO Guide Database Vocabulary`);
console.log(`Generated: ${vocabulary.generatedAt}`);
console.log(`Database connected: ${vocabulary.source.databaseConnected ? 'yes' : 'no'}`);
console.log(`Terms: ${vocabulary.terminologyIndex.length}`);
console.log(`Wrote ${path.relative(repoRoot, publicOutputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, platformOutputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, localOutputPath)}`);
if (vocabulary.source.message) console.log(`Note: ${vocabulary.source.message}`);
if (vocabulary.source.errors?.length) {
  console.log(`Warnings: ${vocabulary.source.errors.length} model scan issue(s).`);
}
