/**
 * eval-search.ts — مقياس جودة الاسترجاع (Phase 1، البوّابة ٨ في تشخيص الاسترجاع).
 *
 * يحوّل ضبط الترتيب من حدس إلى هندسة: يشغّل مجموعة استعلامات ذهبية عبر searchLegalCore
 * ويقيس آلياً جودة الترتيب على مستوى النظام (الانحياز/التغطية المُثار في التشخيص):
 *   - P@1 / P@3 / P@5  : نسبة نتائج أعلى-k الواردة من نظام متوقّع.
 *   - MRR               : مقلوب رتبة أول نتيجة من نظام متوقّع (جودة التصدّر).
 *   - systemHit@5       : هل ظهر أيّ نظام متوقّع ضمن أعلى 5؟ (تغطية/استدعاء).
 *   - nDCG@5            : ربح متدرّج بالرتبة (مكسب ثنائي: 1 إن وردت من نظام متوقّع).
 *
 * المطابقة على مستوى النظام (لا أرقام مواد مُختلقة): نتيجة «صحيحة» إن احتوى اسم نظامها
 * أيّاً من الأنظمة المتوقّعة (تطبيع عربي + احتواء) — نفس منطق concept-map.systemMatchesPreferred.
 * عند توفّر expectedArticleNumbers في الاستعلام الذهبي، يُقاس إضافةً P@k على مستوى المادة.
 *
 * قراءة فقط. لا كتابة. سقوط آمن: استعلام يفشل (لا اتصال) يُعلَّم errored ولا يكسر البقية.
 *
 * التشغيل:  npm run eval:search            (تقرير)
 *           npm run eval:search -- --gate  (بوّابة: يفشل إن نزل systemHit@3 عن العتبة)
 *           متغيّرات: EVAL_GOLDEN=path  EVAL_LIMIT=10  EVAL_MIN_SYSTEMHIT3=0.6
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";

type GoldenQuery = {
  id: string;
  query: string;
  domain?: string;
  expectedSystems: string[];
  expectedArticleNumbers?: number[];
};

type GoldenSet = { version?: number; queries: GoldenQuery[] };

type QueryMetrics = {
  id: string;
  query: string;
  domain?: string;
  errored: boolean;
  total: number;
  firstRelevantRank: number | null; // 1-based، أو null إن لم تظهر
  pAt: Record<number, number>; // P@k على مستوى النظام
  systemHitAt: Record<number, boolean>;
  ndcgAt5: number;
  articlePAt3: number | null; // عند توفّر expectedArticleNumbers فقط
  topSystems: string[]; // أنظمة أعلى 3 نتائج (لتشخيص الانحياز عند الفشل)
};

const K_VALUES = [1, 3, 5] as const;

/** هل يطابق اسمُ النظام (مُطبَّعاً) أيّاً من الأنظمة المتوقّعة؟ (احتواء في الاتجاهين). */
function systemIsExpected(systemName: string, expected: string[]): boolean {
  const ns = normalizeArabicText(systemName || "");
  if (!ns) return false;
  return expected.some((e) => {
    const ne = normalizeArabicText(e);
    return ne.length > 0 && (ns.includes(ne) || ne.includes(ns));
  });
}

function dcg(relevances: number[]): number {
  return relevances.reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);
}

function ndcgAtK(relevances: number[], k: number): number {
  const top = relevances.slice(0, k);
  const ideal = [...relevances].sort((a, b) => b - a).slice(0, k);
  const idcg = dcg(ideal);
  return idcg > 0 ? dcg(top) / idcg : 0;
}

