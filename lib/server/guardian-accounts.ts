import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/password";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function provisionGuardianPortalAccount(
  tx: Prisma.TransactionClient,
  guardianId: string,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Thiếu email đăng nhập cho phụ huynh.");
  }

  const guardian = await tx.guardian.findUnique({
    where: { id: guardianId },
    include: { user: true },
  });
  if (!guardian) {
    throw new Error("Không tìm thấy phụ huynh.");
  }

  const emailOwner = await tx.user.findUnique({ where: { email: normalizedEmail } });
  if (emailOwner && emailOwner.id !== guardian.user?.id) {
    throw new Error("Email này đã được dùng cho tài khoản khác.");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = hashPassword(tempPassword);

  const account = guardian.user
    ? await tx.user.update({
        where: { id: guardian.user.id },
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: guardian.fullName,
          isActive: true,
        },
      })
    : await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: guardian.fullName,
          role: "user",
          guardianId: guardian.id,
          isActive: true,
        },
      });

  return {
    account,
    tempPassword,
    action: guardian.user ? "guardian.account.reset_password" : "guardian.account.create",
  };
}
