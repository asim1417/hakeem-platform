// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 — طبقة الإجراءات والصياغة القضائيّة السعوديّة (JDS v2) — الواجهة العامّة
//
// طبقةٌ مشتركة تستوردها كلّ خدمات المنصّة (اسأل حكيم، القاضي التفاعلي، الوكيل القانوني،
// المساعد القضائي، الاستشارات) فتنتفع بتصنيفٍ وسلطةٍ ولغةٍ وبوّاباتِ جودةٍ موحّدة.
// PR1: عقود + سجلّات. لا مكدّس ثالث — تُركَّب هذه العقود فوق المحرّكات القائمة.
// ─────────────────────────────────────────────────────────────────────────────
export * from "./contracts";
export {
  BENCH_LEXICON,
  PARTY_LEXICON,
  FACT_STATUS_LEXICON,
  ASSERTION_LEVEL_POLICY,
  BENCH_ONLY_DECISIVE_TERMS,
  lexiconForVoice,
  assertionViolations,
} from "./language-kernel";
export type { JudicialLexeme, FactStatusLexeme, AssertionLevelPolicy } from "./language-kernel";
export {
  JUDICIAL_QUALITY_GATES,
  BLOCKING_ERROR_CODES,
  getQualityGate,
  blockingGatesFor,
} from "./quality-gates";
export { JUDICIAL_DOMAIN_PACKS, getDomainPack, domainPackForTrack } from "./domain-packs";
export {
  characterizeJudicialTask,
  voiceProfileFor,
} from "./task-characterization";
export type { CharacterizationInput } from "./task-characterization";
export { JUDICIAL_PATTERNS, getPattern, patternsForClass } from "./patterns";
export { JDS_DDL, JDS_TABLES, ensureJudicialCoreSchema } from "./schema-ensure";
export { buildDomainPackRows, seedDomainPacks } from "./seed";
export type { DomainPackSeedRow, SeedResult } from "./seed";

/** إصدار طبقة JDS ومرجع الأمر الحاكم — للتتبّع والتدقيق. */
export const JDS_META = {
  order: "HKM-JDS-002",
  layerVersion: "2.0.0-pr1",
  scope: "Saudi judicial procedure & drafting — shared contracts layer",
} as const;
