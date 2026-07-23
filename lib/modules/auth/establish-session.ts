/**
 * تثبيت جلسة المنصة بشكل جذري — كوكي أولى الطرف hakeem_session
 * (تعمل على Safari/iPhone دون Clerk JS أو handshake).
 */
import "server-only";

import { createClerkClient } from "@clerk/backend";
import { cookies } from "next/headers";
import { ensureLocalUserFromClerk } from "@/lib/modules/auth/clerk-sync";
import { createLoginSession, type SafeUser } from "@/lib/modules/auth/session";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

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
 * يفتح hakeem_session أولًا (Safari-safe)، ويُزامن Clerk إن أمكن.
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

  let clerkId = (input.clerkId || "").trim();
  let displayName = input.name?.trim() || email.split("@")[0] || "مستخدم";

  if (!clerkId && isClerkConfigured()) {
    const ensured = await ensureClerkUserByEmail({ email, name: displayName }).catch(() => null);
    if (ensured) {
      clerkId = ensured.clerkId;
      displayName = ensured.name || displayName;
    }
  }

  if (clerkId) {
    const user = await ensureLocalUserFromClerk({
      clerkId,
      email,
      name: displayName,
    });
    await createLoginSession(user);
    await trySetClerkSessionCookie(clerkId);
    return user;
  }

  const { provisionOAuthUser } = await import("@/lib/modules/auth/oauth-user");
  return provisionOAuthUser({
    email,
    name: displayName,
    provider: input.provider || "google",
    referralCode: input.referralCode,
  });
}
