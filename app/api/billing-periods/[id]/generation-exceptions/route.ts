import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { previewChargeGenerationExceptions } from "@/lib/server/billing-generation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xem ngoại lệ sinh học phí" }, { status: 403 });
  }

  const result = await previewChargeGenerationExceptions(params.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
