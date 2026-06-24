import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getArticleDetail } from "@/lib/modules/library/library-service";
import { buildOfficialCitation } from "@/components/legal-core";
import { buildArticleEli } from "@/lib/modules/legal-core/eli";

export const dynamic = "force-dynamic";

// GET /api/legal/articles/:id — المادة مع الاستناد الرسمي والمعرّف التشريعي.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const article = await getArticleDetail(params.id);
  if (!article) return NextResponse.json({ ok: false, error: "المادة غير موجودة." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    article,
    citation: buildOfficialCitation({ lawName: article.lawName, articleNumber: article.articleNumber, royalDecree: article.royalDecree, effectiveFrom: article.effectiveFrom }),
    eli: buildArticleEli(article.lawName, article.articleNumber).id
  });
}
