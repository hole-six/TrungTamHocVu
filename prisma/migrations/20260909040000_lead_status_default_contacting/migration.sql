-- Hai việc, cùng một nguyên nhân gốc: leads.status từng nhận giá trị hệ thống KHÔNG hiểu.
--
-- 1) Mặc định của cột đang là 'NEW' — một trạng thái đã bị bỏ từ migration
--    20260905163936_simplify_lead_statuses (nguồn sự thật: LEAD_STATUSES trong
--    lib/server/lead-rules.ts chỉ còn CONTACTING/QUALIFIED/ENROLLED/LOST). Bất kỳ luồng
--    tạo lead nào quên set status đều đẻ ra lead hỏng: ô chọn trạng thái ở /leads có
--    value không khớp option nào, trình duyệt hiện option đầu tiên, nhân viên bấm đúng
--    cái đang hiện thì KHÔNG có sự kiện change nào bắn ra — tưởng hệ thống treo.
--    Đổi mặc định về 'CONTACTING' (trạng thái đầu vòng đời thật).
--
-- 2) Chuẩn hóa lại dữ liệu đang có, đúng bảng ánh xạ của migration trước đó
--    (NEW/APPOINTED/TESTED/UNQUALIFIED -> CONTACTING) vì đợt seed lại dữ liệu demo
--    ngày 2026-09-08 đã vô tình ghi lại các giá trị cũ này.
--    Lịch sử đổi trạng thái cố tình KHÔNG sửa — lịch sử phải giữ đúng giá trị lúc đó.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "lead_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATETIME,
    "current_school_grade" TEXT,
    "guardian_id" TEXT,
    "phone" TEXT,
    "secondary_phone" TEXT,
    "zalo_contact" TEXT,
    "address" TEXT,
    "meet_date" DATETIME,
    "interested_class_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONTACTING',
    "expected_start_date" DATETIME,
    "actual_enroll_date" DATETIME,
    "source" TEXT,
    "facebook_parent_name" TEXT,
    "facebook_link" TEXT,
    "initial_assessment" TEXT,
    "pending_remedial_sessions" INTEGER,
    "notes" TEXT,
    "notes_2" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_interested_class_id_fkey" FOREIGN KEY ("interested_class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_leads" ("actual_enroll_date", "address", "branch_id", "created_at", "current_school_grade", "dob", "expected_start_date", "facebook_link", "facebook_parent_name", "full_name", "gender", "guardian_id", "id", "initial_assessment", "interested_class_id", "lead_code", "meet_date", "notes", "notes_2", "pending_remedial_sessions", "phone", "secondary_phone", "source", "status", "updated_at", "zalo_contact") SELECT "actual_enroll_date", "address", "branch_id", "created_at", "current_school_grade", "dob", "expected_start_date", "facebook_link", "facebook_parent_name", "full_name", "gender", "guardian_id", "id", "initial_assessment", "interested_class_id", "lead_code", "meet_date", "notes", "notes_2", "pending_remedial_sessions", "phone", "secondary_phone", "source", "status", "updated_at", "zalo_contact" FROM "leads";
DROP TABLE "leads";
ALTER TABLE "new_leads" RENAME TO "leads";
CREATE UNIQUE INDEX "leads_lead_code_key" ON "leads"("lead_code");
CREATE INDEX "leads_status_idx" ON "leads"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Chuẩn hóa dữ liệu còn sót giá trị cũ (xem ghi chú 2 ở đầu file).
UPDATE "leads"
SET "status" = 'CONTACTING'
WHERE "status" IN ('NEW', 'APPOINTED', 'TESTED', 'UNQUALIFIED');
