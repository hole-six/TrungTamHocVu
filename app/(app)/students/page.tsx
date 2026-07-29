import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import StudentsTable from "./StudentsTable";

const PAGE_SIZE = 20;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; pageSize?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  
  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = Number(searchParams.pageSize ?? PAGE_SIZE);

  const where = {
    ...(user?.branchId ? { branchId: user.branchId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { 
        _count: {
          select: { enrollments: true }
        }
      },
    }),
    prisma.student.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quản lý học viên</h1>
          <p className="page-subtitle">
            Danh sách và thông tin chi tiết của {total} học viên
          </p>
        </div>
        {userRole !== "TEACHER" && (
          <Link href="/students/new" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm học viên
          </Link>
        )}
      </div>

      {/* DataTable */}
      <StudentsTable
        initialData={items}
        total={total}
        page={page}
        pageSize={pageSize}
        userRole={userRole || "TEACHER"}
      />
    </div>
  );
}
