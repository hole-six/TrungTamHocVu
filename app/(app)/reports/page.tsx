import { notFound } from "next/navigation";
import ReportsWorkspace from "@/components/reports/ReportsWorkspace";
import PageGuide from "@/components/ui/PageGuide";

const REPORTS_GUIDE_SECTIONS = [
  {
    title: "Màn hình này để làm gì?",
    items: [
      "Xem nhanh các chỉ số vận hành: tuyển sinh, học viên, doanh thu, công nợ.",
      "Chọn kỳ/tháng để so sánh giữa các giai đoạn.",
      "Mọi con số đều suy ra từ dữ liệu gốc — thấy lạ thì mở đúng màn hình nghiệp vụ để đối chiếu.",
    ],
    tone: "info" as const,
  },
];
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("reports", role)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageGuide
        title="Guide báo cáo"
        summary="Cách đọc các số tổng hợp và đối chiếu ngược về dữ liệu gốc."
        sections={REPORTS_GUIDE_SECTIONS}
        buttonLabel="Hướng dẫn"
      />
      <ReportsWorkspace canAccessReports />
    </div>
  );
}
