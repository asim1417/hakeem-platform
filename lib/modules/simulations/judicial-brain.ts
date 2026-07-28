// العقل القضائيّ المشترك — مصدر الحقيقة الوحيد لتأريض القاضي وإبراز قواعد الإثبات وحارس
// المخرَج. يستدعيه القاضيان: الحيّ (عبر /api/original-hakeem/ai) والحديث (عبر ai-judge.ts).
// فكرةٌ واحدة بجلدين: أيّ تحسينٍ في التأريض/الإثبات هنا ينعكس على الواجهتين معًا.
import { buildLegalContextForAI, buildCitationBlock, searchLegalCore, type LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import { rerankArticles } from "@/lib/modules/agents/thinking/rerank";
import { articleStatusBadge } from "@/lib/modules/legal-core/article-status";
import { collectAllowedArticleNumbers, verifyNarrativeGrounding } from "@/lib/modules/grounding/verify-guard";

// مصطلحاتٌ تُبرز نظام الإثبات في الاسترجاع (عبء الإثبات · البيّنة · الشهادة · اليمين …).
export const EVIDENCE_HINTS =
  "قواعد الإثبات وعبء الإثبات والبيّنة والشهادة واليمين والقرينة وحجيّة المستند والإقرار في نظام الإثبات";

// ── الأنظمة الإجرائيّة الأربعة الحاكمة للمنازعات والدعاوى ──
// يستوعبها القاضي في إدارته وحكمه، وتُضاف إلى نطاق تأريضه بحسب نوع الدعوى.
export const PROCEDURAL_SYSTEMS = {
  evidence: "نظام الإثبات",
  civilProcedure: "نظام المرافعات الشرعية",
  criminalProcedure: "نظام الإجراءات الجزائية",
  commercialCourts: "نظام المحاكم التجارية"
} as const;

/**
 * الأنظمة الإجرائيّة الحاكمة للدعوى بحسب نوعها — تُضاف إلى نطاق التخصّص الموضوعيّ.
 * الإثبات والمرافعات الشرعيّة أساسٌ لكلّ دعوى؛ ثمّ الجزائيّ للدعاوى الجزائيّة، والمحاكم
 * التجاريّة لما عداها من المنازعات التجاريّة/المدنيّة. لا يُخلط الجزائيّ بالتجاريّ.
 */
export function proceduralScopeFor(caseType?: string): string[] {
  const t = (caseType ?? "").trim();
  const base: string[] = [PROCEDURAL_SYSTEMS.evidence, PROCEDURAL_SYSTEMS.civilProcedure];
  if (/جزائ|جناي|جنائ|عقوب|تعزير|حدود|قصاص|متّهم|متهم/.test(t)) base.push(PROCEDURAL_SYSTEMS.criminalProcedure);
  else base.push(PROCEDURAL_SYSTEMS.commercialCourts);
  return base;
}

// خلاصة الأنظمة الإجرائيّة الأربعة — مبادئُ منهجيّة لا أرقامَ موادّ (الأرقام تأتي من التأريض
// حصرًا حتى لا يقع اختلاق). تُحقن في موجِّه القاضي ليُطبّق النظام الإجرائيّ الصحيح لكلّ دعوى.
export const PROCEDURAL_DIGEST = [
  "== استيعاب الأنظمة الإجرائيّة الأربعة الحاكمة للدعوى ==",
  "① نظام الإثبات وأدلّته الإجرائيّة: الأصل أنّ البيّنة على من ادّعى واليمين على من أنكر. وسائل الإثبات: المحرّرات (الرسميّة والعرفيّة والإلكترونيّة/الرقميّة)، الشهادة، القرائن، العُرف، الإقرار، اليمين، المعاينة، الخبرة. لكلّ دليلٍ حجّيّتُه ومرتبتُه؛ والإقرار أمام المحكمة حجّةٌ قاطعة على المُقِرّ؛ واليمين الحاسمة والمتمّمة إجراءٌ عند عجز البيّنة.",
  "② نظام المرافعات الشرعيّة ولائحته: انعقاد الخصومة وصحّة إعلانها والمواعيد؛ يُبتّ في الدفوع الشكليّة (عدم الاختصاص، البطلان، عدم القبول) قبل الموضوع؛ لا يُقضى بما لم يُطلَب ولا بأكثر منه؛ الحكم يجب أن يكون مسبَّبًا؛ والقرارات الإجرائيّة (الإمهال، التأجيل، ندب الخبير، توجيه اليمين، قفل المرافعة) تُتّخذ في محلّها قبل الحكم لا في منطوقه.",
  "③ نظام الإجراءات الجزائيّة: مراحل الدعوى الجزائيّة (جمع الاستدلالات ← التحقيق ← المحاكمة)؛ الأصل براءة الذمّة والشكّ يُفسَّر لمصلحة المتّهم؛ مشروعيّة الدليل وبطلان الإجراء المخالِف؛ ويقتصر تطبيقه على الدعاوى الجزائيّة دون التجاريّة والمدنيّة.",
  "④ نظام المحاكم التجاريّة ولائحته: الاختصاص النوعيّ للدوائر التجاريّة؛ القيد والتهيئة وتبادل المذكّرات والمواعيد؛ وجوب تسبيب الأحكام التجاريّة.",
  "طبّق النظام الإجرائيّ المناسب لنوع الدعوى ولا تخلط الجزائيّ بالتجاريّ، واستشهد بأرقام المواد من «الأساس النظاميّ المتاح» فقط."
].join("\n");

// إشارةٌ أنّ النداء قضائيٌّ ذو وقائع (لتمييزه عن نداءات الاختبار القصيرة).
export const JUDICIAL_SIGNAL =
  /الوقائع|الطلب|الدعوى|الدفع|المدّع|المدع|الجواب|البيّن|البين|الإثبات|إثبات|الحكم|المرافعة/;

export type JudicialGrounding = {
  hasArticles: boolean;
  contextText: string;
  citationBlock: string;
  allowedNumbers: Set<number>;
  articleCount: number;
};

/**
 * يسترجع مواد النواة الحقيقيّة ذات الصلة (مع إبراز نظام الإثبات) ويجمع أرقام المواد المسموحة.
 * يُستعمَل لحقن السياق المؤرَّض في توجيه القاضي قبل التوليد.
 */
const EMPTY_GROUNDING: JudicialGrounding = {
  hasArticles: false,
  contextText: "",
  citationBlock: "",
  allowedNumbers: new Set<number>(),
  articleCount: 0
};

function toGrounding(top: LegalCoreResult[]): JudicialGrounding {
  const citationBlock = buildCitationBlock(top);
  return {
    hasArticles: true,
    contextText: [
      "السياق النظاميّ المسترجَع من النواة القانونيّة الموحّدة:",
      citationBlock,
      "قاعدة إلزاميّة: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد."
    ].join("\n"),
    citationBlock,
    allowedNumbers: collectAllowedArticleNumbers({ numbers: top.map((a) => a.articleNumber) }),
    articleCount: top.length
  };
}

/**
 * تأريض القاضي وفق فلسفة «اسأل حكيم» نفسها (فكرةٌ واحدة بجلدين):
 *  ① تقييدٌ صلبٌ بالنطاق عبر systemIds (لا تلميحًا نصّيًّا) — يمنع تسرّب أنظمةٍ غير ذات صلة.
 *  ② تغطية المفاهيم (requireConceptCoverage) وإبراز نظام الإثبات.
 *  ③ إسقاط المنسوخ ثمّ إعادة ترتيبٍ بالسلطة والحالة (rerankArticles) قبل أفضل limit.
 *  ④ سقوطٌ آمن: إن أفرغ التقييد الصلب النتائج ⇒ استرجاعٌ موسَّع، ثمّ المسار الأساسيّ — لا يُكسَر التأريض.
 */
export async function groundForJudge(text: string, limit = 6, scopeSystems?: string[]): Promise<JudicialGrounding> {
  const query = `${text} ${EVIDENCE_HINTS}`.slice(0, 900);
  const pool = Math.max(limit * 3, 18);

  let results: LegalCoreResult[] = [];
  try {
    const scoped = await searchLegalCore({
      query,
      systemIds: scopeSystems?.length ? scopeSystems : undefined,
      sourceTypes: ["article"],
      requireConceptCoverage: true,
      semantic: true,
      includeSnippets: true,
      limit: pool
    });
    results = scoped.results ?? [];
    // احتياطٌ: التقييد الصلب قد يُفرِغ النتائج إن ضاق النطاق ⇒ أعِد الاسترجاع موسَّعًا.
    if (results.length === 0 && scopeSystems?.length) {
      const wide = await searchLegalCore({ query, sourceTypes: ["article"], requireConceptCoverage: true, semantic: true, includeSnippets: true, limit: pool });
      results = wide.results ?? [];
    }
  } catch {
    results = [];
  }

  // سقوطٌ آمنٌ نهائيّ للمسار الأساسيّ عند تعذّر الاسترجاع المتقدّم.
  if (results.length === 0) {
    const ctx = await buildLegalContextForAI(query, { limit });
    if (!ctx.hasArticles) return EMPTY_GROUNDING;
    return {
      hasArticles: true,
      contextText: ctx.contextText,
      citationBlock: ctx.citationBlock,
      allowedNumbers: collectAllowedArticleNumbers({ numbers: ctx.articles.map((a) => a.articleNumber) }),
      articleCount: ctx.articles.length
    };
  }

  // إسقاط المنسوخ ما لم يُفقِر النتائج (شبكة أمان)، ثمّ إعادة ترتيبٍ بالسلطة والحالة.
  const inForce = results.filter((r) => articleStatusBadge(r.status)?.label !== "منسوخة");
  const pooled = inForce.length >= Math.min(limit, 3) ? inForce : results;
  const top = rerankArticles(pooled).slice(0, limit);
  return toGrounding(top);
}

/**
 * حارس التأريض بعد التوليد: يعيد true إن لم يظهر في النصوص أيّ رقم مادّة خارج المسموح.
 * مجموعةٌ فارغة ⇒ لا تأريض متاح ⇒ يُمرَّر (لا حجب كاذب).
 */
export function verifyJudgeGrounding(texts: Array<string | null | undefined>, allowed: Set<number>): boolean {
  if (allowed.size === 0) return true;
  return verifyNarrativeGrounding(texts, allowed).ok;
}
