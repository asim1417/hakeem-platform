import { NextRequest, NextResponse } from "next/server";
import { getArticleDetail } from "@/lib/modules/library/library-service";
import { buildOfficialCitation } from "@/components/legal-core";
import { buildArticleEli } from "@/lib/modules/legal-core/eli";
import { handleLegalApi, corsPreflight } from "@/lib/modules/api-gateway/gateway-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = corsPreflight;

// GET /api/legal/articles/:id — المادة مع الاستناد الرسمي والمعرّف التشريعي.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleLegalApi(request, "legal:read", async () => {
    const article = await getArticleDetail(params.id);
    if (!article) return NextResponse.json({ ok: false, error: "المادة غير موجودة." }, { status: 404 });

    return NextResponse.json({
      ok: true,
      article,
      citation: buildOfficialCitation({ lawName: article.lawName, articleNumber: article.articleNumber, royalDecree: article.royalDecree, effectiveFrom: article.effectiveFrom }),
      eli: buildArticleEli(article.lawName, article.articleNumber, article.legalSystem?.eliSlug).id,
    });
  });
}
