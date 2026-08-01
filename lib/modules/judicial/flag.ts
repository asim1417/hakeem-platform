// ─────────────────────────────────────────────────────────────────────────────
// §31-I — أعلام تفعيل JDS (Feature Flags). أغلبها مطفأٌ افتراضيًّا؛ استثناءً: **الوصل
// الفعّال (JDS_ENFORCE) مفعَّلٌ افتراضيًّا** بقرارٍ صريحٍ من مالك المنصّة (2026-08-01) —
// يُبرز المخالفات المانعة ويمنع اعتماد المخرج حتى تُصحَّح. للإطفاء: JDS_ENFORCE=0.
// التفعيل/الإطفاء عبر متغيّرات البيئة ("1"/"true"/"on"/"yes" مقابل "0"/"false"/"off").
// ─────────────────────────────────────────────────────────────────────────────

function on(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function off(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "no";
}

/** عَلَمٌ ذو افتراضٍ صريح: يُقرأ من البيئة، وإلا يعود إلى الافتراض المُمرَّر. */
function flagWithDefault(name: string, dflt: boolean): boolean {
  if (on(name)) return true;
  if (off(name)) return false;
  return dflt;
}

export const JDS_FLAGS = {
  PROCEDURE_V2: "JDS_PROCEDURE_V2",
  RECORD_V2: "JDS_RECORD_V2",
  LANGUAGE_V2: "JDS_LANGUAGE_V2",
  DOMAIN_PACKS_V2: "JDS_DOMAIN_PACKS_V2",
  REASONING_V2: "JDS_REASONING_V2",
  DISPOSITION_V2: "JDS_DISPOSITION_V2",
  OBJECTION_ROUTES_V2: "JDS_OBJECTION_ROUTES_V2",
  BACKGROUND_AGENT_V2: "JDS_BACKGROUND_AGENT_V2",
  /** ظلّيّ: يرفق مراجعة بوّابات JDS على مخرجات الصياغة القائمة (دون تغيير النصّ). */
  DRAFTING_SHADOW: "JDS_DRAFTING_SHADOW",
  /** فعّالٌ: يُصحّح — يُبرز المخالفات المانعة ويمنع اعتماد المخرج حتى تُصحَّح (§27). */
  ENFORCE: "JDS_ENFORCE",
} as const;

export type JdsFlagKey = keyof typeof JDS_FLAGS;

/** هل عَلَمٌ مفعَّل؟ افتراض OFF. */
export function isJdsFlagOn(key: JdsFlagKey): boolean {
  return on(JDS_FLAGS[key]);
}

/** الظلّ الصياغيّ (يُلحق مراجعة الجودة كبياناتٍ استرشاديّة فقط) — OFF افتراضًا. */
export function isJdsDraftingShadowEnabled(): boolean {
  return on(JDS_FLAGS.DRAFTING_SHADOW);
}

/** الافتراض المُعتمَد للوصل الفعّال: مفعَّلٌ بقرارٍ صريحٍ من مالك المنصّة (2026-08-01).
 *  للإطفاء الفوريّ دون تعديل كود: اضبط JDS_ENFORCE=0 في بيئة الإنتاج. */
export const JDS_ENFORCE_DEFAULT = true;

/** الوصل الفعّال (يُصحّح: يُبرز المخالفات المانعة ويمنع الاعتماد) — ON افتراضًا (قرارٌ صريح).
 *  تفعيله يُفعّل الظلّ ضمنًا (لا إنفاذ بلا مراجعة). للإطفاء: JDS_ENFORCE=0. */
export function isJdsEnforceEnabled(): boolean {
  return flagWithDefault(JDS_FLAGS.ENFORCE, JDS_ENFORCE_DEFAULT);
}
