/**
 * HKM-044 المرحلة الأولى: الأدوات الاثنتا عشرة (الفهرس والتشخيص، البحث النصي والدلالي، تتبع النص، الاستناد والبصمة).
 *   U-*  دوال نقية: السنة الهجرية، المرشحات، المحلل المنطقي، المحاذاة، البصمة، صيغة الإصدار، ألفاظ السؤال، الترتيب.
 *   D-*  على قاعدة محلية _test (مخطط HKM-023-B الأساس + جداول صغيرة للأحكام والعلاقات والمكنز)، بنصوص اصطناعية
 *        بصيغ الأنظمة. غياب القاعدة تخطٍّ معلَن، وفشلٌ إن ضُبط HKM044_REQUIRE_DB=1 (أو CI).
 * البحث الدلالي بمتجهات وهمية (vectorSearch مُمرَّر)؛ بوابة م187 مرافعات وم84 عمل تُفحص حيًّا بعد النشر عبر الموصل.
 * لا إنتاج ولا فرع منه.
 */
import fs from "node:fs";
import { connectLocalTest } from "./hkm-023-b/local-db";
import type { SqlClient } from "../lib/modules/legal-core/sql-port";
import { resolveEffectiveText, type EffectiveArticleText } from "../lib/modules/legal-core/effective-text";
import type { UnitVersionRecord, VerificationRecord } from "../lib/modules/legal-core/verified-status";
import {
  filtersFromArgs,
  fuzzyMaxDistance,
  handleHealth,
  handleListCategories,
  handleListLaws,
  handleResolve,
  handleStats,
  hijriYearOf,
  lawMatchesFilters,
  lawScopeForFilters,
  lawScopeSql,
  loadLawCatalog,
  resetCatalogCache,
  type CatalogLaw,
} from "../lib/mcp/tools/catalog";
import {
  alignWords,
  BoolParseError,
  boolToText,
  classifyTrace,
  evalBoolean,
  handleSearchBoolean,
  handleSearchPhrase,
  handleTraceText,
  hasPositive,
  normalizeWithMap,
  parseBoolean,
  snippetAround,
  wordsWithPos,
} from "../lib/mcp/tools/text-search";
import { articleRef, handleCheckRef, handleGetCitation, handleGetToc, issuedPhrase, parseRef, textFingerprint } from "../lib/mcp/tools/citation";
import { handleSemanticSearch, hintedLaws, queryKeywords, rerankScore } from "../lib/mcp/tools/semantic";
import { acceptFill, keepCandidate, rankFused, fusionScore } from "../lib/mcp/search-fusion";
import { resolveMinScore } from "../lib/modules/legal-search/providers/search-provider";
import { SEMANTIC_TOOL_MIN_SCORE } from "../lib/mcp/tools/semantic";
import { compileTerm, normalizeAr, normSqlExpr, rawLiteralPattern, windowCoverage } from "../lib/mcp/tools/word-match";
import { resetUnitVersionCache } from "../lib/mcp/tools/enumerate";
import { textAsOf } from "../lib/modules/legal-core/verified-status";
import { MCP_TOOL_POLICY, mcpToolPolicy } from "../config/mcp-tools";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};
/** نتيجة أداة اتحادٌ بين نجاح وخطأ؛ للاختبار تُقرأ حقولها بلا تضييق. */
type Loose = {
  [k: string]: unknown;
  page?: Array<{ article_id: string }>;
  full?: string;
  footnote?: string;
  short?: string;
  citation?: string;
  ref?: string;
  status?: string;
  parsed?: string;
  excluded_terms?: string[];
  error?: string;
};
const L = (x: unknown) => x as Loose;
const throws = (fn: () => unknown, re: RegExp, m: string) => {
  try {
    fn();
    ok(false, `${m} (لم يرفض)`);
  } catch (e) {
    ok(e instanceof BoolParseError && re.test((e as Error).message), `${m} — ${(e as Error).message}`);
  }
};

// ── U: دوال نقية ──

ok(hijriYearOf("1444/11/29هـ") === 1444 && hijriYearOf("٢٢ / ١ / ١٤٣٥") === 1435 && hijriYearOf("مرسوم ملكي رقم (م/51) وتاريخ 23/8/1426هـ") === 1426, "U سنة الإصدار من النص (لاتينية وهندية وداخل الأداة)");
ok(hijriYearOf("2023-05-01") === null && hijriYearOf(null) === null, "U لا سنة هجرية من تاريخ ميلادي أو فراغ");
ok(hijriYearOf("قرار مجلس الوزراء رقم (1435) وتاريخ 1/2/1440هـ") === 1440 && hijriYearOf("1444") === 1444, "U رقم الأداة من أربعة أرقام لا يُقرأ سنة؛ السنة من التاريخ");

const law = (o: Partial<CatalogLaw>): CatalogLaw => ({
  law_id: "x", name: "نظام اصطناعي", kind: "نظام", category: "العمل", category_code: "labor", classification: null, status: "ساري",
  issued_year_h: 1426, issued_h: "1426/8/23", articles_count: 3, ...o,
});
ok(lawMatchesFilters(law({}), { category: "labor" }) && lawMatchesFilters(law({}), { category: "العمل" }), "U التصنيف بالرمز أو بالاسم");
ok(!lawMatchesFilters(law({ status: "لاغي" }), { status: "in_force" }) && lawMatchesFilters(law({ status: "لاغي" }), { status: "all" }), "U in_force يستبعد الملغى، all يدخله");
ok(lawMatchesFilters(law({ status: "غير مؤكد" }), { status: "in_force" }), "U «غير مؤكد» (بلا سجل) لا يُستبعد من in_force");
ok(!lawMatchesFilters(law({ issued_year_h: null }), { issued_from_h: 1400 }) && lawMatchesFilters(law({}), { issued_from_h: 1420, issued_to_h: 1430 }), "U قيد السنة: بلا سنة لا يدخل، وداخل المدى يدخل");
const f = filtersFromArgs({ law_id: "a", law_ids: ["b", "a"] });
ok(f.law_ids?.length === 2 && f.status === "in_force", "U law_id يُضم إلى law_ids بلا تكرار، والحالة الافتراضية in_force");
const ps: unknown[] = [];
ok(lawScopeSql({ include: null, exclude: [], excluded_retired: 0, label: "" }, ps) === "" && ps.length === 0, "U نطاق بلا قيد: لا شرط");
ok(/IS NULL OR NOT/.test(lawScopeSql({ include: null, exclude: ["r"], excluded_retired: 1, label: "" }, ps)), "U نطاق الاستبعاد يُدخل المادة اليتيمة");

