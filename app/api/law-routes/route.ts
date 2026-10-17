import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { resolveSystemSlug } from "@/lib/modules/legal-core/eli";
import { encodeRanges, type LawRouteRow } from "@/lib/modules/legal-core/law-route-gate";

export const dynamic = "force-dynamic";

// GET /api/law-routes — جدول حسم خفيف لبوابة /law في الوسيط (HKM-023-B، م١): المعرّف الداخلي، والكنسي، ونطاقات
// أرقام المواد. عام وقراءة فقط، ولا يحمل نصًا: أسماء الأنظمة ومعرّفاتها معروضة أصلًا في /legal وsitemap.
export async function GET() {
  const db = prismaSqlClient(prisma);
  const systems = await db.query<{ id: string; name: string; eli_slug: string | null; nums: number[] | null }>(
    `SELECT s.id, s.name, s.eli_slug,
            (SELECT array_agg(DISTINCT a."articleNumber") FROM legal_articles a
              WHERE (a."legalSystemId" = s.id OR (a."legalSystemId" IS NULL AND a."lawName" = s.name)) AND a."articleNumber" > 0) AS nums
       FROM legal_systems s`,
  );
  const rows: LawRouteRow[] = systems.map((s) => [s.id, resolveSystemSlug(s.eli_slug, s.name), encodeRanges((s.nums ?? []).map(Number))]);
  return NextResponse.json({ v: 1, rows }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
