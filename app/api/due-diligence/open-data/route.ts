import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { fetchBaladyOpenDataCatalog } from "@/lib/modules/due-diligence/balady-open-data";
import { extendedGovernmentOpenDataRegistry } from "@/lib/modules/due-diligence/government-open-data-extended";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const registry = extendedGovernmentOpenDataRegistry();
  const source = request.nextUrl.searchParams.get("source");
  if (!source) {
    return NextResponse.json({
      registry,
      summary: {
        total: registry.length,
        entity: registry.filter((item) => item.scope === "ENTITY").length,
        context: registry.filter((item) => item.scope === "CONTEXT").length,
        catalog: registry.filter((item) => item.scope === "CATALOG").length,
        live: registry.filter((item) => item.integration === "LIVE").length,
        adapter: registry.filter((item) => item.integration === "ADAPTER").length,
        discovery: registry.filter((item) => item.integration === "DISCOVERY").length,
        degraded: registry.filter((item) => item.integration === "DEGRADED").length,
      },
    });
  }

  if (source !== "balady_open_data_api") {
    return NextResponse.json(
      { message: "المصدر المطلوب غير متاح للجلب المباشر عبر Open Data Hub حاليًا." },
      { status: 400 }
    );
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const catalog = await fetchBaladyOpenDataCatalog({ limit, signal: controller.signal });
    return NextResponse.json(catalog);
  } catch (error) {
    return NextResponse.json(
      {
        message: "تعذر جلب بيانات المصدر الحكومي المفتوح في هذه الجولة.",
        source,
        detail: error instanceof Error ? error.message : "فشل غير معروف",
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
