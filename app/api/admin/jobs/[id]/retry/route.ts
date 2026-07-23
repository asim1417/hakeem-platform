import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { retryJob } from "@/lib/modules/jobs/job-store";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const result = await retryJob(params.id);
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "المهمة غير موجودة.",
      still_running: "أوقف المهمة أولًا قبل إعادة التشغيل.",
      create_failed: "تعذّر إنشاء مهمة جديدة.",
    };
    return NextResponse.json(
      { ok: false, message: messages[result.reason] || "تعذّر إعادة التشغيل." },
      { status: result.reason === "still_running" ? 409 : 400 }
    );
  }

  await auditEvent({
    actorId: gate.user.id,
    subject: "ADMIN",
    action: "JOB_RETRY",
    entityId: result.jobId,
    metadata: { retriedFrom: result.source.id, kind: result.source.kind },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    jobId: result.jobId,
    sourceId: result.source.id,
    status: "queued",
    message: "سُجّلت إعادة التشغيل بانتظار التنفيذ من واجهة المستخدم.",
  });
}
