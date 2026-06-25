/**
 * backfill-eli-slugs.ts — ملء eli_slug مرة واحدة ثم تجميده (المرحلة ٣).
 *
 * - يحسب slug من اسم النظام عبر lawSlug ويكتبه في eliSlug **فقط حيث القيمة null**
 *   (لا يلمس قيمة موجودة — التجميد يحفظ ثبات المعرّف رغم تغيّر الاسم).
 * - يكشف التصادمات (نظامان يولّدان slug واحدًا) ويعرضها بلا كتابة لها (يحلّها بشريًّا).
 * - idempotent: إعادة التشغيل لا تغيّر شيئًا بعد الملء.
 *
 * تشغيل التجربة (افتراضي، لا كتابة):  npm run backfill:eli-slugs
 * التطبيق الفعلي:                      npm run backfill:eli-slugs -- --apply
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { lawSlug } from "@/lib/modules/legal-core/eli";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)} — وضع: ${APPLY ? "تطبيق" : "تجربة"}`);
  console.log("=".repeat(64));

  const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true, eliSlug: true } });
  console.log(`الأنظمة: ${systems.length}`);

  // كشف التصادمات على مستوى الـslug المحسوب (لكل النظام، بصرف النظر عن الملء).
  const slugToNames = new Map<string, string[]>();
  for (const s of systems) {
    const slug = lawSlug(s.name);
    const arr = slugToNames.get(slug) ?? [];
    arr.push(s.name);
    slugToNames.set(slug, arr);
  }
  const collisions = [...slugToNames.entries()].filter(([, names]) => names.length > 1);
  if (collisions.length) {
    console.log(`\n🔴 تصادمات slug (${collisions.length}) — لن تُكتب، حلّها يدويًّا:`);
    for (const [slug, names] of collisions) console.log(`   • «${slug}» ← ${names.join(" | ")}`);
  } else {
    console.log("✅ لا تصادمات slug.");
  }

  const collidingSlugs = new Set(collisions.map(([slug]) => slug));
  const toFill = systems.filter((s) => !s.eliSlug && !collidingSlugs.has(lawSlug(s.name)));
  const alreadyFrozen = systems.filter((s) => !!s.eliSlug).length;
  console.log(`\nمملوء سلفًا (مُجمّد): ${alreadyFrozen}`);
  console.log(`سيُملأ الآن:          ${toFill.length}`);
  console.log(`مُتخطّى للتصادم:       ${systems.filter((s) => !s.eliSlug && collidingSlugs.has(lawSlug(s.name))).length}`);

  if (APPLY && toFill.length) {
    let written = 0;
    for (const s of toFill) {
      await prisma.legalSystem.update({ where: { id: s.id }, data: { eliSlug: lawSlug(s.name) } });
      written += 1;
    }
    console.log(`\n✅ كُتب ${written} eli_slug (مُجمّدة الآن).`);
  } else if (!APPLY) {
    console.log("\n(تجربة فقط — أضف --apply للكتابة.)");
  }

  const covered = await prisma.legalSystem.count({ where: { eliSlug: { not: null } } });
  console.log(`\nتغطية eli_slug النهائية: ${covered}/${systems.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
