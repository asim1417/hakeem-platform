import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { isPleadingClosed } from "@/lib/modules/simulations/judge-engine";
import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

const disclaimer =
  "هذا المستند صادر في بيئة محاكاة تدريبية بمنصة حكيم، ولا يعد حكمًا قضائيًا، ولا رأيًا قانونيًا نهائيًا، ولا يغني عن مراجعة محام مختص. حكم تدريبي غير ملزم من حيث الأثر النظامي.";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
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

  if (!isPleadingClosed(session.decisions)) {
    return NextResponse.json({ message: "لا يمكن توليد مسودة الحكم قبل قفل باب المرافعة." }, { status: 400 });
  }

  const claim = extractClaim(session.messages);
  const plaintiff = session.messages.find((message) => message.role === "المدعي" || message.role === "وكيل المدعي")?.content;
  const defendant = session.messages.find((message) => message.role === "المدعى عليه" || message.role === "وكيل المدعى عليه")?.content;
  const query = [claim?.facts, claim?.requests, claim?.legalGrounds, claim?.subject].filter(Boolean).join(" ").slice(0, 120);
  const legalArticles = query
    ? await prisma.legalArticle.findMany({
        where: {
          OR: [
            { content: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } },
            { lawName: { contains: claim?.caseType ?? "", mode: "insensitive" } }
          ]
        },
        take: 3,
        select: { lawName: true, articleNumber: true, content: true }
      })
    : [];

  const citations = legalArticles.length
    ? legalArticles.map((article) => `- ${article.lawName}، المادة ${article.articleNumber}: ${article.content.slice(0, 180)}`).join("\n")
    : "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";

  const content = [
    "مسودة حكم قضائي مسبب",
    "بسم الله الرحمن الرحيم",
    `رقم الجلسة: ${session.id}`,
    `التاريخ: ${new Date().toLocaleString("ar-SA")}`,
    `نوع الدعوى: ${claim?.caseType || "غير محدد"}`,
    `أطراف الدعوى: ${claim?.plaintiffName || "المدعي"} ضد ${claim?.defendantName || "المدعى عليه"}`,
    "أولًا: الديباجة",
    "بناءً على ملف المحاكاة المقيد في منصة حكيم، وبعد قفل باب المرافعة في البيئة التدريبية، أعدت هذه المسودة لأغراض المحاكاة والتعلم.",
    "ثانيًا: الوقائع",
    claim?.facts || "لم تسجل وقائع تفصيلية كافية.",
    "ثالثًا: الطلبات والدفوع",
    `طلبات المدعي: ${claim?.requests || plaintiff || "غير محددة"}`,
    `دفوع المدعى عليه: ${claim?.defenses || defendant || "غير محددة"}`,
    "رابعًا: الأسباب",
    [
      "استندت هذه المسودة إلى ما أدخله المستخدمون في جلسة المحاكاة وما ظهر من مداخلات وقرارات إجرائية.",
      "المواد النظامية المسترجعة من قاعدة بيانات حكيم:",
      citations,
      "ولا يجوز اعتبار هذه المسودة منشئة لاستشهاد نظامي غير موجود في قاعدة البيانات."
    ].join("\n"),
    "خامسًا: المنطوق",
    legalArticles.length
      ? "لأغراض التدريب، تميل المسودة إلى قبول الطلبات في حدود ما تؤيده الوقائع والبينات المدخلة، مع بقاء التقدير النهائي مرهونًا بالمستندات والإجراءات النظامية الفعلية."
      : "لأغراض التدريب، لا تتكون نتيجة نظامية كافية لعدم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية أو لعدم اكتمال الوقائع.",
    "سادسًا: التنبيه",
    disclaimer,
    "التوقيع",
    "القاضي حكيم - قاض افتراضي تدريبي"
  ].join("\n\n");

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
      citationsCount: legalArticles.length
    }
  });

  return NextResponse.json({ judgment }, { status: 201 });
}
