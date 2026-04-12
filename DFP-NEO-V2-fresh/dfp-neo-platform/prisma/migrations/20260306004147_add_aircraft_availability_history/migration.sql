-- CreateTable
CREATE TABLE "AircraftAvailabilityHistory" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dailyAverage" DOUBLE PRECISION NOT NULL,
    "plannedCount" INTEGER NOT NULL,
    "actualCount" INTEGER,
    "totalAircraft" INTEGER NOT NULL,
    "availabilityPct" DOUBLE PRECISION NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AircraftAvailabilityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AircraftAvailabilityHistory_date_key" ON "AircraftAvailabilityHistory"("date");

-- CreateIndex
CREATE INDEX "AircraftAvailabilityHistory_date_idx" ON "AircraftAvailabilityHistory"("date");

-- CreateIndex
CREATE INDEX "AircraftAvailabilityHistory_createdAt_idx" ON "AircraftAvailabilityHistory"("createdAt");