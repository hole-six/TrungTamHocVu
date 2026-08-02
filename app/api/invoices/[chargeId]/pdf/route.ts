import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { buildDownloadHeaders, buildSingleInvoicePdf } from "@/lib/server/invoice-pdf";

export async function GET(_req: Request, { params }: { params: { chargeId: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("tuition", role)) {
    return NextResponse.json({ error: "Bạn không có quyền tải phiếu học phí." }, { status: 403 });
  }

  const result = await buildSingleInvoicePdf(params.chargeId);
  if (!result) {
    return NextResponse.json({ error: "Không tìm thấy phiếu học phí." }, { status: 404 });
  }

  return new NextResponse(result.pdf, {
    status: 200,
    headers: buildDownloadHeaders(result.fileName, "application/pdf"),
  });
}
