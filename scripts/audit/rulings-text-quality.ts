/**
 * rulings-text-quality — فحص قاعدة الأحكام وتشخيصها (المرحلة أ، قراءة فقط).
 *
 * الاستعمال:
 *   DATABASE_URL_READONLY=postgres://… npx tsx scripts/audit/rulings-text-quality.ts <step> [--flags]
 *
 * الخطوات (بالترتيب؛ all = الكلّ):
 *   inventory  أ-١  عدد الصفوف، الفهارس، الامتدادات، الأعمدة، الجداول المرتبطة.
 *   sample     أ-٢  عيّنة ثابتة البذرة من ٥٠٠ حكم ← audit/sample_ids.json (تُعاد إن وُجدت).
 *   quality    أ-٣/أ-٤  المعجم + مؤشرات الجودة + الدرجة والفئات + أمثلة قبل/بعد (محاكاة).
 *   full       أ-٤/أ-٥  القياسات الخفيفة + امتلاء البيانات الوصفية على كامل القاعدة بدفعات ٢٠٠٠.
 *   metadata   أ-٥  استخراج البيانات الوصفية من نصوص العيّنة بالأنماط.
 *   golden     أ-٦  الاستعلامات الذهبية على كل مسار بحث (--paths=mcp_search,mcp_enumerate,web_comprehensive,web_judgments,rulings_direct).
 *
 * ضمانات القراءة فقط:
 *   • يُفضَّل DATABASE_URL_READONLY. يُضاف إلى الرابط options=-c default_transaction_read_only=on
 *     (ومهلة ١٢٠ ثانية لكل استعلام).
 *   • يرفض السكربت العمل ما لم يثبت أن الجلسة للقراءة فقط (transaction_read_only=on)،
 *     أو أن الدور لا يملك صلاحية UPDATE على judicial_cases.
 *   • لا يطبع رابط الاتصال ولا أيّ سرّ. المقتطفات تُنقّى من أرقام الهوية والجوال (PDPL).
 * المخرجات: audit/out/*.json و audit/out/rulings-audit-tables.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  addFrequentRulingWords,
  addText,
  emptyLexicon,
  keyForm,
  type Lexicon,
} from "../../lib/rulings/audit/lexicon";
import {
  containsWholeWord,
  measureRuling,
  qualityScore,
  qualityTier,
  simulateClean,
  simulatedSearchText,
  type QualityTier,
  type RulingMetrics,
} from "../../lib/rulings/audit/metrics";

const ROOT = process.cwd(); // يُشغَّل من جذر المستودع
const OUT = path.join(ROOT, "audit/out");
const SAMPLE_FILE = path.join(ROOT, "audit/sample_ids.json");
const GOLDEN_FILE = path.join(ROOT, "audit/golden_queries.json");
const SAMPLE_SIZE = 500;
const BATCH = 2000;

const args = process.argv.slice(2);
const step = args.find((a) => !a.startsWith("--")) ?? "all";
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

// ── الاتصال للقراءة فقط ──

function readOnlyUrl(): { url: string; fromReadonlyVar: boolean } {
  const base = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
  if (!base) {
    console.error("لا يوجد DATABASE_URL_READONLY ولا DATABASE_URL — أوقفتُ التشغيل.");
    process.exit(2);
  }
  const u = new URL(base);
  if (!u.searchParams.has("options") && process.env.AUDIT_NO_OPTIONS !== "1") {
    u.searchParams.set("options", "-c default_transaction_read_only=on -c statement_timeout=120000");
  }
  return { url: u.toString(), fromReadonlyVar: Boolean(process.env.DATABASE_URL_READONLY) };
}

const conn = readOnlyUrl();
// مسارات التطبيق تستورد lib/prisma الذي يقرأ DATABASE_URL — نوجّهه إلى الرابط نفسه للقراءة فقط.
process.env.DATABASE_URL = conn.url;
const db = new PrismaClient({ datasources: { db: { url: conn.url } }, log: ["error"] });

async function q<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  return db.$queryRawUnsafe<T[]>(sql, ...params);
}

async function assertReadOnly(): Promise<string> {
  const [ro] = await q<{ transaction_read_only: string }>("SHOW transaction_read_only");
  if (ro?.transaction_read_only === "on") return "transaction_read_only=on";
  const [p] = await q<{ can: boolean }>(
    `SELECT has_table_privilege(current_user, 'judicial_cases', 'UPDATE') AS can`,
  );
  if (conn.fromReadonlyVar && p && p.can === false) return "role without UPDATE on judicial_cases";
  console.error("تعذّر إثبات أن الجلسة للقراءة فقط — أوقفتُ التشغيل. استخدم دورًا للقراءة فقط أو اتصالًا مباشرًا (غير pooler) يقبل options.");
  process.exit(3);
}

function save(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  console.log(`✓ ${path.relative(ROOT, path.join(OUT, name))}`);
}

function load<T>(name: string): T | null {
  const p = path.join(OUT, name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
}

/** حجب PDPL للمقتطفات: هوية/إقامة، جوال، آيبان. */
function redact(text: string): string {
  return String(text ?? "")
    .replace(/(?<![0-9٠-٩])[12١٢][0-9٠-٩]{9}(?![0-9٠-٩])/g, "[هوية محجوبة]")
    .replace(/(?:\+?966|00966)?0?5[0-9٠-٩]{8}/g, "[جوال محجوب]")
    .replace(/\bSA\d{22}\b/gi, "[آيبان محجوب]");
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);

