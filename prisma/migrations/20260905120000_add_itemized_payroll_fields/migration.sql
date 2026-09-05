-- AlterTable
ALTER TABLE "payroll_lines" ADD COLUMN "ot_hours" REAL NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "ot_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "kpi_bonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "assistant_rating_bonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "parking_allowance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "support_allowance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "social_insurance_deduction" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "utility_deduction" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "holiday_bonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_lines" ADD COLUMN "other_deduction" INTEGER NOT NULL DEFAULT 0;
