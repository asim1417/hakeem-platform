import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getCase } from "@/lib/modules/judicial-assistant/store";
import { extractCaseMap } from "@/lib/modules/judicial-assistant/extract-map";

export const dynamic = "force-dynamic";

/** POST /api/judicial-assistant/cases/[caseId]/extract-map — يقترح خريطةً من المرفقات (لا يحفظ). */
export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  const kase = await getCase(params.caseId);
  if (!kase || (kase.ownerId !== actorId && gate.user!.role !== "SYSTEM_ADMIN")) {
    return NextResponse.json({ message: "القضية غير موجودة." }, { status: 404 });
  }

  const proposal = await extractCaseMap(kase);

  await auditEvent({
    actorId, subject: "CASE", action: "JA_MAP_EXTRACTED", entityId: kase.id,
    metadata: {
      service: "JS-005", blocked: proposal.blocked,
      counts: { parties: proposal.parties.length, requests: proposal.requests.length, facts: proposal.facts.length, issues: proposal.issues.length },
    },
  }).catch(() => undefined);

  return NextResponse.json(proposal);
}
