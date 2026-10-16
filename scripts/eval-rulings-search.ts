/**
 * eval-rulings-search — مقارنة قراءة فقط بين المسار القديم (الهجين المشترك) والجديد (searchRulingsDirect)
 * على ٣٠ استعلامًا. يُخرج أعدادًا فقط (المستودع عام): عدد الأحكام، وموضع المقتطف، والزمن.
 * يرفض العمل ما لم تكن الجلسة للقراءة فقط.
 *   DATABASE_URL=… npx tsx scripts/eval-rulings-search.ts reports/rulings-search-eval.json
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { searchRulingsDirect } from "../lib/modules/legal-core/rulings-search";
import { hybridSearch } from "../lib/modules/legal-search/hybrid-search";

const QUERIES = [
  "فسخ", "الغبن", "الغبن الفاحش", "نجش", "تعويض", "إفلاس", "مدعي", "عقد", "شيك", "كمبيالة",
  "الشرط الجزائي", "القوة القاهرة", "حجية الأمر المقضي", "عدم الاختصاص", "التقادم", "الإيجار",
  "المقاولة", "الشراكة", "الوكالة", "الرهن", "الشفعة", "الوقف", "النفقة", "الحضانة", "أجرة المثل",
  "التعسف في استعمال الحق", "خيار العيب", "الإقالة", "الصلح", "اليمين الحاسمة",
];
const PREAMBLE = /^(?:…)?\s*(?:بسم\s*الله|الحمد\s*لله|الحمدلله|الحمد)/;

async function main() {
  const [ro] = await prisma.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
  if (ro?.transaction_read_only !== "on") {
    console.error("الجلسة ليست للقراءة فقط — أوقفتُ التشغيل.");
    process.exit(3);
  }
  interface Row {
    query: string;
    old: { rulingsInTop30: number; ms: number; preambleSnippets: number };
    new: { total: number; returned: number; ms: number; matchedIn: Record<string, number>; preambleSnippets: number; withDisposition: number; withYearH: number };
  }
  const rows: Row[] = [];
  for (const q of QUERIES) {
    const t0 = Date.now();
    const old = await hybridSearch({ q, limit: 30 }).catch(() => null);
    const oldMs = Date.now() - t0;
    const oldRulings = (old?.results ?? []).filter((r) => r.type === "ruling");
    const t1 = Date.now();
    const nu = await searchRulingsDirect({ query: q, limit: 10 }).catch((e) => ({ hits: [], total: -1, totalCapped: false, ms: 0, err: (e as Error).message }));
    const newMs = Date.now() - t1;
    const where: Record<string, number> = {};
    for (const h of nu.hits) where[h.matchedIn ?? "none"] = (where[h.matchedIn ?? "none"] ?? 0) + 1;
    rows.push({
      query: q,
      old: { rulingsInTop30: oldRulings.length, ms: oldMs, preambleSnippets: oldRulings.filter((r) => PREAMBLE.test((r.snippet ?? "").trim())).length },
      new: {
        total: nu.total, returned: nu.hits.length, ms: newMs, matchedIn: where,
        preambleSnippets: nu.hits.filter((h) => PREAMBLE.test(h.snippet.trim())).length,
        withDisposition: nu.hits.filter((h) => h.disposition).length,
        withYearH: nu.hits.filter((h) => h.hijriYear).length,
      },
    });
    console.log(`• ${q}`);
  }
  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  const summary = {
    queries: rows.length,
    old: { queriesWithRulings: rows.filter((r) => r.old.rulingsInTop30 > 0).length, preambleSnippets: sum((r) => r.old.preambleSnippets) },
    new: {
      queriesWithRulings: rows.filter((r) => r.new.returned > 0).length,
      preambleSnippets: sum((r) => r.new.preambleSnippets),
      snippetsFromReasonsOrDisposition: sum((r) => (r.new.matchedIn.reasons ?? 0) + (r.new.matchedIn.disposition ?? 0)),
      returned: sum((r) => r.new.returned),
      p95ms: rows.map((r) => r.new.ms).sort((a, b) => a - b)[Math.floor(rows.length * 0.95) - 1],
    },
  };
  writeFileSync(process.argv[2] ?? "reports/rulings-search-eval.json", JSON.stringify({ measuredAt: new Date().toISOString(), summary, rows }, null, 2));
  console.log(JSON.stringify(summary));
}

main()
  .catch((e) => {
    console.error("فشل:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
