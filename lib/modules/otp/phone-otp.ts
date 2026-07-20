// ─────────────────────────────────────────────────────────────────────────────
// OTP جوال — تخزين مُجزَّأ + إرسال Twilio إن وُجد، وإلا وضع تطوير يكشف الرمز.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomInt } from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

export function isSmsConfigured(): boolean {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID || "").trim() &&
      (process.env.TWILIO_AUTH_TOKEN || "").trim() &&
      (process.env.TWILIO_FROM_NUMBER || "").trim()
  );
}

export function shouldRevealOtp(): boolean {
  if (isSmsConfigured()) return false;
  const flag = (process.env.OTP_DEV_REVEAL || "").toLowerCase();
  if (flag === "true" || flag === "1" || flag === "on") return true;
  return process.env.NODE_ENV !== "production";
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM_NUMBER || "").trim();
  if (!sid || !token || !from) return false;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return res.ok;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.length < 9) return null;
  // السعودية: 05xxxxxxxx → +9665xxxxxxxx
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  if (/^\+9665\d{8}$/.test(digits)) return digits;
  if (digits.startsWith("+") && digits.length >= 10) return digits;
  return null;
}

export async function issuePhoneOtp(
  userId: string,
  phoneRaw: string
): Promise<{ ok: boolean; message: string; previewCode?: string; e164?: string }> {
  const e164 = normalizePhone(phoneRaw);
  if (!e164) return { ok: false, message: "رقم الجوال غير صالح. استخدم صيغة 05xxxxxxxx." };

  const code = String(randomInt(100000, 999999));
  const hash = hashOtp(code, userId);
  const expires = new Date(Date.now() + OTP_TTL_MS);

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `UPDATE "users"
         SET phone = $2, "phoneOtpHash" = $3, "phoneOtpExpires" = $4, "phoneVerified" = false
       WHERE id = $1`,
      userId,
      phoneRaw.trim(),
      hash,
      expires
    );
  } catch {
    return { ok: false, message: "تعذّر حفظ رمز التحقق — طبّق هجرة OTP أولًا." };
  }

  const body = `رمز التحقق في حكيم: ${code} (صالح 10 دقائق)`;
  let sent = false;
  if (isSmsConfigured()) {
    sent = await sendSms(e164, body).catch(() => false);
  }

  const reveal = shouldRevealOtp();
  if (!sent && !reveal) {
    return {
      ok: false,
      message: "خدمة الرسائل غير مهيّأة. اضبط Twilio أو OTP_DEV_REVEAL للتطوير.",
      e164,
    };
  }

  return {
    ok: true,
    message: sent ? "أُرسل رمز التحقق إلى جوالك." : "وضع تطوير: استخدم الرمز الظاهر أدناه.",
    previewCode: reveal ? code : undefined,
    e164,
  };
}

export async function verifyPhoneOtp(
  userId: string,
  codeRaw: string
): Promise<{ ok: boolean; message: string }> {
  const code = codeRaw.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "أدخل الرمز المكوّن من 6 أرقام." };

  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      { phoneOtpHash: string | null; phoneOtpExpires: Date | null }[]
    >(
      `SELECT "phoneOtpHash", "phoneOtpExpires" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    const row = rows[0];
    if (!row?.phoneOtpHash || !row.phoneOtpExpires) {
      return { ok: false, message: "اطلب رمزًا جديدًا أولًا." };
    }
    if (new Date(row.phoneOtpExpires).getTime() < Date.now()) {
      return { ok: false, message: "انتهت صلاحية الرمز — اطلب رمزًا جديدًا." };
    }
    if (hashOtp(code, userId) !== row.phoneOtpHash) {
      return { ok: false, message: "الرمز غير صحيح." };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "users"
         SET "phoneVerified" = true, "phoneOtpHash" = NULL, "phoneOtpExpires" = NULL
       WHERE id = $1`,
      userId
    );
    return { ok: true, message: "تم التحقق من الجوال." };
  } catch {
    return { ok: false, message: "تعذّر التحقق — جرّب لاحقًا." };
  }
}
