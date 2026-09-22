import type { Prisma } from "@prisma/client";
import { nextStudentCode } from "@/lib/server/student-code";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

export async function ensureStudentFromLead(
  tx: Prisma.TransactionClient,
  leadId: string,
  enrollDate: Date,
) {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    include: { student: true },
  });
  if (!lead) throw new Error("Không tìm thấy data tuyển sinh.");
  if (lead.student) return { lead, student: lead.student, created: false };
  if (lead.status !== "QUALIFIED") {
    throw new Error("Chỉ data đã đạt test mới được gán lớp và chuyển thành học viên.");
  }

  const studentCode = await nextStudentCode(tx);
  const student = await tx.student.create({
    data: {
      branchId: lead.branchId,
      studentCode,
      fullName: lead.fullName,
      leadId: lead.id,
      gender: lead.gender,
      dob: lead.dob,
      phone: lead.phone,
      address: lead.address,
      enrollDate,
      status: "ACTIVE",
    },
  });

  if (lead.guardianId) {
    await tx.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: lead.guardianId,
        relation: lead.guardianRelation || null,
        isPrimary: true,
      },
    });
  }

  if (lead.secondaryGuardianName || lead.secondaryPhone) {
    const existingSecond = lead.secondaryPhone ? await tx.guardian.findFirst({ where: { phone: lead.secondaryPhone } }) : null;
    const second =
      existingSecond ??
      (await tx.guardian.create({
        data: {
          fullName: lead.secondaryGuardianName?.trim() || "Chưa rõ",
          phone: lead.secondaryPhone || null,
        },
      }));
    if (second.id !== lead.guardianId) {
      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: second.id,
          relation: lead.secondaryGuardianRelation || null,
          isPrimary: false,
        },
      });
    }
  }

  await tx.lead.update({
    where: { id: lead.id },
    data: { status: "ENROLLED", actualEnrollDate: enrollDate },
  });
  await syncStudentDerivedFields(student.id, tx);
  return { lead, student, created: true };
}
