-- CreateTable: SyllabusItem
-- Stores the training curriculum structure (editable by authorised users)
CREATE TABLE "SyllabusItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventDescription" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortieType" TEXT,
    "dayNight" TEXT NOT NULL DEFAULT 'Day',
    "courses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "methodOfDelivery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "methodOfAssessment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourcesPhysical" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourcesHuman" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventDetailsCommon" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventDetailsSortie" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flightOrSimHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEventHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preFlightTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postFlightTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisitesGround" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisitesFlying" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lmpType" TEXT,
    "twrDiReqd" TEXT,
    "cctOnly" TEXT,
    "isRemedial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SyllabusHistory
-- Audit trail for all curriculum changes
CREATE TABLE "SyllabusHistory" (
    "id" TEXT NOT NULL,
    "syllabusItemId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeData" JSONB NOT NULL,
    "previousData" JSONB,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyllabusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusItem_code_key" ON "SyllabusItem"("code");

-- CreateIndex
CREATE INDEX "SyllabusItem_code_idx" ON "SyllabusItem"("code");

-- CreateIndex
CREATE INDEX "SyllabusItem_phase_idx" ON "SyllabusItem"("phase");

-- CreateIndex
CREATE INDEX "SyllabusItem_type_idx" ON "SyllabusItem"("type");

-- CreateIndex
CREATE INDEX "SyllabusItem_isActive_idx" ON "SyllabusItem"("isActive");

-- CreateIndex
CREATE INDEX "SyllabusItem_sortOrder_idx" ON "SyllabusItem"("sortOrder");

-- CreateIndex
CREATE INDEX "SyllabusHistory_syllabusItemId_idx" ON "SyllabusHistory"("syllabusItemId");

-- CreateIndex
CREATE INDEX "SyllabusHistory_createdAt_idx" ON "SyllabusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SyllabusHistory_changeType_idx" ON "SyllabusHistory"("changeType");