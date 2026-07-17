// قوالب توجيه تحليل القضية: تُلزم المزوّد بناتج JSON مُسنَد لا اختلاق فيه.
import type { CaseAnalysisInput } from "./types";

export interface CaseSources {
  articles: { reference: string; snippet: string }[];
  rulings: { reference: string; snippet: string }[];
  principles: { reference: string; snippet: string }[];
}

/** تعليمات النظام: تحليل مُسنَد + ناتج JSON صارم بمفاتيح ثابتة. */
export function buildCaseAnalysisSystemPrompt(): string {
  return [
    "أنت محلّل قضايا قانوني سعودي منضبط بالمصادر داخل منصة حكيم.",
    "حلّل القضية اعتماداً على «المصادر القانونية المرفقة» فقط (مواد/أحكام/مبادئ)، ولا تختلق مادة أو حكماً أو مبدأ غير موجود فيها.",
    "استند حصريًا للمواد المرفقة من النواة القانونية. لا تذكر مادة ليست فيها، ولا رقم مادة غير وارد في نصّها المرفق.",
    "أعِد ناتجك حصراً ككائن JSON صالح (بلا أي نصّ قبله أو بعده، وبلا تعليقات) بهذه المفاتيح تحديداً:",
    "{",
    '  "disputeCharacterization": "توصيف النزاع قانونياً",',
    '  "materialFacts": ["الوقائع المنتِجة المؤثّرة في الحكم"],',
    '  "immaterialFacts": ["الوقائع غير المنتِجة"],',
    '  "requiredEvidence": ["عناصر الإثبات المطلوبة"],',
    '  "burdenOfProof": "على من يقع عبء الإثبات ولماذا",',
    '  "potentialDefenses": [{ "text": "نص الدفع", "category": "FORMAL|SUBSTANTIVE|PROCEDURAL", "basis": "سند الدفع" }],',
    '  "legalRisks": ["المخاطر القانونية"],',
    '  "strengths": ["نقاط القوة"],',
    '  "weaknesses": ["نقاط الضعف"]',
    "}",
    "تصنيف الدفوع: الشكلية=FORMAL، الموضوعية=SUBSTANTIVE، الإجرائية=PROCEDURAL.",
    "اربط كل عنصر بمصدره عند الإمكان (اسم النظام + رقم المادة، أو رقم الحكم، أو اسم المبدأ).",
    "إن لم تكفِ المصادر لعنصرٍ ما فاترك مصفوفته فارغة بدل اختلاق محتوى.",
  ].join("\n");
}

/** رسالة المستخدم: مدخلات القضية + المصادر المرفقة من Legal RAG + نصّ المواد من النواة.
 * groundingContext (اختياري): نصّ المواد المسترجَع من النواة الموحّدة عبر buildLegalContextForAI،
 * مع القاعدة الإلزامية «لا تخترع مواد». يُحقَن كي يحلّل النموذج حول نصّ حقيقي لا حول مرجع مجرّد. */
export function buildCaseAnalysisUserPrompt(input: CaseAnalysisInput, sources: CaseSources, groundingContext?: string): string {
  const lines: string[] = [];
  lines.push("== مدخلات القضية ==");
  lines.push(`الوقائع: ${input.facts.trim()}`);
  if (input.claims?.trim()) lines.push(`طلبات المدعي: ${input.claims.trim()}`);
  if (input.defenses?.trim()) lines.push(`دفوع المدعى عليه: ${input.defenses.trim()}`);
  if (input.documents?.length) lines.push(`المستندات: ${input.documents.map((d) => d.trim()).filter(Boolean).join("؛ ")}`);
  if (input.caseType?.trim()) lines.push(`نوع القضية: ${input.caseType.trim()}`);

  if (groundingContext?.trim()) {
    lines.push("");
    lines.push("== نصّ المواد من النواة القانونية (استند إليه حصرًا) ==");
    lines.push(groundingContext.trim());
  }

  lines.push("");
  lines.push("== المصادر القانونية المرفقة (لا تتجاوزها) ==");
  if (sources.articles.length) {
    lines.push("[المواد النظامية]");
    sources.articles.forEach((a, i) => lines.push(`A${i + 1}) ${a.reference}: ${a.snippet}`));
  }
  if (sources.rulings.length) {
    lines.push("[الأحكام القضائية]");
    sources.rulings.forEach((r, i) => lines.push(`R${i + 1}) ${r.reference}: ${r.snippet}`));
  }
  if (sources.principles.length) {
    lines.push("[المبادئ القضائية]");
    sources.principles.forEach((p, i) => lines.push(`P${i + 1}) ${p.reference}: ${p.snippet}`));
  }
  if (!sources.articles.length && !sources.rulings.length && !sources.principles.length) {
    lines.push("(لا مصادر مرفقة كافية — اقتصر على تحليل إجرائي عام دون اختلاق مواد أو أحكام.)");
  }

  lines.push("");
  lines.push("أعِد كائن JSON فقط بالمفاتيح المحدّدة في التعليمات.");
  return lines.join("\n");
}
