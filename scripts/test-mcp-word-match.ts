/**
 * HKM-044: مطابقة الحصر بحدود الكلمة (lib/mcp/tools/word-match.ts) وملاحظات النفي ووضع بطاقة النظام المختصر.
 *   W-*  المطابقة في الكود: الحالات التي فشلت في فحص 24/10/2026 حيًّا عبر الموصل، ونظائرها.
 *   N-*  ملاحظات النفي: ثلاث حالات، ولا «تغطية شاملة» بلا قيد.
 *   Q-*  ملاحظات المراجعة المستقلة على 567a895 (السوابق المركبة، الكلمات الوظيفية، «ال» والضمير، النسبة…).
 *   P-*  المطابقة نفسها داخل Postgres (~* وtranslate) وشرط WHERE للحصر على قاعدة محلية _test.
 *        غياب القاعدة تخطٍّ معلَن، وفشلٌ إن ضُبط HKM044_REQUIRE_DB=1 (أو CI).
 * لا إنتاج ولا فرع منه: النصوص اصطناعية أو جمل قصيرة بصيغ الأنظمة.
 */
import { compileTerm, matchesText, normalizeAr, type MatchMode } from "../lib/mcp/tools/word-match";
import { amendedMatchIds, enumerateNote, enumerateWhereSql, NORM_LATERAL, resetUnitVersionCache, termConditionSql, VERSION_REFS } from "../lib/mcp/tools/enumerate";
import { researchLexical, researchNote } from "../lib/mcp/tools/research";
import { NORM_TRANSLATE_FROM, NORM_TRANSLATE_TO, normSqlExpr, type CompiledTerm } from "../lib/mcp/tools/word-match";
import { connectLocalTest } from "./hkm-023-b/local-db";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};

