-- Hai cột để PHIẾU BÁO HỌC PHÍ tự giải thích được con số, đúng mẫu giấy trung tâm đang
-- phát cho phụ huynh: "Tổng số buổi tháng 7" trừ "Số buổi nghỉ tháng 6" ra đúng số buổi
-- thu tiền. Trước đây chỉ lưu session_count (số buổi THU) nên phiếu in "Tổng số buổi
-- tháng 8 = 1" trong khi lớp dạy 4 buổi — phụ huynh không có cách nào tự kiểm lại.
--
-- Dùng ADD COLUMN thay vì dựng lại bảng (kiểu prisma migrate diff sinh ra): thêm cột số
-- có giá trị mặc định không cần chép lại toàn bộ dữ liệu, nên an toàn hơn hẳn khi chạy
-- trên CSDL production đang có phiếu học phí thật.
--
-- Phiếu CŨ giữ giá trị 0 ở cả hai cột; bản in có đường lui: thấy 0 thì in như trước.
ALTER TABLE "charges" ADD COLUMN "scheduled_session_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "charges" ADD COLUMN "carried_session_count" INTEGER NOT NULL DEFAULT 0;
