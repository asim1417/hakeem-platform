// ─────────────────────────────────────────────────────────────────────────────
// حزمة مطابقة HLS §8 (المرحلة ٧) — نقيّة بلا قاعدة، تُشغَّل بعد كل مرحلة كحارس.
// ترمّز الحالات الستّ فوق الدوالّ المؤصَّلة (planner/normative/verification/analysis):
//   ١ حصر في نظامين  ٢ سلطة تقديرية  ٣ نفاذ (صفر لاغٍ)  ٤ نطاق (صفر تسريب)
//   ٥ تأريض (صفر استشهاد غير مطابَق)  ٦ مرحلية (تحقّق لا يزيد المصادر).
// الأصل الحيّ (orchestrate على Neon) يُفحَص عبر eval:hls في CI.
// ─────────────────────────────────────────────────────────────────────────────
import { buildPlan, classifyQuery } from "@/lib/modules/agents/thinking/planner";
import { detectNormativeConcept } from "@/lib/modules/agents/substrate/normative";
import { runVerification } from "@/lib/modules/agents/thinking/verification";
import { hasAllSections, citedFootnotes } from "@/lib/modules/agents/thinking/analysis";
import type { CitationValidator } from "@/lib/modules/agents/thinking/verifier";
import type { QueryPlan } from "@/lib/modules/agents/thinking/planner";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

const REG = [
  { id: "s-labor", name: "نظام العمل" },
  { id: "s-civil", name: "نظام المعاملات المدنية" },
];
function art(over: Partial<LegalCoreResult>): LegalCoreResult {
  return {
    articleId: "a", systemName: "نظام العمل", systemId: null, articleNumber: 1, articleTitle: "",
    articleText: "", classification: null, status: "سارية", chapter: null, relevanceReason: "",
    citationLabel: "", internalUrl: "", relevanceScore: 10, matchedTerms: [], matchedParagraphs: [],
    matchType: "general", snippet: "", conceptCoverage: 0, phraseMatches: 0, ...over,
  };
}
// validator يؤصّل كل شيء إلا الأرقام الوهمية (9999) — لمحاكاة حجب المُختلَق.
const validator: CitationValidator = async (i) =>
  i.articleNumber === 9999
    ? { ok: false as const, message: "غير مؤصَّل" }
    : { ok: true as const, articleId: i.articleId ?? "x", systemName: i.systemName ?? "?", articleNumber: i.articleNumber ?? 0, citationLabel: `${i.systemName}، م${i.articleNumber}` };

async function main() {
  // ── الحالة ١: حصر المدد في نظامين → مسألتان (نظامان معًا، تتبُّع مستقلّ) ──
  const plan1 = buildPlan("احصر كل المدد في نظام العمل ونظام المعاملات المدنية", REG);
  check("① حصر في نظامين → مسألتان مستقلّتان", plan1.issues.length === 2 && new Set(plan1.issues.map((i) => i.systemId)).size === 2);
  const r1 = await runVerification({
    articles: [art({ articleId: "1", systemName: "نظام العمل", articleNumber: 10 }), art({ articleId: "2", systemName: "نظام المعاملات المدنية", articleNumber: 20 })],
    plan: plan1,
    validator,
  });
  check("① النظامان مُجابان معًا (تغطية كاملة)", r1.coverage.answered === 2 && r1.coverage.gatePassed);

  // ── الحالة ٢: السلطة التقديرية → حصر مفهوميّ مُصنَّف (رخصة_تقديرية/المحكمة) ──
  const c2 = detectNormativeConcept("ما هي مواد السلطة التقديرية للمحكمة في نظام المعاملات المدنية؟");
  const cls2 = classifyQuery("ما هي كل مواد السلطة التقديرية للمحكمة؟", REG).queryClass;
  check("② السلطة التقديرية → رخصة_تقديرية/المحكمة + تصنيف حصر مفهوميّ", c2?.modality === "رخصة_تقديرية" && c2?.addressee === "المحكمة" && cls2 === "حصر_مفهوميّ");

  // ── الحالة ٣: النفاذ → صفر لاغٍ يُقدَّم ──
  const r3 = await runVerification({
    articles: [art({ articleId: "1", articleNumber: 10, status: "سارية" }), art({ articleId: "2", articleNumber: 11, status: "منسوخة" })],
    validator,
  });
  check("③ النفاذ: صفر مادة لاغية في المُتحقَّق", r3.droppedRepealed === 1 && r3.verified.every((v) => v.status !== "منسوخة"));

  // ── الحالة ٤: النطاق → صفر تسريب ──
  const r4 = await runVerification({
    articles: [art({ articleId: "1", systemName: "نظام العمل", articleNumber: 10 }), art({ articleId: "9", systemName: "نظام المرور", articleNumber: 90 })],
    plan: { queryClass: "بحث_مركّز", targetSystems: [REG[0]], issues: [] } as QueryPlan,
    validator,
  });
  check("④ النطاق: صفر تسريب من نظام آخر", r4.droppedOutOfScope === 1 && r4.verified.every((v) => v.systemName === "نظام العمل"));

  // ── الحالة ٥: التأريض → صفر استشهاد غير مطابَق ──
  const r5 = await runVerification({
    articles: [art({ articleId: "1", articleNumber: 10 }), art({ articleId: "F", articleNumber: 9999 })], // 9999 مُختلَق
    validator,
  });
  check("⑤ التأريض: المُختلَق يُحجَب (صفر غير مطابَق)", r5.blocked === 1 && r5.verified.every((v) => v.articleNumber !== 9999));
  // ذيول الجواب ⊆ لوحة الأساس (فحص بنية الصياغة المنسوبة).
  const answer = "تحرير المسألة [1]. الأنظمة والاتجاهات وأسانيدها [2]. الدفوع المتقابلة. الحكم النظاميّ المطبَّق [1]. الأثر العمليّ.";
  const basisSize = 2;
  check("⑤ ذيول [n] ⊆ لوحة الأساس + بنية مكتملة", hasAllSections(answer) && citedFootnotes(answer).every((n) => n >= 1 && n <= basisSize));

  // ── الحالة ٦: المرحلية → التحقّق لا يزيد المصادر ──
  const inputArticles = [art({ articleId: "1", articleNumber: 10 }), art({ articleId: "2", articleNumber: 11 }), art({ articleId: "3", articleNumber: 12 })];
  const r6 = await runVerification({ articles: inputArticles, validator });
  check("⑥ المرحلية: التحقّق لا يزيد المصادر", r6.verified.length <= inputArticles.length);

  console.log(`\n══════════ مطابقة HLS §8 ══════════`);
  console.log(`نتيجة: ${pass}/${pass + fail} حالة نجحت`);
  console.log(`════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
