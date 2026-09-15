-- Buổi bị cho nghỉ vì ngày nghỉ của trung tâm — để xóa ngày nghỉ thì khôi phục đúng các buổi đó.
ALTER TABLE "class_sessions" ADD COLUMN "cancelled_by_holiday_id" TEXT REFERENCES "holidays" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "class_sessions_cancelled_by_holiday_id_idx" ON "class_sessions"("cancelled_by_holiday_id");
