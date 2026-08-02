CREATE TABLE "enrollment_installments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "enrollment_id" TEXT NOT NULL,
  "billing_period_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "due_date" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "enrollment_installments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "enrollment_installments_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "enrollment_installments_enrollment_id_sequence_key" ON "enrollment_installments"("enrollment_id", "sequence");
CREATE UNIQUE INDEX "enrollment_installments_enrollment_id_billing_period_id_key" ON "enrollment_installments"("enrollment_id", "billing_period_id");
CREATE INDEX "enrollment_installments_billing_period_id_status_idx" ON "enrollment_installments"("billing_period_id", "status");

ALTER TABLE "charges" ADD COLUMN "installment_id" TEXT;
CREATE UNIQUE INDEX "charges_installment_id_key" ON "charges"("installment_id");
