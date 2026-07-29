import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

// Chuyển Lead thành Học viên — bước "Duyệt xếp lớp / Tạo Student" trong Master Spec
// §6. Cố tình KHÔNG tạo Enrollment/Charge ở đây: xếp lớp cụ thể và sinh học phí dự
// kiến thuộc phạm vi module Lớp & Lịch / Học phí (chưa triển khai) — tạo dữ liệu giả
// ở đây sẽ sai lệch khi hai module đó lên, nên chỉ tạo hồ sơ Student trước.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });

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
  const branchId = user.branchId;

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

    return created;
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "convert",
      entityType: "Lead",
      entityId: lead.id,
      after: JSON.stringify({ studentId: student.id }),
      reason: "Chuyển đổi Lead thành Học viên",
    },
  });

  return NextResponse.json({ item: student }, { status: 201 });
}
