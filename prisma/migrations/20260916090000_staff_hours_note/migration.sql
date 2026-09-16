-- Định mức giờ/tháng theo hợp đồng (để trống = không đặt định mức).
ALTER TABLE "employees" ADD COLUMN "contract_hours_per_month" REAL;

-- Ghi chú giải trình chênh lệch giờ dự kiến / giờ thực tế theo tuần hoặc tháng.
CREATE TABLE "staff_hours_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "staff_hours_notes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_hours_notes_employee_id_period_key_key" ON "staff_hours_notes"("employee_id", "period_key");
