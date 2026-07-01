/**
 * eval-search.ts — مقياس جودة الاسترجاع (Phase 1، البوّابة ٨ في تشخيص الاسترجاع).
 *
 * يحوّل ضبط الترتيب من حدس إلى هندسة. يقيس عبر searchLegalCore بُعدين:
 *
 * ① جودة الترتيب (Relevance) — على مستوى النظام (وعلى مستوى المادة عند توفّر أرقام متوقّعة):
 *    P@1/P@3/P@5 · MRR · MAP · systemHit@k (التغطية) · systemRecall@10 · nDCG@5.
 * ② اكتمال الاسترجاع (Completeness) — هل يُخرِج المحرّك **كامل النتائج** (لو ألف نتيجة)؟
 *    trueTotal (الإجماليّ الحقيقي) · exhaustive (رُتِّبت كل المطابقات؟) ·
 *    deepPageOk (هل يعمل الترقيم العميق حتى آخر صفحة؟).
 *
 * المطابقة على مستوى النظام: تطبيع عربي + احتواء (نفس systemMatchesPreferred). لا أرقام مواد مُختلقة.
 * قراءة فقط. سقوط آمن: استعلام يفشل (لا اتصال) يُعلَّم ولا يكسر البقية.
 *
 * التشغيل:  npm run eval:search            (تقرير)
 *           npm run eval:search -- --gate  (بوّابة: يفشل دون عتبات الجودة/الاكتمال)
 *           متغيّرات: EVAL_GOLDEN=path  EVAL_LIMIT=10  EVAL_MIN_SYSTEMHIT3=0.6  EVAL_MIN_EXHAUSTIVE=0.95
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";

// المزوّد المُقاس: "core" (searchLegalCore، الافتراضي) أو "hybrid" (hybridSearch عبر RRF).
const PROVIDER = (process.env.EVAL_PROVIDER || "core").toLowerCase();

type GoldenQuery = {
  id: string;
  query: string;
  domain?: string;
  expectedSystems: string[];
  expectedArticleNumbers?: number[]; // أرقام المواد المتوقّعة داخل النظام المتوقّع (مطابقة مقيَّدة بالنظام)
  outOfConceptMap?: boolean; // استعلام خارج خريطة المفاهيم (يكسر الدائرية، يقيس التعميم)
  articleLevelOnly?: boolean; // استعلام مُوجَّه لمادة بعينها (قياس مستوى المادة فقط) — يُستثنى من متوسّطات مستوى النظام لإبقائها مُقارَنة
};

type GoldenSet = { version?: number; queries: GoldenQuery[] };

type QueryMetrics = {
  id: string;
  query: string;
  domain?: string;
  outOfConceptMap: boolean;
  articleLevelOnly: boolean;
  hasArticleGold: boolean;
  errored: boolean;
  // الترتيب
  firstRelevantRank: number | null;
  pAt: Record<number, number>;
  systemHitAt: Record<number, boolean>;
  systemRecallAt10: number;
  ndcgAt5: number;
  ap: number; // average precision (للـ MAP)
  articleRank: number | null; // رتبة أول مادة متوقّعة (عند توفّر أرقام)
  // الاكتمال
  trueTotal: number;
  exhaustive: boolean;
  deepPageOk: boolean | null; // null إذا total ≤ limit (لا صفحة عميقة)
  topSystems: string[];
};

const K_VALUES = [1, 3, 5] as const;

function systemIsExpected(systemName: string, expected: string[]): boolean {
  const ns = normalizeArabicText(systemName || "");
  if (!ns) return false;
  return expected.some((e) => {
    const ne = normalizeArabicText(e);
    return ne.length > 0 && (ns.includes(ne) || ne.includes(ns));
  });
}

function dcg(rels: number[]): number {
  return rels.reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);
}
function ndcgAtK(rels: number[], k: number): number {
  const top = rels.slice(0, k);
  const ideal = [...rels].sort((a, b) => b - a).slice(0, k);
  const idcg = dcg(ideal);
  return idcg > 0 ? dcg(top) / idcg : 0;
}
/** Average Precision: متوسّط الدقّة عند كل نتيجة صحيحة (أساس MAP). */
function averagePrecision(rels: number[]): number {
  let hits = 0;
  let sum = 0;
  for (let i = 0; i < rels.length; i += 1) {
    if (rels[i] === 1) {
      hits += 1;
      sum += hits / (i + 1);
    }
  }
  return hits > 0 ? sum / hits : 0;
}

