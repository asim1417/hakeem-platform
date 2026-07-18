// ─────────────────────────────────────────────────────────────────────────────
// ملف onboarding — قراءة/كتابة أعمدة users الإضافية (SQL خام، سقوط مفتوح).
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  phone: string | null;
  city: string | null;
  entityType: string | null;
  yearsExperience: string | null;
  specialties: string[];
  interests: string[];
  alertsEnabled: boolean;
  phoneVerified: boolean;
  termsAccepted: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
  referralCode: string | null;
  referredBy: string | null;
  creditsBalance: number;
  /** قبل الهجرة */
  unknown?: boolean;
}

export type ProfilePatch = Partial<{
  phone: string | null;
  city: string | null;
  entityType: string | null;
  yearsExperience: string | null;
  specialties: string[];
  interests: string[];
  alertsEnabled: boolean;
  phoneVerified: boolean;
  termsAccepted: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
  referredBy: string | null;
}>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function mapRow(row: Record<string, unknown>): UserProfile {
  return {
    phone: (row.phone as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    entityType: (row.entityType as string | null) ?? null,
    yearsExperience: (row.yearsExperience as string | null) ?? null,
    specialties: asStringArray(row.specialties),
    interests: asStringArray(row.interests),
    alertsEnabled: Boolean(row.alertsEnabled),
    phoneVerified: Boolean(row.phoneVerified),
    termsAccepted: Boolean(row.termsAccepted),
    onboardingCompleted: row.onboardingCompleted !== false,
    onboardingStep: Number(row.onboardingStep ?? 0),
    referralCode: (row.referralCode as string | null) ?? null,
    referredBy: (row.referredBy as string | null) ?? null,
    creditsBalance: Number(row.creditsBalance ?? 0),
  };
}

const SELECT = `
  phone, city, "entityType", "yearsExperience", specialties, interests,
  "alertsEnabled", "phoneVerified", "termsAccepted",
  "onboardingCompleted", "onboardingStep", "referralCode", "referredBy", "creditsBalance"
`;

export async function getProfile(userId: string): Promise<UserProfile> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${SELECT} FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    if (!rows[0]) return { ...emptyProfile(), unknown: true };
    return mapRow(rows[0]);
  } catch {
    return { ...emptyProfile(), unknown: true };
  }
}

function emptyProfile(): UserProfile {
  return {
    phone: null,
    city: null,
    entityType: null,
    yearsExperience: null,
    specialties: [],
    interests: [],
    alertsEnabled: false,
    phoneVerified: false,
    termsAccepted: false,
    onboardingCompleted: true, // سقوط مفتوح: لا نجبر onboarding قبل الهجرة
    onboardingStep: 0,
    referralCode: null,
    referredBy: null,
    creditsBalance: 0,
  };
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<UserProfile> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = $${i++}`);
    vals.push(value);
  };

  if (patch.phone !== undefined) push("phone", patch.phone);
  if (patch.city !== undefined) push("city", patch.city);
  if (patch.entityType !== undefined) push(`"entityType"`, patch.entityType);
  if (patch.yearsExperience !== undefined) push(`"yearsExperience"`, patch.yearsExperience);
  if (patch.specialties !== undefined) {
    sets.push(`specialties = $${i++}::jsonb`);
    vals.push(JSON.stringify(patch.specialties));
  }
  if (patch.interests !== undefined) {
    sets.push(`interests = $${i++}::jsonb`);
    vals.push(JSON.stringify(patch.interests));
  }
  if (patch.alertsEnabled !== undefined) push(`"alertsEnabled"`, patch.alertsEnabled);
  if (patch.phoneVerified !== undefined) push(`"phoneVerified"`, patch.phoneVerified);
  if (patch.termsAccepted !== undefined) push(`"termsAccepted"`, patch.termsAccepted);
  if (patch.onboardingCompleted !== undefined) push(`"onboardingCompleted"`, patch.onboardingCompleted);
  if (patch.onboardingStep !== undefined) push(`"onboardingStep"`, patch.onboardingStep);
  if (patch.referredBy !== undefined) push(`"referredBy"`, patch.referredBy);

  if (sets.length === 0) return getProfile(userId);

  try {
    const { prisma } = await import("@/lib/prisma");
    vals.push(userId);
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET ${sets.join(", ")} WHERE id = $${i}`,
      ...vals
    );
    return getProfile(userId);
  } catch {
    return { ...emptyProfile(), unknown: true };
  }
}

/** هل يجب توجيه المستخدم لـ /onboarding؟ */
export function needsOnboarding(profile: UserProfile, email?: string): boolean {
  if (profile.unknown) return false;
  if (email === "guest@hakeem.local") return false;
  return profile.onboardingCompleted === false;
}

/** تعليم مستخدم جديد بأنه لم يُكمل onboarding بعد. */
export async function markOnboardingPending(userId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `UPDATE "users"
         SET "onboardingCompleted" = false, "onboardingStep" = 0
       WHERE id = $1`,
      userId
    );
  } catch {
    /* قبل الهجرة — تجاهل */
  }
}
