import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { admissibilityCheck, encodeClaim, extractClaim } from "@/lib/modules/simulations/hakeem-judge";
import { encodeTurnState, extractTurnState } from "@/lib/modules/simulations/judge-engine";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().optional(),
  caseType: z.string().optional(),
  plaintiffName: z.string().optional(),
  plaintiffCapacity: z.string().optional(),
  defendantName: z.string().optional(),
  defendantCapacity: z.string().optional(),
  subject: z.string().optional(),
  facts: z.string().optional(),
  requests: z.string().optional(),
  claimAmount: z.string().optional(),
  legalGrounds: z.string().optional(),
  defenses: z.string().optional(),
  attendance: z.string().optional()
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  // [إصلاح تدقيق SEC-004: كان بلا فحص ملكيّة → قراءة محاكاة مستخدم آخر بمعرّفها.]
  const isAdmin = gate.user!.role === "SYSTEM_ADMIN";
  const session = await prisma.simulation.findFirst({
    where: isAdmin ? { id: params.id } : { id: params.id, userId: gate.user!.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } },
      judgments: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  const claim = extractClaim(session.messages);
  return NextResponse.json({ session, claim, admissibility: admissibilityCheck(claim), turnState: extractTurnState(session.messages) });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  // [إصلاح تدقيق SEC-004: تأكّد من ملكيّة الجلسة قبل التعديل — يمنع الكتابة على محاكاة الغير.]
  const owned = await prisma.simulation.findFirst({
    where: user.role === "SYSTEM_ADMIN" ? { id: params.id } : { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!owned) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  const payload = patchSchema.parse(await request.json());
  const title = payload.title || payload.subject || "جلسة محاكاة قضائية";

  const turnState = {
    allowedSpeakerRole: "claimant" as const,
    disabledRoles: ["defendant" as const, "defendant_agent" as const],
    requiredInput: "بيان المدعي لدعواه ووقائعها وطلباته.",
    procedureAction: "تمكين المدعي من عرض الدعوى",
    currentStage: "INITIAL_ADMISSIBILITY" as const,
    nextStage: "PLAINTIFF_STATEMENT" as const,
    reason: "تم تحديث صحيفة الدعوى، والدور للمدعي لاستكمال العرض."
  };

  const session = await prisma.simulation.update({
    where: { id: params.id },
    data: {
      title,
      stage: "INITIAL_ADMISSIBILITY",
      messages: {
        create: [
          {
            role: "النظام",
            stage: "CLAIM_FILING",
            content: encodeClaim(payload)
          },
          {
            role: "النظام",
            stage: "PLAINTIFF_STATEMENT",
            content: encodeTurnState(turnState)
          }
        ]
      }
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } },
      judgments: { orderBy: { createdAt: "asc" } }
    }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "HAKEEM_CLAIM_FILED",
    entityId: params.id,
    metadata: {
      description: "تم تقييد دعوى تدريبية في القاضي حكيم.",
      title,
      nextAllowedRole: turnState.allowedSpeakerRole,
      procedureAction: turnState.procedureAction,
      admissibility: admissibilityCheck(payload)
    }
  });

  return NextResponse.json({ session, claim: payload, admissibility: admissibilityCheck(payload), turnState });
}
