// KHO TÀI LIỆU CỦA KHÓA HỌC — file tải lên nằm trên ổ đĩa, không nằm trong CSDL.
//
// Vì sao để ngoài thư mục mã nguồn: deploy build vào .next-a/.next-b rồi đổi chỗ (xem
// scripts/deploy.sh). File tài liệu nằm trong thư mục dự án là có ngày bị dọn mất cùng
// một lần build. Thư mục kho đặt riêng, phải được thêm vào quy trình sao lưu.
//
// Tải về luôn đi qua route có kiểm tra đăng nhập, không phơi đường dẫn tĩnh ra ngoài —
// giáo án và đề kiểm tra không nên ai cầm link cũng mở được.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Thư mục kho tài liệu. Đổi được bằng biến môi trường COURSE_UPLOAD_DIR. */
export function uploadRoot(): string {
  return process.env.COURSE_UPLOAD_DIR?.trim() || path.join(process.cwd(), "..", "mshangedu-uploads");
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Chỉ nhận các loại thật sự dùng để dạy. Không nhận file thực thi/script — kho này có
// nhiều người tải lên, mở cửa cho mọi đuôi file là tự rước rủi ro.
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".rtf",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic",
  ".mp3", ".m4a", ".wav", ".mp4", ".mov",
  ".zip",
]);

export function isAllowedUpload(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function describeAllowedUploads(): string {
  return "PDF, Word, Excel, PowerPoint, ảnh, âm thanh, video, zip";
}

/**
 * Tên file lưu trên đĩa: id ngẫu nhiên + đuôi gốc.
 *
 * Không dùng tên người dùng đặt để tránh ký tự lạ, trùng tên và mọi trò đi ngược thư mục
 * ("../../"). Tên gốc vẫn được giữ trong CSDL để hiện ra và đặt lại lúc tải về.
 */
export function buildStoredName(originalName: string): string {
  return `${randomUUID()}${path.extname(originalName).toLowerCase()}`;
}

/** Đường dẫn tuyệt đối từ đường dẫn tương đối lưu trong CSDL, có chặn thoát khỏi kho. */
export function resolveStoredPath(relativePath: string): string | null {
  const root = path.resolve(uploadRoot());
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export async function saveCourseFile(
  courseId: string,
  originalName: string,
  bytes: Buffer,
): Promise<{ filePath: string; checksum: string }> {
  const relativeDir = path.join("courses", courseId);
  const absoluteDir = path.join(uploadRoot(), relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const storedName = buildStoredName(originalName);
  await writeFile(path.join(absoluteDir, storedName), bytes);
  return {
    filePath: path.join(relativeDir, storedName).split(path.sep).join("/"),
    checksum: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
  };
}

/** Xóa file khỏi kho; file đã mất thì bỏ qua (không để sót dòng trong CSDL vì lỗi này). */
export async function deleteCourseFile(relativePath: string): Promise<void> {
  const target = resolveStoredPath(relativePath);
  if (!target) return;
  await unlink(target).catch(() => {});
}
