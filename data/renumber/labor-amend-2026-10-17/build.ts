/**
 * HKM-028 → HKM-004: تعديلات نظام العمل بمرسومَي م/46 وم/44 (تاريخ نفاذهما مُثبت)، 17/10/2026. يولّد statements.json.
 *   python3 -I data/renumber/labor-amend-2026-10-17/extract.py
 *   npx tsx data/renumber/labor-amend-2026-10-17/build.ts
 *
 * المصدر: نوافذ «تعديلات المادة» في صفحة الهيئة (لقطة 28/09/2026، extracted.json)؛ المتن الظاهر هو النص الأصلي (1426).
 * - م/46 (1436/6/5): نافذ من 1437/1/5هـ = 2015-10-18 (واس 1406985 و1409352).
 * - م/44 (1446/2/8): «ويعمل بها من تاريخ 1446/8/20هـ» = 2025-02-19.
 * أنواع التطبيق (إضافة فقط؛ لا يُعدَّل نص قائم):
 * 1) استبدال كامل («لتكون بالنص الآتي»): النسخة = النص المقتبس كما ورد (توحيد المسافات فقط).
 * 2) تعديل جزئي (إحلال كلمة، إضافة عبارة أو فقرات، تعديل صدر أو فقرة): النسخة = النص السابق بعد إجراء التعديل
 *    بعبارته نفسها. ما بُني على النص المخزَّن يُحسب في SQL بـ replace() مع حارس «مرة واحدة بالضبط»، فلا يُنقل
 *    النص القائم يدويًّا؛ وما بُني على نسخة م/46 يُركَّب هنا. الفاصل بين فقرتين مركّبتين «. » كبقية الفقرات.
 * 3) دمج بمرسوم (14 في 12 و13، و152 في 151 بـ م/46) وحذف (149 و150 بـ م/5): سجل verification «ملغاة».
 *    حذف 149 و150 مؤكد وإن كان تاريخ نفاذ م/5 (1442/1/7) غير مثبت؛ سجل الإلغاء بلا تاريخ ويغلب كل نسخة.
 * 4) «11 مكرر» (م/46) صف جديد.
 * مؤجل (HKM-004): المادة 2 (م/134 وم/44: موضع التعريفين المضافين غير محدد)، ونسخ م/24 (39) وم/134 (74) الوسيطة،
 * و«131 مكرر» (م/5): تواريخ نفاذها غير مثبتة.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const dir = "data/renumber/labor-amend-2026-10-17";
const LAW = "نظام العمل";
const URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1";
const D46 = { from: "2015-10-18", instrument: "مرسوم ملكي رقم م/46 وتاريخ 1436/6/5هـ", eff: "؛ بدء التطبيق 1437/1/5هـ (وكالة الأنباء السعودية: spa.gov.sa/1406985 وspa.gov.sa/1409352)" };
const D44 = { from: "2025-02-19", instrument: "مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ", eff: "" };
const D5 = { instrument: "مرسوم ملكي رقم م/5 وتاريخ 1442/1/7هـ" };

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const hid = (k: string) => `hkm28u-${createHash("sha256").update(k).digest("hex").slice(0, 24)}`;
const P = JSON.parse(readFileSync(`${dir}/extracted.json`, "utf8")) as Array<{ i: number; heading: string; text: string }>;
if (P.length !== 127) throw new Error(`النوافذ ${P.length}`);

/** النافذة i بعنوانها المتوقع وبمرسومها. */
function pop(i: number, heading: string, decree: "46" | "44" | "5"): string {
  const p = P[i];
  if (!p.heading.startsWith(heading)) throw new Error(`النافذة ${i}: ${p.heading}`);
  if (!new RegExp(`\\(\\s*م\\s*/\\s*${decree}\\s*\\)`).test(p.text)) throw new Error(`النافذة ${i}: المرسوم م/${decree}`);
  return flat(p.text);
}
/** المقاطع بين علامتي التنصيص. */
function quoted(text: string, n: number): string[] {
  const parts = [...text.matchAll(/"([^"]+)"/g)].map((m) => flat(m[1]));
  if (parts.length !== n) throw new Error(`مقاطع ${parts.length} بدل ${n}: ${text.slice(0, 60)}`);
  return parts;
}
const stripHead = (s: string, head: string) => {
  if (!s.startsWith(head)) throw new Error(`بداية «${head}»`);
  return s.slice(head.length).replace(/^\s*:\s*/, "");
};
function sub(text: string, old: string, neu: string): string {
  if (text.split(old).length !== 2) throw new Error(`«${old.slice(0, 30)}» ليس مرة واحدة`);
  return text.replace(old, neu);
}

