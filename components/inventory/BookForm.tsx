"use client";

import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";

type BookFormProps = {
  initialData?: any;
  bookId?: string;
};

export default function BookForm({ initialData, bookId }: BookFormProps) {
  const router = useRouter();
  const isEdit = !!bookId;

  const sections: FormSection[] = [
    {
      title: "Thông tin sách/giáo trình",
      description: "Chi tiết về sách hoặc giáo trình",
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      fields: [
        {
          name: "name",
          label: "Tên sách/giáo trình",
          type: "text",
          placeholder: "VD: Tiếng Anh 7 - Tập 1",
          required: true,
          defaultValue: initialData?.name || "",
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          ),
        },
        {
          name: "unitPrice",
          label: "Đơn giá (VNĐ)",
          type: "number",
          placeholder: "50000",
          required: true,
          defaultValue: initialData?.unitPrice || "",
          min: 0,
          step: 1000,
          validation: (value) => {
            if (value < 0) {
              return "Đơn giá phải lớn hơn hoặc bằng 0";
            }
          },
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Thông tin chi tiết",
      description: "Mô tả và thông tin bổ sung",
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
      collapsible: true,
      fields: [
        {
          name: "author",
          label: "Tác giả",
          type: "text",
          placeholder: "Tên tác giả",
          defaultValue: initialData?.author || "",
        },
        {
          name: "publisher",
          label: "Nhà xuất bản",
          type: "text",
          placeholder: "Tên nhà xuất bản",
          defaultValue: initialData?.publisher || "",
        },
        {
          name: "isbn",
          label: "ISBN",
          type: "text",
          placeholder: "978-604-0-00000-0",
          defaultValue: initialData?.isbn || "",
        },
        {
          name: "description",
          label: "Mô tả",
          type: "textarea",
          placeholder: "Mô tả chi tiết về sách/giáo trình",
          defaultValue: initialData?.description || "",
          rows: 3,
        },
      ],
    },
  ];

  const handleSubmit = async (data: Record<string, any>) => {
    const url = isEdit ? `/api/inventory/${bookId}` : "/api/inventory";
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
    router.push(`/inventory/${result.item.id}`);
    router.refresh();
  };

  const handleCancel = () => {
    if (isEdit) {
      router.push(`/inventory/${bookId}`);
    } else {
      router.push("/inventory");
    }
  };

  return (
    <SmartForm
      sections={sections}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitLabel={isEdit ? "Cập nhật" : "Thêm vào kho"}
      cancelLabel="Hủy"
    />
  );
}
