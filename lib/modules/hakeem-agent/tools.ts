// سجلّ الأدوات — قدرات Claude التنفيذيّة بمخطّطات صارمة. Claude يختارها بنفسه؛ الكود
// يتحقّق من المدخلات وينفّذ ويعيد النتيجة إليه. كلّ مصدرٍ قانونيّ يعود بمعرّفه الحقيقيّ
// (sourceId = معرّف المادة في النواة) فيبقى الإسناد مؤصَّلًا ولا يخترع Claude رقمًا.
import { prisma } from "@/lib/prisma";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";
import { resolveGoverningSystems } from "@/lib/modules/agents/thinking/resolve-scope";
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
}

/** سياق الجلسة الذي تعمل عليه الأدوات — يحمل المستند المرفق ويجمع المصادر المستَرجَعة. */
export interface AgentContext {
  document: string;
  /** المصادر المستَرجَعة عبر الجلسة، مفهرسةً بمعرّفها (منع التكرار). */
  sources: Map<string, RetrievedSource>;
}

export function createAgentContext(document: string): AgentContext {
  return { document: document ?? "", sources: new Map() };
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
    description: "اقرأ نصّ المستند الذي أرفقه المستخدم في هذه الجلسة (إن وُجد).",
    input_schema: { type: "object", properties: {} },
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
      const results = res.results.map((r) => {
        const src: RetrievedSource = {
          sourceId: r.articleId,
          systemName: r.systemName,
          articleNumber: r.articleNumber,
          articleTitle: r.articleTitle,
          snippet: (r.snippet || r.articleText || "").slice(0, 500),
          status: r.status,
          internalUrl: r.internalUrl,
        };
        ctx.sources.set(src.sourceId, src);
        return src;
      });
      return {
        ok: true,
        data: { total: res.total, exhaustive: res.exhaustive ?? false, count: results.length, results },
        label: `بحث «${query.slice(0, 30)}» → ${results.length} مادة`,
      };
    }

    if (name === "comprehensive_legal_scan") {
      const query = String(input.query ?? "").trim();
      if (!query) return { ok: false, data: { error: "query مطلوب" }, label: "مسح شامل" };
      const limit = Math.min(Math.max(Number(input.limit) || 40, 10), 60);
      // مسحٌ عبر كلّ الأنظمة: بلا systemIds، سقفٌ عالٍ، بلا فرض تغطية المفاهيم (أوسع) — كمسح المكتبة.
      const res = await searchLegalCore({ query, limit, semantic: true, includeSnippets: true });
      const results = res.results.map((r) => {
        const s: RetrievedSource = {
          sourceId: r.articleId,
          systemName: r.systemName,
          articleNumber: r.articleNumber,
          articleTitle: r.articleTitle,
          snippet: (r.snippet || r.articleText || "").slice(0, 400),
          status: r.status,
          internalUrl: r.internalUrl,
        };
        ctx.sources.set(s.sourceId, s);
        return s;
      });
      // تغطيةٌ لكلّ نظام: عدد المواد المطابقة — فيعرف Claude أين يتركّز الحكم وأين يعمّق.
      const bySystem = new Map<string, number>();
      for (const r of results) bySystem.set(r.systemName, (bySystem.get(r.systemName) ?? 0) + 1);
      const coverage = Array.from(bySystem.entries()).map(([systemName, count]) => ({ systemName, count })).sort((a, b) => b.count - a.count);
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
      const res = await orchestrate(question, { mode: "deep", skipBreadth: true, skipAnalysis: true });
      const src = (res.articles ?? []).slice(0, 18).map((a) => {
        const s: RetrievedSource = {
          sourceId: a.articleId,
          systemName: a.systemName,
          articleNumber: a.articleNumber,
          articleTitle: a.articleTitle,
          snippet: (a.snippet || a.articleText || "").slice(0, 600),
          status: a.status,
          internalUrl: a.internalUrl,
        };
        ctx.sources.set(s.sourceId, s);
        return s;
      });
      const verifiedNums = new Set((res.verified ?? []).map((v) => v.articleNumber));
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
          rulings: (res.rulings ?? []).slice(0, 6).map((r) => ({ title: r.title, snippet: r.snippet })),
          principles: (res.principles ?? []).slice(0, 6).map((p) => ({ title: p.title, snippet: p.snippet })),
          coverage: res.coverage ?? null,
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
      const src: RetrievedSource = {
        sourceId: a.id,
        systemName: a.lawName,
        articleNumber: a.articleNumber,
        articleTitle: a.title,
        snippet: a.content.slice(0, 500),
        status: a.status,
        internalUrl: `/dashboard/legal-core/articles/${a.id}`,
      };
      ctx.sources.set(src.sourceId, src);
      return {
        ok: true,
        data: { sourceId: a.id, systemName: a.lawName, articleNumber: a.articleNumber, title: a.title, content: a.content, status: a.status },
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
        return { ok: true, data: { configured: true, count: passages.length, passages }, label: `المكتبة الإسلامية → ${passages.length} نصًّا` };
      } catch (e) {
        return { ok: false, data: { error: e instanceof Error ? e.message : "تعذّر الاتصال بمصدر المكتبة الإسلامية" }, label: "خطأ المكتبة الإسلامية" };
      }
    }

    if (name === "read_attachment") {
      if (!ctx.document.trim()) return { ok: true, data: { hasAttachment: false, text: "" }, label: "لا مستند مرفق" };
      // المستند كاملًا (مُقتطَعٌ أصلًا عند حدّ المسار 200 ألف حرف) — لا نقتطعه هنا ثانيةً.
      return { ok: true, data: { hasAttachment: true, chars: ctx.document.length, text: ctx.document }, label: "قراءة المستند المرفق كاملًا" };
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
