// تقييم فعالية الوكلاء — يشغّل المنسّق (deep) على أسئلة مرجعية ويقيس:
// النيّة · استدعاء الاسترجاع · الامتناع · اكتمال الحصر · **التأصيل (كل مادة مستشهَد بها في التحليل
// موجودة ضمن المُسترجَع — لا هلوسة)**. قراءة على القاعدة الحيّة (+ نموذج إن توفّر مفتاحه).
import { orchestrate } from "@/lib/modules/agents/orchestrator";
import { prisma } from "@/lib/prisma";

type Kind = "greeting" | "thanks" | "meta" | "non_legal" | "legal" | "enumeration";
interface Case { q: string; kind: Kind; minArticles?: number }

const CASES: Case[] = [
  { q: "السلام عليكم", kind: "greeting" },
  { q: "شكراً جزيلاً", kind: "thanks" },
  { q: "من أنت وماذا تفعل؟", kind: "meta" },
  { q: "ما هي وصفة الكبسة؟", kind: "non_legal" },
  { q: "شروط فسخ عقد الإيجار", kind: "legal", minArticles: 3 },
  { q: "التعويض عن الضرر في المعاملات المدنية", kind: "legal", minArticles: 3 },
  { q: "مسؤولية الشريك في نظام الشركات", kind: "legal", minArticles: 3 },
  { q: "أركان عقد البيع", kind: "legal", minArticles: 3 },
  { q: "اريد كل المدد في نظام المعاملات المدنية", kind: "enumeration" },
];

const NON_LEGAL_KINDS: Kind[] = ["greeting", "thanks", "meta", "non_legal"];
const intentExpect: Record<Kind, string> = {
  greeting: "greeting", thanks: "thanks", meta: "meta", non_legal: "non_legal",
  legal: "legal_question", enumeration: "legal_question",
};

function citedNumbers(text: string): number[] {
  const s = new Set<number>();
  for (const m of text.matchAll(/الماد[ةه]\s*\(?\s*([0-9]{1,4}|[٠-٩]{1,4})/g)) {
    const n = Number(m[1].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()));
    if (n > 0) s.add(n);
  }
  return [...s];
}
function tableRows(text: string): number { return (text.match(/\n\s*\|\s*م\s/g) || []).length; }

async function main() {
  let intentOk = 0, retrievalOk = 0, abstainOk = 0, enumOk = 0, enumRows = 0;
  let groundedOk = 0, groundedTotal = 0, analysisProduced = 0;
  const legalN = CASES.filter((c) => c.kind === "legal").length;
  const abstainN = CASES.filter((c) => NON_LEGAL_KINDS.includes(c.kind)).length;

  console.log("q\tintent\tarticles\tanalysis\tnotes");
  for (const c of CASES) {
    let r;
    try { r = await orchestrate(c.q, { mode: "deep" }); }
    catch (e) { console.log(`${c.q}\tERROR\t${(e as Error).message}`); continue; }

    if (r.intent === intentExpect[c.kind]) intentOk++;
    if (NON_LEGAL_KINDS.includes(c.kind) && r.articles.length === 0 && r.reply) abstainOk++;
    if (c.kind === "legal") {
      if (r.articles.length >= (c.minArticles ?? 1)) retrievalOk++;
      if (r.analysis) {
        analysisProduced++;
        const retrieved = new Set(r.articles.map((a) => Number(a.articleNumber)));
        for (const n of citedNumbers(r.analysis)) { groundedTotal++; if (retrieved.has(n)) groundedOk++; }
      }
    }
    if (c.kind === "enumeration") {
      const rows = r.analysis ? tableRows(r.analysis) : 0;
      enumRows = rows;
      if (rows >= 5) enumOk++;
    }
    console.log(`${c.q.slice(0, 34)}\t${r.intent}\t${r.articles.length}\t${r.analysis ? "yes" : "no"}\t${r.analysis ? tableRows(r.analysis) + "rows" : ""}`);
  }

  console.log("\n══════════ فعالية الوكلاء ══════════");
  console.log(`① النيّة الصحيحة        = ${intentOk}/${CASES.length}`);
  console.log(`② الامتناع (غير قانوني)  = ${abstainOk}/${abstainN}`);
  console.log(`③ الاسترجاع (قانوني≥حد) = ${retrievalOk}/${legalN}`);
  console.log(`④ الحصر (جدول≥5 صفوف)   = ${enumOk}/1  (صفوف=${enumRows})`);
  console.log(`⑤ التحليل أُنتج          = ${analysisProduced}/${legalN}${analysisProduced ? "" : "  (النموذج offline في CI؟)"}`);
  console.log(`⑥ التأصيل (مستشهَد⊆مُسترجَع، صفر هلوسة) = ${groundedTotal ? `${groundedOk}/${groundedTotal}` : "N/A (لا تحليل)"}`);
  console.log("════════════════════════════════════");
  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
