/**
 * HKM-028: نظام المرافعات أمام ديوان المظالم (17/10/2026). يولّد statements.json لمعاملة واحدة بحراس.
 *   npx tsx data/renumber/grievances-2026-10-17/build.ts
 *
 * ستة صفوف من استيراد قديم (cmpwi9…) مقاطع تجمع عدة مواد (3–4 آلاف حرف) تحت أرقام 10 و12–15 و20:
 * صفّا 10 و20 يبدآن بمادتيهما ثم يكملان بما بعدهما، وصفوف 12–15 تبدأ بنصوص 30 و40 و50 و60 (وهذه موجودة صحيحة
 * في صفوفها). لا يُعدَّل نص قائم: تأخذ المقاطع الستة علامة الصف غير المادي (100)، وتُدرج المواد الست من لقطة
 * الهيئة 28/09/2026 كما وردت (توحيد المسافات فقط). لا تعديل عليها في صفحة الهيئة (المعدّلة 3 و4 و8 و60 فقط).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";

const LAW = "نظام المرافعات أمام ديوان المظالم";
const BOE_LAW_NAME = LAW;
const TEMPLATE = "cmpzcuysd080bvtrkrrvqshv0"; // المادة 11: يُنسخ منها معرّف النظام والتصنيف والحالة
const NON_ARTICLE = 100;
const dir = "data/renumber/grievances-2026-10-17";

// [المعرّف، بصمة النص الحالي (md5)، الرقم]. صف 15 قصير (نسخة من 60)، فالحارس بالبصمة لا بالطول.
const chunks: Array<[string, string, number]> = [
  ["cmpwi9p9w01mhnxff8gwnm0a4", "79adbf33093af69acb5e3843e9549a36", 10],
  ["cmpwi9plr01mjnxffbksuhf53", "e67a61525c5bd94a43525f4c5625bc01", 12],
  ["cmpwi9pxm01mlnxff0uhiqup9", "7fa57556a0ca61eacd4656202bd7ec2d", 13],
  ["cmpwi9q9s01mnnxffuwuv3doa", "c6f69cfc39962e38ee9073a08d78a44a", 14],
  ["cmpwi9qlo01mpnxffbriwmt8z", "e232913f7e0b713e9fccb718841e9f58", 15],
  ["cmpwi9qxi01mrnxffp8omgpsu", "9394c1092c917d6c9d78f092505cf490", 20],
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const id = (k: string) => `hkm28-${createHash("sha256").update(k).digest("hex").slice(0, 24)}`;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

type Law = { id: string; name: string };
type Unit = { law_id: string; seq: number; heading: string; article_number: number | null; is_bis: boolean; body: string };
const P = "ingest/boe-corpus-2026-09-28/data/parsed";
const law = readFileSync(`${P}/law.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Law).find((l) => l.name === BOE_LAW_NAME);
if (!law) throw new Error("النظام غير موجود في اللقطة");
const units = readFileSync(`${P}/unit.jsonl`, "utf8").split("\n").filter((l) => l.includes(`"${law.id}"`)).map((l) => JSON.parse(l) as Unit);
if (units.length !== 63) throw new Error(`عدد الوحدات ${units.length}`);

const inserts = chunks.map(([, , n]) => {
  const u = units.find((x) => x.article_number === n && !x.is_bis);
  if (!u) throw new Error(`لا وحدة للمادة ${n}`);
  const row = { lawName: LAW, title: flat(u.heading), content: flat(u.body), keywords: [] as string[], classification: null as string | null, chapter: "" };
  return { n, id: id(`grievances-${n}`), ...row };
});

const s: string[] = [];
s.push("CREATE TEMP TABLE renumber_plan (id text PRIMARY KEY, current_number int, new_number int, new_bis int) ON COMMIT DROP");
s.push(`INSERT INTO renumber_plan VALUES ${chunks.map(([i, , n]) => `(${q(i)}, ${n}, ${n}, ${NON_ARTICLE})`).join(", ")}`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)}) = 63 THEN 1 ELSE 0 END) AS guard_count`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM renumber_plan p LEFT JOIN legal_articles a ON a.id = p.id AND a."lawName" = ${q(LAW)} AND a."articleNumber" = p.current_number AND a."articleBis" = 0 WHERE a.id IS NULL) THEN 1 ELSE 0 END) AS guard_rows`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE (id, md5(content)) IN (${chunks.map(([i, m]) => `(${q(i)}, ${q(m)})`).join(", ")})) = ${chunks.length} THEN 1 ELSE 0 END) AS guard_fingerprint`);
s.push(`SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM legal_articles WHERE id = ${q(TEMPLATE)} AND "lawName" = ${q(LAW)} AND "articleNumber" = 11) THEN 1 ELSE 0 END) AS guard_template`);
s.push(`UPDATE legal_articles a SET "articleBis" = p.new_bis FROM renumber_plan p WHERE a.id = p.id`);
for (const r of inserts) {
  // التصنيف والفصل والكلمات تُنسخ من صف القالب، فيُحسب search_norm في القاعدة بالحقول نفسها لاحقًا؛ هنا يُبنى بالتصنيف المقروء.
  s.push(
    `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) SELECT ${q(r.id)}, t."legalSystemId", t."lawName", t.classification, ${r.n}, 0, ${q(r.title)}, ${q(r.content)}, t.chapter, t.keywords, t."royalDecree", t."effectiveFrom", t.status, now(), now(), __NORM_${r.n}__, 'rule' FROM legal_articles t WHERE t.id = ${q(TEMPLATE)}`,
  );
}
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" = 0) = 63 AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" = 0) = 63 THEN 1 ELSE 0 END) AS guard_after`);

writeFileSync(`${dir}/inserts.json`, JSON.stringify(inserts, null, 1) + "\n");
writeFileSync(`${dir}/statements.template.json`, JSON.stringify(s, null, 1) + "\n");
// search_norm يحتاج التصنيف والفصل والكلمات من صف القالب: تُمرَّر قيمها عبر الوسيط --template '{"classification":…,"chapter":…,"keywords":[…]}'.
const tIdx = process.argv.indexOf("--template");
if (tIdx > 0) {
  const t = JSON.parse(process.argv[tIdx + 1]) as { classification: string | null; chapter: string | null; keywords: string[] };
  const out = s.map((x) => x.replace(/__NORM_(\d+)__/, (_, n) => {
    const r = inserts.find((i) => i.n === Number(n))!;
    return q(buildSearchNorm({ ...r, classification: t.classification, chapter: t.chapter, keywords: t.keywords }));
  }));
  writeFileSync(`${dir}/statements.json`, JSON.stringify(out, null, 1) + "\n");
  console.log(`statements ${out.length} | chunks ${chunks.length} | insert ${inserts.length}`);
}
