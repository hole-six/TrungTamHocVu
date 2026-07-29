import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch-filter";

/**
 * GET /api/branches/[id]
 * Lấy thông tin chi tiết branch
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Kiểm tra quyền truy cập
    const hasAccess = await canAccessBranch(id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: No access to this branch" },
        { status: 403 }
      );
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            users: true,
            employees: true,
            students: true,
            classes: true,
            leads: true,
            books: true,
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json(branch);
  } catch (error) {
    console.error("GET /api/branches/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/branches/[id]
 * Cập nhật thông tin branch (chỉ admin)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await req.json();
    const { name, address, phone, isActive } = body;

    // Không cho phép thay đổi code
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const branch = await prisma.branch.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(branch);
  } catch (error: any) {
    console.error("PATCH /api/branches/[id] error:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branches/[id]
 * Xóa branch (chỉ admin, và branch phải không có dữ liệu)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Kiểm tra xem branch có dữ liệu không
    const counts = await prisma.branch.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            users: true,
            employees: true,
            students: true,
            classes: true,
          },
        },
      },
    });

    if (!counts) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const totalRecords = Object.values(counts._count).reduce((a, b) => a + b, 0);

    if (totalRecords > 0) {
      return NextResponse.json(
        { 
          error: `Không thể xóa cơ sở này vì còn ${totalRecords} bản ghi liên quan. Vui lòng chuyển hoặc xóa dữ liệu trước.` 
        },
        { status: 400 }
      );
    }

    // Xóa branch
    await prisma.branch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/branches/[id] error:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
