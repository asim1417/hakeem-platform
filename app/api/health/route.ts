import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMoyasarLive } from "@/lib/modules/billing/moyasar";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — فحص صحة المنصة للمراقبة الخارجية (بلا أسرار).
 * عام عمدًا — لا يعيد مفاتيح ولا بيانات مستخدمين.
 */
export async function GET() {
  const started = Date.now();
  let database: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  const ok = database === "up";
  return NextResponse.json(
    {
      ok,
      service: "hakeem-platform",
      time: new Date().toISOString(),
      latencyMs: Date.now() - started,
      checks: {
        database,
        clerk: isClerkConfigured() ? "configured" : "missing",
        googleOAuth: isGoogleOAuthConfigured() ? "configured" : "missing",
        moyasar: isMoyasarLive() ? "configured" : "missing",
      },
    },
    { status: ok ? 200 : 503 }
  );
}
