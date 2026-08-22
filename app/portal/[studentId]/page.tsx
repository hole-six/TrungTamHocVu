import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { formatVnd } from "@/lib/export-utils";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  MAKEUP: "Học bù",
};

export default async function PortalStudentPage({ params }: { params: { studentId: string } }) {
  const session = await getSession();
  if (!session?.guardianId) redirect("/login");

  // Chốt quyền truy cập TRƯỚC khi lấy bất kỳ dữ liệu nào — phụ huynh chỉ được
  // xem đúng con của mình, xác nhận qua StudentGuardian chứ không tin studentId
  // trên URL. Đây là chỗ dễ rò dữ liệu nhất của cả tính năng nên kiểm tra riêng,
  // không gộp chung với query lấy dữ liệu hiển thị bên dưới.
  const link = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId: params.studentId, guardianId: session.guardianId } },
    include: {
      guardian: {
        include: {
          user: true,
          students: {
            where: { studentId: params.studentId },
            include: { student: true },
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!link) notFound();

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: {
      enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
      charges: { include: { billingPeriod: true }, orderBy: { createdAt: "desc" }, take: 12 },
      payments: { orderBy: { paidDate: "desc" }, take: 12 },
      guardians: {
        include: { guardian: { include: { user: true } } },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!student) notFound();

  const [outstanding, attendances, journalEntries] = await Promise.all([
    computeOutstandingBalance(student.id),
    prisma.studentAttendance.findMany({
      where: { studentId: student.id },
      include: { session: { include: { class: true } } },
      orderBy: { session: { sessionDate: "desc" } },
      take: 20,
    }),
    // Chỉ lấy nhật ký ĐÃ CHỐT (publishedAt != null) — journal nháp giáo viên đang
    // sửa dở không cho phụ huynh xem, đúng ý nghĩa "publishedAt" trong schema.
    prisma.journalEntry.findMany({
      where: { studentId: student.id, journal: { publishedAt: { not: null } } },
      include: { journal: { include: { session: { include: { class: true } } } }, scores: true },
      orderBy: { journal: { session: { sessionDate: "desc" } } },
      take: 20,
    }),
  ]);
  const primaryGuardian = student.guardians.find((item) => item.isPrimary)?.guardian ?? student.guardians[0]?.guardian ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-sm text-primary">
          ← Quay lại danh sách con
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{student.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">
          Mã HV: {student.studentCode}
          {student.enrollments[0] && <> · Lớp: {student.enrollments[0].class.className}</>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Phụ huynh đang đăng nhập</p>
          <p className="mt-1 font-medium text-ink">{link.guardian.fullName}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            Vai trò với học viên: {link.relation ?? (link.isPrimary ? "Phụ huynh chính" : "Phụ huynh phụ")}
          </p>
          <p className="mt-1 text-xs text-ink-muted48">
            Tài khoản nhận thông báo: {link.guardian.user?.email ?? "Chưa có email portal"}
          </p>
        </div>
        <div className="card-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Người nhận hóa đơn chính</p>
          <p className="mt-1 font-medium text-ink">{primaryGuardian?.fullName ?? "Chưa gắn phụ huynh chính"}</p>
          <p className="mt-1 text-xs text-ink-muted48">
            {primaryGuardian?.phone ?? "Chưa có SĐT"}{primaryGuardian?.user?.email ? ` · ${primaryGuardian.user.email}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted48">
            {primaryGuardian?.id === link.guardian.id ? "Đây là tài khoản đang nhận nhắc phí/chứng từ." : "Trung tâm đang chốt hóa đơn về phụ huynh chính này."}
          </p>
        </div>
      </div>

      <div className="card-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Công nợ học phí</p>
        <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">{formatVnd(outstanding)}</p>
        <p className="mt-1 text-xs text-ink-muted48">{outstanding > 0 ? "Còn phải đóng" : "Đã đóng đủ"}</p>
      </div>

      <div className="card overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="font-display text-lg font-semibold tracking-tight">Học phí theo kỳ</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Kỳ</th>
              <th className="py-2 font-medium">Số buổi</th>
              <th className="py-2 font-medium">Học phí</th>
              <th className="py-2 font-medium">Giáo trình</th>
              <th className="py-2 font-medium">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {student.charges.map((c) => (
              <tr key={c.id} className="border-b border-hairline last:border-0">
                <td className="py-2">{c.billingPeriod.periodName}</td>
                <td className="py-2 text-ink-muted80">{c.sessionCount}</td>
                <td className="py-2 text-ink-muted80">{formatVnd(c.tuitionAmount)}</td>
                <td className="py-2 text-ink-muted80">{formatVnd(c.materialsAmount)}</td>
                <td className="py-2 font-medium">{formatVnd(c.totalAmount)}</td>
              </tr>
            ))}
            {student.charges.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-muted48">
                  Chưa có kỳ học phí nào được ghi nhận.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử thanh toán</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Ngày</th>
              <th className="py-2 font-medium">Số tiền</th>
              <th className="py-2 font-medium">Hình thức</th>
            </tr>
          </thead>
          <tbody>
            {student.payments.map((p) => (
              <tr key={p.id} className="border-b border-hairline last:border-0">
                <td className="py-2">{formatDate(p.paidDate)}</td>
                <td className="py-2 font-medium">{formatVnd(p.amount)}</td>
                <td className="py-2 text-ink-muted80">{p.method ?? "—"}</td>
              </tr>
            ))}
            {student.payments.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-ink-muted48">
                  Chưa có khoản thanh toán nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="font-display text-lg font-semibold tracking-tight">Nhật ký lớp học</h2>
        <div className="mt-3 space-y-3">
          {journalEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-hairline p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {formatDate(entry.journal.session.sessionDate)} · {entry.journal.session.class.className}
                </p>
                {entry.journal.unitLesson && <span className="text-xs text-ink-muted48">{entry.journal.unitLesson}</span>}
              </div>
              {entry.homeworkStatus && <p className="mt-1 text-xs text-ink-muted80">Bài tập về nhà: {entry.homeworkStatus}</p>}
              {entry.comment && <p className="mt-1 text-xs text-ink-muted80">Nhận xét: {entry.comment}</p>}
              {entry.scores.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.scores.map((s) => (
                    <span key={s.id} className="badge bg-primary/5 text-primary">
                      {s.label}: {s.score ?? "—"}/{s.maxScore}
                    </span>
                  ))}
                </div>
              )}
              {entry.journal.homeworkNote && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 whitespace-pre-line">
                  {entry.journal.homeworkNote}
                </div>
              )}
            </div>
          ))}
          {journalEntries.length === 0 && <p className="text-sm text-ink-muted48">Chưa có nhật ký lớp học nào.</p>}
        </div>
      </div>

      <div className="card overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="font-display text-lg font-semibold tracking-tight">Lịch học & điểm danh</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Ngày</th>
              <th className="py-2 font-medium">Lớp</th>
              <th className="py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {attendances.map((a) => (
              <tr key={a.id} className="border-b border-hairline last:border-0">
                <td className="py-2">{formatDate(a.session.sessionDate)}</td>
                <td className="py-2 text-ink-muted80">{a.session.class.className}</td>
                <td className="py-2">
                  <span
                    className={`badge ${a.status === "PRESENT" ? "bg-emerald-50 text-emerald-700" : a.status === "ABSENT" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {ATTENDANCE_LABEL[a.status] ?? a.status}
                  </span>
                </td>
              </tr>
            ))}
            {attendances.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-ink-muted48">
                  Chưa có dữ liệu điểm danh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
