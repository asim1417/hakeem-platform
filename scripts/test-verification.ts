// اختبار مرحلة التحقّق (المرحلة ٤) — نقيّ بلا قاعدة عبر حقن validator يؤصِّل كل ما يُمرَّر.
// يغطّي القبول: النطاق (صفر تسريب) · النفاذ (صفر لاغٍ) · التغطية (بوّابة النظامين) · التأريض.
import { runVerification, markCoverage, belongsToScope, describeVerification } from "@/lib/modules/agents/thinking/verification";
import type { CitationValidator } from "@/lib/modules/agents/thinking/verifier";
import type { QueryPlan } from "@/lib/modules/agents/thinking/planner";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

// validator يؤصِّل كل استشهاد (نعزل منطق النطاق/النفاذ/التغطية عن قاعدة البيانات).
const groundAll: CitationValidator = async (i) => ({
  ok: true as const,
  articleId: i.articleId ?? "x",
  systemName: i.systemName ?? "?",
  articleNumber: i.articleNumber ?? 0,
  citationLabel: `${i.systemName ?? "?"}، المادة ${i.articleNumber ?? 0}`,
});

function art(over: Partial<LegalCoreResult>): LegalCoreResult {
  return {
    articleId: "a", systemName: "نظام العمل", systemId: null, articleNumber: 1, articleTitle: "",
    articleText: "", classification: null, status: "سارية", chapter: null, relevanceReason: "",
    citationLabel: "", internalUrl: "", relevanceScore: 10, matchedTerms: [], matchedParagraphs: [],
    matchType: "general", snippet: "", conceptCoverage: 0, phraseMatches: 0, ...over,
  };
}

async function main() {
const REG = [{ id: "s-labor", name: "نظام العمل" }, { id: "s-civil", name: "نظام المعاملات المدنية" }];
const plan2: QueryPlan = {
  queryClass: "متعدّد_الأنظمة",
  targetSystems: REG,
  issues: [
    { id: "iss-1", label: "..", systemId: "s-labor", systemName: "نظام العمل", status: "pending" },
    { id: "iss-2", label: "..", systemId: "s-civil", systemName: "نظام المعاملات المدنية", status: "pending" },
  ],
};

// ── ① النطاق: مادة من نظام ثالث تُنفى ──
{
  const articles = [
    art({ articleId: "1", systemName: "نظام العمل", articleNumber: 10 }),
    art({ articleId: "2", systemName: "نظام المعاملات المدنية", articleNumber: 20 }),
    art({ articleId: "3", systemName: "نظام المرور", articleNumber: 30 }), // خارج النطاق
  ];
  const r = await runVerification({ articles, plan: plan2, validator: groundAll });
  check("النطاق: مادة نظام المرور تُنفى (صفر تسريب)", r.droppedOutOfScope === 1 && !r.verified.some((v) => v.systemName === "نظام المرور"));
  check("التغطية: النظامان مُجابان → البوّابة تمرّ", r.coverage.answered === 2 && r.coverage.gatePassed);
}

// ── ② النفاذ: مادة منسوخة تُسقَط ──
{
  const articles = [
    art({ articleId: "1", systemName: "نظام العمل", articleNumber: 10, status: "سارية" }),
    art({ articleId: "2", systemName: "نظام العمل", articleNumber: 11, status: "منسوخة" }), // لاغٍ
  ];
  const r = await runVerification({ articles, plan: undefined, validator: groundAll });
  check("النفاذ: المنسوخة تُسقَط (صفر لاغٍ يُقدَّم)", r.droppedRepealed === 1 && r.verified.length === 1);
}

// ── ③ التغطية: نظام بلا مادة → no_text، والبوّابة تبقى تُوسَم (لا pending) ──
{
  const articles = [art({ articleId: "1", systemName: "نظام العمل", articleNumber: 10 })]; // العمل فقط
  const r = await runVerification({ articles, plan: plan2, validator: groundAll });
  check("التغطية: نظام بلا مادة يُوسَم no_text", r.coverage.answered === 1 && r.coverage.noText === 1);
  check("البوّابة تمرّ (كل المسائل مُوسَّمة، لا pending)", r.coverage.gatePassed);
}

// ── belongsToScope / markCoverage نقيّان ──
check("belongsToScope بلا نطاق = صحيح", belongsToScope({ systemId: null, systemName: "أيّ نظام" }, []));
check("belongsToScope يطابق بالاسم المُطبَّع", belongsToScope({ systemId: null, systemName: "نظام العمل" }, REG));
check("markCoverage بلا خطة → لا مسائل، بوّابة تمرّ", (() => {
  const c = markCoverage(undefined, []);
  return c.issues.length === 0 && c.gatePassed;
})());
check("describeVerification يذكر التغطية", (() => {
  const r = markCoverage(plan2, []);
  return typeof r.answered === "number";
})());

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
