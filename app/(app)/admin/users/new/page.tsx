import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";

export const metadata = { title: "Tạo người dùng mới" };

export default async function NewUserPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/dashboard");
  }

  redirect("/admin?openCreateUser=1");
}
