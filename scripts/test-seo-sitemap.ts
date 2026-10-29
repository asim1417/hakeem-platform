/**
 * HKM-061: خريطة الموقع (فهرس + ملفات فرعية) وnoindex صفحة النظام الرقيقة.
 *   npx tsx scripts/test-seo-sitemap.ts
 *
 * ١) دوال صرفة وعميل SQL مزيّف — تعمل دائمًا بلا قاعدة.
 * ٢) الاستعلامات الفعلية على PostgreSQL محلي ببيانات اصطناعية — تعمل إن وُجدت قاعدة محلية اسمها ينتهي بـ _test
 *    (HKM023B_TEST_DATABASE_URL، وassertLocalTestUrl يرفض غير المحلي)، وإلا تُتخطى بسطر واضح. لا تلمس الإنتاج.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SqlClient } from "../lib/modules/legal-core/sql-port";
import { lawSlug } from "../lib/modules/legal-core/eli";
import {
  EDGE_SPACE_PATTERN,
  MIN_INDEXABLE_SYSTEM_TEXT_CHARS,
  isSystemIndexable,
  systemPageRobots,
  systemTextChars,
  trimmedCharCount,
} from "../lib/modules/seo/indexability";
import { pathToFileURL } from "node:url";
import {
  ARTICLES_PER_SITEMAP,
  MAX_ARTICLE_SITEMAPS,
  SITEMAP_MAX_BYTES,
  SITEMAP_PROTOCOL_MAX_URLS,
  SITEMAP_REWRITES,
  STATIC_SITEMAP_PATHS,
  articlePagePath,
  latestDate,
  parseSitemapFileName,
  plannedArticleChunks,
  renderSitemapIndex,
  renderUrlset,
  sitemapFileName,
  sitemapIndexEntries,
  sitemapPublicPath,
  sitemapStaticParams,
  systemPagePath,
  w3cDatetime,
  xmlEscape,
  type SitemapPlan,
} from "../lib/modules/seo/sitemap";
import {
  SQL_ARTICLE_CHUNK,
  SQL_ARTICLE_CHUNK_PLAN,
  SQL_SITEMAP_SYSTEMS,
  loadArticleChunk,
  loadSitemapPlan,
  loadSitemapSystems,
  loadSystemContentSignal,
} from "../lib/modules/seo/sitemap-data";
import { PHASE_PRODUCTION_BUILD, buildChildSitemapXml, buildSitemapIndexXml, buildSitemapStaticParams } from "../lib/modules/seo/sitemap-routes";
import { connectLocalTest } from "./hkm-023-b/local-db";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const BASE = "https://hakeemai.net";
let passed = 0;
function ok(cond: unknown, label: string): void {
  assert.ok(cond, label);
  passed++;
}
function eq<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  passed++;
}

/** عميل مزيّف: يسجّل الاستعلامات ويرد بحسب نص SQL. */
function fakeDb(answer: (sql: string, params: readonly unknown[]) => unknown[] | Error): { db: SqlClient; calls: Array<{ sql: string; params: readonly unknown[] }> } {
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  return {
    calls,
    db: {
      query: async <T>(sql: string, params: readonly unknown[] = []) => {
        calls.push({ sql, params });
        const r = answer(sql, params);
        if (r instanceof Error) throw r;
        return r as T[];
      },
    },
  };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

// ───────────── ١. قابلية الفهرسة ─────────────
function indexabilityTests() {
  eq(MIN_INDEXABLE_SYSTEM_TEXT_CHARS, 500, "I-1 الحد ثابت مسمّى = 500");
  eq(trimmedCharCount("  نص\n\t"), 2, "I-2 التشذيب قبل العدّ");
  eq(trimmedCharCount(" ﻿　نص غير متاح "), 11, "I-3 مسافات يونيكود الطرفية تُشذّب");
  eq(trimmedCharCount("a b"), 3, "I-4 المسافة الداخلية تُعدّ");
  eq(trimmedCharCount("😀"), 1, "I-5 العدّ بنقاط يونيكود كـ char_length");
  eq(trimmedCharCount(null), 0, "I-6 null = 0");

  const long = "ن".repeat(800);
  eq(systemTextChars({ preamble: long }), 800, "I-7 بلا بطاقة: الديباجة");
  eq(systemTextChars({ cardBlocks: [], preamble: long }), 800, "I-8 بطاقة بلا كتل: الديباجة (كالصفحة)");
  eq(systemTextChars({ cardBlocks: [{ text: " عنوان " }, { text: "متن" }], preamble: long }), 8, "I-9 كتل البطاقة تُعرض بدل الديباجة فتُقاس هي");
  eq(systemTextChars({ cardBlocks: [{ text: 5 }, {}, { text: "abc" }] }), 3, "I-10 كتلة بلا نص لا تُعدّ");

  ok(!isSystemIndexable({ articleCount: 0, textChars: 499 }), "I-11 499 محرفًا بلا مواد: رقيقة");
  ok(isSystemIndexable({ articleCount: 0, textChars: 500 }), "I-12 500 محرف بلا مواد: تُفهرس (الحد شامل)");
  ok(isSystemIndexable({ articleCount: 1, textChars: 0 }), "I-13 له مادة: يُفهرس ولو بلا ديباجة");
  eq(systemPageRobots({ articleCount: 0, textChars: 11 }), { index: false, follow: true }, "I-14 noindex, follow");
  eq(systemPageRobots({ articleCount: 0, textChars: 500 }), undefined, "I-15 لا robots للمفهرسة");
  eq(systemPageRobots({ articleCount: 12, textChars: 0 }), undefined, "I-16 لا robots لنظام بمواد");
  eq(systemPageRobots(null), undefined, "I-17 تعذّر القياس = لا noindex (فشل مفتوح)");

  // أشكال الإنتاج 29/10: 3 أنظمة بلا مواد ديباجتها 11 و123 و170، اثنان منها لهما بطاقة مصدر بنص طويل.
  ok(!isSystemIndexable({ articleCount: 0, textChars: systemTextChars({ preamble: "نص غير متاح" }) }), "I-18 «نص غير متاح» بلا بطاقة: noindex");
  ok(isSystemIndexable({ articleCount: 0, textChars: systemTextChars({ cardBlocks: [{ text: "ن".repeat(1161) }], preamble: "ن".repeat(170) }) }), "I-19 ديباجة 170 وبطاقة 1161: تُفهرس (المعروض هو البطاقة)");
  ok(isSystemIndexable({ articleCount: 0, textChars: systemTextChars({ preamble: "ن".repeat(1487) }) }), "I-20 جدول مخالفات 1487 محرفًا بلا مواد: يُفهرس");
}

// ───────────── ٢. دوال الخريطة الصرفة ─────────────
function sitemapPureTests() {
  eq(parseSitemapFileName("static.xml"), { kind: "static" }, "S-1");
  eq(parseSitemapFileName("systems.xml"), { kind: "systems" }, "S-2");
  eq(parseSitemapFileName("articles-0.xml"), { kind: "articles", chunk: 0 }, "S-3");
  eq(parseSitemapFileName("articles-12.xml"), { kind: "articles", chunk: 12 }, "S-4");
  eq(MAX_ARTICLE_SITEMAPS, 100, "S-4b حد الاسم صغير (100 ملف = 500,000 مادة)");
  eq(parseSitemapFileName("articles-99.xml"), { kind: "articles", chunk: 99 }, "S-4c آخر رقم مقبول");
  for (const bad of ["articles-100.xml", "articles-01.xml", "articles--1.xml", "articles-1.xml.gz", "articles-.xml", "articles-10000.xml", "articles-1e3.xml", "../static.xml", "sitemap.xml", "STATIC.xml", ""]) {
    eq(parseSitemapFileName(bad), null, `S-5 مرفوض: ${JSON.stringify(bad)}`);
  }
  eq(sitemapFileName({ kind: "articles", chunk: 7 }), "articles-7.xml", "S-6");
  eq(sitemapPublicPath({ kind: "articles", chunk: 7 }), "/sitemap-articles-7.xml", "S-6b المسار العام في الجذر");
  eq(sitemapPublicPath({ kind: "static" }), "/sitemap-static.xml", "S-6c");
  eq(sitemapPublicPath({ kind: "systems" }), "/sitemap-systems.xml", "S-6d");

  eq(systemPagePath("نظام-العمل", "نظام العمل"), `/legal/${encodeURIComponent("نظام-العمل")}`, "S-7 مسار النظام كـ canonical");
  eq(systemPagePath(null, "نظام المعاملات المدنية"), `/legal/${encodeURIComponent(lawSlug("نظام المعاملات المدنية"))}`, "S-8 بلا eli_slug: اشتقاق الاسم (كالصفحة)");
  eq(articlePagePath("نظام-العمل", "x", 80), `/legal/${encodeURIComponent("نظام-العمل")}/80`, "S-9 مفتاح المادة");
  eq(articlePagePath("نظام-العمل", "x", 103, 1), `/legal/${encodeURIComponent("نظام-العمل")}/103_bis`, "S-10 مكرر");
  eq(articlePagePath("نظام-العمل", "x", 103, 2), `/legal/${encodeURIComponent("نظام-العمل")}/103_bis2`, "S-11 مكرر مرتين");

  eq(w3cDatetime(new Date("2026-10-29T14:19:55.808Z")), "2026-10-29T14:19:55Z", "S-12 W3C بلا أجزاء الثانية");
  eq(w3cDatetime("not a date"), null, "S-13 تاريخ غير صالح = بلا lastmod");
  eq(latestDate(null, "2026-01-02T00:00:00Z", new Date("2026-03-01T00:00:00Z"), "x"), new Date("2026-03-01T00:00:00Z"), "S-14 أحدث تاريخ");
  eq(latestDate(null, undefined), null, "S-15");
  eq(xmlEscape(`a&b<c>"d'`), "a&amp;b&lt;c&gt;&quot;d&apos;", "S-16 تهريب XML");

  const xml = renderUrlset([{ loc: `${BASE}/legal/x?a=1&b=2`, lastModified: new Date("2026-10-01T10:00:00Z") }, { loc: `${BASE}/` }]);
  ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), "S-17 رأس urlset");
  ok(xml.includes("<url><loc>https://hakeemai.net/legal/x?a=1&amp;b=2</loc><lastmod>2026-10-01T10:00:00Z</lastmod></url>"), "S-18 مدخل بتاريخ مهرّب");
  ok(xml.includes("<url><loc>https://hakeemai.net/</loc></url>"), "S-19 مدخل بلا lastmod");
  eq(renderUrlset([]), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n', "S-20 urlset فارغ صالح");
  assert.throws(() => renderUrlset(Array.from({ length: SITEMAP_PROTOCOL_MAX_URLS + 1 }, () => ({ loc: BASE }))), /50000/);
  passed++;
  ok(ARTICLES_PER_SITEMAP <= SITEMAP_PROTOCOL_MAX_URLS, "S-21 الملف ضمن حد البروتوكول");
  eq(SITEMAP_MAX_BYTES, 4_000_000, "S-21b حد الحجم ~4MB (تحت 4.5MB لدوال Vercel)");
  // ملف يتجاوز حد الحجم يُرفض (لا يُخرج مبتورًا): 5,000 رابط بـ slug أطول مما في الإنتاج (~1KB للرابط).
  const huge = Array.from({ length: ARTICLES_PER_SITEMAP }, (_, i) => ({ loc: `${BASE}${articlePagePath("ن".repeat(160), "x", i + 1)}` }));
  assert.throws(() => renderUrlset(huge), /تتجاوز الحد 4000000/);
  passed++; // S-21c

  // حجم ملف المواد: 5,000 رابط بـ slug ضعف متوسط الإنتاج (72 بايت ← 144) يبقى أقل كثيرًا من حد Vercel 4.5MB.
  const slug = "ن".repeat(72);
  const big = renderUrlset(Array.from({ length: ARTICLES_PER_SITEMAP }, (_, i) => ({ loc: `${BASE}${articlePagePath(slug, "x", i + 1)}`, lastModified: new Date() })));
  ok(Buffer.byteLength(big) < 4.5 * 1024 * 1024 * 0.75, `S-22 حجم ملف المواد ${(Buffer.byteLength(big) / 1e6).toFixed(2)}MB تحت 75% من 4.5MB`);

  const entries = sitemapIndexEntries(BASE, {
    systemsLastModified: new Date("2026-10-20T00:00:00Z"),
    articleChunks: [
      { chunk: 1, urls: 4704, lastModified: new Date("2026-10-29T15:37:21Z") },
      { chunk: 0, urls: 5000, lastModified: new Date("2026-10-10T00:00:00Z") },
      { chunk: 2, urls: 0, lastModified: null },
    ],
  });
  eq(
    entries.map((e) => e.loc),
    [`${BASE}/sitemap-static.xml`, `${BASE}/sitemap-systems.xml`, `${BASE}/sitemap-articles-0.xml`, `${BASE}/sitemap-articles-1.xml`],
    "S-23 ترتيب الفهرس (من جذر الموقع)، وملف فارغ لا يُدرج"
  );
  eq(entries[1].lastModified, new Date("2026-10-29T15:37:21Z"), "S-24 الأنظمة تتغير بتغير موادها");
  eq(entries[0].lastModified, undefined, "S-25 الثابتة بلا lastmod");
  ok(renderSitemapIndex(entries).includes("<sitemap><loc>https://hakeemai.net/sitemap-articles-1.xml</loc><lastmod>2026-10-29T15:37:21Z</lastmod></sitemap>"), "S-26 فهرس XML");

  // ما يُرسم وقت البناء: الثابت دائمًا؛ والأنظمة وملفات المواد غير الفارغة إن عُرفت الخطة.
  const planOf = (chunks: Array<[number, number]>): SitemapPlan => ({
    systemsLastModified: null,
    articleChunks: chunks.map(([chunk, urls]) => ({ chunk, urls, lastModified: null })),
  });
  eq(plannedArticleChunks(planOf([[2, 5], [0, 5000], [1, 0], [150, 3]])), [0, 2], "S-27 ملفات الخطة: غير الفارغة وضمن حد الاسم");
  eq(
    sitemapStaticParams(planOf([[0, 5000], [1, 5000], [2, 12]])),
    [{ file: "static.xml" }, { file: "systems.xml" }, { file: "articles-0.xml" }, { file: "articles-1.xml" }, { file: "articles-2.xml" }],
    "S-28 generateStaticParams من الخطة"
  );
  eq(sitemapStaticParams(null), [{ file: "static.xml" }], "S-29 بلا قاعدة: الثابت وحده");
}

