// Cấp quyền THU TIỀN HỌC PHÍ cho Giáo vụ.
//
// Hệ thống có 2 tầng quyền: ma trận vai trò (lib/server/role-matrix.ts) quyết định giao
// diện hiện nút, còn bảng Permission trong CSDL quyết định API có cho đi qua không.
// Mở một tầng mà quên tầng kia thì nút hiện ra nhưng bấm vào báo 403.
// Chạy: npx tsx scripts/grant_registrar_receive_payment.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({ where: { code: "REGISTRAR" } });
  if (!role) throw new Error("Không tìm thấy vai trò REGISTRAR");

  // CHỈ phạm vi "branch" — giáo vụ làm việc trong chi nhánh của mình, không được nhìn
  // học phí toàn hệ thống (quyền tuition.view.all dành cho ban giám đốc/kế toán tổng).
  const perms = await prisma.permission.findMany({
    where: { resource: "tuition", action: { in: ["view", "receive_payment"] }, scope: "branch" },
  });
  if (perms.length === 0) throw new Error("Không tìm thấy quyền tuition trong CSDL");

  let added = 0;
  for (const permission of perms) {
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: permission.id },
    });
    if (existing) continue;
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    console.log("  + " + permission.key);
    added += 1;
  }
  // Thu hồi quyền xem toàn hệ thống nếu lỡ được cấp — giáo vụ chỉ ở phạm vi chi nhánh.
  const viewAll = await prisma.permission.findFirst({ where: { key: "tuition.view.all" } });
  if (viewAll) {
    const removed = await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: viewAll.id } });
    if (removed.count > 0) console.log("  - tuition.view.all (thu hồi: vượt phạm vi chi nhánh)");
  }
  console.log(added > 0 ? `Đã cấp ${added} quyền cho Giáo vụ.` : "Giáo vụ đã có sẵn các quyền này.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
