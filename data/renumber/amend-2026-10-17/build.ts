/**
 * HKM-028 → HKM-004: حقن تعديلين بتاريخ نفاذ مُثبت (17/10/2026). يولّد statements.json لمعاملة واحدة بحراس.
 *   npx tsx data/renumber/amend-2026-10-17/build.ts
 *
 * النصوص من نوافذ «تعديلات المادة» في لقطة الهيئة 28/09/2026 (extracted.json)، كما وردت (توحيد المسافات فقط).
 * - نظام العمل م/46 (1436/6/5): المادتان 229 و230 بصياغتهما الجديدة؛ بدء التطبيق 1437/1/5هـ = 2015-10-18 (واس:
 *   «العمل تطبق 38 مادة معدلة جديدة في نظام العمل بدءاً من محرم القادم»، و«البدء في تنفيذ 38 تعديلا في نظام العمل غدا الأحد»).
 *   ثم الفقرة (5) من 230 بإضافة «أو من ينيبه» بعد «الوزير» (م/44، يعمل بها من 1446/8/20هـ = 2025-02-19).
 * - نظام مكافحة غسل الأموال م/223 (1447/10/27): المواد 14 و15 و16 و18 و28 و33 و50، وإدراج «49 مكرر»؛ النفاذ من اليوم
 *   التالي للنشر (قرار مجلس الوزراء 748 في 1447/10/26هـ)، ونُشر في أم القرى يوم 17/04/2026 (عكاظ: «التطبيق غداً») = 2026-04-18.
 * إضافة فقط إلى unit_version (append-only) وصف جديد في legal_articles؛ لا يُعدَّل نص قائم.
 * طُبّق على الإنتاج 17/10/2026. المخزَّن = NFC للنص (ثلاثة نصوص فيها «ـًّـ» بترتيب الشدة قبل التنوين في المصدر خُزّنت
 * بالترتيب القانوني: تنوين ثم شدة؛ مكافئ قانونيًّا في يونيكود). بصمات md5 المتوقعة في plan.json (md5Nfc).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const dir = "data/renumber/amend-2026-10-17";
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const hid = (k: string) => `hkm28u-${createHash("sha256").update(k).digest("hex").slice(0, 24)}`;
const X = JSON.parse(readFileSync(`${dir}/extracted.json`, "utf8")) as {
  labor229_1436: string; labor230_1436: string; labor_quote_1436: string; labor230_1446_quote: string;
  aml: Array<{ heading: string; quote: string; body: string; ok: boolean }>;
};

const LABOR_URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1";
const AML_URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/0657dfce-95f8-463a-9d87-aa3900ec7b51/1";
const SPA = "؛ بدء التطبيق 1437/1/5هـ (وكالة الأنباء السعودية: spa.gov.sa/1406985 وspa.gov.sa/1409352)";
const AML_EFF = "؛ يكون نفاذه من اليوم التالي لتاريخ نشره في الجريدة الرسمية (قرار مجلس الوزراء رقم 748 وتاريخ 1447/10/26هـ)، ونُشر في أم القرى يوم 17/04/2026 (عكاظ: okaz.com.sa/local/saudi-arabia/2244592)";

// 230 بعد م/44: «أو من ينيبه» بعد كلمة «الوزير» في الفقرة (5) — آخر «قرار من الوزير» في النص، مرة واحدة.
const para5 = X.labor230_1436.lastIndexOf("قرار من الوزير");
if (para5 < 0 || X.labor230_1436.indexOf("5 –") > para5 || !X.labor230_1436.endsWith("قرار من الوزير")) throw new Error("موضع الفقرة 5");
const labor230_1446 = `${X.labor230_1436} أو من ينيبه`;

type V = { unit: string; law: string; n: number; prefix: string; body: string; from: string; instrument: string; url: string; quote: string };
const versions: V[] = [
  { unit: "cmpzcv8yy0asvvtrkp0wzo1x6", law: "نظام العمل", n: 229, prefix: "تطبق العقوبات المنصوص عليها في هذا الباب", body: X.labor229_1436, from: "2015-10-18", instrument: "مرسوم ملكي رقم م/46 وتاريخ 1436/6/5هـ", url: LABOR_URL, quote: X.labor_quote_1436 + SPA },
  { unit: "cmpzcv8yy0aswvtrk5m5zwa16", law: "نظام العمل", n: 230, prefix: "يعاقب بغرامة لا تقل عن ثلاثة آلاف ريال", body: X.labor230_1436, from: "2015-10-18", instrument: "مرسوم ملكي رقم م/46 وتاريخ 1436/6/5هـ", url: LABOR_URL, quote: X.labor_quote_1436 + SPA },
  { unit: "cmpzcv8yy0aswvtrk5m5zwa16", law: "نظام العمل", n: 230, prefix: "يعاقب بغرامة لا تقل عن ثلاثة آلاف ريال", body: labor230_1446, from: "2025-02-19", instrument: "مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ", url: LABOR_URL, quote: X.labor230_1446_quote },
];
const amlIds: Record<string, [string, number, string]> = {
  "الرابعة عشرة": ["cmpz5wnm601mhcwg2lj1k3ev5", 14, "1- على المؤسسات المالية"],
  "الخامسة عشرة": ["cmpz5wnrz01mjcwg245kph4gv", 15, "على المؤسسات المالية"],
  "السادسة عشرة": ["cmpz5wnxr01mlcwg2yyg18b6y", 16, "1- يُحظر على المؤسسات المالية"],
  "الثامنة عشرة": ["cmpz5wo9e01mpcwg2smclxqwa", 18, "1- للإدارة العامة للتحريات المالية"],
  "الثامنة والعشرون": ["cmpz5wpvf01n9cwg2skydgkfy", 28, "1- يمنع السعودي المحكوم عليه"],
  "الثالثة والثلاثون": ["cmpz61l7y039xcwg2mzr3ww2q", 33, "1- مع عدم الإخلال بحقوق الغير"],
  "الخمسون": ["cmpz61o3o03avcwg2asbq6e97", 50, "يصدر رئيس أمن الدولة بالاتفاق"],
};
if (X.aml.length !== 7 || X.aml.some((a) => !a.ok || !amlIds[a.heading])) throw new Error("مواد غسل الأموال");
for (const a of X.aml) {
  const [unit, n, prefix] = amlIds[a.heading];
  versions.push({ unit, law: "نظام مكافحة غسل الأموال", n, prefix, body: a.body, from: "2026-04-18", instrument: "مرسوم ملكي رقم م/223 وتاريخ 1447/10/27هـ", url: AML_URL, quote: a.quote + AML_EFF });
}

// «49 مكرر» من وحدة الهيئة كما وردت.
type Unit = { law_id: string; heading: string; article_number: number | null; is_bis: boolean; body: string };
const u49 = readFileSync("ingest/boe-corpus-2026-09-28/data/parsed/unit.jsonl", "utf8").split("\n")
  .filter((l) => l.includes('"boe26-d6a1c8614fa2b4c0df65d842"')).map((l) => JSON.parse(l) as Unit)
  .find((u) => u.article_number === 49 && u.is_bis);
if (!u49 || !u49.body.includes("(م/223) وتاريخ 1447/10/27")) throw new Error("49 مكرر");
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const AML = "نظام مكافحة غسل الأموال";
const row49 = { lawName: AML, title: flat(u49.heading).replace(/^"\s*|\s*"$/g, ""), content: flat(u49.body), keywords: [] as string[], classification: null as string | null, chapter: "" };

// توحيد المسافات (ومنها \r) في النصوص والاقتباسات، دون مساس بالكلمات.
for (const v of versions) {
  v.body = flat(v.body);
  v.quote = flat(v.quote);
}

const s: string[] = [];
for (const v of versions.filter((x, i, a) => a.findIndex((y) => y.unit === x.unit) === i)) {
  s.push(`SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM legal_articles WHERE id = ${q(v.unit)} AND "lawName" = ${q(v.law)} AND "articleNumber" = ${v.n} AND "articleBis" = 0 AND regexp_replace(content, '\\s+', ' ', 'g') LIKE ${q(`${v.prefix}%`)}) THEN 1 ELSE 0 END) AS guard_unit`);
}
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id IN (${[...new Set(versions.map((v) => v.unit))].map(q).join(", ")})) THEN 1 ELSE 0 END) AS guard_no_versions`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(AML)} AND "articleNumber" = 49 AND "articleBis" = 1) THEN 1 ELSE 0 END) AS guard_no_49bis`);
for (const v of versions) {
  s.push(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES (${q(hid(`${v.unit}@${v.from}`))}, ${q(v.unit)}, ${q(v.body)}, ${q(`${v.from}T00:00:00Z`)}, ${q(v.instrument)}, ${q(v.url)}, ${q(v.quote)}, now())`);
}
s.push(
  `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) SELECT ${q(`hkm28-${createHash("sha256").update("aml-49-bis").digest("hex").slice(0, 24)}`)}, t."legalSystemId", t."lawName", t.classification, 49, 1, ${q(row49.title)}, ${q(row49.content)}, t.chapter, t.keywords, ${q("مرسوم ملكي رقم م/223 وتاريخ 1447/10/27هـ")}, '2026-04-18', t.status, now(), now(), __NORM49__, 'rule' FROM legal_articles t WHERE t.id = 'cmpz61nxl03atcwg22mm9l5ha'`,
);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hkm28u-%') = ${versions.length} AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(AML)} AND "articleBis" < 100) = 52 THEN 1 ELSE 0 END) AS guard_after`);

const tIdx = process.argv.indexOf("--classification");
const cls = tIdx > 0 ? process.argv[tIdx + 1] : null;
const out = s.map((x) => x.replace("__NORM49__", q(buildSearchNorm({ ...row49, classification: cls }))));
writeFileSync(`${dir}/statements.json`, JSON.stringify(out, null, 1) + "\n");
const md5Nfc = (t: string) => createHash("md5").update(t.normalize("NFC")).digest("hex");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify({ versions: versions.map(({ body, ...v }) => ({ ...v, id: hid(`${v.unit}@${v.from}`), bodyLength: body.length, bodyStart: body.slice(0, 80), md5Nfc: md5Nfc(body) })), insert49bis: { ...row49, md5Nfc: md5Nfc(row49.content) } }, null, 1) + "\n",
);
console.log(`statements ${out.length} | versions ${versions.length} | classification ${cls}`);
