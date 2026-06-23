import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { fetchTurathRaw } from "@/lib/modules/turath/turath-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// تشخيص مؤقّت: رابط نظيف بلا بارامترات يُظهر شكل استجابة تراث الخام.
// الاستخدام: افتح /api/turath/debug  (يبحث عن «الشركة» افتراضياً).
// يُزال بعد ضبط المحوّل.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "الشركة").trim();
  const raw = await fetchTurathRaw(q);
  return NextResponse.json(
    { marker: "TURATH_RAW_DEBUG", q, raw },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
