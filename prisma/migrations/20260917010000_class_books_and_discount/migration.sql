-- Chiết khấu áp cho CẢ LỚP (%) — mọi học viên ghi danh vào lớp lấy mức này làm mặc định.
ALTER TABLE "classes" ADD COLUMN "discount_percent" REAL NOT NULL DEFAULT 0;

-- Sách kèm theo của LỚP (không bắt buộc). Khác bộ sách chuẩn của khóa
-- (course_book_requirements) ở chỗ: gắn đúng cho lớp đang mở, gỡ ra được.
CREATE TABLE "class_book_requirements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "class_id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "class_book_requirements_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_book_requirements_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "class_book_requirements_class_id_book_id_key" ON "class_book_requirements"("class_id", "book_id");
CREATE INDEX "class_book_requirements_book_id_idx" ON "class_book_requirements"("book_id");
