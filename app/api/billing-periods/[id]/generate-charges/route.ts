import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { generateChargesForPeriod } from "@/lib/server/billing-generation";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

// Sinh Charge (khoản phải thu) cho mọi ghi danh đang ACTIVE trong kỳ — tương ứng
// trigger "Phát sinh học phí" ở Master Spec §6. Số buổi/số buổi nghỉ lấy từ
// ClassSession + StudentAttendance THẬT (không phải gõ tay như TheoDoiHP gốc).
// Buổi trừ (deductedCount) mặc định 0, nhân sự có thể sửa tay sau khi sinh vì đây
// là trường hợp ngoại lệ spec §14 yêu cầu không tự động quyết định.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sinh học phí" }, { status: 403 });
  }

  const result = await generateChargesForPeriod(params.id);
  if ("error" in result) {
    const status = result.error === "Không tìm thấy kỳ thu" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
