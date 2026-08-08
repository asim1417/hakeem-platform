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

// Prisma يتطلّب بيئة Node (لا Edge)، والمخرجات ديناميكية دائمًا.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
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
  },
  {
    serverInfo: { name: "hakeem-legal-mcp", version: "1.0.0" },
  }
);

/** تنسيق موحّد للمخرجات */
function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
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
