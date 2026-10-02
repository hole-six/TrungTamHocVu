-- CẢNH BÁO CHUYÊN MÔN trên từng buổi của tiến trình.
--
-- Có những buổi ÉP giáo viên phải làm một việc cụ thể (quay video bài tập, trả kết quả
-- đúng hạn, tổ chức Presentation/Speaking Test). Trước đây không có chỗ khai nên tới
-- ngày mới nhớ ra, và không ai biết rốt cuộc giáo viên có làm hay không.
--
-- NONE = không cảnh báo | YELLOW = cần lưu ý | RED = bắt buộc, có hạn.
-- Nội dung việc cần làm dùng lại cột teacher_requirement đã có, nên bật cảnh báo trước
-- rồi điền nội dung sau cũng được.
ALTER TABLE "course_roadmap_items" ADD COLUMN "alert_level" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "class_roadmap_items" ADD COLUMN "alert_level" TEXT NOT NULL DEFAULT 'NONE';
