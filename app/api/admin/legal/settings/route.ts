import type { NextRequest } from "next/server";
import { z } from "zod";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { readEditorialSettings, saveEditorialSettings } from "@/lib/modules/editorial/settings";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/settings — آخر نسخة من إعدادات المكتب والمستخدمون للتكليف (للمالك وحده).
export async function GET(request: NextRequest) {
  const gate = await requireEditorialApi(request, "settings");
  if (gate.response) return gate.response;
  try {
    return deskJson(await readEditorialSettings(editorialDb(), gate.actor));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}

// المحتوى يتحقق منه parseEditorialConfig في الخدمة (رسائل عربية بالمسار)؛ هنا الشكل العام وحده.
const body = z.object({
  baseVersion: z.number().int().min(0),
  reason: z.string().max(2000),
  config: z.unknown(),
});

// PUT /api/admin/legal/settings — نسخة جديدة بسبب إلزامي؛ تعارض النسخة 409 (للمالك وحده).
export async function PUT(request: NextRequest) {
  const gate = await requireEditorialApi(request, "settings");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "مدخلات الإعدادات غير صالحة." }, 400);
    const { baseVersion, reason, config } = parsed.data;
    return deskJson(await saveEditorialSettings(editorialDb(), gate.actor, { baseVersion, reason, config }));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