// معرّفات الصفوف وبادئة نصها المخزَّن (حارس أن الصف هو المقصود).
const U: Record<number, [string, string]> = {
  7: ["cmpzcv89q0ampvtrkfth7ppti", "يستثنى من تطبيق أحكام هذا النظام"],
  11: ["cmpzcv89r0amtvtrkomthy1wm", "1- إذا عهد صاحب العمل"],
  12: ["cmpzcv89r0amuvtrky2j6ms9i", "يجب على صاحب العمل والعامل معرفة"],
  13: ["cmpzcv89r0amvvtrkv64l2kco", "تعتمد الوزارة لائحة تنظيم العمل"],
  14: ["cmpzcv89r0amwvtrke4m0z1a1", "يصدر الوزير بقرار منه نموذجًا"],
  22: ["cmpzcv89r0an4vtrkqhl83nm7", "توفر الوزارة وحدات للتوظيف"],
  23: ["cmpzcv89r0an5vtrkkcgfb0rh", "لكل مواطن في سن العمل"],
  24: ["cmpzcv89r0an6vtrkh0i7fihy", "تحدد اللائحة قواعد سير العمل"],
  25: ["cmpzcv89r0an7vtrkmd7h9xjr", "على كل صاحب عمل أن يرسل"],
  27: ["cmpzcv89r0an9vtrks75qxlyq", "للوزير عند الاقتضاء أن يلزم"],
  28: ["cmpzcv89r0anavtrkjrb1rse0", "على كل صاحب عمل يستخدم خمسة وعشرين"],
  30: ["cmpzcv89r0ancvtrk4ghy47w0", "لا يجوز لأي شخص طبيعي أو اعتباري"],
  31: ["cmpzcv89r0andvtrkq60ajno6", "يُعدّ العمال السعوديون"],
  39: ["cmpzcv89r0anlvtrkpn5mzjfl", "1- لا يجوز- بغير اتباع"],
  52: ["cmpzcv89r0anyvtrkj8qh04x4", "يجب أن يحتوي عقد العمل"],
  61: ["cmpzcv89r0ao7vtrk2injzfmx", "بالإضافة إلى الواجبات المنصوص عليها"],
  74: ["cmpzcv89r0aokvtrk7yascpa4", "ينتهي عقد العمل في أي من الأحوال"],
  77: ["cmpzcv89s0aonvtrkog9eg9du", "إذا أنهي العقد لسبب غير مشروع"],
  78: ["cmpzcv89s0aoovtrkpntp4t5a", "يجوز للعامل الذي يفصل من عمله"],
  149: ["cmpzcv89t0aqnvtrkveqpv8ci", "مع مراعاة ما ورد في المادة الرابعة"],
  150: ["cmpzcv89t0aqovtrkhdtzxoga", "لا يجوز تشغيل النساء أثناء فترة من الليل"],
  151: ["cmpzcv89t0aqpvtrkltjps1uc", "للمرأة العاملة الحق في إجازة وضع"],
  152: ["cmpzcv89t0aqqvtrk0bjskxvq", "على صاحب العمل أن يدفع إلى المرأة"],
  182: ["cmpzcv89t0arkvtrk0i858gew", "يجوز لصاحب العمل إنهاء العقد دون سبق إعلان"],
  199: ["cmpzcv89t0as1vtrkmxubzfmc", "على أصحاب العمل ووكلائهم"],
};