// المحلل المنطقي
const P = (q: string) => boolToText(parseBoolean(q, "word"));
ok(P("فسخ عقد") === "فسخ AND عقد", "U متجاوران = AND");
ok(P("فسخ أو انفساخ عقد") === "فسخ OR (انفساخ AND عقد)", "U AND أعلى أولوية من OR");
ok(P("(فسخ أو انفساخ) عقد دون تعويض") === "(فسخ OR انفساخ) AND عقد AND NOT تعويض", "U أقواس و«دون»");
ok(P('"فسخ العقد" OR -تعويض إلزام') === "«فسخ العقد» OR (NOT تعويض AND إلزام)", "U عبارة بين علامتي تنصيص، و-لفظ نفي");
ok(P("«فسخ العقد» و التعويض") === "«فسخ العقد» AND التعويض", "U «…» عبارة و«و» منفصلة عامل AND");
throws(() => parseBoolean("NOT تعويض", "word"), /لفظ مثبت/, "U النفي وحده مرفوض");
throws(() => parseBoolean("فسخ أو -تعويض", "word"), /لفظ مثبت/, "U فرع OR منفي كله مرفوض");
ok(P("دون الإخلال بأحكام النظام") === "دون AND الإخلال AND بأحكام AND النظام" && P("فسخ دون تعويض") === "فسخ AND NOT تعويض", "U «دون» نفي بين لفظين فقط، وفي أول الاستعلام كلمة عادية");
ok(P("(دون الإخلال) أو فسخ") === "(دون AND الإخلال) OR فسخ" && P("فسخ أو دون تعويض") === "فسخ OR (دون AND تعويض)", "U «دون» بعد قوس فتح أو عامل كلمة عادية");
throws(() => parseBoolean("(فسخ عقد", "word"), /لم يُغلق/, "U قوس مفتوح");
throws(() => parseBoolean("فسخ)", "word"), /بلا قوس فتح/, "U قوس إغلاق زائد");
throws(() => parseBoolean('"فسخ العقد', "word"), /تنصيص/, "U علامة تنصيص مفتوحة");
throws(() => parseBoolean("فسخ أو", "word"), /أو/, "U «أو» في الآخر");
throws(() => parseBoolean("()", "word"), /فارغان/, "U قوسان فارغان");
throws(() => parseBoolean(Array.from({ length: 13 }, (_, i) => `لفظ${i}`).join(" "), "word"), /12/, "U سقف 12 لفظًا");
ok(hasPositive(parseBoolean("فسخ دون تعويض", "word")), "U AND فيه مثبت ومنفي مقبول");
const tree = parseBoolean("(فسخ أو انفساخ) العقد دون تعويض", "word");
ok(evalBoolean(tree, normalizeAr("يجوز فسخ العقد")) && !evalBoolean(tree, normalizeAr("فسخ العقد مع التعويض")) && !evalBoolean(tree, normalizeAr("انفساخ الشركة")), "U تقييم الشجرة على نص (نظير SQL)");

// التصفية المسبقة على الخام = الاحتواء في المطبَّع (JS)
{
  const texts = ["الهيئة العامة", "هيئَةٌ", "مسؤولية المسئول", "رُؤْيَة", "ثلاثون (٣٠) يومًا", "مكافأة نهاية الخدمة", "إلى آخره", "الفســخ", "Section 30 A", "بلا شيء", "وزنها ٣٥٠٠ كجم", "3٫000 ريال", "فَسَّخَ"];
  const lits = ["هييه", "مسوول", "رويه", "30", "مكافاه", "الي", "فسخ", "section 30", "ا"];
  let agree = 0;
  let total = 0;
  for (const l of lits)
    for (const t of texts) {
      total++;
      const want = normalizeAr(t).toLowerCase().includes(l.toLowerCase());
      if (new RegExp(rawLiteralPattern(l), "iu").test(t) === want) agree++;
      else ok(false, `U التصفية المسبقة «${l}» في «${t}» ${want ? "يجب أن تطابق" : "يجب ألا تطابق"}`);
    }
  ok(agree === total, `U التصفية المسبقة على الخام تكافئ الاحتواء في المطبَّع (${agree}/${total})`);
  ok(lits.every((l) => rawLiteralPattern(l) === rawLiteralPattern(l).normalize("NFC") && !/[\u064B-\u065F\u0670]/.test(rawLiteralPattern(l))), "U نمط التصفية بلا علامات مركّبة حرفية (لا يغيّره تطبيع NFC)");
}

// نسختان بتاريخ نفاذ واحد: الأعلى معرّفًا (كما في SQL)
{
  const v = (id: string, body: string) => ({ id, body, validFrom: "2020-01-01T00:00:00.000Z", evidenceInstrument: null, evidenceUrl: null });
  ok(textAsOf("أصل", [v("v6", "ب"), v("v5", "أ")], new Date()).text === "ب" && textAsOf("أصل", [v("v9", "ج"), v("v8", "د")], new Date()).text === "ج", "U نسختان بتاريخ واحد: الأعلى معرّفًا حتمًا");
}

// المحاذاة والتصنيف
const W = (s: string) => wordsWithPos(s).map((x) => x.w);
const src = "إذا انتهت علاقة العمل وجب على صاحب العمل أن يدفع إلى العامل مكافأة عن مدة خدمته";
let al = alignWords(W(src), W(`مقدمة. ${src}. خاتمة`));
ok(al.run === W(src).length && classifyTrace(W(src).length, al.run, al.lcs) === "verbatim", "U اقتباس حرفي داخل نص أطول = verbatim");
al = alignWords(W("وإذا انتهت علاقه العمل وجب على صاحب العمل ان يدفع للعامل مكافأة عن مدة خدمته"), W(src));
ok(classifyTrace(15, al.run, al.lcs) === "near_verbatim", `U فروق يسيرة (واو، تاء، همزة، «للعامل») = near_verbatim (run ${al.run}، lcs ${al.lcs})`);
ok(classifyTrace(30, 9, 12) === "partial" && classifyTrace(30, 5, 10) === "fragment" && classifyTrace(30, 3, 6) === "none", "U حدود partial وfragment وnone");
const wp = wordsWithPos("فَسْخُ العَقْدِ، والتعويض");
ok(wp.length === 3 && wp[0].w === "فسخ" && "فَسْخُ العَقْدِ، والتعويض".slice(wp[1].s, wp[1].e) === "العَقْدِ", "U الكلمات بمواضعها في الخام مع التشكيل");

// المقتطف
const nm = normalizeWithMap("أَحْكَام");
ok(nm.norm === "احكام" && nm.map.length === 5 && nm.map[1] === 2, "U خريطة التطبيع إلى مواضع الخام");
const longText = `${"تمهيد ".repeat(100)}يجوز فسخ العقد إذا أخل الطرف الآخر ${"تذييل ".repeat(100)}`;
const sn = snippetAround(longText, [compileTerm("فسخ العقد", "word")!], 120);
ok(sn.matched && sn.snippet.includes("فسخ العقد") && sn.snippet.startsWith("… "), "U المقتطف حول موضع المطابقة لا من البداية");
ok(!snippetAround("نص لا يحوي اللفظ", [compileTerm("فسخ", "word")!], 50).matched, "U المقتطف يقول إن النص لا يحوي اللفظ");

// البصمة
ok(textFingerprint("فَسْخُ  العقد\nبحكم") === textFingerprint("فسخ العقد بحكم") && textFingerprint("فسخ العقد") !== textFingerprint("فسخ العقود"), "U البصمة لا يغيّرها تشكيل ولا مسافة، ويغيّرها حرف");
const r0 = articleRef("art_123456", "نص");
ok(/^hakeem:art:art_123456:[0-9a-f]{12}$/.test(r0) && parseRef(r0)?.id === "art_123456" && parseRef("art_123456")?.fp === null && parseRef("hakeem:art:x") === null, "U صيغة البصمة وتحليلها والمعرّف وحده");
ok(
  issuedPhrase({ kind: "royal_decree", number: "م/51", dateHijri: "1426/8/23", text: "x", source: "law_card", url: null }) === "الصادر بالمرسوم الملكي رقم (م/51) وتاريخ 1426/8/23هـ" &&
    issuedPhrase({ kind: null, number: null, dateHijri: null, text: "قرار مجلس الوزراء رقم 10", source: "law_card", url: null }) === "الصادر بموجب قرار مجلس الوزراء رقم 10",
  "U صيغة أداة الإصدار",
);

