import Link from "next/link";
import { LEAD_STATUS_LABEL, PLACEMENT_TEST_STATUS_LABEL, PLACEMENT_TEST_BADGE_CLASS, dateUrgency, DATE_URGENCY_CLASS } from "@/lib/server/lead-rules";
import EditableNoteCell from "@/components/leads/EditableNoteCell";
import EditableDateField from "@/components/ui/EditableDateField";
import EditablePlacementTestDateField from "@/components/leads/EditablePlacementTestDateField";
import TestQuickAction from "@/components/leads/TestQuickAction";

type Item = {
  id: string;
  leadCode: string;
  fullName: string;
  gender: string | null;
  dob: Date | null;
  currentSchoolGrade: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  zaloContact: string | null;
  guardian: { fullName: string } | null;
  meetDate: Date | null;
  expectedStartDate: Date | null;
  actualEnrollDate: Date | null;
  status: string;
  interestedClass: { id: string; className: string } | null;
  notes: string | null;
  latestPlacementTest: {
    id: string;
    scheduledDate: Date | null;
    testDate: Date | null;
    status: string;
    suggestedClass: string | null;
    result: string | null;
  } | null;
  duplicatePhoneNames: string[];
  student: { studentCode: string; studentDisplayId: string | null } | null;
};

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}
function calcAge(dob: Date | null) {
  if (!dob) return null;
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

function DateCell({ date }: { date: Date | null }) {
  if (!date) return <span className="text-ink-muted48">—</span>;
  const urgency = dateUrgency(date);
  const label = formatDate(date);
  if (urgency === "none") return <span className="text-ink-muted80">{label}</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm ${DATE_URGENCY_CLASS[urgency]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function TestStatusBadge({ status }: { status: string | null }) {
  const key = status ?? "NONE";
  const label = status ? (PLACEMENT_TEST_STATUS_LABEL[status] ?? status) : "Chưa hẹn";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${PLACEMENT_TEST_BADGE_CLASS[key]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default function TestScheduleTable({
  items,
  total,
  page,
  pageSize,
  searchQuery,
  classOptions,
}: {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  searchQuery: string;
  classOptions: { id: string; className: string }[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto rounded-3xl p-0">
        <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr className="bg-primary/[0.06] text-[11px] font-bold uppercase tracking-wide text-primary/80">
              <th className="sticky left-0 z-20 w-52 whitespace-nowrap bg-[#fbfaf7] px-4 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Học viên</th>
              <th className="whitespace-nowrap px-3 py-3">Ngày gặp</th>
              <th className="whitespace-nowrap px-3 py-3">GT / Tuổi</th>
              <th className="whitespace-nowrap px-3 py-3">Lớp ở trường</th>
              <th className="whitespace-nowrap px-3 py-3 min-w-[170px]">Thông tin gia đình</th>
              <th className="whitespace-nowrap px-3 py-3">Ngày hẹn test</th>
              <th className="whitespace-nowrap px-3 py-3">Ngày đến test</th>
              <th className="whitespace-nowrap px-3 py-3">Tình trạng test</th>
              <th className="whitespace-nowrap px-3 py-3">Lớp dự kiến</th>
              <th className="whitespace-nowrap px-3 py-3">Ngày dự kiến đi học</th>
              <th className="whitespace-nowrap px-3 py-3">Ngày nhập học TT</th>
              <th className="whitespace-nowrap px-3 py-3">Mã số</th>
              <th className="whitespace-nowrap px-3 py-3 min-w-[200px]">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const age = calcAge(item.dob);
              const t = item.latestPlacementTest;
              return (
                <tr key={item.id} className={`align-top transition-colors hover:bg-primary/[0.04] ${idx % 2 === 1 ? "bg-[#fbfaf7]/60" : "bg-white"}`}>
                  <td
                    className={`sticky left-0 z-10 w-52 px-4 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${idx % 2 === 1 ? "bg-[#fbfaf7]" : "bg-white"}`}
                  >
                    <div className="space-y-1 whitespace-nowrap">
                      <div>
                        <Link href={`/leads/${item.id}`} className="font-semibold text-ink hover:text-primary hover:underline">
                          {item.fullName}
                        </Link>
                        {item.duplicatePhoneNames.length > 0 && (
                          <span
                            className="ml-1.5 inline-flex cursor-help items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
                            title={`Trùng SĐT với: ${item.duplicatePhoneNames.join(", ")} — kiểm tra xem có phải anh chị em ruột không`}
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-ink-muted48">{LEAD_STATUS_LABEL[item.status as keyof typeof LEAD_STATUS_LABEL] ?? item.status}</p>
                      <TestQuickAction
                        leadId={item.id}
                        latestTest={t}
                        expectedStartDate={item.expectedStartDate}
                        interestedClassId={item.interestedClass?.id ?? null}
                        classOptions={classOptions}
                      />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-muted80">{formatDate(item.meetDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-muted80">
                    {item.gender === "MALE" ? "Nam" : item.gender === "FEMALE" ? "Nữ" : "—"}
                    {age !== null && <span className="text-ink-muted48"> · {age}t</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-muted80">{item.currentSchoolGrade ?? "—"}</td>
                  <td className="px-3 py-3">
                    <p className="text-ink-muted80">{item.guardian?.fullName ?? "—"}</p>
                    <p className="text-ink-muted48">
                      {item.phone ?? "—"}
                      {item.secondaryPhone && <> · {item.secondaryPhone}</>}
                    </p>
                    {item.zaloContact && <p className="text-ink-muted48">Zalo: {item.zaloContact}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <EditablePlacementTestDateField
                      leadId={item.id}
                      placementTestId={t?.id ?? null}
                      field="scheduledDate"
                      value={t?.scheduledDate ?? null}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <EditablePlacementTestDateField
                      leadId={item.id}
                      placementTestId={t?.id ?? null}
                      field="testDate"
                      value={t?.testDate ?? null}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <TestStatusBadge status={t?.status ?? null} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-muted80">{item.interestedClass?.className ?? t?.suggestedClass ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {t?.status === "PASSED" ? (
                      <EditableDateField endpoint={`/api/leads/${item.id}`} field="expectedStartDate" value={item.expectedStartDate} />
                    ) : (
                      <span title='Chỉ sửa được sau khi tình trạng test là "Đạt"'>
                        <DateCell date={item.expectedStartDate} />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <EditableDateField endpoint={`/api/leads/${item.id}`} field="actualEnrollDate" value={item.actualEnrollDate} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-ink-muted80">{item.student?.studentDisplayId ?? item.student?.studentCode ?? item.leadCode}</td>
                  <td className="px-3 py-3">
                    <EditableNoteCell leadId={item.id} notes={item.notes} />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-ink-muted48">
                  Không có học sinh nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/leads/test-schedule?page=${page - 1}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`} className="btn-ghost">
              ← Trước
            </Link>
          )}
          <span className="text-ink-muted48">
            Trang {page}/{totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/leads/test-schedule?page=${page + 1}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`} className="btn-ghost">
              Sau →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
