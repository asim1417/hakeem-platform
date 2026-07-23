// ─────────────────────────────────────────────────────────────────────────────
// oauth-user — تجهيز مستخدم OAuth في القاعدة وفتح الجلسة (خادم فقط).
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";

import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession, type SafeUser } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail, isPlatformOwnerEmail, PLATFORM_OWNER_EMAILS } from "@/lib/modules/auth/oauth-shared";
import { slugifyUsername } from "@/lib/modules/auth/credentials";
import { bootstrapNewUser } from "@/lib/modules/onboarding/bootstrap";

export type OAuthProvider = "google" | "microsoft";

export type ProvisionedOAuthUser = SafeUser & { isNew: boolean };

/**
 * ينشئ أو يحدّث مستخدم OAuth، يفتح الجلسة، ويسجّل التدقيق.
 * بريد المالك (مثل aasemalfarsi@gmail.com) → SUPER_ADMIN دائمًا.
 * المستخدمون الجدد يحصلون على نقاط ترحيب ويُوجَّهون لـ /onboarding.
 */
export async function provisionOAuthUser(input: {
  email: string;
  name?: string | null;
  provider: OAuthProvider;
  referralCode?: string | null;
}): Promise<ProvisionedOAuthUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, username: true },
  });
  const isNew = !existing;

  const isOwner = isPlatformOwnerEmail(email);
  const isDelegatedAdmin = !isOwner && isOAuthAdminEmail(email);
  const bootstrapAdmin = !existing && (await prisma.user.count().catch(() => 1)) === 0;
  const role = isOwner
    ? "SUPER_ADMIN"
    : existing?.role ?? (bootstrapAdmin || isDelegatedAdmin ? "SYSTEM_ADMIN" : "TRAINEE");

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

  let user;
  try {
    user = await prisma.user.upsert({
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
  } catch (err) {
    // إن لم تُطبَّق هجرة SUPER_ADMIN بعد — لا تمنع دخول المالك.
    if (isOwner && role === "SUPER_ADMIN") {
      user = await prisma.user.upsert({
        where: { email },
        update: {
          isActive: true,
          role: "SYSTEM_ADMIN",
          ...(input.name ? { name: input.name } : {}),
          ...(username && !existing?.username ? { username } : {}),
        },
        create: {
          name: displayName,
          email,
          username,
          passwordHash: `oauth-${input.provider}:no-password`,
          role: "SYSTEM_ADMIN",
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
    } else {
      throw err;
    }
  }

  await createLoginSession(user);

  if (isNew) {
    await bootstrapNewUser(user.id, {
      referralCode: input.referralCode,
      skipOnboarding: isOwner,
    }).catch(() => undefined);
  }

  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: {
      email: user.email,
      role: user.role,
      provider: input.provider,
      asOwner: isOwner,
      isNew,
    },
  }).catch(() => undefined);

  return { ...user, isNew };
}
