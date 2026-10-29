/**
 * HKM-053: البحث المقيّد بنظام يُحصر داخل استعلام كل مصدر قبل الترتيب، وأداة إصدار المادة من بطاقة النظام.
 * الحالة: «التصفية» مع law_id نظام الإفلاس كانت ترجع صفرًا — أقرب المتجهات من أنظمة أخرى ثم تُصفّى،
 * وصفحة الحصر اللفظي (59 مادة) تُرفض لأنها فوق حد الندرة.
 * قاعدة وهمية مكان prisma وSqlClient، وfetch وهمي للتضمين (لا اتصال بأي خدمة).
 * التشغيل: npx tsx scripts/test-scoped-search.ts
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

const BANKRUPTCY = "cmpz5pmxa003lcwg2gvi5rlyr";
const OTHER = "law-other";

process.env.SEMANTIC_SEARCH = "on";
process.env.EMBEDDING_API_KEY = "test-key";
process.env.OPENSEARCH_URL = "http://opensearch.test";
let osFetches = 0;
globalThis.fetch = (async (url: string | URL) => {
  if (String(url).startsWith("http://opensearch.test")) {
    osFetches += 1;
    return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 });
  }
  return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] }), { status: 200 });
}) as typeof fetch;

const sqlLog: Array<{ sql: string; params: unknown[] }> = [];
const seedWheres: unknown[] = [];
const fakePrisma = {
  embedding: { findFirst: async () => ({ id: "e1" }) },
  legalArticle: {
    findUnique: async ({ where }: { where: { id: string } }) => ({ lawName: "نظام الإفلاس", articleNumber: 90, title: where.id }),
    findMany: async ({ where }: { where: unknown }) => {
      seedWheres.push(where);
      return [];
    },
    count: async () => 0,
  },
  legalRelation: { count: async () => 0 },
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    sqlLog.push({ sql, params });
    if (sql.includes("FROM pg_indexes")) return [{ n: 2 }];
    if (sql.includes('FROM "ruling_segment_embeddings" LIMIT 1')) return [];
    // المسار المحصور: مواد الإفلاس وحدها.
    if (sql.includes("WITH ids AS MATERIALIZED")) return [{ owner_type: "article", owner_id: "bk-90", score: 0.82 }, { owner_type: "article", owner_id: "bk-117", score: 0.8 }];
    // المسار العام: أقرب المدونة من نظام آخر (هذا ما كان يُفرغ النتيجة بعد التصفية).
    if (sql.includes("owner_type = 'article'")) return [{ owner_type: "article", owner_id: "other-1", score: 0.95 }];
    return [];
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

async function main() {
  const { scopedLawIds } = await import("../lib/modules/legal-search/providers/search-provider");
  const { lexicalPageUsable, RARE_TERM_MAX } = await import("../lib/mcp/search-fusion");
  const { vectorProvider, scopedArticlesSql } = await import("../lib/modules/legal-search/providers/vector-provider");
  const { knowledgeGraphProvider } = await import("../lib/modules/legal-search/providers/knowledge-graph-provider");
  const { opensearchProvider } = await import("../lib/modules/legal-search/providers/opensearch-provider");
  const { handleSemanticSearch } = await import("../lib/mcp/tools/semantic");
  const { resetCatalogCache } = await import("../lib/mcp/tools/catalog");
  const { articleIssuance, issuanceFromCard } = await import("../lib/mcp/tools/article-issuance");

  // ① الحصر: قائمة فارغة أو معرّفات فارغة = بلا حصر، والمكرر يُوحَّد.
  ok(scopedLawIds({}) === null && scopedLawIds({ lawIds: [] }) === null && scopedLawIds({ lawIds: [""] }) === null, "بلا أنظمة = بلا حصر");
  ok(JSON.stringify(scopedLawIds({ lawIds: [BANKRUPTCY, BANKRUPTCY] })) === JSON.stringify([BANKRUPTCY]), "المعرّف المكرر يُوحَّد");

  // ② الحصر اللفظي: «التصفية» في 59 مادة من الإفلاس — فوق حد الندرة على المدونة، مقبولة داخل النظام.
  ok(!lexicalPageUsable(59, false) && lexicalPageUsable(59, true), "صفحة 59 نتيجة: مرفوضة على المدونة ومقبولة داخل النظام");
  ok(lexicalPageUsable(RARE_TERM_MAX, false) && !lexicalPageUsable(0, true), "حد الندرة كما هو بلا حصر، والصفحة الخالية مرفوضة");

  // ③ المتجهات: الشرط داخل الاستعلام بمعامل $2، ولا يُسأل المسار العام عن المواد.
  const sql = scopedArticlesSql(20);
  ok(sql.includes(`"legalSystemId" = ANY($2::text[])`) && sql.includes("$1::vector") && sql.includes("LIMIT 20"), "استعلام المتجهات المحصور يشترط النظام داخله");
  ok(sql.includes("embedding_version") && sql.includes("pri"), "أحدث نسخة متجه تتقدم على الجدول العام في الحصر");
  sqlLog.length = 0;
  const res = await vectorProvider.search({ q: "التصفية", limit: 10, types: ["article"], lawIds: [BANKRUPTCY] });
  const scopedCall = sqlLog.find((c) => c.sql.includes("WITH ids AS MATERIALIZED"));
  ok(Boolean(scopedCall) && JSON.stringify(scopedCall?.params[1]) === JSON.stringify([BANKRUPTCY]), "المتجهات تُسأل محصورة بمعرّف نظام الإفلاس");
  ok(!sqlLog.some((c) => c.sql.includes("e.owner_type = 'article'") && !c.sql.includes("WITH ids AS MATERIALIZED")), "المسار العام للمواد لا يُسأل مع الحصر");
  ok(res.map((r) => r.id).join(",") === "bk-90,bk-117", "النتائج من النظام المحصور وحده (لا تُفرغها التصفية)");
  const unscoped = await vectorProvider.search({ q: "التصفية", limit: 10, types: ["article"] });
  ok(unscoped.map((r) => r.id).join(",") === "other-1", "بلا حصر يبقى المسار العام كما هو");

  // ④ الرسم المعرفي: البذور محصورة بالنظام داخل الاستعلام.
  seedWheres.length = 0;
  await knowledgeGraphProvider.search({ q: "التصفية", limit: 10, types: ["article"], lawIds: [BANKRUPTCY] });
  ok(JSON.stringify(seedWheres[0]).includes(`"legalSystemId":{"in":["${BANKRUPTCY}"]}`), "بذور الرسم المعرفي محصورة بالنظام");
  await knowledgeGraphProvider.search({ q: "التصفية", limit: 10, types: ["article"] });
  ok(!JSON.stringify(seedWheres[1]).includes("legalSystemId"), "بلا حصر: بذور الرسم بلا شرط نظام");

  // ⑤ OpenSearch: فهرس المواد بلا معرّف النظام فلا يُسأل مع الحصر (لا يأخذ مقاعد ثم يُحذف).
  osFetches = 0;
  const os = await opensearchProvider.search({ q: "التصفية", limit: 10, types: ["article"], lawIds: [BANKRUPTCY] });
  ok(os.length === 0 && osFetches === 0, "OpenSearch لا يُسأل عن المواد مع الحصر");
  await opensearchProvider.search({ q: "التصفية", limit: 10, types: ["article"] });
  ok(osFetches === 1, "OpenSearch يُسأل بلا حصر");

  // ⑥ الأداة الدلالية: law_id يصل إلى استعلام المتجهات قبل الترتيب، والتصفية بعده صمام أمان.
  resetCatalogCache();
  const asked: Array<string[] | undefined> = [];
  const db = {
    async query<T>(q: string): Promise<T[]> {
      if (q.includes("FROM legal_systems s") && q.includes("ORDER BY s.name")) {
        return [
          { id: BANKRUPTCY, name: "نظام الإفلاس", code: null, domain: null, domain_title: null, classification: null, article_count: 231, instrument_kind: null, verified_status: "ساري", card_issued: "1439/05/28", issuance_date: null, royal_decree: null },
          { id: OTHER, name: "نظام آخر", code: null, domain: null, domain_title: null, classification: null, article_count: 10, instrument_kind: null, verified_status: "ساري", card_issued: null, issuance_date: null, royal_decree: null },
        ] as unknown as T[];
      }
      if (q.includes("FROM legal_articles a LEFT JOIN legal_systems l")) {
        return [
          { id: "bk-90", article_number: 90, article_bis: 0, law_id: BANKRUPTCY, law: "نظام الإفلاس", content: "يفتتح إجراء التصفية بقرار من المحكمة" },
          { id: "other-1", article_number: 1, article_bis: 0, law_id: OTHER, law: "نظام آخر", content: "التصفية" },
        ] as unknown as T[];
      }
      return [];
    },
  };
  const deps = {
    enabled: () => true,
    effective: async () => new Map(),
    vectorSearch: async (_q: string, _n: number, lawIds?: string[]) => {
      asked.push(lawIds);
      return [{ id: "bk-90", score: 0.8 }, { id: "other-1", score: 0.9 }];
    },
  };
  const scopedSem = await handleSemanticSearch(db, { query: "التصفية", law_id: BANKRUPTCY }, deps);
  ok(JSON.stringify(asked[0]) === JSON.stringify([BANKRUPTCY]), "hakeem_semantic_search يمرّر law_id إلى المتجهات");
  const semIds = "results" in scopedSem ? scopedSem.results.map((r) => r.article_id) : [];
  ok(semIds.join(",") === "bk-90", "صمام الأمان بعد الاسترجاع باقٍ (مادة نظام آخر لا تظهر)");
  await handleSemanticSearch(db, { query: "التصفية" }, deps);
  ok(asked[1] === undefined, "بلا law_id لا حصر على المتجهات");

  // ⑦ issued_by: من بطاقة النظام عند غياب عمود المادة (بطاقة الإفلاس كما في الإنتاج).
  const card = { issued_hijri: "1439/05/28", instruments: [{ kind: "royal_decree", text: "مرسوم ملكي رقم ( م/50) وتاريخ 1439/5/28هـ" }, { kind: "cabinet_decision", text: "قرار مجلس الوزراء" }] };
  const fromCard = articleIssuance(null, card);
  ok(fromCard.issuedBy === "مرسوم ملكي رقم ( م/50) وتاريخ 1439/5/28هـ" && fromCard.issuedDateH === "1439/05/28", "المادة 1 من الإفلاس: issued_by وissued_date_h من البطاقة");
  ok(articleIssuance("  ", card).issuedBy === fromCard.issuedBy, "عمود المادة الفارغ بمسافات يُعدّ غائبًا");
  const own = articleIssuance("مرسوم ملكي رقم (م/9)", card);
  ok(own.issuedBy === "مرسوم ملكي رقم (م/9)" && own.issuedDateH === null, "أداة على مستوى المادة تتقدم ولا يُنسب لها تاريخ البطاقة");
  ok(issuanceFromCard(null).issuedBy === null && issuanceFromCard({ issued_hijri: null, instruments: "x" }).issuedBy === null, "بلا بطاقة أو بأدوات غير مصفوفة: null");
  const noDate = issuanceFromCard({ issued_hijri: null, instruments: [{ text: "" }, { text: "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ" }] });
  ok(noDate.issuedBy === "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ" && Boolean(noDate.issuedDateH?.includes("1443")), "أول أداة غير فارغة، والتاريخ من نصها إن غاب في البطاقة");

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات HKM-053 نجحت");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
