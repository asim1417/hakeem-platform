/**
 * بوابة السوبر أدمن — دور SUPER_ADMIN + Feature Flag.
 * لا تُستخدم صلاحية canUser وحدها لأن SYSTEM_ADMIN يتجاوز كل الصلاحيات.
 */
import "server-only";

import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, requireUser, type SafeUser } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";

type Actor = Pick<SafeUser, "id" | "role" | "email">;

/** إيقاف طارئ لأقسام السوبر أدمن دون إزالة الدور: SUPER_ADMIN_PANEL_ENABLED=0 */
export function isSuperAdminPanelEnabled(): boolean {
  return process.env.SUPER_ADMIN_PANEL_ENABLED !== "0";
}

export function isSuperAdmin(user: Actor | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN";
}

/** مدير منصة (سوبر أو مدير نظام) — لتجاوز عزل الملكية والتنقّل الإداري. */
export function isPlatformAdmin(user: Actor | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN" || user?.role === "SYSTEM_ADMIN";
}

export async function requireSuperAdminPage(): Promise<SafeUser> {
  const user = await requireUser();
  if (!isSuperAdminPanelEnabled() || !isSuperAdmin(user)) {
    redirect("/admin");
  }
  return user;
}

export async function requireSuperAdminApi(request?: NextRequest): Promise<
  | { user: SafeUser; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return {
      response: NextResponse.json({ message: "يجب تسجيل الدخول." }, { status: 401 }),
    };
  }
  if (!isSuperAdminPanelEnabled() || !isSuperAdmin(user)) {
    if (request) {
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ACCESS_DENIED",
        metadata: {
          description: "رفض وصول لواجهة سوبر أدمن",
          path: request.nextUrl.pathname,
        },
      }).catch(() => undefined);
    }
    return {
      response: NextResponse.json({ message: "هذه العملية محصورة بمالك المنصة (سوبر أدمن)." }, { status: 403 }),
    };
  }
  return { user };
}

/** هل يحق للفاعل تعيين أو تعديل دور SUPER_ADMIN؟ */
export function canAssignSuperAdmin(actor: Actor): boolean {
  return isSuperAdmin(actor) && isSuperAdminPanelEnabled();
}
