import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

// Điểm học lực tại trường phổ thông của học viên — nguồn DSHV!BR:BU ("ĐIỂM THI TẠI
// TRƯỜNG": Giữa/Cuối mỗi học kỳ). Trung tâm theo dõi để tư vấn lộ trình học phù hợp.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.schoolExamScore.findMany({
    where: { studentId: params.id },
    orderBy: { schoolYear: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const student = await prisma.student.findUnique({ where: { id: params.id } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });

  const body = await req.json();
  const schoolYear = String(body.schoolYear ?? "").trim();
  if (!schoolYear) return NextResponse.json({ error: "Thiếu năm học (vd 2025-2026)" }, { status: 400 });

  const toScore = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

  const item = await prisma.schoolExamScore.upsert({
    where: { studentId_schoolYear: { studentId: params.id, schoolYear } },
    create: {
      studentId: params.id,
      schoolYear,
      midTerm1: toScore(body.midTerm1),
      finalTerm1: toScore(body.finalTerm1),
      midTerm2: toScore(body.midTerm2),
      finalTerm2: toScore(body.finalTerm2),
      notes: body.notes || null,
    },
    update: {
      midTerm1: toScore(body.midTerm1),
      finalTerm1: toScore(body.finalTerm1),
      midTerm2: toScore(body.midTerm2),
      finalTerm2: toScore(body.finalTerm2),
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
