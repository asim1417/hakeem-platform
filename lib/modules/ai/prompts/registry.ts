// سجلّ البرومبتات — المخطط السيادي §17 (Prompt Registry).
//
// مرحلة أولى غير كاسرة: كتالوج حوكمة يعطي كل برومبتٍ قائمٍ هويّةً (معرّف/إصدار/مالك/
// مصدر/متغيّرات) دون نقل نصّه من مكانه — فلا يتغيّر أي مسار توليد. النقل الحرفيّ للنصّ
// إلى ملفات مستقلّة يأتي لاحقًا خلف نفس المعرّفات (اختبار golden يحرس التطابق).

export interface PromptDescriptor {
  id: string;
  version: string;
  owner: string;
  /** الملف الذي يبني هذا البرومبت حاليًّا (مصدر الحقيقة النصّيّ الآن). */
  sourceModule: string;
  builder: string; // اسم الدالة الباني
  kind: "system" | "user";
  variables: string[];
  description: string;
}

export const PROMPT_REGISTRY: PromptDescriptor[] = [
  // ── الاستشارة/الإجابة القانونية ──
  { id: "legal.answer.system", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildAnswerSystemPrompt", kind: "system", variables: [], description: "نظام الإجابة القانونية المؤصَّلة." },
  { id: "legal.answer.user", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildAnswerUserPrompt", kind: "user", variables: ["facts", "question", "sources"], description: "مستخدم الإجابة القانونية." },
  { id: "legal.summary.system", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildSummarySystemPrompt", kind: "system", variables: [], description: "نظام التلخيص القانونيّ." },
  { id: "legal.summary.user", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildSummaryUserPrompt", kind: "user", variables: ["facts"], description: "مستخدم التلخيص." },
  { id: "legal.reasoning.system", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildReasoningSystemPrompt", kind: "system", variables: [], description: "نظام التسبيب." },
  { id: "legal.reasoning.user", version: "1.0.0", owner: "legal-core", sourceModule: "lib/modules/ai/legal-prompts.ts", builder: "buildReasoningUserPrompt", kind: "user", variables: ["facts"], description: "مستخدم التسبيب." },
  // ── المحاكاة القضائية ──
  { id: "judicial.simulation.system", version: "1.0.0", owner: "judicial-simulation", sourceModule: "lib/modules/judicial-simulation/judicial-prompts.ts", builder: "buildJudicialSystemPrompt", kind: "system", variables: [], description: "نظام القاضي التفاعليّ." },
  { id: "judicial.simulation.user", version: "1.0.0", owner: "judicial-simulation", sourceModule: "lib/modules/judicial-simulation/judicial-prompts.ts", builder: "buildJudicialUserPrompt", kind: "user", variables: ["stage", "context"], description: "مستخدم المحاكاة." },
  // ── تحليل القضية ──
  { id: "case.analysis.system", version: "1.0.0", owner: "case-analysis", sourceModule: "lib/modules/case-analysis/case-prompts.ts", builder: "buildCaseAnalysisSystemPrompt", kind: "system", variables: [], description: "نظام تحليل القضية." },
  { id: "case.analysis.user", version: "1.0.0", owner: "case-analysis", sourceModule: "lib/modules/case-analysis/case-prompts.ts", builder: "buildCaseAnalysisUserPrompt", kind: "user", variables: ["input", "sources", "groundingContext"], description: "مستخدم تحليل القضية." },
  // ── الوكيل القانونيّ ──
  { id: "legal.agent.system", version: "1.0.0", owner: "legal-agent", sourceModule: "lib/modules/legal-agent/legal-agent-prompts.ts", builder: "buildLegalAgentSystemPrompt", kind: "system", variables: [], description: "نظام الوكيل القانونيّ." },
  { id: "legal.agent.user", version: "1.0.0", owner: "legal-agent", sourceModule: "lib/modules/legal-agent/legal-agent-prompts.ts", builder: "buildLegalAgentUserPrompt", kind: "user", variables: ["input", "analysis", "groundingContext"], description: "مستخدم الوكيل القانونيّ." },
];

export function listPrompts(): PromptDescriptor[] {
  return PROMPT_REGISTRY;
}

export function getPrompt(id: string): PromptDescriptor | null {
  return PROMPT_REGISTRY.find((p) => p.id === id) ?? null;
}

/** تحقّق حوكميّ: تفرّد المعرّفات وصحّة صيغة الإصدار (SemVer). */
export function validateRegistry(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();
  const semver = /^\d+\.\d+\.\d+$/;
  for (const p of PROMPT_REGISTRY) {
    if (seen.has(p.id)) errors.push(`معرّف مكرّر: ${p.id}`);
    seen.add(p.id);
    if (!semver.test(p.version)) errors.push(`إصدار غير صالح: ${p.id} → ${p.version}`);
    if (!p.owner) errors.push(`مالك مفقود: ${p.id}`);
  }
  return { ok: errors.length === 0, errors };
}
