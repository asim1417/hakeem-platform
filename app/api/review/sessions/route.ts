import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { createSession, listSessions } from "@/lib/modules/review/service";

export const dynamic = "force-dynamic";

/** GET /api/review/sessions — جلسات المراجعة الخاصّة بالمستخدم (§12). */
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  try {
    const sessions = await listSessions(gate.user!.id);
    return NextResponse.json({ sessions });
  } catch {
    // fail-open قبل تطبيق الهجرة: لا تعطّل الواجهة.
    return NextResponse.json({ sessions: [], pending: true });
  }
}

/** POST /api/review/sessions — إنشاء جلسة مراجعة. */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const entityType = String(body?.entityType ?? "other").trim() || "other";
  if (!title) return NextResponse.json({ message: "العنوان مطلوب." }, { status: 400 });
  try {
    const session = await createSession({
      ownerId: gate.user!.id,
      title,
      entityType,
      entityId: body?.entityId ? String(body.entityId) : undefined,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "تعذّر إنشاء الجلسة." },
      { status: 500 }
    );
  }
}
