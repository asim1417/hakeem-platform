/**
 * HKM-028: يبني خطة تصحيح ترقيم نظام من عناوين مواده الرسمية (لا من التسلسل).
 *   المدخل: rows.json = { lawName, rows: [[id, الرقم الحالي, العنوان], ...] } (من قراءة READ ONLY).
 *   المخرج: plan.json (الرقم الرسمي ودرجة «مكرر» لكل صف) و apply.sql (بيانات مُحصَّنة بالحراس).
 * يرفض: عنوانًا لا يُقرأ، أو رقمًا رسميًّا مكررًا. لا يمس النص ولا العنوان؛ الرقم و«مكرر» فقط.
 *   npx tsx scripts/backfill/plan-article-renumber.ts data/renumber/<dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { titleOrdinal } from "../../lib/modules/legal-core/numbering-audit";

const dir = process.argv[2];
if (!dir) throw new Error("usage: plan-article-renumber.ts <dir>");
const input = JSON.parse(readFileSync(path.join(dir, "rows.json"), "utf8")) as { lawName: string; rows: Array<[string, number, string]> };
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const plan = input.rows.map(([id, current, title]) => {
  const o = titleOrdinal(title);
  if (!o) throw new Error(`عنوان لا يُقرأ: ${current} «${title}»`);
  return { id, current, title, number: o.number, bis: o.bis };
});
const keys = new Set<string>();
for (const p of plan) {
  const k = `${p.number}/${p.bis}`;
  if (keys.has(k)) throw new Error(`رقم رسمي مكرر: ${k}`);
  keys.add(k);
}
const changes = plan.filter((p) => p.number !== p.current || p.bis > 0);
const OFFSET = 100000;
const values = plan.map((p) => `(${q(p.id)}, ${p.current}, ${p.number}, ${p.bis})`).join(",\n  ");
const law = q(input.lawName);

// كل جملة مستقلة لتُرسَل في معاملة واحدة؛ الحارس يقسم على صفر فيُلغي المعاملة كلها.
const statements = [
  `CREATE TEMP TABLE renumber_plan (id text PRIMARY KEY, current_number int, new_number int, new_bis int) ON COMMIT DROP`,
  `INSERT INTO renumber_plan VALUES\n  ${values}`,
  `SELECT 1 / (CASE WHEN (SELECT count(*) FROM legal_articles WHERE "lawName" = ${law}) = ${plan.length} THEN 1 ELSE 0 END) AS guard_count`,
  `SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM renumber_plan p LEFT JOIN legal_articles a ON a.id = p.id AND a."lawName" = ${law} AND a."articleNumber" = p.current_number AND a."articleBis" = 0 WHERE a.id IS NULL) THEN 1 ELSE 0 END) AS guard_rows`,
  `UPDATE legal_articles a SET "articleNumber" = a."articleNumber" + ${OFFSET} FROM renumber_plan p WHERE a.id = p.id AND (p.new_number <> p.current_number OR p.new_bis <> 0)`,
  `UPDATE legal_articles a SET "articleNumber" = p.new_number, "articleBis" = p.new_bis FROM renumber_plan p WHERE a.id = p.id AND a."articleNumber" >= ${OFFSET}`,
  `SELECT 1 / (CASE WHEN NOT EXISTS (SELECT 1 FROM renumber_plan p JOIN legal_articles a ON a.id = p.id WHERE a."articleNumber" <> p.new_number OR a."articleBis" <> p.new_bis) THEN 1 ELSE 0 END) AS guard_after`,
];

writeFileSync(path.join(dir, "plan.json"), JSON.stringify({ lawName: input.lawName, articles: plan.length, changes: changes.length, plan }, null, 2) + "\n");
writeFileSync(path.join(dir, "statements.json"), JSON.stringify(statements, null, 2) + "\n");
writeFileSync(path.join(dir, "apply.sql"), `-- ${input.lawName}: ${changes.length} من ${plan.length} صفًّا. يُطبَّق في معاملة واحدة بعد هجرة articleBis.\nBEGIN;\n${statements.join(";\n\n")};\nCOMMIT;\n`);
console.log(`${input.lawName}: ${plan.length} صفًّا، يتغير ${changes.length}`);
for (const c of changes) console.log(`  ${c.current} → ${c.number}${c.bis ? ` مكرر${c.bis > 1 ? c.bis : ""}` : ""}  «${c.title}»`);
