import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMoyasarLive } from "@/lib/modules/billing/moyasar";
import {
  ensureConversationSessionSchema,
  isConversationSessionSchemaReady,
} from "@/lib/modules/conversations/ensure-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — فحص صحة المنصة للمراقبة الخارجية (بلا أسرار).
 * عام عمدًا — لا يعيد مفاتيح ولا بيانات مستخدمين.
 * يضمن مخطط محرك الجلسات (idempotent) ثم يبلّغ جاهزيته.
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
  if (database === "up") {
    try {
      const applied = await ensureConversationSessionSchema();
      const ready = applied && (await isConversationSessionSchemaReady());
      conversationSession = ready ? "ready" : "error";
    } catch {
      conversationSession = "error";
    }
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
        conversationSession,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