type D = typeof D46 | typeof D44;
type Full = { kind: "full"; n: number; d: D; body: string; quote: string };
type Sql = { kind: "sql"; n: number; d: D; ops: Array<[string, string]>; append?: string; quote: string };
const V: Array<Full | Sql> = [];
// في الاستبدال الكامل يُقتبس صدر النافذة حرفيًّا حتى أول علامة تنصيص (النص المقتبس نفسه هو body).
const lead = (t: string) => (t.includes('"') ? t.slice(0, t.indexOf('"')).trim() : t);
const full = (n: number, d: D, body: string, quote: string) => V.push({ kind: "full", n, d, body, quote: lead(quote) + d.eff });
const sql = (n: number, d: D, ops: Array<[string, string]>, quote: string, append?: string) => V.push({ kind: "sql", n, d, ops, append, quote: quote + d.eff });

// ── م/46: استبدال كامل ──
for (const [n, i, h] of [[7, 4, "المادة السابعة"], [11, 6, "المادة الحادية عشرة"], [77, 51, "المادة السابعة والسبعون"], [78, 52, "المادة الثامنة والسبعون"], [149, 63, "المادة التاسعة والأربعون بعد المائة"]] as const) {
  const t = pop(i, h, "46");
  full(n, D46, quoted(t, 1)[0], t);
}
{
  const t = pop(8, "المادة الثانية عشرة", "46");
  const [a12, a13] = quoted(t, 2);
  full(12, D46, stripHead(a12, "المادة الثانية عشرة"), t);
  full(13, D46, stripHead(a13, "المادة الثالثة عشرة"), t);
}
const t151_46 = pop(66, "المادة الحادية والخمسون بعد المائة", "46");
full(151, D46, stripHead(quoted(t151_46, 1)[0], "المادة الحادية والخمسون بعد المائة"), t151_46);
const t52_46 = pop(34, "المادة الثانية والخمسون", "46");
const a52_46 = quoted(t52_46, 1)[0];
full(52, D46, a52_46, t52_46);
const t74_46 = pop(45, "المادة الرابعة والسبعون", "46");
const a74_46 = quoted(t74_46, 1)[0];
full(74, D46, a74_46, t74_46);

// ── م/44: استبدال كامل ──
for (const [n, i, h] of [[7, 5, "المادة السابعة"], [30, 17, "المادة الثلاثون"], [39, 23, "المادة التاسعة والثلاثون"], [151, 67, "المادة الحادية والخمسون بعد المائة"], [182, 74, "المادة الثانية والثمانون بعد المائة"]] as const) {
  const t = pop(i, h, "44");
  full(n, D44, quoted(t, 1)[0], t);
}

// ── م/44: تعديل جزئي على نسخة م/46 (يُركَّب هنا) ──
{
  // 52: عُدلت الفقرة (1).
  const t = pop(35, "المادة الثانية والخمسون", "44");
  const p1 = quoted(t, 1)[0];
  const i2 = a52_46.indexOf(" 2 - ");
  if (!a52_46.startsWith("1 - ") || i2 < 0) throw new Error("فقرات 52");
  full(52, D44, `1 - ${p1}.${a52_46.slice(i2)}`, t);
}
{
  // 74: الفقرة (4) بنص م/134 (عُدلت بعد م/46)، ثم «3 (مكرر)» و«7 (مكرر)» بـ م/44.
  const t134 = flat(P[46].text);
  if (!/م\s*\/\s*134/.test(t134)) throw new Error("74 م/134");
  const p4 = quoted(t134, 1)[0];
  const t = pop(47, "المادة الرابعة والسبعون", "44");
  const [b3, b7] = quoted(t, 2);
  const i4 = a74_46.indexOf(" 4 - "), i5 = a74_46.indexOf(" 5 - "), i8 = a74_46.indexOf(" 8 - ");
  if (i4 < 0 || i5 < i4 || i8 < i5) throw new Error("فقرات 74");
  const body = `${a74_46.slice(0, i4)} ${b3}. 4 - ${p4}.${a74_46.slice(i5, i8)} ${b7}.${a74_46.slice(i8)}`;
  full(74, D44, body, `${lead(t134)} ${lead(t)}`);
}

