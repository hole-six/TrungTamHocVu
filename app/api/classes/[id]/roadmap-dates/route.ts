import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { generateSessionDates } from "@/lib/server/class-rules";
import { getHolidayDateSet } from "@/lib/server/holidays";

// NGÀY của từng buổi trong lộ trình, và buổi nào ĐÃ DẠY (không được xê dịch nữa).
//
// Nội dung lộ trình nối với buổi học thật THEO VỊ TRÍ: buổi học thứ k (xếp theo ngày, bỏ
// buổi đã hủy) lấy nội dung mục thứ k — cùng quy tắc với trang chi tiết lớp và trang buổi
// học. Nên khi chèn/xóa/đổi chỗ một mục, NGÀY của các buổi không đổi, chỉ NỘI DUNG dịch
// sang buổi khác. Giáo vụ cần thấy ngay "mục này sẽ dạy vào ngày nào" để chèn đúng chỗ,
// ví dụ đặt 2 buổi ôn thi học kỳ đúng tuần trước ngày thi.
//
// Buổi đã dạy xong thì KHÓA: đẩy nội dung của chúng đi là viết lại lịch sử — buổi 5 đã
// dạy "Unit 3" bỗng hiện thành "Unit 2" ở trang buổi học, hồ sơ học viên và nhật ký lớp.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền xem lớp học" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      branchId: true,
      startDate: true,
      totalSessions: true,
      scheduleRules: { where: { isActive: true } },
      sessions: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { sessionDate: "asc" },
        select: { sessionDate: true, status: true },
      },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const requested = Math.max(Number(req.nextUrl.searchParams.get("total")) || 0, cls.totalSessions ?? 0);
  // Tính dư thêm vài buổi để các mục vừa chèn thêm cũng có ngày ngay, không phải lưu rồi mở lại.
  const wanted = Math.min(requested + 20, 400);

  const dates: { sessionNumber: number; date: string; status: "TAUGHT" | "SCHEDULED" | "PROJECTED" }[] = [];
  cls.sessions.slice(0, wanted).forEach((session, index) => {
    dates.push({
      sessionNumber: index + 1,
      date: session.sessionDate.toISOString().slice(0, 10),
      status: session.status === "COMPLETED" ? "TAUGHT" : "SCHEDULED",
    });
  });

  // Buổi chưa sinh lịch: suy tiếp từ lịch cố định, bắt đầu sau buổi cuối đã có.
  if (dates.length < wanted && cls.scheduleRules.length > 0 && cls.startDate) {
    const last = cls.sessions.at(-1)?.sessionDate ?? null;
    const from = last ? new Date(last.getTime() + 24 * 60 * 60 * 1000) : cls.startDate;
    const to = new Date(from.getTime() + 3 * 366 * 24 * 60 * 60 * 1000);
    const holidays = await getHolidayDateSet(cls.branchId);
    for (const slot of generateSessionDates(cls.scheduleRules, from, to, holidays)) {
      if (dates.length >= wanted) break;
      dates.push({
        sessionNumber: dates.length + 1,
        date: slot.sessionDate.toISOString().slice(0, 10),
        status: "PROJECTED",
      });
    }
  }

  // Khóa tới buổi đã dạy XA NHẤT, không chỉ đếm số buổi đã dạy: có buổi giữa chừng chưa
  // điểm danh mà buổi sau đã dạy thì vẫn phải khóa cả đoạn đó.
  let taughtCount = 0;
  dates.forEach((item) => {
    if (item.status === "TAUGHT") taughtCount = item.sessionNumber;
  });

  return NextResponse.json({ taughtCount, dates });
}
