import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createLoginSession } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";
import { isOwnerEmergencyLoginEnabled } from "@/lib/modules/auth/owner-emergency";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

// AUTH-001: حدّ معدّل بسيط داخل العملية — يمنع التخمين المتكرر لمسار الطوارئ.
const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const rec = ATTEMPTS.get(key);
  if (!rec || now > rec.resetAt) { ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}
function clientIp(request: NextRequest): string {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/**
 * POST /api/auth/owner-login — دخول طوارئ للمالك فقط.
 * معطّل ما لم يُفعَّل OWNER_EMERGENCY_LOGIN_ENABLED (+ سماح الإنتاج إن لزم).
 */
export async function POST(request: NextRequest) {
  if (!isOwnerEmergencyLoginEnabled()) {
    return NextResponse.json({ message: "هذا المسار غير متاح." }, { status: 404 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  if (rateLimited(`${clientIp(request)}:${email}`)) {
    return NextResponse.json({ message: "محاولات كثيرة. حاول لاحقًا." }, { status: 429 });
  }
  if (!isOAuthAdminEmail(email)) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user?.isActive || !user.passwordHash) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 401 });
  }

  // AUTH-001: المطابقة الوحيدة مقابل passwordHash المخزَّن — لا fallback لأي قيمة من المصدر/البيئة.
  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "تعذّر إكمال الدخول." }, { status: 401 });
  }

  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  await createLoginSession(safe);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email, provider: "owner_emergency", asOwner: true },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    user: safe,
    message: "تم الدخول.",
  });
}
