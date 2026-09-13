// Tạo tháng lương + tính PayrollLine — tách riêng khỏi payroll-rules.ts (file đó có
// vài hàm/label thuần được client component import trực tiếp; thêm import prisma
// vào đó sẽ kéo Prisma Client vào bundle trình duyệt). File này chỉ được gọi từ
// route handler và scheduler (server-only).
import { prisma } from "@/lib/prisma";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { monthRange } from "@/lib/server/tuition-rules";

export async function ensurePayrollRun(branchId: string, periodName: string) {
  const existing = await prisma.payrollRun.findUnique({
    where: { branchId_periodName: { branchId, periodName } },
  });
  if (existing) return existing;

  return prisma.payrollRun.create({ data: { branchId, periodName } });
}

// Tổng hợp lương từ SessionAssignment (giờ dạy/trợ giảng theo buổi, đã snapshot
// hourlyRate lúc phân công) + TimesheetEntry (ngày công chấm theo giờ hành chính)
// trong khoảng ngày của tháng lương — nguồn Report_Cong_Luong. Logic giống hệt route
// payroll-runs/[id]/generate (đã kiểm chứng idempotent nhiều lần) — tách ra để
// route thủ công và scheduler tự động dùng chung 1 chỗ tính duy nhất.
export async function generatePayrollForRun(runId: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  // `code` là thứ nơi gọi dựa vào để chọn HTTP status — trước đây route /generate so
  // sánh THẲNG chuỗi tiếng Việt của message ("Không tìm thấy tháng lương") để chọn
  // 404 hay 409, nên chỉ cần sửa lại câu chữ là mọi lỗi 404 âm thầm thành 409.
  if (!run) return { error: "Không tìm thấy tháng lương" as const, code: "NOT_FOUND" as const };
  if (!canEditPayroll(run.status)) {
    return {
      error: `Tháng lương đang ở trạng thái "${run.status}", không thể tính lại.` as const,
      code: "NOT_EDITABLE" as const,
    };
  }

  const { start, end } = monthRange(run.periodName);
  const employees = await prisma.employee.findMany({ where: { branchId: run.branchId } });

  let created = 0;
  let updated = 0;
  // Cảnh báo cấu hình thiếu: có công thật nhưng không có đơn giá nên ra 0đ. Trước đây
  // trường hợp này im lặng — nhân sự chấm công đủ cả tháng, bảng lương vẫn hiện 0đ mà
  // không ai biết vì sao, phải tự dò từng hồ sơ nhân viên.
  // Kèm employeeId để giao diện mở thẳng hồ sơ người đó — cảnh báo chỉ là chữ thì
  // nhân sự vẫn phải tự đi tìm đúng người trong danh sách rồi mới sửa được.
  const warnings: { employeeId: string; employeeName: string; message: string }[] = [];

  for (const employee of employees) {
    const [teachingAssignments, assistantAssignments, timesheetEntries, monthlyBonus] = await Promise.all([
      prisma.sessionAssignment.findMany({
        where: {
          employeeId: employee.id,
          role: "TEACHER",
          session: {
            sessionDate: { gte: start, lte: end },
            status: "COMPLETED",
            class: { branchId: run.branchId },
          },
        },
      }),
      prisma.sessionAssignment.findMany({
        where: {
          employeeId: employee.id,
          role: { in: ["ASSISTANT", "ASSISTANT2"] },
          session: {
            sessionDate: { gte: start, lte: end },
            status: "COMPLETED",
            class: { branchId: run.branchId },
          },
        },
      }),
      prisma.timesheetEntry.findMany({ where: { employeeId: employee.id, workDate: { gte: start, lte: end } } }),
      // % đánh giá TG hàng tháng theo cơ sở (AssistantScoreForm) — nhân với đúng thu
      // nhập TG kỳ này để tự ra số tiền, thay vì bắt nhân sự tự quy đổi % ra VNĐ rồi
      // gõ tay vào ô "Thưởng" chung như trước (đúng dòng "Đánh giá TG (%/VNĐ)" trên
      // phiếu lương thật).
      prisma.assistantMonthlyBonus.findUnique({
        where: { employeeId_branchId_month: { employeeId: employee.id, branchId: run.branchId, month: run.periodName } },
      }),
    ]);

    const teachingHours = teachingAssignments.reduce((s, a) => s + (a.hours ?? 0), 0);
    const teachingAmount = teachingAssignments.reduce((s, a) => s + (a.amount ?? 0), 0);
    const assistantHours = assistantAssignments.reduce((s, a) => s + (a.hours ?? 0), 0);
    const assistantAmount = assistantAssignments.reduce((s, a) => s + (a.amount ?? 0), 0);
    const staffDays = timesheetEntries.reduce((s, t) => s + (t.days ?? 0), 0);
    const baseSalaryAmount = Math.round(staffDays * (employee.staffDailyRate ?? 0));
    if (staffDays > 0 && !employee.staffDailyRate) {
      warnings.push({ employeeId: employee.id, employeeName: employee.fullName, message: `có ${staffDays} ngày công nhưng chưa cấu hình đơn giá ngày công — lương hành chính đang tính 0đ.` });
    }
    if (teachingAssignments.length > 0 && teachingAmount === 0) {
      warnings.push({ employeeId: employee.id, employeeName: employee.fullName, message: `có ${teachingAssignments.length} buổi dạy nhưng thành tiền 0đ — kiểm tra đơn giá đứng lớp trong hồ sơ nhân sự.` });
    }
    if (assistantAssignments.length > 0 && assistantAmount === 0) {
      warnings.push({ employeeId: employee.id, employeeName: employee.fullName, message: `có ${assistantAssignments.length} buổi trợ giảng nhưng thành tiền 0đ — kiểm tra đơn giá trợ giảng trong hồ sơ nhân sự.` });
    }
    const assistantRatingBonus = Math.round(assistantAmount * (monthlyBonus?.bonusPercent ?? 0));

    const existingLine = await prisma.payrollLine.findUnique({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
    });

    const hasSourceData = teachingAssignments.length > 0 || assistantAssignments.length > 0 || timesheetEntries.length > 0;
    if (!hasSourceData && !existingLine) continue;

    // Các khoản nhập tay (otHours/otAmount/kpiBonus/parkingAllowance/supportAllowance/
    // bonus/penalty/socialInsuranceDeduction/utilityDeduction/holidayBonus/otherDeduction)
    // giữ nguyên khi tính lại — chỉ assistantRatingBonus tự tính lại vì nó suy ra từ dữ
    // liệu (assistantAmount kỳ này), không phải do nhân sự tự gõ. Công thức tổng đúng
    // theo phiếu lương thật: xem ghi chú trên PayrollLine trong schema.prisma.
    const manual = {
      otHours: existingLine?.otHours ?? 0,
      otAmount: existingLine?.otAmount ?? 0,
      kpiBonus: existingLine?.kpiBonus ?? 0,
      parkingAllowance: existingLine?.parkingAllowance ?? 0,
      supportAllowance: existingLine?.supportAllowance ?? 0,
      bonus: existingLine?.bonus ?? 0,
      penalty: existingLine?.penalty ?? 0,
      socialInsuranceDeduction: existingLine?.socialInsuranceDeduction ?? 0,
      utilityDeduction: existingLine?.utilityDeduction ?? 0,
      holidayBonus: existingLine?.holidayBonus ?? 0,
      otherDeduction: existingLine?.otherDeduction ?? 0,
    };

    const totalAmount =
      teachingAmount +
      assistantAmount +
      baseSalaryAmount +
      manual.otAmount +
      manual.kpiBonus +
      assistantRatingBonus +
      manual.parkingAllowance +
      manual.supportAllowance +
      manual.bonus -
      manual.penalty -
      manual.socialInsuranceDeduction -
      manual.utilityDeduction +
      manual.holidayBonus -
      manual.otherDeduction;

    if (existingLine) {
      await prisma.payrollLine.update({
        where: { id: existingLine.id },
        data: {
          teachingHours,
          teachingAmount,
          assistantHours,
          assistantAmount,
          staffDays,
          baseSalaryAmount,
          assistantRatingBonus,
          totalAmount,
        },
      });
      updated++;
    } else {
      await prisma.payrollLine.create({
        data: {
          payrollRunId: run.id,
          employeeId: employee.id,
          teachingHours,
          teachingAmount,
          assistantHours,
          assistantAmount,
          staffDays,
          baseSalaryAmount,
          assistantRatingBonus,
          totalAmount,
        },
      });
      created++;
    }
  }

  // REOPENED xử lý giống hệt DRAFT ở đây — bấm "Tính lại lương" tự đưa tháng lương quay
  // về CALCULATED để đi lại đúng chuỗi bước REVIEWED→APPROVED→LOCKED→PAID bình thường.
  if (run.status === "DRAFT" || run.status === "REOPENED") {
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: "CALCULATED", calculatedAt: new Date() } });
  }

  return { created, updated, totalEmployees: employees.length, warnings };
}

