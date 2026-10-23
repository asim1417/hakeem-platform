/**
 * اختبار مسار المتجهات المفهرس: مع الفهرسين الجزئيين يُستعلَم كل نوع عبر فهرسه (لا مسح للجدول كله)،
 * وبدونهما يبقى المسار القديم كما هو. قاعدة وهمية مكان prisma وfetch وهمي للتضمين (لا اتصال بأي خدمة).
 * التشغيل: npx tsx scripts/test-vector-partial.ts
 */
import { createRequire } from "node:module";

const req = createRequire(__filename);
const serverOnly = req.resolve("server-only");
req.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as unknown as NodeJS.Module;

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

process.env.SEMANTIC_SEARCH = "on";
process.env.EMBEDDING_API_KEY = "test-key";
globalThis.fetch = (async () =>
  new Response(JSON.stringify({ data: [{ embedding: Array.from({ length: 4 }, (_, i) => i / 10) }] }), { status: 200 })) as typeof fetch;

let partialPresent = true;
const sqlLog: string[] = [];
const fakePrisma = {
  embedding: { findFirst: async () => ({ id: "e1" }), count: async () => { throw new Error("count must not be called"); } },
  legalArticle: { findUnique: async ({ where }: { where: { id: string } }) => ({ lawName: "نظام الاختبار", articleNumber: 1, title: where.id }) },
  judicialCase: { findUnique: async () => ({ caseNo: "1", decisionNo: "2", court: "محكمة" }) },
  judicialPrinciple: { findUnique: async () => ({ title: "مبدأ" }) },
  async $queryRawUnsafe(sql: string) {
    sqlLog.push(sql);
    if (sql.includes("FROM pg_indexes")) return [{ n: partialPresent ? 2 : 0 }];
    if (sql.includes('FROM "ruling_segment_embeddings" LIMIT 1')) return [{ ok: true }];
    if (sql.includes('FROM "ruling_segment_embeddings" ORDER BY')) return [{ ruling_id: "r-seg", part: "reasons", start_char: 0, sim: 0.7 }];
    if (sql.includes("owner_type = 'article'")) return [{ owner_type: "article", owner_id: "a1", score: 0.9 }, { owner_type: "article", owner_id: "a-low", score: 0.3 }];
    if (sql.includes("owner_type = 'principle'")) return [{ owner_type: "principle", owner_id: "p1", score: 0.8 }];
    if (sql.includes("orphans")) return [{ owner_type: "ruling", owner_id: "r-orphan", score: 0.75 }];
    if (sql.includes("FROM embedding_version") && sql.includes("rn = 1") && !sql.includes("UNION ALL")) return [];
    if (sql.includes("UNION ALL")) return [{ owner_type: "article", owner_id: "a-scan", score: 0.95 }];
    return [];
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

async function main() {
  const mod = await import("../lib/modules/legal-search/providers/vector-provider");
  const { vectorProvider, partialTypeSql, rulingsSql, versionsSql } = mod;

  // ① شرط النوع حرفيّ (يطابق شرط الفهرس الجزئي) ومعامل المتجه $1.
  const art = partialTypeSql("article", 20);
  ok(art.includes("e.owner_type = 'article'") && art.includes("$1::vector") && art.includes("LIMIT 20"), "استعلام المادة يطابق شرط الفهرس الجزئي");
  ok(!art.includes("UNION") && !art.includes("row_number"), "استعلام المادة بلا UNION ولا نافذة (فيستعمل الفهرس)");
  ok(!rulingsSql(false, 20).includes("orphans"), "بلا متجهات أجزاء: الأحكام من الفهرس العام");
  ok(versionsSql(true, 5).includes("owner_type <> 'ruling'") && !versionsSql(false, 5).includes("owner_type <> 'ruling'"), "مع متجهات الأجزاء: لا نسخ متجهات قديمة للأحكام");

  // ② المسار المفهرس.
  const res = await vectorProvider.search({ q: "فسخ عقد العمل", limit: 10 });
  const ids = res.map((r) => r.id);
  ok(!sqlLog.some((s) => s.includes("UNION ALL")), "المسار المفهرس لا يستدعي المسح القديم");
  ok(["a1", "p1", "r-seg"].every((id) => ids.includes(id)), "يدمج المواد والمبادئ ومتجهات أجزاء الأحكام");
  // HKM-043: متجه الحكم القديم من النص الخام (وفيه الأسماء) لا يُقرأ مع متجهات الأجزاء، ولو لحكم بلا أجزاء.
  ok(!ids.includes("r-orphan") && !sqlLog.some((s) => s.includes("orphans")), "مع متجهات الأجزاء: لا متجه حكم قديمًا (خامًا)");
  ok(!ids.includes("a-low"), "عتبة التشابه الدنيا محفوظة");
  ok(ids[0] === "a1" && res.every((r, i) => i === 0 || r.score <= res[i - 1].score), "الترتيب تنازلي بالتشابه");

  // ③ قبل تطبيق الترحيل: المسار القديم كما هو.
  partialPresent = false;
  mod.resetPartialIndexCheck();
  sqlLog.length = 0;
  const res2 = await vectorProvider.search({ q: "فسخ عقد العمل", limit: 10 });
  ok(sqlLog.some((s) => s.includes("UNION ALL")) && res2.some((r) => r.id === "a-scan"), "بلا الفهرسين: المسار القديم دون تغيير");

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل الاختبارات ناجحة");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
