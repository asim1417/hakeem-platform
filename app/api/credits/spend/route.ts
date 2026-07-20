import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CREDIT_SPENDS, type CreditSpendId } from "@/config/credits";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { spendCredits } from "@/lib/modules/credits/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  use: z.enum([
    "download_ruling",
    "premium_week",
    "consult_specialist",
    "premium_month",
    "premium_year",
    "advanced_use",
  ]),
  targetId: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const result = await spendCredits(user.id, body.use as CreditSpendId, body.targetId);
  return NextResponse.json(
    {
      ...result,
      label: CREDIT_SPENDS[body.use].label,
      cost: CREDIT_SPENDS[body.use].points,
    },
    { status: result.ok ? 200 : 402 }
  );
}
