import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { legalRag } from "@/lib/modules/legal-rag/legal-rag-service";

export const dynamic = "force-dynamic";

const schema = z.object({ question: z.string().trim().min(3).max(2000) });

// POST /api/legal-rag — إجابة قانونية مُسنَدة (RAG منضبط بالمصادر).
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "أرسل سؤالاً قانونياً (٣ أحرف فأكثر)." }, { status: 400 });
  }

  const result = await legalRag(parsed.data.question);
  return NextResponse.json({
    ok: true,
    answer: result.answer,
    confidence: result.confidence,
    grounded: result.grounded,
    citations: result.citations,
    relatedArticles: result.relatedArticles,
    relatedRulings: result.relatedRulings,
    relatedPrinciples: result.relatedPrinciples,
  });
}
