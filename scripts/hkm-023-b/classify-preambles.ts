/**
 * HKM-023-B ب-٣ — تصنيف المقدمات القائمة (قراءة فقط).
 *
 * ثلاث طرق، والقرار واحد (classifyPreambleSignals) في كلها:
 *   --emit-sql [--chunk a:b]     يطبع استعلام SELECT الذي يستخرج الإشارات في القاعدة (لـ Neon run_sql أو psql).
 *                                مع --chunk يطبع نسخة تجمع الصفوف a..b سطورًا مضغوطة مع بصمتها md5 للتحقق من النقل.
 *   --signals <file>             يقرأ ناتج الاستعلام سطورًا «id|name_md5|domain|len|opening|recital|enacting|clause|
 *                                issuance|body|narrative|law_card_full»، ويأخذ الأسماء من لقطة الأنظمة في المستودع
 *                                ويتحقق منها ببصمة الاسم، ثم يكتب CSV والملخص في reports/.
 *   --database                   يقرأ legal_systems.preamble مباشرة من DATABASE_URL داخل معاملة READ ONLY ويستخرج
 *                                الإشارات بـ TS (لا يكتب في القاعدة شيئًا).
 *
 * لا كتابة على أي قاعدة. لا نص مقدمة في المخرجات (المعرّف والاسم والتصنيف والطول والأعداد فقط).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  buildPreambleSignalsSql,
  classifyAndOrder,
  completenessLabel,
  extractPreambleSignals,
  PREAMBLE_SECTORS,
  SIGNAL_NAMES,
  toPreambleCsv,
  type PreambleClassRow,
} from "../../lib/modules/legal-core/preamble-signals";
import { loadPg } from "./local-db";

const SNAPSHOT = "ingest/boe-corpus-2026-09-28/data/hakeem_systems_2026-10-16.json";
const EXTRA_NAMES = "reports/hkm-023-b-preamble-names-extra.json";
const OUT_CSV = "reports/hkm-023-b-preamble-classification.csv";
const OUT_SUMMARY = "reports/hkm-023-b-preamble-classification.summary.json";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

export const SIGNAL_LINE_COLUMNS = ["id", "name_md5", "domain", "len", ...SIGNAL_NAMES, "law_card_full"];

/** استعلام يجمع الصفوف a..b (بترتيب المعرّف) سطورًا مضغوطة، مع عددها وبصمتها. */
export function buildChunkSql(from: number, to: number): string {
  const inner = buildPreambleSignalsSql();
  const cols = SIGNAL_LINE_COLUMNS.map((c) => `q.${c}`).join(", ");
  return `WITH q AS (
${inner}
), n AS (SELECT concat_ws('|', ${cols}) AS line, row_number() OVER (ORDER BY q.id) AS rn FROM q)
SELECT count(*) AS lines, md5(string_agg(line, E'\\n' ORDER BY rn)) AS md5, (SELECT count(*) FROM q) AS total, string_agg(line, E'\\n' ORDER BY rn) AS body
FROM n WHERE rn BETWEEN ${from} AND ${to}`;
}

function loadNames(): Map<string, string> {
  const names = new Map<string, string>();
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as Array<{ id: string; name: string }>;
  for (const s of snap) names.set(s.id, s.name);
  if (fs.existsSync(EXTRA_NAMES)) {
    const extra = JSON.parse(fs.readFileSync(EXTRA_NAMES, "utf8")) as Array<{ id: string; name: string }>;
    for (const s of extra) names.set(s.id, s.name);
  }
  return names;
}

function fromSignalsFile(file: string): { rows: PreambleClassRow[]; unresolved: string[]; inputMd5: string } {
  const raw = fs.readFileSync(file, "utf8").replace(/\r/g, "");
  const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const names = loadNames();
  const unresolved: string[] = [];
  const rows = lines.map((line) => {
    const parts = line.split("|");
    if (parts.length !== SIGNAL_LINE_COLUMNS.length) throw new Error(`سطر بعدد أعمدة غير صحيح: ${line.slice(0, 60)}`);
    const [id, nameMd5, domain, len, ...rest] = parts;
    const signals = Object.fromEntries(SIGNAL_NAMES.map((k, i) => [k, Number(rest[i])])) as PreambleClassRow["signals"];
    const lawCardFull = rest[SIGNAL_NAMES.length] === "1";
    let name = names.get(id) ?? "";
    if (!name || md5(name).slice(0, 8) !== nameMd5) {
      unresolved.push(id);
      name = name ? `${name} (الاسم تغيّر بعد اللقطة)` : "(الاسم غير متوفر في لقطة المستودع)";
    }
    return { systemId: id, name, domain, length: Number(len), signals, lawCardFull };
  });
  return { rows, unresolved, inputMd5: md5(lines.join("\n")) };
}

