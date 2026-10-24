/**
 * HKM-044 المرحلة الأولى: تسجيل الأدوات الاثنتي عشرة على خادم MCP (مقتبسة من مواصفة أدوات الباحث).
 * كل أداة تمرّ بـ runMcpTool (المعدّل، الباقة، الرصيد، السقف الزمني، السجل) كبقية أدوات حكيم.
 * القاعدة: mcpSql() (Prisma عبر SqlClient)، والنص الساري ورابط الموقع: mcpDeps().
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zodv4";
import { mcpDeps, mcpSql } from "@/lib/mcp/adapter";
import { runMcpTool } from "@/lib/mcp/tool-runner";
import { MCP_TOOL_POLICY } from "@/config/mcp-tools";
import { WORK_KINDS } from "@/lib/modules/legal-core/work-kind";
import { handleHealth, handleListCategories, handleListLaws, handleResolve, handleStats } from "@/lib/mcp/tools/catalog";
import { handleSearchBoolean, handleSearchPhrase, handleTraceText } from "@/lib/mcp/tools/text-search";
import { handleCheckRef, handleGetCitation, handleGetToc } from "@/lib/mcp/tools/citation";
import { handleSemanticSearch } from "@/lib/mcp/tools/semantic";

const kindEnum = z.enum(WORK_KINDS);

/** المرشحات المشتركة لأدوات البحث (العقد المشترك). */
function filterShape(defaultStatus: "in_force" | "all") {
  return {
    law_id: z.string().optional().describe("حصر في نظام واحد (معرّفه)"),
    law_ids: z.array(z.string()).max(50).optional().describe("حصر في عدة أنظمة"),
    category: z.string().max(120).optional().describe("التصنيف: رمزه أو اسمه كما في hakeem_list_categories"),
    kind: kindEnum.optional().describe("نوع التشريع"),
    status: z
      .enum(["in_force", "all"])
      .default(defaultStatus)
      .describe(defaultStatus === "in_force" ? "in_force (الافتراض) يستبعد الأنظمة الملغاة، all يدخلها" : "all (الافتراض) كل الأنظمة، in_force بلا الملغاة"),
    issued_from_h: z.number().int().min(1300).max(1500).optional().describe("سنة الإصدار الهجرية من"),
    issued_to_h: z.number().int().min(1300).max(1500).optional().describe("سنة الإصدار الهجرية إلى"),
  };
}

