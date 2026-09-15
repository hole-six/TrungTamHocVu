// SỐ THỨ TỰ BUỔI TRONG LỚP — nguồn sự thật DUY NHẤT để nối buổi học với tài liệu (lộ trình).
//
// Tài liệu của lớp khai theo "Buổi 1, Buổi 2, ..." (ClassRoadmapItem.sessionNumber). Buổi học
// thật lấy tài liệu theo SỐ THỨ TỰ của nó. Quy tắc đánh số:
//
//   - TRUNG TÂM CHO NGHỈ (CANCELLED): buổi đó không có số. Các buổi sau dồn lên — buổi kế tiếp
//     học đúng tài liệu của buổi bị nghỉ, cứ thế tịnh tiến; lớp tự dài thêm 1 buổi ở cuối.
//   - DỜI LỊCH (buổi gốc RESCHEDULED + buổi bù trỏ replacesSessionId về nó): buổi bù GIỮ ĐÚNG
//     số của buổi gốc, dù ngày bù rơi trước hay sau các buổi khác — tài liệu đi theo buổi dời.
//     Các buổi khác không đổi số. Buổi bù lại bị dời tiếp thì số đi theo buổi bù mới nhất;
//     buổi bù bị cho nghỉ thì như cho nghỉ (các buổi sau dồn lên).
//
// Trước đây mỗi màn hình tự đếm một kiểu: trang buổi học đếm cả buổi đã dời VÀ buổi bù (dời
// 1 buổi là mọi buổi sau lệch 1 bài), tab "Buổi học" của lớp đánh số theo lịch dự kiến (cho
// nghỉ không dồn nội dung, buổi bù lệch ngày không hiện), danh sách buổi bổ trợ đếm cả buổi
// đã hủy. File này không import prisma để dùng được ở mọi nơi.

export type NumberableSession = {
  id: string;
  sessionDate: Date | string;
  startTime?: string | null;
  status: string;
  replacesSessionId?: string | null;
};

export type SessionNumbering = {
  /** Số thứ tự (1, 2, ...) của buổi ĐANG giữ vị trí đó — buổi thường hoặc buổi bù cuối cùng. */
  numberById: Map<string, number>;
  /** Buổi gốc đã dời → số thứ tự đã chuyển sang buổi bù. */
  movedNumberById: Map<string, number>;
  /** Số vị trí đang có buổi giữ (không tính buổi nghỉ). */
  count: number;
};

function timeOf(session: NumberableSession) {
  const date = typeof session.sessionDate === "string" ? session.sessionDate : session.sessionDate.toISOString();
  return `${date.slice(0, 10)} ${session.startTime ?? ""}`;
}

export function computeSessionNumbers(sessions: NumberableSession[]): SessionNumbering {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const replacementOf = new Map<string, NumberableSession>();
  for (const s of sessions) {
    if (s.replacesSessionId && byId.has(s.replacesSessionId)) replacementOf.set(s.replacesSessionId, s);
  }

  // Vị trí trong lộ trình = buổi KHÔNG phải buổi bù (buổi bù ăn theo vị trí của buổi gốc).
  // Buổi bù mồ côi (buổi gốc không còn trong danh sách) tự làm một vị trí theo ngày của nó.
  const slots = sessions
    .filter((s) => !(s.replacesSessionId && byId.has(s.replacesSessionId)))
    .sort((a, b) => timeOf(a).localeCompare(timeOf(b)) || a.id.localeCompare(b.id));

  const numberById = new Map<string, number>();
  const movedNumberById = new Map<string, number>();
  let next = 1;
  for (const slot of slots) {
    // Đi theo chuỗi dời lịch tới buổi đang giữ vị trí.
    const chain: NumberableSession[] = [slot];
    let holder = slot;
    const seen = new Set([slot.id]);
    while (holder.status === "RESCHEDULED") {
      const replacement = replacementOf.get(holder.id);
      if (!replacement || seen.has(replacement.id)) break;
      seen.add(replacement.id);
      chain.push(replacement);
      holder = replacement;
    }
    // Vị trí bị bỏ: buổi giữ vị trí đã cho nghỉ, hoặc buổi đã dời mà không có buổi bù.
    if (holder.status === "CANCELLED" || holder.status === "RESCHEDULED") continue;
    const number = next++;
    numberById.set(holder.id, number);
    for (const moved of chain.slice(0, -1)) movedNumberById.set(moved.id, number);
  }
  return { numberById, movedNumberById, count: next - 1 };
}

/** Vị trí xa nhất đã dạy (để khóa tài liệu các buổi đã dạy khi sửa lộ trình). */
export function lastTaughtNumber(sessions: NumberableSession[]): number {
  const { numberById } = computeSessionNumbers(sessions);
  let last = 0;
  for (const s of sessions) {
    if (s.status === "COMPLETED") last = Math.max(last, numberById.get(s.id) ?? 0);
  }
  return last;
}
