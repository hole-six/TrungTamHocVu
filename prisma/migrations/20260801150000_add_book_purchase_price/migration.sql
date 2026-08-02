ALTER TABLE "books" ADD COLUMN "purchase_price" INTEGER NOT NULL DEFAULT 0;

UPDATE "books"
SET "purchase_price" = "unit_price"
WHERE "purchase_price" = 0;
