import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DAILY_SNAPSHOT_PRUNABLE_JSON_COLUMNS = [
  'scheduleEvents',
  'staffEvents',
  'traineeEvents',
  'pt051Assessments',
  'traineeProfiles',
  'staffProfiles',
  'lmpCompletedIds',
  'staffCurrency',
  'staffLogbook',
  'baselineEvents',
  'aircraftConfigState',
  'courseState',
  'individualLmpState',
  'masterLmpState',
  'trainingReportState',
  'eventCompletions',
  'flightLogEntries',
  'currencyState',
];

const COMPACT_ARCHIVE_REQUIRED_CONFIG_TYPES = [
  'aircraftConfigState',
  'staffRosterState',
  'traineeRosterState',
  'lmpCompletionState',
  'staffCurrencyState',
  'currencyDefinitionState',
  'currencyState',
  'courseState',
  'individualLmpState',
  'masterLmpState',
  'trainingReportState',
  'eventCompletionState',
  'flightLogState',
];

function loadLocalEnv() {
  ['.env.local', '.env'].forEach((fileName) => {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return;
      const [, key, rawValue] = match;
      if (process.env[key] != null) return;
      const value = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
      process.env[key] = value;
    });
  });
}

function hashArchiveContent(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex');
}

function getArchiveEventStableId(event, date, index) {
  const existing = String(event?.id || event?.eventId || '').trim();
  if (existing) return existing.slice(0, 220);
  return [
    'archive-event',
    date,
    event?.type || 'event',
    event?.resourceId || 'resource',
    event?.flightNumber || event?.eventCode || 'code',
    event?.startTime ?? 'time',
    index,
  ].join('-').replace(/[^a-zA-Z0-9_.:-]+/g, '-').slice(0, 220);
}

function parseDailySnapshotDateKey(rawDate) {
  const parts = String(rawDate || '').trim().split('__');
  return {
    date: parts[0] || '',
    school: parts[1] || null,
    unit: parts[2] || null,
  };
}

function getArchiveConfigIdsByType(configRefs) {
  if (!configRefs || typeof configRefs !== 'object' || Array.isArray(configRefs)) return {};
  return Object.fromEntries(
    Object.entries(configRefs)
      .map(([type, ref]) => [type, ref?.id ? String(ref.id) : ''])
      .filter(([, id]) => Boolean(id))
  );
}

function estimateDailySnapshotPrunableBytes(snapshot) {
  try {
    const prunablePayload = Object.fromEntries(
      DAILY_SNAPSHOT_PRUNABLE_JSON_COLUMNS.map(column => [column, snapshot?.[column]])
    );
    return Buffer.byteLength(JSON.stringify(prunablePayload), 'utf8');
  } catch {
    return 0;
  }
}

