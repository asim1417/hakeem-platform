import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSystemUser();
  const session = await prisma.simulation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  const plaintiff = session.messages.find((message) => message.role === "المدعي")?.content;
  const defendant = session.messages.find((message) => message.role === "المدعى عليه")?.content;
  const latestDecision = session.decisions.at(-1)?.content;
  const content = [
    "حكم تدريبي غير ملزم",
    `موضوع المحاكاة: ${session.title}`,
    plaintiff ? `موجز مداخلة المدعي: ${plaintiff}` : "لم تسجل مداخلة للمدعي في هذه الجلسة.",
    defendant ? `موجز جواب المدعى عليه: ${defendant}` : "لم يسجل جواب للمدعى عليه في هذه الجلسة.",
    latestDecision ? `آخر قرار إجرائي: ${latestDecision}` : "لم تصدر قرارات إجرائية قبل الحكم.",
    "النتيجة التدريبية: يوصى بمراجعة اكتمال الوقائع والبينات قبل بناء أي موقف قانوني نهائي.",
    "هذا المخرج للتدريب والمحاكاة فقط، وليس حكمًا قضائيًا فعليًا."
  ].join("\n\n");

  const judgment = await prisma.simulationJudgment.create({
    data: {
      simulationId: params.id,
      stage: "TRAINING_JUDGMENT",
      content,
      disclaimer: "حكم تدريبي غير ملزم، ولا يعد حكمًا قضائيًا فعليًا أو رأيًا قانونيًا نهائيًا."
    }
  });

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage: "TRAINING_JUDGMENT" }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_TRAINING_JUDGMENT_CREATED",
    entityId: params.id,
    metadata: {
      judgmentId: judgment.id,
      requiredPhrase: "حكم تدريبي غير ملزم"
    }
  });

  return NextResponse.json({ judgment }, { status: 201 });
}
