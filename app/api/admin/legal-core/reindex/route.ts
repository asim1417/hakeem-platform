// POST /api/admin/legal-core/reindex — إعادة فهرسة بحث النواة (يملأ search_norm).
// يُشغَّل بعد استيراد الأنظمة كي تُطابِق خدمات المعاون و«اسأل حكيم» موادَّ المكتبة.
// صلاحية LEGAL_CORE_ADMIN + تسجيل تدقيق. آمنٌ للاستئناف (idempotent).
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { reindexSearchNorm } from "@/lib/modules/legal-core/reindex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_ADMIN", request);
  if (gate.response) return gate.response;

  let all = false;
  try { all = Boolean((await request.json())?.all); } catch { /* الافتراضي: الفارغ فقط */ }

  try {
    const result = await reindexSearchNorm(all);
    await auditEvent({
      actorId: gate.user?.id, subject: "ADMIN", action: "LEGAL_CORE_REINDEXED",
      metadata: { all, ...result },
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, ...result, message: `اكتملت الفهرسة — مسح ${result.scanned}، حُدِّث ${result.updated}، المفهرس الآن ${result.total}.` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "تعذّرت الفهرسة." }, { status: 500 });
  }
}
