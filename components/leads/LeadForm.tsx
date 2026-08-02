"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";
import FormGuide from "@/components/ui/FormGuide";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";

type LeadFormProps = {
  initialData?: any;
  leadId?: string;
  redirectTo?: string;
  classes?: Array<{ id: string; classCode: string; className: string }>;
};

const LEAD_STATUS_OPTIONS = LEAD_STATUSES.map((value) => ({
  value,
  label: LEAD_STATUS_LABEL[value],
}));

const LEAD_FORM_GUIDE_SECTIONS = [
  {
    title: "Form này dùng để làm gì",
    items: [
      "Đây là form gốc để tạo mới hoặc cập nhật một hồ sơ lead trong CRM tuyển sinh.",
      "Thông tin ở đây là dữ liệu nền cho toàn bộ luồng sau đó: liên hệ, lịch hẹn, test đầu vào và chuyển đổi sang học viên.",
      "Nếu nhập chuẩn ngay từ đầu, các bước chăm sóc phía sau sẽ gọn hơn và ít phải sửa lại.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách điền hợp lý",
    items: [
      "Điền rõ thông tin học viên tiềm năng trước, sau đó mới đến phụ huynh và nhu cầu tuyển sinh.",
      "Nếu chưa chắc lớp quan tâm thì có thể để trống, không cần ép chọn quá sớm.",
      "Khi tạo mới và đã chốt lịch test, có thể nhập luôn ngày hẹn test để hệ thống sinh luồng test ban đầu.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Không nên tạo lead trùng chỉ vì khác cách viết tên hoặc chưa kiểm tra số điện thoại.",
      "Trạng thái lead nên phản ánh đúng bước thực tế, không đổi chỉ để làm đẹp dashboard.",
      "Ghi chú nên ghi phần giúp người chăm lead tiếp theo hiểu nhanh hoàn cảnh và bước cần làm tiếp.",
    ],
    tone: "warning" as const,
  },
];

export default function LeadForm({ initialData, leadId, redirectTo, classes = [] }: LeadFormProps) {
  const router = useRouter();
  const isEdit = Boolean(leadId);

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
        ...(isEdit
          ? [
              {
                name: "leadCode",
                label: "Mã lead",
                type: "text" as const,
                defaultValue: initialData?.leadCode || "",
                disabled: true,
                description: "Mã lead do hệ thống tự sinh.",
              },
            ]
          : []),
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
          name: "status",
          label: "Trạng thái",
          type: "select",
          defaultValue: initialData?.status || "NEW",
          options: LEAD_STATUS_OPTIONS,
        },
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
        ...(isEdit
          ? []
          : [
              {
                name: "scheduledTestDate",
                label: "Ngày hẹn test",
                type: "date" as const,
                description: "Nếu đã hẹn ngày test, hệ thống sẽ tự tạo lịch trong danh sách test.",
              },
            ]),
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
    const url = isEdit ? `/api/leads/${leadId}` : "/api/leads";
    const method = isEdit ? "PATCH" : "POST";
    const { scheduledTestDate, ...leadData } = data;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Có lỗi xảy ra");
    }

    const result = await res.json();

    if (!isEdit && scheduledTestDate) {
      await fetch(`/api/leads/${result.item.id}/placement-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: scheduledTestDate }),
      });
    }

    router.push(redirectTo || `/leads/${result.item.id}`);
    router.refresh();
  };

  const handleCancel = () => {
    if (isEdit) {
      router.push(`/leads/${leadId}`);
    } else {
      router.push(redirectTo || "/leads");
    }
  };

  return (
    <div className="space-y-4">
      <FormGuide
        title={isEdit ? "Guide sửa lead" : "Guide tạo lead"}
        summary="Giải thích cách nhập hồ sơ lead chuẩn để CRM, lịch test và chuyển đổi sang học viên chạy mượt."
        sections={LEAD_FORM_GUIDE_SECTIONS}
        position="inline"
        buttonLabel={isEdit ? "Guide sửa lead" : "Guide tạo lead"}
      />
      <SmartForm
        sections={sections}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel={isEdit ? "Cập nhật" : "Tạo lead"}
        cancelLabel="Hủy"
      />
    </div>
  );
}
