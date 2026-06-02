import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { trainingPathTitle } from "@/lib/modules/training/training-paths";

export const dynamic = "force-dynamic";

const schema = z.object({
  pathKey: z.string().min(2),
  answer: z.string().min(10, "اكتب إجابة تدريبية كافية.")
});

export async function POST(request: NextRequest) {
  const payload = schema.parse(await request.json());
  const user = await getSystemUser();
  const pathTitle = trainingPathTitle(payload.pathKey);
  const points = Math.min(20, Math.max(5, Math.ceil(payload.answer.trim().length / 40)));

  const existingProgress = await prisma.trainingProgress.findFirst({ where: { userId: user.id } });
  const progress = existingProgress
    ? await prisma.trainingProgress.update({
        where: { id: existingProgress.id },
        data: {
          points: { increment: points },
          badges: { push: pathTitle }
        }
      })
    : await prisma.trainingProgress.create({
        data: {
          userId: user.id,
          points,
          badges: [pathTitle]
        }
      });

  await auditEvent({
    actorId: user.id,
    subject: "TRAINING",
    action: "TRAINING_ATTEMPT_CREATED",
    entityId: progress.id,
    metadata: {
      pathKey: payload.pathKey,
      pathTitle,
      answerLength: payload.answer.length,
      points,
      description: `تم حفظ محاولة تدريب في مسار: ${pathTitle}`
    }
  });

  return NextResponse.json({
    message: "تم حفظ محاولة التدريب وتسجيلها في سجل التدقيق.",
    points,
    progress
  });
}
