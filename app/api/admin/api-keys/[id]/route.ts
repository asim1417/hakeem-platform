import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { isApiScope } from "@/lib/modules/api-gateway/api-keys";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  active: z.boolean().optional(),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10_000).optional(),
});

// PATCH /api/admin/api-keys/:id — تحديث الحالة/النطاقات/حدّ المعدّل.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "بيانات غير صالحة." }, { status: 400 });

  const data: { active?: boolean; scopes?: string[]; rateLimit?: number } = {};
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.rateLimit !== undefined) data.rateLimit = parsed.data.rateLimit;
  if (parsed.data.scopes) {
    const scopes = parsed.data.scopes.filter(isApiScope);
    if (scopes.length === 0) return NextResponse.json({ ok: false, error: "نطاق غير صالح." }, { status: 400 });
    data.scopes = scopes;
  }

  const key = await prisma.apiKey
    .update({ where: { id: params.id }, data, select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimit: true, active: true } })
    .catch(() => null);
  if (!key) return NextResponse.json({ ok: false, error: "المفتاح غير موجود." }, { status: 404 });

  await auditEvent({ actorId: gate.user?.id, subject: "ADMIN", action: "API_KEY_UPDATED", metadata: { keyId: key.id, ...data } }).catch(() => undefined);
  return NextResponse.json({ ok: true, key });
}

// DELETE /api/admin/api-keys/:id — إيقاف المفتاح (soft revoke: active=false، لا حذف).
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const key = await prisma.apiKey.update({ where: { id: params.id }, data: { active: false }, select: { id: true, keyPrefix: true } }).catch(() => null);
  if (!key) return NextResponse.json({ ok: false, error: "المفتاح غير موجود." }, { status: 404 });

  await auditEvent({ actorId: gate.user?.id, subject: "ADMIN", action: "API_KEY_REVOKED", metadata: { keyId: key.id, keyPrefix: key.keyPrefix } }).catch(() => undefined);
  return NextResponse.json({ ok: true, revoked: key.id });
}
