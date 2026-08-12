-- Add photoUrl column to Trainee table.
-- Stores a base64 data URI or HTTPS URL for the trainee profile photo.

ALTER TABLE "Trainee" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
