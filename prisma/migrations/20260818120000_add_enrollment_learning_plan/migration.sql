-- Learning-plan fields for per-student course progress and continuation billing.
ALTER TABLE "classes" ADD COLUMN "next_class_id" TEXT;

ALTER TABLE "enrollments" ADD COLUMN "purchased_main_session_count" INTEGER;
ALTER TABLE "enrollments" ADD COLUMN "tuition_unit_price_snapshot" INTEGER;
ALTER TABLE "enrollments" ADD COLUMN "paid_catchup_session_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "paid_catchup_unit_price" INTEGER;
ALTER TABLE "enrollments" ADD COLUMN "learning_start_date" DATETIME;
ALTER TABLE "enrollments" ADD COLUMN "expected_student_end_date" DATETIME;
ALTER TABLE "enrollments" ADD COLUMN "continuation_status" TEXT NOT NULL DEFAULT 'ON_TRACK';
ALTER TABLE "enrollments" ADD COLUMN "pricing_basis" TEXT NOT NULL DEFAULT 'FULL_COURSE';
ALTER TABLE "enrollments" ADD COLUMN "transferred_from_enrollment_id" TEXT;
ALTER TABLE "enrollments" ADD COLUMN "transferred_value_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "transferred_converted_session_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "transferred_remaining_cash_amount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "session_credits" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'ABSENCE';
ALTER TABLE "session_credits" ADD COLUMN "unit_price_snapshot" INTEGER;
ALTER TABLE "session_credits" ADD COLUMN "paid_amount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "charges" ADD COLUMN "main_tuition_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "charges" ADD COLUMN "paid_catchup_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "charges" ADD COLUMN "transfer_credit_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "charges" ADD COLUMN "transfer_remainder_amount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "classes_next_class_id_idx" ON "classes"("next_class_id");
CREATE INDEX "enrollments_transferred_from_enrollment_id_idx" ON "enrollments"("transferred_from_enrollment_id");

UPDATE "enrollments"
SET
  "purchased_main_session_count" = (
    SELECT "total_sessions" FROM "classes" WHERE "classes"."id" = "enrollments"."class_id"
  ),
  "tuition_unit_price_snapshot" = COALESCE(
    (SELECT "tuition_per_session" FROM "classes" WHERE "classes"."id" = "enrollments"."class_id"),
    (
      SELECT "courses"."tuition_per_session"
      FROM "classes"
      JOIN "courses" ON "courses"."id" = "classes"."course_id"
      WHERE "classes"."id" = "enrollments"."class_id"
    )
  ),
  "learning_start_date" = "enroll_date";

UPDATE "charges"
SET "main_tuition_amount" = "tuition_amount"
WHERE "main_tuition_amount" = 0 AND "paid_catchup_amount" = 0;
