/**
 * حكيم MCP — المسار الرئيسي
 * يكشف مكنز حكيم القانوني (الأنظمة السعودية، موادها، والأحكام القضائية)
 * كمصدر تشريعي رسمي تقرأ منه نماذج الذكاء الاصطناعي مباشرة.
 *
 * التثبيت: npm i mcp-handler @modelcontextprotocol/sdk zod
 * الرابط بعد النشر: https://hakeem-platform.vercel.app/mcp
 */
import { createMcpHandler } from "mcp-handler";
// خادم MCP (@modelcontextprotocol/server) يبني مخططاته على Zod v4 ويتطلّب
// «~standard.jsonSchema» (غير الموجود في Zod v3 المعتمد في بقيّة المشروع). لذا
// نستورد Zod v4 باسم مستعار (zodv4) هنا فقط — دون المساس بـ zod v3 في سائر الكود.
import { z } from "zodv4";
import * as hakeem from "@/lib/mcp/adapter";
import { handleEnumerate } from "@/lib/mcp/tools/enumerate";
import { handleResearch } from "@/lib/mcp/tools/research";
import { handleRange, handleGuide } from "@/lib/mcp/tools/range-and-guide";
import { getRuling, enumerateRulings } from "@/lib/mcp/tools/rulings";
import {
  AMAN_CONTACT_CHANNELS,
  AMAN_LEGAL_AREAS,
  AMAN_URGENCY_LEVELS,
  buildAmanServiceCard,
  getAmanConsultationLink,
} from "@/lib/mcp/tools/aman-triage";
import { AMAN_TRIAGE_WIDGET_HTML, AMAN_TRIAGE_WIDGET_URI } from "@/lib/mcp/aman-widget";

