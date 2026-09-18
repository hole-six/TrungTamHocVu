import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { parseLocalDateTime } from "@/lib/score-event-detail";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const items = await prisma.assistantScoreEvent.findMany({
    where: { employeeId: params.id },
    include: { branch: { select: { name: true } }, class: { select: { className: true, classCode: true } } },
    orderBy: { eventDate: "desc" },
  });

  const filtered = month
    ? items.filter((item) => `${item.eventDate.getUTCFullYear()}-${String(item.eventDate.getUTCMonth() + 1).padStart(2, "0")}` === month)
    : items;

  return NextResponse.json({ items: filtered });
}

// Dùng canUpdate("hr") để khớp với điều kiện hiện link "Đánh giá điểm trợ giảng" ở
// app/(app)/payroll/page.tsx (canManagePayrollRuns = canUpdate("hr", role)).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền chấm điểm trợ giảng" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const body = await req.json();
  const branchId = String(body.branchId ?? "").trim();
  const type = String(body.type ?? "");
  const points = Number(body.points);
  if (!branchId) return NextResponse.json({ error: "Thiếu cơ sở" }, { status: 400 });
  if (!["DEDUCT", "ADD"].includes(type)) return NextResponse.json({ error: "Loại điểm không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(points) || points <= 0) return NextResponse.json({ error: "Số điểm phải lớn hơn 0" }, { status: 400 });
  if (!body.eventDate) return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });

  // Chi tiết đối soát — tất cả không bắt buộc, nhưng có thì trả lời được ngay khi nhân sự
  // thắc mắc (xem lib/score-event-detail.ts).
  const classId = String(body.classId ?? "").trim() || null;
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp đã chọn" }, { status: 404 });
  }

  const event = await prisma.assistantScoreEvent.create({
    data: {
      employeeId: params.id,
      branchId,
      eventDate: new Date(body.eventDate),
      type,
      points,
      reason: body.reason || null,
      occurredAt: parseLocalDateTime(body.occurredAt),
      classId,
      dueAt: parseLocalDateTime(body.dueAt),
      completedAt: parseLocalDateTime(body.completedAt),
      resolvedAt: parseLocalDateTime(body.resolvedAt),
      resolvedNote: String(body.resolvedNote ?? "").trim() || null,
      // Quy chế: 1 nội dung bị nhắc ở cả 3 báo cáo (ngày, tuần, tháng) → mặc định −10% lương.
      tripleReported: type === "DEDUCT" && Boolean(body.tripleReported),
      createdById: user.id,
    },
  });

  return NextResponse.json({ item: event }, { status: 201 });
}