// الدلالي
ok(JSON.stringify(queryKeywords("كم مدة الاستئناف على الحكم في نظام المرافعات؟")) === JSON.stringify(["مده", "الاستيناف", "الحكم", "المرافعات"]), `U ألفاظ السؤال بلا أدوات: ${queryKeywords("كم مدة الاستئناف على الحكم في نظام المرافعات؟").join("، ")}`);
const hl = hintedLaws("مكافأة نهاية الخدمة في نظام العمل البحري", [
  { law_id: "w", name: "نظام العمل" },
  { law_id: "m", name: "نظام العمل البحري" },
]);
ok(hl.has("m") && !hl.has("w"), "U النظام المسمّى: الأطول يغلب");
ok(fuzzyMaxDistance(10) === 2 && fuzzyMaxDistance(24) === 3 && fuzzyMaxDistance(60) === 4, "U حد مسافة التحرير: 2 للقصير و4 أقصى");
ok(resolveMinScore(0.5, 0.6) === 0.5 && resolveMinScore(1, 0.6) === 1, "U HKM-047 حد صالح يحل محل العتبة العامة");
ok([undefined, null, Number.NaN, -0.2, 0, 1.5, Infinity, "0.3"].every((v) => resolveMinScore(v, 0.6) === 0.6), "U HKM-047 حد معطوب (NaN/سالب/صفر/>1/نص) يعود إلى العتبة العامة");
{
  const C = (id: string, coverage: number, similarity: number, lexicalHit = false, lawNamed = false) => ({ id, coverage, similarity, lexicalHit, lawNamed });
  // «الغبن»: م69 حصر لفظي بتغطية كاملة، وم1 تشابه ضعيف بلا تغطية ← م69 أولًا.
  const r1 = rankFused([C("art1", 0, 0.52), C("art69", 1, 0, true), C("art2", 0, 0.5)], 3);
  ok(r1[0].id === "art69", "U HKM-048 المادة ذات التغطية الكاملة تتقدم على تشابه ضعيف بلا تغطية");
  // «التغرير في العقد»: م61 تغطية 1 وتشابه عالٍ تتقدم على مادة تغطيها 0.5.
  const r2 = rankFused([C("a", 0.5, 0.7), C("art61", 1, 0.75), C("b", 0.5, 0.6)], 3);
  ok(r2[0].id === "art61" && r2.length === 3, "U HKM-048 تغطية الألفاظ والتشابه معًا يرفعان المادة الصحيحة");
  // التكرار بالمعرّف يُدمج بأعلى قيمة لكل حقل.
  const r3 = rankFused([C("x", 0.5, 0), C("x", 0, 0.8, true)], 5);
  ok(r3.length === 1 && r3[0].coverage === 0.5 && r3[0].similarity === 0.8 && r3[0].lexicalHit, "U HKM-048 دمج المرشح المكرر بأعلى قيمة لكل حقل");
  // الثبات: التعادل الكامل يُحسم بالمعرّف، والحد صفر يعيد فارغًا، وقيم معطوبة لا تكسر.
  const r4 = rankFused([C("b", 0.5, 0.5), C("a", 0.5, 0.5)], 2);
  ok(r4[0].id === "a" && rankFused([C("a", 1, 1)], 0).length === 0, "U HKM-048 تعادل ثابت بالمعرّف وحد صفر");
  ok(fusionScore(C("z", Number.NaN, 5, false, false)) === 0.35 && fusionScore(C("z", -3, -1)) === 0, "U HKM-048 قيم NaN/خارج النطاق تُقيَّد ولا تفسد الدرجة");
  ok(fusionScore(C("z", 1, 1, true, true)) === 1.08, "U HKM-048 أعلى درجة = مجموع الأوزان");
  ok(!acceptFill(0, 3) && !acceptFill(0.33, 3) && !acceptFill(0.5, 2) && acceptFill(0.75, 4) && acceptFill(1, 2) && acceptFill(1, 1), "U HKM-050 مادة التكملة تُقبل بتغطية ثلاثة أرباع الألفاظ فأكثر (لفظان يلزمهما معًا)");
  ok(acceptFill(0, 0) && !acceptFill(Number.NaN, 2), "U HKM-049 سؤال بلا ألفاظ يقبل التكملة، وتغطية معطوبة ترفض");
  {
    const terms = ["التغرير", "العقد"].map((t) => compileTerm(t, "derivatives")!);
    const near = normalizeAr("إذا تضمن عقد البيع أن المشتري عالم بالمبيع فلا حق له إلا إذا أثبت تغرير البائع به");
    const far = normalizeAr("العقد " + "كلمات أخرى ".repeat(300) + " ثم التغرير");
    const one = normalizeAr("التغرير فقط هنا");
    ok(windowCoverage(near, terms) === 1, "U HKM-051 اللفظان متقاربان ← تغطية كاملة");
    ok(windowCoverage(far, terms) === 0.5, "U HKM-051 اللفظان متباعدان في مادة طويلة ← نصف التغطية");
    ok(windowCoverage(one, terms) === 0.5 && windowCoverage("", terms) === 0 && windowCoverage(near, []) === 0, "U HKM-051 لفظ واحد حاضر ← نصف، وحالات الفراغ صفر");
    ok(!keepCandidate({ coverage: 0.5, similarity: 0 }, 2) && keepCandidate({ coverage: 1, similarity: 0 }, 2) && keepCandidate({ coverage: 0.5, similarity: 0.55 }, 2) && keepCandidate({ coverage: 0, similarity: 0 }, 1), "U HKM-051 مرشح متباعد بلا دعم دلالي يسقط، والمدعوم دلاليًا أو الأحادي يبقى");
  }
}
ok(SEMANTIC_TOOL_MIN_SCORE < 0.6 && SEMANTIC_TOOL_MIN_SCORE >= 0.4, "U HKM-047 حد الأداة دون العتبة العامة وفوق حد الضجيج");
ok(rerankScore(0.8, 1, false) === 0.87 && rerankScore(0.8, 0, true) === 0.6, "U وزن الترتيب 0.65/0.35 و0.08 للنظام المسمّى");

// التسعير مؤجل بقرار المالك (24/10): أدوات المرحلة الأولى غير مدرجة، فتسري القاعدة الآمنة (مدفوعة بخصم بحث).
{
  const names = ["hakeem_health", "hakeem_stats", "hakeem_list_categories", "hakeem_list_laws", "hakeem_resolve", "hakeem_search_phrase", "hakeem_search_boolean", "hakeem_semantic_search", "hakeem_trace_text", "hakeem_get_citation", "hakeem_check_ref", "hakeem_get_toc"];
  ok(names.every((n) => !(n in MCP_TOOL_POLICY) && mcpToolPolicy(n).tier === "paid" && mcpToolPolicy(n).service === "HYBRID_SEARCH"), "U تسعير المرحلة الأولى مؤجل: القاعدة الافتراضية الآمنة لكل أداة");
}

// ── D: قاعدة محلية ──

const REQUIRE_DB = process.env.HKM044_REQUIRE_DB === "1" || Boolean(process.env.CI);
const URL_P1 = process.env.HKM044_P1_TEST_DATABASE_URL || "postgres://hakeem:localtest@127.0.0.1:54329/hakeem_hkm044p1_test";

