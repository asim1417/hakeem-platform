/**
 * HKM-062 — اختبار وحدة: تنظيف سؤال hakeem_search وتوسيعه (بلا قاعدة ولا شبكة).
 * التشغيل: npm run test:everyday-query
 */
import assert from "node:assert/strict";
import { queryStemVariants } from "../lib/modules/legal-core/arabic-morphology";
import { groupTerms, planQuery } from "../lib/mcp/query-plan";
import { dropRequestPhrases, queryKeywords } from "../lib/mcp/query-words";
import { fusionScore, WEIGHTS_DISTINCTIVE, WEIGHTS_WEAK_LEXICAL } from "../lib/mcp/search-fusion";
import { compileAny, matchesText, normalizeAr } from "../lib/mcp/tools/word-match";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}\n   ${e instanceof Error ? e.message : String(e)}`);
  }
}
const n = (s: string) => normalizeAr(s);
const group = (q: string, term: string) => {
  const g = planQuery(q).groups.find((x) => x.term === n(term));
  assert.ok(g, `لا مجموعة للفظ ${term} في «${q}»: ${planQuery(q).groups.map((x) => x.term).join("، ")}`);
  return g!;
};

// ── التنظيف ──
check("عبارة الطلب «ابحث لي عن» لا تدخل ألفاظ السؤال", () =>
  assert.deepEqual(queryKeywords("ابحث لي عن حق العامل اذا فصلوه بدون سبب"), ["حق", "العامل", "فصلوه", "بدون", "سبب"].map(n)));
check("«أبغى أعرف» و«كم» تُحذف", () => assert.deepEqual(queryKeywords("أبغى أعرف كم أجر الساعات الإضافية"), ["اجر", "الساعات", "الاضافيه"]));
check("«وش» و«أقدر» ألفاظ حوار لا موضوع", () => {
  assert.deepEqual(queryKeywords("وش عقوبة التفحيط"), ["عقوبه", "التفحيط"]);
  assert.deepEqual(queryKeywords("هل أقدر أستأنف حكم التحكيم"), ["استانف", "التحكيم"]);
});
check("السؤال الفصيح كما كان (اختبار HKM-044)", () =>
  assert.deepEqual(queryKeywords("كم مدة الاستئناف على الحكم في نظام المرافعات؟"), ["مده", "الاستيناف", "الحكم", "المرافعات"]));
check("حذف العبارة متتالية الكلمات فقط، والكلمة المفردة منها تبقى إن لم تكن حشوًا", () => {
  assert.deepEqual(dropRequestPhrases(["ابحث", "لي", "عن", "الغبن"]), ["الغبن"]);
  assert.deepEqual(dropRequestPhrases(["قل", "الغبن"]), ["قل", "الغبن"]);
});

// ── الصرف من جهة السؤال ──
check("الضمير المتصل في العامية: فصلوه ← فصل، يحجزوني ← حجز", () => {
  assert.ok(queryStemVariants(n("فصلوه")).includes("فصل"));
  assert.ok(queryStemVariants(n("يحجزوني")).includes("حجز"));
});
check("حرف المضارعة: تخصم ← خصم، أفسخ ← فسخ", () => {
  assert.ok(queryStemVariants(n("تخصم")).includes("خصم"));
  assert.ok(queryStemVariants(n("أفسخ")).includes("فسخ"));
});
check("الجمع السالم والتاء مع الضمير: إجازات ← إجازة، الموظفين ← موظف، زوجته ← زوجة", () => {
  assert.ok(queryStemVariants(n("إجازات")).includes(n("اجازة")));
  assert.ok(queryStemVariants(n("الموظفين")).includes("موظف"));
  assert.ok(queryStemVariants(n("زوجته")).includes(n("زوجة")));
});
check("ضمير الفاعل في الماضي وحرف العطف أو الجر المتصل ومؤنث النسبة", () => {
  assert.ok(queryStemVariants(n("تركت")).includes("ترك"));
  assert.ok(queryStemVariants(n("نفذوا")).includes("نفذ"));
  assert.ok(queryStemVariants(n("وتراجعت")).includes("تراجعت"));
  assert.ok(queryStemVariants(n("بصوري")).includes("صوري"));
  assert.ok(queryStemVariants(n("لاستخراج")).includes("استخراج"));
  assert.ok(queryStemVariants(n("نهائي")).includes(n("نهائية")));
  assert.equal(queryStemVariants(n("تجاري")).includes("جار"), false, "«تجاري» اسم لا فعل");
});
check("واو العطف مع الحشو حشو: «وعندي» و«وهي» لا تدخل الألفاظ", () => {
  assert.deepEqual(queryKeywords("تركت العمل وعندي إجازات"), ["تركت", "العمل", "اجازات"]);
  assert.deepEqual(queryKeywords("يفصل الموظفة وهي في إجازة"), ["يفصل", "الموظفه", "اجازه"]);
});
check("المدخل يُعرف من صورة اللفظ: «وتراجعت» ← العدول، و«تنشطب القضية» تبقي «القضية ← الدعوى»", () => {
  assert.ok(group("دفعت عربون وتراجعت عن الشراء", "وتراجعت").alts.includes(n("العدول")));
  const p = planQuery("هل تنشطب القضية");
  assert.ok(p.groups.find((x) => x.term === n("القضية"))!.alts.includes(n("الدعوى")));
});
check("لا صورة أقصر من ثلاثة أحرف، والكلمة القصيرة بلا صور", () => {
  assert.deepEqual(queryStemVariants(n("حق")), []);
  for (const w of ["فصلوه", "يحجزوني", "تخصم", "بالتقسيط", "قانوني"]) assert.ok(queryStemVariants(n(w)).every((v) => v.length >= 3), w);
});

// ── الجسر وجمع التكسير ──
check("«فصلوه» تطابق «فُسخ العقد» و«إنهاء» و«فُصل العامل»، لا «تفصيل»", () => {
  const g = group("حق العامل اذا فصلوه بدون سبب", "فصلوه");
  const c = compileAny(g.term, groupTerms(g))!;
  assert.ok(matchesText("لا يجوز لصاحب العمل فسخ العقد دون مكافأة", c));
  assert.ok(matchesText("إذا أنهي العقد لسبب غير مشروع", c));
  assert.ok(matchesText("إذا فُصل العامل", c));
  assert.equal(matchesText("وتحدد اللائحة تفصيل ذلك", c), false);
});
check("«مهلة» ← مدة/ميعاد، والنص الدلالي بلفظ النظام", () => {
  const p = planQuery("كم مهلة الاستئناف");
  const g = p.groups.find((x) => x.term === n("مهلة"))!;
  assert.ok(g.alts.includes(n("مدة")) && g.alts.includes(n("ميعاد")));
  assert.equal(p.semanticText, "كم مدة الاعتراض بطلب الاستئناف");
  assert.ok(p.bridged);
});
check("عبارة الطلب تخرج من النص الدلالي أيضًا", () => {
  assert.equal(planQuery("ابحث لي عن الغبن").semanticText, "الغبن");
  assert.equal(planQuery("وش عقوبة التفحيط").semanticText, "عقوبة التفحيط");
});
check("عبارة الجسر متعددة الكلمات: «الشرط الجزائي» ← التعويض الاتفاقي", () => {
  const p = planQuery("الشرط الجزائي في العقد");
  assert.ok(p.semanticText.startsWith("التعويض الاتفاقي"));
  assert.ok(p.groups.find((x) => x.term === n("الجزائي"))!.alts.includes(n("التعويض")));
});
check("مدخلان متجاوران لمفهوم واحد لا يكرران البديل: «رسائل الواتساب»", () => {
  const sem = planQuery("هل رسائل الواتساب دليل").semanticText;
  assert.equal(sem.split("الدليل الرقمي").length - 1, 1, sem);
});
check("جمع التكسير: «العقد» تطابق «العقود»، و«حقوقي» تطابق «الحق»", () => {
  const g = group("فسخ العقد", "العقد");
  assert.ok(matchesText("فسخ العقود الإدارية", compileAny(g.term, groupTerms(g))!));
  const h = group("وش حقوقي", "حقوقي");
  assert.ok(matchesText("ولصاحب البيانات الحق في العلم", compileAny(h.term, groupTerms(h))!));
});
check("السؤال النظامي لا يتغير نصه الدلالي: «ما هو التغرير في العقد»", () => {
  const p = planQuery("ما هو التغرير في العقد");
  assert.equal(p.semanticText, "ما هو التغرير في العقد");
  assert.deepEqual(p.groups.map((g) => g.term), ["التغرير", "العقد"]);
  assert.deepEqual(p.groups.flatMap((g) => g.alts), []);
});
check("bridge=false: ألفاظ نظيفة بلا صيغ ولا بدائل", () => {
  const p = planQuery("ابحث لي عن حق العامل اذا فصلوه", { bridge: false });
  assert.ok(p.groups.every((g) => g.forms.length === 0 && g.alts.length === 0));
  assert.equal(p.semanticText, "حق العامل اذا فصلوه");
});
check("compileAny: صيغة واحدة = compileTerm، ولا صيغ = null", () => {
  assert.equal(compileAny("x", []), null);
  const one = compileAny("الغبن", ["الغبن"])!;
  assert.ok(one.literal.length > 0 && matchesText("بالغبن", one));
});

// ── أوزان الدمج ──
check("بلا دليل لفظي مميِّز يُقدَّم المعنى، ومجموع الوزنين ثابت", () => {
  assert.equal(WEIGHTS_WEAK_LEXICAL.coverage + WEIGHTS_WEAK_LEXICAL.similarity, WEIGHTS_DISTINCTIVE.coverage + WEIGHTS_DISTINCTIVE.similarity);
  assert.ok(WEIGHTS_WEAK_LEXICAL.similarity > WEIGHTS_WEAK_LEXICAL.coverage);
  const semantic = { id: "a", coverage: 0.4, similarity: 0.62, lexicalHit: false, lawNamed: false };
  const wordy = { id: "b", coverage: 0.8, similarity: 0.5, lexicalHit: false, lawNamed: false };
  assert.ok(fusionScore(semantic, WEIGHTS_WEAK_LEXICAL) > fusionScore(wordy, WEIGHTS_WEAK_LEXICAL) - 0.1);
  assert.ok(fusionScore(wordy) > fusionScore(semantic));
});

if (failures) {
  console.error(`\n${failures} اختبار فشل`);
  process.exit(1);
}
console.log("\nكل اختبارات تنظيف السؤال وتوسيعه ناجحة");
