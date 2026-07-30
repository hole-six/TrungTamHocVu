"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";

type LeadFormProps = {
  initialData?: any;
  leadId?: string;
};

const LEAD_STATUS_OPTIONS = LEAD_STATUSES.map((value) => ({
  value,
  label: LEAD_STATUS_LABEL[value],
}));

export default function LeadForm({ initialData, leadId }: LeadFormProps) {
  const router = useRouter();
  const isEdit = !!leadId;

  const sections: FormSection[] = [
    {
      title: "Thông tin học viên tiềm năng",
      description: "Thông tin cơ bản của học viên",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      fields: [
        {
          name: "fullName",
          label: "Họ và tên",
          type: "text",
          placeholder: "Nguyễn Văn A",
          required: true,
          defaultValue: initialData?.fullName || "",
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
        },
        {
          name: "leadCode",
          label: "Mã lead",
          type: "text",
          placeholder: "LD001 (để trống sẽ tự sinh)",
          defaultValue: initialData?.leadCode || "",
          disabled: isEdit,
          description: isEdit ? "Mã lead không thể thay đổi" : "Để trống để hệ thống tự động sinh mã",
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
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Thông tin phụ huynh",
      description: "Thông tin liên hệ và phụ huynh",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      fields: [
        {
          name: "guardianName",
          label: "Tên phụ huynh",
          type: "text",
          placeholder: "Họ tên bố/mẹ",
          defaultValue: initialData?.guardianName || initialData?.guardian?.fullName || "",
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
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
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          ),
        },
        {
          name: "address",
          label: "Địa chỉ",
          type: "textarea",
          placeholder: "Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố",
          defaultValue: initialData?.address || "",
          rows: 2,
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ),
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
      ],
    },
    {
      title: "Thông tin tuyển sinh",
      description: "Chi tiết về quá trình tuyển sinh",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      collapsible: true,
      fields: [
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          defaultValue: initialData?.status || "NEW",
          required: true,
          options: LEAD_STATUS_OPTIONS,
        },
        {
          name: "meetDate",
          label: "Ngày gặp/liên hệ",
          type: "date",
          defaultValue: initialData?.meetDate
            ? new Date(initialData.meetDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          description: "Ngày lần đầu gặp hoặc liên hệ với lead",
        },
        {
          name: "source",
          label: "Nguồn lead",
          type: "text",
          placeholder: "Facebook, giới thiệu, website...",
          defaultValue: initialData?.source || "",
          description: "Kênh mà lead biết đến trung tâm",
        },
        {
          name: "initialAssessment",
          label: "Đánh giá học lực ban đầu",
          type: "textarea",
          placeholder: "VD: Mất gốc toán, Khá Anh văn, Trung bình...",
          defaultValue: initialData?.initialAssessment || "",
          rows: 2,
        },
        {
          name: "expectedStartDate",
          label: "Ngày dự kiến nhập học",
          type: "date",
          defaultValue: initialData?.expectedStartDate ? new Date(initialData.expectedStartDate).toISOString().split("T")[0] : "",
        },
      ],
    },
    {
      title: "Ghi chú",
      description: "Thông tin bổ sung",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      collapsible: true,
      defaultCollapsed: true,
      fields: [
        {
          name: "notes",
          label: "Ghi chú",
          type: "textarea",
          placeholder: "Ghi chú về tính cách, sở thích, nhu cầu học tập...",
          defaultValue: initialData?.notes || "",
          rows: 4,
        },
      ],
    },
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    const url = isEdit ? `/api/leads/${leadId}` : "/api/leads";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
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
    if (isEdit) {
      router.push(`/leads/${leadId}`);
    } else {
      router.push("/leads");
    }
  };

  return (
    <SmartForm
      sections={sections}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitLabel={isEdit ? "Cập nhật" : "Tạo lead"}
      cancelLabel="Hủy"
    />
  );
}
