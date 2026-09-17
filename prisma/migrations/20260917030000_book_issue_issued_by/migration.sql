-- NGƯỜI THỰC HIỆN xuất sách. Mỗi nhân sự một tài khoản nên phải truy được ai đã phát
-- cuốn nào — trước đây phiếu xuất giáo trình không lưu người thực hiện.
ALTER TABLE "book_issues" ADD COLUMN "issued_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "book_issues_issued_by_id_idx" ON "book_issues"("issued_by_id");
