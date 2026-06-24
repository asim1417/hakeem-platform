/**
 * retitle-principles.ts — تحسين عناوين المبادئ المخزّنة.
 *
 * يستبدل العناوين غير المعبّرة (مجرّد «القضية رقم …») بأول جملة من نصّ المبدأ،
 * لرفع جودة شاشة المراجعة البشرية. لا يمسّ نصّ المبدأ ولا حالة المراجعة.
 *
 * معاينة افتراضيًا. للكتابة: --apply
 *   npx tsx scripts/retitle-principles.ts            # معاينة
 *   npx tsx scripts/retitle-principles.ts --apply    # تطبيق
 *
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { deriveTitle } from "@/lib/modules/legal-core/principle-extractor";

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
  let changed = 0;
  const samples: string[] = [];

  for (;;) {
    const rows = await prisma.judicialPrinciple.findMany({
      select: { id: true, title: true, principleText: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      scanned++;
      // مرّر العنوان الحالي كـ fallback: إن كان معبّرًا يبقى، وإلا يُشتقّ من النصّ.
      const next = deriveTitle(r.title, r.principleText);
      if (next && next !== r.title) {
        if (samples.length < 8) samples.push(`«${r.title.slice(0, 40)}» → «${next.slice(0, 60)}»`);
        if (APPLY) {
          await prisma.judicialPrinciple.update({ where: { id: r.id }, data: { title: next } });
        }
        changed++;
      }
    }
    console.log(`  ...فُحص ${scanned}، عُدّل ${changed}`);
  }

  console.log("\nعيّنات إعادة التعنون:");
  for (const s of samples) console.log(`  • ${s}`);
  console.log(`\nالإجمالي: فُحص ${scanned}، ${APPLY ? `عُدّل ${changed}` : `سيُعدّل ${changed} (معاينة)`}`);
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
