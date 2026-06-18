import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { legalRag } from "@/lib/modules/legal-rag/legal-rag-service";

export const dynamic = "force-dynamic";

// سؤال قانوني: ٣ أحرف فأكثر، حتى ٢٠٠٠ حرف.
const querySchema = z.string().trim().min(3).max(2000);

// GET /api/legal-rag?q=...  — مفيد للاختبار القرائي السريع من المتصفح.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "أرسل سؤالاً قانونياً عبر ?q= (٣ أحرف فأكثر)." }, { status: 400 });
  }

  try {
    const result = await performLegalRagSearch(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Legal RAG GET error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "تعذّر تنفيذ البحث القانوني." }, { status: 500 });
  }
}

// POST /api/legal-rag — يقبل { question } (متوافق مع السابق) أو { q }.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const body = (await request.json().catch(() => null)) as { question?: unknown; q?: unknown } | null;
  const parsed = querySchema.safeParse(body?.question ?? body?.q ?? "");
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "أرسل سؤالاً قانونياً (٣ أحرف فأكثر)." }, { status: 400 });
  }

  try {
    const result = await performLegalRagSearch(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Legal RAG POST error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "تعذّر تنفيذ البحث القانوني." }, { status: 500 });
  }
}

/**
 * دالة البحث المشتركة بين GET و POST — نقطة واحدة تستدعي خطّ RAG المُسنَد
 * وتشكّل الاستجابة. الإجابة مبنية على المصادر المسترجعة من القاعدة فقط.
 */
async function performLegalRagSearch(q: string) {
  const result = await legalRag(q);

  // مصادر موحّدة (مواد + أحكام + مبادئ) للعرض/الاختبار السريع.
  const sources = [
    ...result.legalBasis.map((a) => ({ type: "article" as const, id: a.id, title: a.title, reference: a.reference, weight: a.weight })),
    ...result.relatedRulings.map((r) => ({ type: "ruling" as const, id: r.id, title: r.title, reason: r.reason, weight: r.weight })),
    ...result.relatedPrinciples.map((p) => ({ type: "principle" as const, id: p.id, title: p.title, reason: p.reason, weight: p.weight })),
  ];

  // رسالة توضيحية: عند نقص الإسناد نعيد نصّ الحارس؛ وإلا تنويه «لا نصّ صريح» إن وُجد.
  const message = !result.grounded ? result.answer : result.legalBasisNote ?? undefined;

  return {
    ok: true,
    query: q,
    provider: result.provider,
    providerConfigured: result.providerConfigured,
    model: result.model,
    confidence: result.confidence,
    grounded: result.grounded,
    generated: result.generated,
    answer: result.answer,
    shortAnswer: result.shortAnswer,
    legalAnalysis: result.legalAnalysis,
    limitations: result.limitations,
    legalBasisNote: result.legalBasisNote,
    sources,
    citations: result.citations,
    legalBasis: result.legalBasis,
    relatedRulings: result.relatedRulings,
    relatedPrinciples: result.relatedPrinciples,
    providers: result.providers,
    message,
  };
}
