"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";
import FormGuide from "@/components/ui/FormGuide";

// Chỉ còn dùng để SỬA hồ sơ lead đã có (từ /leads/[id]/edit) — luồng TẠO MỚI đã gộp
// hẳn về NewLeadDrawer.tsx (đường tạo lead duy nhất, tránh 2 form tạo lệch field
// nhau như trước). Vì vậy form này không còn field "Trạng thái" nữa — đổi trạng thái
// đã có đúng 1 chỗ làm (ô đổi trạng thái ở LeadsTable / LeadStatusPanel), tự áp
// canManuallySetStatus/nextStatuses; sửa hồ sơ ở đây không nên là lối tắt thứ 2 để
// đổi trạng thái vì sẽ bỏ qua validate transition.
type LeadFormProps = {
  initialData?: any;
  leadId: string;
  classes?: Array<{ id: string; classCode: string; className: string }>;
};

const LEAD_FORM_GUIDE_SECTIONS = [
  {
    title: "Form này dùng để làm gì",
    items: [
      "Đây là form sửa hồ sơ lead đã có trong CRM tuyển sinh.",
      "Thông tin ở đây là dữ liệu nền cho toàn bộ luồng sau đó: liên hệ, lịch hẹn, test đầu vào và chuyển đổi sang học viên.",
      "Đổi trạng thái lead không làm ở đây — dùng ô trạng thái trên danh sách hoặc chi tiết lead.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách điền hợp lý",
    items: [
      "Điền rõ thông tin học viên tiềm năng trước, sau đó mới đến phụ huynh và nhu cầu tuyển sinh.",
      "Nếu chưa chắc lớp quan tâm thì có thể để trống, không cần ép chọn quá sớm.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Không nên sửa trùng lặp thông tin chỉ vì khác cách viết tên hoặc chưa kiểm tra số điện thoại.",
      "Ghi chú nên ghi phần giúp người chăm lead tiếp theo hiểu nhanh hoàn cảnh và bước cần làm tiếp.",
    ],
    tone: "warning" as const,
  },
];

export default function LeadForm({ initialData, leadId, classes = [] }: LeadFormProps) {
  const router = useRouter();

  const sections: FormSection[] = [
    {
      title: "Thông tin học viên tiềm năng",
      description: "Thông tin cơ bản của học viên hoặc nhu cầu ban đầu nếu phụ huynh mới để lại đầu mối.",
      fields: [
        {
          name: "fullName",
          label: "Họ và tên",
          type: "text",
          placeholder: "Nguyễn Văn A",
          defaultValue: initialData?.fullName || "",
        },
        {
          name: "leadCode",
          label: "Mã lead",
          type: "text" as const,
          defaultValue: initialData?.leadCode || "",
          disabled: true,
          description: "Mã lead do hệ thống tự sinh.",
        },
        {
          name: "gender",
          label: "Giới tính",
          type: "select",
          defaultValue: initialData?.gender || "",
          options: [
            { value: "MALE", label: "Nam" },
            { value: "FEMALE", label: "Nữ" },
            { value: "OTHER", label: "Khác" },
          ],
        },
        {
          name: "dob",
          label: "Ngày sinh",
          type: "date",
          defaultValue: initialData?.dob ? new Date(initialData.dob).toISOString().split("T")[0] : "",
        },
        {
          name: "currentSchoolGrade",
          label: "Lớp đang học ở trường",
          type: "text",
          placeholder: "VD: Lớp 3",
          defaultValue: initialData?.currentSchoolGrade || "",
        },
      ],
    },
    {
      title: "Thông tin phụ huynh",
      description: "Thông tin liên hệ để CRM và giáo vụ bám sát phụ huynh.",
      fields: [
        {
          name: "guardianName",
          label: "Tên phụ huynh",
          type: "text",
          placeholder: "Họ tên bố/mẹ",
          defaultValue: initialData?.guardianName || initialData?.guardian?.fullName || "",
        },
        {
          name: "phone",
          label: "Số điện thoại",
          type: "tel",
          placeholder: "0912345678",
          defaultValue: initialData?.phone || "",
          validation: (value) => {
            if (value && !/^[0-9]{10,11}$/.test(value)) {
              return "Số điện thoại không hợp lệ (10-11 chữ số)";
            }
          },
        },
        {
          name: "secondaryPhone",
          label: "SĐT thứ 2",
          type: "tel",
          placeholder: "0912345678",
          defaultValue: initialData?.secondaryPhone || "",
        },
        {
          name: "address",
          label: "Địa chỉ",
          type: "textarea",
          placeholder: "Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố",
          defaultValue: initialData?.address || "",
          rows: 2,
        },
        {
          name: "facebookParentName",
          label: "Tên Facebook phụ huynh",
          type: "text",
          placeholder: "Tên hiển thị trên Facebook",
          defaultValue: initialData?.facebookParentName || "",
        },
        {
          name: "facebookLink",
          label: "Link Facebook",
          type: "text",
          placeholder: "https://facebook.com/...",
          defaultValue: initialData?.facebookLink || "",
        },
        {
          name: "zaloContact",
          label: "Zalo phụ huynh",
          type: "text",
          placeholder: "SĐT Zalo hoặc tên Zalo",
          defaultValue: initialData?.zaloContact || "",
        },
      ],
    },
    {
      title: "Thông tin tuyển sinh",
      description: "Cho phép chỉ lưu nhu cầu ban đầu hoặc gắn luôn lớp quan tâm nếu đã biết.",
      collapsible: true,
      fields: [
        {
          name: "meetDate",
          label: "Ngày gặp/liên hệ",
          type: "date",
          defaultValue: initialData?.meetDate ? new Date(initialData.meetDate).toISOString().split("T")[0] : "",
        },
        {
          name: "source",
          label: "Nguồn lead",
          type: "text",
          placeholder: "Facebook, giới thiệu, website...",
          defaultValue: initialData?.source || "",
        },
        {
          name: "initialAssessment",
          label: "Đánh giá học lực ban đầu",
          type: "textarea",
          placeholder: "VD: mất gốc toán, khá tiếng Anh, cần lớp tối...",
          defaultValue: initialData?.initialAssessment || "",
          rows: 2,
        },
        {
          name: "pendingRemedialSessions",
          label: "Số buổi bổ trợ dự kiến (nếu mất gốc)",
          type: "number",
          placeholder: "VD: 4",
          defaultValue: initialData?.pendingRemedialSessions ?? "",
          description: "Sẽ tự cấp đúng số buổi bổ trợ này khi ghi danh lần đầu — không cần sang trang khác nhập.",
        },
        {
          name: "expectedStartDate",
          label: "Ngày dự kiến nhập học",
          type: "date",
          defaultValue: initialData?.expectedStartDate ? new Date(initialData.expectedStartDate).toISOString().split("T")[0] : "",
        },
        {
          name: "interestedClassId",
          label: "Lớp quan tâm",
          type: "select",
          defaultValue: initialData?.interestedClassId || "",
          options: classes.map((item) => ({
            value: item.id,
            label: `[${item.classCode}] ${item.className}`,
          })),
          description: "Có thể để trống nếu đây mới là thông tin ban đầu. Khi phụ huynh đã nhắm lớp thì chọn ở đây để giáo vụ dễ follow.",
        },
      ],
    },
    {
      title: "Ghi chú",
      description: "Thông tin bổ sung cho đội tuyển sinh hoặc giáo vụ.",
      collapsible: true,
      defaultCollapsed: true,
      fields: [
        {
          name: "notes",
          label: "Ghi chú",
          type: "textarea",
          placeholder: "Nhu cầu học, tính cách, điều kiện thời gian, lưu ý phụ huynh...",
          defaultValue: initialData?.notes || "",
          rows: 4,
        },
      ],
    },
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Có lỗi xảy ra");
    }

    const result = await res.json();
    router.push(`/leads/${result.item.id}`);
    router.refresh();
  };

  const handleCancel = () => {
    router.push(`/leads/${leadId}`);
  };

  return (
    <div className="space-y-4">
      <FormGuide
        title="Guide sửa lead"
        summary="Giải thích cách nhập hồ sơ lead chuẩn để CRM, lịch test và chuyển đổi sang học viên chạy mượt."
        sections={LEAD_FORM_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide sửa lead"
      />
      <SmartForm
        sections={sections}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Cập nhật"
        cancelLabel="Hủy"
      />
    </div>
  );
}