async function ensureColumn(client, tableName, columnSql) {
  await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS ${columnSql}`);
}

async function ensureSmokeTables(client) {
  await client.query(`
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
      "baselineEvents" JSONB DEFAULT NULL,
      "alertsData" JSONB DEFAULT '{}',
      "aircraftConfigState" JSONB DEFAULT '{}',
      "courseState" JSONB NOT NULL DEFAULT '[]',
      "individualLmpState" JSONB NOT NULL DEFAULT '{}',
      "masterLmpState" JSONB NOT NULL DEFAULT '[]',
      "trainingReportState" JSONB NOT NULL DEFAULT '{}',
      "eventCompletions" JSONB NOT NULL DEFAULT '[]',
      "flightLogEntries" JSONB NOT NULL DEFAULT '[]',
      "currencyState" JSONB NOT NULL DEFAULT '{}',
      "archivePrunedAt" TIMESTAMP(3),
      "archivePruneStatus" TEXT NOT NULL DEFAULT 'full',
      "archivePruneDetails" JSONB NOT NULL DEFAULT '{}',
      "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "savedBy" TEXT,
      CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "DailySnapshot_date_key" ON "DailySnapshot"("date")');

  for (const columnSql of [
    `"scheduleEvents" JSONB NOT NULL DEFAULT '[]'`,
    `"staffEvents" JSONB NOT NULL DEFAULT '[]'`,
    `"traineeEvents" JSONB NOT NULL DEFAULT '[]'`,
    `"pt051Assessments" JSONB NOT NULL DEFAULT '{}'`,
    `"traineeProfiles" JSONB NOT NULL DEFAULT '[]'`,
    `"staffProfiles" JSONB NOT NULL DEFAULT '[]'`,
    `"lmpCompletedIds" JSONB NOT NULL DEFAULT '{}'`,
    `"staffCurrency" JSONB NOT NULL DEFAULT '{}'`,
    `"staffLogbook" JSONB NOT NULL DEFAULT '{}'`,
    `"baselineEvents" JSONB DEFAULT NULL`,
    `"alertsData" JSONB DEFAULT '{}'`,
    `"aircraftConfigState" JSONB DEFAULT '{}'`,
    `"courseState" JSONB NOT NULL DEFAULT '[]'`,
    `"individualLmpState" JSONB NOT NULL DEFAULT '{}'`,
    `"masterLmpState" JSONB NOT NULL DEFAULT '[]'`,
    `"trainingReportState" JSONB NOT NULL DEFAULT '{}'`,
    `"eventCompletions" JSONB NOT NULL DEFAULT '[]'`,
    `"flightLogEntries" JSONB NOT NULL DEFAULT '[]'`,
    `"currencyState" JSONB NOT NULL DEFAULT '{}'`,
    `"archivePrunedAt" TIMESTAMP(3)`,
    `"archivePruneStatus" TEXT NOT NULL DEFAULT 'full'`,
    `"archivePruneDetails" JSONB NOT NULL DEFAULT '{}'`,
  ]) {
    await ensureColumn(client, 'DailySnapshot', columnSql);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS "PublishedDfpArchive" (
      "id" TEXT NOT NULL,
      "snapshotKey" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "organisationCode" TEXT,
      "locationCode" TEXT,
      "unitCode" TEXT,
      "school" TEXT,
      "scheduleHash" TEXT NOT NULL,
      "eventCount" INTEGER NOT NULL DEFAULT 0,
      "configRefs" JSONB NOT NULL DEFAULT '{}',
      "compactSnapshot" JSONB NOT NULL DEFAULT '{}',
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "publishedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PublishedDfpArchive_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "PublishedDfpArchive_snapshotKey_key" ON "PublishedDfpArchive"("snapshotKey")');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "ScheduleEventArchive" (
      "id" TEXT NOT NULL,
      "archiveId" TEXT NOT NULL,
      "snapshotKey" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "eventCode" TEXT,
      "resourceId" TEXT,
      "startTime" DOUBLE PRECISION,
      "duration" DOUBLE PRECISION,
      "personnelRefs" JSONB NOT NULL DEFAULT '[]',
      "eventData" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ScheduleEventArchive_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleEventArchive_archiveId_eventId_key" ON "ScheduleEventArchive"("archiveId", "eventId")');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "ConfigVersionArchive" (
      "id" TEXT NOT NULL,
      "scopeKey" TEXT NOT NULL,
      "configType" TEXT NOT NULL,
      "contentHash" TEXT NOT NULL,
      "effectiveFrom" TEXT NOT NULL,
      "effectiveTo" TEXT,
      "content" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT,
      CONSTRAINT "ConfigVersionArchive_pkey" PRIMARY KEY ("id")
    )
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "ConfigVersionArchive_scopeKey_configType_contentHash_key" ON "ConfigVersionArchive"("scopeKey", "configType", "contentHash")');
}

function buildSmokePayload(snapshotKey) {
  const parsed = parseDailySnapshotDateKey(snapshotKey);
  const eventId = `archive-smoke-event-${crypto.randomUUID()}`;
  const scheduleEvents = [
    {
      id: eventId,
      type: 'ground',
      eventType: 'Ground',
      eventCode: 'ARCHIVE SMOKE',
      flightNumber: 'ARCHIVE SMOKE',
      resourceId: 'Ground-1',
      startTime: 480,
      duration: 1,
      instructor: 'Archive Smoke Instructor',
      student: 'Archive Smoke Trainee',
      unitCode: parsed.unit,
      school: parsed.school,
    },
  ];
  return {
    parsed,
    scheduleEvents,
    staffEvents: scheduleEvents,
    traineeEvents: scheduleEvents,
    alertsData: {
      smokeTest: true,
      preservedAfterPrune: true,
      snapshotKey,
    },
  };
}

async function insertSmokeArchive(client, snapshotKey, archiveId, payload) {
  const savedAt = new Date(Date.now() - (120 * 24 * 60 * 60 * 1000));
  const configRefs = {};
  const scopeKey = `archive-retention-smoke|${snapshotKey}`;

  for (const configType of COMPACT_ARCHIVE_REQUIRED_CONFIG_TYPES) {
    const content = { smokeTest: true, configType, snapshotKey };
    const contentHash = hashArchiveContent(content);
    const id = crypto.randomUUID();
    await client.query(`
      INSERT INTO "ConfigVersionArchive"
        ("id", "scopeKey", "configType", "contentHash", "effectiveFrom", "content", "createdBy", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
    `, [
      id,
      scopeKey,
      configType,
      contentHash,
      payload.parsed.date,
      JSON.stringify(content),
      'archive-smoke-test',
    ]);
    configRefs[configType] = {
      id,
      contentHash,
      effectiveFrom: payload.parsed.date,
    };
  }

  await client.query(`
    INSERT INTO "DailySnapshot" (
      "id",
      "date",
      "scheduleEvents",
      "staffEvents",
      "traineeEvents",
      "pt051Assessments",
      "traineeProfiles",
      "staffProfiles",
      "lmpCompletedIds",
      "staffCurrency",
      "staffLogbook",
      "baselineEvents",
      "alertsData",
      "aircraftConfigState",
      "courseState",
      "individualLmpState",
      "masterLmpState",
      "trainingReportState",
      "eventCompletions",
      "flightLogEntries",
      "currencyState",
      "archivePruneStatus",
      "archivePruneDetails",
      "savedAt",
      "savedBy"
    ) VALUES (
      $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $6::jsonb, $7::jsonb, '{}'::jsonb,
      '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '{}'::jsonb, 'full', '{}'::jsonb, $8, 'archive-smoke-test'
    )
  `, [
    crypto.randomUUID(),
    snapshotKey,
    JSON.stringify(payload.scheduleEvents),
    JSON.stringify(payload.staffEvents),
    JSON.stringify(payload.traineeEvents),
    JSON.stringify(payload.scheduleEvents),
    JSON.stringify(payload.alertsData),
    savedAt,
  ]);

  await client.query(`
    INSERT INTO "PublishedDfpArchive" (
      "id",
      "snapshotKey",
      "date",
      "organisationCode",
      "locationCode",
      "unitCode",
      "school",
      "scheduleHash",
      "eventCount",
      "configRefs",
      "compactSnapshot",
      "publishedAt",
      "publishedBy",
      "createdAt",
      "updatedAt"
    ) VALUES (
      $1, $2, $3, 'ARCHIVE-SMOKE-ORG', 'ARCHIVE-SMOKE-LOC', $4, $5, $6, $7,
      $8::jsonb, $9::jsonb, NOW(), 'archive-smoke-test', NOW(), NOW()
    )
  `, [
    archiveId,
    snapshotKey,
    payload.parsed.date,
    payload.parsed.unit,
    payload.parsed.school,
    hashArchiveContent(payload.scheduleEvents),
    payload.scheduleEvents.length,
    JSON.stringify(configRefs),
    JSON.stringify({
      snapshotKey,
      date: payload.parsed.date,
      eventCount: payload.scheduleEvents.length,
      configVersionIds: Object.fromEntries(Object.entries(configRefs).map(([key, value]) => [key, value.id])),
    }),
  ]);

  for (const [index, event] of payload.scheduleEvents.entries()) {
    const eventId = getArchiveEventStableId(event, payload.parsed.date, index);
    await client.query(`
      INSERT INTO "ScheduleEventArchive" (
        "id",
        "archiveId",
        "snapshotKey",
        "eventId",
        "date",
        "eventType",
        "eventCode",
        "resourceId",
        "startTime",
        "duration",
        "personnelRefs",
        "eventData",
        "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, NOW())
    `, [
      crypto.randomUUID(),
      archiveId,
      snapshotKey,
      eventId,
      payload.parsed.date,
      event.eventType || event.type || 'event',
      event.eventCode || event.flightNumber || null,
      event.resourceId || null,
      event.startTime ?? null,
      event.duration ?? null,
      JSON.stringify([
        { role: 'instructor', label: event.instructor },
        { role: 'student', label: event.student },
      ]),
      JSON.stringify(event),
    ]);
  }
}

async function validateCompactArchiveForDailySnapshotPrune(client, snapshot) {
  const snapshotKey = String(snapshot?.date || '').trim();
  const parsed = parseDailySnapshotDateKey(snapshotKey);
  const scheduleEvents = Array.isArray(snapshot?.scheduleEvents) ? snapshot.scheduleEvents : [];
  if (!snapshotKey) {
    return {
      valid: false,
      reason: 'Snapshot row does not have a date key.',
      snapshotKey,
      date: parsed.date || null,
      snapshotEventCount: scheduleEvents.length,
    };
  }

  const archiveRows = await client.query(
    `SELECT id, "snapshotKey", "date", "scheduleHash", "eventCount", "configRefs", "publishedAt", "updatedAt"
     FROM "PublishedDfpArchive"
     WHERE "snapshotKey" = $1
     LIMIT 1`,
    [snapshotKey]
  );
  const archive = archiveRows.rows?.[0] || null;
  if (!archive) {
    return {
      valid: false,
      reason: 'No compact archive exists for this daily snapshot.',
      snapshotKey,
      date: parsed.date || null,
      snapshotEventCount: scheduleEvents.length,
    };
  }

  const eventCountRows = await client.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(array_agg("eventId" ORDER BY "eventId"), ARRAY[]::text[]) AS "eventIds"
     FROM "ScheduleEventArchive"
     WHERE "archiveId" = $1`,
    [archive.id]
  );
  const archivedEventCount = Number(eventCountRows.rows?.[0]?.count || 0);
  const snapshotEventCount = scheduleEvents.length;
  const archiveEventIds = Array.isArray(eventCountRows.rows?.[0]?.eventIds) ? eventCountRows.rows[0].eventIds : [];
  const snapshotEventIds = scheduleEvents
    .map((event, index) => getArchiveEventStableId(event, parsed.date || snapshotKey, index))
    .sort((a, b) => a.localeCompare(b));
  const scheduleHash = hashArchiveContent(scheduleEvents);
  const configIdsByType = getArchiveConfigIdsByType(archive.configRefs);
  const missingConfigRefs = COMPACT_ARCHIVE_REQUIRED_CONFIG_TYPES.filter(type => !configIdsByType[type]);
  const configIds = Object.values(configIdsByType);
  const configRows = configIds.length > 0
    ? await client.query(
        `SELECT id FROM "ConfigVersionArchive" WHERE id = ANY($1::text[])`,
        [configIds]
      )
    : { rows: [] };
  const foundConfigIds = new Set((configRows.rows || []).map(row => String(row.id || '')));
  const missingConfigRows = COMPACT_ARCHIVE_REQUIRED_CONFIG_TYPES
    .filter(type => configIdsByType[type] && !foundConfigIds.has(configIdsByType[type]));
  const hashMatches = archive.scheduleHash === scheduleHash;
  const eventCountMatches = archivedEventCount === snapshotEventCount && Number(archive.eventCount || 0) === snapshotEventCount;
  const eventIdsMatch = archiveEventIds.length === snapshotEventIds.length
    && archiveEventIds.every((eventId, index) => String(eventId) === String(snapshotEventIds[index]));
  const snapshotSavedAtMs = snapshot?.savedAt ? new Date(snapshot.savedAt).getTime() : 0;
  const archiveUpdatedAtMs = archive?.updatedAt ? new Date(archive.updatedAt).getTime() : 0;
  const archiveFreshEnough = !snapshotSavedAtMs || !archiveUpdatedAtMs || archiveUpdatedAtMs + 1000 >= snapshotSavedAtMs;
  const valid = eventCountMatches && eventIdsMatch && archiveFreshEnough && missingConfigRefs.length === 0 && missingConfigRows.length === 0;

  return {
    valid,
    reason: valid
      ? 'Compact archive can reconstruct this daily snapshot.'
      : 'Compact archive did not pass validation.',
    snapshotKey,
    date: parsed.date || null,
    archiveId: archive.id,
    snapshotEventCount,
    archivedEventCount,
    archiveEventCount: Number(archive.eventCount || 0),
    hashMatches,
    eventCountMatches,
    eventIdsMatch,
    archiveFreshEnough,
    missingConfigRefs,
    missingConfigRows,
    configVersionCount: configRows.rows?.length || 0,
    requiredConfigTypes: COMPACT_ARCHIVE_REQUIRED_CONFIG_TYPES.length,
  };
}

async function pruneSnapshot(client, snapshot, validation) {
  const estimatedPrunableBytes = estimateDailySnapshotPrunableBytes(snapshot);
  const pruneDetails = {
    prunedAt: new Date().toISOString(),
    reason: 'archive-retention-db-smoke-test',
    retentionDays: 90,
    estimatedPrunableBytes,
    validation: {
      archiveId: validation.archiveId,
      snapshotEventCount: validation.snapshotEventCount,
      archivedEventCount: validation.archivedEventCount,
      archiveEventCount: validation.archiveEventCount,
      hashMatches: validation.hashMatches,
      eventCountMatches: validation.eventCountMatches,
      eventIdsMatch: validation.eventIdsMatch,
      archiveFreshEnough: validation.archiveFreshEnough,
      configVersionCount: validation.configVersionCount,
    },
    preservedColumns: ['date', 'savedAt', 'savedBy', 'alertsData'],
    prunedColumns: DAILY_SNAPSHOT_PRUNABLE_JSON_COLUMNS,
  };

  await client.query(`
    UPDATE "DailySnapshot"
    SET
      "scheduleEvents" = '[]'::jsonb,
      "staffEvents" = '[]'::jsonb,
      "traineeEvents" = '[]'::jsonb,
      "pt051Assessments" = '{}'::jsonb,
      "traineeProfiles" = '[]'::jsonb,
      "staffProfiles" = '[]'::jsonb,
      "lmpCompletedIds" = '{}'::jsonb,
      "staffCurrency" = '{}'::jsonb,
      "staffLogbook" = '{}'::jsonb,
      "baselineEvents" = '[]'::jsonb,
      "aircraftConfigState" = '{}'::jsonb,
      "courseState" = '[]'::jsonb,
      "individualLmpState" = '{}'::jsonb,
      "masterLmpState" = '[]'::jsonb,
      "trainingReportState" = '{}'::jsonb,
      "eventCompletions" = '[]'::jsonb,
      "flightLogEntries" = '[]'::jsonb,
      "currencyState" = '{}'::jsonb,
      "archivePrunedAt" = NOW(),
      "archivePruneStatus" = 'pruned',
      "archivePruneDetails" = $1::jsonb
    WHERE "id" = $2
      AND "archivePrunedAt" IS NULL
  `, [JSON.stringify(pruneDetails), snapshot.id]);
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runSmokeTest(client) {
  const snapshotKey = `2099-12-31__ARCHIVE-SMOKE__UNIT-${crypto.randomUUID()}`;
  const archiveId = crypto.randomUUID();
  const payload = buildSmokePayload(snapshotKey);

  await client.query('BEGIN');
  try {
    await ensureSmokeTables(client);
    await insertSmokeArchive(client, snapshotKey, archiveId, payload);

    const snapshotRows = await client.query(
      `SELECT "id", "date", "savedAt", "savedBy",
              "scheduleEvents", "staffEvents", "traineeEvents", "pt051Assessments",
              "traineeProfiles", "staffProfiles", "lmpCompletedIds", "staffCurrency",
              "staffLogbook", "baselineEvents", "aircraftConfigState", "courseState",
              "individualLmpState", "masterLmpState", "trainingReportState",
              "eventCompletions", "flightLogEntries", "currencyState", "alertsData"
       FROM "DailySnapshot"
       WHERE "archivePrunedAt" IS NULL
         AND COALESCE("archivePruneStatus", 'full') <> 'pruned'
         AND "savedAt" < NOW() - ($1::integer * INTERVAL '1 day')
         AND "date" = $2
       ORDER BY "savedAt" ASC
       LIMIT 1`,
      [90, snapshotKey]
    );
    const snapshot = snapshotRows.rows?.[0];
    assertCondition(snapshot, 'Smoke snapshot was not selected as an eligible prune candidate.');

    const validation = await validateCompactArchiveForDailySnapshotPrune(client, snapshot);
    assertCondition(validation.valid, `Archive validation failed: ${JSON.stringify(validation)}`);

    await pruneSnapshot(client, snapshot, validation);

    const prunedRows = await client.query(
      `SELECT "scheduleEvents", "staffEvents", "traineeEvents", "alertsData",
              "archivePrunedAt", "archivePruneStatus", "archivePruneDetails"
       FROM "DailySnapshot"
       WHERE "date" = $1
       LIMIT 1`,
      [snapshotKey]
    );
    const pruned = prunedRows.rows?.[0];
    assertCondition(pruned, 'Pruned snapshot row was not found.');
    assertCondition(pruned.archivePruneStatus === 'pruned', 'Snapshot was not marked as pruned.');
    assertCondition(pruned.archivePrunedAt, 'Snapshot archivePrunedAt was not set.');
    assertCondition(Array.isArray(pruned.scheduleEvents) && pruned.scheduleEvents.length === 0, 'scheduleEvents was not pruned.');
    assertCondition(Array.isArray(pruned.staffEvents) && pruned.staffEvents.length === 0, 'staffEvents was not pruned.');
    assertCondition(Array.isArray(pruned.traineeEvents) && pruned.traineeEvents.length === 0, 'traineeEvents was not pruned.');
    assertCondition(pruned.alertsData?.preservedAfterPrune === true, 'alertsData was not preserved.');
    assertCondition(pruned.archivePruneDetails?.validation?.eventIdsMatch === true, 'Prune details did not record successful event ID validation.');

    await client.query('ROLLBACK');
    return {
      snapshotKey,
      archiveId,
      eventCount: payload.scheduleEvents.length,
      status: 'passed',
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function main() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    console.error([
      'DATABASE_URL is not configured for this checkout.',
      '',
      'To run the archive retention DB smoke test:',
      '1. Copy .env.example to .env.',
      '2. Set DATABASE_URL to a local or staging Postgres database.',
      '3. Run npm run test:archive-retention-db again.',
      '',
      'The test uses a transaction and rolls back its smoke rows after verification.',
    ].join('\n'));
    process.exitCode = 2;
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  const client = await pool.connect();
  try {
    console.log('Running archive retention DB smoke test...');
    const result = await runSmokeTest(client);
    console.log(`Archive retention DB smoke test passed for ${result.snapshotKey}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Archive retention DB smoke test failed.');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