async function fromDatabase(): Promise<PreambleClassRow[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير معرّف");
  const { Client } = await loadPg();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET TRANSACTION READ ONLY");
    const ro = await client.query("SELECT current_setting('transaction_read_only') AS ro");
    if (ro.rows[0]?.ro !== "on") throw new Error("المعاملة ليست للقراءة فقط؛ توقف");
    const res = await client.query(
      `SELECT s.id, s.name, s.domain, s.preamble,
              CASE WHEN EXISTS (
                SELECT 1 FROM (SELECT DISTINCT ON (system_id) system_id, text_blocks FROM law_card WHERE system_id = s.id ORDER BY system_id, created_at DESC, id DESC) c,
                       jsonb_array_elements(c.text_blocks) x
                WHERE x->>'kind' IN ('royal_decree','cabinet_decision','royal_order') AND (x->>'text') ~ '(بناء|الاطلاع)'
              ) THEN 1 ELSE 0 END AS law_card_full
         FROM legal_systems s WHERE s.preamble IS NOT NULL AND btrim(s.preamble) <> '' ORDER BY s.id`,
    );
    await client.query("ROLLBACK");
    const rows = res.rows as Array<{ id: string; name: string; domain: string | null; preamble: string; law_card_full: number }>;
    return rows.map((r) => ({
      systemId: r.id,
      name: r.name,
      domain: r.domain ?? "",
      length: r.preamble.length,
      signals: extractPreambleSignals(r.preamble),
      lawCardFull: Number(r.law_card_full) === 1,
    }));
  } finally {
    await client.end();
  }
}

function writeOutputs(rows: PreambleClassRow[], meta: Record<string, unknown>) {
  const ordered = classifyAndOrder(rows);
  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  const csv = toPreambleCsv(ordered);
  fs.writeFileSync(OUT_CSV, csv);
  const by = <K extends string>(f: (r: (typeof ordered)[number]) => K) =>
    ordered.reduce<Record<string, number>>((acc, r) => ((acc[f(r)] = (acc[f(r)] ?? 0) + 1), acc), {});
  const bySectorClass: Record<string, Record<string, number>> = {};
  for (const s of PREAMBLE_SECTORS) bySectorClass[s.label] = { كاملة: 0, جزئية: 0, "سطر إصدار فقط": 0 };
  for (const r of ordered) bySectorClass[r.sector.label][completenessLabel(r.completeness)]++;
  const summary = {
    task: "HKM-023-B ب-٣",
    generated_at: new Date().toISOString(),
    ...meta,
    total: ordered.length,
    by_class: by((r) => completenessLabel(r.completeness)),
    by_reason: by((r) => `${r.completeness}:${r.reason}`),
    by_sector: by((r) => r.sector.label),
    by_sector_class: bySectorClass,
    sector_source: by((r) => r.sector.source),
    body_leak: ordered.filter((r) => r.bodyLeak).length,
    law_card_full: ordered.filter((r) => r.lawCardFull).length,
    law_card_full_and_not_complete: ordered.filter((r) => r.lawCardFull && r.completeness !== "complete").length,
    length_buckets: {
      "lt200": ordered.filter((r) => r.length < 200).length,
      "200-999": ordered.filter((r) => r.length >= 200 && r.length < 1000).length,
      "1000-3000": ordered.filter((r) => r.length >= 1000 && r.length <= 3000).length,
      "gt3000": ordered.filter((r) => r.length > 3000).length,
    },
    csv: OUT_CSV,
    csv_md5: md5(csv),
  };
  const sum = Object.values(summary.by_class).reduce((a, b) => a + b, 0);
  if (sum !== ordered.length) throw new Error(`مجموع الأصناف ${sum} ≠ ${ordered.length}`);
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({ total: summary.total, by_class: summary.by_class, law_card_full: summary.law_card_full }, null, 2));
}

async function main() {
  if (process.argv.includes("--emit-sql")) {
    const chunk = arg("--chunk");
    if (chunk) {
      const [a, b] = chunk.split(":").map(Number);
      console.log(buildChunkSql(a, b));
    } else {
      console.log(buildPreambleSignalsSql());
    }
    return;
  }
  const file = arg("--signals");
  if (file) {
    const { rows, unresolved, inputMd5 } = fromSignalsFile(file);
    writeOutputs(rows, {
      source: `إشارات استخرجها SQL المولَّد (buildPreambleSignalsSql) على الإنتاج بقراءة فقط: ${file}`,
      input_md5: inputMd5,
      names_from: SNAPSHOT,
      unresolved_names: unresolved,
    });
    return;
  }
  if (process.argv.includes("--database")) {
    const rows = await fromDatabase();
    writeOutputs(rows, { source: "DATABASE_URL (معاملة READ ONLY)، الإشارات بـ TS" });
    return;
  }
  console.error("الاستعمال: --emit-sql [--chunk a:b] | --signals <file> | --database");
  process.exitCode = 2;
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("classify-preambles")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
