import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";

// Ghi nhận kết quả test đầu vào — tương ứng bước "Lead hoàn tất test / Lưu kết quả"
// trong Master Spec §6. Việc test đã xảy ra là sự kiện khách quan nên tự chuyển
// Lead sang TESTED; còn QUALIFIED/UNQUALIFIED là đánh giá chủ quan trên kết quả nên
// để nhân sự tự bấm chuyển trạng thái, không suy luận thay (spec §14).
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

  const test = await prisma.placementTest.create({
    data: {
      leadId: lead.id,
      testDate: body.testDate ? new Date(body.testDate) : new Date(),
      status: body.status || "DONE",
      suggestedClass,
      result: body.result || null,
      notes: body.notes || null,
    },
  });

  if (lead.status === "APPOINTED" || lead.status === "CONTACTING") {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "TESTED" } });
  }

  return NextResponse.json({ item: test }, { status: 201 });
}
