-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "student_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "lead_id" TEXT,
    "gender" TEXT,
    "dob" DATETIME,
    "phone" TEXT,
    "address" TEXT,
    "enroll_date" DATETIME,
    "leave_date" DATETIME,
    "leave_reason" TEXT,
    "evaluation" TEXT,
    "referred_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "students_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_students" ("address", "branch_id", "created_at", "dob", "enroll_date", "evaluation", "full_name", "gender", "id", "lead_id", "leave_date", "leave_reason", "notes", "phone", "referred_by", "status", "student_code", "updated_at") SELECT "address", "branch_id", "created_at", "dob", "enroll_date", "evaluation", "full_name", "gender", "id", "lead_id", "leave_date", "leave_reason", "notes", "phone", "referred_by", "status", "student_code", "updated_at" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");
CREATE UNIQUE INDEX "students_lead_id_key" ON "students"("lead_id");
CREATE INDEX "students_status_idx" ON "students"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
