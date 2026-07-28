import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { isPleadingClosed } from "@/lib/modules/simulations/judge-engine";
import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";
import { generateReasonedJudgment } from "@/lib/modules/simulations/reasoned-judgment";

export const dynamic = "force-dynamic";

const disclaimer =
  "هذا المستند صادر في بيئة محاكاة تدريبية بمنصة حكيم، ولا يعد حكمًا قضائيًا، ولا رأيًا قانونيًا نهائيًا، ولا يغني عن مراجعة محام مختص. حكم تدريبي غير ملزم من حيث الأثر النظامي.";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const session = await findOwnedSimulation(user, params.id, {
    messages: { orderBy: { createdAt: "asc" } },
    decisions: { orderBy: { createdAt: "asc" } }
  });

  if (!session) {
    return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
  }

  if (!isPleadingClosed(session.decisions)) {
    return NextResponse.json({ message: "لا يمكن توليد مسودة الحكم قبل قفل باب المرافعة." }, { status: 400 });
  }

  const claim = extractClaim(session.messages);

  // الحكم المُعلَّل المؤصَّل بالصياغة القضائيّة السعوديّة (يناقش دفوع المحكوم ضدّه ويصدر منطوقًا
  // جازمًا مؤصَّلًا من النواة). حُذف القالب الاحتياطيّ الضعيف: عند تعذّر الحكم المؤصَّل يُرَدّ
  // خطأٌ صريح — لا حكمٌ زائفٌ ولا منطوقٌ صوريّ.
  let reasoned: Awaited<ReturnType<typeof generateReasonedJudgment>> = null;
  try {
    reasoned = await generateReasonedJudgment({ claim, messages: session.messages });
  } catch {
    reasoned = null;
  }
  if (!reasoned) {
    return NextResponse.json(
      {
        message:
          "تعذّر إصدار الحكم المعلَّل: يتطلّب تفعيل القاضي الذكيّ (Claude) وتوفّر أساسٍ نظاميٍّ مؤصَّلٍ للقضية من النواة. تأكّد من حالة المزوّد ومن اكتمال وقائع الدعوى وطلباتها ثمّ أعِد المحاولة."
      },
      { status: 503 }
    );
  }
  const content = reasoned.content;
  const judgmentMode = "reasoned" as const;
  const judgmentConfidence = reasoned.confidence;
  const judgmentKind = reasoned.kind;

  const judgment = await prisma.simulationJudgment.create({
    data: {
      simulationId: params.id,
      stage: "TRAINING_JUDGMENT",
      content,
      disclaimer
    }
  });

  await prisma.simulation.update({
    where: { id: params.id },
    data: { stage: "TRAINING_JUDGMENT" }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_REASONED_JUDGMENT_DRAFT_CREATED",
    entityId: params.id,
    metadata: {
      judgmentId: judgment.id,
      title: "مسودة حكم قضائي مسبب",
      mode: judgmentMode,
      kind: judgmentKind,
      confidence: judgmentConfidence,
      citationsCount: reasoned.articleCount,
      source: "legal_core"
    }
  });

  return NextResponse.json({ judgment, kind: judgmentKind }, { status: 201 });
}
