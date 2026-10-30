/**
 * HKM-062 — اختبار وحدة: تنظيف سؤال hakeem_search وتوسيعه (بلا قاعدة ولا شبكة).
 * التشغيل: npm run test:everyday-query
 */
import assert from "node:assert/strict";
import { queryStemVariants } from "../lib/modules/legal-core/arabic-morphology";
import { explicitArticleCitation } from "../lib/mcp/article-citation";
import { groupTerms, planQuery, probeTerms } from "../lib/mcp/query-plan";
import { dropRequestPhrases, hasColloquialMarker, queryKeywords } from "../lib/mcp/query-words";
import { fusionScore, pinnableExact, WEIGHTS_DISTINCTIVE, WEIGHTS_WEAK_LEXICAL } from "../lib/mcp/search-fusion";
import { compileAny, matchesText, normalizeAr } from "../lib/mcp/tools/word-match";
import { EMPTY_SURFACE, strictSurface } from "../lib/modules/legal-core/search-surface";
import { EVERYDAY_ENTRIES } from "../lib/mcp/everyday-lexicon";

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
  assert.ok(queryStemVariants(n("أعارض"), full).includes(n("عارض")), "وزن يفاعل");
  assert.equal(queryStemVariants(n("إعادة"), full).includes(n("عادة")), false, "«إعادة» مصدر");
  assert.deepEqual(queryStemVariants(n("أعارض")), [], "الفصيح بلا تجريد");
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
check("ضمير المتكلم على المؤنث وجمعه (الوضع الكامل): موافقتي ← موافقة، سيارتي ← سيارة، بياناتي ← بيانات؛ لا في الفصيح", () => {
  assert.ok(queryStemVariants(n("موافقتي"), full).includes(n("موافقة")));
  assert.ok(queryStemVariants(n("سيارتي"), full).includes(n("سيارة")));
  assert.ok(queryStemVariants(n("بياناتي"), full).includes("بيانات"));
  assert.ok(queryStemVariants(n("بياناتي"), full).includes("بيان"));
  assert.equal(queryStemVariants(n("موافقتي")).includes(n("موافقة")), false, "الفصيح بلا تجريد الضمير");
  assert.equal(queryStemVariants(n("نهائي"), full).some((v) => v.endsWith("ه") && v !== n("نهائية")), false);
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
check("السؤال الدارج: المدخل الملتبس يعمل («ما صلحه وش أسوي» ← المسكن)، واللفظ ذو البديل لا يُحصر", () => {
  assert.ok(planQuery("المؤجر ما صلحه وش أسوي في الشقة").colloquial, "«وش» دارجة");
  assert.ok(group("المؤجر ما صلحه وش أسوي في الشقة", "الشقة").alts.includes(n("المسكن")));
  assert.equal(planQuery("المؤجر ما صلح الخراب في الشقة").colloquial, false, "«ما صلح» فصيحة أيضًا");
  const p = planQuery("العامل اذا فصلوه بدون سبب");
  assert.ok(p.colloquial, "«فصلوه» صيغة دارجة");
  assert.ok(!probeTerms(p).includes(n("فصلوه")));
  assert.ok(probeTerms(p, { probeBridged: true }).includes(n("فصلوه")));
  assert.deepEqual(group("موظف حكومي طلب مني رشوة وش عقوبته", "موظف").alts, [], "الموظف العام ليس العامل");
  assert.equal(planQuery("هل يقدر صاحب العمل يفصل الموظفة").colloquial, false, "«هل يقدر» وحدها ليست علامة (مراجعة الجودة الخامسة)");
  assert.ok(planQuery("ابغى محامي يحضر معي التحقيق").colloquial, "«أبغى» أول السؤال طلب دارج");
  assert.ok(queryKeywords("أبي توفي وترك ديونا").includes("ابي"), "«أبي» أول السؤال والد لا طلب");
  assert.ok(planQuery("وش حقي اذا الشركة خصموا من راتبي").colloquial);
  assert.ok(!planQuery("خصم الأجر").colloquial);
});
check("النفي الدارج عبارةً: «ما حضر» ← غياب، و«ما نفذ» ← الإخلال؛ و«حضر» وحدها بلا بديل", () => {
  assert.ok(group("المدعي ما حضر الجلسة", "حضر").alts.includes(n("غياب")));
  assert.ok(group("الطرف الثاني ما نفذ العقد وش اسوي", "نفذ").alts.includes(n("الإخلال")), "«ما نفذ» ملتبسة: في الدارج");
  assert.deepEqual(group("الطرف الثاني ما نفذ العقد", "نفذ").alts, [], "وفي الفصيح لا");
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

// ── مراجعة الجودة الثانية (BLK-1): الافتتاح الفصيح لا يجعل السؤال دارجًا، والألفاظ الفصيحة لا تُقرأ دارجة ──
check("الافتتاح الفصيح يُحذف ولا يغيّر السجل: «ما حكم عقد صوري» كـ«عقد صوري»", () => {
  const bare = planQuery("عقد صوري");
  for (const q of ["ما حكم عقد صوري", "ما هو حكم عقد صوري", "من فضلك عقد صوري", "لو سمحت ما حكم عقد صوري", "قل لي عقد صوري", "عندي سؤال عن عقد صوري", "ابحث عن عقد صوري", "ابحث لي عن عقد صوري", "أريد أن أعرف عقد صوري"]) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.deepEqual(probeTerms(p), probeTerms(bare), `${q}: ${probeTerms(p)}`);
    assert.deepEqual(p.groups.map((g) => groupTerms(g)), bare.groups.map((g) => groupTerms(g)), q);
  }
  assert.equal(planQuery("ما حكم عقد صوري").cleaned, "عقد صوري");
});
check("الافتتاح الفصيح مع ألفاظ المراجعة: لا بدائل بمعنى آخر ولا صور زائدة", () => {
  const cases: Array<[string, string[]]> = [
    ["ما هو حكم صورية العقد", ["الكاميرا", "صور"]],
    ["ما حكم نصاب الجمعية العامة", ["احتيال", "صاب"]],
    ["ما حكم تخفيض رأس المال", ["انقاص"]],
    ["ما حكم القاضي الذي يفصل في الدعوى", ["فسخ", "انهاء"]],
    ["ما حكم البيع إذا سلمت البضاعة متأخرة", ["سمح"]],
    ["ما حكم بيع الشقة على الخارطة", ["الماجور", "المسكن"]],
    ["من فضلك ما حكم الخصم في الدعوى", ["حسم"]],
    ["عندي سؤال عن الصلح", ["اصلاح"]],
  ];
  for (const [q, bad] of cases) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, `«${q}» فصيح`);
    const terms = p.groups.flatMap((g) => groupTerms(g));
    for (const b of bad) assert.equal(terms.includes(n(b)), false, `«${q}» ← ${b}: ${terms.join("، ")}`);
    assert.ok(!/سمح|احتيال|انقاص/.test(normalizeAr(p.semanticAppend)), `نص المعنى: ${p.semanticAppend}`);
  }
});
check("ألفاظ فصيحة لا تُقرأ دارجة: «قبض على»، «يطلع على»، «حل ودي»، «عامل منزلي»، «تزوجت أمه»، «تولد عن»", () => {
  const formal = [
    "القبض على المتهم",
    "يحق للخصم أن يطلع على المستندات",
    "حل ودي للنزاع",
    "عقد العامل المنزلي",
    "عقد عمل منزلي",
    "حضانة الطفل إذا تزوجت أمه",
    "الضرر الذي تولد عن الخطأ",
    "كما أسلفت في المذكرة",
    "النظام لم ينفذ بعد",
    "هل تقدر المحكمة التعويض عن الضرر الأدبي",
  ];
  for (const q of formal) assert.equal(planQuery(q).colloquial, false, q);
  assert.ok(queryKeywords("يحق للخصم أن يطلع على المستندات").includes("يطلع"), "«يطلع» لفظ");
  assert.ok(queryKeywords("حل ودي للنزاع").includes("ودي"), "«ودي» لفظ");
  assert.deepEqual(group("القبض على المتهم", "القبض").alts, []);
  assert.deepEqual(group("الضرر الذي تولد عن الخطأ", "تولد").alts, []);
  assert.deepEqual(group("عقد العامل المنزلي", "المنزلي").alts, []);
  // «علي» بالياء (عليَّ) دارجة: «نصب علي واحد».
  assert.ok(planQuery("نصب علي واحد وأخذ فلوسي").colloquial);
  assert.ok(group("نصب علي واحد واخذ مبلغ", "نصب").alts.includes(n("الاحتيال")));
  assert.equal(planQuery("نصب على المشتري").colloquial, false, "«على» بالألف المقصورة");
});
check("علامات دارجة إضافية: «يبي»، «احنا»، «عطتني»", () => {
  for (const q of ["الشركة يبي يفصلني", "احنا شركاء في محل", "عطتني الشركة إنذار"]) assert.ok(planQuery(q).colloquial, q);
});
check("صور زائدة في الدارج: «اترك» لا «اتر»، «احنا» لا «حنا»، «نصاب» لا «صاب»، «بيتي» لا «بيه»", () => {
  assert.equal(queryStemVariants(n("اترك"), full).includes("اتر"), false);
  assert.ok(queryStemVariants(n("اترك"), full).includes("ترك"));
  assert.equal(queryStemVariants(n("احنا"), full).includes("حنا"), false);
  assert.equal(queryStemVariants(n("نصاب"), full).includes("صاب"), false);
  assert.equal(queryStemVariants(n("بيتي"), full).includes("بيه"), false);
  assert.ok(queryStemVariants(n("زوجتي"), full).includes(n("زوجة")));
});

// ── مراجعة الجودة الثالثة ──
check("«هل يقدر/ما يقدر» لا تقلب السجل ولا تُحذف وحدها (مراجعة الجودة الخامسة)", () => {
  const cases: Array<[string, string, string[]]> = [
    ["هل يقدر التعويض عن الضرر الذي تولد عن الخطأ", "تولد", ["الوضع", "وضع", "ولد", "اولاد"]],
    ["هل يقدر التعويض عن عيب الشقة المبيعة", "الشقة", ["المسكن", "الماجور"]],
    ["ما يقدر به التعويض عن صور المحررات المزورة", "صور", ["الكاميرا", "الحياه الخاصه"]],
    ["هل يقدر القاضي نفقة الأطفال", "الأطفال", ["المحضون", "الاولاد"]],
  ];
  for (const [q, term, bad] of cases) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => g.term === "يقدر"), `«يقدر» لفظ: ${q}`);
    assert.equal(p.semanticAppend, q, `نص المعنى هو السؤال: ${p.semanticAppend}`);
    const terms = groupTerms(group(q, term));
    for (const b of bad) assert.equal(terms.includes(n(b)), false, `«${q}» ← ${b}`);
  }
  // مراجعة الجودة الخامسة: «يقدر» وحدها ليست علامة؛ هذه فصيحة الآن كما في main (كلفة مقبولة).
  for (const q of ["هل يقدر الدائن يطلب تصفية أموال المدين المفلس", "هل يقدر صاحب العمل يفصل الموظفة وهي في إجازة الولادة", "ما يقدر يرجع عن البيع", "هل يقدر القاضي أن يحكم بأكثر مما طلب"]) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => g.term === "يقدر"), `«يقدر» لا تُحذف وحدها: ${q}`);
  }
});
check("«يقدر» = يُقدَّر في عشرين جملة فصيحة (مراجعة الجودة الرابعة): فصيحة، «يقدر» لفظ، ولا بدائل بمعنى آخر", () => {
  const withBridge: Array<[string, string, string[]]> = [
    ["هل يقدر التعويض بما يجبر الضرر الذي تولد عن الخطأ", "تولد", ["الوضع", "وضع"]],
    ["هل يقدر الأرش بما ينقص من قيمة الشقة المعيبة", "الشقة", ["المسكن", "الماجور"]],
    ["هل يقدر التعويض بما يعادل قيمة الصور المزورة", "الصور", ["الكاميرا", "الحياه الخاصه"]],
    ["ما يقدر به يسار المنفق على الأطفال", "الأطفال", ["المحضون", "الاولاد"]],
    ["هل يقدر الثمن بما يساوي مساحة الشقة", "مساحة", ["مقدار", "المقدار"]],
  ];
  for (const [q, term, bad] of withBridge) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => g.term === "يقدر"), `«يقدر» لفظ: ${q}`);
    assert.equal(p.semanticAppend, q, `نص المعنى هو السؤال: ${p.semanticAppend}`);
    const terms = groupTerms(group(q, term));
    for (const b of bad) assert.equal(terms.includes(n(b)), false, `«${q}» ← ${b}`);
  }
  const plain = [
    "هل يقدر يمين المدعي بقيمة الدعوى",
    "هل يقدر القاضي يمين الاستظهار",
    "هل يقدر يسار الزوج عند فرض النفقة",
    "هل يقدر يسير الغرر في البيع",
    "ما يقدر يوميا للعامل من أجر",
    "هل يقدر الضرر بما يلحق المضرور من خسارة",
    "هل يقدر التعويض بما يتناسب مع الضرر",
    "هل يقدر الدين بما يثبت في الدليل الكتابي",
    "ما يقدر به التعويض يكون بحسب الضرر",
    "هل يقدر القاضي ما يستحق العامل عن نهاية الخدمة",
    "هل يقدر تعويض اليتيم عن فقد عائله",
    "ما يقدر يومية العامل المصاب",
    "هل يقدر المهر يوم العقد أم يوم الدخول",
    "هل يقدر التعويض بتقدير الخبير",
    "هل تقدر المحكمة يمين المدعي",
  ];
  for (const q of plain) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => g.term === n(q.includes("تقدر") ? "تقدر" : "يقدر")), `«يقدر» لفظ: ${q}`);
    assert.equal(p.semanticAppend, q, `نص المعنى هو السؤال: ${q}`);
    // لا بديل ملتبس (للدارج وحده) ولا صورة صرفية كاملة: بدائل الجسر العامة وحدها إن وُجدت.
    const amb = p.groups.flatMap((g) => g.alts).filter((a) => ["المحضون", "الاولاد", "الماجور", "المسكن", "الكاميرا", "الوضع", "مقدار", "انهاء", "فسخ"].includes(a));
    assert.deepEqual(amb, [], `${q}: ${amb.join("، ")}`);
  }
});
const AMB_ALTS = (() => {
  const amb = new Set<string>();
  const safe = new Set<string>();
  for (const e of EVERYDAY_ENTRIES) for (const a of e.alts) (e.ambiguous ? amb : safe).add(n(a));
  return new Set([...amb].filter((a) => !safe.has(a)));
})();
const QADAR = new Set(["يقدر", "نقدر", "يقدرون", "تقدر"].map(n));
check("«يقدر/نقدر» = يُقدَّر في 48 جملة فصيحة أخرى (مراجعة الجودة الخامسة): فصيحة، «يقدر» لفظ، نص المعنى هو السؤال، بلا بديل ملتبس", () => {
  const formal = [
    // probe.ts
    "هل يقدر ينبوع الماء المشترك بحصص الشركاء",
    "هل يقدر يقين الضرر قبل الحكم بالتعويض",
    "هل يقدر يد الأمين بالضمان عند التعدي",
    "هل يقدر يوم العمل الإضافي بأجر ونصف",
    "يقدر نصيب الزوجة من التركة بالثمن",
    "هل يقدر نفقة الزوجة بحسب حال الزوج",
    "هل يُقدَّر التعويض بقيمة المتلف يوم الإتلاف",
    "هل يقدر الأجر يوما بيوم",
    "هل يقدر التعويض عندما يتعذر التنفيذ العيني",
    "هل يقدر الأرش حين يظهر العيب في الشقة",
    "هل يقدر الإيجار من يناير أم من تاريخ التسليم",
    "هل يقدر التعويض في ينبع بأجرة المثل",
    "هل نقدر نفقات العلاج ضمن التعويض",
    "هل يقدر الإنفاق يسارا وإعسارا",
    "ما يقدر به التعويض يشمل الكسب الفائت",
    "هل يقدر تقدير الخبير بأتعاب محددة",
    "هل يقدر الثمن بالنقد الغالب في البلد",
    "هل يقدر الضمان بالمثل فيما يوجد مثله",
    "هل يقدر التعويض حيث يتعذر رد العين",
    "هل نقدر نصيب الزوجة من التركة",
    // probe2.ts (طبيعية): نص المعنى = السؤال، وقد يلحقه لفظ نظام من مدخل عام غير ملتبس («الشرط الجزائي» ← التعويض الاتفاقي)
    "هل يقدر التعويض عن الضرر المعنوي",
    "هل يقدر الضرر وقت وقوعه أم وقت الحكم",
    "هل يقدر أجر المثل بالعرف",
    "هل يقدر الأرش بنسبة النقص في القيمة",
    "هل يقدر التعويض جزافا",
    "ما يقدر من النفقة للمطلقة الحامل",
    "هل يقدر الشرط الجزائي بقدر الضرر",
    "هل يقدر الضمان بالقيمة يوم التلف",
    "هل يقدر مهر المثل بمهر نساء عصبتها",
    "هل يقدر التعويض عن الفصل التعسفي بأجر خمسة عشر يوما",
    "هل يقدر الأجر الإضافي بأجر الساعة مضافا إليه خمسون بالمئة",
    "ما يقدر به الأجر عند اختلاف المتعاقدين",
    "هل يقدر الكسب الفائت تقديرا احتماليا",
    "هل يقدر التعويض عن تفويت الفرصة",
    "هل يقدر الضرر المرتد بالضرر الأصلي",
    "هل يقدر بدل الانتفاع بأجرة المثل",
    "هل يقدر الثمن بسعر السوق يوم البيع",
    "هل يقدر الدية بالإبل أم بالنقد",
    "هل يقدر نصيب الشريك بقدر حصته",
    "ما يقدر للعامل عن ساعات العمل الإضافية",
    // probe2.ts (ظرف وصلة وحالات طرفية)
    "هل يقدر التعويض متى يثبت الخطأ",
    "هل يقدر الضرر إذ يتعذر إثباته",
    "هل يقدر التعويض كلما يتكرر الضرر",
    "هل يقدر الأجر بعدما ينتهي العقد",
    "ما يقدر به الأرش يستحق للمشتري",
    "ما يقدر به الدين يدفع نقدا",
    "هل يقدر القاضي يمينا على المدعي",
    "هل يقدر الأجر من يونيو",
  ];
  assert.equal(formal.length, 48);
  const natural = new Set(formal.slice(20, 40));
  for (const q of formal) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => QADAR.has(g.term)), `«يقدر/نقدر» لفظ: ${q}`);
    if (natural.has(q)) assert.ok(p.semanticAppend.startsWith(q), `نص المعنى يبدأ بالسؤال: ${q}`);
    else assert.equal(p.semanticAppend, q, `نص المعنى هو السؤال: ${q}`);
    const amb = p.groups.flatMap((g) => g.alts).filter((a) => AMB_ALTS.has(a));
    assert.deepEqual(amb, [], `${q}: ${amb.join("، ")}`);
  }
});
check("«يقدر» مع علامة دارجة أخرى دارجة وتُحذف؛ وبلا علامة فصيحة كما في main (الكلفة المقبولة مذكورة في الطلب)", () => {
  const withMarker = [
    "هل يقدرون يفصلوني من العمل", // يفصلوني
    "هل يقدر يسترجع فلوسه", // فلوسه
    "هل يقدر صاحب العمل يوقف راتبي", // راتبي
    "ما يقدر أبوي يزوجني بدون رضاي", // أبوي
    "وش يقدر الدائن يسوي", // وش
    "أبغى أعرف هل يقدر المؤجر يطلعني", // أبغى أعرف
  ];
  for (const q of withMarker) {
    const p = planQuery(q);
    assert.ok(p.colloquial, q);
    assert.equal(p.groups.some((g) => QADAR.has(g.term)), false, `«يقدر» حشو في الدارج: ${q}`);
  }
  const noMarker = [
    "هل يقدر الكفيل يمنعني من السفر",
    "هل يقدر صاحب العمل يخصم من الأجر",
    "هل يقدر المؤجر يطلعني من الشقة",
    "هل يقدر البنك يحجز على الحساب",
    "هل نقدر نرفع دعوى على الشركة",
    "هل يقدر التاجر يرجع عن البيع",
    "هل يقدر الدائن يطلب تصفية أموال المدين",
    "ما يقدر يرجع عن البيع",
    "ما نقدر نطلع من العقد",
    "هل يقدر المدير يرفض إجازتي",
    "هل يقدر الكفيل ينقل كفالتي بدون موافقتي",
    "هل يقدرون يسحبون السيارة",
    "هل نقدر نشتكي على البنك",
    "هل يقدر صاحب الشقة الجديد يطلعني منها",
    "هل يقدر المحامي ما يرد علي",
  ];
  for (const q of noMarker) {
    const p = planQuery(q);
    assert.equal(p.colloquial, false, q);
    assert.ok(p.groups.some((g) => QADAR.has(g.term)), `«يقدر» لفظ كما في main: ${q}`);
    assert.ok(p.semanticAppend.startsWith(q), `نص المعنى يبدأ بالسؤال (يلحقه مدخل عام إن وُجد): ${p.semanticAppend}`);
  }
});
check("«ما دفع»، «ما نفذ»، «بدلها» ملتبسة: لا بدائل في السؤال الفصيح", () => {
  const cases: Array<[string, string, string[]]> = [
    ["الرد على ما دفع به المدعى عليه", "دفع", ["اداء", "يودي", "الوفاء", "سداد"]],
    ["ما حكم ما دفع به الخصم من دفوع شكلية", "دفع", ["اداء", "الوفاء"]],
    ["ما نفذ من الالتزامات قبل الفسخ", "نفذ", ["اخل", "الاخلال", "يوف"]],
    ["التزام البائع بتسليم سلعة بدلها", "بدلها", ["اجره", "مقابل"]],
  ];
  for (const [q, term, bad] of cases) {
    assert.equal(planQuery(q).colloquial, false, q);
    const terms = groupTerms(group(q, term));
    for (const b of bad) assert.equal(terms.includes(n(b)), false, `«${q}» ← ${b}`);
  }
  assert.ok(group("المستأجر ما دفع الإيجار وش أسوي", "دفع").alts.includes(n("الوفاء")), "في الدارج تبقى");
});
check("«يسوي» و«آية» ليستا دارجتين؛ «يسوي» لفظ في الفصيح", () => {
  assert.equal(planQuery("يسوي القاضي بين الخصوم").colloquial, false);
  assert.ok(queryKeywords("يسوي القاضي بين الخصوم").includes("يسوي"));
  assert.equal(planQuery("تفسير آية الدين").colloquial, false);
  assert.ok(queryKeywords("تفسير آية الدين").includes("ايه"));
});
check("«الحضانة لمين/لمن» ← الأحق بالحضانة؛ «حضانة الأم» بلا بديل", () => {
  assert.ok(group("الحضانة لمين بعد الطلاق", "الحضانة").alts.includes(n("الأحق بالحضانة")));
  assert.ok(planQuery("الحضانة لمين بعد الطلاق").semanticAppend.includes("الأحق بالحضانة"));
  assert.deepEqual(group("حضانة الأم", "حضانة").alts, []);
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
    ["كالمادة 80 من نظام العمل", 80],
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
    "تقرير 2019م 15 حالة في نظام العمل",
    "قرار رقم 5 م 12 نظام العمل",
  ]) assert.equal(explicitArticleCitation(q), null, q);
});
check("مطابقة المادة التامة لا تُثبَّت أولًا إلا داخل وجه البحث (BLK-2)", () => {
  const hit = { id: "a1", type: "article" };
  assert.deepEqual(pinnableExact(hit, true), hit, "مادة نظام ساري");
  assert.equal(pinnableExact(hit, false), null, "مادة نظام ملغى أو مستبدل، أو تعذّرت القراءة");
  assert.equal(pinnableExact(null, true), null);
});
check("الوجه لقرار التثبيت يفشل مغلقًا: فشل قراءة الوجه أو سجل الإلغاء = null، والملغى مخفي (N1)", () => {
  const tables = { surface: { ...EMPTY_SURFACE, asOf: "2026-10-30" }, hiddenNames: new Set<string>(), ok: true };
  assert.equal(strictSurface({ ...tables, ok: false }, { ids: [], ok: true }), null, "فشل جدولي الوجه");
  assert.equal(strictSurface(tables, { ids: [], ok: false }), null, "فشل سجل الإلغاء");
  const ok = strictSurface(tables, { ids: ["old-reg"], ok: true });
  assert.ok(ok && ok.surface.hidden.has("old-reg"), "الملغى بسجل التحقق مخفي");
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
