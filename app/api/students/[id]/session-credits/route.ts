import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canEditCharges } from "@/lib/server/tuition-rules";

// Thêm buổi bổ trợ đầu khóa cho học viên ĐÃ ghi danh sẵn (không cần đi qua luồng ghi
// danh mới) — dùng khi học viên tới đăng ký thực tế bên ngoài. Có thể miễn phí
// (paidAmount = 0) hoặc tính phí theo unitPrice, tính tiền THEO TỪNG BUỔI (đăng ký 3
// buổi = 3 x đơn giá, không phải 1 khoản cố định). Mỗi buổi 1 SessionCredit đứng độc
// lập (sourceSessionId: null), origin: PAID_CATCHUP — tái dùng đúng origin đã có sẵn.
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

  const totalAmount = isFree ? 0 : unitPrice * count;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const items = await Promise.all(
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
    );

    let chargeUpdated = false;
    let linkedChargeId: string | null = null;

    if (totalAmount > 0) {
      // Ưu tiên charge trọn khóa (COURSE) của đúng enrollment này — đây là nơi
      // paidCatchupAmount vốn được cộng vào lúc ghi danh (xem generateCourseCharge
      // trong billing-generation.ts); thêm bổ trợ sau khi đã ghi danh thì cộng dồn
      // đúng vào charge đó để phiếu học phí/công nợ phản ánh đủ. Nếu enrollment
      // không thu COURSE (PERIOD/INSTALLMENT) hoặc chưa có charge trọn khóa, cộng
      // vào charge của kỳ thu hiện tại — cùng cách app/api/books/[id]/issues đang
      // cộng tiền sách phát sinh vào công nợ đang mở.
      let charge = await tx.charge.findFirst({
        where: {
          studentId: student.id,
          classId: enrollment.classId,
          billingModel: "COURSE",
          OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }],
        },
        include: { billingPeriod: true },
      });

      if (!charge) {
        const period = await tx.billingPeriod.findFirst({
          where: { branchId: student.branchId, startDate: { lte: now }, endDate: { gte: now } },
          orderBy: { startDate: "desc" },
        });
        if (period) {
          const periodCharge = await tx.charge.findUnique({
            where: { studentId_classId_billingPeriodId: { studentId: student.id, classId: enrollment.classId, billingPeriodId: period.id } },
          });
          if (periodCharge) charge = { ...periodCharge, billingPeriod: period };
        }
      }

      if (charge && canEditCharges(charge.billingPeriod.status)) {
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            paidCatchupAmount: charge.paidCatchupAmount + totalAmount,
            tuitionAmount: charge.tuitionAmount + totalAmount,
            totalAmount: charge.totalAmount + totalAmount,
          },
        });
        chargeUpdated = true;
        linkedChargeId = charge.id;
      }
    }

    return { items, chargeUpdated, linkedChargeId };
  });

  const warning =
    totalAmount > 0 && !result.chargeUpdated
      ? "Chưa tìm thấy phiếu học phí đang mở để cộng tiền bổ trợ vào — số tiền này đang chỉ nằm ở buổi bổ trợ, cần cộng tay vào công nợ nếu cần."
      : null;

  return NextResponse.json({ items: result.items, chargeUpdated: result.chargeUpdated, linkedChargeId: result.linkedChargeId, warning });
}
