import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RegisterForm from "./RegisterForm";

// Chỉ hiển thị form này khi CSDL chưa có ai (khởi tạo Super Admin đầu tiên).
// Có ít nhất 1 user rồi thì luồng "tự đăng ký" phải đóng vĩnh viễn — dẫn
// thẳng về /login thay vì hiện một form chắc chắn sẽ bị API từ chối.
export default async function RegisterPage() {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    redirect("/login");
  }

  return <RegisterForm />;
}
