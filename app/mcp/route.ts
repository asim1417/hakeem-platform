/**
 * حكيم MCP — المسار الرئيسي
 * يكشف مكنز حكيم القانوني (الأنظمة السعودية، موادها، والأحكام القضائية)
 * كمصدر تشريعي رسمي تقرأ منه نماذج الذكاء الاصطناعي مباشرة.
 *
 * التثبيت: npm i mcp-handler @modelcontextprotocol/sdk zod
 * الرابط بعد النشر: https://hakeem-platform.vercel.app/mcp
 */
import { createMcpHandler, withMcpAuth } from "mcp-handler";
// خادم MCP (@modelcontextprotocol/server) يبني مخططاته على Zod v4 ويتطلّب
// «~standard.jsonSchema» (غير الموجود في Zod v3 المعتمد في بقيّة المشروع). لذا
// نستورد Zod v4 باسم مستعار (zodv4) هنا فقط — دون المساس بـ zod v3 في سائر الكود.
import { z } from "zodv4";
import * as hakeem from "@/lib/mcp/adapter";
import { handleEnumerate } from "@/lib/mcp/tools/enumerate";
import { handleResearch } from "@/lib/mcp/tools/research";
import { handleRange, handleGuide } from "@/lib/mcp/tools/range-and-guide";
import { getRuling, enumerateRulings } from "@/lib/mcp/tools/rulings";
import { registerAmanTools } from "@/lib/mcp/aman-server";
import { mcpAccessMode, mcpClosedResponse } from "@/lib/mcp/policy";
import { verifyMcpRequest } from "@/lib/mcp/principal";
import { runMcpTool } from "@/lib/mcp/tool-runner";

