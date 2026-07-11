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
  },
  analyzer: {
    hakeem_arabic: { type: "custom", tokenizer: "standard", filter: ["decimal_digit", "arabic_normalization", "lowercase", "arabic_stop", "arabic_stem"] },
    hakeem_arabic_exact: { type: "custom", tokenizer: "standard", filter: ["decimal_digit", "arabic_normalization", "lowercase"] },
  },
} as const;

const TEXT_AR = { type: "text", analyzer: "hakeem_arabic" } as const;
const TEXT_AR_EXACT = { type: "text", analyzer: "hakeem_arabic", fields: { exact: { type: "text", analyzer: "hakeem_arabic_exact" } } } as const;

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

  // الأحكام
  const rulings = await prisma.judicialCase.findMany({
    select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true, reviewStatus: true },
    take,
  });
  await bulkIndex(
    cfg.url,
    headers,
    cfg.indexCases,
    rulings.map((r) => ({
      type: "ruling",
      id: r.id,
      judgmentTitle: r.judgmentTitle ?? r.decisionNo ?? r.caseNo,
      judgmentText: (r.judgmentText ?? "").slice(0, 8000),
      court: r.court,
      status: r.reviewStatus,
    }))
  );
  console.log(`  ✓ أحكام: ${rulings.length}`);

  // المبادئ (في فهرس الأحكام)
  const principles = await prisma.judicialPrinciple.findMany({
    select: { id: true, title: true, principleText: true, reviewStatus: true },
    take,
  });
  await bulkIndex(
    cfg.url,
    headers,
    cfg.indexCases,
    principles.map((p) => ({ type: "principle", id: p.id, title: p.title, principleText: p.principleText, status: p.reviewStatus }))
  );
  console.log(`  ✓ مبادئ: ${principles.length}`);

  await prisma.$disconnect();
  console.log("✅ اكتملت الفهرسة المبدئية.");
}

main().catch((e) => {
  console.error("❌ فشل الفهرسة:", e instanceof Error ? e.message : e);
  process.exit(1);
});
