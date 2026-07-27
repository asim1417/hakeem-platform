import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { submitReviewDecision, type ReviewDecision } from "@/lib/modules/rasd/review/workflow";

export const dynamic = "force-dynamic";

const decisions = new Set([
  "APPROVE",
  "REJECT",
  "REQUEST_RECHECK",
  "DEFER",
  "MERGE_WITH_EXISTING",
  "MARK_AS_FALSE_POSITIVE",
  "ESCALATE_LEGAL_REVIEW"
]);

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const changeId = typeof body.changeId === "string" ? body.changeId : "";
  const decision = typeof body.decision === "string" && decisions.has(body.decision) ? (body.decision as ReviewDecision) : undefined;
  if (!changeId || !decision) {
    return NextResponse.json({ message: "changeId و decision مطلوبان." }, { status: 400 });
  }
  const result = await submitReviewDecision(
    changeId,
    decision,
    { id: gate.user.id, role: gate.user.role, name: gate.user.name },
    {
      reason: typeof body.reason === "string" ? body.reason : undefined,
      approvedPayload: typeof body.approvedPayload === "object" && body.approvedPayload !== null ? body.approvedPayload : undefined
    }
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
