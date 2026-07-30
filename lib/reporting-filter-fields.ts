export type StandardFilterField = {
  name: string;
  label: string;
  type: "text" | "select" | "date-range" | "number-range" | "multi-select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export const STANDARD_REPORT_FILTER_FIELDS: StandardFilterField[] = [
  {
    name: "timePreset",
    label: "Thời gian",
    type: "select",
    options: [
      { value: "today", label: "Hôm nay" },
      { value: "this_week", label: "Tuần này" },
      { value: "this_month", label: "Tháng này" },
      { value: "current_period", label: "Kỳ hiện tại" },
      { value: "custom", label: "Tùy chọn ngày" },
      { value: "all_time", label: "Toàn thời gian" },
    ],
  },
  {
    name: "dateRange",
    label: "Khoảng ngày",
    type: "date-range",
  },
  {
    name: "status",
    label: "Trạng thái",
    type: "select",
    options: [
      { value: "ACTIVE", label: "Đang hoạt động" },
      { value: "LEFT", label: "Đã nghỉ" },
      { value: "OPEN", label: "Đang mở" },
      { value: "LOCKED", label: "Đã khóa" },
    ],
  },
  {
    name: "keyword",
    label: "Từ khóa",
    type: "text",
    placeholder: "Tìm theo mã, tên, SĐT, phụ huynh, lớp...",
  },
];
