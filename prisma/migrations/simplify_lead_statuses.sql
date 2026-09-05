-- Migration: Simplify Lead Statuses
-- Đơn giản hóa trạng thái CRM lead theo yêu cầu người dùng

-- Map old statuses to new simplified statuses:
-- NEW, APPOINTED, TESTED → CONTACTING (Đã liên hệ)
-- UNQUALIFIED → CONTACTING (Chưa đạt chuyển về đã liên hệ để tư vấn lại)
-- QUALIFIED → QUALIFIED (Đạt - giữ nguyên)
-- ENROLLED → ENROLLED (Đã ghi danh - giữ nguyên)
-- LOST → LOST (Không có nhu cầu - giữ nguyên)

UPDATE "Lead"
SET "status" = 'CONTACTING'
WHERE "status" IN ('NEW', 'APPOINTED', 'TESTED', 'UNQUALIFIED');

-- QUALIFIED, ENROLLED, LOST giữ nguyên (không cần update)

-- Ghi log kết quả
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Simplified % lead statuses', updated_count;
END $$;
