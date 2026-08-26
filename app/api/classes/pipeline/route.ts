import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";

// Toàn bộ lớp ACTIVE, không phải bổ trợ, cùng chi nhánh — dashboard "Ngăn xếp chuyển
// tiếp" ở /classes chỉ lấy tối đa 8 dòng từ đúng trang đang xem (không phải toàn bộ),
// nên modal sắp xếp cần nguồn riêng lấy ĐỦ dữ liệu để gán nextClassId cho từng ngăn xếp.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const activeBranchId = await getCurrentBranchId();
  const classes = await prisma.class.findMany({
    where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), status: "ACTIVE", isRemedial: false },
    select: {
      id: true,
      classCode: true,
      className: true,
      classGroup: true,
      nextClassId: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: [{ classGroup: "asc" }, { classCode: "asc" }],
  });

  return NextResponse.json({
    items: classes.map((c) => ({
      id: c.id,
      classCode: c.classCode,
      className: c.className,
      classGroup: c.classGroup,
      nextClassId: c.nextClassId,
      activeEnrollments: c._count.enrollments,
    })),
  });
}

// Gán nextClassId hàng loạt từ modal "Sắp xếp ngăn xếp" — tái dùng ĐÚNG validate của
// PATCH /api/classes/[id] (cùng branch, ACTIVE, không phải bổ trợ, không tự trỏ chính
// nó) cho từng dòng, cộng thêm việc riêng của thao tác hàng loạt: phát hiện vòng lặp
// (A→B→A) sau khi áp toàn bộ thay đổi nháp — rủi ro này không xảy ra khi sửa từng lớp
// riêng lẻ (route PATCH /api/classes/[id] cũ) nhưng dễ xảy ra khi sửa nhiều lớp cùng
// lúc ở đây.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa lớp" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: { classId: string; nextClassId: string | null }[] = Array.isArray(body.updates)
    ? body.updates
        .map((item: { classId?: string; nextClassId?: string | null }) => ({
          classId: String(item.classId ?? "").trim(),
          nextClassId: item.nextClassId ? String(item.nextClassId).trim() : null,
        }))
        .filter((item: { classId: string }) => item.classId)
    : [];
  if (updates.length === 0) return NextResponse.json({ error: "Không có thay đổi nào để lưu." }, { status: 400 });

  const activeBranchId = await getCurrentBranchId();
  const classIds = updates.map((u) => u.classId);
  const involvedClassIds = new Set([...classIds, ...updates.map((u) => u.nextClassId).filter((id): id is string => !!id)]);
  const involvedClasses = await prisma.class.findMany({
    where: { id: { in: [...involvedClassIds] } },
    select: { id: true, branchId: true, isRemedial: true, status: true, nextClassId: true },
  });
  const classById = new Map(involvedClasses.map((c) => [c.id, c]));

  for (const update of updates) {
    const current = classById.get(update.classId);
    if (!current) return NextResponse.json({ error: `Không tìm thấy lớp ${update.classId}.` }, { status: 404 });
    if (activeBranchId && current.branchId !== activeBranchId) {
      return NextResponse.json({ error: "Chỉ được sửa lớp trong chi nhánh đang xem." }, { status: 403 });
    }
    if (update.nextClassId === update.classId) {
      return NextResponse.json({ error: "Lớp tiếp theo không được là chính lớp hiện tại." }, { status: 400 });
    }
    if (update.nextClassId) {
      const next = classById.get(update.nextClassId);
      if (!next || next.branchId !== current.branchId || next.isRemedial || next.status !== "ACTIVE") {
        return NextResponse.json({ error: "Lớp tiếp theo không hợp lệ hoặc không cùng cơ sở." }, { status: 400 });
      }
    }
  }

  // Duyệt chuỗi nextClassId SAU KHI áp toàn bộ thay đổi nháp (không chỉ từng dòng riêng
  // lẻ) để phát hiện vòng lặp — dựng map nextClassId đầy đủ (đè bằng updates), rồi đi
  // từ mỗi lớp trong updates, nếu quay lại chính nó trong giới hạn hợp lý thì chặn.
  const nextClassIdMap = new Map(involvedClasses.map((c) => [c.id, c.nextClassId]));
  for (const update of updates) nextClassIdMap.set(update.classId, update.nextClassId);

  for (const update of updates) {
    let cursor: string | null = update.nextClassId;
    let hops = 0;
    while (cursor && hops < involvedClassIds.size + 1) {
      if (cursor === update.classId) {
        return NextResponse.json({ error: "Các thay đổi này tạo thành vòng lặp giữa các lớp — kiểm tra lại trước khi lưu." }, { status: 400 });
      }
      cursor = nextClassIdMap.get(cursor) ?? null;
      hops += 1;
    }
  }

  await prisma.$transaction(updates.map((update) => prisma.class.update({ where: { id: update.classId }, data: { nextClassId: update.nextClassId } })));

  return NextResponse.json({ updated: updates.length });
}
