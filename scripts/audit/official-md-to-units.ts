/**
 * HKM-028: يحوّل نصًّا رسميًّا مجلوبًا بصيغة Markdown (رأس YAML بالمصدر ثم المواد «المادة …:») إلى
 * law.jsonl وunit.jsonl بصيغة لقطة الهيئة، لتقارنه scripts/audit/compare-with-boe.py بقاعدتنا.
 * الرقم ودرجة «مكرر» من العنوان (titleOrdinal). النص يُحفظ كما ورد.
 *   npx tsx scripts/audit/official-md-to-units.ts <out-dir> <ملف.md> [...]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { titleOrdinal } from "../../lib/modules/legal-core/numbering-audit";

const [outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) throw new Error("usage: official-md-to-units.ts <out-dir> <file.md> ...");
mkdirSync(outDir, { recursive: true });
const laws: string[] = [];
const units: string[] = [];
const HEADING = /^(?:المادة|مادة)\s+[^\n]{1,60}?:?\s*$/;

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const head = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (k: string) => head.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? null;
  const name = field("العنوان")?.replace(/\s*\(.*$/, "") ?? file;
  const id = `official-${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
  laws.push(JSON.stringify({ id, name, url: field("الرابط") ?? field("رابط النص") ?? field("رابط القواعد"), source: field("المصدر"), status_at_source: field("الحالة"), issued_hijri: field("تاريخ الإصدار") ?? field("تاريخ النشر") }));
  const body = raw.slice(raw.indexOf("\n---", 3) + 4).split("\n");
  let cur: { heading: string; lines: string[] } | null = null;
  let seq = 0;
  const flush = () => {
    if (!cur) return;
    const o = titleOrdinal(cur.heading);
    units.push(JSON.stringify({ law_id: id, seq: ++seq, heading: cur.heading, article_number: o?.number ?? null, is_bis: (o?.bis ?? 0) > 0, body: cur.lines.join("\n").trim() }));
  };
  for (const line of body) {
    if (HEADING.test(line.trim()) && titleOrdinal(line.trim())) {
      flush();
      cur = { heading: line.trim(), lines: [] };
    } else if (cur) cur.lines.push(line);
  }
  flush();
  console.log(`${name}: ${seq} مادة`);
}
writeFileSync(`${outDir}/law.jsonl`, laws.join("\n") + "\n");
writeFileSync(`${outDir}/unit.jsonl`, units.join("\n") + "\n");