/** [اللفظ، الوضع، نص، يطابق؟] */
type Case = [string, MatchMode, string, boolean];
const CASES: Case[] = [
  // ① «التعدي» لا تطابق «التعديل» (فحص 24/10: حصر «التعدي» في المعاملات المدنية أعاد م16 وم623 وكلتاهما «التعديل»)
  ["التعدي", "word", "ليس لأحدٍ النزول عن أهليته أو التعديل في أحكامها.", false],
  ["التعدي", "word", "من التغييرات الأساسية والتعديل في الغرض الذي أعد له", false],
  ["التعدي", "word", "يضمن الأمين بالتعدي أو التقصير", true],
  ["التعدي", "word", "إذا ثبت التعدي على المال", true],
  ["التعدي", "word", "ولا تسمع دعوى التعديات", true],
  ["التعدي", "derivatives", "ولا يتعدى حدود الوكالة", true],
  // ② «ربا» لا تطابق «الأرباح»
  ["ربا", "word", "توزيع الأرباح على الشركاء", false],
  ["ربا", "word", "كل شرط فيه ربا باطل", true],
  ["الربا", "word", "ولا يجوز الربا بالنقد", true],
  ["ربا", "derivatives", "توزيع الأرباح على الشركاء", false],
  ["ربا", "word", "ويكون الربان مسؤولًا عن رباني السفينة", false], // حصر 24/10: «رباني» في م398 من نظام المحكمة التجارية
  ["ربا", "word", "ولا يجوز الحكم بالربا", true],
  // ③ «غبون» المولَّدة لا تطابق «يرغبون» (أربع مواد من عشر في بحث «الغبن»)
  ["غبون", "derivatives", "إذا كان طالبو التأسيس يرغبون بتأسيس الصندوق", false],
  ["غبون", "derivatives", "فللمتعاقد المغبون أن يطلب", true],
  ["غبون", "derivatives", "بناء على طلب المتعاقد المغبون", true],
  ["غبن", "derivatives", "لإبرام عقدٍ لحقه منه غبنٌ", true],
  ["غبن", "derivatives", "ما يرفع عنه الغبن", true],
  ["غبن", "derivatives", "إذا اشترى الوكيل بغبن", true],
  ["غبان", "derivatives", "يرغبون في الاستفادة", false],
  // ④ «فسخ» ومشتقاتها
  ["فسخ", "word", "للمتعاقد طلب فسخ العقد", true],
  ["فسخ", "word", "جاز للدائن الفسخ", true],
  ["فسخ", "word", "إذا فسخه أحد الطرفين", true],
  ["فسخ", "word", "وفسختها المحكمة", true],
  ["فسخ", "word", "ينفسخ العقد من تلقاء نفسه", false],
  ["فسخ", "derivatives", "ينفسخ العقد من تلقاء نفسه", true],
  ["فسخ", "derivatives", "انفسخ العقد", true],
  ["فسخ", "derivatives", "يفسخ العقد", true],
  ["فساخ", "derivatives", "ويترتب على الانفساخ", true],
  ["فساخ", "derivatives", "بانفساخ العقد", true],
  ["فسوخ", "derivatives", "يعد العقد مفسوخًا من تلقاء نفسه", true],
  // حصر 24/10: «تعويض» بالكلمة الكاملة أسقط «تعويضيًا» و«الحق» أسقط «الحقوق» و«الحقيقة» (صواب)
  ["تعويض", "word", "يستحق مبلغًا تعويضيًا", false], // النسبة في derivatives وحده (مراجعة الجودة ٣)
  ["تعويض", "derivatives", "يستحق مبلغًا تعويضيًا", true],
  ["الحق", "word", "حماية الحقوق", false],
  ["الحق", "word", "في الحقيقة", false],
  ["المدة", "word", "شركة المدهون", false],
  ["المدة", "word", "خلال مدته", true],
  // ⑤ التاء المربوطة والسوابق
  ["الشفعة", "word", "الشفعة حق الشريك في أن يتملّك العقار المبيع", true],
  ["الشفعة", "word", "يجوز لكل من يملك حق الشفعة", true],
  ["الشفعة", "word", "إعلان رغبته في الأخذ بالشفعة", true],
  ["الشفعه", "word", "بالشفعة", true],
  ["الشركة", "word", "على كل شركة طرف في الاندماج", true],
  ["الشركة", "word", "دائني الشركات المندمجة", true],
  ["الشركة", "word", "اجتماع الشركتين", true],
  ["الشركة", "word", "شريك في الشركتان", true],
  // ⑥ «ال» القصيرة والهمزة
  ["الحق", "word", "لا يسقط الحق بالتقادم", true],
  ["الحق", "word", "انتصارًا للحق", true],
  ["الحق", "word", "قضى بالحق", true],
  ["الله", "word", "له أن يطلب", false],
  ["إلزام", "word", "طلب إلزام المدعى عليه", true],
  ["إلزام", "word", "بإلزام المدعى عليها", true],
  ["الزام", "word", "طلب الإلزام", true],
  // ⑦ التطبيع: التشكيل والتطويل والألف المقصورة
  ["فسخ", "word", "طلب الفَسْخ", true],
  ["فسخ", "word", "طلب الفســخ", true],
  ["تعدى", "word", "إذا تعدّى الأمين", true],
  // ⑧ العبارة بكلماتها وترتيبها
  ["فسخ العقد", "word", "يجوز للمحكمة فسخ العقد", true],
  ["فسخ العقد", "word", "بفسخ العقد وإعادة الحال", true],
  ["فسخ العقد", "word", "فسخ، العقد", true],
  ["فسخ العقد", "word", "العقد قابل للفسخ", false],
  // ⑨ غير العربي: كلمة كاملة
  ["30", "word", "خلال (30) يومًا", true],
  ["30", "word", "خلال (300) يوم", false],
  // ⑩ الاحتواء صراحةً يبقي السلوك القديم
  ["التعدي", "contains", "أو التعديل في أحكامها", true],
  ["غبون", "contains", "يرغبون بتأسيس", true],
  // ⑪ مراجعة الجودة ١: السوابق المركبة لا تُجرَّد
  ["والدين", "word", "نفقة الوالدين", true],
  ["والدين", "word", "سداد الدين", false],
  ["والديه", "word", "ما لديه من مال", false],
  ["بالغين", "word", "الأشخاص البالغين", true],
  // ⑫ مراجعة الجودة ٢: التاء القصيرة والكلمات الوظيفية
  ["آلة", "word", "المادة التي تليها", false],
  ["آلة", "word", "لله الأمر", false],
  ["آلة", "word", "استعمال آلة حادة", true],
  ["الدية", "word", "ما لديه من أموال", false],
  ["الدية", "word", "تجب الدية على العاقلة", true],
  ["الدية", "word", "دفع ديته", true],
  // ⑬ مراجعة الجودة ٣: لا ضمير بعد «ال»، والنسبة في derivatives
  ["مال", "word", "حقوق المالك", false],
  ["مال", "word", "الأوراق المالية", false],
  ["مال", "word", "رأس المال", true],
  ["مال", "word", "رأس ماله", true],
  ["مال", "word", "حقوق مالك العقار", false], // فحص 24/10: «مالك» 489 مرة و«مالي» 409 في المدونة
  ["مال", "word", "مركز مالي", false],
  ["مال", "derivatives", "مركز مالي", true],
  ["رسم", "word", "الجريدة الرسمية", false],
  ["عمل", "word", "العملية الجراحية", false],
  ["عمل", "word", "صاحب العمل", true],
  ["شرط", "word", "رجال الشرطة", false],
  ["شرط", "word", "الشرط الجزائي", true],
  ["جمع", "word", "الجمعية العامة", false],
  ["تعويض", "derivatives", "الدعوى التعويضية", true],
  // ⑭ مراجعة الجودة ١٠: صرفيات وأرقام هندية
  ["فسخ", "derivatives", "وللدائن أن سيفسخ العقد", true],
  ["فسخ", "derivatives", "إن لم يفسخوه", true],
  ["30", "word", "خلال (٣٠) يومًا", true],
  ["٣٠", "word", "خلال (30) يومًا", true],
  ["الشركه", "word", "دائني الشركات", true],
  ["التنبيه", "word", "قراءة التنبيهات", true],
];

