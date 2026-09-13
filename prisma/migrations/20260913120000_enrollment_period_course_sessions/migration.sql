-- Số buổi của khóa cho ghi danh đóng theo tháng (xem Enrollment.periodCourseSessionCount).
ALTER TABLE "enrollments" ADD COLUMN "period_course_session_count" INTEGER;
