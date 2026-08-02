import "server-only";

// التجربة المجانية — HKM-BILLING-UX-001 (القرارات التجارية).
// 100 نقطة: 60 مبدئية + 40 عند إكمال الملف. مدة 14 يومًا. مرة واحدة لكل هوية متحقّقة.
// منع إعادة المنح بحذف الحساب وإعادة إنشائه بنفس الهوية (billing_trial_grants بالهوية).

import { grantCredits } from "@/lib/modules/billing/credit-engine";
import { notify } from "@/lib/modules/billing/notifications";
import { trialIdentityHash } from "@/lib/modules/billing/trial-identity";

export { trialIdentityHash };

export const TRIAL_INITIAL_POINTS = Number(process.env.TRIAL_INITIAL_POINTS || 60);
export const TRIAL_PROFILE_POINTS = Number(process.env.TRIAL_PROFILE_COMPLETION_POINTS || 40);
export const TRIAL_DURATION_DAYS = Number(process.env.TRIAL_DURATION_DAYS || 14);

function trialExpiry(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + TRIAL_DURATION_DAYS);
  return d;
}

async function alreadyGrantedForIdentity(identityHash: string, kind: string): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ identityHash: string }[]>(
      `SELECT "identityHash" FROM "billing_trial_grants" WHERE "identityHash" = $1 AND "kind" = $2 LIMIT 1`,
      `${identityHash}:${kind}`,
      kind
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function markGranted(identityHash: string, kind: string, userId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "billing_trial_grants" ("identityHash","userId","kind")
       VALUES ($1,$2,$3) ON CONFLICT ("identityHash") DO NOTHING`,
      `${identityHash}:${kind}`,
      userId,
      kind
    );
  } catch {
    /* */
  }
}

/** منح التجربة المبدئية (60 نقطة) مرة واحدة لكل هوية متحقّقة. */
export async function grantInitialTrial(input: {
  userId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<{ granted: boolean; points: number }> {
  const hash = trialIdentityHash(input.email, input.phone);
  if (await alreadyGrantedForIdentity(hash, "initial")) return { granted: false, points: 0 };

  const points = await grantCredits({
    userId: input.userId,
    points: TRIAL_INITIAL_POINTS,
    sourceType: "TRIAL",
    sourceReferenceId: "trial-initial",
    expiresAt: trialExpiry(new Date()),
    priority: 200, // التجربة تُستهلك أولًا
    idempotencyKey: `trial:initial:${input.userId}`,
    description: "نقاط تجربة مبدئية",
  });
  await markGranted(hash, "initial", input.userId);
  if (points > 0) {
    await notify({ userId: input.userId, event: "trial_started", data: { points: 100 }, dedupeKey: `trial_started:${input.userId}` });
  }
  return { granted: points > 0, points };
}

/** منح نقاط إكمال الملف (40 نقطة) مرة واحدة لكل هوية. */
export async function grantProfileCompletionTrial(input: {
  userId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<{ granted: boolean; points: number }> {
  const hash = trialIdentityHash(input.email, input.phone);
  if (await alreadyGrantedForIdentity(hash, "profile")) return { granted: false, points: 0 };

  const points = await grantCredits({
    userId: input.userId,
    points: TRIAL_PROFILE_POINTS,
    sourceType: "TRIAL",
    sourceReferenceId: "trial-profile",
    expiresAt: trialExpiry(new Date()),
    priority: 200,
    idempotencyKey: `trial:profile:${input.userId}`,
    description: "نقاط إكمال الملف",
  });
  await markGranted(hash, "profile", input.userId);
  return { granted: points > 0, points };
}
