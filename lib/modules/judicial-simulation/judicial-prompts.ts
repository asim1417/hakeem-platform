// قوالب توجيه المحاكاة القضائية: تُلزم المزوّد بمنظور القاضي، إسناد صارم،
// تنبيه تدريبي، ومنع صياغة حكم قطعي عند نقص المصادر.
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import type { LegalActionPlan } from "@/lib/modules/legal-agent/types";
import { LITIGATION_STAGE_LABELS, type JudicialSimulationInput } from "./types";

/** تعليمات النظام: شخصية القاضي المُحاكى + الإسناد + مخطط JSON ثابت. */
export function buildJudicialSystemPrompt(): string {
  return [
    "أنت قاضٍ سعودي مُحاكى داخل منصة حكيم لأغراض تدريبية وتحليلية فقط.",
    "تنبيه إلزامي: مخرجاتك ليست حكماً قضائياً فعلياً ولا تُصاغ بصيغة حكم نهائي ملزم.",
    "اعتمد حصراً على «تحليل القضية والمصادر المرفقة» (مواد/أحكام/مبادئ/استشهادات)، ولا تختلق مادة أو حكماً أو مبدأ غير موجود.",
    "استند حصريًا للمواد المرفقة من النواة القانونية. لا تذكر مادة ليست فيها، ولا رقم مادة غير وارد في نصّها المرفق.",
    "صُغ المنطوق المحتمل بصيغة احتمالية غير ملزمة، ولا تُعطِ نتيجة قطعية عند نقص المصادر أو انخفاض الثقة.",
    "أعِد ناتجك حصراً ككائن JSON صالح (بلا أي نصّ قبله أو بعده وبلا تعليقات) بهذه المفاتيح:",
    "{",
    '  "preliminaryCharacterization": "التكييف القضائي الأولي",',
    '  "probableJurisdiction": "الاختصاص المحتمل",',
    '  "admissibilityNotes": ["ملاحظات القبول الشكلي"],',
    '  "disputeSubject": "محل النزاع",',
    '  "influentialEvidence": ["البيّنات المؤثّرة"],',
    '  "judicialQuestions": ["الأسئلة القضائية للأطراف/الشهود"],',
    '  "defensesHeardFirst": ["الدفوع التي يرجّح نظرها أولاً"],',
    '  "proceduralDecisions": ["القرارات الإجرائية المحتملة"],',
    '  "clarificationsNeeded": ["نقاط تحتاج استيضاحاً"],',
    '  "plaintiffPosition": "تقدير موقف المدعي",',
    '  "defendantPosition": "تقدير موقف المدعى عليه",',
    '  "probableDirection": "الاتجاه القضائي المحتمل",',
    '  "draftReasoning": ["مسودة أسباب الحكم بالترتيب"],',
    '  "tentativeRuling": "منطوق محتمل غير ملزم",',
    '  "appealRisks": ["مخاطر الاستئناف"],',
    '  "cassationFactors": ["نقاط قد تؤثّر في نقض أو تأييد الحكم"]',
    "}",
    "لا تُضِف استشهادات جديدة؛ تُؤخذ من المصادر المرفقة فقط.",
  ].join("\n");
}

/** رسالة المستخدم: المدخلات + تحليل القضية + خطة الوكيل + المصادر + نصّ المواد من النواة.
 * groundingContext (اختياري): نصّ المواد المسترجَع من النواة عبر buildLegalContextForAI مع
 * القاعدة الإلزامية «لا تخترع مواد» — كي تُبنى المحاكاة حول نصّ حقيقي لا حول مرجع مجرّد. */
export function buildJudicialUserPrompt(
  input: JudicialSimulationInput,
  analysis: CaseAnalysisResult,
  plan: LegalActionPlan,
  groundingContext?: string
): string {
  const lines: string[] = [];
  lines.push("== مدخلات الدعوى ==");
  if (input.caseType?.trim()) lines.push(`نوع القضية: ${input.caseType.trim()}`);
  lines.push(`المرحلة الإجرائية: ${LITIGATION_STAGE_LABELS[input.litigationStage ?? "FIRST_INSTANCE"]}`);
  if (input.jurisdiction?.trim()) lines.push(`جهة الاختصاص المُدخَلة: ${input.jurisdiction.trim()}`);
  lines.push(`الوقائع: ${input.caseFacts.trim()}`);
  if (input.claims?.trim()) lines.push(`الطلبات: ${input.claims.trim()}`);
  if (input.defenses?.trim()) lines.push(`الدفوع: ${input.defenses.trim()}`);
  if (input.evidenceSummary?.trim()) lines.push(`ملخّص البيّنات: ${input.evidenceSummary.trim()}`);
  if (input.documents?.length) lines.push(`المستندات: ${input.documents.map((d) => d.trim()).filter(Boolean).join("؛ ")}`);

  lines.push("");
  lines.push("== تحليل القضية ==");
  lines.push(`التكييف: ${analysis.disputeCharacterization}`);
  if (analysis.materialFacts.length) lines.push(`الوقائع المنتِجة: ${analysis.materialFacts.join("؛ ")}`);
  lines.push(`عبء الإثبات: ${analysis.burdenOfProof}`);
  if (analysis.requiredEvidence.length) lines.push(`عناصر الإثبات: ${analysis.requiredEvidence.join("؛ ")}`);
  lines.push(`تقدير قوة الدعوى: ${analysis.caseStrengthScore}/100 — ثقة الإسناد: ${(analysis.confidence * 100).toFixed(0)}%`);

  lines.push("");
  lines.push("== خطة الوكيل القانوني ==");
  lines.push(`الاستراتيجية: ${plan.litigationStrategy}`);
  if (plan.legalIssues.length) lines.push(`المسائل القانونية: ${plan.legalIssues.join("؛ ")}`);

  if (groundingContext?.trim()) {
    lines.push("");
    lines.push("== نصّ المواد من النواة القانونية (استند إليه حصرًا) ==");
    lines.push(groundingContext.trim());
  }

  lines.push("");
  lines.push("== المصادر المرفقة (لا تتجاوزها ولا تختلق غيرها) ==");
  if (analysis.influentialArticles.length) {
    lines.push("[المواد النظامية]");
    analysis.influentialArticles.forEach((a, i) => lines.push(`A${i + 1}) ${a.reference}`));
  }
  if (analysis.similarRulings.length) {
    lines.push("[الأحكام المشابهة]");
    analysis.similarRulings.forEach((r, i) => lines.push(`R${i + 1}) ${r.title}`));
  }
  if (analysis.citations.length) {
    lines.push("[الاستشهادات المتحقّقة]");
    analysis.citations.forEach((c, i) => lines.push(`C${i + 1}) ${c.reference}`));
  }
  if (!analysis.influentialArticles.length && !analysis.citations.length) {
    lines.push("(لا مصادر كافية — قدّم محاكاة أوّلية متحفّظة دون اختلاق مواد أو أحكام، ونبّه إلى عدم كفاية المصادر.)");
  }

  lines.push("");
  lines.push("أعِد كائن JSON فقط بالمفاتيح المحدّدة في التعليمات.");
  return lines.join("\n");
}
