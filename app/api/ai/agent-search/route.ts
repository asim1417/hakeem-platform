/**
 * /api/ai/agent-search — الوكيل القانوني الشفّاف (المراحل ١+٣+٤+٥).
 *
 * التدفّق: بوّابة النيّة → التكييف الأصولي → التخريج (بحث النواة) → التحقّق (حارس التلفيق)
 *          → حارس الترابط (امتناع عند التناثر) → الصياغة المستندة. يبثّ كل خطوة (NDJSON).
 * وضعان: سريع (افتراضي) و«بحث تفصيلي» (detailed → deep). المصدر الوحيد: النواة القانونية.
 * خلف الدخول. للقراءة فقط. لا يلمس الأمن ولا المصادقة ولا نواة الترتيب.
 */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { createConsultationDraft } from "@/lib/modules/ai/ai-gateway";
import { orchestrate, suggestMode } from "@/lib/modules/agents/orchestrator";
import { intentNeedsSearch } from "@/lib/modules/agents/intent-gate";
import { verifyCitations } from "@/lib/modules/agents/thinking/verifier";

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

  let body: { query?: string; detailed?: boolean; skipBreadth?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* تجاهل */
  }
  const query = String(body?.query ?? "").trim().slice(0, 500);
  const detailed = Boolean(body?.detailed);
  const skipBreadth = Boolean(body?.skipBreadth);
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
      try {
        // ①→③ المنسّق: بوّابة النيّة + التكييف + التخريج، ويبثّ خطواته حيًّا.
        // المستوى: مبدّل «بحث تفصيلي» يفرض العميق؛ وإلا يقترحه المنسّق تلقائيًّا من التعقيد.
        const mode = detailed ? "deep" : suggestMode(query);
        const result = await orchestrate(query, { mode, skipBreadth, onStep: (s) => send({ type: "step", ...s }) });

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
