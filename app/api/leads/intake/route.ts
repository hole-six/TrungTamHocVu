import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreate, canCreateWithOverride, canUpdate } from "@/lib/server/role-matrix";
import { getValidBranchIdForCreation } from "@/lib/branch-filter";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { provisionGuardianPortalAccount } from "@/lib/server/guardian-accounts";
import { generateCourseCharge } from "@/lib/server/billing-generation";
import { getVietnamToday } from "@/lib/server/class-rules";

type IntakeMode = "WAITLIST" | "ENROLL_NOW";

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildInterestedCourseNote(courseCode: string | null, courseName: string | null) {
  if (!courseCode && !courseName) return null;
  const prefix = courseCode ? `[${courseCode}] ` : "";
  return `Khóa quan tâm: ${prefix}${courseName ?? ""}`.trim();
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "students");
  const canCreateLead = canCreate("leads", role);
  const canCreateStudent = canCreateWithOverride("students", role, override);
  const canEnrollDirectly = canUpdate("schedule", role) || canCreateStudent;

  if (!canCreateLead && !canCreateStudent) {
    return NextResponse.json({ error: "Bạn không có quyền tạo hồ sơ nhập học." }, { status: 403 });
  }

  const body = await req.json();
  const mode = String(body.mode ?? "ENROLL_NOW").trim() as IntakeMode;
  const existingStudentId = normalizeText(body.existingStudentId);
  const fullName = String(body.fullName ?? "").trim();
  const resolvedFullName = existingStudentId ? fullName || null : fullName;

  if (!resolvedFullName) {
    return NextResponse.json({ error: "Thiếu họ tên học viên." }, { status: 400 });
  }

  const guardianName = normalizeText(body.guardianName);
  const guardianEmail = normalizeText(body.guardianEmail);
  const createPortalAccount = Boolean(body.createPortalAccount);
  const contactPhone = normalizeText(body.contactPhone);
  const studentPhone = normalizeText(body.studentPhone);
  const address = normalizeText(body.address);
  const branchId = await getValidBranchIdForCreation(body.branchId);

  if (!branchId) {
    return NextResponse.json({ error: "Không xác định được cơ sở." }, { status: 400 });
  }

  if (createPortalAccount && mode !== "ENROLL_NOW") {
    return NextResponse.json({ error: "Chỉ nên cấp tài khoản phụ huynh khi đã nhập học và liên kết học viên." }, { status: 400 });
  }

  if (createPortalAccount && !guardianEmail) {
    return NextResponse.json({ error: "Cần email phụ huynh để cấp tài khoản portal." }, { status: 400 });
  }

  if (existingStudentId && createPortalAccount) {
    return NextResponse.json({ error: "Học viên đã có sẵn không cấp portal mới từ intake này." }, { status: 400 });
  }

  const classId = normalizeText(body.classId);
  const courseName = normalizeText(body.courseName);
  const courseCode = normalizeText(body.courseCode);
  const interestedCourseNote = buildInterestedCourseNote(courseCode, courseName);

  if (mode === "ENROLL_NOW" && !classId) {
    return NextResponse.json({ error: "Phải chọn lớp khi nhập học ngay." }, { status: 400 });
  }
  if (mode === "ENROLL_NOW" && !canEnrollDirectly) {
    return NextResponse.json({ error: "Bạn chưa có quyền ghi danh học viên vào lớp." }, { status: 403 });
  }

  const existingStudent = existingStudentId
    ? await prisma.student.findFirst({
        where: { id: existingStudentId, branchId },
        include: {
          guardians: {
            where: { isPrimary: true },
            include: { guardian: true },
            take: 1,
          },
        },
      })
    : null;

  if (existingStudentId && !existingStudent) {
    return NextResponse.json({ error: "Không tìm thấy học viên đang có trong cơ sở hiện tại." }, { status: 404 });
  }

  if (existingStudent && mode === "ENROLL_NOW" && classId) {
    const duplicateEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: existingStudent.id,
        classId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
      },
      select: { id: true },
    });
    if (duplicateEnrollment) {
      return NextResponse.json({ error: "Học viên này đã có hoặc đang chờ enrollment ở lớp đã chọn." }, { status: 409 });
    }
  }

  const selectedClass = classId
    ? await prisma.class.findFirst({
        where: {
          id: classId,
          branchId,
          ...(mode === "ENROLL_NOW" ? { status: "ACTIVE" } : {}),
        },
        include: { course: true },
      })
    : null;

  if (classId && !selectedClass) {
    return NextResponse.json({ error: "Lớp đã chọn không tồn tại hoặc không thuộc cơ sở hiện tại." }, { status: 404 });
  }

  const leadCode = normalizeText(body.leadCode) ?? `LEAD${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const studentCode = normalizeText(body.studentCode) ?? leadCode.replace(/^LEAD/i, "HV");

  const existingLeadCode = await prisma.lead.findUnique({ where: { leadCode } });
  if (existingLeadCode) {
    return NextResponse.json({ error: "Mã lead đã tồn tại." }, { status: 409 });
  }

  if (mode === "ENROLL_NOW" && !existingStudent) {
    const existingStudentCode = await prisma.student.findUnique({ where: { studentCode } });
    if (existingStudentCode) {
      return NextResponse.json({ error: "Mã học viên đã tồn tại." }, { status: 409 });
    }
  }

  const meetDate = normalizeDate(body.meetDate) ?? getVietnamToday();
  const expectedStartDate = normalizeDate(body.expectedStartDate);
  const dob = normalizeDate(body.dob);
  const enrollDate = normalizeDate(body.enrollDate) ?? getVietnamToday();
  const notes = normalizeText(body.notes);
  const initialAssessment = normalizeText(body.initialAssessment);
  const source = normalizeText(body.source);
  const guardianRelation = normalizeText(body.guardianRelation);
  const scholarshipPercent = body.scholarshipPercent !== undefined && body.scholarshipPercent !== "" ? Number(body.scholarshipPercent) : null;
  const scholarshipReason = normalizeText(body.scholarshipReason);

  if (scholarshipPercent !== null && (!Number.isFinite(scholarshipPercent) || scholarshipPercent < 0 || scholarshipPercent > 100)) {
    return NextResponse.json({ error: "Phần trăm học bổng không hợp lệ (0-100)." }, { status: 400 });
  }

  const duplicateStudentWhere = existingStudent
    ? null
    : dob
      ? { branchId, fullName: resolvedFullName, dob }
      : studentPhone ?? contactPhone
        ? { branchId, fullName: resolvedFullName, phone: studentPhone ?? contactPhone }
        : null;

  const duplicateStudent = duplicateStudentWhere
    ? await prisma.student.findFirst({
        where: duplicateStudentWhere,
        select: { id: true, fullName: true, studentCode: true },
      })
    : null;

  if (duplicateStudent) {
    return NextResponse.json(
      {
        error: `Đã có học viên trùng dữ liệu cơ bản trong hệ thống: ${duplicateStudent.fullName} (${duplicateStudent.studentCode}).`,
      },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    let guardian = existingStudent?.guardians[0]?.guardian
      ? existingStudent.guardians[0].guardian
      : contactPhone
        ? await tx.guardian.findFirst({ where: { phone: contactPhone } })
        : null;

    if (guardian) {
      guardian = await tx.guardian.update({
        where: { id: guardian.id },
        data: {
          fullName: guardianName ?? guardian.fullName,
          phone: contactPhone ?? guardian.phone,
          address: address ?? guardian.address,
          notes: notes ?? guardian.notes,
        },
      });
    } else {
      guardian = await tx.guardian.create({
        data: {
          fullName: guardianName ?? "Chưa rõ",
          phone: contactPhone,
          address,
          notes,
        },
      });
    }

    const lead = await tx.lead.create({
      data: {
        branchId,
        leadCode,
        fullName: existingStudent?.fullName ?? resolvedFullName,
        gender: normalizeText(body.gender),
        dob,
        guardianId: guardian.id,
        phone: contactPhone,
        address,
        meetDate,
        interestedClassId: selectedClass?.id ?? null,
        status: mode === "ENROLL_NOW" ? "ENROLLED" : "QUALIFIED",
        expectedStartDate,
        actualEnrollDate: mode === "ENROLL_NOW" ? enrollDate : null,
        source,
        facebookParentName: normalizeText(body.facebookParentName),
        facebookLink: normalizeText(body.facebookLink),
        initialAssessment,
        notes,
        notes2: interestedCourseNote,
      },
    });

    if (mode === "WAITLIST") {
      return {
        mode,
        leadId: lead.id,
        studentId: null as string | null,
        enrollmentId: null as string | null,
        guardianPortal: null as null | { email: string; tempPassword: string },
      };
    }

    const student = existingStudent
      ? await tx.student.update({
          where: { id: existingStudent.id },
          data: {
            phone: studentPhone ?? contactPhone ?? existingStudent.phone,
            address: address ?? existingStudent.address,
            notes: notes ?? existingStudent.notes,
            evaluation: initialAssessment ?? existingStudent.evaluation,
            referredBy: source ?? existingStudent.referredBy,
          },
        })
      : await tx.student.create({
          data: {
            branchId,
            studentCode,
            fullName: resolvedFullName,
            leadId: lead.id,
            gender: normalizeText(body.gender),
            dob,
            phone: studentPhone ?? contactPhone,
            address,
            enrollDate,
            referredBy: source,
            notes,
            evaluation: initialAssessment,
            status: "ACTIVE",
          },
        });

    if (!existingStudent) {
      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relation: guardianRelation,
          isPrimary: true,
        },
      });
    }

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: student.id,
        classId: selectedClass!.id,
        status: "ACTIVE",
        enrollDate,
        notes: notes ?? interestedCourseNote,
      },
    });

    await tx.enrollmentStatusHistory.create({
      data: {
        studentId: student.id,
        enrollmentId: enrollment.id,
        toStatus: "ACTIVE",
        changedById: user.id,
        reason: existingStudent ? "Ghi danh thêm lớp từ wizard" : "Nhập học nhanh từ wizard",
      },
    });

    if (scholarshipPercent !== null && scholarshipPercent > 0) {
      await tx.scholarship.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          percentage: scholarshipPercent / 100,
          reason: scholarshipReason,
          effectiveFrom: enrollDate,
        },
      });
    }

    let guardianPortal: null | { email: string; tempPassword: string } = null;
    if (createPortalAccount && guardianEmail) {
      const provisioned = await provisionGuardianPortalAccount(tx, guardian.id, guardianEmail);
      guardianPortal = {
        email: provisioned.account.email,
        tempPassword: provisioned.tempPassword,
      };
      await tx.auditLog.create({
        data: {
          userId: user.id,
          branchId,
          action: provisioned.action,
          entityType: "Guardian",
          entityId: guardian.id,
          after: JSON.stringify({ email: provisioned.account.email, source: "enrollment_intake" }),
        },
      });
    }

    await syncStudentDerivedFields(student.id, tx);

    return {
      mode,
      leadId: lead.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      guardianPortal,
    };
  });

  if (result.studentId) {
    await syncStudentDerivedFields(result.studentId);
  }

  // Ghi danh xong là thu học phí trọn khóa ngay (xem generateCourseCharge) — không
  // đợi tới kỳ thu tháng sau. Không chặn luồng intake nếu sinh học phí lỗi (vd lớp
  // chưa cấu hình tổng buổi), chỉ ghi log để nhân sự tự xử lý sau.
  let billingWarning: string | undefined;
  if (result.enrollmentId) {
    const chargeResult = await generateCourseCharge(result.enrollmentId);
    if ("error" in chargeResult) billingWarning = chargeResult.error;
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId,
      action: "create",
      entityType: "EnrollmentIntake",
      entityId: result.studentId ?? result.leadId,
      after: JSON.stringify(result),
      reason: mode === "ENROLL_NOW" ? "Nhập học và ghi danh ngay" : "Tạo hồ sơ chờ xếp lớp",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      mode: result.mode,
      leadId: result.leadId,
      studentId: result.studentId,
      guardianPortal: result.guardianPortal,
      billingWarning,
      redirectTo: result.studentId ? `/students/${result.studentId}?from=intake&focus=tuition` : `/leads/${result.leadId}?from=intake`,
    },
    { status: 201 },
  );
}
