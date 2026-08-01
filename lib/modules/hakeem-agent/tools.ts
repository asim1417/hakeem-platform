// سجلّ الأدوات — قدرات Claude التنفيذيّة بمخطّطات صارمة. Claude يختارها بنفسه؛ الكود
// يتحقّق من المدخلات وينفّذ ويعيد النتيجة إليه. كلّ مصدرٍ قانونيّ يعود بمعرّفه الحقيقيّ
// (sourceId = معرّف المادة في النواة) فيبقى الإسناد مؤصَّلًا ولا يخترع Claude رقمًا.
import { prisma } from "@/lib/prisma";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { resolveGoverningSystems } from "@/lib/modules/agents/thinking/resolve-scope";
import {
  DEFAULT_SOURCE_POLICY,
  decideToolAccess,
  isRetrievalTool,
  type SourcePolicy,
} from "@/lib/modules/hakeem-composer/source-policy";
import { loadSkillGuide, skillsIndex } from "./skills";

/** مصدرٌ استُرجِع خلال الجلسة — يُجمَّع للأساس (basis) ولحارس الإسناد. */
export interface RetrievedSource {
  sourceId: string;
  systemName: string;
  articleNumber: number;
  articleTitle: string;
  snippet: string;
  status: string | null;
  internalUrl: string;
  /** رقم الحاشية الثابت (١..n) بترتيب أوّل استرجاع — يستشهد به Claude كـ[n] فيُربَط بالنصّ أسفل الدراسة. */
  cite: number;
}

/** سياق الجلسة الذي تعمل عليه الأدوات — يحمل المستند المرفق ويجمع المصادر المستَرجَعة. */
export interface AgentAttachmentDoc {
  id: string;
  fileName: string;
  text: string;
  status?: string;
  pages?: Array<{
    pageNumber: number;
    text: string;
    status: string;
    confidence?: number;
    warning?: string;
  }>;
  provenance?: string;
}

export interface AgentContext {
  document: string;
  /** مرفقات دائمة محمّلة بالمعرّف (ATTACHMENTS_V2) */
  attachments: Map<string, AgentAttachmentDoc>;
  /** المصادر المستَرجَعة عبر الجلسة، مفهرسةً بمعرّفها (منع التكرار). */
  sources: Map<string, RetrievedSource>;
  /** سياسة مصادر مُنفَّذة خادميًا (لا تعتمد على امتثال النموذج) */
  sourcePolicy: SourcePolicy;
  /** أدوات رُفضت بسبب السياسة */
  deniedTools: Array<{ tool: string; reason: string }>;
  /** أدوات استرجاع استُدعيت فعلًا بنجاح */
  invokedTools: string[];
  /** صفحات استُخدمت عبر read_attachment (للتدقيق) */
  auditedPageReads: Array<{ attachmentId: string; pageNumbers: number[]; textFallback: boolean }>;
}

export function createAgentContext(
  document: string,
  sourcePolicy: SourcePolicy = DEFAULT_SOURCE_POLICY,
  attachments?: AgentAttachmentDoc[]
): AgentContext {
  const map = new Map<string, AgentAttachmentDoc>();
  for (const a of attachments ?? []) {
    if (a.id) map.set(a.id, a);
  }
  return {
    document: document ?? "",
    attachments: map,
    sources: new Map(),
    sourcePolicy,
    deniedTools: [],
    invokedTools: [],
    auditedPageReads: [],
  };
}

/**
 * يضيف مصدرًا إلى سياق الجلسة ويمنحه رقم حاشيةٍ ثابتًا (cite) بترتيب أوّل استرجاع. عند تكرار
 * المعرّف يُعيد المصدر القائم بحاشيته الأصليّة (لا يُعيد الترقيم) — فيبقى [n] ثابتًا عبر الأدوار.
 */
