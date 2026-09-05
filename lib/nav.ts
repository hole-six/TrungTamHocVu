// Điều hướng ứng dụng — bám theo "Module và route tối thiểu" (Master Spec §7).
// status "live": đã có UI + API thật. status "planned": placeholder, chưa cắm dữ liệu.
export type NavItem = {
  href: string;
  label: string;
  status: "live" | "planned";
  description: string;
  sections: string[]; // các phân hệ con sẽ nằm trong trang này (tab/section)
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    status: "live",
    description: "Số liệu vận hành tổng hợp toàn hệ thống.",
    sections: [],
  },
  {
    href: "/leads",
    label: "CRM tuyển sinh",
    status: "live",
    description: "Theo dõi phụ huynh/học viên tiềm năng từ lúc liên hệ đến khi test đầu vào và ghi danh (nguồn: DSTest).",
    sections: ["Lead", "Lịch hẹn", "Test đầu vào", "Pipeline", "Tỉ lệ chuyển đổi", "Lịch sử tương tác"],
  },
  {
    href: "/students",
    label: "Học viên",
    status: "live",
    description: "Hồ sơ học viên, ghi danh, công nợ và lịch sử học tập (nguồn: DSHV).",
    sections: ["Danh sách học viên", "Ghi danh", "Lịch sử trạng thái", "Công nợ", "Thanh toán", "Giáo trình"],
  },
  {
    href: "/session-credits",
    label: "Bổ trợ",
    status: "live",
    description: "Bảng xử lý bổ trợ vắng cần bài và bổ trợ đầu khóa theo từng học viên.",
    sections: ["Bổ trợ vắng", "Bổ trợ đầu khóa", "Lịch sử đã bổ trợ"],
  },
  {
    href: "/classes",
    label: "Thông tin lớp học",
    status: "live",
    description: "Khóa học, lớp học, lịch dạy, sinh buổi học và điểm danh (nguồn: DSLop, ChiTietLopHoc).",
    sections: ["Dạy thay tự động gợi ý"],
  },
  {
    href: "/calendar",
    label: "Thời khoá biểu",
    status: "live",
    description: "Lịch dạy tổng hợp toàn trung tâm theo ngày/tuần.",
    sections: [],
  },
  {
    href: "/employees",
    label: "Nhân sự",
    status: "live",
    description: "Danh sách nhân viên: mã NV, liên hệ, vị trí, lương và hợp đồng lao động — độc lập với từng kỳ lương.",
    sections: ["Hợp đồng lao động"],
  },
  {
    href: "/timesheets",
    label: "Chấm công",
    status: "live",
    description: "Chấm công ngày cho nhân sự hành chính/văn phòng; công dạy của giáo viên và trợ giảng lấy từ buổi học đã phân công.",
    sections: ["Duyệt & khóa kỳ công", "Đi muộn/về sớm/OT tự động"],
  },
  {
    href: "/tuition",
    label: "Học phí",
    status: "live",
    description: "Sinh học phí theo kỳ từ dữ liệu lớp học thật, thu tiền, phân bổ công nợ FIFO và học bổng (nguồn: TheoDoiHP).",
    sections: ["Hóa đơn PDF", "Hoàn tiền"],
  },
  {
    href: "/inventory",
    label: "Tài liệu",
    status: "live",
    description: "Nhập/xuất/tồn giáo trình theo học viên, tự động feed vào Học phí (nguồn: XuatNhapSach).",
    sections: ["Kiểm kê định kỳ"],
  },
  {
    href: "/assets",
    label: "Tài sản & Trang thiết bị",
    status: "live",
    description: "Bàn ghế, máy tính, máy in, điều hòa... theo cơ sở — nhập/điều chuyển/thanh lý (yêu cầu bổ sung ngoài PDF gốc).",
    sections: [],
  },
  {
    href: "/cashbook",
    label: "Thu chi",
    status: "live",
    description: "Sổ quỹ thu/chi ngoài học phí, theo danh mục (nguồn: Thu-Chi).",
    sections: ["Duyệt phiếu trước khi xác nhận", "Đính kèm chứng từ"],
  },
  {
    href: "/payroll",
    label: "Lương nhân viên",
    status: "live",
    description: "Phân công GV/TG theo buổi, chấm công ngày hành chính, tính lương theo kỳ (nguồn: Report_Cong_Luong).",
    sections: ["Phiếu lương PDF"],
  },
  {
    href: "/teacher-tasks",
    label: "Hạng mục truy thu bài học",
    status: "live",
    description: "Xác nhận giáo viên/trợ giảng đã hoàn thành yêu cầu buổi dạy hay chưa, tự trừ điểm tích cực nếu chưa nộp.",
    sections: ["Đã nộp / Chưa nộp", "Lịch sử điểm tích cực"],
  },
  {
    href: "/reports",
    label: "Báo cáo",
    status: "live",
    description: "Báo cáo tổng hợp thay cho việc dò nhiều sheet Excel thủ công.",
    sections: ["Xuất PDF/Excel"],
  },
  {
    href: "/admin",
    label: "Quản trị",
    status: "live",
    description: "Chi nhánh, người dùng, phân quyền và nhật ký hệ thống.",
    sections: ["Vai trò/Quyền chi tiết theo module", "Import/Export dữ liệu", "API key", "Sao lưu/Phục hồi"],
  },
];
