/**
 * HKM-044: مطابقة الحصر بحدود الكلمة (lib/mcp/tools/word-match.ts) وملاحظات النفي ووضع بطاقة النظام المختصر.
 *   W-*  المطابقة في الكود: الحالات التي فشلت في فحص 24/10/2026 حيًّا عبر الموصل، ونظائرها.
 *   N-*  ملاحظات النفي: ثلاث حالات، ولا «تغطية شاملة» بلا قيد.
 *   P-*  المطابقة نفسها داخل Postgres (~* وtranslate) على قاعدة محلية _test — تخطٍّ إن لم تتوفر.
 * لا إنتاج ولا فرع منه: النصوص اصطناعية أو جمل قصيرة بصيغ الأنظمة.
 */
import { compileTerm, matchesText, normalizeAr, type MatchMode } from "../lib/mcp/tools/word-match";
import { enumerateNote, termConditionSql } from "../lib/mcp/tools/enumerate";
import { researchNote } from "../lib/mcp/tools/research";
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
  ["تعويض", "word", "يستحق مبلغًا تعويضيًا", true],
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
];

for (const [term, mode, text, expect] of CASES) {
  const c = compileTerm(term, mode);
  ok(c !== null && matchesText(text, c) === expect, `W ${mode} «${term}» ${expect ? "يطابق" : "لا يطابق"}: ${text}`);
}

ok(compileTerm("؟؟", "word") === null, "W لفظ بلا حرف ولا رقم يُرفض");
ok(compileTerm("  ", "word") === null, "W لفظ فارغ يُرفض");
ok(normalizeAr("أإآٱ ى ة ؤ ئ ـ") === "اااا ي ه و ي ", "W التطبيع: الهمزات والوصلية والمقصورة والمربوطة والتطويل");
ok(compileTerm("الغبن", "word")?.literal === "غبن", "W «ال» تُجرَّد إن بقي ثلاثة أحرف (التصفية على «غبن»)");
ok(compileTerm("الشركة", "word")?.literal === "شرك", "W التصفية للتاء المربوطة على أصل الكلمة");

// ── ملاحظات النفي ──
const n0 = enumerateNote({ total: 0, hasMore: false, scopeLabel: "مدونة حكيم كلها", mode: "word", rejected: [] });
ok(/فُتّش مدونة حكيم كلها/.test(n0) && /نفي في هذا النطاق وبهذه الصيغ وحدها/.test(n0), "N صفر: فُتّش النطاق كله، ونفي محدود بالنطاق والصيغ");
const nAll = enumerateNote({ total: 6, hasMore: false, scopeLabel: "مدونة حكيم كلها", mode: "word", rejected: [] });
ok(/هذه كل المواد المطابقة/.test(nAll) && /لا جزء كلمة/.test(nAll), "N كامل: كل المطابق مع طريقة المطابقة");
const nMore = enumerateNote({ total: 120, hasMore: true, scopeLabel: "مدونة حكيم كلها", mode: "derivatives", rejected: ["؟"] });
ok(/cursor/.test(nMore) && /رُفض 1 لفظ/.test(nMore), "N صفحات: المتابعة بـ cursor، والألفاظ المرفوضة معلنة");
const r0 = researchNote({ head: "غبن", forms: ["غبن", "غبان", "غبون"], lexicalTotal: 0, shown: 0, more: false, scoped: false });
ok(/فُتّش/.test(r0) && /نفي لفظي/.test(r0) && !/التغطية شاملة/.test(r0), "N بحث موضوعي صفر: نفي لفظي في النطاق");
const r6 = researchNote({ head: "غبن", forms: ["غبن", "غبان", "غبون"], lexicalTotal: 6, shown: 6, more: false, scoped: false });
ok(/مكتمل/.test(r6) && /الشمول لفظي لا دلالي/.test(r6) && !/التغطية شاملة/.test(r6), "N بحث موضوعي: مكتمل لفظيًّا، لا ادعاء شمول دلالي");
const rMore = researchNote({ head: "فسخ", forms: ["فسخ"], lexicalTotal: 118, shown: 50, more: true, scoped: false });
ok(/118/.test(rMore) && /أول 50/.test(rMore) && /derivatives/.test(rMore), "N بحث موضوعي بصفحات: العدد كامل والمعروض جزء");

// ── المطابقة داخل Postgres ──
async function pgTests() {
  const conn = await connectLocalTest(process.env.HKM044_TEST_DATABASE_URL || "postgres://hakeem:localtest@127.0.0.1:54329/hakeem_hkm044_test");
  if (!conn) return;
  const { client, db } = conn;
  try {
    await db.query(`DROP TABLE IF EXISTS legal_articles`);
    await db.query(`CREATE TABLE legal_articles (id text PRIMARY KEY, content text NOT NULL, "articleBis" int NOT NULL DEFAULT 0)`);
    const texts = [...new Set(CASES.map((c) => c[2]))];
    for (let i = 0; i < texts.length; i++) await db.query(`INSERT INTO legal_articles (id, content) VALUES ($1, $2)`, [`t${String(i).padStart(3, "0")}`, texts[i]]);
    const idOf = new Map(texts.map((t, i) => [t, `t${String(i).padStart(3, "0")}`]));
    let agree = 0;
    for (const [term, mode, text, expect] of CASES) {
      const c = compileTerm(term, mode)!;
      const params: unknown[] = [];
      const cond = termConditionSql(c, params);
      params.push(idOf.get(text));
      const rows = await db.query<{ id: string }>(`SELECT a.id FROM legal_articles a WHERE ${cond} AND a.id = $${params.length}`, params);
      const got = rows.length === 1;
      if (got === expect) agree++;
      else ok(false, `P ${mode} «${term}» في Postgres ${expect ? "يطابق" : "لا يطابق"}: ${text}`);
    }
    ok(agree === CASES.length, `P Postgres يوافق الكود في كل الحالات (${agree}/${CASES.length})`);
    // التطبيع داخل القاعدة = normalizeAr
    const sample = "أإآٱ ى ة ؤ ئ فَسْخ الفســخ";
    const n = await db.query<{ n: string }>(`SELECT translate($1::text, $2::text, $3::text) AS n`, [
      sample,
      "أإآٱىةؤئ" + Array.from({ length: 0x065f - 0x064b + 1 }, (_, i) => String.fromCharCode(0x064b + i)).join("") + "ٰـ",
      "اااايهوي",
    ]);
    ok(n[0].n === normalizeAr(sample), "P تطبيع translate في القاعدة = normalizeAr في الكود");
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
