import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSystemSlug, parseArticleEli, lawSlug } from "@/lib/modules/legal-core/eli";

export const dynamic = "force-dynamic";

// GET /eli/sa/{slug}/art/{n} — محلّل المعرّف التشريعي الثابت → يحوّل لصفحة المادة.
export async function GET(request: NextRequest, { params }: { params: { slug: string[] } }) {
  const parsed = parseArticleEli(params.slug ?? []);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "صيغة معرّف ELI غير صحيحة. المتوقّع: /eli/sa/{النظام}/art/{رقم}" }, { status: 400 });
  }

  // نحصر بالمواد ذات الرقم نفسه ثم نطابق slug النظام الكنسي.
  // نُفضّل eliSlug المُجمّد (ثابت)، ونسقط لاشتقاقه من lawName للتوافق الخلفي.
  const candidates = await prisma.legalArticle
    .findMany({
      where: { articleNumber: parsed.articleNumber },
      select: { id: true, lawName: true, legalSystem: { select: { eliSlug: true } } }
    })
    .catch(() => [] as Array<{ id: string; lawName: string; legalSystem: { eliSlug: string | null } | null }>);

  // تطبيع slug الوارد (ة→ه، الهمزات→ا، ى→ي) قبل المطابقة — فالمعرّف يعمل بالإملاء الصحيح أيضًا.
  const wanted = lawSlug(parsed.slug);
  const match = candidates.find((a) => resolveSystemSlug(a.legalSystem?.eliSlug, a.lawName) === wanted);
  if (!match) {
    return NextResponse.json({ ok: false, error: "لا توجد مادة مطابقة لهذا المعرّف." }, { status: 404 });
  }

  return NextResponse.redirect(new URL(`/dashboard/legal-core/articles/${match.id}`, request.url));
}
