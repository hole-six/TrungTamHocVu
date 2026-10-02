// TÀI LIỆU CỦA KHÓA HỌC: tải file lên hoặc dán link, gắn cho cả khóa hoặc đúng một buổi.
//
// Trước đây mỗi khóa chỉ có MỘT ô link duy nhất nên tài liệu rời của từng buổi không có
// chỗ để, và không tải file lên được. Soạn ở đây một lần là mọi lớp cùng khóa dùng chung.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import {
  MAX_FILE_BYTES,
  deleteCourseFile,
  describeAllowedUploads,
  isAllowedUpload,
  saveCourseFile,
} from "@/lib/server/course-materials";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.courseMaterial.findMany({
    where: { courseId: params.id },
    orderBy: [{ sessionNumber: "asc" }, { createdAt: "asc" }],
    include: { uploadedBy: { select: { fullName: true, email: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền thêm tài liệu cho khóa học" }, { status: 403 });
  }

  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  // --- Dán link ---
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const url = String(body.url ?? "").trim();
    if (!url) return NextResponse.json({ error: "Thiếu đường dẫn tài liệu" }, { status: 400 });
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Đường dẫn phải bắt đầu bằng http:// hoặc https://" }, { status: 400 });
    }
    const item = await prisma.courseMaterial.create({
      data: {
        courseId: course.id,
        sessionNumber: normalizeSession(body.sessionNumber),
        kind: "LINK",
        title: String(body.title ?? "").trim() || url,
        url,
        uploadedById: user.id,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  // --- Tải file lên ---
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Thiếu file cần tải lên" }, { status: 400 });
  if (!isAllowedUpload(file.name)) {
    return NextResponse.json({ error: `Chỉ nhận ${describeAllowedUploads()}.` }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File tối đa ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB. File lớn hơn thì tải lên Drive rồi dán link vào đây.` },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { filePath } = await saveCourseFile(course.id, file.name, bytes);
  const item = await prisma.courseMaterial.create({
    data: {
      courseId: course.id,
      sessionNumber: normalizeSession(formData.get("sessionNumber")),
      kind: "FILE",
      title: String(formData.get("title") ?? "").trim() || file.name,
      filePath,
      fileName: file.name,
      sizeBytes: file.size,
      contentType: file.type || null,
      uploadedById: user.id,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền xóa tài liệu khóa học" }, { status: 403 });
  }

  const materialId = new URL(req.url).searchParams.get("materialId") ?? "";
  const item = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId: params.id } });
  if (!item) return NextResponse.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });

  // Xóa dòng trước, xóa file sau: file mất mà dòng còn lại thì bấm vào báo lỗi mãi.
  await prisma.courseMaterial.delete({ where: { id: item.id } });
  if (item.kind === "FILE" && item.filePath) await deleteCourseFile(item.filePath);
  return NextResponse.json({ ok: true });
}

function normalizeSession(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
