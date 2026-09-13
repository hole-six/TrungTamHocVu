import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { ensurePayrollLineForEmployee } from "@/lib/server/payroll-generation";

// Lấy (tạo nếu chưa có) dòng lương của 1 nhân sự trong 1 tháng, để form điều chỉnh
// thưởng/phạt có chỗ ghi. Gọi ngay trước mỗi lần lưu điều chỉnh — không bắt người dùng
// phải "tạo tháng lương" rồi "tính lương" trước như quy trình cũ.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lương" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const employeeId = String(body.employeeId ?? "").trim();
  const period = String(body.period ?? "").trim();
  if (!employeeId || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "Thiếu nhân sự hoặc tháng lương" }, { status: 400 });
  }

  const result = await ensurePayrollLineForEmployee(employeeId, period);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  if (!(await canAccessBranch(result.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở" }, { status: 403 });
  }

  return NextResponse.json({ item: result.line });
}
