import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { runLegalAgent } from "@/lib/modules/legal-agent/legal-agent";

export const dynamic = "force-dynamic";

const schema = z.object({
  caseFacts: z.string().trim().min(10).max(8000),
  claims: z.string().trim().max(4000).optional(),
  defenses: z.string().trim().max(4000).optional(),
  documents: z.array(z.string().trim().max(500)).max(50).optional(),
  partyRole: z.enum(["PLAINTIFF", "DEFENDANT"]).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  caseType: z.string().trim().max(100).optional(),
});

// POST /api/legal-agent — وكيل قانوني يحوّل تحليل القضية إلى خطة عمل مُسنَدة.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "أرسل وقائع الدعوى (١٠ أحرف فأكثر) مع الدور والطلبات والدفوع اختياراً." }, { status: 400 });
  }

  const plan = await runLegalAgent(parsed.data);
  return NextResponse.json({ ok: true, ...plan });
}
