import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import {
  ENTITY_TYPES,
  RELATION_TYPES,
  createRelation,
  hydrateRelations,
  listRelations,
} from "@/lib/modules/knowledge-graph/relations";

export const dynamic = "force-dynamic";

// GET — سرد العلاقات (مع إثراء الكيانات). صلاحية القراءة.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const params = request.nextUrl.searchParams;
  const relationParam = params.get("relation");
  const relation = RELATION_TYPES.includes(relationParam as never) ? (relationParam as never) : undefined;
  const limit = Math.min(Number(params.get("limit")) || 50, 200);

  const relations = await listRelations({ relation, limit });
  const hydrated = await hydrateRelations(relations);
  return NextResponse.json({ ok: true, count: hydrated.length, relations: hydrated });
}

const createSchema = z.object({
  sourceType: z.enum(ENTITY_TYPES),
  sourceId: z.string().trim().min(1).max(64),
  targetType: z.enum(ENTITY_TYPES),
  targetId: z.string().trim().min(1).max(64),
  relation: z.enum(RELATION_TYPES as [string, ...string[]]),
  strength: z.number().min(0).max(1).optional(),
  description: z.string().max(2000).optional(),
});

// POST — إنشاء علاقة. صلاحية التحرير.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_EDIT", request);
  if (gate.response) return gate.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "بيانات العلاقة غير صحيحة." }, { status: 400 });
  }

  const created = await createRelation(parsed.data as never);
  return NextResponse.json({ ok: true, relation: created }, { status: 201 });
}
