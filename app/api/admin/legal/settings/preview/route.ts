import type { NextRequest } from "next/server";
import { z } from "zod";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { previewEditorialSettings } from "@/lib/modules/editorial/settings";

export const dynamic = "force-dynamic";

const body = z.object({ config: z.unknown() });

// POST /api/admin/legal/settings/preview — أثر الإعدادات المقترحة على القائم قبل الحفظ، بلا كتابة (للمالك وحده).
// → { approvalsDropped, pendingRaised }
export async function POST(request: NextRequest) {
  const gate = await requireEditorialApi(request, "settings");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "مدخلات المعاينة غير صالحة." }, 400);
    return deskJson(await previewEditorialSettings(editorialDb(), gate.actor, parsed.data.config));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