// ── أ-١ الجرد البنيوي ──

async function inventory() {
  const [{ n }] = await q<{ n: bigint }>(`SELECT count(*)::bigint AS n FROM judicial_cases`);
  const indexes = await q<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'judicial_cases' ORDER BY indexname`,
  );
  const extensions = await q<{ extname: string; extversion: string }>(
    `SELECT extname, extversion FROM pg_extension ORDER BY extname`,
  );
  const columns = await q<{ column_name: string; data_type: string; is_nullable: string }>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'judicial_cases' ORDER BY ordinal_position`,
  );
  // أعمدة tsvector/vector في أي جدول، وجداول تحوي «case/ruling/judg/chunk» في اسمها.
  const vectorish = await q<{ table_name: string; column_name: string; udt_name: string }>(
    `SELECT table_name, column_name, udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND udt_name IN ('tsvector','vector') ORDER BY 1,2`,
  );
  const related = await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND (table_name ILIKE '%case%' OR table_name ILIKE '%ruling%' OR table_name ILIKE '%judg%'
           OR table_name ILIKE '%chunk%' OR table_name = 'embeddings') ORDER BY 1`,
  );
  const embeddings = await q<{ owner_type: string; n: bigint }>(
    `SELECT owner_type, count(*)::bigint AS n FROM embeddings GROUP BY owner_type ORDER BY 1`,
  ).catch(() => []);
  const [searchNorm] = await q<{ filled: bigint }>(
    `SELECT count(*)::bigint AS filled FROM judicial_cases WHERE search_norm IS NOT NULL AND search_norm <> ''`,
  ).catch(() => [{ filled: BigInt(-1) }]);
  const reviewStatus = await q<{ reviewStatus: string; n: bigint }>(
    `SELECT "reviewStatus", count(*)::bigint AS n FROM judicial_cases GROUP BY 1 ORDER BY 2 DESC`,
  );
  const sources = await q<{ source: string; host: string | null; n: bigint }>(
    `SELECT source, substring("sourceLink" from '^https?://([^/]+)') AS host, count(*)::bigint AS n
       FROM judicial_cases GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20`,
  );
  const data = {
    measuredAt: new Date().toISOString(),
    rows: Number(n),
    columns,
    indexes,
    extensions,
    vectorish,
    relatedTables: related.map((r) => r.table_name),
    embeddingsByOwnerType: embeddings.map((e) => ({ owner_type: e.owner_type, n: Number(e.n) })),
    searchNormFilled: Number(searchNorm.filled), // -1 = العمود غير موجود
    reviewStatus: reviewStatus.map((r) => ({ status: r.reviewStatus, n: Number(r.n) })),
    sources: sources.map((s) => ({ source: s.source, host: s.host, n: Number(s.n) })),
    queries: {
      rows: "SELECT count(*) FROM judicial_cases",
      indexes: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='judicial_cases'",
      extensions: "SELECT extname, extversion FROM pg_extension",
      searchNorm: "SELECT count(*) FROM judicial_cases WHERE search_norm IS NOT NULL AND search_norm<>''",
    },
  };
  save("inventory.json", data);
  return data;
}

// ── أ-٢ العيّنة ──

interface SampleFile { method: string; seed: number; size: number; drawnAt: string; ids: string[] }

async function sample(): Promise<SampleFile> {
  if (existsSync(SAMPLE_FILE)) {
    const s = JSON.parse(readFileSync(SAMPLE_FILE, "utf8")) as SampleFile;
    console.log(`↺ العيّنة موجودة (${s.ids.length}) — تُعاد كما هي.`);
    return s;
  }
  // TABLESAMPLE BERNOULLI بنسبة ~٢٪ ببذرة ثابتة (REPEATABLE 42) ثم ترتيب حتميّ بـ md5(id).
  const sql = `SELECT id FROM judicial_cases TABLESAMPLE BERNOULLI (2) REPEATABLE (42)
                ORDER BY md5(id) LIMIT ${SAMPLE_SIZE}`;
  const rows = await q<{ id: string }>(sql);
  const s: SampleFile = { method: sql, seed: 42, size: rows.length, drawnAt: new Date().toISOString(), ids: rows.map((r) => r.id) };
  writeFileSync(SAMPLE_FILE, JSON.stringify(s, null, 2));
  console.log(`✓ audit/sample_ids.json (${rows.length})`);
  return s;
}

interface SampleRow {
  id: string; decisionNo: string | null; caseNo: string | null; court: string | null;
  decisionDateText: string | null; judgmentTitle: string | null; judgmentText: string;
}

async function loadSampleRows(ids: string[]): Promise<SampleRow[]> {
  const rows: SampleRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    rows.push(...(await q<SampleRow>(
      `SELECT id, "decisionNo", "caseNo", court, "decisionDateText", "judgmentTitle", "judgmentText"
         FROM judicial_cases WHERE id = ANY($1::text[])`, ids.slice(i, i + 100),
    )));
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ── المعجم ──

async function buildLexicon(sampleTexts: string[]): Promise<{ lex: Lexicon; stats: Record<string, number> }> {
  const lex = emptyLexicon();
  let articles = 0;
  let last = "";
  for (;;) {
    const rows = await q<{ id: string; content: string; title: string }>(
      `SELECT id, content, title FROM legal_articles WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last,
    );
    if (!rows.length) break;
    for (const r of rows) addText(lex, `${r.title ?? ""} ${r.content ?? ""}`);
    articles += rows.length;
    last = rows[rows.length - 1].id;
  }
  const thesaurus = await q<{ t: string }>(
    `SELECT preferred_label_ar AS t FROM legal_thesaurus_concepts
     UNION ALL SELECT term_text FROM legal_thesaurus_terms`,
  ).catch(() => []);
  for (const r of thesaurus) addText(lex, r.t, 5);
  const afterClean = lex.key.size;
  const frequent = addFrequentRulingWords(lex, sampleTexts, 20, 5);
  return {
    lex,
    stats: { articles, thesaurusLabels: thesaurus.length, cleanKeys: afterClean, frequentRulingWords: frequent, totalKeys: lex.key.size },
  };
}

