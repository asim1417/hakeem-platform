/**
 * «العرض الحي» في الرئيسية — معطّل افتراضيًا حتى يراجع المالك نصه.
 *   HOME_LIVE_DEMO_ENABLED=1 لتفعيله (Vercel أو الإعدادات المُدارة).
 *   HOME_DEMO_VIDEO_URL=https://… يُظهر زر «شاهد التجربة كاملة»، وإلا يُخفى.
 */
export function isHomeLiveDemoEnabled(): boolean {
  const v = (process.env.HOME_LIVE_DEMO_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

/** رابط الفيديو الكامل — https فقط، وإلا null (يُخفى الزر). */
export function homeDemoVideoUrl(): string | null {
  const raw = (process.env.HOME_DEMO_VIDEO_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
