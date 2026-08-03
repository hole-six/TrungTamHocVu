import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";

function isClose(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

export async function evaluatePayrollRunChecklist(runId: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: { lines: { include: { employee: true } } },
  });
  if (!run) return null;

  const { start, end } = monthRange(run.periodName);
  const employeeIds = run.lines.map((line) => line.employeeId);
  const [allAssignments, allTimesheetEntries] = await Promise.all([
    prisma.sessionAssignment.findMany({
      where: { employeeId: { in: employeeIds }, session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" } },
      select: { employeeId: true, role: true, hours: true },
    }),
    prisma.timesheetEntry.findMany({
      where: { employeeId: { in: employeeIds }, workDate: { gte: start, lte: end } },
      select: { employeeId: true, days: true },
    }),
  ]);

  const hasMismatch = run.lines.some((line) => {
    const employeeAssignments = allAssignments.filter((assignment) => assignment.employeeId === line.employeeId);
    const liveTeachingHours = employeeAssignments
      .filter((assignment) => assignment.role === "TEACHER")
      .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
    const liveAssistantHours = employeeAssignments
      .filter((assignment) => assignment.role === "ASSISTANT" || assignment.role === "ASSISTANT2")
      .reduce((sum, assignment) => sum + (assignment.hours ?? 0), 0);
    const liveStaffDays = allTimesheetEntries
      .filter((entry) => entry.employeeId === line.employeeId)
      .reduce((sum, entry) => sum + (entry.days ?? 0), 0);

    return (
      !isClose(liveTeachingHours, line.teachingHours) ||
      !isClose(liveAssistantHours, line.assistantHours) ||
      !isClose(liveStaffDays, line.staffDays)
    );
  });

  const items = [
    {
      key: "has_lines",
      label: "Đã có nhân sự trong kỳ lương",
      done: run.lines.length > 0,
      help: run.lines.length > 0 ? `${run.lines.length} nhân sự đã có trong kỳ.` : "Kỳ này chưa có dòng lương nào.",
    },
    {
      key: "teaching_rate",
      label: "Đơn giá dạy đã đủ",
      done: run.lines.every((line) => line.teachingHours <= 0 || line.employee.teachingHourlyRate != null),
      help: "Mọi nhân sự có giờ dạy đều đã có đơn giá.",
    },
    {
      key: "assistant_rate",
      label: "Đơn giá trợ giảng đã đủ",
      done: run.lines.every((line) => line.assistantHours <= 0 || line.employee.assistantHourlyRate != null),
      help: "Mọi nhân sự có giờ trợ giảng đều đã có đơn giá.",
    },
    {
      key: "staff_rate",
      label: "Đơn giá 1 công HC đã đủ",
      done: run.lines.every((line) => line.staffDays <= 0 || line.employee.staffDailyRate != null),
      help: "Mọi nhân sự có công hành chính đều đã có đơn giá.",
    },
    {
      key: "source_match",
      label: "Số liệu nguồn đang khớp",
      done: !hasMismatch,
      help: !hasMismatch ? "Giờ dạy, TG và công HC đang khớp dữ liệu gốc." : "Có dòng lương đang lệch so với dữ liệu gốc, cần tính lại.",
    },
  ];

  return {
    run,
    items,
    isReady: items.every((item) => item.done),
  };
}