for (const [term, mode, text, expect] of CASES) {
  const c = compileTerm(term, mode);
  ok(c !== null && matchesText(text, c) === expect, `W ${mode} «${term}» ${expect ? "يطابق" : "لا يطابق"}: ${text}`);
}

ok(compileTerm("؟؟", "word") === null, "W لفظ بلا حرف ولا رقم يُرفض");
ok(compileTerm("  ", "word") === null, "W لفظ فارغ يُرفض");
const longPhrase = compileTerm(Array.from({ length: 40 }, () => "فسخ").join(" "), "word");
const words = (n: number) => Array.from({ length: n }, () => "فسخ").join(" ");
ok(longPhrase !== null && matchesText(words(16), longPhrase) && !matchesText(words(15), longPhrase), "W العبارة مسقوفة بـ16 كلمة (تطابق 16 ولا تطابق 15)");
ok(normalizeAr("أإآٱ ى ة ؤ ئ ـ ٣٠") === "اااا ي ه و ي  30", "W التطبيع: الهمزات والوصلية والمقصورة والمربوطة والتطويل والأرقام الهندية");
ok(longPhrase?.truncated === true && compileTerm("فسخ العقد", "word")?.truncated === undefined, "Q العبارة المقطوعة موسومة truncated");
const amb = compileTerm("آلية", "word");
ok(amb !== null && (amb.ambiguous ?? []).includes("اليه") && matchesText("رجع إليه", amb), "Q «آلية» تلتبس بـ«إليه» بعد التطبيع: لا حاجز، وموسومة ambiguous");
ok(compileTerm("الدية", "word")?.ambiguous === undefined, "Q «الدية» ليست ملتبسة (الحاجز يمنع «لديه»)");
const nTr = enumerateNote({ total: 3, hasMore: false, mode: "word", rejected: [], truncated: ["عبارة طويلة"], ambiguous: ["اليه"] });
ok(/قُطعت 1 عبارة/.test(nTr) && /يلتبس بعد التطبيع/.test(nTr), "Q الملاحظة تعلن القطع والالتباس");
const nScope = enumerateNote({ total: 0, hasMore: false, mode: "word", rejected: [] }) + enumerateNote({ total: 0, hasMore: false, lawId: "x", mode: "word", rejected: [] });
ok(!/كلها كله/.test(nScope) && !/لـ[^\s]/.test(nScope) && /مدونة حكيم كلها/.test(nScope) && /النظام المحدد \(law_id\) كله/.test(nScope), "Q صياغة النطاق («كلها» لا «كلها كله»، ولا «لـال»)");
const rl = researchLexical("الغبن");
ok(rl.head === "غبن" && rl.compiled.length === 3 && rl.compiled.every((c) => c.mode === "derivatives") && !rl.compiled.some((c) => matchesText("يرغبون بتأسيس", c)) && rl.compiled.some((c) => matchesText("المتعاقد المغبون", c)), "Q البحث الموضوعي: صيغ الرأس بوضع derivatives، و«يرغبون» خارجها و«المغبون» داخلها");
const rRej = researchNote({ head: "؟", forms: ["؟"], lexicalTotal: 0, shown: 0, more: false, rejected: true });
ok(/رُفض رأس الموضوع/.test(rRej) && !/فُتّش/.test(rRej), "Q البحث الموضوعي: الرأس المرفوض لا يُوصف بأنه فُتّش");
ok(compileTerm("الغبن", "word")?.literal === "غبن", "W «ال» تُجرَّد إن بقي ثلاثة أحرف (التصفية على «غبن»)");
ok(compileTerm("الشركة", "word")?.literal === "شرك", "W التصفية للتاء المربوطة على أصل الكلمة");