// ── م/44: تعديل جزئي على النص المخزَّن (يُحسب في SQL) ──
const QAN: Array<[string, string]> = [["وحدات", "قنوات"], ["وحدة", "قنوات"]];
{
  const t = pop(11, "المادة الثانية والعشرون", "44");
  const [sadr, p33] = quoted(t, 2);
  sql(22, D44, [["توفر الوزارة وحدات للتوظيف دون مقابل في الأماكن المناسبة لأصحاب العمل والعمال، تقوم بما يأتي:", sadr], ["إحالة طلبات العمال للأعمال الشاغرة الملائمة", p33]], t);
}
sql(23, D44, [["وحدة", "قنوات"]], pop(12, "المادة الثالثة والعشرون", "44"));
sql(24, D44, [["وحدات", "قنوات"]], pop(13, "المادة الرابعة والعشرون", "44"));
sql(25, D44, [["وحدة", "قنوات"], ["مكتب العمل المختص", "الوزارة"]], pop(14, "المادة الخامسة والعشرون", "44"));
sql(27, D44, [["وحدات", "قنوات"]], pop(15, "المادة السابعة والعشرون", "44"));
sql(28, D44, [["وحدات", "قنوات"], ["مكتب العمل المختص", "الوزارة"], ["التي يشغلها المعوقون", "التي يشغلها ذوو الإعاقة"]], pop(16, "المادة الثامنة والعشرون", "44"));
sql(31, D44, [["المكاتب", "المكاتب أو الشركات"]], pop(18, "المادة الحادية والثلاثون", "44"));
sql(199, D44, [["ووكلائهم", "ووكلائهم ومسؤوليهم في مكان العمل"]], pop(83, "المادة التاسعة والتسعون بعد المائة", "44"));
{
  const t = pop(41, "المادة الحادية والستون", "44");
  sql(61, D44, [], t, quoted(t, 1)[0]);
}
void QAN;

// ── دمج وحذف ──
const repeals: Array<[number, string, string]> = [
  [14, D46.instrument, lead(pop(10, "المادة الرابعة عشرة", "46")) + D46.eff],
  [152, D46.instrument, lead(pop(68, "المادة الثانية والخمسون بعد المائة", "46")) + D46.eff],
  [149, D5.instrument, pop(64, "المادة التاسعة والأربعون بعد المائة", "5")],
  [150, D5.instrument, pop(65, "المادة الخمسون بعد المائة", "5")],
];

// ── 11 مكرر ──
const t11b = pop(7, "المادة الحادية عشرة", "46");
if (!t11b.includes("(الحادية عشرة مكرر)")) throw new Error("11 مكرر");
const row11 = { lawName: LAW, title: "المادة الحادية عشرة مكرر", content: quoted(t11b, 1)[0], keywords: [] as string[], classification: "أنظمة العمل والرعاية الاجتماعية", chapter: "" };
const id11 = `hkm28-${createHash("sha256").update("labor-11-bis").digest("hex").slice(0, 24)}`;

