import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// Đánh dấu hoàn thành vẫn cho phép GV/TG — việc dạy học hàng ngày, cùng pattern với
// app/api/sessions/[id]/attendance/route.ts.
async function canCompleteTask(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

// Đánh dấu hoàn thành (hoặc bỏ đánh dấu) một lần đến hạn cụ thể — mặc định là hôm nay.
// Upsert theo (classTaskId, dueDate) vì ClassTaskLog chỉ tạo khi thực sự có thao tác,
// không sinh sẵn hàng loạt theo lịch.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await canCompleteTask(user.id))) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền đánh dấu hoàn thành" }, { status: 403 });
  }

  const task = await prisma.classTask.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Không tìm thấy việc nhắc" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const dueDateRaw = body.dueDate ? new Date(body.dueDate) : new Date();
  const dueDate = new Date(dueDateRaw.getFullYear(), dueDateRaw.getMonth(), dueDateRaw.getDate());
  const undo = Boolean(body.undo);

  const log = await prisma.classTaskLog.upsert({
    where: { classTaskId_dueDate: { classTaskId: task.id, dueDate } },
    create: {
      classTaskId: task.id,
      dueDate,
      completedAt: undo ? null : new Date(),
      completedById: undo ? null : user.id,
      notes: body.notes || null,
    },
    update: {
      completedAt: undo ? null : new Date(),
      completedById: undo ? null : user.id,
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    },
  });

  return NextResponse.json({ item: log });
}
