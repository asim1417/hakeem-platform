import { NextRequest, NextResponse } from "next/server";
import { getArticleDetail, getRelatedArticles } from "@/lib/modules/library/library-service";
import { extractArticleReferences } from "@/lib/modules/legal-core/cross-references";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/articles/:id/related — المواد ذات الصلة + الإحالات الداخلية المستخرَجة.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleLegalApi(request, "legal:read", async () => {
    const article = await getArticleDetail(params.id);
    if (!article) return NextResponse.json({ ok: false, error: "المادة غير موجودة." }, { status: 404 });

    const related = await getRelatedArticles({ id: article.id, lawName: article.lawName, classification: article.classification });
    const crossReferences = extractArticleReferences(article.content, article.articleNumber);
    return NextResponse.json({ ok: true, related, crossReferences });
  });
}
