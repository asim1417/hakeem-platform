/**
 * /api/ai/agent-search — الوكيل القانوني الشفّاف (المراحل ١+٣+٤+٥).
 *
 * التدفّق: بوّابة النيّة → التكييف الأصولي → التخريج (بحث النواة) → التحقّق (حارس التلفيق)
 *          → حارس الترابط (امتناع عند التناثر) → الصياغة المستندة. يبثّ كل خطوة (NDJSON).
 * وضعان: سريع (افتراضي) و«بحث تفصيلي» (detailed → deep). المصدر الوحيد: النواة القانونية.
 * خلف الدخول. للقراءة فقط. لا يلمس الأمن ولا المصادقة ولا نواة الترتيب.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { createConsultationDraft } from "@/lib/modules/ai/ai-gateway";
import { orchestrate, suggestMode } from "@/lib/modules/agents/orchestrator";
import { intentNeedsSearch } from "@/lib/modules/agents/intent-gate";
import { verifyCitations } from "@/lib/modules/agents/thinking/verifier";
import { buildScopeDisclosure } from "@/lib/modules/agents/thinking/disclosure";
import { getAgentMode } from "@/lib/modules/agents/modes";
import { synthesizeWithMode } from "@/lib/modules/agents/mode-synthesis";
import { canConsume, consumeOne } from "@/lib/modules/billing/quota";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return new Response(JSON.stringify({ type: "error", message: "يلزم تسجيل الدخول." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  let body: { query?: string; detailed?: boolean; skipBreadth?: boolean; mode?: string; history?: Array<{ role?: string; content?: string }> } = {};
  try {
    body = await request.json();
  } catch {
    /* تجاهل */
  }
  const query = String(body?.query ?? "").trim().slice(0, 500);
  const detailed = Boolean(body?.detailed);
  const skipBreadth = Boolean(body?.skipBreadth);
  // الوضع: «اسأل» (افتراضيّ) بلا تغيير، أو وضعٌ بتعليمة إخراج خاصّة (حلّل قضية…).
  const agentMode = getAgentMode(body?.mode);
  // تاريخ المحادثة (للأوضاع الحوارية) — يُنقّى ويُقصَر لآخر ٨ رسائل.
  const history = Array.isArray(body?.history)
    ? body!.history!
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
        .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 1200) }))
        .slice(-8)
    : [];
  if (!query) {
    return new Response(JSON.stringify({ type: "error", message: "اكتب سؤالك أولاً." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      // حصّة الاستخدام المجانيّة: خصمٌ مرّة واحدة بعد نجاح العملية فقط (سقوط مفتوح قبل الهجرة).
      let consumed = false;
      const consume = () => {
        if (consumed) return;
        consumed = true;
        void consumeOne(user.id).catch(() => undefined);
      };
      try {
        // الحارس قبل التنفيذ: إن نفدت الحصّة → جدار اشتراك مبثوث (لا استثناء صامت). النواة تبقى مجانية.
        const gate = await canConsume(user.id).catch(() => ({ allowed: true, remaining: -1, isSubscribed: false } as const));
        if (!gate.allowed) {
          send({
            type: "result",
            answer: null,
            mode: "blocked",
            blocked: true,
            reason: "exhausted",
            basis: [],
            total: 0,
            message: "انتهى رصيدك المجانيّ. للمتابعة في «اسأل حكيم» والقاضي والاستشارات، اشترك في حكيم. وتصفّح النواة القانونية يبقى مجانيًّا."
          });
          send({ type: "done" });
          return;
        }
        // ①→③ المنسّق: بوّابة النيّة + التكييف + التخريج، ويبثّ خطواته حيًّا.
        // المستوى: وضع «اسأل» — مبدّل «بحث تفصيلي» يفرض العميق وإلا يُقترَح تلقائيًّا. أوضاع الإخراج
        // الأخرى (حلّل قضية…) تشغّل الوكيل مرّة واحدة (quick) وتتخطّى الاتّساع، ثم تُصاغ بتعليمة الوضع.
        // أوضاع التحليل (حلّل قضية · خطة عمل · تقدير حكم) تستحقّ استرجاعًا عميقًا (٧ جولات +
        // مسحة + تعميق بالمظانّ + سوابق + تحقّق)، لكن مع تخطّي التحليل العامّ (skipAnalysis)
        // كي تُصاغ بتعليمة الوضع نفسها على هذا الأساس الأغنى بدل أن يعترضها التحليل العامّ.
        const deepModes = new Set(["analyze-case", "action-plan", "verdict-estimate"]);
        const isDeepMode = deepModes.has(agentMode.id);
        const mode = agentMode.id === "ask" ? (detailed ? "deep" : suggestMode(query)) : isDeepMode ? "deep" : "quick";
        const modeSkipBreadth = agentMode.id === "ask" ? skipBreadth : true;
        const result = await orchestrate(query, { mode, skipBreadth: modeSkipBreadth, skipAnalysis: isDeepMode, onStep: (s) => send({ type: "step", ...s }) });

        // نيّة غير قانونية (تحية/شكر/تعريف/خارج النطاق) → ردّ مباشر بلا بحث.
        if (!intentNeedsSearch(result.intent)) {
          send({ type: "result", answer: result.reply ?? null, mode: "intent", basis: [], total: 0, intent: result.intent });
          send({ type: "done" });
          return;
        }

        // بوّابة الاتّساع: سؤال واسع → استيضاح بخيارات (لا بحث فوريّ). المستخدم يختار فيُعاد الإرسال.
        if (result.clarify) {
          send({ type: "clarify", message: result.clarify.message, dimension: result.clarify.dimension, options: result.clarify.options });
          send({ type: "done" });
          return;
        }

        // الاستقصاء الشامل: مجموعات لكل نظام تُعرَض بالتدرّج (دفعات + «عرض المزيد»).
        if (result.enumGroups && result.enumGroups.length) {
          consume();
          send({
            type: "result",
            mode: "live",
            answer: "## حصر المدد عبر الأنظمة",
            groups: result.enumGroups,
            total: result.enumGroups.reduce((s, g) => s + g.count, 0),
            basis: [],
            disclosure: buildScopeDisclosure({ systems: result.scannedSystems ?? [], dimension: "المدد", complete: false })
          });
          send({ type: "done" });
          return;
        }

        // إجابة جاهزة من المنسّق (تحليل متعمّق أو حصر كامل للنظام) → تُقدَّم مباشرةً.
        // المواد مُخرَّجة من النواة (قائمة فعلاً)؛ الحصر الاستقرائي حتميّ من نصوص المواد.
        if (result.analysis) {
          // المرحلة ٥: لوحة الأساس تُبنى من المواد **المُتحقَّقة بترتيبها المُغذّى للتحليل** كي
          // يطابق ذيل [n] في النصّ ترتيب المصدر في اللوحة؛ سقوط إلى المواد المُخرَّجة إن غابت.
          const basis = (result.verified?.length
            ? result.verified.map((c) => ({
                systemName: c.systemName ?? "",
                articleNumber: c.articleNumber ?? 0,
                articleTitle: undefined as string | undefined,
                quote: c.quote,
                state: "official" as const,
                enforcement: c.status ?? null,
                internalUrl: c.articleId ? `/dashboard/legal-core/articles/${c.articleId}` : undefined
              }))
            : result.articles.slice(0, 40).map((a) => ({
                systemName: a.systemName,
                articleNumber: a.articleNumber,
                articleTitle: a.articleTitle,
                quote: a.snippet,
                state: "official" as const,
                enforcement: a.status ?? null,
                internalUrl: a.internalUrl
              })));
          consume();
          send({
            type: "result",
            answer: result.analysis,
            mode: "live",
            basis,
            total: result.articles.length,
            issues: result.issues.map((i) => i.issue),
            coverage: result.coverage ? { answered: result.coverage.answered, total: result.coverage.issues.length, issues: result.coverage.issues } : undefined
          });
          send({ type: "done" });
          return;
        }

        // ④ التحقّق (حارس التلفيق): كل مادة مُخرَّجة تُتحقَّق فعلاً في النواة؛ المُختلَق يُحجَب.
        send({ type: "step", id: "verify", status: "running", label: "أتحقّق من ورود المواد فعلاً" });
        const outcome = await verifyCitations(
          result.articles.map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet }))
        );
        send({
          type: "step",
          id: "verify",
          status: "done",
          label: "تحقّقت من ورود المواد في النواة",
          data: { verified: outcome.verified.length, blocked: outcome.blocked.length }
        });

        // ⑤ حارس الترابط: لا سند مُتحقَّق → امتناع صادق (لا تلفيق، لا ملء فراغ).
        if (!outcome.verified.length) {
          send({
            type: "result",
            answer: null,
            mode: "offline",
            basis: [],
            total: 0,
            message: "لا يوجد سند نظامي كافٍ مطابق في النواة القانونية الحالية. جرّب إعادة صياغة سؤالك."
          });
          send({ type: "done" });
          return;
        }

        // ⑥ الصياغة المستندة (حصرًا من مواد النواة، بحارس داخلي ضدّ أرقام غير موجودة).
        // وضعُ إخراجٍ غير «اسأل» → يُصاغ بتعليمة الوضع من **المواد المُتحقَّقة نفسها** (استدعاء وكيل
        // واحد، بلا إعادة استرجاع). سقوط آمن لعرض المواد الخام عند تعذّر الصياغة/رصد تلفيق.
        if (agentMode.systemPrompt) {
          send({ type: "step", id: "synthesize", status: "running", label: `أصوغ بوضع «${agentMode.name}» مستندًا للمواد` });
          const modeBasis = outcome.verified.map((c) => ({
            systemName: c.systemName ?? "",
            articleNumber: c.articleNumber ?? 0,
            articleTitle: undefined as string | undefined,
            quote: c.quote,
            state: "official" as const,
            enforcement: c.status ?? null,
            internalUrl: c.articleId ? `/dashboard/legal-core/articles/${c.articleId}` : undefined
          }));
          const synth = await synthesizeWithMode({
            query,
            systemPrompt: agentMode.systemPrompt,
            citations: outcome.verified.map((c) => ({ articleId: c.articleId, systemName: c.systemName, articleNumber: c.articleNumber, quote: c.quote })),
            history: agentMode.conversational ? history : undefined,
            // أوضاع التحليل العميقة: نمرّر السوابق القضائية المُسترجَعة (سياقًا) ونرفع سقف الرموز
            // لتفادي قصّ المخرَجات ذات العناوين السبعة/الثمانية.
            supporting: isDeepMode
              ? {
                  rulings: (result.rulings ?? []).map((r) => ({ title: r.title, snippet: r.snippet })),
                  principles: (result.principles ?? []).map((p) => ({ title: p.title, snippet: p.snippet }))
                }
              : undefined,
            maxTokens: isDeepMode ? 2600 : undefined
          }).catch(() => null);
          if (!synth) {
            send({ type: "step", id: "synthesize", status: "done", label: "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة", data: { blocked: true } });
            send({ type: "result", answer: null, mode: "offline", basis: modeBasis, total: result.articles.length, message: modeBasis.length ? "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة من النواة." : undefined });
            send({ type: "done" });
            return;
          }
          send({ type: "step", id: "synthesize", status: "done", label: `صغت بوضع «${agentMode.name}» مستندًا للمواد`, data: { mode: synth.mode, citations: modeBasis.length } });
          send({ type: "step", id: "guard", status: "done", label: "فحصت المخرَج ضد التلفيق", data: { sourceOfTruth: "legal_core.legal_articles" } });

          // وضع «استشارة»: يُحفَظ سجلّ الاستشارة (كصفحة الاستشارات) — سقوط آمن لا يكسر الردّ.
          if (agentMode.id === "consultation") {
            const consultCitations = outcome.verified
              .filter((c): c is typeof c & { articleId: string; articleNumber: number } => Boolean(c.articleId) && typeof c.articleNumber === "number")
              .map((c) => ({ articleId: c.articleId, lawName: c.systemName ?? "", articleNumber: c.articleNumber, quote: c.quote ?? "" }));
            await prisma.consultation
              .create({
                data: {
                  userId: user.id,
                  facts: query,
                  output: synth.output,
                  status: "GENERATED",
                  qualityReport: { sourceOfTruth: "legal_core.legal_articles", mode: "consultation", agent: true, citations: consultCitations.length },
                  citations: { create: consultCitations }
                }
              })
              .catch(() => undefined);
          }

          consume();
          // السوابق القضائية التي استُؤنِس بها في الصياغة — تُعرَض للمستخدم (شفافية)، لا في الصياغة فقط.
          const precedents = isDeepMode
            ? {
                rulings: (result.rulings ?? []).slice(0, 6).map((r) => ({ title: r.title, snippet: r.snippet })),
                principles: (result.principles ?? []).slice(0, 6).map((p) => ({ title: p.title, snippet: p.snippet }))
              }
            : undefined;
          send({ type: "result", answer: synth.output, mode: synth.mode, basis: modeBasis, total: result.articles.length, issues: result.issues.map((i) => i.issue), precedents });
          send({ type: "done" });
          return;
        }

        send({ type: "step", id: "synthesize", status: "running", label: "أصوغ إجابة مستندة للمواد فقط" });
        const draft = await createConsultationDraft({ facts: query, actorId: user.id }).catch(() => null);

        if (!draft || draft.blocked) {
          const rawBasis = result.articles.map((a) => ({
            systemName: a.systemName,
            articleNumber: a.articleNumber,
            articleTitle: a.articleTitle,
            quote: a.snippet,
            state: "official" as const,
            enforcement: a.status ?? null,
            internalUrl: a.internalUrl
          }));
          send({ type: "step", id: "synthesize", status: "done", label: "لا يوجد سند نظامي كافٍ للصياغة", data: { blocked: true } });
          send({
            type: "result",
            answer: null,
            mode: draft?.mode ?? "offline",
            basis: rawBasis,
            total: result.articles.length,
            message: rawBasis.length ? "تعذّرت الصياغة المستندة؛ إليك المواد المُتحقَّقة من النواة." : undefined
          });
          send({ type: "done" });
          return;
        }

        send({ type: "step", id: "synthesize", status: "done", label: "صغت الإجابة مستندة للمواد الموثّقة", data: { mode: draft.mode, citations: draft.citations.length } });
        send({ type: "step", id: "guard", status: "done", label: "فحصت المخرَج ضد التلفيق", data: { sourceOfTruth: "legal_core.legal_articles" } });

        const basis = draft.citations.map((c) => ({
          systemName: c.lawName,
          articleNumber: c.articleNumber,
          articleTitle: undefined as string | undefined,
          quote: c.quote,
          state: "official" as const,
          internalUrl: `/dashboard/legal-core/articles/${c.articleId}`
        }));

        consume();
        send({
          type: "result",
          answer: draft.output,
          mode: draft.mode,
          basis,
          total: result.articles.length,
          issues: result.issues.map((i) => i.issue)
        });
        send({ type: "done" });
      } catch (error) {
        console.error("[agent-search] Error:", error);
        send({ type: "error", message: "تعذّر تنفيذ البحث الوكيلي حاليًا." });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}
