import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getArticleIntelligence } from "@/lib/modules/legal-core/intelligence";

export const dynamic = "force-dynamic";

// GET /api/legal-core/article/[articleId]/intelligence — مادة + استشهاد + أحكام/مبادئ/علاقات + أزرار.
export async function GET(request: NextRequest, { params }: { params: { articleId: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const intel = await getArticleIntelligence(params.articleId);
  if (!intel.found) {
    return NextResponse.json({ ok: false, message: "لم يتم العثور على المادة." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...intel });
}
