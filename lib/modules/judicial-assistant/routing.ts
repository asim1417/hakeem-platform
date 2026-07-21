// ─────────────────────────────────────────────────────────────────────────────
// مصدرُ توجيهٍ واحد لكلّ خدمةٍ من الـ24 → مُشغِّلها. تستعمله CaseActions للتشغيل،
// ويختبره verify:judicial ليضمن **عدم وجود خدمةٍ بلا مُشغِّل** (يلتقط أخطاء JS-005).
// أيّ خدمةٍ متاحةٍ في الكتالوج يجب أن تكون هنا، وإلا يفشل التحقّق.
// ─────────────────────────────────────────────────────────────────────────────

/** نوع المُشغِّل: مسارٌ نموذجيّ مؤصَّل · محرّكٌ حتميّ · تصدير · لوحة الخريطة. */
export type ServiceRunner = "summary" | "study" | "work" | "draft" | "deterministic" | "export" | "map";

/** الخدمات الحتميّة (تذهب لمسار /action) — يجب أن تطابق enum المسار حرفًا بحرف. */
export const DETERMINISTIC_IDS = ["JS-004", "JS-006", "JS-007", "JS-008", "JS-009", "JS-010", "JS-019", "JS-020", "JS-024"] as const;

/** خدمات النموذج الموحَّدة (تذهب لمسار /work). */
export const WORK_IDS = ["JS-002", "JS-003", "JS-011", "JS-012", "JS-014", "JS-015", "JS-016", "JS-017", "JS-021", "JS-022"] as const;

/** المصدر الواحد: معرّف الخدمة → مُشغِّلها. */
export const SERVICE_RUNNER: Record<string, ServiceRunner> = {
  "JS-001": "summary",
  "JS-005": "map",
  "JS-013": "study",
  "JS-018": "draft",
  "JS-023": "export",
  ...Object.fromEntries(WORK_IDS.map((id) => [id, "work" as ServiceRunner])),
  ...Object.fromEntries(DETERMINISTIC_IDS.map((id) => [id, "deterministic" as ServiceRunner])),
};

/** مُشغِّل خدمةٍ ما (سقوطٌ آمن إلى الحتميّ). */
export function runnerFor(serviceId: string): ServiceRunner {
  return SERVICE_RUNNER[serviceId] ?? "deterministic";
}
