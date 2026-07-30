-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "role_id" TEXT,
    "branch_id" TEXT,
    "employee_id" TEXT,
    "guardian_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("branch_id", "created_at", "email", "employee_id", "full_name", "id", "is_active", "last_login_at", "password_hash", "role", "role_id", "updated_at") SELECT "branch_id", "created_at", "email", "employee_id", "full_name", "id", "is_active", "last_login_at", "password_hash", "role", "role_id", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");
CREATE UNIQUE INDEX "users_guardian_id_key" ON "users"("guardian_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
