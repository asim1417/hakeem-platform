import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createCase } from "@/lib/modules/judicial-assistant/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  subject: z.string().min(3, "أدخل موضوع القضية."),
  caseNumber: z.string().optional(),
  court: z.string().optional(),
  circuit: z.string().optional(),
  jurisdiction: z.string().optional(),
  confidentiality: z.string().optional(),
});

/** POST /api/judicial-assistant/cases — إنشاء قضية (مشروع) يملكها المستخدم. */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("JUDICIAL_ASSISTANT_USE", request);
  if (gate.response) return gate.response;
  const actorId = gate.user!.id;

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات القضية غير صالحة." }, { status: 400 });
  }

  const id = await createCase(actorId, payload);
  if (!id) {
    return NextResponse.json(
      { message: "تعذّر إنشاء القضية. قد تحتاج القاعدة لتطبيق الهجرة (npm run db:judicial)." },
      { status: 503 }
    );
  }

  await auditEvent({
    actorId, subject: "CASE", action: "JA_CASE_CREATED", entityId: id,
    metadata: { subject: payload.subject, jurisdiction: payload.jurisdiction },
  }).catch(() => undefined);

  return NextResponse.json({ id });
}
