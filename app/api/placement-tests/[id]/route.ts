import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { PLACEMENT_TEST_STATUSES } from "@/lib/server/lead-rules";

// Cập nhật 1 lịch hẹn test đã có — dùng khi buổi hẹn (scheduledDate) đã tới ngày và
// nhân sự ghi nhận kết quả thực tế (testDate/status/result), thay vì tạo dòng mới.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lịch hẹn test" }, { status: 403 });
  }

  const existing = await prisma.placementTest.findUnique({ where: { id: params.id }, include: { lead: true } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy lịch hẹn test" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("scheduledDate" in body) data.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
  if ("testDate" in body) data.testDate = body.testDate ? new Date(body.testDate) : null;
  if ("suggestedClass" in body) data.suggestedClass = body.suggestedClass || null;
  if ("result" in body) data.result = body.result || null;
  if ("notes" in body) data.notes = body.notes || null;
  if ("status" in body) {
    if (!PLACEMENT_TEST_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Trạng thái test không hợp lệ" }, { status: 400 });
    }
    data.status = body.status;
  }

  const updated = await prisma.placementTest.update({ where: { id: params.id }, data });

  // Không tự đổi trạng thái lead theo ngày test — "đã hẹn"/"đã test" nằm trong
  // CONTACTING, tiến trình test theo dõi bằng PlacementTest.status (xem ghi chú ở
  // app/api/leads/[id]/placement-test/route.ts).

  return NextResponse.json({ item: updated });
}
