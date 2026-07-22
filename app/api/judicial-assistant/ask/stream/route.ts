import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { streamAsk, type AskStreamEvent } from "@/lib/modules/judicial-assistant/ask-stream";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: AskStreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
      let done: Extract<AskStreamEvent, { type: "done" }> | null = null;
      try {
        for await (const ev of streamAsk(body.question, kase, actorId)) {
          if (ev.type === "done") done = ev;
          send(ev);
        }
      } catch {
        send({ type: "done", blocked: true, citations: [], notice: "تعذّر التشغيل.", answer: "تعذّر إكمال الطلب — أعِد المحاولة.", requestId: "error" });
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

      controller.close();
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
