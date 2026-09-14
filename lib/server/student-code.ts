import type { Prisma, PrismaClient } from "@prisma/client";

// MÃ HỌC VIÊN: HV-001, HV-002, ... — đơn giản, đọc qua điện thoại được, xếp đúng thứ tự.
//
// Trước đây ba chỗ tạo học viên sinh mã ba kiểu: tạo tay ra mã ngẫu nhiên ("HV3F9A1C2B"),
// chuyển từ CRM lấy luôn mã lead ("LEAD-0101", "LEADED15C863"), nhập nhanh thì đổi "LEAD"
// thành "HV". Danh sách học viên lẫn lộn STU-0001, LEAD-0005, HV0956093F... không ai nhớ nổi.
//
// Quy tắc: lấy số lớn nhất trong các mã đang có dạng HV-<số> rồi cộng 1, đệm tối thiểu 3
// chữ số. Qua 999 thì tự thành HV-1000, HV-1001... — độ dài tăng theo, không bao giờ cắt số.

const CODE_PATTERN = /^HV-(\d+)$/;

export function formatStudentCode(sequence: number): string {
  const digits = String(sequence);
  return `HV-${digits.padStart(Math.max(3, digits.length), "0")}`;
}

export function parseStudentCodeSequence(code: string): number | null {
  const match = CODE_PATTERN.exec(code.trim());
  return match ? Number(match[1]) : null;
}

/** Mã kế tiếp theo số lớn nhất đang có. */
export async function nextStudentCode(db: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const rows = await db.student.findMany({
    where: { studentCode: { startsWith: "HV-" } },
    select: { studentCode: true },
  });
  let max = 0;
  for (const row of rows) {
    const value = parseStudentCodeSequence(row.studentCode);
    if (value !== null && value > max) max = value;
  }
  return formatStudentCode(max + 1);
}

/**
 * Chạy lại việc tạo khi 2 người tạo học viên cùng lúc lấy trùng một mã. Mã có ràng buộc
 * duy nhất trong CSDL nên người thứ hai nhận lỗi P2002 — thử lại thì sẽ lấy được số kế tiếp.
 */
export async function withStudentCodeRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const code = (error as { code?: string }).code;
      const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? "");
      if (code === "P2002" && /student_code|studentCode/.test(target) && attempt < attempts) continue;
      throw error;
    }
  }
}
