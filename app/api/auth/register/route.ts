import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession } from "@/lib/modules/auth/session";
import {
  emailFromUsername,
  generateUsername,
  isValidUsername,
  slugifyUsername,
} from "@/lib/modules/auth/credentials";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "الاسم مطلوب (حرفان على الأقل).").max(80),
  email: z.string().email("البريد غير صالح.").optional().or(z.literal("")),
  username: z.string().min(3).max(32).optional().or(z.literal("")),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف.").max(72),
  entityType: z.enum(["INDIVIDUAL", "LAW_FIRM", "OTHER"]).default("INDIVIDUAL"),
});

/**
 * POST /api/auth/register — تسجيل عام (تجربة مجانية).
 * ينشئ مستخدمًا بدور TRAINEE ويفتح الجلسة مباشرة.
 */
export async function POST(request: NextRequest) {
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message ?? "بيانات غير صالحة." : "بيانات غير صالحة.";
    return NextResponse.json({ message }, { status: 400 });
  }

  let username = (payload.username || "").trim().toLowerCase();
  if (!username) username = generateUsername(payload.name);
  if (!isValidUsername(username)) {
    return NextResponse.json({ message: "اسم المستخدم غير صالح." }, { status: 400 });
  }

  let email = (payload.email || "").trim().toLowerCase();
  if (!email) email = emailFromUsername(username);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ message: "البريد أو اسم المستخدم مستخدم مسبقًا — جرّب تسجيل الدخول." }, { status: 409 });
  }

  // ضمان فرادة اسم المستخدم عند التصادم النادر.
  const clash = await prisma.user.findFirst({ where: { username }, select: { id: true } });
  if (clash) username = `${slugifyUsername(username)}.${String(1000 + Math.floor(Math.random() * 9000))}`;

  const passwordHash = await bcrypt.hash(payload.password, 12);

  // مالك معروف بالبريد، أو أول حساب حقيقي = SYSTEM_ADMIN؛ غيره متدرّب بتجربة مجانية.
  const realUsers = await prisma.user
    .count({ where: { email: { not: "guest@hakeem.local" } } })
    .catch(() => 1);
  const role = isOAuthAdminEmail(email) || realUsers === 0 ? "SYSTEM_ADMIN" : "TRAINEE";

  try {
    const user = await prisma.user.create({
      data: {
        name: payload.name.trim(),
        email,
        username,
        passwordHash,
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, username: true, role: true, isActive: true },
    });

    await createLoginSession(user);
    await auditEvent({
      actorId: user.id,
      subject: "AUTH",
      action: "REGISTER_SUCCESS",
      metadata: {
        email: user.email,
        username: user.username,
        role: user.role,
        entityType: payload.entityType,
        plan: "FREE_TRIAL",
      },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        plan: "FREE_TRIAL",
        message: "تم إنشاء حسابك — بدأت تجربتك المجانية.",
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ message: "البريد أو اسم المستخدم مستخدم مسبقًا." }, { status: 409 });
    }
    return NextResponse.json({ message: "تعذّر إنشاء الحساب — حاول مرة أخرى." }, { status: 500 });
  }
}
