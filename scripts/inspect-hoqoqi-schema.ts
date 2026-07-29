// مُفتّش بنية hoqoqi: يطبع أسماء أعمدة كلّ جدول من CREATE TABLE، ويُبرز الجداول/الأعمدة المرشّحة
// للديباجة/المرسوم — كي نضبط المستورد على البنية الحقيقيّة بلا تخمين. لا قاعدة بيانات، قراءة فقط.
//   npx tsx scripts/inspect-hoqoqi-schema.ts [ملف hoqoqi.sql(.zip)]
import path from "node:path";
import { readSqlFromZip, parseSqlInserts } from "./import-hoqoqi-sql";

async function main() {
  const file = path.resolve(process.argv[2] || "hoqoqi.sql.zip");
  const sql = await readSqlFromZip(file);

  // ① أعمدة كلّ جدول من CREATE TABLE.
  const createRe = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\(([\s\S]*?)\)\s*(?:ENGINE|;)/gi;
  const tables: Array<{ name: string; cols: string[] }> = [];
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql))) {
    const cols: string[] = [];
    for (const line of m[2].split("\n")) {
      if (/^\s*(PRIMARY|UNIQUE|KEY|CONSTRAINT|INDEX|FULLTEXT|FOREIGN)/i.test(line)) continue;
      const cm = line.match(/^\s*`([A-Za-z0-9_]+)`/);
      if (cm) cols.push(cm[1]);
    }
    tables.push({ name: m[1], cols });
  }

  // عدد صفوف الإدخال لكلّ جدول.
  const inserts = new Map<string, number>();
  for (const im of sql.matchAll(/INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/gi)) {
    inserts.set(im[1], (inserts.get(im[1]) ?? 0) + 1);
  }

  console.log(`عدد الجداول: ${tables.length}\n`);
  console.log("=== كلّ الجداول وأعمدتها (وعدد عبارات الإدخال) ===");
  for (const t of tables) console.log(`\n• ${t.name}  [inserts=${inserts.get(t.name) ?? 0}]\n   ${t.cols.join(", ")}`);

  // ② مرشّحات الديباجة/المرسوم بالاسم أو بعمود.
  const kw = /preamble|preface|dibaj|decree|issuan|tool|amend|note|intro|header|mokad|mokaddima|mo2adima|deباجة/i;
  console.log("\n=== جداول/أعمدة مرشّحة (ديباجة/مرسوم/تعديل) ===");
  for (const t of tables) {
    const hit = t.cols.filter((c) => kw.test(c));
    if (kw.test(t.name) || hit.length) console.log(`• ${t.name} → ${hit.length ? hit.join(", ") : "(بالاسم)"}`);
  }

  // ③ عيّنة صفٍّ من الجداول المفتاحيّة (قيم مقتطعة) — لرؤية البيانات الفعليّة.
  const parsed = parseSqlInserts(sql);
  const sampleTables = ["laws", "laws_lang", "lang_laws", "tools_issuance_law", "amendment_articles_law"];
  console.log("\n=== عيّنة صفٍّ من الجداول المفتاحيّة ===");
  for (const t of sampleTables) {
    const rows = parsed.tables.get(t) ?? [];
    console.log(`\n• ${t} · صفوف مُحلَّلة=${rows.length}`);
    if (!rows.length) continue;
    const sample = Object.fromEntries(
      Object.entries(rows[0]).map(([k, v]) => [k, String(v ?? "").slice(0, 90)])
    );
    console.log(JSON.stringify(sample, null, 1));
  }
}

void main().catch((e) => { console.error(e); process.exit(1); });
