import type { NextRequest } from "next/server";
import { z } from "zod";
import { decidePrinciple } from "@/lib/modules/editorial/intake";
import { deskJson, editorialDb, editorialErrorResponse, readDeskJson, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

const body = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().max(2000).optional() });

// POST /api/admin/legal/intake/principles/[id]/decide
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditorialApi(request, "review");
  if (gate.response) return gate.response;
  try {
    const parsed = body.safeParse(await readDeskJson(request));
    if (!parsed.success) return deskJson({ code: "INVALID_INPUT", message: "القرار غير صالح." }, 400);
    return deskJson(await decidePrinciple(editorialDb(), gate.actor, params.id, parsed.data));
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
