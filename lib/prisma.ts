import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Một số file dùng `import prisma from "@/lib/prisma"` (default) thay vì named
// export — giữ cả hai để không phải sửa lại các chỗ đã viết theo kiểu import khác.
export default prisma;
