/**
 * استخراج هوية من عودة Clerk (handshake) وتثبيت hakeem_session.
 * يُستخدم عندما يفشل مسار الكوكيز على Safari لكن وُجدت معاملات في الرابط أو جلسة قصيرة.
 */
import "server-only";

import { createClerkClient, verifyToken } from "@clerk/backend";
import { establishFirstPartySession } from "@/lib/modules/auth/establish-session";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import type { SafeUser } from "@/lib/modules/auth/session";
import { isPhoneOnlyLocalEmail, localEmailForClerkUser } from "@/lib/modules/auth/clerk-local-email";

type ClerkUser = Awaited<ReturnType<ReturnType<typeof createClerkClient>["users"]["getUser"]>>;

/** هوية الصف المحلي — حساب الجوال وحده (بلا بريد) يأخذ معرّفًا داخليًا ثابتًا بدل الرفض. */
function localIdentity(u: ClerkUser): { email: string; name: string; clerkId: string } {
  const email = localEmailForClerkUser(u);
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || (isPhoneOnlyLocalEmail(email) ? "مستخدم حكيم" : "");
  return { email, name, clerkId: u.id };
}

function parseSessionFromCookieDirectives(directives: string[]): string | null {
  for (const d of directives) {
    const m = d.match(/(?:^|;\s*)__session=([^;]+)/);
    if (m?.[1]) return decodeURIComponent(m[1].trim());
  }
  return null;
}

export async function claimSessionFromClerkReturn(input: {
  handshakeNonce?: string | null;
  handshakeToken?: string | null;
  sessionJwt?: string | null;
}): Promise<SafeUser | null> {
  if (!isClerkConfigured()) return null;
  const secretKey = (process.env.CLERK_SECRET_KEY || "").trim();
  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  if (!secretKey || !publishableKey) return null;

  const client = createClerkClient({ secretKey });
  let sessionJwt = (input.sessionJwt || "").trim();

  if (!sessionJwt && input.handshakeNonce) {
    try {
      const payload = await client.clients.getHandshakePayload({
        nonce: input.handshakeNonce,
      });
      sessionJwt = parseSessionFromCookieDirectives(payload.directives || []) || "";
    } catch {
      /* */
    }
  }

  // بعض العودات تضع JWT الجلسة مباشرة
  if (!sessionJwt && input.handshakeToken) {
    try {
      const payload = await verifyToken(input.handshakeToken, { secretKey });
      // قد يكون handshake وليس session — نتجاهل إن لم يوجد sub/user
      const sub = typeof payload.sub === "string" ? payload.sub : "";
      if (sub.startsWith("user_")) {
        const u = await client.users.getUser(sub);
        return establishFirstPartySession(localIdentity(u));
      }
    } catch {
      /* */
    }
  }

  if (!sessionJwt) return null;

  // المفتاح من Vercel قد يستبدله hydrateEnvFromSettings بمفتاح محفوظ في الإعدادات — نجرّب الاثنين
  // (التحقق بأيّهما يثبت أن الرمز صادر عن نسخة Clerk نفسها)، ونجلب المستخدم بالمفتاح الذي نجح.
  const keys = Array.from(new Set([secretKey, ENV_SECRET_AT_LOAD].filter(Boolean)));
  let userId = "";
  let verifiedKey = "";
  let verifyError: unknown = null;
  for (const key of keys) {
    try {
      const payload = await verifyToken(sessionJwt, { secretKey: key });
      userId = typeof payload.sub === "string" ? payload.sub : "";
      verifiedKey = key;
      break;
    } catch (err) {
      verifyError = err;
    }
  }
  if (!verifiedKey) return logClaimFailure("verify", verifyError, keys.length);
  if (!userId) return logClaimFailure("no_sub", null, keys.length);

  let u: ClerkUser;
  try {
    u = await createClerkClient({ secretKey: verifiedKey }).users.getUser(userId);
  } catch (err) {
    return logClaimFailure("get_user", err, keys.length);
  }
  try {
    return await establishFirstPartySession(localIdentity(u));
  } catch (err) {
    return logClaimFailure("establish", err, keys.length);
  }
}

/** مفتاح Vercel عند تحميل الوحدة — قبل أي استبدال من الإعدادات المُدارة. */
const ENV_SECRET_AT_LOAD = (process.env.CLERK_SECRET_KEY || "").trim();

/**
 * سبب الرفض في سجلات Vercel — المرحلة ورمز الخطأ فقط: لا رمز جلسة ولا بريد ولا جوال ولا معرّف.
 */
function logClaimFailure(stage: string, err: unknown, keysTried: number): null {
  const e = (err ?? {}) as { name?: unknown; reason?: unknown; code?: unknown; status?: unknown; errors?: unknown };
  const clerkCode = Array.isArray(e.errors) ? (e.errors[0] as { code?: unknown } | undefined)?.code : undefined;
  const kind = (k: string | undefined) => (k || "").trim().slice(0, 8).replace(/[^a-z_]/g, "") || "none";
  console.warn(
    JSON.stringify({
      event: "claim_clerk_session_failed",
      stage,
      error: typeof e.name === "string" ? e.name : undefined,
      reason: typeof e.reason === "string" ? e.reason : undefined,
      code: typeof e.code === "string" ? e.code : typeof clerkCode === "string" ? clerkCode : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      keysTried,
      secretOverridden: Boolean(ENV_SECRET_AT_LOAD) && ENV_SECRET_AT_LOAD !== (process.env.CLERK_SECRET_KEY || "").trim(),
      secretKind: kind(process.env.CLERK_SECRET_KEY),
      publishableKind: kind(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    })
  );
  return null;
}
