-- AlterTable
ALTER TABLE "leads" ADD COLUMN "current_school_grade" TEXT;
ALTER TABLE "leads" ADD COLUMN "secondary_phone" TEXT;
ALTER TABLE "leads" ADD COLUMN "zalo_contact" TEXT;

-- CreateTable
CREATE TABLE "class_roadmap_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "objective" TEXT,
    "materials" TEXT,
    "teacher_guide" TEXT,
    "homework_guide" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "class_roadmap_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assistant_monthly_bonuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "bonus_percent" REAL NOT NULL,
    "notes" TEXT,
    "decided_by_id" TEXT,
    "decided_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_monthly_bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assistant_monthly_bonuses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assistant_monthly_bonuses" ("bonus_percent", "decided_at", "decided_by_id", "employee_id", "id", "month", "notes") SELECT "bonus_percent", "decided_at", "decided_by_id", "employee_id", "id", "month", "notes" FROM "assistant_monthly_bonuses";
DROP TABLE "assistant_monthly_bonuses";
ALTER TABLE "new_assistant_monthly_bonuses" RENAME TO "assistant_monthly_bonuses";
CREATE UNIQUE INDEX "assistant_monthly_bonuses_employee_id_branch_id_month_key" ON "assistant_monthly_bonuses"("employee_id", "branch_id", "month");
CREATE TABLE "new_class_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completed_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "replaces_session_id" TEXT,
    CONSTRAINT "class_sessions_replaces_session_id_fkey" FOREIGN KEY ("replaces_session_id") REFERENCES "class_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_class_sessions" ("class_id", "completed_at", "created_at", "end_time", "id", "notes", "room", "session_date", "start_time", "status", "updated_at") SELECT "class_id", "completed_at", "created_at", "end_time", "id", "notes", "room", "session_date", "start_time", "status", "updated_at" FROM "class_sessions";
DROP TABLE "class_sessions";
ALTER TABLE "new_class_sessions" RENAME TO "class_sessions";
CREATE UNIQUE INDEX "class_sessions_replaces_session_id_key" ON "class_sessions"("replaces_session_id");
CREATE INDEX "class_sessions_class_id_session_date_idx" ON "class_sessions"("class_id", "session_date");
CREATE TABLE "new_placement_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "scheduled_date" DATETIME,
    "test_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "suggested_class" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "placement_tests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_placement_tests" ("id", "lead_id", "notes", "result", "status", "suggested_class", "test_date") SELECT "id", "lead_id", "notes", "result", "status", "suggested_class", "test_date" FROM "placement_tests";
DROP TABLE "placement_tests";
ALTER TABLE "new_placement_tests" RENAME TO "placement_tests";
CREATE TABLE "new_report_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "report_code" TEXT NOT NULL,
    "filter_hash" TEXT NOT NULL,
    "filter_json" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SNAPSHOT',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "as_of_at" DATETIME NOT NULL,
    "summary_json" TEXT,
    "detail_json" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_report_snapshots" ("as_of_at", "branch_id", "created_at", "created_by_id", "detail_json", "filter_hash", "filter_json", "id", "mode", "period_id", "report_code", "row_count", "status", "summary_json", "updated_at") SELECT "as_of_at", "branch_id", "created_at", "created_by_id", "detail_json", "filter_hash", "filter_json", "id", "mode", "period_id", "report_code", "row_count", "status", "summary_json", "updated_at" FROM "report_snapshots";
DROP TABLE "report_snapshots";
ALTER TABLE "new_report_snapshots" RENAME TO "report_snapshots";
CREATE INDEX "report_snapshots_branch_id_report_code_as_of_at_idx" ON "report_snapshots"("branch_id", "report_code", "as_of_at");
CREATE UNIQUE INDEX "report_snapshots_period_id_report_code_filter_hash_key" ON "report_snapshots"("period_id", "report_code", "filter_hash");
CREATE TABLE "new_reporting_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closed_at" DATETIME,
    "closed_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_reporting_periods" ("branch_id", "closed_at", "closed_by_id", "created_at", "end_date", "id", "period_key", "period_type", "start_date", "status", "updated_at") SELECT "branch_id", "closed_at", "closed_by_id", "created_at", "end_date", "id", "period_key", "period_type", "start_date", "status", "updated_at" FROM "reporting_periods";
DROP TABLE "reporting_periods";
ALTER TABLE "new_reporting_periods" RENAME TO "reporting_periods";
CREATE INDEX "reporting_periods_branch_id_start_date_end_date_idx" ON "reporting_periods"("branch_id", "start_date", "end_date");
CREATE UNIQUE INDEX "reporting_periods_branch_id_period_type_period_key_key" ON "reporting_periods"("branch_id", "period_type", "period_key");
CREATE TABLE "new_scholarships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "percentage" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    CONSTRAINT "scholarships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scholarships_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_scholarships" ("effective_from", "effective_to", "id", "percentage", "reason", "student_id") SELECT "effective_from", "effective_to", "id", "percentage", "reason", "student_id" FROM "scholarships";
DROP TABLE "scholarships";
ALTER TABLE "new_scholarships" RENAME TO "scholarships";
CREATE INDEX "scholarships_enrollment_id_idx" ON "scholarships"("enrollment_id");
CREATE TABLE "new_session_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hours" REAL,
    "deducted_hours" REAL NOT NULL DEFAULT 0,
    "added_hours" REAL NOT NULL DEFAULT 0,
    "adjustment_note" TEXT,
    "is_substitute_shift" BOOLEAN NOT NULL DEFAULT false,
    "hourly_rate" INTEGER,
    "amount" INTEGER,
    "check_in_at" DATETIME,
    "check_out_at" DATETIME,
    "substitute_for_id" TEXT,
    CONSTRAINT "session_assignments_substitute_for_id_fkey" FOREIGN KEY ("substitute_for_id") REFERENCES "session_assignments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "session_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_session_assignments" ("added_hours", "adjustment_note", "amount", "deducted_hours", "employee_id", "hourly_rate", "hours", "id", "is_substitute_shift", "role", "session_id") SELECT "added_hours", "adjustment_note", "amount", "deducted_hours", "employee_id", "hourly_rate", "hours", "id", "is_substitute_shift", "role", "session_id" FROM "session_assignments";
DROP TABLE "session_assignments";
ALTER TABLE "new_session_assignments" RENAME TO "session_assignments";
CREATE UNIQUE INDEX "session_assignments_substitute_for_id_key" ON "session_assignments"("substitute_for_id");
CREATE INDEX "session_assignments_employee_id_idx" ON "session_assignments"("employee_id");
CREATE UNIQUE INDEX "session_assignments_session_id_employee_id_role_key" ON "session_assignments"("session_id", "employee_id", "role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "class_roadmap_items_class_id_session_number_idx" ON "class_roadmap_items"("class_id", "session_number");

-- CreateIndex
CREATE UNIQUE INDEX "class_roadmap_items_class_id_session_number_key" ON "class_roadmap_items"("class_id", "session_number");


