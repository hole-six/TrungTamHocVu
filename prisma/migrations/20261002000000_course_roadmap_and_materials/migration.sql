-- KHÓA HỌC THÀNH KHO DÙNG CHUNG (chốt 10/2026).
--
-- Trước đây tiến trình gắn cứng vào TỪNG LỚP, nên mở lớp UP1B là phải soạn/tải lên lại
-- y hệt lớp UP1A; tài liệu thì mỗi khóa chỉ có đúng MỘT ô link. Từ nay tiến trình và
-- tài liệu soạn một lần ở khóa, mọi lớp cùng khóa dùng chung.
--
-- Dữ liệu cũ KHÔNG đổi: lớp đang có tiến trình riêng vẫn giữ nguyên tiến trình đó
-- (ClassRoadmapItem trở thành bản ghi đè), nên không lớp nào thay đổi nội dung sau
-- khi nâng cấp.
CREATE TABLE "course_roadmap_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "objective" TEXT,
    "materials" TEXT,
    "teacher_guide" TEXT,
    "homework_guide" TEXT,
    "teacher_requirement" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_roadmap_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "course_roadmap_items_course_id_session_number_key" ON "course_roadmap_items"("course_id", "session_number");
CREATE INDEX "course_roadmap_items_course_id_session_number_idx" ON "course_roadmap_items"("course_id", "session_number");

-- Tài liệu của khóa: file tải lên HOẶC link dán vào, gắn cho cả khóa hoặc đúng một buổi.
CREATE TABLE "course_materials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "session_number" INTEGER,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "file_path" TEXT,
    "file_name" TEXT,
    "size_bytes" INTEGER,
    "content_type" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_materials_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "course_materials_course_id_session_number_idx" ON "course_materials"("course_id", "session_number");

-- Link tài liệu chung cũ (Course.materials_link) chuyển thành một dòng tài liệu dạng
-- LINK để không mất, và từ nay mọi tài liệu nằm chung một chỗ.
INSERT INTO "course_materials" ("id", "course_id", "session_number", "kind", "title", "url", "created_at")
SELECT lower(hex(randomblob(16))), "id", NULL, 'LINK', 'Tài liệu chung của khóa', "materials_link", CURRENT_TIMESTAMP
FROM "courses"
WHERE "materials_link" IS NOT NULL AND trim("materials_link") <> '';