// ───────────── ٣. المساران بعميل مزيّف ─────────────
async function routeTests() {
  const d = (s: string) => new Date(s);
  {
    const { db, calls } = fakeDb((sql) =>
      sql === SQL_ARTICLE_CHUNK_PLAN
        ? [
            { chunk: -1, urls: 1189, lastModified: d("2026-10-23T00:43:24Z") },
            { chunk: 0, urls: 5000, lastModified: d("2026-10-22T12:00:00Z") },
            { chunk: 1, urls: 12, lastModified: d("2026-10-29T15:37:21Z") },
          ]
        : new Error(`unexpected ${sql.slice(0, 30)}`)
    );
    const xml = await buildSitemapIndexXml(db, BASE);
    eq(calls.length, 1, "R-1 الفهرس استعلام واحد");
    eq(calls[0].params, [ARTICLES_PER_SITEMAP], "R-2 حجم الملف معامل");
    eq(locs(xml), [`${BASE}/sitemap-static.xml`, `${BASE}/sitemap-systems.xml`, `${BASE}/sitemap-articles-0.xml`, `${BASE}/sitemap-articles-1.xml`], "R-3 ملفات الفهرس");
    ok(xml.includes("<sitemapindex"), "R-4 sitemapindex");
  }
  {
    const { db } = fakeDb(() => new Error("connection refused"));
    await assert.rejects(() => buildSitemapIndexXml(db, BASE), /connection refused/);
    passed++; // R-5 وقت التشغيل: يُرمى الخطأ فيبقى ISR على آخر نسخة ناجحة
    const xml = await buildSitemapIndexXml(db, BASE, { phase: PHASE_PRODUCTION_BUILD });
    eq(locs(xml), [`${BASE}/sitemap-static.xml`, `${BASE}/sitemap-systems.xml`], "R-6 وقت البناء بلا قاعدة: فهرس مؤقت ولا يُكسر البناء");
    eq(await buildSitemapStaticParams(() => Promise.reject(new Error("connection refused"))), [{ file: "static.xml" }], "R-6b generateStaticParams بلا قاعدة لا يكسر البناء");
    await assert.rejects(() => buildChildSitemapXml(db, BASE, "systems.xml"), /connection refused/);
    await assert.rejects(() => buildChildSitemapXml(db, BASE, "articles-0.xml"), /connection refused/);
    passed++; // R-7 الملفات الفرعية لا تخزّن خريطة فارغة عند العطل
  }
  {
    const { db, calls } = fakeDb(() => new Error("no db needed"));
    const r = await buildChildSitemapXml(db, BASE, "static.xml");
    ok(r.status === 200 && locs(r.xml).length === STATIC_SITEMAP_PATHS.length, "R-8 الثابتة ستة روابط");
    ok(r.status === 200 && locs(r.xml)[0] === `${BASE}/` && locs(r.xml).includes(`${BASE}/legal`) && !r.xml.includes("<lastmod>"), "R-9 الرئيسية كما في الخريطة السابقة (/)، وبلا lastmod");
    eq((await buildChildSitemapXml(db, BASE, "articles-01.xml")).status, 404, "R-10 اسم غير معروف: 404");
    eq((await buildChildSitemapXml(db, BASE, "nope.xml")).status, 404, "R-11");
    eq(calls.length, 0, "R-12 لا استعلام للثابتة ولا للاسم المرفوض");
  }
  {
    const { db, calls } = fakeDb((sql) =>
      sql === SQL_SITEMAP_SYSTEMS
        ? [
            { name: "نظام العمل", eliSlug: "نظام-العمل", articleCount: 245, textChars: null, lastModified: d("2026-10-29T14:19:55Z") },
            { name: "نظام تأديب الموظفين", eliSlug: "نظام-تاديب-الموظفين", articleCount: 0, textChars: 11, lastModified: d("2026-10-22T12:47:08Z") },
            { name: "جدول تصنيف المخالفات", eliSlug: "جدول-تصنيف-المخالفات", articleCount: 0, textChars: 1487, lastModified: d("2026-10-23T00:43:24Z") },
            { name: "نظام بلا slug", eliSlug: null, articleCount: 3, textChars: null, lastModified: null },
            { name: "نظام العمل (مكرر الرابط)", eliSlug: "نظام-العمل", articleCount: 5, textChars: null, lastModified: null },
          ]
        : new Error("unexpected")
    );
    const r = await buildChildSitemapXml(db, BASE, "systems.xml");
    assert.equal(r.status, 200);
    if (r.status !== 200) return;
    eq(calls.length, 1, "R-13 ملف الأنظمة استعلام واحد");
    eq(calls[0].params, [EDGE_SPACE_PATTERN], "R-14 نمط التشذيب معامل لا نص مدموج");
    eq(
      locs(r.xml),
      [
        `${BASE}${systemPagePath("نظام-العمل", "")}`,
        `${BASE}${systemPagePath("جدول-تصنيف-المخالفات", "")}`,
        `${BASE}${systemPagePath(null, "نظام بلا slug")}`,
      ],
      "R-15 الرقيق خارج الخريطة، وذو الديباجة الطويلة داخلها، والرابط المكرر مرة واحدة"
    );
    ok(r.xml.includes("<lastmod>2026-10-29T14:19:55Z</lastmod>"), "R-16 lastmod النظام");
  }
  {
    const { db, calls } = fakeDb((sql, params) =>
      sql === SQL_ARTICLE_CHUNK
        ? Number(params[0]) === 2 * ARTICLES_PER_SITEMAP
          ? [
              { name: "نظام العمل", eliSlug: "نظام-العمل", articleNumber: 80, articleBis: 0, lastModified: d("2026-10-29T15:37:21.431Z") },
              { name: "نظام العمل", eliSlug: "نظام-العمل", articleNumber: 80, articleBis: 1, lastModified: null },
            ]
          : []
        : new Error("unexpected")
    );
    let planLoads = 0;
    const loadPlan = async (): Promise<SitemapPlan> => {
      planLoads++;
      return { systemsLastModified: null, articleChunks: [0, 1, 2].map((chunk) => ({ chunk, urls: chunk === 2 ? 2 : 5000, lastModified: null })) };
    };
    const r = await buildChildSitemapXml(db, BASE, "articles-2.xml", { loadPlan });
    assert.equal(r.status, 200);
    if (r.status !== 200) return;
    eq(calls.length, 1, "R-16b الخطة من المحمّل (المخزّن)، واستعلام واحد للملف");
    eq(calls[0].params, [2 * ARTICLES_PER_SITEMAP, ARTICLES_PER_SITEMAP], "R-17 OFFSET/LIMIT للملف الثالث");
    eq(locs(r.xml), [`${BASE}${articlePagePath("نظام-العمل", "", 80)}`, `${BASE}${articlePagePath("نظام-العمل", "", 80, 1)}`], "R-18 روابط المواد كـ canonical");
    ok(r.xml.includes("<lastmod>2026-10-29T15:37:21Z</lastmod>"), "R-19 lastmod المادة");
    const before = calls.length;
    for (const n of [3, 9, 77, 99]) {
      eq((await buildChildSitemapXml(db, BASE, `articles-${n}.xml`, { loadPlan })).status, 404, `R-20 ملف خارج الخطة (${n}): 404`);
    }
    eq(calls.length, before, "R-20b رقم خارج الخطة لا يصل إلى استعلام الملف");
    eq((await buildChildSitemapXml(db, BASE, "articles-100.xml", { loadPlan })).status, 404, "R-20c فوق حد الاسم: 404");
    eq(planLoads, 5, "R-20d حد الاسم يُرفض قبل الخطة نفسها (1 + 4، لا شيء لـ 100)");
  }
  {
    const signalOf = async (row: unknown) => loadSystemContentSignal(fakeDb(() => (row instanceof Error ? row : [row])).db, { id: "s", name: "n", preamble: "نص غير متاح" });
    eq(await signalOf({ hasArticles: true, cardBlocks: null }), { articleCount: 1, textChars: 0 }, "R-21 إشارة: له مواد");
    eq(await signalOf({ hasArticles: false, cardBlocks: null }), { articleCount: 0, textChars: 11 }, "R-22 بلا بطاقة: الديباجة");
    eq(await signalOf({ hasArticles: false, cardBlocks: [{ kind: "preamble_other", text: "ن".repeat(600) }] }), { articleCount: 0, textChars: 600 }, "R-23 البطاقة");
    eq(await signalOf(new Error("timeout")), null, "R-24 خطأ القراءة = null (لا noindex)");
  }
}

