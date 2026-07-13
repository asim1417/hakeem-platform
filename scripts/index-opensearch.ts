/**
 * فهرسة مبدئية لبيانات حكيم في OpenSearch/Elasticsearch.
 * يفهرس: LegalArticle, JudicialCase, JudicialPrinciple.
 *
 * التشغيل:
 *   npm run index:opensearch            (عيّنة ~200 من كل نوع)
 *   npm run index:opensearch -- --all   (الكل — local/dev فقط)
 *
 * يتطلّب OPENSEARCH_URL (+ اعتماد اختياري). قراءة فقط من القاعدة؛ يكتب في OpenSearch.
 */
import { prisma } from "@/lib/prisma";
import { getOpenSearchConfig, openSearchHeaders } from "@/lib/modules/legal-search/providers/search-provider";

const SCOPE_ALL = process.argv.includes("--all");
const SAMPLE = 200;

// إعدادات المحلّل العربي (بلا إضافات خارجية): arabic_normalization يوحّد إ/أ/آ→ا،
// ة→ه، ى→ي ويجرّد التشكيل؛ decimal_digit يوحّد ٠١٢٣→0123. hakeem_arabic مع تجذيع
// (توسّع أذكى)، وhakeem_arabic_exact بلا تجذيع (مطابقة أدقّ في الحقل .exact).
const ANALYSIS = {
  filter: {
    arabic_stop: { type: "stop", stopwords: "_arabic_" },
    arabic_stem: { type: "stemmer", language: "arabic" },
    // [طبقة العبارات] عبارات متلاصقة ثنائية (bigrams) فقط — لمطابقة المصطلح القانوني كوحدة
    // («فسخ العقد» لا «فسخ»…«عقد» متناثرتين). output_unigrams=false: الحقل .phrase عبارات فقط.
    legal_shingle: { type: "shingle", min_shingle_size: 2, max_shingle_size: 2, output_unigrams: false },
  },
  analyzer: {
    hakeem_arabic: { type: "custom", tokenizer: "standard", filter: ["decimal_digit", "arabic_normalization", "lowercase", "arabic_stop", "arabic_stem"] },
    hakeem_arabic_exact: { type: "custom", tokenizer: "standard", filter: ["decimal_digit", "arabic_normalization", "lowercase"] },
    // محلّل العبارات: نفس السلسلة + shingle في النهاية (تجذيع ثم تلاصق) للحقل الفرعي .phrase.
    hakeem_arabic_shingle: { type: "custom", tokenizer: "standard", filter: ["decimal_digit", "arabic_normalization", "lowercase", "arabic_stop", "arabic_stem", "legal_shingle"] },
  },
} as const;

// حقل نصّي عربي + حقل فرعي .phrase (عبارات متلاصقة) لرفع دقّة المصطلحات المركّبة.
const TEXT_AR = { type: "text", analyzer: "hakeem_arabic", fields: { phrase: { type: "text", analyzer: "hakeem_arabic_shingle" } } } as const;
const TEXT_AR_EXACT = { type: "text", analyzer: "hakeem_arabic", fields: { exact: { type: "text", analyzer: "hakeem_arabic_exact" }, phrase: { type: "text", analyzer: "hakeem_arabic_shingle" } } } as const;

const ARTICLE_INDEX_BODY = {
  settings: { index: { number_of_shards: 1, number_of_replicas: 0 }, analysis: ANALYSIS },
  mappings: {
    properties: {
      type: { type: "keyword" },
      id: { type: "keyword" },
      articleId: { type: "keyword" },
      lawName: { type: "text", analyzer: "hakeem_arabic", fields: { exact: { type: "text", analyzer: "hakeem_arabic_exact" }, keyword: { type: "keyword" } } },
      articleNumber: { type: "integer" },
      title: TEXT_AR,
      content: TEXT_AR_EXACT,
      classification: { type: "keyword" },
      eliSlug: { type: "keyword" },
      status: { type: "keyword" },
    },
  },
};

const CASE_INDEX_BODY = {
  settings: { index: { number_of_shards: 1, number_of_replicas: 0 }, analysis: ANALYSIS },
  mappings: {
    properties: {
      type: { type: "keyword" },
      id: { type: "keyword" },
      title: TEXT_AR,
      judgmentTitle: TEXT_AR,
      judgmentText: TEXT_AR,
      principleText: TEXT_AR,
      court: { type: "keyword" },
      status: { type: "keyword" },
    },
  },
};

