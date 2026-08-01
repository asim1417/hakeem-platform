// ─────────────────────────────────────────────────────────────────────────────
// §31-I — أعلام تفعيل JDS (Feature Flags). كلّها **مطفأة افتراضيًّا** → لا تغيّر أيّ سلوكٍ
// حيّ حتى تُفعَّل صراحةً (Shadow Mode ثمّ Pilot). التفعيل عبر متغيّرات البيئة "1"/"true".
// ─────────────────────────────────────────────────────────────────────────────

function on(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
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
