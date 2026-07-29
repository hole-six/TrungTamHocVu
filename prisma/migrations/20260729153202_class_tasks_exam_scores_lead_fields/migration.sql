-- AlterTable
ALTER TABLE "leads" ADD COLUMN "facebook_link" TEXT;
ALTER TABLE "leads" ADD COLUMN "facebook_parent_name" TEXT;
ALTER TABLE "leads" ADD COLUMN "initial_assessment" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "referred_by" TEXT;

-- CreateTable
CREATE TABLE "class_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recurrence" TEXT NOT NULL,
    "day_of_month" INTEGER,
    "weekday" INTEGER,
    "once_date" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_tasks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_task_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_task_id" TEXT NOT NULL,
    "due_date" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "completed_by_id" TEXT,
    "notes" TEXT,
    CONSTRAINT "class_task_logs_class_task_id_fkey" FOREIGN KEY ("class_task_id") REFERENCES "class_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "school_exam_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "school_year" TEXT NOT NULL,
    "mid_term_1" REAL,
    "final_term_1" REAL,
    "mid_term_2" REAL,
    "final_term_2" REAL,
    "notes" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "school_exam_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_session_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hours" REAL,
    "deducted_hours" REAL NOT NULL DEFAULT 0,
    "added_hours" REAL NOT NULL DEFAULT 0,
    "adjustment_note" TEXT,
    "hourly_rate" INTEGER,
    "amount" INTEGER,
    CONSTRAINT "session_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_session_assignments" ("amount", "employee_id", "hourly_rate", "hours", "id", "role", "session_id") SELECT "amount", "employee_id", "hourly_rate", "hours", "id", "role", "session_id" FROM "session_assignments";
DROP TABLE "session_assignments";
ALTER TABLE "new_session_assignments" RENAME TO "session_assignments";
CREATE INDEX "session_assignments_employee_id_idx" ON "session_assignments"("employee_id");
CREATE UNIQUE INDEX "session_assignments_session_id_employee_id_role_key" ON "session_assignments"("session_id", "employee_id", "role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "class_tasks_class_id_idx" ON "class_tasks"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_task_logs_class_task_id_due_date_key" ON "class_task_logs"("class_task_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "school_exam_scores_student_id_school_year_key" ON "school_exam_scores"("student_id", "school_year");
