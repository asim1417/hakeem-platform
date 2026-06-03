import { NextRequest, NextResponse } from "next/server";
import { searchLegalArticles } from "@/lib/modules/library/library-service";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const lawName = request.nextUrl.searchParams.get("lawName") ?? undefined;
  const articles = await searchLegalArticles(query, 50, lawName);

  await auditEvent({
    subject: "LIBRARY",
    action: "SEARCH",
    metadata: { query, lawName, results: articles.length }
  });

  return NextResponse.json({
    articles,
    message: articles.length === 0 ? "لا توجد مادة نظامية مطابقة في قاعدة البيانات الحالية." : undefined
  });
}
