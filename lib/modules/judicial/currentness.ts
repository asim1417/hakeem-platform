// ─────────────────────────────────────────────────────────────────────────────
// §7/§6.1 — إثبات السريان (Saudi Current Law Compatibility)
//
// يحوّل تاريخ سريان حزم المجال من "PENDING" إلى تاريخٍ مُثبَت — **فقط** إذا كان النظام
// الإجرائيّ الحاكم للمسار موجودًا وساريًا في النواة القانونيّة. إن لم يوجد ⇒ يبقى PENDING
// (لا اختلاق تاريخ). المطابقة الفعليّة بالنواة يقوم بها السكربت؛ هذا المُحلِّل **نقيّ**.
// ─────────────────────────────────────────────────────────────────────────────

/** الأنظمة السعوديّة الحاكمة لكلّ حزمة مسار (مرشّحاتٌ تُتحقَّق من النواة — لا تُفترَض). */
export const PACK_GOVERNING_SYSTEMS: Record<string, string[]> = {
  GENERAL_CIVIL_PACK: ["نظام المرافعات الشرعية"],
  COMMERCIAL_PACK: ["نظام المحكمة التجارية", "نظام المرافعات الشرعية"],
  LABOR_PACK: ["نظام العمل", "نظام المرافعات الشرعية"],
  PERSONAL_STATUS_PACK: ["نظام الأحوال الشخصية", "نظام المرافعات الشرعية"],
  CRIMINAL_PACK: ["نظام الإجراءات الجزائية"],
  EXECUTION_PACK: ["نظام التنفيذ"],
  ARBITRATION_PACK: ["نظام التحكيم"],
  ADMINISTRATIVE_PACK: ["نظام المرافعات أمام ديوان المظالم"],
  CROSS_JURISDICTION_PACK: ["نظام المرافعات الشرعية"],
};

/** نظامٌ حاكمٌ عُثر عليه في النواة (يمرّره السكربت بعد المطابقة الفعليّة). */
export interface GovSystemRecord {
  name: string;
  active: boolean; // status = سارية؟
  effectiveFrom?: string | null; // ISO — من النواة إن وُجد
  systemId?: string | null;
}

export interface PackCurrentnessResult {
  packId: string;
  /** تاريخ السريان المُثبَت (= asOfDate) إن ثبت حاكمٌ ساري، وإلا "PENDING". */
  lawAsOfDate: string;
  proven: boolean;
  governingFound: string[]; // الأنظمة الحاكمة الساريّة التي عُثر عليها
  missing: string[]; // الأنظمة المرشّحة التي لم تُوجَد/غير ساريّة
  snapshots: Array<{ systemName: string; effectiveFrom: string | null; systemId: string | null }>;
}

/**
 * يقرّر سريان حزمةٍ من الأنظمة الحاكمة المُتحقَّقة من النواة. نقيّ وحتميّ.
 * `found` = ما طابقه السكربت فعلًا في النواة لهذه الحزمة (بأيّ حالة).
 */
export function resolvePackCurrentness(
  packId: string,
  asOfDate: string,
  found: GovSystemRecord[],
): PackCurrentnessResult {
  const mapped = PACK_GOVERNING_SYSTEMS[packId] ?? [];
  const active = found.filter((f) => f.active);
  const foundNames = active.map((f) => f.name);
  // مفقود: مرشّحٌ لم يُطابِقه أيّ نظامٍ ساريٍّ عُثر عليه.
  const missing = mapped.filter(
    (m) => !active.some((f) => f.name.includes(m) || m.includes(f.name)),
  );
  const proven = active.length > 0;
  return {
    packId,
    lawAsOfDate: proven ? asOfDate : "PENDING",
    proven,
    governingFound: foundNames,
    missing,
    snapshots: active.map((f) => ({
      systemName: f.name,
      effectiveFrom: f.effectiveFrom ?? null,
      systemId: f.systemId ?? null,
    })),
  };
}
