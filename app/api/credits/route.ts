import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CREDIT_REWARDS, type CreditSource } from "@/config/credits";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { awardCredits, getCreditsStatus } from "@/lib/modules/credits/ledger";

export const dynamic = "force-dynamic";

const awardSchema = z.object({
  action: z.string().min(1).max(64),
  amount: z.number().int().positive().max(10_000).optional(),
});

/** GET — رصيد المستخدم الحالي وسجلّه. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const status = await getCreditsStatus(user.id);
  return NextResponse.json({
    balance: status.balance,
    transactions: status.transactions,
    unknown: status.unknown ?? false,
    catalog: CREDIT_REWARDS,
  });
}

/**
 * POST — منح نقاط لحدث معروف (idempotent لكل action).
 * يُستخدم من خطوات onboarding؛ لا يقبل مصادر عشوائية خارج الكتالوج إلا بمبلغ صريح للأدمن لاحقًا.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof awardSchema>;
  try {
    body = awardSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const known = body.action in CREDIT_REWARDS;
  if (!known && body.amount == null) {
    return NextResponse.json({ message: "مصدر النقاط غير معروف." }, { status: 400 });
  }

  // منع منح ترحيب/تسجيل من الواجهة مباشرة — فقط عبر bootstrap.
  if (body.action === "welcome" || body.action === "signup" || body.action.startsWith("referral_")) {
    return NextResponse.json({ message: "لا يمكن منح هذا المصدر يدويًا." }, { status: 403 });
  }

  const result = await awardCredits(
    user.id,
    body.action as CreditSource,
    known ? undefined : body.amount
  );

  return NextResponse.json({
    awarded: result.awarded,
    balance: result.balance,
    alreadyAwarded: result.awarded === 0,
  });
}
