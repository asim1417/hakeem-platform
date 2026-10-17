/**
 * HKM-023-B ب-٣: اختبار إشارات التصنيف وتكافؤ TS/SQL وأولوية القطاعات.
 * - التصنيف على العيّنات الاصطناعية والحقيقية يطابق تصنيف القارئ.
 * - SQL المولَّد (الذي شُغّل على الإنتاج بقراءة فقط) يعطي الأعداد نفسها على Postgres 17 محلي.
 * - عيّنة الـ20 (reports/hkm-023-b-preamble-sample.json) إن وُجدت: الإشارات المستخرجة بـ TS = المحفوظة من الإنتاج.
 */
import fs from "node:fs";
import { composeLawCardText, parsePreamble } from "../lib/modules/legal-core/preamble-parser";
import {
  buildPreambleSignalsSql,
  classifyAndOrder,
  classifyPreambleSignals,
  extractPreambleSignals,
  preambleSector,
  SIGNAL_NAMES,
  toPreambleCsv,
  type PreambleSignals,
} from "../lib/modules/legal-core/preamble-signals";
import { connectLocalTest } from "./hkm-023-b/local-db";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};

const syn = JSON.parse(fs.readFileSync("data/preamble-fixtures/hkm-023-b/synthetic.json", "utf8")).samples as Array<{ id: string; text: string }>;
const prod = JSON.parse(fs.readFileSync("data/preamble-fixtures/hkm-023-b/production.json", "utf8"));
const prodTexts: Array<{ id: string; text: string }> = prod.samples.map((s: { id: string; text?: string; text_file?: string }) => ({
  id: s.id,
  text: s.text ?? fs.readFileSync(s.text_file as string, "utf8").trim(),
}));
prodTexts.push({ id: prod.law_card_samples[0].id, text: composeLawCardText(prod.law_card_samples[0].blocks) });

const edge: Array<{ id: string; text: string; expect: "complete" | "partial" | "issuance_line"; reason?: string }> = [
  { id: "edge-issuance", text: "أداة الإصدار:\nقرار مجلس الوزراء رقم (821) وتاريخ 1444/11/24هـ\nتاريخ الإصدار (هجريّ): 1444-11-24", expect: "issuance_line", reason: "issuance_phrase" },
  { id: "edge-title-date", text: "# لائحة التقارير الطبية المنصوص عليها في نظام الأحوال الشخصية\n\n1444-12-05\nالموافق\n23-06-2023", expect: "issuance_line", reason: "title_date_only" },
  { id: "edge-narrative", text: "المقدمة:\n\nتهدف اللائحة إلى تنظيم نشاط نقل الركاب.\n\nالفصل الأول:\n\nالأحكام التمهيدية", expect: "issuance_line", reason: "body_leak" },
  { id: "edge-narrative-only", text: "**تمهيد**\n\nتهدف اللائحة إلى تنظيم عمليات نقل البضائع على الطرق.", expect: "issuance_line", reason: "narrative_intro" },
  { id: "edge-body", text: "الصادر بالمرسوم الملكي رقم (م/64) وتاريخ 10/ 08/ 1442هـالباب الأول:التعريفاتالمادة الأولى:لأغراض", expect: "issuance_line", reason: "body_leak" },
  { id: "edge-recital-only", text: "الصادرة عن مجلس هيئة السوق المالية بموجب القرار رقم 1-50-2007.\nبناءً على نظام السوق المالية.", expect: "partial", reason: "missing:opening+operative" },
  { id: "edge-nbsp", text: "بعون الله تعالى\nنحن فلان\nوبعد الاطلاع على كذا.\nرسمنا بما هو آت:\nأولاً: كذا (اصطناعي).", expect: "complete" },
  { id: "edge-paren-ordinal", text: "إن مجلس الوزراء\nبعد الاطلاع على كذا (اصطناعي).\nالمشار إليه في البند (أولاً) من هذا القرار.", expect: "partial", reason: "missing:operative" },
  // مراجعة الجودة ن٨: متن طويل بجداول في حقل المقدمة، برأسه عبارة إصدار ولا «المادة الأولى» فيه.
  { id: "edge-long-unstructured", text: "صدر بقرار رقم (1) وتاريخ 1440/1/1هـ (اصطناعي)\n" + "جدول اصطناعي | قيمة | ملاحظة\n".repeat(150), expect: "issuance_line", reason: "body_leak" },
  { id: "edge-short-issuance-long-enough", text: "صدر بقرار رقم (1) وتاريخ 1440/1/1هـ (اصطناعي)\n" + "سطر اصطناعي.\n".repeat(60), expect: "issuance_line", reason: "issuance_phrase" },
  // مراجعة الجودة ن٢: محارف التحكم بالاتجاه داخل المراسي لا تكسرها (وتُحذف في SQL كذلك).
  { id: "edge-bidi", text: "بعون\u202b الله تعالى\nنحن فلان (اصطناعي)\n\u2067وبعد الاطلاع\u2069 على كذا.\nرسمنا\u200f بما هو آت:\nأولاً: كذا (اصطناعي).", expect: "complete" },
];

