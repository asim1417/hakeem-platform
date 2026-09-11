import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runDueDiligence } from "@/lib/modules/due-diligence/core";
import { buildDemoConnectors } from "@/lib/modules/due-diligence/demo";
import { consumeDirectUrlRateLimit } from "@/lib/modules/documents/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const DEMO_REQUESTS_PER_MINUTE = 20;

const entitySchema = z
  .object({
    name: z.string().trim().min(2).max(240),
    unifiedNumber: z.string().trim().min(4).max(32).optional(),
    commercialRegistration: z.string().trim().min(4).max(32).optional(),
    city: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

function clientRateKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return (ip || "anonymous").slice(0, 64);
}

/**
 * Public demo endpoint. It NEVER calls live sources and NEVER returns real entity data.
 * Every record is generated from synthetic fixtures in buildDemoConnectors().
 */
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { message: "حجم الطلب التجريبي أكبر من الحد المسموح." },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rate = consumeDirectUrlRateLimit(
    `due-diligence-demo:${clientRateKey(request)}`,
    DEMO_REQUESTS_PER_MINUTE,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "تجاوزت حد التجربة المؤقت. حاول بعد قليل." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let entity: z.infer<typeof entitySchema>;
  try {
    entity = entitySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        message: "بيانات الكيان التجريبية غير صالحة.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const report = await runDueDiligence(entity, buildDemoConnectors(entity));
  return NextResponse.json(
    {
      mode: "DEMO",
      demo: true,
      demoNotice:
        "هذه تجربة صناعية بالكامل. لا تمثل النتائج أي شركة أو سجل أو علامة أو إجراء إفلاس حقيقي.",
      report,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
