// حارس مكتب التحرير للصفحات والمسارات. لا يستعمل canUser (الذي يمنح SYSTEM_ADMIN كل شيء).
import "server-only";

import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiUser, requireUser } from "@/lib/modules/auth/session";
import { EDITORIAL_PERMISSIONS } from "@/lib/modules/auth/role-permissions";
import { canProposeLaws, canReview, canViewDesk, resolveEditorialAccess } from "./access";
import { recordAudit } from "./audit";
import { prismaEditorialDb, type EditorialDb } from "./db";
import { isEditorialError, type EditorialActor } from "./types";

export type EditorialNeed = "view" | "propose" | "review";

let cachedDb: EditorialDb | null = null;
export function editorialDb(): EditorialDb {
  cachedDb ??= prismaEditorialDb(prisma);
  return cachedDb;
}

/** منح صلاحيات المكتب للدور من صفحة الأدوار (RolePermission). سقوط آمن إلى لا شيء. */
async function editorialGrantsForRole(role: string): Promise<string[]> {
  try {
    const record = await prisma.roleRecord.findUnique({
      where: { key: role as UserRole },
      include: { permissions: { include: { permission: true } } },
    });
    const editorial = new Set<string>(EDITORIAL_PERMISSIONS);
    const keys: string[] = (record?.permissions ?? []).map((p: { permission: { key: string } }) => p.permission.key);
    return keys.filter((key) => editorial.has(key));
  } catch {
    return [];
  }
}

export async function editorialActorFor(user: { id: string; role: string }): Promise<EditorialActor> {
  const grants = user.role === "SUPER_ADMIN" ? [] : await editorialGrantsForRole(user.role);
  const access = resolveEditorialAccess(user.role, grants);
  // حساب الوكيل الآلي يُسجَّل مؤلفًا آليًّا باسم حسابه، ولا يعتمد ولا ينشر.
  if (access.agent) return { id: user.id, kind: "agent", agentName: `user:${user.id}`, role: user.role, access };
  return { id: user.id, kind: "human", role: user.role, access };
}

function allowed(actor: EditorialActor, need: EditorialNeed): boolean {
  if (need === "review") return canReview(actor.access);
  if (need === "propose") return canProposeLaws(actor.access);
  return canViewDesk(actor.access);
}

export async function requireEditorialPage(need: EditorialNeed = "view"): Promise<EditorialActor> {
  const user = await requireUser();
  const actor = await editorialActorFor(user);
  if (!allowed(actor, need)) redirect("/admin");
  return actor;
}

export async function requireEditorialApi(
  request: NextRequest,
  need: EditorialNeed,
): Promise<{ actor: EditorialActor; response: null } | { actor: null; response: NextResponse }> {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return { actor: null, response: NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 }) };
  }
  const actor = await editorialActorFor(user);
  if (!allowed(actor, need)) {
    await recordAudit(editorialDb(), actor, {
      action: "access.denied",
      objectType: "route",
      objectId: request.nextUrl.pathname,
      detail: { need },
    }).catch(() => undefined);
    return { actor: null, response: NextResponse.json({ message: "لا تملك صلاحية هذه العملية في مكتب التحرير." }, { status: 403 }) };
  }
  return { actor, response: null };
}

/** يحوّل أخطاء الخدمة إلى استجابة؛ ما سواها 500 بلا تفاصيل داخلية. */
export function editorialErrorResponse(error: unknown): NextResponse {
  if (isEditorialError(error)) {
    return NextResponse.json({ code: error.code, message: error.message, detail: error.detail ?? null }, { status: error.status });
  }
  console.error("[editorial] unexpected error", error instanceof Error ? error.message : error);
  return NextResponse.json({ code: "INTERNAL", message: "تعذّر تنفيذ العملية." }, { status: 500 });
}
