/**
 * eval-rulings-semantic — قراءة فقط: البحث في الأحكام لفظيًّا وحده مقابل اللفظي + المعنى
 * (متجهات الأسباب والمنطوق). المستودع عام: أعداد فقط، بلا نصوص ولا معرّفات.
 *   DATABASE_URL=… EMBEDDING_API_KEY=… npx tsx scripts/eval-rulings-semantic.ts reports/rulings-semantic-eval.json
 * الصلة الفعلية للنتائج لا تُقاس هنا: تحتاج مراجعًا قانونيًّا على العيّنة الذهبية.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { searchRulingsDirect, semanticRulingCandidates } from "../lib/modules/legal-core/rulings-search";

// ألفاظ قصيرة، ثم أسئلة بلغة المحامي (حيث يُنتظر أن يضيف المعنى ما لا يجده اللفظ).
const QUERIES = [
  "فسخ", "الغبن الفاحش", "الشرط الجزائي", "القوة القاهرة", "التقادم", "الشفعة", "اليمين الحاسمة", "أجرة المثل",
  "المدين يدعي أنه وفى الدين بعد ثبوته",
  "تأخر المقاول في تسليم المشروع وطلب صاحب العمل التعويض",
  "الشريك انسحب من الشركة ويطالب بحصته من الأرباح",
  "المستأجر امتنع عن دفع الأجرة بسبب عيب في العين المؤجرة",
  "البائع أخفى عيبًا في السلعة والمشتري يطلب الرد",
  "رفض الدعوى لعدم تقديم المدعي بينة على دعواه",
  "الدائرة غير مختصة نوعيًّا بنظر النزاع",
  "شيك بدون رصيد والمدعى عليه يدفع بأنه ضمان",
  "إنهاء عقد الوكالة التجارية دون سبب مشروع",
  "الكفيل يطالب بالرجوع على المدين الأصلي بما دفعه",
];
const PREAMBLE = /^(?:…)?\s*(?:بسم\s*الله|الحمد\s*لله|الحمدلله|الحمد)/;

async function run(q: string, semantic: boolean) {
  process.env.RULINGS_SEMANTIC = semantic ? "on" : "off";
  const t = Date.now();
  const r = await searchRulingsDirect({ query: q, limit: 10, semantic }).catch(() => ({ hits: [] as Awaited<ReturnType<typeof searchRulingsDirect>>["hits"] }));
  const by: Record<string, number> = {};
  const inPart: Record<string, number> = {};
  for (const h of r.hits) {
    by[h.matchedBy ?? "lexical"] = (by[h.matchedBy ?? "lexical"] ?? 0) + 1;
    inPart[h.matchedIn ?? "none"] = (inPart[h.matchedIn ?? "none"] ?? 0) + 1;
  }
  return {
    returned: r.hits.length, ms: Date.now() - t, matchedBy: by, matchedIn: inPart,
    preambleSnippets: r.hits.filter((h) => PREAMBLE.test(h.snippet.trim())).length,
  };
}

async function main() {
  const [ro] = await prisma.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
  if (ro?.transaction_read_only !== "on") {
    console.error("الجلسة ليست للقراءة فقط — أوقفتُ التشغيل.");
    process.exit(3);
  }
  const [cov] = await prisma.$queryRawUnsafe<Array<{ chunks: bigint; rulings: bigint }>>(
    `SELECT count(*)::bigint AS chunks, count(DISTINCT ruling_id)::bigint AS rulings FROM ruling_segment_embeddings`);
  const rows: Array<{ q: string; kind: string; lexical: Awaited<ReturnType<typeof run>>; semantic: Awaited<ReturnType<typeof run>>; simStats: Record<string, unknown> }> = [];
  for (const [i, q] of QUERIES.entries()) {
    const lexical = await run(q, false);
    const both = await run(q, true);
    // توزيع التشابه لأقرب ٦٠ جزءًا (أفضل جزء لكل حكم) — لضبط العتبة بالأرقام.
    process.env.RULINGS_SEMANTIC = "on";
    const sims = (await semanticRulingCandidates(q, 0).catch(() => [])).map((c) => c.sim).sort((a, b) => b - a);
    const r2 = (x: number | undefined) => (x === undefined ? null : Math.round(x * 1000) / 1000);
    const simStats = {
      top1: r2(sims[0]), top10: r2(sims[9]), median: r2(sims[Math.floor(sims.length / 2)]),
      atLeast: Object.fromEntries([0.3, 0.35, 0.4, 0.45, 0.5].map((t) => [t, sims.filter((x) => x >= t).length])),
    };
    rows.push({ q: i < 8 ? q : `سؤال ${i - 7}`, kind: i < 8 ? "term" : "question", lexical, semantic: both, simStats });
    console.log(`• ${i + 1}/${QUERIES.length}`);
  }
  const agg = (kind: string) => {
    const rs = rows.filter((r) => r.kind === kind);
    const s = (f: (r: (typeof rows)[number]) => number) => rs.reduce((a, r) => a + f(r), 0);
    return {
      queries: rs.length,
      lexical: { withResults: rs.filter((r) => r.lexical.returned > 0).length, returned: s((r) => r.lexical.returned) },
      withSemantic: {
        withResults: rs.filter((r) => r.semantic.returned > 0).length,
        returned: s((r) => r.semantic.returned),
        semanticOnly: s((r) => r.semantic.matchedBy.semantic ?? 0),
        both: s((r) => r.semantic.matchedBy.both ?? 0),
        preambleSnippets: s((r) => r.semantic.preambleSnippets),
        maxMs: Math.max(...rs.map((r) => r.semantic.ms)),
      },
    };
  };
  const summary = {
    vectors: { chunks: Number(cov?.chunks ?? 0), rulings: Number(cov?.rulings ?? 0) },
    terms: agg("term"), questions: agg("question"),
  };
  // نص الأسئلة الطويلة لا يُودَع (يكفي ترقيمها)؛ الألفاظ القصيرة مذكورة.
  writeFileSync(process.argv[2] ?? "reports/rulings-semantic-eval.json", JSON.stringify({ measuredAt: new Date().toISOString(), summary, rows }, null, 2));
  console.log(JSON.stringify(summary));
}

main()
  .catch((e) => {
    console.error("فشل:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
