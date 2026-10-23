// POST /api/admin/legal-core/reindex — إعادة فهرسة بحث النواة (يملأ search_norm).
// يُشغَّل بعد استيراد الأنظمة كي تُطابِق خدمات المعاون و«اسأل حكيم» موادَّ المكتبة.
// صلاحية LEGAL_CORE_ADMIN + تسجيل تدقيق. آمنٌ للاستئناف (idempotent).
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { reindexSearchNorm, type ReindexScope } from "@/lib/modules/legal-core/reindex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;

  // all: الكل · stale: الفارغ وما تغيّر نصه الساري (HKM-030) · الافتراضي: الفارغ فقط.
  let scope: ReindexScope = false;
  try {
    const body = await request.json();
    scope = body?.all ? true : body?.stale ? "stale" : false;
  } catch { /* الافتراضي: الفارغ فقط */ }

  try {
    const result = await reindexSearchNorm(scope);
    await auditEvent({
      actorId: gate.user?.id, subject: "ADMIN", action: "LEGAL_CORE_REINDEXED",
      metadata: { all: scope === true, stale: scope === "stale", ...result },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, ...result, message: `اكتملت الفهرسة — مسح ${result.scanned}، حُدِّث ${result.updated}، المفهرس الآن ${result.total}.` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "تعذّرت الفهرسة." }, { status: 500 });
  }
}
