import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getRelationsForEntity, hydrateRelations } from "@/lib/modules/knowledge-graph/relations";

export const dynamic = "force-dynamic";

// GET — علاقات مادة بعينها (مصدراً أو هدفاً)، مع إثراء الكيانات المرتبطة.
export async function GET(request: NextRequest, { params }: { params: { articleId: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const articleId = params.articleId?.trim();
  if (!articleId) {
    return NextResponse.json({ ok: false, error: "معرّف المادة مطلوب." }, { status: 400 });
  }

  const relations = await getRelationsForEntity("article", articleId);
  const hydrated = await hydrateRelations(relations);

  // تصنيف ما يرتبط بالمادة حسب نوع الطرف الآخر
  const linkedRulings = hydrated.filter(
    (r) => (r.source.id === articleId ? r.target.type : r.source.type) === "ruling"
  );
  const linkedPrinciples = hydrated.filter(
    (r) => (r.source.id === articleId ? r.target.type : r.source.type) === "principle"
  );

  return NextResponse.json({
    ok: true,
    articleId,
    count: hydrated.length,
    relations: hydrated,
    linkedRulings,
    linkedPrinciples,
  });
}
