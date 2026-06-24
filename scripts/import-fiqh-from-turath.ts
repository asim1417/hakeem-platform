/**
 * import-fiqh-from-turath.ts — استيراد محدود ومُسنَد للنصوص الفقهية من مكتبة
 * تراث المفتوحة إلى الطبقة الفقهية المنضبطة (لا سحب جماعي، بحثٌ موجّه فقط).
 *
 * يحترم المصدر المفتوح بالإسناد الكامل (الكتاب/المؤلف/الصفحة/الرابط) ويحدّ
 * الكمية بـ --limit و--q. لا يُنشئ مواءمة بالمادة آليًا (تبقى المواءمة قرارًا
 * بشريًا)، بل يخزّن المصدر والنصّ فقط بحالة غير معتمدة.
 *
 * معاينة افتراضيًا. للكتابة: --apply
 *   npx tsx scripts/import-fiqh-from-turath.ts --q "خيار العيب"            # معاينة
 *   npx tsx scripts/import-fiqh-from-turath.ts --apply --q "الغبن" --limit 30
 *
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { searchTurath } from "@/lib/modules/turath/turath-client";

const APPLY = process.argv.includes("--apply");
const qIdx = process.argv.indexOf("--q");
const Q = qIdx !== -1 ? process.argv[qIdx + 1] : "";
const limIdx = process.argv.indexOf("--limit");
const LIMIT = Math.min(limIdx !== -1 ? Number(process.argv[limIdx + 1]) || 20 : 20, 50);

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
  if (Q.trim().length < 2) {
    console.error("يلزم --q بعبارة بحث (حرفان فأكثر). الاستيراد موجّه لا جماعي.");
    process.exit(1);
  }

  const res = await searchTurath(Q, { limit: LIMIT });
  console.log(`نتائج تراث للعبارة «${Q}»: ${res.results.length} (إجمالي مطابق: ${res.total ?? "?"})`);

  let sources = 0;
  let texts = 0;
  const sampleTitles: string[] = [];

  for (const r of res.results) {
    if (sampleTitles.length < 6) sampleTitles.push(`${r.bookTitle}${r.author ? ` — ${r.author}` : ""}`);
    if (!APPLY) continue;

    // مصدر فقهي واحد لكل كتاب (externalId = معرّف الكتاب في تراث المستخرَج من الرابط).
    const bookKey = r.url || `${r.bookTitle}|${r.author ?? ""}`;
    const source = await prisma.fiqhSource.upsert({
      where: { externalId: bookKey },
      update: {},
      create: {
        externalId: bookKey,
        sourceTitle: r.bookTitle,
        author: r.author ?? null,
        sourceType: "book",
        verificationStatus: "unverified"
      }
    });
    sources++;

    await prisma.fiqhText.create({
      data: {
        sourceId: source.id,
        textOriginal: r.fullText || r.snippet || "",
        topic: Q,
        pageReference: [r.volume ? `ج${r.volume}` : "", r.page ? `ص${r.page}` : ""].filter(Boolean).join(" ") || null,
        citation: `${r.bookTitle}${r.author ? `، ${r.author}` : ""}${r.page ? `، ص${r.page}` : ""} (مصدر مفتوح: تراث)`,
        externalRef: r.url
      }
    });
    texts++;
  }

  console.log("\nعيّنات:");
  for (const s of sampleTitles) console.log(`  • ${s}`);
  console.log(`\nالإجمالي: ${APPLY ? `مصادر +${sources}، نصوص +${texts}` : "معاينة — لم يُكتب شيء"}`);
  console.log("ملاحظة: المواءمة بالمواد تبقى مراجعةً بشريةً ولا تُنشأ آليًا.");
}

main()
  .catch((e) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
