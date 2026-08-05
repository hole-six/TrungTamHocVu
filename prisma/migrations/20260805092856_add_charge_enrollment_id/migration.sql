-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_charges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "billing_period_id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "absent_count" INTEGER NOT NULL DEFAULT 0,
    "deducted_count" INTEGER NOT NULL DEFAULT 0,
    "unit_price" INTEGER NOT NULL,
    "tuition_amount" INTEGER NOT NULL,
    "materials_amount" INTEGER NOT NULL DEFAULT 0,
    "opening_balance" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "billing_model" TEXT NOT NULL DEFAULT 'PERIOD',
    "installment_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "charges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charges_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charges_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charges_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "charges_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "enrollment_installments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_charges" ("absent_count", "billing_model", "billing_period_id", "class_id", "created_at", "deducted_count", "id", "installment_id", "materials_amount", "notes", "opening_balance", "session_count", "student_id", "total_amount", "tuition_amount", "unit_price", "updated_at") SELECT "absent_count", "billing_model", "billing_period_id", "class_id", "created_at", "deducted_count", "id", "installment_id", "materials_amount", "notes", "opening_balance", "session_count", "student_id", "total_amount", "tuition_amount", "unit_price", "updated_at" FROM "charges";
DROP TABLE "charges";
ALTER TABLE "new_charges" RENAME TO "charges";
CREATE UNIQUE INDEX "charges_installment_id_key" ON "charges"("installment_id");
CREATE INDEX "charges_billing_period_id_idx" ON "charges"("billing_period_id");
CREATE INDEX "charges_enrollment_id_idx" ON "charges"("enrollment_id");
CREATE UNIQUE INDEX "charges_student_id_class_id_billing_period_id_key" ON "charges"("student_id", "class_id", "billing_period_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

