import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { parseRoadmapImportFile } from "@/lib/server/class-roadmap-sheet";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file cần nhập." }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".csv")) {
    return NextResponse.json({ error: "Hiện chỉ hỗ trợ nhập file .xlsx hoặc .csv." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const items = await parseRoadmapImportFile(file.name, bytes);
  if (items.length === 0) {
    return NextResponse.json({ error: "Không đọc được dữ liệu lộ trình từ file đã tải lên." }, { status: 400 });
  }

  return NextResponse.json({ items });
}
