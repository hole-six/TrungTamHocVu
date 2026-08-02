import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max) || null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("tuition", role) || (user.branchId && user.branchId !== params.id)) {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật thông tin nhận học phí của cơ sở này" }, { status: 403 });
  }

  const body = await req.json();
  const qrImageData = clean(body.qrImageData, 2_800_000);
  if (qrImageData && !/^data:image\/(png|jpeg|webp);base64,/.test(qrImageData)) {
    return NextResponse.json({ error: "Ảnh QR phải là PNG, JPG hoặc WEBP" }, { status: 400 });
  }

  const profile = await prisma.branchPaymentProfile.upsert({
    where: { branchId: params.id },
    create: {
      branchId: params.id,
      bankName: clean(body.bankName, 120),
      accountNumber: clean(body.accountNumber, 80),
      accountHolder: clean(body.accountHolder, 160),
      qrImageData,
      paymentInstruction: clean(body.paymentInstruction, 800),
    },
    update: {
      bankName: clean(body.bankName, 120),
      accountNumber: clean(body.accountNumber, 80),
      accountHolder: clean(body.accountHolder, 160),
      qrImageData,
      paymentInstruction: clean(body.paymentInstruction, 800),
    },
  });

  return NextResponse.json({ item: profile });
}
