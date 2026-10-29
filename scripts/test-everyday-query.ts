/**
 * HKM-062 — اختبار وحدة: تنظيف سؤال hakeem_search وتوسيعه (بلا قاعدة ولا شبكة).
 * التشغيل: npm run test:everyday-query
 */
import assert from "node:assert/strict";
import { queryStemVariants } from "../lib/modules/legal-core/arabic-morphology";
import { explicitArticleCitation } from "../lib/mcp/article-citation";
import { groupTerms, planQuery, probeTerms } from "../lib/mcp/query-plan";
import { dropRequestPhrases, hasColloquialMarker, queryKeywords } from "../lib/mcp/query-words";
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
const full = { full: true } as const;
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
check("الضمير المتصل في العامية (الوضع الكامل): فصلوه ← فصل، يحجزونه ← حجز", () => {
  assert.ok(queryStemVariants(n("فصلوه"), full).includes("فصل"));
  assert.ok(queryStemVariants(n("يحجزونه"), full).includes("يحجزون"));
});
check("حرف المضارعة (الوضع الكامل): تخصم ← خصم، أفسخ ← فسخ؛ لا في الاسم بالتاء المربوطة", () => {
  assert.ok(queryStemVariants(n("تخصم"), full).includes("خصم"));
  assert.ok(queryStemVariants(n("أفسخ"), full).includes("فسخ"));
  assert.equal(queryStemVariants(n("أجرة"), full).includes(n("جرة")), false, "«أجرة» اسم");
});
check("الجمع السالم والتاء مع الضمير (الوضع الكامل): إجازات ← إجازة، الموظفين ← موظف، زوجته ← زوجة", () => {
  assert.ok(queryStemVariants(n("إجازات"), full).includes(n("اجازة")));
  assert.ok(queryStemVariants(n("الموظفين"), full).includes("موظف"));
  assert.ok(queryStemVariants(n("زوجته"), full).includes(n("زوجة")));
});
check("ضمير الفاعل في الماضي وحرف العطف أو الجر المتصل (الوضع الكامل)، ومؤنث النسبة (كل وضع)", () => {
  assert.ok(queryStemVariants(n("تركت"), full).includes("ترك"));
  assert.ok(queryStemVariants(n("نفذوا"), full).includes("نفذ"));
  assert.ok(queryStemVariants(n("وتراجعت"), full).includes("تراجعت"));
  assert.ok(queryStemVariants(n("بصوري"), full).includes("صوري"));
  assert.ok(queryStemVariants(n("لاستخراج"), full).includes("استخراج"));
  assert.ok(queryStemVariants(n("نهائي")).includes(n("نهائية")));
  assert.equal(queryStemVariants(n("تجاري"), full).includes("جار"), false, "«تجاري» اسم لا فعل");
});
check("الوضع المحافظ (السؤال الفصيح): سابقة «ال» المركبة ومؤنث النسبة وحدهما", () => {
  assert.deepEqual(queryStemVariants(n("بالتقسيط")), [n("تقسيط")]);
  assert.deepEqual(queryStemVariants(n("التأمين")), [], "لا «تام» من «التأمين»");
  assert.deepEqual(queryStemVariants(n("تركة")), [], "لا «ترك» من «تركة»");
  for (const w of ["يمين", "أمين", "أجرة", "البيانات", "فصلوه", "تخصم"]) assert.deepEqual(queryStemVariants(n(w)), [], w);
});
check("الياء الأخيرة في كلمة من أربعة أحرف فأكثر لا تُجرَّد إلا إلى صورة معروفة (مراجعة الجودة)", () => {
  const none = (w: string, bad: string) => assert.equal(queryStemVariants(n(w), full).includes(n(bad)), false, `${w} ← ${bad}`);
  none("مادي", "ماد");
  none("رسمي", "رسم");
  none("عيني", "عين");
  none("نهائي", "نهاي");
  none("قانوني", "قانون");
  none("يطالبني", "يطالب");
  assert.ok(queryStemVariants(n("حقوقي"), { full: true, known: (s) => s === "حقوق" }).includes("حقوق"));
});
check("واو العطف مع الحشو حشو: «وعندي» و«وهي» لا تدخل الألفاظ", () => {
  assert.deepEqual(queryKeywords("تركت العمل وعندي إجازات"), ["تركت", "العمل", "اجازات"]);
  assert.deepEqual(queryKeywords("يفصل الموظفة وهي في إجازة"), ["يفصل", "الموظفه", "اجازه"]);
});
check("المدخل يُعرف من صورة اللفظ: «وتراجعت» ← العدول، و«تنشطب القضية» (دارج) تبقي «القضية ← الدعوى»", () => {
  assert.ok(group("دفعت عربون وتراجعت عن الشراء", "وتراجعت").alts.includes(n("العدول")));
  const p = planQuery("هل تنشطب القضية");
  assert.ok(p.colloquial);
  assert.ok(p.groups.find((x) => x.term === n("القضية"))!.alts.includes(n("الدعوى")));
});
check("لا صورة أقصر من ثلاثة أحرف، والكلمة القصيرة بلا صور", () => {
  assert.deepEqual(queryStemVariants(n("حق"), full), []);
  for (const w of ["فصلوه", "يحجزوني", "تخصم", "بالتقسيط", "قانوني"]) assert.ok(queryStemVariants(n(w), full).every((v) => v.length >= 3), w);
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

// ── السجل: السؤال الفصيح الدقيق بلا جسر ملتبس (مراجعة الجودة على #984، B1) ──
check("السؤال الفصيح الدقيق لا تُضاف له بدائل بمعنى آخر ولا صور كاملة", () => {
  const cases: Array<[string, string[]]> = [
    ["الخصم", ["حسم"]],
    ["السجن", ["توقيف", "ايداع"]],
    ["الصلح", ["اصلاح"]],
    ["الدفع بعدم الاختصاص", ["اداء", "الوفاء", "سداد"]],
    ["متى ينفذ النظام", ["الاخلال", "تنفيذ"]],
    ["حضور الخصوم في الجلسة", ["غاب", "غياب"]],
    ["حضانة الأم", ["الاب", "الوالد"]],
    ["تأديب الموظف العام", ["العامل"]],
    ["الأوراق التجارية", ["الكتابه"]],
    ["عقد السلف", ["قرض", "دين"]],
    ["رخصة استخراج المعادن", ["الحصول"]],
    ["عقد صوري", ["الكاميرا", "صوره", "صور"]],
    ["الولادة", ["الوضع"]],
    ["الشقة", ["الماجور", "المسكن"]],
    ["تفصل المحكمة في الدعوى", ["فسخ", "انهاء"]],
    ["نصاب الجمعية العامة", ["احتيال"]],
    ["تخفيض رأس المال", ["انقاص"]],
    ["بدل السكن", ["اجره", "مقابل"]],
  ];
  for (const [q, bad] of cases) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, `«${q}» فصيح`);
    const terms = p.groups.flatMap((g) => groupTerms(g));
    for (const b of bad) assert.equal(terms.includes(n(b)), false, `«${q}» ← ${b}: ${terms.join("، ")}`);
    assert.equal(p.semanticAppend, q, `نص المعنى للسؤال الفصيح هو السؤال: ${p.semanticAppend}`);
  }
});
check("«عقد صوري»: الحصر بلفظ السائل وحده، والصيغ للتغطية", () => {
  const p = planQuery("عقد صوري");
  assert.deepEqual(probeTerms(p), ["صوري", "عقد"]);
  assert.deepEqual(groupTerms(p.groups.find((g) => g.term === "صوري")!), ["صوري", "صوريه"]);
});
check("السؤال الدارج: المدخل الملتبس يعمل («ما صلح الشقة» ← المسكن)، واللفظ ذو البديل لا يُحصر", () => {
  assert.ok(planQuery("المؤجر ما صلح الخراب في الشقة").colloquial, "«ما صلح» دارجة");
  assert.ok(group("المؤجر ما صلح الخراب في الشقة", "الشقة").alts.includes(n("المسكن")));
  const p = planQuery("العامل اذا فصلوه بدون سبب");
  assert.ok(p.colloquial, "«فصلوه» صيغة دارجة");
  assert.ok(!probeTerms(p).includes(n("فصلوه")));
  assert.ok(probeTerms(p, { probeBridged: true }).includes(n("فصلوه")));
  assert.deepEqual(group("موظف حكومي طلب مني رشوة وش عقوبته", "موظف").alts, [], "الموظف العام ليس العامل");
  assert.ok(planQuery("هل يقدر صاحب العمل يفصل الموظفة").colloquial, "«هل يقدر» دارجة");
  assert.ok(planQuery("ابي محامي يحضر معي التحقيق").colloquial, "«أبي» أول السؤال طلب");
  assert.ok(planQuery("وش حقي اذا الشركة خصموا من راتبي").colloquial);
  assert.ok(!planQuery("خصم الأجر").colloquial);
});
check("النفي الدارج عبارةً: «ما حضر» ← غياب، و«ما نفذ» ← الإخلال؛ و«حضر» وحدها بلا بديل", () => {
  assert.ok(group("المدعي ما حضر الجلسة", "حضر").alts.includes(n("غياب")));
  assert.ok(group("الطرف الثاني ما نفذ العقد", "نفذ").alts.includes(n("الإخلال")));
  assert.deepEqual(group("حضر المدعى عليه", "حضر").alts, []);
});
check("«لازم» و«أبي» و«شيء» حشو في الدارج وحده", () => {
  assert.ok(queryKeywords("عقد لازم").includes("لازم"));
  assert.ok(queryKeywords("ميراث أبي").includes("ابي"));
  assert.equal(queryKeywords("وش لازم اسوي اذا انفصلت").includes("لازم"), false);
  assert.equal(queryKeywords("هل لازم ادفع العربون").includes("لازم"), false, "«هل لازم» عبارة طلب");
  assert.ok(hasColloquialMarker(["وش", "حكم"].map(n)));
  assert.equal(hasColloquialMarker(["صار", "الحكم", "نهائيا"].map(n)), false, "«صار» فصيح أيضًا");
});

