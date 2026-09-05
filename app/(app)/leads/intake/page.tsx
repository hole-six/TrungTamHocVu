import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import EnrollmentIntakeWizard from "@/components/admissions/EnrollmentIntakeWizard";

export default async function EnrollmentIntakePage() {
  const activeBranchId = await getCurrentBranchId();
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};

  const [courses, classes, students] = await Promise.all([
    prisma.course.findMany({
      where: { ...branchWhere, isActive: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        tuitionPerSession: true,
        sessionsPerWeek: true,
      },
    }),
    prisma.class.findMany({
      where: { ...branchWhere, status: "ACTIVE" },
      orderBy: [{ startDate: "asc" }, { className: "asc" }],
      select: {
        id: true,
        classCode: true,
        className: true,
        courseId: true,
        tuitionPerSession: true,
        sessionsPerWeek: true,
        totalSessions: true,
        startDate: true,
        course: {
          select: {
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    }),
    prisma.student.findMany({
      where: { ...branchWhere, status: "ACTIVE" },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        studentCode: true,
        phone: true,
        enrollments: {
          where: { status: { in: ["ACTIVE", "PAUSED", "PENDING"] } },
          orderBy: { enrollDate: "desc" },
          take: 3,
          select: {
            class: {
              select: {
                className: true,
                classCode: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <EnrollmentIntakeWizard
      courses={courses}
      classes={classes.map((item) => ({
        id: item.id,
        classCode: item.classCode,
        className: item.className,
        courseId: item.courseId,
        courseName: item.course?.name ?? null,
        courseCode: item.course?.code ?? null,
        tuitionPerSession: item.tuitionPerSession,
        sessionsPerWeek: item.sessionsPerWeek,
        totalSessions: item.totalSessions,
        activeEnrollments: item._count.enrollments,
        startDate: item.startDate?.toISOString() ?? null,
      }))}
      students={students.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        studentCode: item.studentCode,
        phone: item.phone,
        currentClasses: item.enrollments
          .filter((e) => e.class)
          .map((enrollment) => ({
            className: enrollment.class!.className,
            classCode: enrollment.class!.classCode,
          })),
      }))}
    />
  );
}
