/**
 * fix-ithbat-classification.ts — يصحّح تصنيف «نظام الإثبات» ليطابق أشقّاءه القضائيين
 * (المصدر الرسمي: بوابة العدل = «القضاء»). يوائم القيمة مع «نظام المرافعات الشرعية»
 * (شقيق قضائي مؤكَّد) بدل تثبيت نصّ قد يخالف عُرف القاعدة.
 *
 * وضعان: بلا CONFIRM ⇒ جاف (يطبع الحالي فقط). مع CONFIRM=NEON_RUNTIME_CONFIRMED ⇒ يكتب.
 * يُشغَّل عبر workflow مُقفل على Neon. يُحدّث النظام + مواده (classification) + domain/domainTitle.
 */
import { prisma } from "@/lib/prisma";

const TARGET_SYSTEM = "نظام الإثبات";
const REFERENCE_SIBLING = "نظام المرافعات الشرعية"; // شقيق قضائي مؤكَّد — مصدر القيمة القانونية
const JUDICIAL_CORE = ["نظام المرافعات الشرعية", "نظام الأحوال الشخصية", "نظام الإجراءات الجزائية", "نظام المعاملات المدنية", "نظام الإثبات"];

const confirmed = process.env.CONFIRM_RUNTIME_DB_ALIGNMENT === "NEON_RUNTIME_CONFIRMED";

async function main() {
  console.log("═".repeat(92));
  console.log(`تصحيح تصنيف «${TARGET_SYSTEM}» — الوضع: ${confirmed ? "كتابة (مؤكَّد)" : "جاف (قراءة فقط)"}`);
  console.log("═".repeat(92));

  const systems = await prisma.legalSystem.findMany({
    where: { name: { in: JUDICIAL_CORE } },
    select: { id: true, name: true, classification: true, domain: true, domainTitle: true, articleCount: true },
  });
  console.log("\nالوضع الحالي للأنظمة القضائية الأساسية:");
  for (const s of systems) console.log(`   • «${s.name}» · تصنيف=${s.classification ?? "∅"} · مجال=${s.domain ?? "∅"} / ${s.domainTitle ?? "∅"} · مواد=${s.articleCount}`);

  const ithbat = systems.find((s) => s.name === TARGET_SYSTEM);
  const ref = systems.find((s) => s.name === REFERENCE_SIBLING);
  if (!ithbat) { console.error(`\n✗ لم يُعثر على «${TARGET_SYSTEM}».`); process.exit(1); }
  if (!ref) { console.error(`\n✗ لم يُعثر على المرجع «${REFERENCE_SIBLING}».`); process.exit(1); }

  const target = { classification: ref.classification, domain: ref.domain, domainTitle: ref.domainTitle };
  const changes: string[] = [];
  if (ithbat.classification !== target.classification) changes.push(`classification: «${ithbat.classification ?? "∅"}» → «${target.classification ?? "∅"}»`);
  if (ithbat.domain !== target.domain) changes.push(`domain: «${ithbat.domain ?? "∅"}» → «${target.domain ?? "∅"}»`);
  if (ithbat.domainTitle !== target.domainTitle) changes.push(`domainTitle: «${ithbat.domainTitle ?? "∅"}» → «${target.domainTitle ?? "∅"}»`);

  console.log(`\nالمرجع «${REFERENCE_SIBLING}»: تصنيف=${target.classification ?? "∅"} · مجال=${target.domain ?? "∅"} / ${target.domainTitle ?? "∅"}`);
  if (!changes.length) { console.log("\n✓ «نظام الإثبات» مطابق للمرجع أصلًا — لا تغيير مطلوب."); await prisma.$disconnect(); return; }
  console.log("\nالتغييرات المقترحة على «نظام الإثبات»:");
  for (const c of changes) console.log(`   ⚑ ${c}`);

  const artMismatch = await prisma.legalArticle.count({ where: { OR: [{ legalSystemId: ithbat.id }, { lawName: TARGET_SYSTEM }], NOT: { classification: target.classification } } });
  console.log(`   ⚑ مواد بتصنيف مخالف ستُوائَم: ${artMismatch}`);

  if (!confirmed) {
    console.log("\n(وضع جاف — لم يُكتب شيء. أعد التشغيل مع CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED للتنفيذ.)");
    await prisma.$disconnect();
    return;
  }

  // تنفيذ الكتابة
  await prisma.legalSystem.update({ where: { id: ithbat.id }, data: target });
  const upd = await prisma.legalArticle.updateMany({ where: { OR: [{ legalSystemId: ithbat.id }, { lawName: TARGET_SYSTEM }] }, data: { classification: target.classification } });
  console.log(`\n✓ حُدِّث النظام + ${upd.count} مادة.`);

  const after = await prisma.legalSystem.findUnique({ where: { id: ithbat.id }, select: { name: true, classification: true, domain: true, domainTitle: true } });
  console.log(`بعد: «${after?.name}» · تصنيف=${after?.classification ?? "∅"} · مجال=${after?.domain ?? "∅"} / ${after?.domainTitle ?? "∅"}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
