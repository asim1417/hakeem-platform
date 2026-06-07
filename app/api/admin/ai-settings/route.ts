/**
 * /api/admin/ai-settings — إدارة إعداد الذكاء المركزي (للمدير فقط).
 *  GET  : حالة الإعداد (دون كشف المفتاح)
 *  POST : حفظ الإعداد (المفتاح يُشفّر) + اختبار اختياري
 * المفتاح لا يُعاد للعميل أبداً.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { getAiStatus, saveAiSettings, resolveAiConfig, type AiProvider } from "@/lib/modules/ai/ai-config";
import { createOriginalHakeemAiResponse } from "@/lib/modules/ai/ai-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "custom", "offline"]),
  model: z.string().max(120).optional(),
  baseUrl: z.string().max(300).optional(),
  apiKey: z.string().max(400).optional(),
  test: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("USERS_MANAGE", request);
  if (auth.response) return auth.response;
  const status = await getAiStatus();
  return NextResponse.json({ ok: true, status });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("USERS_MANAGE", request);
  if (auth.response) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "طلب غير صالح." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "بيانات غير صالحة." }, { status: 400 });
  }

  const { test, ...settings } = parsed.data;
  const saved = await saveAiSettings(settings as { provider: AiProvider; model?: string; baseUrl?: string; apiKey?: string });
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message ?? "تعذّر الحفظ." }, { status: 500 });
  }

  let testResult: { ok: boolean; message: string } | undefined;
  if (test) {
    const cfg = await resolveAiConfig();
    if (cfg.provider === "offline" || !cfg.apiKey) {
      testResult = { ok: false, message: "لا مفتاح فعّال للاختبار." };
    } else {
      const res = await createOriginalHakeemAiResponse({
        prompt: "اختبار اتصال مزوّد الذكاء: أجب بكلمة «جاهز» فقط.",
        module: "ai-settings-test",
        actorId: auth.user?.id ?? undefined
      }).catch(() => null);
      testResult = res?.ok && res.mode === "server"
        ? { ok: true, message: "نجح الاتصال بالمزوّد." }
        : { ok: false, message: res?.warnings?.slice(-1)[0] ?? "تعذّر الاتصال بالمزوّد." };
    }
  }

  const status = await getAiStatus();
  return NextResponse.json({ ok: true, status, test: testResult });
}
