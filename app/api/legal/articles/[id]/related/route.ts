import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getArticleDetail, getRelatedArticles } from "@/lib/modules/library/library-service";
import { extractArticleReferences } from "@/lib/modules/legal-core/cross-references";

export const dynamic = "force-dynamic";

// GET /api/legal/articles/:id/related — المواد ذات الصلة + الإحالات الداخلية المستخرَجة.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const article = await getArticleDetail(params.id);
  if (!article) return NextResponse.json({ ok: false, error: "المادة غير موجودة." }, { status: 404 });

  const [related] = await Promise.all([
    getRelatedArticles({ id: article.id, lawName: article.lawName, classification: article.classification })
  ]);
  const crossReferences = extractArticleReferences(article.content, article.articleNumber);

  return NextResponse.json({ ok: true, related, crossReferences });
}
