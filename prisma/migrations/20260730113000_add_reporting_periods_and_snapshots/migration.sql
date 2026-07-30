CREATE TABLE "reporting_periods" (
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
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reporting_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reporting_periods_branch_id_period_type_period_key_key"
ON "reporting_periods"("branch_id", "period_type", "period_key");

CREATE INDEX "reporting_periods_branch_id_start_date_end_date_idx"
ON "reporting_periods"("branch_id", "start_date", "end_date");

CREATE TABLE "report_snapshots" (
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
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "report_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "report_snapshots_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "reporting_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "report_snapshots_period_id_report_code_filter_hash_key"
ON "report_snapshots"("period_id", "report_code", "filter_hash");

CREATE INDEX "report_snapshots_branch_id_report_code_as_of_at_idx"
ON "report_snapshots"("branch_id", "report_code", "as_of_at");
