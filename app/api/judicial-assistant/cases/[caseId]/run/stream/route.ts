// POST /api/judicial-assistant/cases/[caseId]/run/stream — بثٌّ حيّ (NDJSON) لمخرَج خدمةٍ نموذجيّة.
// متداخلٌ كـ extract-map/ask-stream العاملة. يبثّ التوليد تدريجيًّا (كـ«اسأل حكيم») فيتفادى 504.
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { streamService, serviceTitle } from "@/lib/modules/judicial-assistant/run-stream";
import { createJob, updateJob } from "@/lib/modules/jobs/job-store";
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

  // مهمّةٌ خلفيّة قابلةٌ للاستئناف (يُكمل الخادم التوليد ويحفظه حتى لو انقطع العميل).
  const jobId = await createJob(actorId, `ja-service:${serviceId}`, serviceTitle(serviceId)).catch(() => null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientGone = false;
      const send = (o: unknown) => {
        if (clientGone) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(o) + "\n")); } catch { clientGone = true; }
      };
      let acc = "";
      let lastSave = 0;
      let doneMeta: { citations?: unknown; notice?: unknown; blocked?: unknown } | null = null;
      if (jobId) send({ type: "job", jobId });
      try {
        for await (const ev of streamService(kase, serviceId, body.depth)) {
          if (ev.type === "delta") {
            acc += ev.text;
            const now = Date.now();
            if (jobId && now - lastSave > 1500) { lastSave = now; void updateJob(jobId, { text: acc }); }
          } else if (ev.type === "done") {
            doneMeta = { citations: ev.citations, notice: ev.notice, blocked: ev.blocked };
          }
          send(ev);
        }
      } catch {
        send({ type: "done", blocked: true, citations: [], notice: "تعذّر تشغيل الخدمة حاليًا. أعِد المحاولة." });
      } finally {
        if (jobId) {
          await updateJob(jobId, {
            text: acc,
            meta: { citations: doneMeta?.citations ?? [], notice: doneMeta?.notice ?? "", blocked: doneMeta?.blocked ?? false, serviceId },
            status: doneMeta ? "done" : "error",
          }).catch(() => undefined);
        }
        await auditEvent({
          actorId, subject: "CASE", action: "JA_WORK_GENERATED", entityId: kase.id,
          metadata: { service: serviceId, via: "run-stream", jobId },
        }).catch(() => undefined);
        try { controller.close(); } catch { /* أُغلق مسبقًا */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