function addSource(ctx: AgentContext, src: Omit<RetrievedSource, "cite">): RetrievedSource {
  const existing = ctx.sources.get(src.sourceId);
  if (existing) return existing;
  const withCite: RetrievedSource = { ...src, cite: ctx.sources.size + 1 };
  ctx.sources.set(withCite.sourceId, withCite);
  return withCite;
}

// ── تعريفات الأدوات (مخطّط Anthropic) ──
export const HAKEEM_TOOL_DEFS = [
  {
    name: "resolve_scope",
    description:
      "حدّد الأنظمة السعودية الحاكمة لمسألةٍ قانونية قبل البحث. استعملها حين لا يكون النطاق واضحًا لتضييق البحث. لا تستعملها للتحية أو الحديث العام.",
    input_schema: {
      type: "object",
      required: ["question"],
      properties: { question: { type: "string", description: "المسألة القانونية بصياغةٍ واضحة." } },
    },
  },
  {
    name: "legal_search",
    description:
      "ابحث في مصادر الأنظمة السعودية الموثّقة (النواة القانونية) حين يحتاج المستخدم إلى حكمٍ أو مادةٍ أو نظامٍ مؤصَّل. لا تستعملها للتحية أو الاستماع أو تلخيص كلام المستخدم أو الصياغة اللغوية المجرّدة. كلّ نتيجةٍ تعود بمعرّفها (sourceId) لتستشهد به.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "عبارة البحث القانونية." },
        systemIds: { type: "array", items: { type: "string" }, description: "معرّفات الأنظمة من resolve_scope لتضييق النطاق (اختياري)." },
        limit: { type: "integer", minimum: 1, maximum: 30, description: "أقصى عدد نتائج (افتراضي 8)." },
      },
    },
  },
  {
    name: "comprehensive_legal_scan",
    description:
      "مسحٌ شاملٌ عبر **كلّ الأنظمة** (بلا حصر نطاق) بسقفٍ عالٍ — كمسح المكتبة الكاملة. استعمله حين تحتاج تغطيةً استقصائيّة لا تفوّت نظامًا (مثل «كلّ الأنظمة المتعلّقة بـ…» أو للتأكّد من عدم إغفال نظامٍ حاكم). يعيد إجماليّ المطابقات، وهل الترتيب شامل، وتوزيعًا لكلّ نظامٍ وعدد مواده — فتعرف أين تعمّق.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "موضوع المسح القانونيّ." },
        limit: { type: "integer", minimum: 10, maximum: 60, description: "أقصى مواد تُعاد (افتراضي 40)." },
      },
    },
  },
  {
    name: "deep_legal_study",
    description:
      "الدراسة الموسّعة القويّة: للقضايا الحقيقية المكتملة الوقائع. يُجري تفكيكًا أصوليًّا للمسائل (المناط + الكلمات) وتحديدًا للأنظمة الحاكمة (المظانّ) واسترجاعًا شاملًا للمواد المؤصَّلة والسوابق والمبادئ وحالة التغطية — دفعةً واحدة. استعمله حين تقرّر إعداد دراسةٍ قانونية كاملة (تفكيك/تكييف/تأصيل)، لا لسؤالٍ بسيط (استعمل legal_search).",
    input_schema: {
      type: "object",
      required: ["question"],
      properties: { question: { type: "string", description: "المسألة/القضية بوقائعها وطلبها، بصياغةٍ وافية (كلّما زادت الوقائع دقّ التفكيك والتأصيل)." } },
    },
  },
  {
    name: "fetch_legal_source",
    description: "اقرأ النصّ الكامل لمادةٍ بمعرّفها (sourceId) الذي أعاده legal_search، قبل الاستشهاد الدقيق بها.",
    input_schema: {
      type: "object",
      required: ["sourceId"],
      properties: { sourceId: { type: "string", description: "معرّف المادة من نتيجة legal_search." } },
    },
  },
  {
    name: "read_attachment",
    description:
      "اقرأ نصّ المستند المرفق في هذه الجلسة. مرّر attachmentIds لمعرفات المرفقات الدائمة إن وُجدت، أو اتركها فارغة لقراءة مستند الجلسة.",
    input_schema: {
      type: "object",
      properties: {
        attachmentIds: {
          type: "array",
          items: { type: "string" },
          description: "معرفات Attachment المملوكة في هذه الجلسة.",
        },
        pageRange: {
          type: "object",
          properties: {
            from: { type: "integer", minimum: 1 },
            to: { type: "integer", minimum: 1 },
          },
          description: "نطاق صفحات اختياري (إن توفّرت صفحات).",
        },
        queryHint: { type: "string", description: "تلميح موضوعي لاختيار المقتطف (اختياري)." },
      },
    },
  },
  {
    name: "islamic_library_scan",
    description:
      "ابحث في المكتبة الإسلامية (الشاملة) للبُعد الفقهيّ الاستئناسيّ — نصوصٌ فقهيّة/حديثيّة بمصادرها (كتاب/مؤلّف). استعمله حين يحتاج التحليل تأصيلًا فقهيًّا مكمّلًا للنظام (لا بديلًا عنه)؛ المصدر النظاميّ الحاكم يبقى النواة القانونيّة. استشهد بالكتاب والمؤلّف كما وردا من النتيجة — لا تخترع.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "موضوع البحث الفقهيّ/الحديثيّ." },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "أقصى نصوص (افتراضي 8)." },
      },
    },
  },
  {
    name: "load_skill",
    description:
      "حمّل منهج عملٍ متخصّص (مهارة) لتتّبعه في مهمّةٍ معيّنة. المهارات المتاحة: " +
      skillsIndex().map((s) => `«${s.name}» (${s.description})`).join(" · "),
    input_schema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string", description: "اسم المهارة كما في القائمة." } },
    },
  },
] as const;