// ── التصنيف من الإشارات = تصنيف القارئ على العيّنات ──
for (const s of [...syn, ...prodTexts]) {
  const sig = extractPreambleSignals(s.text);
  const fromSignals = classifyPreambleSignals(sig).completeness;
  const fromParser = parsePreamble(s.text).completeness;
  ok(fromSignals === fromParser, `B-3 ${s.id}: تصنيف الإشارات (${fromSignals}) = تصنيف القارئ (${fromParser})`);
}
for (const e of edge) {
  const c = classifyPreambleSignals(extractPreambleSignals(e.text), e.text.length);
  ok(c.completeness === e.expect && (!e.reason || c.reason === e.reason), `B-3 ${e.id}: ${c.completeness}/${c.reason} (المتوقع ${e.expect}${e.reason ? "/" + e.reason : ""})`);
}
ok(classifyPreambleSignals(extractPreambleSignals(edge[4].text)).bodyLeak, "B-3 تسرّب المتن إلى حقل المقدمة يُوسم body_leak");

// ── القطاعات ──
ok(preambleSector({ domain: "procedure", name: "نظام المرافعات الشرعية" }).rank === 1, "B-3 المرافعات (مجال procedure) في التقاضي");
ok(preambleSector({ domain: null, name: "اللائحة التنفيذية لنظام الإثبات" }).key === "litigation", "B-3 بلا مجال: الاسم يضع لائحة الإثبات في التقاضي");
ok(preambleSector({ domain: "companies", name: "نظام الشركات" }).key === "commercial", "B-3 الشركات تجاري");
ok(preambleSector({ domain: null, name: "نظام العمل" }).key === "labor", "B-3 نظام العمل في العمل");
ok(preambleSector({ domain: "criminal", name: "نظام مكافحة غسل الأموال" }).key === "labor", "B-3 الجزائي مع العمل (بنية الدفعات)");
ok(preambleSector({ domain: null, name: "نظام التسجيل العيني للعقار" }).key === "realestate", "B-3 التسجيل العيني عقاري");
ok(preambleSector({ domain: "admin", name: "نظام الخدمة المدنية" }).key === "administrative", "B-3 الإداري");
ok(preambleSector({ domain: "regulatory", name: "تنظيم هيئة السوق المالية" }).key === "commercial", "B-3 مجال قطاعي عام يُحسم بالاسم إن دلّ");
ok(preambleSector({ domain: "health", name: "نظام المؤسسات الصحية الخاصة" }).key === "other", "B-3 الصحي في «أخرى»");

