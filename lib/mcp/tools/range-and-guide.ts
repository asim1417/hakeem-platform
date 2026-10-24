/**
 * hakeem_get_articles_range + hakeem_guide
 *
 * مُكيَّف: LegalSystem (prisma.legalSystem) + LegalArticle (prisma.legalArticle)،
 * والنص في العمود content، والرقم في articleNumber، والربط عبر legalSystemId
 * (مع سقوط إلى lawName للمواد التي لم يُملأ فيها legalSystemId).
 */
import { prisma } from "@/lib/prisma";
import { ARTICLE_ROWS } from "@/lib/modules/legal-core/article-key";
import { effectiveArticleTexts } from "@/lib/modules/legal-core/effective-text";

export const rangeToolDef = {
  name: "hakeem_get_articles_range",
  description:
    "قراءة نطاق متتابع من مواد نظام واحد بالنص الكامل (بحد أقصى ٢٠ مادة) — لقراءة سياق تشريعي كامل مثل فصلٍ بعينه، بدل جلب المواد واحدةً واحدة.",
};

export async function handleRange(args: { law_id: string; from_article: number; to_article: number }) {
  const from = Math.min(args.from_article, args.to_article);
  const to = Math.min(Math.max(args.from_article, args.to_article), from + 19); // سقف ٢٠

  const law = await prisma.legalSystem.findUnique({ where: { id: args.law_id }, select: { name: true } });
  if (!law) return { error: "law_id غير موجود" };

  const articles = await prisma.legalArticle.findMany({
    // يُطابق عبر المعرّف أو اسم النظام (سقوط آمن للمواد بلا legalSystemId).
    where: {
      OR: [{ legalSystemId: args.law_id }, { lawName: law.name }],
      articleNumber: { gte: from, lte: to },
      ...ARTICLE_ROWS,
    },
    orderBy: [{ articleNumber: "asc" }, { articleBis: "asc" }],
    select: { id: true, articleNumber: true, articleBis: true, content: true },
  });

  // النص الساري لكل مادة (المصدر الواحد)، والملغاة تُرجع سطر الإلغاء.
  const effective = await effectiveArticleTexts(articles);
  return {
    law: law.name,
    law_id: args.law_id,
    range: { from, to, returned: articles.length },
    articles: articles.map((a) => {
      const e = effective.get(a.id);
      return {
        article_id: a.id,
        article_number: a.articleNumber,
        article_bis: a.articleBis ?? 0, // درجة «مكرر» (0 للأصل) — HKM-030
        text: e?.text ?? a.content,
        repealed: e?.repealed ?? false,
        text_basis: e?.basis ?? null,
      };
    }),
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
اسم نظام غير دقيق أو مختصر أو فيه خطأ → hakeem_resolve قبل أي أداة تحتاج law_id.

## حسب نوع المهمة
١. دراسة موضوع (مثل: فسخ العقود):
   hakeem_research(topic) → يوسّع من المكنز ويبحث بكل الصيغ ويجمّع حسب النظام.
   ثم hakeem_get_articles_range لقراءة النصوص الكاملة للمواد المحورية.
   وإن ظهر next_cursor في الحصر: hakeem_enumerate(match="derivatives") بالصيغ نفسها للاستكمال حتى النهاية.

٢. حصر لفظ بعينه في كامل المدونة أو نظام واحد:
   hakeem_enumerate(terms, law_id?) مع المتابعة بالـ cursor حتى يفرغ.
   المطابقة كلمة كاملة: «التعدي» لا تطابق «التعديل». للمشتقات (يفسخ، انفسخ) match="derivatives"،
   أو اذكر الصيغ ألفاظًا مستقلة (مفسوخ، انفساخ). total=0 نفي في النطاق وبالصيغ المطلوبة وحدها.

٣. سؤال عن مادة معروفة:
   hakeem_get_article، وقبل عزو أي إحالة في مخرج نهائي: hakeem_verify_citation.
   بطاقة النظام: hakeem_get_law يعيد الفهرس صفحات (toc_page.next_offset)، والمقدمة بـ include_preamble=true.
   أبواب النظام وفصوله: hakeem_get_toc. صيغة الاستناد للمذكرة: hakeem_get_citation (short/full/footnote).
   احفظ ref مع كل اقتباس، وقبل الإيداع hakeem_check_ref يقول: النص كما هو، أو تغيّر بتعديل، أو أُلغي.

٣ب. عبارة بعينها أو استعلام مركّب:
   hakeem_search_phrase للعبارة بكلماتها بترتيبها (match=exact بلا سوابق ولا لواحق).
   hakeem_search_boolean للمركّب: (فسخ أو انفساخ) عقد دون تعويض — وparsed يبيّن كيف فُهم.
   الأداتان تحصران العدد كاملًا مثل hakeem_enumerate، وتستبعدان الأنظمة الملغاة افتراضًا (status="all" لإدخالها)،
   وتقبلان law_ids وcategory وkind وissued_from_h/issued_to_h.

٣ج. اقتباس لا يُعرف مصدره، أو تحقق من نص منسوب:
   hakeem_trace_text: حرفي، بتصرف يسير، جزئي، أو غير موجود — وينبّه إن كان الاقتباس نص ما قبل التعديل.

٣د. سؤال لا يُعرف لفظه في النظام («كم مدة الاستئناف؟»):
   hakeem_semantic_search بالمعنى وحده، ثم اقرأ المادة وتحقق منها؛ ليس حصرًا.

٣هـ. ما في المدونة:
   hakeem_list_categories وhakeem_list_laws للتصفح بلا كلمة بحث، وhakeem_stats للأعداد، وhakeem_health للحالة.

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
