/** DELETE /api/connections/:id — يلغي المستخدم ربط تطبيق بحسابه (يسري في الاستدعاء التالي). */
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { accountLinkingEnabled } from "@/lib/mcp/config";
import { getGrantStore } from "@/lib/mcp/grants/prisma-store";
import { revokeGrant } from "@/lib/mcp/grants/service";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  if (!accountLinkingEnabled()) return NextResponse.json({ ok: false, error: "الربط بالحساب غير مفعّل." }, { status: 503 });

  const ok = await revokeGrant({ store: getGrantStore(), grantId: params.id, actor: { userId: gate.user.id, isAdmin: false } }).catch(
    () => false
  );
  if (!ok) return NextResponse.json({ ok: false, error: "الربط غير موجود." }, { status: 404 });

  await auditEvent({ actorId: gate.user.id, subject: "AUTH", action: "MCP_LINK_REVOKED", entityId: params.id }).catch(() => undefined);
  return NextResponse.json({ ok: true, revoked: params.id });
}
