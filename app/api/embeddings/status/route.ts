import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getEmbeddingStatus } from "@/lib/modules/knowledge-graph/embeddings";

export const dynamic = "force-dynamic";

// GET — حالة متجهات الدلالة (pgvector): العدد والتغطية مقابل المكتبة.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  try {
    const status = await getEmbeddingStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch {
    // إن لم يُنشأ جدول embeddings بعد على القاعدة، لا نُعطّل المسار.
    return NextResponse.json({ ok: true, totalEmbeddings: 0, byOwnerType: {}, corpus: null, note: "جدول embeddings غير مُفعّل بعد على القاعدة." });
  }
}
