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

  try {
    const payload = await verifyToken(sessionJwt, {
      secretKey,
      // publishableKey helps in some setups
    });
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) return null;
    const u = await client.users.getUser(userId);
    return establishFirstPartySession(localIdentity(u));
  } catch {
    return null;
  }
}
