/**
 * 01-meta — المرحلة الأولى: اشتقاق ruling_meta واللقطة البحثية.
 *
 *   بلا أعلام  ⇒ تشغيل جافّ للقراءة فقط: يحسب البيانات الأساسية لكل الأحكام في الذاكرة ويقيس
 *               بوابة القبول (year_h ≥ ٩٨٪ من ذوات التاريخ النصي، court_type ≥ ٩٩٪) دون كتابة.
 *   --apply    ⇒ كتابة research_snapshot_meta وruling_meta على **فرع Neon البحثي فقط**:
 *               يلزم NEON_RESEARCH_DATABASE_URL وCONFIRM_RESEARCH_WRITE=YES، ويرفض إن طابق
 *               مضيفُه مضيفَ NEON_DATABASE_URL (الإنتاج). الهجرة تُطبَّق قبلها:
 *               prisma/migrations/20261016120000_rulings_research_meta/migration.sql
 *
 * المخرج: reports/rulings-research/01-meta.data.json (أعداد فقط، بلا نصوص ولا معرّفات — المستودع عام).
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertReadOnly, openReadOnlyDb, type QueryFn } from "../../lib/rulings/audit/readonly-db";
import { deriveMeta, META_EXTRACTOR_VERSION, type RulingMeta, type RulingMetaInput } from "../../lib/rulings/research/meta";

const APPLY = process.argv.includes("--apply");
const BATCH = 1000;
const OUT = path.join(process.cwd(), "reports/rulings-research/01-meta.data.json");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);
const host = (u?: string) => {
  try {
    return u ? new URL(u).hostname.replace("-pooler", "") : "";
  } catch {
    return "";
  }
};

async function* rulings(q: QueryFn): AsyncGenerator<RulingMetaInput[]> {
  let last = "";
  for (;;) {
    const rows = await q<RulingMetaInput>(
      `SELECT id, court, "cityName", "courtOfAppeal", "decisionDateText", "caseDateText", "judgmentText", "appealText"
         FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
    if (!rows.length) return;
    yield rows;
    last = rows[rows.length - 1].id;
  }
}

function newStats() {
  return {
    rows: 0, withDateText: 0, yearH: 0, yearHAmongDated: 0, monthDay: 0, dateG: 0,
    fromCase: 0, courtTyped: 0, appealText: 0, empty: 0,
    courtType: new Map<string, number>(), degree: new Map<string, number>(), year: new Map<string, number>(),
    unclassifiedCourts: new Map<string, number>(), unparsedShapes: new Map<string, number>(),
  };
}
type Stats = ReturnType<typeof newStats>;
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function account(s: Stats, r: RulingMetaInput, m: RulingMeta & { _dateShape: string | null }) {
  s.rows++;
  const dated = Boolean((r.decisionDateText ?? "").trim() || (r.caseDateText ?? "").trim());
  if (dated) s.withDateText++;
  if (m.year_h !== null) {
    s.yearH++;
    if (dated) s.yearHAmongDated++;
    inc(s.year, String(m.year_h));
  } else if (m._dateShape) inc(s.unparsedShapes, m._dateShape);
  if (m.month_h !== null && m.day_h !== null) s.monthDay++;
  if (m.decision_date_g) s.dateG++;
  if (m.date_source === "case") s.fromCase++;
  if (m.court_type) {
    s.courtTyped++;
    inc(s.courtType, m.court_type);
  } else inc(s.unclassifiedCourts, m.court_name_norm ?? "∅");
  inc(s.degree, m.degree ?? "∅");
  if (m.has_appeal_text) s.appealText++;
  if (m.is_empty) s.empty++;
}

function report(s: Stats, snapshotHash: string, extra: Record<string, unknown>) {
  const obj = (m: Map<string, number>) => Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
  const yearGate = pct(s.yearHAmongDated, s.withDateText);
  const courtGate = pct(s.courtTyped, s.rows);
  return {
    measuredAt: new Date().toISOString(),
    extractorVersion: META_EXTRACTOR_VERSION,
    mode: APPLY ? "apply" : "dry-run",
    rows: s.rows,
    snapshotContentHash: snapshotHash,
    gate: {
      yearH: { value: yearGate, threshold: 98, pass: yearGate >= 98, numerator: s.yearHAmongDated, denominator: s.withDateText },
      courtType: { value: courtGate, threshold: 99, pass: courtGate >= 99, numerator: s.courtTyped, denominator: s.rows },
    },
    coverage: {
      monthAndDay: { n: s.monthDay, pct: pct(s.monthDay, s.rows) },
      decisionDateG: { n: s.dateG, pct: pct(s.dateG, s.rows) },
      dateFromCaseText: s.fromCase,
      appealText: { n: s.appealText, pct: pct(s.appealText, s.rows) },
      empty: s.empty,
    },
    courtType: obj(s.courtType),
    degree: obj(s.degree),
    yearH: Object.fromEntries([...s.year.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    unclassifiedCourts: obj(s.unclassifiedCourts),
    unparsedDateShapes: Object.fromEntries([...s.unparsedShapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
    ...extra,
  };
}

/** فحص قراءة فقط يمهّد لربط الحكم باستئنافه: تكرار رقم القضية/القرار بين الأحكام. */
async function appealLinkProbe(q: QueryFn) {
  const [r] = await q<{ case_dups: number; case_dup_rows: number; decision_dups: number }>(`
    SELECT
      (SELECT count(*)::int FROM (SELECT "caseNo" FROM judicial_cases WHERE coalesce("caseNo",'')<>'' GROUP BY 1 HAVING count(*)>1) a) AS case_dups,
      (SELECT coalesce(sum(c),0)::int FROM (SELECT count(*) c FROM judicial_cases WHERE coalesce("caseNo",'')<>'' GROUP BY "caseNo" HAVING count(*)>1) b) AS case_dup_rows,
      (SELECT count(*)::int FROM (SELECT "decisionNo" FROM judicial_cases WHERE coalesce("decisionNo",'')<>'' GROUP BY 1 HAVING count(*)>1) c) AS decision_dups`);
  return { caseNoSharedGroups: r.case_dups, rowsInSharedCaseNo: r.case_dup_rows, decisionNoSharedGroups: r.decision_dups };
}

