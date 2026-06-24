/**
 * triage-principles.ts — فرز آلي للمبادئ المستخرَجة: رفض غير الصالح فقط.
 *
 * يمسح المبادئ بحالة needs_review، ويضع reviewStatus="rejected" لما يصنّفه
 * المصنّف كـ«غير صالح» (بيانات تعريفية للقضية، نصّ أقصر من مبدأ، أرقام صرفة).
 * **لا يعتمد** أي مبدأ آليًا — الاعتماد البشري يبقى عبر الواجهة. الفرز عكوس
 * (يمكن إعادة الحالة من الواجهة).
 *
 * معاينة افتراضيًا. للكتابة: --apply
 *   npx tsx scripts/triage-principles.ts            # معاينة
 *   npx tsx scripts/triage-principles.ts --apply    # تطبيق
 *
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { isJunkPrinciple } from "@/lib/modules/legal-core/principle-extractor";

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

  const batchSize = 1000;
  let cursor: string | undefined;
  let scanned = 0;
  let junk = 0;
  let rejected = 0;
  const samples: string[] = [];

  for (;;) {
    const rows = await prisma.judicialPrinciple.findMany({
      where: { reviewStatus: "needs_review" },
      select: { id: true, title: true, principleText: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    const junkIds: string[] = [];
    for (const r of rows) {
      scanned++;
      if (isJunkPrinciple(r.title, r.principleText)) {
        junk++;
        junkIds.push(r.id);
        if (samples.length < 8) samples.push(r.title.slice(0, 70));
      }
    }
    if (APPLY && junkIds.length) {
      const res = await prisma.judicialPrinciple.updateMany({
        where: { id: { in: junkIds } },
        data: { reviewStatus: "rejected" },
      });
      rejected += res.count;
    }
    console.log(`  ...فُحص ${scanned}، غير صالح ${junk}${APPLY ? `، رُفض ${rejected}` : ""}`);
  }

  const remaining = scanned - junk;
  console.log("\nعيّنات مرفوضة:");
  for (const s of samples) console.log(`  • ${s}`);
  console.log(`\nالإجمالي: فُحص ${scanned}، غير صالح ${junk}، يبقى للمراجعة البشرية ${remaining}${APPLY ? `، رُفض فعليًا ${rejected}` : " (معاينة — لم يُكتب شيء)"}`);
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
