ALTER TABLE "asset_transactions" ADD COLUMN "voided_at" DATETIME;
ALTER TABLE "asset_transactions" ADD COLUMN "void_reason" TEXT;
