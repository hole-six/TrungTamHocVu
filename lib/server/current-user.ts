import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Người dùng hiện tại kèm branchId thật từ DB — session cookie chỉ mang
// userId/role/fullName, còn branchId cần tra lại vì có thể đổi chi nhánh
// giữa các lần đăng nhập mà không cần cấp lại token.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}
