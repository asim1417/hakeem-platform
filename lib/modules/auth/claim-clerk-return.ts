/**
 * استخراج هوية من عودة Clerk (handshake) وتثبيت hakeem_session.
 * يُستخدم عندما يفشل مسار الكوكيز على Safari لكن وُجدت معاملات في الرابط أو جلسة قصيرة.
 */
import "server-only";

import { createClerkClient, verifyToken } from "@clerk/backend";
import { establishFirstPartySession } from "@/lib/modules/auth/establish-session";
import {
  clerkKeyKind,
  clerkKeysAligned,
  isClerkConfigured,
  secretMatchesPublishable,
} from "@/lib/modules/auth/clerk-config";
import type { SafeUser } from "@/lib/modules/auth/session";
import { isPhoneOnlyLocalEmail, localEmailForClerkUser } from "@/lib/modules/auth/clerk-local-email";
import { hydrateEnvFromSettings, originalEnvValue } from "@/lib/modules/settings/settings-service";

type ClerkUser = Awaited<ReturnType<ReturnType<typeof createClerkClient>["users"]["getUser"]>>;

/** تشخيص آمن للعميل/السجلات — بلا رمز جلسة ولا بريد ولا جوال. */
export type ClaimClerkFailure = {
  stage: "not_configured" | "verify" | "no_sub" | "get_user" | "establish";
  secretKind: string;
  publishableKind: string;
  keysTried: number;
  secretOverridden: boolean;
  keysAligned: boolean;
};

export type ClaimClerkResult =
  | { ok: true; user: SafeUser }
  | { ok: false; failure: ClaimClerkFailure };

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

function keyMeta() {
  const secret = (process.env.CLERK_SECRET_KEY || "").trim();
  const vercel = originalEnvValue("CLERK_SECRET_KEY").trim();
  return {
    secretKind: clerkKeyKind(secret),
    publishableKind: clerkKeyKind(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    secretOverridden: vercel !== secret,
    keysAligned: clerkKeysAligned(),
  };
}

function fail(stage: ClaimClerkFailure["stage"], keysTried: number, err?: unknown): ClaimClerkResult {
  const meta = keyMeta();
  const failure: ClaimClerkFailure = { stage, keysTried, ...meta };
  logClaimFailure(failure, err);
  return { ok: false, failure };
}

/**
 * مفاتيح التحقق: نفضّل ما يطابق pk_* الفعّال، ثم نجرّب الباقي.
 * يمنع الاعتماد على sk_test_ من الإعدادات عندما الواجهة pk_live_.
 */
function verificationSecretKeys(primary: string): string[] {
  const vercelKey = originalEnvValue("CLERK_SECRET_KEY").trim();
  const raw = [primary, vercelKey].filter(Boolean);
  const unique = Array.from(new Set(raw));
  const matching = unique.filter((k) => secretMatchesPublishable(k));
  const rest = unique.filter((k) => !secretMatchesPublishable(k));
  return [...matching, ...rest];
}

export async function claimSessionFromClerkReturn(input: {
  handshakeNonce?: string | null;
  handshakeToken?: string | null;
  sessionJwt?: string | null;
}): Promise<SafeUser | null> {
  const result = await claimClerkSessionDetailed(input);
  return result.ok ? result.user : null;
}

/** تفصيلي — يعيد سبب الرفض الآمن لواجهة الدخول و/api/auth/claim-clerk-session. */
export async function claimClerkSessionDetailed(input: {
  handshakeNonce?: string | null;
  handshakeToken?: string | null;
  sessionJwt?: string | null;
}): Promise<ClaimClerkResult> {
  // الإعدادات المُدارة أولًا (كما تفعل بقية الصفحات)، فتتضح حالة المفتاح في كل طلب لا حسب النسخة
  await hydrateEnvFromSettings().catch(() => 0);
  if (!isClerkConfigured()) return fail("not_configured", 0);
  const secretKey = (process.env.CLERK_SECRET_KEY || "").trim();
  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  if (!secretKey || !publishableKey) return fail("not_configured", 0);

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
        try {
          const user = await establishFirstPartySession(localIdentity(u));
          return { ok: true, user };
        } catch (err) {
          return fail("establish", 1, err);
        }
      }
    } catch {
      /* */
    }
  }

  if (!sessionJwt) return fail("verify", 0);

  // مفتاح Vercel قد يستبدله hydrateEnvFromSettings بمفتاح محفوظ في الإعدادات — نجرّب الاثنين
  // مع تفضيل ما يطابق pk_* (التحقق بأيّهما يثبت أن الرمز صادر عن نسخة Clerk نفسها).
  const keys = verificationSecretKeys(secretKey);
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
  if (!verifiedKey) return fail("verify", keys.length, verifyError);
  if (!userId) return fail("no_sub", keys.length);

  let u: ClerkUser;
  try {
    u = await createClerkClient({ secretKey: verifiedKey }).users.getUser(userId);
  } catch (err) {
    return fail("get_user", keys.length, err);
  }
  try {
    const user = await establishFirstPartySession(localIdentity(u));
    return { ok: true, user };
  } catch (err) {
    return fail("establish", keys.length, err);
  }
}

/**
 * سبب الرفض في سجلات Vercel — المرحلة ورمز الخطأ فقط: لا رمز جلسة ولا بريد ولا جوال ولا معرّف.
 */
function logClaimFailure(failure: ClaimClerkFailure, err: unknown): void {
  const e = (err ?? {}) as { name?: unknown; reason?: unknown; code?: unknown; status?: unknown; errors?: unknown };
  const clerkCode = Array.isArray(e.errors) ? (e.errors[0] as { code?: unknown } | undefined)?.code : undefined;
  console.warn(
    JSON.stringify({
      event: "claim_clerk_session_failed",
      stage: failure.stage,
      error: typeof e.name === "string" ? e.name : undefined,
      reason: typeof e.reason === "string" ? e.reason : undefined,
      code: typeof e.code === "string" ? e.code : typeof clerkCode === "string" ? clerkCode : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      keysTried: failure.keysTried,
      secretOverridden: failure.secretOverridden,
      secretKind: failure.secretKind,
      publishableKind: failure.publishableKind,
      keysAligned: failure.keysAligned,
    })
  );
}
