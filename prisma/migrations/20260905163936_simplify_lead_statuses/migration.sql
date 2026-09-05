-- Gộp 8 trạng thái lead cũ về 4 trạng thái (xem lib/server/lead-rules.ts).
-- NEW / APPOINTED / TESTED / UNQUALIFIED  ->  CONTACTING
-- QUALIFIED / ENROLLED / LOST             ->  giữ nguyên
--
-- Chỉ đổi DỮ LIỆU, không đổi cấu trúc: leads.status là cột TEXT tự do, không phải enum
-- trong DB. Lịch sử đổi trạng thái (nếu có) cố tình KHÔNG sửa — lịch sử phải giữ đúng
-- giá trị tại thời điểm đó.
UPDATE "leads"
SET "status" = 'CONTACTING'
WHERE "status" IN ('NEW', 'APPOINTED', 'TESTED', 'UNQUALIFIED');
