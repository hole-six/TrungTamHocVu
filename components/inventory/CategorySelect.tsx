"use client";

import PickOrCreateSelect from "@/components/ui/PickOrCreateSelect";

// Chọn từ danh mục sẵn có để tránh gõ lệch tên (vd "Everybody Up" vs "everybody up")
// làm dữ liệu danh mục bị phân mảnh — vẫn cho thêm danh mục mới khi thật sự cần.
// Phần cơ chế nằm ở PickOrCreateSelect (dùng chung với nhóm lớp), ở đây chỉ đặt chữ.
export default function CategorySelect({
  value,
  onChange,
  categoryOptions,
  className = "input",
}: {
  value: string;
  onChange: (next: string) => void;
  categoryOptions: string[];
  className?: string;
}) {
  return (
    <PickOrCreateSelect
      value={value}
      onChange={onChange}
      options={categoryOptions}
      emptyLabel="Sách khác (chưa xếp danh mục)"
      createLabel="+ Danh mục mới..."
      createPlaceholder="Nhập tên danh mục mới"
      className={className}
    />
  );
}
