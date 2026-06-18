/**
 * verify-neon-target.ts — حارس هدف قبل أي كتابة (قراءة فقط، لا يطبع أسرار).
 *
 * يرفض المتابعة ما لم يكن DATABASE_URL يشير إلى قاعدة Neon الكبيرة فعلاً:
 *   - المضيف ليس supabase.
 *   - عدد legal_articles ≥ الحدّ الأدنى (Neon ≈ 15,902 ؛ Supabase B ≈ 1,981).
 * يمنع تطبيق الترقية على القاعدة الخطأ حتى عند إعداد سرّ غير صحيح.
 *
 * التشغيل: npx tsx scripts/verify-neon-target.ts
 */
import { PrismaClient } from "@prisma/client";

const MIN_ARTICLES = Number(process.env.NEON_MIN_ARTICLES || 10000);

function safeHost(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("::error::DATABASE_URL غير مضبوط (يُتوقّع اتصال Neon).");
    process.exit(1);
  }

  const host = safeHost(url);
  console.log(`بصمة المضيف: ${host}`);

  if (/supabase/i.test(host)) {
    console.error("::error::الهدف يبدو Supabase لا Neon — أُلغيت الكتابة. وجّه NEON_DATABASE_URL إلى Neon.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const count = await prisma.legalArticle.count();
    console.log(`عدد legal_articles على الهدف: ${count.toLocaleString("en-US")}`);
    if (count < MIN_ARTICLES) {
      console.error(`::error::عدد المواد (${count}) دون الحدّ (${MIN_ARTICLES}) — هذه ليست قاعدة Neon الإنتاجية. أُلغيت الكتابة.`);
      process.exit(1);
    }
    console.log("✅ الهدف هو قاعدة Neon الكبيرة — يُسمح بالمتابعة.");
  } catch (e) {
    console.error("::error::تعذّر التحقق من الهدف:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main();
