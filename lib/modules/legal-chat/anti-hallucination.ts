// ─────────────────────────────────────────────────────────────────────────────
// SourceGroundingEngine + AntiHallucinationGuard.
// كل استناد قانوني يجب أن يكون له مصدر متحقَّق داخل النواة القانونية.
// إذا لم يوجد نص في النواة: يُصرّح بذلك ولا يُختلق رقم مادة أو حكم أو قاعدة.
// يعتمد على legal-core (findRelevantLegalArticles) — لا يخترع مصادر.
// ─────────────────────────────────────────────────────────────────────────────
import { findRelevantLegalArticles, type LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import type { GroundedSource, SearchStrength } from "./types";
import { normalizeArabic } from "./taxonomy";

export const NO_SOURCE_NOTE =
  "لا يظهر في النواة القانونية المتاحة نصٌّ صريح يمكن الاستناد إليه في هذه المسألة، ويحتاج الأمر إلى مراجعة مصدر نظامي معتمد.";

export const ANTI_HALLUCINATION_NOTE =
  "اقتصر الإسناد على ما هو ثابت فعلاً في النواة القانونية؛ ولم تُذكر أي مادة أو حكم غير متحقَّق منهما.";

/** عدد المواد المسترجَعة بحسب قوة البحث. */
function limitForStrength(strength: SearchStrength): number {
  switch (strength) {
    case "QUICK":
      return 4;
    case "BALANCED":
      return 8;
    case "DEEP":
      return 12;
    case "JUDICIAL_EXTENDED":
      return 16;
    case "ARBITRATION":
      return 8;
    default:
      return 8;
  }
}

/** يحوّل نتيجة النواة إلى مصدر مُسنَد للعرض. */
function toGroundedSource(r: LegalCoreResult): GroundedSource {
  const relevance: GroundedSource["relevance"] =
    r.relevanceScore >= 80 ? "HIGH" : r.relevanceScore >= 40 ? "MEDIUM" : "LOW";
  return {
    type: "article",
    systemName: r.systemName,
    reference: r.citationLabel || `${r.systemName} — المادة (${r.articleNumber})`,
    reason: r.relevanceReason || "وردت ضمن أعلى نتائج البحث في النواة لهذه المسألة.",
    explicit: r.conceptCoverage >= 0.5 || r.phraseMatches > 0,
    relevance,
  };
}

export interface GroundingResult {
  sources: GroundedSource[];
  hasSources: boolean;
  note: string; // ملاحظة حوكمية تظهر دائماً
  rawResults: LegalCoreResult[];
}

export const UNSPECIFIC_QUERY_NOTE =
  "لم تتّضح بعد مسألة قانونية كافية لاسترجاع نصوص موثوقة من النواة. فضلاً اذكر الوقائع أو المطلوب.";

const MIN_QUERY_WORDS = 4; // أقل من ذلك = استعلام عام لا يُسترجع له
const RELEVANCE_FLOOR = 30; // الحد الأدنى لدرجة الصلة المقبولة

/**
 * SourceRelevanceGate — يستبعد كل مادة غير مرتبطة بالمسألة.
 * يشترط درجة صلة كافية + تغطية مفاهيمية/عبارة/مصطلحات مطابقة (سبب واضح للاسترجاع).
 * يمنع تسرّب مواد عشوائية (مثل أنظمة لا علاقة لها بالنزاع).
 */
export function sourceRelevanceGate(results: LegalCoreResult[]): LegalCoreResult[] {
  return results.filter(
    (r) =>
      r.relevanceScore >= RELEVANCE_FLOOR &&
      ((r.conceptCoverage ?? 0) >= 0.2 || (r.phraseMatches ?? 0) > 0 || (r.matchedTerms?.length ?? 0) >= 2)
  );
}

/** قياس نوعية الاستعلام: عدد الكلمات الدالّة بعد التطبيع. */
function querySpecificity(query: string): number {
  return normalizeArabic(query).split(/\s+/).filter((w) => w.length >= 3).length;
}

/**
 * يسترجع مصادر مُسنَدة من النواة لاستعلام معيّن، مع حارس منع الهلوسة وبوابة الصلة.
 * لا يسترجع شيئاً لاستعلام عام (تحية/كلام غير محدد)، ولا fallback عشوائي.
 * لا يفشل التطبيق إذا تعذّر الاسترجاع (قاعدة غير مفعّلة) — يعيد «لا مصادر».
 */
export async function groundQuery(
  query: string,
  options: { strength?: SearchStrength; systemHint?: string; requireConceptCoverage?: boolean } = {}
): Promise<GroundingResult> {
  const strength = options.strength ?? "BALANCED";

  // بوابة نوعية الاستعلام: لا استرجاع قبل وجود مسألة كافية.
  if (querySpecificity(query) < MIN_QUERY_WORDS) {
    return { sources: [], hasSources: false, note: UNSPECIFIC_QUERY_NOTE, rawResults: [] };
  }

  try {
    const results = await findRelevantLegalArticles(query, {
      limit: limitForStrength(strength),
      requireConceptCoverage: true, // اشتراط تغطية مفاهيمية (منع المواد العامة)
      semantic: strength === "DEEP" || strength === "JUDICIAL_EXTENDED",
    });
    // SourceRelevanceGate: استبعد كل ما هو غير مرتبط ومبرَّر.
    const relevant = sourceRelevanceGate(results);
    const sources = relevant.map(toGroundedSource);
    return {
      sources,
      hasSources: sources.length > 0,
      note: sources.length > 0 ? ANTI_HALLUCINATION_NOTE : NO_SOURCE_NOTE,
      rawResults: relevant,
    };
  } catch {
    return { sources: [], hasSources: false, note: NO_SOURCE_NOTE, rawResults: [] };
  }
}

/**
 * حارس منع الهلوسة: يفحص نصّاً مولّداً ويزيل/يعلّم أي ادعاء بأرقام مواد لا تقابلها
 * مصادر متحقَّقة. يُعيد النص مع قائمة تحذيرات.
 */
export function guardGeneratedText(
  text: string,
  groundedReferences: GroundedSource[]
): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  // التقط أنماط «المادة (رقم)» أو «المادة رقم» في النص المولّد.
  const articleMentions = Array.from(text.matchAll(/الماد[ةه]\s*\(?\s*(\d+)\s*\)?/g)).map((m) => m[1]);
  if (articleMentions.length === 0) return { text, warnings };

  const groundedNumbers = new Set(
    groundedReferences
      .map((s) => s.reference.match(/\((\d+)\)/)?.[1] ?? s.reference.match(/الماد[ةه]\s*\(?\s*(\d+)/)?.[1])
      .filter(Boolean) as string[]
  );

  const unverified = Array.from(new Set(articleMentions)).filter((n) => !groundedNumbers.has(n));
  if (unverified.length > 0) {
    warnings.push(
      `وردت إشارة إلى مواد (${unverified.join("، ")}) دون مصدر متحقَّق في النواة — عُومِلت كإشارة احتمالية تحتاج تحققاً، ولم تُعتمد كإسناد قاطع.`
    );
  }
  return { text, warnings };
}