export function registerPhase1Tools(server: McpServer) {
  server.registerTool(
    "hakeem_health",
    {
      description: "حالة خادم حكيم: الوصول إلى القاعدة وزمنه، أعداد المدونة، وهل البحث الدلالي مفعّل. استدعه حين تفشل أداة أو تتأخر.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) =>
      runMcpTool("hakeem_health", ctx, async () => {
        const { semanticSearchEnabled } = await import("@/lib/modules/ai/embeddings");
        return handleHealth(mcpSql(), { tools: Object.keys(MCP_TOOL_POLICY).length, semantic: semanticSearchEnabled() });
      }),
  );

  server.registerTool(
    "hakeem_stats",
    {
      description:
        "ما في المدونة فعلًا: الأنظمة بأنواعها وحالاتها (من سجل التحقق)، والمواد، والمواد ذات النسخ المؤرخة، والأحكام بمحاكمها وسنواتها، وروابط اللوائح، ومفاهيم المكنز. للحكم على حدود التغطية قبل النفي.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => runMcpTool("hakeem_stats", ctx, () => handleStats(mcpSql())),
  );

  server.registerTool(
    "hakeem_list_categories",
    {
      description: "تصنيفات المدونة (المجالات) وأنواع التشريع بأعداد أنظمتها والساري منها — لتضييق البحث بـ category أو kind.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => runMcpTool("hakeem_list_categories", ctx, () => handleListCategories(mcpSql())),
  );

  server.registerTool(
    "hakeem_list_laws",
    {
      description:
        "تصفّح الأنظمة بلا كلمة بحث: بالتصنيف أو النوع أو الحالة أو سنة الإصدار الهجرية، مرتّبة بالاسم أو بالأحدث إصدارًا، بصفحات (next_offset). لكل نظام: المعرّف، النوع، التصنيف، الحالة، سنة الإصدار، عدد المواد. الافتراض هنا كل الحالات.",
      inputSchema: z.object({
        ...filterShape("all"),
        sort: z.enum(["name", "issued"]).default("name").describe("name بالاسم، issued الأحدث إصدارًا أولًا"),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async (args, ctx) =>
      runMcpTool("hakeem_list_laws", ctx, () => {
        const { law_id, law_ids, ...rest } = args;
        const ids = [...(law_ids ?? []), ...(law_id ? [law_id] : [])];
        return handleListLaws(mcpSql(), { ...rest, ...(ids.length ? { law_ids: ids } : {}) });
      }),
  );

  server.registerTool(
    "hakeem_resolve",
    {
      description:
        "حسم اسم نظام مرسَل أو مختصر أو فيه خطأ إملائي إلى معرّفه: «المعاملات المدنيه» ← نظام المعاملات المدنية. يرجع المرشحين بدرجة المطابقة (exact/prefix/contains/fuzzy) وحالة كل نظام. استدعه قبل أي أداة تحتاج law_id.",
      inputSchema: z.object({
        q: z.string().min(2).max(200).describe("اسم النظام كما كتبه المستخدم"),
        kind: kindEnum.optional().describe("حصر بنوع التشريع (اختياري)"),
        limit: z.number().int().min(1).max(20).default(5),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_resolve", ctx, () => handleResolve(mcpSql(), args)),
  );

  server.registerTool(
    "hakeem_search_phrase",
    {
      description:
        "عبارة بكلماتها بترتيبها في مواد المدونة، حصرًا كاملًا بالعدد والتوزيع حسب النظام وترقيم cursor. match=exact الكلمات نفسها بلا سوابق ولا لواحق؛ word (الافتراض) يقبل السوابق واللواحق لكل كلمة؛ derivatives يضيف الاشتقاق. المقتطف حول موضع العبارة. الافتراض يستبعد الأنظمة الملغاة.",
      inputSchema: z.object({
        phrase: z.string().min(2).max(300).describe("العبارة"),
        match: z.enum(["exact", "word", "derivatives"]).default("word"),
        ...filterShape("in_force"),
        page_size: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional().describe("next_cursor من الصفحة السابقة"),
        snippet_len: z.number().int().min(120).max(2000).default(400),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_search_phrase", ctx, () => handleSearchPhrase(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_search_boolean",
    {
      description:
        'استعلام منطقي في مواد المدونة: الألفاظ المتجاورة AND، و«أو»/OR، و«دون»/NOT أو -لفظ، وأقواس، والعبارة بين "…" أو «…». مثال: (فسخ أو انفساخ) عقد دون تعويض. حصر كامل بالعدد والتوزيع وcursor، وparsed يبيّن كيف فُهم الاستعلام، والخطأ في الصيغة يُشرح. كل لفظ كلمة كاملة (match=word أو derivatives أو exact).',
      inputSchema: z.object({
        query: z.string().min(2).max(500),
        match: z.enum(["word", "derivatives", "exact"]).default("word"),
        ...filterShape("in_force"),
        page_size: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
        snippet_len: z.number().int().min(120).max(2000).default(400),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_search_boolean", ctx, () => handleSearchBoolean(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_semantic_search",
    {
      description:
        "البحث بالمعنى وحده في المواد، لسؤال لا يُعرف لفظه في النظام («كم مدة الاستئناف؟»). يعيد ترتيب أقرب 20 مادة بالمتجهات بالتشابه وتغطية ألفاظ السؤال واسم النظام إن ذُكر. ليس حصرًا ولا نفيًا؛ status=disabled إن لم يكن البحث الدلالي مفعّلًا.",
      inputSchema: z.object({
        query: z.string().min(2).max(500),
        ...filterShape("in_force"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_semantic_search", ctx, () => handleSemanticSearch(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_trace_text",
    {
      description:
        "من أين هذا النص؟ يقارن اقتباسًا (3 كلمات فأكثر، حتى 300) بمواد المدونة كلمةً بكلمة: verbatim حرفي، near_verbatim بتصرّف يسير، partial جزئي، fragment عبارات قصيرة، not_found. ينبّه إن طابق نص المادة قبل تعديلها أو مادة ملغاة، ويذكر كلمات الاقتباس التي ليست في المادة. include_rulings يفحص الأحكام بأول ست كلمات. الافتراض كل الأنظمة.",
      inputSchema: z.object({
        text: z.string().min(5).max(4000),
        include_rulings: z.boolean().default(false),
        ...filterShape("all"),
        limit: z.number().int().min(1).max(10).default(5),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_trace_text", ctx, () => handleTraceText(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_get_citation",
    {
      description:
        "صيغة الاستناد لمادة (article_id) أو حكم (ruling_id): short «المادة (12) من نظام العمل»، full مع أداة الإصدار وأداة التعديل أو الإلغاء، footnote للحاشية مع الرابط وتاريخ النص. يعيد ref بصمة النص الساري لـ hakeem_check_ref.",
      inputSchema: z.object({
        article_id: z.string().optional().describe("معرّف المادة"),
        ruling_id: z.string().optional().describe("أو معرّف الحكم"),
        style: z.enum(["short", "full", "footnote"]).default("full"),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_get_citation", ctx, () => handleGetCitation(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_check_ref",
    {
      description:
        "هل ما زال نص المادة كما اقتُبس؟ مرّر ref (hakeem:art:<article_id>:<بصمة>) من hakeem_get_citation أو hakeem_verify_citation: valid كما هو، changed تغيّر (amended_since_ref = عُدّلت بعد البصمة)، repealed أُلغيت، not_found. يعيد النص الساري والبصمة الحالية.",
      inputSchema: z.object({ ref: z.string().min(6).max(120) }),
    },
    async (args, ctx) => runMcpTool("hakeem_check_ref", ctx, () => handleCheckRef(mcpSql(), args, mcpDeps())),
  );

  server.registerTool(
    "hakeem_get_toc",
    {
      description:
        "أبواب النظام وفصوله (divisions: العنوان، أول مادة وآخرها، عددها) وفهرس مواده صفحاتٍ بحالاتها (articles_page.next_offset). بالمعرّف أو بالاسم. لنص المواد hakeem_get_articles_range.",
      inputSchema: z.object({
        law_id: z.string().optional(),
        name: z.string().max(200).optional(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(300).default(100),
      }),
    },
    async (args, ctx) => runMcpTool("hakeem_get_toc", ctx, () => handleGetToc(mcpSql(), args, mcpDeps())),
  );
}
