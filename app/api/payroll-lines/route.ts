import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

// Thêm thủ công 1 nhân viên vào 1 kỳ lương đang mở (DRAFT/CALCULATED/REVIEWED) — dùng
// khi "Tính lương" hàng loạt bỏ sót 1 nhân viên (vd mới ký hợp đồng giữa tháng, chưa
// có buổi dạy/chấm công nào để hệ thống tự nhận ra). Mọi số tiền mặc định 0, sửa lại
// bằng PayrollLineEditor sau khi tạo — không tự tính công/lương ở đây.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm dòng lương" }, { status: 403 });
  }

  const body = await req.json();
  const payrollRunId = String(body.payrollRunId ?? "").trim();
  const employeeId = String(body.employeeId ?? "").trim();
  if (!payrollRunId || !employeeId) {
    return NextResponse.json({ error: "Thiếu kỳ lương hoặc nhân viên" }, { status: 400 });
  }

  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (run && !(await canAccessBranch(run.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!run) return NextResponse.json({ error: "Không tìm thấy kỳ lương" }, { status: 404 });
  if (!canEditPayroll(run.status)) {
    return NextResponse.json({ error: "Kỳ lương đã duyệt/khóa, không thể thêm nhân sự." }, { status: 409 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!employee) return NextResponse.json({ error: "Khong tim thay nhan vien" }, { status: 404 });
  if (employee.branchId !== run.branchId) {
    return NextResponse.json({ error: "Nhan vien khong thuoc co so cua ky luong" }, { status: 409 });
  }

  const existing = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId, employeeId } },
  });
  if (existing) return NextResponse.json({ error: "Nhân viên này đã có trong kỳ lương" }, { status: 409 });

  const line = await prisma.payrollLine.create({ data: { payrollRunId, employeeId } });
  return NextResponse.json({ item: line }, { status: 201 });
}
