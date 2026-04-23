-- ============================================================================
-- Migration: Add TraineePerformance Table
-- Description: Single source of truth for all PT-051 assessments across
--              ADF301, ADF302, ADF303, ADF306, FIC210, FIC211
-- Branch: feature/comprehensive-build-algorithm
-- ============================================================================

-- Create the TraineePerformance table
CREATE TABLE IF NOT EXISTS "TraineePerformance" (
    -- Primary identification
    "id"                       TEXT NOT NULL,
    -- Foreign key to Trainee.id
    "traineeId"                TEXT NOT NULL,
    -- Denormalised name for fast reads without joins (used directly by app components)
    "traineeFullName"          TEXT NOT NULL,
    -- Unique event instance ID: "sched_[timestamp]_[random8]"
    "eventId"                  TEXT NOT NULL,

    -- Event information
    -- Raw event code from spreadsheet Col B (e.g., "BGF MB1", "FIC GND1")
    "eventCode"                TEXT NOT NULL,
    -- Cleaned code for syllabus lookups (e.g., "BGF1", "MB1", "FIC1")
    "flightNumber"             TEXT NOT NULL,
    -- Human-readable description from Col C
    "eventDescription"         TEXT,
    -- ISO date string YYYY-MM-DD
    "date"                     TEXT NOT NULL,

    -- Personnel
    "instructorName"           TEXT NOT NULL,
    -- Optional FK to Personnel.id for future instructor-side queries
    "instructorId"             TEXT,

    -- Grading & results
    -- String type to support Pt051OverallGrade = 'No Grade' | 0..5
    "overallGrade"             TEXT NOT NULL,
    -- 'P' | 'F' mapped from spreadsheet "Pass"/"Fail"
    "overallResult"            TEXT,
    -- 'DCO' | 'DPCO' | 'DNCO' | ''
    "dcoResult"                TEXT,

    -- Timing in decimal hours (e.g., 8.0 = 08:00, 9.5 = 09:30)
    -- Converted from "HH:MM" string; FIC duration parsed from "1.0hr" string
    "startTime"                DOUBLE PRECISION,
    "duration"                 DOUBLE PRECISION,
    "endTime"                  DOUBLE PRECISION,

    -- Structured comment string matching app parseComments() format:
    -- "QFI: [text]\nWeather: [text]\nProfile: [text]\nOverall: [text]\nNEST: [text]"
    -- Combined from spreadsheet Cols P/Q/R/S/T on import
    -- ADF: QFI="Yes" -> null text; FIC: QFI=instructor name -> stored as text
    -- Overall col = duplicate grade number -> null text
    -- NEST col = "0" placeholder -> null (no NEST times for any trainee)
    "comments"                 TEXT,

    -- 22-element JSON array matching Pt051Assessment.scores interface:
    -- [{"element":"Airmanship","grade":"4","comment":"..."}, ...]
    -- Grades as strings to match Pt051Grade = 'MIN'|'DEMO'|0..5
    "elementScores"            JSONB NOT NULL,

    -- Status flags
    -- True once PT-051 form has been opened, edited and saved by the instructor
    -- Used by MyDashboard to show outstanding assessments to the assigned QFI
    "isCompleted"              BOOLEAN NOT NULL DEFAULT false,

    -- Ground school assessment
    "isGroundSchoolAssessment" BOOLEAN NOT NULL DEFAULT false,
    -- Percentage 0-100; null if not a GS assessment
    "groundSchoolResult"       INTEGER,

    -- Course context (derived from event codes during import)
    -- 'ADF301' | 'ADF302' | 'ADF303' | 'ADF306' | 'FIC210' | 'FIC211'
    "course"                   TEXT,
    -- Phase prefix: 'BGF' | 'BIF' | 'BNF' | 'BNAV' | 'FIC' | 'MB' | 'FTD'
    "syllabusPhase"            TEXT,
    -- Numeric sequence within phase (BGF11 -> 11, MB1 -> 1)
    "eventSequence"            INTEGER,

    -- Audit trail
    -- "import_script" for bulk imports; user id for live PT-051 submissions
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy"                TEXT,
    "updatedBy"                TEXT,

    CONSTRAINT "TraineePerformance_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on eventId (one assessment per scheduled event instance)
CREATE UNIQUE INDEX IF NOT EXISTS "TraineePerformance_eventId_key"
    ON "TraineePerformance"("eventId");

-- Core query: all assessments for a trainee (HateSheetView, TrainingIntelligence)
CREATE INDEX IF NOT EXISTS "TraineePerformance_traineeId_idx"
    ON "TraineePerformance"("traineeId");

-- Query by event type + date (schedule lookups)
CREATE INDEX IF NOT EXISTS "TraineePerformance_flightNumber_date_idx"
    ON "TraineePerformance"("flightNumber", "date");

-- MyDashboard: find all assessments by instructor name
CREATE INDEX IF NOT EXISTS "TraineePerformance_instructorName_idx"
    ON "TraineePerformance"("instructorName");

-- MyDashboard combined filter: instructor's incomplete PT-051s
CREATE INDEX IF NOT EXISTS "TraineePerformance_instructorName_isCompleted_idx"
    ON "TraineePerformance"("instructorName", "isCompleted");

-- Cross-course reporting (TrainingIntelligenceTab)
CREATE INDEX IF NOT EXISTS "TraineePerformance_course_idx"
    ON "TraineePerformance"("course");

-- Filter by syllabus phase (BGF, BIF, BNF, BNAV etc.)
CREATE INDEX IF NOT EXISTS "TraineePerformance_syllabusPhase_idx"
    ON "TraineePerformance"("syllabusPhase");

-- Sort/filter by date (timelines, progress graphs)
CREATE INDEX IF NOT EXISTS "TraineePerformance_date_idx"
    ON "TraineePerformance"("date");

-- Filter incomplete assessments across all instructors
CREATE INDEX IF NOT EXISTS "TraineePerformance_isCompleted_idx"
    ON "TraineePerformance"("isCompleted");

-- Trainee performance timeline (progress graph)
CREATE INDEX IF NOT EXISTS "TraineePerformance_traineeId_date_idx"
    ON "TraineePerformance"("traineeId", "date");

-- Trainee records within a specific course
CREATE INDEX IF NOT EXISTS "TraineePerformance_traineeId_course_idx"
    ON "TraineePerformance"("traineeId", "course");

-- Foreign key constraint: link to Trainee table
ALTER TABLE "TraineePerformance"
    ADD CONSTRAINT "TraineePerformance_traineeId_fkey"
    FOREIGN KEY ("traineeId")
    REFERENCES "Trainee"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;