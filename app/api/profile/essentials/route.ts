import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { updateProfile } from "@/lib/modules/onboarding/profile";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(32),
  profession: z.enum(["INDIVIDUAL", "LAW_FIRM", "OTHER"]),
});

/** حفظ إلزامي: الاسم + الجوال + المهنة. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { message: "يلزم إدخال الاسم ورقم الجوال والمهنة." },
      { status: 400 }
    );
  }

  if (body.name !== user.name) {
    await prisma.user.update({ where: { id: user.id }, data: { name: body.name } }).catch(() => null);
  }
  await updateProfile(user.id, {
    phone: body.phone,
    entityType: body.profession,
  });

  return NextResponse.json({
    ok: true,
    name: body.name,
    phone: body.phone,
    profession: body.profession,
  });
}
