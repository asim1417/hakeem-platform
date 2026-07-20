import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import {
  awardDailyVisit,
  awardReadArticle,
  awardSaveRuling,
} from "@/lib/modules/credits/engagement";
import { getBalance } from "@/lib/modules/credits/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  event: z.enum(["daily_visit", "read_article", "save_ruling"]),
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

  let awarded = 0;
  if (body.event === "daily_visit") awarded = await awardDailyVisit(user.id);
  if (body.event === "read_article") awarded = await awardReadArticle(user.id, body.targetId || "");
  if (body.event === "save_ruling") awarded = await awardSaveRuling(user.id, body.targetId || "");

  return NextResponse.json({
    awarded,
    balance: await getBalance(user.id),
  });
}
