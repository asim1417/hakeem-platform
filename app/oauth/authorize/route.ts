import {
  createAuthorizationCode,
  isAllowedClientId,
  isAllowedRedirect,
  keysMatch,
  mcpResourceUrl,
  publicOrigin,
} from "@/lib/mcp/oauth";
import { renderAuthorizePage, renderOauthMessage } from "@/lib/mcp/oauth-pages";
import { clientKey, createFailureLimiter } from "@/lib/mcp/rate-limit";
import { accountLinkingEnabled, mcpSharedKey, mcpTokenSecret } from "@/lib/mcp/config";
import { CONSENT_PATH, pendingCookieHeader } from "@/lib/mcp/grants/pending-cookie";
import { PENDING_TTL_SEC, newNonce, nowSec, signPending } from "@/lib/mcp/grants/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_LIMIT = 512;

// 5 محاولات مفتاح فاشلة لكل عنوان خلال 15 دقيقة (أفضل جهد، بالذاكرة).
const keyFailures = createFailureLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

/** نموذج الربط يُرسَل من الأصل نفسه؛ أي Origin مخالف يُرفض (حماية CSRF). */
function sameOriginPost(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // عملاء بلا Origin (curl/اختبارات)؛ المفتاح هو الحارس الفعلي.
  return origin === publicOrigin(request);
}

type AuthorizeInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource: string;
};

export async function GET(request: Request) {
  const input = readInput(new URL(request.url).searchParams);
  const origin = publicOrigin(request);
  const resource = input ? resolveResource(origin, input.resource) : null;
  if (input && !resource) {
    return renderOauthMessage("تعذّر بدء الربط", "مورد الربط لا يطابق خادم حكيم.");
  }

  // الربط بحساب حكيم: نحفظ الطلب موقّعًا في كوكي ثم نحوّل لشاشة الموافقة (تمرّ بالدخول إن لزم).
  const secret = mcpTokenSecret();
  if (input && resource && secret && accountLinkingEnabled()) {
    const pending = signPending(secret, {
      cid: input.clientId,
      ru: input.redirectUri,
      st: input.state,
      cc: input.codeChallenge,
      res: resource,
      sc: input.scope,
      n: newNonce(),
      exp: nowSec() + PENDING_TTL_SEC,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: `${origin}${CONSENT_PATH}`,
        "Set-Cookie": pendingCookieHeader(pending, origin.startsWith("https://")),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  return authorizeResponse(request, input, "");
}

export async function POST(request: Request) {
  // نموذج المفتاح المشترك يُعطَّل حين يُفعَّل الربط بالحساب.
  if (accountLinkingEnabled()) {
    return renderOauthMessage("الربط تغيّر", "صار الربط بحساب حكيم. أعد المحاولة من شاشة الموصلات في Claude.", 410);
  }
  if (!sameOriginPost(request)) {
    return renderOauthMessage("تعذّر بدء الربط", "مصدر الطلب غير مسموح.", 403);
  }
  const who = clientKey(request);
  const waitSec = keyFailures.blockedFor(who);
  if (waitSec > 0) {
    console.warn("[mcp-oauth] authorize throttled");
    const res = renderOauthMessage("محاولات كثيرة", `تجاوزت عدد المحاولات المسموح. أعد المحاولة بعد ${Math.ceil(waitSec / 60)} دقيقة.`, 429);
    res.headers.set("Retry-After", String(waitSec));
    return res;
  }
  const form = await request.formData();
  const input = readInput(form);
  if (!input) {
    return renderOauthMessage("تعذّر بدء الربط", "طلب الربط ناقص أو وجهته غير مسموحة. أعد المحاولة من شاشة الموصلات في Claude.");
  }
  const secret = mcpSharedKey() ?? "";
  const provided = String(form.get("connector_key") ?? "");
  if (!secret || !keysMatch(provided, secret)) {
    console.warn("[mcp-oauth] authorize rejected");
    keyFailures.recordFailure(who);
    return authorizeResponse(request, input, "المفتاح غير مطابق. تحقّق من مفتاح موصل حكيم لدى مسؤول المنصة.");
  }
  const origin = publicOrigin(request);
  const resource = resolveResource(origin, input.resource);
  if (!resource) {
    return renderOauthMessage("تعذّر بدء الربط", "مورد الربط لا يطابق خادم حكيم.");
  }
  keyFailures.reset(who);
  const code = createAuthorizationCode({
    secret,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    resource,
  });
  const target = new URL(input.redirectUri);
  target.searchParams.set("code", code);
  if (input.state) target.searchParams.set("state", input.state);
  target.searchParams.set("iss", origin);
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function authorizeResponse(request: Request, input: AuthorizeInput | null, error: string): Response {
  if (!input) {
    return renderOauthMessage("تعذّر بدء الربط", "طلب الربط ناقص أو وجهته غير مسموحة. أعد المحاولة من شاشة الموصلات في Claude.");
  }
  if (!mcpSharedKey()) {
    return renderOauthMessage("الربط غير متاح", "مفتاح موصل حكيم غير مضبوط على الخادم.", 503);
  }
  const html = renderAuthorizePage({ ...input, error: error || undefined });
  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function readInput(source: { get(name: string): string | File | null }): AuthorizeInput | null {
  const input: AuthorizeInput = {
    clientId: text(source, "client_id"),
    redirectUri: text(source, "redirect_uri"),
    state: text(source, "state"),
    codeChallenge: text(source, "code_challenge"),
    codeChallengeMethod: text(source, "code_challenge_method") || "S256",
    scope: text(source, "scope"),
    resource: text(source, "resource"),
  };
  if (source instanceof URLSearchParams && source.get("response_type") && source.get("response_type") !== "code") {
    return null;
  }
  if (!isAllowedClientId(input.clientId)) return null;
  if (!isAllowedRedirect(input.redirectUri)) return null;
  if (input.codeChallengeMethod !== "S256") return null;
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeChallenge)) return null;
  return input;
}

function text(source: { get(name: string): string | File | null }, name: string): string {
  const value = source.get(name);
  if (typeof value !== "string") return "";
  return value.length > FIELD_LIMIT ? "" : value;
}

function resolveResource(origin: string, requested: string): string | null {
  const expected = mcpResourceUrl(origin);
  if (!requested) return expected;
  return requested.replace(/\/+$/, "") === expected ? expected : null;
}
