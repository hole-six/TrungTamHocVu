import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Thêm buổi bổ trợ đầu khóa cho học viên ĐÃ ghi danh sẵn (không cần đi qua luồng ghi
// danh mới) — dùng khi học viên tới đăng ký thực tế bên ngoài. Có thể miễn phí
// (paidAmount = 0) hoặc tính phí theo unitPrice. Mỗi buổi 1 SessionCredit đứng độc lập
// (sourceSessionId: null), origin: PAID_CATCHUP — tái dùng đúng origin đã có sẵn.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm bổ trợ đầu khóa" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });

  const body = await req.json();
  const enrollmentId = String(body.enrollmentId ?? "").trim();
  const count = Math.max(1, Math.floor(Number(body.count) || 0));
  const isFree = Boolean(body.isFree);
  const unitPrice = isFree ? 0 : Math.max(0, Math.floor(Number(body.unitPrice) || 0));

  if (!enrollmentId) return NextResponse.json({ error: "Thiếu lớp/ghi danh để gắn bổ trợ" }, { status: 400 });
  if (!count || count < 1) return NextResponse.json({ error: "Số buổi bổ trợ phải lớn hơn 0" }, { status: 400 });
  if (!isFree && unitPrice <= 0) {
    return NextResponse.json({ error: "Cần nhập giá cụ thể, hoặc tick Miễn phí" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.studentId !== student.id) {
    return NextResponse.json({ error: "Ghi danh không hợp lệ cho học viên này" }, { status: 400 });
  }

  const created = await prisma.$transaction((tx) =>
    Promise.all(
      Array.from({ length: count }, () =>
        tx.sessionCredit.create({
          data: {
            studentId: student.id,
            enrollmentId,
            sourceSessionId: null,
            status: "AVAILABLE",
            origin: "PAID_CATCHUP",
            unitPriceSnapshot: isFree ? 0 : unitPrice,
            paidAmount: isFree ? 0 : unitPrice,
          },
        }),
      ),
    ),
  );

  return NextResponse.json({ items: created });
}
