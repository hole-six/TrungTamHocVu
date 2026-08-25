import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause } from "@/lib/branch-filter";

// Danh sách "Nhóm lớp" (ngăn sếp) đã tồn tại — dùng để gợi ý autocomplete khi tạo/sửa
// lớp (input list="..." + datalist), cho phép chọn lại đúng ngăn cũ (tránh gõ lệch
// chính tả sinh ngăn trùng, vd "FF1" và "ff1") hoặc gõ tên ngăn mới nếu chưa có.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const rows = await prisma.class.findMany({
    where: { ...branchWhere, classGroup: { not: null } },
    select: { classGroup: true },
    distinct: ["classGroup"],
    orderBy: { classGroup: "asc" },
  });

  return NextResponse.json({ items: rows.map((row) => row.classGroup).filter((value): value is string => Boolean(value)) });
}
