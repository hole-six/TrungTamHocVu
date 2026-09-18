-- CHI TIẾT ĐỐI SOÁT CHO MỖI LẦN CHẤM ĐIỂM.
-- Khi nhân sự có ý kiến, người quản lý phải trả lời được: lỗi xảy ra LÚC NÀO, ở LỚP/BUỔI
-- nào, HẠN phải làm là khi nào, THỰC TẾ làm lúc nào (suy ra chậm bao lâu) và ĐÃ KHẮC PHỤC
-- lúc nào. Trước đây chỉ có mỗi ngày + lý do dạng chữ nên không đối soát được.
ALTER TABLE "assistant_score_events" ADD COLUMN "occurred_at" DATETIME;
ALTER TABLE "assistant_score_events" ADD COLUMN "class_id" TEXT REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assistant_score_events" ADD COLUMN "session_id" TEXT REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assistant_score_events" ADD COLUMN "due_at" DATETIME;
ALTER TABLE "assistant_score_events" ADD COLUMN "completed_at" DATETIME;
ALTER TABLE "assistant_score_events" ADD COLUMN "resolved_at" DATETIME;
ALTER TABLE "assistant_score_events" ADD COLUMN "resolved_note" TEXT;
CREATE INDEX "assistant_score_events_class_id_idx" ON "assistant_score_events"("class_id");
CREATE INDEX "assistant_score_events_session_id_idx" ON "assistant_score_events"("session_id");
