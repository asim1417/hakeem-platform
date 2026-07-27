import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";
import { resolveSpecializedAgent } from "@/lib/modules/simulations/specialized-agents";
import { EVIDENCE_HINTS } from "@/lib/modules/simulations/judicial-brain";
import { buildLegalContextForAI } from "@/lib/modules/legal-core/legal-retrieval";

export const dynamic = "force-dynamic";

// لوحة الأساس النظاميّ (منقولة من القاعة الكلاسيكيّة): تُرجع مواد النواة الحقيقيّة ذات الصلة
// بالقضية — مؤرَّضةً ضمن نطاق التخصّص والأنظمة الإجرائيّة — لعرضها بروابط قابلة للتتبّع.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const session = await findOwnedSimulation(user, params.id, {
    messages: { orderBy: { createdAt: "asc" } }
  });
  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  const claim = extractClaim(session.messages);
  const plaintiff = session.messages.find((m) => m.role === "المدعي" || m.role === "وكيل المدعي")?.content;
  const defendant = session.messages.find((m) => m.role === "المدعى عليه" || m.role === "وكيل المدعى عليه")?.content;
  const agent = resolveSpecializedAgent(claim?.caseType);
  const scopeHint = agent.scopeSystems.length ? ` (ضمن الأنظمة: ${agent.scopeSystems.join("، ")})` : "";
  const query = [claim?.subject, claim?.facts, claim?.requests, claim?.legalGrounds, plaintiff, defendant, scopeHint, EVIDENCE_HINTS]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);

  if (!query.trim()) {
    return NextResponse.json({ articles: [], activatedScope: agent.scopeSystems });
  }

  const ctx = await buildLegalContextForAI(query, { limit: 8 });
  const articles = ctx.hasArticles
    ? ctx.articles.map((a) => ({
        articleNumber: a.articleNumber,
        systemName: a.systemName,
        citationLabel: a.citationLabel,
        internalUrl: a.internalUrl,
        snippet: a.snippet || a.articleText.slice(0, 220)
      }))
    : [];

  return NextResponse.json({ articles, activatedScope: agent.scopeSystems });
}
