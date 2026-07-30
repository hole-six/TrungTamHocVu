import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssistantScorecard } from "@/lib/server/assistant-score-rules";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const month = new URL(req.url).searchParams.get("month");
  if (!month) return NextResponse.json({ error: "Thiếu tham số month (vd 2026-06)" }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const scorecard = await computeAssistantScorecard(params.id, month);

  return NextResponse.json({ employee: { id: employee.id, fullName: employee.fullName, shortName: employee.shortName }, month, ...scorecard });
}
