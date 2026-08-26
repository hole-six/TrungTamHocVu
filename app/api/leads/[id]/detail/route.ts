import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { computeOutstandingBalance } from "@/lib/server/balance";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user || !canView("leads", role)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      guardian: { include: { user: true } },
      interestedClass: true,
      interactions: { orderBy: { occurredAt: "desc" } },
      appointments: { orderBy: { scheduledAt: "desc" } },
      placementTests: { orderBy: { testDate: "desc" } },
      student: {
        include: {
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { include: { user: true } } },
          },
          enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
        },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });
  if (!(await canAccessBranch(lead.branchId))) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const currentEnrollment = lead.student?.enrollments.find((e) => e.status === "ACTIVE") ?? lead.student?.enrollments[0] ?? null;
  const linkedGuardian = lead.student?.guardians[0]?.guardian ?? lead.guardian ?? null;
  const outstanding = lead.student ? await computeOutstandingBalance(lead.student.id) : null;

  return NextResponse.json({
    lead,
    editable: canUpdate("leads", role),
    currentEnrollment,
    linkedGuardian,
    outstanding,
  });
}