/** النص الساري عبر SqlClient بالدالة النقية نفسها (resolveEffectiveText) التي يستعملها الإنتاج. */
function localEffective(db: SqlClient) {
  return async (rows: Array<{ id: string; content: string | null }>) => {
    const ids = rows.map((r) => r.id);
    const out = new Map<string, EffectiveArticleText>();
    if (!ids.length) return out;
    const vs = await db.query<{ id: string; unit_id: string; body: string; valid_from: Date; evidence_instrument: string | null; evidence_url: string | null }>(
      `SELECT id, unit_id, body, valid_from, evidence_instrument, evidence_url FROM unit_version WHERE unit_id = ANY($1::text[]) ORDER BY unit_id, valid_from`,
      [ids],
    );
    const ver = await db.query<{ object_id: string; id: string; verified_status: string; evidence_instrument: string | null; evidence_url: string | null; evidence_quote: string | null; verified_at: Date }>(
      `SELECT DISTINCT ON (object_id) object_id, id, verified_status, evidence_instrument, evidence_url, evidence_quote, verified_at
         FROM verification WHERE object_type = 'unit' AND object_id = ANY($1::text[]) ORDER BY object_id, verified_at DESC, id DESC`,
      [ids],
    );
    const byUnit = new Map<string, UnitVersionRecord[]>();
    for (const v of vs) byUnit.set(v.unit_id, [...(byUnit.get(v.unit_id) ?? []), { id: v.id, body: v.body, validFrom: new Date(v.valid_from).toISOString(), evidenceInstrument: v.evidence_instrument, evidenceUrl: v.evidence_url }]);
    const byVer = new Map<string, VerificationRecord>(
      ver.map((v) => [v.object_id, { id: v.id, verifiedStatus: v.verified_status, evidenceInstrument: v.evidence_instrument, evidenceUrl: v.evidence_url, evidenceQuote: v.evidence_quote, verifiedAt: new Date(v.verified_at).toISOString() }]),
    );
    for (const r of rows) out.set(r.id, resolveEffectiveText({ articleId: r.id, baseText: r.content ?? "", versions: byUnit.get(r.id) ?? [], verification: byVer.get(r.id) ?? null }));
    return out;
  };
}

