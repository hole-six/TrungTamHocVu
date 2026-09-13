-- Hai phụ huynh (bố + mẹ) ngay từ lúc nhận lead (xem Lead.secondaryGuardianName).
ALTER TABLE "leads" ADD COLUMN "guardian_relation" TEXT;
ALTER TABLE "leads" ADD COLUMN "secondary_guardian_name" TEXT;
ALTER TABLE "leads" ADD COLUMN "secondary_guardian_relation" TEXT;
