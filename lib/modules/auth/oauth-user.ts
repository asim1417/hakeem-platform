// ─────────────────────────────────────────────────────────────────────────────
// oauth-user — تجهيز مستخدم OAuth في القاعدة وفتح الجلسة (خادم فقط).
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession, type SafeUser } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";

export type OAuthProvider = "google" | "microsoft";

/**
 * ينشئ أو يحدّث مستخدم OAuth، يفتح الجلسة، ويسجّل التدقيق.
 * أول مستخدم في القاعدة (تمهيد) يُمنح SYSTEM_ADMIN إن لم يُحدَّد خلاف ذلك.
 */
export async function provisionOAuthUser(input: {
  email: string;
  name?: string | null;
  provider: OAuthProvider;
}): Promise<SafeUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  const bootstrapAdmin = !existing && (await prisma.user.count().catch(() => 1)) === 0;
  const role = isOAuthAdminEmail(email)
    ? "SYSTEM_ADMIN"
    : existing?.role ?? (bootstrapAdmin ? "SYSTEM_ADMIN" : "TRAINEE");

  const user = await prisma.user.upsert({
    where: { email },
    update: { isActive: true, role, ...(input.name ? { name: input.name } : {}) },
    create: {
      name: input.name || email.split("@")[0] || "مستخدم",
      email,
      // مستخدم OAuth بلا كلمة مرور: قيمة غير صالحة كـ bcrypt فيتعذّر الدخول بكلمة مرور.
      passwordHash: `oauth-${input.provider}:no-password`,
      role,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await createLoginSession(user);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email: user.email, role: user.role, provider: input.provider },
  }).catch(() => undefined);

  return user;
}
