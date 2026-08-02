import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const status = searchParams.get("status")?.trim();

  const items = await prisma.asset.findMany({
    where: {
      ...(await getBranchWhereClause(searchParams.get("branchId"))),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { category: { contains: q } }, { room: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: { transactions: true },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const branchId = await getValidBranchIdForCreation();
  if (!branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const { role, override } = await getUserRoleAndOverride(user.id, "assets");
  if (!canCreateWithOverride("assets", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thêm tài sản mới" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Thiếu tên tài sản/thiết bị" }, { status: 400 });

  const initialQuantity = Number(body.quantity ?? 1);
  if (!Number.isFinite(initialQuantity) || initialQuantity < 0) {
    return NextResponse.json({ error: "Số lượng ban đầu không hợp lệ" }, { status: 400 });
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        branchId,
        assetCode: body.assetCode || null,
        name,
        category: body.category || null,
        room: body.room || null,
        unitName: body.unitName || null,
        unitValue: body.unitValue ? Number(body.unitValue) : null,
        notes: body.notes || null,
      },
    });
    if (initialQuantity > 0) {
      await tx.assetTransaction.create({
        data: {
          assetId: created.id,
          type: "RECEIPT",
          quantity: initialQuantity,
          txnDate: new Date(),
          notes: "Số lượng ban đầu khi tạo tài sản",
        },
      });
    }
    return created;
  });

  return NextResponse.json({ item: asset }, { status: 201 });
}
