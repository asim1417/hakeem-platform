import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { awardCredits } from "@/lib/modules/credits/ledger";
import { getProfile, updateProfile } from "@/lib/modules/onboarding/profile";
import { ensureReferralCode } from "@/lib/modules/referrals/codes";

export const dynamic = "force-dynamic";

const stepSchema = z.object({
  step: z.number().int().min(1).max(5),
  phone: z.string().max(32).optional(),
  city: z.string().max(64).optional(),
  entityType: z.enum(["INDIVIDUAL", "LAW_FIRM", "OTHER"]).optional(),
  yearsExperience: z.string().max(16).optional(),
  specialties: z.array(z.string().max(64)).max(20).optional(),
  interests: z.array(z.string().max(64)).max(20).optional(),
  alertsEnabled: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
  complete: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const profile = await getProfile(user.id);
  const code = await ensureReferralCode(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    profile: { ...profile, referralCode: code ?? profile.referralCode },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof stepSchema>;
  try {
    body = stepSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message ?? "بيانات غير صالحة." : "بيانات غير صالحة.";
    return NextResponse.json({ message }, { status: 400 });
  }

  // تحقق خفيف حسب الخطوة
  if (body.step === 1) {
    if (!body.phone?.trim() || !body.city?.trim()) {
      return NextResponse.json({ message: "أدخل رقم الجوال والمدينة." }, { status: 400 });
    }
  }
  if (body.step === 2) {
    if (!body.specialties?.length || !body.yearsExperience) {
      return NextResponse.json({ message: "اختر التخصص وسنوات الخبرة." }, { status: 400 });
    }
  }
  if (body.step === 3) {
    if (!body.phoneVerified) {
      return NextResponse.json({ message: "أكّد صحة رقم الجوال للمتابعة." }, { status: 400 });
    }
  }
  if (body.step === 4) {
    if (!body.interests || body.interests.length < 3) {
      return NextResponse.json({ message: "اختر 3 اهتمامات على الأقل." }, { status: 400 });
    }
  }
  if (body.step === 5) {
    if (!body.termsAccepted) {
      return NextResponse.json({ message: "يلزم قبول الشروط وسياسة الخصوصية." }, { status: 400 });
    }
  }

  const patch = {
    phone: body.phone?.trim(),
    city: body.city?.trim(),
    entityType: body.entityType,
    yearsExperience: body.yearsExperience,
    specialties: body.specialties,
    interests: body.interests,
    alertsEnabled: body.alertsEnabled,
    phoneVerified: body.phoneVerified,
    termsAccepted: body.termsAccepted,
    onboardingStep: body.step,
    onboardingCompleted: body.complete === true || body.step === 5,
  };

  const profile = await updateProfile(user.id, patch);

  const source = `onboarding_step_${body.step}` as const;
  const stepAward = await awardCredits(user.id, source);

  let completeAward = { awarded: 0, balance: stepAward.balance };
  if (body.complete || body.step === 5) {
    completeAward = await awardCredits(user.id, "onboarding_complete");
  }

  return NextResponse.json({
    profile,
    awarded: stepAward.awarded + completeAward.awarded,
    balance: completeAward.balance || stepAward.balance,
    done: profile.onboardingCompleted,
  });
}
