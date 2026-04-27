-- CreateTable for AircraftAvailabilityEvent (raw event log)
CREATE TABLE "AircraftAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "availableCount" INTEGER NOT NULL,
    "totalAircraft" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AircraftAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AircraftAvailabilityEvent_date_idx" ON "AircraftAvailabilityEvent"("date");

-- CreateIndex
CREATE INDEX "AircraftAvailabilityEvent_timestamp_idx" ON "AircraftAvailabilityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AircraftAvailabilityEvent_changeType_idx" ON "AircraftAvailabilityEvent"("changeType");

-- Add lastCalculatedAt and flyingWindow columns to existing AircraftAvailabilityHistory
-- (safe to run even if column already exists - wrapped in DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AircraftAvailabilityHistory'
        AND column_name = 'lastCalculatedAt'
    ) THEN
        ALTER TABLE "AircraftAvailabilityHistory"
        ADD COLUMN "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AircraftAvailabilityHistory'
        AND column_name = 'flyingWindowStart'
    ) THEN
        ALTER TABLE "AircraftAvailabilityHistory"
        ADD COLUMN "flyingWindowStart" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AircraftAvailabilityHistory'
        AND column_name = 'flyingWindowEnd'
    ) THEN
        ALTER TABLE "AircraftAvailabilityHistory"
        ADD COLUMN "flyingWindowEnd" TEXT;
    END IF;
END $$;