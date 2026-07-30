import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import EnrollmentIntakeWizard from "@/components/admissions/EnrollmentIntakeWizard";

export default async function EnrollmentIntakePage() {
  const user = await getCurrentUser();
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};

  const [courses, classes] = await Promise.all([
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
        activeEnrollments: item._count.enrollments,
        startDate: item.startDate?.toISOString() ?? null,
      }))}
    />
  );
}
