-- Trạng thái CHI TIẾT của lead bên trong mỗi nhóm (danh sách ở LEAD_SUB_STATUS,
-- lib/server/lead-rules.ts). Nhóm vẫn nằm ở cột "status" như cũ:
--   CONTACTING = Chưa test  → APPOINTED | UNREACHABLE
--   QUALIFIED  = Đã test    → SCHEDULE_CONFLICT | WAITING_CLASS | CLASS_ASSIGNED
--   ENROLLED / LOST         → không có trạng thái chi tiết.
ALTER TABLE "leads" ADD COLUMN "sub_status" TEXT;

-- Suy trạng thái chi tiết cho dữ liệu cũ để bảng lọc có số ngay, không bắt nhân sự
-- nhập lại từ đầu: đã có lịch hẹn test = "đã hẹn, chưa test", còn lại = "chưa liên hệ được".
UPDATE "leads"
SET "sub_status" = 'APPOINTED'
WHERE "status" = 'CONTACTING'
  AND EXISTS (SELECT 1 FROM "placement_tests" pt WHERE pt."lead_id" = "leads"."id" AND pt."status" = 'SCHEDULED');

UPDATE "leads" SET "sub_status" = 'UNREACHABLE' WHERE "status" = 'CONTACTING' AND "sub_status" IS NULL;

-- Đã test xong: có lớp quan tâm coi như đã xếp lớp, chưa có thì đang đợi lớp mới.
UPDATE "leads" SET "sub_status" = 'CLASS_ASSIGNED' WHERE "status" = 'QUALIFIED' AND "interested_class_id" IS NOT NULL;
UPDATE "leads" SET "sub_status" = 'WAITING_CLASS' WHERE "status" = 'QUALIFIED' AND "sub_status" IS NULL;
