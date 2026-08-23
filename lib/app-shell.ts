export type AppQuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: "plus" | "calendar" | "users" | "money" | "clipboard" | "graduation" | "report" | "shield";
  tone: "primary" | "success" | "warning" | "danger" | "info";
};

export type AppNavGroup = {
  label: string;
  hrefs: string[];
};

export type AppShellConfig = {
  navGroups: AppNavGroup[];
  dashboardTitle: string;
  dashboardSubtitle: string;
  focusTitle: string;
  focusItems: string[];
  quickActionsTitle: string;
  quickActions: AppQuickAction[];
  mobilePrimaryRoutes: string[];
};

const DEFAULT_NAV_GROUPS: AppNavGroup[] = [
  { label: "Điều hành", hrefs: ["/dashboard", "/reports"] },
  { label: "Tuyển sinh & học viên", hrefs: ["/leads", "/students", "/session-credits", "/guardians"] },
  { label: "Đào tạo", hrefs: ["/classes", "/calendar", "/timesheets"] },
  { label: "Tài chính & nhân sự", hrefs: ["/tuition", "/inventory", "/assets", "/cashbook", "/payroll", "/teacher-tasks", "/admin"] },
];

const DEFAULT_CONFIG: AppShellConfig = {
  navGroups: DEFAULT_NAV_GROUPS,
  dashboardTitle: "Bảng điều hành",
  dashboardSubtitle: "Theo dõi dữ liệu vận hành, chốt việc và truy cập nhanh đúng tác vụ cần xử lý.",
  focusTitle: "Ưu tiên trong ngày",
  focusItems: [
    "Kiểm tra lớp, học viên, học phí và các cảnh báo phát sinh mới nhất.",
    "Đi vào đúng module nghiệp vụ thay vì sửa tay trên báo cáo tổng hợp.",
    "Chỉ chốt số liệu ở kỳ báo cáo hoặc kỳ lương/học phí đã được duyệt.",
  ],
  quickActionsTitle: "Lối tắt vận hành",
  quickActions: [
    { id: "students", label: "Học viên", description: "Tra cứu và cập nhật hồ sơ học viên", href: "/students", icon: "users", tone: "primary" },
    { id: "classes", label: "Lớp học", description: "Xem lớp, buổi học và phân công", href: "/classes", icon: "calendar", tone: "success" },
    { id: "reports", label: "Báo cáo", description: "Mở góc nhìn tổng hợp và export", href: "/reports", icon: "report", tone: "info" },
  ],
  mobilePrimaryRoutes: ["/dashboard", "/calendar", "/students", "/reports", "/payroll"],
};

