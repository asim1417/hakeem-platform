import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { uploadAttachmentBlob } from "@/lib/modules/attachments/blob-storage";
import { awardCredits } from "@/lib/modules/credits/ledger";
import { updateProfile } from "@/lib/modules/onboarding/profile";
import { CREDIT_REWARDS } from "@/config/credits";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });

  const file = form.get("file");
  const certificatesRaw = form.get("certificates");
  const certificates =
    typeof certificatesRaw === "string"
      ? certificatesRaw
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

  let avatarUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ message: "الصورة يجب أن تكون PNG أو JPEG أو WebP." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ message: "حجم الصورة يتجاوز 5MB." }, { status: 400 });
    }
    const uploaded = await uploadAttachmentBlob({ file, prefix: `avatars/${user.id}` });
    avatarUrl = uploaded.url || `local://${uploaded.storageKey}`;
  }

  const profile = await updateProfile(user.id, {
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(certificates.length ? { certificates } : {}),
  });

  // مكافأة خطوة الصورة إن رُفعت صورة أو شهادات
  let awarded = 0;
  if (avatarUrl || certificates.length) {
    const r = await awardCredits(user.id, "onboarding_step_5", CREDIT_REWARDS.onboarding_step_5);
    awarded = r.awarded;
  }

  return NextResponse.json({
    ok: true,
    avatarUrl: profile.avatarUrl,
    certificates: profile.certificates,
    awarded,
    balance: profile.creditsBalance,
  });
}
