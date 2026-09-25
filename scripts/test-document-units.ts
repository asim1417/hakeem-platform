/**
 * test-document-units.ts — اختبار إنشاء/استرجاع شجرة وحدات (المرحلة ١).
 *
 * يتطلّب DATABASE_URL حقيقيًّا (يتخطّى بأمان إن غاب أو كان وهميًّا). ينشئ نظامًا
 * ووثيقةً وشجرةَ وحدات صغيرة (باب ← مادة ← فقرة)، يسترجعها متداخلةً، ويتحقّق من:
 *   ① صحّة الشجرة (parent/children)، ② قاعدة إعادة التركيب: concat(text_raw
 *   بترتيب ordinal) == النصّ الأصلي. ثم ينظّف كل ما أنشأه.
 *
 * تشغيل يدويّ (خارج هذه الجلسة، ببيئة فيها Neon):
 *   npx tsx scripts/test-document-units.ts
 */
import { prisma } from "@/lib/prisma";

function skip(reason: string): never {
  console.log(`⏭️  تخطّي: ${reason}`);
  process.exit(0);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) skip("لا DATABASE_URL — الاختبار يحتاج قاعدة حيّة.");
  if (/@localhost|@127\.0\.0\.1/.test(url)) skip("DATABASE_URL محليّ/وهميّ — لا قاعدة فعلية.");

  const marker = "__TEST_DOCUNITS__";
  // النصّ الأصلي المُصطنَع: يجب أن يساوي concat(text_raw) بترتيب ordinal.
  const partText = "الباب الأول: أحكام عامة\n";
  const articleText = "المادة الأولى: يُقصد بهذا النظام كذا.\n";
  const paraText = "1- الفقرة الأولى من المادة.\n";
  const original = partText + articleText + paraText;

  const system = await prisma.legalSystem.create({
    data: { name: `${marker} ${Date.now()}`, completeness: "IN_PROGRESS" },
  });
  try {
    const doc = await prisma.legalDocument.create({
      data: { systemId: system.id, docType: "SYSTEM_TEXT", rawText: original },
    });

    const part = await prisma.documentUnit.create({
      data: {
        systemId: system.id, documentId: doc.id, unitType: "PART", ordinal: 0,
        labelAr: "الباب الأول", number: "1", textRaw: partText, path: "doc/part:1",
        charStart: 0, charEnd: partText.length,
      },
    });
    const article = await prisma.documentUnit.create({
      data: {
        systemId: system.id, documentId: doc.id, parentId: part.id, unitType: "ARTICLE", ordinal: 1,
        labelAr: "المادة الأولى", number: "1", textRaw: articleText, path: "doc/part:1/article:1",
        charStart: partText.length, charEnd: partText.length + articleText.length,
      },
    });
    await prisma.documentUnit.create({
      data: {
        systemId: system.id, documentId: doc.id, parentId: article.id, unitType: "PARAGRAPH", ordinal: 2,
        labelAr: "1", number: "1", textRaw: paraText, path: "doc/part:1/article:1/para:1",
        charStart: partText.length + articleText.length, charEnd: original.length,
      },
    });

    // استرجاع متداخل + تحقّق الشجرة
    const units = await prisma.documentUnit.findMany({
      where: { documentId: doc.id }, orderBy: { ordinal: "asc" },
    });
    const reconstructed = units.map((u) => u.textRaw).join("");
    const treeOk = units.length === 3 &&
      units[1].parentId === part.id && units[2].parentId === article.id;

    console.log("عدد الوحدات:", units.length);
    console.log("صحّة الشجرة (parent/children):", treeOk);
    console.log("إعادة التركيب == الأصل:", reconstructed === original);

    if (!treeOk || reconstructed !== original) {
      console.error("✗ فشل التحقق");
      process.exitCode = 1;
    } else {
      console.log("✓ نجاح: إنشاء واسترجاع شجرة وحدات صحيح، وإعادة التركيب حرفية.");
    }
  } finally {
    // تنظيف (Cascade من الوثيقة يحذف الوحدات؛ ثم النظام)
    await prisma.legalDocument.deleteMany({ where: { systemId: system.id } });
    await prisma.legalSystem.delete({ where: { id: system.id } });
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
