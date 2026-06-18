import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { buildPermissionMatrix, isPermission, isRole, setRolePermission } from "@/lib/modules/auth/role-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role: z.string().refine(isRole, "دور غير معروف"),
  permission: z.string().refine(isPermission, "صلاحية غير معروفة"),
  grant: z.boolean(),
});

// GET /api/admin/roles — مصفوفة الأدوار×الصلاحيات.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;
  const matrix = await buildPermissionMatrix();
  return NextResponse.json({ ok: true, matrix });
}

// POST /api/admin/roles — منح/سحب صلاحية إضافية لدور.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "بيانات غير صالحة." }, { status: 400 });
  }
  const { role, permission, grant } = parsed.data;
  const result = await setRolePermission(role, permission, grant);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message ?? "تعذّر الحفظ." }, { status: 400 });
  }

  await auditEvent({
    actorId: gate.user?.id,
    subject: "ADMIN",
    action: grant ? "ROLE_PERMISSION_GRANTED" : "ROLE_PERMISSION_REVOKED",
    metadata: { description: `${grant ? "منح" : "سحب"} صلاحية ${permission} للدور ${role}`, role, permission },
  }).catch(() => undefined);

  const matrix = await buildPermissionMatrix();
  return NextResponse.json({ ok: true, matrix, message: result.message });
}
