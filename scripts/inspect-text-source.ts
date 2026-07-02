/**
 * inspect-text-source.ts — كشف قرائي للحالات المُعلَّمة (كلمات ملتصقة/مقاطع طويلة) في الأحكام:
 * يُخرج لكل حكم مُعلَّم: المعرّف · المصدر (source) · **رابط المصدر الأصلي (sourceLink)** ·
 * والتوكنات الملتصقة مع نافذة سياق واسعة — لتحديد الحدود الآمنة والرجوع للمصدر عند الالتباس.
 *
 * قراءة فقط. التشغيل: npm run inspect:text-source   (متغيّر TS_LIMIT=40 · TS_GLUE=28)
 */
import { prisma } from "@/lib/prisma";

const LIMIT = Number(process.env.TS_LIMIT || 40);
const GLUE = Number(process.env.TS_GLUE || 28);

function longTokens(s: string): Array<{ tok: string; idx: number }> {
  const out: Array<{ tok: string; idx: number }> = [];
  for (const tok of s.split(/\s+/)) {
    if (tok.length > GLUE) out.push({ tok, idx: s.indexOf(tok) });
  }
  return out;
}
function ctx(s: string, idx: number, tok: string): string {
  const start = Math.max(0, idx - 30);
  const end = Math.min(s.length, idx + tok.length + 30);
  return s.slice(start, end).replace(/\n/g, "⏎");
}

async function main() {
  console.log("=".repeat(80));
  console.log("كشف مصادر الحالات المُعلَّمة في الأحكام (sourceLink + سياق) - قراءة فقط");
  console.log("=".repeat(80));

  let cursor = "";
  let shown = 0;
  const sourceLinkPresent = { yes: 0, no: 0 };
  const hosts = new Map<string, number>();

  outer: for (;;) {
    const rows = await prisma.judicialCase.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, source: true, sourceLink: true, judgmentText: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) {
      const t = r.judgmentText ?? "";
      const toks = longTokens(t);
      if (!toks.length) continue;
      // إحصاء توفّر رابط المصدر عبر كل المُعلَّمين
      if (r.sourceLink) {
        sourceLinkPresent.yes += 1;
        try { const h = new URL(r.sourceLink).hostname; hosts.set(h, (hosts.get(h) ?? 0) + 1); } catch { /* */ }
      } else sourceLinkPresent.no += 1;

      if (shown < LIMIT) {
        shown += 1;
        console.log(`\n[${shown}] id=${r.id} · source=${r.source} · sourceLink=${r.sourceLink ?? "—"}`);
        for (const x of toks.slice(0, 2)) console.log(`     «…${ctx(t, x.idx, x.tok)}…»`);
      }
      if (shown >= LIMIT && sourceLinkPresent.yes + sourceLinkPresent.no >= 4000) break outer;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`توفّر رابط المصدر عبر المُعلَّمين: sourceLink موجود ${sourceLinkPresent.yes} · غائب ${sourceLinkPresent.no}`);
  console.log("مضيفو الروابط (host → عدد):");
  for (const [h, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`   ${h}  ${n}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("x فشل كشف المصادر:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
