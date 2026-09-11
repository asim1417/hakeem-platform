import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runDueDiligence } from "@/lib/modules/due-diligence/core";
import { buildDemoConnectors } from "@/lib/modules/due-diligence/demo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const entitySchema = z
  .object({
    name: z.string().trim().min(2).max(240),
    unifiedNumber: z.string().trim().min(4).max(32).optional(),
    commercialRegistration: z.string().trim().min(4).max(32).optional(),
    city: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

/**
 * Public demo endpoint. It NEVER calls live sources and NEVER returns real entity data.
 * Every record is generated from synthetic fixtures in buildDemoConnectors().
 */
export async function POST(request: NextRequest) {
  let entity: z.infer<typeof entitySchema>;
  try {
    entity = entitySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        message: "بيانات الكيان التجريبية غير صالحة.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 }
    );
  }

  const report = await runDueDiligence(entity, buildDemoConnectors(entity));
  return NextResponse.json({
    mode: "DEMO",
    demo: true,
    demoNotice:
      "هذه تجربة صناعية بالكامل. لا تمثل النتائج أي شركة أو سجل أو علامة أو إجراء إفلاس حقيقي.",
    report,
  });
}
