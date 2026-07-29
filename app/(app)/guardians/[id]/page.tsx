import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GuardianEditForm from "@/components/guardians/GuardianEditForm";
import { LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";

export default async function GuardianDetailPage({ params }: { params: { id: string } }) {
  const guardian = await prisma.guardian.findUnique({
    where: { id: params.id },
    include: {
      leads: { orderBy: { createdAt: "desc" } },
      students: { include: { student: true } },
    },
  });
  if (!guardian) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/guardians" className="text-sm text-primary">
          ← Quay lại Phụ huynh
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{guardian.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">{guardian.phone ?? "Chưa có SĐT"}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Lead liên quan</h2>
            <div className="mt-3 space-y-2">
              {guardian.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
                  <Link href={`/leads/${l.id}`} className="text-primary">
                    {l.fullName}
                  </Link>
                  <span className="badge bg-ink/5 text-ink-muted80">{LEAD_STATUS_LABEL[l.status as keyof typeof LEAD_STATUS_LABEL] ?? l.status}</span>
                </div>
              ))}
              {guardian.leads.length === 0 && <p className="text-sm text-ink-muted48">Chưa có lead nào.</p>}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Học viên liên quan</h2>
            <div className="mt-3 space-y-2">
              {guardian.students.map((sg) => (
                <div key={sg.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
                  <Link href={`/students/${sg.student.id}`} className="text-primary">
                    {sg.student.fullName}
                  </Link>
                  <span className="text-ink-muted48">{sg.relation ?? (sg.isPrimary ? "Chính" : "Phụ")}</span>
                </div>
              ))}
              {guardian.students.length === 0 && <p className="text-sm text-ink-muted48">Chưa liên kết học viên nào.</p>}
            </div>
          </div>
        </div>

        <GuardianEditForm
          guardianId={guardian.id}
          initial={{
            fullName: guardian.fullName,
            phone: guardian.phone ?? "",
            address: guardian.address ?? "",
            notes: guardian.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
