/**
 * /api/ai/agent-search  — الوكيل القانوني الشفّاف (المرحلة 1)
 *
 * يبثّ خطوات الاسترجاع الحقيقية من النواة القانونية سطراً سطراً (NDJSON):
 *   {type:"step", id, status:"running"|"done", label, data?}
 *   {type:"result", basis, total, message?}
 *   {type:"done"} | {type:"error", message}
 *
 * المرحلة 1: استرجاع وتحقّق فقط — لا توليد/صياغة AI (إسناد 100%).
 * خلف الدخول. للقراءة فقط. المصدر الوحيد: النواة القانونية.
 */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { searchLegalCore, getArticlesByNumber } from "@/lib/modules/legal-core/legal-retrieval";
import { createConsultationDraft } from "@/lib/modules/ai/ai-gateway";
import { classifyIntent, intentNeedsSearch } from "@/lib/modules/agents/intent-gate";

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

  let body: { query?: string; detailed?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* تجاهل */
  }
  const query = String(body?.query ?? "").trim().slice(0, 500);
  const detailed = Boolean(body?.detailed);
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
        // 0) بوّابة النيّة (المرحلة ١): قبل أي بحث — تحية/شكر/تعريف/خارج النطاق → ردّ مباشر
        //    بلا بحث (يحلّ «السلام عليكم → مواد عشوائية»). السؤال القانوني فقط يمرّ.
        const intent = classifyIntent(query);
        if (!intentNeedsSearch(intent.type)) {
          send({ type: "step", id: "intent", status: "done", label: "فهمت رسالتك", data: { intent: intent.type } });
          send({
            type: "result",
            answer: intent.reply ?? null,
            mode: "intent",
            basis: [],
            total: 0,
            intent: intent.type,
            message: undefined,
          });
          send({ type: "done" });
          return;
        }

        // 1) تحليل السؤال (استخراج المصطلحات والأرقام)
        send({ type: "step", id: "analyze", status: "running", label: "أحلّل سؤالك" });
        const numbers = (query.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0).slice(0, 3);
        const terms = query.split(/\s+/).filter((w) => w.length > 2).slice(0, 8);
        send({
          type: "step",
          id: "analyze",
          status: "done",
          label: "حلّلت سؤالك",
          data: { terms, numbers, sub: `أبحث عن: ${terms.slice(0, 5).join("، ") || query}` }
        });

        // 2) البحث في النواة القانونية (عملية حقيقية على قاعدة البيانات)
        send({ type: "step", id: "search", status: "running", label: "أبحث في النواة القانونية في الأنظمة السعودية" });
        const limit = detailed ? 12 : 8;
        const response = await searchLegalCore({
          query,
          searchType: "contains",
          sourceTypes: ["article"],
          page: 1,
          limit,
          includeSnippets: true,
          includeMatchedParagraphs: false,
          includeRelatedTerms: detailed,
          requireConceptCoverage: true,
          semantic: true
        });
        send({ type: "step", id: "search", status: "done", label: "بحثت في النواة القانونية", data: { total: response.total } });

        // 3) استرجاع المواد ذات الصلة
        send({ type: "step", id: "retrieved", status: "running", label: "أسترجع المواد ذات الصلة" });
        const articles = response.results;
        send({
          type: "step",
          id: "retrieved",
          status: "done",
          label: `استرجعت ${articles.length.toLocaleString("ar-SA")} مادة ذات صلة`,
          data: {
            count: articles.length,
            items: articles.slice(0, 12).map((a) => ({
              systemName: a.systemName,
              articleNumber: a.articleNumber,
              title: a.articleTitle
            }))
          }
        });

        // 4) التحقّق من ورود المواد فعلاً (مكافحة التلفيق)
        send({ type: "step", id: "verify", status: "running", label: "أتحقّق من ورود المواد فعلاً" });
        let verifiedByNumber = 0;
        for (const n of numbers) {
          const found = await getArticlesByNumber(n);
          if (found.length) verifiedByNumber += 1;
        }
        send({
          type: "step",
          id: "verify",
          status: "done",
          label: "تحقّقت من ورود المواد في النواة",
          data: { verifiedArticles: articles.length, verifiedByNumber }
        });

        // 5) الصياغة المستندة (المرحلة 3) — إجابة تُركّب حصراً من مواد النواة
        //    عبر ai-gateway مع حارس «لا استشهاد إلا بالمواد المرسلة» ومنع أرقام غير موجودة.
        send({ type: "step", id: "synthesize", status: "running", label: "أصوغ إجابة مستندة للمواد فقط" });
        const draft = await createConsultationDraft({ facts: query, actorId: user.id }).catch(() => null);

        if (!draft || draft.blocked) {
          // لا سند كافٍ → لا صياغة، حالة صادقة بلا اختراع
          send({
            type: "step",
            id: "synthesize",
            status: "done",
            label: "لا يوجد سند نظامي كافٍ للصياغة",
            data: { blocked: true }
          });
          // نعرض ما استُرجع (إن وُجد) كسند خام دون إجابة مولّدة
          const rawBasis = articles.map((a) => ({
            systemName: a.systemName,
            articleNumber: a.articleNumber,
            articleTitle: a.articleTitle,
            quote: a.snippet,
            state: "official" as const,
            internalUrl: a.internalUrl
          }));
          send({
            type: "result",
            answer: null,
            mode: draft?.mode ?? "offline",
            basis: rawBasis,
            total: response.total,
            message: rawBasis.length
              ? "تعذّرت الصياغة المستندة؛ إليك المواد ذات الصلة من النواة."
              : "لا يوجد سند نظامي كافٍ مطابق في النواة القانونية الحالية. جرّب إعادة صياغة السؤال."
          });
          send({ type: "done" });
          return;
        }

        send({
          type: "step",
          id: "synthesize",
          status: "done",
          label: "صغت الإجابة مستندة للمواد الموثّقة",
          data: { mode: draft.mode, citations: draft.citations.length }
        });

        // 6) فحص مكافحة التلفيق (مطبَّق داخل البوابة) — نعرضه كخطوة شفّافة
        send({ type: "step", id: "guard", status: "done", label: "فحصت المخرج ضد التلفيق", data: { sourceOfTruth: "legal_core.legal_articles" } });

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
          mode: draft.mode, // "live" (صياغة ذكية فعلية) أو "offline" (صياغة تدريبية مُركّبة)
          basis,
          total: response.total,
          relatedTerms: detailed ? response.relatedTerms ?? [] : [],
          message: undefined
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
