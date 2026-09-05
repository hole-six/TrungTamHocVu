import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canDelete, canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user || !canView("leads", role)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  // Chỉ lấy đúng những gì drawer chi tiết cần hiển thị (thông tin lead + lịch test +
  // tương tác) — trước đây kéo thêm enrollment/portal/công nợ chỉ để hiện 4 thẻ đếm và
  // 1 khối "liên kết vận hành" lặp lại thông tin phụ huynh, giờ đã bỏ khỏi màn này.
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      interestedClass: true,
      interactions: { orderBy: { occurredAt: "desc" }, take: 10 },
      placementTests: { orderBy: { createdAt: "desc" } },
      student: { select: { id: true, fullName: true } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });
  if (!(await canAccessBranch(lead.branchId))) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  return NextResponse.json({
    lead,
    editable: canUpdate("leads", role),
    deletable: canDelete("leads", role),
  });
}
