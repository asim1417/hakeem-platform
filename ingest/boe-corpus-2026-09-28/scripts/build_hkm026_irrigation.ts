/**
 * HKM-026: إضافة تنظيم المؤسسة العامة للري 1447هـ وتسجيل القديم (1439هـ) «مستبدل».
 * إضافة فقط (INSERT): legal_systems، legal_articles (16 مادة بنصها كما في لقطة الهيئة 2026-09-28)،
 * verification (العمل الجديد «ساري» ومواده، والعمل القديم «مستبدل» يلغي سجله السابق بـ supersedes)،
 * search_surface وsearch_surface_member (الوجه: القديم من 2018-01-02 ثم الجديد من 2025-07-18)، law_card.
 * لا UPDATE ولا DELETE. المعرّفات حتمية (إعادة البناء تعطي الملف نفسه).
 *
 * التشغيل: npx tsx ingest/boe-corpus-2026-09-28/scripts/build_hkm026_irrigation.ts
 * المخرجات: ingest/boe-corpus-2026-09-28/data/hkm026-2026-10-17/{apply.sql,check.sql,manifest.json}
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeArabicText } from "../../../lib/modules/legal-core/arabic-morphology";
import { lawSlug } from "../../../lib/modules/legal-core/eli";

const ROOT = join(__dirname, "..", "data");
const OUT = join(ROOT, "hkm026-2026-10-17");
const LAW_ID = "boe26-d757638789cfefd3fe9c817f"; // معرّف القانون في اللقطة = معرّف النظام الجديد
const OLD_ID = "cmpz5qfgb007mcwg2msul8acv"; // سجل حكيم بنص 1439هـ
const OLD_WORK_VERIFICATION = "boe26-28848b9f2d1a88838a0b1ca6"; // «ملغى» (حقن المرحلة 1)
const BY = "owner-inject-hkm026-2026-10-17";
const SOURCE_URL = "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/831af69c-9bad-4f06-9843-b33100926b3c/1";
const INSTRUMENT = "قرار مجلس الوزراء رقم (43) وتاريخ 1447/1/13هـ";
const OLD_INSTRUMENT = "قرار مجلس الوزراء رقم (187) وتاريخ 1439/4/15هـ";
const EFFECTIVE = "2025-07-18"; // النشر 1447/01/23هـ؛ المادة 16: «ويعمل به من تاريخ نشره»
const NAME = "تنظيم المؤسسة العامة للري الصادر بقرار مجلس الوزراء رقم (43) وتاريخ 1447/1/13هـ";
const CLASSIFICATION = "أنظمة الزراعة والمياه والثروات الحية";
const WORK_KEY = `we:${OLD_ID}`;

const jsonl = <T>(f: string): T[] => readFileSync(join(ROOT, "parsed", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
const id = (prefix: string, ...parts: string[]) => `${prefix}-${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}`;
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

function lit(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  if (v.includes("$hk$")) throw new Error("قيمة تحوي وسم الاقتباس");
  return `$hk$${v}$hk$`;
}

type Law = { id: string; guid: string; name: string; summary: string; category_path: string[]; issued_hijri: string; issued_gregorian: string; published_hijri: string; published_gregorian: string; status_at_source: string; instruments: unknown[]; article_count: number };
type Unit = { law_id: string; seq: number; heading: string; article_number: number; is_bis: boolean; body: string; body_sha256: string };
type Block = { law_id: string; seq: number; kind: string; heading: string | null; body: string };

const law = jsonl<Law>("law.jsonl").find((l) => l.id === LAW_ID);
if (!law) throw new Error("القانون غير موجود في اللقطة");
const units = jsonl<Unit>("unit.jsonl").filter((u) => u.law_id === LAW_ID).sort((a, b) => a.seq - b.seq);
const blocks = jsonl<Block>("text_block.jsonl").filter((b) => b.law_id === LAW_ID).sort((a, b) => a.seq - b.seq);
if (units.length !== law.article_count || units.length !== 16) throw new Error(`عدد المواد ${units.length} لا يطابق ${law.article_count}`);
units.forEach((u, i) => {
  if (u.article_number !== i + 1 || u.is_bis) throw new Error(`ترقيم غير متصل عند ${u.seq}`);
  if (sha(u.body) !== u.body_sha256) throw new Error(`بصمة المادة ${u.seq} لا تطابق اللقطة`);
});
const decision = blocks.find((b) => b.kind === "cabinet_decision");
if (!decision) throw new Error("قرار مجلس الوزراء غير موجود");
const replaceClause = decision.body.split("\n").find((l) => l.startsWith("ثانياً: يحل التنظيم"));
if (!replaceClause) throw new Error("بند الإحلال غير موجود");
const lastArticle = units[15].body;
if (!lastArticle.includes("ويعمل به من تاريخ نشره")) throw new Error("مادة النفاذ تغيّرت");

const now = "2026-10-17T00:00:00Z";
const preamble = `أداة الإصدار:\n${INSTRUMENT}\nتاريخ الإصدار (هجريّ): 1447-01-13\nتاريخ الإصدار (ميلاديّ): ${law.issued_gregorian}\nتاريخ النشر: ${law.published_hijri}هـ (${law.published_gregorian})`;
const slug = lawSlug(NAME);
const sql: string[] = [];
sql.push(`INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, eli_slug, preamble, preamble_royal_decree, preamble_effective_from)
VALUES (${lit(LAW_ID)}, ${lit(NAME)}, ${lit(CLASSIFICATION)}, 16, ${lit(now)}::timestamp, ${lit(now)}::timestamp, 'regulatory', 'تنظيمي قطاعي', ${lit(slug)}, ${lit(preamble)}, ${lit(INSTRUMENT)}, ${lit(EFFECTIVE)}::timestamp);`);

const articleIds: string[] = [];
const norms: string[] = [];
const articleRows: string[] = [];
for (const u of units) {
  const aid = id("boe26", LAW_ID, "article", String(u.article_number));
  articleIds.push(aid);
  const searchNorm = normalizeArabicText([NAME, u.heading, u.body, CLASSIFICATION].filter(Boolean).join("\n"));
  norms.push(searchNorm);
  articleRows.push(`(${lit(aid)}, ${u.article_number}, ${lit(u.heading)}, ${lit(u.body)}, ${lit(searchNorm)})`);
}
sql.push(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT v.id, ${lit(LAW_ID)}, ${lit(NAME)}, ${lit(CLASSIFICATION)}, v.n, v.title, v.content, ${lit(INSTRUMENT)}, NULL, 'سارية', ${lit(now)}::timestamp, ${lit(now)}::timestamp, v.sn
FROM (VALUES
${articleRows.join(",\n")}
) AS v(id, n, title, content, sn);`);

const verif = (objType: string, objId: string, status: string, quote: string, instrument: string, supersedes: string | null = null) =>
  `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES (${lit(id("vf26", "hkm026", objType, objId, status))}, ${lit(objType)}, ${lit(objId)}, ${lit(status)}, ${lit(instrument)}, ${lit(SOURCE_URL)}, ${lit(quote)}, 'manual', ${lit(BY)}, ${lit(supersedes)});`;
sql.push(verif("work", LAW_ID, "ساري", `حالة التنظيم في بوابة هيئة الخبراء بمجلس الوزراء: ${law.status_at_source} (رُصدت 28/9/2026). النشر ${law.published_hijri}هـ؛ المادة السادسة عشرة: «${lastArticle}»`, INSTRUMENT));
sql.push(`INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT v.vid, 'unit', v.aid, 'ساري', ${lit(INSTRUMENT)}, ${lit(SOURCE_URL)}, ${lit(`نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026)؛ يعمل بالتنظيم من تاريخ نشره ${law.published_hijri}هـ`)}, 'manual', ${lit(BY)}, NULL
FROM (VALUES ${articleIds.map((aid) => `(${lit(id("vf26", "hkm026", "unit", aid, "ساري"))}, ${lit(aid)})`).join(", ")}) AS v(vid, aid);`);
sql.push(verif("work", OLD_ID, "مستبدل", `${INSTRUMENT}، البند ${replaceClause}`, OLD_INSTRUMENT, OLD_WORK_VERIFICATION));

const oldSurface = id("ss26", WORK_KEY, "old");
sql.push(`INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by) VALUES
(${lit(oldSurface)}, ${lit(WORK_KEY)}, ${lit(OLD_ID)}, '2018-01-02', ${lit(`work_edition:old ${OLD_INSTRUMENT} valid_from=2018-01-02 valid_to=${EFFECTIVE}`)}, NULL, ${lit(BY)}),
(${lit(id("ss26", WORK_KEY, "new"))}, ${lit(WORK_KEY)}, ${lit(LAW_ID)}, ${lit(EFFECTIVE)}, ${lit(`work_edition:new ${INSTRUMENT} valid_from=${EFFECTIVE}`)}, ${lit(oldSurface)}, ${lit(BY)});`);
sql.push(`INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
(${lit(id("sm26", WORK_KEY, OLD_ID))}, ${lit(WORK_KEY)}, ${lit(OLD_ID)}, 'edition_old', ${lit(BY)}),
(${lit(id("sm26", WORK_KEY, LAW_ID))}, ${lit(WORK_KEY)}, ${lit(LAW_ID)}, 'edition_new', ${lit(BY)});`);
// بطاقة النظام القائمة على السجل القديم هي بطاقة تنظيم 1447هـ نفسها (guid 831af69c): تُنسخ للنظام الجديد.
sql.push(`INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT ${lit(id("lc26", LAW_ID))}, ${lit(LAW_ID)}, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, ${lit(BY)}
FROM law_card WHERE system_id = ${lit(OLD_ID)} AND source_url = ${lit(SOURCE_URL)} AND issued_hijri = ${lit(law.issued_hijri)};`);

const expected = { legal_systems: 1, legal_articles: 16, verification: 18, search_surface: 2, search_surface_member: 2, law_card: 1 };
const guard = `DO $g$ BEGIN
  IF (SELECT count(*) FROM legal_systems WHERE id = ${lit(LAW_ID)}) <> 1 THEN RAISE EXCEPTION 'hkm026: legal_systems'; END IF;
  IF (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${lit(LAW_ID)}) <> 16 THEN RAISE EXCEPTION 'hkm026: legal_articles'; END IF;
  IF (SELECT count(*) FROM verification WHERE verified_by = ${lit(BY)}) <> 18 THEN RAISE EXCEPTION 'hkm026: verification'; END IF;
  IF (SELECT count(*) FROM search_surface WHERE work_key = ${lit(WORK_KEY)}) <> 2 THEN RAISE EXCEPTION 'hkm026: search_surface'; END IF;
  IF (SELECT count(*) FROM search_surface_member WHERE work_key = ${lit(WORK_KEY)}) <> 2 THEN RAISE EXCEPTION 'hkm026: members'; END IF;
  IF (SELECT count(*) FROM law_card WHERE system_id = ${lit(LAW_ID)}) <> 1 THEN RAISE EXCEPTION 'hkm026: law_card'; END IF;
  IF (SELECT md5(string_agg(search_norm, '|' ORDER BY "articleNumber")) FROM legal_articles WHERE "legalSystemId" = ${lit(LAW_ID)}) IS DISTINCT FROM '${createHash("md5").update(norms.join("|"), "utf8").digest("hex")}' THEN RAISE EXCEPTION 'hkm026: search_norm'; END IF;
  -- النص كما ورد: بصمة كل مادة تطابق بصمة اللقطة، وإلا تُلغى المعاملة كلها.
${units.map((u, i) => `  IF (SELECT encode(sha256(convert_to(content, 'UTF8')), 'hex') FROM legal_articles WHERE id = ${lit(articleIds[i])}) IS DISTINCT FROM '${u.body_sha256}' THEN RAISE EXCEPTION 'hkm026: نص المادة ${u.article_number}'; END IF;`).join("\n")}
END $g$;`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "apply.sql"), `-- HKM-026 — إضافة فقط. يُنفَّذ في معاملة واحدة عبر Neon MCP.\n${sql.join("\n\n")}\n\n${guard}\n`);
writeFileSync(
  join(OUT, "check.sql"),
  `-- قراءة فقط بعد التطبيق.
SELECT (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${lit(LAW_ID)}) AS articles,
       (SELECT md5(string_agg(content, '|' ORDER BY "articleNumber")) FROM legal_articles WHERE "legalSystemId" = ${lit(LAW_ID)}) AS content_md5,
       (SELECT verified_status FROM verification WHERE object_type = 'work' AND object_id = ${lit(OLD_ID)} ORDER BY verified_at DESC, id DESC LIMIT 1) AS old_status,
       (SELECT verified_status FROM verification WHERE object_type = 'work' AND object_id = ${lit(LAW_ID)} ORDER BY verified_at DESC, id DESC LIMIT 1) AS new_status,
       (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${lit(OLD_ID)}) AS old_articles_kept;\n`,
);
// للنقل عبر Neon MCP: مصفوفة العبارات نفسها بالترتيب (المعاملة الواحدة تشمل الحارس).
writeFileSync(join(OUT, "statements.json"), JSON.stringify([...sql, guard]));
const contentMd5 = createHash("md5").update(units.map((u) => u.body).join("|"), "utf8").digest("hex");
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify({ law_id: LAW_ID, guid: law.guid, name: NAME, slug, effective: EFFECTIVE, instrument: INSTRUMENT, replace_clause: replaceClause, articles: units.map((u, i) => ({ id: articleIds[i], n: u.article_number, heading: u.heading, body_sha256: u.body_sha256 })), expected, content_md5: contentMd5 }, null, 2),
);
console.log(JSON.stringify({ slug, statements: sql.length, expected, content_md5: contentMd5 }));
