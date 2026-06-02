import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
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
