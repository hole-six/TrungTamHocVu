-- Tách "TA tự khai đã nộp/chưa nộp" khỏi "admin quyết định trừ điểm":
-- initial_status là snapshot TA tự ghi trong ngày, đóng băng sau đó; status là
-- trạng thái hiện tại admin có thể sửa (vd nộp muộn); score_decision tách hẳn
-- khỏi status, chỉ admin set qua PATCH mới (không còn TA tự trừ điểm mình).

-- Thêm cột với default tạm để thỏa NOT NULL trên dữ liệu đã có, backfill ngay sau đó.
ALTER TABLE "session_requirement_checks" ADD COLUMN "initial_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "session_requirement_checks" ADD COLUMN "reason" TEXT;
ALTER TABLE "session_requirement_checks" ADD COLUMN "score_decision" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "session_requirement_checks" ADD COLUMN "decided_by_id" TEXT;
ALTER TABLE "session_requirement_checks" ADD COLUMN "decided_at" DATETIME;

-- Backfill: initial_status = status hiện có (chưa từng có khái niệm "sửa lại" trước
-- migration này, nên trạng thái hiện tại chính là trạng thái ban đầu).
UPDATE "session_requirement_checks" SET "initial_status" = "status" WHERE "initial_status" = '';

-- Backfill: các check đã có score_event_id từ trước (được trừ điểm dưới cơ chế cũ)
-- coi như admin đã quyết định trừ điểm rồi, giữ nguyên ý nghĩa dữ liệu cũ.
UPDATE "session_requirement_checks" SET "score_decision" = 'DEDUCTED' WHERE "score_event_id" IS NOT NULL;