const ROLE_CONFIGS: Record<string, AppShellConfig> = {
  SUPER_ADMIN: {
    navGroups: DEFAULT_NAV_GROUPS,
    dashboardTitle: "Điều hành toàn hệ thống",
    dashboardSubtitle: "Giữ chuẩn dữ liệu, phân quyền, khóa kỳ và kiểm soát toàn bộ luồng vận hành.",
    focusTitle: "Ưu tiên điều hành",
    focusItems: [
      "Giữ một nguồn dữ liệu chuẩn cho toàn hệ thống, không để report bị chỉnh tay.",
      "Rà quyền, khóa kỳ, import và audit các thay đổi nhạy cảm.",
      "Theo dõi độ khớp giữa dữ liệu live, kỳ nghiệp vụ và snapshot báo cáo.",
    ],
    quickActionsTitle: "Tác vụ điều hành nhanh",
    quickActions: [
      { id: "reports", label: "Báo cáo tổng hợp", description: "Mở toàn bộ dashboard và báo cáo", href: "/reports", icon: "report", tone: "info" },
      { id: "payroll", label: "Kỳ lương", description: "Rà soát kỳ lương và khóa số liệu", href: "/payroll", icon: "money", tone: "warning" },
      { id: "admin", label: "Quản trị", description: "Phân quyền, import, kiểm soát hệ thống", href: "/admin", icon: "shield", tone: "danger" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/reports", "/payroll", "/cashbook", "/admin"],
  },
  BOARD: {
    navGroups: DEFAULT_NAV_GROUPS,
    dashboardTitle: "Dashboard Ban giám đốc",
    dashboardSubtitle: "Tập trung vào tăng trưởng, dòng tiền, công nợ và chất lượng vận hành từng cơ sở.",
    focusTitle: "Điểm cần nhìn ngay",
    focusItems: [
      "So sánh tăng trưởng học viên, tuyển sinh và doanh thu theo kỳ.",
      "Phát hiện công nợ, chi phí, kỳ lương và lớp rủi ro cần can thiệp.",
      "Đọc snapshot đã chốt khi cần xem lại lịch sử, tránh lệch dữ liệu live.",
    ],
    quickActionsTitle: "Lối tắt điều hành",
    quickActions: [
      { id: "reports", label: "Báo cáo", description: "Mở báo cáo tổng hợp toàn trung tâm", href: "/reports", icon: "report", tone: "info" },
      { id: "tuition", label: "Học phí", description: "Theo dõi doanh thu và công nợ", href: "/tuition", icon: "money", tone: "warning" },
      { id: "cashbook", label: "Thu chi", description: "Kiểm soát dòng tiền và chi phí", href: "/cashbook", icon: "clipboard", tone: "danger" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/reports", "/tuition", "/cashbook", "/payroll"],
  },
  DIRECTOR: {
    navGroups: DEFAULT_NAV_GROUPS,
    dashboardTitle: "Điều hành trung tâm",
    dashboardSubtitle: "Xem toàn cảnh vận hành, tuyển sinh, học phí, thu chi và nhân sự theo cùng một nguồn dữ liệu chuẩn.",
    focusTitle: "Việc lãnh đạo cần chốt",
    focusItems: [
      "Ưu tiên lớp đang vận hành, công nợ học phí, dòng tiền và năng lực nhân sự.",
      "Chỉ ra quyết định từ dữ liệu đã chuẩn hóa theo kỳ, không bám vào file rời.",
      "Phân phối việc xuống giáo vụ, kế toán, HR và theo dõi tiến độ ngay trên dashboard.",
    ],
    quickActionsTitle: "Tác vụ lãnh đạo",
    quickActions: [
      { id: "reports", label: "Báo cáo", description: "Mở báo cáo điều hành", href: "/reports", icon: "report", tone: "info" },
      { id: "classes", label: "Lớp học", description: "Rà lớp, lịch và sĩ số đang chạy", href: "/classes", icon: "calendar", tone: "success" },
      { id: "payroll", label: "Nhân sự & lương", description: "Kiểm tra kỳ công và lương", href: "/payroll", icon: "money", tone: "warning" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/classes", "/reports", "/payroll", "/cashbook"],
  },
  BRANCH_MANAGER: {
    navGroups: [
      { label: "Điều phối trong ngày", hrefs: ["/dashboard", "/classes", "/calendar", "/students", "/session-credits"] },
      { label: "Tuyển sinh & học phí", hrefs: ["/leads", "/guardians", "/tuition", "/reports"] },
      { label: "Vận hành cơ sở", hrefs: ["/timesheets", "/inventory", "/cashbook", "/payroll", "/teacher-tasks", "/assets"] },
    ],
    dashboardTitle: "Bảng điều hành cơ sở",
    dashboardSubtitle: "Phân phối dữ liệu đúng người, đúng việc và giữ nhịp vận hành hằng ngày thật gọn.",
    focusTitle: "Ưu tiên cơ sở hôm nay",
    focusItems: [
      "Lớp nào đang chạy, lớp nào thiếu người dạy hoặc cần xử lý sĩ số.",
      "Học viên nghỉ, công nợ cần nhắc, lead cần chuyển đổi và việc tồn trong ngày.",
      "Chốt nhanh theo vai trò: giáo viên thấy lớp của mình, kế toán thấy tiền, HR thấy công.",
    ],
    quickActionsTitle: "Điều phối nhanh",
    quickActions: [
      { id: "calendar", label: "Lịch hôm nay", description: "Xem buổi học và điều phối ca", href: "/calendar", icon: "calendar", tone: "success" },
      { id: "tuition", label: "Theo dõi học phí", description: "Mở công nợ và thu trong ngày", href: "/tuition", icon: "money", tone: "warning" },
      { id: "leads", label: "DS test / lead", description: "Theo dõi tuyển sinh và chuyển đổi", href: "/leads", icon: "users", tone: "primary" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/calendar", "/students", "/tuition", "/reports"],
  },
  REGISTRAR: {
    navGroups: [
      { label: "Giáo vụ trong ngày", hrefs: ["/dashboard", "/classes", "/calendar", "/students", "/session-credits"] },
      { label: "Tuyển sinh hỗ trợ", hrefs: ["/leads", "/guardians", "/reports"] },
      { label: "Công việc điều phối", hrefs: ["/timesheets"] },
    ],
    dashboardTitle: "Dashboard giáo vụ",
    dashboardSubtitle: "Tập trung điều phối lớp, học viên, buổi học và các việc chưa hoàn tất trong ngày.",
    focusTitle: "Việc giáo vụ cần xử lý",
    focusItems: [
      "Điểm danh, nhật ký lớp, sĩ số và lớp thiếu phân công.",
      "Học viên nghỉ nhiều, cần chuyển lớp hoặc cần theo dõi lại.",
      "Mọi chỉnh sửa lớp/buổi phải đi qua form nghiệp vụ để giữ logic chuẩn.",
    ],
    quickActionsTitle: "Lối tắt giáo vụ",
    quickActions: [
      { id: "classes", label: "Lớp học", description: "Mở lớp và xem từng buổi", href: "/classes", icon: "graduation", tone: "success" },
      { id: "calendar", label: "Lịch học", description: "Điều phối buổi học trong ngày", href: "/calendar", icon: "calendar", tone: "primary" },
      { id: "students", label: "Học viên", description: "Tra cứu nhanh hồ sơ và trạng thái", href: "/students", icon: "users", tone: "info" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/calendar", "/classes", "/students", "/reports"],
  },
  ADMISSIONS: {
    navGroups: [
      { label: "Tuyển sinh", hrefs: ["/dashboard", "/leads", "/guardians", "/session-credits"] },
      { label: "Lịch & chuyển đổi", hrefs: ["/calendar"] },
    ],
    dashboardTitle: "Dashboard tuyển sinh",
    dashboardSubtitle: "Theo dõi lead, test đầu vào, tình trạng liên hệ và chuyển đổi sang học viên thật nhanh.",
    focusTitle: "Ưu tiên tuyển sinh",
    focusItems: [
      "Lead mới, lead hẹn test, lead đủ điều kiện ghi danh.",
      "Mọi thao tác bám theo pipeline chung để báo cáo chuyển đổi luôn đúng.",
      "Tìm theo tên, SĐT, phụ huynh và lớp dự kiến trong một luồng thống nhất.",
    ],
    quickActionsTitle: "Lối tắt tuyển sinh",
    quickActions: [
      { id: "new-lead", label: "Thêm lead", description: "Ghi nhận phụ huynh/học viên tiềm năng", href: "/leads/new", icon: "plus", tone: "primary" },
      { id: "leads", label: "DS test", description: "Mở pipeline tuyển sinh và lịch test", href: "/leads", icon: "users", tone: "success" },
      { id: "calendar", label: "Lịch hẹn", description: "Xem các lịch hẹn tuyển sinh", href: "/calendar", icon: "calendar", tone: "info" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/leads", "/calendar", "/guardians"],
  },
  RECEPTIONIST: {
    navGroups: [
      { label: "Tiếp nhận & hỗ trợ", hrefs: ["/dashboard", "/students", "/session-credits", "/guardians", "/leads"] },
      { label: "Lớp & học phí", hrefs: ["/classes", "/calendar", "/tuition", "/inventory"] },
    ],
    dashboardTitle: "Dashboard lễ tân",
    dashboardSubtitle: "Tra cứu nhanh học viên, phụ huynh, lớp học và hỗ trợ thu học phí cơ bản tại quầy.",
    focusTitle: "Việc tiếp nhận hôm nay",
    focusItems: [
      "Tìm thật nhanh học viên, phụ huynh, lớp và tình trạng học phí.",
      "Ghi nhận lead mới, hỗ trợ lớp học và điều hướng đúng bộ phận xử lý.",
      "Không sửa số liệu tài chính nhạy cảm ngoài luồng đã phân quyền.",
    ],
    quickActionsTitle: "Lối tắt lễ tân",
    quickActions: [
      { id: "students", label: "Tra cứu học viên", description: "Tìm theo tên, mã, SĐT", href: "/students", icon: "users", tone: "primary" },
      { id: "tuition", label: "Học phí", description: "Xem trạng thái thanh toán", href: "/tuition", icon: "money", tone: "warning" },
      { id: "leads", label: "Lead mới", description: "Tạo và theo dõi đầu mối tuyển sinh", href: "/leads", icon: "plus", tone: "success" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/students", "/tuition", "/calendar", "/leads"],
  },
  ACCOUNTANT: {
    navGroups: [
      { label: "Tài chính", hrefs: ["/dashboard", "/tuition", "/cashbook", "/reports"] },
      { label: "Đối soát", hrefs: ["/inventory", "/payroll", "/teacher-tasks", "/students", "/session-credits", "/assets"] },
    ],
    dashboardTitle: "Dashboard kế toán",
    dashboardSubtitle: "Tập trung phải thu, đã thu, công nợ, thu chi và kỳ lương để đối soát nhanh và chính xác.",
    focusTitle: "Ưu tiên kế toán",
    focusItems: [
      "Theo dõi học phí theo kỳ, khoản đã thu và phần còn thiếu.",
      "Đối soát thu chi ngoài học phí, các phát sinh sách và kỳ lương cần kiểm tra.",
      "Chỉ xuất báo cáo từ dữ liệu đã chuẩn hóa hoặc snapshot đã chốt.",
    ],
    quickActionsTitle: "Lối tắt tài chính",
    quickActions: [
      { id: "tuition", label: "Theo dõi học phí", description: "Mở công nợ, phát sinh và thanh toán", href: "/tuition", icon: "money", tone: "warning" },
      { id: "cashbook", label: "Thu chi", description: "Quản lý phiếu thu chi và dòng tiền", href: "/cashbook", icon: "clipboard", tone: "danger" },
      { id: "reports", label: "Báo cáo tài chính", description: "Xem báo cáo tổng hợp theo kỳ", href: "/reports", icon: "report", tone: "info" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/tuition", "/cashbook", "/reports", "/payroll"],
  },
  HR: {
    navGroups: [
      { label: "Nhân sự", hrefs: ["/dashboard", "/timesheets", "/payroll", "/teacher-tasks"] },
      { label: "Tài sản & báo cáo", hrefs: ["/assets", "/reports"] },
    ],
    dashboardTitle: "Dashboard nhân sự",
    dashboardSubtitle: "Tách rõ chấm công ngày, công giảng dạy và kỳ lương để kiểm soát không chồng chéo dữ liệu.",
    focusTitle: "Ưu tiên nhân sự",
    focusItems: [
      "Chấm công ngày cho hành chính/văn phòng ở đúng menu riêng.",
      "Không dùng chấm công ngày làm nguồn công dạy cho giáo viên/trợ giảng.",
      "Theo dõi hợp đồng, kỳ lương, chênh lệch công và audit chỉnh sửa.",
    ],
    quickActionsTitle: "Lối tắt nhân sự",
    quickActions: [
      { id: "timesheets", label: "Chấm công ngày", description: "Nhập và rà soát công hành chính", href: "/timesheets", icon: "calendar", tone: "primary" },
      { id: "payroll", label: "Kỳ lương", description: "Mở kỳ lương và bảng lương", href: "/payroll", icon: "money", tone: "warning" },
      { id: "reports", label: "Báo cáo nhân sự", description: "Xem tổng hợp công, lương và cảnh báo", href: "/reports", icon: "report", tone: "info" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/timesheets", "/payroll", "/reports"],
  },
  TEACHER: {
    navGroups: [
      { label: "Việc của tôi", hrefs: ["/dashboard", "/calendar", "/classes"] },
      { label: "Học viên & thu nhập", hrefs: ["/students", "/payroll", "/teacher-tasks"] },
    ],
    dashboardTitle: "Dashboard giáo viên",
    dashboardSubtitle: "Vào thẳng lớp hôm nay, điểm danh, nhật ký và xem công dạy của bản thân trong một luồng gọn.",
    focusTitle: "Ưu tiên giảng dạy",
    focusItems: [
      "Thấy rõ lớp hôm nay, lớp sắp dạy và buổi còn thiếu điểm danh/nhật ký.",
      "Công dạy lấy từ buổi học đã phân công, không nhập lại ở menu chấm công ngày.",
      "Tra cứu nhanh học viên lớp mình để xử lý ngay trên lớp hoặc sau buổi học.",
    ],
    quickActionsTitle: "Lối tắt giáo viên",
    quickActions: [
      { id: "calendar", label: "Lớp hôm nay", description: "Mở lịch dạy và buổi cần xử lý", href: "/calendar", icon: "calendar", tone: "success" },
      { id: "classes", label: "Buổi học", description: "Điểm danh và nhật ký lớp", href: "/classes", icon: "graduation", tone: "primary" },
      { id: "payroll", label: "Công dạy", description: "Xem công và thu nhập của mình", href: "/payroll", icon: "money", tone: "warning" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/calendar", "/classes", "/payroll"],
  },
  TEACHING_ASSISTANT: {
    navGroups: [
      { label: "Việc của tôi", hrefs: ["/dashboard", "/calendar", "/classes"] },
      { label: "Thu nhập", hrefs: ["/payroll", "/teacher-tasks"] },
    ],
    dashboardTitle: "Dashboard trợ giảng",
    dashboardSubtitle: "Tập trung vào ca được phân công, checklist buổi học và công trợ giảng của bản thân.",
    focusTitle: "Ưu tiên trợ giảng",
    focusItems: [
      "Xử lý đúng buổi được phân công và hỗ trợ điểm danh/ghi nhận lớp.",
      "Theo dõi công trợ giảng từ SessionAssignment thay vì chấm công ngày.",
      "Giảm thao tác thừa, chỉ nhìn đúng việc và đúng lớp của mình.",
    ],
    quickActionsTitle: "Lối tắt trợ giảng",
    quickActions: [
      { id: "calendar", label: "Lịch được phân công", description: "Xem ca dạy và hỗ trợ hôm nay", href: "/calendar", icon: "calendar", tone: "success" },
      { id: "classes", label: "Lớp phụ trách", description: "Mở nhanh lớp đang theo", href: "/classes", icon: "graduation", tone: "primary" },
      { id: "payroll", label: "Công trợ giảng", description: "Xem công và thu nhập bản thân", href: "/payroll", icon: "money", tone: "warning" },
    ],
    mobilePrimaryRoutes: ["/dashboard", "/calendar", "/classes", "/payroll"],
  },
};

export function getAppShellConfig(role: string | null | undefined): AppShellConfig {
  if (!role) return DEFAULT_CONFIG;
  return ROLE_CONFIGS[role] ?? DEFAULT_CONFIG;
}
