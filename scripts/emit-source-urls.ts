/**
 * emit-source-urls.ts — يُخرج JSONL {id,url,glued} للأحكام ذات الالتصاق العربي↔العربي الحقيقي،
 * لتُمرَّر إلى مُصيّر المتصفّح (render-source.mjs) فيقرأ نصّها من المصدر الأصلي. قراءة فقط.
 * متغيّر: EMIT_N=3
 */
import { prisma } from "@/lib/prisma";

const N = Number(process.env.EMIT_N || 3);
const AR_LETTERS = /[ء-ؿف-يٮ-ۓەۮۯۺ-ۿ]/;
function longestRun(s: string): { len: number; tok: string } {
  let best = { len: 0, tok: "" };
  for (const tok of s.split(/\s+/)) {
    let cur = 0, m = 0;
    for (const ch of tok) { if (AR_LETTERS.test(ch)) { cur += 1; if (cur > m) m = cur; } else cur = 0; }
    if (m > best.len) best = { len: m, tok };
  }
  return best;
}

async function main() {
  let cursor = "";
  let emitted = 0;
  outer: for (;;) {
    const rows = await prisma.judicialCase.findMany({
      where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: 1000,
      select: { id: true, sourceLink: true, judgmentText: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) {
      const best = longestRun(r.judgmentText ?? "");
      if (best.len > 28 && r.sourceLink) {
        process.stdout.write(JSON.stringify({ id: r.id, url: r.sourceLink.replace("//Filter", "/Filter"), glued: best.tok.slice(0, 60) }) + "\n");
        emitted += 1;
        if (emitted >= N) break outer;
      }
    }
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
