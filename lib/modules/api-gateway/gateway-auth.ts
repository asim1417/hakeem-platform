// ─────────────────────────────────────────────────────────────────────────────
// GatewayAuth — مصادقة بوابة API الخارجية فوق مسارات النواة القانونية.
// المسار الخارجي: مفتاح API (Bearer/x-api-key) → تحقّق + نطاق + حدّ معدّل.
// المسار الداخلي: يسقط إلى جلسة المنصّة + RBAC (لا يكسر وصول المستخدمين).
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import {
  type ApiScope,
  extractPresentedKey,
  hashApiKey,
  keyHasScope,
  looksLikeApiKey,
  windowBucket,
} from "./api-keys";

export type GatewayPrincipal =
  | { kind: "api_key"; id: string; scopes: string[] }
  | { kind: "session"; id: string };

export interface GatewayGate {
  principal: GatewayPrincipal | null;
  response: NextResponse | null;
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, x-api-key, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** يضيف ترويسات CORS إلى استجابة (الوصول الخارجي بالمفتاح لا يعتمد على الكوكيز). */
export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** استجابة preflight للطلبات العابرة للأصل. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** عدّاد حدّ المعدّل (fixed window لكل دقيقة) عبر UPSERT ذرّي في القاعدة. */
async function consumeRateLimit(apiKeyId: string, rateLimit: number): Promise<{ allowed: boolean; count: number; limit: number }> {
  const bucket = windowBucket(Date.now());
  const row = await prisma.apiRequestWindow.upsert({
    where: { apiKeyId_windowStart: { apiKeyId, windowStart: bucket } },
    create: { apiKeyId, windowStart: bucket, count: 1 },
    update: { count: { increment: 1 } },
  });
  return { allowed: row.count <= rateLimit, count: row.count, limit: rateLimit };
}

const json = (message: string, status: number, extra?: Record<string, string>) =>
  NextResponse.json({ ok: false, error: message }, { status, headers: extra });

/**
 * يتحقّق من مفتاح API الخارجي: وجوده وصيغته وصلاحيته ونطاقه وحدّ معدّله.
 * يعيد principal عند النجاح أو استجابة خطأ (401/403/429).
 */
export async function requireApiKey(request: NextRequest, scope: ApiScope): Promise<GatewayGate> {
  const presented = extractPresentedKey({
    authorization: request.headers.get("authorization"),
    apiKey: request.headers.get("x-api-key"),
  });
  if (!presented) return { principal: null, response: json("مفتاح API مطلوب (Authorization: Bearer أو x-api-key).", 401) };
  if (!looksLikeApiKey(presented)) return { principal: null, response: json("صيغة مفتاح API غير صحيحة.", 401) };

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(presented) } }).catch(() => null);
  if (!key || !key.active) return { principal: null, response: json("مفتاح API غير صالح أو موقوف.", 401) };
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return { principal: null, response: json("انتهت صلاحية مفتاح API.", 401) };
  if (!keyHasScope(key.scopes, scope)) return { principal: null, response: json(`المفتاح لا يملك النطاق المطلوب: ${scope}.`, 403) };

  const rl = await consumeRateLimit(key.id, key.rateLimit).catch(() => ({ allowed: true, count: 0, limit: key.rateLimit }));
  if (!rl.allowed) return { principal: null, response: json(`تجاوزت حدّ المعدّل (${rl.limit}/دقيقة).`, 429, { "Retry-After": "60" }) };

  // تحديث آخر استخدام (best-effort، لا يعطّل الطلب).
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { principal: { kind: "api_key", id: key.id, scopes: key.scopes }, response: null };
}

/**
 * وصول قراءة النواة القانونية: مفتاح خارجي إن وُجد في الترويسة، وإلا جلسة داخلية
 * + صلاحية LEGAL_CORE_VIEW. لا يكسر وصول المستخدمين الحاليين.
 */
export async function requireLegalReadAccess(request: NextRequest, scope: ApiScope = "legal:read"): Promise<GatewayGate> {
  const hasKeyHeader = request.headers.get("authorization") || request.headers.get("x-api-key");
  if (hasKeyHeader) return requireApiKey(request, scope);

  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return { principal: null, response: gate.response };
  return { principal: { kind: "session", id: gate.user?.id ?? "session" }, response: null };
}

/**
 * غلاف موحّد لمسارات /api/legal/*: مصادقة مزدوجة + CORS + التقاط الأخطاء.
 * يمرّر principal إلى المعالِج ويضيف CORS إلى كل استجابة.
 */
export async function handleLegalApi(
  request: NextRequest,
  scope: ApiScope,
  handler: (principal: GatewayPrincipal) => Promise<NextResponse>
): Promise<NextResponse> {
  const gate = await requireLegalReadAccess(request, scope);
  if (gate.response) return withCors(gate.response);
  try {
    return withCors(await handler(gate.principal as GatewayPrincipal));
  } catch {
    return withCors(NextResponse.json({ ok: false, error: "خطأ داخلي في الخادم." }, { status: 500 }));
  }
}
