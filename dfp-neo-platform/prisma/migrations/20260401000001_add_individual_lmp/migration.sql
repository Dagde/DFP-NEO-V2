-- CreateTable
CREATE TABLE "IndividualLMP" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "traineeFullName" TEXT NOT NULL,
    "lmpType" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "completedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndividualLMP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndividualLMP_traineeId_key" ON "IndividualLMP"("traineeId");

-- CreateIndex
CREATE INDEX "IndividualLMP_traineeFullName_idx" ON "IndividualLMP"("traineeFullName");

-- CreateIndex
CREATE INDEX "IndividualLMP_traineeId_idx" ON "IndividualLMP"("traineeId");

-- AddForeignKey
ALTER TABLE "IndividualLMP" ADD CONSTRAINT "IndividualLMP_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;