import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { extractClaim } from "@/lib/modules/simulations/hakeem-judge";

export const dynamic = "force-dynamic";

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

  const claim = extractClaim(session.messages);
  const plaintiff = session.messages.find((message) => message.role === "المدعي" || message.role === "وكيل المدعي")?.content;
  const defendant = session.messages.find((message) => message.role === "المدعى عليه" || message.role === "وكيل المدعى عليه")?.content;
  const latestDecision = session.decisions.at(-1)?.content;
  const query = [claim?.facts, claim?.requests, claim?.legalGrounds, claim?.subject].filter(Boolean).join(" ").slice(0, 120);
  const legalArticles = query
    ? await prisma.legalArticle.findMany({
        where: {
          OR: [{ content: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }, { lawName: { contains: claim?.caseType ?? "", mode: "insensitive" } }]
        },
        take: 3,
        select: { lawName: true, articleNumber: true, content: true }
      })
    : [];
  const citations = legalArticles.length
    ? legalArticles.map((article) => `- ${article.lawName}، المادة ${article.articleNumber}: ${article.content.slice(0, 180)}`).join("\n")
    : "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";
  const content = [
    "حكم تدريبي غير ملزم",
    `رقم الجلسة: ${session.id}`,
    `التاريخ: ${new Date().toLocaleString("ar-SA")}`,
    `نوع الدعوى: ${claim?.caseType || "غير محدد"}`,
    `أطراف الدعوى: ${claim?.plaintiffName || "المدعي"} ضد ${claim?.defendantName || "المدعى عليه"}`,
    "أولًا: الوقائع",
    claim?.facts || "لم تسجل وقائع تفصيلية كافية.",
    "ثانيًا: الطلبات والدفوع",
    `طلبات المدعي: ${claim?.requests || plaintiff || "غير محددة"}`,
    `دفوع المدعى عليه: ${claim?.defenses || defendant || "غير محددة"}`,
    "ثالثًا: الأسباب",
    [
      "بعد الاطلاع على بيانات الدعوى التدريبية وما قدمه الأطراف في جلسة المحاكاة، يظهر أن التقييم التدريبي يتوقف على اكتمال الوقائع والطلبات والبينات.",
      latestDecision ? `كما صدر في الجلسة القرار الآتي: ${latestDecision}` : "ولم يظهر قرار إجرائي سابق مؤثر في هذا الحكم التدريبي.",
      "المواد النظامية المسترجعة من قاعدة بيانات حكيم:",
      citations
    ].join("\n"),
    "رابعًا: المنطوق",
    legalArticles.length ? "قبول الدعوى جزئيًا لأغراض التدريب مع التنبيه إلى ضرورة استكمال البينات قبل أي تقييم قانوني نهائي." : "عدم تكوين نتيجة نظامية نهائية لعدم كفاية المواد المسترجعة أو البيانات المدخلة في هذه المحاكاة.",
    "خامسًا: التنبيه",
    "هذا الحكم صادر في بيئة محاكاة تدريبية بمنصة حكيم، ولا يعد حكمًا قضائيًا، ولا رأيًا قانونيًا نهائيًا، ولا يغني عن مراجعة محامٍ مختص.",
    "القاضي الافتراضي التدريبي — حكيم"
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
