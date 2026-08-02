-- Each enrollment chooses its own collection cadence.
-- Existing enrollments retain the historic one-time course billing behaviour.
ALTER TABLE "enrollments" ADD COLUMN "billing_model" TEXT NOT NULL DEFAULT 'COURSE';
