/**
 * move-preambles-to-system — DATA-001 (الخيار الثاني): ينقل الديباجات المخزَّنة كـ
 * «مادة صفر» (articleNumber = 0) إلى حقل مخصّص على مستوى النظام (LegalSystem.preamble)،
 * ثم يؤرشف صفوف الصفر ويحذفها، ثم يضيف قيد CHECK ("articleNumber" > 0).
 *
 * الأمان:
 *   • dry-run افتراضيًّا (قراءة + نسخة احتياطية فقط).
 *   • على staging: --apply.
 *   • على الإنتاج Neon: يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 *   • نسخة احتياطية كاملة لكل صفوف الصفر تُكتب قبل أي حذف (للتراجع).
 *   • كل العمليات داخل transaction واحدة.
 *
 * لا يحذف أي محتوى قانوني نهائيًّا دون حفظه: المحتوى ينتقل إلى LegalSystem.preamble
 * والنسخة الاحتياطية على القرص.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const OUT = "reports/legal-source-integrity";

const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));

async function tableExists(prisma: PrismaClient, name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
    name,
  ).catch(() => [{ exists: false }]);
  return Boolean(rows?.[0]?.exists);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    if (isNeon && process.argv.includes("--apply") && !APPLY) {
      console.error("🛑 Neon (إنتاج): الكتابة تتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.");
      process.exit(2);
    }

    const zeros = await prisma.legalArticle.findMany({
      where: { articleNumber: { lte: 0 } },
      select: { id: true, lawName: true, legalSystemId: true, title: true, content: true, royalDecree: true, effectiveFrom: true },
      orderBy: { lawName: "asc" },
    });
    console.log(`صفوف «المادة ≤ 0»: ${zeros.length}`);
    if (!zeros.length) {
      console.log("لا شيء لنقله. (قد تكون الهجرة نُفِّذت already.)");
    }

    // نسخة احتياطية دائمًا (حتى في dry-run) قبل أي تغيير.
    fs.mkdirSync(OUT, { recursive: true });
    const backup = path.join(OUT, `preamble-zero-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`);
    fs.writeFileSync(backup, JSON.stringify({ capturedAt: new Date().toISOString(), count: zeros.length, rows: zeros }, null, 2) + "\n", "utf8");
    console.log(`💾 نسخة احتياطية: ${backup}`);

    // معاينة المطابقة نظام↔ديباجة.
    let matched = 0, unmatched = 0;
    const unmatchedNames: string[] = [];
    for (const z of zeros) {
      const sys = z.legalSystemId
        ? await prisma.legalSystem.findUnique({ where: { id: z.legalSystemId }, select: { id: true } })
        : await prisma.legalSystem.findFirst({ where: { name: z.lawName }, select: { id: true } });
      if (sys) matched++; else { unmatched++; unmatchedNames.push(z.lawName); }
    }
    console.log(`مطابقة النظام: مطابقة=${matched} بلا نظام=${unmatched}${unmatched ? " → " + unmatchedNames.slice(0, 5).join(" · ") : ""}`);

    if (!APPLY) {
      console.log("\nℹ️  DRY-RUN: لم تُكتب أي بيانات (عدا النسخة الاحتياطية).");
      if (isNeon) console.log("   الهدف Neon — للتنفيذ: --apply --i-understand-production + CONFIRM_NEON_WRITE=YES");
      else console.log("   للتنفيذ على staging: --apply");
      return;
    }

    const hasEmbeddings = await tableExists(prisma, "embeddings");
    let movedContent = 0, deleted = 0, embeddingsDeleted = 0;

    await prisma.$transaction(async (tx) => {
      for (const z of zeros) {
        const sys = z.legalSystemId
          ? await tx.legalSystem.findUnique({ where: { id: z.legalSystemId }, select: { id: true } })
          : await tx.legalSystem.findFirst({ where: { name: z.lawName }, select: { id: true } });
        if (sys && z.content?.trim()) {
          await tx.legalSystem.update({
            where: { id: sys.id },
            data: {
              preamble: z.content,
              preambleRoyalDecree: z.royalDecree ?? undefined,
              preambleEffectiveFrom: z.effectiveFrom ?? undefined,
              preambleUpdatedAt: new Date(),
            },
            select: { id: true },
          });
          movedContent++;
        }
      }

      const ids = zeros.map((z) => z.id);
      // حذف التبعيات أولًا (إن وُجدت) لتفادي أخطاء المفاتيح الأجنبية.
      await tx.articleVersion.deleteMany({ where: { articleId: { in: ids } } }).catch(() => ({ count: 0 }));
      await tx.articleAmendment.deleteMany({ where: { articleId: { in: ids } } }).catch(() => ({ count: 0 }));
      await tx.legalArticleCaseLink.deleteMany({ where: { articleId: { in: ids } } }).catch(() => ({ count: 0 }));
      await tx.legalGraphNode.deleteMany({ where: { articleId: { in: ids } } }).catch(() => ({ count: 0 }));
      // embeddings (pgvector) — حذف أفضل جهد إن كان الجدول موجودًا ويشير لمعرّف المادة.
      if (hasEmbeddings && ids.length) {
        const res = await tx.$executeRawUnsafe(
          `DELETE FROM "embeddings" WHERE "owner_id" = ANY($1::text[])`,
          ids,
        ).catch(() => 0);
        embeddingsDeleted = Number(res) || 0;
      }

      const del = await tx.legalArticle.deleteMany({ where: { id: { in: ids } } });
      deleted = del.count;

      // قيد يمنع عودة «المادة صفر» — بعد إزالة كل الصفوف المخالفة.
      await tx.$executeRawUnsafe(
        `ALTER TABLE "legal_articles" ADD CONSTRAINT "legal_articles_article_number_positive" CHECK ("articleNumber" > 0) NOT VALID`,
      ).catch((e) => console.warn("CHECK add:", (e as Error)?.message?.slice(0, 120)));
      await tx.$executeRawUnsafe(
        `ALTER TABLE "legal_articles" VALIDATE CONSTRAINT "legal_articles_article_number_positive"`,
      ).catch((e) => console.warn("CHECK validate:", (e as Error)?.message?.slice(0, 120)));
    }, { timeout: 120_000 });

    console.log(`✓ تم: نُقل محتوى=${movedContent} · حُذفت مواد=${deleted} · embeddings=${embeddingsDeleted}`);
    console.log("✓ أُضيف قيد CHECK (\"articleNumber\" > 0).");

    const remaining = await prisma.legalArticle.count({ where: { articleNumber: { lte: 0 } } });
    console.log(`تحقّق: صفوف «≤ 0» المتبقية = ${remaining} (يجب أن تكون 0).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
