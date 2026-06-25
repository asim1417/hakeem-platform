/**
 * relink-orphan-articles.ts — المرحلة ٤: ربط المواد اليتيمة (جذر الاختفاء).
 *
 * يجد المواد ذات legalSystemId = null ويربطها بنظامها عبر مطابقة
 * lawName = legal_systems.name. **تحديث فقط** — لا حذف ولا إنشاء أنظمة.
 *
 * معاينة افتراضيًا. للكتابة: --apply
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log(APPLY ? "الوضع: تطبيق فعلي (--apply)" : "الوضع: معاينة فقط (dry-run)");

  const before = await prisma.legalArticle.count({ where: { legalSystemId: null } }).catch(() => 0);
  console.log(`مواد يتيمة قبل: ${before}`);
  if (before === 0) {
    console.log("لا مواد يتيمة. لا شيء للربط.");
    return;
  }

  const orphanByLaw = await prisma.legalArticle
    .groupBy({ by: ["lawName"], where: { legalSystemId: null }, _count: { _all: true } })
    .catch(() => [] as { lawName: string; _count: { _all: number } }[]);

  let linked = 0;
  const noSystem: { lawName: string; count: number }[] = [];

  for (const o of orphanByLaw) {
    const system = await prisma.legalSystem.findUnique({ where: { name: o.lawName }, select: { id: true } }).catch(() => null);
    if (!system) {
      noSystem.push({ lawName: o.lawName, count: o._count._all });
      continue;
    }
    if (APPLY) {
      const res = await prisma.legalArticle.updateMany({
        where: { legalSystemId: null, lawName: o.lawName },
        data: { legalSystemId: system.id }
      });
      linked += res.count;
    } else {
      linked += o._count._all;
    }
  }

  const remaining = APPLY ? await prisma.legalArticle.count({ where: { legalSystemId: null } }).catch(() => -1) : before - linked;
  console.log(`\nالنتيجة: ${APPLY ? "رُبط" : "سيُربط"} ${linked} مادة، يبقى يتيمًا ${remaining}`);
  if (noSystem.length) {
    console.log("أسماء أنظمة يتيمة بلا نظام مطابق (تحتاج قرارك بإضافتها):");
    noSystem.sort((a, b) => b.count - a.count).slice(0, 30).forEach((o) => console.log(`   • ${o.lawName} (${o.count} مادة)`));
  }
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
