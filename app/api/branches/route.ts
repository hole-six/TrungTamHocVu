import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAccessibleBranches } from "@/lib/branch-filter";

/**
 * GET /api/branches
 * Lấy danh sách branches mà user có quyền xem
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branches = await getAccessibleBranches();

    // Thêm count cho mỗi branch
    const branchesWithCount = await Promise.all(
      branches.map(async (branch) => {
        const [users, employees, students, classes] = await Promise.all([
          prisma.user.count({ where: { branchId: branch.id } }),
          prisma.employee.count({ where: { branchId: branch.id } }),
          prisma.student.count({ where: { branchId: branch.id } }),
          prisma.class.count({ where: { branchId: branch.id } }),
        ]);

        return {
          ...branch,
          _count: {
            users,
            employees,
            students,
            classes,
          },
        };
      })
    );

    return NextResponse.json(branchesWithCount);
  } catch (error) {
    console.error("GET /api/branches error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branches
 * Tạo branch mới (chỉ admin)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kiểm tra quyền admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { organizationId, code, name, address, phone, isActive } = body;

    // Validate required fields
    if (!organizationId || !code || !name) {
      return NextResponse.json(
        { error: "Missing required fields: organizationId, code, name" },
        { status: 400 }
      );
    }

    // Kiểm tra code đã tồn tại chưa
    const existing = await prisma.branch.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Mã cơ sở "${code}" đã tồn tại` },
        { status: 400 }
      );
    }

    // Tạo branch mới
    const branch = await prisma.branch.create({
      data: {
        organizationId,
        code: code.toUpperCase(),
        name,
        address: address || null,
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    console.error("POST /api/branches error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
