import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { auditEvent } from "@/lib/modules/audit/audit";
import { adjustUsageCredits } from "@/lib/modules/credits/usage-ledger";

export const dynamic = "force-dynamic";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle"), enabled: z.boolean() }),
  z.object({
    action: z.literal("price"),
    serviceCode: z.string().min(2).max(64),
    milliUnits: z.number().int().nonnegative(),
    unitSize: z.number().int().positive(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("package"),
    code: z.string().min(2).max(64),
    name: z.string().min(2).max(120),
    unitsMilli: z.number().int().positive(),
    priceHalalas: z.number().int().nonnegative(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("adjust"),
    userId: z.string().min(1),
    milliUnits: z.number().int().refine((value) => value !== 0),
    reason: z.string().min(5).max(500),
    idempotencyKey: z.string().min(8).max(200),
  }),
]);

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  try {
    const { prisma } = await import("@/lib/prisma");
    const [toggle, prices, packages, accounts] = await Promise.all([
      prisma.$queryRawUnsafe<{ enabled: boolean }[]>(
        `SELECT enabled FROM "feature_toggles" WHERE key = 'usage_credits_v2' LIMIT 1`
      ),
      prisma.$queryRawUnsafe<
        { serviceCode: string; name: string; milliUnits: bigint; unitSize: number; active: boolean }[]
      >(
        `SELECT "serviceCode", name, "milliUnits", "unitSize", active
           FROM "usage_service_prices" ORDER BY "serviceCode"`
      ),
      prisma.$queryRawUnsafe<
        { code: string; name: string; unitsMilli: bigint; priceHalalas: number; active: boolean }[]
      >(
        `SELECT code, name, "unitsMilli", "priceHalalas", active
           FROM "usage_credit_packages" ORDER BY "sortOrder", code`
      ),
      prisma.$queryRawUnsafe<
        {
          userId: string;
          name: string;
          email: string;
          balanceMilliUnits: bigint;
          reservedMilliUnits: bigint;
        }[]
      >(
        `SELECT a."userId", u.name, u.email, a."balanceMilliUnits", a."reservedMilliUnits"
           FROM "usage_credit_accounts" a JOIN "users" u ON u.id = a."userId"
          ORDER BY a."updatedAt" DESC LIMIT 100`
      ),
    ]);
    return NextResponse.json({
      enabled: toggle[0]?.enabled ?? false,
      prices: prices.map((row) => ({ ...row, milliUnits: Number(row.milliUnits) })),
      packages: packages.map((row) => ({ ...row, unitsMilli: Number(row.unitsMilli) })),
      accounts: accounts.map((row) => ({
        ...row,
        balanceMilliUnits: Number(row.balanceMilliUnits),
        reservedMilliUnits: Number(row.reservedMilliUnits),
      })),
    });
  } catch {
    return NextResponse.json({ enabled: false, prices: [], packages: [], accounts: [], unknown: true });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const body = mutation.parse(await request.json());
  const { prisma } = await import("@/lib/prisma");

  if (body.action === "toggle") {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "feature_toggles" (id,key,enabled,"createdAt")
       VALUES ('usage-credits-v2','usage_credits_v2',$1,NOW())
       ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled`,
      body.enabled
    );
  } else if (body.action === "price") {
    await prisma.$executeRawUnsafe(
      `UPDATE "usage_service_prices"
          SET "milliUnits" = $2, "unitSize" = $3, active = $4, "updatedAt" = NOW()
        WHERE "serviceCode" = $1`,
      body.serviceCode,
      body.milliUnits,
      body.unitSize,
      body.active
    );
  } else if (body.action === "package") {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "usage_credit_packages"
        (code,name,"unitsMilli","priceHalalas",active)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO UPDATE SET
         name=EXCLUDED.name, "unitsMilli"=EXCLUDED."unitsMilli",
         "priceHalalas"=EXCLUDED."priceHalalas", active=EXCLUDED.active, "updatedAt"=NOW()`,
      body.code,
      body.name,
      body.unitsMilli,
      body.priceHalalas,
      body.active
    );
  } else {
    await adjustUsageCredits({
      userId: body.userId,
      amountMilliUnits: body.milliUnits,
      actorId: gate.user.id,
      reason: body.reason,
      idempotencyKey: `admin:${body.idempotencyKey}`,
    });
  }

  await auditEvent({
    actorId: gate.user.id,
    subject: "ADMIN",
    action: `USAGE_CREDITS_${body.action.toUpperCase()}`,
    entityId: body.action === "adjust" ? body.userId : undefined,
    metadata: body,
  });
  return NextResponse.json({ ok: true });
}
