/**
 * rebuild-export-numbering — يعيد اشتقاق article_number في data/legal_articles_export.json
 * من العنوان الرسمي لكل مادة (تحققًا مادةً بمادة) لنظامٍ محدَّد، حتى لا يعيد الـseed
 * إدخال الانزياح. لا يلمس النصّ، ولا يحذف مواد، ولا يخترع رقمًا لعنوان غير قابل للتحليل.
 *
 * الاستعمال:
 *   npx tsx scripts/backfill/rebuild-export-numbering.ts --system="نظام المعاملات المدنية"
 *   npx tsx scripts/backfill/rebuild-export-numbering.ts --system="..." --write
 *
 * افتراضيًّا dry-run (يطبع الفرق فقط). --write يحفظ الملف.
 */
import fs from "node:fs";
import { deriveOfficialNumber } from "../../lib/modules/legal-core/article-numbering";

const FILE = "data/legal_articles_export.json";
const WRITE = process.argv.includes("--write");
const systems = process.argv.filter((a) => a.startsWith("--system=")).map((a) => a.slice("--system=".length));
if (!systems.length) { console.error('مرّر --system="اسم النظام" (يمكن تكراره)'); process.exit(2); }

interface Row { article_number: number; law_name: string; title: string; content: string; keywords?: string[]; }

function main() {
  const data: Row[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let changed = 0, unparsed = 0;
  const gaps: Record<string, number[]> = {};

  for (const row of data) {
    if (!systems.includes(row.law_name)) continue;
    const d = deriveOfficialNumber(row.title);
    if (d.number === null) { unparsed++; continue; } // لا نخترع رقمًا — يبقى كما هو للمراجعة
    if (d.number !== row.article_number) { row.article_number = d.number; changed++; }
  }

  for (const law of systems) {
    const nums = data.filter((r) => r.law_name === law).map((r) => r.article_number).sort((a, b) => a - b);
    const max = nums[nums.length - 1] ?? 0;
    const present = new Set(nums);
    const g: number[] = [];
    for (let i = 1; i <= max; i++) if (!present.has(i)) g.push(i);
    gaps[law] = g;
    console.log(`${law}: مواد=${nums.length} max=${max} مُعاد ترقيمها=${changed} تعذّر=${unparsed} فجوات=[${g.join(",")}]`);
  }

  if (WRITE) {
    // نحافظ على نهايات الأسطر الأصلية (CRLF إن وُجدت) حتى يبقى الفرق مقتصرًا على
    // أرقام المواد المتغيّرة فقط، لا إعادة تنسيق الملف كاملًا.
    const original = fs.readFileSync(FILE, "utf8");
    const eol = original.includes("\r\n") ? "\r\n" : "\n";
    const trailing = original.endsWith("\r\n") ? "\r\n" : original.endsWith("\n") ? "\n" : "";
    const body = JSON.stringify(data, null, 2).replace(/\n/g, eol);
    fs.writeFileSync(FILE, body + trailing, "utf8");
    console.log(`✓ كُتب ${FILE} (أرقام مشتقّة من العناوين الرسمية).`);
    console.log("ℹ️  الفجوات أعلاه مواد مفقودة من المصدر — تُستكمل من المصدر الرسمي بمراجعة بشرية.");
  } else {
    console.log("ℹ️  DRY-RUN: لم يُكتب الملف. أضف --write للحفظ.");
  }
}

main();
