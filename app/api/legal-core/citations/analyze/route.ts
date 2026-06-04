import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { analyzeJudgmentCitations } from "@/lib/modules/legal-core/judgment-citation-extractor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const body = (await request.json().catch(() => null)) as { judgmentText?: string } | null;
  const judgmentText = body?.judgmentText?.trim() ?? "";
  if (!judgmentText) {
    return NextResponse.json({ message: "أدخل نص الحكم القضائي قبل التحليل." }, { status: 400 });
  }

  const analysis = await analyzeJudgmentCitations(judgmentText);
  return NextResponse.json(analysis);
}
