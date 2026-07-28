import type { AuditSubject } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { applyApprovedChange } from "@/lib/modules/rasd/review/apply";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("RASD_APPLY", request);
  if (gate.response) return gate.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const changeId = typeof body.changeId === "string" ? body.changeId.trim() : "";
  const dryRun = body.dryRun !== false;
  if (!changeId) {
    return NextResponse.json({ message: "changeId مطلوب." }, { status: 400 });
  }

  await auditEvent({
    actorId: gate.user.id,
    subject: "RASD" as AuditSubject,
    action: "rasd.apply.requested",
    entityId: changeId,
    metadata: { dryRun }
  }).catch(() => undefined);

  try {
    const result = await applyApprovedChange(changeId, gate.user.id, { dryRun });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
