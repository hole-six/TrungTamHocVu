import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";
import { getUserRole } from "@/lib/permissions";
import { canView, canCreate } from "@/lib/server/role-matrix";
import { estimateEndDate, estimateEndDateFromRules } from "@/lib/server/class-rules";
import { syncClassDerivedFields } from "@/lib/server/database-sync";
import { ensureClassRoadmapItems, normalizeRoadmapItemsInput } from "@/lib/server/class-roadmap";
import { isValidClassAssignmentRole } from "@/lib/server/class-default-assignments";
import { getHolidayDateSet } from "@/lib/server/holidays";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (user && !canView("schedule", role)) return NextResponse.json({ error: "Khong co quyen xem lop" }, { status: 403 });
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");

  // Áp dụng branch filter
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ className: { contains: q } }, { classCode: { contains: q } }] } : {}),
  };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const items = await prisma.class.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      scheduleRules: {
        where: { isActive: true },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      sessions: {
        where: {
          sessionDate: { gte: today },
          status: { not: "CANCELLED" },
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        take: 1,
      },
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
          sessions: { where: { status: "COMPLETED" } },
        },
      },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo lớp mới" }, { status: 403 });
  }

  const body = await req.json();

  // Lấy branchId hợp lệ
  const branchId = await getValidBranchIdForCreation(body.branchId);
  if (!branchId) {
    return NextResponse.json({ error: "Không xác định được cơ sở" }, { status: 400 });
  }

  const classCode = String(body.classCode ?? "").trim();
  const className = String(body.className ?? "").trim();
  if (!classCode || !className) return NextResponse.json({ error: "Thiếu mã hoặc tên lớp" }, { status: 400 });
  if (!body.startDate) return NextResponse.json({ error: "Thiếu ngày khai giảng" }, { status: 400 });

  const existing = await prisma.class.findUnique({ where: { classCode } });
  if (existing) return NextResponse.json({ error: "Mã lớp đã tồn tại" }, { status: 409 });

  let tuitionPerSession = body.tuitionPerSession ? Number(body.tuitionPerSession) : null;
  let sessionsPerWeek = body.sessionsPerWeek ? Number(body.sessionsPerWeek) : null;
  const scheduleRules = Array.isArray(body.scheduleRules) ? body.scheduleRules : [];

  if (body.courseId) {
    const course = await prisma.course.findUnique({ where: { id: body.courseId } });
    if (course) {
      tuitionPerSession = tuitionPerSession ?? course.tuitionPerSession;
      sessionsPerWeek = sessionsPerWeek ?? course.sessionsPerWeek;
    }
  }

  if (scheduleRules.length > 0) {
    sessionsPerWeek = scheduleRules.length;
  }

  for (const [index, rule] of scheduleRules.entries()) {
    const weekday = Number(rule.weekday);
    const startTime = String(rule.startTime ?? "").trim();
    const endTime = String(rule.endTime ?? "").trim();
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: `Buổi cố định ${index + 1} có thứ không hợp lệ.` }, { status: 400 });
    }
    if (!startTime || !endTime || startTime >= endTime) {
      return NextResponse.json({ error: `Buổi cố định ${index + 1} có giờ học không hợp lệ.` }, { status: 400 });
    }
  }

  const isRemedial = Boolean(body.isRemedial);
  const nextClassId = !isRemedial && body.nextClassId ? String(body.nextClassId).trim() : null;
  if (nextClassId) {
    const nextClass = await prisma.class.findUnique({ where: { id: nextClassId }, select: { branchId: true, isRemedial: true, status: true } });
    if (!nextClass || nextClass.branchId !== branchId || nextClass.isRemedial || nextClass.status !== "ACTIVE") {
      return NextResponse.json({ error: "Lop tiep theo khong hop le hoac khong cung co so." }, { status: 400 });
    }
  }
  const normalizedStartDate = body.startDate ? new Date(body.startDate) : null;
  const normalizedTotalSessions = body.totalSessions ? Number(body.totalSessions) : null;
  const normalizedRules = scheduleRules.map((rule: { weekday: number; startTime: string; endTime: string; room?: string | null }) => ({
    weekday: Number(rule.weekday),
    startTime: String(rule.startTime).trim(),
    endTime: String(rule.endTime).trim(),
    room: rule.room ? String(rule.room).trim() : null,
  }));
  const holidayDates = await getHolidayDateSet(branchId);
  const expectedEndDate =
    estimateEndDateFromRules(normalizedStartDate, normalizedTotalSessions, normalizedRules, holidayDates) ??
    estimateEndDate(normalizedStartDate, normalizedTotalSessions, sessionsPerWeek);
  const roadmapItems = normalizeRoadmapItemsInput(body.roadmapItems, normalizedTotalSessions);
  const defaultAssignments = Array.isArray(body.defaultAssignments)
    ? body.defaultAssignments
        .map((item: { role?: string; employeeId?: string | null; notes?: string | null }) => ({
          role: String(item.role ?? "").trim(),
          employeeId: item.employeeId ? String(item.employeeId).trim() : "",
          notes: String(item.notes ?? "").trim() || null,
        }))
        .filter((item: { role: string; employeeId: string }) => item.employeeId && isValidClassAssignmentRole(item.role))
    : [];

  // Chiết khấu cả lớp — không bắt buộc. Có thì mọi học viên ghi danh vào lớp lấy mức
  // này làm mặc định, và học phí thực thu của lớp được tính lại theo mức đó.
  const discountPercent = Math.min(100, Math.max(0, Number(body.discountPercent ?? 0) || 0));

  // Sách kèm theo của lớp — cũng không bắt buộc. Chỉ nhận sách có thật và cùng cơ sở.
  const requestedBooks: { bookId: string; quantity: number }[] = Array.isArray(body.books)
    ? body.books
        .map((item: { bookId?: string; quantity?: number }) => ({
          bookId: String(item.bookId ?? "").trim(),
          quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
        }))
        .filter((item: { bookId: string }) => item.bookId)
    : [];
  const uniqueBooks = [...new Map(requestedBooks.map((item) => [item.bookId, item])).values()];
  if (uniqueBooks.length > 0) {
    const found = await prisma.book.findMany({
      where: { id: { in: uniqueBooks.map((item) => item.bookId) }, branchId },
      select: { id: true },
    });
    if (found.length !== uniqueBooks.length) {
      return NextResponse.json({ error: "Có sách không tồn tại hoặc không thuộc cơ sở này." }, { status: 400 });
    }
  }

  const created = await prisma.class.create({
    data: {
      branchId,
      courseId: body.courseId || null,
      classCode,
      classGroup: body.classGroup || null,
      className,
      isRemedial,
      nextClassId,
      totalSessions: normalizedTotalSessions,
      startDate: normalizedStartDate,
      expectedEndDate,
      sessionsPerWeek,
      tuitionPerSession,
      discountPercent,
      notes: body.notes || null,
      classBooks: uniqueBooks.length
        ? { create: uniqueBooks.map((item, index) => ({ bookId: item.bookId, quantity: item.quantity, sortOrder: index })) }
        : undefined,
      scheduleRules: scheduleRules.length
        ? {
            create: normalizedRules,
          }
        : undefined,
      roadmapItems: roadmapItems.length
        ? {
            create: roadmapItems,
          }
        : undefined,
      defaultAssignments: defaultAssignments.length
        ? {
            create: defaultAssignments,
          }
        : undefined,
    },
  });

  // Luôn điền đủ khung cho các buổi CÒN THIẾU, kể cả khi form đã gửi kèm vài buổi soạn
  // sẵn: form tạo lớp chỉ gửi những buổi có nội dung, nên nếu chỉ sinh khung khi danh sách
  // rỗng thì lớp soạn trước 10/48 buổi sẽ thiếu 38 buổi còn lại. Hàm này chỉ thêm buổi
  // chưa có, không ghi đè buổi đã soạn.
  if (!isRemedial) {
    await ensureClassRoadmapItems(created.id, normalizedTotalSessions);
  }
  const synced = await syncClassDerivedFields(created.id);
  return NextResponse.json({ item: synced ?? created }, { status: 201 });
}
