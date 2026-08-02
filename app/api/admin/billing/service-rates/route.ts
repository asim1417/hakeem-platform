import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";
import { pointsToMilli, milliToPoints } from "@/lib/modules/credits/points";

export const dynamic = "force-dynamic";

/** GET /api/admin/billing/service-rates — قائمة أسعار الخدمات (بالنقاط). */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRawUnsafe<
    { serviceCode: string; name: string; milliUnits: bigint | number; pricingModel: string; active: boolean; version: number | null; displayNameAr: string | null }[]
  >(
    `SELECT "serviceCode","name","milliUnits","pricingModel",active,"version","displayNameAr"
       FROM "usage_service_prices" ORDER BY "serviceCode"`
  ).catch(() => []);
  return NextResponse.json({
    rates: rows.map((r) => ({
      serviceCode: r.serviceCode,
      name: r.displayNameAr || r.name,
      points: milliToPoints(Number(r.milliUnits)),
      pricingModel: r.pricingModel,
      active: r.active,
      version: Number(r.version ?? 1),
    })),
  });
}

/**
 * POST /api/admin/billing/service-rates — تعديل سعر خدمة (بالنقاط).
 * يرفع الإصدار؛ لا يؤثر رجعيًا على السجلات (تحفظ إصدارها). سبب إلزامي.
 */
export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const body = (await request.json().catch(() => ({}))) as {
    serviceCode?: string;
    points?: number;
    reason?: string;
    active?: boolean;
  };
  if (!body.serviceCode || typeof body.points !== "number" || body.points < 0) {
    return NextResponse.json({ message: "serviceCode ونقاط صحيحة مطلوبة." }, { status: 400 });
  }
  if (!body.reason) return NextResponse.json({ message: "السبب إلزامي." }, { status: 400 });

  const { prisma } = await import("@/lib/prisma");
  const milli = Number(pointsToMilli(body.points));
  const before = await prisma.$queryRawUnsafe<{ milliUnits: bigint | number; version: number | null }[]>(
    `SELECT "milliUnits","version" FROM "usage_service_prices" WHERE "serviceCode" = $1 LIMIT 1`,
    body.serviceCode
  ).catch(() => []);
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "usage_service_prices"
        SET "milliUnits" = $2,
            "version" = COALESCE("version",1) + 1,
            "active" = COALESCE($3, "active"),
            "effectiveFrom" = NOW(),
            "updatedAt" = NOW()
      WHERE "serviceCode" = $1`,
    body.serviceCode,
    milli,
    typeof body.active === "boolean" ? body.active : null
  ).catch(() => 0);
  if (!affected) return NextResponse.json({ message: "الخدمة غير موجودة." }, { status: 404 });

  await recordBillingAudit({
    action: "SERVICE_RATE_UPDATED",
    actorUserId: gate.user.id,
    targetType: "service_rate",
    targetId: body.serviceCode,
    reason: body.reason,
    before: { points: before[0] ? milliToPoints(Number(before[0].milliUnits)) : null },
    after: { points: body.points },
  });
  return NextResponse.json({ ok: true, serviceCode: body.serviceCode, points: body.points });
}
