// ─────────────────────────────────────────────────────────────────────────────
// تشخيص §7 — لماذا بقيت ARBITRATION_PACK بحالة PENDING؟ (قراءةٌ فقط، لا كتابة)
// يبحث في النواة عن كلّ نظامٍ يتّصل بالتحكيم، ويطبع: الاسم، عدد المواد، وحالاتها
// المميّزة، ووجود تاريخ سريان — كي نعرف الاسم/الحالة الفعليّين ونصحّح المطابقة.
//   npx tsx scripts/diagnose-arbitration.ts
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

const TERMS = ["تحكيم", "التحكيم", "نظام التحكيم"];

async function main() {
  console.log("تشخيص أنظمة التحكيم في النواة\n");

  const seen = new Set<string>();
  for (const term of TERMS) {
    const systems = await prisma.legalSystem.findMany({
      where: { name: { contains: term } },
      select: { id: true, name: true, articleCount: true },
      take: 20,
    });
    for (const s of systems) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);

      // حالات المواد المميّزة لهذا النظام + عيّنة تواريخ سريان.
      const arts = await prisma.legalArticle.findMany({
        where: { lawName: s.name },
        select: { status: true, effectiveFrom: true },
        take: 500,
      });
      const statusCounts = new Map<string, number>();
      let withDate = 0;
      let earliest: string | null = null;
      for (const a of arts) {
        const st = a.status ?? "(null)";
        statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1);
        if (a.effectiveFrom) {
          withDate += 1;
          const iso = a.effectiveFrom.toISOString().slice(0, 10);
          if (!earliest || iso < earliest) earliest = iso;
        }
      }
      const statusStr = Array.from(statusCounts.entries())
        .map(([k, v]) => `${k}:${v}`)
        .join(" · ");
      console.log(`— «${s.name}»`);
      console.log(`   id=${s.id}  articleCount=${s.articleCount}  مواد مُستعلَمة=${arts.length}`);
      console.log(`   الحالات: ${statusStr || "(لا مواد بهذا lawName)"}`);
      console.log(`   مواد بتاريخ سريان=${withDate}  أقدم=${earliest ?? "—"}\n`);
    }
  }

  if (seen.size === 0) console.log("لم يُعثر على أيّ نظامٍ يطابق مصطلحات التحكيم.");
  else console.log(`إجماليّ الأنظمة المطابِقة: ${seen.size}`);

  await prisma.$disconnect();
}

void main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
