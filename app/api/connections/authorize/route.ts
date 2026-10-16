/**
 * POST /api/connections/authorize — قرار المستخدم في شاشة الموافقة (موافق/رفض).
 * يتحقق من: الجلسة، الأصل نفسه، الطلب المعلّق الموقّع في الكوكي، وتطابق nonce النموذج.
 * موافق ← رمز تفويض لمرة واحدة إلى عنوان الرجوع. رفض ← access_denied. وفي الحالتين يُمسح الكوكي.
 */
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { accountLinkingEnabled, mcpTokenSecret } from "@/lib/mcp/config";
import { isSameOriginPost, publicOrigin } from "@/lib/mcp/oauth";
import { renderOauthMessage } from "@/lib/mcp/oauth-pages";
import { getGrantStore } from "@/lib/mcp/grants/prisma-store";
import { clearPendingCookieHeader, readPendingCookie } from "@/lib/mcp/grants/pending-cookie";
import { clientDisplayName, issueAuthorizationCode } from "@/lib/mcp/grants/service";
import { readPending } from "@/lib/mcp/grants/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(location: string, secure: boolean): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Set-Cookie": clearPendingCookieHeader(secure),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  const secret = mcpTokenSecret();
  if (!secret || !accountLinkingEnabled()) {
    return renderOauthMessage("الربط غير متاح", "الربط بحساب حكيم غير مفعّل على الخادم.", 503);
  }

  const origin = publicOrigin(request);
  if (!isSameOriginPost(request)) {
    return renderOauthMessage("تعذّر الربط", "مصدر الطلب غير مسموح.", 403);
  }

  const user = await getApiUser(request);
  if (!user?.isActive) {
    return renderOauthMessage("يلزم تسجيل الدخول", "سجّل الدخول إلى حكيم ثم أعد الربط من Claude.", 401);
  }

  const pending = readPending(secret, readPendingCookie(request.headers.get("cookie")));
  const form = await request.formData().catch(() => null);
  const nonce = typeof form?.get("nonce") === "string" ? String(form?.get("nonce")) : "";
  const decision = form?.get("decision");
  if (!pending || !nonce || nonce !== pending.n) {
    return renderOauthMessage("انتهت صلاحية الطلب", "انتهت مهلة طلب الربط أو لم يعد صالحًا. ابدأ الربط من Claude مرة أخرى.", 400);
  }

  const secure = origin.startsWith("https://");
  const target = new URL(pending.ru);
  if (pending.st) target.searchParams.set("state", pending.st);
  target.searchParams.set("iss", origin);

  if (decision !== "approve") {
    target.searchParams.set("error", "access_denied");
    await auditEvent({
      actorId: user.id,
      subject: "AUTH",
      action: "MCP_LINK_DENIED",
      metadata: { client: clientDisplayName(pending.ru) },
    }).catch(() => undefined);
    return redirectTo(target.toString(), secure);
  }

  try {
    const code = await issueAuthorizationCode({ store: getGrantStore(), userId: user.id, pending });
    target.searchParams.set("code", code);
  } catch (e) {
    console.error("[mcp-oauth] issue code failed", (e as Error)?.message?.slice(0, 160));
    target.searchParams.set("error", "server_error");
    return redirectTo(target.toString(), secure);
  }

  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "MCP_LINK_APPROVED",
    metadata: { client: clientDisplayName(pending.ru) },
  }).catch(() => undefined);
  return redirectTo(target.toString(), secure);
}
