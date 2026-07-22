import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { streamAsk, type AskStreamEvent } from "@/lib/modules/judicial-assistant/ask-stream";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";
import { createJob, updateJob } from "@/lib/modules/jobs/job-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// أقصى مهلةٍ تسمح بها الخطّة فعليًّا (ليست سقفًا من عندنا): جُرّب 800ث فرفضته بنية Vercel،
// و300ث هو الأعلى المقبول والمنشور بنجاح. يُرفَع تلقائيًّا متى رفعت الخطّة حدّها.
export const maxDuration = 300;

const schema = z.object({ question: z.string().min(3, "اكتب طلبك."), caseId: z.string().optional() });

/** POST /api/judicial-assistant/ask/stream — بثّ حيّ (SSE) لموجّه المعاون. */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "اكتب طلبًا واضحًا (٣ أحرف على الأقلّ)." }, { status: 400 });
  }

  let kase = null;
  if (body.caseId) {
    kase = await getCase(body.caseId);
    if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
      return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
    }
  }

  // مهمّةٌ خلفيّة قابلةٌ للاستئناف: يُكمل الخادم التوليد ويحفظه دوريًّا حتى لو انقطع العميل.
  const jobId = await createJob(actorId, "ja-ask", body.question.slice(0, 120)).catch(() => null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // بثٌّ صامدٌ للانقطاع: إن تعذّر الإرسال (غادر العميل) نُكمل التوليد والحفظ في الخلفيّة.
      let clientGone = false;
      const send = (o: AskStreamEvent) => {
        if (clientGone) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`)); }
        catch { clientGone = true; }
      };
      let done: Extract<AskStreamEvent, { type: "done" }> | null = null;
      let acc = "";
      let lastSave = 0;
      if (jobId) send({ type: "job", jobId });
      try {
        for await (const ev of streamAsk(body.question, kase, actorId)) {
          if (ev.type === "done") done = ev;
          if (ev.type === "delta") {
            acc += ev.text;
            const now = Date.now();
            if (jobId && now - lastSave > 1500) { lastSave = now; void updateJob(jobId, { text: acc }); }
          }
          send(ev);
        }
      } catch {
        send({ type: "done", blocked: true, citations: [], notice: "تعذّر التشغيل.", answer: "تعذّر إكمال الطلب — أعِد المحاولة.", requestId: "error" });
      }
      // ختم المهمّة الخلفيّة بالنتيجة النهائيّة (يجلبها العميل عند العودة).
      if (jobId) {
        await updateJob(jobId, {
          text: done?.answer ?? acc,
          meta: { citations: done?.citations ?? [], notice: done?.notice ?? "", blocked: done?.blocked ?? false, greeting: done?.greeting ?? false },
          status: done && done.requestId !== "error" ? "done" : "error",
        }).catch(() => undefined);
      }

      // آثارٌ جانبيّة بعد اكتمال البثّ: حفظٌ في سجلّ القضية (لا تُحفَظ التحيّة) + تدقيق.
      if (kase && done && !done.greeting && done.requestId !== "error") {
        await saveAnalysis({
          caseRef: kase.id, caseNumber: kase.caseNumber ?? kase.subject, serviceId: "ASK",
          blocked: done.blocked, payload: { question: body.question, answer: done.answer, citations: done.citations, requestId: done.requestId }, actorId,
        }).catch(() => undefined);
      }
      await auditEvent({
        actorId, subject: "CASE", action: done?.blocked ? "JA_ASK_BLOCKED" : "JA_ASK", entityId: kase?.id,
        metadata: { requestId: done?.requestId, hasCase: Boolean(kase), citations: done?.citations.length ?? 0, streamed: true },
      }).catch(() => undefined);

      try { controller.close(); } catch { /* أُغلق مسبقًا (غادر العميل) */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
