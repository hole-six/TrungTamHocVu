-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "asset_code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "room" TEXT,
    "unit_value" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "to_room" TEXT,
    "txn_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_transactions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "assets_branch_id_idx" ON "assets"("branch_id");

-- CreateIndex
CREATE INDEX "asset_transactions_asset_id_txn_date_idx" ON "asset_transactions"("asset_id", "txn_date");
