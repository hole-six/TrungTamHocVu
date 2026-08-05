-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "percentage" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    "enrollment_id" TEXT,
    CONSTRAINT "adjustments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "adjustments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_adjustments" ("effective_from", "effective_to", "id", "percentage", "reason", "student_id") SELECT "effective_from", "effective_to", "id", "percentage", "reason", "student_id" FROM "adjustments";
DROP TABLE "adjustments";
ALTER TABLE "new_adjustments" RENAME TO "adjustments";
CREATE INDEX "adjustments_enrollment_id_idx" ON "adjustments"("enrollment_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

