// POST /api/judicial-assistant/cases/[caseId]/run/stream — بثٌّ حيّ (NDJSON) لمخرَج خدمةٍ نموذجيّة.
// متداخلٌ كـ extract-map/ask-stream العاملة. يبثّ التوليد تدريجيًّا (كـ«اسأل حكيم») فيتفادى 504.
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { streamService } from "@/lib/modules/judicial-assistant/run-stream";
import type { StudyDepth } from "@/lib/modules/judicial-assistant/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// أقصى مهلةٍ تسمح بها الخطّة فعليًّا (ليست سقفًا من عندنا): جُرّب 800ث فرفضته بنية Vercel،
// و300ث هو الأعلى المقبول والمنشور بنجاح. يُرفَع تلقائيًّا متى رفعت الخطّة حدّها.
export const maxDuration = 300;

export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: { serviceId?: string; depth?: StudyDepth } = {};
  try { body = await request.json(); } catch { /* تجاهل */ }
  const serviceId = String(body.serviceId ?? "").trim();
  if (!serviceId) return NextResponse.json({ message: "معرّف الخدمة مطلوب." }, { status: 400 });

  const kase = await getCase(params.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        for await (const ev of streamService(kase, serviceId, body.depth)) send(ev);
      } catch {
        send({ type: "done", blocked: true, citations: [], notice: "تعذّر تشغيل الخدمة حاليًا. أعِد المحاولة." });
      } finally {
        await auditEvent({
          actorId, subject: "CASE", action: "JA_WORK_GENERATED", entityId: kase.id,
          metadata: { service: serviceId, via: "run-stream" },
        }).catch(() => undefined);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
