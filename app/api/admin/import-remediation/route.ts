import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getRemediationWorkspace, saveRemediationCsv } from "@/lib/workbook-remediation";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới xem được" }, { status: 403 });
  }

  const table = req.nextUrl.searchParams.get("table") ?? undefined;
  const workspace = await getRemediationWorkspace(table);

  return NextResponse.json(workspace);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới cập nhật được" }, { status: 403 });
  }

  const body = await req.json();
  const table = String(body.table ?? "").trim();
  const csvContent = String(body.csvContent ?? "");

  if (!table) {
    return NextResponse.json({ error: "Thiếu tên bảng remediation" }, { status: 400 });
  }

  try {
    const item = await saveRemediationCsv(table, csvContent);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể lưu remediation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
