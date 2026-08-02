"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";

type GuardianFormProps = {
  initialData?: any;
  guardianId?: string;
  onSuccess?: (guardianId: string) => void;
  onCancel?: () => void;
};

export default function GuardianForm({ initialData, guardianId, onSuccess, onCancel }: GuardianFormProps) {
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
    if (onSuccess) {
      onSuccess(result.item.id);
    } else {
      router.push(`/guardians/${result.item.id}`);
      router.refresh();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (isEdit) {
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
