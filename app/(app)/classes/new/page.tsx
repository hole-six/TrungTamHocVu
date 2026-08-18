import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getHolidayDateSet } from "@/lib/server/holidays";
import NewClassForm from "@/components/classes/NewClassForm";

export default async function NewClassPage() {
  const activeBranchId = await getCurrentBranchId();
  const branchWhere = activeBranchId ? { branchId: activeBranchId } : {};
  const [courses, employees, holidayDates, classOptions] = await Promise.all([
    prisma.course.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { ...branchWhere, workStatus: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, shortName: true, position: true },
    }),
    activeBranchId ? getHolidayDateSet(activeBranchId) : Promise.resolve(new Set<string>()),
    prisma.class.findMany({
      where: { ...branchWhere, status: "ACTIVE", isRemedial: false },
      orderBy: [{ className: "asc" }, { classCode: "asc" }],
      select: { id: true, classCode: true, className: true },
      take: 120,
    }),
  ]);
  return <NewClassForm courses={courses} employees={employees} holidayDates={[...holidayDates]} classOptions={classOptions} />;
}
