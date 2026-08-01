import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getSession, buildReport } from "@/lib/modules/review/service";

export const dynamic = "force-dynamic";

/** GET /api/review/sessions/[id] — تفاصيل الجلسة (ملاحظات + اقتراحات + تقرير). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  try {
    const session = await getSession(params.id, gate.user!.id);
    if (!session) return NextResponse.json({ message: "غير موجودة." }, { status: 404 });
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ message: "غير متاح حاليًّا." }, { status: 503 });
  }
}

/** POST /api/review/sessions/[id] — تجميع/تحديث تقرير المراجعة. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  try {
    const report = await buildReport(params.id, gate.user!.id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "تعذّر بناء التقرير." },
      { status: 500 }
    );
  }
}