// ── أ-٣/أ-٤ الجودة على العيّنة ──

const TIERS: QualityTier[] = ["sound", "repairable", "poor", "damaged"];

/** فاصل ثقة ويلسون ٩٥٪ لنسبة. */
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.round((c - h) * 1000) / 10, Math.round((c + h) * 1000) / 10];
}

async function quality() {
  const s = await sample();
  const rows = await loadSampleRows(s.ids);
  const { lex, stats } = await buildLexicon(rows.map((r) => r.judgmentText));
  const per: Array<{ id: string; ref: string; score: number; tier: QualityTier; m: Omit<RulingMetrics, "examples"> }> = [];
  const examples: Array<Record<string, unknown>> = [];
  const hashCount = new Map<string, number>();
  // أكثر الأخطاء الإملائية تكرارًا في العيّنة: «الكلمة → الاقتراح» مع النوع وعدد الأحكام.
  const misspell = new Map<string, { word: string; suggestions: string[]; kind: string; rulings: Set<string> }>();

  for (const r of rows) {
    const m = measureRuling(lex, r.judgmentText);
    const score = qualityScore(m);
    const tier = qualityTier(score);
    const { examples: ex, ...rest } = m;
    const ref = r.decisionNo || r.caseNo || r.id;
    per.push({ id: r.id, ref, score, tier, m: rest });
    hashCount.set(m.normHash, (hashCount.get(m.normHash) ?? 0) + 1);
    for (const f of ex.spelling) {
      const key = `${f.kind}:${f.word}`;
      const e = misspell.get(key) ?? { word: f.word, suggestions: f.suggestions, kind: f.kind, rulings: new Set<string>() };
      e.rulings.add(ref);
      misspell.set(key, e);
    }
    const sim = simulateClean(lex, r.judgmentText);
    if (sim.edits.length || ex.reversed.length || ex.spelling.length) {
      const first = sim.edits[0];
      const at = first ? r.judgmentText.normalize("NFKC").indexOf(first.before.split(" ")[0]) : 0;
      const from = Math.max(0, at - 120);
      examples.push({
        id: r.id, ref, court: r.court, score, tier,
        edits: sim.edits.slice(0, 8),
        glued: ex.glued, broken: ex.broken, reversed: ex.reversed, spelling: ex.spelling,
        before: redact(r.judgmentText.normalize("NFKC").slice(from, from + 320)),
        after: redact(sim.text.slice(Math.max(0, sim.text.indexOf(first?.after.split(" ")[0] ?? "") - 120), Math.max(0, sim.text.indexOf(first?.after.split(" ")[0] ?? "") - 120) + 320)),
      });
    }
  }

  const n = per.length;
  const sum = (f: (m: Omit<RulingMetrics, "examples">) => number) => per.reduce((a, p) => a + f(p.m), 0);
  const withAny = (f: (m: Omit<RulingMetrics, "examples">) => number) => per.filter((p) => f(p.m) > 0).length;
  const arabicWords = sum((m) => m.arabicWords);
  const indicator = (label: string, f: (m: Omit<RulingMetrics, "examples">) => number) => ({
    label, total: sum(f), rulingsAffected: withAny(f), rulingsAffectedPct: pct(withAny(f), n),
    per1kWords: arabicWords ? Math.round((sum(f) * 1000 * 100) / arabicWords) / 100 : 0,
  });
  const tiers = TIERS.map((t) => {
    const k = per.filter((p) => p.tier === t).length;
    return { tier: t, n: k, pct: pct(k, n), ci95: wilson(k, n) };
  });
  const dupGroups = [...hashCount.values()].filter((c) => c > 1);
  const summary = {
    measuredAt: new Date().toISOString(),
    sampleSize: n,
    lexicon: stats,
    arabicWords,
    coverage: { mean: Math.round((sum((m) => m.coverage) / n) * 10000) / 100, pooled: pct(sum((m) => m.knownWords), arabicWords) },
    indicators: [
      indicator("presentation_forms", (m) => m.presentationForms),
      indicator("hidden_chars", (m) => m.hiddenChars),
      indicator("tatweel", (m) => m.tatweel),
      indicator("reversed_words", (m) => m.reversedWords),
      indicator("glued_words", (m) => m.gluedWords),
      indicator("broken_pairs", (m) => m.brokenPairs),
      indicator("spelling_hamza_initial", (m) => m.spelling.hamzaInitial),
      indicator("spelling_hamza_medial", (m) => m.spelling.hamzaMedial),
      indicator("spelling_ya_alif", (m) => m.spelling.yaAlif),
      indicator("spelling_ta_ha", (m) => m.spelling.taHa),
      indicator("spelling_alef_fariqa_missing", (m) => m.spelling.alefFariqaMissing),
      indicator("spelling_alef_fariqa_extra", (m) => m.spelling.alefFariqaExtra),
      indicator("spelling_confusable_letters", (m) => m.spelling.confusable),
      indicator("ocr_latin_digit_in_word", (m) => m.ocrLatinDigitInWord),
      indicator("ocr_bad_symbols", (m) => m.ocrBadSymbols),
    ],
    length: {
      meanChars: Math.round(sum((m) => m.chars) / n),
      meanWords: Math.round(sum((m) => m.words) / n),
      empty: per.filter((p) => p.m.isEmpty).length,
      short: per.filter((p) => p.m.isShort).length,
    },
    duplicates: { groups: dupGroups.length, rulingsInGroups: dupGroups.reduce((a, b) => a + b, 0) },
    tiers,
    spelling: {
      note: "قياس فقط؛ confusable مرشّح (قد يكون علمًا)، و«علي» مستثناة لأنها قد تكون علمًا.",
      rulingsWithAny: per.filter((p) => Object.values(p.m.spelling).some((v) => v > 0)).length,
      topMisspellings: [...misspell.values()]
        .map((e) => ({ word: e.word, suggestions: e.suggestions, kind: e.kind, rulings: e.rulings.size, examples: [...e.rulings].slice(0, 3) }))
        .sort((a, b) => b.rulings - a.rulings)
        .slice(0, 60),
    },
    scoreFormula: "lib/rulings/audit/metrics.ts#qualityScore",
  };
  save("sample-metrics.json", per);
  // أكثر الأمثلة تعديلًا أولًا، ثم أول ٢٠ للتقرير.
  examples.sort((a, b) => (b.edits as unknown[]).length - (a.edits as unknown[]).length);
  save("examples.json", examples.slice(0, 40));
  save("quality-summary.json", summary);
  return { summary, lex, rows };
}

