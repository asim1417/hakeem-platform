/**
 * fix-ithbat-classification.ts — يصحّح **قيمة التصنيف الخاطئة فقط** لـ«نظام الإثبات».
 *
 * الوضع الحالي (خطأ): classification = «أنظمة الأمن الداخلي والأحوال المدنية والأنظمة الجنائية».
 * عُرف القاعدة: التصنيف وسمٌ موضوعي قصير مطابق للمجال (مدني/جزائي/إجرائي/أحوال شخصية).
 * لِـ«نظام الإثبات» (domain=evidence · domainTitle=الإثبات) الوسم الصحيح = «إثبات».
 *
 * لا يُمسّ domain ولا domainTitle (كلاهما صحيح). يُحدّث النظام + مواده (classification).
 * وضعان: بلا CONFIRM ⇒ جاف (قراءة فقط). مع CONFIRM=NEON_RUNTIME_CONFIRMED ⇒ كتابة.
 */
import { prisma } from "@/lib/prisma";

const TARGET_SYSTEM = "نظام الإثبات";
const CORRECT_CLASSIFICATION = "إثبات"; // وسم موضوعي مطابق لِ domainTitle=«الإثبات»
const JUDICIAL_CORE = ["نظام المرافعات الشرعية", "نظام الإجراءات الجزائية", "نظام الأحوال الشخصية", "نظام المعاملات المدنية", "نظام الإثبات"];

const confirmed = process.env.CONFIRM_RUNTIME_DB_ALIGNMENT === "NEON_RUNTIME_CONFIRMED";

async function main() {
  console.log("═".repeat(92));
  console.log(`تصحيح تصنيف «${TARGET_SYSTEM}» — الوضع: ${confirmed ? "كتابة (مؤكَّد)" : "جاف (قراءة فقط)"}`);
  console.log("═".repeat(92));

  const systems = await prisma.legalSystem.findMany({
    where: { name: { in: JUDICIAL_CORE } },
    select: { id: true, name: true, classification: true, domain: true, domainTitle: true, articleCount: true },
  });
  console.log("\nالوضع الحالي للأنظمة القضائية الأساسية (عُرف: التصنيف وسمٌ موضوعي قصير):");
  for (const s of systems) console.log(`   • «${s.name}» · تصنيف=${s.classification ?? "∅"} · مجال=${s.domain ?? "∅"} / ${s.domainTitle ?? "∅"}`);

  const ithbat = systems.find((s) => s.name === TARGET_SYSTEM);
  if (!ithbat) { console.error(`\n✗ لم يُعثر على «${TARGET_SYSTEM}».`); process.exit(1); }

  if (ithbat.classification === CORRECT_CLASSIFICATION) {
    console.log(`\n✓ التصنيف صحيح أصلًا («${CORRECT_CLASSIFICATION}») — لا تغيير مطلوب.`);
    await prisma.$disconnect();
    return;
  }

  const artMismatch = await prisma.legalArticle.count({ where: { OR: [{ legalSystemId: ithbat.id }, { lawName: TARGET_SYSTEM }], NOT: { classification: CORRECT_CLASSIFICATION } } });
  console.log(`\nالتغيير المقترح على «${TARGET_SYSTEM}» (التصنيف فقط؛ المجال والعنوان يبقيان كما هما):`);
  console.log(`   ⚑ classification: «${ithbat.classification ?? "∅"}» → «${CORRECT_CLASSIFICATION}»`);
  console.log(`   ⚑ مواد بتصنيف مخالف ستُوائَم: ${artMismatch}`);
  console.log(`   ✔ يبقى: domain=«${ithbat.domain ?? "∅"}» · domainTitle=«${ithbat.domainTitle ?? "∅"}»`);

  if (!confirmed) {
    console.log("\n(وضع جاف — لم يُكتب شيء. أعد التشغيل مع CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED للتنفيذ.)");
    await prisma.$disconnect();
    return;
  }

  await prisma.legalSystem.update({ where: { id: ithbat.id }, data: { classification: CORRECT_CLASSIFICATION } });
  const upd = await prisma.legalArticle.updateMany({ where: { OR: [{ legalSystemId: ithbat.id }, { lawName: TARGET_SYSTEM }] }, data: { classification: CORRECT_CLASSIFICATION } });
  console.log(`\n✓ حُدِّث تصنيف النظام + ${upd.count} مادة إلى «${CORRECT_CLASSIFICATION}».`);

  const after = await prisma.legalSystem.findUnique({ where: { id: ithbat.id }, select: { name: true, classification: true, domain: true, domainTitle: true } });
  console.log(`بعد: «${after?.name}» · تصنيف=${after?.classification ?? "∅"} · مجال=${after?.domain ?? "∅"} / ${after?.domainTitle ?? "∅"}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
