import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { canUser } from "@/lib/modules/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSystemUser();
  const allowed = await canUser(user.id, "GOVERNANCE_AUDIT_VIEW");
  if (!allowed) return NextResponse.json({ message: "لا تملك صلاحية عرض سجل التدقيق." }, { status: 403 });

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: {
        select: { name: true, email: true }
      }
    }
  });

  return NextResponse.json({ events });
}
