-- MỘT NHÂN SỰ LÀM Ở NHIỀU CƠ SỞ (chốt 9/2026).
-- Trước đây mỗi nhân sự chỉ có đúng 1 cơ sở (employees.branch_id), nên người chạy
-- giữa các cơ sở không xuất hiện được ở danh sách nhân sự của cơ sở kia. Từ nay
-- branch_id là CƠ SỞ CHÍNH (giữ hồ sơ), còn bảng dưới đây là danh sách đầy đủ.
-- Số liệu/lương VẪN tính riêng từng cơ sở — bảng này không gộp gì cả.
CREATE TABLE "employee_branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_branches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "employee_branches_employee_id_branch_id_key" ON "employee_branches"("employee_id", "branch_id");
CREATE INDEX "employee_branches_branch_id_idx" ON "employee_branches"("branch_id");

-- Dữ liệu cũ: ai đang ở cơ sở nào thì gắn đúng cơ sở đó, không đổi hành vi hiện tại.
INSERT INTO "employee_branches" ("id", "employee_id", "branch_id", "created_at")
SELECT lower(hex(randomblob(16))), "id", "branch_id", CURRENT_TIMESTAMP FROM "employees";

-- NGÀY CÔNG THUỘC CƠ SỞ NÀO. Bắt buộc khi 1 người gắn nhiều cơ sở: nếu không ghi,
-- mọi cơ sở của người đó đều cộng cùng một ngày công → trả lương hai lần.
ALTER TABLE "timesheet_entries" ADD COLUMN "branch_id" TEXT REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "timesheet_entries_branch_id_idx" ON "timesheet_entries"("branch_id");

-- Ngày công cũ: quy về cơ sở chính của người đó (đúng cách bảng lương đang tính).
UPDATE "timesheet_entries"
SET "branch_id" = (SELECT "branch_id" FROM "employees" WHERE "employees"."id" = "timesheet_entries"."employee_id")
WHERE "branch_id" IS NULL;
