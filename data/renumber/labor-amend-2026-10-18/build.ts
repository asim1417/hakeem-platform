/**
 * HKM-028 → HKM-004: ما بقي من تعديلات نظام العمل بعد إثبات تاريخ نشر م/134 وم/5 (18/10/2026). يولّد statements.json.
 *   npx tsx data/renumber/labor-amend-2026-10-18/build.ts
 *
 * المصدر: نوافذ «تعديلات المادة» في صفحة الهيئة (لقطة 28/09/2026، extracted.json في labor-amend-2026-10-17).
 * تاريخ النفاذ = تاريخ النشر في أم القرى (المادة 71 من النظام الأساسي للحكم؛ لا تاريخ خاص في المرسومين):
 * - م/134 (1440/11/27): نُشر في أم القرى 1440/12/15هـ العدد (4792) = 2019-08-16.
 * - م/5 (1442/1/7): نُشر في أم القرى 1442/1/16هـ العدد (4847) = 2020-09-04.
 *   المرجع: التقارير الشهرية لوزارة العدل (البوابة القانونية sjp.moj.gov.sa، الإصداران 3 و16).
 * ما يُضاف (إضافة فقط؛ لا يُعدَّل نص قائم ولا نسخة قائمة):
 * 1) نسخة 74 الوسيطة (م/134): نص م/46 بعد إحلال الفقرة (4) بنص م/134؛ تقع بين نسختي م/46 (2015) وم/44 (2025).
 * 2) «131 مكرر» (م/5) صف جديد بنصه كما ورد.
 * خارج النطاق: المادة 2 (موضع تعريفي م/44 غير محدد)، و39 و233 (م/24: تاريخ نشره غير مثبت). نسخ 3 و155 (م/134)
 * و186 (م/5) قائمة منذ مرحلة سابقة بتاريخ المرسوم لا تاريخ النشر؛ الجدول إلحاقي فلا تُعدَّل (تُبلَّغ للمالك).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const dir = "data/renumber/labor-amend-2026-10-18";
const LAW = "نظام العمل";
const URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1";
const D134 = { from: "2019-08-16", instrument: "مرسوم ملكي رقم م/134 وتاريخ 1440/11/27هـ", eff: "؛ نُشر في أم القرى 1440/12/15هـ العدد (4792) (وزارة العدل، التقرير الشهري 3)" };
const D5 = { from: "2020-09-04", instrument: "مرسوم ملكي رقم م/5 وتاريخ 1442/1/7هـ", eff: "؛ نُشر في أم القرى 1442/1/16هـ العدد (4847) (وزارة العدل، التقرير الشهري 16)" };
const U74 = "cmpzcv89r0aokvtrk7yascpa4";
const U131 = "cmpzcv89s0aq5vtrktrurpdnm";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const P = JSON.parse(readFileSync("data/renumber/labor-amend-2026-10-17/extracted.json", "utf8")) as Array<{ i: number; heading: string; text: string }>;
if (P.length !== 127) throw new Error(`النوافذ ${P.length}`);
function pop(i: number, heading: string, decree: string): string {
  const p = P[i];
  if (!p.heading.startsWith(heading)) throw new Error(`النافذة ${i}: ${p.heading}`);
  if (!new RegExp(`\\(\\s*م\\s*/\\s*${decree}\\s*\\)`).test(p.text)) throw new Error(`النافذة ${i}: المرسوم م/${decree}`);
  return flat(p.text);
}
function quoted(text: string, n: number): string[] {
  const parts = [...text.matchAll(/"([^"]+)"/g)].map((m) => flat(m[1]));
  if (parts.length !== n) throw new Error(`مقاطع ${parts.length} بدل ${n}: ${text.slice(0, 60)}`);
  return parts;
}
const lead = (t: string) => (t.includes('"') ? t.slice(0, t.indexOf('"')).trim() : t);

// 74 بنص م/46 (كما بُني في 17/10) ثم الفقرة (4) بنص م/134.
const t74_46 = pop(45, "المادة الرابعة والسبعون", "46");
const a74_46 = quoted(t74_46, 1)[0];
const t74_134 = pop(46, "المادة الرابعة والسبعون", "134");
const p4 = quoted(t74_134, 1)[0];
const i4 = a74_46.indexOf(" 4 - "), i5 = a74_46.indexOf(" 5 - ");
if (i4 < 0 || i5 < i4) throw new Error("فقرات 74");
const body74 = `${a74_46.slice(0, i4)} 4 - ${p4}.${a74_46.slice(i5)}`;
const vid74 = `hkm28u-${createHash("sha256").update(`${U74}@${D134.from}`).digest("hex").slice(0, 24)}`;

// 131 مكرر بنص م/5.
const t131 = pop(61, "المادة الحادية والثلاثون بعد المائة", "5");
if (!t131.includes("الحادية والثلاثين بعد المائة مكرر")) throw new Error("131 مكرر");
const row131 = { lawName: LAW, title: "المادة الحادية والثلاثون بعد المائة مكرر", content: quoted(t131, 1)[0], keywords: [] as string[], classification: "أنظمة العمل والرعاية الاجتماعية", chapter: "" };
const id131 = `hkm28-${createHash("sha256").update("labor-131-bis").digest("hex").slice(0, 24)}`;

const s: string[] = [
  `SELECT 1 / (CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id = ${q(U74)}) = 2 AND NOT EXISTS (SELECT 1 FROM unit_version WHERE unit_id = ${q(U74)} AND valid_from::date = ${q(D134.from)}) AND EXISTS (SELECT 1 FROM legal_articles WHERE id = ${q(U131)} AND "lawName" = ${q(LAW)} AND "articleNumber" = 131 AND "articleBis" = 0) AND NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleNumber" = 131 AND "articleBis" = 1) THEN 1 ELSE 0 END) AS guard_before`,
  `INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at) VALUES (${q(vid74)}, ${q(U74)}, ${q(body74)}, ${q(`${D134.from}T00:00:00Z`)}, ${q(D134.instrument)}, ${q(URL)}, ${q(lead(t74_134) + D134.eff)}, now())`,
  `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) SELECT ${q(id131)}, t."legalSystemId", t."lawName", t.classification, 131, 1, ${q(row131.title)}, ${q(row131.content)}, t.chapter, t.keywords, ${q(D5.instrument)}, ${q(D5.from)}, t.status, now(), now(), ${q(buildSearchNorm(row131))}, 'rule' FROM legal_articles t WHERE t.id = ${q(U131)}`,
  `SELECT 1 / (CASE WHEN (SELECT count(*) FROM unit_version WHERE unit_id = ${q(U74)}) = 3 AND (SELECT md5(body) FROM unit_version WHERE id = ${q(vid74)}) = ${q(createHash("md5").update(body74).digest("hex"))} AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleNumber" = 131 AND "articleBis" = 1 AND md5(content) = ${q(createHash("md5").update(row131.content).digest("hex"))}) = 1 THEN 1 ELSE 0 END) AS guard_after`,
];

const md5Nfc = (t: string) => createHash("md5").update(t.normalize("NFC")).digest("hex");
writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify({ version74: { id: vid74, unit: U74, from: D134.from, instrument: D134.instrument, bodyLength: body74.length, md5Nfc: md5Nfc(body74), p4 }, insert131bis: { id: id131, ...row131, effectiveFrom: D5.from, md5Nfc: md5Nfc(row131.content) } }, null, 1) + "\n",
);
console.log(`statements ${s.length} | 74 (${body74.length}) | 131 مكرر (${row131.content.length})`);