const rows = classifyAndOrder([
  { systemId: "b", name: "تنظيم هيئة كذا", domain: "admin", length: 10, signals: extractPreambleSignals(edge[0].text), lawCardFull: false },
  { systemId: "a", name: "نظام المرافعات الشرعية", domain: "procedure", length: 10, signals: extractPreambleSignals(edge[0].text), lawCardFull: true },
  { systemId: "c", name: "اللائحة التنفيذية لنظام المرافعات الشرعية", domain: "procedure", length: 10, signals: extractPreambleSignals(syn[0].text), lawCardFull: false },
]);
ok(rows.map((r) => r.systemId).join() === "a,c,b" && rows[0].rank === 1, "B-3 الترتيب: القطاع ثم «نظام» قبل اللائحة");
const csv = toPreambleCsv(rows);
ok(csv.split("\n")[0].startsWith("priority_rank,sector") && csv.trim().split("\n").length === 4, "B-3 CSV برأس وصف لكل نظام");

// ── تكافؤ SQL/TS على Postgres محلي ──
async function parity() {
  const conn = await connectLocalTest();
  if (!conn) {
    ok(false, "B-3 تكافؤ SQL/TS: يلزم Postgres محلي (HKM023B_TEST_DATABASE_URL)");
    return;
  }
  const { client, db } = conn;
  try {
    await db.query(`DROP TABLE IF EXISTS hkm023b_signal_fixture`);
    await db.query(`CREATE TABLE hkm023b_signal_fixture (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT, preamble TEXT)`);
    const all = [...syn, ...prodTexts, ...edge.map((e) => ({ id: e.id, text: e.text }))];
    let sample: Array<{ id: string; name: string; text: string; signals: PreambleSignals }> = [];
    if (fs.existsSync("reports/hkm-023-b-preamble-sample.json")) {
      sample = JSON.parse(fs.readFileSync("reports/hkm-023-b-preamble-sample.json", "utf8")).samples;
      for (const s of sample) all.push({ id: `sample-${s.id}`, text: s.text });
    }
    for (const s of all) await db.query(`INSERT INTO hkm023b_signal_fixture (id, name, domain, preamble) VALUES ($1, $2, NULL, $3)`, [s.id, s.id, s.text]);
    const sql = buildPreambleSignalsSql({ table: "hkm023b_signal_fixture", withLawCard: false });
    const out = await db.query<Record<string, string | number>>(sql);
    const byId = new Map(out.map((r) => [String(r.id), r]));
    let same = 0;
    for (const s of all) {
      const ts = extractPreambleSignals(s.text);
      const row = byId.get(s.id);
      const diff = SIGNAL_NAMES.filter((k) => Number(row?.[k]) !== ts[k]);
      if (diff.length) console.log(`   ${s.id}: ${diff.map((k) => `${k} sql=${row?.[k]} ts=${ts[k]}`).join("، ")}`);
      else same++;
      if (row && Number(row.len) !== s.text.length) console.log(`   ${s.id}: الطول sql=${row.len} ts=${s.text.length}`);
    }
    ok(same === all.length, `B-3 تكافؤ SQL/TS على Postgres 17 محلي: ${same}/${all.length} نصًا بالإشارات السبع نفسها`);
    if (sample.length) {
      const agree = sample.filter((s) => SIGNAL_NAMES.every((k) => extractPreambleSignals(s.text)[k] === s.signals[k])).length;
      ok(agree === sample.length, `B-3 عيّنة الـ20 من الإنتاج: إشارات TS = إشارات SQL المحفوظة من الإنتاج (${agree}/${sample.length})`);
    }
    await db.query(`DROP TABLE hkm023b_signal_fixture`);
  } finally {
    await client.end();
  }
}

parity()
  .catch((e) => ok(false, `B-3 تكافؤ: ${(e as Error).message}`))
  .finally(() => {
    console.log(`\n${passed} نجح، ${failed} فشل`);
    process.exitCode = failed ? 1 : 0;
  });
