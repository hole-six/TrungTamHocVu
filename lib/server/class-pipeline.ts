// Ngăn xếp chuyển tiếp: mỗi lớp trỏ tới ĐÚNG MỘT lớp kế (Class.nextClassId), nối lại thành
// chuỗi dài bao nhiêu cũng được — A1 → A2 → B1 → C1 → ... Học viên học hết lớp nào thì
// được đề xuất sang lớp kế của chính lớp đó, hết lớp kế lại sang lớp kế tiếp nữa.
//
// Thứ duy nhất phải cấm là VÒNG LẶP (… → C1 → A1): học xong C1 lại bị đề xuất quay về A1.
// Kiểm tra vòng lặp PHẢI đi trên toàn bộ chuỗi của cơ sở, không chỉ các lớp đang sửa: chuỗi
// dài được dựng qua nhiều lần lưu, nên vòng lặp thường khép qua những lớp không đổi trong
// lần lưu này. Trước đây route hàng loạt chỉ đọc lớp đang đổi + lớp đích trực tiếp, còn
// route sửa một lớp không kiểm tra gì — cả hai đều để lọt vòng lặp (tests/enrollment.test.ts).
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type NextClassUpdate = { classId: string; nextClassId: string | null };

// Đi theo chuỗi từ startId. Quay lại được startId thì trả về đường đi (vòng lặp), còn gặp
// một lớp đã đi qua mà KHÔNG phải startId thì dừng — đó là vòng lặp cũ không chứa startId,
// sẽ bị bắt khi đi từ chính lớp trong vòng đó. Luôn dừng vì mỗi lớp chỉ được đi qua 1 lần.
export function findCycleFrom(nextById: Map<string, string | null>, startId: string): string[] | null {
  const path = [startId];
  const seen = new Set([startId]);
  let cursor = nextById.get(startId) ?? null;
  while (cursor) {
    if (cursor === startId) return path;
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    path.push(cursor);
    cursor = nextById.get(cursor) ?? null;
  }
  return null;
}

// Áp các thay đổi nháp lên TOÀN BỘ lớp của những cơ sở liên quan (mọi trạng thái — chuỗi
// vẫn có thể đi qua lớp đã kết thúc còn giữ nextClassId), rồi tìm vòng lặp đi qua bất kỳ
// lớp nào vừa đổi. Trả về mã lớp theo đúng thứ tự vòng (khép lại ở lớp đầu) để báo lỗi.
export async function findNextClassCycle(db: Db, updates: NextClassUpdate[]): Promise<{ classCodes: string[] } | null> {
  if (updates.length === 0) return null;

  const touched = await db.class.findMany({
    where: { id: { in: updates.map((update) => update.classId) } },
    select: { branchId: true },
  });
  const branchIds = [...new Set(touched.map((item) => item.branchId))];
  const classes = await db.class.findMany({
    where: { branchId: { in: branchIds } },
    select: { id: true, classCode: true, nextClassId: true },
  });

  const nextById = new Map(classes.map((item) => [item.id, item.nextClassId]));
  for (const update of updates) nextById.set(update.classId, update.nextClassId);
  const codeById = new Map(classes.map((item) => [item.id, item.classCode]));

  for (const update of updates) {
    const cycle = findCycleFrom(nextById, update.classId);
    if (cycle) return { classCodes: [...cycle, update.classId].map((id) => codeById.get(id) ?? id) };
  }
  return null;
}
