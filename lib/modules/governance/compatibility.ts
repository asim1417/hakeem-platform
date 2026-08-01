// مصفوفة التوافق وسياسة الإهمال — المخطط السيادي §27. مصدر حقيقة واحد للإصدارات.

export interface ComponentVersion {
  component: string;
  version: string; // SemVer
  status: "active" | "deprecated";
}

export interface DeprecationEntry {
  target: string;
  since: string; // إصدار الإعلان
  removeIn: string; // إصدار الإزالة المزمع
  replacement: string;
  migration?: string; // مرجع أداة/دليل الترحيل
}

/** إصدارات المكوّنات الأساسيّة (تُحدَّث مع كل عقد). */
export const COMPATIBILITY_MATRIX: ComponentVersion[] = [
  { component: "platform", version: "0.1.0", status: "active" },
  { component: "external-api", version: "1.0.0", status: "active" },
  { component: "agent-manifest", version: "2.2.0", status: "active" },
  { component: "package-manifest", version: "1.0.0", status: "active" },
  { component: "event-envelope", version: "1.0.0", status: "active" },
  { component: "domain.legal-sa", version: "1.0.0", status: "active" },
  { component: "institution.aman", version: "1.0.0", status: "active" },
];

/** سياسة الإهمال: إعلان + مهلة + بديل + ترحيل (§27). فارغة الآن — لا إهمالات. */
export const DEPRECATIONS: DeprecationEntry[] = [];

const SEMVER = /^\d+\.\d+\.\d+$/;

/** تحقّق حوكميّ: كل الإصدارات SemVer، وكل إهمال يحمل بديلًا. */
export function validateCompatibility(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const c of COMPATIBILITY_MATRIX) {
    if (!SEMVER.test(c.version)) errors.push(`إصدار غير صالح: ${c.component}@${c.version}`);
  }
  for (const d of DEPRECATIONS) {
    if (!d.replacement) errors.push(`إهمال بلا بديل: ${d.target}`);
    if (!SEMVER.test(d.since) || !SEMVER.test(d.removeIn)) {
      errors.push(`إصدارات إهمال غير صالحة: ${d.target}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
