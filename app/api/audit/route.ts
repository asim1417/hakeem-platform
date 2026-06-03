import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("GOVERNANCE_AUDIT_VIEW", request);
  if (gate.response) return gate.response;

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true, email: true } } }
  });

  return NextResponse.json({ events });
}