// ── أ-٤/أ-٥ التعميم على كامل القاعدة (دفعات ٢٠٠٠) ──

const META_COLS = [
  "decisionNo", "caseNo", "court", "courtOfAppeal", "cityName", "cityOfAppeal",
  "decisionDateText", "caseDateText", "decisionDate", "caseDate", "classification",
  "judgmentTitle", "appealText", "sourceLink",
] as const;

async function full() {
  const pres = "[\\uFB50-\\uFDFF\\uFE70-\\uFEFC]";
  const hidden = "[\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF\\u00AD]";
  const nullExpr = (c: string) =>
    ["decisionDate", "caseDate", "classification"].includes(c)
      ? `("${c}" IS NULL)`
      : `(coalesce(btrim("${c}"),'') = '')`;
  const sql = `
    WITH b AS (SELECT * FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH})
    SELECT id,
      length("judgmentText") AS chars,
      length(btrim("judgmentText")) < 300 AS short,
      length("judgmentText") - length(regexp_replace("judgmentText", '${pres}', '', 'g')) AS pres,
      length("judgmentText") - length(regexp_replace("judgmentText", '${hidden}', '', 'g')) AS hidden,
      length("judgmentText") - length(replace("judgmentText", 'ـ', '')) AS tatweel,
      md5(regexp_replace("judgmentText", '\\s+', '', 'g')) AS h,
      coalesce("decisionDateText",'') ~ '1[0-4][0-9]{2}' AS yearh_mcp_regex,
      translate(coalesce("decisionDateText",'') || ' ' || coalesce("caseDateText",''), '٠١٢٣٤٥٦٧٨٩', '0123456789') ~ '1[34][0-9]{2}' AS yearh_derivable,
      court, "courtOfAppeal", "cityName",
      ${META_COLS.map((c) => `${nullExpr(c)} AS "null_${c}"`).join(",\n      ")}
    FROM b ORDER BY id`;
  type Row = Record<string, unknown> & { id: string; chars: number; short: boolean; pres: number; hidden: number; tatweel: number; h: string; yearh_mcp_regex: boolean; yearh_derivable: boolean; court: string | null; courtOfAppeal: string | null; cityName: string | null };
  let last = "";
  let n = 0;
  const agg = { chars: 0, short: 0, presRows: 0, pres: 0, hiddenRows: 0, hidden: 0, tatweelRows: 0, tatweel: 0, yearhMcp: 0, yearhDerivable: 0 };
  const nulls: Record<string, number> = Object.fromEntries(META_COLS.map((c) => [c, 0]));
  const hashes = new Map<string, number>();
  const courts = new Map<string, number>();
  const cities = new Map<string, number>();
  for (;;) {
    const rows = await q<Row>(sql, last);
    if (!rows.length) break;
    for (const r of rows) {
      n++;
      agg.chars += Number(r.chars);
      if (r.short) agg.short++;
      if (Number(r.pres) > 0) { agg.presRows++; agg.pres += Number(r.pres); }
      if (Number(r.hidden) > 0) { agg.hiddenRows++; agg.hidden += Number(r.hidden); }
      if (Number(r.tatweel) > 0) { agg.tatweelRows++; agg.tatweel += Number(r.tatweel); }
      if (r.yearh_mcp_regex) agg.yearhMcp++;
      if (r.yearh_derivable) agg.yearhDerivable++;
      for (const c of META_COLS) if (r[`null_${c}`]) nulls[c]++;
      hashes.set(r.h, (hashes.get(r.h) ?? 0) + 1);
      const ct = r.court ?? "∅";
      courts.set(ct, (courts.get(ct) ?? 0) + 1);
      const cy = r.cityName ?? "∅";
      cities.set(cy, (cities.get(cy) ?? 0) + 1);
    }
    last = rows[rows.length - 1].id;
    process.stdout.write(`\r… ${n}`);
  }
  process.stdout.write("\n");
  // تهجئات مختلفة لمحكمة واحدة: نجمع على مفتاح مطبَّع (بلا فراغات ولا «ال» ولا ترقيم).
  const clusterKey = (s: string) => keyForm(s).replace(/[^ء-ي0-9]/g, "").replace(/ال/g, "");
  const clusters = new Map<string, Array<{ value: string; n: number }>>();
  for (const [value, c] of courts) {
    const k = clusterKey(value);
    clusters.set(k, [...(clusters.get(k) ?? []), { value, n: c }]);
  }
  const dupGroups = [...hashes.values()].filter((c) => c > 1);
  const data = {
    measuredAt: new Date().toISOString(),
    rows: n,
    meanChars: Math.round(agg.chars / n),
    short: { n: agg.short, pct: pct(agg.short, n) },
    presentationForms: { rows: agg.presRows, pct: pct(agg.presRows, n), chars: agg.pres },
    hiddenChars: { rows: agg.hiddenRows, pct: pct(agg.hiddenRows, n), chars: agg.hidden },
    tatweel: { rows: agg.tatweelRows, pct: pct(agg.tatweelRows, n), chars: agg.tatweel },
    exactDuplicates: { groups: dupGroups.length, rows: dupGroups.reduce((a, b) => a + b, 0) },
    yearH: {
      mcpRegexMatches: { n: agg.yearhMcp, pct: pct(agg.yearhMcp, n), rule: "decisionDateText ~ '1[0-4][0-9]{2}' (Latin digits only — as lib/mcp/adapter.ts & lib/mcp/tools/rulings.ts)" },
      derivableAfterDigitNormalization: { n: agg.yearhDerivable, pct: pct(agg.yearhDerivable, n) },
    },
    nullRates: Object.fromEntries(META_COLS.map((c) => [c, { n: nulls[c], pct: pct(nulls[c], n) }])),
    absentColumns: ["year_h", "circuit (الدائرة)", "deed_no (رقم الصك)", "degree (الدرجة)", "judgment_type (نوع الحكم)"],
    distinctCourts: courts.size,
    topCourts: [...courts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([value, c]) => ({ value, n: c })),
    courtSpellingClusters: [...clusters.values()].filter((v) => v.length > 1).sort((a, b) => b.length - a.length).slice(0, 30),
    distinctCities: cities.size,
    topCities: [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([value, c]) => ({ value, n: c })),
    batchSql: sql.trim(),
  };
  save("full-light.json", data);
  return data;
}

