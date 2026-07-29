import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionBillingPeriod } from "@/lib/server/tuition-rules";
import { hasPermission } from "@/lib/server/permissions";

const STATUS_PERMISSION: Record<string, string> = {
  POSTED: "post",
  CLOSED: "close",
  REOPENED: "reopen",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const period = await prisma.billingPeriod.findUnique({
    where: { id: params.id },
    include: {
      charges: {
        include: { student: true, class: true, allocations: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!period) return NextResponse.json({ error: "Không tìm thấy kỳ thu" }, { status: 404 });

  return NextResponse.json({ item: period });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const period = await prisma.billingPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Không tìm thấy kỳ thu" }, { status: 404 });

  const body = await req.json();
  if (!canTransitionBillingPeriod(period.status, body.status)) {
    return NextResponse.json(
      { error: `Không thể chuyển kỳ thu từ "${period.status}" sang "${body.status}"` },
      { status: 409 }
    );
  }

  const requiredAction = STATUS_PERMISSION[body.status];
  if (requiredAction && !(await hasPermission(user, "charge", requiredAction))) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này với kỳ thu" }, { status: 403 });
  }

  const updated = await prisma.billingPeriod.update({
    where: { id: params.id },
    data: {
      status: body.status,
      postedAt: body.status === "POSTED" ? new Date() : period.postedAt,
      closedAt: body.status === "CLOSED" ? new Date() : body.status === "REOPENED" ? null : period.closedAt,
    },
  });

  return NextResponse.json({ item: updated });
}
