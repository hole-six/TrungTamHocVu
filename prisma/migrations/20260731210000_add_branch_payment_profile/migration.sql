CREATE TABLE "branch_payment_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "branch_id" TEXT NOT NULL,
  "bank_name" TEXT,
  "account_number" TEXT,
  "account_holder" TEXT,
  "qr_image_data" TEXT,
  "payment_instruction" TEXT,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "branch_payment_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "branch_payment_profiles_branch_id_key" ON "branch_payment_profiles"("branch_id");
