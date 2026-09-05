-- CreateTable
CREATE TABLE "makeup_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "missed_session_id" TEXT,
    "requested_date" DATETIME,
    "scheduled_session_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "makeup_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "makeup_requests_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "makeup_requests_missed_session_id_fkey" FOREIGN KEY ("missed_session_id") REFERENCES "class_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "makeup_requests_scheduled_session_id_fkey" FOREIGN KEY ("scheduled_session_id") REFERENCES "class_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "course_id" TEXT,
    "class_code" TEXT NOT NULL,
    "class_group" TEXT,
    "class_name" TEXT NOT NULL,
    "total_sessions" INTEGER,
    "start_date" DATETIME,
    "expected_end_date" DATETIME,
    "sessions_per_week" INTEGER,
    "tuition_per_session" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_remedial" BOOLEAN NOT NULL DEFAULT false,
    "next_class_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "classes_next_class_id_fkey" FOREIGN KEY ("next_class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_classes" ("branch_id", "class_code", "class_group", "class_name", "course_id", "created_at", "expected_end_date", "id", "is_remedial", "next_class_id", "notes", "sessions_per_week", "start_date", "status", "total_sessions", "tuition_per_session", "updated_at") SELECT "branch_id", "class_code", "class_group", "class_name", "course_id", "created_at", "expected_end_date", "id", "is_remedial", "next_class_id", "notes", "sessions_per_week", "start_date", "status", "total_sessions", "tuition_per_session", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_class_code_key" ON "classes"("class_code");
CREATE INDEX "classes_status_idx" ON "classes"("status");
CREATE INDEX "classes_next_class_id_idx" ON "classes"("next_class_id");
CREATE TABLE "new_enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT,
    "course_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billing_model" TEXT NOT NULL DEFAULT 'COURSE',
    "enroll_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "purchased_main_session_count" INTEGER,
    "manual_extra_session_count" INTEGER NOT NULL DEFAULT 0,
    "tuition_unit_price_snapshot" INTEGER,
    "paid_catchup_session_count" INTEGER NOT NULL DEFAULT 0,
    "paid_catchup_unit_price" INTEGER,
    "learning_start_date" DATETIME,
    "expected_student_end_date" DATETIME,
    "continuation_status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "pricing_basis" TEXT NOT NULL DEFAULT 'FULL_COURSE',
    "transferred_from_enrollment_id" TEXT,
    "transferred_value_amount" INTEGER NOT NULL DEFAULT 0,
    "transferred_converted_session_count" INTEGER NOT NULL DEFAULT 0,
    "transferred_remaining_cash_amount" INTEGER NOT NULL DEFAULT 0,
    "used_session_count" INTEGER NOT NULL DEFAULT 0,
    "package_label" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollments_transferred_from_enrollment_id_fkey" FOREIGN KEY ("transferred_from_enrollment_id") REFERENCES "enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_enrollments" ("billing_model", "class_id", "continuation_status", "created_at", "end_date", "enroll_date", "expected_student_end_date", "id", "learning_start_date", "manual_extra_session_count", "notes", "paid_catchup_session_count", "paid_catchup_unit_price", "pricing_basis", "purchased_main_session_count", "status", "student_id", "transferred_converted_session_count", "transferred_from_enrollment_id", "transferred_remaining_cash_amount", "transferred_value_amount", "tuition_unit_price_snapshot", "updated_at") SELECT "billing_model", "class_id", "continuation_status", "created_at", "end_date", "enroll_date", "expected_student_end_date", "id", "learning_start_date", "manual_extra_session_count", "notes", "paid_catchup_session_count", "paid_catchup_unit_price", "pricing_basis", "purchased_main_session_count", "status", "student_id", "transferred_converted_session_count", "transferred_from_enrollment_id", "transferred_remaining_cash_amount", "transferred_value_amount", "tuition_unit_price_snapshot", "updated_at" FROM "enrollments";
DROP TABLE "enrollments";
ALTER TABLE "new_enrollments" RENAME TO "enrollments";
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");
CREATE INDEX "enrollments_transferred_from_enrollment_id_idx" ON "enrollments"("transferred_from_enrollment_id");
CREATE TABLE "new_session_requirement_checks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "requirement_text" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "initial_status" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "score_decision" TEXT NOT NULL DEFAULT 'PENDING',
    "score_event_id" TEXT,
    "checked_by_id" TEXT NOT NULL,
    "checked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" TEXT,
    "decided_at" DATETIME,
    CONSTRAINT "session_requirement_checks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_requirement_checks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_requirement_checks_score_event_id_fkey" FOREIGN KEY ("score_event_id") REFERENCES "assistant_score_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_session_requirement_checks" ("checked_at", "checked_by_id", "decided_at", "decided_by_id", "employee_id", "id", "initial_status", "reason", "requirement_text", "score_decision", "score_event_id", "session_id", "status") SELECT "checked_at", "checked_by_id", "decided_at", "decided_by_id", "employee_id", "id", "initial_status", "reason", "requirement_text", "score_decision", "score_event_id", "session_id", "status" FROM "session_requirement_checks";
DROP TABLE "session_requirement_checks";
ALTER TABLE "new_session_requirement_checks" RENAME TO "session_requirement_checks";
CREATE UNIQUE INDEX "session_requirement_checks_session_id_key" ON "session_requirement_checks"("session_id");
CREATE UNIQUE INDEX "session_requirement_checks_score_event_id_key" ON "session_requirement_checks"("score_event_id");
CREATE TABLE "new_student_attendances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "purpose" TEXT NOT NULL DEFAULT 'NORMAL',
    "enrollment_id" TEXT,
    "notes" TEXT,
    CONSTRAINT "student_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_attendances_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_student_attendances" ("id", "notes", "session_id", "status", "student_id") SELECT "id", "notes", "session_id", "status", "student_id" FROM "student_attendances";
DROP TABLE "student_attendances";
ALTER TABLE "new_student_attendances" RENAME TO "student_attendances";
CREATE INDEX "student_attendances_student_id_idx" ON "student_attendances"("student_id");
CREATE UNIQUE INDEX "student_attendances_session_id_student_id_key" ON "student_attendances"("session_id", "student_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "makeup_requests_student_id_status_idx" ON "makeup_requests"("student_id", "status");

