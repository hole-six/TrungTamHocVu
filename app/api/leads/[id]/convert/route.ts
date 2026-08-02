import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền chuyển đổi lead thành học viên" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, include: { student: true } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });
  if (lead.status !== "QUALIFIED") {
    return NextResponse.json({ error: "Chỉ chuyển đổi được lead ở trạng thái 'Đạt, chờ xếp lớp'" }, { status: 409 });
  }
  if (lead.student) {
    return NextResponse.json({ error: "Lead này đã được chuyển thành học viên trước đó" }, { status: 409 });
  }

  const studentCode = lead.leadCode;
  const now = new Date();
  const branchId = lead.branchId;

  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        branchId,
        studentCode,
        fullName: lead.fullName,
        leadId: lead.id,
        gender: lead.gender,
        dob: lead.dob,
        phone: lead.phone,
        address: lead.address,
        enrollDate: now,
        status: "ACTIVE",
      },
    });

    if (lead.guardianId) {
      await tx.studentGuardian.create({
        data: { studentId: created.id, guardianId: lead.guardianId, isPrimary: true },
      });
    }

    await tx.lead.update({ where: { id: lead.id }, data: { status: "ENROLLED", actualEnrollDate: now } });
    await syncStudentDerivedFields(created.id, tx);

    return created;
  });

  const synced = await syncStudentDerivedFields(student.id);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId,
      action: "convert",
      entityType: "Lead",
      entityId: lead.id,
      after: JSON.stringify({ studentId: synced?.id ?? student.id }),
      reason: "Chuyển đổi Lead thành Học viên",
    },
  });

  return NextResponse.json({ item: synced ?? student }, { status: 201 });
}
