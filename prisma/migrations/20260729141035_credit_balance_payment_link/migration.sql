-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_credit_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" DATETIME,
    CONSTRAINT "credit_balances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_balances_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_credit_balances" ("amount", "created_at", "id", "reason", "student_id", "used_at") SELECT "amount", "created_at", "id", "reason", "student_id", "used_at" FROM "credit_balances";
DROP TABLE "credit_balances";
ALTER TABLE "new_credit_balances" RENAME TO "credit_balances";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
