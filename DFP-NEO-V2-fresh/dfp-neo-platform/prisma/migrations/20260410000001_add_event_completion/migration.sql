-- CreateTable: EventCompletion
-- DCO-based tracking table. Records the completion outcome of every scheduled
-- event that generates a DCO result (DCO | DPCO | DNCO). This gives a
-- persistent, queryable store for:
--   • ELCE (Effective Last Completed Event) lookup in the build algorithm
--   • Post-flight DCO result history per trainee
--   • Analytics / reporting on completion rates by course / date range

CREATE TABLE "EventCompletion" (
    -- Primary key
    "id"                TEXT        NOT NULL,

    -- Foreign-key links (soft references kept as plain strings so the table
    -- survives if the related rows are archived / deleted)
    "scheduleEventId"   TEXT        NOT NULL,   -- ScheduleEvent.id from the DFP schedule JSON
    "traineeId"         TEXT,                   -- Trainee.id (nullable: staff CAT / solo events may have no trainee)
    "traineeFullName"   TEXT        NOT NULL,   -- Denormalised name for fast lookup without join
    "instructorName"    TEXT,                   -- Instructor who conducted the event

    -- Event identity
    "eventCode"         TEXT        NOT NULL,   -- e.g. "BGF2", "BNF1" — syllabus code
    "eventDate"         TEXT        NOT NULL,   -- ISO date YYYY-MM-DD of the scheduled sortie
    "eventType"         TEXT        NOT NULL DEFAULT 'flight',
                                                -- 'flight' | 'ftd' | 'cpt' | 'ground'
    "startTime"         DOUBLE PRECISION NOT NULL DEFAULT 0,
                                                -- Decimal hours, e.g. 9.5 = 09:30
    "duration"          DOUBLE PRECISION NOT NULL DEFAULT 0,
                                                -- Decimal hours

    -- DCO result (the core DCO-tracking payload)
    "dcoResult"         TEXT        NOT NULL,   -- 'DCO' | 'DPCO' | 'DNCO'
    "overallGrade"      INTEGER,                -- PT-051 overall grade 0-5 (nullable for non-graded events)
    "overallResult"     TEXT,                   -- 'P' | 'F' | null

    -- Flight log details captured at post-flight time
    "aircraftNumber"    TEXT,                   -- e.g. "A54-042"
    "takeoffTime"       TEXT,                   -- "HH:MM" string
    "landTime"          TEXT,                   -- "HH:MM" string
    "totalFlightTime"   DOUBLE PRECISION,       -- Hours (land - takeoff, decimal)
    "isSolo"            BOOLEAN     NOT NULL DEFAULT false,
    "isDual"            BOOLEAN     NOT NULL DEFAULT false,

    -- Build-algorithm ELCE support
    -- When the build algorithm queries "what is this trainee's last completed event
    -- as of <buildDate>?" it can read directly from this table instead of needing
    -- to join Score records through IndividualLMP.
    "isCountedAsElce"   BOOLEAN     NOT NULL DEFAULT true,
                                                -- False for DNCO (unsuccessful) events —
                                                -- those should NOT advance the trainee's next-event pointer

    -- Source / audit
    "recordedBy"        TEXT,                   -- userId of person who saved the post-flight form
    "source"            TEXT        NOT NULL DEFAULT 'post_flight',
                                                -- 'post_flight' | 'manual' | 'import'
    "notes"             TEXT,

    -- Timestamps
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCompletion_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup by trainee (most common query pattern)
CREATE INDEX "EventCompletion_traineeId_idx"
    ON "EventCompletion"("traineeId");

CREATE INDEX "EventCompletion_traineeFullName_idx"
    ON "EventCompletion"("traineeFullName");

-- Date-range queries (build algorithm ELCE, reporting)
CREATE INDEX "EventCompletion_eventDate_idx"
    ON "EventCompletion"("eventDate");

-- Composite: trainee + date (most common ELCE query)
CREATE INDEX "EventCompletion_traineeFullName_eventDate_idx"
    ON "EventCompletion"("traineeFullName", "eventDate");

-- By event code (syllabus progress queries)
CREATE INDEX "EventCompletion_eventCode_idx"
    ON "EventCompletion"("eventCode");

-- By DCO result (reporting / filtering)
CREATE INDEX "EventCompletion_dcoResult_idx"
    ON "EventCompletion"("dcoResult");

-- Prevent duplicate completion records for the same schedule event
CREATE UNIQUE INDEX "EventCompletion_scheduleEventId_key"
    ON "EventCompletion"("scheduleEventId");

-- ── Foreign key to Trainee (optional — preserved through traineeFullName if trainee deleted) ──
ALTER TABLE "EventCompletion"
    ADD CONSTRAINT "EventCompletion_traineeId_fkey"
    FOREIGN KEY ("traineeId")
    REFERENCES "Trainee"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;