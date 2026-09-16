-- Quy chế thưởng phạt trợ giảng: 1 nội dung bị nhắc ở cả 3 báo cáo (ngày, tuần, tháng)
-- thì tháng đó mặc định -10% lương.
ALTER TABLE "assistant_score_events" ADD COLUMN "triple_reported" BOOLEAN NOT NULL DEFAULT false;

-- Mức thưởng/phạt tháng GỘP TOÀN BỘ CƠ SỞ (thay cho bảng tách theo từng cơ sở).
CREATE TABLE "employee_monthly_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "bonus_percent" REAL NOT NULL,
    "notes" TEXT,
    "decided_by_id" TEXT,
    "decided_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_monthly_ratings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "employee_monthly_ratings_employee_id_month_key" ON "employee_monthly_ratings"("employee_id", "month");

-- Chuyển dữ liệu cũ: mỗi người mỗi tháng lấy mức cao nhất đã chốt ở các cơ sở.
INSERT INTO "employee_monthly_ratings" ("id", "employee_id", "month", "bonus_percent", "notes", "decided_by_id", "decided_at")
SELECT
    "employee_id" || '-' || "month",
    "employee_id",
    "month",
    MAX("bonus_percent"),
    'Chuyển từ mức thưởng theo cơ sở khi gộp toàn hệ thống',
    MAX("decided_by_id"),
    MAX("decided_at")
FROM "assistant_monthly_bonuses"
GROUP BY "employee_id", "month";

DROP TABLE "assistant_monthly_bonuses";