export type ToolName = (typeof HAKEEM_TOOL_DEFS)[number]["name"];

// ── منفّذ الأدوات ──
export interface ToolExecResult {
  ok: boolean;
  /** حمولةٌ تعود إلى Claude كـ tool_result (JSON-صديقة). */
  data: unknown;
  /** ملصقٌ قصير للعرض في مؤشّر الخطوات. */
  label: string;
}

export async function executeTool(name: string, rawInput: unknown, ctx: AgentContext): Promise<ToolExecResult> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  try {
    const access = decideToolAccess(name, ctx.sourcePolicy);
    if (!access.allowed) {
      ctx.deniedTools.push({ tool: name, reason: access.reason });
      return {
        ok: false,
        data: {
          error: access.reason,
          code: access.code,
          sourcePolicy: ctx.sourcePolicy,
        },
        label: `مرفوض بالسياسة: ${name}`,
      };
    }

    if (name === "resolve_scope") {
      const question = String(input.question ?? "").trim();
      if (!question) return { ok: false, data: { error: "question مطلوب" }, label: "تحديد النطاق" };
      const res = await resolveGoverningSystems(question);
      return {
        ok: true,
        data: { systems: res.systems.map((s) => ({ id: s.id, name: s.name })), reasoning: res.reasoning, source: res.source },
        label: `النطاق: ${res.systems.map((s) => s.name).slice(0, 3).join("، ") || "غير محدَّد"}`,
      };
    }

    if (name === "legal_search") {
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, data: { error: "query مطلوب" }, label: "بحث نظاميّ" };
      const systemIds = Array.isArray(input.systemIds) ? input.systemIds.map(String).filter(Boolean) : undefined;
      const limit = Math.min(Math.max(Number(input.limit) || 8, 1), 30);
      const res = await searchLegalCore({
        query,
        systemIds: systemIds?.length ? systemIds : undefined,
        limit,
        semantic: true,
        requireConceptCoverage: true,
        includeSnippets: true,
      });
      const results = res.results.map((r) =>
        addSource(ctx, {
          sourceId: r.articleId,
          systemName: r.systemName,
          articleNumber: r.articleNumber,
          articleTitle: r.articleTitle,
          snippet: (r.snippet || r.articleText || "").slice(0, 500),
          status: r.status,
          internalUrl: r.internalUrl,
        })
      );
      if (isRetrievalTool(name)) ctx.invokedTools.push(name);
      return {
        ok: true,
        // cite = رقم الحاشية: استشهد به كـ[n] فيُربَط تلقائيًّا بنصّ المادة أسفل الدراسة.
        data: { total: res.total, exhaustive: res.exhaustive ?? false, count: results.length, results },
        label: `بحث «${query.slice(0, 30)}» → ${results.length} مادة`,
      };
    }

    if (name === "comprehensive_legal_scan") {
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, data: { error: "query مطلوب" }, label: "مسح شامل" };
      // في النطاق الصارم بلا مكتبة واسعة نرفض المسح الشامل حتى لو مُرِّر بالخطأ
      if (ctx.sourcePolicy.strictScope && !ctx.sourcePolicy.legalLibrary) {
        ctx.deniedTools.push({ tool: name, reason: "المسح الشامل خارج النطاق الصارم." });
        return {
          ok: false,
          data: { error: "المسح الشامل خارج النطاق الصارم.", code: "SOURCE_POLICY_DENIED" },
          label: "مرفوض بالسياسة: مسح شامل",
        };
      }
      const limit = Math.min(Math.max(Number(input.limit) || 40, 10), 60);
      // مسحٌ عبر كلّ الأنظمة: بلا systemIds، سقفٌ عالٍ، بلا فرض تغطية المفاهيم (أوسع) — كمسح المكتبة.
      const res = await searchLegalCore({ query, limit, semantic: true, includeSnippets: true });
      const results = res.results.map((r) =>
        addSource(ctx, {
          sourceId: r.articleId,
          systemName: r.systemName,
          articleNumber: r.articleNumber,
          articleTitle: r.articleTitle,
          snippet: (r.snippet || r.articleText || "").slice(0, 400),
          status: r.status,
          internalUrl: r.internalUrl,
        })
      );
      // تغطيةٌ لكلّ نظام: عدد المواد المطابقة — فيعرف Claude أين يتركّز الحكم وأين يعمّق.
      const bySystem = new Map<string, number>();
      for (const r of results) bySystem.set(r.systemName, (bySystem.get(r.systemName) ?? 0) + 1);
      const coverage = Array.from(bySystem.entries()).map(([systemName, count]) => ({ systemName, count })).sort((a, b) => b.count - a.count);
      ctx.invokedTools.push(name);
      return {
        ok: true,
        data: {
          total: res.total,
          exhaustive: res.exhaustive ?? false, // هل رُتِّبت كلّ المطابقات (تغطية كاملة)؟
          scanned: results.length,
          systemsCoverage: coverage, // توزيع المواد عبر الأنظمة
          results,
        },
        label: `مسح شامل «${query.slice(0, 24)}» → ${results.length} مادة عبر ${coverage.length} نظامًا`,
      };
    }

    if (name === "deep_legal_study") {
      const question = String(input.question ?? "").trim();
      if (!question) return { ok: false, data: { error: "question مطلوب" }, label: "دراسة موسّعة" };
      // نستدعي المنظّم القديم القويّ (تفكيك + تخريج شامل + تحقّق + تغطية) في وضعه العميق،
      // ونتخطّى بوّابة الاتّساع والتحليل العامّ — فيُغذّي Claude بالمادّة الخام المؤصَّلة ليصوغها.
      // استيرادٌ كسول: سلسلة المنظّم تستورد server-only، فلا نحمّلها إلا عند استخدام الأداة فعلًا.
      const { orchestrate } = await import("@/lib/modules/agents/orchestrator");
      const res = await orchestrate(question, {
        mode: "deep",
        skipBreadth: true,
        skipAnalysis: true,
        sourcePolicy: ctx.sourcePolicy,
      });
      const src = (res.articles ?? []).slice(0, 18).map((a) =>
        addSource(ctx, {
          sourceId: a.articleId,
          systemName: a.systemName,
          articleNumber: a.articleNumber,
          articleTitle: a.articleTitle,
          snippet: (a.snippet || a.articleText || "").slice(0, 600),
          status: a.status,
          internalUrl: a.internalUrl,
        })
      );
      const verifiedNums = new Set((res.verified ?? []).map((v) => v.articleNumber));
      ctx.invokedTools.push(name);
      return {
        ok: true,
        data: {
          // التفكيك الأصوليّ: كلّ مسألة بمناطها وكلماتها.
          issues: (res.issues ?? []).map((i) => ({ issue: i.issue, manat: i.manat, keywords: i.keywords })),
          // المظانّ: الأنظمة الحاكمة مرتّبةً (خاصّ/عامّ + عدد المواد).
          governingSystems: (res.governingSystems ?? []).map((g) => ({ systemName: g.systemName, scope: g.scope, articleCount: g.articleCount })),
          // المواد المؤصَّلة (استشهد بها بمعرّفها؛ المؤكَّدة موسومة).
          materials: src.map((s) => ({ ...s, verified: verifiedNums.has(s.articleNumber) })),
          // سوابق ومبادئ استئناسيّة (لا تستشهد منها بأرقام مواد).
          rulings: ctx.sourcePolicy.judgments
            ? (res.rulings ?? []).slice(0, 6).map((r) => ({ title: r.title, snippet: r.snippet }))
            : [],
          principles: ctx.sourcePolicy.judgments
            ? (res.principles ?? []).slice(0, 6).map((p) => ({ title: p.title, snippet: p.snippet }))
            : [],
          coverage: res.coverage ?? null,
          sourcePolicy: ctx.sourcePolicy,
        },
        label: `دراسة موسّعة: ${(res.issues ?? []).length} مسألة · ${src.length} مادة · ${(res.rulings ?? []).length} سابقة`,
      };
    }

    if (name === "fetch_legal_source") {
      const sourceId = String(input.sourceId ?? "").trim();
      if (!sourceId) return { ok: false, data: { error: "sourceId مطلوب" }, label: "قراءة مصدر" };
      const a = await prisma.legalArticle.findUnique({
        where: { id: sourceId },
        select: { id: true, lawName: true, articleNumber: true, title: true, content: true, status: true },
      });
      if (!a) return { ok: false, data: { error: "لم يُعثر على المادة بهذا المعرّف" }, label: "قراءة مصدر" };
      const src = addSource(ctx, {
        sourceId: a.id,
        systemName: a.lawName,
        articleNumber: a.articleNumber,
        articleTitle: a.title,
        snippet: a.content.slice(0, 500),
        status: a.status,
        internalUrl: `/dashboard/legal-core/articles/${a.id}`,
      });
      ctx.invokedTools.push(name);
      return {
        ok: true,
        data: { sourceId: a.id, cite: src.cite, systemName: a.lawName, articleNumber: a.articleNumber, title: a.title, content: a.content, status: a.status },
        label: `قراءة ${a.lawName} م/${a.articleNumber}`,
      };
    }

    if (name === "islamic_library_scan") {
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, data: { error: "query مطلوب" }, label: "مسح المكتبة الإسلامية" };
      // تكاملٌ قابلٌ للتفعيل: يُضبَط ALBAHITH_API_URL (+ مفتاح اختياريّ) على المنصّة. حين لا
      // يكون مربوطًا نعيد configured=false صراحةً فلا ينسب Claude نصًّا فقهيًّا بلا مصدرٍ حقيقيّ.
      const base = process.env.ALBAHITH_API_URL?.trim();
      if (!base) {
        return {
          ok: true,
          data: { configured: false, message: "مصدر المكتبة الإسلامية (الشاملة) غير مربوطٍ بالمنصّة بعد؛ لا تنسب نصًّا فقهيًّا دون هذا المصدر." },
          label: "المكتبة الإسلامية غير مربوطة",
        };
      }
      const limit = Math.min(Math.max(Number(input.limit) || 8, 1), 20);
      try {
        const resp = await fetch(base, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.ALBAHITH_API_KEY ? { Authorization: `Bearer ${process.env.ALBAHITH_API_KEY}` } : {}),
          },
          body: JSON.stringify({ query, limit }),
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) return { ok: false, data: { error: `مصدر المكتبة أعاد ${resp.status}` }, label: "خطأ المكتبة الإسلامية" };
        const json = (await resp.json()) as unknown;
        const arr = Array.isArray(json) ? json : Array.isArray((json as { results?: unknown[] })?.results) ? (json as { results: unknown[] }).results : [];
        const passages = arr.slice(0, limit).map((raw) => {
          const p = (raw ?? {}) as Record<string, unknown>;
          return {
            text: String(p.text ?? p.snippet ?? p.content ?? "").slice(0, 700),
            book: (p.book ?? p.bookTitle ?? p.source ?? null) as string | null,
            author: (p.author ?? null) as string | null,
            citation: (p.citation ?? p.ref ?? null) as string | null,
            page: (p.page ?? null) as string | number | null,
          };
        });
        ctx.invokedTools.push(name);
        return { ok: true, data: { configured: true, count: passages.length, passages }, label: `المكتبة الإسلامية → ${passages.length} نصًّا` };
      } catch (e) {
        return { ok: false, data: { error: e instanceof Error ? e.message : "تعذّر الاتصال بمصدر المكتبة الإسلامية" }, label: "خطأ المكتبة الإسلامية" };
      }
    }

    if (name === "read_attachment") {
      const { selectAttachmentPagesForRead } = await import(
        "@/lib/modules/attachments/read-attachment-pages"
      );
      const ids = Array.isArray(input.attachmentIds)
        ? input.attachmentIds.map(String).filter(Boolean).slice(0, 10)
        : [];
      const pageRange =
        input.pageRange && typeof input.pageRange === "object"
          ? {
              from: typeof (input.pageRange as { from?: unknown }).from === "number"
                ? (input.pageRange as { from: number }).from
                : undefined,
              to: typeof (input.pageRange as { to?: unknown }).to === "number"
                ? (input.pageRange as { to: number }).to
                : undefined,
            }
          : undefined;
      const queryHint = typeof input.queryHint === "string" ? input.queryHint : undefined;
      const MAX_TOOL_CHARS = 120_000;

      // مسار V2: قراءة بالمعرّف من المرفقات المحمّلة خادميًا (ملكية تحقّقَت عند التحميل)
      if (ids.length && ctx.attachments.size) {
        const items: Array<{
          attachmentId: string;
          fileName: string;
          status?: string;
          chars: number;
          text: string;
          pages?: Array<{
            pageNumber: number | null;
            text: string;
            status: string;
            confidence?: number | null;
            warning?: string | null;
          }>;
          warning?: string;
          usedPageNumbers?: number[];
          textFallback?: boolean;
        }> = [];
        for (const id of ids) {
          const att = ctx.attachments.get(id);
          if (!att) {
            items.push({
              attachmentId: id,
              fileName: "",
              chars: 0,
              text: "",
              warning: "ATTACHMENT_FORBIDDEN_OR_MISSING",
            });
            continue;
          }
          if (att.status && !["READY", "PARTIAL", "ready", "partial"].includes(att.status)) {
            items.push({
              attachmentId: id,
              fileName: att.fileName,
              status: att.status,
              chars: 0,
              text: "",
              warning:
                att.status === "FAILED" || att.status === "failed"
                  ? "ATTACHMENT_PROCESSING_FAILED"
                  : att.status === "QUARANTINED"
                    ? "ATTACHMENT_QUARANTINED"
                    : "ATTACHMENT_NOT_READY",
            });
            continue;
          }

          const selected = selectAttachmentPagesForRead({
            pages: att.pages?.map((p) => ({
              pageNumber: p.pageNumber,
              text: p.text,
              status: (p.status === "FAILED" || p.status === "failed"
                ? "failed"
                : p.status === "PARTIAL" || p.status === "partial"
                  ? "partial"
                  : "ready") as "ready" | "partial" | "failed",
              confidence: p.confidence,
            })),
            fullText: att.text,
            pageRange,
            queryHint,
            maxChars: MAX_TOOL_CHARS,
          });

          if (!selected.ok) {
            items.push({
              attachmentId: id,
              fileName: att.fileName,
              status: att.status,
              chars: 0,
              text: "",
              warning: selected.code,
            });
            continue;
          }

          const combined = selected.items.map((p) => p.text).filter(Boolean).join("\n\n");
          ctx.auditedPageReads.push({
            attachmentId: id,
            pageNumbers: selected.usedPageNumbers,
            textFallback: selected.textFallback,
          });

          items.push({
            attachmentId: id,
            fileName: att.fileName,
            status: att.status,
            chars: combined.length,
            text: combined,
            pages: selected.items,
            usedPageNumbers: selected.usedPageNumbers,
            textFallback: selected.textFallback,
            warning:
              att.status === "PARTIAL" || att.status === "partial"
                ? "PARTIAL_CONTENT"
                : selected.textFallback
                  ? "NO_PAGE_STRUCTURE_FALLBACK_FULL_TEXT"
                  : selected.truncated
                    ? "TRUNCATED"
                    : undefined,
          });
        }
        ctx.invokedTools.push(name);
        return {
          ok: true,
          data: {
            hasAttachment: items.some((i) => i.chars > 0),
            items,
            usedAttachmentIds: items.filter((i) => i.chars > 0).map((i) => i.attachmentId),
            auditedPages: ctx.auditedPageReads.slice(-ids.length),
          },
          label: `قراءة ${items.filter((i) => i.chars > 0).length} مرفقًا`,
        };
      }

      // Legacy: نص الجلسة المضمّن (خلف التوافق) — بلا ادّعاء أرقام صفحات
      if (!ctx.document.trim()) {
        return { ok: true, data: { hasAttachment: false, text: "", legacy: true }, label: "لا مستند مرفق" };
      }
      let text = ctx.document;
      if (queryHint) {
        const token = queryHint.trim().toLowerCase().split(/\s+/)[0] || "";
        const idx = token ? text.toLowerCase().indexOf(token) : -1;
        if (idx >= 0) text = text.slice(Math.max(0, idx - 400));
      }
      if (text.length > MAX_TOOL_CHARS) text = text.slice(0, MAX_TOOL_CHARS);
      ctx.invokedTools.push(name);
      return {
        ok: true,
        data: {
          hasAttachment: true,
          chars: text.length,
          text,
          legacy: true,
          pages: [{ pageNumber: null, text, status: "READY", warning: "NO_PAGE_STRUCTURE_FALLBACK_FULL_TEXT" }],
          textFallback: true,
        },
        label: "قراءة المستند المرفق (مسار توافق)",
      };
    }

    if (name === "load_skill") {
      const skillName = String(input.name ?? "").trim();
      const guide = loadSkillGuide(skillName);
      if (!guide) return { ok: false, data: { error: `لا مهارة بهذا الاسم. المتاح: ${skillsIndex().map((s) => s.name).join(", ")}` }, label: "تحميل مهارة" };
      return { ok: true, data: { name: skillName, guide }, label: `تحميل مهارة «${skillName}»` };
    }

    return { ok: false, data: { error: `أداةٌ غير معروفة: ${name}` }, label: "أداة غير معروفة" };
  } catch (e) {
    return { ok: false, data: { error: e instanceof Error ? e.message : "خطأ في تنفيذ الأداة" }, label: `خطأ في ${name}` };
  }
}