// ── أ-٥ استخراج البيانات الوصفية من نصوص العيّنة ──

const ORD = "(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|الحادية عشرة|الثانية عشرة|[0-9]+)";
const PATTERNS: Record<string, RegExp> = {
  hijriDate: /(?:^|[^0-9])(?:[0-9]{1,2}\s*[/-]\s*[0-9]{1,2}\s*[/-]\s*)?1[34][0-9]{2}\s*(?:ه|هـ)/,
  circuit: new RegExp(`الدائرة\\s+(?:[\\u0621-\\u064A]+\\s+){0,2}${ORD}`),
  caseNo: /(?:القضية|الدعوى)\s+(?:رقم|ذات\s+الرقم)\s*[:(]?\s*[0-9]{3,}/,
  deedNo: /(?:الصك|القرار|الحكم)\s+(?:رقم|ذي\s+الرقم)\s*[:(]?\s*[0-9]{3,}/,
  city: /(?:بمدينة|في\s+مدينة|بمحافظة)\s+[ء-ي]+/,
  degreeAppeal: /محكمة\s+الاستئناف|دائرة\s+الاستئناف|الدائرة\s+الاستئنافية/,
  degreeSupreme: /المحكمة\s+العليا/,
  judgmentType: /حكمت\s+الدائرة|نص\s+الحكم|منطوق\s+الحكم|قررت\s+الدائرة/,
};

async function metadata(rows?: SampleRow[]) {
  const s = await sample();
  const data = rows ?? (await loadSampleRows(s.ids));
  const toLatin = (t: string) => t.normalize("NFKC").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const hits: Record<string, number> = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, 0]));
  const examples: Record<string, string[]> = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, []]));
  for (const r of data) {
    const t = toLatin(r.judgmentText);
    for (const [k, re] of Object.entries(PATTERNS)) {
      const m = t.match(re);
      if (m) {
        hits[k]++;
        if (examples[k].length < 3) examples[k].push(`${r.decisionNo || r.caseNo || r.id}: ${redact(m[0].trim())}`);
      }
    }
  }
  const out = {
    sampleSize: data.length,
    extractable: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, { n: v, pct: pct(v, data.length) }])),
    examples,
    patterns: Object.fromEntries(Object.entries(PATTERNS).map(([k, v]) => [k, v.source])),
  };
  save("metadata-extraction.json", out);
  return out;
}

