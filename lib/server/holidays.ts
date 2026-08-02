import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/server/class-rules";

// Tập ngày lễ (khóa "YYYY-MM-DD") của 1 chi nhánh, dùng để bỏ qua khi sinh
// ClassSession (generateSessionDates) và ước lượng ngày kết thúc dự kiến
// (estimateEndDateFromRules). Không lọc theo khoảng ngày ở query — số lượng Holiday
// dự kiến nhỏ (vài chục ngày lễ/năm), lấy hết theo branch cho đơn giản và tránh bug
// lệch range khi gọi từ nhiều nơi khác nhau.
export async function getHolidayDateSet(branchId: string): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({ where: { branchId }, select: { date: true } });
  return new Set(holidays.map((h) => dateKey(h.date)));
}
