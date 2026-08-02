import "server-only";

// تشفير توكنات وسائل الدفع — HKM-BILLING-UX-001 (§14).
// مفتاح مفصول (domain separation) عن أسرار الإعدادات + بادئة إصدار للتدوير المستقبلي.
// AES-256-GCM: IV عشوائي 12 بايت + auth tag. لا PAN/CVC — التوكن فقط.

import crypto from "crypto";
import { decryptValue } from "@/lib/modules/settings/settings-service";

const VERSION = "v1";
const DEV_FALLBACK = "hakeem-payment-token-dev-only";

function paymentKey(): Buffer {
  // مفتاح خاص بتوكنات الدفع، منفصل عن SETTINGS_SECRET (فصل النطاقات).
  const secret =
    process.env.PAYMENT_TOKEN_SECRET ||
    process.env.SETTINGS_SECRET ||
    process.env.AUTH_SECRET ||
    DEV_FALLBACK;
  if (secret === DEV_FALLBACK && process.env.NODE_ENV === "production") {
    throw new Error("PAYMENT_TOKEN_SECRET مطلوب في الإنتاج لتشفير توكنات الدفع.");
  }
  return crypto.scryptSync(secret, "hakeem-payment-token-salt", 32);
}

/** تشفير توكن المزوّد قبل الحفظ. الصيغة: v1:iv:tag:ct (base64). */
export function encryptPaymentToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", paymentKey(), iv);
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** فكّ التشفير (يدعم v1 الجديد، مع سقوط لصيغة settings القديمة إن وُجدت). */
export function decryptPaymentToken(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith(`${VERSION}:`)) {
    try {
      const [, ivB, tagB, ctB] = stored.split(":");
      if (!ivB || !tagB || !ctB) return null;
      const decipher = crypto.createDecipheriv("aes-256-gcm", paymentKey(), Buffer.from(ivB, "base64"));
      decipher.setAuthTag(Buffer.from(tagB, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
  // توافق خلفي: توكنات شُفّرت سابقًا بمفتاح الإعدادات.
  return decryptValue(stored);
}
