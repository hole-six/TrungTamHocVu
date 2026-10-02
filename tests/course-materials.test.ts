// Test tự động: KHO TÀI LIỆU KHÓA HỌC. Chạy: npm run test:materials
//
// Kho này cho nhiều người tải file lên. Hai thứ phải chặn bằng được:
//   - tên file do người dùng đặt KHÔNG được quyết định chỗ lưu (đi ngược thư mục);
//   - chỉ nhận loại file dùng để dạy, không nhận file chạy được.
import { test, expectEqual, expectTrue, summary } from "./harness";

async function main() {
  const { isAllowedUpload, buildStoredName, resolveStoredPath, uploadRoot, MAX_FILE_BYTES } = await import(
    "@/lib/server/course-materials"
  );
  const path = await import("node:path");
  console.log("Chạy test kho tài liệu khóa học:\n");

  await test("Chỉ nhận loại file dùng để dạy", async () => {
    expectTrue(isAllowedUpload("giao-an.pdf"), "pdf");
    expectTrue(isAllowedUpload("DE-MINITEST.DOCX"), "docx viết hoa");
    expectTrue(isAllowedUpload("nghe.mp3"), "mp3");
    expectTrue(!isAllowedUpload("virus.exe"), "exe");
    expectTrue(!isAllowedUpload("script.sh"), "sh");
    expectTrue(!isAllowedUpload("trang.html"), "html");
    expectTrue(!isAllowedUpload("khong-co-duoi"), "không có đuôi");
  });

  await test("Tên file lưu trên đĩa không lấy theo tên người dùng đặt", async () => {
    const stored = buildStoredName("Giáo án Unit 1 (bản mới).pdf");
    expectTrue(stored.endsWith(".pdf"), "giữ đuôi gốc");
    expectTrue(!stored.includes(" "), "không còn khoảng trắng");
    expectTrue(!/[Gg]iáo/.test(stored), "không còn tên gốc");
    expectTrue(buildStoredName("a.pdf") !== buildStoredName("a.pdf"), "hai lần tải cùng tên không đè nhau");
  });

  // Đây là chốt quan trọng nhất: một đường dẫn kiểu "../../.env" không được phép thoát
  // ra khỏi kho tài liệu.
  await test("Không cho đi ngược ra ngoài thư mục kho", async () => {
    expectTrue(resolveStoredPath("courses/abc/file.pdf") !== null, "đường dẫn hợp lệ");
    expectEqual(resolveStoredPath("../../.env"), null, "đi ngược hai cấp");
    expectEqual(resolveStoredPath("courses/../../secret.txt"), null, "đi ngược ở giữa");
    const ok = resolveStoredPath("courses/abc/file.pdf");
    expectTrue(ok!.startsWith(path.resolve(uploadRoot())), "nằm trong kho");
  });

  await test("Kho tài liệu nằm NGOÀI thư mục mã nguồn", async () => {
    const root = path.resolve(uploadRoot());
    const project = path.resolve(process.cwd());
    expectTrue(!root.startsWith(project + path.sep), `kho (${root}) không nằm trong dự án (${project})`);
  });

  await test("Có giới hạn dung lượng mỗi file", async () => {
    expectTrue(MAX_FILE_BYTES > 0 && MAX_FILE_BYTES <= 100 * 1024 * 1024, "giới hạn hợp lý");
  });

  const failed = summary();
  process.exit(failed ? 1 : 0);
}

main();
