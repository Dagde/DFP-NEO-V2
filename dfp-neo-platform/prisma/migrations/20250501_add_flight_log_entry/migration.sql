-- CreateTable: FlightLogEntry
-- One row per sortie per person (trainee or instructor)
-- Applied manually via Railway PostgreSQL console or psql

CREATE TABLE IF NOT EXISTS "FlightLogEntry" (
    "id"              TEXT NOT NULL,
    "scheduleEventId" TEXT NOT NULL,
    "eventCode"       TEXT NOT NULL,
    "eventDate"       TEXT NOT NULL,
    "eventType"       TEXT NOT NULL DEFAULT 'flight',
    "traineeId"       TEXT,
    "personnelId"     TEXT,
    "personName"      TEXT NOT NULL,
    "personRole"      TEXT NOT NULL,
    "aircraftNumber"  TEXT,
    "fromIcao"        TEXT,
    "toIcao"          TEXT,
    "duty"            TEXT,
    "isSolo"          BOOLEAN NOT NULL DEFAULT false,
    "isDual"          BOOLEAN NOT NULL DEFAULT false,
    "isFlightLog"     BOOLEAN NOT NULL DEFAULT true,
    "isFtdLog"        BOOLEAN NOT NULL DEFAULT false,
    "takeoffTime"     TEXT,
    "landTime"        TEXT,
    "totalTime"       DOUBLE PRECISION,
    "captainTime"     DOUBLE PRECISION,
    "instructorTime"  DOUBLE PRECISION,
    "nightTime"       DOUBLE PRECISION,
    "ifActualTime"    DOUBLE PRECISION,
    "ifSimTime"       DOUBLE PRECISION,
    "ineffectiveTime" DOUBLE PRECISION,
    "ilsCount"        INTEGER NOT NULL DEFAULT 0,
    "rnpCount"        INTEGER NOT NULL DEFAULT 0,
    "tacanCount"      INTEGER NOT NULL DEFAULT 0,
    "vorCount"        INTEGER NOT NULL DEFAULT 0,
    "recordedBy"      TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightLogEntry_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "FlightLogEntry_scheduleEventId_idx" ON "FlightLogEntry"("scheduleEventId");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_traineeId_idx"        ON "FlightLogEntry"("traineeId");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_personnelId_idx"      ON "FlightLogEntry"("personnelId");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_personName_idx"       ON "FlightLogEntry"("personName");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_eventDate_idx"        ON "FlightLogEntry"("eventDate");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_eventCode_idx"        ON "FlightLogEntry"("eventCode");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_scheduleEventId_personRole_idx" ON "FlightLogEntry"("scheduleEventId", "personRole");

-- Logbook snapshot columns (added post-initial migration — already applied via ALTER TABLE)
-- ALTER TABLE "FlightLogEntry" ADD COLUMN IF NOT EXISTS "captainLogSnapshot" JSONB;
-- ALTER TABLE "FlightLogEntry" ADD COLUMN IF NOT EXISTS "crewLogSnapshot" JSONB;

-- Foreign key constraints (soft — NULLable so records survive person deletion)
-- Note: IF NOT EXISTS not supported for ADD CONSTRAINT, using ALTER TABLE with DO blocks instead
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlightLogEntry_traineeId_fkey') THEN
        ALTER TABLE "FlightLogEntry"
            ADD CONSTRAINT "FlightLogEntry_traineeId_fkey"
            FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlightLogEntry_personnelId_fkey') THEN
        ALTER TABLE "FlightLogEntry"
            ADD CONSTRAINT "FlightLogEntry_personnelId_fkey"
            FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL;
    END IF;
END $$;