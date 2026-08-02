import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import { guardAiService } from "@/lib/modules/billing/service-guard";

export const dynamic = "force-dynamic";

const schema = z.object({
  facts: z.string().trim().min(10).max(8000),
  claims: z.string().trim().max(4000).optional(),
  defenses: z.string().trim().max(4000).optional(),
  documents: z.array(z.string().trim().max(500)).max(50).optional(),
  caseType: z.string().trim().max(100).optional(),
});

// POST /api/case-analysis — محرك تحليل القضايا (مُسنَد فوق Legal RAG).
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "أرسل وقائع الدعوى (١٠ أحرف فأكثر) مع الطلبات والدفوع اختياراً." }, { status: 400 });
  }

  const guard = await guardAiService({ userId: gate.user!.id, serviceCode: "ACTION_PLAN", rateLimit: { limit: 30, windowSec: 60 } });
  if (!guard.allowed) {
    return NextResponse.json(
      { message: guard.message, reason: guard.reason },
      { status: guard.reason === "rate_limited" ? 429 : 402 }
    );
  }

  try {
    const result = await analyzeCase(parsed.data);
    await guard.settle();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await guard.release();
    throw e;
  }
}
