import { redirect } from "next/navigation";

// Đã tách thành trang riêng ngoài payroll (không còn là trang con của Payroll) —
// giữ redirect ở đây để không vỡ đường link cũ/bookmark.
export default function LegacyTeacherTasksRedirect() {
  redirect("/teacher-tasks");
}
