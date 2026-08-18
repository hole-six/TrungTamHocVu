import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { buildBatchInvoiceArtifact, buildDownloadHeaders } from "@/lib/server/invoice-pdf";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("tuition", role)) {
    return NextResponse.json({ error: "Bạn không có quyền tải phiếu học phí." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const periodId = typeof body.periodId === "string" ? body.periodId : "";
  const mode = body.mode === "separate" ? "separate" : "merged";
  const chargeIds = Array.isArray(body.chargeIds)
    ? body.chargeIds.filter((item: unknown): item is string => typeof item === "string")
    : [];

  if (!periodId || chargeIds.length === 0) {
    return NextResponse.json({ error: "Thiếu kỳ thu hoặc danh sách phiếu cần tải." }, { status: 400 });
  }

  let result;
  try {
    result = await buildBatchInvoiceArtifact(periodId, chargeIds, mode);
  } catch (error) {
    console.error("Batch invoice export failed", error);
    return NextResponse.json({ error: "Không tạo được file xuất phiếu. Vui lòng kiểm tra lại dữ liệu phiếu học phí." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "Không tìm thấy phiếu phù hợp để xuất." }, { status: 404 });
  }

  return new NextResponse(result.artifact, {
    status: 200,
    headers: buildDownloadHeaders(result.fileName, result.contentType),
  });
}
