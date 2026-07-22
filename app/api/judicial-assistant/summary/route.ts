import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { generateExecutiveSummary } from "@/lib/modules/judicial-assistant/summary";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // التوليد المؤصَّل قد يتجاوز المهلة الافتراضية

const schema = z.object({ caseId: z.string().min(1) });

/**
 * POST /api/judicial-assistant/summary — JS-001 الملخّص التنفيذيّ لقضيةٍ (بيانات صناعيّة).
 * مؤصَّلٌ بالنواة، حجبٌ صادق عند غياب السند، وسجلّ تدقيقٍ لكلّ تشغيل (§60، §16).
 */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let caseId: string;
  try {
    caseId = schema.parse(await request.json()).caseId;
  } catch {
    return NextResponse.json({ message: "معرّف القضية غير صالح." }, { status: 400 });
  }

  const kase = await getCase(caseId);
  // ABAC: القضية للمالك أو للمدير فقط.
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  try {
    const result = await generateExecutiveSummary(kase, actorId);

    // حفظ المخرَج — دفاعيّ: لا يكسر الاستجابة إن لم يوجد الجدول بعد.
    await saveAnalysis({
      caseRef: kase.id,
      caseNumber: kase.caseNumber ?? kase.subject,
      serviceId: "JS-001",
      blocked: result.blocked,
      payload: { summary: result.summary, citations: result.citations, requestId: result.requestId },
      actorId,
    });

    await auditEvent({
      actorId,
      subject: "CASE",
      action: result.blocked ? "JA_SUMMARY_BLOCKED" : "JA_SUMMARY_GENERATED",
      entityId: kase.id,
      metadata: { service: "JS-001", requestId: result.requestId, caseNumber: kase.caseNumber, synthetic: true, citations: result.citations.length },
    }).catch(() => undefined);

    return NextResponse.json(result);
  } catch (err) {
    // لا نُعيد صفحة خطأٍ (HTML) تكسر res.json() في المتصفّح — بل JSON صريح.
    return NextResponse.json({ message: `تعذّر توليد الملخّص: ${err instanceof Error ? err.message.slice(0, 200) : "خطأٌ غير متوقّع"}` }, { status: 500 });
  }
}
