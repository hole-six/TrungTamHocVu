import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import NewClassForm from "@/components/classes/NewClassForm";

export default async function NewClassPage() {
  const user = await getCurrentUser();
  const courses = await prisma.course.findMany({
    where: user?.branchId ? { branchId: user.branchId } : {},
    orderBy: { name: "asc" },
  });
  return <NewClassForm courses={courses} />;
}
