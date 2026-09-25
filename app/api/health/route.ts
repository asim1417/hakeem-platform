import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { getAuthProductionStatus } from "@/lib/modules/auth/production-auth";
import { isMoyasarLive } from "@/lib/modules/billing/moyasar";
import { isConversationSessionSchemaReady } from "@/lib/modules/conversations/ensure-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — فحص صحة المنصة للمراقبة الخارجية (بلا أسرار).
 * عام عمدًا — لا يعيد مفاتيح ولا بيانات مستخدمين.
 * RUN-001: يقرأ جاهزية المخطط فقط، ولا ينفّذ أي DDL/تجهيز (استخدم npm run db:ensure-schema).
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

  let conversationSession: "ready" | "pending" | "error" = "pending";
  let conversationSessionDetail: { step?: number; error?: string } | undefined;
  if (database === "up") {
    try {
      // قراءة فقط: هل المخطط جاهز؟ التجهيز يتم عبر أمر إداري لا عبر فحص الصحة.
      const ready = await isConversationSessionSchemaReady();
      conversationSession = ready ? "ready" : "error";
      if (!ready) {
        conversationSessionDetail = { error: "schema not ready — run: npm run db:ensure-schema -- --apply" };
      }
    } catch (e) {
      conversationSession = "error";
      conversationSessionDetail = {
        error: e instanceof Error ? e.message.split("\n")[0].slice(0, 220) : "unknown",
      };
    }
  }

  const auth = getAuthProductionStatus();
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
        authProduction: {
          ready: auth.ready,
          googleMode: auth.googleMode,
          clerkInstance: auth.clerkInstance,
          clerkFrontendHost: auth.clerkFrontendHost,
          recommendation: auth.recommendation,
        },
        moyasar: isMoyasarLive() ? "configured" : "missing",
        conversationSession,
        ...(conversationSessionDetail ? { conversationSessionDetail } : {}),
      },
    },
    { status: ok ? 200 : 503 }
  );
}
