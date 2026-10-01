import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { displayedSystem, hiddenArticleIds } from "../lib/modules/legal-core/work-edition-read";

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

const cases = [
  { name: "نظام التنفيذ", today: "2026-09-25", later: "2026-10-29", todayStatus: "ساري", laterStatus: "ساري" },
  { name: "نظام السجل التجاري", today: "2024-07-07", later: "2026-09-25", todayStatus: "ساري", laterStatus: "ساري" },
  { name: "نظام الأسماء التجارية", today: "2024-07-07", later: "2026-09-25", todayStatus: "ساري", laterStatus: "ساري" },
];

async function articleOne(systemId: string) {
  return prisma.legalArticle.findFirst({
    where: { legalSystemId: systemId, articleNumber: 1 },
    select: { content: true, lawName: true },
  });
}

async function main() {
  let failed = 0;
  for (const c of cases) {
    const mixed = await prisma.legalSystem.findFirst({ where: { name: c.name }, select: { id: true } });
    if (!mixed) throw new Error("missing " + c.name);
    const early = await displayedSystem(mixed.id, new Date(`${c.today}T12:00:00Z`));
    const late = await displayedSystem(mixed.id, new Date(`${c.later}T12:00:00Z`));
    const a = await articleOne(early.id);
    const b = await articleOne(late.id);
    const distinct = md5(a?.content ?? "") !== md5(b?.content ?? "");
    const ok = early.redirected && late.redirected && early.status === c.todayStatus && late.status === c.laterStatus && distinct && Boolean(a && b);
    if (!ok) {
      failed += 1;
      console.error("✗", c.name, early, late, a?.lawName, b?.lawName);
    } else {
      console.log("✓", c.name, early.status, a?.lawName, "→", late.status, b?.lawName);
    }
    const mixedArticles = await prisma.legalArticle.findMany({
      where: { legalSystemId: mixed.id },
      select: { id: true },
    });
    const editionArticle = await prisma.legalArticle.findFirst({
      where: { legalSystemId: early.id, articleNumber: 1 },
      select: { id: true },
    });
    const hidden = await hiddenArticleIds([...mixedArticles.map((x) => x.id), editionArticle?.id ?? ""]);
    const mixedHidden = mixedArticles.every((x) => hidden.has(x.id));
    const editionVisible = editionArticle ? !hidden.has(editionArticle.id) : false;
    if (!mixedHidden || !editionVisible) {
      failed += 1;
      console.error("✗ إخفاء", c.name, "mixed", mixedHidden, "editionVisible", editionVisible);
    } else {
      console.log("✓ إخفاء السجل المخلوط", c.name, mixedArticles.length);
    }
  }
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main();
