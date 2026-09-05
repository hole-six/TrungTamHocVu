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

  // Chỉ chuyển Lead sang TESTED khi buổi test THỰC SỰ đã diễn ra (có testDate) —
  // hẹn lịch (chỉ có scheduledDate) chưa phải là đã test. Nhưng hẹn lịch VẪN là 1
  // bước tiến thực tế nên NEW/CONTACTING phải lên APPOINTED ngay khi có scheduledDate
  // — trước đây chỉ APPOINTED/CONTACTING mới được nâng lên TESTED, nên 1 lead mới tạo
  // (đang NEW) kèm lịch hẹn test nằm mãi ở "Chưa liên hệ" dù đã có lịch, trong khi cột
  // lịch test lại hiện "Đã hẹn, chưa test" — 2 cột nhìn mâu thuẫn nhau.
  let nextLeadStatus: string | null = null;
  if (testDate && (lead.status === "NEW" || lead.status === "APPOINTED" || lead.status === "CONTACTING")) {
    nextLeadStatus = "TESTED";
  } else if (test.scheduledDate && (lead.status === "NEW" || lead.status === "CONTACTING")) {
    nextLeadStatus = "APPOINTED";
  }
  if (nextLeadStatus) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: nextLeadStatus } });
  }

  return NextResponse.json({ item: test }, { status: 201 });
}