// ── أ-٦ الاستعلامات الذهبية ──

type PathName = "mcp_search" | "mcp_enumerate" | "web_comprehensive" | "web_judgments" | "rulings_direct";
const ALL_PATHS: PathName[] = ["mcp_search", "mcp_enumerate", "web_comprehensive", "web_judgments", "rulings_direct"];

async function runPath(p: PathName, query: string): Promise<{ total: number | null; ids: string[]; diag?: unknown }> {
  switch (p) {
    case "mcp_search": {
      const { searchRulings } = await import("../../lib/mcp/adapter");
      const { hybridSearch } = await import("../../lib/modules/legal-search/hybrid-search");
      const r = await searchRulings(query, undefined, undefined, 10);
      // تشخيص: ما الذي ملأ الخانات الثلاثين في الهجين (بحسب النوع والمزوّد)؟ — يفسّر العَرَضين ١ و٣.
      const h = await hybridSearch({ q: query, limit: 30 });
      const byType: Record<string, number> = {};
      const rulingSources: Record<string, number> = {};
      for (const x of h.results) {
        byType[x.type] = (byType[x.type] ?? 0) + 1;
        if (x.type === "ruling") for (const src of x.sources) rulingSources[src] = (rulingSources[src] ?? 0) + 1;
      }
      return {
        total: r.count,
        ids: r.results.map((x) => x.ruling_id),
        diag: { hybridByType: byType, rulingSources, providers: h.providers },
      };
    }
    case "mcp_enumerate": {
      const { enumerateRulings } = await import("../../lib/mcp/tools/rulings");
      const r = await enumerateRulings([query], undefined, undefined, false, 10);
      return { total: r.total, ids: ("results" in r ? r.results : []).map((x) => x.ruling_id) };
    }
    case "web_comprehensive": {
      const { searchLegalCoreComprehensive } = await import("../../lib/modules/legal-core/comprehensive-search");
      const r = await searchLegalCoreComprehensive(query, 30);
      const ids = r.results.filter((x) => x.type === "ruling").map((x) => x.id);
      return { total: ids.length, ids: ids.slice(0, 10) };
    }
    case "web_judgments": {
      // نسخة من استعلام app/dashboard/legal-core/judgments/page.tsx (ILIKE + ترتيب بالتاريخ + تعزيز العنوان).
      const like = `%${query}%`;
      const where = `("judgmentTitle" ILIKE $1 OR "judgmentText" ILIKE $1 OR "appealText" ILIKE $1 OR "caseNo" ILIKE $1 OR "decisionNo" ILIKE $1)`;
      const [{ n }] = await q<{ n: bigint }>(`SELECT count(*)::bigint AS n FROM judicial_cases WHERE ${where}`, like);
      const pool = await q<{ id: string; t: boolean }>(
        `SELECT id, coalesce("judgmentTitle",'') ILIKE $1 AS t FROM judicial_cases WHERE ${where}
          ORDER BY "decisionDate" DESC NULLS LAST, "createdAt" DESC LIMIT 480`, like,
      );
      const ranked = [...pool.filter((x) => x.t), ...pool.filter((x) => !x.t)];
      return { total: Number(n), ids: ranked.slice(0, 10).map((x) => x.id) };
    }
    case "rulings_direct": {
      const { searchRulingsDirect } = await import("../../lib/modules/legal-core/rulings-search");
      const r = await searchRulingsDirect({ query, limit: 10 });
      return { total: r.total, ids: r.hits.map((h) => h.id) };
    }
  }
}

