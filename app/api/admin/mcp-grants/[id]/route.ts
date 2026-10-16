/** DELETE /api/admin/mcp-grants/:id — يلغي المشرف أي ربط لموصل حكيم. */
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getGrantStore } from "@/lib/mcp/grants/prisma-store";
import { revokeGrant } from "@/lib/mcp/grants/service";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const ok = await revokeGrant({ store: getGrantStore(), grantId: params.id, actor: { userId: gate.user.id, isAdmin: true } }).catch(
    () => false
  );
  if (!ok) return NextResponse.json({ ok: false, error: "الربط غير موجود." }, { status: 404 });

  await auditEvent({ actorId: gate.user.id, subject: "ADMIN", action: "MCP_LINK_REVOKED", entityId: params.id }).catch(() => undefined);
  return NextResponse.json({ ok: true, revoked: params.id });
}
