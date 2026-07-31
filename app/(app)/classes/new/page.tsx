import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import NewClassForm from "@/components/classes/NewClassForm";

export default async function NewClassPage() {
  const user = await getCurrentUser();
  const branchWhere = user?.branchId ? { branchId: user.branchId } : {};
  const [courses, employees] = await Promise.all([
    prisma.course.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { ...branchWhere, workStatus: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, shortName: true, position: true },
    }),
  ]);
  return <NewClassForm courses={courses} employees={employees} />;
}
