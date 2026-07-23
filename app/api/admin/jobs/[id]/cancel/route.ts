import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { cancelJob } from "@/lib/modules/jobs/job-store";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const result = await cancelJob(params.id);
  if (!result.ok) {
    const status = result.reason === "not_running" ? 409 : 400;
    return NextResponse.json(
      { ok: false, message: result.reason === "not_running" ? "المهمة ليست جارية." : "تعذّر إيقاف المهمة." },
      { status }
    );
  }

  await auditEvent({
    actorId: gate.user.id,
    subject: "ADMIN",
    action: "JOB_CANCEL",
    entityId: params.id,
    metadata: { kind: result.job.kind, ownerId: result.job.ownerId },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, job: result.job });
}
