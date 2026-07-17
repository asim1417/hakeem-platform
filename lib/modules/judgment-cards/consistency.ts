/**
 * consistency.ts — قواعد الاتساق الآلية (نقيّة) على البطاقة مقابل نصّ الحكم.
 *
 * ١) كل مادة في appliedArticles وردت فعلًا في نصّ الحكم (فحص نصّي تحقيقي عبر الاقتباس أو رقم المادة).
 * ٢) دفع outcome='قُبل' يجب ألّا يتعارض مع resultCategory (مثلاً «للمدعي كاملًا» مع قبول دفعٍ موضوعي).
 * ٣) لا بطاقة بلا result وresultCategory.
 * الربط بسجلّ الأنظمة (القاعدة) يتمّ في المُشغّل — هنا المنطق النقيّ فقط.
 */
import { normalizeAr, toWesternDigits, type JudgmentCard, type AppliedArticle } from "./card-schema";

export type ArticleCheck = { index: number; system: string | null; article: string | null; verified: boolean; how: "quote" | "number" | "none" };

export type ConsistencyResult = {
  articleChecks: ArticleCheck[];
  reasons: string[]; // أسباب الإحالة للمراجعة (فارغ = متّسق)
  allArticlesInText: boolean;
};

const norm = (s: string) => normalizeAr(toWesternDigits(s));

/** هل وردت المادة فعلًا في نصّ الحكم؟ الاقتباس (منقول حرفيًّا) أساسٌ، ثم حضور الرقم قرب «مادة». */
export function verifyArticleInText(normText: string, applied: AppliedArticle): { verified: boolean; how: ArticleCheck["how"] } {
  const q = norm(applied.quote || "");
  if (q.length >= 15) {
    const probe = q.length > 60 ? q.slice(0, 60) : q;
    if (normText.includes(probe)) return { verified: true, how: "quote" };
  }
  // احتياط: رقم المادة يظهر قرب لفظ «مادة» في النصّ
  const digits = toWesternDigits(applied.article || "").match(/\d+/)?.[0];
  if (digits) {
    const re = new RegExp(`ماد\\S*\\s*[^\\d]{0,8}${digits}(?!\\d)`);
    if (re.test(normText)) return { verified: true, how: "number" };
  }
  return { verified: false, how: "none" };
}

export function checkConsistency(card: JudgmentCard, judgmentText: string): ConsistencyResult {
  const normText = norm(judgmentText);
  const reasons: string[] = [];

  // ① المواد في النصّ
  const articleChecks: ArticleCheck[] = card.appliedArticles.map((a, i) => {
    const { verified, how } = verifyArticleInText(normText, a);
    return { index: i, system: a.system, article: a.article, verified, how: verified ? how : "none" };
  });
  const unverified = articleChecks.filter((c) => !c.verified);
  const allArticlesInText = unverified.length === 0;
  if (unverified.length > 0) {
    reasons.push(`مواد لم تُثبَت نصًّا (${unverified.length}): ${unverified.map((c) => c.article ?? "?").join("، ")}`);
  }

  // ② تعارض دفعٍ مقبول مع نتيجة لصالح المدّعي كاملًا
  const acceptedDefense = card.defenses.some((d) => d.outcome === "قُبل");
  if (acceptedDefense && card.resultCategory === "للمدعي كاملًا") {
    reasons.push("تعارض: قُبِل دفعٌ بينما النتيجة «للمدعي كاملًا».");
  }

  // ③ اكتمال النتيجة
  if (!card.result) reasons.push("لا يوجد result.");
  if (!card.resultCategory) reasons.push("لا يوجد resultCategory.");

  return { articleChecks, reasons, allArticlesInText };
}

/**
 * القرار النهائي لحالة المراجعة اعتمادًا على: اتفاق المدقّق، الثقة، والاتساق الآلي.
 * اتفاق + ثقة ≥ 0.85 + لا أسباب اتساق ⇒ auto. غير ذلك ⇒ needs_review.
 */
export function decideReviewStatus(input: {
  verifierAgreed: boolean;
  confidence: number;
  consistencyReasons: string[];
}): "auto" | "needs_review" {
  if (input.verifierAgreed && input.confidence >= 0.85 && input.consistencyReasons.length === 0) return "auto";
  return "needs_review";
}
