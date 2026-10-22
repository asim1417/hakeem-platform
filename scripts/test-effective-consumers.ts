/**
 * اختبار المستهلكين: كل مسار يعرض نص مادة يُرجع النص الساري (unit_version) أو سطر الإلغاء.
 * قاعدة وهمية في الذاكرة مكان prisma (لا اتصال بأي قاعدة).
 * التشغيل: npx tsx scripts/test-effective-consumers.ts
 */
import { createRequire } from "node:module";

// «server-only» يرمي خارج بيئة الخادم: نحلّه وحدةً فارغة قبل الاستيراد.
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

// ── البيانات: مثال نظام العمل م5 (معدلة بـ م/46 1436هـ) + مادة ملغاة + مادة بلا سجلات ──
// اسم نظام اختباري: «نظام العمل» موسوم في resolve-law بأن ترقيمه قيد التصحيح، فيرفض الحارس رقمه.
const LAW = "نظام الاختبار";
const SYS = "sys-labor";
const ORIGINAL_5 = "تسري أحكام هذا النظام على (النص الأصلي قبل التعديل)";
const AMENDED_5 = "تسري أحكام هذا النظام على الآتي :\n\n1 - كل عقد عمل ...";
const INSTRUMENT_5 = "مرسوم ملكي رقم م/46 وتاريخ 5/6/1436هـ";
const REPEAL_BY = "مرسوم ملكي رقم م/94 وتاريخ 1442/10/22هـ";

type Row = {
  id: string; lawName: string; legalSystemId: string; articleNumber: number; articleBis: number; title: string; content: string;
  status: string | null; classification: string | null; chapter: string | null; keywords: string[];
  royalDecree: string | null; effectiveFrom: Date | null; updatedAt: Date; createdAt: Date;
};
// HKM-028/030: الصفوف تحمل articleBis (0 للأصل) وإلا أسقطها شرط «articleBis < 100» في كل مستهلك.
const mk = (id: string, n: number, content: string, bis = 0): Row => ({
  id, lawName: LAW, legalSystemId: SYS, articleNumber: n, articleBis: bis, title: `المادة ${n}`, content, status: "سارية",
  classification: null, chapter: "الباب الأول", keywords: [], royalDecree: null, effectiveFrom: null,
  updatedAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01"),
});
const BIS_5 = "نص المادة الخامسة مكرر";
const ARTICLES: Row[] = [
  mk("a4", 4, "نص المادة الرابعة"),
  mk("a5", 5, ORIGINAL_5),
  mk("a5b", 5, BIS_5, 1),
  mk("a6", 6, "نص المادة السادسة قبل إلغائها"),
  mk("h1", 7, "عنوان ليس مادة", 100), // صف ليس مادة (درجة مكرر ≥ 100): لا يُعرض ولا يُستشهد به
];
const UNIT_VERSIONS = [
  { id: "boe26-labor5", unit_id: "a5", body: AMENDED_5, valid_from: new Date("2015-03-25T00:00:00Z"), evidence_instrument: INSTRUMENT_5, evidence_url: "https://laws.boe.gov.sa/x" },
];
const VERIFICATION = [
  { id: "boe26-rep6", object_type: "unit", object_id: "a6", verified_status: "ملغاة", evidence_instrument: REPEAL_BY, evidence_url: "https://laws.boe.gov.sa/y", evidence_quote: "أُلغيت", verified_at: new Date("2026-10-16") },
  { id: "boe26-w1", object_type: "work", object_id: "sys-old", verified_status: "ملغى", evidence_instrument: "م/1", evidence_url: null, evidence_quote: null, verified_at: new Date("2026-10-16") },
];

