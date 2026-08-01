// HKM-VOICE-NOTE-SA-007 §14 — GET /api/voice/providers/health (id + available + reason فقط).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { collectProviderHealth } from "@/lib/modules/voice/provider-health";
import { isVoiceTranscriptionV2Enabled, VOICE_PROVIDER, VOICE_PROVIDER_FALLBACK } from "@/lib/modules/config/voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "يلزم تسجيل الدخول." }, { status: 401 });
  const providers = await collectProviderHealth();
  return NextResponse.json({
    ok: true,
    enabled: isVoiceTranscriptionV2Enabled(),
    preferred: VOICE_PROVIDER,
    fallback: VOICE_PROVIDER_FALLBACK,
    providers, // [{ id, available, reason }] — لا مفاتيح ولا endpoints
  });
}
