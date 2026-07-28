import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { resolveAiConfig } from "@/lib/modules/ai/ai-config";

export const dynamic = "force-dynamic";

// حالة المزوّد للقاضي التفاعليّ (دون كشف المفتاح): هل القاضي يعمل بذكاء Claude «server»
// أم يسقط للوضع الحتميّ «offline»؟ القيد: Claude حصريًّا (أيّ مزوّدٍ آخر ⇒ غير نشط).
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;

  const cfg = await resolveAiConfig();
  const active = cfg.provider === "anthropic" && Boolean(cfg.apiKey);
  return NextResponse.json({
    active,
    mode: active ? "server" : "offline",
    provider: cfg.provider,
    // اسمٌ للعرض فقط — لا يُكشف المفتاح إطلاقًا.
    model: active ? cfg.model || process.env.ANTHROPIC_MODEL || "claude" : null,
    claudeOnly: true,
    // إن ضُبط مزوّدٌ غير Claude، فالقاضي حتميّ حتى يُضبط Anthropic.
    nonClaudeConfigured: cfg.provider !== "anthropic" && cfg.provider !== "offline" && Boolean(cfg.apiKey)
  });
}
