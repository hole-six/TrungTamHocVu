// TẢI VỀ MỘT TÀI LIỆU CỦA KHÓA HỌC.
//
// Đi qua route này chứ không phơi thư mục kho ra làm thư mục tĩnh: giáo án và đề kiểm
// tra chỉ người đã đăng nhập mới mở được, và tên file tải về vẫn là tên gốc người soạn
// đặt (trên đĩa lưu bằng id ngẫu nhiên — xem lib/server/course-materials.ts).
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { resolveStoredPath } from "@/lib/server/course-materials";

export async function GET(_req: NextRequest, { params }: { params: { id: string; materialId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const item = await prisma.courseMaterial.findFirst({
    where: { id: params.materialId, courseId: params.id },
  });
  if (!item) return NextResponse.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  if (item.kind !== "FILE" || !item.filePath) {
    return NextResponse.json({ error: "Tài liệu này là đường dẫn, mở thẳng link thay vì tải về." }, { status: 400 });
  }

  const absolute = resolveStoredPath(item.filePath);
  if (!absolute) return NextResponse.json({ error: "Đường dẫn tài liệu không hợp lệ" }, { status: 400 });

  const bytes = await readFile(absolute).catch(() => null);
  if (!bytes) {
    return NextResponse.json(
      { error: "File không còn trong kho tài liệu — có thể đã bị xóa ngoài hệ thống. Tải lên lại giúp." },
      { status: 404 },
    );
  }

  const fileName = item.fileName ?? "tai-lieu";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": item.contentType || "application/octet-stream",
      // filename* để tên tiếng Việt có dấu không bị vỡ khi tải về.
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
