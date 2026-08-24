import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import {
  LICENSE_PAYLOAD_SCHEMA,
  buildImportedLicenseRecord,
  evaluateCommercialLicenses,
  getDeploymentFingerprint,
  getLicenseRuntimeMode,
  normaliseLicenceEnforcementMode,
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
const multer = require('multer');
const XLSX = require('xlsx');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls']);
const ALLOWED_SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 25,
    fieldNameSize: 80,
    fieldSize: 256 * 1024,
    parts: 35,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file?.originalname || '').toLowerCase();
    const mimetype = String(file?.mimetype || '').toLowerCase();
    if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(extension)) {
      return cb(new Error('Only Excel workbook files can be uploaded.'));
    }
    if (mimetype && !ALLOWED_SPREADSHEET_MIME_TYPES.has(mimetype)) {
      return cb(new Error('The uploaded file type is not recognised as an Excel workbook.'));
    }
    cb(null, true);
  },
});

const INTEGRATED_COMBAT_OPERATIONS_PACKAGE_CODE = 'ICO';
const INTEGRATED_COMBAT_OPERATIONS_DEFAULT_FLIGHT_OR_SIM_HOURS = 1.2;
const INTEGRATED_COMBAT_OPERATIONS_PREFLIGHT_HOURS = 1.5;
const INTEGRATED_COMBAT_OPERATIONS_POSTFLIGHT_HOURS = 1.0;
const FLIGHT_SCHOOL_ASSESSMENT_REQUIRED_LMP_KEYS = new Set(['BPC+IPC', 'FIC']);

function normaliseSyllabusCourses(courses) {
  if (Array.isArray(courses)) return courses;
  if (typeof courses === 'string') {
    try {
      const parsed = JSON.parse(courses);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return courses.split(',').map(course => course.trim()).filter(Boolean);
  }
  return [];
}

function normaliseCourseKey(value) {
  return String(value || '').trim().toUpperCase();
}

function syllabusItemMatchesConfiguredCourse(item, courseOrLmpType) {
  const requestedKey = normaliseCourseKey(courseOrLmpType);
  if (!requestedKey) return false;
  return normaliseSyllabusCourses(item?.courses).some(course => normaliseCourseKey(course) === requestedKey);
}

function isFlightSchoolAssessmentRequiredDefaultItem(item) {
  const keys = [
    item?.lmpType,
    item?.module,
    ...normaliseSyllabusCourses(item?.courses),
  ].map(normaliseCourseKey).filter(Boolean);
  return keys.some(key => FLIGHT_SCHOOL_ASSESSMENT_REQUIRED_LMP_KEYS.has(key));
}

function groupSyllabusByConfiguredCourses(items) {
  return (Array.isArray(items) ? items : []).reduce((groups, item) => {
    normaliseSyllabusCourses(item?.courses).forEach(course => {
      const label = String(course || '').trim();
      if (!label) return;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  }, {});
}

function getSyllabusGroupForLmpType(syllabusData, lmpType) {
  const requestedKey = normaliseCourseKey(lmpType);
  if (!requestedKey || !syllabusData || typeof syllabusData !== 'object') return [];
  const matchingKey = Object.keys(syllabusData).find(key => normaliseCourseKey(key) === requestedKey);
  const items = matchingKey ? syllabusData[matchingKey] : [];
  return Array.isArray(items) ? items : [];
}

function getAuthoritativeSyllabusDuration(item) {
  const flightOrSimHours = Number(item?.flightOrSimHours);
  if (Number.isFinite(flightOrSimHours) && flightOrSimHours > 0) return flightOrSimHours;
  const totalEventHours = Number(item?.totalEventHours);
  if (Number.isFinite(totalEventHours) && totalEventHours > 0) return totalEventHours;
  const duration = Number(item?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function normaliseRuntimeAircraftConfigs(value) {
  const rawConfigs = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|;|,/)
      : [];
  const configs = rawConfigs
    .map(config => String(config || '').trim().toUpperCase())
    .filter(Boolean)
    .map(config => {
      if (config === 'ANY') return 'ANY';
      const configNumber = config
        .replace(/^CONFIG\s+/, '')
        .replace(/^CONFIG[-_]/, '')
        .replace(/^C\s*/, '');
      return /^\d+$/.test(configNumber) ? `CONFIG-${configNumber}` : config;
    });
  return configs.length > 0 ? Array.from(new Set(configs)) : ['ANY'];
}

function normaliseSyllabusItemForRuntime(item) {
  if (!item) return item;
  const courses = normaliseSyllabusCourses(item.courses);
  const acceptableAircraftConfigs = normaliseRuntimeAircraftConfigs(item.acceptableAircraftConfigs);
  const testEventType = ['FLIGHT_TEST', 'SIMULATOR_TEST'].includes(String(item.testEventType || '').trim().toUpperCase())
    ? String(item.testEventType).trim().toUpperCase()
    : 'NONE';
  const testingOfficerQualificationId = testEventType === 'NONE'
    ? null
    : String(item.testingOfficerQualificationId || '').trim() || null;
  const useTestingOfficerSecondaryCallsign = testEventType === 'FLIGHT_TEST'
    && item.useTestingOfficerSecondaryCallsign === true;
  const flightOrSimHours = Number.isFinite(Number(item.flightOrSimHours)) && Number(item.flightOrSimHours) > 0
    ? Number(item.flightOrSimHours)
    : INTEGRATED_COMBAT_OPERATIONS_DEFAULT_FLIGHT_OR_SIM_HOURS;
  const duration = getAuthoritativeSyllabusDuration(item);
  if (
    item.lmpType === 'Staff CAT' &&
    courses.some(course => String(course || '').trim().toUpperCase() === INTEGRATED_COMBAT_OPERATIONS_PACKAGE_CODE)
  ) {
    return {
      ...item,
      courses,
      acceptableAircraftConfigs,
      testEventType,
      testingOfficerQualificationId,
      useTestingOfficerSecondaryCallsign,
      flightOrSimHours,
      duration: flightOrSimHours,
      preFlightTime: INTEGRATED_COMBAT_OPERATIONS_PREFLIGHT_HOURS,
      postFlightTime: INTEGRATED_COMBAT_OPERATIONS_POSTFLIGHT_HOURS,
    };
  }
  return {
    ...item,
    courses,
    acceptableAircraftConfigs,
    assessmentRequired: item.assessmentRequired === true || isFlightSchoolAssessmentRequiredDefaultItem({ ...item, courses }),
    testEventType,
    testingOfficerQualificationId,
    useTestingOfficerSecondaryCallsign,
    duration,
  };
}

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

function buildSecurityConnectSources(req) {
  const sources = new Set(["'self'"]);
  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) sources.add(requestOrigin);
  getAllowedOrigins().forEach(origin => sources.add(origin));
  return Array.from(sources).join(' ');
}

function setSecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      `connect-src ${buildSecurityConnectSources(req)}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ')
  );
  next();
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

function getConfiguredSecret(name, aliases = []) {
  const candidates = [name, ...aliases];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function requireSeedEndpointSecret() {
  const allowDevelopmentSeed = String(process.env.ALLOW_DEMO_SEEDING || '').trim().toLowerCase() === 'true';
  if (!allowDevelopmentSeed) {
    throw new Error('Demo and historical seed endpoints require ALLOW_DEMO_SEEDING=true.');
  }

  const configuredSecret = getConfiguredSecret('SEED_SECRET');
  if (configuredSecret) return configuredSecret;

  if (process.env.NODE_ENV !== 'production' && allowDevelopmentSeed) {
    console.warn('⚠️ SEED_SECRET is not configured; ALLOW_DEMO_SEEDING=true enables the development seed secret.');
    return 'dfp-seed-development-only';
  }

  throw new Error('SEED_SECRET must be configured before demo or historical seed endpoints can run.');
}

function validateSeedEndpointSecret(req, res) {
  let expectedSecret = '';
  try {
    expectedSecret = requireSeedEndpointSecret();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Seed endpoint disabled',
      message: error.message,
    });
    return false;
  }

  const suppliedSecret = String(req.query?.secret || req.body?.secret || req.headers['x-seed-secret'] || '').trim();
  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'A valid seed secret is required.',
    });
    return false;
  }

  return true;
}

// JWT Configuration
const JWT_SECRET = requireConfiguredSecret('JWT_SECRET', 'dfp-neo-development-jwt-secret', ['NEXTAUTH_SECRET', 'AUTH_SECRET']);
const EMAIL_ACTIVATION_SETTINGS_ORG_ID = '__email_activation__';
const JWT_ACCESS_EXPIRY = '1h';
const JWT_REFRESH_EXPIRY = '7d';
const AVWX_API_TOKEN = (process.env.AVWX_API_TOKEN || process.env.VITE_AVWX_API_TOKEN || '').trim();
const SECURITY_EVENT_WEBHOOK_URL = (process.env.DFP_NEO_SECURITY_EVENT_WEBHOOK_URL || '').trim();

// Parse JSON bodies - increased limit to handle large settings/syllabus payloads
app.use(setSecurityHeaders);
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
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Cookie, X-Requested-With, X-NEO-Client-Id');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const liveChangeClients = new Map();

function sendLiveChange(client, payload) {
  try {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    liveChangeClients.delete(client.id);
  }
}

function broadcastLiveChange(change) {
  const payload = {
    ...change,
    id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    changedAt: new Date().toISOString(),
  };
  liveChangeClients.forEach((client) => {
    if (client.clientId && payload.sourceClientId && client.clientId === payload.sourceClientId) return;
    sendLiveChange(client, payload);
  });
}

app.get('/api/live-changes', (req, res) => {
  const id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const clientId = String(req.query.clientId || '').trim();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');
  const client = { id, clientId, res };
  liveChangeClients.set(id, client);
  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
      liveChangeClients.delete(id);
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    liveChangeClients.delete(id);
  });
});

app.use('/api', (req, res, next) => {
  const method = String(req.method || '').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!isMutation) return next();
  const pathName = `${req.baseUrl || ''}${req.path || ''}`;
  const shouldBroadcast = pathName !== '/api/settings';
  res.on('finish', () => {
    if (!shouldBroadcast) return;
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    const detail = pathName === '/api/daily-snapshot/save'
      ? {
          date: req.body?.date || null,
          locationCode: req.body?.locationCode || null,
          unitCode: req.body?.unitCode || null,
          eventCount: Array.isArray(req.body?.scheduleEvents) ? req.body.scheduleEvents.length : null,
        }
      : pathName === '/api/mobile/flight-authorisation'
        ? {
            date: req.body?.snapshotKey || req.body?.date || null,
            eventId: req.body?.eventId || null,
            role: req.body?.role || null,
            action: req.body?.action || 'sign',
            isVerbal: req.body?.isVerbal === true || String(req.body?.isVerbal || '').trim().toLowerCase() === 'true',
          }
        : pathName === '/api/mobile/flight-times'
          ? {
              date: req.body?.snapshotKey || req.body?.date || null,
              eventId: req.body?.eventId || null,
            }
        : {};
    broadcastLiveChange({
      sourceClientId: String(req.headers['x-neo-client-id'] || '').trim(),
      method,
      path: pathName,
      detail,
    });
  });
  next();
});

app.get('/api/weather/taf/:icao', async (req, res) => {
  const icao = String(req.params.icao || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO code' });
  }
  if (!AVWX_API_TOKEN) {
    return res.status(503).json({ error: 'Weather provider not configured. Set AVWX_API_TOKEN on the server.' });
  }
  if (typeof fetch !== 'function') {
    return res.status(503).json({ error: 'Weather provider fetch is unavailable in this runtime.' });
  }

  try {
    const providerUrl = `https://avwx.rest/api/taf/${encodeURIComponent(icao)}?token=${encodeURIComponent(AVWX_API_TOKEN)}`;
    const providerResponse = await fetch(providerUrl, {
      headers: { Accept: 'application/json' },
    });
    const text = await providerResponse.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (!providerResponse.ok) {
      const providerError = payload?.error || payload?.message || `Weather provider returned HTTP ${providerResponse.status}`;
      return res.status(providerResponse.status).json({ error: providerError });
    }

    return res.json(payload);
  } catch (error) {
    console.error(`❌ GET /api/weather/taf/${icao} error:`, error);
    return res.status(502).json({ error: 'Failed to fetch TAF from weather provider' });
  }
});

// Lazy-load Prisma to avoid issues at startup
let prisma = null;
let prismaMaintenanceStarted = false;
let prismaMaintenancePromise = null;
let userActivationColumnsEnsured = false;

async function ensureUserActivationColumns(db) {
  if (userActivationColumnsEnsured) return;
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationCodeHash" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationCodeExpiresAt" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationCodeSentAt" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationCodeUsedAt" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationAttemptCount" INTEGER NOT NULL DEFAULT 0`);
  await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationLockedUntil" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_activationCodeExpiresAt_idx" ON "User"("activationCodeExpiresAt")`);
  userActivationColumnsEnsured = true;
}

const ACTIVATION_SUFFIX_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateActivationSuffix(length = 12) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, byte => ACTIVATION_SUFFIX_CHARS[byte % ACTIVATION_SUFFIX_CHARS.length]).join('');
}

function normaliseActivationCredentialAttempt(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function getActivationStatusForUser(user) {
  if (!user) return 'NO_USER';
  if (user.activationCodeUsedAt) return 'USED';
  if (user.activationCodeHash) {
    return user.activationCodeExpiresAt && new Date(user.activationCodeExpiresAt).getTime() <= Date.now()
      ? 'EXPIRED'
      : 'PENDING';
  }
  return user.mustChangePassword ? 'PASSWORD_CHANGE_REQUIRED' : 'NONE';
}

function buildActivationLoginDiagnostic({ loginUserId, password, user, expectedLength = null }) {
  const rawPassword = String(password || '');
  const normalisedPassword = normaliseActivationCredentialAttempt(rawPassword);
  const cleanLoginUserId = normalisePersonnelId(loginUserId);
  return {
    generatedAt: new Date().toISOString(),
    suppliedUserId: String(loginUserId || '').trim(),
    normalisedSuppliedPersonnelId: cleanLoginUserId,
    userFound: Boolean(user),
    matchedUserId: user?.userId || null,
    matchedUsername: user?.username || null,
    matchedEmail: user?.email || null,
    matchedName: [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || null,
    isActive: user ? Boolean(user.isActive) : null,
    mustChangePassword: user ? Boolean(user.mustChangePassword) : null,
    hasActivationCodeHash: Boolean(user?.activationCodeHash),
    activationStatus: getActivationStatusForUser(user),
    activationExpiresAt: user?.activationCodeExpiresAt || null,
    activationUsedAt: user?.activationCodeUsedAt || null,
    activationAttemptCount: Number(user?.activationAttemptCount || 0),
    activationLockedUntil: user?.activationLockedUntil || null,
    suppliedPasswordLength: rawPassword.length,
    normalisedPasswordLength: normalisedPassword.length,
    expectedActivationCredentialLength: expectedLength,
    passwordStartsWithSuppliedPersonnelId: cleanLoginUserId ? normalisedPassword.startsWith(cleanLoginUserId) : null,
    suppliedActivationSuffixLength: cleanLoginUserId && normalisedPassword.startsWith(cleanLoginUserId)
      ? normalisedPassword.length - cleanLoginUserId.length
      : null,
    note: 'This diagnostic intentionally excludes the supplied password, activation code, and stored password/hash.',
  };
}

function getActivationExpiryDate(configuredHours = null) {
  const hours = Math.max(1, Math.min(168, Number(process.env.DFP_ACTIVATION_EXPIRY_HOURS || configuredHours || 24) || 24));
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function normalisePersonnelId(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

async function findLinkedPersonnelId(db, userDbId) {
  const rows = await db.$queryRawUnsafe(
    `SELECT COALESCE(p."idNumber"::text, t."idNumber"::text) AS "personnelId"
     FROM "User" u
     LEFT JOIN "Personnel" p ON p."userId" = u.id
     LEFT JOIN "Trainee" t ON t."userId" = u.id
     WHERE u.id = $1
     LIMIT 1`,
    userDbId
  );
  return normalisePersonnelId(rows?.[0]?.personnelId);
}

async function repairSessionPersonLink(db, user) {
  const personnelId = normalisePersonnelId(user?.userId || user?.username);
  if (!personnelId || !user?.id) return;

  const staffRows = await db.$queryRawUnsafe(
    `SELECT id, "userId" FROM "Personnel" WHERE "idNumber"::text = $1 LIMIT 2`,
    personnelId
  );
  const traineeRows = await db.$queryRawUnsafe(
    `SELECT id, "userId" FROM "Trainee" WHERE "idNumber"::text = $1 LIMIT 2`,
    personnelId
  );
  const matches = [
    ...(staffRows || []).map((row) => ({ ...row, type: 'staff' })),
    ...(traineeRows || []).map((row) => ({ ...row, type: 'trainee' })),
  ];

  // A session can repair only an unambiguous, currently unlinked profile whose Personnel ID matches its own login.
  if (matches.length !== 1 || matches[0].userId) return;
  const target = matches[0];
  const table = target.type === 'staff' ? 'Personnel' : 'Trainee';
  await db.$executeRawUnsafe(
    `UPDATE "${table}" SET "userId" = $1 WHERE id = $2 AND "userId" IS NULL`,
    user.id,
    target.id
  );
}

function getUserNameCandidates(user = {}) {
  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const candidates = [];
  if (firstName && lastName) {
    candidates.push(`${lastName}, ${firstName}`);
    candidates.push(`${firstName} ${lastName}`);
  }

  const loginId = String(user.userId || user.username || '').trim();
  if (loginId && loginId.includes('.')) {
    const [firstPart, ...lastParts] = loginId.split('.');
    const derivedFirstName = firstPart ? firstPart.charAt(0).toUpperCase() + firstPart.slice(1) : '';
    const derivedLastName = lastParts.length
      ? lastParts.join(' ').replace(/\b\w/g, (char) => char.toUpperCase())
      : '';
    if (derivedFirstName && derivedLastName) {
      candidates.push(`${derivedLastName}, ${derivedFirstName}`);
      candidates.push(`${derivedFirstName} ${derivedLastName}`);
    }
  }

  return [...new Set(candidates.map((name) => name.trim()).filter(Boolean))];
}

function splitCanonicalPersonName(name) {
  const clean = String(name || '').split(' – ')[0].split(' - ')[0].trim();
  if (!clean) return { firstName: '', lastName: '' };
  if (clean.includes(',')) {
    const [lastName, ...firstParts] = clean.split(',');
    return { firstName: firstParts.join(',').trim(), lastName: lastName.trim() };
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: '', lastName: clean };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

async function findCanonicalPersonForUser(db, user) {
  if (!user?.id) return null;

  const linkedRows = await db.$queryRawUnsafe(
    `SELECT 'staff' AS type, id, "idNumber", name, NULL::text AS "fullName", email, unit, location, flight, "userId"
       FROM "Personnel"
      WHERE "userId" = $1
      UNION ALL
     SELECT 'trainee' AS type, id, "idNumber", name, "fullName", email, unit, location, flight, "userId"
       FROM "Trainee"
      WHERE "userId" = $1
      LIMIT 2`,
    user.id
  );
  if (linkedRows?.length === 1) return linkedRows[0];
  if (linkedRows?.length > 1) return null;

  const personnelId = normalisePersonnelId(user.userId || user.username);
  if (personnelId) {
    const idRows = await db.$queryRawUnsafe(
      `SELECT 'staff' AS type, id, "idNumber", name, NULL::text AS "fullName", email, unit, location, flight, "userId"
         FROM "Personnel"
        WHERE "idNumber"::text = $1
        UNION ALL
       SELECT 'trainee' AS type, id, "idNumber", name, "fullName", email, unit, location, flight, "userId"
         FROM "Trainee"
        WHERE "idNumber"::text = $1
        LIMIT 2`,
      personnelId
    );
    const usableIdRows = (idRows || []).filter((row) => !row.userId || row.userId === user.id);
    if (usableIdRows.length === 1) return usableIdRows[0];
    if ((idRows || []).length > 1) return null;
  }

  const nameCandidates = getUserNameCandidates(user);
  if (nameCandidates.length === 0) return null;
  const loweredNameCandidates = nameCandidates.map((name) => name.toLowerCase());
  const namePlaceholders = loweredNameCandidates.map((_, index) => `$${index + 1}`).join(', ');
  const nameRows = await db.$queryRawUnsafe(
    `SELECT 'staff' AS type, id, "idNumber", name, NULL::text AS "fullName", email, unit, location, flight, "userId"
       FROM "Personnel"
      WHERE LOWER(name) IN (${namePlaceholders})
      UNION ALL
     SELECT 'trainee' AS type, id, "idNumber", name, "fullName", email, unit, location, flight, "userId"
       FROM "Trainee"
      WHERE LOWER(name) IN (${namePlaceholders})
         OR LOWER("fullName") IN (${namePlaceholders})
      LIMIT 3`,
    ...loweredNameCandidates
  );
  const usableNameRows = (nameRows || []).filter((row) => !row.userId || row.userId === user.id);
  return usableNameRows.length === 1 ? usableNameRows[0] : null;
}

async function syncCanonicalPersonIdentity(db, user, person) {
  if (!user?.id || !person?.id || (person.userId && person.userId !== user.id)) return user;

  const table = person.type === 'staff' ? 'Personnel' : 'Trainee';
  if (!person.userId) {
    await db.$executeRawUnsafe(
      `UPDATE "${table}" SET "userId" = $1 WHERE id = $2 AND "userId" IS NULL`,
      user.id,
      person.id
    );
    person.userId = user.id;
  }

  const canonicalEmail = String(person.email || '').trim();
  if (!canonicalEmail || canonicalEmail.toLowerCase() === String(user.email || '').trim().toLowerCase()) {
    return user;
  }

  const conflicts = await db.$queryRawUnsafe(
    `SELECT id FROM "User" WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
    canonicalEmail,
    user.id
  );
  if (conflicts?.length) return user;

  const updatedRows = await db.$queryRawUnsafe(
    `UPDATE "User"
        SET email = $1,
            "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, "userId", username, email, "firstName", "lastName", role, "isActive", password`,
    canonicalEmail,
    user.id
  );
  return updatedRows?.[0] || { ...user, email: canonicalEmail };
}

async function buildCanonicalMobileUserPayload(db, user) {
  const person = await findCanonicalPersonForUser(db, user);
  const syncedUser = person ? await syncCanonicalPersonIdentity(db, user, person) : user;
  const personName = person?.fullName || person?.name || '';
  const personNameParts = splitCanonicalPersonName(personName);
  const firstName = personNameParts.firstName || syncedUser.firstName || '';
  const lastName = personNameParts.lastName || syncedUser.lastName || '';
  const displayName = personName || `${firstName} ${lastName}`.trim() || syncedUser.username || syncedUser.userId;
  const canonicalEmail = String(person?.email || '').trim() || syncedUser.email || null;

  return {
    user: syncedUser,
    person,
    payload: {
      id: syncedUser.userId,
      userId: syncedUser.userId,
      displayName,
      email: canonicalEmail,
      isActive: syncedUser.isActive,
      firstName,
      lastName,
      personType: person?.type || null,
      personRecordId: person?.id || null,
      personnelId: person?.idNumber ? String(person.idNumber) : null,
      unit: person?.unit || null,
      location: person?.location || null,
      flight: person?.flight || null,
      accountEmail: syncedUser.email || null,
      profileEmail: person?.email || null,
    },
  };
}

function getBooleanEnv(value, fallback = false) {
  const clean = String(value ?? '').trim().toLowerCase();
  if (!clean) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(clean)) return true;
  if (['0', 'false', 'no', 'off'].includes(clean)) return false;
  return fallback;
}

function deriveSettingsSecretKey() {
  return crypto.createHash('sha256').update(String(JWT_SECRET || 'dfp-neo-development-jwt-secret')).digest();
}

function encryptSettingsSecret(value) {
  const clean = String(value || '');
  if (!clean) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveSettingsSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSettingsSecret(value) {
  const clean = String(value || '');
  if (!clean) return '';
  const parts = clean.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';
  try {
    const [, ivText, tagText, encryptedText] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveSettingsSecretKey(), Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    console.warn('[Email Activation] Stored SMTP password could not be decrypted.');
    return '';
  }
}

function normaliseEmailActivationMode(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'no_email') return 'no_email';
  if (clean === 'environment') return 'environment';
  return 'customer_smtp';
}

function sanitiseEmailActivationSettings(settings = {}) {
  const mode = normaliseEmailActivationMode(settings.mode);
  const port = Number(settings.smtpPort || (settings.smtpSecure ? 465 : 587));
  return {
    mode,
    smtpHost: String(settings.smtpHost || '').trim(),
    smtpPort: Number.isFinite(port) && port > 0 ? port : (settings.smtpSecure ? 465 : 587),
    smtpSecure: Boolean(settings.smtpSecure),
    smtpRequireTls: Boolean(settings.smtpRequireTls),
    smtpRejectUnauthorized: settings.smtpRejectUnauthorized !== false,
    smtpUsername: String(settings.smtpUsername || '').trim(),
    smtpFrom: String(settings.smtpFrom || '').trim(),
    appUrl: String(settings.appUrl || '').trim(),
    activationExpiryHours: Math.max(1, Math.min(168, Number(settings.activationExpiryHours || 24) || 24)),
    updatedAt: settings.updatedAt || null,
    updatedBy: settings.updatedBy || null,
    passwordConfigured: Boolean(settings.smtpPasswordEncrypted || settings.passwordConfigured),
  };
}

async function loadEmailActivationSettings(db) {
  const rows = await db.$queryRawUnsafe(
    `SELECT data, "updatedBy", "updatedAt" FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
    EMAIL_ACTIVATION_SETTINGS_ORG_ID
  );
  const row = rows?.[0];
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    updatedBy: row?.updatedBy || data.updatedBy || null,
    updatedAt: row?.updatedAt || data.updatedAt || null,
  };
}

async function saveEmailActivationSettings(db, settings, updatedBy) {
  const now = new Date().toISOString();
  await db.$executeRawUnsafe(`
    INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "updatedAt", "createdAt")
    VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::timestamp, $4::timestamp)
    ON CONFLICT ("orgId") DO UPDATE SET
      "data" = $2::jsonb,
      "updatedBy" = $3,
      "updatedAt" = $4::timestamp
  `, EMAIL_ACTIVATION_SETTINGS_ORG_ID, JSON.stringify(settings), updatedBy || null, now);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getSmtpConfig(db = null) {
  const settingsDb = db || await getPrisma();
  const settings = await loadEmailActivationSettings(settingsDb);
  const mode = normaliseEmailActivationMode(settings.mode);
  const envHost = getConfiguredSecret('DFP_SMTP_HOST', ['SMTP_HOST']);
  const envUser = getConfiguredSecret('DFP_SMTP_USER', ['SMTP_USER']);
  const envPass = getConfiguredSecret('DFP_SMTP_PASS', ['SMTP_PASS']);
  const envFrom = getConfiguredSecret('DFP_SMTP_FROM', ['SMTP_FROM', 'MAIL_FROM']);
  const hasCustomerSettings = Boolean(settings.smtpHost || settings.smtpFrom || settings.smtpUsername || settings.smtpPasswordEncrypted);
  const useEnvironment = mode === 'environment' || (mode === 'customer_smtp' && !hasCustomerSettings && Boolean(envHost || envFrom || envUser || envPass));
  const host = useEnvironment ? envHost : String(settings.smtpHost || '').trim();
  const secureEnv = useEnvironment ? (process.env.DFP_SMTP_SECURE ?? process.env.SMTP_SECURE) : settings.smtpSecure;
  const secure = useEnvironment ? getBooleanEnv(secureEnv, false) : Boolean(settings.smtpSecure);
  const rawPort = useEnvironment ? String(process.env.DFP_SMTP_PORT || process.env.SMTP_PORT || '').trim() : String(settings.smtpPort || '').trim();
  const port = Number(rawPort || (secure ? 465 : 587));
  const user = useEnvironment ? envUser : String(settings.smtpUsername || '').trim();
  const pass = useEnvironment ? envPass : decryptSettingsSecret(settings.smtpPasswordEncrypted);
  const from = useEnvironment ? envFrom : String(settings.smtpFrom || '').trim();
  const appUrl = (
    process.env.DFP_APP_URL
    || process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || settings.appUrl
    || 'https://app.dfp-neo.com'
  ).trim().replace(/\/+$/, '');
  const missing = [];
  if (mode === 'no_email') missing.push('Email mode is No Email');
  if (!host) missing.push(useEnvironment ? 'DFP_SMTP_HOST' : 'SMTP host');
  if (!Number.isFinite(port) || port <= 0) missing.push(useEnvironment ? 'DFP_SMTP_PORT' : 'SMTP port');
  if (!from) missing.push(useEnvironment ? 'DFP_SMTP_FROM' : 'From address');
  if ((user && !pass) || (!user && pass)) missing.push(useEnvironment ? 'DFP_SMTP_USER and DFP_SMTP_PASS' : 'SMTP username and password');
  return {
    configured: missing.length === 0,
    missing,
    mode,
    source: useEnvironment ? 'environment' : 'settings',
    host,
    port,
    secure,
    user,
    pass,
    from,
    appUrl,
    requireTLS: useEnvironment ? getBooleanEnv(process.env.DFP_SMTP_REQUIRE_TLS, false) : Boolean(settings.smtpRequireTls),
    rejectUnauthorized: useEnvironment ? getBooleanEnv(process.env.DFP_SMTP_REJECT_UNAUTHORIZED, true) : settings.smtpRejectUnauthorized !== false,
  };
}

function createActivationMailTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    requireTLS: Boolean(config.requireTLS),
    tls: {
      rejectUnauthorized: config.rejectUnauthorized !== false,
    },
  });
}

function formatActivationExpiry(expiresAt) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: process.env.DFP_ACTIVATION_EMAIL_TIME_ZONE || 'Australia/Melbourne',
    }).format(expiresAt);
  } catch {
    return expiresAt.toISOString();
  }
}

function buildActivationEmail({ target, suffix, expiresAt, appUrl }) {
  const displayName = [target.firstName, target.lastName].filter(Boolean).join(' ').trim()
    || target.userId
    || target.username
    || 'DFP NEO user';
  const expiryLabel = formatActivationExpiry(expiresAt);
  const signInUrl = appUrl || 'https://app.dfp-neo.com';
  const examplePersonnelId = '1234567';
  const exampleSuffix = 'M7qK9rT4zP2x';
  const exampleCredential = `${examplePersonnelId}${exampleSuffix}`;
  const text = [
    `Hello ${displayName},`,
    '',
    'Your DFP NEO account has been created.',
    '',
    `Activation code: ${suffix}`,
    '',
    'To sign in for the first time, enter your Personnel ID in the User ID field, then enter your activation credential in the password field.',
    'Your activation credential is your Personnel ID followed immediately by the activation code above.',
    `The activation code is ${suffix.length} characters. Copy it exactly and do not add spaces.`,
    '',
    `Example only: if a Personnel ID was ${examplePersonnelId} and an activation code was ${exampleSuffix}, the password field would be ${exampleCredential}.`,
    '',
    'For security, this email does not state your Personnel ID. Use the Personnel ID already issued by your organisation.',
    `This activation code expires at ${expiryLabel}.`,
    '',
    `Sign in: ${signInUrl}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#172033;max-width:640px">
      <p>Hello ${escapeHtml(displayName)},</p>
      <p>Your DFP NEO account has been created.</p>
      <p><strong>Activation code:</strong> <code style="font-size:16px">${escapeHtml(suffix)}</code></p>
      <p>To sign in for the first time, enter your Personnel ID in the User ID field, then enter your activation credential in the password field.</p>
      <p>Your activation credential is your Personnel ID followed immediately by the activation code above.</p>
      <p>The activation code is ${suffix.length} characters. Copy it exactly and do not add spaces.</p>
      <p><strong>Example only:</strong> if a Personnel ID was ${escapeHtml(examplePersonnelId)} and an activation code was ${escapeHtml(exampleSuffix)}, the password field would be <code>${escapeHtml(exampleCredential)}</code>.</p>
      <p>For security, this email does not state your Personnel ID. Use the Personnel ID already issued by your organisation.</p>
      <p>This activation code expires at ${escapeHtml(expiryLabel)}.</p>
      <p><a href="${escapeHtml(signInUrl)}">Sign in to DFP NEO</a></p>
    </div>
  `;
  return {
    subject: 'Activate your DFP NEO account',
    text,
    html,
  };
}

async function sendActivationEmail({ db, target, suffix, expiresAt }) {
  const config = await getSmtpConfig(db);
  if (!config.configured) {
    const error = new Error(`SMTP is not configured: ${config.missing.join(', ')}`);
    error.code = 'SMTP_NOT_CONFIGURED';
    error.missing = config.missing;
    throw error;
  }
  const transporter = createActivationMailTransport(config);
  const email = buildActivationEmail({ target, suffix, expiresAt, appUrl: config.appUrl });
  const info = await transporter.sendMail({
    from: config.from,
    to: target.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  return {
    method: 'email',
    email: target.email,
    messageId: info.messageId || null,
    accepted: Array.isArray(info.accepted) ? info.accepted : [],
    rejected: Array.isArray(info.rejected) ? info.rejected : [],
  };
}

async function runPrismaRuntimeMaintenance(db) {
  const startedAt = Date.now();
  console.log('🛠️ Starting Prisma runtime maintenance checks in background...');
  try {
    // Ensure AircraftAvailabilityHistory table exists (create if missing)
    await ensureAircraftAvailabilityTable(db);
    // Ensure AircraftAvailabilityEvent table exists (create if missing)
    await ensureAircraftAvailabilityEventTable(db);
    // Ensure CancellationCode table exists. Initial setup cancellation codes are opt-in.
    await ensureCancellationCodesTable(db);
    await seedCancellationCodesIfEmpty(db);
    // Ensure IndividualLMP table exists (create if missing)
    await ensureIndividualLMPTable(db);
    await ensureTraineeLmpOverlayTable(db);
    await migrateIndividualLmpOverlays(db);
    // Ensure DailySnapshot table exists (create if missing)
    await ensureDailySnapshotTable(db);
    // Ensure instructor fields are TEXT[] arrays (migrate from String if needed)
    try {
      await ensureInstructorArrayColumns(db);
    } catch (migrationErr) {
      console.error('Instructor column migration failed (non-fatal):', migrationErr.message);
    }
    // Ensure Training Intelligence Engine tables exist and defaults are seeded
    try {
      await ensureTIETables(db);
      await seedTIEDefaults(db);
    } catch (tieErr) {
      console.error('TIE startup failed (non-fatal):', tieErr.message);
    }
    // Ensure TraineePerformance table exists (single source of truth for training report assessments)
    await ensureTraineePerformanceTable(db);
    await migrateLegacyPerformanceIntoTraineePerformance(db);
    // Ensure AppSettings table exists (stores all org-level settings including currencies)
    await ensureAppSettingsTable(db);
    // Ensure commercial platform configuration tables exist without restoring deleted customer setup.
    await ensureCommercialConfigTables(db);
    await migrateLegacyQfiPersonnelRoles(db);
    await migrateLegacyContractorPersonnelRoles(db);
    // Ensure CourseSettings and CourseAcademicProgress tables exist
    await ensureCourseSettingsTables(db);
    // Ensure Course.lmpType column exists (migration for existing DBs)
    await ensureCourseLmpTypeColumn(db);
    await ensureAcademicLmpTypeColumns(db);
    await ensureCourseLeadershipColumns(db);
    // Ensure SyllabusItem and SyllabusHistory tables exist
    await ensureSyllabusTablesExist(db);
    // Migrate CPT event durations to 1.0 hour
    await migrateCptDurations(db);
    // Ensure scheduling duration follows the visible syllabus timing fields.
    await migrateSyllabusDurationsFromVisibleHours(db);
    // Ensure Integrated Combat Operations training package timing is authoritative.
    await migrateIntegratedCombatOperationsTiming(db);
    // Fix Academics items: ensure courses[] contains the module name (not the item's own code)
    await migrateAcademicsCoursesField(db);
    // Turn on report prompts for Flight School BPC+IPC and FIC syllabus events once.
    await migrateFlightSchoolAssessmentRequiredDefaults(db);
    console.log(`✅ Prisma runtime maintenance checks complete in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error('❌ Prisma runtime maintenance failed:', error);
  }
}

function schedulePrismaRuntimeMaintenance(db) {
  if (prismaMaintenanceStarted) return prismaMaintenancePromise;
  prismaMaintenanceStarted = true;
  const delayMs = Math.max(0, Number(process.env.DFP_NEO_DB_MAINTENANCE_DELAY_MS ?? 30000) || 0);
  prismaMaintenancePromise = new Promise((resolve) => {
    setTimeout(() => {
      runPrismaRuntimeMaintenance(db).finally(resolve);
    }, delayMs);
  });
  console.log(`🛠️ Prisma runtime maintenance scheduled in ${delayMs}ms`);
  return prismaMaintenancePromise;
}

async function migrateLegacyQfiPersonnelRoles(db) {
  const personnel = await db.personnel.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      isQFI: true,
      preferences: true,
    },
  });

  let updatedCount = 0;
  for (const person of personnel) {
    const roleCode = String(person.role || '').trim().toUpperCase().replace(/[\s-]+/g, ' ');
    const hasLegacyInstructorRole = roleCode === 'QFI' || roleCode === 'INSTRUCTOR';
    const nextPreferences = (hasLegacyInstructorRole || person.isQFI)
      ? addStaffQualificationToPreferences(person.preferences, 'qfi')
      : person.preferences;
    const existingQualifications = Array.isArray(person.preferences?.qualifications) ? person.preferences.qualifications : [];
    const hasQfiQualification = existingQualifications.some((value) => String(value || '').trim().toLowerCase() === 'qfi');

    const data = {};
    if (hasLegacyInstructorRole) {
      data.role = 'Pilot';
      data.isQFI = true;
    } else if (person.isQFI && !hasQfiQualification) {
      data.isQFI = true;
    }
    if ((hasLegacyInstructorRole || person.isQFI) && !hasQfiQualification) {
      data.preferences = nextPreferences;
    }

    if (Object.keys(data).length === 0) continue;
    await db.personnel.update({ where: { id: person.id }, data });
    updatedCount++;
  }

  console.log(`✅ migrateLegacyQfiPersonnelRoles: updated ${updatedCount} personnel record(s)`);
}

async function migrateLegacyContractorPersonnelRoles(db) {
  const personnel = await db.personnel.findMany({
    select: {
      id: true,
      role: true,
      isContractor: true,
      preferences: true,
    },
  });

  let updatedCount = 0;
  for (const person of personnel) {
    const roleCode = String(person.role || '').trim().toUpperCase().replace(/[\s-]+/g, ' ');
    const hasLegacyContractorRole = roleCode === 'SIM IP' || roleCode === 'CONTRACTOR STAFF';
    const existingQualifications = Array.isArray(person.preferences?.qualifications) ? person.preferences.qualifications : [];
    const hasContractorQualification = existingQualifications.some((value) => String(value || '').trim().toLowerCase() === 'contractor');
    const data = {};

    if (hasLegacyContractorRole) {
      data.role = 'Pilot';
      data.isContractor = true;
    } else if (person.isContractor && !hasContractorQualification) {
      data.isContractor = true;
    }
    if ((hasLegacyContractorRole || person.isContractor) && !hasContractorQualification) {
      data.preferences = addStaffQualificationToPreferences(person.preferences, 'contractor');
    }

    if (Object.keys(data).length === 0) continue;
    await db.personnel.update({ where: { id: person.id }, data });
    updatedCount++;
  }

  console.log(`✅ migrateLegacyContractorPersonnelRoles: updated ${updatedCount} personnel record(s)`);
}

function isUsablePersonnelIdNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

async function findPersonnelIdNumberConflict(db, idNumber, options = {}) {
  const number = Number(idNumber);
  if (!isUsablePersonnelIdNumber(number)) return null;
  const personnelWhere = { idNumber: number };
  if (options.excludePersonnelId) {
    personnelWhere.id = { not: options.excludePersonnelId };
  }
  const traineeWhere = { idNumber: number };
  if (options.excludeTraineeId) {
    traineeWhere.id = { not: options.excludeTraineeId };
  }
  const [personnel, trainee] = await Promise.all([
    db.personnel.findFirst({
      where: personnelWhere,
      select: { id: true, idNumber: true, name: true, rank: true, role: true, unit: true, isActive: true },
    }),
    db.trainee.findFirst({
      where: traineeWhere,
      select: { id: true, idNumber: true, name: true, fullName: true, rank: true, course: true, unit: true, isActive: true },
    }),
  ]);
  if (personnel) {
    return { type: 'staff', record: personnel };
  }
  if (trainee) {
    return { type: 'trainee', record: trainee };
  }
  return null;
}

function sendPersonnelIdConflict(res, conflict) {
  const record = conflict?.record || {};
  const label = conflict?.type === 'trainee' ? 'trainee' : 'staff/personnel';
  return res.status(409).json({
    error: `Personnel ID is already assigned to an existing ${label} record`,
    conflict: {
      type: conflict?.type || 'unknown',
      id: record.id || null,
      idNumber: record.idNumber || null,
      name: record.fullName || record.name || null,
      rank: record.rank || null,
      role: record.role || null,
      course: record.course || null,
      unit: record.unit || null,
      isActive: record.isActive ?? null,
    },
  });
}

async function syncLinkedPersonLoginEmail(db, personRecord, nextEmail) {
  const linkedUserId = String(personRecord?.userId || '').trim();
  if (!linkedUserId) return null;
  const cleanEmail = String(nextEmail || '').trim();
  if (cleanEmail) {
    const emailConflicts = await db.$queryRawUnsafe(
      `SELECT id, "userId", username, email
       FROM "User"
       WHERE LOWER(email) = LOWER($1)
         AND id <> $2
       LIMIT 1`,
      cleanEmail,
      linkedUserId
    );
    if (emailConflicts?.length) {
      const error = new Error(`Email ${cleanEmail} is already used by login account ${emailConflicts[0].userId || emailConflicts[0].username}. Use a unique email address before saving account access.`);
      error.status = 409;
      error.code = 'EMAIL_ACCOUNT_CONFLICT';
      throw error;
    }
  }
  const updatedUsers = await db.$queryRawUnsafe(
    `UPDATE "User"
     SET email = $1,
         "updatedAt" = NOW()
     WHERE id = $2
     RETURNING id, "userId", username, email`,
    cleanEmail || null,
    linkedUserId
  );
  return updatedUsers?.[0] || null;
}

function logApiTiming(label, startedAt, details = {}) {
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > 1000) {
    console.warn(`⏱️ ${label} completed in ${elapsedMs}ms`, details);
    return;
  }
  if (process.env.DFP_VERBOSE_API_TIMING === 'true') {
    console.log(`⏱️ ${label} completed in ${elapsedMs}ms`, details);
  }
}

async function getPrisma() {
  if (!prisma) {
    const startedAt = Date.now();
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log(`✅ Prisma connected to database in ${Date.now() - startedAt}ms`);
    await ensureUserActivationColumns(prisma);
    if (process.env.DFP_NEO_BLOCKING_DB_MAINTENANCE === 'true') {
      prismaMaintenanceStarted = true;
      prismaMaintenancePromise = runPrismaRuntimeMaintenance(prisma);
      await prismaMaintenancePromise;
    } else {
      schedulePrismaRuntimeMaintenance(prisma);
    }
  }
  return prisma;
}

function schedulePrismaPrewarm() {
  if (process.env.DFP_NEO_PREWARM_DB === 'false') return;
  const delayMs = Math.max(0, Number(process.env.DFP_NEO_PREWARM_DB_DELAY_MS ?? 1000) || 0);
  setTimeout(() => {
    getPrisma()
      .then(() => console.log('✅ Prisma connection prewarmed'))
      .catch((error) => console.error('❌ Prisma prewarm failed:', error));
  }, delayMs);
  console.log(`🔥 Prisma connection prewarm scheduled in ${delayMs}ms`);
}

function normalisePersonnelPayloadForUnit(body = {}) {
  const roleCode = String(body.role || '').trim().toUpperCase().replace(/[\s-]+/g, ' ');
  if (roleCode === 'QFI' || roleCode === 'INSTRUCTOR') {
    return {
      ...body,
      role: 'Pilot',
      isQFI: body.isQFI ?? true,
      preferences: addStaffQualificationToPreferences(body.preferences, 'qfi'),
    };
  }
  if (roleCode === 'SIM IP' || roleCode === 'CONTRACTOR STAFF') {
    return {
      ...body,
      role: 'Pilot',
      isQFI: false,
      isContractor: true,
      preferences: addStaffQualificationToPreferences(body.preferences, 'contractor'),
    };
  }
  if (
    roleCode === 'AEA'
    || roleCode === 'ACOUSTIC ELECTRONICS ANALYST'
    || roleCode === 'AIRBORNE ELECTRONICS ANALYST'
  ) {
    return {
      ...body,
      role: 'AWO',
    };
  }
  return body;
}

function addStaffQualificationToPreferences(preferences = {}, qualificationId = '') {
  const source = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  const existing = Array.isArray(source.qualifications) ? source.qualifications : [];
  const qualificationKey = String(qualificationId || '').trim();
  if (!qualificationKey) return source;
  const hasQualification = existing.some((value) => String(value || '').trim().toLowerCase() === qualificationKey.toLowerCase());
  return {
    ...source,
    qualifications: hasQualification ? existing : [...existing, qualificationKey],
  };
}

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
  return raw.toUpperCase();
}

function normaliseHistoricalSeedCourseConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .map(([courseCode, config]) => {
        if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
        const code = String(courseCode || '').trim();
        const startDate = String(config.startDate || '').trim();
        const lmpType = String(config.lmpType || '').trim();
        if (!code || !startDate || !lmpType) return null;
        const nextConfig = { startDate, lmpType };
        if (Array.isArray(config.progressRange) && config.progressRange.length >= 2) {
          nextConfig.progressRange = [
            String(config.progressRange[0] || '').trim(),
            String(config.progressRange[1] || '').trim(),
          ].filter(Boolean);
        }
        if (String(config.centreEvent || '').trim()) {
          nextConfig.centreEvent = String(config.centreEvent || '').trim();
        }
        if (Number.isFinite(Number(config.defaultGroundHours))) {
          nextConfig.defaultGroundHours = Number(config.defaultGroundHours);
        }
        if (Number.isFinite(Number(config.defaultProceduralTrainerHours))) {
          nextConfig.defaultProceduralTrainerHours = Number(config.defaultProceduralTrainerHours);
        }
        if (Number.isFinite(Number(config.defaultSimulatorHours))) {
          nextConfig.defaultSimulatorHours = Number(config.defaultSimulatorHours);
        }
        if (Number.isFinite(Number(config.defaultFlightHours))) {
          nextConfig.defaultFlightHours = Number(config.defaultFlightHours);
        }
        return [code, nextConfig];
      })
      .filter(Boolean)
  );
}

function normaliseHistoricalSeedSyllabusSequences(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .map(([lmpType, events]) => {
        const code = String(lmpType || '').trim();
        if (!code || !Array.isArray(events)) return null;
        const sequence = events.map((eventCode) => String(eventCode || '').trim()).filter(Boolean);
        return sequence.length > 0 ? [code, sequence] : null;
      })
      .filter(Boolean)
  );
}

async function getConfiguredLocationScopeAliases(db, values) {
  const requested = uniqueStrings(values);
  if (requested.length === 0) return [];
  const requestedKeys = new Set(requested.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  const expanded = [...requested, ...requested.map(normaliseLocationCode)];
  try {
    const locations = await db.$queryRawUnsafe(`
      SELECT "code", "iataCode", "name", "settings"
      FROM "CommercialLocation"
      WHERE COALESCE("status", 'ACTIVE') <> 'INACTIVE'
    `);
    for (const location of locations || []) {
      const settings = location?.settings && typeof location.settings === 'object' ? location.settings : {};
      const aliases = uniqueStrings([
        location.code,
        location.iataCode,
        location.name,
        settings.icaoCode,
        settings.iataCode,
        ...(Array.isArray(settings.aliases) ? settings.aliases : []),
      ]);
      if (aliases.some((alias) => requestedKeys.has(String(alias || '').trim().toLowerCase()))) {
        expanded.push(...aliases, ...aliases.map(normaliseLocationCode));
      }
    }
  } catch (error) {
    console.warn('[DataScope] Could not resolve configured location aliases:', error.message);
  }
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
  const expandedLocationValues = await getConfiguredLocationScopeAliases(db, locationValues);
  const unitsAtLocation = await getUnitCodesForLocationScope(db, expandedLocationValues);

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
        "assessedElements"     TEXT[] NOT NULL DEFAULT '{}',
        "assessmentRequired"   BOOLEAN NOT NULL DEFAULT false,
        "testEventType"        TEXT NOT NULL DEFAULT 'NONE',
        "testingOfficerQualificationId" TEXT,
        "useTestingOfficerSecondaryCallsign" BOOLEAN NOT NULL DEFAULT false,
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
        "unit"                 TEXT,
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
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "assessedElements" TEXT[] NOT NULL DEFAULT '{}'`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ALTER COLUMN "assessedElements" SET DEFAULT '{}'`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "assessmentRequired" BOOLEAN NOT NULL DEFAULT false`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "testEventType" TEXT NOT NULL DEFAULT 'NONE'`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "testingOfficerQualificationId" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "useTestingOfficerSecondaryCallsign" BOOLEAN NOT NULL DEFAULT false`);
    await db.$executeRawUnsafe(`ALTER TABLE "SyllabusItem" ADD COLUMN IF NOT EXISTS "unit" TEXT`);
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

// Migration: scheduled duration follows Flight/Sim Hrs when present, otherwise Total Event Hrs.
async function migrateSyllabusDurationsFromVisibleHours(db) {
  try {
    const result = await db.$executeRawUnsafe(`
      UPDATE "SyllabusItem"
      SET
        "duration" = CASE
          WHEN "flightOrSimHours" > 0 THEN "flightOrSimHours"
          WHEN "totalEventHours" > 0 THEN "totalEventHours"
          ELSE "duration"
        END,
        "version" = "version" + 1,
        "updatedAt" = NOW()
      WHERE "duration" IS DISTINCT FROM CASE
        WHEN "flightOrSimHours" > 0 THEN "flightOrSimHours"
        WHEN "totalEventHours" > 0 THEN "totalEventHours"
        ELSE "duration"
      END
    `);
    console.log(`✅ migrateSyllabusDurationsFromVisibleHours: updated ${result} syllabus items`);
  } catch (err) {
    console.error('❌ migrateSyllabusDurationsFromVisibleHours failed (non-fatal):', err.message);
  }
}

// Migration: Integrated Combat Operations package schedule duration follows flight/sim hours.
async function migrateIntegratedCombatOperationsTiming(db) {
  try {
    const result = await db.$executeRawUnsafe(`
      UPDATE "SyllabusItem"
      SET
        "flightOrSimHours" = CASE
          WHEN "flightOrSimHours" > 0 THEN "flightOrSimHours"
          ELSE $1
        END,
        "duration" = CASE
          WHEN "flightOrSimHours" > 0 THEN "flightOrSimHours"
          ELSE $1
        END,
        "preFlightTime" = $2,
        "postFlightTime" = $3,
        "version" = "version" + 1,
        "updatedAt" = NOW()
      WHERE "lmpType" = 'Staff CAT'
        AND $4 = ANY("courses")
        AND (
          "flightOrSimHours" <= 0
          OR "duration" IS DISTINCT FROM CASE WHEN "flightOrSimHours" > 0 THEN "flightOrSimHours" ELSE $1 END
          OR "preFlightTime" IS DISTINCT FROM $2
          OR "postFlightTime" IS DISTINCT FROM $3
        )
    `,
      INTEGRATED_COMBAT_OPERATIONS_DEFAULT_FLIGHT_OR_SIM_HOURS,
      INTEGRATED_COMBAT_OPERATIONS_PREFLIGHT_HOURS,
      INTEGRATED_COMBAT_OPERATIONS_POSTFLIGHT_HOURS,
      INTEGRATED_COMBAT_OPERATIONS_PACKAGE_CODE);
    console.log(`✅ migrateIntegratedCombatOperationsTiming: updated ${result} ICO package items`);
  } catch (err) {
    console.error('❌ migrateIntegratedCombatOperationsTiming failed (non-fatal):', err.message);
  }
}

// Fix Academics syllabus items that have courses[] pointing to their own code
// instead of the parent course name.
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

async function migrateFlightSchoolAssessmentRequiredDefaults(db) {
  const markerKey = 'flightSchoolBpcIpcFicAssessmentRequiredEnabledAtV2';
  try {
    const settingsRows = await db.$queryRawUnsafe(`SELECT data FROM "AppSettings" WHERE "orgId" = 'default' LIMIT 1`);
    const existingSettings = settingsRows?.[0]?.data && typeof settingsRows[0].data === 'object'
      ? settingsRows[0].data
      : {};
    const migrationSettings = existingSettings?.maintenanceMigrations && typeof existingSettings.maintenanceMigrations === 'object'
      ? existingSettings.maintenanceMigrations
      : {};
    if (migrationSettings[markerKey]) {
      console.log('✅ migrateFlightSchoolAssessmentRequiredDefaults: already applied');
      return;
    }

    const result = await db.$executeRawUnsafe(`
      UPDATE "SyllabusItem"
      SET
        "assessmentRequired" = true,
        "version" = "version" + 1,
        "updatedAt" = NOW()
      WHERE "isActive" = true
        AND "assessmentRequired" IS DISTINCT FROM true
        AND (
          $1 = ANY("courses")
          OR $2 = ANY("courses")
          OR UPPER(TRIM(COALESCE("lmpType", ''))) IN ($1, $2)
          OR UPPER(TRIM(COALESCE("module", ''))) IN ($1, $2)
          OR EXISTS (
            SELECT 1
            FROM unnest("courses") AS course
            WHERE UPPER(TRIM(course)) IN ($1, $2)
          )
        )
    `, 'BPC+IPC', 'FIC');

    const nextSettings = {
      ...existingSettings,
      maintenanceMigrations: {
        ...migrationSettings,
        [markerKey]: new Date().toISOString(),
      },
    };
    await db.$executeRawUnsafe(`
      INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, 'default', $1::jsonb, 'system', NOW(), NOW())
      ON CONFLICT ("orgId") DO UPDATE SET
        "data" = $1::jsonb,
        "updatedBy" = 'system',
        "updatedAt" = NOW()
    `, JSON.stringify(nextSettings));

    console.log(`✅ migrateFlightSchoolAssessmentRequiredDefaults: enabled assessmentRequired on ${result} BPC+IPC/FIC syllabus item(s)`);
  } catch (err) {
    console.error('❌ migrateFlightSchoolAssessmentRequiredDefaults failed (non-fatal):', err.message);
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const { orgId = 'default', settings, updatedBy } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Missing settings data' });
    }
    const existingRows = await db.$queryRawUnsafe(
      `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );
    const existingFreezeState = existingRows?.[0]?.data?.emergencyFreezeState || null;
    const settingsJson = JSON.stringify({
      ...settings,
      ...(existingFreezeState && !settings.emergencyFreezeState ? { emergencyFreezeState: existingFreezeState } : {}),
    });
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

// GET /api/emergency-freeze - Load shared emergency freeze state across browsers
app.get('/api/emergency-freeze', async (req, res) => {
  try {
    const db = await getPrisma();
    const orgId = req.query.orgId || 'default';
    const rows = await db.$queryRawUnsafe(
      `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );
    const freezeState = rows?.[0]?.data?.emergencyFreezeState || null;
    res.json({ freezeState });
  } catch (error) {
    console.error('[EmergencyFreeze] GET error:', error);
    res.status(500).json({ error: 'Failed to load emergency freeze state', details: error.message });
  }
});

// PUT /api/emergency-freeze - Save only shared emergency freeze state
app.put('/api/emergency-freeze', async (req, res) => {
  try {
    const db = await getPrisma();
    const { orgId = 'default', freezeState } = req.body || {};
    if (!freezeState || typeof freezeState.isFrozen !== 'boolean') {
      return res.status(400).json({ error: 'Missing emergency freeze state' });
    }
    const existingRows = await db.$queryRawUnsafe(
      `SELECT data FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );
    const existingSettings = existingRows?.[0]?.data && typeof existingRows[0].data === 'object'
      ? existingRows[0].data
      : {};
    const nextSettings = {
      ...existingSettings,
      emergencyFreezeState: freezeState,
    };
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(`
      INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "updatedAt", "createdAt")
      VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::timestamp, $4::timestamp)
      ON CONFLICT ("orgId") DO UPDATE SET
        "data" = $2::jsonb,
        "updatedBy" = $3,
        "updatedAt" = $4::timestamp
    `, orgId, JSON.stringify(nextSettings), req.body?.updatedBy || null, now);
    res.json({ success: true, freezeState });
  } catch (error) {
    console.error('[EmergencyFreeze] PUT error:', error);
    res.status(500).json({ error: 'Failed to save emergency freeze state', details: error.message });
  }
});

// ============================================================
// DASHBOARD MESSAGES
// Shared lightweight message store. Uses DataBackup JSON so the
// feature can deliver across accounts without a schema migration.
// ============================================================

const DASHBOARD_MESSAGES_BACKUP_TYPE = 'dashboard_messages_v1';

function normaliseDashboardMessageName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normaliseDashboardStoredMessages(data) {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : [];
  return source
    .filter(message => message && message.from && message.to && message.body)
    .map(message => ({
      id: String(message.id || `dashboard-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      from: String(message.from || ''),
      to: String(message.to || ''),
      body: String(message.body || ''),
      sentAt: message.sentAt || new Date().toISOString(),
      readAt: message.readAt || undefined,
    }));
}

async function getDashboardMessages(db) {
  const backup = await db.dataBackup.findFirst({
    where: { type: DASHBOARD_MESSAGES_BACKUP_TYPE },
    orderBy: { createdAt: 'desc' },
  });
  return normaliseDashboardStoredMessages(backup?.data);
}

async function saveDashboardMessages(db, messages) {
  await db.dataBackup.deleteMany({ where: { type: DASHBOARD_MESSAGES_BACKUP_TYPE } });
  await db.dataBackup.create({
    data: {
      type: DASHBOARD_MESSAGES_BACKUP_TYPE,
      data: { messages },
    },
  });
}

app.get('/api/dashboard-messages', async (req, res) => {
  try {
    const db = await getPrisma();
    const userName = normaliseDashboardMessageName(req.query.userName);
    const messages = await getDashboardMessages(db);
    const scopedMessages = userName
      ? messages.filter(message => (
          normaliseDashboardMessageName(message.from) === userName ||
          normaliseDashboardMessageName(message.to) === userName
        ))
      : messages;
    res.json({ messages: scopedMessages });
  } catch (error) {
    console.error('[Dashboard Messages] GET error:', error);
    res.status(500).json({ error: 'Failed to load dashboard messages', details: error.message });
  }
});

app.post('/api/dashboard-messages', async (req, res) => {
  try {
    const db = await getPrisma();
    const messageInput = req.body?.message || req.body || {};
    const from = String(messageInput.from || '').trim();
    const to = String(messageInput.to || '').trim();
    const body = String(messageInput.body || '').trim();
    if (!from || !to || !body) {
      return res.status(400).json({ error: 'Message requires from, to and body.' });
    }
    const messages = await getDashboardMessages(db);
    const message = {
      id: String(messageInput.id || `dashboard-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      from,
      to,
      body,
      sentAt: messageInput.sentAt || new Date().toISOString(),
      readAt: messageInput.readAt || undefined,
    };
    const deduped = messages.filter(existing => existing.id !== message.id);
    const nextMessages = [...deduped, message].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    await saveDashboardMessages(db, nextMessages);
    res.json({ success: true, message });
  } catch (error) {
    console.error('[Dashboard Messages] POST error:', error);
    res.status(500).json({ error: 'Failed to send dashboard message', details: error.message });
  }
});

app.patch('/api/dashboard-messages/read', async (req, res) => {
  try {
    const db = await getPrisma();
    const reader = normaliseDashboardMessageName(req.body?.reader);
    const sender = normaliseDashboardMessageName(req.body?.sender);
    const messageIds = new Set(Array.isArray(req.body?.messageIds) ? req.body.messageIds.map(id => String(id)) : []);
    if (!reader) {
      return res.status(400).json({ error: 'Reader is required.' });
    }
    const now = new Date().toISOString();
    let updated = 0;
    const messages = await getDashboardMessages(db);
    const nextMessages = messages.map(message => {
      const matchesReader = normaliseDashboardMessageName(message.to) === reader;
      const matchesSender = !sender || normaliseDashboardMessageName(message.from) === sender;
      const matchesId = messageIds.size === 0 || messageIds.has(message.id);
      if (matchesReader && matchesSender && matchesId && !message.readAt) {
        updated++;
        return { ...message, readAt: now };
      }
      return message;
    });
    if (updated > 0) {
      await saveDashboardMessages(db, nextMessages);
    }
    res.json({ success: true, updated, readAt: now });
  } catch (error) {
    console.error('[Dashboard Messages] PATCH read error:', error);
    res.status(500).json({ error: 'Failed to update dashboard messages', details: error.message });
  }
});

app.delete('/api/dashboard-messages/conversation', async (req, res) => {
  try {
    const db = await getPrisma();
    const participant = normaliseDashboardMessageName(req.body?.participant);
    const contact = normaliseDashboardMessageName(req.body?.contact);
    if (!participant || !contact) {
      return res.status(400).json({ error: 'Participant and contact are required.' });
    }
    const messages = await getDashboardMessages(db);
    const nextMessages = messages.filter(message => {
      const from = normaliseDashboardMessageName(message.from);
      const to = normaliseDashboardMessageName(message.to);
      return !(
        (from === participant && to === contact) ||
        (from === contact && to === participant)
      );
    });
    const deleted = messages.length - nextMessages.length;
    if (deleted > 0) {
      await saveDashboardMessages(db, nextMessages);
    }
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('[Dashboard Messages] DELETE conversation error:', error);
    res.status(500).json({ error: 'Failed to delete dashboard conversation', details: error.message });
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

const normaliseCommercialUnitTypes = (values, units = []) => {
  const seen = new Set();
  const sourceValues = Array.isArray(values) ? values : [];
  const usedValues = Array.isArray(units) ? units.map((unit) => unit?.unitType) : [];
  return [...sourceValues, ...usedValues]
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      organisationCode: String(row.organisationCode || '').trim(),
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
      organisationCode: String(row.organisationCode || '').trim(),
      locationCode: row.locationCode || '',
      code: row.code || '',
      name: row.name || '',
      unitType: row.unitType || '',
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
      settings: buildCommercialAircraftTypeSettings(row),
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
      organisationCode: String(row.organisationCode || '').trim(),
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
  'dfp.flightAuthorisation.use': 'Authorise flights',
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
  'trainee.profile.own': 'If trainee, view own profile',
  'trainee.profile.others': "View other trainees' profiles",
  'trainee.pt051.own': 'If trainee, view own training reports',
  'trainee.pt051.others': "View other trainees' training reports",
  'trainee.pt051.edit': 'Edit training reports',
  'trainee.lmp.own': 'If trainee, view own Individual LMP',
  'trainee.lmp.others': "View other trainees' Individual LMPs",
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
    'settings.defaultTasKtas': 'Default TAS (KTAS)',
  },
  CommercialResourcePool: {
    organisationCode: 'Organisation',
    locationCode: 'Location',
    unitCode: 'Unit',
    aircraftTypeCode: 'Aircraft type',
    code: 'DFP Resource Rows code',
    name: 'DFP Resource Rows name',
    poolType: 'DFP Resource Rows sharing type',
    status: 'DFP Resource Rows status',
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
    'settings.applyToV2Runtime': 'DFP Resource Rows',
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
    'settings.permissionAllowIds': 'Added permission exceptions',
    'settings.permissionDenyIds': 'Removed permission exceptions',
  },
};

const PLATFORM_ENTITY_LABELS = {
  CommercialOrganisation: 'organisation',
  CommercialLocation: 'location',
  CommercialUnit: 'unit',
  CommercialAircraftType: 'aircraft type',
  CommercialResourcePool: 'DFP Resource Rows',
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
  if (field === 'settings.permissionAllowIds' || field === 'settings.permissionDenyIds') return formatPermissionList(value);
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

function createRateLimiter({ windowMs, maxRequests, keyPrefix, message }) {
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip = String(getRequestIp(req)).split(',')[0].trim() || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const current = attempts.get(key);
    const resetAt = current && current.resetAt > now ? current.resetAt : now + windowMs;
    const count = current && current.resetAt > now ? current.count + 1 : 1;
    attempts.set(key, { count, resetAt });

    if (attempts.size > 5000) {
      for (const [entryKey, entry] of attempts.entries()) {
        if (entry.resetAt <= now) attempts.delete(entryKey);
      }
    }

    const remaining = Math.max(maxRequests - count, 0);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      console.warn('⚠️ Rate limit blocked request', {
        path: req.path,
        method: req.method,
        ip,
        resetAt: new Date(resetAt).toISOString(),
      });
      recordSecurityAuditEvent(
        req,
        'RATE_LIMIT_BLOCKED',
        'warning',
        `Rate limit blocked ${req.method} ${req.path}`,
        {
          keyPrefix,
          retryAfterSeconds,
          windowMs,
          maxRequests,
        }
      );
      return res.status(429).json({
        error: 'Too many requests',
        message,
        retryAfterSeconds,
      });
    }

    next();
  };
}

const authRateLimit = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many sign-in or password attempts. Wait a few minutes, then try again.',
});

const adminSensitiveRateLimit = createRateLimiter({
  keyPrefix: 'admin-sensitive',
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: 'Too many sensitive administration actions. Wait a few minutes, then try again.',
});

const uploadRateLimit = createRateLimiter({
  keyPrefix: 'upload',
  windowMs: 15 * 60 * 1000,
  maxRequests: 12,
  message: 'Too many workbook uploads. Wait a few minutes, then try again.',
});

function handleSingleSpreadsheetUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError ? 400 : 415;
    recordSecurityAuditEvent(
      req,
      'UPLOAD_REJECTED',
      status === 415 ? 'warning' : 'info',
      'Workbook upload was rejected before processing',
      {
        reason: error.message || 'The uploaded file could not be accepted.',
        multerCode: error instanceof multer.MulterError ? error.code : '',
      }
    );
    return res.status(status).json({
      error: 'Upload rejected',
      message: error.message || 'The uploaded file could not be accepted.',
    });
  });
}

function hasZipWorkbookSignature(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b;
}

function hasLegacyExcelSignature(buffer) {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return Buffer.isBuffer(buffer)
    && buffer.length >= signature.length
    && signature.every((byte, index) => buffer[index] === byte);
}

function validateSpreadsheetUploadFile(file) {
  if (!file?.buffer?.length) return 'No upload file supplied.';
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(extension)) {
    if (extension === '.xlsm') return 'Macro-enabled Excel files are not accepted for syllabus uploads. Save the workbook as .xlsx and upload again.';
    return 'Only Excel workbook files can be uploaded.';
  }
  if (extension === '.xls' && !hasLegacyExcelSignature(file.buffer) && !hasZipWorkbookSignature(file.buffer)) {
    return 'The uploaded XLS file does not look like a valid Excel workbook.';
  }
  if (extension === '.xlsx' && !hasZipWorkbookSignature(file.buffer)) {
    return 'The uploaded workbook does not look like a valid XLSX file.';
  }
  return '';
}

function validateSpreadsheetThreatIndicators(file) {
  if (!file?.buffer?.length) return 'No upload file supplied.';
  const extension = path.extname(file.originalname || '').toLowerCase();
  const searchable = file.buffer.toString('latin1').toLowerCase();
  const blockedIndicators = [
    { token: 'vbaproject.bin', reason: 'The workbook contains macro content.' },
    { token: 'xl/embeddings/', reason: 'The workbook contains embedded objects.' },
    { token: 'xl/activexcontrols/', reason: 'The workbook contains ActiveX controls.' },
    { token: 'xl/externalLinks/'.toLowerCase(), reason: 'The workbook contains external workbook links.' },
    { token: 'application/vnd.ms-office.activeX'.toLowerCase(), reason: 'The workbook contains ActiveX content.' },
  ];

  for (const indicator of blockedIndicators) {
    if (searchable.includes(indicator.token)) return indicator.reason;
  }

  if (extension === '.xls') {
    const legacyMacroIndicators = ['_vba_project', 'vba', 'macrosheet'];
    if (legacyMacroIndicators.some(indicator => searchable.includes(indicator))) {
      return 'The legacy XLS workbook appears to contain macro content.';
    }
  }

  return '';
}

function validateWorkbookShape(workbook) {
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (sheetNames.length === 0) return 'The upload file does not contain any worksheets.';
  if (sheetNames.length > 25) return 'The workbook has too many worksheets for a syllabus upload.';

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets?.[sheetName];
    const ref = worksheet?.['!ref'];
    if (!ref) continue;
    let range;
    try {
      range = XLSX.utils.decode_range(ref);
    } catch {
      return `Worksheet ${sheetName} has an invalid cell range.`;
    }
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    if (rowCount > 5000) return `Worksheet ${sheetName} has too many rows for a syllabus upload.`;
    if (columnCount > 120) return `Worksheet ${sheetName} has too many columns for a syllabus upload.`;
    if (rowCount * columnCount > 200000) return `Worksheet ${sheetName} is too large for a syllabus upload.`;
  }
  return '';
}

const normaliseAircraftTypeTasKtas = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const getAircraftTypeTasKtas = (aircraftType = {}) => (
  normaliseAircraftTypeTasKtas(aircraftType.defaultTasKtas ?? aircraftType.settings?.defaultTasKtas)
);

const normaliseAircraftTypeCruiseAltitudeFl = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^\d]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const getAircraftTypeCruiseAltitudeFl = (aircraftType = {}) => (
  normaliseAircraftTypeCruiseAltitudeFl(
    aircraftType.defaultCruiseAltitudeFl ??
    aircraftType.defaultCruiseAltitude ??
    aircraftType.settings?.defaultCruiseAltitudeFl ??
    aircraftType.settings?.defaultCruiseAltitude
  )
);

const buildCommercialAircraftTypeSettings = (aircraftType = {}) => {
  const settings = { ...(aircraftType.settings || {}) };
  if (aircraftType.crewComposition) settings.crewComposition = aircraftType.crewComposition;
  const defaultTasKtas = getAircraftTypeTasKtas(aircraftType);
  if (defaultTasKtas === null) {
    delete settings.defaultTasKtas;
  } else {
    settings.defaultTasKtas = defaultTasKtas;
  }
  const defaultCruiseAltitudeFl = getAircraftTypeCruiseAltitudeFl(aircraftType);
  if (defaultCruiseAltitudeFl === null) {
    delete settings.defaultCruiseAltitudeFl;
    delete settings.defaultCruiseAltitude;
  } else {
    settings.defaultCruiseAltitudeFl = defaultCruiseAltitudeFl;
  }
  return settings;
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

function sanitiseSecurityEventDetails(details = {}) {
  const safeDetails = { ...(details || {}) };
  for (const key of Object.keys(safeDetails)) {
    if (/password|token|secret|key/i.test(key)) {
      safeDetails[key] = '[redacted]';
    }
  }
  return safeDetails;
}

async function sendSecurityEventWebhook(event) {
  if (!SECURITY_EVENT_WEBHOOK_URL || typeof fetch !== 'function') return;
  try {
    await fetch(SECURITY_EVENT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.warn('⚠️ Security event webhook failed:', error.message);
  }
}

async function writeSecurityAuditEvent(db, req, eventType, severity, summary, details = {}) {
  try {
    const actor = await resolveAuditUser(db, req);
    if (!actor?.id) {
      console.warn('⚠️ Security audit skipped: no active user could be resolved.', { eventType, severity, summary });
      return { written: false, warning: 'No active user could be resolved for security audit logging' };
    }

    const event = {
      source: 'Security Monitoring',
      eventType,
      severity,
      summary,
      details: sanitiseSecurityEventDetails(details),
      path: req.originalUrl || req.url || req.path || '',
      method: req.method,
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      createdAt: new Date().toISOString(),
    };

    await db.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", changes, "ipAddress", "userAgent", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'SECURITY_EVENT', 'SecurityMonitoring', $2, $3::jsonb, $4, $5, NOW())`,
      actor.id,
      eventType,
      JSON.stringify(event),
      event.ipAddress,
      event.userAgent
    );
    await sendSecurityEventWebhook(event);
    return { written: true };
  } catch (error) {
    console.warn('⚠️ Security audit event failed:', error.message);
    return { written: false, warning: error.message };
  }
}

function recordSecurityAuditEvent(req, eventType, severity, summary, details = {}) {
  getPrisma()
    .then((db) => writeSecurityAuditEvent(db, req, eventType, severity, summary, details))
    .catch((error) => console.warn('⚠️ Security audit event could not be queued:', error.message));
}

app.get('/api/platform-config', async (req, res) => {
  const requestStartedAt = Date.now();
  try {
    const db = await getPrisma();
    await seedCommercialConfigIfEmpty(db);

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
      db.$queryRawUnsafe(`
        SELECT
          u.id,
          u."userId",
          u.username,
          u.email,
          u."firstName",
          u."lastName",
          u.role,
          u."isActive",
          p.id AS "staffRecordId",
          p.name AS "staffName",
          p.rank AS "staffRank",
          p.unit AS "staffUnit",
          p.location AS "staffLocation",
          t.id AS "traineeRecordId",
          t.name AS "traineeName",
          t."fullName" AS "traineeFullName",
          t.rank AS "traineeRank",
          t.course AS "traineeCourse",
          t.unit AS "traineeUnit",
          t.location AS "traineeLocation"
        FROM "User" u
        LEFT JOIN "Personnel" p ON p."userId" = u.id AND p."isActive" = true
        LEFT JOIN "Trainee" t ON t."userId" = u.id AND t."isActive" = true
        ORDER BY u."lastName", u."firstName", u.username
      `),
    ]);

    const payload = {
      organisations,
      locations,
      units,
      unitTypes: normaliseCommercialUnitTypes(
        organisations.find((org) => org?.settings?.unitTypes)?.settings?.unitTypes,
        units
      ),
      aircraftTypes: aircraftTypes.map((aircraftType) => ({
        ...aircraftType,
        crewComposition: aircraftType.crewComposition || aircraftType.settings?.crewComposition || null,
        defaultTasKtas: getAircraftTypeTasKtas(aircraftType),
        defaultCruiseAltitudeFl: getAircraftTypeCruiseAltitudeFl(aircraftType),
      })),
      resourcePools,
      modules,
      unitModules,
      licenses,
      schedulingRuleSets,
      userAccess,
      platformUsers,
    };
    logApiTiming('GET /api/platform-config', requestStartedAt, {
      organisations: organisations.length,
      locations: locations.length,
      units: units.length,
      resourcePools: resourcePools.length,
      userAccess: userAccess.length,
    });
    res.json(payload);
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

const isTruthyEnv = (value) => ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());

const isVendorLicensingPortalEnabled = () => (
  isTruthyEnv(process.env.DFP_VENDOR_LICENSE_PORTAL_ENABLED) ||
  isTruthyEnv(process.env.DFP_ENABLE_VENDOR_LICENSE_PORTAL) ||
  (process.env.NODE_ENV !== 'production' && !isTruthyEnv(process.env.DFP_DISABLE_VENDOR_LICENSE_PORTAL))
);

const getVendorLicensePortalToken = () => (
  process.env.DFP_VENDOR_LICENSE_PORTAL_TOKEN ||
  process.env.DFP_VENDOR_LICENSING_TOKEN ||
  ''
);

const normalizeHostValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .split('/')[0]
  .replace(/:\d+$/, '');

const getVendorLicensePortalHosts = () => String(process.env.DFP_VENDOR_LICENSE_PORTAL_HOSTS || '')
  .split(',')
  .map(normalizeHostValue)
  .filter(Boolean);

const getRequestHost = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '')
  .split(',')[0]
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .split('/')[0]
  .replace(/:\d+$/, '');

function tokenEquals(received, expected) {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  if (left.length !== right.length || right.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function isVendorLicenseHostAllowed(req) {
  const allowedHosts = getVendorLicensePortalHosts();
  if (process.env.NODE_ENV !== 'production' && allowedHosts.length === 0) return true;
  const requestHost = getRequestHost(req);
  return allowedHosts.some((host) => requestHost === host || requestHost.endsWith(`.${host}`));
}

const vendorLicenseRateLimit = new Map();
function isVendorLicenseRateLimited(req) {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = Number(process.env.DFP_VENDOR_LICENSE_RATE_LIMIT || 20);
  const now = Date.now();
  const ip = String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const existing = vendorLicenseRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (existing.resetAt <= now) {
    vendorLicenseRateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  existing.count += 1;
  vendorLicenseRateLimit.set(ip, existing);
  return existing.count > maxAttempts;
}

function setVendorLicensePortalHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function requireVendorLicensePortalPage(req, res) {
  if (!isVendorLicensingPortalEnabled() || !isVendorLicenseHostAllowed(req)) {
    res.status(404).send('Not found');
    return false;
  }

  const expectedUser = process.env.DFP_VENDOR_LICENSE_PORTAL_USER || '';
  const expectedPassword = process.env.DFP_VENDOR_LICENSE_PORTAL_PASSWORD || '';
  if (process.env.NODE_ENV === 'production' && (!expectedUser || !expectedPassword)) {
    res.status(503).send('Vendor licensing portal page authentication is not configured.');
    return false;
  }
  if (!expectedUser || !expectedPassword) return true;

  const authHeader = String(req.headers.authorization || '');
  const encoded = authHeader.startsWith('Basic ') ? authHeader.slice(6) : '';
  let suppliedUser = '';
  let suppliedPassword = '';
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const splitIndex = decoded.indexOf(':');
    suppliedUser = splitIndex >= 0 ? decoded.slice(0, splitIndex) : '';
    suppliedPassword = splitIndex >= 0 ? decoded.slice(splitIndex + 1) : '';
  } catch {}

  if (!tokenEquals(suppliedUser, expectedUser) || !tokenEquals(suppliedPassword, expectedPassword)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DFP NEO Vendor Licensing", charset="UTF-8"');
    res.status(401).send('Vendor authentication is required.');
    return false;
  }
  return true;
}

function requireVendorLicensePortal(req, res) {
  setVendorLicensePortalHeaders(res);
  if (!isVendorLicensingPortalEnabled() || !isVendorLicenseHostAllowed(req)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  if (isVendorLicenseRateLimited(req)) {
    res.status(429).json({ error: 'Too many attempts', message: 'Wait before trying again.' });
    return null;
  }

  const expectedToken = getVendorLicensePortalToken();
  if (!expectedToken) {
    res.status(503).json({
      error: 'Vendor licensing portal is not configured',
      message: 'Set DFP_VENDOR_LICENSE_PORTAL_TOKEN before generating licences.',
    });
    return null;
  }

  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const suppliedToken = bearerToken || req.headers['x-dfp-vendor-token'] || req.body?.vendorToken || '';
  if (!tokenEquals(suppliedToken, expectedToken)) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid vendor licensing token is required.' });
    return null;
  }

  const privateKeyPem = process.env.DFP_LICENSE_PRIVATE_KEY || process.env.DFP_LICENCE_PRIVATE_KEY;
  if (!privateKeyPem) {
    res.status(503).json({
      error: 'Private signing key is not configured',
      message: 'Set DFP_LICENSE_PRIVATE_KEY on the vendor licensing service. Do not set it on customer deployments.',
    });
    return null;
  }

  return { privateKeyPem };
}

const normalisePortalString = (value) => String(value || '').trim();
const normalisePortalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalisePortalList = (value) => {
  if (Array.isArray(value)) return value.map(normalisePortalString).filter(Boolean);
  return String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

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
    pathName.startsWith('/api/vendor-license/') ||
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

app.post('/api/platform-license/verify', adminSensitiveRateLimit, async (req, res) => {
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

app.post('/api/platform-license/import', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

app.post('/api/platform-license/generate-development', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;

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

app.get('/vendor/licensing', (req, res) => {
  setVendorLicensePortalHeaders(res);
  if (!requireVendorLicensePortalPage(req, res)) return;
  res.sendFile(path.join(__dirname, 'server-assets', 'vendor-licensing-portal.html'));
});

app.post('/api/vendor-license/generate', async (req, res) => {
  try {
    const vendorContext = requireVendorLicensePortal(req, res);
    if (!vendorContext) return;

    const body = req.body || {};
    const licenseKey = normalisePortalString(body.licenseKey);
    const organisationCode = normalisePortalString(body.organisationCode);
    const fingerprints = normalisePortalList(body.fingerprints || body.fingerprint);
    const allowAnyFingerprint = body.allowAnyFingerprint === true;
    if (!licenseKey) return res.status(400).json({ error: 'Licence key is required.' });
    if (!organisationCode) return res.status(400).json({ error: 'Organisation code is required.' });
    if (!allowAnyFingerprint && fingerprints.length === 0) {
      return res.status(400).json({ error: 'At least one deployment fingerprint is required.' });
    }

    const moduleCodes = normalisePortalList(body.moduleCodes || body.modules);
    const deploymentFingerprint = fingerprints[0] || null;
    const packageMetadata = readPackageMetadata();
    const payload = {
      schema: LICENSE_PAYLOAD_SCHEMA,
      issuedAt: new Date().toISOString(),
      application: {
        application: packageMetadata.name || 'daily-flying-program',
        version: packageMetadata.version || 'customer-package',
        deploymentFingerprint,
      },
      customer: {
        organisationCode,
        organisationName: normalisePortalString(body.organisationName) || organisationCode,
      },
      license: {
        licenseKey,
        licenseName: normalisePortalString(body.licenseName) || licenseKey,
        deploymentMode: normalisePortalString(body.deploymentMode) || 'Online SaaS',
        status: 'ACTIVE',
        validFrom: normalisePortalString(body.validFrom) || null,
        validUntil: normalisePortalString(body.validUntil) || null,
        maxUsers: normalisePortalNumber(body.maxUsers),
        maxUnits: normalisePortalNumber(body.maxUnits),
        maxAircraftTypes: normalisePortalNumber(body.maxAircraftTypes),
        moduleCodes,
        features: {
          validationMethod: body.offline === true ? 'Offline signed licence file' : (normalisePortalString(body.validationMethod) || 'Online licence check'),
          enforcementMode: normaliseLicenceEnforcementMode(body.enforcementMode),
          offlineGraceDays: normalisePortalNumber(body.offlineGraceDays) ?? 30,
          allowOfflineOperation: body.offline === true || body.allowOfflineOperation === true,
        },
      },
      deployment: {
        fingerprint: fingerprints.length === 1 ? fingerprints[0] : null,
        allowedFingerprints: fingerprints,
        allowAnyFingerprint,
      },
    };

    const signedLicenseFile = signLicensePayload(payload, vendorContext.privateKeyPem, {
      keyId: normalisePortalString(body.keyId) || process.env.DFP_LICENSE_KEY_ID || process.env.DFP_LICENCE_KEY_ID || 'primary',
    });

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      licenseKey,
      organisationCode,
      fingerprintCount: fingerprints.length,
      signedLicenseFile,
    });
  } catch (error) {
    console.error('❌ POST /api/vendor-license/generate error:', error);
    res.status(400).json({ error: 'Failed to generate signed licence', details: error.message });
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const payload = req.body || {};
    const {
      organisations: rawOrganisations = [],
      locations: rawLocations = [],
      units: rawUnits = [],
      unitTypes: rawUnitTypes,
      aircraftTypes: rawAircraftTypes = [],
      resourcePools: rawResourcePools = [],
      unitModules: rawUnitModules = [],
      licenses: rawLicenses = [],
      schedulingRuleSets: rawSchedulingRuleSets = [],
      userAccess: rawUserAccess = [],
    } = payload;

    const now = new Date().toISOString();
    const toJson = (value) => JSON.stringify(value || {});
    const toArray = (value) => Array.isArray(value) ? value : [];
    const deleteRowsNotInPayload = async (tableName, keyExpression, keepKeys) => {
      const uniqueKeys = Array.from(new Set(keepKeys.map((key) => String(key || '').trim()).filter(Boolean)));
      if (uniqueKeys.length === 0) {
        await db.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
        return;
      }
      const keepPlaceholders = uniqueKeys.map((_, index) => `$${index + 1}`).join(', ');
      await db.$executeRawUnsafe(
        `DELETE FROM "${tableName}" WHERE ${keyExpression} NOT IN (${keepPlaceholders})`,
        ...uniqueKeys
      );
    };
    const organisations = toArray(rawOrganisations);
    const locations = toArray(rawLocations);
    const units = toArray(rawUnits);
    const unitTypes = normaliseCommercialUnitTypes(rawUnitTypes, units);
    const aircraftTypes = toArray(rawAircraftTypes);
    const resourcePools = toArray(rawResourcePools);
    const unitModules = toArray(rawUnitModules);
    const licenses = toArray(rawLicenses);
    const schedulingRuleSets = toArray(rawSchedulingRuleSets);
    const userAccess = toArray(rawUserAccess);
    const incompleteAircraftType = aircraftTypes.find((aircraftType) => (
      String(aircraftType?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE' &&
      (!String(aircraftType?.code || '').trim() || !String(aircraftType?.name || '').trim())
    ));
    if (incompleteAircraftType) {
      return res.status(400).json({
        error: 'Unsafe platform configuration save blocked',
        details: 'Every active aircraft type needs a code and name before saving.',
      });
    }
    const incompleteResourcePool = resourcePools.find((pool) => (
      String(pool?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE' &&
      (!String(pool?.code || '').trim() || !String(pool?.name || '').trim())
    ));
    if (incompleteResourcePool) {
      return res.status(400).json({
        error: 'Unsafe platform configuration save blocked',
        details: 'Every active DFP Resource Rows record needs a code and name before saving.',
      });
    }
    const hasActiveRecords = (records) => records.some((record) => String(record?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');
    const hasActiveOrganisations = hasActiveRecords(organisations);
    const hasActiveLocations = hasActiveRecords(locations);
    const hasActiveUnits = hasActiveRecords(units);
    const isDeliberatelyEmptyStructure = !hasActiveOrganisations && !hasActiveLocations && !hasActiveUnits;
    const structuralBlocker = isDeliberatelyEmptyStructure ? '' :
      !hasActiveOrganisations ? 'At least one active organisation is required while locations or units still exist.' :
      !hasActiveLocations ? 'At least one active location is required while units still exist.' :
      !hasActiveUnits ? 'At least one active unit is required while organisations or locations still exist.' :
      '';
    if (structuralBlocker) {
      return res.status(400).json({
        error: 'Unsafe platform configuration save blocked',
        details: structuralBlocker,
      });
    }
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
    const organisationCodesToKeep = Array.from(new Set(
      organisations
        .map((org) => String(org.code || '').trim())
        .filter(Boolean)
    ));
    if (organisationCodesToKeep.length === 0) {
      await db.$executeRawUnsafe(`DELETE FROM "CommercialOrganisation"`);
    } else {
      const keepPlaceholders = organisationCodesToKeep.map((_, index) => `$${index + 1}`).join(', ');
      await db.$executeRawUnsafe(
        `DELETE FROM "CommercialOrganisation" WHERE "code" NOT IN (${keepPlaceholders})`,
        ...organisationCodesToKeep
      );
    }
    await deleteRowsNotInPayload('CommercialLocation', `"code"`, locations.map((location) => location.code));
    await deleteRowsNotInPayload('CommercialUnit', `"code"`, units.map((unit) => unit.code));
    await deleteRowsNotInPayload('CommercialAircraftType', `"code"`, aircraftTypes.map((aircraftType) => aircraftType.code));
    await deleteRowsNotInPayload('CommercialResourcePool', `"code"`, resourcePools.map((pool) => pool.code));
    await deleteRowsNotInPayload('CommercialUnitModule', `("unitCode" || '|' || "moduleCode")`, unitModules.map((unitModule) => (
      unitModule.unitCode && unitModule.moduleCode ? `${unitModule.unitCode}|${unitModule.moduleCode}` : ''
    )));
    await deleteRowsNotInPayload('CommercialLicense', `"licenseKey"`, licenses.map((license) => license.licenseKey));
    await deleteRowsNotInPayload('CommercialSchedulingRuleSet', `"id"`, schedulingRuleSets.map((ruleSet) => ruleSet.id));
    await deleteRowsNotInPayload('CommercialUserAccess', `"scopeKey"`, userAccess.map((access) => ([
      access.userId,
      access.organisationCode || 'DEFAULT',
      access.locationCode || '',
      access.unitCode || '',
      access.moduleCode || '',
    ].join('|'))));

    for (const org of organisations) {
      if (!org.code || !org.name) continue;
      const organisationSettings = { ...(org.settings || {}) };
      if (org.code === organisations[0]?.code) {
        organisationSettings.unitTypes = unitTypes;
      }
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialOrganisation" ("id", "code", "name", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, $5::timestamp, $5::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "name" = $2,
          "status" = $3,
          "settings" = $4::jsonb,
          "updatedAt" = $5::timestamp
      `, org.code, org.name, org.status || 'ACTIVE', toJson(organisationSettings), now);
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
      `, String(location.organisationCode || '').trim(), location.code, iataCode, location.name, Number(location.timezoneOffset ?? 10), solar.latitude, solar.longitude, solar.timezone, toArray(location.trainingAreas), location.status || 'ACTIVE', toJson(location.settings), now);
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
      `, String(unit.organisationCode || '').trim(), unit.locationCode || '', unit.code, unit.name, unit.unitType || '', unit.status || 'ACTIVE', toJson(unit.settings), now);
    }

    for (const aircraftType of aircraftTypes) {
      if (!aircraftType.code || !aircraftType.name) continue;
      const aircraftTypeSettings = buildCommercialAircraftTypeSettings(aircraftType);
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialAircraftType" ("id", "code", "name", "category", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6::timestamp, $6::timestamp)
        ON CONFLICT ("code") DO UPDATE SET
          "name" = $2,
          "category" = $3,
          "status" = $4,
          "settings" = $5::jsonb,
          "updatedAt" = $6::timestamp
      `, aircraftType.code, aircraftType.name, aircraftType.category || 'Training', aircraftType.status || 'ACTIVE', toJson(aircraftTypeSettings), now);
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
      `, String(pool.organisationCode || '').trim(), pool.locationCode || null, pool.unitCode || null, pool.aircraftTypeCode || null, pool.code, pool.name, pool.poolType || 'Dedicated', pool.status || 'ACTIVE', toJson(pool.settings), now);
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
      const upsertUserAccessScope = async () => db.$executeRawUnsafe(`
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

      if (access.id) {
        const updatedRows = await db.$executeRawUnsafe(`
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
        if (Number(updatedRows) > 0) continue;
      }
      await upsertUserAccessScope();
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

// GET /api/settings/course-settings - Get course settings (selectedAcademicLmp + excludedCourses)
app.get('/api/settings/course-settings', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      'SELECT "selectedAcademicLmp", "excludedCourses" FROM "CourseSettings" LIMIT 1'
    );
    const setting = rows && rows.length > 0 ? rows[0] : null;
    let excludedCourses = [];
    if (setting && setting.excludedCourses) {
      try { excludedCourses = JSON.parse(setting.excludedCourses); } catch (_) {}
    }
    return res.json({
      selectedAcademicLmp: setting ? (setting.selectedAcademicLmp || null) : null,
      excludedCourses,
    });
  } catch (error) {
    console.error('[CourseSettings] GET error:', error);
    res.status(500).json({ error: 'Failed to load course settings', details: error.message });
  }
});

// PUT /api/settings/course-settings - Update course settings (selectedAcademicLmp and/or excludedCourses)
app.put('/api/settings/course-settings', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const { selectedAcademicLmp, excludedCourses } = req.body;
    // At least one field must be present (allow empty string/array to clear a value)
    if (selectedAcademicLmp === undefined && excludedCourses === undefined) {
      return res.status(400).json({ error: 'No settings fields provided' });
    }
    const existing = await db.$queryRawUnsafe(
      'SELECT id, "selectedAcademicLmp", "excludedCourses" FROM "CourseSettings" LIMIT 1'
    );
    const now = new Date().toISOString();
    if (existing && existing.length > 0) {
      const row = existing[0];
      const newSelectedAcademicLmp = selectedAcademicLmp !== undefined ? selectedAcademicLmp : row.selectedAcademicLmp;
      const newExcludedCourses = excludedCourses !== undefined ? JSON.stringify(excludedCourses) : (row.excludedCourses || '[]');
      await db.$executeRawUnsafe(
        'UPDATE "CourseSettings" SET "selectedAcademicLmp" = $1, "excludedCourses" = $2, "updatedAt" = $3::timestamp WHERE id = $4',
        newSelectedAcademicLmp || null, newExcludedCourses, now, row.id
      );
    } else {
      const newId = require('crypto').randomUUID();
      const newExcludedCourses = excludedCourses !== undefined ? JSON.stringify(excludedCourses) : '[]';
      await db.$executeRawUnsafe(
        'INSERT INTO "CourseSettings" (id, "selectedAcademicLmp", "excludedCourses", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4::timestamp, $5::timestamp)',
        newId, selectedAcademicLmp || null, newExcludedCourses, now, now
      );
    }
    console.log(`[CourseSettings] updated: selectedAcademicLmp=${selectedAcademicLmp}, excludedCourses=${JSON.stringify(excludedCourses)}`);
    res.json({ success: true, selectedAcademicLmp, excludedCourses });
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    await ensureCourseLeadershipColumns(db);
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const courses = await db.course.findMany({
      where: scopedWhere,
      orderBy: { startDate: 'asc' },
    });
    
    // Sort courses with numeric suffixes in numeric order.
    courses.sort((a, b) => {
      const aCode = a.code || a.name;
      const bCode = b.code || b.name;
      
      // Extract the numeric part from course codes.
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
      courseCommander: c.courseCommander || '',
      deputyCourseCommander: c.deputyCourseCommander || '',
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    await ensureCourseLeadershipColumns(db);
    const { name, code, color, startDate, gradDate, raafStart, navyStart, armyStart, location, unit, lmpType, academicLmpType, courseCommander, deputyCourseCommander, status } = req.body;
    const courseName = String(name || code || '').trim();
    const courseCode = String(code || name || '').trim();
    if (!courseName || !courseCode) return res.status(400).json({ error: 'name is required' });
    const updateData = {
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
        courseCommander: courseCommander || '',
        deputyCourseCommander: deputyCourseCommander || '',
        status: status || 'ACTIVE',
        updatedAt: new Date(),
    };
    const existingCourse = await db.course.findFirst({
      where: {
        OR: [
          { code: courseCode },
          { name: courseName },
        ],
      },
    });
    const course = existingCourse
      ? await db.course.update({
        where: { id: existingCourse.id },
        data: {
          ...updateData,
          name: courseName,
          code: existingCourse.code || courseCode,
        },
      })
      : await db.course.create({
      data: {
        name: courseName,
        code: courseCode,
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
        courseCommander: courseCommander || '',
        deputyCourseCommander: deputyCourseCommander || '',
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
  const requestStartedAt = Date.now();
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
    const scopeStartedAt = Date.now();
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const scopeMs = Date.now() - scopeStartedAt;
    const finalWhere = mergeScopedWhere(where, scopedWhere);

    const queryStartedAt = Date.now();
    const personnel = await db.personnel.findMany({
      where: finalWhere,
      orderBy: { name: 'asc' },
    });
    const queryMs = Date.now() - queryStartedAt;

    logApiTiming('GET /api/personnel', requestStartedAt, { count: personnel.length, scopeMs, queryMs });
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
    const body = normalisePersonnelPayloadForUnit(req.body);
    if (!isUsablePersonnelIdNumber(body.idNumber)) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }
    const idNumber = Number(body.idNumber);
    const idConflict = await findPersonnelIdNumberConflict(db, idNumber);
    if (idConflict) {
      return sendPersonnelIdConflict(res, idConflict);
    }

    // Auto-link to existing User by Personnel ID
    let linkedUserId = null;
    if (idNumber) {
      const existingUser = await db.user.findFirst({
        where: { userId: idNumber.toString() }
      });
      if (existingUser) {
        linkedUserId = existingUser.id;
        console.log(`✅ Auto-linked to user: ${existingUser.username}`);
      }
    }

    const preferences = {
      ...(body.preferences && typeof body.preferences === 'object' && !Array.isArray(body.preferences) ? body.preferences : {}),
      ...(body.callsign !== undefined ? { callsign: body.callsign || null } : {}),
      ...(body.secondaryCallsign !== undefined ? { secondaryCallsign: body.secondaryCallsign || null } : {}),
      ...(body.crew !== undefined ? { crew: body.crew || null } : {}),
    };

    const newPersonnel = await db.personnel.create({
      data: {
        name: body.name || '',
        rank: body.rank || null,
        role: body.role || null,
        category: body.category || null,
        unit: body.unit || null,
        flight: body.flight || null,
        location: body.location || null,
        idNumber,
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
        preferences,
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
    let updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }

    const existing = await db.personnel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personnel not found' });
    }
    updates = normalisePersonnelPayloadForUnit({
      ...updates,
      unit: updates.unit ?? existing.unit,
    });

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
    if ('idNumber' in sanitizedUpdates) {
      if (!isUsablePersonnelIdNumber(sanitizedUpdates.idNumber)) {
        return res.status(400).json({ error: 'Personnel ID is required' });
      }
      sanitizedUpdates.idNumber = Number(sanitizedUpdates.idNumber);
      const idConflict = await findPersonnelIdNumberConflict(db, sanitizedUpdates.idNumber, { excludePersonnelId: existing.id });
      if (idConflict) {
        return sendPersonnelIdConflict(res, idConflict);
      }
    }

    if ('crew' in updates) {
      const incomingPreferences = updates.preferences && typeof updates.preferences === 'object' && !Array.isArray(updates.preferences)
        ? updates.preferences
        : {};
      sanitizedUpdates.preferences = {
        ...((existing.preferences && typeof existing.preferences === 'object' && !Array.isArray(existing.preferences)) ? existing.preferences : {}),
        ...incomingPreferences,
        crew: updates.crew || null,
      };
    }

    const updated = await db.$transaction(async (tx) => {
      if ('email' in sanitizedUpdates && existing.userId) {
        await syncLinkedPersonLoginEmail(tx, existing, sanitizedUpdates.email);
      }
      return tx.personnel.update({
        where: { id },
        data: sanitizedUpdates
      });
    });

    console.log(`✅ PATCH /api/personnel/${id} - updated: ${updated.name}`);
    res.json({ success: true, personnel: updated });
  } catch (error) {
    console.error('❌ PATCH /api/personnel error:', error);
    const status = error.status || 500;
    const fallbackMessage = status === 409 ? 'Account conflict' : 'Failed to update personnel';
    res.status(status).json({
      error: fallbackMessage,
      message: error.message || fallbackMessage,
      details: error.message,
    });
  }
});

// POST /api/cleanup-deploy-unavailability - Remove all __deploy__ tagged unavailability periods
// from all personnel and trainees in the DB. One-time fix for stuck "Deployed" conflicts.
app.post('/api/cleanup-deploy-unavailability', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    // User.userId = Personnel ID string (what frontend sends), User.id = UUID primary key (what AuditLog needs)
    let dbUserId = null;

    // 1. Try by User.userId field (Personnel ID number sent from frontend)
    if (userId) {
      const user = await db.user.findFirst({ where: { userId: String(userId) } });
      if (user) {
        dbUserId = user.id;
        console.log(`[Audit] Resolved user by userId/Personnel ID: ${userId} → dbUserId=${dbUserId}`);
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

function mapSecurityAuditRow(row) {
  const changes = row.changes || {};
  const displayName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username || row.userId || 'System';
  return {
    id: row.id,
    eventType: changes.eventType || row.entityId || '',
    severity: changes.severity || 'info',
    summary: changes.summary || '',
    details: changes.details || {},
    path: changes.path || '',
    method: changes.method || '',
    ipAddress: row.ipAddress || changes.ipAddress || '',
    userAgent: row.userAgent || changes.userAgent || '',
    createdAt: row.createdAt,
    userName: displayName,
  };
}

// GET /api/security/events - Admin-only security event history
app.get('/api/security/events', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 500));
    const severity = String(req.query.severity || '').trim().toLowerCase();
    const eventType = String(req.query.eventType || '').trim().toUpperCase();
    const params = [];
    const where = [`a."entityType" = 'SecurityMonitoring'`];

    if (severity) {
      params.push(severity);
      where.push(`LOWER(a.changes->>'severity') = $${params.length}`);
    }

    if (eventType) {
      params.push(eventType);
      where.push(`a."entityId" = $${params.length}`);
    }

    params.push(limit);
    const rows = await db.$queryRawUnsafe(
      `SELECT
         a.id,
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
       WHERE ${where.join(' AND ')}
       ORDER BY a."createdAt" DESC
       LIMIT $${params.length}`,
      ...params
    );

    res.json({ events: rows.map(mapSecurityAuditRow) });
  } catch (error) {
    console.error('❌ GET /api/security/events error:', error);
    res.status(500).json({ error: 'Failed to fetch security events', details: error.message });
  }
});

// GET /api/security/status - Admin-only security monitoring summary
app.get('/api/security/status', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;

    const [severityRows, latestRows] = await Promise.all([
      db.$queryRawUnsafe(
        `SELECT COALESCE(LOWER(changes->>'severity'), 'info') AS severity, COUNT(*)::int AS count
         FROM "AuditLog"
         WHERE "entityType" = 'SecurityMonitoring'
           AND "createdAt" >= NOW() - INTERVAL '30 days'
         GROUP BY COALESCE(LOWER(changes->>'severity'), 'info')
         ORDER BY count DESC`
      ),
      db.$queryRawUnsafe(
        `SELECT
           a.id,
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
         WHERE a."entityType" = 'SecurityMonitoring'
         ORDER BY a."createdAt" DESC
         LIMIT 5`
      ),
    ]);

    const countsLast30Days = severityRows.reduce((acc, row) => {
      acc[row.severity || 'info'] = Number(row.count || 0);
      return acc;
    }, { critical: 0, warning: 0, info: 0 });

    res.json({
      status: {
        monitoringEnabled: true,
        externalReportingConfigured: Boolean(SECURITY_EVENT_WEBHOOK_URL),
        countsLast30Days,
        latestEvents: latestRows.map(mapSecurityAuditRow),
      },
    });
  } catch (error) {
    console.error('❌ GET /api/security/status error:', error);
    res.status(500).json({ error: 'Failed to fetch security status', details: error.message });
  }
});

// DELETE /api/personnel/:id - Delete a personnel record
app.delete('/api/personnel/:id', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
  const requestStartedAt = Date.now();
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
    const scopeStartedAt = Date.now();
    const scopedWhere = await buildScopedEntityWhere(req, db);
    const scopeMs = Date.now() - scopeStartedAt;
    const finalWhere = mergeScopedWhere(where, scopedWhere);

    const queryStartedAt = Date.now();
    const trainees = await db.trainee.findMany({
      where: finalWhere,
      orderBy: { name: 'asc' },
    });
    const queryMs = Date.now() - queryStartedAt;

    logApiTiming('GET /api/trainees', requestStartedAt, { count: trainees.length, scopeMs, queryMs });
    res.json({ trainees });
  } catch (error) {
    console.error('❌ GET /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to fetch trainees', details: error.message });
  }
});

// DELETE /api/trainees/:id - Delete a trainee record
app.delete('/api/trainees/:id', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// PATCH /api/trainees/fix-location - legacy course-wide maintenance endpoint
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-location', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use the authenticated trainee management tools instead.',
  });
});

// PATCH /api/trainees/bulk-unit - Bulk update unit for trainees in a course
// NOTE: This must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/bulk-unit', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// PATCH /api/trainees/fix-lmp-type - legacy course-name maintenance endpoint
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-lmp-type', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use configured Master LMP access and trainee management tools instead.',
  });
});

// ============================================================
// INDIVIDUAL LMP ROUTES
// MUST be defined BEFORE /api/trainees/:id to avoid route conflicts
// ============================================================

// POST /api/fix-bif-ftd-dependencies - legacy course-specific maintenance endpoint
app.post('/api/fix-bif-ftd-dependencies', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use configuration-aware Individual LMP maintenance tools instead.',
  });
});

// POST /api/fix-pt051-scores - legacy training-report maintenance endpoint
app.post('/api/fix-pt051-scores', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use configuration-aware training report maintenance tools instead.',
  });
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
    if (includeEvents) {
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
      const parsedSyllabus = (allSyllabusItems || []).map(normaliseSyllabusItemForRuntime);
      const getMasterSyllabus = (lmpType) => {
        if (!lmpType) return [];
        return parsedSyllabus.filter(item => syllabusItemMatchesConfiguredCourse(item, lmpType));
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
        acceptableAircraftConfigs: item.acceptableAircraftConfigs,
        assessedElements: item.assessedElements,
        assessmentRequired: item.assessmentRequired === true,
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
        rplGranted: item.rplGranted === true,
        rplGrantedAt: item.rplGrantedAt || null,
        rplGrantedBy: item.rplGrantedBy || null,
        trainingReportNextEventExtensions: item.trainingReportNextEventExtensions,
        trainingReportExtensionAssessmentIds: item.trainingReportExtensionAssessmentIds,
        trainingReportLastExtendedByAssessmentId: item.trainingReportLastExtendedByAssessmentId,
        trainingReportBaseNotes: item.trainingReportBaseNotes,
        trainingReportForwardedNotes: item.trainingReportForwardedNotes,
        trainingReportLastForwardedNotesAssessmentId: item.trainingReportLastForwardedNotesAssessmentId,
        isRemedial: item.isRemedial,
        lmpSource: item.lmpSource,
        orderKey: item.orderKey,
        placementNeedsReview: item.placementNeedsReview,
        anchorAfterMasterEventId: item.anchorAfterMasterEventId,
        anchorBeforeMasterEventId: item.anchorBeforeMasterEventId,
        anchorPolicy: item.anchorPolicy,
      });
      const overlaysByTraineeId = await loadActiveTraineeLmpOverlaysByTraineeId(db);

      const composedLmps = lmps.map(lmp => {
        const masterSyllabus = getMasterSyllabus(lmp.lmpType);
        const overlayEvents = overlaysByTraineeId.get(lmp.traineeId) || [];
        const events = composeIndividualLmpEvents(
          Array.isArray(lmp.events) ? lmp.events : [],
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
  'resourceCount',
  'acceptableAircraftConfigs',
  'resourcesHuman',
  'eventDetailsCommon',
  'eventDetailsSortie',
  'flightOrSimHours',
  'totalEventHours',
  'duration',
  'preFlightTime',
  'postFlightTime',
  'individualTimingOverrides',
  'prerequisites',
  'prerequisitesGround',
  'prerequisitesFlying',
  'location',
  'twrDiReqd',
  'cctOnly',
  'notes',
  'trainingReportNextEventExtensions',
  'trainingReportExtensionAssessmentIds',
  'trainingReportLastExtendedByAssessmentId',
  'trainingReportBaseNotes',
  'trainingReportForwardedNotes',
  'trainingReportLastForwardedNotesAssessmentId',
];

const roundTrainingReportHoursForSync = (value) => Math.round(Number(value || 0) * 100) / 100;
const normaliseTrainingReportHoursForSync = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const resolveTotalTrainingReportExtensionHoursForSync = (extensionLedger) => (
  roundTrainingReportHoursForSync(Object.values(extensionLedger || {})
    .map(normaliseTrainingReportHoursForSync)
    .reduce((total, hours) => total + hours, 0))
);
const resolveCurrentTrainingReportExtensionHoursForSync = (extensionLedger, lastExtensionKey) => {
  const entries = Object.entries(extensionLedger || {})
    .map(([key, value]) => [String(key || '').trim(), normaliseTrainingReportHoursForSync(value)])
    .filter(([key, hours]) => key && hours > 0);
  if (entries.length === 0) return 0;
  const preferredKey = String(lastExtensionKey || '').trim();
  const preferredEntry = preferredKey ? entries.find(([key]) => key === preferredKey) : null;
  return roundTrainingReportHoursForSync(preferredEntry?.[1] ?? entries[entries.length - 1][1]);
};
const hasTrainingReportExtensionMetadataForSync = (item) => (
  Boolean(item?.trainingReportLastExtendedByAssessmentId) ||
  (Array.isArray(item?.trainingReportExtensionAssessmentIds) && item.trainingReportExtensionAssessmentIds.length > 0) ||
  Object.keys(item?.trainingReportNextEventExtensions || {}).length > 0
);
const trainingReportTimingBaseForSync = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const normaliseTrainingReportExtendedTimingForSync = (existingItem, masterItem) => {
  if (!existingItem || !masterItem || !hasTrainingReportExtensionMetadataForSync(existingItem)) return {};
  const type = String(existingItem.type || masterItem.type || '').trim().toLowerCase();
  if (type !== 'flight' && type !== 'ftd') return {};

  const extensionHours = resolveCurrentTrainingReportExtensionHoursForSync(
    existingItem.trainingReportNextEventExtensions,
    existingItem.trainingReportLastExtendedByAssessmentId
  );
  const masterDuration = trainingReportTimingBaseForSync(masterItem.duration, 1);
  const masterFlightOrSimHours = trainingReportTimingBaseForSync(masterItem.flightOrSimHours, masterDuration);
  const masterTotalEventHours = trainingReportTimingBaseForSync(masterItem.totalEventHours, masterDuration);

  return {
    flightOrSimHours: roundTrainingReportHoursForSync(masterFlightOrSimHours + extensionHours),
    duration: roundTrainingReportHoursForSync(masterDuration + extensionHours),
    totalEventHours: roundTrainingReportHoursForSync(masterTotalEventHours + extensionHours),
  };
};

const forfeitTrainingReportFollowUpForRplForSync = (item) => {
  const extensionHours = resolveTotalTrainingReportExtensionHoursForSync(item?.trainingReportNextEventExtensions);
  const removeExtensionHours = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return value;
    return roundTrainingReportHoursForSync(Math.max(0, parsed - extensionHours));
  };
  const baseNotes = typeof item?.trainingReportBaseNotes === 'string'
    ? item.trainingReportBaseNotes
    : item?.notes;
  return {
    ...item,
    flightOrSimHours: extensionHours > 0 ? removeExtensionHours(item.flightOrSimHours) : item.flightOrSimHours,
    duration: extensionHours > 0 ? removeExtensionHours(item.duration) : item.duration,
    totalEventHours: extensionHours > 0 ? removeExtensionHours(item.totalEventHours) : item.totalEventHours,
    notes: typeof baseNotes === 'string' ? baseNotes : item?.notes,
    trainingReportNextEventExtensions: undefined,
    trainingReportExtensionAssessmentIds: undefined,
    trainingReportLastExtendedByAssessmentId: undefined,
    trainingReportForwardedNotes: undefined,
    trainingReportLastForwardedNotesAssessmentId: undefined,
    trainingReportBaseNotes: undefined,
  };
};

const getIndividualLmpMasterOverridesForSync = (item, masterItem) => {
  if (!item) return {};
  const overrides = INDIVIDUAL_LMP_EDITABLE_FIELDS_FOR_SYNC.reduce((nextOverrides, field) => {
    if (Object.prototype.hasOwnProperty.call(item, field)) {
      if (field === 'preFlightTime' || field === 'postFlightTime') {
        const hasExplicitTimingOverride = item?.individualTimingOverrides?.[field] === true;
        const individualValue = typeof item[field] === 'number' && Number.isFinite(item[field]) ? item[field] : null;
        const masterValue = typeof masterItem?.[field] === 'number' && Number.isFinite(masterItem[field]) ? masterItem[field] : null;
        const legacyLooksLikeMissingTiming =
          !hasExplicitTimingOverride &&
          masterValue !== null &&
          masterValue > 0 &&
          (individualValue === null || individualValue === 0);
        if (legacyLooksLikeMissingTiming) {
          return nextOverrides;
        }
      }
      nextOverrides[field] = item[field];
    }
    return nextOverrides;
  }, {});
  return {
    ...overrides,
    ...normaliseTrainingReportExtendedTimingForSync(item, masterItem),
  };
};

const summariseTrainingReportLmpItemsForSync = (events = []) => {
  const reportItems = (Array.isArray(events) ? events : []).filter((item) =>
    item?.isRemedial ||
    item?.lmpSource === 'remedial' ||
    item?.trainingReportNextEventExtensions ||
    item?.trainingReportLastExtendedByAssessmentId ||
    item?.trainingReportForwardedNotes
  );
  return {
    total: Array.isArray(events) ? events.length : 0,
    reportItemCount: reportItems.length,
    sample: reportItems.slice(0, 5).map((item) => ({
      id: item?.id,
      code: item?.code,
      title: item?.title || item?.eventTitle || item?.eventDescription,
      lmpSource: item?.lmpSource,
      isRemedial: item?.isRemedial,
      flightOrSimHours: item?.flightOrSimHours,
      duration: item?.duration,
      trainingReportNextEventExtensions: item?.trainingReportNextEventExtensions,
      trainingReportLastExtendedByAssessmentId: item?.trainingReportLastExtendedByAssessmentId,
      trainingReportBaseNotes: item?.trainingReportBaseNotes,
      trainingReportForwardedNotes: item?.trainingReportForwardedNotes,
    })),
  };
};

const sameStringSetForSync = (left = [], right = []) => {
  const normalise = (values) => (Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .sort();
  const leftValues = normalise(left);
  const rightValues = normalise(right);
  if (leftValues.length !== rightValues.length) return false;
  return leftValues.every((value, index) => value === rightValues[index]);
};

const LMP_SYNC_COMPARISON_IGNORED_KEYS = new Set(['createdAt', 'updatedAt']);

const stableStringifyForSync = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringifyForSync).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter(key => !LMP_SYNC_COMPARISON_IGNORED_KEYS.has(key))
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringifyForSync(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const sameLmpEventsForSync = (left = [], right = []) => {
  try {
    return stableStringifyForSync(Array.isArray(left) ? left : []) === stableStringifyForSync(Array.isArray(right) ? right : []);
  } catch {
    return false;
  }
};

const getLmpEventDebugLabelForSync = (item) =>
  item?.code || item?.id || item?.masterEventId || item?.title || item?.eventTitle || item?.eventDescription || '';

const findFirstLmpEventDifferenceForSync = (left = [], right = []) => {
  const leftEvents = Array.isArray(left) ? left : [];
  const rightEvents = Array.isArray(right) ? right : [];
  if (leftEvents.length !== rightEvents.length) {
    return {
      reason: 'event-count',
      existingEvents: leftEvents.length,
      nextEvents: rightEvents.length,
    };
  }

  for (let index = 0; index < leftEvents.length; index += 1) {
    const existingEvent = leftEvents[index] || {};
    const nextEvent = rightEvents[index] || {};
    if (stableStringifyForSync(existingEvent) === stableStringifyForSync(nextEvent)) continue;

    const changedKeys = [];
    const keys = new Set([
      ...Object.keys(existingEvent),
      ...Object.keys(nextEvent),
    ]);
    keys.forEach(key => {
      if (LMP_SYNC_COMPARISON_IGNORED_KEYS.has(key)) return;
      if (stableStringifyForSync(existingEvent[key]) !== stableStringifyForSync(nextEvent[key])) {
        changedKeys.push(key);
      }
    });

    return {
      reason: 'event-payload',
      index,
      existingEvent: getLmpEventDebugLabelForSync(existingEvent),
      nextEvent: getLmpEventDebugLabelForSync(nextEvent),
      changedKeys: changedKeys.slice(0, 16),
    };
  }

  return null;
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

const getLmpRplTimestampForSync = (item) => {
  if (item?.rplGranted !== true) return null;
  return item?.rplGrantedAt || item?.completedAt || new Date().toISOString();
};

const addRplCompletionToScoreMapForSync = (scoreMap, item) => {
  const rplTimestamp = getLmpRplTimestampForSync(item);
  if (!rplTimestamp) return;
  getLmpCompletionKeysForSync(item).forEach(key => {
    if (key && !scoreMap[key]) scoreMap[key] = rplTimestamp;
  });
};

const getLmpRplFieldsForSync = (item, completedAt) => {
  if (item?.rplGranted !== true) return {};
  const rplGrantedAt = item.rplGrantedAt || completedAt || new Date().toISOString();
  return {
    rplGranted: true,
    rplGrantedAt,
    rplGrantedBy: item.rplGrantedBy || null,
  };
};

const getLmpCanonicalCompletionKeyForSync = (item) =>
  normalizeLmpCompletionKeyForSync(item?.code) ||
  normalizeLmpCompletionKeyForSync(item?.masterEventId) ||
  normalizeLmpCompletionKeyForSync(item?.id);

const getLmpPrerequisiteKeysForSync = (item) => {
  const prerequisiteValues = [
    ...(Array.isArray(item?.prerequisites) ? item.prerequisites : []),
    ...(Array.isArray(item?.prerequisitesGround) ? item.prerequisitesGround : []),
    ...(Array.isArray(item?.prerequisitesFlying) ? item.prerequisitesFlying : []),
  ];
  return Array.from(new Set(prerequisiteValues.map(normalizeLmpCompletionKeyForSync).filter(Boolean)));
};

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

      getLmpPrerequisiteKeysForSync(item).forEach(prerequisiteKey => {
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

  const completedAt = getLmpCompletionTimestampForSync(events[highestCompletedFlyingIndex], scoreMap) || new Date().toISOString();
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
    const completedAt = getLmpCompletionTimestampForSync(masterItem, scoreMap) || getLmpRplTimestampForSync(existingItem);
    const mergedItem = {
      ...masterItem,
      ...getIndividualLmpMasterOverridesForSync(existingItem, masterItem),
      id: masterItem.id,
      masterEventId: getLmpMasterEventId(masterItem),
      lmpSource: 'master',
      completedAt,
      isComplete: Boolean(completedAt),
      completed: Boolean(completedAt),
      ...getLmpRplFieldsForSync(existingItem, completedAt),
      userLockedPosition: existingItem?.userLockedPosition,
      orderKey: existingItem?.orderKey || masterItem.orderKey || createLmpOrderKeyForSync(index),
      placementNeedsReview: false,
    };
    return existingItem?.rplGranted === true
      ? forfeitTrainingReportFollowUpForRplForSync(mergedItem)
      : mergedItem;
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

// POST /api/trainees/lmp-sync - Sync all trainees' authoritative training report records → IndividualLMP
// Body: { syllabusData?: Record<lmpType, SyllabusItemDetail[]> }
// syllabusData is OPTIONAL - server loads syllabus directly from DB for accurate backfill.
// Client-provided syllabusData is used as a fallback only if DB syllabus is empty.
app.post('/api/trainees/lmp-sync', async (req, res) => {
  try {
    const syncStartedAt = Date.now();
    const timing = [];
    const markSyncTiming = (label, details = {}) => {
      timing.push({
        label,
        elapsedMs: Date.now() - syncStartedAt,
        details,
      });
    };
    const db = await getPrisma();
    const { syllabusData: clientSyllabusData, build: buildSync = false } = req.body || {};
    markSyncTiming('db:ready');

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
        const parsed = allItems.map(normaliseSyllabusItemForRuntime);
        dbSyllabusData = groupSyllabusByConfiguredCourses(parsed);
        console.log(`[LMP Sync] Loaded syllabus from DB for ${Object.keys(dbSyllabusData).length} configured course/LMP group(s)`);
      }
    } catch (syllabusErr) {
      console.warn('[LMP Sync] Could not load syllabus from DB, falling back to client syllabusData:', syllabusErr.message);
    }

    // Use DB syllabus if available; fall back to client-provided syllabusData
    const syllabusData = (Object.keys(dbSyllabusData).length > 0) ? dbSyllabusData : (clientSyllabusData || {});
    markSyncTiming('syllabus:loaded', {
      source: Object.keys(dbSyllabusData).length > 0 ? 'database' : 'request',
      groups: Object.keys(syllabusData || {}).length,
    });

    if (!syllabusData || Object.keys(syllabusData).length === 0) {
      return res.status(400).json({ error: 'Missing syllabusData: not in request body and DB syllabus is empty' });
    }

    // Fetch all active trainees with their existing LMP. training report progress is
    // sourced exclusively from TraineePerformance below; legacy Score rows and
    // snapshot training report payloads can contain imported/stale completions and must
    // not drive LMP progression.
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      include: {
        individualLMP: true,
      },
    });
    markSyncTiming('trainees:loaded', { count: trainees.length });

    console.log(`[LMP Sync] Processing ${trainees.length} trainees...`);

    const traineePerformanceRows = await db.$queryRawUnsafe(`
      SELECT "traineeId", "traineeFullName", "flightNumber", "eventCode", "date", "updatedAt", "overallGrade", "overallResult", "dcoResult"
      FROM "TraineePerformance"
      WHERE "isCompleted" = true OR UPPER(COALESCE("dcoResult", '')) = 'DCO'
      ORDER BY "date" ASC, "updatedAt" ASC
    `);
    markSyncTiming('performance:loaded', { count: (traineePerformanceRows || []).length });
    const performanceByTraineeId = new Map();
    (traineePerformanceRows || []).forEach(row => {
      if (!row.traineeId) return;
      if (!performanceByTraineeId.has(row.traineeId)) performanceByTraineeId.set(row.traineeId, []);
      performanceByTraineeId.get(row.traineeId).push(row);
    });
    const overlayLookupStartedAt = Date.now();
    const overlaysByTraineeId = await loadActiveTraineeLmpOverlaysByTraineeId(db);
    const overlayLookupMs = Date.now() - overlayLookupStartedAt;
    let activeOverlayCount = 0;
    overlaysByTraineeId.forEach(events => { activeOverlayCount += events.length; });
    markSyncTiming('overlays:loaded', {
      activeOverlayCount,
      overlayTraineeCount: overlaysByTraineeId.size,
      overlayLookupMs,
    });

    const results = [];
    let createdLmpCount = 0;
    let updatedLmpCount = 0;
    let skippedUnchangedLmpCount = 0;
    let overlayUpsertCount = 0;
    let skippedUnchangedOverlayCount = 0;
    let overlayWriteMs = 0;
    let lmpWriteMs = 0;
    const lmpChangedSamples = [];

    for (const trainee of trainees) {
      const lmpType = String(trainee.lmpType || trainee.course || '').trim();

      const masterSyllabus = getSyllabusGroupForLmpType(syllabusData, lmpType);
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

      // Build set of completed event IDs from the authoritative training report table.
      // Do not merge legacy Score rows: they are retained for compatibility
      // views, but using them here can falsely complete an entire LMP.
      const existing = trainee.individualLMP;
      const existingEvents = Array.isArray(existing?.events) ? existing.events : [];
      const scoreMap = {};
      const performanceRows = performanceByTraineeId.get(trainee.id) || [];
      performanceRows.forEach(row => {
        if (row.traineeFullName !== trainee.fullName) return;
        const normalizedEvent = String(row.flightNumber || row.eventCode || '').replace('*', '');
        if (normalizedEvent) {
          scoreMap[normalizedEvent] = row.date ? new Date(row.date).toISOString() : new Date().toISOString();
        }
      });
      existingEvents.forEach(item => addRplCompletionToScoreMapForSync(scoreMap, item));

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
      const overlayEvents = existing ? (overlaysByTraineeId.get(trainee.id) || []) : [];
      const existingMasterEvents = existingEvents.filter(item => !isLmpOverlayItemForSync(item));
      const lmpEvents = mergeIndividualLmpWithMasterForSync([...existingMasterEvents, ...overlayEvents], masterSyllabus, scoreMap);
      const existingCompleted = existing ? (existing.completedEventIds || []) : [];
      const newlyMarked = completedEventIds.filter(id => !existingCompleted.includes(id));
      const lmpPayloadUnchanged = Boolean(existing) &&
        sameStringSetForSync(existingCompleted, completedEventIds) &&
        sameLmpEventsForSync(existingEvents, lmpEvents);

      if (buildSync && !lmpPayloadUnchanged && lmpChangedSamples.length < 8) {
        const completedEqual = sameStringSetForSync(existingCompleted, completedEventIds);
        const eventsEqual = sameLmpEventsForSync(existingEvents, lmpEvents);
        lmpChangedSamples.push({
          traineeFullName: trainee.fullName,
          lmpType,
          existingEvents: existingEvents.length,
          nextEvents: lmpEvents.length,
          completedEqual,
          eventsEqual,
          firstEventDifference: eventsEqual ? null : findFirstLmpEventDifferenceForSync(existingEvents, lmpEvents),
        });
      }

      const overlayWriteStartedAt = Date.now();
      const overlaySyncStats = { skippedUnchanged: 0 };
      overlayUpsertCount += await upsertTraineeLmpOverlays(db, trainee.id, trainee.fullName, lmpEvents, {
        deactivateMissing: false,
        existingOverlays: overlayEvents,
        stats: overlaySyncStats,
      });
      skippedUnchangedOverlayCount += overlaySyncStats.skippedUnchanged;
      overlayWriteMs += Date.now() - overlayWriteStartedAt;

      if (lmpPayloadUnchanged) {
        skippedUnchangedLmpCount += 1;
      } else {
        // Upsert the IndividualLMP only when the composed payload has changed.
        const lmpWriteStartedAt = Date.now();
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
        lmpWriteMs += Date.now() - lmpWriteStartedAt;
        if (existing) updatedLmpCount += 1;
        else createdLmpCount += 1;
      }

      const status = !existing ? 'created' : lmpPayloadUnchanged ? 'unchanged' : 'updated';
      results.push({
        traineeFullName: trainee.fullName,
        lmpType,
        totalEvents: masterSyllabus.length,
        completedCount: completedEventIds.length,
        newlyMarked,
        status,
      });

      if (!lmpPayloadUnchanged || newlyMarked.length > 0) {
        console.log(
          `[LMP Sync] ${trainee.fullName} (${lmpType}): ${completedEventIds.length}/${masterSyllabus.length} events complete` +
          (newlyMarked.length > 0 ? ` — newly marked: ${newlyMarked.join(', ')}` : '')
        );
      }
    }
    markSyncTiming('trainees:processed', {
      total: trainees.length,
      overlayUpsertCount,
      skippedUnchangedOverlayCount,
      overlayWriteMs,
      lmpWriteMs,
      buildSync,
      lmpChangedSampleCount: lmpChangedSamples.length,
    });

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const noSyllabus = results.filter(r => r.status === 'no_syllabus').length;

    console.log(`[LMP Sync] ✅ Done — ${created} created, ${updated} updated, ${unchanged} unchanged, ${noSyllabus} skipped; DB writes: ${createdLmpCount} created, ${updatedLmpCount} updated, ${skippedUnchangedLmpCount} unchanged skipped; ${activeOverlayCount} active overlay event(s) loaded in ${overlayLookupMs}ms`);
    markSyncTiming('complete', { created, updated, unchanged, noSyllabus });

    res.json({
      success: true,
      summary: {
        created,
        updated,
        unchanged,
        noSyllabus,
        total: trainees.length,
        dbWrites: {
          created: createdLmpCount,
          updated: updatedLmpCount,
          skippedUnchanged: skippedUnchangedLmpCount,
        },
        activeOverlayCount,
        overlayTraineeCount: overlaysByTraineeId.size,
        overlayLookupMs,
        overlayWrites: {
          upserted: overlayUpsertCount,
          skippedUnchanged: skippedUnchangedOverlayCount,
          writeMs: overlayWriteMs,
        },
        lmpWriteMs,
        buildSync,
        lmpChangedSamples,
        totalElapsedMs: Date.now() - syncStartedAt,
        timing,
      },
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
    const requestedReportLmpSummary = summariseTrainingReportLmpItemsForSync(events);
    await upsertTraineeLmpOverlays(db, resolvedTraineeId, traineeFullName, events, { deactivateMissing: true });

    const masterSyllabus = await loadMasterSyllabusForLmpType(db, lmpType);
    const overlayEvents = await loadTraineeLmpOverlays(db, resolvedTraineeId);
    const composedEvents = composeIndividualLmpEvents(events, masterSyllabus, overlayEvents, completedEventIds || []);
    const composedReportLmpSummary = summariseTrainingReportLmpItemsForSync(composedEvents);

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
    if (requestedReportLmpSummary.reportItemCount > 0 || composedReportLmpSummary.reportItemCount > 0) {
      console.log('[LMP PUT DIAG] training report LMP persistence', {
        traineeFullName,
        lmpType,
        requested: requestedReportLmpSummary,
        composed: composedReportLmpSummary,
      });
    }
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
      idNumber, name, fullName, rank, role, course, lmpType,
      unit, flight, location, service, seatConfig, isPaused,
      traineeCallsign, primaryInstructor, secondaryInstructor,
      phoneNumber, email, permissions, preferences, unavailability
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!isUsablePersonnelIdNumber(idNumber)) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }
    const traineeIdNumber = Number(idNumber);
    const idConflict = await findPersonnelIdNumberConflict(db, traineeIdNumber);
    if (idConflict) {
      return sendPersonnelIdConflict(res, idConflict);
    }

    // Create new trainee
    const created = await db.trainee.create({
      data: {
        idNumber: traineeIdNumber,
        name,
        fullName: fullName || name,
        rank: rank || 'FLGOFF',
        role: String(role || '').trim() ? role : 'Trainee',
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
        preferences: preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {},
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
    const seenUploadIdNumbers = new Set();
    const selectedCourse = String(course || '').trim();

    if (replaceAll && selectedCourse) {
      const uploadedCourseNames = [...new Set(
        trainees
          .map(t => String(t.uploadedCourse || t.originalCourse || '').trim())
          .filter(Boolean)
      )];
      const mismatchedUploadedCourses = uploadedCourseNames.filter(uploadedCourse => uploadedCourse !== selectedCourse);
      if (mismatchedUploadedCourses.length > 0) {
        return res.status(409).json({
          error: 'Uploaded course does not match selected course',
          message: `This file contains trainee rows for ${mismatchedUploadedCourses.join(', ')}, but the selected replacement course is ${selectedCourse}. The upload was stopped so trainees are not moved into the wrong course.`,
          details: [
            `Selected course: ${selectedCourse}`,
            `Course values found in uploaded rows: ${uploadedCourseNames.join(', ') || 'none'}`,
            'Open the correct spreadsheet or select the course shown in the file before replacing course data.',
          ],
        });
      }
    }

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
        if (!t.name || !isUsablePersonnelIdNumber(t.idNumber)) {
          skippedCount++;
          results.push({
            idNumber: t.idNumber,
            name: t.name,
            action: 'skipped',
            error: !t.name ? 'Name is required' : 'Personnel ID is required',
          });
          continue;
        }

        const idNum = Number(t.idNumber);
        if (seenUploadIdNumbers.has(idNum)) {
          skippedCount++;
          results.push({
            idNumber: t.idNumber,
            name: t.name,
            action: 'skipped',
            error: 'Duplicate Personnel ID in upload',
          });
          continue;
        }
        seenUploadIdNumbers.add(idNum);

        // Look for existing trainee by idNumber in this course (or any course if no course filter)
        const whereClause = course 
          ? { idNumber: idNum }
          : { idNumber: idNum };
        
        const existing = await db.trainee.findFirst({ where: whereClause });
        const idConflict = await findPersonnelIdNumberConflict(db, idNum, existing ? { excludeTraineeId: existing.id } : {});
        if (idConflict) {
          skippedCount++;
          const conflictName = idConflict.record?.fullName || idConflict.record?.name || 'another person';
          results.push({
            idNumber: t.idNumber,
            name: t.name,
            action: 'skipped',
            error: `Personnel ID is already assigned to ${conflictName}`,
          });
          continue;
        }

        const traineeData = {
          name: t.name,
          fullName: t.fullName || t.name,
          rank: t.rank || 'FLGOFF',
          role: String(t.role || '').trim() ? t.role : (existing?.role || 'Trainee'),
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
          preferences: t.preferences && typeof t.preferences === 'object' && !Array.isArray(t.preferences) ? t.preferences : (existing?.preferences || {}),
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
      'idNumber', 'name', 'fullName', 'rank', 'role', 'service', 'course', 'lmpType', 'traineeCallsign',
      'seatConfig', 'isPaused', 'unavailability', 'unit', 'flight', 'location',
      'phoneNumber', 'email', 'primaryInstructor', 'secondaryInstructor',
      'lastEventDate', 'lastFlightDate', 'currencyStatus', 'permissions',
      'priorExperience', 'preferences', 'isActive', 'photoUrl', 'userId'
    ];
    const sanitizedUpdates = {};
    for (const field of TRAINEE_FIELDS) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }
    if ('idNumber' in sanitizedUpdates) {
      if (!isUsablePersonnelIdNumber(sanitizedUpdates.idNumber)) {
        return res.status(400).json({ error: 'Personnel ID is required' });
      }
      sanitizedUpdates.idNumber = Number(sanitizedUpdates.idNumber);
      const idConflict = await findPersonnelIdNumberConflict(db, sanitizedUpdates.idNumber, { excludeTraineeId: existing.id });
      if (idConflict) {
        return sendPersonnelIdConflict(res, idConflict);
      }
    }

    const updated = await db.$transaction(async (tx) => {
      if ('email' in sanitizedUpdates && existing.userId) {
        await syncLinkedPersonLoginEmail(tx, existing, sanitizedUpdates.email);
      }
      return tx.trainee.update({
        where: { id },
        data: sanitizedUpdates
      });
    });

    console.log(`✅ PATCH /api/trainees/${id} - updated: ${updated.name}`);
    res.json({ success: true, trainee: updated });
  } catch (error) {
    console.error('❌ PATCH /api/trainees error:', error);
    const status = error.status || 500;
    const fallbackMessage = status === 409 ? 'Account conflict' : 'Failed to update trainee';
    res.status(status).json({
      error: fallbackMessage,
      message: error.message || fallbackMessage,
      details: error.message,
    });
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
          instructor: instructor || '',
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// POST /api/cleanup-duplicate-personnel - legacy one-off maintenance endpoint
app.post('/api/cleanup-duplicate-personnel', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use the authenticated user and personnel management tools instead.',
  });
});

// POST /api/merge-burns-accounts - legacy one-off maintenance endpoint
app.post('/api/merge-burns-accounts', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy maintenance endpoint disabled',
    message: 'Use the authenticated user and personnel management tools instead.',
  });
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// GET /api/admin/fix-academics-courses - Manually trigger the Academics courses[] migration.
app.get('/api/admin/fix-academics-courses', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (rejectDisabledDebugRoute(res)) return;
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

const BULK_UPLOAD_REQUIRED_COLUMNS = [
  'Event description',
  'Type',
];

const SYLLABUS_COURSE_SHELL_NOTE = '[DFP_COURSE_SHELL]';

const BULK_UPLOAD_TYPE_LABELS = new Set([
  'flight',
  'flying',
  'ftd',
  'sim',
  'simulator',
  'academics',
  'academic',
  'ground',
  'ground school',
  'cpt',
  'tut',
  'tutorial',
  'brief',
  'mass brief',
]);

function getUploadValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }

  const normalisedAliases = aliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const key = Object.keys(row).find(candidate =>
    normalisedAliases.includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  return key ? row[key] : undefined;
}

function getUploadString(row, aliases) {
  const value = getUploadValue(row, aliases);
  return value === undefined || value === null ? '' : String(value).trim();
}

function getUploadNumber(row, aliases) {
  const value = getUploadValue(row, aliases);
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function getUploadList(row, aliases) {
  const value = getUploadValue(row, aliases);
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|;/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normaliseUploadType(value) {
  const cleanValue = String(value || '').trim().toLowerCase();
  if (cleanValue === 'flight' || cleanValue === 'flying') return 'Flight';
  if (cleanValue === 'ftd' || cleanValue === 'sim' || cleanValue === 'simulator') return 'FTD';
  if (cleanValue === 'academics' || cleanValue === 'academic') return 'Academics';
  if (cleanValue === 'ground' || cleanValue === 'ground school' || cleanValue === 'cpt' || cleanValue === 'tut' || cleanValue === 'tutorial' || cleanValue === 'brief' || cleanValue === 'mass brief') return 'Ground School';
  return value || 'Ground School';
}

function getRequiredUploadDataErrors(row) {
  const errors = [];
  const missingColumns = BULK_UPLOAD_REQUIRED_COLUMNS.filter(column => !getUploadString(row, [column]));
  if (missingColumns.length > 0) errors.push(`Missing required fields: ${missingColumns.join(', ')}`);

  const typeValue = getUploadString(row, ['Type']);
  if (typeValue && !BULK_UPLOAD_TYPE_LABELS.has(typeValue.trim().toLowerCase())) {
    errors.push('Type must be one of: Flight, FTD, Academics, Ground School, CPT');
  }

  const flightOrSimHours = getUploadNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
  const totalEventHours = getUploadNumber(row, ['Total Event Hours', 'totalEventHours']);
  const duration = flightOrSimHours ?? totalEventHours;
  if (!(Number.isFinite(duration) && Number(duration) > 0)) {
    errors.push('Missing required duration: enter a positive value in Flight or Sim Hours or Total Event Hours');
  }

  return errors;
}

function normaliseUploadDayNight(value) {
  const cleanValue = String(value || '').trim().toLowerCase();
  if (cleanValue === 'night') return 'Night';
  if (cleanValue === 'day/night' || cleanValue === 'day night' || cleanValue === 'daynight') return 'Day/Night';
  return 'Day';
}

function normaliseUploadSortieType(value) {
  const cleanValue = String(value || '').trim().toLowerCase();
  if (cleanValue === 'solo') return 'Solo';
  if (cleanValue === 'dual') return 'Dual';
  return null;
}

function normaliseUploadAircraftConfigs(value) {
  const configs = String(value || '')
    .split(/\r?\n|;|,/)
    .map(config => config.trim().toUpperCase())
    .filter(Boolean)
    .map(config => config === 'ANY' ? 'ANY' : `CONFIG-${config.replace(/^CONFIG\s*/, '').replace(/^CONFIG[-_]/, '').replace(/^C\s*/, '')}`);
  return configs.length > 0 ? Array.from(new Set(configs)) : ['ANY'];
}

function normaliseUploadLmpType(value) {
  return value === 'Staff CAT' ? 'Staff CAT' : 'Master LMP';
}

function getGeneratedUploadCode(courseCode, sequence) {
  const prefix = String(courseCode || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || 'PKG';
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}

function getUploadPackageCodeFromTitle(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.length === 1
    ? words[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    : words.map(word => word[0].toUpperCase()).join('').replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function getUnitScopedUploadCollectionCode(baseCode, unitCode) {
  const cleanBase = String(baseCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanUnit = String(unitCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleanBase) return '';
  if (!cleanUnit || cleanBase === cleanUnit || cleanBase.startsWith(`${cleanUnit}-`)) return cleanBase;
  return `${cleanUnit}-${cleanBase}`.slice(0, 24);
}

function uploadRowHasContent(row) {
  return Object.values(row).some(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function normaliseUploadContextCode(value) {
  return String(value || '').trim().toUpperCase();
}

function uploadStaffCatItemMatchesContext(item, operationalModel, locationCode, unitCode) {
  if (normaliseUploadLmpType(item?.lmpType) !== 'Staff CAT') return true;
  const model = normaliseUploadContextCode(operationalModel);
  const itemLocation = normaliseUploadContextCode(item?.location);
  const itemUnit = normaliseUploadContextCode(item?.unit);
  const targetLocation = normaliseUploadContextCode(locationCode);
  const targetUnit = normaliseUploadContextCode(unitCode);
  if (model === 'FIXED_CREW') {
    return Boolean(targetUnit) && itemUnit === targetUnit && (!targetLocation || !itemLocation || itemLocation === targetLocation);
  }
  if (model === 'AIR_COMBAT') {
    return (!targetUnit || !itemUnit || itemUnit === targetUnit) && (!targetLocation || !itemLocation || itemLocation === targetLocation);
  }
  return true;
}

function uploadItemBelongsToDestination(item, courseCode, lmpType, operationalModel = '', locationCode = '', unitCode = '') {
  const courses = Array.isArray(item?.courses) ? item.courses : [];
  return normaliseUploadLmpType(item?.lmpType) === lmpType
    && courses.includes(courseCode)
    && (lmpType !== 'Staff CAT' || uploadStaffCatItemMatchesContext(item, operationalModel, locationCode, unitCode));
}

function isUploadCourseShellRow(item) {
  return String(item?.notes || '').includes(SYLLABUS_COURSE_SHELL_NOTE);
}

function getUploadDuplicateSourceDetails(item) {
  const sourceCourses = Array.isArray(item?.courses) ? item.courses.filter(Boolean) : [];
  return {
    code: item?.code || '',
    sourceCourses,
    sourceCourse: sourceCourses[0] || '',
    sourceUnit: normaliseUploadContextCode(item?.unit),
    sourceLocation: normaliseUploadContextCode(item?.location),
    sourceLmpType: normaliseUploadLmpType(item?.lmpType),
    sourceTitle: String(item?.module || item?.phase || '').trim(),
  };
}

// POST /api/syllabus/bulk-upload - Import/update syllabus events from workbook
app.post('/api/syllabus/bulk-upload', uploadRateLimit, handleSingleSpreadsheetUpload, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const { randomUUID } = await import('crypto');
    let selectedCourseCode = String(req.body?.courseCode || '').trim();
    const packageName = String(req.body?.packageName || '').trim();
    const uploadMode = String(req.body?.uploadMode || 'update').trim();
    const lmpType = normaliseUploadLmpType(String(req.body?.lmpType || 'Master LMP').trim());
    const operationalModel = String(req.body?.operationalModel || '').trim();
    const locationCode = String(req.body?.locationCode || req.body?.location || '').trim();
    const unitCode = String(req.body?.unitCode || req.body?.unit || '').trim();
    if (!selectedCourseCode && lmpType === 'Staff CAT' && uploadMode === 'create') {
      selectedCourseCode = getUnitScopedUploadCollectionCode(getUploadPackageCodeFromTitle(packageName), unitCode);
    }

    if (!selectedCourseCode) {
      return res.status(400).json({ error: 'No destination course/package selected' });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No upload file supplied' });
    }

    const fileValidationError = validateSpreadsheetUploadFile(req.file);
    if (fileValidationError) {
      await writeSecurityAuditEvent(db, req, 'WORKBOOK_REJECTED', 'warning', 'Syllabus workbook upload was rejected', {
        fileName: req.file.originalname || '',
        fileSize: req.file.size || req.file.buffer?.length || 0,
        reason: fileValidationError,
        selectedCourseCode,
        unitCode,
        locationCode,
      });
      return res.status(415).json({ error: 'Upload rejected', message: fileValidationError });
    }

    const threatIndicatorError = validateSpreadsheetThreatIndicators(req.file);
    if (threatIndicatorError) {
      await writeSecurityAuditEvent(db, req, 'WORKBOOK_REJECTED', 'critical', 'Syllabus workbook upload was rejected for unsafe content', {
        fileName: req.file.originalname || '',
        fileSize: req.file.size || req.file.buffer?.length || 0,
        reason: threatIndicatorError,
        selectedCourseCode,
        unitCode,
        locationCode,
      });
      return res.status(415).json({ error: 'Upload rejected', message: threatIndicatorError });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
    });
    const workbookShapeError = validateWorkbookShape(workbook);
    if (workbookShapeError) {
      await writeSecurityAuditEvent(db, req, 'WORKBOOK_REJECTED', 'warning', 'Syllabus workbook upload was rejected for workbook size or structure', {
        fileName: req.file.originalname || '',
        fileSize: req.file.size || req.file.buffer?.length || 0,
        reason: workbookShapeError,
        selectedCourseCode,
        unitCode,
        locationCode,
      });
      return res.status(400).json({ error: 'Upload rejected', message: workbookShapeError });
    }
    const worksheetName = workbook.SheetNames.includes('Syllabus_LMP')
      ? 'Syllabus_LMP'
      : workbook.SheetNames[0];

    if (!worksheetName) {
      return res.status(400).json({ error: 'The upload file does not contain any worksheets' });
    }

    const worksheet = workbook.Sheets[worksheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    await writeSecurityAuditEvent(db, req, 'WORKBOOK_ACCEPTED', 'info', 'Syllabus workbook upload passed security checks', {
      fileName: req.file.originalname || '',
      fileSize: req.file.size || req.file.buffer?.length || 0,
      worksheetName,
      rowCount: rows.length,
      selectedCourseCode,
      uploadMode,
      lmpType,
      unitCode,
      locationCode,
    });
    const created = [];
    const updated = [];
    const errors = [];
    let skipped = 0;
    let generatedCodeSequence = 1;
    let generatedPlaceholderUsed = false;

    if (uploadMode === 'replace') {
      const preflightErrors = [];
      let preflightSequence = 1;
      let contentRows = 0;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 2;
        if (!uploadRowHasContent(row)) continue;
        contentRows += 1;

        const requiredDataErrors = getRequiredUploadDataErrors(row);
        if (requiredDataErrors.length > 0) {
          requiredDataErrors.forEach(error => preflightErrors.push({ row: rowNumber, error }));
          continue;
        }

        const courseFromRow = getUploadString(row, ['Course', 'Package']);
        const courseCode = selectedCourseCode || courseFromRow;
        if (!courseCode) {
          preflightErrors.push({ row: rowNumber, error: 'Missing selected course/package code' });
          continue;
        }

        const explicitCode = getUploadString(row, ['Code']);
        const code = explicitCode || getGeneratedUploadCode(courseCode, preflightSequence++);
        const existing = (await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "code" = $1 LIMIT 1`, code))[0];
        if (existing && !uploadItemBelongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          preflightErrors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
            duplicateSource: getUploadDuplicateSourceDetails(existing),
          });
        }
      }

      if (contentRows === 0) {
        preflightErrors.push({ row: 1, error: 'The upload file does not contain any event rows' });
      }

      if (preflightErrors.length > 0) {
        return res.status(400).json({
          created: 0,
          updated: 0,
          skipped: preflightErrors.length,
          errors: preflightErrors,
          message: 'Replace cancelled. Fix the upload errors and try again.',
        });
      }
    }

    if (lmpType === 'Staff CAT' && uploadMode === 'create') {
      const fixedCrewUnitFilter = normaliseUploadContextCode(operationalModel) === 'FIXED_CREW' && unitCode
        ? ` AND "unit" = $3`
        : '';
      const existingPackageParams = fixedCrewUnitFilter
        ? [lmpType, selectedCourseCode, unitCode]
        : [lmpType, selectedCourseCode];
      const existingPackageRows = await db.$queryRawUnsafe(
        `SELECT "id" FROM "SyllabusItem" WHERE "lmpType" = $1 AND "isActive" = true AND $2 = ANY("courses")${fixedCrewUnitFilter} LIMIT 1`,
        ...existingPackageParams
      );
      if (existingPackageRows.length > 0) {
        return res.status(409).json({ error: `Training package "${selectedCourseCode}" already exists. Select it and use update or replace.` });
      }
    }

    if (lmpType === 'Staff CAT' && uploadMode === 'replace') {
      const fixedCrewUnitFilter = normaliseUploadContextCode(operationalModel) === 'FIXED_CREW' && unitCode
        ? ` AND "unit" = $3`
        : '';
      const replaceParams = fixedCrewUnitFilter
        ? [lmpType, selectedCourseCode, unitCode]
        : [lmpType, selectedCourseCode];
      await db.$executeRawUnsafe(
        `DELETE FROM "SyllabusItem" WHERE "lmpType" = $1 AND $2 = ANY("courses")${fixedCrewUnitFilter}`,
        ...replaceParams
      );
    }

    const maxOrderRows = await db.$queryRawUnsafe(`SELECT COALESCE(MAX("sortOrder"), 0)::int AS "maxSortOrder" FROM "SyllabusItem"`);
    let nextSortOrder = Number(maxOrderRows?.[0]?.maxSortOrder || 0) + 1;

    const reusablePackagePlaceholder = selectedCourseCode && lmpType === 'Staff CAT' && uploadMode !== 'replace'
      ? await (() => {
          const fixedCrewUnitFilter = normaliseUploadContextCode(operationalModel) === 'FIXED_CREW' && unitCode
            ? ` AND "unit" = $3`
            : '';
          const placeholderParams = fixedCrewUnitFilter
            ? [selectedCourseCode, lmpType, unitCode]
            : [selectedCourseCode, lmpType];
          return db.$queryRawUnsafe(
            `SELECT * FROM "SyllabusItem" WHERE "code" = $1 AND "lmpType" = $2 AND "isActive" = true AND $1 = ANY("courses")${fixedCrewUnitFilter} LIMIT 1`,
            ...placeholderParams
          ).then(rows => rows[0]);
        })()
      : null;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;
      if (!uploadRowHasContent(row)) continue;

      const requiredDataErrors = getRequiredUploadDataErrors(row);
      if (requiredDataErrors.length > 0) {
        requiredDataErrors.forEach(error => errors.push({ row: rowNumber, error }));
        skipped += 1;
        continue;
      }

      const courseFromRow = getUploadString(row, ['Course', 'Package']);
      const courseCode = selectedCourseCode || courseFromRow;
      if (!courseCode) {
        errors.push({ row: rowNumber, error: 'Missing selected course/package code' });
        skipped += 1;
        continue;
      }

      const explicitCode = getUploadString(row, ['Code']);
      const code = explicitCode || getGeneratedUploadCode(courseCode, generatedCodeSequence++);
      const type = normaliseUploadType(getUploadString(row, ['Type']));
      const sortieType = type === 'Flight' ? normaliseUploadSortieType(getUploadString(row, ['Dual/Solo', 'sortieType'])) : null;
      const flightOrSimHours = getUploadNumber(row, ['Flight or Sim Hours', 'flightOrSimHours']);
      const totalEventHours = getUploadNumber(row, ['Total Event Hours', 'totalEventHours']) ?? 0;
      const itemData = normaliseSyllabusItemForRuntime({
        code,
        eventDescription: getUploadString(row, ['Event description', 'eventDescription']),
        phase: getUploadString(row, ['Phase']) || courseCode,
        module: getUploadString(row, ['Module']) || packageName || courseCode,
        type,
        sortieType,
        dayNight: normaliseUploadDayNight(getUploadString(row, ['Day/Night', 'dayNight'])),
        courses: [courseCode],
        methodOfDelivery: getUploadList(row, ['Method/s of Delivery', 'methodOfDelivery']),
        methodOfAssessment: getUploadList(row, ['Method/s of Assessment', 'Type/s and Method/s of Assessment', 'methodOfAssessment']),
        resourcesPhysical: getUploadList(row, ['Resources Required (physical)', 'resourcesPhysical']),
        resourceNumber: Math.max(0, Math.round(getUploadNumber(row, ['Resource Number', 'resourceNumber', 'Resources Required Number']) ?? 0)),
        acceptableAircraftConfigs: normaliseUploadAircraftConfigs(getUploadString(row, ['CONFIG', 'Config', 'Acceptable CONFIG', 'Acceptable Aircraft CONFIG', 'acceptableAircraftConfigs'])),
        resourcesHuman: getUploadList(row, ['Resources Required (Human)', 'resourcesHuman']),
        eventDetailsCommon: getUploadList(row, ['Event Details - Common', 'eventDetailsCommon']),
        eventDetailsSortie: getUploadList(row, ['Event Details - Sortie', 'eventDetailsSortie']),
        flightOrSimHours: flightOrSimHours ?? 0,
        totalEventHours,
        duration: flightOrSimHours ?? totalEventHours,
        preFlightTime: getUploadNumber(row, ['Pre-flight', 'preFlightTime']) ?? 0,
        postFlightTime: getUploadNumber(row, ['Post-flight', 'postFlightTime']) ?? 0,
        prerequisites: getUploadList(row, ['prerequisites', 'Prerequisites']),
        prerequisitesGround: getUploadList(row, ['Pre-requisite Events (Ground School)', 'prerequisitesGround']),
        prerequisitesFlying: getUploadList(row, ['Pre-requisite Events (Sim/Flying)', 'prerequisitesFlying']),
        location: locationCode,
        unit: unitCode,
        lmpType,
        isActive: true,
      });

      const existing = (await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "code" = $1 LIMIT 1`, code))[0];
      if (existing) {
        if (!uploadItemBelongsToDestination(existing, courseCode, lmpType, operationalModel, locationCode, unitCode)) {
          errors.push({
            row: rowNumber,
            error: `Event code "${code}" already exists outside selected ${lmpType === 'Staff CAT' ? 'training package' : 'Master LMP'}`,
            duplicateSource: getUploadDuplicateSourceDetails(existing),
          });
          skipped += 1;
          continue;
        }

        await db.$executeRawUnsafe(`
          UPDATE "SyllabusItem"
          SET "code" = $2, "eventDescription" = $3, "phase" = $4, "module" = $5, "type" = $6,
              "sortieType" = $7, "dayNight" = $8, "courses" = $9::text[],
              "methodOfDelivery" = $10::text[], "methodOfAssessment" = $11::text[],
              "resourcesPhysical" = $12::text[], "resourceNumber" = $13::integer,
              "acceptableAircraftConfigs" = $14::text[], "resourcesHuman" = $15::text[],
              "eventDetailsCommon" = $16::text[], "eventDetailsSortie" = $17::text[],
              "flightOrSimHours" = $18, "totalEventHours" = $19, "duration" = $20,
              "preFlightTime" = $21, "postFlightTime" = $22,
              "prerequisites" = $23::text[], "prerequisitesGround" = $24::text[],
              "prerequisitesFlying" = $25::text[], "location" = $26, "unit" = $27, "lmpType" = $28,
              "isActive" = $29::boolean, "notes" = $30, "assessmentRequired" = $31::boolean,
              "version" = "version" + 1, "updatedAt" = NOW()
          WHERE "id" = $1
        `,
          existing.id, itemData.code, itemData.eventDescription, itemData.phase, itemData.module, itemData.type,
          itemData.sortieType, itemData.dayNight, itemData.courses, itemData.methodOfDelivery, itemData.methodOfAssessment,
          itemData.resourcesPhysical, itemData.resourceNumber, itemData.acceptableAircraftConfigs, itemData.resourcesHuman,
          itemData.eventDetailsCommon, itemData.eventDetailsSortie, itemData.flightOrSimHours, itemData.totalEventHours,
          itemData.duration, itemData.preFlightTime, itemData.postFlightTime, itemData.prerequisites,
          itemData.prerequisitesGround, itemData.prerequisitesFlying, itemData.location, itemData.unit, itemData.lmpType, itemData.isActive,
          isUploadCourseShellRow(existing) ? null : existing.notes, itemData.assessmentRequired === true
        );
        updated.push({ code });
        continue;
      }

      if (!explicitCode && reusablePackagePlaceholder && !generatedPlaceholderUsed) {
        await db.$executeRawUnsafe(`
          UPDATE "SyllabusItem"
          SET "code" = $2, "eventDescription" = $3, "phase" = $4, "module" = $5, "type" = $6,
              "sortieType" = $7, "dayNight" = $8, "courses" = $9::text[],
              "methodOfDelivery" = $10::text[], "methodOfAssessment" = $11::text[],
              "resourcesPhysical" = $12::text[], "resourceNumber" = $13::integer,
              "acceptableAircraftConfigs" = $14::text[], "resourcesHuman" = $15::text[],
              "eventDetailsCommon" = $16::text[], "eventDetailsSortie" = $17::text[],
              "flightOrSimHours" = $18, "totalEventHours" = $19, "duration" = $20,
              "preFlightTime" = $21, "postFlightTime" = $22,
              "prerequisites" = $23::text[], "prerequisitesGround" = $24::text[],
              "prerequisitesFlying" = $25::text[], "location" = $26, "unit" = $27, "lmpType" = $28,
              "isActive" = $29::boolean, "notes" = $30, "assessmentRequired" = $31::boolean,
              "version" = "version" + 1, "updatedAt" = NOW()
          WHERE "id" = $1
        `,
          reusablePackagePlaceholder.id, itemData.code, itemData.eventDescription, itemData.phase, itemData.module, itemData.type,
          itemData.sortieType, itemData.dayNight, itemData.courses, itemData.methodOfDelivery, itemData.methodOfAssessment,
          itemData.resourcesPhysical, itemData.resourceNumber, itemData.acceptableAircraftConfigs, itemData.resourcesHuman,
          itemData.eventDetailsCommon, itemData.eventDetailsSortie, itemData.flightOrSimHours, itemData.totalEventHours,
          itemData.duration, itemData.preFlightTime, itemData.postFlightTime, itemData.prerequisites,
          itemData.prerequisitesGround, itemData.prerequisitesFlying, itemData.location, itemData.unit, itemData.lmpType, itemData.isActive,
          isUploadCourseShellRow(reusablePackagePlaceholder) ? null : reusablePackagePlaceholder.notes, itemData.assessmentRequired === true
        );
        generatedPlaceholderUsed = true;
        updated.push({ code });
        continue;
      }

      const id = randomUUID();
      await db.$executeRawUnsafe(`
        INSERT INTO "SyllabusItem" (
          "id","code","eventDescription","phase","module","type","sortieType","dayNight",
          "courses","methodOfDelivery","methodOfAssessment","resourcesPhysical","resourceNumber",
          "acceptableAircraftConfigs","resourcesHuman","eventDetailsCommon","eventDetailsSortie",
          "flightOrSimHours","totalEventHours","duration","preFlightTime","postFlightTime",
          "prerequisites","prerequisitesGround","prerequisitesFlying","location","unit","sortOrder","lmpType",
          "assessmentRequired","isActive","version","createdBy","createdAt","updatedAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,
          $14,$15,$16,$17,
          $18,$19,$20,$21,$22,
          $23,$24,$25,$26,$27,$28,$29,
          $30,$31,$32,$33,NOW(),NOW()
        )
      `,
        id, itemData.code, itemData.eventDescription, itemData.phase, itemData.module, itemData.type,
        itemData.sortieType, itemData.dayNight, itemData.courses, itemData.methodOfDelivery,
        itemData.methodOfAssessment, itemData.resourcesPhysical, itemData.resourceNumber,
        itemData.acceptableAircraftConfigs, itemData.resourcesHuman, itemData.eventDetailsCommon,
        itemData.eventDetailsSortie, itemData.flightOrSimHours, itemData.totalEventHours,
        itemData.duration, itemData.preFlightTime, itemData.postFlightTime, itemData.prerequisites,
        itemData.prerequisitesGround, itemData.prerequisitesFlying, itemData.location, itemData.unit, nextSortOrder++,
        itemData.lmpType, itemData.assessmentRequired === true, itemData.isActive, 1, 'bulk-upload'
      );
      created.push({ code });
    }

    res.json({
      created: created.length,
      updated: updated.length,
      imported: created.length + updated.length,
      skipped,
      errors,
      message: `${created.length + updated.length} row${created.length + updated.length === 1 ? '' : 's'} imported into ${lmpType === 'Staff CAT' ? 'Training Package' : 'Master LMP'} ${packageName || selectedCourseCode || ''}`.trim(),
    });
  } catch (error) {
    console.error('❌ POST /api/syllabus/bulk-upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk upload syllabus events', details: error.message });
  }
});

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

    const items = (await db.$queryRawUnsafe(query, ...params)).map(normaliseSyllabusItemForRuntime);
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
    res.json({ item: normaliseSyllabusItemForRuntime(rows[0]) });
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    const itemData = normaliseSyllabusItemForRuntime({
      ...body,
      code: finalCode,
      courses: finalCourses,
      lmpType: body.lmpType || null,
    });
    finalCourses = itemData.courses;
    if (itemData.testEventType !== 'NONE' && !itemData.testingOfficerQualificationId) {
      return res.status(400).json({
        error: 'Testing Officer qualification required',
        message: 'A Flight Test or Simulator Test cannot be saved until one Testing Officer qualification is selected.',
      });
    }

    await db.$executeRawUnsafe(`
      INSERT INTO "SyllabusItem" (
        "id","code","eventDescription","phase","module","type","sortieType","dayNight",
        "courses","methodOfDelivery","methodOfAssessment","resourcesPhysical","resourceNumber","acceptableAircraftConfigs","assessedElements","assessmentRequired","testEventType","testingOfficerQualificationId","useTestingOfficerSecondaryCallsign","resourcesHuman",
        "eventDetailsCommon","eventDetailsSortie","flightOrSimHours","totalEventHours","duration",
        "preFlightTime","postFlightTime","prerequisites","prerequisitesGround","prerequisitesFlying",
        "location","unit","sortOrder","lmpType","twrDiReqd","cctOnly","isRemedial","isActive","version",
        "notes","createdBy","createdAt","updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,
        $40,$41,NOW(),NOW()
      )`,
      id, finalCode, itemData.eventDescription, itemData.phase, itemData.module, itemData.type,
      itemData.sortieType || null, itemData.dayNight || 'Day',
      finalCourses, itemData.methodOfDelivery || [], itemData.methodOfAssessment || [],
      itemData.resourcesPhysical || [], Math.max(0, Math.round(Number(itemData.resourceNumber ?? (itemData.resourcesPhysical?.length ? 1 : 0)) || 0)),
      Array.isArray(itemData.acceptableAircraftConfigs) && itemData.acceptableAircraftConfigs.length ? itemData.acceptableAircraftConfigs : ['ANY'],
      Array.isArray(itemData.assessedElements) ? itemData.assessedElements : [],
      itemData.assessmentRequired === true,
      itemData.testEventType,
      itemData.testingOfficerQualificationId,
      itemData.useTestingOfficerSecondaryCallsign === true,
      itemData.resourcesHuman || [],
      itemData.eventDetailsCommon || [], itemData.eventDetailsSortie || [],
      itemData.flightOrSimHours || 0, itemData.totalEventHours || 1, itemData.duration || 1,
      itemData.preFlightTime || 0, itemData.postFlightTime || 0,
      itemData.prerequisites || [], itemData.prerequisitesGround || [], itemData.prerequisitesFlying || [],
      itemData.location || null, itemData.unit || null, itemData.sortOrder || 0,
      itemData.lmpType || null, itemData.twrDiReqd || null, itemData.cctOnly || null,
      itemData.isRemedial || false, true, 1,
      itemData.notes || null, itemData.createdBy || null
    );

    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "id" = $1`, id);
    const syllabusItem = rows[0] ? normaliseSyllabusItemForRuntime({ ...rows[0], id: rows[0].code || rows[0].id }) : null;
    if (finalCode !== baseCode) {
      console.log(`✅ POST /api/syllabus - created: ${finalCode} (requested: ${baseCode}, was duplicate)`);
    } else {
      console.log(`✅ POST /api/syllabus - created: ${finalCode}`);
    }
    res.json({ success: true, syllabusItem, item: normaliseSyllabusItemForRuntime(rows[0]) });
  } catch (error) {
    console.error('❌ POST /api/syllabus error:', error);
    res.status(500).json({ error: error.message || 'Failed to create syllabus item', details: error.message });
  }
});

// PUT /api/syllabus/:id - Update a syllabus item
app.put('/api/syllabus/:id', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const { id } = req.params;
    const originalBody = req.body || {};
    const existingRows = await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "id" = $1 OR "code" = $1 LIMIT 1`, id);
    const body = normaliseSyllabusItemForRuntime({
      ...(existingRows[0] || {}),
      ...originalBody,
      courses: originalBody.courses ?? existingRows[0]?.courses,
      lmpType: originalBody.lmpType ?? existingRows[0]?.lmpType,
    });
    if (body.testEventType !== 'NONE' && !body.testingOfficerQualificationId) {
      return res.status(400).json({
        error: 'Testing Officer qualification required',
        message: 'A Flight Test or Simulator Test cannot be saved until one Testing Officer qualification is selected.',
      });
    }

    // Exclude server-managed fields, timestamps, and non-column metadata fields sent from frontend
    const EXCLUDED_FIELDS = ['id', 'createdAt', 'createdBy', 'updatedAt', 'version', 'changeReason'];
    const timingFields = body.lmpType === 'Staff CAT' && normaliseSyllabusCourses(body.courses)
      .some(course => String(course || '').trim().toUpperCase() === INTEGRATED_COMBAT_OPERATIONS_PACKAGE_CODE)
      ? ['preFlightTime', 'postFlightTime']
      : [];
    const durationFields = Object.prototype.hasOwnProperty.call(originalBody, 'flightOrSimHours') ||
      Object.prototype.hasOwnProperty.call(originalBody, 'totalEventHours')
      ? ['duration']
      : [];
    const fields = [...new Set([...Object.keys(originalBody), ...timingFields, ...durationFields])].filter(k => !EXCLUDED_FIELDS.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Build SET clauses, casting array fields and boolean fields properly
    const ARRAY_FIELDS = ['courses','methodOfDelivery','methodOfAssessment','resourcesPhysical','acceptableAircraftConfigs','assessedElements','resourcesHuman',
                          'eventDetailsCommon','eventDetailsSortie','prerequisites','prerequisitesGround','prerequisitesFlying'];
    const BOOL_FIELDS = ['isActive','isRemedial','assessmentRequired','useTestingOfficerSecondaryCallsign'];
    const INT_FIELDS = ['resourceNumber', 'sortOrder'];

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
      if (f === 'assessedElements') {
        return Array.isArray(body[f]) ? body[f] : [];
      }
      return body[f];
    });

    await db.$executeRawUnsafe(
      `UPDATE "SyllabusItem" SET ${setClauses}, "version" = "version" + 1, "updatedAt" = NOW() WHERE "id" = $1 OR "code" = $1`,
      id, ...values
    );

    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SyllabusItem" WHERE "id" = $1 OR "code" = $1`, id);
    const syllabusItem = rows[0] ? normaliseSyllabusItemForRuntime({ ...rows[0], id: rows[0].code || rows[0].id }) : null;
    console.log(`✅ PUT /api/syllabus/${id}`);
    res.json({ success: true, syllabusItem, item: normaliseSyllabusItemForRuntime(rows[0]) });
  } catch (error) {
    console.error('❌ PUT /api/syllabus/:id error:', error);
    res.status(500).json({ error: error.message || 'Failed to update syllabus item', details: error.message });
  }
});

// DELETE /api/syllabus/:id - Hard delete a syllabus item (permanently removes from DB)
app.delete('/api/syllabus/:id', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
app.post('/api/auth/verify-password', authRateLimit, async (req, res) => {
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
app.post('/api/auth/direct-login', authRateLimit, async (req, res) => {
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
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", password,
              "mustChangePassword", "activationCodeHash", "activationCodeExpiresAt", "activationCodeUsedAt",
              "activationAttemptCount", "activationLockedUntil"
       FROM "User"
       WHERE "userId" = $1 OR username = $1
       LIMIT 1`,
      loginUserId
    );

    if (!users || users.length === 0 || !users[0].password) {
      const diagnostic = buildActivationLoginDiagnostic({ loginUserId, password, user: null });
      await writeSecurityAuditEvent(db, req, 'LOGIN_FAILED', 'warning', 'Direct login failed', {
        reason: 'invalid_credentials',
        suppliedUserId: String(loginUserId || '').slice(0, 120),
        diagnostic,
      });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid User ID or password',
        diagnostic,
      });
    }

    const user = users[0];
    if (!user.isActive) {
      await writeSecurityAuditEvent(db, req, 'LOGIN_BLOCKED', 'warning', 'Direct login blocked for inactive account', {
        reason: 'account_inactive',
        suppliedUserId: String(loginUserId || '').slice(0, 120),
        userId: user.userId || user.username || user.id,
      });
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated',
      });
    }

    const bcrypt = require('bcryptjs');
    let validPassword = false;
    let usedActivationCredential = false;
    let activationCredentialExpectedLength = null;
    if (user.mustChangePassword && user.activationCodeHash) {
      const cleanLoginUserId = normalisePersonnelId(loginUserId);
      activationCredentialExpectedLength = cleanLoginUserId ? cleanLoginUserId.length + 12 : null;
      if (user.activationCodeUsedAt) {
        const diagnostic = buildActivationLoginDiagnostic({ loginUserId, password, user, expectedLength: activationCredentialExpectedLength });
        await writeSecurityAuditEvent(db, req, 'LOGIN_BLOCKED', 'warning', 'Activation login blocked after code use', {
          reason: 'activation_code_already_used',
          userId: user.userId || user.username || user.id,
          diagnostic,
        });
        return res.status(403).json({
          error: 'Activation already used',
          message: 'This activation code has already been used. Ask an administrator to reissue account activation.',
          diagnostic,
        });
      }
      if (user.activationLockedUntil && new Date(user.activationLockedUntil).getTime() > Date.now()) {
        const diagnostic = buildActivationLoginDiagnostic({ loginUserId, password, user, expectedLength: activationCredentialExpectedLength });
        return res.status(429).json({
          error: 'Activation locked',
          message: 'Too many failed activation attempts. Try again later or ask an administrator to reissue account activation.',
          diagnostic,
        });
      }
      if (user.activationCodeExpiresAt && new Date(user.activationCodeExpiresAt).getTime() <= Date.now()) {
        const diagnostic = buildActivationLoginDiagnostic({ loginUserId, password, user, expectedLength: activationCredentialExpectedLength });
        await writeSecurityAuditEvent(db, req, 'LOGIN_BLOCKED', 'warning', 'Activation login blocked after expiry', {
          reason: 'activation_code_expired',
          userId: user.userId || user.username || user.id,
          diagnostic,
        });
        return res.status(403).json({
          error: 'Activation expired',
          message: 'This activation code has expired. Ask an administrator to reissue account activation.',
          diagnostic,
        });
      }
      const rawActivationAttempt = String(password || '');
      const normalisedActivationAttempt = normaliseActivationCredentialAttempt(rawActivationAttempt);
      validPassword = await bcrypt.compare(rawActivationAttempt, user.activationCodeHash);
      if (!validPassword && normalisedActivationAttempt !== rawActivationAttempt) {
        validPassword = await bcrypt.compare(normalisedActivationAttempt, user.activationCodeHash);
      }
      usedActivationCredential = validPassword;
      if (!validPassword) {
        const attempts = Number(user.activationAttemptCount || 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await db.$executeRawUnsafe(
          `UPDATE "User" SET "activationAttemptCount" = $1, "activationLockedUntil" = $2::timestamp, "updatedAt" = NOW()
           WHERE id = $3`,
          attempts,
          lockedUntil,
          user.id
        );
      }
    } else {
      validPassword = await bcrypt.compare(password, user.password);
    }
    if (!validPassword) {
      const diagnostic = buildActivationLoginDiagnostic({ loginUserId, password, user, expectedLength: activationCredentialExpectedLength });
      await writeSecurityAuditEvent(db, req, 'LOGIN_FAILED', 'warning', 'Direct login failed', {
        reason: 'invalid_credentials',
        suppliedUserId: String(loginUserId || '').slice(0, 120),
        userId: user.userId || user.username || user.id,
        diagnostic,
      });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: user.mustChangePassword && user.activationCodeHash
          ? `Activation login failed. Enter your Personnel ID in the User ID field, then enter your Personnel ID immediately followed by the full activation code from the email in the password field. Do not add spaces.${activationCredentialExpectedLength ? ` The password field should be ${activationCredentialExpectedLength} characters for this activation email.` : ''}`
          : 'Invalid User ID or password',
        diagnostic,
      });
    }
    if (usedActivationCredential) {
      await db.$executeRawUnsafe(
        `UPDATE "User"
         SET "activationCodeHash" = NULL,
             "activationCodeUsedAt" = NOW(),
             "activationAttemptCount" = 0,
             "activationLockedUntil" = NULL,
             "updatedAt" = NOW()
         WHERE id = $1`,
        user.id
      );
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
      mustChangePassword: Boolean(user.mustChangePassword),
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
        mustChangePassword: Boolean(user.mustChangePassword),
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
      `SELECT s."sessionToken", s.expires, u.id, u."userId", u.username, u.email, u."firstName", u."lastName", u.role, u."isActive", u."mustChangePassword"
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

    await repairSessionPersonLink(db, session);

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
        mustChangePassword: Boolean(session.mustChangePassword),
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

async function requireDirectAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!sessionToken) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return null;
  }

  const db = await getPrisma();
  const sessions = await db.$queryRawUnsafe(
    `SELECT s."sessionToken", s.expires, u.id, u."userId", u.username, u.email, u."firstName", u."lastName", u.role, u."isActive", u.password
     FROM "Session" s
     JOIN "User" u ON u.id = s."userId"
     WHERE s."sessionToken" = $1
     LIMIT 1`,
    sessionToken
  );
  const admin = sessions?.[0];
  if (!admin) {
    res.status(401).json({ error: 'Invalid token', message: 'Session not found' });
    return null;
  }
  if (new Date(admin.expires).getTime() <= Date.now()) {
    await db.$executeRawUnsafe(`DELETE FROM "Session" WHERE "sessionToken" = $1`, sessionToken);
    res.status(401).json({ error: 'Token expired', message: 'Session has expired' });
    return null;
  }
  if (!admin.isActive || !['ADMIN', 'SUPER_ADMIN'].includes(String(admin.role || '').toUpperCase())) {
    res.status(403).json({ error: 'Forbidden', message: 'Admin permission is required' });
    return null;
  }
  return { db, admin, sessionToken };
}

function rejectDisabledDebugRoute(res) {
  if (process.env.NODE_ENV === 'production' && process.env.DFP_ENABLE_DEBUG_ROUTES !== 'true') {
    res.status(404).json({ error: 'Not found' });
    return true;
  }
  return false;
}

const toDirectAdminUser = (user) => ({
  id: user.id,
  userId: user.userId,
  username: user.username,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.userId,
  isActive: user.isActive,
  mustChangePassword: Boolean(user.mustChangePassword),
  activationStatus: user.activationCodeUsedAt
    ? 'USED'
    : user.activationCodeHash
      ? (user.activationCodeExpiresAt && new Date(user.activationCodeExpiresAt).getTime() <= Date.now() ? 'EXPIRED' : 'PENDING')
      : 'NONE',
  activationExpiresAt: user.activationCodeExpiresAt || null,
  activationSentAt: user.activationCodeSentAt || null,
  activationUsedAt: user.activationCodeUsedAt || null,
  lastLoginAt: user.lastLogin,
  createdAt: user.createdAt,
  permissionsRoleId: '',
});

const normalisePersonAccountType = (value) => {
  const clean = String(value || '').trim().toLowerCase();
  if (['staff', 'personnel', 'instructor'].includes(clean)) return 'staff';
  if (['trainee', 'student'].includes(clean)) return 'trainee';
  return '';
};

function splitDisplayNameForAccount(name) {
  const clean = String(name || '').split(' – ')[0].split(' - ')[0].trim();
  if (!clean) return { firstName: '', lastName: '' };
  if (clean.includes(',')) {
    const [lastName, ...firstParts] = clean.split(',');
    return {
      firstName: firstParts.join(',').trim(),
      lastName: lastName.trim(),
    };
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: '', lastName: clean };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

async function findPersonForAccount(db, personType, personId) {
  const type = normalisePersonAccountType(personType);
  const cleanPersonId = String(personId || '').trim();
  if (!type || !cleanPersonId) return null;
  const numericId = Number(cleanPersonId);
  if (type === 'staff') {
    const where = Number.isFinite(numericId) && cleanPersonId === String(numericId)
      ? { OR: [{ id: cleanPersonId }, { idNumber: numericId }] }
      : { id: cleanPersonId };
    const record = await db.personnel.findFirst({ where });
    return record ? { type, record } : null;
  }
  const where = Number.isFinite(numericId) && cleanPersonId === String(numericId)
    ? { OR: [{ id: cleanPersonId }, { idNumber: numericId }] }
    : { id: cleanPersonId };
  const record = await db.trainee.findFirst({ where });
  return record ? { type, record } : null;
}

async function getDirectPersonAccountPayload(db, personType, personId) {
  const person = await findPersonForAccount(db, personType, personId);
  if (!person) return null;
  const userRows = person.record.userId
    ? await db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
              "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
              "lastLogin", "createdAt"
       FROM "User"
       WHERE id = $1
       LIMIT 1`,
      person.record.userId
    )
    : [];
  const user = userRows?.[0] || null;
  return {
    personType: person.type,
    person: {
      id: person.record.id,
      idNumber: person.record.idNumber,
      name: person.record.fullName || person.record.name,
      rank: person.record.rank || '',
      unit: person.record.unit || '',
      course: person.record.course || '',
      email: person.record.email || '',
      userId: person.record.userId || null,
    },
    user: user ? toDirectAdminUser(user) : null,
  };
}

async function ensureDirectPersonLoginAccount(db, adminId, personType, record, role = 'USER') {
  const type = normalisePersonAccountType(personType);
  if (!type || !record?.id) {
    const error = new Error('Staff or trainee record not found');
    error.status = 404;
    error.code = 'PERSON_NOT_FOUND';
    throw error;
  }
  const personnelId = normalisePersonnelId(record.idNumber);
  if (!personnelId) {
    const error = new Error('A Personnel ID is required before a login can be created');
    error.status = 400;
    error.code = 'PERSONNEL_ID_REQUIRED';
    throw error;
  }
  const email = String(record.email || '').trim();
  if (!email) {
    const error = new Error('A registered email address is required before a login can be created');
    error.status = 400;
    error.code = 'EMAIL_REQUIRED';
    throw error;
  }
  const safeRole = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'PILOT', 'USER'].includes(String(role).toUpperCase())
    ? String(role).toUpperCase()
    : 'USER';
  const displayName = record.name || record.fullName || '';
  const nameParts = splitDisplayNameForAccount(displayName);
  const existingUsers = await db.$queryRawUnsafe(
    `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
            "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
            "lastLogin", "createdAt"
     FROM "User"
     WHERE id = $1 OR "userId" = $2 OR username = $2
     ORDER BY CASE WHEN id = $1 THEN 0 WHEN "userId" = $2 OR username = $2 THEN 1 ELSE 2 END
     LIMIT 2`,
    record.userId || '',
    personnelId
  );
  const uniqueUsers = Array.from(new Map((existingUsers || []).map((user) => [user.id, user])).values());
  if (uniqueUsers.length > 1) {
    const error = new Error('The linked login account and Personnel ID match different users. Resolve the duplicate account before linking this profile.');
    error.status = 409;
    error.code = 'ACCOUNT_CONFLICT';
    throw error;
  }
  let user = uniqueUsers[0] || null;
  if (user && normalisePersonnelId(user.userId || user.username) !== personnelId) {
    const error = new Error(`The linked login User ID ${user.userId || user.username || 'unknown'} does not match this profile Personnel ID ${personnelId}. Resolve the account link before issuing activation.`);
    error.status = 409;
    error.code = 'ACCOUNT_ID_MISMATCH';
    throw error;
  }
  const emailConflicts = await db.$queryRawUnsafe(
    `SELECT id, "userId", username, email
     FROM "User"
     WHERE LOWER(email) = LOWER($1)
       AND id <> $2
     LIMIT 1`,
    email,
    user?.id || ''
  );
  if (emailConflicts?.length) {
    const error = new Error(`Email ${email} is already used by login account ${emailConflicts[0].userId || emailConflicts[0].username}. Use a unique email address before creating activation.`);
    error.status = 409;
    error.code = 'EMAIL_ACCOUNT_CONFLICT';
    throw error;
  }
  if (user) {
    const linkedElsewhere = await db.$queryRawUnsafe(
      `SELECT 'staff' AS type, id, name, "idNumber" FROM "Personnel" WHERE "userId" = $1 AND id <> $2
       UNION ALL
       SELECT 'trainee' AS type, id, "fullName" AS name, "idNumber" FROM "Trainee" WHERE "userId" = $1 AND id <> $3
       LIMIT 1`,
      user.id,
      type === 'staff' ? record.id : '',
      type === 'trainee' ? record.id : ''
    );
    if (linkedElsewhere?.length) {
      const error = new Error(`This login is already linked to ${linkedElsewhere[0].name || 'another person'}.`);
      error.status = 409;
      error.code = 'ACCOUNT_ALREADY_LINKED';
      throw error;
    }
    const updatedUsers = await db.$queryRawUnsafe(
      `UPDATE "User"
       SET "userId" = $1,
           username = $1,
           email = $2,
           "firstName" = $3,
           "lastName" = $4,
           role = $5::"Role",
           "updatedAt" = NOW()
       WHERE id = $6
       RETURNING id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
                 "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
                 "lastLogin", "createdAt"`,
      personnelId,
      email,
      nameParts.firstName || null,
      nameParts.lastName || null,
      safeRole,
      user.id
    );
    user = updatedUsers[0];
  } else {
    const bcrypt = require('bcryptjs');
    const blockedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const createdUsers = await db.$queryRawUnsafe(
      `INSERT INTO "User" ("id", "userId", username, email, password, role, "firstName", "lastName", "isActive", "createdById", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $1, $2, $3, $4::"Role", $5, $6, true, $7, NOW(), NOW())
       RETURNING id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
                 "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
                 "lastLogin", "createdAt"`,
      personnelId,
      email,
      blockedPassword,
      safeRole,
      nameParts.firstName || null,
      nameParts.lastName || null,
      adminId
    );
    user = createdUsers[0];
  }
  if (type === 'staff') {
    await db.personnel.update({ where: { id: record.id }, data: { userId: user.id } });
  } else {
    await db.trainee.update({ where: { id: record.id }, data: { userId: user.id } });
  }
  return { user, personnelId, email };
}

async function issueActivationEmailForDirectUser(db, req, targetUserId, personnelIdOverride = '') {
  const cleanTargetUserId = String(targetUserId || '').trim();
  if (!cleanTargetUserId) {
    const error = new Error('Target user is required');
    error.status = 400;
    error.code = 'TARGET_USER_REQUIRED';
    throw error;
  }
  const users = await db.$queryRawUnsafe(
    `SELECT id, "userId", username, email, password, "firstName", "lastName", role, "isActive", "mustChangePassword",
            "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
            "activationAttemptCount", "activationLockedUntil", "lastLogin", "createdAt"
     FROM "User"
     WHERE "userId" = $1 OR username = $1 OR id = $1
     LIMIT 1`,
    cleanTargetUserId
  );
  const target = users?.[0];
  if (!target) {
    const error = new Error('User not found');
    error.status = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  if (!target.isActive) {
    const error = new Error('Account must be active before activation can be issued');
    error.status = 403;
    error.code = 'ACCOUNT_INACTIVE';
    throw error;
  }
  if (!String(target.email || '').trim()) {
    const error = new Error('A registered email address is required before activation can be issued');
    error.status = 400;
    error.code = 'EMAIL_REQUIRED';
    throw error;
  }
  const linkedPersonnelId = await findLinkedPersonnelId(db, target.id);
  const cleanPersonnelId = normalisePersonnelId(personnelIdOverride) || linkedPersonnelId;
  if (!cleanPersonnelId) {
    const error = new Error('A linked Personnel ID is required before activation can be issued');
    error.status = 400;
    error.code = 'PERSONNEL_ID_REQUIRED';
    throw error;
  }
  const bcrypt = require('bcryptjs');
  const suffix = generateActivationSuffix(12);
  const activationCredential = `${cleanPersonnelId}${suffix}`;
  const activationCodeHash = await bcrypt.hash(activationCredential, 12);
  const emailActivationSettings = await loadEmailActivationSettings(db);
  const activationExpiresAt = getActivationExpiryDate(emailActivationSettings.activationExpiryHours);
  const randomBlockedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const updated = await db.$queryRawUnsafe(
    `UPDATE "User"
     SET password = $1,
         "mustChangePassword" = true,
         "activationCodeHash" = $2,
         "activationCodeExpiresAt" = $3::timestamp,
         "activationCodeSentAt" = NOW(),
         "activationCodeUsedAt" = NULL,
         "activationAttemptCount" = 0,
         "activationLockedUntil" = NULL,
         "updatedAt" = NOW()
     WHERE id = $4
     RETURNING id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
               "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
               "lastLogin", "createdAt"`,
    randomBlockedPassword,
    activationCodeHash,
    activationExpiresAt.toISOString(),
    target.id
  );
  try {
    const delivery = await sendActivationEmail({ db, target, suffix, expiresAt: activationExpiresAt });
    await writeSecurityAuditEvent(db, req, 'ACCOUNT_ACTIVATION_ISSUED', 'info', 'Account activation issued', {
      targetUserId: target.userId || target.username || target.id,
      email: target.email,
      expiresAt: activationExpiresAt.toISOString(),
      messageId: delivery.messageId,
    });
    return {
      user: toDirectAdminUser(updated[0]),
      delivery: {
        ...delivery,
        activationSuffix: process.env.DFP_EXPOSE_ACTIVATION_SUFFIX_FOR_TESTING === 'true' ? suffix : undefined,
        expiresAt: activationExpiresAt.toISOString(),
      },
    };
  } catch (emailError) {
    await db.$executeRawUnsafe(
      `UPDATE "User"
       SET password = $1,
           "mustChangePassword" = $2,
           "activationCodeHash" = $3,
           "activationCodeExpiresAt" = $4::timestamp,
           "activationCodeSentAt" = $5::timestamp,
           "activationCodeUsedAt" = $6::timestamp,
           "activationAttemptCount" = $7,
           "activationLockedUntil" = $8::timestamp,
           "updatedAt" = NOW()
       WHERE id = $9`,
      target.password,
      Boolean(target.mustChangePassword),
      target.activationCodeHash || null,
      target.activationCodeExpiresAt ? new Date(target.activationCodeExpiresAt).toISOString() : null,
      target.activationCodeSentAt ? new Date(target.activationCodeSentAt).toISOString() : null,
      target.activationCodeUsedAt ? new Date(target.activationCodeUsedAt).toISOString() : null,
      Number(target.activationAttemptCount || 0),
      target.activationLockedUntil ? new Date(target.activationLockedUntil).toISOString() : null,
      target.id
    );
    await writeSecurityAuditEvent(db, req, 'ACCOUNT_ACTIVATION_EMAIL_FAILED', 'warning', 'Account activation email failed', {
      targetUserId: target.userId || target.username || target.id,
      email: target.email,
      reason: emailError.message || 'Email delivery failed',
      code: emailError.code || '',
      missing: emailError.missing || [],
    });
    emailError.status = emailError.code === 'SMTP_NOT_CONFIGURED' ? 503 : 502;
    throw emailError;
  }
}

app.get('/api/admin/direct-users', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const users = await context.db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
              "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
              "lastLogin", "createdAt"
       FROM "User"
       ORDER BY "lastName" NULLS LAST, "firstName" NULLS LAST, username, "userId"`
    );
    res.json({ users: users.map(toDirectAdminUser) });
  } catch (error) {
    console.error('❌ GET /api/admin/direct-users error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to list users' });
  }
});

app.get('/api/admin/direct-person-account', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const payload = await getDirectPersonAccountPayload(context.db, req.query?.personType, req.query?.personId);
    if (!payload) {
      return res.status(404).json({ error: 'Not found', message: 'Staff or trainee record not found' });
    }
    res.json(payload);
  } catch (error) {
    console.error('❌ GET /api/admin/direct-person-account error:', error);
    res.status(500).json({ error: 'Account lookup failed', message: 'Failed to load account access details' });
  }
});

app.get('/api/admin/direct-person-account-diagnostics', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const person = await findPersonForAccount(context.db, req.query?.personType, req.query?.personId);
    if (!person) {
      return res.status(404).json({ error: 'Not found', message: 'Staff or trainee record not found' });
    }
    const record = person.record;
    const personnelId = normalisePersonnelId(record.idNumber);
    const email = String(record.email || '').trim();
    const linkedUserRows = record.userId ? await context.db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
              "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
              "activationAttemptCount", "activationLockedUntil", "lastLogin", "createdAt"
       FROM "User"
       WHERE id = $1
       LIMIT 1`,
      record.userId
    ) : [];
    const userIdRows = personnelId ? await context.db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
              "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
              "activationAttemptCount", "activationLockedUntil", "lastLogin", "createdAt"
       FROM "User"
       WHERE "userId" = $1 OR username = $1
       LIMIT 5`,
      personnelId
    ) : [];
    const emailRows = email ? await context.db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
              "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
              "activationAttemptCount", "activationLockedUntil", "lastLogin", "createdAt"
       FROM "User"
       WHERE LOWER(email) = LOWER($1)
       LIMIT 5`,
      email
    ) : [];
    const linkedUser = linkedUserRows?.[0] || null;
    const userByPersonnelId = userIdRows?.[0] || null;
    const matchingEmailDifferentAccount = emailRows.filter(row => row.id !== linkedUser?.id && row.id !== userByPersonnelId?.id);
    const linkedPersonnelId = linkedUser ? await findLinkedPersonnelId(context.db, linkedUser.id) : '';
    const userByPersonnelLinkedId = userByPersonnelId ? await findLinkedPersonnelId(context.db, userByPersonnelId.id) : '';
    const sanitiseUser = (user, linkedId = '') => user ? ({
      id: user.id,
      userId: user.userId || null,
      username: user.username || null,
      email: user.email || null,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
      role: user.role || null,
      isActive: Boolean(user.isActive),
      mustChangePassword: Boolean(user.mustChangePassword),
      hasActivationCodeHash: Boolean(user.activationCodeHash),
      activationStatus: getActivationStatusForUser(user),
      activationExpiresAt: user.activationCodeExpiresAt || null,
      activationSentAt: user.activationCodeSentAt || null,
      activationUsedAt: user.activationCodeUsedAt || null,
      activationAttemptCount: Number(user.activationAttemptCount || 0),
      activationLockedUntil: user.activationLockedUntil || null,
      lastLogin: user.lastLogin || null,
      linkedPersonnelId: linkedId || '',
    }) : null;
    const findings = [];
    if (!personnelId) findings.push('Profile has no Personnel ID.');
    if (!email) findings.push('Profile has no email address.');
    if (linkedUser && normalisePersonnelId(linkedUser.userId || linkedUser.username) !== personnelId) {
      findings.push(`Linked User ID ${linkedUser.userId || linkedUser.username || 'unknown'} does not match profile Personnel ID ${personnelId}.`);
    }
    if (userByPersonnelId && record.userId && userByPersonnelId.id !== record.userId) {
      findings.push(`Personnel ID ${personnelId} belongs to a different User row than the profile link.`);
    }
    if (matchingEmailDifferentAccount.length) {
      findings.push(`Email ${email} is also used by another login account.`);
    }
    if ((linkedUser || userByPersonnelId)?.activationLockedUntil && new Date((linkedUser || userByPersonnelId).activationLockedUntil).getTime() > Date.now()) {
      findings.push('Activation is temporarily locked because of failed attempts.');
    }
    if ((linkedUser || userByPersonnelId)?.activationCodeExpiresAt && new Date((linkedUser || userByPersonnelId).activationCodeExpiresAt).getTime() <= Date.now()) {
      findings.push('Activation code has expired.');
    }
    res.json({
      generatedAt: new Date().toISOString(),
      diagnostic: 'direct-person-account-activation',
      personType: person.type,
      person: {
        id: record.id,
        name: record.fullName || record.name || '',
        course: record.course || '',
        unit: record.unit || '',
        idNumber: record.idNumber || null,
        normalisedPersonnelId: personnelId,
        email,
        linkedUserRowId: record.userId || null,
        isActive: Boolean(record.isActive),
      },
      expectedLogin: {
        userIdField: personnelId || null,
        passwordFormat: personnelId ? `${personnelId} + emailed activation code` : null,
        expectedPasswordLength: personnelId ? personnelId.length + 12 : null,
      },
      linkedUser: sanitiseUser(linkedUser, linkedPersonnelId),
      userByPersonnelId: sanitiseUser(userByPersonnelId, userByPersonnelLinkedId),
      usersByEmail: emailRows.map(user => sanitiseUser(user, user.id === linkedUser?.id ? linkedPersonnelId : user.id === userByPersonnelId?.id ? userByPersonnelLinkedId : '')),
      findings,
      note: 'This diagnostic intentionally excludes activation codes, passwords, and stored password/hash values.',
    });
  } catch (error) {
    console.error('❌ GET /api/admin/direct-person-account-diagnostics error:', error);
    res.status(500).json({ error: 'Account diagnostics failed', message: 'Failed to build account activation diagnostics' });
  }
});

app.post('/api/admin/direct-person-account', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const { personType, personId, role = 'USER' } = req.body || {};
    const person = await findPersonForAccount(context.db, personType, personId);
    if (!person) {
      return res.status(404).json({ error: 'Not found', message: 'Staff or trainee record not found' });
    }
    const record = person.record;
    const { user, personnelId, email } = await ensureDirectPersonLoginAccount(context.db, context.admin.id, person.type, record, role);
    await writeSecurityAuditEvent(context.db, req, 'PERSON_ACCOUNT_LINKED', 'info', 'Person profile linked to login account', {
      personType: person.type,
      personId: record.id,
      personnelId,
      targetUserId: user.userId,
      email,
    });
    const payload = await getDirectPersonAccountPayload(context.db, person.type, record.id);
    res.json({ success: true, ...payload });
  } catch (error) {
    const message = String(error?.message || error);
    console.error('❌ POST /api/admin/direct-person-account error:', error);
    const status = error.status || (message.includes('unique') || message.includes('duplicate') ? 409 : 500);
    res.status(status).json({
      error: status === 409 ? 'Account conflict' : status === 400 ? 'Account details required' : 'Account link failed',
      message: status === 409 && (message.includes('unique') || message.includes('duplicate'))
        ? 'A login with that Personnel ID or email already exists'
        : message || 'Failed to create or link the login account',
    });
  }
});

app.post('/api/admin/direct-create-user', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const { userId, password, email, firstName, lastName, role = 'USER' } = req.body || {};
    const cleanUserId = String(userId || '').trim();
    if (!cleanUserId || !password || String(password).length < 8) {
      return res.status(400).json({ error: 'Invalid request', message: 'User ID and password of at least 8 characters are required' });
    }
    const safeRole = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'PILOT', 'USER'].includes(String(role).toUpperCase())
      ? String(role).toUpperCase()
      : 'USER';
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);
    const rows = await context.db.$queryRawUnsafe(
      `INSERT INTO "User" ("id", "userId", username, email, password, role, "firstName", "lastName", "isActive", "createdById", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $1, $2, $3, $4::"Role", $5, $6, true, $7, NOW(), NOW())
       RETURNING id, "userId", username, email, "firstName", "lastName", role, "isActive", "mustChangePassword",
                 "activationCodeHash", "activationCodeExpiresAt", "activationCodeSentAt", "activationCodeUsedAt",
                 "lastLogin", "createdAt"`,
      cleanUserId,
      email || null,
      hashedPassword,
      safeRole,
      firstName || null,
      lastName || null,
      context.admin.id
    );
    res.json({ user: toDirectAdminUser(rows[0]) });
  } catch (error) {
    const message = String(error?.message || error);
    console.error('❌ POST /api/admin/direct-create-user error:', error);
    res.status(message.includes('unique') || message.includes('duplicate') ? 409 : 500).json({
      error: 'Create failed',
      message: message.includes('unique') || message.includes('duplicate') ? 'A user with that ID or email already exists' : 'Failed to create user',
    });
  }
});

app.post('/api/admin/direct-issue-activation', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const { targetUserId, personnelId } = req.body || {};
    const { user, delivery } = await issueActivationEmailForDirectUser(context.db, req, targetUserId, personnelId);
    res.json({
      success: true,
      user,
      delivery: {
        ...delivery,
        instruction: 'Activation email sent. The user signs in with their Personnel ID followed immediately by the emailed activation code.',
      },
    });
  } catch (error) {
    const status = error.status || 500;
    const code = error.code || '';
    console.error('❌ POST /api/admin/direct-issue-activation error:', error);
    res.status(status).json({
      error: code === 'SMTP_NOT_CONFIGURED'
        ? 'Email not configured'
        : status === 400
          ? 'Activation details required'
          : status === 404
            ? 'Not found'
            : status === 403
              ? 'Account inactive'
              : status === 502
                ? 'Email delivery failed'
                : 'Activation failed',
      message: code === 'SMTP_NOT_CONFIGURED'
        ? `Activation email could not be sent because SMTP is not configured: ${(error.missing || []).join(', ')}`
        : error.message || 'Failed to issue account activation',
      missing: error.missing || undefined,
    });
  }
});

app.get('/api/admin/email-activation-settings', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const settings = await loadEmailActivationSettings(context.db);
    const smtpConfig = await getSmtpConfig(context.db);
    res.json({
      settings: sanitiseEmailActivationSettings(settings),
      runtime: {
        configured: smtpConfig.configured,
        missing: smtpConfig.missing,
        source: smtpConfig.source,
        mode: smtpConfig.mode,
      },
    });
  } catch (error) {
    console.error('❌ GET /api/admin/email-activation-settings error:', error);
    res.status(500).json({ error: 'Email activation settings failed', message: 'Failed to load email activation settings' });
  }
});

app.post('/api/admin/email-activation-settings', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const existing = await loadEmailActivationSettings(context.db);
    const body = req.body || {};
    const settings = {
      mode: normaliseEmailActivationMode(body.mode),
      smtpHost: String(body.smtpHost || '').trim(),
      smtpPort: Number(body.smtpPort || (body.smtpSecure ? 465 : 587)),
      smtpSecure: Boolean(body.smtpSecure),
      smtpRequireTls: Boolean(body.smtpRequireTls),
      smtpRejectUnauthorized: body.smtpRejectUnauthorized !== false,
      smtpUsername: String(body.smtpUsername || '').trim(),
      smtpFrom: String(body.smtpFrom || '').trim(),
      appUrl: String(body.appUrl || '').trim(),
      activationExpiryHours: Math.max(1, Math.min(168, Number(body.activationExpiryHours || 24) || 24)),
      smtpPasswordEncrypted: existing.smtpPasswordEncrypted || '',
      updatedAt: new Date().toISOString(),
      updatedBy: context.admin.userId || context.admin.username || context.admin.id,
    };
    if (Object.prototype.hasOwnProperty.call(body, 'smtpPassword') && String(body.smtpPassword || '').trim()) {
      settings.smtpPasswordEncrypted = encryptSettingsSecret(String(body.smtpPassword));
    }
    if (body.clearSmtpPassword === true) {
      settings.smtpPasswordEncrypted = '';
    }
    await saveEmailActivationSettings(context.db, settings, settings.updatedBy);
    await writeSecurityAuditEvent(context.db, req, 'EMAIL_ACTIVATION_SETTINGS_UPDATED', 'info', 'Email activation settings updated', {
      mode: settings.mode,
      smtpHost: settings.smtpHost ? 'configured' : 'blank',
      smtpFrom: settings.smtpFrom || '',
      smtpUsername: settings.smtpUsername ? 'configured' : 'blank',
      smtpPasswordConfigured: Boolean(settings.smtpPasswordEncrypted),
    });
    const smtpConfig = await getSmtpConfig(context.db);
    res.json({
      success: true,
      settings: sanitiseEmailActivationSettings(settings),
      runtime: {
        configured: smtpConfig.configured,
        missing: smtpConfig.missing,
        source: smtpConfig.source,
        mode: smtpConfig.mode,
      },
    });
  } catch (error) {
    console.error('❌ POST /api/admin/email-activation-settings error:', error);
    res.status(500).json({ error: 'Email activation settings failed', message: 'Failed to save email activation settings' });
  }
});

app.post('/api/admin/email-activation-settings/test', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const recipient = String(req.body?.recipient || context.admin.email || '').trim();
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient required', message: 'Enter a recipient email address before sending a test email' });
    }
    const smtpConfig = await getSmtpConfig(context.db);
    if (!smtpConfig.configured) {
      return res.status(503).json({
        error: 'Email not configured',
        message: `Activation emails cannot be sent until email delivery is configured: ${smtpConfig.missing.join(', ')}`,
        missing: smtpConfig.missing,
      });
    }
    const transporter = createActivationMailTransport(smtpConfig);
    const info = await transporter.sendMail({
      from: smtpConfig.from,
      to: recipient,
      subject: 'DFP NEO email test',
      text: 'DFP NEO email delivery is configured and able to send from this deployment.',
      html: '<p>DFP NEO email delivery is configured and able to send from this deployment.</p>',
    });
    await writeSecurityAuditEvent(context.db, req, 'EMAIL_ACTIVATION_TEST_SENT', 'info', 'Email activation test sent', {
      recipient,
      messageId: info.messageId || null,
    });
    res.json({ success: true, recipient, messageId: info.messageId || null });
  } catch (error) {
    console.error('❌ POST /api/admin/email-activation-settings/test error:', error);
    res.status(502).json({ error: 'Email test failed', message: error.message || 'The test email could not be sent' });
  }
});

app.post('/api/admin/direct-course-activations', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const course = String(req.body?.course || '').trim();
    if (!course) {
      return res.status(400).json({ error: 'Course required', message: 'Select a course before issuing account activations' });
    }
    const smtpConfig = await getSmtpConfig(context.db);
    if (!smtpConfig.configured) {
      return res.status(503).json({
        error: 'Email not configured',
        message: `Activation emails cannot be sent until SMTP is configured: ${smtpConfig.missing.join(', ')}`,
        missing: smtpConfig.missing,
      });
    }
    const trainees = await context.db.trainee.findMany({
      where: { course, isActive: true },
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    });
    if (trainees.length === 0) {
      const exactCourseRows = await context.db.trainee.findMany({
        where: { course },
        select: { id: true, name: true, fullName: true, course: true, isActive: true, email: true, idNumber: true },
        take: 10,
      });
      const allCourseRows = await context.db.trainee.findMany({
        select: { course: true, isActive: true },
        take: 10000,
      });
      const courseToken = course.toLowerCase();
      const nearbyCourses = allCourseRows.filter(row => String(row.course || '').toLowerCase().includes(courseToken));
      const courseCounts = nearbyCourses.reduce((acc, row) => {
        const key = String(row.course || '[blank]');
        if (!acc[key]) acc[key] = { total: 0, active: 0, inactive: 0 };
        acc[key].total += 1;
        if (row.isActive) acc[key].active += 1;
        else acc[key].inactive += 1;
        return acc;
      }, {});
      const inactiveExact = exactCourseRows.filter(row => !row.isActive).length;
      const activeExact = exactCourseRows.filter(row => row.isActive).length;
      const details = [
        `Database active trainees in ${course}: ${activeExact}`,
        `Database inactive trainees in ${course}: ${inactiveExact}`,
        `Course spellings found near ${course}: ${Object.entries(courseCounts).map(([name, counts]) => `${name} (${counts.active} active, ${counts.inactive} inactive)`).join('; ') || 'none'}`,
      ];
      return res.status(404).json({
        error: 'No active trainees',
        message: `Activation emails were not sent because the database did not return any active trainees for ${course}.`,
        details,
        diagnostic: {
          course,
          exactCourseSample: exactCourseRows,
          nearbyCourseCounts: courseCounts,
        },
      });
    }

    const results = [];
    let linked = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const activeEmailCounts = trainees.reduce((acc, trainee) => {
      const email = String(trainee.email || '').trim().toLowerCase();
      if (!email) return acc;
      acc[email] = (acc[email] || 0) + 1;
      return acc;
    }, {});
    const duplicateCourseEmails = new Set(Object.entries(activeEmailCounts)
      .filter(([, count]) => count > 1)
      .map(([email]) => email));

    for (const trainee of trainees) {
      const row = {
        personType: 'trainee',
        personId: trainee.id,
        name: trainee.fullName || trainee.name || '',
        personnelId: normalisePersonnelId(trainee.idNumber),
        email: String(trainee.email || '').trim(),
        userId: trainee.userId || null,
      };
      try {
        if (row.email && duplicateCourseEmails.has(row.email.toLowerCase())) {
          const error = new Error(`Email ${row.email} is used by ${activeEmailCounts[row.email.toLowerCase()]} active trainees in ${course}. Each login account must have a unique email address before activation emails can be sent.`);
          error.status = 409;
          error.code = 'DUPLICATE_COURSE_EMAIL';
          throw error;
        }
        const account = await ensureDirectPersonLoginAccount(context.db, context.admin.id, 'trainee', trainee, 'USER');
        linked += 1;
        const activation = await issueActivationEmailForDirectUser(context.db, req, account.user.userId || account.user.username || account.user.id, account.personnelId);
        sent += 1;
        results.push({
          ...row,
          status: 'sent',
          userId: activation.user.userId || activation.user.username || activation.user.id,
          activationStatus: activation.user.activationStatus,
          expiresAt: activation.delivery?.expiresAt || null,
        });
      } catch (error) {
        const status = error.status || 500;
        const resultStatus = status === 400 || status === 404 || status === 409 ? 'skipped' : 'failed';
        if (resultStatus === 'skipped') skipped += 1;
        else failed += 1;
        results.push({
          ...row,
          status: resultStatus,
          error: error.code || '',
          message: error.message || 'Activation could not be issued',
        });
      }
    }

    await writeSecurityAuditEvent(context.db, req, 'COURSE_ACCOUNT_ACTIVATION_BATCH', failed > 0 ? 'warning' : 'info', 'Course account activation batch processed', {
      course,
      total: trainees.length,
      linked,
      sent,
      skipped,
      failed,
    });

    res.json({
      success: failed === 0,
      course,
      total: trainees.length,
      linked,
      sent,
      skipped,
      failed,
      details: results
        .filter(result => result.status !== 'sent')
        .slice(0, 25)
        .map(result => `${result.name || result.personnelId || 'Trainee'}: ${result.message || 'Activation email was not sent'}`),
      results,
    });
  } catch (error) {
    console.error('❌ POST /api/admin/direct-course-activations error:', error);
    res.status(500).json({ error: 'Course activation failed', message: 'Failed to process course account activations' });
  }
});

app.post('/api/admin/direct-reset-password', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const { targetUserId, newPassword } = req.body || {};
    if (!targetUserId || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Invalid request', message: 'Target user and password of at least 8 characters are required' });
    }
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const result = await context.db.$executeRawUnsafe(
      `UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 OR username = $2`,
      hashedPassword,
      targetUserId
    );
    if (Number(result) === 0) {
      return res.status(404).json({ error: 'Not found', message: 'User not found' });
    }
    await context.db.$executeRawUnsafe(
      `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE "userId" = $1 OR username = $1)`,
      targetUserId
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/admin/direct-reset-password error:', error);
    res.status(500).json({ error: 'Reset failed', message: 'Failed to reset password' });
  }
});

app.post('/api/auth/direct-change-password', adminSensitiveRateLimit, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const sessionToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Invalid request', message: 'New password must be at least 8 characters' });
    }
    const db = await getPrisma();
    const sessions = await db.$queryRawUnsafe(
      `SELECT s."sessionToken", s.expires, u.id, u."userId", u.username, u.email, u.password, u."mustChangePassword", u."isActive"
       FROM "Session" s
       JOIN "User" u ON u.id = s."userId"
       WHERE s."sessionToken" = $1
       LIMIT 1`,
      sessionToken
    );
    const user = sessions?.[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid token', message: 'Session not found' });
    }
    if (new Date(user.expires).getTime() <= Date.now()) {
      await db.$executeRawUnsafe(`DELETE FROM "Session" WHERE "sessionToken" = $1`, sessionToken);
      return res.status(401).json({ error: 'Token expired', message: 'Session has expired' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account inactive', message: 'Your account has been deactivated' });
    }

    const bcrypt = require('bcryptjs');
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Invalid request', message: 'Current password is required' });
      }
      const validCurrentPassword = await bcrypt.compare(currentPassword, user.password || '');
      if (!validCurrentPassword) {
        return res.status(403).json({ error: 'Forbidden', message: 'Current password was not accepted' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.$executeRawUnsafe(
      `UPDATE "User"
       SET password = $1,
           "mustChangePassword" = false,
           "activationCodeHash" = NULL,
           "activationCodeExpiresAt" = NULL,
           "activationLockedUntil" = NULL,
           "activationAttemptCount" = 0,
           "updatedAt" = NOW()
       WHERE id = $2`,
      hashedPassword,
      user.id
    );
    await writeSecurityAuditEvent(db, req, 'PASSWORD_CHANGED', 'info', 'User password changed', {
      userId: user.userId || user.username || user.id,
      mandatoryChange: Boolean(user.mustChangePassword),
    });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/auth/direct-change-password error:', error);
    res.status(500).json({ error: 'Change failed', message: 'Failed to change password' });
  }
});

app.post('/api/admin/direct-delete-user', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const { targetUserId, password } = req.body || {};
    const cleanTargetUserId = String(targetUserId || '').trim();
    if (!cleanTargetUserId || !password) {
      return res.status(400).json({ error: 'Invalid request', message: 'Target user and your password are required' });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, context.admin.password || '');
    if (!validPassword) {
      return res.status(403).json({ error: 'Forbidden', message: 'Your password was not accepted' });
    }

    const users = await context.db.$queryRawUnsafe(
      `SELECT id, "userId", username, email, "firstName", "lastName", role
       FROM "User"
       WHERE "userId" = $1 OR username = $1 OR id = $1
       LIMIT 1`,
      cleanTargetUserId
    );
    const target = users?.[0];
    if (!target) {
      return res.status(404).json({ error: 'Not found', message: 'User not found' });
    }
    if (target.id === context.admin.id || target.userId === context.admin.userId) {
      return res.status(400).json({ error: 'Unsafe delete blocked', message: 'You cannot delete your own signed-in account' });
    }

    await context.db.$executeRawUnsafe(`UPDATE "Personnel" SET "userId" = NULL WHERE "userId" = $1`, target.id);
    await context.db.$executeRawUnsafe(`UPDATE "Trainee" SET "userId" = NULL WHERE "userId" = $1`, target.id);
    await context.db.$executeRawUnsafe(
      `DELETE FROM "CommercialUserAccess" WHERE "userId" = $1 OR username = $1 OR "userId" = $2 OR username = $2`,
      target.userId,
      target.username || ''
    );
    await context.db.$executeRawUnsafe(`DELETE FROM "Session" WHERE "userId" = $1`, target.id);
    await context.db.user.delete({ where: { id: target.id } });

    console.log(`✅ Admin user deleted: ${target.userId} by ${context.admin.userId}`);
    res.json({ success: true, deletedUserId: target.userId });
  } catch (error) {
    console.error('❌ POST /api/admin/direct-delete-user error:', error);
    res.status(500).json({ error: 'Delete failed', message: error.message || 'Failed to delete user' });
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
  app.post('/api/mobile/auth/login', authRateLimit, async (req, res) => {
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
      const canonicalMobileUser = await buildCanonicalMobileUserPayload(db, user);

      console.log(`✅ Mobile login successful for userId=${loginUserId}, role=${user.role}`);

      res.json({
           success: true,
           message: "Login successful",
           data: {
             accessToken,
             refreshToken,
             user: {
               ...canonicalMobileUser.payload,
               role: iOSRole,
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
      const jwtUserId = req.userId; // Human-readable user ID from the mobile token.
    const { date, startDate, endDate, debug } = req.query;
    const includeDebug = debug === '1' || debug === 'true';

    console.log("📅 Fetching schedule for jwtUserId=" + jwtUserId + ", params: " + JSON.stringify(req.query));

    // Step 1: Look up the User record by userId to get the DB id (cuid)
    const users = await db.$queryRawUnsafe(
      `SELECT id, "userId", username, "firstName", "lastName", email FROM "User" WHERE "userId" = $1 LIMIT 1`,
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

    const linkedTrainees = await db.trainee.findMany({
      where: { userId: dbUserId },
      select: {
        id: true,
        idNumber: true,
        name: true,
        fullName: true,
        traineeCallsign: true,
        email: true
      }
    });

    const linkedPersonnel = await db.personnel.findMany({
      where: { userId: dbUserId },
      select: {
        id: true,
        idNumber: true,
        name: true,
        email: true
      }
    });

    function normalizeIdentifier(value) {
      if (value === null || value === undefined) return null;
      const normalized = String(value)
        .toLowerCase()
        .replace(/\s*[–-]\s*\w+\d+\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      return normalized || null;
    }

    const matchNames = new Set();
    const matchIds = new Set();
    const addMatchName = (value) => {
      const normalized = normalizeIdentifier(value);
      if (normalized) matchNames.add(normalized);
    };
    const addMatchId = (value) => {
      const normalized = normalizeIdentifier(value);
      if (normalized) matchIds.add(normalized);
    };

    [
      jwtUserId,
      dbUser.userId,
      dbUser.username,
      dbUser.email,
      userFullName,
      userFullNameReversed
    ].forEach(addMatchName);

    linkedTrainees.forEach(trainee => {
      addMatchName(trainee.name);
      addMatchName(trainee.fullName);
      addMatchName(trainee.email);
      addMatchName(trainee.traineeCallsign);
      addMatchId(trainee.id);
      addMatchId(trainee.idNumber);
    });

    linkedPersonnel.forEach(person => {
      addMatchName(person.name);
      addMatchName(person.email);
      addMatchId(person.id);
      addMatchId(person.idNumber);
    });

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

    const scheduleDebug = {
      routeBuild: "mobile-schedule-context-date-v3",
      scheduleRowCount: schedules ? schedules.length : 0,
      scheduleRowsWithEvents: 0,
      snapshotFound: false,
      snapshotCandidateCount: 0,
      snapshotDate: null,
      snapshotRawEventCount: 0,
      snapshotUniqueEventCount: 0,
      matchedEventCount: 0,
      historicalFound: false,
      historicalDateFound: false,
      historicalRawEventCount: 0,
      historicalUniqueEventCount: 0,
      historicalMatchedEventCount: 0,
      matchNameCount: matchNames.size,
      matchIdCount: matchIds.size
    };

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

    const nameMatch = (nameField) => {
      if (!nameField) return false;
      if (Array.isArray(nameField)) {
        return nameField.some(nameMatch);
      }

      const normalized = normalizeIdentifier(nameField);
      return normalized ? matchNames.has(normalized) : false;
    };

    const idMatch = (idField) => {
      if (idField === null || idField === undefined) return false;
      if (Array.isArray(idField)) {
        return idField.some(idMatch);
      }

      const normalized = normalizeIdentifier(idField);
      return normalized ? matchIds.has(normalized) || matchNames.has(normalized) : false;
    };

    function filterEventsForMobileUser(events) {
      return (events || []).filter(e =>
        nameMatch(e.student) ||
        nameMatch(e.instructor) ||
        nameMatch(e.pilot) ||
        nameMatch(e.crew) ||
        nameMatch(e.attendees) ||
        idMatch(e.traineeId) ||
        idMatch(e.groupTraineeIds)
      );
    }

    function dedupeEvents(events) {
      const seenIds = new Set();
      return (events || []).filter(e => {
        const eid = e.id || e.eventId;
        if (eid && seenIds.has(eid)) return false;
        if (eid) seenIds.add(eid);
        return true;
      });
    }

    function mapMobileEvents(events) {
      return (events || []).map((e, idx) => {
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
          resourceId: e.resourceId || null,
          eventId: e.eventId || e.id || null,
          authoSignedBy: e.authoSignedBy || null,
          authoSignedAt: e.authoSignedAt || null,
          captainSignedBy: e.captainSignedBy || null,
          captainSignedAt: e.captainSignedAt || null,
          authNotes: e.authNotes || null,
          isVerbalAuth: e.isVerbalAuth === true,
          verbalAuthBy: e.verbalAuthBy || null,
          dualAuthSignedAnnotation: e.dualAuthSignedAnnotation || null,
          authorised: e.authorised === true,
          postFlightStatus: e.postFlightStatus || e.result || null,
          takeoffTime: e.takeoffTime || null,
          landTime: e.landTime || null,
          airborneTime: e.airborneTime != null ? String(e.airborneTime) : null,
          taxiGroundTime: e.taxiGroundTime != null ? String(e.taxiGroundTime) : null,
          blockTime: e.blockTime != null ? String(e.blockTime) : null,
          totalTime: e.totalTime != null ? String(e.totalTime) : null,
          postFlightUpdatedAt: e.postFlightUpdatedAt || null,
          updatedAt: e.updatedAt || null
        };
      });
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

    // Step 3: If Schedule records exist and contain events, use them.
    // Empty per-user Schedule records can exist even when published events are in DailySnapshot.
    // In that case, continue to the DailySnapshot fallback below.
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
      const schedulesWithEvents = transformedSchedules.filter(schedule => schedule.events.length > 0);
      scheduleDebug.scheduleRowsWithEvents = schedulesWithEvents.length;

      if (date && schedulesWithEvents.length > 0) {
        console.log("✅ GET /api/mobile/schedule - Single date: " + date + ", events: " + schedulesWithEvents[0].events.length);
        return res.json({
          schedule: schedulesWithEvents[0],
          ...(includeDebug ? { debug: scheduleDebug } : {})
        });
      }

      if (!date && schedulesWithEvents.length > 0) {
        console.log("✅ GET /api/mobile/schedule - Found " + schedulesWithEvents.length + " schedules for userId=" + jwtUserId);
        return res.json({
          success: true,
          schedules: schedulesWithEvents,
          ...(includeDebug ? { debug: scheduleDebug } : {})
        });
      }

      console.log("ℹ️ GET /api/mobile/schedule - Schedule rows had no events; checking DailySnapshot fallback");
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
            OR date LIKE $6::text
         ORDER BY
           CASE
             WHEN date = $1::text THEN 0
             WHEN date = $2::text THEN 1
             WHEN date = $3::text THEN 2
             WHEN date LIKE $4::text THEN 3
             WHEN date LIKE $5::text THEN 4
             WHEN date LIKE $6::text THEN 5
             ELSE 6
           END`,
        date,
        `${date}__ESL`,
        `${date}__PEA`,
        `${date}__ESL__%`,
        `${date}__PEA__%`,
        `${date}__%`
      );

      if (snapRows && snapRows.length > 0) {
        scheduleDebug.snapshotCandidateCount = snapRows.length;
        for (const snap of snapRows) {
        scheduleDebug.snapshotFound = true;
        scheduleDebug.snapshotDate = snap.date;
        // Combine all event arrays and deduplicate by id
        const allSnapshotEventsRaw = [
          ...(Array.isArray(snap.scheduleEvents) ? snap.scheduleEvents : []),
          ...(Array.isArray(snap.staffEvents) ? snap.staffEvents : []),
          ...(Array.isArray(snap.traineeEvents) ? snap.traineeEvents : [])
        ];
        scheduleDebug.snapshotRawEventCount = allSnapshotEventsRaw.length;
        const seenIds = new Set();
        const allSnapshotEvents = allSnapshotEventsRaw.filter(e => {
          const eid = e.id || e.eventId;
          if (eid && seenIds.has(eid)) return false;
          if (eid) seenIds.add(eid);
          return true;
        });
        scheduleDebug.snapshotUniqueEventCount = allSnapshotEvents.length;

        // Filter events for this user by linked User, Trainee, and Personnel identifiers.
        const nameMatch = (nameField) => {
          if (!nameField) return false;
          if (Array.isArray(nameField)) {
            return nameField.some(nameMatch);
          }

          const normalized = normalizeIdentifier(nameField);
          return normalized ? matchNames.has(normalized) : false;
        };

        const idMatch = (idField) => {
          if (idField === null || idField === undefined) return false;
          if (Array.isArray(idField)) {
            return idField.some(idMatch);
          }

          const normalized = normalizeIdentifier(idField);
          return normalized ? matchIds.has(normalized) || matchNames.has(normalized) : false;
        };

        const userEvents = allSnapshotEvents.filter(e =>
          nameMatch(e.student) ||
          nameMatch(e.instructor) ||
          nameMatch(e.pilot) ||
          nameMatch(e.crew) ||
          nameMatch(e.attendees) ||
          idMatch(e.traineeId) ||
          idMatch(e.groupTraineeIds)
        );
        scheduleDebug.matchedEventCount = userEvents.length;

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
              resourceId: e.resourceId || null,
              eventId: e.eventId || e.id || null,
              authoSignedBy: e.authoSignedBy || null,
              authoSignedAt: e.authoSignedAt || null,
              captainSignedBy: e.captainSignedBy || null,
              captainSignedAt: e.captainSignedAt || null,
              authNotes: e.authNotes || null,
              isVerbalAuth: e.isVerbalAuth === true,
              verbalAuthBy: e.verbalAuthBy || null,
              dualAuthSignedAnnotation: e.dualAuthSignedAnnotation || null,
              authorised: e.authorised === true,
              updatedAt: e.updatedAt || null
            };
          });

            console.log("\u2705 GET /api/mobile/schedule - Found " + mappedEvents.length + " events in DailySnapshot for date=" + date);
            return res.json({
              schedule: {
                id: "snapshot-" + snap.date,
                date: date,
                snapshotKey: snap.date,
                isPublished: true,
                events: mappedEvents,
                serverTime: new Date().toISOString()
              },
              snapshotKey: snap.date,
              ...(includeDebug ? { debug: scheduleDebug } : {})
            });
          }
        }
      }
    }

    if (date) {
      const historicalRows = await db.dataBackup.findMany({
        where: { type: 'historical_published_schedules' },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      if (historicalRows && historicalRows.length > 0) {
        scheduleDebug.historicalFound = true;
        const publishedSchedules = historicalRows[0].data || {};
        const dateKeys = [
          date,
          `${date}__ESL`,
          `${date}__PEA`
        ];

        const matchingHistoricalKey = Object.keys(publishedSchedules).find(key =>
          dateKeys.includes(key) ||
          key.startsWith(`${date}__ESL__`) ||
          key.startsWith(`${date}__PEA__`)
        );

        if (matchingHistoricalKey && Array.isArray(publishedSchedules[matchingHistoricalKey])) {
          scheduleDebug.historicalDateFound = true;
          const historicalEvents = publishedSchedules[matchingHistoricalKey];
          scheduleDebug.historicalRawEventCount = historicalEvents.length;

          const uniqueHistoricalEvents = dedupeEvents(historicalEvents);
          scheduleDebug.historicalUniqueEventCount = uniqueHistoricalEvents.length;

          const userHistoricalEvents = filterEventsForMobileUser(uniqueHistoricalEvents);
          scheduleDebug.historicalMatchedEventCount = userHistoricalEvents.length;

          if (userHistoricalEvents.length > 0) {
            const mappedEvents = mapMobileEvents(userHistoricalEvents);
            console.log("✅ GET /api/mobile/schedule - Found " + mappedEvents.length + " events in historical publishedSchedules for date=" + date);
            return res.json({
              schedule: {
                id: "historical-" + matchingHistoricalKey,
                date: date,
                isPublished: true,
                events: mappedEvents,
                serverTime: new Date().toISOString()
              },
              ...(includeDebug ? { debug: scheduleDebug } : {})
            });
          }
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
        message: "No events scheduled for " + queryDate,
        ...(includeDebug ? { debug: scheduleDebug } : {})
      });

  } catch (error) {
    console.error('\u274c GET /api/mobile/schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedule', details: error.message });
  }
});

const MOBILE_FLIGHT_AUTHORISATION_PERMISSION = 'dfp.flightAuthorisation.use';
const MOBILE_FLIGHT_AUTHORISATION_LEGACY_PERMISSIONS = ['dfp.publish'];
const MOBILE_PERMISSION_PROFILE_FALLBACKS = {
  instructor: ['dfp.view', MOBILE_FLIGHT_AUTHORISATION_PERMISSION, 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others'],
  'flying-supervisor': ['dfp.view', 'dfp.editTiles', 'dfp.validation', MOBILE_FLIGHT_AUTHORISATION_PERMISSION, 'dfp.publish', 'staff.view', 'staff.currency.view', 'trainee.roster.view', 'trainee.profile.others', 'trainee.pt051.others', 'trainee.pt051.edit', 'trainee.lmp.others', 'trainee.remedial.add', 'reporting.view'],
  'unit-admin': ['settings.superAdmin', MOBILE_FLIGHT_AUTHORISATION_PERMISSION],
  'super-admin': ['settings.superAdmin', MOBILE_FLIGHT_AUTHORISATION_PERMISSION],
};

function normaliseMobilePermissionId(value) {
  return String(value || '').trim();
}

function addMobileImpliedPermissions(permissionIds = []) {
  const permissions = new Set(permissionIds.map(normaliseMobilePermissionId).filter(Boolean));
  if ([...permissions].some((permissionId) => permissionId.startsWith('dfp.'))) permissions.add('dfp.view');
  if (permissions.has(MOBILE_FLIGHT_AUTHORISATION_PERMISSION)) permissions.add('dfp.view');
  return [...permissions];
}

function getSnapshotContextFromKey(key) {
  const parts = String(key || '').split('__');
  return {
    date: parts[0] || '',
    locationCode: parts[1] || '',
    unitCode: parts[2] || '',
  };
}

function splitUnitTokens(value) {
  return String(value || '')
    .toUpperCase()
    .split(/[+\-/_,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mobileUnitScopeMatches(accessUnitCode, snapshotUnitCode) {
  const access = String(accessUnitCode || '').trim().toUpperCase();
  const snapshot = String(snapshotUnitCode || '').trim().toUpperCase();
  if (!access || !snapshot || access === snapshot) return true;
  const accessParts = splitUnitTokens(access);
  const snapshotParts = splitUnitTokens(snapshot);
  if (accessParts.length === 0 || snapshotParts.length === 0) return true;
  return accessParts.some((part) => snapshotParts.includes(part));
}

function mobileLocationScopeMatches(accessLocationCode, snapshotLocationCode) {
  const access = String(accessLocationCode || '').trim().toUpperCase();
  const snapshot = String(snapshotLocationCode || '').trim().toUpperCase();
  return !access || !snapshot || access === snapshot;
}

function getMobileProfilePermissionMap(organisations = []) {
  const map = new Map();
  for (const [profileId, permissions] of Object.entries(MOBILE_PERMISSION_PROFILE_FALLBACKS)) {
    map.set(profileId, addMobileImpliedPermissions(permissions));
  }
  for (const organisation of organisations || []) {
    const profiles = Array.isArray(organisation?.settings?.permissionProfiles)
      ? organisation.settings.permissionProfiles
      : [];
    for (const profile of profiles) {
      const profileId = normaliseMobilePermissionId(profile?.id);
      if (!profileId) continue;
      map.set(profileId, addMobileImpliedPermissions(Array.isArray(profile.permissions) ? profile.permissions : []));
    }
  }
  return map;
}

function getMobileAccessRowPermissions(accessRows, profilePermissionMap, snapshotContext) {
  const permissionSet = new Set();
  const denySet = new Set();
  let hasScopedRow = false;
  for (const row of accessRows || []) {
    if (String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE') continue;
    if (!mobileLocationScopeMatches(row.locationCode, snapshotContext.locationCode)) continue;
    if (!mobileUnitScopeMatches(row.unitCode, snapshotContext.unitCode)) continue;
    hasScopedRow = true;
    const settings = row.settings && typeof row.settings === 'object' ? row.settings : {};
    const profileIds = Array.isArray(settings.permissionProfileIds) ? settings.permissionProfileIds : [];
    for (const profileId of profileIds.map(normaliseMobilePermissionId).filter(Boolean)) {
      for (const permissionId of profilePermissionMap.get(profileId) || []) permissionSet.add(permissionId);
    }
    for (const permissionId of addMobileImpliedPermissions(Array.isArray(settings.permissionAllowIds) ? settings.permissionAllowIds : [])) {
      permissionSet.add(permissionId);
    }
    for (const permissionId of (Array.isArray(settings.permissionDenyIds) ? settings.permissionDenyIds : []).map(normaliseMobilePermissionId).filter(Boolean)) {
      denySet.add(permissionId);
    }
  }
  for (const permissionId of denySet) permissionSet.delete(permissionId);
  return { hasScopedRow, permissions: [...permissionSet], deniedPermissions: [...denySet] };
}

async function getMobileAuthorisationAccess(db, user, snapshotContext) {
  const accessRows = await db.$queryRawUnsafe(
    `SELECT "userId", username, "organisationCode", "locationCode", "unitCode", status, settings
       FROM "CommercialUserAccess"
      WHERE status IS DISTINCT FROM 'INACTIVE'
        AND (
          "userId" = $1 OR username = $1 OR
          "userId" = $2 OR username = $2 OR
          LOWER(COALESCE(username, '')) = LOWER($3) OR
          LOWER(COALESCE("userId", '')) = LOWER($3)
        )`,
    user.userId || '',
    user.id || '',
    user.email || ''
  );
  const organisations = await db.$queryRawUnsafe(`SELECT code, settings FROM "CommercialOrganisation"`);
  const profilePermissionMap = getMobileProfilePermissionMap(organisations);
  const scoped = getMobileAccessRowPermissions(accessRows || [], profilePermissionMap, snapshotContext);
  const permissions = new Set(scoped.permissions);
  const deniedPermissions = new Set(scoped.deniedPermissions || []);
  const hasExplicitPermission = permissions.has(MOBILE_FLIGHT_AUTHORISATION_PERMISSION);
  const hasDeniedFlightAuthorisation = deniedPermissions.has(MOBILE_FLIGHT_AUTHORISATION_PERMISSION);
  const hasLegacyPermission = !hasDeniedFlightAuthorisation && MOBILE_FLIGHT_AUTHORISATION_LEGACY_PERMISSIONS.some((permissionId) => permissions.has(permissionId));
  const isPlatformAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role || '').toUpperCase());
  const hasSuperAdminPermission = permissions.has('settings.superAdmin') && !hasDeniedFlightAuthorisation;
  return {
    ...scoped,
    hasAccessRows: (accessRows || []).length > 0,
    hasFlightAuthorisationPermission: !hasDeniedFlightAuthorisation && (hasExplicitPermission || hasLegacyPermission || hasSuperAdminPermission || (isPlatformAdmin && !scoped.hasScopedRow)),
    permissionMatchedBy: hasExplicitPermission
      ? MOBILE_FLIGHT_AUTHORISATION_PERMISSION
      : hasLegacyPermission
        ? MOBILE_FLIGHT_AUTHORISATION_LEGACY_PERMISSIONS.find((permissionId) => permissions.has(permissionId))
        : hasSuperAdminPermission
          ? 'settings.superAdmin'
          : isPlatformAdmin && !scoped.hasScopedRow
            ? 'platform-admin-fallback'
            : null,
  };
}

async function loadMobileAppSettings(db) {
  const rows = await db.$queryRawUnsafe(`SELECT data FROM "AppSettings" WHERE "orgId" = 'default' LIMIT 1`);
  return rows?.[0]?.data && typeof rows[0].data === 'object' ? rows[0].data : {};
}

function isMobileFlightAuthorisationRequired(settings) {
  return settings?.tileStatusSettings?.flightAuthorisationRequired !== false;
}

function isMobileFlightAuthorisationFrozen(settings) {
  const freeze = settings?.emergencyFreezeState;
  return !!(freeze?.isFrozen && !freeze?.allowedActions?.flightAuthorisation);
}

function isPastMobileDfpDate(dateValue) {
  const dateText = String(dateValue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;
  const todayText = new Date().toISOString().slice(0, 10);
  return dateText < todayText;
}

async function writeMobileFlightAuthorisationAudit(db, req, user, snapshotKey, beforeEvent, afterEvent, action) {
  await db.$executeRawUnsafe(
    `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", changes, "ipAddress", "userAgent", "createdAt")
     VALUES (gen_random_uuid()::text, $1, 'MOBILE_FLIGHT_AUTHORISATION', 'DailySnapshotEvent', $2, $3::jsonb, $4, $5, NOW())`,
    user.id,
    afterEvent?.id || afterEvent?.eventId || beforeEvent?.id || beforeEvent?.eventId || null,
    JSON.stringify({
      source: 'iOS Mobile Flight Authorisation',
      action,
      snapshotKey,
      userId: user.userId,
      before: {
        authoSignedBy: beforeEvent?.authoSignedBy || null,
        authoSignedAt: beforeEvent?.authoSignedAt || null,
        captainSignedBy: beforeEvent?.captainSignedBy || null,
        captainSignedAt: beforeEvent?.captainSignedAt || null,
        authNotes: beforeEvent?.authNotes || null,
        isVerbalAuth: beforeEvent?.isVerbalAuth === true,
        verbalAuthBy: beforeEvent?.verbalAuthBy || null,
        dualAuthSignedAnnotation: beforeEvent?.dualAuthSignedAnnotation || null,
        authorised: beforeEvent?.authorised === true,
        updatedAt: beforeEvent?.updatedAt || null,
      },
      after: {
        authoSignedBy: afterEvent?.authoSignedBy || null,
        authoSignedAt: afterEvent?.authoSignedAt || null,
        captainSignedBy: afterEvent?.captainSignedBy || null,
        captainSignedAt: afterEvent?.captainSignedAt || null,
        authNotes: afterEvent?.authNotes || null,
        isVerbalAuth: afterEvent?.isVerbalAuth === true,
        verbalAuthBy: afterEvent?.verbalAuthBy || null,
        dualAuthSignedAnnotation: afterEvent?.dualAuthSignedAnnotation || null,
        authorised: afterEvent?.authorised === true,
        updatedAt: afterEvent?.updatedAt || null,
      },
    }),
    getRequestIp(req),
    req.headers['user-agent'] || 'unknown'
  );
}

function toMobileTimeString(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [h, m] = text.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return text;
  const hours = Math.floor(numeric);
  const minutes = Math.round((numeric - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseMobileFlightTimeToMinutes(value) {
  const clean = String(value || '').trim().replace(':', '');
  if (!/^\d{3,4}$/.test(clean)) return null;
  const padded = clean.padStart(4, '0');
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) return null;
  return (hours * 60) + minutes;
}

function calculateMobileAirborneHours(takeoffTime, landTime) {
  const start = parseMobileFlightTimeToMinutes(takeoffTime);
  const endRaw = parseMobileFlightTimeToMinutes(landTime);
  if (start === null || endRaw === null) return 0;
  let end = endRaw;
  if (end < start) end += 24 * 60;
  return Math.max(0, Math.round(((end - start) / 60) * 10) / 10);
}

function normaliseMobilePersonMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s*[–-]\s*\w+\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mobileEventMatchesTarget(event, eventId) {
  return String(event && (event.id || event.eventId || '')) === String(eventId);
}

function getMobileFlightTypeDefaults(event) {
  const type = String(event?.type || event?.eventType || '').trim().toLowerCase();
  const flightType = String(event?.flightType || '').trim().toLowerCase();
  const eventCode = String(event?.flightNumber || event?.eventCode || event?.title || '').trim().toLowerCase();
  const isFtdLog = type === 'ftd' || eventCode.includes('ftd') || eventCode.includes('sim');
  const isFlightLog = !isFtdLog;
  return {
    isFlightLog,
    isFtdLog,
    isSolo: flightType === 'solo',
    isDual: flightType === 'dual' || Boolean(event?.student && (event?.instructor || event?.pilot)),
  };
}

function buildMobileFlightTimesDefaults(event, settings, existingCompletion, existingLogs) {
  const typeDefaults = getMobileFlightTypeDefaults(event);
  const instructorLog = (existingLogs || []).find(row => String(row.personRole || '').toLowerCase() === 'instructor');
  const traineeLog = (existingLogs || []).find(row => String(row.personRole || '').toLowerCase() === 'trainee');
  const captainLog = traineeLog || (existingLogs || []).find(row => String(row.personRole || '').toLowerCase() === 'fixed_crew_pic') || null;
  const timingLog = captainLog || instructorLog || traineeLog;
  const defaultTakeoff = toMobileTimeString(existingCompletion?.takeoffTime || timingLog?.takeoffTime || event?.takeoffTime || event?.startTime);
  const defaultLand = toMobileTimeString(existingCompletion?.landTime || timingLog?.landTime || event?.landTime || event?.endTime || (
    event?.startTime != null ? Number(event.startTime) + (Number(event.duration) || 1) : null
  ));
  const policyTaxi = Number(settings?.taxiGroundTime);
  const taxiGround = existingCompletion?.taxiGroundTime ?? timingLog?.taxiGroundTime ?? event?.taxiGroundTime ?? (Number.isFinite(policyTaxi) ? policyTaxi : 0.1);
  const airborne = existingCompletion?.airborneTime ?? timingLog?.airborneTime ?? event?.airborneTime ?? calculateMobileAirborneHours(defaultTakeoff, defaultLand);
  const block = existingCompletion?.blockTime ?? timingLog?.blockTime ?? event?.blockTime ?? (Number(airborne || 0) + Number(taxiGround || 0));
  const result = existingCompletion?.dcoResult || event?.postFlightStatus || event?.result || '';

  return {
    result,
    isFlightLog: timingLog?.isFlightLog ?? typeDefaults.isFlightLog,
    isFtdLog: timingLog?.isFtdLog ?? typeDefaults.isFtdLog,
    isSolo: existingCompletion?.isSolo ?? timingLog?.isSolo ?? typeDefaults.isSolo,
    isDual: existingCompletion?.isDual ?? timingLog?.isDual ?? typeDefaults.isDual,
    aircraftNumber: existingCompletion?.aircraftNumber || timingLog?.aircraftNumber || event?.aircraftNumber || event?.aircraft || event?.resourceId || '',
    from: timingLog?.fromIcao || event?.origin || event?.location || '',
    to: timingLog?.toIcao || event?.destination || event?.origin || event?.location || '',
    duty: timingLog?.duty || event?.flightNumber || event?.eventCode || event?.title || '',
    takeoffTime: defaultTakeoff,
    landTime: defaultLand,
    airborneTime: Number(airborne || 0).toFixed(1),
    taxiGroundTime: Number(taxiGround || 0).toFixed(1),
    blockTime: Number(block || 0).toFixed(1),
    totalTime: Number(block || 0).toFixed(1),
    captainTime: captainLog?.captainTime != null ? Number(captainLog.captainTime).toFixed(1) : (typeDefaults.isFlightLog ? Number(block || 0).toFixed(1) : ''),
    instructorTime: instructorLog?.instructorTime != null ? Number(instructorLog.instructorTime).toFixed(1) : '',
    nightTime: timingLog?.nightTime != null ? Number(timingLog.nightTime).toFixed(1) : '',
    ifActualTime: timingLog?.ifActualTime != null ? Number(timingLog.ifActualTime).toFixed(1) : '',
    ifSimTime: timingLog?.ifSimTime != null ? Number(timingLog.ifSimTime).toFixed(1) : '',
    ineffectiveTime: timingLog?.ineffectiveTime != null ? Number(timingLog.ineffectiveTime).toFixed(1) : '',
    approaches: {
      ils: captainLog?.ilsCount || traineeLog?.ilsCount || 0,
      rnp: captainLog?.rnpCount || traineeLog?.rnpCount || 0,
      tacan: captainLog?.tacanCount || traineeLog?.tacanCount || 0,
      vor: captainLog?.vorCount || traineeLog?.vorCount || 0,
    },
    approachAssignments: event?.approachAssignments && typeof event.approachAssignments === 'object'
      ? event.approachAssignments
      : { ils: '', rnp: '', tacan: '', vor: '' },
    clientEventUpdatedAt: event?.postFlightUpdatedAt || event?.updatedAt || null,
  };
}

async function resolveMobileFlightTimesRequest(db, req) {
  const jwtUserId = req.userId;
  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { date, snapshotKey, eventId } = params;
  if (!date || !eventId) return { errorStatus: 400, error: { error: 'date and eventId are required' } };

  const users = await db.$queryRawUnsafe(
    `SELECT id, "userId", username, "firstName", "lastName", email, role, "isActive"
       FROM "User"
      WHERE "userId" = $1
      LIMIT 1`,
    jwtUserId
  );
  if (!users || users.length === 0) return { errorStatus: 401, error: { error: 'User not found' } };
  const user = users[0];
  if (!user.isActive) return { errorStatus: 403, error: { error: 'Account is inactive' } };

  const snapshotRows = snapshotKey
    ? await db.$queryRawUnsafe(
        `SELECT date, "scheduleEvents", "traineeEvents", "staffEvents"
           FROM "DailySnapshot"
          WHERE date = $1::text
          LIMIT 1`,
        snapshotKey
      )
    : await db.$queryRawUnsafe(
        `SELECT date, "scheduleEvents", "traineeEvents", "staffEvents"
           FROM "DailySnapshot"
          WHERE date = $1::text OR date LIKE $2::text
          ORDER BY CASE WHEN date = $1::text THEN 0 ELSE 1 END`,
        date,
        `${date}__%`
      );
  if (!snapshotRows || snapshotRows.length === 0) return { errorStatus: 404, error: { error: 'Published schedule snapshot not found' } };

  const snapshot = snapshotRows.find((row) => [
    ...(Array.isArray(row.scheduleEvents) ? row.scheduleEvents : []),
    ...(Array.isArray(row.traineeEvents) ? row.traineeEvents : []),
    ...(Array.isArray(row.staffEvents) ? row.staffEvents : []),
  ].some(event => mobileEventMatchesTarget(event, eventId))) || null;
  if (!snapshot) return { errorStatus: 404, error: { error: 'Event not found in published schedule snapshot' } };

  const snapshotContext = getSnapshotContextFromKey(snapshot.date);
  if (snapshotContext.date && snapshotContext.date !== String(date).slice(0, 10)) {
    return { errorStatus: 400, error: { error: 'Snapshot key does not match requested date' } };
  }

  const scheduleEvents = Array.isArray(snapshot.scheduleEvents) ? snapshot.scheduleEvents : [];
  const traineeEvents = Array.isArray(snapshot.traineeEvents) ? snapshot.traineeEvents : [];
  const staffEvents = Array.isArray(snapshot.staffEvents) ? snapshot.staffEvents : [];
  const event = [...scheduleEvents, ...traineeEvents, ...staffEvents].find(item => mobileEventMatchesTarget(item, eventId));
  if (!event) return { errorStatus: 404, error: { error: 'Event not found in published schedule snapshot' } };

  const canonicalMobileUser = await buildCanonicalMobileUserPayload(db, user);
  const effectiveUser = canonicalMobileUser.user || user;
  const canonicalPerson = canonicalMobileUser.person;
  const linkedPersonnel = await db.personnel.findMany({
    where: { userId: user.id },
    select: { id: true, idNumber: true, name: true, email: true }
  });
  const linkedTrainees = await db.trainee.findMany({
    where: { userId: user.id },
    select: { id: true, idNumber: true, name: true, fullName: true, email: true }
  });
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const userFullNameReversed = `${user.lastName || ''}, ${user.firstName || ''}`.trim();
  const matchValues = new Set([
    jwtUserId,
    user.userId,
    user.email,
    effectiveUser.email,
    userFullName,
    userFullNameReversed,
    canonicalPerson?.id,
    canonicalPerson?.name,
    canonicalPerson?.fullName,
    canonicalPerson?.email,
    canonicalPerson?.idNumber,
    ...linkedPersonnel.flatMap(person => [person.id, person.name, person.email, person.idNumber]),
    ...linkedTrainees.flatMap(person => [person.id, person.name, person.fullName, person.email, person.idNumber]),
  ].map(normaliseMobilePersonMatch).filter(Boolean));
  const eventFields = [
    event.student, event.instructor, event.pilot, event.crew, event.attendees,
    event.traineeId, event.groupTraineeIds, event.personnelId, event.pilotId, event.instructorId,
  ];
  const userMatchesEvent = eventFields.some((field) => {
    if (Array.isArray(field)) return field.some(item => matchValues.has(normaliseMobilePersonMatch(item)));
    return matchValues.has(normaliseMobilePersonMatch(field));
  });

  const access = await getMobileAuthorisationAccess(db, effectiveUser, snapshotContext);
  const permissionSet = new Set(access.permissions || []);
  const isPlatformAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(String(effectiveUser.role || user.role || '').toUpperCase());
  const canManageFlightTimes = userMatchesEvent
    || access.hasFlightAuthorisationPermission
    || permissionSet.has('trainee.pt051.edit')
    || permissionSet.has('trainee.pt051.others')
    || permissionSet.has('dfp.publish')
    || permissionSet.has('settings.superAdmin')
    || isPlatformAdmin;

  return { user, effectiveUser, snapshot, snapshotContext, scheduleEvents, traineeEvents, staffEvents, event, userMatchesEvent, canManageFlightTimes };
}

async function writeMobileFlightTimesAudit(db, req, user, snapshotKey, beforeEvent, afterEvent, flightTimes) {
  await db.$executeRawUnsafe(
    `INSERT INTO "AuditLog" ("id", "userId", action, "entityType", "entityId", changes, "ipAddress", "userAgent", "createdAt")
     VALUES (gen_random_uuid()::text, $1, 'MOBILE_FLIGHT_TIMES', 'DailySnapshotEvent', $2, $3::jsonb, $4, $5, NOW())`,
    user.id,
    afterEvent?.id || afterEvent?.eventId || beforeEvent?.id || beforeEvent?.eventId || null,
    JSON.stringify({
      source: 'iOS Mobile Flight Times',
      snapshotKey,
      before: {
        postFlightStatus: beforeEvent?.postFlightStatus || beforeEvent?.result || null,
        takeoffTime: beforeEvent?.takeoffTime || null,
        landTime: beforeEvent?.landTime || null,
        blockTime: beforeEvent?.blockTime || beforeEvent?.totalTime || null,
      },
      after: {
        postFlightStatus: afterEvent?.postFlightStatus || afterEvent?.result || null,
        takeoffTime: afterEvent?.takeoffTime || null,
        landTime: afterEvent?.landTime || null,
        blockTime: afterEvent?.blockTime || afterEvent?.totalTime || null,
      },
      flightTimes,
    }),
    getRequestIp(req),
    req.headers['user-agent'] || 'unknown'
  ).catch((err) => console.warn('⚠️ Mobile flight times audit failed:', err.message));
}

app.get('/api/mobile/flight-times', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    await ensureEventCompletionTimeColumns(db);
    const resolved = await resolveMobileFlightTimesRequest(db, req);
    if (resolved.errorStatus) return res.status(resolved.errorStatus).json(resolved.error);
    if (!resolved.userMatchesEvent && !resolved.canManageFlightTimes) {
      return res.status(403).json({ error: 'User is not permitted to view flight times for this event' });
    }

    const settings = await loadMobileAppSettings(db);
    const eventId = String(req.query.eventId || '').trim();
    const completion = await db.eventCompletion.findUnique({ where: { scheduleEventId: eventId } }).catch(() => null);
    const logs = await db.flightLogEntry.findMany({ where: { scheduleEventId: eventId } }).catch(() => []);
    const flightTimes = buildMobileFlightTimesDefaults(resolved.event, settings, completion, logs);

    return res.json({
      success: true,
      snapshotKey: resolved.snapshot.date,
      event: resolved.event,
      flightTimes,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ GET /api/mobile/flight-times error:', error);
    res.status(500).json({ error: 'Failed to load mobile flight times', details: error.message });
  }
});

app.post('/api/mobile/flight-times', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    await ensureEventCompletionTimeColumns(db);
    const resolved = await resolveMobileFlightTimesRequest(db, req);
    if (resolved.errorStatus) return res.status(resolved.errorStatus).json(resolved.error);
    if (!resolved.canManageFlightTimes) return res.status(403).json({ error: 'User is not permitted to save flight times for this event' });

    const body = req.body || {};
    const eventId = String(body.eventId || '').trim();
    const clientUpdatedAt = String(body.clientEventUpdatedAt || '').trim();
    const serverEventUpdatedAt = String(resolved.event.postFlightUpdatedAt || resolved.event.updatedAt || '').trim();
    if (clientUpdatedAt && serverEventUpdatedAt && clientUpdatedAt !== serverEventUpdatedAt) {
      const settings = await loadMobileAppSettings(db);
      const completion = await db.eventCompletion.findUnique({ where: { scheduleEventId: eventId } }).catch(() => null);
      const logs = await db.flightLogEntry.findMany({ where: { scheduleEventId: eventId } }).catch(() => []);
      return res.status(409).json({
        success: false,
        conflict: true,
        message: 'Flight times changed since loaded',
        snapshotKey: resolved.snapshot.date,
        event: resolved.event,
        flightTimes: buildMobileFlightTimesDefaults(resolved.event, settings, completion, logs),
        serverTime: new Date().toISOString(),
      });
    }

    const settings = await loadMobileAppSettings(db);
    const serverTime = new Date().toISOString();
    const takeoffTime = toMobileTimeString(body.takeoffTime || resolved.event.takeoffTime || resolved.event.startTime);
    const landTime = toMobileTimeString(body.landTime || resolved.event.landTime || resolved.event.endTime || (
      resolved.event.startTime != null ? Number(resolved.event.startTime) + (Number(resolved.event.duration) || 1) : null
    ));
    const policyTaxi = Number(settings?.taxiGroundTime);
    const requestedTaxi = Number(body.taxiGroundTime);
    const taxiGroundTime = Number.isFinite(requestedTaxi) && requestedTaxi >= 0 ? Math.round(requestedTaxi * 10) / 10 : (Number.isFinite(policyTaxi) ? policyTaxi : 0.1);
    const airborneTime = calculateMobileAirborneHours(takeoffTime, landTime);
    const blockTime = Math.round((airborneTime + taxiGroundTime) * 10) / 10;
    const totalTime = blockTime;
    const typeDefaults = getMobileFlightTypeDefaults(resolved.event);
    const isFlightLog = body.isFlightLog !== undefined ? !!body.isFlightLog : typeDefaults.isFlightLog;
    const isFtdLog = body.isFtdLog !== undefined ? !!body.isFtdLog : typeDefaults.isFtdLog;
    const isSolo = body.isSolo !== undefined ? !!body.isSolo : typeDefaults.isSolo;
    const isDual = body.isDual !== undefined ? !!body.isDual : typeDefaults.isDual;
    const result = String(body.result || '').trim();
    if (result && !['DCO', 'DPCO', 'DNCO'].includes(result)) {
      return res.status(400).json({ error: 'result must be DCO, DPCO, DNCO, or blank' });
    }
    const aircraftNumber = String(body.aircraftNumber || resolved.event.aircraftNumber || resolved.event.aircraft || resolved.event.resourceId || '').trim();
    const from = String(body.from || resolved.event.origin || resolved.event.location || '').trim();
    const to = String(body.to || from || '').trim();
    const duty = String(body.duty || resolved.event.flightNumber || resolved.event.eventCode || resolved.event.title || '').trim();
    const approaches = body.approaches && typeof body.approaches === 'object' ? body.approaches : {};
    const approachAssignments = body.approachAssignments && typeof body.approachAssignments === 'object' ? body.approachAssignments : { ils: '', rnp: '', tacan: '', vor: '' };
    const parseOptionalFloat = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const traineeName = String(resolved.event.student || resolved.event.trainee || '').trim();
    const instructorName = String(resolved.event.instructor || resolved.event.pilot || '').trim();
    const traineeMatches = traineeName || resolved.event.traineeId
      ? await db.trainee.findMany({
          where: {
            OR: [
              resolved.event.traineeId ? { id: String(resolved.event.traineeId) } : undefined,
              traineeName ? { name: traineeName } : undefined,
              traineeName ? { fullName: traineeName } : undefined,
            ].filter(Boolean),
          },
          select: { id: true, idNumber: true, name: true, fullName: true },
          take: 1,
        }).catch(() => [])
      : [];
    const personnelMatches = instructorName
      ? await db.personnel.findMany({
          where: { name: instructorName },
          select: { id: true, idNumber: true, name: true },
          take: 1,
        }).catch(() => [])
      : [];
    const traineeRecord = traineeMatches?.[0] || null;
    const instructorRecord = personnelMatches?.[0] || null;

    const completionPayload = {
      scheduleEventId: eventId,
      eventCode: resolved.event.flightNumber || resolved.event.eventCode || eventId,
      eventDate: String(body.date || resolved.snapshotContext.date || '').slice(0, 10),
      eventType: resolved.event.type || resolved.event.eventType || 'flight',
      startTime: resolved.event.startTime ?? 0,
      duration: resolved.event.duration ?? 0,
      traineeId: traineeRecord?.id || null,
      traineeFullName: traineeName || resolved.event.pilot || 'Unknown',
      instructorName: instructorName || null,
      dcoResult: result || 'DCO',
      aircraftNumber,
      takeoffTime,
      landTime,
      airborneTime,
      taxiGroundTime,
      blockTime,
      totalFlightTime: totalTime,
      isSolo,
      isDual,
      isCountedAsElce: result !== 'DNCO',
      recordedBy: resolved.effectiveUser.userId || resolved.effectiveUser.id || req.userId,
      source: 'post_flight_mobile',
    };

    let completion = null;
    if (['DCO', 'DPCO', 'DNCO'].includes(result)) {
      completion = await db.eventCompletion.upsert({
        where: { scheduleEventId: eventId },
        create: completionPayload,
        update: completionPayload,
      });
    } else {
      await db.eventCompletion.deleteMany({ where: { scheduleEventId: eventId } });
    }

    const baseLogPayload = {
      scheduleEventId: eventId,
      eventCode: completionPayload.eventCode,
      eventDate: completionPayload.eventDate,
      eventType: completionPayload.eventType,
      aircraftNumber,
      fromIcao: from || null,
      toIcao: to || null,
      duty,
      isSolo,
      isDual,
      isFlightLog,
      isFtdLog,
      takeoffTime,
      landTime,
      airborneTime,
      taxiGroundTime,
      blockTime,
      totalTime,
      nightTime: parseOptionalFloat(body.nightTime),
      ifActualTime: parseOptionalFloat(body.ifActualTime),
      ifSimTime: parseOptionalFloat(body.ifSimTime),
      ineffectiveTime: parseOptionalFloat(body.ineffectiveTime),
      ilsCount: parseInt(approaches.ils, 10) || 0,
      rnpCount: parseInt(approaches.rnp, 10) || 0,
      tacanCount: parseInt(approaches.tacan, 10) || 0,
      vorCount: parseInt(approaches.vor, 10) || 0,
      recordedBy: resolved.effectiveUser.userId || resolved.effectiveUser.id || req.userId,
    };

    async function upsertMobileFlightLog(payload) {
      const existing = await db.flightLogEntry.findFirst({
        where: { scheduleEventId: payload.scheduleEventId, personRole: payload.personRole },
        select: { id: true },
      });
      return existing
        ? db.flightLogEntry.update({ where: { id: existing.id }, data: payload })
        : db.flightLogEntry.create({ data: payload });
    }

    const savedLogs = [];
    if (traineeName) {
      savedLogs.push(await upsertMobileFlightLog({
        ...baseLogPayload,
        traineeId: traineeRecord?.id || null,
        personnelId: null,
        personName: traineeName,
        personRole: 'trainee',
        captainTime: isSolo ? totalTime : parseOptionalFloat(body.captainTime),
        instructorTime: null,
      }));
    }
    if (instructorName) {
      savedLogs.push(await upsertMobileFlightLog({
        ...baseLogPayload,
        traineeId: null,
        personnelId: instructorRecord?.id || null,
        personName: instructorName,
        personRole: 'instructor',
        captainTime: null,
        instructorTime: parseOptionalFloat(body.instructorTime),
      }));
    }

    const beforeEvent = { ...resolved.event };
    let updatedEvent = null;
    function updatePostFlightEvent(event) {
      if (!mobileEventMatchesTarget(event, eventId)) return event;
      const next = {
        ...event,
        postFlightStatus: result || null,
        result: result || null,
        takeoffTime,
        landTime,
        airborneTime: airborneTime.toFixed(1),
        taxiGroundTime: taxiGroundTime.toFixed(1),
        blockTime: blockTime.toFixed(1),
        totalTime: totalTime.toFixed(1),
        approachAssignments,
        postFlightUpdatedAt: serverTime,
        updatedAt: serverTime,
      };
      updatedEvent = next;
      return next;
    }

    const nextScheduleEvents = resolved.scheduleEvents.map(updatePostFlightEvent);
    const nextTraineeEvents = resolved.traineeEvents.map(updatePostFlightEvent);
    const nextStaffEvents = resolved.staffEvents.map(updatePostFlightEvent);
    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot"
         SET "scheduleEvents" = $1::jsonb,
             "traineeEvents" = $2::jsonb,
             "staffEvents" = $3::jsonb,
             "savedAt" = NOW()
       WHERE date = $4::text`,
      JSON.stringify(nextScheduleEvents),
      JSON.stringify(nextTraineeEvents),
      JSON.stringify(nextStaffEvents),
      resolved.snapshot.date
    );

    const flightTimes = buildMobileFlightTimesDefaults(updatedEvent || resolved.event, settings, completion, savedLogs);
    await writeMobileFlightTimesAudit(db, req, resolved.effectiveUser, resolved.snapshot.date, beforeEvent, updatedEvent || resolved.event, flightTimes);

    return res.json({
      success: true,
      snapshotKey: resolved.snapshot.date,
      event: updatedEvent || resolved.event,
      flightTimes,
      serverTime,
    });
  } catch (error) {
    console.error('❌ POST /api/mobile/flight-times error:', error);
    res.status(500).json({ error: 'Failed to save mobile flight times', details: error.message });
  }
});

  // POST /api/mobile/flight-authorisation - Sign published schedule event authorisation
  app.post('/api/mobile/flight-authorisation', authenticateMobileJWT, async (req, res) => {
    try {
      const db = await getPrisma();
      const jwtUserId = req.userId;
      const {
        date,
        snapshotKey,
        eventId,
        role,
        signedBy,
        isVerbal = false,
        action = 'sign',
        notes,
        clientEventUpdatedAt
      } = req.body || {};

      if (!date || !eventId || !role) {
        return res.status(400).json({ error: 'date, eventId, and role are required' });
      }

      if (!['autho', 'captain'].includes(role)) {
        return res.status(400).json({ error: 'role must be autho or captain' });
      }

      const cleanAction = String(action || 'sign').trim().toLowerCase();
      if (!['sign', 'remove'].includes(cleanAction)) {
        return res.status(400).json({ error: 'action must be sign or remove' });
      }
      const isVerbalRequest = isVerbal === true || String(isVerbal).trim().toLowerCase() === 'true';

      const users = await db.$queryRawUnsafe(
        `SELECT id, "userId", "firstName", "lastName", email, "role", "isActive"
         FROM "User"
         WHERE "userId" = $1
         LIMIT 1`,
        jwtUserId
      );

      if (!users || users.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = users[0];
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      const canonicalMobileUser = await buildCanonicalMobileUserPayload(db, user);
      const canonicalPerson = canonicalMobileUser.person;
      const effectiveUser = canonicalMobileUser.user || user;

      const linkedPersonnel = await db.personnel.findMany({
        where: { userId: user.id },
        select: { id: true, idNumber: true, name: true, email: true }
      });

      function normalizeAuthValue(value) {
        if (value === null || value === undefined) return '';
        return String(value)
          .toLowerCase()
          .replace(/\s*[–-]\s*\w+\d+\s*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userFullNameReversed = `${user.lastName || ''}, ${user.firstName || ''}`.trim();
      const signatureName =
        (canonicalPerson?.type === 'staff' && (canonicalPerson.name || canonicalPerson.fullName)) ||
        (linkedPersonnel[0] && linkedPersonnel[0].name) ||
        userFullNameReversed ||
        userFullName ||
        signedBy ||
        jwtUserId;

      const snapshotRows = snapshotKey
        ? await db.$queryRawUnsafe(
            `SELECT date, "scheduleEvents", "traineeEvents", "staffEvents"
             FROM "DailySnapshot"
             WHERE date = $1::text
             LIMIT 1`,
            snapshotKey
          )
        : await db.$queryRawUnsafe(
            `SELECT date, "scheduleEvents", "traineeEvents", "staffEvents"
             FROM "DailySnapshot"
             WHERE date = $1::text OR date LIKE $2::text
             ORDER BY CASE WHEN date = $1::text THEN 0 ELSE 1 END`,
            date,
            `${date}__%`
          );

      if (!snapshotRows || snapshotRows.length === 0) {
        return res.status(404).json({ error: 'Published schedule snapshot not found' });
      }

      function eventMatchesTarget(event) {
        return String(event && (event.id || event.eventId || '')) === String(eventId);
      }

      const snapshot = snapshotRows.find((row) => [
        ...(Array.isArray(row.scheduleEvents) ? row.scheduleEvents : []),
        ...(Array.isArray(row.traineeEvents) ? row.traineeEvents : []),
        ...(Array.isArray(row.staffEvents) ? row.staffEvents : []),
      ].some(eventMatchesTarget)) || null;

      if (!snapshot) {
        return res.status(404).json({ error: 'Event not found in published schedule snapshot' });
      }

      const snapshotContext = getSnapshotContextFromKey(snapshot.date);
      if (snapshotContext.date && snapshotContext.date !== String(date).slice(0, 10)) {
        return res.status(400).json({ error: 'Snapshot key does not match requested date' });
      }

      const appSettings = await loadMobileAppSettings(db);
      if (!isMobileFlightAuthorisationRequired(appSettings)) {
        return res.status(403).json({ error: 'Flight authorisation is optional for this unit' });
      }
      if (isMobileFlightAuthorisationFrozen(appSettings)) {
        return res.status(403).json({ error: 'System is frozen; flight authorisation is not permitted' });
      }
      if (isPastMobileDfpDate(snapshotContext.date || date)) {
        return res.status(403).json({ error: 'Past DFP dates are locked for flight authorisation' });
      }

      const access = await getMobileAuthorisationAccess(db, effectiveUser, snapshotContext);
      if (!access.hasFlightAuthorisationPermission) {
        return res.status(403).json({ error: 'User is not permitted to authorise this flight' });
      }

      const scheduleEvents = Array.isArray(snapshot.scheduleEvents) ? snapshot.scheduleEvents : [];
      const traineeEvents = Array.isArray(snapshot.traineeEvents) ? snapshot.traineeEvents : [];
      const staffEvents = Array.isArray(snapshot.staffEvents) ? snapshot.staffEvents : [];

      const userMatchNames = new Set([
        jwtUserId,
        user.userId,
        user.email,
        effectiveUser.email,
        userFullName,
        userFullNameReversed,
        canonicalPerson?.name,
        canonicalPerson?.fullName,
        canonicalPerson?.email,
        canonicalPerson?.idNumber,
        ...linkedPersonnel.flatMap(person => [person.name, person.email, person.idNumber])
      ].map(normalizeAuthValue).filter(Boolean));

      function userMatchesEvent(event) {
        const fields = [event.instructor, event.pilot, event.crew, event.attendees];
        return fields.some(field => {
          if (Array.isArray(field)) {
            return field.some(item => userMatchNames.has(normalizeAuthValue(item)));
          }
          return userMatchNames.has(normalizeAuthValue(field));
        });
      }

      const allEvents = [...scheduleEvents, ...traineeEvents, ...staffEvents];
      const existingEvent = allEvents.find(eventMatchesTarget);

      if (!existingEvent) {
        return res.status(404).json({ error: 'Event not found in published schedule snapshot' });
      }

      if (role === 'captain' && !isVerbalRequest && !userMatchesEvent(existingEvent) && !access.permissions.includes('settings.superAdmin')) {
        return res.status(403).json({ error: 'User is not permitted to authorise this flight' });
      }

      const serverEventUpdatedAt = String(existingEvent.updatedAt || '').trim();
      const clientUpdatedAt = String(clientEventUpdatedAt || '').trim();
      if (clientUpdatedAt && serverEventUpdatedAt && clientUpdatedAt !== serverEventUpdatedAt) {
        const serverTime = new Date().toISOString();
        return res.status(409).json({
          success: false,
          conflict: true,
          message: 'Event changed since loaded',
          snapshotKey: snapshot.date,
          event: existingEvent,
          serverTime
        });
      }

      const serverTime = new Date().toISOString();
      let updatedEvent = null;
      const beforeEvent = { ...existingEvent };

      function updateEvent(event) {
        if (!eventMatchesTarget(event)) {
          return event;
        }

        const next = { ...event };
        const cleanNotes = (typeof notes === 'string' && notes.trim()) ? notes.trim() : '';

        if (cleanAction === 'remove') {
          if (isVerbalRequest) {
            next.isVerbalAuth = false;
            next.verbalAuthBy = null;
            if (String(next.authNotes || '').trim() === 'Verbal Auth received') {
              next.authNotes = null;
            }
          } else if (role === 'autho') {
            next.authoSignedBy = null;
            next.authoSignedAt = null;
          } else if (role === 'captain') {
            next.captainSignedBy = null;
            next.captainSignedAt = null;
          }
        } else if (isVerbalRequest) {
          next.isVerbalAuth = true;
          next.verbalAuthBy = signatureName;
          next.authNotes = cleanNotes || next.authNotes || 'Verbal Auth received';
        } else if (role === 'autho') {
          next.authoSignedBy = signatureName;
          next.authoSignedAt = serverTime;
          if (cleanNotes) {
            next.authNotes = cleanNotes;
          }
        } else if (role === 'captain') {
          next.captainSignedBy = signatureName;
          next.captainSignedAt = serverTime;
          if (cleanNotes) {
            next.authNotes = cleanNotes;
          }
        }

        const hasAutho = !!String(next.authoSignedBy || '').trim();
        const hasCaptain = !!String(next.captainSignedBy || '').trim();
        next.authorised = hasAutho && hasCaptain;
        next.dualAuthSignedAnnotation = next.authorised
          ? `AUTHO: ${next.authoSignedBy}; PIC: ${next.captainSignedBy}`
          : null;
        next.updatedAt = serverTime;

        updatedEvent = next;
        return next;
      }

      const nextScheduleEvents = scheduleEvents.map(updateEvent);
      const nextTraineeEvents = traineeEvents.map(updateEvent);
      const nextStaffEvents = staffEvents.map(updateEvent);

      await db.$executeRawUnsafe(
        `UPDATE "DailySnapshot"
         SET "scheduleEvents" = $1::jsonb,
             "traineeEvents" = $2::jsonb,
             "staffEvents" = $3::jsonb,
             "savedAt" = NOW()
         WHERE date = $4::text`,
        JSON.stringify(nextScheduleEvents),
        JSON.stringify(nextTraineeEvents),
        JSON.stringify(nextStaffEvents),
        snapshot.date
      );

      const auditAction = `${cleanAction}:${isVerbalRequest ? 'verbal' : role}`;
      await writeMobileFlightAuthorisationAudit(db, req, effectiveUser, snapshot.date, beforeEvent, updatedEvent, auditAction);

      console.log(`✅ POST /api/mobile/flight-authorisation - ${auditAction} event=${eventId} snapshot=${snapshot.date} user=${jwtUserId}`);

      return res.json({
        success: true,
        snapshotKey: snapshot.date,
        event: updatedEvent,
        authorisation: {
          authoSignedBy: updatedEvent.authoSignedBy || null,
          authoSignedAt: updatedEvent.authoSignedAt || null,
          captainSignedBy: updatedEvent.captainSignedBy || null,
          captainSignedAt: updatedEvent.captainSignedAt || null,
          isVerbalAuth: updatedEvent.isVerbalAuth === true,
          verbalAuthBy: updatedEvent.verbalAuthBy || null,
          dualAuthSignedAnnotation: updatedEvent.dualAuthSignedAnnotation || null,
          authorised: updatedEvent.authorised === true,
          isFullyAuthorised: !!updatedEvent.authorised
        },
        serverTime
      });
    } catch (error) {
      console.error('❌ POST /api/mobile/flight-authorisation error:', error);
      return res.status(500).json({ error: 'Failed to update flight authorisation', details: error.message });
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

      // Build name variants from a dotted user ID for staff profile matching.
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

      // Build name variants from a dotted user ID for trainee profile matching.
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
app.post('/api/admin/set-user-password', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
      // Parse rank/name strings by treating the final word as the surname.
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
app.post('/api/admin/set-user-password-by-id', adminSensitiveRateLimit, async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
  if (!validateSeedEndpointSecret(req, res)) return;
  if (process.env.DFP_SEED_DEMO_SYLLABUS_DATA !== 'true') {
    return res.status(400).json({
      success: false,
      error: 'Demo syllabus seed disabled',
      message: 'The built-in demo syllabus seed is disabled for commercial deployments. Set DFP_SEED_DEMO_SYLLABUS_DATA=true only for deliberate demo or test environments, or load syllabus data through the configured import tools.',
    });
  }
  const { force } = req.query;

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
  const setStaticCacheHeaders = (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }
    if (['.js', '.css', '.mjs', '.json', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.woff', '.woff2'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    }
  };
  app.use(express.static(staticPath, { etag: true, lastModified: true, setHeaders: setStaticCacheHeaders }));
  app.use('/flight-school-app', express.static(staticPath, { etag: true, lastModified: true, setHeaders: setStaticCacheHeaders }));
  console.log(`✅ Serving static files from: ${staticPath} (at / and /flight-school-app/) with cacheable assets and fresh HTML`);
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
        "unitType" TEXT NOT NULL DEFAULT '',
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
  if (existing?.[0]?.count > 0) {
    await db.$executeRawUnsafe(`
      UPDATE "CommercialLicense"
      SET
        "licenseKey" = CASE
          WHEN "licenseKey" LIKE '%-EVAL'
            AND NOT EXISTS (
              SELECT 1
              FROM "CommercialLicense" existing_license
              WHERE existing_license."id" <> "CommercialLicense"."id"
                AND existing_license."licenseKey" = regexp_replace("CommercialLicense"."licenseKey", '-EVAL$', '-STARTER')
            )
            THEN regexp_replace("licenseKey", '-EVAL$', '-STARTER')
          ELSE "licenseKey"
        END,
        "licenseName" = CASE
          WHEN trim(regexp_replace(COALESCE("licenseName", ''), '^RAAF[[:space:]]+', '', 'i')) ~* '^Evaluation Licen[cs]e$'
            THEN 'Initial Licence'
          ELSE trim(regexp_replace(regexp_replace(regexp_replace(COALESCE("licenseName", ''), '^RAAF[[:space:]]+', '', 'i'), '[[:space:]]+Evaluation Licence$', ' Initial Licence', 'i'), '[[:space:]]+Evaluation License$', ' Initial Licence', 'i'))
        END,
        "features" = COALESCE("features", '{}'::jsonb) - 'developmentOnly' || '{"seededBy":"Initial licensing foundation"}'::jsonb,
        "notes" = CASE
          WHEN "notes" ILIKE 'Development licensing foundation record.%'
            THEN 'Initial licensing foundation record. Replace with signed licence files for production or offline customer deployments.'
          ELSE "notes"
        END,
        "updatedAt" = NOW()
      WHERE
        ("features"->>'seededBy' = 'Development licensing foundation'
          OR "licenseName" ILIKE '% Evaluation Licence'
          OR "licenseName" ILIKE '% Evaluation License'
          OR "licenseName" ILIKE 'Evaluation Licence'
          OR "licenseName" ILIKE 'Evaluation License'
          OR "licenseKey" LIKE '%-EVAL')
    `);
    return;
  }

  if (process.env.DFP_SEED_STARTER_COMMERCIAL_LICENSE !== 'true') {
    console.log('ℹ️  CommercialLicense table is empty - starter licence seed disabled');
    return;
  }

  const now = new Date().toISOString();
  const organisations = await db.$queryRawUnsafe(`
    SELECT "code", "name"
    FROM "CommercialOrganisation"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);
  const organisation = organisations?.[0] || { code: 'DEFAULT', name: 'Organisation' };
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
    `${organisationCode}-STARTER`,
    `${organisationName} Initial Licence`,
    moduleCodes,
    JSON.stringify({
      enforcementMode: 'Monitor Only',
      offlineCapable: false,
      seededBy: 'Initial licensing foundation',
    }),
    'Initial licensing foundation record. Replace with signed licence files for production or offline customer deployments.',
    now
  );
}

async function seedCommercialUserAccessIfEmpty(db) {
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialUserAccess"`);
  if (existing?.[0]?.count > 0) return;

  if (process.env.DFP_SEED_STARTER_USER_ACCESS !== 'true') {
    console.log('ℹ️  CommercialUserAccess table is empty - starter user access seed disabled');
    return;
  }

  const now = new Date().toISOString();
  const users = await db.$queryRawUnsafe(`SELECT id, "userId", username, "firstName", "lastName", role FROM "User" WHERE "isActive" = true`);
  const organisations = await db.$queryRawUnsafe(`SELECT "code" FROM "CommercialOrganisation" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" ASC LIMIT 1`);
  const organisationCode = String(organisations?.[0]?.code || 'DEFAULT').trim() || 'DEFAULT';
  const locations = await db.$queryRawUnsafe(`SELECT "code" FROM "CommercialLocation" WHERE "status" = 'ACTIVE'`);

  for (const user of users) {
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.userId;
    const elevated = ['SUPER_ADMIN', 'ADMIN'].includes(String(user.role || '').toUpperCase());
    const accessRole = elevated ? 'Platform Admin' : 'Viewer';
    const accessLevel = elevated ? 'Admin' : 'Read';

    for (const location of locations) {
      const scopeKey = `${user.userId}|${organisationCode}|${location.code}||`;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialUserAccess" ("id", "userId", "username", "displayName", "organisationCode", "locationCode", "unitCode", "moduleCode", "scopeKey", "role", "accessLevel", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, 'ACTIVE', '{}'::jsonb, $9::timestamp, $9::timestamp)
        ON CONFLICT ("scopeKey") DO NOTHING
      `, user.userId, user.username, displayName, organisationCode, location.code, scopeKey, accessRole, accessLevel, now);
    }
  }
}

async function seedCommercialConfigIfEmpty(db) {
  const [existingOrganisations, existingLocations, existingUnits] = await Promise.all([
    db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialOrganisation"`),
    db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialLocation"`),
    db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "CommercialUnit"`),
  ]);
  const organisationCount = Number(existingOrganisations?.[0]?.count || 0);
  const locationCount = Number(existingLocations?.[0]?.count || 0);
  const unitCount = Number(existingUnits?.[0]?.count || 0);
  if (organisationCount > 0 || locationCount > 0 || unitCount > 0) {
    if (organisationCount === 0 || locationCount === 0 || unitCount === 0) {
      console.warn('⚠️ Commercial platform configuration is partially empty; starter structure seed skipped to avoid restoring deleted customer setup.', {
        organisations: organisationCount,
        locations: locationCount,
        units: unitCount,
      });
    }
    return;
  }

  if (process.env.DFP_SEED_STARTER_COMMERCIAL_CONFIG !== 'true') {
    console.log('ℹ️  Commercial platform configuration tables are empty - starter commercial setup seed disabled');
    return;
  }

  const settingsRows = await db.$queryRawUnsafe(`SELECT data FROM "AppSettings" WHERE "orgId" = 'default' LIMIT 1`);
  const settings = settingsRows?.[0]?.data || {};
  const now = new Date().toISOString();
  const locationNames = Array.isArray(settings.locations)
    ? settings.locations.map((location) => String(location || '').trim()).filter(Boolean)
    : [];
  const units = Array.isArray(settings.units)
    ? settings.units.map((unit) => String(unit || '').trim()).filter(Boolean)
    : [];
  if (locationNames.length === 0 || units.length === 0) {
    console.log('ℹ️  Commercial platform configuration tables are empty - starter organisation seed skipped because no legacy locations/units were found.');
    return;
  }
  const abbreviations = settings.locationAbbreviations || {};
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
    VALUES (gen_random_uuid()::text, 'DEFAULT', 'Organisation', 'ACTIVE', $1::jsonb, $2::timestamp, $2::timestamp)
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

  const legacyAircraftLabel = String(settings.aircraftLabel || settings.aircraftType || '').trim();
  const legacyAircraftCode = String(settings.aircraftTypeCode || '').trim();
  const hasLegacyAircraftSettings = Boolean(legacyAircraftLabel || legacyAircraftCode);
  const seedAircraftName = legacyAircraftLabel || legacyAircraftCode;
  const seedAircraftCode = String(legacyAircraftCode || seedAircraftName)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase();
  const seedAircraftPrefixes = Array.isArray(settings.aircraftNumberPrefixes)
    ? settings.aircraftNumberPrefixes.map((prefix) => String(prefix || '').trim()).filter(Boolean)
    : [];
  const seedAircraftDefaultPrefix = seedAircraftPrefixes.includes(String(settings.aircraftNumberDefaultPrefix || '').trim())
    ? String(settings.aircraftNumberDefaultPrefix || '').trim()
    : (seedAircraftPrefixes[0] || '');

  if (hasLegacyAircraftSettings && seedAircraftCode) {
    await db.$executeRawUnsafe(`
      INSERT INTO "CommercialAircraftType" ("id", "code", "name", "category", "status", "settings", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, 'Training', 'ACTIVE', $3::jsonb, $4::timestamp, $4::timestamp)
      ON CONFLICT ("code") DO NOTHING
    `, seedAircraftCode, seedAircraftName, JSON.stringify({ source: 'Legacy app settings aircraft type' }), now);

    for (const locationName of locationNames) {
      const locationCode = locationIdentityFor(locationName).code;
      await db.$executeRawUnsafe(`
        INSERT INTO "CommercialResourcePool" ("id", "organisationCode", "locationCode", "unitCode", "aircraftTypeCode", "code", "name", "poolType", "status", "settings", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'DEFAULT', $1, NULL, $2, $3, $4, 'Shared', 'ACTIVE', $5::jsonb, $6::timestamp, $6::timestamp)
        ON CONFLICT ("code") DO NOTHING
      `, locationCode, seedAircraftCode, `${locationCode}-${seedAircraftCode}-POOL`, `${locationName} ${seedAircraftName} DFP Resource Rows`, JSON.stringify({
        applyToV2Runtime: true,
        aircraftLabel: seedAircraftName,
        aircraftNumberUsePrefix: seedAircraftPrefixes.length > 0,
        aircraftNumberPrefixes: seedAircraftPrefixes,
        aircraftNumberDefaultPrefix: seedAircraftDefaultPrefix,
        ftdLabel: 'FTD',
        cptLabel: 'CPT',
        aircraft: Number(settings.availableAircraftCount ?? 24),
        ftd: Number(settings.availableFtdCount ?? 5),
        cpt: Number(settings.availableCptCount ?? 5),
        standby: 4,
        ground: 6,
      }), now);
    }
  } else {
    console.log('ℹ️  Commercial platform aircraft/resource row seed skipped because no legacy aircraft type was configured.');
  }

  const modules = [
    ['DFP', 'Daily Flying Program', 'Core schedule, authorisation and publication workflow'],
    ['TRAINING', 'Training', 'Courses, trainees, syllabus progression and training report records'],
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
      VALUES (gen_random_uuid()::text, 'DEFAULT', $1, $2, $3, 'Unit', $4::jsonb, true, $5::timestamp, $5::timestamp)
    `, unit.code, seedAircraftCode || null, `${unit.code} Default Scheduling Rules`, JSON.stringify({
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
    // CourseSettings: stores selectedAcademicLmp + excludedCourses.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseSettings" (
        "id"                  TEXT         NOT NULL,
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
    await db.$executeRawUnsafe(`
      ALTER TABLE "Trainee" ALTER COLUMN "lmpType" SET DEFAULT '';
    `);
    console.log('✅ Trainee.lmpType default ready');
  } catch (err) {
    console.error('❌ Failed to ensure Trainee.lmpType default:', err.message);
  }
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
    await db.$executeRawUnsafe(`
      ALTER TABLE "Trainee" ADD COLUMN IF NOT EXISTS "role" TEXT;
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "Trainee" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "Trainee" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
    `);
    console.log('✅ Trainee role/preferences/photo columns ready');
  } catch (err) {
    console.error('❌ Failed to ensure Trainee role/preferences/photo columns:', err.message);
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

async function ensureCourseLeadershipColumns(db) {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "courseCommander" TEXT;
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "deputyCourseCommander" TEXT;
    `);
    console.log('✅ Course leadership columns ready');
  } catch (err) {
    console.error('❌ Failed to ensure Course leadership columns:', err.message);
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
      await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityHistory" ADD COLUMN IF NOT EXISTS "locationCode" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityHistory" ADD COLUMN IF NOT EXISTS "unitCode" TEXT`);
      await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "AircraftAvailabilityHistory_date_key"`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_context_date_idx" ON "AircraftAvailabilityHistory"("locationCode", "unitCode", "date")`);
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
    await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityEvent" ADD COLUMN IF NOT EXISTS "locationCode" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "AircraftAvailabilityEvent" ADD COLUMN IF NOT EXISTS "unitCode" TEXT`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_date ON "AircraftAvailabilityEvent"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_context_date ON "AircraftAvailabilityEvent"("locationCode", "unitCode", "date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_timestamp ON "AircraftAvailabilityEvent"("timestamp")`);
    console.log('✅ AircraftAvailabilityEvent table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityEvent table:', err.message);
  }
}

const aircraftAvailabilityContextFromRequest = (source = {}) => {
  const locationCode = String(source.locationCode || source.school || source.location || '').trim().toUpperCase();
  const unitCode = String(source.unitCode || source.unit || '').trim().toUpperCase();
  return {
    locationCode: locationCode || null,
    unitCode: unitCode || null,
  };
};

const addAircraftAvailabilityContextFilters = (where, params, context, columns = ['locationCode', 'unitCode']) => {
  if (columns.includes('locationCode') && context.locationCode) {
    params.push(context.locationCode);
    where.push(`"locationCode" = $${params.length}::text`);
  }
  if (columns.includes('unitCode') && context.unitCode) {
    params.push(context.unitCode);
    where.push(`"unitCode" = $${params.length}::text`);
  }
};

const addAircraftAvailabilityHistoryContextFilters = (where, params, context, columns = ['locationCode', 'unitCode']) => {
  if (columns.includes('locationCode') && context.locationCode) {
    params.push(context.locationCode);
    where.push(`("locationCode" = $${params.length}::text OR "locationCode" IS NULL OR "locationCode" = '')`);
  }
  if (columns.includes('unitCode') && context.unitCode) {
    params.push(context.unitCode);
    where.push(`("unitCode" = $${params.length}::text OR "unitCode" IS NULL OR "unitCode" = '')`);
  }
};

// GET /api/aircraft-availability-history
// Returns history records, scoped by date plus optional location/unit context.
app.get('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { startDate, endDate } = req.query;
    const context = aircraftAvailabilityContextFromRequest(req.query);
    let query = `SELECT * FROM "AircraftAvailabilityHistory"`;
    const params = [];
    const where = [];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      where.push(`"date" >= $1::text AND "date" <= $2::text`);
    } else if (startDate) {
      params.push(startDate);
      where.push(`"date" >= $1::text`);
    } else if (endDate) {
      params.push(endDate);
      where.push(`"date" <= $1::text`);
    }
    addAircraftAvailabilityHistoryContextFilters(where, params, context);
    if (where.length > 0) query += ` WHERE ${where.join(' AND ')}`;
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

    const contextRank = (record) => {
      let rank = 0;
      const recordLocation = String(record.locationCode || '').trim().toUpperCase();
      const recordUnit = String(record.unitCode || '').trim().toUpperCase();
      if (context.locationCode && recordLocation === context.locationCode) rank += 2;
      else if (!recordLocation) rank += 1;
      if (context.unitCode && recordUnit === context.unitCode) rank += 2;
      else if (!recordUnit) rank += 1;
      return rank;
    };
    const recordsByDate = new Map();
    for (const record of records) {
      const existing = recordsByDate.get(record.date);
      if (!existing || contextRank(record) >= contextRank(existing)) {
        recordsByDate.set(record.date, record);
      }
    }
    const dedupedRecords = Array.from(recordsByDate.values());

    console.log(`✅ GET /api/aircraft-availability-history - context=${context.locationCode || '*'}-${context.unitCode || '*'} returning ${dedupedRecords.length} records`);
    // Return both 'records' (expected by frontend) and 'history' (legacy) for compatibility
    res.json({ records: dedupedRecords, history: dedupedRecords });
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
    const { date, totalFleet, totalAircraft, dailyAverage, flyingWindowStart, flyingWindowEnd } = req.body;
    const context = aircraftAvailabilityContextFromRequest(req.body);
    if (!date) return res.status(400).json({ error: 'date is required' });

    const columns = await db.$queryRawUnsafe(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'AircraftAvailabilityHistory'
      ORDER BY ordinal_position
    `);
    const columnNames = columns.map(c => c.column_name);
    const fleetColumn = columnNames.includes('totalAircraft') ? 'totalAircraft' : 'totalFleet';
    const fleetValue = Number(totalAircraft ?? totalFleet ?? 0);

    const where = [`"date" = $1::text`];
    const whereParams = [date];
    if (columnNames.includes('locationCode')) {
      whereParams.push(context.locationCode);
      where.push(`"locationCode" IS NOT DISTINCT FROM $${whereParams.length}::text`);
    }
    if (columnNames.includes('unitCode')) {
      whereParams.push(context.unitCode);
      where.push(`"unitCode" IS NOT DISTINCT FROM $${whereParams.length}::text`);
    }

    const existing = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE ${where.join(' AND ')} LIMIT 1`,
      ...whereParams
    );

    const values = {
      [fleetColumn]: fleetValue,
      dailyAverage: Number(dailyAverage || 0),
      availabilityPct: fleetValue > 0 ? (Number(dailyAverage || 0) / fleetValue) * 100 : 0,
      flyingWindowStart: flyingWindowStart || null,
      flyingWindowEnd: flyingWindowEnd || null,
    };
    const writableFields = Object.entries(values).filter(([key]) => columnNames.includes(key));

    if (existing.length > 0) {
      const setClauses = writableFields.map(([key], idx) => `"${key}" = $${whereParams.length + idx + 1}`);
      if (columnNames.includes('lastCalculatedAt')) setClauses.push('"lastCalculatedAt" = NOW()');
      if (columnNames.includes('updatedAt')) setClauses.push('"updatedAt" = NOW()');
      await db.$executeRawUnsafe(
        `UPDATE "AircraftAvailabilityHistory" SET ${setClauses.join(', ')} WHERE ${where.join(' AND ')}`,
        ...whereParams,
        ...writableFields.map(([, value]) => value)
      );
    } else {
      const insertColumns = [];
      const insertValues = [];
      const insertParams = [];
      let paramIdx = 1;

      const idColumn = columns.find(c => c.column_name === 'id');
      if (idColumn && !idColumn.column_default) {
        insertColumns.push('"id"');
        insertValues.push('gen_random_uuid()::text');
      }
      insertColumns.push('"date"');
      insertValues.push(`$${paramIdx++}::text`);
      insertParams.push(date);

      if (columnNames.includes('locationCode')) {
        insertColumns.push('"locationCode"');
        insertValues.push(`$${paramIdx++}::text`);
        insertParams.push(context.locationCode);
      }
      if (columnNames.includes('unitCode')) {
        insertColumns.push('"unitCode"');
        insertValues.push(`$${paramIdx++}::text`);
        insertParams.push(context.unitCode);
      }
      for (const [key, value] of writableFields) {
        insertColumns.push(`"${key}"`);
        insertValues.push(`$${paramIdx++}`);
        insertParams.push(value);
      }
      if (columnNames.includes('lastCalculatedAt')) {
        insertColumns.push('"lastCalculatedAt"');
        insertValues.push('NOW()');
      }
      if (columnNames.includes('createdAt')) {
        insertColumns.push('"createdAt"');
        insertValues.push('NOW()');
      }
      if (columnNames.includes('updatedAt')) {
        insertColumns.push('"updatedAt"');
        insertValues.push('NOW()');
      }
      await db.$executeRawUnsafe(
        `INSERT INTO "AircraftAvailabilityHistory" (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`,
        ...insertParams
      );
    }

    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE ${where.join(' AND ')} LIMIT 1`,
      ...whereParams
    );
    console.log(`✅ POST /api/aircraft-availability-history - upserted record for date: ${date}, context=${context.locationCode || '*'}-${context.unitCode || '*'}`);
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
    const { date, locationCode, unitCode } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const whereClauses = [`"date" = $1::text`];
    const params = [date];
    if (locationCode) {
      params.push(String(locationCode));
      whereClauses.push(`"locationCode" = $${params.length}::text`);
    }
    if (unitCode) {
      params.push(String(unitCode));
      whereClauses.push(`"unitCode" = $${params.length}::text`);
    }
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE ${whereClauses.join(' AND ')} ORDER BY "timestamp" ASC`,
      ...params
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
    const { date, availableCount, notes, timestamp, changeType, recordedBy, locationCode, unitCode, flyingWindowStart, flyingWindowEnd, clientLocalHour, clientTimezoneOffsetHours } = req.body;
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
      const dedupWhere = [`"date" = $1::text`];
      const dedupParams = [date];
      if (locationCode) {
        dedupParams.push(String(locationCode));
        dedupWhere.push(`"locationCode" = $${dedupParams.length}::text`);
      }
      if (unitCode) {
        dedupParams.push(String(unitCode));
        dedupWhere.push(`"unitCode" = $${dedupParams.length}::text`);
      }
      const lastRows = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityEvent" WHERE ${dedupWhere.join(' AND ')} ORDER BY "timestamp" DESC LIMIT 1`,
        ...dedupParams
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
    // locationCode / unitCode - scope availability so one unit cannot overwrite another unit's current value
    if (colNames.includes('locationCode')) { insertCols.push('"locationCode"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(locationCode ? String(locationCode) : null); }
    if (colNames.includes('unitCode')) { insertCols.push('"unitCode"'); insertVals.push(`$${paramIdx++}::text`); insertParams.push(unitCode ? String(unitCode) : null); }
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
    const insertedWhere = [`"date" = $1::text`];
    const insertedParams = [date];
    if (locationCode) {
      insertedParams.push(String(locationCode));
      insertedWhere.push(`"locationCode" = $${insertedParams.length}::text`);
    }
    if (unitCode) {
      insertedParams.push(String(unitCode));
      insertedWhere.push(`"unitCode" = $${insertedParams.length}::text`);
    }
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE ${insertedWhere.join(' AND ')} ORDER BY "timestamp" DESC LIMIT 1`,
      ...insertedParams
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
    const { date, flyingWindowStart, flyingWindowEnd, totalFleet, locationCode, unitCode, clientTimezoneOffsetHours, clientLocalHour, clientTimezoneOffset } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const eventWhere = [`"date" = $1::text`];
    const eventParams = [date];
    if (locationCode) {
      eventParams.push(String(locationCode));
      eventWhere.push(`"locationCode" = $${eventParams.length}::text`);
    }
    if (unitCode) {
      eventParams.push(String(unitCode));
      eventWhere.push(`"unitCode" = $${eventParams.length}::text`);
    }
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE ${eventWhere.join(' AND ')} ORDER BY "timestamp" ASC`,
      ...eventParams
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
      const historyWhere = [`"date" = $1::text`];
      const historyParams = [date];
      if (historyColumnNames.includes('locationCode')) {
        historyParams.push(locationCode ? String(locationCode) : null);
        historyWhere.push(`"locationCode" IS NOT DISTINCT FROM $${historyParams.length}::text`);
      }
      if (historyColumnNames.includes('unitCode')) {
        historyParams.push(unitCode ? String(unitCode) : null);
        historyWhere.push(`"unitCode" IS NOT DISTINCT FROM $${historyParams.length}::text`);
      }
      const existing = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityHistory" WHERE ${historyWhere.join(' AND ')} LIMIT 1`,
        ...historyParams
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
        const setClauses = writableFields.map(([key], idx) => `"${key}" = $${historyParams.length + idx + 1}`);
        if (historyColumnNames.includes('lastCalculatedAt')) setClauses.push('"lastCalculatedAt" = NOW()');
        if (historyColumnNames.includes('updatedAt')) setClauses.push('"updatedAt" = NOW()');
        await db.$executeRawUnsafe(
          `UPDATE "AircraftAvailabilityHistory" SET ${setClauses.join(', ')} WHERE ${historyWhere.join(' AND ')}`,
          ...historyParams,
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

        if (historyColumnNames.includes('locationCode')) {
          insertColumns.push('"locationCode"');
          insertValues.push(`$${paramIdx++}::text`);
          insertParams.push(locationCode ? String(locationCode) : null);
        }
        if (historyColumnNames.includes('unitCode')) {
          insertColumns.push('"unitCode"');
          insertValues.push(`$${paramIdx++}::text`);
          insertParams.push(unitCode ? String(unitCode) : null);
        }

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

	    const updatedWhere = [`"date" = $1::text`];
	    const updatedParams = [date];
	    if (locationCode) {
	      updatedParams.push(String(locationCode));
	      updatedWhere.push(`"locationCode" = $${updatedParams.length}::text`);
	    }
	    if (unitCode) {
	      updatedParams.push(String(unitCode));
	      updatedWhere.push(`"unitCode" = $${updatedParams.length}::text`);
	    }
	    const updated = await db.$queryRawUnsafe(
	      `SELECT * FROM "AircraftAvailabilityHistory" WHERE ${updatedWhere.join(' AND ')}`, ...updatedParams
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

	    console.log(`✅ POST /api/aircraft-availability-recalculate - date: ${date}, context=${locationCode || '*'}-${unitCode || '*'}, average: ${dailyAverage.toFixed(2)}, offset: ${clientUtcOffsetHours}h, effectiveEnd=${effectiveEndTime}`);
    // Return both 'record' and 'summary' so all callers work
    res.json({ success: true, record, summary: record, dailyAverage, date, eventCount: events.length });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-recalculate error:', error);
    res.status(500).json({ error: 'Failed to recalculate', details: error.message });
  }
});

// GET /api/aircraft-availability-current - Get the current aircraft availability
// Returns the most recent event for the requested location/unit (any date) so availability
// persists across days/restarts without leaking between units.
app.get('/api/aircraft-availability-current', async (req, res) => {
	  try {
	    const db = await getPrisma();
	    const locationCode = req.query.locationCode ? String(req.query.locationCode) : '';
	    const unitCode = req.query.unitCode ? String(req.query.unitCode) : '';

	    let events = [];
	    if (locationCode && unitCode) {
	      events = await db.$queryRawUnsafe(
	        `SELECT * FROM "AircraftAvailabilityEvent"
	         WHERE "locationCode" = $1::text AND "unitCode" = $2::text
	         ORDER BY "timestamp" DESC LIMIT 1`,
	        locationCode,
	        unitCode
	      );
	    }

	    if (events.length === 0 && unitCode) {
	      events = await db.$queryRawUnsafe(
	        `SELECT * FROM "AircraftAvailabilityEvent"
	         WHERE "unitCode" = $1::text
	         ORDER BY "timestamp" DESC LIMIT 1`,
	        unitCode
	      );
	    }

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
	      locationCode: latest.locationCode || null,
	      unitCode: latest.unitCode || null,
	      current: {
	        availableCount: Number(latest.availableCount),
	        totalFleet: Number(latest.totalAircraft ?? latest.totalFleet ?? 15),
	        totalAircraft: Number(latest.totalAircraft ?? latest.totalFleet ?? 15),
	        timestamp: latest.timestamp,
	        id: latest.id,
	        locationCode: latest.locationCode || null,
	        unitCode: latest.unitCode || null
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
  const existingOverlayMap = new Map((Array.isArray(options.existingOverlays) ? options.existingOverlays : [])
    .map(item => [item?.id || item?.code, item])
    .filter(([overlayId]) => Boolean(overlayId)));

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
    const existingOverlay = existingOverlayMap.get(overlayId);
    if (existingOverlay && sameLmpEventsForSync([existingOverlay], [payload])) {
      if (options.stats && typeof options.stats === 'object') {
        options.stats.skippedUnchanged = (options.stats.skippedUnchanged || 0) + 1;
      }
      continue;
    }
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
  return (rows || []).map(parseTraineeLmpOverlayRow).filter(Boolean);
}

async function loadActiveTraineeLmpOverlaysByTraineeId(db) {
  const rows = await db.$queryRawUnsafe(
    `SELECT * FROM "TraineeLmpOverlay" WHERE "isActive" = true ORDER BY "orderKey" ASC NULLS LAST, "createdAt" ASC`
  );
  const overlaysByTraineeId = new Map();
  (rows || []).forEach(row => {
    if (!row?.traineeId) return;
    const overlay = parseTraineeLmpOverlayRow(row);
    if (!overlay) return;
    if (!overlaysByTraineeId.has(row.traineeId)) overlaysByTraineeId.set(row.traineeId, []);
    overlaysByTraineeId.get(row.traineeId).push(overlay);
  });
  return overlaysByTraineeId;
}

function parseTraineeLmpOverlayRow(row) {
  if (!row) return null;
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  if (!payload || typeof payload !== 'object') return null;
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
}

async function loadMasterSyllabusForLmpType(db, lmpType) {
  try {
    if (!String(lmpType || '').trim()) return [];
    const allItems = await db.$queryRawUnsafe(
      `SELECT * FROM "SyllabusItem" WHERE "isActive" = true ORDER BY "sortOrder" ASC`
    );
    if (!allItems || allItems.length === 0) return [];
    const parsed = allItems.map(normaliseSyllabusItemForRuntime);
    return parsed.filter(item => syllabusItemMatchesConfiguredCourse(item, lmpType));
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
  return String(trainee?.lmpType || trainee?.course || '').trim();
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
    if (process.env.DFP_SEED_STARTER_CANCELLATION_CODES !== 'true') {
      console.log('ℹ️  CancellationCode table is empty - setup cancellation code seed disabled');
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
    console.log(`✅ Seeded ${defaults.length} setup cancellation codes`);
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// GET /api/historical-data - Load persisted published schedules and Training Reports.
app.get('/api/historical-data', async (req, res) => {
  try {
    if (!validateSeedEndpointSecret(req, res)) return;
    const db = await getPrisma();

    // Load publishedSchedules backup
    const schedulesBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_published_schedules' },
      orderBy: { createdAt: 'desc' }
    });

    // Compatibility backup type retained for historical Training Reports.
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

// POST /api/historical-data/save - Save published schedules and Training Reports.
app.post('/api/historical-data/save', async (req, res) => {
  try {
    if (!validateSeedEndpointSecret(req, res)) return;
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
    if (!validateSeedEndpointSecret(req, res)) return;
    const db = await getPrisma();
    const bodyCourseConfig = normaliseHistoricalSeedCourseConfig(req.body?.courseConfig);
    const bodySyllabusSequences = normaliseHistoricalSeedSyllabusSequences(req.body?.syllabusSequences);
    const allowDemoHistoricalSeed = process.env.DFP_SEED_DEMO_HISTORICAL_DATA === 'true';

    if (Object.keys(bodyCourseConfig).length === 0 && !allowDemoHistoricalSeed) {
      return res.status(400).json({
        success: false,
        error: 'Historical seed course setup is required',
        message: 'Provide courseConfig and syllabusSequences in the request body, or set DFP_SEED_DEMO_HISTORICAL_DATA=true for a deliberate demo-data seed.',
      });
    }

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
    // This ensures a clean slate for IndividualLMP, training reports, and scores
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

    const instructorQualifiedStaff = instructors.filter((i) => i.isQFI);

    if (trainees.length === 0) {
      return res.status(400).json({ error: 'No active trainees found in database' });
    }
    if (instructorQualifiedStaff.length === 0) {
      return res.status(400).json({ error: 'No staff with an instructor qualification found in database' });
    }

    console.log(`🌱 Seeding historical data for ${trainees.length} trainees with ${instructorQualifiedStaff.length} staff with instructor qualifications`);

    // Course configuration supplied by the admin performing the seed.
    // progressRange: [startEvent, endEvent] places each trainee inside that range.
    // centreEvent keeps the original centre-point behaviour for compatible seeds.
    const demoCourseConfig = {
      'ADF301': { startDate: '2023-04-01', lmpType: 'BPC+IPC', progressRange: ['BIF TUT2', 'BGF23'], defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
      'ADF302': { startDate: '2025-08-01', lmpType: 'BPC+IPC', progressRange: ['BGF10', 'BGF19'], defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
      'ADF303': { startDate: '2025-12-01', lmpType: 'BPC+IPC', progressRange: ['BGF1', 'BGF5'], defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
      'FIC210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3', defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
      'FIC211': { startDate: '2026-01-11', lmpType: 'FIC', centreEvent: 'FIC4', defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
      'FIC 210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3', defaultGroundHours: 2.0, defaultProceduralTrainerHours: 1.0, defaultSimulatorHours: 2.0, defaultFlightHours: 1.2 },
    };
    const courseConfig = Object.keys(bodyCourseConfig).length > 0
      ? bodyCourseConfig
      : allowDemoHistoricalSeed
        ? demoCourseConfig
        : {};

    const demoSyllabusSequences = {
      'BPC+IPC': [
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
      ],
      FIC: [
      'FIC MB1','FIC MB2','FIC FTD1','FIC FTD2',
      'FIC1','FIC2','FIC3','FIC FTD3','FIC4','FIC5','FIC6',
      'FIC FTD4','FIC FTD5',
      'FIC IF1','FIC IF2','FIC IF3','FIC IF4','FIC FTD6',
      'AIT1','AIT2','AIT3','AIT4','AIT5','AIT6','AIT7','AIT8',
      ],
    };
    const syllabusSequences = Object.keys(bodySyllabusSequences).length > 0
      ? bodySyllabusSequences
      : allowDemoHistoricalSeed
        ? demoSyllabusSequences
        : {};

    // Event type classification for generating ScheduleEvent records
    const getEventType = (code) => {
      if (code.includes('FTD') || code.includes('CPT') || code.includes('TUT')) return 'ftd';
      if (code.includes('MB') || code.includes('QUIZ') || code.includes('NAVPT') || code.includes('PERRT')) return 'ground';
      return 'flight';
    };

    const getEventDuration = (code, seedConfig = {}) => {
      if (code.includes('MB') || code.includes('TUT') || code.includes('QUIZ') || code.includes('NAVPT')) {
        return Number(seedConfig.defaultGroundHours ?? 2.0);
      }
      if (code.includes('CPT')) {
        return Number(seedConfig.defaultProceduralTrainerHours ?? 1.0);
      }
      if (code.includes('FTD')) {
        return Number(seedConfig.defaultSimulatorHours ?? 1.0);
      }
      return Number(seedConfig.defaultFlightHours ?? 1.3);
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

    // Training report ALL_ELEMENTS - exact 22 elements matching the shared report structure.
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

    // Training report grading: 1-5 scale (no 0 for historical data - all events completed satisfactorily)
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

      const syllabus = syllabusSequences[config.lmpType] || [];
      if (syllabus.length === 0) {
        console.warn(`⚠️ No historical seed event sequence supplied for training type ${config.lmpType} on course ${course}`);
        continue;
      }

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
      const shuffledInstructors = [...instructorQualifiedStaff].sort(() => rand() - 0.5);
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
        const duration = getEventDuration(code, config);

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

        // Generate training report for ALL event types
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

          // Mark this event as completed in IndividualLMP (training report exists = completed)
          // Strip asterisks for LMP matching (e.g. 'BIF FTD1*' → 'BIF FTD1')
          const normalizedCode = code.replace('*', '');
          traineeCompletedEvents[trainee.id].completedIds.add(normalizedCode);

        } else {
          // Ground/non-flight events: generate a DCO-only training report record (no element scores)
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
    // Set completedEventIds to the set of events that have a training report assessment
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
    if (!validateSeedEndpointSecret(req, res)) return;
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

    // Update training report dates
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
    if (!validateSeedEndpointSecret(req, res)) return;
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

async function getTraineeInstructorColumnModes(db) {
  const modes = { primaryInstructor: 'array', secondaryInstructor: 'array' };
  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'Trainee'
        AND a.attname IN ('primaryInstructor', 'secondaryInstructor')
        AND a.attnum > 0
        AND NOT a.attisdropped
    `);
    rows.forEach(row => {
      modes[row.column_name] = String(row.data_type || '').includes('[]') ? 'array' : 'text';
    });
  } catch (error) {
    console.warn('[TraineeReallocation] Could not detect instructor column modes:', error.message);
  }
  return modes;
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
function normaliseInstructorListForReallocation(value) {
  if (Array.isArray(value)) {
    return value.flatMap(item => normaliseInstructorListForReallocation(item));
  }
  if (value === null || value === undefined) return [];
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[]') return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normaliseInstructorListForReallocation(parsed);
    } catch {
      // Fall through for legacy malformed strings.
    }
  }
  return trimmed.split(/[;|]/).map(name => name.trim()).filter(Boolean);
}

function normaliseReallocationToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normaliseReallocationUnit(value) {
  return normaliseReallocationToken(value).toUpperCase();
}

function getReallocationQualificationIds(person) {
  const values = [];
  const add = (value) => {
    const token = normaliseReallocationToken(value);
    if (token && !values.includes(token)) values.push(token);
  };
  const collect = (source) => {
    if (Array.isArray(source)) {
      source.forEach(collect);
      return;
    }
    if (source && typeof source === 'object') {
      add(source.id || source.code || source.name || source.label);
      return;
    }
    String(source || '').split(/[,;|\n]/).forEach(add);
  };
  collect(person?.preferences?.qualifications);
  collect(person?.qualifications);
  if (person?.isQFI) add('qfi');
  if (person?.isCFI) add('cfi');
  if (person?.isOFI) add('ofi');
  if (person?.isIRE) add('ire');
  if (person?.isTestingOfficer) add('testing-officer');
  return values;
}

function isAssignableTraineeInstructor(person, options = {}) {
  if (!person || person.isActive === false) return false;
  if (person.isExecutive && !options.includeExecutives) return false;
  const role = String(person.role || '').toUpperCase();
  const category = String(person.category || '').toUpperCase();
  const qualificationIds = getReallocationQualificationIds(person);
  return Boolean(
    person.isQFI ||
    person.isCFI ||
    person.isOFI ||
    person.isIRE ||
    person.isTestingOfficer ||
    qualificationIds.some(id => ['qfi', 'cfi', 'ofi', 'ire', 'testingofficer', 'testing-officer', 'instructor'].includes(id)) ||
    ['A', 'B', 'C', 'D'].includes(category) ||
    role.includes('QFI') ||
    role.includes('IP') ||
    role.includes('INSTRUCTOR')
  );
}

function buildReallocation(trainees, personnel, options = {}) {
  const mode = options.mode === 'missingOnly' ? 'missingOnly' : 'all';
  const minSecondaryPerTrainee = Number.isFinite(Number(options.minSecondaryPerTrainee))
    ? Math.max(0, Number(options.minSecondaryPerTrainee))
    : 2;
  const includeExecutives = options.includeExecutives === true;
  const units = Array.from(new Set((trainees || [])
    .map(t => String(t.unit || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  const allResults = [];
  const untouched = [];
  const diagnostics = {
    mode,
    minSecondaryPerTrainee,
    includeExecutives,
    skippedExecutives: (personnel || []).filter(p => p.isExecutive && !includeExecutives).map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit || null,
      role: p.role || null
    })),
    units: {}
  };

  const primaryLoad = {};
  const secondaryLoad = {};
  if (mode === 'missingOnly') {
    (trainees || []).forEach(trainee => {
      normaliseInstructorListForReallocation(trainee.primaryInstructor).forEach(name => {
        primaryLoad[name] = (primaryLoad[name] || 0) + 1;
      });
      normaliseInstructorListForReallocation(trainee.secondaryInstructor).forEach(name => {
        secondaryLoad[name] = (secondaryLoad[name] || 0) + 1;
      });
    });
  }

  // Seeded deterministic shuffle for reproducibility
  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  };

  for (const unit of units) {
    const normalisedUnit = normaliseReallocationUnit(unit);
    const unitAllTrainees = trainees.filter(t => normaliseReallocationUnit(t.unit) === normalisedUnit);
    const unitTrainees = mode === 'missingOnly'
      ? unitAllTrainees.filter(t => (
        normaliseInstructorListForReallocation(t.primaryInstructor).length === 0 ||
        normaliseInstructorListForReallocation(t.secondaryInstructor).length < minSecondaryPerTrainee
      ))
      : unitAllTrainees;
    let unitStaff = personnel.filter(p => normaliseReallocationUnit(p.unit) === normalisedUnit && isAssignableTraineeInstructor(p, { includeExecutives }));
    const usedFallbackStaffPool = unitStaff.length === 0;
    if (usedFallbackStaffPool) {
      unitStaff = personnel.filter(p => isAssignableTraineeInstructor(p, { includeExecutives }));
    }
    const unitDiag = diagnostics.units[unit] = {
      activeTrainees: unitAllTrainees.length,
      targetTrainees: unitTrainees.length,
      assignableStaff: unitStaff.length,
      usedFallbackStaffPool,
      skippedExecutiveStaff: (personnel || []).filter(p => p.unit === unit && p.isExecutive && !includeExecutives).map(p => p.name),
      skippedNonInstructorStaff: (personnel || []).filter(p => p.unit === unit && !p.isExecutive && !isAssignableTraineeInstructor(p, { includeExecutives })).map(p => p.name),
      primaryBefore: {},
      secondaryBefore: {},
      primaryAfter: {},
      secondaryAfter: {},
      warnings: []
    };
    unitStaff.forEach(staff => {
      unitDiag.primaryBefore[staff.name] = primaryLoad[staff.name] || 0;
      unitDiag.secondaryBefore[staff.name] = secondaryLoad[staff.name] || 0;
    });
    if (mode === 'missingOnly') {
      unitAllTrainees
        .filter(t => !unitTrainees.some(target => target.id === t.id))
        .forEach(trainee => {
          untouched.push({
            id: trainee.id,
            name: trainee.name,
            fullName: trainee.fullName || trainee.name,
            course: trainee.course || '',
            unit: trainee.unit,
            primaryInstructors: normaliseInstructorListForReallocation(trainee.primaryInstructor),
            secondaryInstructors: normaliseInstructorListForReallocation(trainee.secondaryInstructor),
            untouched: true
          });
        });
    }
    if (unitTrainees.length === 0) {
      unitStaff.forEach(staff => {
        unitDiag.primaryAfter[staff.name] = primaryLoad[staff.name] || 0;
        unitDiag.secondaryAfter[staff.name] = secondaryLoad[staff.name] || 0;
      });
      continue;
    }
    if (unitStaff.length === 0) {
      console.log(`Skipping trainee reallocation for ${unit}: no matching staff found`);
      unitTrainees.forEach(trainee => {
        allResults.push({
          id: trainee.id,
          name: trainee.name,
          unit: trainee.unit,
          course: trainee.course || '',
          primaryInstructors: [],
          secondaryInstructors: [],
          warning: 'NO_ASSIGNABLE_UNIT_INSTRUCTORS'
        });
      });
      unitDiag.warnings.push('NO_ASSIGNABLE_UNIT_INSTRUCTORS');
      continue;
    }

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

    const primaryMap = {};
    shuffledTrainees.forEach(t => {
      const existing = normaliseInstructorListForReallocation(t.primaryInstructor);
      primaryMap[t.id] = mode === 'missingOnly' && existing.length > 0 ? existing[0] : null;
    });

    // Assign using lowest-load-first against current database load. In missing-only
    // mode, existing primaries remain untouched and still count toward balancing.
    for (const trainee of shuffledTrainees) {
      if (primaryMap[trainee.id]) continue;
      const eligible = shuffledStaff
        .sort((a, b) => {
          const diff = (primaryLoad[a.name] || 0) - (primaryLoad[b.name] || 0);
          return diff !== 0 ? diff : shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      if (eligible.length > 0) {
        primaryMap[trainee.id] = eligible[0].name;
        primaryLoad[eligible[0].name] = (primaryLoad[eligible[0].name] || 0) + 1;
      } else {
        console.log(`Warning: No primary available for ${trainee.name} (${unit})`);
      }
    }

    const secondaryMap = {};
    shuffledTrainees.forEach(t => {
      secondaryMap[t.id] = mode === 'missingOnly'
        ? normaliseInstructorListForReallocation(t.secondaryInstructor).slice(0, minSecondaryPerTrainee)
        : [];
    });

    // Helper: pick best secondary candidate (lowest load, excluding given set)
    const pickSecondary = (excludeSet) => {
      const candidates = shuffledStaff
        .filter(s => !excludeSet.has(s.name))
        .sort((a, b) => {
          const loadDiff = (secondaryLoad[a.name] || 0) - (secondaryLoad[b.name] || 0);
          if (loadDiff !== 0) return loadDiff;
          return shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      return candidates.length > 0 ? candidates[0] : null;
    };

    for (const trainee of shuffledTrainees) {
      while (secondaryMap[trainee.id].length < minSecondaryPerTrainee) {
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
          console.log(`Warning: No secondary available for ${trainee.name} (${unit})`);
          unitDiag.warnings.push(`NO_SECONDARY_AVAILABLE:${trainee.name}`);
          break;
        }

        secondaryMap[trainee.id].push(pick.name);
        secondaryLoad[pick.name] = (secondaryLoad[pick.name] || 0) + 1;
      }
    }

    // Log distribution for this unit
    const pDist = {};
    const sDist = {};
    unitStaff.forEach(staff => {
      unitDiag.primaryAfter[staff.name] = primaryLoad[staff.name] || 0;
      unitDiag.secondaryAfter[staff.name] = secondaryLoad[staff.name] || 0;
    });
    Object.values(unitDiag.primaryAfter).forEach(v => { pDist[v] = (pDist[v]||0)+1; });
    Object.values(unitDiag.secondaryAfter).forEach(v => { sDist[v] = (sDist[v]||0)+1; });
    console.log(`${unit} primary dist:`, JSON.stringify(pDist));
    console.log(`${unit} secondary dist:`, JSON.stringify(sDist));

    for (const trainee of shuffledTrainees) {
      allResults.push({
        id: trainee.id,
        name: trainee.name,
        fullName: trainee.fullName || trainee.name,
        course: trainee.course || '',
        unit: trainee.unit,
        primaryInstructors: primaryMap[trainee.id] ? [primaryMap[trainee.id]] : [],
        secondaryInstructors: secondaryMap[trainee.id],
        untouched: false
      });
    }
  }

  return {
    allocations: mode === 'missingOnly' ? [...untouched, ...allResults] : allResults,
    targetAllocations: allResults,
    diagnostics
  };
}

// GET /api/trainee-reallocation/preview - Preview reallocation without saving
app.get('/api/trainee-reallocation/preview', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const mode = req.query.mode === 'missingOnly' ? 'missingOnly' : 'all';
    const includeExecutives = req.query.includeExecutives === 'true';
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        course: true,
        unit: true,
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });
    const personnel = await prisma.personnel.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        role: true,
        isActive: true,
        qualifications: true,
        category: true,
        isExecutive: true,
        isQFI: true,
        isCFI: true,
        isOFI: true,
        isIRE: true,
        isTestingOfficer: true
      }
    });

    const allocationResult = buildReallocation(trainees, personnel, { mode, includeExecutives, minSecondaryPerTrainee: 2 });
    const allResults = allocationResult.allocations;
    const targetResults = allocationResult.targetAllocations;

    const summary = {
      total: allResults.length,
      target: targetResults.length,
      mode,
      includeExecutives,
      primary: {
        with1: targetResults.filter(r => r.primaryInstructors.length === 1).length,
        with0: targetResults.filter(r => r.primaryInstructors.length === 0).length,
      },
      secondary: {
        with3: targetResults.filter(r => r.secondaryInstructors.length === 3).length,
        with2: targetResults.filter(r => r.secondaryInstructors.length === 2).length,
        with1: targetResults.filter(r => r.secondaryInstructors.length === 1).length,
        with0: targetResults.filter(r => r.secondaryInstructors.length === 0).length,
      }
    };

    res.json({ success: true, summary, allocations: allResults, targetAllocations: targetResults, diagnostics: allocationResult.diagnostics });
  } catch (error) {
    console.error('Error in trainee-reallocation preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/trainee-reallocation/apply - Apply reallocation to database
app.post('/api/trainee-reallocation/apply', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const mode = req.body?.mode === 'missingOnly' ? 'missingOnly' : 'all';
    const includeExecutives = req.body?.includeExecutives === true;
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        course: true,
        unit: true,
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });
    const personnel = await prisma.personnel.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        role: true,
        isActive: true,
        qualifications: true,
        category: true,
        isExecutive: true,
        isQFI: true,
        isCFI: true,
        isOFI: true,
        isIRE: true,
        isTestingOfficer: true
      }
    });

    const allocationResult = buildReallocation(trainees, personnel, { mode, includeExecutives, minSecondaryPerTrainee: 2 });
    const allResults = allocationResult.targetAllocations;
    const columnModes = await getTraineeInstructorColumnModes(prisma);

    console.log(`🔄 Applying ${mode} reallocation for ${allResults.length} trainees...`);
    let updated = 0;
    const errors = [];
    const writeAttempts = [];

    for (const result of allResults) {
      try {
        if (columnModes.primaryInstructor === 'array' && columnModes.secondaryInstructor === 'array') {
          await prisma.$executeRawUnsafe(`
            UPDATE "Trainee"
            SET "primaryInstructor" = $1::TEXT[],
                "secondaryInstructor" = $2::TEXT[],
                "updatedAt" = NOW()
            WHERE id = $3::text
          `, result.primaryInstructors, result.secondaryInstructors, result.id);
        } else {
          await prisma.$executeRawUnsafe(`
            UPDATE "Trainee"
            SET "primaryInstructor" = $1::TEXT,
                "secondaryInstructor" = $2::TEXT,
                "updatedAt" = NOW()
            WHERE id = $3::text
          `, result.primaryInstructors.join('; '), result.secondaryInstructors.join('; '), result.id);
        }
        updated++;
        writeAttempts.push({
          traineeId: result.id,
          name: result.fullName || result.name,
          course: result.course || '',
          unit: result.unit || '',
          attemptedPrimary: result.primaryInstructors,
          attemptedSecondary: result.secondaryInstructors,
          status: 'updated'
        });
      } catch (err) {
        errors.push({ traineeId: result.id, name: result.name, error: err.message });
        writeAttempts.push({
          traineeId: result.id,
          name: result.fullName || result.name,
          course: result.course || '',
          unit: result.unit || '',
          attemptedPrimary: result.primaryInstructors,
          attemptedSecondary: result.secondaryInstructors,
          status: 'error',
          error: err.message
        });
      }
    }

    console.log(`✅ Reallocation complete: ${updated} updated, ${errors.length} errors`);
    const readBackRows = allResults.length > 0
      ? await prisma.trainee.findMany({
        where: { id: { in: allResults.map(result => result.id) } },
        select: {
          id: true,
          name: true,
          fullName: true,
          course: true,
          unit: true,
          primaryInstructor: true,
          secondaryInstructor: true,
          updatedAt: true
        }
      })
      : [];
    const readBackById = new Map(readBackRows.map(row => [row.id, row]));
    const readBack = allResults.map(result => {
      const row = readBackById.get(result.id);
      const primaryReadBack = normaliseInstructorListForReallocation(row?.primaryInstructor);
      const secondaryReadBack = normaliseInstructorListForReallocation(row?.secondaryInstructor);
      return {
        traineeId: result.id,
        name: row?.fullName || row?.name || result.fullName || result.name,
        course: row?.course || result.course || '',
        unit: row?.unit || result.unit || '',
        attemptedPrimary: result.primaryInstructors,
        attemptedSecondary: result.secondaryInstructors,
        readBackPrimary: primaryReadBack,
        readBackSecondary: secondaryReadBack,
        rawPrimary: row?.primaryInstructor ?? null,
        rawSecondary: row?.secondaryInstructor ?? null,
        updatedAt: row?.updatedAt || null,
        primaryPersisted: primaryReadBack.length > 0,
        secondaryPersisted: secondaryReadBack.length >= 2
      };
    });
    const readBackSummary = {
      checked: readBack.length,
      primaryPersisted: readBack.filter(row => row.primaryPersisted).length,
      secondaryPersisted: readBack.filter(row => row.secondaryPersisted).length,
      stillMissingPrimary: readBack.filter(row => !row.primaryPersisted).length,
      stillMissingTwoSecondary: readBack.filter(row => !row.secondaryPersisted).length
    };
    console.log('[TraineeReallocation] readback summary:', JSON.stringify(readBackSummary));

    const summary = {
      total: allResults.length,
      updated,
      errors: errors.length,
      mode,
      includeExecutives,
      columnModes,
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

    res.json({
      success: true,
      summary,
      allocations: allResults,
      diagnostics: allocationResult.diagnostics,
      writeAttempts,
      readBackSummary,
      readBack,
      errorDetails: errors
    });
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

function parseDailySnapshotDateKey(rawDate) {
  const parts = String(rawDate || '').trim().split('__');
  return {
    date: parts[0] || '',
    school: parts[1] || null,
    unit: parts[2] || null,
  };
}

// GET /api/daily-snapshot/dates - Return all dates that have snapshots (for calendar dropdown)
app.get('/api/daily-snapshot/dates', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "savedAt", "savedBy" FROM "DailySnapshot" ORDER BY date DESC`
    );
    const dates = (rows || []).map(r => {
      const parsed = parseDailySnapshotDateKey(r.date);
      return {
        date: parsed.date,
        snapshotKey: r.date,
        school: parsed.school,
        unit: parsed.unit,
        savedAt: r.savedAt,
        savedBy: r.savedBy
      };
    });
    console.log(`✅ GET /api/daily-snapshot/dates - ${dates.length} snapshot dates`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ dates });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot/dates error:', error);
    res.status(500).json({ error: 'Failed to load snapshot dates', details: error.message });
  }
});

// DELETE /api/daily-snapshot/future - Clear future DFP snapshots after row layout changes
app.delete('/api/daily-snapshot/future', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const startDate = String(req.body?.startDate || req.query.startDate || '').slice(0, 10);
    const school = String(req.body?.school || req.query.school || '').trim().replace(/[^A-Za-z0-9_-]/g, '-').toUpperCase();
    const unit = String(req.body?.unit || req.query.unit || '').trim().replace(/[^A-Za-z0-9_-]/g, '-').toUpperCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({ success: false, error: 'startDate must use YYYY-MM-DD' });
    }
    if (!school) {
      return res.status(400).json({ success: false, error: 'school is required' });
    }

    const rows = unit
      ? await db.$queryRawUnsafe(
          `DELETE FROM "DailySnapshot"
           WHERE substring(date from 1 for 10) >= $1::text
             AND upper(date) LIKE $2::text
           RETURNING date`,
          startDate,
          `%__${school}__${unit}`
        )
      : await db.$queryRawUnsafe(
          `DELETE FROM "DailySnapshot"
           WHERE substring(date from 1 for 10) >= $1::text
             AND (
               upper(date) LIKE $2::text
               OR upper(date) LIKE $3::text
             )
           RETURNING date`,
          startDate,
          `%__${school}`,
          `%__${school}__%`
        );

    const deletedDates = (rows || []).map((row) => row.date);
    console.log(`✅ DELETE /api/daily-snapshot/future - Deleted ${deletedDates.length} snapshot(s) from ${startDate} for ${school}${unit ? `/${unit}` : ''}`);
    res.json({ success: true, deleted: deletedDates.length, dates: deletedDates });
  } catch (error) {
    console.error('❌ DELETE /api/daily-snapshot/future error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete future snapshots', details: error.message });
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
    const contextSchool = String(req.query.school || '').trim().replace(/[^A-Za-z0-9_-]/g, '-');
    const contextUnit = String(req.query.unit || '').trim().replace(/[^A-Za-z0-9_-]/g, '-');
    // Validate date format. Context-aware snapshots use YYYY-MM-DD__LOCATION__UNIT.
    if (!/^\d{4}-\d{2}-\d{2}(?:__[A-Za-z0-9_-]+(?:__[A-Za-z0-9_-]+)?)?$/i.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD, YYYY-MM-DD__LOCATION, or YYYY-MM-DD__LOCATION__UNIT' });
    }
    const lookupKeys = [
      contextSchool && contextUnit && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}__${contextSchool}__${contextUnit}` : '',
      contextSchool && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}__${contextSchool}` : '',
      date,
    ].filter((key, index, keys) => key && keys.indexOf(key) === index);
    const rows = lookupKeys.length === 3
      ? await db.$queryRawUnsafe(
          `SELECT * FROM "DailySnapshot"
           WHERE date = $1::text OR date = $2::text OR date = $3::text
           ORDER BY CASE
             WHEN date = $1::text THEN 0
             WHEN date = $2::text THEN 1
             ELSE 2
           END
           LIMIT 1`,
          lookupKeys[0],
          lookupKeys[1],
          lookupKeys[2]
        )
      : lookupKeys.length === 2
        ? await db.$queryRawUnsafe(
            `SELECT * FROM "DailySnapshot"
             WHERE date = $1::text OR date = $2::text
             ORDER BY CASE WHEN date = $1::text THEN 0 ELSE 1 END
             LIMIT 1`,
            lookupKeys[0],
            lookupKeys[1]
          )
        : await db.$queryRawUnsafe(
            `SELECT * FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
            lookupKeys[0]
          );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }
    console.log(`✅ GET /api/daily-snapshot/${date} - Loaded snapshot ${rows[0].date}`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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

const normalizeBliUnit = (value) => String(value || '').split('/')[0].trim().toUpperCase();

const profileNameCandidates = (profile) => {
  const firstName = String(profile?.firstName || '').trim();
  const lastName = String(profile?.lastName || '').trim();
  return [
    profile?.fullName,
    profile?.name,
    profile?.displayName,
    firstName && lastName ? `${lastName}, ${firstName}` : '',
    firstName && lastName ? `${firstName} ${lastName}` : '',
  ]
    .map((name) => String(name || '').trim())
    .filter(Boolean);
};

const addProfileUnits = (profiles, unitByName, unitById) => {
  for (const profile of parseJsonArraySafe(profiles)) {
    const unit = normalizeBliUnit(profile?.unit || profile?.unitCode || profile?.traineeUnit || profile?.staffUnit);
    if (!unit) continue;
    profileNameCandidates(profile).forEach((name) => {
      unitByName.set(name.toUpperCase(), unit);
    });
    [profile?.id, profile?.idNumber, profile?.traineeId, profile?.staffId]
      .map((id) => String(id ?? '').trim())
      .filter(Boolean)
      .forEach((id) => unitById.set(id, unit));
  }
};

const addEventUnitToken = (units, value) => {
  const unit = normalizeBliUnit(value);
  if (unit) units.add(unit);
};

const eventMatchesBliUnit = (event, unitFilter, traineeUnitByName, staffUnitByName, traineeUnitById, staffUnitById) => {
  const unit = normalizeBliUnit(unitFilter);
  if (!unit) return true;
  const units = new Set();

  [
    event?.unit,
    event?.unitCode,
    event?.traineeUnit,
    event?.studentUnit,
    event?.owningUnit,
    event?.courseUnit,
    event?.resourceUnit,
    event?.staffUnit,
    event?.instructorUnit,
  ].forEach((value) => addEventUnitToken(units, value));

  const traineeNames = [event?.student, event?.trainee, event?.group]
    .map((name) => String(name || '').trim().toUpperCase())
    .filter(Boolean);
  traineeNames.forEach((name) => addEventUnitToken(units, traineeUnitByName.get(name)));

  eventStaffNames(event)
    .map((name) => name.toUpperCase())
    .forEach((name) => addEventUnitToken(units, staffUnitByName.get(name)));

  (Array.isArray(event?.groupTraineeIds) ? event.groupTraineeIds : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
    .forEach((id) => addEventUnitToken(units, traineeUnitById.get(id)));

  [event?.traineeId, event?.staffId, event?.instructorId]
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
    .forEach((id) => {
      addEventUnitToken(units, traineeUnitById.get(id));
      addEventUnitToken(units, staffUnitById.get(id));
    });

  return units.has(unit);
};

// GET /api/bli/metrics
// Aggregates published daily snapshots into bounded Build Leadership Intelligence series.
app.get('/api/bli/metrics', async (req, res) => {
  try {
    const db = await getPrisma();
    const startDate = isoDateOnly(req.query.startDate);
    const endDate = isoDateOnly(req.query.endDate);
    const school = String(req.query.school || '').trim().toUpperCase();
    const unitFilter = normalizeBliUnit(req.query.unit);
    const availabilityContext = aircraftAvailabilityContextFromRequest({
      locationCode: req.query.locationCode || req.query.school,
      unitCode: req.query.unitCode || req.query.availabilityUnitCode || req.query.unit,
    });

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
      , "traineeProfiles", "staffProfiles"
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
      const traineeUnitByName = new Map();
      const staffUnitByName = new Map();
      const traineeUnitById = new Map();
      const staffUnitById = new Map();
      addProfileUnits(snapshot.traineeProfiles, traineeUnitByName, traineeUnitById);
      addProfileUnits(snapshot.staffProfiles, staffUnitByName, staffUnitById);

      const day = seriesByDate.get(dateKey);
      for (const event of events) {
        const hours = eventMetricHours(event);
        const includeInUnitScopedSeries = eventMatchesBliUnit(
          event,
          unitFilter,
          traineeUnitByName,
          staffUnitByName,
          traineeUnitById,
          staffUnitById
        );
        if (includeInUnitScopedSeries) {
          addMetricCount(day, 'totalEvents');
          if (isFlightMetricEvent(event)) {
            addMetricCount(day, 'flightEvents');
            addMetricCount(day, 'flightHours', hours);
          }
          if (isSimulatorMetricEvent(event)) {
            addMetricCount(day, 'simulatorEvents');
            addMetricCount(day, 'simulatorHours', hours);
          }
        }

        if (!includeInUnitScopedSeries) continue;

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

    const availabilityWhere = ['date >= $1::text', 'date <= $2::text'];
    const availabilityParams = [startDate, endDate];
    addAircraftAvailabilityContextFilters(availabilityWhere, availabilityParams, availabilityContext);
    const availabilityRows = await db.$queryRawUnsafe(
      `
        SELECT *
        FROM "AircraftAvailabilityHistory"
        WHERE ${availabilityWhere.join(' AND ')}
        ORDER BY date ASC
      `,
      ...availabilityParams
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

// GET /api/bli/course-movements - Load durable course movement events for BLI outcome charts.
app.get('/api/bli/course-movements', async (req, res) => {
  try {
    const db = await getPrisma();
    const unitFilter = normalizeBliUnit(req.query.unit);
    const locationFilter = normalizeBliUnit(req.query.locationCode || req.query.location);
    const rows = await db.dataBackup.findMany({
      where: { type: 'course_movement_event' },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    const movements = rows
      .map((row) => ({ id: row.id, createdAt: row.createdAt, ...(row.data || {}) }))
      .filter((movement) => {
        const unit = normalizeBliUnit(movement.unit || movement.unitCode);
        const location = normalizeBliUnit(movement.location || movement.locationCode);
        if (unitFilter && unit && unit !== unitFilter) return false;
        if (locationFilter && location && location !== locationFilter) return false;
        return true;
      });

    res.json({ success: true, movements });
  } catch (error) {
    console.error('❌ GET /api/bli/course-movements error:', error);
    res.status(500).json({ error: 'Failed to load course movement events', details: error.message });
  }
});

// GET /api/bli/course-pass-rates - Trainee suspension outcomes by allocated LMP course.
app.get('/api/bli/course-pass-rates', async (req, res) => {
  try {
    const db = await getPrisma();
    const suspendedPermission = '__DFP_TRAINEE_SUSPENDED__';
    const scopedWhere = hasScopeQuery(req) ? await buildScopedEntityWhere(req, db) : {};
    const courses = await db.course.findMany({
      where: scopedWhere,
      select: { code: true, name: true, lmpType: true, unit: true, location: true, status: true, startDate: true, endDate: true, totalStudents: true },
      orderBy: [{ lmpType: 'asc' }, { name: 'asc' }],
    });

    const courseKeys = uniqueStrings(courses.flatMap((course) => [course.code, course.name].filter(Boolean)));
    if (courses.length === 0 || courseKeys.length === 0) {
      return res.json({ success: true, lmpOptions: [], rows: [], summary: null });
    }

    const trainees = await db.trainee.findMany({
      where: scopedWhere,
      select: {
        id: true,
        course: true,
        lmpType: true,
        academicLmpType: true,
        permissions: true,
      },
    });

    const normalizeCourseKey = (value) => String(value || '').trim().toUpperCase();
    const traineesByCourseKey = new Map();
    trainees.forEach((trainee) => {
      uniqueStrings([trainee.course, trainee.lmpType, trainee.academicLmpType].filter(Boolean))
        .map(normalizeCourseKey)
        .filter(Boolean)
        .forEach((key) => {
          const list = traineesByCourseKey.get(key) || [];
          list.push(trainee);
          traineesByCourseKey.set(key, list);
        });
    });

    const rows = courses.map((course) => {
      const matchingTraineesById = new Map();
      uniqueStrings([course.code, course.name].filter(Boolean))
        .map(normalizeCourseKey)
        .filter(Boolean)
        .forEach((key) => {
          (traineesByCourseKey.get(key) || []).forEach((trainee) => {
            matchingTraineesById.set(trainee.id, trainee);
          });
        });
      const matchingTrainees = [...matchingTraineesById.values()];
      const configuredStarted = Number(course.totalStudents || 0);
      const suspended = matchingTrainees.filter((trainee) => Array.isArray(trainee.permissions) && trainee.permissions.includes(suspendedPermission)).length;
      const total = Math.max(configuredStarted > 0 ? configuredStarted : 0, matchingTrainees.length);
      const notSuspended = Math.max(0, total - suspended);
      return {
        courseCode: course.code,
        courseName: course.name,
        lmpType: course.lmpType || course.name || course.code,
        unit: course.unit,
        location: course.location,
        status: course.status,
        startDate: course.startDate,
        endDate: course.endDate,
        pass: notSuspended,
        fail: suspended,
        other: 0,
        total,
        passRate: total > 0 ? (notSuspended / total) * 100 : null,
      };
    });

    const optionMap = new Map();
    rows.forEach((row) => {
      const key = String(row.lmpType || '').trim();
      if (!key) return;
      const current = optionMap.get(key) || { key, label: key, courseCount: 0, startedTrainees: 0 };
      current.courseCount += 1;
      current.startedTrainees += row.total;
      optionMap.set(key, current);
    });

    res.json({
      success: true,
      lmpOptions: [...optionMap.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      rows,
    });
  } catch (error) {
    console.error('❌ GET /api/bli/course-pass-rates error:', error);
    res.status(500).json({ error: 'Failed to load course pass rates', details: error.message });
  }
});

// POST /api/bli/course-movements - Record back-course/forward-course actions for future BLI history.
app.post('/api/bli/course-movements', async (req, res) => {
  try {
    const db = await getPrisma();
    const payload = req.body || {};
    const traineeName = String(payload.traineeName || '').trim();
    const fromCourse = String(payload.fromCourse || '').trim();
    const toCourse = String(payload.toCourse || '').trim();
    const direction = String(payload.direction || '').trim().toLowerCase();

    if (!traineeName || !fromCourse || !toCourse) {
      return res.status(400).json({ error: 'traineeName, fromCourse and toCourse are required' });
    }
    if (!['back-course', 'forward-course', 'course-change'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be back-course, forward-course or course-change' });
    }

    const data = {
      traineeName,
      traineeId: payload.traineeId || null,
      idNumber: payload.idNumber ?? null,
      fromCourse,
      toCourse,
      direction,
      unit: normalizeBliUnit(payload.unit || payload.unitCode),
      location: normalizeBliUnit(payload.location || payload.locationCode),
      changedAt: payload.changedAt || new Date().toISOString(),
    };
    const record = await db.dataBackup.create({
      data: {
        type: 'course_movement_event',
        data,
        userId: String(payload.userId || '').trim() || null,
      },
    });

    res.json({ success: true, movement: { id: record.id, createdAt: record.createdAt, ...data } });
  } catch (error) {
    console.error('❌ POST /api/bli/course-movements error:', error);
    res.status(500).json({ error: 'Failed to record course movement event', details: error.message });
  }
});

// DELETE /api/daily-snapshot/seed-cleanup - Delete all seed DataBackup records
app.delete('/api/daily-snapshot/seed-cleanup', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
    if (!validateSeedEndpointSecret(req, res)) return;
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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

// GET /api/tie/courses - list courses with training report data and last run info
app.get('/api/tie/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    // Pull available courses from DataBackup
    const backups = await db.dataBackup.findMany({ where: { type: 'historical_pt051_assessments' } });
    const courseMap = {};
    for (const b of backups) {
      try {
        const parsed = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
        // training report data is stored as a dict keyed by record ID; course is embedded in traineeFullName after em-dash
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
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
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
// Single source of truth for all training report assessments
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
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_traineeFullName_idx" ON "TraineePerformance"("traineeFullName")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_instructorName_idx" ON "TraineePerformance"("instructorName")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_course_idx" ON "TraineePerformance"("course")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_date_idx" ON "TraineePerformance"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_isCompleted_idx" ON "TraineePerformance"("isCompleted")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tp_elementScores_gin_idx" ON "TraineePerformance" USING GIN ("elementScores")`);
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
    console.warn('[Training Report Migration] Could not read migration marker:', markerErr.message);
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
      console.warn('[Training Report Migration] Could not save migration marker:', saveMarkerErr.message);
    }

    console.log(`[Training Report Migration] candidates=${summary.sources.candidateAssessments}, inserted=${summary.inserted}, updatedEmpty=${summary.updatedEmpty}, preserved=${summary.preservedExisting}, skipped=${summary.skipped}`);
    return summary;
  } catch (err) {
    console.error('Training report legacy migration failed:', err.message);
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

function parseQueryStringList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap(item => parseQueryStringList(item)));
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return uniqueStrings(parsed.map(item => String(item || '').trim()).filter(Boolean));
      }
    } catch {
      // Fall through to the pipe-delimited parser below.
    }
  }
  return uniqueStrings(raw.split('|').map(item => item.trim()).filter(Boolean));
}

// GET /api/trainee-performance
// Query params: traineeId, traineeFullName, traineeFullNames, instructorName, course, isCompleted, dateFrom, dateTo, followUpOnly, limit, offset
app.get('/api/trainee-performance', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
      traineeId,
      traineeFullName,
      traineeFullNames,
      instructorName,
      course,
      isCompleted,
      dateFrom,
      dateTo,
      followUpOnly,
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
    const traineeFullNameList = parseQueryStringList(traineeFullNames);
    if (traineeFullNameList.length > 0) {
      const placeholders = traineeFullNameList.map(() => `$${paramIdx++}::text`);
      conditions.push(`"traineeFullName" IN (${placeholders.join(', ')})`);
      params.push(...traineeFullNameList);
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
    if (followUpOnly === 'true') {
      conditions.push(`"elementScores" @> '[{"element":"__pt051FollowUp"}]'::jsonb`);
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

// POST /api/trainee-performance/migrate-legacy - backfill legacy training report stores into TraineePerformance
// IMPORTANT: This must come BEFORE /:eventId to avoid Express matching 'migrate-legacy' as an eventId.
app.post('/api/trainee-performance/migrate-legacy', async (req, res) => {
  try {
    const context = await requireDirectAdmin(req, res);
    if (!context) return;
    const db = context.db;
    const result = await migrateLegacyPerformanceIntoTraineePerformance(db, { force: req.body?.force === true });
    res.json(result);
  } catch (error) {
    console.error('❌ POST /api/trainee-performance/migrate-legacy error:', error);
    res.status(500).json({ error: 'Failed to migrate legacy training report records', details: error.message });
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
    const row = mapAssessmentToRow(data);
    const comments = row.comments;
    const elementScores = row.elementScores;
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
function appendTrainingReportNotesServerDiag(stage, payload = {}) {
  try {
    global.__trainingReportNotesDiag = [
      ...(Array.isArray(global.__trainingReportNotesDiag) ? global.__trainingReportNotesDiag : []),
      {
        ts: new Date().toISOString(),
        stage,
        ...payload,
      },
    ].slice(-250);
    if (process.env.TRAINING_REPORT_NOTES_DIAG === 'true') {
      console.log('[TrainingReportNotesDiag]', stage, payload);
    }
  } catch {
    // Diagnostics must not affect API behaviour.
  }
}

function mapRowToAssessment(row) {
  if (!row) return null;
  // elementScores is stored as JSONB - parse if string
  let scores = row.elementScores;
  if (typeof scores === 'string') {
    try { scores = JSON.parse(scores); } catch { scores = []; }
  }
  if (!Array.isArray(scores)) scores = [];
  const followUpMeta = scores.find(score => score && typeof score === 'object' && score.element === '__pt051FollowUp')?.metadata || {};
  appendTrainingReportNotesServerDiag('map-row-to-assessment', {
    eventId: row.eventId,
    flightNumber: row.flightNumber,
    traineeFullName: row.traineeFullName,
    hasFollowUpMeta: !!scores.find(score => score && typeof score === 'object' && score.element === '__pt051FollowUp'),
    passNotesToNextEvent: followUpMeta.passNotesToNextEvent === true,
    trainingReportNotesLength: String(followUpMeta.trainingReportNotes || '').trim().length,
    trainingReportNotesPreview: String(followUpMeta.trainingReportNotes || '').trim().slice(0, 160),
  });
  scores = scores.filter(score => !(score && typeof score === 'object' && score.element === '__pt051FollowUp'));

  // comments is the structured "Assessor: ...\nWeather: ..." string
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
    dpcoFollowUp:        followUpMeta.dpcoFollowUp || undefined,
    dncoFollowUp:        followUpMeta.dncoFollowUp || undefined,
    isRplAssessment:     followUpMeta.isRplAssessment === true,
    rplGrantedAt:        followUpMeta.rplGrantedAt || undefined,
    rplGrantedBy:        followUpMeta.rplGrantedBy || undefined,
    passNotesToNextEvent: followUpMeta.passNotesToNextEvent === true,
    trainingReportNotes: followUpMeta.trainingReportNotes || undefined,
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
  const elementScores = (data.scores || data.elementScores || [])
    .filter(s => !(s && s.element === '__pt051FollowUp'))
    .map(s => ({
      element: s.element || '',
      grade:   s.grade != null ? String(s.grade) : null,
      comment: s.comment || ''
    }));
  if (data.dpcoFollowUp || data.dncoFollowUp || data.passNotesToNextEvent || data.trainingReportNotes || data.isRplAssessment || data.rplGrantedAt || data.rplGrantedBy) {
    elementScores.push({
      element: '__pt051FollowUp',
      grade: null,
      comment: '',
      metadata: {
        dpcoFollowUp: data.dpcoFollowUp || null,
        dncoFollowUp: data.dncoFollowUp || null,
        isRplAssessment: data.isRplAssessment === true,
        rplGrantedAt: data.rplGrantedAt || null,
        rplGrantedBy: data.rplGrantedBy || null,
        passNotesToNextEvent: data.passNotesToNextEvent === true,
        trainingReportNotes: data.trainingReportNotes || null,
      },
    });
  }
  appendTrainingReportNotesServerDiag('map-assessment-to-row', {
    id,
    eventId: data.eventId || '',
    flightNumber: data.flightNumber || '',
    traineeFullName: data.traineeFullName || data.trainedFullName || '',
    dcoResult,
    dpcoFollowUp: data.dpcoFollowUp || null,
    dncoFollowUp: data.dncoFollowUp || null,
    passNotesToNextEvent: data.passNotesToNextEvent === true,
    trainingReportNotesLength: String(data.trainingReportNotes || '').trim().length,
    trainingReportNotesPreview: String(data.trainingReportNotes || '').trim().slice(0, 160),
    hasFollowUpMetaRow: elementScores.some(score => score && score.element === '__pt051FollowUp'),
  });

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

app.get('/api/diagnostics/training-report-notes', async (req, res) => {
  const context = await requireDirectAdmin(req, res);
  if (!context) return;
  const entries = Array.isArray(global.__trainingReportNotesDiag) ? global.__trainingReportNotesDiag : [];
  res.json({ entries, count: entries.length });
});

// Helper: Build "Assessor: ...\nWeather: ..." string from report assessment fields
function hasStructuredAssessmentComments(value) {
  return /(?:^|\n)(?:Assessor|Instructor|Report Instructor|QFI):/i.test(String(value || ''));
}

function buildCommentsString(data) {
  // If already in structured format, return as-is
  if (hasStructuredAssessmentComments(data.comments)) return data.comments;
  if (hasStructuredAssessmentComments(data.overallComments)) return data.overallComments;
  // Build from individual fields (backward compat)
  const assessor = data.assessorComments || data.instructorComments || data.qfiComments || '';
  const weather  = data.weatherComments || '';
  const profile  = data.profileComments || '';
  const overall  = data.overallComments || '';
  const nest     = data.nestComments    || '';
  if (!assessor && !weather && !profile && !overall && !nest) return data.comments || null;
  return `Assessor: ${assessor}\nWeather: ${weather}\nProfile: ${profile}\nOverall: ${overall}\nNEST: ${nest}`;
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
        ADD COLUMN IF NOT EXISTS "crewLogSnapshot" JSONB,
        ADD COLUMN IF NOT EXISTS "airborneTime" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "taxiGroundTime" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "blockTime" DOUBLE PRECISION
    `);
  } catch (err) {
    console.log('[FlightLog] snapshot column ensure:', err.message);
  }
}

async function ensureEventCompletionTimeColumns(db) {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "EventCompletion"
        ADD COLUMN IF NOT EXISTS "airborneTime" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "taxiGroundTime" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "blockTime" DOUBLE PRECISION
    `);
  } catch (err) {
    console.log('[EventCompletion] time column ensure:', err.message);
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
      takeoffTime, landTime, airborneTime, taxiGroundTime, blockTime, totalTime, captainTime, instructorTime,
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
      airborneTime:   airborneTime    != null ? parseFloat(airborneTime)    : null,
      taxiGroundTime: taxiGroundTime  != null ? parseFloat(taxiGroundTime)  : null,
      blockTime:      blockTime       != null ? parseFloat(blockTime)       : (totalTime != null ? parseFloat(totalTime) : null),
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

// ── GET /api/event-completions ───────────────────────────────────────────────
// Accepts: scheduleEventId, traineeId, eventDate, eventCode, instructorName, dcoResult
app.get('/api/event-completions', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureEventCompletionTimeColumns(db);
    const { scheduleEventId, traineeId, eventDate, eventCode, instructorName, dcoResult } = req.query;

    const where = {};
    if (scheduleEventId) where.scheduleEventId = String(scheduleEventId);
    if (traineeId)       where.traineeId       = String(traineeId);
    if (eventDate)       where.eventDate       = String(eventDate);
    if (eventCode)       where.eventCode       = String(eventCode);
    if (instructorName)  where.instructorName  = String(instructorName);
    if (dcoResult)       where.dcoResult       = String(dcoResult);

    const completions = await db.eventCompletion.findMany({
      where,
      orderBy: [
        { eventDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    console.log(`✅ GET /api/event-completions filters=${JSON.stringify({ scheduleEventId, traineeId, eventDate, eventCode, instructorName, dcoResult })} → ${completions.length} rows`);
    res.json({ completions, count: completions.length });
  } catch (error) {
    console.error('❌ GET /api/event-completions error:', error);
    res.status(500).json({ error: 'Failed to fetch event completions', details: error.message });
  }
});

// ── POST /api/event-completions (upsert by scheduleEventId) ──────────────────
app.post('/api/event-completions', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureEventCompletionTimeColumns(db);
    const body = req.body || {};
    const {
      scheduleEventId, eventCode, eventDate, eventType,
      startTime, duration,
      traineeId, traineeFullName, instructorName,
      dcoResult, overallGrade, overallResult,
      aircraftNumber, takeoffTime, landTime, airborneTime, taxiGroundTime, blockTime, totalFlightTime,
      isSolo, isDual, isCountedAsElce,
      recordedBy, source, notes,
    } = body;

    if (!scheduleEventId || !dcoResult) {
      return res.status(400).json({ error: 'scheduleEventId and dcoResult are required' });
    }

    const data = {
      scheduleEventId,
      eventCode:       eventCode  || scheduleEventId,
      eventDate:       eventDate  || new Date().toISOString().slice(0, 10),
      eventType:       eventType  || 'flight',
      startTime:       startTime  != null ? parseFloat(startTime)  : 0,
      duration:        duration   != null ? parseFloat(duration)   : 0,
      traineeId:       traineeId  || null,
      traineeFullName: traineeFullName || 'Unknown',
      instructorName:  instructorName || null,
      dcoResult,
      overallGrade:    overallGrade != null ? parseInt(overallGrade) : null,
      overallResult:   overallResult || null,
      aircraftNumber:  aircraftNumber || null,
      takeoffTime:     takeoffTime   || null,
      landTime:        landTime      || null,
      airborneTime:    airborneTime   != null ? parseFloat(airborneTime)   : null,
      taxiGroundTime:  taxiGroundTime != null ? parseFloat(taxiGroundTime) : null,
      blockTime:       blockTime      != null ? parseFloat(blockTime)      : (totalFlightTime != null ? parseFloat(totalFlightTime) : null),
      totalFlightTime: totalFlightTime != null ? parseFloat(totalFlightTime) : null,
      isSolo:          !!isSolo,
      isDual:          !!isDual,
      isCountedAsElce: isCountedAsElce !== undefined ? !!isCountedAsElce : dcoResult !== 'DNCO',
      recordedBy:      recordedBy || null,
      source:          source     || 'post_flight',
      notes:           notes      || null,
    };

    const existing = await db.eventCompletion.findUnique({
      where: { scheduleEventId },
      select: { id: true },
    }).catch(() => null);

    const completion = await db.eventCompletion.upsert({
      where:  { scheduleEventId },
      create: data,
      update: data,
    });

    console.log(`✅ POST /api/event-completions ${existing ? 'updated' : 'created'} id=${completion.id} scheduleEventId=${scheduleEventId} result=${dcoResult}`);
    res.json({ success: true, completion, created: !existing });
  } catch (error) {
    console.error('❌ POST /api/event-completions error:', error);
    res.status(500).json({ error: 'Failed to save event completion', details: error.message });
  }
});

// Fallback: serve index-v2.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index-v2.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
  schedulePrismaPrewarm();
});
