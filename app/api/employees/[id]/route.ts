import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { computeContractStatus } from "@/lib/server/payroll-rules";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

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

  return NextResponse.json({ item: employee, contractStatus });
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
    "hometown", "permanentAddress", "idNumber", "idIssuePlace",
  ]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["teachingHourlyRate", "assistantHourlyRate"]) {
    if (field in body) data[field] = body[field] === "" || body[field] === null ? null : Number(body[field]);
  }
  for (const field of ["dob", "idIssueDate", "resignDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: employee });
}
