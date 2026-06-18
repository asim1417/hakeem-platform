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

async function ensureIndex(url: string, headers: Record<string, string>, index: string) {
  const head = await fetch(`${url}/${index}`, { method: "HEAD", headers }).catch(() => null);
  if (head && head.ok) return;
  await fetch(`${url}/${index}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      mappings: {
        properties: {
          type: { type: "keyword" },
          id: { type: "keyword" },
          title: { type: "text" },
          content: { type: "text" },
          judgmentTitle: { type: "text" },
          judgmentText: { type: "text" },
          principleText: { type: "text" },
          lawName: { type: "text" },
          articleNumber: { type: "integer" },
          court: { type: "keyword" },
        },
      },
    }),
  });
  console.log(`  ✓ فهرس مُجهّز: ${index}`);
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

  await ensureIndex(cfg.url, headers, cfg.indexArticles);
  await ensureIndex(cfg.url, headers, cfg.indexCases);

  // المواد
  const articles = await prisma.legalArticle.findMany({
    select: { id: true, title: true, content: true, lawName: true, articleNumber: true },
    take,
  });
  await bulkIndex(
    cfg.url,
    headers,
    cfg.indexArticles,
    articles.map((a) => ({ type: "article", id: a.id, title: a.title, content: a.content, lawName: a.lawName, articleNumber: a.articleNumber }))
  );
  console.log(`  ✓ مواد: ${articles.length}`);

  // الأحكام
  const rulings = await prisma.judicialCase.findMany({
    select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true },
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
    }))
  );
  console.log(`  ✓ أحكام: ${rulings.length}`);

  // المبادئ (في فهرس الأحكام)
  const principles = await prisma.judicialPrinciple.findMany({
    select: { id: true, title: true, principleText: true },
    take,
  });
  await bulkIndex(
    cfg.url,
    headers,
    cfg.indexCases,
    principles.map((p) => ({ type: "principle", id: p.id, title: p.title, principleText: p.principleText }))
  );
  console.log(`  ✓ مبادئ: ${principles.length}`);

  await prisma.$disconnect();
  console.log("✅ اكتملت الفهرسة المبدئية.");
}

main().catch((e) => {
  console.error("❌ فشل الفهرسة:", e instanceof Error ? e.message : e);
  process.exit(1);
});