// ── الإحالة الصريحة إلى مادة (B2) ──
check("الإحالة الصريحة: «المادة/مادة» أو «م» مستقلة", () => {
  const yes: Array<[string, number]> = [
    ["المادة 55 من نظام العمل", 55],
    ["ما نص المادة 55 من نظام العمل", 55],
    ["مادة (77) نظام العمل", 77],
    ["م 80 نظام العمل", 80],
    ["م80 من نظام العمل", 80],
    ["المادة ٧٤ من نظام العمل", 74],
    ["بالمادة 74 من نظام العمل", 74],
    ["المادة رقم 3 من نظام الإثبات", 3],
    ["المادة 55 من نظام العمل الصادر بالمرسوم الملكي رقم م/51", 55],
  ];
  for (const [q, num] of yes) assert.equal(explicitArticleCitation(q)?.articleNumber, num, q);
  assert.ok(!/م\s*\/|51/.test(explicitArticleCitation("المادة 55 من نظام العمل الصادر بالمرسوم الملكي رقم م/51")!.systemHint));
});
check("ليست إحالة: «كم 60 يوم»، «رقم 120»، «م/53» والمرسوم، و«مكرر»", () => {
  for (const q of [
    "كم 60 يوم مهلة الاعتراض في نظام المرافعات الشرعية",
    "قرار مجلس الوزراء رقم 120 بشأن نظام العمل",
    "كم 30 يوم إجازة في نظام العمل",
    "نظام العمل الصادر بالمرسوم الملكي (م/51)",
    "نظام المرافعات الشرعية (م/1) الاستئناف",
    "المرسوم الملكي رقم م 51 نظام العمل",
    "حكم 55 العمل",
    "المادة 12 مكرر من نظام الإجراءات الجزائية",
    "نظام العمل",
  ]) assert.equal(explicitArticleCitation(q), null, q);
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