async function ensureIndex(url: string, headers: Record<string, string>, index: string, body: unknown) {
  const head = await fetch(`${url}/${index}`, { method: "HEAD", headers }).catch(() => null);
  if (head && head.ok) return;
  const res = await fetch(`${url}/${index}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`تعذّر إنشاء الفهرس ${index}: ${res.status} ${await res.text().catch(() => "")}`);
  console.log(`  ✓ فهرس مُجهّز بمحلّل عربي: ${index}`);
}

async function bulkIndex(url: string, headers: Record<string, string>, index: string, docs: Array<Record<string, unknown>>) {
  if (docs.length === 0) return;
  const lines: string[] = [];
  for (const d of docs) {
    lines.push(JSON.stringify({ index: { _index: index, _id: `${d.type}:${d.id}` } }));
    lines.push(JSON.stringify(d));
  }
  const res = await fetch(`${url}/_bulk`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/x-ndjson" },
    body: lines.join("\n") + "\n",
  });
  if (!res.ok) throw new Error(`bulk فشل: ${res.status}`);
}

// فهرسة مرنة لنطاق [skip, skip+take): عند فشل جلب/تحويل صفّ تالف الترميز
// (خطأ Prisma «rust String into napi») يُقسَّم النطاق حتى يُعزَل الصفّ المعيب
// ويُتخطّى وحده — فتكتمل فهرسة بقيّة الصفوف بدل تعطّل المهمّة كلّها.
// يعيد [عدد المفهرَس, عدد المتخطّى].
async function resilientRange<T extends { id: string }>(
  url: string,
  headers: Record<string, string>,
  index: string,
  fetch: (skip: number, take: number) => Promise<T[]>,
  toDoc: (row: T) => Record<string, unknown>,
  skip: number,
  take: number
): Promise<[number, number]> {
  try {
    const rows = await fetch(skip, take);
    await bulkIndex(url, headers, index, rows.map(toDoc));
    return [rows.length, 0];
  } catch (e) {
    if (take <= 1) {
      console.warn(`  ⚠️ تخطّي صفّ تالف الترميز عند skip=${skip}`);
      return [0, 1];
    }
    const half = Math.floor(take / 2);
    const [a, sa] = await resilientRange(url, headers, index, fetch, toDoc, skip, half);
    const [b, sb] = await resilientRange(url, headers, index, fetch, toDoc, skip + half, take - half);
    return [a + b, sa + sb];
  }
}

async function main() {
  const cfg = getOpenSearchConfig();
  if (!cfg) {
    console.error("❌ OPENSEARCH_URL غير مضبوط — لا فهرسة.");
    process.exit(1);
  }
  const headers = openSearchHeaders(cfg);
  const take = SCOPE_ALL ? undefined : SAMPLE;
  console.log(`🔎 فهرسة OpenSearch (${SCOPE_ALL ? "الكل" : `عيّنة ${SAMPLE}`}) → ${cfg.url}`);

  await ensureIndex(cfg.url, headers, cfg.indexArticles, ARTICLE_INDEX_BODY);
  await ensureIndex(cfg.url, headers, cfg.indexCases, CASE_INDEX_BODY);

  // المواد (مع التصنيف والحالة وslug التشريعي للترشيح والإسناد)
  const articles = await prisma.legalArticle.findMany({
    select: { id: true, title: true, content: true, lawName: true, articleNumber: true, classification: true, status: true, legalSystem: { select: { eliSlug: true } } },
    take,
  });
  await bulkIndex(
    cfg.url,
    headers,
    cfg.indexArticles,
    articles.map((a) => ({ type: "article", id: a.id, articleId: a.id, title: a.title, content: a.content, lawName: a.lawName, articleNumber: a.articleNumber, classification: a.classification, status: a.status, eliSlug: a.legalSystem?.eliSlug ?? null }))
  );
  console.log(`  ✓ مواد: ${articles.length}`);

  // الأحكام — فهرسة مرنة بدفعات (تتخطّى الصفوف التالفة الترميز بدل تعطّل المهمّة).
  const BATCH = 500;
  try {
    const rulingTotal = SCOPE_ALL ? await prisma.judicialCase.count() : SAMPLE;
    let ri = 0, rs = 0;
    for (let off = 0; off < rulingTotal; off += BATCH) {
      const [i, s] = await resilientRange(
        cfg.url, headers, cfg.indexCases,
        (skip, take) => prisma.judicialCase.findMany({
          select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true, reviewStatus: true },
          orderBy: { id: "asc" }, skip, take,
        }),
        (r) => ({ type: "ruling", id: r.id, judgmentTitle: r.judgmentTitle ?? r.decisionNo ?? r.caseNo, judgmentText: (r.judgmentText ?? "").slice(0, 20000), court: r.court, status: r.reviewStatus }),
        off, Math.min(BATCH, rulingTotal - off)
      );
      ri += i; rs += s;
    }
    console.log(`  ✓ أحكام: ${ri}${rs ? ` (تخطّي ${rs} تالف)` : ""}`);
  } catch (e) {
    console.warn(`  ⚠️ تعذّرت فهرسة الأحكام كلّيًّا: ${e instanceof Error ? e.message : e}`);
  }

  // المبادئ (في فهرس الأحكام) — فهرسة مرنة مماثلة.
  try {
    const principleTotal = SCOPE_ALL ? await prisma.judicialPrinciple.count() : SAMPLE;
    let pi = 0, ps = 0;
    for (let off = 0; off < principleTotal; off += BATCH) {
      const [i, s] = await resilientRange(
        cfg.url, headers, cfg.indexCases,
        (skip, take) => prisma.judicialPrinciple.findMany({
          select: { id: true, title: true, principleText: true, reviewStatus: true },
          orderBy: { id: "asc" }, skip, take,
        }),
        (p) => ({ type: "principle", id: p.id, title: p.title, principleText: p.principleText, status: p.reviewStatus }),
        off, Math.min(BATCH, principleTotal - off)
      );
      pi += i; ps += s;
    }
    console.log(`  ✓ مبادئ: ${pi}${ps ? ` (تخطّي ${ps} تالف)` : ""}`);
  } catch (e) {
    console.warn(`  ⚠️ تعذّرت فهرسة المبادئ كلّيًّا: ${e instanceof Error ? e.message : e}`);
  }

  await prisma.$disconnect();
  console.log("✅ اكتملت الفهرسة المبدئية.");
}

main().catch((e) => {
  console.error("❌ فشل الفهرسة:", e instanceof Error ? e.message : e);
  process.exit(1);
});
