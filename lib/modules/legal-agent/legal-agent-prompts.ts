// قوالب توجيه الوكيل القانوني: يحوّل تحليل القضية إلى خطة عمل عملية،
// ملتزماً بالإسناد (لا اختلاق مادة/حكم/مبدأ) وبوسم الدفوع غير المسندة.
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import { PARTY_ROLE_LABELS, type LegalAgentInput } from "./types";

/** تعليمات النظام: شخصية الوكيل + الإسناد الصارم + مخطط JSON ثابت. */
export function buildLegalAgentSystemPrompt(): string {
  return [
    "أنت وكيل قانوني سعودي خبير داخل منصة حكيم، تحوّل تحليل القضية إلى خطة عمل عملية للمحامي.",
    "اعتمد حصراً على «تحليل القضية والمصادر المرفقة» (مواد/أحكام/مبادئ/استشهادات)، ولا تختلق مادة أو حكماً أو مبدأ غير موجود.",
    "إن لم يكن للدفع سند صريح في المصادر فاذكره مع وسمه بأنه «احتمالية تحتاج تحقق» (ضع basis فارغاً).",
    "إن كانت الثقة منخفضة أو المصادر ناقصة فلا تُعطِ نتيجة قطعية، واجعل التوصية متحفّظة.",
    "أعِد ناتجك حصراً ككائن JSON صالح (بلا أي نصّ قبله أو بعده وبلا تعليقات) بهذه المفاتيح:",
    "{",
    '  "caseSummary": "ملخص القضية",',
    '  "legalIssues": ["المسائل القانونية الرئيسية"],',
    '  "litigationStrategy": "استراتيجية الدعوى",',
    '  "successOpportunities": ["فرص النجاح"],',
    '  "pleadingPlan": ["خطوات خطة المرافعة بالترتيب"],',
    '  "suggestedQuestions": ["أسئلة للخصم أو الشهود"],',
    '  "gapsToClose": ["الثغرات الواجب سدّها"],',
    '  "practicalRecommendation": "التوصية العملية للمحامي",',
    '  "additionalDefenses": [{ "text": "دفع إضافي", "category": "FORMAL|SUBSTANTIVE|PROCEDURAL", "basis": "سند الدفع أو فارغ" }]',
    "}",
    "تصنيف الدفوع: شكلية=FORMAL، موضوعية=SUBSTANTIVE، إجرائية=PROCEDURAL.",
    "لا تُضِف استشهادات جديدة؛ الاستشهادات تُؤخذ من المصادر المرفقة فقط.",
  ].join("\n");
}

/** رسالة المستخدم: مدخلات الوكيل + خلاصة تحليل القضية ومصادره. */
export function buildLegalAgentUserPrompt(input: LegalAgentInput, analysis: CaseAnalysisResult): string {
  const lines: string[] = [];
  lines.push("== مدخلات الوكيل ==");
  if (input.partyRole) lines.push(`دور الموكِّل: ${PARTY_ROLE_LABELS[input.partyRole]}`);
  if (input.caseType?.trim()) lines.push(`نوع القضية: ${input.caseType.trim()}`);
  if (input.jurisdiction?.trim()) lines.push(`جهة الاختصاص: ${input.jurisdiction.trim()}`);
  lines.push(`الوقائع: ${input.caseFacts.trim()}`);
  if (input.claims?.trim()) lines.push(`الطلبات: ${input.claims.trim()}`);
  if (input.defenses?.trim()) lines.push(`دفوع الخصم: ${input.defenses.trim()}`);
  if (input.documents?.length) lines.push(`المستندات: ${input.documents.map((d) => d.trim()).filter(Boolean).join("؛ ")}`);

  lines.push("");
  lines.push("== تحليل القضية (من محرّك التحليل) ==");
  lines.push(`توصيف النزاع: ${analysis.disputeCharacterization}`);
  if (analysis.materialFacts.length) lines.push(`الوقائع المنتِجة: ${analysis.materialFacts.join("؛ ")}`);
  lines.push(`عبء الإثبات: ${analysis.burdenOfProof}`);
  if (analysis.requiredEvidence.length) lines.push(`عناصر الإثبات: ${analysis.requiredEvidence.join("؛ ")}`);
  if (analysis.strengths.length) lines.push(`نقاط القوة: ${analysis.strengths.join("؛ ")}`);
  if (analysis.weaknesses.length) lines.push(`نقاط الضعف: ${analysis.weaknesses.join("؛ ")}`);
  if (analysis.legalRisks.length) lines.push(`المخاطر: ${analysis.legalRisks.join("؛ ")}`);
  lines.push(`تقدير قوة الدعوى: ${analysis.caseStrengthScore}/100 — ثقة الإسناد: ${(analysis.confidence * 100).toFixed(0)}%`);

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
  if (!analysis.influentialArticles.length && !analysis.similarRulings.length && !analysis.citations.length) {
    lines.push("(لا مصادر كافية — قدّم خطة أوّلية متحفّظة دون اختلاق مواد أو أحكام، وانبّه إلى الحاجة لمصادر إضافية.)");
  }

  lines.push("");
  lines.push("أعِد كائن JSON فقط بالمفاتيح المحدّدة في التعليمات.");
  return lines.join("\n");
}
