import { NextRequest, NextResponse } from "next/server";
import { searchLegalArticles } from "@/lib/modules/library/library-service";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const articles = await searchLegalArticles(query, 20);

  await auditEvent({
    subject: "LIBRARY",
    action: "SEARCH",
    metadata: { query, results: articles.length }
  });

  return NextResponse.json({
    articles,
    message: articles.length === 0 ? "لا توجد مادة نظامية مطابقة في قاعدة البيانات الحالية." : undefined
  });
}
