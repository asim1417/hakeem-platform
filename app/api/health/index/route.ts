import { NextResponse } from "next/server";
import { buildHealthIndex } from "@/lib/modules/observability/health-index";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/index — مؤشّر الصحّة متعدّد الأبعاد (§13/§23).
 * منفصل عن /api/health القائم (لا يمسّه). عام عمدًا — بلا أسرار ولا بيانات مستخدمين.
 */
export async function GET() {
  try {
    const index = await buildHealthIndex(new Date().toISOString());
    return NextResponse.json(index, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "health-index-unavailable", detail: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      { status: 503 }
    );
  }
}
