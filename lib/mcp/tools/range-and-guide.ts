/**
 * hakeem_get_articles_range + hakeem_guide
 *
 * مُكيَّف: LegalSystem (prisma.legalSystem) + LegalArticle (prisma.legalArticle)،
 * والنص في العمود content، والرقم في articleNumber، والربط عبر legalSystemId
 * (مع سقوط إلى lawName للمواد التي لم يُملأ فيها legalSystemId).
 */
import { prisma } from "@/lib/prisma";
import { displayedSystem } from "@/lib/modules/legal-core/work-edition-read";

export const rangeToolDef = {
  name: "hakeem_get_articles_range",
  description:
    "قراءة نطاق متتابع من مواد نظام واحد بالنص الكامل (بحد أقصى ٢٠ مادة) — لقراءة سياق تشريعي كامل مثل فصلٍ بعينه، بدل جلب المواد واحدةً واحدة.",
};

export async function handleRange(args: { law_id: string; from_article: number; to_article: number }) {
  const from = Math.min(args.from_article, args.to_article);
  const to = Math.min(Math.max(args.from_article, args.to_article), from + 19); // سقف ٢٠

  const requested = await prisma.legalSystem.findUnique({ where: { id: args.law_id }, select: { id: true, name: true } });
  if (!requested) return { error: "law_id غير موجود" };
  const route = await displayedSystem(requested.id, new Date());
  const lawId = route.redirected ? route.id : requested.id;
  const law = route.redirected
    ? await prisma.legalSystem.findUnique({ where: { id: lawId }, select: { name: true } })
    : requested;
  if (!law) return { error: "law_id غير موجود" };

  const articles = await prisma.legalArticle.findMany({
    // يُطابق عبر المعرّف أو اسم النظام (سقوط آمن للمواد بلا legalSystemId).
    where: {
      OR: [{ legalSystemId: lawId }, { lawName: law.name }],
      articleNumber: { gte: from, lte: to },
    },
    orderBy: { articleNumber: "asc" },
    select: { id: true, articleNumber: true, content: true },
  });

  return {
    law: law.name,
    law_id: lawId,
    range: { from, to, returned: articles.length },
    articles: articles.map((a) => ({
      article_id: a.id,
      article_number: a.articleNumber,
      text: a.content,
    })),
    note:
      to < Math.max(args.from_article, args.to_article)
        ? "قُصّ النطاق إلى ٢٠ مادة — أعد الاستدعاء من المادة التالية للاستكمال."
        : undefined,
  };
}

export const guideToolDef = {
  name: "hakeem_guide",
  description:
    "دليل استخدام مختصر: سير العمل الأمثل لأدوات حكيم بحسب نوع المهمة. استدعه أولًا عند المهام المركبة.",
};

export function handleGuide() {
  return {
    guide: `# دليل أدوات حكيم — سير العمل الأمثل

## القاعدة الذهبية
سؤال محدد → hakeem_search مباشرة.
دراسة أو حصر أو مذكرة → hakeem_research أولًا، دائمًا.

## حسب نوع المهمة
١. دراسة موضوع (مثل: فسخ العقود):
   hakeem_research(topic) → يوسّع من المكنز ويبحث بكل الصيغ ويجمّع حسب النظام.
   ثم hakeem_get_articles_range لقراءة النصوص الكاملة للمواد المحورية.
   وإن ظهر next_cursor في الحصر: hakeem_enumerate للاستكمال حتى النهاية.

٢. حصر لفظ بعينه في كامل المدونة أو نظام واحد:
   hakeem_enumerate(terms, law_id?) مع المتابعة بالـ cursor حتى يفرغ.

٣. سؤال عن مادة معروفة:
   hakeem_get_article، وقبل عزو أي إحالة في مخرج نهائي: hakeem_verify_citation.

٤. فهم مصطلح أو بناء استراتيجية بحث:
   hakeem_expand_terms أولًا، ثم ابحث بالمرادفات والأخص.

٥. اللوائح التنفيذية:
   hakeem_bylaw_links على النظام قبل الجزم بحكم — اللائحة قد تقيّد المادة.

٦. السوابق القضائية:
   hakeem_search_rulings بعد حصر المواد، بألفاظ المواد نفسها.

## تحذيرات
- hakeem_search يرجع top-k فقط — لا تعتمد عليه وحده للحصر الشامل أبدًا.
- المقتطفات قد تكون مبتورة (truncated: true) — لا تقتبس مادة مبتورة حرفيًّا؛ اجلب نصها الكامل.
- لا تنسب مادة لنظام دون رقم مادة متحقق عبر verify_citation.`,
  };
}
