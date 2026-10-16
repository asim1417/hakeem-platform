/**
 * 00-inventory — المرحلة صفر لطبقة الأحكام البحثية: جرد قراءة فقط، بلا نموذج ولا كتابة.
 *
 * الاستعمال (من جذر المستودع):
 *   DATABASE_URL_READONLY=… npm run research:inventory
 *
 * يقيس: حالة فهرس search_norm، وإحصاءات judicial_cases، وحالة الجداول المرتبطة،
 * ثم يدرس بنية ٥٠ حكمًا (عيّنة طبقية على المحكمة والسنة): عناوين الأجزاء وصيغ التسبيب
 * والمنطوق والاستئناف كما ترد فعلًا. المقتطفات محجوبة (maskPersonalData).
 * المخرج: reports/rulings-research/00-inventory.data.json (يُبنى عليه 00-inventory.md).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { maskPersonalData } from "../../lib/rulings/research/mask";
import { ANCHOR_FAMILIES, findAnchors, headerCandidates } from "../../lib/rulings/research/anchors";

const OUT_DIR = path.join(process.cwd(), "reports/rulings-research");
const BATCH = 2000;
const STUDY_SIZE = 50;
const STUDY_SEED = "research-00";
// المستودع عام: في وضع النشر لا تخرج مقتطفات ولا أرقام قضايا، والعناوين المرشحة ما تكرر في ≥ ٥ أحكام فقط.
const PUBLIC = process.env.INVENTORY_PUBLIC === "1";

const db = openReadOnlyDb();
const q = db.q;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);

async function tableExists(name: string): Promise<boolean> {
  const [r] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, name);
  return r.n > 0;
}

async function count(sql: string, ...params: unknown[]): Promise<number> {
  const [r] = await q<{ n: number }>(sql, ...params);
  return Number(r?.n ?? 0);
}

// ── ٢. حالة الفهرس النصي ──
async function searchNormState() {
  const column = await count(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='judicial_cases' AND column_name='search_norm'`);
  const indexes = await q<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='judicial_cases' ORDER BY indexname`);
  const migrations = (await tableExists("_prisma_migrations"))
    ? await q<{ migration_name: string; finished_at: string | null }>(
        `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%judicial_cases_search_norm%' ORDER BY 1`)
    : [];
  const filled = column ? await count(`SELECT count(*)::int AS n FROM judicial_cases WHERE coalesce(search_norm,'') <> ''`) : 0;
  return {
    columnExists: column > 0,
    filled,
    expectedIndexes: ["idx_judicial_cases_search_norm_tsv", "idx_judicial_cases_search_norm_trgm", "judicial_cases_search_norm_gin"]
      .map((name) => ({ name, present: indexes.some((i) => i.indexname === name) })),
    prismaMigrationsRows: migrations,
    allIndexes: indexes,
  };
}

// ── ٣. إحصاءات الجدول (بدفعات ٢٠٠٠ على المفتاح، بلا مسح ثقيل دفعة واحدة) ──
async function tableStats() {
  const sql = `
    WITH b AS (SELECT * FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH})
    SELECT id, length("judgmentText") AS len,
      coalesce(btrim("judgmentText"),'') = '' AS empty,
      "decisionDate" IS NOT NULL AS has_dd, coalesce(btrim("decisionDateText"),'') <> '' AS has_ddt,
      coalesce(btrim("caseDateText"),'') <> '' AS has_cdt, coalesce(btrim("appealText"),'') <> '' AS has_appeal,
      court, "cityName" AS city, "courtOfAppeal" AS coa,
      CASE WHEN jsonb_typeof(classification) = 'object' THEN (SELECT array_to_string(array_agg(k ORDER BY k), '|') FROM jsonb_object_keys(classification) k) END AS ckeys
    FROM b ORDER BY id`;
  type Row = { id: string; len: number; empty: boolean; has_dd: boolean; has_ddt: boolean; has_cdt: boolean; has_appeal: boolean; court: string | null; city: string | null; coa: string | null; ckeys: string | null };
  let last = "";
  let n = 0;
  let totalLen = 0;
  const lens: number[] = [];
  const c = { empty: 0, under300: 0, under1000: 0, has_dd: 0, has_ddt: 0, has_cdt: 0, has_appeal: 0, classObject: 0 };
  const courts = new Map<string, number>();
  const cities = new Map<string, number>();
  const coas = new Map<string, number>();
  const keys = new Map<string, number>();
  const inc = (m: Map<string, number>, k: string | null) => m.set(k ?? "∅", (m.get(k ?? "∅") ?? 0) + 1);
  for (;;) {
    const rows = await q<Row>(sql, last);
    if (!rows.length) break;
    for (const r of rows) {
      n++;
      const len = Number(r.len ?? 0);
      totalLen += len;
      lens.push(len);
      if (r.empty) c.empty++;
      if (len < 300) c.under300++;
      if (len < 1000) c.under1000++;
      if (r.has_dd) c.has_dd++;
      if (r.has_ddt) c.has_ddt++;
      if (r.has_cdt) c.has_cdt++;
      if (r.has_appeal) c.has_appeal++;
      inc(courts, r.court);
      inc(cities, r.city);
      inc(coas, r.coa);
      if (r.ckeys) {
        c.classObject++;
        for (const k of r.ckeys.split("|")) inc(keys, k);
      }
    }
    last = rows[rows.length - 1].id;
    process.stdout.write(`\r… ${n}`);
  }
  process.stdout.write("\n");
  lens.sort((a, b) => a - b);
  const top = (m: Map<string, number>, k = 40) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([value, cnt]) => ({ value, n: cnt }));
  // قيم كل مفتاح من مفاتيح classification (أعلى ٢٠ لكل مفتاح).
  const keyValues: Record<string, Array<{ value: string; n: number }>> = {};
  for (const k of [...keys.keys()].slice(0, 15)) {
    keyValues[k] = (await q<{ v: string | null; n: number }>(
      `SELECT classification->>$1 AS v, count(*)::int AS n FROM judicial_cases WHERE classification ? $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, k))
      .map((r) => ({ value: r.v ?? "∅", n: r.n }));
  }
  return {
    rows: n,
    meanChars: Math.round(totalLen / Math.max(1, n)),
    medianChars: lens[Math.floor(lens.length / 2)] ?? 0,
    p05Chars: lens[Math.floor(lens.length * 0.05)] ?? 0,
    p95Chars: lens[Math.floor(lens.length * 0.95)] ?? 0,
    empty: { n: c.empty, pct: pct(c.empty, n) },
    under300: { n: c.under300, pct: pct(c.under300, n) },
    under1000: { n: c.under1000, pct: pct(c.under1000, n) },
    coverage: {
      decisionDate: { n: c.has_dd, pct: pct(c.has_dd, n) },
      decisionDateText: { n: c.has_ddt, pct: pct(c.has_ddt, n) },
      caseDateText: { n: c.has_cdt, pct: pct(c.has_cdt, n) },
      appealText: { n: c.has_appeal, pct: pct(c.has_appeal, n) },
      classificationObject: { n: c.classObject, pct: pct(c.classObject, n) },
    },
    distinct: { court: courts.size, cityName: cities.size, courtOfAppeal: coas.size },
    topCourts: top(courts),
    topCities: top(cities, 30),
    topCourtsOfAppeal: top(coas, 30),
    classificationKeys: top(keys, 30),
    classificationKeyValues: keyValues,
  };
}

// ── الجداول المرتبطة والمتجهات ──
async function relatedState(total: number) {
  const out: Record<string, unknown> = {};
  for (const t of ["legal_article_case_links", "judicial_principles", "judgment_cards", "judgment_article_links", "extraction_runs",
    "ruling_meta", "ruling_segments", "reasoning_units", "research_snapshot_meta"]) {
    out[t] = (await tableExists(t)) ? { exists: true, rows: await count(`SELECT count(*)::int AS n FROM "${t}"`) } : { exists: false };
  }
  if (await tableExists("legal_article_case_links")) {
    out.legal_article_case_links_cases = await count(`SELECT count(DISTINCT "caseId")::int AS n FROM legal_article_case_links`);
    out.legal_article_case_links_by_relation = await q(`SELECT "relationType", count(*)::int AS n FROM legal_article_case_links GROUP BY 1 ORDER BY 2 DESC`);
  }
  if (await tableExists("embeddings")) {
    const byType = await q<{ owner_type: string; n: number }>(`SELECT owner_type, count(*)::int AS n FROM embeddings GROUP BY 1 ORDER BY 2 DESC`);
    const rulingOwners = await count(`SELECT count(DISTINCT owner_id)::int AS n FROM embeddings WHERE owner_type='ruling'`);
    out.embeddings = { byOwnerType: byType, distinctRulings: rulingOwners, rulingCoveragePct: pct(rulingOwners, total) };
  }
  return out;
}

// ── ٤. دراسة البنية على ٥٠ حكمًا (عيّنة طبقية: المحكمة × السنة الهجرية) ──
async function structureStudy() {
  const sample = await q<{ id: string; court: string | null; y: string | null; text: string; appeal: string | null; ref: string }>(`
    WITH s AS (
      SELECT id, court, coalesce("decisionNo","caseNo",id) AS ref,
        substring(translate(coalesce("decisionDateText",'') || ' ' || coalesce("caseDateText",''), '٠١٢٣٤٥٦٧٨٩', '0123456789') from '1[34][0-9]{2}') AS y
      FROM judicial_cases WHERE length("judgmentText") >= 300
    ), r AS (
      SELECT *, row_number() OVER (PARTITION BY coalesce(court,'∅'), coalesce(y,'∅') ORDER BY md5(id || '${STUDY_SEED}')) AS rn
      FROM s
    )
    SELECT r.id, r.court, r.y, r.ref, j."judgmentText" AS text, j."appealText" AS appeal
    FROM r JOIN judicial_cases j ON j.id = r.id
    WHERE r.rn = 1 ORDER BY md5(r.id || '${STUDY_SEED}') LIMIT ${STUDY_SIZE}`);
  const familyHits: Record<string, Record<string, { rulings: number; occurrences: number; examples: string[] }>> = {};
  const headers = new Map<string, { n: number; rulings: Set<string> }>();
  const perRuling: Array<Record<string, unknown>> = [];
  for (const r of sample) {
    const full = `${r.text}\n${r.appeal ?? ""}`;
    const found = findAnchors(full);
    for (const h of found) {
      const fam = (familyHits[h.family] ??= {});
      const e = (fam[h.label] ??= { rulings: 0, occurrences: 0, examples: [] });
      e.occurrences++;
      if (!PUBLIC && e.examples.length < 3) e.examples.push(`${r.ref}: …${maskPersonalData(full.slice(Math.max(0, h.start - 40), h.end + 60))}…`);
    }
    for (const fam of Object.values(familyHits)) for (const [label, e] of Object.entries(fam)) {
      if (found.some((h) => h.label === label)) e.rulings++;
    }
    for (const line of headerCandidates(r.text)) {
      const e = headers.get(line) ?? { n: 0, rulings: new Set<string>() };
      e.n++;
      e.rulings.add(r.id);
      headers.set(line, e);
    }
    const order = found.map((h) => h.family);
    // موضع أول ظهور لكل عائلة نسبةً إلى طول النص (٠ أول النص، ١ آخره) — أساس قواعد التقطيع.
    const firstAt: Record<string, number> = {};
    for (const h of found) if (!(h.family in firstAt)) firstAt[h.family] = Math.round((h.start / Math.max(1, full.length)) * 100) / 100;
    const lastDisposition = [...found].reverse().find((h) => h.family === "disposition");
    perRuling.push({
      ...(PUBLIC ? {} : { ref: r.ref }), court: r.court, yearH: r.y, chars: r.text.length, hasAppealText: Boolean(r.appeal),
      familiesInOrder: order.filter((f, i) => i === 0 || order[i - 1] !== f),
      reasoningUnits: found.filter((h) => h.family === "reasoning").length,
      hasDisposition: found.some((h) => h.family === "disposition"),
      newlines: (r.text.match(/\n/g) ?? []).length,
      firstAt,
      lastDispositionAt: lastDisposition ? Math.round((lastDisposition.start / Math.max(1, full.length)) * 100) / 100 : null,
      judgmentChars: r.text.length,
      appealChars: r.appeal ? r.appeal.length : 0,
    });
  }
  return {
    sampleSize: sample.length,
    seed: STUDY_SEED,
    strata: "court × year_h (one ruling per stratum, md5-ordered)",
    anchorFamilies: Object.fromEntries(ANCHOR_FAMILIES.map((f) => [f.family, f.patterns.map((p) => ({ label: p.label, regex: p.re.source }))])),
    familyHits,
    headerCandidates: [...headers.entries()]
      .map(([line, e]) => ({ line: maskPersonalData(line), occurrences: e.n, rulings: e.rulings.size }))
      .filter((h) => h.rulings >= (PUBLIC ? 5 : 2))
      .sort((a, b) => b.rulings - a.rulings)
      .slice(0, 80),
    perRuling,
    layout: (() => {
      const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
      const nl = perRuling.map((p) => p.newlines as number);
      const fam = (f: string) => perRuling.map((p) => (p.firstAt as Record<string, number>)[f]).filter((x) => x !== undefined);
      return {
        rulingsWithNewlines: nl.filter((x) => x > 0).length,
        medianNewlines: med(nl),
        medianFirstAt: Object.fromEntries(["disposition", "reasoning", "evidence", "appeal", "section"].map((f) => [f, med(fam(f))])),
        medianLastDispositionAt: med(perRuling.map((p) => p.lastDispositionAt as number | null).filter((x): x is number => x !== null)),
      };
    })(),
    coverage: {
      withReasoningAnchor: perRuling.filter((p) => (p.reasoningUnits as number) > 0).length,
      withDispositionAnchor: perRuling.filter((p) => p.hasDisposition).length,
    },
  };
}

async function main() {
  const how = await assertReadOnly(db);
  console.log(`🔒 قراءة فقط: ${how} — النقل: ${db.transport}`);
  const searchNorm = await searchNormState();
  console.log("✓ search_norm");
  const stats = await tableStats();
  console.log("✓ إحصاءات الجدول");
  const related = await relatedState(stats.rows);
  console.log("✓ الجداول المرتبطة");
  const study = await structureStudy();
  console.log("✓ دراسة البنية");
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, "00-inventory.data.json");
  writeFileSync(file, JSON.stringify({ measuredAt: new Date().toISOString(), transport: db.transport, public: PUBLIC, searchNorm, stats, related, study }, null, 2));
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}

main()
  .catch((e) => {
    console.error("فشل:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
