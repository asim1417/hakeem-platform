// التحقق الثنائي لحساب في حكيم: من حسابه المرتبط في Clerk (twoFactorEnabled).
// الحساب بلا ربط Clerk، أو تعذّر السؤال، = غير متحقق (فشل مغلق): شرط التحقق الثنائي يمنع الكتابة ولا يفتحها.
import "server-only";

import { prisma } from "@/lib/prisma";

export type MfaStatus = { enabled: boolean; linked: boolean };

export async function accountMfaStatus(userId: string): Promise<MfaStatus> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { clerkId: true } }).catch(() => null);
  if (!row?.clerkId) return { enabled: false, linked: false };
  const secretKey = (process.env.CLERK_SECRET_KEY || "").trim();
  if (!secretKey) return { enabled: false, linked: true };
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const user = await createClerkClient({ secretKey }).users.getUser(row.clerkId);
    return { enabled: user.twoFactorEnabled === true, linked: true };
  } catch {
    return { enabled: false, linked: true };
  }
}

