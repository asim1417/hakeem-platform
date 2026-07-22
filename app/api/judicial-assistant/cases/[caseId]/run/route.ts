// ─────────────────────────────────────────────────────────────────────────────
// POST /api/judicial-assistant/cases/[caseId]/run — مشغّلٌ موحَّد للخدمات النموذجيّة
// (الملخّص JS-001 · الدراسة JS-013 · الأعمال JS-002… · مشروع الحكم JS-018).
// متداخلٌ تحت cases/[caseId] مثل extract-map العامل — تفاديًا لتعذّر نشر المسارات المسطّحة
// المكافئة على Vercel. نفس الدوالّ والمخرجات؛ لا تغيير في منطق التوليد ولا في شكل النتيجة.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";
import { runnerFor } from "@/lib/modules/judicial-assistant/routing";
import { generateExecutiveSummary } from "@/lib/modules/judicial-assistant/summary";
import { buildJudicialStudy } from "@/lib/modules/judicial-assistant/study";
import { runGroundedWork } from "@/lib/modules/judicial-assistant/works";
import { buildJudgmentDraft } from "@/lib/modules/judicial-assistant/drafting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ serviceId: z.string().min(1), depth: z.enum(["short", "medium", "extended"]).optional() });

export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "طلبٌ غير صالح." }, { status: 400 });
  }

  const kase = await getCase(params.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  const runner = runnerFor(body.serviceId);
  try {
    let result: { blocked: boolean; requestId?: string };
    if (runner === "summary") result = await generateExecutiveSummary(kase, actorId);
    else if (runner === "study") result = await buildJudicialStudy(kase, body.depth ?? "medium", actorId);
    else if (runner === "work") result = await runGroundedWork(body.serviceId, kase, actorId);
    else if (runner === "draft") result = await buildJudgmentDraft(kase, actorId);
    else return NextResponse.json({ message: "هذا المسار للخدمات النموذجيّة فقط." }, { status: 400 });

    await saveAnalysis({
      caseRef: kase.id, caseNumber: kase.caseNumber ?? kase.subject, serviceId: body.serviceId,
      blocked: result.blocked, payload: result as unknown as Record<string, unknown>, actorId,
    }).catch(() => undefined);
    await auditEvent({
      actorId, subject: "CASE", action: result.blocked ? "JA_WORK_BLOCKED" : "JA_WORK_GENERATED", entityId: kase.id,
      metadata: { service: body.serviceId, requestId: result.requestId, via: "run" },
    }).catch(() => undefined);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ message: `تعذّر تشغيل الخدمة: ${err instanceof Error ? err.message.slice(0, 200) : "خطأٌ غير متوقّع"}` }, { status: 500 });
  }
}
