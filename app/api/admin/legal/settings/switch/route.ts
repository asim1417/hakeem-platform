import type { NextRequest } from "next/server";
import { z } from "zod";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { setDeskWriteSwitch } from "@/lib/modules/editorial/settings";

export const dynamic = "force-dynamic";

const body = z.object({
  baseVersion: z.number().int().min(0),
  reason: z.string().max(2000),
  writeEnabled: z.boolean(),
  requireMfa: z.boolean().optional(),
});

// POST /api/admin/legal/settings/switch — تشغيل الكتابة أو إيقافها، وشرط التحقق الثنائي (للمالك وحده، بسبب مكتوب).
export async function POST(request: NextRequest) {
  const gate = await requireEditorialApi(request, "settings");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "مدخلات المفتاح غير صالحة." }, 400);
    return deskJson(await setDeskWriteSwitch(editorialDb(), gate.actor, parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
