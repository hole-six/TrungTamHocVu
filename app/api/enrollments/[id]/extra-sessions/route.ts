import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền cộng buổi cho học viên" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionCount = Number(body.sessionCount ?? 0);
  const reason = String(body.reason ?? "").trim();

  if (!Number.isInteger(sessionCount) || sessionCount <= 0 || sessionCount > 100) {
    return NextResponse.json({ error: "Số buổi cộng thêm phải là số nguyên từ 1 đến 100." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Cần nhập lý do cộng buổi để sau này đối soát." }, { status: 400 });
  }

  const existing = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: true, student: true },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy ghi danh" }, { status: 404 });
  if (!["ACTIVE", "PAUSED"].includes(existing.status)) {
    return NextResponse.json({ error: "Chỉ cộng buổi cho học viên đang học hoặc tạm nghỉ." }, { status: 409 });
  }

  const note = [
    existing.notes,
    `[${new Date().toLocaleDateString("vi-VN")}] Cộng ${sessionCount} buổi linh động: ${reason}`,
  ].filter(Boolean).join("\n");

  const updated = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.update({
      where: { id: existing.id },
      data: {
        manualExtraSessionCount: { increment: sessionCount },
        continuationStatus: "ON_TRACK",
        pricingBasis: existing.pricingBasis === "FULL_COURSE" ? "MANUAL" : existing.pricingBasis,
        notes: note,
      },
    });

    await tx.enrollmentStatusHistory.create({
      data: {
        studentId: existing.studentId,
        enrollmentId: existing.id,
        fromStatus: existing.status,
        toStatus: existing.status,
        reason: `Cộng ${sessionCount} buổi linh động. Lý do: ${reason}`,
        changedById: user.id,
      },
    });

    await syncStudentDerivedFields(existing.studentId, tx);
    return enrollment;
  });

  const syncedStudent = await syncStudentDerivedFields(existing.studentId);
  return NextResponse.json({ item: updated, student: syncedStudent });
}
