/**
 * HKM-028 (18/10/2026): إضافة الإصدارات الجديدة لثلاثة أنظمة يحمل حكيم إصدارها القديم وحده، على نمط HKM-026.
 * بإذن المالك: «بالنسبة للانظمة القديمة اقترح عدم حذفها بس تبين انها … ملغى او غير سارية اما النظام الجديد فيثبت في حالته انه ساري».
 *   - تنظيم الهيئة العامة للطيران المدني: قرار مجلس الوزراء (807) 1446/11/14هـ؛ القديم «مستبدل» (البند ثانياً).
 *   - نظام القياس والمعايرة: م/79 1446/3/6هـ؛ القديم «مستبدل» (المادة 17).
 *   - نظام التأمينات الاجتماعية: م/273 1445/12/26هـ. لا يلغي القديم: البند رابعاً من المرسوم يُبقي العمل به على فئتين،
 *     والهيئة تعرضه «ساري». فيبقى «ساري» بسجل تحقق جديد يقتبس البندين، ولا وجه بحث (الوجه يشتق «مستبدل» للعضو المخفي).
 * إضافة فقط (INSERT): legal_systems، legal_articles بنصها كما في لقطة الهيئة 2026-09-28، verification، search_surface،
 * search_surface_member، law_card. لا UPDATE ولا DELETE. المعرّفات حتمية.
 *
 * التشغيل: npx tsx ingest/boe-corpus-2026-09-28/scripts/build_hkm028_new_editions.ts
 * المخرجات: ingest/boe-corpus-2026-09-28/data/hkm028-new-editions-2026-10-18/{statements.json,check.sql,manifest.json}
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchNorm } from "../../../lib/modules/legal-core/search-norm";
import { lawSlug } from "../../../lib/modules/legal-core/eli";

const ROOT = join(__dirname, "..", "data");
const OUT = join(ROOT, "hkm028-new-editions-2026-10-18");
const BY = "owner-inject-hkm028-new-editions-2026-10-18";
const now = "2026-10-18T00:00:00Z";

type Old = { status: "مستبدل" | "ساري"; quote: (law: Law, blocks: Block[], units: Unit[]) => string; surfaceFrom: string | null };
type Edition = {
  key: string;
  lawId: string; // معرّف القانون في اللقطة = معرّف النظام الجديد
  oldId: string;
  oldVerification: string | null; // آخر سجل work للقديم (يُلغى بـ supersedes)
  oldInstrument: string;
  instrument: string;
  name: string;
  effective: string; // تاريخ النفاذ (ميلادي)
  effectiveQuote: (units: Unit[]) => string;
  old: Old;
};
type Law = { id: string; guid: string; url: string; name: string; issued_hijri: string; issued_gregorian: string; published_hijri: string; published_gregorian: string; status_at_source: string; article_count: number };
type Unit = { law_id: string; seq: number; heading: string; article_number: number; is_bis: boolean; body: string; body_sha256: string };
type Block = { law_id: string; seq: number; kind: string; heading: string | null; body: string };

const line = (blocks: Block[], kind: string, start: string) => {
  const l = blocks.find((b) => b.kind === kind)?.body.split("\n").find((x) => x.trim().startsWith(start));
  if (!l) throw new Error(`البند «${start}» غير موجود في ${kind}`);
  return l.trim();
};
// البند ومعه الأسطر التالية له كما وردت (مثل فئتي البند ثانياً).
const lines = (blocks: Block[], kind: string, start: string, after: number) => {
  const all = (blocks.find((b) => b.kind === kind)?.body.split("\n") ?? []).map((x) => x.trim()).filter(Boolean);
  const i = all.findIndex((x) => x.startsWith(start));
  if (i < 0) throw new Error(`البند «${start}» غير موجود في ${kind}`);
  return all.slice(i, i + 1 + after).join(" ");
};
const article = (units: Unit[], n: number, must: string) => {
  const b = units.find((u) => u.article_number === n)?.body.trim();
  if (!b || !b.includes(must)) throw new Error(`المادة ${n} لا تحوي «${must}»`);
  return b;
};
const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

const EDITIONS: Edition[] = [
  {
    key: "gaca",
    lawId: "boe26-46303ce06a82154ff9f839bf",
    oldId: "cmpz5rt6500d5cwg25ey9d89j",
    oldVerification: "boe26-66cbc46ebb9699117ad1a636",
    oldInstrument: "قرار مجلس الوزراء رقم (33) وتاريخ 1426/2/11هـ",
    instrument: "قرار مجلس الوزراء رقم (807) وتاريخ 1446/11/14هـ",
    name: "تنظيم الهيئة العامة للطيران المدني الصادر بقرار مجلس الوزراء رقم (807) وتاريخ 1446/11/14هـ",
    effective: "2025-05-23", // النشر 1446/11/25هـ؛ المادة 15: «ويعمل به من تاريخ نشره»
    effectiveQuote: (u) => `المادة الخامسة عشرة: «${article(u, 15, "ويعمل به من تاريخ نشره")}»`,
    old: { status: "مستبدل", quote: (_l, b) => `قرار مجلس الوزراء رقم (807) وتاريخ 1446/11/14هـ، البند ${line(b, "cabinet_decision", "ثانياً: يحل التنظيم")}`, surfaceFrom: "2005-03-21" },
  },
  {
    key: "metrology",
    lawId: "boe26-6d0e7bc2e6cae54816b24981",
    oldId: "cmpz5pfqt002lcwg2y1viv8vw",
    oldVerification: null,
    oldInstrument: "المرسوم الملكي رقم (م/51) وتاريخ 1434/11/13هـ",
    instrument: "المرسوم الملكي رقم (م/79) وتاريخ 1446/3/6هـ",
    name: "نظام القياس والمعايرة الصادر بالمرسوم الملكي رقم (م/79) وتاريخ 1446/3/6هـ",
    effective: addDays("2024-09-20", 90), // النشر 1446/03/17هـ (2024-09-20)؛ المادة 18: بعد تسعين يومًا من النشر
    effectiveQuote: (u) => `المادة الثامنة عشرة: «${article(u, 18, "(تسعين) يوماً من تاريخ نشره")}»`,
    old: { status: "مستبدل", quote: (_l, _b, u) => `المرسوم الملكي رقم (م/79) وتاريخ 1446/3/6هـ، المادة السابعة عشرة: «${article(u, 17, "يحل النظام محل نظام القياس والمعايرة")}»`, surfaceFrom: "2013-09-19" },
  },
  {
    key: "social-insurance",
    lawId: "boe26-fc756d56e044a8c0d2272c52",
    oldId: "cmpz5r6zj00bbcwg225jusnib",
    oldVerification: "boe26-a9765c6093d849865154a002",
    oldInstrument: "المرسوم الملكي رقم (م/33) وتاريخ 1421/9/3هـ",
    instrument: "المرسوم الملكي رقم (م/273) وتاريخ 1445/12/26هـ",
    name: "نظام التأمينات الاجتماعية الصادر بالمرسوم الملكي رقم (م/273) وتاريخ 1445/12/26هـ",
    effective: "2024-07-03", // الصدور 1445/12/26هـ (2024-07-02)؛ المادة 63: «من اليوم التالي لتاريخ صدوره»
    effectiveQuote: (u) => `المادة الثالثة والستون: «${article(u, 63, "من اليوم التالي لتاريخ صدوره")}»`,
    old: {
      status: "ساري",
      quote: (l, b) =>
        `حالة النظام في بوابة هيئة الخبراء: ساري (رُصدت 28/9/2026). صدر نظام التأمينات الاجتماعية بالمرسوم الملكي رقم (م/273) وتاريخ 1445/12/26هـ دون نص بإلغاء هذا النظام، ونص المرسوم: «${lines(b, "royal_decree", "ثانياً:", 3)}» و«${line(b, "royal_decree", "رابعاً:")}»`,
      surfaceFrom: null,
    },
  },
];

const jsonl = <T>(f: string): T[] => readFileSync(join(ROOT, "parsed", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
const id = (prefix: string, ...parts: string[]) => `${prefix}-${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}`;
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
function lit(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  if (v.includes("$hk$")) throw new Error("قيمة تحوي وسم الاقتباس");
  return `$hk$${v}$hk$`;
}

const laws = jsonl<Law>("law.jsonl");
const allUnits = jsonl<Unit>("unit.jsonl");
const allBlocks = jsonl<Block>("text_block.jsonl");

// صنف القديم في القاعدة (قراءة 18/10/2026)؛ الحارس يتحقق أن الجديد أخذه نفسه.
const CLASSIFICATIONS: Record<string, string> = { gaca: "أنظمة المواصلات والاتصالات", metrology: "أنظمة التجارة والاقتصاد والاستثمار", "social-insurance": "أنظمة العمل والرعاية الاجتماعية" };
const statements: string[] = [];
// الصنف والمجال من السجل القديم في القاعدة نفسها، والحارس يتحقق أن القديم لم يتغير (الاسم وعدد المواد).
const oldNames: Record<string, string> = { gaca: "تنظيم الهيئة العامة للطيران المدني", metrology: "نظام القياس والمعايرة", "social-insurance": "نظام التأمينات الاجتماعية" };
const oldCounts: Record<string, number> = { gaca: 14, metrology: 18, "social-insurance": 71 };
const manifest: unknown[] = [];
const guards: string[] = [];
let verificationCount = 0;

const perLaw: Record<string, string[]> = {};
for (const e of EDITIONS) {
  const start = statements.length;
  const v0 = verificationCount;
  const law = laws.find((l) => l.id === e.lawId);
  if (!law) throw new Error(`${e.key}: القانون غير موجود في اللقطة`);
  const units = allUnits.filter((u) => u.law_id === e.lawId).sort((a, b) => a.seq - b.seq);
  const blocks = allBlocks.filter((b) => b.law_id === e.lawId).sort((a, b) => a.seq - b.seq);
  if (units.length !== law.article_count) throw new Error(`${e.key}: عدد المواد ${units.length} لا يطابق ${law.article_count}`);
  units.forEach((u, i) => {
    if (u.article_number !== i + 1 || u.is_bis) throw new Error(`${e.key}: ترقيم غير متصل عند ${u.seq}`);
    if (sha(u.body) !== u.body_sha256) throw new Error(`${e.key}: بصمة المادة ${u.seq} لا تطابق اللقطة`);
  });
  if (law.status_at_source !== "ساري") throw new Error(`${e.key}: حالة الهيئة ${law.status_at_source}`);
  const sourceUrl = law.url;
  const effectiveQuote = e.effectiveQuote(units);
  const oldQuote = e.old.quote(law, blocks, units);
  const n = units.length;
  const workKey = `we:${e.oldId}`;

  const preamble = `أداة الإصدار:\n${e.instrument}\nتاريخ الإصدار (هجريّ): ${law.issued_hijri.replace(/\//g, "-")}\nتاريخ الإصدار (ميلاديّ): ${law.issued_gregorian}\nتاريخ النشر: ${law.published_hijri}هـ (${law.published_gregorian})`;
  const slug = lawSlug(e.name);
  statements.push(`INSERT INTO legal_systems (id, name, classification, "articleCount", "createdAt", "updatedAt", domain, domain_title, eli_slug, preamble, preamble_royal_decree, preamble_effective_from)
SELECT ${lit(e.lawId)}, ${lit(e.name)}, o.classification, ${n}, ${lit(now)}::timestamp, ${lit(now)}::timestamp, o.domain, o.domain_title, ${lit(slug)}, ${lit(preamble)}, ${lit(e.instrument)}, ${lit(e.effective)}::timestamp
FROM legal_systems o WHERE o.id = ${lit(e.oldId)} AND o.name = ${lit(oldNames[e.key])};`);

  const ids = units.map((u) => id("boe26", e.lawId, "article", String(u.article_number)));
  // search_norm بالصنف الفعلي للقديم: يُحسب في البناء من الصنف المقروء من القاعدة (manifest)، والحارس يقارن بصمته.
  const classification = CLASSIFICATIONS[e.key];
  // أداة Neon تحفظ النص بصيغة NFC (مكافئ قانونيًّا: ترتيب الشدة والتنوين فقط)، فالحارس يقارن ببصمة NFC.
  const bodies = units.map((u) => u.body.normalize("NFC"));
  const norms = units.map((u, i) => buildSearchNorm({ lawName: e.name, title: u.heading, content: bodies[i], keywords: [], classification, chapter: null }).normalize("NFC"));
  statements.push(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT v.id, ${lit(e.lawId)}, ${lit(e.name)}, ${lit(classification)}, v.n, 0, v.title, v.content, ${lit(e.instrument)}, NULL, 'سارية', ${lit(now)}::timestamp, ${lit(now)}::timestamp, v.sn
FROM (VALUES
${units.map((u, i) => `(${lit(ids[i])}, ${u.article_number}, ${lit(u.heading)}, ${lit(bodies[i])}, ${lit(norms[i])})`).join(",\n")}
) AS v(id, n, title, content, sn);`);

  const verif = (objType: string, objId: string, status: string, quote: string, instrument: string, supersedes: string | null) => {
    verificationCount++;
    return `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
VALUES (${lit(id("vf26", "hkm028", objType, objId, status))}, ${lit(objType)}, ${lit(objId)}, ${lit(status)}, ${lit(instrument)}, ${lit(sourceUrl)}, ${lit(quote)}, 'manual', ${lit(BY)}, ${lit(supersedes)});`;
  };
  statements.push(verif("work", e.lawId, "ساري", `حالة النظام في بوابة هيئة الخبراء بمجلس الوزراء: ${law.status_at_source} (رُصدت 28/9/2026). الصدور ${law.issued_hijri}هـ والنشر ${law.published_hijri}هـ؛ ${effectiveQuote}`, e.instrument, null));
  verificationCount += n;
  statements.push(`INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id)
SELECT v.vid, 'unit', v.aid, 'ساري', ${lit(e.instrument)}, ${lit(sourceUrl)}, ${lit(`نص المادة كما في بوابة هيئة الخبراء (لقطة 28/9/2026)؛ يعمل بالنظام من ${e.effective}`)}, 'manual', ${lit(BY)}, NULL
FROM (VALUES ${ids.map((aid) => `(${lit(id("vf26", "hkm028", "unit", aid, "ساري"))}, ${lit(aid)})`).join(", ")}) AS v(vid, aid);`);
  statements.push(verif("work", e.oldId, e.old.status, oldQuote, e.oldInstrument, e.oldVerification));

  let surfaces = 0;
  if (e.old.surfaceFrom) {
    surfaces = 2;
    const oldSurface = id("ss26", workKey, "old");
    statements.push(`INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by) VALUES
(${lit(oldSurface)}, ${lit(workKey)}, ${lit(e.oldId)}, ${lit(e.old.surfaceFrom)}, ${lit(`work_edition:old ${e.oldInstrument} valid_from=${e.old.surfaceFrom} valid_to=${e.effective}`)}, NULL, ${lit(BY)}),
(${lit(id("ss26", workKey, "new"))}, ${lit(workKey)}, ${lit(e.lawId)}, ${lit(e.effective)}, ${lit(`work_edition:new ${e.instrument} valid_from=${e.effective}`)}, ${lit(oldSurface)}, ${lit(BY)});`);
    statements.push(`INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
(${lit(id("sm26", workKey, e.oldId))}, ${lit(workKey)}, ${lit(e.oldId)}, 'edition_old', ${lit(BY)}),
(${lit(id("sm26", workKey, e.lawId))}, ${lit(workKey)}, ${lit(e.lawId)}, 'edition_new', ${lit(BY)});`);
  }
  // بطاقة الهيئة المعلّقة على السجل القديم تصف الإصدار الجديد (رابطه وتاريخه): تُنسخ للنظام الجديد، والقديمة تبقى.
  statements.push(`INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
SELECT ${lit(id("lc26", e.lawId))}, ${lit(e.lawId)}, official_name, summary, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks, source_name, source_url, retrieved_on, ${lit(BY)}
FROM law_card WHERE system_id = ${lit(e.oldId)} AND source_url = ${lit(sourceUrl)} AND issued_hijri = ${lit(law.issued_hijri)};`);

  const g = `hkm028-${e.key}`;
  guards.push(`  IF (SELECT count(*) FROM legal_systems WHERE id = ${lit(e.lawId)} AND classification IS NOT DISTINCT FROM ${lit(classification)}) <> 1 THEN RAISE EXCEPTION '${g}: legal_systems'; END IF;
  IF (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${lit(e.oldId)}) <> ${oldCounts[e.key]} THEN RAISE EXCEPTION '${g}: old articles'; END IF;
  IF (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = ${lit(e.lawId)} AND "articleBis" = 0) <> ${n} THEN RAISE EXCEPTION '${g}: legal_articles'; END IF;
  IF (SELECT count(*) FROM verification WHERE verified_by = ${lit(BY)} AND (object_id = ${lit(e.lawId)} OR object_id = ${lit(e.oldId)} OR object_id IN (SELECT id FROM legal_articles WHERE "legalSystemId" = ${lit(e.lawId)}))) <> ${n + 2} THEN RAISE EXCEPTION '${g}: verification'; END IF;
  IF (SELECT count(*) FROM search_surface WHERE work_key = ${lit(workKey)}) <> ${surfaces} THEN RAISE EXCEPTION '${g}: search_surface'; END IF;
  IF (SELECT count(*) FROM search_surface_member WHERE work_key = ${lit(workKey)}) <> ${surfaces} THEN RAISE EXCEPTION '${g}: members'; END IF;
  IF (SELECT count(*) FROM law_card WHERE system_id = ${lit(e.lawId)}) <> 1 THEN RAISE EXCEPTION '${g}: law_card'; END IF;
  IF (SELECT md5(string_agg(search_norm, '|' ORDER BY "articleNumber")) FROM legal_articles WHERE "legalSystemId" = ${lit(e.lawId)}) IS DISTINCT FROM '${md5(norms.join("|"))}' THEN RAISE EXCEPTION '${g}: search_norm'; END IF;
  IF (SELECT string_agg(encode(sha256(convert_to(content, 'UTF8')), 'hex'), ',' ORDER BY "articleNumber") FROM legal_articles WHERE "legalSystemId" = ${lit(e.lawId)}) IS DISTINCT FROM '${bodies.map((b) => sha(b)).join(",")}' THEN RAISE EXCEPTION '${g}: نص المواد'; END IF;`);
  perLaw[e.key] = [...statements.slice(start), `DO $g$ BEGIN\n${guards[guards.length - 1]}\n  IF (SELECT count(*) FROM verification WHERE verified_by = ${lit(BY)} AND (object_id = ${lit(e.lawId)} OR object_id = ${lit(e.oldId)} OR object_id LIKE 'boe26-%' AND object_id IN (SELECT id FROM legal_articles WHERE "legalSystemId" = ${lit(e.lawId)}))) <> ${verificationCount - v0} THEN RAISE EXCEPTION '${g}: verification total'; END IF;\nEND $g$;`];
  manifest.push({ key: e.key, law_id: e.lawId, guid: law.guid, old_id: e.oldId, name: e.name, slug, effective: e.effective, instrument: e.instrument, old_status: e.old.status, old_quote: oldQuote, surface: surfaces > 0, articles: n, content_md5: md5(units.map((u) => u.body).join("|")), content_md5_nfc: md5(units.map((u) => u.body.normalize("NFC")).join("|")), nfc_changed: units.filter((u) => u.body !== u.body.normalize("NFC")).map((u) => u.article_number) });
}

const guard = `DO $g$ BEGIN
${guards.join("\n")}
  IF (SELECT count(*) FROM verification WHERE verified_by = ${lit(BY)}) <> ${verificationCount} THEN RAISE EXCEPTION 'hkm028: verification total'; END IF;
END $g$;`;

mkdirSync(OUT, { recursive: true });
// معاملة لكل نظام (كل واحدة مستقلة بحارسها)، وملف جامع للمراجعة.
for (const [k, st] of Object.entries(perLaw)) writeFileSync(join(OUT, `statements-${k}.json`), JSON.stringify(st, null, 1) + "\n");
writeFileSync(join(OUT, "statements.json"), JSON.stringify([...statements, guard], null, 1) + "\n");
writeFileSync(
  join(OUT, "check.sql"),
  `-- قراءة فقط بعد التطبيق.
SELECT s.id, s.name, (SELECT count(*) FROM legal_articles a WHERE a."legalSystemId" = s.id) AS articles,
       (SELECT md5(string_agg(content, '|' ORDER BY "articleNumber")) FROM legal_articles a WHERE a."legalSystemId" = s.id) AS content_md5,
       (SELECT verified_status FROM verification v WHERE v.object_type = 'work' AND v.object_id = s.id ORDER BY verified_at DESC, id DESC LIMIT 1) AS status
FROM legal_systems s WHERE s.id IN (${EDITIONS.flatMap((e) => [lit(e.lawId), lit(e.oldId)]).join(", ")}) ORDER BY s.name, s.id;\n`,
);
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ by: BY, verification: verificationCount, editions: manifest }, null, 2) + "\n");
console.log(JSON.stringify({ statements: statements.length + 1, verification: verificationCount, editions: manifest.map((m) => (m as { key: string; articles: number }).articles) }));
