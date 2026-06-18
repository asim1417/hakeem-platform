import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { createAnnotation, listAnnotations } from "@/lib/modules/knowledge-graph/annotations";

export const dynamic = "force-dynamic";

// GET — تظليلات/ملاحظات المستخدم الحالي.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LIBRARY_READ", request);
  if (gate.response || !gate.user) return gate.response ?? NextResponse.json({ ok: false }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const annotations = await listAnnotations(gate.user.id, {
    documentType: params.get("documentType") ?? undefined,
    documentId: params.get("documentId") ?? undefined,
  });
  return NextResponse.json({ ok: true, count: annotations.length, annotations });
}

const createSchema = z.object({
  caseId: z.string().max(64).optional().nullable(),
  documentType: z.string().trim().min(1).max(32),
  documentId: z.string().trim().min(1).max(64),
  highlightedText: z.string().max(5000).optional().nullable(),
  note: z.string().max(5000).optional().nullable(),
  color: z.string().max(16).optional(),
});

// POST — إنشاء تظليل/ملاحظة للمستخدم الحالي.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LIBRARY_READ", request);
  if (gate.response || !gate.user) return gate.response ?? NextResponse.json({ ok: false }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "بيانات الملاحظة غير صحيحة." }, { status: 400 });
  }

  const created = await createAnnotation(gate.user.id, parsed.data);
  return NextResponse.json({ ok: true, annotation: created }, { status: 201 });
}
