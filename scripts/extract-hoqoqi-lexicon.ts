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
// أعمدة مرشّحة للكلمة السطحية والجذر/اللمّة
const WORD_KEYS = ["word", "name", "text", "title", "value", "noun", "verb", "lemma", "term", "surface", "form"];
const ROOT_KEYS = ["root", "base", "stem", "lemma", "asl", "masdar", "origin", "root_word"];

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

  // اختيار عمودي الكلمة والجذر بأفضل تطابق
  const cols = nouns.length ? Object.keys(nouns[0]).map((c) => c.toLowerCase()) : [];
  const wordKey = WORD_KEYS.find((k) => cols.includes(k));
  const rootKey = ROOT_KEYS.find((k) => cols.includes(k));
  const pickCol = (r: SqlRow, key: string | undefined) => key ? sv(r[Object.keys(r).find((c) => c.toLowerCase() === key) ?? ""]) : "";

  const build = (rows: SqlRow[]) => {
    const byRoot = new Map<string, Set<string>>();
    const flat: string[] = [];
    for (const r of rows) {
      const w = pickCol(r, wordKey) || sv(Object.values(r).find((v) => isAr(sv(v))));
      if (!w || !isAr(w)) continue;
      flat.push(w);
      const root = pickCol(r, rootKey);
      if (root && isAr(root)) { if (!byRoot.has(root)) byRoot.set(root, new Set()); byRoot.get(root)!.add(w); }
    }
    return { count: flat.length, groups: [...byRoot.entries()].map(([root, set]) => ({ root, forms: [...set] })) };
  };

  const out = {
    generatedFrom: "hoqoqi.sql (nouns/verbs)",
    schema: { nounsColumns: nouns.length ? Object.keys(nouns[0]) : [], verbsColumns: verbs.length ? Object.keys(verbs[0]) : [], wordKey: wordKey ?? null, rootKey: rootKey ?? null },
    nouns: build(nouns),
    verbs: build(verbs),
  };
  const dir = path.resolve("data");
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "hoqoqi-lexicon.json");
  await fs.writeFile(target, JSON.stringify(out, null, 0), "utf8");
  console.log(`\n✔ كُتب ${target} · جذور(nouns)=${out.nouns.groups.length} · جذور(verbs)=${out.verbs.groups.length} · wordKey=${wordKey} · rootKey=${rootKey}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
