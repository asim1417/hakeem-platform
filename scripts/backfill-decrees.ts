/**
 * backfill-decrees.ts — تعبئة حقل royalDecree للمواد من نصوصها (لا اختلاق).
 *
 * يقرأ كل مادة بلا royalDecree، ويستخرج المرسوم/الأمر الملكي إن ورد صراحةً
 * في اسم النظام أو نصّ المادة، ثم يحدّث الحقل. لا يكتب شيئًا إن لم يُذكر مرسوم.
 *
 * وضع آمن افتراضيًا (معاينة فقط). للكتابة الفعلية: --apply
 *   npx tsx scripts/backfill-decrees.ts            # معاينة (dry-run)
 *   npx tsx scripts/backfill-decrees.ts --apply    # تطبيق
 *
 * لا يطبع أي أسرار (يُظهر بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { extractRoyalDecree } from "@/lib/modules/legal-core/decree-extractor";

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
  let matched = 0;
  let updated = 0;
  const samples: string[] = [];

  for (;;) {
    const articles = await prisma.legalArticle.findMany({
      where: { OR: [{ royalDecree: null }, { royalDecree: "" }] },
      select: { id: true, lawName: true, content: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (articles.length === 0) break;
    cursor = articles[articles.length - 1].id;

    for (const a of articles) {
      scanned++;
      const found = extractRoyalDecree(`${a.lawName}\n${a.content}`);
      if (!found) continue;
      matched++;
      if (samples.length < 8) samples.push(`${a.lawName} → ${found.decree}`);
      if (APPLY) {
        await prisma.legalArticle.update({
          where: { id: a.id },
          data: { royalDecree: found.decree },
        });
        updated++;
      }
    }
    console.log(`  ...فُحص ${scanned}، طابق ${matched}`);
  }

  console.log("\nعيّنات مستخرَجة:");
  for (const s of samples) console.log(`  • ${s}`);
  console.log(`\nالإجمالي: فُحص ${scanned}، طابق ${matched}${APPLY ? `، حُدِّث ${updated}` : " (لم يُكتب شيء — معاينة)"}`);
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