/** يملأ مقاييس الترتيب (P@k/MRR/nDCG/AP/recall/مادة) من قائمة نتائج (نظام + رقم مادة). مشترك بين المزوّدين. */
function fillRanking(base: QueryMetrics, rows: Array<{ systemName: string; articleNumber: number }>, g: GoldenQuery): void {
  const rels: number[] = rows.map((r) => (systemIsExpected(r.systemName, g.expectedSystems) ? 1 : 0));
  base.topSystems = rows.slice(0, 3).map((r) => r.systemName);
  const firstIdx = rels.findIndex((x) => x === 1);
  base.firstRelevantRank = firstIdx >= 0 ? firstIdx + 1 : null;
  for (const k of K_VALUES) {
    const win = rels.slice(0, k);
    const hits = win.reduce((a, b) => a + b, 0);
    base.pAt[k] = win.length ? hits / k : 0;
    base.systemHitAt[k] = hits > 0;
  }
  base.ndcgAt5 = ndcgAtK(rels, 5);
  base.ap = averagePrecision(rels.slice(0, 10));
  const top10 = rows.slice(0, 10).map((r) => r.systemName);
  const distinctHit = g.expectedSystems.filter((e) => top10.some((s) => systemIsExpected(s, [e]))).length;
  base.systemRecallAt10 = g.expectedSystems.length ? distinctHit / g.expectedSystems.length : 0;
  if (g.expectedArticleNumbers && g.expectedArticleNumbers.length) {
    // مطابقة مقيَّدة بالنظام: المادة رقم N صحيحة فقط داخل النظام المتوقّع (رقم المادة بلا نظام بلا معنى).
    const expected = new Set(g.expectedArticleNumbers);
    const idx = rows.findIndex((r) => expected.has(r.articleNumber) && systemIsExpected(r.systemName, g.expectedSystems));
    base.articleRank = idx >= 0 ? idx + 1 : null;
  }
}

function newMetrics(g: GoldenQuery): QueryMetrics {
  return {
    id: g.id,
    query: g.query,
    domain: g.domain,
    outOfConceptMap: Boolean(g.outOfConceptMap),
    articleLevelOnly: Boolean(g.articleLevelOnly),
    hasArticleGold: Boolean(g.expectedArticleNumbers && g.expectedArticleNumbers.length),
    errored: false,
    firstRelevantRank: null,
    pAt: {},
    systemHitAt: {},
    systemRecallAt10: 0,
    ndcgAt5: 0,
    ap: 0,
    articleRank: null,
    trueTotal: 0,
    exhaustive: false,
    deepPageOk: null,
    topSystems: [],
  };
}

/** تقييم عبر المسار الهجين (hybridSearch/RRF). سطح مختلف (سقف 30) — الاكتمال لا يُقاس هنا. */
async function evaluateQueryHybrid(g: GoldenQuery, limit: number): Promise<QueryMetrics> {
  const base = newMetrics(g);
  try {
    const response = await hybridSearch({ q: g.query, limit: Math.max(limit, 10) });
    base.trueTotal = response.total;
    base.exhaustive = true; // غير منطبق على الهجين — نحيّده كي لا يُسقط البوّابة
    const sysName = (r: (typeof response.results)[number]): string => {
      const s = r.meta?.systemName;
      return typeof s === "string" && s ? s : r.title;
    };
    const artNo = (r: (typeof response.results)[number]): number => {
      const n = r.meta?.articleNumber;
      return typeof n === "number" ? n : -1;
    };
    fillRanking(base, response.results.map((r) => ({ systemName: sysName(r), articleNumber: artNo(r) })), g);
  } catch (error) {
    base.errored = true;
    base.topSystems = [error instanceof Error ? error.message.slice(0, 60) : "خطأ"];
  }
  return base;
}

