import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";
import { canAccessBranch } from "@/lib/branch-filter";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { computeAdvanceBalance } from "@/lib/server/advance-payment";

// Tình hình tiền THẬT của học viên tại thời điểm hỏi: còn nợ bao nhiêu và đang có sẵn
// bao nhiêu tiền đã đóng trước chưa dùng tới.
//
// Vì sao cần endpoint riêng: form thu tiền được gọi từ 6 chỗ khác nhau và mỗi chỗ
// truyền vào một con số khác nhau — có nơi là công nợ cả học viên, có nơi chỉ là phần
// còn thiếu của MỘT phiếu học phí. Nếu form lấy con số đó làm mốc để nói "thu dư" thì
// sẽ báo dư sai khi học viên vẫn còn nợ ở phiếu khác. Con số dùng để cảnh báo phải lấy
// từ đúng một nguồn với API thu tiền.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "tuition", "view"))) {
    return NextResponse.json({ error: "Bạn không có quyền xem học phí" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    select: { id: true, branchId: true },
  });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const [outstanding, advanceBalance] = await Promise.all([
    computeOutstandingBalance(student.id),
    computeAdvanceBalance(prisma, student.id),
  ]);

  return NextResponse.json({ outstanding, advanceBalance });
}
