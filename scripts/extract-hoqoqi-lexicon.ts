/**
 * extract-hoqoqi-lexicon.ts — يستخرج المعجم القانوني (nouns/verbs) من المصدر hoqoqi.sql
 * لتغذية تطبيع/توسيع البحث. قراءة فقط للمصدر؛ المخرج ملفّ JSON في المستودع (لا قاعدة بيانات).
 *
 * وضعان:
 *   LEXICON_MODE=discover → يطبع أعمدة nouns/verbs وعيّنات وإحصاءات (لاكتشاف البنية).
 *   (افتراضي) export     → يكتب data/hoqoqi-lexicon.json بخريطة جذر→مشتقّات (بأفضل تخمين للأعمدة).
 * التشغيل: tsx scripts/extract-hoqoqi-lexicon.ts --file=hoqoqi.sql
 */
import fs from "node:fs/promises";
import path from "node:path";

type SqlRow = Record<string, string | number | null>;
const wantTables = ["nouns", "verbs"];

function unesc(c: string) { return ({ n: "\n", r: "\r", t: "\t", "0": "\0" } as Record<string, string>)[c] ?? c; }
function coerce(v: string): string | number | null { const t = v.trim(); if (!t || /^null$/i.test(t)) return null; if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t); return t; }
function parseValues(sql: string) {
  const rows: Array<Array<string | number | null>> = [];
  let row: Array<string | number | null> = [], val = "", inStr = false, esc = false, inRow = false;
  for (let i = 0; i < sql.length; i++) { const c = sql[i];
    if (inStr) { if (esc) { val += unesc(c); esc = false; } else if (c === "\\") esc = true; else if (c === "'") inStr = false; else val += c; continue; }
    if (c === "'") { inStr = true; continue; }
    if (c === "(" && !inRow) { inRow = true; row = []; val = ""; continue; }
    if (c === "," && inRow) { row.push(coerce(val)); val = ""; continue; }
    if (c === ")" && inRow) { row.push(coerce(val)); rows.push(row); row = []; val = ""; inRow = false; continue; }
    if (inRow) val += c;
  }
  return rows;
}
function parse(sql: string) {
  const tables = new Map<string, SqlRow[]>();
  const re = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) { const t = m[1]; if (!wantTables.includes(t)) continue;
    const cols = m[2]?.split(",").map((c) => c.replace(/[`"' ]/g, "").trim()) ?? [];
    const rows = parseValues(m[3]).map((vals) => { const o: SqlRow = {}; vals.forEach((v, i) => (o[cols[i] || `c${i}`] = v)); return o; });
    tables.set(t, [...(tables.get(t) ?? []), ...rows]);
  }
  return tables;
}
const sv = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const isAr = (s: string) => /[ء-ي]/.test(s);
// أعمدة الصيغ السطحية النظيفة (نتجنّب «normalized» لأنه يستبدل الهمزات بـ«ء»).
const FORM_COLS = [
  "unvocalized", "single", "broken_plural",
  "feminin", "masculin", "masculin_plural", "feminin_plural",
  "past", "future", "imperative", "passive",
];
const ROOT_COLS = ["root", "stamped"];
const lc = (r: SqlRow) => new Map(Object.entries(r).map(([k, v]) => [k.toLowerCase(), sv(v)]));
// تنقية الصيغة: إزالة التشكيل/التطويل (بعض الأعمدة مشكولة) — لتطابق نصّ البحث الفعليّ.
const cleanForm = (s: string) => s.replace(/[ً-ْٰـ]/g, "").trim();

async function main() {
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7) || process.env.HOQOQI_FILE || "hoqoqi.sql";
  const mode = process.env.LEXICON_MODE || "export";
  const buf = await fs.readFile(path.resolve(file));
  const tables = parse(buf.toString("utf8"));
  const nouns = tables.get("nouns") ?? [];
  const verbs = tables.get("verbs") ?? [];
  console.log(`nouns=${nouns.length} · verbs=${verbs.length}`);

  const dumpSchema = (name: string, rows: SqlRow[]) => {
    if (!rows.length) { console.log(`${name}: (فارغ)`); return; }
    console.log(`\n${name} أعمدة: ${Object.keys(rows[0]).join(", ")}`);
    for (const r of rows.slice(0, 6)) console.log(`  ${Object.entries(r).map(([k, v]) => `${k}=${sv(v).slice(0, 40) || "∅"}`).join(" · ")}`);
  };
  dumpSchema("nouns", nouns);
  dumpSchema("verbs", verbs);

  if (mode === "discover") { console.log("\n(وضع الاكتشاف: لم يُكتب ملف)"); return; }

  // تجميع كل الصيغ السطحية تحت جذرها (nouns + verbs معًا).
  const byRoot = new Map<string, Set<string>>();
  let forms = 0;
  const ingest = (rows: SqlRow[]) => {
    for (const r of rows) {
      const m = lc(r);
      const root = ROOT_COLS.map((c) => m.get(c) || "").find((v) => v && isAr(v));
      if (!root) continue;
      const set = byRoot.get(root) ?? new Set<string>();
      for (const col of FORM_COLS) {
        const val = cleanForm(m.get(col) || "");
        if (val && isAr(val) && val.length >= 2) { set.add(val); }
      }
      if (set.size) { byRoot.set(root, set); forms += set.size; }
    }
  };
  ingest(nouns); ingest(verbs);

  // أبقِ الجذور ذات ≥2 صيغة (التوسيع مفيد فقط حين توجد صيغ شقيقة).
  const roots: Record<string, string[]> = {};
  let kept = 0;
  for (const [root, set] of byRoot) {
    if (set.size >= 2) { roots[root] = [...set].sort(); kept++; }
  }
  const out = {
    generatedFrom: "hoqoqi.sql · جداول nouns/verbs (معجم صرفيّ عربيّ)",
    counts: { nouns: nouns.length, verbs: verbs.length, roots: kept, forms },
    note: "خريطة جذر→صيغ سطحية (مفرد/جمع/مذكّر/مؤنّث/أزمنة) لتوسيع البحث بالمرادفات الصرفية.",
    roots,
  };
  const dir = path.resolve("data");
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "hoqoqi-lexicon.json");
  await fs.writeFile(target, JSON.stringify(out), "utf8");
  const bytes = (await fs.stat(target)).size;
  console.log(`\n✔ كُتب ${target} · جذور=${kept} · صيغ=${forms} · الحجم=${(bytes / 1048576).toFixed(2)}MB`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