// ── ملاحظات النفي ──
const n0 = enumerateNote({ total: 0, hasMore: false, mode: "word", rejected: [] });
ok(/فُتّش مدونة حكيم كلها/.test(n0) && /نفي في هذا النطاق وبهذه الصيغ وحدها/.test(n0), "N صفر: فُتّش النطاق كله، ونفي محدود بالنطاق والصيغ");
const nAll = enumerateNote({ total: 6, hasMore: false, mode: "word", rejected: [] });
ok(/هذه كل المواد المطابقة/.test(nAll) && /لا جزء كلمة/.test(nAll), "N كامل: كل المطابق مع طريقة المطابقة");
const nMore = enumerateNote({ total: 120, hasMore: true, mode: "derivatives", rejected: ["؟"] });
ok(/cursor/.test(nMore) && /رُفض 1 لفظ/.test(nMore), "N صفحات: المتابعة بـ cursor، والألفاظ المرفوضة معلنة");
const r0 = researchNote({ head: "غبن", forms: ["غبن", "غبان", "غبون"], lexicalTotal: 0, shown: 0, more: false });
ok(/فُتّش/.test(r0) && /نفي لفظي/.test(r0) && !/التغطية شاملة/.test(r0), "N بحث موضوعي صفر: نفي لفظي في النطاق");
const r6 = researchNote({ head: "غبن", forms: ["غبن", "غبان", "غبون"], lexicalTotal: 6, shown: 6, more: false });
ok(/مكتمل/.test(r6) && /الشمول لفظي لا دلالي/.test(r6) && !/التغطية شاملة/.test(r6), "N بحث موضوعي: مكتمل لفظيًّا، لا ادعاء شمول دلالي");
const rMore = researchNote({ head: "فسخ", forms: ["فسخ"], lexicalTotal: 118, shown: 50, more: true });
ok(/118/.test(rMore) && /أول 50/.test(rMore) && /derivatives/.test(rMore), "N بحث موضوعي بصفحات: العدد كامل والمعروض جزء");

