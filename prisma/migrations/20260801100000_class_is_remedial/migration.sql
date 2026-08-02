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
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_classes" ("branch_id", "class_code", "class_group", "class_name", "course_id", "created_at", "expected_end_date", "id", "notes", "sessions_per_week", "start_date", "status", "total_sessions", "tuition_per_session", "updated_at") SELECT "branch_id", "class_code", "class_group", "class_name", "course_id", "created_at", "expected_end_date", "id", "notes", "sessions_per_week", "start_date", "status", "total_sessions", "tuition_per_session", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_class_code_key" ON "classes"("class_code");
CREATE INDEX "classes_status_idx" ON "classes"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
