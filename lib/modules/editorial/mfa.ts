// التحقق الثنائي لحساب في حكيم: من حسابه المرتبط في Clerk (twoFactorEnabled).
// معناه أن الحساب سجّل التحقق الثنائي، لا أن الجلسة الحالية مرّت به (الدخول بـ Google وغيرها لا يمر بعامل Clerk الثاني).
// الحساب بلا ربط Clerk، أو تعذّر السؤال، = غير متحقق (فشل مغلق): شرط التحقق الثنائي يمنع الكتابة ولا يفتحها.
import "server-only";

import { prisma } from "@/lib/prisma";
import { secretMatchesPublishable } from "@/lib/modules/auth/clerk-config";
import { hydrateEnvFromSettings, originalEnvValue } from "@/lib/modules/settings/settings-service";

/** error = تعذّر السؤال (قاعدة أو مفتاح أو خدمة الدخول)؛ يُعرض «تعذّر التحقق» لا «غير مرتبط». */
export type MfaStatus = { enabled: boolean; linked: boolean; error?: boolean };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; status: MfaStatus }>();

/**
 * مفاتيح Clerk بترتيب الثقة، كما في claim-clerk-return (مراجعة الجودة م٣ على 7681ec8):
 * المفتاح المُدار في الإعدادات ثم مفتاح Vercel الأصلي، ويُقدَّم ما يطابق المفتاح العام.
 */
export function orderClerkSecretKeys(candidates: ReadonlyArray<string | null | undefined>, publishable?: string): string[] {
  const unique = Array.from(new Set(candidates.map((k) => (k ?? "").trim()).filter(Boolean)));
  const matches = (k: string) => secretMatchesPublishable(k, publishable ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return [...unique.filter(matches), ...unique.filter((k) => !matches(k))];
}

function clerkSecretKeys(): string[] {
  return orderClerkSecretKeys([process.env.CLERK_SECRET_KEY, originalEnvValue("CLERK_SECRET_KEY")]);
}

async function lookup(userId: string): Promise<MfaStatus> {
  let clerkId: string | null = null;
  try {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { clerkId: true } });
    clerkId = row?.clerkId ?? null;
  } catch {
    return { enabled: false, linked: false, error: true };
  }
  if (!clerkId) return { enabled: false, linked: false };
  await hydrateEnvFromSettings().catch(() => 0);
  const keys = clerkSecretKeys();
  if (!keys.length) return { enabled: false, linked: true, error: true };
  const { createClerkClient } = await import("@clerk/backend");
  for (const secretKey of keys) {
    try {
      const user = await createClerkClient({ secretKey }).users.getUser(clerkId);
      return { enabled: user.twoFactorEnabled === true, linked: true };
    } catch {
      // المفتاح التالي
    }
  }
  return { enabled: false, linked: true, error: true };
}

/**
 * حالة التحقق الثنائي لحساب. عرض الصفحات يقبل نتيجة مخزّنة 30 ثانية (يخفف نداءات Clerk، ن٦)،
 * وأفعال الكتابة تطلب `fresh` فتسأل في كل مرة. الخطأ لا يُخزَّن.
 */
export async function accountMfaStatus(userId: string, opts: { fresh?: boolean } = {}): Promise<MfaStatus> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (!opts.fresh && hit && now - hit.at < CACHE_TTL_MS) return hit.status;
  const status = await lookup(userId);
  if (!status.error) cache.set(userId, { at: now, status });
  else cache.delete(userId);
  return status;
}
