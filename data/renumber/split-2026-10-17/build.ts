/**
 * HKM-028: فصل الوثائق المدموجة (17/10/2026، بإذن المالك «اكمل»). يولّد statements.json لمعاملة واحدة بحراس.
 *   npx tsx data/renumber/split-2026-10-17/build.ts
 *
 * صفحة الهيئة الواحدة تجمع أكثر من وثيقة، فخُزّنت مواد الوثائق متتابعة تحت اسم واحد (19، 20 … بدل 1، 2 …):
 * - «تنظيم هيئات تطوير المناطق والمدن واللائحة المالية … واللائحة الإدارية …»: التنظيم 1–18، واللائحة المالية 74 مادة
 *   (الصفوف 19–92)، واللائحة الإدارية 47 مادة (93–139). الاسمان الجديدان من عنوان الصفحة نفسه.
 * - «نظام الميداليات المدنية والعسكرية»: ميدالية الاستحقاق 1–7، ثم ثلاث ميداليات لكل منها 6 مواد (8–13، 14–19، 20–25)؛
 *   تُسمّى بالميدالية كما في مادتها الأولى («تُحدَّث ميدالية باسم …»)، دون اختراع اسم رسمي.
 * يبقى صف النظام الأصلي وجزؤه الأول كما هما. لا يُمسّ نص أي مادة ولا عنوانها؛ يتغير النظام والرقم، ويُعاد حساب
 * بادئة search_norm (اسم النظام)، وتُحدَّث إحالات المكنز (legal_thesaurus_occurrences) للصفوف المنقولة.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { normalizeArabicText } from "../../../lib/modules/legal-core/arabic-morphology";
import { lawSlug } from "../../../lib/modules/legal-core/eli";

const dir = "data/renumber/split-2026-10-17";
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sysId = (k: string) => `hkm28-${createHash("sha256").update(`system-${k}`).digest("hex").slice(0, 24)}`;

type Part = { name: string; from: number; to: number; firstTitle: string };
type Split = { parentId: string; parentName: string; parentCount: number; keep: number; boeUrl: string; parts: Part[] };

const DEV = "تنظيم هيئات تطوير المناطق والمدن واللائحة المالية لهيئات تطوير المناطق والمدن واللائحة الإدارية لهيئات تطوير المناطق والمدن";
const MED = "نظام الميداليات المدنية والعسكرية";
const splits: Split[] = [
  {
    parentId: "cmpz5q6wh006fcwg26khgt4yb",
    parentName: DEV,
    parentCount: 139,
    keep: 18,
    boeUrl: "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2ae2b616-e5c9-4b81-b55e-ae3d00acbf1a/1",
    parts: [
      { name: "اللائحة المالية لهيئات تطوير المناطق والمدن", from: 19, to: 92, firstTitle: "الأولى" },
      { name: "اللائحة الإدارية لهيئات تطوير المناطق والمدن", from: 93, to: 139, firstTitle: "الأولى" },
    ],
  },
  {
    parentId: "cmpz5pv9e004scwg2k9sjbqa1",
    parentName: MED,
    parentCount: 25,
    keep: 7,
    boeUrl: "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/e1fd0b90-ced3-4402-ad60-a9a700f1f755/1",
    parts: [
      { name: `${MED} (ميدالية التقدير العسكري)`, from: 8, to: 13, firstTitle: "الأولى" },
      { name: `${MED} (ميدالية الصقر للطيران)`, from: 14, to: 19, firstTitle: "الأولى" },
      { name: `${MED} (ميدالية سلاح البحرية)`, from: 20, to: 25, firstTitle: "الأولى" },
    ],
  },
];
// مادتها الأولى تُعرّف الميدالية: حارس على أن الجزء يبدأ حيث نظن.
const firstContent: Record<string, string> = {
  [`${MED} (ميدالية التقدير العسكري)`]: "التقدير العسكري",
  [`${MED} (ميدالية الصقر للطيران)`]: "الصقر للطيران",
  [`${MED} (ميدالية سلاح البحرية)`]: "سلاح البحرية",
};

const s: string[] = [];
s.push("CREATE TEMP TABLE split_plan (id text PRIMARY KEY, parent_id text, old_number int, new_system text, new_name text, new_number int) ON COMMIT DROP");
for (const sp of splits) {
  s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${q(sp.parentId)} AND "lawName" = ${q(sp.parentName)}) = ${sp.parentCount} AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(sp.parentName)}) = ${sp.parentCount} AND NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(sp.parentName)} AND "articleBis" <> 0) THEN 1 ELSE 0 END) AS guard_parent`);
  const oldNorm = normalizeArabicText(sp.parentName);
  for (const p of sp.parts) {
    const id = sysId(p.name);
    const k = p.to - p.from + 1;
    s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM legal_systems WHERE id = ${q(id)} OR name = ${q(p.name)} OR eli_slug = ${q(lawSlug(p.name))}) AND NOT EXISTS (SELECT 1 FROM legal_articles WHERE "lawName" = ${q(p.name)}) THEN 1 ELSE 0 END) AS guard_new_free`);
    s.push(
      `INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", code, domain, domain_title, sort_order, eli_slug, preamble, preamble_royal_decree, preamble_effective_from, preamble_updated_at, instrument_kind) SELECT ${q(id)}, ${q(p.name)}, classification, ${k}, now(), now(), NULL, domain, domain_title, sort_order, ${q(lawSlug(p.name))}, preamble, preamble_royal_decree, preamble_effective_from, now(), instrument_kind FROM legal_systems WHERE id = ${q(sp.parentId)}`,
    );
    s.push(
      `INSERT INTO split_plan SELECT a.id, ${q(sp.parentId)}, a."articleNumber", ${q(id)}, ${q(p.name)}, a."articleNumber" - ${p.from - 1} FROM legal_articles a WHERE a."legalSystemId" = ${q(sp.parentId)} AND a."lawName" = ${q(sp.parentName)} AND a."articleBis" = 0 AND a."articleNumber" BETWEEN ${p.from} AND ${p.to}`,
    );
    s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM split_plan WHERE new_system = ${q(id)}) = ${k} THEN 1 ELSE 0 END) AS guard_part_count`);
    // أول مادة في الجزء عنوانها «الأولى»، وكل صف منقول يبدأ search_norm فيه باسم النظام الأصلي المطبَّع.
    s.push(`SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM legal_articles a WHERE a."legalSystemId" = ${q(sp.parentId)} AND a."articleNumber" = ${p.from} AND a.title LIKE ${q(`%${p.firstTitle}%`)}${firstContent[p.name] ? ` AND a.content LIKE ${q(`%${firstContent[p.name]}%`)}` : ""}) AND NOT EXISTS (SELECT 1 FROM split_plan sp JOIN legal_articles a ON a.id = sp.id WHERE sp.new_system = ${q(id)} AND left(a.search_norm, ${oldNorm.length}) <> ${q(oldNorm)}) THEN 1 ELSE 0 END) AS guard_part_start`);
    s.push(
      `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at) SELECT ${q(id.replace("hkm28-", "hkm28v-"))}, 'work', ${q(id)}, 'ساري', preamble_royal_decree, ${q(sp.boeUrl)}, ${q(`جزء من «${sp.parentName}» في صفحة هيئة الخبراء (لقطة 28/9/2026)، وحالته فيها: ساري؛ فُصل في نظام مستقل لأن مواده مرقّمة من الأولى`)}, 'manual', 'hkm028-split-2026-10-17', now() FROM legal_systems WHERE id = ${q(sp.parentId)}`,
    );
  }
  s.push(
    `UPDATE legal_articles a SET "legalSystemId" = p.new_system, "lawName" = p.new_name, "articleNumber" = p.new_number, search_norm = ${"normalize_placeholder"}, "updatedAt" = now() FROM split_plan p WHERE a.id = p.id AND p.parent_id = ${q(sp.parentId)}`.replace(
      "normalize_placeholder",
      // البادئة المطبَّعة لاسم النظام تُستبدل ببادئة الاسم الجديد؛ بقية النص كما هي.
      `(CASE ${sp.parts.map((p) => `WHEN p.new_system = ${q(sysId(p.name))} THEN ${q(normalizeArabicText(p.name))} || substr(a.search_norm, ${oldNorm.length + 1})`).join(" ")} END)`,
    ),
  );
  s.push(`UPDATE legal_thesaurus_occurrences o SET legal_source_id = p.new_system, legal_source_name = p.new_name, article_number = p.new_number FROM split_plan p WHERE o.article_id = p.id AND p.parent_id = ${q(sp.parentId)}`);
  s.push(`UPDATE legal_systems SET "articleCount" = ${sp.keep}, "updatedAt" = now() WHERE id = ${q(sp.parentId)}`);
  s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${q(sp.parentId)}) = ${sp.keep} AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "legalSystemId" = ${q(sp.parentId)} AND "articleNumber" BETWEEN 1 AND ${sp.keep}) = ${sp.keep} THEN 1 ELSE 0 END) AS guard_parent_after`);
  for (const p of sp.parts) {
    const k = p.to - p.from + 1;
    s.push(`SELECT 1 / (CASE WHEN (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "legalSystemId" = ${q(sysId(p.name))} AND "lawName" = ${q(p.name)} AND "articleNumber" BETWEEN 1 AND ${k}) = ${k} AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(p.name)}) = ${k} THEN 1 ELSE 0 END) AS guard_part_after`);
  }
}
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM legal_thesaurus_occurrences o JOIN split_plan p ON o.article_id = p.id WHERE o.legal_source_id <> p.new_system) THEN 1 ELSE 0 END) AS guard_thesaurus`);

writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify(splits.map((sp) => ({ ...sp, parts: sp.parts.map((p) => ({ ...p, id: sysId(p.name), eliSlug: lawSlug(p.name), articles: p.to - p.from + 1 })) })), null, 1) + "\n",
);
console.log(`statements ${s.length}`);
