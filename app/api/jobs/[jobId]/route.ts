// GET /api/jobs/[jobId] — استئناف مهمّةٍ خلفيّة: يعيد حالتها ونصّها المتراكم/النهائيّ لمالكها.
// يُستدعى من العميل عند العودة للصفحة (بعد تعليق المتصفّح) ليعرض ما أكمله الخادم في الخلفيّة.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getJob } from "@/lib/modules/jobs/job-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { jobId: string } }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const job = await getJob(params.jobId, user.id);
  if (!job) return NextResponse.json({ message: "المهمّة غير موجودة." }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
