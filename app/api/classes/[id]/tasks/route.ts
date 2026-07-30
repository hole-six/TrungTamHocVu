import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { CLASS_TASK_RECURRENCES, isTaskDueOn, computeTaskLogStatus } from "@/lib/server/class-task-rules";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

// Nhắc việc theo lớp — nguồn DSLop!N:S. Trả kèm trạng thái "hôm nay" của từng việc lặp lại
// (đến hạn hôm nay chưa, đã hoàn thành chưa) để trang chi tiết lớp không phải tự tính lại.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const tasks = await prisma.classTask.findMany({
    where: { classId: params.id },
    orderBy: { createdAt: "asc" },
    include: { logs: { orderBy: { dueDate: "desc" }, take: 5 } },
  });

  const today = new Date();
  const items = tasks.map((task) => {
    const dueToday = task.isActive && isTaskDueOn(task, today);
    const todayLog = task.logs.find((l) => sameDay(l.dueDate, today));
    return {
      ...task,
      dueToday,
      todayStatus: dueToday ? computeTaskLogStatus(today, todayLog?.completedAt ?? null, today) : null,
    };
  });

  return NextResponse.json({ items });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo việc nhắc" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const recurrence = String(body.recurrence ?? "");
  if (!title) return NextResponse.json({ error: "Thiếu tên công việc" }, { status: 400 });
  if (!CLASS_TASK_RECURRENCES.includes(recurrence as (typeof CLASS_TASK_RECURRENCES)[number])) {
    return NextResponse.json({ error: "Kiểu lặp lại không hợp lệ" }, { status: 400 });
  }

  let dayOfMonth: number | null = null;
  let weekday: number | null = null;
  let onceDate: Date | null = null;

  if (recurrence === "MONTHLY_DAY") {
    dayOfMonth = Number(body.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      return NextResponse.json({ error: "Ngày trong tháng phải từ 1-31" }, { status: 400 });
    }
  } else if (recurrence === "WEEKDAY") {
    weekday = Number(body.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: "Thứ không hợp lệ" }, { status: 400 });
    }
  } else if (recurrence === "ONE_OFF") {
    if (!body.onceDate) return NextResponse.json({ error: "Thiếu ngày phát sinh" }, { status: 400 });
    onceDate = new Date(body.onceDate);
  }

  const task = await prisma.classTask.create({
    data: { classId: params.id, title, recurrence, dayOfMonth, weekday, onceDate, notes: body.notes || null },
  });

  return NextResponse.json({ item: task }, { status: 201 });
}
