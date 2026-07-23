import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { reapStaleRunningJobs } from "@/lib/modules/jobs/job-store";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

/** يحصد المهام الجارية المتوقفة (افتراضي 30 دقيقة بلا تحديث). */
export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { maxAgeMinutes?: number };
  const result = await reapStaleRunningJobs(body.maxAgeMinutes ?? 30);

  await auditEvent({
    actorId: gate.user.id,
    subject: "ADMIN",
    action: "JOB_REAP_STALE",
    metadata: { reaped: result.reaped, maxAgeMinutes: body.maxAgeMinutes ?? 30 },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, ...result });
}