// ───────────── ٤. ربط الصفحات والمسارات ─────────────
async function wiringTests() {
  const systemPage = read("app/legal/[slug]/page.tsx");
  const meta = systemPage.slice(systemPage.indexOf("export async function generateMetadata"), systemPage.indexOf("export default async function"));
  ok(meta.includes("loadSystemContentSignal") && meta.includes("systemPageRobots(signal)") && meta.includes("robots"), "W-1 generateMetadata يضع robots للنظام الرقيق");
  ok(!meta.includes("notFound("), "W-2 النظام الفارغ لا يصير 404 (noindex فقط)");

  const index = read("app/sitemap.xml/route.ts");
  ok(index.includes("export const revalidate = 3600") && index.includes("buildSitemapIndexXml") && index.includes("NEXT_PHASE") && index.includes("loadPlan: cachedSitemapPlan"), "W-3 الفهرس ISR بساعة، بالخطة المخزّنة");
  const child = read("app/sitemaps/[file]/route.ts");
  ok(
    child.includes("export const revalidate = 3600") &&
      child.includes("return buildSitemapStaticParams(cachedSitemapPlan)") &&
      child.includes("loadPlan: cachedSitemapPlan"),
    "W-4 الفرعية: تُرسم وقت البناء من الخطة (HIT)، وفحص الرقم بالخطة المخزّنة"
  );
  const cache = read("lib/modules/seo/sitemap-cache.ts");
  ok(cache.includes("unstable_cache(") && cache.includes("revalidate: 3600"), "W-4b الخطة مخزّنة ساعة");

  // إعادة الكتابة من الجذر في next.config.mjs الفعلي تطابق SITEMAP_REWRITES.
  const cfg = (await import(`${pathToFileURL(path.join(root, "next.config.mjs")).href}?seo=1`)) as {
    default: { rewrites: () => Promise<{ afterFiles: Array<{ source: string; destination: string }> }> };
  };
  const after = (await cfg.default.rewrites()).afterFiles;
  eq(
    after.filter((r) => r.source.startsWith("/sitemap-")),
    SITEMAP_REWRITES.map((r) => ({ ...r })),
    "W-4c next.config.mjs يعيد كتابة /sitemap-*.xml إلى /sitemaps/*"
  );
  ok(!fs.existsSync(path.join(root, "app/sitemap.ts")), "W-5 لا تعارض مع app/sitemap.ts");

  // robots.txt بمتغير قديم على vercel.app: يشير إلى الفهرس على hakeemai.net.
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://hakeem-platform.vercel.app";
  const robots = (await import("../app/robots")).default();
  eq(robots.sitemap, "https://hakeemai.net/sitemap.xml", "W-6 Sitemap في robots.txt");
  eq(robots.host, "https://hakeemai.net", "W-7 Host في robots.txt");
  if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = prev;
}

