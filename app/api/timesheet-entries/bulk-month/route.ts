import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { canAccessBranch, getCurrentBranchId } from "@/lib/branch-filter";
import { computeHoursFromTimeRange } from "@/lib/server/payroll-rules";
import { ensureTimesheetPeriodForEntry } from "@/lib/server/database-sync";
import { getHolidayDateSet } from "@/lib/server/holidays";
import { monthRange } from "@/lib/server/tuition-rules";

// Chấm công CẢ THÁNG theo ca chuẩn, cho nhiều nhân sự cùng lúc.
//
// Vì sao cần: trước đây chấm công là 1 nhân viên × 1 ngày × 4 ô giờ. Một cơ sở 7 nhân
// sự hành chính × ~22 ngày công = ~154 lần điền form mỗi tháng, và nếu quên thì tháng
// lương của người đó KHÔNG có dòng nào (generatePayrollForRun chỉ cộng từ TimesheetEntry
// có thật) — tức là quên chấm công = quên trả lương, không có cảnh báo gì.
//
// Cách làm đúng: chấm theo NGOẠI LỆ. Bấm 1 nút điền sẵn toàn bộ ngày công theo ca chuẩn,
// sau đó nhân sự chỉ sửa lại những ngày bất thường (nghỉ, đi muộn, nửa buổi).
//
// Nguyên tắc an toàn:
//   - MẶC ĐỊNH KHÔNG ĐÈ ngày đã có dữ liệu (giữ nguyên các ngày đã sửa tay).
//   - Bỏ qua ngày lễ đã khai báo của cơ sở (bảng Holiday) — cùng nguồn với sinh lịch học.
//   - Không chấm cho ngày trong tương lai.
//   - Không đụng vào kỳ công đã KHÓA/ĐÃ DUYỆT.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canCreate("timesheet", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền chấm công." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const month = String(body.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Tháng không hợp lệ (định dạng YYYY-MM)." }, { status: 400 });
  }

  // getCurrentBranchId() trả null khi tài khoản có quyền xem TẤT CẢ cơ sở và chưa chọn
  // cơ sở nào. Chấm công thì luôn phải thuộc đúng 1 cơ sở (ngày lễ và kỳ công đều theo
  // cơ sở), nên lấy tiếp cơ sở của chính người đang thao tác trước khi báo lỗi.
  const ownBranchId = (await prisma.user.findUnique({ where: { id: user.id }, select: { branchId: true } }))?.branchId ?? null;
  const branchId = String(body.branchId ?? "").trim() || (await getCurrentBranchId()) || ownBranchId;
  if (!branchId) {
    return NextResponse.json(
      { error: "Chưa xác định được cơ sở để chấm công — chọn cơ sở ở thanh trên rồi thử lại." },
      { status: 400 },
    );
  }
  if (!(await canAccessBranch(branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở này." }, { status: 403 });
  }

  const period = await prisma.timesheetPeriod.findUnique({
    where: { branchId_periodName: { branchId, periodName: month } },
  });
  if (period && (period.status === "LOCKED" || period.status === "APPROVED")) {
    return NextResponse.json(
      { error: `Kỳ công tháng ${month} đang ở trạng thái "${period.status}" — cần mở lại kỳ trước khi chấm thêm.` },
      { status: 409 },
    );
  }

  const checkInAm = String(body.checkInAm ?? "08:00");
  const checkOutAm = String(body.checkOutAm ?? "12:00");
  const checkInPm = String(body.checkInPm ?? "13:00");
  const checkOutPm = String(body.checkOutPm ?? "17:00");
  const hours =
    (checkInAm && checkOutAm ? computeHoursFromTimeRange(checkInAm, checkOutAm) : 0) +
    (checkInPm && checkOutPm ? computeHoursFromTimeRange(checkInPm, checkOutPm) : 0);
  if (hours <= 0) {
    return NextResponse.json({ error: "Ca chuẩn không hợp lệ — tổng giờ đang bằng 0." }, { status: 400 });
  }
  const days = Math.round((hours / 8) * 100) / 100;

  // 0=CN .. 6=T7, mặc định T2–T7 (nghỉ Chủ nhật) — cùng quy ước weekday với ScheduleRule.
  const weekdays: number[] = Array.isArray(body.weekdays) && body.weekdays.length > 0
    ? body.weekdays.map((item: unknown) => Number(item)).filter((item: number) => Number.isInteger(item) && item >= 0 && item <= 6)
    : [1, 2, 3, 4, 5, 6];
  const overwrite = body.overwrite === true;

  const requestedIds: string[] = Array.isArray(body.employeeIds) ? body.employeeIds.map((item: unknown) => String(item)) : [];
  const employees = await prisma.employee.findMany({
    where: {
      branchId,
      workStatus: "ACTIVE",
      ...(requestedIds.length > 0
        ? { id: { in: requestedIds } }
        : // Không chọn ai = chấm cho toàn bộ nhân sự hưởng lương THÁNG (hành chính/văn
          // phòng). Giáo viên/trợ giảng hưởng lương theo giờ dạy lấy từ buổi học đã phân
          // công, không đi qua bảng chấm công ngày.
          { payMode: "MONTHLY" }),
    },
    select: { id: true, fullName: true },
  });
  if (employees.length === 0) {
    return NextResponse.json({ error: "Không có nhân sự nào phù hợp để chấm công." }, { status: 400 });
  }

  const { start, end } = monthRange(month);
  const holidayDates = await getHolidayDateSet(branchId);
  const today = new Date();

  const workDates: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = new Date(cursor);
    if (day > today) break;
    if (!weekdays.includes(day.getUTCDay())) continue;
    if (holidayDates.has(day.toISOString().slice(0, 10))) continue;
    workDates.push(day);
  }
  if (workDates.length === 0) {
    return NextResponse.json({ error: "Không có ngày công nào trong khoảng đã chọn." }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const employee of employees) {
    const existingEntries = await prisma.timesheetEntry.findMany({
      where: { employeeId: employee.id, workDate: { gte: start, lte: end } },
      select: { id: true, workDate: true },
    });
    const existingByDate = new Map(existingEntries.map((entry) => [entry.workDate.toISOString().slice(0, 10), entry.id]));

    for (const workDate of workDates) {
      const key = workDate.toISOString().slice(0, 10);
      const existingId = existingByDate.get(key);
      if (existingId && !overwrite) {
        skipped += 1;
        continue;
      }

      const periodId = await ensureTimesheetPeriodForEntry(employee.id, workDate);
      const data = { checkInAm, checkOutAm, checkInPm, checkOutPm, hours, days, periodId };

      if (existingId) {
        await prisma.timesheetEntry.update({ where: { id: existingId }, data });
        updated += 1;
      } else {
        await prisma.timesheetEntry.create({ data: { ...data, employeeId: employee.id, workDate } });
        created += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    month,
    employeeCount: employees.length,
    workDayCount: workDates.length,
    created,
    updated,
    skipped,
    message: `Đã chấm công tháng ${month} cho ${employees.length} nhân sự: tạo mới ${created} ngày, cập nhật ${updated}, giữ nguyên ${skipped} ngày đã có.`,
  });
}
