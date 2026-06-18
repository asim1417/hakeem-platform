import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getIntelligenceSummary } from "@/lib/modules/legal-core/intelligence";

export const dynamic = "force-dynamic";

// GET /api/legal-core/intelligence-summary — إحصاءات النواة وجودة الربط (للقراءة فقط).
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  const summary = await getIntelligenceSummary();
  return NextResponse.json({ ok: true, ...summary });
}
