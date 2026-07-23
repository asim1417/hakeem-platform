import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { listFeatureToggles, setFeatureToggle, TOGGLE_CATALOG } from "@/lib/modules/admin/feature-toggles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const toggles = await listFeatureToggles();
  return NextResponse.json({ toggles });
}

const schema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  confirm: z.literal(true),
});

export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const actor = gate.user!;

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { message: "يلزم تأكيد صريح (confirm: true) ومفتاح راية صالح." },
      { status: 400 }
    );
  }

  if (!TOGGLE_CATALOG.some((t) => t.key === payload.key)) {
    return NextResponse.json({ message: "راية غير معروفة." }, { status: 400 });
  }

  const updated = await setFeatureToggle(payload.key, payload.enabled);
  if (!updated) {
    return NextResponse.json({ message: "تعذّر الحفظ." }, { status: 500 });
  }

  await auditEvent({
    actorId: actor.id,
    subject: "ADMIN",
    action: "FEATURE_TOGGLE_UPDATED",
    entityId: payload.key,
    metadata: {
      description: `تحديث راية خدمة: ${payload.key}`,
      enabled: payload.enabled,
    },
  });

  return NextResponse.json({ toggle: updated });
}