// Prisma يتطلّب بيئة Node (لا Edge)، والمخرجات ديناميكية دائمًا.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
    registerAmanTools(server);

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
      async ({ query, law_id, limit }, ctx) => runMcpTool("hakeem_search", ctx, () => hakeem.searchArticles(query, law_id, limit))
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
      async ({ article_id }, ctx) => runMcpTool("hakeem_get_article", ctx, () => hakeem.getArticle(article_id))
    );

    // ٣) بطاقة النظام وفهرسه
    server.registerTool(
      "hakeem_get_law",
      {
        description:
          "بطاقة نظام سعودي: الاسم الرسمي، التصنيف، أدوات الإصدار (issue_instruments)، التواريخ الأربعة، الحالة، وصف المقدمة، وفهرس مواده (toc) صفحاتٍ: الافتراض أول 100 مادة، وtoc_page.next_offset للصفحة التالية (toc_offset وtoc_limit حتى 300). نص المقدمة لا يُعاد إلا بـ include_preamble=true. في كل مادة status (ساري/معدّل/ملغى) إن كانت موثّقة، وغيابه = غير مؤكد، وrepealed_by للملغاة بأداة خاصة بها، وbis/key للمادة المكررة («12 مكرر» = key 12_bis). رابط المادة: article_url_template مع key (أو number). data_warnings ينبّه إلى بيانات مشكوك فيها (مثل أداة إلغاء هي أداة الإصدار نفسها، فلا تُعرض). بالاسم: المطابقة التامة أولًا ثم «يبدأ بـ» ثم الاحتواء، مع البدائل في match. لنص المواد: hakeem_get_articles_range.",
        inputSchema: z.object({
          law_id: z.string().optional().describe("معرّف النظام"),
          name: z.string().optional().describe("أو البحث باسم النظام"),
          toc_offset: z.number().int().min(0).default(0).describe("بداية صفحة الفهرس (toc_page.next_offset من الاستدعاء السابق)"),
          toc_limit: z.number().int().min(1).max(300).default(100).describe("عدد مواد صفحة الفهرس"),
          include_preamble: z.boolean().default(false).describe("true = إعادة نص المقدمة (حتى 12 ألف حرف)"),
        }),
      },
      async ({ law_id, name, toc_offset, toc_limit, include_preamble }, ctx) =>
        runMcpTool("hakeem_get_law", ctx, () => hakeem.getLaw(law_id, name, { tocOffset: toc_offset, tocLimit: toc_limit, includePreamble: include_preamble }))
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
      async ({ law_id }, ctx) => runMcpTool("hakeem_bylaw_links", ctx, () => hakeem.getBylawLinks(law_id))
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
      async ({ term }, ctx) => runMcpTool("hakeem_expand_terms", ctx, () => hakeem.expandTerms(term))
    );

    // ٦) البحث في الأحكام
    server.registerTool(
      "hakeem_search_rulings",
      {
        description:
          "البحث في قاعدة الأحكام القضائية السعودية وحدها (كلمات كاملة مع السوابق، لا منافسة مع المواد): رقم القضية، المحكمة، السنة الهجرية، ومقتطف من موضع المطابقة في الأسباب أو المنطوق، وبداية المنطوق، وخريطة أجزاء الحكم. أسماء الأفراد محجوبة في النصوص ولا يُبحث بها: الاستعلام الذي تطابق ألفاظه داخل أسماء الأفراد غالبًا لا يطابق شيئًا، والحكم الذي لا يطابق إلا داخل اسم لا يُعاد. total عدد ما أُعيد، وtotal_is_lower_bound أن الصفحة امتلأت. النتائج من أول 100 مرشح بالترتيب، فقد تنقص الصفحة أو تفرغ إن تقدّمها ما لا يطابق إلا داخل اسم؛ فإن قلّت فضيّق الاستعلام (محكمة أو سنة أو لفظ أخص) أو استعمل hakeem_enumerate_rulings.",
        inputSchema: z.object({
          query: z.string().max(500).describe("نص البحث"),
          court: z.string().optional().describe("حصر بمحكمة/دائرة (اختياري)"),
          year_h: z.number().int().optional().describe("السنة الهجرية (اختياري)"),
          limit: z.number().min(1).max(20).default(10),
        }),
      },
      async ({ query, court, year_h, limit }, ctx) => runMcpTool("hakeem_search_rulings", ctx, () => hakeem.searchRulings(query, court, year_h, limit))
    );

    // ٧) حارس الإحالات — التحقق قبل العزو
    server.registerTool(
      "hakeem_verify_citation",
      {
        description:
          "التحقق من صحة إحالة نظامية قبل عزوها: هل المادة رقم كذا من نظام كذا موجودة فعلًا؟ وهل النص المنسوب إليها مطابق؟ يمنع اختلاق المواد. أرجِع: verdict (صحيحة/غير موجودة/نصها مختلف) + النص الفعلي.",
        inputSchema: z.object({
          law_name: z.string().describe("اسم النظام"),
          article_number: z.string().describe("رقم المادة (يقبل «12 مكرر» و«12 مكرر 2»)"),
          claimed_text: z.string().optional().describe("النص المنسوب للمادة (اختياري — للمطابقة الحرفية)"),
          article_bis: z.number().int().min(0).optional().describe("درجة «مكرر» (اختياري: 0 للأصل، 1 لـ«مكرر»، 2 لـ«مكرر 2»…) — تغلب ما في article_number"),
        }),
      },
      async ({ law_name, article_number, claimed_text, article_bis }, ctx) =>
        runMcpTool("hakeem_verify_citation", ctx, () => hakeem.verifyCitation(law_name, article_number, claimed_text, article_bis))
    );

    // ٨) البحث الموضوعي الشامل (توسيع مكنز + بحث هجين + حصر لفظي، مجمّع حسب النظام)
    server.registerTool(
      "hakeem_research",
      {
        description:
          "بحث موضوعي شامل باستدعاء واحد: يوسّع المصطلح من المكنز القانوني السعودي ثم يشغّل بحثات متوازية (دلالية + حصر لفظي) بكل النظائر، ويرجع النتائج مجمّعة حسب النظام مع إحصاء تغطية وقائمة الصيغ المستعملة. الحصر اللفظي لرأس الموضوع وصيغه كلماتٍ كاملة مع حروف الاشتقاق (لا جزء كلمة)، والشمول لفظي لا دلالي كما تقول note. الأداة المفضلة لإعداد الدراسات والمذكرات.",
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
      async ({ topic, extra_terms, per_term_limit, law_id, strict }, ctx) =>
        runMcpTool("hakeem_research", ctx, () => handleResearch({ topic, extra_terms, per_term_limit, law_id, strict }))
    );

    // ٩) الحصر الشامل (كل المواد المطابقة لفظيًا، مع عداد إجمالي وترقيم cursor)
    server.registerTool(
      "hakeem_enumerate",
      {
        description:
          "حصر شامل (غير مرتَّب دلاليًا) لكل المواد التي يرد فيها لفظ أو أكثر (OR بينها). المطابقة كلمة كاملة لا جزء كلمة: match=word (الافتراض) يقبل السوابق (و، ف، ب، ك، ل، ال، لل) ولواحق التصريف والضمائر، فلا تطابق «التعدي» «التعديل» ولا «ربا» «الأرباح»؛ وmatch=derivatives يضيف حروف المضارعة والاشتقاق (فسخ ← يفسخ، انفسخ، ينفسخ، مفسوخ تحتاج «فسوخ»)؛ وmatch=contains الاحتواء الحرفي القديم بضجيجه. العبارة كلماتها بترتيبها. يرجع العدد الإجمالي، وتوزيعًا حسب النظام، وصفحة نتائج مع cursor للمتابعة، وmatch وscope وnote: total=0 نفي في النطاق وبالصيغ المطلوبة وحدها. استخدمه للدراسات الحصرية بدل hakeem_search.",
        inputSchema: z.object({
          terms: z
            .array(z.string())
            .min(1)
            .max(12)
            .describe('الألفاظ المطلوب حصرها (OR بينها). مثال: ["فسخ","انفساخ","مفسوخ"]'),
          law_id: z.string().optional().describe("اختياري: حصر النتائج في نظام واحد"),
          match: z.enum(["word", "derivatives", "contains"]).default("word").describe("word كلمة كاملة (الافتراض)، derivatives مع حروف الاشتقاق، contains جزء كلمة"),
          page_size: z.number().int().min(1).max(50).default(25),
          cursor: z.string().optional().describe("معرّف آخر مادة من الصفحة السابقة للمتابعة"),
          snippet_len: z.number().int().min(120).max(2000).default(700),
        }),
      },
      async ({ terms, law_id, match, page_size, cursor, snippet_len }, ctx) =>
        runMcpTool("hakeem_enumerate", ctx, () => handleEnumerate({ terms, law_id, match, page_size, cursor, snippet_len }))
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
      async ({ law_id, from_article, to_article }, ctx) =>
        runMcpTool("hakeem_get_articles_range", ctx, () => handleRange({ law_id, from_article, to_article }))
    );

    // ١١) دليل سير العمل للوكيل
    server.registerTool(
      "hakeem_guide",
      {
        description:
          "دليل استخدام مختصر: سير العمل الأمثل لأدوات حكيم بحسب نوع المهمة. استدعه أولًا عند المهام المركبة.",
        inputSchema: z.object({}),
      },
      async (_args, ctx) => runMcpTool("hakeem_guide", ctx, () => handleGuide())
    );

    // ١٢) جلب نص حكم قضائي كاملًا بمعرّفه مع تقطيع
    server.registerTool(
      "hakeem_get_ruling",
      {
        description:
          "جلب نص الحكم القضائي بمعرّفه (ruling_id كما يرجع من hakeem_search_rulings أو hakeem_enumerate_rulings). يرجع خريطة أجزاء الحكم (parts). لقراءة علّة الحكم مباشرة مرّر part=reasons، وللنتيجة part=disposition، بدل قراءة الديباجة. الأحكام الطويلة تُرجَع مقطّعة: استخدم offset مع next_offset للمتابعة.",
        inputSchema: z.object({
          ruling_id: z.string().describe("معرّف الحكم"),
          part: z
            .enum(["header", "claims", "defense", "reasons", "disposition", "appeal", "other"])
            .optional()
            .describe("جزء بعينه: reasons الأسباب، disposition المنطوق، claims الدعوى، defense الإجابة والدفوع، appeal الاعتراض (اختياري؛ بدونه النص كله)"),
          offset: z.number().int().min(0).default(0).describe("موضع البداية بالحرف داخل الجزء أو النص (للمتابعة)"),
          max_chars: z.number().int().min(1000).max(60000).default(30000).describe("أقصى عدد أحرف تُرجَع في الاستدعاء الواحد"),
        }),
      },
      async ({ ruling_id, part, offset, max_chars }, ctx) => runMcpTool("hakeem_get_ruling", ctx, () => getRuling(ruling_id, offset, max_chars, part))
    );

    // ١٣) حصر شامل للأحكام (عدّ + توزيع بالمحكمة + ترقيم cursor بلا سقف)
    server.registerTool(
      "hakeem_enumerate_rulings",
      {
        description:
          "حصر شامل (غير مرتَّب دلاليًا) لكل الأحكام القضائية التي يرد فيها لفظ أو أكثر (OR بينها). اللفظ العربي كلمات كاملة مع السوابق (و، ب، ل، ال…) والعبارة بترتيب كلماتها، لا جزء كلمة؛ فاذكر صيغ الكلمة المختلفة ألفاظًا مستقلة. يرجع العدد والتوزيع بحسب المحكمة، وصفحة نتائج مع cursor للمتابعة بلا سقف — يصلح للدراسات الحصرية (مئات أو آلاف الأحكام): تابع cursor حتى يصير null لتجمع كل الأحكام (آخر صفحة فارغة دائمًا؛ وإن خلت 600 مطابقة متتالية من حكم ظاهر انتهى الحصر عندها). استخدم count_only=true إذا أردت الأعداد فقط. أسماء الأفراد محجوبة ولا يُحصر بها: اللفظ الذي يرد في أسماء الأفراد غالبًا لا يُحصر (لا عدد له ولا نتائج)، والحكم الذي لا يطابقه لفظ إلا داخل اسم لا يُعاد ولا يُعدّ. للفظ فيه حرف يُحسب العدد والتوزيع من الأحكام الظاهرة في أول 600 مطابقة بترتيب المعرّف حتى 200، وما فوقها total_is_lower_bound=true؛ فالعدد تقريبي، والتوزيع عند بلوغ السقف من أول 200 بترتيب المعرّف لا عيّنة ممثلة، والعدد والتوزيع الكاملان بمتابعة الصفحات حتى نهايتها؛ ولألفاظ الأرقام وحدها (رقم القضية أو القرار) العدد من القاعدة كاملًا.",
        inputSchema: z.object({
          terms: z
            .array(z.string().min(2).max(200))
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
      async ({ terms, court, year_h, count_only, page_size, cursor, snippet_len }, ctx) =>
        runMcpTool("hakeem_enumerate_rulings", ctx, () => enumerateRulings(terms, court, year_h, count_only, page_size, cursor, snippet_len))
    );
  },
  {
    serverInfo: { name: "hakeem-legal-mcp", version: "1.0.0" },
  }
);

function withEmptyPrompts(inner: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "POST" && (req.headers.get("content-type") || "").includes("application/json")) {
      const body = await req.clone().json().catch(() => null);
      if (body && typeof body === "object" && (body as { method?: string }).method === "prompts/list") {
        const id = (body as { id?: unknown }).id ?? null;
        const payload = JSON.stringify({ jsonrpc: "2.0", id, result: { prompts: [] } });
        return new Response(`event: message\ndata: ${payload}\n\n`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
        });
      }
    }
    return inner(req);
  };
}

// السياسة تُقرأ لكل طلب: مغلق افتراضيًا (503) إن لم يُضبط مفتاح مشترك ولا سرّ تصاريح، ما لم يُفتح
// صراحةً بـ HAKEEM_MCP_ALLOW_OPEN=1. صاحب الطلب (فريق أمان / مستخدم / مفتوح) يُمرَّر للأدوات عبر AuthInfo.
const authOptions = {
  resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
  requiredScopes: ["mcp:read"],
};

const authedHandler = withMcpAuth(withEmptyPrompts(handler), (req, bearer) => verifyMcpRequest(req, bearer), {
  required: true,
  ...authOptions,
});

const openHandler = withMcpAuth(
  withEmptyPrompts(handler),
  async () => ({ token: "open", clientId: "public", scopes: ["mcp:read"], extra: { principal: { kind: "open" } } }),
  { required: false, ...authOptions }
);

async function gate(req: Request): Promise<Response> {
  const mode = mcpAccessMode();
  if (mode === "closed") return mcpClosedResponse();
  return mode === "auth" ? authedHandler(req) : openHandler(req);
}

export const GET = gate;
export const POST = gate;
export const DELETE = gate;