async function setup(db: SqlClient) {
  await db.query(`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.query(`CREATE SCHEMA public`);
  await db.query(fs.readFileSync("scripts/hkm-023-b/fixtures/base-schema.sql", "utf8"));
  await db.query(`CREATE TABLE judicial_cases (id text PRIMARY KEY, court text, "cityName" text, "caseNo" text, "decisionNo" text, "decisionDateText" text, source text, "judgmentText" text NOT NULL DEFAULT '')`);
  await db.query(`CREATE TABLE legal_relations (id text PRIMARY KEY, source_type text, source_id text, target_type text, target_id text, relation text NOT NULL)`);
  await db.query(`CREATE TABLE legal_thesaurus_concepts (id text PRIMARY KEY, label text)`);

  const sys = (id: string, name: string, n: number, domain: string | null, title: string | null, decree: string | null, kind: string | null = null) =>
    db.query(`INSERT INTO legal_systems (id, name, "articleCount", domain, domain_title, preamble_royal_decree, eli_slug, instrument_kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, name, n, domain, title, decree, id, kind]);
  await sys("sys-labor", "نظام العمل", 5, "labor", "العمل", "مرسوم ملكي رقم (م/51) وتاريخ 1426/8/23هـ");
  await sys("sys-civil", "نظام المعاملات المدنية", 3, "civil", "المعاملات المدنية", "مرسوم ملكي رقم (م/191) وتاريخ 1444/11/29هـ");
  await sys("sys-mur", "نظام المرافعات الشرعية", 3, "procedure", "المرافعات", "مرسوم ملكي رقم (م/1) وتاريخ 1435/1/22هـ");
  await sys("sys-old", "نظام العمل والعمال", 1, "labor", "العمل", "مرسوم ملكي رقم (م/21) وتاريخ 1389/9/6هـ");
  await sys("sys-lawaih", "اللائحة التنفيذية لنظام العمل", 1, "labor", "العمل", null);
  await sys("sys-policy", "السياسة الوطنية الاصطناعية", 0, null, null, null);
  await sys("sys-marine", "نظام العمل البحري", 1, "labor", "العمل", "مرسوم ملكي رقم (م/2) وتاريخ 1440/1/1هـ");
  const work = (id: string, status: string) =>
    db.query(`INSERT INTO verification (id, object_type, object_id, verified_status, method, verified_at) VALUES ($1, 'work', $2, $3, 'rule', '2026-10-01')`, [`v-${id}`, id, status]);
  await work("sys-labor", "ساري");
  await work("sys-civil", "ساري");
  await work("sys-mur", "ساري");
  await work("sys-old", "ملغى");

  const art = (id: string, sysId: string, lawName: string, n: number, content: string, chapter: string | null = null, bis = 0) =>
    db.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", "articleBis", title, content, chapter) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, sysId, lawName, n, bis, `المادة ${n}`, content, chapter]);
  const L = "نظام العمل";
  await art("a-lab-084", "sys-labor", L, 84, "إذا انتهت علاقة العمل وجب على صاحب العمل أن يدفع إلى العامل مكافأة عن مدة خدمته تحسب على أساس أجر نصف شهر عن كل سنة من السنوات الخمس الأولى.", "الباب الخامس: علاقات العمل");
  await art("a-lab-080", "sys-labor", L, 80, "لا يجوز لصاحب العمل فسخ العقد دون مكافأة أو إشعار العامل أو تعويضه إلا في الحالات الآتية.", "الباب الخامس: علاقات العمل");
  await art("a-lab-081", "sys-labor", L, 81, "يحق للعامل أن يترك العمل دون إشعار مع احتفاظه بحقوقه النظامية كلها إذا لم يقم صاحب العمل بالوفاء بالتزاماته العقدية.", "الباب الخامس: علاقات العمل");
  await art("a-lab-077", "sys-labor", L, 77, "إذا أنهي العقد لسبب غير مشروع كان للطرف الذي أصابه ضرر من هذا الإنهاء الحق في تعويض تقدره هيئة تسوية الخلافات العمالية.", "الباب الخامس: علاقات العمل");
  await art("a-lab-x00", "sys-labor", L, 80, "جدول ملحق: فسخ العقد دون مكافأة", null, 100);
  await db.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument) VALUES ('uv-77', 'a-lab-077', $1, '2015-03-25', 'المرسوم الملكي رقم (م/46) وتاريخ 1436/6/5هـ')`, [
    "ما لم يتضمن العقد تعويضًا محددًا مقابل إنهائه من أحد الطرفين لسبب غير مشروع، يستحق الطرف المتضرر من إنهاء العقد تعويضًا.",
  ]);
  const C = "نظام المعاملات المدنية";
  await art("a-civ-107", "sys-civil", C, 107, "يجوز للمتعاقد فسخ العقد إذا لم يوف المتعاقد الآخر بالتزامه.");
  await art("a-civ-108", "sys-civil", C, 108, "ينفسخ العقد من تلقاء نفسه إذا انقضى الالتزام لاستحالة تنفيذه.");
  await art("a-civ-200", "sys-civil", C, 200, "يلتزم المدين بالتعويض عن الضرر الناشئ عن عدم التنفيذ.");
  await db.query(`INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, method, verified_at) VALUES ('v-civ-200', 'unit', 'a-civ-200', 'ملغاة', 'المرسوم الملكي رقم (م/9) وتاريخ 1446/1/1هـ', 'manual', '2026-10-02')`);
  const M = "نظام المرافعات الشرعية";
  await art("a-mur-001", "sys-mur", M, 1, "تطبق المحاكم على القضايا المعروضة أمامها أحكام الشريعة الإسلامية.", "الباب الأول: أحكام عامة");
  await art("a-mur-186", "sys-mur", M, 186, "الأحكام التي تصدر قبل الفصل في الدعوى ولا تنتهي بها الخصومة كلها أو بعضها لا يجوز الاعتراض عليها إلا مع الاعتراض على الحكم الصادر في الموضوع.", "الباب الحادي عشر: طرق الاعتراض على الأحكام");
  await art("a-mur-187", "sys-mur", M, 187, "مدة الاعتراض بطلب الاستئناف أو التدقيق ثلاثون يومًا، ويستثنى من ذلك الأحكام الصادرة في المسائل المستعجلة.", "الباب الحادي عشر: طرق الاعتراض على الأحكام");
  await art("a-old-074", "sys-old", "نظام العمل والعمال", 74, "لا يجوز فسخ العقد من قبل صاحب العمل دون مكافأة.");
  await art("a-law-001", "sys-lawaih", "اللائحة التنفيذية لنظام العمل", 1, "تنظم هذه اللائحة إجراءات فسخ العقد.");
  await art("a-mar-001", "sys-marine", "نظام العمل البحري", 1, "يستحق البحار مكافأة نهاية الخدمة عند انتهاء عقده.");

  await db.query(`INSERT INTO judicial_cases (id, court, "cityName", "caseNo", "decisionNo", "decisionDateText", source) VALUES
    ('r1', 'المحكمة العمالية', 'الرياض', '4470001', '4470099', '١٤٤٤/٠٥/١٢', 'ahkam_moj'),
    ('r2', 'المحكمة العمالية', 'جدة', '4370002', NULL, '١٤٣٧/٠١/٠٣', 'ahkam_moj'),
    ('r3', 'المحكمة التجارية', NULL, '4380003', '4380011', NULL, 'ahkam_moj')`);
  await db.query(`INSERT INTO legal_relations (id, source_type, source_id, target_type, target_id, relation) VALUES ('rel1', 'system', 'sys-lawaih', 'system', 'sys-labor', 'IMPLEMENTS')`);
  await db.query(`INSERT INTO legal_thesaurus_concepts (id, label) VALUES ('c1', 'فسخ'), ('c2', 'تعويض')`);
  resetCatalogCache();
}

async function dbTests(db: SqlClient) {
  const deps = { effective: localEffective(db), siteUrl: "https://hakeem.test" };

  // الفهرس
  const cat = await loadLawCatalog(db);
  const byId = new Map(cat.map((l) => [l.law_id, l]));
  ok(byId.get("sys-old")?.status === "لاغي" && byId.get("sys-labor")?.status === "ساري" && byId.get("sys-lawaih")?.status === "غير مؤكد", "D الحالة من آخر سجل تحقق، و«غير مؤكد» بلا سجل");
  ok(byId.get("sys-labor")?.issued_year_h === 1426 && byId.get("sys-policy")?.issued_year_h === null, "D سنة الإصدار من أداة الإصدار، وبلا أداة null");
  ok(byId.get("sys-lawaih")?.kind === "لائحة" && byId.get("sys-policy")?.kind === "سياسة", "D النوع من العنوان");

  const cats = await handleListCategories(db);
  const labor = cats.categories.find((c) => c.code === "labor");
  ok(labor?.laws === 4 && labor.in_force === 3 && cats.categories.some((c) => c.name === "غير مصنّف"), "D التصنيفات بأعدادها والساري منها، وغير المصنّف ظاهر");
  ok(cats.kinds.find((k) => k.kind === "نظام")?.laws === 5 && cats.total_laws === 7, "D الأنواع بأعدادها");

  const ll = await handleListLaws(db, { category: "labor", sort: "issued" });
  ok(ll.total === 4 && ll.laws[0].law_id === "sys-marine" && ll.laws.some((l) => l.law_id === "sys-old"), "D تصفح بالتصنيف، الأحدث أولًا، والافتراض كل الحالات");
  const ll2 = await handleListLaws(db, { category: "labor", status: "in_force", issued_from_h: 1420 });
  ok(ll2.total === 2 && !ll2.laws.some((l) => l.law_id === "sys-old" || l.law_id === "sys-lawaih"), "D in_force وسنة الإصدار (بلا سنة لا يدخل)");
  const pg1 = await handleListLaws(db, { limit: 3, offset: 0 });
  const pg2 = await handleListLaws(db, { limit: 3, offset: pg1.next_offset ?? 0 });
  ok(pg1.returned === 3 && pg1.next_offset === 3 && pg2.laws[0].law_id !== pg1.laws[0].law_id, "D ترقيم list_laws");

  // الحسم
  const rs = await handleResolve(db, { q: "المعاملات المدنيه" });
  ok(rs.candidates[0]?.law_id === "sys-civil", `D بوابة: «المعاملات المدنيه» ← نظام المعاملات المدنية (${rs.candidates[0]?.match})`);
  const rs2 = await handleResolve(db, { q: "نظام المرافعات الشرعيه" });
  ok(rs2.candidates[0]?.law_id === "sys-mur" && rs2.candidates[0].match === "exact", "D الاسم الكامل بالتاء المربوطة هاءً = مطابقة تامة");
  const rs3 = await handleResolve(db, { q: "نظام المرفعات الشرعية" });
  ok(rs3.candidates[0]?.law_id === "sys-mur" && rs3.candidates[0].match === "fuzzy", "D خطأ إملائي («المرفعات») ← أقرب اسم fuzzy");
  const rs4 = await handleResolve(db, { q: "نظام العمل" });
  ok(rs4.candidates[0]?.law_id === "sys-labor" && rs4.candidates.some((c) => c.law_id === "sys-old"), "D «نظام العمل» تامة، والبدائل تشمل القديم");
  const rsOld = await handleResolve(db, { q: "نظام العمل والعمال" });
  ok(rsOld.candidates[0]?.law_id === "sys-old" && rsOld.candidates[0].match === "exact" && rsOld.candidates[0].status === "لاغي", "D اسم النظام الملغى نفسه يُحسم إليه (لا اسم مستعار يحوّله إلى الجديد)");
  const rsLong = await handleResolve(db, { q: "نظام حماية البيانات الشخصية والخصوصية الرقمية" });
  ok(rsLong.count === 0, `D اسم طويل لا يقابله نظام: لا مرشحين (كان يقبل كل نظام؛ ${rsLong.count})`);
  const rsTypo = await handleResolve(db, { q: "اللائحة التنفيدية لنظام العمل" });
  ok(rsTypo.candidates[0]?.law_id === "sys-lawaih" && rsTypo.candidates[0].match === "fuzzy" && rsTypo.candidates[0].score <= 0.6, "D خطأ إملائي في اسم طويل ← الاسم الصحيح، ودرجة fuzzy دون الاحتواء");
  const rs5 = await handleResolve(db, { q: "نظام الطيران المدني" });
  ok(rs5.count === 0 && /لا نظام/.test(rs5.note), "D اسم لا يقابله نظام: لا مرشحين وملاحظة صريحة");

  // الإحصاء والحالة
  const st = await handleStats(db);
  ok(st.laws.total === 7 && st.laws.by_status["لاغي"] === 1 && st.articles.total === 13 && st.articles.with_dated_versions === 1, `D الإحصاء: الأنظمة والمواد بلا الصف غير المادي (${st.articles.total})`);
  const y1444 = st.rulings.by_year_h?.find((y) => y.year_h === 1444);
  ok(st.rulings.total === 3 && st.rulings.by_court?.[0].court === "المحكمة العمالية" && y1444?.count === 1, "D الأحكام بالمحكمة وبالسنة الهجرية (أرقام هندية)");
  ok(st.bylaw_links === 1 && st.thesaurus_concepts === 2, "D روابط اللوائح ومفاهيم المكنز");
  const leaky: SqlClient = { query: async () => { throw Object.assign(new Error("Can't reach database server at ep-secret-host.neon.tech:5432 user neondb_owner"), {}); } };
  const hb = await handleHealth(leaky, { tools: 25, semantic: true });
  ok(hb.status === "degraded" && !JSON.stringify(hb).includes("neon") && hb.database.error === "unreachable", "D الحالة عند تعذر القاعدة: رمز لا نص الخطأ (لا مضيف ولا مستخدم)");
  const hl = await handleHealth(db, { tools: 25, semantic: false });
  ok(hl.status === "ok" && hl.database.reachable && hl.corpus?.laws === 7 && hl.semantic_search === "disabled", "D الحالة: القاعدة والمدونة والدلالي");

  // التصفية المسبقة في القاعدة = translate ثم الاحتواء (على كل مواد القاعدة المحلية وألفاظ متنوعة)
  {
    const lits = ["فسخ", "عقد", "هييه", "مكافاه", "30", "الي", "العمل", "صاحب العمل", "تعويض"];
    let bad = 0;
    for (const l of lits) {
      const r = await db.query<{ a: number; b: number }>(
        `SELECT count(*) FILTER (WHERE content ~* $1)::int AS a, count(*) FILTER (WHERE ${normSqlExpr("content")} ILIKE '%' || $2 || '%')::int AS b FROM legal_articles`,
        [rawLiteralPattern(l), l],
      );
      if (r[0].a !== r[0].b) {
        bad++;
        ok(false, `D التصفية المسبقة «${l}»: ${r[0].a} مقابل ${r[0].b}`);
      }
    }
    ok(bad === 0, "D التصفية المسبقة على الخام في القاعدة تكافئ translate+ILIKE");
  }

  // النطاق
  const sc = await lawScopeForFilters(db, { status: "in_force" });
  ok(sc.include === null && sc.exclude.join() === "sys-old" && sc.excluded_retired === 1, "D النطاق الافتراضي: استبعاد الملغى وحده");

  // العبارة
  const ph = await handleSearchPhrase(db, { phrase: "فسخ العقد" }, deps);
  const phIds = ph.page.map((h) => h.article_id).sort();
  ok(ph.total === 3 && ph.by_law.length === 3, `D عبارة «فسخ العقد»: ثلاث مواد في ثلاثة أنظمة (${ph.total})`);
  ok(!phIds.includes("a-old-074") && !phIds.includes("a-lab-x00") && phIds.includes("a-civ-107") && phIds.includes("a-lab-080"), `D عبارة: بلا النظام الملغى ولا الصف غير المادي (${phIds.join("، ")})`);
  ok(ph.scope.excluded_retired_laws === 1 && /status="all"/.test(ph.note), "D الملاحظة تذكر استبعاد الملغى");
  const phAll = await handleSearchPhrase(db, { phrase: "فسخ العقد", status: "all" }, deps);
  ok(phAll.page.some((h) => h.article_id === "a-old-074") && phAll.total === ph.total + 1, "D status=all يدخل الملغى");
  const phEx = await handleSearchPhrase(db, { phrase: "فسخ العقد", match: "exact" }, deps);
  const phW = await handleSearchPhrase(db, { phrase: "فسخ عقد", match: "word" }, deps);
  const phE2 = await handleSearchPhrase(db, { phrase: "فسخ عقد", match: "exact" }, deps);
  ok(phEx.total === ph.total && phW.total === ph.total && phE2.total === 0 && /فلم توجد مادة/.test(phE2.note), "D exact بلا سوابق: «فسخ عقد» لا تطابق «فسخ العقد»، وword تطابقها");
  const phLaw = await handleSearchPhrase(db, { phrase: "فسخ العقد", category: "civil" }, deps);
  ok(phLaw.total === 1 && phLaw.by_law[0].law_id === "sys-civil", "D مرشح التصنيف");
  const phKind = await handleSearchPhrase(db, { phrase: "فسخ العقد", kind: "لائحة" }, deps);
  ok(phKind.total === 1 && phKind.page[0].article_id === "a-law-001", "D مرشح النوع");
  const phNone = await handleSearchPhrase(db, { phrase: "فسخ العقد", category: "لا-يوجد" }, deps);
  ok(phNone.total === 0 && /لا نظام يطابق المرشحات/.test(phNone.note), "D مرشحات لا يطابقها نظام: ليس نفيًا");
  const p1 = await handleSearchPhrase(db, { phrase: "فسخ العقد", page_size: 1 }, deps);
  const p2 = await handleSearchPhrase(db, { phrase: "فسخ العقد", page_size: 1, cursor: p1.next_cursor ?? undefined }, deps);
  ok(p1.page.length === 1 && p1.next_cursor !== null && p2.page[0].article_id > p1.page[0].article_id && p2.total === p1.total, "D ترقيم cursor ثابت العدد");
  const amNew = await handleSearchPhrase(db, { phrase: "يستحق الطرف المتضرر" }, deps);
  ok(amNew.total === 1 && amNew.page[0]?.article_id === "a-lab-077" && amNew.page[0].amended && amNew.page[0].term_in_current_text, "D عبارة في النص الساري المعدّل وحده تُوجد (لا «فُتّش فلم يوجد»)");
  const amBool = L(await handleSearchBoolean(db, { query: '"يستحق الطرف المتضرر" -فسخ' }, deps));
  ok((amBool.page ?? []).map((h) => h.article_id).join() === "a-lab-077", "D المنطقي يطابق النص الساري المعدّل أيضًا");
  const am = await handleSearchPhrase(db, { phrase: "تعويض تقدره هيئة" }, deps);
  ok(am.total === 1 && am.page[0].amended && !am.page[0].term_in_current_text, "D مادة معدّلة لم يعد نصها الساري يحوي العبارة: موسومة");

  // المنطقي
  const b1 = L(await handleSearchBoolean(db, { query: "(فسخ أو ينفسخ) العقد دون تعويض", match: "word" }, deps));
  const b1ids = (b1.page ?? []).map((h) => h.article_id).sort();
  ok(JSON.stringify(b1ids) === JSON.stringify(["a-civ-107", "a-civ-108", "a-law-001"]), `D منطقي: OR وAND وNOT (${b1ids.join("، ")})`);
  ok(b1.parsed === "(فسخ OR ينفسخ) AND العقد AND NOT تعويض" && JSON.stringify(b1.excluded_terms) === JSON.stringify(["تعويض"]), "D parsed والألفاظ المنفية");
  // OR متداخل فيه فرع منفي (كان يسقط بـ 42P18: معامل تصفية لا يرد في SQL)، ومطابقة SQL لتقييم الكود على المدونة كلها.
  const nestedQ = "العقد (تعويض أو -الهيئة)";
  const bn = L(await handleSearchBoolean(db, { query: nestedQ }, deps));
  const allArts = await db.query<{ id: string; content: string; law_id: string; bis: number }>(`SELECT id, content, "legalSystemId" AS law_id, "articleBis" AS bis FROM legal_articles`);
  const curText = await deps.effective(allArts.map((a) => ({ id: a.id, content: a.content })));
  const nestedTree = parseBoolean(nestedQ, "word");
  const expectNested = allArts
    .filter((a) => a.bis < 100 && a.law_id !== "sys-old")
    // المعدّلة بنصها الساري وحده، وغيرها بمحفوظها.
    .filter((a) => {
      const e = curText.get(a.id);
      return evalBoolean(nestedTree, normalizeAr(e?.source === "unit_version" ? e.text : a.content));
    })
    .map((a) => a.id)
    .sort();
  const gotNested = (bn.page ?? []).map((h) => h.article_id).sort();
  ok(!bn.error && JSON.stringify(gotNested) === JSON.stringify(expectNested) && gotNested.length >= 4, `D OR متداخل بفرع منفي: بلا خطأ، وSQL = تقييم الكود (${gotNested.join("، ")})`);
  // النفي على المعدّلة بنصها الساري: «محددًا» في الساري وحده، و«هيئة» في القديم وحده.
  const bOld = L(await handleSearchBoolean(db, { query: '"لسبب غير مشروع" دون محددا' }, deps));
  const bNew = L(await handleSearchBoolean(db, { query: '"لسبب غير مشروع" دون هيئة' }, deps));
  ok(!(bOld.page ?? []).some((h) => h.article_id === "a-lab-077") && (bNew.page ?? []).some((h) => h.article_id === "a-lab-077"), "D المنطقي: المادة المعدّلة تُقيَّم بنصها الساري وحده (النفي لا يُفحص على القديم)");
  const b2 = L(await handleSearchBoolean(db, { query: "فسخ (العقد" }, deps));
  ok("error" in b2 && /لم يُغلق/.test(String(b2.error)) && "hint" in b2, "D خطأ الصيغة يُشرح بمثال ولا يُرمى");
  const b3 = L(await handleSearchBoolean(db, { query: '"صاحب العمل" -فسخ', status: "all" }, deps));
  const b3ids = (b3.page ?? []).map((h) => h.article_id).sort();
  ok(JSON.stringify(b3ids) === JSON.stringify(["a-lab-081", "a-lab-084"]), `D عبارة مع نفي (${b3ids.join("، ")})`);

  // تتبع النص
  const t1 = await handleTraceText(db, { text: "إذا انتهت علاقة العمل وجب على صاحب العمل أن يدفع إلى العامل مكافأة عن مدة خدمته" }, deps);
  ok(t1.verdict === "verbatim" && t1.matches[0]?.article_id === "a-lab-084" && /حرفيًّا/.test(t1.note), "D تتبع: اقتباس حرفي ← م84 عمل");
  const t2 = await handleTraceText(db, { text: "اذا انتهت علاقه العمل وجب على صاحب العمل ان يدفع للعامل مكافاه عن مده خدمته" }, deps);
  ok(t2.verdict === "near_verbatim" && t2.matches[0]?.article_id === "a-lab-084" && t2.matches[0].words_not_in_article.includes("للعامل"), `D تتبع: بتصرف يسير، وكلمات ليست في المادة (${t2.matches[0]?.words_not_in_article.join("، ")})`);
  const t3 = await handleTraceText(db, { text: "إذا أنهي العقد لسبب غير مشروع كان للطرف الذي أصابه ضرر من هذا الإنهاء الحق في تعويض" }, deps);
  ok(t3.matches[0]?.article_id === "a-lab-077" && t3.matches[0].matched_on === "before_amendment" && /قبل تعديلها/.test(t3.note), "D تتبع: الاقتباس نص ما قبل التعديل — تنبيه");
  const t4 = await handleTraceText(db, { text: "يلتزم المدين بالتعويض عن الضرر الناشئ عن عدم التنفيذ" }, deps);
  ok(t4.verdict === "verbatim" && t4.matches[0].matched_on === "repealed_text" && /ملغاة/.test(t4.note), "D تتبع: من مادة ملغاة — تنبيه");
  const t5 = await handleTraceText(db, { text: "تختص المحكمة العليا بمراقبة سلامة تطبيق أحكام الشريعة" }, deps);
  ok(t5.verdict === "not_found" && /ليس نفيًا/.test(t5.note), "D تتبع: غير موجود بملاحظة أمينة");
  const tNew = await handleTraceText(db, { text: "ما لم يتضمن العقد تعويضًا محددًا مقابل إنهائه من أحد الطرفين لسبب غير مشروع" }, deps);
  ok(tNew.verdict === "verbatim" && tNew.matches[0]?.article_id === "a-lab-077" && tNew.matches[0].matched_on === "current" && "candidates_capped" in tNew && tNew.candidates_capped === false, "D تتبع: اقتباس من النص الساري المعدّل ← حرفي (كان not_found)");
  const t6 = await handleTraceText(db, { text: "قصير جدا" }, deps);
  ok(t6.verdict === "too_short", "D تتبع: أقل من ثلاث كلمات");
  let rulingsPhrase = "";
  const t7 = await handleTraceText(db, { text: "مدة الاعتراض بطلب الاستئناف أو التدقيق ثلاثون يومًا", include_rulings: true }, {
    ...deps,
    rulings: async (p) => {
      rulingsPhrase = p;
      return { total: 0, total_is_lower_bound: false, results: [] };
    },
  });
  ok(t7.verdict === "verbatim" && t7.matches[0].article_id === "a-mur-187" && rulingsPhrase.split(" ").length === 6 && "rulings" in t7, "D تتبع مع الأحكام: أول ست كلمات عبارةً");

  // تتبع اقتباس من النص الساري لمادة معدّلة مطلعه عبارة متكررة في أكثر من 30 مادة (مراجعة الجودة على d11bc97، A).
  {
    const boiler = "يعمل بهذا النظام بعد مضي تسعين يوما من تاريخ نشره في الجريدة الرسمية";
    await db.query(`INSERT INTO legal_systems (id, name, "articleCount") VALUES ('sys-boil', 'نظام اصطناعي للنفاذ', 33)`);
    for (let i = 0; i < 32; i++)
      await db.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", title, content) VALUES ($1, 'sys-boil', 'نظام اصطناعي للنفاذ', $2, 'م', $3)`, [
        `b${String(i).padStart(3, "0")}`, i + 1, `${boiler}، ويلغي كل ما يتعارض معه من أحكام (${i}).`,
      ]);
    const current = `${boiler} وتتولى الهيئة الوطنية للرقابة إصدار القواعد التنفيذية خلال مدة لا تتجاوز سنة من نفاذه`;
    await db.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", title, content) VALUES ('zz-amended', 'sys-boil', 'نظام اصطناعي للنفاذ', 99, 'م', 'نص قديم مختلف تماما عن النص الساري')`);
    await db.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument) VALUES ('uv-boil', 'zz-amended', $1, '2020-01-01', 'المرسوم الملكي رقم (م/7)')`, [current]);
    resetUnitVersionCache();
    resetCatalogCache();
    const tb = await handleTraceText(db, { text: current }, deps);
    ok(tb.verdict === "verbatim" && tb.matches[0]?.article_id === "zz-amended" && tb.matches[0].matched_on === "current" && !/قد يكون المصدر خارجها/.test(tb.note), `D تتبع: المعدّلة لا تسقط دون حد المرشحين حين يتكرر مطلع الاقتباس (${tb.verdict}، ${tb.matches[0]?.article_id})`);
    const tg = await handleTraceText(db, { text: `${boiler} وكلام آخر لا يرد في أي مادة البتة هنا` }, deps);
    ok("candidates_capped" in tg && tg.candidates_capped === true && /قد يكون المصدر خارجها/.test(tg.note), "D تتبع: اقتباس عام متكرر بلا مطابقة حرفية — تنبيه حد المرشحين");
  }

  // البصمة
  const art84 = (await deps.effective([{ id: "a-lab-084", content: (await db.query<{ content: string }>(`SELECT content FROM legal_articles WHERE id='a-lab-084'`))[0].content }])).get("a-lab-084")!;
  const ref84 = articleRef("a-lab-084", art84.text);
  ok((await handleCheckRef(db, { ref: ref84 }, deps)).status === "valid", "D البصمة صحيحة للنص الساري");
  const orig77 = (await db.query<{ content: string }>(`SELECT content FROM legal_articles WHERE id='a-lab-077'`))[0].content;
  const c77 = await handleCheckRef(db, { ref: articleRef("a-lab-077", orig77) }, deps);
  ok(c77.status === "changed" && "change" in c77 && c77.change === "amended_since_ref" && /قبل تعديلها/.test(c77.note), "D البصمة لنص ما قبل التعديل: changed/amended_since_ref");
  ok((await handleCheckRef(db, { ref: `hakeem:art:a-lab-084:${"0".repeat(12)}` }, deps)).status === "changed", "D بصمة لا تطابق شيئًا: changed");
  ok((await handleCheckRef(db, { ref: articleRef("a-civ-200", "x") }, deps)).status === "repealed", "D مادة ملغاة: repealed");
  ok((await handleCheckRef(db, { ref: "a-lab-084" }, deps)).status === "no_fingerprint" && (await handleCheckRef(db, { ref: "hakeem:art:zzzzzzzz:aaaaaaaaaaaa" }, deps)).status === "not_found", "D معرّف بلا بصمة، ومعرّف غير موجود");
  ok((await handleCheckRef(db, { ref: "a-lab-x00" }, deps)).status === "not_an_article" && (await handleCheckRef(db, { ref: "??" }, deps)).status === "invalid_ref", "D صف غير مادي، وصيغة غير صالحة");

  // الاستناد
  const g1 = L(await handleGetCitation(db, { article_id: "a-lab-084", style: "full" }, deps));
  ok(g1.short === "المادة (84) من نظام العمل" && /الصادر بالمرسوم الملكي رقم \(م\/51\)/.test(String(g1.full)) && g1.ref === ref84, `D استناد كامل بأداة الإصدار وبصمة: ${g1.full}`);
  ok(String(g1.footnote).includes("https://hakeem.test/legal/sys-labor/84"), "D الحاشية برابط المادة");
  const g2 = L(await handleGetCitation(db, { article_id: "a-lab-077" }, deps));
  ok(/والمعدّلة بموجب المرسوم الملكي رقم \(م\/46\)/.test(String(g2.full)) && g2.status === "معدّلة", "D استناد مادة معدّلة بأداة التعديل");
  const g3 = L(await handleGetCitation(db, { article_id: "a-civ-200" }, deps));
  ok(/\(ملغاة بموجب المرسوم الملكي رقم \(م\/9\)/.test(String(g3.full)), "D استناد مادة ملغاة");
  const g4 = L(await handleGetCitation(db, { ruling_id: "r1", style: "short" }, deps));
  ok(g4.citation === "حكم المحكمة العمالية رقم (4470099) لعام 1444هـ" && /في الرياض في القضية رقم \(4470001\)/.test(String(g4.full)), `D استناد حكم: ${g4.full}`);
  ok("error" in (await handleGetCitation(db, {}, deps)) && "error" in (await handleGetCitation(db, { article_id: "nope" }, deps)), "D بلا معرّف أو معرّف غير موجود: خطأ صريح");

  // الفهرس
  const toc = await handleGetToc(db, { name: "نظام المرافعات الشرعية", limit: 2 }, deps);
  ok("divisions" in toc && toc.divisions.length === 2 && toc.divisions[1].heading === "الباب الحادي عشر: طرق الاعتراض على الأحكام" && toc.divisions[1].from === "186" && toc.divisions[1].to === "187", "D التقسيمات بأول مادة وآخرها");
  ok("articles_page" in toc && toc.articles.length === 2 && toc.articles_page.next_offset === 2 && toc.articles[1].division === 1, "D فهرس المواد صفحاتٍ مع رقم التقسيم");
  const toc2 = await handleGetToc(db, { law_id: "sys-civil" }, deps);
  ok("articles" in toc2 && toc2.articles.find((a) => a.article_id === "a-civ-200")?.status === "ملغى" && /لا تقسيمات/.test(toc2.note), "D حالة المادة الملغاة، ونظام بلا تقسيمات");
  ok("error" in (await handleGetToc(db, {}, deps)), "D الفهرس بلا نظام: خطأ صريح");

  // الدلالي (متجهات وهمية)
  const vec = async () => [
    { id: "a-mur-186", score: 0.82 },
    { id: "a-mur-187", score: 0.8 },
    { id: "a-old-074", score: 0.79 },
    { id: "a-lab-x00", score: 0.95 },
  ];
  const s1 = await handleSemanticSearch(db, { query: "كم مدة الاستئناف على الحكم في نظام المرافعات الشرعية" }, { ...deps, enabled: () => true, vectorSearch: vec });
  ok(s1.status === "ok" && s1.results[0]?.article_id === "a-mur-187" && s1.results[0].law_named_in_query, `D الدلالي: تغطية الألفاظ والنظام المسمّى ترفع م187 فوق م186 (${s1.results.map((r) => `${r.article}:${r.score}`).join("، ")})`);
  ok(!s1.results.some((r) => r.article_id === "a-lab-x00" || r.article_id === "a-old-074") && (s1.scope as { dropped_by_filters?: number } | undefined)?.dropped_by_filters === 1, "D الدلالي: لا صف غير مادي، والملغى يسقطه المرشح الافتراضي");
  const s2 = await handleSemanticSearch(db, { query: "مدة" }, { ...deps, enabled: () => false, vectorSearch: vec });
  ok(s2.status === "disabled" && /ليس نفيًا/.test(s2.note), "D الدلالي المعطّل: نتيجة صريحة لا قائمة فارغة");
}

async function main() {
  const conn = await connectLocalTest(URL_P1);
  if (!conn) {
    console.log("⚠ تخطٍّ: لا قاعدة محلية — اختبارات D لم تُشغَّل");
    if (REQUIRE_DB) ok(false, "D يلزم Postgres محلي (HKM044_REQUIRE_DB=1)");
  } else {
    try {
      await setup(conn.db);
      await dbTests(conn.db);
    } finally {
      await conn.client.end();
    }
  }
  console.log(`\n${passed} نجح، ${failed} فشل`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
