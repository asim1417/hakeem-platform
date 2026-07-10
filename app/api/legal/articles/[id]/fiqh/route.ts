import { NextRequest, NextResponse } from "next/server";
import { getArticleDetail } from "@/lib/modules/library/library-service";
import { getFiqhIssuesForArticle } from "@/lib/modules/legal-core/fiqh-issues";
import { FIQH_NONBINDING_NOTICE } from "@/lib/modules/legal-core/content-separation";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/articles/:id/fiqh — المواءمة الفقهية المساندة (غير ملزمة).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleLegalApi(request, "legal:read", async () => {
    const article = await getArticleDetail(params.id);
    if (!article) return NextResponse.json({ ok: false, error: "المادة غير موجودة." }, { status: 404 });

    const fiqh = getFiqhIssuesForArticle(article.lawName, article.articleNumber);
    return NextResponse.json({
      ok: true,
      // تنبيه إلزامي: المواءمة الفقهية مساندة وغير ملزمة، وليست نصًا نظاميًا.
      notice: FIQH_NONBINDING_NOTICE,
      binding: false,
      fiqh,
    });
  });
}
