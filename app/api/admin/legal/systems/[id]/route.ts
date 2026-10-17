import type { NextRequest } from "next/server";
import { deskJson, editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";
import { decodePathParam } from "@/lib/modules/editorial/http-guard";
import { getSystemSummary } from "@/lib/modules/editorial/read";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/systems/[id] — اسم النظام ومجاله لنموذج التحرير (لمن يقترح).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditorialApi(request, "propose");
  if (gate.response) return gate.response;
  try {
    const id = decodePathParam(params.id, "معرّف النظام").trim();
    if (!id || id.length > 100) return deskJson({ code: "INVALID_INPUT", message: "معرّف النظام غير صالح." }, 400);
    const system = await getSystemSummary(editorialDb(), id);
    if (!system) return deskJson({ code: "NOT_FOUND", message: "النظام غير موجود." }, 404);
    return deskJson(system);
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
