import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate, canDelete } from "@/lib/server/role-matrix";
import { canManuallySetStatus, normalizePendingRemedialSessions } from "@/lib/server/lead-rules";
import { canAccessBranch } from "@/lib/branch-filter";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (user && !canView("leads", role)) return NextResponse.json({ error: "Khong co quyen xem lead" }, { status: 403 });
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      interactions: { orderBy: { occurredAt: "desc" }, include: { employee: true } },
      appointments: { orderBy: { scheduledAt: "desc" }, include: { employee: true } },
      placementTests: { orderBy: { testDate: "desc" } },
      student: true,
    },
  });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });

  if (!(await canAccessBranch(lead.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  return NextResponse.json({ item: lead });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.lead.findUnique({ where: { id: params.id } });
  if (existing && !(await canAccessBranch(existing.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!existing) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lead" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("status" in body && body.status !== existing.status) {
    if (!canManuallySetStatus(existing.status, body.status)) {
      return NextResponse.json(
        { error: `Không thể chuyển trạng thái từ "${existing.status}" sang "${body.status}"` },
        { status: 409 }
      );
    }
    data.status = body.status;
  }

  for (const field of ["fullName", "gender", "phone", "secondaryPhone", "zaloContact", "currentSchoolGrade", "address", "source", "facebookParentName", "facebookLink", "initialAssessment", "notes", "notes2"]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["dob", "meetDate", "expectedStartDate", "actualEnrollDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }
  if ("pendingRemedialSessions" in body) {
    data.pendingRemedialSessions = normalizePendingRemedialSessions(body.pendingRemedialSessions);
  }
  if ("interestedClassId" in body) {
    const interestedClassId = body.interestedClassId ? String(body.interestedClassId) : null;
    if (interestedClassId) {
      const interestedClass = await prisma.class.findUnique({ where: { id: interestedClassId }, select: { branchId: true } });
      if (!interestedClass) return NextResponse.json({ error: "Khong tim thay lop quan tam" }, { status: 404 });
      if (interestedClass.branchId !== existing.branchId) {
        return NextResponse.json({ error: "Lop quan tam phai cung co so voi lead" }, { status: 409 });
      }
    }
    data.interestedClassId = interestedClassId;
  }

  if ("guardianName" in body || "phone" in body) {
    const guardianName = String(body.guardianName ?? "").trim();
    const phone = String(body.phone ?? data.phone ?? existing.phone ?? "").trim();

    if (existing.guardianId) {
      await prisma.guardian.update({
        where: { id: existing.guardianId },
        data: {
          fullName: guardianName || "Chưa rõ",
          phone: phone || null,
        },
      });
    } else if (guardianName || phone) {
      const guardian = await prisma.guardian.create({
        data: {
          fullName: guardianName || "Chưa rõ",
          phone: phone || null,
        },
      });
      data.guardianId = guardian.id;
    }
  }

  const updated = await prisma.lead.update({ where: { id: params.id }, data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "update",
      entityType: "Lead",
      entityId: updated.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa lead" }, { status: 403 });
  }

  const existing = await prisma.lead.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!existing) return NextResponse.json({ error: "Khong tim thay lead" }, { status: 404 });
  if (!(await canAccessBranch(existing.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { leadId: params.id } });
  if (student) {
    return NextResponse.json({ error: "Lead đã chuyển thành học viên, không thể xóa." }, { status: 409 });
  }

  await prisma.lead.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
