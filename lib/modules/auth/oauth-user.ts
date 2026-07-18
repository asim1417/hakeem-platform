// ─────────────────────────────────────────────────────────────────────────────
// oauth-user — تجهيز مستخدم OAuth في القاعدة وفتح الجلسة (خادم فقط).
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession, type SafeUser } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail, PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";
import { slugifyUsername } from "@/lib/modules/auth/credentials";

export type OAuthProvider = "google" | "microsoft";

/**
 * ينشئ أو يحدّث مستخدم OAuth، يفتح الجلسة، ويسجّل التدقيق.
 * بريد المالك (مثل aasemalfarsi@gmail.com) → SYSTEM_ADMIN دائمًا.
 */
export async function provisionOAuthUser(input: {
  email: string;
  name?: string | null;
  provider: OAuthProvider;
}): Promise<SafeUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, username: true },
  });

  const isOwner = isOAuthAdminEmail(email);
  const bootstrapAdmin = !existing && (await prisma.user.count().catch(() => 1)) === 0;
  const role = isOwner ? "SYSTEM_ADMIN" : existing?.role ?? (bootstrapAdmin ? "SYSTEM_ADMIN" : "TRAINEE");

  // اسم مستخدم افتراضي للمالك إن غاب.
  let username = existing?.username ?? null;
  if (!username && isOwner) {
    username = slugifyUsername(email.split("@")[0] || "owner");
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { email } },
      select: { id: true },
    });
    if (taken) username = `${username}.owner`;
  }

  const displayName =
    input.name ||
    ((PLATFORM_OWNER_EMAILS as readonly string[]).includes(email) ? "عاصم الفارسي" : email.split("@")[0] || "مستخدم");

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      isActive: true,
      role,
      ...(input.name ? { name: input.name } : {}),
      ...(username && !existing?.username ? { username } : {}),
    },
    create: {
      name: displayName,
      email,
      username,
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
    metadata: {
      email: user.email,
      role: user.role,
      provider: input.provider,
      asOwner: isOwner,
    },
  }).catch(() => undefined);

  return user;
}
