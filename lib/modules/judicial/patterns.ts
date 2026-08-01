// ─────────────────────────────────────────────────────────────────────────────
// §11 — سجلّ الأنماط القضائيّة (Judicial Pattern Registry) — بذرة PR1
//
// أنماط اللغة القضائيّة المشتقّة من النواة اللغويّة (§13) المزوّدة في الأمر الحاكم
// نفسه — مصدرها INTERNAL_HAKEEM_POLICY لا مرجعٌ خارجيّ، فلا اختلاق. أنماط المنهج
// والتسلسل المستخرَجة من المرجعين القضائيّين (§10) تُضاف في PR5 بعد قراءتهما بصور
// الصفحات وتسجيل صفحاتها (sourcePage) — وتبقى قائمة الأنماط هنا فارغةً منها عمدًا.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialPattern } from "./contracts";
import { BENCH_LEXICON, PARTY_LEXICON } from "./language-kernel";

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

// أنماط أفعال المحكمة (صوت الحسم) — كلٌّ مقيّدٌ بمقامه ومنعِ نقله لصوت الطرف.
const benchVerbPatterns: JudicialPattern[] = BENCH_LEXICON.map((l) => ({
  id: nextId("JVERB"),
  code: `BENCH_${l.term.replace(/\s+/g, "_")}`,
  version: "0.1.0",
  status: "DRAFT",
  patternClass: "JUDICIAL_VERB",
  sourceLayer: "INTERNAL_HAKEEM_POLICY",
  sourceSection: "HKM-JDS-002 §13.1",
  normalizedPatternAr: l.term,
  semanticFunctionAr: l.meaningAr,
  appliesToRoles: ["JUDGE", "JUDICIAL_ASSISTANT"],
  appliesToDomains: [],
  appliesToStages: [],
  appliesToDocumentTypes: ["REASONING", "DISPOSITION", "PROCEDURAL_DECISION"],
  appliesWhen: [l.allowedWhenAr],
  prohibitedWhen: ["في مذكّرة طرفٍ أو محامٍ", "قبل تحقّق سببه النظاميّ"],
  requiredAuthorityTypes: ["CURRENT_OFFICIAL_AUTHORITY"],
  currentLawCheckRequired: true,
  variables: [],
  positiveExamples: [],
  negativeExamples: [],
}));

// أنماط ألفاظ الطرف/المحامي (دفوع وطلبات) — يمنع بها صوت الحسم.
const partyPatterns: JudicialPattern[] = PARTY_LEXICON.map((l) => ({
  id: nextId("PARTY"),
  code: `PARTY_${l.term.replace(/\s+/g, "_")}`,
  version: "0.1.0",
  status: "DRAFT",
  patternClass: "CLAIM_FORMULATION",
  sourceLayer: "INTERNAL_HAKEEM_POLICY",
  sourceSection: "HKM-JDS-002 §13.2",
  normalizedPatternAr: l.term,
  semanticFunctionAr: l.meaningAr,
  appliesToRoles: ["LAWYER", "PARTY"],
  appliesToDomains: [],
  appliesToStages: [],
  appliesToDocumentTypes: ["CLAIM_FORMULATION", "ANSWER_FORMULATION", "DEFENSE", "OBJECTION"],
  appliesWhen: [l.allowedWhenAr],
  prohibitedWhen: ["بصوت المحكمة الحاسم"],
  requiredAuthorityTypes: [],
  currentLawCheckRequired: false,
  variables: [],
  positiveExamples: [],
  negativeExamples: [],
}));

export const JUDICIAL_PATTERNS: readonly JudicialPattern[] = [...benchVerbPatterns, ...partyPatterns];

export function getPattern(id: string): JudicialPattern | undefined {
  return JUDICIAL_PATTERNS.find((p) => p.id === id);
}

export function patternsForClass(patternClass: JudicialPattern["patternClass"]): JudicialPattern[] {
  return JUDICIAL_PATTERNS.filter((p) => p.patternClass === patternClass);
}
