/**
 * HKM-028: تصحيح ترقيم نظام المحاكم التجارية (18/10/2026، بإذن المالك «عالج كل الخطوات ونفذها»). يولّد statements.json.
 *   npx tsx data/renumber/commercial-courts-2026-10-18/build.ts
 *
 * سقطت المادتان 19 و26 عند الاستيراد، فحمل الصف 19–24 نص 20–25، والصف 25–94 نص 27–96، وأُضيف لاحقًا 95 و96
 * بنصهما الصحيح، فصار 93 و94 نسختين منهما. المرجع: لقطة الهيئة 28/09/2026 (96 مادة متصلة).
 * - إعادة ترقيم 74 صفًّا إلى رقم المادة التي يحملها نصها (يُثبت بمطابقة النص للقطة لا بالإزاحة)، والعنوان «المادة N»
 *   يتبع الرقم، وبادئة search_norm («… الماده N») كذلك، وإحالات المكنز.
 * - علامة الصف غير المادي (100) لـ 93 و94 (نسختا 95 و96).
 * - إدراج 19 و26 من اللقطة كما وردتا (توحيد المسافات فقط).
 * لا يُعدَّل نص قائم. حراس: العدد، والرقم الحالي وبصمة النص لكل معرّف.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";
import { normalizeArabicText } from "../../../lib/modules/legal-core/arabic-morphology";

const dir = "data/renumber/commercial-courts-2026-10-18";
const LAW = "نظام المحاكم التجارية";
const GUID = "38334008-3b70-4c6c-b3af-aba3016a8061";
const BOE_URL = `https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/${GUID}/1`;
const NON_ARTICLE = 100;
const OFFSET = 100000;
const P = "ingest/boe-corpus-2026-09-28/data/parsed";

type Row = { id: string; n: number; b: number; title: string; m: string; sn: string; c: string; classification: string; keywords: string[]; chapter: string | null };
type Unit = { law_id: string; seq: number; heading: string; article_number: number; is_bis: boolean; body: string; body_sha256: string };
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const N = (s: string) =>
  s.replace(/[ً-ْـٰ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/[ىئ]/g, "ي").replace(/ؤ/g, "و").replace(/ة/g, "ه").replace(/[^ء-ي]/g, "");

const rows = (JSON.parse(readFileSync(`${dir}/db-rows.json`, "utf8")) as Row[]).filter((r) => r.b === 0);
if (rows.length !== 96) throw new Error(`الصفوف ${rows.length}`);
const law = readFileSync(`${P}/law.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { id: string; guid: string }).find((l) => l.guid === GUID);
if (!law) throw new Error("النظام غير موجود في اللقطة");
const units = readFileSync(`${P}/unit.jsonl`, "utf8").split("\n").filter((l) => l.includes(`"${law.id}"`)).map((l) => JSON.parse(l) as Unit).filter((u) => !u.is_bis);
if (units.length !== 96 || units.some((u, i) => u.article_number !== i + 1)) throw new Error("وحدات اللقطة غير متصلة");
const boe = new Map(units.map((u) => [u.article_number, N(u.body)]));

// الرقم الذي يحمله نص الصف: نافذة من نصه (بعد رأس «المادة …») توجد في مطلع مادة واحدة فقط من اللقطة.
function carried(r: Row): number | null {
  const t = N(r.c.replace(/^\(?\s*المادة\s+\S+(?:\s+(?:و|بعد)\S*)*(?:\s+\S+)?\s+/, ""));
  for (const off of [0, 6, 12, 20, 30, 45, 60, 80]) {
    const w = t.slice(off, off + 30);
    if (w.length < 16) continue;
    const hits = [...boe].filter(([, b]) => b.slice(0, 400).includes(w)).map(([n]) => n);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

const plan: Array<{ id: string; from: number; to: number; m: string; bis: number }> = [];
for (const r of rows) {
  const k = carried(r);
  if (k === null) throw new Error(`صف ${r.n}: لا مطابقة وحيدة في اللقطة`);
  if (r.n <= 18 || r.n >= 95) {
    if (k !== r.n) throw new Error(`صف ${r.n} يُفترض سليمًا ويحمل ${k}`);
    continue;
  }
  if (r.n === 93 || r.n === 94) {
    if (k !== r.n + 2) throw new Error(`صف ${r.n} يحمل ${k}`);
    plan.push({ id: r.id, from: r.n, to: r.n, m: r.m, bis: NON_ARTICLE });
    continue;
  }
  const want = r.n <= 24 ? r.n + 1 : r.n + 2;
  if (k !== want) throw new Error(`صف ${r.n} يحمل ${k} لا ${want}`);
  plan.push({ id: r.id, from: r.n, to: k, m: r.m, bis: 0 });
}
const moved = plan.filter((p) => p.bis === 0);
const marked = plan.filter((p) => p.bis === NON_ARTICLE);
if (moved.length !== 74 || marked.length !== 2) throw new Error(`الخطة ${moved.length}/${marked.length}`);
const finalNums = new Set([...rows.filter((r) => r.n <= 18 || r.n >= 95).map((r) => r.n), ...moved.map((p) => p.to)]);
if (finalNums.size !== 94 || finalNums.has(19) || finalNums.has(26)) throw new Error("الأرقام بعد النقل");

const template = rows.find((r) => r.n === 18)!;
const inserts = [19, 26].map((n) => {
  const u = units[n - 1];
  if (createHash("sha256").update(u.body, "utf8").digest("hex") !== u.body_sha256) throw new Error(`بصمة ${n}`);
  const row = { lawName: LAW, title: flat(u.heading).startsWith("المادة") ? flat(u.heading) : `المادة ${flat(u.heading)}`, content: flat(u.body), keywords: [] as string[], classification: template.classification, chapter: template.chapter };
  return { n, id: `hkm28-${createHash("sha256").update(`commercial-courts-${n}`).digest("hex").slice(0, 24)}`, ...row, sn: buildSearchNorm(row) };
});

const lawNorm = normalizeArabicText(LAW);
const s: string[] = [];
s.push("CREATE TEMP TABLE cc_plan (id text PRIMARY KEY, cur int, new_n int, new_b int, m text) ON COMMIT DROP");
s.push(`INSERT INTO cc_plan VALUES ${plan.map((p) => `(${q(p.id)}, ${p.from}, ${p.to}, ${p.bis}, ${q(p.m)})`).join(", ")}`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)}) = 96 AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" <> 0) = 0 THEN 1 ELSE 0 END) AS guard_count`);
s.push(`SELECT 1 / (CASE WHEN (SELECT count(*) FROM cc_plan p JOIN legal_articles a ON a.id = p.id AND a."lawName" = ${q(LAW)} AND a."articleNumber" = p.cur AND a."articleBis" = 0 AND md5(a.content) = p.m AND a.title = 'المادة ' || p.cur) = ${plan.length} THEN 1 ELSE 0 END) AS guard_rows`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM cc_plan p JOIN legal_articles a ON a.id = p.id WHERE p.new_b = 0 AND a.search_norm NOT LIKE ${q(`${lawNorm} الماده `)} || p.cur || ' %') THEN 1 ELSE 0 END) AS guard_norm_prefix`);
s.push(`SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM unit_version v JOIN cc_plan p ON p.id = v.unit_id) AND NOT EXISTS (SELECT 1 FROM verification v JOIN cc_plan p ON p.id = v.object_id) THEN 1 ELSE 0 END) AS guard_no_overlays`);
// إزاحة مؤقتة ثم الرقم النهائي (القيد الفريد lawName+articleNumber+articleBis).
// النسختان أولًا إلى علامة الصف غير المادي، فيخلو الرقمان 93 و94.
s.push(`UPDATE legal_articles a SET "articleBis" = p.new_b, "updatedAt" = now() FROM cc_plan p WHERE a.id = p.id AND p.new_b = ${NON_ARTICLE}`);
s.push(`UPDATE legal_articles a SET "articleNumber" = p.cur + ${OFFSET} FROM cc_plan p WHERE a.id = p.id AND p.new_b = 0`);
s.push(
  `UPDATE legal_articles a SET "articleNumber" = p.new_n, title = 'المادة ' || p.new_n, search_norm = ${q(`${lawNorm} الماده `)} || p.new_n || substr(a.search_norm, length(${q(`${lawNorm} الماده `)} || p.cur) + 1), "updatedAt" = now() FROM cc_plan p WHERE a.id = p.id AND p.new_b = 0`,
);
s.push(`UPDATE legal_thesaurus_occurrences o SET article_number = p.new_n FROM cc_plan p WHERE o.article_id = p.id AND p.new_b = 0`);
for (const r of inserts) {
  s.push(
    `INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, chapter, keywords, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm, norm_source) SELECT ${q(r.id)}, t."legalSystemId", t."lawName", t.classification, ${r.n}, 0, ${q(r.title)}, ${q(r.content)}, t.chapter, '{}'::text[], t."royalDecree", t."effectiveFrom", t.status, now(), now(), ${q(r.sn)}, 'rule' FROM legal_articles t WHERE t.id = ${q(template.id)}`,
  );
}
s.push(
  `SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" = 0) = 96 AND (SELECT count(DISTINCT "articleNumber") FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" = 0 AND "articleNumber" BETWEEN 1 AND 96) = 96 AND (SELECT count(*) FROM legal_articles WHERE "lawName" = ${q(LAW)} AND "articleBis" = ${NON_ARTICLE}) = 2 AND NOT EXISTS (SELECT 1 FROM cc_plan p JOIN legal_articles a ON a.id = p.id WHERE md5(a.content) <> p.m) AND NOT EXISTS (SELECT 1 FROM legal_thesaurus_occurrences o JOIN cc_plan p ON o.article_id = p.id WHERE p.new_b = 0 AND o.article_number <> p.new_n) THEN 1 ELSE 0 END) AS guard_after`,
);

const md5Nfc = (t: string) => createHash("md5").update(t.normalize("NFC")).digest("hex");
writeFileSync(`${dir}/statements.json`, JSON.stringify(s, null, 1) + "\n");
writeFileSync(
  `${dir}/plan.json`,
  JSON.stringify({ source: BOE_URL, snapshot: "2026-09-28", moved: moved.map(({ id, from, to }) => ({ id, from, to })), nonArticle: marked.map(({ id, from }) => ({ id, n: from, duplicateOf: from + 2 })), inserted: inserts.map(({ id, n, title, content }) => ({ id, n, title, md5Nfc: md5Nfc(content), contentStart: content.slice(0, 80) })) }, null, 1) + "\n",
);
console.log(`statements ${s.length} | moved ${moved.length} | non-article ${marked.length} | inserted ${inserts.length}`);
