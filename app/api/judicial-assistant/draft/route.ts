import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { buildJudgmentDraft } from "@/lib/modules/judicial-assistant/drafting";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // التوليد المؤصَّل قد يتجاوز المهلة الافتراضية

const schema = z.object({ caseId: z.string().min(1) });

/**
 * POST /api/judicial-assistant/draft — JS-018 مشروع الحكم.
 * هيكلٌ حتميّ + تسبيبٌ مؤصَّل بالنواة + سوابق من أحكام النواة. مسودّة human-in-the-loop.
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
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  const result = await buildJudgmentDraft(kase, actorId);

  await saveAnalysis({
    caseRef: kase.id,
    caseNumber: kase.caseNumber ?? kase.subject,
    serviceId: "JS-018",
    blocked: result.blocked,
    payload: {
      sections: result.sections,
      citations: result.citations,
      precedents: result.precedents.map((p) => ({ id: p.id, title: p.title })),
      requestId: result.requestId,
    },
    actorId,
  });

  await auditEvent({
    actorId,
    subject: "CASE",
    action: result.blocked ? "JA_DRAFT_BLOCKED" : "JA_DRAFT_GENERATED",
    entityId: kase.id,
    metadata: {
      service: "JS-018",
      requestId: result.requestId,
      caseNumber: kase.caseNumber ?? kase.subject,
      citations: result.citations.length,
      precedents: result.precedents.length,
    },
  }).catch(() => undefined);

  return NextResponse.json(result);
}
