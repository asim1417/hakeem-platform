/**
 * استعادة كلمة المرور — رمز HMAC موقَّع (بلا جدول)، صالح لساعة واحدة.
 * يعمل فقط للحسابات ذات كلمة مرور محلية قابلة للاستخدام (لا OAuth/Clerk placeholder).
 */
import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/modules/config/site-url";
import { isEmailConfigured, sendEmail } from "@/lib/modules/email/send";


const TTL_MS = 60 * 60 * 1000;

export function hasUsableLocalPassword(passwordHash: string | null | undefined): boolean {
  if (!passwordHash || passwordHash.length < 20) return false;
  const h = passwordHash.toLowerCase();
  if (h.startsWith("oauth-")) return false;
  if (h.startsWith("clerk:")) return false;
  if (h.includes("no-password")) return false;
  if (h === "not-for-login") return false;
  // bcrypt hashes start with $2a$ / $2b$ / $2y$
  return passwordHash.startsWith("$2");
}

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.PASSWORD_RESET_SECRET ||
    "hakeem-dev-only-insecure-secret"
  );
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(`pwd-reset:${body}`).digest("base64url");
}

type ResetPayload = {
  email: string;
  exp: number;
  nonce: string;
  purpose: "password-reset";
};

export function issuePasswordResetToken(email: string): { token: string; exp: number } {
  const payload: ResetPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + TTL_MS,
    nonce: randomBytes(12).toString("hex"),
    purpose: "password-reset",
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, exp: payload.exp };
}

export function verifyPasswordResetToken(token: string): { email: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ResetPayload;
    if (payload.purpose !== "password-reset") return null;
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
    return { email: payload.email.toLowerCase().trim() };
  } catch {
    return null;
  }
}

export function passwordResetUrl(token: string): string {
  return absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
}

/** يطلب الاستعادة — لا يكشف إن كان البريد موجودًا. */
export async function requestPasswordReset(emailRaw: string): Promise<{
  ok: true;
  emailed: boolean;
  /** للتطوير فقط عند غياب Resend */
  resetUrl?: string;
}> {
  const email = emailRaw.toLowerCase().trim();
  const generic = { ok: true as const, emailed: false };

  if (!email || !email.includes("@")) return generic;

  const user = await prisma.user
    .findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true, passwordHash: true },
    })
    .catch(() => null);

  if (!user?.isActive || !hasUsableLocalPassword(user.passwordHash)) {
    return generic;
  }

  const { token } = issuePasswordResetToken(user.email);
  const url = passwordResetUrl(token);
  const subject = "استعادة كلمة المرور — حكيم";
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#0E3435">
      <h1 style="color:#0E3435">حكيم</h1>
      <p>مرحبًا ${user.name || ""}،</p>
      <p>طلبتَ إعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة واحدة:</p>
      <p><a href="${url}" style="color:#8B6914;font-weight:700">تعيين كلمة مرور جديدة</a></p>
      <p style="font-size:12px;color:#666">إن لم تطلب ذلك فتجاهل الرسالة. لن يتغيّر شيء.</p>
    </div>
  `;

  const sent = await sendEmail({
    to: user.email,
    subject,
    html,
    text: `استعادة كلمة المرور — افتح الرابط خلال ساعة: ${url}`,
  });

  const emailed = Boolean(sent.ok && !sent.skipped);
  // في التطوير بلا Resend: نعيد الرابط للواجهة (لا في الإنتاج).
  if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
    return { ok: true, emailed: false, resetUrl: url };
  }
  return { ok: true, emailed };
}

export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const password = input.newPassword || "";
  if (password.length < 8 || password.length > 72) {
    return { ok: false, message: "كلمة المرور يجب أن تكون بين 8 و 72 حرفًا." };
  }

  const verified = verifyPasswordResetToken(input.token);
  if (!verified) {
    return { ok: false, message: "رابط الاستعادة غير صالح أو منتهٍ. اطلب رابطًا جديدًا." };
  }

  const user = await prisma.user.findUnique({
    where: { email: verified.email },
    select: { id: true, isActive: true, passwordHash: true },
  });
  if (!user?.isActive || !hasUsableLocalPassword(user.passwordHash)) {
    return { ok: false, message: "لا يمكن إعادة تعيين كلمة المرور لهذا الحساب." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { ok: true };
}
