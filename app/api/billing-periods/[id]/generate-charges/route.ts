import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { generateChargesForPeriod } from "@/lib/server/billing-generation";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sinh học phí" }, { status: 403 });
  }

  const result = await generateChargesForPeriod(params.id);
  if ("error" in result) {
    const message = result.error ?? "Không thể sinh học phí";
    const status = message.toLowerCase().includes("kỳ thu") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result);
}
