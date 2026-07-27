import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOriginalHakeemAiResponse, callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { buildLegalContextForAI } from "@/lib/modules/legal-core/legal-retrieval";
import { collectAllowedArticleNumbers, verifyNarrativeGrounding } from "@/lib/modules/grounding/verify-guard";

export const dynamic = "force-dynamic";

// تأريض القاضي التفاعليّ الحيّ: عند نداءٍ قضائيٍّ ذي وقائع، يسترجع الخادم مواد النواة
// الحقيقيّة (مع إبراز نظام الإثبات) ويحقنها في التوجيه، ثمّ يحرس المخرَج من أرقام المواد
// المختلَقة — دون تعديل واجهة الـ iframe. شفّافٌ وآمن: يسقط بلا تأصيل عند فشل الاسترجاع.
const JUDGE_EVIDENCE_HINTS =
  "قواعد الإثبات وعبء الإثبات والبيّنة والشهادة واليمين والقرينة وحجيّة المستند والإقرار في نظام الإثبات";
const GROUND_SIGNAL =
  /الوقائع|الطلب|الدعوى|الدفع|المدّع|المدع|الجواب|البيّن|البين|الإثبات|إثبات|الحكم|المرافعة/;

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

  // وضع التمرير الأمين للقاضي التفاعلي: نصوصه الخاصة + المفتاح المركزي (مع تأريضٍ شفّاف)
  if (parsed.data.raw) {
    const userPrompt = parsed.data.prompt ?? "";
    let systemPrompt = parsed.data.systemPrompt ?? "";

    // تأريض النداءات القضائيّة ذات الوقائع فقط (يستثني نداءات الاختبار القصيرة).
    let allowedNumbers = new Set<number>();
    const shouldGround = userPrompt.length > 120 && GROUND_SIGNAL.test(userPrompt);
    if (shouldGround) {
      try {
        const ctx = await buildLegalContextForAI(`${userPrompt} ${JUDGE_EVIDENCE_HINTS}`.slice(0, 900), { limit: 6 });
        if (ctx.hasArticles) {
          allowedNumbers = collectAllowedArticleNumbers({ numbers: ctx.articles.map((a) => a.articleNumber) });
          systemPrompt = `${systemPrompt}\n\n${ctx.contextText}`;
        }
      } catch {
        // فشل الاسترجاع لا يكسر القاضي — يبقى بلا تأصيل هذه المرّة.
      }
    }

    const raw = await callCentralProvider({
      systemPrompt,
      userPrompt,
      maxTokens: parsed.data.maxTokens
    });
    if (!raw.ok) {
      return NextResponse.json(
        { ok: false, mode: raw.mode, provider: raw.provider, error: raw.mode === "offline" ? "لا مزوّد ذكاء مركزي مفعّل." : "تعذّر الاتصال بالمزوّد المركزي." },
        { status: raw.mode === "offline" ? 409 : 502 }
      );
    }

    // حارس التأريض: أرقام مواد في مخرَج القاضي ليست ضمن المسترجَع ⇒ تنبيه شفافيّة (لا حذف مدمّر).
    const grounded = allowedNumbers.size > 0;
    const groundingOk = !grounded || verifyNarrativeGrounding([raw.content], allowedNumbers).ok;
    const content = groundingOk
      ? raw.content
      : `${raw.content}\n\n— ملاحظة: بعض الإشارات النظاميّة في هذا النصّ غير مؤكَّدة من النواة، ويُتحقّق منها قبل الاعتماد.`;

    return NextResponse.json({ ok: true, mode: raw.mode, provider: raw.provider, content, grounded, groundingOk });
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