// Prisma يتطلّب بيئة Node (لا Edge)، والمخرجات ديناميكية دائمًا.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
    // واجهة أمان التفاعلية: مستقلة عن أدوات البحث حتى يبقى خادم حكيم مفيداً دون UI.
    server.registerResource("aman-triage-card", AMAN_TRIAGE_WIDGET_URI, {}, async () => ({
      contents: [
        {
          uri: AMAN_TRIAGE_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: AMAN_TRIAGE_WIDGET_HTML,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: { connectDomains: [], resourceDomains: [] },
            },
          },
        },
      ],
    }));

    // طبقة «حكيم من أمان» لا تُستدعى إلا عند طلب المستخدم فرز خدمة أمان أو التواصل معها.
    // لا تقبل أسماء الخصوم أو الهويات أو رقم القضية أو المستندات؛ تبقى المحادثة أقلّ جمعاً للبيانات.
    server.registerTool(
      "aman_triage_case",
      {
        title: "فرز خدمة أمان القانونية",
        description:
          "استخدمها فقط إذا طلب المستخدم صراحةً فرز خدمته لدى أمان الامتثال أو أراد التواصل مع محامٍ سعودي. لا تمرّر إليها سرد الوقائع ولا أسماء الخصوم ولا أرقام الهوية أو القضايا أو الملفات؛ مرّر المجال القانوني ومستوى الاستعجال فقط.",
        inputSchema: z.object({
          legal_area: z.enum(AMAN_LEGAL_AREAS).describe("أقرب مجال قانوني للمسألة"),
          urgency: z.enum(AMAN_URGENCY_LEVELS).default("normal").describe("عاجل أو اعتيادي أو تخطيط وقائي"),
          contact_preference: z.enum(AMAN_CONTACT_CHANNELS).default("website").describe("قناة التواصل التي يفضّلها المستخدم"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ legal_area, urgency, contact_preference }) => structuredJson(buildAmanServiceCard({ legal_area, urgency, contact_preference }))
    );

    // أداة العرض وحدها تحمل قالب الواجهة؛ يفصل ذلك بين الفرز والـ UI كما توصي مواصفة MCP Apps.
    server.registerTool(
      "aman_render_service_card",
      {
        title: "عرض بطاقة خدمة أمان",
        description:
          "اعرض بطاقة أمان التفاعلية بعد aman_triage_case، مستخدماً المجال القانوني والاستعجال فقط. لا تستخدمها للترويج غير المطلوب ولا ترسل أي بيانات شخصية.",
        inputSchema: z.object({
          legal_area: z.enum(AMAN_LEGAL_AREAS),
          urgency: z.enum(AMAN_URGENCY_LEVELS),
          contact_preference: z.enum(AMAN_CONTACT_CHANNELS).default("website"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        _meta: {
          ui: { resourceUri: AMAN_TRIAGE_WIDGET_URI },
          "openai/outputTemplate": AMAN_TRIAGE_WIDGET_URI,
        },
      },
      async ({ legal_area, urgency, contact_preference }) => structuredJson(buildAmanServiceCard({ legal_area, urgency, contact_preference }))
    );

    server.registerTool(
      "aman_get_consultation_link",
      {
        title: "فتح قناة تواصل أمان",
        description:
          "استخدمها فقط بعد أن يطلب المستخدم صراحةً التواصل مع أمان. تعيد رابطاً أو رقماً عاماً فقط ولا ترسل رسالة أو تنشئ طلباً أو تجمع بيانات.",
        inputSchema: z.object({
          channel: z.enum(AMAN_CONTACT_CHANNELS).describe("القناة التي طلبها المستخدم صراحةً"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ channel }) => structuredJson(getAmanConsultationLink(channel))
    );

    // ١) البحث الهجين في المواد
    server.registerTool(
      "hakeem_search",
      {
        description:
          "البحث الرئيسي الهجين (BM25 + دلالي) في مواد الأنظمة السعودية. أرجِع لكل نتيجة: النظام، رقم المادة، مقتطف النص، ومعرّف المادة.",
        inputSchema: z.object({
          query: z.string().describe("نص البحث بالعربية"),
          law_id: z.string().optional().describe("حصر البحث في نظام محدد (اختياري)"),
          limit: z.number().min(1).max(20).default(10),
        }),
      },
      async ({ query, law_id, limit }) => json(await hakeem.searchArticles(query, law_id, limit))
    );

    // ٢) نص المادة كاملًا
    server.registerTool(
      "hakeem_get_article",
      {
        description: "جلب نص مادة نظامية كاملًا بمعرّفها، مع اسم النظام ورقم المادة وأداة إصدارها.",
        inputSchema: z.object({
          article_id: z.string().describe("معرّف المادة كما يرجع من hakeem_search"),
        }),
      },
      async ({ article_id }) => json(await hakeem.getArticle(article_id))
    );

    // ٣) بطاقة النظام وفهرسه
    server.registerTool(
      "hakeem_get_law",
      {
        description: "بطاقة نظام سعودي: الاسم الرسمي، التصنيف (المجال)، وقائمة مواده (فهرس).",
        inputSchema: z.object({
          law_id: z.string().optional().describe("معرّف النظام"),
          name: z.string().optional().describe("أو البحث باسم النظام"),
        }),
      },
      async ({ law_id, name }) => json(await hakeem.getLaw(law_id, name))
    );

    // ٤) روابط النظام بلوائحه
    server.registerTool(
      "hakeem_bylaw_links",
      {
        description:
          "اللوائح التنفيذية المرتبطة بنظام معيّن (علاقات IMPLEMENTS)، أو النظام الأم للائحة معيّنة.",
        inputSchema: z.object({
          law_id: z.string().describe("معرّف النظام أو اللائحة"),
        }),
      },
      async ({ law_id }) => json(await hakeem.getBylawLinks(law_id))
    );

    // ٥) توسيع المصطلح من المكنز
    server.registerTool(
      "hakeem_expand_terms",
      {
        description:
          "توسيع مصطلح قانوني من المكنز السعودي (SKOS): المرادفات، المصطلح الأعم، الأخص، والمصطلحات المرتبطة. استخدمه قبل البحث لرفع الاستدعاء.",
        inputSchema: z.object({
          term: z.string().describe("المصطلح القانوني"),
        }),
      },
      async ({ term }) => json(await hakeem.expandTerms(term))
    );

    // ٦) البحث في الأحكام
    server.registerTool(
      "hakeem_search_rulings",
      {
        description:
          "البحث في قاعدة الأحكام القضائية السعودية: رقم القضية، المحكمة، السنة، ومقتطف من الحكم.",
        inputSchema: z.object({
          query: z.string().describe("نص البحث"),
          court: z.string().optional().describe("حصر بمحكمة/دائرة (اختياري)"),
          year_h: z.number().optional().describe("السنة الهجرية (اختياري)"),
          limit: z.number().min(1).max(20).default(10),
        }),
      },
      async ({ query, court, year_h, limit }) => json(await hakeem.searchRulings(query, court, year_h, limit))
    );

    // ٧) حارس الإحالات — التحقق قبل العزو
    server.registerTool(
      "hakeem_verify_citation",
      {
        description:
          "التحقق من صحة إحالة نظامية قبل عزوها: هل المادة رقم كذا من نظام كذا موجودة فعلًا؟ وهل النص المنسوب إليها مطابق؟ يمنع اختلاق المواد. أرجِع: verdict (صحيحة/غير موجودة/نصها مختلف) + النص الفعلي.",
        inputSchema: z.object({
          law_name: z.string().describe("اسم النظام"),
          article_number: z.string().describe("رقم المادة"),
          claimed_text: z.string().optional().describe("النص المنسوب للمادة (اختياري — للمطابقة الحرفية)"),
        }),
      },
      async ({ law_name, article_number, claimed_text }) =>
        json(await hakeem.verifyCitation(law_name, article_number, claimed_text))
    );

    // ٨) البحث الموضوعي الشامل (توسيع مكنز + بحث هجين + حصر لفظي، مجمّع حسب النظام)
    server.registerTool(
      "hakeem_research",
      {
        description:
          "بحث موضوعي شامل باستدعاء واحد: يوسّع المصطلح من المكنز القانوني السعودي ثم يشغّل بحثات متوازية (دلالية + حصر لفظي) بكل النظائر، ويرجع النتائج مجمّعة حسب النظام مع إحصاء تغطية وقائمة الصيغ المستعملة. الأداة المفضلة لإعداد الدراسات والمذكرات.",
        inputSchema: z.object({
          topic: z.string().describe("المفهوم محل البحث، مثال: فسخ العقد"),
          extra_terms: z.array(z.string()).max(8).optional().describe("صيغ إضافية يضمّها المستخدم يدويًّا"),
          per_term_limit: z.number().int().min(3).max(20).default(8),
          law_id: z.string().optional().describe("اختياري: حصر البحث في نظام واحد"),
          strict: z
            .boolean()
            .default(true)
            .describe("افتراضي true: يُقصر التجميع على المواد التي تحتوي رأس الموضوع لفظًا؛ false يعرض نتائج الدلالي موسومة lexical_match=false"),
        }),
      },
      async ({ topic, extra_terms, per_term_limit, law_id, strict }) =>
        json(await handleResearch({ topic, extra_terms, per_term_limit, law_id, strict }))
    );

    // ٩) الحصر الشامل (كل المواد المطابقة لفظيًا، مع عداد إجمالي وترقيم cursor)
    server.registerTool(
      "hakeem_enumerate",
      {
        description:
          "حصر شامل (غير مرتَّب دلاليًا) لكل المواد التي تحتوي لفظًا أو أكثر. يرجع العدد الإجمالي، وتوزيعًا حسب النظام، وصفحة نتائج مع cursor للمتابعة. استخدمه للدراسات الحصرية بدل hakeem_search.",
        inputSchema: z.object({
          terms: z
            .array(z.string())
            .min(1)
            .max(12)
            .describe('الألفاظ المطلوب حصرها (OR بينها). مثال: ["فسخ","انفساخ","ينفسخ"]'),
          law_id: z.string().optional().describe("اختياري: حصر النتائج في نظام واحد"),
          page_size: z.number().int().min(1).max(50).default(25),
          cursor: z.string().optional().describe("معرّف آخر مادة من الصفحة السابقة للمتابعة"),
          snippet_len: z.number().int().min(120).max(2000).default(700),
        }),
      },
      async ({ terms, law_id, page_size, cursor, snippet_len }) =>
        json(await handleEnumerate({ terms, law_id, page_size, cursor, snippet_len }))
    );

    // ١٠) قراءة نطاق مواد متتابع بالنص الكامل (حتى ٢٠ مادة)
    server.registerTool(
      "hakeem_get_articles_range",
      {
        description:
          "قراءة نطاق متتابع من مواد نظام واحد بالنص الكامل (بحد أقصى ٢٠ مادة) — لقراءة سياق تشريعي كامل مثل فصلٍ بعينه، بدل جلب المواد واحدةً واحدة.",
        inputSchema: z.object({
          law_id: z.string(),
          from_article: z.number().int().min(1),
          to_article: z.number().int().min(1),
        }),
      },
      async ({ law_id, from_article, to_article }) =>
        json(await handleRange({ law_id, from_article, to_article }))
    );

    // ١١) دليل سير العمل للوكيل
    server.registerTool(
      "hakeem_guide",
      {
        description:
          "دليل استخدام مختصر: سير العمل الأمثل لأدوات حكيم بحسب نوع المهمة. استدعه أولًا عند المهام المركبة.",
        inputSchema: z.object({}),
      },
      async () => json(handleGuide())
    );

    // ١٢) جلب نص حكم قضائي كاملًا بمعرّفه مع تقطيع
    server.registerTool(
      "hakeem_get_ruling",
      {
        description:
          "جلب نص الحكم القضائي كاملًا بمعرّفه (ruling_id كما يرجع من hakeem_search_rulings أو hakeem_enumerate_rulings). الأحكام الطويلة تُرجَع مقطّعة: استخدم offset مع next_offset للمتابعة.",
        inputSchema: z.object({
          ruling_id: z.string().describe("معرّف الحكم"),
          offset: z.number().int().min(0).default(0).describe("موضع البداية بالحرف داخل النص (للمتابعة في الأحكام الطويلة)"),
          max_chars: z.number().int().min(1000).max(60000).default(30000).describe("أقصى عدد أحرف تُرجَع في الاستدعاء الواحد"),
        }),
      },
      async ({ ruling_id, offset, max_chars }) => json(await getRuling(ruling_id, offset, max_chars))
    );

    // ١٣) حصر شامل غير مسقوف للأحكام (عدّ حقيقيّ + توزيع بالمحكمة + ترقيم cursor)
    server.registerTool(
      "hakeem_enumerate_rulings",
      {
        description:
          "حصر شامل (غير مرتَّب دلاليًا) لكل الأحكام القضائية التي يرد فيها لفظ أو أكثر (OR بينها). يرجع العدد الإجمالي الحقيقي فوق كامل القاعدة، وتوزيعًا بحسب المحكمة، وصفحة نتائج مع cursor للمتابعة بلا سقف — يصلح للدراسات الحصرية (مئات أو آلاف الأحكام). استخدم count_only=true إذا أردت الأعداد فقط بسرعة.",
        inputSchema: z.object({
          terms: z
            .array(z.string().min(2))
            .min(1)
            .max(12)
            .describe('الألفاظ المطلوب حصرها (OR بينها). مثال: ["غبن","الغبن","مغبون"]'),
          court: z.string().optional().describe("حصر بمحكمة (مطابقة جزئية، اختياري)"),
          year_h: z.number().int().optional().describe("حصر بسنة هجرية (اختياري)"),
          count_only: z.boolean().default(false).describe("true = إرجاع الإجمالي والتوزيع فقط دون صفحة نتائج"),
          page_size: z.number().int().min(1).max(100).default(50),
          cursor: z.string().optional().describe("معرّف آخر حكم من الصفحة السابقة للمتابعة"),
          snippet_len: z.number().int().min(120).max(2000).default(500),
        }),
      },
      async ({ terms, court, year_h, count_only, page_size, cursor, snippet_len }) =>
        json(await enumerateRulings(terms, court, year_h, count_only, page_size, cursor, snippet_len))
    );
  },
  {
    serverInfo: { name: "hakeem-legal-mcp", version: "1.0.0" },
  }
);

/** تنسيق موحّد للمخرجات */
function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
}

/** مخرجات منظمة يفهمها النموذج وواجهة MCP Apps معاً. */
function structuredJson<T extends object>(data: T) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }],
  };
}

/** مصادقة اختيارية بمفتاح: تُفعَّل تلقائيًا إذا عُرّف HAKEEM_MCP_KEY في متغيرات البيئة */
function withAuth(h: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    // تشذيب قيمة البيئة: يتجاوز سطرًا/فراغًا زائدًا شائعًا عند لصق المتغيّر في Vercel.
    const expected = process.env.HAKEEM_MCP_KEY?.trim();
    if (expected) {
      const url = new URL(req.url);
      // يُقبل المفتاح من هيدر x-api-key أو من ?key= — مع تشذيب الطرفين قبل المقارنة.
      const raw = req.headers.get("x-api-key") ?? url.searchParams.get("key");
      const provided = raw?.trim();
      // 403 بلا WWW-Authenticate: رفض صريح لا يُفسَّر لدى عميل MCP كدعوة OAuth (401).
      if (provided !== expected) return new Response("Forbidden", { status: 403 });
    }
    return h(req);
  };
}

export const GET = withAuth(handler);
export const POST = withAuth(handler);
export const DELETE = withAuth(handler);
