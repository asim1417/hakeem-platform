/**
 * بريد الصف المحلي لمستخدم Clerk.
 *
 * جدول users يشترط بريدًا فريدًا، وحساب الجوال وحده في Clerk بلا بريد — فكان تثبيت
 * hakeem_session يُرفض (401) ويعود المستخدم إلى صفحة الدخول. لحساب بلا بريد نشتق
 * معرّفًا داخليًا ثابتًا من clerkId على نطاق ‎.invalid (RFC 2606: لا يُسلَّم إليه بريد أبدًا)،
 * ولا يحمل رقم الجوال (PDPL). بلا تغيير في المخطط.
 */
import { createHash } from "crypto";

export const CLERK_PHONE_ONLY_EMAIL_DOMAIN = "phone.hakeemai.invalid";

type ClerkUserLike = {
  id: string;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: ReadonlyArray<{ emailAddress?: string | null }> | null;
};

export function clerkUserRealEmail(u: ClerkUserLike): string {
  return (u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "").trim();
}

/** معرّف داخلي ثابت لحساب بلا بريد — مشتق من clerkId (hash) فلا يتأثر بتحويل الحالة. */
export function phoneOnlyLocalEmail(clerkId: string): string {
  const digest = createHash("sha256").update(clerkId.trim()).digest("hex").slice(0, 32);
  return `u-${digest}@${CLERK_PHONE_ONLY_EMAIL_DOMAIN}`;
}

export function isPhoneOnlyLocalEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${CLERK_PHONE_ONLY_EMAIL_DOMAIN}`));
}

/** البريد الحقيقي إن وُجد، وإلا المعرّف الداخلي. */
export function localEmailForClerkUser(u: ClerkUserLike): string {
  return clerkUserRealEmail(u) || phoneOnlyLocalEmail(u.id);
}