type Where = Record<string, unknown>;
function matches(r: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND") { if (!(v as Where[]).every((w) => matches(r, w))) return false; continue; }
    if (k === "OR") { if (!(v as Where[]).some((w) => matches(r, w))) return false; continue; }
    const val = (r as unknown as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if ("in" in o && !(o.in as unknown[]).includes(val)) return false;
      if ("contains" in o && !String(val ?? "").includes(String(o.contains))) return false;
      if ("gte" in o && !((val as number) >= (o.gte as number))) return false;
      if ("lte" in o && !((val as number) <= (o.lte as number))) return false;
      if ("gt" in o && !((val as number) > (o.gt as number))) return false;
      if ("lt" in o && !((val as number) < (o.lt as number))) return false;
      if ("not" in o && val === o.not) return false;
      continue;
    }
    if (val !== v) return false;
  }
  return true;
}
const withSystem = (r: Row) => ({ ...r, legalSystem: { id: SYS, name: LAW, eliSlug: null, code: null } });
const fake = {
  legalArticle: {
    findMany: async (args: { where?: Where } = {}) => ARTICLES.filter((r) => matches(r, args.where)).map(withSystem),
    findFirst: async (args: { where?: Where } = {}) => ARTICLES.filter((r) => matches(r, args.where)).map(withSystem)[0] ?? null,
    findUnique: async (args: { where: { id: string } }) => { const r = ARTICLES.find((a) => a.id === args.where.id); return r ? withSystem(r) : null; },
    count: async () => ARTICLES.length,
  },
  legalArticleCaseLink: { findMany: async () => [] },
  legalRelation: { findMany: async () => [] },
  judicialPrinciple: { findMany: async () => [] },
  legalSystem: {
    findMany: async () => [{ id: SYS, name: LAW, eliSlug: null, articleCount: 3, classification: null, domainTitle: null, domain: null }],
    findFirst: async () => ({ id: SYS, name: LAW }),
    findUnique: async (args: { where: { id: string } }) => (args.where.id === SYS ? { id: SYS, name: LAW } : null),
  },
  $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
    if (/FROM unit_version/.test(sql)) {
      const ids = Array.isArray(params[0]) ? (params[0] as string[]) : [params[0] as string];
      return UNIT_VERSIONS.filter((v) => ids.includes(v.unit_id));
    }
    if (/FROM verification/.test(sql)) {
      if (/object_type = 'work'/.test(sql)) return VERIFICATION.filter((v) => v.object_type === "work");
      const type = params[0] as string;
      const ids = Array.isArray(params[1]) ? (params[1] as string[]) : [params[1] as string];
      return VERIFICATION.filter((v) => v.object_type === type && ids.includes(v.object_id));
    }
    if (/FROM legal_systems/.test(sql)) return [{ name: "نظام قديم ملغى" }];
    throw new Error("table not in fixture");
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fake;

async function main() {
  const adapter = await import("../lib/mcp/adapter");
  const range = await import("../lib/mcp/tools/range-and-guide");
  const tools = await import("../lib/modules/agents/tools/index");
  const engine = await import("../lib/agent-runtime/live/engine-tools");
  const run = await import("../lib/agent-runtime/live/run-engine");
  const library = await import("../lib/modules/library/library-service");
  const intel = await import("../lib/modules/legal-core/intelligence");
  const surface = await import("../lib/modules/legal-core/search-surface");

  // MCP hakeem_get_article
  const g5 = (await adapter.getArticle("a5")) as Record<string, unknown>;
  ok(g5.text === AMENDED_5, "hakeem_get_article: نظام العمل م5 = نص م/46");
  ok(g5.evidence_instrument === INSTRUMENT_5 && g5.valid_from === "2015-03-25", "hakeem_get_article: السند وتاريخ السريان");
  const g6 = (await adapter.getArticle("a6")) as Record<string, unknown>;
  ok(g6.repealed === true && String(g6.text).includes(REPEAL_BY) && g6.text !== ARTICLES[2].content, "hakeem_get_article: الملغاة تُرجع الإلغاء وسنده");

  // MCP hakeem_get_articles_range
  const r = (await range.handleRange({ law_id: SYS, from_article: 4, to_article: 6 })) as { articles: Array<{ article_id: string; article_number: number; article_bis: number; text: string; repealed: boolean }> };
  ok(r.articles.find((a) => a.article_number === 5)?.text === AMENDED_5, "hakeem_get_articles_range: م5 معدّلة");
  ok(r.articles.find((a) => a.article_number === 6)?.repealed === true, "hakeem_get_articles_range: م6 ملغاة");
  ok(r.articles.find((a) => a.article_number === 4)?.text === "نص المادة الرابعة", "hakeem_get_articles_range: م4 بلا سجلات كما هي");

  // أدوات الوكيل
  const ar = (await tools.get_articles_range(LAW, 4, 6)).data as Array<{ id: string; content: string; status: string | null }>;
  ok(ar.find((a) => a.id === "a5")?.content === AMENDED_5 && ar.find((a) => a.id === "a6")?.status === "ملغاة", "get_articles_range: المعدلة والملغاة");
  const scan = (await tools.scan_system_articles(LAW)).data;
  ok(scan.find((a) => a.articleNumber === 5)?.content === AMENDED_5, "scan_system_articles: نص ساري");
  const atNow = (await tools.get_article_at_date("a5", "2026-10-16")).data as { text: string; basis: string };
  ok(atNow.text === AMENDED_5 && atNow.basis.includes("م/46"), "get_article_at_date اليوم: نص م/46 من unit_version");
  const atOld = (await tools.get_article_at_date("a5", "2010-01-01")).data as { text: string };
  ok(atOld.text === ORIGINAL_5, "get_article_at_date قبل التعديل: النص الأصلي");

  // محرّك الوكيل الحي
  const ctx = await engine.readArticleInContext([LAW], 5);
  ok(ctx.articles.find((a) => a.article === 5)?.content === AMENDED_5, "readArticleInContext: م5 معدّلة");
  ok(ctx.articles.find((a) => a.article === 6)?.enforcement === "لاغٍ", "readArticleInContext: م6 لاغية");
  const ch = await engine.readChapter([LAW], "الباب الأول");
  ok(ch.articles.find((a) => a.article === 6)?.content.includes(REPEAL_BY) === true, "readChapter: الملغاة بسطر إلغائها");
  const eng = await run.createRunEngine()("أحكام", [LAW]);
  ok(eng.articles.find((a) => a.article === "5")?.text === AMENDED_5, "runEngine (سياق النموذج): م5 معدّلة");

  // المكتبة وواجهة المزامنة
  const lib = await library.searchLegalArticles("");
  ok(lib.find((a) => a.id === "a5")?.content === AMENDED_5, "searchLegalArticles: نص ساري");
  const sync = await library.listArticlesForSync();
  const s5 = sync.items.find((a) => a.id === "a5");
  ok(s5?.effectiveContent === AMENDED_5 && s5?.content === ORIGINAL_5, "listArticlesForSync: effectiveContent ساري و content المحفوظ");
  const det = await library.getArticleDetail("a6");
  ok(Boolean(det?.content.includes(REPEAL_BY)), "getArticleDetail: الملغاة");

  // ذكاء المادة
  const i5 = await intel.getArticleIntelligence("a5");
  ok(i5.article?.content === AMENDED_5, "getArticleIntelligence: نص ساري");

  // الاسترجاع (يغذّي البحث وسياق النموذج والمحادثة)
  const retrieval = await import("../lib/modules/legal-core/legal-retrieval");
  const byNum = await retrieval.getArticlesByNumber(5, LAW);
  ok(byNum[0]?.articleText === AMENDED_5, "getArticlesByNumber (سياق المحادثة): م5 معدّلة");
  const full = await retrieval.getArticleFullContext("a6").catch(() => null);
  ok(Boolean(full?.articleText.includes(REPEAL_BY)), "getArticleFullContext: الملغاة");

  // حارس الإحالات
  const vOld = (await adapter.verifyCitation(LAW, "5", ORIGINAL_5)) as Record<string, unknown>;
  ok(String(vOld.verdict).includes("قبل تعديلها") && vOld.actual_text === AMENDED_5, "verifyCitation: النص القديم يُكشف ويُرجع الساري");
  const vNew = (await adapter.verifyCitation(LAW, "5", AMENDED_5)) as Record<string, unknown>;
  ok(vNew.verdict === "الإحالة صحيحة والنص مطابق", "verifyCitation: النص الساري مطابق");
  const vRep = (await adapter.verifyCitation(LAW, "6")) as Record<string, unknown>;
  ok(vRep.repealed === true && String(vRep.actual_text).includes(REPEAL_BY), "verifyCitation: الملغاة");

  // HKM-030: «مكرر» في الإحالة والوسم
  const vBis = (await adapter.verifyCitation(LAW, "5 مكرر")) as Record<string, unknown>;
  ok(vBis.actual_text === BIS_5 && vBis.article_bis === 1, "verifyCitation: «5 مكرر» تُطابق الصف المكرر لا الأصل");
  const vBisExplicit = (await adapter.verifyCitation(LAW, "٥", undefined, 1)) as Record<string, unknown>;
  ok(vBisExplicit.actual_text === BIS_5, "verifyCitation: درجة «مكرر» الصريحة مع رقم عربي-هندي");
  const vBis2 = (await adapter.verifyCitation(LAW, "5 مكرر 2")) as Record<string, unknown>;
  ok(String(vBis2.verdict).includes("غير موجودة") && vBis2.article_bis === 2, "verifyCitation: «5 مكرر 2» غير موجودة (لا تسقط إلى الأصل)");
  ok(vNew.article_bis === 0, "verifyCitation: الأصل article_bis = 0");
  const p = adapter.parseArticleCitation("المادة ١٢ مكررًا");
  ok(p?.n === 12 && p?.bis === 1, "parseArticleCitation: «المادة ١٢ مكررًا» → 12 / 1");
  const byNumAll = await retrieval.getArticlesByNumber(5, LAW);
  const bisHit = byNumAll.find((a) => a.articleId === "a5b");
  ok(bisHit?.citationLabel === `${LAW}، المادة ٥ مكرر` && byNumAll[0]?.citationLabel === `${LAW}، المادة ٥`, "citationLabel: «المادة ٥ مكرر» للمكرر و«المادة ٥» للأصل");
  const fullBis = await retrieval.getArticleFullContext("a5b").catch(() => null);
  ok(fullBis?.citationLabel === `${LAW}، المادة ٥ مكرر`, "getArticleFullContext: وسم «مكرر»");
  const gBis = (await adapter.getArticle("a5b")) as Record<string, unknown>;
  ok(gBis.article_bis === 1 && g5.article_bis === 0, "hakeem_get_article: article_bis");
  ok(r.articles.some((a) => a.article_id === "a5b" && a.article_bis === 1), "hakeem_get_articles_range: article_bis للمكرر");
  const arAll = (await tools.get_articles_range(LAW, 4, 7)).data as Array<{ id: string; articleBis: number }>;
  ok(arAll.some((a) => a.id === "a5b" && a.articleBis === 1) && !arAll.some((a) => a.id === "h1"), "get_articles_range: يشمل المكرر ويستبعد الصف الذي ليس مادة");

  // البحث: الملغى مستبعد افتراضيًا
  surface.__resetSurfaceCache();
  const loaded = await surface.loadSearchSurface();
  ok(loaded.surface.hidden.has("sys-old"), "البحث يستبعد النظام الملغى بسجل التحقق");
  ok(!loaded.surface.hidden.has(SYS), "النظام الساري يبقى ظاهرًا");
  const direct = await surface.loadSearchSurface(undefined, { includeRepealed: true });
  ok(!direct.surface.hidden.has("sys-old"), "الوصول المباشر يرى النظام الملغى (يُجاب «ملغى» لا «غير موجود»)");
  ok(!loaded.hiddenNames.has("نظام قديم ملغى"), "الإخفاء بالمعرّف لا بالاسم");
  surface.__resetSurfaceCache();
  const past = await surface.loadSearchSurface("2000-01-01");
  ok(!past.surface.hidden.has("sys-old"), "بحث بتاريخ ماضٍ لا يُخفي (تاريخ الإلغاء غير مسجل)");

  if (failed) {
    console.error(`\n${failed} اختبار فشل`);
    process.exit(1);
  }
  console.log("\nكل الاختبارات نجحت");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
