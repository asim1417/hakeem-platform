import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOriginalHakeemAiResponse, callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.string().optional(),
  content: z.string().optional()
});

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "custom", "offline"]).optional(),
  model: z.string().trim().max(120).optional(),
  messages: z.array(messageSchema).optional(),
  prompt: z.string().trim().max(20000).optional(),
  module: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  // وضع التمرير الأمين: يستخدمه القاضي التفاعلي بنصوصه الخاصة عبر المفتاح المركزي
  raw: z.boolean().optional(),
  systemPrompt: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("SIMULATIONS_USE", request);
  if (auth.response) return auth.response;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "بيانات طلب الذكاء الاصطناعي غير صحيحة."
      },
      { status: 400 }
    );
  }

  // وضع التمرير الأمين للقاضي التفاعلي: نصوصه الخاصة + المفتاح المركزي
  if (parsed.data.raw) {
    const raw = await callCentralProvider({
      systemPrompt: parsed.data.systemPrompt,
      userPrompt: parsed.data.prompt ?? "",
      maxTokens: parsed.data.maxTokens
    });
    if (!raw.ok) {
      return NextResponse.json(
        { ok: false, mode: raw.mode, provider: raw.provider, error: raw.mode === "offline" ? "لا مزوّد ذكاء مركزي مفعّل." : "تعذّر الاتصال بالمزوّد المركزي." },
        { status: raw.mode === "offline" ? 409 : 502 }
      );
    }
    return NextResponse.json({ ok: true, mode: raw.mode, provider: raw.provider, content: raw.content });
  }

  const result = await createOriginalHakeemAiResponse({
    ...parsed.data,
    module: "original-hakeem",
    actorId: auth.user?.id
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.warnings[result.warnings.length - 1] || "تعذر تنفيذ طلب الذكاء الاصطناعي.",
        provider: result.provider,
        model: result.model,
        warnings: result.warnings,
        mode: result.mode,
        requestId: result.requestId
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    model: result.model,
    content: result.content,
    warnings: result.warnings,
    mode: result.mode,
    requestId: result.requestId
  });
}
