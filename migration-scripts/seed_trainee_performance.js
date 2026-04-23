#!/usr/bin/env node
/**
 * seed_trainee_performance.js
 * ===========================
 * Seeds the TraineePerformance table from the generated JSON file.
 * 
 * Run from the project root:
 *   node migration-scripts/seed_trainee_performance.js
 * 
 * Requires:
 *   - DATABASE_URL environment variable set (or .env file)
 *   - trainee_performance_import.json in the same directory
 *   - @prisma/client installed (npm install already handles this)
 * 
 * This script is idempotent: ON CONFLICT (eventId) DO NOTHING
 * Safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
  console.log('✅ Loaded .env file');
} catch (e) {
  console.log('ℹ️  No .env file found, using existing environment variables');
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const prisma = new PrismaClient();

async function generateId() {
  return 'tp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

async function main() {
  console.log('🚀 Starting TraineePerformance seed...');
  
  // Load the JSON data
  const jsonPath = path.join(__dirname, 'trainee_performance_import.json');
  console.log(`📂 Loading data from: ${jsonPath}`);
  
  let records;
  try {
    const raw = readFileSync(jsonPath, 'utf8');
    records = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Failed to load JSON file:', e.message);
    console.error('   Run: python3 migration-scripts/import_trainee_performance.py first');
    process.exit(1);
  }
  
  console.log(`📊 Total records to seed: ${records.length}`);

  // Ensure table exists
  try {
    await prisma.$executeRawUnsafe(`
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
    console.log('✅ TraineePerformance table ready');
  } catch (e) {
    console.log('ℹ️  Table may already exist:', e.message);
  }

  // Create indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS "tp_traineeId_idx" ON "TraineePerformance"("traineeId")`,
    `CREATE INDEX IF NOT EXISTS "tp_instructorName_idx" ON "TraineePerformance"("instructorName")`,
    `CREATE INDEX IF NOT EXISTS "tp_course_idx" ON "TraineePerformance"("course")`,
    `CREATE INDEX IF NOT EXISTS "tp_date_idx" ON "TraineePerformance"("date")`,
    `CREATE INDEX IF NOT EXISTS "tp_isCompleted_idx" ON "TraineePerformance"("isCompleted")`,
    `CREATE INDEX IF NOT EXISTS "tp_traineeId_date_idx" ON "TraineePerformance"("traineeId", "date")`,
    `CREATE INDEX IF NOT EXISTS "tp_instructorName_completed_idx" ON "TraineePerformance"("instructorName", "isCompleted")`,
  ];
  for (const idx of indexes) {
    try { await prisma.$executeRawUnsafe(idx); } catch (e) { /* already exists */ }
  }

  // Count existing records
  const existing = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "TraineePerformance"`);
  console.log(`📊 Existing records in table: ${existing[0].count}`);

  // Seed in batches of 200
  const BATCH_SIZE = 200;
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  console.log(`\n📥 Seeding ${records.length} records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    for (const data of batch) {
      try {
        const id = data.id || await generateId();
        const elementScores = data.elementScores || data.scores || [];
        
        await prisma.$executeRawUnsafe(`
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
          id,
          data.traineeId || data.traineeFullName || '',
          data.traineeFullName || '',
          data.eventId || '',
          data.eventCode || data.flightNumber || '',
          data.flightNumber || '',
          data.eventDescription || null,
          data.date || '',
          data.instructorName || '',
          data.instructorId || null,
          data.overallGrade != null ? String(data.overallGrade) : 'No Grade',
          data.overallResult || null,
          data.dcoResult || null,
          data.startTime != null ? Number(data.startTime) : null,
          data.duration != null ? Number(data.duration) : null,
          data.endTime != null ? Number(data.endTime) : null,
          data.comments || null,
          JSON.stringify(elementScores),
          data.isCompleted === true || data.isCompleted === 'true',
          data.isGroundSchoolAssessment === true,
          data.groundSchoolResult != null ? parseInt(data.groundSchoolResult) : null,
          data.course || null,
          data.syllabusPhase || null,
          data.eventSequence != null ? parseInt(data.eventSequence) : null,
          'seed_script'
        );
        inserted++;
      } catch (rowErr) {
        skipped++;
        if (errors.length < 10) {
          errors.push({ eventId: data.eventId, error: rowErr.message });
        }
      }
    }

    // Progress update every 1000 records
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= records.length) {
      const progress = Math.min(i + BATCH_SIZE, records.length);
      console.log(`  Progress: ${progress}/${records.length} (${Math.round(progress/records.length*100)}%) | inserted: ${inserted} | skipped: ${skipped}`);
    }
  }

  // Final count
  const finalCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "TraineePerformance"`);
  
  // Per-course breakdown
  const courseCounts = await prisma.$queryRawUnsafe(`
    SELECT course, COUNT(*) as count 
    FROM "TraineePerformance" 
    GROUP BY course 
    ORDER BY course
  `);

  console.log('\n============================================================');
  console.log('✅ SEED COMPLETE');
  console.log('============================================================');
  console.log(`  Records inserted this run: ${inserted}`);
  console.log(`  Records skipped (duplicates): ${skipped}`);
  console.log(`  Total records in table: ${finalCount[0].count}`);
  console.log('\n  Per-course breakdown:');
  courseCounts.forEach(r => console.log(`    ${r.course?.padEnd(10) || '(none)'}: ${r.count} records`));

  if (errors.length > 0) {
    console.log(`\n⚠️  First ${errors.length} errors:`);
    errors.forEach(e => console.log(`   - ${e.eventId}: ${e.error}`));
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  prisma.$disconnect();
  process.exit(1);
});