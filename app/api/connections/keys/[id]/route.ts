/** DELETE /api/connections/keys/:id — يوقف المستخدم مفتاحه الشخصي (إيقاف لا حذف). */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;

  const res = await prisma.apiKey
    .updateMany({ where: { id: params.id, userId: gate.user.id }, data: { active: false } })
    .catch(() => ({ count: 0 }));
  if (res.count !== 1) return NextResponse.json({ ok: false, error: "المفتاح غير موجود." }, { status: 404 });

  await auditEvent({ actorId: gate.user.id, subject: "AUTH", action: "MCP_PERSONAL_KEY_REVOKED", entityId: params.id }).catch(() => undefined);
  return NextResponse.json({ ok: true, revoked: params.id });
}
