import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { nextStageForRole } from "@/lib/modules/simulations/simulation-labels";

export const dynamic = "force-dynamic";

const allowedRoles = ["القاضي الافتراضي", "المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه", "النظام"] as const;

const messageSchema = z.object({
  role: z.enum(allowedRoles),
  content: z.string().min(2, "نص الرسالة مطلوب.")
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
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
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const payload = messageSchema.parse(await request.json());
  const user = gate.user!;
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
      description: "تمت إضافة مداخلة إلى جلسة المحاكاة."
    }
  });

  return NextResponse.json({ message }, { status: 201 });
}