async function evaluateQuery(g: GoldenQuery, limit: number): Promise<QueryMetrics> {
  const base: QueryMetrics = {
    id: g.id,
    query: g.query,
    domain: g.domain,
    errored: false,
    total: 0,
    firstRelevantRank: null,
    pAt: {},
    systemHitAt: {},
    ndcgAt5: 0,
    articlePAt3: null,
    topSystems: [],
  };

  let results: Awaited<ReturnType<typeof searchLegalCore>>["results"];
  try {
    const response = await searchLegalCore({
      query: g.query,
      searchType: "contains",
      page: 1,
      limit,
      includeSnippets: false,
      includeMatchedParagraphs: false,
      includeRelatedTerms: false,
      semantic: true,
    });
    results = response.results;
    base.total = response.total;
  } catch (error) {
    base.errored = true;
    base.topSystems = [error instanceof Error ? error.message.slice(0, 60) : "خطأ"];
    return base;
  }

  const rels: number[] = results.map((r) => (systemIsExpected(r.systemName, g.expectedSystems) ? 1 : 0));
  base.topSystems = results.slice(0, 3).map((r) => r.systemName);

  const firstIdx = rels.findIndex((x) => x === 1);
  base.firstRelevantRank = firstIdx >= 0 ? firstIdx + 1 : null;

  for (const k of K_VALUES) {
    const win = rels.slice(0, k);
    const hits = win.reduce((a, b) => a + b, 0);
    base.pAt[k] = win.length ? hits / k : 0; // P@k مقسوم على k (لا على المتاح) — يعاقب نقص النتائج
    base.systemHitAt[k] = hits > 0;
  }
  base.ndcgAt5 = ndcgAtK(rels, 5);

  if (g.expectedArticleNumbers && g.expectedArticleNumbers.length) {
    const expectedNums = new Set(g.expectedArticleNumbers);
    const top3 = results.slice(0, 3);
    const articleHits = top3.filter((r) => expectedNums.has(r.articleNumber)).length;
    base.articlePAt3 = top3.length ? articleHits / 3 : 0;
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

  console.log("═".repeat(78));
  console.log(`مقياس جودة الاسترجاع — eval:search   |   ${queries.length} استعلاماً ذهبياً   |   limit=${limit}`);
  console.log(`المصدر: ${goldenPath}`);
  console.log("═".repeat(78));

  const metrics: QueryMetrics[] = [];
  for (const g of queries) {
    // تسلسلي عمداً: ضغط منخفض على القاعدة، وترتيب ثابت للتقرير.
    metrics.push(await evaluateQuery(g, limit));
  }

  const ok = metrics.filter((m) => !m.errored);
  const errored = metrics.filter((m) => m.errored);

  if (!ok.length) {
    console.error("\n✗ كل الاستعلامات فشلت — غالباً لا اتصال بقاعدة البيانات.");
    console.error("  شغّل عبر workflow «Eval Search (read-only)» مع NEON_DATABASE_URL، أو اضبط DATABASE_URL محلياً.");
    if (errored[0]) console.error(`  أول خطأ: ${errored[0].topSystems[0]}`);
    process.exit(2);
  }

  // ── جدول لكل استعلام ──
  console.log("\nالنتائج لكل استعلام (✓ = ظهر نظام متوقّع ضمن أعلى 5):\n");
  console.log(
    ["النتيجة", "الرتبة₁", "P@3", "nDCG@5", "المعرّف", "أعلى نظام ظاهر"].join("\t")
  );
  console.log("─".repeat(78));
  for (const m of metrics) {
    if (m.errored) {
      console.log(["⚠ خطأ", "—", "—", "—", m.id, m.topSystems[0] ?? ""].join("\t"));
      continue;
    }
    const mark = m.systemHitAt[5] ? "✓" : "✗";
    console.log(
      [
        mark,
        m.firstRelevantRank ?? "—",
        pct(m.pAt[3] ?? 0),
        (m.ndcgAt5 ?? 0).toFixed(3),
        m.id,
        m.topSystems[0] ?? "—",
      ].join("\t")
    );
  }

  // ── المتوسّطات ──
  const agg = {
    pAt1: mean(ok.map((m) => m.pAt[1] ?? 0)),
    pAt3: mean(ok.map((m) => m.pAt[3] ?? 0)),
    pAt5: mean(ok.map((m) => m.pAt[5] ?? 0)),
    mrr: mean(ok.map((m) => (m.firstRelevantRank ? 1 / m.firstRelevantRank : 0))),
    systemHit3: mean(ok.map((m) => (m.systemHitAt[3] ? 1 : 0))),
    systemHit5: mean(ok.map((m) => (m.systemHitAt[5] ? 1 : 0))),
    ndcg5: mean(ok.map((m) => m.ndcgAt5 ?? 0)),
  };

  console.log("\n" + "═".repeat(78));
  console.log("المتوسّطات (على مستوى النظام):");
  console.log(`  P@1         = ${pct(agg.pAt1)}`);
  console.log(`  P@3         = ${pct(agg.pAt3)}`);
  console.log(`  P@5         = ${pct(agg.pAt5)}`);
  console.log(`  MRR         = ${agg.mrr.toFixed(3)}`);
  console.log(`  systemHit@3 = ${pct(agg.systemHit3)}   (التغطية: ظهر النظام المتوقّع ضمن أعلى 3)`);
  console.log(`  systemHit@5 = ${pct(agg.systemHit5)}`);
  console.log(`  nDCG@5      = ${agg.ndcg5.toFixed(3)}`);
  if (errored.length) console.log(`  ⚠ استعلامات فشلت (لا اتصال؟): ${errored.length}`);

  // ── الإخفاقات للتشخيص ──
  const failures = ok.filter((m) => !m.systemHitAt[5]);
  if (failures.length) {
    console.log("\n" + "─".repeat(78));
    console.log(`إخفاقات التغطية (${failures.length}) — النظام المتوقّع لم يظهر ضمن أعلى 5:`);
    for (const f of failures) {
      console.log(`  ✗ ${f.id} — «${f.query}»`);
      console.log(`      ظهر بدلاً منه: ${f.topSystems.filter(Boolean).join(" · ") || "(لا نتائج)"}`);
    }
  }
  console.log("═".repeat(78));

  if (gate) {
    if (agg.systemHit3 < minSystemHit3) {
      console.error(`\n✗ بوّابة فاشلة: systemHit@3 = ${pct(agg.systemHit3)} < العتبة ${pct(minSystemHit3)}`);
      process.exit(1);
    }
    console.log(`\n✓ بوّابة ناجحة: systemHit@3 = ${pct(agg.systemHit3)} ≥ ${pct(minSystemHit3)}`);
  }
}

main().catch((error) => {
  console.error("✗ خطأ غير متوقّع في eval-search:", error instanceof Error ? error.message : error);
  process.exit(2);
});
