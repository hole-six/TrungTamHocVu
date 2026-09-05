import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";

// Ghi nhận kết quả test đầu vào — tương ứng bước "Lead hoàn tất test / Lưu kết quả"
// trong Master Spec §6. Trạng thái lead do nhân sự tự quyết định, không suy luận thay
// (spec §14) — xem ghi chú ở cuối hàm.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi nhận kết quả test" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });

  const body = await req.json();

  const suggestedClass = body.suggestedClass || suggestGradeLevel(calculateAge(lead.dob));
  const testDate = body.testDate ? new Date(body.testDate) : null;

  const test = await prisma.placementTest.create({
    data: {
      leadId: lead.id,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      testDate,
      status: body.status || "SCHEDULED",
      suggestedClass,
      result: body.result || null,
      notes: body.notes || null,
    },
  });

  // KHÔNG tự đổi trạng thái lead theo lịch test nữa: "đã hẹn test" và "đã test xong"
  // đều nằm trong CONTACTING (xem LEAD_STATUSES ở lib/server/lead-rules.ts), còn tiến
  // trình test cụ thể đã có trạng thái riêng trên chính PlacementTest
  // (SCHEDULED/PASSED/FAILED...). Việc lead có Đạt hay không là đánh giá của nhân sự
  // trên kết quả, nên để họ tự bấm QUALIFIED/LOST.

  return NextResponse.json({ item: test }, { status: 201 });
}
