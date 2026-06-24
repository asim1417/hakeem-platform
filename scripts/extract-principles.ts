/**
 * extract-principles.ts — استخراج المبادئ القضائية من الأحكام (لا اختلاق).
 *
 * يقرأ الأحكام التي لا مبدأ مستخرجًا لها، ويستخرج المبدأ من نصّ الحكم نفسه
 * عبر مستخرِج قواعدي (عُنونة صريحة أو headnote افتتاحي). كل مبدأ يُحفظ بحالة
 * needs_review لأنه اقتراح آلي يخضع للمراجعة البشرية.
 *
 * وضع آمن افتراضيًا (معاينة فقط). للكتابة: --apply
 *   npx tsx scripts/extract-principles.ts             # معاينة
 *   npx tsx scripts/extract-principles.ts --apply     # تطبيق
 *   npx tsx scripts/extract-principles.ts --apply --limit 500
 *
 * لا يطبع أسرارًا (بصمة المضيف فقط). لا يستدعي أي مزوّد ذكاء — قواعدي بحت.
 */
import { PrismaClient } from "@prisma/client";
import { extractPrinciple } from "@/lib/modules/legal-core/principle-extractor";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;
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

  const batchSize = 500;
  let cursor: string | undefined;
  let scanned = 0;
  let matched = 0;
  let created = 0;
  const byMethod: Record<string, number> = { labeled: 0, headnote: 0 };
  const samples: string[] = [];
  // نجمّع الإدراجات ونكتبها دفعةً بـ createMany (أسرع بكثير من الإدراج فردًا فردًا).
  type Row = { title: string; principleText: string; sourceCaseId: string; court: string | null; confidence: number; reviewStatus: string };
  let pending: Row[] = [];

  async function flush() {
    if (!APPLY || pending.length === 0) return;
    const res = await prisma.judicialPrinciple.createMany({ data: pending });
    created += res.count;
    pending = [];
  }

  for (;;) {
    if (scanned >= LIMIT) break;
    const cases = await prisma.judicialCase.findMany({
      where: { judgmentText: { not: "" }, principles: { none: {} } },
      select: { id: true, judgmentTitle: true, court: true, judgmentText: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (cases.length === 0) break;
    cursor = cases[cases.length - 1].id;

    for (const c of cases) {
      if (scanned >= LIMIT) break;
      scanned++;
      const p = extractPrinciple(c.judgmentText, c.judgmentTitle);
      if (!p) continue;
      matched++;
      byMethod[p.method] = (byMethod[p.method] ?? 0) + 1;
      if (samples.length < 6) samples.push(`[${p.method}] ${p.title.slice(0, 70)}`);
      pending.push({
        title: p.title.slice(0, 250),
        principleText: p.principleText,
        sourceCaseId: c.id,
        court: c.court,
        confidence: p.confidence,
        reviewStatus: "needs_review",
      });
    }
    await flush();
    console.log(`  ...فُحص ${scanned}، طابق ${matched}${APPLY ? `، أُنشئ ${created}` : ""}`);
  }
  await flush();

  console.log("\nعيّنات مستخرَجة:");
  for (const s of samples) console.log(`  • ${s}`);
  console.log(`\nبالطريقة: مُعنون ${byMethod.labeled}، افتتاحي ${byMethod.headnote}`);
  console.log(`الإجمالي: فُحص ${scanned}، طابق ${matched}${APPLY ? `، أُنشئ ${created}` : " (لم يُكتب شيء — معاينة)"}`);
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
