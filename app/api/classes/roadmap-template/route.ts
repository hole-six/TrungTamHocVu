import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { buildRoadmapTemplateWorkbook } from "@/lib/server/class-roadmap-sheet";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const totalSessions = Number(searchParams.get("totalSessions") ?? 0);
  const classCode = searchParams.get("classCode")?.trim() || "";

  if (!Number.isInteger(totalSessions) || totalSessions <= 0) {
    return NextResponse.json({ error: "Tổng số buổi không hợp lệ để tạo file mẫu." }, { status: 400 });
  }

  const workbook = await buildRoadmapTemplateWorkbook({ totalSessions, classCode });
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `mau-lo-trinh-${classCode || "lop-moi"}-${totalSessions}-buoi.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
