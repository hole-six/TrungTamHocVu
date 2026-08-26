import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride, canViewFullWithOverride } from "@/lib/server/role-matrix";
import { computeContractStatus } from "@/lib/server/payroll-rules";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // Trước đây route này không kiểm tra quyền "hr" (chỉ check đã đăng nhập) — bất kỳ
  // user nào cũng gọi được để xem toàn bộ hồ sơ/lương/lịch sử của người khác. Gate
  // đúng như trang /payroll/employees/[id] đã tự làm: chính chủ hoặc có quyền xem
  // đầy đủ "hr".
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  const isSelf = user.employeeId === params.id;
  if (!isSelf && !canViewFullWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xem hồ sơ nhân viên này" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      sessionAssignments: { include: { session: { include: { class: true } } }, orderBy: { id: "desc" }, take: 20 },
      timesheetEntries: { orderBy: { workDate: "desc" }, take: 30 },
      contracts: { orderBy: { signDate: "desc" }, take: 1 },
    },
  });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  // FR-0148: cảnh báo dựa trên hợp đồng hiện hành (mới ký gần nhất) — hiển thị cho
  // nhân sự chủ động gia hạn thay vì phát hiện khi hợp đồng đã hết hạn từ lâu.
  const contractStatus = computeContractStatus(employee.resignDate, employee.contracts[0]?.expiryDate ?? null);

  // Cùng shape truy vấn với /teacher-tasks và trang /payroll/employees/[id] — gộp vào
  // đây để tab "Lịch sử" ở drawer nhân sự lấy đủ dữ liệu qua đúng 1 lần gọi API.
  const requirementChecks = await prisma.sessionRequirementCheck.findMany({
    where: { employeeId: params.id },
    include: {
      session: { select: { id: true, classId: true, sessionDate: true, class: { select: { className: true } } } },
      scoreEvent: { select: { points: true, type: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ item: employee, contractStatus, requirementChecks });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa hồ sơ nhân viên" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of [
    "fullName", "shortName", "position", "phone", "email", "workStatus", "payMode", "notes",
    "hometown", "permanentAddress", "idNumber", "idIssuePlace", "bankName", "bankAccountNumber", "bankAccountHolder",
  ]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["teachingHourlyRate", "assistantHourlyRate", "staffDailyRate"]) {
    if (field in body) {
      if (body[field] === "" || body[field] === null) {
        data[field] = null;
      } else {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return NextResponse.json({ error: "Đơn giá lương phải là số không âm" }, { status: 400 });
        }
        data[field] = value;
      }
    }
  }
  for (const field of ["dob", "idIssueDate", "resignDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: employee });
}
