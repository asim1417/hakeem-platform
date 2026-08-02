import "server-only";

// تشفير توكنات وسائل الدفع عند التخزين — HKM-BILLING-UX-001 (§14).
// يعيد استخدام AES-256-GCM من settings-service. لا نخزّن PAN/CVC — التوكن فقط، مشفّرًا.

import { encryptValue, decryptValue } from "@/lib/modules/settings/settings-service";

/** تشفير توكن المزوّد قبل الحفظ. */
export function encryptPaymentToken(token: string): string {
  return encryptValue(token);
}

/** فكّ تشفير التوكن قبل الاستخدام (يعيد null عند الفشل). */
export function decryptPaymentToken(stored: string | null): string | null {
  if (!stored) return null;
  return decryptValue(stored);
}