async function evaluateQuery(g: GoldenQuery, limit: number): Promise<QueryMetrics> {
  const base = newMetrics(g);

  let response: Awaited<ReturnType<typeof searchLegalCore>>;
  try {
    response = await searchLegalCore({
      query: g.query,
      searchType: "contains",
      page: 1,
      limit,
      includeSnippets: false,
      includeMatchedParagraphs: false,
      includeRelatedTerms: false,
      semantic: true,
    });
  } catch (error) {
    base.errored = true;
    base.topSystems = [error instanceof Error ? error.message.slice(0, 60) : "خطأ"];
    return base;
  }

  const results = response.results;
  base.trueTotal = response.total;
  base.exhaustive = response.exhaustive !== false;

  fillRanking(base, results.map((r) => ({ systemName: r.systemName, articleNumber: r.articleNumber })), g);

  // اكتمال الاسترجاع: هل يعمل الترقيم العميق حتى آخر صفحة؟ (إثبات «كامل النتائج»).
  if (base.exhaustive && response.total > limit) {
    const lastPage = Math.ceil(response.total / limit);
    try {
      const deep = await searchLegalCore({
        query: g.query,
        searchType: "contains",
        page: lastPage,
        limit,
        includeSnippets: false,
        includeMatchedParagraphs: false,
        includeRelatedTerms: false,
        semantic: true, // نفس إعداد الاستدعاء الأصلي ليطابق الإجماليّ (وإلا اختلف عدد النتائج)
      });
      base.deepPageOk = deep.results.length > 0;
    } catch {
      base.deepPageOk = false;
    }
  }

  return base;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

async function main() {
  const goldenPath = resolve(process.env.EVAL_GOLDEN || "data/eval/golden-queries.json");
  const limit = Number(process.env.EVAL_LIMIT || 10);
  const gate = process.argv.includes("--gate");
  const minSystemHit3 = Number(process.env.EVAL_MIN_SYSTEMHIT3 || 0.6);
  const minExhaustive = Number(process.env.EVAL_MIN_EXHAUSTIVE || 0.95);

  let golden: GoldenSet;
  try {
    golden = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenSet;
  } catch (error) {
    console.error(`✗ تعذّر قراءة المجموعة الذهبية: ${goldenPath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }

  const queries = (golden.queries || []).filter((q) => q.query && q.expectedSystems?.length);
  if (!queries.length) {
    console.error("✗ المجموعة الذهبية فارغة أو غير صالحة.");
    process.exit(2);
  }

  const systemQ = queries.filter((q) => !q.articleLevelOnly);
  const inMap = systemQ.filter((q) => !q.outOfConceptMap).length;
  const artOnly = queries.length - systemQ.length;
  console.log("═".repeat(82));
  console.log(`مقياس جودة الاسترجاع — eval:search   |   المزوّد: ${PROVIDER}   |   ${systemQ.length} استعلام نظام (${inMap} داخل الخريطة · ${systemQ.length - inMap} خارجها)${artOnly ? ` + ${artOnly} مستوى مادة` : ""}   |   limit=${limit}`);
  console.log(`المصدر: ${goldenPath}`);
  console.log("═".repeat(82));

  const metrics: QueryMetrics[] = [];
  const evaluate = PROVIDER === "hybrid" ? evaluateQueryHybrid : evaluateQuery;
  for (const g of queries) metrics.push(await evaluate(g, limit));

  const ok = metrics.filter((m) => !m.errored);
  const errored = metrics.filter((m) => m.errored);

  if (!ok.length) {
    console.error("\n✗ كل الاستعلامات فشلت — غالباً لا اتصال بقاعدة البيانات.");
    console.error("  شغّل عبر workflow «Eval Search (read-only)» مع NEON_DATABASE_URL، أو اضبط DATABASE_URL محلياً.");
    if (errored[0]) console.error(`  أول خطأ: ${errored[0].topSystems[0]}`);
    process.exit(2);
  }

  // ── جدول لكل استعلام ──
  console.log("\nالنتائج لكل استعلام (✓ = نظام متوقّع ضمن أعلى 5 · «إجمالي» = كل المطابقات · «عميق» = ترقيم آخر صفحة):\n");
  console.log(["نتيجة", "رتبة₁", "P@3", "nDCG", "إجمالي", "كامل؟", "عميق؟", "المعرّف", "أعلى نظام"].join("\t"));
  console.log("─".repeat(82));
  for (const m of metrics) {
    if (m.errored) {
      console.log(["⚠", "—", "—", "—", "—", "—", "—", m.id, m.topSystems[0] ?? ""].join("\t"));
      continue;
    }
    const deep = m.deepPageOk === null ? "—" : m.deepPageOk ? "✓" : "✗";
    console.log(
      [
        m.systemHitAt[5] ? "✓" : "✗",
        m.firstRelevantRank ?? "—",
        pct(m.pAt[3] ?? 0),
        (m.ndcgAt5 ?? 0).toFixed(2),
        m.trueTotal,
        m.exhaustive ? "✓" : "جزئي",
        deep,
        m.id,
        (m.topSystems[0] ?? "—").slice(0, 28),
      ].join("\t")
    );
  }

  // ── المتوسّطات ──
  // مستوى النظام: نستثني استعلامات «مستوى المادة فقط» كي تبقى الأرقام الرئيسة مُقارَنة بالإصدارات السابقة.
  const okSystem = ok.filter((m) => !m.articleLevelOnly);
  const outMap = okSystem.filter((m) => m.outOfConceptMap);
  const agg = {
    pAt1: mean(okSystem.map((m) => m.pAt[1] ?? 0)),
    pAt3: mean(okSystem.map((m) => m.pAt[3] ?? 0)),
    pAt5: mean(okSystem.map((m) => m.pAt[5] ?? 0)),
    mrr: mean(okSystem.map((m) => (m.firstRelevantRank ? 1 / m.firstRelevantRank : 0))),
    map: mean(okSystem.map((m) => m.ap)),
    systemHit3: mean(okSystem.map((m) => (m.systemHitAt[3] ? 1 : 0))),
    systemHit5: mean(okSystem.map((m) => (m.systemHitAt[5] ? 1 : 0))),
    recall10: mean(okSystem.map((m) => m.systemRecallAt10)),
    ndcg5: mean(okSystem.map((m) => m.ndcgAt5)),
    // التعميم: نفس المقياس على الاستعلامات خارج خريطة المفاهيم (يكسر الدائرية).
    outMrr: mean(outMap.map((m) => (m.firstRelevantRank ? 1 / m.firstRelevantRank : 0))),
    outSystemHit3: mean(outMap.map((m) => (m.systemHitAt[3] ? 1 : 0))),
    // الاكتمال
    exhaustiveRate: mean(okSystem.map((m) => (m.exhaustive ? 1 : 0))),
    deepProbes: okSystem.filter((m) => m.deepPageOk !== null),
  };
  // مستوى المادة (معلومة معروفة): على الاستعلامات التي لها أرقام مواد متوقّعة (مطابقة مقيَّدة بالنظام).
  const okArticle = ok.filter((m) => m.hasArticleGold);
  const artHitAt = (k: number) => mean(okArticle.map((m) => (m.articleRank && m.articleRank <= k ? 1 : 0)));
  const articleAgg = okArticle.length
    ? {
        n: okArticle.length,
        hit1: artHitAt(1),
        hit3: artHitAt(3),
        hit5: artHitAt(5),
        mrr: mean(okArticle.map((m) => (m.articleRank ? 1 / m.articleRank : 0))),
      }
    : null;
  const deepOk = agg.deepProbes.length ? mean(agg.deepProbes.map((m) => (m.deepPageOk ? 1 : 0))) : 1;

  console.log("\n" + "═".repeat(82));
  console.log("① جودة الترتيب (Relevance):");
  console.log(`  P@1 = ${pct(agg.pAt1)}   P@3 = ${pct(agg.pAt3)}   P@5 = ${pct(agg.pAt5)}`);
  console.log(`  MRR = ${agg.mrr.toFixed(3)}   MAP = ${agg.map.toFixed(3)}   nDCG@5 = ${agg.ndcg5.toFixed(3)}`);
  console.log(`  systemHit@3 = ${pct(agg.systemHit3)}   systemHit@5 = ${pct(agg.systemHit5)}   systemRecall@10 = ${pct(agg.recall10)}`);
  if (outMap.length) {
    console.log(`  ↳ خارج خريطة المفاهيم (${outMap.length} استعلام، تعميم بلا دائرية): MRR = ${agg.outMrr.toFixed(3)} · systemHit@3 = ${pct(agg.outSystemHit3)}`);
  }
  console.log("② اكتمال الاسترجاع (Completeness — «كامل النتائج لو ألف نتيجة»):");
  console.log(`  exhaustive (رُتِّبت كل المطابقات) = ${pct(agg.exhaustiveRate)}`);
  console.log(`  deepPageOk (الترقيم العميق يعمل) = ${pct(deepOk)}   [${agg.deepProbes.length} استعلاماً تجاوز حجم الصفحة]`);
  const maxTotal = Math.max(0, ...okSystem.map((m) => m.trueTotal));
  console.log(`  أكبر إجماليّ نتائج لاستعلام = ${maxTotal.toLocaleString("en-US")} (كلها قابلة للاسترجاع بالترقيم)`);
  if (errored.length) console.log(`  ⚠ استعلامات فشلت (لا اتصال؟): ${errored.length}`);
  if (articleAgg) {
    console.log(`③ دقّة مستوى المادة (معلومة معروفة — ${articleAgg.n} استعلاماً بأرقام مواد متوقّعة، مطابقة مقيَّدة بالنظام):`);
    console.log(`  articleHit@1 = ${pct(articleAgg.hit1)}   articleHit@3 = ${pct(articleAgg.hit3)}   articleHit@5 = ${pct(articleAgg.hit5)}   articleMRR = ${articleAgg.mrr.toFixed(3)}`);
    const artMiss = okArticle.filter((m) => !m.articleRank || m.articleRank > 5);
    if (artMiss.length) {
      console.log(`  ↳ لم تظهر المادة المتوقّعة ضمن أعلى 5 (راجِع الوسم أو الترتيب): ${artMiss.map((m) => m.id).join(" · ")}`);
    }
  }

  // ── الإخفاقات (على مستوى النظام؛ نستثني استعلامات المادة فقط) ──
  const failures = okSystem.filter((m) => !m.systemHitAt[5]);
  if (failures.length) {
    console.log("\n" + "─".repeat(82));
    console.log(`إخفاقات التغطية (${failures.length}) — النظام المتوقّع لم يظهر ضمن أعلى 5:`);
    for (const f of failures) {
      console.log(`  ✗ ${f.id}${f.outOfConceptMap ? " [خارج الخريطة]" : ""} — «${f.query}»  (إجمالي ${f.trueTotal})`);
      console.log(`      ظهر بدلاً منه: ${f.topSystems.filter(Boolean).join(" · ") || "(لا نتائج)"}`);
    }
  }
  console.log("═".repeat(82));

  if (gate) {
    const fails: string[] = [];
    if (agg.systemHit3 < minSystemHit3) fails.push(`systemHit@3 = ${pct(agg.systemHit3)} < ${pct(minSystemHit3)}`);
    if (agg.exhaustiveRate < minExhaustive) fails.push(`exhaustive = ${pct(agg.exhaustiveRate)} < ${pct(minExhaustive)}`);
    if (deepOk < 1) fails.push(`deepPageOk = ${pct(deepOk)} < 100%`);
    if (fails.length) {
      console.error(`\n✗ بوّابة فاشلة:\n  - ${fails.join("\n  - ")}`);
      process.exit(1);
    }
    console.log(`\n✓ بوّابة ناجحة: الجودة والاكتمال فوق العتبات.`);
  }
}

main().catch((error) => {
  console.error("✗ خطأ غير متوقّع في eval-search:", error instanceof Error ? error.message : error);
  process.exit(2);
});
