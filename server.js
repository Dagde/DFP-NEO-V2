import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import {
  buildImportedLicenseRecord,
  evaluateCommercialLicenses,
  getDeploymentFingerprint,
  getLicenseRuntimeMode,
  signLicensePayload,
  verifySignedLicenseContent,
} from './lib/licensing.js';
import {
  DEFAULT_AIRFIELD_SOLAR_PROFILES,
  getDefaultAirfieldSolarProfile,
  isValidLatitude,
  isValidLongitude,
  isValidTimeZone,
} from './utils/sunTimes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Training Intelligence Engine
const { ensureTIETables, seedTIEDefaults, runTIEAnalytics } = require('./tie-engine.cjs');

// Cookie parser
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const KNOWN_AIRFIELD_IDENTITIES = Object.values(DEFAULT_AIRFIELD_SOLAR_PROFILES || {})
  .filter((profile) => profile?.icao && profile?.iataCode)
  .map((profile) => ({
    legacyCode: String(profile.code || profile.iataCode || '').trim().toUpperCase(),
    iataCode: String(profile.iataCode || profile.code || '').trim().toUpperCase(),
    icaoCode: String(profile.icao || '').trim().toUpperCase(),
    name: profile.name,
    latitude: profile.latitude,
    longitude: profile.longitude,
    timezone: profile.timezone,
  }))
  .filter((profile) => profile.legacyCode && profile.icaoCode);

const DEFAULT_ALLOWED_ORIGINS = [];
const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

app.set('trust proxy', true);

function parseOrigins(value) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const configured = parseOrigins(process.env.DFP_NEO_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
  const origins = configured.length > 0 ? [...configured] : [...DEFAULT_ALLOWED_ORIGINS];
  if (process.env.NODE_ENV !== 'production') {
    origins.push(...DEVELOPMENT_ALLOWED_ORIGINS);
  }
  return new Set(origins);
}

function getRequestOrigin(req) {
  return req.protocol + '://' + req.get('host');
}

function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === getRequestOrigin(req)) return true;
  return getAllowedOrigins().has(origin);
}

function requireConfiguredSecret(name, developmentFallback, aliases = []) {
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value && value.trim()) return value;
  }
  if (process.env.NODE_ENV === 'production') {
    const alternatives = aliases.length ? ` or ${aliases.join(' / ')}` : '';
    throw new Error(`${name}${alternatives} must be configured in production`);
  }
  console.warn(`⚠️ ${name} is not configured; using development-only fallback.`);
  return developmentFallback;
}

// JWT Configuration
const JWT_SECRET = requireConfiguredSecret('JWT_SECRET', 'dfp-neo-development-jwt-secret', ['NEXTAUTH_SECRET', 'AUTH_SECRET']);
const JWT_ACCESS_EXPIRY = '1h';
const JWT_REFRESH_EXPIRY = '7d';

// Parse JSON bodies - increased limit to handle large settings/syllabus payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// CORS headers for all requests. Never use a wildcard origin; browser callers
// must be same-origin or listed in DFP_NEO_ALLOWED_ORIGINS / ALLOWED_ORIGINS.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }

  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Cookie, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Lazy-load Prisma to avoid issues at startup
let prisma = null;
async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Prisma connected to database');
    // Ensure AircraftAvailabilityHistory table exists (create if missing)
    await ensureAircraftAvailabilityTable(prisma);
    // Ensure AircraftAvailabilityEvent table exists (create if missing)
    await ensureAircraftAvailabilityEventTable(prisma);
    // Ensure CancellationCode table exists and seed defaults
    await ensureCancellationCodesTable(prisma);
    await seedCancellationCodesIfEmpty(prisma);
    // Ensure IndividualLMP table exists (create if missing)
    await ensureIndividualLMPTable(prisma);
    await ensureTraineeLmpOverlayTable(prisma);
    await migrateIndividualLmpOverlays(prisma);
    // Ensure DailySnapshot table exists (create if missing)
    await ensureDailySnapshotTable(prisma);
    // Ensure instructor fields are TEXT[] arrays (migrate from String if needed)
    try {
      await ensureInstructorArrayColumns(prisma);
    } catch (migrationErr) {
      console.error('Instructor column migration failed (non-fatal):', migrationErr.message);
    }
    // Ensure Training Intelligence Engine tables exist and defaults are seeded
    try {
      await ensureTIETables(prisma);
      await seedTIEDefaults(prisma);
    } catch (tieErr) {
      console.error('TIE startup failed (non-fatal):', tieErr.message);
    }
    // Ensure TraineePerformance table exists (single source of truth for PT-051 assessments)
    await ensureTraineePerformanceTable(prisma);
    await migrateLegacyPerformanceIntoTraineePerformance(prisma);
    // Ensure AppSettings table exists (stores all org-level settings including currencies)
    await ensureAppSettingsTable(prisma);
    // Ensure commercial platform configuration tables exist and are seeded from current V2 settings
    await ensureCommercialConfigTables(prisma);
    // Ensure CourseSettings and CourseAcademicProgress tables exist
    await ensureCourseSettingsTables(prisma);
    // Ensure Course.lmpType column exists (migration for existing DBs)
    await ensureCourseLmpTypeColumn(prisma);
    await ensureAcademicLmpTypeColumns(prisma);
    // Ensure SyllabusItem and SyllabusHistory tables exist
    await ensureSyllabusTablesExist(prisma);
    // Migrate CPT event durations to 1.0 hour
    await migrateCptDurations(prisma);
    // Fix Academics items: ensure courses[] contains the module name (not the item's own code)
    await migrateAcademicsCoursesField(prisma);
  }
  return prisma;
}

const LOCATION_NAME_BY_CODE = {
  ESL: 'East Sale',
  PEA: 'Pearce',
  AMB: 'Amberley',
  EDI: 'Edinburgh',
  TIN: 'Tindal',
  WLM: 'Williamtown',
};

const LOCATION_CODE_BY_NAME = Object.fromEntries(
  Object.entries(LOCATION_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code])
);

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function parseScopeValues(...values) {
  return uniqueStrings(values.flatMap((value) => {
    if (Array.isArray(value)) return value.flatMap((item) => String(item || '').split(','));
    if (value === undefined || value === null) return [];
    return String(value).split(',');
  }));
}

function normaliseLocationCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (LOCATION_NAME_BY_CODE[upper]) return upper;
  return LOCATION_CODE_BY_NAME[raw.toLowerCase()] || upper;
}

function expandLocationValues(values) {
  const expanded = [];
  values.forEach((value) => {
    const raw = String(value || '').trim();
    const code = normaliseLocationCode(raw);
    if (raw) expanded.push(raw);
    if (code) expanded.push(code);
    if (LOCATION_NAME_BY_CODE[code]) expanded.push(LOCATION_NAME_BY_CODE[code]);
  });
  return uniqueStrings(expanded);
}

function sqlStringList(values) {
  return uniqueStrings(values)
    .map((value) => `'${String(value).replace(/'/g, "''")}'`)
    .join(', ');
}

function hasScopeQuery(req) {
  return Boolean(req.query?.organisation || req.query?.organisations || req.query?.location || req.query?.locations || req.query?.unit || req.query?.units);
}

async function getUnitCodesForLocationScope(db, locationValues) {
  const locationCodes = uniqueStrings(locationValues.map(normaliseLocationCode));
  if (locationCodes.length === 0) return [];
  const codeSql = sqlStringList(locationCodes);
  if (!codeSql) return [];
  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT "code"
      FROM "CommercialUnit"
      WHERE COALESCE("status", 'ACTIVE') <> 'INACTIVE'
        AND "locationCode" IN (${codeSql})
    `);
    return uniqueStrings((rows || []).map((row) => row.code));
  } catch (error) {
    console.warn('[DataScope] Could not resolve units for location scope:', error.message);
    return [];
  }
}

async function buildScopedEntityWhere(req, db, fieldNames = { location: 'location', unit: 'unit' }) {
  const locationValues = parseScopeValues(req.query.location, req.query.locations);
  const unitValues = parseScopeValues(req.query.unit, req.query.units);
  const expandedLocationValues = expandLocationValues(locationValues);
  const unitsAtLocation = await getUnitCodesForLocationScope(db, locationValues);

  const conditions = [];
  const locationOr = [];
  if (expandedLocationValues.length > 0) {
    locationOr.push({ [fieldNames.location]: { in: expandedLocationValues } });
  }
  if (unitsAtLocation.length > 0) {
    locationOr.push({ [fieldNames.unit]: { in: unitsAtLocation } });
  }
  if (locationOr.length > 0) {
    conditions.push({ OR: locationOr });
  }
  if (unitValues.length > 0) {
    conditions.push({ [fieldNames.unit]: { in: unitValues } });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function mergeScopedWhere(where, scopedWhere) {
  if (!scopedWhere?.AND?.length) return where;
  return {
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : []), ...scopedWhere.AND],
  };
}

async function getScopedCourseCodes(db, req) {
  if (!hasScopeQuery(req)) return [];
  const scopedWhere = await buildScopedEntityWhere(req, db);
  const courses = await db.course.findMany({
    where: scopedWhere,
    select: { code: true, name: true },
  });
  return uniqueStrings(courses.flatMap((course) => [course.code, course.name]));
}

// Create SyllabusItem and SyllabusHistory tables if they don't exist
async function ensureSyllabusTablesExist(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SyllabusItem" (
        "id"                   TEXT NOT NULL,
        "code"                 TEXT NOT NULL,
        "eventDescription"     TEXT NOT NULL,
        "phase"                TEXT NOT NULL,
        "module"               TEXT NOT NULL,
        "type"                 TEXT NOT NULL,
        "sortieType"           TEXT,
        "dayNight"             TEXT NOT NULL DEFAULT 'Day',
        "courses"              TEXT[] NOT NULL DEFAULT '{}',
        "methodOfDelivery"     TEXT[] NOT NULL DEFAULT '{}',
        "methodOfAssessment"   TEXT[] NOT NULL DEFAULT '{}',
        "resourcesPhysical"    TEXT[] NOT NULL DEFAULT '{}',
        "resourceNumber"       INTEGER NOT NULL DEFAULT 1,
        "acceptableAircraftConfigs" TEXT[] NOT NULL DEFAULT ARRAY['ANY']::text[],
        "resourcesHuman"       TEXT[] NOT NULL DEFAULT '{}',
        "eventDetailsCommon"   TEXT[] NOT NULL DEFAULT '{}',
        "eventDetailsSortie"   TEXT[] NOT NULL DEFAULT '{}',
        "flightOrSimHours"     DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalEventHours"      DOUBLE PRECISION NOT NULL DEFAULT 0,
        "duration"             DOUBLE PRECISION NOT NULL DEFAULT 0,
        "preFlightTime"        DOUBLE PRECISION NOT NULL DEFAULT 0,
        "postFlightTime"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "prerequisites"        TEXT[] NOT NULL DEFAULT '{}',
        "prerequisitesGround"  TEXT[] NOT NULL DEFAULT '{}',
        "prerequisitesFlying"  TEXT[] NOT NULL DEFAULT '{}',
        "location"             TEXT,
        "sortOrder"            INTEGER NOT NULL DEFAULT 0,
        "lmpType"              TEXT,
        "twrDiReqd"            TEXT,
        "cctOnly"              TEXT,
        "isRemedial"           BOOLEAN NOT NULL DEFAULT false,
        "isActive"             BOOLEAN NOT NULL DEFAULT true,
        "version"              INTEGER NOT NULL DEFAULT 1,
        "notes"                TEXT,
        "createdBy"            TEXT,
        "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SyllabusItem_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "resourceNumber" INTEGER NOT NULL DEFAULT 1`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "acceptableAircraftConfigs" TEXT[] NOT NULL DEFAULT ARRAY['ANY']::text[]`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusItem_code_key" ON "SyllabusItem"("code")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SyllabusItem_sortOrder_idx" ON "SyllabusItem"("sortOrder")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SyllabusItem_isActive_idx" ON "SyllabusItem"("isActive")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SyllabusHistory" (
        "id"             TEXT NOT NULL,
        "syllabusItemId" TEXT NOT NULL,
        "changeType"     TEXT NOT NULL,
        "changeData"     JSONB NOT NULL,
        "previousData"   JSONB,
        "changedBy"      TEXT,
        "changeReason"   TEXT,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SyllabusHistory_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SyllabusHistory_syllabusItemId_idx" ON "SyllabusHistory"("syllabusItemId")`);

    console.log('✅ SyllabusItem and SyllabusHistory tables ready');
  } catch (err) {
    console.error('❌ Failed to ensure Syllabus tables:', err.message);
  }
}

// Migration: Fix CPT event durations to 1.0 hour (totalEventHours, duration, preFlightTime, postFlightTime)
async function migrateCptDurations(db) {
  try {
    const result = await db.$executeRawUnsafe(`
      UPDATE "SyllabusItem"
      SET
        "totalEventHours" = 1.0,
        "flightOrSimHours" = 1.0,
        "duration" = 1.0,
        "preFlightTime" = 0,
        "postFlightTime" = 0,
        "updatedAt" = NOW()
      WHERE "code" LIKE '%CPT%'
        AND ("totalEventHours" != 1.0 OR "duration" != 1.0 OR "preFlightTime" != 0 OR "postFlightTime" != 0)
    `);
    console.log(`✅ migrateCptDurations (SyllabusItem): updated ${result} CPT items to 1.0 hr duration`);
  } catch (err) {
    console.error('❌ migrateCptDurations (SyllabusItem) failed (non-fatal):', err.message);
  }

  // Also fix duration in IndividualLMP events JSONB
  try {
    // Load all IndividualLMP records
    const lmps = await db.$queryRawUnsafe(`SELECT "id", "events" FROM "IndividualLMP"`);
    let updatedCount = 0;
    for (const lmp of lmps) {
      let events = lmp.events;
      if (!Array.isArray(events)) {
        try { events = JSON.parse(events); } catch { continue; }
      }
      let changed = false;
      const fixedEvents = events.map(evt => {
        const code = (evt.flightNumber || evt.eventCode || '');
        if (code.includes('CPT') && evt.duration !== 1.0) {
          changed = true;
          return { ...evt, duration: 1.0 };
        }
        return evt;
      });
      if (changed) {
        await db.$executeRawUnsafe(
          `UPDATE "IndividualLMP" SET "events" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
          JSON.stringify(fixedEvents),
          lmp.id
        );
        updatedCount++;
      }
    }
    console.log(`✅ migrateCptDurations (IndividualLMP): updated ${updatedCount} LMP records`);
  } catch (err) {
    console.error('❌ migrateCptDurations (IndividualLMP) failed (non-fatal):', err.message);
  }
}

// Fix Academics syllabus items that have courses[] pointing to their own code
// instead of the parent course name (e.g. ['AERODY1'] → ['PC-21 Ground School'])
// This runs at startup and corrects any items created before the fix was deployed.
async function migrateAcademicsCoursesField(db) {
  try {
    // Find all Academics-type items
    const rows = await db.$queryRawUnsafe(`
      SELECT id, code, module, courses
      FROM "SyllabusItem"
      WHERE "type" = 'Academics'
        AND "isActive" = true
    `);

    console.log(`[migrateAcademicsCoursesField] Found ${rows.length} Academics items to check`);
    if (rows.length > 0) {
      // Log first few for diagnosis
      rows.slice(0, 3).forEach(r => {
        console.log(`  Sample: code="${r.code}", module="${r.module}", courses=${JSON.stringify(r.courses)}`);
      });
    }

    let updatedCount = 0;
    let skippedCount = 0;
    for (const row of rows) {
      const courses = Array.isArray(row.courses)
        ? row.courses
        : (typeof row.courses === 'string' ? JSON.parse(row.courses) : []);
      const moduleName = row.module || '';
      
      // Only fix if module is set and courses[] does NOT already contain the module name
      if (moduleName && !courses.includes(moduleName)) {
        // Use ARRAY[$1::text] to set a PostgreSQL TEXT[] with one element
        await db.$executeRawUnsafe(
          `UPDATE "SyllabusItem" SET "courses" = ARRAY[$1::text], "updatedAt" = NOW() WHERE "id" = $2`,
          moduleName,
          row.id
        );
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ migrateAcademicsCoursesField: fixed ${updatedCount} items, skipped ${skippedCount} (already correct)`);
    } else {
      console.log(`✅ migrateAcademicsCoursesField: all ${skippedCount} Academics items already have correct courses[] field`);
    }
  } catch (err) {
    console.error('❌ migrateAcademicsCoursesField failed (non-fatal):', err.message);
  }
}

// ============================================================
// API ROUTES
// ============================================================

// ============================================================
// APP SETTINGS (currencies, org config, etc.) — PERSISTENT
// ============================================================

// GET /api/settings - Load all org settings including currencies
app.get('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const orgId = req.query.orgId || 'default';
    const rows = await db.$queryRawUnsafe(
      `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );
    if (!rows || rows.length === 0) {
      return res.json({ settings: null });
    }
    return res.json({ settings: rows[0].data });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    res.status(500).json({ error: 'Failed to load settings', details: error.message });
  }
});

// POST /api/settings - Save all org settings including currencies
app.post('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const { orgId = 'default', settings, updatedBy } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Missing settings data' });
    }
    const settingsJson = JSON.stringify(settings);
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(`
      INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::timestamp, $4::timestamp)
      ON CONFLICT ("orgId") DO UPDATE SET
        "data" = $2::jsonb,
        "updatedBy" = $3,
        "updatedAt" = $4::timestamp
    `, orgId, settingsJson, updatedBy || null, now);
    console.log(`[Settings] ✅ Saved settings for orgId=${orgId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Settings] POST error:', error);
    res.status(500).json({ error: 'Failed to save settings', details: error.message });
  }
});

// ============================================================
// COMMERCIAL PLATFORM CONFIGURATION
// Stage-one configurable operating model. Existing V2 runtime
// behavior is still read from current settings/tables; these
// tables create the admin-editable foundation for commercial use.
// ============================================================

const normaliseAuditDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const PLATFORM_CONFIG_AUDIT_TABLES = [
  {
    collection: 'organisations',
    entityType: 'CommercialOrganisation',
    fields: ['code', 'name', 'status', 'settings'],
    isValid: (row) => Boolean(row.code && row.name),
    normalise: (row) => ({
      id: row.id || null,
      code: row.code || '',
      name: row.name || '',
      status: row.status || 'ACTIVE',
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, row.code].filter(Boolean),
    label: (row) => row.name || row.code,
  },
  {
    collection: 'locations',
    entityType: 'CommercialLocation',
    fields: ['organisationCode', 'code', 'iataCode', 'name', 'timezoneOffset', 'latitude', 'longitude', 'timezone', 'trainingAreas', 'status', 'settings'],
    isValid: (row) => Boolean(row.code && row.name),
    normalise: (row) => ({
      id: row.id || null,
      organisationCode: row.organisationCode || 'DEFAULT',
      code: row.code || '',
      iataCode: row.iataCode || '',
      name: row.name || '',
      timezoneOffset: Number(row.timezoneOffset ?? 10),
      latitude: row.latitude === null || row.latitude === undefined || row.latitude === '' ? null : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined || row.longitude === '' ? null : Number(row.longitude),
      timezone: row.timezone || null,
      trainingAreas: Array.isArray(row.trainingAreas) ? row.trainingAreas : [],
      status: row.status || 'ACTIVE',
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, row.code].filter(Boolean),
    label: (row) => row.name || row.code,
  },
  {
    collection: 'units',
    entityType: 'CommercialUnit',
    fields: ['organisationCode', 'locationCode', 'code', 'name', 'unitType', 'status', 'settings'],
    isValid: (row) => Boolean(row.code && row.name),
    normalise: (row) => ({
      id: row.id || null,
      organisationCode: row.organisationCode || 'DEFAULT',
      locationCode: row.locationCode || 'ESL',
      code: row.code || '',
      name: row.name || '',
      unitType: row.unitType || 'Training',
      status: row.status || 'ACTIVE',
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, row.code].filter(Boolean),
    label: (row) => row.name || row.code,
  },
  {
    collection: 'aircraftTypes',
    entityType: 'CommercialAircraftType',
    fields: ['code', 'name', 'category', 'status', 'settings'],
    isValid: (row) => Boolean(row.code && row.name),
    normalise: (row) => ({
      id: row.id || null,
      code: row.code || '',
      name: row.name || '',
      category: row.category || 'Training',
      status: row.status || 'ACTIVE',
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, row.code].filter(Boolean),
    label: (row) => row.name || row.code,
  },
  {
    collection: 'resourcePools',
    entityType: 'CommercialResourcePool',
    fields: ['organisationCode', 'locationCode', 'unitCode', 'aircraftTypeCode', 'code', 'name', 'poolType', 'status', 'settings'],
    isValid: (row) => Boolean(row.code && row.name),
    normalise: (row) => ({
      id: row.id || null,
      organisationCode: row.organisationCode || 'DEFAULT',
      locationCode: row.locationCode || null,
      unitCode: row.unitCode || null,
      aircraftTypeCode: row.aircraftTypeCode || null,
      code: row.code || '',
      name: row.name || '',
      poolType: row.poolType || 'Dedicated',
      status: row.status || 'ACTIVE',
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, row.code].filter(Boolean),
    label: (row) => row.name || row.code,
  },
  {
    collection: 'unitModules',
    entityType: 'CommercialUnitModule',
    fields: ['unitCode', 'moduleCode', 'isEnabled', 'settings'],
    isValid: (row) => Boolean(row.unitCode && row.moduleCode),
    normalise: (row) => ({
      id: row.id || null,
      unitCode: row.unitCode || '',
      moduleCode: row.moduleCode || '',
      isEnabled: row.isEnabled !== false,
      settings: row.settings || {},
    }),
    keys: (row) => [row.id, [row.unitCode, row.moduleCode].join('|')].filter(Boolean),
    label: (row) => `${row.unitCode || 'Unit'} / ${row.moduleCode || 'Module'}`,
  },
  {
    collection: 'licenses',
    entityType: 'CommercialLicense',
    fields: ['organisationCode', 'licenseKey', 'licenseName', 'deploymentMode', 'status', 'validFrom', 'validUntil', 'maxUsers', 'maxUnits', 'maxAircraftTypes', 'moduleCodes', 'features', 'offlineFingerprint', 'notes'],
    isValid: (row) => Boolean(row.licenseKey && row.licenseName),
    normalise: (row) => ({
      id: row.id || null,
      organisationCode: row.organisationCode || 'DEFAULT',
      licenseKey: row.licenseKey || '',
      licenseName: row.licenseName || '',
      deploymentMode: row.deploymentMode || 'Online SaaS',
      status: row.status || 'ACTIVE',
      validFrom: normaliseAuditDateOnly(row.validFrom),
      validUntil: normaliseAuditDateOnly(row.validUntil),
      maxUsers: row.maxUsers === null || row.maxUsers === undefined || row.maxUsers === '' ? null : Number(row.maxUsers),
      maxUnits: row.maxUnits === null || row.maxUnits === undefined || row.maxUnits === '' ? null : Number(row.maxUnits),
      maxAircraftTypes: row.maxAircraftTypes === null || row.maxAircraftTypes === undefined || row.maxAircraftTypes === '' ? null : Number(row.maxAircraftTypes),
      moduleCodes: Array.isArray(row.moduleCodes) ? row.moduleCodes : [],
      features: row.features || {},
      offlineFingerprint: row.offlineFingerprint || null,
      notes: row.notes || null,
    }),
    keys: (row) => [row.id, row.licenseKey].filter(Boolean),
    label: (row) => row.licenseName || row.licenseKey,
  },
  {
    collection: 'schedulingRuleSets',
    entityType: 'CommercialSchedulingRuleSet',
    fields: ['organisationCode', 'unitCode', 'aircraftTypeCode', 'name', 'scope', 'rules', 'isActive'],
    isValid: () => true,
    normalise: (row) => ({
      id: row.id || null,
      organisationCode: row.organisationCode || 'DEFAULT',
      unitCode: row.unitCode || null,
      aircraftTypeCode: row.aircraftTypeCode || null,
      name: row.name || 'Default Scheduling Rules',
      scope: row.scope || 'Unit',
      rules: row.rules || {},
      isActive: row.isActive !== false,
    }),
    keys: (row) => [row.id, [row.organisationCode, row.unitCode || '', row.aircraftTypeCode || '', row.name].join('|')].filter(Boolean),
    label: (row) => row.name || 'Scheduling Rules',
  },
  {
    collection: 'userAccess',
    entityType: 'CommercialUserAccess',
    fields: ['userId', 'username', 'displayName', 'organisationCode', 'locationCode', 'unitCode', 'moduleCode', 'role', 'accessLevel', 'status', 'settings'],
    isValid: (row) => Boolean(row.userId),
    normalise: (row) => {
      const scopeKey = [
        row.userId,
        row.organisationCode || 'DEFAULT',
        row.locationCode || '',
        row.unitCode || '',
        row.moduleCode || '',
      ].join('|');
      return {
        id: row.id || null,
        userId: row.userId || '',
        username: row.username || null,
        displayName: row.displayName || null,
        organisationCode: row.organisationCode || 'DEFAULT',
        locationCode: row.locationCode || null,
        unitCode: row.unitCode || null,
        moduleCode: row.moduleCode || null,
        scopeKey: row.scopeKey || scopeKey,
        role: row.role || 'Viewer',
        accessLevel: row.accessLevel || 'Read',
        status: row.status || 'ACTIVE',
        settings: row.settings || {},
      };
    },
    keys: (row) => [row.id, row.scopeKey].filter(Boolean),
    label: (row) => `${row.displayName || row.username || row.userId} / ${row.locationCode || 'All locations'} / ${row.unitCode || 'All units'}`,
  },
];

const PLATFORM_PERMISSION_PROFILE_LABELS = {
  trainee: 'Trainee',
  instructor: 'Instructor',
  'flying-supervisor': 'Flying Supervisor',
  scheduler: 'Scheduler',
  'unit-admin': 'Unit Admin',
  'super-admin': 'Super Admin',
};

const PLATFORM_PERMISSION_LABELS = {
  'dfp.view': 'View DFP',
  'dfp.editTiles': 'Add, edit and delete tiles',
  'dfp.validation': 'Run validation checks',
  'dfp.publish': 'Publish DFP',
  'dfp.history': 'View historical DFP records',
  'neo.run': 'Run NEO Build',
  'neo.priorities': 'Edit build priorities',
  'neo.intelligence': 'View build intelligence',
  'neo.override': 'Override build results',
  'staff.view': 'View staff roster',
  'staff.edit': 'Edit staff details',
  'staff.currency.view': 'View staff currencies',
  'staff.currency.edit': 'Edit staff currencies',
  'trainee.roster.view': 'View trainee roster',
  'trainee.profile.own': 'View own trainee profile',
  'trainee.profile.others': 'View other trainee profiles',
  'trainee.pt051.own': 'View own PT-051',
  'trainee.pt051.others': 'View other trainee PT-051',
  'trainee.pt051.edit': 'Edit PT-051',
  'trainee.lmp.own': 'View own individual LMP',
  'trainee.lmp.others': 'View other trainee individual LMP',
  'trainee.remedial.add': 'Add remedial package',
  'reporting.view': 'View reports and analytics',
  'reporting.export': 'Export reports and records',
  'settings.view': 'View settings',
  'settings.schedulingRules.edit': 'Edit scheduling rules',
  'settings.userAccess.edit': 'Edit user permissions',
  'settings.platform.edit': 'Edit platform configuration',
  'settings.superAdmin': 'Super Admin: unrestricted platform access',
};

const PLATFORM_FIELD_LABELS = {
  CommercialOrganisation: {
    code: 'Organisation code',
    name: 'Organisation name',
    status: 'Organisation status',
    'settings.permissionProfiles': 'Permission profile definitions',
    'settings.deploymentProfile.authModel': 'Authentication model',
    'settings.deploymentProfile.checkIntervalHours': 'Licence check interval hours',
    'settings.deploymentProfile.dataResidence': 'Data residence',
    'settings.deploymentProfile.enforcementMode': 'Licence enforcement mode',
    'settings.deploymentProfile.mode': 'Deployment mode',
    'settings.deploymentProfile.networkPosture': 'Network posture',
    'settings.deploymentProfile.notes': 'Deployment notes',
    'settings.deploymentProfile.offlineGraceDays': 'Offline grace days',
    'settings.deploymentProfile.validationMethod': 'Licence validation method',
    'settings.deploymentReadiness.auditExport': 'Readiness: audit export process defined',
    'settings.deploymentReadiness.backupRestore': 'Readiness: backup and restore process defined',
    'settings.deploymentReadiness.localAuthentication': 'Readiness: local authentication path defined',
    'settings.deploymentReadiness.localDatabase': 'Readiness: local database defined',
    'settings.deploymentReadiness.localFileStorage': 'Readiness: local file storage path defined',
    'settings.deploymentReadiness.localWebServer': 'Readiness: local web server defined',
    'settings.deploymentReadiness.offlineLicenceFile': 'Readiness: offline licence file process defined',
    'settings.deploymentReadiness.updateProcess': 'Readiness: update process defined',
    'settings.operationalRunbook.accreditationStatus': 'Accreditation status',
    'settings.operationalRunbook.approvingAuthority': 'Operational approving authority',
    'settings.operationalRunbook.auditRetentionYears': 'Audit retention years',
    'settings.operationalRunbook.backupFrequency': 'Backup frequency',
    'settings.operationalRunbook.backupRetentionDays': 'Backup retention days',
    'settings.operationalRunbook.backupStorageLocation': 'Backup storage location',
    'settings.operationalRunbook.deploymentIdentifier': 'Deployment identifier',
    'settings.operationalRunbook.environmentName': 'Environment name',
    'settings.operationalRunbook.evidenceExportPath': 'Evidence export path',
    'settings.operationalRunbook.lastBackupDate': 'Last backup date',
    'settings.operationalRunbook.lastRestoreTestDate': 'Last restore test date',
    'settings.operationalRunbook.lastUpdateDate': 'Last update date',
    'settings.operationalRunbook.maintenanceWindow': 'Maintenance window',
    'settings.operationalRunbook.notes': 'Operational notes',
    'settings.operationalRunbook.releaseChannel': 'Release channel',
    'settings.operationalRunbook.restorePointObjectiveHours': 'Restore point objective hours',
    'settings.operationalRunbook.restoreTimeObjectiveHours': 'Restore time objective hours',
    'settings.operationalRunbook.supportContact': 'Support contact',
    'settings.operationalRunbook.supportOwner': 'Support owner',
    'settings.operationalRunbook.updateApprovalProcess': 'Update approval process',
  },
  CommercialLocation: {
    organisationCode: 'Organisation',
    code: 'ICAO code',
    iataCode: 'IATA code',
    name: 'Location name',
    timezoneOffset: 'UTC offset',
    latitude: 'Latitude',
    longitude: 'Longitude',
    timezone: 'IANA timezone',
    trainingAreas: 'Training areas',
    status: 'Location status',
  },
  CommercialUnit: {
    organisationCode: 'Organisation',
    locationCode: 'Location',
    code: 'Unit code',
    name: 'Unit name',
    unitType: 'Unit type',
    status: 'Unit status',
  },
  CommercialAircraftType: {
    code: 'Aircraft type code',
    name: 'Aircraft type name',
    category: 'Aircraft category',
    status: 'Aircraft type status',
  },
  CommercialResourcePool: {
    organisationCode: 'Organisation',
    locationCode: 'Location',
    unitCode: 'Unit',
    aircraftTypeCode: 'Aircraft type',
    code: 'Resource pool code',
    name: 'Resource pool name',
    poolType: 'Resource pool type',
    status: 'Resource pool status',
    'settings.aircraftLabel': 'Aircraft display name',
    'settings.aircraftNumberUsePrefix': 'Aircraft number prefix enabled',
    'settings.aircraftNumberPrefixes': 'Aircraft number prefixes',
    'settings.aircraftNumberDefaultPrefix': 'Default aircraft number prefix',
    'settings.ftdLabel': 'Simulator display name',
    'settings.cptLabel': 'Procedural trainer display name',
    'settings.aircraft': 'Aircraft rows',
    'settings.ftd': 'Simulator rows',
    'settings.cpt': 'Procedural trainer rows',
    'settings.standby': 'STBY rows',
    'settings.ground': 'Ground rows',
    'settings.applyToV2Runtime': 'Apply resource pool to V2 DFP',
  },
  CommercialUnitModule: {
    unitCode: 'Unit',
    moduleCode: 'Module',
    isEnabled: 'Module enabled',
  },
  CommercialLicense: {
    organisationCode: 'Organisation',
    licenseKey: 'Licence key',
    licenseName: 'Licence name',
    deploymentMode: 'Deployment model',
    status: 'Licence status',
    validFrom: 'Valid from',
    validUntil: 'Valid until',
    maxUsers: 'Maximum users',
    maxUnits: 'Maximum units',
    maxAircraftTypes: 'Maximum aircraft types',
    moduleCodes: 'Licensed modules',
    features: 'Licensed features',
    'features.allowOfflineOperation': 'Allow offline operation',
    'features.enforcementMode': 'Licence enforcement mode',
    'features.offlineGraceDays': 'Offline grace days',
    'features.validationMethod': 'Licence validation method',
    offlineFingerprint: 'Offline fingerprint',
    notes: 'Licence notes',
  },
  CommercialSchedulingRuleSet: {
    organisationCode: 'Organisation',
    unitCode: 'Unit',
    aircraftTypeCode: 'Aircraft type',
    name: 'Rule set name',
    scope: 'Rule set scope',
    isActive: 'Rule set active',
  },
  CommercialUserAccess: {
    userId: 'User ID',
    username: 'Username',
    displayName: 'Display name',
    organisationCode: 'Organisation',
    locationCode: 'Location',
    unitCode: 'Unit',
    moduleCode: 'Feature area',
    role: 'Administration level',
    accessLevel: 'Access',
    status: 'Access scope status',
    'settings.permissionProfileIds': 'Permission profiles',
  },
};

const PLATFORM_ENTITY_LABELS = {
  CommercialOrganisation: 'organisation',
  CommercialLocation: 'location',
  CommercialUnit: 'unit',
  CommercialAircraftType: 'aircraft type',
  CommercialResourcePool: 'resource pool',
  CommercialUnitModule: 'unit module',
  CommercialLicense: 'licence',
  CommercialSchedulingRuleSet: 'scheduling rule set',
  CommercialUserAccess: 'access scope',
};

const normaliseAuditValue = (value) => {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normaliseAuditValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((next, key) => {
      next[key] = normaliseAuditValue(value[key]);
      return next;
    }, {});
  }
  return value;
};

const auditValueString = (value) => JSON.stringify(normaliseAuditValue(value));

const auditArrayString = (value) => JSON.stringify((Array.isArray(value) ? value : []).map(String).sort());

const toTitleCase = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const getAuditFieldLabel = (entityType, field) => {
  if (field?.startsWith('settings.permissionProfiles.')) {
    return field.split('.').slice(-1)[0] || 'Permission profile setting';
  }
  return PLATFORM_FIELD_LABELS[entityType]?.[field]
    || PLATFORM_FIELD_LABELS[entityType]?.[field?.replace(/\.\d+\./g, '.')]
    || toTitleCase(field);
};

const formatPermissionProfileList = (value) => {
  const ids = Array.isArray(value) ? value : [];
  if (ids.length === 0) return 'No permission profiles';
  return ids
    .map((id) => PLATFORM_PERMISSION_PROFILE_LABELS[id] || id)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
};

const formatPermissionList = (value) => {
  const ids = Array.isArray(value) ? value : [];
  if (ids.length === 0) return 'No permissions';
  return ids
    .map((id) => PLATFORM_PERMISSION_LABELS[id] || id)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
};

const formatAuditValue = (entityType, field, value) => {
  if (value === undefined || value === null || value === '') {
    if (entityType === 'CommercialUserAccess') {
      if (field === 'locationCode') return 'All locations';
      if (field === 'unitCode') return 'All units';
      if (field === 'moduleCode') return 'All enabled features';
    }
    return 'blank';
  }

  if (field === 'settings.permissionProfileIds') return formatPermissionProfileList(value);
  if (field?.includes('.permissions.') && typeof value === 'boolean') return value ? 'Allowed' : 'Not allowed';
  if (field?.endsWith('.permissions')) return formatPermissionList(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'blank';
  if (value && typeof value === 'object') return JSON.stringify(normaliseAuditValue(value));
  return String(value);
};

const makeAuditChangedField = (entityType, field, before, after, labelOverride = null) => ({
  field,
  label: labelOverride || getAuditFieldLabel(entityType, field),
  before: normaliseAuditValue(before),
  after: normaliseAuditValue(after),
  displayBefore: formatAuditValue(entityType, field, before),
  displayAfter: formatAuditValue(entityType, field, after),
});

const pushGenericSettingsDiffs = (entityType, beforeValue, afterValue, path, output) => {
  const beforeNormalised = normaliseAuditValue(beforeValue);
  const afterNormalised = normaliseAuditValue(afterValue);

  if (auditValueString(beforeNormalised) === auditValueString(afterNormalised)) return;

  const beforeIsObject = beforeNormalised && typeof beforeNormalised === 'object' && !Array.isArray(beforeNormalised);
  const afterIsObject = afterNormalised && typeof afterNormalised === 'object' && !Array.isArray(afterNormalised);

  if (beforeIsObject || afterIsObject) {
    const keys = new Set([
      ...Object.keys(beforeIsObject ? beforeNormalised : {}),
      ...Object.keys(afterIsObject ? afterNormalised : {}),
    ]);
    for (const key of [...keys].sort()) {
      pushGenericSettingsDiffs(
        entityType,
        beforeIsObject ? beforeNormalised[key] : undefined,
        afterIsObject ? afterNormalised[key] : undefined,
        `${path}.${key}`,
        output
      );
    }
    return;
  }

  output.push(makeAuditChangedField(entityType, path, beforeNormalised, afterNormalised));
};

const describePermissionProfileChanges = (beforeProfiles, afterProfiles) => {
  const changedFields = [];
  const beforeMap = new Map((Array.isArray(beforeProfiles) ? beforeProfiles : []).map((profile) => [profile.id, profile]));
  const afterMap = new Map((Array.isArray(afterProfiles) ? afterProfiles : []).map((profile) => [profile.id, profile]));
  const profileIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const profileId of [...profileIds].sort()) {
    const beforeProfile = beforeMap.get(profileId) || {};
    const afterProfile = afterMap.get(profileId) || {};
    const profileName = afterProfile.name || beforeProfile.name || PLATFORM_PERMISSION_PROFILE_LABELS[profileId] || profileId;

    if ((beforeProfile.name || '') !== (afterProfile.name || '')) {
      changedFields.push(makeAuditChangedField(
        'CommercialOrganisation',
        `settings.permissionProfiles.${profileId}.name`,
        beforeProfile.name || '',
        afterProfile.name || '',
        `${profileName}: profile name`
      ));
    }

    if ((beforeProfile.description || '') !== (afterProfile.description || '')) {
      changedFields.push(makeAuditChangedField(
        'CommercialOrganisation',
        `settings.permissionProfiles.${profileId}.description`,
        beforeProfile.description || '',
        afterProfile.description || '',
        `${profileName}: description`
      ));
    }

    const beforePermissions = Array.isArray(beforeProfile.permissions) ? beforeProfile.permissions : [];
    const afterPermissions = Array.isArray(afterProfile.permissions) ? afterProfile.permissions : [];
    if (auditArrayString(beforePermissions) !== auditArrayString(afterPermissions)) {
      const permissionIds = new Set([...beforePermissions, ...afterPermissions]);
      for (const permissionId of [...permissionIds].sort()) {
        const beforeHasPermission = beforePermissions.includes(permissionId);
        const afterHasPermission = afterPermissions.includes(permissionId);
        if (beforeHasPermission === afterHasPermission) continue;
        changedFields.push(makeAuditChangedField(
          'CommercialOrganisation',
          `settings.permissionProfiles.${profileId}.permissions.${permissionId}`,
          beforeHasPermission,
          afterHasPermission,
          `${profileName}: ${PLATFORM_PERMISSION_LABELS[permissionId] || permissionId}`
        ));
      }
    }
  }

  return changedFields;
};

const describeSettingsChanges = (entityType, beforeSettings, afterSettings) => {
  const changedFields = [];
  const beforeSafe = beforeSettings && typeof beforeSettings === 'object' ? beforeSettings : {};
  const afterSafe = afterSettings && typeof afterSettings === 'object' ? afterSettings : {};

  if (entityType === 'CommercialUserAccess') {
    const beforeProfiles = Array.isArray(beforeSafe.permissionProfileIds) ? beforeSafe.permissionProfileIds : [];
    const afterProfiles = Array.isArray(afterSafe.permissionProfileIds) ? afterSafe.permissionProfileIds : [];
    if (auditArrayString(beforeProfiles) !== auditArrayString(afterProfiles)) {
      changedFields.push(makeAuditChangedField(
        entityType,
        'settings.permissionProfileIds',
        beforeProfiles,
        afterProfiles
      ));
    }
  }

  if (entityType === 'CommercialOrganisation') {
    changedFields.push(...describePermissionProfileChanges(
      beforeSafe.permissionProfiles,
      afterSafe.permissionProfiles
    ));
  }

  const handledKeys = new Set();
  if (entityType === 'CommercialUserAccess') handledKeys.add('permissionProfileIds');
  if (entityType === 'CommercialOrganisation') handledKeys.add('permissionProfiles');

  const keys = new Set([...Object.keys(beforeSafe), ...Object.keys(afterSafe)]);
  for (const key of [...keys].sort()) {
    if (handledKeys.has(key)) continue;
    pushGenericSettingsDiffs(
      entityType,
      beforeSafe[key],
      afterSafe[key],
      `settings.${key}`,
      changedFields
    );
  }

  return changedFields;
};

const summariseAuditChangedFields = (changedFields) => {
  if (!changedFields.length) return 'No field-level changes recorded';
  return changedFields.map((field) => {
    const beforeText = field.displayBefore ?? formatAuditValue('', field.field, field.before);
    const afterText = field.displayAfter ?? formatAuditValue('', field.field, field.after);
    return `${field.label || field.field}: ${beforeText} -> ${afterText}`;
  }).join('; ');
};

const isOnlyPermissionProfileAuditEntry = (entry) => {
  const changedFields = entry?.changes?.changedFields || [];
  return entry?.entityType === 'CommercialUserAccess'
    && changedFields.length === 1
    && changedFields[0]?.field === 'settings.permissionProfileIds';
};

const collapsePermissionProfileAuditEntries = (entries) => {
  const orderedEntries = [];
  const groups = new Map();

  for (const entry of entries) {
    if (!isOnlyPermissionProfileAuditEntry(entry)) {
      orderedEntries.push(entry);
      continue;
    }

    const changedField = entry.changes.changedFields[0];
    const context = entry.changes.context || {};
    const userKey = context.userId || context.username || entry.changes.label || entry.entityId || 'unknown-user';
    const groupKey = [
      entry.action,
      userKey,
      auditValueString(changedField.before),
      auditValueString(changedField.after),
    ].join('|');

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
      orderedEntries.push({ __permissionProfileGroupKey: groupKey });
    }
    groups.get(groupKey).push(entry);
  }

  return orderedEntries.map((entry) => {
    if (!entry.__permissionProfileGroupKey) return entry;

    const group = groups.get(entry.__permissionProfileGroupKey) || [];
    const first = group[0];
    const firstContext = first?.changes?.context || {};
    const userLabel = firstContext.displayName
      || firstContext.username
      || first?.changes?.label
      || firstContext.userId
      || 'User';
    const changedFields = first?.changes?.changedFields || [];
    const summary = summariseAuditChangedFields(changedFields);
    const affectedScopes = group
      .map((groupedEntry) => groupedEntry?.changes?.label)
      .filter(Boolean);

    return {
      ...first,
      entityId: firstContext.userId || firstContext.username || first.entityId,
      changes: {
        ...first.changes,
        label: userLabel,
        context: {
          ...firstContext,
          locationCode: null,
          unitCode: null,
          moduleCode: null,
        },
        description: `${first.action === 'PLATFORM_CONFIG_ADDED' ? 'Added' : 'Updated'} permission profiles for ${userLabel}: ${summary}`,
        summary,
        changedFields,
        affectedScopes,
        scopeCount: group.length,
      },
    };
  });
};

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0] || req.ip || 'unknown';
  return forwardedFor || req.ip || 'unknown';
};

async function resolveAuditUser(db, req) {
  const authHeader = req.headers.authorization || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (sessionToken) {
    const sessions = await db.$queryRawUnsafe(
      `SELECT u.id, u."userId", u.username, u."firstName", u."lastName", u.email, u.role
       FROM "Session" s
       JOIN "User" u ON u.id = s."userId"
       WHERE s."sessionToken" = $1
         AND s.expires > NOW()
         AND u."isActive" = true
       LIMIT 1`,
      sessionToken
    );
    if (sessions && sessions[0]) return sessions[0];
  }

  const fallbackUsers = await db.$queryRawUnsafe(
    `SELECT id, "userId", username, "firstName", "lastName", email, role
     FROM "User"
     WHERE "isActive" = true
     ORDER BY
       CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END,
       "createdAt" ASC
     LIMIT 1`
  );
  return fallbackUsers?.[0] || null;
}

async function loadPlatformConfigAuditSnapshot(db) {
  const [
    organisations,
    locations,
    units,
    aircraftTypes,
    resourcePools,
    unitModules,
    licenses,
    schedulingRuleSets,
    userAccess,
  ] = await Promise.all([
    db.$queryRawUnsafe(`SELECT * FROM "CommercialOrganisation"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialLocation"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialUnit"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialAircraftType"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialResourcePool"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialUnitModule"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialLicense"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialSchedulingRuleSet"`),
    db.$queryRawUnsafe(`SELECT * FROM "CommercialUserAccess"`),
  ]);

  return {
    organisations,
    locations,
    units,
    aircraftTypes,
    resourcePools,
    unitModules,
    licenses,
    schedulingRuleSets,
    userAccess,
  };
}

function buildPlatformConfigAuditEntries(beforeSnapshot, afterSnapshot) {
  const entries = [];

  for (const table of PLATFORM_CONFIG_AUDIT_TABLES) {
    const beforeMap = new Map();
    for (const beforeRow of beforeSnapshot[table.collection] || []) {
      const normalisedBefore = table.normalise(beforeRow);
      for (const key of table.keys(normalisedBefore)) beforeMap.set(String(key), normalisedBefore);
    }

    for (const rawAfterRow of afterSnapshot[table.collection] || []) {
      if (!table.isValid(rawAfterRow)) continue;
      const afterRow = table.normalise(rawAfterRow);
      const lookupKeys = table.keys(afterRow).map(String);
      const beforeRow = lookupKeys.map((key) => beforeMap.get(key)).find(Boolean) || null;
      const changedFields = [];

      for (const field of table.fields) {
        const beforeValue = beforeRow ? beforeRow[field] : null;
        const afterValue = afterRow[field] ?? null;
        if (auditValueString(beforeValue) !== auditValueString(afterValue)) {
          if (field === 'settings') {
            changedFields.push(...describeSettingsChanges(table.entityType, beforeValue, afterValue));
          } else if (table.entityType === 'CommercialLicense' && field === 'features') {
            pushGenericSettingsDiffs(table.entityType, beforeValue, afterValue, 'features', changedFields);
          } else {
            changedFields.push(makeAuditChangedField(table.entityType, field, beforeValue, afterValue));
          }
        }
      }

      if (changedFields.length === 0) continue;

      const action = beforeRow ? 'PLATFORM_CONFIG_UPDATED' : 'PLATFORM_CONFIG_ADDED';
      const label = table.label(afterRow);
      const entityLabel = PLATFORM_ENTITY_LABELS[table.entityType] || 'record';
      const changeSummary = summariseAuditChangedFields(changedFields);
      const context = {
        organisationCode: afterRow.organisationCode || null,
        locationCode: afterRow.locationCode || null,
        unitCode: afterRow.unitCode || null,
        moduleCode: afterRow.moduleCode || null,
        userId: afterRow.userId || null,
        username: afterRow.username || null,
        displayName: afterRow.displayName || null,
      };

      entries.push({
        action,
        entityType: table.entityType,
        entityId: afterRow.id || beforeRow?.id || lookupKeys[0] || label,
        changes: {
          source: 'Platform Configuration',
          label,
          context,
          description: `${beforeRow ? 'Updated' : 'Added'} ${entityLabel} ${label}: ${changeSummary}`,
          summary: changeSummary,
          changedFields,
        },
      });
    }
  }

  return collapsePermissionProfileAuditEntries(entries);
}

async function writePlatformConfigAuditEntries(db, req, entries) {
  if (!entries.length) return { count: 0 };

  const actor = await resolveAuditUser(db, req);
  if (!actor?.id) {
    console.warn('⚠️ Platform configuration audit skipped: no active user could be resolved.');
    return { count: 0, warning: 'No active user could be resolved for audit logging' };
  }

  const ipAddress = getRequestIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const entriesToWrite = entries.slice(0, 250);

  for (const entry of entriesToWrite) {
    await db.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", changes, "ipAddress", "userAgent", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6, $7, NOW())`,
      actor.id,
      entry.action,
      entry.entityType,
      entry.entityId ? String(entry.entityId) : null,
      JSON.stringify(entry.changes || {}),
      ipAddress,
      userAgent
    );
  }

  if (entries.length > entriesToWrite.length) {
    await db.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", changes, "ipAddress", "userAgent", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'PLATFORM_CONFIG_AUDIT_TRUNCATED', 'PlatformConfiguration', NULL, $2::jsonb, $3, $4, NOW())`,
      actor.id,
      JSON.stringify({
        source: 'Platform Configuration',
        summary: `Audit output was limited to ${entriesToWrite.length} of ${entries.length} changed records for this save.`,
      }),
      ipAddress,
      userAgent
    );
  }

  return { count: entries.length, written: Math.min(entries.length, entriesToWrite.length) };
}

app.get('/api/platform-config', async (req, res) => {
  try {
    const db = await getPrisma();

    const [
      organisations,
      locations,
      units,
      aircraftTypes,
      resourcePools,
      modules,
      unitModules,
      licenses,
      schedulingRuleSets,
      userAccess,
      platformUsers,
    ] = await Promise.all([
      db.$queryRawUnsafe(`SELECT * FROM "CommercialOrganisation" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialLocation" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialUnit" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialAircraftType" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialResourcePool" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialModule" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialUnitModule" ORDER BY "unitCode", "moduleCode"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialLicense" ORDER BY "licenseName"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialSchedulingRuleSet" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialUserAccess" ORDER BY "displayName", "userId", "locationCode", "unitCode", "moduleCode"`),
      db.$queryRawUnsafe(`SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive" FROM "User" ORDER BY "lastName", "firstName", username`),
    ]);

    res.json({
      organisations,
      locations,
      units,
      aircraftTypes,
      resourcePools,
      modules,
      unitModules,
      licenses,
      schedulingRuleSets,
      userAccess,
      platformUsers,
    });
  } catch (error) {
    console.error('❌ GET /api/platform-config error:', error);
    res.status(500).json({ error: 'Failed to load platform configuration', details: error.message });
  }
});

const DEPLOYMENT_READINESS_LABELS = {
  localWebServer: 'Local web server defined',
  localDatabase: 'Local database defined',
  localAuthentication: 'Local authentication path defined',
  localFileStorage: 'Local file storage path defined',
  offlineLicenceFile: 'Offline licence file process defined',
  backupRestore: 'Backup and restore process defined',
  auditExport: 'Audit export process defined',
  updateProcess: 'Update process defined',
};

const readPackageMetadata = () => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return {
      name: packageJson.name || 'dfp-neo',
      version: packageJson.version || 'unknown',
    };
  } catch (error) {
    return {
      name: 'dfp-neo',
      version: 'unknown',
    };
  }
};

const LICENSE_STATUS_CACHE_MS = Number(process.env.DFP_LICENSE_STATUS_CACHE_MS || 60_000);
let licenseStatusCache = { expiresAt: 0, status: null };

async function getLicenseStatusSnapshot(db, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && licenseStatusCache.status && licenseStatusCache.expiresAt > now) {
    return licenseStatusCache.status;
  }

  const [licenses, modules, organisations] = await Promise.all([
    db.$queryRawUnsafe(`
      SELECT *
      FROM "CommercialLicense"
      ORDER BY "licenseName"
    `),
    db.$queryRawUnsafe(`SELECT "code", "name", "status" FROM "CommercialModule" ORDER BY "name"`),
    db.$queryRawUnsafe(`SELECT "code", "name", "status", "settings" FROM "CommercialOrganisation" ORDER BY "name"`),
  ]);

  const status = evaluateCommercialLicenses({
    licenses,
    modules,
    organisations,
    packageMetadata: readPackageMetadata(),
  });

  licenseStatusCache = {
    expiresAt: now + LICENSE_STATUS_CACHE_MS,
    status: {
      ...status,
      licenses,
      modules,
      organisations,
    },
  };

  return licenseStatusCache.status;
}

function clearLicenseStatusCache() {
  licenseStatusCache = { expiresAt: 0, status: null };
}

function isLicenseRecoveryPath(req) {
  const pathName = `${req.baseUrl || ''}${req.path || ''}`;
  return (
    pathName.startsWith('/api/auth/') ||
    pathName.startsWith('/api/mobile/auth/') ||
    pathName.startsWith('/api/platform-license/') ||
    pathName === '/api/platform-config' ||
    pathName === '/api/platform-deployment/manifest'
  );
}

// Licence enforcement is fully wired for production, but development mode remains
// non-blocking so clones, test deployments and local builds are not constrained.
app.use('/api', async (req, res, next) => {
  try {
    if (isLicenseRecoveryPath(req)) return next();

    const db = await getPrisma();
    const licenseStatus = await getLicenseStatusSnapshot(db);
    res.setHeader('X-DFP-License-Mode', licenseStatus.runtimeMode);
    res.setHeader('X-DFP-License-Enforcement', licenseStatus.enforcementMode);
    res.setHeader('X-DFP-License-State', licenseStatus.shouldBlock ? 'blocked' : 'allowed');

    if (!licenseStatus.shouldBlock) return next();

    return res.status(402).json({
      error: 'Licence enforcement blocked this request',
      message: licenseStatus.message,
      runtimeMode: licenseStatus.runtimeMode,
      enforcementMode: licenseStatus.enforcementMode,
      deploymentFingerprint: licenseStatus.deploymentFingerprint,
      recovery: 'Sign in as an authorised administrator, import a valid signed licence file, or switch enforcement to development/monitor mode for non-customer builds.',
    });
  } catch (error) {
    console.error('❌ Licence enforcement middleware error:', error);
    if (getLicenseRuntimeMode() === 'production' && process.env.DFP_LICENSE_FAIL_CLOSED === 'true') {
      return res.status(503).json({
        error: 'Licence status unavailable',
        message: 'Licence status could not be checked and fail-closed mode is enabled.',
      });
    }
    return next();
  }
});

app.get('/api/platform-license/status', async (req, res) => {
  try {
    const db = await getPrisma();
    const licenseStatus = await getLicenseStatusSnapshot(db, { forceRefresh: req.query.refresh === '1' });
    const { licenses, organisations } = licenseStatus;

    const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0] || {};
    const deploymentProfile = activeOrganisation.settings?.deploymentProfile || {};
    const readinessChecklist = activeOrganisation.settings?.deploymentReadiness || {};
    const readinessKeys = [
      'localWebServer',
      'localDatabase',
      'localAuthentication',
      'localFileStorage',
      'offlineLicenceFile',
      'backupRestore',
      'auditExport',
      'updateProcess',
    ];
    const readinessCompleteCount = readinessKeys.filter((key) => readinessChecklist[key] === true).length;
    const readinessPercent = readinessKeys.length
      ? Math.round((readinessCompleteCount / readinessKeys.length) * 100)
      : 0;

    res.json({
      ...licenseStatus,
      licenses,
      deploymentProfile,
      readinessChecklist,
      readinessCompleteCount,
      readinessPercent,
      runtimeMode: getLicenseRuntimeMode(),
    });
  } catch (error) {
    console.error('❌ GET /api/platform-license/status error:', error);
    res.status(500).json({ error: 'Failed to load platform licence status', details: error.message });
  }
});

app.get('/api/platform-license/fingerprint', async (req, res) => {
  try {
    const db = await getPrisma();
    const organisations = await db.$queryRawUnsafe(`SELECT "code", "name", "status", "settings" FROM "CommercialOrganisation" ORDER BY "name"`);
    const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0] || {};
    const operationalRunbook = activeOrganisation.settings?.operationalRunbook || {};
    const deploymentProfile = activeOrganisation.settings?.deploymentProfile || {};
    const packageMetadata = readPackageMetadata();
    res.json({
      runtimeMode: getLicenseRuntimeMode(),
      deploymentFingerprint: getDeploymentFingerprint({
        organisation: activeOrganisation,
        organisationCode: activeOrganisation.code,
        deploymentProfile,
        operationalRunbook,
        packageMetadata,
      }),
      organisationCode: activeOrganisation.code || null,
      organisationName: activeOrganisation.name || null,
      deploymentIdentifier: operationalRunbook.deploymentIdentifier || null,
      publicKeyConfigured: Boolean(process.env.DFP_LICENSE_PUBLIC_KEY || process.env.DFP_LICENCE_PUBLIC_KEY || process.env.DFP_LICENSE_PUBLIC_KEYS_JSON || process.env.DFP_LICENCE_PUBLIC_KEYS_JSON),
    });
  } catch (error) {
    console.error('❌ GET /api/platform-license/fingerprint error:', error);
    res.status(500).json({ error: 'Failed to load deployment fingerprint', details: error.message });
  }
});

app.post('/api/platform-license/verify', async (req, res) => {
  try {
    const db = await getPrisma();
    const organisations = await db.$queryRawUnsafe(`SELECT "code", "name", "status", "settings" FROM "CommercialOrganisation" ORDER BY "name"`);
    const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0] || {};
    const operationalRunbook = activeOrganisation.settings?.operationalRunbook || {};
    const deploymentProfile = activeOrganisation.settings?.deploymentProfile || {};
    const deploymentFingerprint = getDeploymentFingerprint({
      organisation: activeOrganisation,
      organisationCode: activeOrganisation.code,
      deploymentProfile,
      operationalRunbook,
      packageMetadata: readPackageMetadata(),
    });
    const verification = verifySignedLicenseContent(req.body?.signedLicenseFile || req.body?.license || req.body, {
      deploymentFingerprint,
      packageMetadata: readPackageMetadata(),
    });
    res.status(verification.signatureState === 'VERIFIED' ? 200 : 400).json({
      ok: verification.ok,
      signatureState: verification.signatureState,
      detail: verification.detail,
      dateState: verification.dateState || null,
      deploymentFingerprint: verification.deploymentFingerprint || deploymentFingerprint,
      payload: verification.payload || null,
    });
  } catch (error) {
    console.error('❌ POST /api/platform-license/verify error:', error);
    res.status(500).json({ error: 'Failed to verify signed licence', details: error.message });
  }
});

app.post('/api/platform-license/import', async (req, res) => {
  try {
    const db = await getPrisma();
    const organisations = await db.$queryRawUnsafe(`SELECT "code", "name", "status", "settings" FROM "CommercialOrganisation" ORDER BY "name"`);
    const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0] || {};
    const operationalRunbook = activeOrganisation.settings?.operationalRunbook || {};
    const deploymentProfile = activeOrganisation.settings?.deploymentProfile || {};
    const deploymentFingerprint = getDeploymentFingerprint({
      organisation: activeOrganisation,
      organisationCode: activeOrganisation.code,
      deploymentProfile,
      operationalRunbook,
      packageMetadata: readPackageMetadata(),
    });
    const imported = buildImportedLicenseRecord(req.body?.signedLicenseFile || req.body?.license || req.body, {
      deploymentFingerprint,
      packageMetadata: readPackageMetadata(),
    });
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialLicense" (
        "id", "organisationCode", "licenseKey", "licenseName", "deploymentMode", "status",
        "validFrom", "validUntil", "maxUsers", "maxUnits", "maxAircraftTypes", "moduleCodes",
        "features", "offlineFingerprint", "notes", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5,
        $6::timestamp, $7::timestamp, $8, $9, $10, $11::text[],
        $12::jsonb, $13, $14, $15::timestamp, $15::timestamp
      )
      ON CONFLICT ("licenseKey") DO UPDATE SET
        "organisationCode" = $1,
        "licenseName" = $3,
        "deploymentMode" = $4,
        "status" = $5,
        "validFrom" = $6::timestamp,
        "validUntil" = $7::timestamp,
        "maxUsers" = $8,
        "maxUnits" = $9,
        "maxAircraftTypes" = $10,
        "moduleCodes" = $11::text[],
        "features" = $12::jsonb,
        "offlineFingerprint" = $13,
        "notes" = $14,
        "updatedAt" = $15::timestamp
    `,
      imported.organisationCode,
      imported.licenseKey,
      imported.licenseName,
      imported.deploymentMode,
      imported.status,
      imported.validFrom,
      imported.validUntil,
      imported.maxUsers,
      imported.maxUnits,
      imported.maxAircraftTypes,
      imported.moduleCodes,
      JSON.stringify(imported.features),
      imported.offlineFingerprint,
      imported.notes,
      now,
    );
    clearLicenseStatusCache();
    res.json({
      ok: true,
      message: 'Signed licence imported successfully.',
      licenseKey: imported.licenseKey,
      deploymentFingerprint,
    });
  } catch (error) {
    console.error('❌ POST /api/platform-license/import error:', error);
    res.status(400).json({ error: 'Failed to import signed licence', details: error.message });
  }
});

app.post('/api/platform-license/generate-development', async (req, res) => {
  try {
    const privateKeyPem = process.env.DFP_LICENSE_PRIVATE_KEY || process.env.DFP_LICENCE_PRIVATE_KEY;
    const allowDevGenerator = process.env.DFP_ENABLE_DEV_LICENSE_GENERATOR === 'true' || getLicenseRuntimeMode() === 'development';
    if (!allowDevGenerator || !privateKeyPem) {
      return res.status(403).json({
        error: 'Development licence generator is not enabled on this deployment.',
        details: 'Generate customer licences outside the app with scripts/generate-license.mjs, or enable DFP_ENABLE_DEV_LICENSE_GENERATOR only in a private development environment.',
      });
    }
    const signedLicenseFile = signLicensePayload(req.body?.payload || req.body, privateKeyPem, {
      keyId: process.env.DFP_LICENSE_KEY_ID || 'development',
    });
    res.json({ ok: true, signedLicenseFile });
  } catch (error) {
    console.error('❌ POST /api/platform-license/generate-development error:', error);
    res.status(400).json({ error: 'Failed to generate development signed licence', details: error.message });
  }
});

app.get('/api/platform-deployment/manifest', async (req, res) => {
  const generatedAt = new Date().toISOString();
  const packageMetadata = readPackageMetadata();

  try {
    const db = await getPrisma();
    const [
      dbVersionRows,
      organisations,
      organisationCountRows,
      activeLocationCountRows,
      activeUnitCountRows,
      moduleCountRows,
      activeLicenseCountRows,
      activeUserAccessCountRows,
      auditLogCountRows,
      licenses,
      modules,
    ] = await Promise.all([
      db.$queryRawUnsafe(`SELECT version() AS version`),
      db.$queryRawUnsafe(`SELECT "code", "name", "status", "settings" FROM "CommercialOrganisation" ORDER BY "name"`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialOrganisation"`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialLocation" WHERE "status" = 'ACTIVE'`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialUnit" WHERE "status" = 'ACTIVE'`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialModule" WHERE "status" = 'ACTIVE'`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialLicense" WHERE "status" = 'ACTIVE'`),
      db.$queryRawUnsafe(`SELECT COUNT(DISTINCT "userId")::int AS count FROM "CommercialUserAccess" WHERE "status" = 'ACTIVE'`),
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "AuditLog"`),
      db.$queryRawUnsafe(`SELECT * FROM "CommercialLicense" ORDER BY "licenseName"`),
      db.$queryRawUnsafe(`SELECT "code", "name", "status" FROM "CommercialModule" ORDER BY "name"`),
    ]);

    const countValue = (rows) => Number(rows?.[0]?.count || 0);
    const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0] || {};
    const settings = activeOrganisation.settings || {};
    const deploymentProfile = settings.deploymentProfile || {};
    const readinessChecklist = settings.deploymentReadiness || {};
    const operationalRunbook = settings.operationalRunbook || {};
    const readinessKeys = Object.keys(DEPLOYMENT_READINESS_LABELS);
    const missingReadiness = readinessKeys
      .filter((key) => readinessChecklist[key] !== true)
      .map((key) => DEPLOYMENT_READINESS_LABELS[key]);
    const readinessCompleteCount = readinessKeys.length - missingReadiness.length;
    const readinessPercent = readinessKeys.length
      ? Math.round((readinessCompleteCount / readinessKeys.length) * 100)
      : 0;

    const warnings = [];
    if (missingReadiness.length > 0) warnings.push(`${missingReadiness.length} deployment readiness item${missingReadiness.length === 1 ? '' : 's'} incomplete.`);
    if (!operationalRunbook.supportOwner || !operationalRunbook.supportContact) warnings.push('Support owner/contact is not fully recorded.');
    if (!operationalRunbook.backupStorageLocation) warnings.push('Backup storage location is not recorded.');
    if (!operationalRunbook.lastRestoreTestDate) warnings.push('Restore test date is not recorded.');
    if (!operationalRunbook.updateApprovalProcess) warnings.push('Update approval process is not recorded.');
    if (countValue(activeLicenseCountRows) === 0) warnings.push('No active commercial licence records found.');
    const licenseStatus = evaluateCommercialLicenses({
      licenses,
      modules,
      organisations,
      packageMetadata,
    });
    if (licenseStatus.runtimeMode === 'production' && !licenseStatus.publicKeyConfigured) warnings.push('Production licence mode is active but no licence public key is configured.');
    if (licenseStatus.invalidLicenseCount > 0) warnings.push(`${licenseStatus.invalidLicenseCount} licence record${licenseStatus.invalidLicenseCount === 1 ? '' : 's'} failed signature or deployment validation.`);

    res.json({
      generatedAt,
      secretsRedacted: true,
      application: {
        name: packageMetadata.name,
        version: packageMetadata.version,
        runtime: 'node',
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        database: {
          connected: true,
          engine: 'PostgreSQL',
          version: String(dbVersionRows?.[0]?.version || 'PostgreSQL').split(' on ')[0],
        },
      },
      organisation: {
        code: activeOrganisation.code || null,
        name: activeOrganisation.name || null,
        status: activeOrganisation.status || null,
      },
      deploymentProfile,
      licensing: {
        runtimeMode: licenseStatus.runtimeMode,
        enforcementMode: licenseStatus.enforcementMode,
        developmentBypass: licenseStatus.developmentBypass,
        hasActiveLicense: licenseStatus.hasActiveLicense,
        activeLicenseCount: licenseStatus.activeLicenseCount,
        verifiedLicenseCount: licenseStatus.verifiedLicenseCount,
        unsignedLicenseCount: licenseStatus.unsignedLicenseCount,
        invalidLicenseCount: licenseStatus.invalidLicenseCount,
        publicKeyConfigured: licenseStatus.publicKeyConfigured,
        deploymentFingerprint: licenseStatus.deploymentFingerprint,
        licensedModuleCodes: licenseStatus.licensedModuleCodes,
        shouldBlock: licenseStatus.shouldBlock,
      },
      operationalRunbook,
      readiness: {
        checklist: readinessChecklist,
        completeCount: readinessCompleteCount,
        total: readinessKeys.length,
        percent: readinessPercent,
        missing: missingReadiness,
      },
      inventory: {
        organisations: countValue(organisationCountRows),
        activeLocations: countValue(activeLocationCountRows),
        activeUnits: countValue(activeUnitCountRows),
        activeModules: countValue(moduleCountRows),
        activeLicences: countValue(activeLicenseCountRows),
        activeUsersWithAccess: countValue(activeUserAccessCountRows),
        auditLogEntries: countValue(auditLogCountRows),
      },
      warnings,
      note: 'This deployment manifest is intentionally non-secret. It must not expose database URLs, passwords, tokens or private licence keys.',
    });
  } catch (error) {
    console.error('❌ GET /api/platform-deployment/manifest error:', error);
    res.status(500).json({
      generatedAt,
      secretsRedacted: true,
      application: packageMetadata,
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        database: {
          connected: false,
        },
      },
      error: 'Failed to generate deployment manifest',
      details: error.message,
    });
  }
});

app.post('/api/platform-config', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
      organisations = [],
      locations = [],
      units = [],
      aircraftTypes = [],
      resourcePools = [],
      unitModules = [],
      licenses = [],
      schedulingRuleSets = [],
      userAccess = [],
    } = req.body || {};

    const now = new Date().toISOString();
    const toJson = (value) => JSON.stringify(value || {});
    const toArray = (value) => Array.isArray(value) ? value : [];
    const toNullableDate = (value) => value ? String(value).slice(0, 10) : null;
    const toNullableNumber = (value) => (
      value === null || value === undefined || value === '' ? null : Number(value)
    );
    const normaliseLocationSolarFields = (location) => {
      const fallback = getDefaultAirfieldSolarProfile(location.code) || getDefaultAirfieldSolarProfile(location.name);
      const latitude = toNullableNumber(location.latitude ?? location.settings?.latitude ?? fallback?.latitude ?? null);
      const longitude = toNullableNumber(location.longitude ?? location.settings?.longitude ?? fallback?.longitude ?? null);
      const timezone = String(location.timezone || location.timeZone || location.settings?.timezone || fallback?.timezone || '').trim() || null;

      if (latitude !== null && !isValidLatitude(latitude)) {
        throw new Error(`${location.code || location.name}: latitude must be between -90 and 90.`);
      }
      if (longitude !== null && !isValidLongitude(longitude)) {
        throw new Error(`${location.code || location.name}: longitude must be between -180 and 180.`);
      }
      if (timezone !== null && !isValidTimeZone(timezone)) {
        throw new Error(`${location.code || location.name}: timezone must be a valid IANA timezone.`);
      }

      return { latitude, longitude, timezone };
    };
    const beforeAuditSnapshot = await loadPlatformConfigAuditSnapshot(db);

    for (const org of organisations) {
      if (!org.code || !org.name) continue;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialOrganisation" ("id", "code", "name", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, $5::timestamp, $5::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "name" = $2,
          "status" = $3,
          "settings" = $4::jsonb,
          "updatedAt" = $5::timestamp
      `, org.code, org.name, org.status || 'ACTIVE', toJson(org.settings), now);
    }

    for (const location of locations) {
      if (!location.code || !location.name) continue;
      const solar = normaliseLocationSolarFields(location);
      const iataCode = String(location.iataCode || '').trim() || null;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialLocation" ("id", "organisationCode", "code", "iataCode", "name", "timezoneOffset", "latitude", "longitude", "timezone", "trainingAreas", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamp, $12::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "organisationCode" = $1,
          "iataCode" = $3,
          "name" = $4,
          "timezoneOffset" = $5,
          "latitude" = $6,
          "longitude" = $7,
          "timezone" = $8,
          "trainingAreas" = $9,
          "status" = $10,
          "settings" = $11::jsonb,
          "updatedAt" = $12::timestamp
      `, location.organisationCode || 'DEFAULT', location.code, iataCode, location.name, Number(location.timezoneOffset ?? 10), solar.latitude, solar.longitude, solar.timezone, toArray(location.trainingAreas), location.status || 'ACTIVE', toJson(location.settings), now);
    }

    for (const unit of units) {
      if (!unit.code || !unit.name) continue;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUnit" ("id", "organisationCode", "locationCode", "code", "name", "unitType", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamp, $8::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "organisationCode" = $1,
          "locationCode" = $2,
          "name" = $4,
          "unitType" = $5,
          "status" = $6,
          "settings" = $7::jsonb,
          "updatedAt" = $8::timestamp
      `, unit.organisationCode || 'DEFAULT', unit.locationCode || 'ESL', unit.code, unit.name, unit.unitType || 'Training', unit.status || 'ACTIVE', toJson(unit.settings), now);
    }

    for (const aircraftType of aircraftTypes) {
      if (!aircraftType.code || !aircraftType.name) continue;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialAircraftType" ("id", "code", "name", "category", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6::timestamp, $6::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "name" = $2,
          "category" = $3,
          "status" = $4,
          "settings" = $5::jsonb,
          "updatedAt" = $6::timestamp
      `, aircraftType.code, aircraftType.name, aircraftType.category || 'Training', aircraftType.status || 'ACTIVE', toJson(aircraftType.settings), now);
    }

    for (const pool of resourcePools) {
      if (!pool.code || !pool.name) continue;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialResourcePool" ("id", "organisationCode", "locationCode", "unitCode", "aircraftTypeCode", "code", "name", "poolType", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamp, $10::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "organisationCode" = $1,
          "locationCode" = $2,
          "unitCode" = $3,
          "aircraftTypeCode" = $4,
          "name" = $6,
          "poolType" = $7,
          "status" = $8,
          "settings" = $9::jsonb,
          "updatedAt" = $10::timestamp
      `, pool.organisationCode || 'DEFAULT', pool.locationCode || null, pool.unitCode || null, pool.aircraftTypeCode || null, pool.code, pool.name, pool.poolType || 'Dedicated', pool.status || 'ACTIVE', toJson(pool.settings), now);
    }

    for (const unitModule of unitModules) {
      if (!unitModule.unitCode || !unitModule.moduleCode) continue;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUnitModule" ("id", "unitCode", "moduleCode", "isEnabled", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, $5::timestamp, $5::timestamp)
        ON CONFLICT ("unitCode", "moduleCode") DO UPDATE SET
          "isEnabled" = $3,
          "settings" = $4::jsonb,
          "updatedAt" = $5::timestamp
      `, unitModule.unitCode, unitModule.moduleCode, Boolean(unitModule.isEnabled), toJson(unitModule.settings), now);
    }

    for (const license of licenses) {
      if (!license.licenseKey || !license.licenseName) continue;
      const licenseValues = [
        license.organisationCode || organisations[0]?.code || 'DEFAULT',
        license.licenseKey,
        license.licenseName,
        license.deploymentMode || 'Online SaaS',
        license.status || 'ACTIVE',
        toNullableDate(license.validFrom),
        toNullableDate(license.validUntil),
        toNullableNumber(license.maxUsers),
        toNullableNumber(license.maxUnits),
        toNullableNumber(license.maxAircraftTypes),
        toArray(license.moduleCodes),
        toJson(license.features),
        license.offlineFingerprint || null,
        license.notes || null,
        now,
      ];

      if (license.id) {
        await db.$executeRawUnsafe(`
          UPDATE "CommercialLicense" SET
            "organisationCode" = $2,
            "licenseKey" = $3,
            "licenseName" = $4,
            "deploymentMode" = $5,
            "status" = $6,
            "validFrom" = $7::timestamp,
            "validUntil" = $8::timestamp,
            "maxUsers" = $9,
            "maxUnits" = $10,
            "maxAircraftTypes" = $11,
            "moduleCodes" = $12::text[],
            "features" = $13::jsonb,
            "offlineFingerprint" = $14,
            "notes" = $15,
            "updatedAt" = $16::timestamp
          WHERE "id" = $1
        `, license.id, ...licenseValues);
      } else {
        await db.$executeRawUnsafe(`
          INSERT INTO "CommercialLicense" ("id", "organisationCode", "licenseKey", "licenseName", "deploymentMode", "status", "validFrom", "validUntil", "maxUsers", "maxUnits", "maxAircraftTypes", "moduleCodes", "features", "offlineFingerprint", "notes", "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::timestamp, $7::timestamp, $8, $9, $10, $11::text[], $12::jsonb, $13, $14, $15::timestamp, $15::timestamp)
          ON CONFLICT ("licenseKey") DO UPDATE SET
            "organisationCode" = $1,
            "licenseName" = $3,
            "deploymentMode" = $4,
            "status" = $5,
            "validFrom" = $6::timestamp,
            "validUntil" = $7::timestamp,
            "maxUsers" = $8,
            "maxUnits" = $9,
            "maxAircraftTypes" = $10,
            "moduleCodes" = $11::text[],
            "features" = $12::jsonb,
            "offlineFingerprint" = $13,
            "notes" = $14,
            "updatedAt" = $15::timestamp
        `, ...licenseValues);
      }
    }

    for (const ruleSet of schedulingRuleSets) {
      const name = ruleSet.name || 'Default Scheduling Rules';
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialSchedulingRuleSet" ("id", "organisationCode", "unitCode", "aircraftTypeCode", "name", "scope", "rules", "isActive", "createdAt", "updatedAt")
        VALUES (COALESCE($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7::jsonb, $8, $9::timestamp, $9::timestamp)
        ON CONFLICT ("id") DO UPDATE SET
          "organisationCode" = $2,
          "unitCode" = $3,
          "aircraftTypeCode" = $4,
          "name" = $5,
          "scope" = $6,
          "rules" = $7::jsonb,
          "isActive" = $8,
          "updatedAt" = $9::timestamp
      `, ruleSet.id || null, ruleSet.organisationCode || 'DEFAULT', ruleSet.unitCode || null, ruleSet.aircraftTypeCode || null, name, ruleSet.scope || 'Unit', toJson(ruleSet.rules), ruleSet.isActive !== false, now);
    }

    for (const access of userAccess) {
      if (!access.userId) continue;
      const scopeKey = [
        access.userId,
        access.organisationCode || 'DEFAULT',
        access.locationCode || '',
        access.unitCode || '',
        access.moduleCode || '',
      ].join('|');
      const accessValues = [
        access.userId,
        access.username || null,
        access.displayName || null,
        access.organisationCode || 'DEFAULT',
        access.locationCode || null,
        access.unitCode || null,
        access.moduleCode || null,
        scopeKey,
        access.role || 'Viewer',
        access.accessLevel || 'Read',
        access.status || 'ACTIVE',
        toJson(access.settings),
        now,
      ];

      if (access.id) {
        await db.$executeRawUnsafe(`
          UPDATE "CommercialUserAccess" SET
            "userId" = $2,
            "username" = $3,
            "displayName" = $4,
            "organisationCode" = $5,
            "locationCode" = $6,
            "unitCode" = $7,
            "moduleCode" = $8,
            "scopeKey" = $9,
            "role" = $10,
            "accessLevel" = $11,
            "status" = $12,
            "settings" = $13::jsonb,
            "updatedAt" = $14::timestamp
          WHERE "id" = $1
        `, access.id, ...accessValues);
      } else {
        await db.$executeRawUnsafe(`
          INSERT INTO "CommercialUserAccess" ("id", "userId", "username", "displayName", "organisationCode", "locationCode", "unitCode", "moduleCode", "scopeKey", "role", "accessLevel", "status", "settings", "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::timestamp, $13::timestamp)
          ON CONFLICT ("scopeKey") DO UPDATE SET
            "username" = $2,
            "displayName" = $3,
            "organisationCode" = $4,
            "locationCode" = $5,
            "unitCode" = $6,
            "moduleCode" = $7,
            "role" = $9,
            "accessLevel" = $10,
            "status" = $11,
            "settings" = $12::jsonb,
            "updatedAt" = $13::timestamp
        `, ...accessValues);
      }
    }

    let auditResult = { count: 0 };
    try {
      const auditEntries = buildPlatformConfigAuditEntries(beforeAuditSnapshot, {
        organisations,
        locations,
        units,
        aircraftTypes,
        resourcePools,
        unitModules,
        licenses,
        schedulingRuleSets,
        userAccess,
      });
      auditResult = await writePlatformConfigAuditEntries(db, req, auditEntries);
    } catch (auditError) {
      console.warn('⚠️ Platform configuration audit failed after save:', auditError.message);
      auditResult = { count: 0, warning: auditError.message };
    }

    clearLicenseStatusCache();
    res.json({ success: true, audit: auditResult });
  } catch (error) {
    console.error('❌ POST /api/platform-config error:', error);
    res.status(500).json({ error: 'Failed to save platform configuration', details: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Course Settings API Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/settings/course-settings - Get course settings (neoBuildCourse + selectedAcademicLmp + excludedCourses)
app.get('/api/settings/course-settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      'SELECT "neoBuildCourse", "selectedAcademicLmp", "excludedCourses" FROM "CourseSettings" LIMIT 1'
    );
    const setting = rows && rows.length > 0 ? rows[0] : null;
    let excludedCourses = [];
    if (setting && setting.excludedCourses) {
      try { excludedCourses = JSON.parse(setting.excludedCourses); } catch (_) {}
    }
    return res.json({
      neoBuildCourse: setting ? (setting.neoBuildCourse || null) : null,
      selectedAcademicLmp: setting ? (setting.selectedAcademicLmp || null) : null,
      excludedCourses,
    });
  } catch (error) {
    console.error('[CourseSettings] GET error:', error);
    res.status(500).json({ error: 'Failed to load course settings', details: error.message });
  }
});

// PUT /api/settings/course-settings - Update course settings (neoBuildCourse and/or selectedAcademicLmp and/or excludedCourses)
app.put('/api/settings/course-settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const { neoBuildCourse, selectedAcademicLmp, excludedCourses } = req.body;
    // At least one field must be present (allow empty string/array to clear a value)
    if (neoBuildCourse === undefined && selectedAcademicLmp === undefined && excludedCourses === undefined) {
      return res.status(400).json({ error: 'No settings fields provided' });
    }
    const existing = await db.$queryRawUnsafe(
      'SELECT id, "neoBuildCourse", "selectedAcademicLmp", "excludedCourses" FROM "CourseSettings" LIMIT 1'
    );
    const now = new Date().toISOString();
    if (existing && existing.length > 0) {
      const row = existing[0];
      const newNeoBuildCourse = neoBuildCourse !== undefined ? neoBuildCourse : row.neoBuildCourse;
      const newSelectedAcademicLmp = selectedAcademicLmp !== undefined ? selectedAcademicLmp : row.selectedAcademicLmp;
      const newExcludedCourses = excludedCourses !== undefined ? JSON.stringify(excludedCourses) : (row.excludedCourses || '[]');
      await db.$executeRawUnsafe(
        'UPDATE "CourseSettings" SET "neoBuildCourse" = $1, "selectedAcademicLmp" = $2, "excludedCourses" = $3, "updatedAt" = $4::timestamp WHERE id = $5',
        newNeoBuildCourse || null, newSelectedAcademicLmp || null, newExcludedCourses, now, row.id
      );
    } else {
      const newId = require('crypto').randomUUID();
      const newExcludedCourses = excludedCourses !== undefined ? JSON.stringify(excludedCourses) : '[]';
      await db.$executeRawUnsafe(
        'INSERT INTO "CourseSettings" (id, "neoBuildCourse", "selectedAcademicLmp", "excludedCourses", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp)',
        newId, neoBuildCourse || null, selectedAcademicLmp || null, newExcludedCourses, now, now
      );
    }
    console.log(`[CourseSettings] updated: neoBuildCourse=${neoBuildCourse}, selectedAcademicLmp=${selectedAcademicLmp}, excludedCourses=${JSON.stringify(excludedCourses)}`);
    res.json({ success: true, neoBuildCourse, selectedAcademicLmp, excludedCourses });
  } catch (error) {
    console.error('[CourseSettings] PUT error:', error);
    res.status(500).json({ error: 'Failed to update course settings', details: error.message });
  }
});

// GET /api/settings/course-academic-progress - Get all course academic progress records
app.get('/api/settings/course-academic-progress', async (req, res) => {
  try {
    const db = await getPrisma();
    const records = await db.$queryRawUnsafe(
      'SELECT "courseCode", "lessonCode" FROM "CourseAcademicProgress" ORDER BY "courseCode" ASC'
    );
    const map = {};
    (records || []).forEach(r => {
      if (!map[r.courseCode]) map[r.courseCode] = [];
      map[r.courseCode].push(r.lessonCode);
    });
    res.json({ success: true, data: map });
  } catch (error) {
    console.error('[CourseAcademicProgress] GET error:', error);
    res.status(500).json({ error: 'Failed to load course academic progress', details: error.message });
  }
});

// POST /api/settings/course-academic-progress - Mark a course lesson as complete
app.post('/api/settings/course-academic-progress', async (req, res) => {
  try {
    const db = await getPrisma();
    const { courseCode, lessonCode, userId } = req.body;
    if (!courseCode || !lessonCode) {
      return res.status(400).json({ error: 'Missing courseCode or lessonCode' });
    }
    const newId = require('crypto').randomUUID();
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(`
      INSERT INTO "CourseAcademicProgress" (id, "courseCode", "lessonCode", "completedDate", "completedBy")
      VALUES ($1, $2, $3, $4::timestamp, $5)
      ON CONFLICT ("courseCode", "lessonCode") DO NOTHING
    `, newId, courseCode, lessonCode, now, userId || null);
    console.log(`[CourseAcademicProgress] marked ${courseCode}/${lessonCode} as complete`);
    res.json({ success: true });
  } catch (error) {
    console.error('[CourseAcademicProgress] POST error:', error);
    res.status(500).json({ error: 'Failed to save course academic progress', details: error.message });
  }
});

// DELETE /api/settings/course-academic-progress - Mark a course lesson as incomplete
app.delete('/api/settings/course-academic-progress', async (req, res) => {
  try {
    const db = await getPrisma();
    const { courseCode, lessonCode } = req.query;
    if (!courseCode || !lessonCode) {
      return res.status(400).json({ error: 'Missing courseCode or lessonCode' });
    }
    await db.$executeRawUnsafe(
      'DELETE FROM "CourseAcademicProgress" WHERE "courseCode" = $1 AND "lessonCode" = $2',
      courseCode, lessonCode
    );
    console.log(`[CourseAcademicProgress] marked ${courseCode}/${lessonCode} as incomplete`);
    res.json({ success: true });
  } catch (error) {
    console.error('[CourseAcademicProgress] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete course academic progress', details: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/currencies - Load currency settings (dedicated endpoint for reliability)
app.get('/api/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const orgId = req.query.orgId || 'default';
    // Try dedicated currency storage first (most recent)
    const rows = await db.$queryRawUnsafe(
      `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );
    if (!rows || rows.length === 0) {
      return res.json({ masterCurrencies: [], currencyRequirements: [] });
    }
    const data = rows[0].data;
    return res.json({
      masterCurrencies: data.masterCurrencies || [],
      currencyRequirements: data.currencyRequirements || [],
    });
  } catch (error) {
    console.error('[Currencies] GET error:', error);
    res.status(500).json({ error: 'Failed to load currencies', details: error.message });
  }
});

// POST /api/currencies - Save currency settings (dedicated endpoint for reliability)
app.post('/api/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { orgId = 'default', masterCurrencies, currencyRequirements, updatedBy } = req.body;
    if (!masterCurrencies && !currencyRequirements) {
      return res.status(400).json({ error: 'Missing currency data' });
    }
    const now = new Date().toISOString();
    // Load existing settings first to merge
    let existingData = {};
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
        orgId
      );
      if (rows && rows.length > 0) existingData = rows[0].data || {};
    } catch (e) {}
    // Merge currencies into existing settings
    const updatedData = {
      ...existingData,
      masterCurrencies: masterCurrencies || existingData.masterCurrencies || [],
      currencyRequirements: currencyRequirements || existingData.currencyRequirements || [],
    };
    const settingsJson = JSON.stringify(updatedData);
    await db.$executeRawUnsafe(`
      INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::timestamp, $4::timestamp)
      ON CONFLICT ("orgId") DO UPDATE SET
        "data" = $2::jsonb,
        "updatedBy" = $3,
        "updatedAt" = $4::timestamp
    `, orgId, settingsJson, updatedBy || null, now);
    console.log(`[Currencies] ✅ Saved currencies for orgId=${orgId} — masters: ${(masterCurrencies||[]).length}, reqs: ${(currencyRequirements||[]).length}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Currencies] POST error:', error);
    res.status(500).json({ error: 'Failed to save currencies', details: error.message });
  }
});

// GET /api/courses - Fetch all courses from the database
app.get('/api/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const courses = await db.course.findMany({
      where: scopedWhere,
      orderBy: { startDate: 'asc' },
    });
    
    // Sort courses by code numerically (FIC210 before FIC211)
    courses.sort((a, b) => {
      const aCode = a.code || a.name;
      const bCode = b.code || b.name;
      
      // Extract numeric part from course codes (e.g., "FIC210" -> 210)
      const aNum = parseInt(aCode.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(bCode.replace(/\D/g, ''), 10) || 0;
      
      // If both have numeric parts, sort by them
      if (aNum && bNum) {
        return aNum - bNum;
      }
      
      // Otherwise, fall back to alphabetical sort
      return aCode.localeCompare(bCode);
    });
    
    // Map DB fields to the App's Course interface
    const mapped = courses.map(c => ({
      name: c.name,
      color: c.color || '#6366f1',
      startDate: c.startDate || '',
      gradDate: c.endDate || '',
      raafStart: c.raafCount || 0,
      navyStart: c.navyCount || 0,
      armyStart: c.armyCount || 0,
      status: c.status || 'ACTIVE',
      location: c.location || '',
      unit: c.unit || '',
      lmpType: c.lmpType || '',
      academicLmpType: c.academicLmpType || '',
      code: c.code || c.name,
    }));
    res.json({ courses: mapped });
  } catch (error) {
    console.error('❌ GET /api/courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// POST /api/courses - Create or update a course in the database
app.post('/api/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    const { name, color, startDate, gradDate, raafStart, navyStart, armyStart, location, unit, lmpType, academicLmpType, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const course = await db.course.upsert({
      where: { code: name },
      update: {
        color: color || '#6366f1',
        startDate: startDate || '',
        endDate: gradDate || '',
        raafCount: raafStart || 0,
        navyCount: navyStart || 0,
        armyCount: armyStart || 0,
        location: location || '',
        unit: unit || '',
        lmpType: lmpType || '',
        academicLmpType: academicLmpType || '',
        status: status || 'ACTIVE',
        updatedAt: new Date(),
      },
      create: {
        name,
        code: name,
        color: color || '#6366f1',
        startDate: startDate || '',
        endDate: gradDate || '',
        raafCount: raafStart || 0,
        navyCount: navyStart || 0,
        armyCount: armyStart || 0,
        location: location || '',
        unit: unit || '',
        lmpType: lmpType || '',
        academicLmpType: academicLmpType || '',
        status: status || 'ACTIVE',
      },
    });
    res.json({ success: true, course });
  } catch (error) {
    console.error('❌ POST /api/courses error:', error);
    res.status(500).json({ error: 'Failed to save course' });
  }
});

// DELETE /api/courses/:name - Delete a course from the database
app.delete('/api/courses/:name', async (req, res) => {
  try {
    const db = await getPrisma();
    const name = decodeURIComponent(req.params.name);
    await db.course.deleteMany({ where: { code: name } });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/courses error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// GET /api/personnel
app.get('/api/personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { role, available, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (available === 'true') where.isAvailable = true;
    if (available === 'false') where.isAvailable = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const finalWhere = mergeScopedWhere(where, scopedWhere);

    const personnel = await db.personnel.findMany({
      where: finalWhere,
      orderBy: { name: 'asc' },
    });

    console.log(`✅ GET /api/personnel - returning ${personnel.length} records`);
    res.json({ personnel });
  } catch (error) {
    console.error('❌ GET /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to fetch personnel', details: error.message });
  }
});

// POST /api/personnel
app.post('/api/personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;

    // Auto-link to existing User by PMKEYS
    let linkedUserId = null;
    if (body.idNumber) {
      const existingUser = await db.user.findFirst({
        where: { userId: body.idNumber.toString() }
      });
      if (existingUser) {
        linkedUserId = existingUser.id;
        console.log(`✅ Auto-linked to user: ${existingUser.username}`);
      }
    }

    const newPersonnel = await db.personnel.create({
      data: {
        name: body.name || '',
        rank: body.rank || null,
        role: body.role || null,
        category: body.category || null,
        unit: body.unit || null,
        location: body.location || null,
        idNumber: body.idNumber || null,
        callsignNumber: body.callsignNumber || null,
        email: body.email || null,
        phoneNumber: body.phoneNumber || null,
        seatConfig: body.seatConfig || null,
        isQFI: body.isQFI || false,
        isOFI: body.isOFI || false,
        isCFI: body.isCFI || false,
        isExecutive: body.isExecutive || false,
        isFlyingSupervisor: body.isFlyingSupervisor || false,
        isIRE: body.isIRE || false,
        isCommandingOfficer: body.isCommandingOfficer || false,
        isTestingOfficer: body.isTestingOfficer || false,
        isContractor: body.isContractor || false,
        isAdminStaff: body.isAdminStaff || false,
        isActive: true,
        userId: linkedUserId,
      }
    });

    console.log(`✅ POST /api/personnel - created: ${newPersonnel.name}`);
    res.json({ success: true, personnel: newPersonnel });
  } catch (error) {
    console.error('❌ POST /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to create personnel', details: error.message });
  }
});

// PATCH /api/personnel/:id - Update a personnel (instructor) record
app.patch('/api/personnel/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }

    const existing = await db.personnel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personnel not found' });
    }

    // Sanitize: only include fields that exist in the Personnel schema
    // Strip client-side fields like _dataSource, id (managed by DB), currencyStatus, scores, etc.
    const PERSONNEL_FIELDS = [
      'name', 'rank', 'role', 'qualifications', 'availability', 'preferences',
      'isActive', 'callsignNumber', 'category', 'email', 'flight', 'idNumber',
      'isAdminStaff', 'isCFI', 'isCommandingOfficer', 'isContractor',
      'isDeputyFlightCommander', 'isExecutive', 'isFlyingSupervisor', 'isIRE',
      'isOFI', 'isQFI', 'isTestingOfficer', 'location', 'permissions',
      'phoneNumber', 'priorExperience', 'seatConfig', 'service', 'unavailability',
      'unit', 'photoUrl', 'userId'
    ];
    const sanitizedUpdates = {};
    for (const field of PERSONNEL_FIELDS) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    const updated = await db.personnel.update({
      where: { id },
      data: sanitizedUpdates
    });

    console.log(`✅ PATCH /api/personnel/${id} - updated: ${updated.name}`);
    res.json({ success: true, personnel: updated });
  } catch (error) {
    console.error('❌ PATCH /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to update personnel', details: error.message });
  }
});

// POST /api/cleanup-deploy-unavailability - Remove all __deploy__ tagged unavailability periods
// from all personnel and trainees in the DB. One-time fix for stuck "Deployed" conflicts.
app.post('/api/cleanup-deploy-unavailability', async (req, res) => {
  try {
    const db = await getPrisma();
    let personnelFixed = 0;
    let traineesFixed = 0;

    // Fix personnel (instructors)
    const allPersonnel = await db.personnel.findMany({ select: { id: true, name: true, unavailability: true } });
    for (const person of allPersonnel) {
      const unavail = Array.isArray(person.unavailability) ? person.unavailability : [];
      const filtered = unavail.filter(p => !p || !p.notes || !String(p.notes).startsWith('__deploy__'));
      if (filtered.length !== unavail.length) {
        await db.personnel.update({ where: { id: person.id }, data: { unavailability: filtered } });
        console.log(`[CleanupDeploy] Cleaned ${unavail.length - filtered.length} deploy tag(s) from personnel: ${person.name}`);
        personnelFixed++;
      }
    }

    // Fix trainees
    const allTrainees = await db.trainee.findMany({ select: { id: true, fullName: true, unavailability: true } });
    for (const trainee of allTrainees) {
      const unavail = Array.isArray(trainee.unavailability) ? trainee.unavailability : [];
      const filtered = unavail.filter(p => !p || !p.notes || !String(p.notes).startsWith('__deploy__'));
      if (filtered.length !== unavail.length) {
        await db.trainee.update({ where: { id: trainee.id }, data: { unavailability: filtered } });
        console.log(`[CleanupDeploy] Cleaned ${unavail.length - filtered.length} deploy tag(s) from trainee: ${trainee.fullName}`);
        traineesFixed++;
      }
    }

    console.log(`✅ POST /api/cleanup-deploy-unavailability - fixed ${personnelFixed} personnel, ${traineesFixed} trainees`);
    res.json({ success: true, personnelFixed, traineesFixed });
  } catch (error) {
    console.error('❌ POST /api/cleanup-deploy-unavailability error:', error);
    res.status(500).json({ error: 'Failed to cleanup deploy unavailability', details: error.message });
  }
});

// GET /api/personnel/:id/currencies - Get currency status for an instructor
// :id can be a UUID string (DB id) or a numeric idNumber
app.get('/api/personnel/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    let record = null;
    const numericId = parseInt(id, 10);
    console.log(`GET /api/personnel/${id}/currencies -- numericId=${numericId}, isNumeric=${!isNaN(numericId)}`);
    if (!isNaN(numericId)) {
      // Order by updatedAt desc -- consistently get the most recently updated record
      // Also prefer records that already have currency data
      const records = await db.personnel.findMany({ where: { idNumber: numericId }, orderBy: { updatedAt: 'desc' } });
      console.log(`   Found ${records.length} record(s) for idNumber ${numericId}:`, records.map(r => ({ id: r.id, name: r.name, hasCurrency: !!(r.qualifications && r.qualifications.currencyStatus && r.qualifications.currencyStatus.length) })));
      record = records.find(r => r.qualifications && r.qualifications.currencyStatus && r.qualifications.currencyStatus.length > 0) || records[0] || null;
      console.log(`   Using record id=${record && record.id}, name=${record && record.name}`);
    } else {
      // UUID lookup — but also check all records with the same idNumber so we get the most complete data.
      // This handles the case where duplicates exist and the "best" record (with currency data) differs
      // from the specific UUID record being queried.
      const uuidRecord = await db.personnel.findUnique({ where: { id } });
      console.log(`   UUID lookup -- found: id=${uuidRecord && uuidRecord.id}, name=${uuidRecord && uuidRecord.name}`);
      if (uuidRecord && uuidRecord.idNumber) {
        // Check if any sibling record with the same idNumber has more currency data
        const siblings = await db.personnel.findMany({ where: { idNumber: uuidRecord.idNumber }, orderBy: { updatedAt: 'desc' } });
        console.log(`   UUID lookup -- found ${siblings.length} sibling record(s) for idNumber ${uuidRecord.idNumber}`);
        // Prefer the record that has currency data; otherwise use the UUID record itself
        record = siblings.find(r => r.qualifications && r.qualifications.currencyStatus && r.qualifications.currencyStatus.length > 0) || uuidRecord;
        console.log(`   UUID lookup -- using record id=${record.id} (has ${record.qualifications && record.qualifications.currencyStatus ? record.qualifications.currencyStatus.length : 0} currency entries)`);
      } else {
        record = uuidRecord;
      }
    }
    if (!record) return res.status(404).json({ error: 'Personnel not found' });
    const currencies = record.qualifications ? (record.qualifications.currencyStatus || []) : [];
    console.log(`   Returning ${currencies.length} currency record(s):`, JSON.stringify(currencies));
    res.json({ currencyStatus: currencies });
  } catch (error) {
    console.error('GET /api/personnel/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch personnel currencies', details: error.message });
  }
});

// PATCH /api/personnel/:id/currencies - Update currency status for an instructor
// :id can be a UUID string (DB id) or a numeric idNumber
app.patch('/api/personnel/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const { currencyStatus } = req.body;

    if (!id) return res.status(400).json({ error: 'Personnel ID is required' });

    console.log(`PATCH /api/personnel/${id}/currencies -- saving ${currencyStatus && currencyStatus.length} items:`, JSON.stringify(currencyStatus));

    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      // Update ALL records with this idNumber to keep duplicates in sync
      const records = await db.personnel.findMany({ where: { idNumber: numericId } });
      if (!records.length) return res.status(404).json({ error: 'Personnel not found' });
      console.log(`   Updating ${records.length} record(s) for idNumber ${numericId}:`, records.map(r => r.id));
      await Promise.all(records.map(existing => {
        const currentQual = existing.qualifications || {};
        return db.personnel.update({
          where: { id: existing.id },
          data: {
            qualifications: {
              ...(typeof currentQual === 'object' ? currentQual : {}),
              currencyStatus: currencyStatus || []
            }
          }
        });
      }));
      console.log(`   PATCH /api/personnel/${id}/currencies - updated ${records.length} record(s) for: ${records[0].name}`);
      res.json({ success: true, currencyStatus });
    } else {
      const existing = await db.personnel.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Personnel not found' });
      // Also update ALL records with the same idNumber to keep duplicates in sync
      // This mirrors the numeric-idNumber PATCH behaviour
      if (existing.idNumber) {
        const allRecords = await db.personnel.findMany({ where: { idNumber: existing.idNumber } });
        console.log(`   UUID PATCH -- updating ${allRecords.length} record(s) for idNumber ${existing.idNumber}:`, allRecords.map(r => r.id));
        await Promise.all(allRecords.map(rec => {
          const currentQual = rec.qualifications || {};
          return db.personnel.update({
            where: { id: rec.id },
            data: {
              qualifications: {
                ...(typeof currentQual === 'object' ? currentQual : {}),
                currencyStatus: currencyStatus || []
              }
            }
          });
        }));
        console.log(`   PATCH /api/personnel/${id}/currencies - updated ${allRecords.length} record(s) for: ${existing.name}`);
      } else {
        // No idNumber — just update the single record
        const currentQual = existing.qualifications || {};
        await db.personnel.update({
          where: { id: existing.id },
          data: {
            qualifications: {
              ...(typeof currentQual === 'object' ? currentQual : {}),
              currencyStatus: currencyStatus || []
            }
          }
        });
        console.log(`   PATCH /api/personnel/${id}/currencies - updated single record for: ${existing.name}`);
      }
      res.json({ success: true, currencyStatus });
    }
  } catch (error) {
    console.error('PATCH /api/personnel/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to update personnel currencies', details: error.message });
  }
});

// GET /api/trainees/:id/currencies - Get currency status for a trainee
// :id can be a UUID/cuid string (DB id) or a numeric idNumber
app.get('/api/trainees/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    let record = null;
    const numericId = parseInt(id, 10);
    console.log(`GET /api/trainees/${id}/currencies -- numericId=${numericId}, isNumeric=${!isNaN(numericId)}`);
    if (!isNaN(numericId)) {
      // Order by updatedAt desc -- prefer most recently updated record
      // Also prefer records that already have currency data
      const records = await db.trainee.findMany({ where: { idNumber: numericId }, orderBy: { updatedAt: 'desc' } });
      console.log(`   Found ${records.length} record(s) for idNumber ${numericId}:`, records.map(r => ({ id: r.id, name: r.name, hasCurrency: !!(r.currencyStatus && r.currencyStatus.length) })));
      record = records.find(r => r.currencyStatus && Array.isArray(r.currencyStatus) && r.currencyStatus.length > 0) || records[0] || null;
      console.log(`   Using record id=${record && record.id}, name=${record && record.name}`);
    } else {
      // UUID lookup — but also check all records with the same idNumber so we get the most complete data.
      const uuidRecord = await db.trainee.findUnique({ where: { id } });
      console.log(`   UUID lookup -- found: id=${uuidRecord && uuidRecord.id}, name=${uuidRecord && uuidRecord.name}`);
      if (uuidRecord && uuidRecord.idNumber) {
        const siblings = await db.trainee.findMany({ where: { idNumber: uuidRecord.idNumber }, orderBy: { updatedAt: 'desc' } });
        console.log(`   UUID lookup -- found ${siblings.length} sibling record(s) for idNumber ${uuidRecord.idNumber}`);
        record = siblings.find(r => r.currencyStatus && Array.isArray(r.currencyStatus) && r.currencyStatus.length > 0) || uuidRecord;
        console.log(`   UUID lookup -- using record id=${record.id} (has ${Array.isArray(record.currencyStatus) ? record.currencyStatus.length : 0} currency entries)`);
      } else {
        record = uuidRecord;
      }
    }
    if (!record) return res.status(404).json({ error: 'Trainee not found' });
    let currencies = [];
    if (record.currencyStatus) {
      currencies = Array.isArray(record.currencyStatus) ? record.currencyStatus : [];
    }
    console.log(`   Returning ${currencies.length} currency record(s):`, JSON.stringify(currencies));
    res.json({ currencyStatus: currencies });
  } catch (error) {
    console.error('GET /api/trainees/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch trainee currencies', details: error.message });
  }
});

// PATCH /api/trainees/:id/currencies - Update currency status for a trainee
// :id can be a UUID/cuid string (DB id) or a numeric idNumber
app.patch('/api/trainees/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const { currencyStatus } = req.body;

    if (!id) return res.status(400).json({ error: 'Trainee ID is required' });

    console.log(`PATCH /api/trainees/${id}/currencies -- saving ${currencyStatus && currencyStatus.length} items:`, JSON.stringify(currencyStatus));

    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      // Update ALL records with this idNumber to keep duplicates in sync
      const records = await db.trainee.findMany({ where: { idNumber: numericId } });
      if (!records.length) return res.status(404).json({ error: 'Trainee not found' });
      console.log(`   Updating ${records.length} record(s) for idNumber ${numericId}:`, records.map(r => r.id));
      await Promise.all(records.map(existing =>
        db.trainee.update({
          where: { id: existing.id },
          data: { currencyStatus: currencyStatus || [] }
        })
      ));
      console.log(`   PATCH /api/trainees/${id}/currencies - updated ${records.length} record(s) for: ${records[0].name}`);
      res.json({ success: true, currencyStatus });
    } else {
      const existing = await db.trainee.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Trainee not found' });
      // Also update ALL records with the same idNumber to keep duplicates in sync
      if (existing.idNumber) {
        const allRecords = await db.trainee.findMany({ where: { idNumber: existing.idNumber } });
        console.log(`   UUID PATCH -- updating ${allRecords.length} record(s) for idNumber ${existing.idNumber}:`, allRecords.map(r => r.id));
        await Promise.all(allRecords.map(rec =>
          db.trainee.update({
            where: { id: rec.id },
            data: { currencyStatus: currencyStatus || [] }
          })
        ));
        console.log(`   PATCH /api/trainees/${id}/currencies - updated ${allRecords.length} record(s) for: ${existing.name}`);
      } else {
        await db.trainee.update({
          where: { id: existing.id },
          data: { currencyStatus: currencyStatus || [] }
        });
        console.log(`   PATCH /api/trainees/${id}/currencies - updated single record for: ${existing.name}`);
      }
      res.json({ success: true, currencyStatus });
    }
  } catch (error) {
    console.error('PATCH /api/trainees/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to update trainee currencies', details: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY AUDIT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/audit/currency - Write a currency audit entry to the DB AuditLog table
// Body: { personId, personName, personType, userId, userName, changes: [{currencyName, oldDate, newDate}] }
app.post('/api/audit/currency', async (req, res) => {
  try {
    const db = await getPrisma();
    const { personId, personName, personType, userId, userName, changes } = req.body;

    if (!changes || changes.length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    // Build a human-readable summary
    const summary = changes.map(c => {
      const parts = [];
      if (c.activeChanged) {
        parts.push(`${c.currencyName}: ${c.isNowInactive ? 'set Inactive' : 'set Active'}`);
      }
      if (c.oldDate !== c.newDate) {
        if (!c.oldDate && c.newDate) parts.push(`${c.currencyName}: date set to ${c.newDate}`);
        else if (c.oldDate && !c.newDate) parts.push(`${c.currencyName}: date cleared (was ${c.oldDate})`);
        else if (!c.activeChanged) parts.push(`${c.currencyName}: ${c.oldDate} → ${c.newDate}`);
      }
      return parts.join(', ') || `${c.currencyName}: updated`;
    }).join('; ');

    // Resolve the DB User for the audit entry
    // User.userId = PMKEYS string (what frontend sends), User.id = UUID primary key (what AuditLog needs)
    let dbUserId = null;

    // 1. Try by User.userId field (PMKEYS number sent from frontend)
    if (userId) {
      const user = await db.user.findFirst({ where: { userId: String(userId) } });
      if (user) {
        dbUserId = user.id;
        console.log(`[Audit] Resolved user by userId/PMKEYS: ${userId} → dbUserId=${dbUserId}`);
      }
    }

    // 2. Try matching by username or name fragments
    if (!dbUserId && userName) {
      const nameParts = userName.split(/[,\s]+/).filter(Boolean);
      const user = await db.user.findFirst({
        where: {
          OR: [
            { username: { contains: userName, mode: 'insensitive' } },
            nameParts[0] ? { lastName: { contains: nameParts[0], mode: 'insensitive' } } : undefined,
            nameParts[1] ? { firstName: { contains: nameParts[1], mode: 'insensitive' } } : undefined,
          ].filter(Boolean),
        }
      });
      if (user) {
        dbUserId = user.id;
        console.log(`[Audit] Resolved user by name match: "${userName}" → dbUserId=${dbUserId}`);
      }
    }

    // 3. Last resort: use the first active admin/system user so audit is NEVER silently dropped
    if (!dbUserId) {
      const fallbackUser = await db.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (fallbackUser) {
        dbUserId = fallbackUser.id;
        console.warn(`[Audit] Could not match user (userId=${userId}, userName=${userName}). Using fallback user ${dbUserId}. Recording audit anyway.`);
      }
    }

    // If absolutely no user exists in DB at all, we cannot create an AuditLog record (FK constraint)
    if (!dbUserId) {
      console.warn(`[Audit] No users in DB at all. Cannot log audit for userId=${userId}, userName=${userName}.`);
      return res.json({ success: true, warning: 'Audit entry skipped: no users in DB', summary });
    }

    const auditEntry = await db.auditLog.create({
      data: {
        userId: dbUserId,
        action: 'UPDATE',
        entityType: 'currency',
        entityId: String(personId),
        changes: {
          personName,
          personType,
          userName,
          summary,
          details: changes,
        },
      }
    });

    console.log(`✅ POST /api/audit/currency - logged currency change for ${personName} by ${userName}`);
    res.json({ success: true, auditId: auditEntry.id, summary });
  } catch (error) {
    console.error('❌ POST /api/audit/currency error:', error);
    res.status(500).json({ error: 'Failed to log currency audit', details: error.message });
  }
});

// GET /api/audit/currency/:personId - Get currency audit history for a person
// personId can be UUID or numeric idNumber
app.get('/api/audit/currency/:personId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { personId } = req.params;

    const entries = await db.auditLog.findMany({
      where: {
        entityType: 'currency',
        entityId: String(personId),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        User: {
          select: { firstName: true, lastName: true, username: true, userId: true }
        }
      }
    });

    const result = entries.map(e => ({
      id: e.id,
      createdAt: e.createdAt,
      userName: e.changes?.userName || (e.User ? `${e.User.firstName || ''} ${e.User.lastName || ''}`.trim() || e.User.username : 'Unknown'),
      summary: e.changes?.summary || '',
      details: e.changes?.details || [],
      personName: e.changes?.personName || '',
    }));

    res.json({ auditEntries: result });
  } catch (error) {
    console.error('❌ GET /api/audit/currency error:', error);
    res.status(500).json({ error: 'Failed to fetch currency audit', details: error.message });
  }
});

// GET /api/audit/logs - General durable audit history for admin review
app.get('/api/audit/logs', async (req, res) => {
  try {
    const db = await getPrisma();
    const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 500));
    const entityType = req.query.entityType ? String(req.query.entityType) : '';
    const action = req.query.action ? String(req.query.action) : '';
    const params = [];
    const where = [];

    if (entityType) {
      params.push(entityType);
      where.push(`a."entityType" = $${params.length}`);
    }

    if (action) {
      params.push(action);
      where.push(`a.action = $${params.length}`);
    }

    params.push(limit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await db.$queryRawUnsafe(
      `SELECT
         a.id,
         a.action,
         a."entityType",
         a."entityId",
         a.changes,
         a."ipAddress",
         a."userAgent",
         a."createdAt",
         u.username,
         u."userId",
         u."firstName",
         u."lastName"
       FROM "AuditLog" a
       LEFT JOIN "User" u ON u.id = a."userId"
       ${whereSql}
       ORDER BY a."createdAt" DESC
       LIMIT $${params.length}`,
      ...params
    );

    const auditEntries = rows.map((row) => {
      const displayName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username || row.userId || 'Unknown User';
      return {
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        changes: row.changes || {},
        ipAddress: row.ipAddress || '',
        userAgent: row.userAgent || '',
        createdAt: row.createdAt,
        userName: displayName,
      };
    });

    res.json({ auditEntries });
  } catch (error) {
    console.error('❌ GET /api/audit/logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
  }
});

// DELETE /api/personnel/:id - Delete a personnel record
app.delete('/api/personnel/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }

    // Check if the personnel exists
    const existing = await db.personnel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personnel not found' });
    }

    // Delete the personnel record
    await db.personnel.delete({ where: { id } });

    console.log(`✅ DELETE /api/personnel/${id} - deleted: ${existing.name}`);
    res.json({ success: true, deleted: { id, name: existing.name } });
  } catch (error) {
    console.error('❌ DELETE /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to delete personnel', details: error.message });
  }
});

// POST /api/personnel/bulk - Bulk insert personnel (for mock data migration)
app.post('/api/personnel/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { personnel: personnelList } = req.body;

    if (!Array.isArray(personnelList) || personnelList.length === 0) {
      return res.status(400).json({ error: 'personnel array is required' });
    }

    console.log(`📦 POST /api/personnel/bulk - attempting to insert ${personnelList.length} records`);

    // Fetch existing idNumbers to avoid duplicates
    const existingRecords = await db.personnel.findMany({
      select: { idNumber: true, name: true },
    });
    const existingIdNumbers = new Set(existingRecords.map(r => r.idNumber).filter(Boolean));
    const existingNames = new Set(existingRecords.map(r => r.name));

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const body of personnelList) {
      // Skip if already exists by idNumber or name
      if (body.idNumber && existingIdNumbers.has(body.idNumber)) {
        skipped++;
        continue;
      }
      if (!body.idNumber && existingNames.has(body.name)) {
        skipped++;
        continue;
      }

      try {
        // Auto-link to existing User by PMKEYS
        let linkedUserId = null;
        if (body.idNumber) {
          const existingUser = await db.user.findFirst({
            where: { userId: body.idNumber.toString() }
          });
          if (existingUser) {
            linkedUserId = existingUser.id;
          }
        }

        await db.personnel.create({
          data: {
            name: body.name || '',
            rank: body.rank || null,
            role: body.role || null,
            category: body.category || null,
            unit: body.unit || null,
            flight: body.flight || null,
            location: body.location || null,
            idNumber: body.idNumber || null,
            callsignNumber: body.callsignNumber || null,
            email: body.email || null,
            phoneNumber: body.phoneNumber || null,
            seatConfig: body.seatConfig || null,
            service: body.service || null,
            isQFI: body.isQFI || false,
            isOFI: body.isOFI || false,
            isCFI: body.isCFI || false,
            isExecutive: body.isExecutive || false,
            isFlyingSupervisor: body.isFlyingSupervisor || false,
            isIRE: body.isIRE || false,
            isCommandingOfficer: body.isCommandingOfficer || false,
            isDeputyFlightCommander: body.isDeputyFlightCommander || false,
            isTestingOfficer: body.isTestingOfficer || false,
            isContractor: body.isContractor || false,
            isAdminStaff: body.isAdminStaff || false,
            permissions: body.permissions || [],
            unavailability: body.unavailability || [],
            priorExperience: body.priorExperience || null,
            isActive: true,
            userId: linkedUserId,
          }
        });

        existingIdNumbers.add(body.idNumber);
        existingNames.add(body.name);
        inserted++;
      } catch (err) {
        console.error(`❌ Failed to insert ${body.name}:`, err.message);
        errors.push({ name: body.name, error: err.message });
      }
    }

    console.log(`✅ POST /api/personnel/bulk - inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`);
    res.json({
      success: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ POST /api/personnel/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk insert personnel', details: error.message });
  }
});

// ============================================================
// STAFF-TRAINEE ANALYSIS API ROUTE
// ============================================================

// GET /api/staff-trainee-analysis
// Returns analysis of staff trainee assignments (supports array instructor fields)
app.get('/api/staff-trainee-analysis', async (req, res) => {
  try {
    const prisma = await getPrisma();

    // Get all trainees with their instructor assignments (now arrays)
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      select: {
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });

    // Count primary trainees per instructor - each instructor in the array gets +1
    const primaryCounts = {};
    trainees.forEach(t => {
      const names = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : [];
      names.forEach(name => {
        if (name && name.trim()) {
          primaryCounts[name] = (primaryCounts[name] || 0) + 1;
        }
      });
    });

    // Count secondary trainees per instructor
    const secondaryCounts = {};
    trainees.forEach(t => {
      const names = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : [];
      names.forEach(name => {
        if (name && name.trim()) {
          secondaryCounts[name] = (secondaryCounts[name] || 0) + 1;
        }
      });
    });

    // Get all personnel to find staff with 0 trainees too
    const allPersonnel = await prisma.personnel.findMany({
      select: { name: true, unit: true, role: true }
    });

    // Build complete instructor set (all personnel + anyone referenced in trainee assignments)
    const instructorNames = new Set([
      ...allPersonnel.map(p => p.name),
      ...Object.keys(primaryCounts),
      ...Object.keys(secondaryCounts)
    ]);
    const totalStaff = instructorNames.size;

    // Build distribution: how many staff have 0, 1, 2, 3 primary trainees
    const primaryDistributionCounts = {};
    const secondaryDistributionCounts = {};

    instructorNames.forEach(name => {
      const pc = primaryCounts[name] || 0;
      const sc = secondaryCounts[name] || 0;
      primaryDistributionCounts[pc] = (primaryDistributionCounts[pc] || 0) + 1;
      secondaryDistributionCounts[sc] = (secondaryDistributionCounts[sc] || 0) + 1;
    });

    // Calculate summary statistics
    const totalPrimaryAssignments = Object.values(primaryCounts).reduce((sum, c) => sum + c, 0);
    const totalSecondaryAssignments = Object.values(secondaryCounts).reduce((sum, c) => sum + c, 0);
    const avgPrimary = totalStaff > 0 ? (totalPrimaryAssignments / totalStaff).toFixed(2) : '0';
    const avgSecondary = totalStaff > 0 ? (totalSecondaryAssignments / totalStaff).toFixed(2) : '0';

    // Build distribution arrays
    const maxPrimary = Math.max(...Object.keys(primaryDistributionCounts).map(Number), 0);
    const maxSecondary = Math.max(...Object.keys(secondaryDistributionCounts).map(Number), 0);

    const primaryDistribution = [];
    for (let i = 0; i <= maxPrimary; i++) {
      const count = primaryDistributionCounts[i] || 0;
      primaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: totalStaff > 0 ? ((count / totalStaff) * 100).toFixed(1) : '0'
      });
    }

    const secondaryDistribution = [];
    for (let i = 0; i <= maxSecondary; i++) {
      const count = secondaryDistributionCounts[i] || 0;
      secondaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: totalStaff > 0 ? ((count / totalStaff) * 100).toFixed(1) : '0'
      });
    }

    // Also compute per-trainee stats: how many instructors does each trainee have?
    const traineesWith0Primary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length === 0; }).length;
    const traineesWith1Primary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length === 1; }).length;
    const traineesWith2PlusPrimary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length >= 2; }).length;
    const traineesWith0Secondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length === 0; }).length;
    const traineesWith1Secondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length === 1; }).length;
    const traineesWith2PlusSecondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length >= 2; }).length;

    res.json({
      success: true,
      data: {
        totalStaff,
        totalTrainees: trainees.length,
        distinctRoles: [...new Set(allPersonnel.map(p => p.role).filter(Boolean))],
        summary: {
          averagePrimaryTrainees: avgPrimary,
          averageSecondaryTrainees: avgSecondary,
          totalPrimaryAssignments,
          totalSecondaryAssignments
        },
        traineeStats: {
          primaryInstructors: { with0: traineesWith0Primary, with1: traineesWith1Primary, with2Plus: traineesWith2PlusPrimary },
          secondaryInstructors: { with0: traineesWith0Secondary, with1: traineesWith1Secondary, with2Plus: traineesWith2PlusSecondary }
        },
        primaryDistribution,
        secondaryDistribution,
        instructorBreakdown: {
          primary: primaryCounts,
          secondary: secondaryCounts
        }
      }
    });
    
  } catch (error) {
    console.error('Error in staff-trainee-analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// TRAINEE API ROUTES
// ============================================================

// GET /api/trainees
app.get('/api/trainees', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course, isActive, search } = req.query;

    const where = {};
    if (course) where.course = course;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const finalWhere = mergeScopedWhere(where, scopedWhere);

    const trainees = await db.trainee.findMany({
      where: finalWhere,
      orderBy: { name: 'asc' },
    });

    console.log(`✅ GET /api/trainees - returning ${trainees.length} records`);
    res.json({ trainees });
  } catch (error) {
    console.error('❌ GET /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to fetch trainees', details: error.message });
  }
});

// DELETE /api/trainees/:id - Delete a trainee record
app.delete('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Trainee ID is required' });
    }

    // Check if the trainee exists
    const existing = await db.trainee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Trainee not found' });
    }

    // Delete the trainee record
    await db.trainee.delete({ where: { id } });

    console.log(`✅ DELETE /api/trainees/${id} - deleted: ${existing.name}`);
    res.json({ success: true, deleted: { id, name: existing.name } });
  } catch (error) {
    console.error('❌ DELETE /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to delete trainee', details: error.message });
  }
});

// PATCH /api/trainees/fix-location - Fix location for all trainees in a course
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-location', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course, correctLocation } = req.body;

    if (!course || !correctLocation) {
      return res.status(400).json({ error: 'course and correctLocation are required' });
    }

    const result = await db.trainee.updateMany({
      where: { course: course },
      data: { location: correctLocation }
    });

    console.log(`✅ Fixed location for ${result.count} trainees in course "${course}" to "${correctLocation}"`);
    res.json({ success: true, updated: result.count, course, correctLocation });
  } catch (error) {
    console.error('❌ Error fixing trainee locations:', error);
    res.status(500).json({ error: 'Failed to fix trainee locations', details: error.message });
  }
});

// PATCH /api/trainees/bulk-unit - Bulk update unit for trainees in a course
// NOTE: This must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/bulk-unit', async (req, res) => {
  try {
    const db = await getPrisma();
    const { courseNumber, newUnit } = req.body;

    if (!courseNumber || !newUnit) {
      return res.status(400).json({ error: 'courseNumber and newUnit are required' });
    }

    // Update all trainees in the course
    const result = await db.trainee.updateMany({
      where: { course: courseNumber },
      data: { unit: newUnit }
    });

    console.log(`✅ PATCH /api/trainees/bulk-unit - updated ${result.count} trainees in course "${courseNumber}" to unit "${newUnit}"`);
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/bulk-unit error:', error);
    res.status(500).json({ error: 'Failed to update trainees', details: error.message });
  }
});

// PATCH /api/trainees/fix-lmp-type - Fix lmpType for FIC course trainees
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-lmp-type', async (req, res) => {
  try {
    const db = await getPrisma();

    // Find all trainees whose course starts with 'FIC' but lmpType is not 'FIC'
    const ficTrainees = await db.trainee.findMany({
      where: {
        AND: [
          { course: { startsWith: 'FIC' } },
          { NOT: { lmpType: 'FIC' } }
        ]
      },
      select: { id: true, name: true, course: true, lmpType: true }
    });

    if (ficTrainees.length === 0) {
      console.log('✅ PATCH /api/trainees/fix-lmp-type - No FIC trainees need updating');
      return res.json({ success: true, count: 0, message: 'All FIC trainees already have correct lmpType' });
    }

    // Update all FIC trainees to have lmpType: 'FIC'
    const result = await db.trainee.updateMany({
      where: {
        AND: [
          { course: { startsWith: 'FIC' } },
          { NOT: { lmpType: 'FIC' } }
        ]
      },
      data: { lmpType: 'FIC' }
    });

    console.log(`✅ PATCH /api/trainees/fix-lmp-type - Updated ${result.count} FIC trainees: ${ficTrainees.map(t => t.name).join(', ')}`);
    res.json({ success: true, count: result.count, updated: ficTrainees.map(t => ({ name: t.name, course: t.course })) });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/fix-lmp-type error:', error);
    res.status(500).json({ error: 'Failed to fix lmpType for FIC trainees', details: error.message });
  }
});

// ============================================================
// INDIVIDUAL LMP ROUTES
// MUST be defined BEFORE /api/trainees/:id to avoid route conflicts
// ============================================================

// POST /api/fix-bif-ftd-dependencies - Fix BIF FTD dependencies
// Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
// Rule 2: If BIF1 is complete, mark BIF FTD3 complete
// Rule 3: Remove asterisk versions (BIF FTD1*, BIF FTD3*) from completedEventIds
app.post('/api/fix-bif-ftd-dependencies', async (req, res) => {
  const maintenanceSecret = requireConfiguredSecret('DFP_NEO_MAINTENANCE_SECRET', 'dfp-neo-maintenance-development-only');
  const providedSecret = req.headers['x-maintenance-secret'] || req.query.secret;
  if (providedSecret !== maintenanceSecret) {
    return res.status(401).json({ error: 'Unauthorized maintenance request' });
  }

  try {
    const db = await getPrisma();
    console.log('[BIF FTD Fix] Starting BIF FTD dependency fix...');

    // Get all trainees on ADF courses (BPC+IPC)
    const trainees = await db.trainee.findMany({
      where: {
        isActive: true,
        course: {
          startsWith: 'ADF'
        }
      },
      include: {
        individualLMP: true
      }
    });

    console.log(`[BIF FTD Fix] Found ${trainees.length} active trainees on ADF courses (BPC+IPC)`);

    let ftd1Fixed = 0;
    let ftd3Fixed = 0;
    let asterisksRemoved = 0;
    const details = [];

    for (const trainee of trainees) {
      if (!trainee.individualLMP) continue;

      const completedEventIds = trainee.individualLMP.completedEventIds || [];
      const newCompletedIds = [...completedEventIds];
      let changed = false;

      // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
      if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
        newCompletedIds.push('BIF FTD1');
        changed = true;
        ftd1Fixed++;
        details.push(`${trainee.fullName}: Marking BIF FTD1 complete (BIF FTD2 is complete)`);
      }

      // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
      if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
        newCompletedIds.push('BIF FTD3');
        changed = true;
        ftd3Fixed++;
        details.push(`${trainee.fullName}: Marking BIF FTD3 complete (BIF1 is complete)`);
      }

      // Rule 3: Remove asterisk versions if non-asterisk versions exist
      const originalLength = newCompletedIds.length;
      const filtered = newCompletedIds.filter(id => {
        // Remove BIF FTD1* if BIF FTD1 exists, remove BIF FTD3* if BIF FTD3 exists
        if (id === 'BIF FTD1*' && newCompletedIds.includes('BIF FTD1')) return false;
        if (id === 'BIF FTD3*' && newCompletedIds.includes('BIF FTD3')) return false;
        return true;
      });
      
      if (filtered.length !== originalLength) {
        newCompletedIds.splice(0, newCompletedIds.length, ...filtered);
        changed = true;
        asterisksRemoved++;
        details.push(`${trainee.fullName}: Removed asterisk versions from completedEventIds`);
      }

      if (changed) {
        await db.individualLMP.update({
          where: { traineeId: trainee.id },
          data: {
            completedEventIds: newCompletedIds,
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`[BIF FTD Fix] Complete: BIF FTD1=${ftd1Fixed}, BIF FTD3=${ftd3Fixed}, Asterisks removed=${asterisksRemoved}`);
    res.json({
      success: true,
      ftd1Fixed,
      ftd3Fixed,
      asterisksRemoved,
      totalTrainees: trainees.length,
      details
    });
  } catch (error) {
    console.error('[BIF FTD Fix] Error:', error);
    res.status(500).json({ error: 'Failed to fix BIF FTD dependencies', details: error.message });
  }
});

// POST /api/fix-pt051-scores - Remove asterisks from PT-051 Score records
// This fixes the display in the Performance History table
app.post('/api/fix-pt051-scores', async (req, res) => {
  try {
    const db = await getPrisma();
    console.log('[PT-051 Fix] Starting PT-051 Score fix...');

    // Get all Score records with BIF FTD1* or BIF FTD3*
    const scoresToFix = await db.score.findMany({
      where: {
        event: {
          in: ['BIF FTD1*', 'BIF FTD3*']
        }
      }
    });

    console.log(`[PT-051 Fix] Found ${scoresToFix.length} PT-051 Score records with asterisks`);

    let updatedCount = 0;
    const details = [];

    for (const score of scoresToFix) {
      const oldEvent = score.event;
      const newEvent = oldEvent.replace('*', '');
      
      await db.score.update({
        where: { id: score.id },
        data: { event: newEvent }
      });
      
      updatedCount++;
      details.push(`Updated score for ${score.traineeFullName}: ${oldEvent} → ${newEvent}`);
    }

    console.log(`[PT-051 Fix] Complete: Updated ${updatedCount} PT-051 Score records`);
    res.json({
      success: true,
      updatedCount,
      totalScores: scoresToFix.length,
      details
    });
  } catch (error) {
    console.error('[PT-051 Fix] Error:', error);
    res.status(500).json({ error: 'Failed to fix PT-051 Score records', details: error.message });
  }
});

// ============================================================

// GET /api/trainees/lmp-sync - Return all IndividualLMPs (traineeFullName + completedEventIds)
app.get('/api/trainees/lmp-sync', async (req, res) => {
  try {
    const db = await getPrisma();
    const includeEvents = req.query.includeEvents === 'true';
    const buildPayload = req.query.build === 'true';
    const select = {
      id: true,
      traineeId: true,
      traineeFullName: true,
      lmpType: true,
      completedEventIds: true,
      updatedAt: true,
    };
    if (includeEvents && !buildPayload) {
      select.events = true;
    }

    const lmps = await db.individualLMP.findMany({
      select,
      orderBy: { traineeFullName: 'asc' },
    });
    if (!includeEvents) {
      return res.json({ lmps, count: lmps.length });
    }

    if (buildPayload) {
      const allSyllabusItems = await db.$queryRawUnsafe(
        `SELECT * FROM "SyllabusItem" WHERE "isActive" = true ORDER BY "sortOrder" ASC`
      );
      const parsedSyllabus = (allSyllabusItems || []).map(item => ({
        ...item,
        courses: Array.isArray(item.courses) ? item.courses :
          (typeof item.courses === 'string' ? JSON.parse(item.courses) : []),
      }));
      const getMasterSyllabus = (lmpType) => {
        if (lmpType === 'FIC') return parsedSyllabus.filter(item => item.courses.includes('FIC'));
        if (lmpType && lmpType !== 'BPC+IPC') return parsedSyllabus.filter(item => item.courses.includes(lmpType));
        return parsedSyllabus.filter(item => !item.courses.includes('FIC') && item.type !== 'Academics');
      };
      const compactLmpEventForBuild = (item) => ({
        id: item.id,
        code: item.code,
        masterEventId: item.masterEventId,
        eventDescription: item.eventDescription,
        type: item.type,
        duration: item.duration,
        sortieType: item.sortieType,
        dayNight: item.dayNight,
        methodOfDelivery: item.methodOfDelivery,
        methodOfAssessment: item.methodOfAssessment,
        resourcesPhysical: item.resourcesPhysical,
        resourceNumber: item.resourceNumber,
        resourceCount: item.resourceCount,
        resourcesHuman: item.resourcesHuman,
        flightOrSimHours: item.flightOrSimHours,
        totalEventHours: item.totalEventHours,
        prerequisites: item.prerequisites,
        prerequisitesGround: item.prerequisitesGround,
        prerequisitesFlying: item.prerequisitesFlying,
        preFlightTime: item.preFlightTime,
        postFlightTime: item.postFlightTime,
        completedAt: item.completedAt,
        isComplete: item.isComplete,
        completed: item.completed,
        isRemedial: item.isRemedial,
        lmpSource: item.lmpSource,
        orderKey: item.orderKey,
        placementNeedsReview: item.placementNeedsReview,
        anchorAfterMasterEventId: item.anchorAfterMasterEventId,
        anchorBeforeMasterEventId: item.anchorBeforeMasterEventId,
        anchorPolicy: item.anchorPolicy,
      });
      const overlayRows = await db.$queryRawUnsafe(
        `SELECT * FROM "TraineeLmpOverlay" WHERE "isActive" = true ORDER BY "orderKey" ASC NULLS LAST, "createdAt" ASC`
      );
      const overlaysByTraineeId = new Map();
      (overlayRows || []).forEach(row => {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        const overlay = {
          ...payload,
          id: payload.id || row.overlayId,
          code: payload.code || row.overlayId,
          lmpSource: payload.lmpSource || row.overlayType || 'remedial',
          anchorAfterMasterEventId: payload.anchorAfterMasterEventId || row.anchorAfterMasterEventId || undefined,
          anchorBeforeMasterEventId: payload.anchorBeforeMasterEventId || row.anchorBeforeMasterEventId || undefined,
          anchorPolicy: payload.anchorPolicy || row.anchorPolicy || 'between',
          orderKey: payload.orderKey || row.orderKey || undefined,
        };
        if (!overlaysByTraineeId.has(row.traineeId)) overlaysByTraineeId.set(row.traineeId, []);
        overlaysByTraineeId.get(row.traineeId).push(overlay);
      });

      const composedLmps = lmps.map(lmp => {
        const masterSyllabus = getMasterSyllabus(lmp.lmpType);
        const overlayEvents = overlaysByTraineeId.get(lmp.traineeId) || [];
        const events = composeIndividualLmpEvents(
          [],
          masterSyllabus,
          overlayEvents,
          lmp.completedEventIds || []
        ).map(compactLmpEventForBuild);
        return {
          ...lmp,
          events,
          overlayCount: overlayEvents.length,
          composedFromMaster: masterSyllabus.length > 0,
        };
      });

      return res.json({ lmps: composedLmps, count: composedLmps.length, buildPayload: true });
    }

    const composedLmps = [];
    for (const lmp of lmps) {
      const masterSyllabus = await loadMasterSyllabusForLmpType(db, lmp.lmpType);
      const overlayEvents = await loadTraineeLmpOverlays(db, lmp.traineeId);
      composedLmps.push({
        ...lmp,
        events: composeIndividualLmpEvents(
          Array.isArray(lmp.events) ? lmp.events : [],
          masterSyllabus,
          overlayEvents,
          lmp.completedEventIds || []
        ),
        overlayCount: overlayEvents.length,
        composedFromMaster: masterSyllabus.length > 0,
      });
    }

    res.json({ lmps: composedLmps, count: composedLmps.length });
  } catch (error) {
    console.error('❌ GET /api/trainees/lmp-sync error:', error);
    res.status(500).json({ error: 'Failed to fetch LMP completions', details: error.message });
  }
});

const getLmpMasterEventId = (item) => item?.masterEventId || item?.id || item?.code || '';
const createLmpOrderKeyForSync = (index) => String(index + 1).padStart(5, '0');
const REMEDIAL_EVENT_CODE_REGEX_FOR_SYNC = /-(?:REM-[A-Z]+\d+|RFTD\d+|RRF\d+|RT\d+|RF\d+|FTD\d+|F\d+|T\d+)$/i;
const isRemedialEventCodeForSync = (value) =>
  !!value && REMEDIAL_EVENT_CODE_REGEX_FOR_SYNC.test(String(value));
const isLmpOverlayItemForSync = (item) =>
  item?.lmpSource === 'remedial' ||
  item?.lmpSource === 'custom' ||
  item?.isRemedial === true ||
  item?.id?.includes?.('REM') ||
  isRemedialEventCodeForSync(item?.id) ||
  item?.code?.includes?.('REM') ||
  isRemedialEventCodeForSync(item?.code) ||
  item?.id?.endsWith?.('-CUR') ||
  item?.code?.endsWith?.('-CUR');

const stampMasterLmpItemsForSync = (masterSyllabus) =>
  masterSyllabus.map((item, index) => ({
    ...item,
    masterEventId: getLmpMasterEventId(item),
    lmpSource: 'master',
    orderKey: item.orderKey || createLmpOrderKeyForSync(index),
    placementNeedsReview: false,
  }));

const INDIVIDUAL_LMP_EDITABLE_FIELDS_FOR_SYNC = [
  'code',
  'eventDescription',
  'phase',
  'module',
  'type',
  'sortieType',
  'dayNight',
  'methodOfDelivery',
  'methodOfAssessment',
  'resourcesPhysical',
  'resourceNumber',
  'resourcesHuman',
  'eventDetailsCommon',
  'eventDetailsSortie',
  'flightOrSimHours',
  'totalEventHours',
  'duration',
  'preFlightTime',
  'postFlightTime',
  'prerequisites',
  'prerequisitesGround',
  'prerequisitesFlying',
  'location',
  'twrDiReqd',
  'cctOnly',
  'notes',
];

const getIndividualLmpMasterOverridesForSync = (item) => {
  if (!item) return {};
  return INDIVIDUAL_LMP_EDITABLE_FIELDS_FOR_SYNC.reduce((overrides, field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      overrides[field] = item[field];
    }
    return overrides;
  }, {});
};

const getLmpResourceNumberForSync = (item) => {
  const parsed = Number(item?.resourceNumber ?? item?.resourceCount);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.max(0, Math.round(parsed));

  const physicalResourceCount = Array.isArray(item?.resourcesPhysical)
    ? item.resourcesPhysical.filter(resource => String(resource || '').trim().length > 0).length
    : 0;
  return physicalResourceCount;
};

const alignPhysicalResourcesForSync = (resourcesPhysical, resourceNumber, resourceLabel = 'Aircraft') => {
  const count = Math.max(0, Math.round(Number(resourceNumber) || 0));
  const existing = Array.isArray(resourcesPhysical)
    ? resourcesPhysical.filter(resource => String(resource || '').trim().length > 0)
    : [];
  if (count === 0) return existing;

  const aligned = existing.slice(0, count);
  for (let index = aligned.length; index < count; index++) {
    aligned.push(count === 1 ? resourceLabel : `${resourceLabel} ${index + 1}`);
  }
  return aligned;
};

const normalizeLmpCompletionKeyForSync = (value) => String(value || '').replace(/\*/g, '').trim();
const getLmpCompletionKeysForSync = (item) => [
  item?.id,
  item?.code,
  item?.masterEventId,
].map(normalizeLmpCompletionKeyForSync).filter(Boolean);

const getLmpCompletionTimestampForSync = (item, scoreMap) => {
  const keys = getLmpCompletionKeysForSync(item);
  for (const key of keys) {
    if (scoreMap[key]) return scoreMap[key];
  }
  return null;
};

const getLmpCanonicalCompletionKeyForSync = (item) =>
  normalizeLmpCompletionKeyForSync(item?.code) ||
  normalizeLmpCompletionKeyForSync(item?.masterEventId) ||
  normalizeLmpCompletionKeyForSync(item?.id);

const addDirectLmpPrerequisiteCompletionsForSync = (scoreMap, lmpEvents) => {
  const events = Array.isArray(lmpEvents) ? lmpEvents : [];
  if (events.length === 0) return [];

  const itemByKey = new Map();
  events.forEach(item => {
    getLmpCompletionKeysForSync(item).forEach(key => itemByKey.set(key, item));
  });

  const backfilled = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of events) {
      const completedAt = getLmpCompletionTimestampForSync(item, scoreMap);
      if (!completedAt) continue;

      (item?.prerequisites || []).forEach(prerequisite => {
        const prerequisiteKey = normalizeLmpCompletionKeyForSync(prerequisite);
        if (!prerequisiteKey) return;

        const prerequisiteItem = itemByKey.get(prerequisiteKey);
        const canonicalKey = prerequisiteItem
          ? getLmpCanonicalCompletionKeyForSync(prerequisiteItem)
          : prerequisiteKey;

        if (canonicalKey && !scoreMap[canonicalKey]) {
          scoreMap[canonicalKey] = completedAt;
          backfilled.push(canonicalKey);
          changed = true;
        }
      });
    }
  }

  return backfilled;
};

const addPriorGroundCompletionsForSync = (scoreMap, lmpEvents) => {
  const events = Array.isArray(lmpEvents) ? lmpEvents : [];
  if (events.length === 0) return [];

  let highestCompletedFlyingIndex = -1;
  events.forEach((item, index) => {
    const isFlyingOrSim = item?.type === 'Flight' || item?.type === 'FTD';
    if (isFlyingOrSim && getLmpCompletionTimestampForSync(item, scoreMap)) {
      highestCompletedFlyingIndex = Math.max(highestCompletedFlyingIndex, index);
    }
  });

  if (highestCompletedFlyingIndex <= 0) return [];

  const completedAt = new Date().toISOString();
  const backfilled = [];
  for (let i = 0; i < highestCompletedFlyingIndex; i++) {
    const item = events[i];
    if (item?.type !== 'Ground School') continue;

    const canonicalKey = getLmpCanonicalCompletionKeyForSync(item);
    if (canonicalKey && !getLmpCompletionTimestampForSync(item, scoreMap)) {
      scoreMap[canonicalKey] = completedAt;
      backfilled.push(canonicalKey);
    }
  }

  return backfilled;
};

const mergeIndividualLmpWithMasterForSync = (existingEvents, masterSyllabus, scoreMap) => {
  const stampedMaster = stampMasterLmpItemsForSync(masterSyllabus);
  if (!existingEvents || existingEvents.length === 0) {
    return stampedMaster.map(item => {
      const completedAt = getLmpCompletionTimestampForSync(item, scoreMap);
      return {
        ...item,
        completedAt,
        isComplete: Boolean(completedAt),
        completed: Boolean(completedAt),
      };
    });
  }

  const masterIds = new Set(stampedMaster.map(getLmpMasterEventId).filter(Boolean));
  const existingByMasterId = new Map();
  existingEvents.forEach(item => {
    if (isLmpOverlayItemForSync(item)) return;
    const masterId = getLmpMasterEventId(item);
    if (masterId) existingByMasterId.set(masterId, item);
  });

  const mergedMaster = stampedMaster.map((masterItem, index) => {
    const existingItem = existingByMasterId.get(getLmpMasterEventId(masterItem));
    const completedAt = getLmpCompletionTimestampForSync(masterItem, scoreMap);
    return {
      ...masterItem,
      ...getIndividualLmpMasterOverridesForSync(existingItem),
      id: masterItem.id,
      masterEventId: getLmpMasterEventId(masterItem),
      lmpSource: 'master',
      completedAt,
      isComplete: Boolean(completedAt),
      completed: Boolean(completedAt),
      userLockedPosition: existingItem?.userLockedPosition,
      orderKey: existingItem?.orderKey || masterItem.orderKey || createLmpOrderKeyForSync(index),
      placementNeedsReview: false,
    };
  });

  const masterIndexById = new Map();
  mergedMaster.forEach((item, index) => {
    const masterId = getLmpMasterEventId(item);
    if (masterId) masterIndexById.set(masterId, index);
  });

  const overlays = existingEvents.filter(isLmpOverlayItemForSync).map((item, index) => {
    const itemIndex = existingEvents.indexOf(item);
    const fallbackAfter = item.anchorAfterMasterEventId || getLmpMasterEventId(existingEvents.slice(0, itemIndex).reverse().find(prev => !isLmpOverlayItemForSync(prev)) || {});
    const fallbackBefore = item.anchorBeforeMasterEventId || getLmpMasterEventId(existingEvents.slice(itemIndex + 1).find(next => !isLmpOverlayItemForSync(next)) || {});
    const afterExists = !!fallbackAfter && masterIds.has(fallbackAfter);
    const beforeExists = !!fallbackBefore && masterIds.has(fallbackBefore);

    return {
      ...item,
      lmpSource: item.lmpSource || (item.isRemedial ? 'remedial' : 'custom'),
      orderKey: item.orderKey || `${createLmpOrderKeyForSync(index)}.500`,
      anchorAfterMasterEventId: fallbackAfter || undefined,
      anchorBeforeMasterEventId: fallbackBefore || undefined,
      anchorPolicy: item.anchorPolicy || 'between',
      placementNeedsReview: !(afterExists || beforeExists),
    };
  });

  const overlaysBefore = new Map();
  const overlaysAfter = new Map();
  const appendOverlays = [];

  overlays.forEach(overlay => {
    const policy = overlay.anchorPolicy || 'between';
    const beforeId = overlay.anchorBeforeMasterEventId;
    const afterId = overlay.anchorAfterMasterEventId;

    if ((policy === 'between' || policy === 'before') && beforeId && masterIndexById.has(beforeId)) {
      const list = overlaysBefore.get(beforeId) || [];
      list.push(overlay);
      overlaysBefore.set(beforeId, list);
      return;
    }

    if (afterId && masterIndexById.has(afterId)) {
      const list = overlaysAfter.get(afterId) || [];
      list.push(overlay);
      overlaysAfter.set(afterId, list);
      return;
    }

    appendOverlays.push({ ...overlay, placementNeedsReview: true });
  });

  const result = [];
  mergedMaster.forEach(masterItem => {
    const masterId = getLmpMasterEventId(masterItem);
    result.push(...(masterId ? overlaysBefore.get(masterId) || [] : []).sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || '')));
    result.push(masterItem);
    result.push(...(masterId ? overlaysAfter.get(masterId) || [] : []).sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || '')));
  });

  return [...result, ...appendOverlays.sort((a, b) => (a.orderKey || '').localeCompare(b.orderKey || ''))];
};

// POST /api/trainees/lmp-sync - Sync all trainees' authoritative PT-051 records → IndividualLMP
// Body: { syllabusData?: Record<lmpType, SyllabusItemDetail[]> }
// syllabusData is OPTIONAL - server loads syllabus directly from DB for accurate backfill.
// Client-provided syllabusData is used as a fallback only if DB syllabus is empty.
app.post('/api/trainees/lmp-sync', async (req, res) => {
  try {
    const db = await getPrisma();
    const { syllabusData: clientSyllabusData } = req.body;

    // --- ALWAYS load syllabus from DB so the server has authoritative data ---
    // The client may send mockData syllabus (missing FIC GND1/2/3) which would
    // break the prerequisite backfill. By loading from DB here, we ensure the
    // full syllabus (including any ground school prerequisites) is available.
    let dbSyllabusData = {};
    try {
      const allItems = await db.$queryRawUnsafe(
        `SELECT * FROM "SyllabusItem" WHERE "isActive" = true ORDER BY "sortOrder" ASC`
      );
      if (allItems && allItems.length > 0) {
        // courses is stored as JSON array in DB; parse if needed
        const parsed = allItems.map(item => ({
          ...item,
          courses: Array.isArray(item.courses) ? item.courses :
            (typeof item.courses === 'string' ? JSON.parse(item.courses) : []),
        }));
        const ficItems = parsed.filter(item => item.courses.includes('FIC'));
        const bpcIpcItems = parsed.filter(item => !item.courses.includes('FIC'));
        dbSyllabusData = {
          'FIC': ficItems,
          'BPC+IPC': bpcIpcItems,
        };
        console.log(`[LMP Sync] Loaded syllabus from DB: ${ficItems.length} FIC items, ${bpcIpcItems.length} BPC+IPC items`);
      }
    } catch (syllabusErr) {
      console.warn('[LMP Sync] Could not load syllabus from DB, falling back to client syllabusData:', syllabusErr.message);
    }

    // Use DB syllabus if available; fall back to client-provided syllabusData
    const syllabusData = (Object.keys(dbSyllabusData).length > 0) ? dbSyllabusData : (clientSyllabusData || {});

    if (!syllabusData || Object.keys(syllabusData).length === 0) {
      return res.status(400).json({ error: 'Missing syllabusData: not in request body and DB syllabus is empty' });
    }

    // Fetch all active trainees with their existing LMP. PT-051 progress is
    // sourced exclusively from TraineePerformance below; legacy Score rows and
    // snapshot PT-051 payloads can contain imported/stale completions and must
    // not drive LMP progression.
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      include: {
        individualLMP: true,
      },
    });

    console.log(`[LMP Sync] Processing ${trainees.length} trainees...`);

    const traineePerformanceRows = await db.$queryRawUnsafe(`
      SELECT "traineeId", "traineeFullName", "flightNumber", "eventCode", "date", "updatedAt", "overallGrade", "overallResult", "dcoResult"
      FROM "TraineePerformance"
      WHERE "isCompleted" = true OR UPPER(COALESCE("dcoResult", '')) = 'DCO'
      ORDER BY "date" ASC, "updatedAt" ASC
    `);
    const performanceByTraineeId = new Map();
    (traineePerformanceRows || []).forEach(row => {
      if (!row.traineeId) return;
      if (!performanceByTraineeId.has(row.traineeId)) performanceByTraineeId.set(row.traineeId, []);
      performanceByTraineeId.get(row.traineeId).push(row);
    });

    const results = [];

    for (const trainee of trainees) {
      // Determine LMP type
      let lmpType = trainee.lmpType || 'BPC+IPC';
      if (lmpType === 'BPC+IPC' && trainee.course) {
        if (trainee.course.toUpperCase().startsWith('FIC')) {
          lmpType = 'FIC';
        }
      }

      // Get master syllabus for this LMP type
      let masterSyllabus = syllabusData[lmpType];
      if (!masterSyllabus || masterSyllabus.length === 0) {
        masterSyllabus = syllabusData['BPC+IPC'] || [];
      }
      if (!masterSyllabus || masterSyllabus.length === 0) {
        results.push({
          traineeFullName: trainee.fullName,
          lmpType,
          totalEvents: 0,
          completedCount: 0,
          newlyMarked: [],
          status: 'no_syllabus',
        });
        continue;
      }

      // Build set of completed event IDs from the authoritative PT-051 table.
      // Do not merge legacy Score rows: they are retained for compatibility
      // views, but using them here can falsely complete an entire LMP.
      const scoreMap = {};
      const performanceRows = performanceByTraineeId.get(trainee.id) || [];
      performanceRows.forEach(row => {
        if (row.traineeFullName !== trainee.fullName) return;
        const normalizedEvent = String(row.flightNumber || row.eventCode || '').replace('*', '');
        if (normalizedEvent) {
          scoreMap[normalizedEvent] = row.date ? new Date(row.date).toISOString() : new Date().toISOString();
        }
      });

      let completedEventIds = Object.keys(scoreMap);

      // Backfill only direct prerequisites. Never mark earlier events complete
      // from sequence position alone; that made NEO Build think many trainees
      // had completed the whole LMP.
      {
        const groundBackfilled = lmpType === 'FIC'
          ? addPriorGroundCompletionsForSync(scoreMap, masterSyllabus)
          : [];
        const prereqBackfilled = addDirectLmpPrerequisiteCompletionsForSync(scoreMap, masterSyllabus);
        const backfilled = [...groundBackfilled, ...prereqBackfilled];
        if (backfilled.length > 0) {
          console.log(`[LMP Sync] ${trainee.fullName}: Backfilled ${backfilled.length} safe derived completion(s): ${backfilled.join(', ')}`);
        }
        completedEventIds = Object.keys(scoreMap);
      }

      // Check what was previously marked
      const existing = trainee.individualLMP;
      const existingEvents = Array.isArray(existing?.events) ? existing.events : [];
      const overlayEvents = existing ? await loadTraineeLmpOverlays(db, trainee.id) : [];
      const existingMasterEvents = existingEvents.filter(item => !isLmpOverlayItemForSync(item));
      const lmpEvents = mergeIndividualLmpWithMasterForSync([...existingMasterEvents, ...overlayEvents], masterSyllabus, scoreMap);
      await upsertTraineeLmpOverlays(db, trainee.id, trainee.fullName, lmpEvents, { deactivateMissing: false });
      const existingCompleted = existing ? (existing.completedEventIds || []) : [];
      const newlyMarked = completedEventIds.filter(id => !existingCompleted.includes(id));

      // Upsert the IndividualLMP
      await db.individualLMP.upsert({
        where: { traineeId: trainee.id },
        update: {
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
          updatedAt: new Date(),
        },
        create: {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
        },
      });

      const status = !existing ? 'created' : newlyMarked.length > 0 ? 'updated' : 'unchanged';
      results.push({
        traineeFullName: trainee.fullName,
        lmpType,
        totalEvents: masterSyllabus.length,
        completedCount: completedEventIds.length,
        newlyMarked,
        status,
      });

      console.log(
        `[LMP Sync] ${trainee.fullName} (${lmpType}): ${completedEventIds.length}/${masterSyllabus.length} events complete` +
        (newlyMarked.length > 0 ? ` — newly marked: ${newlyMarked.join(', ')}` : '')
      );
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const noSyllabus = results.filter(r => r.status === 'no_syllabus').length;

    console.log(`[LMP Sync] ✅ Done — ${created} created, ${updated} updated, ${unchanged} unchanged, ${noSyllabus} skipped`);

    res.json({
      success: true,
      summary: { created, updated, unchanged, noSyllabus, total: trainees.length },
      results,
    });
  } catch (error) {
    console.error('❌ POST /api/trainees/lmp-sync error:', error);
    res.status(500).json({ error: 'Failed to sync LMPs', details: error.message });
  }
});

// GET /api/trainees/:id/lmp - Get IndividualLMP for a specific trainee
app.get('/api/trainees/:id/lmp', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    // Try by traineeId first, then by traineeFullName
    const lmp = await db.individualLMP.findFirst({
      where: {
        OR: [
          { traineeId: id },
          { traineeFullName: decodeURIComponent(id) },
        ],
      },
    });

    if (!lmp) {
      return res.json({ lmp: null });
    }

    const masterSyllabus = await loadMasterSyllabusForLmpType(db, lmp.lmpType);
    const overlayEvents = await loadTraineeLmpOverlays(db, lmp.traineeId);
    const composedEvents = composeIndividualLmpEvents(
      Array.isArray(lmp.events) ? lmp.events : [],
      masterSyllabus,
      overlayEvents,
      lmp.completedEventIds || []
    );

    res.json({
      lmp: {
        ...lmp,
        events: composedEvents,
        overlayCount: overlayEvents.length,
        composedFromMaster: masterSyllabus.length > 0,
      }
    });
  } catch (error) {
    console.error('❌ GET /api/trainees/:id/lmp error:', error);
    res.status(500).json({ error: 'Failed to fetch LMP', details: error.message });
  }
});

// PUT /api/trainees/:id/lmp - Upsert IndividualLMP for a specific trainee
app.put('/api/trainees/:id/lmp', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const { traineeFullName, lmpType, events, completedEventIds } = req.body;

    if (!traineeFullName || !lmpType || !events) {
      return res.status(400).json({ error: 'Missing required fields: traineeFullName, lmpType, events' });
    }

    const decodedId = decodeURIComponent(id);
    const trainee = await db.trainee.findFirst({
      where: {
        OR: [
          { id },
          { fullName: traineeFullName },
          { fullName: decodedId },
        ],
      },
    });

    if (!trainee) {
      return res.status(404).json({ error: `Trainee not found for LMP save: ${traineeFullName}` });
    }

    const resolvedTraineeId = trainee.id;
    await upsertTraineeLmpOverlays(db, resolvedTraineeId, traineeFullName, events, { deactivateMissing: true });

    const masterSyllabus = await loadMasterSyllabusForLmpType(db, lmpType);
    const overlayEvents = await loadTraineeLmpOverlays(db, resolvedTraineeId);
    const composedEvents = composeIndividualLmpEvents(events, masterSyllabus, overlayEvents, completedEventIds || []);

    const lmp = await db.individualLMP.upsert({
      where: { traineeId: resolvedTraineeId },
      update: {
        traineeFullName,
        lmpType,
        events: composedEvents,
        completedEventIds: completedEventIds || [],
        updatedAt: new Date(),
      },
      create: {
        traineeId: resolvedTraineeId,
        traineeFullName,
        lmpType,
        events: composedEvents,
        completedEventIds: completedEventIds || [],
      },
    });

    console.log(`✅ PUT /api/trainees/${resolvedTraineeId}/lmp - ${traineeFullName}: ${(completedEventIds || []).length} events complete, ${overlayEvents.length} overlay(s)`);
    res.json({ success: true, lmp });
  } catch (error) {
    console.error('❌ PUT /api/trainees/:id/lmp error:', error);
    res.status(500).json({ error: 'Failed to save LMP', details: error.message });
  }
});

// POST /api/trainees - Create a new trainee record
app.post('/api/trainees', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
      idNumber, name, fullName, rank, course, lmpType,
      unit, flight, location, service, seatConfig, isPaused,
      traineeCallsign, primaryInstructor, secondaryInstructor,
      phoneNumber, email, permissions, unavailability
    } = req.body;

    if (!idNumber || !name) {
      return res.status(400).json({ error: 'idNumber and name are required' });
    }

    // Check if trainee with this idNumber already exists
    const existing = await db.trainee.findFirst({ where: { idNumber: Number(idNumber) } });
    if (existing) {
      // Update existing record instead
      const updated = await db.trainee.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          fullName: fullName || name,
          rank: rank || existing.rank,
          course: course || existing.course,
          lmpType: lmpType || existing.lmpType,
          unit: unit !== undefined ? unit : existing.unit,
          flight: flight !== undefined ? flight : existing.flight,
          location: location !== undefined ? location : existing.location,
          service: service || existing.service,
          seatConfig: seatConfig || existing.seatConfig,
          isPaused: isPaused !== undefined ? isPaused : existing.isPaused,
          traineeCallsign: traineeCallsign !== undefined ? traineeCallsign : existing.traineeCallsign,
          primaryInstructor: Array.isArray(primaryInstructor) ? primaryInstructor : (primaryInstructor ? [primaryInstructor] : existing.primaryInstructor),
          secondaryInstructor: Array.isArray(secondaryInstructor) ? secondaryInstructor : (secondaryInstructor ? [secondaryInstructor] : existing.secondaryInstructor),
          phoneNumber: phoneNumber !== undefined ? phoneNumber : existing.phoneNumber,
          email: email !== undefined ? email : existing.email,
          permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : existing.permissions),
          unavailability: unavailability || existing.unavailability,
          isActive: true,
        }
      });
      console.log(`✅ POST /api/trainees - updated existing: ${updated.name} (${updated.idNumber})`);
      await ensureInitialIndividualLmpForTrainee(db, updated);
      return res.json({ success: true, trainee: updated, action: 'updated' });
    }

    // Create new trainee
    const created = await db.trainee.create({
      data: {
        idNumber: Number(idNumber),
        name,
        fullName: fullName || name,
        rank: rank || 'FLGOFF',
        course: course || '',
        lmpType: lmpType || '',
        unit: unit || '',
        flight: flight || '',
        location: location || '',
        service: service || null,
        seatConfig: seatConfig || 'Front',
        isPaused: isPaused || false,
        traineeCallsign: traineeCallsign || null,
        primaryInstructor: Array.isArray(primaryInstructor) ? primaryInstructor : (primaryInstructor ? [primaryInstructor] : []),
        secondaryInstructor: Array.isArray(secondaryInstructor) ? secondaryInstructor : (secondaryInstructor ? [secondaryInstructor] : []),
        phoneNumber: phoneNumber || null,
        email: email || null,
        permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []),
        unavailability: unavailability || [],
        isActive: true,
      }
    });

    console.log(`✅ POST /api/trainees - created: ${created.name} (${created.idNumber})`);
    await ensureInitialIndividualLmpForTrainee(db, created);
    res.status(201).json({ success: true, trainee: created, action: 'created' });
  } catch (error) {
    console.error('❌ POST /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to create trainee', details: error.message });
  }
});

// POST /api/trainees/bulk - Bulk create or update trainees
app.post('/api/trainees/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { trainees, course, replaceAll } = req.body;

    console.log(`🔵 POST /api/trainees/bulk - received request body keys: ${Object.keys(req.body).join(', ')}`);
    console.log(`🔵 POST /api/trainees/bulk - trainees type: ${typeof trainees}, isArray: ${Array.isArray(trainees)}, length: ${Array.isArray(trainees) ? trainees.length : 'N/A'}`);
    console.log(`🔵 POST /api/trainees/bulk - course: ${course}, replaceAll: ${replaceAll}`);
    if (Array.isArray(trainees) && trainees.length > 0) {
      console.log(`🔵 POST /api/trainees/bulk - first trainee sample: ${JSON.stringify(trainees[0])}`);
    }

    if (!Array.isArray(trainees) || trainees.length === 0) {
      console.error(`❌ POST /api/trainees/bulk - invalid trainees array`);
      return res.status(400).json({ error: 'trainees array is required and must not be empty' });
    }

    console.log(`🔵 POST /api/trainees/bulk - processing ${trainees.length} trainees, course: ${course || 'all'}, replaceAll: ${replaceAll}`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const results = [];

    // If replaceAll and course is specified, mark all existing trainees in that course as inactive first
    if (replaceAll && course) {
      await db.trainee.updateMany({
        where: { course, isActive: true },
        data: { isActive: false }
      });
      console.log(`🔵 Marked all existing ${course} trainees as inactive for replacement`);
    }

    for (const t of trainees) {
      try {
        if (!t.idNumber || !t.name) {
          skippedCount++;
          continue;
        }

        const idNum = Number(t.idNumber);
        if (isNaN(idNum) || idNum <= 0) {
          skippedCount++;
          continue;
        }

        // Look for existing trainee by idNumber in this course (or any course if no course filter)
        const whereClause = course 
          ? { idNumber: idNum }
          : { idNumber: idNum };
        
        const existing = await db.trainee.findFirst({ where: whereClause });

        const traineeData = {
          name: t.name,
          fullName: t.fullName || t.name,
          rank: t.rank || 'FLGOFF',
          course: t.course || course || '',
          lmpType: t.lmpType || '',
          unit: t.unit || '',
          flight: t.flight || '',
          location: t.location || '',
          service: t.service || null,
          seatConfig: t.seatConfig || 'Front',
          isPaused: t.isPaused || false,
          traineeCallsign: t.traineeCallsign !== undefined ? String(t.traineeCallsign) : null,
          primaryInstructor: Array.isArray(t.primaryInstructor) ? t.primaryInstructor : (t.primaryInstructor ? [t.primaryInstructor] : []),
          secondaryInstructor: Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : (t.secondaryInstructor ? [t.secondaryInstructor] : []),
          phoneNumber: t.phoneNumber || null,
          email: t.email || null,
          permissions: Array.isArray(t.permissions) ? t.permissions : (t.permissions ? [t.permissions] : []),
          unavailability: t.unavailability || [],
          isActive: true,
        };

        if (existing) {
          const updated = await db.trainee.update({
            where: { id: existing.id },
            data: traineeData
          });
          await ensureInitialIndividualLmpForTrainee(db, updated);
          updatedCount++;
          results.push({ idNumber: idNum, name: t.name, action: 'updated' });
        } else {
          const created = await db.trainee.create({
            data: { idNumber: idNum, ...traineeData }
          });
          await ensureInitialIndividualLmpForTrainee(db, created);
          createdCount++;
          results.push({ idNumber: idNum, name: t.name, action: 'created', id: created.id });
        }
      } catch (rowError) {
        console.error(`❌ Error processing trainee ${t.idNumber} - ${t.name}:`, rowError.message);
        skippedCount++;
        results.push({ idNumber: t.idNumber, name: t.name, action: 'error', error: rowError.message });
      }
    }

    console.log(`✅ POST /api/trainees/bulk complete - created: ${createdCount}, updated: ${updatedCount}, skipped: ${skippedCount}`);
    res.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: trainees.length,
      results
    });
  } catch (error) {
    console.error('❌ POST /api/trainees/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk update trainees', details: error.message });
  }
});

// PATCH /api/trainees/:id - Update a trainee record
app.patch('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Trainee ID is required' });
    }

    // Check if the trainee exists
    const existing = await db.trainee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Trainee not found' });
    }

    // Sanitize: only include fields that exist in the Trainee schema
    // Strip client-side fields like _dataSource, id (managed by DB), scores, etc.
    const TRAINEE_FIELDS = [
      'name', 'fullName', 'rank', 'service', 'course', 'lmpType', 'traineeCallsign',
      'seatConfig', 'isPaused', 'unavailability', 'unit', 'flight', 'location',
      'phoneNumber', 'email', 'primaryInstructor', 'secondaryInstructor',
      'lastEventDate', 'lastFlightDate', 'currencyStatus', 'permissions',
      'priorExperience', 'isActive', 'userId'
    ];
    const sanitizedUpdates = {};
    for (const field of TRAINEE_FIELDS) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // Update the trainee record
    const updated = await db.trainee.update({
      where: { id },
      data: sanitizedUpdates
    });

    console.log(`✅ PATCH /api/trainees/${id} - updated: ${updated.name}`);
    res.json({ success: true, trainee: updated });
  } catch (error) {
    console.error('❌ PATCH /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to update trainee', details: error.message });
  }
});

// GET /api/aircraft
app.get('/api/aircraft', async (req, res) => {
  try {
    const db = await getPrisma();
    const { type, status } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const aircraft = await db.aircraft.findMany({
      where,
      orderBy: { aircraftNumber: 'asc' },
    });

    console.log(`✅ GET /api/aircraft - returning ${aircraft.length} records`);
    res.json({ aircraft });
  } catch (error) {
    console.error('❌ GET /api/aircraft error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft', details: error.message });
  }
});

// GET /api/scores
app.get('/api/scores', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId, traineeFullName } = req.query;

    const where = {};
    const scopedTraineeWhere = await buildScopedEntityWhere(req, db);
    if (traineeId) {
      where.traineeId = traineeId;
    } else if (traineeFullName) {
      const trainee = await db.trainee.findFirst({ where: mergeScopedWhere({ fullName: traineeFullName }, scopedTraineeWhere) });
      if (trainee) {
        where.traineeId = trainee.id;
      } else {
        return res.json({ scores: [], count: 0 });
      }
    } else if (scopedTraineeWhere.AND?.length) {
      where.trainee = { is: scopedTraineeWhere };
    }

    const scores = await db.score.findMany({
      where,
      include: {
        trainee: { select: { id: true, fullName: true, course: true, location: true, unit: true } }
      },
      orderBy: [{ trainee: { fullName: 'asc' } }, { date: 'asc' }]
    });

    const scoresByTrainee = new Map();
    scores.forEach(score => {
      const fullName = score.trainee.fullName;
      if (!scoresByTrainee.has(fullName)) scoresByTrainee.set(fullName, []);
      scoresByTrainee.get(fullName).push({
        event: score.event,
        score: score.score,
        date: score.date.toISOString().split('T')[0]
      });
    });

    res.json({ scores: Array.from(scoresByTrainee.entries()), count: scores.length });
  } catch (error) {
    console.error('❌ GET /api/scores error:', error);
    res.status(500).json({ error: 'Failed to fetch scores', details: error.message });
  }
});

// POST /api/scores - create/upsert a single score record
app.post('/api/scores', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId, traineeFullName, event, score, date, instructor, notes, details } = req.body;

    let resolvedTraineeId = traineeId;
    if (!resolvedTraineeId && traineeFullName) {
      const trainee = await db.trainee.findFirst({ where: { fullName: traineeFullName } });
      if (!trainee) return res.status(404).json({ error: `Trainee not found: ${traineeFullName}` });
      resolvedTraineeId = trainee.id;
    }
    if (!resolvedTraineeId) return res.status(400).json({ error: 'traineeId or traineeFullName required' });
    if (!event) return res.status(400).json({ error: 'event is required' });

    // Upsert: update if exists, create if not
    const existing = await db.score.findFirst({ where: { traineeId: resolvedTraineeId, event } });
    let scoreRecord;
    if (existing) {
      scoreRecord = await db.score.update({
        where: { id: existing.id },
        data: {
          score: score !== undefined ? parseInt(score) : existing.score,
          date: date ? new Date(date) : existing.date,
          instructor: instructor || existing.instructor,
          notes: notes || existing.notes,
          details: details !== undefined ? details : existing.details,
        },
      });
    } else {
      scoreRecord = await db.score.create({
        data: {
          traineeId: resolvedTraineeId,
          event,
          score: score !== undefined ? parseInt(score) : 3,
          date: date ? new Date(date) : new Date(),
          instructor: instructor || 'DCO',
          notes: notes || '',
          details: details || null,
        },
      });
    }

    // Also update IndividualLMP completedEventIds to include this event + backfill prerequisites
    try {
      const lmp = await db.individualLMP.findFirst({ where: { traineeId: resolvedTraineeId } });
      if (lmp) {
        const existing_ids = lmp.completedEventIds || [];
        const updatedSet = new Set(existing_ids);
        updatedSet.add(event);

        // --- PREREQUISITE BACKFILL (real-time) ---
        const lmpEvents = Array.isArray(lmp.events) ? lmp.events : [];
        if (lmpEvents.length > 0) {
          const scoreMap = {};
          updatedSet.forEach(id => {
            const normalized = normalizeLmpCompletionKeyForSync(id);
            if (normalized) scoreMap[normalized] = new Date().toISOString();
          });
          const prereqBackfilled = addDirectLmpPrerequisiteCompletionsForSync(scoreMap, lmpEvents);
          const backfilled = [...prereqBackfilled];
          backfilled.forEach(id => updatedSet.add(id));
          if (backfilled.length > 0) {
            console.log(`[POST /api/scores] ${resolvedTraineeId}: Backfilled safe derived completions: ${backfilled.join(', ')}`);
          }
        }
        // --- END BACKFILL ---

        const updated_ids = [...updatedSet];
        if (updated_ids.length !== existing_ids.length || !existing_ids.includes(event)) {
          await db.individualLMP.update({
            where: { id: lmp.id },
            data: { completedEventIds: updated_ids, updatedAt: new Date() },
          });
          console.log(`[POST /api/scores] Updated IndividualLMP for trainee ${resolvedTraineeId}: added ${event} (total: ${updated_ids.length})`);
        }
      }
    } catch (lmpErr) {
      console.warn(`[POST /api/scores] Could not update IndividualLMP:`, lmpErr.message);
    }

    res.json({ success: true, score: scoreRecord });
  } catch (error) {
    console.error('❌ POST /api/scores error:', error);
    res.status(500).json({ error: 'Failed to create score', details: error.message });
  }
});

// GET /api/schedule
app.get('/api/schedule', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, startDate, endDate } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const schedules = await db.schedule.findMany({
      where,
      include: {
        user: { select: { userId: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { date: 'asc' },
    });

    res.json({ schedules });
  } catch (error) {
    console.error('❌ GET /api/schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
});

// POST /api/schedule
app.post('/api/schedule', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, date, data } = req.body;

    if (!userId || !date || !data) {
      return res.status(400).json({ error: 'userId, date, and data are required' });
    }

    const existingSchedule = await db.schedule.findFirst({ where: { userId, date } });

    let schedule;
    if (existingSchedule) {
      schedule = await db.schedule.update({
        where: { id: existingSchedule.id },
        data: { data, updatedAt: new Date() },
      });
    } else {
      schedule = await db.schedule.create({ data: { userId, date, data } });
    }

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('❌ POST /api/schedule error:', error);
    res.status(500).json({ error: 'Failed to save schedule', details: error.message });
  }
});

// Health check
// GET /api/users-with-personnel - Check user-personnel linking status
app.get('/api/users-with-personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { search } = req.query;
    
    // Build where clause for user search
    const userWhere = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get all users with their linked personnel
    const users = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        userId: true,
        personnel: {
          select: {
            id: true,
            name: true,
            idNumber: true,
            rank: true,
            role: true,
            unit: true,
            flight: true
          }
        }
      },
      orderBy: { username: 'asc' }
    });
    
    // Get all personnel records (to see which have users linked)
    const personnelWhere = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } }
      ]
    } : {};
    
    const allPersonnel = await db.personnel.findMany({
      where: personnelWhere,
      select: {
        id: true,
        name: true,
        idNumber: true,
        rank: true,
        role: true,
        unit: true,
        flight: true,
        userId: true
      },
      orderBy: { name: 'asc' }
    });
    
    // Personnel not linked to any user
    const unlinkedPersonnel = allPersonnel.filter(p => !p.userId);
    
    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        userId: u.userId,
        linkedPersonnel: u.personnel ? {
          id: u.personnel.id,
          name: u.personnel.name,
          idNumber: u.personnel.idNumber,
          rank: u.personnel.rank,
          role: u.personnel.role,
          unit: u.personnel.unit,
          flight: u.personnel.flight
        } : null
      })),
      unlinkedPersonnel: unlinkedPersonnel.map(p => ({
        id: p.id,
        name: p.name,
        idNumber: p.idNumber,
        rank: p.rank,
        role: p.role,
        unit: p.unit,
        flight: p.flight
      })),
      summary: {
        totalUsers: users.length,
        usersWithPersonnel: users.filter(u => u.personnel).length,
        usersWithoutPersonnel: users.filter(u => !u.personnel).length,
        totalPersonnel: allPersonnel.length,
        unlinkedPersonnelCount: unlinkedPersonnel.length
      }
    });
  } catch (error) {
    console.error('Error fetching users with personnel:', error);
    res.status(500).json({ error: 'Failed to fetch users with personnel', details: error.message });
  }
});

// POST /api/cleanup-duplicate-personnel - Remove specific duplicate personnel records
// This endpoint safely deletes only the confirmed duplicate Burns records
app.post('/api/cleanup-duplicate-personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { confirmToken } = req.body;

    // Safety check - require a confirmation token
    if (confirmToken !== 'CONFIRM_DELETE_BURNS_DUPLICATES') {
      return res.status(400).json({ error: 'Invalid confirmation token. Send { confirmToken: "CONFIRM_DELETE_BURNS_DUPLICATES" }' });
    }

    // These are the confirmed duplicate Personnel IDs to delete
    // Keeping: cmkivhycv0001k30fbih64ptl (FLTLT, linked to active user cmkdynoqv0000o30fwtqqwkzw)
    const personnelToDelete = [
      'cmkdj92gx0001p10ffa85av90',  // FLTLT, no user
      'cmkdj9co60003p10flx1glphw',  // SQNLDR, no user
      'cmkdhs9cv0003pn0frh9ql1yj',  // FLTLT, no user
      'cmkdhghjs0001pn0fwek3zkx2',  // SQNLDR, no user
      'cmkdkjq610001mq0f5v72mj56',  // SQNLDR, linked to duplicate user cmk3m3d8w0000kymjmsdlxsy9
    ];

    // The duplicate User account linked to the SQNLDR personnel record
    const duplicateUserId = 'cmk3m3d8w0000kymjmsdlxsy9';

    const results = [];

    // First unlink the SQNLDR personnel from the duplicate user account
    await db.personnel.update({
      where: { id: 'cmkdkjq610001mq0f5v72mj56' },
      data: { userId: null }
    });
    results.push('Unlinked SQNLDR personnel from duplicate user account');

    // Delete all duplicate personnel records
    for (const id of personnelToDelete) {
      try {
        await db.personnel.delete({ where: { id } });
        results.push(`Deleted personnel: ${id}`);
      } catch (e) {
        results.push(`Failed to delete personnel ${id}: ${e.message}`);
      }
    }

    // Delete the duplicate user account
    try {
      await db.user.delete({ where: { id: duplicateUserId } });
      results.push(`Deleted duplicate user account: ${duplicateUserId}`);
    } catch (e) {
      results.push(`Failed to delete duplicate user ${duplicateUserId}: ${e.message}`);
    }

    // Verify the cleanup
    const remaining = await db.personnel.findMany({
      where: { name: { contains: 'Burns', mode: 'insensitive' } },
      select: { id: true, name: true, rank: true, userId: true }
    });
    const remainingUsers = await db.user.findMany({
      where: { OR: [
        { firstName: { contains: 'Burns', mode: 'insensitive' } },
        { lastName: { contains: 'Burns', mode: 'insensitive' } },
        { username: { contains: 'burns', mode: 'insensitive' } }
      ]},
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });

    res.json({ success: true, actions: results, remainingPersonnel: remaining, remainingUsers: remainingUsers });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

// POST /api/merge-burns-accounts - Consolidate Burns user accounts
// Links Personnel to alexander.burns, deletes 8201112 user, sets role to INSTRUCTOR + ADMIN
app.post('/api/merge-burns-accounts', async (req, res) => {
  try {
    const db = await getPrisma();
    const { confirmToken } = req.body;

    if (confirmToken !== 'CONFIRM_MERGE_BURNS_ACCOUNTS') {
      return res.status(400).json({ error: 'Invalid confirmation token. Send { confirmToken: "CONFIRM_MERGE_BURNS_ACCOUNTS" }' });
    }

    const results = [];

    // Target user account (alexander.burns) - will be the primary account
    const targetUserId = 'cmlw89air0001ml3apfk5l1sz';
    // Source user account (8201112) - will be deleted
    const sourceUserId = 'cmkdynoqv0000o30fwtqqwkzw';
    // Personnel record to re-link
    const personnelId = 'cmkivhycv0001k30fbih64ptl';

    // Step 1: Update Personnel to link to alexander.burns account
    await db.personnel.update({
      where: { id: personnelId },
      data: { userId: targetUserId }
    });
    results.push(`Linked Personnel ${personnelId} to User ${targetUserId} (alexander.burns)`);

    // Step 2: Update alexander.burns user to have both INSTRUCTOR and ADMIN roles
    // Check if there's a single role field or if we need to handle multiple roles
    await db.user.update({
      where: { id: targetUserId },
      data: { role: 'ADMIN' } // Keep ADMIN as primary, INSTRUCTOR implied by Personnel link
    });
    results.push(`Updated User ${targetUserId} role to ADMIN (INSTRUCTOR via Personnel link)`);

    // Step 3: Delete the 8201112 user account
    try {
      await db.user.delete({ where: { id: sourceUserId } });
      results.push(`Deleted User ${sourceUserId} (8201112)`);
    } catch (e) {
      results.push(`Failed to delete User ${sourceUserId}: ${e.message}`);
    }

    // Verify the merge
    const personnel = await db.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, name: true, rank: true, userId: true }
    });
    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });
    const remainingUsers = await db.user.findMany({
      where: { OR: [
        { firstName: { contains: 'Burns', mode: 'insensitive' } },
        { lastName: { contains: 'Burns', mode: 'insensitive' } },
        { username: { contains: 'burns', mode: 'insensitive' } }
      ]},
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });

    res.json({
      success: true,
      actions: results,
      linkedPersonnel: personnel,
      primaryUser: user,
      allBurnsUsers: remainingUsers
    });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Merge failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: 'v2-academic-fix' });
});

// GET /api/version - returns the active git commit hash from Railway environment
app.get('/api/version', (req, res) => {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA || 'unknown';
  const shortCommit = commit.length > 7 ? commit.substring(0, 7) : commit;
  res.json({ commit: shortCommit, full: commit });
});

// GET /api/debug/courses - Show distinct courses and their unit values in DB
app.get('/api/debug/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    const trainees = await db.trainee.findMany({
      select: { course: true, unit: true, location: true, name: true },
      orderBy: { course: 'asc' }
    });
    // Group by course and show unit/location values
    const grouped = {};
    trainees.forEach((t) => {
      const c = t.course || '(null)';
      if (!grouped[c]) grouped[c] = { units: new Set(), locations: new Set(), count: 0, sample: [] };
      grouped[c].units.add(t.unit || '(null)');
      grouped[c].locations.add(t.location || '(null)');
      grouped[c].count++;
      if (grouped[c].sample.length < 3) grouped[c].sample.push(t.name);
    });
    const result = Object.entries(grouped).map(([course, data]) => ({
      course,
      count: data.count,
      units: [...data.units],
      locations: [...data.locations],
      sample: data.sample
    }));
    res.json({ courses: result, total: trainees.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug/trainees/:course - Show trainees for a specific course
app.get('/api/debug/trainees/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course } = req.params;
    const trainees = await db.trainee.findMany({
      where: { course: course },
      select: { idNumber: true, name: true, course: true, unit: true, location: true },
      orderBy: { name: 'asc' }
    });
    res.json({ course, count: trainees.length, trainees });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug/solo-syllabus - Show solo syllabus items from DB (BGF11, BGF18 + sortieType='Solo')
app.get('/api/debug/solo-syllabus', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(`
      SELECT id, code, "eventDescription", "sortieType", "type", "isActive"
      FROM "SyllabusItem"
      WHERE "sortieType" = 'Solo'
         OR code IN ('BGF11', 'BGF18')
         OR "eventDescription" ILIKE '%solo%'
      ORDER BY code
    `);
    res.json({ count: rows.length, items: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug/snapshots - Show all saved DailySnapshot records (id, date, event count, savedAt)
app.get('/api/debug/snapshots', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(`
      SELECT id, date, "savedAt", "savedBy",
             jsonb_array_length("scheduleEvents") AS "eventCount"
      FROM "DailySnapshot"
      ORDER BY date DESC
    `);
    res.json({ count: rows.length, snapshots: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/fix-academics-courses - Manually trigger the Academics courses[] migration
// GET /api/admin/fix-academics-courses?secret=dfp-fix-2026 - same but via GET for easy browser use
app.get('/api/admin/fix-academics-courses', async (req, res) => {
  if (req.query.secret !== 'dfp-fix-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(`
      SELECT id, code, module, courses
      FROM "SyllabusItem"
      WHERE "type" = 'Academics' AND "isActive" = true
    `);
    let fixed = 0;
    let alreadyCorrect = 0;
    const details = [];
    for (const row of rows) {
      const courses = Array.isArray(row.courses) ? row.courses : [];
      const moduleName = row.module || '';
      if (moduleName && !courses.includes(moduleName)) {
        await db.$executeRawUnsafe(
          `UPDATE "SyllabusItem" SET "courses" = ARRAY[$1::text], "updatedAt" = NOW() WHERE "id" = $2`,
          moduleName, row.id
        );
        details.push({ code: row.code, from: courses, to: [moduleName] });
        fixed++;
      } else {
        alreadyCorrect++;
      }
    }
    res.json({ success: true, total: rows.length, fixed, alreadyCorrect, details });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug/academics - Diagnostic: show all Academics-type syllabus items and their courses[] field
app.get('/api/debug/academics', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(`
      SELECT id, code, module, type, courses, "isActive"
      FROM "SyllabusItem"
      WHERE "type" = 'Academics'
      ORDER BY "sortOrder" ASC
      LIMIT 20
    `);
    res.json({
      count: rows.length,
      items: rows.map(r => ({
        id: r.id,
        code: r.code,
        module: r.module,
        type: r.type,
        courses: r.courses,
        isActive: r.isActive,
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DEBUG: Check DailyAverage and Events for specific date
// ============================================================
app.get('/api/debug/check-table-structure', async (req, res) => {
  try {
    const db = await getPrisma();
    const tableName = req.query.table || 'AircraftAvailabilityHistory';
    // Get column names for the specified table
    const columns = await db.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1::text 
      ORDER BY ordinal_position
    `, tableName);
    res.json({ table: tableName, columns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/check-daily-average', async (req, res) => {
  try {
    const db = await getPrisma();
    const targetDate = req.query.date || '2026-05-02';
    
    // Check AircraftAvailabilityHistory record for target date
    const dailyAvg = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE date = $1::text`,
      targetDate
    );
    
    // Check AircraftAvailabilityEvent records for target date
    const eventCount = await db.$queryRawUnsafe(
      `SELECT COUNT(*) as count, MIN("timestamp") as min_ts, MAX("timestamp") as max_ts 
       FROM "AircraftAvailabilityEvent" WHERE date = $1::text`,
      targetDate
    );
    
    // Get sample events to understand the data
    const sampleEvents = await db.$queryRawUnsafe(
      `SELECT "id", "timestamp", "availableCount", "totalAircraft", "changeType", date 
       FROM "AircraftAvailabilityEvent" 
       WHERE date = $1::text 
       ORDER BY "timestamp" ASC 
       LIMIT 10`,
      targetDate
    );
    
    // Get all AircraftAvailabilityHistory records around that time
    const avgSample = await db.$queryRawUnsafe(
      `SELECT date, "dailyAverage", COALESCE("totalFleet", "totalAircraft") as "totalFleet", "createdAt", "updatedAt" 
       FROM "AircraftAvailabilityHistory" 
       WHERE date >= $1::text || '-01' AND date <= $1::text || '-05'
       ORDER BY date`,
      targetDate.substring(0, 7) // Get YYYY-MM from target date
    );
    
    // Get total counts
    const totals = await db.$queryRawUnsafe(
      `SELECT 
         (SELECT COUNT(*) FROM "AircraftAvailabilityHistory") as avg_count,
         (SELECT MIN(date) FROM "AircraftAvailabilityHistory") as min_date,
         (SELECT MAX(date) FROM "AircraftAvailabilityHistory") as max_date,
         (SELECT COUNT(*) FROM "AircraftAvailabilityEvent") as event_count,
         (SELECT MIN(date) FROM "AircraftAvailabilityEvent") as min_event_date,
         (SELECT MAX(date) FROM "AircraftAvailabilityEvent") as max_event_date`
    );
    
    // Convert BigInt values to String for JSON serialization
    const serialize = (obj) => {
      return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    };
    
    res.json({
      targetDate,
      dailyAverage: dailyAvg[0] ? serialize(dailyAvg[0]) : null,
      eventCount: eventCount[0] ? serialize(eventCount[0]) : null,
      sampleEvents: sampleEvents.map(e => serialize(e)),
      avgSample: avgSample.map(e => serialize(e)),
      totals: totals[0] ? serialize(totals[0]) : null
    });
  } catch (error) {
    console.error('[DEBUG] Error checking daily average:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SYLLABUS API
// ============================================================

// GET /api/syllabus - Fetch all active syllabus items
app.get('/api/syllabus', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course, phase, type, includeInactive } = req.query;

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (!includeInactive || includeInactive !== 'true') {
      params.push(true);
      conditions.push(`"isActive" = $${params.length}`);
    }
    if (course) {
      params.push(course);
      conditions.push(`$${params.length} = ANY("courses")`);
    }
    if (phase) {
      params.push(`%${phase}%`);
      conditions.push(`"phase" ILIKE $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`"type" = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM "SyllabusItem" ${whereClause} ORDER BY "sortOrder" ASC`;

    const items = await db.$queryRawUnsafe(query, ...params);
    console.log(`✅ GET /api/syllabus - returning ${items.length} items`);
    res.json({ syllabus: items, count: items.length });
  } catch (error) {
    console.error('❌ GET /api/syllabus error:', error);
    res.status(500).json({ error: 'Failed to fetch syllabus', details: error.message });
  }
});

// GET /api/syllabus/:id - Fetch single syllabus item by id or code
app.get('/api/syllabus/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "SyllabusItem" WHERE "id" = $1 OR "code" = $1 LIMIT 1`,
      id
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Syllabus item not found' });
    }
    res.json({ item: rows[0] });
  } catch (error) {
    console.error('❌ GET /api/syllabus/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch syllabus item', details: error.message });
  }
});

// GET /api/syllabus/codes - Get all existing active course codes (for duplicate checking)
app.get('/api/syllabus/codes', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(`SELECT DISTINCT "code" FROM "SyllabusItem" WHERE "isActive" = true OR "isActive" IS NULL`);
    const codes = rows.map(r => r.code);
    res.json({ success: true, codes });
  } catch (error) {
    console.error('❌ GET /api/syllabus/codes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/syllabus - Create a new syllabus item
app.post('/api/syllabus', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;
    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    // Auto-resolve duplicate codes: if code already exists (active items only), append a number suffix
    let baseCode = body.code;
    let finalCode = baseCode;
    let suffix = 2;
    while (true) {
      const existing = await db.$queryRawUnsafe(
        `SELECT "id" FROM "SyllabusItem" WHERE "code" = $1 AND "isActive" = true LIMIT 1`,
        finalCode
      );
      if (existing.length === 0) break; // code is available
      finalCode = `${baseCode}${suffix}`;
      suffix++;
      if (suffix > 99) break; // safety valve
    }

    // Also update the courses array to use the final code
    let finalCourses = (body.courses || []).map(c => c === baseCode ? finalCode : c);

    await db.$executeRawUnsafe(`
      INSERT INTO "SyllabusItem" (
        "id","code","eventDescription","phase","module","type","sortieType","dayNight",
        "courses","methodOfDelivery","methodOfAssessment","resourcesPhysical","resourceNumber","acceptableAircraftConfigs","resourcesHuman",
        "eventDetailsCommon","eventDetailsSortie","flightOrSimHours","totalEventHours","duration",
        "preFlightTime","postFlightTime","prerequisites","prerequisitesGround","prerequisitesFlying",
        "location","sortOrder","lmpType","twrDiReqd","cctOnly","isRemedial","isActive","version",
        "notes","createdBy","createdAt","updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,$31,$32,$33,
        $34,$35,NOW(),NOW()
      )`,
      id, finalCode, body.eventDescription, body.phase, body.module, body.type,
      body.sortieType || null, body.dayNight || 'Day',
      finalCourses, body.methodOfDelivery || [], body.methodOfAssessment || [],
      body.resourcesPhysical || [], Math.max(0, Math.round(Number(body.resourceNumber ?? (body.resourcesPhysical?.length ? 1 : 0)) || 0)),
      Array.isArray(body.acceptableAircraftConfigs) && body.acceptableAircraftConfigs.length ? body.acceptableAircraftConfigs : ['ANY'],
      body.resourcesHuman || [],
      body.eventDetailsCommon || [], body.eventDetailsSortie || [],
      body.flightOrSimHours || 0, body.totalEventHours || 1, body.duration || 1,
      body.preFlightTime || 0, body.postFlightTime || 0,
      body.prerequisites || [], body.prerequisitesGround || [], body.prerequisitesFlying || [],
      body.location || null, body.sortOrder || 0,
      body.lmpType || null, body.twrDiReqd || null, body.cctOnly || null,
      body.isRemedial || false, true, 1,
      body.notes || null, body.createdBy || null
    );

    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "id" = $1`, id);
    const syllabusItem = rows[0] ? { ...rows[0], id: rows[0].code || rows[0].id } : null;
    if (finalCode !== baseCode) {
      console.log(`✅ POST /api/syllabus - created: ${finalCode} (requested: ${baseCode}, was duplicate)`);
    } else {
      console.log(`✅ POST /api/syllabus - created: ${finalCode}`);
    }
    res.json({ success: true, syllabusItem, item: rows[0] });
  } catch (error) {
    console.error('❌ POST /api/syllabus error:', error);
    res.status(500).json({ error: error.message || 'Failed to create syllabus item', details: error.message });
  }
});

// PUT /api/syllabus/:id - Update a syllabus item
app.put('/api/syllabus/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const body = req.body;

    // Exclude server-managed fields, timestamps, and non-column metadata fields sent from frontend
    const EXCLUDED_FIELDS = ['id', 'createdAt', 'createdBy', 'updatedAt', 'version', 'changeReason'];
    const fields = Object.keys(body).filter(k => !EXCLUDED_FIELDS.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Build SET clauses, casting array fields and boolean fields properly
    const ARRAY_FIELDS = ['courses','methodOfDelivery','methodOfAssessment','resourcesPhysical','acceptableAircraftConfigs','resourcesHuman',
                          'eventDetailsCommon','eventDetailsSortie','prerequisites','prerequisitesGround','prerequisitesFlying'];
    const BOOL_FIELDS = ['isActive','isRemedial'];
    const INT_FIELDS = ['resourceNumber'];

    const setClauses = fields.map((f, i) => {
      if (ARRAY_FIELDS.includes(f)) return `"${f}" = $${i + 2}::text[]`;
      if (BOOL_FIELDS.includes(f)) return `"${f}" = $${i + 2}::boolean`;
      if (INT_FIELDS.includes(f)) return `"${f}" = $${i + 2}::integer`;
      return `"${f}" = $${i + 2}`;
    }).join(', ');
    const values = fields.map(f => {
      if (INT_FIELDS.includes(f)) return Math.max(0, Math.round(Number(body[f]) || 0));
      if (f === 'acceptableAircraftConfigs') {
        return Array.isArray(body[f]) && body[f].length ? body[f] : ['ANY'];
      }
      return body[f];
    });

    await db.$executeRawUnsafe(
      `UPDATE "SyllabusItem" SET ${setClauses}, "version" = "version" + 1, "updatedAt" = NOW() WHERE "id" = $1 OR "code" = $1`,
      id, ...values
    );

    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "id" = $1 OR "code" = $1`, id);
    const syllabusItem = rows[0] ? { ...rows[0], id: rows[0].code || rows[0].id } : null;
    console.log(`✅ PUT /api/syllabus/${id}`);
    res.json({ success: true, syllabusItem, item: rows[0] });
  } catch (error) {
    console.error('❌ PUT /api/syllabus/:id error:', error);
    res.status(500).json({ error: error.message || 'Failed to update syllabus item', details: error.message });
  }
});

// DELETE /api/syllabus/:id - Hard delete a syllabus item (permanently removes from DB)
app.delete('/api/syllabus/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const { hardDelete } = req.body || {};

    // Always hard delete - permanently remove from DB so codes can be reused
    await db.$executeRawUnsafe(
      `DELETE FROM "SyllabusItem" WHERE "id" = $1 OR "code" = $1`,
      id
    );

    console.log(`✅ DELETE /api/syllabus/${id} (hard delete)`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/syllabus/:id error:', error);
    res.status(500).json({ error: 'Failed to delete syllabus item', details: error.message });
  }
});

// POST /api/auth/verify-password - Verify current user's password for destructive action confirmations
app.post('/api/auth/verify-password', async (req, res) => {
  try {
    const db = await getPrisma();
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ valid: false, error: 'Password required' });
    }

    // Get session token from Authorization header (Bearer token)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const sessionToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!sessionToken) {
      return res.status(401).json({ valid: false, error: 'Not authenticated - no session token' });
    }

    // Look up the session in the Session table to get userId
    const sessions = await db.$queryRawUnsafe(
      `SELECT "userId", "expires" FROM "Session" WHERE "sessionToken" = $1`,
      sessionToken
    );

    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
    }

    const session = sessions[0];

    // Check session has not expired
    if (new Date(session.expires) < new Date()) {
      return res.status(401).json({ valid: false, error: 'Session expired' });
    }

    const userDbId = session.userId;

    // Fetch user with password from database using the id from Session table
    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", "firstName", "lastName", password FROM "User" WHERE id = $1`,
      userDbId
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    const userData = users[0];
    const displayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

    // Check if user has a password set
    if (!userData.password) {
      console.warn(`⚠️ User ${displayName} has no password set`);
      return res.status(400).json({ 
        valid: false, 
        error: 'No password set for this account. Run the set-password curl command first.',
        reason: 'no_password'
      });
    }

    // Use bcryptjs to verify password
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, userData.password);

    if (valid) {
      console.log(`✅ Password verified for ${displayName}`);
    } else {
      console.log(`❌ Password verification failed for ${displayName}`);
    }

    res.json({ valid });
  } catch (error) {
    console.error('❌ POST /api/auth/verify-password error:', error);
    res.status(500).json({ valid: false, error: error.message || 'Server error' });
  }
});

// POST /api/auth/direct-login - Browser app login used by the V2 React client
app.post('/api/auth/direct-login', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId: loginUserId, password } = req.body || {};

    if (!loginUserId || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'User ID and password are required',
      });
    }

    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", password
       FROM "User"
       WHERE "userId" = $1 OR username = $1
       LIMIT 1`,
      loginUserId
    );

    if (!users || users.length === 0 || !users[0].password) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid User ID or password',
      });
    }

    const user = users[0];
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated',
      });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid User ID or password',
      });
    }

    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.$executeRawUnsafe(
      `INSERT INTO "Session" ("id", "sessionToken", "userId", "expires")
       VALUES (gen_random_uuid()::text, $1, $2, $3::timestamp)`,
      sessionToken,
      user.id,
      expires.toISOString()
    );

    await db.$executeRawUnsafe(
      `UPDATE "User" SET "lastLogin" = $1::timestamp, "updatedAt" = $1::timestamp WHERE id = $2`,
      new Date().toISOString(),
      user.id
    );

    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", "ipAddress", "userAgent", "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'LOGIN', 'User', $1, $2, $3, NOW())`,
        user.id,
        req.headers['x-forwarded-for'] || req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );
    } catch (auditError) {
      console.warn('⚠️ Direct login audit log failed:', auditError.message);
    }

    return res.json({
      sessionToken,
      expires: expires.toISOString(),
      mustChangePassword: false,
      user: {
        id: user.id,
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.userId,
        mustChangePassword: false,
        permissionsRoleId: '',
      },
    });
  } catch (error) {
    console.error('❌ POST /api/auth/direct-login error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'An error occurred during login' });
  }
});

// GET /api/auth/direct-session - Browser app session restore
app.get('/api/auth/direct-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const db = await getPrisma();
    const sessions = await db.$queryRawUnsafe(
      `SELECT s."sessionToken", s.expires, u.id, u."userId", u.username, u.email, u."firstName", u."lastName", u.role, u."isActive"
       FROM "Session" s
       JOIN "User" u ON u.id = s."userId"
       WHERE s."sessionToken" = $1
       LIMIT 1`,
      sessionToken
    );

    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ error: 'Invalid token', message: 'Session not found' });
    }

    const session = sessions[0];
    if (new Date(session.expires).getTime() <= Date.now()) {
      await db.$executeRawUnsafe(`DELETE FROM "Session" WHERE "sessionToken" = $1`, sessionToken);
      return res.status(401).json({ error: 'Token expired', message: 'Session has expired' });
    }

    return res.json({
      user: {
        id: session.id,
        userId: session.userId,
        username: session.username,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        role: session.role,
        isActive: session.isActive,
        displayName: `${session.firstName || ''} ${session.lastName || ''}`.trim() || session.username || session.userId,
        mustChangePassword: false,
        permissionsRoleId: '',
      },
    });
  } catch (error) {
    console.error('❌ GET /api/auth/direct-session error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to get session' });
  }
});

// POST /api/auth/direct-logout - Browser app logout
app.post('/api/auth/direct-logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (sessionToken) {
      const db = await getPrisma();
      await db.$executeRawUnsafe(`DELETE FROM "Session" WHERE "sessionToken" = $1`, sessionToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ POST /api/auth/direct-logout error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to logout' });
  }
});



  // ============================================================
  // MOBILE API ENDPOINTS
  // ============================================================

  // Helper: Generate JWT tokens
  function generateAccessTokens(userId) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRY }
    );
    return { accessToken, refreshToken };
  }

  // Helper: Verify JWT token and extract userId
  function verifyJWT(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type === 'access' || decoded.type === 'refresh') {
        return decoded.userId;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // POST /api/mobile/auth/login - Mobile JWT login
  app.post('/api/mobile/auth/login', async (req, res) => {
    try {
      const db = await getPrisma();
      const { userId: loginUserId, password } = req.body;

      if (!loginUserId || !password) {
        return res.status(400).json({ 
          error: 'userId and password are required' 
        });
      }

      // Find user by userId
      const users = await db.$queryRawUnsafe(
        `SELECT id, "userId", "firstName", "lastName", email, "role", "isActive", password FROM "User" WHERE "userId" = $1`,
        loginUserId
      );

      if (!users || users.length === 0) {
        console.log(`❌ Mobile login failed: User not found for userId=${loginUserId}`);
        return res.status(401).json({ 
          error: 'Invalid userId or password' 
        });
      }

      const user = users[0];

      // Check if user is active
      if (!user.isActive) {
        console.log(`❌ Mobile login failed: User ${loginUserId} is not active`);
        return res.status(403).json({ 
          error: 'Account is inactive' 
        });
      }

      // Verify password
      const bcrypt = require('bcryptjs');
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        console.log(`❌ Mobile login failed: Invalid password for userId=${loginUserId}`);
        return res.status(401).json({ 
          error: 'Invalid userId or password' 
        });
      }

      // Generate JWT tokens
      const { accessToken, refreshToken } = generateAccessTokens(user.userId);

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Map role to iOS enum format
      const roleMap = {
        'SUPER_ADMIN': 'ADMIN',
        'ADMIN': 'ADMIN',
        'INSTRUCTOR': 'INSTRUCTOR',
        'USER': 'STUDENT',
        'PILOT': 'OTHER'
      };
      const iOSRole = roleMap[user.role] || 'OTHER';

      console.log(`✅ Mobile login successful for userId=${loginUserId}, role=${user.role}`);

      res.json({
           success: true,
           message: "Login successful",
           data: {
             accessToken,
             refreshToken,
             user: {
               id: user.userId,
               userId: user.userId,
               displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
               email: user.email,
               isActive: user.isActive,
               role: iOSRole,
               firstName: user.firstName,
               lastName: user.lastName
             }
           }
         });
    } catch (error) {
      console.error('❌ POST /api/mobile/auth/login error:', error);
      res.status(500).json({ error: 'Login failed', details: error.message });
    }
  });

  // POST /api/mobile/auth/refresh - Refresh JWT access token
  app.post('/api/mobile/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      // Verify refresh token
      const userId = verifyJWT(refreshToken);

      if (!userId) {
        console.log('❌ Mobile refresh failed: Invalid or expired refresh token');
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // Verify user exists and is active
      const db = await getPrisma();
      const users = await db.$queryRawUnsafe(
        `SELECT id, "userId", "isActive" FROM "User" WHERE "userId" = $1`,
        userId
      );

      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateAccessTokens(user.userId);

      console.log(`✅ Mobile refresh successful for userId=${userId}`);

      res.json({
        accessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error('❌ POST /api/mobile/auth/refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
  });

  // Middleware: Verify JWT for protected mobile routes
  function authenticateMobileJWT(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    const userId = verifyJWT(token);

    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    req.userId = userId;
    req.mobileUserId = userId; // kept for compatibility
    next();
  }

  // GET /api/mobile/schedule - Get user's schedule (authenticated)
app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    const jwtUserId = req.userId; // This is the human-readable userId (e.g. "alexander.burns")
    const { date, startDate, endDate } = req.query;

    console.log("📅 Fetching schedule for jwtUserId=" + jwtUserId + ", params: " + JSON.stringify(req.query));

    // Step 1: Look up the User record by userId to get the DB id (cuid)
    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", "firstName", "lastName" FROM "User" WHERE "userId" = $1 LIMIT 1`,
      jwtUserId
    );

    if (!users || users.length === 0) {
      console.log("❌ No user found for jwtUserId=" + jwtUserId);
      return res.status(401).json({ error: "User not found" });
    }

    const dbUser = users[0];
    const dbUserId = dbUser.id; // cuid - used as FK in Schedule table
    const userFullName = ((dbUser.firstName || '') + ' ' + (dbUser.lastName || '')).trim();
    // Also build "Last, First" format used in DailySnapshot events
    const userFullNameReversed = ((dbUser.lastName || '') + ', ' + (dbUser.firstName || '')).trim();

    console.log("👤 Resolved user: dbId=" + dbUserId + ", name=" + userFullName);

    // Step 2: Build schedule query using real columns (no isPublished/serverTime)
    let scheduleWhere = { userId: dbUserId };
    if (date) {
      scheduleWhere.date = date;
    } else if (startDate || endDate) {
      scheduleWhere.date = {};
      if (startDate) scheduleWhere.date.gte = startDate;
      if (endDate) scheduleWhere.date.lte = endDate;
    }

    const schedules = await db.schedule.findMany({
      where: scheduleWhere,
      orderBy: { date: 'asc' }
    });

    // Helper: convert decimal hours (e.g. 9.5) or HH:MM string to "HH:MM"
    function toHHMM(val) {
      if (!val && val !== 0) return "00:00";
      if (typeof val === 'string' && /^\d{2}:\d{2}/.test(val)) return val.substring(0, 5);
      const num = parseFloat(val);
      if (isNaN(num)) return "00:00";
      const h = Math.floor(num);
      const m = Math.round((num - h) * 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    // Helper: map event type string to iOS EventType enum values
    function mapEventType(type) {
      if (!type) return "Other";
      const t = type.toLowerCase();
      if (t === 'flight') return "Flight";
      if (t === 'ftd' || t === 'simulator') return "FTD";
      if (t === 'brief' || t === 'briefing') return "Brief";
      if (t === 'duty') return "Duty";
      if (t === 'ground') return "Ground";
      return "Other";
    }

    // Helper: map role string to iOS EventRole enum values
    function mapRole(role) {
      if (!role) return null;
      const r = role.toLowerCase();
      if (r === 'student' || r === 'trainee') return "Student";
      if (r === 'instructor') return "Instructor";
      if (r === 'crew') return "Crew";
      if (r === 'observer') return "Observer";
      if (r === 'pilot') return "Pilot";
      if (r === 'copilot' || r === 'co-pilot') return "Co-Pilot";
      return null;
    }

    // Helper: extract events from Schedule.data JSON blob
    function extractEventsFromData(dataJson) {
      if (!dataJson) return [];
      try {
        const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
        // data could be an array of events or an object with an events array
        let rawEvents = [];
        if (Array.isArray(data)) {
          rawEvents = data;
        } else if (data.events && Array.isArray(data.events)) {
          rawEvents = data.events;
        } else if (data.scheduleEvents && Array.isArray(data.scheduleEvents)) {
          rawEvents = data.scheduleEvents;
        } else if (data.slots && Array.isArray(data.slots)) {
          rawEvents = data.slots;
        } else {
          // Try to find any array property that looks like events
          for (const key of Object.keys(data)) {
            if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0].startTime !== undefined) {
              rawEvents = data[key];
              break;
            }
          }
        }
        return rawEvents.map((e, idx) => ({
          id: String(e.id || e.eventId || idx + 1),
          startTime: toHHMM(e.startTime),
          endTime: toHHMM(e.endTime || (e.startTime ? parseFloat(e.startTime) + (parseFloat(e.duration) || 1) : null)),
          eventType: mapEventType(e.type || e.eventType || e.eventCode),
          location: e.location || e.origin || null,
          role: mapRole(e.role || (
              (e.student && (e.student.toLowerCase().replace(/\s*[–-]\s*\w+\d+\s*$/, '').trim() === userFullName.toLowerCase() || e.student.toLowerCase().replace(/\s*[–-]\s*\w+\d+\s*$/, '').trim() === userFullNameReversed.toLowerCase())) ? 'Student' :
              (e.instructor && (e.instructor.toLowerCase() === userFullName.toLowerCase() || e.instructor.toLowerCase() === userFullNameReversed.toLowerCase())) ? 'Instructor' :
              null
            )),
          status: e.status || "Published",
          notes: e.notes || e.eventDescription || null,
          aircraft: e.aircraft || e.aircraftNumber || e.resourceId || null,
          instructor: e.instructor || null
        }));
      } catch (err) {
        console.error("⚠️ Error parsing schedule data:", err.message);
        return [];
      }
    }

    // Step 3: If Schedule records exist, use them
    if (schedules && schedules.length > 0) {
      const transformedSchedules = schedules.map(schedule => {
        const events = extractEventsFromData(schedule.data);
        return {
          id: String(schedule.id),
          date: schedule.date,
          isPublished: true,
          events: events,
          serverTime: new Date().toISOString()
        };
      });

      if (date && transformedSchedules.length > 0) {
        console.log("✅ GET /api/mobile/schedule - Single date: " + date + ", events: " + transformedSchedules[0].events.length);
        return res.json({ schedule: transformedSchedules[0] });
      }

      console.log("✅ GET /api/mobile/schedule - Found " + transformedSchedules.length + " schedules for userId=" + jwtUserId);
      return res.json({ success: true, schedules: transformedSchedules });
    }

    // Step 4: No Schedule record - check DailySnapshot for published events filtered to this user
    if (date) {
      const snapRows = await db.$queryRawUnsafe(
        `SELECT date, "scheduleEvents", "traineeEvents", "staffEvents"
         FROM "DailySnapshot"
         WHERE date = $1::text
            OR date = $2::text
            OR date = $3::text
            OR date LIKE $4::text
            OR date LIKE $5::text
         ORDER BY
           CASE
             WHEN date = $1::text THEN 0
             WHEN date = $2::text THEN 1
             WHEN date = $3::text THEN 2
             WHEN date LIKE $4::text THEN 3
             WHEN date LIKE $5::text THEN 4
             ELSE 5
           END
         LIMIT 1`,
        date,
        `${date}__ESL`,
        `${date}__PEA`,
        `${date}__ESL__%`,
        `${date}__PEA__%`
      );

      if (snapRows && snapRows.length > 0) {
        const snap = snapRows[0];
        // Combine all event arrays and deduplicate by id
        const allSnapshotEventsRaw = [
          ...(Array.isArray(snap.scheduleEvents) ? snap.scheduleEvents : []),
          ...(Array.isArray(snap.staffEvents) ? snap.staffEvents : []),
          ...(Array.isArray(snap.traineeEvents) ? snap.traineeEvents : [])
        ];
        const seenIds = new Set();
        const allSnapshotEvents = allSnapshotEventsRaw.filter(e => {
          const eid = e.id || e.eventId;
          if (eid && seenIds.has(eid)) return false;
          if (eid) seenIds.add(eid);
          return true;
        });

        // Filter events for this user by name or traineeId matching userId
        // Match by "First Last", "Last, First", or traineeId
        const nameMatch = (nameField) => {
          if (!nameField) return false;
          const n = nameField.toLowerCase();
          // Strip course suffix like "– ADF302" for student fields
          const nClean = n.replace(/\s*[–-]\s*\w+\d+\s*$/, '').trim();
          return nClean === userFullName.toLowerCase() ||
                 nClean === userFullNameReversed.toLowerCase() ||
                 n === userFullName.toLowerCase() ||
                 n === userFullNameReversed.toLowerCase();
        };
        const userEvents = allSnapshotEvents.filter(e =>
          nameMatch(e.student) ||
          nameMatch(e.instructor) ||
          nameMatch(e.pilot) ||
            (e.traineeId && e.traineeId.toLowerCase() === jwtUserId.toLowerCase())
        );

        if (userEvents.length > 0) {
          const mappedEvents = userEvents.map((e, idx) => {
            const isStandby = (e.resourceId && e.resourceId.toLowerCase().includes('stby')) ||
                              (e.flightNumber && e.flightNumber.toLowerCase().includes('stby')) ||
                              (e.status && e.status.toLowerCase() === 'stby');
            const endTimeVal = e.endTime != null ? e.endTime :
              (e.startTime != null ? parseFloat(e.startTime) + (parseFloat(e.duration) || 1) : null);
            return {
              id: String(e.id || e.eventId || idx + 1),
              title: e.flightNumber || e.resourceId || e.eventCode || null,
              startTime: toHHMM(e.startTime),
              endTime: toHHMM(endTimeVal),
              eventType: mapEventType(e.type || e.eventType || e.eventCode),
              location: e.location || e.origin || null,
              role: mapRole(nameMatch(e.student) ? 'Student' : (nameMatch(e.instructor) || nameMatch(e.pilot)) ? 'Instructor' : e.role || null),
              status: isStandby ? "STBY" : "Published",
              isStandby: isStandby,
              notes: e.notes || e.eventDescription || null,
              aircraft: e.aircraft || e.aircraftNumber || e.resourceId || null,
              instructor: e.instructor || null,
              student: e.student || null,
              pilot: e.pilot || null,
              resourceId: e.resourceId || null
            };
          });

            console.log("\u2705 GET /api/mobile/schedule - Found " + mappedEvents.length + " events in DailySnapshot for date=" + date);
            return res.json({
              schedule: {
                id: "snapshot-" + snap.date,
                date: date,
                isPublished: true,
                events: mappedEvents,
                serverTime: new Date().toISOString()
              }
            });
          }
        }
    }

      // No schedule found for this user/date - return empty schedule instead of hanging
      const queryDate = date || new Date().toISOString().split('T')[0];
      console.log("\\u2705 GET /api/mobile/schedule - No events found for userId=" + jwtUserId + ", date=" + queryDate);
      return res.json({
        schedule: {
          id: "empty-" + queryDate,
          date: queryDate,
          isPublished: false,
          events: [],
          serverTime: new Date().toISOString()
        },
        message: "No events scheduled for " + queryDate
      });

  } catch (error) {
    console.error('\u274c GET /api/mobile/schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedule', details: error.message });
  }
});
  // ============================================================
  // MOBILE UNAVAILABILITY ENDPOINTS
  // ============================================================

  // GET /api/mobile/unavailability/reasons - Get list of unavailability reasons
  app.get('/api/mobile/unavailability/reasons', authenticateMobileJWT, async (req, res) => {
    try {
      const reasons = [
        { id: 'TMUF', code: 'TMUF', description: 'TMUF', requiresApproval: false },
        { id: 'TMUF - Ground Duties only', code: 'TMUF-GD', description: 'TMUF - Ground Duties only', requiresApproval: false },
        { id: 'Leave', code: 'LEAVE', description: 'Leave', requiresApproval: true },
        { id: 'Appointment', code: 'APPT', description: 'Appointment', requiresApproval: false },
        { id: 'Deployed', code: 'DEPLOY', description: 'Deployed', requiresApproval: true },
        { id: 'Other', code: 'OTHER', description: 'Other', requiresApproval: false },
      ];
      console.log(`✅ GET /api/mobile/unavailability/reasons - returned ${reasons.length} reasons`);
      res.json({ reasons });
    } catch (error) {
      console.error('❌ GET /api/mobile/unavailability/reasons error:', error);
      res.status(500).json({ error: 'Failed to fetch reasons', message: error.message });
    }
  });

  // ── Per-user submission lock to prevent race-condition duplicates ──────────
  // When the iOS app fires multiple simultaneous requests (retries/network),
  // this map ensures only ONE request per user runs at a time.
  const _unavailLocks = new Map(); // userId -> Promise
  function withUnavailLock(userId, fn) {
    const prev = _unavailLocks.get(userId) || Promise.resolve();
    const next = prev.then(fn).finally(() => {
      // Clean up the map entry once the chain is idle
      if (_unavailLocks.get(userId) === next) _unavailLocks.delete(userId);
    });
    _unavailLocks.set(userId, next);
    return next;
  }

  // POST /api/mobile/unavailability/quick - Submit quick unavailability (today 0800-2300)
  app.post('/api/mobile/unavailability/quick', authenticateMobileJWT, async (req, res) => {
    const humanUserId = req.mobileUserId;
    // Serialise concurrent requests from the same user to prevent race-condition duplicates
    return withUnavailLock(humanUserId, async () => {
    try {
      const db = await getPrisma();
      const { date, reasonId, notes } = req.body;

      if (!date || !reasonId) {
        return res.status(400).json({ error: 'Missing required fields', message: 'date and reasonId are required' });
      }
      // Look up Personnel or Trainee record by multiple strategies
      // Strategy 1: Try userId FK (cuid) match via User table
      const userRows = await db.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName" FROM "User" WHERE "userId" = $1 LIMIT 1`,
        humanUserId
      );
      const userCuid = userRows && userRows.length > 0 ? userRows[0].id : null;
      const dbFirstName = userRows && userRows.length > 0 ? (userRows[0].firstName || '') : '';
      const dbLastName  = userRows && userRows.length > 0 ? (userRows[0].lastName  || '') : '';

      // Build name variants from userId (e.g. "alexander.burns" -> "Burns, Alexander" / "Alexander Burns")
      const parts = humanUserId.split('.');
      const firstFromId = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
      const lastFromId  = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
      const firstName = dbFirstName || firstFromId;
      const lastName  = dbLastName  || lastFromId;
      // Personnel name format: "Last, First"
      const nameLastFirst = lastName && firstName ? `${lastName}, ${firstName}` : '';
      // Personnel name format: "First Last"
      const nameFirstLast = firstName && lastName ? `${firstName} ${lastName}` : '';

      let record = null;
      let recordType = null;

      // Strategy 1: userId FK (cuid)
      if (userCuid) {
        const p = await db.personnel.findFirst({ where: { userId: userCuid } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { userId: userCuid } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 2: name match "Last, First"
      if (!record && nameLastFirst) {
        const p = await db.personnel.findFirst({ where: { name: { equals: nameLastFirst, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { fullName: { equals: nameLastFirst, mode: 'insensitive' } } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 3: name match "First Last"
      if (!record && nameFirstLast) {
        const p = await db.personnel.findFirst({ where: { name: { equals: nameFirstLast, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { fullName: { equals: nameFirstLast, mode: 'insensitive' } } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 4: email match (userId often matches email prefix)
      if (!record) {
        const p = await db.personnel.findFirst({ where: { email: { contains: humanUserId, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
      }

      if (!record) {
        console.log('\u274c Unavailability: No record found for humanUserId=' + humanUserId + ', tried cuid=' + userCuid + ', nameLastFirst="' + nameLastFirst + '", nameFirstLast="' + nameFirstLast + '"');
        return res.status(404).json({ error: 'User not found', message: 'No personnel or trainee record linked to this account. UserID: ' + humanUserId });
      }

      console.log('\u2705 Unavailability: Found ' + recordType + ' record id=' + record.id + ' name=' + (record.name || record.fullName) + ' for userId=' + humanUserId);

      // Build the unavailability period entry
      const newPeriod = {
        id: `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startDate: date,
        endDate: date,
        allDay: false,
        startTime: '08:00',
        endTime: '23:00',
        reason: reasonId,
        notes: notes || undefined,
      };

      // Append to existing unavailability array
      const existing = Array.isArray(record.unavailability) ? record.unavailability : [];
         // ── Deduplication check ───────────────────────────────────────────────
         // Prevent duplicate entries if the iOS app retries or the user submits twice.
         const isDuplicate = existing.some(e =>
           e.startDate === date &&
           e.endDate   === date &&
           e.startTime === '08:00' &&
           e.endTime   === '23:00' &&
           e.reason    === reasonId
         );

         if (isDuplicate) {
           const existingEntry = existing.find(e =>
             e.startDate === date && e.endDate === date &&
             e.startTime === '08:00' && e.endTime === '23:00' && e.reason === reasonId
           );
           console.log('\u26a0\ufe0f POST /api/mobile/unavailability/quick - DUPLICATE for userId=' + humanUserId + ', date=' + date + ' - returning existing entry');
           return res.json({
             id: existingEntry.id,
             status: 'approved',
             startDateTime: `${date}T08:00:00.000Z`,
             endDateTime: `${date}T23:00:00.000Z`,
             reason: { id: reasonId, code: reasonId, description: reasonId, requiresApproval: false },
             notes: notes || null,
             submittedAt: new Date().toISOString(),
             message: `Quick unavailability already registered for ${date} (0800-2300)`,
           });
         }
         // ── End deduplication check ───────────────────────────────────────────


      const updated = [...existing, newPeriod];

      if (recordType === 'personnel') {
        await db.personnel.update({ where: { id: record.id }, data: { unavailability: updated } });
      } else {
        await db.trainee.update({ where: { id: record.id }, data: { unavailability: updated } });
      }

      console.log(`✅ POST /api/mobile/unavailability/quick - userId=${humanUserId}, date=${date}, reason=${reasonId}`);

      res.json({
        id: newPeriod.id,
        status: 'approved',
        startDateTime: `${date}T08:00:00.000Z`,
        endDateTime: `${date}T23:00:00.000Z`,
        reason: { id: reasonId, code: reasonId, description: reasonId, requiresApproval: false },
        notes: notes || null,
        submittedAt: new Date().toISOString(),
        message: `Quick unavailability submitted for ${date} (0800-2300)`,
      });
    } catch (error) {
      console.error('❌ POST /api/mobile/unavailability/quick error:', error);
      res.status(500).json({ error: 'Failed to submit unavailability', message: error.message });
    }
    }); // end withUnavailLock
  });

  // POST /api/mobile/unavailability/create - Submit custom unavailability
  app.post('/api/mobile/unavailability/create', authenticateMobileJWT, async (req, res) => {
    const humanUserId = req.mobileUserId;
    // Serialise concurrent requests from the same user to prevent race-condition duplicates
    return withUnavailLock(humanUserId, async () => {
    try {
      const db = await getPrisma();
      const { startDateTime, endDateTime, reasonId, notes } = req.body;

      if (!startDateTime || !endDateTime || !reasonId) {
        return res.status(400).json({ error: 'Missing required fields', message: 'startDateTime, endDateTime and reasonId are required' });
      }

      // Parse ISO dates into date/time parts
      const startDt = new Date(startDateTime);
      const endDt = new Date(endDateTime);

      if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
        return res.status(400).json({ error: 'Invalid dates', message: 'startDateTime and endDateTime must be valid ISO date strings' });
      }

      if (startDt >= endDt) {
        return res.status(400).json({ error: 'Invalid date range', message: 'endDateTime must be after startDateTime' });
      }

      const pad = n => String(n).padStart(2, '0');
      const startDate = `${startDt.getUTCFullYear()}-${pad(startDt.getUTCMonth()+1)}-${pad(startDt.getUTCDate())}`;
      const endDate = `${endDt.getUTCFullYear()}-${pad(endDt.getUTCMonth()+1)}-${pad(endDt.getUTCDate())}`;
      const startTime = `${pad(startDt.getUTCHours())}:${pad(startDt.getUTCMinutes())}`;
      const endTime = `${pad(endDt.getUTCHours())}:${pad(endDt.getUTCMinutes())}`;
      const allDay = startDate !== endDate && startTime === '00:00' && endTime === '00:00';

      // Look up Personnel or Trainee record by multiple strategies
      // Strategy 1: Try userId FK (cuid) match via User table
      const userRows = await db.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName" FROM "User" WHERE "userId" = $1 LIMIT 1`,
        humanUserId
      );
      const userCuid = userRows && userRows.length > 0 ? userRows[0].id : null;
      const dbFirstName = userRows && userRows.length > 0 ? (userRows[0].firstName || '') : '';
      const dbLastName  = userRows && userRows.length > 0 ? (userRows[0].lastName  || '') : '';

      // Build name variants from userId (e.g. "alexander.burns" -> "Burns, Alexander" / "Alexander Burns")
      const parts = humanUserId.split('.');
      const firstFromId = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
      const lastFromId  = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
      const firstName = dbFirstName || firstFromId;
      const lastName  = dbLastName  || lastFromId;
      // Personnel name format: "Last, First"
      const nameLastFirst = lastName && firstName ? `${lastName}, ${firstName}` : '';
      // Personnel name format: "First Last"
      const nameFirstLast = firstName && lastName ? `${firstName} ${lastName}` : '';

      let record = null;
      let recordType = null;

      // Strategy 1: userId FK (cuid)
      if (userCuid) {
        const p = await db.personnel.findFirst({ where: { userId: userCuid } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { userId: userCuid } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 2: name match "Last, First"
      if (!record && nameLastFirst) {
        const p = await db.personnel.findFirst({ where: { name: { equals: nameLastFirst, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { fullName: { equals: nameLastFirst, mode: 'insensitive' } } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 3: name match "First Last"
      if (!record && nameFirstLast) {
        const p = await db.personnel.findFirst({ where: { name: { equals: nameFirstLast, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
        if (!record) {
          const t = await db.trainee.findFirst({ where: { fullName: { equals: nameFirstLast, mode: 'insensitive' } } });
          if (t) { record = t; recordType = 'trainee'; }
        }
      }

      // Strategy 4: email match
      if (!record) {
        const p = await db.personnel.findFirst({ where: { email: { contains: humanUserId, mode: 'insensitive' } } });
        if (p) { record = p; recordType = 'personnel'; }
      }

      if (!record) {
        console.log('\u274c Unavailability: No record found for humanUserId=' + humanUserId + ', tried cuid=' + userCuid + ', nameLastFirst="' + nameLastFirst + '", nameFirstLast="' + nameFirstLast + '"');
        return res.status(404).json({ error: 'User not found', message: 'No personnel or trainee record linked to this account. UserID: ' + humanUserId });
      }

      console.log('\u2705 Unavailability: Found ' + recordType + ' record id=' + record.id + ' name=' + (record.name || record.fullName) + ' for userId=' + humanUserId);

      // Build the unavailability period entry
      const newPeriod = {
        id: `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startDate,
        endDate,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        reason: reasonId,
        notes: notes || undefined,
      };

      // Append to existing unavailability array
      const existing = Array.isArray(record.unavailability) ? record.unavailability : [];
         // ── Deduplication check ───────────────────────────────────────────────
         // Prevent duplicate entries if the iOS app retries or the user submits twice.
         // For custom unavailability, match on startDate, endDate, startTime, endTime, reason.
         const startDateOnly = startDateTime ? startDateTime.split('T')[0] : '';
         const endDateOnly   = endDateTime   ? endDateTime.split('T')[0]   : '';
         const startTimeOnly = startDateTime && startDateTime.includes('T')
           ? startDateTime.split('T')[1].substring(0, 5) : startTime;
         const endTimeOnly   = endDateTime   && endDateTime.includes('T')
           ? endDateTime.split('T')[1].substring(0, 5)   : endTime;

         const isDuplicate = existing.some(e =>
           e.startDate === startDateOnly &&
           e.endDate   === endDateOnly   &&
           String(e.startTime || '').replace(':', '') === String(startTimeOnly || '').replace(':', '') &&
           String(e.endTime   || '').replace(':', '') === String(endTimeOnly   || '').replace(':', '') &&
           e.reason    === reasonId
         );

         if (isDuplicate) {
           const existingEntry = existing.find(e =>
             e.startDate === startDateOnly && e.endDate === endDateOnly && e.reason === reasonId
           );
           console.log('\u26a0\ufe0f POST /api/mobile/unavailability/create - DUPLICATE for userId=' + humanUserId + ', start=' + startDateTime + ' - returning existing entry');
           return res.json({
             id: existingEntry.id,
             status: 'approved',
             startDateTime,
             endDateTime,
             reason: { id: reasonId, code: reasonId, description: reasonId, requiresApproval: false },
             notes: notes || null,
             submittedAt: new Date().toISOString(),
             message: `Unavailability already registered from ${startDateOnly} to ${endDateOnly}`,
           });
         }
         // ── End deduplication check ───────────────────────────────────────────


      const updated = [...existing, newPeriod];

      if (recordType === 'personnel') {
        await db.personnel.update({ where: { id: record.id }, data: { unavailability: updated } });
      } else {
        await db.trainee.update({ where: { id: record.id }, data: { unavailability: updated } });
      }

      console.log(`✅ POST /api/mobile/unavailability/create - userId=${humanUserId}, start=${startDateTime}, end=${endDateTime}, reason=${reasonId}`);

      res.json({
        id: newPeriod.id,
        status: 'approved',
        startDateTime,
        endDateTime,
        reason: { id: reasonId, code: reasonId, description: reasonId, requiresApproval: false },
        notes: notes || null,
        submittedAt: new Date().toISOString(),
        message: `Unavailability submitted from ${startDate} to ${endDate}`,
      });
    } catch (error) {
      console.error('❌ POST /api/mobile/unavailability/create error:', error);
      res.status(500).json({ error: 'Failed to submit unavailability', message: error.message });
    }
    }); // end withUnavailLock
  });

  // ============================================================
  // END MOBILE API ENDPOINTS
  // ============================================================

// POST /api/admin/set-user-password - Set or update a user's password (for initial setup/reset)
app.post('/api/admin/set-user-password', async (req, res) => {
  try {
    const db = await getPrisma();
    const { fullName, password, userId, email } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
      });
    }

    // Find user by fullName (firstName + lastName), userId, or email
    let user;
    let sql, params;
    
    if (fullName) {
      // fullName might be like "SQNLDR Alexander Burns" - parse for first/last name
      // Split by space, take last word as lastName, first word as firstName (skip title like SQNLDR)
      const parts = fullName.trim().split(/\s+/);
      const lastName = parts.pop(); // Last word is lastName
      const firstName = parts.pop() || ''; // Second-to-last is firstName (skip title)
      
      sql = `SELECT id, firstName, lastName, email, username, password, isActive, role FROM "User" 
             WHERE (firstName ILIKE $1 AND lastName ILIKE $2)
             OR (firstName || ' ' || COALESCE(lastName, '')) ILIKE $3`;
      params = [`%${firstName}%`, lastName, `%${fullName}%`];
    } else if (userId) {
      sql = `SELECT id, firstName, lastName, email, username, password, isActive, role FROM "User" WHERE id = $1 OR userId = $1`;
      params = [userId];
    } else {
      sql = `SELECT id, firstName, lastName, email, username, password, isActive, role FROM "User" WHERE email = $1`;
      params = [email];
    }
    
    const userRows = await db.$queryRawUnsafe(sql, ...params);

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        searchBy: fullName ? 'fullName' : userId ? 'userId' : 'email',
        searchValue: fullName || userId || email,
        note: 'Searching by firstName + lastName combined, userId, or email'
      });
    }

    user = userRows[0];
    // Handle both id and userId columns (User table has both)
    const userIdFromDb = user.id; // Use the primary id column as it's what UPDATE uses

    // Hash the password using bcryptjs
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the user's password
    await db.$executeRawUnsafe(
      `UPDATE "User" SET "password" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      hashedPassword,
      userIdFromDb
    );

    console.log(`✅ Password set for user: ${user.firstName} ${user.lastName} (${userIdFromDb})`);
    
    res.json({ 
      success: true, 
      message: `Password set successfully for ${user.firstName} ${user.lastName}`,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('❌ POST /api/admin/set-user-password error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to set password',
      details: error.toString()
    });
  }
});

// GET /api/admin/list-users - List all users (for debugging/user ID lookup)
app.get('/api/admin/list-users', async (req, res) => {
  try {
    const db = await getPrisma();
    const users = await db.$queryRawUnsafe(`
      SELECT id, userId, username, email, firstName, lastName, isActive, role 
      FROM "User" 
      WHERE isActive = true 
      ORDER BY firstName, lastName
    `);
    res.json({ success: true, users });
  } catch (error) {
    console.error('❌ GET /api/admin/list-users error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.toString()
    });
  }
});

// POST /api/admin/set-user-password-by-id - Set password using direct userId
app.post('/api/admin/set-user-password-by-id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, password } = req.body;

    if (!userId || !password || password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId (password >= 8 chars)' 
      });
    }

    // Use bcryptjs to hash the password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update by userId (the unique userId field, not id)
    await db.$executeRawUnsafe(
      `UPDATE "User" SET "password" = $1, "updatedAt" = NOW() WHERE "userId" = $2`,
      hashedPassword,
      userId
    );

    console.log(`✅ Password set for userId: ${userId}`);
    
    res.json({ 
      success: true, 
      message: `Password set successfully for userId ${userId}`
    });
  } catch (error) {
    console.error('❌ POST /api/admin/set-user-password-by-id error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to set password',
      details: error.toString()
    });
  }
});

// GET /api/admin/seed-syllabus - One-click seed endpoint (browser URL)
// DELETE /api/admin/purge-inactive - Hard delete all soft-deleted (isActive=false) syllabus items
app.delete('/api/admin/purge-inactive', async (req, res) => {
  try {
    const db = await getPrisma();
    await db.$executeRawUnsafe(
      `DELETE FROM "SyllabusItem" WHERE "isActive" = false`
    );
    console.log(`✅ Purged inactive syllabus items`);
    res.json({ success: true, message: 'Purged all inactive (soft-deleted) syllabus items' });
  } catch (error) {
    console.error('❌ purge-inactive error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/seed-syllabus', async (req, res) => {
  const SEED_SECRET = requireConfiguredSecret('SEED_SECRET', 'dfp-seed-development-only');
  const { secret, force } = req.query;

  if (secret !== SEED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Provide ?secret=YOUR_SECRET' });
  }

  try {
    const db = await getPrisma();

    // Check if already seeded
    const countRows = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "SyllabusItem"`);
    const existingCount = countRows[0].count;

    if (existingCount > 0 && force !== 'true') {
      return res.json({
        success: true,
        message: `Database already has ${existingCount} syllabus items. Use ?force=true to re-seed.`,
        count: existingCount,
        skipped: true,
      });
    }

    if (force === 'true' && existingCount > 0) {
      await db.$executeRawUnsafe(`DELETE FROM "SyllabusHistory"`);
      await db.$executeRawUnsafe(`DELETE FROM "SyllabusItem"`);
      console.log(`🗑️ Cleared existing syllabus data (force re-seed)`);
    }

    const { randomUUID } = await import('crypto');
    const now = new Date().toISOString();

    const items = [
      // BGF
      { code: 'BGF_GND_001', eventDescription: 'Air Law and Regulations', phase: 'Basic Ground Flying', module: 'BGF', type: 'Ground', courses: ['BGF'], sortOrder: 10, totalEventHours: 2, duration: 2 },
      { code: 'BGF_GND_002', eventDescription: 'Meteorology Fundamentals', phase: 'Basic Ground Flying', module: 'BGF', type: 'Ground', courses: ['BGF'], sortOrder: 20, totalEventHours: 2, duration: 2 },
      { code: 'BGF_GND_003', eventDescription: 'Navigation Principles', phase: 'Basic Ground Flying', module: 'BGF', type: 'Ground', courses: ['BGF'], sortOrder: 30, totalEventHours: 2, duration: 2 },
      { code: 'BGF_GND_004', eventDescription: 'Aircraft Systems - General', phase: 'Basic Ground Flying', module: 'BGF', type: 'Ground', courses: ['BGF'], sortOrder: 40, totalEventHours: 2, duration: 2 },
      { code: 'BGF_GND_005', eventDescription: 'Flight Planning Basics', phase: 'Basic Ground Flying', module: 'BGF', type: 'Ground', courses: ['BGF'], sortOrder: 50, totalEventHours: 2, duration: 2 },
      { code: 'BGF_SIM_001', eventDescription: 'Simulator Familiarisation', phase: 'Basic Ground Flying', module: 'BGF', type: 'Simulator', courses: ['BGF'], sortOrder: 60, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_SIM_002', eventDescription: 'Basic Aircraft Handling - Simulator', phase: 'Basic Ground Flying', module: 'BGF', type: 'Simulator', courses: ['BGF'], sortOrder: 70, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_001', eventDescription: 'Aircraft Familiarisation', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 80, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_002', eventDescription: 'Effects of Controls', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 90, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_003', eventDescription: 'Straight and Level Flight', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 100, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_004', eventDescription: 'Climbing and Descending', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 110, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_005', eventDescription: 'Medium Level Turns', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 120, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_006', eventDescription: 'Stalling', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 130, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_007', eventDescription: 'Circuit Training', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 140, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_008', eventDescription: 'First Solo', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 150, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_009', eventDescription: 'Advanced Circuits', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 160, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_010', eventDescription: 'Navigation Exercise 1', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 170, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_011', eventDescription: 'Navigation Exercise 2', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 180, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_012', eventDescription: 'BGF Progress Check', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 190, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BGF_FLT_013', eventDescription: 'BGF Final Handling Test', phase: 'Basic Ground Flying', module: 'BGF', type: 'Flying', courses: ['BGF'], sortOrder: 200, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      // BIF
      { code: 'BIF_GND_001', eventDescription: 'Instrument Flight Rules Theory', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Ground', courses: ['BIF'], sortOrder: 210, totalEventHours: 2, duration: 2 },
      { code: 'BIF_GND_002', eventDescription: 'Instrument Meteorological Conditions', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Ground', courses: ['BIF'], sortOrder: 220, totalEventHours: 2, duration: 2 },
      { code: 'BIF_GND_003', eventDescription: 'Instrument Scanning Techniques', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Ground', courses: ['BIF'], sortOrder: 230, totalEventHours: 2, duration: 2 },
      { code: 'BIF_SIM_001', eventDescription: 'Instrument Flying - Simulator 1', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Simulator', courses: ['BIF'], sortOrder: 240, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_SIM_002', eventDescription: 'Instrument Flying - Simulator 2', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Simulator', courses: ['BIF'], sortOrder: 250, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_SIM_003', eventDescription: 'Instrument Flying - Simulator 3', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Simulator', courses: ['BIF'], sortOrder: 260, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_001', eventDescription: 'Basic Instrument Flying 1', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 270, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_002', eventDescription: 'Basic Instrument Flying 2', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 280, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_003', eventDescription: 'Basic Instrument Flying 3', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 290, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_004', eventDescription: 'Instrument Navigation Exercise', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 300, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_005', eventDescription: 'BIF Progress Check', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 310, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BIF_FLT_006', eventDescription: 'BIF Final Instrument Test', phase: 'Basic Instrument Flying', module: 'BIF', type: 'Flying', courses: ['BIF'], sortOrder: 320, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      // BNF
      { code: 'BNF_GND_001', eventDescription: 'Advanced Navigation Theory', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Ground', courses: ['BNF'], sortOrder: 330, totalEventHours: 2, duration: 2 },
      { code: 'BNF_GND_002', eventDescription: 'Map Reading and Chart Work', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Ground', courses: ['BNF'], sortOrder: 340, totalEventHours: 2, duration: 2 },
      { code: 'BNF_SIM_001', eventDescription: 'Navigation Simulator Exercise 1', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Simulator', courses: ['BNF'], sortOrder: 350, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_SIM_002', eventDescription: 'Navigation Simulator Exercise 2', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Simulator', courses: ['BNF'], sortOrder: 360, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_001', eventDescription: 'Solo Navigation Exercise 1', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 370, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_002', eventDescription: 'Solo Navigation Exercise 2', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 380, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_003', eventDescription: 'Navigation Cross Country 1', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 390, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_004', eventDescription: 'Navigation Cross Country 2', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 400, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_005', eventDescription: 'BNF Progress Check', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 410, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNF_FLT_006', eventDescription: 'BNF Final Navigation Test', phase: 'Basic Navigation Flying', module: 'BNF', type: 'Flying', courses: ['BNF'], sortOrder: 420, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      // BNAV
      { code: 'BNAV_GND_001', eventDescription: 'Advanced Navigation Systems', phase: 'Basic Navigation', module: 'BNAV', type: 'Ground', courses: ['BNAV'], sortOrder: 430, totalEventHours: 2, duration: 2 },
      { code: 'BNAV_GND_002', eventDescription: 'GPS and Electronic Navigation', phase: 'Basic Navigation', module: 'BNAV', type: 'Ground', courses: ['BNAV'], sortOrder: 440, totalEventHours: 2, duration: 2 },
      { code: 'BNAV_GND_003', eventDescription: 'Flight Planning - Advanced', phase: 'Basic Navigation', module: 'BNAV', type: 'Ground', courses: ['BNAV'], sortOrder: 450, totalEventHours: 2, duration: 2 },
      { code: 'BNAV_SIM_001', eventDescription: 'Advanced Navigation Simulator 1', phase: 'Basic Navigation', module: 'BNAV', type: 'Simulator', courses: ['BNAV'], sortOrder: 460, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNAV_SIM_002', eventDescription: 'Advanced Navigation Simulator 2', phase: 'Basic Navigation', module: 'BNAV', type: 'Simulator', courses: ['BNAV'], sortOrder: 470, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNAV_FLT_001', eventDescription: 'Advanced Navigation Flight 1', phase: 'Basic Navigation', module: 'BNAV', type: 'Flying', courses: ['BNAV'], sortOrder: 480, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNAV_FLT_002', eventDescription: 'Advanced Navigation Flight 2', phase: 'Basic Navigation', module: 'BNAV', type: 'Flying', courses: ['BNAV'], sortOrder: 490, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'BNAV_FLT_003', eventDescription: 'BNAV Final Test', phase: 'Basic Navigation', module: 'BNAV', type: 'Flying', courses: ['BNAV'], sortOrder: 500, flightOrSimHours: 2, totalEventHours: 3, duration: 3, preFlightTime: 0.5, postFlightTime: 0.5 },
      // FIC
      { code: 'FIC_GND_001', eventDescription: 'Instructional Techniques', phase: 'Flight Instructor Course', module: 'FIC', type: 'Ground', courses: ['FIC'], sortOrder: 510, totalEventHours: 2, duration: 2 },
      { code: 'FIC_GND_002', eventDescription: 'Teaching and Learning Theory', phase: 'Flight Instructor Course', module: 'FIC', type: 'Ground', courses: ['FIC'], sortOrder: 520, totalEventHours: 2, duration: 2 },
      { code: 'FIC_GND_003', eventDescription: 'Lesson Planning', phase: 'Flight Instructor Course', module: 'FIC', type: 'Ground', courses: ['FIC'], sortOrder: 530, totalEventHours: 2, duration: 2 },
      { code: 'FIC_GND_004', eventDescription: 'Airmanship and Airspace', phase: 'Flight Instructor Course', module: 'FIC', type: 'Ground', courses: ['FIC'], sortOrder: 540, totalEventHours: 2, duration: 2 },
      { code: 'FIC_SIM_001', eventDescription: 'Instructional Simulator Exercise 1', phase: 'Flight Instructor Course', module: 'FIC', type: 'Simulator', courses: ['FIC'], sortOrder: 550, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_SIM_002', eventDescription: 'Instructional Simulator Exercise 2', phase: 'Flight Instructor Course', module: 'FIC', type: 'Simulator', courses: ['FIC'], sortOrder: 560, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_001', eventDescription: 'Instructional Flying - Effects of Controls', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 570, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_002', eventDescription: 'Instructional Flying - Circuits', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 580, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_003', eventDescription: 'Instructional Flying - Navigation', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 590, flightOrSimHours: 1.5, totalEventHours: 2.5, duration: 2.5, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_004', eventDescription: 'Instructional Flying - Instruments', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 600, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_005', eventDescription: 'FIC Progress Check', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 610, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
      { code: 'FIC_FLT_006', eventDescription: 'FIC Final Handling Test', phase: 'Flight Instructor Course', module: 'FIC', type: 'Flying', courses: ['FIC'], sortOrder: 620, flightOrSimHours: 1, totalEventHours: 2, duration: 2, preFlightTime: 0.5, postFlightTime: 0.5 },
    ];

    let created = 0;
    const errors = [];

    for (const item of items) {
      try {
        const id = randomUUID();
        await db.$executeRawUnsafe(`
          INSERT INTO "SyllabusItem" (
            "id","code","eventDescription","phase","module","type","sortieType","dayNight",
            "courses","methodOfDelivery","methodOfAssessment","resourcesPhysical","resourcesHuman",
            "eventDetailsCommon","eventDetailsSortie","flightOrSimHours","totalEventHours","duration",
            "preFlightTime","postFlightTime","prerequisites","prerequisitesGround","prerequisitesFlying",
            "location","sortOrder","lmpType","twrDiReqd","cctOnly","isRemedial","isActive","version",
            "notes","createdBy","createdAt","updatedAt"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,
            $26,$27,$28,$29,$30,$31,
            $32,$33,NOW(),NOW()
          )`,
          id, item.code, item.eventDescription, item.phase, item.module, item.type,
          null, 'Day',
          item.courses, ['Instructor Led'], ['Instructor Assessment'],
          [], ['QFI'],
          [], [],
          item.flightOrSimHours || 0, item.totalEventHours || 1, item.duration || 1,
          item.preFlightTime || 0, item.postFlightTime || 0,
          [], [], [],
          null, item.sortOrder || 0,
          null, null, null,
          false, true, 1,
          null, 'seed'
        );
        created++;
      } catch (err) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    console.log(`✅ GET /api/admin/seed-syllabus - seeded ${created} items`);
    res.json({
      success: true,
      message: `Successfully seeded ${created} syllabus items`,
      created,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('❌ GET /api/admin/seed-syllabus error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// SERVE STATIC VITE BUILD
// ============================================================

// Serve the flight-school-app static files
// Serve at BOTH root and /flight-school-app/ prefix so relative asset paths work
// regardless of which URL the app is accessed from.
const staticPath = path.join(__dirname, 'dfp-neo-platform/public/flight-school-app');
if (fs.existsSync(staticPath)) {
  // Force no-cache for ALL assets and HTML so browsers always fetch the latest build
  // This prevents stale JS/CSS being served after a deployment
  const noCacheMiddleware = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
  app.use(noCacheMiddleware);
  app.use(express.static(staticPath));
  app.use('/flight-school-app', noCacheMiddleware);
  app.use('/flight-school-app', express.static(staticPath));
  console.log(`✅ Serving static files from: ${staticPath} (at / and /flight-school-app/) with no-cache headers for all assets`);
}

// ============================================================
// AIRCRAFT AVAILABILITY & CANCELLATION CODES ENDPOINTS
// ============================================================

// Create AircraftAvailabilityHistory table if it doesn't exist
// ============================================================
// APP SETTINGS TABLE — CREATE IF NOT EXISTS
// ============================================================
async function ensureAppSettingsTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppSettings" (
        "id"        TEXT        NOT NULL,
        "orgId"     TEXT        NOT NULL,
        "data"      JSONB       NOT NULL DEFAULT '{}',
        "updatedBy" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_orgId_key"
      ON "AppSettings"("orgId");
    `);
    console.log('✅ AppSettings table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AppSettings table:', err.message);
  }
}

async function ensureCommercialConfigTables(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialOrganisation" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialOrganisation_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialOrganisation_code_key" ON "CommercialOrganisation"("code");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialLocation" (
        "id" TEXT NOT NULL,
        "organisationCode" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "iataCode" TEXT,
        "name" TEXT NOT NULL,
        "timezoneOffset" DOUBLE PRECISION NOT NULL DEFAULT 10,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "timezone" TEXT,
        "trainingAreas" TEXT[] NOT NULL DEFAULT '{}',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialLocation_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialLocation" ALTER COLUMN "timezoneOffset" TYPE DOUBLE PRECISION USING "timezoneOffset"::DOUBLE PRECISION;`);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialLocation" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;`);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialLocation" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;`);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialLocation" ADD COLUMN IF NOT EXISTS "timezone" TEXT;`);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialLocation" ADD COLUMN IF NOT EXISTS "iataCode" TEXT;`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialLocation_code_key" ON "CommercialLocation"("code");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialLocation_organisationCode_idx" ON "CommercialLocation"("organisationCode");`);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialUnit" (
        "id" TEXT NOT NULL,
        "organisationCode" TEXT NOT NULL,
        "locationCode" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "unitType" TEXT NOT NULL DEFAULT 'Training',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialUnit_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialUnit_code_key" ON "CommercialUnit"("code");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUnit_locationCode_idx" ON "CommercialUnit"("locationCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUnit_unitType_idx" ON "CommercialUnit"("unitType");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialAircraftType" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'Training',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialAircraftType_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialAircraftType_code_key" ON "CommercialAircraftType"("code");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialResourcePool" (
        "id" TEXT NOT NULL,
        "organisationCode" TEXT NOT NULL,
        "locationCode" TEXT,
        "unitCode" TEXT,
        "aircraftTypeCode" TEXT,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "poolType" TEXT NOT NULL DEFAULT 'Dedicated',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialResourcePool_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialResourcePool_code_key" ON "CommercialResourcePool"("code");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialResourcePool_unitCode_idx" ON "CommercialResourcePool"("unitCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialResourcePool_locationCode_idx" ON "CommercialResourcePool"("locationCode");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialModule" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialModule_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialModule_code_key" ON "CommercialModule"("code");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialUnitModule" (
        "id" TEXT NOT NULL,
        "unitCode" TEXT NOT NULL,
        "moduleCode" TEXT NOT NULL,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialUnitModule_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialUnitModule_unitCode_moduleCode_key" ON "CommercialUnitModule"("unitCode", "moduleCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUnitModule_unitCode_idx" ON "CommercialUnitModule"("unitCode");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialLicense" (
        "id" TEXT NOT NULL,
        "organisationCode" TEXT NOT NULL,
        "licenseKey" TEXT NOT NULL,
        "licenseName" TEXT NOT NULL,
        "deploymentMode" TEXT NOT NULL DEFAULT 'Online SaaS',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "validFrom" TIMESTAMP(3),
        "validUntil" TIMESTAMP(3),
        "maxUsers" INTEGER,
        "maxUnits" INTEGER,
        "maxAircraftTypes" INTEGER,
        "moduleCodes" TEXT[] NOT NULL DEFAULT '{}',
        "features" JSONB NOT NULL DEFAULT '{}',
        "offlineFingerprint" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialLicense_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialLicense_licenseKey_key" ON "CommercialLicense"("licenseKey");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialLicense_organisationCode_idx" ON "CommercialLicense"("organisationCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialLicense_status_idx" ON "CommercialLicense"("status");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialUserAccess" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "username" TEXT,
        "displayName" TEXT,
        "organisationCode" TEXT NOT NULL DEFAULT 'DEFAULT',
        "locationCode" TEXT,
        "unitCode" TEXT,
        "moduleCode" TEXT,
        "scopeKey" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'Viewer',
        "accessLevel" TEXT NOT NULL DEFAULT 'Read',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "settings" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialUserAccess_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialUserAccess" ADD COLUMN IF NOT EXISTS "scopeKey" TEXT;`);
    await db.$executeRawUnsafe(`UPDATE "CommercialUserAccess" SET "scopeKey" = "userId" || '|' || "organisationCode" || '|' || COALESCE("locationCode", '') || '|' || COALESCE("unitCode", '') || '|' || COALESCE("moduleCode", '') WHERE "scopeKey" IS NULL OR "scopeKey" = '';`);
    await db.$executeRawUnsafe(`ALTER TABLE "CommercialUserAccess" ALTER COLUMN "scopeKey" SET NOT NULL;`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CommercialUserAccess_scopeKey_key" ON "CommercialUserAccess"("scopeKey");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUserAccess_userId_idx" ON "CommercialUserAccess"("userId");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUserAccess_locationCode_idx" ON "CommercialUserAccess"("locationCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUserAccess_unitCode_idx" ON "CommercialUserAccess"("unitCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialUserAccess_moduleCode_idx" ON "CommercialUserAccess"("moduleCode");`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CommercialSchedulingRuleSet" (
        "id" TEXT NOT NULL,
        "organisationCode" TEXT NOT NULL,
        "unitCode" TEXT,
        "aircraftTypeCode" TEXT,
        "name" TEXT NOT NULL,
        "scope" TEXT NOT NULL DEFAULT 'Unit',
        "rules" JSONB NOT NULL DEFAULT '{}',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommercialSchedulingRuleSet_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialSchedulingRuleSet_unitCode_idx" ON "CommercialSchedulingRuleSet"("unitCode");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommercialSchedulingRuleSet_aircraftTypeCode_idx" ON "CommercialSchedulingRuleSet"("aircraftTypeCode");`);

    await seedCommercialConfigIfEmpty(db);
    await migrateKnownCommercialLocationCodes(db);
    await seedCommercialLicenseIfEmpty(db);
    await seedCommercialUserAccessIfEmpty(db);
    console.log('✅ Commercial platform configuration tables ready');
  } catch (err) {
    console.error('❌ Failed to ensure commercial platform configuration tables:', err.message);
  }
}

async function migrateKnownCommercialLocationCodes(db) {
  for (const profile of KNOWN_AIRFIELD_IDENTITIES) {
    if (profile.legacyCode === profile.icaoCode) continue;

    const existingIcaoRows = await db.$queryRawUnsafe(
      `SELECT "code" FROM "CommercialLocation" WHERE "code" = $1 LIMIT 1`,
      profile.icaoCode,
    );

    if (existingIcaoRows.length === 0) {
      await db.$executeRawUnsafe(`
        UPDATE "CommercialLocation"
        SET
          "code" = $2,
          "iataCode" = COALESCE(NULLIF("iataCode", ''), $3),
          "latitude" = COALESCE("latitude", $4),
          "longitude" = COALESCE("longitude", $5),
          "timezone" = COALESCE(NULLIF("timezone", ''), $6),
          "updatedAt" = "updatedAt"
        WHERE "code" = $1
      `, profile.legacyCode, profile.icaoCode, profile.iataCode, profile.latitude, profile.longitude, profile.timezone);
    } else {
      await db.$executeRawUnsafe(`
        UPDATE "CommercialLocation"
        SET
          "iataCode" = COALESCE(NULLIF("iataCode", ''), $2),
          "latitude" = COALESCE("latitude", $3),
          "longitude" = COALESCE("longitude", $4),
          "timezone" = COALESCE(NULLIF("timezone", ''), $5),
          "updatedAt" = "updatedAt"
        WHERE "code" = $1
      `, profile.icaoCode, profile.iataCode, profile.latitude, profile.longitude, profile.timezone);

      await db.$executeRawUnsafe(`
        UPDATE "CommercialLocation"
        SET
          "iataCode" = COALESCE(NULLIF("iataCode", ''), $2),
          "status" = CASE WHEN "status" = 'ACTIVE' THEN 'INACTIVE' ELSE "status" END,
          "updatedAt" = "updatedAt"
        WHERE "code" = $1
      `, profile.legacyCode, profile.iataCode);
    }

    for (const tableName of ['CommercialUnit', 'CommercialResourcePool', 'CommercialUserAccess']) {
      await db.$executeRawUnsafe(`
        UPDATE "${tableName}"
        SET "locationCode" = $2, "updatedAt" = "updatedAt"
        WHERE "locationCode" = $1
      `, profile.legacyCode, profile.icaoCode);
    }
  }

  await db.$executeRawUnsafe(`
    UPDATE "CommercialUserAccess"
    SET "scopeKey" = "userId" || '|' || "organisationCode" || '|' || COALESCE("locationCode", '') || '|' || COALESCE("unitCode", '') || '|' || COALESCE("moduleCode", '')
    WHERE "scopeKey" IS NULL OR "scopeKey" = '' OR "scopeKey" LIKE '%|ESL|%' OR "scopeKey" LIKE '%|PEA|%' OR "scopeKey" LIKE '%|WLM|%' OR "scopeKey" LIKE '%|AMB|%' OR "scopeKey" LIKE '%|TIN|%' OR "scopeKey" LIKE '%|EDI|%'
  `);
}

async function seedCommercialLicenseIfEmpty(db) {
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialLicense"`);
  if (existing?.[0]?.count > 0) return;

  const now = new Date().toISOString();
  const organisations = await db.$queryRawUnsafe(`
    SELECT "code", "name"
    FROM "CommercialOrganisation"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);
  const organisation = organisations?.[0] || { code: 'DEFAULT', name: 'Default Organisation' };
  const modules = await db.$queryRawUnsafe(`
    SELECT "code"
    FROM "CommercialModule"
    WHERE "status" = 'ACTIVE'
    ORDER BY "code"
  `);
  const moduleCodes = modules.map((module) => module.code).filter(Boolean);
  const organisationCode = organisation.code || 'DEFAULT';
  const organisationName = organisation.name || organisationCode;

  await db.$executeRawUnsafe(`
    INSERT INTO "CommercialLicense" (
      "id", "organisationCode", "licenseKey", "licenseName", "deploymentMode", "status",
      "validFrom", "validUntil", "maxUsers", "maxUnits", "maxAircraftTypes", "moduleCodes",
      "features", "offlineFingerprint", "notes", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, $1, $2, $3, 'Online SaaS', 'ACTIVE',
      NULL, NULL, NULL, NULL, NULL, $4::text[], $5::jsonb, NULL, $6, $7::timestamp, $7::timestamp
    )
    ON CONFLICT ("licenseKey") DO NOTHING
  `,
    organisationCode,
    `${organisationCode}-EVAL`,
    `${organisationName} Evaluation Licence`,
    moduleCodes,
    JSON.stringify({
      enforcementMode: 'Monitor Only',
      offlineCapable: false,
      developmentOnly: true,
      seededBy: 'Development licensing foundation',
    }),
    'Development licensing foundation record. Use signed licence files for production or offline customer deployments.',
    now
  );
}

async function seedCommercialUserAccessIfEmpty(db) {
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialUserAccess"`);
  if (existing?.[0]?.count > 0) return;

  const now = new Date().toISOString();
  const users = await db.$queryRawUnsafe(`SELECT id, "userId", username, "firstName", "lastName", role FROM "User" WHERE "isActive" = true`);
  const locations = await db.$queryRawUnsafe(`SELECT "code" FROM "CommercialLocation" WHERE "status" = 'ACTIVE'`);

  for (const user of users) {
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.userId;
    const elevated = ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role || '').toUpperCase());
    const accessRole = elevated ? 'Platform Admin' : 'Viewer';
    const accessLevel = elevated ? 'Admin' : 'Read';

    for (const location of locations) {
      const scopeKey = `${user.userId}|DEFAULT|${location.code}||`;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUserAccess" ("id", "userId", "username", "displayName", "organisationCode", "locationCode", "unitCode", "moduleCode", "scopeKey", "role", "accessLevel", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, 'DEFAULT', $4, NULL, NULL, $5, $6, $7, 'ACTIVE', '{}'::jsonb, $8::timestamp, $8::timestamp)
        ON CONFLICT ("scopeKey") DO NOTHING
      `, user.userId, user.username, displayName, location.code, scopeKey, accessRole, accessLevel, now);
    }
  }
}

async function seedCommercialConfigIfEmpty(db) {
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialOrganisation"`);
  if (existing?.[0]?.count > 0) return;

  const settingsRows = await db.$queryRawUnsafe(`SELECT data FROM "AppSettings" WHERE "orgId" = 'default' LIMIT 1`);
  const settings = settingsRows?.[0]?.data || {};
  const now = new Date().toISOString();
  const locationNames = Array.isArray(settings.locations) && settings.locations.length > 0 ? settings.locations : ['East Sale'];
  const abbreviations = settings.locationAbbreviations || {};
  const units = Array.isArray(settings.units) && settings.units.length > 0 ? settings.units : ['Training Unit'];
  const unitLocations = settings.unitLocations || {};
  const locationOpAreas = settings.locationOpAreas || {};
  const timezoneOffset = Number(settings.timezoneOffset ?? 10);

  const locationIdentityFor = (name) => {
    const explicit = abbreviations[name];
    const profile = getDefaultAirfieldSolarProfile(explicit) || getDefaultAirfieldSolarProfile(name);
    const fallbackCode = String(explicit || name || 'LOC')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'LOC';
    return {
      code: String(profile?.icao || fallbackCode).toUpperCase(),
      iataCode: String(profile?.iataCode || profile?.code || (String(explicit || '').length === 3 ? explicit : '') || '').toUpperCase(),
      profile: profile || null,
    };
  };
  const unitCodeFor = (name) => String(name || 'UNIT').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase() || 'UNIT';

  await db.$executeRawUnsafe(`
    INSERT INTO "CommercialOrganisation" ("id", "code", "name", "status", "settings", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'DEFAULT', 'Default Organisation', 'ACTIVE', $1::jsonb, $2::timestamp, $2::timestamp)
    ON CONFLICT ("code") DO NOTHING
  `, JSON.stringify({ source: 'V2 stage-one seed' }), now);

  for (const locationName of locationNames) {
    const identity = locationIdentityFor(locationName);
    const solar = identity.profile || {};
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialLocation" ("id", "organisationCode", "code", "iataCode", "name", "timezoneOffset", "latitude", "longitude", "timezone", "trainingAreas", "status", "settings", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'DEFAULT', $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', '{}'::jsonb, $9::timestamp, $9::timestamp)
      ON CONFLICT ("code") DO NOTHING
    `, identity.code, identity.iataCode || null, locationName, timezoneOffset, solar.latitude ?? null, solar.longitude ?? null, solar.timezone ?? null, Array.isArray(locationOpAreas[locationName]) ? locationOpAreas[locationName] : [], now);
  }

  for (const unitName of units) {
    const mappedLocationName = unitLocations[unitName] || locationNames[0];
    const locationCode = locationIdentityFor(mappedLocationName).code;
    const unitCode = unitCodeFor(unitName);
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialUnit" ("id", "organisationCode", "locationCode", "code", "name", "unitType", "status", "settings", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'DEFAULT', $1, $2, $3, 'Training', 'ACTIVE', $4::jsonb, $5::timestamp, $5::timestamp)
      ON CONFLICT ("code") DO NOTHING
    `, locationCode, unitCode, unitName, JSON.stringify({ sourceUnitName: unitName }), now);
  }

  await db.$executeRawUnsafe(`
    INSERT INTO "CommercialAircraftType" ("id", "code", "name", "category", "status", "settings", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'PC-21', 'PC-21', 'Training', 'ACTIVE', $1::jsonb, $2::timestamp, $2::timestamp)
    ON CONFLICT ("code") DO NOTHING
  `, JSON.stringify({ source: 'Current V2 default aircraft type' }), now);

  for (const locationName of locationNames) {
    const locationCode = locationIdentityFor(locationName).code;
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialResourcePool" ("id", "organisationCode", "locationCode", "unitCode", "aircraftTypeCode", "code", "name", "poolType", "status", "settings", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'DEFAULT', $1, NULL, 'PC-21', $2, $3, 'Shared', 'ACTIVE', $4::jsonb, $5::timestamp, $5::timestamp)
      ON CONFLICT ("code") DO NOTHING
    `, locationCode, `${locationCode}-PC21-POOL`, `${locationName} PC-21 Resource Pool`, JSON.stringify({
      applyToV2Runtime: false,
      aircraftLabel: 'PC-21',
      aircraftNumberUsePrefix: true,
      aircraftNumberPrefixes: ['A54'],
      aircraftNumberDefaultPrefix: 'A54',
      ftdLabel: 'FTD',
      cptLabel: 'CPT',
      aircraft: Number(settings.availableAircraftCount ?? 24),
      ftd: Number(settings.availableFtdCount ?? 5),
      cpt: Number(settings.availableCptCount ?? 5),
      standby: 4,
      ground: 6,
    }), now);
  }

  const modules = [
    ['DFP', 'Daily Flying Program', 'Core schedule, authorisation and publication workflow'],
    ['TRAINING', 'Training', 'Courses, trainees, syllabus progression and PT-051 records'],
    ['NEO_BUILD', 'NEO Build', 'Automated training build algorithm'],
    ['RESOURCE_SCHEDULING', 'Resource Scheduling', 'Aircraft, simulator, procedural trainer and ground resource allocation'],
    ['REPORTING', 'Reporting & Analytics', 'Operational reports, history, audit and analytics'],
  ];
  for (const [code, name, description] of modules) {
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialModule" ("id", "code", "name", "description", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACTIVE', $4::timestamp, $4::timestamp)
      ON CONFLICT ("code") DO UPDATE SET "name" = $2, "description" = $3, "updatedAt" = $4::timestamp
    `, code, name, description, now);
  }

  const seededUnits = await db.$queryRawUnsafe(`SELECT "code" FROM "CommercialUnit"`);
  for (const unit of seededUnits) {
    for (const [moduleCode] of modules) {
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUnitModule" ("id", "unitCode", "moduleCode", "isEnabled", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, true, '{}'::jsonb, $3::timestamp, $3::timestamp)
        ON CONFLICT ("unitCode", "moduleCode") DO NOTHING
      `, unit.code, moduleCode, now);
    }

    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialSchedulingRuleSet" ("id", "organisationCode", "unitCode", "aircraftTypeCode", "name", "scope", "rules", "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'DEFAULT', $1, 'PC-21', $2, 'Unit', $3::jsonb, true, $4::timestamp, $4::timestamp)
    `, unit.code, `${unit.code} Default Scheduling Rules`, JSON.stringify({
      preferredDutyPeriod: settings.preferredDutyPeriod ?? 10,
      maxCrewDutyPeriod: settings.maxCrewDutyPeriod ?? 12,
      maxDispatchPerHour: settings.maxDispatchPerHour ?? 4,
      flightTurnaround: settings.flightTurnaround ?? 0.5,
      ftdTurnaround: settings.ftdTurnaround ?? 0.25,
      cptTurnaround: settings.cptTurnaround ?? 0.25,
      eventLimits: settings.eventLimits || {},
      flyingWindows: {
        flyingStartTime: settings.flyingStartTime,
        flyingEndTime: settings.flyingEndTime,
        allowNightFlying: settings.allowNightFlying,
        commenceNightFlying: settings.commenceNightFlying,
        ceaseNightFlying: settings.ceaseNightFlying,
      },
    }), now);
  }

  const users = await db.$queryRawUnsafe(`SELECT id, "userId", username, "firstName", "lastName", role FROM "User" WHERE "isActive" = true`);
  const seededLocations = await db.$queryRawUnsafe(`SELECT "code" FROM "CommercialLocation" WHERE "status" = 'ACTIVE'`);
  for (const user of users) {
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.userId;
    const accessRole = ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role || '').toUpperCase()) ? 'Platform Admin' : 'Viewer';
    const accessLevel = ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role || '').toUpperCase()) ? 'Admin' : 'Read';
    for (const location of seededLocations) {
      const scopeKey = `${user.userId}|DEFAULT|${location.code}||`;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUserAccess" ("id", "userId", "username", "displayName", "organisationCode", "locationCode", "unitCode", "moduleCode", "scopeKey", "role", "accessLevel", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, 'DEFAULT', $4, NULL, NULL, $5, $6, $7, 'ACTIVE', '{}'::jsonb, $8::timestamp, $8::timestamp)
        ON CONFLICT ("scopeKey") DO NOTHING
      `, user.userId, user.username, displayName, location.code, scopeKey, accessRole, accessLevel, now);
    }
  }
}

async function ensureCourseSettingsTables(db) {
  try {
    // CourseSettings: stores neoBuildCourse + selectedAcademicLmp + excludedCourses
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseSettings" (
        "id"                  TEXT         NOT NULL,
        "neoBuildCourse"      TEXT,
        "selectedAcademicLmp" TEXT,
        "excludedCourses"     TEXT         NOT NULL DEFAULT '[]',
        "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CourseSettings_pkey" PRIMARY KEY ("id")
      );
    `);
    // Migration safety: add columns if table was created without them
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "CourseSettings" ADD COLUMN IF NOT EXISTS "selectedAcademicLmp" TEXT;
      `);
    } catch (_) {}
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "CourseSettings" ADD COLUMN IF NOT EXISTS "excludedCourses" TEXT NOT NULL DEFAULT '[]';
      `);
    } catch (_) {}
    console.log('✅ CourseSettings table ready');

    // CourseAcademicProgress: tracks which lessons have been completed per course cohort
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseAcademicProgress" (
        "id"            TEXT         NOT NULL,
        "courseCode"    TEXT         NOT NULL,
        "lessonCode"    TEXT         NOT NULL,
        "completedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedBy"   TEXT,
        CONSTRAINT "CourseAcademicProgress_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CourseAcademicProgress_courseCode_lessonCode_key"
      ON "CourseAcademicProgress"("courseCode", "lessonCode");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CourseAcademicProgress_courseCode_idx"
      ON "CourseAcademicProgress"("courseCode");
    `);
    console.log('✅ CourseAcademicProgress table ready');
  } catch (err) {
    console.error('❌ Failed to ensure CourseSettings tables:', err.message);
  }
}

async function ensureCourseLmpTypeColumn(db) {
  try {
    // Add lmpType column to Course table if it doesn't exist (migration for existing DBs)
    await db.$executeRawUnsafe(`
      ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lmpType" TEXT NOT NULL DEFAULT '';
    `);
    console.log('✅ Course.lmpType column ready');
  } catch (err) {
    console.error('❌ Failed to ensure Course.lmpType column:', err.message);
  }
}

async function ensureAcademicLmpTypeColumns(db) {
  try {
    // Add academicLmpType column to Trainee table if it doesn't exist
    await db.$executeRawUnsafe(`
      ALTER TABLE "Trainee" ADD COLUMN IF NOT EXISTS "academicLmpType" TEXT NOT NULL DEFAULT '';
    `);
    console.log('✅ Trainee.academicLmpType column ready');
  } catch (err) {
    console.error('❌ Failed to ensure Trainee.academicLmpType column:', err.message);
  }
  try {
    // Add academicLmpType column to Course table if it doesn't exist
    await db.$executeRawUnsafe(`
      ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "academicLmpType" TEXT NOT NULL DEFAULT '';
    `);
    console.log('✅ Course.academicLmpType column ready');
  } catch (err) {
    console.error('❌ Failed to ensure Course.academicLmpType column:', err.message);
  }
}

async function ensureAircraftAvailabilityTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityHistory" (
        "id" SERIAL NOT NULL,
        "date" TEXT NOT NULL,
        "totalFleet" INTEGER NOT NULL DEFAULT 0,
        "dailyAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "flyingWindowStart" TEXT,
        "flyingWindowEnd" TEXT,
        "lastCalculatedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AircraftAvailabilityHistory_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_date_key"
      ON "AircraftAvailabilityHistory"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_date_idx"
      ON "AircraftAvailabilityHistory"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_createdAt_idx"
      ON "AircraftAvailabilityHistory"("createdAt");
    `);
    // Add missing columns if they don't exist (migration)
    try {
      await db.$executeRawUnsafe(`
          ALTER TABLE "AircraftAvailabilityHistory" 
          ADD COLUMN IF NOT EXISTS "flyingWindowStart" TEXT,
          ADD COLUMN IF NOT EXISTS "flyingWindowEnd" TEXT,
          ADD COLUMN IF NOT EXISTS "lastCalculatedAt" TIMESTAMP(3);
      `);
    } catch (alterErr) {
      // Columns may already exist, ignore
    }
    // Add missing core columns for compatibility with old schema
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityHistory" ADD COLUMN IF NOT EXISTS "totalFleet" INTEGER NOT NULL DEFAULT 0`);
      await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityHistory" ADD COLUMN IF NOT EXISTS "dailyAverage" DOUBLE PRECISION NOT NULL DEFAULT 0`);
    } catch (coreColsErr) {
      // Core columns may already exist, ignore
    }
    console.log('✅ AircraftAvailabilityHistory table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityHistory table:', err.message);
  }
}

// Ensure AircraftAvailabilityEvent table exists
async function ensureAircraftAvailabilityEventTable(db) {
  try {
    // Create table if it doesn't exist - use SERIAL id for auto-increment (compatible with old schema)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityEvent" (
        "id" BIGSERIAL NOT NULL,
        "date" TEXT NOT NULL,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "availableCount" INTEGER NOT NULL,
        "totalAircraft" INTEGER NOT NULL,
        "notes" TEXT,
        "changeType" TEXT NOT NULL DEFAULT 'change',
        "recordedBy" TEXT,
        CONSTRAINT "AircraftAvailabilityEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    // Add missing columns if table was created with old schema (idempotent)
    await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityEvent" ADD COLUMN IF NOT EXISTS "changeType" TEXT NOT NULL DEFAULT 'change'`);
    await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityEvent" ADD COLUMN IF NOT EXISTS "recordedBy" TEXT`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_date ON "AircraftAvailabilityEvent"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_timestamp ON "AircraftAvailabilityEvent"("timestamp")`);
    console.log('✅ AircraftAvailabilityEvent table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityEvent table:', err.message);
  }
}

// GET /api/aircraft-availability-history
// Returns history records, optionally filtered by startDate and endDate
app.get('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { startDate, endDate } = req.query;
    let query = `SELECT * FROM "AircraftAvailabilityHistory"`;
    const params = [];
    if (startDate && endDate) {
      query += ` WHERE "date" >= $1::text AND "date" <= $2::text`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` WHERE "date" >= $1::text`;
      params.push(startDate);
    } else if (endDate) {
      query += ` WHERE "date" <= $1::text`;
      params.push(endDate);
    }
    query += ` ORDER BY "date" ASC`;
    const rawRecords = await db.$queryRawUnsafe(query, ...params);
    // Normalize records: map 'totalFleet' -> 'totalAircraft' for frontend compatibility
    const records = rawRecords.map(r => ({
      ...r,
      id: r.id != null ? String(r.id) : r.date,
      totalAircraft: Number(r.totalAircraft ?? r.totalFleet ?? 0),
      dailyAverage: Number(r.dailyAverage ?? 0),
      plannedCount: Number(r.plannedCount ?? 0),
      actualCount: r.actualCount == null ? null : Number(r.actualCount),
      availabilityPct: Number(r.availabilityPct ?? (
        Number(r.totalAircraft ?? r.totalFleet ?? 0) > 0
          ? (Number(r.dailyAverage ?? 0) / Number(r.totalAircraft ?? r.totalFleet ?? 1)) * 100
          : 0
      )),
    }));
    console.log(`✅ GET /api/aircraft-availability-history - returning ${records.length} records`);
    // Return both 'records' (expected by frontend) and 'history' (legacy) for compatibility
    res.json({ records, history: records });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft availability history', details: error.message });
  }
});

// POST /api/aircraft-availability-history
// Upserts (insert or update) a daily summary record
app.post('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date, totalFleet, dailyAverage, flyingWindowStart, flyingWindowEnd } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    await db.$executeRawUnsafe(`
      INSERT INTO "AircraftAvailabilityHistory" ("date", "totalFleet", "dailyAverage", "flyingWindowStart", "flyingWindowEnd", "lastCalculatedAt", "updatedAt")
      VALUES ($1::text, $2::int, $3::numeric, $4::text, $5::text, NOW(), NOW())
      ON CONFLICT ("date") DO UPDATE SET
        "totalFleet" = EXCLUDED."totalFleet",
        "dailyAverage" = EXCLUDED."dailyAverage",
        "flyingWindowStart" = EXCLUDED."flyingWindowStart",
        "flyingWindowEnd" = EXCLUDED."flyingWindowEnd",
        "lastCalculatedAt" = NOW(),
        "updatedAt" = NOW()
    `, date, totalFleet || 0, dailyAverage || 0, flyingWindowStart || null, flyingWindowEnd || null);
    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1::text`, date
    );
    console.log(`✅ POST /api/aircraft-availability-history - upserted record for date: ${date}`);
    res.json({ record: updated[0] });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to save aircraft availability history', details: error.message });
  }
});

// DELETE /api/aircraft-availability-history/:id
app.delete('/api/aircraft-availability-history/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    await db.$executeRawUnsafe(`DELETE FROM "AircraftAvailabilityHistory" WHERE "id" = $1::text`, id);
    console.log(`✅ DELETE /api/aircraft-availability-history/${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to delete aircraft availability history record', details: error.message });
  }
});

// GET /api/aircraft-availability-events - Get events for a date
app.get('/api/aircraft-availability-events', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1::text ORDER BY "timestamp" ASC`,
      date
    );
    // Convert BigInt ids to numbers
    const serialized = events.map(e => ({ ...e, id: Number(e.id) }));
    res.json({ events: serialized });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-events error:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// POST /api/aircraft-availability-events - Create a new event
app.post('/api/aircraft-availability-events', async (req, res) => {
  try {
    const db = await getPrisma();
    // Accept either 'totalFleet' or 'totalAircraft' for backwards compatibility
    const { date, availableCount, notes, timestamp, changeType, recordedBy, flyingWindowStart, flyingWindowEnd, clientLocalHour, clientTimezoneOffsetHours } = req.body;
    const totalFleet = req.body.totalFleet ?? req.body.totalAircraft;
    if (!date || availableCount === undefined) {
      return res.status(400).json({ error: 'date and availableCount are required' });
    }
    const ts = timestamp ? new Date(timestamp) : new Date();

    // Deduplication: skip if last event for this date has same availableCount
    // ALL event types are deduplicated - 'startup' events especially tend to flood the DB
    // because they fire on every page load.
    // Exception: 'reset' always goes through (user explicitly requested reset).
    const ALWAYS_INSERT_TYPES = ['reset'];
    const shouldDeduplicate = !ALWAYS_INSERT_TYPES.includes(changeType);
    if (shouldDeduplicate) {
      const lastRows = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1::text ORDER BY "timestamp" DESC LIMIT 1`,
        date
      );
      if (lastRows.length > 0 && Number(lastRows[0].availableCount) === Number(availableCount)) {
        console.log(`[AV-EVENTS] Skipping duplicate ${changeType}: availableCount=${availableCount} unchanged for ${date}`);
        return res.json({ skipped: true, reason: 'no_change', success: true });
      }
    }
    
    // Use raw SQL since AircraftAvailabilityEvent is not in Prisma schema.
    // The table schema on Railway may differ from local (unknown columns/types).
    // Introspect actual columns first, then build a safe INSERT.
    const colRows = await db.$queryRawUnsafe(`
      SELECT column_name, column_default, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'AircraftAvailabilityEvent'
      ORDER BY ordinal_position
    `);
    const colNames = colRows.map((c) => c.column_name);
    console.log('[AV] AircraftAvailabilityEvent columns:', colNames);

    // Build INSERT dynamically based on what columns exist
    const insertCols = [];
    const insertVals = [];
    const insertParams = [];
    let paramIdx = 1;

    // id - only include if column exists and has no auto-default
    const idCol = colRows.find(c => c.column_name === 'id');
    if (idCol && !idCol.column_default) {
      insertCols.push('"id"');
      insertVals.push(`gen_random_uuid()::${idCol.data_type === 'integer' || idCol.data_type === 'bigint' ? 'bigint' : 'text'}`);
      // For integer id, use nextval from sequence if possible
      if (idCol.data_type === 'integer' || idCol.data_type === 'bigint') {
        insertVals[insertVals.length - 1] = `nextval('"AircraftAvailabilityEvent_id_seq"')`;
      }
    }
    // date
    if (colNames.includes('date')) { insertCols.push('"date"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(date); }
    // timestamp
    if (colNames.includes('timestamp')) { insertCols.push('"timestamp"'); insertVals.push(`$${paramIdx++}::timestamptz`); insertParams.push(ts.toISOString()); }
    // availableCount
    if (colNames.includes('availableCount')) { insertCols.push('"availableCount"'); insertVals.push(`$${paramIdx++}::int`); insertParams.push(parseInt(availableCount)); }
    // totalAircraft
    if (colNames.includes('totalAircraft')) { insertCols.push('"totalAircraft"'); insertVals.push(`$${paramIdx++}::int`); insertParams.push(parseInt(totalFleet)); }
    // notes
    if (colNames.includes('notes')) { insertCols.push('"notes"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(notes ?? null); }
    // changeType
    if (colNames.includes('changeType')) { insertCols.push('"changeType"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(changeType ?? 'change'); }
    // recordedBy
    if (colNames.includes('recordedBy')) { insertCols.push('"recordedBy"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(recordedBy ?? null); }
    // createdAt (if exists and has no default)
    const createdAtCol = colRows.find(c => c.column_name === 'createdAt');
    if (createdAtCol && !createdAtCol.column_default && createdAtCol.is_nullable === 'NO') {
      insertCols.push('"createdAt"'); insertVals.push('NOW()');
    }
    // updatedAt (if exists and has no default)
    const updatedAtCol = colRows.find(c => c.column_name === 'updatedAt');
    if (updatedAtCol && !updatedAtCol.column_default && updatedAtCol.is_nullable === 'NO') {
      insertCols.push('"updatedAt"'); insertVals.push('NOW()');
    }

    const insertSQL = `INSERT INTO "AircraftAvailabilityEvent" (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`;
    console.log('[AV] INSERT SQL:', insertSQL, 'params:', insertParams);
    await db.$executeRawUnsafe(insertSQL, ...insertParams);

    // Fetch the just-inserted row to return it
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1::text ORDER BY "timestamp" DESC LIMIT 1`,
      date
    );
    const event = rows[0] ?? { date, availableCount, totalAircraft: totalFleet };

    console.log(`✅ POST /api/aircraft-availability-events - created event for date: ${date}`);
    res.json({ success: true, event });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-events error:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

// POST /api/aircraft-availability-recalculate - Recalculate summary for a date
app.post('/api/aircraft-availability-recalculate', async (req, res) => {
  try {
    const db = await getPrisma();
    // Accept clientTimezoneOffsetHours (preferred) or clientLocalHour (fallback inference) for timezone handling
    const { date, flyingWindowStart, flyingWindowEnd, totalFleet, clientTimezoneOffsetHours, clientLocalHour, clientTimezoneOffset } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1::text ORDER BY "timestamp" ASC`,
      date
    );

    if (!events || events.length === 0) {
      return res.json({ skipped: true, reason: 'no_events', message: 'No events found for this date', date });
    }

    // Convert UTC timestamp to client-local minutes-since-midnight.
    // Server runs UTC. Client is AEDT (UTC+11) or similar.
    // Priority:
    //   1. clientTimezoneOffsetHours - explicit UTC offset in hours (e.g. 11 for AEDT) - PREFERRED
    //   2. clientLocalHour - infer offset by comparing client hour vs server UTC hour - fallback
    //   3. clientTimezoneOffset - legacy field (minutes) - last resort
    let clientUtcOffsetHours = 0;
    if (typeof clientTimezoneOffsetHours === 'number') {
      // Direct UTC offset in hours - most reliable, no inference needed
      clientUtcOffsetHours = clientTimezoneOffsetHours;
      console.log(`[AV-RECALC] Using explicit UTC offset: ${clientUtcOffsetHours}h (from clientTimezoneOffsetHours)`);
    } else if (typeof clientLocalHour === 'number') {
      // Infer offset from client local hour vs server UTC hour
      const serverUtcHour = new Date().getUTCHours();
      clientUtcOffsetHours = clientLocalHour - serverUtcHour;
      if (clientUtcOffsetHours > 14) clientUtcOffsetHours -= 24;
      if (clientUtcOffsetHours < -12) clientUtcOffsetHours += 24;
      console.log(`[AV-RECALC] Inferred UTC offset: ${clientUtcOffsetHours}h (clientLocalHour=${clientLocalHour}, serverUTC=${serverUtcHour})`);
    } else if (typeof clientTimezoneOffset === 'number') {
      clientUtcOffsetHours = clientTimezoneOffset / 60;
      console.log(`[AV-RECALC] Legacy UTC offset: ${clientUtcOffsetHours}h (from clientTimezoneOffset=${clientTimezoneOffset}min)`);
    } else {
      console.warn(`[AV-RECALC] No timezone info provided - using UTC (offset=0). Average may be incorrect for non-UTC clients.`);
    }

    const toLocalMinutes = (ts) => {
      const d = new Date(ts);
      const localTotal = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + clientUtcOffsetHours * 60;
      return ((localTotal % 1440) + 1440) % 1440;
    };

    const parseWindowTime = (timeStr) => {
      if (!timeStr) return null;
      // Accept "HH:MM" or "HHMM" format
      const clean = timeStr.replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10);
      const m = parseInt(clean.slice(-2), 10);
      return h * 60 + (isNaN(m) ? 0 : m);
    };

    const windowStartMin = flyingWindowStart ? parseWindowTime(flyingWindowStart) : 8 * 60;
    const windowEndMin = flyingWindowEnd ? parseWindowTime(flyingWindowEnd) : 17 * 60;
    const windowDuration = windowEndMin - windowStartMin;
    const now = new Date();
    const currentLocalMinutes = ((now.getUTCHours() * 60 + now.getUTCMinutes() + clientUtcOffsetHours * 60) % 1440 + 1440) % 1440;
    const localToday = (() => {
      const localNow = new Date(now.getTime() + clientUtcOffsetHours * 60 * 60 * 1000);
      return `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, '0')}-${String(localNow.getUTCDate()).padStart(2, '0')}`;
    })();
    const isToday = date === localToday;
    const effectiveEndMin = isToday
      ? Math.min(Math.max(currentLocalMinutes, windowStartMin), windowEndMin)
      : windowEndMin;
    const effectiveWindowDuration = effectiveEndMin - windowStartMin;

    if (windowDuration <= 0) {
      return res.status(400).json({ error: 'Invalid flying window', date, flyingWindowStart, flyingWindowEnd });
    }

    if (isToday && effectiveWindowDuration <= 0) {
      return res.json({
        skipped: true,
        reason: 'before_flying_window',
        message: 'Flying window has not started yet',
        date,
        flyingWindowStart,
        flyingWindowEnd,
        effectiveEndTime: `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(Math.floor(effectiveEndMin % 60)).padStart(2, '0')}`,
      });
    }

    // Deduplicate events by timestamp - keep only the LAST event at each timestamp
    // (duplicate events flood the DB due to startup events firing on every page load)
    const dedupMap = new Map();
    for (const event of events) {
      const tsKey = new Date(event.timestamp).getTime();
      dedupMap.set(tsKey, event); // last one wins for same timestamp
    }
    // Sort by CLIENT-LOCAL minutes (not UTC) so overnight UTC events (e.g. AEDT dates that
    // start at UTC-11h) are in the correct local-time order for the flying window calculation.
    const dedupedEvents = Array.from(dedupMap.values()).sort(
      (a, b) => toLocalMinutes(a.timestamp) - toLocalMinutes(b.timestamp)
    );
    console.log(`[AV-RECALC] Deduped ${events.length} events -> ${dedupedEvents.length} unique timestamps`);

    // Calculate time-weighted average within the elapsed flying window for today,
    // or the full flying window for historical dates.
    let weightedSum = 0;
    let coveredMinutes = 0;
    const timeline = dedupedEvents
      .map(event => ({ event, minutes: toLocalMinutes(event.timestamp) }))
      .sort((a, b) => a.minutes - b.minutes);

    let currentAvailability = Number(timeline[0].event.availableCount);
    let segmentStart = windowStartMin;

    for (const item of timeline) {
      if (item.minutes <= windowStartMin) {
        currentAvailability = Number(item.event.availableCount);
        continue;
      }

      if (item.minutes >= effectiveEndMin) break;

      if (item.minutes > segmentStart) {
        const duration = item.minutes - segmentStart;
        weightedSum += currentAvailability * duration;
        coveredMinutes += duration;
        console.log(`[AV-RECALC] Segment [${segmentStart.toFixed(0)}-${item.minutes.toFixed(0)}min]: ${currentAvailability} ac × ${duration.toFixed(1)} min (local)`);
      }

      currentAvailability = Number(item.event.availableCount);
      segmentStart = item.minutes;
    }

    if (segmentStart < effectiveEndMin) {
      const duration = effectiveEndMin - segmentStart;
      weightedSum += currentAvailability * duration;
      coveredMinutes += duration;
      console.log(`[AV-RECALC] Segment [${segmentStart.toFixed(0)}-${effectiveEndMin.toFixed(0)}min]: ${currentAvailability} ac × ${duration.toFixed(1)} min (local)`);
    }

    if (coveredMinutes < effectiveWindowDuration) {
      const uncovered = effectiveWindowDuration - coveredMinutes;
      weightedSum += currentAvailability * uncovered;
      coveredMinutes += uncovered;
    }

    const dailyAverage = effectiveWindowDuration > 0 ? weightedSum / effectiveWindowDuration : 0;
    const totalAircraft = Math.max(...dedupedEvents.map(e => Number(e.totalAircraft ?? e.totalFleet ?? totalFleet ?? 0)));
    const effectiveEndTime = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(Math.floor(effectiveEndMin % 60)).padStart(2, '0')}`;

    // Upsert the summary with the live schema. Railway has had both totalFleet and
    // totalAircraft variants, and some tables require id on insert.
    try {
      const historyColumns = await db.$queryRawUnsafe(`
        SELECT column_name, column_default, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'AircraftAvailabilityHistory'
        ORDER BY ordinal_position
      `);
      const historyColumnNames = historyColumns.map(c => c.column_name);
      const fleetColumn = historyColumnNames.includes('totalAircraft') ? 'totalAircraft' : 'totalFleet';
      const existing = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1::text LIMIT 1`,
        date
      );

      const summaryValues = {
        dailyAverage,
        [fleetColumn]: totalAircraft || totalFleet || 0,
        availabilityPct: (totalAircraft || totalFleet || 0) > 0 ? (dailyAverage / (totalAircraft || totalFleet || 1)) * 100 : 0,
        plannedCount: Number(dedupedEvents[0]?.availableCount ?? currentAvailability ?? 0),
        actualCount: Number(dedupedEvents[dedupedEvents.length - 1]?.availableCount ?? currentAvailability ?? 0),
        flyingWindowStart: flyingWindowStart || null,
        flyingWindowEnd: flyingWindowEnd || null,
        effectiveEndTime,
      };

      const writableFields = Object.entries(summaryValues).filter(([key]) => historyColumnNames.includes(key));

      if (existing.length > 0) {
        const setClauses = writableFields.map(([key], idx) => `"${key}" = $${idx + 2}`);
        if (historyColumnNames.includes('lastCalculatedAt')) setClauses.push('"lastCalculatedAt" = NOW()');
        if (historyColumnNames.includes('updatedAt')) setClauses.push('"updatedAt" = NOW()');
        await db.$executeRawUnsafe(
          `UPDATE "AircraftAvailabilityHistory" SET ${setClauses.join(', ')} WHERE "date" = $1::text`,
          date,
          ...writableFields.map(([, value]) => value)
        );
      } else {
        const insertColumns = [];
        const insertValues = [];
        const insertParams = [];
        let paramIdx = 1;

        const idColumn = historyColumns.find(c => c.column_name === 'id');
        if (idColumn && !idColumn.column_default) {
          insertColumns.push('"id"');
          insertValues.push('gen_random_uuid()::text');
        }

        insertColumns.push('"date"');
        insertValues.push(`$${paramIdx++}::text`);
        insertParams.push(date);

        for (const [key, value] of writableFields) {
          insertColumns.push(`"${key}"`);
          insertValues.push(`$${paramIdx++}`);
          insertParams.push(value);
        }

        if (historyColumnNames.includes('lastCalculatedAt')) {
          insertColumns.push('"lastCalculatedAt"');
          insertValues.push('NOW()');
        }
        if (historyColumnNames.includes('createdAt')) {
          insertColumns.push('"createdAt"');
          insertValues.push('NOW()');
        }
        if (historyColumnNames.includes('updatedAt')) {
          insertColumns.push('"updatedAt"');
          insertValues.push('NOW()');
        }

        await db.$executeRawUnsafe(
          `INSERT INTO "AircraftAvailabilityHistory" (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`,
          ...insertParams
        );
      }
    } catch (upsertErr) {
      console.error('[AV-RECALC] Upsert error (non-fatal):', upsertErr.message);
    }

    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1::text`, date
    );

    const record = updated[0] || { date, totalFleet: totalAircraft };
    record.dailyAverage = dailyAverage;
    record.effectiveEndTime = record.effectiveEndTime ?? effectiveEndTime;
    record.flyingWindowStart = record.flyingWindowStart ?? (flyingWindowStart || null);
    record.flyingWindowEnd = record.flyingWindowEnd ?? (flyingWindowEnd || null);
    if (record.id != null) record.id = String(record.id);
    if (record.totalAircraft != null) record.totalAircraft = Number(record.totalAircraft);
    if (record.totalFleet != null) record.totalFleet = Number(record.totalFleet);
    if (record.availabilityPct != null) record.availabilityPct = Number(record.availabilityPct);
    if (record.plannedCount != null) record.plannedCount = Number(record.plannedCount);
    if (record.actualCount != null) record.actualCount = Number(record.actualCount);

    console.log(`✅ POST /api/aircraft-availability-recalculate - date: ${date}, average: ${dailyAverage.toFixed(2)}, offset: ${clientUtcOffsetHours}h, effectiveEnd=${effectiveEndTime}`);
    // Return both 'record' and 'summary' so all callers work
    res.json({ success: true, record, summary: record, dailyAverage, date, eventCount: events.length });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-recalculate error:', error);
    res.status(500).json({ error: 'Failed to recalculate', details: error.message });
  }
});

// GET /api/aircraft-availability-current - Get the current aircraft availability
// Returns the most recent event (any date) so availability persists across days/restarts
app.get('/api/aircraft-availability-current', async (req, res) => {
  try {
    const db = await getPrisma();

    // Always fetch the most recent event across ALL dates.
    // This ensures persistence regardless of timezone (client date vs server UTC date may differ).
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" ORDER BY "timestamp" DESC LIMIT 1`
    );

    if (events.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return res.json({
        success: true,
        isDefault: true,
        availableCount: 15,
        totalAircraft: 15,
        date: today,
        current: null
      });
    }

    const latest = events[0];
    res.json({
      success: true,
      isDefault: false,
      availableCount: Number(latest.availableCount),
      totalAircraft: Number(latest.totalAircraft ?? latest.totalFleet ?? 15),
      date: latest.date,
      current: {
        availableCount: Number(latest.availableCount),
        totalFleet: Number(latest.totalAircraft ?? latest.totalFleet ?? 15),
        totalAircraft: Number(latest.totalAircraft ?? latest.totalFleet ?? 15),
        timestamp: latest.timestamp,
        id: latest.id
      }
    });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-current error:', error);
    res.status(500).json({ error: 'Failed to get current availability', details: error.message });
  }
});

// ============================================================
// INDIVIDUAL LMP TABLE SETUP
// ============================================================

async function ensureIndividualLMPTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IndividualLMP" (
        "id" TEXT NOT NULL,
        "traineeId" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "lmpType" TEXT NOT NULL,
        "events" JSONB NOT NULL DEFAULT '[]',
        "completedEventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "IndividualLMP_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IndividualLMP_traineeId_key"
      ON "IndividualLMP"("traineeId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "IndividualLMP_traineeFullName_idx"
      ON "IndividualLMP"("traineeFullName");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "IndividualLMP_traineeId_idx"
      ON "IndividualLMP"("traineeId");
    `);
    console.log('✅ IndividualLMP table ready');
  } catch (err) {
    console.error('❌ Failed to ensure IndividualLMP table:', err.message);
  }
}

async function ensureTraineeLmpOverlayTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TraineeLmpOverlay" (
        "id" TEXT NOT NULL,
        "traineeId" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "overlayId" TEXT NOT NULL,
        "packageId" TEXT,
        "overlayType" TEXT NOT NULL DEFAULT 'remedial',
        "payload" JSONB NOT NULL,
        "anchorAfterMasterEventId" TEXT,
        "anchorBeforeMasterEventId" TEXT,
        "anchorPolicy" TEXT NOT NULL DEFAULT 'between',
        "orderKey" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TraineeLmpOverlay_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "TraineeLmpOverlay_trainee_overlay_key"
      ON "TraineeLmpOverlay"("traineeId", "overlayId");
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TraineeLmpOverlay_traineeId_idx" ON "TraineeLmpOverlay"("traineeId");`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TraineeLmpOverlay_active_idx" ON "TraineeLmpOverlay"("traineeId", "isActive");`);
    console.log('✅ TraineeLmpOverlay table ready');
  } catch (err) {
    console.error('❌ Failed to ensure TraineeLmpOverlay table:', err.message);
  }
}

async function migrateIndividualLmpOverlays(db) {
  try {
    const lmps = await db.individualLMP.findMany({
      select: { traineeId: true, traineeFullName: true, events: true },
    });
    let migrated = 0;
    for (const lmp of lmps) {
      const events = Array.isArray(lmp.events) ? lmp.events : [];
      const overlays = events.filter(isLmpOverlayItemForSync);
      if (overlays.length === 0) continue;
      migrated += await upsertTraineeLmpOverlays(db, lmp.traineeId, lmp.traineeFullName, overlays, { deactivateMissing: false });
    }
    if (migrated > 0) {
      console.log(`✅ Migrated/confirmed ${migrated} Individual LMP overlay event(s)`);
    }
  } catch (err) {
    console.error('❌ migrateIndividualLmpOverlays failed (non-fatal):', err.message);
  }
}

async function upsertTraineeLmpOverlays(db, traineeId, traineeFullName, events, options = {}) {
  const overlays = (Array.isArray(events) ? events : []).filter(isLmpOverlayItemForSync);
  const overlayIds = overlays.map(item => item.id || item.code).filter(Boolean);

  if (options.deactivateMissing) {
    if (overlayIds.length > 0) {
      const placeholders = overlayIds.map((_, index) => `$${index + 2}::text`).join(', ');
      await db.$executeRawUnsafe(
        `UPDATE "TraineeLmpOverlay"
         SET "isActive" = false, "updatedAt" = NOW()
         WHERE "traineeId" = $1::text AND "overlayId" NOT IN (${placeholders})`,
        traineeId,
        ...overlayIds
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "TraineeLmpOverlay" SET "isActive" = false, "updatedAt" = NOW() WHERE "traineeId" = $1::text`,
        traineeId
      );
    }
  }

  let count = 0;
  for (const item of overlays) {
    const overlayId = item.id || item.code;
    if (!overlayId) continue;
    const payload = {
      ...item,
      id: overlayId,
      code: item.code || overlayId,
      lmpSource: item.lmpSource || (item.isRemedial ? 'remedial' : 'custom'),
      isRemedial: item.isRemedial === true || item.lmpSource === 'remedial',
    };
    const normalizedResourceNumber = getLmpResourceNumberForSync(payload);
    payload.resourceNumber = normalizedResourceNumber;
    payload.resourceCount = normalizedResourceNumber;
    payload.resourcesPhysical = alignPhysicalResourcesForSync(payload.resourcesPhysical, normalizedResourceNumber);
    const rowId = `tlmpo-${safeIdentifier(`${traineeId}-${overlayId}`)}`.slice(0, 180);
    const packageId = item.remedialPackageId || deriveRemedialPackageId(item) || null;
    await db.$executeRawUnsafe(`
      INSERT INTO "TraineeLmpOverlay" (
        "id", "traineeId", "traineeFullName", "overlayId", "packageId", "overlayType",
        "payload", "anchorAfterMasterEventId", "anchorBeforeMasterEventId", "anchorPolicy",
        "orderKey", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
        $7::jsonb, $8::text, $9::text, $10::text,
        $11::text, true, NOW(), NOW()
      )
      ON CONFLICT ("traineeId", "overlayId") DO UPDATE SET
        "traineeFullName" = EXCLUDED."traineeFullName",
        "packageId" = EXCLUDED."packageId",
        "overlayType" = EXCLUDED."overlayType",
        "payload" = EXCLUDED."payload",
        "anchorAfterMasterEventId" = EXCLUDED."anchorAfterMasterEventId",
        "anchorBeforeMasterEventId" = EXCLUDED."anchorBeforeMasterEventId",
        "anchorPolicy" = EXCLUDED."anchorPolicy",
        "orderKey" = EXCLUDED."orderKey",
        "isActive" = true,
        "updatedAt" = NOW()
    `,
      rowId,
      traineeId,
      traineeFullName,
      overlayId,
      packageId,
      payload.lmpSource || 'remedial',
      JSON.stringify(payload),
      payload.anchorAfterMasterEventId || null,
      payload.anchorBeforeMasterEventId || null,
      payload.anchorPolicy || 'between',
      payload.orderKey || null
    );
    count++;
  }
  return count;
}

function deriveRemedialPackageId(item) {
  const code = item?.code || item?.id || '';
  const match = String(code).match(/^(.*?)-(?:REM-[A-Z]+\d+|RFTD\d+|RRF\d+|RT\d+|RF\d+|FTD\d+|F\d+|T\d+)$/i);
  return match ? `${match[1]}-REMEDIAL` : null;
}

async function loadTraineeLmpOverlays(db, traineeId) {
  const rows = await db.$queryRawUnsafe(
    `SELECT * FROM "TraineeLmpOverlay" WHERE "traineeId" = $1::text AND "isActive" = true ORDER BY "orderKey" ASC NULLS LAST, "createdAt" ASC`,
    traineeId
  );
  return (rows || []).map(row => {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return {
      ...payload,
      id: payload.id || row.overlayId,
      code: payload.code || row.overlayId,
      lmpSource: payload.lmpSource || row.overlayType || 'remedial',
      anchorAfterMasterEventId: payload.anchorAfterMasterEventId || row.anchorAfterMasterEventId || undefined,
      anchorBeforeMasterEventId: payload.anchorBeforeMasterEventId || row.anchorBeforeMasterEventId || undefined,
      anchorPolicy: payload.anchorPolicy || row.anchorPolicy || 'between',
      orderKey: payload.orderKey || row.orderKey || undefined,
    };
  });
}

async function loadMasterSyllabusForLmpType(db, lmpType) {
  try {
    const allItems = await db.$queryRawUnsafe(
      `SELECT * FROM "SyllabusItem" WHERE "isActive" = true ORDER BY "sortOrder" ASC`
    );
    if (!allItems || allItems.length === 0) return [];
    const parsed = allItems.map(item => ({
      ...item,
      courses: Array.isArray(item.courses) ? item.courses :
        (typeof item.courses === 'string' ? JSON.parse(item.courses) : []),
    }));
    if (lmpType === 'FIC') return parsed.filter(item => item.courses.includes('FIC'));
    if (lmpType && lmpType !== 'BPC+IPC') return parsed.filter(item => item.courses.includes(lmpType));
    return parsed.filter(item => !item.courses.includes('FIC') && item.type !== 'Academics');
  } catch (err) {
    console.warn('[Individual LMP] Could not load master syllabus for composition:', err.message);
    return [];
  }
}

function composeIndividualLmpEvents(storedEvents, masterSyllabus, overlayEvents, completedEventIds = []) {
  if (!masterSyllabus || masterSyllabus.length === 0) return Array.isArray(storedEvents) ? storedEvents : [];
  const existingBase = Array.isArray(storedEvents) ? storedEvents.filter(item => !isLmpOverlayItemForSync(item)) : [];
  const existingForMerge = [...existingBase, ...(overlayEvents || [])];
  const scoreMap = {};
  completedEventIds.forEach(id => {
    const normalized = String(id || '').replace('*', '');
    if (normalized) scoreMap[normalized] = new Date().toISOString();
  });
  return mergeIndividualLmpWithMasterForSync(existingForMerge, masterSyllabus, scoreMap);
}

function resolveTraineeLmpType(trainee) {
  if (trainee?.lmpType) return trainee.lmpType;
  if (trainee?.course && String(trainee.course).toUpperCase().startsWith('FIC')) return 'FIC';
  return 'BPC+IPC';
}

async function ensureInitialIndividualLmpForTrainee(db, trainee) {
  if (!trainee?.id || !trainee?.fullName) return null;
  const existing = await db.individualLMP.findFirst({ where: { traineeId: trainee.id } });
  if (existing) return existing;

  const lmpType = resolveTraineeLmpType(trainee);
  const masterSyllabus = await loadMasterSyllabusForLmpType(db, lmpType);
  const events = composeIndividualLmpEvents([], masterSyllabus, [], []);
  const created = await db.individualLMP.create({
    data: {
      traineeId: trainee.id,
      traineeFullName: trainee.fullName,
      lmpType,
      events,
      completedEventIds: [],
    },
  });
  console.log(`✅ Initial IndividualLMP created for ${trainee.fullName}: ${events.length} events (${lmpType})`);
  return created;
}

// ============================================================
// CANCELLATION CODES ENDPOINTS
// ============================================================

async function ensureCancellationCodesTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CancellationCode" (
        "id" SERIAL NOT NULL,
        "code" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'Other',
        "description" TEXT NOT NULL DEFAULT '',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CancellationCode_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CancellationCode_code_key" ON "CancellationCode"("code");
    `);
    console.log('✅ CancellationCode table ready');
  } catch (err) {
    console.error('❌ Failed to ensure CancellationCode table:', err.message);
  }
}

async function seedCancellationCodesIfEmpty(db) {
  try {
    const existing = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "CancellationCode"`);
    const count = Number(existing[0].count);
    if (count > 0) {
      console.log(`ℹ️  CancellationCode table already has ${count} codes - skipping seed`);
      return;
    }
    const defaults = [
      { code: 'WX', category: 'Weather', description: 'Weather - general adverse conditions' },
      { code: 'WX-CB', category: 'Weather', description: 'Weather - cumulonimbus / thunderstorm' },
      { code: 'WX-FOG', category: 'Weather', description: 'Weather - fog / low visibility' },
      { code: 'WX-WIND', category: 'Weather', description: 'Weather - wind above limits' },
      { code: 'AC-SVC', category: 'Aircraft', description: 'Aircraft unserviceable - scheduled maintenance' },
      { code: 'AC-UNSVC', category: 'Aircraft', description: 'Aircraft unserviceable - unscheduled defect' },
      { code: 'AC-INSUF', category: 'Aircraft', description: 'Aircraft insufficient - not enough available' },
      { code: 'STU-SIC', category: 'Student', description: 'Student sick / medically unfit' },
      { code: 'STU-GND', category: 'Student', description: 'Student grounded / suspended' },
      { code: 'STU-UNAV', category: 'Student', description: 'Student unavailable - other reason' },
      { code: 'IP-SIC', category: 'Instructor', description: 'Instructor sick / medically unfit' },
      { code: 'IP-UNAV', category: 'Instructor', description: 'Instructor unavailable - other reason' },
      { code: 'OPS-TEMPO', category: 'Operations', description: 'Operational tempo / tasking conflict' },
      { code: 'OPS-AIRSP', category: 'Operations', description: 'Airspace not available' },
      { code: 'ADMIN', category: 'Administrative', description: 'Administrative cancellation' },
      { code: 'OTHER', category: 'Other', description: 'Other reason (see notes)' },
    ];
    for (const d of defaults) {
      await db.$executeRawUnsafe(
        `INSERT INTO "CancellationCode" ("code", "category", "description") VALUES ($1::text, $2::text, $3::text) ON CONFLICT ("code") DO NOTHING`,
        d.code, d.category, d.description
      );
    }
    console.log(`✅ Seeded ${defaults.length} default cancellation codes`);
  } catch (err) {
    console.error('❌ Failed to seed cancellation codes:', err.message);
  }
}

// GET /api/cancellation-codes - Return all codes
app.get('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    const codes = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" ORDER BY "category" ASC, "code" ASC`);
    const serialized = codes.map(c => ({ ...c, id: Number(c.id) }));
    res.json({ success: true, codes: serialized });
  } catch (error) {
    console.error('❌ GET /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cancellation codes', details: error.message });
  }
});

// POST /api/cancellation-codes - Create or update a code (upsert)
app.post('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code, category, description, isActive } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'code is required' });
    await db.$executeRawUnsafe(`
      INSERT INTO "CancellationCode" ("code", "category", "description", "isActive", "updatedAt")
      VALUES ($1::text, $2::text, $3::text, $4::boolean, NOW())
      ON CONFLICT ("code") DO UPDATE SET
        "category" = EXCLUDED."category",
        "description" = EXCLUDED."description",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = NOW()
    `, code, category || 'Other', description || '', isActive !== false);
    const updated = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1::text`, code);
    const record = updated[0];
    res.json({ success: true, code: { ...record, id: Number(record.id) } });
  } catch (error) {
    console.error('❌ POST /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to save cancellation code', details: error.message });
  }
});

// PATCH /api/cancellation-codes/:code/toggle - Toggle active status
app.patch('/api/cancellation-codes/:code/toggle', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code } = req.params;
    await db.$executeRawUnsafe(`
      UPDATE "CancellationCode" SET "isActive" = NOT "isActive", "updatedAt" = NOW() WHERE "code" = $1::text
    `, code);
    const updated = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1::text`, code);
    if (!updated.length) return res.status(404).json({ success: false, error: 'Code not found' });
    const record = updated[0];
    res.json({ success: true, code: { ...record, id: Number(record.id) } });
  } catch (error) {
    console.error('❌ PATCH /api/cancellation-codes toggle error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle cancellation code', details: error.message });
  }
});

// DELETE /api/cancellation-codes/:code
app.delete('/api/cancellation-codes/:code', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code } = req.params;
    const existing = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1::text`, code);
    if (!existing.length) return res.status(404).json({ success: false, error: 'Code not found' });
    await db.$executeRawUnsafe(`DELETE FROM "CancellationCode" WHERE "code" = $1::text`, code);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete cancellation code', details: error.message });
  }
});

// ============================================================
// HISTORICAL DATA PERSISTENCE ENDPOINTS
// ============================================================

// GET /api/historical-data - Load persisted publishedSchedules + pt051Assessments
app.get('/api/historical-data', async (req, res) => {
  try {
    const db = await getPrisma();

    // Load publishedSchedules backup
    const schedulesBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_published_schedules' },
      orderBy: { createdAt: 'desc' }
    });

    // Load pt051Assessments backup
    const pt051Backup = await db.dataBackup.findFirst({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' }
    });

    // Load seeding metadata
    const seedingMeta = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      publishedSchedules: schedulesBackup ? schedulesBackup.data : null,
      pt051Assessments: pt051Backup ? pt051Backup.data : null,
      seedingMetadata: seedingMeta ? seedingMeta.data : null,
    });
  } catch (error) {
    console.error('❌ GET /api/historical-data error:', error);
    res.status(500).json({ error: 'Failed to load historical data', details: error.message });
  }
});

// POST /api/historical-data/save - Save publishedSchedules + pt051Assessments
app.post('/api/historical-data/save', async (req, res) => {
  try {
    const db = await getPrisma();
    const { publishedSchedules, pt051Assessments, metadata } = req.body;

    const savedItems = [];

    if (publishedSchedules !== undefined) {
      // Delete old and insert new (upsert pattern via delete+create)
      await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
      await db.dataBackup.create({
        data: { type: 'historical_published_schedules', data: publishedSchedules }
      });
      savedItems.push('publishedSchedules');
    }

    if (pt051Assessments !== undefined) {
      await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
      await db.dataBackup.create({
        data: { type: 'historical_pt051_assessments', data: pt051Assessments }
      });
      savedItems.push('pt051Assessments');
    }

    if (metadata !== undefined) {
      await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });
      await db.dataBackup.create({
        data: { type: 'historical_seeding_metadata', data: metadata }
      });
      savedItems.push('seedingMetadata');
    }

    console.log(`✅ POST /api/historical-data/save - Saved: ${savedItems.join(', ')}`);
    res.json({ success: true, saved: savedItems });
  } catch (error) {
    console.error('❌ POST /api/historical-data/save error:', error);
    res.status(500).json({ error: 'Failed to save historical data', details: error.message });
  }
});

// POST /api/historical-data/seed - Generate and save historical training data
// This is the one-time seeding endpoint. It generates all training records
// from course start dates up to current progress point for each trainee.
app.post('/api/historical-data/seed', async (req, res) => {
  try {
    const db = await getPrisma();

    // Check if seeding has already been done
    const existingMeta = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    if (existingMeta && existingMeta.data && existingMeta.data.seededAt && !req.body.force) {
      return res.json({
        success: false,
        alreadySeeded: true,
        seededAt: existingMeta.data.seededAt,
        message: 'Historical data has already been seeded. Pass force:true to reseed.'
      });
    }

    // ----------------------------------------------------------------
    // RESET: Clear all existing historical data before reseeding
    // This ensures a clean slate for IndividualLMP, PT-051s, and scores
    // ----------------------------------------------------------------
    console.log('🧹 Resetting historical data before reseeding...');

    // Delete all historical seed scores from DB
    await db.score.deleteMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    // Clear all IndividualLMP completedEventIds for active trainees
    // (reset to empty so the new seed data is authoritative)
    await db.$executeRawUnsafe(`
      UPDATE "IndividualLMP"
      SET "completedEventIds" = ARRAY[]::TEXT[], "updatedAt" = NOW()
    `);

    // Clear DataBackup historical records
    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });

    console.log('✅ Reset complete. Starting fresh seed...');

    // Fetch all trainees and instructors
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      orderBy: { course: 'asc' }
    });

    const instructors = await db.personnel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, rank: true, role: true, unit: true, isQFI: true }
    });

    const qfiInstructors = instructors.filter(i => i.isQFI || i.role === 'QFI');

    if (trainees.length === 0) {
      return res.status(400).json({ error: 'No active trainees found in database' });
    }
    if (qfiInstructors.length === 0) {
      return res.status(400).json({ error: 'No QFI instructors found in database' });
    }

    console.log(`🌱 Seeding historical data for ${trainees.length} trainees with ${qfiInstructors.length} instructors`);

    // Course configuration
    // progressRange: [startEvent, endEvent] - trainee is randomly placed anywhere in this range
    // For FIC courses, centreEvent is still used (original ±3 logic retained)
    const courseConfig = {
      'ADF301': { startDate: '2023-04-01', lmpType: 'BPC+IPC', progressRange: ['BIF TUT2', 'BGF23'] },
      'ADF302': { startDate: '2025-08-01', lmpType: 'BPC+IPC', progressRange: ['BGF10', 'BGF19'] },
      'ADF303': { startDate: '2025-12-01', lmpType: 'BPC+IPC', progressRange: ['BGF1', 'BGF5'] },
      'FIC210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3' },
      'FIC211': { startDate: '2026-01-11', lmpType: 'FIC', centreEvent: 'FIC4' },
      'FIC 210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3' },
    };

    // BPC+IPC syllabus ordered sequence
    const BPC_IPC_SYLLABUS = [
      'BGF MB1','BGF MB2','BGF CPT1','BGF TUT1A','BGF TUT1B','BGF TUT2',
      'BGF MB3','BGF MB4','BGF MB5','BGF MB6','BGF CPT2','BGF FTD1','BGF MB7',
      'BGF1','BGF FTD2','BGF2','BGF MB8','BGF CPT3','BGF MB9','BGF TUT3',
      'BGF FTD3','BGF3','BGF FTD4','BGF4','BGF5','BGF MB10','BGF MB11',
      'BGF MB12','BGF CPT4','BGF6','BGF MB13','BGF CPT5','PRE-SOLO QUIZ',
      'BGF7','BGF FTD5','BGF8','PERRT CPT1','BGF9','BGF MB14','BGF FTD6',
      'BGF10','BGF11','BGF MB15','BGF MB16','BGF FTD7','BGF12','BGF13',
      'BGF14','BGF FTD8','BGF15','AREA SOLO QUIZ','BGF16','BGF TUT4',
      'BGF FTD9','BGF17','BGF18','BGF19','BGF20',
      'BIF MB1','BIF MB2','BIF TUT1','BIF CPT1','BIF CPT2',
      'BIF FTD1*','BIF FTD2','BIF FTD3*','BIF1','BIF2',
      'BNF MB1','BNF FTD1','BNF1','BNF2','BNF3','BNF4',
      'BIF MB3','BIF MB4','BIF MB5','BIF TUT2','BIF CPT3',
      'BIF FTD4','BIF FTD5','BIF FTD6','BIF3','BIF4','BIF5',
      'BGF MB17','BGF FTD10','BGF21','BGF22','BGF23','BGF24',
      'BNAV MB1','BNAV TUT1','BNAV FTD1','BNAV1','BNAV2','BNAV3 NAVPT',
      'SCT GF','SCT IF','SCT NAV','SCT FORM','Night SCT',
    ];

    // FIC syllabus ordered sequence (FIC courses use AIT prefix first, then FIC)
    const FIC_SYLLABUS = [
      'FIC MB1','FIC MB2','FIC FTD1','FIC FTD2',
      'FIC1','FIC2','FIC3','FIC FTD3','FIC4','FIC5','FIC6',
      'FIC FTD4','FIC FTD5',
      'FIC IF1','FIC IF2','FIC IF3','FIC IF4','FIC FTD6',
      'AIT1','AIT2','AIT3','AIT4','AIT5','AIT6','AIT7','AIT8',
    ];

    // Event type classification for generating ScheduleEvent records
    const getEventType = (code) => {
      if (code.includes('FTD') || code.includes('CPT') || code.includes('TUT')) return 'ftd';
      if (code.includes('MB') || code.includes('QUIZ') || code.includes('NAVPT') || code.includes('PERRT')) return 'ground';
      return 'flight';
    };

    const getEventDuration = (code, lmpType) => {
      if (code.includes('MB') || code.includes('TUT') || code.includes('QUIZ') || code.includes('NAVPT')) return 2.0;
      if (code.includes('CPT')) return 1.0;
      // FTD events: 2.0hrs for BPC+IPC and FIC courses
      if (code.includes('FTD')) {
        if (lmpType === 'BPC+IPC' || lmpType === 'FIC') return 2.0;
        return 1.0;
      }
      // Flight events: 1.2hrs for BPC+IPC and FIC courses
      if (lmpType === 'FIC' || lmpType === 'BPC+IPC') return 1.2;
      return 1.3;
    };

    // Deterministic seeded random (no global Math.random side effects on each call)
    const seededRand = (seed) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return Math.abs(s) / 0xffffffff;
      };
    };

    // Generate consistent UUID-like id from components
    const makeEventId = (traineeId, eventCode, date) =>
      `hist-${traineeId.slice(-8)}-${eventCode.replace(/[^a-z0-9]/gi, '')}-${date}`.toLowerCase();

    const makePt051Id = (eventId, traineeName) =>
      `pt051-${eventId}-${traineeName}`.replace(/\s/g, '_');

    const today = new Date();
    const publishedSchedules = {}; // { date: ScheduleEvent[] }
    const pt051Assessments = {};   // { key: Pt051Assessment }
    const scoreRecords = [];       // { traineeId, event, score, date, instructor, notes }

    // Track completed event IDs per trainee for IndividualLMP upsert
    // Key: trainee.id, Value: { traineeFullName, lmpType, completedEventIds: string[] }
    const traineeCompletedEvents = {}; // { traineeId: Set<string> }

    // PT-051 ALL_ELEMENTS - exact 22 elements matching PT051_STRUCTURE in PT051View.tsx
    // This must match exactly: PT051_STRUCTURE.flatMap(cat => cat.elements)
    const ALL_ELEMENTS = [
      // Core Dimensions
      'Airmanship', 'Preparation', 'Technique',
      // Procedural Framework
      'Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks',
      // Takeoff
      'Stationary',
      // Departure
      'Visual',
      // Core Handling Skills
      'Effects of Control', 'Trimming', 'Straight and Level',
      // Turns
      'Level medium Turn', 'Level Steep turn',
      // Recovery
      'Visual - Initial & Pitch',
      // Landing
      'Landing', 'Crosswind',
      // Domestics
      'Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge',
    ];

    // PT-051 grading: 1-5 scale (no 0 for historical data - all events completed satisfactorily)
    // Weighted: 3 = standard, 4 = above standard, occasional 5, rare 2 (marginal)
    const gradePool = [3, 3, 3, 4, 4, 3, 3, 4, 3, 3, 4, 3, 5, 3, 4]; // weighted 3-4, some 5

    // Element-specific comment pools keyed by element name, then grade (1-5)
    const ELEMENT_COMMENTS = {
      'Airmanship': {
        1: ['Struggled to demonstrate basic airmanship throughout the sortie.', 'Displayed limited awareness of sound airmanship principles.', 'Airmanship was below the expected standard for this stage.', 'Required frequent correction to maintain acceptable airmanship.'],
        2: ['Demonstrated basic airmanship, though inconsistently.', 'Some sound airmanship was evident, but standards varied.', 'Showed developing airmanship with several lapses.', 'Airmanship was adequate at times but lacked consistency.'],
        3: ['Demonstrated satisfactory airmanship for this phase.', 'Airmanship met the expected standard overall.', 'Maintained sound airmanship through most sequences.', 'Showed an acceptable level of airmanship throughout.'],
        4: ['Demonstrated strong airmanship across the sortie.', 'Airmanship was consistently above the expected standard.', 'Displayed a confident and well-rounded approach to airmanship.', 'Maintained a high standard of airmanship throughout.'],
        5: ['Demonstrated excellent airmanship at all times.', 'Airmanship was of an exceptionally high standard.', 'Displayed mature and highly polished airmanship throughout.', 'Set the benchmark for airmanship during the sortie.'],
      },
      'Preparation': {
        1: ['Preparation was incomplete and impacted performance.', 'Displayed poor preparation for the task requirements.', 'Insufficient preparation was evident prior to flight.', 'Preparation fell below the expected standard.'],
        2: ['Basic preparation was completed but lacked depth.', 'Preparation covered some key points but missed important details.', 'Showed partial preparation for the sortie.', 'Preparation was adequate in parts but not thorough.'],
        3: ['Preparation was satisfactory for the planned activity.', 'Demonstrated an acceptable level of preparation.', 'Preparation met the expected standard overall.', 'Showed sound preparation for the sortie requirements.'],
        4: ['Preparation was thorough and well considered.', 'Demonstrated strong preparation for all task elements.', 'Arrived well prepared and ready for the sortie.', 'Preparation supported effective task completion.'],
        5: ['Preparation was outstanding in all respects.', 'Demonstrated exceptional preparation and foresight.', 'Arrived comprehensively prepared for the sortie.', 'Set an excellent standard through superior preparation.'],
      },
      'Technique': {
        1: ['Technique was poor and frequently ineffective.', 'Struggled to apply correct handling technique.', 'Technique was below the required standard.', 'Required repeated correction of basic technique.'],
        2: ['Basic technique was evident but inconsistent.', 'Applied some correct techniques, though with errors.', 'Technique is developing but lacked refinement.', 'Demonstrated uneven application of required technique.'],
        3: ['Technique was satisfactory for this stage of training.', 'Applied the required techniques to an acceptable standard.', 'Demonstrated generally sound technique throughout.', 'Technique met the expected standard overall.'],
        4: ['Technique was strong and consistently effective.', 'Applied correct technique with good precision.', 'Demonstrated well-developed handling technique.', 'Technique was above the expected standard.'],
        5: ['Technique was excellent throughout the sortie.', 'Demonstrated highly polished and precise technique.', 'Applied all required techniques to an exceptional standard.', 'Set the benchmark for technical execution.'],
      },
      'Pre-Post Flight': {
        1: ['Struggled to complete pre- and post-flight actions correctly.', 'Pre- and post-flight procedures were poorly executed.', 'Several key pre- and post-flight steps were missed.', 'Required significant prompting during pre- and post-flight actions.'],
        2: ['Completed pre- and post-flight actions with some errors.', 'Demonstrated basic understanding of pre- and post-flight procedures.', 'Some pre- and post-flight steps were completed correctly.', 'Pre- and post-flight actions lacked consistency.'],
        3: ['Completed pre- and post-flight procedures satisfactorily.', 'Pre- and post-flight actions met the expected standard.', 'Demonstrated sound handling of pre- and post-flight requirements.', 'Managed pre- and post-flight procedures adequately.'],
        4: ['Completed pre- and post-flight actions confidently and accurately.', 'Pre- and post-flight procedures were well managed.', 'Demonstrated strong procedural discipline before and after flight.', 'Pre- and post-flight actions were above standard.'],
        5: ['Executed pre- and post-flight procedures flawlessly.', 'Demonstrated exemplary discipline in all pre- and post-flight actions.', 'Pre- and post-flight actions were completed to an exceptional standard.', 'Set the benchmark for pre- and post-flight procedure execution.'],
      },
      'Walk Around': {
        1: ['Walk around was incomplete and lacked attention to detail.', 'Missed several important items during the walk around.', 'Demonstrated poor discipline during the walk around.', 'Required significant prompting to complete the walk around correctly.'],
        2: ['Walk around was completed with some omissions.', 'Demonstrated basic understanding of walk around requirements.', 'Attention to detail during the walk around was inconsistent.', 'Walk around was adequate but lacked thoroughness.'],
        3: ['Walk around was completed satisfactorily.', 'Demonstrated acceptable attention to detail during the walk around.', 'Completed the walk around to the expected standard.', 'Walk around was methodical and generally accurate.'],
        4: ['Walk around was thorough and well conducted.', 'Demonstrated strong attention to detail during inspection.', 'Completed the walk around confidently and accurately.', 'Walk around standard was above expectations.'],
        5: ['Walk around was exceptionally thorough and disciplined.', 'Demonstrated excellent attention to detail throughout the inspection.', 'Completed the walk around to a benchmark standard.', 'Walk around was conducted with outstanding professionalism.'],
      },
      'Strap-in': {
        1: ['Strap-in procedure was poorly executed.', 'Required repeated prompting during strap-in.', 'Missed key steps during strap-in procedure.', 'Strap-in actions were below the expected standard.'],
        2: ['Strap-in procedure was completed with some errors.', 'Demonstrated basic understanding of strap-in actions.', 'Strap-in was adequate but lacked fluency.', 'Some prompting was required during strap-in.'],
        3: ['Strap-in procedure was completed satisfactorily.', 'Demonstrated acceptable strap-in discipline.', 'Strap-in actions met the expected standard.', 'Completed strap-in with only minor errors.'],
        4: ['Strap-in procedure was completed confidently and accurately.', 'Demonstrated strong discipline during strap-in.', 'Strap-in actions were smooth and above standard.', 'Completed strap-in with good accuracy and flow.'],
        5: ['Strap-in procedure was completed flawlessly.', 'Demonstrated excellent strap-in discipline and accuracy.', 'Strap-in actions were completed to an exceptional standard.', 'Set the benchmark for strap-in procedure execution.'],
      },
      'Ground Checks': {
        1: ['Ground checks were poorly conducted and incomplete.', 'Missed several required items during ground checks.', 'Ground check discipline was below standard.', 'Required frequent prompting during ground checks.'],
        2: ['Ground checks were completed with some omissions.', 'Demonstrated basic understanding of ground check requirements.', 'Ground checks were adequate but inconsistent.', 'Some errors were evident during ground checks.'],
        3: ['Ground checks were completed satisfactorily.', 'Demonstrated acceptable discipline during ground checks.', 'Ground checks met the expected standard.', 'Completed ground checks with minor errors only.'],
        4: ['Ground checks were completed accurately and confidently.', 'Demonstrated strong procedural discipline during ground checks.', 'Ground checks were well conducted and above standard.', 'Completed ground checks with good accuracy and flow.'],
        5: ['Ground checks were completed flawlessly.', 'Demonstrated excellent discipline and accuracy during ground checks.', 'Ground checks were conducted to an exceptional standard.', 'Set the benchmark for ground check execution.'],
      },
      'Airborne Checks': {
        1: ['Airborne checks were poorly managed and incomplete.', 'Missed key items during airborne checks.', 'Required significant prompting to complete airborne checks.', 'Airborne check discipline was below standard.'],
        2: ['Airborne checks were completed with some errors.', 'Demonstrated basic understanding of airborne check requirements.', 'Airborne checks were adequate but lacked consistency.', 'Some omissions were evident during airborne checks.'],
        3: ['Airborne checks were completed satisfactorily.', 'Demonstrated acceptable airborne check discipline.', 'Airborne checks met the expected standard.', 'Completed airborne checks with only minor errors.'],
        4: ['Airborne checks were completed confidently and accurately.', 'Demonstrated strong airborne check discipline.', 'Airborne checks were well managed throughout.', 'Completed airborne checks to a high standard.'],
        5: ['Airborne checks were completed flawlessly.', 'Demonstrated excellent discipline during airborne checks.', 'Airborne checks were executed to an exceptional standard.', 'Set the benchmark for airborne check performance.'],
      },
      'Stationary': {
        1: ['Stationary handling before takeoff was poorly managed.', 'Struggled to maintain correct control while stationary.', 'Demonstrated weak procedure discipline in the stationary phase.', 'Required repeated prompting during stationary takeoff actions.'],
        2: ['Stationary handling was completed with some errors.', 'Demonstrated basic control during the stationary phase.', 'Stationary actions were adequate but inconsistent.', 'Some prompting was required during the stationary phase.'],
        3: ['Stationary takeoff actions were completed satisfactorily.', 'Demonstrated acceptable control and discipline while stationary.', 'Stationary handling met the expected standard.', 'Managed the stationary phase with minor errors only.'],
        4: ['Stationary handling was confident and well controlled.', 'Demonstrated strong discipline in the stationary phase.', 'Completed stationary takeoff actions to a high standard.', 'Stationary control was above the expected standard.'],
        5: ['Stationary handling was excellent throughout.', 'Demonstrated exceptional control and discipline while stationary.', 'Completed stationary takeoff actions flawlessly.', 'Set the benchmark in the stationary takeoff phase.'],
      },
      'Visual': {
        1: ['Visual departure was poorly flown and below standard.', 'Struggled to maintain the correct departure profile.', 'Required frequent correction during the visual departure.', 'Demonstrated limited confidence in the visual departure phase.'],
        2: ['Visual departure was completed with some inconsistencies.', 'Demonstrated basic understanding of the departure profile.', 'Visual departure control was adequate but variable.', 'Some corrections were required during departure.'],
        3: ['Visual departure was flown satisfactorily.', 'Maintained an acceptable visual departure profile.', 'Demonstrated sound handling during the visual departure.', 'Visual departure met the expected standard.'],
        4: ['Visual departure was flown confidently and accurately.', 'Maintained a strong and consistent departure profile.', 'Demonstrated above-standard handling on departure.', 'Visual departure was well managed throughout.'],
        5: ['Visual departure was flown exceptionally well.', 'Demonstrated excellent control and precision on departure.', 'Maintained an outstanding departure profile throughout.', 'Set the benchmark for visual departure execution.'],
      },
      'Effects of Control': {
        1: ['Demonstrated poor understanding of the effects of control.', 'Struggled to recognise and apply control inputs correctly.', 'Effects of control were not understood to the required standard.', 'Required repeated correction when demonstrating control effects.'],
        2: ['Demonstrated basic understanding of the effects of control.', 'Some correct responses were evident, though inconsistent.', 'Effects of control knowledge is developing but incomplete.', 'Applied control inputs with mixed accuracy.'],
        3: ['Demonstrated satisfactory understanding of the effects of control.', 'Recognised and applied control inputs to an acceptable standard.', 'Effects of control were understood at the expected level.', 'Managed control inputs with minor errors only.'],
        4: ['Demonstrated strong understanding of the effects of control.', 'Applied control inputs accurately and with confidence.', 'Showed above-standard awareness of aircraft response.', 'Effects of control were well demonstrated throughout.'],
        5: ['Demonstrated excellent understanding of the effects of control.', 'Applied control inputs with exceptional precision and awareness.', 'Showed an outstanding grasp of aircraft response.', 'Set the benchmark in demonstrating the effects of control.'],
      },
      'Trimming': {
        1: ['Struggled to trim the aircraft correctly.', 'Trimming technique was poor and inconsistent.', 'Required repeated prompting to maintain correct trim.', 'Demonstrated limited understanding of trimming requirements.'],
        2: ['Basic trimming was evident but inconsistent.', 'Demonstrated some understanding of trimming technique.', 'Trimming was adequate at times but lacked accuracy.', 'Required occasional correction when trimming.'],
        3: ['Trimming was completed to a satisfactory standard.', 'Demonstrated acceptable trim technique throughout.', 'Managed aircraft trim with only minor errors.', 'Trimming met the expected standard for this stage.'],
        4: ['Demonstrated strong and accurate trimming technique.', 'Maintained aircraft trim confidently throughout.', 'Trimming was smooth and above standard.', 'Showed good anticipation in trim management.'],
        5: ['Demonstrated excellent trimming technique throughout.', 'Managed trim with exceptional accuracy and finesse.', 'Aircraft was consistently well trimmed in all phases.', 'Set the benchmark for trimming performance.'],
      },
      'Straight and Level': {
        1: ['Struggled to maintain straight and level flight.', 'Control in straight and level was below standard.', 'Frequent deviations occurred in attitude and altitude.', 'Required continuous correction in straight and level.'],
        2: ['Straight and level flight was maintained inconsistently.', 'Demonstrated basic ability in straight and level.', 'Some acceptable control was evident, though variable.', 'Minor to moderate deviations were common.'],
        3: ['Maintained straight and level flight satisfactorily.', 'Demonstrated acceptable control in straight and level.', 'Straight and level performance met the expected standard.', 'Only minor deviations were evident.'],
        4: ['Maintained straight and level flight accurately and confidently.', 'Demonstrated strong control in straight and level.', 'Straight and level performance was above standard.', 'Held attitude and altitude with good precision.'],
        5: ['Maintained excellent straight and level flight throughout.', 'Demonstrated exceptional precision and control.', 'Straight and level performance was of benchmark standard.', 'Held the aircraft steadily and accurately at all times.'],
      },
      'Level medium Turn': {
        1: ['Struggled to maintain control in level medium turns.', 'Level medium turns were poorly executed.', 'Significant deviations occurred during the turn.', 'Required repeated correction throughout level medium turns.'],
        2: ['Level medium turns were completed with some errors.', 'Demonstrated basic understanding of the manoeuvre.', 'Control during level medium turns was inconsistent.', 'Some deviations were evident in altitude and balance.'],
        3: ['Level medium turns were flown satisfactorily.', 'Demonstrated acceptable control throughout the manoeuvre.', 'Level medium turns met the expected standard.', 'Minor deviations only during execution.'],
        4: ['Level medium turns were flown confidently and accurately.', 'Demonstrated strong control and coordination in the turn.', 'Level medium turns were above the expected standard.', 'Maintained good precision throughout the manoeuvre.'],
        5: ['Level medium turns were flown exceptionally well.', 'Demonstrated excellent coordination and precision.', 'Executed level medium turns to a benchmark standard.', 'Maintained outstanding control throughout the manoeuvre.'],
      },
      'Level Steep turn': {
        1: ['Struggled significantly during level steep turns.', 'Level steep turns were below the required standard.', 'Control and accuracy in steep turns were poor.', 'Required substantial correction during steep turns.'],
        2: ['Demonstrated basic ability in level steep turns.', 'Steep turns were completed with several inconsistencies.', 'Control during steep turns was variable.', 'Some understanding was evident, but accuracy was limited.'],
        3: ['Level steep turns were completed satisfactorily.', 'Demonstrated acceptable control during steep turns.', 'Steep turn performance met the expected standard.', 'Only minor deviations were evident.'],
        4: ['Level steep turns were flown confidently and accurately.', 'Demonstrated strong control and coordination in steep turns.', 'Steep turns were above the expected standard.', 'Maintained good precision throughout the manoeuvre.'],
        5: ['Level steep turns were flown exceptionally well.', 'Demonstrated excellent precision, balance and control.', 'Executed steep turns to a benchmark standard.', 'Maintained outstanding accuracy throughout the manoeuvre.'],
      },
      'Visual - Initial & Pitch': {
        1: ['Recovery actions were poorly executed.', 'Struggled to apply correct initial and pitch recovery actions.', 'Recovery technique was below standard.', 'Required repeated prompting during the recovery sequence.'],
        2: ['Demonstrated basic recovery technique with errors.', 'Initial and pitch recovery actions were inconsistent.', 'Some correct actions were evident, though not reliable.', 'Recovery performance requires further development.'],
        3: ['Recovery actions were completed satisfactorily.', 'Demonstrated acceptable initial and pitch recovery technique.', 'Recovery performance met the expected standard.', 'Minor errors only during the recovery sequence.'],
        4: ['Recovery actions were completed confidently and accurately.', 'Demonstrated strong technique in initial and pitch recovery.', 'Recovery performance was above the expected standard.', 'Managed the recovery sequence with good precision.'],
        5: ['Recovery actions were executed exceptionally well.', 'Demonstrated excellent technique throughout the recovery sequence.', 'Initial and pitch recovery were completed to a benchmark standard.', 'Recovery performance was precise, confident and highly effective.'],
      },
      'Landing': {
        1: ['Landing performance was below the required standard.', 'Struggled to manage the landing sequence safely and accurately.', 'Landing technique was poor and inconsistent.', 'Required significant assistance during landing.'],
        2: ['Landing was completed with some errors.', 'Demonstrated basic landing technique, though inconsistently.', 'Control during landing was adequate at times.', 'Landing performance requires further refinement.'],
        3: ['Landing was completed to a satisfactory standard.', 'Demonstrated acceptable landing technique overall.', 'Landing performance met the expected standard.', 'Minor errors only during the landing sequence.'],
        4: ['Landing was completed confidently and accurately.', 'Demonstrated strong landing technique and control.', 'Landing performance was above the expected standard.', 'Managed the landing sequence smoothly and effectively.'],
        5: ['Landing was executed exceptionally well.', 'Demonstrated excellent judgment, control and technique.', 'Landing performance was of benchmark standard.', 'Completed the landing sequence with outstanding precision.'],
      },
      'Crosswind': {
        1: ['Struggled significantly with crosswind landing technique.', 'Crosswind control was below the required standard.', 'Demonstrated poor correction for crosswind conditions.', 'Required significant assistance during crosswind landing.'],
        2: ['Demonstrated basic crosswind technique with inconsistencies.', 'Some correct crosswind inputs were evident.', 'Crosswind landing performance was adequate but variable.', 'Requires further development in crosswind control.'],
        3: ['Managed crosswind conditions to a satisfactory standard.', 'Demonstrated acceptable crosswind landing technique.', 'Crosswind performance met the expected standard.', 'Applied appropriate corrections with minor errors only.'],
        4: ['Managed crosswind conditions confidently and accurately.', 'Demonstrated strong crosswind correction and control.', 'Crosswind landing performance was above standard.', 'Applied appropriate inputs smoothly and effectively.'],
        5: ['Demonstrated excellent crosswind landing technique throughout.', 'Managed crosswind conditions with exceptional control.', 'Crosswind performance was of benchmark standard.', 'Applied precise and confident corrections at all times.'],
      },
      'Radio Comms': {
        1: ['Radio calls were unclear and below standard.', 'Struggled to make correct and timely radio calls.', 'Radio communication required frequent correction.', 'Demonstrated poor radio discipline.'],
        2: ['Basic radio calls were made, though inconsistently.', 'Demonstrated partial understanding of required phraseology.', 'Radio communications were adequate at times.', 'Some calls lacked clarity or timeliness.'],
        3: ['Radio communications were satisfactory overall.', 'Demonstrated acceptable phraseology and timing.', 'Radio calls met the expected standard.', 'Communicated effectively with only minor errors.'],
        4: ['Radio communications were clear and well timed.', 'Demonstrated strong radio discipline and phraseology.', 'Radio calls were above the expected standard.', 'Communicated confidently and effectively throughout.'],
        5: ['Radio communications were excellent throughout.', 'Demonstrated exceptional clarity, timing and discipline.', 'Radio calls were of benchmark standard.', 'Communicated professionally and precisely at all times.'],
      },
      'Situational Awareness': {
        1: ['Situational awareness was poor throughout the sortie.', 'Struggled to maintain awareness of the overall situation.', 'Frequently lost awareness of aircraft state and environment.', 'Required repeated prompting to regain situational awareness.'],
        2: ['Demonstrated basic situational awareness, though inconsistently.', 'Awareness of aircraft state and environment was variable.', 'Some important cues were missed during the sortie.', 'Situational awareness requires further development.'],
        3: ['Maintained satisfactory situational awareness overall.', 'Demonstrated acceptable awareness of aircraft state and environment.', 'Situational awareness met the expected standard.', 'Minor lapses only, with timely recovery.'],
        4: ['Maintained strong situational awareness throughout.', 'Demonstrated good awareness of aircraft state, position and threats.', 'Situational awareness was above the expected standard.', 'Anticipated developments well during the sortie.'],
        5: ['Situational awareness was excellent at all times.', 'Demonstrated exceptional awareness of the full operating picture.', 'Anticipated changes and threats with maturity and confidence.', 'Set the benchmark for situational awareness.'],
      },
      'Lookout': {
        1: ['Lookout was ineffective and below standard.', 'Failed to maintain an adequate visual scan.', 'Demonstrated poor lookout discipline throughout.', 'Required repeated prompting to maintain lookout.'],
        2: ['Demonstrated basic lookout, though inconsistently.', 'Visual scan was present but not sustained.', 'Lookout discipline requires further development.', 'Some threats or cues were not detected promptly.'],
        3: ['Maintained satisfactory lookout throughout most phases.', 'Demonstrated acceptable visual scan discipline.', 'Lookout met the expected standard overall.', 'Minor lapses only in scan effectiveness.'],
        4: ['Maintained a strong and consistent lookout.', 'Demonstrated good visual scan discipline throughout.', 'Lookout was above the expected standard.', 'Detected and responded to cues effectively.'],
        5: ['Lookout was excellent throughout the sortie.', 'Demonstrated exceptional visual scan discipline and awareness.', 'Maintained continuous and highly effective lookout.', 'Set the benchmark for lookout performance.'],
      },
      'Knowledge': {
        1: ['Knowledge level was below the required standard.', 'Demonstrated significant gaps in required knowledge.', 'Struggled to answer basic knowledge questions.', 'Knowledge deficiencies affected task performance.'],
        2: ['Demonstrated basic knowledge, though with some gaps.', 'Some understanding was evident, but application was inconsistent.', 'Knowledge was adequate in parts only.', 'Requires further consolidation of key knowledge areas.'],
        3: ['Demonstrated satisfactory knowledge for this stage.', 'Knowledge met the expected standard overall.', 'Showed sound understanding of key concepts.', 'Applied knowledge adequately during the sortie.'],
        4: ['Demonstrated strong knowledge throughout.', 'Showed good understanding and application of key concepts.', 'Knowledge was above the expected standard.', 'Applied knowledge confidently and effectively.'],
        5: ['Demonstrated excellent knowledge in all assessed areas.', 'Showed exceptional understanding and application throughout.', 'Knowledge was of benchmark standard.', 'Applied knowledge with confidence, accuracy and depth.'],
      },
    };

    // Helper: pick a random comment for a given element and grade
    const getElementComment = (element, grade, randFn) => {
      const pool = (ELEMENT_COMMENTS[element] && ELEMENT_COMMENTS[element][grade]) || [];
      if (pool.length === 0) return 'Standard met.';
      return pool[Math.floor(randFn() * pool.length)];
    };

    // Track marginal events per course per date (at most one per course per day)
    // Key: `${course}-${dateStr}`, value: true if marginal already assigned for that course+day
    const marginalUsed = {};

    // Process each trainee
    for (const trainee of trainees) {
      const course = trainee.course;
      const config = courseConfig[course];
      if (!config) continue; // Skip courses not in config (ADF304, ADF305, IFF6 etc)

      const syllabus = config.lmpType === 'FIC' ? FIC_SYLLABUS : BPC_IPC_SYLLABUS;

      // Each trainee gets a unique seed based on their id/idNumber
      const seedVal = trainee.idNumber ? parseInt(String(trainee.idNumber).replace(/\D/g, '') || '0') : parseInt(trainee.id.slice(-8), 16);
      const rand = seededRand(isNaN(seedVal) ? 42 : seedVal);

      // Determine the last syllabus index for this trainee
      let traineeLastIdx;

      if (config.progressRange) {
        // Range-based progress: randomly pick an index within [rangeStartIdx, rangeEndIdx]
        const [rangeStartEvent, rangeEndEvent] = config.progressRange;
        const rangeStartIdx = syllabus.indexOf(rangeStartEvent);
        const rangeEndIdx = syllabus.indexOf(rangeEndEvent);

        if (rangeStartIdx === -1) {
          console.warn(`⚠️ Range start event '${rangeStartEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }
        if (rangeEndIdx === -1) {
          console.warn(`⚠️ Range end event '${rangeEndEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }

        const rangeSize = rangeEndIdx - rangeStartIdx + 1;
        traineeLastIdx = rangeStartIdx + Math.floor(rand() * rangeSize);
        console.log(`📍 ${trainee.fullName} (${course}): progress at index ${traineeLastIdx} → '${syllabus[traineeLastIdx]}' (range: '${rangeStartEvent}' to '${rangeEndEvent}')`);
      } else {
        // FIC courses: use centreEvent ± 3 logic (unchanged)
        const centreIdx = syllabus.indexOf(config.centreEvent);
        if (centreIdx === -1) {
          console.warn(`⚠️ Centre event '${config.centreEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }
        const progressOffset = Math.floor(rand() * 7) - 3; // -3 to +3
        traineeLastIdx = Math.max(0, Math.min(syllabus.length - 1, centreIdx + progressOffset));
      }

      const eventsToGenerate = syllabus.slice(0, traineeLastIdx + 1);

      if (eventsToGenerate.length === 0) continue;

      // Date spread: from course start to today
      const startDate = new Date(config.startDate);
      const endDate = new Date(today);
      // Each trainee's last event is 0-14 days ago (± 2 weeks spread)
      const trailingDays = Math.floor(rand() * 15); // 0-14 days ago
      endDate.setDate(endDate.getDate() - trailingDays);
      const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
      const eventCount = eventsToGenerate.length;

      // ±14 day overall schedule offset per trainee
      const dateOffsetDays = Math.floor(rand() * 29) - 14;

      // Pick 3-4 instructors to use for this trainee (realistic - not all instructors every time)
      const shuffledInstructors = [...qfiInstructors].sort(() => rand() - 0.5);
      const traineeInstructors = shuffledInstructors.slice(0, 3 + Math.floor(rand() * 2));

      // Initialise completed events tracker for this trainee
      if (!traineeCompletedEvents[trainee.id]) {
        traineeCompletedEvents[trainee.id] = {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType: config.lmpType,
          completedIds: new Set(),
        };
      }

      for (let i = 0; i < eventsToGenerate.length; i++) {
        const code = eventsToGenerate[i];
        const eventType = getEventType(code);
        const duration = getEventDuration(code, config.lmpType);

        // Calculate date for this event (evenly distributed across the course date range)
        const progressFraction = eventCount > 1 ? i / (eventCount - 1) : 0;
        const dayOffset = Math.floor(progressFraction * totalDays);
        const eventDate = new Date(startDate);
        eventDate.setDate(eventDate.getDate() + dayOffset + dateOffsetDays);

        // Clamp to valid range
        if (eventDate > today) eventDate.setTime(today.getTime() - 24 * 60 * 60 * 1000);
        if (eventDate < startDate) eventDate.setTime(startDate.getTime());

        // Skip weekends
        while (eventDate.getDay() === 0 || eventDate.getDay() === 6) {
          eventDate.setDate(eventDate.getDate() + 1);
        }

        const dateStr = eventDate.toISOString().split('T')[0];
        const instructor = traineeInstructors[i % traineeInstructors.length];

        // Start time: 8am-14pm range, in 0.5hr increments
        const startHour = 8 + Math.floor(rand() * 6);
        const startTime = startHour + (rand() > 0.5 ? 0.5 : 0);

        const eventId = makeEventId(trainee.id, code, dateStr);

        // Build ScheduleEvent (training record)
        const scheduleEvent = {
          id: eventId,
          date: dateStr,
          type: eventType,
          instructor: instructor.name,
          student: trainee.fullName,
          flightNumber: code,
          eventCode: code,
          duration: duration,
          startTime: startTime,
          resourceId: eventType === 'flight' ? 'aircraft-hist' : (eventType === 'ftd' ? 'ftd-1' : 'ground-1'),
          color: '#4CAF50',
          flightType: 'Dual',
          locationType: 'Local',
          origin: 'YMES',
          destination: 'YMES',
          traineeId: trainee.idNumber,
          isHistoricalSeed: true,
        };

        // Add to publishedSchedules
        if (!publishedSchedules[dateStr]) publishedSchedules[dateStr] = [];
        publishedSchedules[dateStr].push(scheduleEvent);

        // Generate logbook entry for ALL flying events (flight type only)
        if (eventType === 'flight') {
          const logbookId = `logbook-${eventId}`;
          const logbookEntry = {
            id: logbookId,
            date: dateStr,
            type: 'logbook',
            instructor: instructor.name,
            student: trainee.fullName,
            flightNumber: code,
            eventCode: code,
            duration: duration,
            startTime: startTime,
            resourceId: 'aircraft-hist',
            color: '#2196F3',
            flightType: 'Dual',
            locationType: 'Local',
            origin: 'YMES',
            destination: 'YMES',
            traineeId: trainee.idNumber,
            isHistoricalSeed: true,
            isLogbook: true,
            parentEventId: eventId,
          };
          // Logbook entries stored under same date key with logbook flag
          publishedSchedules[dateStr].push(logbookEntry);
        }

        // Generate PT-051 for ALL event types
        // Flight/FTD: full assessment with graded elements and element-specific comments
        // Ground/other: DCO-only record (no element scores required)
        if (eventType === 'flight' || eventType === 'ftd') {
          const pt051Key = `pt051-${eventId}-${trainee.fullName}`;
          const marginalKey = `${course}-${dateStr}`;

          // One marginal (grade 2) event allowed per course per day
          // ~15% probability - only if not already used for this course+day
          const canBeMarginal = !marginalUsed[marginalKey] && rand() < 0.15;
          const isMarginalEvent = canBeMarginal;
          if (isMarginalEvent) marginalUsed[marginalKey] = true;

          // Overall grade: 3-5 normally, 2 if marginal
          let overallGrade;
          if (isMarginalEvent) {
            overallGrade = 2;
          } else {
            // Weighted: mostly 3-4, occasionally 5
            const overallPool = [3, 3, 3, 4, 4, 4, 3, 4, 3, 5, 3, 4, 3, 3, 4];
            overallGrade = overallPool[Math.floor(rand() * overallPool.length)];
          }

          // Generate scores for all 22 elements with element-specific comments
          // Grade scale: 1=Unsatisfactory, 2=Marginal, 3=Satisfactory, 4=Above Standard, 5=Exceptional
          const scores = ALL_ELEMENTS.map(element => {
            let grade;
            if (isMarginalEvent) {
              // Marginal event: mix of 2s and 3s, no 1s (clean progression)
              const marginalPool = [2, 2, 3, 2, 3, 3, 2, 3, 2, 3];
              grade = marginalPool[Math.floor(rand() * marginalPool.length)];
            } else if (overallGrade >= 4) {
              // Above-standard event: 3s, 4s, and 5s
              const highPool = [3, 4, 4, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4, 5];
              grade = highPool[Math.floor(rand() * highPool.length)];
            } else {
              // Standard event: 3s and 4s
              grade = gradePool[Math.floor(rand() * gradePool.length)];
            }
            // Use element-specific comment matching the assigned grade
            const comment = getElementComment(element, grade, rand);
            return { element, grade, comment };
          });

          // Overall result: P/F reflects trainee performance; DCO reflects duty carried out
          const overallResult = overallGrade >= 2 ? 'P' : 'F';

          pt051Assessments[pt051Key] = {
            id: pt051Key,
            traineeFullName: trainee.fullName,
            eventId: eventId,
            flightNumber: code,
            date: dateStr,
            instructorName: instructor.name,
            overallGrade,
            overallResult,
            dcoResult: 'DCO',
            overallComments: overallGrade >= 5 ? 'Exceptional performance throughout. All elements met or exceeded.' :
                             overallGrade === 4 ? 'Strong performance. Standards consistently met and exceeded.' :
                             overallGrade === 3 ? 'Satisfactory performance. All required standards achieved.' :
                             'Performance met minimum standard. Consolidation required on some elements.',
            startTime,
            duration,
            endTime: startTime + duration,
            scores,
            isCompleted: true,
            isHistoricalSeed: true,
          };

          // Mark this event as completed in IndividualLMP (PT-051 exists = completed)
          // Strip asterisks for LMP matching (e.g. 'BIF FTD1*' → 'BIF FTD1')
          const normalizedCode = code.replace('*', '');
          traineeCompletedEvents[trainee.id].completedIds.add(normalizedCode);

        } else {
          // Ground/non-flight events: generate a DCO-only PT-051 record (no element scores)
          const pt051Key = `pt051-${eventId}-${trainee.fullName}`;
          pt051Assessments[pt051Key] = {
            id: pt051Key,
            traineeFullName: trainee.fullName,
            eventId: eventId,
            flightNumber: code,
            date: dateStr,
            instructorName: instructor.name,
            overallGrade: null,
            overallResult: null,
            dcoResult: 'DCO',
            overallComments: '',
            startTime,
            duration,
            endTime: startTime + duration,
            scores: [],
            isCompleted: true,
            isHistoricalSeed: true,
          };

          // Mark ground events as completed in IndividualLMP as well
          const normalizedCode = code.replace('*', '');
          traineeCompletedEvents[trainee.id].completedIds.add(normalizedCode);
        }

        // Add score record for DB persistence
        // Flight/FTD: use the overallGrade value (1-5); ground: percentage (70-100)
        const scoreVal = eventType === 'ground'
          ? 70 + Math.floor(rand() * 31)  // 70-100%
          : 3 + Math.floor(rand() * 3);   // 3-5 (no fails in clean progression)
        scoreRecords.push({
          traineeId: trainee.id,
          event: code,
          score: scoreVal,
          date: eventDate,
          instructor: instructor.name,
          notes: `Historical seed: ${course} - ${code}`,
        });
      }
    }

    // Save scores to DB (scores were cleared above, so no duplicates expected)
    let scoresInserted = 0;
    let scoresSkipped = 0;

    for (const rec of scoreRecords) {
      try {
        await db.score.create({ data: rec });
        scoresInserted++;
      } catch (err) {
        // Fallback: skip if a duplicate somehow exists
        console.warn(`⚠️ Could not insert score for trainee ${rec.traineeId} event ${rec.event}:`, err.message);
        scoresSkipped++;
      }
    }

    // Update IndividualLMP for each processed trainee
    // Set completedEventIds to the set of events that have a PT-051 assessment
    let lmpUpdated = 0;
    let lmpSkipped = 0;

    for (const [traineeId, data] of Object.entries(traineeCompletedEvents)) {
      try {
        const completedEventIds = Array.from(data.completedIds);

        // Apply BIF FTD dependency rules (mirror the lmp-sync + fix-bif-ftd-dependencies logic)
        // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
        if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
          completedEventIds.push('BIF FTD1');
          console.log(`📍 ${data.traineeFullName}: Auto-marking BIF FTD1 complete (BIF FTD2 is complete)`);
        }
        // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
        if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
          completedEventIds.push('BIF FTD3');
          console.log(`📍 ${data.traineeFullName}: Auto-marking BIF FTD3 complete (BIF1 is complete)`);
        }
        // Rule 3: Remove asterisk variants if clean versions already present
        const deduplicated = completedEventIds.filter(id => {
          if (id === 'BIF FTD1*' && completedEventIds.includes('BIF FTD1')) return false;
          if (id === 'BIF FTD3*' && completedEventIds.includes('BIF FTD3')) return false;
          return true;
        });

        await db.individualLMP.upsert({
          where: { traineeId },
          update: {
            traineeFullName: data.traineeFullName,
            lmpType: data.lmpType,
            completedEventIds: deduplicated,
            updatedAt: new Date(),
          },
          create: {
            traineeId,
            traineeFullName: data.traineeFullName,
            lmpType: data.lmpType,
            events: [],
            completedEventIds: deduplicated,
          },
        });

        console.log(`✅ IndividualLMP updated for ${data.traineeFullName}: ${deduplicated.length} events completed`);
        lmpUpdated++;
      } catch (err) {
        console.warn(`⚠️ Could not update IndividualLMP for traineeId ${traineeId}:`, err.message);
        lmpSkipped++;
      }
    }

    // ----------------------------------------------------------------
    // POST-SEED: Run BIF FTD dependency fix across ALL active ADF trainees
    // This catches any trainees whose IndividualLMP was not touched by this
    // seed run (e.g. trainees on courses not in courseConfig) but who may
    // already have BIF FTD2 or BIF1 in their completedEventIds from a
    // previous sync or manual entry.
    // ----------------------------------------------------------------
    console.log('🔧 Running BIF FTD dependency fix across all active ADF trainees...');
    try {
      const adfTrainees = await db.trainee.findMany({
        where: { isActive: true, course: { startsWith: 'ADF' } },
        include: { individualLMP: true },
      });

      let ftd1Fixed = 0, ftd3Fixed = 0, asterisksRemoved = 0;

      for (const t of adfTrainees) {
        if (!t.individualLMP) continue;
        const ids = t.individualLMP.completedEventIds || [];
        const updated = [...ids];
        let changed = false;

        if (updated.includes('BIF FTD2') && !updated.includes('BIF FTD1')) {
          updated.push('BIF FTD1');
          changed = true;
          ftd1Fixed++;
          console.log(`🔧 ${t.fullName}: BIF FTD1 marked complete (BIF FTD2 done)`);
        }
        if (updated.includes('BIF1') && !updated.includes('BIF FTD3')) {
          updated.push('BIF FTD3');
          changed = true;
          ftd3Fixed++;
          console.log(`🔧 ${t.fullName}: BIF FTD3 marked complete (BIF1 done)`);
        }

        // Remove asterisk variants
        const filtered = updated.filter(id => {
          if (id === 'BIF FTD1*' && updated.includes('BIF FTD1')) return false;
          if (id === 'BIF FTD3*' && updated.includes('BIF FTD3')) return false;
          return true;
        });
        if (filtered.length !== updated.length) {
          updated.splice(0, updated.length, ...filtered);
          changed = true;
          asterisksRemoved++;
        }

        if (changed) {
          await db.individualLMP.update({
            where: { traineeId: t.id },
            data: { completedEventIds: updated, updatedAt: new Date() },
          });
        }
      }

      console.log(`✅ BIF FTD fix complete: FTD1 fixed=${ftd1Fixed}, FTD3 fixed=${ftd3Fixed}, asterisks removed=${asterisksRemoved}`);
    } catch (bifErr) {
      console.warn('⚠️ BIF FTD post-seed fix encountered an error:', bifErr.message);
    }

    // Save publishedSchedules and pt051Assessments to DataBackup
    await db.dataBackup.create({
      data: { type: 'historical_published_schedules', data: publishedSchedules }
    });

    await db.dataBackup.create({
      data: { type: 'historical_pt051_assessments', data: pt051Assessments }
    });

    const metadata = {
      seededAt: new Date().toISOString(),
      traineeCount: trainees.filter(t => courseConfig[t.course]).length,
      eventCount: Object.values(publishedSchedules).flat().length,
      pt051Count: Object.keys(pt051Assessments).length,
      scoresInserted,
      scoresSkipped,
      lmpUpdated,
      lmpSkipped,
      bifFtdDependenciesApplied: true,
      coursesSeeded: [...new Set(trainees.filter(t => courseConfig[t.course]).map(t => t.course))],
    };

    await db.dataBackup.create({
      data: { type: 'historical_seeding_metadata', data: metadata }
    });

    console.log(`✅ Historical seeding complete:`, metadata);
    res.json({ success: true, ...metadata });

  } catch (error) {
    console.error('❌ POST /api/historical-data/seed error:', error);
    res.status(500).json({ error: 'Failed to seed historical data', details: error.message });
  }
});

// POST /api/historical-data/refresh-dates - Shift all historical dates forward relative to today
// This is the ongoing refresh feature to keep historical data current-looking
app.post('/api/historical-data/refresh-dates', async (req, res) => {
  try {
    const db = await getPrisma();

    // Load current historical data
    const schedulesBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_published_schedules' },
      orderBy: { createdAt: 'desc' }
    });
    const pt051Backup = await db.dataBackup.findFirst({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' }
    });
    const metaBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    if (!schedulesBackup || !metaBackup) {
      return res.status(400).json({ error: 'No historical data found. Run seeding first.' });
    }

    const publishedSchedules = schedulesBackup.data;
    const pt051Assessments = pt051Backup ? pt051Backup.data : {};
    const metadata = metaBackup.data;

    const seededAt = new Date(metadata.seededAt);
    const today = new Date();
    const daysDrift = Math.floor((today - seededAt) / (1000 * 60 * 60 * 24));

    if (daysDrift <= 0) {
      return res.json({ success: true, message: 'No date refresh needed - data is already current', daysDrift });
    }

    // Shift all event dates forward by daysDrift, preserving sequence and spacing
    const newPublishedSchedules = {};
    const dateMap = {}; // old date -> new date

    for (const [dateStr, events] of Object.entries(publishedSchedules)) {
      const oldDate = new Date(dateStr);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + daysDrift);

      // Clamp to today max
      if (newDate > today) newDate.setTime(today.getTime() - 24 * 60 * 60 * 1000);

      const newDateStr = newDate.toISOString().split('T')[0];
      dateMap[dateStr] = newDateStr;

      if (!newPublishedSchedules[newDateStr]) newPublishedSchedules[newDateStr] = [];
      const updatedEvents = events.map(e => ({ ...e, date: newDateStr }));
      newPublishedSchedules[newDateStr].push(...updatedEvents);
    }

    // Update PT-051 dates
    const newPt051Assessments = {};
    for (const [key, assessment] of Object.entries(pt051Assessments)) {
      const newDate = dateMap[assessment.date] || assessment.date;
      newPt051Assessments[key] = { ...assessment, date: newDate };
    }

    // Update score dates in DB
    const scores = await db.score.findMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    let scoresUpdated = 0;
    for (const score of scores) {
      const oldDateStr = score.date.toISOString().split('T')[0];
      const newDateStr = dateMap[oldDateStr];
      if (newDateStr && newDateStr !== oldDateStr) {
        await db.score.update({
          where: { id: score.id },
          data: { date: new Date(newDateStr) }
        });
        scoresUpdated++;
      }
    }

    // Save refreshed data
    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.create({
      data: { type: 'historical_published_schedules', data: newPublishedSchedules }
    });

    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.create({
      data: { type: 'historical_pt051_assessments', data: newPt051Assessments }
    });

    // Update metadata
    const newMetadata = {
      ...metadata,
      seededAt: new Date().toISOString(),
      lastRefreshed: new Date().toISOString(),
      daysDriftApplied: daysDrift,
    };

    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });
    await db.dataBackup.create({
      data: { type: 'historical_seeding_metadata', data: newMetadata }
    });

    const result = {
      success: true,
      daysDriftApplied: daysDrift,
      datesUpdated: Object.keys(dateMap).length,
      scoresUpdated,
      newEventCount: Object.values(newPublishedSchedules).flat().length,
      newPt051Count: Object.keys(newPt051Assessments).length,
    };

    console.log(`✅ Date refresh complete:`, result);
    res.json(result);

  } catch (error) {
    console.error('❌ POST /api/historical-data/refresh-dates error:', error);
    res.status(500).json({ error: 'Failed to refresh dates', details: error.message });
  }
});

// DELETE /api/historical-data - Clear all seeded historical data
app.delete('/api/historical-data', async (req, res) => {
  try {
    const db = await getPrisma();

    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });

    // Delete seeded scores
    const deleted = await db.score.deleteMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    console.log(`✅ DELETE /api/historical-data - Cleared historical data, deleted ${deleted.count} scores`);
    res.json({ success: true, scoresDeleted: deleted.count });
  } catch (error) {
    console.error('❌ DELETE /api/historical-data error:', error);
    res.status(500).json({ error: 'Failed to clear historical data', details: error.message });
  }
});

// POST /api/scores/bulk - Bulk insert scores (for seeding)
// ============================================================
// DAILY SNAPSHOT TABLE SETUP & ENDPOINTS
// ============================================================

async function ensureDailySnapshotTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailySnapshot" (
        "id" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "scheduleEvents" JSONB NOT NULL DEFAULT '[]',
        "staffEvents" JSONB NOT NULL DEFAULT '[]',
        "traineeEvents" JSONB NOT NULL DEFAULT '[]',
        "pt051Assessments" JSONB NOT NULL DEFAULT '{}',
        "traineeProfiles" JSONB NOT NULL DEFAULT '[]',
        "staffProfiles" JSONB NOT NULL DEFAULT '[]',
        "lmpCompletedIds" JSONB NOT NULL DEFAULT '{}',
        "staffCurrency" JSONB NOT NULL DEFAULT '{}',
        "staffLogbook" JSONB NOT NULL DEFAULT '{}',
        "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "savedBy" TEXT,
        CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
      );
    `);
    // Add staffProfiles column if it doesn't exist (for existing tables)
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "staffProfiles" JSONB NOT NULL DEFAULT '[]';
    `);
    // Add baselineEvents column if it doesn't exist (for existing tables)
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "baselineEvents" JSONB DEFAULT NULL;
    `);
    // Add alertsData column for change-alert workflow
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "alertsData" JSONB DEFAULT '{}';
    `);
    // Add aircraft configuration capacity state used by the DFP resource column
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "aircraftConfigState" JSONB DEFAULT '{}';
    `);
    // Add device tokens table for APNs push notifications
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DeviceToken" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "platform" TEXT NOT NULL DEFAULT 'ios',
        "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailySnapshot_date_key"
      ON "DailySnapshot"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailySnapshot_date_idx"
      ON "DailySnapshot"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailySnapshot_savedAt_idx"
      ON "DailySnapshot"("savedAt");
    `);
    console.log('✅ DailySnapshot table ready');
  } catch (err) {
    console.error('❌ Failed to ensure DailySnapshot table:', err.message);
  }
}

// ============================================================
// INSTRUCTOR ARRAY COLUMN MIGRATION
// ============================================================

async function ensureInstructorArrayColumns(db) {
  try {
    for (const colName of ['primaryInstructor', 'secondaryInstructor']) {
      // Check current column type using pg catalog (handles quoted identifiers properly)
      const colInfo = await db.$queryRawUnsafe(`
        SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'Trainee'
          AND a.attname = $1::text
          AND a.attnum > 0
          AND NOT a.attisdropped
      `, colName);

      if (!colInfo || colInfo.length === 0) {
        console.log(`Warning: Column "${colName}" not found in Trainee table - skipping`);
        continue;
      }

      const dataType = colInfo[0].data_type;
      console.log(`Info: Trainee."${colName}" current type: ${dataType}`);

      if (!dataType.includes('[]') && !dataType.includes('ARRAY')) {
        console.log(`Migrating Trainee."${colName}" from TEXT to TEXT[]...`);

        await db.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_attribute a
              JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
              WHERE c.relname = 'Trainee' AND a.attname = '${colName}_arr' AND NOT a.attisdropped
            ) THEN
              ALTER TABLE "Trainee" ADD COLUMN "${colName}_arr" TEXT[] DEFAULT ARRAY[]::TEXT[];
            END IF;

            UPDATE "Trainee"
            SET "${colName}_arr" = CASE
              WHEN "${colName}" IS NOT NULL AND "${colName}" <> ''
              THEN ARRAY["${colName}"]::TEXT[]
              ELSE ARRAY[]::TEXT[]
            END;

            ALTER TABLE "Trainee" DROP COLUMN IF EXISTS "${colName}";

            ALTER TABLE "Trainee" RENAME COLUMN "${colName}_arr" TO "${colName}";
          END $$;
        `);

        console.log(`Migrated "${colName}" to TEXT[]`);
      } else {
        console.log(`"${colName}" is already an array type - no migration needed`);
      }
    }
  } catch (err) {
    console.error('Failed to ensure instructor array columns:', err.message);
    // Don't rethrow - allow server to continue starting up
  }
}

// ============================================================
// TRAINEE REALLOCATION ENDPOINT
// ============================================================

// ============================================================
// REALLOCATION RULES (v2):
//   - Each trainee: exactly 1 primary instructor, min 2 secondary (up to 3)
//   - Each instructor: max 3 primary trainees, max 4 secondary trainees
//   - Same-unit assignments only
// ============================================================

// Shared allocation logic used by both preview and apply
function buildReallocation(trainees, personnel) {
  const units = ['1FTS', '2FTS', 'CFS'];
  const allResults = [];

  // Seeded deterministic shuffle for reproducibility
  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  };

  for (const unit of units) {
    const unitTrainees = trainees.filter(t => t.unit === unit);
    const unitStaff = personnel.filter(p => p.unit === unit);

    const MIN_SECONDARY_PER_TRAINEE = 2;

    const randFn = seededRandom(42);
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(randFn() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const shuffledTrainees = shuffle(unitTrainees);
    const shuffledStaff = shuffle(unitStaff);

    const nTrainees = shuffledTrainees.length;
    const nStaff = shuffledStaff.length;

    // PRIMARY ALLOCATION
    // Distribute nTrainees primary assignments across nStaff as evenly as possible.
    // base = floor(n/s), remainder staff get (base+1), rest get base.
    const primaryLoad = {};
    shuffledStaff.forEach(s => { primaryLoad[s.name] = 0; });

    const primaryMap = {};
    shuffledTrainees.forEach(t => { primaryMap[t.id] = null; });

    const primaryBase = Math.floor(nTrainees / nStaff);
    const primaryRemainder = nTrainees % nStaff;
    // primaryRemainder staff get (primaryBase+1), the rest get primaryBase
    // Staff are assigned caps in shuffledStaff order
    const primaryCap = {};
    shuffledStaff.forEach((s, i) => {
      primaryCap[s.name] = i < primaryRemainder ? primaryBase + 1 : primaryBase;
    });

    // Assign using lowest-load-first: always pick the staff member with
    // fewest assignments who still has capacity. This guarantees perfect balance.
    for (const trainee of shuffledTrainees) {
      const eligible = shuffledStaff
        .filter(s => primaryLoad[s.name] < primaryCap[s.name])
        .sort((a, b) => {
          const diff = primaryLoad[a.name] - primaryLoad[b.name];
          return diff !== 0 ? diff : shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      if (eligible.length > 0) {
        primaryMap[trainee.id] = eligible[0].name;
        primaryLoad[eligible[0].name]++;
      } else {
        // Should never happen if math is correct, but fallback gracefully
        const fallback = shuffledStaff.slice().sort((a,b) => primaryLoad[a.name] - primaryLoad[b.name])[0];
        primaryMap[trainee.id] = fallback.name;
        primaryLoad[fallback.name]++;
        console.log(`Warning: Primary cap overflow for ${trainee.name} (${unit})`);
      }
    }

    // SECONDARY ALLOCATION
    // Distribute (nTrainees * MIN_SECONDARY_PER_TRAINEE) secondary assignments
    // across nStaff as evenly as possible.
    const totalSecondary = nTrainees * MIN_SECONDARY_PER_TRAINEE;
    const secondaryBase = Math.floor(totalSecondary / nStaff);
    const secondaryRemainder = totalSecondary % nStaff;

    const secondaryLoad = {};
    shuffledStaff.forEach(s => { secondaryLoad[s.name] = 0; });

    const secondaryMap = {};
    shuffledTrainees.forEach(t => { secondaryMap[t.id] = []; });

    // Helper: pick best secondary candidate (lowest load, excluding given set)
    const pickSecondary = (excludeSet) => {
      const candidates = shuffledStaff
        .filter(s => !excludeSet.has(s.name))
        .sort((a, b) => {
          const loadDiff = secondaryLoad[a.name] - secondaryLoad[b.name];
          if (loadDiff !== 0) return loadDiff;
          return shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      return candidates.length > 0 ? candidates[0] : null;
    };

    for (let round = 0; round < MIN_SECONDARY_PER_TRAINEE; round++) {
      for (const trainee of shuffledTrainees) {
        const primaryName = primaryMap[trainee.id];
        const alreadyAssigned = new Set(secondaryMap[trainee.id]);

        // Exclude already-assigned secondaries and prefer to exclude primary
        const excludeWithPrimary = new Set([...alreadyAssigned, primaryName].filter(Boolean));
        let pick = pickSecondary(excludeWithPrimary);

        // Fallback: allow primary overlap if no other option
        if (!pick) {
          pick = pickSecondary(alreadyAssigned);
        }

        if (!pick) {
          console.log(`Warning: No secondary available for ${trainee.name} (${unit}) round ${round + 1}`);
          continue;
        }

        secondaryMap[trainee.id].push(pick.name);
        secondaryLoad[pick.name]++;
      }
    }

    // Log distribution for this unit
    const pDist = {};
    const sDist = {};
    Object.values(primaryLoad).forEach(v => { pDist[v] = (pDist[v]||0)+1; });
    Object.values(secondaryLoad).forEach(v => { sDist[v] = (sDist[v]||0)+1; });
    console.log(`${unit} primary dist:`, JSON.stringify(pDist));
    console.log(`${unit} secondary dist:`, JSON.stringify(sDist));

    for (const trainee of shuffledTrainees) {
      allResults.push({
        id: trainee.id,
        name: trainee.name,
        unit: trainee.unit,
        primaryInstructors: primaryMap[trainee.id] ? [primaryMap[trainee.id]] : [],
        secondaryInstructors: secondaryMap[trainee.id]
      });
    }
  }

  return allResults;
}

// GET /api/trainee-reallocation/preview - Preview reallocation without saving
app.get('/api/trainee-reallocation/preview', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const trainees = await prisma.trainee.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true } });
    const personnel = await prisma.personnel.findMany({ select: { id: true, name: true, unit: true, role: true } });

    const allResults = buildReallocation(trainees, personnel);

    const summary = {
      total: allResults.length,
      primary: {
        with1: allResults.filter(r => r.primaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.primaryInstructors.length === 0).length,
      },
      secondary: {
        with3: allResults.filter(r => r.secondaryInstructors.length === 3).length,
        with2: allResults.filter(r => r.secondaryInstructors.length === 2).length,
        with1: allResults.filter(r => r.secondaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.secondaryInstructors.length === 0).length,
      }
    };

    res.json({ success: true, summary, allocations: allResults });
  } catch (error) {
    console.error('Error in trainee-reallocation preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/trainee-reallocation/apply - Apply reallocation to database
app.post('/api/trainee-reallocation/apply', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const trainees = await prisma.trainee.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true } });
    const personnel = await prisma.personnel.findMany({ select: { id: true, name: true, unit: true, role: true } });

    const allResults = buildReallocation(trainees, personnel);

    console.log(`🔄 Applying reallocation for ${allResults.length} trainees...`);
    let updated = 0;
    const errors = [];

    for (const result of allResults) {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "Trainee"
          SET "primaryInstructor" = $1::TEXT[],
              "secondaryInstructor" = $2::TEXT[],
              "updatedAt" = NOW()
          WHERE id = $3::text
        `, result.primaryInstructors, result.secondaryInstructors, result.id);
        updated++;
      } catch (err) {
        errors.push({ traineeId: result.id, name: result.name, error: err.message });
      }
    }

    console.log(`✅ Reallocation complete: ${updated} updated, ${errors.length} errors`);

    const summary = {
      total: allResults.length,
      updated,
      errors: errors.length,
      primary: {
        with1: allResults.filter(r => r.primaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.primaryInstructors.length === 0).length,
      },
      secondary: {
        with3: allResults.filter(r => r.secondaryInstructors.length === 3).length,
        with2: allResults.filter(r => r.secondaryInstructors.length === 2).length,
        with1: allResults.filter(r => r.secondaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.secondaryInstructors.length === 0).length,
      }
    };

    res.json({ success: true, summary, errorDetails: errors });
  } catch (error) {
    console.error('Error in trainee-reallocation apply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/daily-snapshot/save - Save a full daily snapshot when schedule is published
app.post('/api/daily-snapshot/save', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
      date,
      scheduleEvents,
      staffEvents,
      traineeEvents,
      pt051Assessments,
      traineeProfiles,
      staffProfiles,
      lmpCompletedIds,
      staffCurrency,
      staffLogbook,
      savedBy,
      baselineEvents,
      aircraftConfigState
    } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Guard: reject if any event has isHistoricalSeed = true (never save seed data)
    const allEvents = [...(scheduleEvents || []), ...(staffEvents || []), ...(traineeEvents || [])];
    const hasSeedData = allEvents.some(e => e.isHistoricalSeed === true);
    if (hasSeedData) {
      console.log(`⚠️ POST /api/daily-snapshot/save - Rejected seed data for date ${date}`);
      return res.status(400).json({ error: 'Seed data cannot be saved as a real snapshot' });
    }

    // Upsert: update if date exists, create if not
    const existing = await db.$queryRawUnsafe(
      `SELECT id FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );

    const { cuid } = await import('@paralleldrive/cuid2').catch(() => ({ cuid: () => Math.random().toString(36).slice(2) }));
    const id = (existing && existing.length > 0) ? existing[0].id : (typeof cuid === 'function' ? cuid() : `snap_${Date.now()}`);

    if (existing && existing.length > 0) {
      // Only update baselineEvents if explicitly provided (preserves original published baseline)
      if (baselineEvents !== undefined && baselineEvents !== null) {
        await db.$executeRawUnsafe(`
          UPDATE "DailySnapshot"
          SET
            "scheduleEvents" = $1::jsonb,
            "staffEvents" = $2::jsonb,
            "traineeEvents" = $3::jsonb,
            "pt051Assessments" = $4::jsonb,
            "traineeProfiles" = $5::jsonb,
            "staffProfiles" = $6::jsonb,
            "lmpCompletedIds" = $7::jsonb,
            "staffCurrency" = $8::jsonb,
            "staffLogbook" = $9::jsonb,
            "savedAt" = NOW(),
            "savedBy" = $10::text,
            "baselineEvents" = $11::jsonb,
            "aircraftConfigState" = $12::jsonb
          WHERE date = $13::text
        `,
          JSON.stringify(scheduleEvents || []),
          JSON.stringify(staffEvents || []),
          JSON.stringify(traineeEvents || []),
          JSON.stringify(pt051Assessments || {}),
          JSON.stringify(traineeProfiles || []),
          JSON.stringify(staffProfiles || []),
          JSON.stringify(lmpCompletedIds || {}),
          JSON.stringify(staffCurrency || {}),
          JSON.stringify(staffLogbook || {}),
          savedBy || null,
          JSON.stringify(baselineEvents),
          JSON.stringify(aircraftConfigState || {}),
          date
        );
      } else {
        await db.$executeRawUnsafe(`
          UPDATE "DailySnapshot"
          SET
            "scheduleEvents" = $1::jsonb,
            "staffEvents" = $2::jsonb,
            "traineeEvents" = $3::jsonb,
            "pt051Assessments" = $4::jsonb,
            "traineeProfiles" = $5::jsonb,
            "staffProfiles" = $6::jsonb,
            "lmpCompletedIds" = $7::jsonb,
            "staffCurrency" = $8::jsonb,
            "staffLogbook" = $9::jsonb,
            "savedAt" = NOW(),
            "savedBy" = $10::text,
            "aircraftConfigState" = $11::jsonb
          WHERE date = $12::text
        `,
          JSON.stringify(scheduleEvents || []),
          JSON.stringify(staffEvents || []),
          JSON.stringify(traineeEvents || []),
          JSON.stringify(pt051Assessments || {}),
          JSON.stringify(traineeProfiles || []),
          JSON.stringify(staffProfiles || []),
          JSON.stringify(lmpCompletedIds || {}),
          JSON.stringify(staffCurrency || {}),
          JSON.stringify(staffLogbook || {}),
          savedBy || null,
          JSON.stringify(aircraftConfigState || {}),
          date
        );
      }
      console.log(`✅ POST /api/daily-snapshot/save - Updated snapshot for ${date}, ${(scheduleEvents||[]).length} events`);
    } else {
      await db.$executeRawUnsafe(`
        INSERT INTO "DailySnapshot"
          ("id", "date", "scheduleEvents", "staffEvents", "traineeEvents",
           "pt051Assessments", "traineeProfiles", "staffProfiles", "lmpCompletedIds",
           "staffCurrency", "staffLogbook", "savedAt", "savedBy", "baselineEvents", "aircraftConfigState")
        VALUES ($1::text, $2::text, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, NOW(), $12::text, $13::jsonb, $14::jsonb)
      `,
        id, date,
        JSON.stringify(scheduleEvents || []),
        JSON.stringify(staffEvents || []),
        JSON.stringify(traineeEvents || []),
        JSON.stringify(pt051Assessments || {}),
        JSON.stringify(traineeProfiles || []),
        JSON.stringify(staffProfiles || []),
        JSON.stringify(lmpCompletedIds || {}),
        JSON.stringify(staffCurrency || {}),
        JSON.stringify(staffLogbook || {}),
        savedBy || null,
        JSON.stringify(baselineEvents !== undefined && baselineEvents !== null ? baselineEvents : (scheduleEvents || [])),
        JSON.stringify(aircraftConfigState || {})
      );
      console.log(`✅ POST /api/daily-snapshot/save - Created snapshot for ${date}, ${(scheduleEvents||[]).length} events`);
    }

    res.json({ success: true, date, eventCount: (scheduleEvents||[]).length });
  } catch (error) {
    console.error('❌ POST /api/daily-snapshot/save error:', error);
    res.status(500).json({ error: 'Failed to save daily snapshot', details: error.message });
  }
});

// GET /api/daily-snapshot/dates - Return all dates that have snapshots (for calendar dropdown)
app.get('/api/daily-snapshot/dates', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "savedAt", "savedBy" FROM "DailySnapshot" ORDER BY date DESC`
    );
    const dates = (rows || []).map(r => ({
      date: String(r.date || '').replace(/__([A-Z0-9_-]+)(?:__([A-Za-z0-9_-]+))?$/i, ''),
      snapshotKey: r.date,
      school: (String(r.date || '').match(/__([A-Z0-9_-]+)(?:__([A-Za-z0-9_-]+))?$/i) || [])[1] || null,
      unit: (String(r.date || '').match(/__([A-Z0-9_-]+)(?:__([A-Za-z0-9_-]+))?$/i) || [])[2] || null,
      savedAt: r.savedAt,
      savedBy: r.savedBy
    }));
    console.log(`✅ GET /api/daily-snapshot/dates - ${dates.length} snapshot dates`);
    res.json({ dates });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot/dates error:', error);
    res.status(500).json({ error: 'Failed to load snapshot dates', details: error.message });
  }
});

// GET /api/daily-snapshot - Load last 5 days of snapshots
app.get('/api/daily-snapshot', async (req, res) => {
  try {
    const db = await getPrisma();
    const school = String(req.query.school || '').toUpperCase();
    const unit = String(req.query.unit || '').replace(/[^A-Za-z0-9_-]/g, '-');
    const rows = school && unit
      ? await db.$queryRawUnsafe(
          `SELECT * FROM "DailySnapshot"
           WHERE date LIKE $1::text
              OR date LIKE $2::text
              OR date !~ '__[A-Za-z0-9_-]+(__[A-Za-z0-9_-]+)?$'
           ORDER BY date DESC LIMIT 5`,
          `%__${school}__${unit}`,
          `%__${school}`
        )
      : school
      ? await db.$queryRawUnsafe(
          `SELECT * FROM "DailySnapshot"
           WHERE date LIKE $1::text
              OR date LIKE $2::text
              OR date !~ '__[A-Za-z0-9_-]+(__[A-Za-z0-9_-]+)?$'
           ORDER BY date DESC LIMIT 5`,
          `%__${school}`,
          `%__${school}__%`
        )
      : await db.$queryRawUnsafe(
          `SELECT * FROM "DailySnapshot" ORDER BY date DESC LIMIT 5`
        );
    console.log(`✅ GET /api/daily-snapshot - Loaded ${(rows||[]).length} recent snapshots`);
    res.json({ snapshots: rows || [] });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot error:', error);
    res.status(500).json({ error: 'Failed to load daily snapshots', details: error.message });
  }
});

// GET /api/daily-snapshot/:date - Load a single date snapshot on demand
app.get('/api/daily-snapshot/:date', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date } = req.params;
    // Validate date format. Context-aware snapshots use YYYY-MM-DD__LOCATION__UNIT.
    if (!/^\d{4}-\d{2}-\d{2}(?:__[A-Za-z0-9_-]+(?:__[A-Za-z0-9_-]+)?)?$/i.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD, YYYY-MM-DD__LOCATION, or YYYY-MM-DD__LOCATION__UNIT' });
    }
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }
    console.log(`✅ GET /api/daily-snapshot/${date} - Loaded snapshot`);
    res.json({ snapshot: rows[0] });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot/:date error:', error);
    res.status(500).json({ error: 'Failed to load snapshot', details: error.message });
  }
});

const isoDateOnly = (value) => String(value || '').slice(0, 10);

const parseJsonArraySafe = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const eventCategoryLabel = (event) => {
  const type = String(event?.type || '').toLowerCase();
  if (type === 'flight') return 'Flight';
  if (type === 'ftd' || type === 'sim' || type === 'simulator') return 'Simulator';
  if (type === 'cpt') return 'CPT';
  if (type === 'ground' || type === 'academic') return 'Ground';
  if (type === 'deployment') return 'Deployment';
  return 'Other';
};

const isFlightMetricEvent = (event) => String(event?.type || '').toLowerCase() === 'flight';
const isSimulatorMetricEvent = (event) => {
  const type = String(event?.type || '').toLowerCase();
  return type === 'ftd' || type === 'sim' || type === 'simulator';
};

const addMetricCount = (target, field, amount = 1) => {
  target[field] = Number(target[field] || 0) + amount;
};

const eventMetricHours = (event) => {
  const duration = Number(event?.duration ?? 0);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const eventStaffNames = (event) => {
  const names = [
    event?.instructor,
    event?.pilot,
    event?.crew,
    ...(Array.isArray(event?.attendees) ? event.attendees : []),
  ]
    .map((name) => String(name || '').trim())
    .filter((name) => name && !/^TBA$/i.test(name));
  return [...new Set(names)];
};

// GET /api/bli/metrics
// Aggregates published daily snapshots into bounded Build Leadership Intelligence series.
app.get('/api/bli/metrics', async (req, res) => {
  try {
    const db = await getPrisma();
    const startDate = isoDateOnly(req.query.startDate);
    const endDate = isoDateOnly(req.query.endDate);
    const school = String(req.query.school || '').trim().toUpperCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ error: 'startDate and endDate must be YYYY-MM-DD' });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ error: 'Invalid BLI date range' });
    }

    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days > 1900) {
      return res.status(400).json({ error: 'BLI date range is too large. Maximum supported range is five years.' });
    }

    const seriesByDate = new Map();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start.getTime() + i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      seriesByDate.set(dateKey, {
        date: dateKey,
        flightEvents: 0,
        simulatorEvents: 0,
        totalEvents: 0,
        flightHours: 0,
        simulatorHours: 0,
      });
    }

    const snapshotParams = [startDate, endDate];
    let snapshotSql = `
      SELECT date, "scheduleEvents", "baselineEvents"
      FROM "DailySnapshot"
      WHERE substring(date from 1 for 10) >= $1::text
        AND substring(date from 1 for 10) <= $2::text
    `;

    if (school === 'ESL') {
      snapshotSql += ` AND (date LIKE $3::text OR date !~ '__(ESL|PEA)$')`;
      snapshotParams.push(`%__${school}`);
    } else if (school === 'PEA') {
      snapshotSql += ` AND date LIKE $3::text`;
      snapshotParams.push(`%__${school}`);
    }
    snapshotSql += ` ORDER BY date ASC`;

    const snapshots = await db.$queryRawUnsafe(snapshotSql, ...snapshotParams);
    const staffDaily = {};
    const cancellationCategories = {};

    for (const snapshot of snapshots || []) {
      const dateKey = isoDateOnly(snapshot.date);
      if (!seriesByDate.has(dateKey)) continue;

      const events = parseJsonArraySafe(snapshot.scheduleEvents).length > 0
        ? parseJsonArraySafe(snapshot.scheduleEvents)
        : parseJsonArraySafe(snapshot.baselineEvents);

      const day = seriesByDate.get(dateKey);
      for (const event of events) {
        const hours = eventMetricHours(event);
        addMetricCount(day, 'totalEvents');
        if (isFlightMetricEvent(event)) {
          addMetricCount(day, 'flightEvents');
          addMetricCount(day, 'flightHours', hours);
        }
        if (isSimulatorMetricEvent(event)) {
          addMetricCount(day, 'simulatorEvents');
          addMetricCount(day, 'simulatorHours', hours);
        }

        for (const staffName of eventStaffNames(event)) {
          if (!staffDaily[staffName]) staffDaily[staffName] = {};
          if (!staffDaily[staffName][dateKey]) {
            staffDaily[staffName][dateKey] = {
              date: dateKey,
              flightEvents: 0,
              simulatorEvents: 0,
              totalEvents: 0,
              flightHours: 0,
              simulatorHours: 0,
            };
          }
          addMetricCount(staffDaily[staffName][dateKey], 'totalEvents');
          if (isFlightMetricEvent(event)) {
            addMetricCount(staffDaily[staffName][dateKey], 'flightEvents');
            addMetricCount(staffDaily[staffName][dateKey], 'flightHours', hours);
          }
          if (isSimulatorMetricEvent(event)) {
            addMetricCount(staffDaily[staffName][dateKey], 'simulatorEvents');
            addMetricCount(staffDaily[staffName][dateKey], 'simulatorHours', hours);
          }
        }

        if (event?.isCancelled || event?.cancellationCode) {
          const category = eventCategoryLabel(event);
          const code = String(
            event?.cancellationCode === 'OTHER' && event?.cancellationManualEntry
              ? event.cancellationManualEntry
              : event?.cancellationCode || 'UNSPECIFIED'
          ).trim() || 'UNSPECIFIED';
          if (!cancellationCategories[category]) cancellationCategories[category] = { category, total: 0, codes: {} };
          cancellationCategories[category].total += 1;
          cancellationCategories[category].codes[code] = Number(cancellationCategories[category].codes[code] || 0) + 1;
        }
      }
    }

    const availabilityRows = await db.$queryRawUnsafe(
      `
        SELECT *
        FROM "AircraftAvailabilityHistory"
        WHERE date >= $1::text AND date <= $2::text
        ORDER BY date ASC
      `,
      startDate,
      endDate
    ).catch((error) => {
      console.warn('[BLI] Aircraft availability history unavailable:', error.message);
      return [];
    });

    const availabilityByDate = new Map();
    for (const row of availabilityRows || []) {
      const dateKey = isoDateOnly(row.date);
      const totalAircraft = Number(row.totalAircraft ?? row.totalFleet ?? 0);
      const dailyAverage = Number(row.dailyAverage ?? 0);
      availabilityByDate.set(dateKey, {
        date: dateKey,
        availableAverage: dailyAverage,
        totalAircraft,
        availabilityPct: Number(row.availabilityPct ?? (totalAircraft > 0 ? (dailyAverage / totalAircraft) * 100 : 0)),
      });
    }

    const dates = [...seriesByDate.keys()];
    const staffSeries = {};
    for (const [staffName, byDate] of Object.entries(staffDaily)) {
      staffSeries[staffName] = dates.map((date) => byDate[date] || {
        date,
        flightEvents: 0,
        simulatorEvents: 0,
        totalEvents: 0,
        flightHours: 0,
        simulatorHours: 0,
      });
    }

    const cancellationsByCategory = Object.values(cancellationCategories)
      .map((entry) => ({
        category: entry.category,
        total: entry.total,
        codes: Object.entries(entry.codes)
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => Number(b.count) - Number(a.count) || a.code.localeCompare(b.code)),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total) || a.category.localeCompare(b.category));

    res.json({
      success: true,
      startDate,
      endDate,
      snapshotCount: (snapshots || []).length,
      dates,
      eventSeries: dates.map((date) => seriesByDate.get(date)),
      availabilitySeries: dates.map((date) => availabilityByDate.get(date) || {
        date,
        availableAverage: null,
        totalAircraft: null,
        availabilityPct: null,
      }),
      cancellationsByCategory,
      staffSeries,
    });
  } catch (error) {
    console.error('❌ GET /api/bli/metrics error:', error);
    res.status(500).json({ error: 'Failed to load BLI metrics', details: error.message });
  }
});

// DELETE /api/daily-snapshot/seed-cleanup - Delete all seed DataBackup records
app.delete('/api/daily-snapshot/seed-cleanup', async (req, res) => {
  try {
    const db = await getPrisma();
    // Delete all historical seed DataBackup records
    const deletedSchedules = await db.dataBackup.deleteMany({
      where: { type: 'historical_published_schedules' }
    });
    const deletedPt051 = await db.dataBackup.deleteMany({
      where: { type: 'historical_pt051_assessments' }
    });
    const deletedMeta = await db.dataBackup.deleteMany({
      where: { type: 'historical_seeding_metadata' }
    });
    const total = deletedSchedules.count + deletedPt051.count + deletedMeta.count;
    console.log(`✅ DELETE /api/daily-snapshot/seed-cleanup - Deleted ${total} seed DataBackup records`);
    res.json({
      success: true,
      deleted: {
        schedules: deletedSchedules.count,
        pt051: deletedPt051.count,
        metadata: deletedMeta.count,
        total
      }
    });
  } catch (error) {
    console.error('❌ DELETE /api/daily-snapshot/seed-cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean up seed data', details: error.message });
  }
});


// ============================================================
// ALERTS API - Change notification workflow
// ============================================================

const normalizeAlertIdentity = (value) => String(value || '')
  .replace(/\s*[–-]\s*\w+\d+\s*$/, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const getAlertEventDate = (snapshotDate, explicitEventDate) => {
  if (explicitEventDate) return explicitEventDate;
  return String(snapshotDate || '').replace(/__(ESL|PEA)$/i, '');
};

const addAlertAlias = (aliases, value) => {
  const raw = String(value || '').trim();
  if (!raw) return;
  aliases.add(raw);
  const normalised = normalizeAlertIdentity(raw);
  if (normalised) aliases.add(normalised);
};

const deriveAlertNames = (value) => {
  const raw = String(value || '').replace(/\s*[–-]\s*\w+\d+\s*$/, '').trim();
  if (!raw) return { userId: '', displayName: '', reversedName: '' };

  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map(part => part.trim());
    const displayName = [first, last].filter(Boolean).join(' ');
    return {
      userId: [first, last].filter(Boolean).join('.').toLowerCase(),
      displayName,
      reversedName: [last, first].filter(Boolean).join(', ')
    };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    return {
      userId: [first, last].join('.').toLowerCase(),
      displayName: raw,
      reversedName: `${last}, ${first}`
    };
  }

  return { userId: raw.toLowerCase(), displayName: raw, reversedName: raw };
};

const getAlertRecipientAliases = (recipient) => {
  const aliases = new Set();
  if (recipient && typeof recipient === 'object') {
    addAlertAlias(aliases, recipient.userId);
    addAlertAlias(aliases, recipient.displayName);
    addAlertAlias(aliases, recipient.reversedName);
    addAlertAlias(aliases, recipient.name);
  } else {
    addAlertAlias(aliases, recipient);
  }
  return aliases;
};

const alertRecipientMatchesAliases = (recipient, aliases) => {
  const recipientAliases = getAlertRecipientAliases(recipient);
  for (const alias of recipientAliases) {
    if (aliases.has(alias) || aliases.has(normalizeAlertIdentity(alias))) return true;
  }
  return false;
};

async function resolveAlertRecipient(db, recipient) {
  if (recipient && typeof recipient === 'object' && recipient.userId) {
    return {
      userId: String(recipient.userId || '').trim(),
      displayName: String(recipient.displayName || recipient.reversedName || recipient.userId || '').trim(),
      reversedName: String(recipient.reversedName || recipient.displayName || recipient.userId || '').trim(),
      status: recipient.status || 'pending',
      respondedAt: recipient.respondedAt || null
    };
  }

  const raw = String(recipient || '').trim();
  const derived = deriveAlertNames(raw);
  const candidates = Array.from(new Set([
    raw,
    normalizeAlertIdentity(raw),
    derived.userId,
    derived.displayName,
    derived.reversedName
  ].filter(Boolean)));

  for (const candidate of candidates) {
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT u.id, u."userId", u.username, u."firstName", u."lastName", u.email,
                p.name AS "personnelName",
                t.name AS "traineeName",
                t."fullName" AS "traineeFullName"
         FROM "User" u
         LEFT JOIN "Personnel" p ON p."userId" = u.id
         LEFT JOIN "Trainee" t ON t."userId" = u.id
         WHERE lower(u."userId") = lower($1)
            OR lower(u.username) = lower($1)
            OR lower(u.id) = lower($1)
            OR lower(COALESCE(u.email, '')) = lower($1)
            OR lower(trim(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", ''))) = lower($1)
            OR lower(trim(COALESCE(u."lastName", '') || ', ' || COALESCE(u."firstName", ''))) = lower($1)
            OR lower(COALESCE(p.name, '')) = lower($1)
            OR lower(COALESCE(t.name, '')) = lower($1)
            OR lower(COALESCE(t."fullName", '')) = lower($1)
         LIMIT 1`,
        candidate
      );
      if (rows && rows.length > 0) {
        const u = rows[0];
        const first = String(u.firstName || '').trim();
        const last = String(u.lastName || '').trim();
        const displayName = [first, last].filter(Boolean).join(' ')
          || u.traineeFullName
          || deriveAlertNames(u.traineeName || u.personnelName || raw).displayName
          || raw;
        const reversedName = first || last
          ? [last, first].filter(Boolean).join(', ')
          : (u.traineeName || u.personnelName || derived.reversedName || displayName);
        return {
          userId: String(u.userId || derived.userId || raw).trim(),
          displayName,
          reversedName,
          status: 'pending',
          respondedAt: null
        };
      }
    } catch (e) {
      console.warn(`🔔 [Alerts] Could not resolve recipient "${raw}" via candidate "${candidate}":`, e.message);
    }
  }

  return {
    userId: derived.userId || raw,
    displayName: derived.displayName || raw,
    reversedName: derived.reversedName || raw,
    status: 'pending',
    respondedAt: null
  };
}

async function getAlertUserAliases(db, userId) {
  const aliases = new Set();
  addAlertAlias(aliases, userId);

  try {
    let userRows = await db.$queryRawUnsafe(
      `SELECT id, "userId", username, "firstName", "lastName", email
       FROM "User"
       WHERE "userId" = $1
          OR username = $1
          OR id = $1
          OR lower(trim(COALESCE("firstName", '') || ' ' || COALESCE("lastName", ''))) = lower($1)
          OR lower(trim(COALESCE("lastName", '') || ', ' || COALESCE("firstName", ''))) = lower($1)
       LIMIT 1`,
      userId
    );
    if (!userRows || userRows.length === 0) {
      userRows = await db.$queryRawUnsafe(
        `SELECT u.id, u."userId", u.username, u."firstName", u."lastName", u.email
         FROM "User" u
         LEFT JOIN "Personnel" p ON p."userId" = u.id
         LEFT JOIN "Trainee" t ON t."userId" = u.id
         WHERE lower(COALESCE(p.name, '')) = lower($1)
            OR lower(COALESCE(t.name, '')) = lower($1)
            OR lower(COALESCE(t."fullName", '')) = lower($1)
         LIMIT 1`,
        userId
      );
    }
    if (userRows && userRows.length > 0) {
      const u = userRows[0];
      addAlertAlias(aliases, u.id);
      addAlertAlias(aliases, u.userId);
      addAlertAlias(aliases, u.username);
      addAlertAlias(aliases, u.email);

      const first = String(u.firstName || '').trim();
      const last = String(u.lastName || '').trim();
      if (first || last) {
        addAlertAlias(aliases, `${first} ${last}`.trim());
        addAlertAlias(aliases, `${last}, ${first}`.trim());
      }

      const peopleRows = await db.$queryRawUnsafe(
        `SELECT name, NULL::text AS "fullName" FROM "Personnel" WHERE "userId" = $1
         UNION ALL
         SELECT name, "fullName" FROM "Trainee" WHERE "userId" = $1`,
        u.id
      );
      for (const person of peopleRows || []) {
        addAlertAlias(aliases, person.name);
        addAlertAlias(aliases, person.fullName);
      }
    }
  } catch (e) {
    console.warn(`🔔 [Alerts] Could not resolve alert aliases for ${userId}:`, e.message);
  }

  return aliases;
}

const alertListContainsAlias = (list, aliases) => {
  if (!Array.isArray(list)) return false;
  return list.some(item => alertRecipientMatchesAliases(item, aliases));
};

const findAlertResponseForAliases = (responses, aliases) => {
  if (!responses || typeof responses !== 'object') return undefined;
  for (const [key, response] of Object.entries(responses)) {
    if (aliases.has(key) || aliases.has(normalizeAlertIdentity(key))) {
      return { key, response };
    }
  }
  return undefined;
};

const findAlertRecipientForAliases = (recipients, aliases) => {
  if (!Array.isArray(recipients)) return undefined;
  return recipients.find(recipient => alertRecipientMatchesAliases(recipient, aliases));
};

const getAlertRecipientStatus = (alert, aliases) => {
  const recipient = findAlertRecipientForAliases(alert.recipients, aliases);
  if (recipient && typeof recipient === 'object') {
    return {
      recipient,
      response: {
        status: recipient.status || 'pending',
        respondedAt: recipient.respondedAt || null
      }
    };
  }
  const matchedResponse = findAlertResponseForAliases(alert.responses, aliases);
  return {
    recipient,
    response: matchedResponse?.response
  };
};

// POST /api/alerts/send - Send an alert to pilots about a changed event
app.post('/api/alerts/send', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId, date, eventDate, school, unit, sentBy, recipients, description, eventDetails } = req.body;

    if (!eventId || !date || !sentBy || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'eventId, date, sentBy, and recipients are required' });
    }

    // Load existing snapshot for this date
    let snapshotDate = date;
    let rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      snapshotDate
    );
    if ((!rows || rows.length === 0) && !String(date).includes('__')) {
      const candidateDates = school
        ? [
            ...(unit ? [`${date}__${String(school).toUpperCase()}__${String(unit).replace(/[^A-Za-z0-9_-]/g, '-')}`] : []),
            `${date}__${String(school).toUpperCase()}`
          ]
        : [`${date}__ESL`, `${date}__PEA`];
      for (const candidateDate of candidateDates) {
        rows = await db.$queryRawUnsafe(
          `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
          candidateDate
        );
        if (rows && rows.length > 0) {
          snapshotDate = candidateDate;
          break;
        }
      }
      if ((!rows || rows.length === 0) && school) {
        rows = await db.$queryRawUnsafe(
          `SELECT "alertsData", date FROM "DailySnapshot" WHERE date LIKE $1::text ORDER BY date DESC LIMIT 1`,
          `${date}__${String(school).toUpperCase()}__%`
        );
        if (rows && rows.length > 0) snapshotDate = rows[0].date;
      }
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }

    const alertsData = rows[0].alertsData || {};

    // Check if alert already sent for this event
    if (alertsData[eventId]) {
      return res.status(409).json({ 
        error: 'Alert already sent for this event',
        sentAt: alertsData[eventId].sentAt
      });
    }

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sentAt = new Date().toISOString();

    const resolvedRecipients = [];
    const seenRecipientIds = new Set();
    for (const recipient of recipients) {
      const resolved = await resolveAlertRecipient(db, recipient);
      const key = normalizeAlertIdentity(resolved.userId || resolved.reversedName || resolved.displayName);
      if (!key || seenRecipientIds.has(key)) continue;
      seenRecipientIds.add(key);
      resolvedRecipients.push(resolved);
    }

    if (resolvedRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipients could be resolved' });
    }

    // Build responses map - all pending initially. Key new responses by stable userId.
    const responses = {};
    resolvedRecipients.forEach(r => {
      responses[r.userId] = { status: 'pending', respondedAt: null };
    });

    const alertEntry = {
      alertId,
      eventId,
      date: getAlertEventDate(snapshotDate, eventDate),
      snapshotDate,
      sentAt,
      sentBy,
      recipients: resolvedRecipients,
      description: description || '',
      eventDetails: eventDetails || {},
      responses,
      dismissed: []
    };
    alertsData[eventId] = alertEntry;

    // Save updated alertsData back to snapshot
    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      snapshotDate
    );

    console.log(`✅ POST /api/alerts/send - Alert ${alertId} sent for event ${eventId} on ${snapshotDate} to ${resolvedRecipients.map(r => r.userId || r.reversedName || r.displayName).join(', ')}`);

    // TODO: Send APNs push notification here when credentials are available
    // For now, pilots poll GET /api/alerts/:userId

    res.json({ success: true, alertId, sentAt, alertEntry });
  } catch (error) {
    console.error('❌ POST /api/alerts/send error:', error);
    res.status(500).json({ error: 'Failed to send alert', details: error.message });
  }
});

// GET /api/alerts/:userId - Get all alerts for a specific pilot (iPhone polling)
app.get('/api/alerts/:userId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId } = req.params;

    console.log(`🔔 [Alerts] GET /api/alerts/${userId} - Request received`);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const aliases = await getAlertUserAliases(db, userId);
    console.log(`🔔 [Alerts] Resolved userId=${userId} aliases=[${Array.from(aliases).join(', ')}]`);

    // Load last 14 days of snapshots to find alerts
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData" IS NOT NULL AND "alertsData" != '{}'::jsonb
       ORDER BY date DESC LIMIT 14`
    );

    console.log(`🔔 [Alerts] Found ${rows ? rows.length : 0} snapshots with alertsData`);

    const alerts = [];
    for (const row of rows || []) {
      const alertsData = row.alertsData || {};
      const eventCount = Object.keys(alertsData).length;
      console.log(`🔔 [Alerts] Snapshot ${row.date}: ${eventCount} alert entries`);

      for (const [eventId, alert] of Object.entries(alertsData)) {
        if (!alert || !alert.alertId) continue;
        console.log(`🔔 [Alerts]   Event ${eventId}: recipients=${JSON.stringify(alert.recipients || [])}`);
        const isRecipient = alertListContainsAlias(alert.recipients, aliases);
        if (isRecipient) {
          const { response: myResponse } = getAlertRecipientStatus(alert, aliases);
          console.log(`🔔 [Alerts]   Match for ${userId}: status=${myResponse?.status || 'pending'}`);
          // Skip if user has dismissed this alert
          if (alertListContainsAlias(alert.dismissed, aliases)) {
            continue;
          }

          alerts.push({
            alertId: alert.alertId,
            eventId,
            date: getAlertEventDate(row.date, alert.date),
            snapshotDate: row.date,
            sentAt: alert.sentAt,
            sentBy: alert.sentBy,
            recipients: alert.recipients || [],
            eventDetails: alert.eventDetails || {},
            myStatus: myResponse?.status || 'pending',
            respondedAt: myResponse?.respondedAt || null,
            dismissed: alert.dismissed || []
          });
        }
      }
    }

    // Sort: pending first, then by date desc
    alerts.sort((a, b) => {
      if (a.myStatus === 'pending' && b.myStatus !== 'pending') return -1;
      if (a.myStatus !== 'pending' && b.myStatus === 'pending') return 1;
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    });

    console.log(`✅ GET /api/alerts/${userId} - returning ${alerts.length} alerts`);
    res.json({ alerts });
  } catch (error) {
    console.error('❌ GET /api/alerts/:userId error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
});

// POST /api/alerts/:alertId/respond - Pilot submits ACCEPT or REJECT
app.post('/api/alerts/:alertId/respond', async (req, res) => {
  try {
    const db = await getPrisma();
    const { alertId } = req.params;
    const { userId, status } = req.body; // status: 'accepted' | 'rejected'

    if (!userId || !status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'userId and status (accepted|rejected) are required' });
    }

    // Find the snapshot containing this alertId
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData"::text LIKE $1
       ORDER BY date DESC LIMIT 1`,
      `%${alertId}%`
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `Alert ${alertId} not found` });
    }

    const row = rows[0];
    const alertsData = row.alertsData || {};

    // Find the event that contains this alertId
    let targetEventId = null;
    for (const [eventId, alert] of Object.entries(alertsData)) {
      if (alert.alertId === alertId) {
        targetEventId = eventId;
        break;
      }
    }

    if (!targetEventId) {
      return res.status(404).json({ error: `Alert ${alertId} not found in snapshot` });
    }

    const alert = alertsData[targetEventId];

    const aliases = await getAlertUserAliases(db, userId);
    let responseKey = userId;

    // Verify this pilot is a recipient - check userId, full name, and reversed name
    const isRecipient = alertListContainsAlias(alert.recipients, aliases);

    if (!isRecipient) {
      return res.status(403).json({ error: 'User is not a recipient of this alert' });
    }

    const matchedRecipient = findAlertRecipientForAliases(alert.recipients, aliases);
    const matchedResponse = findAlertResponseForAliases(alert.responses, aliases);
    if (matchedResponse?.key) responseKey = matchedResponse.key;
    else if (matchedRecipient && typeof matchedRecipient === 'object' && matchedRecipient.userId) responseKey = matchedRecipient.userId;
    else {
      const matchedLegacyRecipient = (alert.recipients || []).find(r => alertRecipientMatchesAliases(r, aliases));
      if (matchedLegacyRecipient) responseKey = matchedLegacyRecipient;
    }

    // Check if already responded
    const existingResponse = alert.responses?.[responseKey]
      || matchedResponse?.response
      || (matchedRecipient && typeof matchedRecipient === 'object' ? matchedRecipient : undefined);
    if (existingResponse && existingResponse.status !== 'pending') {
      return res.status(409).json({ 
        error: 'Already responded to this alert',
        status: existingResponse.status
      });
    }

    // Record the response under the matched key
    if (!alert.responses || typeof alert.responses !== 'object') alert.responses = {};
    alert.responses[responseKey] = {
      status,
      respondedAt: new Date().toISOString()
    };
    if (matchedRecipient && typeof matchedRecipient === 'object') {
      matchedRecipient.status = status;
      matchedRecipient.respondedAt = alert.responses[responseKey].respondedAt;
    }

    // Save updated alertsData
    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      row.date
    );

    console.log(`✅ POST /api/alerts/${alertId}/respond - ${userId} responded: ${status}`);
    res.json({ success: true, alertId, userId, status });
  } catch (error) {
    console.error('❌ POST /api/alerts/:alertId/respond error:', error);
    res.status(500).json({ error: 'Failed to record response', details: error.message });
  }
});

// GET /api/alerts/event/:eventId - Browser polls for alert status on a specific event
app.get('/api/alerts/event/:eventId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date query param is required' });
    }

    const rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );

    if (!rows || rows.length === 0) {
      return res.json({ alert: null });
    }

    const alertsData = rows[0].alertsData || {};
    const alert = alertsData[eventId] || null;

    if (!alert) {
      return res.json({ alert: null });
    }

    // Compute aggregate status
    let overallStatus = 'pending';
    const responses = Array.isArray(alert.recipients) && alert.recipients.some(r => r && typeof r === 'object')
      ? alert.recipients.map(r => ({ status: r.status || 'pending' }))
      : Object.values(alert.responses || {});
    if (responses.length > 0) {
      const allResponded = responses.every(r => r.status !== 'pending');
      if (allResponded) {
        const anyRejected = responses.some(r => r.status === 'rejected');
        overallStatus = anyRejected ? 'rejected' : 'accepted';
      }
    }

    res.json({ 
      alert: {
        alertId: alert.alertId,
        eventId,
        date: getAlertEventDate(date, alert.date),
        snapshotDate: date,
        sentAt: alert.sentAt,
        sentBy: alert.sentBy,
        recipients: alert.recipients,
        responses: alert.responses,
        overallStatus,
        dismissed: alert.dismissed || []
      }
    });
  } catch (error) {
    console.error('❌ GET /api/alerts/event/:eventId error:', error);
    res.status(500).json({ error: 'Failed to fetch alert status', details: error.message });
  }
});

// POST /api/alerts/:alertId/dismiss - iOS user dismisses/deletes alert notification
app.post('/api/alerts/:alertId/dismiss', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    // Store dismissal in a lightweight way - just track in alertsData responses with 'dismissed' status
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData"::text LIKE $1
       ORDER BY date DESC LIMIT 1`,
      `%${alertId}%`
    );
    if (!rows || rows.length === 0) {
      // Alert not found - that's OK, just acknowledge
      return res.json({ success: true });
    }
    const row = rows[0];
    const alertsData = row.alertsData || {};
    const aliases = await getAlertUserAliases(db, userId);
    // Find the event containing this alert
    for (const [eventId, alert] of Object.entries(alertsData)) {
      if (alert.alertId === alertId) {
        if (Array.isArray(alert.recipients) && !alertListContainsAlias(alert.recipients, aliases)) {
          return res.status(403).json({ error: 'User is not a recipient of this alert' });
        }
        // Add to dismissed list for this user
        if (!alert.dismissed) alert.dismissed = [];
        const alreadyDismissed = alertListContainsAlias(alert.dismissed, aliases);
        if (!alreadyDismissed) {
          alert.dismissed.push(userId);
          await db.$executeRawUnsafe(
            `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
            JSON.stringify(alertsData),
            row.date
          );
        }
        break;
      }
    }
    console.log(`✅ POST /api/alerts/${alertId}/dismiss - ${userId} dismissed alert`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/alerts/:alertId/dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss alert', details: error.message });
  }
});

// POST /api/alerts/clear - Clear alert for an event (allows re-sending)
app.post('/api/alerts/clear', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId, date, clearedBy } = req.body;

    if (!eventId || !date) {
      return res.status(400).json({ error: 'eventId and date are required' });
    }

    const rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }

    const alertsData = rows[0].alertsData || {};

    if (!alertsData[eventId]) {
      return res.status(404).json({ error: `No alert found for event ${eventId}` });
    }

    // Archive the alert in audit trail before clearing
    const clearedAlert = alertsData[eventId];
    if (!alertsData._auditTrail) alertsData._auditTrail = [];
    alertsData._auditTrail.push({
      type: 'cleared',
      clearedBy: clearedBy || 'unknown',
      clearedAt: new Date().toISOString(),
      originalAlert: clearedAlert
    });

    // Remove the event alert
    delete alertsData[eventId];

    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      date
    );

    console.log(`✅ POST /api/alerts/clear - Alert cleared for event ${eventId} on ${date} by ${clearedBy}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/alerts/clear error:', error);
    res.status(500).json({ error: 'Failed to clear alert', details: error.message });
  }
});

// POST /api/alerts/register-device - Register device token for APNs push notifications
app.post('/api/alerts/register-device', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, token, platform = 'ios' } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token are required' });
    }

    const id = `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await db.$executeRawUnsafe(`
      INSERT INTO "DeviceToken" ("id", "userId", "token", "platform", "registeredAt")
      VALUES ($1::text, $2::text, $3::text, $4::text, NOW())
      ON CONFLICT ("userId", "token") DO UPDATE SET "registeredAt" = NOW()
    `, id, userId, token, platform);

    console.log(`✅ POST /api/alerts/register-device - Registered ${platform} token for ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/alerts/register-device error:', error);
    res.status(500).json({ error: 'Failed to register device token', details: error.message });
  }
});

app.post('/api/scores/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { scores } = req.body;
    if (!scores || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'scores array required' });
    }
    let inserted = 0, skipped = 0;
    for (const s of scores) {
      const existing = await db.score.findFirst({
        where: { traineeId: s.traineeId, event: s.event }
      });
      if (!existing) {
        await db.score.create({ data: { ...s, date: new Date(s.date) } });
        inserted++;
      } else {
        skipped++;
      }
    }
    res.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error('❌ POST /api/scores/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk insert scores', details: error.message });
  }
});

// DELETE /api/scores/trainee/:traineeId - delete scores for a trainee (optionally filtered by event prefix)
app.delete('/api/scores/trainee/:traineeId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId } = req.params;
    const { eventPrefix } = req.query;

    const where = { traineeId };
    if (eventPrefix) {
      where.event = { startsWith: eventPrefix };
    }

    const result = await db.score.deleteMany({ where });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('❌ DELETE /api/scores/trainee error:', error);
    res.status(500).json({ error: 'Failed to delete scores', details: error.message });
  }
});

// DELETE /api/scores/trainee/:traineeId/events - delete specific event scores for a trainee
// Body: { events: string[] } - array of event codes to delete
// Also removes those events from IndividualLMP.completedEventIds
app.delete('/api/scores/trainee/:traineeId/events', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId } = req.params;
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required in request body' });
    }

    // Delete score records for the specified events
    const result = await db.score.deleteMany({
      where: { traineeId, event: { in: events } },
    });

    // Also remove from IndividualLMP.completedEventIds
    try {
      const lmp = await db.individualLMP.findFirst({ where: { traineeId } });
      if (lmp) {
        const updated = (lmp.completedEventIds || []).filter(id => !events.includes(id));
        await db.individualLMP.update({
          where: { id: lmp.id },
          data: { completedEventIds: updated, updatedAt: new Date() },
        });
        console.log(`[DELETE /api/scores/events] Updated IndividualLMP for ${traineeId}: removed ${events.length} events`);
      }
    } catch (lmpErr) {
      console.warn(`[DELETE /api/scores/events] Could not update IndividualLMP:`, lmpErr.message);
    }

    console.log(`✅ DELETE /api/scores/trainee/${traineeId}/events - deleted ${result.count} score records`);
    res.json({ success: true, deleted: result.count, events });
  } catch (error) {
    console.error('❌ DELETE /api/scores/trainee/events error:', error);
    res.status(500).json({ error: 'Failed to delete scores', details: error.message });
  }
});

// ============================================================
// TRAINING INTELLIGENCE ENGINE (TIE) API ROUTES
// ============================================================

// POST /api/tie/run - trigger analytics run (fire-and-forget to avoid Railway timeout)
app.post('/api/tie/run', async (req, res) => {
  try {
    const db = await getPrisma();
    const { courseFilter, triggeredBy } = req.body;

    // Start the analytics run in background WITHOUT awaiting it
    // This prevents Railway's 60s request timeout from killing the connection
    setImmediate(async () => {
      try {
        await runTIEAnalytics(db, courseFilter || null, triggeredBy || 'manual');
      } catch (err) {
        console.error('❌ TIE background run error:', err.message);
      }
    });

    // Immediately respond so the client knows the run has started
    // The client should poll GET /api/tie/status to check completion
    res.json({ started: true, message: 'TIE analytics run started. Poll /api/tie/status for progress.' });
  } catch (error) {
    console.error('❌ POST /api/tie/run error:', error);
    res.status(500).json({ 
      error: 'TIE run failed to start', 
      details: error.message
    });
  }
});

// GET /api/tie/status - get status of the most recent analytics run (for polling)
app.get('/api/tie/status', async (req, res) => {
  try {
    const db = await getPrisma();
    const courseFilter = req.query.course || null;
    let rows = [];
    try {
      if (courseFilter) {
        rows = await db.$queryRawUnsafe(`
          SELECT id, status, "courseFilter", "startedAt", "completedAt", "recordsProcessed", "errorMessage"
          FROM "TIEAnalyticsRun"
          WHERE "courseFilter" = $1::text
          ORDER BY "startedAt" DESC
          LIMIT 1
        `, courseFilter);
      } else {
        rows = await db.$queryRawUnsafe(`
          SELECT id, status, "courseFilter", "startedAt", "completedAt", "recordsProcessed", "errorMessage"
          FROM "TIEAnalyticsRun"
          ORDER BY "startedAt" DESC
          LIMIT 1
        `);
      }
    } catch (e) { /* table may not exist yet */ }

    if (!rows || rows.length === 0) {
      return res.json({ status: 'none' });
    }
    const run = rows[0];
    res.json({
      status: run.status,
      runId: run.id,
      courseFilter: run.courseFilter,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      recordsProcessed: run.recordsProcessed,
      errorMessage: run.errorMessage,
      success: run.status === 'complete',
      running: run.status === 'running',
      failed: run.status === 'failed'
    });
  } catch (error) {
    console.error('❌ GET /api/tie/status error:', error);
    res.status(500).json({ error: 'Failed to fetch TIE status', details: error.message });
  }
});

// GET /api/tie/runs - list recent analytics runs
app.get('/api/tie/runs', async (req, res) => {
  try {
    const db = await getPrisma();
    const limit = parseInt(req.query.limit) || 10;
    const rows = await db.$queryRawUnsafe(`
      SELECT id, status, "triggeredBy", "courseFilter", "startedAt", "completedAt",
             "recordsProcessed", "errorMessage"
      FROM "TIEAnalyticsRun"
      ORDER BY "startedAt" DESC
      LIMIT $1::int
    `, limit);
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/runs error:', error);
    res.status(500).json({ error: 'Failed to fetch runs', details: error.message });
  }
});

// GET /api/tie/courses - list courses with PT-051 data and last run info
app.get('/api/tie/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    // Pull available courses from DataBackup
    const backups = await db.dataBackup.findMany({ where: { type: 'historical_pt051_assessments' } });
    const courseMap = {};
    for (const b of backups) {
      try {
        const parsed = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
        // PT-051 data is stored as a dict keyed by record ID; course is embedded in traineeFullName after em-dash
        const records = Array.isArray(parsed) ? parsed : Object.values(parsed);
        for (const r of records) {
          // Try direct course field first, then extract from traineeFullName (e.g. "Smith, John – ADF301")
          let c = r.course || r.courseName || null;
          if (!c && r.traineeFullName && r.traineeFullName.includes('\u2013')) {
            c = r.traineeFullName.split('\u2013')[1].trim();
          }
          if (!c) continue;
          if (!courseMap[c]) courseMap[c] = 0;
          courseMap[c]++;
        }
      } catch (e) { /* skip */ }
    }
    // Get last run per course from TIECourseSummary
    let courseSummaries = [];
    try {
      courseSummaries = await db.$queryRawUnsafe(`
        SELECT DISTINCT cs."courseName", cs."totalTrainees", cs."totalPt051s",
               r."completedAt", r.id as "runId"
        FROM "TIECourseSummary" cs
        JOIN "TIEAnalyticsRun" r ON r.id = cs."runId"
        WHERE r.status = 'complete'
        ORDER BY r."completedAt" DESC
      `);
    } catch (e) { /* table may be empty */ }

    const summaryByName = {};
    for (const s of courseSummaries) {
      if (!summaryByName[s.courseName]) summaryByName[s.courseName] = s;
    }

    const courses = Object.entries(courseMap).map(([name, count]) => ({
      name,
      recordCount: count,
      lastRun: summaryByName[name] ? {
        completedAt: summaryByName[name].completedAt,
        totalTrainees: summaryByName[name].totalTrainees,
        totalRecords: summaryByName[name].totalPt051s
      } : null
    }));

    res.json(courses);
  } catch (error) {
    console.error('❌ GET /api/tie/courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  }
});

// GET /api/tie/summary/:course - course-level analytics summary
app.get('/api/tie/summary/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const course = decodeURIComponent(req.params.course);
    // Get latest run for this course
    let rows = [];
    try {
      rows = await db.$queryRawUnsafe(`
        SELECT cs.*, r."completedAt", r."triggeredBy", r."recordsProcessed"
        FROM "TIECourseSummary" cs
        JOIN "TIEAnalyticsRun" r ON r.id = cs."runId"
        WHERE cs."courseName" = $1::text AND r.status = 'complete'
        ORDER BY r."completedAt" DESC
        LIMIT 1
      `, course);
    } catch (e) { /* no data yet */ }

    if (!rows.length) return res.json(null);
    const summary = rows[0];
    // Parse JSON fields
    try { summary.bottleneckEvents = JSON.parse(summary.bottleneckEvents || '[]'); } catch(e) {}
    try { summary.overServicedEvents = JSON.parse(summary.overServicedEvents || '[]'); } catch(e) {}
    try { summary.skillHeatmap = JSON.parse(summary.skillHeatmap || '{}'); } catch(e) {}
    res.json(summary);
  } catch (error) {
    console.error('❌ GET /api/tie/summary error:', error);
    res.status(500).json({ error: 'Failed to fetch course summary', details: error.message });
  }
});

// GET /api/tie/trainees/:course - all trainee summaries for a course
app.get('/api/tie/trainees/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const course = decodeURIComponent(req.params.course);
    let rows = [];
    try {
      rows = await db.$queryRawUnsafe(`
        SELECT ts.*
        FROM "TIETraineeSummary" ts
        JOIN "TIEAnalyticsRun" r ON r.id = ts."runId"
        WHERE ts."courseName" = $1::text AND r.status = 'complete'
        AND r."completedAt" = (
          SELECT MAX(r2."completedAt") FROM "TIEAnalyticsRun" r2
          WHERE r2.status = 'complete'
        )
        ORDER BY ts."avgOverallGrade" ASC
      `, course);
    } catch (e) { /* no data */ }

    for (const row of rows) {
      try { row.skillFamilyScores = JSON.parse(row.skillFamilyScores || '{}'); } catch(e) {}
      try { row.weakElements = JSON.parse(row.weakElements || '[]'); } catch(e) {}
      try { row.strongElements = JSON.parse(row.strongElements || '[]'); } catch(e) {}
    }
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/trainees error:', error);
    res.status(500).json({ error: 'Failed to fetch trainee summaries', details: error.message });
  }
});

// GET /api/tie/trainee/:name - single trainee analytics detail
app.get('/api/tie/trainee/:name', async (req, res) => {
  try {
    const db = await getPrisma();
    const name = decodeURIComponent(req.params.name);
    let rows = [];
    try {
      // traineeFullName in DB may include course suffix e.g. "Edwards, Luna – ADF302"
      // Match by exact name OR name that starts with the given name followed by space/dash
      rows = await db.$queryRawUnsafe(`
        SELECT ts.*
        FROM "TIETraineeSummary" ts
        JOIN "TIEAnalyticsRun" r ON r.id = ts."runId"
        WHERE (
          ts."traineeFullName" = $1::text
          OR ts."traineeFullName" LIKE $2::text
          OR ts."traineeFullName" ILIKE $3::text
        )
        AND r.status = 'complete'
        ORDER BY r."completedAt" DESC
        LIMIT 5
      `, name, `${name} –%`, `${name} -%`);
    } catch (e) {
      console.error('[TIE] trainee query error:', e.message);
    }

    for (const row of rows) {
      try { row.skillFamilyScores = JSON.parse(row.skillFamilyScores || '{}'); } catch(e) {}
      try { row.weakElements = JSON.parse(row.weakElements || '[]'); } catch(e) {}
      try { row.strongElements = JSON.parse(row.strongElements || '[]'); } catch(e) {}
      // Parse gradeProgression if it's a string
      if (typeof row.gradeProgression === 'string') {
        try { row.gradeProgression = JSON.parse(row.gradeProgression); } catch(e) {}
      }
    }

    console.log(`[TIE] GET /api/tie/trainee/${name} -> ${rows.length} rows found`);

    // Return array directly (frontend expects array)
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/trainee error:', error);
    res.status(500).json({ error: 'Failed to fetch trainee detail', details: error.message });
  }
});

// GET /api/tie/events/:course - event summaries for a course
app.get('/api/tie/events/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const course = decodeURIComponent(req.params.course);
    let rows = [];
    try {
      rows = await db.$queryRawUnsafe(`
        SELECT es.*
        FROM "TIEEventSummary" es
        JOIN "TIEAnalyticsRun" r ON r.id = es."runId"
        WHERE es."courseName" = $1::text AND r.status = 'complete'
        AND r."completedAt" = (
          SELECT MAX(r2."completedAt") FROM "TIEAnalyticsRun" r2
          WHERE r2.status = 'complete'
        )
        ORDER BY es."avgOverallGrade" ASC
      `, course);
    } catch (e) { /* no data */ }

    for (const row of rows) {
      try { row.skillFamilyScores = JSON.parse(row.skillFamilyScores || '{}'); } catch(e) {}
      try { row.weakElements = JSON.parse(row.weakElements || '[]'); } catch(e) {}
    }
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/events error:', error);
    res.status(500).json({ error: 'Failed to fetch event summaries', details: error.message });
  }
});

// GET /api/tie/findings/:course - findings for a course from latest run
app.get('/api/tie/findings/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const course = decodeURIComponent(req.params.course);
    const level = req.query.level || null;
    let rows = [];
    try {
      const levelFilter = level ? `AND f.level = '${level.replace(/'/g,"''")}' ` : '';
      rows = await db.$queryRawUnsafe(`
        SELECT f.*
        FROM "TIEFinding" f
        JOIN "TIEAnalyticsRun" r ON r.id = f."runId"
        WHERE r.status = 'complete'
        AND (f."subjectKey" = $1::text OR f."subjectKey" LIKE $2::text)
        ${levelFilter}
        AND r."completedAt" = (
          SELECT MAX(r2."completedAt") FROM "TIEAnalyticsRun" r2
          WHERE r2.status = 'complete'
        )
        ORDER BY f."confidenceScore" DESC
        LIMIT 100
      `, course, `%${course}%`);
    } catch (e) { /* no data */ }
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/findings error:', error);
    res.status(500).json({ error: 'Failed to fetch findings', details: error.message });
  }
});

// GET /api/tie/rootcauses/:course - root causes for a course from latest run
app.get('/api/tie/rootcauses/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const course = decodeURIComponent(req.params.course);
    let rows = [];
    try {
      rows = await db.$queryRawUnsafe(`
        SELECT rc.*
        FROM "TIERootCause" rc
        JOIN "TIEAnalyticsRun" r ON r.id = rc."runId"
        WHERE rc."subjectKey" = $1::text AND rc.level = 'course' AND r.status = 'complete'
        AND r."completedAt" = (
          SELECT MAX(r2."completedAt") FROM "TIEAnalyticsRun" r2
          WHERE r2.status = 'complete'
        )
        ORDER BY rc."confidenceScore" DESC
      `, course);
    } catch (e) { /* no data */ }
    res.json(rows);
  } catch (error) {
    console.error('❌ GET /api/tie/rootcauses error:', error);
    res.status(500).json({ error: 'Failed to fetch root causes', details: error.message });
  }
});

// GET /api/tie/settings - get TIE settings
function normalizeTieSettingValue(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return normalizeTieSettingValue(value.value);
  }
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

app.get('/api/tie/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    let rows = [];
    try {
      rows = await db.$queryRawUnsafe(`SELECT key, value, description FROM "TIESettings"`);
    } catch (e) { /* no table yet */ }
    const settings = {};
    for (const r of rows) settings[r.key] = normalizeTieSettingValue(r.value);
    res.json(settings);
  } catch (error) {
    console.error('❌ GET /api/tie/settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

// PUT /api/tie/settings - update a TIE setting
app.put('/api/tie/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.$executeRawUnsafe(`
      INSERT INTO "TIESettings"("id","key","value","updatedAt")
      VALUES(gen_random_uuid()::text,$1::text,$2::jsonb,NOW())
      ON CONFLICT ("key")
      DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
    `, key, JSON.stringify(value));
    res.json({ success: true });
  } catch (error) {
    console.error('❌ PUT /api/tie/settings error:', error);
    res.status(500).json({ error: 'Failed to update setting', details: error.message });
  }
});

// ============================================================
// TRAINEE PERFORMANCE API ROUTES
// Single source of truth for all PT-051 assessments
// ============================================================

// Ensure TraineePerformance table exists (called at Prisma startup)
async function ensureTraineePerformanceTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TraineePerformance" (
        "id"                       TEXT NOT NULL,
        "traineeId"                TEXT NOT NULL,
        "traineeFullName"          TEXT NOT NULL,
        "eventId"                  TEXT NOT NULL,
        "eventCode"                TEXT NOT NULL,
        "flightNumber"             TEXT NOT NULL,
        "eventDescription"         TEXT,
        "date"                     TEXT NOT NULL,
        "instructorName"           TEXT NOT NULL,
        "instructorId"             TEXT,
        "overallGrade"             TEXT NOT NULL DEFAULT 'No Grade',
        "overallResult"            TEXT,
        "dcoResult"                TEXT,
        "startTime"                DOUBLE PRECISION,
        "duration"                 DOUBLE PRECISION,
        "endTime"                  DOUBLE PRECISION,
        "comments"                 TEXT,
        "elementScores"            JSONB NOT NULL DEFAULT '[]',
        "isCompleted"              BOOLEAN NOT NULL DEFAULT false,
        "isGroundSchoolAssessment" BOOLEAN NOT NULL DEFAULT false,
        "groundSchoolResult"       INTEGER,
        "course"                   TEXT,
        "syllabusPhase"            TEXT,
        "eventSequence"            INTEGER,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"                TIMESTAMP NOT NULL DEFAULT NOW(),
        "createdBy"                TEXT,
        "updatedBy"                TEXT,
        CONSTRAINT "TraineePerformance_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "TraineePerformance_eventId_key" UNIQUE ("eventId")
      )
    `);
    // Create indexes for common query patterns
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_traineeId_idx" ON "TraineePerformance"("traineeId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_instructorName_idx" ON "TraineePerformance"("instructorName")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_course_idx" ON "TraineePerformance"("course")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_date_idx" ON "TraineePerformance"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_isCompleted_idx" ON "TraineePerformance"("isCompleted")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_traineeId_date_idx" ON "TraineePerformance"("traineeId", "date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_instructorName_completed_idx" ON "TraineePerformance"("instructorName", "isCompleted")`);
    console.log('✅ TraineePerformance table ready');
  } catch (err) {
    console.error('❌ ensureTraineePerformanceTable error (non-fatal):', err.message);
  }
}

async function migrateLegacyPerformanceIntoTraineePerformance(db, options = {}) {
  const force = options.force === true;
  const summary = {
    success: true,
    mode: force ? 'forced' : 'startup',
    sources: {
      dataBackupRecords: 0,
      dailySnapshots: 0,
      candidateAssessments: 0,
    },
    inserted: 0,
    updatedEmpty: 0,
    preservedExisting: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const marker = await db.dataBackup.findFirst({
      where: { type: 'migration_trainee_performance_authoritative_v1' },
      orderBy: { createdAt: 'desc' },
    });
    if (marker && !force) {
      return { ...summary, skipped: 0, alreadyRan: true, marker: marker.data };
    }
  } catch (markerErr) {
    console.warn('[PT051 Migration] Could not read migration marker:', markerErr.message);
  }

  try {
    const trainees = await db.trainee.findMany({
      select: { id: true, fullName: true, course: true },
    });
    const traineeByFullName = new Map(trainees.map(t => [t.fullName, t]));

    const candidates = [];
    const addPayload = (payload, source, sourceDate = null) => {
      const entries = extractLegacyPt051Assessments(payload);
      entries.forEach((assessment, index) => {
        candidates.push({ assessment, source, sourceDate, index });
      });
    };

    const pt051Backups = await db.dataBackup.findMany({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' },
    });
    summary.sources.dataBackupRecords = pt051Backups.length;
    pt051Backups.forEach(backup => addPayload(backup.data, 'DataBackup', backup.createdAt));

    const snapshots = await db.dailySnapshot.findMany({
      select: { date: true, savedAt: true, pt051Assessments: true },
      orderBy: { savedAt: 'desc' },
    });
    summary.sources.dailySnapshots = snapshots.length;
    snapshots.forEach(snapshot => addPayload(snapshot.pt051Assessments, 'DailySnapshot', snapshot.date));

    summary.sources.candidateAssessments = candidates.length;

    const seenEventIds = new Set();
    for (const candidate of candidates) {
      const normalized = normalizeLegacyPt051Assessment(candidate.assessment, traineeByFullName, candidate);
      if (!normalized) {
        summary.skipped++;
        continue;
      }
      if (seenEventIds.has(normalized.eventId)) {
        summary.preservedExisting++;
        continue;
      }
      seenEventIds.add(normalized.eventId);

      try {
        const result = await insertMigratedTraineePerformanceRecord(db, normalized);
        summary[result]++;
      } catch (rowErr) {
        summary.skipped++;
        if (summary.errors.length < 10) {
          summary.errors.push({
            eventId: normalized.eventId,
            traineeFullName: normalized.traineeFullName,
            error: rowErr.message,
          });
        }
      }
    }

    try {
      await db.dataBackup.create({
        data: {
          type: 'migration_trainee_performance_authoritative_v1',
          data: {
            ...summary,
            ranAt: new Date().toISOString(),
          },
        },
      });
    } catch (saveMarkerErr) {
      console.warn('[PT051 Migration] Could not save migration marker:', saveMarkerErr.message);
    }

    console.log(`[PT051 Migration] candidates=${summary.sources.candidateAssessments}, inserted=${summary.inserted}, updatedEmpty=${summary.updatedEmpty}, preserved=${summary.preservedExisting}, skipped=${summary.skipped}`);
    return summary;
  } catch (err) {
    console.error('❌ PT051 legacy migration failed:', err.message);
    return { ...summary, success: false, error: err.message };
  }
}

function extractLegacyPt051Assessments(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (typeof payload !== 'object') return [];
  return Object.values(payload).filter(Boolean);
}

function normalizeLegacyPt051Assessment(assessment, traineeByFullName, candidate = {}) {
  if (!assessment || typeof assessment !== 'object') return null;

  const traineeFullName = assessment.traineeFullName || assessment.trainedFullName || assessment.student || '';
  const trainee = traineeByFullName.get(traineeFullName);
  if (!trainee) return null;

  const flightNumber = String(assessment.flightNumber || assessment.eventCode || assessment.event || '').replace('*', '').trim();
  const date = String(assessment.date || '').slice(0, 10);
  if (!flightNumber || !date) return null;

  const existingEventId = String(assessment.eventId || '').trim();
  const assessmentId = String(assessment.id || '').trim();
  const eventId = existingEventId || assessmentId.replace(/^pt051-/, '').replace(new RegExp(`-${escapeRegExp(traineeFullName)}$`), '') || `legacy-${trainee.id}-${flightNumber}-${date}`;
  if (!eventId) return null;

  const overallGrade = assessment.overallGrade !== undefined && assessment.overallGrade !== null
    ? assessment.overallGrade
    : 'No Grade';

  return {
    ...assessment,
    id: `tp-migrated-${safeIdentifier(eventId)}`.slice(0, 180),
    traineeId: trainee.id,
    traineeFullName,
    eventId,
    eventCode: assessment.eventCode || flightNumber,
    flightNumber,
    date,
    instructorName: assessment.instructorName || assessment.instructor || '',
    overallGrade,
    overallResult: assessment.overallResult ?? null,
    dcoResult: assessment.dcoResult || '',
    isCompleted: assessment.isCompleted !== false,
    course: assessment.course || trainee.course || null,
    createdBy: `legacy-${candidate.source || 'unknown'}`,
  };
}

async function insertMigratedTraineePerformanceRecord(db, assessment) {
  const row = mapAssessmentToRow(assessment);
  const result = await db.$queryRawUnsafe(`
    WITH upserted AS (
      INSERT INTO "TraineePerformance" (
        "id", "traineeId", "traineeFullName", "eventId", "eventCode", "flightNumber",
        "eventDescription", "date", "instructorName", "instructorId",
        "overallGrade", "overallResult", "dcoResult",
        "startTime", "duration", "endTime", "comments",
        "elementScores", "isCompleted", "isGroundSchoolAssessment", "groundSchoolResult",
        "course", "syllabusPhase", "eventSequence", "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
        $7::text, $8::text, $9::text, $10::text,
        $11::text, $12::text, $13::text,
        $14, $15, $16, $17::text,
        $18::jsonb, $19::boolean, $20::boolean, $21,
        $22::text, $23::text, $24, NOW(), NOW(), $25::text
      )
      ON CONFLICT ("eventId") DO UPDATE SET
        "eventCode"                = EXCLUDED."eventCode",
        "flightNumber"             = EXCLUDED."flightNumber",
        "eventDescription"         = COALESCE("TraineePerformance"."eventDescription", EXCLUDED."eventDescription"),
        "date"                     = EXCLUDED."date",
        "instructorName"           = EXCLUDED."instructorName",
        "overallGrade"             = EXCLUDED."overallGrade",
        "overallResult"            = EXCLUDED."overallResult",
        "dcoResult"                = EXCLUDED."dcoResult",
        "startTime"                = EXCLUDED."startTime",
        "duration"                 = EXCLUDED."duration",
        "endTime"                  = EXCLUDED."endTime",
        "comments"                 = EXCLUDED."comments",
        "elementScores"            = EXCLUDED."elementScores",
        "isCompleted"              = EXCLUDED."isCompleted",
        "isGroundSchoolAssessment" = EXCLUDED."isGroundSchoolAssessment",
        "groundSchoolResult"       = EXCLUDED."groundSchoolResult",
        "course"                   = COALESCE("TraineePerformance"."course", EXCLUDED."course"),
        "syllabusPhase"            = COALESCE("TraineePerformance"."syllabusPhase", EXCLUDED."syllabusPhase"),
        "eventSequence"            = COALESCE("TraineePerformance"."eventSequence", EXCLUDED."eventSequence"),
        "updatedAt"                = NOW(),
        "updatedBy"                = EXCLUDED."createdBy"
      WHERE
        "TraineePerformance"."isCompleted" = false
        OR "TraineePerformance"."overallGrade" IS NULL
        OR "TraineePerformance"."overallGrade" = 'No Grade'
      RETURNING xmax = 0 AS inserted
    )
    SELECT
      COALESCE((SELECT inserted FROM upserted), false) AS inserted,
      EXISTS (SELECT 1 FROM upserted) AS changed
  `,
    row.id, row.traineeId, row.traineeFullName, row.eventId, row.eventCode, row.flightNumber,
    row.eventDescription, row.date, row.instructorName, row.instructorId,
    row.overallGrade, row.overallResult, row.dcoResult,
    row.startTime, row.duration, row.endTime, row.comments,
    JSON.stringify(row.elementScores), row.isCompleted, row.isGroundSchoolAssessment, row.groundSchoolResult,
    row.course, row.syllabusPhase, row.eventSequence, row.createdBy
  );

  const first = result?.[0];
  if (first?.inserted === true) return 'inserted';
  if (first?.changed === true) return 'updatedEmpty';
  return 'preservedExisting';
}

function safeIdentifier(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || generateSimpleId();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/trainee-performance
// Query params: traineeId, traineeFullName, instructorName, course, isCompleted, dateFrom, dateTo, limit, offset
app.get('/api/trainee-performance', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
      traineeId,
      traineeFullName,
      instructorName,
      course,
      isCompleted,
      dateFrom,
      dateTo,
      limit = 500,
      offset = 0
    } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (traineeId) {
      conditions.push(`"traineeId" = $${paramIdx++}::text`);
      params.push(traineeId);
    }
    if (traineeFullName) {
      conditions.push(`"traineeFullName" = $${paramIdx++}::text`);
      params.push(traineeFullName);
    }
    if (instructorName) {
      conditions.push(`"instructorName" = $${paramIdx++}::text`);
      params.push(instructorName);
    }
    if (course) {
      conditions.push(`"course" = $${paramIdx++}::text`);
      params.push(course);
    }
    if (hasScopeQuery(req)) {
      const scopedCourseCodes = await getScopedCourseCodes(db, req);
      if (scopedCourseCodes.length === 0) {
        return res.json([]);
      }
      const placeholders = scopedCourseCodes.map(() => `$${paramIdx++}::text`);
      conditions.push(`"course" IN (${placeholders.join(', ')})`);
      params.push(...scopedCourseCodes);
    }
    if (isCompleted !== undefined) {
      conditions.push(`"isCompleted" = $${paramIdx++}::boolean`);
      params.push(isCompleted === 'true');
    }
    if (dateFrom) {
      conditions.push(`"date" >= $${paramIdx++}::text`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`"date" <= $${paramIdx++}::text`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = Math.min(parseInt(limit) || 500, 2000);
    const offsetVal = parseInt(offset) || 0;

    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "TraineePerformance" ${whereClause} ORDER BY "date" DESC, "eventSequence" ASC NULLS LAST, "id" ASC LIMIT ${limitVal} OFFSET ${offsetVal}`,
      ...params
    );

    // Map DB rows to Pt051Assessment shape expected by the app
    const assessments = rows.map(row => mapRowToAssessment(row));
    res.json(assessments);
  } catch (error) {
    console.error('❌ GET /api/trainee-performance error:', error);
    res.status(500).json({ error: 'Failed to fetch assessments', details: error.message });
  }
});

// GET /api/trainee-performance/stats - summary counts per course
// IMPORTANT: This must come BEFORE /:eventId to avoid Express matching 'stats' as an eventId
app.get('/api/trainee-performance/stats', async (req, res) => {
  try {
    const db = await getPrisma();
    const params = [];
    let whereClause = '';
    if (hasScopeQuery(req)) {
      const scopedCourseCodes = await getScopedCourseCodes(db, req);
      if (scopedCourseCodes.length === 0) {
        return res.json({ courses: [], total: 0 });
      }
      const placeholders = scopedCourseCodes.map((_, index) => `$${index + 1}::text`);
      whereClause = `WHERE course IN (${placeholders.join(', ')})`;
      params.push(...scopedCourseCodes);
    }
    const rows = await db.$queryRawUnsafe(`
      SELECT course, COUNT(*) as count, SUM(CASE WHEN "isCompleted" THEN 1 ELSE 0 END) as completed
      FROM "TraineePerformance"
      ${whereClause}
      GROUP BY course
      ORDER BY course
    `, ...params);
    const courses = rows.map(r => ({
      course: r.course,
      count: Number(r.count || 0),
      completed: Number(r.completed || 0),
    }));
    const total = courses.reduce((sum, r) => sum + r.count, 0);
    res.json({ courses, total });
  } catch (error) {
    console.error('❌ GET /api/trainee-performance/stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// POST /api/trainee-performance/migrate-legacy - backfill legacy PT-051 stores into TraineePerformance
// IMPORTANT: This must come BEFORE /:eventId to avoid Express matching 'migrate-legacy' as an eventId.
app.post('/api/trainee-performance/migrate-legacy', async (req, res) => {
  try {
    const db = await getPrisma();
    const result = await migrateLegacyPerformanceIntoTraineePerformance(db, { force: req.body?.force === true });
    res.json(result);
  } catch (error) {
    console.error('❌ POST /api/trainee-performance/migrate-legacy error:', error);
    res.status(500).json({ error: 'Failed to migrate legacy PT-051 records', details: error.message });
  }
});

// GET /api/trainee-performance/:eventId - get single assessment
app.get('/api/trainee-performance/:eventId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId } = req.params;
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "TraineePerformance" WHERE "eventId" = $1::text`,
      eventId
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(mapRowToAssessment(rows[0]));
  } catch (error) {
    console.error('❌ GET /api/trainee-performance/:eventId error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment', details: error.message });
  }
});

// POST /api/trainee-performance - create new assessment
app.post('/api/trainee-performance', async (req, res) => {
  try {
    const db = await getPrisma();
    const data = req.body;

    if (!data.eventId || !data.traineeId || !data.traineeFullName) {
      return res.status(400).json({ error: 'eventId, traineeId, traineeFullName are required' });
    }

    // Map Pt051Assessment shape → DB columns
    const row = mapAssessmentToRow(data);

    await db.$executeRawUnsafe(`
      INSERT INTO "TraineePerformance" (
        "id", "traineeId", "traineeFullName", "eventId", "eventCode", "flightNumber",
        "eventDescription", "date", "instructorName", "instructorId",
        "overallGrade", "overallResult", "dcoResult",
        "startTime", "duration", "endTime", "comments",
        "elementScores", "isCompleted", "isGroundSchoolAssessment", "groundSchoolResult",
        "course", "syllabusPhase", "eventSequence", "createdAt", "updatedAt", "createdBy"
      ) VALUES (
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
        $7::text, $8::text, $9::text, $10::text,
        $11::text, $12::text, $13::text,
        $14, $15, $16, $17::text,
        $18::jsonb, $19::boolean, $20::boolean, $21,
        $22::text, $23::text, $24, NOW(), NOW(), $25::text
      )
      ON CONFLICT ("eventId") DO UPDATE SET
        "overallGrade"             = EXCLUDED."overallGrade",
        "overallResult"            = EXCLUDED."overallResult",
        "dcoResult"                = EXCLUDED."dcoResult",
        "comments"                 = EXCLUDED."comments",
        "elementScores"            = EXCLUDED."elementScores",
        "isCompleted"              = EXCLUDED."isCompleted",
        "instructorName"           = EXCLUDED."instructorName",
        "startTime"                = EXCLUDED."startTime",
        "duration"                 = EXCLUDED."duration",
        "endTime"                  = EXCLUDED."endTime",
        "isGroundSchoolAssessment" = EXCLUDED."isGroundSchoolAssessment",
        "groundSchoolResult"       = EXCLUDED."groundSchoolResult",
        "updatedAt"                = NOW(),
        "updatedBy"                = EXCLUDED."createdBy"
    `,
      row.id, row.traineeId, row.traineeFullName, row.eventId, row.eventCode, row.flightNumber,
      row.eventDescription, row.date, row.instructorName, row.instructorId,
      row.overallGrade, row.overallResult, row.dcoResult,
      row.startTime, row.duration, row.endTime, row.comments,
      JSON.stringify(row.elementScores), row.isCompleted, row.isGroundSchoolAssessment, row.groundSchoolResult,
      row.course, row.syllabusPhase, row.eventSequence, row.createdBy
    );

    const created = await db.$queryRawUnsafe(
      `SELECT * FROM "TraineePerformance" WHERE "eventId" = $1::text`, row.eventId
    );
    res.status(201).json(mapRowToAssessment(created[0]));
  } catch (error) {
    console.error('❌ POST /api/trainee-performance error:', error);
    res.status(500).json({ error: 'Failed to create assessment', details: error.message });
  }
});

// PUT /api/trainee-performance/:eventId - update existing assessment
app.put('/api/trainee-performance/:eventId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId } = req.params;
    const data = req.body;

    // Check it exists
    const existing = await db.$queryRawUnsafe(
      `SELECT "id" FROM "TraineePerformance" WHERE "eventId" = $1::text`, eventId
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Build update from Pt051Assessment fields
    const comments = buildCommentsString(data);
    const elementScores = (data.scores || data.elementScores || []);
    const isGS = data.groundSchoolAssessment?.isAssessment || false;
    const gsResult = data.groundSchoolAssessment?.result ?? null;
    const isCompleted = data.isCompleted === true ||
      data.isCompleted === 'true' ||
      String(data.dcoResult || '').trim().toUpperCase() === 'DCO';

    await db.$executeRawUnsafe(`
      UPDATE "TraineePerformance" SET
        "overallGrade"             = $1::text,
        "overallResult"            = $2::text,
        "dcoResult"                = $3::text,
        "instructorName"           = $4::text,
        "date"                     = $5::text,
        "flightNumber"             = $6::text,
        "comments"                 = $7::text,
        "elementScores"            = $8::jsonb,
        "isCompleted"              = $9::boolean,
        "startTime"                = $10,
        "duration"                 = $11,
        "endTime"                  = $12,
        "isGroundSchoolAssessment" = $13::boolean,
        "groundSchoolResult"       = $14,
        "updatedAt"                = NOW()
      WHERE "eventId" = $15::text
    `,
      String(data.overallGrade ?? 'No Grade'),
      data.overallResult ?? null,
      data.dcoResult ?? null,
      data.instructorName ?? '',
      data.date ?? '',
      data.flightNumber ?? '',
      comments,
      JSON.stringify(elementScores),
      isCompleted,
      data.startTime ?? null,
      data.duration ?? null,
      data.endTime ?? null,
      isGS,
      gsResult,
      eventId
    );

    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "TraineePerformance" WHERE "eventId" = $1::text`, eventId
    );
    res.json(mapRowToAssessment(updated[0]));
  } catch (error) {
    console.error('❌ PUT /api/trainee-performance/:eventId error:', error);
    res.status(500).json({ error: 'Failed to update assessment', details: error.message });
  }
});

// DELETE /api/trainee-performance/:eventId - delete assessment
app.delete('/api/trainee-performance/:eventId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId } = req.params;
    await db.$executeRawUnsafe(
      `DELETE FROM "TraineePerformance" WHERE "eventId" = $1::text`, eventId
    );
    res.json({ success: true, eventId });
  } catch (error) {
    console.error('❌ DELETE /api/trainee-performance/:eventId error:', error);
    res.status(500).json({ error: 'Failed to delete assessment', details: error.message });
  }
});

// POST /api/trainee-performance/bulk - bulk insert for data import (idempotent)
app.post('/api/trainee-performance/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array required' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    // Process in batches of 100
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      for (const data of batch) {
        try {
          const row = mapAssessmentToRow(data);
          await db.$executeRawUnsafe(`
            INSERT INTO "TraineePerformance" (
              "id", "traineeId", "traineeFullName", "eventId", "eventCode", "flightNumber",
              "eventDescription", "date", "instructorName", "instructorId",
              "overallGrade", "overallResult", "dcoResult",
              "startTime", "duration", "endTime", "comments",
              "elementScores", "isCompleted", "isGroundSchoolAssessment", "groundSchoolResult",
              "course", "syllabusPhase", "eventSequence", "createdAt", "updatedAt", "createdBy"
            ) VALUES (
              $1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
              $7::text, $8::text, $9::text, $10::text,
              $11::text, $12::text, $13::text,
              $14, $15, $16, $17::text,
              $18::jsonb, $19::boolean, $20::boolean, $21,
              $22::text, $23::text, $24, NOW(), NOW(), $25::text
            )
            ON CONFLICT ("eventId") DO NOTHING
          `,
            row.id, row.traineeId, row.traineeFullName, row.eventId, row.eventCode, row.flightNumber,
            row.eventDescription, row.date, row.instructorName, row.instructorId,
            row.overallGrade, row.overallResult, row.dcoResult,
            row.startTime, row.duration, row.endTime, row.comments,
            JSON.stringify(row.elementScores), row.isCompleted, row.isGroundSchoolAssessment, row.groundSchoolResult,
            row.course, row.syllabusPhase, row.eventSequence, row.createdBy
          );
          inserted++;
        } catch (rowErr) {
          skipped++;
          if (errors.length < 10) errors.push({ eventId: data.eventId, error: rowErr.message });
        }
      }
    }

    res.json({ success: true, inserted, skipped, errors });
  } catch (error) {
    console.error('❌ POST /api/trainee-performance/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk insert assessments', details: error.message });
  }
});

// -----------------------------------------------------------------------
// Helper: Map DB row → Pt051Assessment (app interface shape)
// -----------------------------------------------------------------------
function mapRowToAssessment(row) {
  if (!row) return null;
  // elementScores is stored as JSONB - parse if string
  let scores = row.elementScores;
  if (typeof scores === 'string') {
    try { scores = JSON.parse(scores); } catch { scores = []; }
  }
  if (!Array.isArray(scores)) scores = [];

  // comments is the structured "QFI: ...\nWeather: ..." string
  // overallComments is extracted from it for backward compatibility
  const overallComments = extractOverallComment(row.comments);
  const rawOverallGrade = row.overallGrade;
  const overallGrade = rawOverallGrade === null || rawOverallGrade === undefined || rawOverallGrade === 'No Grade'
    ? (rawOverallGrade || null)
    : Number.isNaN(Number(rawOverallGrade))
      ? rawOverallGrade
      : Number(rawOverallGrade);

  return {
    id:                  row.eventId,           // app uses eventId as the key identifier
    traineeFullName:     row.traineeFullName,
    trainedFullName:     row.traineeFullName,   // backward compat alias used in MyDashboard
    eventId:             row.eventId,
    flightNumber:        row.flightNumber,
    date:                row.date,
    instructorName:      row.instructorName,
    overallGrade:        overallGrade,
    overallResult:       row.overallResult || null,
    dcoResult:           row.dcoResult || '',
    overallComments:     overallComments,
    comments:            row.comments || '',
    startTime:           row.startTime || null,
    duration:            row.duration || null,
    endTime:             row.endTime || null,
    isCompleted:         row.isCompleted || false,
    scores:              scores,                // array of {element, grade, comment}
    groundSchoolAssessment: row.isGroundSchoolAssessment ? {
      isAssessment: true,
      result: row.groundSchoolResult ?? undefined
    } : undefined,
    // Extra fields for filtering/display
    course:              row.course || null,
    syllabusPhase:       row.syllabusPhase || null,
    eventSequence:       row.eventSequence || null,
    traineeId:           row.traineeId,
    _dbId:               row.id               // internal DB id, not used by app
  };
}

// Helper: Map Pt051Assessment (app shape) → DB row for INSERT
function mapAssessmentToRow(data) {
  const id = data._dbId || data.id || generateSimpleId();
  const dcoResult = data.dcoResult || null;
  const isDcoComplete = String(dcoResult || '').trim().toUpperCase() === 'DCO';

  // Normalize scores: app uses data.scores, import uses data.elementScores
  const elementScores = (data.scores || data.elementScores || []).map(s => ({
    element: s.element || '',
    grade:   s.grade != null ? String(s.grade) : null,
    comment: s.comment || ''
  }));

  // Build structured comments string from Pt051Assessment shape
  const comments = data.comments || buildCommentsString(data);

  return {
    id:                      id,
    traineeId:               data.traineeId || '',
    traineeFullName:         data.traineeFullName || data.trainedFullName || '',
    eventId:                 data.eventId || '',
    eventCode:               data.eventCode || data.flightNumber || '',
    flightNumber:            data.flightNumber || '',
    eventDescription:        data.eventDescription || null,
    date:                    data.date || '',
    instructorName:          data.instructorName || '',
    instructorId:            data.instructorId || null,
    overallGrade:            data.overallGrade != null ? String(data.overallGrade) : 'No Grade',
    overallResult:           data.overallResult || null,
    dcoResult:               dcoResult,
    startTime:               data.startTime != null ? Number(data.startTime) : null,
    duration:                data.duration != null ? Number(data.duration) : null,
    endTime:                 data.endTime != null ? Number(data.endTime) : null,
    comments:                comments || null,
    elementScores:           elementScores,
    isCompleted:             data.isCompleted === true || data.isCompleted === 'true' || isDcoComplete,
    isGroundSchoolAssessment: data.groundSchoolAssessment?.isAssessment || false,
    groundSchoolResult:      data.groundSchoolAssessment?.result ?? null,
    course:                  data.course || null,
    syllabusPhase:           data.syllabusPhase || null,
    eventSequence:           data.eventSequence != null ? parseInt(data.eventSequence) : null,
    createdBy:               data.createdBy || null
  };
}

// Helper: Build "QFI: ...\nWeather: ..." string from Pt051Assessment fields
function buildCommentsString(data) {
  // If already in structured format, return as-is
  if (data.comments && data.comments.includes('QFI:')) return data.comments;
  // Build from individual fields (backward compat)
  const qfi     = data.qfiComments     || '';
  const weather  = data.weatherComments || '';
  const profile  = data.profileComments || '';
  const overall  = data.overallComments || '';
  const nest     = data.nestComments    || '';
  if (!qfi && !weather && !profile && !overall && !nest) return data.comments || null;
  return `QFI: ${qfi}\nWeather: ${weather}\nProfile: ${profile}\nOverall: ${overall}\nNEST: ${nest}`;
}

// Helper: Extract "Overall" section from structured comments string
function extractOverallComment(comments) {
  if (!comments) return '';
  const match = comments.match(/Overall:\s*([\s\S]*?)(?:\nNEST:|$)/);
  return match ? match[1].trim() : '';
}

// Helper: Generate a simple unique ID when cuid2 is not available
function generateSimpleId() {
  return 'tp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// ── Ensure snapshot columns exist on FlightLogEntry ─────────────────────────
async function ensureFlightLogSnapshotColumns(db) {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "FlightLogEntry"
        ADD COLUMN IF NOT EXISTS "captainLogSnapshot" JSONB,
        ADD COLUMN IF NOT EXISTS "crewLogSnapshot" JSONB
    `);
  } catch (err) {
    console.log('[FlightLog] snapshot column ensure:', err.message);
  }
}

// ── GET /api/flight-log ────────────────────────────────────────────────────────
// Accepts: scheduleEventId, traineeId, personnelId, personName, eventCode, fromDate, toDate
app.get('/api/flight-log', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    const { scheduleEventId, traineeId, personnelId, personName, eventCode, fromDate, toDate } = req.query;

    // Require at least one filter
    if (!scheduleEventId && !traineeId && !personnelId && !personName && !eventCode) {
      return res.status(400).json({ error: 'At least one filter param required: scheduleEventId, traineeId, personnelId, personName, or eventCode' });
    }

    const where = {};
    if (scheduleEventId) where.scheduleEventId = scheduleEventId;
    if (traineeId)       where.traineeId       = traineeId;
    if (personnelId)     where.personnelId     = personnelId;
    if (personName)      where.personName      = { contains: personName, mode: 'insensitive' };
    if (eventCode)       where.eventCode       = eventCode;
    if (fromDate || toDate) {
      where.eventDate = {};
      if (fromDate) where.eventDate.gte = fromDate;
      if (toDate)   where.eventDate.lte = toDate;
    }

    const entries = await db.flightLogEntry.findMany({
      where,
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
    });
    console.log(`✅ GET /api/flight-log filters=${JSON.stringify({scheduleEventId,traineeId,personnelId,personName,eventCode})} → ${entries.length} rows`);
    res.json({ entries, count: entries.length });
  } catch (error) {
    console.error('❌ GET /api/flight-log error:', error);
    res.status(500).json({ error: 'Failed to fetch flight log entries', details: error.message });
  }
});

// ── POST /api/flight-log (upsert by scheduleEventId + personRole) ─────────────
app.post('/api/flight-log', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    const body = req.body;
    const {
      scheduleEventId, eventCode, eventDate, eventType,
      traineeId, personnelId, personName, personRole,
      aircraftNumber, fromIcao, toIcao, duty,
      isSolo, isDual, isFlightLog, isFtdLog,
      takeoffTime, landTime, totalTime, captainTime, instructorTime,
      nightTime, ifActualTime, ifSimTime, ineffectiveTime,
      ilsCount, rnpCount, tacanCount, vorCount,
      captainLogSnapshot, crewLogSnapshot,
      recordedBy, notes,
    } = body;

    if (!scheduleEventId || !personRole || !personName) {
      return res.status(400).json({ error: 'scheduleEventId, personName, personRole are required' });
    }

    // Upsert: match on scheduleEventId + personRole (one row per sortie per role)
    const existing = await db.flightLogEntry.findFirst({
      where: { scheduleEventId, personRole },
    });

    const data = {
      scheduleEventId,
      eventCode:      eventCode || scheduleEventId,
      eventDate:      eventDate || new Date().toISOString().slice(0, 10),
      eventType:      eventType || 'flight',
      traineeId:      traineeId  || null,
      personnelId:    personnelId || null,
      personName,
      personRole,
      aircraftNumber: aircraftNumber || null,
      fromIcao:       fromIcao || null,
      toIcao:         toIcao   || null,
      duty:           duty     || null,
      isSolo:         !!isSolo,
      isDual:         !!isDual,
      isFlightLog:    isFlightLog !== undefined ? !!isFlightLog : true,
      isFtdLog:       !!isFtdLog,
      takeoffTime:    takeoffTime || null,
      landTime:       landTime   || null,
      totalTime:      totalTime       != null ? parseFloat(totalTime)       : null,
      captainTime:    captainTime     != null ? parseFloat(captainTime)     : null,
      instructorTime: instructorTime  != null ? parseFloat(instructorTime)  : null,
      nightTime:      nightTime       != null ? parseFloat(nightTime)       : null,
      ifActualTime:   ifActualTime    != null ? parseFloat(ifActualTime)    : null,
      ifSimTime:      ifSimTime       != null ? parseFloat(ifSimTime)       : null,
      ineffectiveTime:ineffectiveTime != null ? parseFloat(ineffectiveTime) : null,
      ilsCount:       parseInt(ilsCount)   || 0,
      rnpCount:       parseInt(rnpCount)   || 0,
      tacanCount:     parseInt(tacanCount) || 0,
      vorCount:       parseInt(vorCount)   || 0,
      captainLogSnapshot: captainLogSnapshot || null,
      crewLogSnapshot:    crewLogSnapshot   || null,
      recordedBy:     recordedBy || null,
      notes:          notes      || null,
    };

    let entry, created;
    if (existing) {
      entry = await db.flightLogEntry.update({
        where: { id: existing.id },
        data,
      });
      created = false;
    } else {
      entry = await db.flightLogEntry.create({ data });
      created = true;
    }

    console.log(`✅ POST /api/flight-log ${created ? 'created' : 'updated'} id=${entry.id} scheduleEventId=${scheduleEventId} role=${personRole}`);
    res.json({ success: true, entry, created });
  } catch (error) {
    console.error('❌ POST /api/flight-log error:', error);
    res.status(500).json({ error: 'Failed to save flight log entry', details: error.message });
  }
});

// Fallback: serve index-v2.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index-v2.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DFP-NEO V2 Server running on port ${PORT} [theme-system-v1 build:${new Date().toISOString()}]`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
});
