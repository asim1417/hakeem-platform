/**
 * test-judgment-cards.ts — اختبار وحدة نقيّ لطبقة بطاقات الأحكام (بلا قاعدة/شبكة).
 * يتحقّق: parseCard (تسامح + تقييد)، فحص الاتساق، إثبات المادة نصًّا، وقرار المراجعة.
 *   npx tsx scripts/test-judgment-cards.ts
 */
import { parseCard, EXTRACTOR_VERSION } from "@/lib/modules/judgment-cards/card-schema";
import { checkConsistency, verifyArticleInText, decideReviewStatus } from "@/lib/modules/judgment-cards/consistency";
import { parseVerify } from "@/lib/modules/judgment-cards/prompts";
import { normalizeAr, toWesternDigits } from "@/lib/modules/judgment-cards/card-schema";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// نصّ حكم مُصطنَع يذكر المادة (السادسة) صراحةً واقتباسًا
const JUDGMENT = [
  "الحمد لله وحده، وبعد، ففي الدعوى المقامة من المدعي ضد المدعى عليه بشأن مطالبة مالية عن عقد مقاولة.",
  "دفع المدعى عليه بعدم الاختصاص المكاني، وبعد المداولة قررت الدائرة رفض هذا الدفع.",
  "واستندت الدائرة إلى المادة (السادسة) من نظام المحاكم التجارية التي تقضي باختصاص المحكمة.",
  "كما طبّقت الدائرة المادة 12 من نظام المحاكم التجارية بشأن نطاق الاختصاص.",
  "لذا حكمت الدائرة بإلزام المدعى عليه بأن يدفع للمدعي مبلغ خمسين ألف ريال.",
].join("\n");

console.log("① parseCard — تسامح + تقييد + تحويل ''→null");
{
  const raw = "```json\n" + JSON.stringify({
    disputeType: "مقاولة",
    claims: [{ text: "مطالبة مالية", outcome: "قُبل" }],
    defenses: [{ text: "عدم الاختصاص المكاني", type: "شكلي", outcome: "رُفض" }],
    appliedArticles: [{ system: "نظام المحاكم التجارية", article: "6", quote: "واستندت الدائرة إلى المادة (السادسة) من نظام المحاكم التجارية" }],
    result: "إلزام المدعى عليه بخمسين ألف ريال",
    resultCategory: "للمدعي كاملًا",
    amounts: { claimed: "٥٠٠٠٠", awarded: 50000 },
    court: { circuit: "الأولى", degree: "ابتدائي", year: "1445هـ" },
    confidence: 0.92,
  }) + "\n```";
  const r = parseCard(raw);
  check("parse ok", r.ok);
  if (r.ok) {
    check("claims length 1", r.card.claims.length === 1);
    check("amounts.claimed coerced to 50000", r.card.amounts.claimed === 50000);
    check("confidence clamped 0.92", r.card.confidence === 0.92);
    check("court.degree kept", r.card.court.degree === "ابتدائي");
  }
}

console.log("② parseCard — حقول ناقصة تصبح []/null");
{
  const r = parseCard('{"disputeType":"","confidence":5}');
  check("parse ok on sparse", r.ok);
  if (r.ok) {
    check("disputeType '' → null", r.card.disputeType === null);
    check("claims default []", Array.isArray(r.card.claims) && r.card.claims.length === 0);
    check("confidence 5 clamped to 1", r.card.confidence === 1);
    check("resultCategory null", r.card.resultCategory === null);
  }
}

console.log("③ verifyArticleInText — اقتباس منقول + رقم قرب «مادة»");
{
  const nt = normalizeAr(toWesternDigits(JUDGMENT));
  const byQuote = verifyArticleInText(nt, { system: "نظام المحاكم التجارية", article: "6", quote: "واستندت الدائرة إلى المادة (السادسة) من نظام المحاكم التجارية" });
  check("verified via quote", byQuote.verified && byQuote.how === "quote");
  const byNumber = verifyArticleInText(nt, { system: "نظام المحاكم التجارية", article: "12", quote: null });
  check("verified via number-near-مادة", byNumber.verified && byNumber.how === "number");
  const bogus = verifyArticleInText(nt, { system: "نظام العمل", article: "999", quote: "مادة مختلقة لا وجود لها في النص إطلاقًا هنا" });
  check("bogus article NOT verified", !bogus.verified);
}

console.log("④ checkConsistency — تعارض دفع مقبول مع «للمدعي كاملًا»");
{
  const card = parseCard(JSON.stringify({
    disputeType: "مقاولة",
    defenses: [{ text: "دفع موضوعي", type: "موضوعي", outcome: "قُبل" }],
    appliedArticles: [],
    result: "حكم",
    resultCategory: "للمدعي كاملًا",
    confidence: 0.9,
  }));
  if (card.ok) {
    const c = checkConsistency(card.card, JUDGMENT);
    check("conflict flagged", c.reasons.some((r) => r.includes("تعارض")));
  } else check("card parsed for consistency", false);
}

console.log("⑤ checkConsistency — مادة غير مثبتة نصًّا تُحال");
{
  const card = parseCard(JSON.stringify({
    appliedArticles: [{ system: "نظام العمل", article: "77", quote: "اقتباس غير موجود في نص الحكم بتاتًا" }],
    result: "حكم", resultCategory: "جزئيًا", confidence: 0.9,
  }));
  if (card.ok) {
    const c = checkConsistency(card.card, JUDGMENT);
    check("unverified article flagged", !c.allArticlesInText && c.reasons.some((r) => r.includes("لم تُثبَت")));
  } else check("card parsed", false);
}

console.log("⑥ decideReviewStatus");
{
  check("auto when agreed+high+clean", decideReviewStatus({ verifierAgreed: true, confidence: 0.9, consistencyReasons: [] }) === "auto");
  check("needs_review on low confidence", decideReviewStatus({ verifierAgreed: true, confidence: 0.7, consistencyReasons: [] }) === "needs_review");
  check("needs_review on disagreement", decideReviewStatus({ verifierAgreed: false, confidence: 0.99, consistencyReasons: [] }) === "needs_review");
  check("needs_review on consistency reason", decideReviewStatus({ verifierAgreed: true, confidence: 0.95, consistencyReasons: ["x"] }) === "needs_review");
}

console.log("⑦ parseVerify — تسامح + تحفّظ عند الغموض");
{
  check("agreed true", parseVerify('{"agreed":true,"disagreements":[]}').agreed === true);
  check("garbage → agreed false", parseVerify("لا JSON هنا").agreed === false);
  check("version constant", EXTRACTOR_VERSION === "cards-v1");
}

console.log(`\nالنتيجة: نجح ${pass}، فشل ${fail}`);
process.exit(fail === 0 ? 0 : 1);
