/**
 * import-moj-regs.ts — يُدرج اللوائح التنفيذية الأربع المفقودة من data/moj-regs.json
 * (المُنتَج من المصدر الرسمي عبر moj-fetch-regs.mjs) إلى legal_systems + legal_articles.
 *
 * كتابة على القاعدة ⇒ مُقفل خلف بوّابة المواءمة (CONFIRM_RUNTIME_DB_ALIGNMENT) + حارس Neon.
 * آمن للتكرار: upsert للنظام + createMany({skipDuplicates}) للمواد (مفتاح lawName+articleNumber).
 * ترث اللائحةُ domain/classification من نظامها الأمّ لتتجمّع معه في كل فلتر.
 * بعد الإدراج يجب تشغيل backfill-search-norm (خطوة تالية في الـ workflow) لتفهرس المواد الجديدة.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

type RegFile = Array<{
  system: { name: string; classification: string | null; parentSystem: string; sourceSerial: string; sourceUrl: string; issuanceDateH: string | null; officialArticleCount: number };
  articles: Array<{ articleNumber: number; title: string; content: string; chapter: string | null; royalDecree: string | null }>;
}>;

function assertAlignmentConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED بعد مواءمة DATABASE_URL مع Neon عمداً.");
    process.exit(1);
  }
}

async function main() {
  assertAlignmentConfirmed();
  const dataPath = process.argv[2] || "data/moj-regs.json";
  const data = JSON.parse(readFileSync(dataPath, "utf8")) as RegFile;
  console.log(`قراءة ${dataPath} — ${data.length} عنصرًا.`);

  let totalArticles = 0;
  for (const reg of data) {
    const { system, articles } = reg;
    if (!system?.name || !articles?.length) { console.log(`⚠ تخطّي «${system?.name ?? "?"}» (بلا مواد).`); continue; }

    // ورّث من النظام الأمّ (domain/classification) لتجمّع اللائحة معه في الفلاتر
    const parent = await prisma.legalSystem.findUnique({ where: { name: system.parentSystem }, select: { domain: true, domainTitle: true, classification: true, sortOrder: true } });
    const classification = parent?.classification ?? system.classification ?? null;

    const sys = await prisma.legalSystem.upsert({
      where: { name: system.name },
      update: { classification, domain: parent?.domain ?? null, domainTitle: parent?.domainTitle ?? null, articleCount: articles.length },
      create: { name: system.name, classification, domain: parent?.domain ?? null, domainTitle: parent?.domainTitle ?? null, sortOrder: parent?.sortOrder ?? 0, articleCount: articles.length },
      select: { id: true, name: true },
    });

    const rows = articles.map((a) => ({
      legalSystemId: sys.id,
      lawName: system.name,
      classification,
      articleNumber: a.articleNumber,
      title: a.title || `المادة ${a.articleNumber}`,
      content: a.content,
      chapter: a.chapter ? a.chapter.replace(/:\s*:\s*/g, ": ").replace(/\s+/g, " ").trim() : null,
      royalDecree: a.royalDecree,
      status: "سارية",
      keywords: ["source:moj_gateway", "review:needs_review", `moj_serial:${system.sourceSerial}`, `parent:${system.parentSystem}`],
    }));

    const res = await prisma.legalArticle.createMany({ data: rows, skipDuplicates: true });
    // صحّح العدّاد ليطابق الواقع بعد التخطّي
    const actual = await prisma.legalArticle.count({ where: { lawName: system.name } });
    await prisma.legalSystem.update({ where: { id: sys.id }, data: { articleCount: actual } });
    totalArticles += res.count;
    console.log(`✓ «${sys.name}» — أُدرج ${res.count} (موجود سابقًا ${rows.length - res.count})، إجمالي مواد النظام الآن ${actual} · تصنيف=${classification ?? "∅"}`);
  }

  console.log(`\n✓ اكتمل الإدراج — مواد جديدة=${totalArticles}. شغّل الآن backfill-search-norm لفهرسة الجديد.`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗ فشل import-moj-regs:", e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
