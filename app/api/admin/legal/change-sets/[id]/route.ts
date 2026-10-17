import { NextRequest, NextResponse } from "next/server";
import { getChangeSet } from "@/lib/modules/editorial/service";
import { editorialDb, editorialErrorResponse, requireEditorialApi } from "@/lib/modules/editorial/guard";

export const dynamic = "force-dynamic";

// GET /api/admin/legal/change-sets/[id] — الدفعة وتغييراتها.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditorialApi(request, "view");
  if (gate.response) return gate.response;
  try {
    const found = await getChangeSet(editorialDb(), params.id);
    if (!found) return NextResponse.json({ code: "NOT_FOUND", message: "الدفعة غير موجودة." }, { status: 404 });
    return NextResponse.json(found);
  } catch (error) {
    return editorialErrorResponse(error);
  }
}