/**
 * Đảm bảo 1 nhân sự có sẵn dòng lương của tháng để ghi các khoản cộng/trừ nhập tay,
 * và làm mới số công/tiền gốc của dòng đó theo dữ liệu thật.
 *
 * Mục đích: sửa thưởng/phạt cho 1 người KHÔNG còn phải đi qua "tạo tháng lương → tính
 * lương → duyệt". Bảng lương hiển thị công/tiền tính thẳng từ buổi dạy, trợ giảng và
 * chấm công, còn PayrollRun/PayrollLine chỉ còn đóng vai trò chỗ lưu các khoản nhập
 * tay — tạo ngầm ngay lúc người dùng bấm lưu điều chỉnh.
 */
export async function ensurePayrollLineForEmployee(employeeId: string, periodName: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "Không tìm thấy nhân sự" as const, code: "NOT_FOUND" as const };

  const run = await ensurePayrollRun(employee.branchId, periodName);
  const { start, end } = monthRange(periodName);

  const [teachingAssignments, assistantAssignments, timesheetEntries, monthlyBonus, existingLine] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: { employeeId, role: "TEACHER", session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" } },
    }),
    prisma.sessionAssignment.findMany({
      where: { employeeId, role: { in: ["ASSISTANT", "ASSISTANT2"] }, session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" } },
    }),
    prisma.timesheetEntry.findMany({ where: { employeeId, workDate: { gte: start, lte: end } } }),
    prisma.assistantMonthlyBonus.findUnique({
      where: { employeeId_branchId_month: { employeeId, branchId: employee.branchId, month: periodName } },
    }),
    prisma.payrollLine.findUnique({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId } } }),
  ]);

  const teachingHours = teachingAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0);
  const teachingAmount = teachingAssignments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const assistantHours = assistantAssignments.reduce((sum, item) => sum + (item.hours ?? 0), 0);
  const assistantAmount = assistantAssignments.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const staffDays = timesheetEntries.reduce((sum, item) => sum + (item.days ?? 0), 0);
  const baseSalaryAmount = Math.round(staffDays * (employee.staffDailyRate ?? 0));
  const assistantRatingBonus = Math.round(assistantAmount * (monthlyBonus?.bonusPercent ?? 0));

  const manualAdd =
    (existingLine?.otAmount ?? 0) +
    (existingLine?.kpiBonus ?? 0) +
    (existingLine?.parkingAllowance ?? 0) +
    (existingLine?.supportAllowance ?? 0) +
    (existingLine?.bonus ?? 0) +
    (existingLine?.holidayBonus ?? 0);
  const manualDeduct =
    (existingLine?.penalty ?? 0) +
    (existingLine?.socialInsuranceDeduction ?? 0) +
    (existingLine?.utilityDeduction ?? 0) +
    (existingLine?.otherDeduction ?? 0);

  const data = {
    teachingHours,
    teachingAmount,
    assistantHours,
    assistantAmount,
    staffDays,
    baseSalaryAmount,
    assistantRatingBonus,
    totalAmount: teachingAmount + assistantAmount + baseSalaryAmount + assistantRatingBonus + manualAdd - manualDeduct,
  };

  const line = existingLine
    ? await prisma.payrollLine.update({ where: { id: existingLine.id }, data })
    : await prisma.payrollLine.create({ data: { ...data, payrollRunId: run.id, employeeId } });

  return { line, branchId: employee.branchId };
}
