-- Add photoUrl column to Personnel table
-- Stores a URL string pointing to the personnel member's profile photo.
-- Can be:
--   • A base64 data URI  (e.g. data:image/jpeg;base64,...)
--   • An absolute HTTPS URL (e.g. https://cdn.example.com/photo.jpg)
--   • NULL when no photo has been uploaded yet

ALTER TABLE "Personnel" ADD COLUMN "photoUrl" TEXT;