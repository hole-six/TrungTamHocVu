import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { calculateAge, suggestGradeLevel } from "@/lib/server/lead-rules";
import { applyPlacementTestToLeadStatus } from "@/lib/server/lead-status-sync";

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

  const { test, leadSync } = await prisma.$transaction(async (tx) => {
    const created = await tx.placementTest.create({
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

    // Lần ghi nhận đầu tiên đã có kết quả (vd test xong mới nhập liệu) thì trạng thái
    // lead phải đi theo luôn — xem lib/server/lead-status-sync.ts.
    const sync = await applyPlacementTestToLeadStatus(tx, {
      leadId: lead.id,
      previousTestStatus: null,
      nextTestStatus: created.status,
      employeeId: user.employeeId ?? null,
    });

    return { test: created, leadSync: sync };
  });

  return NextResponse.json(
    { item: test, leadStatus: leadSync.leadStatus, leadStatusMessage: leadSync.message },
    { status: 201 },
  );
}
