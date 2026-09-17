-- SÁCH THU THEO KỲ HỌC PHÍ ĐÃ ĐÓNG NHƯNG SỔ KHO VẪN BÁO "CHƯA THANH TOÁN".
-- Phiếu xuất giáo trình gắn vào phiếu học phí (charge_id) luôn được tạo với trạng thái
-- UNPAID và trước đây không có chỗ nào cập nhật lại khi phụ huynh đóng học phí. Từ nay
-- lib/server/book-issue-payment.ts đồng bộ tự động; câu lệnh dưới sửa dữ liệu cũ.
--
-- Đã thu = phiếu học phí đã trả đủ phần nợ của CHÍNH NÓ (học phí + tiền giáo trình,
-- không tính nợ kỳ trước mang sang), tính trên các phiếu thu chưa bị hủy/hoàn.
UPDATE "book_issues"
SET "payment_status" = 'PAID'
WHERE "charge_id" IS NOT NULL
  AND "payment_status" <> 'PAID'
  AND EXISTS (
    SELECT 1
    FROM "charges" c
    WHERE c."id" = "book_issues"."charge_id"
      AND (c."tuition_amount" + c."materials_amount") > 0
      AND (c."tuition_amount" + c."materials_amount") <= (
        SELECT COALESCE(SUM(pa."amount"), 0)
        FROM "payment_allocations" pa
        JOIN "payments" p ON p."id" = pa."payment_id"
        WHERE pa."charge_id" = c."id" AND p."status" NOT IN ('VOIDED', 'REFUNDED')
      )
  );
