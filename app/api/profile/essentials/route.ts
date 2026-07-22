import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { updateProfile } from "@/lib/modules/onboarding/profile";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  profession: z.enum(["INDIVIDUAL", "LAW_FIRM", "OTHER"]).optional(),
  dismiss: z.boolean().optional(),
});

/** حفظ سريع: الاسم + الجوال + المهنة — دون إجبار باقي الملف. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  if (body.dismiss) {
    return NextResponse.json({ ok: true, dismissed: true });
  }

  if (body.name && body.name !== user.name) {
    await prisma.user.update({ where: { id: user.id }, data: { name: body.name } }).catch(() => null);
  }

  const patch: { phone?: string | null; entityType?: string } = {};
  if (body.phone !== undefined) patch.phone = body.phone || null;
  if (body.profession) patch.entityType = body.profession;
  if (Object.keys(patch).length) {
    await updateProfile(user.id, patch);
  }

  return NextResponse.json({
    ok: true,
    name: body.name ?? user.name,
    phone: body.phone ?? null,
    profession: body.profession ?? null,
  });
}
