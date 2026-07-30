import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { computeContractStatus } from "@/lib/server/payroll-rules";
import { getBranchWhereClause } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employees = await prisma.employee.findMany({
    where: await getBranchWhereClause(searchParams.get("branchId")),
    orderBy: { fullName: "asc" },
    include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
  });

  // FR-0148: gắn cảnh báo hợp đồng ngay trên danh sách — giống cột "Tình trạng làm
  // việc" hiển thị cho mọi dòng cùng lúc trong NhanSu gốc, thay vì phải mở từng hồ sơ.
  const items = employees.map(({ contracts, ...employee }) => ({
    ...employee,
    contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canCreateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo hồ sơ nhân viên" }, { status: 403 });
  }

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  const shortName = String(body.shortName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên" }, { status: 400 });
  if (!shortName) return NextResponse.json({ error: "Thiếu tên ngắn (dùng để phân công buổi dạy)" }, { status: 400 });

  const employeeCode = String(body.employeeCode ?? "").trim() || `NV${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const existing = await prisma.employee.findUnique({ where: { employeeCode } });
  if (existing) return NextResponse.json({ error: "Mã nhân viên đã tồn tại" }, { status: 409 });

  const employee = await prisma.employee.create({
    data: {
      branchId: user.branchId,
      employeeCode,
      fullName,
      shortName,
      position: body.position || null,
      phone: body.phone || null,
      email: body.email || null,
      dob: body.dob ? new Date(body.dob) : null,
      hometown: body.hometown || null,
      permanentAddress: body.permanentAddress || null,
      idNumber: body.idNumber || null,
      idIssueDate: body.idIssueDate ? new Date(body.idIssueDate) : null,
      idIssuePlace: body.idIssuePlace || null,
      teachingHourlyRate: body.teachingHourlyRate ? Number(body.teachingHourlyRate) : null,
      assistantHourlyRate: body.assistantHourlyRate ? Number(body.assistantHourlyRate) : null,
      payMode: body.payMode || "HOURLY",
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: employee }, { status: 201 });
}
