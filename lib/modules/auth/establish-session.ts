/**
 * تثبيت جلسة المنصة بشكل جذري — كوكي أولى الطرف hakeem_session
 * (تعمل على Safari/iPhone دون Clerk JS أو handshake).
 *
 * ترتيب ثابت لا يكسر دخول المالك:
 * 1) provisionOAuthUser → hakeem_session دائمًا
 * 2) مزامنة Clerk اختيارية best-effort (لا تُسقط الدخول عند التعارض)
 */
import "server-only";

import { createClerkClient } from "@clerk/backend";
import { cookies } from "next/headers";
import { ensureLocalUserFromClerk } from "@/lib/modules/auth/clerk-sync";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import type { SafeUser } from "@/lib/modules/auth/session";

function clerkClient() {
  const secretKey = (process.env.CLERK_SECRET_KEY || "").trim();
  if (!secretKey) return null;
  return createClerkClient({ secretKey });
}

export async function ensureClerkUserByEmail(input: {
  email: string;
  name?: string | null;
}): Promise<{ clerkId: string; email: string; name: string } | null> {
  const client = clerkClient();
  if (!client) return null;

  const email = input.email.toLowerCase().trim();
  if (!email) return null;

  try {
    const existing = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    if (existing.data[0]) {
      const u = existing.data[0];
      return {
        clerkId: u.id,
        email,
        name:
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.username ||
          input.name ||
          email.split("@")[0] ||
          "مستخدم",
      };
    }
  } catch {
    /* جرّب الإنشاء */
  }

  try {
    const parts = (input.name || "").trim().split(/\s+/).filter(Boolean);
    const created = await client.users.createUser({
      emailAddress: [email],
      firstName: parts[0] || undefined,
      lastName: parts.slice(1).join(" ") || undefined,
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
    });

    return {
      clerkId: created.id,
      email,
      name:
        [created.firstName, created.lastName].filter(Boolean).join(" ") ||
        input.name ||
        email.split("@")[0] ||
        "مستخدم",
    };
  } catch {
    // البريد موجود في Clerk لكن القائمة لم تُرجعه — أعد المحاولة بالقراءة.
    try {
      const again = await client.users.getUserList({ emailAddress: [email], limit: 1 });
      const u = again.data[0];
      if (!u) return null;
      return {
        clerkId: u.id,
        email,
        name:
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          input.name ||
          email.split("@")[0] ||
          "مستخدم",
      };
    } catch {
      return null;
    }
  }
}

async function trySetClerkSessionCookie(clerkUserId: string): Promise<void> {
  const client = clerkClient();
  if (!client) return;
  try {
    const session = await client.sessions.createSession({ userId: clerkUserId });
    const token = await client.sessions.getToken(session.id);
    if (!token?.jwt) return;
    cookies().set("__session", token.jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  } catch {
    /* hakeem_session يكفي للمنصة */
  }
}

/**
 * بعد التحقق من هوية OAuth:
 * يفتح hakeem_session أولًا (Safari-safe + مالك المنصة)، ويُزامن Clerk إن أمكن.
 */
export async function establishFirstPartySession(input: {
  email: string;
  name?: string | null;
  clerkId?: string | null;
  referralCode?: string | null;
  provider?: "google" | "microsoft";
}): Promise<SafeUser> {
  await hydrateEnvFromSettings().catch(() => 0);

  const email = input.email.toLowerCase().trim();
  if (!email) throw new Error("البريد مطلوب لتثبيت الجلسة.");

  const displayName = input.name?.trim() || email.split("@")[0] || "مستخدم";

  // ── 1) جلسة المنصة أولًا — لا تعتمد على Clerk (حرج لحساب المالك) ──
  const { provisionOAuthUser } = await import("@/lib/modules/auth/oauth-user");
  const user = await provisionOAuthUser({
    email,
    name: displayName,
    provider: input.provider || "google",
    referralCode: input.referralCode,
  });

  // ── 2) مزامنة Clerk اختيارية — الفشل لا يُلغي الدخول ──
  if (isClerkConfigured()) {
    try {
      let clerkId = (input.clerkId || "").trim();
      if (!clerkId) {
        const ensured = await ensureClerkUserByEmail({ email, name: user.name || displayName });
        clerkId = ensured?.clerkId || "";
      }
      if (clerkId) {
        await ensureLocalUserFromClerk({
          clerkId,
          email,
          name: user.name || displayName,
        });
        await trySetClerkSessionCookie(clerkId);
      }
    } catch {
      /* الجلسة المحلية قائمة */
    }
  }

  return user;
}
