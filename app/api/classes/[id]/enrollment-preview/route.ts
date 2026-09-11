import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { estimateEndDateFromRules } from "@/lib/server/class-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";

// Xem trước khi ghi danh vào một lớp ĐANG CHẠY: học viên vào từ ngày này thì
//   - buổi đầu tiên của họ là buổi nào (ngày mấy, là buổi thứ mấy của lớp),
//   - tháng đầu tiên còn bao nhiêu buổi và thu bao nhiêu tiền (gói theo tháng),
//   - mua N buổi thì dự kiến học xong khoảng ngày nào (gói theo khóa).
//
// Vì sao cần: ghi danh giữa chừng là việc xảy ra hàng ngày, nhưng form ghi danh trước
// đây không hỏi ngày bắt đầu (mặc định lấy hôm nay) và không cho biết sẽ thu bao nhiêu.
// Nhân viên phải tự mở lịch lớp đếm tay số buổi còn lại rồi nhân với đơn giá — vừa lâu
// vừa dễ sai, và học viên vào lớp giữa tháng hay bị thu nguyên tháng.
//
// Quy tắc đếm buổi PHẢI khớp với generateChargesForPeriod (lib/server/billing-generation.ts):
// đếm ClassSession có thật, bỏ buổi đã hủy/đã dời, tính từ NGÀY VÀO LỚP tới hết tháng.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền xem lớp học" }, { status: 403 });
  }

  const dateParam = String(req.nextUrl.searchParams.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Ngày bắt đầu không hợp lệ." }, { status: 400 });
  }
  const startDate = new Date(`${dateParam}T00:00:00.000Z`);
  const purchasedSessions = Number(req.nextUrl.searchParams.get("sessions") ?? 0);

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { tuitionPerSession: true } },
      scheduleRules: { where: { isActive: true }, orderBy: { weekday: "asc" } },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const countFrom = startDate > monthStart ? startDate : monthStart;

  // Danh sách buổi để người ghi danh CHỌN ĐÍCH DANH buổi học đầu tiên, thay vì chọn một
  // ngày rồi để hệ thống tự suy ra buổi nào. Lớp chỉ là cái mác xếp lịch, nên cái thật
  // sự cần chốt là "học viên này bắt đầu từ buổi nào" — đặc biệt khi lớp đã chạy được
  // một đoạn, hoặc buổi liền trước bị hủy.
  const allSessions = await prisma.classSession.findMany({
    where: { classId: params.id, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
    orderBy: { sessionDate: "asc" },
    select: { id: true, sessionDate: true, startTime: true, endTime: true, status: true },
  });
  // Cho chọn lùi tối đa 45 ngày (ghi danh muộn, nhập bù hồ sơ) và toàn bộ buổi phía trước.
  const windowStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const selectableSessions = allSessions
    .map((session, index) => ({
      id: session.id,
      date: session.sessionDate.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      orderInClass: index + 1,
      isPast: session.sessionDate < new Date(),
    }))
    .filter((session) => new Date(`${session.date}T00:00:00.000Z`) >= windowStart)
    .slice(0, 60);

  const [firstSession, sessionsThisMonth, sessionsBefore, totalSessionsSoFar] = await Promise.all([
    prisma.classSession.findFirst({
      where: { classId: cls.id, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: startDate } },
      orderBy: { sessionDate: "asc" },
      select: { id: true, sessionDate: true, startTime: true, endTime: true },
    }),
    prisma.classSession.count({
      where: { classId: cls.id, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: countFrom, lte: monthEnd } },
    }),
    // Số buổi lớp ĐÃ dạy trước ngày vào — để nói rõ "vào giữa chừng, không thu phần này".
    prisma.classSession.count({
      where: { classId: cls.id, status: "COMPLETED", sessionDate: { lt: startDate } },
    }),
    prisma.classSession.count({ where: { classId: cls.id, status: { notIn: ["CANCELLED", "RESCHEDULED"] } } }),
  ]);

  const unitPrice = cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0;
  const holidayDates = await getHolidayDateSet(cls.branchId);
  const expectedEndDate =
    purchasedSessions > 0
      ? estimateEndDateFromRules(startDate, purchasedSessions, cls.scheduleRules, holidayDates)
      : null;

  return NextResponse.json({
    startDate: dateParam,
    unitPrice,
    selectableSessions,
    // Gói theo tháng: tháng đầu chỉ thu từ ngày vào lớp trở đi.
    firstMonth: {
      periodName: `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`,
      sessionCount: sessionsThisMonth,
      amount: sessionsThisMonth * unitPrice,
    },
    firstSession: firstSession
      ? {
          date: firstSession.sessionDate.toISOString().slice(0, 10),
          startTime: firstSession.startTime,
          endTime: firstSession.endTime,
          // "Buổi thứ mấy của lớp" tính theo số buổi đã có lịch tính tới buổi đó.
          orderInClass: sessionsBefore + 1,
        }
      : null,
    sessionsAlreadyTaught: sessionsBefore,
    totalScheduledSessions: totalSessionsSoFar,
    // Gói theo khóa: mua N buổi thì dự kiến hết vào ngày nào.
    expectedEndDate: expectedEndDate ? expectedEndDate.toISOString().slice(0, 10) : null,
    purchasedSessions: purchasedSessions > 0 ? purchasedSessions : null,
    purchasedAmount: purchasedSessions > 0 ? purchasedSessions * unitPrice : null,
  });
}
