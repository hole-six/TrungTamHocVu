-- AlterTable
ALTER TABLE "asset_transactions" ADD COLUMN "amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "asset_cash_postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_transaction_id" TEXT NOT NULL,
    "cash_transaction_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "posting_kind" TEXT NOT NULL DEFAULT 'MAINTENANCE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "asset_cash_postings_asset_transaction_id_fkey" FOREIGN KEY ("asset_transaction_id") REFERENCES "asset_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_cash_postings_cash_transaction_id_fkey" FOREIGN KEY ("cash_transaction_id") REFERENCES "cash_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_cash_postings_asset_transaction_id_key" ON "asset_cash_postings"("asset_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_cash_postings_cash_transaction_id_key" ON "asset_cash_postings"("cash_transaction_id");
