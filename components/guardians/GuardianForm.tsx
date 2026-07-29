"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";

type GuardianFormProps = {
  initialData?: any;
  guardianId?: string;
};

export default function GuardianForm({ initialData, guardianId }: GuardianFormProps) {
  const router = useRouter();
  const isEdit = !!guardianId;

  const sections: FormSection[] = [
    {
      title: "Thông tin cơ bản",
      description: "Thông tin nhận diện của phụ huynh",
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
      ],
    },
    {
      title: "Thông tin liên hệ",
      description: "Địa chỉ và phương thức liên lạc",
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
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
      fields: [
        {
          name: "phone",
          label: "Số điện thoại",
          type: "tel",
          placeholder: "0912345678",
          required: true,
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
          name: "email",
          label: "Email",
          type: "email",
          placeholder: "email@example.com",
          defaultValue: initialData?.email || "",
          validation: (value) => {
            if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              return "Email không hợp lệ";
            }
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          ),
        },
        {
          name: "address",
          label: "Địa chỉ",
          type: "textarea",
          placeholder: "Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố",
          defaultValue: initialData?.address || "",
          rows: 3,
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Thông tin bổ sung",
      description: "Nghề nghiệp và thông tin khác",
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
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      collapsible: true,
      fields: [
        {
          name: "occupation",
          label: "Nghề nghiệp",
          type: "text",
          placeholder: "VD: Giáo viên, Bác sĩ, Kỹ sư...",
          defaultValue: initialData?.occupation || "",
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          ),
        },
        {
          name: "workplace",
          label: "Nơi làm việc",
          type: "text",
          placeholder: "Tên công ty/tổ chức",
          defaultValue: initialData?.workplace || "",
        },
        {
          name: "dob",
          label: "Ngày sinh",
          type: "date",
          defaultValue: initialData?.dob
            ? new Date(initialData.dob).toISOString().split("T")[0]
            : "",
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
      title: "Ghi chú",
      description: "Thông tin thêm về phụ huynh",
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
          placeholder: "Ghi chú về phụ huynh (sở thích, tính cách, mối quan tâm...)",
          defaultValue: initialData?.notes || "",
          rows: 4,
        },
      ],
    },
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    const url = isEdit ? `/api/guardians/${guardianId}` : "/api/guardians";
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
    router.push(`/guardians/${result.item.id}`);
    router.refresh();
  };

  const handleCancel = () => {
    if (isEdit) {
      router.push(`/guardians/${guardianId}`);
    } else {
      router.push("/guardians");
    }
  };

  return (
    <SmartForm
      sections={sections}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitLabel={isEdit ? "Cập nhật" : "Tạo phụ huynh"}
      cancelLabel="Hủy"
    />
  );
}
