/**
 * Permission Middleware
 * 
 * Middleware để check permissions trước khi cho phép API request
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, hasAnyPermission } from "@/lib/permissions";

type PermissionConfig = {
  resource: string;
  action: string;
  scope?: "all" | "branch" | "own";
};

/**
 * Wrapper middleware để check permission
 * 
 * Usage:
 * export const GET = withPermission("student.view.branch", async (req) => {
 *   // Your handler code
 * });
 */
export function withPermission(
  permissionKey: string,
  handler: Function
) {
  return async (req: Request, context?: any) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await hasPermission(session.user.id, permissionKey);

    if (!allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionKey}` },
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}

/**
 * Check nếu user có ít nhất 1 trong các permissions
 */
export function withAnyPermission(
  permissionKeys: string[],
  handler: Function
) {
  return async (req: Request, context?: any) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await hasAnyPermission(session.user.id, permissionKeys);

    if (!allowed) {
      return NextResponse.json(
        { error: `Permission denied: requires one of ${permissionKeys.join(", ")}` },
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}

/**
 * Build permission key từ config
 */
export function buildPermissionKey(config: PermissionConfig): string {
  return `${config.resource}.${config.action}.${config.scope || "branch"}`;
}

/**
 * Helper: require admin role
 */
export function withAdminOnly(handler: Function) {
  return async (req: Request, context?: any) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin only" },
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}