// ── المطابقة داخل Postgres ──
const REQUIRE_DB = process.env.HKM044_REQUIRE_DB === "1" || Boolean(process.env.CI);
async function pgTests() {
  const conn = await connectLocalTest(process.env.HKM044_TEST_DATABASE_URL || "postgres://hakeem:localtest@127.0.0.1:54329/hakeem_hkm044_test");
  if (!conn) {
    console.log("⚠ تخطٍّ: لا قاعدة محلية — اختبارات P (تطابق القاعدة والكود) لم تُشغَّل");
    if (REQUIRE_DB) ok(false, "P يلزم Postgres محلي (HKM044_REQUIRE_DB=1)");
    return;
  }
  const { client, db } = conn;
  try {
    await db.query(`DROP TABLE IF EXISTS legal_articles`);
    await db.query(`CREATE TABLE legal_articles (id text PRIMARY KEY, content text NOT NULL, "articleBis" int NOT NULL DEFAULT 0, "legalSystemId" text)`);
    const texts = [...new Set(CASES.map((c) => c[2]))];
    const idOf = new Map(texts.map((t, i) => [t, `t${String(i).padStart(3, "0")}`]));
    for (const t of texts) await db.query(`INSERT INTO legal_articles (id, content) VALUES ($1, $2)`, [idOf.get(t), t]);
    let agree = 0;
    for (const [term, mode, text, expect] of CASES) {
      const c = compileTerm(term, mode)!;
      const params: unknown[] = [];
      const cond = termConditionSql(c, params);
      params.push(idOf.get(text));
      const rows = await db.query<{ id: string }>(`SELECT a.id FROM legal_articles a ${NORM_LATERAL} WHERE ${cond} AND a.id = $${params.length}`, params);
      const got = rows.length === 1;
      if (got === expect) agree++;
      else ok(false, `P ${mode} «${term}» في Postgres ${expect ? "يطابق" : "لا يطابق"}: ${text}`);
    }
    ok(agree === CASES.length, `P Postgres يوافق الكود في كل الحالات (${agree}/${CASES.length})`);
    // التطبيع داخل القاعدة = normalizeAr (بالتعبير المصدَّر نفسه)
    const sample = "أإآٱ ى ة ؤ ئ فَسْخ الفســخ ٣٠٠";
    const n = await db.query<{ n: string }>(`SELECT ${normSqlExpr("$1::text")} AS n`, [sample]);
    ok(n[0].n === normalizeAr(sample), "P تطبيع translate في القاعدة = normalizeAr في الكود (normSqlExpr)");
    ok(NORM_TRANSLATE_FROM.length >= NORM_TRANSLATE_TO.length && NORM_TRANSLATE_TO.length === 18, "P جدول translate: 8 حروف و10 أرقام، والباقي يُحذف");

    // شرط WHERE للحصر (مراجعة الجودة ٥): OR بين الألفاظ، واستبعاد الدرجة ≥ 100، والنظام، والمؤشر، واتساق الإجمالي.
    await db.query(`DELETE FROM legal_articles`);
    const rowsIn: Array<[string, string, number, string]> = [
      ["e01", "للمتعاقد طلب فسخ العقد", 0, "law-a"],
      ["e02", "يجوز الفسخ بحكم المحكمة", 0, "law-a"],
      ["e03", "ويضمن الأمين بالتعدي", 0, "law-b"],
      ["e04", "فسخ العقد (نص تاريخي لمادة ملغاة)", 100, "law-a"],
      ["e05", "أو التعديل في أحكامها", 0, "law-b"],
      ["e06", "وفسخه جائز", 0, "law-b"],
      ["e07", "ينفسخ العقد", 0, "law-a"],
    ];
    for (const [id, content, bis, law] of rowsIn) await db.query(`INSERT INTO legal_articles (id, content, "articleBis", "legalSystemId") VALUES ($1, $2, $3, $4)`, [id, content, bis, law]);
    const terms = (t: string[], mode: MatchMode = "word") => t.map((x) => compileTerm(x, mode)).filter((x): x is CompiledTerm => x !== null);
    const run = async (c: CompiledTerm[], o: { lawId?: string; cursor?: string; amendedIds?: string[] } = {}) => {
      const params: unknown[] = [];
      const w = enumerateWhereSql(c, o, params);
      return (await db.query<{ id: string }>(`SELECT a.id FROM legal_articles a ${NORM_LATERAL} WHERE ${w} ORDER BY a.id`, params)).map((r) => r.id);
    };
    const all = await run(terms(["فسخ", "التعدي"]));
    ok(all.join() === "e01,e02,e03,e06", `P WHERE: OR بين الألفاظ، والدرجة 100 مستبعدة، و«التعديل» و«ينفسخ» خارج word (${all.join()})`);
    const deriv = await run(terms(["فسخ"], "derivatives"));
    ok(deriv.join() === "e01,e02,e06,e07", `P WHERE derivatives: «ينفسخ» داخلها والدرجة 100 خارجها (${deriv.join()})`);
    const lawB = await run(terms(["فسخ", "التعدي"]), { lawId: "law-b" });
    ok(lawB.join() === "e03,e06", `P WHERE بنظام: law-b وحده (${lawB.join()})`);
    const page1 = all.slice(0, 2);
    const rest = await run(terms(["فسخ", "التعدي"]), { cursor: page1[page1.length - 1] });
    ok([...page1, ...rest].join() === all.join(), "P WHERE بمؤشر: الصفحات تغطي النتائج بلا تكرار ولا فقد، فالإجمالي = مجموع الصفحات");

    // النص الساري المعدّل (مراجعة الجودة على 308bdb3): مادة طابق نصُّها الساري تُضم ولو لم يطابق المحفوظ، وتبقى قيود الدرجة والنظام.
    const withAmended = await run(terms(["فسخ"]), { amendedIds: ["e05", "e04"] });
    ok(withAmended.join() === "e01,e02,e05,e06", `P WHERE مع معرّفات النص الساري: e05 داخل، والدرجة 100 خارجة ولو طابق ساريها (${withAmended.join()})`);
    const amendedLaw = await run(terms(["فسخ"]), { amendedIds: ["e05"], lawId: "law-a" });
    ok(amendedLaw.join() === "e01,e02", `P WHERE مع النص الساري ونظام: قيد النظام يبقى (${amendedLaw.join()})`);
    // amendedMatchIds على جدول النسخ: أحدث نسخة سارية وحدها، والمستقبلية لا.
    await db.query(`DROP TABLE IF EXISTS unit_version`);
    await db.query(`CREATE TABLE unit_version (id text PRIMARY KEY, unit_id text NOT NULL, body text NOT NULL, valid_from timestamptz NOT NULL)`);
    await db.query(`INSERT INTO unit_version VALUES ('v1','e05','يجوز فسخ الالتزام','2015-01-01'), ('v2','e03','نص قديم فيه فسخ','2010-01-01'), ('v3','e03','نص أحدث بلا اللفظ','2016-01-01'), ('v4','e07','فسخ مستقبلي','2999-01-01')`);
    resetUnitVersionCache();
    const vp: unknown[] = [];
    const vIds = await amendedMatchIds(db, termConditionSql(terms(["فسخ"])[0], vp, VERSION_REFS.norm, VERSION_REFS.raw), vp);
    ok(vIds.join() === "e05", `P معرّفات النص الساري: أحدث نسخة سارية الآن وحدها (${vIds.join()})`);
    await db.query(`DROP TABLE unit_version`);
    resetUnitVersionCache();
    ok((await amendedMatchIds(db, "TRUE", [])).length === 0, "P بلا جدول النسخ: لا معرّفات ولا خطأ");
  } finally {
    await client.end();
  }
}

pgTests()
  .catch((e) => ok(false, `P خطأ: ${(e as Error).message}`))
  .finally(() => {
    console.log(`\n${passed} نجح، ${failed} فشل`);
    process.exit(failed ? 1 : 0);
  });