// ── الجمل ──
const s: string[] = [];
const units = [...new Set([...V.map((v) => v.n), ...repeals.map((r) => r[0])])].sort((a, b) => a - b);
const FLAT = `regexp_replace(content, '\\s+', ' ', 'g')`;
for (const n of units) {
  const [id, prefix] = U[n];
  s.push(`SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM legal_articles WHERE id = ${q(id)} AND "lawName" = ${q(LAW)} AND "articleNumber" = ${n} AND "articleBis" = 0 AND ${FLAT} LIKE ${q(`${prefix}%`)}) THEN 1 ELSE 0 END) AS guard_unit_${n}`);
}
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id IN (${units.map((n) => q(U[n][0])).join(", ")})) AND NOT EXISTS (SELECT 1 FROM verification WHERE object_id IN (${units.map((n) => q(U[n][0])).join(", ")})) THEN 1 ELSE 0 END) AS guard_clean`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleNumber" = 11 AND "articleBis" = 1) THEN 1 ELSE 0 END) AS guard_no_11bis`);
const ids: string[] = [];
for (const v of V) {
  const [unit] = U[v.n];
  const vid = hid(`${unit}@${v.d.from}`);
  ids.push(vid);
  const head = `INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)`;
  const tail = `${q(`${v.d.from}T00:00:00Z`)}, ${q(v.d.instrument)}, ${q(URL)}, ${q(v.quote)}, now()`;
  if (v.kind === "full") {
    s.push(`${head} VALUES (${q(vid)}, ${q(unit)}, ${q(v.body)}, ${tail})`);
  } else {
    // كل عبارة تُستبدل مرة واحدة بالضبط في النص المخزَّن (بعد توحيد المسافات).
    for (const [old] of v.ops) {
      s.push(`SELECT 1 / (CASE WHEN (SELECT (length(${FLAT}) - length(replace(${FLAT}, ${q(old)}, ''))) / ${old.length} FROM legal_articles WHERE id = ${q(unit)}) = 1 THEN 1 ELSE 0 END) AS guard_once_${v.n}`);
    }
    let expr = `btrim(${FLAT})`;
    for (const [old, neu] of v.ops) expr = `replace(${expr}, ${q(old)}, ${q(neu)})`;
    if (v.append) expr = `${expr} || ' ' || ${q(v.append)}`;
    s.push(`${head} SELECT ${q(vid)}, id, ${expr}, ${tail} FROM legal_articles WHERE id = ${q(unit)}`);
  }
}
for (const [n, instrument, quote] of repeals) {
  s.push(
    `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) VALUES (${q(`hkm28v-${createHash("sha256").update(`labor-repeal-${n}`).digest("hex").slice(0, 24)}`)}, 'unit', ${q(U[n][0])}, 'ملغاة', ${q(instrument)}, ${q(URL)}, ${q(quote)}, 'manual', 'hkm028-labor-amend-2026-10-17', now())`,
  );
}
s.push(
  `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) SELECT ${q(id11)}, t."legalSystemId", t."lawName", t.classification, 11, 1, ${q(row11.title)}, ${q(row11.content)}, t.chapter, t.keywords, ${q(D46.instrument)}, ${q(D46.from)}, t.status, now(), now(), ${q(buildSearchNorm(row11))}, 'rule' FROM legal_articles t WHERE t.id = ${q(U[11][0])}`,
);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM unit_version WHERE id IN (${ids.map(q).join(", ")})) = ${ids.length} AND (SELECT count(*) FROM verification WHERE verified_by = 'hkm028-labor-amend-2026-10-17') = ${repeals.length} AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" < 100) = 241 AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id IN (${ids.map(q).join(", ")}) AND (body LIKE '%وحدة التوظيف%' OR body LIKE '%وحدات التوظيف%' OR body LIKE '%مكتب العمل المختص%')) THEN 1 ELSE 0 END) AS guard_after`);

const md5Nfc = (t: string) => createHash("md5").update(t.normalize("NFC")).digest("hex");
writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify(
    {
      versions: V.map((v, k) => ({ id: ids[k], article: v.n, unit: U[v.n][0], from: v.d.from, instrument: v.d.instrument, kind: v.kind, ...(v.kind === "full" ? { bodyLength: v.body.length, bodyStart: v.body.slice(0, 80), md5Nfc: md5Nfc(v.body) } : { ops: v.ops, append: v.append ?? null }) })),
      repeals: repeals.map(([n, instrument]) => ({ article: n, unit: U[n][0], instrument })),
      insert11bis: { id: id11, ...row11, md5Nfc: md5Nfc(row11.content) },
    },
    null,
    1,
  ) + "\n",
);
console.log(`statements ${s.length} | versions ${V.length} (full ${V.filter((v) => v.kind === "full").length}) | repeals ${repeals.length} | 11 مكرر`);
