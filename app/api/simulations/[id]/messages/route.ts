import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { nextStageForRole } from "@/lib/modules/simulations/simulation-labels";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["القاضي الافتراضي", "المدعي", "المدعى عليه", "النظام"]),
  content: z.string().min(2, "نص الرسالة مطلوب.")
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await prisma.simulation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } },
      judgments: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = messageSchema.parse(await request.json());
  const user = await getSystemUser();
  const stage = nextStageForRole(payload.role);

  const message = await prisma.simulationMessage.create({
    data: {
      simulationId: params.id,
      role: payload.role,
      stage,
      content: payload.content
    }
  });

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_MESSAGE_CREATED",
    entityId: params.id,
    metadata: {
      role: payload.role,
      stage,
      description: "تمت إضافة رسالة إلى جلسة المحاكاة."
    }
  });

  return NextResponse.json({ message }, { status: 201 });
}