async function dryRun() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const s = newStats();
    const snap = createHash("sha256");
    for await (const batch of rulings(db.q)) {
      for (const r of batch) {
        const m = deriveMeta(r);
        account(s, r, m);
        snap.update(`${r.id}:${m.content_hash}\n`);
      }
      process.stdout.write(`\r… ${s.rows}`);
    }
    process.stdout.write("\n");
    const probe = await appealLinkProbe(db.q);
    write(report(s, snap.digest("hex"), { appealLinkProbe: probe }));
  } finally {
    await db.close();
  }
}

async function apply() {
  const target = process.env.NEON_RESEARCH_DATABASE_URL;
  if (!target || process.env.CONFIRM_RESEARCH_WRITE !== "YES") {
    console.error("🛑 الكتابة تتطلّب NEON_RESEARCH_DATABASE_URL وCONFIRM_RESEARCH_WRITE=YES.");
    process.exit(2);
  }
  const prodHost = host(process.env.NEON_DATABASE_URL);
  if (!/neon\.tech$/.test(host(target)) || (prodHost && host(target) === prodHost)) {
    console.error("🛑 هدف الكتابة ليس فرع Neon بحثيًّا مستقلًّا عن الإنتاج.");
    process.exit(2);
  }
  const prisma = new PrismaClient({ datasources: { db: { url: target } }, log: ["error"] });
  const q: QueryFn = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const snapshotId = process.env.RESEARCH_SNAPSHOT_ID || `research-${new Date().toISOString().slice(0, 10)}`;
  try {
    const s = newStats();
    const snap = createHash("sha256");
    const pending: RulingMeta[] = [];
    // اللقطة أولًا (بصمة مؤقتة تُحدَّث في النهاية) كي يصحّ المفتاح الأجنبي snapshot_id.
    await prisma.$executeRawUnsafe(
      `INSERT INTO research_snapshot_meta (id, neon_branch, rulings_count, content_hash, note)
       VALUES ($1, $2, 0, 'pending', 'ruling_meta ${META_EXTRACTOR_VERSION}') ON CONFLICT (id) DO NOTHING`,
      snapshotId, snapshotId);
    const flush = async () => {
      if (!pending.length) return;
      const cols = ["case_id", "snapshot_id", "year_h", "month_h", "day_h", "date_source", "decision_date_g", "date_g_method",
        "court_type", "court_name_norm", "city_norm", "appeal_court_norm", "degree", "has_appeal_text", "text_len", "is_empty",
        "content_hash", "extractor_version"] as const;
      const params: unknown[] = [];
      const tuples = pending.map((m) => {
        const vals = [m.case_id, snapshotId, m.year_h, m.month_h, m.day_h, m.date_source, m.decision_date_g, m.date_g_method,
          m.court_type, m.court_name_norm, m.city_norm, m.appeal_court_norm, m.degree, m.has_appeal_text, m.text_len, m.is_empty,
          m.content_hash, m.extractor_version];
        return `(${vals.map((v, i) => { params.push(v); return `$${params.length}${cols[i] === "decision_date_g" ? "::date" : ""}`; }).join(",")})`;
      });
      await prisma.$executeRawUnsafe(
        `INSERT INTO ruling_meta (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}
         ON CONFLICT (case_id) DO UPDATE SET ${cols.filter((c) => c !== "case_id").map((c) => `"${c}"=EXCLUDED."${c}"`).join(",")}`,
        ...params);
      pending.length = 0;
    };
    for await (const batch of rulings(q)) {
      for (const r of batch) {
        const m = deriveMeta(r);
        account(s, r, m);
        snap.update(`${r.id}:${m.content_hash}\n`);
        const { _dateShape: _ignored, ...row } = m;
        pending.push(row);
        if (pending.length >= 250) await flush();
      }
      process.stdout.write(`\r… ${s.rows}`);
    }
    await flush();
    process.stdout.write("\n");
    const hash = snap.digest("hex");
    await prisma.$executeRawUnsafe(
      `UPDATE research_snapshot_meta SET rulings_count=$2, content_hash=$3 WHERE id=$1`, snapshotId, s.rows, hash);
    write(report(s, hash, { snapshotId, appealLinkProbe: await appealLinkProbe(q) }));
  } finally {
    await prisma.$disconnect();
  }
}

function write(data: unknown) {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
  const g = (data as { gate: { yearH: { value: number; pass: boolean }; courtType: { value: number; pass: boolean } } }).gate;
  console.log(`✓ ${path.relative(process.cwd(), OUT)} — year_h ${g.yearH.value}% ${g.yearH.pass ? "✓" : "✗"} · court_type ${g.courtType.value}% ${g.courtType.pass ? "✓" : "✗"}`);
}

(APPLY ? apply() : dryRun()).catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
