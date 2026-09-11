-- Bảo lưu (tạm nghỉ có thời hạn): lưu thành KHOẢNG để danh sách điểm danh của những
-- buổi đã diễn ra trong kỳ nghỉ vẫn đúng vĩnh viễn, kể cả sau khi học viên đi học lại.
-- Xem ghi chú trên model Enrollment trong prisma/schema.prisma.
ALTER TABLE "enrollments" ADD COLUMN "paused_from" DATETIME;
ALTER TABLE "enrollments" ADD COLUMN "paused_to" DATETIME;
