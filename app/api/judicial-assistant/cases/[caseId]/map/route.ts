import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { saveStructured } from "@/lib/modules/judicial-assistant/store";

export const dynamic = "force-dynamic";

// خريطةٌ يثبّتها القاضي بعد المراجعة. الحقول اختياريّة؛ تُدمَج مع المحفوظ.
const partySchema = z.object({ id: z.string(), name: z.string(), role: z.string(), representative: z.string().optional() });
const requestSchema = z.object({ id: z.string(), text: z.string(), byPartyId: z.string(), status: z.enum(["pending", "granted_sought", "contested"]) });
const factSchema = z.object({
  id: z.string(), text: z.string(),
  status: z.enum(["alleged", "admitted", "denied", "established", "unresolved"]),
  verification: z.enum(["machine", "human_verified", "disputed"]), sourceLabel: z.string(), hasEvidence: z.boolean(),
});
const issueSchema = z.object({ id: z.string(), statement: z.string(), resolved: z.boolean() });

const schema = z.object({
  parties: z.array(partySchema).max(30).optional(),
  requests: z.array(requestSchema).max(30).optional(),
  facts: z.array(factSchema).max(60).optional(),
  issues: z.array(issueSchema).max(30).optional(),
});

/** PUT /api/judicial-assistant/cases/[caseId]/map — يحفظ الخريطة المُثبَّتة (المالك فقط). */
export async function PUT(request: NextRequest, { params }: { params: { caseId: string } }) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات الخريطة غير صالحة." }, { status: 400 });
  }

  const ok = await saveStructured(params.caseId, actorId, body);
  if (!ok) return NextResponse.json({ message: "تعذّر الحفظ (تحقّق من الملكيّة)." }, { status: 404 });

  await auditEvent({
    actorId, subject: "CASE", action: "JA_MAP_CONFIRMED", entityId: params.caseId,
    metadata: { parties: body.parties?.length ?? 0, facts: body.facts?.length ?? 0, issues: body.issues?.length ?? 0 },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
