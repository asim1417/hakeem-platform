/**
 * HKM-028: خطة نظام العمل (17/10/2026). يولّد statements.json لمعاملة واحدة بحراس.
 *   npx tsx data/renumber/labor-2026-10-17/build.ts
 *
 * المصدر: لقطة هيئة الخبراء 28/09/2026 (ingest/boe-corpus-2026-09-28)، ونوافذ «تعديلات المادة» في صفحتها:
 * - م/46 (1436/6/5) أعاد صياغة المواد 229–239 و241 «لتكون في مادتين» (229 و230)، وصارت 240 ← 231 و242 ← 232،
 *   وأضاف 233؛ وأضاف م/14 (1440/2/22) 234 و235؛ وبقيت 243–245 بأرقامها.
 * - م/44 (1446/2/8، يعمل بها من 1446/8/20هـ = 2025-02-19) أضاف «79 مكرر» و«229 مكرر».
 * لا يمس نص أي مادة قائمة. نص 229 و230 بعد م/46 مؤجل (تاريخ نفاذ م/46 غير مذكور في المصدر) — HKM-004.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const LAW = "نظام العمل";
const SYSTEM_ID = "cmpz5r8eo00becwg21qt63wx7";
const CLASSIFICATION = "أنظمة العمل والرعاية الاجتماعية";
const BOE_LAW = "boe26-5ba2e20d7e53ddfc6aa1aa6d";
const BOE_URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1";
const NON_ARTICLE = 100;
const dir = "data/renumber/labor-2026-10-17";

// [المعرّف، الرقم الحالي، الرقم الجديد، درجة مكرر الجديدة، السبب]
const plan: Array<[string, number, number, number, string]> = [
  ["cms68t1i20b6xh17ty4s10lp9", 471, 471, NON_ARTICLE, "نسخة مكررة حرفيًّا من المادة 231 (240 سابقًا)"],
  ["cms68t1i20b6zh17t6imw0d76", 474, 474, NON_ARTICLE, "نسخة مكررة حرفيًّا من المادة 232 (242 سابقًا)"],
  ["cmpzcv8yy0asxvtrkokpitk8n", 231, 231, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0asyvtrkbijl6kmw", 232, 232, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0aszvtrkdf2pxzwo", 233, 233, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at0vtrkssw3lhil", 234, 234, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at1vtrk2dobk4kw", 235, 235, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at2vtrkr0xahckl", 236, 236, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at3vtrke3gpv4xg", 237, 237, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at4vtrkfdsmuxpx", 238, 238, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at5vtrkq31ct5z3", 239, 239, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at7vtrkezmrdqfh", 241, 241, NON_ARTICLE, "أُعيدت صياغتها في 229 و230 (م/46)"],
  ["cmpzcv8yy0at6vtrkwl4tgt4z", 240, 231, 0, "عنوانها: 231 حاليًا، 240 سابقًا"],
  ["cmpzcv8yy0at8vtrk92tot6ex", 242, 232, 0, "عنوانها: 232 حاليًا، 242 سابقًا"],
  ["cmpzcv8yy0at9vtrkqvn5ovne", 243, 233, 0, "أضافها م/46 بالرقم 233"],
  ["cmpzcv8yy0atavtrk0lm31p31", 244, 234, 0, "مضافة بالرقم 234"],
  ["cmpzcv8yy0atbvtrks4qgn6zw", 245, 235, 0, "أضافها م/14 بالرقم 235"],
  ["cmpzcv8yy0atcvtrk3n3hkmxy", 246, 243, 0, "عنوانها المادة الثالثة والأربعون بعد المائتين"],
  ["cmpzcv8yy0atdvtrk28hp5hej", 247, 244, 0, "عنوانها المادة الرابعة والأربعون بعد المائتين"],
  ["cmpzcv8yy0atevtrkf41bdue6", 248, 245, 0, "عنوانها المادة الخامسة والأربعون بعد المائتين"],
];
const merged = plan.filter((p) => p[4].includes("م/46)") && p[3] === NON_ARTICLE).map((p) => p[0]);

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const id = (k: string) => `hkm28-${createHash("sha256").update(k).digest("hex").slice(0, 24)}`;

// الوحدتان المضافتان من لقطة الهيئة، بنصهما كما ورد (توحيد المسافات فقط).
type Unit = { law_id: string; seq: number; heading: string; article_number: number | null; is_bis: boolean; body: string };
const units = readFileSync("ingest/boe-corpus-2026-09-28/data/parsed/unit.jsonl", "utf8")
  .split("\n").filter((l) => l.includes(`"${BOE_LAW}"`)).map((l) => JSON.parse(l) as Unit);
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const inserts = [79, 229].map((n) => {
  const u = units.find((x) => x.article_number === n && x.is_bis);
  if (!u) throw new Error(`لا وحدة مكرر للمادة ${n}`);
  const row = { lawName: LAW, title: flat(u.heading), content: flat(u.body), keywords: [] as string[], classification: CLASSIFICATION, chapter: "" };
  if (!row.content.includes("(م/44) وتاريخ 1446/2/8")) throw new Error(`أداة غير متوقعة في ${n} مكرر`);
  return { n, id: id(`labor-${n}-bis`), seq: u.seq, ...row, search_norm: buildSearchNorm(row) };
});

const decree46 =
  "تم تعديل أحكام المواد (التاسعة والعشرين بعد المائتين)، و(الثلاثين بعد المائتين)، و(الحادية والثلاثين بعد المائتين)، و(الثانية والثلاثين بعد المائتين)، و(الثالثة والثلاثين بعد المائتين)، و(الرابعة والثلاثين بعد المائتين)، و(الخامسة والثلاثين بعد المائتين)، و(السادسة والثلاثين بعد المائتين)، و(السابعة والثلاثين بعد المائتين)، و(السادسة والثلاثين بعد المائتين)، و(السابعة والثلاثين بعد المائتين)، و(الثامنة والثلاثين بعد المائتين)، و(التاسعة والثلاثين بعد المائتين)، و(الحادية والأربعين بعد المائتين)؛ وإعادة صياغة هذه المواد بعد تعديل أحكامها لتكون في مادتين بموجب المرسوم الملكي رقم ( م/ 46) وتاريخ 5 / 6 / 1436 هـ";

const s: string[] = [];
s.push("CREATE TEMP TABLE renumber_plan (id text PRIMARY KEY, current_number int, new_number int, new_bis int) ON COMMIT DROP");
s.push(`INSERT INTO renumber_plan VALUES ${plan.map(([i, c, n, b]) => `(${q(i)}, ${c}, ${n}, ${b})`).join(", ")}`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM renumber_plan) = ${plan.length} THEN 1 ELSE 0 END) AS guard_plan`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM renumber_plan p LEFT JOIN legal_articles a ON a.id = p.id AND a."lawName" = ${q(LAW)} AND a."articleNumber" = p.current_number AND a."articleBis" = 0 WHERE a.id IS NULL) THEN 1 ELSE 0 END) AS guard_rows`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)}) = 250 THEN 1 ELSE 0 END) AS guard_count`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" <> 0) THEN 1 ELSE 0 END) AS guard_no_bis`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM verification WHERE object_id IN (${merged.map(q).join(", ")})) THEN 1 ELSE 0 END) AS guard_no_verification`);
s.push(`UPDATE legal_articles a SET "articleNumber" = a."articleNumber" + 100000 FROM renumber_plan p WHERE a.id = p.id`);
s.push(`UPDATE legal_articles a SET "articleNumber" = p.new_number, "articleBis" = p.new_bis FROM renumber_plan p WHERE a.id = p.id AND a."articleNumber" >= 100000`);
for (const r of inserts) {
  s.push(
    `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) VALUES (${q(r.id)}, ${q(SYSTEM_ID)}, ${q(LAW)}, ${q(CLASSIFICATION)}, ${r.n}, 1, ${q(r.title)}, ${q(r.content)}, '', '{}', ${q("مرسوم ملكي رقم م/44 وتاريخ 1446/2/8هـ")}, '2025-02-19', 'سارية', now(), now(), ${q(r.search_norm)}, 'rule')`,
  );
}
// الصف الأول بنص الدليل كاملًا، والبقية تنسخ دليله (نفس الأداة والاقتباس) لتقصير المعاملة.
const [firstMerged, ...restMerged] = merged;
const firstVerification = id(`labor-merged-${firstMerged}`);
s.push(
  `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) VALUES (${q(firstVerification)}, 'unit', ${q(firstMerged)}, 'ملغاة', ${q("مرسوم ملكي رقم م/46 وتاريخ 1436/6/5هـ")}, ${q(BOE_URL)}, ${q(decree46)}, 'manual', 'hkm028-labor-2026-10-17', now())`,
);
for (const m of restMerged) {
  s.push(
    `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) SELECT ${q(id(`labor-merged-${m}`))}, 'unit', ${q(m)}, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, now() FROM verification WHERE id = ${q(firstVerification)}`,
  );
}
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM renumber_plan p JOIN legal_articles a ON a.id = p.id WHERE a."articleNumber" <> p.new_number OR a."articleBis" <> p.new_bis) THEN 1 ELSE 0 END) AS guard_after`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" < ${NON_ARTICLE}) = 240 THEN 1 ELSE 0 END) AS guard_articles`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM verification WHERE verified_by = 'hkm028-labor-2026-10-17') = ${merged.length} THEN 1 ELSE 0 END) AS guard_verification`);

writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify({ law: LAW, renumber: plan.map(([i, c, n, b, why]) => ({ id: i, current: c, new: n, bis: b, why })), insert: inserts.map(({ search_norm, ...r }) => r), repealVerification: merged }, null, 1) + "\n",
);
console.log(`statements ${s.length} | renumber ${plan.length} | insert ${inserts.length} | verification ${merged.length}`);
