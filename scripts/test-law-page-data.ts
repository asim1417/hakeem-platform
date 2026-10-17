/**
 * HKM-023-B: اختبارات على قاعدة Postgres 17 محلية ببيانات اصطناعية (لا إنتاج ولا فرع منه).
 *   B-1   الترحيل: إضافي، يعاد تطبيقه، يفرض إعادة التركيب والاعتماد المزدوج والإضافة فقط، ولا يمس legal_systems.preamble.
 *   U-*   دوال القراءة getLawPageData (البطاقة والمقدمة بحالاتها والمتن وحالات المواد والإلغاء في الاتجاهين).
 *   M-13  أداة MCP hakeem_get_law: مطابقة الاسم بالحالتين في الأمر، والعقد الإضافي.
 *   S-14  البحث النصي في وحدات المقدمة ووسمها وعدم اختلاطها بالمواد.
 * الحارس: قاعدة محلية اسمها ينتهي بـ _test فقط (يحذف مخططها public ويعيد إنشاءه).
 * نصوص المواد والأنظمة الاصطناعية موسومة «اصطناعي». نصوص المقدمات الحقيقية من data/preamble-fixtures (عامة).
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { composeLawCardText } from "../lib/modules/legal-core/preamble-parser";
import { buildPreambleEditionRows, insertPreambleEdition, PreambleRejected, sha256 } from "../lib/modules/legal-core/preamble-edition";
import { getLawPageData, NOT_AVAILABLE, PREAMBLE_INCOMPLETE_LABEL, PREAMBLE_NONE_LABEL, toBoeStatus, BOE_LAW_STATUSES } from "../lib/modules/legal-core/law-page-data";
import { rankLawNameMatches, normalizeLawName } from "../lib/modules/legal-core/law-name-match";
import { getLawTool, MCP_PREAMBLE_MAX_CHARS } from "../lib/mcp/tools/get-law";
import { mergeArticleAndPreambleHits, searchPreambleUnits } from "../lib/modules/legal-core/preamble-search";
import { connectLocalTest } from "./hkm-023-b/local-db";
import type { SqlClient } from "../lib/modules/legal-core/sql-port";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

async function rejects(fn: () => Promise<unknown>, re: RegExp, m: string) {
  try {
    await fn();
    ok(false, `${m} (لم يُرفض)`);
  } catch (e) {
    ok(re.test(String((e as Error).message)), `${m} — ${String((e as Error).message).slice(0, 80)}`);
  }
}

const MIGRATION = "prisma/migrations/20261017130000_hkm023b_preamble_units/migration.sql";
const prod = JSON.parse(fs.readFileSync("data/preamble-fixtures/hkm-023-b/production.json", "utf8"));
const ITHBAT_TEXT = composeLawCardText(prod.law_card_samples[0].blocks);
const ITHBAT_BLOCKS = prod.law_card_samples[0].blocks;
const MURAFAAT_LEGACY = "أداة الإصدار:\nمرسوم ملكي رقم ( م/1 ) بتاريخ 22 / 1 / 1435\nتاريخ الإصدار (هجريّ): 1435-01-22\nتاريخ الإصدار (ميلاديّ): 2013-11-25";
const ITHBAT_LEGACY = "أداة الإصدار:\nمرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ قرار مجلس الوزراء رقم (283) وتاريخ 1443/5/24هـ\nتاريخ الإصدار (هجريّ): 1443-05-26\nتاريخ الإصدار (ميلاديّ): 2021-12-30";

async function reset(db: SqlClient) {
  await db.query(`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.query(`CREATE SCHEMA public`);
  await db.query(fs.readFileSync("scripts/hkm-023-b/fixtures/base-schema.sql", "utf8"));
}

async function seed(db: SqlClient) {
  const sys = async (id: string, name: string, articleCount: number, extra: Record<string, string | null> = {}) =>
    db.query(
      `INSERT INTO legal_systems (id, name, "articleCount", domain, domain_title, classification, preamble, preamble_royal_decree, eli_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, articleCount, extra.domain ?? null, extra.domain_title ?? null, extra.classification ?? null, extra.preamble ?? null, extra.preamble_royal_decree ?? null, extra.eli_slug ?? null],
    );
  await sys("sys-ithbat", "نظام الإثبات", 129, { domain: "evidence", domain_title: "الإثبات", classification: "إثبات", preamble: ITHBAT_LEGACY, preamble_royal_decree: "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ قرار مجلس الوزراء رقم (283) وتاريخ 1443/5/24هـ" });
  await sys("sys-adilla", "الأدلة الإجرائية لنظام الإثبات", 135, { domain: "evidence" });
  await sys("sys-murafaat", "نظام المرافعات الشرعية", 242, { domain: "procedure", classification: "إجرائي", preamble: MURAFAAT_LEGACY, preamble_royal_decree: "مرسوم ملكي رقم ( م/1 ) بتاريخ 22 / 1 / 1435" });
  await sys("sys-lawaih", "اللوائح التنفيذية لنظام المرافعات الشرعية", 639, { domain: "procedure" });
  await sys("sys-civil", "نظام المعاملات المدنية", 721, { domain: "civil", preamble_royal_decree: "مرسوم ملكي رقم (م/191) وتاريخ 1444/11/29هـ" });
  await sys("sys-none", "نظام اصطناعي بلا مقدمة", 1, {});
  await sys("sys-blocks", "نظام اصطناعي بكتل المصدر", 1, {});
  await sys("sys-ss-old", "نظام الضمان الاجتماعي اصطناعي 1427هـ", 2, { domain: "labor" });
  await sys("sys-ss-new", "نظام الضمان الاجتماعي اصطناعي", 1, { domain: "labor" });

  const art = (id: string, systemId: string, lawName: string, n: number, title: string, chapter: string | null) =>
    db.query(`INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", title, content, chapter) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
      id, systemId, lawName, n, title, `نص اصطناعي للمادة ${n} من ${lawName}.`, chapter,
    ]);
  await art("a-ith-1", "sys-ithbat", "نظام الإثبات", 1, "المادة الأولى", "الباب الأول: أحكام عامة");
  await art("a-ith-128", "sys-ithbat", "نظام الإثبات", 128, "المادة الثامنة والعشرون بعد المائة", "الباب الحادي عشر: أحكام ختامية");
  await art("a-mur-100", "sys-murafaat", "نظام المرافعات الشرعية", 100, "المادة المائة", "الباب الثامن: اصطناعي");
  await art("a-mur-101", "sys-murafaat", "نظام المرافعات الشرعية", 101, "المادة الأولى بعد المائة", "الباب التاسع: إجراءات الإثبات");
  await art("a-mur-102", "sys-murafaat", "نظام المرافعات الشرعية", 102, "المادة الثانية بعد المائة", "الباب التاسع: إجراءات الإثبات");
  await art("a-mur-103", "sys-murafaat", "نظام المرافعات الشرعية", 103, "المادة الثالثة بعد المائة", "الباب العاشر: اصطناعي");
  await art("a-mur-212", "sys-murafaat", "نظام المرافعات الشرعية", 212, "المادة الثانية عشرة بعد المائتين", "الباب العاشر: اصطناعي");
  await art("a-mur-220", "sys-murafaat", "نظام المرافعات الشرعية", 220, "المادة العشرون بعد المائتين", "الباب العاشر: اصطناعي");
  await art("a-civ-1", "sys-civil", "نظام المعاملات المدنية", 1, "المادة الأولى", null);
  await art("a-none-1", "sys-none", "نظام اصطناعي بلا مقدمة", 1, "1", null);
  await art("a-ss-old-1", "sys-ss-old", "نظام الضمان الاجتماعي اصطناعي 1427هـ", 1, "المادة الأولى", null);
  await art("a-ss-old-2", "sys-ss-old", "نظام الضمان الاجتماعي اصطناعي 1427هـ", 2, "المادة الثانية", null);
  await art("a-ss-new-1", "sys-ss-new", "نظام الضمان الاجتماعي اصطناعي", 1, "المادة الأولى", null);

  let v = 0;
  const ver = (type: "work" | "unit", objectId: string, status: string, instrument: string | null, quote: string | null = null) =>
    db.query(`INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', 'test-hkm023b')`, [
      `ver-${++v}`, type, objectId, status, instrument, instrument ? "https://laws.boe.gov.sa/اصطناعي" : null, quote,
    ]);
  await ver("work", "sys-ithbat", "ساري", "مرسوم ملكي رقم م/43 وتاريخ 1443/5/26هـ");
  await ver("unit", "a-ith-1", "ساري", "مرسوم ملكي رقم م/43 وتاريخ 1443/5/26هـ");
  await ver("unit", "a-mur-100", "ساري", null);
  await ver("unit", "a-mur-101", "ملغاة", "مرسوم ملكي رقم م/43 وتاريخ 1443/5/26هـ", "أُلغيت هذه المادة (اصطناعي)");
  await ver("unit", "a-mur-102", "ملغاة", "مرسوم ملكي رقم م/43 وتاريخ 1443/5/26هـ", "أُلغيت هذه المادة (اصطناعي)");
  await ver("unit", "a-mur-212", "ملغاة", "مرسوم ملكي رقم م/191 وتاريخ 1444/11/29هـ", "أُلغيت هذه المادة (اصطناعي)");
  await ver("unit", "a-mur-220", "ملغاة", "م/99 وتاريخ 1445/1/1هـ — من 2024-06-13", "أُلغيت (اصطناعي)");
  await ver("work", "sys-ss-old", "مستبدل", "م/32 وتاريخ 1442/4/4هـ");
  await ver("work", "sys-ss-new", "ساري", "م/32 وتاريخ 1442/4/4هـ");

  await db.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url) VALUES ('uv-1', 'a-mur-103', 'نص معدّل اصطناعي للمادة 103.', '2020-01-01', 'مرسوم ملكي رقم م/0 وتاريخ 1441/1/1هـ (اصطناعي)', 'https://laws.boe.gov.sa/اصطناعي')`);
  await db.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument) VALUES ('uv-2', 'a-mur-100', 'نص مستقبلي اصطناعي للمادة 100.', '2099-01-01', 'اصطناعي')`);

  await db.query(
    `INSERT INTO law_card (id, system_id, official_name, issued_hijri, issued_gregorian, published_hijri, published_gregorian, status_at_source, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
     VALUES ('lc-ithbat', 'sys-ithbat', 'نظام الإثبات', '1443/05/26', '2021-12-30', '1443/06/04', '2022-01-07', 'ساري', $1::jsonb, $2::jsonb, 'هيئة الخبراء بمجلس الوزراء', $3, '2026-09-28', 'test-hkm023b')`,
    [
      JSON.stringify([{ kind: "royal_decree", text: "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ" }, { kind: "cabinet_decision", text: "قرار مجلس الوزراء رقم (283) وتاريخ 1443/5/24هـ" }]),
      JSON.stringify(ITHBAT_BLOCKS),
      prod.law_card_samples[0].source.source_url,
    ],
  );
  await db.query(
    `INSERT INTO law_card (id, system_id, official_name, instruments, text_blocks, source_name, source_url, retrieved_on, created_by)
     VALUES ('lc-blocks', 'sys-blocks', 'نظام اصطناعي بكتل المصدر', '[]'::jsonb, $1::jsonb, 'هيئة الخبراء بمجلس الوزراء', 'https://laws.boe.gov.sa/اصطناعي', '2026-09-28', 'test-hkm023b')`,
    [JSON.stringify([{ kind: "royal_decree", heading: "مرسوم ملكي رقم (م/0) وتاريخ 1400/1/1هـ", text: "بعون الله تعالى\nنحن فلان (اصطناعي)\nبناءً على كذا (اصطناعي).\nرسمنا بما هو آت:\nأولاً: كذا (اصطناعي).\nفلان بن فلان آل سعود" }, { kind: "law_title", text: "(الباب الأول) اصطناعي" }])],
  );
  // وجه البحث: الإثبات وجه عمله من تاريخ نفاذه؛ والضمان: القديم ثم الجديد.
  await db.query(`INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, created_by) VALUES
    ('ss-1', 'we:ithbat', 'sys-ithbat', '2022-07-08', 'اصطناعي', 'test'),
    ('ss-2', 'we:ss', 'sys-ss-old', '2006-01-01', 'اصطناعي', 'test'),
    ('ss-3', 'we:ss', 'sys-ss-new', '2021-06-01', 'اصطناعي', 'test')`);
  await db.query(`INSERT INTO search_surface_member (id, work_key, system_id, role, created_by) VALUES
    ('m-1', 'we:ss', 'sys-ss-old', 'edition_old', 'test'),
    ('m-2', 'we:ss', 'sys-ss-new', 'edition_new', 'test')`);
}

async function migrationTests(db: SqlClient) {
  const mig = fs.readFileSync(MIGRATION, "utf8");
  ok(!/\b(ALTER|UPDATE|DELETE|TRUNCATE)\s+(TABLE\s+)?"?(legal_systems|legal_articles|verification|unit_version|law_card)\b/i.test(mig), "B-1 الترحيل لا يغيّر جدولًا قائمًا (لا ALTER/UPDATE/DELETE على الجداول القائمة)");
  await db.query(mig);
  await db.query(mig);
  ok(true, "B-1 الترحيل يُطبَّق ويعاد تطبيقه بلا خطأ (IF NOT EXISTS)");

  const before = await db.query<{ m: string }>(`SELECT md5(string_agg(coalesce(preamble, ''), '|' ORDER BY id)) AS m FROM legal_systems`);
  const meta = {
    systemId: "sys-ithbat",
    sourceName: "هيئة الخبراء بمجلس الوزراء" as const,
    sourceUrl: prod.law_card_samples[0].source.source_url as string,
    sourceRetrievedOn: "2026-09-28",
    sourceRecord: "lc-ithbat",
    legacyPreamble: ITHBAT_LEGACY,
    changeRef: "chg-test-1",
    preparedBy: "editor-test",
    approvedBy: "reviewer-test",
  };
  const rows = buildPreambleEditionRows(ITHBAT_TEXT, meta);
  ok(rows.edition.raw_sha256 === sha256(ITHBAT_TEXT) && rows.edition.completeness === "complete" && rows.edition.legacy_preamble_sha256 === sha256(ITHBAT_LEGACY), "B-1 صفوف النسخة: البصمة والتصنيف وربط المادة صفر ببصمتها");
  await db.query("BEGIN");
  await insertPreambleEdition(db, rows);
  await db.query("COMMIT");
  const n = await db.query<{ c: string }>(`SELECT count(*) AS c FROM preamble_unit WHERE edition_id = $1`, [rows.edition.id]);
  ok(Number(n[0].c) === rows.units.length, `B-1 نسخة نظام الإثبات حُفظت بوحداتها (${rows.units.length})`);
  const rebuilt = await db.query<{ t: string }>(`SELECT string_agg(text_raw, '' ORDER BY ordinal) AS t FROM preamble_unit WHERE edition_id = $1 AND unit_type <> 'issuing_instrument'`, [rows.edition.id]);
  ok(rebuilt[0].t === ITHBAT_TEXT, "B-1 إعادة التركيب من القاعدة = النص الحرفي");

  // نسخة مختلة: وحدة ناقصة محرفًا → يُرفض عند الالتزام وتُرد المعاملة كاملة.
  const bad = buildPreambleEditionRows(ITHBAT_TEXT + "\n(اصطناعي)", { ...meta, changeRef: "chg-test-2" });
  const victim = bad.units.find((u) => u.unit_type === "recital")!;
  victim.text_raw = victim.text_raw.slice(1);
  victim.char_end = victim.char_start + victim.text_raw.length;
  await db.query("BEGIN");
  await insertPreambleEdition(db, bad).catch(() => undefined);
  await rejects(() => db.query("COMMIT"), /إعادة التركيب|التبليط|check/, "B-1 القاعدة ترفض نسخة لا تعيد النص حرفيًا (قيد مؤجل)");
  await db.query("ROLLBACK").catch(() => undefined);
  const leaked = await db.query<{ c: string }>(`SELECT count(*) AS c FROM preamble_edition WHERE change_ref = 'chg-test-2'`);
  ok(Number(leaked[0].c) === 0, "B-1 لا يبقى شيء من النسخة المرفوضة");

  const fewer = buildPreambleEditionRows(ITHBAT_TEXT + "\n(اصطناعي ٢)", { ...meta, changeRef: "chg-test-3" });
  fewer.edition.units_count += 1;
  await db.query("BEGIN");
  await insertPreambleEdition(db, fewer);
  await rejects(() => db.query("COMMIT"), /units_count/, "B-1 عدد الوحدات يجب أن يطابق units_count");
  await db.query("ROLLBACK").catch(() => undefined);

  const self = buildPreambleEditionRows(ITHBAT_TEXT + "\n(اصطناعي ٣)", { ...meta, changeRef: "chg-test-4", approvedBy: "x", preparedBy: "y" });
  self.edition.approved_by = self.edition.prepared_by;
  await db.query("BEGIN");
  await rejects(() => insertPreambleEdition(db, self), /check constraint/, "B-1 المعتمِد غير المُعِدّ (قيد CHECK)");
  await db.query("ROLLBACK");
  let rejected = false;
  try {
    buildPreambleEditionRows(ITHBAT_TEXT, { ...meta, sourceUrl: "https://example.com/x" });
  } catch (e) {
    rejected = e instanceof PreambleRejected;
  }
  ok(rejected, "B-1 رابط مصدر من غير uqn.gov.sa/boe.gov.sa يُرفض قبل الكتابة");

  await rejects(() => db.query(`UPDATE preamble_unit SET text_raw = 'x' WHERE edition_id = $1`, [rows.edition.id]), /append-only/, "B-1 preamble_unit للإضافة فقط (UPDATE مرفوض)");
  await rejects(() => db.query(`DELETE FROM preamble_edition WHERE id = $1`, [rows.edition.id]), /append-only/, "B-1 preamble_edition للإضافة فقط (DELETE مرفوض)");
  await rejects(() => db.query(`TRUNCATE preamble_unit`), /append-only/, "B-1 TRUNCATE مرفوض");
  const after = await db.query<{ m: string }>(`SELECT md5(string_agg(coalesce(preamble, ''), '|' ORDER BY id)) AS m FROM legal_systems`);
  ok(before[0].m === after[0].m, "B-1 legal_systems.preamble («المادة صفر») لم يتغير حرف منها");
  return rows;
}

async function pageTests(db: SqlClient) {
  const ith = await getLawPageData(db, "sys-ithbat", { asOf: "2026-10-17" });
  ok(Boolean(ith), "U-1 بيانات نظام الإثبات");
  if (!ith) return;
  ok(ith.card.status.boe === "ساري" && ith.card.status.label === "ساري" && ith.card.status.atSource === "ساري", "U-2 الحالة من القائمة الست (ساري) ومن سجل التحقق، وحالة المصدر معادة كما هي");
  ok(ith.card.instruments.length === 2 && ith.card.instruments[0].number === "م/43" && ith.card.instruments[1].kind === "cabinet_decision" && ith.card.instruments[1].number === "283", "U-2 أدوات الإصدار سطران برقمهما وتاريخهما");
  ok(ith.card.dates.issued.hijri === "1443/05/26" && ith.card.dates.published.gregorian === "2022-01-07" && ith.card.dates.effective.gregorian === "2022-07-08" && ith.card.dates.effective.source === "search_surface", "U-2 التواريخ: الإصدار والنشر من البطاقة، والنفاذ من وجه البحث");
  ok(ith.card.dates.applied.hijri === null && ith.card.dates.applied.gregorian === null, `U-2 التاريخ غير المتوفر (التطبيق) null ويعرض «${NOT_AVAILABLE}»`);
  ok(ith.card.officialSource?.url.startsWith("https://laws.boe.gov.sa/") === true, "U-2 المصدر الرسمي برابطه");
  ok(ith.preamble.kind === "units" && ith.preamble.label === null && ith.preamble.completeness === "complete", "U-4 المقدمة وحدات مهيكلة حين توجد نسخة");
  ok(ith.preamble.units?.instruments.length === 2 && ith.preamble.units.instruments[0].units.some((u) => u.anchor === "preamble-i1-clause-5"), "U-4 أداتان، والبند خامسًا من المرسوم له مرساة");
  ok(ith.preamble.legacy?.text === ITHBAT_LEGACY && ith.preamble.legacy.completeness === "issuance_line", "U-4 النص القديم يُعاد كما هو (سطر إصدار) ولو اختيرت الوحدات");
  ok(ith.outgoingRepeals.length === 2 && ith.outgoingRepeals.every((r) => r.systemId === "sys-murafaat" && r.derived), "U-7a الربط العكسي: أداة الإثبات (م/43) ألغت مادتين من المرافعات (مشتق)");

  const mur = await getLawPageData(db, "sys-murafaat", { asOf: "2026-10-17" });
  ok(Boolean(mur), "U-1 بيانات نظام المرافعات");
  if (!mur) return;
  ok(mur.card.status.boe === null && mur.card.status.label === NOT_AVAILABLE, "U-2 بلا سجل تحقق للنظام: الحالة «غير متوفر» لا تُخترع");
  ok(mur.card.instruments.length === 1 && mur.card.instruments[0].number === "م/1" && mur.card.instruments[0].dateHijri === "1435/1/22" && mur.card.instruments[0].source === "legal_systems.preamble_royal_decree", "U-2 أداة الإصدار من الحقل القديم حين لا بطاقة");
  ok(mur.card.dates.issued.source === null && mur.card.dates.published.hijri === null, "U-2 تواريخ بلا مصدر = null");
  ok(mur.preamble.kind === "legacy_text" && mur.preamble.label === PREAMBLE_INCOMPLETE_LABEL && mur.preamble.legacy?.text === MURAFAAT_LEGACY, "U-4 preamble fallback to article zero: النص كما هو بوسم «مقدمة غير مكتملة»");
  const arts = mur.body.divisions.flatMap((d) => d.articles);
  ok(arts.map((a) => a.number).join() === "100,101,102,103,212,220", "U-5 المتن مرتب بأرقام المواد");
  ok(mur.body.divisions.map((d) => d.heading).join("|") === "الباب الثامن: اصطناعي|الباب التاسع: إجراءات الإثبات|الباب العاشر: اصطناعي", "U-5 الأقسام بعناوين الأبواب وبترتيبها");
  ok(mur.body.divisions[1].allRepealed && !mur.body.divisions[0].allRepealed, "U-7a الباب الذي أُلغيت كل مواده موسوم allRepealed");
  const a101 = arts.find((a) => a.number === 101)!;
  ok(a101.status === "ملغى" && a101.statusSource === "verification" && a101.repeal?.type === "express_partial" && a101.repeal.typeDerived, "U-7a المادة الملغاة: الحالة ومصدرها ونوع الإلغاء (مشتق)");
  ok(a101.repeal?.repealingSystem?.id === "sys-ithbat" && a101.repeal.repealingSystemBasis === "instrument_number" && a101.repeal.repealingArticle === null, "U-7a بيان الإلغاء يربط بالنظام الملغي (م/43 → نظام الإثبات)، والمادة الملغية غير متوفرة");
  ok(a101.text.includes("اصطناعي") && a101.effectiveText === a101.text, "U-7a نص الملغاة المحفوظ يُعاد كاملًا (لا حذف)");
  const a103 = arts.find((a) => a.number === 103)!;
  ok(a103.status === "معدّل" && a103.statusSource === "unit_version" && a103.effectiveText.startsWith("نص معدّل") && a103.text.startsWith("نص اصطناعي") && a103.amendment?.currentFrom === "2020-01-01", "U-6 المعدّلة: الساري من unit_version والأصل محفوظ، وتاريخ سريان النسخة");
  const a100 = arts.find((a) => a.number === 100)!;
  ok(a100.status === "ساري" && a100.amendment?.pendingFrom === "2099-01-01" && a100.effectiveText.startsWith("نص اصطناعي"), "U-6 تعديل صادر لم يسرِ: النص الحالي ساري وتنبيه بتاريخ السريان");
  const a212 = arts.find((a) => a.number === 212)!;
  ok(a212.repeal?.repealingSystem?.id === "sys-civil", "U-7a م/191 تُعكس إلى نظام المعاملات المدنية من حقل أداة الإصدار");
  const a220 = arts.find((a) => a.number === 220)!;
  ok(a220.status === "ملغى" && a220.repeal?.effectiveDate === "2024-06-13" && a220.repeal.effectiveDateSource === "evidence_text", "U-7 تاريخ نفاذ الإلغاء من نص الأداة");
  const murOld = await getLawPageData(db, "sys-murafaat", { asOf: "2024-01-01" });
  const a220Old = murOld?.body.divisions.flatMap((d) => d.articles).find((a) => a.number === 220);
  ok(a220Old?.status === "ساري" && a220Old.repealedLaterOn === "2024-06-13", "U-7d «كما في تاريخ» قبل نفاذ الإلغاء: ساري مع «أُلغي لاحقًا في …»");
  ok(mur.body.counts.total === 6 && mur.body.counts.repealed === 4 && mur.body.counts.amended === 1 && mur.body.counts.inForce === 1, "U-3 العدّادات تطابق المرشحات (6 = 1 ساري + 1 معدّل + 4 ملغاة)");

  const civ = await getLawPageData(db, "sys-civil");
  ok(civ?.outgoingRepeals.length === 1 && civ.outgoingRepeals[0].articleNumber === 212, "U-7a الاتجاه الآخر: م/191 ألغت المادة 212 من المرافعات");

  const none = await getLawPageData(db, "sys-none");
  ok(none?.preamble.kind === "none" && none.preamble.label === PREAMBLE_NONE_LABEL && none.preamble.legacy === null, "U-4 لا مقدمة: «المقدمة غير متوفرة»");
  ok(none?.card.instruments.length === 0 && none.card.status.label === NOT_AVAILABLE && none.card.officialSource === null, "U-2 نظام بلا بيانات: حقول البطاقة فارغة لا مخترعة");
  ok(none?.body.divisions[0].articles[0].heading === "المادة ١" && none.body.divisions[0].articles[0].status === null, "U-5 عنوان رقمي يُعرض «المادة N»، والحالة بلا سجل null");

  const blocks = await getLawPageData(db, "sys-blocks");
  ok(blocks?.preamble.kind === "source_blocks" && blocks.preamble.sourceBlocks?.blocks.length === 1 && blocks.preamble.completeness === "complete", "U-4 كتل law_card (لم تُفكَّك) تُعاد بوسمها وتصنيفها، بلا law_title");

  const old = await getLawPageData(db, "sys-ss-old", { asOf: "2026-10-17" });
  ok(old?.card.status.boe === "لاغي" && old.card.status.hakeem === "مستبدل", "U-7b النظام المستبدل: «لاغي» من القائمة الست");
  ok(old?.card.replacedBy?.id === "sys-ss-new" && old.card.repeal?.type === "replacement" && old.card.repeal.effectiveDate === "2021-06-01" && old.card.repeal.effectiveDateSource === "search_surface", "U-7b شريط الإلغاء: البديل ونوع الإحلال وتاريخه من وجه البحث");
  ok(old?.body.divisions[0].articles.every((a) => a.status === "ملغى" && a.inheritedFromWork) === true && old.body.divisions[0].allRepealed === false, "U-7b مواده موسومة ملغاة بالتبعية، دون وسم الباب");
  const neu = await getLawPageData(db, "sys-ss-new", { asOf: "2026-10-17" });
  ok(neu?.card.replaces.map((r) => r.id).join() === "sys-ss-old", "U-7b البديل يعرض «حلّ محل» برابط القديم");

  ok(toBoeStatus("صادر لم يسرِ بعد") === null && toBoeStatus("سجل مخلوط — لا يُعرض") === null && toBoeStatus("إلغاء جزئي معلّق على شرط") === "ساري", "U-2 ما لا يقابله شيء من القائمة الست = null");
  ok(BOE_LAW_STATUSES.length === 6, "U-2 القائمة الست كما في الأمر");
}

async function mcpTests(db: SqlClient) {
  // العلة القديمة: احتواء + الأكثر مواد.
  const cands = (await db.query<{ id: string; name: string; articleCount: number }>(`SELECT id, name, "articleCount" FROM legal_systems`)).map((r) => ({ ...r, articleCount: Number(r.articleCount) }));
  const oldPick = (q: string) => cands.filter((c) => c.name.includes(q)).sort((a, b) => b.articleCount - a.articleCount)[0]?.name;
  ok(oldPick("نظام الإثبات") === "الأدلة الإجرائية لنظام الإثبات" && oldPick("نظام المرافعات الشرعية") === "اللوائح التنفيذية لنظام المرافعات الشرعية", "M-13 إعادة إنتاج العلة: المطابقة القديمة تختار الوثيقة الخطأ في الحالتين");

  const r1 = await getLawTool(db, { name: "نظام الإثبات" }, { asOf: "2026-10-17", siteUrl: "https://hakeemai.net" });
  ok("law_id" in r1 && r1.law_id === "sys-ithbat" && r1.name === "نظام الإثبات" && r1.match.by === "exact", "M-13 name=«نظام الإثبات» يعيد نظام الإثبات لا الأدلة الإجرائية (مطابقة تامة)");
  ok("law_id" in r1 && r1.match.alternatives.some((a) => a.law_id === "sys-adilla"), "M-13 البدائل تذكر «الأدلة الإجرائية لنظام الإثبات»");
  const r2 = await getLawTool(db, { name: "نظام المرافعات الشرعية" });
  ok("law_id" in r2 && r2.law_id === "sys-murafaat", "M-13 name=«نظام المرافعات الشرعية» يعيد النظام لا لائحته");
  const r3 = await getLawTool(db, { name: "المرافعات الشرعية" });
  ok("law_id" in r3 && r3.law_id === "sys-murafaat" && r3.match.by === "contains", "M-13 الاحتواء: الأصل قبل اللائحة");
  const r4 = await getLawTool(db, { name: "اللوائح التنفيذية لنظام المرافعات" });
  ok("law_id" in r4 && r4.law_id === "sys-lawaih" && r4.match.by === "prefix", "M-13 «يبدأ بـ»: طلب اللائحة صراحة يعيدها");
  const r5 = await getLawTool(db, { name: "نظام الإثبات 1443هـ" });
  ok("law_id" in r5 && r5.law_id === "sys-ithbat" && r5.match.by === "exact", "M-13 السنة الملتصقة بالاسم لا تمنع المطابقة التامة");
  const r6 = await getLawTool(db, { name: "نظام لا وجود له اصطناعي" });
  ok("error" in r6 && r6.error === "النظام غير موجود", "M-13 اسم غير موجود: خطأ صريح");
  const r7 = await getLawTool(db, {});
  ok("error" in r7, "M-13 بلا معرّف ولا اسم: خطأ");
  const r8 = await getLawTool(db, { lawId: "sys-murafaat" });
  ok("law_id" in r8 && r8.match.by === "id", "M-13 law_id يُقدَّم على الاسم");

  if (!("law_id" in r1) || !("law_id" in r2)) return;
  for (const k of ["law_id", "name", "classification", "issue_instrument", "issue_date_h", "status", "articles_count", "toc"]) ok(k in r1, `M-13 العقد القديم باقٍ: ${k}`);
  ok(Object.keys(r1.toc[0]).slice(0, 3).join() === "article_id,number,title", "M-13 عناصر toc تبدأ بحقولها القديمة");
  ok(r1.issue_instrument === "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ" && r1.issue_date_h === "1443/05/26" && r1.status === "ساري", "M-13 الحقول التي كانت null صارت تُملأ (الأداة والتاريخ والحالة)");
  ok(r1.issue_instruments.length === 2 && r1.dates.issued.hijri === "1443/05/26" && r1.dates.applied.gregorian === null, "M-13 issue_instruments[] والتواريخ الأربعة");
  ok(r1.preamble.kind === "units" && r1.preamble.complete === true && "units" in r1.preamble && (r1.preamble.units?.length ?? 0) > 20, "M-13 preamble وحدات بوسم الاكتمال");
  ok(r2.preamble.kind === "legacy_text" && r2.preamble.complete === false && "text" in r2.preamble && r2.preamble.text === MURAFAAT_LEGACY && r2.preamble.label === PREAMBLE_INCOMPLETE_LABEL, "M-13 preamble نص قديم بوسم «مقدمة غير مكتملة»");
  const t101 = r2.toc.find((t) => t.number === 101)!;
  ok(t101.status === "ملغى" && t101.repealed_by?.includes("م/43") === true && t101.repeal_type === "express_partial" && t101.url.endsWith("/101"), "M-13 حالة كل مادة في الفهرس وبيان إلغائها ورابطها");
  ok(r2.toc.find((t) => t.number === 103)?.status === "معدّل", "M-13 المعدّلة في الفهرس");
  ok(r1.url === "https://hakeemai.net/legal/" + encodeURIComponent("نظام-الاثبات") || r1.url.startsWith("https://hakeemai.net/legal/"), "M-13 رابط النظام");
  ok(MCP_PREAMBLE_MAX_CHARS === 12000, "M-13 سقف نص المقدمة في المخرج");

  // نقي: الترتيب داخل الدرجة والتطبيع.
  const m = rankLawNameMatches([{ id: "1", name: "نظام التنفيذ", articleCount: 98 }, { id: "2", name: "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237)", articleCount: 65 }, { id: "3", name: "اللائحة التنفيذية لنظام التنفيذ", articleCount: 200 }], "نظام التنفيذ");
  ok(m.match?.id === "1" && m.matchType === "exact" && m.alternatives[0].id === "2", "M-13 التامة أولًا ثم «يبدأ بـ» في البدائل");
  ok(normalizeLawName("نظامُ الإثباتِ 1443هـ") === "نظام الاثبات", "M-13 التطبيع: التشكيل والهمزة والسنة");
}

async function searchTests(db: SqlClient) {
  const hits = await searchPreambleUnits(db, "أن كل إجراء من إجراءات الإثبات تم صحيحا قبل نفاذ النظام");
  ok(hits.length >= 2 && hits.every((h) => h.type === "preamble_unit" && h.unitType === "operative_clause" && h.systemId === "sys-ithbat"), `S-14 عبارة من البند خامسًا تعيد البند من مقدمة نظام الإثبات (${hits.length})`);
  ok(hits[0].phrase && hits[0].anchor?.endsWith("-clause-5") === true && hits[0].url.includes("#preamble-i"), "S-14 النتيجة موسومة بنوعها ومرساتها ورابطها");
  const op = await searchPreambleUnits(db, "بعون الله تعالى");
  ok(op.length === 1 && op[0].unitType === "opening", "S-14 «بعون الله تعالى» تعيد الافتتاحية (كانت لا تعيد شيئًا)");
  const only = await searchPreambleUnits(db, "رسمنا بما هو آت", { unitTypes: ["enacting_formula"] });
  ok(only.length === 1 && only[0].unitType === "enacting_formula", "S-14 التصفية بنوع الوحدة");
  const merged = mergeArticleAndPreambleHits([{ id: "art-1" }, { id: "art-2" }], hits);
  ok(merged.results.length === 2 && merged.preamble.length === hits.length, "S-14 الترتيب الافتراضي: المواد وحدها، والمقدمة قائمة منفصلة");
  const appended = mergeArticleAndPreambleHits([{ id: "art-1" }], hits, "append");
  ok((appended.results[0] as { id?: string }).id === "art-1" && appended.results.length === 1 + hits.length, "S-14 الإلحاق بعد المواد لا قبلها ولا بينها");
}

async function main() {
  const conn = await connectLocalTest();
  if (!conn) {
    ok(false, "يلزم Postgres محلي (HKM023B_TEST_DATABASE_URL أو الافتراضي 127.0.0.1:54329/hakeem_hkm023b_test)");
  } else {
    const { client, db } = conn;
    try {
      await reset(db);
      await seed(db);
      await migrationTests(db);
      await pageTests(db);
      await mcpTests(db);
      await searchTests(db);
      // لا جداول وحدات: سقوط آمن.
      await db.query(`DROP VIEW preamble_unit_current`);
      ok((await searchPreambleUnits(db, "بعون الله")).length === 0, "S-14 قبل تطبيق الترحيل (لا عرض): لا نتائج ولا خطأ");
    } finally {
      await client.end();
    }
  }
  console.log(`\n${passed} نجح، ${failed} فشل`);
  process.exitCode = failed ? 1 : 0;
}

void md5;
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
