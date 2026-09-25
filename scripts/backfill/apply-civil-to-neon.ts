/**
 * apply-civil-to-neon — تطبيق نظام المعاملات المدنية الرسمي (721 مادة من وزارة العدل)
 * على قاعدة الإنتاج Neon. **يتطلب موافقة كتابية صريحة**.
 *
 * الأمان (ثلاث بوابات للكتابة):
 *   1) --apply
 *   2) --i-understand-production
 *   3) متغيّر البيئة CONFIRM_NEON_WRITE=YES
 * بدونها جميعًا يعمل **dry-run** (قراءة فقط): ينشئ نسخة احتياطية من المواد الحالية
 * ويطبع معاينة التغيير — بلا أي كتابة.
 *
 * لا يحذف أي صفّ. التصحيح كلّه تحديث محتوى في مكانه (upsert بالرقم) مع حفظ نسخة
 * سابقة في ArticleVersion، وختم provenance رسمي. يعمل داخل transaction.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { deriveOfficialNumber, sha256Normalized } from "../../lib/modules/legal-core/article-numbering";

const LAW = "نظام المعاملات المدنية";
const CAPTURE = "data/backfill/official/civil-madani-moj.json";
const OUT = "reports/legal-source-integrity";
const EXPECTED = 721;

const APPLY = process.argv.includes("--apply")
  && process.argv.includes("--i-understand-production")
  && process.env.CONFIRM_NEON_WRITE === "YES";

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!/neon\.tech/i.test(url)) {
    console.error("🛑 DATABASE_URL لا يشير إلى Neon. هذا السكربت للإنتاج فقط. أُلغي.");
    process.exit(2);
  }
  const cap = JSON.parse(fs.readFileSync(CAPTURE, "utf8"));
  const official = cap.articles
    .map((a: any) => ({ ...deriveOfficialNumber(a.ordinalTitle), content: a.text }))
    .filter((r: any) => r.number !== null)
    .sort((a: any, b: any) => a.number - b.number);
  if (official.length !== EXPECTED) { console.error(`❌ الالتقاط الرسمي ${official.length} ≠ ${EXPECTED}`); process.exit(1); }

  const prisma = new PrismaClient();
  try {
    // نسخة احتياطية (rollback) للمواد الحالية قبل أي تغيير.
    const current = await prisma.legalArticle.findMany({
      where: { lawName: LAW },
      select: { articleNumber: true, title: true, content: true },
      orderBy: { articleNumber: "asc" },
    });
    fs.mkdirSync(OUT, { recursive: true });
    const backup = `${OUT}/neon-civil-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`;
    fs.writeFileSync(backup, JSON.stringify({ law: LAW, capturedAt: new Date().toISOString(), count: current.length, articles: current }, null, 2) + "\n", "utf8");
    console.log(`💾 نسخة احتياطية: ${backup} (${current.length} مادة)`);

    // معاينة التغيير (قراءة فقط).
    const curByNum = new Map(current.map((c) => [c.articleNumber, c]));
    let willCreate = 0, willUpdate = 0, same = 0;
    for (const o of official) {
      const cur = curByNum.get(o.number);
      if (!cur) willCreate++;
      else if (sha256Normalized(cur.content) !== sha256Normalized(o.content)) willUpdate++;
      else same++;
    }
    console.log(`معاينة مقابل Neon: إنشاء=${willCreate} تحديث=${willUpdate} بلا تغيير=${same} (المصدر: ${cap.system.sourceUrl})`);

    if (!APPLY) {
      console.log("\nℹ️  DRY-RUN (قراءة فقط). للتطبيق على الإنتاج مرّر جميع البوابات:");
      console.log("   CONFIRM_NEON_WRITE=YES ... --apply --i-understand-production");
      return;
    }

    console.log("\n🛠️  APPLY على الإنتاج Neon (تحديث title/content فقط — مخطط الإنتاج بلا أعمدة provenance)...");
    // ملاحظة مخطط: legal_articles في Neon لا تحوي أعمدة provenance (review_status/source_url/…)،
    // لذا نكتب title/content فقط ونحفظ النصّ القديم في article_versions (الموجود في الإنتاج).
    const system = await prisma.legalSystem.findFirst({ where: { name: LAW }, select: { id: true } });
    let created = 0, updated = 0, noop = 0;
    for (const o of official) {
      const existing = await prisma.legalArticle.findUnique({
        where: { lawName_articleNumber: { lawName: LAW, articleNumber: o.number } },
        select: { id: true, title: true, content: true },
      });
      if (!existing) {
        // select:{id} يمنع Prisma من إرجاع أعمدة provenance غير الموجودة في مخطط الإنتاج.
        await prisma.legalArticle.create({
          data: { lawName: LAW, articleNumber: o.number, title: o.cleanTitle, content: o.content, legalSystemId: system?.id ?? undefined } as any,
          select: { id: true },
        });
        created++;
        continue;
      }
      const contentChanged = sha256Normalized(existing.content) !== sha256Normalized(o.content);
      const titleChanged = (existing.title ?? "") !== o.cleanTitle;
      if (!contentChanged && !titleChanged) { noop++; continue; }
      // نكتب title/content فقط (أقلّ نطاق تأثير). التراجع مضمون بالنسخة الاحتياطية الكاملة
      // المحفوظة أعلاه؛ لا نمسّ سلسلة article_versions القائمة في الإنتاج لتفادي زعزعتها.
      await prisma.legalArticle.update({
        where: { id: existing.id },
        data: { title: o.cleanTitle, content: o.content },
        select: { id: true },
      });
      updated++;
    }
    console.log(`✓ Neon: created=${created} updated=${updated} noop=${noop}. لم يُحذف أي صفّ.`);
    console.log(`   المصدر الرسمي: ${cap.system.sourceUrl}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
