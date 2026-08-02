// تجزئة هوية التجربة (نقيّ، قابل للاختبار) — HKM-BILLING-UX-001.
import { createHash } from "crypto";

/** تجزئة الهوية (بريد/جوال مُطبَّع) لمنع إعادة منح التجربة بنفس الهوية. */
export function trialIdentityHash(email?: string | null, phone?: string | null): string {
  const e = (email || "").trim().toLowerCase();
  const p = (phone || "").replace(/[^\d]/g, "");
  const basis = e || (p ? `phone:${p}` : "");
  return createHash("sha256").update(`trial:${basis}`).digest("hex");
}
