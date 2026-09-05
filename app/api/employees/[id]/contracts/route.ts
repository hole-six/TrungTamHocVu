import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

// Hồ sơ HĐLĐ trước đây hoàn toàn không có API tạo/sửa — DB đã có model
// EmploymentContract (contractNo/signDate/expiryDate/contractType/baseSalary) nhưng
// ngày ký/hết hạn chỉ đọc được, không nhập được ở đâu. Mỗi lần "ký hợp đồng mới" tạo
// 1 dòng mới (không sửa đè lên hợp đồng cũ) — đúng bản chất 1 hợp đồng đã ký là lịch
// sử, không phải giá trị sửa được; danh sách/hồ sơ luôn hiển thị hợp đồng có
// signDate mới nhất (xem GET /api/employees và GET /api/employees/[id]).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo hợp đồng lao động" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const body = await req.json();
  const signDate = body.signDate ? new Date(body.signDate) : null;
  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  if (!signDate) return NextResponse.json({ error: "Thiếu ngày ký hợp đồng" }, { status: 400 });
  if (expiryDate && expiryDate < signDate) {
    return NextResponse.json({ error: "Hạn hợp đồng phải sau ngày ký" }, { status: 400 });
  }

  const contract = await prisma.employmentContract.create({
    data: {
      employeeId: employee.id,
      contractNo: body.contractNo ? String(body.contractNo).trim() : null,
      signDate,
      expiryDate,
      contractType: body.contractType ? String(body.contractType).trim() : null,
      baseSalary: body.baseSalary ? Number(body.baseSalary) : null,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  });

  return NextResponse.json({ item: contract }, { status: 201 });
}