// ───────────── ٥. الاستعلامات على PostgreSQL محلي ─────────────
async function localDbTests() {
  let conn: Awaited<ReturnType<typeof connectLocalTest>> = null;
  try {
    conn = await connectLocalTest(process.env.HKM023B_TEST_DATABASE_URL || "postgres://hakeem:localtest@127.0.0.1:54329/hakeem_seo_test");
  } catch (e) {
    console.log(`(تخطٍّ) اختبارات SQL المحلية: ${(e as Error).message.split("\n")[0]}`);
    return;
  }
  if (!conn) {
    console.log("(تخطٍّ) اختبارات SQL المحلية: لا قاعدة محلية _test");
    return;
  }
  const { client, db } = conn;
  try {
    await db.query(`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.query(`CREATE SCHEMA public`);
    await db.query(read("scripts/hkm-023-b/fixtures/base-schema.sql"));
    await db.query(`CREATE TABLE IF NOT EXISTS article_versions (
      id text PRIMARY KEY, article_id text NOT NULL REFERENCES legal_articles(id), version_text text NOT NULL,
      effective_from timestamp, effective_to timestamp, source text NOT NULL DEFAULT 'derived',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

    const pad = (n: number) => " \n " + "ن".repeat(n) + " ﻿\n";
    const systems: Array<[id: string, name: string, sort: number, eli: string | null, preamble: string | null]> = [
      ["s-labor", "نظام العمل الاصطناعي", 1, "نظام-العمل-الاصطناعي", null],
      ["s-noslug", "نظام بلا رابط", 2, null, null],
      ["s-thin", "نظام تأديب اصطناعي", 3, "نظام-تاديب-اصطناعي", "نص غير متاح"],
      ["s-long", "جدول مخالفات اصطناعي", 4, "جدول-مخالفات-اصطناعي", pad(600)],
      ["s-499", "لائحة 499", 5, "لائحه-499", pad(499)],
      ["s-500", "لائحة 500", 6, "لائحه-500", pad(500)],
      ["s-card", "تنظيم ببطاقة", 7, "تنظيم-ببطاقه", "ن".repeat(170)],
      ["s-cardshort", "لائحة بطاقتها قصيرة", 8, "لائحه-بطاقتها-قصيره", "ن".repeat(800)],
      ["s-byname", "نظام مربوط بالاسم", 9, "نظام-مربوط-بالاسم", null],
    ];
    for (const [id, name, sort, eli, preamble] of systems) {
      await db.query(
        `INSERT INTO legal_systems (id, name, sort_order, eli_slug, preamble, "updatedAt", preamble_updated_at) VALUES ($1, $2, $3, $4, $5, '2026-09-01 00:00:00', NULL)`,
        [id, name, sort, eli, preamble]
      );
    }
    const art = async (id: string, sid: string | null, law: string, n: number, bis: number, updated: string) =>
      db.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", "articleBis", title, content, "updatedAt") VALUES ($1, $2, $3, $4, $5, 'ع', 'نص اصطناعي', $6)`, [id, sid, law, n, bis, updated]);
    await art("a-l1", "s-labor", "نظام العمل الاصطناعي", 1, 0, "2026-10-01 10:00:00");
    await art("a-l2", "s-labor", "نظام العمل الاصطناعي", 2, 0, "2026-10-01 10:00:00");
    await art("a-l2b", "s-labor", "نظام العمل الاصطناعي", 2, 1, "2026-10-01 10:00:00");
    await art("a-l0", "s-labor", "نظام العمل الاصطناعي", 0, 0, "2026-10-01 10:00:00"); // ليست مادة (الرقم 0) — يمنعها قيد الإنتاج، هنا لاختبار التصفية
    await art("a-l100", "s-labor", "نظام العمل الاصطناعي", 3, 100, "2026-10-01 10:00:00"); // صف ليس مادة
    await art("a-n1", "s-noslug", "نظام بلا رابط", 7, 0, "2026-10-02 10:00:00");
    await art("a-name", null, "نظام مربوط بالاسم", 1, 0, "2026-10-02 10:00:00"); // بلا legalSystemId
    await db.query(`INSERT INTO article_versions (id, article_id, version_text, created_at) VALUES ('av-1', 'a-l2', 'ن', '2026-10-15 08:00:00')`);
    await db.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, created_at) VALUES ('uv-1', 'a-l1', 'ن', '2020-01-01', '2026-10-29 15:37:21+00')`);
    const card = async (id: string, sid: string, blocks: unknown, created: string) =>
      db.query(
        `INSERT INTO law_card (id, system_id, official_name, text_blocks, source_name, source_url, retrieved_on, created_by, created_at) VALUES ($1, $2, 'x', $3::jsonb, 'اصطناعي', 'https://example.test', '2026-10-16', 'test', $4)`,
        [id, sid, JSON.stringify(blocks), created]
      );
    await card("c-1", "s-card", [{ kind: "title", text: "تنظيم" }, { kind: "preamble_other", text: pad(1161) }], "2026-10-29 15:13:53+00");
    await card("c-2old", "s-cardshort", [{ kind: "preamble_other", text: "ن".repeat(900) }], "2026-10-16 13:54:57+00");
    await card("c-2new", "s-cardshort", [{ kind: "title", text: " عنوان قصير " }], "2026-10-29 14:55:14+00");

    // منطقة جلسة غير UTC: التواريخ تبقى صحيحة (AT TIME ZONE 'UTC').
    await db.query(`SET TIME ZONE 'Asia/Riyadh'`);

    // التقسيم: ملفات صغيرة (حجم 2) تغطي المواد كلها بلا تكرار وبالترتيب نفسه.
    const plan2 = await db.query<{ chunk: number; urls: number; lastModified: Date }>(SQL_ARTICLE_CHUNK_PLAN, [2]);
    eq(plan2.map((r) => [Number(r.chunk), Number(r.urls)]), [[-1, systems.length], [0, 2], [1, 2]], "L-1 خطة: الأنظمة ثم ملفان من 2");
    const all: string[] = [];
    for (const c of [0, 1, 2]) {
      const rows = await db.query<{ name: string; articleNumber: number; articleBis: number }>(SQL_ARTICLE_CHUNK, [c * 2, 2]);
      all.push(...rows.map((r) => `${r.name}#${r.articleNumber}_${r.articleBis}`));
    }
    eq(all, ["نظام العمل الاصطناعي#1_0", "نظام العمل الاصطناعي#2_0", "نظام العمل الاصطناعي#2_1", "نظام بلا رابط#7_0"], "L-2 المواد بالترتيب، بلا الرقم 0 ولا مكرر ≥100، وبلا المادة غير المربوطة");

    const plan = await loadSitemapPlan(db);
    eq(plan.articleChunks.map((c) => [c.chunk, c.urls]), [[0, 4]], "L-3 بالحجم الحقيقي: ملف واحد");
    eq(plan.articleChunks[0].lastModified?.toISOString(), "2026-10-29T15:37:21.000Z", "L-4 lastmod = أحدث نسخة نص معدّلة (unit_version)");
    eq(plan.systemsLastModified?.toISOString(), "2026-10-29T15:13:53.000Z", "L-5 lastmod الأنظمة يشمل آخر بطاقة");

    const chunk0 = await loadArticleChunk(db, 0);
    const byKey = new Map(chunk0.map((r) => [`${r.articleNumber}_${r.articleBis}_${r.name}`, r.lastModified?.toISOString()]));
    eq(byKey.get("1_0_نظام العمل الاصطناعي"), "2026-10-29T15:37:21.000Z", "L-6 مادة بنسخة معدّلة");
    eq(byKey.get("2_0_نظام العمل الاصطناعي"), "2026-10-15T08:00:00.000Z", "L-7 مادة بنسخة article_versions");
    eq(byKey.get("2_1_نظام العمل الاصطناعي"), "2026-10-01T10:00:00.000Z", "L-8 updatedAt بتوقيت UTC رغم منطقة الجلسة");
    eq(await loadArticleChunk(db, 1), [], "L-9 ملف خارج المدى فارغ");
    const a0 = await buildChildSitemapXml(db, BASE, "articles-0.xml");
    eq(a0.status === 200 ? locs(a0.xml).length : -1, 4, "L-9b ملف المواد 0 (الخطة مباشرة من القاعدة)");
    eq((await buildChildSitemapXml(db, BASE, "articles-1.xml")).status, 404, "L-9c ملف خارج الخطة: 404");

    const sysRows = await loadSitemapSystems(db);
    const sig = new Map(sysRows.map((r) => [r.name, r.signal]));
    const preambleOf = new Map(systems.map(([, name, , , p]) => [name, p]));
    eq(sig.get("نظام العمل الاصطناعي"), { articleCount: 3, textChars: 0 }, "L-10 عدد المواد المعروضة");
    eq(sig.get("لائحة 499")?.textChars, 499, "L-11 تشذيب SQL كـ JS (499)");
    eq(sig.get("لائحة 500")?.textChars, 500, "L-12 تشذيب SQL كـ JS (500)");
    eq(sig.get("جدول مخالفات اصطناعي")?.textChars, systemTextChars({ preamble: preambleOf.get("جدول مخالفات اصطناعي") }), "L-13 تطابق SQL وJS");
    eq(sig.get("تنظيم ببطاقة")?.textChars, 5 + 1161, "L-14 كتل آخر بطاقة بدل الديباجة");
    eq(sig.get("لائحة بطاقتها قصيرة")?.textChars, 10, "L-15 آخر بطاقة (لا الأقدم) هي المعروضة");
    eq(sig.get("نظام تأديب اصطناعي")?.textChars, 11, "L-16");

    const sysXml = await buildChildSitemapXml(db, BASE, "systems.xml");
    assert.equal(sysXml.status, 200);
    if (sysXml.status === 200) {
      eq(
        locs(sysXml.xml).map((u) => decodeURIComponent(u.replace(`${BASE}/legal/`, ""))),
        ["نظام-العمل-الاصطناعي", lawSlug("نظام بلا رابط"), "جدول-مخالفات-اصطناعي", "لائحه-500", "تنظيم-ببطاقه"],
        "L-17 خريطة الأنظمة: المواد، والنص ≥ 500 فقط"
      );
    }

    // إشارة الصفحة (شرطها: المعرّف أو اسم النظام) تطابق قرار الخريطة.
    const pageSignal = async (id: string, name: string) => loadSystemContentSignal(db, { id, name, preamble: preambleOf.get(name) ?? null });
    eq(systemPageRobots(await pageSignal("s-thin", "نظام تأديب اصطناعي")), { index: false, follow: true }, "L-18 noindex للرقيق");
    eq(systemPageRobots(await pageSignal("s-499", "لائحة 499")), { index: false, follow: true }, "L-19 noindex تحت الحد");
    eq(systemPageRobots(await pageSignal("s-500", "لائحة 500")), undefined, "L-20 يُفهرس عند الحد");
    eq(systemPageRobots(await pageSignal("s-card", "تنظيم ببطاقة")), undefined, "L-21 بطاقة طويلة: يُفهرس");
    eq(systemPageRobots(await pageSignal("s-cardshort", "لائحة بطاقتها قصيرة")), { index: false, follow: true }, "L-22 الصفحة تعرض البطاقة القصيرة: noindex");
    eq(systemPageRobots(await pageSignal("s-labor", "نظام العمل الاصطناعي")), undefined, "L-23 بمواد: يُفهرس");
    eq(await pageSignal("s-byname", "نظام مربوط بالاسم"), { articleCount: 1, textChars: 0 }, "L-24 مادة مربوطة بالاسم وحده تُعدّ (كشرط الصفحة)");
    for (const r of sysRows) {
      if (r.name === "نظام مربوط بالاسم") continue; // الخريطة تربط بالمعرّف (كل مواد الإنتاج لها legalSystemId)
      const id = systems.find(([, n]) => n === r.name)![0];
      eq(isSystemIndexable((await pageSignal(id, r.name))!), isSystemIndexable(r.signal), `L-25 الصفحة والخريطة متفقتان: ${r.name}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  indexabilityTests();
  sitemapPureTests();
  await routeTests();
  await wiringTests();
  await localDbTests();
  console.log(`test-seo-sitemap: OK (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
