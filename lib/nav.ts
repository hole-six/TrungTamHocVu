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
    href: "/guardians",
    label: "Phụ huynh",
    status: "live",
    description: "Danh sách phụ huynh, liên kết với Lead và Học viên.",
    sections: [],
  },
  {
    href: "/classes",
    label: "Lớp & Lịch",
    status: "live",
    description: "Khóa học, lớp học, lịch dạy, sinh buổi học và điểm danh (nguồn: DSLop, ChiTietLopHoc).",
    sections: ["Dạy thay tự động gợi ý"],
  },
  {
    href: "/calendar",
    label: "Lịch tổng",
    status: "live",
    description: "Lịch dạy tổng hợp toàn trung tâm theo ngày/tuần.",
    sections: [],
  },
  {
    href: "/timesheets",
    label: "Chấm công",
    status: "live",
    description: "Chấm công nhân viên theo ngày (nguồn: ChiTietLopHoc — cột Đến/Về).",
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
    label: "Kho giáo trình",
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
    label: "Nhân sự & Lương",
    status: "live",
    description: "Hồ sơ nhân viên, phân công GV/TG theo buổi, chấm công, tính lương theo kỳ (nguồn: NhanSu, Report_Cong_Luong).",
    sections: ["Hợp đồng lao động", "Phiếu lương PDF"],
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
