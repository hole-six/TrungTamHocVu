-- CreateTable
CREATE TABLE "enrollment_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollment_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "enrollment_wallets_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollment_wallet_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "session_id" TEXT,
    "payment_id" TEXT,
    "unit_price_at_time" INTEGER,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enrollment_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "enrollment_wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollment_wallet_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollment_wallet_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_wallets_enrollment_id_key" ON "enrollment_wallets"("enrollment_id");

-- CreateIndex
CREATE INDEX "enrollment_wallet_transactions_wallet_id_idx" ON "enrollment_wallet_transactions"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_wallet_transactions_wallet_id_session_id_key" ON "enrollment_wallet_transactions"("wallet_id", "session_id");
