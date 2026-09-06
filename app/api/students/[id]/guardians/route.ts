import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

// Gắn thêm 1 phụ huynh cho học viên ĐÃ TỒN TẠI — trước đây chỉ gắn được lúc tạo học
// viên (từ lead hoặc form tạo mới), chưa có cách thêm phụ huynh thứ 2/thay phụ huynh
// sau đó ngoài việc chỉnh tay dữ liệu. Có thể gắn phụ huynh CÓ SẴN (truyền guardianId,
// vd anh chị em ruột dùng chung phụ huynh) hoặc tạo mới (truyền fullName) — tái dùng
// đúng theo số điện thoại nếu đã có phụ huynh trùng SĐT, tránh tạo trùng người.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm phụ huynh" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: params.id }, select: { id: true, branchId: true } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const relation = String(body.relation ?? "").trim() || null;
  const isPrimary = Boolean(body.isPrimary);
  const guardianId = String(body.guardianId ?? "").trim();
  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (!guardianId && !fullName) {
    return NextResponse.json({ error: "Cần chọn phụ huynh có sẵn hoặc nhập họ tên phụ huynh mới." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let resolvedGuardianId = guardianId || null;

    if (!resolvedGuardianId) {
      const existingGuardian = phone ? await tx.guardian.findFirst({ where: { phone } }) : null;
      const guardian =
        existingGuardian ?? (await tx.guardian.create({ data: { fullName, phone: phone || null } }));
      resolvedGuardianId = guardian.id;
    }

    const existingLink = await tx.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId: student.id, guardianId: resolvedGuardianId } },
    });
    if (existingLink) {
      return { error: "Phụ huynh này đã được gắn với học viên rồi." as const };
    }

    if (isPrimary) {
      await tx.studentGuardian.updateMany({ where: { studentId: student.id }, data: { isPrimary: false } });
    }

    const link = await tx.studentGuardian.create({
      data: { studentId: student.id, guardianId: resolvedGuardianId, relation, isPrimary },
      include: { guardian: { include: { user: true } } },
    });
    return { link };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ item: result.link }, { status: 201 });
}