async function golden(lexRows?: { lex: Lexicon; rows: SampleRow[] }) {
  const { queries } = JSON.parse(readFileSync(GOLDEN_FILE, "utf8")) as { queries: string[] };
  const paths = (flag("paths")?.split(",") as PathName[] | undefined) ?? ALL_PATHS;
  const inv = load<{ rows: number }>("inventory.json") ?? (await inventory());
  let ctx = lexRows;
  if (!ctx) {
    const s = await sample();
    const rows = await loadSampleRows(s.ids);
    ctx = { lex: (await buildLexicon(rows.map((r) => r.judgmentText))).lex, rows };
  }
  const sampleSearch = ctx.rows.map((r) => simulatedSearchText(simulateClean(ctx!.lex, r.judgmentText).text));
  const results: Array<Record<string, unknown>> = [];
  for (const query of queries) {
    const inSample = sampleSearch.filter((t) => containsWholeWord(t, query)).length;
    const estTrue = Math.round((inSample / sampleSearch.length) * inv.rows);
    const row: Record<string, unknown> = { query, sampleHits: inSample, estimatedTrueTotal: estTrue };
    for (const p of paths) {
      const t0 = Date.now();
      try {
        const r = await runPath(p, query);
        const ms = Date.now() - t0;
        const texts = r.ids.length
          ? await q<{ id: string; ref: string; t: string }>(
              `SELECT id, coalesce("decisionNo","caseNo",id) AS ref, coalesce("judgmentTitle",'') || ' ' || "judgmentText" AS t
                 FROM judicial_cases WHERE id = ANY($1::text[])`, r.ids)
          : [];
        let whole = 0;
        const falsePositives: string[] = [];
        for (const x of texts) {
          const st = simulatedSearchText(simulateClean(ctx.lex, x.t).text);
          if (containsWholeWord(st, query)) whole++;
          else if (st.includes(keyForm(query))) {
            // يحتوي اللفظ جزءًا من كلمة أطول: مطابقة زائفة حرفية.
            const k = keyForm(query);
            const i = st.indexOf(k);
            const a = st.lastIndexOf(" ", i) + 1;
            const b = st.indexOf(" ", i + k.length);
            falsePositives.push(`${x.ref}: «${st.slice(a, b < 0 ? undefined : b)}»`);
          }
        }
        row[p] = {
          total: r.total, returned: r.ids.length, ms,
          precisionAt10: r.ids.length ? Math.round((whole / r.ids.length) * 100) / 100 : null,
          falsePositives,
          recallApprox: r.total !== null && estTrue ? Math.round((Math.min(r.total, estTrue) / estTrue) * 100) / 100 : null,
          ...(r.diag ? { diag: r.diag } : {}),
        };
      } catch (e) {
        row[p] = { error: (e as Error).message.slice(0, 200), ms: Date.now() - t0 };
      }
    }
    results.push(row);
    console.log(`• ${query}`);
  }
  save("golden-results.json", { measuredAt: new Date().toISOString(), paths, results });
  return results;
}

// ── التشغيل ──

async function main() {
  const how = await assertReadOnly();
  console.log(`🔒 قراءة فقط: ${how}`);
  if (step === "inventory" || step === "all") await inventory();
  if (step === "sample" || step === "all") await sample();
  let ctx: { lex: Lexicon; rows: SampleRow[] } | undefined;
  if (step === "quality" || step === "all") {
    const r = await quality();
    ctx = { lex: r.lex, rows: r.rows };
  }
  if (step === "full" || step === "all") await full();
  if (step === "metadata" || step === "all") await metadata(ctx?.rows);
  if (step === "golden" || step === "all") await golden(ctx);
}

main()
  .catch((e) => {
    console.error("فشل:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
