import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PortalOverviewPage() {
  const session = await getSession();
  if (!session?.guardianId) redirect("/login");

  const guardian = await prisma.guardian.findUnique({
    where: { id: session.guardianId },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: { include: { class: true } },
              charges: { include: { allocations: true } },
            },
          },
        },
      },
      user: true,
    },
  });

  const children = guardian?.students ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Xin chào, {guardian?.fullName ?? session.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">Chọn con để xem học phí, nhật ký lớp học và lịch học.</p>
        {guardian?.user?.email ? <p className="mt-1 text-xs text-ink-muted48">Tài khoản nhận thông báo: {guardian.user.email}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children.map(({ student, relation, isPrimary }) => {
          const activeEnrollment = student.enrollments.find((e) => e.status === "ACTIVE");
          const outstanding =
            student.charges.reduce((sum, charge) => sum + charge.totalAmount, 0) -
            student.charges.reduce(
              (sum, charge) => sum + charge.allocations.reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0),
              0
            );
          return (
            <Link
              key={student.id}
              href={`/portal/${student.id}`}
              className="card-sm flex items-center justify-between transition-shadow hover:shadow-md"
            >
              <div>
                <p className="font-medium text-ink">{student.fullName}</p>
                <p className="mt-1 text-xs text-ink-muted48">
                  {relation ?? (isPrimary ? "Phụ huynh chính" : "Phụ huynh phụ")} · {student.studentCode}
                </p>
                {activeEnrollment && (
                  <p className="mt-1 text-xs text-primary">Đang học: {activeEnrollment.class.className}</p>
                )}
                <p className={`mt-1 text-xs ${outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {outstanding > 0 ? `Còn nợ ${outstanding.toLocaleString("vi-VN")}đ` : "Đã đóng đủ"}
                </p>
              </div>
              <span className="text-primary">→</span>
            </Link>
          );
        })}
        {children.length === 0 && (
          <div className="card-sm text-sm text-ink-muted48">
            Chưa có học viên nào được liên kết với tài khoản này. Liên hệ trung tâm để được hỗ trợ.
          </div>
        )}
      </div>
    </div>
  );
}
