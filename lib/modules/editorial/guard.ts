// حارس مكتب التحرير للصفحات والمسارات. لا يستعمل canUser (الذي يمنح SYSTEM_ADMIN كل شيء).
import "server-only";

import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, isAuthDisabled, requireUser } from "@/lib/modules/auth/session";
import {
  canManageSettings,
  canProposeLaws,
  canPublish,
  canReadAudit,
  canReview,
  canViewDesk,
  resolveEditorialAccess,
} from "./access";
import { recordAudit } from "./audit";
import { prismaEditorialDb, type EditorialDb } from "./db";
import { deskPreflight, parseBodyText } from "./http-guard";
import { bindingFor, DEFAULT_EDITORIAL_CONFIG, loadEditorialConfig, type EditorialConfig } from "./policy";
import { isEditorialError, type EditorialActor } from "./types";

export type EditorialNeed = "view" | "propose" | "review" | "publish" | "audit" | "settings";

let cachedDb: EditorialDb | null = null;
export function editorialDb(): EditorialDb {
  cachedDb ??= prismaEditorialDb(prisma);
  return cachedDb;
}

/** كل استجابات /api/admin/legal بلا تخزين مؤقت (ق-١٠). */
export function deskJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * الإعدادات للعرض والحراسة الأولية خارج المعاملة. فشل القراءة = لا تكليف لأحد (فشل مغلق؛ المالك لا يتأثر).
 * أفعال الكتابة تعيد بناء الفاعل داخل معاملتها (desk-tx.ts)، فلا يُعتمد على هذه القراءة في القرار.
 */
async function currentConfig(): Promise<EditorialConfig> {
  try {
    return (await loadEditorialConfig(editorialDb())).config;
  } catch {
    return DEFAULT_EDITORIAL_CONFIG;
  }
}

/** الفاعل من تكليفه في إعدادات المكتب (ق-٢)، لا من الدور ولا من RolePermission. */
export async function editorialActorFor(user: { id: string; role: string }): Promise<EditorialActor> {
  const config = user.role === "SUPER_ADMIN" ? DEFAULT_EDITORIAL_CONFIG : await currentConfig();
  const access = resolveEditorialAccess(user.role, bindingFor(config, user.id));
  // حساب الوكيل الآلي يُسجَّل مؤلفًا آليًّا باسم حسابه، ولا يعتمد ولا ينشر.
  if (access.agent) return { id: user.id, kind: "agent", agentName: `user:${user.id}`, role: user.role, access };
  return { id: user.id, kind: "human", role: user.role, access };
}

function allowed(actor: EditorialActor, need: EditorialNeed): boolean {
  if (need === "review") return canReview(actor.access);
  if (need === "propose") return canProposeLaws(actor.access);
  if (need === "audit") return canReadAudit(actor.access);
  if (need === "publish") return canPublish(actor.access);
  if (need === "settings") return canManageSettings(actor.access);
  return canViewDesk(actor.access);
}

export async function requireEditorialPage(need: EditorialNeed = "view"): Promise<EditorialActor> {
  // المكتب لا يعمل بالمصادقة المعطّلة: الضيف هناك SYSTEM_ADMIN بلا هوية حقيقية.
  if (isAuthDisabled()) redirect("/admin");
  const user = await requireUser();
  const actor = await editorialActorFor(user);
  if (!allowed(actor, need)) redirect("/admin");
  return actor;
}

export async function requireEditorialApi(
  request: NextRequest,
  need: EditorialNeed,
): Promise<{ actor: EditorialActor; response: null } | { actor: null; response: NextResponse }> {
  const rejection = deskPreflight({
    authDisabled: isAuthDisabled(),
    method: request.method,
    origin: request.headers.get("origin"),
    requestOrigin: request.nextUrl.origin,
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    contentLength: request.headers.get("content-length"),
  });
  if (rejection) return { actor: null, response: deskJson({ code: rejection.code, message: rejection.message }, rejection.status) };
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return { actor: null, response: deskJson({ code: "UNAUTHENTICATED", message: "يلزم تسجيل الدخول." }, 401) };
  }
  const actor = await editorialActorFor(user);
  if (!allowed(actor, need)) {
    await recordAudit(editorialDb(), actor, {
      action: "access.denied",
      objectType: "route",
      objectId: request.nextUrl.pathname,
      detail: { need },
    }).catch(() => undefined);
    return { actor: null, response: deskJson({ code: "FORBIDDEN", message: "لا تملك صلاحية هذه العملية في مكتب التحرير." }, 403) };
  }
  return { actor, response: null };
}

/** يقرأ جسم الطلب بحد 64 ك.ب فعلي (لا بالترويسة وحدها). الجسم الفارغ = null. */
export async function readDeskJson(request: NextRequest): Promise<unknown> {
  return parseBodyText(await request.text());
}

/** يحوّل أخطاء الخدمة إلى استجابة؛ ما سواها 500 بلا تفاصيل داخلية. */
export function editorialErrorResponse(error: unknown): NextResponse {
  if (isEditorialError(error)) {
    return deskJson({ code: error.code, message: error.message, detail: error.detail ?? null }, error.status);
  }
  console.error("[editorial] unexpected error", error instanceof Error ? error.message : error);
  return deskJson({ code: "INTERNAL", message: "تعذّر تنفيذ العملية." }, 500);
}

