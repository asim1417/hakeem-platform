import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { buildJudicialStudy } from "@/lib/modules/judicial-assistant/study";
import { saveAnalysis } from "@/lib/modules/judicial-assistant/persistence";

export const dynamic = "force-dynamic";

const schema = z.object({ caseId: z.string().min(1), depth: z.enum(["short", "medium", "extended"]).optional() });

/** POST /api/judicial-assistant/study — JS-013 الدراسة القضائيّة المعمّقة (مؤصَّلة على النواة). */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "طلبٌ غير صالح." }, { status: 400 });
  }

  const kase = await getCase(body.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  const result = await buildJudicialStudy(kase, body.depth ?? "medium", actorId);

  await saveAnalysis({
    caseRef: kase.id, caseNumber: kase.caseNumber ?? kase.subject, serviceId: "JS-013",
    blocked: result.blocked,
    payload: { depth: result.depth, body: result.body, citations: result.citations, precedents: result.precedents.map((p) => ({ id: p.id, title: p.title })), requestId: result.requestId },
    actorId,
  });

  await auditEvent({
    actorId, subject: "CASE", action: result.blocked ? "JA_STUDY_BLOCKED" : "JA_STUDY_GENERATED", entityId: kase.id,
    metadata: { service: "JS-013", depth: result.depth, requestId: result.requestId, citations: result.citations.length, precedents: result.precedents.length },
  }).catch(() => undefined);

  return NextResponse.json(result);
}
